# sync-http Specification

## Purpose
Socle commun de l'API de synchronisation `/v1` : format des réponses, en-têtes de sûreté, CORS, lecture des corps JSON, authentification par jeton et traitement des erreurs. Toutes les autres capacités `sync-*` s'appuient sur ce socle.

## Requirements

### Requirement: Réponses JSON sûres
Le serveur SHALL rendre chaque réponse JSON avec `content-type: application/json; charset=utf-8`, les en-têtes CORS (`access-control-allow-origin: *`, méthodes `GET,POST,PUT,PATCH,DELETE,OPTIONS`, en-têtes `authorization,content-type`, `access-control-max-age: 86400`) et les en-têtes de sûreté `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `content-security-policy: default-src 'none'; sandbox` et `cache-control: no-store`.

#### Scenario: Réponse ordinaire
- **WHEN** un appareil appelle `GET /v1/me` avec un jeton valide
- **THEN** la réponse porte les en-têtes CORS et de sûreté ci-dessus et un corps JSON

### Requirement: Pré-vol CORS
Le serveur SHALL répondre à toute requête `OPTIONS`, quelle que soit l'adresse, par un statut 204 sans corps, avec les en-têtes CORS.

#### Scenario: Pré-vol d'un navigateur
- **WHEN** un navigateur envoie `OPTIONS /v1/events`
- **THEN** le serveur répond 204 avec les en-têtes CORS, sans demander de jeton

### Requirement: Adresse de santé
Le serveur SHALL répondre `{"ok":true,"service":"prism-sync"}` (statut 200) sur `/` et `/v1`, quelle que soit la méthode autre que `OPTIONS`, sans jeton.

#### Scenario: Vérification de santé
- **WHEN** on appelle `GET /v1` sans jeton
- **THEN** la réponse est 200 avec `{"ok":true,"service":"prism-sync"}`

### Requirement: Format des erreurs
Toute erreur SHALL être rendue en JSON sous la forme `{"error": <code>, "message": <texte en français>, ...extra}` avec le statut HTTP correspondant. Une erreur inattendue SHALL donner le statut 500, le code `server` et le message « Erreur du serveur. » sans détail interne.

#### Scenario: Erreur interne
- **WHEN** une erreur imprévue survient pendant le traitement d'une requête
- **THEN** la réponse est 500 `{"error":"server","message":"Erreur du serveur."}`

#### Scenario: Erreur avec délai
- **WHEN** une limite de débit est atteinte
- **THEN** la réponse est 429 avec `error`, `message` et `retryAfter` (en secondes) dans le corps

### Requirement: Lecture bornée des corps JSON
Le serveur SHALL lire les corps JSON par morceaux et refuser par 413 (message « trop gros ») un corps dont la taille annoncée ou la taille effectivement reçue dépasse la limite de la route (4 Mio par défaut), sans attendre la fin du corps. Un corps vide SHALL valoir `{}`. Un corps qui n'est pas du JSON valide SHALL être refusé par 400 (message « JSON invalide »).

#### Scenario: Corps sans taille annoncée trop gros
- **WHEN** un appareil envoie sans `content-length` un corps de 5 Mio à `POST /v1/events`
- **THEN** le serveur arrête la lecture dès 4 Mio dépassés et répond 413

#### Scenario: JSON invalide
- **WHEN** un appareil envoie `{oups` à `POST /v1/login`
- **THEN** le serveur répond 400

### Requirement: Authentification par jeton
Hors `/`, `/v1`, `OPTIONS`, `POST /v1/signup` et `POST /v1/login`, chaque requête SHALL porter un jeton dans `authorization: Bearer <jeton>` ; le paramètre `token` de l'adresse SHALL être accepté uniquement pour `/v1/live`. Un jeton absent, inconnu ou de plus de 128 caractères SHALL donner 401 `auth` (« Connecte-toi à ton compte Prism. »). La session SHALL être retrouvée par l'empreinte SHA-256 du jeton. `last` de l'appareil SHALL être mis à jour au plus une fois par minute.

#### Scenario: Jeton inconnu
- **WHEN** un appareil appelle `GET /v1/me` avec `authorization: Bearer faux`
- **THEN** la réponse est 401 avec le code `auth`

#### Scenario: Jeton dans l'adresse hors WebSocket
- **WHEN** un appareil appelle `GET /v1/me?token=<jeton valide>` sans en-tête `authorization`
- **THEN** la réponse est 401

#### Scenario: Adresse inconnue sans jeton
- **WHEN** on appelle `GET /v1/inexistant` sans jeton
- **THEN** la réponse est 401 (l'authentification est vérifiée avant la recherche de route)

#### Scenario: Dernière activité pendant une synchro
- **WHEN** un appareil fait 30 requêtes en 20 secondes et que son `last` date de moins d'une minute
- **THEN** `last` n'est pas réécrit (aucune écriture D1 pour cela)

#### Scenario: Dernière activité après une pause
- **WHEN** un appareil fait une requête alors que son `last` date de plus d'une minute
- **THEN** `last` prend l'heure de cette requête

### Requirement: Adresse inconnue
Une requête authentifiée vers une route ou une méthode inconnue SHALL recevoir 404 `route` (« Adresse inconnue. »).

#### Scenario: Méthode non prise en charge
- **WHEN** un appareil authentifié envoie `DELETE /v1/blobs/abc`
- **THEN** la réponse est 404 avec le code `route`
