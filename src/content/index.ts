/** Point d'entrée du script de contenu (bundle `content.js`). */
import { chromeStorage } from '../shared/chrome-storage';
import { createLogger } from '../shared/logger';
import { createSettingsStore } from '../shared/settings';
import { startContent } from './controller';

void startContent(createSettingsStore(chromeStorage()), createLogger('content'));
