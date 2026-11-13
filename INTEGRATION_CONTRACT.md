# INTEGRATION_CONTRACT — Moteur linguistique ⇄ Extension Chrome

> **Statut :** 🟡 **PROPOSITION v0.2.0-draft — non validée.** Le contrat sera validé en **Synchronisation 1** (TEAM_WORKFLOW §7). Avant cette validation, rien n'est figé. Le responsable a accepté Q14 (§8) et Q16 (§5.3) le 2026-11-12, puis a tranché **Q9** le 2026-11-13 : les traductions non vérifiées s'affichent, **avec un marqueur** (§5.4). Il reste la relecture d'Yvan (`@ivan-14-dev`).
> **Propriétaire :** responsable du projet (bibliothèque et moteur). **Consommateur :** Yvan (extension).
> **Références :** `TEAM_WORKFLOW.md` §4, §8 et §9 ; `PROJECT_CONTEXT.md` §3.7, §4.4 et §4.5 ; glossaire D5 (statuts et protection).
> **Règle :** une fois validé, le contrat ne change qu'en suivant le §10 (prévenir, documenter, migrer).

---

## 1. Objet

Ce document définit **l'unique interface** entre :

- le **moteur linguistique** (`src/language/`), qui apparie un texte à la bibliothèque et décide de son statut ;
- l'**extension** (`src/content/`, `src/protection/`, `src/popup/`), qui détecte les textes, protège le DOM, affiche et restaure.

Le contrat permet de développer les deux composantes **en parallèle**. Avant la livraison du moteur, Yvan utilise un **faux moteur** conforme (§9). Le vrai moteur le remplace ensuite **sans réécriture** de l'extension.

## 2. Principes non négociables

1. **Une traduction non vérifiée n'est jamais présentée comme approuvée.** L'extension affiche `output` si `status === 'APPROVED'`. Elle affiche `unverifiedOutput` seulement si `status === 'PENDING_VALIDATION'` et que l'option « traductions non vérifiées » est active, **toujours avec le marqueur et le texte original au survol** (§5.4, décision Q9). Dans tous les autres cas, le texte original reste en place.
2. **Le moteur ne connaît pas le DOM.** Il est pur : pas de `document`, pas de `chrome.*`, pas de réseau, pas de stockage, pas de minuteur. Il se teste sous Node, sans Chrome.
3. **L'extension ne contient aucune logique linguistique.** Elle ne traduit pas, ne corrige pas et ne post-traite ni `output` ni `unverifiedOutput` (pas de `trim`, de changement de casse ni de ponctuation).
4. **Les valeurs protégées sont intouchables.** Les montants, la devise, les dates, les noms, les numéros, les références et les valeurs saisies restent identiques octet par octet (§7, I5).
5. **En cas de doute, le texte original est conservé.** Les états `AMBIGUOUS`, `NO_MATCH`, etc. ne sont jamais « devinés ».
6. **Aucune donnée de page n'est journalisée ni conservée.** Le moteur et l'extension ne journalisent que des compteurs, des statuts et des ID d'entrée.

## 3. Langues

| Rôle | Code | Remarque |
|---|---|---|
| Langue cible | `eto` | ISO 639-3 (Éton). Remplace `"eton"` utilisé dans l'exemple JSON de D5 §7.1. |
| Variété | `obala` | Champ séparé (`EngineInfo.variety`), pas de sous-étiquette BCP 47. |
| Langues sources | `fr`, `en` | Valeur `'auto'` **retenue** (Q16, §5.3). |

## 4. Interface (TypeScript)

Le fichier `src/language/contract.ts` sera la **transcription exacte** de cette section. Il contiendra **uniquement des types et des constantes**, sans logique.

```ts
export const CONTRACT_VERSION = '0.2.0';

export type SourceLang = 'fr' | 'en';
export type TargetLang = 'eto';

/** Nature du texte, déduite du DOM par l'extension. Ne contient jamais de texte de la page. */
export type TextRole =
  | 'heading' | 'label' | 'button' | 'link' | 'message' | 'status'
  | 'option' | 'placeholder' | 'aria-label' | 'title' | 'unknown';

export interface TranslationContext {
  role?: TextRole;
  /** Valeur brute de <html lang> (ex. "fr", "fr-CM"), utilisée seulement pour départager les langues. */
  pageLang?: string;
  /** Étape SAFINUM si l'extension la connaît ; sinon absent. SPA à URL constante : jamais déduite de l'URL (§6). */
  step?: 1 | 2 | 3 | 4 | 5;
  /** Vrai si le texte est dans une région aria-live, une alerte ou une boîte de dialogue. */
  live?: boolean;
}

export interface TranslationRequest {
  /** Texte EXACT du nœud : non normalisé, espaces de début et de fin compris. */
  text: string;
  /** 'auto' : retenu (Q16), voir §5.3. */
  sourceLang: SourceLang | 'auto';
  targetLang: TargetLang;
  context?: TranslationContext;
}

export type TranslationStatus =
  | 'APPROVED'            // traduction disponible et approuvée
  | 'KNOWN_UNTRANSLATED'  // entrée connue, aucune traduction proposée
  | 'PENDING_VALIDATION'  // traduction non vérifiée par une locutrice, dans unverifiedOutput (§5.4)
  | 'NO_MATCH'            // aucune correspondance
  | 'AMBIGUOUS'           // plusieurs correspondances, impossible de trancher
  | 'PROTECTED';          // texte qui ne doit pas être traduit

export type MatchKind = 'exact' | 'normalized' | 'variant' | 'template' | 'label-value';

export type ResultReason =
  | 'protected-entry'      // entrée de la bibliothèque marquée protégée (ex. "Safinum Pay", "FCFA")
  | 'protected-value'      // le texte n'est composé que de valeurs protégées (ex. "250 000 FCFA")
  | 'out-of-scope'         // entrée hors périmètre (D5 : OUT_OF_SCOPE)
  | 'context-required'     // AMBIGUOUS : plusieurs entrées, le contexte ne départage pas
  | 'multiple-languages'   // AMBIGUOUS : 'auto' trouve des entrées différentes en fr et en en
  | 'unsupported-language' // NO_MATCH : langue source ou cible non prise en charge
  | 'too-long';            // NO_MATCH : texte au-delà de la longueur maximale (§7, I10)

export interface TranslationResult {
  status: TranslationStatus;
  /** Non nul SI ET SEULEMENT SI status === 'APPROVED'. Texte complet prêt à afficher. */
  output: string | null;
  /**
   * Non nul SI ET SEULEMENT SI status === 'PENDING_VALIDATION'. Traduction NON VÉRIFIÉE par une locutrice,
   * texte complet. Affichée seulement avec le marqueur et le texte original au survol (§5.4).
   */
  unverifiedOutput: string | null;
  /** ID stable de l'unité de traduction (ex. "VOC-023", "P4-012", "GUARD-001"), sinon null. */
  entryId: string | null;
  /** AMBIGUOUS uniquement : ID des entrées candidates. Sinon []. */
  candidateIds: string[];
  matchKind: MatchKind | null;
  detectedSourceLang: SourceLang | null;
  /** Valeurs protégées trouvées dans `text`, dans l'ordre. Elles doivent se retrouver octet pour octet dans `output`. */
  protectedSegments: string[];
  reason: ResultReason | null;
}

export interface EngineInfo {
  engineId: 'finethnic' | 'fake';
  contractVersion: string;
  libraryVersion: string;
  targetLang: TargetLang;
  variety: 'obala';
  /** Statistiques de la bibliothèque embarquée (aucune donnée de page). */
  entryCounts: { approved: number; pending: number; untranslated: number; protected: number };
}

export interface TranslationEngine {
  info(): EngineInfo;
  translate(request: TranslationRequest): TranslationResult;
  translateMany(requests: readonly TranslationRequest[]): TranslationResult[];
}
```

**Chargement :** le moteur et son lexique d'exécution sont **inclus dans le bundle** du script de contenu (esbuild). Il n'y a aucun chargement réseau. L'extension obtient l'instance par une fabrique unique, par exemple `createEngine()`, importée dans **un seul** fichier (ex. `src/content/engine-provider.ts`). Remplacer le faux moteur revient à modifier cet import.

## 5. Les six statuts

### 5.1 Définitions et action attendue de l'extension

| Statut | Signification | `output` | Action de l'extension |
|---|---|---|---|
| `APPROVED` | Une entrée ou un gabarit approuvé correspond, sans ambiguïté | Texte Éton complet, valeurs protégées réinjectées | Vérifier l'intégrité (§8), puis afficher |
| `KNOWN_UNTRANSLATED` | L'entrée existe, mais aucune traduction utilisable n'existe | `null` | Conserver l'original ; compter « à traduire » |
| `PENDING_VALIDATION` | Une traduction existe, mais aucune locutrice ne l'a encore vérifiée | `null` ; la traduction est dans **`unverifiedOutput`** (texte complet, valeurs protégées réinjectées) | Si l'option « traductions non vérifiées » est active : vérifier l'intégrité (§8), puis afficher **avec le marqueur** (§5.4). Sinon, conserver l'original. Compter « non vérifiés » |
| `NO_MATCH` | Aucune entrée ne correspond | `null` | Conserver l'original ; compter « inconnu » |
| `AMBIGUOUS` | Plusieurs entrées correspondent et le contexte ne départage pas | `null` | Conserver l'original ; compter « ambigu » |
| `PROTECTED` | Valeur protégée, entrée protégée ou hors périmètre | `null` | Ne rien faire |

`unverifiedOutput` vaut `null` pour tous les statuts sauf `PENDING_VALIDATION`.

### 5.2 Correspondance avec les statuts de la bibliothèque

La bibliothèque utilise trois niveaux (PROJECT_CONTEXT §4.5) : la **disposition** de l'entrée, le **statut de traduction** (statuts D5) et la **validation**.

| État de l'entrée dans `data/` | Statut renvoyé |
|---|---|
| `disposition = PROTECTED` | `PROTECTED` (`protected-entry`) |
| `disposition = OUT_OF_SCOPE` | `PROTECTED` (`out-of-scope`) |
| Texte composé uniquement de valeurs protégées | `PROTECTED` (`protected-value`) |
| `translationStatus = VALIDATED_OBALA`, `financialMeaning = VALIDATED`, cible non nulle, variables identiques (et règle de double relecture, Q18) | `APPROVED` |
| Traduction non vérifiée retenue (voir ci-dessous) : `DICTIONARY_ATTESTED`, `CONTEXT_PENDING`, `REVIEW_PENDING`, ou `VALIDATED_OBALA` dont le sens financier n'est pas encore validé | `PENDING_VALIDATION`, avec `unverifiedOutput` |
| Aucune traduction retenue : `TRANSLATION_PENDING` sans proposition, ou traduction rejetée par une locutrice | `KNOWN_UNTRANSLATED` |
| Plusieurs entrées retenues | `AMBIGUOUS` |
| Aucune entrée | `NO_MATCH` |

`SOURCE_EXTRACTED` est un statut **côté source** : il ne produit pas de statut de résultat particulier.

**Traduction non vérifiée retenue (Q9).** C'est `target.eto.text` s'il est non nul ; sinon, la **première proposition** de la cascade (`target.eto.proposals[0]`, celle du niveau le plus haut). Aucune traduction n'est retenue si une locutrice a rejeté l'entrée (`validation.linguistic` ou `validation.financialMeaning` = `REJECTED`). Ce choix est fait **une fois**, par `build-lexicon` (BM5), qui l'écrit dans un champ séparé du lexique, `unverifiedTarget`. Le champ `target` est réservé aux traductions approuvées (`data/schemas/lexicon.schema.json`). Le moteur ne compare pas de propositions à l'exécution.

### 5.3 Ordre de résolution (proposé)

1. Texte vide, blanc ou trop long → `NO_MATCH`.
2. Texte composé uniquement de valeurs protégées et de ponctuation → `PROTECTED`.
3. Recherche dans la bibliothèque : exacte, puis normalisée, puis variantes approuvées, puis gabarits à variables typées, puis « libellé + séparateur + valeur protégée ». **Aucune similarité floue.**
4. Plusieurs entrées : départage par `context.role` et `context.step`. S'il en reste plusieurs → `AMBIGUOUS`.
5. Une seule entrée : statut selon §5.2.

**Règle `'auto'` (Q16, acceptée le 2026-11-12) :** le moteur cherche en `fr` et en `en`. Si une seule langue trouve une entrée, cette entrée est retenue. Si les deux trouvent **la même** entrée, elle est retenue. Si elles trouvent des entrées **différentes**, `context.pageLang` départage ; à défaut, le résultat est `AMBIGUOUS` (`multiple-languages`). Cela couvre le cas d'un message anglais injecté par le jury dans la page française.

### 5.4 Affichage des traductions non vérifiées (décision Q9, 2026-11-13)

**Pourquoi.** Les locutrices ne sont pas toujours disponibles. Pour voir le résultat sur la page de test sans les attendre, le responsable a décidé d'afficher les traductions non vérifiées, en les **signalant comme telles**. Ces traductions viennent surtout de la cascade (PROJECT_CONTEXT §3.10). Les locutrices les vérifient ensuite. Une traduction validée devient `APPROVED` et perd le marqueur ; une traduction corrigée remplace la précédente.

**Exigences pour l'extension :**
1. **Option du popup** « Afficher les traductions non vérifiées », **activée par défaut**. Quand elle est désactivée, les textes concernés sont restaurés à l'identique, comme lors de la désactivation générale.
2. **Marqueur visible** sur chaque texte affiché depuis `unverifiedOutput`. Il distingue une traduction non vérifiée d'une traduction approuvée **sans reposer sur la couleur seule** (ex. soulignement pointillé). Il ne modifie pas le DOM de l'application : ni attribut, ni nœud ajouté dans la page. Une piste possible : l'API CSS Custom Highlight (`CSS.highlights` et `::highlight()`).
3. Le **texte original** reste accessible au survol et au focus (même mécanisme que Q3).
4. Le popup indique en clair que ces traductions sont **automatiques et non vérifiées par une locutrice**. Il compte les textes « non vérifiés ».
5. Le contrôle d'intégrité (§8, I4, I5) s'applique à `unverifiedOutput` comme à `output`. En cas d'écart, le texte original est conservé.

**Portée.** Cette décision vaut pour l'**environnement de test** (`https://safinum.cm/hackathon-test`, seul site autorisé, Q2), qui n'utilise que des données fictives. Elle sera réexaminée avant tout usage réel, en particulier pour les messages de sécurité (`sensitivity = critical`) : voir Q24.

## 6. Contexte : champs autorisés

- **Autorisé :** énumérations et booléens décrivant la **nature** du texte (`role`, `step`, `live`, `pageLang`).
- **Interdit :** tout contenu de la page autre que `text` (textes voisins, valeurs, noms, URL, sélecteurs CSS, identifiants DOM).
- Un contexte absent ou incomplet ne doit **jamais** conduire à une traduction devinée. Il peut seulement conduire à `AMBIGUOUS`.
- **`step` et SPA** : l'environnement de test (`https://safinum.cm/hackathon-test`) est une application monopage dont l'URL ne change pas. L'extension ne peut donc déduire `step` que d'un repère visible, comme le titre de l'étape (PROJECT_CONTEXT Q20). Dans le doute, elle l'omet. Le moteur ne se sert de `step` que pour départager des candidats ; une étape absente ou erronée ne peut jamais rendre une entrée `APPROVED`.

## 7. Garanties du moteur (invariants testés)

| # | Invariant |
|---|---|
| I1 | **Pureté** : aucune dépendance au DOM, à `chrome.*`, au réseau, au stockage ou à l'horloge. Aucune journalisation de texte. |
| I2 | **Totalité** : `translate` ne lève jamais d'exception, quelle que soit la chaîne (vide, 100 000 caractères, émojis, caractères de contrôle, surrogates isolés). Il renvoie toujours un statut valide. |
| I3 | `output !== null` ⇔ `status === 'APPROVED'`, et `unverifiedOutput !== null` ⇔ `status === 'PENDING_VALIDATION'`. Les deux ne sont donc jamais renseignés ensemble. |
| I4 | Les espaces de début et de fin de `text` sont reproduits à l'identique dans `output` et dans `unverifiedOutput`. |
| I5 | Chaque élément de `protectedSegments` apparaît dans le texte renvoyé (`output` ou `unverifiedOutput`) avec la même multiplicité, octet par octet. Le multiensemble de ses chiffres est identique à celui de `text`. |
| I6 | Une cible **rejetée** par une locutrice n'est **jamais** présente dans le lexique d'exécution. Une traduction non vérifiée y figure dans un champ séparé (`unverifiedTarget`), avec l'état « en attente » : elle ne peut sortir que dans `unverifiedOutput`, jamais dans `output`. |
| I7 | Un texte qui diffère d'une source au-delà des règles de normalisation donne `NO_MATCH` (ex. « Votre **paiement** a été envoyé avec succès. »). |
| I8 | **Déterminisme** : même requête et même `libraryVersion` donnent le même résultat. |
| I9 | **Performance indicative** : médiane ≤ 0,2 ms par appel sur un lexique de 1 000 entrées (Node, poste de développement). |
| I10 | Au-delà de 2 000 caractères, le moteur renvoie `NO_MATCH` (`too-long`), sans analyse. |
| I11 | Le moteur ne conserve aucune donnée entre les appels, sauf un cache mémoire **borné**, jamais persisté ni journalisé. |

## 8. Répartition des responsabilités

| Sujet | Moteur (responsable du projet) | Extension (Yvan) |
|---|---|---|
| Choix des nœuds à traiter | — | ✅ Le scanner et `dom-guard` excluent `input`, `textarea`, `select`, `[contenteditable]`, les cellules « valeur », etc. |
| Contexte (`role`, `step`, `live`, `pageLang`) | Utilise | ✅ Calcule |
| Correspondance, statut, ambiguïté, choix de la traduction non vérifiée (§5.2) | ✅ | Ne réimplémente rien |
| Valeurs protégées dans un texte | ✅ Les renvoie dans `protectedSegments` | ✅ **Revérifie** l'intégrité avant chaque écriture (défense en profondeur) |
| Définition des motifs protégés (montant, devise, téléphone, référence…) | Reçoit `detectProtected` par injection (Q14) | ✅ `src/protection/patterns.ts` (Q14) |
| Écriture, restauration, anti-boucle, affichage du français au survol | — | ✅ |
| Option « traductions non vérifiées » et marqueur (§5.4) | Fournit `unverifiedOutput` | ✅ |
| Contenu et versions de la bibliothèque | ✅ | — |
| Compteurs du popup | Fournit `status` et `entryId` | ✅ Agrège, sans texte |

**Décision Q14 (acceptée le 2026-11-12) :** les motifs protégés sont définis **une seule fois**, dans le module pur sans DOM `src/protection/patterns.ts`, propriété d'Yvan. Le moteur le reçoit par **injection**, par exemple `createEngine({ detectProtected })`, et ne contient aucun motif propre. Tant que le module n'existe pas, le moteur est testé avec une implémentation de test. Une suite commune, construite sur les exemples de D5 §4, vérifie les deux côtés.

## 9. Faux moteur (exigences)

Le faux moteur d'Yvan doit :

1. implémenter `TranslationEngine` avec `engineId: 'fake'` ;
2. produire des `output` et des `unverifiedOutput` **visiblement factices**, par exemple `⟦FAKE⟧ ` suivi du texte original. Il ne doit **jamais** produire une chaîne qui ressemble à de l'Éton ;
3. couvrir **les six statuts** à partir d'une table fixe de textes fictifs FR et EN, dont au moins un `PENDING_VALIDATION` avec `unverifiedOutput` pour tester le marqueur. Ses échantillons de conformité comptent deux cas de bord « libellé + valeurs » avec des espaces au début et à la fin : un `APPROVED` (`edge`) et un `PENDING_VALIDATION` (`pendingEdge`) ;
4. respecter les invariants I2 à I5, I8 et I10, et passer la suite de conformité (§11) ;
5. être **absent du build de production**. Le build échoue si le bundle contient `⟦FAKE⟧` ou `engineId: 'fake'`.

## 10. Versionnement et procédure de changement

- `CONTRACT_VERSION` suit SemVer :
  - **MAJEURE** : suppression ou renommage d'un champ, changement de sens d'un statut, **ajout d'une valeur de `TranslationStatus`** (l'extension traite les statuts de façon exhaustive), changement d'un invariant ;
  - **MINEURE** : ajout d'un champ optionnel, d'une valeur de `TextRole` ou d'une valeur de `ResultReason` ;
  - **CORRECTIVE** : clarification de la documentation.
- `libraryVersion` évolue avec le contenu de `data/` **sans** changer le contrat.
- **Procédure** (TEAM_WORKFLOW §4 et §8) :
  1. Pull Request dédiée avec le préfixe `contract:` ;
  2. revue par Yvan (`@ivan-14-dev`) **obligatoire**, demandée via `CODEOWNERS` ou, à défaut, manuellement (Q19) ;
  3. entrée dans l'historique (§13) avec les conséquences ;
  4. procédure de migration si la version est majeure ;
  5. suite de conformité mise à jour **dans la même PR**.

## 11. Suite de conformité

- Emplacement proposé : `tests/contract/`, **copropriété** des deux membres.
- Elle exécute les **mêmes** cas sur le faux moteur et sur le vrai moteur. Le remplacement est sûr si les deux passent.
- Contenu : les invariants I2 à I5, I8 et I10, un cas par statut, deux cas de bord (approuvé et non vérifié, I4 et I5 sur `output` et sur `unverifiedOutput`), et les exemples D5 §4 de valeurs protégées.
- Les cibles de test sont marquées `⟦TEST:<id>⟧`. **Aucune forme Éton réelle n'est utilisée dans les tests du contrat.**

## 12. Exemples (cibles fictives)

Les sorties ci-dessous utilisent des **marqueurs de test**. Ce ne sont pas des traductions.

| Requête (`text`, `sourceLang`, contexte) | Hypothèse de bibliothèque de test | Résultat attendu |
|---|---|---|
| `"Frais de transfert"`, `fr`, `role: heading` | P2-001 approuvée | `APPROVED`, `output: "⟦TEST:P2-001⟧"`, `matchKind: exact` |
| `"Frais : 0 FCFA"`, `fr` | VOC-028 « Frais » approuvée | `APPROVED`, `output: "⟦TEST:VOC-028⟧ : 0 FCFA"`, `matchKind: label-value`, `protectedSegments: ["0", "FCFA"]` |
| `"  Montant  "`, `fr` | VOC-023 sans proposition | `KNOWN_UNTRANSLATED`, `entryId: "VOC-023"`, `output: null` |
| `"Confirmer le transfert"`, `fr` | P4-012 en `REVIEW_PENDING` | `PENDING_VALIDATION`, `output: null`, `unverifiedOutput: "⟦TEST:P4-012⟧"` |
| `"  Total : 5 000 FCFA "`, `fr` | VOC-034 « Total » en `REVIEW_PENDING` (cas hypothétique) | `PENDING_VALIDATION`, `unverifiedOutput: "  ⟦TEST:VOC-034⟧ : 5 000 FCFA "`, `matchKind: label-value`, `protectedSegments: ["5 000", "FCFA"]` |
| `"250 000 FCFA"`, `fr` | — | `PROTECTED`, `reason: protected-value` |
| `"Safinum Pay"`, `fr` | Entrée `GUARD` protégée | `PROTECTED`, `reason: protected-entry` |
| `"Votre paiement a été envoyé avec succès."`, `fr` | P5-002 approuvée (« Votre transfert… ») | `NO_MATCH` (I7) |
| `"Retour"`, `fr`, sans `role` | Deux entrées approuvées distinguées par `role` (cas hypothétique) | `AMBIGUOUS`, `reason: context-required`, `candidateIds: [..]` |
| `"Available balance"`, `auto` | Source `en` de VOC-008 (cas hypothétique, Q15) | Statut de VOC-008, `detectedSourceLang: "en"` |

**Unité de traduction :** lorsqu'un libellé de page est identique à une entrée du corpus (lien `corpusRef`), `entryId` renvoie l'**entrée canonique du corpus**. Par exemple, « Montant » (P4-003, P5-004) renvoie VOC-023.

## 13. Historique

| Version | Date | Changement | Conséquences pour l'extension |
|---|---|---|---|
| 0.1.0-draft | 2026-11-12 | Proposition initiale pour la Synchronisation 1 | Base du faux moteur |
| 0.1.0-draft (rév. 2) | 2026-11-12 | Q14 et Q16 acceptées par le responsable ; précision sur `step` dans une SPA (§6) ; relecteur `@ivan-14-dev` (§10) | Aucune : les types étaient déjà rédigés ainsi. `step` reste optionnel. |
| 0.2.0-draft | 2026-11-13 | **Q9 tranchée par le responsable** : les traductions non vérifiées s'affichent avec un marqueur (§5.4). Nouveau champ obligatoire `unverifiedOutput` (non nul ⇔ `PENDING_VALIDATION`). I3 à I6 étendus. Une traduction rejetée donne `KNOWN_UNTRANSLATED` (§5.2). Changement **majeur** (§10) : le sens de `PENDING_VALIDATION` change. | `output` garde son sens. Le faux moteur doit renseigner `unverifiedOutput` et fournir un second cas de bord, `pendingEdge` (§9). Dans le lexique, la traduction non vérifiée est rangée à part (`unverifiedTarget`). L'extension ajoute l'option du popup, le marqueur, le texte original au survol et le contrôle d'intégrité sur `unverifiedOutput` (§5.4). Aucun code d'extension n'existait encore : pas de migration. |

## 14. Points ouverts (voir PROJECT_CONTEXT §5)

- ~~**Q9**~~ ✅ Tranchée le 2026-11-13 : les traductions non vérifiées s'affichent, avec un marqueur et l'original au survol (§5.4).
- ~~**Q14**~~ ✅ Tranchée le 2026-11-12 : `src/protection/patterns.ts` (Yvan), injecté dans le moteur (§8).
- **Q15** : périmètre de l'anglais pour la présélection.
- ~~**Q16**~~ ✅ Tranchée le 2026-11-12 : `sourceLang: 'auto'` accepté (§5.3).
- **Q18** : double relecture obligatoire avant `APPROVED` pour les entrées critiques.
- **Q20** : structure réelle du DOM (repère d'étape pour `step`, `<html lang>` pour `pageLang`) — sans effet sur les types.
- **Q24** : avant tout usage réel, faut-il n'afficher que des traductions approuvées pour les entrées critiques (§5.4) ?
