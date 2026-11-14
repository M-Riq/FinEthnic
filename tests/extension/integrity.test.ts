import { describe, expect, it } from 'vitest';
import { createFakeEngine } from '../../src/content/fake-engine';
import { createContractEngine } from '../../src/engine/contract-engine';
import type { TranslationEngine, TranslationRequest } from '../../src/language/contract';
import { checkIntegrity, fingerprint, type IntegrityFailure } from '../../src/protection/integrity';
import { detectProtected } from '../../src/protection/patterns';
import { CONTRACT_EXAMPLE_SAMPLES } from '../contract/fixtures/contract-examples';
import { FAKE_ENGINE_SAMPLES } from '../contract/fixtures/fake-engine';
import { MOT_TEST_RESOURCES, MOT_TEST_SAMPLES } from '../contract/fixtures/mot-engine';
import type { ConformanceSamples } from '../contract/conformance';
import { d8Texts } from './support/page';

const NBSP = '\u00A0';
const NNBSP = '\u202F';

describe('T-PRO-13 — une écriture qui altère une valeur protégée est refusée (P3.5)', () => {
  it.each([
    // Chiffres : modifié, perdu, ajouté.
    ['Montant : 25 000 FCFA', '⟦FAKE⟧ Somme : 25 001 FCFA', 'digits-changed'],
    ['Frais : 0 FCFA', '⟦FAKE⟧ Frais : FCFA', 'digits-changed'],
    ['Total débité : 25 000 FCFA', '⟦FAKE⟧ Total : 25 000 FCFA (1)', 'digits-changed'],
    ['5 000 FCFA ou 5 000 FCFA', '⟦FAKE⟧ 5 000 FCFA', 'digits-changed'],
    // Mêmes chiffres, valeur différente : espaces, signe, devise, lettre, ordre de jeton.
    [`250${NBSP}000 FCFA`, '250 000 FCFA', 'protected-changed'],
    [`25${NNBSP}000 FCFA`, `25${NBSP}000 FCFA`, 'protected-changed'],
    ['-12 500 FCFA', '+12 500 FCFA', 'protected-changed'],
    ['\u221212 500 FCFA', '-12 500 FCFA', 'protected-changed'],
    ['Montant : 5 000 FCFA', 'Montant : 5 000 XAF', 'protected-changed'],
    ['Montant : 5 000 FCFA', 'Montant : 5 000 fcfa', 'protected-changed'],
    ['SAF-2026-OTCUQ3', 'SAF-2026-OTCUO3', 'protected-changed'],
    ['Compte Safinum', 'Compte Safinom', 'protected-changed'],
    ['Safinum Pay', 'Safinum Paie', 'protected-changed'],
    ['Écrivez à support@safinum.cm', 'Écrivez à support@safinum.com', 'protected-changed'],
    ['le 05 nov. 2026', 'le 05 novembre 2026', 'protected-changed'],
    ['+237 6 99 12 34 56', '+237 699 12 34 56', 'protected-changed'],
    ['Payer 12 FCFA, puis 21 FCFA', 'Payer 21 FCFA, puis 12 FCFA', null], // même multiensemble : accepté
  ] as const)('%j → %j : %s', (source, written, failure: IntegrityFailure | null) => {
    expect(checkIntegrity(source, written)).toBe(failure);
  });

  it('exige chaque segment signalé par le moteur, avec sa multiplicité', () => {
    expect(checkIntegrity('Bonjour, Amina', '⟦FAKE⟧ Bonjour, Amina', ['Amina'])).toBeNull();
    expect(checkIntegrity('Bonjour, Amina', '⟦FAKE⟧ Bonjour, Amena', ['Amina'])).toBe('engine-segment-missing');
    expect(checkIntegrity('Amina et Amina', 'Amina', ['Amina', 'Amina'])).toBe('engine-segment-missing');
    expect(checkIntegrity('Amina et Amina', 'Amina, Amina', ['Amina', 'Amina'])).toBeNull();
    // Segment absent de l'original, ou plus souvent signalé qu'il n'y figure : résultat incohérent (P5.8).
    expect(checkIntegrity('Bonjour', 'Mbolo, Amina', ['Amina'])).toBe('engine-segment-unknown');
    expect(checkIntegrity('Bonjour, Amina', 'Mbolo, Amina, Amina', ['Amina', 'Amina'])).toBe('engine-segment-unknown');
    // Segments invalides ignorés (le moteur est vérifié par ailleurs, I5).
    expect(checkIntegrity('Bonjour', 'Mbolo', ['', 42 as unknown as string])).toBeNull();
  });

  it('accepte une traduction qui garde toutes les valeurs, octet par octet', () => {
    expect(checkIntegrity(`Montant : 5${NNBSP}000${NBSP}FCFA`, `⟦TEST:somme⟧ : 5${NNBSP}000${NBSP}FCFA`, [`5${NNBSP}000`, 'FCFA'])).toBeNull();
    expect(checkIntegrity('Frais de transfert', 'Mot sans valeur')).toBeNull();
  });

  it('utilise le détecteur fourni', () => {
    const detect = (text: string) => (text.match(/TX-[A-Z]+/gu) ?? []) as string[];
    expect(checkIntegrity('Code TX-ABCD', 'Code TX-ABCE', [], detect)).toBe('protected-changed');
    expect(checkIntegrity('Code TX-ABCD', 'Kode TX-ABCD', [], detect)).toBeNull();
  });

  it('refuse chaque écriture d’une cible de test qui altère un jeton', () => {
    const fake = createFakeEngine({ detectProtected });
    /** Altère un seul caractère : chiffre suivant, ou casse inversée. */
    const mutate = (segment: string): string =>
      /\p{Nd}/u.test(segment)
        ? segment.replace(/\p{Nd}/u, (digit) => String((Number(digit) + 1) % 10))
        : segment.replace(/\p{L}/u, (letter) => (letter === letter.toUpperCase() ? letter.toLowerCase() : letter.toUpperCase()));
    // Cible de test : altère le premier segment protégé de chaque sortie.
    const altering = (request: TranslationRequest) => {
      const result = fake.translate(request);
      const [segment] = result.protectedSegments;
      const alter = (text: string | null) => (text === null || segment === undefined ? text : text.replace(segment, mutate(segment)));
      return { ...result, output: alter(result.output), unverifiedOutput: alter(result.unverifiedOutput) };
    };
    const requests = [...sampleRequests(FAKE_ENGINE_SAMPLES), ...d8Requests()].flatMap((request) => [
      request,
      { ...request, text: `${request.text} : 25${NNBSP}000${NBSP}FCFA` },
    ]);
    let refused = 0;
    for (const request of requests) {
      const result = altering(request);
      if (result.protectedSegments.length === 0) continue;
      for (const output of [result.output, result.unverifiedOutput]) {
        if (output === null) continue;
        expect(checkIntegrity(request.text, output, result.protectedSegments), `${request.text} → ${output}`).not.toBeNull();
        refused++;
      }
    }
    expect(refused).toBeGreaterThan(5);
  });
});

/** Toutes les requêtes d'un jeu d'échantillons de conformité. */
function sampleRequests(samples: ConformanceSamples): TranslationRequest[] {
  return [
    ...Object.values(samples.byStatus).flat(),
    ...[samples.edge, samples.pendingEdge].flatMap((edge) => (edge ? [edge.request] : [])),
  ];
}

const d8Requests = (): TranslationRequest[] =>
  [1, 2, 3, 4, 5].flatMap((page) => d8Texts(page).map(({ text }) => ({ text, sourceLang: 'fr' as const, targetLang: 'eto' as const })));

describe('les moteurs conformes passent le contrôle d’intégrité', () => {
  it.each([
    ['faux moteur avec les motifs (P3.1)', () => createFakeEngine({ detectProtected }), FAKE_ENGINE_SAMPLES],
    ['moteur MOT avec les motifs (Q14)', () => createContractEngine(MOT_TEST_RESOURCES, { cacheSize: 0, detectProtected }), MOT_TEST_SAMPLES],
    ['moteur MOT avec les motifs, exemples du contrat', () => createContractEngine(MOT_TEST_RESOURCES, { cacheSize: 0, detectProtected }), CONTRACT_EXAMPLE_SAMPLES],
  ] as const)('%s', (_, create, samples) => {
    const engine = create();
    let written = 0;
    for (const request of [...sampleRequests(samples), ...d8Requests()]) {
      const result = engine.translate(request);
      for (const output of [result.output, result.unverifiedOutput]) {
        if (output === null) continue;
        expect(checkIntegrity(request.text, output, result.protectedSegments), `${request.text} → ${output}`).toBeNull();
        written++;
      }
    }
    expect(written).toBeGreaterThan(0);
  });
});

describe('empreinte des valeurs protégées de la page (P3.5)', () => {
  const page = ['Montant : 25 000 FCFA', 'Référence : SAF-2026-OTCUQ3', 'Frais de transfert', 'Compte Safinum'];

  it('ne dépend ni de l’ordre des textes ni des textes sans valeur', () => {
    expect(fingerprint([...page].reverse())).toBe(fingerprint(page));
    expect(fingerprint(['⟦FAKE⟧ Somme : 25 000 FCFA', 'SAF-2026-OTCUQ3', 'Mot traduit', 'Safinum'])).toBe(fingerprint(page));
    expect(fingerprint([])).toBe(fingerprint(['Frais de transfert']));
  });

  it('change dès qu’une valeur est altérée, perdue ou dupliquée', () => {
    const reference = fingerprint(page);
    expect(fingerprint(page.map((text) => text.replace('25 000', `25${NBSP}000`)))).not.toBe(reference);
    expect(fingerprint(page.map((text) => text.replace('OTCUQ3', 'OTCUQ4')))).not.toBe(reference);
    expect(fingerprint(page.slice(1))).not.toBe(reference);
    expect(fingerprint([...page, 'Compte Safinum'])).not.toBe(reference);
  });

  it('ne contient aucun texte de la page', () => {
    const print = fingerprint(page);
    expect(print).toMatch(/^[0-9a-f]{14}$/u);
  });
});
