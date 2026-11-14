# Composants tiers, outils et sources

Fichier partagé [R+Y] (PROJECT_CONTEXT §4.2). Version initiale (BM1), complétée par Yvan en P1 et finalisée en P8 (tâche 8.9).

## Dépendances d'exécution

Aucune. La bibliothèque et le moteur ne dépendent d'aucun paquet à l'exécution.

## Outils de développement (`devDependencies`, absents du livrable)

| Paquet | Version | Licence | Usage |
|---|---|---|---|
| `typescript` | 7.0.2 | Apache-2.0 | Vérification des types (`npm run typecheck`) |
| `vitest` | 5.1.0 | MIT | Tests (`npm test`) |
| `ajv` | 8.20.0 | MIT | Validation des schémas JSON (`npm run validate-data`, tests) |
| `tsx` | 4.23.15 | MIT | Exécution des scripts TypeScript sous Node |
| `@types/node` | 26.6.6 | MIT | Types de Node pour les scripts et les tests |

Les dépendances indirectes sont figées dans `package-lock.json`.

## Sources linguistiques

| Source | Usage | Licence / citation |
|---|---|---|
| Corpus fusionné D8 (`docs/sources/`) | Textes français, synonymes et définitions simples | Document du projet |
| *Dictionnaire éton–français* (D7), Mark Van de Velde & Kisito Essele Essele, Éditions CLÉ, Yaoundé, 2022 | Propositions de la cascade et leur justification (BM3). Hors Git ; seules les formes citées sont versionnées, avec leur page | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr) : les fichiers qui contiennent des formes de D7 sont diffusés sous la même licence (Q17) |

## Outils d'IA

GitHub Copilot a servi à écrire du code, des tests et de la documentation. Il n'a produit **aucune** forme Éton.
