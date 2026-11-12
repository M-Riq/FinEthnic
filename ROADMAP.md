# ROADMAP — SAFINUM Éton (projet FinEthnic, présélection SAFINUM Innovate 2026)

> **Statut :** v0.5 — proposition de la Phase 0, **en attente de la Synchronisation 1**. La v0.4 aligne la roadmap sur `TEAM_WORKFLOW.md` (D6) :
> - pistes parallèles et synchronisations S1–S5 ;
> - piste **BM** (bibliothèque et moteur), qui remplace la phase 4 ;
> - phase 5 recentrée sur le remplacement et la restauration ;
> - contrat d'intégration.
>
> La v0.5 enregistre les décisions Q2 (`https://safinum.cm/hackathon-test`, application monopage), Q14, Q16 et Q19 (Yvan : `@ivan-14-dev`). Elle ajoute un **plan court** (§0.1.1) au cas où la date limite (Q1, en attente des organisateurs) serait le 14/11/2026.
>
> Q2, Q3, Q4, Q5, Q10, Q14, Q16 et Q19 sont tranchées (§12).
> **Références :** `PROJECT_CONTEXT.md` (documents D1–D7, conflits C1–C14, questions Q1–Q20) ; interface moteur ⇄ extension : `INTEGRATION_CONTRACT.md` ; organisation : `TEAM_WORKFLOW.md`.
> **Règle de passage :** une phase ne démarre que si la **porte** de la phase précédente **de la même piste** est franchie. Les pistes avancent en parallèle et se retrouvent aux synchronisations S1–S5 (§0.3). Ce sont des rendez-vous, pas des blocages (D6 §7). Seul le responsable du projet peut lever une porte.

---

## 0. Vue d'ensemble

```
S1 Cadrage (J0)
 │
 ├─ EXT — Extension (Yvan)
 │     P1 Init ─► P2 Scanner + faux moteur ─► P3 Protection ─► P5 Remplacement / restauration ─┐
 │                                                                                             │
 ├─ BM — Bibliothèque et moteur (responsable du projet)                                        │
 │     BM1 Schéma + contrat ─► BM2 Import FR ─► BM4 Outils de relecture ─► BM5 Moteur ─► BM6 EN │
 │     BM3 Dictionnaire (⏸ attend D7 ; ne bloque ni BM4 ni BM5)                                 │
 │                        ··· S2 Premiers modules (≈ J3) ···                                    ▼
 │                                                     S3 = BM7 Première intégration (vrai moteur)
 │                                                                                             ▼
 │                                    P6 Parcours des 5 pages (= S4) ─► P7 Inédit ─► P8 Démo (= S5)
 │
 └─ L — Validation linguistique (responsable + locutrices d'Obala)
       L1 Fiches ─► L2 Validation prioritaire ─► L3 Messages du jury ─► L4 Double relecture
       (retours réintégrés au fil de l'eau par l'import contrôlé de BM4)
```

**Chemin critique :**
1. **EXT** : P2 → P3 → P5 (écriture sûre dans la page).
2. **BM** : BM1 → BM2 → BM5. Le vrai moteur doit être conforme au contrat avant S3.
3. **L** : L2 doit être terminée pour afficher de l'Éton **validé** en S4.
4. L'URL de l'environnement réel est connue (Q2). Il reste à inspecter son DOM sur le poste d'Yvan au début de P2 (Q20), puis à le tester avant P6. L'environnement de Copilot n'y a pas accès (échec DNS).
5. Le dictionnaire (D7) **n'est pas** sur le chemin critique : il n'alimente que BM3, c'est-à-dire la justification des propositions.

**Pourquoi trois pistes :**
- D6 impose que l'extension n'attende pas la bibliothèque, et réciproquement.
- Aucune traduction n'est validée aujourd'hui. Une extension parfaite avec une bibliothèque vide n'affiche que du français.
- La piste L ne génère aucun code : elle produit des **données validées**.

### 0.1 Calendrier indicatif (à recaler après Q1)
La date limite de soumission est **à confirmer par les organisateurs**. Le 14/11/2026 a été évoqué sans confirmation. L'événement a lieu du 26 au 28/11/2026. Hypothèse de travail : **~10 jours ouvrés** à partir de S1 (J0). Si le 14/11 est confirmé, c'est le plan court (§0.1.1) qui s'applique.

| Jour | EXT (Yvan) | BM (responsable) | L (responsable + locutrices) | Synchro |
|---|---|---|---|---|
| J0 | Validation du cadrage | Validation du cadrage | Choix des locutrices, envoi de la procédure D5 §6.6 | **S1** |
| J1 | P1 Initialisation (+ fichiers partagés, Q19) | BM1 Schéma, `contract.ts`, squelette `tests/contract/` | L1 : préparation des fiches (contextes d'écran) | |
| J2 | P2 Scanner + faux moteur | BM2 Import FR, liens A ↔ B, doublons ; export minimal des fiches L1 | L1 : envoi du lot ① | |
| J3 | P2 (fin) → P3 Protection | BM4 Export et réimport contrôlé ; BM3 si D7 est reçu | L2 ① actions critiques | **S2** |
| J4 | P3 Protection | BM5 Moteur | L2 ② avertissements ; 1ᵉʳ import contrôlé | |
| J5 | P5 Remplacement / restauration (faux moteur) | BM5 (fin) ; BM6 selon Q15 | L2 ③ ; L3 messages probables du jury | |
| J6 | P5 (fin) | BM7 Livraison et branchement | Import | **S3** |
| J7 | P6 Parcours des 5 pages (commun) | P6 (commun) : correspondances, inconnus | Import | **S4** |
| J8 | P7 Contenu inédit (commun) | P7 (commun) | L4 Double relecture critique | |
| J9–J10 | P8 Stabilisation, README, note technique, vidéo | P8 Méthode de validation, exports finaux | Méthode de validation (livrable) | **S5** |

#### 0.1.1 Plan court (si la date limite du 14/11/2026 est confirmée)
Il resterait environ deux jours après S1. Le périmètre est réduit à ce qui démontre les 5 capacités minimales (D2), **sans jamais afficher d'Éton non validé**.

| Créneau | EXT (Yvan) | BM (responsable) | L (responsable + locutrices) |
|---|---|---|---|
| 13/11 matin | S1 express (contrat accepté tel quel) ; P1 ; Q20 sur son poste | S1 express ; BM1 réduit (`contract.ts`, `tests/contract/`, `validate-data`) | Envoi des libellés des 5 étapes, en commençant par les boutons et les libellés de montants |
| 13/11 après-midi | P2 (scanner, observer, faux moteur) ; P3 (motifs, `dom-guard`, intégrité) | BM2 limité à D5 (53 libellés + `GUARD`) ; BM5 réduit : exact, normalisé, « libellé + valeur protégée » ; `build-lexicon` | L2 : validation des libellés prioritaires |
| 14/11 matin | P5 (remplacement, restauration) ; branchement du vrai moteur (S3) | Saisie des validations dans le JSON, contrôlée par `validate-data` et relue en PR ; BM7 | Fin de L2 ; dérogation tracée si une seule locutrice (Q18) |
| 14/11 après-midi | P6 sur l'environnement réel (S4) ; README ; vidéo ≤ 3 min | Note technique ; méthode de validation | — |

- **Reporté :** mode bilingue ; sources EN (BM6 : schéma prêt seulement) ; dictionnaire (BM3) ; aller-retour CSV complet (BM4, remplacé par la saisie contrôlée) ; gabarits du corpus hors « libellé + valeur » ; surlignage du diagnostic ; P7 limitée aux messages déjà validés.
- **Jamais sacrifié :** protection des valeurs (P3), contrôle d'intégrité, restauration exacte, règle « `APPROVED` seulement » et absence de réseau.

### 0.2 Périmètre minimal de démonstration (« MVP ») vs options
| Doit être présent (MVP) | Si le temps le permet |
|---|---|
| Activation/désactivation + restauration exacte | Mode bilingue (Éton + français) |
| Correspondance exacte + gabarits à variables typées | Libellés d'`<option>` (Q8) |
| Protection multicouche + contrôle d'intégrité avec retour arrière | Traversée des *shadow roots* ouverts |
| MutationObserver sans boucle | Textes répartis sur plusieurs nœuds (`Votre transfert de <b>…</b> a été…`) |
| Diagnostic (compteurs + surlignage) | Badge de compteur sur l'icône |
| 5 étapes testées + scénarios d'injection | Export du rapport « reste à traduire » |
| Les 6 statuts du contrat distingués (compteurs du popup) | Sources EN au-delà du périmètre retenu en Q15 |

### 0.3 Points de synchronisation (D6 §7)
| Synchro | Quand | Contenu (D6) | Prérequis | Sortie |
|---|---|---|---|---|
| **S1 Cadrage** | J0 | Architecture, format JSON, contrat d'intégration, répartition des tâches | PROJECT_CONTEXT v0.5, ROADMAP v0.5, `INTEGRATION_CONTRACT.md` v0.1.0-draft ; Q2, Q14, Q16 et Q19 ✅ ; Yvan (`@ivan-14-dev`) invité au dépôt et relecteur de la PR #1. Q1 n'est pas attendue (§0.1.1). | Contrat **v0.1.0** validé ; PROJECT_CONTEXT §4.2 et §4.5 validés ; portes P1 et BM1 ouvertes |
| **S2 Premiers modules** | ≈ J3 | Scanner DOM, schéma JSON, matcher initial, compatibilité des interfaces | P2 (avec le faux moteur), BM1, BM2, prototype du matcher | `tests/contract/` vert sur le faux moteur ; ajustements éventuels du contrat (procédure §10 du contrat) |
| **S3 Première intégration** | ≈ J6 | Chargement de la bibliothèque, remplacement du faux moteur, correspondances, statuts, protection | P5 sur le faux moteur, BM5 vert | `engine-provider.ts` branché sur le vrai moteur ; conformité verte sur les deux moteurs (BM7) |
| **S4 Tests SAFINUM** | ≈ J7 | Parcours des 5 pages, contenus dynamiques, montants et références, textes inconnus, corrections communes | S3, imports L2, Q20 vérifiée sur l'environnement réel | Rapport de test P6 |
| **S5 Préparation finale** | J9–J10 | Stabilisation, non-régression, documentation, démonstration | P7 | Dossier de soumission (P8) |

### 0.4 Répartition (TEAM_WORKFLOW §2)
| Phases | Responsable | Relecture obligatoire |
|---|---|---|
| P1, P2, P3, P5 (piste EXT) | Yvan | Responsable du projet, pour ce qui touche au contrat ou aux fichiers partagés |
| BM1 à BM7 (piste BM) | Responsable du projet | Yvan, pour `contract.ts`, `tests/contract/` et `engine-provider.ts` |
| L1 à L4 (piste L) | Responsable du projet, avec les locutrices | Double relecture des entrées critiques (Q18) |
| P6, P7, P8 | Commun | — |
| `INTEGRATION_CONTRACT.md`, `tests/contract/`, `package.json`, `tsconfig.json`, `build.mjs`, `.gitignore`, `.github/CODEOWNERS` | Copropriété | Pull Request relue par l'autre membre (D6 §6) |

Comptes GitHub (Q19) : responsable du projet **`@M-Riq`**, Yvan **`@ivan-14-dev`**. Pas de branche `develop` : des branches courtes vers `main`, via PR.

---

## PHASE 0 — Analyse et cadrage ✅ (livrée, en attente de S1)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet (avec Copilot) |
| **Objectifs** | Comprendre les documents D1–D6, extraire les exigences, risques, conflits et questions, puis proposer l'architecture, le contrat d'intégration et la roadmap. |
| **Tâches réalisées** | **v0.1 :** lecture de D1–D5 ; vérification automatique du corpus (300 ID uniques, 2 doublons stricts) ; couverture pages ↔ corpus (53 libellés uniques, 19 dans le corpus, 34 propres aux pages) ; tentative de vérification de l'origine du test (inaccessible depuis mon environnement) ; conflits C1–C5 ; questions Q1–Q12. **v0.2 :** revérification manuelle des chiffres (confirmés) ; 7 correspondances entre libellés de page et gabarits du corpus ; jetons de marque ; attributs d'accessibilité ; risque de lecture de l'Éton écrit (Q13) ; nouvel essai d'accès (toujours un échec DNS). **v0.3 :** Q3, Q4 et Q5 tranchées. **v0.4 :** analyse de `TEAM_WORKFLOW.md` (D6) : PROJECT_CONTEXT §3.7, conflits C6–C14, Q10 tranchée, questions Q14–Q19. Arborescence D6 avec responsables. Schéma à trois niveaux. Contrat d'intégration proposé. Piste BM. |
| **Fichiers** | `PROJECT_CONTEXT.md`, `ROADMAP.md`, `TEAM_WORKFLOW.md`, `INTEGRATION_CONTRACT.md` |
| **Livrables** | Synthèse, exigences (§11), risques (§10), questions, architecture, contrat (proposition), roadmap |
| **Porte → S1** | ✔ Validation de la compréhension et de l'architecture v0.4. **À valider en S1 :** <br>• le contrat (`INTEGRATION_CONTRACT.md` → v0.1.0) ;<br>• le format JSON (PROJECT_CONTEXT §4.5) ;<br>• l'arborescence (PROJECT_CONTEXT §4.2) ;<br>• la répartition (§0.4).<br>**Réponses reçues (v0.5) :**<br>• **Q2** ✅ `https://safinum.cm/hackathon-test` (SPA) ; fixtures reconstruites depuis D5 ;<br>• **Q14** ✅, **Q16** ✅, **Q19** ✅ (Yvan : `@ivan-14-dev`) ;<br>• **Q1** ⏳ en attente des organisateurs, non bloquante (hypothèse §0.1, plan court §0.1.1).<br>**Reste avant S1 :** inviter Yvan dans le dépôt et obtenir sa relecture de la PR #1.<br>Q3, Q4, Q5 et Q10 sont tranchées. Le dictionnaire (D7) **n'est pas** requis pour S1. |

---

## PHASE 1 — Initialisation de l'extension Chrome

| Rubrique | Contenu |
|---|---|
| **Responsable** | Yvan (piste EXT) |
| **Objectifs** | Obtenir une extension MV3 minimale, installable en mode développeur, avec un popup accessible et un interrupteur Activer/Désactiver persistant. **Aucune lecture ni modification de la page à ce stade.** |
| **Tâches** | 1.1 Initialiser `package.json`, TypeScript, esbuild, Vitest et ESLint (Q4). Ce sont des **fichiers partagés** : ils sont créés une seule fois, puis modifiés par PR (Q19). Créer aussi `.github/CODEOWNERS` : `@M-Riq` pour les dossiers [R], `@ivan-14-dev` pour les dossiers [Y], les deux pour les fichiers [R+Y] (PROJECT_CONTEXT §4.2). Ajouter un `.gitignore` qui exclut `dist/`, `node_modules/` et `data/language-resources/raw/`. Prévoir les dossiers de tests `tests/language`, `tests/extension` et `tests/contract`. 1.2 Écrire `manifest.json` MV3 : `permissions: ["storage"]`, aucune `host_permissions` (aucune requête réseau) et `content_scripts.matches: ["https://safinum.cm/hackathon-test*"]` (Q2) ; `run_at: document_idle` ; `all_frames: false` sauf si Q20 révèle une iframe. 1.3 Prévoir un **manifest de développement** séparé qui ajoute `http://localhost/*` pour les fixtures ; le manifest de production n'en contient pas. 1.4 Créer le popup : interrupteur (`role="switch"`, `aria-checked`), état lisible, navigation au clavier, contraste ≥ 4,5:1. 1.5 Créer `shared/settings` : `{ enabled, displayMode, diagnostic }` dans `chrome.storage.local`. 1.6 Ajouter un script de contenu « vide » qui écoute `storage.onChanged` et le journal d'événements (sans aucun contenu de page). 1.7 Écrire les icônes, `README` (installation) et `THIRD_PARTY.md` (outils, dont GitHub Copilot). |
| **Fichiers** | `manifest.json`, `manifest.dev.json`, `package.json`, `tsconfig.json`, `build.mjs`, `.gitignore`, `.github/CODEOWNERS`, `src/popup/*`, `src/shared/settings.*`, `src/shared/logger.*`, `src/content/index.*`, `icons/*`, `README.md`, `THIRD_PARTY.md` |
| **Dépendances** | S1 ; Q2 ✅ (URL) ; Q19 ✅ (fichiers partagés, `CODEOWNERS`) |
| **Critères d'acceptation** | L'extension se charge sans erreur via `chrome://extensions` → « Charger l'extension non empaquetée ». Le popup s'ouvre et se manipule au clavier. L'état survit à la fermeture du popup et au redémarrage du navigateur. Les permissions affichées par Chrome se limitent à « Lire et modifier vos données sur safinum.cm ». Aucune requête réseau n'est émise par l'extension. |
| **Tests** | T-INS-01 à 05. Test unitaire du module `settings` (`tests/extension/`). Test d'instantané du manifest (il échoue si une permission est ajoutée). |
| **Risques** | L'URL est connue (Q2). Risque résiduel : une redirection vers `www.safinum.cm` ou un chargement par une autre adresse, vérifiés en Q20. Le motif `matches` est alors ajusté par PR, mais **jamais** élargi à `<all_urls>`. |
| **Livrable** | Extension minimale installable, documentée dans le README. |
| **Porte → P2** | Tests T-INS au vert, vérifiés **sur ta machine**. |

---

## PHASE 2 — Scanner DOM et détection (mode diagnostic, **lecture seule**)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Yvan (piste EXT) |
| **Objectifs** | Détecter et classer tous les textes visibles, au chargement et après injection, **sans rien modifier**. Interroger un **faux moteur** conforme au contrat, sans attendre la bibliothèque (D6 §3). |
| **Tâches** | 2.0 **Inspecter le DOM réel (Q20)** sur `https://safinum.cm/hackathon-test`, avec des données fictives : iframes, *shadow DOM*, balisage des paires libellé/valeur, `<html lang>`, redirection éventuelle vers `www`, comportement au rechargement, repère visible de chaque étape. Consigner le résultat dans `docs/architecture.md`, sans aucune donnée réelle. 2.1 Construire `scanner` : `TreeWalker(SHOW_TEXT)` en ignorant les nœuds vides et les éléments `script`, `style`, `noscript`, `template`, `code`, `pre`, `svg`, `[aria-hidden]`, `[hidden]`. 2.2 Ajouter un premier filtre `dom-guard` minimal : exclure `input`, `textarea`, `select` (sauf décision Q8), `[contenteditable]` et leurs descendants. 2.3 Classer chaque nœud : `excluded`, `candidate` (non encore apparié), `numeric-like`. 2.4 Écrire `observer` : `MutationObserver` (`childList`, `characterData`, `subtree`) avec regroupement par `requestAnimationFrame`, dédoublonnage des nœuds et budget de traitement par lot. 2.5 Gérer l'application monopage (Q2 : l'URL ne change pas entre les étapes) : le changement d'étape n'est visible que par mutation, sans rechargement. Le premier scan tolère un rendu tardif. `context.step` est déduit d'un repère visible de l'étape, sinon omis (contrat §6). 2.6 Afficher le diagnostic : compteurs dans le popup (via `chrome.tabs.sendMessage`, sans permission `tabs`). Surlignage par **CSS Custom Highlight API** (`CSS.highlights`) : **aucune modification du DOM du site**. 2.7 Respecter la règle du journal : on ne journalise que des compteurs et des types, **jamais le texte**. 2.8 **Faux moteur** (`src/content/fake-engine.ts`), conforme au contrat §9 : sorties `⟦FAKE⟧`, les 6 statuts couverts à partir de textes fictifs FR et EN. Il est obtenu via `src/content/engine-provider.ts`, seul fichier qui choisit le moteur. Le scanner calcule le contexte (`role`, `step`, `live`, `pageLang`) et le diagnostic compte les candidats **par statut**. 2.9 Exécuter `tests/contract/` (BM1) sur le faux moteur. |
| **Fichiers** | `src/content/scanner.*`, `src/content/observer.*`, `src/protection/dom-guard.*` (version initiale), `src/content/diagnostic.*`, `src/content/fake-engine.ts`, `src/content/engine-provider.ts`, `tests/extension/scanner.test.*`, `tests/extension/observer.test.*`, `tests/fixtures/*.html` |
| **Dépendances** | P1 ; contrat validé en S1 (faux moteur) ; squelette `tests/contract/` (BM1). Fixtures locales des 5 étapes : reconstruites depuis les textes de D5 avec des données fictives (Q2), puis ajustées à la structure réelle relevée en 2.0 (Q20). |
| **Critères d'acceptation** | 100 % des libellés D5 de chaque fixture sont détectés comme `candidate`. 0 nœud détecté dans un champ de saisie. Une injection après chargement est détectée en moins de 100 ms. 50 nœuds injectés d'un coup sont traités en un seul lot. **L'empreinte du DOM est identique avant et après le scan** (test automatisé). |
| **Tests** | T-DET-01 à 06, T-PRO-12, T-CON-01 à 05 (faux moteur). |
| **Risques** | *Shadow DOM* ou iframes dans l'environnement réel (vérifiés en 2.0, Q20). Performance sur de gros DOM : atténuée par le regroupement et un budget par trame. |
| **Livrable** | Scanner et observateur en lecture seule, avec diagnostic visuel. |
| **Porte → P3** | Diagnostic validé sur au moins une étape réelle ou sa fixture, avec la preuve que le DOM n'est pas modifié. Scanner et faux moteur présentés en **S2**. |

---

## PHASE 3 — Protection des données (testée **avant** toute écriture)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Yvan (piste EXT) ; motifs partagés avec le moteur (Q14) |
| **Objectifs** | Garantir qu'aucune donnée financière, personnelle, transactionnelle ou saisie ne puisse être modifiée, avec des faux positifs maîtrisés. |
| **Tâches** | 3.1 **Motifs** (`patterns`) : montants (espaces normales, U+00A0 et U+202F ; décimales `,` et `.` ; signes `+`, `-`, `−` U+2212), `FCFA`/`XAF`, pourcentages, dates (`05 nov. 2026`, `05/11/2026`), heures, téléphones (`+237`…), comptes (`CM 001 …`), références (`[A-Z]{2,}-\d{4}-[A-Z0-9]+` généralisé), e-mails, URL, **noms de marque (`Safinum`, `Safinum Pay` — D5 §4.3, v0.2)** et tout jeton contenant un chiffre. Le module est **pur et sans DOM** : `detectProtected(text)` renvoie les segments protégés. Il est réutilisé par le moteur par injection (Q14), avec une suite de cas commune tirée de D5 §4. 3.2 **Contexte DOM** (`dom-guard`) : champs de saisie, `[contenteditable]`, `aria-live` contenant des valeurs, `<output>`, `<time>`, `<data>`, `<a href^=tel:\|mailto:>`, et attributs ou classes **indicatifs** (`amount`, `balance`, `name`, `ref`…) utilisés uniquement pour *renforcer* une exclusion, jamais pour autoriser une traduction. 3.3 **Paires libellé/valeur** : dans une structure `dt/dd`, ligne de tableau ou grille à 2 colonnes, l'élément « valeur » est protégé en entier. Cela couvre les noms (`Jean-Paul Mbarga`) **sans regex de noms**. 3.4 **Écho de saisie** : à l'étape 4, une valeur affichée peut reprendre une saisie de l'étape 3 (motif ou note). La liste blanche ne suffit pas : la règle 3.3 et la position « valeur » priment sur toute correspondance lexicale. 3.5 **Intégrité** (`integrity`) : avant chaque écriture, extraire le multiensemble des jetons protégés de la source et vérifier qu'il est **identique octet par octet** dans le résultat, sinon refuser. Au niveau page, garder en mémoire uniquement une empreinte (hachage) des jetons protégés visibles ; en cas d'écart imputable à l'extension, **retour arrière total** et alerte dans le popup. 3.6 Vérifier qu'aucune donnée n'est stockée ni journalisée (revue et test). |
| **Fichiers** | `src/protection/patterns.*`, `src/protection/dom-guard.*`, `src/protection/integrity.*`, `tests/extension/protection.test.*`, `tests/extension/integrity.test.*` |
| **Dépendances** | P2 |
| **Critères d'acceptation** | 100 % des valeurs d'exemple (D1 §5, D5 §4) sont reconnues comme protégées. **0 faux négatif** sur le jeu de cas limites. Faux positifs documentés et acceptés (sur-protection tolérée, sous-protection interdite). Une écriture qui altérerait un jeton est refusée (test). |
| **Tests** | T-PRO-01 à 13. |
| **Risques** | Nom propre isolé hors structure libellé/valeur : il est protégé de toute façon par la liste blanche, car un nom n'est jamais une entrée de la bibliothèque. Un nom identique à un mot du lexique (ex. « Bonheur ») : protégé par la règle 3.3 et le gabarit P1-002. |
| **Livrable** | Module de protection testé, avec un rapport de tests. |
| **Porte → P5** | Tous les tests T-PRO au vert. Revue par le responsable de la liste des cas limites. `patterns.ts` mis à disposition de la piste BM (Q14). |

---

## PISTE BM — Bibliothèque et moteur linguistique (responsable du projet)

> **Remplace la phase 4 de la v0.3.**
> - **Périmètre :** `data/`, `scripts/`, `src/language/`, `tests/language/` (D6 §3).
> - Tout se teste **sans Chrome** (Node + Vitest).
> - Le dictionnaire (D7) n'est requis que par **BM3**.
> - Copilot n'écrit **aucune** forme Éton : ses tâches se limitent au code, aux contrôles et aux exports (voir la piste L).

### BM1 — Schéma, contrat et socle de tests (dès S1)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet ; relecture d'Yvan pour `contract.ts` et `tests/contract/` |
| **Objectifs** | Fixer le format des données et transcrire le contrat validé en S1, pour que les deux pistes travaillent sur la même base. |
| **Tâches** | BM1.1 `data/schemas/entry.schema.json` selon PROJECT_CONTEXT §4.5 (résout C3 et C13), avec `lexicon.schema.json` et `review-import.schema.json`. BM1.2 `src/language/contract.ts` : transcription exacte du contrat §4 (types et constantes seulement). BM1.3 `tests/contract/` : squelette de la suite de conformité (un cas par statut, invariants I2–I5, I8, I10), avec des cibles `⟦TEST:<id>⟧`. La suite s'exécute sur **n'importe quelle** implémentation de `TranslationEngine`. BM1.4 `scripts/validate-data.*` : schéma, NFC, liste blanche de caractères Éton, variables source/cible, cohérence `translationStatus` ⇔ `validation.linguistic`. BM1.5 Lexique **de test** (`tests/language/fixtures/`) couvrant les 6 statuts. |
| **Fichiers** | `data/schemas/*.schema.json`, `src/language/contract.ts`, `scripts/validate-data.*`, `tests/contract/*`, `tests/language/fixtures/*` |
| **Dépendances** | S1 (contrat, PROJECT_CONTEXT §4.2 et §4.5 validés) ; fichiers partagés de P1.1 (Q19). Si P1.1 n'est pas encore fusionnée, prévoir une configuration Node minimale dans une PR coordonnée avec Yvan. |
| **Critères d'acceptation** | Les exemples du contrat §12 et de PROJECT_CONTEXT §4.5 sont valides au schéma. Une entrée invalide est refusée (variable manquante, texte en NFD, ε grec U+03B5). `contract.ts` compile et ne contient aucune logique. La suite de conformité s'exécute ; elle est rouge tant qu'aucun moteur n'existe, ce qui est attendu. |
| **Tests** | T-LIB-07, T-DIC-01/02 (sur données de test), T-CON-01 à 05 (squelette) |
| **Risques** | R13 (divergence entre le faux et le vrai moteur) : la suite commune est livrée **avant** les deux moteurs. |
| **Livrable** | Schéma, contrat typé et suite de conformité, mis à disposition d'Yvan pour P2. |
| **Porte → BM2** | Schéma relu ; `contract.ts` relu par Yvan. |

### BM2 — Import FR et contrôle qualité

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet |
| **Objectifs** | Importer les 300 + 62 entrées FR sans perte, relier A ↔ B et produire les rapports de qualité. |
| **Tâches** | BM2.1 `import-sources` (exécuté une seule fois) : D4 → `data/financial-corpus/*.json`, D5 → `data/safinum-test-pages/*.json`. Il conserve les ID, les sections, la sensibilité et les variables. Il remplace « EtonFin » par FinEthnic (Q10) et utilise le code de langue `eto` (C14). BM2.2 Liens A ↔ B : 19 `corpusRef`, 34 libellés propres aux pages, 7 `templateRefs` (PROJECT_CONTEXT §3.6-1). P1-002 devient le gabarit `Bonjour, {prénom}` et P2-004 le gabarit `Compte {marque}`. BM2.3 Entrées protégées `GUARD` (`disposition = PROTECTED`) : `Safinum`, `Safinum Pay`, `FCFA`, `XAF`. BM2.4 `check-duplicates` (§8) → `data/exports/markdown/duplicates.md`. Le rapport couvre les doublons stricts, normalisés et potentiels, les phrases incluses dans un paragraphe (MSG-017 dans P2-002) et les paires opposées. BM2.5 Export minimal des fiches L1 (CSV), pour ne pas retarder la piste L. |
| **Fichiers** | `scripts/import-sources.*`, `scripts/check-duplicates.*`, `data/financial-corpus/*`, `data/safinum-test-pages/*`, `data/exports/markdown/duplicates.md`, `tests/language/import.test.*`, `tests/language/duplicates.test.*` |
| **Dépendances** | BM1 ; D4 et D5 (Q11 : versionnés dans `docs/sources/`) |
| **Critères d'acceptation** | Import sans perte (300 + 62). Rapport de doublons produit **sans aucune suppression ni fusion**. `validate-data` au vert. Le lexique d'exécution ne contient encore **aucune** cible Éton, ce qui est normal (0 validée). |
| **Tests** | T-LIB-01 à 03, T-LIB-09 |
| **Risques** | Tableaux Markdown irréguliers (cellules contenant `\|` ou des accolades) : comparer le nombre de lignes par section avec D4 et D5. |
| **Livrable** | Bibliothèque FR structurée et rapport de qualité. |
| **Porte → BM4 / BM5** | Rapport de doublons revu et arbitré par le responsable. |

### BM3 — Ressource dictionnaire (⏸ en attente du téléversement de D7)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet |
| **Objectifs** | Exploiter le dictionnaire éton–français comme **ressource de proposition et de justification**, sans jamais en faire une source de traduction automatique (PROJECT_CONTEXT §3.7.4). |
| **Tâches** | BM3.1 Recevoir D7 et trancher Q17 (format, licence). BM3.2 `data/language-resources/README.md` (provenance, licence, procédure) ; `raw/` exclu par `.gitignore`. BM3.3 `import-dictionary` : extraction vers un fichier intermédiaire **hors Git**. Contrôles : normalisation NFC, liste blanche de caractères, rejet de U+FFFD et du mojibake. Le script produit un rapport des formes suspectes (ε/ɛ, ɔ, ŋ, tons). BM3.4 Vérification manuelle d'un échantillon d'au moins 30 formes contre l'original. BM3.5 Recherche de formes candidates pour les entrées prioritaires (L1/L2), enregistrées dans `dictionaryEvidence` (forme, glose, référence). Le script **n'écrit jamais** `target.eto.text` ni `translationStatus` : ce choix revient aux locutrices. BM3.6 Citations versionnées dans `data/language-resources/citations/`. |
| **Fichiers** | `scripts/import-dictionary.*`, `data/language-resources/README.md`, `data/language-resources/citations/*`, `.gitignore`, `tests/language/dictionary.test.*` |
| **Dépendances** | Téléversement de D7 ; Q17. **Ne bloque ni BM4, ni BM5, ni L1/L2.** D5 §6.6 prévoit que les locutrices proposent d'abord et que le dictionnaire sert de comparaison. |
| **Critères d'acceptation** | Aucun fichier brut suivi par Git. 100 % des formes citées sont en NFC, conformes à la liste blanche et accompagnées d'une référence. L'échantillon manuel ne montre aucune erreur de ton ou de caractère, ou les erreurs sont documentées. |
| **Tests** | T-DIC-01 à 05 |
| **Risques** | R10, R15. Si le PDF est scanné, l'OCR est peu fiable sur les tons : préférer la saisie manuelle des seules formes utiles. |
| **Livrable** | Justifications lexicales traçables, jointes aux fiches de relecture. |
| **Porte** | Rapport d'extraction revu par le responsable. |

### BM4 — Outils de validation et exports de relecture

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet |
| **Objectifs** | Faire circuler les entrées vers les locutrices et réintégrer leurs décisions **dans le JSON**, sans seconde source de vérité (D6 §5). |
| **Tâches** | BM4.1 `export-review` : fiches Markdown et CSV conformes à la fiche D5 §6.5, par lot de priorité (①②③). Les CSV sont en UTF-8 avec BOM, avec un séparateur fixé. Chaque fiche porte le contexte d'écran et, si elle est disponible, la justification `dictionaryEvidence`. BM4.2 `import-review` : lecture du CSV relu, puis **rapport de différences**, puis application seulement sur confirmation (`--apply`). Règles d'import :<br>• `id` et source immuables ;<br>• code relecteur (`LOC-xx`) et date obligatoires ;<br>• transitions de statut autorisées seulement ;<br>• chaque décision est ajoutée à `reviews[]`.<br>BM4.3 Machine d'états des statuts (D5 + `validation`), documentée dans `docs/validation-linguistique.md`. BM4.4 Rapport de couverture : nombre d'entrées par page et par statut du contrat. |
| **Fichiers** | `scripts/export-review.*`, `scripts/import-review.*`, `data/schemas/review-import.schema.json`, `data/exports/markdown/*`, `data/exports/csv/*`, `docs/validation-linguistique.md`, `tests/language/review.test.*` |
| **Dépendances** | BM2 |
| **Critères d'acceptation** | Un aller-retour sans modification donne un diff vide. Toute ligne invalide est refusée avec un motif. Aucune écriture partielle silencieuse. |
| **Tests** | T-REV-01 à 06 |
| **Risques** | R17 (corruption des CSV par un tableur). |
| **Livrable** | Chaîne de relecture opérationnelle pour la piste L. |
| **Porte → imports L2** | Un aller-retour complet testé avec une feuille fictive. |

### BM5 — Moteur local de correspondance

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet |
| **Objectifs** | Implémenter `TranslationEngine` conformément au contrat : pur, déterministe, sans DOM, avec les 6 statuts. |
| **Tâches** | BM5.1 **Normaliseur** (comparaison uniquement) : NFC ; espaces, U+00A0 et U+202F réduits à une espace ; apostrophes `’` et `'` unifiées ; ponctuation finale (`:` `.`) détachée puis **réattachée telle quelle**. **Jamais** de suppression d'accents ; casse respectée, sauf variante approuvée. BM5.2 **Matcher**, dans l'ordre du contrat §5.3 :<br>• exact ;<br>• normalisé ;<br>• variantes approuvées ;<br>• gabarits à **variables typées** (`{montant}` doit satisfaire le motif « montant », `{devise}` ∈ {FCFA, XAF}, `{référence}` le motif « référence », etc.) ;<br>• « libellé connu + séparateur + valeur protégée » (`Frais : 0 FCFA`).<br>**Pas de similarité floue.** BM5.3 Départage par `context.role` et `context.step`, sinon `AMBIGUOUS`. Mode `'auto'` (Q16 ✅). BM5.4 Détection des valeurs protégées par **injection** de `detectProtected` (Q14). En attendant `src/protection/patterns.ts`, une implémentation de test est utilisée. BM5.5 Conversion des statuts de la bibliothèque en statuts du contrat (§5.2). L'unité de traduction est canonique (`corpusRef`). BM5.6 **`build-lexicon`** : `data/` → `src/language/lexicon.json`. Le lexique contient toutes les sources connues et leur statut, mais une **cible seulement si elle est approuvée** (C7, I6). Le build échoue en cas de contradiction (§8.4), de variables incohérentes ou de cible `⟦TEST⟧` en production. BM5.7 `createEngine()`, `info()`, `translateMany()` et cache borné (I11). |
| **Fichiers** | `src/language/*.ts`, `scripts/build-lexicon.*`, `tests/language/normalizer.test.*`, `tests/language/matcher.test.*`, `tests/language/lexicon-build.test.*`, `tests/contract/*` |
| **Dépendances** | BM1, BM2 ; Q14 et Q16 ✅ (2026-11-12). Les motifs d'Yvan (P3) sont nécessaires pour l'intégration finale, pas pour le développement. |
| **Critères d'acceptation** | Suite de conformité **verte** sur le vrai moteur. Invariants I1 à I11 testés. Le lexique d'exécution réel ne contient **aucune** cible tant qu'aucune entrée n'est approuvée, ce qui est normal. |
| **Tests** | T-ENG-01 à 09, T-LIB-04 à 08, T-LIB-10, T-CON-01 à 05 |
| **Risques** | R13, R14, R18 |
| **Livrable** | Moteur testé sous Node et documenté (section « Bibliothèque et moteur » du README). |
| **Porte → BM7** | T-ENG et T-CON au vert. Version initiale du matcher présentée en S2. |

### BM6 — Sources anglaises (ampleur selon Q15)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet |
| **Objectifs** | Ajouter les sources EN aux **mêmes identifiants** de concept, avec relecture de la correspondance FR↔EN. |
| **Tâches** | BM6.1 Arrêter la liste (Q15 ; recommandation (b) : libellés des pages + entrées SEC critiques). BM6.2 Saisir `source.en` avec `origin` et `mappingReview`. BM6.3 Liste des faux amis FR/EN (ex. EN « Balance » = FR « Solde ») et tests du mode `'auto'`. BM6.4 `build-lexicon` n'embarque une source EN que si `mappingReview` est validé. |
| **Fichiers** | `data/financial-corpus/*`, `data/safinum-test-pages/*`, `tests/language/auto-lang.test.*` |
| **Dépendances** | BM5, Q15, Q16 |
| **Critères d'acceptation** | Chaque source EN embarquée a une correspondance relue. En mode `'auto'`, un conflit FR/EN non résolu donne toujours `AMBIGUOUS`. |
| **Tests** | T-ENG-07, T-LIB-11 |
| **Risques** | R16 |
| **Livrable** | Bibliothèque FR/EN → Éton sur le périmètre retenu. |

### BM7 — Livraison et intégration (Synchronisation 3)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Responsable du projet, avec Yvan |
| **Objectifs** | Remplacer le faux moteur par le vrai, **sans réécriture** de l'extension (D6 §3). |
| **Tâches** | BM7.1 Versionner (`CONTRACT_VERSION`, `libraryVersion`) et documenter la livraison (README, historique du contrat §13). BM7.2 PR commune : `engine-provider.ts` appelle le `createEngine()` réel, avec le `detectProtected` d'Yvan injecté. BM7.3 Suite de conformité exécutée sur les deux moteurs. BM7.4 Vérifier les compteurs par statut dans le popup et la protection : les `protectedSegments` sont revérifiés par `integrity`. BM7.5 Ensuite, chaque import L2/L3 produit une nouvelle `libraryVersion`, reconstruite et retestée. |
| **Fichiers** | `src/content/engine-provider.ts`, `README.md`, `INTEGRATION_CONTRACT.md` §13 |
| **Dépendances** | BM5 ; P5 (sur le faux moteur) |
| **Critères d'acceptation** | La PR de branchement ne modifie que `engine-provider.ts` et la configuration de build. T-CON au vert sur les deux moteurs. T-TRA au vert avec le vrai moteur et un lexique de test. Aucun `⟦FAKE⟧` dans le build de production. |
| **Tests** | T-CON-01 à 07, T-TRA-01 à 08 |
| **Risques** | R13, R18 |
| **Livrable** | Extension branchée sur le vrai moteur (S3). |
| **Porte → P6** | S3 tenue : chargement de la bibliothèque, correspondances, statuts et protection vérifiés ensemble. |

---

## PHASE 5 — Remplacement, restauration et branchement du moteur (première écriture dans la page)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Yvan (piste EXT) |
| **Objectifs** | Écrire dans la page **uniquement** les résultats `APPROVED` du moteur, de façon réversible, sans boucle et sans altérer la structure. Le faux moteur sert d'abord ; le vrai moteur est branché en S3 (BM7). Le moteur ne touche jamais au DOM (C6). |
| **Tâches** | 5.1 `renderer.apply(node, result)` : modifier **uniquement `Text.data`** et mémoriser l'original dans une `WeakMap`. Pas d'`innerHTML`, pas d'ajout ni de suppression de nœud, pas d'attribut fonctionnel. 5.2 `renderer.restore()` : rétablit l'original **seulement si** le nœud contient encore notre écriture ; sinon l'application l'a changé et on n'y touche pas. 5.3 **Anti-boucle** : on ignore les mutations dont la valeur est égale à notre dernière écriture (`WeakMap`), et on ne retraduit jamais un texte déjà en Éton. 5.4 **Réécriture par l'application** (React, Vue…) : si un nœud traduit reçoit une nouvelle valeur FR, on met à jour l'original et on réévalue. 5.5 **Mode d'affichage** selon Q3 : le français reste accessible (infobulle en *shadow DOM* isolé, ou mode bilingue) ; `lang="eto"` (ISO 639-3) seulement si l'élément est entièrement traduit, à confirmer pour l'impact sur les lecteurs d'écran. 5.6 **Statuts non affichables** (`KNOWN_UNTRANSLATED`, `PENDING_VALIDATION`, `NO_MATCH`, `AMBIGUOUS`) : texte conservé en FR, compté **par statut**, surligné en mode diagnostic et listé dans le popup (« N textes restent à traduire »), sans contenu journalisé. `PROTECTED` : aucune action. 5.7 **Rendu des diacritiques** : vérifier les glyphes et, si besoin, ajouter une police libre (OFL) appliquée uniquement aux nœuds traduits. 5.8 Brancher `integrity` avant chaque écriture et sur chaque lot, en revérifiant les `protectedSegments` renvoyés par le moteur. 5.9 Consommer `TranslationResult` **sans post-traitement** de `output` (contrat §2-3) et vérifier `engine.info().contractVersion` au démarrage. |
| **Fichiers** | `src/content/renderer.*`, `src/content/index.*`, `src/content/observer.*`, `src/popup/*`, `tests/extension/renderer.test.*`, `tests/e2e/translate.spec.*` |
| **Dépendances** | P3, faux moteur (P2), Q3. Vrai moteur à partir de S3 (BM7). Au moins quelques entrées validées (L2) pour la vérification réelle ; sinon, uniquement des cibles de test. |
| **Critères d'acceptation** | Seuls les résultats `APPROVED` sont affichés. Après désactivation, le DOM est **identique** à l'état initial (empreinte). Aucune boucle : nombre de mutations stable après 5 s d'inactivité. Les formulaires, boutons et calculs fonctionnent à l'identique. |
| **Tests** | T-TRA-01 à 08, T-NAV-04 et 05. |
| **Risques** | Texte réparti sur plusieurs nœuds (ex. `Votre transfert de <b>25 000 FCFA</b>…`) : ce cas est hors MVP. Par défaut on le laisse en FR, puis traitement par gabarit au niveau de l'élément si le temps le permet. Allongement des libellés en Éton (troncature) : à vérifier en P6. |
| **Livrable** | Traduction fonctionnelle et réversible. |
| **Porte → S3** | T-TRA et T-NAV-04/05 au vert sur fixtures avec le faux moteur. Démonstration courte devant le responsable. |

---

## PHASE 6 — Intégration au parcours SAFINUM (5 étapes)

| Rubrique | Contenu |
|---|---|
| **Responsable** | Commun (= **S4**) : Yvan conduit les tests de l'extension ; le responsable vérifie les correspondances, les statuts et les textes inconnus, puis met à jour la bibliothèque (réimport contrôlé). |
| **Objectifs** | Valider le comportement sur l'environnement réel, étape par étape, puis sur le parcours complet. |
| **Tâches** | 6.1 Étape 1 : solde, numéro de compte, transactions (signes, dates). 6.2 Étape 2 : changer le type et le montant, puis vérifier que les frais, le total et le solde après opération restent **identiques** avec et sans l'extension. 6.3 Étape 3 : saisir des données fictives (dont une note contenant un mot du lexique, ex. « Facture ») et vérifier qu'aucune saisie n'est traduite. 6.4 Étape 4 : **point de contrôle d'intégrité**. Comparer chaque valeur avec les étapes 1 à 3 ; la case à cocher et le bouton « Confirmer le transfert » restent fonctionnels. 6.5 Étape 5 : reçu identique ; un message de succès n'est affiché que si la page affiche un succès. 6.6 Parcours complet, extension activée puis désactivée en cours de route. 6.7 Contrôle visuel : troncature, débordement, contraste, focus. 6.8 Tests e2e Playwright sur les fixtures ; sur le site réel si les conditions d'utilisation le permettent. |
| **Fichiers** | `tests/e2e/journey.spec.*`, `tests/fixtures/*`, `docs/test-report.md` |
| **Dépendances** | S3 (vrai moteur branché), environnement réel `https://safinum.cm/hackathon-test` (Q2 ✅), testé sur les postes de l'équipe, traductions L2 importées. |
| **Critères d'acceptation** | Les 5 étapes passent. **0 valeur protégée altérée** (comparaison automatique avant/après). Aucune régression fonctionnelle ou visuelle bloquante. |
| **Tests** | T-NAV-01 à 06, T-PRO-01 à 11 en conditions réelles. |
| **Risques** | Le site réel diffère des captures (libellés non relevés) : ajouter les entrées dans `data/` (BM2), **sans inventer** de traduction. |
| **Livrable** | Rapport de test du parcours complet. |
| **Porte → P7** | Rapport validé par toi. |

---

## PHASE 7 — Contenu inédit et robustesse

| Rubrique | Contenu |
|---|---|
| **Responsable** | Commun : Yvan (détection, charge) ; responsable (messages L3, statuts, textes proches) |
| **Objectifs** | Démontrer la détection, la traduction **si elle est validée**, et le refus prudent sinon, face à des injections du jury. |
| **Tâches** | 7.1 Écrire un **script d'injection** de démonstration (à coller dans la console DevTools, hors extension) : message de confirmation, avertissement, erreur, lot de 10 textes, texte inconnu, texte proche d'une entrée (« Votre **paiement** a été envoyé avec succès. »), message avec montant et référence dynamiques. 7.2 Vérifier la traduction des messages L3 pré-validés et des gabarits. 7.3 Vérifier que le texte proche **n'est pas** traduit. 7.4 Tester la charge : 500 nœuds injectés, en mesurant le temps de traitement. 7.5 Tester les injections dans `aria-live` et les boîtes de dialogue. |
| **Fichiers** | `tests/e2e/injection.spec.*`, `docs/demo/inject-samples.js`, `docs/test-report.md` |
| **Dépendances** | P6, L3 |
| **Critères d'acceptation** | 100 % des injections détectées. 0 traduction non validée. 0 altération de valeur. Lot de 500 nœuds traité en moins de 200 ms. |
| **Tests** | T-INE-01 à 08 |
| **Risques** | Le jury injecte un message que personne n'a anticipé : il reste en FR et est signalé, ce qui est assumé comme choix de sécurité (C5). |
| **Livrable** | Démonstration de robustesse reproductible. |
| **Porte → P8** | T-INE au vert. |

---

## PHASE 8 — Stabilisation et livrables de présélection

| Rubrique | Contenu |
|---|---|
| **Responsable** | Commun (= **S5**) : Yvan (extension, ZIP, README d'installation) ; responsable (note technique, méthode de validation, exports finaux) |
| **Objectifs** | Fournir une extension stable et installable, ainsi que **tous** les livrables de D2 §6. |
| **Tâches** | 8.1 Corriger les anomalies. 8.2 Audit d'accessibilité : popup au clavier, lecteur d'écran (NVDA ou ChromeVox), contrastes, `prefers-reduced-motion`. 8.3 Audit de performance. 8.4 Audit de sécurité : recherche de `fetch`, `XMLHttpRequest`, `WebSocket`, `eval` et `innerHTML` dans le bundle ; permissions ; CSP ; absence de données dans le stockage et les journaux. 8.5 Produire un ZIP de distribution et le **tester sur une machine vierge**. 8.6 README : installation, utilisation, tests. 8.7 **Note technique** : architecture, intégration, dépendances, limites connues (contenu non validé laissé en FR, textes multi-nœuds, etc.). 8.8 **Méthode de validation linguistique** : variété d'Obala, dictionnaire, nombre de locutrices, double relecture. 8.9 `THIRD_PARTY.md` final (bibliothèques, police, outils d'IA utilisés pour le développement). 8.10 Script de la **vidéo de 3 min maximum** et répétition de la démo. 8.11 Description succincte de la solution. |
| **Fichiers** | `README.md`, `docs/architecture.md`, `docs/note-technique.md`, `docs/validation-linguistique.md`, `THIRD_PARTY.md`, `docs/test-report.md`, `docs/demo/*` |
| **Critères d'acceptation** | Installation en moins de 2 min sur une machine vierge en suivant le README. Tous les tests au vert. Les 5 livrables D2 sont prêts. |
| **Livrable** | Dossier de soumission complet. |

---

## Piste linguistique L (parallèle, sans code)

**Responsable :** responsable du projet, avec les locutrices d'Obala.
- Les fiches sont générées depuis le JSON : export minimal en BM2, complet en BM4.
- Les retours sont réintégrés par `import-review` (réimport contrôlé, D6 §5).
- La piste **n'attend pas** le dictionnaire (D7) : les locutrices proposent d'abord (D5 §6.6), et les justifications de BM3 s'ajoutent quand elles sont prêtes.
- Les relecteurs sont identifiés par un code (`LOC-xx`) ; aucun nom n'est versionné.

| Étape | Contenu | Sortie | Critère |
|---|---|---|---|
| **L1** | Fiches D5 §6.5 pour les **53 libellés uniques** des 5 pages, avec contexte d'écran | Feuille de relecture | Fiches envoyées aux locutrices |
| **L2** | Validation par ordre de priorité : ① actions critiques (Confirmer le transfert, Continuer, Retour, Modifier, Montant à envoyer, Total à débiter, Total débité) ② avertissements (P1-015, P3-002, P3-003, P4-002, P3-009, P4-010) ③ autres libellés | Entrées `VALIDATED_OBALA` + sens financier validé | Au moins les ①② validés avant S4 (P6) |
| **L3** | Messages probables du jury : D5 §6.4 (15 phrases), MSG-059 à 072 (erreurs système), SEC-041 à 060 (alertes), MSG-047, 053, 054 (statuts) | Gabarits et phrases validés | Liste arrêtée avec toi |
| **L4** | Deuxième relecture des phrases critiques (D5 §6.6 point 8) | Validation croisée tracée | Toutes les phrases critiques affichées sont relues deux fois (Q18) |

> **Règle absolue :** je ne propose **aucune** forme Éton. Mon rôle se limite à l'outillage (fiches, import, contrôles de cohérence : variables, tons, NFC).

---

## 8. Méthode de contrôle des doublons (corpus et pages)

### 8.1 Les quatre niveaux
| Niveau | Détection | Action |
|---|---|---|
| **1. Strict** | Égalité exacte de `source` | Rapport, puis lien `relatedTo` et traduction partagée **proposée** |
| **2. Après normalisation** | Égalité après NFC, casse, espaces et ponctuation finale | Rapport, avec proposition de `sourceVariants` |
| **3. Potentiel (même sens)** | Inclusion de chaînes, mots communs ≥ 80 %, même catégorie (heuristique, **jamais décisionnelle**) | Rapport avec explication sémantique, **décision humaine** |
| **4. Proche mais distinct** | Liste de **paires d'opposition** maintenue à la main (Débit/Crédit, Envoyer/Recevoir, Confirmer/Annuler, Bloquer/Débloquer, Montant envoyé/reçu, Bénéficiaire/Expéditeur, Solde disponible/comptable, En attente/Réussi, Refusé/Annulé…) | Marquage `distinctFrom`. Le build **échoue** si deux entrées opposées partagent la même cible Éton. |

### 8.2 Règles
- Aucune suppression ni fusion automatique. Les ID sont stables et jamais réattribués.
- Une entrée retirée est marquée `deprecated` avec `replacedBy`, mais elle n'est pas effacée.
- Le rapport `data/exports/markdown/duplicates.md` est régénéré à chaque build et **revu par le responsable** avant toute fusion.

### 8.3 Constats initiaux
Voir PROJECT_CONTEXT §3.2, §3.3 et §3.4 : 2 doublons stricts internes, 19 correspondances pages ↔ corpus, 7 quasi-doublons et des paires distinctes à préserver.

### 8.4 Tests de non-contradiction
- Une source normalisée ne peut avoir **qu'une seule** cible validée, sauf si une règle `context` explicite les distingue ; sinon le build échoue.
- Deux entrées `distinctFrom` ne peuvent pas avoir la même cible.
- Les variables `{…}` de la cible doivent être identiques à celles de la source.

---

## 9. Catalogue de tests

Chaque test est rattaché à une phase. Les colonnes **Obtenu** et **Statut** seront remplies dans `docs/test-report.md`. Toutes les données sont **fictives** et viennent des captures.

| ID | Scénario | Données | Résultat attendu | Obtenu | Statut |
|---|---|---|---|---|---|
| T-INS-01 | Charger l'extension non empaquetée | `dist/` | Chargée, sans erreur | — | À faire |
| T-INS-02 | Reconnaissance | `chrome://extensions` | Nom, version, permissions minimales | — | À faire |
| T-INS-03 | Ouverture du popup | Clic, puis clavier | Popup lisible, focus visible | — | À faire |
| T-INS-04 | Activer/désactiver | Interrupteur | État persistant, appliqué sans rechargement | — | À faire |
| T-INS-05 | Aucun réseau | Onglet Réseau des DevTools | 0 requête émise par l'extension | — | À faire |
| T-DET-01 | Texte au chargement | Fixture étape 1 | Les 17 libellés P1 détectés | — | À faire |
| T-DET-02 | Texte ajouté après chargement | Injection de 1 `<p>` | Détecté en moins de 100 ms | — | À faire |
| T-DET-03 | Injection multiple | 50 nœuds | Un seul lot, tous détectés | — | À faire |
| T-DET-04 | Éléments exclus | `input`, `textarea`, `select`, `contenteditable`, `script` | Non détectés | — | À faire |
| T-DET-05 | Changement d'étape (SPA) | Clic « Continuer » | Nouvelle étape scannée | — | À faire |
| T-DET-06 | Modification d'un texte existant | `characterData` | Réévalué | — | À faire |
| T-PRO-01 | Montant | `250 000 FCFA` | Inchangé (octet par octet) | — | À faire |
| T-PRO-02 | Montant | `25 000 FCFA` | Inchangé | — | À faire |
| T-PRO-03 | Zéro | `0 FCFA` | Inchangé | — | À faire |
| T-PRO-04 | Signes | `+180 000 FCFA`, `-12 500 FCFA`, `−12 500 FCFA` | Signes et espaces (y compris insécables) intacts | — | À faire |
| T-PRO-05 | Nom de bénéficiaire | `Jean-Paul Mbarga` (cellule valeur) | Inchangé | — | À faire |
| T-PRO-06 | Nom du titulaire | `Bonjour, Amina` / `Amina Ngo Bell` | Prénom ou nom inchangé, même si la salutation est traduite | — | À faire |
| T-PRO-07 | Téléphone | `+237 6 99 12 34 56` | Inchangé | — | À faire |
| T-PRO-08 | Compte | `CM 001 2345 6789 01` | Inchangé | — | À faire |
| T-PRO-09 | Référence | `SAF-2026-OTCUQ3` | Inchangée | — | À faire |
| T-PRO-10 | Date | `05 nov. 2026` | Inchangée | — | À faire |
| T-PRO-11 | Valeurs saisies | Note « Facture », motif « Paiement de services » | `value` et réaffichage à l'étape 4 inchangés | — | À faire |
| T-PRO-12 | Lecture seule (P2) | Toutes les fixtures | Empreinte du DOM identique | — | À faire |
| T-PRO-13 | Refus d'écriture | Cible de test altérant un jeton | Écriture refusée, retour arrière | — | À faire |
| T-PRO-14 | Marque (v0.2) | `Compte Safinum`, `Safinum Pay — environnement…` | `Safinum` / `Safinum Pay` inchangés | — | À faire |
| T-LIB-01 | Import sans perte | D4 + D5 | 300 + 62 entrées, ID intacts | — | À faire |
| T-LIB-02 | Doublons stricts | Corpus | VOC-078/MSG-025 et ACT-055/MSG-056 signalés | — | À faire |
| T-LIB-03 | Liens A↔B | Pages | 19 `corpusRef` corrects | — | À faire |
| T-LIB-04 | Contradiction | 2 cibles validées pour une même source | Build en échec | — | À faire |
| T-LIB-05 | Paires opposées | Confirmer/Annuler avec la même cible | Build en échec | — | À faire |
| T-LIB-06 | Variables | Cible sans `{montant}` | Build en échec | — | À faire |
| T-LIB-07 | Unicode | `mɔ̀ní` (NFD) | Stocké en NFC, diacritiques conservés | — | À faire |
| T-LIB-08 | Entrées de test | Cible `⟦TEST⟧` | Exclue du build de production | — | À faire |
| T-LIB-09 | Libellé ↔ gabarit (v0.2) | « Total débité » seul vs MSG-038 avec un libellé traduit différemment | Avertissement dans le rapport, build non bloqué | — | À faire |
| T-LIB-10 | Lexique d'exécution (C7, v0.4) | Entrée `REVIEW_PENDING` avec une proposition | Source présente avec son statut ; **cible absente** de `lexicon.json` | — | À faire |
| T-LIB-11 | Correspondance FR↔EN (v0.4) | `source.en` dont `mappingReview` n'est pas validé | Source EN non embarquée, donc non appariée | — | À faire |
| T-CON-01 | Un cas par statut (v0.4) | Table de conformité `tests/contract/` | Les 6 statuts obtenus, sur le faux puis le vrai moteur | — | À faire |
| T-CON-02 | Invariant I3 | Tous les cas | `output ≠ null` ⇔ `APPROVED` | — | À faire |
| T-CON-03 | Totalité (I2, I10) | Chaîne vide, 100 000 caractères, émojis, surrogates isolés | Aucune exception ; statut valide ; `too-long` au-delà de 2 000 caractères | — | À faire |
| T-CON-04 | Bords et valeurs (I4, I5) | `"  Frais : 0 FCFA "` (cible de test approuvée) | Espaces de bord et segments protégés identiques octet par octet | — | À faire |
| T-CON-05 | Déterminisme (I8) | Même requête deux fois, même `libraryVersion` | Résultats identiques | — | À faire |
| T-CON-06 | Faux moteur hors production | Build de production | Échec si `⟦FAKE⟧` ou `engineId: 'fake'` est présent | — | À faire |
| T-CON-07 | Version du contrat | `engine.info().contractVersion` ≠ version attendue par l'extension | Test en échec ; l'extension n'écrit rien | — | À faire |
| T-ENG-01 | Normalisation (v0.4) | `Frais` avec U+00A0 ou U+202F ; `’` vs `'` ; « Recu » vs « Reçu » | Même entrée pour les espaces et apostrophes ; « Recu » → `NO_MATCH` (accents jamais supprimés) | — | À faire |
| T-ENG-02 | Variables typées | Gabarit `{montant}` avec la valeur `abc` | `NO_MATCH` | — | À faire |
| T-ENG-03 | Libellé + valeur | `Frais : 0 FCFA` | `label-value`, `protectedSegments` = `["0", "FCFA"]` | — | À faire |
| T-ENG-04 | Ambiguïté | « Retour » avec deux entrées distinguées par `role` | Avec `role` : une entrée ; sans `role` : `AMBIGUOUS` (`context-required`) | — | À faire |
| T-ENG-05 | Correspondance des statuts | Une entrée de test par état de la bibliothèque (contrat §5.2) | Statut attendu pour chacune | — | À faire |
| T-ENG-06 | Unité de traduction | « Montant » (P4-003) | `entryId` = VOC-023 | — | À faire |
| T-ENG-07 | Mode `'auto'` (Q16) | Texte FR seul, EN seul, même entrée, entrées différentes avec ou sans `pageLang` | Règle du contrat §5.3 ; conflit non départagé → `AMBIGUOUS` (`multiple-languages`) | — | À faire |
| T-ENG-08 | Pureté (I1) | Analyse statique de `src/language/` | Aucune référence à `document`, `window`, `chrome`, `fetch`, au stockage ni à `console` | — | À faire |
| T-ENG-09 | Performance (I9) | Lexique de 1 000 entrées de test | Médiane ≤ 0,2 ms par appel | — | À faire |
| T-DIC-01 | NFC (v0.4) | Formes saisies en NFD | Stockées en NFC, diacritiques intacts | — | À faire |
| T-DIC-02 | Jeu de caractères | ε grec (U+03B5), U+FFFD, `Ã©` | Refusés avec un motif (suggestion : ɛ U+025B) | — | À faire |
| T-DIC-03 | Fichier brut hors Git | `git ls-files data/language-resources/raw` | Résultat vide ; règle présente dans `.gitignore` | — | À faire |
| T-DIC-04 | Référence obligatoire | `dictionaryEvidence` sans `ref` | `validate-data` en échec | — | À faire |
| T-DIC-05 | Pas de cible automatique | Exécution de `import-dictionary` | `target.eto.text` et `translationStatus` inchangés | — | À faire |
| T-REV-01 | Encodage CSV (v0.4) | Export contenant `mɔ̀ní` | UTF-8 avec BOM, diacritiques intacts après ouverture dans un tableur | — | À faire |
| T-REV-02 | Aller-retour neutre | Export puis import sans modification | Diff vide, aucune écriture | — | À faire |
| T-REV-03 | Champs immuables | `id` ou source modifiés dans le CSV | Ligne refusée avec un motif | — | À faire |
| T-REV-04 | Traçabilité | Code relecteur ou date absent | Ligne refusée | — | À faire |
| T-REV-05 | Transition interdite | `TRANSLATION_PENDING` → `VALIDATED_OBALA` sans proposition | Ligne refusée | — | À faire |
| T-REV-06 | Diff avant application | Import sans `--apply` | Rapport de différences seulement, `data/` inchangé | — | À faire |
| T-TRA-01 | Traduction validée | Entrée de test validée | Texte remplacé | — | À faire |
| T-TRA-02 | Sans traduction | `KNOWN_UNTRANSLATED` | FR conservé et compté « à traduire » | — | À faire |
| T-TRA-03 | Non validée | `PENDING_VALIDATION` (`REVIEW_PENDING` dans `data/`) | FR conservé, compté « en validation » | — | À faire |
| T-TRA-04 | Variables | `Votre transfert de 25 000 FCFA vers Jean-Paul Mbarga a été effectué.` | Valeurs réinjectées à l'identique | — | À faire |
| T-TRA-05 | Phrase proche | `Votre paiement a été envoyé avec succès.` | **Non traduite** | — | À faire |
| T-TRA-06 | Libellé composé | `Frais : 0 FCFA` | Libellé traduit, `: 0 FCFA` intact | — | À faire |
| T-TRA-07 | Anti-boucle | Traduction, puis 5 s d'inactivité | 0 mutation parasite | — | À faire |
| T-TRA-08 | Réécriture par l'application | Le framework remet le FR | Retraduit sans boucle | — | À faire |
| T-NAV-01…05 | Étapes 1 à 5 | Parcours réel | Libellés validés traduits, valeurs identiques | — | À faire |
| T-NAV-06 | Parcours complet + désactivation en cours | Parcours réel | Fonctionnel ; FR restauré à l'identique | — | À faire |
| T-INE-01 | Nouveau message validé | Injection | Traduit | — | À faire |
| T-INE-02 | Confirmation | Injection | Traduit si validé, sinon FR et signalé | — | À faire |
| T-INE-03 | Avertissement | `Ne communiquez jamais votre code PIN à personne.` | Force conservée, ou FR | — | À faire |
| T-INE-04 | Erreur | `Solde insuffisant pour effectuer cette opération.` | Idem | — | À faire |
| T-INE-05 | Lot | 10 messages | Tous traités | — | À faire |
| T-INE-06 | Inconnu | Phrase libre | FR et signalé | — | À faire |
| T-INE-07 | Donnée dynamique | Message avec montant et référence | Valeurs intactes | — | À faire |
| T-INE-08 | Charge | 500 nœuds | Moins de 200 ms, aucun gel | — | À faire |

---

## 10. Registre des risques

| ID | Risque | Probabilité | Impact | Atténuation |
|---|---|---|---|---|
| R1 | **Aucune traduction validée à temps** | Élevée | Critique | Piste L dès J0, priorisation ①②, périmètre honnête dans la démo |
| R2 | Structure DOM réelle inconnue (iframes, *shadow DOM*, balisage libellé/valeur) ; environnement inaccessible depuis Copilot | Moyenne | Élevé | URL connue (Q2 ✅). Inspection par Yvan au début de P2 (Q20). Fixtures reconstruites depuis D5 puis ajustées |
| R3 | Altération d'une valeur (défaut majeur, exclusion possible) | Faible | Critique | Liste blanche, contexte DOM, intégrité avec retour arrière, tests T-PRO |
| R4 | Faux positif sur une donnée saisie identique à un libellé | Moyenne | Élevé | Règle libellé/valeur (3.3), test T-PRO-11 |
| R5 | Conflit avec le framework de la page (React/Vue) | Moyenne | Élevé | `Text.data` uniquement, réévaluation, T-TRA-08 |
| R6 | Boucle de MutationObserver ou lenteur | Moyenne | Moyen | Anti-boucle, regroupement, budget, T-TRA-07, T-INE-08 |
| R7 | Diacritiques mal rendus | Moyenne | Moyen | Vérification visuelle, police OFL de secours |
| R8 | Texte réparti sur plusieurs nœuds non traduit | Élevée | Faible | Laissé en FR (sûr), amélioration optionnelle |
| R9 | Barème ambigu (C1) | — | Faible | Couvrir l'union des deux barèmes |
| R10 | Licence du dictionnaire | Moyenne | Moyen | Fichier brut hors Git, formes citées avec référence seulement (Q17) ; vérifier avant publication (Q11) |
| R11 | Délai inconnu (Q1) ; le 14/11/2026 a été évoqué | Moyenne | Critique | Périmètre MVP strict (§0.2) ; plan court prêt (§0.1.1) ; S1 tenue sans attendre la confirmation |
| R12 | Public cible ne lisant pas l'Éton écrit (tons) — v0.2 | Moyenne | Moyen | Mode bilingue ; audio local enregistré par les locutrices après le MVP (Q13) ; argument à présenter au jury |
| R13 | Divergence entre le faux et le vrai moteur — v0.4 | Moyenne | Élevé | Suite `tests/contract/` commune, livrée en BM1 avant les deux moteurs ; procédure de changement du contrat (§10) |
| R14 | Logique de protection dupliquée entre moteur et extension | Moyenne | Élevé | Q14 : un module unique injecté dans le moteur ; cas communs tirés de D5 §4 |
| R15 | Extraction du dictionnaire de mauvaise qualité (tons, ɛ/ε, OCR) | Élevée | Moyen | NFC, liste blanche, rejet de U+FFFD, échantillon manuel, T-DIC ; dictionnaire hors du chemin critique |
| R16 | Aucun corpus EN disponible | Certaine | Moyen | Q15 ; schéma prêt dès BM1 ; BM6 limitée aux libellés des pages et aux SEC critiques |
| R17 | CSV de relecture corrompus (tableur, encodage, séparateur) | Moyenne | Élevé | UTF-8 avec BOM, séparateur fixé, réimport contrôlé avec diff, T-REV |
| R18 | Cible non approuvée transmise à l'extension | Faible | Critique | `build-lexicon` retire les cibles non approuvées (I6) ; T-LIB-10, T-CON-02 ; faux moteur absent de la production (T-CON-06) |
| R19 | Conflits sur les fichiers partagés (`package.json`, build) | Moyenne | Faible | Q19 ✅ : création unique en P1.1 par Yvan, PR relue, `CODEOWNERS` (`@M-Riq`, `@ivan-14-dev`) ; dossiers séparés par périmètre (D6 §3) |

---

## 11. Matrice de traçabilité des exigences

| Exigence | Source | Phase | Tests |
|---|---|---|---|
| Adaptation linguistique de l'interface | D2 §4.1 | BM5, P5, L | T-TRA-01, T-NAV |
| Parcours financier en 5 étapes | D2 §4.2, D3 §1 | P6 | T-NAV-01…06 |
| Préservation des informations financières | D2 §4.3, D3 §2, D1 §5 | P3 | T-PRO-01…13 |
| Fonctionnement sans modification du site ni hook | D2 §4.4, D3 §2, §7 | P2, P5 | T-PRO-12, T-NAV |
| Contenu inédit détecté sans rechargement | D2 §4.5, D3 §2, D1 §4 | P2, P7 | T-DET-02/03, T-INE |
| Aucune traduction inventée | D1 §3.1, D3 §5 (critère 2), D5 §1, D6 §9 | BM5, P5 | T-TRA-02/03/05, T-LIB-08, T-LIB-10, T-CON-02, T-DIC-05 |
| Alertes non affaiblies | D3 §4, D4 §3 | L, BM4 | Revue L4, T-INE-03 |
| Activation/désactivation + restauration | D1 §2.1 (7) | P1, P5 | T-INS-04, T-NAV-06 |
| Accessibilité (clavier, contraste, lecteur d'écran) | D3 §2, §5 | P1, P8 | Audit 8.2 |
| Aucune collecte ni transmission | D2 §9, D3 §3, D1 §6 | P1, P8 | T-INS-05, audit 8.4 |
| Moindre privilège | D1 §6 | P1 | Instantané du manifest |
| Déclaration des composants et outils | D2 §5, §9, D3 §3 | P1, P8 | `THIRD_PARTY.md` |
| Livrables (description, vidéo ≤ 3 min, note technique, langue + méthode) | D2 §6 | P8 | Liste de contrôle 8.x |
| Doublons détectés, jamais fusionnés automatiquement | D1 §8, D6 §2 | BM2 | T-LIB-02…05 |
| Traçabilité A ↔ B | D1 §3.2 | BM2 | T-LIB-03 |
| Développement parallèle avec faux moteur (v0.4) | D6 §3 | P2, BM1, S2 | T-CON-01…05 |
| Contrat d'intégration : langues, contexte, 6 états de résultat | D6 §4 | BM1, BM5, P5 | T-CON, T-ENG-05 |
| Langues sources FR et EN | D6 §4 | BM1, BM6 | T-ENG-07, T-LIB-11 |
| Bibliothèque et moteur testables sans Chrome | D6 §2, §3 | BM1–BM5 | `tests/language/` sous Node |
| JSON source de vérité ; exports MD/CSV ; réintégration contrôlée | D6 §5 | BM4 | T-REV-01…06 |
| Gestion des variantes et des statuts de validation | D6 §2 | BM1, BM4 | T-ENG-05, T-REV-05 |
| Modifications incompatibles documentées | D6 §8 | Toutes | `INTEGRATION_CONTRACT.md` §10 et §13 |
| Aucun secret ni donnée réelle dans Git | D6 §6, §9 | Toutes | Revue de PR, T-DIC-03 |

---

## 12. Journal des décisions

| Date | Décision | Statut |
|---|---|---|
| 2026-11-12 | Roadmap v0.1 proposée | En attente de validation |
| 2026-11-12 | Roadmap v0.2 : revérification, compléments PROJECT_CONTEXT §3.6, Q8 élargie, Q13, T-PRO-14, T-LIB-09, R12 | En attente de validation |
| 2026-11-12 | **Q3** : mode (a) Éton à la place du français, français au survol ou au focus, bascule bilingue dans le popup | ✅ Décidé par le responsable |
| 2026-11-12 | **Q4** : TypeScript + esbuild, Vitest, Playwright | ✅ Décidé par le responsable |
| 2026-11-12 | **Q5** : JSON `data/` = source de vérité ; Markdown/CSV de relecture générés | ✅ Décidé par le responsable |
| 2026-11-12 | Revérification automatique sur les fichiers téléversés : 300 ID (VOC 100 / ACT 60 / SEC 60 / MSG 80), 2 doublons stricts, 62 occurrences, 53 libellés uniques, 19 correspondances. Les chiffres v0.1/v0.2 sont confirmés. | Constat |
| 2026-11-12 | **Q10** : FinEthnic = le projet ; SAFINUM Éton = son premier prototype | ✅ Tranché par D6 |
| 2026-11-12 | Roadmap v0.4 : alignement sur `TEAM_WORKFLOW.md` (D6). Pistes EXT/BM/L et S1–S5 ; la piste BM (BM1–BM7) remplace P4 ; P5 renommée ; arborescence D6 ; contrat d'intégration v0.1.0-draft ; tests T-CON, T-ENG, T-DIC, T-REV, T-LIB-10/11 ; risques R13–R19 ; questions Q14–Q19 | En attente de S1 |
| 2026-11-12 | **Q2** : environnement de test `https://safinum.cm/hackathon-test`, application monopage (URL constante) ; textes des 5 étapes = D5 ; fixtures reconstruites depuis D5. Manifest limité à `https://safinum.cm/hackathon-test*`. Nouvelle question **Q20** (structure réelle du DOM, tâche P2.0) | ✅ Décidé par le responsable |
| 2026-11-12 | **Q14** : `src/protection/patterns.ts` (Yvan), injecté dans le moteur via `createEngine({ detectProtected })` | ✅ Décidé par le responsable (relecture du contrat par Yvan en S1) |
| 2026-11-12 | **Q16** : `sourceLang: 'auto'` accepté, règle du contrat §5.3 | ✅ Décidé par le responsable (relecture du contrat par Yvan en S1) |
| 2026-11-12 | **Q19** : pas de branche `develop` ; fichiers partagés et `CODEOWNERS` créés par Yvan en P1.1 ; Yvan = `@ivan-14-dev`, relecteur obligatoire des PR `contract:` | ✅ Décidé par le responsable |
| 2026-11-12 | **Q1** : date limite à confirmer par les organisateurs (14/11/2026 évoqué). Non bloquante pour S1 ; plan court §0.1.1 ajouté | ⏳ En attente des organisateurs |
| 2026-11-12 | Roadmap v0.5 : enregistrement des décisions ci-dessus ; R2, R11 et R19 mis à jour | En attente de S1 |
