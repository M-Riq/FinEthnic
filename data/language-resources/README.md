# `data/language-resources/` — ressources linguistiques

Ressources utilisées **pendant la préparation** de la bibliothèque. Elles ne sont jamais chargées dans l'extension ni utilisées pendant la navigation (PROJECT_CONTEXT §3.7.4-2).

## Contenu

| Fichier | Rôle | Versionné | Statut |
|---|---|---|---|
| `duplicate-review.json` | Listes tenues à la main pour le rapport de doublons (BM2.4) | Oui | BM2 |
| `grammar-rules.json` | Règles de formation des phrases de D7, utilisées par la cascade (BM3.6, §3.10). Format : `../schemas/grammar-rules.schema.json` | Oui | **Vide** jusqu'à D7 et Q23 |
| `raw/` | Dictionnaire D7 brut (PDF, scan…) et son extraction JSON. Format de l'extraction : `../schemas/dictionary.schema.json` | **Non** (`.gitignore`) | D7 pas encore reçu |

## Provenance et licence

- **D7** : *Dictionnaire éton–français*, Van de Velde & Essele Essele, CLÉ 2022. Œuvre publiée : la licence reste à préciser (**Q17**).
- En attendant, tout le dictionnaire reste dans `raw/`, hors Git. Seules les formes **citées** entrent dans le dépôt, dans `dictionaryEvidence` des entrées, chacune avec sa référence (page ou entrée).
- Aucun import massif du dictionnaire dans le dépôt.

## Formats (provisoires jusqu'à D7)

**Dictionnaire** (`dictionary.schema.json`) : `kind` (`test` ou `d7`), `source`, puis `entries[]` avec `fr` (mot ou expression française), `eto` (forme éton, NFC), `category` (`NOM`, `VERBE`, `ADJ`…), `gloss` (sens) et `ref` (page ou entrée de D7, obligatoire). Un mot à plusieurs sens a une ligne par sens.

**Règles** (`grammar-rules.schema.json`) :
- `rules[]` : `id`, `description`, `ref` (référence D7 obligatoire), `pattern` (catégories dans l'ordre français, ex. `["NOM", "ADJ"]`) et `order` (positions de sortie, ex. `[2, 1]`). Une règle décrit **seulement l'ordre des mots** ; tons, classes nominales et accords restent du ressort de la locutrice (R20).
- `ignoredWords[]` : groupes de mots français (`words`) sans équivalent à traduire (articles…), chaque groupe avec une `ref` et une `note`. Sans entrée ici, ces mots sont signalés comme manquants.

Le mini-dictionnaire et les règles **de test** sont dans `tests/language/fixtures/cascade/`. Leurs formes sont visiblement fictives (`⟦TEST:…⟧`) et ne doivent jamais entrer dans `data/`.

## Procédure à l'arrivée de D7

1. Déposer le fichier brut dans `raw/` (jamais committé).
2. Extraire les entrées vers `raw/dictionary.json` (`kind: "d7"`), en NFC, avec la référence de chaque forme (BM3.1).
3. Contrôler l'extraction : liste blanche des caractères éton (§3.7.4-4), échantillon relu (BM3.3, BM3.4).
4. Transcrire les règles de phrase dans `grammar-rules.json`, **une par une avec leur référence** (Q23). Copilot peut écrire la structure, jamais une forme éton.
5. Lancer `npm run propose-translations -- --dictionary data/language-resources/raw/dictionary.json` (essai), relire le rapport, puis relancer avec `--write`.
6. Envoyer les propositions aux locutrices (fiches L1/L2). Seule leur validation produit `VALIDATED_OBALA`.
