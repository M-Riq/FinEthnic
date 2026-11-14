import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readLibraryEntries } from '../../scripts/lib/data-files';
import { analyzeDuplicates, parseReviewLists, renderDuplicatesMarkdown, type ReviewLists } from '../../scripts/lib/duplicates';
import type { LibraryEntry } from '../../scripts/lib/library-entry';

// Les cibles de test sont des marqueurs ⟦TEST:…⟧, jamais des formes Éton.
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ENTRIES = readLibraryEntries(ROOT).entries;
const LISTS = parseReviewLists(JSON.parse(readFileSync(join(ROOT, 'data/language-resources/duplicate-review.json'), 'utf8')));

/** Copie des entrées réelles avec des cibles de test posées sur certaines entrées. */
function withTargets(targets: Record<string, string>): LibraryEntry[] {
  const entries = structuredClone(ENTRIES);
  for (const [id, text] of Object.entries(targets)) {
    const eto = entries.find((e) => e.id === id)?.target.eto;
    if (!eto) throw new Error(`entrée sans cible : ${id}`);
    eto.text = text;
  }
  return entries;
}

describe('rapport de doublons (BM2.4)', () => {
  const report = analyzeDuplicates(ENTRIES, LISTS);

  it('ne trouve ni doublon strict ni point à arbitrer sur les données importées', () => {
    expect(report.entryCount).toBe(379);
    expect(report.strict).toEqual([]);
    expect(report.normalized).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.pageGroups).toHaveLength(5);
    expect(report.exactLinks).toHaveLength(36);
    expect(report.meaningLinks).toHaveLength(16);
  });

  it('relève les 12 synonymes égaux au terme d\'une autre entrée, et FCFA à part (GUARD)', () => {
    expect(report.synonymCollisions).toHaveLength(12);
    expect(report.synonymCollisions).toContainEqual({ entry: { id: 'VOC-016', text: 'Argent' }, synonym: 'monnaie', matches: ['VOC-017'] });
    expect(report.synonymCollisions.find((h) => h.entry.id === 'VOC-024')?.matches).toEqual(['VOC-023']);
    expect(report.synonymsProtected).toEqual([{ entry: { id: 'VOC-019', text: 'Franc CFA (FCFA)' }, synonym: 'FCFA', matches: ['GUARD-003'] }]);
    expect(report.synonymsInVariants).toEqual([]);
  });

  it('associe les 7 libellés à leur gabarit, avec les pages qui les affichent', () => {
    expect(report.labelTemplates).toHaveLength(7);
    expect(report.labelTemplates.every((p) => p.status === 'untranslated')).toBe(true);
    expect(report.labelTemplates.find((p) => p.template.id === 'MSG-037')).toMatchObject({ label: { id: 'VOC-028' }, pages: ['P2-8', 'P4-4', 'P5-5'] });
    expect(report.labelTemplates.find((p) => p.template.id === 'MSG-038')).toMatchObject({ label: { id: 'P4-5' }, pages: ['P4-5', 'P5-6'] });
  });

  it('T-LIB-09 : avertit (sans bloquer) si le libellé est traduit autrement dans son gabarit', () => {
    const divergent = analyzeDuplicates(withTargets({ 'P4-5': '⟦TEST:A⟧', 'MSG-038': '⟦TEST:B⟧ {total} {devise}' }), LISTS);
    expect(divergent.labelTemplates.find((p) => p.template.id === 'MSG-038')?.status).toBe('divergent');
    expect(divergent.warnings).toEqual([expect.stringContaining('T-LIB-09')]);
    expect(divergent.errors).toEqual([]);

    const consistent = analyzeDuplicates(withTargets({ 'P4-5': '⟦TEST:A⟧', 'MSG-038': '⟦TEST:A⟧ {total} {devise}' }), LISTS);
    expect(consistent.labelTemplates.find((p) => p.template.id === 'MSG-038')?.status).toBe('consistent');
    expect(consistent.warnings).toEqual([]);
  });

  it('avertit si une paire opposée partage la même cible', () => {
    const r = analyzeDuplicates(withTargets({ 'ACT-016': '⟦TEST:X⟧', 'ACT-017': '⟦TEST:X⟧' }), LISTS);
    expect(r.warnings).toEqual([expect.stringContaining('Paire opposée « Confirmer / Annuler »')]);
  });

  it('signale un ID inconnu dans les listes tenues à la main', () => {
    const lists: ReviewLists = { ...LISTS, distinct: [...LISTS.distinct, { ids: ['VOC-023', 'VOC-999'], label: 'essai' }] };
    expect(analyzeDuplicates(ENTRIES, lists).errors).toEqual([expect.stringContaining('ID inconnu VOC-999')]);
  });

  it('refuse des listes mal formées', () => {
    expect(() => parseReviewLists([])).toThrow('objet JSON attendu');
    expect(() => parseReviewLists({ ...LISTS, oppositions: [{ ids: ['VOC-049'], label: 'seul' }] })).toThrow('au moins deux ID');
  });

  it('ne modifie pas les entrées et produit toujours le même rapport', () => {
    const before = structuredClone(ENTRIES);
    const first = renderDuplicatesMarkdown(analyzeDuplicates(ENTRIES, LISTS));
    expect(ENTRIES).toEqual(before);
    expect(renderDuplicatesMarkdown(analyzeDuplicates([...ENTRIES].reverse(), LISTS))).toBe(first);
  });
});
