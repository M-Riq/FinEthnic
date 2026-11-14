import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LogData, LogEvent, Logger } from '../../../src/shared/logger';
import type { Schedule } from '../../../src/content/observer';

// Sous jsdom, `node:fs` refuse un `URL` : on passe par un chemin de fichier.
const FIXTURE = readFileSync(path.join(import.meta.dirname, '../../fixtures/safinum-test.html'), 'utf8');
const PAGES = path.join(import.meta.dirname, '../../../data/safinum-test-pages');

/** Textes D8 d'une page de test (ID et texte français). */
export function d8Texts(page: number): Array<{ id: string; text: string }> {
  const entries = JSON.parse(readFileSync(path.join(PAGES, `page-${page}.json`), 'utf8')) as Array<{
    id: string;
    source: { fr: { text: string } };
  }>;
  return entries.map((entry) => ({ id: entry.id, text: entry.source.fr.text }));
}

/** Affiche une étape comme le fait l'application monopage : le contenu de `<main>` est remplacé. */
export function showStep(doc: Document, step: number): void {
  const template = doc.getElementById(`step-${step}`) as HTMLTemplateElement;
  doc.getElementById('app')!.replaceChildren(template.content.cloneNode(true));
}

/** Charge la page de test locale dans le document jsdom, à l'étape demandée (son script n'est pas exécuté). */
export function loadFixture(doc: Document, step = 1): void {
  const source = new DOMParser().parseFromString(FIXTURE, 'text/html');
  source.querySelectorAll('script').forEach((script) => script.remove());
  doc.documentElement.lang = source.documentElement.lang;
  doc.body.replaceWith(doc.importNode(source.body, true));
  showStep(doc, step);
}

/** Textes visibles et sans espaces de bord, dans l'ordre du document. */
export const trimmed = (nodes: Iterable<Text>): string[] => [...nodes].map((node) => node.data.trim());

/** Trames manuelles : les rappels programmés attendent `frames()`. */
export function manualFrames() {
  const tasks: Array<() => void> = [];
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  return {
    schedule: ((callback) => void tasks.push(callback)) as Schedule,
    pending: () => tasks.length,
    /** Laisse passer les rappels de MutationObserver, puis exécute UNE trame. */
    async frame(): Promise<void> {
      await settle();
      tasks.splice(0).forEach((task) => task());
    },
    /** Exécute des trames jusqu'à ce que plus rien ne soit programmé ; renvoie leur nombre. */
    async frames(limit = 50): Promise<number> {
      let count = 0;
      for (await settle(); tasks.length > 0; await settle()) {
        if (++count > limit) throw new Error('trames sans fin');
        tasks.splice(0).forEach((task) => task());
      }
      return count;
    },
  };
}

export function recorder() {
  const events: Array<[LogEvent, LogData | undefined]> = [];
  const logger: Logger = { event: (name, data) => void events.push([name, data]) };
  return { events, logger, named: (name: LogEvent) => events.filter(([event]) => event === name).map(([, data]) => data) };
}
