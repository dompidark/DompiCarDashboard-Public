// Library browsing only: authentication stays in jellyfin.js unchanged.
export async function collectPages(fetchPage, valid = () => true) {
  const items = [],
    seen = new Set();
  let start = 0;
  for (let page = 0; page < 1000; page++) {
    const result = await fetchPage(start);
    if (!valid()) throw Error("Selezione cambiata: raccolta annullata.");
    const batch = result.Items || [];
    let added = 0;
    for (const item of batch)
      if (!seen.has(item.PlaylistItemId || item.Id)) {
        seen.add(item.PlaylistItemId || item.Id);
        items.push(item);
        added++;
      }
    start += batch.length;
    if (!batch.length || start >= Number(result.TotalRecordCount ?? Infinity))
      return items;
    if (!added)
      throw Error(
        "Il server ripete la stessa pagina. Nessuna coda parziale avviata.",
      );
    if (result.TotalRecordCount == null && batch.length < 100) return items;
  }
  throw Error(
    "Selezione troppo ampia: restringi il filtro. Nessuna coda parziale avviata.",
  );
}
export async function jellyfinTracks(
  jf,
  filter,
  selected = null,
  valid = () => true,
) {
  const expand = async (item) => {
    if (item.Type === "Audio") return [item];
    if (item.Type === "Playlist")
      return collectPages((start) => jf.playlist(item.Id, start), valid);
    if (item.Type === "MusicArtist")
      return collectPages((start) => jf.artistTracks(item.Id, start), valid);
    return collectPages(
      (start) => jf.search(item.Id, "", "Audio", start),
      valid,
    );
  };
  if (selected) return expand(selected);
  const matching = await collectPages(
    (start) => jf.search(filter.parent, filter.term, filter.type, start),
    valid,
  );
  if (filter.type === "Audio") return matching;
  const out = [],
    seen = new Set();
  for (const item of matching) {
    for (const track of await expand(item))
      if (!seen.has(track.Id)) {
        seen.add(track.Id);
        out.push(track);
      }
    if (!valid()) throw Error("Selezione cambiata.");
  }
  return out;
}
