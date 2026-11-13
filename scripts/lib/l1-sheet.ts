/**
 * Fiches L1 minimales (BM2.5) : une ligne par texte unique des 5 pages, avec ce qui aide la
 * locutrice (terme du corpus, synonymes et définition simples, gabarit, mots à garder tels quels).
 * Les colonnes de réponse sont vides : aucune forme Éton n'est produite ici. Le format définitif
 * suivra D5 §6.5 (Q21) et sera relu par import-review (BM4, data/schemas/review-import.schema.json).
 */
import type { LibraryEntry } from './library-entry';

/** Noms des étapes, tels qu'écrits dans D8 (colonne « Sous-catégorie »). */
export const STEP_NAMES: Readonly<Record<number, string>> = {
  1: 'Solde et tableau de bord',
  2: 'Frais de transfert',
  3: 'Bénéficiaire',
  4: 'Récapitulatif',
  5: 'Reçu',
};

/**
 * Lot ① de L2 (ROADMAP, piste L) : actions critiques, repérées par leur texte exact. Le lot ② est
 * écrit avec les identifiants de D5 (P1-015…), absents de D8 : il sera repris après Q21.
 */
export const LOT_1_TEXTS: ReadonlySet<string> = new Set([
  'Confirmer le transfert',
  'Continuer',
  'Retour',
  'Modifier',
  'Montant à envoyer',
  'Total à débiter',
  'Total débité',
]);

export const L1_COLUMNS = [
  'ID',
  'Lot',
  'Étape',
  'Aussi présent en',
  'Texte français (ne pas modifier)',
  'Lien avec le corpus',
  'Synonymes simples',
  'Définition simple',
  'Gabarit lié',
  'À garder tel quel',
  'Remarque',
  'Traduction éton (à remplir par la locutrice)',
  'Sens financier correct ? (oui / non)',
  'Code locutrice (LOC-xx)',
  'Date (AAAA-MM-JJ)',
  'Commentaire',
] as const;

export type L1Row = Record<(typeof L1_COLUMNS)[number], string>;

const byNaturalId = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });

/** Lignes de la fiche L1 : une par texte de page sans `duplicateOf`, dans l'ordre des pages. */
export function buildL1Rows(entries: readonly LibraryEntry[]): L1Row[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const pages = entries.filter((e) => e.kind === 'page').sort((a, b) => byNaturalId(a.id, b.id));
  const repeats = new Map<string, string[]>();
  for (const p of pages) {
    if (p.links.duplicateOf !== null) repeats.set(p.links.duplicateOf, [...(repeats.get(p.links.duplicateOf) ?? []), p.id]);
  }

  return pages.filter((p) => p.links.duplicateOf === null).map((page) => {
    const link = page.links.corpusRef;
    const corpus = link ? byId.get(link.id) : undefined;
    if (!link || !corpus) throw new Error(`${page.id} : lien vers le corpus absent ou introuvable`);
    const simple = corpus.source.fr.simple;
    const templates = page.links.templateRefs.map((id) => byId.get(id)).filter((e) => e !== undefined);
    const guards = [...new Set([...page.links.relatedTo, ...corpus.links.relatedTo])]
      .map((id) => byId.get(id))
      .filter((e) => e?.kind === 'guard')
      .map((e) => e?.source.fr.text ?? '');
    const variables = page.variables.map((v) => `{${v.name}}`);
    const step = page.contextHints?.steps?.[0];
    // Une remarque du corpus ne vaut pour la page que si les deux partagent la même traduction.
    const notes = [page.notes, link.type === 'exact' ? corpus.notes : undefined].filter((n) => n !== undefined && n !== '');

    return {
      'ID': page.id,
      'Lot': LOT_1_TEXTS.has(page.source.fr.text) ? '①' : '',
      'Étape': step === undefined ? '' : `${step} - ${STEP_NAMES[step] ?? ''}`,
      'Aussi présent en': (repeats.get(page.id) ?? []).join(', '),
      'Texte français (ne pas modifier)': page.source.fr.text,
      'Lien avec le corpus': link.type === 'exact'
        ? `${corpus.id} (même texte, même traduction)`
        : `${corpus.id} « ${corpus.source.fr.text} » (même sens, traduction séparée)`,
      'Synonymes simples': (simple?.synonyms ?? []).join(' / '),
      'Définition simple': simple?.definition ?? '',
      'Gabarit lié': templates.map((t) => `${t.id} « ${t.source.fr.text} »`).join(' ; '),
      'À garder tel quel': [...guards, ...variables].join(', '),
      'Remarque': [...new Set(notes)].join(' '),
      'Traduction éton (à remplir par la locutrice)': '',
      'Sens financier correct ? (oui / non)': '',
      'Code locutrice (LOC-xx)': '',
      'Date (AAAA-MM-JJ)': '',
      'Commentaire': '',
    };
  });
}

/** Début de cellule qu'un tableur pourrait exécuter comme une formule. */
const FORMULA_START = /^[=+\-@\t\r]/u;

/**
 * CSV pour Excel en français : UTF-8 avec BOM, séparateur « ; », champs entre guillemets, fins de
 * ligne CRLF. Un texte qui commencerait par = + - @ est refusé plutôt que modifié : le texte
 * français doit revenir intact à l'import des relectures (T-REV-03).
 */
export function renderCsv(columns: readonly string[], rows: readonly Readonly<Record<string, string>>[]): string {
  const line = (cells: readonly string[]): string => cells.map((c) => `"${c.replace(/"/gu, '""')}"`).join(';');
  for (const row of rows) {
    for (const column of columns) {
      const value = row[column] ?? '';
      if (FORMULA_START.test(value)) throw new Error(`cellule « ${column} » de ${row['ID'] ?? '?'} commence par « ${value[0]} » (formule de tableur)`);
    }
  }
  return `\uFEFF${[line(columns), ...rows.map((r) => line(columns.map((c) => r[c] ?? '')))].join('\r\n')}\r\n`;
}
