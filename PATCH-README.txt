CAP CLAIR WEB13.27.1 - SUP AIP TRA HOTFIX BETA

IMPORTANT
Ce zip est un patch pour WEB13.27.0. Ne pas vider le dossier local.
Il ne contient volontairement aucun fichier public/data/supaip-*.json ou GeoJSON afin de conserver la base automatique actuelle de 358 zones.

INSTALLATION
1. Dans GitHub Desktop, cliquer sur Fetch origin puis Pull origin afin de récupérer le dernier commit automatique du robot SUP AIP.
2. Fermer CAP CLAIR dans le navigateur.
3. Copier tout le contenu de ce dossier patch à la racine du dépôt local CAP CLAIR.
4. Accepter le remplacement des fichiers existants.
5. Dans GitHub Desktop, vérifier que les fichiers public/data ne sont pas supprimés ni remplacés.
6. Commit: WEB13.27.1 - SUP AIP TRA HOTFIX BETA
7. Push origin sur main.
8. Dans GitHub Actions, lancer Update SUP AIP data une fois sur main.
9. Attendre le run vert et le redéploiement Cloudflare.
10. Vérifier WEB13.27.1 dans la chip.

TEST ATTENDU
Pour une route LFBI - LFOU en mode SUP AIP ROUTE, les zones TRA90NL et TRA90NH du SUP AIP 023/26 doivent être présentes.
Limites verticales:
- TRA90NL: FL 195 - FL 275
- TRA90NH: FL 305 - FL 335

Le patch ajoute aussi une géométrie officielle de secours pour ces deux zones et une protection qui conserve une ancienne géométrie valide si une future version du parseur renvoie zéro zone pour une publication inchangée.
