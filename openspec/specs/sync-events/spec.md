# sync-events Specification

## Purpose
Journal d'évènements par compte (« ce projet a changé », « ce projet a été supprimé », « renvoyez-moi tout ») qui indique aux appareils quoi récupérer, avec un curseur par appareil et la recopie vers les comptes avec qui une photo est partagée.

## Requirements

### Requirement: Envoi d'un évènement
`POST /v1/events` avec `{kind, pid, body?, blobs?}` SHALL ajouter un évènement au journal du compte et répondre 201 `{seq}`. Après l'ajout, les appareils connectés du compte SHALL être prévenus par `{type:"event", seq, from:<appareil>}`.

#### Scenario: Projet modifié
- **WHEN** le Mac envoie `{kind:"put", pid:"p1", body:{name:"lac.jpg"}, blobs:["tile1"]}`
- **THEN** la réponse est 201 avec un `seq` positif et la tour connectée reçoit `{type:"event"}`

#### Scenario: Tout renvoyer
- **WHEN** un appareil envoie `{kind:"want", pid:"*"}`
- **THEN** la réponse est 201

### Requirement: Validation d'un évènement
`kind` SHALL valoir `put`, `delete` ou `want` (sinon 400 `kind`). `pid` SHALL respecter `[A-Za-z0-9_.-]{1,64}`, ou valoir `*` pour `want` seulement (sinon 400 `pid`). `blobs` SHALL être réduit aux noms valides (voir sync-transit), 5 000 au plus. `body` SHALL être stocké tel quel en JSON, 4 Mio au plus une fois sérialisé (sinon 413 `big`).

#### Scenario: Type inconnu
- **WHEN** un appareil envoie `{kind:"rename", pid:"p1"}`
- **THEN** la réponse est 400 `kind`

#### Scenario: Joker hors want
- **WHEN** un appareil envoie `{kind:"delete", pid:"*"}`
- **THEN** la réponse est 400 `pid`

### Requirement: Débit des évènements
Le serveur SHALL accepter au plus 1 200 envois d'évènements par minute et par compte, et répondre 429 `slow` avec `retryAfter: 60` au-delà. Chaque appel compte, même s'il est ensuite refusé pour un autre motif.

#### Scenario: Import massif
- **WHEN** un compte envoie son 1 201e évènement dans la minute
- **THEN** la réponse est 429

### Requirement: Recopie vers une photo partagée
Pour un `pid` partagé avec l'appelant (voir sync-sharing), hors `delete` d'un invité, le serveur SHALL recopier l'évènement dans le journal de chaque autre membre avec `origin` = compte d'envoi et prévenir chacun par `{type:"event", seq, from}`. Pour un `delete` envoyé par la propriétaire, il SHALL en plus supprimer le partage et son verrou.

#### Scenario: Retouche partagée
- **WHEN** Draconix enregistre une photo partagée avec Marie
- **THEN** Marie reçoit un évènement `put` dont `origin` est le compte de Draconix

### Requirement: Suppression par un invité
Un `delete` envoyé par un invité (rôle `edit`) sur une photo partagée SHALL seulement retirer l'invité du partage, sans recopie, et prévenir les autres membres par `{type:"share", pid}`.

#### Scenario: Marie supprime la photo chez elle
- **WHEN** Marie envoie `delete` sur la photo partagée par Draconix
- **THEN** Marie quitte le partage et la photo n'est pas supprimée chez Draconix

### Requirement: Enregistrement réservé au détenteur du verrou
Un `put` sur une photo partagée SHALL être refusé par 423 `locked` avec `holder: {name, until}` quand un autre compte tient un verrou non expiré, avant tout ajout au journal.

#### Scenario: Enregistrement pendant le tour d'un autre
- **WHEN** Marie tient le verrou et Draconix envoie un `put` sur la photo
- **THEN** la réponse est 423 et nomme Marie

### Requirement: Lecture du journal
`GET /v1/events?after=<n>` SHALL rendre les évènements du compte de numéro strictement supérieur à `n` (valeur non numérique ou négative → 0), par ordre croissant, 200 au plus, sous la forme `{events:[{seq, device, kind, pid, body, blobs, created, origin}], more}` où `body` et `blobs` sont décodés du JSON et `more` vaut vrai quand 200 évènements sont rendus.

#### Scenario: La tour voit le changement
- **WHEN** la tour demande `after=0` après l'envoi du Mac
- **THEN** elle reçoit l'évènement avec `pid:"p1"` et `body.name:"lac.jpg"`

#### Scenario: Isolation des comptes
- **WHEN** un autre compte lit son journal
- **THEN** il ne voit aucun évènement du premier compte

### Requirement: Accusé de réception
`POST /v1/ack` avec `{seq}` SHALL porter le curseur de l'appareil à `max(curseur, seq)` (valeur non numérique ou négative → 0), répondre `{ok:true}`, puis lancer en arrière-plan l'effacement après réception (voir sync-transit) pour le compte et pour chaque compte d'origine des évènements reçus.

#### Scenario: Curseur qui ne recule pas
- **WHEN** un appareil au curseur 10 envoie `{seq:4}`
- **THEN** son curseur reste 10
