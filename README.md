# CAP CLAIR DEV13 - Wind aloft et log de nav

## A tester

1. Ouvrir Planification.
2. Vérifier TAS et altitude défaut.
3. Cliquer `Maj vent`.
4. Ouvrir `Log nav`.
5. Modifier une altitude de branche.
6. Relancer `Modifier vents`.
7. Vérifier le tableau :
   - Vent
   - RV
   - Var au format 1E / 1W
   - RM
   - Dérive
   - CM
   - GS
   - ETE / ETA

## Variables Cloudflare

`OPENAIP_API_KEY` reste nécessaire pour les tuiles openAIP.

La météo Open-Meteo ne nécessite pas de clé.

## Commit proposé

```txt
dev13 add wind aloft navlog
```

## DEV13.3

Le vent est analysé à l'heure du clic sur `Maj vent`. Le champ heure UTC a été retiré.
