// This localStorage metadata store contains no tokens, passwords, blobs or private Jellyfin responses.
// Explicit local-file and radio-image imports live separately in scoped IndexedDB.
export const mediaKey = `dompi.media:${typeof document === "undefined" ? "/" : new URL("./", document.baseURI).pathname}:v2`;
export function readMedia() {
  try {
    const value = JSON.parse(localStorage.getItem(mediaKey));
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    for (const key of [
      "favorites",
      "catalog",
      "manual",
      "localPlaylist",
      "hiddenRadios",
    ]) {
      if (value[key] !== undefined && !Array.isArray(value[key]))
        delete value[key];
    }
    return value;
  } catch {
    return {};
  }
}
export function saveMedia(patch) {
  try {
    localStorage.setItem(
      mediaKey,
      JSON.stringify({ ...readMedia(), ...patch }),
    );
    return true;
  } catch {
    return false;
  }
}
export function safeStream(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function nextIndex(index, length, shuffle, random = Math.random) {
  if (length < 2) return 0;
  return shuffle
    ? (index + 1 + Math.floor(random() * (length - 1))) % length
    : (index + 1) % length;
}
