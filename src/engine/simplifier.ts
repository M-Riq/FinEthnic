/**
 * Simplification des textes absents de D8 (mission §3.4), derrière une interface remplaçable.
 *
 * Un `Simplifier` propose, pour un texte nouveau :
 * - un mot ou groupe de mots → des synonymes simples et une définition simple (1 à 3 phrases) ;
 * - une phrase complexe → au plus 3 variantes simplifiées, de même sens et de même grammaire.
 *
 * Stratégie fournie : `createRuleSimplifier`, à base de règles et de D8 seulement. Elle ne génère
 * aucun mot : elle réutilise les synonymes et définitions de D8 (lemme d'un mot, termes de D8
 * d'une phrase remplacés par leurs synonymes). Si elle ne trouve rien, elle répond null et l'entrée
 * reste `a_enrichir` (le texte reste en français).
 *
 * Point d'extension : un autre fournisseur (par exemple un service de reformulation) peut implémenter
 * la même interface et être placé avant ou après la stratégie à base de règles avec
 * `chainSimplifiers`. Aucune clé d'API n'est codée dans le projet : un tel fournisseur recevrait sa
 * configuration de l'utilisateur, et ses propositions passeraient par les mêmes contrôles
 * (`sameGrammar`, traduction complète avec D7) avant d'être utilisées.
 *
 * Module pur, sans dépendance à Node.
 */
import { type AnalyseGrammaticale, type AnalysePhrase, analyzeGrammar } from './analysis';
import { classify } from './classify';
import { buildCorpus, type Corpus, type CorpusEntry, findTerms, matchWhole } from './corpus';
import type { D7Index } from './d7';
import { frenchKey } from './d7';
import { DETERMINERS, PREPOSITIONS } from './french';
import type { Lexicon } from './lexicon';
import { definitionSentences, simplify } from './simplify';

export interface WordSimplification {
  synonymes: string[];
  /** 1 à 3 phrases simples, ou null. */
  definition_simple: string | null;
  /** Entrées de D8 réutilisées. */
  sources: string[];
  /** Nom du simplificateur qui a répondu (rempli par `chainSimplifiers`). */
  fournisseur?: string;
}

export interface PhraseSimplification {
  /** 3 variantes au plus, de même sens et de même grammaire que la phrase d'origine. */
  variantes: string[];
  sources: string[];
  fournisseur?: string;
}

export interface Simplifier {
  readonly name: string;
  simplifyWord(text: string, analysis: AnalyseGrammaticale): Promise<WordSimplification | null>;
  simplifyPhrase(text: string, analysis: AnalyseGrammaticale): Promise<PhraseSimplification | null>;
}

export type ComplexityReason = 'phrase_complexe' | 'mots_hors_d7' | 'traduction_incomplete';

export interface Complexity {
  complexe: boolean;
  raisons: ComplexityReason[];
  /** Mots pleins sans entrée dans D7 (ni par leur forme, ni par leur lemme). */
  motsHorsD7: string[];
}

export interface ComplexityOptions {
  d7: D7Index;
  lexicon?: Lexicon;
  guards?: readonly string[];
  /** Le texte se traduit-il entièrement avec D7 (moteur) ? Sans ce test, seule la forme et D7 sont vérifiés. */
  translates?: (text: string) => boolean;
}

const CONTENT = new Set(['nom', 'nom_propre', 'verbe', 'adjectif', 'adverbe', 'inconnu']);

/**
 * Le texte est-il complexe (mission §3.4) ? Oui s'il a plusieurs propositions, un mot plein absent
 * de D7, ou si le moteur ne le traduit pas entièrement. Un texte simple est traduit tel quel.
 */
export function assessComplexity(text: string, analysis: AnalyseGrammaticale, options: ComplexityOptions): Complexity {
  const raisons: ComplexityReason[] = [];
  if (analysis.phrases.some((p) => p.forme === 'phrase_complexe')) raisons.push('phrase_complexe');
  const motsHorsD7 = analysis.phrases.flatMap((p) => p.mots)
    .filter((m) => CONTENT.has(m.categorie) && m.categorie !== 'nom_propre')
    .filter((m) => options.d7.get(frenchKey(m.forme)).length === 0 && (m.lemme === null || options.d7.get(frenchKey(m.lemme)).length === 0))
    .map((m) => m.forme);
  if (motsHorsD7.length > 0) raisons.push('mots_hors_d7');
  if (options.translates && !options.translates(text)) raisons.push('traduction_incomplete');
  return { complexe: raisons.length > 0, raisons, motsHorsD7 };
}

/**
 * Même grammaire d'origine (mission §3.3, §3.4) : même classe, même négation, même mode et même
 * moment, mêmes possesseurs. Une variante qui change l'un de ces traits change le sens : écartée.
 */
export function sameGrammar(a: AnalyseGrammaticale, b: AnalyseGrammaticale): boolean {
  if (a.classe !== b.classe || a.negation !== b.negation || a.phrases.length !== b.phrases.length) return false;
  const owners = (p: AnalysePhrase): string => p.possessifs.map((x) => `${x.possesseur.personne}${x.possesseur.nombre}`).sort().join(',');
  return a.phrases.every((p, i) => {
    const q = b.phrases[i] as AnalysePhrase;
    return p.type === q.type && p.mode === q.mode && p.moment === q.moment && p.question?.nature === q.question?.nature
      && p.negation.restriction === q.negation.restriction && owners(p) === owners(q);
  });
}

/**
 * Accords déterminant + nom fautifs ou douteux : une variante qui en ajoute est écartée. Fautif : genre
 * ou nombre connus des deux côtés et différents. Douteux (en cas de doute, on écarte) : déterminant
 * genré devant un nom connu de Lefff aux deux genres (« le somme » : la somme d'argent ou le sommeil).
 */
export function agreementErrors(analysis: AnalyseGrammaticale): number {
  let errors = 0;
  for (const p of analysis.phrases) {
    p.mots.forEach((m, i) => {
      const next = p.mots[i + 1];
      if (m.categorie !== 'determinant' || !next || next.categorie !== 'nom') return;
      if (m.genre !== null && next.genre !== null && m.genre !== next.genre) errors++;
      else if (m.genre !== null && next.genre === null && next.lemme !== null) errors++;
      else if (m.nombre !== null && next.nombre !== null && m.nombre !== next.nombre) errors++;
    });
  }
  return errors;
}

export interface RuleSimplifierOptions {
  corpus: readonly CorpusEntry[] | Corpus;
  lexicon?: Lexicon;
  guards?: readonly string[];
  maxVariants?: number;
}

const isCorpus = (c: readonly CorpusEntry[] | Corpus): c is Corpus => !Array.isArray(c);
const hasVariable = (s: string): boolean => /\{[^{}\n]*\}/u.test(s);

/** Stratégie à base de règles et de D8 (aucune donnée inventée). */
export function createRuleSimplifier(options: RuleSimplifierOptions): Simplifier {
  const { lexicon } = options;
  const guards = options.guards ?? (isCorpus(options.corpus) ? options.corpus.guards : []);
  const corpus = isCorpus(options.corpus) ? options.corpus : buildCorpus(options.corpus, { guards, ...(lexicon ? { lexicon } : {}) });
  const maxVariants = options.maxVariants ?? 3;
  const analyze = (text: string): AnalyseGrammaticale => analyzeGrammar(text, { guards, ...(lexicon ? { lexicon } : {}) });

  function simplifyWord(text: string): WordSimplification | null {
    const { tokens } = classify(text, { guards }).normalized;
    // 1. Le mot ou l'expression entière, sous une autre forme : « débités » → « Débiter » (lemme).
    const whole = matchWhole(corpus, tokens, text);
    const terms = whole ? [] : findTerms(corpus, tokens, lexicon);
    const meaningful = tokens.filter((t) => t.kind === 'word' && !DETERMINERS.has(t.key) && !PREPOSITIONS.has(t.key));
    const single = whole?.entry ?? (terms.length === 1 && meaningful.every((t) => {
      const i = tokens.indexOf(t);
      const only = terms[0];
      return only !== undefined && i >= only.start && i < only.end;
    }) ? terms[0]?.entry ?? null : null);
    // Une autre forme du terme (« débités » pour « Débiter ») n'en reprend le contenu que si elle a la
    // même grammaire (catégorie, mode, nombre, genre) : sinon le sens ou la forme changeraient.
    const byLemma = !whole && terms[0]?.by === 'LEMMA';
    if (single && byLemma && !sameWordForm(text, single.text)) return null;
    if (single) {
      const synonymes = single.synonyms.filter((s) => !hasVariable(s));
      const definition = single.definition !== null && !hasVariable(single.definition) ? definitionSentences(single.definition, { guards }).join(' ') : null;
      return synonymes.length === 0 && definition === null ? null : { synonymes, definition_simple: definition, sources: [single.id] };
    }
    // 2. Groupe de mots fait de termes de D8 : chaque terme remplacé par ses synonymes (comme pour une phrase).
    if (terms.length === 0) return null;
    const variants = substitutionVariants(text);
    return variants.variantes.length === 0 ? null : { synonymes: variants.variantes, definition_simple: null, sources: variants.sources };
  }

  function sameWordForm(a: string, b: string): boolean {
    if (!lexicon) return false;
    const words = (t: string) => classify(t, { guards }).normalized.tokens.filter((x) => x.kind === 'word');
    const [wa, wb] = [words(a), words(b)];
    if (wa.length !== 1 || wb.length !== 1) return false;
    const ra = lexicon.lookup((wa[0] as { key: string }).key);
    const rb = lexicon.lookup((wb[0] as { key: string }).key);
    return ra.some((x) => rb.some((y) => x.pos === y.pos && x.mood === y.mood && x.number === y.number && x.gender === y.gender
      && [...x.persons].sort().join() === [...y.persons].sort().join()));
  }

  /** Variantes par substitution des termes de D8, filtrées sur la grammaire d'origine. */
  function substitutionVariants(text: string): PhraseSimplification {
    const original = analyze(text);
    const { units } = simplify(text, corpus, { guards, ...(lexicon ? { lexicon } : {}), maxVariants: maxVariants * 2 });
    if (units.length !== 1) return { variantes: [], sources: [] };
    const unit = units[0];
    const variantes: string[] = [];
    const sources = new Set<string>();
    for (const c of unit?.candidates ?? []) {
      if (c.source !== 'SUBSTITUTION' || variantes.length >= maxVariants) continue;
      const variant = analyze(c.text);
      if (!sameGrammar(original, variant) || agreementErrors(variant) > agreementErrors(original)) continue;
      variantes.push(c.text);
      for (const id of c.entryIds) sources.add(id);
    }
    return { variantes, sources: [...sources] };
  }

  return {
    name: 'regles-d8',
    simplifyWord: async (text) => simplifyWord(text),
    async simplifyPhrase(text) {
      const result = substitutionVariants(text);
      return result.variantes.length === 0 ? null : result;
    },
  };
}

/** Essaie les simplificateurs dans l'ordre : le premier qui répond est retenu. */
export function chainSimplifiers(simplifiers: readonly Simplifier[]): Simplifier {
  return {
    name: simplifiers.map((s) => s.name).join('+'),
    async simplifyWord(text, analysis) {
      for (const s of simplifiers) {
        const r = await s.simplifyWord(text, analysis);
        if (r) return { ...r, fournisseur: r.fournisseur ?? s.name };
      }
      return null;
    },
    async simplifyPhrase(text, analysis) {
      for (const s of simplifiers) {
        const r = await s.simplifyPhrase(text, analysis);
        if (r) return { ...r, fournisseur: r.fournisseur ?? s.name };
      }
      return null;
    },
  };
}
