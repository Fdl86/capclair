# CAP CLAIR DEV12 - Route builder et carte aéro propre

## Objectif

Rendre la planification réellement utilisable sans retomber dans le chantier 500K/PDF.

## Changements produit

- Suppression des points noirs openAIP vectoriels.
- Suppression des références visibles aux données techniques internes.
- Carte aéro openAIP raster conservée en priorité.
- Toggle `Fond topo ON/OFF`.
- Choix départ / arrivée par code OACI.
- Ajout d'un point tournant par clic sur la carte.
- Points tournants compacts : A, 1, 2, D avec code OACI ou WP.
- Calculs par branche :
  - distance NM
  - route vraie
  - variation magnétique estimée
  - route magnétique
  - temps estimé
- Carte plus grande sur PC.
- Tuiles de points tournants plus compactes.

## Catalogue aérodromes

- 602 aérodromes intégrés en catalogue léger.
- Champs conservés : code, nom, latitude, longitude, altitude, variation magnétique.
- Pas d'affichage technique du format source.

## Optimisation

- Aucun nouveau package.
- Aucun fetch openAIP vectoriel pour les points noirs.
- Un seul layer raster aviation.
- Fond topo masquable sans recréer la carte.
- Gestion du clic carte active uniquement pendant le mode `+ Point`.
- Calcul route séparé du rendu carte.
- Catalogue compressé en champs minimaux.

## Test attendu

1. Ouvrir Planification.
2. Changer départ et arrivée avec des codes OACI.
3. Activer `+ Point`, cliquer sur la carte.
4. Vérifier que le point WP apparaît et que la route se recalcule.
5. Passer Fond topo ON/OFF.
6. Ouvrir Calculs et vérifier les RV / Var / RM.

## Limite

La variation magnétique est estimée par interpolation locale des variations publiées pour les aérodromes proches. Ce n'est pas un calcul réglementaire.
