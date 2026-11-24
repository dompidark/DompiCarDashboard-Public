import { initializeSettingsWheel } from "./settings-wheel.js";
import { icon } from "./icons.js";
import { shortcutUrl } from "./core.js";
// Compact settings pages: large controls and no long document on tablet.
export function initializeSettings() {
  const $ = (id) => document.getElementById(id);
  const panel = document.querySelector(".settings-panel");
  const layout = document.querySelector(".settings-layout");
  const nav = document.querySelector(".settings-categories");
  const form = $("settings-form");
  const source = $("source");
  source.hidden = true;
  const sources = document.createElement("div");
  sources.id = "source-grid";
  sources.setAttribute("role", "group");
  sources.setAttribute("aria-label", "Sorgente musicale preferita");
  source.after(sources);
  const glyphs = { spotify: "spotify", applemusic: "music", amazon: "music", nas: "nas", local: "music", radio: "radio", tunein: "radio" };
  function refreshSources() {
    sources.replaceChildren();
    for (const option of source.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.sourceChoice = option.value;
      button.innerHTML = icon(glyphs[option.value] || "external");
      const label = document.createElement("span");
      label.textContent = option.textContent;
      button.append(label);
      button.setAttribute("aria-pressed", String(source.value === option.value));
      button.onclick = () => {
        source.value = option.value;
        source.dispatchEvent(new Event("change", { bubbles: true }));
        refreshSources();
        location.hash = "home";
      };
      sources.append(button);
    }
  }
  new MutationObserver(refreshSources).observe(source, { childList: true });
  document.addEventListener("dompi-selection", refreshSources);
  source.addEventListener("change", refreshSources);
  refreshSources();
  const general = ["platform", "theme"];
  const controls = (ids) => ids.map((id) => $(id).closest(".setting"));
  const custom = $("custom-app-form").parentElement;
  custom.hidden = true;
  const system = document.createElement("p");
  system.textContent =
    "Comandi Rapidi disponibili solo su iPad. Nessuno spegnimento diretto dal browser.";
  const music = document.createElement("p");
  music.textContent =
    "Radio e brani locali suonano nella Home. Le app esterne si aprono con un tuo tocco.";
  const maps = document.createElement("p");
  maps.textContent =
    "La Home usa OpenStreetMap. Waze, Google Maps e Mappe Apple si aprono esternamente: non possono essere incorporati nella PWA.";
  const install = [...panel.children].find(
    (el) => el.classList.contains("install-note") && !el.id && el !== custom,
  );
  const windowsHelp = document.createElement("section");
  windowsHelp.className = "install-note";
  windowsHelp.innerHTML = '<h3>Guida: finestre iPad e Slide Over</h3><p>1. Apri Impostazioni iPad e abilita «Sistema a finestre» oppure Stage Manager, se supportato.</p><p>2. Avvia Dompi dalla schermata Home. Dal menu della sua finestra scegli Slide Over, quando disponibile, e disponi la Dashboard a destra.</p><p>3. Apri Waze, Google Maps o Mappe Apple e regola la sua finestra a sinistra. Ripeti per le app che vuoi usare.</p><p>4. Alla successiva apertura iPadOS può ricordare dimensione e posizione delle finestre: controlla che siano rimaste corrette.</p><p><strong>Limiti:</strong> la disponibilità di Slide Over e i formati dipendono da modello e versione di iPadOS. La Dashboard non può riposizionare o bloccare da sola le finestre di terze parti; se Slide Over viene disattivato, va reimpostato. Su un iPad utilizzato anche per altre attività la disposizione può essere scomoda.</p>';
  if (install) install.after(windowsHelp);
  const radioHelp = document.createElement("p");
  radioHelp.textContent =
    "Per scegliere la radio preferita, seleziona prima Radio italiane in Musica e radio. Le radio nascoste si ripristinano qui.";
  const pages = [
    ["general", "Tablet e tema", controls(general)],
    [
      "maps",
      "Mappe e GPS",
      [
        ...controls(["navigator"]),
        maps,
        document.querySelector(".gps-settings"),
      ],
    ],
    ["music", "Musica e radio", [...controls(["source"]), music]],
    ["radio", "Radio preferita", [radioHelp, $("radio-settings")]],
    [
      "system",
      "Comandi Rapidi",
      [...controls(["shortcuts", "shortcutName"]), system],
    ],
    ["updates", "Aggiornamenti", [$("updates-section")]],
    ["help", "Installazione", [install, windowsHelp]],
  ];
  nav.replaceChildren();
  const content = document.createElement("div");
  content.className = "settings-pages";
  for (const [id, title, nodes] of pages) {
    const page = document.createElement("section");
    page.className = "settings-page";
    page.dataset.page = id;
    page.hidden = id !== "general";
    page.setAttribute("aria-label", title);
    for (const node of nodes) if (node) page.append(node);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.settingsPage = id;
    button.textContent = ({ general: "Generali", maps: "Mappe", music: "Musica", radio: "Radio", system: "Sistema", updates: "Aggiorna", help: "Guida" })[id] || title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", () => showSettingsPage(id));
    nav.append(button);
    content.append(page);
  }
  form.hidden = true;
  layout.append(content);
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", "Schede impostazioni");
  function refreshTabs() {
    for (const button of nav.querySelectorAll("[data-settings-page]")) {
      button.setAttribute("role", "tab");
      button.id = `settings-tab-${button.dataset.settingsPage}`;
      const page = content.querySelector(`[data-page="${button.dataset.settingsPage}"]`);
      if (page) {
        page.id = `settings-page-${button.dataset.settingsPage}`;
        page.setAttribute("role", "tabpanel");
        page.setAttribute("aria-labelledby", button.id);
        button.setAttribute("aria-controls", page.id);
      }
    }
  }
  new MutationObserver(refreshTabs).observe(nav, { childList: true });
  refreshTabs();
  initializeSettingsWheel(nav, showSettingsPage);
  const reload = document.createElement("button");
  reload.id = "reload-dashboard";
  reload.type = "button";
  reload.textContent = "Ricarica pagina Dashboard";
  reload.onclick = () => {
    if (document.body.dataset.audioActive === "true" && !confirm("La ricarica interrompe il brano. Ricaricare la Dashboard?")) return;
    location.hash = "home";
    location.reload();
  };
  content.querySelector('[data-page="general"]').append(reload);
  const shortcutTest = document.createElement("button");
  shortcutTest.id = "test-shortcut";
  shortcutTest.type = "button";
  shortcutTest.dataset.ipadOnly = "";
  shortcutTest.textContent = "Prova Comando Rapido";
  const shortcutStatus = document.createElement("p");
  shortcutStatus.id = "shortcut-status";
  shortcutStatus.setAttribute("role", "status");
  shortcutTest.onclick = () => {
    const enabled = $("shortcuts").checked;
    const name = $("shortcutName").value.trim();
    const url = enabled ? shortcutUrl(name) : null;
    if (!url) {
      shortcutStatus.textContent =
        "Attiva l’integrazione e inserisci il nome esatto del Comando Rapido.";
      return;
    }
    shortcutStatus.textContent = `Apertura di “${name}”…`;
    window.location.href = url;
  };
  content
    .querySelector('[data-page="system"]')
    .append(shortcutTest, shortcutStatus);
  $("save-status").remove();
  const status = document.createElement("p");
  status.id = "save-status";
  status.setAttribute("role", "status");
  status.textContent = "Preferenze salvate sul dispositivo.";
  panel.append(status);
  $("update-notice")
    .querySelector("a")
    .addEventListener("click", () => showSettingsPage("updates"));
  showSettingsPage("general");
}
export function showSettingsPage(id) {
  const chooser = document.getElementById("settings-section");
  if (chooser) chooser.value = id;
  const pages = document.querySelector(".settings-pages");
  if (pages) pages.scrollTop = 0;
  document
    .querySelectorAll(".settings-page")
    .forEach((el) => (el.hidden = el.dataset.page !== id));
  document.querySelectorAll("[data-settings-page]").forEach((el) => {
    const selected = el.dataset.settingsPage === id;
    el.classList.toggle("active", selected);
    el.setAttribute("aria-pressed", String(selected));
    el.setAttribute("aria-selected", String(selected));
    el.tabIndex = selected ? 0 : -1;
  });
  document.dispatchEvent(new CustomEvent("dompi-settings-page", {detail:id}));
}
