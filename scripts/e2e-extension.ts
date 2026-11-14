/**
 * Banc de test de l'extension dans Chrome (P6 parcours, P7 contenu inédit et charge, audit P8.3–8.4).
 *
 *   npm run e2e-extension -- [--dist <dossier>] [--chrome <chemin>]
 *
 * Sans `--dist`, construit l'extension de production avec le vrai moteur (D7 importé, comme `npm run build`)
 * dans un dossier temporaire. Le bundle testé est celui de production ; seul le `manifest.json` de la copie
 * testée est élargi à `http://127.0.0.1/*`, où la page de test `tests/fixtures/safinum-test.html` est servie.
 *
 * Chrome est lancé sans interface avec un profil jetable ; tout est piloté par CDP (`scripts/lib/cdp.ts`) et
 * observé depuis la page par une sonde (`scripts/lib/e2e-probe.js`) : le banc ne voit que le DOM, comme
 * l'application. Chaque vérification affiche OK ou ÉCHEC ; code de sortie 1 si une vérification échoue,
 * 2 si Chrome est introuvable.
 *
 * Les attentes de la partie « scénario » sont celles de `tests/e2e/engine-scenario.json` (contrat §5.4),
 * appliquées par l'extension dans la page.
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { DIAGNOSTIC_REQUEST, type DiagnosticSnapshot } from '../src/shared/messages';
import { Tab, findChrome, launchChrome, type Cdp } from './lib/cdp';
import { readLibraryEntries } from './lib/data-files';
import { loadScenario } from './lib/e2e-scenario';
import { corpusEntries } from './lib/engine-corpus';
import { withSynonymAdditions } from './lib/engine-load';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'tests/fixtures');
const FIXTURE = 'safinum-test.html';
const TEST_MATCH = 'http://127.0.0.1/*';

/** Durée sans mutation et sans texte en attente au bout de laquelle la page est considérée stable. */
const QUIET_MS = 400;
const LOAD_NODES = 500;
const LOAD_BUDGET_MS = 200;
const DETECT_BUDGET_MS = 100;

interface Settings {
  enabled: boolean;
  displayMode: 'replace' | 'bilingual';
  diagnostic: boolean;
  showUnverified: boolean;
}
const DEFAULT_SETTINGS: Settings = { enabled: true, displayMode: 'replace', diagnostic: false, showUnverified: true };

interface Snapshot {
  html: string;
  skeleton: string;
  values: string[];
  step: number;
  outside: string[];
  texts: string[];
  valueLike: boolean[];
  marks: string[] | null;
}
interface MutationSummary {
  total: number;
  byType: Record<string, number>;
  structural: string[];
  lastAt: number | null;
  lastTextAt: number;
}
interface Item {
  text: string;
  mark: string | null;
  firstWriteAt: number | null;
}
interface Injected {
  tag?: string;
  text?: string;
  attrs?: Record<string, string>;
}

interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}
const checks: Check[] = [];
const metrics: string[] = [];

function check(id: string, label: string, ok: boolean, detail = ''): boolean {
  checks.push({ id, label, ok, detail });
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${id.padEnd(10)} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function metric(line: string): void {
  metrics.push(line);
  console.log(`       ${''.padEnd(10)} ${line}`);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const ms = (value: number): string => `${Math.round(value)} ms`;

/** Valeurs à protéger dans un texte : nombres (signe et séparateurs compris) et sigles (FCFA, CM, SAF-…). */
function protectedTokens(text: string): string[] {
  return text.match(/[+\-−]?\d(?:[\d\u0020\u00a0\u202f.,]*\d)?|\b[A-Z]{2,}(?:-[A-Z0-9]+)*\b/gu) ?? [];
}

/** Écarts entre l'état de référence (extension désactivée) et l'état traduit d'une même étape. */
function compareStep(ref: Snapshot, cur: Snapshot): { problems: string[]; changed: number; unmarked: number } {
  const problems: string[] = [];
  if (cur.step !== ref.step) problems.push(`étape ${cur.step} au lieu de ${ref.step}`);
  if (cur.skeleton !== ref.skeleton) problems.push('structure HTML différente (balises, attributs ou nœuds)');
  if (JSON.stringify(cur.values) !== JSON.stringify(ref.values)) problems.push(`valeurs des champs différentes : ${JSON.stringify(cur.values)}`);
  if (JSON.stringify(cur.outside) !== JSON.stringify(ref.outside)) problems.push(`éléments hors de <body> : ${cur.outside.join(', ')}`);
  if (cur.texts.length !== ref.texts.length) return { problems: [...problems, 'nombre de textes différent'], changed: 0, unmarked: 0 };
  let changed = 0;
  let unmarked = 0;
  ref.texts.forEach((before, i) => {
    const after = cur.texts[i] ?? '';
    if (after === before) return;
    changed++;
    if (ref.valueLike[i]) problems.push(`valeur modifiée : « ${before} » → « ${after} »`);
    else if (JSON.stringify(protectedTokens(after)) !== JSON.stringify(protectedTokens(before))) problems.push(`jeton protégé modifié : « ${before} » → « ${after} »`);
    if (cur.marks !== null && !cur.marks[i]) unmarked++;
  });
  return { problems, changed, unmarked };
}

/** Textes de D8 (termes et synonymes), distincts et sans valeur, pour le test de charge. */
function corpusTexts(): string[] {
  const corpus = withSynonymAdditions(ROOT, corpusEntries(readLibraryEntries(ROOT).entries));
  const texts = new Set<string>();
  for (const entry of corpus) for (const text of [entry.text, ...entry.synonyms]) if (!/[\d{}]/u.test(text)) texts.add(text);
  return [...texts];
}

async function prepareExtension(work: string, dist: string | undefined): Promise<string> {
  const dir = path.join(work, 'extension');
  if (dist) {
    await cp(path.resolve(dist), dir, { recursive: true });
  } else {
    const build = (await import(pathToFileURL(path.join(ROOT, 'build.mjs')).href)) as {
      buildExtension(options: { dev: boolean; outDir: string; engine: 'real' }): Promise<string[]>;
    };
    await build.buildExtension({ dev: false, outDir: dir, engine: 'real' });
  }
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { content_scripts: Array<{ matches: string[] }> };
  for (const script of manifest.content_scripts) if (!script.matches.includes(TEST_MATCH)) script.matches.push(TEST_MATCH);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

function serveFixtures(): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/+/u, '');
    const file = path.join(FIXTURES, name);
    if (!name || path.dirname(file) !== FIXTURES || !name.endsWith('.html')) {
      res.writeHead(404).end();
      return;
    }
    readFile(file).then(
      (body) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(body),
      () => res.writeHead(404).end(),
    );
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

class Bench {
  private readonly pageSessions = new Set<string>();
  readonly requests: string[] = [];
  readonly errors: string[] = [];

  constructor(
    readonly cdp: Cdp,
    readonly control: Tab,
    readonly probe: string,
    readonly url: string,
  ) {
    cdp.on((method, params, sessionId) => {
      if (!sessionId || !this.pageSessions.has(sessionId)) return;
      if (method === 'Network.requestWillBeSent') {
        this.requests.push(String((params['request'] as { url: string }).url));
      } else if (method === 'Runtime.exceptionThrown') {
        const details = params['exceptionDetails'] as { text: string; exception?: { description?: string } };
        this.errors.push(details.exception?.description ?? details.text);
      } else if (method === 'Runtime.consoleAPICalled' && (params['type'] === 'error' || params['type'] === 'warning')) {
        this.errors.push(`console.${String(params['type'])} : ${JSON.stringify(params['args'])}`);
      }
    });
  }

  async settings(partial: Partial<Settings>): Promise<void> {
    await this.control.evaluate(`chrome.storage.local.set({ settings: ${JSON.stringify({ ...DEFAULT_SETTINGS, ...partial })} })`);
  }

  /** Compteurs du script de contenu, demandés comme le popup (une seule page de test ouverte). */
  async diagnostic(): Promise<DiagnosticSnapshot | null> {
    const found = await this.control.evaluate<DiagnosticSnapshot[]>(`(async () => {
      const out = [];
      for (const tab of await chrome.tabs.query({})) {
        try {
          const r = await chrome.tabs.sendMessage(tab.id, { type: ${JSON.stringify(DIAGNOSTIC_REQUEST)} });
          if (r) out.push(r);
        } catch {}
      }
      return out;
    })()`);
    return found[0] ?? null;
  }

  async openPage(): Promise<Tab> {
    const tab = await Tab.open(this.cdp, { probe: this.probe });
    this.pageSessions.add(tab.sessionId);
    await tab.navigate(this.url);
    for (let i = 0; i < 100 && !(await this.diagnostic()); i++) await sleep(100);
    if (!(await this.diagnostic())) throw new Error('Le script de contenu ne répond pas sur la page de test');
    return tab;
  }

  /** Attend que l'extension ait tout évalué et que la page ne bouge plus. */
  async settle(tab: Tab, timeoutMs = 20_000): Promise<DiagnosticSnapshot> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const diag = await this.diagnostic();
      const [now, last] = await tab.evaluate<[number, number]>('[__probe.now(), __probe.lastMutationAt()]');
      if (diag && diag.counts.waiting === 0 && now - last >= QUIET_MS) return diag;
      await sleep(100);
    }
    throw new Error('La page ne s’est pas stabilisée');
  }
}

const snap = (tab: Tab): Promise<Snapshot> => tab.evaluate<Snapshot>('__probe.snapshot()');
const checkpoint = (tab: Tab): Promise<number> => tab.evaluate<number>('__probe.checkpoint()');
const since = (tab: Tab, at: number): Promise<MutationSummary> => tab.evaluate<MutationSummary>(`__probe.since(${at})`);
const go = (tab: Tab, step: number): Promise<unknown> => tab.evaluate(`document.querySelector('[data-go="${step}"]').click()`);

async function typeInto(tab: Tab, selector: string, text: string): Promise<void> {
  await tab.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.focus(); e.select(); })()`);
  await tab.send('Input.insertText', { text });
  await tab.evaluate('__probe.blur()');
}

/** Actions de l'utilisateur à chaque étape, identiques avec et sans l'extension (P6.2 à P6.4). */
const STEP_ACTIONS: Record<number, (tab: Tab) => Promise<unknown>> = {
  2: (tab) => typeInto(tab, '#amount', '30000'),
  3: (tab) => typeInto(tab, '#note', 'Facture'),
  4: (tab) => tab.evaluate(`document.querySelector('input[name="confirm"]').click()`),
};

interface StepRecord {
  snapshot: Snapshot;
  mutations: MutationSummary;
  diag: DiagnosticSnapshot;
}

/** Parcours 1 → 5 ; `atStep4` s'exécute à l'étape 4 avant la confirmation. */
async function journey(bench: Bench, tab: Tab, atStep4?: () => Promise<void>): Promise<Map<number, StepRecord>> {
  const steps = new Map<number, StepRecord>();
  for (let step = 1; step <= 5; step++) {
    const at = await checkpoint(tab);
    if (step > 1) await go(tab, step);
    await bench.settle(tab);
    const action = STEP_ACTIONS[step];
    if (action) {
      await action(tab);
      await bench.settle(tab);
    }
    steps.set(step, { snapshot: await snap(tab), mutations: await since(tab, at), diag: await bench.settle(tab) });
    if (step === 4 && atStep4) await atStep4();
  }
  return steps;
}

async function runJourney(bench: Bench): Promise<void> {
  console.log('\n— P6 : parcours des 5 étapes, extension désactivée puis activée —');
  await bench.settings({ enabled: false });
  const refTab = await bench.openPage();
  const refLoad = await refTab.evaluate<{ duration: number }[]>('__probe.longtasks()');
  const reference = await journey(bench, refTab);
  await refTab.close();

  await bench.settings({ enabled: true });
  const tab = await bench.openPage();
  const loaded = await bench.settle(tab);
  const timing = await tab.evaluate<{ domContentLoaded: number | null; firstTextAt: number | null }>('__probe.timing()');
  const loadTasks = await tab.evaluate<{ duration: number }[]>('__probe.longtasks()');
  const longest = (tasks: { duration: number }[]): number => Math.max(0, ...tasks.map((t) => t.duration));
  const at = (value: number | null): string => (value === null ? '—' : ms(value));
  check('ENG', `Moteur embarqué actif dans la page (engineId « ${loaded.engine} »)`, loaded.engine === 'finethnic');
  // Temps comptés depuis le début de la navigation ; la page de test n'écrit jamais dans un nœud de texte,
  // donc la première écriture de texte est celle de l'extension.
  metric(
    `Démarrage : premier texte traduit à ${at(timing.firstTextAt)} du début de la navigation (DOMContentLoaded à ${at(timing.domContentLoaded)}) ; ` +
      `plus longue tâche au chargement ${ms(longest(loadTasks))} (traduction activée), ${ms(longest(refLoad))} (désactivée)`,
  );

  let reenabled: Snapshot | null = null;
  let idle: MutationSummary | null = null;
  let restored: Snapshot | null = null;
  let restoreMutations: MutationSummary | null = null;
  const translated = await journey(bench, tab, async () => {
    // T-TRA-07 : 5 s sans rien faire, aucune mutation.
    const quiet = await checkpoint(tab);
    await sleep(5_000);
    idle = await since(tab, quiet);
    // T-NAV-06 : désactivation en cours de route, puis réactivation.
    const off = await checkpoint(tab);
    await bench.settings({ enabled: false });
    await bench.settle(tab);
    restored = await snap(tab);
    restoreMutations = await since(tab, off);
    await bench.settings({ enabled: true });
    await bench.settle(tab);
    reenabled = await snap(tab);
  });

  for (let step = 1; step <= 5; step++) {
    const ref = reference.get(step);
    const cur = translated.get(step);
    if (!ref || !cur) continue;
    const { problems, changed, unmarked } = compareStep(ref.snapshot, cur.snapshot);
    const structural = JSON.stringify(cur.mutations.structural) === JSON.stringify(ref.mutations.structural);
    if (!structural) problems.push(`mutations hors texte différentes : ${cur.mutations.structural.join(' | ')}`);
    if (cur.diag.step !== step) problems.push(`étape reconnue par l'extension : ${cur.diag.step}`);
    if (cur.snapshot.marks !== null && unmarked > cur.diag.counts.approved) problems.push(`${unmarked} texte(s) changé(s) sans marqueur`);
    const c = cur.diag.counts;
    check(
      `T-NAV-0${step}`,
      `Étape ${step} : valeurs, champs et structure identiques ; seuls des textes changent`,
      problems.length === 0,
      problems.length ? problems.join(' ; ') : `${changed} texte(s) affiché(s) en éton (${c.displayedUnverified} non vérifié(s)), ${c.untranslated + c.noMatch + c.ambiguous} laissé(s) en français, ${c.values + c.numeric} valeur(s) protégée(s)`,
    );
  }
  const step1 = translated.get(1);
  check('T-TRA-03', 'Des traductions non vérifiées sont affichées, chacune avec un marqueur', !!step1 && step1.diag.counts.displayedUnverified > 0 && step1.snapshot.marks !== null);
  const step3 = translated.get(3);
  check('T-PRO-11', 'Saisies conservées (« Facture » dans la note, montant 30000)', !!step3 && step3.snapshot.values.includes('Facture') && translated.get(2)?.snapshot.values.includes('30000') === true);
  const s4 = translated.get(4)?.snapshot;
  check('P6.4', 'Étape 4 : la case à cocher reste fonctionnelle', !!s4 && s4.values.includes('true'));
  check('T-NAV-05', 'Le bouton « Confirmer le transfert » mène au reçu (étape 5)', translated.get(5)?.snapshot.step === 5);

  const idleSummary = idle as MutationSummary | null;
  check('T-TRA-07', 'Aucune mutation pendant 5 s d’inactivité', idleSummary?.total === 0, idleSummary ? `${idleSummary.total} mutation(s)` : '');
  const ref4 = reference.get(4)?.snapshot;
  const restoredSnap = restored as Snapshot | null;
  const restoreSummary = restoreMutations as MutationSummary | null;
  check(
    'T-NAV-06',
    'Désactivation en cours de parcours : HTML identique à la page sans extension',
    !!restoredSnap && !!ref4 && restoredSnap.html === ref4.html && JSON.stringify(restoredSnap.values) === JSON.stringify(ref4.values) && restoreSummary?.structural.length === 0,
    restoreSummary ? `${restoreSummary.byType['characterData'] ?? 0} texte(s) rendu(s)` : '',
  );
  const reSnap = reenabled as Snapshot | null;
  check('T-NAV-06b', 'Réactivation : mêmes textes qu’avant la désactivation', !!reSnap && JSON.stringify(reSnap.texts) === JSON.stringify(s4?.texts));

  await optionsAndTooltip(bench, tab, reference.get(5)?.snapshot);
  await tab.close();
}

async function optionsAndTooltip(bench: Bench, tab: Tab, ref5: Snapshot | undefined): Promise<void> {
  const before = await snap(tab);
  // T-TRA-09 : sans l'option, aucune traduction non vérifiée ; avec, les mêmes textes reviennent.
  await bench.settings({ showUnverified: false });
  const hidden = await bench.settle(tab);
  const hiddenSnap = await snap(tab);
  await bench.settings({ showUnverified: true });
  await bench.settle(tab);
  const shown = await snap(tab);
  check(
    'T-TRA-09',
    'Option « non vérifiées » désactivée : français d’origine ; réactivée : mêmes traductions',
    hidden.counts.displayedUnverified === 0 && hiddenSnap.html === ref5?.html && JSON.stringify(shown.texts) === JSON.stringify(before.texts),
    `${hidden.counts.unverified + hidden.counts.partial} texte(s) toujours comptés « non vérifiés »`,
  );

  await bench.settings({ displayMode: 'bilingual' });
  await bench.settle(tab);
  const bilingual = await snap(tab);
  const bilingualDiff = compareStep(before, bilingual);
  await bench.settings({ displayMode: 'replace' });
  await bench.settle(tab);
  check(
    'P5.5',
    'Mode bilingue « traduction (français) » : seuls les textes changent',
    bilingualDiff.problems.length === 0 && bilingual.texts.some((t, i) => t !== before.texts[i] && t.endsWith(')')),
    bilingualDiff.problems.join(' ; '),
  );

  // Infobulle (P5.5) : au focus, hôte hors de <body> ; à la perte du focus, retiré.
  const focused = await tab.evaluate<boolean>('__probe.focusMarkedControl()');
  await sleep(200);
  const open = await snap(tab);
  await tab.evaluate('__probe.blur()');
  await sleep(200);
  const closed = await snap(tab);
  check(
    'T-TRA-03b',
    'Français au focus : infobulle hors de <body>, retirée à la perte du focus',
    focused && open.outside.includes('finethnic-tooltip') && open.skeleton === before.skeleton && !closed.outside.includes('finethnic-tooltip'),
    focused ? '' : 'aucun bouton traduit à focaliser',
  );
}

/** Cas de `tests/e2e/engine-scenario.json` affichés par l'extension (partie C de docs/tests/E2E-extension-moteur.md). */
async function runInjections(bench: Bench): Promise<void> {
  console.log('\n— P7 : contenu injecté après le chargement —');
  const tab = await bench.openPage();
  await bench.settle(tab);
  const page = await snap(tab);

  const scenario = loadScenario(ROOT);
  const cases = scenario.cases.filter((c) => c.sourceLang === undefined || c.sourceLang === 'fr');
  await tab.evaluate(`__probe.inject('fe-scenario', ${JSON.stringify(cases.map((c) => ({ tag: 'div', text: c.text.repeat(c.repeat ?? 1), attrs: { 'data-case': c.id } })))})`);
  await bench.settle(tab);
  const shown = await tab.evaluate<Item[]>(`__probe.items('#fe-scenario > div')`);
  const failures: string[] = [];
  cases.forEach((c, i) => {
    const item = shown[i];
    const original = c.text.repeat(c.repeat ?? 1);
    const wanted = c.expect.status === 'PENDING_VALIDATION' && c.expect.unverifiedOutput ? c.expect.unverifiedOutput : original;
    const mark = wanted === original ? '' : c.expect.unverifiedKind === 'partial' ? 'partial' : 'unverified';
    if (!item || item.text !== wanted || (item.mark !== null && item.mark !== mark)) {
      failures.push(`${c.id} : « ${item?.text.slice(0, 60)} » (${item?.mark || 'sans marque'}), attendu « ${wanted.slice(0, 60)} » (${mark || 'sans marque'})`);
    }
  });
  check('E2E-C', `Scénario extension ↔ moteur : ${cases.length - failures.length} / ${cases.length} cas affichés comme le prévoit le contrat §5.4`, failures.length === 0, failures.join(' ; '));

  const samples: Array<{ id: string; label: string; item: Injected }> = [
    { id: 'T-INE-03', label: 'Avertissement', item: { tag: 'p', text: 'Ne communiquez jamais votre code PIN à personne.', attrs: { role: 'alert' } } },
    { id: 'T-INE-04', label: 'Erreur', item: { tag: 'p', text: 'Solde insuffisant pour effectuer cette opération.', attrs: { role: 'alert' } } },
    { id: 'T-INE-06', label: 'Texte inconnu', item: { tag: 'p', text: 'Le guichet du marché ferme à midi le samedi.' } },
    { id: 'T-TRA-05', label: 'Phrase proche d’une entrée', item: { tag: 'p', text: 'Votre paiement a été envoyé avec succès.' } },
    {
      id: 'T-INE-07',
      label: 'Montant, nom et référence dynamiques',
      item: { tag: 'p', text: 'Votre transfert de 25 000 FCFA vers Jean-Paul Mbarga a été effectué. Référence : SAF-2026-K7P2Q9' },
    },
  ];
  await tab.evaluate(`__probe.inject('fe-samples', ${JSON.stringify(samples.map((s) => s.item))})`);
  const afterSamples = await bench.settle(tab);
  const sampleItems = await tab.evaluate<Item[]>(`__probe.items('#fe-samples > p')`);
  samples.forEach((s, i) => {
    const item = sampleItems[i];
    const original = s.item.text ?? '';
    if (!item) return;
    const changed = item.text !== original;
    const tokensKept = JSON.stringify(protectedTokens(item.text)) === JSON.stringify(protectedTokens(original));
    const namesKept = !original.includes('Jean-Paul Mbarga') || item.text.includes('Jean-Paul Mbarga');
    check(
      s.id,
      `${s.label} : français, ou traduction marquée ; valeurs intactes`,
      (!changed || (item.mark !== '' && item.mark !== null)) && tokensKept && namesKept,
      changed ? `affiché « ${item.text} » (${item.mark})` : 'laissé en français',
    );
  });

  // T-INE-05 : un lot de 10 messages, insérés d'un coup.
  const lot = corpusTexts().filter((t) => !t.includes('\n')).slice(0, 10);
  await tab.evaluate(`__probe.inject('fe-lot', ${JSON.stringify(lot.map((text) => ({ tag: 'p', text })))})`);
  const afterLot = await bench.settle(tab);
  const lotItems = await tab.evaluate<Item[]>(`__probe.items('#fe-lot > p')`);
  const lotUnmarked = lotItems.filter((item, i) => item.text !== lot[i] && !item.mark).length;
  check(
    'T-INE-05',
    'Lot de 10 messages : tous évalués, aucune traduction sans marqueur',
    afterLot.counts.waiting === 0 && afterLot.counts.candidates - afterSamples.counts.candidates === lot.length && lotUnmarked === 0,
    `${lotItems.filter((item, i) => item.text !== lot[i]).length} affiché(s) en éton`,
  );

  // T-INE-01 (aria-live) et P7.5 (boîte de dialogue) ; T-DET-02 (délai de détection).
  await tab.evaluate(`__probe.inject('fe-live', [{ tag: 'div', attrs: { 'aria-live': 'polite', id: 'fe-live-region' } }])`);
  await bench.settle(tab);
  const tLive = await tab.evaluate<number>(`(() => { document.getElementById('fe-live-region').textContent = 'Montant'; return __probe.now(); })()`);
  await bench.settle(tab);
  const [live] = await tab.evaluate<Item[]>(`__probe.items('#fe-live-region')`);
  check(
    'T-INE-01',
    'Message ajouté dans une zone aria-live : détecté et affiché avec son marqueur',
    live?.text === 'táŋ' && live.mark === 'unverified',
    live?.firstWriteAt != null ? `affiché en ${ms(live.firstWriteAt - tLive)}` : `« ${live?.text} »`,
  );
  check('T-DET-02', `Texte ajouté détecté et traité en moins de ${DETECT_BUDGET_MS} ms`, live?.firstWriteAt != null && live.firstWriteAt - tLive < DETECT_BUDGET_MS);

  await tab.evaluate(`__probe.inject('fe-dialog', [{ tag: 'p', text: 'Payer la facture' }, { tag: 'button', text: 'Montant' }], null)`);
  await tab.evaluate(`(() => { const d = document.createElement('dialog'); d.id = 'fe-dialog-box'; d.append(document.getElementById('fe-dialog')); document.body.append(d); d.showModal(); })()`);
  await bench.settle(tab);
  const dialog = await tab.evaluate<Item[]>(`__probe.items('#fe-dialog-box p, #fe-dialog-box button')`);
  check('P7.5', 'Boîte de dialogue modale : textes traduits et marqués', dialog[0]?.text === 'yágnà facture' && dialog[0].mark === 'unverified' && dialog[1]?.text === 'táŋ');
  await tab.evaluate(`document.getElementById('fe-dialog-box').close()`);
  // La fermeture rend le focus à la page : l'infobulle du bouton de la boîte est retirée (hors de <body>).
  await bench.settle(tab);

  // T-TRA-08 : l'application remet le français dans un texte traduit.
  const rewrite = await checkpoint(tab);
  await tab.evaluate(`__probe.setText('#fe-live-region', 'Montant')`);
  await bench.settle(tab);
  const [again] = await tab.evaluate<Item[]>(`__probe.items('#fe-live-region')`);
  const rewriteMutations = await since(tab, rewrite);
  const quiet = await checkpoint(tab);
  await sleep(2_000);
  const after = await since(tab, quiet);
  check(
    'T-TRA-08',
    'Français remis par l’application : retraduit, sans boucle',
    again?.text === 'táŋ' && rewriteMutations.total <= 2 && after.total === 0,
    `${rewriteMutations.total} mutation(s), puis ${after.total} en 2 s` +
      (rewriteMutations.structural.length ? ` ; structure : ${rewriteMutations.structural.join(', ')}` : ''),
  );

  // La page d'origine n'a pas bougé pendant les injections.
  const end = await snap(tab);
  const pageTexts = end.texts.slice(0, page.texts.length);
  check('T-PRO-12', 'Textes de la page inchangés par les injections', JSON.stringify(pageTexts) === JSON.stringify(page.texts));
  await tab.close();
}

/** T-INE-08 : 500 nœuds insérés d'un coup, sur une page fraîche (cache du moteur vide). */
async function runLoad(bench: Bench): Promise<void> {
  console.log(`\n— P7.4 : charge (${LOAD_NODES} nœuds) —`);
  const distinct = corpusTexts().slice(0, LOAD_NODES);
  const ten = corpusTexts().slice(0, 10);
  const repeated = Array.from({ length: LOAD_NODES }, (_, i) => ten[i % ten.length] ?? '');
  const runs: Array<{ id: string; label: string; texts: string[]; required: boolean }> = [
    { id: 'T-INE-08', label: `${LOAD_NODES} nœuds, 10 messages répétés`, texts: repeated, required: true },
    { id: 'T-INE-08b', label: `${LOAD_NODES} nœuds, ${distinct.length} textes de D8 tous différents (pire cas)`, texts: distinct, required: false },
  ];
  for (const run of runs) {
    const tab = await bench.openPage();
    const before = await bench.settle(tab);
    const at = await checkpoint(tab);
    const t0 = await tab.evaluate<number>(`__probe.inject('fe-load', ${JSON.stringify(run.texts.map((text) => ({ tag: 'p', text })))})`);
    const done = await bench.settle(tab, 60_000);
    const summary = await since(tab, at);
    const tasks = await tab.evaluate<{ start: number; duration: number }[]>(`__probe.longtasks(${t0})`);
    const elapsed = summary.lastTextAt >= 0 ? summary.lastTextAt - t0 : NaN;
    const evaluated = done.counts.candidates - before.counts.candidates;
    const longest = Math.max(0, ...tasks.map((t) => t.duration));
    const detail = `${ms(elapsed)} jusqu'au dernier texte affiché, ${summary.byType['characterData'] ?? 0} texte(s) écrit(s), ${evaluated} évalué(s), plus longue tâche ${ms(longest)}`;
    const ok = Number.isFinite(elapsed) && elapsed < LOAD_BUDGET_MS && done.counts.waiting === 0;
    if (run.required) check(run.id, `Charge : ${run.label}, traités en moins de ${LOAD_BUDGET_MS} ms`, ok, detail);
    else metric(`${run.id} (mesure) ${run.label} : ${detail}`);
    await tab.close();
  }
}

async function runAudit(bench: Bench, origin: string): Promise<void> {
  console.log('\n— P8.4 : réseau, stockage, erreurs —');
  const foreign = bench.requests.filter((url) => !url.startsWith(`${origin}/`));
  check('T-INS-05', 'Aucune requête réseau hors de la page de test', foreign.length === 0, `${bench.requests.length} requête(s) de la page${foreign.length ? ` ; hors page : ${foreign.join(', ')}` : ''}`);
  const keys = await bench.control.evaluate<string[]>('chrome.storage.local.get(null).then((all) => Object.keys(all))');
  check('P8.4', 'Stockage de l’extension : uniquement les réglages', keys.length === 1 && keys[0] === 'settings', keys.join(', '));
  const tab = await bench.openPage();
  await bench.settle(tab);
  const storage = await tab.evaluate<{ local: number; session: number; cookie: string }>('__probe.storage()');
  await tab.close();
  check('P8.4b', 'Rien d’écrit dans le stockage ni les cookies de la page', storage.local === 0 && storage.session === 0 && storage.cookie === '');
  check('P8.1', 'Aucune exception ni erreur de console dans les pages', bench.errors.length === 0, bench.errors.slice(0, 3).join(' ; '));
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { dist: { type: 'string' }, chrome: { type: 'string' } } });
  const chrome = findChrome(values.chrome);
  if (!chrome) {
    console.error('Chrome introuvable : indiquer son chemin avec --chrome <chemin> ou CHROME_PATH.');
    return 2;
  }
  const work = await mkdtemp(path.join(tmpdir(), 'finethnic-e2e-'));
  const { server, origin } = await serveFixtures();
  let browser: Awaited<ReturnType<typeof launchChrome>> | null = null;
  try {
    const extension = await prepareExtension(work, values.dist);
    browser = await launchChrome(chrome);
    const { id } = await browser.cdp.send<{ id: string }>('Extensions.loadUnpacked', { path: extension });
    const control = await Tab.open(browser.cdp);
    await control.navigate(`chrome-extension://${id}/popup/popup.html`);
    const probe = await readFile(path.join(ROOT, 'scripts/lib/e2e-probe.js'), 'utf8');
    const bench = new Bench(browser.cdp, control, probe, `${origin}/${FIXTURE}`);
    console.log(`Extension ${values.dist ? path.resolve(values.dist) : 'de production construite'} chargée dans ${chrome} (${id}).`);

    await runJourney(bench);
    await runInjections(bench);
    await runLoad(bench);
    await bench.settings({});
    await runAudit(bench, origin);
  } finally {
    await browser?.close();
    server.close();
    await rm(work, { recursive: true, force: true });
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length} / ${checks.length} vérifications réussies.`);
  return failed.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exit(1);
  },
);
