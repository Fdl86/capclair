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

## DEV13.4

Le log de nav contient maintenant une bannière zones par altitude.

Utilisation :
1. Ouvrir Planification.
2. Cliquer `Maj vent`.
3. Ouvrir `Log nav`.
4. Lire la bannière zones.
5. Comparer avec Windy en utilisant le même point, la même heure locale et la même altitude.

Commit proposé :

```txt
dev13.4 add weather audit
```

## DEV13.5

Mode météo strict Météo-France.

Ce hotfix supprime le fallback Forecast pour éviter de mélanger les sources météo dans le log. Si une branche ne reçoit pas de donnée Météo-France exploitable, elle reste sans vent plutôt que d'afficher une donnée non comparable avec Windy AROME.

Commit proposé :

```txt
dev13.5 strict meteofrance wind
```

## DEV13.6

Ajout d'une bannière zones dans le log de nav, calculée par position et altitude de branche.

Commit proposé :

```txt
dev13.6 add zones altitude banner
```
