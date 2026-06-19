# CAP CLAIR DEV13.3 - Wind now mode

## Changement de logique

Le vent n'est plus calculé selon une heure de vol saisie par l'utilisateur.

Nouvelle logique :
- l'utilisateur règle la route, la TAS et l'altitude
- l'utilisateur clique `Maj vent`
- CAP CLAIR analyse la météo à l'heure du clic
- cette heure est envoyée à tous les samples météo
- le modèle météo renvoie l'échéance la plus proche

## UX

- suppression du champ heure UTC dans Planification
- profil de vol simplifié :
  - TAS
  - altitude défaut
- log de nav conservé
- ETA basée sur l'heure de mise à jour du vent

## Robustesse météo

- délai upstream augmenté à 12 secondes
- retry upstream par provider
- retry frontend automatique des samples manquants :
  - première relance après 850 ms
  - seconde relance après 1250 ms
- objectif : réduire les cas `Vent OK 5/6`

## Optimisation

- aucun nouveau package
- pas d'appel météo automatique
- requête météo seulement sur action utilisateur
- cache navigateur conservé
- cache serveur conservé si runtime disponible
- lat/lon, altitude et heure restent normalisés pour éviter les requêtes inutiles
