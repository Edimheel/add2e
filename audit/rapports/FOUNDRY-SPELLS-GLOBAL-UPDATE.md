# Mise à jour globale des sorts Foundry

## État final d’alignement

- `fvtt-spells-all.json` contrôlé en lecture seule : **412** Items.
- Identifiants Foundry uniques dans les références : **412**.
- Items Foundry hors références : **0**.
- Composants avec `consommation: "a_verifier"` : **0**.

## Références ajoutées

| Lot | Sort | foundry.id | Décision |
|---|---|---|---|
| Clerc niveau 7 | Asile | `MjfD1BtI6Zbmcbkn` | Ajouté ordre 1 ; `expectedCount` = 11. |
| Illusionniste niveau 6 | Voile illusoire | `U5UsRJv9W5WnI5Uc` | Ajouté ordre 8 ; `expectedCount` = 8. |

Les deux sorts ne sont plus hors références. Aucun doublon historique n’a été réintroduit.

## Validation et périmètre

- JSON valides et `node audit/tools/validate-reference-schema.mjs` exécuté avec succès.
- Aucun script, JSON Foundry, découpage, source, `system.json`, `AGENTS.md` ou workflow modifié.
