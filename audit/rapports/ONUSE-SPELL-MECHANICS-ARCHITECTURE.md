# Architecture onUse générique des sorts

## Fichiers génériques

- `add2e-spell-mechanics.mjs` fournit les primitives bas niveau communes : contexte, cibles, DialogV2, VFX, ChatMessage, ActiveEffects, durées, sauvegardes, statuts, flags et application multi-cibles.
- `add2e-spell-catalog.mjs` décrit chaque sort par une configuration sans logique de classe : slug, nom, mécanique, opération, VFX, cible, durée, sauvegarde, effets, flags et limites utiles.
- `add2e-spell-runner.mjs` expose `runAdd2eSpell` et les runners génériques par famille de mécanique. Les règles spécialisées restent internes à ce module et sont sélectionnées par l'opération déclarée.

## Ajouter un sort

1. Ajouter sa configuration au catalogue avec une famille de mécanique existante.
2. Raccorder son onUse à `runAdd2eSpell` avec son slug.
3. Réutiliser le runner de famille existant ; ajouter une opération interne uniquement si la règle du sort ne peut pas être décrite par une opération existante.
4. Valider DialogV2, VFX, retours true/false et compatibilité Foundry V13/V14/V15.

## Principes

Les mécaniques sont indépendantes de la classe du lanceur. Un Clerc, Druide, Magicien ou Illusionniste réutilise le même catalogue, le même routeur et les mêmes familles de résolution. Aucun runner par classe ou niveau ne doit être créé : ces découpages dupliqueraient ciblage, sauvegardes, effets, VFX et messages sans apporter de règle mécanique.
