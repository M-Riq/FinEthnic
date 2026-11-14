# FinEthnic — SAFINUM Éton

FinEthnic affiche en **éton** (variété d'Obala) les textes d'une interface financière, sans modifier le code de cette interface. Le premier prototype, **SAFINUM Éton**, est une extension Chrome (Manifest V3) qui fonctionne seulement sur l'environnement de test `https://safinum.cm/hackathon-test`, avec des données fictives.

Documents de référence : [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md), [`ROADMAP.md`](ROADMAP.md), [`TEAM_WORKFLOW.md`](TEAM_WORKFLOW.md), [`INTEGRATION_CONTRACT.md`](INTEGRATION_CONTRACT.md), [`THIRD_PARTY.md`](THIRD_PARTY.md).

## Extension Chrome

> **État : phases 5 à 7 terminées sur la page de test, avec le vrai moteur (BM7).** L'extension détecte les textes de la page, met à part les valeurs à ne jamais traduire (montants, références, noms, saisies réaffichées…), puis **remplace** les libellés traduits par le moteur, sans toucher à la structure de la page. Les traductions non vérifiées portent un marqueur (aucune n'est encore validée par une locutrice), le français reste lisible au survol et au focus (ou en mode bilingue), et désactiver la traduction rend la page à l'identique. Résultats : [`docs/test-report.md`](docs/test-report.md) ; architecture et limites : [`docs/note-technique.md`](docs/note-technique.md).

### Installation

Prérequis : Chrome ≥ 110.

**Depuis le ZIP** (`finethnic-safinum-eton-<version>.zip`, produit par `npm run package`) : le décompresser dans un dossier, puis suivre les étapes Chrome ci-dessous en choisissant ce dossier.

**Depuis les sources** (Node.js ≥ 20) : le build de production embarque le moteur et ses ressources, dont le dictionnaire D7, qui n'est jamais dans Git (Q17). Placer le fichier D7 reçu en privé dans `data/language-resources/raw/`, puis :

```sh
npm ci
npm run import-dictionary   # une fois : importe D7 (hors Git)
npm run build               # construit l'extension dans dist/
```

Sans D7, `npm run build` s'arrête et indique la commande à lancer ; `node build.mjs --engine none` construit une extension sans moteur (elle compte les textes sans rien afficher).

Dans Chrome :

1. Ouvrir `chrome://extensions`.
2. Activer le **Mode développeur** (en haut à droite).
3. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `dist/` (ou le dossier du ZIP décompressé).
4. Épingler l'extension (icône de pièce de puzzle), puis ouvrir son popup.

Chrome doit annoncer une seule autorisation : **« Lire et modifier vos données sur safinum.cm »**. Ouvrez l'environnement de test **directement** à l'adresse `https://safinum.cm/hackathon-test` : le script de l'extension n'est pas chargé si l'application est ouverte depuis une autre adresse.

Après une nouvelle construction, cliquez sur le bouton de rechargement de l'extension dans `chrome://extensions`, puis rechargez la page.

Avec la traduction activée, les premiers textes en éton apparaissent environ une seconde après l'ouverture de la page : c'est le temps de construction du moteur. Traduction désactivée, le moteur n'est pas construit.

### Popup

- **Traduction en éton** : interrupteur activé par défaut. Il se manipule au clavier (Tab, puis Espace ou Entrée) et son état est annoncé aux lecteurs d'écran. Désactivé, la page n'est plus analysée et retrouve tous ses textes d'origine.
- **Afficher les traductions non vérifiées** : activé par défaut (Q9). Désactivé, ces textes restent en français ; ils sont toujours comptés.
- **Mode bilingue** : désactivé par défaut (Q3). Activé, le français suit l'éton entre parenthèses : c'est le mode à conseiller avec un lecteur d'écran.
- **Cette page** : nombre de textes affichés en éton, dont non vérifiés, et nombre de textes qui restent à traduire. Aucun texte de la page n'est transmis au popup.
- **Mode diagnostic** : désactivé par défaut. Activé, il surligne les textes détectés dans la page et affiche leurs compteurs dans le popup (bouton **Actualiser** pour relire la page).
- Les réglages sont gardés dans `chrome.storage.local`, sur l'ordinateur. Ils survivent à la fermeture du popup et au redémarrage du navigateur.

### Affichage en éton

- **Ce qui est affiché** : la traduction validée (`APPROVED`) ; la traduction non vérifiée (`PENDING_VALIDATION`) si l'option est active. Tout autre statut garde le texte français. La sortie du moteur est affichée telle quelle (contrat §2-3).
- **Comment** : seul le texte des nœuds traduits change (`Text.data`). Aucun nœud ni attribut n'est ajouté à la page, rien n'est écrit avec `innerHTML`. Les originaux restent en mémoire, dans la page seulement.
- **Marqueurs** (*CSS Custom Highlight API*, toujours visibles) : souligné **en tirets** bleu pour une traduction automatique pas encore vérifiée par une locutrice, **ondulé** bleu pour un brouillon incomplet (les mots entre crochets sont restés en français). Pas de marqueur sur une traduction validée.
- **Français au survol et au focus** : une infobulle donne le texte d'origine et la nature de la traduction. Elle est placée hors de `<body>`, dans une racine fantôme fermée, et n'existe que tant qu'elle est visible ; Échap la ferme. Les lecteurs d'écran ne la lisent pas : utilisez le mode bilingue.
- **Contrôle d'intégrité** avant chaque écriture : si une valeur protégée (montant, référence, nom…) diffère entre l'original et la traduction, le texte reste en français (compté « Écartés » dans le diagnostic).
- **Application monopage** : si l'application remet un texte, il est retraduit sans boucle ; nos propres écritures ne déclenchent aucune réévaluation (vérifié : 0 mutation en 5 s d'inactivité). L'étape du parcours et les libellés « … : » qui protègent la valeur suivante sont lus en français d'origine, même traduits.
- **Restauration** : désactiver la traduction, ou l'option « non vérifiées », remet le texte d'origine dans le même nœud. Un texte que l'application a changé entre-temps n'est pas touché.

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

Le diagnostic porte sur le texte affiché : un libellé traduit est surligné dans sa version éton. Les marqueurs des traductions non vérifiées (ci-dessus) restent visibles hors diagnostic.

Sont ignorés : champs de saisie et listes déroulantes (`select`, Q8), zones modifiables, code, scripts, contenus masqués (`hidden`, `aria-hidden`), images vectorielles et médias. Le popup ne reçoit que des compteurs, jamais de texte.

### Protection des données

Règle : mieux vaut ne pas traduire un libellé que modifier une valeur. Un texte n'est jamais envoyé au moteur s'il est :

- **une valeur par sa place** : cellule `dd`, seconde cellule d'une ligne de deux, élément qui suit un libellé terminé par « : », `output`, `time`, `data`, `meter`, `progress`, lien `tel:`, `mailto:` ou `sms:`, ou élément dont la classe, l'`id`, le `name`, l'`itemprop` ou le `data-testid` contient un mot comme `amount`, `montant`, `balance`, `solde`, `name`, `nom`, `ref`, `phone`, `email` ou `value`. Ces indices ne servent qu'à exclure, jamais à autoriser une traduction ;
- **l'écho d'une saisie** : texte identique à une valeur de champ (ex. un motif tapé à l'étape 3 et réaffiché à l'étape 4). Seules des empreintes de ces valeurs sont gardées, en mémoire ; les mots de passe ne sont jamais lus.

Dans les autres textes, `src/protection/patterns.ts` repère les valeurs protégées : montants (espaces normales ou insécables, signes `+`, `-`, `−`), devises, pourcentages, dates, heures, téléphones, comptes, références, e-mails, URL, marques `Safinum` et `Safinum Pay`, et tout mot qui contient un chiffre. Le moteur reçoit ce module (`detectProtected`). Avant toute écriture, `src/protection/integrity.ts` vérifie que ces valeurs, et les segments signalés par le moteur, restent identiques octet par octet ; sinon l'écriture est refusée et le français reste affiché.

### Développement

```sh
npm run build:dev    # construit dans dist-dev/
```

La construction de développement charge aussi le script sur `http://localhost` et `http://127.0.0.1` (pages de test locales) et utilise par défaut le **faux moteur** (`src/content/fake-engine.ts`, contrat §9) : ses « traductions » commencent par `⟦FAKE⟧` et ne sont pas de l'éton. Elle écrit dans la console des événements sans aucun texte de page, par exemple `[FinEthnic:content] content:scan {roots: 1, candidates: 26, …}`. **Ne distribuez jamais `dist-dev/`.**

Le moteur se choisit à la construction avec `--engine` : `real` (vrai moteur, défaut en production, D7 requis), `fake` (développement seulement, refusé en production) ou `none`. Exemple, le vrai moteur sur les pages locales : `node build.mjs --dev --engine real`.

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
| `npm run e2e-extension` | Banc Chrome : build de production chargé dans Chrome sans interface, parcours des 5 étapes, injections, charge de 500 nœuds, script de démonstration, audit réseau et stockage (D7 requis ; `-- --dist <dossier>` pour tester un dossier déjà construit, `-- --chrome <chemin>` pour un autre Chrome) |
| `npm run package` | Build de production, contrôles, puis `release/finethnic-safinum-eton-<version>.zip` avec les avis de licence (`LICENCES.txt`, LGPL-LR) |

**Démonstration** (P7) : avec l'extension installée et la page de test ouverte, coller `docs/demo/inject-samples.js` dans la console DevTools, puis lancer `finethnicDemo.tout()` (tous les échantillons à la suite) ou un échantillon seul (`finethnicDemo.proche()`, `finethnicDemo.charge(500)`…). Le script imite l'application : il n'écrit que dans son propre panneau, en haut de la page.

ESLint (prévu par Q4) n'est pas encore installé : `typescript-eslint` ne prend pas en charge TypeScript 7.

### Sécurité

- Seule permission : `storage`. Aucune `host_permissions`, aucun service worker.
- Le script de contenu ne s'exécute que sur `https://safinum.cm/hackathon-test*`, dans le cadre principal. Il ne modifie que le texte des libellés traduits, jamais la structure : aucun nœud ni attribut ajouté dans `<body>`, et HTML identique après désactivation (vérifié par test et dans Chrome). Sans moteur, il ne modifie rien.
- Le moteur est embarqué dans `content.js` : aucun appel à un service, aucune donnée de la page ne sort du navigateur.
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
                      renderer.ts (seule écriture dans la page, restauration), tooltip.ts (français au survol),
                      diagnostic.ts et content.css (compteurs, surlignage, marqueurs), messaging.ts (popup),
                      engine-provider.ts (seul choix du moteur), engine-resources.ts (ressources du vrai moteur
                      dans le bundle), fake-engine.ts (développement)
src/protection/       dom-guard.ts (régions jamais lues, positions « valeur »), patterns.ts (valeurs protégées,
                      module pur partagé avec le moteur), echo.ts (saisies réaffichées), integrity.ts (contrôle
                      avant écriture, empreinte de page)
src/popup/            popup (HTML, CSS, logique)
src/shared/           réglages, accès à chrome.storage, journal sans données, messages popup ⇄ page
tests/extension/      tests Vitest (détection, observation, diagnostic, protection, intégrité, affichage, popup, manifest,
                      construction, paquet ZIP)
tests/fixtures/       page de test locale SAFINUM (5 étapes, données fictives)
scripts/e2e-extension.ts, scripts/lib/cdp.ts, scripts/lib/e2e-probe.js
                      banc Chrome (pilotage CDP, sonde dans la page)
scripts/package-extension.ts, scripts/lib/extension-package.ts
                      paquet ZIP de production
docs/demo/            script d'injection de démonstration (P7)
```

## Bibliothèque linguistique et moteur

Section tenue par le responsable du projet (`data/`, `scripts/`, `src/language/`) : voir `PROJECT_CONTEXT.md` §4 et la piste BM de `ROADMAP.md`. L'extension n'utilise le moteur qu'au travers du contrat `src/language/contract.ts`.
