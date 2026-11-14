/**
 * Logique du popup (P1.4, P2.6) : chaque `button[role="switch"][data-setting]` est relié au réglage booléen
 * du même nom. L'état est relu depuis le stockage, donc identique dans tous les contextes.
 * En mode diagnostic, le popup affiche les compteurs de la page, demandés au script de contenu.
 */
import type { Logger } from '../shared/logger';
import { COUNT_KEYS, isDiagnosticSnapshot, type EngineKind } from '../shared/messages';
import type { Settings, SettingsStore } from '../shared/settings';

/** Demande les compteurs au script de contenu de l'onglet actif ; rejetée si aucun script ne répond. */
export type RequestDiagnostic = () => Promise<unknown>;

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

const ENGINE_LABELS: Record<EngineKind, string> = {
  none: 'aucun (version sans moteur)',
  fake: 'faux moteur de test',
  finethnic: 'FinEthnic',
};

const UNAVAILABLE =
  "Diagnostic indisponible dans cet onglet. Ouvrez l'environnement de test SAFINUM Pay, rechargez la page, puis réessayez.";

/** Rapport de diagnostic : compteurs seulement, aucun texte de la page. */
function createReport(doc: Document, request: RequestDiagnostic, logger: Logger) {
  const section = doc.getElementById('report');
  const status = doc.getElementById('report-status');
  const list = doc.getElementById('report-counts');
  const refreshButton = doc.getElementById('report-refresh');
  let pending = 0;

  const show = (message: string, counts: boolean): void => {
    if (status) status.textContent = message;
    if (list) list.hidden = !counts;
  };

  const refresh = async (): Promise<void> => {
    if (!section || section.hidden) return;
    const call = ++pending;
    refreshButton?.setAttribute('aria-busy', 'true');
    show('Lecture de la page…', false);
    const snapshot = await request().catch(() => undefined);
    // Seule la dernière demande est affichée.
    if (call !== pending) return;
    refreshButton?.removeAttribute('aria-busy');
    const available = isDiagnosticSnapshot(snapshot);
    logger.event('popup:diagnostic', { available });
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
    /** Affiche ou masque le rapport ; le relit s'il vient d'apparaître ou si `enabled` a changé. */
    update(previous: Settings | null, next: Settings): void {
      if (!section) return;
      section.hidden = !next.diagnostic;
      if (next.diagnostic && (!previous?.diagnostic || previous.enabled !== next.enabled)) void refresh();
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
  const report = createReport(doc, requestDiagnostic, logger);
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
      store.update({ [key]: !current[key] }).then(
        (saved) => {
          const previous = current;
          current = saved;
          render(switches, saved);
          report.update(previous, saved);
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
    const previous = current;
    current = next;
    render(switches, next);
    report.update(previous, next);
  });
}
