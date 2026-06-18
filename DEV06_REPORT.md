# CAP CLAIR DEV06 - LFCA / LFOD Saumur / LFOT Tours

## Objectif

Changer la navigation de test pour mieux contrôler la précision du calage sur plusieurs aérodromes visibles :
- LFCA Châtellerault
- LFOD Saumur Saint-Florent
- LFOT Tours Val de Loire

## Pourquoi ce changement

La DEV05 a corrigé le nodata noir, mais la carte Nord-Ouest reste naturellement en limite sud autour de LFCA. La bande beige visible sous LFCA n'est plus une erreur noire de tuile : elle correspond au bord / hors couverture du tilepack Nord-Ouest actuel. Pour une couverture propre de LFCA et du sud de Poitiers, il faudra intégrer la carte Sud-Ouest ou gérer la jonction NO/SO.

## Modifications

- Route mock remplacée par `LFCA - LFOD Saumur - LFOT Tours`.
- Coordonnées LFCA conservées sur l'ARP SIA.
- Coordonnées LFOD ajoutées : 47°15'24"N, 000°06'49"W.
- Coordonnées LFOT conservées sur l'ARP SIA.
- Clé localStorage changée en `capclair.activeRoute.dev06.lfcaSaumurTours`.
- Centre initial ajusté sur l'axe LFCA / Saumur / Tours.
- Zones prototype masquées en Planification pour faciliter le contrôle du fond.
- Label carte passé en `Données DEV06 LFOD`.
- Tilepack inchangé par rapport à DEV05 : tuiles Nord-Ouest z7-z9 avec nodata noir corrigé.

## Tests attendus

Dans Planification :
1. Vérifier que la route affiche `LFCA - LFOD Saumur - LFOT Tours`.
2. Vérifier LFOD sur la carte SIA.
3. Vérifier LFOT sur la carte SIA.
4. Constater que LFCA reste en limite sud de feuille Nord-Ouest.
5. Confirmer si le calage général semble cohérent entre LFCA / LFOD / LFOT.

## Limites connues

- Le tilepack z7-z9 reste trop peu défini pour une validation fine.
- LFCA est en bordure sud de la carte Nord-Ouest.
- Pour une vraie couverture, la prochaine étape devra traiter la carte Sud-Ouest et tester la jonction Nord-Ouest / Sud-Ouest.

## Avertissement

Test technique DEV, non officiel, non réglementaire, non utilisable en navigation.
