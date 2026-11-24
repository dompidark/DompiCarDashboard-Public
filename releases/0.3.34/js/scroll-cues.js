// Event-driven hints: no polling or animation loop during playback.
export function initializeScrollCues() {
  const entries = new Map();
  let frame = 0;
  const selectors = '#player, .app-dock, .settings-categories, .settings-pages, .compact-library > section, #info .panel, #phone .panel';
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(update);
  }
  const resize = new ResizeObserver(schedule);
  function update() {
    frame = 0;
    for (const root of document.querySelectorAll(selectors)) {
      if (entries.has(root)) continue;
      const cue = document.createElement('span');
      cue.className = 'scroll-cue'; cue.setAttribute('aria-hidden', 'true');
      cue.hidden = true;
      document.body.append(cue); entries.set(root, cue);
      resize.observe(root); root.addEventListener('scroll', schedule, {passive:true});
    }
    for (const [root, cue] of entries) {
      const r = root.getBoundingClientRect(), css = getComputedStyle(root);
      const visible = r.width > 0 && r.height > 35 && css.visibility !== 'hidden' &&
        !root.closest('[hidden], [inert]') && /auto|scroll/.test(css.overflowY) &&
        root.scrollHeight > root.clientHeight + 3;
      cue.hidden = !visible;
      if (!visible) continue;
      const text = root.scrollTop < 3 ? '↓ Scorri' : root.scrollTop + root.clientHeight >= root.scrollHeight - 3 ? '↑ Scorri' : '↕ Scorri';
      if (cue.textContent !== text) cue.textContent = text;
      cue.style.top = `${Math.min(innerHeight - 25, r.bottom - 25)}px`;
      cue.style.left = `${Math.max(0, Math.min(innerWidth - 78, r.right - 80))}px`;
    }
  }
  new MutationObserver(records => {
    if (records.some(r => !r.target.closest?.('.scroll-cue'))) schedule();
  }).observe(document.querySelector('main') || document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['hidden','class','inert']});
  for (const event of ['resize','pageshow','focus','hashchange']) window.addEventListener(event, schedule);
  for (const event of ['visibilitychange','dompi-panelchange','dompi-render','transitionend','animationend']) document.addEventListener(event, schedule);
  schedule();
}
