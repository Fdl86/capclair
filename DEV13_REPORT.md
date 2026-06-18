# CAP CLAIR DEV13 - Wind aloft et log de nav premium

## Objectif

Ajouter le vent à l'altitude de branche et transformer les calculs en véritable log de nav premium.

## Nouveautés

- Profil de vol :
  - TAS
  - heure de départ UTC
  - altitude par défaut
- Altitude modifiable par branche dans le log de nav.
- Récupération vent en altitude via proxy Cloudflare :
  - `/api/weather/wind-aloft`
- Source météo :
  - Open-Meteo Météo-France
  - niveaux pression
  - interpolation du vent par altitude
- Optimisation requêtes :
  - échantillons au milieu de branche
  - 3 échantillons pour les branches longues
  - arrondi lat/lon à 0.1 degré
  - altitude arrondie au palier 500 ft
  - heure arrondie à l'heure UTC
  - cache navigateur 1 h
  - cache Cloudflare 1 h
  - déduplication serveur
- Calculs par branche :
  - distance
  - route vraie
  - variation magnétique affichée 1E / 1W
  - route magnétique
  - vent
  - dérive
  - cap magnétique
  - vitesse sol
  - ETE
  - ETA
- Écran Log de nav premium :
  - résumé route
  - tableau de navigation
  - zones traversées en chips
  - notes pilote
  - actions export / impression / validation

## Optimisation code

- Aucun nouveau package.
- Weather client isolé dans `src/services/weather`.
- Calculs navigation séparés dans `src/services/navigation`.
- Proxy météo séparé des tuiles openAIP.
- Aucun appel météo automatique à chaque rendu.
- Requête météo seulement sur action utilisateur `Mettre à jour vent` / `Modifier vents`.
- Cache local et serveur pour éviter les requêtes répétées.

## Limites

- Prototype non réglementaire.
- Vent exploité depuis modèle météo, à vérifier en préparation réelle.
- Export PDF non finalisé, bouton préparé.
