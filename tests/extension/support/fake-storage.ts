import type { StorageChangeListener, StorageLike } from '../../../src/shared/settings';

/** Faux `chrome.storage` en mémoire : `set` notifie les abonnés comme Chrome (zone 'local'). */
export function createFakeStorage(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(structuredClone(initial)));
  const listeners = new Set<StorageChangeListener>();
  let failNextSet = false;
  let setCalls = 0;

  const storage: StorageLike = {
    local: {
      async get(key) {
        return data.has(key) ? { [key]: structuredClone(data.get(key)) } : {};
      },
      async set(items) {
        setCalls++;
        if (failNextSet) {
          failNextSet = false;
          throw new Error('quota');
        }
        const changes: Record<string, { newValue?: unknown }> = {};
        for (const [key, value] of Object.entries(items)) {
          data.set(key, structuredClone(value));
          changes[key] = { newValue: structuredClone(value) };
        }
        queueMicrotask(() => listeners.forEach((l) => l(changes, 'local')));
      },
    },
    onChanged: {
      addListener: (l) => void listeners.add(l),
      removeListener: (l) => void listeners.delete(l),
    },
  };

  return {
    storage,
    data,
    listenerCount: () => listeners.size,
    setCalls: () => setCalls,
    failNextSet: () => {
      failNextSet = true;
    },
    /** Simule un changement venu d'un autre contexte (popup ⇄ page) ou d'une autre zone. */
    emit: (changes: Record<string, { newValue?: unknown }>, area = 'local') => listeners.forEach((l) => l(changes, area)),
  };
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
