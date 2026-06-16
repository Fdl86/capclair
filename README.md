# CAP CLAIR DEV01 - Navigation VFR

CAP CLAIR DEV01 est un socle produit et technique PWA mobile-first pour la préparation et le suivi de navigation VFR app ouverte.

DEV01 n’est pas un outil de navigation opérationnel. Il ne contient pas de météo réelle, pas de NOTAM, pas de données SIA exploitables, pas de compte utilisateur et ne promet aucun suivi GPS en arrière-plan.

## Objectif DEV01

- Afficher une vraie couche OACI-VFR 1/500 000 comme fond principal quand l’accès Géoplateforme est configuré et disponible.
- Superposer une route prévue cyan, une trace réelle ambre, des points, un avion orienté et des zones prototypes.
- Démontrer l’UX cockpit portrait et paysage.
- Tester le suivi GPS app ouverte via `watchPosition`.
- Proposer un mode simulation si le GPS est refusé ou indisponible.
- Sauvegarder localement les traces et exporter en GPX.

## Stack

- Vite
- React
- TypeScript
- OpenLayers
- CSS maison
- PWA via vite-plugin-pwa
- Stockage local navigateur
- Aucun backend DEV01

## Installation

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Le dossier de sortie pour Cloudflare Pages est :

```txt
dist
```

Commande Cloudflare Pages :

```txt
npm run build
```

## Variables d’environnement

Créer un fichier `.env` à partir de `.env.example`.

```txt
VITE_IGN_WMTS_URL=https://data.geopf.fr/private/wmts
VITE_IGN_WMTS_LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI
VITE_IGN_WMTS_API_KEY=ign_scan_ws
VITE_IGN_WMTS_TILE_MATRIX_SET=PM
```

La clé indiquée est une valeur d’exemple. Pour un usage durable ou publié, utiliser une clé conforme à l’usage prévu et aux conditions IGN / Géoplateforme / SIA.

Aucune tuile OACI-VFR n’est téléchargée ni redistribuée dans ce dépôt.

Si la couche OACI-VFR ne charge pas, l’application affiche un fallback `Fond demo` avec un badge explicite.

## Cloudflare Pages

Paramètres recommandés :

```txt
Framework preset : Vite
Build command : npm run build
Build output directory : dist
Root directory : vide si le projet est à la racine du repo
```

Ajouter les variables `VITE_IGN_WMTS_*` dans Cloudflare Pages si nécessaire.

## Optimisation DEV01

- Pas de framework UI massif.
- Pas de bibliothèque d’icônes externe.
- OpenLayers uniquement pour le besoin cartographique WMTS/raster et overlays.
- CSS maison découpé en fichiers simples.
- Navigation interne sans router lourd.
- Overlays cartographiques séparés : route, trace, points, avion, zones.
- Trace GPS filtrée avant ajout pour éviter les points imprécis ou trop rapprochés.
- Stockage local limité à la route active et aux 20 dernières traces.
- Pas de recalcul global inutile : calculs géographiques isolés dans `services/geo`.
- Pas d’animations décoratives coûteuses.
- PWA avec précache limité aux ressources applicatives ; les tuiles WMTS ne sont pas mises en cache par le service worker DEV01.

## Limites DEV01

- Prototype UX et technique uniquement.
- Données de route et zones simulées.
- Calculs simplifiés.
- Pas de fond cartographique officiel si la clé ou le flux WMTS ne sont pas accessibles.
- GPS seulement lorsque l’application est ouverte au premier plan.

## Titre de commit proposé

```txt
init cap clair dev01 with oaci vfr wmts map
```
