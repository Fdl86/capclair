# CAP CLAIR DEV02 - Rapport livraison

## Objectif
Tester directement dans CAP CLAIR une couche de tuiles SIA 1/500 000 DEV autour de Poitiers / Châtellerault.

## Modifications principales

- Ajout de `src/mapSources/sia500kDevSource.ts`.
- Ajout du micro-tilepack `public/tiles/sia-500k-no-2026-poitiers/`.
- Bascule temporaire de la carte sur la couche `SIA 500K DEV`.
- Mise à jour des labels carte et de l'attribution.
- Route mock remplacée par une route locale LFBI / LFCA.
- Version visible passée à `CAP CLAIR DEV02 - SIA 500K TEST`.
- README mis à jour.
- `package.json` et `package-lock.json` mis à jour en `0.2.0`.

## Optimisation

- 133 tuiles WebP seulement.
- Poids du tilepack : environ 2,1 Mo.
- Pas de PDF dans l'app.
- Pas de GeoTIFF dans l'app.
- Pas de traitement raster côté frontend.
- Tuiles chargées uniquement par OpenLayers selon la vue visible.
- `preload: 0` pour limiter le chargement anticipé.
- Les WebP ne sont pas inclus dans le précache PWA.
- Aucune dépendance supplémentaire.

## Test build

Commande exécutée :

```txt
npm run build
```

Résultat : OK.

Résumé build :

```txt
dist/registerSW.js                0.13 kB
dist/manifest.webmanifest         0.49 kB
dist/index.html                   0.77 kB
dist/assets/index-CNNyALXp.css   19.67 kB
dist/assets/index-CvB_a_le.js   526.76 kB
precache 11 entries (541.59 KiB)
```

## Avertissement

Test technique DEV, non officiel, non réglementaire, non utilisable en navigation.
