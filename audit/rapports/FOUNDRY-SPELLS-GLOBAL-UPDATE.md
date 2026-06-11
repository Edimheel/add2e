# Mise à jour globale des sorts Foundry

## État de la source globale

- `audit/source/reference-descriptions.json` contient **414** descriptions validables.
- Descriptions manquantes : **1** (`clerc-niveau-7 / Asile`).
- `illusionniste-niveau-6` : **8** descriptions, dont `Voile illusoire` renseigné avec le texte exact du Manuel.
- `clerc-niveau-7` : **10** descriptions ; le compteur ne passe pas à 11 tant qu’une description exacte d’`Asile` n’est pas retrouvée.

## Voile illusoire

La clé globale est normalisée en `Voile illusoire` et sa description correspond au texte du Manuel fourni, page PDF 101. Les données Foundry et l’absence de composant matériel sont suivies dans `audit/source/reference-extra-phb-spells.json`.

## Asile

Aucune occurrence d’`Asile` n’a été trouvée dans les 130 pages du PDF fourni. `audit/source/reference-descriptions.json` ne contient donc aucune description validée pour ce sort.

La description présente dans `audit/decoupage_fichier/clerc-niveau-7.json` et `fvtt-spells-all.json` commence par « Asile ouvre une voie de déplacement magique… ». Elle est générique/résumée et ne constitue pas une description exacte du Manuel. L’entrée actuelle dans `audit/reference/manuel-joueurs-clerc-niveau-7.json` ne doit pas être considérée comme `reference_complete_description_normalisee` tant qu’une source exacte n’est pas retrouvée. Sa correction est recommandée lors d’une tâche ultérieure autorisant la modification des références.

Le cas et ses composants techniques à vérifier sont suivis dans `audit/source/reference-extra-phb-spells.json`.

## Validation et périmètre

- JSON valides.
- `node audit/tools/validate-reference-schema.mjs` exécuté avec succès.
- Aucun fichier `audit/reference/*.json`, JSON Foundry, script, découpage, `system.json`, `AGENTS.md` ou workflow modifié.
