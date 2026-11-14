/**
 * Logique du popup (P1.4, P2.6, P5) : chaque `button[role="switch"][data-setting]` est relié à un réglage.
 * L'état est relu depuis le stockage, donc identique dans tous les contextes.
 * Quand la traduction est active, le popup demande les compteurs de la page au script de contenu : un résumé
 * (textes en éton, dont non vérifiés, et textes qui restent à traduire : P5.6, P5.10) et, en mode diagnostic,
 * le détail par statut.
 */
import type { Logger } from '../shared/logger';
import { COUNT_KEYS, isDiagnosticSnapshot, type DiagnosticSnapshot, type EngineKind } from '../shared/messages';
import type { Settings, SettingsStore } from '../shared/settings';

/** Demande les compteurs au script de contenu de l'onglet actif ; rejetée si aucun script ne répond. */
export type RequestDiagnostic = () => Promise<unknown>;

/** Interrupteurs : un réglage booléen, ou le mode bilingue (réglage `displayMode`). */
const SWITCH_KEYS = ['enabled', 'showUnverified', 'bilingual', 'diagnostic'] as const;
type SwitchKey = (typeof SWITCH_KEYS)[number];

interface SwitchSetting {
  read(settings: Settings): boolean;
  patch(on: boolean): Partial<Settings>;
}

const flag = (key: 'enabled' | 'diagnostic' | 'showUnverified'): SwitchSetting => ({
  read: (settings) => settings[key],
  patch: (on) => ({ [key]: on }),
});

const SWITCH_SETTINGS: Readonly<Record<SwitchKey, SwitchSetting>> = {
  enabled: flag('enabled'),
  showUnverified: flag('showUnverified'),
  bilingual: { read: (settings) => settings.displayMode === 'bilingual', patch: (on) => ({ displayMode: on ? 'bilingual' : 'replace' }) },
  diagnostic: flag('diagnostic'),
};

const isSwitchKey = (value: string | undefined): value is SwitchKey => SWITCH_KEYS.some((key) => key === value);

interface Switch {
  key: SwitchKey;
  button: HTMLButtonElement;
  state: HTMLElement | null;
}

function findSwitches(doc: Document): Switch[] {
  return [...doc.querySelectorAll<HTMLButtonElement>('button[role="switch"][data-setting]')].flatMap((button) => {
    const key = button.dataset['setting'];
    if (!isSwitchKey(key)) return [];
    const stateId = button.getAttribute('aria-describedby');
    return [{ key, button, state: stateId ? doc.getElementById(stateId) : null }];
  });
}

function render(switches: readonly Switch[], settings: Settings): void {
  for (const { key, button, state } of switches) {
    const on = SWITCH_SETTINGS[key].read(settings);
    button.setAttribute('aria-checked', String(on));
    button.removeAttribute('aria-disabled');
    button.removeAttribute('aria-busy');
    if (state) state.textContent = (on ? state.dataset['on'] : state.dataset['off']) ?? '';
  }
}

const ENGINE_LABELS: Record<EngineKind, string> = {
  none: 'aucun (version sans moteur)',
  fake: 'faux moteur de test',
  finethnic: 'FinEthnic',
};

const UNAVAILABLE =
  "Diagnostic indisponible dans cet onglet. Ouvrez l'environnement de test SAFINUM Pay, rechargez la page, puis réessayez.";

const SUMMARY_UNAVAILABLE =
  "Pour voir les textes traduits, ouvrez l'environnement de test SAFINUM Pay dans cet onglet, rechargez la page, puis rouvrez ce menu.";

/** Résumé de la page (P5.6, P5.10) : nombres seulement, aucun texte de la page. */
export function summaryText(snapshot: DiagnosticSnapshot): string {
  if (!snapshot.enabled) return 'La traduction est désactivée : la page reste en français.';
  if (snapshot.engine === 'none') return 'Aucun moteur de traduction dans cette version : la page reste en français.';
  const { candidates, displayed, displayedUnverified } = snapshot.counts;
  const remaining = Math.max(0, candidates - displayed);
  return `${displayed} texte(s) affiché(s) en éton, dont ${displayedUnverified} non vérifié(s). ${remaining} texte(s) restent à traduire.`;
}

/** Résumé et rapport de diagnostic de la page : compteurs seulement, aucun texte de la page. */
function createPageView(doc: Document, request: RequestDiagnostic, logger: Logger) {
  const summary = doc.getElementById('summary');
  const summaryStatus = doc.getElementById('summary-status');
  const section = doc.getElementById('report');
  const status = doc.getElementById('report-status');
  const list = doc.getElementById('report-counts');
  const refreshButton = doc.getElementById('report-refresh');
  let pending = 0;

  const visible = (): boolean => (summary !== null && !summary.hidden) || (section !== null && !section.hidden);

  const show = (message: string, counts: boolean): void => {
    if (status) status.textContent = message;
    if (list) list.hidden = !counts;
  };

  const refresh = async (): Promise<void> => {
    if (!visible()) return;
    const call = ++pending;
    refreshButton?.setAttribute('aria-busy', 'true');
    if (summaryStatus) summaryStatus.textContent = 'Lecture de la page…';
    show('Lecture de la page…', false);
    const snapshot = await request().catch(() => undefined);
    // Seule la dernière demande est affichée.
    if (call !== pending) return;
    refreshButton?.removeAttribute('aria-busy');
    const available = isDiagnosticSnapshot(snapshot);
    logger.event('popup:diagnostic', { available });
    if (summaryStatus) summaryStatus.textContent = available ? summaryText(snapshot) : SUMMARY_UNAVAILABLE;
    if (!available) return show(UNAVAILABLE, false);
    if (!snapshot.enabled) return show("La traduction est désactivée : la page n'est pas analysée.", false);
    for (const key of COUNT_KEYS) {
      const cell = doc.querySelector(`#report-counts [data-count="${key}"]`);
      if (cell) cell.textContent = String(snapshot.counts[key]);
    }
    const step = doc.querySelector('#report-counts [data-field="step"]');
    if (step) step.textContent = snapshot.step === 0 ? 'inconnue' : `${snapshot.step} sur 5`;
    const engine = doc.querySelector('#report-counts [data-field="engine"]');
    if (engine) engine.textContent = ENGINE_LABELS[snapshot.engine];
    show(`${snapshot.counts.candidates} texte(s) à traduire détecté(s) dans la page.`, true);
  };

  refreshButton?.addEventListener('click', () => {
    if (refreshButton.getAttribute('aria-busy') !== 'true') void refresh();
  });

  return {
    refresh,
    /**
     * Affiche le résumé si la traduction est active, le rapport en mode diagnostic. Relit la page à l'ouverture,
     * quand le rapport apparaît, et quand la traduction ou une option d'affichage change.
     */
    update(previous: Settings | null, next: Settings): void {
      if (summary) summary.hidden = !next.enabled;
      if (section) section.hidden = !next.diagnostic;
      const changed =
        previous === null ||
        previous.enabled !== next.enabled ||
        previous.showUnverified !== next.showUnverified ||
        previous.displayMode !== next.displayMode ||
        (next.diagnostic && !previous.diagnostic);
      if (changed) void refresh();
    },
  };
}

const noDiagnostic: RequestDiagnostic = () => Promise.reject(new Error('indisponible'));

/** Initialise le popup ; renvoie la fonction qui le détache du stockage. */
export async function initPopup(
  doc: Document,
  store: SettingsStore,
  logger: Logger,
  requestDiagnostic: RequestDiagnostic = noDiagnostic,
): Promise<() => void> {
  const switches = findSwitches(doc);
  const error = doc.getElementById('error');
  const report = createPageView(doc, requestDiagnostic, logger);
  let current = await store.load();
  render(switches, current);
  report.update(null, current);
  logger.event('popup:open', { enabled: current.enabled });

  for (const { key, button } of switches) {
    button.addEventListener('click', () => {
      // `aria-busy` plutôt que `disabled` : un bouton désactivé perd le focus clavier.
      if (button.getAttribute('aria-busy') === 'true' || button.getAttribute('aria-disabled') === 'true') return;
      button.setAttribute('aria-busy', 'true');
      if (error) error.hidden = true;
      const setting = SWITCH_SETTINGS[key];
      store.update(setting.patch(!setting.read(current))).then(
        (saved) => {
          const previous = current;
          current = saved;
          render(switches, saved);
          report.update(previous, saved);
          logger.event('popup:setting-changed', { [key]: setting.read(saved) });
        },
        () => {
          render(switches, current);
          if (error) error.hidden = false;
        },
      );
    });
  }

  return store.subscribe((next) => {
    const previous = current;
    current = next;
    render(switches, next);
    report.update(previous, next);
  });
}
