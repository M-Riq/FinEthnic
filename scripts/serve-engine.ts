/**
 * Lance l'API HTTP locale du moteur français → éton (MOT5, décision M3).
 *
 *   npm run serve-engine -- [--port <port>]
 *
 * Écoute sur 127.0.0.1 uniquement (port 8787 par défaut, ou variable PORT). D7 doit avoir été importé
 * (npm run import-dictionary) : il reste hors de Git (Q17).
 */
import { parseArgs } from 'node:util';
import { createEngine } from '../src/engine/engine';
import { loadEngineResources, MissingDictionaryError } from './lib/engine-load';
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
  const engine = createEngine(loadEngineResources(process.cwd()));
  const info = engine.info();
  createEngineServer(engine).listen(port, HOST, () => {
    console.log(`Moteur ${info.version} prêt en ${Math.round(performance.now() - started)} ms : http://${HOST}:${port}`);
    console.log(`D8 : ${info.d8Entries} entrées · D7 : ${info.d7Entries} entrées · règles actives : ${info.activeRules.join(', ')}`);
    console.log('Routes : GET /info · POST /translate {"text": "…"} ou {"texts": ["…"]}');
  });
} catch (error) {
  if (error instanceof MissingDictionaryError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
