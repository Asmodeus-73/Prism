# sync-live Specification

## Purpose
Canal en direct par compte (WebSocket servie par un Durable Object `Live`) : présence des appareils allumés, annonce immédiate des nouveaux évènements et relais des messages de signalisation WebRTC pour que les fichiers passent directement d'un appareil à l'autre.

## Requirements

### Requirement: Ouverture du canal
`GET /v1/live` avec `upgrade: websocket` et un jeton valide (en-tête ou paramètre `token`) SHALL ouvrir une WebSocket rattachée au Durable Object `Live` nommé par l'identifiant du compte. La socket SHALL porter l'appareil et son nom, conservés pendant l'hibernation. Une ancienne socket du même appareil SHALL être fermée avec le code 4000 (« remplacé »). Sans `upgrade: websocket`, la route SHALL répondre 404 `route`.

#### Scenario: Deux appareils allumés
- **WHEN** le Mac puis la tour ouvrent le canal
- **THEN** chaque socket reçoit `{type:"peers", devices:[{device, name}, ...]}` avec les appareils connectés

#### Scenario: Reconnexion du même appareil
- **WHEN** le Mac ouvre une seconde socket
- **THEN** la première est fermée avec le code 4000

### Requirement: Annonces aux appareils connectés
Le Durable Object SHALL diffuser tout message reçu du serveur sur son adresse interne `/notify` à toutes les sockets du compte. Un compte sans appareil connecté SHALL ne provoquer aucune erreur chez l'appelant.

#### Scenario: Changement en direct
- **WHEN** la tour envoie un évènement
- **THEN** le Mac connecté reçoit `{type:"event", ...}`

### Requirement: Relais WebRTC
Un message `{type:"signal", to:<appareil>, data}` de 65 536 caractères au plus, destiné à un autre appareil que l'émetteur, SHALL être relayé uniquement aux sockets de cet appareil sous la forme `{type:"signal", from:<émetteur>, data}`. Un message `{type:"ping"}` SHALL recevoir `{"type":"pong"}`. Tout autre message, ou un message qui n'est pas du JSON, SHALL être ignoré.

#### Scenario: Offre WebRTC
- **WHEN** le Mac envoie `{type:"signal", to:<tour>, data:{sdp:"offre"}}`
- **THEN** la tour reçoit `{type:"signal", from:<Mac>, data:{sdp:"offre"}}`

### Requirement: Départ d'un appareil
À la fermeture ou en cas d'erreur d'une socket, les autres sockets du compte SHALL recevoir la liste `peers` mise à jour, sans l'appareil parti.

#### Scenario: La tour s'éteint
- **WHEN** la socket de la tour se ferme
- **THEN** le Mac reçoit `peers` sans la tour
