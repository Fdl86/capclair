# CAP CLAIR DEV05 - LFCA Tours nodata fix

## Objectif

Corriger la bande noire qui masquait la zone LFCA dans le test `LFCA - LFOT Tours`.

## Diagnostic intégré

La bande noire ne venait pas du CSS ou de React. Elle était présente directement dans les tuiles WebP générées à partir du raster warp. C'était donc un problème de nodata noir dans le tilepack.

## Corrections appliquées

- Post-traitement du tilepack WebP existant.
- Détection des zones très sombres connectées aux bords de tuiles.
- Remplacement de ces zones nodata par un fond beige clair `#f4f1e8`.
- Les pixels noirs internes à la carte ne sont pas remplacés globalement, pour éviter d'altérer textes et symboles.
- 68 tuiles modifiées.
- 2443869 pixels nodata remplacés.
- `public/tiles/sia-500k-no-2026-lfca-tours/nodata-fix-report.json` ajouté.
- Fond `.map-shell` conservé en beige clair.
- Zones prototype masquées par défaut dans Planification pour ne pas gêner la vérification du fond.
- Nom interne de couche corrigé en `sia-500k-dev-lfca-tours`.
- Label carte passé en `Données DEV05 nodata`.
- Version visible passée à `CAP CLAIR DEV05 - SIA LFCA TOURS NODATA FIX`.

## Ce que cette version corrige

- La bande noire au sud doit disparaître.
- LFCA doit être visible ou, au minimum, ne plus être masqué par du noir.
- Le bord de feuille doit apparaître comme fond beige clair plutôt que noir.
- Le test de positionnement LFCA devient possible.

## Limites restantes

- Le tilepack reste un test z7-z9 : lisibilité limitée à fort zoom.
- La zone LFCA est au bord sud de la carte Nord-Ouest, donc la couverture reste naturellement limite.
- Pour un test de précision final, il faudra probablement générer un tilepack z10-z11 autour de LFCA - Tours, voire mixer Nord-Ouest / Sud-Ouest plus tard.

## Test attendu

Dans Planification :
- ouvrir `LFCA - LFOT Tours`;
- vérifier que la bande noire a disparu;
- vérifier si le marqueur D tombe correctement par rapport à LFCA;
- vérifier si LFOT reste correctement placé;
- vérifier que le rendu est plus propre avec les zones prototype masquées.

## Avertissement

Test technique DEV, non officiel, non réglementaire, non utilisable en navigation.
