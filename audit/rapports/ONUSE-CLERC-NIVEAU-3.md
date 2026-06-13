# onUse — Clerc niveau 3

## Lot A fonctionnel

Le Lot A reste raccordé à l’architecture générique runAdd2eSpell, sans runner de classe ni helper par niveau. Les trois opérations produisent désormais un résultat Foundry exploitable avant de retourner true.

| Sort | Résultat fonctionnel | VFX | ActiveEffect / Item |
| --- | --- | --- | --- |
| Manne | calcule 27 dm³/niveau, choisit nourriture/eau/parts égales et l’inventaire destinataire | matérialisation sur lanceur/cibles | crée un ou deux Items objet temporaires et traçables avec quantité en dm³ |
| Nécromancie | aide MJ structurée et suivi technique du nombre de questions | nécromancie sur les restes sélectionnés ou le lanceur | ActiveEffect sur la cible/restes ou le lanceur, avec durée et questions restantes |
| Localisation d’objets | calcule portée/durée et conserve la description de l’objet sans révélation automatique | détection sur le lanceur | ActiveEffect exploitable avec mode, objet, portée, durée et interdiction de révélation automatique |

## Champs techniques et limites

- Les Items de Manne suivent la convention système type objet et system.quantite ; leurs flags.add2e assurent la traçabilité du sort, du créateur et du temps de création.
- Nécromancie porte effectType speak_with_dead, questionsMax, questionsRemaining, maxTimeSinceDeath et requiresGMAnswers. Aucune réponse n’est inventée.
- Localisation d’objets porte effectType locate_object, mode, objectDescription, rangeInches, durationRounds et noAutomaticReveal. Aucune information secrète n’est révélée automatiquement.
- Le helper de création d’Items ajouté au socle est générique et réutilisable.

## Compatibilité et validation

- Foundry V13/V14/V15 ; DialogV2 uniquement ; VFX et ChatMessage pour les trois sorts.
- Annulation, précondition invalide ou échec de création technique retourne false ; true n’est retourné qu’après création ou relais réussi.
- Aucun Dialog legacy, fallback legacy, runner de classe ou helper par niveau.
- Aucun JSON Foundry, référence, source, découpage, system.json, AGENTS.md ou workflow modifié.
- node --check et node audit/tools/validate-reference-schema.mjs exécutés.
