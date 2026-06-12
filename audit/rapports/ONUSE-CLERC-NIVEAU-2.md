# onUse — Clerc niveau 2

## État final

Les 12 onUse raccordés utilisent désormais un helper partagé DialogV2/VFX et des mécanismes Foundry réels. Les composants restent exclusivement gérés par le résolveur central de lancement.

| Sort | Mécanique réellement automatisée | ActiveEffect / limite restante |
| --- | --- | --- |
| Augure | calcul 70 % + niveau et saisie de l'action | aucun ActiveEffect ; réponse au MJ |
| Cantique | bonus/malus attaques, dégâts et sauvegardes | effets lanceur/cibles ; retrait manuel quand chant/immobilité cesse |
| Charme-serpents | validation ophidienne/PV et durée contextuelle | charme/calme temporisé |
| Détection des charmes | lecture des états structurés | effet de détection ; états non structurés au MJ |
| Détection des pièges | chance 10 %/niveau et zone structurée | effet 3 tours ; révélation au MJ |
| Langage animal | durée et cible de communication | effets temporaires lanceur/cible |
| Marteau spirituel | arme temporaire équipée, dégâts P-M/G, valeur magique | item lié à un effet et supprimé à expiration/retrait |
| Paralysie | JP réel et malus 0/-1/-2 | effet visible sur échec ; aucune application si JP indisponible |
| Perception des alignements | lecture des champs structurés, carte MJ | effet 1 tour |
| Résistance au feu | +3 JP et réduction quart/moitié | effet lu par le résolveur central de dégâts feu |
| Retardement du poison | suspension structurée | effet 1 heure/niveau ; perte périodique suivie par le MJ |
| Silence sur 5 mètres | JP non-consentant et blocage des sorts verbaux attachés | zone fixe suivie par le MJ faute de résolveur géométrique central |

## Fichiers centraux modifiés

- scripts/effects-engine.mjs : lit bonus_save global pour Cantique.
- scripts/add2e-attack/02-damage.mjs : lit les tags de résistance au feu, lance le JP et réduit les dégâts.
- scripts/add2e-attack/06-cast-spell.mjs : refuse avant consommation un sort verbal si le lanceur porte Silence.
- scripts/add2e/18c-active-effects-expiration.mjs et scripts/add2e-active-effects-expire.js : suppriment l'arme temporaire liée au Marteau spirituel.
- scripts/sorts/clerc-niveau-2-mechanics.mjs : helper partagé évitant la duplication des 12 onUse.

## Flags et intégrations

Les effets utilisent flags.add2e.tags avec notamment bonus_attaque, bonus_degats, bonus_save, malus_attaque, malus_degats, etat:paralysie, resistance:feu, bonus_save_vs:feu:3, poison:retarde, silence:verbal et anti_sort:verbal. Les durées numériques sont exprimées en rounds et expirent par le moteur existant.

## Compatibilité, limites et validations

- DialogV2 uniquement ; aucune ApplicationV2 persistante, aucun Dialog legacy et aucun fallback legacy.
- Chaque sort conserve un VFX via ADD2E_PLAY_SPELL_FX ou le canvas natif.
- Annulation/précondition invalide retourne false ; résolution confirmée retourne true.
- Les composants ne sont pas modifiés ni consommés par les onUse.
- Compatible Foundry V13/V14/V15 grâce aux APIs Foundry existantes et accès défensifs.
- node --check exécuté sur les modules ; onUse vérifiés dans une enveloppe AsyncFunction à cause du return de niveau supérieur requis par Foundry.
- node audit/tools/validate-reference-schema.mjs exécuté.
