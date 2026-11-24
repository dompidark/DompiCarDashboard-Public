import { phoneUrl } from "./core.js";
export function parseVCard(text) {
  const unescape = value => value.replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1').trim();
  const contacts = [];
  let card = null;
  for (const line of text.replace(/\r\n[ \t]|\n[ \t]/g, '').split(/\r?\n/)) {
    if (/^BEGIN:VCARD$/i.test(line)) { card = { name: '', tel: [] }; continue; }
    if (/^END:VCARD$/i.test(line)) {
      if (card?.tel.length) contacts.push(card);
      card = null; continue;
    }
    if (!card) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).split(';')[0].split('.').at(-1).toUpperCase();
    const value = unescape(line.slice(colon + 1));
    if (key === 'FN') card.name = value.slice(0, 120);
    if (key === 'N' && !card.name) card.name = value.split(';').filter(Boolean).join(' ').slice(0,120);
    if (key === 'TEL') {
      const number = value.replace(/^tel:/i, '').replace(/[\s().-]/g, '');
      if (phoneUrl(number)) card.tel.push(number);
    }
  }
  return contacts.slice(0, 1000);
}
