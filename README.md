# FinEthnic — SAFINUM Éton

FinEthnic affiche en **éton** (variété d'Obala) les textes d'une interface financière, sans modifier le code de cette interface. Le premier prototype, **SAFINUM Éton**, est une extension Chrome (Manifest V3) qui fonctionne seulement sur l'environnement de test `https://safinum.cm/hackathon-test`, avec des données fictives.

Documents de référence : [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), [`ROADMAP.md`](ROADMAP.md), [`TEAM_WORKFLOW.md`](TEAM_WORKFLOW.md), [`INTEGRATION_CONTRACT.md`](INTEGRATION_CONTRACT.md), [`THIRD_PARTY.md`](THIRD_PARTY.md).

## Extension Chrome

> **État : phase 3 (lecture seule, protection des données).** L'extension s'installe, son popup règle l'activation, et elle **détecte** les textes de la page, sans jamais la modifier. Elle met à part les valeurs à ne jamais traduire (montants, références, noms, saisies réaffichées…). Un mode diagnostic les surligne et les compte. L'affichage en éton arrive en phase 5. La version de production n'a pas encore de moteur de traduction (inclusion à décider, BM7) : elle compte les textes sans les évaluer.

### Installation

Prérequis : Node.js ≥ 20 et Chrome ≥ 110.

```sh
npm ci
npm run build        # construit l'extension dans dist/
```

Dans Chrome :

1. Ouvrir `chrome://extensions`.
2. Activer le **Mode développeur** (en haut à droite).
3. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `dist/`.
4. Épingler l'extension (icône de pièce de puzzle), puis ouvrir son popup.

Chrome doit annoncer une seule autorisation : **« Lire et modifier vos données sur safinum.cm »**. Ouvrez l'environnement de test **directement** à l'adresse `https://safinum.cm/hackathon-test` : le script de l'extension n'est pas chargé si l'application est ouverte depuis une autre adresse.

Après une nouvelle construction, cliquez sur le bouton de rechargement de l'extension dans `chrome://extensions`, puis rechargez la page.

### Popup

- **Traduction en éton** : interrupteur activé par défaut. Il se manipule au clavier (Tab, puis Espace ou Entrée) et son état est annoncé aux lecteurs d'écran. Désactivé, la page n'est plus analysée.
- **Mode diagnostic** : désactivé par défaut. Activé, il surligne les textes détectés dans la page et affiche leurs compteurs dans le popup (bouton **Actualiser** pour relire la page).
- Les réglages sont gardés dans `chrome.storage.local`, sur l'ordinateur. Ils survivent à la fermeture du popup et au redémarrage du navigateur.

### Mode diagnostic

Le surlignage passe par la *CSS Custom Highlight API* : **aucun nœud, attribut ni style n'est ajouté à la page**. Chaque catégorie a sa propre forme de trait (la couleur n'est pas le seul repère) ; la légende est reprise dans le popup.

| Trait | Catégorie |
|---|---|
| Souligné plein, vert | Traduit (approuvé) |
| Souligné en tirets, bleu | Traduction non vérifiée |
| Souligné ondulé, bleu | Brouillon incomplet |
| Souligné en pointillés, ambre | Connu, pas encore traduit |
| Souligné double, rouge | Inconnu |
| Souligné et surligné ondulés, violet | Ambigu |
| Surligné plein, gris | Protégé (jamais traduit) |
| Souligné et surligné en pointillés, gris | Pas encore évalué (ou aucun moteur) |
| Surligné en pointillés, gris | Valeur faite de chiffres, sans lettre |
| Surligné double, gris foncé | Valeur protégée par sa place (voir ci-dessous) |

Sont ignorés : champs de saisie et listes déroulantes (`select`, Q8), zones modifiables, code, scripts, contenus masqués (`hidden`, `aria-hidden`), images vectorielles et médias. Le popup ne reçoit que des compteurs, jamais de texte.

### Protection des données

Règle : mieux vaut ne pas traduire un libellé que modifier une valeur. Un texte n'est jamais envoyé au moteur s'il est :

- **une valeur par sa place** : cellule `dd`, seconde cellule d'une ligne de deux, élément qui suit un libellé terminé par « : », `output`, `time`, `data`, `meter`, `progress`, lien `tel:`, `mailto:` ou `sms:`, ou élément dont la classe, l'`id`, le `name`, l'`itemprop` ou le `data-testid` contient un mot comme `amount`, `montant`, `balance`, `solde`, `name`, `nom`, `ref`, `phone`, `email` ou `value`. Ces indices ne servent qu'à exclure, jamais à autoriser une traduction ;
- **l'écho d'une saisie** : texte identique à une valeur de champ (ex. un motif tapé à l'étape 3 et réaffiché à l'étape 4). Seules des empreintes de ces valeurs sont gardées, en mémoire ; les mots de passe ne sont jamais lus.

Dans les autres textes, `src/protection/patterns.ts` repère les valeurs protégées : montants (espaces normales ou insécables, signes `+`, `-`, `−`), devises, pourcentages, dates, heures, téléphones, comptes, références, e-mails, URL, marques `Safinum` et `Safinum Pay`, et tout mot qui contient un chiffre. Le moteur reçoit ce module (`detectProtected`). Avant toute écriture (phase 5), `src/protection/integrity.ts` vérifiera que ces valeurs restent identiques octet par octet, sinon l'écriture sera refusée.

### Développement

```sh
npm run build:dev    # construit dans dist-dev/
```

La construction de développement charge aussi le script sur `http://localhost` et `http://127.0.0.1` (pages de test locales) et utilise le **faux moteur** (`src/content/fake-engine.ts`, contrat §9) : ses « traductions » commencent par `⟦FAKE⟧` et ne sont pas de l'éton. Elle écrit dans la console des événements sans aucun texte de page, par exemple `[FinEthnic:content] content:scan {roots: 1, candidates: 26, …}`. **Ne distribuez jamais `dist-dev/`.**

Page de test locale (5 étapes, données fictives, structure supposée en attendant le relevé du DOM réel, Q20) :

```sh
npm run build:dev
python3 -m http.server 8000 --directory tests/fixtures
# Charger dist-dev/ dans Chrome, puis ouvrir http://localhost:8000/safinum-test.html
```

| Commande | Rôle |
|---|---|
| `npm test` | Tous les tests (Vitest ; ceux de l'extension sont dans `tests/extension/`) |
| `npm run typecheck` | Vérification des types : bibliothèque (`tsconfig.json`) et extension (`tsconfig.extension.json`) |
| `npm run build` / `npm run build:dev` | Construction de production / de développement |

ESLint (prévu par Q4) n'est pas encore installé : `typescript-eslint` ne prend pas en charge TypeScript 7.

### Sécurité

- Seule permission : `storage`. Aucune `host_permissions`, aucun service worker.
- Le script de contenu ne s'exécute que sur `https://safinum.cm/hackathon-test*`, dans le cadre principal. Il lit la page sans la modifier (vérifié par test : aucune mutation, HTML identique).
- Le popup ne répond qu'aux messages de l'extension elle-même ; les réponses ne contiennent que des compteurs.
- Aucune requête réseau. `build.mjs` **refuse de construire** si le code produit contient `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import()`, `eval`, `Function(…)`, `setTimeout` avec une chaîne, `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou `document.write`, ou, en production, le faux moteur (`⟦FAKE⟧`, contrat §9).
- Le journal n'accepte que des nombres et des booléens : aucun texte de la page ne peut y figurer.

### Organisation du code de l'extension

```text
manifest.json         manifest de production
manifest.dev.json     manifest de développement (+ localhost)
build.mjs             construction esbuild et contrôles du code produit
icons/                icônes 16, 32, 48 et 128 px
src/content/          script de contenu : index.ts (point d'entrée), controller.ts (cycle de vie),
                      scanner.ts, observer.ts, context.ts, pipeline.ts (lecture et évaluation),
                      diagnostic.ts et content.css (compteurs, surlignage), messaging.ts (popup),
                      engine-provider.ts (seul choix du moteur), fake-engine.ts (développement)
src/protection/       dom-guard.ts (régions jamais lues, positions « valeur »), patterns.ts (valeurs protégées,
                      module pur partagé avec le moteur), echo.ts (saisies réaffichées), integrity.ts (contrôle
                      avant écriture, empreinte de page)
src/popup/            popup (HTML, CSS, logique)
src/shared/           réglages, accès à chrome.storage, journal sans données, messages popup ⇄ page
tests/extension/      tests Vitest (détection, observation, diagnostic, protection, intégrité, popup, manifest, construction)
tests/fixtures/       page de test locale SAFINUM (5 étapes, données fictives)
```

## Bibliothèque linguistique et moteur

Section tenue par le responsable du projet (`data/`, `scripts/`, `src/language/`) : voir `PROJECT_CONTEXT.md` §4 et la piste BM de `ROADMAP.md`. L'extension n'utilise le moteur qu'au travers du contrat `src/language/contract.ts`.
