# INTEGRATION_CONTRACT — Moteur linguistique ⇄ Extension Chrome

> **Statut :** 🟡 **PROPOSITION v0.1.0-draft — non validée.** Le contrat sera validé en **Synchronisation 1** (TEAM_WORKFLOW §7). Avant cette validation, rien n'est figé.
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

1. **Aucune traduction non approuvée n'est affichée.** L'extension affiche `output` **uniquement** si `status === 'APPROVED'`. Dans tous les autres cas, le texte original reste en place.
2. **Le moteur ne connaît pas le DOM.** Il est pur : pas de `document`, pas de `chrome.*`, pas de réseau, pas de stockage, pas de minuteur. Il se teste sous Node, sans Chrome.
3. **L'extension ne contient aucune logique linguistique.** Elle ne traduit pas, ne corrige pas et ne post-traite pas `output` (pas de `trim`, de changement de casse ni de ponctuation).
4. **Les valeurs protégées sont intouchables.** Les montants, la devise, les dates, les noms, les numéros, les références et les valeurs saisies restent identiques octet par octet (§7, I5).
5. **En cas de doute, le texte original est conservé.** Les états `AMBIGUOUS`, `NO_MATCH`, etc. ne sont jamais « devinés ».
6. **Aucune donnée de page n'est journalisée ni conservée.** Le moteur et l'extension ne journalisent que des compteurs, des statuts et des ID d'entrée.

## 3. Langues

| Rôle | Code | Remarque |
|---|---|---|
| Langue cible | `eto` | ISO 639-3 (Éton). Remplace `"eton"` utilisé dans l'exemple JSON de D5 §7.1. |
| Variété | `obala` | Champ séparé (`EngineInfo.variety`), pas de sous-étiquette BCP 47. |
| Langues sources | `fr`, `en` | Valeur `'auto'` **proposée** (Q16, §4). |

## 4. Interface (TypeScript)

Le fichier `src/language/contract.ts` sera la **transcription exacte** de cette section. Il contiendra **uniquement des types et des constantes**, sans logique.

```ts
export const CONTRACT_VERSION = '0.1.0';

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
  /** Étape SAFINUM si l'extension la connaît ; sinon absent. */
  step?: 1 | 2 | 3 | 4 | 5;
  /** Vrai si le texte est dans une région aria-live, une alerte ou une boîte de dialogue. */
  live?: boolean;
}

export interface TranslationRequest {
  /** Texte EXACT du nœud : non normalisé, espaces de début et de fin compris. */
  text: string;
  /** 'auto' : proposition Q16, voir §5.3. */
  sourceLang: SourceLang | 'auto';
  targetLang: TargetLang;
  context?: TranslationContext;
}

export type TranslationStatus =
  | 'APPROVED'            // traduction disponible et approuvée
  | 'KNOWN_UNTRANSLATED'  // entrée connue, aucune traduction proposée
  | 'PENDING_VALIDATION'  // une proposition existe mais n'est pas approuvée
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
| `KNOWN_UNTRANSLATED` | L'entrée existe, mais aucune proposition Éton n'existe | `null` | Conserver l'original ; compter « à traduire » |
| `PENDING_VALIDATION` | Une proposition existe, mais elle n'est pas approuvée | `null` (la proposition n'est **jamais** transmise) | Conserver l'original ; compter « en validation » |
| `NO_MATCH` | Aucune entrée ne correspond | `null` | Conserver l'original ; compter « inconnu » |
| `AMBIGUOUS` | Plusieurs entrées correspondent et le contexte ne départage pas | `null` | Conserver l'original ; compter « ambigu » |
| `PROTECTED` | Valeur protégée, entrée protégée ou hors périmètre | `null` | Ne rien faire |

### 5.2 Correspondance avec les statuts de la bibliothèque

La bibliothèque utilise trois niveaux (PROJECT_CONTEXT §4.5) : la **disposition** de l'entrée, le **statut de traduction** (statuts D5) et la **validation**.

| État de l'entrée dans `data/` | Statut renvoyé |
|---|---|
| `disposition = PROTECTED` | `PROTECTED` (`protected-entry`) |
| `disposition = OUT_OF_SCOPE` | `PROTECTED` (`out-of-scope`) |
| Texte composé uniquement de valeurs protégées | `PROTECTED` (`protected-value`) |
| `translationStatus = VALIDATED_OBALA`, `financialMeaning = VALIDATED`, cible non nulle, variables identiques (et règle de double relecture, Q18) | `APPROVED` |
| Proposition présente (`DICTIONARY_ATTESTED`, `CONTEXT_PENDING`, `REVIEW_PENDING`, ou `VALIDATED_OBALA` dont le sens financier n'est pas encore validé) | `PENDING_VALIDATION` |
| `TRANSLATION_PENDING` sans proposition | `KNOWN_UNTRANSLATED` |
| Plusieurs entrées retenues | `AMBIGUOUS` |
| Aucune entrée | `NO_MATCH` |

`SOURCE_EXTRACTED` est un statut **côté source** : il ne produit pas de statut de résultat particulier.

### 5.3 Ordre de résolution (proposé)

1. Texte vide, blanc ou trop long → `NO_MATCH`.
2. Texte composé uniquement de valeurs protégées et de ponctuation → `PROTECTED`.
3. Recherche dans la bibliothèque : exacte, puis normalisée, puis variantes approuvées, puis gabarits à variables typées, puis « libellé + séparateur + valeur protégée ». **Aucune similarité floue.**
4. Plusieurs entrées : départage par `context.role` et `context.step`. S'il en reste plusieurs → `AMBIGUOUS`.
5. Une seule entrée : statut selon §5.2.

**Proposition `'auto'` (Q16) :** le moteur cherche en `fr` et en `en`. Si une seule langue trouve une entrée, cette entrée est retenue. Si les deux trouvent **la même** entrée, elle est retenue. Si elles trouvent des entrées **différentes**, `context.pageLang` départage ; à défaut, le résultat est `AMBIGUOUS` (`multiple-languages`). Cela couvre le cas d'un message anglais injecté par le jury dans la page française.

## 6. Contexte : champs autorisés

- **Autorisé :** énumérations et booléens décrivant la **nature** du texte (`role`, `step`, `live`, `pageLang`).
- **Interdit :** tout contenu de la page autre que `text` (textes voisins, valeurs, noms, URL, sélecteurs CSS, identifiants DOM).
- Un contexte absent ou incomplet ne doit **jamais** conduire à une traduction devinée. Il peut seulement conduire à `AMBIGUOUS`.

## 7. Garanties du moteur (invariants testés)

| # | Invariant |
|---|---|
| I1 | **Pureté** : aucune dépendance au DOM, à `chrome.*`, au réseau, au stockage ou à l'horloge. Aucune journalisation de texte. |
| I2 | **Totalité** : `translate` ne lève jamais d'exception, quelle que soit la chaîne (vide, 100 000 caractères, émojis, caractères de contrôle, surrogates isolés). Il renvoie toujours un statut valide. |
| I3 | `output !== null` ⇔ `status === 'APPROVED'`. |
| I4 | Les espaces de début et de fin de `text` sont reproduits à l'identique dans `output`. |
| I5 | Chaque élément de `protectedSegments` apparaît dans `output` avec la même multiplicité, octet par octet. Le multiensemble des chiffres de `output` est identique à celui de `text`. |
| I6 | Une cible non approuvée n'est **jamais** présente dans le lexique d'exécution. Elle ne peut donc pas être renvoyée. |
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
| Correspondance, statut, ambiguïté | ✅ | Ne réimplémente rien |
| Valeurs protégées dans un texte | ✅ Les renvoie dans `protectedSegments` | ✅ **Revérifie** l'intégrité avant chaque écriture (défense en profondeur) |
| Définition des motifs protégés (montant, devise, téléphone, référence…) | **Module partagé unique : Q14** | **Module partagé unique : Q14** |
| Écriture, restauration, anti-boucle, affichage du français au survol | — | ✅ |
| Contenu et versions de la bibliothèque | ✅ | — |
| Compteurs du popup | Fournit `status` et `entryId` | ✅ Agrège, sans texte |

**Proposition Q14 :** les motifs protégés sont définis **une seule fois**, dans un module pur sans DOM (ex. `src/protection/patterns.ts`, propriétaire Yvan). Le moteur le reçoit par **injection**, par exemple `createEngine({ detectProtected })`. Tant que le module n'existe pas, le moteur est testé avec une implémentation de test. Une suite commune, construite sur les exemples de D5 §4, vérifie les deux côtés.

## 9. Faux moteur (exigences)

Le faux moteur d'Yvan doit :

1. implémenter `TranslationEngine` avec `engineId: 'fake'` ;
2. produire des `output` **visiblement factices**, par exemple `⟦FAKE⟧ ` suivi du texte original. Il ne doit **jamais** produire une chaîne qui ressemble à de l'Éton ;
3. couvrir **les six statuts** à partir d'une table fixe de textes fictifs FR et EN ;
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
  2. revue par Yvan **obligatoire** ;
  3. entrée dans l'historique (§13) avec les conséquences ;
  4. procédure de migration si la version est majeure ;
  5. suite de conformité mise à jour **dans la même PR**.

## 11. Suite de conformité

- Emplacement proposé : `tests/contract/`, **copropriété** des deux membres.
- Elle exécute les **mêmes** cas sur le faux moteur et sur le vrai moteur. Le remplacement est sûr si les deux passent.
- Contenu : les invariants I2 à I5, I8 et I10, un cas par statut, et les exemples D5 §4 de valeurs protégées.
- Les cibles de test sont marquées `⟦TEST:<id>⟧`. **Aucune forme Éton réelle n'est utilisée dans les tests du contrat.**

## 12. Exemples (cibles fictives)

Les sorties ci-dessous utilisent des **marqueurs de test**. Ce ne sont pas des traductions.

| Requête (`text`, `sourceLang`, contexte) | Hypothèse de bibliothèque de test | Résultat attendu |
|---|---|---|
| `"Frais de transfert"`, `fr`, `role: heading` | P2-001 approuvée | `APPROVED`, `output: "⟦TEST:P2-001⟧"`, `matchKind: exact` |
| `"Frais : 0 FCFA"`, `fr` | VOC-028 « Frais » approuvée | `APPROVED`, `output: "⟦TEST:VOC-028⟧ : 0 FCFA"`, `matchKind: label-value`, `protectedSegments: ["0", "FCFA"]` |
| `"  Montant  "`, `fr` | VOC-023 sans proposition | `KNOWN_UNTRANSLATED`, `entryId: "VOC-023"`, `output: null` |
| `"Confirmer le transfert"`, `fr` | P4-012 en `REVIEW_PENDING` | `PENDING_VALIDATION`, `output: null` |
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

## 14. Points ouverts (voir PROJECT_CONTEXT §5)

- **Q14** : propriété et emplacement du module de motifs protégés (§8).
- **Q15** : périmètre de l'anglais pour la présélection.
- **Q16** : acceptation de `sourceLang: 'auto'` (§5.3).
- **Q18** : double relecture obligatoire avant `APPROVED` pour les entrées critiques.
