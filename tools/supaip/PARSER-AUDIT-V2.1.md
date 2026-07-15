# Audit Parser SUP AIP V2.1 - 15 juillet 2026

Base observée : 110 PDF contrôlés, 86 publications spatiales, 377 géométries produites, 22 publications partielles et 25 non cartographiées.

Les catégories ci-dessous se recouvrent : une publication peut cumuler plusieurs causes.

## Causes identifiées

- 14 publications `0/0` : le bloc qui contient le nom de la zone n'est pas reconnu. Les cas typiques sont les noms qui ne commencent pas le bloc PDF, les grandes cellules fusionnées, les tableaux transposés, les modifications d'espaces existants et les pages dont la géométrie est portée par une annexe ou une carte.
- 11 publications : les noms sont trouvés, mais pas les limites latérales. Le parseur exige actuellement un cercle exploitable ou au moins trois coordonnées associées au même bloc. Il échoue sur les corridors décrits par axes, routes, frontières, espaces existants, coordonnées dispersées ou pages successives.
- 16 publications : présence d'exclusions internes. Le contour extérieur est conservé par prudence, mais le trou ou la soustraction n'est pas encore construit en anneau intérieur GeoJSON.
- 5 publications : au moins une géométrie nommée manque malgré une extraction partielle réussie.
- 4 publications : la géométrie est présente, mais la limite verticale est dans un bloc détaché que l'association spatiale ne rattache pas encore correctement.
- 1 publication (`150/25`) : incohérence du comptage attendu. Le titre annonce deux ZRT, mais le détecteur de noms n'en attend qu'une et ne produit donc aucun diagnostic explicite.

## Priorité de correction

1. Détection indépendante des noms attendus à partir du titre et des tableaux, afin d'éliminer les faux `0/0`.
2. Reconstruction des limites réparties sur plusieurs blocs et plusieurs pages.
3. Prise en charge des références aux espaces existants à partir du catalogue aéronautique CAP CLAIR.
4. Création de polygones avec anneaux intérieurs pour les exclusions.
5. Association renforcée des verticales détachées.
6. Contrôle croisé entre nombre déclaré dans le titre, noms détectés et géométries produites.

Le Parser V2.2 ajoute désormais un classement automatique de ces causes dans `supaip-status.json`, dans le bilan GitHub Actions et dans `Plus > SUP AIP`.
