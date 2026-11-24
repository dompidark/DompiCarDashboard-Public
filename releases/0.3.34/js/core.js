export const defaults = Object.freeze({
  theme: "night",
  platform: "ipad",
  customApps: [],
  navigator: "waze",
  source: "spotify",
  radioStation: "rai1",
  radioURL: "",
  shortcuts: false,
  gpsEnabled: false,
  shortcutName: "",
});
export const navigators = Object.freeze({
  waze: { name: "Waze", url: "https://www.waze.com/ul" },
  google: { name: "Google Maps", url: "https://www.google.com/maps/" },
  apple: { name: "Mappe Apple", url: "https://maps.apple.com/" },
});
export function sanitizePreferences(value) {
  const p = value && typeof value === "object" ? value : {};
  const customApps = Array.isArray(p.customApps)
    ? p.customApps
        .filter(
          (app) =>
            app &&
            /^custom-[a-z0-9-]+$/.test(app.id) &&
            typeof app.name === "string" &&
            safeMusicURL(app.url),
        )
        .slice(0, 12)
        .map((app) => ({
          id: app.id,
          name: app.name.trim().slice(0, 50),
          url: safeMusicURL(app.url),
        }))
    : [];
  const platform = p.platform === "android" ? "android" : "ipad";
  return {
    platform,
    customApps,
    radioStation: ["rai1", "rai2", "rai3", "custom"].includes(p.radioStation)
      ? p.radioStation
      : "rai1",
    radioURL: safeMusicURL(p.radioURL) || "",
    theme: ["night", "day", "auto"].includes(p.theme)
      ? p.theme
      : defaults.theme,
    navigator:
      platform === "android" && p.navigator === "apple"
        ? "google"
        : Object.hasOwn(navigators, p.navigator)
          ? p.navigator
          : defaults.navigator,
    source: [
      "spotify",
      "applemusic",
      "amazon",
      "nas",
      "local",
      "radio",
      "tunein",
      ...customApps.map((app) => app.id),
    ].includes(p.source)
      ? p.source
      : defaults.source,
    shortcuts: p.shortcuts === true,
    gpsEnabled: p.gpsEnabled === true,
    shortcutName:
      typeof p.shortcutName === "string"
        ? p.shortcutName.trim().slice(0, 100)
        : "",
  };
}
export function gpsSpeed(speed) {
  return typeof speed === "number" && Number.isFinite(speed) && speed >= 0
    ? String(Math.round(speed * 3.6))
    : "—";
}
export function phoneUrl(value) {
  const number = value.replace(/[\s().-]/g, "");
  return /^\+?\d{3,15}$/.test(number) ? `tel:${number}` : null;
}
export function shortcutUrl(name) {
  return name.trim()
    ? `shortcuts://run-shortcut?name=${encodeURIComponent(name.trim())}`
    : null;
}
// Extension point: pass calculated local sunrise/sunset instants when available.
export function resolveTheme(
  preference,
  prefersDark,
  solarTimes = null,
  now = new Date(),
) {
  if (preference !== "auto") return preference;
  if (
    solarTimes?.sunrise instanceof Date &&
    solarTimes?.sunset instanceof Date &&
    solarTimes.sunrise < solarTimes.sunset
  )
    return now >= solarTimes.sunrise && now < solarTimes.sunset
      ? "day"
      : "night";
  return now.getHours() >= 7 && now.getHours() < 19 ? "day" : "night";
}

export function safeMusicURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export const musicSources = Object.freeze({
  spotify: {
    name: "Spotify",
    url: "https://open.spotify.com/",
    app: "spotify:",
    ios: "https://apps.apple.com/app/id324684580",
    android: "https://play.google.com/store/apps/details?id=com.spotify.music",
  },
  applemusic: {
    name: "Apple Music",
    url: "https://music.apple.com/",
    app: "music://",
    ios: "https://apps.apple.com/app/id1108187390",
    android:
      "https://play.google.com/store/apps/details?id=com.apple.android.music",
  },
  amazon: {
    name: "Amazon Music",
    url: "https://music.amazon.com/",
    app: "amznmp3://",
    ios: "https://apps.apple.com/app/id510855668",
    android: "https://play.google.com/store/apps/details?id=com.amazon.mp3",
  },
  tunein: {
    name: "TuneIn Radio",
    app: "tunein://",
    url: "https://tunein.com/",
    ios: "https://apps.apple.com/app/id418987775",
    android: "https://play.google.com/store/apps/details?id=tunein.player",
  },
  radio: { name: "Radio italiane" },
  nas: { name: "Jellyfin NAS" },
  local: { name: "Brani sul dispositivo" },
});

export const radioStations = Object.freeze({
  rai1: { name: "Rai Radio 1", url: "https://icestreaming.rai.it/1.mp3" },
  rai2: { name: "Rai Radio 2", url: "https://icestreaming.rai.it/2.mp3" },
  rai3: { name: "Rai Radio 3", url: "https://icestreaming.rai.it/3.mp3" },
});
