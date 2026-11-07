# Design

## Context

- `server/src/index.js` : un seul module ES (Worker « modules ») avec un routeur à la main (`route()`), le cron `scheduled` et la classe Durable Object `Live` (API d'hibernation des WebSockets).
- Liaisons (`server/wrangler.toml`) : D1 `DB`, R2 `TRANSIT`, Durable Object `LIVE` → classe `Live` (migration `v1`, `new_sqlite_classes`), cron `17 * * * *`, variables `TRANSIT_LIMIT`, `USER_LIMIT`, `TRANSIT_HOURS`, `EVENTS_DAYS`.
- APIs de la plateforme utilisées : `crypto.subtle` (PBKDF2, SHA-256), `crypto.getRandomValues`, `FixedLengthStream`, `ctx.waitUntil`, `WebSocketPair`, `state.acceptWebSocket` / `getWebSockets`, `serializeAttachment` / `deserializeAttachment`.
- Tests : `server/test.mjs` (environ 45 vérifications, Miniflare seul) ; `tests/sync.mjs`, `tests/collab.mjs`, `tests/security.mjs` (Miniflare + éditeur web dans Playwright). Tous chargent `server/src/index.js` par `scriptPath`.
- Rien n'est déployé : le workflow `server.yml` n'a jamais tourné (secrets Cloudflare absents).

## Goals / Non-Goals

**Goals:**
- Un Worker Rust qui passe **tels quels** les quatre fichiers de tests de contrat.
- Mêmes routes, statuts, codes et messages d'erreur, en-têtes, schéma D1, clés R2, nom de classe Durable Object.
- Code Rust lisible, découpé par capacité, avec des tests unitaires natifs (`cargo test`) pour la logique pure, et `clippy -D warnings` en CI.
- Rester dans l'offre gratuite Cloudflare (CPU, taille du module).

**Non-Goals:**
- Changer l'API, le protocole de synchronisation ou le schéma (toute évolution passera par un changement OpenSpec séparé, après la réécriture).
- Déployer le serveur. Le déploiement reste en pause ; il se fera avec le reste du cloud, avec l'accord de Draconix.
- Quitter Cloudflare (serveur Rust natif avec axum, Postgres, S3…).
- Partager du code entre `server/` et `src-tauri/` (cibles et dépendances trop différentes ; à revoir plus tard si un vrai besoin apparaît).

## Decisions

### D1. workers-rs plutôt qu'un serveur Rust natif
Le crate `worker` compile en `wasm32-unknown-unknown` et expose D1, R2, Durable Objects (y compris l'hibernation des WebSockets), cron et `wait_until`. On garde l'hébergement, le coût (gratuit), `wrangler.toml` et le workflow de déploiement.
*Alternatives écartées* : axum + SQLite/Postgres + stockage S3 sur un serveur (il faut un serveur à payer et à maintenir, perte des Durable Objects) ; Spin/Fermyon (autre hébergeur, pas de D1/R2).

### D2. Contrat inchangé, tests JavaScript comme juge de paix
Les tests existants testent de l'extérieur (HTTP et WebSocket via Miniflare) : ils ne dépendent pas du langage du serveur. Ils lisent `PRISM_SYNC_SCRIPT` (défaut : `server/src/index.js`) ; la CI les fait tourner **deux fois** pendant la transition, contre le JavaScript et contre `server/build/index.js`. La bascule n'a lieu que quand les deux passent.
Miniflare charge la sortie de `worker-build` (module ES + `.wasm`) avec `modulesRules: [{ type: 'CompiledWasm', include: ['**/*.wasm'] }]` ; à vérifier dès l'étape 1 (voir R3).

### D3. WebCrypto plutôt que des crates de cryptographie en WASM
PBKDF2 (100 000 itérations), SHA-256 et l'aléa passent par `crypto.subtle` et `crypto.getRandomValues` de la plateforme, appelés depuis Rust via `js-sys`/`web-sys` (`SubtleCrypto`, `Crypto`).
*Pourquoi* : le calcul se fait en natif hors du module WASM ; le crate `pbkdf2` compilé en WASM ferait 100 000 tours de SHA-256 dans l'interpréteur WASM, ce qui risque de dépasser les 10 ms de CPU de l'offre gratuite à chaque connexion. Les empreintes restent identiques au bit près (même algorithme, sel utilisé comme octets UTF-8 de sa forme hexadécimale). Les crates `pbkdf2`/`sha2` ne servent qu'en `dev-dependencies` pour vérifier en `cargo test` natif qu'on produit les mêmes empreintes que le JavaScript.
La comparaison en temps constant reste une petite fonction Rust (ou `subtle::ConstantTimeEq`).

### D4. Routeur à la main, pas `worker::Router`
L'ordre des vérifications fait partie du contrat : `OPTIONS` → santé → `signup`/`login` → authentification → routes → 404 (une adresse inconnue sans jeton donne 401, pas 404). Un `match` sur `(méthode, segments de l'adresse)` reproduit cet ordre exactement et reste lisible. `worker::Router` imposerait sa propre réponse 404/405.

### D5. Erreurs typées
```rust
pub struct ApiError { status: u16, code: &'static str, message: Cow<'static, str>, extra: Option<serde_json::Value> }
```
Chaque route renvoie `Result<Response, ApiError>`. `From<worker::Error>` et les erreurs D1/R2 imprévues deviennent `500 server « Erreur du serveur. »` ; les erreurs de lecture de corps (413, 400) gardent leur message, comme aujourd'hui.

### D6. Pas de crate `regex`
Les sept expressions régulières du serveur (`KEY_RE`, `PID_RE`, `EMAIL_RE`, `BLOB_TYPES`, la data URL de l'avatar, les deux nettoyages de noms) sont simples : elles deviennent des fonctions écrites à la main dans `validate.rs`, testées une à une contre les mêmes exemples que la version JavaScript (table de cas partagée). On évite ~300 à 500 Ko de WASM et un temps de démarrage plus long.

### D7. Coercitions JavaScript reproduites volontairement
Le serveur JavaScript accepte des valeurs « à la JavaScript » ; les appareils actuels n'en dépendent pas, mais la parité l'exige et les tests de sécurité en envoient. Un module `js.rs` fournit :
- `js_string(&Value)` = `String(v ?? '')` / `String(v || '')` selon l'appel (nombres, booléens, `null`) ;
- `js_number(&Value)` = `+v || 0` (chaînes numériques, booléens, `NaN` → 0), puis `max(0, …)` ;
- longueur des chaînes en **unités UTF-16** (`.length` JavaScript) pour les limites de 60, 64, 128, 200, 280 000 caractères et 65 536 pour les signaux WebRTC ;
- `JSON.stringify(b.body)` : le corps est restitué tel qu'il a été reçu (via `serde_json::Value`, en gardant l'ordre des clés avec la fonctionnalité `preserve_order`).
La liste des particularités à reproduire est tenue dans le tableau de la tâche 2.3.

### D8. Découpage du crate
```
server/
  Cargo.toml, rust-toolchain.toml, wrangler.toml, schema.sql, package.json (Miniflare)
  src/
    lib.rs          #[event(fetch)], #[event(scheduled)], ordre des routes
    http.rs         json(), fail(), CORS, SAFE, lecture bornée des corps
    js.rs           coercitions JavaScript (D7)
    validate.rs     noms, adresses, types, data URL, nettoyage (D6)
    crypto.rs       WebCrypto : sha256_hex, pbkdf2, aléa, comparaison (D3)
    db.rs           lignes D1 typées (serde), petites aides prepare/bind
    auth.rs         jetons, sessions, appareils, limites d'essais
    accounts.rs     signup, login, logout, me, profil, appareils
    transit.rs      PUT/GET blobs, usage, sweep_user
    events.rs       POST/GET events, ack
    shares.rs       partages et verrous
    live.rs         #[durable_object] Live + notify()
    maintenance.rs  sweep_all (cron)
```
Chaque module correspond à une spec `sync-*`, ce qui permet de cocher la parité capacité par capacité.

### D9. Dépôt R2 à taille fixe
`PUT /v1/blobs` passe le corps à R2 en flux, à travers un `FixedLengthStream` de la taille annoncée (R2 exige une taille connue pour un flux, et cela empêche de tricher sur le quota), puis relit la taille avec `head`. workers-rs expose `FixedLengthStream` ; s'il ne convient pas à `Bucket::put`, on construit le `FixedLengthStream` JavaScript par `js-sys` et on passe son `readable` à R2 (même comportement qu'aujourd'hui).

### D10. Durable Object `Live` avec hibernation
`#[durable_object] pub struct Live` avec `state.accept_web_socket`, `state.get_websockets`, `ws.serialize_attachment`/`deserialize_attachment` (struct `Peer { device, name }`) et les méthodes `websocket_message`, `websocket_close`, `websocket_error`. Le nom de classe `Live` et la migration `v1` ne changent pas (une base Durable Object existante resterait valide).

### D11. Chaîne de compilation épinglée
`rust-toolchain.toml` (canal stable épinglé, cible `wasm32-unknown-unknown`), `worker` et `worker-build` à des versions fixes (une version récente vérifiée lors de l'étape 1, pas « latest »), `Cargo.lock` versionné. `wrangler.toml` : `main = "build/index.js"` et `[build] command = "worker-build --release"`. Profil release : `opt-level = "z"`, `lto = true`, `codegen-units = 1`, puis `wasm-opt` (fait par `worker-build`).

### D12. Transition dans `server/`, bascule en une fois
Le Rust est écrit à côté de `src/index.js` sur la branche. `wrangler.toml` ne pointe vers le Rust qu'à la dernière étape, et `src/index.js` est supprimé dans la même PR. Comme rien n'est déployé, il n'y a pas de cohabitation en production à gérer.

### D13. Moins d'allers-retours vers D1 et R2 (même comportement)
Le serveur passe son temps à attendre D1 et R2, et le JavaScript actuel enchaîne ses requêtes une par une. La réécriture les regroupe, sans changer ce que voient les appareils :
- **Ménage du transit** (`sweepUser`, à chaque accusé de réception) : aujourd'hui une requête `MIN(cursor)` par compte, puis, pour chaque fichier effacé, un `delete` R2 et un `DELETE` D1. Une photo, c'est des dizaines ou des centaines de tuiles : on passe à un seul `delete_multiple` R2 (1 000 clés au plus par appel) et un seul `DELETE … WHERE key IN (…)` en `batch`, et les curseurs de tous les comptes en une requête `GROUP BY`.
- **Ménage horaire** (`sweepAll`) : même chose, un `delete_multiple` et un `DELETE … WHERE created < ?` au lieu de deux appels par fichier. Avec des centaines de fichiers expirés, l'enchaînement actuel risque de dépasser la limite de sous-requêtes par invocation et de laisser le ménage à moitié fait.
- **Dépôt d'un fichier** : la place occupée est lue deux fois (`used()` global appelé deux fois, puis celle du compte) en plus du test « déjà là » : une seule requête rend les trois valeurs.
- **Liste des partages** : deux requêtes par photo partagée (membres, verrou) ; on passe à deux requêtes en tout (jointure sur les photos du compte).
- **Photo partagée** : la copie de l'évènement chez chaque membre devient un seul `batch` d'`INSERT … RETURNING seq`.
- **Compteurs de débit** (évènements, invitations, inscriptions) : `SELECT` puis `UPDATE` deviennent un seul `INSERT … ON CONFLICT … DO UPDATE … RETURNING n`.
- **Accusé de réception** : le ménage des comptes d'origine se fait en parallèle plutôt qu'à la suite.

- **Dernière activité** (`last`) : réécrite au plus une fois par minute au lieu d'à chaque requête, ce qui enlève une écriture D1 sur presque tous les appels pendant une synchro. C'est le seul changement visible (« vu il y a … » peut retarder d'une minute) ; accepté par Draconix le 2026-11-07, spec `sync-http` modifiée, et fait aussi dans le serveur JavaScript.

## Résultats du prototype (étape 1, 2026-11-06)

Prototype dans `server/proto/` (`worker` 0.8.7, `worker-build` 0.8.7, Rust 1.97.0) ; `node server/proto/test.mjs` le vérifie dans Miniflare et le compare à la même chose écrite en JavaScript. **17 vérifications sur 17 passent : go.**

| Point (R3) | Résultat |
|---|---|
| Miniflare charge la sortie de `worker-build` | Oui, `build/index.js` + `index_bg.wasm` avec `modulesRules` `CompiledWasm` (`build/worker/shim.mjs` n'est plus qu'un renvoi). |
| PBKDF2 et SHA-256 via WebCrypto depuis Rust | Oui, empreintes identiques au bit près à celles du serveur JavaScript (et de Node). |
| D1 : `batch`, `INSERT … RETURNING`, `first(colonne)` | Oui. |
| `wait_until` (tâche après la réponse) | Oui. |
| R2 : flux à taille fixe | Oui, deux façons : `FixedLengthStream` de workers-rs (les octets traversent le WASM) ou le `FixedLengthStream` natif construit par `js-sys` (les octets ne touchent pas le WASM). Un corps trop court est refusé et rien ne reste dans R2. **Retenu : le natif.** |
| Durable Object avec hibernation | Oui : attachements, liste des appareils, remplacement (code 4000), relais WebRTC, `ping`/`pong`, `/notify`, départ. |
| Requête d'upgrade transmise au Durable Object | Oui (`Request::new_with_init` avec les en-têtes d'origine). |
| Cron | Oui (`#[event(scheduled)]`). |

Mesures (temps par requête dans Miniflare, aller-retour local compris, à comparer entre elles seulement) :

| Opération | Rust | JavaScript |
|---|---|---|
| Connexion (PBKDF2 100 000 tours) | 28 à 34 ms | 26 à 29 ms |
| Manifeste JSON de 1,3 Mio, décodé puis réécrit (`serde_json::Value`) | 94 à 132 ms | 48 à 78 ms |
| Même manifeste, `body` gardé tel quel (`RawValue`, texte lu en natif) | 49 ms | — |
| Dépôt R2 de 50 Mo, flux natif | 2,2 s (stable) | — |
| Dépôt R2 de 50 Mo, flux via le WASM | 2,0 à 4,1 s (instable) | — |

Taille du module : 552 Ko de WASM, **190 Ko compressé** (limite gratuite : 3 Mo).

Conséquences pour la suite :
- **D7 précisé** : `body` d'un évènement n'est jamais décodé en arbre ; il est gardé tel quel (`RawValue`). C'est ce qui ramène le Rust au niveau du JavaScript. Pour un JSON compact (ce qu'envoient les appareils, via `JSON.stringify`), le résultat est identique octet pour octet, vérifié par le prototype.
- **D9 tranché** : dépôt R2 par le `FixedLengthStream` natif.
- **D11 corrigé** : `main = "build/index.js"`.
- **R1 revu** : PBKDF2 coûte autant en Rust qu'en JavaScript (c'est WebCrypto qui calcule dans les deux cas). Le risque de dépasser les 10 ms de CPU de l'offre gratuite à la connexion existe donc **déjà** avec le serveur actuel ; il sera à mesurer au premier vrai déploiement, quel que soit le langage.
- Le Rust ne rend aucune opération plus rapide que le JavaScript ; le gain de vitesse viendra de D13.

## Résultat de la réécriture (2026-11-07)

- `server/src/*.rs` (environ 1 760 lignes avec les tests, découpage D8 sauf `maintenance.rs`, dont le contenu est dans `transit.rs`) remplace `server/src/index.js`, supprimé ; le prototype `server/proto/` est retiré.
- Module : 881 Ko de WASM, **306 Ko compressé** (limite gratuite : 3 Mo).
- Tests : `server/test.mjs` (47 vérifications), `tests/sync.mjs`, `tests/collab.mjs`, `tests/security.mjs` (50 attaques) passent contre le Rust ; `cargo test --lib` (9 tests des validations, coercions et de l'empreinte PBKDF2) ; `cargo clippy -D warnings` propre.
- Parité : `server/parite.mjs` envoie 93 requêtes, dont des requêtes bizarres, à l'ancien serveur JavaScript et au Rust : aucune différence. Un compte créé par le serveur JavaScript (jeton et mot de passe) fonctionne sur le Rust.
- Particularités reproduites, écarts acceptés et nombre de requêtes D1/R2 par route avant et après : `server/README.md`.

## Risks / Trade-offs

- **R1. Temps CPU (offre gratuite : 10 ms par requête).** PBKDF2 via WebCrypto est à 100 000 itérations, la limite maximale acceptée par Workers ; le coût réel par connexion doit être mesuré (`wrangler dev` + `--log-level debug`, ou métriques après un futur déploiement). Lire et réécrire des manifestes JSON de 4 Mio en WASM coûte aussi du CPU. → Mesure dès l'étape 1 sur `login` et sur un `POST /v1/events` de 4 Mio ; si ça dépasse, garder `body` comme texte brut (`RawValue`) sans le décoder.
- **R2. Démarrage à froid et taille du module.** Module WASM attendu entre 300 Ko et 1 Mo compressé (limite gratuite : 3 Mo). → Pas de `regex`, `opt-level = "z"`, `wasm-opt` ; mesurer à chaque étape (`ls -l build/worker/*.wasm`, gzip).
- **R3. Manques de workers-rs.** Points à vérifier en tout premier (étape 1, prototype) : `D1Database::batch`, `RETURNING seq` via `first`, `FixedLengthStream` + `Bucket::put`, attachements d'hibernation, `Request` transmise telle quelle au Durable Object pour l'upgrade WebSocket, chargement de la sortie `worker-build` par Miniflare. Repli : appels `js-sys` directs sur les objets de la plateforme pour le point manquant.
- **R4. Écarts de comportement subtils** (ordre des vérifications, compteurs incrémentés avant validation, coercitions JavaScript, longueurs UTF-16, ordre des clés JSON). → Tests de contrat en double exécution (D2), table des particularités (tâche 2.3), relecture route par route contre `index.js`.
- **R5. Entretien.** Deux langages pendant la transition, puis un serveur Rust à faire évoluer : chaque petite évolution de l'API demandera une recompilation et un `clippy` propre. C'est le prix des types.
- **R6. Rapport coût/bénéfice.** ~420 lignes de JavaScript deviendront environ 1 500 à 2 000 lignes de Rust, pour un serveur limité par les entrées/sorties : le gain est la sûreté et l'homogénéité, pas la vitesse. Si l'étape 1 montre un blocage sérieux (R1 ou R3), on s'arrête là et on en reparle avec Draconix plutôt que d'empiler des contournements.
