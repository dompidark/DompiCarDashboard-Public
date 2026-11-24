// User imports, contacts and optional remembered Jellyfin session. Database name isolates /car/ from /car-test/.
const scope = new URL("./", document.baseURI).pathname;
let opened;
function database() {
  return (opened ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(`dompi-library:${scope}`, 1);
    request.onupgradeneeded = () => {
      for (const name of ["tracks", "meta", "images"])
        request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        opened = null;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      opened = null;
      reject(request.error);
    };
    request.onblocked = () =>
      reject(Error("Chiudi le altre finestre Dompi e riprova."));
  }));
}
async function transaction(store, mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    const request = operation(tx.objectStore(store));
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () =>
      reject(
        tx.error || request.error || Error("Archivio locale non disponibile"),
      );
  });
}
export const localStore = {
  all: (store = "tracks") => transaction(store, "readonly", (s) => s.getAll()),
  get: (store, id) => transaction(store, "readonly", (s) => s.get(id)),
  put: (store, value) => transaction(store, "readwrite", (s) => s.put(value)),
  remove: (store, id) => transaction(store, "readwrite", (s) => s.delete(id)),
};
export function storageError(error) {
  return error?.name === "QuotaExceededError"
    ? "Spazio del browser esaurito. Libera spazio o rimuovi brani: quelli già importati restano disponibili."
    : "Archivio locale non disponibile. Verifica spazio e autorizzazioni del browser. Nessun salvataggio garantito.";
}
export async function availableSpace(bytes) {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (estimate?.quota && bytes > estimate.quota - (estimate.usage || 0))
    throw new DOMException("Spazio insufficiente", "QuotaExceededError");
}
