import { checkEtonCharacters, checkTextEncoding, extractVariables } from './eton-charset';
import { formatSchemaErrors, type SchemaValidators } from './schemas';

/** Contenu d'un fichier de data/ déjà lu et analysé (JSON). */
export interface DataFile {
  file: string;
  data: unknown;
}

export interface Issue {
  file: string;
  id: string | null;
  path: string;
  message: string;
}

/* Forme minimale d'une entrée valide au schéma (data/schemas/entry.schema.json). */
interface Review { aspect: 'linguistic' | 'financialMeaning'; decision: string }
interface EtoTarget {
  text: string | null;
  variants: string[];
  translationStatus: string;
  dictionaryEvidence: { form: string }[];
  proposals: { text: string }[];
  validation: { linguistic: string; financialMeaning: string; reviews: Review[] };
}
interface Source { text: string; variants: string[] }
interface Entry {
  id: string;
  source: { fr: Source; en: Source | null };
  variables: { name: string }[];
  target: { eto: EtoTarget | null };
  links: {
    corpusRef: { id: string } | null;
    pageRefs: string[];
    templateRefs: string[];
    duplicateOf: string | null;
    relatedTo: string[];
  };
}

/** Statuts qui supposent une proposition (texte de locutrice ou proposition de la cascade). Contrat §5.2. */
const STATUSES_WITH_PROPOSAL = new Set(['DICTIONARY_ATTESTED', 'CONTEXT_PENDING', 'REVIEW_PENDING']);
/** Statuts sans aucune proposition. */
const STATUSES_WITHOUT_PROPOSAL = new Set(['SOURCE_EXTRACTED', 'TRANSLATION_PENDING']);

const sortedKey = (names: readonly string[]): string => [...names].sort().join(',');

/**
 * Valide les entrées de data/ : schéma, encodage (NFC, U+FFFD, mojibake), jeu de caractères
 * Éton, variables, cohérence des statuts, unicité des ID et liens. Aucune modification.
 */
export function validateEntries(files: readonly DataFile[], validators: SchemaValidators): Issue[] {
  const issues: Issue[] = [];
  const entries: { file: string; entry: Entry; index: number }[] = [];

  for (const { file, data } of files) {
    if (!Array.isArray(data)) {
      issues.push({ file, id: null, path: '/', message: 'le fichier doit contenir un tableau JSON d’entrées' });
      continue;
    }
    data.forEach((item: unknown, index) => {
      const id = typeof (item as { id?: unknown })?.id === 'string' ? (item as { id: string }).id : null;
      if (!validators.entry(item)) {
        for (const message of formatSchemaErrors(validators.entry.errors)) {
          issues.push({ file, id, path: `/${index}`, message: `schéma : ${message}` });
        }
        return;
      }
      entries.push({ file, entry: item as Entry, index });
    });
  }

  const ids = new Map<string, string>();
  for (const { file, entry, index } of entries) {
    const add = (path: string, message: string): void => {
      issues.push({ file, id: entry.id, path: `/${index}${path}`, message });
    };

    const previous = ids.get(entry.id);
    if (previous !== undefined) add('/id', `ID en double (déjà présent dans ${previous})`);
    else ids.set(entry.id, file);

    walkStrings(entry, '', (value, path) => {
      for (const message of checkTextEncoding(value)) add(path, message);
    });

    checkVariables(entry, add);

    const eto = entry.target.eto;
    if (eto) {
      checkEtonTexts(eto, add);
      checkStatusCoherence(eto, add);
    }
  }

  for (const { file, entry, index } of entries) {
    const { corpusRef, pageRefs, templateRefs, duplicateOf, relatedTo } = entry.links;
    const refs: [string, string][] = [
      ...(corpusRef ? [['/links/corpusRef/id', corpusRef.id] as [string, string]] : []),
      ...pageRefs.map((r, i): [string, string] => [`/links/pageRefs/${i}`, r]),
      ...templateRefs.map((r, i): [string, string] => [`/links/templateRefs/${i}`, r]),
      ...(duplicateOf ? [['/links/duplicateOf', duplicateOf] as [string, string]] : []),
      ...relatedTo.map((r, i): [string, string] => [`/links/relatedTo/${i}`, r]),
    ];
    for (const [path, ref] of refs) {
      if (ref === entry.id) issues.push({ file, id: entry.id, path: `/${index}${path}`, message: 'lien vers l’entrée elle-même' });
      else if (!ids.has(ref)) issues.push({ file, id: entry.id, path: `/${index}${path}`, message: `lien vers un ID inexistant : ${ref}` });
    }
  }

  return issues;
}

type Add = (path: string, message: string) => void;

function checkVariables(entry: Entry, add: Add): void {
  const declared = entry.variables.map((v) => v.name);
  if (new Set(declared).size !== declared.length) add('/variables', 'variable déclarée deux fois');
  const declaredKey = sortedKey([...new Set(declared)]);

  const sourceTexts: [string, string][] = [
    ['/source/fr/text', entry.source.fr.text],
    ...entry.source.fr.variants.map((t, i): [string, string] => [`/source/fr/variants/${i}`, t]),
    ...(entry.source.en
      ? [['/source/en/text', entry.source.en.text] as [string, string],
         ...entry.source.en.variants.map((t, i): [string, string] => [`/source/en/variants/${i}`, t])]
      : []),
  ];
  for (const [path, text] of sourceTexts) {
    if (sortedKey([...new Set(extractVariables(text))]) !== declaredKey) {
      add(path, `variables de la source différentes des variables déclarées (${declaredKey || 'aucune'})`);
    }
  }

  const eto = entry.target.eto;
  if (!eto) return;
  const expected = sortedKey(extractVariables(entry.source.fr.text));
  for (const [path, text] of etoTexts(eto)) {
    if (path.startsWith('/target/eto/dictionaryEvidence')) continue;
    const found = sortedKey(extractVariables(text));
    if (found !== expected) {
      add(path, `variables de la cible (${found || 'aucune'}) différentes de celles de la source (${expected || 'aucune'})`);
    }
  }
}

function checkEtonTexts(eto: EtoTarget, add: Add): void {
  for (const [path, text] of etoTexts(eto)) {
    for (const message of checkEtonCharacters(text)) add(path, message);
  }
}

function checkStatusCoherence(eto: EtoTarget, add: Add): void {
  const status = eto.translationStatus;
  const { linguistic, financialMeaning, reviews } = eto.validation;
  const hasProposal = eto.text !== null || eto.proposals.length > 0;

  if ((status === 'VALIDATED_OBALA') !== (linguistic === 'VALIDATED')) {
    add('/target/eto/translationStatus', `incohérence : translationStatus = ${status} mais validation.linguistic = ${linguistic} (VALIDATED_OBALA ⇔ VALIDATED)`);
  }
  if (status === 'VALIDATED_OBALA' && eto.text === null) {
    add('/target/eto/text', 'VALIDATED_OBALA sans texte validé');
  }
  if (STATUSES_WITHOUT_PROPOSAL.has(status) && hasProposal) {
    add('/target/eto/translationStatus', `${status} alors qu’une proposition existe (attendu : REVIEW_PENDING ou un statut avec proposition)`);
  }
  if (STATUSES_WITH_PROPOSAL.has(status) && !hasProposal) {
    add('/target/eto/translationStatus', `${status} sans aucune proposition (attendu : TRANSLATION_PENDING)`);
  }
  for (const aspect of ['linguistic', 'financialMeaning'] as const) {
    const state = aspect === 'linguistic' ? linguistic : financialMeaning;
    if (state === 'VALIDATED' && !reviews.some((r) => r.aspect === aspect && r.decision === 'VALIDATED')) {
      add(`/target/eto/validation/${aspect}`, `${aspect} = VALIDATED sans relecture tracée (reviews[] : code relecteur, date, décision VALIDATED)`);
    }
  }
}

function etoTexts(eto: EtoTarget): [string, string][] {
  return [
    ...(eto.text !== null ? [['/target/eto/text', eto.text] as [string, string]] : []),
    ...eto.variants.map((t, i): [string, string] => [`/target/eto/variants/${i}`, t]),
    ...eto.proposals.map((p, i): [string, string] => [`/target/eto/proposals/${i}/text`, p.text]),
    ...eto.dictionaryEvidence.map((d, i): [string, string] => [`/target/eto/dictionaryEvidence/${i}/form`, d.form]),
  ];
}

function walkStrings(value: unknown, path: string, visit: (value: string, path: string) => void): void {
  if (typeof value === 'string') visit(value, path || '/');
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${path}/${i}`, visit));
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walkStrings(v, `${path}/${k}`, visit);
  }
}
