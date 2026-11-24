// Intentionally not precached: reachable even from the old cache-first application.
const base = new URL("../", import.meta.url);
const check = document.getElementById("recovery-check"),
  apply = document.getElementById("recovery-apply"),
  status = document.getElementById("recovery-status");
let registration,
  activating = false;
function refresh() {
  apply.hidden = !registration?.waiting;
  if (registration?.waiting)
    status.textContent =
      "Nuova versione pronta. Premi Attiva aggiornamento per ricaricare Dompi.";
}
function observe(worker) {
  worker?.addEventListener("statechange", () => {
    if (worker.state === "installed") refresh();
    if (worker.state === "redundant")
      status.textContent =
        "Installazione non riuscita. Verifica la pubblicazione completa dei file e riprova.";
  });
}
check.addEventListener("click", async () => {
  if (
    !("serviceWorker" in navigator) ||
    !isSecureContext ||
    base.pathname === "/"
  ) {
    status.textContent =
      "Apri questa pagina in HTTPS su Safari o un browser compatibile.";
    return;
  }
  check.disabled = true;
  status.textContent = "Controllo e download…";
  try {
    registration = await navigator.serviceWorker.register(
      new URL("service-worker.js", base),
      { scope: base.href, updateViaCache: "none" },
    );
    if (registration.scope !== base.href) throw new Error("Unexpected scope");
    registration.addEventListener("updatefound", () =>
      observe(registration.installing),
    );
    observe(registration.installing);
    await registration.update();
    refresh();
    if (!registration.waiting && !registration.installing) {
      let serverVersion = "non leggibile";
      try {
        const response = await fetch(
          new URL("service-worker.js?verifica=" + Date.now(), base),
          { cache: "no-store" },
        );
        if (response.ok)
          serverVersion =
            (await response.text()).match(
              /const VERSION\s*=\s*["']([^"']+)/,
            )?.[1] || serverVersion;
      } catch {}
      status.textContent = `Nessun worker in attesa. Versione pubblicata dal server: ${serverVersion}. Se è precedente allo ZIP caricato, verifica la cartella e la sovrascrittura su Aruba. Se è corretta, chiudi tutte le finestre Dompi e riapri, oppure usa Ripara cache.`;
    }
  } catch {
    status.textContent =
      "Controllo fallito. Verifica Internet, HTTPS e i file pubblicati nella cartella di Dompi.";
  } finally {
    check.disabled = false;
  }
});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (activating) location.replace(base.href);
  });
apply.addEventListener("click", () => {
  if (!registration?.waiting) return;
  activating = true;
  apply.disabled = true;
  status.textContent = "Attivazione della versione scaricata…";
  registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
  setTimeout(() => {
    if (activating) {
      apply.disabled = false;
      status.textContent =
        "Se il worker precedente non supporta il comando, chiudi tutte le finestre Dompi (inclusa questa), poi riapri Dompi. Non cancellare i dati dell’intero dominio.";
    }
  }, 15000);
});

// Last-resort repair, strictly limited to this app scope. Never clear origin storage.
document
  .getElementById("recovery-repair")
  .addEventListener("click", async () => {
    if (base.pathname === "/") { status.textContent = "Apri il recupero nella sottocartella Dompi, non nella root del dominio."; return; }
    if (
      !confirm(
        "Hai chiuso le altre finestre Dompi? Riparare la cache di questa cartella mantenendo le preferenze?",
      )
    )
      return;
    try {
      const response = await fetch(
        new URL("index.html?recovery=" + Date.now(), base),
        { cache: "no-store" },
      );
      if (
        !response.ok ||
        !(await response.text()).includes('name="dompi-version"')
      )
        throw Error("Server non disponibile");
      const current = await navigator.serviceWorker.getRegistration(base.href);
      if (current?.scope === base.href) await current.unregister();
      const prefix = `dompi-shell:${base.href}:`;
      for (const key of await caches.keys())
        if (key.startsWith(prefix)) await caches.delete(key);
      status.textContent =
        "Cache di questa cartella riparata. Chiudi anche questa finestra e riapri Dompi online. Preferenze conservate.";
    } catch {
      status.textContent =
        "Riparazione non completata. Verifica HTTPS, connessione e pubblicazione completa; nessun dato personale è stato cancellato.";
    }
  });
