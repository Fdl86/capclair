# CAP CLAIR DEV10 - Carte aéro prioritaire

Cette version met le mode `Carte aéro` en priorité dans l'écran Planification.

## À tester

1. Ouvrir Planification.
2. Vérifier que le premier bouton est `Carte aéro`.
3. Vérifier que le deuxième bouton est `Fond libre`.
4. Vérifier que `500K plus tard` a disparu.
5. En mode `Carte aéro`, vérifier que les terrains openAIP se chargent.
6. En mode `Fond libre`, vérifier que le fond reste lisible et que la surcouche openAIP disparaît.

## Cloudflare

La clé openAIP reste côté Cloudflare dans le secret `OPENAIP_API_KEY`.

## Commit proposé

```txt
dev10 prioritize aero map mode
```
