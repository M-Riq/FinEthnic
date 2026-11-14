# FinEthnic — SAFINUM Éton

FinEthnic affiche en **éton** (variété d'Obala) les textes d'une interface financière, sans modifier le code de cette interface. Le premier prototype, **SAFINUM Éton**, est une extension Chrome (Manifest V3) qui fonctionne seulement sur l'environnement de test `https://safinum.cm/hackathon-test`, avec des données fictives.

Documents de référence : [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), [`ROADMAP.md`](ROADMAP.md), [`TEAM_WORKFLOW.md`](TEAM_WORKFLOW.md), [`INTEGRATION_CONTRACT.md`](INTEGRATION_CONTRACT.md), [`THIRD_PARTY.md`](THIRD_PARTY.md).

## Extension Chrome

> **État : phase 1.** L'extension s'installe, son popup règle l'activation, et le réglage est conservé. Elle **ne lit ni ne modifie encore la page** : la détection arrive en phase 2, l'affichage en éton en phase 5.

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

- **Traduction en éton** : interrupteur activé par défaut. Il se manipule au clavier (Tab, puis Espace ou Entrée) et son état est annoncé aux lecteurs d'écran.
- Le réglage est gardé dans `chrome.storage.local`, sur l'ordinateur. Il survit à la fermeture du popup et au redémarrage du navigateur.

### Développement

```sh
npm run build:dev    # construit dans dist-dev/
```

La construction de développement charge aussi le script sur `http://localhost` et `http://127.0.0.1` (pages de test locales). Elle écrit dans la console des événements sans aucun texte de page, par exemple `[FinEthnic:content] content:start {enabled: true}`. **Ne distribuez jamais `dist-dev/`.**

| Commande | Rôle |
|---|---|
| `npm test` | Tous les tests (Vitest ; ceux de l'extension sont dans `tests/extension/`) |
| `npm run typecheck` | Vérification des types : bibliothèque (`tsconfig.json`) et extension (`tsconfig.extension.json`) |
| `npm run build` / `npm run build:dev` | Construction de production / de développement |

ESLint (prévu par Q4) n'est pas encore installé : `typescript-eslint` ne prend pas en charge TypeScript 7.

### Sécurité

- Seule permission : `storage`. Aucune `host_permissions`, aucun service worker.
- Le script de contenu ne s'exécute que sur `https://safinum.cm/hackathon-test*`, dans le cadre principal.
- Aucune requête réseau. `build.mjs` **refuse de construire** si le code produit contient `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import()`, `eval`, `Function(…)`, `setTimeout` avec une chaîne, `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou `document.write`, ou, en production, le faux moteur (`⟦FAKE⟧`, contrat §9).
- Le journal n'accepte que des nombres et des booléens : aucun texte de la page ne peut y figurer.

### Organisation du code de l'extension

```text
manifest.json         manifest de production
manifest.dev.json     manifest de développement (+ localhost)
build.mjs             construction esbuild et contrôles du code produit
icons/                icônes 16, 32, 48 et 128 px
src/content/          script de contenu (index.ts : point d'entrée ; controller.ts : cycle de vie)
src/popup/            popup (HTML, CSS, logique)
src/shared/           réglages, accès à chrome.storage, journal sans données
tests/extension/      tests Vitest (réglages, popup sous jsdom, manifest, construction)
```

## Bibliothèque linguistique et moteur

Section tenue par le responsable du projet (`data/`, `scripts/`, `src/language/`) : voir `PROJECT_CONTEXT.md` §4 et la piste BM de `ROADMAP.md`. L'extension n'utilise le moteur qu'au travers du contrat `src/language/contract.ts`.
