# sync-sharing Specification

## Purpose
Travail à plusieurs sur une même photo : partage entre comptes (une propriétaire, des invités en retouche) et verrou « chacun son tour » qui évite que deux personnes enregistrent la même photo en même temps.

## Requirements

### Requirement: Liste des partages
`GET /v1/shares` SHALL rendre `{shares:[{pid, role, members:[{user, email, role, me}], lock}]}` pour chaque photo partagée du compte, membres dans l'ordre d'arrivée, et `lock` à `null` ou `{user, device, name, until, me}` si un verrou est en cours.

#### Scenario: Marie voit le partage
- **WHEN** Draconix a partagé une photo avec Marie et Marie lit ses partages
- **THEN** elle voit une photo, deux membres, et son rôle est `edit`

### Requirement: Vérifications d'une invitation
`POST /v1/shares` avec `{pid, email}` SHALL vérifier, dans cet ordre : `pid` valide (sinon 400 `pid`) ; adresse valide (sinon 400 `email`) ; 10 invitations par heure et par compte, chaque appel comptant (sinon 429 `slow`, `retryAfter: 3600`) ; premier partage possible (voir ci-dessous) ; appelant propriétaire (sinon 403 `owner`) ; adresse d'un compte existant (sinon 404 `nouser`) ; autre que soi (sinon 400 `self`) ; moins de dix membres (sinon 400 `full`).

#### Scenario: Adresse sans compte
- **WHEN** Draconix invite `personne@example.com`
- **THEN** la réponse est 404 `nouser`

### Requirement: Premier partage d'une photo
Quand l'appelant n'est pas encore membre, il SHALL avoir lui-même envoyé un `put` pour ce `pid`, et aucun autre compte ne SHALL déjà partager ce `pid` ni l'avoir envoyé ; sinon 404 `pid`. L'appelant SHALL alors être inscrit propriétaire (`owner`), même si la suite de l'invitation échoue.

#### Scenario: Partager la photo d'un autre
- **WHEN** Marie tente de partager une photo envoyée par Draconix
- **THEN** la réponse est 404

### Requirement: Invitation acceptée
Une invitation valide SHALL ajouter l'invité en `edit` (sans doublon), ajouter au journal de la propriétaire un évènement `want` (appareil `partage`, `origin` = invité) pour que ses appareils renvoient la photo, prévenir la propriétaire par `{type:"event", seq, from:"share"}` et l'invité par `{type:"share", pid}`, puis répondre 201.

#### Scenario: Photo partagée
- **WHEN** Draconix invite `marie@example.com` sur une photo qu'il a envoyée
- **THEN** la réponse est 201 et ses appareils reçoivent un `want` pour cette photo

### Requirement: Fin d'un partage
`DELETE /v1/shares/<pid>/<compte>` SHALL : si l'appelante est propriétaire et se retire elle-même, supprimer tout le partage et son verrou ; sinon retirer le compte visé (jamais une propriétaire) et son verrou. Un invité ne SHALL retirer que lui-même. Un appelant hors du partage ou un invité visant un autre SHALL recevoir 404 `share`. Le compte visé et les autres membres SHALL être prévenus par `{type:"share", pid}`.

#### Scenario: Un inconnu retire Marie
- **WHEN** un compte hors du partage demande à retirer Marie
- **THEN** la réponse est 404

#### Scenario: La propriétaire retire Marie
- **WHEN** Draconix retire Marie
- **THEN** Marie ne voit plus le partage

### Requirement: Verrou « chacun son tour »
`POST /v1/locks/<pid>` SHALL donner le verrou au compte appelant pour 10 minutes (renouvelable par lui), avec pour nom affiché la partie locale de son adresse, et répondre `{ok:true, until}`. Si un autre compte tient un verrou non expiré, la réponse SHALL être 409 `locked` avec `holder: {name, until}`. Un nouveau verrou SHALL être annoncé aux autres membres par `{type:"lock", pid}`. Une photo non partagée avec l'appelant SHALL donner 404 `share`.

#### Scenario: Draconix voit que Marie retouche
- **WHEN** Marie tient le verrou et Draconix le demande
- **THEN** la réponse est 409 et `holder.name` vaut `marie`

### Requirement: Rendre le verrou
`DELETE /v1/locks/<pid>` SHALL supprimer le verrou s'il appartient à l'appelant, l'annoncer aux autres membres par `{type:"lock", pid}`, et répondre `{ok:true}` dans tous les cas pour un membre du partage.

#### Scenario: Passage de main
- **WHEN** Marie rend le verrou puis Draconix le demande
- **THEN** Draconix l'obtient
