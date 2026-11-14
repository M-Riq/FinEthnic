/**
 * Pilotage de Chrome par le protocole DevTools (CDP), sans dépendance : `WebSocket` de Node et le
 * navigateur installé sur le poste. Sert au banc de test de l'extension (`scripts/e2e-extension.ts`).
 *
 * Chrome (version de marque) ignore `--load-extension` : l'extension est chargée par
 * `Extensions.loadUnpacked`, qui demande `--enable-unsafe-extension-debugging`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type Params = Record<string, unknown>;
type Listener = (method: string, params: Params, sessionId: string | undefined) => void;

const CHROME_CANDIDATES = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

/** Chemin de Chrome : `CHROME_PATH`, sinon le premier candidat trouvé dans le `PATH`. */
export function findChrome(explicit?: string): string | null {
  const wanted = explicit ?? process.env['CHROME_PATH'];
  if (wanted) return existsSync(wanted) ? wanted : null;
  const dirs = (process.env['PATH'] ?? '').split(path.delimiter);
  for (const candidate of CHROME_CANDIDATES) {
    if (path.isAbsolute(candidate)) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    for (const dir of dirs) {
      const full = path.join(dir, candidate);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

export class Cdp {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: Params) => void; reject: (error: Error) => void; method: string }>();
  private readonly listeners = new Set<Listener>();

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (event) => this.receive(String(event.data)));
    ws.addEventListener('close', () => {
      for (const { reject, method } of this.pending.values()) reject(new Error(`CDP fermé pendant ${method}`));
      this.pending.clear();
    });
  }

  static connect(url: string): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => resolve(new Cdp(ws)), { once: true });
      ws.addEventListener('error', () => reject(new Error(`Connexion CDP impossible : ${url}`)), { once: true });
    });
  }

  send<T extends Params = Params>(method: string, params: Params = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: Params) => void, reject, method });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Attend le prochain évènement `method` (de la session donnée) qui satisfait `accept`. */
  waitFor(method: string, sessionId: string | undefined, timeoutMs: number, accept: (params: Params) => boolean = () => true): Promise<Params> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Délai dépassé en attendant ${method}`));
      }, timeoutMs);
      const off = this.on((m, params, sid) => {
        if (m !== method || sid !== sessionId || !accept(params)) return;
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  close(): void {
    this.ws.close();
  }

  private receive(raw: string): void {
    const message = JSON.parse(raw) as { id?: number; method?: string; params?: Params; result?: Params; error?: { message: string }; sessionId?: string };
    if (message.id !== undefined) {
      const call = this.pending.get(message.id);
      if (!call) return;
      this.pending.delete(message.id);
      if (message.error) call.reject(new Error(`${call.method} : ${message.error.message}`));
      else call.resolve(message.result ?? {});
      return;
    }
    if (message.method) for (const listener of this.listeners) listener(message.method, message.params ?? {}, message.sessionId);
  }
}

/** Onglet piloté par une session CDP « à plat » (`flatten`). */
export class Tab {
  private constructor(
    readonly cdp: Cdp,
    readonly targetId: string,
    readonly sessionId: string,
  ) {}

  static async open(cdp: Cdp, options: { probe?: string } = {}): Promise<Tab> {
    const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
    const tab = new Tab(cdp, targetId, sessionId);
    await Promise.all([tab.send('Page.enable'), tab.send('Runtime.enable'), tab.send('Network.enable')]);
    if (options.probe) await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: options.probe });
    return tab;
  }

  send<T extends Params = Params>(method: string, params: Params = {}): Promise<T> {
    return this.cdp.send<T>(method, params, this.sessionId);
  }

  async navigate(url: string, timeoutMs = 20_000): Promise<void> {
    const loaded = this.cdp.waitFor('Page.loadEventFired', this.sessionId, timeoutMs);
    const { errorText } = await this.send<{ errorText?: string }>('Page.navigate', { url });
    if (errorText) throw new Error(`Navigation impossible vers ${url} : ${errorText}`);
    await loaded;
  }

  /** Évalue une expression dans le monde de la page ; les promesses sont attendues. */
  async evaluate<T>(expression: string): Promise<T> {
    const { result, exceptionDetails } = await this.send<{ result: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description?: string } } }>(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
    );
    if (exceptionDetails) throw new Error(`Évaluation en échec : ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value as T;
  }

  close(): Promise<Params> {
    return this.cdp.send('Target.closeTarget', { targetId: this.targetId });
  }
}

export interface Browser {
  cdp: Cdp;
  close(): Promise<void>;
}

/** Lance Chrome sans interface avec un profil jetable, et s'y connecte. */
export async function launchChrome(executable: string): Promise<Browser> {
  const profile = await mkdtemp(path.join(tmpdir(), 'finethnic-chrome-'));
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--enable-unsafe-extension-debugging',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    // Chrome refuse de démarrer en root avec son bac à sable (conteneurs).
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ];
  const child: ChildProcess = spawn(executable, args, { stdio: 'ignore' });
  const exited = new Promise<never>((_, reject) => child.once('exit', (code) => reject(new Error(`Chrome s'est arrêté (code ${code})`))));
  const endpoint = await Promise.race([readDevToolsEndpoint(profile), exited]);
  const cdp = await Cdp.connect(endpoint);
  return {
    cdp,
    async close() {
      try {
        await Promise.race([cdp.send('Browser.close'), new Promise((r) => setTimeout(r, 2_000))]);
      } catch {
        // Chrome déjà fermé.
      }
      cdp.close();
      if (child.exitCode === null) child.kill();
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

async function readDevToolsEndpoint(profile: string): Promise<string> {
  const file = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150; i++) {
    try {
      const [port, wsPath] = (await readFile(file, 'utf8')).split('\n');
      if (port && wsPath) return `ws://127.0.0.1:${port.trim()}${wsPath.trim()}`;
    } catch {
      // Pas encore écrit.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome n’a pas ouvert son port de débogage');
}
