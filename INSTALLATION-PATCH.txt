CAP CLAIR WEB13.29.2 - SUP AIP ANTI-REGRESSION BETA

PATCH A APPLIQUER SUR WEB13.29.1 APRES AVOIR RECUPERE LE DERNIER COMMIT DU ROBOT SUP AIP.

INSTALLATION
1. Dans GitHub Desktop, utiliser Pull origin s'il est proposé.
2. Ne pas vider le dossier local et conserver le dossier .git.
3. Copier tout le contenu de ce patch à la racine du dépôt et accepter les remplacements.
4. Vérifier que les fichiers public/data/supaip-current.geojson, supaip-status.json, supaip-unmapped.json et supaip-manifest.json ne sont ni supprimés ni remplacés.
5. Commit puis Push origin sur main.
6. Vérifier la chip WEB13.29.2 et le titre de l'onglet.
7. Lancer une fois Actions > Update SUP AIP data > Run workflow sur main.
8. Le bilan doit afficher Régressions non résolues : 0 avant le commit automatique.
9. Après le commit du robot, faire Pull origin dans GitHub Desktop.

CONTROLES ATTENDUS
- Le SUP AIP 101/26 doit revenir à 20/20 géométries.
- Le SUP AIP 077/26 doit produire 12 géométries opérationnelles.
- Les zones ZRT portant un code LF-R ne doivent plus être classées comme références permanentes.
- Les publications protégées par une ancienne géométrie doivent apparaître sous le statut complet avec repli, et non comme réellement partielles lorsque rien d'autre ne manque.
- Toute chute publication par publication impossible à restaurer doit faire échouer le workflow avant écriture et avant commit.
- Le bloc Régressions compensées doit détailler les SUP concernés et les noms des zones restaurées.

CORRECTIFS 13.29.2
- Rapprochement robuste par identifiant, nom canonique, géométrie et verticales.
- Restauration individuelle des anciennes zones disparues.
- Protection contre une reclassification spatiale vers non spatiale.
- Blocage strict si une publication actuelle contient moins de zones opérationnelles que la dernière base valide après réconciliation.
- Statut séparé complet avec repli.
- Compteurs visibles dans Plus > SUP AIP et GitHub Actions.
- Actions GitHub mises à jour vers checkout@v7 et setup-python@v7.

VALIDATION LOCALE
- 27 tests Python du parseur réussis.
- Test réel du PDF officiel 101/26 : 20/20 géométries.
- Test réel du PDF officiel 077/26 : 12 géométries.
- 28 tests TypeScript/React réussis.
- Compilation TypeScript et build Vite/PWA réussis.
