# CAP CLAIR DEV13.5 - Météo-France strict

## Objectif

Éviter les comparaisons faussées avec Windy AROME.

## Changements

- Suppression du fallback Open-Meteo Forecast.
- Le proxy météo interroge uniquement :
  - `https://api.open-meteo.com/v1/meteofrance`
- Si Météo-France ne renvoie pas de vent exploitable, la branche reste sans vent.
- Le cache navigateur est isolé avec un nouveau préfixe.
- Le cache Cloudflare météo passe en `wind-cache-v3`.
- L'audit affiche :
  - `Comparable Windy`
  - `Régler Windy`
  - source Météo-France strict
- Messages UI clarifiés :
  - `Météo-France en cours`
  - `Météo-France non reçu`
  - `Erreur Météo-France`

## Pourquoi

Avant ce hotfix, une branche pouvait recevoir un vent depuis l'endpoint `forecast`.
Cela évitait un trou dans le log, mais rendait la comparaison avec Windy AROME trompeuse.

## Optimisation

- Aucun nouveau package.
- Pas d'appel automatique.
- Cache conservé mais isolé.
- Audit alimenté par les données déjà reçues.
