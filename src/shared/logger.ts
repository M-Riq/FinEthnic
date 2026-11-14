/**
 * Journal d'événements sans données (P1.6, P2.7).
 *
 * Seuls un nom d'événement connu et des compteurs ou des booléens sont acceptés : le type interdit
 * toute chaîne, donc tout texte de la page. Le journal n'écrit que dans la construction de
 * développement (`npm run build:dev`).
 */

export type LogEvent =
  | 'content:start'
  | 'content:settings-changed'
  | 'content:scan'
  | 'content:evaluate'
  | 'content:render'
  | 'content:restore'
  | 'popup:open'
  | 'popup:setting-changed'
  | 'popup:diagnostic';

export type LogData = Readonly<Record<string, number | boolean>>;

export interface Logger {
  event(name: LogEvent, data?: LogData): void;
}

declare const __FINETHNIC_DEV__: boolean | undefined;

const DEV = typeof __FINETHNIC_DEV__ !== 'undefined' && __FINETHNIC_DEV__ === true;

export function createLogger(
  scope: 'content' | 'popup',
  options: { enabled?: boolean; sink?: (...args: unknown[]) => void } = {},
): Logger {
  const enabled = options.enabled ?? DEV;
  const sink = options.sink ?? ((...args: unknown[]) => console.debug(...args));
  return {
    event(name, data) {
      if (enabled) sink(`[FinEthnic:${scope}] ${name}`, data ?? {});
    },
  };
}
