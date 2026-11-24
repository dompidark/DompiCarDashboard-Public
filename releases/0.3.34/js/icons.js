const paths = {
  nas: "M3 3h18v7H3ZM3 14h18v7H3ZM6 6h.01M6 17h.01M10 6h8M10 17h8",
  radio: "M3 7h18v14H3ZM5 7l13-5M6 11h12M10 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0M14 16h4",
  battery: "M2 6h18v12H2ZM22 10v4M12 7l-4 6h4l-1 4 5-7h-4Z",
  ipad: "M5 2h14v20H5ZM11 19h2",
  android:
    "M5 9h14v10H5ZM5 9a7 7 0 0 1 14 0M7 3 5 1M17 3l2-2M8 6h.01M16 6h.01M2 10v7M22 10v7M8 19v3M16 19v3",
  googlemaps:
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",

  search: "M16 16l6 6M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  spotify:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M6 9q6-3 12 0M7 12q5-2 10 0M8 15q4-2 8 0",
  locate: "M12 2v4M12 18v4M2 12h4M18 12h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0",

  external: "M7 17 17 7M7 7h10v10",
  info: "M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  sun: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z",
  auto: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M8 17l4-10 4 10M10 13h4",
  heart: "M12 21 3 12C-3 4 7 0 12 7c5-7 15-3 9 5Z",
  car: "M4 10l2-6h12l2 6M3 10h18v9h-3v-3H6v3H3ZM6 12h2M16 12h2",

  home: "M3 10 12 3l9 7v10H15v-6H9v6H3Z",
  waze: "M20 11a8 8 0 0 0-16 0v4l-2 2h5a8 8 0 0 0 13-6ZM8 10h.01M15 10h.01M9 14q3 2 5 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  music:
    "M9 18V5l11-2v13M9 7l11-2M9 18a3 3 0 1 1-3-3q3 0 3 3ZM20 16a3 3 0 1 1-3-3q3 0 3 3",
  phone: "M5 3h4l2 5-3 2q2 4 6 6l2-3 5 2v4q0 3-4 2C8 19 3 14 2 7q-1-4 3-4",
  chat: "M21 11a9 9 0 0 1-13 8L3 21l1-5a9 9 0 1 1 17-5ZM8 11h.01M12 11h.01M16 11h.01",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  power: "M12 2v10M6 5a9 9 0 1 0 12 0",
  expand: "M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5",
  collapse: "M9 9H3M9 9V3M15 9h6M15 9V3M15 15h6M15 15v6M9 15H3M9 15v6",
  navigation: "m12 3 8 18-8-5-8 5Z",
  previous: "M5 5v14M19 5 8 12l11 7Z",
  next: "M19 5v14M5 5l11 7-11 7Z",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 5v14M16 5v14",
  shuffle: "M3 7h3c4 0 6 10 10 10h5M17 13l4 4-4 4M3 17h3c4 0 6-10 10-10h5M17 3l4 4-4 4",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  folder: "M3 6h7l2 3h9v11H3Z",
  queue: "M4 5h16M4 10h16M4 15h10M18 14v8M15 19h6",
  meter: "M3 18a9 9 0 0 1 18 0M12 18l5-7M12 18h.01",
  volume: "m3 9 5 0 5-5v16l-5-5H3ZM17 8q4 4 0 8M20 5q6 7 0 14",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z",
};
// Filled, multicolour glyphs for the reference-style app tiles. SVGs stay local.
const artwork = {
  home: '<path fill="currentColor" stroke="none" d="M2 10.5 12 2l10 8.5v10a1.5 1.5 0 0 1-1.5 1.5H15v-8H9v8H3.5A1.5 1.5 0 0 1 2 20.5Z"/>',
  music: '<path fill="currentColor" stroke="none" d="M9 4 21 1v16c0 5-8 6-8 2 0-3 3-4 5-3V7l-6 1.5V20c0 5-9 5-9 1 0-3 3-4 6-3Z"/>',
  phone: '<path fill="currentColor" stroke="none" d="M4 2c-3 0-3 5-2 8 2 6 6 10 12 12 3 1 8 1 8-2v-4l-6-3-3 3c-3-1-5-3-6-6l3-3-3-5Z"/>',
  settings: '<path fill="currentColor" fill-rule="evenodd" stroke="none" d="M12.00 4.00L13.31 2.09L14.59 2.34L15.06 4.61L16.00 5.07L18.09 4.07L19.07 4.93L18.35 7.13L18.93 8.00L21.24 8.17L21.66 9.41L19.93 10.96L20.00 12.00L21.91 13.31L21.66 14.59L19.39 15.06L18.93 16.00L19.93 18.09L19.07 19.07L16.87 18.35L16.00 18.93L15.83 21.24L14.59 21.66L13.04 19.93L12.00 20.00L10.69 21.91L9.41 21.66L8.94 19.39L8.00 18.93L5.91 19.93L4.93 19.07L5.65 16.87L5.07 16.00L2.76 15.83L2.34 14.59L4.07 13.04L4.00 12.00L2.09 10.69L2.34 9.41L4.61 8.94L5.07 8.00L4.07 5.91L4.93 4.93L7.13 5.65L8.00 5.07L8.17 2.76L9.41 2.34L10.96 4.07Z M16 12a4 4 0 1 0-8 0a4 4 0 1 0 8 0Z"/>',
  info: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v7M12 7h.01" stroke="currentColor" stroke-width="2.8"/>',
  chat: '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-9 14L1 23l7-2A10 10 0 1 0 12 2Z"/><path d="M7 7c1 5 4 8 9 9l2-3-4-2-1 2-2-2 2-1-2-4Z" fill="#12c96b" stroke="none"/>',
  navigation: '<path fill="#93d6ed" stroke="none" d="M2 2h20v20H2Z"/><path d="m2 17 8-8 12 1M8 2l5 20" stroke="white" stroke-width="3"/><path d="M3 4h5v4H3ZM16 14h5v7h-5Z" fill="#64c88a" stroke="none"/><path d="m12 5 7 14-7-4-7 4Z" fill="#007dff" stroke="white" stroke-width="1"/>',
  googlemaps: '<path fill="#34a853" stroke="none" d="M12 1a9 9 0 0 0-9 9c0 7 9 13 9 13s9-6 9-13a9 9 0 0 0-9-9Z"/><path fill="#4285f4" stroke="none" d="M3 10a9 9 0 0 1 9-9v9Z"/><path fill="#fbbc04" stroke="none" d="m3 10 9 0-6 8Z"/><path fill="#ea4335" stroke="none" d="M12 1a9 9 0 0 1 9 9h-9Z"/><circle cx="12" cy="10" r="3.5" fill="white" stroke="none"/>',
  speedometer: '<path d="M3 19a10 10 0 1 1 18 0M4 15l2 1M5 7l2 2M12 3v3M19 7l-2 2M20 15l-2 1M12 15l4-6" stroke="currentColor" stroke-width="2.3" fill="none"/><circle cx="12" cy="15" r="2.4" fill="currentColor" stroke="none"/>',
  usb: '<path d="M12 21V4M12 16l-6-4V8M12 13l6-4V6" stroke="currentColor" stroke-width="2" fill="none"/><path fill="currentColor" stroke="none" d="m12 1-3 5h6Z M16 3h4v4h-4Z"/><circle cx="6" cy="7" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="21" r="2" fill="currentColor" stroke="none"/>',
  play: '<path d="m7 3 14 9-14 9Z" fill="currentColor" stroke="none"/>',
  previous: '<path d="M3 3h3v18H3ZM21 3 7 12l14 9Z" fill="currentColor" stroke="none"/>',
  next: '<path d="M18 3h3v18h-3ZM3 3l14 9-14 9Z" fill="currentColor" stroke="none"/>',
  spectrumBrand: '<rect x="1" y="12" width="3" height="10" rx="1" fill="#25d8ff" stroke="none"/><rect x="6" y="7" width="3" height="15" rx="1" fill="#20edb3" stroke="none"/><rect x="11" y="2" width="3" height="20" rx="1" fill="#ffe45c" stroke="none"/><rect x="16" y="8" width="3" height="14" rx="1" fill="#ff8a3d" stroke="none"/><rect x="21" y="14" width="2" height="8" rx="1" fill="#ff4f8b" stroke="none"/>',
  vuBrand: '<rect x="1" y="3" width="22" height="18" rx="4" fill="#ff573f" stroke="#ffb15c" stroke-width="1.2"/><path d="M5 15a7 7 0 0 1 14 0" fill="none" stroke="#51180f" stroke-width="1.7"/><path d="m6 12-2-1m5-2-1-2m4 1V5m3 4 1-2m2 5 2-1" fill="none" stroke="#651c12" stroke-width="1.2"/><path d="m12 16 5-7" fill="none" stroke="#fff1d6" stroke-width="1.8"/><circle cx="12" cy="16" r="2" fill="#4d150e" stroke="none"/>',
  radioBrand: '<rect x="1" y="5" width="22" height="17" rx="4" fill="#f33b69" stroke="none"/><path d="M5 5 19 1" fill="none" stroke="#ffd44f" stroke-width="2" stroke-linecap="round"/><rect x="4" y="8" width="16" height="3" rx="1.5" fill="#fff" stroke="none"/><circle cx="8" cy="16" r="3" fill="#ffcf3f" stroke="#fff" stroke-width="1"/><circle cx="8" cy="16" r="1" fill="#662038" stroke="none"/><rect x="14" y="14" width="6" height="1.8" rx=".9" fill="#fff" stroke="none"/><rect x="14" y="18" width="6" height="1.8" rx=".9" fill="#fff" stroke="none"/>',
  folderBrand: '<path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H10l2.4 3H21a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H4a2 2 0 0 1-2-2Z" fill="#ffb300" stroke="none"/><path d="M2 9h21l-2 11.5A2 2 0 0 1 19 22H4a2 2 0 0 1-2-2Z" fill="#ffd54f" stroke="none"/><path d="M5 12h14" stroke="#fff3bd" stroke-width="1.6" stroke-linecap="round"/>',
  jellyfinBrand: '<path d="M12 1.5c-3.7 0-9.9 12.4-8.7 16.8 1.1 4 16.3 4 17.4 0C21.9 13.9 15.7 1.5 12 1.5Z" fill="#7652d6" stroke="none"/><path d="M12 6c-2.1 0-5.5 7.2-4.8 9.7.6 2.2 9 2.2 9.6 0C17.5 13.2 14.1 6 12 6Z" fill="#b75cff" stroke="none"/><path d="M12 10c-1 0-2.7 3.6-2.4 4.8.3 1.1 4.5 1.1 4.8 0C14.7 13.6 13 10 12 10Z" fill="#41c8ff" stroke="none"/>',
  queueBrand: '<rect x="2" y="3" width="15" height="3" rx="1.5" fill="#25d8ff" stroke="none"/><rect x="2" y="10" width="15" height="3" rx="1.5" fill="#20edb3" stroke="none"/><rect x="2" y="17" width="10" height="3" rx="1.5" fill="#ffe45c" stroke="none"/><path d="M18 8v10.5a3 3 0 1 1-2-2.83V10l6-2v8.5a3 3 0 1 1-2-2.83V7.3Z" fill="#ff5f94" stroke="none"/>',
  pinBrand: '<path d="M12 1.5a9 9 0 0 0-9 9c0 6.8 9 12 9 12s9-5.2 9-12a9 9 0 0 0-9-9Z" fill="#1c8cff" stroke="none"/><path d="M3.4 8A9 9 0 0 1 12 1.5V10Z" fill="#2ed7ff" stroke="none"/><path d="m12 10 8.6-2a9 9 0 0 1 .4 2.5c0 6.8-9 12-9 12Z" fill="#6d5cff" stroke="none"/><circle cx="12" cy="10" r="4" fill="#fff" stroke="none"/><circle cx="12" cy="10" r="2" fill="#0a5fd8" stroke="none"/>',
  phoneBrand: '<rect x="1" y="1" width="22" height="22" rx="6" fill="#20d66b" stroke="none"/><path d="M6 4h4l2 5-3 2c1.5 3 3.5 5 6.5 6.5l2-3 4.5 2V20c0 2-2 3-4 2C9 20 4 15 2 7c-.5-2 1-3 4-3Z" fill="#fff" stroke="none"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${artwork[name] || `<path d="${paths[name] || paths.music}"/>`}</svg>`;
}
export function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
