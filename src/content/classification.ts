/**
 * Classification des textes extraits de la page (phase 2, mission §3.1).
 *
 * Chaque texte à traduire reçoit une classe :
 * - `mot` : mot ou groupe de mots sans verbe conjugué (« Montant », « Frais de transfert ») ;
 * - `phrase_affirmation`, `phrase_interrogation`, `imperatif` : phrase déclarative, question, ordre ou consigne ;
 * - `exclamation` : texte qui finit par « ! » sans être une question ni un impératif (« Transfert effectué ! ») ;
 * - `paragraphe` : plusieurs phrases ; la classe de chacune est donnée dans `phrases`.
 *
 * L'analyse est celle du moteur (`src/engine/analysis.ts`, module pur) : il n'y a qu'un seul classifieur
 * dans le projet. Sans lexique (Lefff n'est pas encore chargé dans l'extension), un groupe de mots sans verbe
 * reconnu mais terminé par un point est une phrase affirmative (hypothèse typographique : un libellé ne
 * finit pas par un point ; « Le montant saisi dépasse votre solde. »). Avec le lexique, le verbe est reconnu.
 * Seules des énumérations sortent de ce module : jamais de texte de la page.
 */
import { type ClassePhrase, type ClasseTexte, classifyText } from '../engine/analysis';
import type { Lexicon } from '../engine/lexicon';
import type { TextClass } from '../shared/messages';

/** Classe d'une phrase : toutes les classes de texte sauf `paragraphe`. */
export type SentenceClass = Exclude<TextClass, 'paragraphe'>;

export interface TextClassification {
  classe: TextClass;
  /** Classe de chaque phrase du texte, dans l'ordre (une seule pour un texte d'une phrase). */
  phrases: SentenceClass[];
  /** Vrai si au moins une phrase porte une négation (« ne … pas », « jamais »…) : à garder à la traduction. */
  negation: boolean;
}

// Les classes du moteur et celles des messages de l'extension doivent rester identiques.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const sameClasses: Same<ClasseTexte, TextClass> & Same<ClassePhrase, SentenceClass> = true;
void sameClasses;

/** Classe un texte de la page. Un texte sans mot à traduire (valeur protégée seule) est un `mot`. */
export function classifyPageText(text: string, lexicon?: Lexicon): TextClassification {
  return classifyText(text, lexicon ? { lexicon } : {});
}
