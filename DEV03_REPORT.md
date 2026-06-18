# CAP CLAIR DEV03 - Rapport livraison

## Objectif

Corriger le test applicatif après constat que l'ancienne route persistée en localStorage perturbait le contrôle visuel, et passer sur une navigation mieux couverte par la carte Nord-Ouest : LFCA vers Tours.

## Modifications principales

- Route mock remplacée par `LFCA - LFOT Tours`.
- Centre initial de carte déplacé vers l'axe Châtellerault / Tours.
- Clé localStorage changée en `capclair.activeRoute.dev03.lfcaTours` pour éviter de récupérer l'ancienne route `LFBD - LFEH`.
- Tilepack remplacé par la couverture DEV03 z7-z9 plus large, afin d'inclure Tours.
- Source OpenLayers mise à jour vers `/tiles/sia-500k-no-2026-lfca-tours/xyz/{z}/{x}/{y}.webp`.
- `maxZoom` source limité à 9 pour correspondre au tilepack.
- Labels DEV mis à jour.

## Optimisation

- Aucun PDF dans l'app.
- Aucun GeoTIFF dans l'app.
- Aucun traitement raster côté frontend.
- Tuiles WebP statiques.
- `preload: 0` conservé.
- Pas de dépendance supplémentaire.
- Clé de stockage versionnée pour éviter les tests faussés par les anciennes données locales.
- Tilepack DEV plus large mais encore raisonnable : 155 tuiles WebP.

## Test attendu

Dans Planification, la route doit afficher `LFCA - LFOT Tours`.

Si l'écran affiche encore `LFBD - LFEH`, le navigateur sert encore une ancienne version ou un ancien stockage. Faire Ctrl+F5 ou supprimer les données du site.

## Avertissement

Test technique DEV, non officiel, non réglementaire, non utilisable en navigation.
