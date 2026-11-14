# FinEthnic

FinEthnic est une extension Chrome (Manifest V3) qui affiche en **éton**, une langue du Cameroun, les textes français d'une page web ou d'une application monopage (SPA), surtout le vocabulaire et les phrases financières. Le moteur de traduction est embarqué dans l'extension : aucun serveur, aucune clé d'API, rien n'est transmis.

## Méthodologie de conception

### Le problème

Un texte financier (« Votre virement a été rejeté ») contient des mots qu'aucun dictionnaire éton ne connaît. On ne traduit donc pas le texte d'origine : on le **simplifie en français** avec des mots courants, puis on traduit cette version simple avec le dictionnaire, en appliquant la grammaire éton. Aucune personne ne valide les traductions. Le système suit donc une règle stricte : **dans le doute, ne pas traduire**. Un texte non traduisible reste en français, jamais remplacé par une traduction douteuse.

### Ressources

| Ressource | Rôle | Emplacement |
|---|---|---|
| **D7**, *Dictionnaire éton–français* (Van de Velde & Essele Essele, CLÉ, 2022) | Seule source des formes éton : lexique, index français, section « Grammaire et phrases » | `data/language-resources/d7/d7.json` |
| **Esquisse grammaticale** du même livre (HAL [halshs-03847045](https://shs.hal.science/halshs-03847045)) | Règles de formation des phrases : ordre des mots, marqueurs du sujet, temps, modes, négation, dérivation | `docs/sources/grammaire_eton_esquisse_complete.md` → `data/language-resources/d7/esquisse-grammaticale.json` |
| **D8**, corpus financier français | Pour chaque `terme` : `synonymes` simples et `definition_simple` (1 à 3 phrases) | `data/financial-corpus/*.json` |
| **Lefff 3.4** (B. Sagot) | Analyse du français : lemme, catégorie, genre, nombre, mode, temps, personne | `data/language-resources/lefff/` |
| Règles de grammaire appliquées | Classement de chaque règle de D7/HAL : A appliquée, B décrite mais incomplète (inactive), C non documentée | `data/language-resources/grammar-rules.json` |

**Conversion de D7 en JSON.** `npm run convert-d7` convertit tout D7 (lexique et grammaire) et l'esquisse grammaticale en JSON structuré : entrées avec catégorie, variantes, exemples, règles. Le résultat est validé par un schéma et reproductible : deux exécutions donnent les mêmes fichiers. Le fichier source de D7 reste hors Git, dans `data/language-resources/raw/` ; seule l'adaptation JSON est versionnée, et elle suffit pour construire l'extension. Pour relancer la conversion, copiez d'abord la source : `git show origin/private/d7-raw:dictionnaire_eton_lexique.md > data/language-resources/raw/dictionnaire_eton_lexique.md`. Ensuite, `npm run convert-d7 -- --check` vérifie que les fichiers versionnés sont à jour.

**Licences.** La conversion en JSON ne lève pas les obligations des sources :

- D7 et l'esquisse grammaticale sont sous **CC BY-NC-SA 4.0**. Il faut citer les auteurs, ne pas faire d'usage commercial, et diffuser sous la même licence les fichiers qui contiennent des formes de D7. Cela s'applique aussi à l'extension, qui les embarque (voir `data/language-resources/d7/LICENCE.md`).
- L'extrait de Lefff est sous **LGPL-LR**, avec un avis de modification.

Le paquet `.zip` contient ces licences dans `licences/`, et le popup cite les auteurs. Détail dans [`THIRD_PARTY.md`](THIRD_PARTY.md).

### Pipeline

```
page / SPA ──► extraction ──► classification ──► déduplication ──► D8 connu ? ──non──► analyse grammaticale ──► enrichissement (stocké sur l'appareil)
                                                                       │oui                                        │
                                                                       ▼                                           ▼
                                        rendu DOM ◄── sélection ◄── construction éton (D7 + grammaire) ◄── unités simplifiées
```

1. **Extraction** (`src/content/scanner.ts`, `attributes.ts`, `observer.ts`). Le script de contenu relève les nœuds texte et les attributs `placeholder`, `title` et `aria-label`. Il ignore `script`, `style`, `code`, les champs de saisie, les zones éditables et les éléments cachés. Il met à part les valeurs protégées (montants, références, numéros, `src/protection/`), qui ne sont jamais traduites. Un `MutationObserver` regroupe les ajouts d'une SPA par lots, avec un délai (debounce). Il ignore les modifications faites par l'extension elle-même, ce qui évite les boucles.
2. **Classification** (`src/content/classification.ts`, `src/engine/classify.ts`). Chaque texte est classé en `mot`, `phrase_affirmation`, `phrase_interrogation`, `imperatif`, `exclamation` ou `paragraphe` (dans ce cas, chaque phrase a sa propre classe).
3. **Déduplication** (`src/engine/dedup.ts`). Un texte est comparé à D8 sans tenir compte de la casse, des espaces, de la ponctuation ni des accents. Une entrée à variables (« Solde : {solde} ») couvre aussi le texte affiché (« Solde : 5 000 FCFA »). Seuls les textes absents de D8 sont enrichis.
4. **Analyse grammaticale** (`src/engine/analysis.ts`). Pour chaque phrase, le module relève :
   - le type, le mode et le temps ;
   - la négation ;
   - le sujet et son accord ;
   - l'ordre des mots ;
   - la dérivation verbale : passif, causatif, pronominal ;
   - les **possessifs** et leur possesseur ;
   - le **sens**, c'est-à-dire l'acte de langage, la polarité, le moment et les possessions.

   Pour chaque mot, il relève le lemme, la catégorie, le genre et le nombre. Ces métadonnées sont gardées dans l'entrée du corpus.
5. **Enrichissement de D8** (`src/engine/simplifier.ts`, `enrich.ts`, `d8-store.ts`, `src/content/corpus-sync.ts`).
   - Un mot complexe reçoit des synonymes simples et une définition simple.
   - Une phrase complexe reçoit jusqu'à 3 variantes simplifiées. Chaque variante doit avoir la **même grammaire** que la phrase d'origine : même type, même mode, même moment, même négation et mêmes possesseurs. Sinon, elle est écartée.
   - Le simplificateur est une **interface remplaçable** (`Simplifier`). La stratégie fournie repose sur des règles et sur D8 : elle n'invente aucun mot. Un autre fournisseur pourra être branché plus tard.
   - Sans résultat, l'entrée est gardée avec `statut: "a_enrichir"` et le texte reste en français.
   - Les entrées créées sont rangées dans `chrome.storage.local`. Les montants et les numéros y sont remplacés par `{valeur}`, pour qu'une seule entrée couvre tous les montants.
6. **Moteur de traduction** (`src/engine/`). Il enchaîne `normalize` → `classify` → `simplify` (unités tirées de D8) → `eton.ts` (construction de la phrase avec D7) → `select.ts` (choix et statut). Le moteur est exposé par le contrat `src/language/contract.ts` (`contract-engine.ts`).
7. **Rendu DOM** (`src/content/renderer.ts`). La traduction remplace le texte **élément par élément**, en ne modifiant que `Text.data` : aucun nœud ni attribut n'est ajouté, ce qui préserve React, Vue et Angular. L'original est conservé : le popup permet d'activer ou de désactiver la traduction, et la désactivation rend la page à l'identique. Les traductions sont mises en cache et traitées par lots.

### Logique de traduction et de repli

C'est la version simple, et non le texte d'origine, qui est traduite.

- **Mot.**
  1. Essayer les synonymes de D8 un par un.
  2. Sinon, essayer la définition simple, phrase par phrase : la première dont **tous** les mots pleins sont dans D7 et que la grammaire sait construire est retenue.
  3. Sinon, le mot reste en français.
- **Phrase.**
  1. Une phrase complexe est remplacée par ses variantes simplifiées ; une phrase simple est traduite telle quelle.
  2. Les variantes sont essayées dans l'ordre (1, puis 2, puis 3). La première traduite complètement est affichée.
  3. Si toutes échouent, la phrase reste en français.

Une traduction n'est **complète** que si chaque mot plein a une forme dans D7 et si chaque trait grammatical est rendu par une règle de classe A. Exemples de règles de classe A :

- ordre sujet – verbe – compléments ;
- `də̀` en tête d'une question oui/non ;
- impératifs irréguliers ;
- connectif entre deux noms, accordé à la classe du premier nom.

Si un trait demande une règle de classe B ou C, le résultat n'est qu'un brouillon, avec la liste exacte des manques. Les brouillons ne sont **jamais affichés**. Le moteur n'invente aucune forme, aucun ton et aucune règle : toute forme éton vient de D7, toute règle vient de D7 ou de l'esquisse HAL.

### Sens et grammaire

- **Traits préservés.** Une question reste une question, et une négation reste une négation. Un candidat qui perd un trait de l'original (question, négation, restriction, temps, exclamation) est écarté. Une négation non rendue renvoie toujours au français, car le sens serait inversé.
- **Possessifs.** Mon, ton, son, notre, votre et leur sont analysés avec leur possesseur. Une variante qui change de possesseur est écartée.
- **Sens des mots.** Un synonyme peut mener dans D7 à un mot d'un autre sens. Exemple : « mettre de côté » → `lìŋ`, qui veut d'abord dire « épargner ». Le moteur préfère donc un mot dont la glose D7 confirme le sens, et il écarte les sens reconnus faux (`data/language-resources/sense-review.json`).
- **Dérivations verbales** (passif, causatif). D7 ne donne pas de forme sûre pour la plupart : elles ne sont pas traduites.

**Mesure actuelle** (`npm run engine-report`, sur les 375 textes de D8) :

- 184 traduits complètement ;
- 21 termes gardés volontairement en français ;
- 149 brouillons non affichés ;
- 21 replis sur le français.

## Installation et lancement

### Prérequis

- Node.js ≥ 20 pour la construction, ≥ 22 pour le banc Chrome (`npm run e2e-extension`).
- Chrome ≥ 110.

### Construire et charger l'extension

```sh
npm ci
npm run build          # extension de production dans dist/
```

Dans Chrome :

1. Ouvrir `chrome://extensions`.
2. Activer le **mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée** et choisir `dist/`.

L'extension ne demande qu'une autorisation, sur `https://safinum.cm/hackathon-test`. Après une nouvelle construction, rechargez l'extension, puis la page.

### Packaging

```sh
npm run package        # construit dist/ puis release/finethnic-<version>.zip
```

L'archive est reproductible : deux constructions donnent le même fichier. Elle contient les licences dans `licences/`. Pour l'installer, décompressez-la, puis chargez le dossier obtenu comme ci-dessus. Pour la publier sur le Chrome Web Store, envoyez ce `.zip`.

### Environnement de test SPA

**Page de test locale.** Elle reproduit une SPA de 5 étapes avec des données fictives :

```sh
npm run build:dev      # dist-dev/ : s'active aussi sur localhost et 127.0.0.1 (ne pas distribuer)
python3 -m http.server 8000 --directory tests/fixtures
```

Chargez `dist-dev/` dans Chrome, puis ouvrez `http://localhost:8000/safinum-test.html`.

**Banc automatique.** Il teste le paquet de production dans un vrai Chrome sans interface :

```sh
npm run e2e-extension                          # construit la production et la teste
npm run e2e-extension -- --dist <dossier>      # teste un dossier déjà construit (ex. le .zip décompressé)
```

La page locale est servie à l'adresse exacte du manifest. Pour chacune des 5 étapes, le banc vérifie :

- des textes sont traduits ;
- les nombres sont conservés ;
- la désactivation rend le français exact.

Il vérifie aussi qu'un texte injecté dynamiquement est traduit, et qu'une phrase absente de D8 est enrichie et gardée avec `{valeur}` à la place du montant. Le chemin de Chrome peut être donné avec `--chrome <binaire>` ou `CHROME_PATH`.

**Site réel.** Après avoir chargé `dist/` (ou le `.zip` décompressé) :

1. Ouvrir **directement** `https://safinum.cm/hackathon-test`.
2. Vérifier que des libellés et des phrases passent en éton, et que les montants et les noms restent intacts.
3. Parcourir les étapes : les textes ajoutés par l'application sont traduits à leur tour.
4. Ouvrir le popup : la rubrique « Cette page » résume les textes trouvés et traduits ; le mode diagnostic en donne le détail.
5. Couper l'interrupteur : la page revient exactement au français.

Le fonctionnement détaillé de l'extension (popup, affichage, mode diagnostic, protection des données) est décrit dans [`docs/EXTENSION.md`](docs/EXTENSION.md).

### Tests

```sh
npm test               # tests unitaires et d'intégration (Vitest)
npm run typecheck      # types du moteur et de l'extension
npm run engine-report  # bilan du moteur sur tout D8
```
