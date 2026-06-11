# Génération des références de sorts — normalisation des composants matériels

## Résumé final

- Références PHB parcourues : **411 sorts**.
- Noms techniques de composants renommés : **95**.
- Descriptions modifiées : **0**.
- Consommations modifiées : **0**.
- Composants ajoutés ou supprimés : **0**.
- Composants avec `consommation: "a_verifier"` : **0**.

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

La formulation source retirée du nom technique a été ajoutée ou conservée dans `notes`. Les matières et précisions utiles ont été conservées.

## Validation

- Tous les JSON modifiés sont valides.
- `node audit/tools/validate-reference-schema.mjs` exécuté avec succès.
- Total Foundry conservé : **411 Items**.
- `Asile` n’a pas été réintroduit.
- Aucun script, découpage, fichier source, `system.json`, `AGENTS.md` ou workflow modifié.
