# M22 — Synonymes de D8 compatibles avec D7 (rapport à valider)

**Statut : en attente de validation par le responsable.** Rien n'est encore ajouté aux données ; D8 n'est pas modifié.

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

**Colonne « Décision »** : écrire **oui** ou **non** (ou une autre formulation). Le groupe A garde le sens ; le groupe B le rapproche (un mot perdu, un verbe à la place d'un nom, une glose à double sens) et demande votre jugement.

### A. Sens fidèle (15)

| Sens | ID | Texte de D8 | Synonyme proposé | Éton obtenu | Remarque | Décision |
|---|---|---|---|---|---|---|
| ✅ | ACT-031 | Ouvrir un compte | ouvrir le compte | yázî compte | — |  |
| ✅ | ACT-035 | Ajouter un bénéficiaire | ajouter le bénéficiaire | bág bénéficiaire | « un » bloquait (règle du nombre) |  |
| ✅ | ACT-043 | Demander un code de vérification | demander le code | bólô code | — |  |
| ✅ | ACT-053 | Précédent | revenir | dúgnì | — |  |
| ✅ | VOC-004 | Portefeuille électronique | argent dans le téléphone | mɔ̀ní á ŋ̀-kwǎl | reprend la définition de D8 |  |
| ✅ | VOC-018 | Devise | monnaie | cáz | entrée cáz1 « monnaie » ; homonymes cáz2–4 (tacle, contrôler) écrits pareil |  |
| ✅ | VOC-054 | En attente | attendre | yàŋà | D8 : « il faut attendre » |  |
| ✅ | MSG-021 | Ce service est gratuit. | Service pour rien. | Service á pûpùd. | á pûpùd « pour rien » |  |
| ✅ | MSG-037 | Frais : {frais} {devise} | Prix : {frais} {devise} | táŋ : {frais} {devise} | D8 : « Prix du service » |  |
| ✅ | MSG-050 | Numéro de référence : {référence} | Numéro : {référence} | nwàmɔ̀ : {référence} | — |  |
| ✅ | MSG-078 | Notifications | messages | pɔ́ | pɔ́ « nouvelle, information, message » |  |
| ✅ | PAG-016 | Paiement de services | payer le service | yágnà service | — |  |
| ✅ | P2-12 | Retour | revenir | dúgnì | — |  |
| ✅ | P3-8 | Paiement de services | payer le service | yágnà service | — |  |
| ✅ | P5-8 | Statut | état | ì-tə́ | — |  |

### B. Sens proche, à juger (35)

| Sens | ID | Texte de D8 | Synonyme proposé | Éton obtenu | Remarque | Décision |
|---|---|---|---|---|---|---|
| ≈ | ACT-016 | Confirmer | accepter | mə̀m | mə̀m « avouer, accepter » ; même forme que Valider |  |
| ≈ | ACT-020 | Autoriser | accepter | mə̀m | « permettre » absent de D7 |  |
| ≈ | ACT-023 | Accepter les conditions | accepter la loi | mə̀m mbɛ́ní | mbɛ́ní « loi, interdiction » ; « règles » absent de D7 |  |
| ≈ | ACT-025 | Contester | refuser l'opération | bɛ̀n ì-sàlgà | contester ≈ refuser |  |
| ≈ | ACT-034 | Débloquer | ouvrir le compte | yázî compte | D8 : « rouvrir », « permettre encore d'utiliser un compte » |  |
| ≈ | ACT-039 | Réinitialiser | changer le code | cɛ́nî code | D8 : « remettre comme au début (mot de passe, code secret) » |  |
| ≈ | VOC-008 | Solde disponible | argent dans le compte | mɔ̀ní á compte | perd « disponible » |  |
| ≈ | VOC-013 | Plafond | limite | ɲ̀-ɲə̀ | ɲ̀-ɲə̀ « limite ; époque » |  |
| ≈ | VOC-024 | Somme | argent | mɔ̀ní | somme = quantité d'argent |  |
| ≈ | VOC-043 | Virement | envoyer de l'argent à la banque | lóm mɔ̀ní á banque | verbe à la place du nom |  |
| ≈ | VOC-048 | Crédit | ajouter de l'argent | bág mɔ̀ní | verbe à la place du nom (= Créditer) |  |
| ≈ | VOC-049 | Débit | enlever de l'argent | sóg mɔ̀ní | verbe à la place du nom (= Débiter) |  |
| ≈ | VOC-050 | Reçu | preuve | ndə̀m | ndə̀m « signe, preuve » |  |
| ≈ | VOC-052 | Référence | numéro | nwàmɔ̀ | D8 : « numéro de l'opération » |  |
| ≈ | VOC-053 | Statut de la transaction | état | ì-tə́ | perd « de la transaction » |  |
| ≈ | VOC-080 | Prêt | dette | ì-kòló | point de vue de celui qui emprunte |  |
| ≈ | VOC-097 | Conditions générales | loi | mbɛ́ní | mbɛ́ní « loi, interdiction » |  |
| ≈ | MSG-002 | Votre solde disponible est de {montant} {devise}. | Argent dans le compte : {montant} {devise}. | mɔ̀ní á compte : {montant} {devise}. | perd « disponible » |  |
| ≈ | MSG-003 | Numéro de compte : {numéro_compte} | Numéro : {numéro_compte} | nwàmɔ̀ : {numéro_compte} | perd « de compte » |  |
| ≈ | MSG-009 | Voir toutes les transactions | voir les opérations | yɛ́n ì-sàlgà | perd « toutes » |  |
| ≈ | MSG-013 | Frais de transfert : {frais} {devise} | Prix : {frais} {devise} | táŋ : {frais} {devise} | perd « de transfert » |  |
| ≈ | MSG-040 | Référence : {référence} | Numéro : {référence} | nwàmɔ̀ : {référence} | D8 : « Code » |  |
| ≈ | MSG-046 | Date de l'opération : {date} | Jour : {date} | à-mǒz : {date} | perd « de l'opération » |  |
| ≈ | MSG-062 | Chargement en cours... | attendre | yàŋà | — |  |
| ≈ | MSG-079 | Aide et assistance | aider | kà | verbe à la place du nom |  |
| ≈ | SEC-032 | Opposition | arrêter la carte | tɛ́lî carte | tɛ́lî « placer ; arrêter » |  |
| ≈ | SEC-034 | Preuve de transaction | preuve | ndə̀m | perd « de transaction » |  |
| ≈ | PAG-004 | Salaire reçu | recevoir le salaire | g͡bɛ̀ɛn ̀ ì mwàní à ŋgwàn | verbe à la place de « reçu » |  |
| ≈ | PAG-005 | Transfert reçu | recevoir de l'argent | g͡bɛ̀ɛn ̀ ì mɔ̀ní | verbe à la place de « reçu » |  |
| ≈ | P1-4 | Solde disponible | argent dans le compte | mɔ̀ní á compte | perd « disponible » |  |
| ≈ | P1-11 | Salaire reçu | recevoir le salaire | g͡bɛ̀ɛn ̀ ì mwàní à ŋgwàn | — |  |
| ≈ | P1-12 | Transfert reçu | recevoir de l'argent | g͡bɛ̀ɛn ̀ ì mɔ̀ní | — |  |
| ≈ | P4-8 | Référence | numéro | nwàmɔ̀ | — |  |
| ≈ | P4-12 | Confirmer le transfert | accepter le transfert | mə̀m transfert | confirmer ≈ accepter |  |
| ≈ | P5-3 | Référence | numéro | nwàmɔ̀ | — |  |

## Entrées sans proposition (220 sur 270)

Aucune reformulation attestée n'a été trouvée. Principaux obstacles, mesurés sur les 270 unités non complètes (une unité peut en cumuler plusieurs) :

- « de », « d' », « du », surtout entre deux noms (« numéro du bénéficiaire ») : 119, 57 et 44 unités. Classe C : D7 montre un connectif qui varie selon la classe et le ton ;
- forme verbale non infinitive, surtout le participe passé (« compte bloqué », « argent envoyé ») : 100. D7 ne donne que l'infinitif ;
- relatif (« celui qui reçoit », « l'argent qu'on paye », « l'endroit où ») : « qui » 71, « qu' » 21, « où » 13. D7 n'a pas de règle ;
- possessif (« votre compte ») : 59 ;
- négation (« Ne communiquez jamais votre code PIN ») : 41. On ne la retire jamais, car le sens s'inverserait ;
- mots absents de D7 : permettre, vendeur, entreprise, application, maximum, secret, protection, alerte…

## Constats à part (hors de ce rapport, à décider séparément)

1. **« Retourner » (ACT-051) → vyàŋlà**, traduction complète aujourd'hui. Mais D7 donne vyàŋlà = « retourner, renverser » (retourner un objet), et non « revenir en arrière ». Le bouton veut dire « revenir » → dúgnì « revenir, rentrer ». Proposition : marquer vyàŋlà comme sens faux pour ACT-051 (mécanisme M18) et ajouter « revenir » comme synonyme.
2. **« caisse » → ì-zímí** veut aussi dire « cercueil » : non proposé pour « Compte ».
3. **« Fermer un compte » → màn compte** (màn = « finir »), alors que « fermer le compte » donnerait dìb compte (dìb = « trouver ; boucher, fermer »). Les deux sont ambigus : à laisser tel quel.

## Après validation

Les synonymes validés iront dans un fichier séparé (`data/language-resources/d8-synonym-additions.json`, avec la date de validation), lu par le moteur en plus de D8. Le fichier source de D8 reste intact, et chaque ajout reste traçable.
