# Mise à jour globale des sorts Foundry depuis les références validées

## Résultat

- Cible mise à jour : `fvtt-spells-all.json`.
- Items avant injection : **421**.
- Items après injection : **421**.
- Items appariés et mis à jour par `foundry.id` vers `_id` : **410**.
- Items hors références conservés strictement inchangés : **11**.
- Champ exact utilisé pour la description : `system.description`.
- Champ exact utilisé pour les composants matériels : `system.composants_materiels`.

## Méthode appliquée

Chaque référence portant `foundry.id` a été appariée exclusivement à l’Item possédant le même `_id`. Aucun rapprochement par nom n’a été utilisé.

Pour les 410 Items correspondants, seuls `system.description` et `system.composants_materiels` ont été affectés. Ils reçoivent strictement `spells[].description` et une copie de `spells[].composants_materiels_objets`.

Aucun Item complet n’a été remplacé. Une comparaison structurelle avant/après confirme que tous les autres champs des 410 Items sont inchangés, notamment `_id`, `name`, `type`, `img`, flags, effets et chemins `onUse`. Aucun champ `foundry` des références n’a été copié.

## Contrôles d’intégrité

- JSON global valide.
- Total avant/après : **421 / 421**.
- Items mis à jour : **410**.
- Items hors références inchangés : **11**.
- Aucun composant injecté avec `consommation: "a_verifier"`.
- Aucun composant, coût ou statut de consommation inventé.

## Validations exécutées

- `node audit/tools/validate-reference-schema.mjs`.
- `grep -R '"consommation": "a_verifier"' fvtt-spells-all.json audit/reference || true` : aucune occurrence.
- `git status --short` contrôlé avant commit.
- Diff final limité à `fvtt-spells-all.json` et `audit/rapports/FOUNDRY-SPELLS-GLOBAL-UPDATE.md`.

## Périmètre confirmé

Aucun script, fichier de référence, découpage, fichier source, `system.json`, `AGENTS.md` ou workflow n’a été modifié.
