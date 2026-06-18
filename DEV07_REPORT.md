# CAP CLAIR DEV07 - Test jonction SIA Nord-Ouest + Sud-Ouest

## Objectif

Tester directement dans CAP CLAIR la superposition :
- Nord-Ouest DEV déjà utilisée pour Saumur / Tours
- Sud-Ouest DEV SO04 autour de LFCA / Poitiers

## Ce que cette version ajoute

- Tilepack Sud-Ouest local `public/tiles/sia-500k-so-2026-lfca`.
- Nouvelle source `src/mapSources/sia500kSouthWestDevSource.ts`.
- OpenLayers charge désormais 2 TileLayer statiques :
  1. Nord-Ouest
  2. Sud-Ouest transparente au-dessus sur la zone LFCA / Poitiers
- Route conservée : `LFCA - LFOD Saumur - LFOT Tours`.
- Label carte : `Données DEV07 NO+SO`.

## Pourquoi

La Nord-Ouest seule est bonne autour de Saumur / Tours, mais LFCA tombe en limite sud de feuille.
La Sud-Ouest doit combler proprement LFCA / Poitiers sans bricoler les coordonnées.

## Optimisation

- Pas de PDF dans l'app.
- Pas de GeoTIFF.
- Pas de calcul raster côté frontend.
- Deux tilepacks WebP statiques.
- La Sud-Ouest est limitée à LFCA / Poitiers.
- Nodata Sud-Ouest en transparence WebP RGBA.
- `preload: 0` conservé.

## Limites

- SO04 est un premier warp test, pas une version finale.
- Les GCP Sud-Ouest doivent encore être validés par le rendu réel.
- Si la jonction fonctionne, il faudra ensuite produire une génération plus propre z10-z12 ou z11-z13 selon le poids.

## Test attendu

Dans Planification :
1. Vérifier que LFCA n'est plus en bord vide.
2. Vérifier si le marqueur D tombe mieux sur LFCA.
3. Vérifier LFOD Saumur sur la Nord-Ouest.
4. Vérifier LFOT Tours sur la Nord-Ouest.
5. Vérifier s'il y a une cassure visible entre NO et SO.

## Avertissement

Test technique DEV, non officiel, non réglementaire, non utilisable en navigation.
