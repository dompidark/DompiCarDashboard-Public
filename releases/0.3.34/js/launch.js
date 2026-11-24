// Explicit user action only; never navigate the dashboard to an Apple Maps website.
export const appleMapsURL = "maps://";
export function openAppleMaps(notice, doc = document, win = window) {
  let left = false;
  const changed = () => {
    if (doc.hidden) left = true;
  };
  doc.addEventListener("visibilitychange", changed);
  const link = doc.createElement("a");
  link.href = appleMapsURL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  // A native Maps URL in a separate browsing target preserves this PWA if handoff fails.
  doc.body.append(link);
  link.click();
  link.remove();
  win.setTimeout(() => {
    doc.removeEventListener("visibilitychange", changed);
    if (!left)
      notice(
        "Se Mappe Apple non si è aperta, avviala dal Dock di iPadOS. La Dashboard resta qui; il browser non può verificare l’apertura dell’app.",
      );
  }, 1600);
}
