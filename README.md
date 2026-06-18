# CAP CLAIR DEV11 - Carte aéro openAIP raster

Cette version met enfin la bonne option en priorité : la carte aéro openAIP complète en surcouche raster.

## Ordre des cartes

1. Carte aéro
   - fond topo libre
   - tuiles aviation openAIP via proxy Cloudflare

2. Fond libre
   - fond topo seul

3. SIA XML
   - réservé aux données officielles France à venir

## Variable Cloudflare requise

`OPENAIP_API_KEY`

La clé ne doit pas être mise dans Vite, ni dans GitHub, ni dans le frontend.

## Commit proposé

```txt
dev11 add openaip raster aero tiles
```
