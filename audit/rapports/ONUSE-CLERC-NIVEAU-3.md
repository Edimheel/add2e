# onUse — Clerc niveau 3

## Lot A implémenté

Le Lot A raccorde trois scripts existants à l'architecture générique `runAdd2eSpell`, sans runner de classe ni helper par niveau.

| Sort | Famille / opération générique | Automatisation | VFX | ActiveEffect |
| --- | --- | --- | --- | --- |
| Manne | `creation / create_food_water_assist` | calcule 27 dm³/niveau et la capacité journalière ; choix nourriture, eau ou parts égales | matérialisation générique | aucun |
| Nécromancie | `communication / speak_with_dead` | aide MJ structurée avec temps depuis la mort, durée et questions selon le niveau | nécromancie sur les restes sélectionnés ou le lanceur | aucun |
| Localisation d'objets | `detection / locate_or_hide_object` | calcule portée 6 pouces + 1/niveau et durée 1 round/niveau ; détails réservés au MJ | détection sur le lanceur | effet temporaire de localisation ou dissimulation sur le lanceur |

## Limites conservées

- Manne ne crée aucun Item permanent ; le ChatMessage documente uniquement les quantités créées.
- Nécromancie n'invente aucune réponse et ne crée aucun acteur, token ou état permanent.
- Localisation d'objets ne recherche ni ne révèle automatiquement une position ou une information secrète. L'ActiveEffect sert uniquement au suivi temporaire.
- Aucun fichier central n'a dû être adapté.

## Compatibilité et validation

- Foundry V13/V14/V15 ; DialogV2 uniquement ; VFX et ChatMessage pour les trois sorts.
- Annulation ou précondition invalide retourne `false` ; lancement confirmé retourne `true`.
- Aucun Dialog legacy, fallback legacy, runner de classe ou helper par niveau.
- Aucun JSON Foundry, référence, source, découpage, `system.json`, `AGENTS.md` ou workflow modifié.
- `node --check` exécuté sur les modules et sur les scripts onUse enveloppés dans une fonction asynchrone.
- `node audit/tools/validate-reference-schema.mjs` exécuté.
