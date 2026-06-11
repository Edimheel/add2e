# Mise à jour globale des sorts Foundry

## Alignement PHB final

- `Asile` a été supprimé définitivement du périmètre PHB, car il est absent des 130 pages du Manuel des joueurs AD&D 2e fourni.
- La description générique précédente « Asile ouvre une voie de déplacement magique… » a été retirée du JSON Foundry et de la référence Clerc niveau 7.
- `Voile illusoire` est conservé dans le JSON Foundry, les références et les sources.

## Totaux

- `fvtt-spells-all.json` : **411 Items**.
- Références validées : **411 identifiants Foundry uniques**.
- Items Foundry hors références : **0**.
- Descriptions manquantes : **0**.
- Composants avec `consommation: "a_verifier"` : **0**.
- Clerc niveau 7 : **10** sorts, ordres 1 à 10, statut complet conservé.

## Validation et périmètre

- Tous les JSON modifiés sont valides.
- `node audit/tools/validate-reference-schema.mjs` exécuté avec succès.
- `Asile` ne subsiste que dans ce rapport comme trace historique explicative.
- Aucun script, découpage, `system.json`, `AGENTS.md` ou workflow modifié.
