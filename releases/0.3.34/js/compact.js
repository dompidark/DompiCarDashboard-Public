import { jellyfinTracks } from "./jellyfin-library.js";
import { localStore, storageError } from "./local-store.js";
import { initializePanels, initializeMarquee } from "./panels.js";
import { openAppleMaps } from "./launch.js";
import { icon } from "./icons.js";
import { readMedia, saveMedia, safeStream } from "./media-storage.js";
import {
  categories,
  discoverRadio,
  savedStations,
  matchesCategory,
} from "./radio.js";
import { createJellyfin } from "./jellyfin.js";
import {
  JellyfinGlobalSequence,
  buildJellyfinIndex,
  jellyfinGlobalDefaults,
  needsJellyfinRefill,
  randomSeed,
} from "./jellyfin-global.js";
import { navigators } from "./core.js";
import { showSettingsPage } from "./settings.js";
export function initializeCompact({
  music,
  chooseSource,
  notice,
  getPreferences,
}) {
  const $ = (id) => document.getElementById(id);
  document.body.classList.add("compact-edition");
  document.body.classList.add("prototype-v32");
  document.body.dataset.layout = "compact";
  const homeBar = document.createElement("div");
  homeBar.className = "prototype-homebar";
  homeBar.innerHTML = `<button id="home-maps" class="prototype-glow" type="button" aria-expanded="false">${icon("pinBrand")}<span>Mappe</span><small>⌄</small></button><button id="home-contacts" class="prototype-glow" type="button" aria-expanded="false">${icon("phoneBrand")}<span>Contatti</span><small>⌄</small></button><button id="home-settings" class="prototype-glow" type="button" aria-label="Impostazioni">${icon("settings")}</button><nav id="home-map-menu" class="prototype-dropdown" aria-label="Applicazioni di navigazione" hidden></nav><nav id="home-contact-menu" class="prototype-dropdown prototype-dropdown-contacts" aria-label="Comunicazioni" hidden></nav>`;
  $("home").prepend(homeBar);
  const mapMenu = $("home-map-menu");
  const contactMenu = $("home-contact-menu");
  let activeDockApp = readMedia().activeDockApp || "";
  function selectDockApp(id) {
    activeDockApp = id;
    saveMedia({ activeDockApp: id });
    for (const button of homeBar.querySelectorAll("[data-home-app]")) {
      const selected = button.dataset.homeApp === id;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute(
        "aria-description",
        selected ? "Ultima applicazione aperta" : "",
      );
    }
  }
  function closeHomeMenus() {
    mapMenu.hidden = true;
    contactMenu.hidden = true;
    $("home-maps").setAttribute("aria-expanded", "false");
    $("home-contacts").setAttribute("aria-expanded", "false");
  }
  function launchEntry(entry) {
    selectDockApp(entry.id);
    closeHomeMenus();
    if (entry.id === "apple") {
      openAppleMaps(notice);
      return;
    }
    if (entry.screen) {
      location.hash = entry.screen;
      return;
    }
    const a = document.createElement("a");
    a.href = entry.app || entry.url;
    a.target = entry.app ? "_self" : "_blank";
    a.rel = "noopener noreferrer";
    a.click();
    notice(
      "Apertura richiesta. Se l’app non si apre, installala dallo store o usa il relativo sito. L’affiancamento si gestisce da iPadOS.",
    );
  }
  function menuButton(entry) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.homeApp = entry.id;
    button.setAttribute("aria-label", entry.name);
    button.setAttribute("aria-pressed", String(activeDockApp === entry.id));
    button.classList.toggle("active", activeDockApp === entry.id);
    button.innerHTML = `${icon(
      {
        waze: "waze",
        google: "googlemaps",
        apple: "navigation",
        phone: "phone",
        chat: "chat",
      }[entry.id] || "external",
    )}<span>${entry.name}</span>`;
    button.onclick = () => launchEntry(entry);
    return button;
  }
  function renderHomeMenus() {
    mapMenu.replaceChildren();
    contactMenu.replaceChildren();
    const prefs = getPreferences();
    for (const [id, service] of Object.entries(navigators))
      if (id !== "apple" || prefs.platform === "ipad")
        mapMenu.append(menuButton({ ...service, id }));
    contactMenu.append(
      menuButton({ id: "phone", name: "Telefono", screen: "phone" }),
      menuButton({ id: "chat", name: "WhatsApp", app: "whatsapp://" }),
    );
  }
  renderHomeMenus();
  $("home-maps").onclick = () => {
    const open = mapMenu.hidden;
    closeHomeMenus();
    mapMenu.hidden = !open;
    $("home-maps").setAttribute("aria-expanded", String(open));
  };
  $("home-contacts").onclick = () => {
    const open = contactMenu.hidden;
    closeHomeMenus();
    contactMenu.hidden = !open;
    $("home-contacts").setAttribute("aria-expanded", String(open));
  };
  $("home-settings").onclick = () => {
    closeHomeMenus();
    location.hash = "settings";
  };
  document.addEventListener("pointerdown", (event) => {
    if (!homeBar.contains(event.target)) closeHomeMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeHomeMenus();
  });
  $("settings").addEventListener("change", () => setTimeout(renderHomeMenus));
  // A distinct single-column shell, not a resized dashboard sidebar.
  const infoGrid = document.querySelector(".info-grid");
  infoGrid.innerHTML = `<section><h3>Compatibilità</h3><p>Safari iPadOS 26 e browser Android moderni, HTTPS e audio supportato dal dispositivo. Preferenze conservate localmente.</p></section><section><h3>GPS / GNSS</h3><p>iPad Wi-Fi: nessun ricevitore GNSS integrato; la posizione può dipendere dalle reti disponibili. iPad Wi-Fi + Cellular: GPS/GNSS integrato, con permesso di localizzazione. Su Android dipende dal modello e dai permessi. Velocità e precisione non sono sempre disponibili.</p></section><section><h3>Finestre iPad e Slide Over</h3><p>1. In Impostazioni iPad attiva la modalità «Sistema a finestre» (o Stage Manager, se disponibile). 2. Apri Dompi dalla schermata Home e, dal menu della finestra, usa Slide Over quando disponibile. 3. Ridimensiona e posiziona Dompi a destra, quindi apri Waze, Google Maps o Mappe Apple e sistemala a sinistra. 4. Chiudi e riapri le app per verificare se iPadOS conserva la disposizione.</p><p>La configurazione è manuale: Slide Over e le dimensioni selezionabili dipendono dal modello e dalla versione di iPadOS. Dompi non può bloccare o ripristinare la geometria delle finestre esterne; se esci dalla modalità Slide Over, potrebbe essere necessario riattivarla. Per un iPad usato anche normalmente, puoi ripristinare la disposizione standard delle finestre.</p></section><section><h3>Autore</h3><p>Domenico Pizzata · <a href="mailto:dompidark@gmail.com">dompidark@gmail.com</a></p><p><a href="https://www.newtecnouser.com/" target="_blank" rel="noopener noreferrer">www.newtecnouser.com</a></p></section><section><h3>Aggiornamenti</h3><p>Verifica all’avvio e al ritorno in primo piano. Cache separate per installazione, risorse versionate e attivazione con conferma. iPadOS può rimandare il controllo mentre la PWA è sospesa.</p><button id="info-check-updates">Controlla aggiornamenti</button><p id="info-update-status" role="status"></p><a id="info-updates-link" href="#settings">Apri Aggiornamenti</a></section>`;
  const mirrorUpdates = () => {
    $("info-update-status").textContent = $("update-status").textContent;
    $("info-check-updates").disabled = $("check-updates").disabled;
  };
  $("info-check-updates").onclick = () => $("check-updates").click();
  $("info-updates-link").onclick = () => showSettingsPage("updates");
  new MutationObserver(mirrorUpdates).observe($("updates-section"), {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
  mirrorUpdates();
  const oldHeader = document.querySelector(".topbar");
  const header = document.createElement("header");
  header.className = "compact-header";
  const name = document.createElement("strong");
  name.textContent = "Dompi";
  name.setAttribute("aria-label", "Dompi Car Dashboard");
  const headerNav = document.createElement("nav");
  headerNav.setAttribute("aria-label", "Navigazione Dashboard");
  const homeButton = document.querySelector('nav [data-screen="home"]');
  const settingsButton = document.querySelector('nav [data-screen="settings"]');
  homeButton.innerHTML = icon("home");
  homeButton.setAttribute("aria-label", "Torna alla Home");
  settingsButton.innerHTML = icon("settings");
  settingsButton.setAttribute("aria-label", "Impostazioni");
  const infoButton = document.querySelector('nav [data-screen="info"]');
  infoButton.innerHTML = icon("info");
  infoButton.setAttribute("aria-label", "Informazioni");
  headerNav.append(homeButton, infoButton, settingsButton);
  const identity = document.createElement("div");
  identity.className = "compact-identity";
  const date = $("date");
  date.className = "compact-date";
  identity.append($("clock"), name, date);
  $("page-title").className = "sr-only";
  header.append(identity, headerNav, $("page-title"));
  oldHeader.replaceWith(header);
  const tools = document.createElement("nav");
  tools.className = "compact-tools";
  tools.setAttribute("aria-label", "Altre funzioni");
  for (const control of document.querySelectorAll(".sidebar nav button"))
    tools.append(control);
  document.querySelector('[data-page="general"]').append(tools);
  document.querySelector(".sidebar").remove();
  const devicePage = document.createElement("section");
  devicePage.className = "settings-page";
  devicePage.dataset.page = "device";
  devicePage.hidden = true;
  devicePage.setAttribute("aria-label", "GPS e dispositivo");
  devicePage.append(document.querySelector(".home-telemetry"));
  document.querySelector(".settings-pages").append(devicePage);
  const deviceButton = document.createElement("button");
  deviceButton.type = "button";
  deviceButton.textContent = "GPS";
  deviceButton.setAttribute("aria-label", "GPS e dispositivo");
  deviceButton.dataset.settingsPage = "device";
  deviceButton.onclick = () => showSettingsPage("device");
  document.querySelector(".settings-categories").append(deviceButton);
  const mapPanel = document.querySelector(".map-panel");
  document.querySelector(".diagnostics-panel").append(mapPanel);
  document.querySelector(".right-column").className = "compact-player-slot";
  document.querySelector(".dashboard").className = "compact-stack";
  const summary = document.createElement("div");
  summary.className = "track-summary";
  const coverSpace = document.createElement("div");
  coverSpace.className = "cover-space";
  const album = document.querySelector("#player .album");
  const trackPosition =
    album.querySelector("#track-position") || document.createElement("span");
  trackPosition.id = "track-position";
  const queueCurrent = document.createElement("button");
  queueCurrent.id = "queue-current";
  queueCurrent.type = "button";
  queueCurrent.className = "cover-heart";
  queueCurrent.textContent = "♡";
  queueCurrent.setAttribute("aria-label", "Aggiungi il brano corrente alla coda");
  queueCurrent.onclick = () => {
    const added = music.enqueueCurrent();
    queueCurrent.classList.toggle("active", added);
    queueCurrent.textContent = added ? "♥" : "♡";
    notice(added ? "Brano aggiunto in fondo alla coda." : "Nessun brano interno da aggiungere alla coda.");
    if (added) setTimeout(() => {
      queueCurrent.classList.remove("active");
      queueCurrent.textContent = "♡";
    }, 900);
  };
  album.append(queueCurrent);
  coverSpace.append(album);
  const trackInfo = document.createElement("div");
  trackInfo.className = "prototype-track-info";
  const albumName = $("album-name");
  trackPosition.className = "count";
  trackInfo.append($("track"), $("artist"), albumName, trackPosition);
  summary.append(coverSpace, trackInfo);
  document.querySelector("#player .source-tabs").after(summary);
  document.querySelector("#player .source-tabs").prepend($("player-mode"));
  $("current-source").className = "sr-only";
  const sourceLink = document.querySelector("#player .source-tabs a");
  sourceLink.textContent = "Sorgente";
  sourceLink.onclick = () => showSettingsPage("music");
  document.querySelector("#player .section-heading").remove();
  const repeatButton = document.createElement("button");
  repeatButton.id = "repeat-toggle";
  repeatButton.type = "button";
  repeatButton.innerHTML = icon("repeat");
  repeatButton.setAttribute("aria-label", "Ripetizione disattivata");
  repeatButton.setAttribute("aria-pressed", "false");
  document.querySelector("#player .playback").append(repeatButton);
  const section = document.createElement("article");
  section.className = "panel compact-library";
  section.innerHTML = `<div class="media-tabs" role="group" aria-label="Libreria"><button data-media-tab="radio">Radio</button><button data-media-tab="local">Locali</button><button data-media-tab="nas">Jellyfin</button><button data-media-tab="queue">Coda</button></div>
 <section data-media-page="radio"><div class="filter-row"><input id="radio-search" type="search" placeholder="Cerca una radio" aria-label="Cerca una radio"><select id="radio-category" aria-label="Categoria radio"></select></div><div class="filter-row"><button id="radio-favorites" aria-pressed="false">♡ Preferiti</button></div><p id="radio-status" role="status">Catalogo Radio Browser · seleziona una radio per ascoltarla.</p><div id="radio-list" class="media-list"></div><details class="manual-radio"><summary>Aggiungi una radio</summary><form id="manual-radio"><label>Nome radio<input id="manual-name" required maxlength="100"></label><label>Stream HTTPS<input id="manual-url" type="url" required placeholder="https://…/stream.mp3"></label><button>Aggiungi radio</button></form></details></section>
 <section data-media-page="local" hidden><div id="compact-local"></div></section>
 <section data-media-page="nas" hidden><form id="jellyfin-login"><label>Server HTTPS<input id="jf-server" type="url" placeholder="https://musica.example.com" required></label><label>Utente<input id="jf-user" autocomplete="username" required></label><label>Password<input id="jf-password" type="password" autocomplete="current-password" required></label><label class="remember-session"><input id="jf-remember" type="checkbox" checked> Ricorda collegamento su questo dispositivo</label><div class="filter-row"><button>Collega Jellyfin</button><button type="button" id="jf-diagnose">Diagnostica API</button></div></form><p id="jf-status" role="status">Puoi ricordare il collegamento su questo dispositivo; la password non viene salvata.</p><div id="jf-browser" hidden><button id="jf-logout">Disconnetti</button><form id="jf-search-form"><label>Libreria<select id="jf-library"></select></label><div class="filter-row"><input id="jf-search" placeholder="Brano, artista o album" aria-label="Ricerca Jellyfin"><select id="jf-type" aria-label="Tipo ricerca"><option value="Audio">Brani</option><option value="MusicArtist">Artisti</option><option value="MusicAlbum">Album</option><option value="Playlist">Playlist</option></select></div><button>Cerca</button></form><button id="jf-back" hidden>Torna ai risultati</button><div id="jf-items" class="media-list"></div><button id="jf-more" hidden>Altri risultati</button></div></section>
 <section data-media-page="queue" hidden><div class="filter-row"><label>Ripeti<select id="repeat"><option value="off">No</option><option value="all">Tutta la coda</option><option value="one">Un brano</option></select></label></div><label>Coda visualizzata<select id="queue-source"><option value="local">Musica locale</option><option value="nas">Jellyfin</option></select></label><p id="queue-note">Seleziona file locali o brani Jellyfin.</p><div id="queue-list" class="media-list"></div></section>`;
  document.querySelector(".compact-stack").append(section);
  $("compact-local").append(document.querySelector(".local-library"));
  const randomButton = document.createElement("button");
  randomButton.id = "shuffle";
  randomButton.innerHTML = icon("shuffle");
  randomButton.setAttribute("aria-label", "Riproduzione casuale");
  randomButton.title = "Riproduzione casuale";
  randomButton.setAttribute("aria-pressed", "false");
  document.querySelector("#player .playback").prepend(randomButton);
  const visual = document.createElement("div");
  visual.className = "spectrum-box";
  visual.innerHTML = '<canvas id="spectrum" width="640" height="84" hidden aria-label="Spettro audio reale"></canvas><div id="vu-fallback" aria-label="VU decorativo, non misura audio"><div class="vu-face"><span>−20　−10　−5　0　+3</span><i></i><b>VU demo · L</b></div><div class="vu-face"><span>−20　−10　−5　0　+3</span><i></i><b>VU demo · R</b></div></div><small id="spectrum-status"></small>';
  visual.prepend(document.querySelector("#player .volume"));
  $("player").append(visual);
  const visualChoice = document.createElement("div");
  visualChoice.className = "visual-choice";
  visualChoice.setAttribute("role", "group");
  visualChoice.setAttribute("aria-label", "Visualizzazione audio");
  for (const [value, label] of [["spectrum", "Spettro"], ["vu", "VU meter"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.visualization = value;
    button.innerHTML = `${icon(value === "spectrum" ? "spectrumBrand" : "vuBrand")}<span>${label}</span>`;
    const selected = readMedia().visualization === "vu" ? "vu" : "spectrum";
    button.setAttribute("aria-pressed", String(selected === value));
    button.onclick = () => {
      visualChoice.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      music.setVisualization(value);
    };
    visualChoice.append(button);
  }
  $("spectrum-status").before(visualChoice);
  const tabs = section.querySelector(".media-tabs");
  for (const button of tabs.querySelectorAll("[data-media-tab]")) {
    const id = button.dataset.mediaTab;
    const label = button.textContent;
    button.innerHTML = `${icon(
      { radio: "radioBrand", local: "folderBrand", nas: "jellyfinBrand", queue: "queueBrand" }[id],
    )}<span>${label}</span>`;
  }
  document.querySelector(".compact-stack").append(tabs);
  const panels = initializePanels({
    sheet: section,
    player: $("player"),
    tabs,
    homeButton,
    onActivate(id) {
      if (!["radio", "local", "nas"].includes(id)) return;
      music.activate(id);
    },
  });
  const tab = (id) => panels.open(id);
  document.addEventListener("dompi-media-chosen", () => tab(null));
  initializeMarquee($("track"));
  initializeMarquee($("artist"));
  document
    .querySelector('[data-page="music"]')
    .append($("music-link"), $("music-store"), $("music-web"));
  const appleLink = document.querySelector(
    '.navigator-options a[href="https://maps.apple.com/"]',
  );
  appleLink.addEventListener("click", (event) => {
    event.preventDefault();
    openAppleMaps(notice);
  });
  document.addEventListener("dompi-library", (event) => tab(event.detail));
  document
    .querySelector('nav [data-screen="music"]')
    .addEventListener("click", () => {
      setTimeout(() => {
        location.hash = "home";
        tab("local");
      });
    });
  $("source").addEventListener("change", () => tab(null));
  function renderQueue(state) {
    const type = ["nas", "local"].includes(state.source)
      ? state.source
      : $("queue-source").value;
    state = music.getQueueState(type);
    $("queue-source").value = type;
    $("shuffle").setAttribute("aria-pressed", String(state.shuffle));
    $("repeat").value = state.repeat;
    $("repeat").dataset.active = String(state.repeat !== "off");
    $("queue-list").replaceChildren();
    $("queue-note").textContent = state.tracks.length
      ? `${state.tracks.length} brani · ${state.source === "nas" ? "Jellyfin" : "File locali"}`
      : "Coda vuota. Aggiungi brani dalla libreria.";
    state.tracks.forEach((track, i) => {
      const b = document.createElement("button");
      b.textContent = track.name + (track.artist ? " · " + track.artist : "");
      b.setAttribute("aria-current", String(i === state.index));
      b.onclick = () => music.selectTrack(i, state.source);
      const row = document.createElement("div");
      row.className = "queue-row";
      const actions = document.createElement("div");
      actions.className = "queue-actions";
      for (const [label, delta, text] of [
        ["Sposta prima", -1, "↑"],
        ["Sposta dopo", 1, "↓"],
        ["Rimuovi dalla coda", null, "×"],
      ]) {
        const action = document.createElement("button");
        action.textContent = text;
        action.setAttribute("aria-label", `${label}: ${track.name}`);
        action.disabled =
          (delta === -1 && i === 0) ||
          (delta === 1 && i === state.tracks.length - 1);
        action.onclick = () => music.editQueue(state.source, i, delta);
        actions.append(action);
      }
      row.append(b, actions);
      $("queue-list").append(row);
    });
  }
  document.addEventListener("dompi-queue", (e) => renderQueue(e.detail));
  renderQueue(music.getState());
  $("queue-source").onchange = () =>
    renderQueue(music.getQueueState($("queue-source").value));
  $("shuffle").onclick = () => {
    if (globalSession?.active || globalIndexController)
      stopGlobalShuffle(
        "Casuale globale interrotto: modalità casuale della coda attivata.",
      );
    const enabled = $("shuffle").getAttribute("aria-pressed") !== "true";
    music.modes(enabled, $("repeat").value);
    if (enabled && music.getState().source === "nas") playItem(null, false, true);
  };
  $("repeat").onchange = () =>
    {
      music.modes(
        $("shuffle").getAttribute("aria-pressed") === "true",
        $("repeat").value,
      );
      syncRepeatButton();
    };
  function syncRepeatButton() {
    const value = $("repeat").value;
    repeatButton.setAttribute("aria-pressed", String(value !== "off"));
    repeatButton.dataset.repeat = value;
    repeatButton.setAttribute(
      "aria-label",
      value === "one"
        ? "Ripeti brano"
        : value === "all"
          ? "Ripeti tutta la coda"
          : "Ripetizione disattivata",
    );
  }
  repeatButton.onclick = () => {
    const values = ["off", "all", "one"];
    $("repeat").value = values[(values.indexOf($("repeat").value) + 1) % values.length];
    $("repeat").dispatchEvent(new Event("change", { bubbles: true }));
  };
  document.addEventListener("dompi-queue", syncRepeatButton);
  syncRepeatButton();
  const localTools = document.createElement("div");
  localTools.className = "local-tools";
  localTools.innerHTML =
    '<div class="local-action-grid"><label class="file-picker secondary" for="local-folder">Importa cartella</label><input id="local-folder" type="file" multiple webkitdirectory hidden><button id="local-tracks-open" type="button">Brani locali <span id="local-track-count">0</span></button></div><div class="local-playlist-tools"><label>Nome playlist<input id="playlist-name" maxlength="80" placeholder="La mia playlist"></label><button id="playlist-save">Salva coda locale</button><label>Playlist salvate<select id="playlist-list"></select></label><div class="filter-row"><button id="playlist-load">Carica coda</button><button id="playlist-delete">Elimina playlist</button></div></div>';
  const localLibrary = document.querySelector(".local-library");
  const localHelp = localLibrary.querySelector("p");
  const localActions = localTools.querySelector(".local-action-grid");
  localActions.prepend(
    localLibrary.querySelector('label[for="local-files"]'),
    $("local-files"),
  );
  localLibrary.insertBefore(localTools, localHelp);
  const localPage = section.querySelector('[data-media-page="local"]');
  const localTracksSheet = document.createElement("div");
  localTracksSheet.id = "local-tracks-sheet";
  localTracksSheet.className = "local-tracks-sheet";
  localTracksSheet.inert = true;
  localTracksSheet.setAttribute("aria-hidden", "true");
  localTracksSheet.innerHTML =
    '<div class="local-tracks-heading"><button id="local-tracks-close" type="button">‹ Locali</button><strong>Brani locali</strong><span id="local-track-sheet-count">0</span></div>';
  localTracksSheet.append($("local-tracks"));
  localPage.append(localTracksSheet);
  function showLocalTracks(open, restoreFocus = true) {
    localTracksSheet.classList.toggle("is-open", open);
    localTracksSheet.inert = !open;
    localTracksSheet.setAttribute("aria-hidden", String(!open));
    localPage.dataset.tracksOpen = String(open);
    if (open) {
      $("local-tracks").scrollTop = 0;
      $("local-tracks-close").focus({ preventScroll: true });
    } else if (restoreFocus && document.body.dataset.screen === "home") {
      $("local-tracks-open").focus({ preventScroll: true });
    }
    document.dispatchEvent(new Event("dompi-render"));
  }
  $("local-tracks-open").onclick = () => showLocalTracks(true);
  $("local-tracks-close").onclick = () => showLocalTracks(false);
  const updateLocalTrackCount = () => {
    const count = $("local-tracks").querySelectorAll(".station-row").length;
    $("local-track-count").textContent = String(count);
    $("local-track-sheet-count").textContent = String(count);
  };
  new MutationObserver(updateLocalTrackCount).observe($("local-tracks"), {
    childList: true,
  });
  updateLocalTrackCount();
  document.addEventListener("dompi-media-chosen", () =>
    showLocalTracks(false, false),
  );
  document.addEventListener("dompi-panelchange", () => {
    if ($("home").dataset.panel !== "local") showLocalTracks(false, false);
  });
  $("local-folder").onchange = async () => {
    const input = $("local-folder");
    input.disabled = true;
    try {
      await music.importLocal([...input.files]);
    } finally {
      input.value = "";
      input.disabled = false;
    }
  };
  async function refreshPlaylists() {
    try {
      const entries = await music.playlists();
      $("playlist-list").replaceChildren(
        ...entries.map((p) => new Option(p.name, p.id)),
      );
      $("playlist-load").disabled = $("playlist-delete").disabled =
        !entries.length;
    } catch (e) {
      $("local-status").textContent = storageError(e);
    }
  }
  $("playlist-save").onclick = async () => {
    const name = $("playlist-name").value.trim();
    if (!name) {
      notice("Inserisci il nome della playlist.");
      return;
    }
    try {
      await music.savePlaylist(name);
      await refreshPlaylists();
      notice("Coda locale salvata.");
    } catch (e) {
      notice(storageError(e));
    }
  };
  $("playlist-load").onclick = async () => {
    try {
      await music.loadPlaylist($("playlist-list").value);
      notice("Coda locale caricata. Premi un titolo per ascoltare.");
    } catch (e) {
      notice(storageError(e));
    }
  };
  $("playlist-delete").onclick = async () => {
    if (
      !confirm(
        "Eliminare questa playlist? I brani importati restano in libreria.",
      )
    )
      return;
    try {
      await music.deletePlaylist($("playlist-list").value);
      await refreshPlaylists();
    } catch (e) {
      notice(storageError(e));
    }
  };
  refreshPlaylists();
  document.addEventListener("dompi-local-ready", refreshPlaylists);
  const radioPage = section.querySelector('[data-media-page="radio"]');
  const radioList = $("radio-list");
  const radioControls = document.createElement("div");
  radioControls.id = "compact-radio";
  [...radioPage.children]
    .filter((child) => child !== radioList)
    .forEach((child) => radioControls.append(child));
  radioPage.prepend(radioControls);
  const radioStationsOpen = document.createElement("button");
  radioStationsOpen.id = "radio-stations-open";
  radioStationsOpen.type = "button";
  radioStationsOpen.innerHTML =
    'Stazioni radio <span id="radio-station-count">0</span>';
  const manualRadio = radioControls.querySelector(".manual-radio");
  radioControls.insertBefore(manualRadio, $("radio-status"));
  radioControls.insertBefore(radioStationsOpen, $("radio-status"));
  const radioStationsSheet = document.createElement("div");
  radioStationsSheet.id = "radio-stations-sheet";
  radioStationsSheet.className = "local-tracks-sheet radio-stations-sheet";
  radioStationsSheet.inert = true;
  radioStationsSheet.setAttribute("aria-hidden", "true");
  radioStationsSheet.innerHTML =
    '<div class="local-tracks-heading radio-stations-heading"><button id="radio-stations-close" type="button">‹ Radio</button><strong>Stazioni radio</strong><span id="radio-station-sheet-count">0</span></div>';
  radioStationsSheet.append(radioList);
  radioPage.append(radioStationsSheet);
  function showRadioStations(open, restoreFocus = true) {
    radioStationsSheet.classList.toggle("is-open", open);
    radioStationsSheet.inert = !open;
    radioStationsSheet.setAttribute("aria-hidden", String(!open));
    radioPage.dataset.stationsOpen = String(open);
    if (open) {
      radioList.scrollTop = 0;
      $("radio-stations-close").focus({ preventScroll: true });
    } else if (restoreFocus && document.body.dataset.screen === "home") {
      radioStationsOpen.focus({ preventScroll: true });
    }
    document.dispatchEvent(new Event("dompi-render"));
  }
  radioStationsOpen.onclick = () => showRadioStations(true);
  $("radio-stations-close").onclick = () => showRadioStations(false);
  const updateRadioStationCount = () => {
    const count = radioList.querySelectorAll(".station-row").length;
    $("radio-station-count").textContent = String(count);
    $("radio-station-sheet-count").textContent = String(count);
  };
  new MutationObserver(updateRadioStationCount).observe(radioList, {
    childList: true,
  });
  updateRadioStationCount();
  document.addEventListener("dompi-media-chosen", () =>
    showRadioStations(false, false),
  );
  document.addEventListener("dompi-panelchange", () => {
    if ($("home").dataset.panel !== "radio")
      showRadioStations(false, false);
  });
  const jellyfinPage = section.querySelector('[data-media-page="nas"]');
  const jellyfinMain = document.createElement("div");
  jellyfinMain.id = "compact-jellyfin";
  [...jellyfinPage.children].forEach((child) => jellyfinMain.append(child));
  jellyfinPage.append(jellyfinMain);
  const jellyfinItemsOpen = document.createElement("button");
  jellyfinItemsOpen.id = "jf-items-open";
  jellyfinItemsOpen.type = "button";
  jellyfinItemsOpen.innerHTML =
    'Brani Jellyfin <span id="jf-item-count">0</span>';
  const jellyfinLoadState = document.createElement("div");
  jellyfinLoadState.id = "jf-load-state";
  jellyfinLoadState.className = "jellyfin-load-state";
  jellyfinLoadState.hidden = true;
  jellyfinLoadState.setAttribute("role", "status");
  jellyfinLoadState.innerHTML =
    '<div><span id="jf-load-label">Caricamento Jellyfin</span><strong id="jf-load-count">0</strong></div><progress id="jf-load-progress" max="1" value="0"></progress>';
  $("jf-search-form").after(jellyfinLoadState, jellyfinItemsOpen);
  const jellyfinItemsSheet = document.createElement("div");
  jellyfinItemsSheet.id = "jf-items-sheet";
  jellyfinItemsSheet.className = "local-tracks-sheet jellyfin-items-sheet";
  jellyfinItemsSheet.inert = true;
  jellyfinItemsSheet.setAttribute("aria-hidden", "true");
  jellyfinItemsSheet.innerHTML =
    '<div class="local-tracks-heading"><button id="jf-items-close" type="button">‹ Jellyfin</button><strong id="jf-items-title">Brani Jellyfin</strong><span id="jf-item-sheet-count">0</span></div>';
  jellyfinItemsSheet.append($("jf-back"), $("jf-items"), $("jf-more"));
  jellyfinPage.append(jellyfinItemsSheet);
  function showJellyfinItems(open, restoreFocus = true) {
    jellyfinItemsSheet.classList.toggle("is-open", open);
    jellyfinItemsSheet.inert = !open;
    jellyfinItemsSheet.setAttribute("aria-hidden", String(!open));
    if (open) {
      $("jf-items").scrollTop = 0;
      $("jf-items-close").focus({ preventScroll: true });
    } else if (restoreFocus && document.body.dataset.screen === "home") {
      jellyfinItemsOpen.focus({ preventScroll: true });
    }
    document.dispatchEvent(new Event("dompi-render"));
  }
  jellyfinItemsOpen.onclick = () => showJellyfinItems(true);
  $("jf-items-close").onclick = () => showJellyfinItems(false);
  const updateJellyfinCount = (loaded = 0, total = 0) => {
    const text = total > loaded ? `${loaded}/${total}` : String(loaded);
    $("jf-item-count").textContent = text;
    $("jf-item-sheet-count").textContent = text;
  };
  const updateJellyfinProgress = (loaded, total, complete = false) => {
    const progress = $("jf-load-progress");
    jellyfinLoadState.hidden = false;
    $("jf-load-label").textContent = complete
      ? "Elenco Jellyfin completo"
      : "Caricamento Jellyfin";
    if (Number.isFinite(total) && total >= 0) {
      progress.max = Math.max(1, total);
      progress.value = Math.min(loaded, Math.max(1, total));
      $("jf-load-count").textContent = `${loaded} di ${total}`;
    } else {
      progress.removeAttribute("value");
      $("jf-load-count").textContent = `${loaded} caricati`;
    }
    updateJellyfinCount(loaded, Number.isFinite(total) ? total : loaded);
  };
  document.addEventListener("dompi-media-chosen", () =>
    showJellyfinItems(false, false),
  );
  document.addEventListener("dompi-panelchange", () => {
    if ($("home").dataset.panel !== "nas")
      showJellyfinItems(false, false);
  });
  const radioTools = document.createElement("section");
  radioTools.className = "install-note";
  radioTools.innerHTML =
    '<h3>Radio nascoste</h3><p id="hidden-radio-count"></p><button id="restore-radios" type="button">Ripristina radio nascoste</button>';
  document.querySelector('[data-page="radio"]').append(radioTools);
  const hiddenRadios = new Set(
    (readMedia().hiddenRadios || []).filter((id) => typeof id === "string"),
  );
  function hiddenCount() {
    $("hidden-radio-count").textContent =
      `${hiddenRadios.size} stazioni escluse soltanto su questo dispositivo.`;
    $("restore-radios").disabled = !hiddenRadios.size;
  }
  function hideRadio(station) {
    if (
      !station ||
      !confirm(
        `Nascondere “${station.name}” dal tuo elenco? Potrai ripristinarla nelle Impostazioni.`,
      )
    )
      return;
    hiddenRadios.add(station.id);
    saveMedia({ hiddenRadios: [...hiddenRadios] });
    hiddenCount();
    radios();
    $("radio-failure").hidden = true;
    $("hide-failed-radio").hidden = true;
  }
  $("restore-radios").onclick = () => {
    if (confirm("Ripristinare tutte le radio nascoste nel tuo elenco?")) {
      hiddenRadios.clear();
      saveMedia({ hiddenRadios: [] });
      hiddenCount();
      radios();
    }
  };
  const failure = document.createElement("div");
  failure.id = "radio-failure";
  failure.hidden = true;
  failure.setAttribute("role", "status");
  const failureText = document.createElement("p");
  failureText.textContent =
    "Streaming non disponibile. Puoi riprovare o nascondere questa radio.";
  const hideFailure = document.createElement("button");
  hideFailure.textContent = "Nascondi questa radio";
  hideFailure.id = "hide-radio-error";
  failure.append(failureText, hideFailure);
  $("radio-list").before(failure);
  const hideInPlayer = document.createElement("button");
  hideInPlayer.id = "hide-failed-radio";
  hideInPlayer.textContent = "Nascondi radio non disponibile";
  hideInPlayer.hidden = true;
  $("player").append(hideInPlayer);
  document.addEventListener("dompi-radio-error", (event) => {
    const station = stations.find((s) => s.url === event.detail.url);
    failure.dataset.stream = event.detail.url;
    failure.hidden = false;
    hideInPlayer.hidden = !station;
    hideFailure.hidden = !station;
    hideFailure.onclick = hideInPlayer.onclick = () => hideRadio(station);
  });
  hiddenCount();
  const customLogos = new Map();
  const fallbackLogo = new URL("../assets/radio.svg", import.meta.url).href;
  const artwork = document.createElement("details");
  artwork.className = "manual-radio";
  artwork.innerHTML =
    '<summary>Logo personalizzato radio</summary><label>Radio salvata<select id="logo-station"></select></label><label class="file-picker secondary" for="logo-file">Scegli immagine (massimo 2 MB)</label><input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><button id="logo-remove">Ripristina logo del catalogo</button>';
  document.querySelector('[data-media-page="radio"]').append(artwork);
  localStore
    .all("images")
    .then((rows) => {
      for (const row of rows)
        customLogos.set(row.id, URL.createObjectURL(row.blob));
      radios();
    })
    .catch(() => {});
  $("logo-file").onchange = async () => {
    const file = $("logo-file").files[0],
      id = $("logo-station").value;
    $("logo-file").value = "";
    if (!file || !id) return;
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      notice("Scegli PNG, JPEG o WebP fino a 2 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (img.naturalWidth > 8192 || img.naturalHeight > 8192)
        throw Error("Immagine troppo grande");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const c = canvas.getContext("2d");
      const ratio = Math.min(256 / img.naturalWidth, 256 / img.naturalHeight);
      c.drawImage(
        img,
        (256 - img.naturalWidth * ratio) / 2,
        (256 - img.naturalHeight * ratio) / 2,
        img.naturalWidth * ratio,
        img.naturalHeight * ratio,
      );
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error();
      await localStore.put("images", { id, blob });
      if (customLogos.has(id)) URL.revokeObjectURL(customLogos.get(id));
      customLogos.set(id, URL.createObjectURL(blob));
      radios();
      notice("Logo salvato in questo browser.");
    } catch (e) {
      notice("Immagine non salvata: verifica formato e spazio disponibile.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  $("logo-remove").onclick = async () => {
    const id = $("logo-station").value;
    try {
      await localStore.remove("images", id);
      if (customLogos.has(id)) URL.revokeObjectURL(customLogos.get(id));
      customLogos.delete(id);
      radios();
    } catch (e) {
      notice(storageError(e));
    }
  };
  let stations = savedStations(),
    favorites = new Set(readMedia().favorites || []),
    onlyFavorites = false;
  for (const value of categories)
    $("radio-category").add(new Option(value, value));
  function radios() {
    const term = $("radio-search").value.toLocaleLowerCase("it");
    $("radio-list").replaceChildren();
    const withLogos = stations.map((s) => ({
      ...s,
      logo: customLogos.get(s.id) || s.logo || fallbackLogo,
    }));
    const selectedLogo = $("logo-station").value;
    $("logo-station").replaceChildren(
      ...stations.map((s) => new Option(s.name, s.id)),
    );
    if (stations.some((s) => s.id === selectedLogo))
      $("logo-station").value = selectedLogo;
    for (const s of withLogos) music.setStationArtwork(s.id, s.logo);
    const filtered = withLogos.filter(
      (s) =>
        !hiddenRadios.has(s.id) &&
        s.name.toLocaleLowerCase("it").includes(term) &&
        matchesCategory(s, $("radio-category").value) &&
        (!onlyFavorites || favorites.has(s.id)),
    );
    music.setRadioCatalog(withLogos.filter((s) => !hiddenRadios.has(s.id)));
    for (const s of filtered) {
      const row = document.createElement("div");
      row.className = "station-row";
      const b = document.createElement("button");
      if (s.logo) {
        const img = document.createElement("img");
        img.src = s.logo;
        img.alt = "";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => {
          img.onerror = null;
          img.src = fallbackLogo;
        };
        b.append(img);
      } else {
        const mark = document.createElement("span");
        mark.className = "station-logo";
        mark.textContent = s.name.slice(0, 2).toUpperCase();
        b.append(mark);
      }
      b.append(document.createTextNode(s.name));
      b.dataset.station = s.id;
      b.dataset.stream = s.url;
      b.setAttribute(
        "aria-current",
        String(
          music.getState().source === "radio" &&
            music.getState().radioURL === s.url,
        ),
      );
      b.onclick = () => {
        failure.hidden = true;
        hideInPlayer.hidden = true;
        music.station(s, filtered);
        document.dispatchEvent(new Event("dompi-media-chosen"));
      };
      const star = document.createElement("button");
      star.textContent = favorites.has(s.id) ? "♥" : "♡";
      star.setAttribute("aria-label", `Preferita: ${s.name}`);
      star.setAttribute("aria-pressed", String(favorites.has(s.id)));
      star.onclick = () => {
        favorites.has(s.id) ? favorites.delete(s.id) : favorites.add(s.id);
        saveMedia({ favorites: [...favorites] });
        radios();
      };
      const hide = document.createElement("button");
      hide.textContent = "×";
      hide.setAttribute("aria-label", `Nascondi ${s.name}`);
      hide.onclick = () => hideRadio(s);
      row.append(b, star, hide);
      $("radio-list").append(row);
    }
    if (!filtered.length)
      $("radio-list").textContent = "Nessuna radio in questa selezione.";
  }
  document.addEventListener("dompi-selection", (event) => {
    if (
      event.detail.source !== "radio" ||
      event.detail.radioURL !== failure.dataset.stream
    ) {
      failure.hidden = true;
      hideInPlayer.hidden = true;
    }
    document
      .querySelectorAll("[data-station]")
      .forEach((button) =>
        button.setAttribute(
          "aria-current",
          String(
            event.detail.source === "radio" &&
              button.dataset.stream === event.detail.radioURL,
          ),
        ),
      );
    document
      .querySelectorAll("[data-jellyfin-id]")
      .forEach((button) =>
        button.setAttribute(
          "aria-current",
          String(
            event.detail.source === "nas" &&
              button.dataset.jellyfinId === event.detail.id,
          ),
        ),
      );
  });
  $("radio-search").oninput = radios;
  $("radio-category").onchange = radios;
  $("radio-favorites").onclick = () => {
    onlyFavorites = !onlyFavorites;
    $("radio-favorites").setAttribute("aria-pressed", String(onlyFavorites));
    radios();
  };
  let loadingRadio = false, lastRadioAttempt = 0;
  async function loadRadioCatalog() {
    const cached = readMedia();
    if (loadingRadio || (cached.catalog?.length >= 100 && Date.now() - Date.parse(cached.catalogDate) < 86400000) || Date.now() - lastRadioAttempt < 60000) return;
    loadingRadio = true; lastRadioAttempt = Date.now();
    $("radio-status").textContent = "Caricamento automatico delle radio italiane…";
    try {
      await discoverRadio();
      stations = savedStations(); radios();
      $("radio-status").textContent = `${stations.length} radio disponibili · catalogo aggiornato automaticamente.`;
    } catch (e) { $("radio-status").textContent = e.message; }
    finally { loadingRadio = false; }
  }
  loadRadioCatalog();
  window.addEventListener("online", loadRadioCatalog);
  $("manual-radio").onsubmit = (e) => {
    e.preventDefault();
    const url = safeStream($("manual-url").value);
    if (!url) {
      notice("Serve un flusso HTTPS valido, non la pagina del sito.");
      return;
    }
    const station = {
      id: crypto.randomUUID(),
      name: $("manual-name").value.trim(),
      url,
      tags: "manuale",
    };
    const manual = [...(readMedia().manual || []), station].slice(-100);
    saveMedia({ manual });
    stations = savedStations();
    radios();
    $("manual-radio").reset();
  };
  radios();
  const diagnostics = document.createElement("p");
  diagnostics.id = "jf-diagnostic";
  diagnostics.className = "connection-diagnostic";
  diagnostics.setAttribute("role", "status");
  $("jf-status").after(diagnostics);
  const streamCheck = document.createElement("button");
  streamCheck.id = "jf-stream-check";
  streamCheck.type = "button";
  streamCheck.textContent = "Verifica CORS del brano selezionato";
  diagnostics.after(streamCheck);
  streamCheck.onclick = async () => {
    streamCheck.disabled = true;
    diagnostics.textContent = "Verifica stream con richiesta Range di 2 byte…";
    try { diagnostics.textContent = await music.diagnoseStream(); }
    finally { streamCheck.disabled = false; }
  };
  document.addEventListener("dompi-stream-error", ({ detail }) => {
    $("jf-status").textContent = detail.message;
    diagnostics.textContent = `Fase: riproduzione audio · ${detail.code}. Il browser non espone lo stato HTTP dello stream; nessun token mostrato.`;
  });
  document.addEventListener("dompi-stream-analysis", ({ detail }) => {
    diagnostics.textContent = detail;
  });
  const jf = createJellyfin(fetch, (entry) => {
    diagnostics.textContent = `Fase: ${entry.stage} · ${entry.method} ${entry.endpoint} · HTTP: ${entry.status ?? "non disponibile"} · Tipo: ${entry.code} · Risposta: ${entry.responseType}`;
  });
  const globalPanel = document.createElement("section");
  globalPanel.id = "jf-global-shuffle";
  globalPanel.className = "jellyfin-global-shuffle";
  globalPanel.innerHTML = `
    <button id="jf-global-start" type="button">🎲 Casuale tutta la libreria</button>
    <p id="jf-global-status" role="status">Casuale globale pronto.</p>
    <progress id="jf-global-progress" max="1" value="0" hidden></progress>
    <details id="jf-global-diagnostics">
      <summary>Diagnostica casuale globale</summary>
      <dl>
        <div><dt>Totale brani</dt><dd id="jf-global-total">—</dd></div>
        <div><dt>Identificativi indicizzati</dt><dd id="jf-global-indexed">0</dd></div>
        <div><dt>Posizione sessione</dt><dd id="jf-global-position">—</dd></div>
        <div><dt>Brani preparati</dt><dd id="jf-global-prepared">0</dd></div>
        <div><dt>Rifornimento</dt><dd id="jf-global-refill">Inattivo</dd></div>
        <div><dt>Ultimo errore API</dt><dd id="jf-global-error">Nessuno</dd></div>
      </dl>
    </details>`;
  $("jf-search-form").before(globalPanel);
  const jellyfinPageSize = 500;
  const jellyfinRenderBatch = 120;
  const jellyfinQueueWindow = 400;
  let resultItems = [],
    jfGeneration = 0,
    searchRevision = 0,
    searchTotal = 0,
    searchNext = 0,
    searchLoadingRevision = 0,
    activeSearchFilter = null,
    renderedItems = 0;
  let globalSession = null,
    globalRevision = 0,
    globalIndexController = null,
    globalRefillPromise = null,
    globalRetryTimer = 0;
  const globalText = (id, value) => {
    $(id).textContent = String(value);
  };
  const globalState = (state, message) => {
    globalPanel.dataset.state = state;
    globalText("jf-global-status", message);
  };
  const globalCacheId = (parent = "") => {
    const session = jf.session();
    if (!session) return "";
    return `jellyfin-global-index:${encodeURIComponent(session.server)}:${encodeURIComponent(session.user)}:${encodeURIComponent(parent || "all")}`;
  };
  function stopGlobalShuffle(message = "Casuale globale interrotto.") {
    globalRevision++;
    globalIndexController?.abort();
    globalSession?.controller?.abort();
    globalIndexController = null;
    clearTimeout(globalRetryTimer);
    globalRetryTimer = 0;
    globalRefillPromise = null;
    if (globalSession) globalSession.active = false;
    globalSession = null;
    globalState("idle", message);
    globalText("jf-global-refill", "Inattivo");
  }
  async function loadGlobalIndex(parent, revision, signal) {
    const info = await jf.catalogInfo(parent, { signal });
    if (revision !== globalRevision) throw new DOMException("Operazione annullata", "AbortError");
    globalText("jf-global-total", info.total.toLocaleString("it-IT"));
    const cacheId = globalCacheId(parent);
    let cached = null;
    try {
      cached = cacheId ? await localStore.get("meta", cacheId) : null;
    } catch {
      // IndexedDB is an optimization: playback can continue without it.
    }
    if (
      cached?.signature === info.signature &&
      cached?.total === info.total &&
      Array.isArray(cached.ids) &&
      cached.ids.length === info.total
    ) {
      globalText("jf-global-indexed", cached.ids.length.toLocaleString("it-IT"));
      $("jf-global-progress").hidden = true;
      return { ids: cached.ids, info, cacheId, cached: true };
    }
    const progress = $("jf-global-progress");
    progress.hidden = false;
    progress.max = Math.max(1, info.total);
    progress.value = 0;
    const ids = await buildJellyfinIndex({
      total: info.total,
      pageSize: jellyfinGlobalDefaults.pageSize,
      signal,
      fetchPage: (start, limit, requestSignal) =>
        jf.catalogPage(parent, start, limit, { signal: requestSignal }),
      onProgress(loaded, total) {
        if (revision !== globalRevision) return;
        progress.value = loaded;
        globalText("jf-global-indexed", loaded.toLocaleString("it-IT"));
        globalState(
          "indexing",
          `Preparazione indice leggero: ${loaded.toLocaleString("it-IT")} di ${total.toLocaleString("it-IT")} brani…`,
        );
      },
    });
    const verified = await jf.catalogInfo(parent, { signal });
    if (verified.signature !== info.signature || verified.total !== ids.length)
      throw Error("La libreria Jellyfin è cambiata durante l’indicizzazione. Premi di nuovo Casuale tutta la libreria.");
    progress.hidden = true;
    if (cacheId) {
      localStore
        .put("meta", {
          id: cacheId,
          signature: verified.signature,
          total: verified.total,
          ids,
          updatedAt: new Date().toISOString(),
        })
        .catch(() => {
          globalText("jf-global-error", "Indice pronto, ma cache locale non disponibile.");
        });
    }
    return { ids, info: verified, cacheId, cached: false };
  }
  async function materializeGlobal(count, revision) {
    if (!globalSession?.active || revision !== globalRevision) return [];
    const sequence = globalSession.sequence;
    const before = sequence.snapshot();
    const tracks = [];
    let attempts = 0;
    try {
      while (tracks.length < count && attempts < 6) {
        attempts++;
        const descriptors = sequence.take(count - tracks.length);
        const items = await jf.restore(
          descriptors.map(({ id }) => id),
          { signal: globalSession.controller.signal },
        );
        if (!globalSession?.active || revision !== globalRevision) return [];
        const byId = new Map(items.map((item) => [item.Id, item]));
        for (const descriptor of descriptors) {
          const item = byId.get(descriptor.id);
          if (!item) continue;
          tracks.push({
            ...jf.track(item),
            sessionPosition: descriptor.position,
            sessionTotal: descriptor.total,
            sessionCycle: descriptor.cycle,
          });
        }
      }
      return tracks;
    } catch (error) {
      if (globalSession?.active && revision === globalRevision)
        globalSession.sequence = new JellyfinGlobalSequence(globalSession.ids, before);
      throw error;
    }
  }
  function updateGlobalDiagnostics(detail = music.getState()) {
    if (!globalSession?.active) return;
    const position = detail.sessionPosition || music.getState().sessionPosition;
    const total = detail.sessionTotal || globalSession.total;
    globalText(
      "jf-global-position",
      position ? `${position.toLocaleString("it-IT")} di ${total.toLocaleString("it-IT")}` : "Preparazione",
    );
    const state = music.getState();
    globalText("jf-global-prepared", state.remaining.toLocaleString("it-IT"));
    globalState(
      "playing",
      `Casuale globale — ${globalSession.total.toLocaleString("it-IT")} brani`,
    );
  }
  function scheduleGlobalRefill() {
    if (!globalSession?.active || globalRefillPromise) return;
    const state = music.getState();
    if (
      state.source !== "nas" ||
      !needsJellyfinRefill(
        state.index,
        state.tracks.length,
        jellyfinGlobalDefaults.refillThreshold,
      )
    )
      return;
    const revision = globalRevision;
    globalText("jf-global-refill", "In corso…");
    let refill;
    refill = materializeGlobal(
      jellyfinGlobalDefaults.refillSize,
      revision,
    )
      .then((tracks) => {
        if (!tracks.length || !globalSession?.active || revision !== globalRevision) return;
        const stateAfter = music.appendRemoteWindow(
          tracks,
          jellyfinGlobalDefaults.historySize,
        );
        globalText("jf-global-prepared", Math.max(0, stateAfter.tracks.length - stateAfter.index - 1).toLocaleString("it-IT"));
        globalText("jf-global-refill", `${tracks.length} brani aggiunti`);
        globalText("jf-global-error", "Nessuno");
      })
      .catch((error) => {
        if (!globalSession?.active || revision !== globalRevision) return;
        globalText("jf-global-refill", "Nuovo tentativo in attesa");
        globalText("jf-global-error", connectionError(error));
        clearTimeout(globalRetryTimer);
        globalRetryTimer = setTimeout(() => {
          globalRetryTimer = 0;
          scheduleGlobalRefill();
        }, 5000);
      })
      .finally(() => {
        if (globalRefillPromise === refill) globalRefillPromise = null;
      });
    globalRefillPromise = refill;
  }
  $("jf-global-start").onclick = async () => {
    if (!jf.session()) {
      globalState("error", "Collega prima Jellyfin.");
      return;
    }
    stopGlobalShuffle("Preparazione casuale globale…");
    const revision = globalRevision;
    const parent = $("jf-library").value;
    const controller = new AbortController();
    globalIndexController = controller;
    $("jf-global-start").disabled = true;
    globalText("jf-global-error", "Nessuno");
    globalText("jf-global-position", "Preparazione");
    globalText("jf-global-prepared", "0");
    globalText("jf-global-refill", "Preparazione");
    globalState("indexing", "Verifica della libreria Jellyfin…");
    try {
      const indexed = await loadGlobalIndex(parent, revision, controller.signal);
      if (revision !== globalRevision) return;
      if (!indexed.ids.length) throw Error("La libreria Jellyfin non contiene brani accessibili.");
      globalSession = {
        active: true,
        ids: indexed.ids,
        total: indexed.ids.length,
        signature: indexed.info.signature,
        sequence: new JellyfinGlobalSequence(indexed.ids, { seed: randomSeed() }),
        controller,
      };
      globalText("jf-global-indexed", indexed.ids.length.toLocaleString("it-IT"));
      globalState(
        "preparing",
        `Preparazione dei primi ${jellyfinGlobalDefaults.initialSize} brani casuali…`,
      );
      const initial = await materializeGlobal(
        jellyfinGlobalDefaults.initialSize,
        revision,
      );
      if (!globalSession?.active || revision !== globalRevision) return;
      if (!initial.length) throw Error("Jellyfin non ha restituito metadati riproducibili.");
      music.modes(false, $("repeat").value);
      music.queue(initial, 0, false, true);
      document.dispatchEvent(new Event("dompi-media-chosen"));
      globalText("jf-global-prepared", String(initial.length - 1));
      globalText("jf-global-refill", "Pronto");
      updateGlobalDiagnostics();
    } catch (error) {
      if (revision !== globalRevision) return;
      const message = connectionError(error);
      stopGlobalShuffle(`Casuale globale non avviato: ${message}`);
      globalPanel.dataset.state = "error";
      globalText("jf-global-error", message);
    } finally {
      if (globalIndexController === controller) globalIndexController = null;
      $("jf-global-start").disabled = false;
    }
  };
  document.addEventListener("dompi-selection", ({ detail }) => {
    if (!globalSession?.active || detail.source !== "nas") return;
    updateGlobalDiagnostics(detail);
    scheduleGlobalRefill();
  });
  document.addEventListener("dompi-remote-queue-edited", () => {
    if (globalSession?.active)
      stopGlobalShuffle("Casuale globale interrotto: coda Jellyfin modificata manualmente.");
  });
  const connectionError = (e) =>
    e instanceof TypeError
      ? "Connessione bloccata o non raggiungibile. Verifica HTTPS, certificato e CORS sul server Jellyfin."
      : e.message;
  $("jf-diagnose").onclick = async () => {
    try {
      const info = await jf.diagnose($("jf-server").value);
      $("jf-status").textContent =
        `API pubblica e richiesta con header accessibili: ${info.ServerName || "Jellyfin"}. Il POST di login va ancora verificato con l’accesso.`;
    } catch (e) {
      $("jf-status").textContent = connectionError(e);
    }
  };
  $("jf-server").value = readMedia().jellyfinServer || "";
  $("jf-server").addEventListener("change", () => {
    const value = $("jf-server").value.trim();
    if (!value || safeStream(value)) {
      saveMedia({ jellyfinServer: value });
      localStore.remove("meta", "jellyfin-session").catch(() => {});
    }
  });
  async function showConnected(result, generation) {
    if (generation !== jfGeneration) return;
    $("jf-library").replaceChildren(new Option("Tutta la musica", ""));
    for (const item of result.Items || [])
      if (["music", "playlists"].includes(item.CollectionType)) $("jf-library").add(new Option(item.Name, item.Id));
    $("jellyfin-login").hidden = true;
    $("jf-browser").hidden = false;
    $("jf-status").textContent = "Connesso · Disconnetti elimina anche la sessione salvata.";
    await search(true);
    const savedQueue = readMedia().jellyfinQueue;
    if (savedQueue?.ids?.length) {
      const items = await jf.restore(savedQueue.ids);
      if (generation === jfGeneration && items.length) music.queue(items.map(jf.track), savedQueue.index || 0, true, false);
    }
  }
  async function restoreSession() {
    const generation = jfGeneration;
    const form = $("jellyfin-login");
    form.inert = true;
    try {
      const saved = await localStore.get("meta", "jellyfin-session");
      if (!saved || generation !== jfGeneration) return;
      $("jf-server").value = saved.server;
      $("jf-status").textContent = "Ripristino collegamento Jellyfin…";
      const result = await jf.resume(saved);
      await showConnected(result, generation);
    } catch (error) {
      jf.disconnect();
      $("jellyfin-login").hidden = false;
      $("jf-browser").hidden = true;
      if ([401, 403].includes(error.status)) await localStore.remove("meta", "jellyfin-session").catch(() => {});
      $("jf-status").textContent = "Collegamento non ripristinato: server non disponibile o sessione scaduta. Riapri online o accedi nuovamente.";
    } finally { form.inert = false; }
  }
  $("jellyfin-login").onsubmit = async (e) => {
    e.preventDefault();
    const generation = ++jfGeneration;
    const password = $("jf-password").value;
    const username = $("jf-user").value;
    const server = $("jf-server").value;
    $("jf-status").textContent =
      "Verifica API pubblica e login… Password rimossa dal campo per sicurezza.";
    const submit = $("jellyfin-login").querySelector(
      'button:not([type="button"])',
    );
    submit.disabled = true;
    try {
      const request = jf.connect(server, username, password);
      // connect serializes Username/Pw synchronously before its first await.
      $("jf-password").value = "";
      const result = await request;
      saveMedia({ jellyfinServer: server.trim() });
      if (generation !== jfGeneration) return;
      if ($("jf-remember").checked) {
        try { await localStore.put("meta", { id: "jellyfin-session", ...jf.session() }); }
        catch { notice("Collegato, ma il browser non ha consentito di ricordare la sessione."); }
      } else await localStore.remove("meta", "jellyfin-session");
      await showConnected(result, generation);
    } catch (e) {
      if (generation === jfGeneration)
        $("jf-status").textContent =
          connectionError(e) +
          " La password è stata rimossa dal campo per sicurezza; il nome utente è conservato.";
    } finally {
      $("jf-password").value = "";
      submit.disabled = false;
    }
  };
  async function search(reset = true) {
    const revision = reset ? ++searchRevision : searchRevision;
    if (!reset && searchLoadingRevision === revision) return;
    const generation = jfGeneration;
    if (reset) {
      activeSearchFilter = currentFilter();
      resultItems = [];
      searchTotal = 0;
      searchNext = 0;
      renderedItems = 0;
      $("jf-items").replaceChildren();
      $("jf-back").hidden = true;
      updateJellyfinProgress(0, NaN);
    }
    const filter = activeSearchFilter || currentFilter();
    const valid = () =>
      generation === jfGeneration &&
      revision === searchRevision &&
      JSON.stringify(filter) === JSON.stringify(activeSearchFilter);
    searchLoadingRevision = revision;
    try {
      const result = await jf.search(
        filter.parent,
        filter.term,
        filter.type,
        searchNext,
        jellyfinPageSize,
      );
      if (!valid()) return;
      const rawBatch = result.Items || [];
      const seen = new Set(resultItems.map((item) => item.PlaylistItemId || item.Id));
      const batch = rawBatch.filter((item) => {
        const id = item.PlaylistItemId || item.Id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      resultItems.push(...batch);
      searchNext += rawBatch.length;
      searchTotal = Number.isFinite(Number(result.TotalRecordCount))
        ? Number(result.TotalRecordCount)
        : resultItems.length;
      if (rawBatch.length && !batch.length && searchNext < searchTotal)
        throw Error("Jellyfin ha ripetuto la stessa pagina: caricamento fermato.");
      renderItems(reset);
      const complete =
        !rawBatch.length || searchNext >= searchTotal;
      updateJellyfinProgress(resultItems.length, searchTotal, complete);
      $("jf-more").hidden = true;
      $("jf-status").textContent = complete
        ? `${resultItems.length} risultati disponibili · elenco completo`
        : `${resultItems.length} di ${searchTotal} risultati disponibili · scorri per continuare`;
    } catch (e) {
      if (valid()) {
        $("jf-load-label").textContent = "Caricamento interrotto";
        $("jf-status").textContent = connectionError(e);
      }
    } finally {
      if (searchLoadingRevision === revision) searchLoadingRevision = 0;
    }
  }
  let collectionRevision = 0;
  document.addEventListener("dompi-source-change", () => {
    collectionRevision++;
    $("shuffle").disabled = false;
    if (
      (globalSession?.active || globalIndexController) &&
      music.getState().source !== "nas"
    )
      stopGlobalShuffle("Casuale globale interrotto: sorgente cambiata.");
  });
  const currentFilter = () => ({
    parent: $("jf-library").value,
    term: $("jf-search").value,
    type: $("jf-type").value,
  });
  async function playItem(item, append = false, random = false) {
    if (globalSession?.active || globalIndexController)
      stopGlobalShuffle("Casuale globale interrotto: selezione Jellyfin manuale.");
    const revision = ++collectionRevision,
      generation = jfGeneration,
      filter = currentFilter();
    const valid = () =>
      revision === collectionRevision &&
      generation === jfGeneration &&
      JSON.stringify(filter) === JSON.stringify(currentFilter());
    $("jf-status").textContent = "Raccolta dei brani della selezione…";
    $("shuffle").disabled = true;
    try {
      // Preserve Safari's user activation: no fetch/await before a title starts.
      if (item?.Type === "Audio" && !append) {
        const loaded = resultItems.filter((entry) => entry.Type === "Audio");
        const selected = Math.max(
          0,
          loaded.findIndex((entry) => entry.Id === item.Id),
        );
        const windowStart = Math.max(
          0,
          Math.min(
            selected - Math.floor(jellyfinQueueWindow / 4),
            loaded.length - jellyfinQueueWindow,
          ),
        );
        const playable = (loaded.length ? loaded : [item]).slice(
          windowStart,
          windowStart + jellyfinQueueWindow,
        );
        music.queue(playable.map(jf.track), selected - windowStart);
        $("jf-status").textContent =
          `Brano selezionato · ${playable.length} brani vicini nella coda. L’elenco completo resta disponibile scorrendo.`;
        document.dispatchEvent(new Event("dompi-media-chosen"));
        return;
      }
      // Collections are fetched before preparing their queue.
      const tracks = await jellyfinTracks(
        jf,
        filter,
        !append && item?.Type === "Audio" ? null : item,
        valid,
      );
      if (!valid()) return;
      if (!tracks.length) {
        $("jf-status").textContent = "Nessun brano in questa selezione.";
        return;
      }
      let start =
        item?.Type === "Audio" && !append
          ? Math.max(
              0,
              tracks.findIndex((t) => t.Id === item.Id),
            )
          : 0;
      if (random) {
        start = Math.floor(Math.random() * tracks.length);
        music.modes(true, $("repeat").value);
      }
      music.queue(tracks.map(jf.track), start, append);
      if (!append) document.dispatchEvent(new Event("dompi-media-chosen"));
      $("jf-status").textContent =
        `${tracks.length} brani ${append ? "aggiunti alla coda senza interrompere l’ascolto" : "nella coda di riproduzione"}.`;
    } catch (e) {
      if (revision === collectionRevision)
        $("jf-status").textContent = connectionError(e);
    } finally {
      $("shuffle").disabled = false;
    }
  }
  function appendJellyfinItems() {
    if (renderedItems >= resultItems.length) return;
    const end = Math.min(
      resultItems.length,
      renderedItems + jellyfinRenderBatch,
    );
    const fragment = document.createDocumentFragment();
    for (const item of resultItems.slice(renderedItems, end)) {
      const row = document.createElement("div");
      row.className = "station-row";
      const b = document.createElement("button");
      b.textContent = item.Name + (item.Album ? " · " + item.Album : "");
      b.dataset.jellyfinId = item.Id;
      b.setAttribute(
        "aria-current",
        String(
          music.getState().source === "nas" && music.getState().id === item.Id,
        ),
      );
      b.onclick = async () => {
        if (item.Type === "Audio") return playItem(item);
        const revision = ++searchRevision, generation = jfGeneration;
        $("jf-status").textContent = "Caricamento brani della raccolta…";
        try {
          const items = await jellyfinTracks(jf, currentFilter(), item, () => revision === searchRevision && generation === jfGeneration);
          if (revision !== searchRevision || generation !== jfGeneration) return;
          resultItems = items;
          searchTotal = items.length;
          searchNext = items.length;
          renderedItems = 0;
          renderItems(true);
          updateJellyfinProgress(items.length, items.length, true);
          $("jf-back").hidden = false; $("jf-more").hidden = true;
          $("jf-status").textContent = `${item.Name}: ${items.length} brani. Tocca un titolo per ascoltare.`;
        } catch (e) { if (revision === searchRevision) $("jf-status").textContent = connectionError(e); }
      };
      const add = document.createElement("button");
      add.textContent = "＋";
      add.setAttribute("aria-label", `Aggiungi alla coda: ${item.Name}`);
      add.onclick = () => playItem(item, true);
      row.append(b, add);
      fragment.append(row);
    }
    $("jf-items").append(fragment);
    renderedItems = end;
    $("jf-items").dataset.rendered = String(renderedItems);
  }
  function renderItems(reset = true) {
    if (reset) {
      renderedItems = 0;
      $("jf-items").replaceChildren();
    }
    appendJellyfinItems();
  }
  $("jf-items").addEventListener("scroll", () => {
    const list = $("jf-items");
    if (list.scrollTop + list.clientHeight < list.scrollHeight - 120) return;
    if (renderedItems < resultItems.length) appendJellyfinItems();
    else if (searchNext < searchTotal) search(false);
  });
  $("jf-search-form").onsubmit = (e) => {
    e.preventDefault();
    search(true);
  };
  $("jf-more").onclick = () => search(false);
  $("jf-back").onclick = () => search(true);
  $("jf-type").onchange = $("jf-library").onchange = () => search(true);
  $("jf-logout").onclick = async () => {
    stopGlobalShuffle("Casuale globale non disponibile: Jellyfin disconnesso.");
    collectionRevision++;
    $("shuffle").disabled = false;
    jfGeneration++;
    music.clearRemote();
    jf.disconnect();
    resultItems = [];
    searchTotal = 0;
    searchNext = 0;
    renderedItems = 0;
    updateJellyfinCount(0, 0);
    $("jf-items").replaceChildren();
    jellyfinLoadState.hidden = true;
    showJellyfinItems(false, false);
    $("jf-browser").hidden = true;
    $("jellyfin-login").hidden = false;
    $("jf-status").textContent =
      "Disconnesso. Rimozione sessione salvata…";
    try {
      await localStore.remove("meta", "jellyfin-session");
      $("jf-status").textContent = "Disconnesso. Sessione salvata rimossa da questo dispositivo.";
    } catch {
      $("jf-status").textContent = "Disconnesso, ma non è stato possibile eliminare la sessione salvata. Ricollegati e riprova Disconnetti.";
    }
  };
  restoreSession();
}
