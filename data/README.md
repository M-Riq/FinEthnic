# `data/` — bibliothèque linguistique FinEthnic

Périmètre du responsable du projet (TEAM_WORKFLOW §3 et §5). Tout se teste sans Chrome.

## Règle principale

Les fichiers **JSON** de ce dossier sont la **source de vérité** de la bibliothèque. Les fichiers Markdown et CSV de `exports/` sont générés pour la relecture. Ils ne sont jamais modifiés à la main. Une correction de relecture revient dans le JSON par `import-review` (BM4).

## Organisation

| Dossier | Contenu | État |
|---|---|---|
| `schemas/` | Schémas JSON (draft 2020-12) : `entry` (une entrée), `lexicon` (lexique d'exécution lu par le moteur), `review-import` (lignes de relecture) | BM1, à valider en S1 |
| `financial-corpus/` | Entrées du corpus financier (composante A de D8) | BM2 |
| `safinum-test-pages/` | Textes exacts des 5 étapes SAFINUM (composante B de D8) | BM2 |
| `language-resources/` | Dictionnaire Éton–Français (D7) et règles de phrase ; `raw/` reste hors Git | BM3 |
| `exports/markdown/`, `exports/csv/` | Exports de relecture générés | BM4 |

Chaque fichier de `financial-corpus/` et de `safinum-test-pages/` contient un **tableau JSON d'entrées** conforme à `schemas/entry.schema.json` (structure décrite dans PROJECT_CONTEXT §4.5).

## Valider les données

```sh
npm install
npm run validate-data              # valide financial-corpus/ et safinum-test-pages/
npm run validate-data -- <dossier> # valide un autre dossier
```

Le script ne modifie rien. Il renvoie le code 1 s'il trouve un problème et en affiche la liste (`fichier [ID] chemin — message`). Un dossier passé en argument qui n'existe pas ou ne contient aucun JSON est une erreur (une faute de frappe ne passe pas pour un succès) ; les deux dossiers par défaut, eux, sont ignorés tant que l'import (BM2) ne les a pas créés. Contrôles :

- le **schéma** de chaque entrée, y compris : entrée `TRANSLATABLE` ⇔ cible Éton présente ;
- l'**encodage** de tous les textes : normalisation NFC, caractère U+FFFD, mojibake (« Ã© ») ;
- la **liste blanche de caractères Éton** (texte, variantes, propositions, formes du dictionnaire). Elle signale par exemple ε grec (U+03B5) au lieu de ɛ (U+025B). Cette liste est **provisoire** (Q17) ;
- les **variables** `{nom}` : les mêmes dans la source, ses variantes et la déclaration ; le même multiensemble dans toute cible Éton ;
- la **cohérence des statuts** : `VALIDATED_OBALA` ⇔ `validation.linguistic = VALIDATED` ; une validation exige une relecture tracée (code relecteur et date) ; `SOURCE_EXTRACTED` et `TRANSLATION_PENDING` sont sans proposition, les autres statuts en ont une ;
- l'**unicité des ID** entre tous les fichiers et les **liens** (`corpusRef`, `pageRefs`, `templateRefs`, `duplicateOf`, `relatedTo`) vers des ID existants.

## Points à valider en Synchronisation 1

- Valeur `kind: "page"` pour les textes exacts des étapes SAFINUM.
- Champs ajoutés à PROJECT_CONTEXT §4.5 : `contextHints` (départage par rôle et étape, contrat §5.3) et `links.mergedFrom` (ID fusionnés par D8).
- Liste des statuts `translationStatus`, à confronter au D5 original (Q21).

## Sécurité

Aucune donnée réelle de client. Les relecteurs n'apparaissent que par leur code (ex. `LOC-01`). Aucune forme Éton n'est écrite par un outil d'IA : seules les locutrices et le dictionnaire D7 en fournissent.
