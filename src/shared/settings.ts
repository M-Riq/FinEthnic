/**
 * Réglages de l'extension (P1.5), rangés dans `chrome.storage.local` sous une seule clé.
 *
 * - `enabled` : traduction active sur la page de test.
 * - `displayMode` : 'replace' (l'éton remplace le français, français au survol et au focus, Q3)
 *   ou 'bilingual' (éton et français).
 * - `diagnostic` : surlignage des textes détectés et compteurs détaillés.
 * - `showUnverified` : affichage des traductions non vérifiées, avec un marqueur (Q9, contrat §5.4).
 *
 * Aucune donnée de la page n'est jamais rangée ici.
 */

export type DisplayMode = 'replace' | 'bilingual';

export interface Settings {
  enabled: boolean;
  displayMode: DisplayMode;
  diagnostic: boolean;
  showUnverified: boolean;
}

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  enabled: true,
  displayMode: 'replace',
  diagnostic: false,
  // Contrat §5.4-1 : option activée par défaut.
  showUnverified: true,
});

const DISPLAY_MODES: readonly DisplayMode[] = ['replace', 'bilingual'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Lit des réglages venus du stockage. Un champ absent ou invalide prend sa valeur par défaut. */
export function parseSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {};
  const bool = (key: 'enabled' | 'diagnostic' | 'showUnverified'): boolean => {
    const value = r[key];
    return typeof value === 'boolean' ? value : DEFAULT_SETTINGS[key];
  };
  return {
    enabled: bool('enabled'),
    displayMode: DISPLAY_MODES.find((m) => m === r['displayMode']) ?? DEFAULT_SETTINGS.displayMode,
    diagnostic: bool('diagnostic'),
    showUnverified: bool('showUnverified'),
  };
}

export type StorageChangeListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;

/** Partie de `chrome.storage` utilisée ici (remplaçable par un faux stockage dans les tests). */
export interface StorageLike {
  local: {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  };
  onChanged: {
    addListener(listener: StorageChangeListener): void;
    removeListener(listener: StorageChangeListener): void;
  };
}

export interface SettingsStore {
  load(): Promise<Settings>;
  /** Modifie certains réglages et renvoie l'état enregistré. Les appels sont traités l'un après l'autre. */
  update(patch: Partial<Settings>): Promise<Settings>;
  /** Appelé à chaque changement enregistré, y compris depuis un autre contexte (popup ⇄ page). */
  subscribe(listener: (settings: Settings) => void): () => void;
}

export function createSettingsStore(storage: StorageLike): SettingsStore {
  let queue: Promise<unknown> = Promise.resolve();

  const load = async (): Promise<Settings> => parseSettings((await storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]);

  return {
    load,
    update(patch) {
      const run = async (): Promise<Settings> => {
        const next = parseSettings({ ...(await load()), ...patch });
        await storage.local.set({ [SETTINGS_KEY]: next });
        return next;
      };
      const result = queue.then(run, run);
      queue = result.catch(() => undefined);
      return result;
    },
    subscribe(listener) {
      const onChanged: StorageChangeListener = (changes, areaName) => {
        const change = changes[SETTINGS_KEY];
        if (areaName === 'local' && change) listener(parseSettings(change.newValue));
      };
      storage.onChanged.addListener(onChanged);
      return () => storage.onChanged.removeListener(onChanged);
    },
  };
}
