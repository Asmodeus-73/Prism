# Sources de l'éditeur

`web/index.html` est fabriqué ; on ne le modifie jamais à la main.

```
web-src/
  app/page.html      la page (barres, panneaux) ; @@CSS@@ et @@JS@@ marquent où vont la feuille de style et le script
  app/css/*.css      la feuille de style, par sujet, assemblée dans l'ordre des noms
  app/js/*.js        l'éditeur, par sujet, assemblé dans l'ordre des noms en un seul script
  feat/*.js          les fonctions ajoutées en dernier, chacune dans son propre bloc { }
  build.mjs          l'assemblage
```

Construire : `node web-src/build.mjs` (ou `npm run build-web`).
Vérifier : `npm test` contrôle que `web/index.html` correspond aux sources, puis lance les tests de l'éditeur dans Chromium (`tests/smoke.mjs`).

## Règles

- Les fichiers de `app/js/` partagent la même portée : une fonction déclarée dans l'un est visible dans les suivants. Le numéro en tête du nom fixe l'ordre ; un nouveau fichier prend un numéro libre entre ses voisins.
- Chaque fichier doit se lire seul (`node --check`) : on ne coupe jamais au milieu d'une fonction.
- Les fichiers de `feat/` sont isolés dans un bloc : ce qu'ils partagent passe par `window` ou par l'objet `AI`.
- Plusieurs fichiers enveloppent les gestionnaires de pointeur (`onDown`, `onMove`, `onUp`, `drawOverlays`) et `setTool` : chaque enveloppe traite son outil puis passe la main à la précédente. Une nouvelle enveloppe suit ce même modèle et se termine toujours par l'appel à la précédente.
- Une correction se fait dans le fichier du sujet concerné, pas dans un nouveau fichier ajouté en fin de liste.
