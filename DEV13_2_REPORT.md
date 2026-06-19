# CAP CLAIR DEV13.2 - Wind proxy hotfix

## Diagnostic

Le message `Vent indisponible` pouvait arriver sans erreur visible parce que la fonction météo masquait les échecs par sample.

Point fragile identifié :
- l'utilisation directe de `caches.default` pouvait échouer selon le runtime
- en cas d'échec, chaque sample était ignoré
- le frontend recevait `samples: []`
- l'UI affichait donc `Vent indisponible` sans détail

## Correctifs

- Cache Cloudflare rendu optionnel.
- Fallback si le cache runtime n'est pas disponible.
- Fallback météo :
  1. Open-Meteo Météo-France
  2. Open-Meteo Forecast standard
- Retour `errors` côté proxy pour debug.
- Ajout endpoint diagnostic :
  - `/api/weather/status`
- Message UI plus précis :
  - `Vent non reçu`
  - `Erreur météo`

## Optimisation conservée

- Aucun nouveau package.
- Déduplication serveur conservée.
- Cache navigateur conservé.
- Cache Cloudflare utilisé seulement si disponible.
- Pas d'appel météo automatique à chaque rendu.
