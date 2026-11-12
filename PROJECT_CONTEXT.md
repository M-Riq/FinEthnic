# PROJECT_CONTEXT — SAFINUM Éton (dépôt FinEthnic)

> **Statut :** Phase 0 — cadrage, en attente de la **Synchronisation 1** (TEAM_WORKFLOW §7). Q3, Q4, Q5 et Q10 sont tranchées. Q1 et Q2 restent ouvertes, ainsi que les nouvelles questions bloquantes Q14, Q16 et Q19.
> **Version :** 0.4 — 2026-11-12 (v0.3 alignée sur `TEAM_WORKFLOW.md` (D6) : §2.3, §3.7, §4 et §5 ; contrat proposé dans `INTEGRATION_CONTRACT.md`)
> **Règle :** aucun développement (extension, bibliothèque ou moteur) avant la validation de S1 : architecture, format JSON (§4.5), contrat d'intégration et répartition des tâches.

---

## 1. Documents de référence analysés

| # | Document | Rôle | Apports principaux |
|---|---|---|---|
| D1 | Prompt principal « SAFINUM Éton » | Cahier des charges interne | 3 composantes (bibliothèque / textes des 5 pages / extension), règles de protection, méthode de travail, phases 0–8 |
| D2 | `Preselection_Epreuve_SAFINUM_Innovate_Challenge.md` | Règlement officiel de l'épreuve | 5 capacités minimales, 5 livrables (dont vidéo ≤ 3 min et note technique), barème v1, règles de sécurité, déclaration des composants tiers |
| D3 | `Protocole_de_test_Hackathon_SAFINUM_Innovate_2026.md` | Protocole de l'environnement de test | Parcours en 5 étapes, **aucun hook / API / `data-i18n`**, injection de contenu par le jury, défauts linguistiques majeurs, barème v2, exigences d'accessibilité |
| D4 | `corpus_financier_reference_FR.md` | Composante A — corpus général FR | 300 entrées (VOC 100, ACT 60, SEC 60, MSG 80), ID stables, sensibilité des actions, variables `{...}` protégées. **0 traduction.** |
| D5 | `FinEthnic-glossaire-financier-v0.1.md` (contenu identique à `etonfin-glossaire-financier-v0.1.md` ; seul le titre H1 a été renommé) | Composante B + cadrage linguistique | 62 libellés des 5 pages (P1–P5), statuts normalisés, variété **Obala**, orthographe du *Dictionnaire éton–français* (Van de Velde & Essele Essele, CLÉ 2022), 4 formes lexicales attestées, fiche et procédure de validation, schéma JSON. **0 traduction validée.** |
| D6 | `TEAM_WORKFLOW.md` (versionné à la racine, v0.4) | Organisation de l'équipe | 2 membres et 2 périmètres (responsable : bibliothèque + moteur ; Yvan : extension), développement **parallèle** avec faux moteur, langues sources **FR et EN**, 6 états de résultat du moteur, contrat `INTEGRATION_CONTRACT.md`, arborescence `data/`, règles Git, 5 synchronisations, définition de terminé |
| D7 | *Dictionnaire éton–français* (Van de Velde & Essele Essele, CLÉ 2022) | Ressource lexicale | **Pas encore fourni** : il sera téléversé au démarrage de la bibliothèque et du moteur (phase BM3). Format et licence à confirmer (Q17). |

> Les documents D2–D5 ne sont pas encore versionnés dans le dépôt. Recommandation : les ajouter **tels quels** dans `docs/sources/` (voir question Q11). D7 ne doit **pas** être versionné (§3.7.4-3).

---

## 2. Reformulation du projet

### 2.1 Problème
Les services financiers numériques camerounais sont présentés en français ou en anglais. Les personnes qui maîtrisent mal ces langues comprennent mal les soldes, les frais, les confirmations et les alertes de sécurité. Cette incompréhension crée un risque d'exclusion et un risque de fraude ou d'erreur.

### 2.2 Solution envisagée
Une **couche linguistique indépendante** affiche en **Éton (variété d'Obala)** les libellés d'une interface financière existante, sans modifier le code de cette interface. Pour la présélection, cette couche prend la forme d'une **extension Chrome MV3** testée sur l'environnement commun « SAFINUM Pay ».

### 2.3 Les trois composantes (TEAM_WORKFLOW §1) et leurs responsables

| Composante | Contenu | Responsable | Dossiers | État actuel |
|---|---|---|---|---|
| **1. Bibliothèque linguistique financière** | **A** : corpus général (VOC/ACT/SEC/MSG). **B** : référentiel des 5 pages (P1–P5). Entrées protégées (`GUARD`). Ressources lexicales (dictionnaire). | Responsable du projet | `data/`, `scripts/` | A : 300 entrées FR ; B : 62 libellés FR ; **0 EN ; 0 Éton validé** |
| **2. Moteur local de correspondance et de traduction** | Normalisation, correspondance, statuts, ambiguïtés, lexique d'exécution. Pur, sans DOM. | Responsable du projet | `src/language/`, `tests/language/` | À développer |
| **3. Extension Chrome** | Popup, scanner, MutationObserver, protection DOM, intégrité, remplacement et restauration | Yvan | `src/content/`, `src/popup/`, `src/protection/`, `tests/extension/` | À développer |
| *Interface 2 ⇄ 3* | `INTEGRATION_CONTRACT.md` | Responsable (revue obligatoire d'Yvan) | `src/language/contract.ts`, `tests/contract/` | Proposition v0.1.0-draft |

Les sous-composantes **A** et **B** gardent leur nom dans le reste du document (traçabilité A ↔ B).

**Principe :** l'extension ne contient aucune connaissance linguistique propre (D6 §4). Elle n'affiche que ce que le moteur déclare `APPROVED`.

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

> Les conflits C6 à C14, liés à `TEAM_WORKFLOW.md` (D6), sont analysés au §3.7.3.

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

### 3.7 Analyse de `TEAM_WORKFLOW.md` (D6) — v0.4

#### 3.7.1 Ce que D6 confirme ou tranche
- **Confirme** les principes v0.3 : liste blanche, aucune traduction non approuvée affichée, valeurs financières intactes, aucun appel réseau, JSON comme source de vérité (Q5).
- **Tranche Q10** : **FinEthnic** est le projet, **SAFINUM Éton** son premier prototype. « EtonFin » (D5) est un ancien nom à remplacer lors de l'import.
- **Apporte** :
  - deux pistes **parallèles**, avec des responsables distincts ;
  - un **faux moteur** côté extension ;
  - un **contrat d'intégration** formel ;
  - six états de résultat ;
  - des langues sources **FR et EN** ;
  - des exports MD/CSV dans `data/exports/` ;
  - des règles Git, cinq synchronisations S1–S5 et une définition de terminé.

#### 3.7.2 Ce qui change dans la v0.4
| Sujet | v0.3 | v0.4 (D6) |
|---|---|---|
| Organisation | Phases séquentielles P1 → P8 et portes | Pistes **EXT** (Yvan), **BM** (responsable) et **L** (locutrices), en parallèle. Portes **à l'intérieur** de chaque piste, synchronisations S1–S5 **entre** les pistes (ROADMAP §0) |
| Moteur | `matcher` dans P4, puis « branchement » dans P5 | Composante à part entière (`src/language/`), contrat **versionné**, faux moteur pour l'extension |
| Statuts de résultat | Affichable / non affichable | Six états (`INTEGRATION_CONTRACT.md` §5) |
| Lexique d'exécution | Entrées affichables **seulement** | **Toutes** les sources connues avec leur statut ; cible incluse **seulement** si elle est approuvée (C7) |
| Langues sources | FR | FR **et** EN (C9) |
| Exports de relecture | `docs/reports/` | `data/exports/markdown/` et `data/exports/csv/` |
| Tests | `tests/unit`, `tests/e2e` | `tests/language`, `tests/extension`, `tests/contract` (+ `tests/e2e`) |

#### 3.7.3 Conflits et écarts (C6–C14)
| # | Écart | Décision proposée |
|---|---|---|
| C6 | En v0.3, « moteur » désigne aussi l'écriture dans le DOM (P5). Dans D6, le moteur est **pur** : il apparie et renvoie un statut. | Le moteur (`src/language/`) n'écrit jamais dans la page. P5 devient « Remplacement, restauration et branchement du moteur » (Yvan). Le renderer passe dans `src/content/renderer.*`. |
| C7 | Le principe 4 de la v0.3 (« le lexique ne contient que les entrées affichables ») empêche de distinguer `KNOWN_UNTRANSLATED`, `PENDING_VALIDATION` et `NO_MATCH`. | Le lexique contient toutes les sources connues (FR/EN), leur statut et leurs variables. Il contient la **cible seulement si elle est approuvée** (invariant I6). Une proposition non approuvée **ne quitte jamais** `data/`. |
| C8 | Les motifs protégés (montants, téléphones, références) servent à la fois au moteur (gabarits) et à l'extension (intégrité). Risque de deux implémentations divergentes (R14). | **Q14** : un module pur unique, injecté dans le moteur. |
| C9 | D6 exige des sources FR et EN, mais **aucune entrée EN** n'existe, et SAFINUM est en français. | Le schéma prévoit `source.en` dès BM1. La saisie EN est la phase BM6, d'ampleur à fixer (**Q15**). Mode `'auto'` à confirmer (**Q16**). |
| C10 | Arborescences différentes (`data/schema` vs `data/schemas`, `docs/reports` vs `data/exports`, `tests/unit` vs `tests/language` et `tests/extension`). | Adopter **D6** (§4.2). |
| C11 | D5 mentionne 3 membres dans l'équipe, D6 en compte 2. | D6 fait foi pour la répartition. À vérifier pour la fiche d'inscription (faible priorité). |
| C12 | Les portes séquentielles de la v0.3 contredisent le principe de parallélisme de D6. | Les portes restent **par piste**. S1–S5 sont des points de rendez-vous, **pas** des blocages (D6 §7). |
| C13 | Trois modèles de statuts : D5 (un axe, 8 statuts), v0.3 (deux axes linguistique et financier), D6 (6 états de résultat). | Trois niveaux dans `data/` (§4.5) : `disposition`, `translationStatus` (D5) et `validation`. Le moteur les traduit en 6 états (contrat §5.2). |
| C14 | Code de langue : D5 écrit `eton`. | Code **ISO 639-3 `eto`**, variété `obala` (contrat §3). |

#### 3.7.4 Points propres au périmètre « bibliothèque et moteur »
1. **Le moteur ne dépend pas du dictionnaire.** Seul le **contenu** de la bibliothèque en dépend. Les phases suivantes peuvent démarrer **avant** le téléversement de D7, avec les données D4/D5 et des cibles de test :
   - BM1 (schéma et contrat) ;
   - BM2 (import FR et qualité) ;
   - BM4 (outils de validation et exports) ;
   - BM5 (moteur) ;
   - L1 (lancement de la validation).

   D5 §6.6 prévoit déjà que les locutrices **proposent** d'abord et que le dictionnaire sert de **comparaison**.
2. **Rôle du dictionnaire.** C'est une ressource de **proposition** et de **justification** (`dictionaryEvidence`). Il n'est **jamais** chargé à l'exécution et ne sert **jamais** à composer une traduction mot à mot : une forme attestée n'est pas une traduction approuvée.
3. **Droit d'auteur (Q17).** Le dictionnaire est une œuvre publiée (Van de Velde & Essele Essele, CLÉ 2022). Proposition :
   - le fichier brut reste **hors Git**, dans `data/language-resources/raw/` (ignoré par `.gitignore`) ;
   - seules les formes **citées** sont versionnées, avec leur référence (page/entrée), comme justification ;
   - aucun import massif dans le dépôt.
4. **Qualité de l'extraction (PDF/OCR → JSON).** Risques :
   - tons et diacritiques combinants perdus ou déplacés (U+0300, U+0301, U+0302, U+030C, U+0304) ;
   - ε grec (U+03B5) confondu avec ɛ (U+025B) ;
   - ɔ (U+0254) et ŋ (U+014B) remplacés par o et n ;
   - mojibake et caractère de remplacement U+FFFD.

   Parades :
   - normalisation **NFC** ;
   - **liste blanche** de caractères autorisés pour l'Éton ;
   - rejet de U+FFFD et des séquences mojibake ;
   - vérification manuelle d'un échantillon.
5. **Aller-retour des relectures (CSV).** Les exports CSV sont en UTF-8 **avec BOM**, pour Excel. La réintégration est **contrôlée** (D6 §5) :
   - `id` et source immuables ;
   - code du relecteur et date obligatoires ;
   - transitions de statut autorisées seulement ;
   - rapport de différences **avant** application ;
   - aucune réécriture silencieuse.
6. **Relecteurs.** Ils sont identifiés par un **code** (ex. `LOC-01`) dans Git. La correspondance entre code et nom reste **hors du dépôt** (D6 §9 : pas de données personnelles inutiles).
7. **Sources EN.** Une source EN pointe vers le **même identifiant** de concept que la source FR. La correspondance FR↔EN est elle-même relue (sens financier), car les faux amis existent (ex. EN « Balance » = FR « Solde », et non « balance »). En mode `'auto'`, un texte présent dans les deux langues avec des sens différents donne `AMBIGUOUS`.
8. **Ambiguïtés déjà visibles dans les données.**
   - « argent » a au moins quatre formes dans le dictionnaire (`mɔ̀ní`, `d-ɔ́lɔ̂`, `sípɛ̂n`, `tɔ̀lápɛ̂n`) ;
   - `yágnà` couvre payer, rémunérer et récompenser ;
   - le bouton « Retour » (page) ≠ ACT-051 « Retourner ».

   Le choix d'une forme se fait **par entrée et en contexte**, par les locutrices. Le moteur ne choisit jamais entre deux formes du dictionnaire.
9. **Volume réaliste à valider pour la démo** : ~53 libellés uniques des pages, plus environ 50 messages probables du jury (MSG/SEC critiques). Cela confirme la priorité de Q12.

---

## 4. Architecture proposée

### 4.1 Principes
1. **Liste blanche** : seul un texte qui correspond à une entrée ou à un gabarit **validé** peut être modifié. Tout le reste est intact par construction.
2. **Défense en profondeur** : liste blanche, puis contexte DOM, puis motifs de données protégées, puis contrôle d'intégrité avant et après chaque modification.
3. **Modification minimale** : on remplace seulement `Text.data`, sans `innerHTML`, sans création ni suppression de nœuds et sans attribut fonctionnel. L'original est mémorisé dans une `WeakMap` pour une restauration exacte.
4. **Séparation données / moteur / extension** : la bibliothèque (`data/`) est compilée en un **lexique d'exécution** (`lexicon.json`). Il contient toutes les sources connues (FR/EN) avec leur statut, mais une cible Éton **seulement si elle est approuvée** (C7, contrat I6). Le moteur pur l'interroge. L'extension ne consomme que le résultat du moteur, via `INTEGRATION_CONTRACT.md`.
5. **Moindre privilège** : permission `storage` seulement, et hôtes limités à l'origine exacte du test. Pas de service worker sauf besoin avéré.
6. **Développement parallèle** : l'extension est développée et testée avec un **faux moteur** conforme au contrat. La bibliothèque et le moteur sont développés et testés **sans Chrome** (Node + Vitest). Le remplacement du faux moteur par le vrai ne touche qu'**un seul fichier** (`src/content/engine-provider.ts`).

### 4.2 Arborescence cible (v0.4, alignée sur D6 — à valider en S1)
Responsables : **[R]** responsable du projet, **[Y]** Yvan, **[R+Y]** copropriété (toute modification passe par une PR relue par l'autre membre).
```text
FinEthnic/
├── manifest.json                 # [Y] MV3 production : origine SAFINUM uniquement
├── manifest.dev.json             # [Y] MV3 développement : + localhost pour les fixtures
├── build.mjs                     # [R+Y] esbuild → dist/ ; échoue si le faux moteur est dans le build de prod
├── package.json, tsconfig.json   # [R+Y] créés une seule fois en P1.1 par Yvan (Q19), modifiés ensuite par PR
├── .gitignore                    # [R+Y] exclut dist/, node_modules/, data/language-resources/raw/
├── README.md                     # [Y] installation de l'extension ; [R] section bibliothèque et moteur
├── PROJECT_CONTEXT.md, ROADMAP.md, TEAM_WORKFLOW.md   # [R]
├── INTEGRATION_CONTRACT.md       # [R] rédige, [Y] relit obligatoirement (procédure contrat §10)
├── THIRD_PARTY.md                # [R+Y] dépendances, outils et sources (exigence D2/D3, dictionnaire cité)
├── docs/
│   ├── sources/                  # [R] D2–D5 versionnés tels quels (Q11) ; jamais D7
│   ├── architecture.md, note-technique.md, test-report.md   # [R+Y]
│   ├── validation-linguistique.md   # [R] protocole de relecture, codes relecteurs (sans noms)
│   └── demo/                     # [R+Y]
├── data/                         # [R] SOURCE DE VÉRITÉ linguistique (D6 §5)
│   ├── financial-corpus/         # composante A : VOC/ACT/SEC/MSG (+ GUARD protégées)
│   ├── safinum-test-pages/       # composante B : P1–P5, liens corpusRef/templateRefs
│   ├── language-resources/
│   │   ├── README.md             # provenance, licence, procédure d'extraction (Q17)
│   │   ├── citations/            # formes citées du dictionnaire + référence (versionnées)
│   │   └── raw/                  # dictionnaire brut — IGNORÉ PAR GIT
│   ├── schemas/                  # JSON Schema (entrée, lexique, import de relecture)
│   └── exports/                  # GÉNÉRÉ, jamais édité à la main
│       ├── markdown/             # fiches de relecture, rapports doublons/couverture/qualité
│       └── csv/                  # feuilles de relecture (UTF-8 BOM) → réimport contrôlé
├── scripts/                      # [R] Node/TS, exécutables sans Chrome
│   ├── import-sources.*          # import initial D4/D5 (Markdown) → JSON (une seule fois)
│   ├── import-dictionary.*       # extraction D7 → citations (BM3, après téléversement)
│   ├── validate-data.*           # schéma, NFC, jeu de caractères, variables, transitions
│   ├── check-duplicates.*        # doublons stricts / normalisés / potentiels (rapport)
│   ├── export-review.*           # → data/exports/markdown + csv
│   ├── import-review.*           # CSV relu → diff → application contrôlée
│   └── build-lexicon.*           # data/ → src/language/lexicon.json (cibles approuvées seules)
├── src/
│   ├── language/                 # [R] MOTEUR — pur, sans DOM ni chrome.*
│   │   ├── contract.ts           # [R, relecture Y] types et CONTRACT_VERSION du contrat
│   │   ├── index.ts              # createEngine()
│   │   ├── normalizer.ts         # normalisation POUR COMPARAISON uniquement
│   │   ├── matcher.ts            # exact → normalisé → variantes → gabarits ; statuts ; ambiguïtés
│   │   └── lexicon.json          # GÉNÉRÉ par build-lexicon (ne pas éditer)
│   ├── content/                  # [Y]
│   │   ├── index.ts              # point d'entrée, cycle de vie, activation
│   │   ├── engine-provider.ts    # SEUL fichier qui choisit faux / vrai moteur
│   │   ├── fake-engine.ts        # faux moteur ⟦FAKE⟧ (dev/test uniquement, contrat §9)
│   │   ├── scanner.ts            # TreeWalker sur les nœuds texte + calcul du contexte
│   │   ├── observer.ts           # MutationObserver, regroupement, anti-boucle
│   │   ├── renderer.ts           # écriture/restauration Text.data, WeakMap, lang="eto"
│   │   └── diagnostic.ts         # compteurs par statut + surlignage (CSS Custom Highlight API)
│   ├── protection/               # [Y]
│   │   ├── patterns.ts           # motifs protégés, pur et sans DOM — partagé avec le moteur (Q14)
│   │   ├── dom-guard.ts          # input/textarea/select/contenteditable, contexte libellé/valeur
│   │   └── integrity.ts          # empreinte des valeurs protégées avant/après → retour arrière
│   ├── popup/                    # [Y] accessible au clavier et au lecteur d'écran
│   └── shared/                   # [Y] messages storage, logger sans données
├── tests/
│   ├── language/                 # [R] Vitest (Node) : moteur, scripts, données
│   ├── contract/                 # [R+Y] suite de conformité, exécutée sur le faux ET le vrai moteur
│   ├── extension/                # [Y] Vitest + jsdom : scanner, protection, renderer, popup
│   ├── fixtures/                 # [Y] pages locales des 5 étapes (données fictives) ; [R] cas linguistiques
│   └── e2e/                      # [R+Y] Playwright avec l'extension chargée
└── icons/                        # [Y]
```
**Écarts par rapport à D1 et à la v0.3 :**
- Arborescence `data/` et `tests/` alignée sur **D6** (C10).
- Le renderer passe de `src/render/` à `src/content/renderer.ts` (C6). Le moteur reste dans `src/language/` et **n'écrit jamais** dans la page.
- `engine-provider.ts` et `fake-engine.ts` sont ajoutés pour le développement parallèle (D6 §3).
- `tests/contract/` est ajouté : la même suite vérifie le faux et le vrai moteur (R13).
- `integrity.*` est ajouté parce que le critère Sécurité vaut 20 points. `input-guard` est fusionné dans `dom-guard`, et `utils/` est renommé `shared/`.
- `scripts/` + JSON généré évitent deux listes divergentes, comme le recommande D5 §7.3.

### 4.3 Flux d'exécution
```
Chargement page / mutation                                         [extension — Yvan]
   │
   ▼
scanner (TreeWalker, nœuds Text)  ──►  dom-guard : exclure input/textarea/select/
   │                                      contenteditable/script/style/code, nœuds
   │                                      déjà traités, cellules « valeur »
   │  calcule le contexte { role, step, live, pageLang } (aucun contenu de page)
   ▼
═══════════════ INTEGRATION_CONTRACT : engine.translate({ text, sourceLang, targetLang:'eto', context }) ═══════════════
   │                                                                 [moteur — responsable]
   ▼
normalizer (comparaison seulement)
   ▼
matcher ──► texte = uniquement des valeurs protégées         → PROTECTED
        ──► exact / normalisé / variante approuvée / gabarit (segments protégés masqués
            puis RÉINJECTÉS octet par octet)                   → 1 entrée ou plusieurs
        ──► plusieurs entrées non départagées par le contexte  → AMBIGUOUS
        ──► 1 entrée : disposition + statuts (§4.4)            → APPROVED | PENDING_VALIDATION
                                                                  | KNOWN_UNTRANSLATED | PROTECTED
        ──► aucune entrée                                      → NO_MATCH
   │
═══════════════ TranslationResult { status, output (≠ null ⇔ APPROVED), entryId, protectedSegments, … } ═══════════════
   │                                                                 [extension — Yvan]
   ▼
si status ≠ APPROVED → rien n'est écrit ; compteur par statut (en mémoire, sans texte)
si APPROVED → integrity : empreinte des valeurs protégées avant/après ; si écart → retour arrière + alerte
   ▼
renderer : Text.data ← output ; original dans WeakMap ; lang="eto" si l'élément est entièrement traduit
   ▲
observer (MutationObserver childList+characterData+subtree, regroupé par micro-tâche/rAF,
          ignore ses propres écritures, réévalue si l'application réécrit un nœud)

popup ⇄ chrome.storage.local { enabled, displayMode, diagnostic } ⇄ content (storage.onChanged)
Désactivation → restauration exacte de tous les nœuds depuis la WeakMap.
```

### 4.4 Règle d'affichage et statuts renvoyés (v0.4)
Le moteur renvoie `APPROVED` (seul statut affichable) si et seulement si **toutes** ces conditions sont réunies :
- `disposition = TRANSLATABLE` ;
- cible Éton non nulle ;
- `translationStatus = VALIDATED_OBALA` ;
- `validation.financialMeaning = VALIDATED` ;
- variables de la cible identiques à celles de la source ;
- pour les entrées `sensitivity = critical`, double relecture si Q18 est adoptée.

Tous les autres cas donnent l'un des cinq statuts non affichables du contrat (`INTEGRATION_CONTRACT.md` §5.2). `build-lexicon` **retire la cible** de toute entrée non approuvée. Une proposition non approuvée ne peut donc pas atteindre l'extension (invariant I6), même par erreur du moteur.

### 4.5 Schéma d'entrée unifié (v0.4 — résout C3 et C13 ; à valider en S1)
Proposition de structure d'une entrée dans `data/`. Le JSON Schema définitif est livré en BM1, dans `data/schemas/`.
```jsonc
{
  "id": "VOC-008",                       // stable, jamais réutilisé ni renommé
  "kind": "term",                        // term | action | security | message | template | guard
  "category": "…", "subcategory": "…",
  "disposition": "TRANSLATABLE",         // TRANSLATABLE | PROTECTED | OUT_OF_SCOPE
  "sensitivity": "high",                 // critical | high | standard
  "source": {
    "fr": { "text": "Solde disponible", "variants": [], "origin": "D4" },
    "en": null                           // { text, variants, origin, mappingReview } — BM6 (Q15)
  },
  "variables": [],                       // ex. [{ "name": "montant", "type": "amount" }]
  "context": "…", "example": "…",
  "target": {
    "eto": {
      "variety": "obala",
      "text": null,                      // proposition ou forme validée ; jamais exportée si non approuvée
      "variants": [],
      "translationStatus": "TRANSLATION_PENDING",   // statuts D5 (liste reprise à l'identique en BM1)
      "dictionaryEvidence": [],          // [{ form, gloss, ref: "D7 p.…" }] — justification, jamais une traduction
      "validation": {
        "linguistic": "PENDING",         // PENDING | VALIDATED | REJECTED
        "financialMeaning": "PENDING",   // PENDING | VALIDATED | REJECTED
        "reviews": []                    // [{ reviewer: "LOC-01", date, aspect, decision, comment }]
      }
    }
  },
  "links": {
    "corpusRef": null, "pageRefs": [], "templateRefs": [],   // traçabilité A ↔ B, §3.4 et §3.6-1
    "duplicateOf": null, "relatedTo": []                     // sans fusion automatique
  },
  "deprecated": false, "notes": ""
}
```
**Règles :**
- `id` et `source.*.text` sont **immuables**. Une correction de source crée une nouvelle entrée et marque l'ancienne `deprecated`.
- Les textes sont stockés en **NFC**. L'Éton est contrôlé par la liste blanche de caractères (§3.7.4-4).
- `translationStatus` reprend les statuts de D5. `validation` porte les deux axes exigés par D1 (C3). Le moteur combine les trois niveaux pour produire les 6 états du contrat (§4.4). `validate-data` vérifie la cohérence : `translationStatus = VALIDATED_OBALA` ⇔ `validation.linguistic = VALIDATED`.
- Les noms des relecteurs ne figurent jamais dans `data/` : seulement leur code (§3.7.4-6).

### 4.6 Choix techniques proposés
| Sujet | Proposition | Raison |
|---|---|---|
| Langage | **TypeScript** compilé par **esbuild** en un seul script de contenu | Typage du schéma ; les scripts de contenu MV3 ne sont pas des modules ES, donc un bundle est nécessaire |
| Tests unitaires | **Vitest + jsdom** | Rapide, compatible TS |
| Tests E2E | **Playwright** (Chromium, extension chargée via contexte persistant) sur des **fixtures locales** et, si l'accès le permet, sur l'environnement réel | Reproductible hors ligne |
| Permissions | `storage` + `host_permissions` limités à l'origine exacte | Moindre privilège |
| Réseau | Aucun appel ; CSP MV3 par défaut ; aucune dépendance d'exécution tierce | Règles D2/D3 |
| Police | Police libre (licence OFL) embarquée seulement si le rendu des diacritiques l'exige | Lisibilité de l'Éton |
| Moteur et scripts | TypeScript exécuté sous **Node** (Vitest) ; aucune dépendance au navigateur | Bibliothèque et moteur testables **sans Chrome** (D6 §3) |
| Chargement du moteur | Inclus dans le bundle du script de contenu avec `lexicon.json` ; obtenu via `createEngine()` | Aucun réseau ; remplacement du faux moteur en un seul fichier |

---

## 5. Questions ouvertes (à trancher avant ou pendant le développement)

**Bloquantes pour la Synchronisation 1** (en plus de la validation du contrat, du format JSON §4.5 et de l'arborescence §4.2)
- **Q1 — Calendrier** : quelle est la date limite de soumission et de démonstration ? Elle conditionne le découpage de la roadmap.
- **Q2 — Origine exacte de l'environnement de test** : `safinum.cm` est inaccessible depuis mon environnement (échec DNS avec `curl`, `ERR_BLOCKED_BY_CLIENT` dans le navigateur). Je ne peux donc pas vérifier moi-même l'origine. Quelle est l'URL de « Ouvrir l'environnement de test » (domaine, sous-domaine, chemin) ? Y a-t-il des redirections ou des iframes vers une autre origine ? Les 5 étapes sont-elles sur une seule URL (SPA) ou sur plusieurs ? Peux-tu enregistrer le HTML de chaque étape (Ctrl+S, avec des données fictives) pour construire des fixtures de test ?
- **Q3 — Mode d'affichage** — ✅ **Tranchée (2026-11-12) : option (a).** L'Éton remplace le français, et le français reste accessible au survol ou au focus. Le popup propose une bascule vers le mode bilingue (b).
- **Q4 — Stack** — ✅ **Tranchée (2026-11-12) : TypeScript + esbuild** (un seul bundle), tests **Vitest** (unitaires) et **Playwright** (e2e).
- **Q5 — Source de vérité linguistique** — ✅ **Tranchée (2026-11-12) : JSON dans `data/`.** Les Markdown et CSV de relecture destinés aux locutrices sont **générés** à partir de ce JSON et ne sont jamais édités à la main. Les documents Markdown D4 et D5 ne servent qu'à l'import initial. *(Confirmée par D6 §5 ; exports dans `data/exports/`.)*
- **Q14 — Propriété des motifs protégés (C8)** : qui définit les motifs (montant, devise, téléphone, numéro de compte, référence, date, marque) utilisés **à la fois** par le moteur et par l'extension ? **Recommandation :** un module pur et sans DOM, `src/protection/patterns.ts`, propriété d'Yvan, injecté dans le moteur (`createEngine({ detectProtected })`), avec une suite de tests commune tirée de D5 §4. Le contrat (§8) en dépend.
- **Q16 — Langue source `'auto'`** : l'extension peut-elle envoyer `sourceLang: 'auto'` quand elle ne connaît pas la langue d'un texte (ex. message anglais injecté par le jury dans la page française) ? **Recommandation : oui**, avec la règle de départage du contrat §5.3 (`AMBIGUOUS` en cas de conflit). Cela modifie le type `TranslationRequest`.
- **Q19 — Organisation Git** :
  - adopte-t-on une branche `develop` (D6 §6) ? **Recommandation : non** pour un projet de ~2 semaines : branches courtes vers `main` via PR ;
  - quel est le compte GitHub d'Yvan, pour la relecture obligatoire des PR `contract:` (fichier `CODEOWNERS`) ?
  - qui crée les fichiers partagés (`package.json`, `tsconfig.json`, `build.mjs`, `.gitignore`) ? **Recommandation : Yvan en P1.1**, puis toute modification par PR.

**Importantes, peuvent être tranchées en phase 2–4**
- **Q6 — Barème de référence** : D2 ou D3 (conflit C1) ? Il faut peut-être confirmer auprès des organisateurs.
- **Q7 — Paragraphes multi-phrases** (ex. P2-002, P3-003) : si une seule phrase est validée, traduit-on partiellement (texte mixte FR/Éton) ou laisse-t-on tout en français ? **Recommandation : tout ou rien par nœud texte.**
- **Q8 — `select`/`option`, `placeholder` et attributs d'accessibilité** : P3-007 « Paiement de services » est probablement une option de liste. Par défaut, on ne touche à rien. Faut-il traduire :
  - les **libellés** d'options (`option.text` uniquement, jamais `value`) ?
  - les attributs `placeholder`, `aria-label`, `title` et `alt` lorsqu'ils correspondent à une entrée validée (§3.6-4) ?

  **Recommandation : oui pour `aria-label` et `title`**, afin que le lecteur d'écran lise la même chose que l'écran. Les options et le `placeholder` peuvent attendre une phase ultérieure.
- **Q9 — Statuts intermédiaires** : pour la démo, une entrée `REVIEW_PENDING` peut-elle s'afficher avec un marqueur « à valider » ? **Recommandation : non.** *(v0.4 : le contrat proposé encode déjà « non » : `output` est `null` pour `PENDING_VALIDATION`, conformément à D6 §9. À confirmer en S1.)*
- **Q10 — Nommage (conflit C2)** — ✅ **Tranchée par D6 (2026-11-12) : FinEthnic = le projet, SAFINUM Éton = son premier prototype.** « EtonFin » (D5) est remplacé lors de l'import.
- **Q11 — Versionner D2–D5** dans `docs/sources/` ? Le dépôt est actuellement **privé**. Si on le rend public pour la soumission, la licence du dictionnaire permet-elle d'y publier des formes lexicales ?
- **Q12 — Calendrier linguistique** : combien de locutrices d'Obala sont disponibles, et à quel rythme ? Cela fixe le nombre réaliste de libellés validés pour la démo. **Priorité suggérée : les ~53 libellés uniques des 5 pages (62 occurrences), puis les actions critiques et les alertes SEC.**
- **Q13 — Public qui ne lit pas l'Éton (§3.6-5)** : les locutrices peuvent-elles enregistrer l'audio des phrases critiques en même temps que leur validation ? Si oui, l'option « écouter » pourra être ajoutée **après** le MVP, avec des fichiers locaux et sans service distant. Ce n'est pas bloquant pour P1–P7.

**Nouvelles questions v0.4 (D6), non bloquantes pour S1**
- **Q15 — Ampleur des sources anglaises (C9)** : D6 exige des sources EN, mais aucune n'existe et SAFINUM est en français. Que couvre-t-on pour la démo : (a) seulement le schéma et le moteur prêts pour EN, avec quelques entrées de test ; (b) les ~53 libellés des pages et les messages SEC critiques en EN ; (c) tout le corpus ? Qui relit la correspondance FR↔EN (sens financier) ? **Recommandation : (b)**, relu par le responsable du projet. Phase BM6.
- **Q17 — Dictionnaire (D7)** : sous quel format sera-t-il téléversé (PDF texte, PDF scanné, Word, tableur, saisie manuelle) ? Quelle licence s'applique ? Confirmes-tu qu'il reste **hors de Git** et que seules les formes citées, avec leur référence, sont versionnées (§3.7.4-3) ? Bloque **seulement BM3**.
- **Q18 — Double relecture des entrées critiques** : exige-t-on **deux** relectures indépendantes (deux locutrices, ou une locutrice + validation du sens financier par une autre personne) pour les entrées `sensitivity = critical` (SEC, montants, confirmation de transfert) avant `APPROVED` ? **Recommandation : oui**, avec une dérogation **tracée** dans `reviews[]` si une seule locutrice est disponible.
