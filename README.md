# CAP CLAIR DEV09 - Free map + openAIP proxy

Version de transition propre après abandon temporaire du recalage PDF 500K.

## Ce que fait DEV09

- Fond carte gratuit DEV.
- Route test LFCA - LFOD Saumur - LFOT Tours.
- Proxy Cloudflare Pages Function pour openAIP.
- Secret requis côté Cloudflare : `OPENAIP_API_KEY`.
- Aérodromes openAIP affichés autour de la route.
- Cache local léger.

## À vérifier après déploiement Cloudflare Pages

1. Ouvrir Planification.
2. Vérifier que le fond libre s'affiche.
3. Vérifier le badge en haut de carte : `openAIP chargement`, puis `openAIP X terrains` ou `cache X terrains`.
4. Vérifier que des points aérodromes apparaissent autour de LFCA - LFOD - LFOT.
5. Tester `/api/openaip/status` dans le navigateur : il doit répondre `keyConfigured: true`.

## Secret Cloudflare attendu

`OPENAIP_API_KEY`

Ne pas créer de variable `VITE_OPENAIP_API_KEY`.
Une variable Vite serait exposée dans le navigateur.

## Commit proposé

```txt
dev09 add openaip cloudflare proxy
```
