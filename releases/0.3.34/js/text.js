// Preserve real Unicode; do not guess replacements for already corrupt server tags.
export function mediaText(value) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .normalize("NFC")
        .trim()
    : "";
}
export function decodeID3Text(data) {
  const type = data[0];
  let bytes = data.slice(1),
    encoding;
  if (type === 1) {
    encoding = bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-16le";
    if (
      (bytes[0] === 0xfe && bytes[1] === 0xff) ||
      (bytes[0] === 0xff && bytes[1] === 0xfe)
    )
      bytes = bytes.slice(2);
  } else
    encoding = type === 2 ? "utf-16be" : type === 3 ? "utf-8" : "windows-1252";
  return mediaText(
    new TextDecoder(encoding)
      .decode(bytes)
      .replace(/\0+/g, " / ")
      .replace(/(?: \/ )+$/, ""),
  );
}
