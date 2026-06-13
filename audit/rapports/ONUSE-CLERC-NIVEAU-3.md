# onUse — Clerc niveau 3

## Lot A fonctionnel

Le Lot A reste raccordé à l’architecture générique runAdd2eSpell, sans runner de classe ni helper par niveau. Les trois opérations produisent désormais un résultat Foundry exploitable avant de retourner true.

| Sort | Résultat fonctionnel | VFX | ActiveEffect / Item |
| --- | --- | --- | --- |
| Manne | calcule 27 dm³/niveau, choisit nourriture/eau/parts égales et l’inventaire destinataire | matérialisation sur lanceur/cibles | crée un ou deux Items objet temporaires et traçables avec quantité en dm³ |
| Nécromancie | aide MJ structurée et suivi technique du nombre de questions | nécromancie sur les restes sélectionnés ou le lanceur | ActiveEffect sur la cible/restes ou le lanceur, avec durée et questions restantes |
| Localisation d’objets | calcule portée/durée et conserve la description de l’objet sans révélation automatique | détection sur le lanceur | ActiveEffect exploitable avec mode, objet, portée, durée et interdiction de révélation automatique |

## Lot B fonctionnel

Le Lot B ajoute quatre opérations génériques au catalogue et au runner, puis raccorde les scripts historiques à `runAdd2eSpell`.

| Sort | Résultat fonctionnel | VFX | ActiveEffect / limite |
| --- | --- | --- | --- |
| Prière | applique aux cibles sélectionnées les bonus/malus temporaires aux attaques, dégâts et sauvegardes | aura sacrée sur lanceur/cibles | ActiveEffects `etat:priere_allie` ou `etat:priere_ennemi`, durée 1 round/niveau |
| Catalepsie | applique un état simulant la mort sans toucher aux statuts vitaux réels | nécromancie/statut discret sur la cible | ActiveEffect `etat:catalepsie`, `apparence:mort`, durée 1 tour + 1 round/niveau |
| Guérison de la cécité | retire uniquement les effets structurés de cécité curable ou applique l’inverse après toucher/sauvegarde | soin/lumière ou obscurcissement | retrait tagué ; inverse `etat:cecite` sans suppression d’effets non tagués |
| Guérison des maladies | retire uniquement les effets structurés de maladie curable ou applique l’inverse après toucher/sauvegarde | purification ou infection sombre | retrait tagué ; inverse `etat:contamination` avec délai 1d6 tours suivi par le MJ |

## Champs techniques et limites

- Les Items de Manne suivent la convention système type objet et system.quantite ; leurs flags.add2e assurent la traçabilité du sort, du créateur et du temps de création.
- Nécromancie porte effectType speak_with_dead, questionsMax, questionsRemaining, maxTimeSinceDeath et requiresGMAnswers. Aucune réponse n’est inventée.
- Localisation d’objets porte effectType locate_object, mode, objectDescription, rangeInches, durationRounds et noAutomaticReveal. Aucune information secrète n’est révélée automatiquement.
- Le helper de création d’Items ajouté au socle est générique et réutilisable.
- Prière réutilise les tags déjà lus par les résolveurs centraux de Cantique : `bonus_attaque`, `bonus_degats`, `bonus_save`, `malus_attaque`, `malus_degats` et `bonus_save:-1`.
- Catalepsie n’utilise jamais `dead`, `mort`, `unconscious` ou `inconscient` pour éviter une interaction dangereuse avec les statuts vitaux.
- Les guérisons d’état ne suppriment que des ActiveEffects explicitement tagués comme curables. Les effets non tagués restent sous contrôle du MJ.
- La contamination inverse crée un suivi structuré, mais les pertes périodiques de PV/Force restent suivies par le MJ faute de moteur périodique central fiable.

## Compatibilité et validation

- Foundry V13/V14/V15 ; DialogV2 uniquement ; VFX et ChatMessage pour les sorts raccordés.
- Annulation, précondition invalide ou échec de création technique retourne false ; true n’est retourné qu’après création, retrait ou pose d’effet.
- Aucun Dialog legacy, fallback legacy, runner de classe ou helper par niveau.
- Aucun JSON Foundry, référence, source, découpage, composant, system.json, AGENTS.md ou workflow modifié.
- node --check et node audit/tools/validate-reference-schema.mjs restent à exécuter dans l’environnement de travail complet ; les modifications sont limitées aux scripts génériques/onUse et au rapport.
