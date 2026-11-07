# sync-transit Specification

## Purpose
Dépôt temporaire des fichiers (tuiles, manifestes) dans R2 pendant leur passage d'un appareil à l'autre : quotas, contrôle de taille, types servis, accès depuis une photo partagée et effacement dès que tous les destinataires les ont reçus.

## Requirements

### Requirement: Noms de fichiers
Le nom d'un fichier SHALL être décodé de l'adresse (`/v1/blobs/<nom>`) et respecter `[A-Za-z0-9_.-]{1,128}`, sans être `.` ni `..`. Un nom invalide ou mal encodé SHALL donner 400 `key`. Le fichier SHALL être rangé dans R2 sous `<compte>/<nom>`.

#### Scenario: Nom avec barre oblique
- **WHEN** un appareil envoie `PUT /v1/blobs/a%2Fb`
- **THEN** la réponse est 400 `key`

### Requirement: Dépôt d'un fichier
`PUT /v1/blobs/<nom>` SHALL exiger un `content-length` strictement positif (sinon 411 `length`) et d'au plus 500 Mio (sinon 413 `big`). Un fichier déjà présent pour ce compte SHALL donner 200 `{ok:true, already:true}` sans lire le corps. En cas de succès, le serveur SHALL inscrire le fichier (compte, nom, taille, date) dans la table `transit` et répondre 201 `{ok:true}`.

#### Scenario: Fichier déposé
- **WHEN** un appareil dépose 1 000 octets annoncés comme tels
- **THEN** la réponse est 201

### Requirement: Taille exacte du dépôt
Le corps d'un dépôt SHALL faire exactement la taille annoncée, contrôlée pendant l'envoi puis relue dans R2 ; sinon l'objet SHALL être effacé et la réponse SHALL être 400 `length`, pour que le quota ne puisse pas être contourné.

#### Scenario: Corps plus court que la taille annoncée
- **WHEN** un appareil annonce 1 000 octets et n'en envoie que 10
- **THEN** la réponse est 400 `length` et rien ne reste dans R2

### Requirement: Types de fichiers servis
Le type annoncé d'un dépôt SHALL être conservé seulement s'il fait partie des types autorisés (`image/jpeg|png|webp|avif|gif|heic|heif|tiff|jxl|x-*`, `application/json|octet-stream`, `video/mp4|quicktime`), sinon remplacé par `application/octet-stream`. La même règle SHALL s'appliquer à la lecture.

#### Scenario: Page HTML déguisée
- **WHEN** un appareil dépose un fichier annoncé `text/html`
- **THEN** il est servi en `application/octet-stream`

### Requirement: Quotas du transit
Le serveur SHALL refuser par 507 `full` avec `retryAfter: 600` un dépôt qui ferait dépasser la limite globale (`TRANSIT_LIMIT`, 9,5 Go par défaut) ou la limite par compte (`USER_LIMIT`, 60 % de la limite globale par défaut).

#### Scenario: Transit plein
- **WHEN** la limite globale est de 5 000 octets, 1 000 sont déjà occupés et un appareil dépose 4 500 octets
- **THEN** la réponse est 507 et l'appareil réessaiera plus tard

### Requirement: Lecture d'un fichier
`GET /v1/blobs/<nom>` SHALL rendre le fichier du compte. À défaut, si `from` désigne un autre compte et qu'un évènement de l'appelant copié depuis ce compte (`origin = from`) cite exactement ce nom, il SHALL rendre le fichier de ce compte. Sinon il SHALL répondre 404 `gone`. Le fichier SHALL être servi avec les en-têtes CORS et de sûreté, `content-disposition: attachment` et `content-length`.

#### Scenario: Fichier d'une photo partagée
- **WHEN** Marie demande `t_sh?from=<compte de Draconix>` et a reçu un évènement de Draconix citant `t_sh`
- **THEN** elle reçoit le fichier

#### Scenario: Compte hors du partage
- **WHEN** un compte qui n'a reçu aucun évènement citant `t_sh` le demande avec `from`
- **THEN** la réponse est 404

#### Scenario: Recherche exacte du nom
- **WHEN** un évènement cite `a_b` et un appareil demande `axb` avec `from`
- **THEN** la réponse est 404 (le `_` n'est pas un joker)

### Requirement: Occupation du transit
`GET /v1/usage` SHALL rendre `{used, limit, hours}` : octets occupés par tous les comptes, limite globale et durée de garde en heures (`TRANSIT_HOURS`, 24 par défaut).

#### Scenario: Transit vide
- **WHEN** tous les fichiers ont été reçus
- **THEN** `used` vaut 0

### Requirement: Effacement après réception
Après chaque accusé de réception ou retrait d'appareil, le serveur SHALL effacer (R2 et table `transit`) les fichiers d'un compte cités seulement par des évènements reçus par tous les appareils du compte destinataire (numéro ≤ plus petit curseur). Un fichier encore cité par un évènement non reçu SHALL être gardé. Comptent les évènements du compte (sans `origin`) et leurs copies chez les membres d'un partage (`origin` = ce compte).

#### Scenario: Gardé tant qu'un appareil ne l'a pas reçu
- **WHEN** la tour a accusé réception d'un évènement mais pas le Mac qui l'a envoyé
- **THEN** le fichier reste disponible

#### Scenario: Effacé quand tous l'ont reçu
- **WHEN** tous les appareils du compte ont accusé réception
- **THEN** le fichier n'est plus en transit (404)
