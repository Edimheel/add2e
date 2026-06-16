# EffectProfile — préparation objets magiques

## Objectif

Préparer les sorts pour une future génération d'objets magiques sans modifier immédiatement les exports Foundry.

Un objet magique ne doit pas copier aveuglément un script `onUse`. Il doit réutiliser un effet identifié dans la référence du sort, avec ses limites, ses tags et son niveau d'automatisation.

## Portée initiale

- Branche de travail : `codex/finalize-cleric-spells-and-scripts`.
- Source fonctionnelle visée : base Codex du PR #4.
- Premier lot : sorts de clerc niveau 1 déjà validés.
- Fichiers Foundry exportés : non modifiés.
- `system.json` : non modifié.

## Emplacement retenu

Pendant la phase de stabilisation, les profils d'effets sont conservés dans un fichier associé :

- `audit/reference/effect-profiles/manuel-joueurs-clerc-niveau-1.json`

Le fichier de référence principal reste la source du texte et des champs de règles :

- `audit/reference/manuel-joueurs-clerc-niveau-1.json`

Une fois le modèle validé, les profils pourront être réintégrés dans chaque entrée de sort du fichier principal, puis synchronisés vers Foundry.

Le transfert futur vers Foundry devra viser :

- `system.effectProfile`

ou, si une contrainte technique apparaît plus tard :

- `flags.add2e.effectProfile`

Le choix recommandé reste `system.effectProfile`, car il s'agit d'une donnée métier du système ADD2E.

## Principe d'héritage

Le profil d'effet ne répète pas les champs déjà présents dans la référence principale.

Les champs suivants sont hérités depuis `audit/reference/manuel-joueurs-clerc-niveau-1.json` :

- `ordre`
- `nom`
- `niveau`
- `portee`
- `duree`
- `zone_effet`
- `composantes`
- `temps_incantation`
- `jet_sauvegarde`
- `description`

Le profil ne définit une surcharge que si l'effet diffère réellement du sort principal :

- `durationOverride`
- `targetOverride`

Exemples :

- l'inverse `Ténèbres` de `Lumière` utilise `durationOverride`, car sa durée est la moitié de celle du sort normal ;
- l'effet offensif `Aveuglement par lumière` utilise `targetOverride`, car il vise spécifiquement les yeux ou le visage d'une créature ;
- `Soins mineurs` n'a pas besoin de répéter `portee`, `duree` ou `zone_effet`, car ces champs sont identiques à la référence principale.

## Structure cible allégée

```json
{
  "sourceSpellSlug": "benediction",
  "effects": [
    {
      "id": "bonus_moral_toucher",
      "label": "Bénédiction",
      "kind": "active_bonus",
      "targetOverride": "creatures_amicales_zone_non_engagees",
      "automation": "active_effect_or_mj_aid",
      "tags": [
        "effet:benediction",
        "bonus:moral:1",
        "bonus:toucher:1",
        "condition:non_engage_combat"
      ],
      "objectMagic": {
        "allowed": true,
        "defaultActivation": "activation",
        "defaultChargeCost": 1,
        "notes": "Respecter la condition des cibles non engagées."
      }
    }
  ]
}
```

## Règles de remplissage

- `sourceSpellSlug` relie le profil à la référence principale.
- `id` est local au sort ; il ne répète pas le slug du sort.
- `label` est lisible par le MJ.
- `kind` classe l'effet sans imposer une automatisation.
- `targetOverride` est absent si la cible du sort principal suffit.
- `durationOverride` est absent si la durée du sort principal suffit.
- `automation` indique le niveau de traitement possible.
- `tags` préparent la mécanique future mais ne doivent pas déclencher de cumul automatique tant qu'un moteur centralisé ne les lit pas.
- `objectMagic.allowed` indique si un générateur d'objet magique pourra proposer cet effet.
- `objectMagic.notes` documente les limites pour éviter un objet trop automatique ou hors règle.

## Niveaux d'automatisation

- `direct_actor_update_or_mj_aid` : effet simple pouvant modifier l'acteur, sous réserve de permissions ou relais MJ.
- `active_effect_or_mj_aid` : effet pouvant devenir un ActiveEffect, mais qui doit rester aide MJ si le moteur central n'est pas prêt.
- `scene_effect_or_mj_aid` : effet de scène, lumière, zone ou environnement.
- `attack_or_mj_aid` : effet qui nécessite un jet de toucher ou une résolution d'attaque.
- `mj_aid` : effet arbitré par le MJ, sans modification automatique.

## Usage futur par le générateur d'objets magiques

Le générateur devra :

1. sélectionner un sort source validé ;
2. lire `effectProfile.effects` ou le profil associé du sort ;
3. filtrer les effets dont `objectMagic.allowed` vaut `true` ;
4. créer un pouvoir dans `system.pouvoirs[]` de l'objet ;
5. conserver `linkedSpell` ou au minimum `linkedSpellSlug` et `linkedSpellEffectId` ;
6. choisir les charges, l'activation et les limites d'utilisation ;
7. ne pas modifier le script original du sort.

## Champs recommandés dans un pouvoir d'objet

```json
{
  "id": "objet_benediction_bonus_moral_toucher",
  "name": "Bénédiction",
  "mode": "spell_effect",
  "linkedSpellSlug": "benediction",
  "linkedSpellEffectId": "bonus_moral_toucher",
  "activation": "activation",
  "chargeCost": 1,
  "onUseSource": "linked_spell_effect",
  "effectTags": [
    "effet:benediction",
    "bonus:moral:1",
    "bonus:toucher:1"
  ]
}
```

## Limites volontaires

Cette étape ne crée pas encore :

- de générateur d'objet magique ;
- de nouvel importeur ;
- de transformation automatique des objets existants ;
- d'ActiveEffect systématique ;
- de nouveau script de sort.

Elle prépare seulement le codex pour que ces extensions puissent être faites sans réécrire les références.

## Compatibilité

- Foundry V13/V14/V15 : le modèle est seulement JSON et n'introduit aucun appel API incompatible.
- DialogV2/ApplicationV2 : aucun nouveau dialogue ou application n'est créé dans cette étape.
- Exports Foundry : non modifiés.
