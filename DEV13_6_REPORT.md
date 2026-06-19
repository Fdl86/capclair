# CAP CLAIR DEV13.6 - Zones banner

## Objectif

Retirer l'audit météo visible du log et ajouter une première bannière zones calculée par position et altitude.

## Nouveautés

- Catalogue compact des espaces aériens généré depuis l'export interne.
- Types intégrés : CTR, TMA, CTA, SIV, RMZ, TMZ, R, D, P.
- Moteur de calcul zones par branche :
  - bbox d'abord
  - échantillonnage léger de la branche
  - point dans polygone
  - test altitude de branche / plancher / plafond
  - compression et priorisation des résultats
- Log de nav enrichi :
  - fréquence issue de la zone principale quand disponible
  - zone / contact réaliste par branche
  - mention à confirmer si contact absent ou ambigu
- Nouvelle bannière zones :
  - axe horizontal = progression branche
  - axe vertical = altitude
  - blocs = zones traversées
  - ligne cyan = altitude prévue de la branche
  - blocs atténués si zone traversée mais hors altitude
  - blocs orange si limite verticale incertaine

## Nettoyage

- Panneau audit météo retiré de l'interface normale.
- Les données météo strictes restent disponibles dans le log et les calculs, sans audit détaillé visible.

## Optimisation

- Aucun nouveau package.
- Pas de rendu vectoriel lourd sur la carte.
- Calcul local en mémoire, bbox avant géométrie.
- Échantillonnage limité à 17 points par branche.
- Bannière rendue en DOM/CSS léger.

## Limites

- Première version de calcul zones.
- Les limites ASFC sont marquées comme incertaines.
- Les fréquences ne sont affichées que si une fréquence exploitable est liée à la zone.
- Vérification officielle nécessaire avant usage réel.
