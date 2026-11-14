/**
 * Accès à `chrome.storage` pour le module de réglages. Seul fichier de `src/shared/` qui touche à `chrome.*`.
 */
import type { StorageLike } from './settings';

export function chromeStorage(): StorageLike {
  return {
    local: {
      get: (key) => chrome.storage.local.get(key),
      set: (items) => chrome.storage.local.set(items),
    },
    onChanged: {
      addListener: (listener) => chrome.storage.onChanged.addListener(listener),
      removeListener: (listener) => chrome.storage.onChanged.removeListener(listener),
    },
  };
}
