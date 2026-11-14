/**
 * Banc de bout en bout de l'extension dans un vrai Chrome (mission phase 5).
 *
 *   npm run e2e-extension                       construit la version de production puis la teste
 *   npm run e2e-extension -- --dist <dossier>   teste une construction existante (ex. le .zip décompressé)
 *   npm run e2e-extension -- --chrome <binaire> (ou variable CHROME_PATH ; défaut : google-chrome, chromium)
 *
 * Chrome est lancé sans interface, dans un profil temporaire ; l'extension est chargée par le protocole
 * DevTools (`Extensions.loadUnpacked`, Chrome lancé avec `--enable-unsafe-extension-debugging`).
 * La page de test locale (`tests/fixtures/safinum-test.html`) est servie à l'adresse exacte du manifest
 * de production, `https://safinum.cm/hackathon-test`, par interception (`Fetch.fulfillRequest`) : aucun
 * accès réseau, et c'est bien le paquet distribué qui est testé, sans manifest modifié.
 *
 * Vérifie, étape par étape de l'application monopage :
 *   1. des textes sont remplacés, sans faux moteur, et chaque nombre du français reste dans la traduction ;
 *   2. désactiver la traduction rend exactement les textes d'origine ;
 *   3. un texte injecté après coup est traduit (MutationObserver) ;
 *   4. un texte absent de D8 est enrichi et gardé sur l'appareil (`corpusEnrichi`), valeurs en `{valeur}` ;
 *   5. aucune exception dans la page.
 * Code de sortie 1 si une vérification échoue.
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGE_URL = 'https://safinum.cm/hackathon-test';
const FIXTURE = path.join(ROOT, 'tests/fixtures/safinum-test.html');
/** Texte de D8 que le moteur traduit (D7) : sert à vérifier le contenu injecté. */
const INJECTED_KNOWN = 'Montant';
/** Phrase absente de D8 : doit être enrichie et gardée sur l'appareil. */
const INJECTED_NEW = 'Votre paiement de 12 500 FCFA a été refusé par la banque.';

const { values } = parseArgs({ options: { dist: { type: 'string' }, chrome: { type: 'string' } } });

// ---------- Client minimal du protocole DevTools ----------

type Params = Record<string, unknown>;
interface CdpMessage { id?: number; method?: string; params?: Params; sessionId?: string; result?: Params; error?: { message: string } }

class Cdp {
  private next = 1;
  private readonly calls = new Map<number, { resolve: (v: Params) => void; reject: (e: Error) => void }>();
  private readonly handlers: Array<(m: CdpMessage) => void> = [];
  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const call = this.calls.get(message.id);
        this.calls.delete(message.id);
        if (message.error) call?.reject(new Error(message.error.message));
        else call?.resolve(message.result ?? {});
      } else for (const handler of this.handlers) handler(message);
    });
  }
  static async connect(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error(`Connexion impossible : ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }
  send(method: string, params: Params = {}, sessionId?: string): Promise<Params> {
    const id = this.next++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.calls.set(id, { resolve, reject }));
  }
  on(handler: (m: CdpMessage) => void): void {
    this.handlers.push(handler);
  }
  close(): void {
    this.ws.close();
  }
}

// ---------- Outils ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const failures: string[] = [];
function check(ok: boolean, label: string, detail = ''): void {
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

function findChrome(): string {
  const candidates = [values.chrome, process.env['CHROME_PATH'], 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const c of candidates) {
    if (!c) continue;
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' });
      return c;
    } catch {
      // essayer le suivant
    }
  }
  throw new Error('Chrome introuvable : indiquez --chrome <binaire> ou CHROME_PATH');
}

async function waitForDevTools(port: number): Promise<string> {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return ((await res.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl;
    } catch {
      await sleep(100);
    }
  }
  throw new Error('Chrome ne répond pas sur le port DevTools');
}

/** Textes visibles de l'application : nœuds texte puis attributs traduisibles, dans l'ordre du DOM. */
const SNAPSHOT = `(() => {
  const root = document.getElementById('app');
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) { const t = n.data.trim(); if (t) out.push(t); }
  for (const el of root.querySelectorAll('[placeholder],[title],[aria-label]'))
    for (const a of ['placeholder', 'title', 'aria-label']) if (el.hasAttribute(a)) out.push('@' + a + ':' + el.getAttribute(a));
  return out;
})()`;

async function main(): Promise<number> {
  let tmp: string | null = null;
  let dist = values.dist ? path.resolve(values.dist) : null;
  let chrome: ChildProcess | null = null;
  let cdp: Cdp | null = null;
  try {
    tmp = mkdtempSync(path.join(tmpdir(), 'finethnic-e2e-'));
    if (dist === null) {
      dist = path.join(tmp, 'dist');
      console.log('Construction de production…');
      execFileSync(process.execPath, ['build.mjs', '--out', dist], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
    }
    if (!existsSync(path.join(dist, 'manifest.json'))) throw new Error(`Pas de manifest.json dans ${dist}`);
    const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8')) as { content_scripts: Array<{ matches: string[] }> };
    const matches = manifest.content_scripts.flatMap((s) => s.matches);
    check(matches.some((m) => PAGE_URL.startsWith(m.replace(/\*$/u, ''))), 'le manifest vise l’environnement de test', matches.join(', '));

    const port = 9300 + Math.floor(Math.random() * 500);
    chrome = spawn(findChrome(), [
      '--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
      '--enable-unsafe-extension-debugging', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank',
    ], { stdio: 'ignore' });
    cdp = await Cdp.connect(await waitForDevTools(port));
    const { id: extensionId } = (await cdp.send('Extensions.loadUnpacked', { path: dist })) as { id: string };

    const attach = async (url: string): Promise<string> => {
      const { targetId } = await cdp!.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = (await cdp!.send('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };
      await cdp!.send('Runtime.enable', {}, sessionId);
      if (url !== 'about:blank') await cdp!.send('Page.navigate', { url }, sessionId);
      return sessionId;
    };
    const evaluate = async <T>(sessionId: string, expression: string): Promise<T> => {
      const { result, exceptionDetails } = (await cdp!.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)) as {
        result: { value: T }; exceptionDetails?: { text: string };
      };
      if (exceptionDetails) throw new Error(`Évaluation : ${exceptionDetails.text}`);
      return result.value;
    };

    // Contexte de l'extension (popup) : lecture et écriture de chrome.storage.local.
    const ext = await attach(`chrome-extension://${extensionId}/popup/popup.html`);
    await sleep(500);
    const setEnabled = (enabled: boolean) =>
      evaluate(ext, `chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: { ...(r.settings ?? {}), enabled: ${enabled} } }))`);
    await setEnabled(false);

    // Page de test servie à l'adresse de production.
    const fixture = Buffer.from(readFileSync(FIXTURE)).toString('base64');
    const page = await attach('about:blank');
    const exceptions: string[] = [];
    cdp.on((m) => {
      if (m.sessionId !== page) return;
      if (m.method === 'Runtime.exceptionThrown') exceptions.push(JSON.stringify(m.params).slice(0, 300));
      if (m.method === 'Fetch.requestPaused') {
        const { requestId } = m.params as { requestId: string };
        void cdp!.send('Fetch.fulfillRequest', {
          requestId, responseCode: 200, body: fixture,
          responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
        }, page);
      }
    });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'https://safinum.cm/*' }] }, page);
    await cdp.send('Page.enable', {}, page);
    await cdp.send('Page.navigate', { url: PAGE_URL }, page);

    const snapshot = () => evaluate<string[]>(page, SNAPSHOT);
    /** Attend que les textes ne changent plus pendant 600 ms (moteur chargé, lots traités). */
    const settle = async (): Promise<string[]> => {
      let last = JSON.stringify(await snapshot());
      let stableSince = Date.now();
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        await sleep(150);
        const now = JSON.stringify(await snapshot());
        if (now !== last) {
          last = now;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= 600) break;
      }
      return JSON.parse(last) as string[];
    };
    const digits = (s: string): string[] => s.match(/\d+/gu) ?? [];

    await sleep(1000);
    let total = 0;
    for (const step of ['1', '2', '3', '4', '5']) {
      if (step !== '1') {
        await evaluate(page, `document.querySelector('[data-go="${step}"]').click()`);
      }
      const original = await settle();
      await setEnabled(true);
      const translated = await settle();
      const changed = original.map((t, i) => [t, translated[i] ?? ''] as const).filter(([a, b]) => a !== b);
      total += changed.length;
      console.log(`\n— Étape ${step} : ${changed.length}/${original.length} textes en éton`);
      for (const [fr, eto] of changed) console.log(`    ${fr}  →  ${eto}`);
      check(original.length === translated.length, `étape ${step} : structure conservée (même nombre de textes)`);
      check(changed.length > 0, `étape ${step} : au moins un texte traduit`);
      check(!translated.some((t) => t.includes('⟦FAKE⟧') || t.includes('⟦TEST')), `étape ${step} : aucun faux moteur`);
      const lost = changed.filter(([fr, eto]) => digits(fr).some((d) => !digits(eto).includes(d)));
      check(lost.length === 0, `étape ${step} : nombres et montants conservés`, lost.map(([fr]) => fr).join(' | '));
      await setEnabled(false);
      const restored = await settle();
      check(JSON.stringify(restored) === JSON.stringify(original), `étape ${step} : désactiver rend le français d'origine`);
    }

    // Contenu injecté par l'application après coup.
    await setEnabled(true);
    await settle();
    await evaluate(page, `(() => {
      for (const text of ${JSON.stringify([INJECTED_KNOWN, INJECTED_NEW])}) {
        const p = document.createElement('p'); p.className = 'injected'; p.textContent = text;
        document.getElementById('app').append(p);
      }
    })()`);
    await settle();
    const injected = await evaluate<string[]>(page, `[...document.querySelectorAll('#app p.injected')].map((p) => p.textContent)`);
    console.log(`\n— Texte injecté : ${INJECTED_KNOWN}  →  ${injected[0] ?? ''}`);
    check(injected[0] !== undefined && injected[0] !== INJECTED_KNOWN, 'texte injecté dynamiquement traduit');

    // Enrichissement de D8 sur l'appareil (après le délai de regroupement).
    let corpus: Array<{ cle: string; statut: string; texte?: string; terme?: string }> = [];
    for (let i = 0; i < 40 && !corpus.some((e) => JSON.stringify(e).includes('refusé par la banque')); i++) {
      await sleep(250);
      corpus = await evaluate(ext, `chrome.storage.local.get('corpusEnrichi').then((r) => r.corpusEnrichi ?? [])`);
    }
    const stored = JSON.stringify(corpus);
    console.log(`\n— corpusEnrichi : ${corpus.length} entrée(s)`);
    check(stored.includes('Votre paiement de {valeur} a été refusé par la banque.'), 'phrase absente de D8 enrichie et gardée, montant en {valeur}');
    check(!/12\s?500/u.test(stored), 'aucun montant stocké');

    check(exceptions.length === 0, 'aucune exception dans la page', exceptions.join(' | '));
    console.log(`\n${total} textes traduits sur les 5 étapes. ${failures.length === 0 ? 'Tout est vérifié.' : `${failures.length} échec(s).`}`);
    return failures.length === 0 ? 0 : 1;
  } finally {
    cdp?.close();
    chrome?.kill();
    await sleep(300);
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
