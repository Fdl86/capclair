CAP CLAIR WEB13.27.2 - SUP AIP COLUMN TABLE HOTFIX BETA

Ce zip est un PATCH à appliquer sur WEB13.27.1 après récupération du commit automatique GitHub.

1. Dans GitHub Desktop, utiliser Pull origin si le bouton est proposé.
2. Ne pas vider le dossier local.
3. Copier le contenu du patch à la racine du dépôt.
4. Accepter les remplacements.
5. Vérifier que les fichiers public/data/supaip-* ne sont ni supprimés ni remplacés.
6. Commit : WEB13.27.2 - SUP AIP COLUMN TABLE HOTFIX BETA
7. Push origin.
8. Dans GitHub, ouvrir Actions > Update SUP AIP data.
9. Lancer Run workflow sur main et attendre le run vert.
10. Vérifier WEB13.27.2 dans la chip.
11. En mode SUP AIP TOUS, vérifier le retour des zones LFDB autour de Belle-Ile, de l'Ile d'Yeu et des Sables d'Olonne.

Le parseur doit produire 16/16 géométries pour le SUP AIP 207/25, toutes avec limites verticales SFC - UNL.
