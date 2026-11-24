import { decodeID3Text } from "./text.js";
// Bounded ID3v2.3/2.4 reader: unknown formats retain filename, no invented metadata.
export async function readMetadata(file) {
  const bytes = new Uint8Array(
    await file.slice(0, 2 * 1024 * 1024).arrayBuffer(),
  );
  if (
    new TextDecoder().decode(bytes.slice(0, 3)) !== "ID3" ||
    ![3, 4].includes(bytes[3]) ||
    bytes[5] & 0xc0
  )
    return {};
  const result = {},
    sync = (a) =>
      ((a[0] & 127) << 21) |
      ((a[1] & 127) << 14) |
      ((a[2] & 127) << 7) |
      (a[3] & 127);
  const end = Math.min(bytes.length, 10 + sync(bytes.slice(6, 10)));
  for (let pos = 10; pos + 10 <= end; ) {
    const id = new TextDecoder().decode(bytes.slice(pos, pos + 4));
    const size =
      bytes[3] === 4
        ? sync(bytes.slice(pos + 4, pos + 8))
        : new DataView(bytes.buffer).getUint32(pos + 4);
    if (!size || pos + 10 + size > end) break;
    const data = bytes.slice(pos + 10, pos + 10 + size);
    pos += 10 + size;
    if (["TIT2", "TPE1", "TALB"].includes(id))
      result[{ TIT2: "title", TPE1: "artist", TALB: "album" }[id]] =
        decodeID3Text(data).slice(0, 1000);
    if (id === "APIC" && data.length > 5) {
      let i = 1;
      while (i < data.length && data[i]) i++;
      const mime = new TextDecoder().decode(data.slice(1, i));
      i += 2;
      if (data[0] === 1 || data[0] === 2) {
        while (i + 1 < data.length && (data[i] || data[i + 1])) i += 2;
        i += 2;
      } else {
        while (i < data.length && data[i]) i++;
        i++;
      }
      if (
        ["image/jpeg", "image/png", "image/webp"].includes(mime) &&
        i < data.length
      ) {
        result.coverBlob = new Blob([data.slice(i)], { type: mime });
        result.cover = URL.createObjectURL(result.coverBlob);
      }
    }
  }
  return result;
}
