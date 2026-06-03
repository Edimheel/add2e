# Modèle onUse — Clerc niveau 1

## Scripts analysés

- `scripts/sorts/apaisement.js`
- `scripts/sorts/aquagenese.js`
- `scripts/sorts/benediction.js`
- `scripts/sorts/detection-de-la-magie.js`
- `scripts/sorts/detection-du-mal.js`
- `scripts/sorts/injonction.js`
- `scripts/sorts/lumiere.js`
- `scripts/sorts/protection-contre-le-mal.js`
- `scripts/sorts/resistance-au-froid.js`
- `scripts/sorts/sanctuaire.js`
- `scripts/sorts/soins-mineurs.js`

Le slug attendu `purification-de-l-eau-et-des-aliments.js` n'existe pas dans `scripts/sorts/`, mais l'export source contient un chemin historique `purification-de-la-nourriture-et-de-la-boisson.js`. Aucun JSON Foundry n'a été modifié.

## Structure commune observée

- Les scripts sont autonomes et résolvent le lanceur depuis `actor`, `token`, `item`, `sort` ou `args` selon le contexte d'appel Foundry.
- Les sorties visuelles utilisent une carte `ChatMessage` avec titre du sort, lanceur, cibles et rappel de règle.
- Les scripts robustes distinguent l'annulation ou l'échec technique (`false`) du lancement effectif (`true`).
- Les effets automatisés restent limités aux mécaniques simples : bonus temporaires, soins/dégâts simples, détection ou rappel MJ.

## Conventions de nommage

- Fichiers en kebab-case sans accent dans `scripts/sorts/`.
- Tags d'effets sous `flags.add2e.tags` lorsqu'un `ActiveEffect` est posé.
- Préfixes de journalisation de type `[ADD2E][NOM_DU_SORT]` ou `[ADD2E][SORT_ONUSE][CLERC_N1]`.

## Imports

- Aucun import module n'est requis dans les scripts de niveau 1 analysés.
- La logique commune est souvent copiée localement dans le script plutôt qu'importée depuis un helper central.
- Cette duplication est conservée pour éviter une refonte globale non demandée.

## Usage de ChatMessage

- `ChatMessage.create` est utilisé pour publier le résultat ou l'aide MJ.
- `ChatMessage.getSpeaker` est utilisé quand le lanceur ou le token est disponible.
- Les messages distinguent généralement : sort lancé, cible, règle appliquée et limites de résolution.

## Usage de DialogV2

- La règle cible pour les nouveaux scripts est `foundry.applications.api.DialogV2`.
- Plusieurs scripts historiques de niveau 1 utilisent encore dialogue legacy V1; ils sont documentés comme dette technique et n'ont pas été modifiés pour préserver les onUse existants fonctionnels dans ce lot.

## Usage de ApplicationV2

- Aucun script de Clerc niveau 1 analysé ne nécessite une application persistante.
- Aucun `ApplicationV2` n'est donc requis pour le modèle retenu.

## Gestion des jets de sauvegarde

- Les jets complexes restent affichés comme information MJ.
- Les scripts ne supposent pas de sauvegarde moderne de type D&D 5e.
- L'automatisation n'est retenue que lorsque le type de jet et l'effet en cas de réussite/échec sont explicites.

## Gestion des ActiveEffect

- Les scripts qui appliquent un effet vérifient la cible et ajoutent des tags `add2e`.
- Les scripts les plus sûrs nettoient l'effet précédent portant le même tag avant d'en créer un nouveau.
- Les modifications directes d'acteur doivent être évitées sans possession ou relais MJ.

## Durée et expiration d'effets

- Les durées sont converties en rounds quand la règle est simple.
- Les champs `duration.rounds`, `duration.startRound`, `duration.startTime` et `duration.combat` sont utilisés quand un `ActiveEffect` est créé.
- Les durées de scène, rituelles ou dépendantes du MJ restent en aide MJ.

## Messages MJ / joueur

- Le modèle retenu pour les niveaux 2 à 7 affiche les informations essentielles au joueur et au MJ sans appliquer d'effet incertain.
- Les messages d'erreur doivent être explicites et ne pas consommer le sort.

## Conventions true/false

- `true` : le sort est effectivement lancé ou l'aide MJ est confirmée, donc le sort peut être consommé.
- `false` : dialogue annulé, DialogV2 indisponible ou échec technique bloquant, donc le sort ne doit pas être consommé.

## Compatibilité Foundry V13/V14/V15

- Les nouveaux scripts doivent utiliser `DialogV2` et `ChatMessage` uniquement.
- Aucun `Dialog` legacy, dialogue legacy V1 ou prompt legacy V1 ne doit être introduit.
- Aucun `Application` V1 ne doit être utilisé.

## Limites constatées

- Des scripts historiques contiennent encore des dialogues legacy.
- Les mécaniques de zone, invocation, charme, silence ou arbitrage prolongé ne sont pas automatisées sans validation Foundry.
- Les scripts de niveau 2 à 7 créés dans ce lot privilégient une aide MJ sûre lorsque l'automatisation complète serait incertaine.
