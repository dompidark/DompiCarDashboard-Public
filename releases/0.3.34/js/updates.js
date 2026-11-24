// Update controls are isolated from GPS, music and preference storage.
const base = new URL("./", document.baseURI);
const $ = (id) => document.getElementById(id);
const pageVersion = document.querySelector(
  'meta[name="dompi-version"]',
).content;
let registration,
  checking = false,
  activating = false,
  reloaded = false,
  lastCheck = 0,
  initializing = null,
  installationFailed = false;
const controlledAtLoad = Boolean(navigator.serviceWorker?.controller);
function message(text) {
  $("update-status").textContent = text;
}
function versionOf(worker) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (value) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 2000);
    channel.port1.onmessage = (event) =>
      finish(
        typeof event.data?.version === "string" ? event.data.version : null,
      );
    try {
      worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}
let reloadPending = false;
let waitingRevision = 0;
let readyWorker = null;
async function showWaiting(
  fallback = "Nessun nuovo aggiornamento disponibile.",
) {
  if (reloadPending) return;
  const revision = ++waitingRevision;
  const worker = registration?.waiting;
  const version = worker ? await versionOf(worker) : null;
  if (revision !== waitingRevision) return;
  // MessageChannel replies can arrive after activation/replacement of the candidate.
  if (worker !== registration?.waiting) return showWaiting(fallback);
  const installed = pageVersion;
  readyWorker =
    worker?.state === "installed" && version && version !== installed
      ? worker
      : null;
  $("apply-update").hidden = !readyWorker;
  $("update-notice").hidden = !readyWorker;
  $("update-notice").firstChild.textContent = readyWorker
    ? `Installata ${installed} · disponibile ${version}. `
    : "";
  if (!activating)
    message(
      readyWorker
        ? `Nuova versione ${version} pronta. Installata: ${installed}.`
        : fallback,
    );
}
const observedWorkers = new WeakSet();
function observe(worker) {
  if (!worker || observedWorkers.has(worker)) return;
  observedWorkers.add(worker);
  worker.addEventListener("statechange", () => {
    if (worker.state === "redundant") installationFailed = true;
    showWaiting(
      worker.state === "redundant"
        ? "Aggiornamento non installato. La versione attuale resta disponibile; riprova più tardi."
        : worker.state === "installing"
          ? "Download in corso. Attendi il completamento."
          : "Nessun nuovo aggiornamento disponibile.",
    );
  });
}
function waitForInstall(worker) {
  if (!worker || ["installed", "activated", "redundant"].includes(worker.state))
    return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", check);
      resolve();
    };
    const check = () => {
      if (["installed", "activated", "redundant"].includes(worker.state))
        finish();
    };
    const timer = setTimeout(finish, 25000);
    worker.addEventListener("statechange", check);
  });
}
async function installedVersion() {
  $("installed-version").textContent = pageVersion;
}
async function checkUpdates() {
  if (checking || activating) return;
  if (!registration) {
    await initialize();
    return;
  }
  if (!navigator.onLine) {
    await showWaiting(
      "Controllo non riuscito: dispositivo offline. Riprova quando torna la connessione.",
    );
    return;
  }
  installationFailed = false;
  checking = true;
  lastCheck = Date.now();
  $("check-updates").disabled = true;
  message("Controllo aggiornamenti…");
  try {
    await registration.update();
    const installing = registration.installing;
    await waitForInstall(installing);
    await showWaiting(
      installationFailed || installing?.state === "redundant"
        ? "Aggiornamento non installato. La versione attuale resta disponibile; riprova più tardi."
        : registration.installing
          ? "Download in corso. Attendi il completamento."
          : "Nessun nuovo aggiornamento disponibile.",
    );
  } catch {
    await showWaiting(
      "Controllo non riuscito. Verifica la connessione e riprova.",
    );
  } finally {
    checking = false;
    $("check-updates").disabled = false;
  }
}
$("installed-version").textContent = pageVersion;
$("check-updates").addEventListener("click", checkUpdates);
$("apply-update").addEventListener("click", () => {
  if (reloadPending) {
    if (
      document.body.dataset.audioActive !== "true" ||
      confirm("Interrompere la musica e caricare la nuova versione?")
    )
      location.reload();
    return;
  }
  const worker = registration?.waiting;
  if (
    !worker ||
    worker !== readyWorker ||
    worker.state !== "installed" ||
    activating
  )
    return;
  if (
    document.body.dataset.audioActive === "true" &&
    !confirm("La musica è in riproduzione. Interromperla e aggiornare ora?")
  )
    return;
  activating = true;
  $("apply-update").disabled = true;
  message("Attivazione e ricaricamento… Le preferenze saranno mantenute.");
  worker.postMessage({ type: "ACTIVATE_UPDATE" });
  setTimeout(() => {
    if (!reloaded) {
      activating = false;
      $("apply-update").disabled = false;
      message(
        "Attivazione non completata. Riprova o chiudi tutte le finestre Dompi e riapri.",
      );
    }
  }, 15000);
});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // First installation doesn't reload. An activated update reloads each controlled tab once.
    if ((controlledAtLoad || activating) && !reloaded) {
      if (!activating && document.body.dataset.audioActive === "true") {
        reloadPending = true;
        $("apply-update").hidden = false;
        $("update-notice").hidden = false;
        versionOf(navigator.serviceWorker.controller).then((version) => {
          message(
            `Installata nell’interfaccia ${pageVersion}; pronta ${version || "nuova versione"}. La musica continua: premi Aggiorna ora quando vuoi.`,
          );
          $("update-notice").firstChild.textContent =
            `Installata ${pageVersion} · disponibile ${version || "nuova versione"}. `;
        });
      } else {
        reloaded = true;
        location.reload();
      }
    } else {
      installedVersion().then(() => showWaiting());
    }
  });
async function initialize() {
  if (initializing) return initializing;
  if (
    !("serviceWorker" in navigator) ||
    !isSecureContext ||
    base.pathname === "/"
  ) {
    $("check-updates").disabled = true;
    message(
      "Aggiornamenti PWA disponibili con HTTPS in una sottocartella dedicata, per esempio /car-test/.",
    );
    return;
  }
  initializing = (async () => {
    $("check-updates").disabled = true;
    try {
      try {
        registration = await navigator.serviceWorker.register(
          new URL("service-worker.js", base),
          { scope: base.href, updateViaCache: "none" },
        );
      } catch (error) {
        // Registration can fail offline even though a working controller is already installed.
        const existing = await navigator.serviceWorker.getRegistration(
          base.href,
        );
        if (existing?.scope !== base.href) throw error;
        registration = existing;
      }
      registration.addEventListener("updatefound", () =>
        observe(registration.installing),
      );
      observe(registration.installing);
      observe(registration.waiting);
      await installedVersion();
      await showWaiting();
      await checkUpdates();
    } catch {
      message(
        "Impossibile inizializzare gli aggiornamenti. Riprova online o apri la procedura di recupero.",
      );
    } finally {
      $("check-updates").disabled = false;
    }
  })();
  try {
    await initializing;
  } finally {
    initializing = null;
  }
}
function checkWhenVisible() {
  if (!document.hidden && Date.now() - lastCheck > 300000) checkUpdates();
}
document.addEventListener("visibilitychange", checkWhenVisible);
window.addEventListener("pageshow", checkWhenVisible);
window.addEventListener("online", () => checkUpdates());
setInterval(checkWhenVisible, 3600000);
initialize();
