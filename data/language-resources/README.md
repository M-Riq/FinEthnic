# `data/language-resources/` — ressources linguistiques

Ressources utilisées **pendant la préparation** de la bibliothèque. Elles ne sont jamais chargées dans l'extension ni utilisées pendant la navigation (PROJECT_CONTEXT §3.7.4-2).

## Contenu

| Fichier | Rôle | Versionné | Statut |
|---|---|---|---|
| `duplicate-review.json` | Listes tenues à la main pour le rapport de doublons (BM2.4) | Oui | BM2 |
| `grammar-rules.json` | Règles de formation des phrases de D7, utilisées par la cascade (BM3.6, §3.10). Format : `../schemas/grammar-rules.schema.json` | Oui | **Vide** jusqu'à Q23 (règles à transcrire) |
| `raw/` | D7 tel que reçu (`dictionnaire_eton_lexique.md`), son extraction `dictionary.json` et les rapports `import-report.md` et `cascade-report.md`. Format de l'extraction : `../schemas/dictionary.schema.json` | **Non** (`.gitignore`) | D7 reçu le 2026-11-13 |

## Provenance et licence

- **D7** : *Dictionnaire éton–français*, Mark Van de Velde & Kisito Essele Essele, Éditions CLÉ, Yaoundé, 2022. Reçu sous la forme d'un lexique Markdown, extrait automatiquement du PDF (369 pages) puis converti depuis Excel par le responsable. SHA-256 du fichier reçu : `2d376352429a3adf8d0417e7948dc3422c0aa17c1e3ad7ba732872ecac062a86`.
- **Licence** : [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr), d'après le « Lisez-moi » du lexique et une recherche web (le site de l'auteur n'a pas pu être consulté). Citer les auteurs ; pas d'usage commercial ; même licence pour ce qui en dérive.
- Le lexique contient une colonne « English » écrite par une IA, pas par les auteurs : `import-dictionary` ne la lit pas.
- **Q17 ✅ (2026-11-13, décision du responsable)** : tout le dictionnaire reste dans `raw/`, hors Git. Seules les formes **citées** entrent dans le dépôt (propositions et `dictionaryEvidence` des entrées), chacune avec sa référence (page de D7). Les fichiers qui en contiennent sont diffusés sous CC BY-NC-SA 4.0, avec la mention des auteurs (`THIRD_PARTY.md`).
- Aucun import massif du dictionnaire dans le dépôt.

## Import (`npm run import-dictionary`, BM3.3)

Lit la feuille « Éton → Français » du lexique (une ligne par entrée, avec la page du livre) et écrit `raw/dictionary.json` et `raw/import-report.md`. Dans ce dépôt, il refuse d'écrire ailleurs que dans `raw/`.

- **Clés françaises** : une par sens (« 1) », « 2) »…), puis une par élément séparé par une virgule. Les parenthèses, les guillemets et ce qui suit un point ou un deux-points (nom scientifique, explication) sont retirés. Une clé qui contient autre chose que des lettres du français (exemple éton mal découpé) est écartée, et l'entrée sans clé est listée dans le rapport.
- **Formes** : recopiées telles quelles, sauf le numéro d'homonyme final (« ⟦forme⟧1 » → « ⟦forme⟧ »), qui numérote les entrées du livre. Le tiret entre le préfixe de classe et le thème (« ⟦préfixe⟧-⟦thème⟧ ») est **gardé**, comme dans le livre ; la locutrice décide de la graphie finale (décision du responsable, 2026-11-13). Une forme hors de la liste blanche est écartée et signalée, jamais corrigée.
- **Catégories** : `nom` → `NOM`, `nom adjectival` et `adjectif` → `ADJ`, `verbe` et `verbe résultatif` → `VERBE`, `quasi-auxiliaire` → `AUX`, `adverbe` → `ADV`, `préposition` → `PREP`, `pronom` → `PRON`, `numéral` → `NUM`, `idéophone` → `IDEO`, `interjection` → `INTERJ`, `subordonnant` → `SUB`, `particule` → `PART` (provisoire, Q23).
- **Référence** de chaque forme : `D7 p. <page> (lexique n° <N°>)`.
- **Liste blanche** : ɲ, ꜜ (ton abaissé), la liaison g͡b et le double aigu (U+030B, ton très haut, 5 formes vérifiées dans le livre) y ont été ajoutés à la réception de D7.
- Le rapport donne aussi un **échantillon de 30 entrées** à comparer avec le livre (BM3.4).

## Formats (provisoires jusqu'à D7)

**Dictionnaire** (`dictionary.schema.json`) : `kind` (`test` ou `d7`), `source`, puis `entries[]` avec `fr` (mot ou expression française), `eto` (forme éton, NFC), `category` (`NOM`, `VERBE`, `ADJ`…), `gloss` (sens) et `ref` (page ou entrée de D7, obligatoire). Un mot à plusieurs sens a une ligne par sens.

**Règles** (`grammar-rules.schema.json`) :
- `rules[]` : `id`, `description`, `ref` (référence D7 obligatoire), `pattern` (catégories dans l'ordre français, ex. `["NOM", "ADJ"]`) et `order` (positions de sortie, ex. `[2, 1]`). Une règle décrit **seulement l'ordre des mots** ; tons, classes nominales et accords restent du ressort de la locutrice (R20).
- `ignoredWords[]` : groupes de mots français (`words`) sans équivalent à traduire (articles…), chaque groupe avec une `ref` et une `note`. Sans entrée ici, ces mots sont signalés comme manquants.

Le mini-dictionnaire et les règles **de test** sont dans `tests/language/fixtures/cascade/`. Leurs formes sont visiblement fictives (`⟦TEST:…⟧`) et ne doivent jamais entrer dans `data/`.

## Procédure à l'arrivée de D7

1. ✅ Déposer le fichier brut dans `raw/` (jamais committé).
2. ✅ `npm run import-dictionary` : extraction vers `raw/dictionary.json` (`kind: "d7"`), en NFC, avec la référence de chaque forme (BM3.3).
3. ✅ Contrôler l'extraction : liste blanche des caractères éton (§3.7.4-4) ; échantillon de 30 formes de `raw/import-report.md` et 5 formes à double aigu comparés avec le livre par le responsable le 2026-11-13, tous conformes (BM3.4).
4. 🟡 Transcrire les règles de phrase dans `grammar-rules.json`, **une par une avec leur référence** (Q23). Copilot peut écrire la structure, jamais une forme éton. Déjà validés par le responsable (2026-11-13) : les articles ignorés et la règle `D7-VERBE-NOM`. La section « Grammaire & phrases » du lexique est un résumé qui renvoie aux p. 18-71 : la page exacte d'une règle est à prendre dans le livre quand c'est possible.
5. Lancer `npm run propose-translations -- --dictionary data/language-resources/raw/dictionary.json --report data/language-resources/raw/cascade-report.md` (essai), relire le rapport, puis relancer avec `--write`. Le rapport complet reste dans `raw/` : il cite des centaines de formes de D7, au-delà des seules formes retenues.
6. Envoyer les propositions aux locutrices (fiches L1/L2). Seule leur validation produit `VALIDATED_OBALA`.
