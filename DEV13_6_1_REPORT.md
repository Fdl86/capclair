# CAP CLAIR DEV13.6.1 - Frise zones globale

## Objectif

Remplacer l'affichage par branche par une frise unique couvrant toute la navigation.

## Nouveautés

- Nouvelle frise unique `Navigation complète`.
- Axe horizontal : distance cumulée et points LFBI / WP / arrivée.
- Axe vertical : altitude.
- Ligne cyan : altitude planifiée.
- Blocs zones positionnés sur l'ensemble de la route.
- Contact principal et secondaire en synthèse.
- Légende dans la zone / sous la zone / au-dessus / à confirmer.

## Conservation

- Moteur météo Météo-France strict conservé.
- Moteur zones par position + altitude conservé.
- Tableau log de nav conservé.
- Aucun nouveau package.

## Optimisation

- Calcul zones inchangé, rendu global en DOM/CSS léger.
- Pas de rendu vectoriel massif sur la carte.
- Le catalogue zones reste lazy-load via import dynamique.
