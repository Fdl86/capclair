# CAP CLAIR WEB13.23.0 - ROBUSTESSE

CAP CLAIR est une application VFR mobile-first en Vite, React, TypeScript et OpenLayers, déployée comme PWA sur Cloudflare Pages.

Cette livraison reprend la base WEB13.21.0 avec import GPX et intègre les évolutions web-compatibles de DEV15.2.4. Elle ne contient aucun service Android natif, Capacitor, plugin natif, signature APK ou workflow Android.

## WEB13.23.0 - Robustesse

- détection exacte des intersections entre la route et les polygones d’espaces aériens, y compris les zones étroites ;
- segmentation unifiée des traces pour le résumé, le Replay et l’export GPX ;
- exclusion des sauts de distance lors des coupures GPS ;
- seul le dernier point GPS validé peut être sauvegardé ;
- nouveau segment après une resynchronisation GPS forcée ;
- protection des traces non sauvegardées après simulation ou erreur de stockage ;
- ajout incrémental de la trace OpenLayers pendant un enregistrement normal ;
- décimation progressive des vols longs au lieu de supprimer brutalement leur début ;
- import GPX renforcé, limité et optimisé pour les fichiers volumineux ;
- validation des traces chargées depuis IndexedDB et rejet isolé des données corrompues ;
- suppression IndexedDB vérifiée ;
- réponses météo obsolètes ignorées et heure d’analyse météo séparée de l’heure prévue de départ ;
- changement de départ ou d’arrivée sans perte des points intermédiaires ;
- identifiant unique pour chaque nouvelle préparation de navigation ;
- vitesse globale clarifiée comme vitesse sol moyenne ;
- moteur PDF, Replay et catalogue aéronautique mis en cache à l’usage plutôt que dans le précache initial ;
- 17 tests automatisés couvrant PDF, vent, zones, traces, GPX et routes.

## Correctifs hérités de WEB13.22.2

- Corrige le débordement initial de Mes traces sur mobile avant le premier passage dans Replay.
- Ajoute un bouton Retour explicite dans Mes traces.
- Réserve une hauteur suffisante au titre, à la source et au nom de fichier dans le bandeau Replay.
- Rend le Replay paysage mobile intégralement accessible, sans zone coupée par le navigateur.

- correction de la mise à jour du vent sur toutes les branches lorsque plusieurs branches utilisent la même cellule météo mise en cache ;
- nouvelle version de cache météo et nettoyage compatible des anciennes clés ;
- sur écran web large, tuiles d’information, profil d’altitude et vitesses Replay placés sous la carte ;
- disposition mobile portrait et paysage compact conservée.


## Export PDF du log de navigation

- le bouton `Exporter PDF` génère un véritable fichier PDF local ;
- aucun envoi serveur ;
- gabarit A4 paysage validé V5 ;
- téléchargement direct dans le navigateur ;
- le moteur `pdf-lib` est chargé uniquement lors de la génération ;
- nom de fichier construit avec le départ, l'arrivée et la date ;
- distances arrondies au NM entier le plus proche ;
- colonnes HE, HR et Conso laissées vides pour le pilote ;
- radios, QNH, Zmini, ETA et réservoirs laissés vides ;
- arrivée déroutement fixée à 12 minutes ;
- totaux distance, TSV et TAV centrés ;
- bordures REPERE, TAV et TOTAL renforcées ;
- première version limitée à 8 branches avec avertissement au-delà ;
- gabarit PDF inclus dans le cache PWA.

## Suivi GPS web et enregistrement

- état de position GPS séparé de l'état d'enregistrement ;
- statut GPS visible directement sur la carte ;
- bouton renommé `Démarrer l'enregistrement` ;
- chronomètre REC en plein écran ;
- bouton d'enregistrement dans la colonne des contrôles plein écran ;
- arrêt possible pendant l'acquisition sans créer de fausse trace ;
- résumé principal plus compact : vitesse sol, altitude GPS, route et précision ;
- prochaine étape regroupée avec distance, cap magnétique et ETA ;
- détails GPS et diagnostics repliés dans un panneau dédié ;
- Wake Lock navigateur conservé pendant l'enregistrement lorsque disponible ;
- le GPS web reste un fallback navigateur et ne remplace pas le GPS natif Android.

## Replay

- mise en page paysage densifiée ;
- carte pleine hauteur en paysage avec profil dans la colonne latérale ;
- distance finale affichée correctement à la fin du Replay ;
- trace réelle rose avec contour sombre pour rester visible sur les fonds openAIP et 500k ;
- lecture, pause, x1, x5, x10 et x20 ;
- profil d'altitude synchronisé ;
- comparaison avec la route prévue lorsqu'elle est enregistrée ;
- fonctionnement conservé pour les GPX importés avec ou sans chronologie complète.

## Import GPX

- bouton `Importer GPX` dans `Mes traces` ;
- lecture locale avec les API XML natives du navigateur ;
- prise en charge de `trk`, `trkseg`, `trkpt`, `rte` et `rtept` ;
- conservation des segments, coordonnées, altitudes et timestamps disponibles ;
- stockage IndexedDB avec repli localStorage ;
- ouverture automatique dans Replay ;
- aucun horaire ou vitesse artificielle pour les GPX non horodatés.

## Navigation et carburant

- départ, arrivée et dégagement vides à la première utilisation ;
- `Nouvelle nav` vide réellement la navigation ;
- cohérence entre les champs aérodromes et la route calculée ;
- TAS du log synchronisée avec le profil avion ;
- capacité totale réservoirs séparée du carburant inutilisable ;
- alerte en cas de capacité carburant insuffisante ;
- calculs bloqués lorsque la route est incomplète ;
- recalculs terrain et espaces aériens limités aux changements utiles.

## Traces et exports

- stockage principal IndexedDB ;
- sauvegarde et suppression vérifiées ;
- export GPX et JSON ;
- segments GPX séparés lors des coupures ;
- route prévue enregistrée avec les nouvelles traces ;
- trace réelle plus visible dans Suivi et Replay.

## Compatibilité web

- aucun dossier Android ou iOS ;
- aucune dépendance Capacitor ;
- aucun plugin NativeGps ou NativeTraceExport ;
- fonctions Cloudflare Pages conservées ;
- PWA compatible Chrome, Firefox et Safari selon les capacités du navigateur ;
- build avec `npm run build` ;
- tests avec `npm test`.

## Installation avec GitHub Desktop

1. Sélectionner la branche web/PWA concernée.
2. Vider le dossier local en conservant uniquement `.git`.
3. Copier le contenu complet du ZIP dans le dossier.
4. Vérifier `WEB13.23.0` dans la chip.
5. Vérifier `CAP CLAIR WEB13.23.0 - ROBUSTESSE` dans le titre de l'onglet.
6. Commit et push via GitHub Desktop.

Commit recommandé :

```text
main: port DEV15.2.4 PDF and tracking UX to web PWA
```
