# M22 — Synonymes de D8 compatibles avec D7 (rapport à valider)

**Statut :** les 50 propositions sont validées par le responsable : le 2026-11-15 (groupe A, 15, en bloc ; groupe B, 35, une par une). Elles sont ajoutées dans `data/language-resources/d8-synonym-additions.json` : 105 → 155 entrées complètes (154 après le contrôle nom + adjectif de M23, qui retire « Arrondi »). Le fichier source de D8 n'est pas modifié. Un second lot (M24, voir plus bas) ajoute 28 synonymes validés : 154 → 182 entrées complètes.

## Pourquoi

La mesure du 2026-11-15 montre que la conjugaison du présent avec « il » ou « elle » ne débloque presque rien : dans D8, les verbes au présent ont surtout pour sujet « qui » (« la personne qui reçoit »), « on », « c'est » ou « tu peux ». Résoudre tout le présent ne rendrait complètes que 4 unités. Les autres obstacles (relatif « qui », participe « argent envoyé », « de » entre deux noms, négation, possessif) n'ont **aucune règle dans D7**.

Le levier restant est donc la **simplification** : proposer, pour une entrée bloquée, un synonyme français simple écrit **seulement avec des constructions que D7 atteste**. Celles-ci sont le verbe + complément (D7-VERBE-NOM), le nom seul, nom « á » nom (« dans, à »), « et / avec » (èè), « pour rien » (á pûpùd), le partitif après un verbe (M21) et les termes gardés en français (M20).

## Méthode

1. Pour chacune des 270 entrées bloquées (sur 375), recherche d'une reformulation simple qui garde le sens financier.
2. Chaque proposition est passée dans le moteur. Elle n'est retenue que si la traduction est **complète** (aucun mot manquant, aucune règle absente) et si chaque mot éton a, dans D7, une glose qui correspond au sens voulu.
3. Simulation : les 50 propositions sont ajoutées en mémoire à D8, puis les 375 entrées sont retraduites. Les 50 entrées deviennent complètes, et **aucune autre traduction ne change**.
4. Rien n'est inventé : chaque forme éton vient de D7 ; le synonyme est du français.

Le **type de phrase est conservé** : 4 propositions à l'infinitif pour des impératifs (« Veuillez patienter », « Changez votre mot de passe… », « Consultez votre solde », « Vérifiez toujours le numéro ») ont été écartées par le moteur, car elles perdaient l'ordre donné. Elles ne figurent pas ci-dessous.

## Résultat si tout est validé

105 → 155 entrées complètes sur 375 (+50). Les textes de page (P1 à P5) sont comptés à part, car ils n'ont pas de synonymes propres aujourd'hui.

**Colonne « Décision »** : écrire **oui** ou **non** (ou une autre formulation). Le groupe A garde le sens (validé en bloc) ; le groupe B (validé ligne par ligne) le rapproche (un mot perdu, un verbe à la place d'un nom, une glose à double sens) et demande votre jugement.

### A. Sens fidèle (15)

| Sens | ID | Texte de D8 | Synonyme proposé | Éton obtenu | Remarque | Décision |
|---|---|---|---|---|---|---|
| ✅ | ACT-031 | Ouvrir un compte | ouvrir le compte | yázî compte | — | oui (2026-11-15) |
| ✅ | ACT-035 | Ajouter un bénéficiaire | ajouter le bénéficiaire | bág bénéficiaire | « un » bloquait (règle du nombre) | oui (2026-11-15) |
| ✅ | ACT-043 | Demander un code de vérification | demander le code | bólô code | — | oui (2026-11-15) |
| ✅ | ACT-053 | Précédent | revenir | dúgnì | — | oui (2026-11-15) |
| ✅ | VOC-004 | Portefeuille électronique | argent dans le téléphone | mɔ̀ní á ŋ̀-kwǎl | reprend la définition de D8 | oui (2026-11-15) |
| ✅ | VOC-018 | Devise | monnaie | cáz | entrée cáz1 « monnaie » ; homonymes cáz2–4 (tacle, contrôler) écrits pareil | oui (2026-11-15) |
| ✅ | VOC-054 | En attente | attendre | yàŋà | D8 : « il faut attendre » | oui (2026-11-15) |
| ✅ | MSG-021 | Ce service est gratuit. | Service pour rien. | Service á pûpùd. | á pûpùd « pour rien » | oui (2026-11-15) |
| ✅ | MSG-037 | Frais : {frais} {devise} | Prix : {frais} {devise} | táŋ : {frais} {devise} | D8 : « Prix du service » | oui (2026-11-15) |
| ✅ | MSG-050 | Numéro de référence : {référence} | Numéro : {référence} | nwàmɔ̀ : {référence} | — | oui (2026-11-15) |
| ✅ | MSG-078 | Notifications | messages | pɔ́ | pɔ́ « nouvelle, information, message » | oui (2026-11-15) |
| ✅ | PAG-016 | Paiement de services | payer le service | yágnà service | — | oui (2026-11-15) |
| ✅ | P2-12 | Retour | revenir | dúgnì | — | oui (2026-11-15) |
| ✅ | P3-8 | Paiement de services | payer le service | yágnà service | — | oui (2026-11-15) |
| ✅ | P5-8 | Statut | état | ì-tə́ | — | oui (2026-11-15) |

### B. Sens proche, à juger (35)

| Sens | ID | Texte de D8 | Synonyme proposé | Éton obtenu | Remarque | Décision |
|---|---|---|---|---|---|---|
| ≈ | ACT-016 | Confirmer | accepter | mə̀m | mə̀m « avouer, accepter » ; même forme que Valider | oui (2026-11-15) |
| ≈ | ACT-020 | Autoriser | accepter | mə̀m | « permettre » absent de D7 | oui (2026-11-15) |
| ≈ | ACT-023 | Accepter les conditions | accepter la loi | mə̀m mbɛ́ní | mbɛ́ní « loi, interdiction » ; « règles » absent de D7 | oui (2026-11-15) |
| ≈ | ACT-025 | Contester | refuser l'opération | bɛ̀n ì-sàlgà | contester ≈ refuser | oui (2026-11-15) |
| ≈ | ACT-034 | Débloquer | ouvrir le compte | yázî compte | D8 : « rouvrir », « permettre encore d'utiliser un compte » | oui (2026-11-15) |
| ≈ | ACT-039 | Réinitialiser | changer le code | cɛ́nî code | D8 : « remettre comme au début (mot de passe, code secret) » | oui (2026-11-15) |
| ≈ | VOC-008 | Solde disponible | argent dans le compte | mɔ̀ní á compte | perd « disponible » | oui (2026-11-15) |
| ≈ | VOC-013 | Plafond | limite | ɲ̀-ɲə̀ | ɲ̀-ɲə̀ « limite ; époque » | oui (2026-11-15) |
| ≈ | VOC-024 | Somme | argent | mɔ̀ní | somme = quantité d'argent | oui (2026-11-15) |
| ≈ | VOC-043 | Virement | envoyer de l'argent à la banque | lóm mɔ̀ní á banque | verbe à la place du nom | oui (2026-11-15) |
| ≈ | VOC-048 | Crédit | ajouter de l'argent | bág mɔ̀ní | verbe à la place du nom (= Créditer) | oui (2026-11-15) |
| ≈ | VOC-049 | Débit | enlever de l'argent | sóg mɔ̀ní | verbe à la place du nom (= Débiter) | oui (2026-11-15) |
| ≈ | VOC-050 | Reçu | preuve | ndə̀m | ndə̀m « signe, preuve » | oui (2026-11-15) |
| ≈ | VOC-052 | Référence | numéro | nwàmɔ̀ | D8 : « numéro de l'opération » | oui (2026-11-15) |
| ≈ | VOC-053 | Statut de la transaction | état | ì-tə́ | perd « de la transaction » | oui (2026-11-15) |
| ≈ | VOC-080 | Prêt | dette | ì-kòló | point de vue de celui qui emprunte | oui (2026-11-15) |
| ≈ | VOC-097 | Conditions générales | loi | mbɛ́ní | mbɛ́ní « loi, interdiction » | oui (2026-11-15) |
| ≈ | MSG-002 | Votre solde disponible est de {montant} {devise}. | Argent dans le compte : {montant} {devise}. | mɔ̀ní á compte : {montant} {devise}. | perd « disponible » | oui (2026-11-15) |
| ≈ | MSG-003 | Numéro de compte : {numéro_compte} | Numéro : {numéro_compte} | nwàmɔ̀ : {numéro_compte} | perd « de compte » | oui (2026-11-15) |
| ≈ | MSG-009 | Voir toutes les transactions | voir les opérations | yɛ́n ì-sàlgà | perd « toutes » | oui (2026-11-15) |
| ≈ | MSG-013 | Frais de transfert : {frais} {devise} | Prix : {frais} {devise} | táŋ : {frais} {devise} | perd « de transfert » | oui (2026-11-15) |
| ≈ | MSG-040 | Référence : {référence} | Numéro : {référence} | nwàmɔ̀ : {référence} | D8 : « Code » | oui (2026-11-15) |
| ≈ | MSG-046 | Date de l'opération : {date} | Jour : {date} | à-mǒz : {date} | perd « de l'opération » | oui (2026-11-15) |
| ≈ | MSG-062 | Chargement en cours... | attendre | yàŋà | — | oui (2026-11-15) |
| ≈ | MSG-079 | Aide et assistance | aider | kà | verbe à la place du nom | oui (2026-11-15) |
| ≈ | SEC-032 | Opposition | arrêter la carte | tɛ́lî carte | tɛ́lî « placer ; arrêter » | oui (2026-11-15) |
| ≈ | SEC-034 | Preuve de transaction | preuve | ndə̀m | perd « de transaction » | oui (2026-11-15) |
| ≈ | PAG-004 | Salaire reçu | recevoir le salaire | g͡bɛ̀ɛn ̀ ì mwàní à ŋgwàn | verbe à la place de « reçu » | oui (2026-11-15) |
| ≈ | PAG-005 | Transfert reçu | recevoir de l'argent | g͡bɛ̀ɛn ̀ ì mɔ̀ní | verbe à la place de « reçu » | oui (2026-11-15) |
| ≈ | P1-4 | Solde disponible | argent dans le compte | mɔ̀ní á compte | perd « disponible » | oui (2026-11-15) |
| ≈ | P1-11 | Salaire reçu | recevoir le salaire | g͡bɛ̀ɛn ̀ ì mwàní à ŋgwàn | — | oui (2026-11-15) |
| ≈ | P1-12 | Transfert reçu | recevoir de l'argent | g͡bɛ̀ɛn ̀ ì mɔ̀ní | — | oui (2026-11-15) |
| ≈ | P4-8 | Référence | numéro | nwàmɔ̀ | — | oui (2026-11-15) |
| ≈ | P4-12 | Confirmer le transfert | accepter le transfert | mə̀m transfert | confirmer ≈ accepter | oui (2026-11-15) |
| ≈ | P5-3 | Référence | numéro | nwàmɔ̀ | — | oui (2026-11-15) |

## Second lot (M24) : 30 propositions, 28 validées

Après le contrôle nom + adjectif de M23, les 220 entrées sans proposition ont été relues. 30 propositions de sens proche ont été testées dans le moteur : chacune rend son entrée complète, et aucune autre traduction ne change. Le responsable les a jugées une par une le 2026-11-15 : 28 « oui », 2 « non ». Résultat : 154 → 182 entrées complètes ; seules les 28 entrées validées changent.

Les entrées marquées « texte de page » (P1 à P5) sont les textes des pages de l'application.

| N° | Entrée | Texte de D8 | Synonyme proposé | Moteur (D7) | Ce qui se perd | Décision |
|---|---|---|---|---|---|---|
| 1 | VOC-005 | Numéro de compte | numéro | nwàmɔ̀ « nombre, numéro » (p. 206) | « de compte » | oui (2026-11-15) |
| 2 | P1-5 | Numéro de compte | numéro | nwàmɔ̀ | « de compte » | oui (2026-11-15) |
| 3 | MSG-024 | Numéro de téléphone du bénéficiaire | numéro | nwàmɔ̀ | « de téléphone du bénéficiaire » | non (2026-11-15) |
| 4 | MSG-023 | Nom du bénéficiaire | nom | d-ǒy « nom » (p. 102) | « du bénéficiaire » | oui (2026-11-15) |
| 5 | P3-5 | Nom du bénéficiaire | nom | d-ǒy | « du bénéficiaire » | oui (2026-11-15) |
| 6 | SEC-006 | Identifiant | nom | d-ǒy | — | non (2026-11-15) |
| 7 | PAG-009 | Type d'opération | genre | kán « type, genre » (p. 153) | « d'opération » | oui (2026-11-15) |
| 8 | P2-5 | Type d'opération | genre | kán | « d'opération » | oui (2026-11-15) |
| 9 | MSG-049 | Reçu de transaction | preuve | ndə̀m « signe, preuve » (p. 197) | « de transaction » | oui (2026-11-15) |
| 10 | SEC-004 | Authentification | preuve | ndə̀m | — | oui (2026-11-15) |
| 11 | SEC-005 | Authentification à deux facteurs | preuve | ndə̀m | « à deux facteurs » | oui (2026-11-15) |
| 12 | SEC-010 | Données personnelles | informations | pɔ́ « nouvelle, information, message » (p. 234) | « personnelles » | oui (2026-11-15) |
| 13 | SEC-036 | Expiration de session | fin | à-mànà « fin ; celui qui termine » (p. 75) | « de session » | oui (2026-11-15) |
| 14 | VOC-025 | Taux de change | prix | táŋ « calcul ; nombre ; prix, coût » (p. 251) | « de change » | oui (2026-11-15) |
| 15 | VOC-030 | Frais de retrait | prix | táŋ | « de retrait » | oui (2026-11-15) |
| 16 | VOC-031 | Frais de service | prix | táŋ | « de service » | oui (2026-11-15) |
| 17 | VOC-035 | Sous-total | prix | táŋ | — | oui (2026-11-15) |
| 18 | VOC-093 | Date de la transaction | jour | à-mǒz « jour » (p. 75) | « de la transaction » | oui (2026-11-15) |
| 19 | VOC-067 | Mobile Money | argent dans le téléphone | mɔ̀ní á ŋ̀-kwǎl (p. 192, 71, 214) | — | oui (2026-11-15) |
| 20 | VOC-069 | Carte prépayée | carte avec argent | carte èè mɔ̀ní (p. 105, 192) | — | oui (2026-11-15) |
| 21 | VOC-073 | Agence | boutique | ì-pàtìlá « magasin, épicerie, bar, boutique » (p. 135) | — | oui (2026-11-15) |
| 22 | MSG-058 | Nouveau transfert | envoyer | lóm « envoyer » (p. 174) | « nouveau » ; un verbe remplace le nom | oui (2026-11-15) |
| 23 | P5-10 | Nouveau transfert | envoyer | lóm | « nouveau » ; un verbe remplace le nom | oui (2026-11-15) |
| 24 | SEC-013 | Hameçonnage | piège | ù-lám « piège » (p. 261) | — | oui (2026-11-15) |
| 25 | SEC-033 | Signalement | informer | bɛ́nî « informer, annoncer, publier » (p. 84) | un verbe remplace le nom | oui (2026-11-15) |
| 26 | VOC-051 | Récapitulatif | liste | líz « liste » (p. 173) | — | oui (2026-11-15) |
| 27 | P4-1 | Récapitulatif | liste | líz | — | oui (2026-11-15) |
| 28 | VOC-072 | Application mobile | téléphone | ŋ̀-kwǎl « corde, fil ; téléphone ; liane » (p. 214) | on parle du téléphone, pas de l'application | oui (2026-11-15) |
| 29 | VOC-098 | Service client | aider | kà « aider » (p. 149) | un verbe remplace le nom | oui (2026-11-15) |
| 30 | ACT-028 | Souscrire | prendre | ɲɔ̀ŋ « prendre, adopter » (p. 226) | — | oui (2026-11-15) |

À savoir : 14 à 17 donnent tous táŋ ; dans l'application, ces quatre textes ne se distinguent plus.

Propositions écartées pendant l'analyse : « petit argent » et « petit coût » (bloqués par M23) ; « Banque » → maison, « Imprimer » → mettre, « Chèque » → papier (sens trop éloigné) ; « Compte » → caisse (ì-zímí veut aussi dire « cercueil ») ; Expéditeur, Destinataire, Bénéficiaire → verbe (la personne devient une action) ; « Montant à envoyer » (bloqué par la règle infinitif + préposition).

## Entrées sans proposition (220 sur 270)

Ce décompte date du premier lot ; le second lot (M24) en a débloqué 28. Aucune reformulation attestée n'a été trouvée. Principaux obstacles, mesurés sur les 270 unités non complètes (une unité peut en cumuler plusieurs) :

- « de », « d' », « du », surtout entre deux noms (« numéro du bénéficiaire ») : 119, 57 et 44 unités. Classe C : D7 montre un connectif qui varie selon la classe et le ton ;
- forme verbale non infinitive, surtout le participe passé (« compte bloqué », « argent envoyé ») : 100. D7 ne donne que l'infinitif ;
- relatif (« celui qui reçoit », « l'argent qu'on paye », « l'endroit où ») : « qui » 71, « qu' » 21, « où » 13. D7 n'a pas de règle ;
- possessif (« votre compte ») : 59 ;
- négation (« Ne communiquez jamais votre code PIN ») : 41. On ne la retire jamais, car le sens s'inverserait ;
- mots absents de D7 : permettre, vendeur, entreprise, application, maximum, secret, protection, alerte…

## Constats à part (hors de ce rapport, à décider séparément)

1. **« Retourner » (ACT-051) → vyàŋlà** : D7 donne vyàŋlà = « retourner, renverser » (retourner un objet), et non « revenir en arrière ». ✅ Corrigé le 2026-11-15 (décision du responsable) : vyàŋlà est déclaré sens faux dans `sense-review.json` ; le moteur prend le synonyme de D8 « revenir » → dúgnì « revenir, rentrer ». Seule cette entrée change.
2. **« caisse » → ì-zímí** veut aussi dire « cercueil » : non proposé pour « Compte ».
3. **« Fermer un compte » → màn compte** (màn = « finir »), alors que « fermer le compte » donnerait dìb compte (dìb = « trouver ; boucher, fermer »). Les deux sont ambigus : à laisser tel quel.

## Mise en place

Les synonymes validés vont dans `data/language-resources/d8-synonym-additions.json`, avec la date de validation. Le moteur les lit après les synonymes de D8. Au chargement, il vérifie que l'entrée existe, que son texte n'a pas changé dans D8 et que le synonyme est nouveau. Le fichier source de D8 reste intact, et chaque ajout reste traçable.
