# sync-accounts Specification

## Purpose
Comptes Prism pour la synchronisation : création de compte, connexion, sessions par appareil, profil (nom et photo), liste et retrait des appareils, avec les protections contre les essais de mots de passe en masse.

## Requirements

### Requirement: Création de compte
`POST /v1/signup` avec `{email, password, device?}` SHALL créer un compte dont l'identifiant est 8 octets aléatoires en hexadécimal, ouvrir une session (voir « Jetons de session ») et répondre 201 `{token, user, device, email}`. Une adresse déjà prise SHALL donner 409 `exists`.

#### Scenario: Inscription réussie
- **WHEN** un appareil envoie `{email:"Draco@Example.com", password:"motdepasse1", device:{name:"Mac", platform:"mac"}}`
- **THEN** la réponse est 201 avec un jeton, et l'adresse enregistrée est `draco@example.com`

#### Scenario: Adresse déjà prise
- **WHEN** un second compte est demandé pour `draco@example.com`
- **THEN** la réponse est 409 `exists`

### Requirement: Format de l'adresse et du mot de passe
À l'inscription, l'adresse SHALL être normalisée (espaces retirés aux extrémités, minuscules) et SHALL respecter le format `local@domaine.tld` sans espace, `@`, `<`, `>`, `"`, `'` ni accent grave (partie locale ≤ 64, domaine ≤ 190, extension ≥ 2), sinon 400 `email`. Le mot de passe SHALL faire de 8 à 200 caractères, sinon 400 `password`.

#### Scenario: Adresse avec balise
- **WHEN** un appareil s'inscrit avec `<b>@example.com`
- **THEN** la réponse est 400 `email`

#### Scenario: Mot de passe trop court
- **WHEN** un appareil s'inscrit avec un mot de passe de 7 caractères
- **THEN** la réponse est 400 `password`

### Requirement: Limite de créations par réseau
Le serveur SHALL limiter à 5 créations de compte par heure et par adresse IP (en-tête `cf-connecting-ip`, `local` à défaut, 64 caractères au plus). Au-delà, il SHALL répondre 429 `slow` avec `retryAfter: 3600`. Le compteur SHALL être incrémenté à chaque demande valide (adresse et mot de passe au bon format), y compris quand l'adresse est déjà prise.

#### Scenario: Sixième création dans l'heure
- **WHEN** une même IP a déjà fait 5 demandes d'inscription valides dans l'heure
- **THEN** la sixième reçoit 429 avec `retryAfter: 3600`

### Requirement: Empreinte des mots de passe
Le serveur SHALL stocker chaque mot de passe sous la forme `<sel>$<empreinte>` où le sel est 16 octets aléatoires en hexadécimal (32 caractères, utilisés tels quels comme octets UTF-8) et l'empreinte est PBKDF2-HMAC-SHA-256, 100 000 itérations, 256 bits, en hexadécimal. Les empreintes existantes SHALL rester vérifiables sans migration.

#### Scenario: Compte créé par une version précédente du serveur
- **WHEN** un compte a été créé par une version antérieure du serveur puis l'utilisateur se connecte avec le bon mot de passe
- **THEN** la connexion réussit

### Requirement: Connexion
`POST /v1/login` avec `{email, password, device?}` SHALL ouvrir une session et répondre 200 `{token, user, device, email}`. Une adresse inconnue, un mauvais mot de passe ou un mot de passe de plus de 200 caractères SHALL donner 401 `login` (« Adresse ou mot de passe incorrect. »). Une adresse inconnue SHALL coûter le même calcul qu'un mauvais mot de passe (empreinte factice) ; la comparaison SHALL être en temps constant.

#### Scenario: Mauvais mot de passe
- **WHEN** un appareil envoie un mot de passe faux pour un compte existant
- **THEN** la réponse est 401 `login`

#### Scenario: Second appareil
- **WHEN** un deuxième appareil se connecte au même compte
- **THEN** il reçoit un identifiant d'appareil différent du premier

### Requirement: Limites d'essais de connexion
Le serveur SHALL bloquer une adresse e-mail après 10 échecs en 15 minutes et une IP après 30 échecs en 15 minutes, en répondant 429 `slow` avec `retryAfter: 900`, y compris pour le bon mot de passe. Une connexion réussie SHALL remettre à zéro le compteur de l'adresse. Une fenêtre écoulée (plus de 15 minutes depuis le premier échec) SHALL repartir à un.

#### Scenario: Onzième essai
- **WHEN** 10 mauvais mots de passe ont été envoyés pour une adresse dans le quart d'heure
- **THEN** l'essai suivant, même correct, reçoit 429

### Requirement: Jetons de session
À chaque inscription ou connexion, le serveur SHALL créer un jeton de 32 octets aléatoires (64 caractères hexadécimaux), rendu une seule fois, et SHALL n'en garder en base que l'empreinte SHA-256 en hexadécimal.

#### Scenario: Jeton stocké
- **WHEN** un appareil se connecte
- **THEN** la table `sessions` contient l'empreinte du jeton et jamais le jeton lui-même

### Requirement: Rattachement de l'appareil
Si `device.id` est fourni, valide (`[A-Za-z0-9_.-]{1,64}`) et appartient au compte, l'appareil SHALL être réutilisé et son nom, sa plateforme et `last` mis à jour. Sinon un nouvel appareil SHALL être créé (identifiant de 8 octets aléatoires en hexadécimal) avec un curseur égal au plus grand numéro d'évènement du compte.

#### Scenario: Nouvel appareil
- **WHEN** un appareil inconnu se connecte à un compte qui a déjà 12 évènements
- **THEN** son curseur vaut 12 et il ne reçoit que les évènements suivants

#### Scenario: Identifiant d'appareil d'un autre compte
- **WHEN** un appareil se connecte avec le `device.id` d'un appareil d'un autre compte
- **THEN** un nouvel appareil est créé

### Requirement: Nom et plateforme de l'appareil
Le nom d'appareil SHALL être nettoyé (caractères de contrôle et `<>"'\`` retirés, espaces aux extrémités retirés, 60 caractères, « Appareil » à défaut) et la plateforme aussi (20 caractères, `web` à défaut).

#### Scenario: Nom absent
- **WHEN** un appareil se connecte sans `device`
- **THEN** il s'appelle « Appareil » et sa plateforme est `web`

### Requirement: Déconnexion
`POST /v1/logout` SHALL supprimer la session du jeton utilisé et répondre `{ok:true}`.

#### Scenario: Jeton après déconnexion
- **WHEN** un appareil se déconnecte puis réutilise son jeton
- **THEN** il reçoit 401

### Requirement: Lecture du compte
`GET /v1/me` SHALL rendre `{user, email, name, avatar, device, devices}` où `name` vaut `""` et `avatar` `null` à défaut, `device` est l'appareil appelant et `devices` la liste `{id, name, platform, last}` des appareils du compte, du plus récemment actif au moins récent.

#### Scenario: Deux appareils
- **WHEN** un compte a deux appareils connectés
- **THEN** `devices` contient deux entrées

### Requirement: Profil
`PATCH /v1/me` (corps de 300 000 octets au plus) SHALL changer `name` et/ou `avatar`. Le nom SHALL être nettoyé (caractères de contrôle, `<` et `>` retirés, 60 caractères ; vide → `null`). La photo SHALL être `null` ou une data URL `data:image/(jpeg|png|webp);base64,...` de 280 000 caractères au plus, sinon 400 `avatar`. Un corps sans `name` ni `avatar` SHALL donner 400 `empty`.

#### Scenario: Balises dans le nom
- **WHEN** un appareil envoie `{name:"Draconix <b>"}`
- **THEN** le nom enregistré est `Draconix b`

#### Scenario: Photo SVG
- **WHEN** un appareil envoie une photo `data:image/svg+xml;base64,...`
- **THEN** la réponse est 400 `avatar`

### Requirement: Retrait d'un appareil
`DELETE /v1/devices/<id>` SHALL supprimer d'un seul coup l'appareil et ses sessions s'il appartient au compte, puis lancer en arrière-plan le ménage du transit du compte. Un appareil inconnu ou d'un autre compte SHALL donner 404 `device`.

#### Scenario: Appareil retiré
- **WHEN** un appareil retire un autre appareil du même compte
- **THEN** le jeton de l'appareil retiré ne fonctionne plus et il ne retient plus de fichiers en transit
