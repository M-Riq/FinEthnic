# `data/language-resources/` — ressources linguistiques

Ressources linguistiques du moteur. Depuis la révision de Q17 (2026-11-14), la conversion JSON de D7 (`d7/`) est destinée à être embarquée dans l'extension ; les autres fichiers servent à la préparation et au moteur.

## Contenu

| Fichier | Rôle | Versionné | Statut |
|---|---|---|---|
| `duplicate-review.json` | Listes tenues à la main pour le rapport de doublons (BM2.4) | Oui | BM2 |
| `grammar-rules.json` | Règles de formation des phrases de D7, utilisées par la cascade (BM3.6, §3.10). Format : `../schemas/grammar-rules.schema.json` | Oui | **Vide** jusqu'à Q23 (règles à transcrire) |
| `sense-review.json` | Sens faux relevés (M18) : dans une entrée de D8, une forme éton citée de D7 qui trahit le sens (« Rejeter » → « mettre de côté » → lìŋ « épargner »). Le moteur écarte ces candidats, puis essaie les autres synonymes, la définition, et laisse le français si rien de juste ne reste. Chaque ligne : `entryId`, `fr`, `eto`, `ref` (page et n° de D7), `reason` | Oui | 4 sens relevés : « Rejeter » → lìŋ (2026-11-14), « Retourner » → vyàŋlà, « Institution de microfinance » → ì-zímí (« caisse, cercueil »), « Opposition » → bán (« arrêt, gare ») (2026-11-15) |
| `kept-french-terms.json` | Termes français gardés tels quels dans la phrase éton (M20) : notions financières et numériques modernes absentes de D7 (compte, code, frais, mot de passe, SMS…), en groupes (`groups[].terms`), avec les mots exclus et leur raison (`excluded`). Gardés seulement comme noms et toujours signalés (`FRENCH_KEPT`) ; une phrase sans aucun mot rendu par D7 n'est pas présentée comme traduite | Oui | 76 termes validés (2026-11-15) |
| `d8-synonym-additions.json` | Synonymes français simples ajoutés à D8 (M22, M24), écrits seulement avec des constructions attestées par D7 (verbe + nom, nom « á » nom, « pour rien »…). Le moteur les lit après les synonymes de D8, sans modifier D8. Liste `removals` : synonymes de D8 que le moteur n'utilise pas, car ils changent le sens financier (M30 : « richesse » pour « Argent » ; relecture du 2026-11-15 : « prix » pour « Montant », « cacher » pour « Fermer la fenêtre »). Chaque ligne : `entryId`, `text` (texte de D8, vérifié au chargement), `synonym`, `reason`, `ref`, `decidedBy`, `date`. Propositions et décisions : `docs/reviews/M22-synonymes-d8.md` | Oui | 71 synonymes validés : 50 en M22 (groupe A et groupe B), 26 en M24 (second lot), moins 5 retirés à la relecture des synonymes à risque |
| `d7/` | Conversion JSON complète de D7 (`d7.json` : lexique découpé, index français, tableaux de grammaire) et de l'esquisse grammaticale du livre (`esquisse-grammaticale.json`), produite par `npm run convert-d7`. Formats : `../schemas/d7.schema.json`, `../schemas/esquisse.schema.json`. Licence et attribution : `d7/LICENCE.md` | Oui (Q17 révisée) | Généré le 2026-11-14 ; lu par le moteur |
| `raw/` | D7 tel que reçu (`dictionnaire_eton_lexique.md`), son extraction `dictionary.json` et les rapports `import-report.md` et `cascade-report.md`. Format de l'extraction : `../schemas/dictionary.schema.json` | **Non** (`.gitignore`) | D7 reçu le 2026-11-13 |

## Provenance et licence

- **D7** : *Dictionnaire éton–français*, Mark Van de Velde & Kisito Essele Essele, Éditions CLÉ, Yaoundé, 2022. Reçu sous la forme d'un lexique Markdown, extrait automatiquement du PDF (369 pages) puis converti depuis Excel par le responsable. SHA-256 du fichier reçu : `2d376352429a3adf8d0417e7948dc3422c0aa17c1e3ad7ba732872ecac062a86`.
- **Licence** : [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr), d'après le « Lisez-moi » du lexique et une recherche web (le site de l'auteur n'a pas pu être consulté). Citer les auteurs ; pas d'usage commercial ; même licence pour ce qui en dérive.
- Le lexique contient une colonne « English » écrite par une IA, pas par les auteurs : `import-dictionary` ne la lit pas.
- ~~**Q17 (2026-11-13)** : tout le dictionnaire reste dans `raw/`, hors Git.~~ **Q17 révisée (2026-11-14, décision du responsable)** : la **conversion JSON complète** de D7 (`d7/`) est versionnée et sera embarquée dans l'extension, sous CC BY-NC-SA 4.0, avec l'attribution et la liste des modifications (`d7/LICENCE.md`, `THIRD_PARTY.md`). Le fichier **brut** reçu reste dans `raw/`, hors Git.
- **Pourquoi un JSON versionné plutôt que le brut** : le moteur et l'extension ont besoin d'une donnée structurée et stable (sens, exemples, renvois, grammaire) ; un script reproductible (`npm run convert-d7 -- --check`) prouve que le JSON vient du brut sans retouche manuelle ; la colonne « English » écrite par une IA est écartée. Le changement de format ne lève **aucune** obligation de la licence : attribution, pas d'usage commercial, partage dans les mêmes conditions.

## Conversion complète (`npm run convert-d7`)

Lit `raw/dictionnaire_eton_lexique.md` et `docs/sources/grammaire_eton_esquisse_complete.md` (options `--lexique`, `--esquisse`), valide le résultat avec les schémas, puis écrit `d7/d7.json` et `d7/esquisse-grammaticale.json` (sans horodatage : deux exécutions donnent les mêmes octets). `--check` n'écrit rien et échoue si les fichiers versionnés sont périmés.

- **Entrée complète** : mot-vedette, `Variante`, abréviation (`n.`, `v.`, `n adj.`…), `Cl`, `Pl` retirés ; sens « 1) », « 2) » ; étiquettes `Voir`, `Syn`, `Ant`, `Idiom`, `Litt`, `Usage`, `Proverbe`, `Singulatif`, `Empr. de` (hors parenthèses) ; puis définition et exemples éton → français.
- **Mot éton** : toutes ses voyelles portent un ton (ou nasale syllabique tonalisée), caractères de la liste blanche, sans majuscule ni chiffre ; une forme connue du Lefff du dépôt (« très », « côté ») est française, sauf si elle contient une lettre propre à l'éton (ə, ɛ, ɔ, ŋ, ɲ, ꜜ, caron, macron, double aigu).
- **Sûreté** : `full` garde l'entrée telle quelle ; ce qui n'est pas classé va dans `issues` (35 entrées sur 3 371), jamais deviné.
- **Moteur** : `scripts/lib/engine-d7.ts` lit `d7/d7.json` (repli : `raw/dictionary.json`) et en tire exactement les mêmes clés que l'import ci-dessous (5 754).

## Import (`npm run import-dictionary`, BM3.3)

Lit la feuille « Éton → Français » du lexique (une ligne par entrée, avec la page du livre) et écrit `raw/dictionary.json` et `raw/import-report.md`. Dans ce dépôt, il refuse d'écrire ailleurs que dans `raw/`.

- **Clés françaises** : une par sens (« 1) », « 2) »…), puis une par élément séparé par une virgule. Les parenthèses, les guillemets et ce qui suit un point ou un deux-points (nom scientifique, explication) sont retirés. Une clé qui contient autre chose que des lettres du français (exemple éton mal découpé) est écartée, et l'entrée sans clé est listée dans le rapport.
- **Formes** : recopiées telles quelles, sauf le numéro d'homonyme final (« ⟦forme⟧1 » → « ⟦forme⟧ »), qui numérote les entrées du livre. Le tiret entre le préfixe de classe et le thème (« ⟦préfixe⟧-⟦thème⟧ ») est **gardé**, comme dans le livre ; la locutrice décide de la graphie finale (décision du responsable, 2026-11-13). Une forme hors de la liste blanche est écartée et signalée, jamais corrigée.
- **Catégories** : `nom` → `NOM`, `nom adjectival` et `adjectif` → `ADJ`, `verbe` et `verbe résultatif` → `VERBE`, `quasi-auxiliaire` → `AUX`, `adverbe` → `ADV`, `préposition` → `PREP`, `pronom` → `PRON`, `numéral` → `NUM`, `idéophone` → `IDEO`, `interjection` → `INTERJ`, `subordonnant` → `SUB`, `particule` → `PART` (provisoire, Q23).
- **Référence** de chaque forme : `D7 p. <page> (lexique n° <N°>)`.
- **Liste blanche** : ɲ, ꜜ (ton abaissé), la liaison g͡b et le double aigu (U+030B, ton très haut, 5 formes vérifiées dans le livre) y ont été ajoutés à la réception de D7.
- Le rapport donne aussi un **échantillon de 30 entrées** à comparer avec le livre (BM3.4).

## Formats (provisoires jusqu'à D7)

**Dictionnaire** (`dictionary.schema.json`) : `kind` (`test` ou `d7`), `source`, puis `entries[]` avec `fr` (mot ou expression française), `eto` (forme éton, NFC), `category` (`NOM`, `VERBE`, `ADJ`…), `gloss` (sens), `ref` (page ou entrée de D7, obligatoire) et, pour un nom, `nounClass` (classe nominale de D7, ex. `7/8`, `s.g`). Un mot à plusieurs sens a une ligne par sens.

**Règles** (`grammar-rules.schema.json`) :
- `rules[]` : `id`, `description`, `ref` (référence D7 obligatoire), `pattern` (catégories dans l'ordre français, ex. `["NOM", "ADJ"]`) et `order` (positions de sortie, ex. `[2, 1]`). Une règle décrit **seulement l'ordre des mots** ; tons, classes nominales et accords restent du ressort de la locutrice (R20).
- `ignoredWords[]` : groupes de mots français (`words`) sans équivalent à traduire (articles…), chaque groupe avec une `ref` et une `note`. Sans entrée ici, ces mots sont signalés comme manquants.
- `partitives[]` (facultatif, M21) : `id`, `nouns` (liste fermée de noms en minuscules), `ref` et `note`. Le moteur supprime « du », « de l' », « de la » juste après un verbe et devant un de ces noms (« envoyer de l'argent » → lóm mɔ̀ní). Ailleurs, « de » reste un manque, sauf entre deux noms (`connectives[]`).
- `connectives[]` (facultatif, M26) : `id`, `words` (« de », « du », « d' »), `forms` (forme du connectif par classe nominale de D7, au singulier : `{"1": "à", "9": "ì"…}`), `ref` et `note`. Entre deux noms, le moteur écrit la forme de la classe du premier nom (« prix de l'argent » → táŋ ì mɔ̀ní). « de » reste un manque si le premier nom est gardé en français ou d'une classe absente de `forms`, ou si le second nom commence par une voyelle ou une nasale syllabique (fusion non documentée), ou si le second nom porte un possessif.
- `possessives[]` (facultatif, M31) : `id`, `persons` (`person`, `words` en minuscules, `afterLow` et `afterHigh` : forme par classe nominale de « 1 » à « 10 »), `ref` et `note`. Devant un nom au singulier de D7 ou gardé en français, le moteur place le possessif après le nom, à la forme de sa classe (s.g et terme gardé : « 1 ») : `afterHigh` si le nom finit par un ton haut ou montant, `afterLow` s'il finit par un ton bas ou descendant ou s'il est gardé (« ton argent » → mɔ̀ní wɔ̂). Ailleurs, le possessif reste un manque (`D7-POSSESSIF`).
- `adjectives[]` (facultatif, M33) : `id`, `forms` (connectif par classe nominale du nom adjectival, de « 1 » à « 10 »), `excluded` (formes de D7 écartées pour leur sens : `eto`, `reason`), `ref` et `note`. Nom + adjectif rendu par un nom adjectival de D7 d'une classe de `forms` : le nom adjectival passe en tête, suivi du connectif, puis du nom (« ì-túg í ndá », une maison délabrée). Ailleurs (autre classe, forme écartée, ton final descendant, nom à voyelle initiale, pluriel, sujet…), l'adjectif reste un manque `D7-NOM-ADJECTIF`. La classe des noms adjectivaux vient de l'import de D7 (`nounClass`, comme pour les noms).

Le mini-dictionnaire et les règles **de test** sont dans `tests/language/fixtures/cascade/`. Leurs formes sont visiblement fictives (`⟦TEST:…⟧`) et ne doivent jamais entrer dans `data/`.

## Procédure à l'arrivée de D7

1. ✅ Déposer le fichier brut dans `raw/` (jamais committé).
2. ✅ `npm run import-dictionary` : extraction vers `raw/dictionary.json` (`kind: "d7"`), en NFC, avec la référence de chaque forme (BM3.3).
3. ✅ Contrôler l'extraction : liste blanche des caractères éton (§3.7.4-4) ; échantillon de 30 formes de `raw/import-report.md` et 5 formes à double aigu comparés avec le livre par le responsable le 2026-11-13, tous conformes (BM3.4).
4. 🟡 Transcrire les règles de phrase dans `grammar-rules.json`, **une par une avec leur référence** (Q23). Copilot peut écrire la structure, jamais une forme éton. Déjà validés par le responsable (2026-11-13) : les articles ignorés et la règle `D7-VERBE-NOM`. La section « Grammaire & phrases » du lexique est un résumé qui renvoie aux p. 18-71 : la page exacte d'une règle est à prendre dans le livre quand c'est possible.
5. Lancer `npm run propose-translations -- --dictionary data/language-resources/raw/dictionary.json --report data/language-resources/raw/cascade-report.md` (essai), relire le rapport, puis relancer avec `--write`. Le rapport complet reste dans `raw/` : il cite des centaines de formes de D7, au-delà des seules formes retenues.
6. Envoyer les propositions aux locutrices (fiches L1/L2). Seule leur validation produit `VALIDATED_OBALA`.
