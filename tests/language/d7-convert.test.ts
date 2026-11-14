/**
 * Conversion de D7 et de l'esquisse grammaticale en JSON (scripts/lib/d7-convert.ts, npm run convert-d7).
 * Les fixtures reprennent de courtes entrées réelles de D7 (n° 11, 13, 107, 384), CC BY-NC-SA 4.0 :
 * Van de Velde & Essele Essele, « Dictionnaire éton–français », Éditions CLÉ, 2022 (halshs-03847045).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseLexicon } from '../../src/engine/lexicon';
import {
  convertD7, convertEsquisse, isEtonWord, parseEntry, parseQuoted, rowsFromJson, splitExamples, type D7Json,
} from '../../scripts/lib/d7-convert';
import { buildD7Dictionary, D7_HEADER, type D7Row } from '../../scripts/lib/d7-import';
import { D7_JSON_PATH } from '../../scripts/lib/engine-d7';
import { LEXICON_PATH } from '../../scripts/lib/engine-load';
import { formatSchemaErrors, loadSchemaValidators } from '../../scripts/lib/schemas';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const french = parseLexicon(readFileSync(join(ROOT, LEXICON_PATH), 'utf8'));
const isFrench = (w: string): boolean => french.lookup(w).length > 0;
const validators = loadSchemaValidators();
const META = { file: 'test.md', sha256: '0'.repeat(64) };

const row = (n: number, headword: string, category: string, nounClass: string | null, frenchCol: string): D7Row =>
  ({ n, headword, form: headword, homonym: null, category, nounClass, french: frenchCol, page: 100 });

const N107 = 'à-sú ísá n. Cl: 3a. Pl: mə̀-sú m ísá. 1) poste de travail, lieu où on travaille. Litt: ‘visage de travail’. 2) la portion de travail au champ qu’on a devant soi.';
const N11 = 'àbɛ̀n ìlàŋà n. Cl: s.g. Pl: bɔ̀ àbɛ̀n ìlàŋà. personne ou chose inexorable, impitoyable. Litt: ‘qui refuse les amusements’. Syn: ì-lón.';
const N13 = 'à-bə̀ Variante: ɛ̀-bə̀. n. Cl: 3a, 5/6. Pl: mə̀-bə̀. cuisse. Voir: à-kǒl ‘jambe’.';
const N384 = 'cígî v. se couper. ŋ̀kwǎl úꜜtə́ ꜜcígí èè àdìd bíjé La corde se coupe sous le poids des vêtements. í ŋgâlà ɲí ìtə́ ꜜcígí ḿmə̀ŋ Ce bois-ci se coupe bien. Idiom: àcígî ‘Il est mort jeune, soudainement.’ Litt: ‘Il s’est coupé.’ Voir: cíg ‘couper’.';

describe('mots éton et exemples', () => {
  it('reconnaît un mot éton (tons sur toutes les voyelles, nasale syllabique, lettres propres)', () => {
    for (const w of ['ísá', 'ḿmə̀ŋ', 'ŋ̀kwǎl', '‘cíg’.', 'ì-lón']) expect(isEtonWord(w, isFrench), w).toBe(true);
    for (const w of ['travail', 'Ce', 'p.', '12', 'àbɛ̀n2']) expect(isEtonWord(w, isFrench), w).toBe(false);
  });

  it('rend au français « très », « côté » grâce à Lefff, mais jamais un mot à lettre propre à l’éton', () => {
    expect(isEtonWord('très')).toBe(true);
    expect(isEtonWord('très', isFrench)).toBe(false);
    expect(isEtonWord('côté', isFrench)).toBe(false);
    expect(isEtonWord('bɔ̀', () => true)).toBe(true);
  });

  it('sépare définition et paires éton → français ; « à » final revient au français', () => {
    const { definition, examples, issues } = splitExamples(
      'se couper. í ŋgâlà ɲí ìtə́ ꜜcígí ḿmə̀ŋ Ce bois-ci se coupe bien. àcígî à la fin.', isFrench);
    expect(definition).toBe('se couper');
    expect(examples).toEqual([
      { eto: 'í ŋgâlà ɲí ìtə́ ꜜcígí ḿmə̀ŋ', fr: 'Ce bois-ci se coupe bien.' },
      { eto: 'àcígî', fr: 'à la fin.' },
    ]);
    expect(issues).toEqual([]);
    expect(splitExamples('cuisse àcígî').issues).toEqual(['exemple éton sans traduction : « àcígî »']);
  });

  it('lit les renvois « éton ‘français’ » sans couper sur l’apostrophe de « n’est »', () => {
    expect(parseQuoted('à-kǒl ‘jambe’; cíg ‘ce n’est rien’.')).toEqual([
      { eto: 'à-kǒl', fr: 'jambe' }, { eto: 'cíg', fr: 'ce n’est rien' },
    ]);
    expect(parseQuoted('ì-lón.')).toEqual([{ eto: 'ì-lón' }]);
  });
});

describe('découpage de l’entrée complète', () => {
  it('sens numérotés, notes « Litt » rattachées au sens, classe et pluriel retirés', () => {
    const e = parseEntry({ row: row(107, 'à-sú ísá', 'nom', '3a', ''), variants: '', plural: 'mə̀-sú m ísá', full: N107 }, isFrench);
    expect(e).toMatchObject({ abbreviation: 'n', plural: 'mə̀-sú m ísá', issues: [] });
    expect(e.senses).toEqual([
      { n: 1, definition: 'poste de travail, lieu où on travaille', examples: [] },
      { n: 2, definition: 'la portion de travail au champ qu’on a devant soi', examples: [] },
    ]);
    expect(e.notes).toEqual([{ type: 'litteral', text: 'visage de travail', sense: 1 }]);
  });

  it('classe « s.g » (point interne), synonyme et variante', () => {
    const sg = parseEntry({ row: row(11, 'àbɛ̀n ìlàŋà', 'nom', 's.g', ''), variants: '', plural: 'bɔ̀ àbɛ̀n ìlàŋà', full: N11 }, isFrench);
    expect(sg.senses[0]?.definition).toBe('personne ou chose inexorable, impitoyable');
    expect(sg.relations).toEqual([{ type: 'synonyme', eto: 'ì-lón' }]);
    const v = parseEntry({ row: row(13, 'à-bə̀', 'nom', '3a, 5/6', ''), variants: 'ɛ̀-bə̀', plural: 'mə̀-bə̀', full: N13 }, isFrench);
    expect(v).toMatchObject({ variants: ['ɛ̀-bə̀'], relations: [{ type: 'voir', eto: 'à-kǒl', fr: 'jambe' }], issues: [] });
    expect(v.senses[0]?.definition).toBe('cuisse');
  });

  it('exemples, idiome puis « Litt » : les exemples avant les étiquettes sont conservés', () => {
    const e = parseEntry({ row: row(384, 'cígî', 'verbe', null, ''), variants: '', plural: '', full: N384 }, isFrench);
    expect(e.senses[0]?.examples).toHaveLength(2);
    expect(e.idioms).toEqual([{ eto: 'àcígî', fr: 'Il est mort jeune, soudainement.' }]);
    expect(e.notes).toEqual([{ type: 'litteral', text: 'Il s’est coupé' }]);
    expect(e.relations).toEqual([{ type: 'voir', eto: 'cíg', fr: 'couper' }]);
    expect(e.full).toBe(N384);
  });

  it('signale (sans rien perdre) une entrée dont le mot-vedette ne débute pas le texte', () => {
    const e = parseEntry({ row: row(1, 'ísá', 'nom', null, ''), variants: '', plural: '', full: 'autre chose' });
    expect(e.issues).toEqual(['mot-vedette absent du début de l’entrée complète']);
    expect(e.full).toBe('autre chose');
  });
});

const cells = (n: number, hw: string, variant: string, cat: string, cl: string, pl: string, fr: string, full: string): string =>
  `| ${[String(n), hw, variant, cat, cl, pl, fr, 'thigh', '100', full].join(' | ')} |`;
const MINI_D7 = [
  '# Lexique', '', '## Lisez-moi', '', 'Extrait de test.', '', '## Éton → Français', '',
  `| ${D7_HEADER.join(' | ')} |`, `|${D7_HEADER.map(() => '---').join('|')}|`,
  cells(1, 'à-bə̀', 'ɛ̀-bə̀', 'nom', '3a, 5/6', 'mə̀-bə̀', 'cuisse', N13),
  cells(2, 'cígî', '', 'verbe', '', '', 'se couper', N384),
  '', '## Français → Éton', '',
  '| Mot français | Mot éton | Catégorie | Classe / pluriel | N° dans « Éton → Français » |', '|---|---|---|---|---|',
  '| cuisse | à-bə̀ | nom | 3a, 5/6 | 1 |', '',
  '## Grammaire & phrases', '', 'Introduction.', '', '### Pronoms', '',
  '| Personne | Éton | English (Claude) | |', '|---|---|---|---|', '| 1sg | mà | I | x |', '',
].join('\n');

describe('conversion complète', () => {
  it('D7 : lexique, index, grammaire sans colonne English ni colonne sans titre, conforme au schéma', () => {
    const json = convertD7(MINI_D7, META, isFrench);
    expect(validators.d7(json) ? [] : formatSchemaErrors(validators.d7.errors)).toEqual([]);
    expect(json.entries.map((e) => e.headword)).toEqual(['à-bə̀', 'cígî']);
    expect(json.frenchIndex).toEqual([{ fr: 'cuisse', eto: 'à-bə̀', category: 'nom', classPlural: '3a, 5/6', n: 1 }]);
    expect(json.grammar).toEqual({ intro: ['Introduction.'], tables: [{ title: 'Pronoms', columns: ['Personne', 'Éton'], rows: [{ Personne: '1sg', Éton: 'mà' }] }] });
    expect(json.readme).toEqual(['Extrait de test.']);
    expect(json.source).toMatchObject({ license: 'CC BY-NC-SA 4.0', ...META });
    expect(JSON.stringify(json)).not.toContain('thigh');
  });

  it('le moteur obtient du JSON les mêmes clés que de l’import historique', () => {
    const json = convertD7(MINI_D7, META, isFrench);
    expect(rowsFromJson(json)).toHaveLength(2);
    expect(buildD7Dictionary(rowsFromJson(json), 'T').dictionary.entries.map((e) => e.fr)).toEqual(['cuisse', 'se couper']);
  });

  it('esquisse : sections, tableau et sa légende, exemples numérotés gardés tels quels', () => {
    const md = [
      '# Esquisse', '', '> Source : test.', '', '## 8.2. Consonnes', '', 'Premier', 'paragraphe.', '',
      '| | labiale |', '|---|---|', '| **Obstruantes** | p |', '', '**Tableau 1. Phonèmes**', '',
      '### 8.2.1 Sous-section', '', '```', '(1)      àŋgáláŋ ‘Elle avait lu.’', '         dùmá ‘nid’', '(2) ìbógî ‘chaise’', '```',
    ].join('\n');
    const json = convertEsquisse(md, META);
    expect(validators.esquisse(json) ? [] : formatSchemaErrors(validators.esquisse.errors)).toEqual([]);
    expect(json.source.note).toBe('Source : test.');
    expect(json.sections.map((s) => [s.number, s.title, s.level])).toEqual([['8.2', 'Consonnes', 2], ['8.2.1', 'Sous-section', 3]]);
    expect(json.sections[0]?.blocks).toEqual([
      { type: 'paragraphe', text: 'Premier paragraphe.' },
      { type: 'tableau', caption: 'Tableau 1. Phonèmes', columns: ['', 'labiale'], rows: [['**Obstruantes**', 'p']] },
    ]);
    expect(json.sections[1]?.blocks).toEqual([{ type: 'exemples', examples: [
      { n: '1', text: '     àŋgáláŋ ‘Elle avait lu.’\n         dùmá ‘nid’' }, { n: '2', text: 'ìbógî ‘chaise’' },
    ] }]);
  });
});

const RAW = join(ROOT, 'data/language-resources/raw/dictionnaire_eton_lexique.md');
describe.skipIf(!existsSync(RAW))('reproductibilité sur le D7 réel (raw/, hors Git)', () => {
  it('le JSON versionné est exactement ce que produit la conversion du D7 brut', () => {
    const bytes = readFileSync(RAW);
    const json = convertD7(bytes.toString('utf8'), {
      file: 'dictionnaire_eton_lexique.md', sha256: createHash('sha256').update(bytes).digest('hex'),
    }, isFrench);
    const versioned = JSON.parse(readFileSync(join(ROOT, D7_JSON_PATH), 'utf8')) as D7Json;
    expect(json).toEqual(versioned);
  });
});
