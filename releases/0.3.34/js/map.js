import "../vendor/leaflet/leaflet.js";

// The initial viewport is a place, never a simulated user position.
const INITIAL_VIEW = [44.4949, 11.3426];
const L = window.L;
let map,
  tiles,
  marker,
  accuracy,
  position,
  following = false;
let visibleErrors = 0,
  loaded = 0;
const status = () => document.getElementById("map-status");
function reportTiles() {
  const offline = !navigator.onLine;
  status().hidden = !offline && visibleErrors === 0;
  status().textContent = offline
    ? "Offline · cartografia non disponibile"
    : loaded
      ? "Alcune tessere non sono disponibili."
      : "Cartografia non disponibile. Verifica la connessione.";
}
function create() {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView(
    INITIAL_VIEW,
    12,
  );
  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>',
  );
  tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    // No prefetch, bulk downloads or offline tile caching.
    keepBuffer: 1,
    updateWhenIdle: true,
    detectRetina: false,
  });
  tiles.on("loading", () => {
    visibleErrors = 0;
    loaded = 0;
  });
  tiles.on("tileerror", () => {
    visibleErrors++;
    reportTiles();
  });
  tiles.on("tileload", () => {
    loaded++;
  });
  tiles.on("load", reportTiles);
  tiles.addTo(map);
  map.on("dragstart", () => {
    following = false;
  });
  new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(
    document.getElementById("map"),
  );
  document
    .getElementById("zoom-in")
    .addEventListener("click", () => map.zoomIn());
  document
    .getElementById("zoom-out")
    .addEventListener("click", () => map.zoomOut());
  document.getElementById("recenter").addEventListener("click", () => {
    if (position) {
      following = true;
      map.invalidateSize({ pan: false });
      map.setView(position, Math.max(map.getZoom(), 15), { animate: false });
    }
  });
  window.addEventListener("offline", reportTiles);
  window.addEventListener("online", () => {
    visibleErrors = 0;
    reportTiles();
    tiles.redraw();
  });
  reportTiles();
}
export const dashboardMap = {
  show() {
    create();
    requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      if (position && following)
        map.setView(position, map.getZoom(), { animate: false });
    });
  },
  resize() {
    if (map) requestAnimationFrame(() => map.invalidateSize());
  },
  setPosition(coords) {
    if (
      !Number.isFinite(coords.latitude) ||
      !Number.isFinite(coords.longitude) ||
      Math.abs(coords.latitude) > 90 ||
      Math.abs(coords.longitude) > 180
    )
      return;
    create();
    const first = !position;
    position = [coords.latitude, coords.longitude];
    if (!marker)
      marker = L.marker(position, {
        icon: L.divIcon({
          className: "gps-marker",
          html: '<span class="gps-dot"></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        title: "Posizione GPS",
        alt: "Posizione GPS",
        zIndexOffset: 1000,
        keyboard: true,
      })
        .addTo(map)
        .bindTooltip("Posizione GPS");
    marker.setLatLng(position);
    if (Number.isFinite(coords.accuracy) && coords.accuracy >= 0) {
      if (!accuracy)
        accuracy = L.circle(position, {
          radius: coords.accuracy,
          color: "#008dff",
          weight: 1,
          fillOpacity: 0.1,
        }).addTo(map);
      accuracy.setLatLng(position).setRadius(coords.accuracy);
    } else if (accuracy) {
      accuracy.remove();
      accuracy = null;
    }
    document.getElementById("recenter").disabled = false;
    document.getElementById("map-view-description").textContent =
      "Posizione GPS reale · trascina per esplorare la mappa.";
    if (first) {
      following = true;
      map.invalidateSize({ pan: false });
      map.setView(position, 15, { animate: false });
    } else if (following) map.panTo(position, { animate: false });
  },
  getDiagnostics() {
    return {
      center: map
        ? { latitude: map.getCenter().lat, longitude: map.getCenter().lng }
        : null,
      marker: position
        ? { latitude: position[0], longitude: position[1] }
        : null,
    };
  },
  clearPosition() {
    const hadPosition = Boolean(position);
    marker?.remove();
    accuracy?.remove();
    marker = null;
    accuracy = null;
    position = null;
    following = false;
    document.getElementById("recenter").disabled = true;
    if (hadPosition)
      document.getElementById("map-view-description").textContent =
        "Esplorazione mappa · nessuna posizione GPS attiva.";
  },
};
