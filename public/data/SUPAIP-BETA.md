# SUP AIP PARSER V2 BETA

CAP CLAIR utilise `public/data/supaip-current.geojson` comme dernière base valide.

Le workflow `.github/workflows/update-supaip.yml` s'exécute toutes les 6 heures. Il contrôle toutes les publications présentes dans la liste officielle des SUP AIP Métropole du SIA. Au premier passage du Parser V2, tous les PDF sont téléchargés et classés après lecture. Aux passages suivants, les publications inchangées sont réutilisées depuis le manifeste local.

Fichiers produits :

- `supaip-current.geojson` : géométries cartographiées et limites verticales ;
- `supaip-status.json` : date, compteurs, fraîcheur et complétude de la base ;
- `supaip-unmapped.json` : publications partielles ou non cartographiées avec diagnostic ;
- `supaip-manifest.json` : état de chaque publication pour le cache automatique.

Protections :

- une base vide n'écrase jamais la dernière base valide ;
- une chute anormale du nombre de zones bloque la publication ;
- un PDF manquant ou illisible fait échouer le workflow complet ;
- les identifiants de zones sont uniques et stables ;
- une limite dépendant d'une frontière, d'un littoral ou d'un autre espace aérien est signalée au lieu d'être inventée ;
- chaque zone affiche son plancher et son plafond lorsqu'ils sont extraits ;
- en cas d'échec d'extraction verticale, la fiche affiche explicitement `Limites verticales non extraites - consulter le PDF SIA` ;
- aucun filtrage vertical n'est appliqué dans CAP CLAIR ;
- l'application recharge la base au lancement de la couche, au retour au premier plan et toutes les 30 minutes.

Cette fonction reste une surimpression BETA. La consultation du PDF officiel SIA, de SOFIA et des NOTAM reste obligatoire avant le vol.
