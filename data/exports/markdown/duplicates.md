# Rapport de doublons — bibliothèque FinEthnic

> Fichier **généré** par `npm run check-duplicates` (ROADMAP §8, BM2.4) : ne pas le modifier à la main.
> Ce rapport ne supprime ni ne fusionne rien. Chaque décision revient au responsable (ROADMAP §8.2) ;
> les listes tenues à la main sont dans `data/language-resources/duplicate-review.json`.

## Résumé

| Contrôle | Résultat |
|---|---|
| Entrées analysées | 379 (371 textes uniques) |
| Erreurs dans les listes tenues à la main | 0 |
| Points à arbitrer | 0 |
| Niveau 1 — doublons stricts (corpus) | 0 |
| Niveau 2 — doublons après normalisation (corpus) | 0 |
| Pages — textes répétés | 5 groupe(s), 8 répétition(s) |
| Pages ↔ corpus — liens `exact` | 36 (19 vers VOC/ACT/SEC/MSG, 17 vers PAG) |
| Pages ↔ corpus — liens `meaning` | 16 |
| Niveau 3 — doublons potentiels | 23 |
| Phrases incluses dans un paragraphe | 0 |
| Libellé ↔ gabarit (T-LIB-09) | 7 paire(s), 0 divergente(s) |
| Synonymes égaux au texte d'une autre entrée | 12 |
| Synonymes égaux à un texte protégé (GUARD) | 1 |
| Synonymes utilisés comme variantes de recherche | 0 |
| Niveau 4 — paires opposées | 8 (+ 3 sans entrée) |
| Termes proches mais distincts | 8 |

## Points à arbitrer

_Aucun._

## Niveau 1 — Doublons stricts (corpus)

Textes identiques entre entrées du corpus. Les fusions déjà faites par D8 sont tracées dans `links.mergedFrom`.

_Aucun doublon strict._

## Niveau 2 — Doublons après normalisation (corpus)

Mêmes textes à la casse, aux espaces, aux apostrophes et à la ponctuation finale près.

_Aucun doublon après normalisation._

## Pages — textes répétés (une seule unité de traduction)

Normal : chaque occurrence garde son ID de page et pointe vers la première par `duplicateOf`.

| Première occurrence | Texte | Répétitions |
|---|---|---|
| P2-3 | « Montant » | P4-3, P5-4 |
| P2-8 | « Frais » | P4-4, P5-5 |
| P3-1 | « Bénéficiaire » | P4-6, P5-7 |
| P4-5 | « Total débité » | P5-6 |
| P4-8 | « Référence » | P5-3 |

## Pages ↔ corpus — liens `exact` (traduction partagée)

| Page | Texte | Entrée du corpus |
|---|---|---|
| P1-2 | « Bonjour » | PAG-001 |
| P1-4 | « Solde disponible » | VOC-008 |
| P1-5 | « Numéro de compte » | VOC-005 |
| P1-6 | « Compte courant » | VOC-002 |
| P1-8 | « Consulter les frais » | PAG-002 |
| P1-9 | « Transactions récentes » | MSG-004 |
| P1-10 | « Paiement marchand » | PAG-003 |
| P1-11 | « Salaire reçu » | PAG-004 |
| P1-12 | « Transfert reçu » | PAG-005 |
| P1-13 | « Facture électricité » | PAG-006 |
| P1-14 | « Sécurité » | PAG-007 |
| P1-15 | « Connexion sécurisée » | SEC-008 |
| P2-1 | « Frais de transfert » | VOC-029 |
| P2-3 | « Montant » | VOC-023 |
| P2-4 | « Montant à envoyer » | PAG-008 |
| P2-5 | « Type d'opération » | PAG-009 |
| P2-6 | « Compte Safinum » | PAG-010 |
| P2-7 | « Transfert instantané et gratuit » | PAG-011 |
| P2-8 | « Frais » | VOC-028 |
| P2-9 | « Gratuit » | VOC-038 |
| P2-11 | « Solde après opération » | PAG-012 |
| P2-13 | « Continuer » | ACT-050 |
| P3-1 | « Bénéficiaire » | VOC-058 |
| P3-2 | « Renseignez les informations du destinataire » | PAG-013 |
| P3-3 | « Vérifiez toujours le numéro » | PAG-014 |
| P3-4 | « Ce bénéficiaire n'a jamais été utilisé sur ce compte » | PAG-015 |
| P3-5 | « Nom du bénéficiaire » | MSG-023 |
| P3-6 | « Numéro de téléphone » | VOC-077 |
| P3-7 | « Motif du transfert » | VOC-078 |
| P3-8 | « Paiement de services » | PAG-016 |
| P3-10 | « J'ai vérifié le nom et le numéro du bénéficiaire » | PAG-017 |
| P4-1 | « Récapitulatif » | VOC-051 |
| P4-8 | « Référence » | VOC-052 |
| P4-9 | « Opération » | VOC-041 |
| P4-11 | « Modifier » | ACT-037 |
| P5-10 | « Nouveau transfert » | MSG-058 |

## Pages ↔ corpus — liens `meaning` (même sens, traduction distincte)

Le texte de la page diffère du corpus : chaque traduction est validée séparément.

| Page | Texte de la page | Entrée du corpus | Texte du corpus |
|---|---|---|---|
| P1-1 | « Votre compte » | VOC-001 | « Compte » |
| P1-3 | « Consultez votre solde » | ACT-045 | « Consulter le solde » |
| P1-7 | « Effectuer un transfert » | ACT-003 | « Transférer » |
| P2-2 | « Choisissez le type de transfert » | MSG-011 | « Choisissez le type d'opération. » |
| P2-10 | « Total à débiter » | MSG-014 | « Total à débiter : {total} {devise} » |
| P2-12 | « Retour » | ACT-051 | « Retourner » |
| P3-9 | « Note (optionnel) » | MSG-026 | « Note (facultative) » |
| P4-2 | « Vérifiez les informations avant de confirmer le transfert » | MSG-043 | « Vérifiez attentivement avant de confirmer. » |
| P4-5 | « Total débité » | MSG-038 | « Total débité : {total} {devise} » |
| P4-7 | « Téléphone » | VOC-077 | « Numéro de téléphone » |
| P4-10 | « Je confirme que les informations ci-dessus sont correctes » | MSG-041 | « Je confirme que les informations ci-dessus sont exactes. » |
| P4-12 | « Confirmer le transfert » | ACT-016 | « Confirmer » |
| P5-1 | « Transfert effectué » | MSG-047 | « Transfert effectué avec succès. » |
| P5-2 | « Votre transfert a été envoyé avec succès » | MSG-047 | « Transfert effectué avec succès. » |
| P5-8 | « Statut » | VOC-053 | « Statut de la transaction » |
| P5-9 | « Succès » | VOC-055 | « Réussi » |

## Niveau 3 — Doublons potentiels (heuristique, décision humaine)

Inclusion d'un texte d'au moins deux mots dans un autre, ou au moins 80 % de mots communs dans la même catégorie. Variables `{…}` ignorées.

| Entrée A | Entrée B | Raison | Déjà connu |
|---|---|---|---|
| ACT-040 « Changer le code PIN » | SEC-001 « Code PIN » | « code pin » est contenu dans l'autre texte | — |
| ACT-043 « Demander un code de vérification » | SEC-003 « Code de vérification » | « code de vérification » est contenu dans l'autre texte | — |
| ACT-060 « Entrer le code de vérification » | SEC-003 « Code de vérification » | « code de vérification » est contenu dans l'autre texte | — |
| MSG-002 « Votre solde disponible est de {montant} {devise}. » | VOC-008 « Solde disponible » | « solde disponible » est contenu dans l'autre texte | — |
| MSG-011 « Choisissez le type d'opération. » | PAG-009 « Type d'opération » | « type d'opération » est contenu dans l'autre texte | — |
| MSG-012 « Saisissez le montant à envoyer. » | PAG-008 « Montant à envoyer » | « montant à envoyer » est contenu dans l'autre texte | — |
| MSG-018 « Le montant saisi dépasse votre solde disponible. » | VOC-008 « Solde disponible » | « solde disponible » est contenu dans l'autre texte | — |
| MSG-022 « Vous avez atteint votre limite journalière. » | VOC-014 « Limite journalière » | « limite journalière » est contenu dans l'autre texte | — |
| MSG-023 « Nom du bénéficiaire » | MSG-027 « Veuillez renseigner le nom du bénéficiaire. » | « nom du bénéficiaire » est contenu dans l'autre texte | — |
| MSG-023 « Nom du bénéficiaire » | SEC-044 « Vérifiez toujours le nom du bénéficiaire avant de confirmer. » | « nom du bénéficiaire » est contenu dans l'autre texte | — |
| MSG-024 « Numéro de téléphone du bénéficiaire » | VOC-077 « Numéro de téléphone » | « numéro de téléphone » est contenu dans l'autre texte | — |
| MSG-028 « Le numéro de téléphone saisi n'est pas valide. » | VOC-077 « Numéro de téléphone » | « numéro de téléphone » est contenu dans l'autre texte | — |
| MSG-053 « Transaction en attente de traitement. » | VOC-054 « En attente » | « en attente » est contenu dans l'autre texte | recouvrement connu |
| MSG-066 « Solde insuffisant pour effectuer cette opération. » | VOC-009 « Solde insuffisant » | « solde insuffisant » est contenu dans l'autre texte | recouvrement connu |
| MSG-071 « Contactez le service client pour obtenir de l'aide. » | VOC-098 « Service client » | « service client » est contenu dans l'autre texte | — |
| MSG-074 « Service client disponible de {heure} à {heure}. » | VOC-098 « Service client » | « service client » est contenu dans l'autre texte | — |
| SEC-001 « Code PIN » | SEC-041 « Ne communiquez jamais votre code PIN à personne. » | « code pin » est contenu dans l'autre texte | — |
| SEC-002 « Mot de passe » | SEC-040 « Mot de passe oublié » | « mot de passe » est contenu dans l'autre texte | — |
| SEC-002 « Mot de passe » | SEC-055 « Changez votre mot de passe régulièrement. » | « mot de passe » est contenu dans l'autre texte | — |
| SEC-003 « Code de vérification » | SEC-042 « Nous ne vous demanderons jamais votre code de vérification. » | « code de vérification » est contenu dans l'autre texte | — |
| SEC-003 « Code de vérification » | SEC-052 « Un code de vérification a été envoyé au {numéro}. » | « code de vérification » est contenu dans l'autre texte | — |
| SEC-017 « Activité inhabituelle » | SEC-046 « Une activité inhabituelle a été détectée sur votre compte. » | « activité inhabituelle » est contenu dans l'autre texte | — |
| SEC-037 « Appareil de confiance » | SEC-049 « Connectez-vous uniquement depuis un appareil de confiance. » | « appareil de confiance » est contenu dans l'autre texte | — |

### Recouvrements de sens connus (liste tenue à la main)

| Recouvrement | Entrées | Repéré par l'heuristique |
|---|---|---|
| Solde insuffisant (terme et phrase) | VOC-009 « Solde insuffisant » / MSG-066 « Solde insuffisant pour effectuer cette opération. » | oui |
| En attente (terme et phrase) | VOC-054 « En attente » / MSG-053 « Transaction en attente de traitement. » | oui |
| Service indisponible / Opération impossible pour le moment | MSG-060 « Service temporairement indisponible. » / MSG-065 « Opération impossible pour le moment. » | non (sens seulement) |
| Code incorrect / Informations incorrectes | SEC-053 « Le code saisi est incorrect ou a expiré. » / MSG-068 « Les informations saisies sont incorrectes. » | non (sens seulement) |

## Phrases incluses dans un paragraphe

_Aucune phrase d'un paragraphe n'est égale au texte d'une autre entrée._

## Libellé ↔ gabarit (T-LIB-09)

Un libellé seul et le même libellé dans un gabarit « Libellé : {variable} » devraient avoir des traductions cohérentes. Une divergence est signalée mais ne bloque rien.

| Libellé | Gabarit | Pages | Cible du libellé | Cible du gabarit | État |
|---|---|---|---|---|---|
| VOC-005 « Numéro de compte » | MSG-003 « Numéro de compte : {numéro_compte} » | P1-5 | — | — | pas encore traduit |
| VOC-029 « Frais de transfert » | MSG-013 « Frais de transfert : {frais} {devise} » | P2-1 | — | — | pas encore traduit |
| VOC-028 « Frais » | MSG-037 « Frais : {frais} {devise} » | P2-8, P4-4, P5-5 | — | — | pas encore traduit |
| VOC-058 « Bénéficiaire » | MSG-039 « Bénéficiaire : {nom_bénéficiaire} » | P3-1, P4-6, P5-7 | — | — | pas encore traduit |
| VOC-052 « Référence » | MSG-040 « Référence : {référence} » | P4-8, P5-3 | — | — | pas encore traduit |
| P2-10 « Total à débiter » | MSG-014 « Total à débiter : {total} {devise} » | P2-10 | — | — | pas encore traduit |
| P4-5 « Total débité » | MSG-038 « Total débité : {total} {devise} » | P4-5, P5-6 | — | — | pas encore traduit |

## Synonymes égaux au texte d'une autre entrée

Normal et attendu : les synonymes sont les niveaux 2 et 3 de la cascade de traduction (PROJECT_CONTEXT §3.10). Ils ne servent **jamais** à reconnaître un texte : « monnaie » désigne VOC-017, pas VOC-016 (T-LIB-12).

| Entrée | Synonyme | Égal au texte de |
|---|---|---|
| ACT-003 « Transférer » | « envoyer » | ACT-001 |
| ACT-022 « Rejeter » | « refuser » | ACT-019 |
| ACT-047 « Choisir » | « sélectionner » | ACT-049 |
| ACT-049 « Sélectionner » | « choisir » | ACT-047 |
| VOC-016 « Argent » | « monnaie » | VOC-017 |
| VOC-023 « Montant » | « somme » | VOC-024 |
| VOC-024 « Somme » | « montant » | VOC-023 |
| VOC-040 « Transaction » | « opération » | VOC-041 |
| VOC-041 « Opération » | « transaction » | VOC-040 |
| VOC-044 « Paiement » | « payer » | ACT-004 |
| VOC-055 « Réussi » | « succès » | P5-9 |
| VOC-096 « Confidentialité » | « vie privée » | SEC-011 |

### Synonymes égaux à un texte protégé (GUARD)

La cascade ne doit jamais traduire ces synonymes : ils restent recopiés tels quels.

| Entrée | Synonyme | Texte protégé |
|---|---|---|
| VOC-019 « Franc CFA (FCFA) » | « FCFA » | GUARD-003 |

## Synonymes utilisés comme variantes de recherche (doit rester vide)

_Aucun : les synonymes ne sont pas des clés de recherche._

## Niveau 4 — Paires opposées (cibles Éton obligatoirement différentes)

| Paire | Entrées | Cibles Éton |
|---|---|---|
| Débit / Crédit | VOC-049 « Débit » / VOC-048 « Crédit » | aucune cible pour l'instant |
| Débiter / Créditer | ACT-010 « Débiter » / ACT-011 « Créditer » | aucune cible pour l'instant |
| Envoyer / Recevoir | ACT-001 « Envoyer » / ACT-002 « Recevoir » | aucune cible pour l'instant |
| Confirmer / Annuler | ACT-016 « Confirmer » / ACT-017 « Annuler » | aucune cible pour l'instant |
| Bloquer / Débloquer | ACT-033 « Bloquer » / ACT-034 « Débloquer » | aucune cible pour l'instant |
| Bénéficiaire / Expéditeur | VOC-058 « Bénéficiaire » / VOC-057 « Expéditeur » | aucune cible pour l'instant |
| En attente / Réussi | VOC-054 « En attente » / VOC-055 « Réussi » | aucune cible pour l'instant |
| Dépôt / Retrait | VOC-045 « Dépôt » / VOC-046 « Retrait » | aucune cible pour l'instant |

### Paires opposées sans entrée dans la bibliothèque

| Paire | Raison |
|---|---|
| Montant envoyé / Montant reçu | seul le gabarit MSG-036 « Montant envoyé : {montant} {devise} » existe dans D8 |
| Solde disponible / Solde comptable | « Solde comptable » n'est pas dans D8 |
| Refusé / Annulé | ni « Refusé » ni « Annulé » ne sont des entrées de D8 |

## Termes proches mais distincts (à préserver)

| Termes | Entrées | Cibles Éton |
|---|---|---|
| Montant / Somme | VOC-023 « Montant » / VOC-024 « Somme » | aucune cible pour l'instant |
| Bénéficiaire / Destinataire | VOC-058 « Bénéficiaire » / VOC-059 « Destinataire » | aucune cible pour l'instant |
| Transfert / Virement | VOC-042 « Transfert » / VOC-043 « Virement » | aucune cible pour l'instant |
| Débit / Débiter (nom et verbe) | VOC-049 « Débit » / ACT-010 « Débiter » | aucune cible pour l'instant |
| Confirmer / Valider / Approuver | ACT-016 « Confirmer » / ACT-018 « Valider » / ACT-021 « Approuver » | aucune cible pour l'instant |
| Continuer / Suivant | ACT-050 « Continuer » / ACT-052 « Suivant » | aucune cible pour l'instant |
| Blocage temporaire / Verrouillage du compte | SEC-028 « Blocage temporaire » / SEC-030 « Verrouillage du compte » | aucune cible pour l'instant |
| Confidentialité / Vie privée | VOC-096 « Confidentialité » / SEC-011 « Vie privée » | aucune cible pour l'instant |
