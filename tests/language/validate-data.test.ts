import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateEntries, type Issue } from '../../scripts/lib/data-validation';
import { checkEtonCharacters, checkTextEncoding } from '../../scripts/lib/eton-charset';
import { loadSchemaValidators } from '../../scripts/lib/schemas';

// Les fixtures ne contiennent aucune forme Éton : seulement des marqueurs ⟦TEST:<id>⟧.
type AnyEntry = Record<string, any>;

const validators = loadSchemaValidators();
const FILE = 'fixtures/valid-entries.json';
const VALID: AnyEntry[] = JSON.parse(
  readFileSync(new URL('./fixtures/entries/valid-entries.json', import.meta.url), 'utf8'),
);

const run = (entries: unknown): Issue[] => validateEntries([{ file: FILE, data: entries }], validators);

/** Valide une copie des fixtures après modification de l'entrée `id`. */
function withChange(id: string, change: (entry: AnyEntry) => void): Issue[] {
  const entries = structuredClone(VALID);
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error(`fixture absente : ${id}`);
  change(entry);
  return run(entries);
}

const summary = (issues: Issue[]): string[] => issues.map((i) => `[${i.id}] ${i.path} — ${i.message}`);

describe('validate-data', () => {
  it('ne signale rien sur les fixtures valides', () => {
    expect(summary(run(VALID))).toEqual([]);
  });

  it('T-LIB-06 : signale une cible qui perd une variable', () => {
    const issues = withChange('TST-010', (e) => { e.target.eto.text = '⟦TEST:TST-010⟧ {montant}'; });
    expect(summary(issues)).toEqual([expect.stringMatching(/^\[TST-010\] \/2\/target\/eto\/text — variables de la cible/u)]);
  });

  it('T-LIB-06 : signale une source dont les variables diffèrent des variables déclarées', () => {
    const issues = withChange('TST-010', (e) => { e.source.fr.variants = ['Frais : {montant}']; });
    expect(summary(issues)).toEqual([expect.stringContaining('/source/fr/variants/0 — variables de la source')]);
  });

  it('T-LIB-07 / T-DIC-01 : signale un texte non normalisé en NFC', () => {
    const issues = withChange('VOC-023', (e) => { e.source.fr.simple.definition = 'La somme d\u2019argent re\u0301glée.'; });
    expect(summary(issues)).toEqual([expect.stringContaining('/source/fr/simple/definition — texte non normalisé en NFC')]);
  });

  it('T-DIC-02 : signale ε grec, U+FFFD et le mojibake', () => {
    const greek = withChange('TST-011', (e) => { e.target.eto.proposals[0].text = '⟦TEST:TST-011⟧ \u03B5'; });
    expect(summary(greek)).toEqual([expect.stringContaining('U+03B5')]);

    const replacement = withChange('TST-011', (e) => { e.target.eto.proposals[0].text = '⟦TEST:TST-011⟧ \uFFFD'; });
    expect(summary(replacement).length).toBeGreaterThan(0);
    expect(summary(replacement).every((s) => s.includes('U+FFFD'))).toBe(true);

    const mojibake = withChange('VOC-023', (e) => { e.source.fr.simple.definition = 'La somme Ã© envoyer.'; });
    expect(summary(mojibake)).toEqual([expect.stringContaining('mojibake')]);
  });

  it('T-DIC-02 : détecte le mojibake Windows-1252 sans gêner le français correct', () => {
    for (const damaged of ['Ã‰tat', 'ReÃ§u', 'Ã‡a', 'Å“uvre', 'Â« Frais Â»', 'lâ€™envoi', '10 â‚¬']) {
      expect(checkTextEncoding(damaged), damaged).toEqual([expect.stringContaining('mojibake')]);
    }
    expect(checkTextEncoding('État reçu : « Ça » l’œuvre, 10 €, Âge, Ångström')).toEqual([]);
  });

  it('T-DIC-02 : refuse un caractère hors de la liste blanche dans un texte Éton', () => {
    const issues = withChange('TST-011', (e) => { e.target.eto.proposals[0].text = '⟦TEST:TST-011⟧ ç'; });
    expect(summary(issues)).toEqual([expect.stringContaining('caractère non autorisé pour l\'Éton : U+00E7')]);
  });

  it('accepte les lettres spéciales et les tons de la liste blanche, y compris décomposés', () => {
    // Suite de caractères SANS signification, choisie seulement pour couvrir la liste blanche. Ce n'est pas de l'Éton.
    const sample = ['ɛ', 'Ɛ', 'ɔ', 'Ɔ', 'ŋ', 'Ŋ', 'ə', 'Ǝ', 'a\u0300', 'e\u0301', 'o\u0302', 'u\u030C', 'i\u0304', 'ɔ\u0300', 'ɛ\u0301'].join(' ');
    expect(checkEtonCharacters(`⟦TEST⟧ {montant} « ${sample} » ’ … ?`)).toEqual([]);
  });

  it('signale VALIDATED_OBALA sans validation linguistique', () => {
    const issues = withChange('TST-010', (e) => { e.target.eto.validation.linguistic = 'PENDING'; });
    expect(summary(issues)).toEqual([expect.stringContaining('incohérence : translationStatus = VALIDATED_OBALA')]);
  });

  it('signale une validation sans relecture tracée', () => {
    const issues = withChange('TST-010', (e) => {
      e.target.eto.validation.reviews = e.target.eto.validation.reviews.filter((r: AnyEntry) => r.aspect !== 'financialMeaning');
    });
    expect(summary(issues)).toEqual([expect.stringContaining('financialMeaning = VALIDATED sans relecture tracée')]);
  });

  it('signale un statut sans proposition alors qu’une proposition existe, et l’inverse', () => {
    const withProposal = withChange('TST-011', (e) => { e.target.eto.translationStatus = 'TRANSLATION_PENDING'; });
    expect(summary(withProposal)).toEqual([expect.stringContaining('TRANSLATION_PENDING alors qu’une proposition existe')]);

    const withoutProposal = withChange('VOC-023', (e) => { e.target.eto.translationStatus = 'REVIEW_PENDING'; });
    expect(summary(withoutProposal)).toEqual([expect.stringContaining('REVIEW_PENDING sans aucune proposition')]);
  });

  it('signale un ID en double, y compris entre deux fichiers', () => {
    const issues = validateEntries(
      [{ file: 'a.json', data: VALID }, { file: 'b.json', data: [VALID[0]] }],
      validators,
    );
    expect(issues.map((i) => `${i.file} ${i.message}`)).toEqual(['b.json ID en double (déjà présent dans a.json)']);
  });

  it('signale un lien vers un ID inexistant ou vers l’entrée elle-même', () => {
    const dangling = withChange('P4-3', (e) => { e.links.corpusRef.id = 'VOC-999'; });
    expect(summary(dangling)).toEqual([expect.stringContaining('/links/corpusRef/id — lien vers un ID inexistant : VOC-999')]);

    const self = withChange('VOC-008', (e) => { e.links.relatedTo = ['VOC-008']; });
    expect(summary(self)).toEqual([expect.stringContaining('lien vers l’entrée elle-même')]);
  });

  it('signale les erreurs de schéma et un fichier qui n’est pas un tableau', () => {
    const issues = withChange('GUARD-001', (e) => { e.target.eto = structuredClone(VALID[0]?.target.eto); });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.id === 'GUARD-001' && i.message.startsWith('schéma : '))).toBe(true);

    expect(summary(run({ entries: VALID }))).toEqual(['[null] / — le fichier doit contenir un tableau JSON d’entrées']);
  });
});
