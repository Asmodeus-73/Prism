# Tasks

Plan de migration en 10 étapes. Chaque étape finit par les tests de contrat au vert et `cargo clippy -- -D warnings` propre. Rien n'est déployé : `server.yml` n'est pas lancé.

## 1. Prototype et vérification des points risqués (go / no-go)

- [x] 1.1 Ajouter `server/Cargo.toml` (crate `cdylib` `prism-sync`, `worker` et `worker-build` épinglés), `server/rust-toolchain.toml` (stable épinglé + cible `wasm32-unknown-unknown`) et le profil release (`opt-level = "z"`, `lto`, `codegen-units = 1`)
- [x] 1.2 Écrire un Worker minimal (`GET /v1` santé) et vérifier que Miniflare charge `build/index.js` + `.wasm`
- [x] 1.3 Prototyper chacun des points de R3 : `batch` D1, `INSERT … RETURNING seq` via `first`, `FixedLengthStream` + `Bucket::put` en flux, Durable Object avec hibernation et attachements, transfert de la requête d'upgrade au Durable Object, `wait_until`, cron
- [x] 1.4 Mesurer : temps CPU d'un PBKDF2 WebCrypto appelé depuis Rust, d'un JSON de 4 Mio lu et réécrit, taille du `.wasm` compressé
- [x] 1.5 Écrire le résultat (ce qui marche, contournements, mesures) dans `design.md` et faire le point avec Draconix avant de continuer

## 2. Banc de tests en double exécution

- [ ] 2.1 Faire lire `PRISM_SYNC_SCRIPT` (défaut `server/src/index.js`) à `server/test.mjs`, `tests/sync.mjs`, `tests/collab.mjs` et `tests/security.mjs`, avec les `modulesRules` WASM quand le chemin vise la sortie Rust
- [ ] 2.2 Ajouter un script `server/run-contract.sh` qui lance les quatre tests contre les deux versions
- [ ] 2.3 Écrire la table des particularités à reproduire (coercitions `String()`/`+x || 0`, longueurs UTF-16, ordre des vérifications, compteurs incrémentés avant validation, ordre des clés et format des nombres dans `body`, insertion du rôle `owner` avant le test `nouser`) dans `server/PARITE.md`, avec un test de contrat pour chaque ligne non couverte

## 3. Socle HTTP (spec sync-http)

- [ ] 3.1 `http.rs` : `json()`, `ApiError`/`fail()`, en-têtes CORS et SAFE, réponse `OPTIONS` 204, santé `/` et `/v1`
- [ ] 3.2 Lecture bornée et en flux des corps JSON (413 dès la limite dépassée, 400 JSON invalide, vide → `{}`)
- [ ] 3.3 `js.rs` et `validate.rs` (D6, D7) avec tests unitaires natifs reprenant les cas de la version JavaScript
- [ ] 3.4 `lib.rs` : routeur à la main dans l'ordre exact de `route()` ; erreurs imprévues → 500 `server`

## 4. Comptes et sessions (spec sync-accounts)

- [ ] 4.1 `crypto.rs` : SHA-256, PBKDF2 et aléa via WebCrypto ; comparaison en temps constant ; test natif d'égalité d'empreinte avec une valeur produite par le serveur JavaScript
- [ ] 4.2 `auth.rs` : jeton Bearer / `token` réservé à `/v1/live`, mise à jour de `last`, création ou réutilisation d'appareil, limites d'essais (adresse et IP)
- [ ] 4.3 `accounts.rs` : `signup`, `login` (empreinte factice), `logout`, `GET`/`PATCH /v1/me`, `DELETE /v1/devices/<id>`
- [ ] 4.4 Vérifier qu'un compte créé par le serveur JavaScript se connecte sur le serveur Rust (même base D1 Miniflare)

## 5. Transit R2 (spec sync-transit)

- [ ] 5.1 `PUT /v1/blobs/<nom>` : taille obligatoire, 500 Mio, `already`, quotas global et par compte, `FixedLengthStream`, contrôle par `head`, types autorisés
- [ ] 5.2 `GET /v1/blobs/<nom>` avec `from` (recherche exacte par `instr`), en-têtes de fichier
- [ ] 5.3 `GET /v1/usage` et `sweep_user` (effacement après réception, comptes d'origine compris)

## 6. Journal d'évènements (spec sync-events)

- [ ] 6.1 `POST /v1/events` : débit 1 200/min, validation, `body` ≤ 4 Mio, notification du compte
- [ ] 6.2 Recopie vers les membres d'un partage, refus 423 si verrou d'un autre, départ d'un invité, suppression par la propriétaire
- [ ] 6.3 `GET /v1/events?after=` (200 au plus, `more`) et `POST /v1/ack` (curseur monotone, ménage en arrière-plan)

## 7. Partage et verrous (spec sync-sharing)

- [ ] 7.1 `GET /v1/shares` et `POST /v1/shares` (vérifications dans l'ordre de la spec, évènement `want`, notifications)
- [ ] 7.2 `DELETE /v1/shares/<pid>/<compte>`
- [ ] 7.3 `POST`/`DELETE /v1/locks/<pid>` (10 minutes, 409, annonces)

## 8. Canal en direct et ménage (specs sync-live, sync-maintenance)

- [ ] 8.1 `live.rs` : Durable Object `Live` (hibernation, remplacement code 4000, `peers`, `/notify`, relais `signal` ≤ 65 536, `ping`/`pong`, départ)
- [ ] 8.2 `notify()` côté Worker, sans erreur quand personne n'est connecté
- [ ] 8.3 `maintenance.rs` : `sweep_all` sur le cron `17 * * * *` et réglages par variables d'environnement

## 8 bis. Moins d'allers-retours (D13)

- [ ] 8b.1 Ménage du transit et ménage horaire : `delete_multiple` R2 et `DELETE … IN` en `batch`, curseurs en une requête `GROUP BY`
- [ ] 8b.2 Dépôt : place globale, place du compte et « déjà là » en une requête
- [ ] 8b.3 Liste des partages en deux requêtes ; copies d'évènement en un `batch`
- [ ] 8b.4 Compteurs de débit en un `INSERT … ON CONFLICT … RETURNING`
- [ ] 8b.5 Compter les requêtes D1/R2 par route avant et après (test de contrat qui journalise les appels) et noter le résultat dans `design.md`
- [x] 8b.6 `last` mis à jour au plus une fois par minute (accord de Draconix le 2026-11-07, fait dans le serveur JavaScript ; à reprendre dans `auth.rs`)

## 9. CI et outillage

- [ ] 9.1 `tests.yml`, job `server` : installer Rust (toolchain épinglée) et `worker-build`, `cargo clippy --target wasm32-unknown-unknown -- -D warnings`, `cargo test` natif, puis les tests de contrat contre les deux versions
- [ ] 9.2 Job `web` : tests de synchronisation contre la version Rust
- [ ] 9.3 `server.yml` : étape de compilation avant `wrangler deploy` (sans le lancer)
- [ ] 9.4 Relecture de sécurité de la version Rust (même grille que `tests/security.mjs` + relecture des points D7)

## 10. Bascule

- [ ] 10.1 `wrangler.toml` : `main = "build/index.js"` et `[build] command = "worker-build --release"`
- [ ] 10.2 Supprimer `server/src/index.js` ; `PRISM_SYNC_SCRIPT` vise désormais la sortie Rust par défaut ; retirer la double exécution de la CI
- [ ] 10.3 Mettre à jour les commentaires de `server/` et le README (compilation locale, tests)
- [ ] 10.4 Archiver le changement OpenSpec (`openspec archive reecrire-serveur-sync-en-rust`) une fois la PR acceptée par Draconix
