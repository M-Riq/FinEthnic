/** Point d'entrée du popup (bundle `popup/popup.js`). */
import { chromeStorage } from '../shared/chrome-storage';
import { createLogger } from '../shared/logger';
import { createSettingsStore } from '../shared/settings';
import { initPopup } from './popup';

void initPopup(document, createSettingsStore(chromeStorage()), createLogger('popup'));
