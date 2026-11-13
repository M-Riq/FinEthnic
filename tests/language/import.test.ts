import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { readLibraryEntries } from '../../scripts/lib/data-files';
import { validateEntries } from '../../scripts/lib/data-validation';
import { buildLibraryFromD8, ImportError, readD8, serializeEntries } from '../../scripts/lib/d8-import';
import type { LibraryEntry } from '../../scripts/lib/library-entry';
import { loadSchemaValidators } from '../../scripts/lib/schemas';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const D8_MARKDOWN = readFileSync(join(ROOT, 'docs/sources/corpus_fusionne_SAFINUM_Eton.md'), 'utf8');
const d8 = readD8(D8_MARKDOWN);
const result = buildLibraryFromD8(d8);
const files = [...result.corpusFiles, ...result.pageFiles];
const entries = files.flatMap((f) => f.entries);
const byId = new Map(entries.map((e) => [e.id, e]));
const get = (id: string): LibraryEntry => {
  const e = byId.get(id);
  if (!e) throw new Error(`entrée absente : ${id}`);
  return e;
};

const expectImportError = (markdown: string, message: string): void => {
  try {
    buildLibraryFromD8(readD8(markdown));
  } catch (error) {
    expect(error).toBeInstanceOf(ImportError);
    expect((error as ImportError).problems.join('\n')).toContain(message);
    return;
  }
  throw new Error('ImportError attendue');
};

describe('import de D8 (BM2.1 à BM2.3)', () => {
  it('T-LIB-01 : 315 entrées du corpus et 60 textes de pages, ID identiques à D8', () => {
    const corpus = entries.filter((e) => e.kind !== 'page' && e.kind !== 'guard').map((e) => e.id);
    expect(corpus.sort()).toEqual(d8.corpus.map((r) => r.id).sort());
    expect(corpus).toHaveLength(315);
    expect(corpus).not.toContain('MSG-025');
    expect(corpus).not.toContain('MSG-056');

    const pages = entries.filter((e) => e.kind === 'page');
    expect(pages.map((e) => e.id).sort()).toEqual(d8.control.map((r) => r.pageId).sort());
    expect(result.pageFiles.map((f) => f.entries.length)).toEqual([15, 13, 10, 12, 10]);
    expect(pages.filter((e) => e.links.duplicateOf === null)).toHaveLength(52);
    expect(entries.filter((e) => e.kind === 'guard').map((e) => e.id)).toEqual(['GUARD-001', 'GUARD-002', 'GUARD-003', 'GUARD-004']);
  });

  it('produit des entrées valides (validate-data)', () => {
    const data = files.map((f) => ({ file: f.name, data: JSON.parse(serializeEntries(f.entries)) as unknown }));
    expect(validateEntries(data, loadSchemaValidators())).toEqual([]);
  });

  it('data/ garde les champs de l\'import (seules les cibles Éton évoluent ensuite)', () => {
    const withoutTarget = ({ target: _target, ...rest }: LibraryEntry) => rest;
    const byIdOrder = (list: readonly LibraryEntry[]) => [...list].sort((a, b) => a.id.localeCompare(b.id)).map(withoutTarget);
    expect(byIdOrder(readLibraryEntries(ROOT).entries)).toEqual(byIdOrder(entries));
  });

  it('T-LIB-02 : trace les fusions MSG-025 → VOC-078 et MSG-056 → ACT-055', () => {
    expect(result.stats.mergedFrom).toEqual({ 'VOC-078': ['MSG-025'], 'ACT-055': ['MSG-056'] });
    expect(get('VOC-078').links.mergedFrom).toEqual(['MSG-025']);
    expect(get('ACT-055').links.mergedFrom).toEqual(['MSG-056']);
  });

  it('T-LIB-03 : 19 liens exact, 16 par le sens et 17 vers PAG (textes uniques), 7 gabarits liés', () => {
    expect(result.stats).toMatchObject({ exactLinks: 19, meaningLinks: 16, pagLinks: 17 });
    expect(result.stats.templateRefs).toHaveLength(7);
    expect(result.stats.pagesWithTemplateRefs).toHaveLength(13);
    // Un lien « meaning » ne partage pas la traduction : la page garde sa propre cible.
    const p45 = get('P4-5');
    expect(p45.links.corpusRef).toEqual({ id: 'MSG-038', type: 'meaning' });
    expect(p45.target.eto).not.toBeNull();
    expect(get('P4-3').links.duplicateOf).toBe('P2-3');
  });

  it('T-LIB-12 (données) : les synonymes restent des notes, jamais des variantes de recherche', () => {
    expect(entries.filter((e) => e.source.fr.variants.length > 0)).toEqual([]);
    expect(get('VOC-016').source.fr.simple?.synonyms).toContain('monnaie');
    expect(get('VOC-017').source.fr.text).toBe('Monnaie');
    expect(get('ACT-001').source.fr.simple?.synonyms).toContain("faire partir de l'argent");
  });

  it('découpe les synonymes sans perte : virgules pour un terme, alternatives pour une phrase', () => {
    expect(get('ACT-001').source.fr.simple?.synonyms).toEqual(["faire partir de l'argent", 'expédier']);
    expect(get('MSG-001').source.fr.simple?.synonyms).toEqual(['Bonjour, {nom}.', 'Content de te voir, {nom}.']);
    expect(get('SEC-054').source.fr.simple?.synonyms).toHaveLength(1);
  });

  it('extrait les variables une seule fois et avec leur type', () => {
    expect(get('MSG-074').variables).toEqual([{ name: 'heure', type: 'time' }]);
    expect(get('SEC-052').variables).toEqual([{ name: 'numéro', type: 'phone' }]);
    expect(get('SEC-052').kind).toBe('template');
  });

  it('ne produit aucune forme Éton', () => {
    for (const e of entries) {
      const eto = e.target.eto;
      if (eto === null) continue;
      expect(eto).toMatchObject({ text: null, variants: [], proposals: [], dictionaryEvidence: [], translationStatus: 'TRANSLATION_PENDING' });
    }
    expect(entries.filter((e) => e.kind === 'guard').every((e) => e.target.eto === null && e.disposition === 'PROTECTED')).toBe(true);
  });

  it('reprend la sensibilité des actions (22 critiques, 19 élevées, 19 standard)', () => {
    const actions = entries.filter((e) => e.kind === 'action');
    const count = (s: string) => actions.filter((e) => e.sensitivity === s).length;
    expect([count('critical'), count('high'), count('standard')]).toEqual([22, 19, 19]);
  });

  it('refuse une ligne de tableau mal formée', () => {
    const broken = D8_MARKDOWN.replace('| Lignes dans le fichier fusionné | 315 |', '| Lignes dans le fichier fusionné | 315 | en trop |');
    expectImportError(broken, 'cellules au lieu de 2');
  });

  it('refuse un résumé de D8 qui ne correspond pas aux tableaux', () => {
    const broken = D8_MARKDOWN.replace('| Lignes dans le fichier fusionné | 315 |', '| Lignes dans le fichier fusionné | 316 |');
    expectImportError(broken, '« Lignes dans le fichier fusionné » = 316');
  });
});

describe('npm run import-sources (ligne de commande)', () => {
  const out = mkdtempSync(join(tmpdir(), 'finethnic-import-'));
  afterAll(() => rmSync(out, { recursive: true, force: true }));
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/import-sources.ts', '--out', out, ...args], { cwd: ROOT, encoding: 'utf8' });

  it('écrit une fois, refuse d\'écraser, puis écrase seulement avec --force', () => {
    const first = run();
    expect(first.stderr).toBe('');
    expect(first.status).toBe(0);
    expect(readFileSync(join(out, 'safinum-test-pages/page-4.json'), 'utf8'))
      .toBe(readFileSync(join(ROOT, 'data/safinum-test-pages/page-4.json'), 'utf8'));

    const second = run();
    expect(second.stderr).toContain('import déjà fait');
    expect(second.status).toBe(1);

    expect(run('--force').status).toBe(0);
  });
});
