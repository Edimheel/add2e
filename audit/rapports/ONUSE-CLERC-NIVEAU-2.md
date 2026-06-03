# Rapport onUse — Clerc niveau 2

## Diagnostic

- Référence lue : `audit/reference/manuel-joueurs-clerc-niveau-2.json`.
- Aucun JSON Foundry n'a été modifié.
- Aucun script existant n'a été modifié : les onUse historiques fonctionnels sont préservés.
- Correction PR4 : les scripts génériques d'aide MJ ajoutés précédemment ont été retirés, car ils dupliquaient des scripts existants et n'étaient pas raccordés au JSON Foundry.

## Scripts créés

- Aucun.

## Scripts modifiés

- Aucun.

## Scripts laissés inchangés

- `Augure` : `scripts/sorts/augure.js`.
- `Cantique` : `scripts/sorts/cantique.js`.
- `Charme-serpents` : `scripts/sorts/charme-serpents.js`.
- `Détection des charmes` : `scripts/sorts/detection-des-charmes.js`.
- `Détection des pièges` : `scripts/sorts/detection-des-pieges.js`.
- `Langage animal` : chemin Foundry historique `scripts/sorts/langage-des-animaux.js` conservé.
- `Marteau spirituel` : `scripts/sorts/marteau-spirituel.js`.
- `Paralysie` : chemin Foundry historique `scripts/sorts/immobilisation-des-personnes.js` conservé.
- `Perception des alignements` : chemin Foundry historique `scripts/sorts/connaissance-des-alignements.js` conservé.
- `Résistance au feu` : chemin Foundry historique `scripts/sorts/resistance-au-feu-resistance-au-froid.js` conservé.
- `Retardement du poison` : chemin Foundry historique `scripts/sorts/ralentissement-du-poison.js` conservé.
- `Silence sur 5 mètres` : chemin Foundry historique `scripts/sorts/silence-rayon-de-15-pieds.js` conservé.

## Sorts automatisés

- Aucun nouveau sort n'a reçu d'automatisation destructive dans ce lot.
- Les automatisations déjà présentes dans les scripts historiques sont conservées telles quelles.

## Sorts en aide MJ

- Aucun nouveau script d'aide MJ générique n'est créé dans ce correctif PR4.
- Les sorts ambigus restent traités par leurs scripts historiques ou par arbitrage MJ dans Foundry.

## Limites connues

- Test runtime Foundry non exécuté dans l'environnement Codex.
- Des scripts historiques peuvent encore contenir des dialogues legacy ; ils sont hors périmètre de ce correctif et n'ont pas été réécrits.

## Fichiers touchés

- `audit/rapports/ONUSE-CLERC-NIVEAU-2.md`
