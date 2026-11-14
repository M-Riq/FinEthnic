/**
 * Réponse aux demandes de diagnostic du popup (P2.6).
 *
 * Seuls les messages venus de l'extension elle-même sont traités (`sender.id`). La réponse ne contient
 * que des compteurs (`DiagnosticSnapshot`), jamais de texte de la page.
 */
import { isDiagnosticRequest, type DiagnosticSnapshot } from '../shared/messages';
import type { ContentController } from './controller';

export type MessageListener = (
  message: unknown,
  sender: { id?: string | undefined },
  sendResponse: (response: DiagnosticSnapshot | null) => void,
) => boolean;

/** Écouteur pour `chrome.runtime.onMessage` ; il attend que le script soit prêt avant de répondre. */
export function createMessageListener(ready: Promise<ContentController>, extensionId: string): MessageListener {
  return (message, sender, sendResponse) => {
    if (sender.id !== extensionId || !isDiagnosticRequest(message)) return false;
    ready.then((controller) => controller.freshSnapshot()).then(sendResponse, () => sendResponse(null));
    // Réponse asynchrone : le canal reste ouvert jusqu'à `sendResponse`.
    return true;
  };
}
