-- Prism : comptes et synchronisation (Cloudflare D1)
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user TEXT NOT NULL, device TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, user TEXT NOT NULL, name TEXT NOT NULL, platform TEXT NOT NULL, created INTEGER NOT NULL, last INTEGER NOT NULL, cursor INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS devices_user ON devices(user);
CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT NOT NULL, device TEXT NOT NULL, kind TEXT NOT NULL, pid TEXT NOT NULL, body TEXT, blobs TEXT NOT NULL DEFAULT '[]', created INTEGER NOT NULL, origin TEXT);
CREATE INDEX IF NOT EXISTS events_user ON events(user, seq);
CREATE TABLE IF NOT EXISTS transit(user TEXT NOT NULL, key TEXT NOT NULL, size INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(user, key));
CREATE TABLE IF NOT EXISTS attempts(email TEXT PRIMARY KEY, n INTEGER NOT NULL, since INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_origin ON events(origin);
-- travail à plusieurs : une photo partagée entre comptes (role owner / edit), et qui la retouche en ce moment (chacun son tour)
CREATE TABLE IF NOT EXISTS shares(pid TEXT NOT NULL, user TEXT NOT NULL, role TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(pid, user));
CREATE INDEX IF NOT EXISTS shares_user ON shares(user);
CREATE TABLE IF NOT EXISTS locks(pid TEXT PRIMARY KEY, user TEXT NOT NULL, device TEXT NOT NULL, name TEXT NOT NULL, until INTEGER NOT NULL);
