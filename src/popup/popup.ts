/**
 * Logique du popup (P1.4) : chaque `button[role="switch"][data-setting]` est relié au réglage booléen
 * du même nom. L'état est relu depuis le stockage, donc identique dans tous les contextes.
 */
import type { Logger } from '../shared/logger';
import type { Settings, SettingsStore } from '../shared/settings';

type BooleanSetting = 'enabled' | 'diagnostic' | 'showUnverified';
const BOOLEAN_SETTINGS: readonly BooleanSetting[] = ['enabled', 'diagnostic', 'showUnverified'];

const isBooleanSetting = (value: string | undefined): value is BooleanSetting =>
  BOOLEAN_SETTINGS.some((s) => s === value);

interface Switch {
  key: BooleanSetting;
  button: HTMLButtonElement;
  state: HTMLElement | null;
}

function findSwitches(doc: Document): Switch[] {
  return [...doc.querySelectorAll<HTMLButtonElement>('button[role="switch"][data-setting]')].flatMap((button) => {
    const key = button.dataset['setting'];
    if (!isBooleanSetting(key)) return [];
    const stateId = button.getAttribute('aria-describedby');
    return [{ key, button, state: stateId ? doc.getElementById(stateId) : null }];
  });
}

function render(switches: readonly Switch[], settings: Settings): void {
  for (const { key, button, state } of switches) {
    const on = settings[key];
    button.setAttribute('aria-checked', String(on));
    button.removeAttribute('aria-disabled');
    button.removeAttribute('aria-busy');
    if (state) state.textContent = (on ? state.dataset['on'] : state.dataset['off']) ?? '';
  }
}

/** Initialise le popup ; renvoie la fonction qui le détache du stockage. */
export async function initPopup(doc: Document, store: SettingsStore, logger: Logger): Promise<() => void> {
  const switches = findSwitches(doc);
  const error = doc.getElementById('error');
  let current = await store.load();
  render(switches, current);
  logger.event('popup:open', { enabled: current.enabled });

  for (const { key, button } of switches) {
    button.addEventListener('click', () => {
      // `aria-busy` plutôt que `disabled` : un bouton désactivé perd le focus clavier.
      if (button.getAttribute('aria-busy') === 'true' || button.getAttribute('aria-disabled') === 'true') return;
      button.setAttribute('aria-busy', 'true');
      if (error) error.hidden = true;
      store.update({ [key]: !current[key] }).then(
        (saved) => {
          current = saved;
          render(switches, saved);
          logger.event('popup:setting-changed', { [key]: saved[key] });
        },
        () => {
          render(switches, current);
          if (error) error.hidden = false;
        },
      );
    });
  }

  return store.subscribe((next) => {
    current = next;
    render(switches, next);
  });
}
