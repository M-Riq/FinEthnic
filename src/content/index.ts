/** Point d'entrée du script de contenu (bundle `content.js`). */
import { chromeStorage } from '../shared/chrome-storage';
import { createLogger } from '../shared/logger';
import { createSettingsStore } from '../shared/settings';
import { startContent } from './controller';
import { createChromeCorpusStore, startCorpusSync } from './corpus-sync';
import { cssHighlights } from './diagnostic';
import { ENGINE_DATA } from './engine-data';
import { provideEngine } from './engine-provider';
import { createMessageListener } from './messaging';
import { frameSchedule } from './observer';

const storage = chromeStorage();
const { engine, loaded } = provideEngine(ENGINE_DATA);
// D8 enrichi : seulement avec le vrai moteur (le faux moteur de développement n'apprend rien).
const corpus = loaded ? startCorpusSync({ loaded, store: createChromeCorpusStore(storage) }) : null;

const ready = startContent(createSettingsStore(storage), createLogger('content'), {
  doc: document,
  engine,
  schedule: frameSchedule(window),
  highlights: cssHighlights(window),
  ...(loaded ? { lexicon: loaded.resources.lexicon } : {}),
  corpus,
});

chrome.runtime.onMessage.addListener(createMessageListener(ready, chrome.runtime.id));
