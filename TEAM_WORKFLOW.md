# TEAM WORKFLOW — FinEthnic

## 1. Présentation

FinEthnic est un projet d'accessibilité linguistique destiné aux services financiers numériques.

Le premier prototype, SAFINUM Éton, vise à rendre les interfaces financières compréhensibles en Éton (Ìtón), à partir de contenus initialement disponibles en français ou en anglais.

Le projet repose sur trois composantes :

1. Une bibliothèque linguistique financière.
2. Un moteur local de correspondance et de traduction.
3. Une extension Google Chrome qui exploite la bibliothèque et le moteur.

Ce document définit l'organisation du travail, les responsabilités et les règles de collaboration entre les membres de l'équipe.

## 2. Composition de l'équipe

### Responsable du projet — Bibliothèque et moteur linguistique

**Responsabilité principale : données linguistiques et logique de traduction.**

Missions :

- Concevoir et structurer la bibliothèque financière.
- Exploiter le dictionnaire Éton–Français disponible.
- Constituer les entrées financières françaises et anglaises.
- Préparer les équivalents en Éton.
- Organiser la validation avec les locuteurs natifs.
- Définir les statuts de traduction et de validation.
- Gérer les variantes linguistiques.
- Définir et maintenir les fichiers JSON de référence.
- Développer le moteur de correspondance et de traduction.
- Développer les scripts de validation et de détection des doublons.
- Générer les exports Markdown et CSV destinés aux relectures.
- Fournir à Yvan les versions documentées du moteur et de la bibliothèque.

**Priorité :** construire la bibliothèque linguistique et le moteur de traduction.

### Yvan — Développement de l'extension Chrome

**Responsabilité principale : développement de l'extension et intégration technique.**

Missions :

- Initialiser le projet Chrome Manifest V3.
- Développer le popup.
- Gérer l'activation et la désactivation de l'extension.
- Développer le scanner DOM.
- Détecter les textes présents dans les interfaces.
- Intégrer MutationObserver.
- Détecter les contenus ajoutés dynamiquement.
- Développer les mécanismes de protection des données.
- Préserver les montants, noms, numéros, références et valeurs saisies.
- Préparer les mécanismes de remplacement et de restauration des textes.
- Tester l'extension avec des données fictives.
- Intégrer le moteur linguistique lorsqu'il est disponible.
- Documenter l'installation et le fonctionnement de l'extension.

**Priorité :** développer une extension autonome et préparer son intégration avec le moteur linguistique.

## 3. Principe de développement parallèle

Les deux membres travaillent simultanément sur des composantes distinctes.

Le développement de l'extension ne doit pas attendre la finalisation de la bibliothèque.

La construction de la bibliothèque ne doit pas dépendre de l'avancement de l'extension.

### Travail du responsable linguistique

Il travaille principalement dans :

- `data/`
- `src/language/` ou le dossier dédié au moteur linguistique.
- `scripts/` pour les outils de traitement des données.
- `tests/language/` pour les tests du moteur.

Il doit pouvoir tester la bibliothèque et le moteur sans lancer Chrome.

### Travail d'Yvan

Il travaille principalement dans :

- `src/content/`
- `src/popup/`
- `src/protection/`
- `src/extension/` si cette organisation est retenue.
- `tests/extension/`

Il doit pouvoir tester l'extension sans attendre les vraies traductions.

### Données temporaires

Avant la livraison du moteur linguistique, Yvan utilise :

- Des textes fictifs français.
- Des textes fictifs anglais.
- Des fixtures locales.
- Un faux moteur de traduction respectant le contrat d'intégration.

Ces données sont exclusivement destinées aux tests. Elles ne doivent jamais être présentées comme des traductions Éton validées.

Le faux moteur sera remplacé par le véritable moteur sans réécriture majeure de l'extension.

## 4. Contrat entre les deux composantes

Les deux membres doivent respecter une interface d'intégration commune.

Le moteur devra recevoir au minimum :

- Le texte détecté.
- La langue source.
- La langue cible.
- Le contexte, lorsqu'il est disponible.

La langue cible initiale est l'Éton.

Les langues sources sont le français et l'anglais.

Le résultat du moteur doit permettre de distinguer :

- Traduction disponible et approuvée.
- Entrée connue mais non traduite.
- Traduction en attente de validation.
- Aucune correspondance.
- Correspondance ambiguë.
- Texte protégé qui ne doit pas être traduit.

Yvan ne doit pas inventer de logique linguistique qui contredit le moteur.

Le responsable linguistique ne doit pas modifier un contrat déjà utilisé sans prévenir Yvan et documenter les conséquences.

Les détails techniques définitifs seront documentés dans `INTEGRATION_CONTRACT.md`.

## 5. Organisation des données

La source de vérité de la bibliothèque est le JSON dans `data/`.

Les fichiers Markdown et CSV sont des exports destinés à la relecture et à la validation humaine.

Organisation indicative :

```text
data/
├── financial-corpus/
├── safinum-test-pages/
├── language-resources/
├── schemas/
└── exports/
    ├── markdown/
    └── csv/
```

Les fichiers JSON contiennent les identifiants stables, les textes sources, les traductions, les contextes, les variantes et les statuts de validation.

Les exports ne doivent pas devenir une seconde source de vérité.

Toute modification issue d'une relecture doit être réintégrée dans le JSON par un processus contrôlé.

## 6. Organisation Git

### Branches principales

- `main` : versions stables et validées.
- `develop` : intégration des fonctionnalités, si cette branche est adoptée.

### Branches de fonctionnalités

Exemples :

```text
feature/language-library
feature/language-engine
feature/eton-dictionary-import
feature/language-validation
feature/extension-setup
feature/dom-scanner
feature/data-protection
feature/dynamic-content
feature/extension-integration
test/financial-integrity
docs/project-documentation
```

Les branches doivent être courtes, ciblées et associées à une tâche identifiable.

### Règles de collaboration

1. Ne pas travailler directement sur `main`.
2. Ne pas fusionner une fonctionnalité non testée.
3. Utiliser des Pull Requests pour les intégrations importantes.
4. Décrire clairement les changements.
5. Vérifier les tests avant fusion.
6. Éviter les modifications simultanées des mêmes fichiers.
7. Prévenir l'autre membre lorsqu'un changement affecte le contrat d'intégration.
8. Ne jamais committer de clés API, mots de passe ou données sensibles.

### Conventions de commits

```text
feat: add financial language schema
feat: implement local language matcher
feat: initialize Chrome extension
feat: add DOM scanner
fix: preserve financial transaction values
test: add language matching tests
test: add financial integrity tests
docs: update team workflow
refactor: improve translation matching
```

## 7. Points de synchronisation

Les membres doivent se synchroniser aux moments suivants :

### Synchronisation 1 — Cadrage

- Validation de l'architecture.
- Validation du format JSON.
- Validation du contrat d'intégration.
- Validation de la répartition des tâches.

### Synchronisation 2 — Premiers modules disponibles

- Présentation du scanner DOM.
- Présentation du schéma JSON.
- Présentation du matcher initial.
- Vérification de la compatibilité des interfaces.

### Synchronisation 3 — Première intégration

- Chargement de la bibliothèque.
- Remplacement du faux moteur.
- Tests des correspondances.
- Vérification des statuts de validation.
- Vérification de la protection des données.

### Synchronisation 4 — Tests SAFINUM

- Parcours des cinq pages.
- Tests des contenus dynamiques.
- Tests des montants et références.
- Tests des textes inconnus.
- Corrections communes.

### Synchronisation 5 — Préparation finale

- Stabilisation.
- Tests de non-régression.
- Documentation.
- Préparation de la démonstration.

Les synchronisations peuvent être adaptées à l'avancement réel. Elles ne doivent pas devenir des blocages inutiles.

## 8. Gestion des modifications incompatibles

Tout changement concernant :

- Le schéma JSON.
- Les identifiants des entrées.
- Les statuts de validation.
- Les paramètres du moteur.
- Le format des résultats.
- Les langues prises en charge.
- La protection des données.

doit être documenté.

Le membre qui propose le changement doit prévenir l'autre membre, expliquer les conséquences et proposer une procédure de migration si nécessaire.

## 9. Règles de sécurité

- Aucune donnée réelle de client dans les tests.
- Aucun envoi de données financières à un service externe.
- Aucun stockage inutile de données personnelles.
- Aucun affichage d'une traduction non approuvée.
- Aucune modification des valeurs financières.
- Aucun contournement du parcours SAFINUM.
- Aucun changement du code source de l'application de test.
- Aucun secret ou identifiant sensible dans Git.

En cas de doute sur la sécurité ou l'intégrité d'une opération financière, conserver le texte original.

## 10. Définition de terminé

Une tâche n'est considérée comme terminée que si :

- Le changement est implémenté.
- Les tests pertinents passent.
- Les éventuelles limites sont documentées.
- Les fichiers concernés sont à jour.
- Les changements sont disponibles dans une branche ou une Pull Request.
- L'intégration avec l'autre composante est vérifiée lorsqu'elle est concernée.

## 11. Objectif commun

Le but n'est pas de produire deux projets indépendants.

Le but est de construire une solution unique dans laquelle :

- La bibliothèque fournit les données linguistiques.
- Le moteur fournit les correspondances et les traductions approuvées.
- L'extension détecte les textes et exploite le moteur.
- Les protections préservent l'intégrité des informations financières.

Chaque membre reste responsable de son périmètre, mais les deux composantes doivent fonctionner ensemble pour produire le prototype SAFINUM Éton.
