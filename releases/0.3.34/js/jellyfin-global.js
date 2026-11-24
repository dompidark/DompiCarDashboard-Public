export const jellyfinGlobalDefaults = Object.freeze({
  pageSize: 500,
  initialSize: 200,
  refillSize: 200,
  refillThreshold: 50,
  historySize: 100,
});

function abortError() {
  return new DOMException("Operazione annullata", "AbortError");
}

export function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] || 1;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleJellyfinIds(ids, seed = randomSeed()) {
  const order = [...ids];
  const random = seededRandom(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, seed: seed >>> 0 };
}

export class JellyfinGlobalSequence {
  constructor(
    ids,
    {
      seed = randomSeed(),
      cursor = 0,
      cycle = 1,
      lastId = "",
      seedSource = randomSeed,
    } = {},
  ) {
    this.ids = [...ids];
    this.seedSource = seedSource;
    this.cycle = Math.max(1, Number(cycle) || 1);
    this.lastId = typeof lastId === "string" ? lastId : "";
    this.reset(seed, cursor);
  }

  reset(seed = this.seedSource(), cursor = 0) {
    const shuffled = shuffleJellyfinIds(this.ids, seed);
    this.order = shuffled.order;
    this.seed = shuffled.seed;
    this.cursor = Math.max(
      0,
      Math.min(Number(cursor) || 0, this.order.length),
    );
    if (
      this.cursor === 0 &&
      this.order.length > 1 &&
      this.lastId &&
      this.order[0] === this.lastId
    )
      [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
  }

  nextCycle() {
    this.cycle++;
    this.reset(this.seedSource(), 0);
  }

  take(count) {
    const requested = Math.max(0, Math.floor(Number(count) || 0));
    if (!requested || !this.order.length) return [];
    const result = [];
    while (result.length < requested) {
      if (this.cursor >= this.order.length) this.nextCycle();
      const id = this.order[this.cursor];
      result.push({
        id,
        position: this.cursor + 1,
        total: this.order.length,
        cycle: this.cycle,
      });
      this.cursor++;
      this.lastId = id;
    }
    return result;
  }

  snapshot() {
    return {
      seed: this.seed,
      cursor: this.cursor,
      cycle: this.cycle,
      lastId: this.lastId,
    };
  }
}

async function retryPage(operation, retries, delay, signal) {
  let failure;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw abortError();
    try {
      return await operation();
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw abortError();
      failure = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  throw failure;
}

export async function buildJellyfinIndex({
  total,
  fetchPage,
  pageSize = jellyfinGlobalDefaults.pageSize,
  retries = 2,
  retryDelay = 250,
  signal,
  onProgress = () => {},
  yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0)),
}) {
  const expected = Math.max(0, Math.floor(Number(total) || 0));
  if (!expected) {
    onProgress(0, 0);
    return [];
  }
  const ids = [],
    seen = new Set();
  let start = 0;
  while (start < expected) {
    const result = await retryPage(
      () => fetchPage(start, Math.min(pageSize, expected - start), signal),
      retries,
      retryDelay,
      signal,
    );
    if (signal?.aborted) throw abortError();
    const batch = Array.isArray(result) ? result : result?.Items || [];
    if (!batch.length)
      throw Error(
        `Indice Jellyfin incompleto: ${ids.length} di ${expected} identificativi.`,
      );
    for (const item of batch) {
      const id = typeof item === "string" ? item : item?.Id;
      if (typeof id === "string" && id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    start += batch.length;
    onProgress(ids.length, expected);
    if (ids.length > expected)
      throw Error("Jellyfin ha restituito più identificativi del totale dichiarato.");
    await yieldTask();
  }
  if (ids.length !== expected)
    throw Error(
      `Indice Jellyfin incompleto: ${ids.length} identificativi unici su ${expected}.`,
    );
  return ids;
}

export function needsJellyfinRefill(
  index,
  length,
  threshold = jellyfinGlobalDefaults.refillThreshold,
) {
  return Math.max(0, length - Math.max(0, index) - 1) <= threshold;
}

export function jellyfinHistoryDrop(
  index,
  historySize = jellyfinGlobalDefaults.historySize,
) {
  return Math.max(0, Math.max(0, index) - Math.max(0, historySize));
}
