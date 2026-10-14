# Prism

Application de retouche photo pour Mac et Windows, construite avec [Tauri 2](https://tauri.app) à partir de la version web de Prism.

## Organisation

- `web/` : la version web telle que publiée (page et fichiers : IA, RAW, PDF, HEIC, AVIF, PSD, gestion des couleurs). On ne la modifie pas à la main ; on la remplace par une nouvelle copie quand la version web évolue.
- `desktop/` : ce que l'application de bureau ajoute (pont vers les fonctions natives dans `desktop.js`, polices embarquées pour fonctionner hors ligne).
- `scripts/prepare.mjs` : assemble `web/` et `desktop/` dans `dist/`, que Tauri embarque.
- `src-tauri/` : la partie native (Rust) : fenêtre, boîtes de dialogue, écriture des fichiers.

## Construire

Les applications Mac (universelle, Apple Silicon et Intel) et Windows sont construites par GitHub Actions à chaque nouvelle étiquette de version :

```sh
git tag v0.2.0 && git push origin v0.2.0
```

Elles apparaissent ensuite dans la page Releases du dépôt.

En local : `npm ci` puis `npm run dev` (ou `npm run build`), avec Rust et les [prérequis Tauri](https://tauri.app/start/prerequisites/) installés.

## Premier lancement

L'application n'est pas signée par Apple ni par Microsoft (usage personnel).

- Mac : au premier lancement, macOS refuse de l'ouvrir. Allez dans Réglages système > Confidentialité et sécurité, puis cliquez sur « Ouvrir quand même ». C'est à faire une seule fois.
- Windows : SmartScreen affiche « Windows a protégé votre ordinateur ». Cliquez sur « Informations complémentaires » puis « Exécuter quand même ».
