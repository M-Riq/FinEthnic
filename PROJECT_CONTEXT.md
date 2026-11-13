# PROJECT_CONTEXT — SAFINUM Éton (dépôt FinEthnic)

> **Statut :** Phase 0 — cadrage, en attente de la **Synchronisation 1** (TEAM_WORKFLOW §7). Q2, Q3, Q4, Q5, Q9, Q10, Q14, Q16, Q19 et Q22 sont tranchées. Q1 (date limite) attend la confirmation des organisateurs et **ne bloque plus S1** (plan court prévu, ROADMAP §0.1.1).
> **Version :** 0.8 — 2026-11-13 (v0.7 + **affichage des traductions non vérifiées**, avec un marqueur, §3.11 ; Q9 tranchée ; contrat 0.2.0 ; nouvelle question Q24)
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
| D7 | *Dictionnaire éton–français* (Van de Velde & Essele Essele, CLÉ 2022) | **Première ressource de traduction** (cascade §3.10). Selon le responsable, il contient surtout des mots simples, ainsi que des règles de formation des phrases. | **Reçu le 2026-11-13** : lexique Markdown (3 371 entrées, avec la page du livre, et une section de grammaire), extrait automatiquement du PDF puis converti depuis Excel. Licence CC BY-NC-SA 4.0. Gardé hors Git (Q17 ✅, `data/language-resources/README.md`). |
| D8 | `docs/sources/corpus_fusionne_SAFINUM_Eton.md` (versionné le 2026-11-13, empreinte dans `docs/sources/README.md`) | Composantes A + B fusionnées — **source de l'import BM2** | Fusion de D4 et des textes de pages de D5 : 315 entrées (VOC 100, ACT 60, SEC 60, MSG 78, PAG 17) et 60 textes de pages tracés. Ajoute des synonymes et des définitions en français simple. **0 traduction.** Vérifications et écarts avec D5 : §3.9. |

> **D8 est versionné** dans `docs/sources/` (2026-11-13) et remplace D4 et D5 pour l'import. D2, D3 et D5 ne sont pas encore versionnés (Q11, Q21). D7 ne doit **pas** être versionné (§3.7.4-3).

---

## 2. Reformulation du projet

### 2.1 Problème
Les services financiers numériques camerounais sont présentés en français ou en anglais. Les personnes qui maîtrisent mal ces langues comprennent mal les soldes, les frais, les confirmations et les alertes de sécurité. Cette incompréhension crée un risque d'exclusion et un risque de fraude ou d'erreur.

### 2.2 Solution envisagée
Une **couche linguistique indépendante** affiche en **Éton (variété d'Obala)** les libellés d'une interface financière existante, sans modifier le code de cette interface. Pour la présélection, cette couche prend la forme d'une **extension Chrome MV3** testée sur l'environnement commun « SAFINUM Pay » : `https://safinum.cm/hackathon-test`, une **application monopage** (Q2).

### 2.3 Les trois composantes (TEAM_WORKFLOW §1) et leurs responsables

| Composante | Contenu | Responsable | Dossiers | État actuel |
|---|---|---|---|---|
| **1. Bibliothèque linguistique financière** | **A** : corpus général (VOC/ACT/SEC/MSG). **B** : référentiel des 5 pages (P1–P5). Entrées protégées (`GUARD`). Ressources lexicales (dictionnaire). | Responsable du projet | `data/`, `scripts/` | A : 300 entrées FR ; B : 62 libellés FR ; **0 EN ; 0 Éton validé** |
| **2. Moteur local de correspondance et de traduction** | Normalisation, correspondance, statuts, ambiguïtés, lexique d'exécution. Pur, sans DOM. | Responsable du projet | `src/language/`, `tests/language/` | À développer |
| **3. Extension Chrome** | Popup, scanner, MutationObserver, protection DOM, intégrité, remplacement et restauration | Yvan | `src/content/`, `src/popup/`, `src/protection/`, `tests/extension/` | À développer |
| *Interface 2 ⇄ 3* | `INTEGRATION_CONTRACT.md` | Responsable (revue obligatoire d'Yvan) | `src/language/contract.ts`, `tests/contract/` | Proposition v0.2.0-draft |

Les sous-composantes **A** et **B** gardent leur nom dans le reste du document (traçabilité A ↔ B).

**Principe :** l'extension ne contient aucune connaissance linguistique propre (D6 §4). Elle n'affiche que ce que le moteur déclare `APPROVED`. *(v0.8, Q9 : elle affiche aussi `unverifiedOutput` (`PENDING_VALIDATION`), avec un marqueur, si l'option du popup est active, §3.11.)*

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
- Date limite de soumission : **à confirmer par les organisateurs** (Q1). Une date au **14/11/2026** a été évoquée, sans confirmation. Si elle est confirmée, le plan court de la ROADMAP (§0.1.1) s'applique.

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

1. **Libellés de page ↔ gabarits du corpus.** Le corpus modélise souvent « libellé : {valeur} » en **une seule chaîne**, alors que la page affiche probablement le libellé et la valeur dans **deux nœuds séparés** (à confirmer avec Q20). Correspondances concernées :

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
6. **Q2, nouvel essai le 12/11/2026** : `safinum.cm` et `www.safinum.cm` ne sont toujours pas résolus (DNS) depuis mon environnement. L'origine exacte reste à confirmer de ton côté. *(v0.5 : URL confirmée, voir §3.8. Nouvel essai sur `https://safinum.cm/hackathon-test` : le domaine n'est toujours pas résolu depuis l'environnement de Copilot. Les tests sur l'environnement réel se font donc sur les postes de l'équipe.)*

### 3.7 Analyse de `TEAM_WORKFLOW.md` (D6) — v0.4

#### 3.7.1 Ce que D6 confirme ou tranche
- **Confirme** les principes v0.3 : liste blanche, aucune traduction non approuvée affichée, valeurs financières intactes, aucun appel réseau, JSON comme source de vérité (Q5). *(v0.8 : l'affichage des traductions non vérifiées est assoupli par Q9, avec un marqueur, §3.11.)*
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
| C7 | Le principe 4 de la v0.3 (« le lexique ne contient que les entrées affichables ») empêche de distinguer `KNOWN_UNTRANSLATED`, `PENDING_VALIDATION` et `NO_MATCH`. | Le lexique contient toutes les sources connues (FR/EN), leur statut et leurs variables. Il contient la **cible seulement si elle est approuvée** (invariant I6). Une proposition non approuvée **ne quitte jamais** `data/`. *(v0.8, Q9 : il contient aussi la traduction non vérifiée retenue, marquée « en attente », dans un champ séparé, `unverifiedTarget`, §3.11.)* |
| C8 | Les motifs protégés (montants, téléphones, références) servent à la fois au moteur (gabarits) et à l'extension (intégrité). Risque de deux implémentations divergentes (R14). | **Q14** ✅ : un module pur unique (`src/protection/patterns.ts`, Yvan), injecté dans le moteur. |
| C9 | D6 exige des sources FR et EN, mais **aucune entrée EN** n'existe, et SAFINUM est en français. | Le schéma prévoit `source.en` dès BM1. La saisie EN est la phase BM6, d'ampleur à fixer (**Q15**). Mode `'auto'` retenu (**Q16** ✅). |
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

   D5 §6.6 prévoyait que les locutrices **proposent** d'abord et que le dictionnaire sert de **comparaison**. *(Révisé en v0.7 : le dictionnaire propose d'abord, par la cascade §3.10. Les locutrices valident ou corrigent, et elles proposent elles-mêmes seulement quand la cascade échoue.)*
2. **Rôle du dictionnaire** *(révisé en v0.7, décision Q22 du 2026-11-13)*. C'est la **première ressource de traduction**. Pendant la préparation de la bibliothèque, il alimente la **cascade** du §3.10 : terme → synonymes simples → définition simple, puis assemblage selon les règles de formation des phrases. Le résultat est une **proposition**, jamais une traduction approuvée. *(v0.8, Q9 : elle est affichée sur la page de test avec un marqueur « non vérifiée », en attendant la validation d'une locutrice, §3.11.)* Le dictionnaire n'est **jamais** chargé dans l'extension ni utilisé pendant la navigation.
3. **Droit d'auteur (Q17, ✅ tranchée le 2026-11-13).** Le dictionnaire est une œuvre publiée (Van de Velde & Essele Essele, CLÉ 2022), sous licence **CC BY-NC-SA 4.0** : citer les auteurs, pas d'usage commercial, même licence pour ce qui en dérive. Décision du responsable :
   - le fichier brut reste **hors Git**, dans `data/language-resources/raw/` (ignoré par `.gitignore`) ;
   - seules les formes **citées** sont versionnées, avec leur référence (page de D7), comme justification ;
   - aucun import massif dans le dépôt ;
   - les auteurs et la licence sont mentionnés dans `THIRD_PARTY.md` et `data/language-resources/README.md`. Les fichiers qui contiennent des formes de D7 sont diffusés sous CC BY-NC-SA 4.0.
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

### 3.8 Réponses du 12/11/2026 et conséquences (v0.5)

1. **Q2 — Environnement de test.** L'URL est `https://safinum.cm/hackathon-test`. C'est une **application monopage** (SPA) : l'URL ne change pas entre les 5 étapes (1. Solde et tableau de bord, 2. Frais de transfert, 3. Bénéficiaire, 4. Récapitulatif, 5. Confirmation). Les textes des 5 étapes sont ceux de D5 (P1–P5). Conséquences :
   - **Manifest** : `content_scripts.matches: ["https://safinum.cm/hackathon-test*"]`, aucune autre origine. Aucune `host_permissions` supplémentaire n'est nécessaire, car l'extension n'émet aucune requête réseau. L'URL doit être ouverte **directement** : si la SPA était chargée depuis une autre adresse puis routée côté client, le script de contenu ne serait pas injecté.
   - **Changement d'étape = mutation du DOM**, sans rechargement ni changement d'URL. Le `MutationObserver` est donc le **seul** signal de changement d'étape. Le premier scan doit aussi tolérer un rendu tardif, après `document_idle`.
   - **`context.step`** ne peut pas être déduit de l'URL. L'extension peut le déduire d'un repère visible, comme le titre de l'étape. Sinon, elle l'omet. Le moteur ne l'utilise que pour départager des candidats (contrat §6).
   - **Restauration** : l'état (activation, textes originaux en `WeakMap`) dure tant que la page n'est pas rechargée. Les nœuds retirés par la SPA sont libérés automatiquement par la `WeakMap`. L'effet d'un rechargement (retour à l'étape 1 ?) est à vérifier (Q20).
   - **Fixtures** : elles sont reconstruites à partir des textes de D5, avec des données fictives (P2). Leur **structure DOM** (balises, paires libellé/valeur) reste une hypothèse tant que la page réelle n'a pas été inspectée (Q20).
2. **Accès depuis l'environnement de Copilot** : toujours impossible (échec DNS). L'équipe fait elle-même les vérifications sur l'environnement réel (Q20, P6, S4), sur ses propres postes.
3. **Q14, Q16 et Q19 sont acceptées** telles que recommandées. Voir §5 et le contrat (§3, §5.3, §6, §8, §10). Le compte GitHub d'Yvan est **`@ivan-14-dev`**. Il n'est pas encore collaborateur du dépôt privé : il faut l'**inviter avec les droits d'écriture**, faute de quoi il ne peut ni relire la PR #1 ni figurer dans `CODEOWNERS`.
4. **Q1** : la date limite est à confirmer par les organisateurs. Le 14/11/2026 a été évoqué. Si cette date est confirmée, il reste environ deux jours : le plan court s'applique (ROADMAP §0.1.1). S1 ne doit pas attendre la réponse des organisateurs (D6 §7 : pas de blocage inutile).

### 3.9 Corpus fusionné D8 (2026-11-13, v0.6)

Le responsable a fourni `corpus_fusionne_SAFINUM_Eton.md` (D8), qui fusionne D4 et les textes de pages de D5. Il est versionné **tel quel** dans `docs/sources/`. **D8 remplace D4 et D5 comme source de l'import (BM2).**

**Vérification automatique** : les chiffres du résumé de D8 sont confirmés.
- **315 entrées**, toutes avec un ID unique et 9 colonnes : VOC 100, ACT 60, SEC 60, MSG 78, PAG 17. MSG-025 et MSG-056 ont disparu : ce sont les deux doublons stricts du §3.3, fusionnés dans VOC-078 et ACT-055.
- **Origine des entrées** : 265 viennent seulement du corpus, 33 du corpus et des pages, 17 des pages.
- **60 textes de pages** (P1 : 15, P2 : 13, P3 : 10, P4 : 12, P5 : 10), soit **52 textes uniques**. Parmi eux :
  - **19** sont identiques à une entrée du corpus (même liste qu'au §3.4) ;
  - **16** sont rattachés au corpus **par le sens seulement**. Exemples : « Succès » → VOC-055 « Réussi », « Confirmer le transfert » → ACT-016 « Confirmer », « Votre compte » → VOC-001 « Compte » ;
  - **17** sont nouveaux et ont été ajoutés (PAG-001 à PAG-017).
- La **sensibilité** des 60 ACT figure dans la colonne « Remarque » : 22 « Critique », 19 « Élevée », 19 « Standard ». Les variables `{…}` sont signalées et restent identiques dans les reformulations.
- La section « Ajouts depuis les pages » répète les 17 entrées PAG. C'est une **vue** : il ne faut pas les importer deux fois.

**Écarts avec D5** (à trancher, voir Q21)
- **Numérotation** : D8 écrit `P1-1`, D5 écrivait `P1-001`, et les numéros ne coïncident pas. Exemple : « Total à débiter » est P2-009 dans D5 et P2-10 dans D8. Avant la v0.6, les numéros de pages cités dans ce document sont ceux de D5.
- **Nombre de textes** : D5 comptait 62 occurrences (53 libellés uniques), D8 en compte 60 (52 uniques). Trois éléments de D5 n'apparaissent pas dans D8 :
  - « Bonjour, Amina », remplacé par « Bonjour » ;
  - la phrase de sécurité P1-015 ;
  - la mention « Safinum Pay » (P1-017).
- **Contenu non repris** : D8 ne contient pas les statuts, la fiche ni la procédure de validation, les 4 formes attestées, ni les exemples de valeurs protégées (D5 §4). Le contrat s'y réfère pourtant (§5, §8).

**Conséquences pour BM2 et le moteur** (proposition, à valider en S1)
1. **Un rattachement par le sens n'implique pas la même traduction.** Le moteur compare des textes, pas des sens : « Votre compte » ne trouvera jamais « Compte ». Chaque texte de page devient donc une **entrée de page** qui garde son texte exact. Son lien vers le corpus (`corpusRef`) est typé :
   - `exact` : la traduction est partagée ;
   - `meaning` : la traduction est **distincte** et doit être validée séparément.

   Cela respecte le §3.2 : aucune fusion n'est automatique.
2. **Les synonymes et définitions simples servent à _fabriquer_ la traduction, pas à _reconnaître_ le texte de la page.** *(Corrigé en v0.7 sur précision du responsable.)*
   - **Fabrication** (préparation de la bibliothèque) : ils sont les niveaux 2 et 3 de la **cascade de traduction** (§3.10). Ils figurent aussi sur les fiches des locutrices.
   - **Reconnaissance** (moteur, pendant la navigation) : ils ne sont **jamais** des clés de recherche. 12 synonymes sont en effet le terme d'une autre entrée. Exemple : « montant » est un synonyme de VOC-024 « Somme », mais aussi le terme de VOC-023. S'en servir pour reconnaître le texte créerait de fausses correspondances.
3. **Les ID de D8 sont repris tels quels**, y compris le format `P1-1`, pour garder la traçabilité avec le fichier du responsable.

### 3.10 Méthode de traduction en cascade (précision du responsable, 2026-11-13, v0.7)

**Pourquoi.** Le dictionnaire éton–français (D7) contient surtout des **mots simples**. Les termes financiers « poussés » (ex. « Transaction ») n'y figurent souvent pas. C'est pourquoi D8 donne, pour chaque entrée :
- des **synonymes simples** (pour les phrases : une **reformulation simple**) ;
- une **définition simple**, écrite avec des mots courants qu'on peut retrouver dans le dictionnaire.

**La cascade.** Pour chaque entrée, on essaie dans l'ordre et on s'arrête au premier niveau qui réussit :

| Niveau | Texte français utilisé | Réussit si… | `method` |
|---|---|---|---|
| 1 | Le **terme** (ou la phrase) lui-même | Il figure dans D7, ou tous ses mots y figurent et sa structure est couverte par les règles | `direct` |
| 2 | Les **synonymes simples** (pour les phrases : la reformulation simple), dans l'ordre de D8 | Même condition, pour au moins un synonyme. Tous ceux qui réussissent sont proposés, le premier en tête | `synonym` |
| 3 | La **définition simple** | Tous ses mots figurent dans D7 et sa structure est couverte par les règles | `definition` |
| 4 | — (échec) | — | aucune proposition |

En cas d'échec (niveau 4), l'entrée garde le statut `TRANSLATION_PENDING`. Le rapport liste les **mots manquants**, et l'entrée est confiée aux locutrices, qui partent du terme, des synonymes et de la définition.

**Assemblage (niveaux 1 à 3, textes de plusieurs mots).** Le script :
1. découpe le texte français en mots ;
2. cherche chaque mot porteur de sens dans D7 ;
3. combine les formes éton trouvées selon les **règles de formation des phrases** de D7 (ordre des mots, accords, etc.). Ces règles sont transcrites une par une, avec leur référence (Q23).

Les variables `{montant}`, `{devise}`… et les jetons protégés sont recopiés **à l'identique**.

**Règles de sécurité (décision Q22)**
1. La cascade tourne **pendant la préparation de la bibliothèque** (`scripts/propose-translations.*`, BM3), **jamais dans Chrome**. Elle-même ne change pas le contrat d'intégration. *(v0.8 : l'affichage de son résultat, décidé par Q9, le change : contrat 0.2.0, §3.11.)*
2. Son résultat est une **proposition** (`target.eto.proposals[]`, §4.5), avec sa traçabilité :
   - le niveau utilisé (`method`) ;
   - le synonyme utilisé ;
   - les formes et pages de D7 (`dictionaryEvidence`) ;
   - les règles appliquées ;
   - les mots non trouvés.

   L'entrée passe en `REVIEW_PENDING`. Le moteur renvoie donc `PENDING_VALIDATION`. *(v0.8, Q9 : la première proposition est alors affichée avec un marqueur « non vérifiée », §3.11.)*
3. Une **locutrice** accepte, corrige ou rejette la proposition (fiche L1/L2, avec la méthode indiquée). Seule son acceptation permet le statut `VALIDATED_OBALA` et l'affichage **sans marqueur** (`APPROVED`). Un rejet retire la proposition de l'affichage (contrat I6).
4. Le script **n'invente aucune forme** : il n'utilise que des formes de D7 et des règles transcrites avec leur référence. Copilot écrit le code, jamais de l'Éton.

**Limites connues**
- Un assemblage mot à mot peut être **agrammatical** : tons, classes nominales, accords (R20). La validation par une locutrice reste donc indispensable pour retirer le marqueur « non vérifiée » (§3.11).
- Une traduction issue d'une **définition** est plus longue que le terme. Sur un bouton court (« Confirmer »), elle peut déborder ou alourdir l'écran (R21). La locutrice peut la raccourcir ; P6 vérifie la mise en page.
- Un mot de D7 peut avoir **plusieurs sens**. Toutes les formes candidates sont listées dans `dictionaryEvidence`, et la locutrice choisit.
- **Pas de lemmatisation** (BM3, provisoire) : un mot conjugué ou accordé (« envoie », « pris ») n'est pas retrouvé par sa forme de base (« envoyer », « prendre »). Il apparaît dans les mots manquants du rapport. Une table des formes françaises pourra être ajoutée quand D7 sera connu.
- Les **textes de pages** n'ont ni synonymes ni définition propres : seul le niveau 1 est possible. Un texte identique à une entrée du corpus (`corpusRef` `exact`) partage sa traduction et n'est pas traité séparément. Un texte lié seulement par le sens (16 textes, ex. « Confirmer le transfert ») n'emprunte pas les synonymes de l'entrée liée, car le texte diffère.
- Tant que D7 n'est pas téléversé, la cascade est développée et testée avec un **mini-dictionnaire de test** dont les formes sont visiblement fictives (`⟦TEST⟧`), jamais présentées comme de l'Éton.

### 3.11 Affichage des traductions non vérifiées (décision Q9 du responsable, 2026-11-13, v0.8)

**Décision.** Les locutrices (`LOC-01`, `LOC-02`…) ne sont pas toujours disponibles. Le responsable a donc décidé de **ne pas attendre leur validation** pour afficher les traductions sur la page de test. Dès que la cascade (§3.10) produit une traduction, l'extension peut l'afficher. Les locutrices vérifient ensuite, en parallèle : leurs corrections sont reportées dans `data/` et améliorent la bibliothèque.

**Garde-fous (validés par le responsable le 2026-11-13)**
1. **Un champ à part.** La traduction garde le statut `PENDING_VALIDATION` et sort dans `unverifiedOutput`. `output` reste réservé aux traductions approuvées (contrat 0.2.0, §4 et §5.4).
2. **Un marqueur visible** sur la page, et le **français au survol** et au focus.
3. **Une option du popup** pour montrer ou cacher ces traductions, activée par défaut.
4. Les montants, noms, numéros et références ne sont **jamais** modifiés (I5, inchangé).
5. Une traduction validée par une locutrice devient `APPROVED` et perd le marqueur. Une traduction rejetée n'est plus affichée.

**Ce qui ne change pas**
- Le script de cascade n'écrit toujours ni `target.eto.text` ni `VALIDATED_OBALA` (§3.10). Seule une locutrice valide.
- Copilot n'écrit jamais d'Éton. Tant que D7 n'est pas téléversé, il n'y a **aucune traduction réelle** à afficher : seulement des marqueurs de test.
- **Le sens.** La cascade assemble des mots de D7 selon les règles transcrites (Q23). L'assemblage peut être maladroit ou faux (R20), ou affaiblir une alerte (§2.4). L'affichage sur la page de test sert justement à repérer ces erreurs avant la correction par une locutrice (R22).

**Portée.** Environnement de test uniquement (`https://safinum.cm/hackathon-test`, données fictives). À réexaminer avant tout usage réel (Q24).

---

## 4. Architecture proposée

### 4.1 Principes
1. **Liste blanche** : seul un texte qui correspond à une entrée ou à un gabarit **validé** peut être modifié. *(v0.8, Q9 : ou à une entrée dont la traduction non vérifiée est affichée avec un marqueur, §3.11.)* Tout le reste est intact par construction.
2. **Défense en profondeur** : liste blanche, puis contexte DOM, puis motifs de données protégées, puis contrôle d'intégrité avant et après chaque modification.
3. **Modification minimale** : on remplace seulement `Text.data`, sans `innerHTML`, sans création ni suppression de nœuds et sans attribut fonctionnel. L'original est mémorisé dans une `WeakMap` pour une restauration exacte.
4. **Séparation données / moteur / extension** : la bibliothèque (`data/`) est compilée en un **lexique d'exécution** (`lexicon.json`). Il contient toutes les sources connues (FR/EN) avec leur statut, mais une cible Éton (`target`) **seulement si elle est approuvée**. La traduction non vérifiée d'une entrée en attente est rangée à part, dans `unverifiedTarget` (C7, Q9, contrat I6). Le moteur pur l'interroge. L'extension ne consomme que le résultat du moteur, via `INTEGRATION_CONTRACT.md`.
5. **Moindre privilège** : permission `storage` seulement. Le script de contenu est limité à `https://safinum.cm/hackathon-test*` (Q2). Pas de `host_permissions` supplémentaire, pas de service worker sauf besoin avéré.
6. **Développement parallèle** : l'extension est développée et testée avec un **faux moteur** conforme au contrat. La bibliothèque et le moteur sont développés et testés **sans Chrome** (Node + Vitest). Le remplacement du faux moteur par le vrai ne touche qu'**un seul fichier** (`src/content/engine-provider.ts`).

### 4.2 Arborescence cible (v0.4, alignée sur D6 — à valider en S1)
Responsables : **[R]** responsable du projet, **[Y]** Yvan, **[R+Y]** copropriété (toute modification passe par une PR relue par l'autre membre).
```text
FinEthnic/
├── manifest.json                 # [Y] MV3 production : script de contenu sur https://safinum.cm/hackathon-test* uniquement (Q2)
├── manifest.dev.json             # [Y] MV3 développement : + localhost pour les fixtures
├── build.mjs                     # [R+Y] esbuild → dist/ ; échoue si le faux moteur est dans le build de prod
├── package.json, tsconfig.json   # [R+Y] créés une seule fois en P1.1 par Yvan (Q19), modifiés ensuite par PR
├── .gitignore                    # [R+Y] exclut dist/, node_modules/, data/language-resources/raw/
├── .github/CODEOWNERS            # [R+Y] créé en P1.1 (Q19) : @M-Riq pour [R], @ivan-14-dev pour [Y], les deux pour [R+Y]
├── README.md                     # [Y] installation de l'extension ; [R] section bibliothèque et moteur
├── PROJECT_CONTEXT.md, ROADMAP.md, TEAM_WORKFLOW.md   # [R]
├── INTEGRATION_CONTRACT.md       # [R] rédige, [Y] relit obligatoirement (procédure contrat §10)
├── THIRD_PARTY.md                # [R+Y] dépendances, outils et sources (exigence D2/D3, dictionnaire cité)
├── docs/
│   ├── sources/                  # [R] sources versionnées telles quelles + README (empreintes) : D8 (2026-11-13) ; D2, D3, D5 selon Q11/Q21 ; jamais D7
│   ├── architecture.md, note-technique.md, test-report.md   # [R+Y]
│   ├── validation-linguistique.md   # [R] protocole de relecture, codes relecteurs (sans noms)
│   └── demo/                     # [R+Y]
├── data/                         # [R] SOURCE DE VÉRITÉ linguistique (D6 §5)
│   ├── financial-corpus/         # composante A : VOC/ACT/SEC/MSG (+ GUARD protégées)
│   ├── safinum-test-pages/       # composante B : P1–P5, liens corpusRef/templateRefs
│   ├── language-resources/
│   │   ├── README.md             # provenance, licence, procédure d'extraction (Q17)
│   │   ├── citations/            # formes citées du dictionnaire + référence (versionnées)
│   │   ├── grammar-rules.json    # règles de formation des phrases transcrites de D7, chacune avec sa référence (§3.10, Q23)
│   │   └── raw/                  # dictionnaire brut — IGNORÉ PAR GIT
│   ├── schemas/                  # JSON Schema (entrée, lexique, import de relecture)
│   └── exports/                  # GÉNÉRÉ, jamais édité à la main
│       ├── markdown/             # fiches de relecture, rapports doublons/couverture/qualité
│       └── csv/                  # feuilles de relecture (UTF-8 BOM) → réimport contrôlé
├── scripts/                      # [R] Node/TS, exécutables sans Chrome
│   ├── import-sources.*          # import initial D8 (Markdown) → JSON (une seule fois, §3.9)
│   ├── import-dictionary.*       # extraction D7 → citations (BM3, après téléversement)
│   ├── propose-translations.*    # cascade terme → synonymes → définition (§3.10) → proposals[] ; jamais de statut validé
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
═══ TranslationResult { status, output (≠ null ⇔ APPROVED), unverifiedOutput (≠ null ⇔ PENDING_VALIDATION), entryId, protectedSegments, … } ═══
   │                                                                 [extension — Yvan]
   ▼
si APPROVED, ou PENDING_VALIDATION avec l'option « non vérifiées » active (Q9) → integrity : empreinte des valeurs
   protégées avant/après ; si écart → retour arrière + alerte
sinon → rien n'est écrit ; compteur par statut (en mémoire, sans texte)
   ▼
renderer : Text.data ← output (ou unverifiedOutput + marqueur, §3.11) ; original dans WeakMap ;
   lang="eto" si l'élément est entièrement traduit
   ▲
observer (MutationObserver childList+characterData+subtree, regroupé par micro-tâche/rAF,
          ignore ses propres écritures, réévalue si l'application réécrit un nœud)

popup ⇄ chrome.storage.local { enabled, displayMode, diagnostic, showUnverified } ⇄ content (storage.onChanged)
Désactivation → restauration exacte de tous les nœuds depuis la WeakMap.
```

### 4.4 Règle d'affichage et statuts renvoyés (v0.4)
Le moteur renvoie `APPROVED` (seul statut affiché **sans marqueur**) si et seulement si **toutes** ces conditions sont réunies :
- `disposition = TRANSLATABLE` ;
- cible Éton non nulle ;
- `translationStatus = VALIDATED_OBALA` ;
- `validation.financialMeaning = VALIDATED` ;
- variables de la cible identiques à celles de la source ;
- pour les entrées `sensitivity = critical`, double relecture si Q18 est adoptée.

Tous les autres cas donnent l'un des cinq autres statuts du contrat (`INTEGRATION_CONTRACT.md` §5.2). *(v0.8, Q9.)* Parmi eux, seul `PENDING_VALIDATION` porte un texte : la traduction non vérifiée retenue, dans `unverifiedOutput`, affichée avec un marqueur (§3.11). `build-lexicon` range cette traduction dans un champ séparé du lexique, `unverifiedTarget`. Le champ `target`, seul lu pour remplir `output`, est réservé aux entrées approuvées : le schéma du lexique refuse une traduction non vérifiée dans `target`. Les autres entrées n'ont aucune cible, et une cible rejetée n'est jamais gardée (invariant I6). Une traduction non vérifiée ne sort donc dans `output` que si le moteur lit le mauvais champ ; T-CON-02 et T-LIB-10 le vérifient.

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
    "fr": {
      "text": "Solde disponible", "variants": [], "origin": "D8",   // variants = formes reconnues sur la page
      "simple": { "synonyms": ["…"], "definition": "…" }          // D8 : niveaux 2 et 3 de la cascade (§3.10), jamais des clés de recherche
    },
    "en": null                           // { text, variants, origin, mappingReview } — BM6 (Q15)
  },
  "variables": [],                       // ex. [{ "name": "montant", "type": "amount" }]
  "context": "…", "example": "…",
  "target": {
    "eto": {
      "variety": "obala",
      "text": null,                      // proposition d'une locutrice ou forme validée ; exportée comme « non vérifiée » tant qu'elle n'est pas approuvée (Q9)
      "variants": [],
      "translationStatus": "TRANSLATION_PENDING",   // statuts D5 (liste reprise à l'identique en BM1)
      "dictionaryEvidence": [],          // [{ form, gloss, ref: "D7 p.…" }] — justification, jamais une traduction
      "proposals": [],                   // cascade §3.10 : [{ text, method: "direct"|"synonym"|"definition", from, rules, missing, generatedBy }] — la première est affichée comme « non vérifiée » si text est vide (Q9)
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
- `build-lexicon` exporte **une seule cible** par entrée : `text` s'il est approuvé, dans `target` ; sinon la traduction non vérifiée retenue (`text`, ou à défaut la première proposition), dans `unverifiedTarget` ; jamais une cible rejetée (contrat §5.2, Q9). Le reste de `proposals[]` n'est **jamais** exporté. `propose-translations` n'écrit jamais `text` ni `VALIDATED_OBALA` (§3.10).

### 4.6 Choix techniques proposés
| Sujet | Proposition | Raison |
|---|---|---|
| Langage | **TypeScript** compilé par **esbuild** en un seul script de contenu | Typage du schéma ; les scripts de contenu MV3 ne sont pas des modules ES, donc un bundle est nécessaire |
| Tests unitaires | **Vitest + jsdom** | Rapide, compatible TS |
| Tests E2E | **Playwright** (Chromium, extension chargée via contexte persistant) sur des **fixtures locales** et, si l'accès le permet, sur l'environnement réel | Reproductible hors ligne |
| Permissions | `storage` ; script de contenu limité à `https://safinum.cm/hackathon-test*` (Q2) | Moindre privilège |
| Réseau | Aucun appel ; CSP MV3 par défaut ; aucune dépendance d'exécution tierce | Règles D2/D3 |
| Police | Police libre (licence OFL) embarquée seulement si le rendu des diacritiques l'exige | Lisibilité de l'Éton |
| Moteur et scripts | TypeScript exécuté sous **Node** (Vitest) ; aucune dépendance au navigateur | Bibliothèque et moteur testables **sans Chrome** (D6 §3) |
| Chargement du moteur | Inclus dans le bundle du script de contenu avec `lexicon.json` ; obtenu via `createEngine()` | Aucun réseau ; remplacement du faux moteur en un seul fichier |

---

## 5. Questions ouvertes (à trancher avant ou pendant le développement)

**Bloquantes pour la Synchronisation 1** (en plus de la validation du contrat, du format JSON §4.5 et de l'arborescence §4.2)
- **Q1 — Calendrier** — ⏳ **En attente des organisateurs (2026-11-12). Ne bloque plus S1.** Le 14/11/2026 a été évoqué sans confirmation. Hypothèse de travail : ~10 jours ouvrés (ROADMAP §0.1). Si le 14/11 est confirmé, on bascule sur le **plan court** (ROADMAP §0.1.1).
- **Q2 — Origine exacte de l'environnement de test** — ✅ **Tranchée (2026-11-12) : `https://safinum.cm/hackathon-test`, application monopage** dont l'URL ne change pas entre les étapes. Les textes des 5 étapes sont ceux de D5, dont la liste à jour est D8 depuis la v0.6 (§3.9, Q21). : les fixtures sont reconstruites depuis D5 (§3.8-1). La structure réelle du DOM reste à vérifier (Q20).
- **Q3 — Mode d'affichage** — ✅ **Tranchée (2026-11-12) : option (a).** L'Éton remplace le français, et le français reste accessible au survol ou au focus. Le popup propose une bascule vers le mode bilingue (b).
- **Q4 — Stack** — ✅ **Tranchée (2026-11-12) : TypeScript + esbuild** (un seul bundle), tests **Vitest** (unitaires) et **Playwright** (e2e).
- **Q5 — Source de vérité linguistique** — ✅ **Tranchée (2026-11-12) : JSON dans `data/`.** Les Markdown et CSV de relecture destinés aux locutrices sont **générés** à partir de ce JSON et ne sont jamais édités à la main. Les documents Markdown sources ne servent qu'à l'import initial : depuis le 2026-11-13, c'est D8, qui remplace D4 et D5 (§3.9). *(Confirmée par D6 §5 ; exports dans `data/exports/`.)*
- **Q14 — Propriété des motifs protégés (C8)** — ✅ **Tranchée (2026-11-12) : recommandation acceptée.** Les motifs (montant, devise, téléphone, numéro de compte, référence, date, marque) sont définis dans un module pur sans DOM, `src/protection/patterns.ts`, propriété d'Yvan. Ce module est injecté dans le moteur (`createEngine({ detectProtected })`). Une suite de tests commune est tirée de D5 §4 (contrat §8).
- **Q16 — Langue source `'auto'`** — ✅ **Tranchée (2026-11-12) : oui.** L'extension peut envoyer `sourceLang: 'auto'`. La règle de départage est celle du contrat §5.3 (`AMBIGUOUS` en cas de conflit).
- **Q19 — Organisation Git** — ✅ **Tranchée (2026-11-12) : recommandations acceptées.**
  - **Pas de branche `develop`** : des branches courtes vers `main`, via PR.
  - **Yvan crée les fichiers partagés en P1.1** (`package.json`, `tsconfig.json`, `build.mjs`, `.gitignore`, `CODEOWNERS`). Toute modification ultérieure passe par une PR.
  - Le compte GitHub d'Yvan est **`@ivan-14-dev`**. Il doit être invité comme collaborateur avec les **droits d'écriture**, condition pour figurer dans `CODEOWNERS`. Il est **relecteur obligatoire** des PR `contract:`.
  - Si l'offre GitHub du compte ne permet pas d'appliquer `CODEOWNERS` sur un dépôt privé, la revue est demandée **manuellement** : c'est la règle d'équipe D6 §6 qui fait foi.

**Nouvelle question v0.5, non bloquante pour S1 (à traiter par Yvan au début de P2)**
- **Q20 — Structure réelle du DOM de la SPA** : sur son poste, avec des données fictives, Yvan vérifie dans les DevTools :
  1. la présence d'`iframe` ou de *shadow DOM* (qui conditionnent `all_frames` et la traversée) ;
  2. le balisage des paires libellé/valeur (P3, règle 3.3) ;
  3. la valeur de `<html lang>` ;
  4. une éventuelle redirection vers `www.safinum.cm` ;
  5. le comportement au rechargement ;
  6. le repère visible de chaque étape (pour `context.step`).

  Les fixtures sont ensuite ajustées, par exemple à partir du `outerHTML` du conteneur de chaque étape, après suppression de toute donnée réelle.

**Importantes, peuvent être tranchées en phase 2–4**
- **Q6 — Barème de référence** : D2 ou D3 (conflit C1) ? Il faut peut-être confirmer auprès des organisateurs.
- **Q7 — Paragraphes multi-phrases** (ex. P2-002, P3-003) : si une seule phrase est validée, traduit-on partiellement (texte mixte FR/Éton) ou laisse-t-on tout en français ? **Recommandation : tout ou rien par nœud texte.**
- **Q8 — `select`/`option`, `placeholder` et attributs d'accessibilité** : P3-007 « Paiement de services » est probablement une option de liste. Par défaut, on ne touche à rien. Faut-il traduire :
  - les **libellés** d'options (`option.text` uniquement, jamais `value`) ?
  - les attributs `placeholder`, `aria-label`, `title` et `alt` lorsqu'ils correspondent à une entrée validée (§3.6-4) ?

  **Recommandation : oui pour `aria-label` et `title`**, afin que le lecteur d'écran lise la même chose que l'écran. Les options et le `placeholder` peuvent attendre une phase ultérieure.
- **Q9 — Statuts intermédiaires** — ✅ **Tranchée (2026-11-13) par le responsable : oui.** Les traductions non vérifiées s'affichent sur la page de test, avec un marqueur visible et le français au survol. Une option du popup permet de les cacher (§3.11, contrat 0.2.0 §5.4). *(Recommandation initiale : non. Raison du choix : les locutrices ne sont pas toujours disponibles, et voir les traductions sur la page de test aide à juger leur sens.)*
- **Q10 — Nommage (conflit C2)** — ✅ **Tranchée par D6 (2026-11-12) : FinEthnic = le projet, SAFINUM Éton = son premier prototype.** « EtonFin » (D5) est remplacé lors de l'import.
- **Q11 — Versionner les sources** dans `docs/sources/` ? — 🔶 **En partie tranchée (2026-11-13) : D8 est versionné**, à la demande du responsable, pour un usage à long terme. D8 ne contient **aucune forme en Éton** : sa publication ne pose donc pas de problème de licence. Restent à décider : D2, D3 et D5 (voir Q21). La question de licence ne concerne plus que les formes tirées du dictionnaire (D7, Q17), si le dépôt devient public.
- **Q21 — Textes de pages : D8 ou D5 ? (§3.9)** D8 liste 60 textes, D5 en listait 62 (« Bonjour, Amina », phrase P1-015, « Safinum Pay »). **Recommandation : D8 fait foi pour l'import, et le relevé du site réel (P2.0, Q20) tranche les écarts.** Le D5 original reste utile pour ce que D8 ne reprend pas : statuts, fiche et procédure de validation, exemples de valeurs protégées. Faut-il aussi le versionner dans `docs/sources/` ?
- **Q22 — Méthode de traduction** — ✅ **Tranchée (2026-11-13) : cascade terme → synonymes simples → définition simple**, avec assemblage selon les règles de D7 (§3.10). Elle tourne pendant la préparation de la bibliothèque et produit des **propositions**, vérifiées ensuite par une locutrice *(v0.8, Q9 : affichées avec un marqueur en attendant, §3.11)*. Les échecs sont confiés aux locutrices.
- **Q23 — Règles de formation des phrases de D7** (bloque BM3.6, pas S1) : quand D7 sera téléversé, où se trouvent ces règles dans le dictionnaire et que couvrent-elles (ordre des mots, classes nominales et accords, verbes et temps, négation, possessifs, tons) ? **Recommandation :** transcrire d'abord les quelques règles nécessaires aux définitions des 52 textes de pages, chacune avec sa page de référence, et les faire relire par une locutrice. *Constat (2026-11-13) : le lexique reçu contient une section « Grammaire & phrases » en 7 parties (ordre des mots, marqueurs de sujet, temps, impératif, négation et questions, quasi-auxiliaires, dérivation verbale, phrases d'exemple). C'est un résumé qui renvoie aux p. 18-71. Transcription commencée : articles ignorés et règle « verbe + complément » (BM3.6). Le format actuel ne fait que réordonner des mots : marques du sujet, temps, négation et connectifs restent à la locutrice.*
- **Q24 — Usage réel et entrées critiques** (non bloquante, après la démo) : la décision Q9 vaut pour l'environnement de test, qui n'utilise que des données fictives. Avant tout usage avec de vrais clients, faut-il n'afficher que des traductions **approuvées**, au moins pour les entrées critiques (`sensitivity = critical` : messages SEC, montants, confirmation de transfert) ? **Recommandation : oui.**
- **Q12 — Calendrier linguistique** : combien de locutrices d'Obala sont disponibles, et à quel rythme ? Cela fixe le nombre réaliste de libellés validés pour la démo. **Priorité suggérée : les ~53 libellés uniques des 5 pages (62 occurrences), puis les actions critiques et les alertes SEC.** *(2026-11-13 : en partie tranché. Au moins 3 locutrices d'Obala, codes `LOC-01`, `LOC-02`… ; disponibilité encore inconnue. D8 donne 52 textes uniques, fiche L1 `data/exports/csv/l1-pages.csv`.)*
- **Q13 — Public qui ne lit pas l'Éton (§3.6-5)** : les locutrices peuvent-elles enregistrer l'audio des phrases critiques en même temps que leur validation ? Si oui, l'option « écouter » pourra être ajoutée **après** le MVP, avec des fichiers locaux et sans service distant. Ce n'est pas bloquant pour P1–P7.

**Nouvelles questions v0.4 (D6), non bloquantes pour S1**
- **Q15 — Ampleur des sources anglaises (C9)** : D6 exige des sources EN, mais aucune n'existe et SAFINUM est en français. Que couvre-t-on pour la démo : (a) seulement le schéma et le moteur prêts pour EN, avec quelques entrées de test ; (b) les ~53 libellés des pages et les messages SEC critiques en EN ; (c) tout le corpus ? Qui relit la correspondance FR↔EN (sens financier) ? **Recommandation : (b)**, relu par le responsable du projet. Phase BM6.
- **Q17 — Dictionnaire (D7)** — ✅ **Tranchée (2026-11-13)** : reçu en lexique Markdown (converti depuis Excel), avec les règles de phrase dans le même fichier. Licence CC BY-NC-SA 4.0 (d'après le lexique ; le site de l'auteur n'a pas pu être consulté). D7 reste **hors de Git** ; seules les formes citées, avec leur référence, sont versionnées, avec la mention des auteurs et de la licence (§3.7.4-3). *Point de vigilance : la clause « pas d'usage commercial » est à revoir avant tout usage avec de vrais clients.*
- **Q18 — Double relecture des entrées critiques** : exige-t-on **deux** relectures indépendantes (deux locutrices, ou une locutrice + validation du sens financier par une autre personne) pour les entrées `sensitivity = critical` (SEC, montants, confirmation de transfert) avant `APPROVED` ? **Recommandation : oui**, avec une dérogation **tracée** dans `reviews[]` si une seule locutrice est disponible.
