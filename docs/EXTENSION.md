# Extension Chrome : fonctionnement détaillé

Ce document reprend la description de l'extension écrite par Yvan (anciennement dans le README), mise à jour après les phases 4 et 5 de la mission. Le README ne garde que la méthodologie et l'installation.

## Popup

- **Traduction en éton** : interrupteur activé par défaut. Il se manipule au clavier (Tab, puis Espace ou Entrée) et son état est annoncé aux lecteurs d'écran. Désactivé, la page n'est plus analysée et retrouve tous ses textes d'origine.
- **Afficher les traductions non vérifiées** : activé par défaut (Q9). Désactivé, ces textes restent en français ; ils sont toujours comptés.
- **Mode bilingue** : désactivé par défaut (Q3). Activé, le français suit l'éton entre parenthèses : c'est le mode à conseiller avec un lecteur d'écran.
- **Cette page** : nombre de textes affichés en éton, dont non vérifiés, et nombre de textes qui restent à traduire. Aucun texte de la page n'est transmis au popup.
- **Mode diagnostic** : désactivé par défaut. Activé, il surligne les textes détectés dans la page et affiche leurs compteurs dans le popup (bouton **Actualiser** pour relire la page).
- Les réglages sont gardés dans `chrome.storage.local`, sur l'ordinateur. Ils survivent à la fermeture du popup et au redémarrage du navigateur.

## Affichage en éton

- **Ce qui est affiché** : la traduction validée (`APPROVED`) ; la traduction non vérifiée (`PENDING_VALIDATION`) si l'option est active. Tout autre statut garde le texte français. La sortie du moteur est affichée telle quelle (contrat §2-3).
- **Comment** : seul le texte des nœuds traduits change (`Text.data`). Aucun nœud ni attribut n'est ajouté à la page, rien n'est écrit avec `innerHTML`. Les originaux restent en mémoire, dans la page seulement.
- **Marqueurs** (*CSS Custom Highlight API*, toujours visibles) : souligné **en tirets** bleu pour une traduction automatique pas encore vérifiée par une locutrice. Pas de marqueur sur une traduction validée. Un brouillon incomplet (`unverifiedKind: 'partial'`) n'est **jamais affiché** (décision du responsable, phase 4) : le français reste, et le mode diagnostic le souligne en ondulé.
- **Français au survol et au focus** : une infobulle donne le texte d'origine et la nature de la traduction. Elle est placée hors de `<body>`, dans une racine fantôme fermée, et n'existe que tant qu'elle est visible ; Échap la ferme. Les lecteurs d'écran ne la lisent pas : utilisez le mode bilingue.
- **Contrôle d'intégrité** avant chaque écriture : si une valeur protégée (montant, référence, nom…) diffère entre l'original et la traduction, le texte reste en français (compté « Écartés » dans le diagnostic).
- **Application monopage** : si l'application remet un texte, il est retraduit sans boucle ; nos propres écritures ne déclenchent aucune réévaluation (vérifié : 0 mutation en 5 s d'inactivité). L'étape du parcours et les libellés « … : » qui protègent la valeur suivante sont lus en français d'origine, même traduits.
- **Restauration** : désactiver la traduction, ou l'option « non vérifiées », remet le texte d'origine dans le même nœud. Un texte que l'application a changé entre-temps n'est pas touché.

## Mode diagnostic

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

## Protection des données

Règle : mieux vaut ne pas traduire un libellé que modifier une valeur. Un texte n'est jamais envoyé au moteur s'il est :

- **une valeur par sa place** : cellule `dd`, seconde cellule d'une ligne de deux, élément qui suit un libellé terminé par « : », `output`, `time`, `data`, `meter`, `progress`, lien `tel:`, `mailto:` ou `sms:`, ou élément dont la classe, l'`id`, le `name`, l'`itemprop` ou le `data-testid` contient un mot comme `amount`, `montant`, `balance`, `solde`, `name`, `nom`, `ref`, `phone`, `email` ou `value`. Ces indices ne servent qu'à exclure, jamais à autoriser une traduction ;
- **l'écho d'une saisie** : texte identique à une valeur de champ (ex. un motif tapé à l'étape 3 et réaffiché à l'étape 4). Seules des empreintes de ces valeurs sont gardées, en mémoire ; les mots de passe ne sont jamais lus.

Textes gardés sur l'appareil : les textes absents de D8 sont enrichis et rangés dans `chrome.storage.local` (clé `corpusEnrichi`, 1 000 entrées au plus), valeurs remplacées par `{valeur}` ; les noms restent (décision du responsable, phase 5). Rien n'est transmis.

Dans les autres textes, `src/protection/patterns.ts` repère les valeurs protégées : montants (espaces normales ou insécables, signes `+`, `-`, `−`), devises, pourcentages, dates, heures, téléphones, comptes, références, e-mails, URL, marques `Safinum` et `Safinum Pay`, et tout mot qui contient un chiffre. Le moteur reçoit ce module (`detectProtected`). Avant toute écriture, `src/protection/integrity.ts` vérifie que ces valeurs, et les segments signalés par le moteur, restent identiques octet par octet ; sinon l'écriture est refusée et le français reste affiché.

## Sécurité

- Seule permission : `storage`. Aucune `host_permissions`, aucun service worker.
- Le script de contenu ne s'exécute que sur `https://safinum.cm/hackathon-test*`, dans le cadre principal. Il ne modifie que le texte des libellés traduits, jamais la structure : aucun nœud ni attribut ajouté dans `<body>`, et HTML identique après désactivation (vérifié par test et dans Chrome). Sans moteur, il ne modifie rien.
- Le popup ne répond qu'aux messages de l'extension elle-même ; les réponses ne contiennent que des compteurs.
- Aucune requête réseau. `build.mjs` **refuse de construire** si le code produit contient `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import()`, `eval`, `Function(…)`, `setTimeout` avec une chaîne, `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou `document.write`, ou, en production, le faux moteur (`⟦FAKE⟧`, contrat §9).
- Le journal n'accepte que des nombres et des booléens : aucun texte de la page ne peut y figurer.

## Organisation du code de l'extension

```text
manifest.json         manifest de production
manifest.dev.json     manifest de développement (+ localhost)
build.mjs             construction esbuild et contrôles du code produit
icons/                icônes 16, 32, 48 et 128 px
src/content/          script de contenu : index.ts (point d'entrée), controller.ts (cycle de vie),
                      scanner.ts, observer.ts, context.ts, pipeline.ts (lecture et évaluation),
                      renderer.ts (seule écriture dans la page, restauration), tooltip.ts (français au survol),
                      attributes.ts (placeholder, title, aria-label), classification.ts (mot, affirmation,
                      interrogation…), diagnostic.ts et content.css (compteurs, surlignage, marqueurs),
                      messaging.ts (popup), engine-provider.ts (seul choix du moteur), engine-data.ts
                      (ressources embarquées), corpus-sync.ts (enrichissement de D8 sur l'appareil),
                      fake-engine.ts (secours en développement)
src/protection/       dom-guard.ts (régions jamais lues, positions « valeur »), patterns.ts (valeurs protégées,
                      module pur partagé avec le moteur), echo.ts (saisies réaffichées), integrity.ts (contrôle
                      avant écriture, empreinte de page)
src/popup/            popup (HTML, CSS, logique)
src/shared/           réglages, accès à chrome.storage, journal sans données, messages popup ⇄ page
tests/extension/      tests Vitest (détection, attributs, classification, observation, diagnostic, protection, intégrité,
                      affichage, corpus, popup, manifest, construction)
tests/fixtures/       page de test locale SAFINUM (5 étapes, données fictives)
```
