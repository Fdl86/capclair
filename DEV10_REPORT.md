# CAP CLAIR DEV10 - Carte aéro prioritaire

## Objectif

Mettre immédiatement le mode carte aéro en première position et reléguer le fond libre en deuxième choix.

## Changements

- Suppression du bouton `500K plus tard`.
- Nouveau sélecteur de carte :
  1. `Carte aéro`
  2. `Fond libre`
  3. `SIA XML`
- Le mode par défaut de Planification est désormais `Carte aéro`.
- En mode `Carte aéro`, les terrains openAIP sont chargés via le proxy Cloudflare.
- En mode `Fond libre`, la carte reste la même base topo mais sans surcouche openAIP active.
- En mode `SIA XML`, la couche est réservée pour la prochaine étape France officielle.
- Aucune clé openAIP dans le code.

## Optimisation

- Pas de nouveau package.
- Pas de serveur lourd.
- Pas de carte raster embarquée.
- Pas de PDF ni de tuiles 500K.
- La surcouche openAIP n'est appelée que si le mode `Carte aéro` est actif.
- En mode fond libre, la couche openAIP est vidée pour limiter l'affichage et les traitements.

## Test build

`npm run build` OK.

## Commit proposé

```txt
dev10 prioritize aero map mode
```
