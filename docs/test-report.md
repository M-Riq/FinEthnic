# Rapport de test — extension SAFINUM Éton

Version : 2026-11-15 · extension 0.1.0 · contrat **v0.4.0** · branche `feature/extension-setup`

Ce rapport remplit les colonnes « Obtenu » et « Statut » du catalogue (ROADMAP §9) pour l'extension (phases P6, P7 et P8.4). Toutes les données sont fictives.

## Conditions

| Élément | Valeur |
|---|---|
| Navigateur | Chrome 157, sans interface (`--headless=new`), profil jetable |
| Extension | **build de production** avec le vrai moteur (`npm run build`, D7 importé) ; testé aussi à partir du ZIP décompressé (`npm run package`) |
| Page | `tests/fixtures/safinum-test.html` (5 étapes, textes D8, structure supposée), servie sur `http://127.0.0.1` |
| Seule différence avec la production | le `manifest.json` de la copie testée accepte aussi `http://127.0.0.1/*` ; le code est identique |
| Bibliothèque | 0 traduction `APPROVED` : tout texte affiché en éton est **non vérifié** et porte un marqueur |
| Commandes | `npm run e2e-extension` (banc Chrome), `npm test`, `npm run typecheck` |

**Non vérifié ici :** le site réel `https://safinum.cm/hackathon-test` (inaccessible depuis l'environnement de développement, Q20), un lecteur d'écran, les postes de l'équipe (diacritiques, installation « machine vierge »).

## Banc Chrome — `npm run e2e-extension`

Résultat : **35 / 35 vérifications réussies**, sans exception ni erreur de console.

### P6 — parcours des 5 étapes

Chaque étape est d'abord lue sans extension, puis avec : valeurs (montants, noms, références, dates), champs et structure HTML doivent être identiques ; seuls des nœuds texte peuvent changer.

| ID | Résultat obtenu | Statut |
|---|---|---|
| T-NAV-01 | Étape 1 : 13 textes en éton (13 non vérifiés), 3 laissés en français, 6 valeurs protégées intactes | ✅ |
| T-NAV-02 | Étape 2 : 12 en éton, 0 en français, 3 valeurs intactes ; frais et total inchangés | ✅ |
| T-NAV-03 | Étape 3 : 9 en éton, 2 en français ; aucun champ traduit | ✅ |
| T-NAV-04 | Étape 4 : 11 en éton, 1 en français, 7 valeurs intactes (point de contrôle d'intégrité) | ✅ |
| T-NAV-05 | Étape 5 : 7 en éton, 2 en français, 6 valeurs intactes ; « Confirmer le transfert » mène au reçu | ✅ |
| T-NAV-06 | Désactivation à l'étape 4 : HTML identique à la page sans extension ; réactivation : mêmes textes | ✅ |
| T-PRO-11 | Note « Facture » et montant 30000 saisis : `value` inchangée | ✅ |
| P6.4 | La case à cocher de l'étape 4 reste fonctionnelle | ✅ |
| T-TRA-03 | Chaque traduction affichée porte un marqueur ; infobulle française au focus, hors de `<body>`, retirée à la perte du focus | ✅ |
| T-TRA-07 | 0 mutation pendant 5 s d'inactivité | ✅ |
| T-TRA-09 | Option « non vérifiées » désactivée : français d'origine (textes toujours comptés) ; réactivée : mêmes traductions | ✅ |
| P5.5 | Mode bilingue « traduction (français) » : seuls des textes changent | ✅ |

### P7 — contenu injecté après le chargement

| ID | Résultat obtenu | Statut |
|---|---|---|
| E2E-C | Scénario extension ↔ moteur (`tests/e2e/engine-scenario.json`) : 13 / 13 cas affichés comme le prévoit le contrat §5.4 (E13 et E14 testent le paramètre `sourceLang` de l'API ; dans la page, l'extension envoie toujours `auto`) | ✅ |
| T-INE-01 | Message dans une zone `aria-live` : affiché avec son marqueur en ~1 ms | ✅ |
| T-INE-03 | Avertissement « Ne communiquez jamais… » : laissé en français | ✅ |
| T-INE-04 | Erreur « Solde insuffisant… » : brouillon marqué « partiel » | ✅ |
| T-INE-05 | Lot de 10 messages : tous évalués, 9 en éton, aucun sans marqueur | ✅ |
| T-INE-06 | Texte inconnu : laissé en français | ✅ |
| T-INE-07 | Montant, nom et référence dynamiques : laissé en français, valeurs intactes | ✅ |
| T-TRA-05 | « Votre paiement a été envoyé avec succès. » : **non traduit** | ✅ |
| T-DET-02 | Texte ajouté détecté et traité en moins de 100 ms | ✅ |
| P7.5 | Boîte de dialogue modale : textes traduits et marqués | ✅ |
| T-TRA-08 | Français remis par l'application : retraduit (2 mutations), puis 0 en 2 s | ✅ |
| T-PRO-12 | Textes de la page hors injections inchangés | ✅ |
| P7.1 | Script `docs/demo/inject-samples.js` exécuté tel quel : 22 messages détectés, 17 en éton (tous marqués), 5 en français | ✅ |
| P7.1b | Démonstration : texte proche en français ; montant (« … 176 000 FCFA … ») et référence (`SAF-2026-…`) intacts | ✅ |

### P7.4 — charge (500 nœuds)

| Mesure | Résultat | Statut |
|---|---|---|
| T-INE-08 : 500 nœuds, 10 messages répétés | 39 ms jusqu'au dernier texte affiché (budget 200 ms), 450 textes écrits, plus longue tâche 0 ms | ✅ |
| T-INE-08b (mesure, pire cas) : 500 textes de D8 tous différents | 228 ms jusqu'au dernier texte affiché, 308 écrits, plus longue tâche 73 ms | ℹ️ hors budget, sans gel de la page |
| `finethnicDemo.charge(500)` | dernière écriture à 44 ms | ✅ |

### P8.4 — audit réseau, stockage, erreurs

| ID | Résultat obtenu | Statut |
|---|---|---|
| T-INS-05 | Aucune requête hors de la page de test (7 requêtes, toutes de la page) | ✅ |
| P8.4 | `chrome.storage` de l'extension : seule la clé `settings` | ✅ |
| P8.4b | Rien d'écrit dans `localStorage`, `sessionStorage` ni les cookies de la page | ✅ |
| P8.1 | Aucune exception ni erreur de console | ✅ |

Les contrôles statiques du code produit (`fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `innerHTML`…, faux moteur) sont faits à chaque construction par `build.mjs`, puis de nouveau par `npm run package`.

## Performance au chargement

Mesures du banc (build de production, vrai moteur), avant et après la construction paresseuse du moteur et le découpage de l'évaluation en tranches de 30 ms :

| Mesure | Avant | Après |
|---|---|---|
| Plus longue tâche au chargement, traduction désactivée | ~900 ms | 0 à 80 ms |
| Plus longue tâche au chargement, traduction activée | ~920 à 1 340 ms | inchangée |
| Pire cas 500 textes différents : durée totale | 675 ms | 226 à 386 ms |
| Pire cas 500 textes différents : plus longue tâche | 550 ms | 69 à 81 ms |

Avec la traduction activée, le premier texte en éton apparaît ~1,0 à 1,5 s après le début de la navigation (DOMContentLoaded vers 20 à 45 ms). L'essentiel vient du moteur : `info()` calcule ses compteurs en traduisant les 375 textes du corpus (~0,6 s). L'extension doit appeler `info()` au démarrage (T-CON-07). Piste pour le moteur : compter ces entrées à la demande ou à la construction.

## Tests automatisés (Vitest)

`npm test`, D7 importé : **33 fichiers, 571 tests réussis, 1 sauté**. Le test sauté (« refuse le vrai moteur sans D7 ») ne s'exécute que si D7 est absent ; inversement, sans D7, les tests qui en ont besoin (scénario `tests/e2e/engine-scenario.test.ts`, build avec le vrai moteur) sont sautés proprement. Sont inclus : les tests de l'extension (`tests/extension/`, dont le ZIP), la suite de conformité du contrat sur les deux moteurs et le scénario de bout en bout. `npm run typecheck` : sans erreur.

## Écarts et suites

- **Q20** : la structure de la page de test est supposée ; à revérifier sur `https://safinum.cm/hackathon-test` depuis un poste de l'équipe (T-NAV en conditions réelles).
- **0 traduction validée** : T-TRA-01 et T-INE-01/02 (« traduit si validé ») ne sont vérifiables qu'avec des cibles de test ; ils le sont dans `tests/extension/`.
- **Accessibilité (P8.2)** : popup au clavier vérifié par test ; passage au lecteur d'écran (NVDA ou ChromeVox) à faire sur un poste.
- **Installation sur une machine vierge (P8.5)** : à chronométrer avec le ZIP, en suivant le README.
