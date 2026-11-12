# PROJECT_CONTEXT — SAFINUM Éton (dépôt FinEthnic)

> **Statut :** Phase 0 — cadrage, en attente de validation par le responsable du projet. Q3, Q4 et Q5 sont tranchées ; Q1 et Q2 restent ouvertes.
> **Version :** 0.3 — 2026-11-12 (v0.2 + décisions Q3/Q4/Q5 ; chiffres revérifiés automatiquement sur les fichiers téléversés)
> **Règle :** aucun développement de l'extension avant validation de ce document et de `ROADMAP.md`.

---

## 1. Documents de référence analysés

| # | Document | Rôle | Apports principaux |
|---|---|---|---|
| D1 | Prompt principal « SAFINUM Éton » | Cahier des charges interne | 3 composantes (bibliothèque / textes des 5 pages / extension), règles de protection, méthode de travail, phases 0–8 |
| D2 | `Preselection_Epreuve_SAFINUM_Innovate_Challenge.md` | Règlement officiel de l'épreuve | 5 capacités minimales, 5 livrables (dont vidéo ≤ 3 min et note technique), barème v1, règles de sécurité, déclaration des composants tiers |
| D3 | `Protocole_de_test_Hackathon_SAFINUM_Innovate_2026.md` | Protocole de l'environnement de test | Parcours en 5 étapes, **aucun hook / API / `data-i18n`**, injection de contenu par le jury, défauts linguistiques majeurs, barème v2, exigences d'accessibilité |
| D4 | `corpus_financier_reference_FR.md` | Composante A — corpus général FR | 300 entrées (VOC 100, ACT 60, SEC 60, MSG 80), ID stables, sensibilité des actions, variables `{...}` protégées. **0 traduction.** |
| D5 | `FinEthnic-glossaire-financier-v0.1.md` (contenu identique à `etonfin-glossaire-financier-v0.1.md` ; seul le titre H1 a été renommé) | Composante B + cadrage linguistique | 62 libellés des 5 pages (P1–P5), statuts normalisés, variété **Obala**, orthographe du *Dictionnaire éton–français* (Van de Velde & Essele Essele, CLÉ 2022), 4 formes lexicales attestées, fiche et procédure de validation, schéma JSON. **0 traduction validée.** |

> Les documents D2–D5 ne sont pas encore versionnés dans le dépôt. Recommandation : les ajouter **tels quels** dans `docs/sources/` (voir question Q11).

---

## 2. Reformulation du projet

### 2.1 Problème
Les services financiers numériques camerounais sont présentés en français ou en anglais. Les personnes qui maîtrisent mal ces langues comprennent mal les soldes, les frais, les confirmations et les alertes de sécurité. Cette incompréhension crée un risque d'exclusion et un risque de fraude ou d'erreur.

### 2.2 Solution envisagée
Une **couche linguistique indépendante** affiche en **Éton (variété d'Obala)** les libellés d'une interface financière existante, sans modifier le code de cette interface. Pour la présélection, cette couche prend la forme d'une **extension Chrome MV3** testée sur l'environnement commun « SAFINUM Pay ».

### 2.3 Les trois composantes (distinctes et complémentaires)

| Composante | Nature | Rôle | État actuel |
|---|---|---|---|
| **A — Bibliothèque financière Éton** | Données linguistiques (source de vérité) | Référentiel durable et réutilisable (extension, puis API/SDK/mobile) | 300 entrées FR, 0 Éton |
| **B — Référentiel des 5 pages** | Données de test traçables | Couverture du parcours, tests de non-régression, priorisation des traductions | 62 libellés FR, 0 Éton |
| **C — Extension Chrome** | Logiciel | Détecte, protège, apparie, affiche ; ne fait que **consommer** A et B | À développer |

**Principe :** l'extension ne contient aucune connaissance linguistique propre. Elle n'affiche que ce que la bibliothèque déclare validé.

### 2.4 Exigences de sécurité (synthèse)
- **Ne jamais altérer** les montants, les frais, les totaux, la devise `FCFA`, les signes `+`/`-`/`−`, les séparateurs, les dates, les heures, les noms, les téléphones, les numéros de compte, les références, les e-mails, les URL ou les valeurs saisies.
- **Ne jamais toucher** les `input`, `textarea`, `select`, `[contenteditable]`, ni les attributs fonctionnels, les événements, les calculs ou la navigation.
- **Aucun réseau** : traitement 100 % local, aucune collecte, aucun stockage et aucun log de donnée affichée.
- **Ne jamais affaiblir** une alerte (« jamais », « immédiatement », « irréversible », « temporairement », négations) ni inverser une action critique (Envoyer/Recevoir, Confirmer/Annuler, Débiter/Créditer, Bloquer/Débloquer).
- **En cas de doute, conserver le français.** La priorité est l'intégrité, pas le taux de couverture.

### 2.5 Contraintes de la présélection
- Livrable prioritaire : l'extension, installable en mode développeur, fonctionnelle sur les 5 étapes.
- Page « normale » sans marqueur : l'extension doit analyser le DOM tel qu'il est.
- Le jury peut injecter du contenu inédit pendant la démonstration.
- Livrables annexes : description, vidéo ≤ 3 min, note technique (architecture, intégration, dépendances, limites), langue prise en charge et **méthode de validation linguistique**.
- Composants tiers et outils d'IA utilisés pendant le développement : à déclarer.
- Date limite de soumission : **non communiquée dans les documents** (Q1).

---

## 3. Constats d'analyse (incohérences, tensions, risques)

### 3.1 Conflits entre documents (décision requise)
| # | Conflit | Documents |
|---|---|---|
| C1 | **Deux barèmes différents** : D2 (Fonctionnement 25 / Intégration 20 / Sécurité 20 / Accessibilité 15 / Contenu inédit 10 / Faisabilité & doc 10) et D3 (Fonctionnement 25 / **Fidélité des traductions 20** / Sécurité 20 / Intégration 15 / Accessibilité 10 / **Innovation 10**). D3 indique aussi que la vérification linguistique est **séparée** des 100 points. | D2 vs D3 |
| C2 | **Nom du projet** : « SAFINUM Éton » (D1) ; « FinEthnic » (titre de D5 et nom du dépôt) ; « EtonFin » (corps de D5 : en-tête, JSON `"project"`, §4, §9, §10). Le renommage de D5 est **partiel**. | D1, D5 |
| C3 | **Schéma de données** : D1 demande 14 champs, dont **deux statuts de validation distincts** (linguistique et sens financier). D5 propose 11 champs avec un **statut unique** (`VALIDATED_OBALA`). | D1 vs D5 |
| C4 | **Arborescence** : D1 propose `src/language/eton.json` et du JS. D5 propose `locales/eton-obala.json`, des tests `.ts` et `docs/glossaire-financier.md`. | D1 vs D5 |
| C5 | **Contenu inédit** : D3 attend que l'extension le détecte **« et le traduise »**. D1 et D5 interdisent toute traduction inventée ou approximative. | D3 vs D1/D5 |

**Position proposée pour C5 :** la traduction n'est garantie que si le texte inédit correspond exactement à une entrée validée ou à un **gabarit validé à variables**. Sinon, l'extension détecte le texte, le conserve en français et le signale de façon visible. Notre argument auprès du jury : nous préférons **zéro contresens**. Le barème de D3 soutient cette position : le critère « Fidélité des traductions » (20 pts) pénalise explicitement le « texte inventé ».

**Conséquence pour la démo :** pour que le contenu inédit soit *traduit* et pas seulement détecté, il faut faire valider **à l'avance** les messages que le jury injectera le plus probablement. Ce sont les catégories MSG « Erreurs et messages système » et SEC « Alertes », plus la liste de D5 §6.4. C'est un chantier **linguistique**, pas logiciel (voir R1 et Q12).

### 3.2 Quasi-doublons entre corpus (D4) et pages (D5) — à NE PAS fusionner automatiquement
| Corpus | Page | Différence |
|---|---|---|
| MSG-026 « Note (facultative) » | P3-008 « Note (optionnel) » | Formulation différente, sens identique |
| MSG-041 « …sont **exactes**. » | P4-010 « …sont **correctes**. » | Mot différent |
| MSG-047 « Transfert effectué avec succès. » | P5-001 « Transfert effectué » | Phrase différente (titre vs message) |
| SEC-044 « Vérifiez toujours le nom du bénéficiaire avant de confirmer. » | P1-015 « …le nom **et le numéro**… avant de confirmer **un transfert**. » | P1-015 est plus précis ; sens non identique |
| VOC-055 « Réussi » / MSG-052 « Statut : Réussi » | P5-009 « Succès » / P5-008 « Statut » | Synonymes, termes à valider séparément |
| ACT-051 « Retourner » | P2-011/P3-010 « Retour » | Verbe vs libellé de bouton |
| MSG-001 « Bienvenue, {nom}. » | P1-002 « Bonjour, Amina » | P1-002 doit devenir un **gabarit** « Bonjour, {prénom} » ; « Amina » est une donnée protégée |

### 3.3 Doublons internes (vérification automatique ponctuelle, sans modification des sources)
Une analyse automatique (casse, espaces et ponctuation finale normalisés) confirme : **300 ID uniques** (VOC 100, ACT 60, SEC 60, MSG 80), **aucun ID en double**.
- **Doublons stricts entre catégories du corpus (2)** : VOC-078 = MSG-025 « Motif du transfert » ; ACT-055 = MSG-056 « Télécharger le reçu ». L'un est un *terme*, l'autre un *libellé d'interface*. On les garde tous les deux, liés par `relatedTo`, avec **une seule traduction partagée** (à valider).
- **Recouvrements de sens** : VOC-009 « Solde insuffisant » / MSG-066 ; VOC-054 « En attente » / MSG-053 ; MSG-060 / MSG-065 ; SEC-053 / MSG-068 (proches, non identiques).
- **Termes proches mais distincts (à préserver)** : Montant/Somme (VOC-023/024), Bénéficiaire/Destinataire (VOC-058/059), Transfert/Virement (VOC-042/043), Débit/Débiter (nom vs verbe), Confirmer/Valider/Approuver (ACT-016/018/021), Continuer/Suivant (ACT-050/052), Blocage temporaire/Verrouillage (SEC-028/030), Confidentialité/Vie privée (VOC-096/SEC-011).
- **Doublons internes aux pages (normaux)** : Frais (P2-007, P4-004, P5-005), Montant, Total débité, Bénéficiaire, Référence, Retour, Continuer. Ces textes forment une seule **unité de traduction**, mais chaque occurrence conserve son ID de page.
- **Cas particulier** : VOC-019 « Franc CFA (FCFA) » : le terme peut être traduit, mais le code `FCFA` reste toujours protégé.

### 3.4 Couverture des 5 pages par le corpus (traçabilité A ↔ B)
- Les 62 occurrences correspondent à **53 libellés uniques**.
- **19** de ces libellés existent à l'identique dans le corpus (après normalisation) : Compte courant (VOC-002), Numéro de compte (VOC-005), Solde disponible (VOC-008), Montant (VOC-023), Frais (VOC-028), Frais de transfert (VOC-029), Gratuit (VOC-038), Opération (VOC-041), Récapitulatif (VOC-051), Référence (VOC-052), Bénéficiaire (VOC-058), Numéro de téléphone (VOC-077), Motif du transfert (VOC-078/MSG-025), Modifier (ACT-037), Continuer (ACT-050), Connexion sécurisée (SEC-008), Transactions récentes (MSG-004), Nom du bénéficiaire (MSG-023), Nouveau transfert (MSG-058).
- **34** libellés sont **propres à l'interface** : Votre compte, Effectuer un transfert, Consulter les frais, Paiement marchand, Salaire reçu, Transfert reçu, Facture électricité, Sécurité, Type d'opération, Compte Safinum, Montant à envoyer, Total à débiter, Total débité, Solde après opération, Retour, Paiement de services, Téléphone, Statut, Succès, Confirmer le transfert, Transfert effectué, ainsi que les phrases et libellés composés P1-003, P1-015, P1-017, P2-002, P2-005, P3-002, P3-003, P3-008, P3-009, P4-002, P4-010, P5-002, et le gabarit P1-002.
- **Proposition :** garder les 34 libellés comme entrées de pages (`P*`). Ensuite, proposer leur intégration au corpus **par lot et sur validation**. Les libellés de base « Total débité », « Statut » et « Téléphone » sont de bons candidats. Les entrées identiques sont reliées par `corpusRef` et partagent une seule traduction. **Aucune fusion n'est automatique.**

### 3.5 Points techniques sensibles relevés
- **Signes** : D1 utilise `−` (U+2212), D5 utilise `-` (U+002D). La protection doit couvrir les deux et ne jamais les normaliser **dans la page**.
- **Espaces** : les montants FR utilisent souvent des espaces insécables (U+00A0 / U+202F). La normalisation sert **uniquement à la comparaison**, jamais à la réécriture.
- **Diacritiques Éton** (ex. `mɔ̀ní`, `d-ɔ́lɔ̂`) : ils reposent sur des caractères combinants. Il faut une normalisation Unicode NFC cohérente dans les données et une police qui rend correctement ces signes (une police libre embarquée peut être nécessaire).
- **Faux positif critique** : une donnée saisie peut coïncider avec une entrée de la bibliothèque. Exemple : une note « Facture » ou le motif « Paiement de services », réaffiché à l'étape 4. Une **liste blanche** ne suffit donc pas : il faut aussi le **contexte DOM** (cellule de valeur vs libellé).
- **Frameworks** (React/Vue, etc.) : ajouter ou retirer des nœuds peut casser la réconciliation. Il faut donc modifier uniquement `Text.data`, sans restructurer le DOM.
- **Traductions disponibles** : **aucune n'est validée aujourd'hui.** Sans validation linguistique en parallèle, l'extension fonctionnera mais n'affichera aucun texte en Éton. C'est le **risque n° 1** du projet.
- **Licence du dictionnaire** (CLÉ 2022) : il faut la vérifier avant de redistribuer des formes lexicales dans le dépôt public ou dans le livrable.

### 3.6 Compléments de la revue v0.2
Revérification manuelle de D4 et D5 : les chiffres de la v0.1 sont confirmés (300 ID ; 62 occurrences ; 53 libellés uniques ; 19 correspondances exactes). Les points suivants n'étaient pas couverts :

1. **Libellés de page ↔ gabarits du corpus.** Le corpus modélise souvent « libellé : {valeur} » en **une seule chaîne**, alors que la page affiche probablement le libellé et la valeur dans **deux nœuds séparés** (à confirmer avec Q2). Correspondances concernées :

   | Page | Gabarit corpus |
   |---|---|
   | P1-005 « Numéro de compte : » | MSG-003 « Numéro de compte : {numéro_compte} » |
   | P2-001 « Frais de transfert » | MSG-013 « Frais de transfert : {frais} {devise} » |
   | P2-009 « Total à débiter » | MSG-014 « Total à débiter : {total} {devise} » |
   | P4-004 / P5-005 « Frais » | MSG-037 « Frais : {frais} {devise} » |
   | P4-005 / P5-006 « Total débité » | MSG-038 « Total débité : {total} {devise} » |
   | P4-006 / P5-007 « Bénéficiaire » | MSG-039 « Bénéficiaire : {nom_bénéficiaire} » |
   | P4-008 / P5-003 « Référence » | MSG-040 « Référence : {référence} » |

   **Conséquences :**
   - le matcher doit gérer les deux formes : libellé seul dans son nœud, ou libellé et valeur dans le même nœud ;
   - le libellé isolé et la partie libellé du gabarit doivent recevoir la **même traduction**. Une divergence est **signalée** dans le rapport de qualité, mais ne bloque pas le build, car la grammaire de l'Éton peut l'exiger ;
   - « Total à débiter » et « Total débité » restent des entrées de page (`P*`), reliées aux gabarits par `templateRefs`.
2. **Phrase incluse dans un paragraphe.** La 2ᵉ phrase de P2-002 (« Les frais sont calculés automatiquement. ») est identique à MSG-017. Ce cas concret alimente Q7, qui porte sur la traduction tout ou rien par nœud.
3. **Noms de marque.** « Safinum » et « Safinum Pay » apparaissent dans P1-017 et P2-004. D5 §4.3 les classe hors traduction. Ils doivent donc devenir des **jetons protégés**, au même titre que `FCFA`. P2-004 devient le gabarit « Compte {marque} ».
4. **Attributs d'accessibilité.** D3 exige la compatibilité avec les lecteurs d'écran. Si un texte visible est traduit mais que son `aria-label` ou son `title` reste en français, le lecteur d'écran lit une version différente de l'écran. La question Q8 est élargie à ce cas. Dans tous les cas, `value`, `name`, `id` et `href` ne sont jamais touchés.
5. **Lecture de l'Éton écrit.** Le public visé maîtrise mal le français, mais il ne lit pas forcément l'orthographe tonale du dictionnaire. C'est un risque pour le critère « Accessibilité » et pour la pertinence du projet (R12). Pistes **post-MVP** :
   - mode bilingue ;
   - **enregistrements audio** de phrases validées, réalisés par les locutrices et embarqués localement, **sans synthèse vocale distante**.

   Voir la question Q13.
6. **Q2, nouvel essai le 12/11/2026** : `safinum.cm` et `www.safinum.cm` ne sont toujours pas résolus (DNS) depuis mon environnement. L'origine exacte reste à confirmer de ton côté.

---

## 4. Architecture proposée

### 4.1 Principes
1. **Liste blanche** : seul un texte qui correspond à une entrée ou à un gabarit **validé** peut être modifié. Tout le reste est intact par construction.
2. **Défense en profondeur** : liste blanche, puis contexte DOM, puis motifs de données protégées, puis contrôle d'intégrité avant et après chaque modification.
3. **Modification minimale** : on remplace seulement `Text.data`, sans `innerHTML`, sans création ni suppression de nœuds et sans attribut fonctionnel. L'original est mémorisé dans une `WeakMap` pour une restauration exacte.
4. **Séparation données / moteur** : la bibliothèque est générée à la compilation en un JSON d'exécution qui ne contient que les entrées affichables.
5. **Moindre privilège** : permission `storage` seulement, et hôtes limités à l'origine exacte du test. Pas de service worker sauf besoin avéré.

### 4.2 Arborescence cible (proposition, à valider — Q4)
```text
FinEthnic/
├── manifest.json                 # MV3 production : origine SAFINUM uniquement
├── manifest.dev.json             # MV3 développement : + localhost pour les fixtures
├── build.mjs                     # bundle esbuild → dist/
├── package.json
├── README.md                     # installation, tests, démo
├── ROADMAP.md
├── PROJECT_CONTEXT.md
├── THIRD_PARTY.md                # déclaration des dépendances et outils (exigence D2/D3)
├── docs/
│   ├── sources/                  # D2–D5 versionnés tels quels (traçabilité)
│   ├── architecture.md           # → base de la note technique
│   ├── note-technique.md         # livrable D2 §6
│   ├── validation-linguistique.md
│   ├── test-report.md            # résultats « obtenu / statut » des tests
│   ├── demo/                     # script d'injection de démo, script vidéo
│   └── reports/                  # rapports générés (doublons, couverture)
├── data/                         # SOURCE DE VÉRITÉ linguistique (hors extension)
│   ├── financial-corpus/         # Composante A : VOC/ACT/SEC/MSG (+ cible Éton, statuts)
│   ├── safinum-test-pages/       # Composante B : P1–P5, avec lien `corpusRef` vers A
│   └── schema/                   # JSON Schema des entrées
├── scripts/
│   ├── import-markdown.*         # import initial des tableaux MD → JSON (une seule fois)
│   ├── check-duplicates.*        # rapport doublons stricts / normalisés / potentiels
│   ├── build-lexicon.*           # génère le JSON d'exécution (entrées validées seulement)
│   └── export-review-sheet.*     # CSV/feuille pour les locutrices
├── src/
│   ├── content/
│   │   ├── index.*               # point d'entrée, cycle de vie, activation
│   │   ├── scanner.*             # TreeWalker sur les nœuds texte
│   │   ├── observer.*            # MutationObserver, regroupement, anti-boucle
│   │   └── diagnostic.*          # compteurs + surlignage via CSS Custom Highlight API (aucune mutation du DOM)
│   ├── protection/
│   │   ├── patterns.*            # montants, FCFA, téléphones, comptes, références, dates…
│   │   ├── dom-guard.*           # input/textarea/select/contenteditable, contexte libellé/valeur
│   │   └── integrity.*           # empreinte des valeurs protégées avant/après → retour arrière auto
│   ├── language/
│   │   ├── normalizer.*          # normalisation POUR COMPARAISON uniquement
│   │   ├── matcher.*             # exact → gabarit à variables → inconnu
│   │   └── lexicon.json          # GÉNÉRÉ par build-lexicon (ne pas éditer)
│   ├── render/
│   │   └── renderer.*            # application / restauration, lang="eto", mode d'affichage
│   ├── popup/                    # popup.html / .css / .*  (accessible clavier + lecteur d'écran)
│   └── shared/                   # messages storage, logger sans données
├── tests/
│   ├── unit/                     # Vitest + jsdom
│   ├── fixtures/                 # pages locales reproduisant les 5 étapes (données fictives)
│   └── e2e/                      # Playwright avec extension chargée
└── icons/
```
**Écarts par rapport à D1 :**
- `render/` est séparé de `content/` pour tester l'application et la restauration isolément.
- `integrity.*` est ajouté parce que le critère Sécurité vaut 20 points.
- `scripts/` + JSON généré évitent deux listes divergentes, comme le recommande D5 §7.3.
- `input-guard` est fusionné dans `dom-guard`.
- `utils/` est renommé `shared/`.

### 4.3 Flux d'exécution
```
Chargement page / mutation
   │
   ▼
scanner (TreeWalker, nœuds Text)  ──►  dom-guard : exclure input/textarea/select/
   │                                      contenteditable/script/style/code, nœuds
   │                                      déjà traités, cellules « valeur »
   ▼
normalizer (comparaison seulement)
   ▼
matcher ──► 1. correspondance exacte (entrée validée)
        ──► 2. gabarit validé : masque les segments protégés en {variables},
               apparie, puis RÉINJECTE les valeurs originales octet par octet
        ──► 3. inconnu → conservé en FR, compté/signalé (en mémoire seulement)
   ▼
integrity : empreinte des valeurs protégées avant/après ; si écart → retour arrière + alerte
   ▼
renderer : Text.data ← Éton ; original dans WeakMap ; lang="eto" si l'élément est entièrement traduit
   ▲
observer (MutationObserver childList+characterData+subtree, regroupé par micro-tâche/rAF,
          ignore ses propres écritures, réévalue si l'application réécrit un nœud)

popup ⇄ chrome.storage.local { enabled, displayMode, diagnostic } ⇄ content (storage.onChanged)
Désactivation → restauration exacte de tous les nœuds depuis la WeakMap.
```

### 4.4 Règle d'affichage d'une entrée (proposée)
Une entrée n'est affichée que si `target` est non nul **ET** `linguisticStatus = VALIDATED_OBALA` **ET** `financialMeaningStatus = VALIDATED` **ET** les variables de la cible sont identiques à celles de la source. `build-lexicon` exclut tout le reste, donc une entrée non validée ne peut pas être livrée dans l'extension.

### 4.5 Schéma d'entrée unifié (proposition — résout C3)
`id`, `kind` (`term` | `action` | `security` | `message` | `template`), `category`, `subcategory`, `source` (FR exact), `sourceVariants[]` (variantes FR **approuvées**), `target` (Éton | null), `targetVariants[]`, `variables[]`, `context`, `example`, `sensitivity` (`critical` | `high` | `standard`), `linguisticStatus` (statuts D5), `financialMeaningStatus` (`PENDING` | `VALIDATED` | `REJECTED`), `dictionaryForm`, `sourceReference`, `reviewer`, `reviewDate`, `notes`, `corpusRef` / `pageRefs[]` (traçabilité A↔B), `templateRefs[]` (lien libellé seul ↔ gabarit « libellé : {valeur} », §3.6-1), `duplicateOf` / `relatedTo[]` (sans fusion automatique).

### 4.6 Choix techniques proposés
| Sujet | Proposition | Raison |
|---|---|---|
| Langage | **TypeScript** compilé par **esbuild** en un seul script de contenu | Typage du schéma ; les scripts de contenu MV3 ne sont pas des modules ES, donc un bundle est nécessaire |
| Tests unitaires | **Vitest + jsdom** | Rapide, compatible TS |
| Tests E2E | **Playwright** (Chromium, extension chargée via contexte persistant) sur des **fixtures locales** et, si l'accès le permet, sur l'environnement réel | Reproductible hors ligne |
| Permissions | `storage` + `host_permissions` limités à l'origine exacte | Moindre privilège |
| Réseau | Aucun appel ; CSP MV3 par défaut ; aucune dépendance d'exécution tierce | Règles D2/D3 |
| Police | Police libre (licence OFL) embarquée seulement si le rendu des diacritiques l'exige | Lisibilité de l'Éton |

---

## 5. Questions ouvertes (à trancher avant ou pendant le développement)

**Bloquantes avant la phase 1**
- **Q1 — Calendrier** : quelle est la date limite de soumission et de démonstration ? Elle conditionne le découpage de la roadmap.
- **Q2 — Origine exacte de l'environnement de test** : `safinum.cm` est inaccessible depuis mon environnement (échec DNS avec `curl`, `ERR_BLOCKED_BY_CLIENT` dans le navigateur). Je ne peux donc pas vérifier moi-même l'origine. Quelle est l'URL de « Ouvrir l'environnement de test » (domaine, sous-domaine, chemin) ? Y a-t-il des redirections ou des iframes vers une autre origine ? Les 5 étapes sont-elles sur une seule URL (SPA) ou sur plusieurs ? Peux-tu enregistrer le HTML de chaque étape (Ctrl+S, avec des données fictives) pour construire des fixtures de test ?
- **Q3 — Mode d'affichage** — ✅ **Tranchée (2026-11-12) : option (a).** L'Éton remplace le français, et le français reste accessible au survol ou au focus. Le popup propose une bascule vers le mode bilingue (b).
- **Q4 — Stack** — ✅ **Tranchée (2026-11-12) : TypeScript + esbuild** (un seul bundle), tests **Vitest** (unitaires) et **Playwright** (e2e).
- **Q5 — Source de vérité linguistique** — ✅ **Tranchée (2026-11-12) : JSON dans `data/`.** Les Markdown et CSV de relecture destinés aux locutrices sont **générés** à partir de ce JSON et ne sont jamais édités à la main. Les documents Markdown D4 et D5 ne servent qu'à l'import initial.

**Importantes, peuvent être tranchées en phase 2–4**
- **Q6 — Barème de référence** : D2 ou D3 (conflit C1) ? Il faut peut-être confirmer auprès des organisateurs.
- **Q7 — Paragraphes multi-phrases** (ex. P2-002, P3-003) : si une seule phrase est validée, traduit-on partiellement (texte mixte FR/Éton) ou laisse-t-on tout en français ? **Recommandation : tout ou rien par nœud texte.**
- **Q8 — `select`/`option`, `placeholder` et attributs d'accessibilité** : P3-007 « Paiement de services » est probablement une option de liste. Par défaut, on ne touche à rien. Faut-il traduire :
  - les **libellés** d'options (`option.text` uniquement, jamais `value`) ?
  - les attributs `placeholder`, `aria-label`, `title` et `alt` lorsqu'ils correspondent à une entrée validée (§3.6-4) ?

  **Recommandation : oui pour `aria-label` et `title`**, afin que le lecteur d'écran lise la même chose que l'écran. Les options et le `placeholder` peuvent attendre une phase ultérieure.
- **Q9 — Statuts intermédiaires** : pour la démo, une entrée `REVIEW_PENDING` peut-elle s'afficher avec un marqueur « à valider » ? **Recommandation : non.**
- **Q10 — Nommage (conflit C2)** : la description du dépôt présente **FinEthnic** comme une plateforme multilingue (bibliothèques, moteur, extensions, API, SDK). Hypothèse proposée : **FinEthnic** = plateforme et dépôt, **SAFINUM Éton** = module ou livrable Éton de la présélection, et « EtonFin » est un ancien nom à remplacer dans D5. Peux-tu confirmer ?
- **Q11 — Versionner D2–D5** dans `docs/sources/` ? Le dépôt est actuellement **privé**. Si on le rend public pour la soumission, la licence du dictionnaire permet-elle d'y publier des formes lexicales ?
- **Q12 — Calendrier linguistique** : combien de locutrices d'Obala sont disponibles, et à quel rythme ? Cela fixe le nombre réaliste de libellés validés pour la démo. **Priorité suggérée : les ~53 libellés uniques des 5 pages (62 occurrences), puis les actions critiques et les alertes SEC.**
- **Q13 — Public qui ne lit pas l'Éton (§3.6-5)** : les locutrices peuvent-elles enregistrer l'audio des phrases critiques en même temps que leur validation ? Si oui, l'option « écouter » pourra être ajoutée **après** le MVP, avec des fichiers locaux et sans service distant. Ce n'est pas bloquant pour P1–P7.
