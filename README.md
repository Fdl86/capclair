# CAP CLAIR DEV03 - Test SIA 500K LFCA vers Tours

Cette version teste directement dans CAP CLAIR une navigation LFCA vers Tours sur les tuiles SIA 1/500 000 DEV.

## A vérifier

- Ouvrir Planification.
- La route doit s'appeler `LFCA - LFOT Tours`.
- Le fond SIA DEV doit apparaître autour de l'axe Châtellerault / Tours.
- Les tuiles peuvent afficher du blanc en bord de carte, mais la route doit rester géographiquement au bon endroit.
- L'attribution SIA DEV doit rester visible.

## Important

La clé localStorage a été changée pour éviter que l'ancienne route `LFBD - LFEH` reste affichée après déploiement.

## Build

```bash
npm run build
```

## Commit proposé

```txt
test sia 500k lfca tours route
```
