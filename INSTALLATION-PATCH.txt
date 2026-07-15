CAP CLAIR WEB13.29.1 - SUP AIP PARSER V3.1 FIABILISATION BETA

PATCH A APPLIQUER SUR WEB13.29.0 APRES AVOIR RECUPERE LE DERNIER COMMIT DU ROBOT SUP AIP.

1. Dans GitHub Desktop, utiliser Pull origin s'il est proposé.
2. Ne pas vider le dossier local et conserver le dossier .git.
3. Copier tout le contenu de ce patch à la racine du dépôt et accepter les remplacements.
4. Vérifier que les fichiers public/data/supaip-current.geojson, supaip-status.json, supaip-unmapped.json et supaip-manifest.json ne sont ni supprimés ni remplacés.
5. Commit puis Push origin sur main.
6. Vérifier la chip WEB13.29.1 et le titre de l'onglet.
7. Lancer une fois Actions > Update SUP AIP data > Run workflow sur main.
8. Après le commit automatique du robot, faire Pull origin dans GitHub Desktop.

TEST ZOOM
- Dézoomer dans Planifier, ouvrir Log de nav, revenir dans Planifier: le zoom et le centre doivent rester identiques.
- Faire le même test dans Suivi puis dans Replay.
- Planifier et Suivi doivent conserver des vues indépendantes.

TEST SUP AIP
- Le workflow doit être vert et afficher Parser V3.1.
- Le bilan doit séparer: entièrement cartographiés, affichés avec prudence, réellement partiels et non cartographiés.
- Les objets permanents cités comme LFR, CTR ou TMA doivent apparaître dans "Références permanentes ignorées" et ne plus gonfler les géométries SUP AIP.
- Les replis de sécurité doivent être détaillés avec le numéro du SUP AIP et le nom exact des zones conservées.
- Vérifier que les SUP 023/26 et 207/25 restent présents après la régénération.

CORRECTIFS 13.29.1
- Filtre les espaces permanents cites comme references (LF-R, CTR, TMA, RMZ, TMZ) sans masquer une zone temporaire plausible.
- Ignore les faux titres de tableau comme "ZRT activable H24" ou "ZRT.".
- Ne restaure plus une reference permanente via le garde-fou anti-regression.
- Separe les SUP complets, affiches avec prudence, reellement partiels et non cartographies.
- Detaille les replis de securite publication par publication et zone par zone.
- Conserve les couches superposees partageant le meme contour mais pas les memes verticales.

VALIDATION LOCALE
- 24 tests Python du parseur reussis.
- 28 tests TypeScript/React reussis.
- Build de production Vite reussi.
