import { readMedia, saveMedia, safeStream } from "./media-storage.js";
import { radioStations } from "./core.js";
export const categories = [
  "Tutte",
  "Nazionali",
  "Locali",
  "Notizie",
  "Anni ’70, ’80 e ’90",
  "Rock",
  "Pop",
  "Musica italiana",
  "Classica",
  "Jazz",
  "Dance",
];
const tags = {
  Nazionali:
    /rai|rtl|rds|deejay|105|r101|virgin|radio italia|radio 24|monte carlo|kiss kiss/i,
  Notizie: /news|notizie|talk|radio 24|radio 1/i,
  "Anni ’70, ’80 e ’90": /70|80|90|oldies|classic hits/i,
  Rock: /rock/i,
  Pop: /pop/i,
  "Musica italiana": /italian|italiana/i,
  Classica: /classical|classica/i,
  Jazz: /jazz/i,
  Dance: /dance|electro|house/i,
};
export function normalizeStations(rows) {
  const seen = new Set();
  return rows
    .filter((r) => r.lastcheckok === 1 && safeStream(r.url_resolved || r.url))
    .filter((r) => {
      const key = r.stationuuid || r.url_resolved;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100)
    .map((r) => ({
      id: r.stationuuid || r.url_resolved,
      name: String(r.name).trim().slice(0, 100),
      url: safeStream(r.url_resolved || r.url),
      logo: safeStream(r.favicon),
      tags: String(r.tags || ""),
      checked: r.lastchecktime_iso8601 || null,
    }));
}
export function matchesCategory(station, category) {
  const text = station.name + " " + station.tags;
  return (
    category === "Tutte" ||
    (category === "Locali"
      ? !tags.Nazionali.test(text)
      : tags[category]?.test(text))
  );
}
export async function discoverRadio() {
  const hosts = [
    "de1.api.radio-browser.info",
    "nl1.api.radio-browser.info",
    "at1.api.radio-browser.info",
  ];
  for (const host of hosts) {
    try {
      const response = await fetch(
        `https://${host}/json/stations/search?countrycode=IT&hidebroken=true&order=votes&reverse=true&limit=300`,
        {
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
          credentials: "omit",
        },
      );
      if (!response.ok) continue;
      const stations = normalizeStations(await response.json());
      if (stations.length >= 50) {
        saveMedia({ catalog: stations, catalogDate: new Date().toISOString() });
        return stations;
      }
    } catch {}
  }
  throw Error(
    "Catalogo non raggiungibile o meno di 50 flussi HTTPS disponibili. Restano le radio salvate; riprova online.",
  );
}
export function savedStations() {
  const state = readMedia();
  const fallback = Object.entries(radioStations).map(([id, s]) => ({
    ...s,
    id,
    tags: "italian",
  }));
  return [
    ...(Array.isArray(state.catalog)
      ? state.catalog.filter((s) => s && typeof s.name === "string" && safeStream(s.url))
      : fallback),
    ...(Array.isArray(state.manual)
      ? state.manual.filter((s) => s && typeof s.name === "string" && safeStream(s.url))
      : []),
  ];
}
