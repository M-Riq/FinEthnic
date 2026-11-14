/** Point d'entrée du popup (bundle `popup/popup.js`). */
import { chromeStorage } from '../shared/chrome-storage';
import { createLogger } from '../shared/logger';
import { DIAGNOSTIC_REQUEST, type DiagnosticRequest } from '../shared/messages';
import { createSettingsStore } from '../shared/settings';
import { initPopup } from './popup';

/** Demande les compteurs au script de contenu de l'onglet actif (sans permission `tabs`). */
async function requestDiagnostic(): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('Aucun onglet actif');
  const request: DiagnosticRequest = { type: DIAGNOSTIC_REQUEST };
  return chrome.tabs.sendMessage(tab.id, request);
}

void initPopup(document, createSettingsStore(chromeStorage()), createLogger('popup'), requestDiagnostic);
