# CAP CLAIR DEV06 - Test LFCA / Saumur / Tours

Cette version remplace la navigation de test par :

```txt
LFCA -> LFOD Saumur Saint-Florent -> LFOT Tours Val de Loire
```

## A tester

1. Ouvrir Planification.
2. Vérifier que la route est `LFCA - LFOD Saumur - LFOT Tours`.
3. Vérifier le placement du point LFOD Saumur.
4. Vérifier le placement de LFOT Tours.
5. Observer LFCA en limite sud : c'est probablement une zone de jonction avec la future carte Sud-Ouest.

## Note importante

La bande beige au sud n'est pas un bug noir restant : c'est le hors couverture / bord du tilepack Nord-Ouest actuel. Pour traiter LFCA proprement, il faudra intégrer la carte Sud-Ouest et gérer la jonction NO/SO.

## Commit proposé

```txt
test sia lfca saumur tours route
```
