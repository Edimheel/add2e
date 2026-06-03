# Rapport onUse — Clerc niveau 3

## Diagnostic

- Référence lue : `audit/reference/manuel-joueurs-clerc-niveau-3.json`.
- Aucun JSON Foundry n'a été modifié.
- Aucun script existant n'a été modifié : les onUse historiques fonctionnels sont préservés.
- Correction PR4 : les scripts génériques d'aide MJ ajoutés précédemment ont été retirés, car ils dupliquaient des scripts existants et n'étaient pas raccordés au JSON Foundry.

## Scripts créés

- Aucun.

## Scripts modifiés

- Aucun.

## Scripts laissés inchangés

- `Catalepsie` : chemin Foundry historique `scripts/sorts/mort-simulee.js` ou script voisin existant conservé.
- `Désenvoûtement` : chemin Foundry historique `scripts/sorts/delivrance-de-la-malediction.js` conservé.
- `Dissipation de la magie` : `scripts/sorts/dissipation-de-la-magie.js`.
- `Glyphe de garde` : `scripts/sorts/glyphe-de-garde.js`.
- `Guérison de la cécité` : chemin Foundry historique `scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js` conservé.
- `Guérison des maladies` : `scripts/sorts/guerison-des-maladies.js`.
- `Localisation d'objets` : chemin Foundry historique `scripts/sorts/localisation-d-un-objet.js` conservé.
- `Lumière éternelle` : chemin Foundry historique `scripts/sorts/lumiere-continuelle.js` conservé.
- `Manne` : chemin Foundry historique `scripts/sorts/creation-de-nourriture-et-d-eau.js` conservé.
- `Nécro-animation` : chemin Foundry historique `scripts/sorts/animation-des-morts.js` conservé.
- `Nécromancie` : chemin Foundry historique `scripts/sorts/communication-avec-les-morts.js` conservé.
- `Prière` : `scripts/sorts/priere.js`.

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

- `audit/rapports/ONUSE-CLERC-NIVEAU-3.md`
