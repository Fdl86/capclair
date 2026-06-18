# CAP CLAIR DEV04 - LFCA Tours précision points

## Objectif

Corriger l'affichage et le positionnement des points de la navigation de test LFCA - LFOT Tours.

## Corrections

- LFCA positionné sur les coordonnées ARP SIA : 46°46'49"N, 000°33'02"E.
- LFOT positionné sur les coordonnées ARP SIA : 47°25'55"N, 000°43'23"E.
- Clé localStorage changée en `capclair.activeRoute.dev04.lfcaToursPrecise`.
- Suppression de la trace mock orange dans Planification.
- Route cyan affinée de 5 px à 3 px.
- Marqueurs légèrement réduits.
- Zoom maximum de la vue limité à 9 pour éviter le sur-zoom flou du tilepack DEV z7-z9.
- Fond de carte vide passé en beige clair, au lieu du noir cockpit, pour les zones hors tuiles / bord de feuille.

## Important

Le tilepack reste le même que DEV03 : il s'agit encore d'un test géoréférencé z7-z9.
Pour une vraie lisibilité à plus fort zoom, il faudra générer ensuite des tuiles z10-z11 autour de la zone de test.

## Test attendu

Dans Planification :
- la route doit être `LFCA - LFOT Tours`.
- les points D et A doivent mieux tomber sur LFCA et LFOT.
- il ne doit plus y avoir de double ligne orange/bleue.
- le zoom doit être moins flou et moins agressif.

## Avertissement

Test technique DEV, non officiel, non réglementaire, non utilisable en navigation.
