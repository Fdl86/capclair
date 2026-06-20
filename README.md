# CAP CLAIR

Application VFR mobile-first pour préparation de navigation, log de nav, météo vent et suivi GPS.

## Base actuelle

- Carte aéro openAIP via proxy Cloudflare.
- Planification route avec départ, arrivée et points intermédiaires.
- Profil de vol avec TAS et altitude.
- Vent Météo-France strict via Open-Meteo.
- Log de navigation premium.
- Frise zones globale optimisée sur l'ensemble de la nav.
- PWA Vite / React / TypeScript.
- Traitement local côté navigateur.
- Proxy Cloudflare Pages Functions pour les API externes.

## Installation

```bash
npm ci
npm run build
```

## Déploiement Cloudflare Pages

Variable requise pour les tuiles openAIP :

```txt
OPENAIP_API_KEY
```

La météo Météo-France via Open-Meteo ne nécessite pas de clé.

## Notes

Prototype non réglementaire. Ne pas utiliser comme source unique pour une navigation réelle.

## Version courante

DEV13.6.2 - Frise UX optimized

- Bouton Zones retiré de Planification.
- Commandes TAS et altitude avec boutons - / +.
- Frise zones allégée.
- Altitude route affichée sur la frise sans libellé long.
- Graphique limité aux couches réellement utiles autour de l'altitude prévue.
- Météo Météo-France strict conservée.

## DEV13.6.3

Hotfix frise zones :
- alignement réel des valeurs d'altitude à gauche avec les lignes du graphique
- altitude route affichée à gauche dans la colonne altitude
- suppression du libellé long dans le graphe

## DEV13.7.1

- Profils avion dans Plus.
- Sélecteur avion dans Log de nav.
- TAS, altitude défaut et mise à jour du vent déplacés dans Log de nav.
- METAR/TAF bruts uniquement dans Log de nav.
- Ajout des fréquences radio/ATIS/AFIS/TWR/APP/FIS disponibles depuis les données internes.
- Dégagement renseignable dans Planification.
- Bandeau attribution carte masqué.
- Pas de SUP AIP automatique dans cette version.

## DEV13.7.2

METAR/TAF nearest fallback :
- recherche d'abord l'aérodrome demandé
- si absent, recherche les stations proches
- affiche uniquement `Station météo à X km` quand une station voisine est utilisée
- ne rajoute pas de ligne inutile pour les stations exactes
- cache METAR/TAF isolé en v3

## DEV13.7.3

Hotfix suivi GPS :
- prochain point basé sur le segment GPS le plus proche
- suppression de la distance placeholder 31.2 NM
- suppression des badges mock/dev sur l'écran Suivi
- cap vers prochain point calculé réellement
- ETA et ETE destination calculés quand GS et position sont disponibles
- zone suivante affichée en placeholder non trompeur
- garde-fou anti réponse obsolète METAR/TAF
- chargement METAR/TAF automatique avec cache

## DEV13.7.4

Cleanup + devis carburant :
- carte Zones supprimée de Plus
- ajout d'un devis carburant dédié dans Log de nav
- affichage en minutes avec correspondance litres
- roulage départ 8 min par défaut
- arrivée 12 min par défaut
- arrivée déroutement 12 min par défaut
- réserve finale modifiable en minutes
- marge modifiable en minutes
- vol à bord modifiable en litres
- déroutement calculé destination vers dégagement
- total minimum, vol réglementaire, vol à bord et heure limite

## DEV13.7.5

Fuel compact + title release :
- titre d'onglet mis à jour avec la version DEV13.7.5
- description HTML mise à jour
- devis carburant rendu plus compact et premium
- roulage départ, arrivée et arrivée déroutement en valeurs fixes non éditables
- marge saisie en litres
- libellé `Vol à bord` remplacé par `Carburant embarqué`
- seuls restent éditables : réserve finale, marge, carburant embarqué
