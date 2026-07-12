# CAP CLAIR WEB13.21.0 - IMPORT GPX

CAP CLAIR est une application VFR mobile-first en Vite, React, TypeScript et OpenLayers, déployée comme PWA sur Cloudflare Pages.

Cette version ajoute l’import local de fichiers GPX à la base WEB13.20.0 Replay UX, sans importer de service Android, Capacitor, plugin natif, signature APK ou workflow Android.

## Import GPX

- bouton `Importer GPX` dans `Mes traces` ;
- lecture locale avec les API XML natives du navigateur ;
- aucun envoi serveur ;
- prise en charge des traces `trk/trkseg/trkpt` ;
- prise en charge de secours des routes `rte/rtept` ;
- conservation des segments, coordonnées, altitudes, timestamps, vitesses et caps lorsqu’ils existent ;
- calcul automatique de la distance et de la durée active ;
- stockage dans le même IndexedDB que les traces CAP CLAIR ;
- ouverture automatique dans Replay après import réussi ;
- source clairement indiquée par `GPX importé` ;
- nom repris depuis les métadonnées GPX, la trace, la route ou le nom du fichier ;
- limite de fichier fixée à 20 Mo ;
- erreurs explicites pour XML invalide, GPX vide ou coordonnées insuffisantes.

## GPX sans horodatage complet

- la carte reste consultable ;
- le profil d’altitude reste consultable et déplaçable ;
- la lecture temporelle, l’heure et les vitesses de replay sont désactivées lorsqu’elles ne peuvent pas être établies honnêtement ;
- aucun horaire artificiel n’est affiché ;
- un GPX réexporté sans chronologie conserve des points sans balise `time`.

## Replay des traces

- lecture, pause et retour au début pour les traces horodatées ;
- vitesses x1, x5, x10 et x20 ;
- animation de l’avion sur la trace ;
- heure, vitesse sol, altitude GPS et distance synchronisées ;
- profil d’altitude déplaçable au doigt ou à la souris ;
- coupures GPS séparées et ignorées dans la durée active ;
- route prévue en cyan pour les traces CAP CLAIR compatibles ;
- trace réelle en ambre ;
- carte Replay verrouillée nord en haut ;
- suivi avion activé par défaut, avec vue globale disponible ;
- affichage adapté au portrait, au paysage et au bureau.

## Planification et cartes

- écran Planifier verrouillé nord en haut ;
- bouton flottant `+ Point` sur la carte ;
- ajout continu de plusieurs points jusqu’au bouton `Terminer` ;
- suppression des points conservée dans la liste ;
- localisation ponctuelle avec le bouton Centrer, sans créer de trace ;
- icône avion légère réaliste vue de dessus ;
- altitude par défaut réglable par pas de 100 ft ;
- altitude de branche saisissable par pas de 100 ft.

## Suivi

- modes NORD UP et TRK UP persistants ;
- rotation tactile autorisée en NORD UP ;
- rotation tactile bloquée en TRK UP ;
- carte plein écran avec bandeau cockpit ;
- localisation ponctuelle disponible lorsque le suivi n’est pas démarré ;
- GPS web conservé comme fallback navigateur, sans promesse d’équivalence avec le GPS natif Android.

## Traces et exports

- stockage principal IndexedDB avec repli localStorage ;
- sauvegarde et suppression vérifiées ;
- export GPX et JSON ;
- export GPX découpé en segments lors des coupures supérieures à 12 secondes ;
- métadonnées de version, source, import et diagnostics conservées ;
- route prévue enregistrée avec les nouvelles traces CAP CLAIR pour la comparaison dans Replay.

## Log de navigation

- bouton `Exporter PDF` conservé pour le prochain module dédié ;
- garde-fous navigation, carburant et profil avion de WEB13.19.0 conservés.

## Compatibilité web

- aucun dossier Android ou iOS ;
- aucune dépendance Capacitor ;
- aucun plugin NativeGps ou NativeTraceExport ;
- fonctions Cloudflare Pages conservées ;
- build attendu avec `npm run build` ;
- PWA utilisable dans Chrome, Firefox et Safari selon les capacités du navigateur.

## Installation dans le repo avec GitHub Desktop

1. Sélectionner la branche web/PWA concernée.
2. Vider le dossier local en conservant uniquement `.git`.
3. Copier le contenu complet de ce ZIP dans le dossier.
4. Vérifier la version `WEB13.21.0` dans la chip et le titre `CAP CLAIR WEB13.21.0 - IMPORT GPX` dans l’onglet.
5. Commit et push via GitHub Desktop.

Commit recommandé :

```text
main: add local GPX import and replay integration
```
