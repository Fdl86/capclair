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

## DEV13.7.6

Planning first + fuel and zones cleanup :
- ouverture directe sur Planification
- suppression de l'entrée Accueil dans la navigation basse
- bouton Nouvelle nav dans Planification
- reset route sur une route propre LFBI - LFEY sans waypoint intermédiaire
- cap GPS live en option dans Suivi
- frise zones : couleur active appliquée aux zones réellement traversées à l'altitude prévue
- frise zones : couleur doute dédiée en cas d'incertitude
- suppression de la carte Règle d'affichage
- devis carburant : Total minimum renommé Total nécessaire
- Total nécessaire placé avant Marge
- Marge en litres uniquement
- suppression de Carburant embarqué
- ajout Carburant à prévoir calculé automatiquement
- titre d'onglet mis à jour DEV13.7.6

## DEV13.7.7

Log UI cleanup :
- suppression des badges TAS et conso redondants dans le sélecteur avion
- suppression du bouton Maj vent du bandeau supérieur du log
- Maj vent déplacé dans le tableau de navigation
- suppression des pavés fixes du devis carburant
- entête `Consommation horaire / minute`
- Total nécessaire affiché avant Marge
- Carburant à prévoir calculé automatiquement
- Autonomie prévue calculée depuis le carburant à prévoir
- Reste capacité utile affiché en bas du devis carburant
- titre d'onglet mis à jour

## DEV13.7.9

Version finale devis carburant :
- suppression de Fond topo dans Planification
- suppression des tuiles fixes roulage, arrivée et arrivée déroutement
- Total nécessaire puis Marge puis Emport carburant
- Emport carburant = Total nécessaire + Marge, arrondi au litre supérieur
- Autonomie calculée depuis l'emport carburant
- suppression des termes non validés : Minimum arrondi, Vol réglementaire, Carburant embarqué, Carburant à prévoir
- Reste capacité utile calculé depuis la capacité utile avion et l'emport carburant
- titre d'onglet mis à jour

## DEV13.7.10

Hotfix précision aéro :
- validation du libellé `Autonomie actuelle`
- autonomie actuelle calculée depuis l'emport carburant
- suppression définitive du champ `regulatoryLine` inutilisé
- suppression de `regulatory` dans le type `FuelPlanSummary`
- Suivi : `Cap point` remplacé par `Cap magnétique`
- Suivi : le cap magnétique réutilise `capCorrige` de la branche active du log
- Suivi : suppression du placeholder `Prochaine zone`
- Profil avion : `Essence inutilisable` remplacé par `Carburant inutilisable`
- Log de nav : `computeFuelPlan` mémoïsé avec `useMemo`
- titre d'onglet mis à jour

## DEV13.7.11

Hotfix urgent fond topographique :
- rétablit la possibilité d'activer / désactiver le fond topographique dans Planification
- conserve le bouton `Fond topo`
- supprime uniquement le libellé ON/OFF visible dans le bouton
- retire la règle CSS qui masquait le contrôle
- titre d'onglet mis à jour

## DEV13.7.12

Hotfix toggle topo :
- restaure le toggle Fond topo dans sa version précédente
- conserve la possibilité ON/OFF directement dans le bouton
- supprime uniquement la mention redondante Fond topo ON/OFF dans la barre d'information de carte
- conserve Carte aéro openAIP dans la barre d'information
- titre d'onglet mis à jour

## DEV13.7.13

Hotfix suivi GPS :
- acquisition GPS plus explicite avec carte `Recherche position GPS...`
- première position demandée via `getCurrentPosition` puis suivi continu via `watchPosition`
- `watchPosition` conserve le suivi sur erreur temporaire non bloquante
- Wake Lock écran pendant GPS actif ou simulation lorsque le navigateur le permet
- badge `Écran actif` / `Écran veille?`
- carte en auto-follow dès que GPS ou simulation est actif
- bouton Centrer conservé comme recentrage manuel
- icône avion remplace le triangle
- orientation avion basée sur la trajectoire GPS réelle (`track`) si vitesse >= 5 kt
- fallback sur la dernière orientation fiable si `track` absent ou vitesse faible
- pas de changement Planification / Log / Carburant / Frise zones
- titre d'onglet mis à jour

## DEV13.7.14

Hotfix GPS cleanup + optimisation CSS :
- suppression du bouton `Cap live`
- suppression de la carte `Cap GPS live`
- conservation de `TRK GPS` comme trajectoire réelle issue du GPS
- conservation de l'orientation avion via `track` GPS en interne
- badges Suivi ramenés à 3 colonnes cohérentes
- carte Suivi rendue plus dominante
- métriques, badges, jauge d'écart route et signal GPS légèrement premiumisés
- nettoyage CSS des blocs morts `next-zone-card`, `live-heading-card`, `fuel-fixed-grid`, `fuel-fixed-pill`, `map-attribution`
- déduplication du bloc `.ol-map`
- pas de changement Planification / Log / Carburant / Frise zones / moteur GPS
- titre d'onglet mis à jour

## DEV13.7.15

Hotfix icône avion :
- taille de base de l'avion réduite
- scale avion adapté au zoom carte
- zoom éloigné : avion réduit et non envahissant
- zoom proche : avion plus lisible
- orientation avion conservée via TRK GPS
- fallback orientation basse vitesse conservé
- mise à jour de l'icône sur changement de zoom via `change:resolution`
- throttling via `requestAnimationFrame` pour éviter les mises à jour excessives
- réutilisation de la feature avion au lieu de clear/recreate à chaque position
- pas de changement moteur GPS / Log / carburant / zones
- titre d'onglet mis à jour

## DEV13.7.16

Hotfix GPS hardening + reprise DEV13.7.15 :
- intègre les modifications DEV13.7.15 sur l'icône avion et le scale selon zoom
- correction stale closure sur `status` via `statusRef` et `updateStatus`
- suppression de `getCurrentPosition` pour éviter le double premier fix
- `watchPosition` devient le flux GPS unique, avec `maximumAge: 0`
- messages GPS cohérents selon le vrai statut courant
- durcissement `crossTrackError` avec clamp `asin` / `acos`
- fallback sûr si une position GPS produit une valeur non finie
- suppression du `useMemo` inutile pour `traceForMap`
- `lastSignalAt` passe en ref pour éviter un re-render GPS inutile
- vérification du libellé `Carburant inutilisable`
- conserve auto-follow, Wake Lock, TRK GPS et orientation avion
- pas de modification carburant / zones / log de nav
- titre d'onglet mis à jour

## DEV13.7.17

Modification log de navigation :
- suppression de la colonne `ETA UTC`
- insertion de la colonne `NM` entre `GS` et les temps
- ajout de la colonne `TSV` avant `TAV`
- `TSV` = temps sans vent, calculé par distance x FB, avec FB = 60 / TAS
- renommage `ETE` en `TAV`
- `TAV` = temps avec vent, basé sur la vitesse sol corrigée du vent effectif
- total `NM`, total `TSV` et total `TAV` affichés dans la ligne TOTAL
- largeur de tableau navlog ajustée
- pas de modification GPS / avion / carburant / zones
- reprise de la base DEV13.7.16 avec les corrections GPS hardening et aircraft zoom scale
- titre d'onglet mis à jour

## DEV13.7.18

Optimisation trace GPS :
- échantillonnage de la trace sauvegardée à 1 point toutes les 3 secondes
- position live séparée de la trace sauvegardée
- avion, TRK GPS, GS, altitude, écart route et auto-follow restent alimentés par la position live
- première position forcée dans la trace
- dernière position live ajoutée à la sauvegarde si elle n'était pas déjà échantillonnée
- plafond trace porté à 4200 points
- 4200 points à 3 secondes = environ 3 h 30 de navigation enregistrable
- distance trace calculée sur la trace finale sauvegardée
- conserve DEV13.7.17 navlog TSV / TAV
- conserve DEV13.7.16 GPS hardening
- conserve DEV13.7.15 aircraft zoom scale
- pas de modification log / carburant / zones / carte
- titre d'onglet mis à jour

## DEV13.7.19

GPS live + insertion waypoint :
- position live non bloquée par le filtre anti-bruit de trace
- ajout d'un filtre léger `isPlausibleGpsPosition` pour rejeter uniquement les positions invalides ou trop imprécises
- trace sauvegardée conservée à 1 point toutes les 3 secondes
- plafond 4200 points conservé
- progression de branche renforcée avec `getProgressiveCrossTrackError`
- pas de retour automatique sur une branche précédente en suivi
- saut de branche limité pour éviter les retours incohérents près d'un point tournant
- insertion waypoint sur la branche la plus proche du clic carte
- projection locale du clic sur chaque segment de route pour trouver le meilleur index
- `handleAddWaypoint` stabilisé via `useCallback`
- `trace` vide de planification stabilisée via constante `EMPTY_TRACE`
- initialisation OpenLayers protégée contre les callbacks instables
- conserve DEV13.7.18 trace 3s
- conserve DEV13.7.17 navlog TSV / TAV
- conserve DEV13.7.16 GPS hardening
- conserve DEV13.7.15 aircraft zoom scale
- pas de modification carburant / zones / météo / proxy
- titre d'onglet mis à jour

## DEV13.7.20

Simulation + nettoyage carte :
- simulation sans rebouclage automatique après l'arrivée
- simulation limitée à un parcours départ vers arrivée
- arrivée simulation maintenue sur le dernier point
- état `SIM terminée` ajouté
- bouton `Arrêter et sauvegarder` conservé à la fin de simulation
- aucune sauvegarde automatique forcée
- proxy tuiles openAIP : placeholder transparent renvoyé en HTTP 200
- proxy tuiles openAIP : clé openAIP retirée de la query amont
- clé openAIP conservée uniquement en en-tête proxy
- MapFallbackNotice câblée sur `tileloaderror` openAIP
- message de repli carte clarifié
- suppression du `console.warn` résiduel dans `windAloftClient`
- conserve DEV13.7.19 GPS live + waypoint hardening
- conserve DEV13.7.18 trace 3s
- conserve DEV13.7.17 navlog TSV / TAV
- conserve DEV13.7.16 GPS hardening
- conserve DEV13.7.15 aircraft zoom scale
- pas de modification carburant / zones / log / GPS réel
- titre d'onglet mis à jour

## DEV13.8.0

Fond OACI 1/500k :
- ajout du fond aéronautique OACI 1/500 000 officiel IGN / SIA via Géoplateforme
- nouvelle source `src/mapSources/ignOaciVfrSource.ts`
- couche `GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI`
- WMTS Géoplateforme privé `data.geopf.fr/private/wmts`
- clé publique transitoire `ign_scan_ws`, sans secret Cloudflare
- source OpenLayers `XYZ` simple, projection PM / EPSG:3857
- proxy Cloudflare same-origin `/api/ign/oaci/{z}/{x}/{y}.jpg`
- cache proxy ajouté pour les tuiles OACI
- placeholder transparent HTTP 200 en cas de tuile manquante
- bascule exclusive `Libre + openAIP` / `OACI 1/500k`
- en mode OACI, le fond libre et l'overlay openAIP sont coupés pour éviter la double symbologie
- choix de fond partagé entre Planification et Suivi via localStorage
- attribution `© IGN / SIA - OACI-VFR`
- note licence ajoutée dans le code : données SCAN-OACI non libres, clé transitoire, voie pérenne via cartes.gouv.fr
- conserve DEV13.7.20 simulation sans boucle et map cleanup
- conserve DEV13.7.19 GPS live + waypoint hardening
- pas de modification GPS réel / log / carburant / zones
- titre d'onglet mis à jour

## DEV13.8.1

Hotfix vue carte après ajout waypoint :
- ajout waypoint sans dézoom automatique
- la vue carte est conservée quand la route gagne un point
- le fit route reste actif au chargement initial et lors des modifications non liées à un ajout de point
- aucune modification du moteur GPS
- aucune modification du fond OACI
- aucune modification du log, carburant, météo ou zones
- conserve DEV13.8.0 OACI 1/500k
- titre d'onglet mis à jour
