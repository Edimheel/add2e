# Découpage des fichiers d’audit

Ce répertoire sert à recevoir les fichiers découpés issus de `fvtt-spells-all.json`.

Objectif : éviter de manipuler un unique fichier trop volumineux pendant l’audit des sorts ADD2E.

Les fichiers générés ici doivent rester des fichiers de travail pour l’audit. Ils ne doivent pas remplacer les données Foundry de production sans validation explicite.

Convention recommandée pour les futurs fichiers :

```text
clerc-niveau-1.json
clerc-niveau-2.json
druide-niveau-1.json
magicien-niveau-1.json
illusionniste-niveau-1.json
```

Chaque fichier découpé doit conserver les données JSON nécessaires à la vérification des champs, des images et des scripts `onUse` associés.
