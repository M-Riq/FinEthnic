/**
 * Échantillons de conformité du faux moteur (src/content/fake-engine.ts, P2.9).
 * Ses sorties sont des marqueurs ⟦FAKE⟧ suivis du texte original : ce ne sont pas des traductions.
 */
import type { ConformanceSamples } from '../conformance';

export const FAKE_ENGINE_SAMPLES: ConformanceSamples = {
  byStatus: {
    APPROVED: [
      { text: 'Frais de transfert', sourceLang: 'fr', targetLang: 'eto', context: { role: 'heading', step: 2 } },
      { text: 'Available balance', sourceLang: 'auto', targetLang: 'eto' },
    ],
    PENDING_VALIDATION: [
      { text: 'Confirmer le transfert', sourceLang: 'fr', targetLang: 'eto' },
      // Brouillon incomplet (`partial`, composé).
      { text: 'Effectuer un transfert', sourceLang: 'auto', targetLang: 'eto' },
    ],
    KNOWN_UNTRANSLATED: [{ text: 'Total à débiter', sourceLang: 'fr', targetLang: 'eto' }],
    NO_MATCH: [{ text: 'Texte inconnu', sourceLang: 'fr', targetLang: 'eto' }],
    AMBIGUOUS: [{ text: 'Retour', sourceLang: 'fr', targetLang: 'eto' }],
    PROTECTED: [
      { text: 'Safinum Pay', sourceLang: 'fr', targetLang: 'eto' },
      { text: '25 000 FCFA', sourceLang: 'auto', targetLang: 'eto' },
    ],
  },
  edge: {
    request: { text: '  Frais : 0 FCFA ', sourceLang: 'fr', targetLang: 'eto' },
    protectedSegments: ['0', 'FCFA'],
  },
  pendingEdge: {
    request: { text: '  Total débité : 5 000 FCFA ', sourceLang: 'fr', targetLang: 'eto' },
    protectedSegments: ['5 000', 'FCFA'],
  },
};
