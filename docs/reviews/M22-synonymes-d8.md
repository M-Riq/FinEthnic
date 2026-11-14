# M22 — Synonymes de D8 compatibles avec D7 (rapport à valider)

**Statut :** les 50 propositions sont validées par le responsable : le 2026-11-15 (groupe A, 15, en bloc ; groupe B, 35, une par une). Elles sont ajoutées dans `data/language-resources/d8-synonym-additions.json` : 105 → 155 entrées complètes (154 après le contrôle nom + adjectif de M23, qui retire « Arrondi »). Le fichier source de D8 n'est pas modifié.

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

## Entrées sans proposition (220 sur 270)

Aucune reformulation attestée n'a été trouvée. Principaux obstacles, mesurés sur les 270 unités non complètes (une unité peut en cumuler plusieurs) :

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
