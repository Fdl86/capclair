# CAP CLAIR WEB13.27.1 - SUP AIP TRA HOTFIX BETA

CAP CLAIR est une application VFR mobile-first en Vite, React, TypeScript et OpenLayers, déployée comme PWA sur Cloudflare Pages.

Cette livraison remplace le premier extracteur par un Parser V2 layout-aware, tout en conservant l'actualisation automatique gratuite des SUP AIP Métropole depuis les publications officielles du SIA. Elle ne contient aucun service Android natif, Capacitor, plugin natif, signature APK ou workflow Android.


## WEB13.27.1 - SUP AIP TRA HOTFIX BETA

- correction des codes TRA et TSA compacts comme `TRA90NL`, `TRA90NH` et `TRA90NLZ` ;
- lecture des tableaux SIA à deux colonnes lorsque les deux noms de zones sont réunis dans le même bloc de titre ;
- restauration du SUP AIP 023/26 avec les deux zones `TRA90NL` et `TRA90NH` ;
- limites verticales associées correctement : `FL195 - FL275` et `FL305 - FL335` ;
- exclusion des FBZ utilisées uniquement pour le dépôt de plan de vol afin de ne pas les afficher comme des zones opérationnelles ;
- ajout de deux tests de non-régression dédiés à ce format ;
- aucun filtrage vertical : les TRA restent visibles sur la route même si elles sont situées très au-dessus de l'altitude prévue.

## WEB13.27.0 - SUP AIP PARSER V2 BETA

- Parser V2 fondé sur la position des blocs de texte dans chaque page PDF et non plus uniquement sur le texte linéaire ;
- lecture renforcée des tableaux multi-colonnes, tableaux par lignes, cercles, polygones et descriptions d'arcs ;
- contrôle des 110 publications listées par le SIA, y compris les publications non spatiales, afin qu'aucun PDF ne soit exclu uniquement à cause de son titre ;
- cache par publication : les PDF inchangés sont réutilisés après le premier passage complet ;
- extraction systématique des limites verticales `SFC`, `GND`, `ASFC`, `AGL`, `AMSL`, `FL` et formes composées ;
- la fiche cartographique affiche directement le plancher et le plafond en évidence ;
- suppression définitive de l'affichage ambigu `À vérifier - À vérifier` ;
- lorsqu'une verticale ne peut réellement pas être extraite, affichage explicite `Limites verticales non extraites - consulter le PDF SIA` ;
- compteur GitHub détaillé : PDF contrôlés, publications non spatiales, SUP complets, partiels, non cartographiés, géométries produites et verticales manquantes ;
- liste diagnostique nominative avec le nombre de géométries extraites pour chaque publication incomplète ;
- prise en charge renforcée des très gros SUP comportant plusieurs dizaines de zones et des dénominations HIGH/LOW partageant les mêmes limites latérales ;
- nettoyage des titres HTML et des caractères échappés provenant de la liste SIA ;
- maintien des identifiants uniques et stables introduits par WEB13.26.1 ;
- aucun filtrage vertical : une zone reste toujours visible lorsqu'elle répond au filtre géographique choisi.

Le parseur reste volontairement conservateur. Une limite dépendant d'une frontière, d'un littoral ou d'un autre espace aérien n'est pas inventée. La publication reste alors signalée comme partielle ou non cartographiée avec accès au PDF officiel.

## WEB13.26.1 - SUP AIP ID HOTFIX

- correctif de génération des identifiants pour les SUP contenant plusieurs zones aux noms longs ou répétés, notamment Romorantin ;
- identifiants uniques et stables avec empreinte géométrique en cas de collision ;
- contrôle GitHub renforcé : échec si un PDF attendu n'est ni téléchargé ni réutilisé ;
- bilan détaillé directement dans chaque exécution GitHub Actions.

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
5. Vérifier `WEB13.27.1` dans la chip et `CAP CLAIR WEB13.27.1 - SUP AIP TRA HOTFIX BETA` dans le titre de l'onglet.

Commit recommandé :

```text
main: add SUP AIP Parser V2
```

## Activation GitHub Actions - une seule fois

1. Ouvrir le dépôt dans le navigateur sur GitHub.
2. Aller dans `Settings > Actions > General`.
3. Dans `Workflow permissions`, sélectionner `Read and write permissions`, puis enregistrer.
4. Ouvrir l'onglet `Actions` du dépôt.
5. Sélectionner `Update SUP AIP data`.
6. Cliquer `Run workflow`, choisir la branche `main`, puis confirmer.
7. Attendre que le run passe au vert.
8. GitHub crée alors automatiquement un commit `data: actualisation automatique SUP AIP Parser V2`, ce qui déclenche le redéploiement Cloudflare Pages.

Après ce premier lancement, le workflow s'exécute seul toutes les 6 heures. Dans `Plus > SUP AIP`, le statut doit passer de `À INITIALISER` à `ACTIVE` après le redéploiement.
