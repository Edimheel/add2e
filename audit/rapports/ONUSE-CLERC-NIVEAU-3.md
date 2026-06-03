# Rapport onUse — Clerc niveau 3
## Diagnostic
- Référence lue : `audit/reference/manuel-joueurs-clerc-niveau-3.json`.
- Aucun JSON Foundry n'a été modifié.
- Les scripts créés dans ce lot sont des aides MJ DialogV2 lorsque l'automatisation complète serait incertaine.

## Scripts créés
- `scripts/sorts/guerison-de-la-cecite.js`
- `scripts/sorts/localisation-d-objets.js`
- `scripts/sorts/manne.js`
- `scripts/sorts/necro-animation.js`
- `scripts/sorts/necromancie.js`

## Scripts modifiés
- Aucun script existant n'a été modifié : les onUse présents ont été préservés pour éviter une régression fonctionnelle.

## Scripts laissés inchangés
- `Catalepsie` : script existant ou chemin historique conservé.
- `Désenvoûtement` : script existant ou chemin historique conservé.
- `Dissipation de la magie` : script existant ou chemin historique conservé.
- `Glyphe de garde` : script existant ou chemin historique conservé.
- `Guérison des maladies` : script existant ou chemin historique conservé.
- `Lumière éternelle` : script existant ou chemin historique conservé.
- `Prière` : script existant ou chemin historique conservé.

## Sorts automatisés
- Aucun nouveau sort complexe n'a reçu d'automatisation destructive dans ce lot.
- Les scripts existants déjà fonctionnels sont conservés tels quels.

## Sorts en aide MJ
- `guerison-de-la-cecite.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `localisation-d-objets.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `manne.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `necro-animation.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.
- `necromancie.js` : dialogue DialogV2 récapitulant portée, durée, zone, composantes, temps d'incantation, sauvegarde et cibles ; retourne `true` seulement après confirmation de consommation.

## Limites connues
- Test runtime Foundry non exécuté dans l'environnement Codex.
- Les scripts historiques qui contiennent déjà dialogue legacy V1 sont une dette technique préexistante et ne sont pas réécrits dans ce lot.
- Les effets d'invocation, de déplacement, de zone persistante ou d'interprétation restent à arbitrer par le MJ si le script existant ne les automatise pas de façon fiable.

## Fichiers touchés
- `scripts/sorts/guerison-de-la-cecite.js`
- `scripts/sorts/localisation-d-objets.js`
- `scripts/sorts/manne.js`
- `scripts/sorts/necro-animation.js`
- `scripts/sorts/necromancie.js`
- `audit/rapports/ONUSE-CLERC-NIVEAU-3.md`
