# Composants tiers, outils et sources

Fichier partagé [R+Y] (PROJECT_CONTEXT §4.2). Version initiale (BM1), complétée par Yvan en P1 et finalisée en P8 (tâche 8.9).

## Dépendances d'exécution

Aucun paquet. Le moteur, embarqué dans le script de contenu de l'extension (`content.js`, BM7), contient deux données tierces (voir « Sources linguistiques ») :

- l'**extrait modifié de Lefff 3.4** (LGPL-LR), avec son en-tête de licence et d'avis de modification ;
- des **formes de D7** (CC BY-NC-SA 4.0), lues dans `data/language-resources/raw/` sur le poste qui construit, jamais versionnées. `content.js`, et donc l'extension construite, est diffusé sous la même licence (Q17) : pas d'usage commercial.

`npm run package` ajoute au ZIP un fichier `LICENCES.txt` (sources, auteurs, licences) et, si le moteur est embarqué, `LICENSE-LGPL-LR.txt`.

## Outils de développement (`devDependencies`, absents du livrable)

| Paquet | Version | Licence | Usage |
|---|---|---|---|
| `typescript` | 7.0.2 | Apache-2.0 | Vérification des types (`npm run typecheck`) |
| `vitest` | 5.1.0 | MIT | Tests (`npm test`) |
| `ajv` | 8.20.0 | MIT | Validation des schémas JSON (`npm run validate-data`, tests) |
| `tsx` | 4.23.15 | MIT | Exécution des scripts TypeScript sous Node |
| `@types/node` | 26.6.6 | MIT | Types de Node pour les scripts et les tests |
| `esbuild` | 0.28.2 | MIT | Construction de l'extension (`npm run build`) |
| `@types/chrome` | 0.3.7 | MIT | Types des API `chrome.*` de l'extension |
| `jsdom` | 31.0.1 | MIT | DOM simulé pour les tests de l'extension (popup) |

Le banc `npm run e2e-extension` pilote un Chrome installé sur le poste (protocole DevTools, sans paquet) ; le ZIP est écrit avec le `zlib` de Node. Aucune police n'est ajoutée : les diacritiques de D7 s'affichent avec les polices du système (P5.7).

Les dépendances indirectes sont figées dans `package-lock.json`.

## Sources linguistiques

| Source | Usage | Licence / citation |
|---|---|---|
| Corpus fusionné D8 (`docs/sources/`) | Textes français, synonymes et définitions simples | Document du projet |
| Lefff 3.4 (*Lexique des formes fléchies du français*), Benoît Sagot, « The Lefff, a freely available and large-coverage morphological and syntactic lexicon for French », LREC 2010 | Lemmes, modes, temps et personnes des mots français (moteur, MOT2). **Extrait modifié** versionné dans `data/language-resources/lefff/` et embarqué par le moteur. Source : copie GitHub [ClaudeCoulombe/FrenchLefffLemmatizer](https://github.com/ClaudeCoulombe/FrenchLefffLemmatizer) @ `bc0ebd0`, `lefff-3.4.mlex`, SHA-256 `f3da25e5…`; régénération : `npm run build-lefff` | [LGPL-LR](data/language-resources/lefff/LICENSE-LGPL-LR.txt) : l'extrait reste sous LGPL-LR, avec la licence et un avis de modification daté en tête du fichier (M12) |
| *Dictionnaire éton–français* (D7), Mark Van de Velde & Kisito Essele Essele, Éditions CLÉ, Yaoundé, 2022 | Propositions de la cascade et leur justification (BM3) ; formes utilisées par le moteur, embarquées dans l'extension construite (BM7). Hors Git ; seules les formes citées sont versionnées, avec leur page | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr) : les fichiers qui contiennent des formes de D7 sont diffusés sous la même licence (Q17) |

## Outils d'IA

GitHub Copilot a servi à écrire du code, des tests et de la documentation. Il n'a produit **aucune** forme Éton.
