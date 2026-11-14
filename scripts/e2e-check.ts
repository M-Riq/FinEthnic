/**
 * Vérifie l'API locale du moteur avec le scénario de bout en bout (docs/tests/E2E-extension-moteur.md).
 *
 *   npm run serve-engine            (dans un premier terminal)
 *   npm run e2e-check -- [--url http://127.0.0.1:8787]
 *
 * Envoie chaque cas de tests/e2e/engine-scenario.json à POST /contract/translate, puis tous les cas en un
 * seul lot `{ "requests": [...] }`, et affiche OK ou ÉCHEC par cas. Code de sortie 1 si un cas échoue.
 */
import { parseArgs } from 'node:util';
import type { EngineInfo, TranslationResult } from '../src/language/contract';
import { checkCase, loadScenario, scenarioRequest } from './lib/e2e-scenario';

const { values } = parseArgs({ options: { url: { type: 'string' } } });
const base = (values.url ?? 'http://127.0.0.1:8787').replace(/\/+$/u, '');
const scenario = loadScenario(process.cwd());

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch(`${base}/contract/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /contract/translate : HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function main(): Promise<number> {
  let info: EngineInfo;
  try {
    info = (await (await fetch(`${base}/contract/info`)).json()) as EngineInfo;
  } catch {
    console.error(`API injoignable sur ${base} : lancez d'abord « npm run serve-engine ».`);
    return 2;
  }
  console.log(`Contrat ${info.contractVersion} · bibliothèque ${info.libraryVersion}`);
  let failures = 0;
  if (info.contractVersion !== scenario.contractVersion) {
    console.log(`ÉCHEC  version du contrat : attendu ${scenario.contractVersion}, reçu ${info.contractVersion}`);
    failures++;
  }

  const requests = scenario.cases.map(scenarioRequest);
  const { results: batch } = await post<{ results: TranslationResult[] }>({ requests });
  for (const [i, c] of scenario.cases.entries()) {
    const single = await post<TranslationResult>(requests[i]);
    const problems = checkCase(c, single);
    if (JSON.stringify(batch[i]) !== JSON.stringify(single)) problems.push('le lot ne donne pas le même résultat que la requête seule');
    const shown = c.repeat ? `${c.text} × ${c.repeat}` : c.text;
    if (problems.length === 0) {
      console.log(`OK     ${c.id}  « ${shown} » → ${single.status}${single.unverifiedOutput ? ` « ${single.unverifiedOutput} »` : ''}`);
    } else {
      failures++;
      console.log(`ÉCHEC  ${c.id}  « ${shown} »`);
      for (const p of problems) console.log(`         ${p}`);
    }
  }
  console.log(`\n${scenario.cases.length - failures} / ${scenario.cases.length} cas conformes`);
  return failures === 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
