/**
 * Exemples du contrat (INTEGRATION_CONTRACT.md §12) sous forme d'échantillons de conformité.
 * Les ID sont ceux du §12. Les cibles sont des marqueurs ⟦TEST:<id>⟧ : ce ne sont pas des traductions.
 * Ces mêmes requêtes serviront au vrai moteur (BM5) avec tests/language/fixtures/test-lexicon.json.
 */
import type { ConformanceSamples } from '../conformance';

export const CONTRACT_EXAMPLE_SAMPLES: ConformanceSamples = {
  byStatus: {
    APPROVED: [
      { text: 'Frais de transfert', sourceLang: 'fr', targetLang: 'eto', context: { role: 'heading' } },
      { text: 'Frais : 0 FCFA', sourceLang: 'fr', targetLang: 'eto' },
      { text: 'Votre transfert a été envoyé avec succès.', sourceLang: 'fr', targetLang: 'eto' },
    ],
    KNOWN_UNTRANSLATED: [
      { text: '  Montant  ', sourceLang: 'fr', targetLang: 'eto' },
      { text: 'Available balance', sourceLang: 'auto', targetLang: 'eto' },
    ],
    PENDING_VALIDATION: [{ text: 'Confirmer le transfert', sourceLang: 'fr', targetLang: 'eto' }],
    NO_MATCH: [{ text: 'Votre paiement a été envoyé avec succès.', sourceLang: 'fr', targetLang: 'eto' }],
    AMBIGUOUS: [{ text: 'Retour', sourceLang: 'fr', targetLang: 'eto' }],
    PROTECTED: [
      { text: '250 000 FCFA', sourceLang: 'fr', targetLang: 'eto' },
      { text: 'Safinum Pay', sourceLang: 'fr', targetLang: 'eto' },
      // Cas hypothétique hors §12 : entrée hors périmètre (contrat §5.2).
      { text: 'Points de fidélité', sourceLang: 'fr', targetLang: 'eto' },
    ],
  },
  edge: {
    request: { text: '  Frais : 0 FCFA ', sourceLang: 'fr', targetLang: 'eto' },
    protectedSegments: ['0', 'FCFA'],
  },
};
