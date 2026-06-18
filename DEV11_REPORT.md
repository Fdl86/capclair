# CAP CLAIR DEV11 - Carte aéro openAIP raster

## Objectif

Corriger DEV10 : la carte aéro prioritaire doit être la couche aviation openAIP complète, comme la vue openAIP avec espaces, zones, terrains, radionav et reporting points, pas seulement quelques terrains vectoriels.

## Ce qui change

- Ajout d'un layer raster openAIP :
  - `src/mapSources/openAipRasterSource.ts`
- Ajout d'un proxy Cloudflare Pages Function :
  - `functions/api/openaip/tiles/[z]/[x]/[y].js`
- URL frontend :
  - `/api/openaip/tiles/{z}/{x}/{y}.png`
- Le frontend ne contient aucune clé openAIP.
- La fonction Cloudflare ajoute `OPENAIP_API_KEY` côté serveur.
- `Carte aéro` devient :
  - fond topo libre
  - surcouche raster aviation openAIP
  - route CAP CLAIR
  - points route
- `Fond libre` devient :
  - fond topo seul
  - pas de couche openAIP raster

## Optimisation

- Pas de PDF.
- Pas de 500K artisanale.
- Pas de clé dans le bundle.
- Tuiles openAIP cachées côté Cloudflare 24 h.
- Overlay raster activé uniquement en mode `Carte aéro`.
- Aucun nouveau package.

## Variables Cloudflare requises

`OPENAIP_API_KEY`

## Test post-déploiement

- Ouvrir Planification.
- Sélecteur sur `Carte aéro`.
- Vérifier que les espaces et zones openAIP apparaissent.
- Passer sur `Fond libre`.
- Vérifier que le fond topo reste seul.

## Avertissement

Données non officielles pour navigation. Attribution openAIP et OpenStreetMap conservée.
