# CAP CLAIR DEV05 - SIA LFCA Tours nodata fix

Cette version corrige la bande noire observée en DEV04 sur la zone LFCA.

## A tester

1. Ouvrir Planification.
2. Vérifier que la route affiche `LFCA - LFOT Tours`.
3. Vérifier que la bande noire sous LFCA a disparu.
4. Vérifier si LFCA est maintenant lisible sous ou autour du marqueur D.
5. Vérifier LFOT / Tours.
6. Vérifier que l'affichage est moins encombré : les zones prototype sont masquées en Planification.

## Ce qui a été fait

- Post-traitement des tuiles WebP pour remplacer le nodata noir connecté aux bords par un beige clair.
- Conservation des tuiles WebP statiques.
- Pas de PDF ni de GeoTIFF dans l'app.
- Pas de dépendance ajoutée.
- Pas de correction artificielle des coordonnées route.

## Commit proposé

```txt
fix sia lfca tours nodata band
```
