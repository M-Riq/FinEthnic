/**
 * Moteur MOT (src/engine/contract-engine.ts) chargé avec une bibliothèque et un dictionnaire de TEST.
 * Les formes « éton » sont des marqueurs ⟦TEST:<mot>⟧ : ce ne sont pas des traductions (contrat §11).
 * Seul l'extrait de Lefff (analyse du français) est réel.
 */
import { type ContractResources, createContractEngine } from '../../../src/engine/contract-engine';
import type { D7Entry } from '../../../src/engine/d7';
import type { TranslationEngine } from '../../../src/language/contract';
import { LEXICON } from '../../engine/support';
import type { ConformanceSamples } from '../conformance';

const d7 = (fr: string, category: string): D7Entry => ({ fr, eto: `⟦TEST:${fr}⟧`, category, gloss: fr, ref: 'TEST' });

export const MOT_TEST_RESOURCES: ContractResources = {
  corpus: [
    { id: 'TST-APP', text: 'Frais de transfert', synonyms: [], definition: null },
    { id: 'TST-EDGE', text: 'Frais : 0 FCFA', synonyms: [], definition: null },
    { id: 'VOC-023', text: 'Montant', synonyms: ['somme'], definition: "La somme d'argent." },
    { id: 'SLD-001', text: 'Solde', synonyms: ['reste'], definition: null },
    { id: 'REJ-001', text: 'Compter', synonyms: [], definition: null },
  ],
  guards: ['Safinum', 'Safinum Pay', 'FCFA', 'XAF'],
  lexicon: LEXICON,
  d7: [d7('envoyer', 'VERBE'), d7('argent', 'NOM'), d7('somme', 'NOM'), d7('total', 'NOM'), d7('compter', 'VERBE')],
  ignored: [],
  critical: [],
  protectedEntries: [
    { id: 'GUARD-001', text: 'Safinum Pay', reason: 'protected-entry' },
    { id: 'TST-003', text: 'Points de fidélité', reason: 'out-of-scope' },
  ],
  // Les cibles approuvées ne contiennent pas de chiffres : le moteur vérifie les chiffres de la sortie (I5).
  approved: new Map([
    ['TST-APP', '⟦TEST:frais-de-transfert⟧'],
    ['TST-EDGE', '⟦TEST:frais⟧ : 0 FCFA'],
  ]),
  rejected: new Set(['REJ-001']),
};

export const createMotTestEngine = (): TranslationEngine => createContractEngine(MOT_TEST_RESOURCES, { cacheSize: 0 });

export const MOT_TEST_SAMPLES: ConformanceSamples = {
  byStatus: {
    APPROVED: [{ text: 'Frais de transfert', sourceLang: 'fr', targetLang: 'eto', context: { role: 'heading' } }],
    KNOWN_UNTRANSLATED: [
      // Aucun mot rendu.
      { text: '  Solde  ', sourceLang: 'fr', targetLang: 'eto' },
      // Traduction rejetée par une locutrice (I6).
      { text: 'Compter', sourceLang: 'fr', targetLang: 'eto' },
    ],
    PENDING_VALIDATION: [
      // Entrée de D8 rendue par son synonyme : traduction complète.
      { text: 'Montant', sourceLang: 'auto', targetLang: 'eto' },
      // Texte composé, brouillon (matchKind 'composed', unverifiedKind 'partial').
      { text: 'Montant à envoyer', sourceLang: 'fr', targetLang: 'eto' },
    ],
    NO_MATCH: [
      { text: 'Votre paiement a été envoyé avec succès.', sourceLang: 'fr', targetLang: 'eto' },
      // Q15 : l'anglais n'est pas encore traduit.
      { text: 'Available balance', sourceLang: 'en', targetLang: 'eto' },
    ],
    AMBIGUOUS: [],
    PROTECTED: [
      { text: '250 000 FCFA', sourceLang: 'fr', targetLang: 'eto' },
      { text: 'Safinum Pay', sourceLang: 'fr', targetLang: 'eto' },
      { text: 'Points de fidélité', sourceLang: 'fr', targetLang: 'eto' },
    ],
  },
  neverReturned: { AMBIGUOUS: 'Le moteur rattache un texte à une seule entrée de D8 : l’entrée canonique du corpus (contrat §5.2, §12).' },
  edge: {
    request: { text: '  Frais : 0 FCFA ', sourceLang: 'fr', targetLang: 'eto' },
    protectedSegments: ['0', 'FCFA'],
  },
  pendingEdge: {
    request: { text: '  Total : 5 000 FCFA ', sourceLang: 'fr', targetLang: 'eto' },
    protectedSegments: ['5 000', 'FCFA'],
  },
};
