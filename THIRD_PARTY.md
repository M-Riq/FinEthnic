# Composants tiers, outils et sources

Fichier partagé [R+Y] (PROJECT_CONTEXT §4.2). Version initiale (BM1), complétée par Yvan en P1 et finalisée en P8 (tâche 8.9).

## Dépendances d'exécution

Aucun paquet. L'extension embarque des données tierces (voir « Sources linguistiques ») : l'adaptation JSON de D7 et de son esquisse grammaticale, et l'extrait de Lefff. Leurs licences sont copiées dans le dossier `licences/` du paquet (`npm run package`), et le popup cite les auteurs.

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

Les dépendances indirectes sont figées dans `package-lock.json`.

## Sources linguistiques

| Source | Usage | Licence / citation |
|---|---|---|
| Corpus fusionné D8 (`docs/sources/`) | Textes français, synonymes et définitions simples | Document du projet |
| Lefff 3.4 (*Lexique des formes fléchies du français*), Benoît Sagot, « The Lefff, a freely available and large-coverage morphological and syntactic lexicon for French », LREC 2010 | Lemmes, modes, temps et personnes des mots français (moteur, MOT2). **Extrait modifié** versionné dans `data/language-resources/lefff/` et embarqué par le moteur. Source : copie GitHub [ClaudeCoulombe/FrenchLefffLemmatizer](https://github.com/ClaudeCoulombe/FrenchLefffLemmatizer) @ `bc0ebd0`, `lefff-3.4.mlex`, SHA-256 `f3da25e5…`; régénération : `npm run build-lefff` | [LGPL-LR](data/language-resources/lefff/LICENSE-LGPL-LR.txt) : l'extrait reste sous LGPL-LR, avec la licence et un avis de modification daté en tête du fichier (M12) |
| *Dictionnaire éton–français* (D7), Mark Van de Velde & Kisito Essele Essele, Éditions CLÉ, Yaoundé, 2022 | Traductions du moteur et leur justification. **Adaptation JSON complète versionnée** dans `data/language-resources/d7/` (`npm run convert-d7`, colonnes « English » écrites par une IA non reprises) ; le fichier brut reste hors Git (Q17 révisée le 2026-11-14) | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr) : attribution, pas d'usage commercial, même licence pour les fichiers qui contiennent des formes de D7 et pour l'extension qui les embarque ([d7/LICENCE.md](data/language-resources/d7/LICENCE.md)) |
| Section 8 « Esquisse grammaticale » du même livre (HAL [halshs-03847045](https://shs.hal.science/halshs-03847045)), p. 18-70 | Règles de grammaire éton. Texte versionné tel que fourni (`docs/sources/grammaire_eton_esquisse_complete.md`) et converti en JSON (`data/language-resources/d7/esquisse-grammaticale.json`) | CC BY-NC-SA 4.0, mêmes obligations que D7 |

## Outils d'IA

GitHub Copilot a servi à écrire du code, des tests et de la documentation. Il n'a produit **aucune** forme Éton.
