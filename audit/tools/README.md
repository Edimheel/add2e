# Outils d’audit

Ce répertoire contient les scripts utilisés pour générer les rapports d’audit des sorts.

Règle principale : les scripts d’audit ne corrigent pas les sorts. Ils lisent les exports découpés, les références du Manuel des joueurs et l’arborescence du dépôt pour produire des rapports dans `audit/rapports/`.

Le script principal est :

```text
audit/tools/generate-spell-audit-reports.mjs
```

Il peut être exécuté localement ou via GitHub Actions.
