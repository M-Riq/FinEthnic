import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkCascadeResources, type Dictionary } from '../../scripts/lib/cascade';
import { buildD7Dictionary, D7_HEADER, D7ImportError, frenchKeys, readD7 } from '../../scripts/lib/d7-import';
import { loadSchemaValidators } from '../../scripts/lib/schemas';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const NO_RULES = { description: '', source: '', ignoredWords: [], rules: [] };

/** Lexique au format de D7, avec des formes FICTIVES (aucune forme éton dans le dépôt). */
const lexicon = (rows: string[][]): string => [
  '# Lexique', '', '## Lisez-moi', '', 'Texte.', '', '## Éton → Français', '',
  `| ${D7_HEADER.join(' | ')} |`, `|${D7_HEADER.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  '', '## Français → Éton', '', '| Mot français | Mot éton |', '|---|---|', '| argent | ⟦TEST:a⟧ |', '',
].join('\n');
const row = (n: number, form: string, category: string, french: string, page = 12, nounClass = ''): string[] =>
  [String(n), form, '', category, nounClass, '', french, '', String(page), `${form} ${french}`];

const ROWS = [
  row(1, '⟦TEST:argent⟧', 'nom', 'argent, monnaie'),
  row(2, '⟦TEST:banque⟧2', 'nom', '1) caisse (en bois) 2) "coffre". Nom scientifique'),
  row(3, '⟦TEST:quoi⟧', 'pronom', 'quoi? ⟦TEST:x⟧ Qu’est-ce que c’est?'),
  row(4, '⟦TEST:payer⟧ж', 'verbe', 'payer'),
  row(5, '⟦TEST:leur⟧', 'pronom', 'leur, leurs: pronom possessif de la 3ème personne'),
];

describe('import du dictionnaire D7 (BM3.3)', () => {
  it('T-DIC-01 : une clé par sens, numéro d’homonyme retiré, référence au livre, accepté par la cascade', () => {
    const result = buildD7Dictionary(readD7(lexicon(ROWS)), 'TEST');
    const keys = (n: number): string[] => result.dictionary.entries.filter((e) => e.ref === `D7 p. 12 (lexique n° ${n})`).map((e) => e.fr);
    expect(keys(1)).toEqual(['argent', 'monnaie']);
    expect(keys(2)).toEqual(['caisse', 'coffre']);
    expect(keys(5)).toEqual(['leur', 'leurs']);
    expect(result.dictionary.entries.find((e) => e.fr === 'caisse')).toMatchObject({ eto: '⟦TEST:banque⟧', category: 'NOM' });
    // Clé mêlée de texte non français (extraction imparfaite) : écartée, l'entrée est signalée.
    expect(result.noKey.map((r) => r.n)).toEqual([3]);
    expect(frenchKeys('quand?').keys).toEqual(['quand']);
    const asD7: Dictionary = { ...result.dictionary, entries: result.dictionary.entries.map((e) => ({ ...e, eto: 'abc' })) };
    expect(loadSchemaValidators().dictionary(asD7)).toBe(true);
    expect(checkCascadeResources(asD7, NO_RULES)).toEqual([]);
    // Classe nominale gardée pour les noms et les noms adjectivaux seulement (connectif, M26 ; M33).
    const classes = buildD7Dictionary(readD7(lexicon([row(1, 'abc', 'nom', 'maison', 12, '9/10'), row(2, 'abd', 'verbe', 'partir', 12, '9'),
      row(3, 'abe', 'nom', 'argent'), row(4, 'abf', 'nom adjectival', 'vieux', 12, '7/8')])), 'TEST');
    expect(classes.dictionary.entries.map((e) => e.nounClass)).toEqual(['9/10', undefined, undefined, '7/8']);
    expect(loadSchemaValidators().dictionary(classes.dictionary)).toBe(true);
    // Forme saisie en NFD : stockée en NFC, ton intact.
    const nfd = buildD7Dictionary(readD7(lexicon([row(1, 'a\u0301bc', 'nom', 'argent')])), 'TEST');
    expect(nfd.dictionary.entries.map((e) => e.eto)).toEqual(['\u00E1bc']);
  });

  it('T-DIC-02 : une forme hors de la liste blanche est écartée et signalée, jamais corrigée', () => {
    const result = buildD7Dictionary(readD7(lexicon(ROWS)), 'TEST');
    expect(result.excludedForms.map((x) => x.row.n)).toEqual([4]);
    expect(result.excludedForms[0]?.issues.join()).toContain('U+0436');
    expect(result.dictionary.entries.some((e) => e.eto.includes('payer'))).toBe(false);
    const bad = buildD7Dictionary(
      readD7(lexicon([row(1, 'ab\u03B5', 'nom', 'a'), row(2, 'ab\uFFFD', 'nom', 'b'), row(3, 'abÃ©', 'nom', 'c')])),
      'TEST',
    );
    expect(bad.dictionary.entries).toEqual([]);
    expect(bad.excludedForms.map((x) => x.issues.join(' ; '))).toEqual([
      expect.stringContaining('utiliser ɛ (U+025B)'),
      expect.stringContaining('U+FFFD'),
      expect.stringContaining('mojibake'),
    ]);
  });

  it('refuse un lexique dont la structure est incohérente', () => {
    expect(() => readD7(lexicon([ROWS[0] as string[], row(3, '⟦TEST:b⟧', 'nom', 'b')]))).toThrow(/N° « 3 » au lieu de 2/u);
    expect(() => readD7(lexicon([row(1, '⟦TEST:b⟧', 'nom', 'b', 0)]))).toThrow(D7ImportError);
    expect(() => readD7(lexicon([[...(ROWS[0] as string[]), 'en trop']]))).toThrow(/11 cellules au lieu de 10/u);
  });

  describe('npm run import-dictionary', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'finethnic-d7-'));
    afterAll(() => rmSync(tmp, { recursive: true, force: true }));
    const run = (...args: string[]) =>
      spawnSync(process.execPath, ['--import', 'tsx', 'scripts/import-dictionary.ts', ...args], { cwd: ROOT, encoding: 'utf8' });

    it('écrit hors du dépôt, mais jamais dans le dépôt en dehors de raw/', () => {
      const source = join(tmp, 'lexique.md');
      writeFileSync(source, lexicon([row(1, 'abc', 'nom', 'argent')]), 'utf8');
      const ok = run('--source', source, '--out', join(tmp, 'd.json'), '--report', join(tmp, 'r.md'));
      expect(ok.status, ok.stderr).toBe(0);
      expect(JSON.parse(readFileSync(join(tmp, 'd.json'), 'utf8')).entries).toEqual([
        { fr: 'argent', eto: 'abc', category: 'NOM', gloss: 'argent', ref: 'D7 p. 12 (lexique n° 1)' },
      ]);
      const refused = run('--source', source, '--out', join(ROOT, 'data/d.json'), '--report', join(tmp, 'r.md'));
      expect(refused.status).toBe(2);
      expect(refused.stderr).toContain('hors Git');
    });
  });
});
