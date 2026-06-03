# Rapport onUse — Clerc niveau 2
## Diagnostic
- Référence lue : `audit/reference/manuel-joueurs-clerc-niveau-2.json`.
- Aucun JSON Foundry n'a été modifié.
- Les scripts créés dans ce lot sont des aides MJ DialogV2 lorsque l'automatisation complète serait incertaine.

## Scripts créés
- `scripts/sorts/langage-animal.js`
- `scripts/sorts/perception-des-alignements.js`
- `scripts/sorts/resistance-au-feu.js`
- `scripts/sorts/retardement-du-poison.js`
- `scripts/sorts/silence-sur-5-metres.js`

## Scripts modifiés
- Aucun script existant n'a été modifié : les onUse présents ont été préservés pour éviter une régression fonctionnelle.

## Scripts laissés inchangés
- `Augure` : script existant ou chemin historique conservé.
- `Cantique` : script existant ou chemin historique conservé.
- `Charme-serpents` : script existant ou chemin historique conservé.
- `Détection des charmes` : script existant ou chemin historique conservé.
- `Détection des pièges` : script existant ou chemin historique conservé.
- `Marteau spirituel` : script existant ou chemin historique conservé.
- `Paralysie` : script existant ou chemin historique conservé.

## Sorts automatisés
- Aucun nouveau sort complexe n'a reçu d'automatisation destructive dans ce lot.
- Les scripts existants déjà fonctionnels sont conservés tels quels.

## Sorts en aide MJ
- `langage-animal.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `perception-des-alignements.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `resistance-au-feu.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `retardement-du-poison.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `silence-sur-5-metres.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.

## Limites connues
- Test runtime Foundry non exécuté dans l'environnement Codex.
- Les scripts historiques qui contiennent déjà dialogue legacy V1 sont une dette technique préexistante et ne sont pas réécrits dans ce lot.
- Les effets d'invocation, de déplacement, de zone persistante ou d'interprétation restent à arbitrer par le MJ si le script existant ne les automatise pas de façon fiable.

## Fichiers touchés
- `scripts/sorts/langage-animal.js`
- `scripts/sorts/perception-des-alignements.js`
- `scripts/sorts/resistance-au-feu.js`
- `scripts/sorts/retardement-du-poison.js`
- `scripts/sorts/silence-sur-5-metres.js`
- `audit/rapports/ONUSE-CLERC-NIVEAU-2.md`
