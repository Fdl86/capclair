# CAP CLAIR WEB13.30.1 - NOTAM PIB BETA

CAP CLAIR est une application VFR mobile-first en Vite, React, TypeScript et OpenLayers, déployée comme PWA sur Cloudflare Pages.


## WEB13.30.1 - NOTAM PIB BETA

- nouvelle section `Plus > NOTAM / PIB` avec import local d'un PDF SOFIA ou collage du contenu textuel ;
- extraction PDF locale avec PDF.js, sans envoi vers un serveur et sans OCR automatique ;
- détection du trajet, des dégagements, de la date, de l'heure, des niveaux et du corridor indiqués dans le PIB ;
- analyse autorisée avec ou sans trajet CAP CLAIR, avec avertissement en cas de trajet différent et aucune fusion silencieuse ;
- possibilité d'utiliser le départ, l'arrivée, l'heure et le premier dégagement détectés pour créer le trajet CAP CLAIR ;
- parsing des champs Q, A, B/C ou DU/AU, D, E, F et G, conservation du texte brut et prise en charge des champs multilignes ;
- détection et normalisation des références SUP AIP, puis contrôle croisé avec le manifest, les statuts, les publications non cartographiées et le GeoJSON CAP CLAIR ;
- couche cartographique `NOTAM / PIB BETA` distincte et désactivée par défaut ;
- priorité aux géométries SUP AIP de la base CAP CLAIR, puis aux polygones et points explicitement extraits du champ E ;
- cercles Q affichés uniquement comme `Zone d'influence NOTAM approximative`, avec contour pointillé et avertissement ;
- stockage local du dernier briefing uniquement, avec empreinte SHA-256, remplacement automatique et suppression immédiate ;
- chargement dynamique du moteur PDF et mise en cache PWA après le premier usage ;
- fixture réelle SOFIA LFBI > LFOU avec dégagements LFJB/LFCT : 9 pages, 36 NOTAM et 3 références SUP AIP ;
- 42 tests Vitest, 27 tests Python SUP AIP et build de production validés.

Cette fonction reste une aide visuelle BETA. Un PIB n'est jamais présenté comme exhaustif et CAP CLAIR ne remplace ni SOFIA, ni le SIA, ni la préparation réglementaire.

## WEB13.29.2 - SUP AIP ANTI-RÉGRESSION BETA

- correction de la régression qui classait à tort les zones temporaires nommées `ZRT LF-R...` ou `ZRT ... LF-R17 ...` comme de simples références permanentes ;
- restauration vérifiée sur les PDF officiels du SUP AIP 101/26 : 20/20 géométries ;
- restauration vérifiée sur le PDF officiel du SUP AIP 077/26 : 12 géométries opérationnelles ;
- comparaison publication par publication avec la dernière base valide avant toute écriture ;
- rapprochement des zones par identifiant, nom canonique, géométrie et limites verticales afin de supporter les changements mineurs de libellé ;
- restauration automatique de chaque ancienne zone opérationnelle qui disparaît du résultat candidat ;
- conservation distincte des zones superposées partageant la même géométrie mais pas les mêmes verticales ;
- blocage complet du workflow si une chute de géométries ne peut pas être compensée ;
- aucune écriture des fichiers de données et aucun commit dans ce cas ;
- nouveau statut `complet avec repli`, séparé des publications réellement partielles ;
- bilan GitHub avec régressions compensées, zones restaurées et compteur obligatoire de régressions non résolues à zéro ;
- affichage de ces compteurs dans `Plus > SUP AIP` ;
- passage aux actions GitHub Node 24 actuelles `actions/checkout@v6` et `actions/setup-python@v6` ;
- les fonctions de la WEB13.29.1, la persistance du zoom et le filtre d'altitude sont conservés.

Le parseur reste BETA et ne remplace jamais la consultation du SIA, de SOFIA et des NOTAM.

## WEB13.28.0 - SUP AIP ALTITUDE FILTER BETA

- curseur `Plus > SUP AIP > Plafond d'affichage`, de `FL055` à `FL195`, avec position `TOUTES` ;
- valeur par défaut `FL115` ;
- une zone n'est masquée que si son plancher absolu connu est strictement supérieur au plafond choisi ;
- les zones `SFC`, `GND`, dont le plancher est inférieur au plafond, ou qui traversent le plafond restent affichées ;
- les limites `AGL`, `ASFC`, non extraites ou ambiguës restent toujours affichées par prudence ;
- le badge cartographique indique le plafond sélectionné et le nombre réellement visible ;
- diagnostic automatique des causes d'incomplétude dans GitHub Actions et dans `Plus > SUP AIP` ;
- aucune modification des données `public/data/supaip-*` dans le patch afin de conserver la base générée automatiquement par GitHub.

## WEB13.27.2 - SUP AIP COLUMN TABLE HOTFIX BETA

- correction des tableaux SIA dont chaque zone, ses coordonnées et sa limite verticale sont réparties entre deux blocs PDF superposés ;
- restauration complète du SUP AIP 207/25 avec 16 zones officielles LFDB11 à LFDB7 ;
- restauration des zones autour de Belle-Ile, de l'Ile d'Yeu et des Sables d'Olonne ;
- limites verticales `SFC - UNL` affichées pour les 16 zones ;
- les exclusions locales de Belle-Ile, de l'Ile d'Yeu et des Sables d'Olonne restent signalées comme non découpées : le contour extérieur est affiché par prudence ;
- ajout d'un parseur générique pour les cellules en colonnes, utile aux autres SUP AIP de même format ;
- 13 tests Python du parseur et tests de l'application validés.


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

Cette livraison est un zip complet WEB13.30.1.

1. Dans GitHub Desktop, ouvrir la branche web `main` et utiliser `Pull origin` s'il est proposé.
2. Fermer CAP CLAIR dans le navigateur pendant le remplacement local.
3. Dans le dossier local du dépôt, supprimer tout le contenu en conservant uniquement le dossier caché `.git`.
4. Copier tout le contenu du zip WEB13.30.1 à la racine du dépôt.
5. Dans GitHub Desktop, vérifier les changements, créer le commit puis utiliser `Push origin` sur `main`.
6. Après le déploiement Cloudflare Pages, vérifier `WEB13.30.1` dans la chip visible et dans le titre de l'onglet.
7. Contrôler dans `Plus > NOTAM / PIB` l'import du PDF SOFIA et laisser la couche cartographique désactivée avant le premier choix explicite.
8. Le workflow SUP AIP existant est conservé avec `actions/checkout@v6` et `actions/setup-python@v6`.
9. Lors du prochain commit automatique du robot SUP AIP, utiliser ensuite `Pull origin` dans GitHub Desktop.

Commit recommandé :

```text
main: fix WEB13.30.1 Cloudflare PDF.js build
```
