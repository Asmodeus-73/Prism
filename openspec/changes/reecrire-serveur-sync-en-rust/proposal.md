# Proposal

## Why

Le serveur de synchronisation (`server/src/index.js`, ~420 lignes) est écrit en JavaScript sans types, alors que le reste du code « système » de Prism (l'application de bureau, `src-tauri/`) est en Rust. Draconix a demandé de réécrire ce backend en Rust (la demande parle de TypeScript, mais le serveur actuel est en JavaScript pur : il n'y a pas de TypeScript dans `server/`).

Ce qu'on y gagne :
- des types sur tout ce qui entre et sort (corps JSON, lignes D1, messages WebSocket), donc moins d'erreurs silencieuses du genre `undefined` dans une requête SQL ;
- les validations (adresses, noms de fichiers, data URL, nettoyage des noms) deviennent de petites fonctions pures testables avec `cargo test`, sans Miniflare ;
- un seul langage pour tout le code hors éditeur web, avec `clippy -D warnings` comme pour `src-tauri`.

Pourquoi maintenant : le serveur n'a encore jamais été déployé (déploiement en pause, « on s'occupera du cloud à la fin »). Il n'y a donc ni utilisateurs ni données en production à préserver, et c'est le moment le moins risqué pour changer de langage.

Ce qu'on n'y gagne pas : de la vitesse. Le serveur passe son temps à attendre D1 et R2 ; le Rust compilé en WebAssembly ne rendra pas la synchronisation plus rapide, et ajoute un temps de démarrage à froid (chargement du module WASM).

## What Changes

- Le Worker `prism-sync` est réécrit en Rust avec le crate `worker` (workers-rs), compilé en WebAssembly par `worker-build`, et reste sur Cloudflare Workers avec les mêmes liaisons : D1 `DB`, R2 `TRANSIT`, Durable Object `Live`, cron horaire.
- L'API `/v1`, les codes et messages d'erreur, le schéma D1 (`server/schema.sql`) et le rangement R2 restent **identiques** : aucun changement côté éditeur web (`web-src/app/js/1060-synchro.js`, `1065-compte-essai-et-profil.js`, `1100-partage.js`) ni côté application de bureau.
- Les tests actuels (`server/test.mjs`, `tests/sync.mjs`, `tests/collab.mjs`, `tests/security.mjs`) deviennent les tests de contrat : ils tournent contre la version Rust (et contre la version JavaScript tant qu'elle existe).
- La CI (`tests.yml`) compile le serveur Rust et passe `clippy` ; `server.yml` (déploiement, lancé à la main) compile le Rust avant `wrangler deploy`. **Il n'est pas lancé** dans le cadre de ce changement.
- `server/src/index.js` est supprimé à la fin, une fois la parité prouvée (il reste dans l'historique git).

## Capabilities

### New Capabilities
Aucune.

### Modified Capabilities
Aucune : c'est une réécriture à comportement identique. Les exigences de `sync-http`, `sync-accounts`, `sync-transit`, `sync-events`, `sync-sharing`, `sync-live` et `sync-maintenance` (écrites à partir du serveur JavaScript actuel) sont le contrat à respecter. D'où `skip_specs: true` dans `.openspec.yaml`.

## Impact

- **Code** : `server/` (nouveaux `Cargo.toml`, `rust-toolchain.toml`, `src/*.rs` ; `wrangler.toml` avec une étape `[build]` ; `package.json` garde Miniflare pour les tests). `src/index.js` supprimé à la fin.
- **Tests** : `server/test.mjs` et `tests/{sync,collab,security}.mjs` lisent le chemin du Worker dans une variable `PRISM_SYNC_SCRIPT` (le JavaScript par défaut pendant la transition).
- **CI** : `.github/workflows/tests.yml` (job `server` : Rust + `worker-build` + clippy + tests) ; `.github/workflows/server.yml` (compilation avant publication).
- **Dépendances** : `worker` (workers-rs), `serde`, `serde_json`, `wasm-bindgen`, `js-sys`, `web-sys` (WebCrypto), `futures-util` ; outil `worker-build`. Versions épinglées.
- **Hébergement et coût** : inchangés (offre gratuite Cloudflare). Point à mesurer : le temps CPU par requête (10 ms sur l'offre gratuite) et la taille du module (3 Mo compressés au plus).
- **Données** : aucune migration (rien n'est déployé ; et même sinon, schéma et formats identiques).
