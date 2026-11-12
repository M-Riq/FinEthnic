# ROADMAP — SAFINUM Éton (extension Chrome, présélection SAFINUM Innovate 2026)

> **Statut :** v0.2 — proposition de la Phase 0, **en attente de validation** (v0.1 revérifiée ; compléments marqués « v0.2 »).
> **Référence fonctionnelle :** `PROJECT_CONTEXT.md` (documents D1–D5, conflits C1–C5, questions Q1–Q13).
> **Règle de passage :** une phase ne démarre que si la **porte** de la phase précédente est franchie. Seul le responsable du projet peut lever une porte.

---

## 0. Vue d'ensemble

```
            ┌──────────── Piste LOGICIELLE (Copilot + équipe) ─────────────┐
Phase 0 ──► P1 Init ──► P2 Scanner ──► P3 Protection ──► P5 Moteur ──► P6 Parcours 5 pages ──► P7 Inédit ──► P8 Démo
               │           (diagnostic)      ▲                ▲
               └──────────► P4 Bibliothèque ─┴────────────────┘   (P4 peut commencer dès P1 : elle ne dépend pas du DOM)

            ┌──────────── Piste LINGUISTIQUE (équipe + locutrices d'Obala) ─┐
            L1 Fiches 5 pages ──► L2 Validation prioritaire ──► L3 Messages probables du jury ──► L4 Double relecture critique
                                        │ (alimente P5/P6 au fil de l'eau via l'import validé)
```

**Chemin critique :**
1. Les phases P2, P3 et P5 doivent être terminées pour avoir un moteur sûr.
2. La phase L2 doit être terminée pour afficher de l'Éton dans la démo.
3. L'accès à l'environnement réel (Q2) est nécessaire avant P6.

**Pourquoi une piste linguistique séparée :** aucune traduction n'est validée aujourd'hui. Une extension parfaite avec une bibliothèque vide n'affiche que du français. Cette piste ne génère aucun code ; elle produit des **données validées**.

### 0.1 Calendrier indicatif (à recaler après Q1)
La date limite de soumission n'est pas connue. L'événement a lieu du 26 au 28/11/2026. Hypothèse de travail : **~10 jours ouvrés** à partir de la validation de la Phase 0.

| Jour | Piste logicielle | Piste linguistique |
|---|---|---|
| J0 | Validation de la Phase 0 | Choix des locutrices, envoi de la procédure D5 §6.6 |
| J1 | P1 Initialisation | L1 : fiches des 53 libellés uniques |
| J2–J3 | P2 Scanner + P3 Protection | L2 : validation des libellés des 5 pages (actions critiques d'abord) |
| J2–J4 | P4 Bibliothèque (en parallèle) | L2 (suite) |
| J5–J6 | P5 Moteur de traduction | L3 : messages probables du jury |
| J7 | P6 Parcours des 5 pages | Import des validations |
| J8 | P7 Contenu inédit | L4 : double relecture des phrases critiques |
| J9–J10 | P8 Stabilisation, README, note technique, vidéo | Rédaction de la méthode de validation (livrable) |

### 0.2 Périmètre minimal de démonstration (« MVP ») vs options
| Doit être présent (MVP) | Si le temps le permet |
|---|---|
| Activation/désactivation + restauration exacte | Mode bilingue (Éton + français) |
| Correspondance exacte + gabarits à variables typées | Libellés d'`<option>` (Q8) |
| Protection multicouche + contrôle d'intégrité avec retour arrière | Traversée des *shadow roots* ouverts |
| MutationObserver sans boucle | Textes répartis sur plusieurs nœuds (`Votre transfert de <b>…</b> a été…`) |
| Diagnostic (compteurs + surlignage) | Badge de compteur sur l'icône |
| 5 étapes testées + scénarios d'injection | Export du rapport « reste à traduire » |

---

## PHASE 0 — Analyse et cadrage ✅ (livrée, en attente de validation)

| Rubrique | Contenu |
|---|---|
| **Objectifs** | Comprendre les documents D1–D5, extraire les exigences, risques, conflits et questions, puis proposer l'architecture et la roadmap. |
| **Tâches réalisées** | Lecture de D1–D5. Vérification automatique du corpus (300 ID uniques, 2 doublons stricts). Couverture pages ↔ corpus (53 libellés uniques, 19 dans le corpus, 34 propres aux pages). Tentative de vérification de l'origine du test (inaccessible depuis mon environnement). Conflits C1–C5. Questions Q1–Q12. **v0.2 :** revérification manuelle des chiffres (confirmés) ; 7 correspondances entre libellés de page et gabarits du corpus ; jetons de marque ; attributs d'accessibilité ; risque de lecture de l'Éton écrit (Q13) ; nouvel essai d'accès à l'environnement de test (toujours un échec DNS). |
| **Fichiers** | `PROJECT_CONTEXT.md`, `ROADMAP.md` |
| **Livrables** | Synthèse, exigences (§11), risques (§10), questions, architecture, roadmap |
| **Porte → P1** | ✔ Validation de la compréhension et de l'architecture. ✔ Réponses à **Q2, Q3, Q4, Q5** (bloquantes). Les autres questions peuvent attendre leur phase. |

---

## PHASE 1 — Initialisation de l'extension Chrome

| Rubrique | Contenu |
|---|---|
| **Objectifs** | Obtenir une extension MV3 minimale, installable en mode développeur, avec un popup accessible et un interrupteur Activer/Désactiver persistant. **Aucune lecture ni modification de la page à ce stade.** |
| **Tâches** | 1.1 Initialiser `package.json`, TypeScript, esbuild, Vitest et ESLint (si Q4 = TS). 1.2 Écrire `manifest.json` MV3 : `permissions: ["storage"]`, `host_permissions` et `content_scripts.matches` limités à l'**origine confirmée en Q2** ; `run_at: document_idle` ; `all_frames` selon Q2. 1.3 Prévoir un **manifest de développement** séparé qui ajoute `http://localhost/*` pour les fixtures ; le manifest de production n'en contient pas. 1.4 Créer le popup : interrupteur (`role="switch"`, `aria-checked`), état lisible, navigation au clavier, contraste ≥ 4,5:1. 1.5 Créer `shared/settings` : `{ enabled, displayMode, diagnostic }` dans `chrome.storage.local`. 1.6 Ajouter un script de contenu « vide » qui écoute `storage.onChanged` et le journal d'événements (sans aucun contenu de page). 1.7 Écrire les icônes, `README` (installation) et `THIRD_PARTY.md` (outils, dont GitHub Copilot). |
| **Fichiers** | `manifest.json`, `manifest.dev.json`, `package.json`, `tsconfig.json`, `build.mjs`, `src/popup/*`, `src/shared/settings.*`, `src/shared/logger.*`, `src/content/index.*`, `icons/*`, `README.md`, `THIRD_PARTY.md` |
| **Dépendances** | Q2 (origine), Q4 (stack) |
| **Critères d'acceptation** | L'extension se charge sans erreur via `chrome://extensions` → « Charger l'extension non empaquetée ». Le popup s'ouvre et se manipule au clavier. L'état survit à la fermeture du popup et au redémarrage du navigateur. Les permissions affichées par Chrome se limitent à « Lire et modifier vos données sur [origine du test] ». Aucune requête réseau n'est émise par l'extension. |
| **Tests** | T-INS-01 à 05. Test unitaire du module `settings`. Test d'instantané du manifest (il échoue si une permission est ajoutée). |
| **Risques** | Origine inconnue (Q2) : on peut ouvrir temporairement sur `localhost` seulement, jamais sur `<all_urls>`. |
| **Livrable** | Extension minimale installable, documentée dans le README. |
| **Porte → P2** | Tests T-INS au vert, vérifiés **sur ta machine**. |

---

## PHASE 2 — Scanner DOM et détection (mode diagnostic, **lecture seule**)

| Rubrique | Contenu |
|---|---|
| **Objectifs** | Détecter et classer tous les textes visibles, au chargement et après injection, **sans rien modifier**. |
| **Tâches** | 2.1 Construire `scanner` : `TreeWalker(SHOW_TEXT)` en ignorant les nœuds vides et les éléments `script`, `style`, `noscript`, `template`, `code`, `pre`, `svg`, `[aria-hidden]`, `[hidden]`. 2.2 Ajouter un premier filtre `dom-guard` minimal : exclure `input`, `textarea`, `select` (sauf décision Q8), `[contenteditable]` et leurs descendants. 2.3 Classer chaque nœud : `excluded`, `candidate` (non encore apparié), `numeric-like`. 2.4 Écrire `observer` : `MutationObserver` (`childList`, `characterData`, `subtree`) avec regroupement par `requestAnimationFrame`, dédoublonnage des nœuds et budget de traitement par lot. 2.5 Gérer les pages SPA : le changement d'étape est vu comme une mutation et ne demande pas de rechargement. 2.6 Afficher le diagnostic : compteurs dans le popup (via `chrome.tabs.sendMessage`, sans permission `tabs`). Surlignage par **CSS Custom Highlight API** (`CSS.highlights`) : **aucune modification du DOM du site**. 2.7 Respecter la règle du journal : on ne journalise que des compteurs et des types, **jamais le texte**. |
| **Fichiers** | `src/content/scanner.*`, `src/content/observer.*`, `src/protection/dom-guard.*` (version initiale), `src/content/diagnostic.*`, `tests/unit/scanner.test.*`, `tests/unit/observer.test.*`, `tests/fixtures/*.html` |
| **Dépendances** | P1. Fixtures locales des 5 étapes : à partir des pages HTML que tu auras enregistrées (Q2), ou à défaut reconstruites depuis D5 avec des données fictives. |
| **Critères d'acceptation** | 100 % des libellés D5 de chaque fixture sont détectés comme `candidate`. 0 nœud détecté dans un champ de saisie. Une injection après chargement est détectée en moins de 100 ms. 50 nœuds injectés d'un coup sont traités en un seul lot. **L'empreinte du DOM est identique avant et après le scan** (test automatisé). |
| **Tests** | T-DET-01 à 06, T-PRO-12. |
| **Risques** | *Shadow DOM* ou iframes dans l'environnement réel (à vérifier en Q2). Performance sur de gros DOM : atténuée par le regroupement et un budget par trame. |
| **Livrable** | Scanner et observateur en lecture seule, avec diagnostic visuel. |
| **Porte → P3** | Diagnostic validé sur au moins une étape réelle ou sa fixture, avec la preuve que le DOM n'est pas modifié. |

---

## PHASE 3 — Protection des données (testée **avant** toute écriture)

| Rubrique | Contenu |
|---|---|
| **Objectifs** | Garantir qu'aucune donnée financière, personnelle, transactionnelle ou saisie ne puisse être modifiée, avec des faux positifs maîtrisés. |
| **Tâches** | 3.1 **Motifs** (`patterns`) : montants (espaces normales, U+00A0 et U+202F ; décimales `,` et `.` ; signes `+`, `-`, `−` U+2212), `FCFA`/`XAF`, pourcentages, dates (`05 nov. 2026`, `05/11/2026`), heures, téléphones (`+237`…), comptes (`CM 001 …`), références (`[A-Z]{2,}-\d{4}-[A-Z0-9]+` généralisé), e-mails, URL, **noms de marque (`Safinum`, `Safinum Pay` — D5 §4.3, v0.2)** et tout jeton contenant un chiffre. 3.2 **Contexte DOM** (`dom-guard`) : champs de saisie, `[contenteditable]`, `aria-live` contenant des valeurs, `<output>`, `<time>`, `<data>`, `<a href^=tel:\|mailto:>`, et attributs ou classes **indicatifs** (`amount`, `balance`, `name`, `ref`…) utilisés uniquement pour *renforcer* une exclusion, jamais pour autoriser une traduction. 3.3 **Paires libellé/valeur** : dans une structure `dt/dd`, ligne de tableau ou grille à 2 colonnes, l'élément « valeur » est protégé en entier. Cela couvre les noms (`Jean-Paul Mbarga`) **sans regex de noms**. 3.4 **Écho de saisie** : à l'étape 4, une valeur affichée peut reprendre une saisie de l'étape 3 (motif ou note). La liste blanche ne suffit pas : la règle 3.3 et la position « valeur » priment sur toute correspondance lexicale. 3.5 **Intégrité** (`integrity`) : avant chaque écriture, extraire le multiensemble des jetons protégés de la source et vérifier qu'il est **identique octet par octet** dans le résultat, sinon refuser. Au niveau page, garder en mémoire uniquement une empreinte (hachage) des jetons protégés visibles ; en cas d'écart imputable à l'extension, **retour arrière total** et alerte dans le popup. 3.6 Vérifier qu'aucune donnée n'est stockée ni journalisée (revue et test). |
| **Fichiers** | `src/protection/patterns.*`, `src/protection/dom-guard.*`, `src/protection/integrity.*`, `tests/unit/protection.test.*`, `tests/unit/integrity.test.*` |
| **Dépendances** | P2 |
| **Critères d'acceptation** | 100 % des valeurs d'exemple (D1 §5, D5 §4) sont reconnues comme protégées. **0 faux négatif** sur le jeu de cas limites. Faux positifs documentés et acceptés (sur-protection tolérée, sous-protection interdite). Une écriture qui altérerait un jeton est refusée (test). |
| **Tests** | T-PRO-01 à 13. |
| **Risques** | Nom propre isolé hors structure libellé/valeur : il est protégé de toute façon par la liste blanche, car un nom n'est jamais une entrée de la bibliothèque. Un nom identique à un mot du lexique (ex. « Bonheur ») : protégé par la règle 3.3 et le gabarit P1-002. |
| **Livrable** | Module de protection testé, avec un rapport de tests. |
| **Porte → P4/P5** | Tous les tests T-PRO au vert. Revue par toi de la liste des cas limites. |

---

## PHASE 4 — Bibliothèque linguistique et correspondance (peut démarrer dès P1)

| Rubrique | Contenu |
|---|---|
| **Objectifs** | Structurer les composantes A et B dans un schéma commun, importer les 300 + 62 entrées sans perte, outiller la qualité (doublons) et construire le *matcher*. |
| **Tâches** | 4.1 **Schéma** (`data/schema/entry.schema.json`), selon PROJECT_CONTEXT §4.5 (résout le conflit C3). 4.2 **Import unique** des tableaux Markdown de D4 et D5 vers `data/financial-corpus/*.json` et `data/safinum-test-pages/*.json`, avec conservation des ID, des sections, de la sensibilité et des variables. Test : 300 + 62 entrées, aucune perdue. 4.3 **Liens A ↔ B** : `corpusRef` ou `pageRefs` pour les 19 correspondances, les 34 libellés propres marqués `pageOnly`, et P1-002 converti en gabarit `Bonjour, {prénom}`. **v0.2 :** liens `templateRefs` pour les 7 correspondances entre libellés de page et gabarits (PROJECT_CONTEXT §3.6-1), et P2-004 converti en gabarit `Compte {marque}`. 4.4 **Rapport de doublons** (§8 ci-dessous) dans `docs/reports/duplicates.md`. **v0.2 :** il signale aussi les phrases incluses dans un paragraphe (ex. MSG-017 dans P2-002) et les **divergences de traduction** entre un libellé seul et la partie libellé de son gabarit. Ces divergences sont un avertissement, pas un échec du build. 4.5 **Normaliseur** (comparaison uniquement) : NFC ; espaces, U+00A0 et U+202F réduits à une espace ; apostrophes `’` et `'` unifiées ; ponctuation finale (`:` `.`) détachée puis **réattachée telle quelle**. **Jamais** de suppression d'accents, et casse respectée (sauf variante approuvée). 4.6 **Matcher** : (1) correspondance exacte normalisée ; (2) variantes FR approuvées (`sourceVariants`) ; (3) gabarits à **variables typées** (`{montant}` doit satisfaire le motif « montant », `{devise}` ∈ {FCFA, XAF}, `{référence}` le motif « référence », etc.) ; (4) libellé composé « libellé connu + séparateur + valeur protégée » (ex. `Frais : 0 FCFA`) ; (5) sinon `unknown`. **Pas de similarité floue.** 4.7 **`build-lexicon`** : génère `src/language/lexicon.json` en n'incluant **que** les entrées affichables (PROJECT_CONTEXT §4.4). La construction **échoue** en cas de contradiction (§8.4) ou de variables incohérentes. 4.8 **`export-review-sheet`** : CSV ou tableur conforme à la fiche D5 §6.5, pour la piste L. |
| **Fichiers** | `data/**`, `scripts/import-markdown.*`, `scripts/check-duplicates.*`, `scripts/build-lexicon.*`, `scripts/export-review-sheet.*`, `src/language/normalizer.*`, `src/language/matcher.*`, `tests/unit/normalizer.test.*`, `tests/unit/matcher.test.*`, `tests/unit/lexicon-build.test.*` |
| **Dépendances** | Q5 (source de vérité), Q10 (nommage). Le matcher dépend de P3 (motifs pour les variables typées). |
| **Critères d'acceptation** | Import sans perte (300 + 62). Rapport de doublons produit, **sans aucune suppression**. Le lexique d'exécution actuel est **vide**, ce qui est normal (0 validée). Le matcher passe les tests avec un **lexique de test** dont les cibles sont marquées `⟦TEST⟧`. Le build refuse d'embarquer une entrée de test. |
| **Tests** | T-LIB-01 à 08, T-TRA-03 à 05. |
| **Risques** | Lexique vide au moment de la démo (→ piste L). Divergence Markdown/JSON (→ une seule source de vérité, Q5). |
| **Livrable** | Bibliothèque structurée, rapport qualité, matcher local testé. |
| **Porte → P5** | Rapport de doublons **revu et arbitré par toi**. Tests du matcher au vert. |

---

## PHASE 5 — Moteur de traduction (première écriture dans la page)

| Rubrique | Contenu |
|---|---|
| **Objectifs** | Remplacer uniquement les textes appariés à une entrée validée, de façon réversible, sans boucle et sans altérer la structure. |
| **Tâches** | 5.1 `renderer.apply(node, entry)` : modifier **uniquement `Text.data`** et mémoriser l'original dans une `WeakMap`. Pas d'`innerHTML`, pas d'ajout ni de suppression de nœud, pas d'attribut fonctionnel. 5.2 `renderer.restore()` : rétablit l'original **seulement si** le nœud contient encore notre écriture ; sinon l'application l'a changé et on n'y touche pas. 5.3 **Anti-boucle** : on ignore les mutations dont la valeur est égale à notre dernière écriture (`WeakMap`), et on ne retraduit jamais un texte déjà en Éton. 5.4 **Réécriture par l'application** (React, Vue…) : si un nœud traduit reçoit une nouvelle valeur FR, on met à jour l'original et on réévalue. 5.5 **Mode d'affichage** selon Q3 : le français reste accessible (infobulle en *shadow DOM* isolé, ou mode bilingue) ; `lang="eto"` (ISO 639-3) seulement si l'élément est entièrement traduit, à confirmer pour l'impact sur les lecteurs d'écran. 5.6 **Inconnus** : conservés en FR, comptés et surlignés en mode diagnostic, et listés dans le popup (« N textes restent à traduire »), sans contenu journalisé. 5.7 **Rendu des diacritiques** : vérifier les glyphes et, si besoin, ajouter une police libre (OFL) appliquée uniquement aux nœuds traduits. 5.8 Brancher `integrity` avant chaque écriture et sur chaque lot. |
| **Fichiers** | `src/render/renderer.*`, `src/content/index.*`, `src/content/observer.*`, `src/popup/*`, `tests/unit/renderer.test.*`, `tests/e2e/translate.spec.*` |
| **Dépendances** | P3, P4, Q3, et au moins quelques entrées validées (L2) pour la vérification réelle. Sinon, uniquement un lexique de test en développement. |
| **Critères d'acceptation** | Seules les entrées validées sont affichées. Après désactivation, le DOM est **identique** à l'état initial (empreinte). Aucune boucle : nombre de mutations stable après 5 s d'inactivité. Les formulaires, boutons et calculs fonctionnent à l'identique. |
| **Tests** | T-TRA-01 à 08, T-NAV-04 et 05. |
| **Risques** | Texte réparti sur plusieurs nœuds (ex. `Votre transfert de <b>25 000 FCFA</b>…`) : ce cas est hors MVP. Par défaut on le laisse en FR, puis traitement par gabarit au niveau de l'élément si le temps le permet. Allongement des libellés en Éton (troncature) : à vérifier en P6. |
| **Livrable** | Traduction fonctionnelle et réversible. |
| **Porte → P6** | T-TRA et T-NAV-04/05 au vert sur fixtures. Démonstration courte devant toi. |

---

## PHASE 6 — Intégration au parcours SAFINUM (5 étapes)

| Rubrique | Contenu |
|---|---|
| **Objectifs** | Valider le comportement sur l'environnement réel, étape par étape, puis sur le parcours complet. |
| **Tâches** | 6.1 Étape 1 : solde, numéro de compte, transactions (signes, dates). 6.2 Étape 2 : changer le type et le montant, puis vérifier que les frais, le total et le solde après opération restent **identiques** avec et sans l'extension. 6.3 Étape 3 : saisir des données fictives (dont une note contenant un mot du lexique, ex. « Facture ») et vérifier qu'aucune saisie n'est traduite. 6.4 Étape 4 : **point de contrôle d'intégrité**. Comparer chaque valeur avec les étapes 1 à 3 ; la case à cocher et le bouton « Confirmer le transfert » restent fonctionnels. 6.5 Étape 5 : reçu identique ; un message de succès n'est affiché que si la page affiche un succès. 6.6 Parcours complet, extension activée puis désactivée en cours de route. 6.7 Contrôle visuel : troncature, débordement, contraste, focus. 6.8 Tests e2e Playwright sur les fixtures ; sur le site réel si les conditions d'utilisation le permettent. |
| **Fichiers** | `tests/e2e/journey.spec.*`, `tests/fixtures/*`, `docs/test-report.md` |
| **Dépendances** | P5, accès à l'environnement réel (Q2), traductions L2 importées. |
| **Critères d'acceptation** | Les 5 étapes passent. **0 valeur protégée altérée** (comparaison automatique avant/après). Aucune régression fonctionnelle ou visuelle bloquante. |
| **Tests** | T-NAV-01 à 06, T-PRO-01 à 11 en conditions réelles. |
| **Risques** | Le site réel diffère des captures (libellés non relevés) : mettre à jour D5 et la bibliothèque, **sans inventer**. |
| **Livrable** | Rapport de test du parcours complet. |
| **Porte → P7** | Rapport validé par toi. |

---

## PHASE 7 — Contenu inédit et robustesse

| Rubrique | Contenu |
|---|---|
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
| **Objectifs** | Fournir une extension stable et installable, ainsi que **tous** les livrables de D2 §6. |
| **Tâches** | 8.1 Corriger les anomalies. 8.2 Audit d'accessibilité : popup au clavier, lecteur d'écran (NVDA ou ChromeVox), contrastes, `prefers-reduced-motion`. 8.3 Audit de performance. 8.4 Audit de sécurité : recherche de `fetch`, `XMLHttpRequest`, `WebSocket`, `eval` et `innerHTML` dans le bundle ; permissions ; CSP ; absence de données dans le stockage et les journaux. 8.5 Produire un ZIP de distribution et le **tester sur une machine vierge**. 8.6 README : installation, utilisation, tests. 8.7 **Note technique** : architecture, intégration, dépendances, limites connues (contenu non validé laissé en FR, textes multi-nœuds, etc.). 8.8 **Méthode de validation linguistique** : variété d'Obala, dictionnaire, nombre de locutrices, double relecture. 8.9 `THIRD_PARTY.md` final (bibliothèques, police, outils d'IA utilisés pour le développement). 8.10 Script de la **vidéo de 3 min maximum** et répétition de la démo. 8.11 Description succincte de la solution. |
| **Fichiers** | `README.md`, `docs/architecture.md`, `docs/note-technique.md`, `docs/validation-linguistique.md`, `THIRD_PARTY.md`, `docs/test-report.md`, `docs/demo/*` |
| **Critères d'acceptation** | Installation en moins de 2 min sur une machine vierge en suivant le README. Tous les tests au vert. Les 5 livrables D2 sont prêts. |
| **Livrable** | Dossier de soumission complet. |

---

## Piste linguistique L (parallèle, sans code)

| Étape | Contenu | Sortie | Critère |
|---|---|---|---|
| **L1** | Fiches D5 §6.5 pour les **53 libellés uniques** des 5 pages, avec contexte d'écran | Feuille de relecture | Fiches envoyées aux locutrices |
| **L2** | Validation par ordre de priorité : ① actions critiques (Confirmer le transfert, Continuer, Retour, Modifier, Montant à envoyer, Total à débiter, Total débité) ② avertissements (P1-015, P3-002, P3-003, P4-002, P3-009, P4-010) ③ autres libellés | Entrées `VALIDATED_OBALA` + sens financier validé | Au moins les ①② validés avant P6 |
| **L3** | Messages probables du jury : D5 §6.4 (15 phrases), MSG-059 à 072 (erreurs système), SEC-041 à 060 (alertes), MSG-047, 053, 054 (statuts) | Gabarits et phrases validés | Liste arrêtée avec toi |
| **L4** | Deuxième relecture des phrases critiques (D5 §6.6 point 8) | Validation croisée tracée | Toutes les phrases critiques affichées sont relues deux fois |

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
- Le rapport `docs/reports/duplicates.md` est régénéré à chaque build et **revu par toi** avant toute fusion.

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
| T-TRA-01 | Traduction validée | Entrée de test validée | Texte remplacé | — | À faire |
| T-TRA-02 | Sans traduction | `target: null` | FR conservé et compté « à traduire » | — | À faire |
| T-TRA-03 | Non validée | `REVIEW_PENDING` | FR conservé | — | À faire |
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
| R2 | Origine du test inconnue ou inaccessible | Moyenne | Élevé | Q2. Fixtures locales enregistrées par toi |
| R3 | Altération d'une valeur (défaut majeur, exclusion possible) | Faible | Critique | Liste blanche, contexte DOM, intégrité avec retour arrière, tests T-PRO |
| R4 | Faux positif sur une donnée saisie identique à un libellé | Moyenne | Élevé | Règle libellé/valeur (3.3), test T-PRO-11 |
| R5 | Conflit avec le framework de la page (React/Vue) | Moyenne | Élevé | `Text.data` uniquement, réévaluation, T-TRA-08 |
| R6 | Boucle de MutationObserver ou lenteur | Moyenne | Moyen | Anti-boucle, regroupement, budget, T-TRA-07, T-INE-08 |
| R7 | Diacritiques mal rendus | Moyenne | Moyen | Vérification visuelle, police OFL de secours |
| R8 | Texte réparti sur plusieurs nœuds non traduit | Élevée | Faible | Laissé en FR (sûr), amélioration optionnelle |
| R9 | Barème ambigu (C1) | — | Faible | Couvrir l'union des deux barèmes |
| R10 | Licence du dictionnaire | Moyenne | Moyen | Dépôt privé ; vérifier avant publication (Q11) |
| R11 | Délai inconnu (Q1) | — | Élevé | Périmètre MVP strict (§0.2) |
| R12 | Public cible ne lisant pas l'Éton écrit (tons) — v0.2 | Moyenne | Moyen | Mode bilingue ; audio local enregistré par les locutrices après le MVP (Q13) ; argument à présenter au jury |

---

## 11. Matrice de traçabilité des exigences

| Exigence | Source | Phase | Tests |
|---|---|---|---|
| Adaptation linguistique de l'interface | D2 §4.1 | P4, P5, L | T-TRA-01, T-NAV |
| Parcours financier en 5 étapes | D2 §4.2, D3 §1 | P6 | T-NAV-01…06 |
| Préservation des informations financières | D2 §4.3, D3 §2, D1 §5 | P3 | T-PRO-01…13 |
| Fonctionnement sans modification du site ni hook | D2 §4.4, D3 §2, §7 | P2, P5 | T-PRO-12, T-NAV |
| Contenu inédit détecté sans rechargement | D2 §4.5, D3 §2, D1 §4 | P2, P7 | T-DET-02/03, T-INE |
| Aucune traduction inventée | D1 §3.1, D3 §5 (critère 2), D5 §1 | P4, P5 | T-TRA-02/03/05, T-LIB-08 |
| Alertes non affaiblies | D3 §4, D4 §3 | L, P4 | Revue L4, T-INE-03 |
| Activation/désactivation + restauration | D1 §2.1 (7) | P1, P5 | T-INS-04, T-NAV-06 |
| Accessibilité (clavier, contraste, lecteur d'écran) | D3 §2, §5 | P1, P8 | Audit 8.2 |
| Aucune collecte ni transmission | D2 §9, D3 §3, D1 §6 | P1, P8 | T-INS-05, audit 8.4 |
| Moindre privilège | D1 §6 | P1 | Instantané du manifest |
| Déclaration des composants et outils | D2 §5, §9, D3 §3 | P1, P8 | `THIRD_PARTY.md` |
| Livrables (description, vidéo ≤ 3 min, note technique, langue + méthode) | D2 §6 | P8 | Liste de contrôle 8.x |
| Doublons détectés, jamais fusionnés automatiquement | D1 §8 | P4 | T-LIB-02…05 |
| Traçabilité A ↔ B | D1 §3.2 | P4 | T-LIB-03 |

---

## 12. Journal des décisions

| Date | Décision | Statut |
|---|---|---|
| 2026-11-12 | Roadmap v0.1 proposée | En attente de validation |
| 2026-11-12 | Roadmap v0.2 : revérification, compléments PROJECT_CONTEXT §3.6, Q8 élargie, Q13, T-PRO-14, T-LIB-09, R12 | En attente de validation |
