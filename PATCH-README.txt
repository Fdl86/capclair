CAP CLAIR WEB13.29.0 - SUP AIP PARSER V3 ROBUSTESSE BETA

PATCH A APPLIQUER SUR WEB13.28.0 APRES AVOIR RECUPERE LE DERNIER COMMIT DU ROBOT SUP AIP.

1. Dans GitHub Desktop, utiliser Pull origin s'il est proposé.
2. Ne pas vider le dossier local et conserver le dossier .git.
3. Copier tout le contenu de ce patch à la racine du dépôt et accepter les remplacements.
4. Vérifier que les fichiers public/data/supaip-current.geojson, supaip-status.json, supaip-unmapped.json et supaip-manifest.json ne sont ni supprimés ni remplacés.
5. Commit puis Push origin sur main.
6. Vérifier la chip WEB13.29.0 et le titre de l'onglet.
7. Lancer une fois Actions > Update SUP AIP data > Run workflow sur main.
8. Après le commit automatique du robot, faire Pull origin dans GitHub Desktop.

TEST ZOOM
- Dézoomer dans Planifier, ouvrir Log de nav, revenir dans Planifier: le zoom et le centre doivent rester identiques.
- Faire le même test dans Suivi puis dans Replay.
- Planifier et Suivi doivent conserver des vues indépendantes.

TEST SUP AIP
- Le workflow doit être vert et afficher Parser V3.
- Tester un point où plusieurs zones se superposent: un sélecteur doit apparaître.
- Vérifier que les SUP 234/24, 211/25, 187/25, 192/25, 094/25 et 062/26 progressent dans le bilan.
