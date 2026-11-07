## MODIFIED Requirements

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
