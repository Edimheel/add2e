# Mise à jour globale des sorts Foundry

## Normalisation des noms techniques de composants

- Noms techniques renommés dans les références puis réinjectés par `foundry.id` / `_id` : **95**.
- Total `fvtt-spells-all.json` après injection : **411 Items**.
- Descriptions modifiées : **0**.
- Consommations, conditions et coûts modifiés : **0**.
- Composants ajoutés ou supprimés : **0**.
- Composants avec `consommation: "a_verifier"` : **0**.
- `Asile` n’a pas été réintroduit.

## Exemples avant/après

- `petit miroir en argent` → `miroir en argent`
- `feuilles d’infusion encore humides` → `feuille d’infusion encore humides`
- `petite tige de métal droite et rigide` → `tige de métal droite et rigide`
- `petit morceau d’écorce` → `morceau d’écorce`
- `petite créature` → `créature`
- `petite baguette fourchue métallique, sorte de diapason` → `baguette fourchue métallique, sorte de diapason`
- `grains de sucre` → `grain de sucre`
- `petit caillou` → `caillou`
- `du gui et un peu de nourriture appréciée par l’animal` → `gui et un peu de nourriture appréciée par l’animal`
- `du houx avec lequel le druide doit se frotter` → `houx avec lequel le druide doit se frotter`
- `une feuille morte de chêne et du gui` → `feuille morte de chêne et du gui`
- `baies de houx` → `baie de houx`

Seul `system.composants_materiels_objets[].nom` a été normalisé ; `notes` conserve la formulation source lorsque nécessaire. Aucun Item complet n’a été remplacé.

## Périmètre confirmé

Aucun script, découpage, fichier source, `system.json`, `AGENTS.md` ou workflow n’a été modifié.
