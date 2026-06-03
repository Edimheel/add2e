# Rapport onUse — Clerc niveau 2

## Diagnostic PR4

- Référence lue : `audit/reference/manuel-joueurs-clerc-niveau-2.json`.
- Découpage Foundry lu : `audit/decoupage_fichier/clerc-niveau-2.json`.
- Aucun JSON Foundry n'a été modifié.
- Aucun chemin arbitraire n'a été créé : seuls les chemins `onUse` déclarés dans le découpage Foundry ont été corrigés.
- Les scripts historiques raccordés étaient soit basés sur une fenêtre Dialog V1, soit trop génériques, soit portaient une automatisation incertaine. Ils ont été remplacés par des aides MJ `DialogV2` sûres, non destructives, retournant `false` à l'annulation et `true` après confirmation.

## Inventaire obligatoire

| Sort de référence | Chemin onUse déclaré dans le découpage Foundry | Script existe | Utilisé par le JSON/découpage | Décision |
|---|---|---:|---:|---|
| Augure | `systems/add2e/scripts/sorts/augure.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 ; aide MJ DialogV2 conservant la résolution divinatoire par le MJ. |
| Cantique | `systems/add2e/scripts/sorts/cantique.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 ; aide MJ DialogV2 pour éviter un effet global incertain. |
| Charme-serpents | `systems/add2e/scripts/sorts/charme-serpents.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 ; aide MJ DialogV2 car le comportement des serpents reste arbitré. |
| Détection des charmes | `systems/add2e/scripts/sorts/detection-des-charmes.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 ; aide MJ DialogV2, sauvegarde rappelée sans scan automatique. |
| Détection des pièges | `systems/add2e/scripts/sorts/detection-des-pieges.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 ; aide MJ DialogV2, aucun repérage de scène inventé. |
| Langage animal | `systems/add2e/scripts/sorts/langage-des-animaux.js` | oui | oui | Corrigé : le script utilisé par Foundry existe mais utilisait une fenêtre Dialog V1 ; aide MJ DialogV2. |
| Marteau spirituel | `systems/add2e/scripts/sorts/marteau-spirituel.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 et ne doit pas créer d'arme permanente ; aide MJ DialogV2. |
| Paralysie | `systems/add2e/scripts/sorts/paralysie.js` | oui | oui | Corrigé : le script était trop générique et incomplet ; aide MJ DialogV2 avec cibles, durée, sauvegarde et malus. |
| Perception des alignements | `systems/add2e/scripts/sorts/connaissance-des-alignements.js` | oui | oui | Corrigé : le script utilisé par Foundry existe mais utilisait une fenêtre Dialog V1 ; aide MJ DialogV2. |
| Résistance au feu | `systems/add2e/scripts/sorts/resistance-au-feu-resistance-au-froid.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 ; pas de réduction automatique des dégâts sans mécanisme centralisé confirmé. |
| Retardement du poison | `systems/add2e/scripts/sorts/ralentissement-du-poison.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 ; pas d'état poison inventé, aide MJ DialogV2. |
| Silence sur 5 mètres | `systems/add2e/scripts/sorts/silence-rayon-de-15-pieds.js` | oui | oui | Corrigé : le script utilisait une fenêtre Dialog V1 et posait un blocage verbal non centralisé ; aide MJ DialogV2. |

## Scripts créés

- Aucun : tous les chemins `onUse` déclarés existaient déjà dans `scripts/sorts/`.

## Scripts modifiés

- `scripts/sorts/augure.js`
- `scripts/sorts/cantique.js`
- `scripts/sorts/charme-serpents.js`
- `scripts/sorts/detection-des-charmes.js`
- `scripts/sorts/detection-des-pieges.js`
- `scripts/sorts/langage-des-animaux.js`
- `scripts/sorts/marteau-spirituel.js`
- `scripts/sorts/paralysie.js`
- `scripts/sorts/connaissance-des-alignements.js`
- `scripts/sorts/resistance-au-feu-resistance-au-froid.js`
- `scripts/sorts/ralentissement-du-poison.js`
- `scripts/sorts/silence-rayon-de-15-pieds.js`

## Scripts existants conservés hors chemins niveau 2

- Les scripts voisins non déclarés par le découpage Clerc niveau 2 n'ont pas été modifiés.
- Les aliases historiques non utilisés par ce découpage n'ont pas été recréés.

## Scripts non créés car aucun chemin onUse déclaré

- Aucun pour ce lot : les 12 sorts de Clerc niveau 2 ont un chemin `onUse` déclaré dans `audit/decoupage_fichier/clerc-niveau-2.json`.

## Justification de chaque modification

- Tous les scripts modifiés sont des chemins réellement déclarés dans le découpage Foundry.
- Les scripts historiques de niveau 2 utilisaient une fenêtre Dialog V1 ou une aide trop générique ; cela n'est pas conforme à la contrainte V13/V14/V15 demandant `DialogV2`.
- Les automatisations incertaines ont été retirées au profit d'une confirmation MJ : aucun blocage technique des composantes verbales, aucune réduction automatique des dégâts de feu, aucun état poison/paralysie inventé, aucune arme permanente créée.

## Niveau d'automatisation par sort

| Sort | Niveau d'automatisation retenu |
|---|---|
| Augure | Aide MJ DialogV2 : question et probabilité à résoudre par le MJ. |
| Cantique | Aide MJ DialogV2 : chant et effets à suivre manuellement. |
| Charme-serpents | Aide MJ DialogV2 : comportement des serpents à arbitrer. |
| Détection des charmes | Aide MJ DialogV2 : cible et sauvegarde rappelées. |
| Détection des pièges | Aide MJ DialogV2 : portée, durée et zone rappelées. |
| Langage animal | Aide MJ DialogV2 : dialogue animal et réaction à arbitrer. |
| Marteau spirituel | Aide MJ DialogV2 : dégâts 1d6/1d4, frappe comme le clerc, pas d'arme permanente. |
| Paralysie | Aide MJ DialogV2 : 1 à 3 cibles, durée 4 rounds + 1/niveau, sauvegarde annule, malus selon cibles. |
| Perception des alignements | Aide MJ DialogV2 : une créature par round, protections à arbitrer. |
| Résistance au feu | Aide MJ DialogV2 : +3 sauvegarde feu, quart/moitié des dégâts rappelés, pas de réduction automatique. |
| Retardement du poison | Aide MJ DialogV2 : 1 h/niveau, perte 1 PV/tour sans descendre sous 1 PV, sauvetage temporaire rappelé. |
| Silence sur 5 mètres | Aide MJ DialogV2 : 2 rounds/niveau, sphère 9 m, jet spécial sur cible non consentante, pas de blocage technique inventé. |

## Limites connues

- Test runtime Foundry non exécuté dans l'environnement Codex.
- Les scripts publient un résumé `ChatMessage` après confirmation, mais ne modifient pas les acteurs ou les tokens.
- Les effets actifs ne sont pas posés tant qu'un standard système centralisé et fiable n'est pas confirmé pour résistance au feu, paralysie, poison ou silence.

## Confirmations techniques

- Dialogues : `DialogV2` uniquement dans les scripts modifiés.
- Application persistante : aucune, donc aucun `ApplicationV2` nécessaire.
- Compatibilité visée : Foundry V13/V14/V15.
- JSON Foundry : non modifié.
- `audit/decoupage_fichier/*.json` : non modifié.
- `system.json` : non modifié.
- `audit/reference/*.json` : non modifié.
