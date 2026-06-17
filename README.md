# CAP CLAIR DEV02 - Test tuiles SIA 500K Poitiers

CAP CLAIR DEV02 est une version de test de l'application CAP CLAIR intégrant un micro-tilepack local issu de la carte SIA OACI 1/500 000 Nord-Ouest 2026.

Cette version sert uniquement à tester le rendu OpenLayers, le chargement des tuiles WebP, la fluidité et l'intégration UI dans l'application existante. Elle n'est pas une source réglementaire de navigation.

## Ce qui change dans DEV02

- Ajout d'une couche locale `SIA 500K DEV` dans OpenLayers.
- Ajout de tuiles WebP dans `public/tiles/sia-500k-no-2026-poitiers/`.
- Zone de test compacte autour de Poitiers / Châtellerault.
- Route mock remplacée par une route locale LFBI / LFCA.
- Attribution SIA et avertissement DEV visibles dans la carte.
- Aucun PDF SIA dans l'application.
- Aucun GeoTIFF dans l'application.
- Aucun traitement cartographique lourd côté frontend.

## Test attendu

Uploader cette version sur Cloudflare Pages comme l'app actuelle, puis vérifier :

- la carte SIA DEV s'affiche bien ;
- la route cyan est visible ;
- les zooms et déplacements restent fluides ;
- les tuiles ne sont chargées qu'à la demande ;
- l'attribution DEV reste visible ;
- aucune tuile WebP n'est précachée par le service worker.

## Stack

- Vite
- React
- TypeScript
- OpenLayers
- CSS maison
- PWA via vite-plugin-pwa
- Tuiles XYZ WebP statiques

## Installation

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Dossier Cloudflare Pages :

```txt
dist
```

## Optimisation DEV02

- Tilepack compact : 133 tuiles WebP seulement, environ 2,1 Mo.
- Pas de PDF dans `public`.
- Pas de tuiles dans le bundle JS.
- Tuiles servies comme assets statiques par URL XYZ.
- `preload: 0` sur la couche OpenLayers.
- `transition: 0` sur la source XYZ pour limiter les effets inutiles.
- Service worker limité aux assets applicatifs JS/CSS/HTML/icons ; les WebP ne sont pas précachés.
- Pas de dépendance supplémentaire ajoutée.

## Avertissement

Source : Service de l'Information Aéronautique - Carte OACI SIA Nord-Ouest 2026 - édition en vigueur à partir du 16 avril 2026. Retuilage CAP CLAIR DEV. Produit non officiel. Ne se substitue pas aux documents aéronautiques à jour, AIP, NOTAM, SUP AIP, briefing météo et préparation réglementaire.

## Titre de commit proposé

```txt
add sia 500k poitiers tile test
```
