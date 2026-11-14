# FinEthnic — SAFINUM Éton

FinEthnic affiche en **éton** (variété d'Obala) les textes d'une interface financière, sans modifier le code de cette interface. Le premier prototype, **SAFINUM Éton**, est une extension Chrome (Manifest V3) qui fonctionne seulement sur l'environnement de test `https://safinum.cm/hackathon-test`, avec des données fictives.

Documents de référence : [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), [`ROADMAP.md`](ROADMAP.md), [`TEAM_WORKFLOW.md`](TEAM_WORKFLOW.md), [`INTEGRATION_CONTRACT.md`](INTEGRATION_CONTRACT.md), [`THIRD_PARTY.md`](THIRD_PARTY.md).

## Extension Chrome

> **État : phase 2 (lecture seule).** L'extension s'installe, son popup règle l'activation, et elle **détecte** les textes de la page, sans jamais la modifier. Un mode diagnostic les surligne et les compte. L'affichage en éton arrive en phase 5. La version de production n'a pas encore de moteur de traduction (inclusion à décider, BM7) : elle compte les textes sans les évaluer.

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

Sont ignorés : champs de saisie et listes déroulantes (`select`, Q8), zones modifiables, code, scripts, contenus masqués (`hidden`, `aria-hidden`), images vectorielles et médias. Le popup ne reçoit que des compteurs, jamais de texte.

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
src/protection/       dom-guard.ts : régions de la page jamais lues
src/popup/            popup (HTML, CSS, logique)
src/shared/           réglages, accès à chrome.storage, journal sans données, messages popup ⇄ page
tests/extension/      tests Vitest sous jsdom (détection, observation, diagnostic, popup, manifest, construction)
tests/fixtures/       page de test locale SAFINUM (5 étapes, données fictives)
```

## Bibliothèque linguistique et moteur

Section tenue par le responsable du projet (`data/`, `scripts/`, `src/language/`) : voir `PROJECT_CONTEXT.md` §4 et la piste BM de `ROADMAP.md`. L'extension n'utilise le moteur qu'au travers du contrat `src/language/contract.ts`.
