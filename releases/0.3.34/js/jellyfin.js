import { mediaText } from "./text.js";
import { safeStream } from "./media-storage.js";
export class JellyfinError extends Error {
  constructor(code, message, stage, url, status = null) {
    const endpoint = new URL(url);
    super(
      `${message} [${stage} · ${code} · ${endpoint.origin}${endpoint.pathname}${status ? ` · HTTP ${status}` : ""}]`,
    );
    this.name = "JellyfinError";
    this.code = code;
    this.stage = stage;
    this.status = status;
    this.endpoint = endpoint.origin + endpoint.pathname;
  }
}
// Matches Jellyfin SDK / v12 AuthorizationContext: URI-encoded quoted values.
export function buildAuthorization({
  client,
  device,
  deviceId,
  version,
  token = "",
}) {
  const fields = {
    Client: client,
    Device: device,
    DeviceId: deviceId,
    Version: version,
    Token: token,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string" || (key !== "Token" && !value.trim()))
      throw Error("Identificativi client Jellyfin non validi.");
  }
  return (
    "MediaBrowser " +
    Object.entries(fields)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .join(", ")
  );
}
// Browser fetch intentionally cannot distinguish every CORS failure from network/TLS.
export function createJellyfin(fetcher = fetch, diagnostic = () => {}) {
  let server = "",
    token = "",
    user = "",
    generation = 0;
  const deviceId = crypto.randomUUID();
  const release =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="dompi-version"]')?.content || "PWA"
      : "test";
  const authorization = (includeToken = true) =>
    buildAuthorization({
      client: "Dompi",
      device: "Tablet browser",
      deviceId,
      version: release,
      token: includeToken ? token : "",
    });
  function serverURL(value) {
    const safe = safeStream(value);
    if (!safe) throw Error("Serve un indirizzo HTTPS senza credenziali.");
    const url = new URL(safe);
    if (url.search || url.hash)
      throw Error("Indirizzo server senza parametri.");
    return safe.replace(/\/$/, "");
  }
  async function json(url, options = {}, stage = "API", withAuth = true) {
    const revision = generation;
    const headers = {
      Accept: "application/json",
      ...(withAuth
        ? {
            Authorization:
              stage === "Verifica header / preflight"
                ? authorization(false)
                : authorization(),
          }
        : {}),
      ...options.headers,
    };
    let response;
    const report = (code, status = null, responseType = "non disponibile") => {
      // Deliberate allowlist: never headers, body, username, password or token.
      const endpoint = new URL(url);
      diagnostic({
        endpoint: endpoint.origin + endpoint.pathname,
        method: options.method || "GET",
        stage,
        code,
        status,
        responseType,
      });
    };
    report("IN_CORSO");
    try {
      const timeoutSignal = AbortSignal.timeout(15000);
      const requestSignal = options.signal
        ? typeof AbortSignal.any === "function"
          ? AbortSignal.any([options.signal, timeoutSignal])
          : options.signal
        : timeoutSignal;
      response = await fetcher(url, {
        ...options,
        headers,
        redirect: "manual",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: requestSignal,
      });
    } catch (error) {
      const timeout = ["TimeoutError", "AbortError"].includes(error.name);
      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      report(timeout ? "TIMEOUT" : offline ? "OFFLINE" : "NETWORK_OR_CORS");
      throw new JellyfinError(
        timeout ? "TIMEOUT" : offline ? "OFFLINE" : "NETWORK_OR_CORS",
        timeout
          ? "Timeout: il server non ha risposto in tempo."
          : offline
            ? "Dispositivo offline."
            : "Richiesta non leggibile dal browser: possibile rete, certificato TLS, CORS o preflight OPTIONS. Non è una verifica della password.",
        stage,
        url,
      );
    }
    if (revision !== generation) throw Error("Sessione terminata");
    const mime = (response.headers?.get("content-type") || "")
      .split(";")[0]
      .toLowerCase();
    const responseType = [
      "application/json",
      "application/problem+json",
      "text/html",
      "text/plain",
    ].includes(mime)
      ? mime
      : "altro / assente";
    report(
      response.ok ? "RISPOSTA_RICEVUTA" : `HTTP_${response.status}`,
      response.status || null,
      responseType,
    );
    if (
      response.type === "opaqueredirect" ||
      response.redirected ||
      (response.status >= 300 && response.status < 400)
    ) {
      report("REDIRECT", response.status || null, responseType);
      throw new JellyfinError(
        "REDIRECT",
        "Reindirizzamento del server/proxy: usa l’indirizzo HTTPS finale dell’API Jellyfin. Le credenziali non vengono inoltrate al redirect.",
        stage,
        url,
        response.status || null,
      );
    }
    if (!response.ok) {
      let message = `Il server ha rifiutato la richiesta.`;
      if (response.status === 400)
        message =
          "HTTP 400: formato della richiesta o identificativi client non accettati dall’API o dal proxy. Il login usa JSON Username/Pw e Authorization MediaBrowser. Non prova che la password sia errata; verifica fase ed endpoint nella diagnostica. Il corpo della risposta non viene mostrato per proteggere i dati personali.";
      if (response.status === 401)
        message =
          stage === "Login POST"
            ? "HTTP 401: accesso rifiutato da Jellyfin o dal proxy. Verifica account, autorizzazioni e autenticazione del reverse proxy; non dimostra da solo che la password sia errata."
            : stage === "API pubblica"
              ? "L’API pubblica richiede autenticazione (401): controllare l’eventuale protezione del reverse proxy prima del login Jellyfin."
              : "HTTP 401: sessione non accettata o scaduta, oppure autenticazione richiesta dal proxy.";
      if (response.status === 403)
        message = "HTTP 403: accesso vietato dal server o dal proxy.";
      if (response.status === 404)
        message =
          "HTTP 404: endpoint Jellyfin non trovato. Verifica anche l’eventuale sottocartella del server.";
      throw new JellyfinError(
        `HTTP_${response.status}`,
        message,
        stage,
        url,
        response.status,
      );
    }
    if (response.status === 204) return null;
    const type = response.headers?.get("content-type") || "";
    if (!/application\/(?:[a-z0-9.+-]+\+)?json/i.test(type)) {
      report("INVALID_RESPONSE", response.status, responseType);
      throw new JellyfinError(
        "INVALID_RESPONSE",
        "La risposta non è JSON Jellyfin: potrebbe essere una pagina di login del proxy o un altro servizio.",
        stage,
        url,
        response.status,
      );
    }
    try {
      const result = await response.json();
      report("OK", response.status, responseType);
      return result;
    } catch {
      report("INVALID_JSON", response.status, responseType);
      throw new JellyfinError(
        "INVALID_JSON",
        "Risposta JSON non valida o incompleta.",
        stage,
        url,
        response.status,
      );
    }
  }
  const request = (path, options = {}) =>
    json(server + path, options, "Sessione API");
  async function publicInfo(base, withHeaders = false) {
    const result = await json(
      base + "/System/Info/Public",
      withHeaders ? { headers: { "Content-Type": "application/json" } } : {},
      withHeaders ? "Verifica header / preflight" : "API pubblica",
      withHeaders,
    );
    if (
      !result ||
      typeof result !== "object" ||
      !(result.ServerName || result.Version)
    )
      throw new JellyfinError(
        "INVALID_RESPONSE",
        "L’endpoint pubblico non restituisce informazioni Jellyfin riconoscibili.",
        "API pubblica",
        base + "/System/Info/Public",
      );
    return result;
  }
  return {
    async connect(url, username, password) {
      server = serverURL(url);
      // Build an immutable request snapshot BEFORE public-API await or UI clearing.
      if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string"
      )
        throw new JellyfinError(
          "INVALID_INPUT",
          "Inserisci un nome utente valido e la password dal modulo.",
          "Preparazione login",
          server + "/Users/AuthenticateByName",
        );
      const loginURL = server + "/Users/AuthenticateByName";
      const loginBody = JSON.stringify({
        Username: username.trim(),
        Pw: password,
      });
      token = "";
      user = "";
      generation++;
      await publicInfo(server);
      const result = await json(
        loginURL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: loginBody,
        },
        "Login POST",
      );
      if (
        typeof result?.AccessToken !== "string" ||
        !result.AccessToken ||
        /[\r\n"]/.test(result.AccessToken) ||
        typeof result?.User?.Id !== "string"
      )
        throw new JellyfinError(
          "INVALID_RESPONSE",
          "Il login non ha restituito token e utente validi.",
          "Login POST",
          server + "/Users/AuthenticateByName",
        );
      token = result.AccessToken;
      user = result.User.Id;
      return request(`/Users/${encodeURIComponent(user)}/Views`);
    },
    session() { return token && user ? { server, user, token } : null; },
    async resume(saved) {
      if (!saved || typeof saved.token !== "string" || !saved.token || /[\r\n"]/.test(saved.token) || typeof saved.user !== "string" || !/^[a-zA-Z0-9-]+$/.test(saved.user)) throw Error("Sessione salvata non valida.");
      server = serverURL(saved.server);
      token = saved.token;
      user = saved.user;
      generation++;
      return request(`/Users/${encodeURIComponent(user)}/Views`);
    },
    async diagnose(url) {
      const base = serverURL(url);
      const info = await publicInfo(base);
      // No personal token is sent to a diagnostic server different from the logged-in server.
      await publicInfo(base, true);
      return info;
    },
    async search(parent, term = "", type = "Audio", start = 0, limit = 100) {
      if (!token) throw Error("Accedi a Jellyfin.");
      const query = new URLSearchParams({
        UserId: user,
        Recursive: "true",
        IncludeItemTypes: type,
        SearchTerm: term,
        Limit: String(Math.max(1, Math.min(500, Number(limit) || 100))),
        StartIndex: String(start),
        Fields: "Artists,Album,MediaSources",
        SortBy: "SortName",
        SortOrder: "Ascending",
      });
      if (parent && type !== "Playlist") query.set("ParentId", parent);
      if (type === "MusicArtist") query.delete("IncludeItemTypes");
      return request(
        (type === "MusicArtist" ? "/Artists?" : "/Items?") + query,
      );
    },
    async catalogInfo(parent = "", options = {}) {
      if (!token) throw Error("Accedi a Jellyfin.");
      const query = new URLSearchParams({
        UserId: user,
        Recursive: "true",
        IncludeItemTypes: "Audio",
        StartIndex: "0",
        Limit: "1",
        Fields: "DateCreated",
        SortBy: "DateCreated",
        SortOrder: "Descending",
        EnableImages: "false",
      });
      if (parent) query.set("ParentId", parent);
      const result = await request("/Items?" + query, options);
      const latest = result.Items?.[0];
      const total = Math.max(0, Number(result.TotalRecordCount) || 0);
      return {
        total,
        signature: [total, latest?.Id || "", latest?.DateCreated || ""].join(":"),
      };
    },
    async catalogPage(parent = "", start = 0, limit = 500, options = {}) {
      if (!token) throw Error("Accedi a Jellyfin.");
      const query = new URLSearchParams({
        UserId: user,
        Recursive: "true",
        IncludeItemTypes: "Audio",
        StartIndex: String(Math.max(0, Number(start) || 0)),
        Limit: String(Math.max(1, Math.min(500, Number(limit) || 500))),
        SortBy: "SortName",
        SortOrder: "Ascending",
        EnableImages: "false",
      });
      if (parent) query.set("ParentId", parent);
      return request("/Items?" + query, options);
    },
    async artistTracks(id, start = 0) {
      if (!token) throw Error("Accedi a Jellyfin.");
      return request(
        "/Items?" +
          new URLSearchParams({
            UserId: user,
            ArtistIds: id,
            StartIndex: String(start),
            Recursive: "true",
            IncludeItemTypes: "Audio",
            Fields: "Artists,Album",
            Limit: "100",
          }),
      );
    },
    async restore(ids, options = {}) {
      if (!token) throw Error("Accedi a Jellyfin.");
      const clean = ids.filter(
        (id) => typeof id === "string" && /^[a-zA-Z0-9-]+$/.test(id),
      );
      const found = new Map();
      for (let start = 0; start < clean.length; start += 100) {
        const result = await request(
          "/Items?" +
            new URLSearchParams({
              UserId: user,
              Ids: clean.slice(start, start + 100).join(","),
              Limit: "100",
              Fields: "Artists,Album",
              IncludeItemTypes: "Audio",
          }),
          options,
        );
        for (const item of result.Items || []) found.set(item.Id, item);
      }
      return clean.map((id) => found.get(id)).filter(Boolean);
    },
    async playlist(id, start = 0) {
      return request(
        `/Playlists/${encodeURIComponent(id)}/Items?UserId=${encodeURIComponent(user)}&Limit=100&StartIndex=${start}`,
      );
    },
    track(item) {
      if (!token) throw Error("Sessione terminata");
      const id = encodeURIComponent(item.Id);
      const imageId = item.ImageTags?.Primary ? item.Id : item.AlbumId || null;
      // Native HTMLAudio cannot attach authorization headers. Token URL remains in memory only.
      return {
        id: item.Id,
        file: { name: mediaText(item.Name) },
        title: mediaText(item.Name),
        artist: (item.Artists || []).map(mediaText).join(", "),
        album: mediaText(item.Album),
        url: `${server}/Audio/${id}/stream?Static=true&ApiKey=${encodeURIComponent(token)}`,
        cover: imageId
          ? `${server}/Items/${encodeURIComponent(imageId)}/Images/Primary?maxWidth=300&ApiKey=${encodeURIComponent(token)}`
          : null,
      };
    },
    disconnect() {
      token = "";
      user = "";
      server = "";
      generation++;
    },
  };
}
