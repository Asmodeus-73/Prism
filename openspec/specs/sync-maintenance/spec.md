# sync-maintenance Specification

## Purpose
Ménage horaire du serveur (déclencheur cron à la 17e minute de chaque heure) et réglages par variables d'environnement, pour que Cloudflare ne garde ni fichiers, ni journal, ni sessions plus longtemps que nécessaire.

## Requirements

### Requirement: Ménage horaire
À chaque déclenchement planifié, le serveur SHALL :
- effacer de R2 et de la table `transit` les fichiers déposés depuis plus de `TRANSIT_HOURS` heures (24 par défaut) ;
- supprimer les évènements de plus de `EVENTS_DAYS` jours (30 par défaut) ;
- supprimer les compteurs d'essais de plus de 2 heures ;
- supprimer les verrous expirés ;
- supprimer les sessions des appareils sans activité depuis 180 jours.

#### Scenario: Transit de plus de 24 h
- **WHEN** un fichier est en transit depuis plus de 24 heures et le ménage passe
- **THEN** le fichier n'est plus disponible (404)

### Requirement: Réglages
Le serveur SHALL lire `TRANSIT_LIMIT` (octets, 9 500 000 000 par défaut), `USER_LIMIT` (octets, 60 % de `TRANSIT_LIMIT` par défaut), `TRANSIT_HOURS` (24 par défaut) et `EVENTS_DAYS` (30 par défaut) dans ses variables d'environnement, et les liaisons `DB` (D1), `TRANSIT` (R2) et `LIVE` (Durable Object `Live`).

#### Scenario: Limite réduite pour les tests
- **WHEN** `TRANSIT_LIMIT` vaut `5000`
- **THEN** un dépôt qui porterait le transit au-delà de 5 000 octets reçoit 507

### Requirement: Schéma de stockage
Le serveur SHALL utiliser le schéma D1 de `server/schema.sql` (tables `users`, `sessions`, `devices`, `events`, `transit`, `attempts`, `shares`, `locks`) et le rangement R2 `<compte>/<nom>`, de sorte qu'une base et un bucket existants restent utilisables d'une version du serveur à l'autre sans migration.

#### Scenario: Changement de version du serveur
- **WHEN** une nouvelle version du serveur est publiée sur une base existante
- **THEN** les comptes, appareils, évènements et fichiers en transit restent utilisables
