# CAP CLAIR WEB13.26.0 - SUP AIP AUTO BETA

CAP CLAIR est une application VFR mobile-first en Vite, React, TypeScript et OpenLayers, déployée comme PWA sur Cloudflare Pages.

Cette livraison ajoute l'actualisation automatique gratuite des SUP AIP Métropole depuis les publications officielles du SIA. Elle ne contient aucun service Android natif, Capacitor, plugin natif, signature APK ou workflow Android.

## WEB13.26.0 - SUP AIP AUTO BETA

- workflow GitHub automatique toutes les 6 heures et lancement manuel de contrôle disponible ;
- lecture de la liste officielle SIA et téléchargement uniquement des publications spatiales nouvelles ou modifiées ;
- extraction conservatrice des coordonnées contenues dans les PDF et génération GeoJSON ;
- conservation de la dernière base valide si la source est vide, inaccessible ou si le nombre de zones chute anormalement ;
- fichier de statut avec date de génération, nombre de publications, nombre de zones et nombre de SUP non cartographiés ;
- signalement explicite des publications dont la géométrie ne peut pas être reconstruite avec une confiance suffisante ;
- recharge des données au lancement de la couche, au retour au premier plan et toutes les 30 minutes ;
- cache PWA `NetworkFirst` pour obtenir la nouvelle base tout en conservant un repli hors ligne ;
- modes `OFF`, `ROUTE` et `TOUS`, avec distances réglables dans `Plus > SUP AIP` ;
- aucun SUP AIP n'est jamais masqué selon l'altitude prévue ou GPS ;
- base initiale de 4 zones incluse jusqu'au premier lancement réussi du workflow.

La génération automatique reste en BETA. Les publications non cartographiées sont indiquées dans l'application et ne sont jamais considérées comme absentes. Le PDF officiel SIA, SOFIA et les NOTAM restent les références avant le vol.

## WEB13.25.0 - SUP AIP ROUTE BETA

- trois modes d'affichage `OFF`, `ROUTE` et `TOUS`, avec passage rapide depuis le bouton de carte ;
- mode `ROUTE` utilisé par défaut ;
- corridor horizontal réglable de 5 à 50 NM autour de tous les segments de la navigation ;
- rayon distinct de 5 à 50 NM autour du départ et de l'arrivée ;
- réglages persistants dans `Plus > SUP AIP` ;
- aucune zone n'est jamais masquée en fonction de l'altitude prévue ou GPS ;
- compteur des zones retenues par le filtre de route dans Planification, Suivi et Replay ;
- en Replay, la route planifiée est utilisée si elle existe, sinon la trace réelle sert de référence ;
- couverture pilote toujours limitée aux 4 géométries de validation de la BETA.

## WEB13.24.0 - SUP AIP BETA

- nouvelle surimpression cartographique `SUP AIP BETA`, désactivable et mémorisée localement ;
- couverture pilote volontairement partielle : 4 géométries issues de 3 SUP AIP officiels du SIA ;
- prise en charge des cercles, polygones et arcs publiés ;
- distinction visuelle entre créneau publié en cours, publication en vigueur, activation à confirmer par NOTAM et publication à venir ;
- appui sur une zone pour afficher validité, limites verticales, activation, fréquence et lien vers le PDF SIA officiel ;
- disponible dans Planification, Suivi et Replay ;
- données GeoJSON embarquées et mises en cache hors ligne ;
- avertissement permanent : cette couche BETA ne remplace jamais la consultation SIA, SOFIA et NOTAM.

La couche est un prototype de validation d'interface et de géométrie. Elle n'est pas exhaustive et ne doit pas être utilisée seule pour préparer ou conduire un vol.

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
4. Commit et push via GitHub Desktop sur `main`.
5. Vérifier `WEB13.26.0` dans la chip et `CAP CLAIR WEB13.26.0 - SUP AIP AUTO BETA` dans le titre de l'onglet.

Commit recommandé :

```text
main: add automatic SUP AIP updates
```

## Activation GitHub Actions - une seule fois

1. Ouvrir le dépôt dans le navigateur sur GitHub.
2. Aller dans `Settings > Actions > General`.
3. Dans `Workflow permissions`, sélectionner `Read and write permissions`, puis enregistrer.
4. Ouvrir l'onglet `Actions` du dépôt.
5. Sélectionner `Update SUP AIP data`.
6. Cliquer `Run workflow`, choisir la branche `main`, puis confirmer.
7. Attendre que le run passe au vert.
8. GitHub crée alors automatiquement un commit `data: actualisation automatique SUP AIP`, ce qui déclenche le redéploiement Cloudflare Pages.

Après ce premier lancement, le workflow s'exécute seul toutes les 6 heures. Dans `Plus > SUP AIP`, le statut doit passer de `À INITIALISER` à `ACTIVE` après le redéploiement.
