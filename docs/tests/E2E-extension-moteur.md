# Test de bout en bout : extension ↔ moteur

Version : 2026-11-15 · contrat **v0.4.0** · moteur MOT (M1 à M27)

## But

Vérifier, avant de brancher le moteur dans l'extension, que :

1. l'API locale du moteur répond comme le contrat le décrit (partie A) ;
2. l'extension peut l'appeler depuis son propre contexte (partie B) ;
3. plus tard, quand le scanner (P2) et le remplacement (P5) existeront, que chaque statut s'affiche comme le dit le contrat §5.4 (partie C).

Les 15 cas et les résultats attendus sont dans `tests/e2e/engine-scenario.json`. Le test `tests/e2e/engine-scenario.test.ts` les vérifie en mémoire (il est sauté si D7 n'est pas importé). Le script `npm run e2e-check` les vérifie par l'API.

## Prérequis

1. `main` contient la PR #27 (moteur M21 à M27, contrat v0.4.0).
2. `npm ci`.
3. Le fichier D7 reçu **en privé** du responsable (il n'est jamais dans Git, Q17), placé dans `data/language-resources/raw/`, puis `npm run import-dictionary`.
4. Dans un premier terminal : `npm run serve-engine` (écoute sur `http://127.0.0.1:8787` uniquement).

Le terminal affiche `Contrat 0.4.0 · bibliothèque mot-0.1.0+…`. L'empreinte après `+` dépend des ressources (D8, D7, Lefff, règles). Avec les mêmes ressources que le responsable, elle vaut `mot-0.1.0+9913c13c`. Si elle diffère, les résultats peuvent différer : noter l'empreinte dans le rapport.

## Partie A — l'API seule

### A1. Vérification automatique

Dans un second terminal :

```bash
npm run e2e-check
```

Le script envoie chaque cas à `POST /contract/translate`, puis tous les cas en un seul lot (`{ "requests": [...] }`), et vérifie que le lot donne les mêmes résultats. Résultat attendu : `15 / 15 cas conformes` (code de sortie 0). Si le moteur tourne sur un autre port : `npm run e2e-check -- --url http://127.0.0.1:<port>`.

### A2. Les cas

| Cas | Texte envoyé | Statut attendu | Traduction attendue (`unverifiedOutput`) | À retenir |
|---|---|---|---|---|
| E01 | `Montant` | `PENDING_VALIDATION`, complète | `táŋ` | cas de base |
| E02 | `  Montant  ` | `PENDING_VALIDATION`, complète | `  táŋ  ` | les espaces du nœud sont gardés |
| E03 | `Solde disponible` | `PENDING_VALIDATION`, complète | `mɔ̀ní á compte` | `keptFrench: ["compte"]` |
| E04 | `Bonjour` | `PENDING_VALIDATION`, **partielle** | `pwág ì-búg ású kàd [bonjour] á [quelqu'un].` | mots entre crochets = restés en français |
| E05 | `Payer la facture` | `PENDING_VALIDATION`, complète | `yágnà facture` | absent de D8, composé (`entryId: null`), `keptFrench: ["facture"]` |
| E06 | `Frais de transfert : 0 FCFA` | `PENDING_VALIDATION`, complète | `táŋ : 0 FCFA` | modèle à variable, `0` et `FCFA` protégés |
| E07 | `Total à débiter : 5 000 FCFA` | `KNOWN_UNTRANSLATED` | — | entrée critique incomplète |
| E08 | `Votre compte` | `KNOWN_UNTRANSLATED` | — | aucun mot rendu en éton |
| E09 | `Montant ?` | `KNOWN_UNTRANSLATED` | — | la question ne serait pas gardée |
| E10 | `5 000 FCFA` | `PROTECTED` (`protected-value`) | — | valeur protégée |
| E11 | `Safinum Pay` | `PROTECTED` (`protected-entry`) | — | nom de marque |
| E12 | `Bienvenue chez nous` | `NO_MATCH` | — | inconnu |
| E13 | `Amount` (`sourceLang: "en"`) | `NO_MATCH` (`unsupported-language`) | — | anglais pas encore pris en charge (Q15) |
| E14 | `Montant` (`sourceLang: "auto"`) | `PENDING_VALIDATION` | `táŋ` | `detectedSourceLang: "fr"` |
| E15 | `x` répété 2 001 fois | `NO_MATCH` (`too-long`) | — | plus de 2 000 caractères |

Toutes ces traductions sont **non vérifiées** par une locutrice : aucune n'est `APPROVED` aujourd'hui.

### A3. À la main (facultatif)

```bash
curl -s http://127.0.0.1:8787/contract/info
curl -s -X POST http://127.0.0.1:8787/contract/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"Montant","sourceLang":"fr","targetLang":"eto"}'
```

CORS : seules les origines `chrome-extension://…` et `http://localhost` / `http://127.0.0.1` sont acceptées.

```bash
curl -s -D - -o /dev/null -H 'Origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop' \
  http://127.0.0.1:8787/contract/info | grep -i access-control
# Attendu : Access-Control-Allow-Origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop
```

## Partie B — un appel depuis l'extension

**Pourquoi pas depuis le script de contenu ?** Une requête du script de contenu part avec l'origine de la page (`https://safinum.cm`) : le moteur la refuse (CORS), et Chrome bloque un appel `https` → `http` (contenu mixte). L'appel doit partir d'une page de l'extension (popup) ou d'un service worker, dont l'origine est `chrome-extension://…`.

**Ce test ne modifie pas le code.** `build.mjs` refuse `fetch` dans le code produit (README, « Sécurité ») : l'appel se fait à la main, dans la console.

1. `npm run build:dev`, puis charger `dist-dev/` dans `chrome://extensions` (mode développeur).
2. Ouvrir le popup, clic droit → **Inspecter**, onglet **Console**.
3. Coller :

```js
const r = await fetch('http://127.0.0.1:8787/contract/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requests: [
    { text: 'Montant', sourceLang: 'fr', targetLang: 'eto' },
    { text: 'Solde disponible', sourceLang: 'fr', targetLang: 'eto' },
    { text: '5 000 FCFA', sourceLang: 'fr', targetLang: 'eto' },
  ] }),
});
console.table((await r.json()).results.map((x) => ({ status: x.status, kind: x.unverifiedKind, out: x.unverifiedOutput, kept: (x.keptFrench ?? []).join(', ') })));
```

Attendu : trois lignes — `PENDING_VALIDATION · complete · táŋ`, `PENDING_VALIDATION · complete · mɔ̀ní á compte · compte`, `PROTECTED`. Une erreur CORS ou réseau est à noter telle quelle dans le rapport.

## Partie C — l'affichage (après P2 et P5)

**Automatisée** depuis BM7 : `npm run e2e-extension` charge le build de production (vrai moteur embarqué) dans Chrome, injecte les textes des 15 cas dans la page de test et vérifie l'affichage attendu (vérification `E2E-C`, 13 cas applicables à la page : E13 et E14 testent le paramètre `sourceLang` de l'API (`en`, `auto`), que la page ne choisit pas — l'extension envoie toujours `auto`, Q16). Résultat au 2026-11-15 : 13 / 13 (`docs/test-report.md`). Le tableau ci-dessous reste la liste de contrôle pour une vérification à la main, par exemple sur le site réel.

Sur la page de test (ou une page locale contenant les textes des cas), option « Afficher les traductions non vérifiées » activée :

| Statut reçu | Ce que l'on doit voir | OK ? |
|---|---|---|
| `PENDING_VALIDATION`, complète (E01, E03, E05, E06) | la traduction, **avec le marqueur** « non vérifié » (pas seulement une couleur) ; l'original au survol et au focus | |
| `PENDING_VALIDATION`, partielle (E04) | la traduction avec un marqueur **distinct** « incomplet » ; les mots entre crochets affichés tels quels ; l'original au survol | |
| `keptFrench` (E03, E05) | « compte », « facture » en français **sans** crochets ; une mise en valeur est possible, pas obligatoire | |
| Valeurs protégées (E06) | `0 FCFA` identique, octet pour octet (contrôle d'intégrité §8) | |
| `KNOWN_UNTRANSLATED`, `NO_MATCH` (E07 à E09, E12, E13) | l'original, inchangé ; compté « à traduire » ou « inconnu » dans le popup | |
| `PROTECTED` (E10, E11) | rien ne change | |
| Option désactivée | tous les textes reviennent à l'original, à l'identique | |
| DOM | aucun attribut ni nœud ajouté dans la page par le marqueur | |

## Rapport à renvoyer au responsable

```text
Date :
Testeur :
Commit de main :
Empreinte (libraryVersion) :
A1 — npm run e2e-check : __ / 15 conformes ; cas en échec :
A3 — CORS chrome-extension : oui / non
B  — appel depuis le popup : oui / non ; erreur éventuelle :
C  — (après P2/P5) lignes non conformes :
Remarques :
```
