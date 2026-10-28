# Algorithmes repris de Photo Studio

`src/` est une copie de `src/imaging/` (et de deux fichiers de `src/features/`) de Photo Studio,
l'éditeur de [ps.puter.com](https://ps.puter.com/), code source dans
[HeyPuter/everything](https://github.com/HeyPuter/everything/tree/main/src/photo-studio)
(commit 5109489e, 26 octobre 2026), sous licence MIT (`LICENSE-photo-studio`).

- `entry.ts` expose à Prism les opérations utilisées (`self.PSI.run(op, args)`), sur la page ou dans un worker.
- `build.mjs` compile le tout avec esbuild dans `web/ps/ps.js` et écrit `web/ps/worker.js` :
  `node web-src/ps/build.mjs` (ou `npm run build-ps`), `--check` pour vérifier que `web/ps` est à jour.
- Les modifications propres à Prism dans `src/` sont marquées d'un commentaire `Prism:`.

Côté Prism, les fonctions se branchent dans `web-src/feat/ps*.js`.
