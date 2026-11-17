# Outils photo de Prism

Six outils autonomes, écrits en Rust, qui partagent le socle de Prism (décodage RAW avec `rawler`,
lecture EXIF, empreintes XXH3). Chacun fait une seule chose, plus vite que ce qui existe, ou fait
ce qu'aucun logiciel courant ne fait.

| Outil | À quoi il sert |
| --- | --- |
| `prism-tri` | Trier une carte : photo suivante affichée sans attente, notes et rejets écrits en XMP, rafales regroupées avec la plus nette proposée |
| `prism-copie` | Décharger une carte vers un ou plusieurs disques en une seule lecture, avec relecture de chaque copie |
| `prism-scan` | Trouver les photos abîmées d'une photothèque et repérer celles que le disque a altérées en silence |
| `prism-export` | Exporter un dossier en JPEG, AVIF ou PNG redimensionnés, sur tous les cœurs |
| `prism-poussieres` | Repérer les poussières du capteur en comparant toutes les photos d'une séance |

Le tri des rafales (n°6 de la liste de départ) fait partie de `prism-tri`.

## Installer

Les exécutables Mac, Windows et Linux sont construits par GitHub Actions (workflow « Outils photo ») :
ouvrez la dernière exécution dans l'onglet Actions et téléchargez `outils-photo-mac`,
`outils-photo-windows` ou `outils-photo-linux`. Ils ne sont pas signés : même démarche qu'au premier
lancement de Prism.

En local : `cd outils && cargo build --release`, les exécutables sont dans `target/release/`.

## prism-tri

```sh
prism-tri /Volumes/CARTE/DCIM
```

Le navigateur s'ouvre sur la séance. Le serveur ne développe aucun RAW : il repère l'aperçu JPEG que
l'appareil a rangé dans chaque fichier (sans le décoder) et l'envoie tel quel au navigateur, qui
demande d'avance les photos suivantes.

- Flèches : photo précédente ou suivante. Espace : loupe ou grille.
- `1` à `5` : étoiles, `0` : retirer, `X` : rejeter, `U` : annuler le rejet, `6` à `9` : étiquettes.
  Avec `Maj`, la note passe aussi à la photo suivante.
- Les notes vont dans `NOM.xmp` à côté de la photo (`xmp:Rating`, `-1` pour un rejet, et
  `xmp:Label`) : Lightroom, Capture One, Bridge et darktable les lisent. Un XMP existant est modifié
  sans perdre ses réglages.
- En tâche de fond, chaque photo reçoit une vignette, une mesure de netteté et une signature. Les
  déclenchements à moins d'1,5 s d'écart et d'images semblables forment une rafale ; le bouton
  « Garder la plus nette de chaque rafale » rejette les autres (les photos déjà notées restent).

## prism-copie

```sh
prism-copie /Volumes/CARTE ~/Photos /Volumes/Sauvegarde
```

La carte est lue une seule fois, quel que soit le nombre de destinations. Chaque copie est écrite
sous un nom provisoire, relue hors du cache du système, comparée à l'empreinte calculée pendant la
lecture, puis renommée. Rangement par date de prise de vue (`--modele "{AAAA}/{AAAA}-{MM}-{JJ}"`,
ou `--arborescence` pour garder celle de la carte). Un fichier déjà présent et identique n'est pas
recopié ; un fichier différent du même nom prend un suffixe `-2`. À la fin, l'outil dit en toutes
lettres si la carte peut être formatée. Les empreintes rejoignent le registre de `prism-scan`.

## prism-scan

```sh
prism-scan ~/Photos
```

Décode chaque JPEG et chaque RAW en entier. Il signale : fichier tronqué (marqueur de fin absent,
données d'image annoncées au-delà de la fin du fichier), données invalides, bande unie au milieu
ou en bas de l'image (la « bande grise » d'un morceau perdu), fichier vide ou rempli de zéros.

Il garde aussi `.prism-empreintes.json` à la racine : au passage suivant, un fichier de même taille
et de même date mais de contenu différent n'a été modifié par personne, c'est le support qui l'a
altéré. `--rapide` ne fait que cette vérification (sans décoder), à la vitesse du disque.

## prism-export

```sh
prism-export ~/Photos/Seance ~/Export --taille 2048 --qualite 85
prism-export ~/Photos/Seance ~/Web --format avif
prism-export ~/Photos/Seance ~/Epreuves --apercu   # RAW : aperçu intégré, sans développement
```

Chaque photo passe par un seul fil (décodage, redressement, redimensionnement Lanczos SIMD,
encodage), les photos en parallèle. L'EXIF d'un JPEG est recopié (orientation remise à 1). Les RAW
sont développés avec le rendu par défaut de `rawler`, pas avec les réglages faits dans Prism.

## prism-poussieres

```sh
prism-poussieres ~/Photos/Seance
```

Là où l'image est lisse (ciel, mur, fond), l'outil mesure de combien chaque point est plus sombre
que son voisinage, puis fait la moyenne sur toute la séance : la scène change, la poussière reste.
Il écrit `poussieres.json` (position, taille, force de chaque poussière et photos où elle se voit)
et `poussieres.png` (la carte, poussières entourées). Plus la séance est longue, plus c'est sûr ;
une série prise sur pied sans bouger peut faire passer un détail fixe pour une poussière.

## Mesures

Machine de test : 4 cœurs, fichiers déjà en mémoire (le disque ne compte donc pas).

| Mesure | Prism | Référence |
| --- | --- | --- |
| Export de 16 JPEG 24 Mpx en 2048 px | 1,7 s | ImageMagick (4 en parallèle) : 6,3 s, soit 3,7× plus lent |
| Vérification de 8 RAW (CR2, NEF) | 0,8 s | ImageMagick (décodage complet) : 4,2 s, soit 5,5× plus lent |
| Vérification de 16 JPEG 24 Mpx | 1,2 s | ImageMagick : 1,5 s |
| Copie de 343 Mo vers 2 disques, vérifiée | 1,1 s | `cp` deux fois puis `md5sum` : 1,9 s. Sur une vraie carte l'écart grandit : la carte est lue 1 fois au lieu de 3 |
| Ouverture d'un dossier de 1 000 RAW | 0,2 s | |
| Photo suivante dans la loupe (en avançant à 4 photos/s) | 0 à 1 ms | |
| Aperçu RAW 12 Mpx jamais vu | 53 ms | |
| Analyse (vignette, netteté) | 30 ms par photo et par cœur | |

Détection, sur des fichiers abîmés exprès : `prism-scan` trouve les 5 sur 5 (JPEG tronqué, JPEG
avec 200 Ko de zéros au milieu, CR2 et NEF tronqués, fichier vide). Pillow, souvent utilisé dans les
scripts de vérification, en laisse passer 3. Sur une séance simulée de 30 photos, `prism-poussieres`
retrouve 4 poussières sur 4 (dont une à 3,5 % d'assombrissement) et rien sur la même séance sans
poussière. `prism-tri` désigne la bonne photo nette dans 3 rafales sur 3.

## Limites connues

- Pas encore essayés sur de vraies cartes de tous les boîtiers : CR3 et RAF passent par une
  recherche des JPEG intégrés, pas par leurs répertoires.
- `prism-scan` ne décode pas les HEIF ni les vidéos (il suit seulement leur empreinte).
- `prism-export` n'écrit pas encore le JPEG XL (pas d'encodeur Rust pur mûr).
- Sous Windows, la relecture de `prism-copie` peut venir du cache du système.
