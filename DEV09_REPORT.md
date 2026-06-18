# CAP CLAIR DEV09 - Free map + openAIP Cloudflare proxy

## Objectif

Remplacer le blocage SIA 500K PDF par une base plus pragmatique : fond carte gratuit + données openAIP via clé Cloudflare + surcouches CAP CLAIR.

## Changements principaux

- Suppression de l'utilisation des tuiles SIA DEV PDF dans la carte active.
- Ajout d'un fond OpenStreetMap DEV temporaire via `src/mapSources/freeMapSource.ts`.
- Ajout d'un proxy Cloudflare Pages Function :
  - `functions/api/openaip/airports.js`
  - `functions/api/openaip/status.js`
- La clé openAIP est lue via le secret Cloudflare `OPENAIP_API_KEY`.
- La clé n'est pas dans le code, pas dans le repo, pas dans le bundle navigateur.
- Ajout d'un client frontend openAIP :
  - `src/services/openaip/openAipClient.ts`
  - `src/services/openaip/routeBbox.ts`
  - `src/services/openaip/openAipTypes.ts`
- Ajout d'une couche OpenLayers pour les aérodromes openAIP :
  - `src/mapLayers/openAipAirportsLayer.ts`
- La requête openAIP se fait uniquement autour de la route active, avec bbox limitée.
- Cache local léger 12 h côté navigateur.
- Route test conservée : LFCA - LFOD Saumur - LFOT Tours.

## Fonctionnement attendu

1. CAP CLAIR charge le fond libre.
2. CAP CLAIR calcule une bbox autour de la route active.
3. Le frontend appelle `/api/openaip/airports?...`.
4. La Cloudflare Function ajoute le header `x-openaip-api-key` avec le secret.
5. La fonction renvoie une réponse normalisée avec uniquement les aérodromes utiles.
6. La carte affiche les terrains openAIP autour de la route.

## Sécurité

- Aucun secret dans `src/`.
- Aucun secret dans `public/`.
- Aucun secret dans `package.json`.
- Le frontend ne connaît que `/api/openaip/airports`.
- Le proxy refuse les bbox trop grandes.
- Le proxy limite les réponses à 200 éléments maximum.

## Optimisation

- Pas de PDF dans l'app.
- Pas de tuiles SIA embarquées.
- Pas de serveur audio / traitement lourd.
- Une seule requête openAIP autour de la route, pas à chaque pan/zoom.
- Cache local 12 h.
- Cache HTTP Cloudflare 1 h côté proxy.
- Base map en XYZ simple, pas de dépendance carto supplémentaire.
- Build client : 529.21 kB JS, gzip 159.31 kB.

## Test réalisé

`npm ci --ignore-scripts` puis `npm run build`.

Résultat : build OK.

## Point de vigilance

L'endpoint openAIP est basé sur le Core API actuel et utilise `bbox=minLon,minLat,maxLon,maxLat`. Si openAIP modifie ou restreint ce filtre, le proxy est isolé dans un seul fichier et pourra être ajusté sans toucher à l'app.

## Commit proposé

```txt
dev09 add openaip cloudflare proxy
```
