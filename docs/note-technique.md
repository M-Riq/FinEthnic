# Note technique — FinEthnic / SAFINUM Éton

Version : 2026-11-15 · extension 0.1.0 · contrat **v0.4.0**

Livrable P8.7 (ROADMAP). Ce document couvre **l'extension Chrome** (piste EXT, Yvan). Les sections sur la bibliothèque linguistique, le moteur MOT et la méthode de validation linguistique (P8.8) sont tenues par le responsable du projet : voir `PROJECT_CONTEXT.md` §4, la piste MOT de `ROADMAP.md` et `INTEGRATION_CONTRACT.md`.

## 1. Rôle et principes

L'extension affiche en éton les libellés d'une interface financière **sans modifier son code ni sa structure**. Principes appliqués partout :

- **Mieux vaut ne pas traduire qu'altérer une valeur** (C5) : un montant, un nom, une référence ou une saisie n'est jamais envoyé au moteur ni réécrit.
- **Lecture d'abord, écriture minimale** : la seule écriture dans la page est `Text.data` d'un nœud texte traduit ; aucun nœud ni attribut ajouté dans `<body>`, rien n'est écrit avec `innerHTML`.
- **Réversible** : désactiver la traduction rend le HTML identique à celui de la page sans extension.
- **Aucune donnée ne sort** : aucune requête réseau, rien dans le stockage de la page ; le popup ne reçoit que des compteurs ; le journal n'accepte que des nombres et des booléens.

## 2. Architecture

```text
            chrome.storage.local (réglages seulement)
                     │
popup ── messages ── content script (https://safinum.cm/hackathon-test*, cadre principal)
(compteurs)          │
                     controller ── réglages, cycle de vie, moteur construit à la première activation
                       │
                       pipeline ── scanner (TreeWalker) + observer (MutationObserver, un lot par trame)
                       │             └─ dom-guard, echo : régions jamais lues, valeurs par leur place, saisies
                       │           → contexte (rôle, zone live, étape) → moteur (contrat v0.4.0)
                       │           → integrity : valeurs protégées identiques octet par octet ?
                       │
                       renderer ── seule écriture (Text.data), originaux en mémoire, restauration
                       tooltip  ── français au survol et au focus (racine fantôme fermée, hors de <body>)
                       diagnostic ── compteurs et surlignage (CSS Custom Highlight API)
```

| Module | Rôle |
|---|---|
| `src/content/index.ts` | Point d'entrée ; relie Chrome (stockage, messages) au contrôleur |
| `src/content/controller.ts` | Cycle de vie : démarrage, arrêt, changement d'options ; construit le moteur à la première activation, une seule fois |
| `src/content/scanner.ts`, `observer.ts`, `context.ts` | Lecture des textes au chargement et après chaque mutation ; contexte transmis au moteur |
| `src/content/pipeline.ts` | File d'attente, appels au moteur par tranches, contrôle d'intégrité, décisions d'affichage |
| `src/content/renderer.ts` | Écriture et restauration des nœuds texte ; anti-boucle |
| `src/content/tooltip.ts` | Infobulle du texte d'origine |
| `src/content/diagnostic.ts`, `content.css` | Compteurs par statut, surlignage, marqueurs « non vérifié » et « partiel » |
| `src/content/engine-provider.ts` | **Seul** fichier qui choisit un moteur (vrai, faux ou aucun) |
| `src/content/engine-resources.ts` | Ressources du vrai moteur sérialisées dans le bundle, relues sans requête |
| `src/protection/*` | `dom-guard` (régions exclues, positions « valeur »), `patterns` (valeurs protégées, partagé avec le moteur), `echo` (saisies réaffichées), `integrity` (contrôle avant écriture) |
| `src/popup/*`, `src/shared/*` | Popup accessible, réglages, messages popup ⇄ page, journal sans données |

## 3. Intégration du moteur (BM7)

- L'extension ne connaît que l'interface `TranslationEngine` de `src/language/contract.ts`. Elle n'importe `src/engine/` que dans `engine-provider.ts`.
- `node build.mjs --engine real|fake|none` fixe le moteur à la construction. Par défaut : `real` en production, `fake` en développement. Le faux moteur est refusé en production.
- Avec `real`, `build.mjs` lit sur le poste les ressources du moteur (D8, extrait de Lefff, D7 importé hors Git) et les injecte dans `content.js` sous forme de chaînes. Sans D7, la construction échoue avec la commande à lancer (`npm run import-dictionary`, ou `--engine none`).
- Le moteur reçoit les motifs protégés de l'extension (`detectProtected`, Q14). Ses `protectedSegments` sont revérifiés par `integrity` avant chaque écriture.
- Version du contrat vérifiée par `info().contractVersion` au démarrage (T-CON-07) : un moteur d'une autre version, ou qui échoue à se construire, est remplacé par l'absence de moteur. La page reste alors en français.
- Les sorties sont affichées sans retouche : `output` (`APPROVED`) sans marqueur, `unverifiedOutput` (`PENDING_VALIDATION`) avec un marqueur « non vérifié » (tirets) ou « partiel » (vagues), si l'option est active (Q9). Tout autre statut garde le français.

## 4. Performance

- **Moteur paresseux** : une page où la traduction est désactivée ne construit pas le moteur (plus longue tâche au chargement : ~900 ms → 0 à 80 ms).
- **Tranches de temps** : au plus 200 textes par trame, évalués par paquets de 10 ; l'évaluation rend la main après 30 ms et reprend à la trame suivante. Pire cas mesuré (500 textes tous différents) : plus longue tâche ~70 ms au lieu de 550 ms.
- **Cache du moteur** : le moteur garde ses 1 000 derniers résultats ; 500 nœuds de 10 messages répétés sont affichés en ~40 ms. Côté extension, un nœud déjà évalué et inchangé n'est pas resoumis.
- **Coût restant** : avec la traduction activée, le premier texte en éton apparaît ~1 à 1,5 s après la navigation. La plus grande part vient du moteur (`info()` traduit les 375 textes du corpus pour ses compteurs, ~0,6 s).
- Taille : `content.js` ~3,3 Mo (ressources du moteur comprises), ZIP ~0,6 Mo.

Mesures détaillées : `docs/test-report.md`.

## 5. Sécurité et vie privée

- Permission unique : `storage`. Pas de `host_permissions`, pas de service worker. Script de contenu limité à `https://safinum.cm/hackathon-test*`, cadre principal.
- `build.mjs` refuse de construire si le code produit contient un accès réseau (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`), `import()`, `eval`, `Function(…)`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, ou le faux moteur en production. `npm run package` refait ce contrôle sur le dossier empaqueté.
- Les saisies ne sont jamais lues comme texte : seules des empreintes en mémoire servent à reconnaître une saisie réaffichée ; les mots de passe ne sont pas lus.
- Vérifié dans Chrome par `npm run e2e-extension` : aucune requête de l'extension, seule la clé `settings` dans son stockage, rien dans le stockage ni les cookies de la page.

## 6. Dépendances

Aucun paquet à l'exécution. Le bundle embarque deux données tierces : l'extrait de Lefff 3.4 (LGPL-LR) et des formes issues de D7 (CC BY-NC-SA 4.0). Le ZIP contient `LICENCES.txt` et la licence LGPL-LR. Détail : `THIRD_PARTY.md`.

## 7. Limites connues

- **Aucune traduction validée** par une locutrice aujourd'hui : tout texte en éton est affiché comme non vérifié, avec un marqueur et le français au survol.
- **Textes répartis sur plusieurs nœuds** (ex. `Votre transfert de <b>25 000 FCFA</b>…`) : laissés en français (hors MVP).
- **Contenu inconnu ou proche d'une entrée** : laissé en français et compté « à traduire » (choix de sécurité, C5).
- **Structure du site réel non relevée (Q20)** : la page de test locale est reconstruite depuis D5/D8 ; l'étape est lue dans le titre `h1` visible. À vérifier sur `https://safinum.cm/hackathon-test`.
- **Adresse** : le script ne s'exécute que sur `https://safinum.cm/hackathon-test*` (pas de `www.`, pas d'autre chemin).
- `select`/`option` non traduits (Q8) ; `lang="eto"` non posé (impact sur les lecteurs d'écran à confirmer) ; l'infobulle n'est pas lue par les lecteurs d'écran : utiliser le mode bilingue.
- Anglais non pris en charge (Q15).
- **Licence de D7** : CC BY-NC-SA 4.0, pas d'usage commercial ; le bundle qui embarque ses formes est diffusé sous la même licence (Q17). À revoir avant tout usage avec de vrais clients.
