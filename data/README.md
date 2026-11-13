# `data/` — bibliothèque linguistique FinEthnic

Périmètre du responsable du projet (TEAM_WORKFLOW §3 et §5). Tout se teste sans Chrome.

## Règle principale

Les fichiers **JSON** de ce dossier sont la **source de vérité** de la bibliothèque. Les fichiers Markdown et CSV de `exports/` sont générés pour la relecture. Ils ne sont jamais modifiés à la main. Une correction de relecture revient dans le JSON par `import-review` (BM4).

## Organisation

| Dossier | Contenu | État |
|---|---|---|
| `schemas/` | Schémas JSON (draft 2020-12) : `entry` (une entrée), `lexicon` (lexique d'exécution lu par le moteur), `review-import` (lignes de relecture), `dictionary` et `grammar-rules` (ressources de la cascade, provisoires) | BM1, BM3, à valider en S1 |
| `financial-corpus/` | Entrées du corpus financier (composante A de D8) : VOC 100, ACT 60, SEC 60, MSG 78, PAG 17, GUARD 4 | BM2 ✅ |
| `safinum-test-pages/` | Textes exacts des 5 étapes SAFINUM (composante B de D8) : `page-1.json` à `page-5.json`, 60 textes dont 52 uniques | BM2 ✅ |
| `language-resources/` | `duplicate-review.json` (listes tenues à la main pour le rapport de doublons) ; `grammar-rules.json` (règles de phrase de D7, **vide** jusqu'à D7) ; `raw/` (D7 brut et son extraction JSON) reste hors Git. Voir `language-resources/README.md` | BM2 / BM3 |
| `exports/markdown/`, `exports/csv/` | Exports générés : `duplicates.md` (BM2.4), `l1-pages.csv` (BM2.5) ; `cascade-report.md` (BM3.7, après D7) ; exports complets en BM4 | BM2 / BM3 / BM4 |

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

## Import de D8 (fait une seule fois)

```sh
npm run import-sources                    # déjà exécuté : refuse d'écraser data/
npm run import-sources -- --out <dossier> # essai dans un autre dossier
```

L'import lit `docs/sources/corpus_fusionne_SAFINUM_Eton.md` (D8), vérifie son empreinte SHA-256 (`docs/sources/README.md`), son résumé (315 lignes, 60 textes) et la forme de ses tableaux, puis valide les entrées **avant** d'écrire. Depuis, **le JSON de `data/` est la source de vérité** : on ne relance pas l'import. `--force` écraserait les fichiers, **y compris les relectures déjà intégrées** ; il ne sert qu'avant la première relecture.

Ce que l'import produit :

- les ID de D8 tels quels ; les fusions de D8 tracées dans `links.mergedFrom` (MSG-025 → VOC-078, MSG-056 → ACT-055) ;
- `source.fr.simple` : synonymes et définition simples (niveaux 2 et 3 de la cascade, aides pour les locutrices, **jamais** des variantes de recherche : `variants` reste vide) ;
- les variables `{…}` et leur type ; une entrée avec variables devient un gabarit (`kind: "template"`) ;
- pour chaque texte de page : `corpusRef` `exact` (même texte, traduction partagée) ou `meaning` (même sens, traduction séparée), `duplicateOf` pour une répétition (vers la première occurrence), `templateRefs` vers le gabarit « Libellé : {…} » du même libellé ;
- 4 entrées protégées `GUARD` (`Safinum`, `Safinum Pay`, `FCFA`, `XAF`), reliées par `relatedTo` (VOC-019 → GUARD-003 ; PAG-010 et P2-6 → GUARD-001) ;
- une cible Éton **vide** (`TRANSLATION_PENDING`) pour chaque entrée traduisible.

## Rapport de doublons

```sh
npm run check-duplicates   # → exports/markdown/duplicates.md
```

Le rapport ne supprime et ne fusionne rien (ROADMAP §8). Il liste les doublons stricts, normalisés et potentiels, les répétitions des pages, les liens pages ↔ corpus, les paires libellé ↔ gabarit (T-LIB-09), les synonymes égaux au texte d'une autre entrée, ainsi que les paires opposées et les termes distincts. Ces trois dernières listes sont tenues à la main dans `language-resources/duplicate-review.json` : modifier ce fichier, puis relancer le script. Un ID inconnu dans ces listes arrête le script (code 1) ; un « point à arbitrer » (ex. deux opposés avec la même cible) est seulement signalé.

## Fiche L1 pour les locutrices

```sh
npm run export-l1          # → exports/csv/l1-pages.csv
```

Une ligne par texte unique des 5 pages (52). Le fichier s'ouvre dans Excel ou LibreOffice (UTF-8 avec BOM, séparateur « ; »). Les colonnes d'aide viennent du JSON (étape, lien avec le corpus, synonymes et définition simples, gabarit lié, mots à garder tels quels, lot ①) ; les colonnes de réponse sont vides (traduction, sens financier, code `LOC-xx`, date, commentaire). Les fiches remplies reviendront dans le JSON par `import-review` (BM4), jamais à la main. Le format définitif suivra D5 §6.5 (Q21).

## Cascade de traduction (BM3.7)

```sh
npm run propose-translations -- --dictionary <fichier>            # essai : seul le rapport est écrit
npm run propose-translations -- --dictionary <fichier> --write    # écrit les propositions dans le JSON
```

La cascade (PROJECT_CONTEXT §3.10) cherche, pour chaque entrée encore en `TRANSLATION_PENDING`, le terme (`direct`), puis les synonymes simples (`synonym`), puis la définition simple (`definition`), et s'arrête au premier niveau qui réussit. Une réussite ajoute des **propositions** (`target.eto.proposals[]`) et les formes du dictionnaire (`dictionaryEvidence`), et fait passer l'entrée en `REVIEW_PENDING`. Le script n'écrit **jamais** `target.eto.text` ni `VALIDATED_OBALA` : seule une locutrice valide. Le rapport `exports/markdown/cascade-report.md` donne les comptes par niveau, les mots manquants, les structures sans règle et les entrées en échec.

- **Avant D7**, seul existe le mini-dictionnaire de test `tests/language/fixtures/cascade/` (formes ⟦TEST:…⟧). Avec lui, toute écriture dans ce `data/` est **refusée** : utiliser `--root` vers une copie et `--report` vers un autre fichier.
- `--write` vérifie tout le résultat avec les règles de `validate-data` avant d'écrire : en cas de problème, rien n'est écrit.
- Les entrées déjà en relecture ne sont pas retraitées : on peut relancer le script sans risque.

## Points à valider en Synchronisation 1

- Valeur `kind: "page"` pour les textes exacts des étapes SAFINUM.
- Champs ajoutés à PROJECT_CONTEXT §4.5 : `contextHints` (départage par rôle et étape, contrat §5.3) et `links.mergedFrom` (ID fusionnés par D8).
- Liste des statuts `translationStatus`, à confronter au D5 original (Q21).
- **Décisions d'import (BM2)** :
  - ✅ *confirmé par le responsable le 2026-11-13* : une reformulation de phrase est gardée entière, sauf si la phrase source est unique et la reformulation en compte plusieurs : chaque phrase est alors une **alternative** (deux façons de dire la même chose ; une seule est traduite). 9 cas : MSG-001, 005, 008, 010, 021, 047, 053, 062 et SEC-045 ;
  - ✅ *confirmé par le responsable le 2026-11-13* : `{numéro}` (SEC-052, MSG-057) est un numéro de téléphone (`phone`) ;
  - aucune entrée `Compte {marque}` : « Compte Safinum » reste un texte de page, « Safinum » est protégé ;
  - le nom de l'étape 5 est « Reçu », comme dans D8.
- **Choix de la cascade (BM3)**, provisoires jusqu'à D7 et Q23 :
  - les textes de pages identiques à une entrée du corpus (36) ou répétés (8) ne sont pas traités : ils partagent la traduction de l'entrée liée ;
  - les 16 textes de pages liés seulement par le sens n'ont que le niveau 1 (ils n'ont ni synonymes ni définition propres) ;
  - une proposition qui perd ou change une variable (ex. une définition sans `{montant}`) est refusée ;
  - `missing` d'une proposition = mots manquants des textes essayés avant elle (ce qui explique le niveau utilisé) ;
  - pas de lemmatisation : « envoie » n'est pas retrouvé par « envoyer » ;
  - une règle ne décrit que l'ordre des mots ; les mots « vides » (articles…) ne sont ignorés que s'ils figurent dans `ignoredWords`, avec une référence.

## Sécurité

Aucune donnée réelle de client. Les relecteurs n'apparaissent que par leur code (ex. `LOC-01`). Aucune forme Éton n'est écrite par un outil d'IA : seules les locutrices et le dictionnaire D7 en fournissent.
