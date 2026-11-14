/**
 * Enrichissement de D8 (mission §3.4) : entrée complète pour un texte absent du corpus.
 *
 * - Mot ou groupe de mots complexe → synonymes simples + définition simple (1 à 3 phrases).
 * - Phrase complexe → 3 variantes simplifiées au plus, de même sens et de même grammaire.
 * - Texte simple (traduit entièrement avec D7) → aucune simplification : il est traduit tel quel.
 * - Paragraphe → une entrée par phrase (le moteur traduit phrase par phrase).
 *
 * Chaque entrée garde l'analyse grammaticale (§3.3), la classe, le sens et le résultat du test de
 * complexité. Si le simplificateur ne trouve rien, l'entrée est gardée avec `statut: 'a_enrichir'` :
 * le texte reste affiché en français (dégradation gracieuse), et l'entrée pourra être reprise plus
 * tard (`reenrich`) avec D8 complété ou un autre simplificateur.
 *
 * Module pur, sans dépendance à Node.
 */
import { type AnalyseGrammaticale, analyzeGrammar, type ClasseTexte, type Sens } from './analysis';
import { classify } from './classify';
import type { CorpusEntry } from './corpus';
import type { D7Index } from './d7';
import { dedupKey } from './dedup';
import type { Lexicon } from './lexicon';
import { assessComplexity, type Complexity, type Simplifier } from './simplifier';

export type Statut = 'enrichi' | 'a_enrichir';

/** Entrée de D8 créée à partir d'un texte de la page. Champs en français, comme D8. */
export interface EnrichedEntry {
  /** « ENR-» + empreinte de la clé : stable d'une session à l'autre. */
  id: string;
  /** Texte d'origine : le mot ou la phrase complexe. */
  terme: string;
  /** Clé de déduplication (§3.2). */
  cle: string;
  classe: Exclude<ClasseTexte, 'paragraphe'>;
  complexite: Complexity;
  /** Mot : synonymes simples. */
  synonymes: string[];
  /** Mot : 1 à 3 phrases simples. */
  definition_simple: string | null;
  /** Phrase complexe : 3 variantes simplifiées au plus, dans l'ordre d'essai. */
  variantes: string[];
  grammaire: AnalyseGrammaticale;
  /** Sens de la (seule) phrase : acte, polarité, moment, possessions. */
  sens: Sens | null;
  statut: Statut;
  /** Simplificateur qui a proposé synonymes ou variantes (null : aucun). */
  simplificateur: string | null;
  /** Entrées de D8 réutilisées par la simplification. */
  sources: string[];
}

export interface EnricherOptions {
  simplifier: Simplifier;
  d7: D7Index;
  lexicon?: Lexicon;
  guards?: readonly string[];
  /** Le moteur traduit-il ce texte entièrement ? (test de complexité, §3.4) */
  translates?: (text: string) => boolean;
}

export interface Enricher {
  /** Entrées pour un texte de la page (une par phrase pour un paragraphe). */
  enrich(text: string): Promise<EnrichedEntry[]>;
  /** Reprend une entrée `a_enrichir` (D8 ou simplificateur changés). */
  reenrich(entry: EnrichedEntry): Promise<EnrichedEntry>;
}

/** Empreinte FNV-1a 32 bits, en hexadécimal : identifiant stable sans dépendance. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (const c of text) {
    h ^= c.codePointAt(0) as number;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function createEnricher(options: EnricherOptions): Enricher {
  const { simplifier, d7, lexicon, guards = [] } = options;
  const analysisOptions = { guards, ...(lexicon ? { lexicon } : {}) };

  async function enrichOne(text: string): Promise<EnrichedEntry> {
    const grammaire = analyzeGrammar(text, analysisOptions);
    const classe = grammaire.classe === 'paragraphe' ? 'phrase_affirmation' : grammaire.classe;
    const complexite = assessComplexity(text, grammaire, { d7, ...analysisOptions, ...(options.translates ? { translates: options.translates } : {}) });
    const cle = dedupKey(text, guards);
    const base = {
      id: `ENR-${fingerprint(cle)}`, terme: text, cle, classe, complexite, grammaire,
      sens: grammaire.phrases.length === 1 ? (grammaire.phrases[0]?.sens ?? null) : null,
    };
    if (!complexite.complexe) {
      return { ...base, synonymes: [], definition_simple: null, variantes: [], statut: 'enrichi', simplificateur: null, sources: [] };
    }
    if (classe === 'mot') {
      const r = await simplifier.simplifyWord(text, grammaire);
      const synonymes = r?.synonymes ?? [];
      const definition = r?.definition_simple ?? null;
      return {
        ...base, synonymes, definition_simple: definition, variantes: [],
        statut: synonymes.length > 0 && definition !== null ? 'enrichi' : 'a_enrichir',
        simplificateur: r ? r.fournisseur ?? simplifier.name : null, sources: r?.sources ?? [],
      };
    }
    const r = await simplifier.simplifyPhrase(text, grammaire);
    const variantes = (r?.variantes ?? []).slice(0, 3);
    return {
      ...base, synonymes: [], definition_simple: null, variantes,
      statut: variantes.length > 0 ? 'enrichi' : 'a_enrichir',
      simplificateur: r ? r.fournisseur ?? simplifier.name : null, sources: r?.sources ?? [],
    };
  }

  return {
    async enrich(text) {
      const sentences = classify(text, analysisOptions).sentences.filter((s) => s.form !== null);
      const parts = sentences.length > 1 ? sentences.map((s) => s.text) : [text.trim()];
      const out: EnrichedEntry[] = [];
      for (const part of parts) out.push(await enrichOne(part));
      return out;
    },
    reenrich: (entry) => enrichOne(entry.terme),
  };
}

/**
 * Entrée du moteur pour une entrée enrichie. Mot : synonymes puis définition. Phrase : les variantes
 * tiennent lieu de synonymes (essayées dans l'ordre, après la phrase elle-même).
 */
export function toCorpusEntry(entry: EnrichedEntry): CorpusEntry {
  return entry.classe === 'mot'
    ? { id: entry.id, text: entry.terme, synonyms: entry.synonymes, definition: entry.definition_simple }
    : { id: entry.id, text: entry.terme, synonyms: entry.variantes, definition: null };
}

/** Entrées enrichies utiles au moteur : celles qui apportent des synonymes, une définition ou des variantes. */
export function toEngineEntries(entries: readonly EnrichedEntry[]): CorpusEntry[] {
  return entries
    .filter((e) => e.synonymes.length > 0 || e.definition_simple !== null || e.variantes.length > 0)
    .map(toCorpusEntry);
}
