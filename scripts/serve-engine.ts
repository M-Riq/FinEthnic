/**
 * Lance l'API HTTP locale du moteur français → éton (MOT5, décision M3).
 *
 *   npm run serve-engine -- [--port <port>]
 *
 * Écoute sur 127.0.0.1 uniquement (port 8787 par défaut, ou variable PORT). D7 est lu dans sa conversion
 * JSON versionnée (npm run convert-d7, Q17 révisée).
 */
import { parseArgs } from 'node:util';
import { createContractEngine } from '../src/engine/contract-engine';
import { createEngine } from '../src/engine/engine';
import { loadContractResources, MissingDictionaryError } from './lib/engine-load';
import { createEngineServer } from './lib/engine-server';

const HOST = '127.0.0.1';
const { values } = parseArgs({ options: { port: { type: 'string' } } });
const port = Number(values.port ?? process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Port invalide : ${values.port ?? process.env.PORT}`);
  process.exit(2);
}

try {
  const started = performance.now();
  const resources = loadContractResources(process.cwd());
  const engine = createEngine(resources);
  const contract = createContractEngine(resources);
  const info = engine.info();
  const contractInfo = contract.info();
  createEngineServer(engine, contract).listen(port, HOST, () => {
    console.log(`Moteur ${info.version} prêt en ${Math.round(performance.now() - started)} ms : http://${HOST}:${port}`);
    console.log(`D8 : ${info.d8Entries} entrées · D7 : ${info.d7Entries} entrées · règles actives : ${info.activeRules.join(', ')}`);
    console.log(`Contrat ${contractInfo.contractVersion} · bibliothèque ${contractInfo.libraryVersion}`);
    console.log('Routes : GET /info · POST /translate {"text": "…"} ou {"texts": ["…"]}');
    console.log('Contrat : GET /contract/info · POST /contract/translate <TranslationRequest> ou {"requests": [...]}');
  });
} catch (error) {
  if (error instanceof MissingDictionaryError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
