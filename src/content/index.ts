/** Point d'entrée du script de contenu (bundle `content.js`). */
import { chromeStorage } from '../shared/chrome-storage';
import { createLogger } from '../shared/logger';
import { createSettingsStore } from '../shared/settings';
import { startContent } from './controller';
import { cssHighlights } from './diagnostic';
import { provideEngine } from './engine-provider';
import { createMessageListener } from './messaging';
import { frameSchedule } from './observer';

const ready = startContent(createSettingsStore(chromeStorage()), createLogger('content'), {
  doc: document,
  // Fabrique : le moteur n'est construit qu'à la première activation de la traduction.
  engine: provideEngine,
  schedule: frameSchedule(window),
  highlights: cssHighlights(window),
});

chrome.runtime.onMessage.addListener(createMessageListener(ready, chrome.runtime.id));
