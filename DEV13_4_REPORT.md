# CAP CLAIR DEV13.4 - Weather audit

## Objectif

Rendre vérifiable chaque valeur de vent affichée dans le log de nav.

## Nouveautés

- Ajout d'un panneau `Audit météo` dans le log de nav.
- Affichage par branche :
  - point météo exact utilisé
  - latitude / longitude normalisées
  - altitude demandée
  - heure UTC réellement utilisée
  - heure locale équivalente
  - source / provider
  - endpoint réellement utilisé
  - fallback oui / non
  - cache navigateur / Cloudflare / live
  - niveau pression bas
  - niveau pression haut
  - vent interpolé
  - nombre de samples utilisés
  - clé normalisée de cache

## Correctifs météo

- Arrondi de l'heure météo à l'heure la plus proche.
- Ancien cache météo navigateur isolé par nouveau préfixe.
- Cache Cloudflare météo isolé en `wind-cache-v2`.
- Les audits sont conservés dans le cache.
- Le message partiel indique maintenant les branches manquantes.

## Pourquoi

Cela permet de comparer proprement CAP CLAIR avec Windy :
- même point
- même heure UTC
- même heure locale
- même altitude
- même source
- fallback visible
- niveaux pression visibles

## Optimisation

- Aucun nouveau package.
- Pas d'appel météo automatique.
- Audit alimenté par les données déjà reçues, sans requête supplémentaire.
- Cache navigateur conservé.
- Cache Cloudflare conservé si disponible.
