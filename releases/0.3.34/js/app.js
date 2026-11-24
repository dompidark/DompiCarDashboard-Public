import { initializeScrollCues } from "./scroll-cues.js";
import { initializeContacts } from "./contacts.js";
import {
  defaults,
  safeMusicURL,
  navigators,
  sanitizePreferences,
  gpsSpeed,
  phoneUrl,
  shortcutUrl,
  resolveTheme,
} from "./core.js";
import { renderIcons, icon } from "./icons.js";
import { dashboardMap } from "./map.js";
import { initializeSettings } from "./settings.js";
import { initializeCompact } from "./compact.js";
import { createMusicPlayer } from "./music.js";
import { createGpsController } from "./gps.js";
const $ = (id) => document.getElementById(id);
const storageKey = `dompi.preferences:${new URL("./", document.baseURI).pathname}:v2`;
let prefs = { ...defaults };
try {
  const saved = JSON.parse(
    localStorage.getItem(storageKey) ||
      localStorage.getItem("dompi.preferences.v1"),
  );
  prefs = sanitizePreferences({
    ...saved,
    platform:
      saved?.platform ||
      (/Android/i.test(navigator.userAgent) ? "android" : "ipad"),
  });
} catch {
  /* Defaults remain usable when storage is unavailable. */
}
let lastSavedPreferences = structuredClone(prefs);
renderIcons();
initializeSettings();
let noticeTimer;
function notice(message) {
  $("notice").textContent = message;
  $("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("notice").hidden = true), 6000);
}
const media = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme(
    prefs.theme,
    media.matches,
  );
  document.querySelector('meta[name="theme-color"]').content =
    document.documentElement.dataset.theme === "night" ? "#050b13" : "#eaf0f7";
}
media.addEventListener("change", applyTheme);
setInterval(() => { if (!document.hidden) applyTheme(); }, 60000);
window.addEventListener("pageshow", applyTheme);
window.addEventListener("focus", applyTheme);
document.addEventListener("visibilitychange", () => { if (!document.hidden) applyTheme(); });
function persist(explicit = {}) {
  try {
    const latest =
      JSON.parse(localStorage.getItem(storageKey)) || lastSavedPreferences;
    const changes = Object.fromEntries(
      Object.keys(prefs)
        .filter(
          (key) =>
            JSON.stringify(prefs[key]) !==
            JSON.stringify(lastSavedPreferences[key]),
        )
        .map((key) => [key, prefs[key]]),
    );
    prefs = sanitizePreferences({ ...latest, ...changes, ...explicit });
    lastSavedPreferences = structuredClone(prefs);
    localStorage.setItem(storageKey, JSON.stringify(prefs));
    $("save-status").textContent = "Preferenze salvate su questo dispositivo.";
  } catch {
    $("save-status").textContent =
      "Salvataggio non disponibile: preferenze valide soltanto per questa sessione.";
    notice("Il browser non permette di salvare le preferenze.");
  }
}
function applyPreferences() {
  // Compact v3.2 has one fixed Home geometry; discard obsolete size states.
  document.body.dataset.uiSize = "fixed";
  applyTheme();
  document
    .querySelectorAll("[data-setting-theme]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.settingTheme === prefs.theme),
      ),
    );
  const android = prefs.platform === "android";
  document.body.dataset.platform = prefs.platform;
  $("power").hidden = android || !prefs.shortcuts;
  document.querySelectorAll(".navigator-options a").forEach((link) => {
    const preferred = link.href === navigators[prefs.navigator].url;
    link.classList.toggle("preferred", preferred);
    if (preferred) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  document
    .querySelectorAll("[data-ipad-only]")
    .forEach((el) => (el.hidden = android));
  const appleOption = document.querySelector(
    '#navigator option[value="apple"]',
  );
  appleOption.hidden = appleOption.disabled = android;
  document.querySelector(
    '.navigator-options a[href="https://maps.apple.com/"]',
  ).hidden = android;
  $("device-icon").innerHTML = icon(android ? "android" : "ipad");
  $("choose-navigator").querySelector("[data-icon]").innerHTML = icon(
    android ? "googlemaps" : "navigation",
  );
  if (android && $("power-dialog").open) $("power-dialog").close();
  document
    .querySelectorAll("#source option[data-custom]")
    .forEach((el) => el.remove());
  for (const app of prefs.customApps) {
    const option = new Option(app.name, app.id);
    option.dataset.custom = "true";
    $("source").add(option);
  }
  for (const name of [
    "platform",
    "theme",
    "navigator",
    "source",
    "shortcutName",
    "radioStation",
    "radioURL",
  ])
    $(name).value = prefs[name];
  $("shortcuts").checked = prefs.shortcuts;
  $("shortcuts").disabled = android;
  $("shortcutName").disabled = android || !prefs.shortcuts;
  $("radio-settings").hidden = prefs.source !== "radio";
  $("radioURL").disabled = prefs.radioStation !== "custom";
  music.select(prefs.source);
  renderCustomApps();
}
$("settings").addEventListener("change", (event) => {
  if (
    ![
      "theme",
      "platform",
      "navigator",
      "source",
      "shortcuts",
      "shortcutName",
      "radioStation",
      "radioURL",
    ].includes(event.target.id)
  )
    return;
  if (["radioStation", "radioURL"].includes(event.target.id))
    music.clearStation();
  prefs = sanitizePreferences({
    ...prefs,
    radioStation: $("radioStation").value,
    radioURL: $("radioURL").value,
    platform: $("platform").value,
    theme: $("theme").value,
    navigator: $("navigator").value,
    source: $("source").value,
    shortcuts: $("shortcuts").checked,
    shortcutName: $("shortcutName").value,
  });
  persist();
  applyPreferences();
});
function chooseSource(source) {
  prefs = sanitizePreferences({ ...prefs, source });
  persist({ source });
  applyPreferences();
}
function chooseRadio(radioStation) {
  prefs = sanitizePreferences({ ...prefs, radioStation });
  persist();
  applyPreferences();
}
const music = createMusicPlayer({
  chooseRadio,
  getPreferences: () => prefs,
  chooseSource,
  notice,
});
function renderCustomApps() {
  $("custom-app-list").replaceChildren();
  for (const app of prefs.customApps) {
    const row = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = app.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Rimuovi";
    remove.setAttribute("aria-label", `Rimuovi ${app.name}`);
    remove.addEventListener("click", () => {
      prefs = sanitizePreferences({
        ...prefs,
        customApps: prefs.customApps.filter((item) => item.id !== app.id),
      });
      persist();
      applyPreferences();
    });
    row.append(label, remove);
    $("custom-app-list").append(row);
  }
}
$("custom-app-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("custom-app-name").value.trim(),
    url = safeMusicURL($("custom-app-url").value);
  if (!name || !url) {
    $("custom-app-status").textContent =
      "Inserisci un nome e un indirizzo HTTPS valido, senza credenziali.";
    return;
  }
  if (prefs.customApps.length >= 12) {
    $("custom-app-status").textContent =
      "Puoi aggiungere fino a 12 collegamenti.";
    return;
  }
  const id = `custom-${crypto.randomUUID()}`;
  prefs = sanitizePreferences({
    ...prefs,
    customApps: [...prefs.customApps, { id, name, url }],
  });
  persist();
  applyPreferences();
  $("custom-app-form").reset();
  $("custom-app-status").textContent =
    "App aggiunta alle sorgenti musicali preferite.";
});
const release = document.querySelector('meta[name="dompi-version"]').content;
document
  .querySelectorAll("[data-app-version]")
  .forEach((el) => (el.textContent = release));
const playerHome = $("player").parentElement;
const titles = {
  home: "Schermata principale",
  info: "Informazioni e guida all’app.",
  music: "Lettore musica",
  phone: "Sempre in contatto.",
  whatsapp: "Le tue conversazioni.",
  settings: "Impostazioni",
  diagnostics: "Diagnostica GPS",
};
function restoreScreenVisibility(screen) {
  document.querySelectorAll('.screen').forEach(el => {
    const hidden = el.id !== screen;
    if (el.hidden !== hidden) el.hidden = hidden;
  });
  document.body.dataset.screen = screen;
}
document.addEventListener('dompi-resume', () => {
  if (document.hidden) return;
  const route = location.hash.slice(1);
  restoreScreenVisibility(route === 'music' || !Object.hasOwn(titles, route) ? 'home' : route);
});
function showScreen() {
  let screen = Object.hasOwn(titles, location.hash.slice(1))
    ? location.hash.slice(1)
    : "home";
  if (screen === "music") {
    screen = "home";
    document.dispatchEvent(
      new CustomEvent("dompi-library", { detail: "local" }),
    );
  }
  restoreScreenVisibility(screen);
  document.querySelectorAll("[data-screen]").forEach((el) => {
    el.classList.toggle("active", el.dataset.screen === screen);
    if (el.dataset.screen === screen) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  $("page-title").textContent = titles[screen];
  document.body.dataset.screen = screen;
  (screen === "music" ? $("music-slot") : playerHome).prepend($("player"));
  applyPreferences();
  if (screen === "diagnostics") dashboardMap.show();
}
document
  .querySelectorAll("[data-screen]")
  .forEach((el) =>
    el.addEventListener("click", () => (location.hash = el.dataset.screen)),
  );
window.addEventListener("hashchange", showScreen);
$("expand").addEventListener("click", () => {
  const expanded = document
    .querySelector(".map-panel")
    .classList.toggle("expanded");
  dashboardMap.resize();
  $("expand").setAttribute("aria-pressed", String(expanded));
  $("expand").setAttribute(
    "aria-label",
    expanded ? "Riduci mappa" : "Espandi mappa",
  );
});
function clock() {
  if (document.hidden) return;
  const now = new Date();
  $("clock").textContent = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  $("clock").dateTime = now.toISOString();
  $("date").textContent = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(now);
}
function connection() {
  $("connection").textContent = navigator.onLine
    ? "● Rete disponibile"
    : "○ Offline";
  $("connection").title =
    "Stato di rete riferito dal browser; non verifica l’accesso a Internet.";
}
addEventListener("online", connection);
addEventListener("offline", connection);
if (navigator.getBattery)
  navigator
    .getBattery()
    .then((battery) => {
      const update = () => {
        $("charge-status").dataset.state = battery.charging ? "on" : "off";
        $("charge-status").textContent = battery.charging
          ? "In carica"
          : "Non in carica";
        $("battery").hidden = false;
        $("battery").textContent =
          `${battery.charging ? "↯ " : ""}${Math.round(battery.level * 100)}%`;
      };
      update();
      battery.addEventListener("levelchange", update);
      battery.addEventListener("chargingchange", update);
    })
    .catch(() => {});
const gps = createGpsController({
  geolocation: navigator.geolocation,
  secure: isSecureContext,
  onFix: (fix) => dashboardMap.setPosition(fix),
  onClear: () => dashboardMap.clearPosition(),
  onChange: (state) => {
    $("speed").textContent = state.live ? gpsSpeed(state.fix?.speed) : "—";
    $("gps-status").textContent = state.status;
    $("gps-indicator").dataset.state = state.active ? "on" : "off";
    $("gps-indicator").textContent = state.active
      ? "GPS attivo"
      : state.suspended
        ? "GPS sospeso"
        : "GPS disattivo";
    $("gps-toggle").textContent = state.enabled
      ? "Disattiva GPS"
      : "Attiva GPS";
    $("gps-preference").checked = state.enabled;
    $("gps-diagnostic-status").textContent = state.status;
    $("gps-latitude").textContent = state.fix
      ? state.fix.latitude.toFixed(6)
      : "—";
    $("gps-longitude").textContent = state.fix
      ? state.fix.longitude.toFixed(6)
      : "—";
    $("gps-accuracy").textContent =
      state.fix && state.fix.accuracy !== null
        ? `${Math.round(state.fix.accuracy)} m`
        : "—";
    $("gps-updated").textContent = state.fix
      ? new Date(state.fix.timestamp).toLocaleString("it-IT")
      : "—";
    $("gps-age").textContent = state.fix
      ? `${Math.max(0, Math.floor((Date.now() - state.fix.timestamp) / 1000))} s · ${state.live ? "dato attuale" : "ultimo dato, non attuale"}`
      : "Nessuna posizione ricevuta";
    $("gps-error").textContent = state.error
      ? `${state.error.code}: ${state.error.message}${state.error.detail ? ` · ${state.error.detail}` : ""} (${new Date(state.error.timestamp).toLocaleTimeString("it-IT")})`
      : "Nessuno";
    $("gps-watch").textContent = state.active
      ? "Attivo"
      : state.suspended
        ? "Sospeso"
        : state.denied
          ? "Permesso negato"
          : "Non attivo";
    const diagnostic = dashboardMap.getDiagnostics();
    $("gps-marker-state").textContent = diagnostic.marker
      ? `${diagnostic.marker.latitude.toFixed(6)}, ${diagnostic.marker.longitude.toFixed(6)}`
      : "Non mostrato";
    $("gps-map-center").textContent = diagnostic.center
      ? `${diagnostic.center.latitude.toFixed(6)}, ${diagnostic.center.longitude.toFixed(6)}`
      : "Mappa non inizializzata";
    $("gps-retry").disabled = !state.enabled;
  },
});
function setGpsEnabled(enabled) {
  prefs.gpsEnabled = enabled;
  persist();
  gps.setEnabled(enabled);
}
$("gps-toggle").addEventListener("click", () =>
  setGpsEnabled(!prefs.gpsEnabled),
);
$("gps-preference").addEventListener("change", () =>
  setGpsEnabled($("gps-preference").checked),
);
$("gps-retry").addEventListener("click", () => gps.retry());
setInterval(() => {
  if (!document.hidden && gps.getState().enabled) gps.tick();
}, 1000);
function suspendGPS() {
  gps.suspend();
  // iPadOS decides background audio; do not stop it when opening an external navigator.
}
function resumeGPS() {
  if (!document.hidden) {
    gps.resume();
    clock();
  }
}
document.addEventListener("visibilitychange", () =>
  document.hidden ? suspendGPS() : resumeGPS(),
);
window.addEventListener("pagehide", suspendGPS);
window.addEventListener("pageshow", resumeGPS);
window.addEventListener("focus", resumeGPS);
$("phone-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const url = phoneUrl($("phone-number").value);
  if (url) location.href = url;
  else
    notice(
      "Inserisci un numero valido, con eventuale prefisso internazionale.",
    );
});
$("power").addEventListener("click", () => {
  if (prefs.platform !== "ipad" || !prefs.shortcuts) return;
  const url = shortcutUrl(prefs.shortcutName);
  if (!url) {
    location.hash = "settings";
    notice("Inserisci il nome del Comando Rapido da aprire.");
    return;
  }
  $("power-description").textContent =
    `Verrà aperto “${prefs.shortcutName}” nell’app Comandi Rapidi.`;
  $("run-shortcut").href = url;
  $("power-dialog").showModal();
});
$("cancel-power").addEventListener("click", () => $("power-dialog").close());
$("run-shortcut").addEventListener("click", (event) => {
  const url = event.currentTarget.href;
  if (!url) return;
  event.preventDefault();
  $("power-dialog").close();
  window.location.href = url;
});
initializeCompact({ music, chooseSource, notice, getPreferences: () => prefs });
initializeContacts(notice);
initializeScrollCues();
applyPreferences();
showScreen();
if (document.hidden) gps.suspend();
gps.setEnabled(prefs.gpsEnabled);
clock();
connection();
setInterval(clock, 1000);
$("choose-navigator").addEventListener("click", () =>
  $("navigator-dialog").showModal(),
);
$("close-navigator").addEventListener("click", () =>
  $("navigator-dialog").close(),
);
document
  .querySelectorAll(".navigator-options a")
  .forEach((link) =>
    link.addEventListener("click", () => $("navigator-dialog").close()),
  );
document.querySelectorAll("[data-digit]").forEach((button) =>
  button.addEventListener("click", () => {
    const field = $("phone-number");
    field.value =
      button.dataset.digit === "delete"
        ? field.value.slice(0, -1)
        : (field.value + button.dataset.digit).slice(0, 20);
  }),
);

document.querySelectorAll("[data-setting-theme]").forEach((button) =>
  button.addEventListener("click", () => {
    prefs.theme = button.dataset.settingTheme;
    persist();
    applyPreferences();
  }),
);
// Keep touch feedback visible briefly after pointer release, including navigation.
const feedbackTimers = new WeakMap();
function pressFeedback(event) {
  if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
  const control = event.target.closest("button, nav a, .primary, .secondary");
  if (!control || control.disabled) return;
  clearTimeout(feedbackTimers.get(control));
  control.classList.add("touch-feedback");
  feedbackTimers.set(
    control,
    setTimeout(() => control.classList.remove("touch-feedback"), 550),
  );
}
document.addEventListener("pointerdown", pressFeedback);
document.addEventListener("keydown", pressFeedback);
