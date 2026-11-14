/**
 * Bilan du moteur sur les textes traduisibles de D8 (M25).
 *
 *   npm run engine-report -- [--list]
 *
 * Les textes qui ne contiennent que des termes gardés en français (« Compte », « Bénéficiaire ») sont
 * comptés à part : ils ne sont pas traduits (aucun mot éton), mais ce n'est pas un échec. `--list` les
 * affiche. D7 doit avoir été importé (npm run import-dictionary).
 */
import { parseArgs } from 'node:util';
import { createEngine } from '../src/engine/engine';
import { onlyFrenchKept } from '../src/engine/select';
import { loadEngineResources, MissingDictionaryError } from './lib/engine-load';

const { values } = parseArgs({ options: { list: { type: 'boolean', default: false } } });

try {
  const resources = loadEngineResources(process.cwd());
  const engine = createEngine(resources, { cacheSize: 0 });
  const counts = { complete: 0, keptOnly: 0, PARTIAL: 0, FALLBACK: 0, PENDING: 0, PASSTHROUGH: 0 };
  const kept: string[] = [];
  for (const entry of resources.corpus) {
    const r = engine.translate(entry.text);
    if (r.status === 'SUCCESS') counts.complete++;
    else if (onlyFrenchKept(r)) {
      counts.keptOnly++;
      kept.push(`${entry.id} · ${entry.text}`);
    } else counts[r.status]++;
  }
  const total = resources.corpus.length;
  const pct = (n: number): string => `${((100 * n) / total).toFixed(1)} %`;
  console.log(`Bilan du moteur sur ${total} textes de D8`);
  console.log(`  Traduits complètement            : ${counts.complete} (${pct(counts.complete)})`);
  console.log(`  Gardés en français (termes seuls) : ${counts.keptOnly} (${pct(counts.keptOnly)})`);
  console.log(`  Brouillons incomplets (PARTIAL)   : ${counts.PARTIAL}`);
  console.log(`  Repli sur le français (FALLBACK)  : ${counts.FALLBACK}`);
  console.log(`  En attente (PENDING)              : ${counts.PENDING}`);
  console.log(`  Rien à traduire (PASSTHROUGH)     : ${counts.PASSTHROUGH}`);
  if (values.list) for (const line of kept) console.log(`  - ${line}`);
} catch (error) {
  if (error instanceof MissingDictionaryError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
