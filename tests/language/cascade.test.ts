import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  applyOutcome, cascadeEntry, checkCascadeResources, prepareResources, renderCascadeReport,
  type Dictionary, type DictionaryEntry, type GrammarRules,
} from '../../scripts/lib/cascade';
import { DEFAULT_DATA_DIRS, readLibraryEntries } from '../../scripts/lib/data-files';
import { validateEntries } from '../../scripts/lib/data-validation';
import type { LibraryEntry } from '../../scripts/lib/library-entry';
import { loadSchemaValidators } from '../../scripts/lib/schemas';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = join(ROOT, 'tests/language/fixtures/cascade');
const DICTIONARY = join(FIXTURES, 'test-dictionary.json');
const RULES = join(FIXTURES, 'test-grammar-rules.json');
const dictionary = JSON.parse(readFileSync(DICTIONARY, 'utf8')) as Dictionary;
const grammar = JSON.parse(readFileSync(RULES, 'utf8')) as GrammarRules;
const validators = loadSchemaValidators();
const real = readLibraryEntries(ROOT).entries;
const realEntry = (id: string): LibraryEntry => structuredClone(real.find((e) => e.id === id) as LibraryEntry);

const res = (extra: DictionaryEntry[] = []) =>
  prepareResources({ ...dictionary, entries: [...dictionary.entries, ...extra] }, grammar, ['Safinum', 'Safinum Pay', 'FCFA']);

/** Entrée de test bâtie sur VOC-016 (terme) : texte, synonymes et définition remplacés. */
const term = (text: string, synonyms: string[], definition: string | null): LibraryEntry => {
  const e = realEntry('VOC-016');
  e.id = 'VOC-901';
  e.source.fr = { ...e.source.fr, text, simple: { synonyms, definition } };
  return e;
};

describe('cascade terme → synonymes → définition (BM3.7, PROJECT_CONTEXT §3.10)', () => {
  it('T-DIC-06 : propose le terme quand il est dans le dictionnaire', () => {
    const o = cascadeEntry(term('Portefeuille', ['bourse'], 'Un sac pour garder l’argent.'), res());
    expect(o.result).toBe('proposed');
    expect(o.proposals).toEqual([{ text: '⟦TEST:portefeuille⟧', method: 'direct', from: 'Portefeuille', rules: [], missing: [], generatedBy: 'propose-translations@0.1.0' }]);
    expect(o.attempts.map((a) => a.level)).toEqual([1]);
  });

  it('T-DIC-07 : prend le 2ᵉ synonyme quand le terme et le 1ᵉʳ synonyme manquent, sans tenter la définition', () => {
    const o = cascadeEntry(term('Transaction', ['échange', 'envoi'], 'L’argent restant.'), res());
    expect(o.method).toBe('synonym');
    expect(o.proposals).toHaveLength(1);
    expect(o.proposals[0]).toMatchObject({ from: 'envoi', text: '⟦TEST:envoi⟧', missing: ['transaction', 'échange'] });
    expect(o.attempts.some((a) => a.level === 3)).toBe(false);
  });

  it('propose tous les synonymes qui réussissent, dans l’ordre de D8', () => {
    const o = cascadeEntry(term('Transaction', ['opération', 'échange', 'envoi'], null), res());
    expect(o.proposals.map((p) => p.from)).toEqual(['opération', 'envoi']);
    expect(o.proposals.map((p) => p.missing)).toEqual([['transaction'], ['transaction', 'échange']]);
  });

  it('T-DIC-08 : assemble la définition selon une règle et liste les règles appliquées', () => {
    const o = cascadeEntry(term('Solde', ['reste'], 'L’argent restant.'), res());
    expect(o.method).toBe('definition');
    // « L’ » est ignoré (liste de test) ; TEST-R2 inverse NOM + ADJ ; le point est recopié.
    expect(o.proposals).toEqual([expect.objectContaining({ text: '⟦TEST:restant⟧ ⟦TEST:argent⟧.', from: 'L’argent restant.', rules: ['TEST-R2'], missing: ['solde', 'reste'] })]);
    expect(o.evidence.map((e) => e.form)).toEqual(['⟦TEST:argent⟧', '⟦TEST:restant⟧']);
  });

  it('T-DIC-09 : un mot manquant dans la définition → aucune proposition, statut conservé, mot dans le rapport', () => {
    const entry = term('Solde', ['reste'], 'L’argent qui reste.');
    const o = cascadeEntry(entry, res());
    expect(o.result).toBe('failed');
    expect(o.proposals).toEqual([]);
    expect(applyOutcome(entry, o)).toBe(entry);
    expect(entry.target.eto?.translationStatus).toBe('TRANSLATION_PENDING');
    const report = renderCascadeReport([o], { dictionary: { kind: 'test', source: 'TEST', entries: 1 }, grammar: { source: 'TEST', rules: 2 }, written: false });
    expect(report).toContain('| qui | 1 | VOC-901 |');
    expect(report).toContain('| Échec : reste en `TRANSLATION_PENDING`, confiée aux locutrices | 1 |');
  });

  it('refuse une suite de mots qu’aucune règle ne couvre et la signale', () => {
    const o = cascadeEntry(term('Solde', [], 'Argent portefeuille.'), res());
    expect(o.result).toBe('failed');
    expect(o.attempts[1]).toMatchObject({ missing: [], uncovered: ['NOM + NOM'] });
  });

  it('T-DIC-11 : recopie les variables à l’identique, et refuse une proposition qui les perd', () => {
    const e = realEntry('MSG-038');
    e.source.fr = { ...e.source.fr, simple: { synonyms: ['Tu peux utiliser {total} {devise}.'], definition: 'Argent restant.' } };
    const o = cascadeEntry(e, res());
    expect(o.proposals.map((p) => p.text)).toEqual(['⟦TEST:tu⟧ ⟦TEST:peux⟧ ⟦TEST:utiliser⟧ {total} {devise}.']);
    const library = real.map((x) => (x.id === e.id ? applyOutcome(e, o) : x));
    expect(validateEntries([{ file: 'all.json', data: library }], validators)).toEqual([]);

    e.source.fr = { ...e.source.fr, simple: { synonyms: [], definition: 'Argent restant.' } };
    const lost = cascadeEntry(e, res());
    expect(lost.result).toBe('failed');
    expect(lost.attempts[1]?.problems).toEqual(['variables différentes de la source (devise,total)']);
  });

  it('refuse une proposition qui recopie un signe hors de la liste blanche éton (ex. code USSD), sans bloquer les autres', () => {
    const o = cascadeEntry(term('Code USSD', ['envoi *126#'], 'Envoi.'), res());
    expect(o.attempts[1]?.problems).toEqual([
      'texte proposé refusé : caractère non autorisé pour l\'Éton : U+002A « * »',
      'texte proposé refusé : caractère non autorisé pour l\'Éton : U+0023 « # »',
    ]);
    expect(o.proposals).toEqual([expect.objectContaining({ method: 'definition', text: '⟦TEST:envoi⟧.' })]);
  });

  it('recopie les jetons protégés et liste toutes les formes d’un mot à plusieurs sens', () => {
    const o = cascadeEntry(realEntry('PAG-010'), res());
    expect(o.proposals[0]?.text).toBe('⟦TEST:compte-1⟧ Safinum');
    expect(o.evidence).toEqual([
      { form: '⟦TEST:compte-1⟧', gloss: 'compte (en banque)', ref: 'TEST p. 2' },
      { form: '⟦TEST:compte-2⟧', gloss: 'compte (calcul)', ref: 'TEST p. 3' },
    ]);
  });

  it('ne traite pas les textes de pages partagés ou répétés ni les entrées déjà proposées ; niveau 1 seul pour un lien de sens', () => {
    expect(cascadeEntry(realEntry('P2-6'), res()).skip).toEqual({ reason: 'page-shared', detail: 'PAG-010' });
    expect(cascadeEntry(realEntry('P4-3'), res()).skip?.reason).toBe('page-repeat');
    const pending = applyOutcome(realEntry('VOC-016'), cascadeEntry(realEntry('VOC-016'), res()));
    expect(cascadeEntry(pending, res()).skip).toEqual({ reason: 'already-processed', detail: 'REVIEW_PENDING' });
    const meaning = cascadeEntry(realEntry('P1-1'), res());
    expect(meaning).toMatchObject({ result: 'failed', levelOneOnly: true });
    expect(meaning.attempts.map((a) => a.from)).toEqual(['Votre compte']);
  });

  it('refuse des ressources incohérentes', () => {
    const bad: Dictionary = { kind: 'test', source: 'x', entries: [{ fr: 'argent', eto: 'forme-sans-marqueur', category: 'NOM', gloss: 'argent', ref: 'p. 1' }] };
    expect(checkCascadeResources(bad, grammar)).toEqual(['dictionnaire, entrée 1 (« argent ») : un dictionnaire de test n\'accepte que des formes ⟦TEST:…⟧']);
    expect(checkCascadeResources({ ...dictionary, kind: 'd7' }, grammar)[0]).toContain('marqueur de test dans un dictionnaire D7');
    const rule = { id: 'R-1', description: 'x', ref: 'p. 1', pattern: ['NOM', 'ADJ'], order: [1, 1] };
    expect(checkCascadeResources(dictionary, { ...grammar, rules: [rule] })).toEqual(['règle R-1 : « order » doit reprendre chaque position du motif (1 à 2) une seule fois']);
  });
});

describe('npm run propose-translations', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'finethnic-cascade-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/propose-translations.ts', ...args], { cwd: ROOT, encoding: 'utf8' });
  const snapshot = (root: string): string => readLibraryEntries(root).files.map((f) => JSON.stringify(f.data)).join('\n');
  const copy = (name: string): string => {
    const root = join(tmp, name);
    for (const d of DEFAULT_DATA_DIRS) cpSync(join(ROOT, d), join(root, d), { recursive: true });
    return root;
  };

  it('refuse d’écrire des formes de test dans le data/ du dépôt', () => {
    const before = snapshot(ROOT);
    const write = run('--dictionary', DICTIONARY, '--write', '--report', join(tmp, 'r.md'));
    expect(write.status).toBe(1);
    expect(write.stderr).toContain('écriture dans le data/ de ce dépôt refusée');
    const report = run('--dictionary', DICTIONARY);
    expect(report.status).toBe(1);
    expect(report.stderr).toContain('rapport dans le data/ de ce dépôt refusé');
    expect(snapshot(ROOT)).toBe(before);
  });

  it('en essai, n’écrit que le rapport', () => {
    const root = copy('dry');
    const before = snapshot(root);
    const r = run('--dictionary', DICTIONARY, '--rules', RULES, '--root', root, '--report', join(root, 'report.md'));
    expect(r.status, r.stderr).toBe(0);
    expect(snapshot(root)).toBe(before);
    expect(readFileSync(join(root, 'report.md'), 'utf8')).toContain('⚠ **Dictionnaire de TEST**');
  });

  it('T-DIC-05 : avec --write, n’ajoute que des propositions en REVIEW_PENDING, jamais de texte ni de validation', () => {
    const root = copy('write');
    const before = new Map(readLibraryEntries(root).entries.map((e) => [e.id, e]));
    const r = run('--dictionary', DICTIONARY, '--rules', RULES, '--root', root, '--write', '--report', join(root, 'report.md'));
    expect(r.status, r.stderr).toBe(0);

    const { files, entries } = readLibraryEntries(root);
    expect(validateEntries(files, validators)).toEqual([]);
    const changed = entries.filter((e) => JSON.stringify(e) !== JSON.stringify(before.get(e.id)));
    expect(changed.map((e) => e.id).sort()).toEqual([
      'ACT-001', 'ACT-003', 'ACT-004', 'MSG-001', 'MSG-002', 'PAG-001', 'PAG-010', 'PAG-012', 'SEC-002', 'VOC-001', 'VOC-016', 'VOC-040', 'VOC-041', 'VOC-044',
    ]);
    for (const e of entries) {
      expect(e.target.eto?.text ?? null).toBeNull();
      expect(e.target.eto?.translationStatus).not.toBe('VALIDATED_OBALA');
    }
    for (const e of changed) {
      expect(e.target.eto?.translationStatus).toBe('REVIEW_PENDING');
      expect({ ...e, target: null }).toEqual({ ...before.get(e.id), target: null });
    }
    expect(entries.find((e) => e.id === 'ACT-003')?.target.eto?.proposals).toMatchObject([{ method: 'synonym', from: 'envoyer', missing: ['transférer'] }]);
    // Exemple de T-DIC-11 dans les vraies données : MSG-002 « Tu peux utiliser {montant} {devise}. »
    expect(entries.find((e) => e.id === 'MSG-002')?.target.eto?.proposals.map((p) => p.text)).toEqual(['⟦TEST:tu⟧ ⟦TEST:peux⟧ ⟦TEST:utiliser⟧ {montant} {devise}.']);

    const again = run('--dictionary', DICTIONARY, '--rules', RULES, '--root', root, '--write', '--report', join(root, 'report.md'));
    expect(again.status, again.stderr).toBe(0);
    expect(readFileSync(join(root, 'report.md'), 'utf8')).toContain('| Déjà en relecture ou validée | 14 |');
  });
});
