# Serveur de synchronisation de Prism

Écrit en Rust ([workers-rs](https://github.com/cloudflare/workers-rs)), compilé en WebAssembly et publié sur Cloudflare Workers
(D1 pour les comptes et le journal, R2 pour les fichiers en transit, un Durable Object par compte pour le direct).
Son comportement est décrit par les specs `openspec/specs/sync-*`.

## Compiler et tester

```sh
cargo install worker-build@0.8.7 --locked   # une fois
cd server
npm ci                                      # Miniflare, pour les tests
cargo clippy --release --target wasm32-unknown-unknown -- -D warnings
cargo test --lib                            # validations et coercions, en natif
worker-build --release                      # → build/index.js + build/index_bg.wasm
node test.mjs                               # le serveur dans Miniflare
cd .. && node tests/sync.mjs && node tests/collab.mjs && node tests/security.mjs   # avec l'éditeur
```

`parite.mjs` compare le serveur Rust à l'ancien serveur JavaScript (dans l'historique git) sur 93 requêtes, dont des
requêtes bizarres (mode d'emploi en tête du fichier).

## Ce qui est volontairement reproduit du serveur JavaScript

Le serveur précédent était en JavaScript ; les appareils ne doivent voir aucune différence. `src/js.rs` reproduit donc :

| Particularité | Exemple |
|---|---|
| `String(v \|\| '')` sur les champs texte | `{"email": 12}` → adresse `"12"` (refusée) ; `{"kind": 0}` → `""` |
| `+v \|\| 0` sur les nombres, puis `max(0, …)` | `{"seq": "5"}` → 5 ; `true` → 1 ; `"abc"`, `-3` → 0 ; `?after=1.5` gardé |
| Longueurs en unités UTF-16 (`.length`) | limites de 60, 64, 128, 200, 280 000 et 65 536 caractères |
| `\s` et `trim()` de JavaScript | ` ` et `﻿` comptent comme espaces, pas `\u0085` |
| `null.x` lève une erreur (500), `[].x` non | corps `null` → 500 ; corps `[]` → validation normale |
| Ordre des vérifications et des compteurs | le compteur de débit compte un appel refusé ensuite ; le rôle `owner` est inscrit avant le test `nouser` |

Écarts acceptés (aucun appareil n'envoie cela, `JSON.stringify` ne le produit pas) :
- `body` d'un évènement est gardé tel quel, espaces retirés, sans être décodé (plus rapide) : `1.0` reste `1.0` et `"A"` reste échappé, là où JavaScript réécrivait `1` et `"A"` ;
- une moitié de paire UTF-16 seule (`"\ud800"`) est refusée comme JSON invalide (400), JavaScript l'acceptait ;
- un `device.id` numérique est rendu comme texte (`"123"` au lieu de `123`).

## Moins d'allers-retours que le serveur JavaScript

Mêmes réponses, moins de requêtes D1/R2 (comptées à la lecture du code, K fichiers, N membres) :

| Route | JavaScript | Rust |
|---|---|---|
| toute requête authentifiée | 2 | 1 (la dernière activité n'est réécrite qu'une fois par minute) |
| `PUT /v1/blobs` (hors R2) | 6 | 3 |
| `POST /v1/events` (photo partagée à N autres membres) | 8 + N | 7 |
| `GET /v1/shares` (P photos partagées) | 3 + 2P | 3 |
| ménage après un accusé de réception | 1 + comptes + 2K | 2 + K/1000 (R2) + K/2450 (D1) |
| ménage horaire | 5 + 2K | 2 + K/1000 (R2) |
