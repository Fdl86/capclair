# SUP AIP AUTO BETA

CAP CLAIR utilise `public/data/supaip-current.geojson` comme dernière base valide.

Le workflow `.github/workflows/update-supaip.yml` s'exécute toutes les 6 heures. Il consulte la liste officielle des SUP AIP Métropole du SIA, télécharge uniquement les nouvelles publications spatiales ou celles qui ont changé, extrait les coordonnées des PDF et reconstruit les géométries suffisamment fiables.

Fichiers produits :

- `supaip-current.geojson` : zones cartographiées ;
- `supaip-status.json` : date, compteurs et fraîcheur de la base ;
- `supaip-unmapped.json` : publications spatiales que le parseur n'a pas pu cartographier avec une confiance suffisante.

Protections :

- une base vide n'écrase jamais la dernière base valide ;
- une chute anormale du nombre de zones bloque la publication ;
- les limites complexes non maîtrisées, comme certains arcs, frontières ou littoraux, sont signalées au lieu d'être approximées silencieusement ;
- aucun filtrage vertical n'est appliqué dans CAP CLAIR ;
- l'application recharge la base au lancement de la couche, au retour au premier plan et toutes les 30 minutes.

Cette fonction reste une surimpression BETA. La consultation du PDF officiel SIA, de SOFIA et des NOTAM reste obligatoire avant le vol.
