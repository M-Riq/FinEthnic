import type { D7Entry } from '../../src/engine/d7';
import type { IgnoredWords } from '../../src/engine/eton';

/**
 * Quelques entrées citées de D7 (Van de Velde & Essele Essele, CLÉ 2022, CC BY-NC-SA 4.0), avec leur
 * référence. Le dictionnaire complet reste hors de Git (Q17).
 */
const e = (fr: string, eto: string, category: string, gloss: string, ref: string): D7Entry => ({ fr, eto, category, gloss, ref });

export const D7_ENTRIES: readonly D7Entry[] = [
  e('à', 'á', 'PREP', 'dans, à', 'D7 p. 71 (lexique n° 1)'),
  e('pour rien', 'á pûpùd', 'ADV', 'pour rien, à fonds perdu', 'D7 p. 71 (lexique n° 3)'),
  e('sous', 'á sí', 'ADV', 'dessous, en bas, sous', 'D7 p. 71 (lexique n° 4)'),
  e('chez', 'ábɔ̂', 'PREP', 'chez', 'D7 p. 71 (lexique n° 15)'),
  e('combien', '-áŋ', 'ADJ', 'combien', 'D7 p. 76 (lexique n° 78)'),
  e('pour', 'ású', 'PREP', '1) pour, destiné à 2) pour, afin de', 'D7 p. 77 (lexique n° 105)'),
  e('refuser', 'bɛ̀n', 'VERBE', '1) refuser, ne pas accorder ce qui est demandé 2) refuser, ne pas accepter', 'D7 p. 84 (lexique n° 194)'),
  e('prêt', 'bə̀bə̀', 'ADV', '1) proche 2) prêt', 'D7 p. 85 (lexique n° 203)'),
  e('petit', 'cə̀càd', 'ADV', 'petit, peu', 'D7 p. 97 (lexique n° 370)'),
  e('avec', 'èè', 'PREP', '1) avec 2) et', 'D7 p. 105 (lexique n° 495)'),
  e('facile', 'ì-bùbû', 'ADJ', 'facile', 'D7 p. 121 (lexique n° 760)'),
  e('quand', 'ídɛ́n', 'ADV', 'quand?', 'D7 p. 124 (lexique n° 792)'),
  e('manger', 'dí', 'VERBE', 'manger', 'D7 (lexique n° 428)'),
  e('arbre', 'ì-lə́', 'NOM', 'arbre', 'D7 p. 131 (lexique n° 930)'),
  e('voler', 'jíb', 'VERBE', 'voler, commettre un vol', 'D7 p. 147 (lexique n° 1209)'),
  e('compter', 'láŋ', 'VERBE', '1) lire 2) compter, calculer', 'D7 p. 169 (lexique n° 1558)'),
  e('mettre de côté', 'lìŋ', 'VERBE', 'épargner, mettre de côté', 'D7 p. 173 (lexique n° 1606)'),
  e('envoyer', 'lóm', 'VERBE', 'envoyer', 'D7 p. 174 (lexique n° 1616)'),
  e('accepter', 'mə̀m', 'VERBE', '1) avouer, accepter 2) professer 3) assumer 4) être prétentieux, être vantard, se dire capable de', 'D7 p. 184 (lexique n° 1793)'),
  e('argent', 'mɔ̀ní', 'NOM', 'argent', 'D7 p. 192 (lexique n° 1919)'),
  e('ici', 'mű', 'ADV', 'ici, là', 'D7 p. 194 (lexique n° 1962)'),
  e('enfant', 'm-wán', 'NOM', '1) enfant, fils ou fille d’une personne ou d’un animal 2) neveu, nièce', 'D7 p. 194 (lexique n° 1968)'),
  e('langue', 'ŋ̀-kɔ́lɔ̂', 'NOM', '1) langue 2) prise de parole', 'D7 p. 213 (lexique n° 2302)'),
  e('rejeter', 'pàzì', 'VERBE', '1) extraire 2) dégager d’une entrave, libérer en enlevant ce qui le retient 3) rejeter', 'D7 p. 230 (lexique n° 2575)'),
  e('plus', 'pə̂', 'ADV', '1) aussi 2) plus, désormais pas', 'D7 p. 231 (lexique n° 2596)'),
  e('message', 'pɔ́', 'NOM', 'nouvelle, information, message', 'D7 p. 234 (lexique n° 2661)'),
  e('un', 'pwág', 'NUM', 'un', 'D7 p. 238 (lexique n° 2716)'),
  e('venir', 'sɔ́', 'VERBE', 'venir', 'D7 p. 248 (lexique n° 2867)'),
  e('prix', 'táŋ', 'NOM', '1) calcul 2) nombre 3) prix, coût', 'D7 p. 251 (lexique n° 2931)'),
  e('langue', 'ù-jə́m', 'NOM', '1) langue (organe) 2) caquet, bavardage', 'D7 p. 259 (lexique n° 3060)'),
  e('payer', 'yágnà', 'VERBE', 'payer, récompenser, rémunérer', 'D7 p. 273 (lexique n° 3307)'),
  e('attendre', 'yàŋà', 'VERBE', 'attendre', 'D7 (lexique n° 3312)'),
  e('faillir', 'yì', 'AUX', '1) vouloir faire quelque chose 2) être probable de se produire 3) faillir', 'D7 p. 274 (lexique n° 3330)'),
];

export const IGNORED: readonly IgnoredWords[] = [{ id: 'D7-MOTS-IGNORES-1', words: ['le', 'la', "l'", 'les', 'des'], ref: 'D7 p. 71 (lexique n° 15)' }];
