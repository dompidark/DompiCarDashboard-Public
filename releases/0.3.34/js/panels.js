// Overlay panels never replace or pause the media element.
export function initializePanels({
  sheet,
  player,
  tabs,
  homeButton,
  title,
  onActivate = () => {},
}) {
  let current = null;
  const home = document.getElementById("home");
  const labels = {
    radio: "Radio",
    local: "Musica locale",
    nas: "Jellyfin",
    queue: "Coda / Playlist",
  };
  const heading = document.createElement("div");
  heading.className = "sheet-heading";
  const name = document.createElement("h2");
  name.id = "sheet-title";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "⌄ Home";
  close.id = "close-media-panel";
  heading.append(name, close);
  sheet.prepend(heading);
  sheet.setAttribute("aria-labelledby", "sheet-title");
  let listeningSource = null;
  function highlightPlayback() {
    for (const button of tabs.querySelectorAll('[data-media-tab]')) {
      const id = button.dataset.mediaTab;
      const listening = id === listeningSource || (id === 'queue' && ['local','nas'].includes(listeningSource));
      button.classList.toggle('is-listening', listening);
      button.setAttribute('aria-description', listening ? 'Sorgente in ascolto' : '');
    }
  }
  document.addEventListener('dompi-selection', event => {
    listeningSource = event.detail.source;
    highlightPlayback();
  });
  document.addEventListener('dompi-playback', event => {
    tabs.dataset.playing = String(event.detail.playing);
  });
  function sync() {
    const onHome = document.body.dataset.screen === "home";
    homeButton.classList.toggle("active", onHome && !current);
    homeButton.setAttribute("aria-pressed", String(onHome && !current));
    if (onHome && !current) homeButton.setAttribute("aria-current", "page");
    else homeButton.removeAttribute("aria-current");
  }
  function open(id) {
    current = Object.hasOwn(labels, id) ? id : null;
    sheet
      .querySelectorAll("[data-media-page]")
      .forEach((el) => (el.hidden = el.dataset.mediaPage !== current));
    tabs.querySelectorAll("[data-media-tab]").forEach((b) => {
      const active = b.dataset.mediaTab === current;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    name.textContent = labels[current] || "";
    sheet.classList.toggle("is-open", Boolean(current));
    sheet.inert = !current;
    sheet.setAttribute("aria-hidden", String(!current));
    player.inert = Boolean(current);
    player.setAttribute("aria-hidden", String(Boolean(current)));
    home.dataset.panel = current || "";
    if (!current && sheet.contains(document.activeElement))
      homeButton.focus({ preventScroll: true });
    sync();
    highlightPlayback();
    document.dispatchEvent(new Event("dompi-panelchange"));
  }
  tabs
    .querySelectorAll("[data-media-tab]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          open(b.dataset.mediaTab);
          onActivate(b.dataset.mediaTab);
        }),
    );
  close.onclick = () => open(null);
  homeButton.addEventListener("click", () => {
    document.activeElement?.blur();
    open(null);
  });
  window.addEventListener("hashchange", () => {
    if (
      location.hash !== "#home" &&
      location.hash !== "#music" &&
      location.hash
    )
      open(null);
    requestAnimationFrame(sync);
  });
  const viewport = window.visualViewport;
  function resize() {
    // Handoff snapshots may report zero dimensions while iPadOS hides a window.
    if (document.hidden || !Number.isFinite(innerHeight) || innerHeight <= 0) return;
    const active = document.activeElement;
    const editing = active?.matches('textarea, input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="file"])') && !active.readOnly;
    // Pinch zoom and a stale visualViewport after dismissing the keyboard must
    // not become a persistent half-height layout. Real window resizing still applies.
    const keyboard = Boolean(editing && viewport && viewport.height > 0 && Math.abs(viewport.scale-1)<.05 && viewport.height < innerHeight-80);
    const height = keyboard && viewport.height > 0 ? viewport.height : innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    document.documentElement.style.setProperty('--viewport-top', `${keyboard ? Math.round(viewport.offsetTop) : 0}px`);
    document.body.dataset.keyboard = String(keyboard);
    if (editing)
      requestAnimationFrame(() =>
        document.activeElement?.scrollIntoView({ block: "nearest" }),
      );
  }
  viewport?.addEventListener("resize", resize);
  viewport?.addEventListener("scroll", resize);
  window.addEventListener("resize", resize);
  document.addEventListener("focusin", resize);
  document.addEventListener("focusout", () => { setTimeout(resize); setTimeout(resize, 350); });
  const reconcile = () => {
    if (!document.hidden) {
      resize();
      document.dispatchEvent(new Event("dompi-resume"));
      open(current); // Reconcile sheet, player inert state and accessibility after resume.
      document.dispatchEvent(new Event("dompi-render"));
    }
  };
  // A stale inert flag must not leave Home invisible after a Safari resume.
  new MutationObserver(() => {
    if (player.inert !== Boolean(current) || sheet.inert !== !current) reconcile();
  }).observe(home, {subtree:true, attributes:true, attributeFilter:['inert']});
  window.addEventListener("resize", reconcile);
  viewport?.addEventListener("resize", reconcile);
  let resumeFrame = 0, resumeTimer = 0;
  function resume() {
    cancelAnimationFrame(resumeFrame); clearTimeout(resumeTimer);
    if (document.hidden) return;
    reconcile();
    // Safari may publish final viewport metrics after the initial resume event.
    resumeFrame = requestAnimationFrame(reconcile);
    resumeTimer = setTimeout(reconcile, 400);
  }
  window.addEventListener("focus", resume);
  window.addEventListener("pageshow", resume);
  document.addEventListener("visibilitychange", resume);
  document.addEventListener(
    "pointerdown",
    () => {
      if (!document.hidden) document.body.dataset.graphicsPaused = "false";
    },
    true,
  );
  resize();
  open(null);
  return { open };
}
export function initializeMarquee(element) {
  let revision = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function measure() {
    let span = element.querySelector(".track-text");
    if (!span) {
      span = document.createElement("span");
      span.className = "track-text";
      span.textContent = element.textContent;
      element.replaceChildren(span);
    }
    element.setAttribute("aria-label", span.textContent);
    element.title = span.textContent;
    const travel = Math.max(0, span.scrollWidth - element.clientWidth);
    element.classList.toggle("is-marquee", travel > 2 && !reduced.matches);
    element.style.setProperty("--title-travel", `${-travel}px`);
    element.style.setProperty(
      "--title-duration",
      `${Math.max(8, travel / 25 + 4)}s`,
    );
  }
  const schedule = () => {
    cancelAnimationFrame(revision);
    revision = requestAnimationFrame(measure);
  };
  new MutationObserver(schedule).observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  new ResizeObserver(schedule).observe(element);
  reduced.addEventListener("change", schedule);
  document.addEventListener("dompi-panelchange", schedule);
  window.addEventListener("hashchange", schedule);
  document.addEventListener("dompi-render", schedule);
  schedule();
}
