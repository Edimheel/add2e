# Mapping onUse — Clerc niveau 3

## Périmètre et état

- Source de vérité : `audit/reference/manuel-joueurs-clerc-niveau-3.json`.
- Sorts analysés : **12/12**.
- Chemins onUse déclarés : **12/12**.
- Scripts déclarés existants : **12/12**.
- Scripts déjà raccordés à `runAdd2eSpell` : **0/12**.
- Aucun script, catalogue, runner, helper, JSON ou fichier central n'est modifié dans ce lot de préparation.

Le runner générique créé par `ac17f1c` couvre actuellement les familles `buff_debuff`, `status`, `detection`, `communication`, `temporary_weapon`, `protection`, `silence` et `divination_assist`. Les opérations existantes sont spécialisées pour les sorts Clerc niveau 2 ; les sorts ci-dessous doivent réutiliser une famille existante quand elle convient, puis ajouter une opération générique seulement lorsque leur règle diffère réellement.

## Synthèse

| Sort | Script onUse déclaré | Existe | Catégorie demandée | Famille générique proposée | Réutilisation directe | Nouvelle opération générique |
| --- | --- | ---: | --- | --- | --- | --- |
| Catalepsie | `scripts/sorts/catalepsie.js` | oui | statut | `status` | famille oui | `catalepsy` |
| Désenvoûtement | `scripts/sorts/delivrance-de-la-malediction.js` | oui | dissipation / statut inverse | nouvelle famille `dispel` | non | `remove_or_apply_curse` |
| Dissipation de la magie | `scripts/sorts/dissipation-de-la-magie.js` | oui | dissipation | nouvelle famille `dispel` | non | `dispel_magic` |
| Glyphe de garde | `scripts/sorts/glyphe-de-garde.js` | oui | création / contrôle / dégâts zone | nouvelle famille `creation` ou `ward` | non | `glyph_ward` |
| Guérison de la cécité | `scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js` | oui | statut / soin d'état | `status` | famille oui | `cure_or_inflict_blindness` |
| Guérison des maladies | `scripts/sorts/guerison-des-maladies.js` | oui | statut / soin d'état | `status` | famille oui | `cure_or_inflict_disease` |
| Localisation d'objets | `scripts/sorts/localisation-dobjets.js` | oui | détection | `detection` | famille oui | `locate_or_hide_object` |
| Lumière éternelle | `scripts/sorts/lumiere-continuelle.js` | oui | création / contrôle / statut | nouvelle famille `creation` | non | `continual_light_or_darkness` |
| Manne | `scripts/sorts/creation-de-nourriture-et-d-eau.js` | oui | création | nouvelle famille `creation` | non | `create_food_water_assist` |
| Nécro-animation | `scripts/sorts/animation-des-morts.js` | oui | invocation / contrôle | nouvelle famille `summon_assist` | non | `animate_dead` |
| Nécromancie | `scripts/sorts/communication-avec-les-morts.js` | oui | communication / divination aide MJ | `communication` | famille oui | `speak_with_dead` |
| Prière | `scripts/sorts/priere.js` | oui | protection / bonus-malus | `buff_debuff` | **oui, proche de Cantique** | `prayer` pour durée et absence de concentration |

## Mapping détaillé

### 1. Catalepsie

- **onUse** : `systems/add2e/scripts/sorts/catalepsie.js`, script existant.
- **Mécanique** : statut sur une personne touchée, durée `1 tour + 1 round/niveau`, aucun jet de sauvegarde.
- **Architecture** : réutiliser `runStatusSpell`; ajouter l'opération générique `catalepsy`.
- **ActiveEffect attendu** : durée `10 + niveau` rounds, tags prudents comme `etat:catalepsie` et `apparence:mort`; ne pas imposer un statut standard `dead` ou `unconscious` sans convention système confirmée.
- **VFX attendu** : VFX nécromancie/statut discret sur la cible.
- **Fichier central** : aucun requis pour une première implémentation par ActiveEffect et aide MJ.
- **Risque** : élevé si le système traite la cible comme réellement morte ou inconsciente ; faible avec tags dédiés et rappel MJ.

### 2. Désenvoûtement / Envoûtement

- **onUse** : `systems/add2e/scripts/sorts/delivrance-de-la-malediction.js`, script existant.
- **Mécanique** : dissipation ciblée d'une malédiction ; inverse en statut hostile avec sauvegarde et durée `1 tour/niveau`.
- **Architecture** : introduire une famille générique `dispel`, avec opération `remove_or_apply_curse`. Le mode inverse peut réutiliser les primitives de `status` et `rollSave`.
- **ActiveEffects attendus** : mode normal, suppression uniquement d'effets explicitement tagués malédiction ; mode inverse, effet temporaire décrivant l'une des trois malédictions validées ou une variante approuvée par le MJ.
- **VFX attendu** : abjuration/nettoyage pour le mode normal ; malédiction sombre pour l'inverse.
- **Fichier central** : aucun si la suppression reste limitée aux ActiveEffects correctement tagués. Une gestion globale des objets maudits nécessiterait une convention centrale ultérieure.
- **Risque** : suppression destructive d'effets non concernés ; interprétation des malédictions personnalisées ; jet de toucher de l'inverse.

### 3. Dissipation de la magie

- **onUse** : `systems/add2e/scripts/sorts/dissipation-de-la-magie.js`, script existant.
- **Mécanique** : dissipation de zone/cible avec chance `50 %`, `+5 %` par niveau supérieur et `-2 %` par niveau inférieur ; automatique sur la magie du lanceur.
- **Architecture** : nouvelle famille `dispel`, opération `dispel_magic` réutilisable par toutes les classes.
- **ActiveEffects attendus** : suppression des effets dissipables réussis ; éventuellement marque temporaire d'un round pour un objet magique neutralisé, seulement si un modèle sûr existe.
- **VFX attendu** : onde d'abjuration de zone et éclat sur chaque effet dissipé.
- **Fichier central** : probablement requis pour une automatisation complète : convention commune d'origine, niveau du lanceur, caractère dissipable et neutralisation temporaire des objets. Sans cela, limiter l'opération à une aide MJ et aux ActiveEffects structurés.
- **Risque** : très élevé ; suppression irréversible, informations d'origine absentes, permissions, portée de zone et objets magiques.

### 4. Glyphe de garde

- **onUse** : `systems/add2e/scripts/sorts/glyphe-de-garde.js`, script existant.
- **Mécanique** : création permanente d'une garde déclenchable, pouvant produire dégâts, aveuglement, paralysie ou autre magie validée.
- **Architecture** : nouvelle famille générique `creation` ou `ward`, opération `glyph_ward`; réutiliser ensuite les primitives dégâts/statut lors du déclenchement.
- **ActiveEffects attendus** : aucun simple ActiveEffect ne représente correctement une zone permanente. Prévoir un document de scène ou un marqueur structuré avec condition, mot de passe, effet choisi, niveau et état déclenché.
- **VFX attendu** : tracé lumineux lors de l'incantation, disparition du glyphe, VFX correspondant lors du déclenchement.
- **Fichier central** : requis pour une automatisation complète du déclenchement à l'entrée, au toucher ou à l'ouverture. Première version recommandée : création/aide MJ sans déclenchement automatique.
- **Risque** : très élevé ; persistance de scène, déclenchement géométrique, consommation conditionnelle, choix d'effets et sauvegarde variable.

### 5. Guérison de la cécité / Cécité

- **onUse** : `systems/add2e/scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js`, script existant malgré un nom historique plus large que la référence Clerc niveau 3.
- **Mécanique** : soin d'état permanent ; inverse en statut hostile après toucher et sauvegarde.
- **Architecture** : réutiliser `runStatusSpell`; ajouter `cure_or_inflict_blindness`.
- **ActiveEffects attendus** : mode normal, retirer uniquement les effets structurés de cécité curable ; inverse, effet permanent `etat:cecite` avec statut standard aveuglé seulement s'il existe.
- **VFX attendu** : soin/lumière sur la cible ; obscurcissement sur l'inverse.
- **Fichier central** : aucun si les états sont tagués. Le jet de toucher doit réutiliser une API centrale existante plutôt que réimplémenter l'attaque.
- **Risque** : confusion avec organes détruits, suppression d'une cécité non curable, absence d'API claire pour le jet de toucher.

### 6. Guérison des maladies / Contamination

- **onUse** : `systems/add2e/scripts/sorts/guerison-des-maladies.js`, script existant.
- **Mécanique** : soin d'état ; inverse en maladie progressive après toucher et sauvegarde.
- **Architecture** : réutiliser `runStatusSpell`; ajouter `cure_or_inflict_disease`.
- **ActiveEffects attendus** : mode normal, retirer les effets structurés de maladie ; inverse, effet `etat:contamination` avec délai `1d6 tours` et rappel des pertes de PV/Force.
- **VFX attendu** : purification/soin ; infection sombre pour l'inverse.
- **Fichier central** : nécessaire uniquement pour automatiser proprement les pertes périodiques de PV et de Force. Première version recommandée : ActiveEffect de suivi et aide MJ.
- **Risque** : périodicité, minimum à 10 %, altération de Force, maladie non standardisée et jet de toucher.

### 7. Localisation d'objets / Dissimulation d'objets

- **onUse** : `systems/add2e/scripts/sorts/localisation-dobjets.js`, script existant.
- **Mécanique** : détection directionnelle ; inverse en protection contre la détection.
- **Architecture** : réutiliser `runDetectionSpell`; ajouter `locate_or_hide_object`.
- **ActiveEffects attendus** : mode localisation, effet lanceur de `niveau` rounds avec portée calculée ; inverse, marque structurée sur l'objet si le système permet un effet d'Item, sinon aide MJ.
- **VFX attendu** : pulsation/boussole de divination autour du lanceur ; voile discret sur l'objet dissimulé.
- **Fichier central** : aucun pour l'aide MJ. Une vraie recherche géométrique d'objets de scène ou d'inventaire demanderait un service central dédié.
- **Risque** : révélation d'informations réservées au MJ, objets hors scène, description insuffisante, êtres vivants à exclure.

### 8. Lumière éternelle / Ténèbres éternelles

- **onUse** : `systems/add2e/scripts/sorts/lumiere-continuelle.js`, script existant.
- **Mécanique** : création permanente de lumière ou ténèbres ; statut aveuglé possible sur créature après sauvegarde ratée.
- **Architecture** : nouvelle famille `creation`, opération `continual_light_or_darkness`; réutiliser `runStatusSpell` pour l'aveuglement.
- **ActiveEffects attendus** : marque permanente sur créature/objet ; effet de cécité sur échec. Pour un point dans l'espace, un ActiveEffect seul ne suffit pas.
- **VFX attendu** : halo lumineux permanent ou sphère de ténèbres ; flash sur échec de sauvegarde.
- **Fichier central** : probablement requis pour créer et supprimer proprement des lumières persistantes de scène et gérer l'opposition lumière/ténèbres/dissipation.
- **Risque** : documents de scène persistants, sauvegarde et placement derrière la cible, opposition des effets, nettoyage après dissipation.

### 9. Manne

- **onUse** : `systems/add2e/scripts/sorts/creation-de-nourriture-et-d-eau.js`, script existant.
- **Mécanique** : création de nourriture/eau selon le niveau.
- **Architecture** : nouvelle famille générique `creation`, opération `create_food_water_assist`.
- **ActiveEffects attendus** : aucun. Un résumé de quantité et un ChatMessage suffisent pour la première version.
- **VFX attendu** : matérialisation douce de nourriture et d'eau au point choisi.
- **Fichier central** : aucun. Ne pas créer automatiquement des Items d'inventaire tant qu'un modèle de ration/eau partagé n'est pas confirmé.
- **Risque** : interprétation des volumes et création d'Items permanents non standardisés. Faible en aide MJ.

### 10. Nécro-animation

- **onUse** : `systems/add2e/scripts/sorts/animation-des-morts.js`, script existant.
- **Mécanique** : invocation/création et contrôle permanent de squelettes ou zombies, maximum un par niveau.
- **Architecture** : nouvelle famille générique `summon_assist`, opération `animate_dead`.
- **ActiveEffects attendus** : marque structurée de contrôle sur les créatures invoquées, liée au lanceur et dissipable. Aucun effet seul ne doit fabriquer arbitrairement les créatures.
- **VFX attendu** : énergie nécromantique sur les corps puis apparition/animation des morts-vivants.
- **Fichier central** : requis pour une automatisation complète : modèles de créatures, création de tokens/acteurs, propriété, contrôle, lien de dissipation et nettoyage. Première version recommandée : aide MJ avec limite calculée.
- **Risque** : très élevé ; création permanente d'acteurs/tokens, permissions, corps valides, contrôle et dissipation.

### 11. Nécromancie (communication avec les morts)

- **onUse** : `systems/add2e/scripts/sorts/communication-avec-les-morts.js`, script existant.
- **Mécanique** : communication/divination assistée par le MJ, avec tableau dépendant du niveau.
- **Architecture** : réutiliser `runCommunicationSpell`; ajouter `speak_with_dead`. Les réponses restent au MJ.
- **ActiveEffects attendus** : facultatif sur le lanceur ou le corps, pour suivre durée et nombre de questions ; aucun statut de créature vivante.
- **VFX attendu** : halo nécromantique discret sur les restes et texte de questions restantes.
- **Fichier central** : aucun.
- **Risque** : niveau minimal implicite, représentation du cadavre, langue commune et réponses relevant exclusivement du MJ.

### 12. Prière

- **onUse** : `systems/add2e/scripts/sorts/priere.js`, script existant.
- **Mécanique** : bonus/malus de zone aux attaques, dégâts et sauvegardes pendant `1 round/niveau`.
- **Architecture** : réutilisation la plus directe de `runBuffDebuffSpell`; ajouter l'opération `prayer` dérivée de Cantique mais sans concentration ni retrait manuel.
- **ActiveEffects attendus** : alliés `bonus_attaque:1`, `bonus_degats:1`, `bonus_save:1`; ennemis `malus_attaque:-1`, `malus_degats:-1`, `bonus_save:-1`; durée `niveau` rounds.
- **VFX attendu** : aura sacrée autour du lanceur et éclat distinct sur alliés/ennemis.
- **Fichier central** : aucun ; les intégrations centrales nécessaires aux bonus/malus existent déjà pour Cantique.
- **Risque** : régression si l'opération réutilise directement Cantique et conserve par erreur concentration, immobilité ou durée manuelle.

## Adaptations génériques proposées

Avant d'implémenter les sorts, compléter l'architecture sans créer de runner de classe ou de niveau :

1. Ajouter au runner générique une famille `creation` pour les créations sans modèle d'Item imposé et les aides MJ persistantes.
2. Ajouter une famille `dispel` qui ne supprime que les effets explicitement structurés et autorisés.
3. Ajouter une famille `summon_assist` qui calcule et documente l'invocation sans créer arbitrairement acteurs ou tokens.
4. Étendre les familles existantes `status`, `detection`, `communication` et `buff_debuff` par opérations génériques.
5. Reporter toute automatisation destructive ou persistante jusqu'à confirmation d'une convention centrale.

## Lot d'implémentation limité et ordonné

### Lot A — simples et aide MJ

1. **Manne** : création assistée, aucun ActiveEffect.
2. **Nécromancie** : communication assistée, tableau niveau/durée/questions.
3. **Localisation d'objets** : détection assistée et effet temporaire sur le lanceur.

### Lot B — ActiveEffects structurés

4. **Prière** : réutilisation de `buff_debuff`, durée fixe par niveau.
5. **Catalepsie** : statut dédié sans simuler la mort réelle.
6. **Guérison de la cécité** : retrait/application prudente d'un état structuré.
7. **Guérison des maladies** : retrait d'état et suivi MJ de l'inverse.

### Lot C — sauvegardes, dissipation et effets opposés

8. **Désenvoûtement** : suppression taguée et inverse avec sauvegarde.
9. **Lumière éternelle** : sauvegarde et aveuglement ; persistance de scène reportée.

### Lot D — complexes, persistants ou très MJ

10. **Dissipation de la magie** : d'abord aide MJ/ActiveEffects structurés, automatisation globale après convention centrale.
11. **Glyphe de garde** : aide MJ et marqueur, déclenchement automatique reporté.
12. **Nécro-animation** : aide MJ et limite calculée, création automatique de créatures reportée.

## Risques transversaux et garde-fous

- Les scripts existants contiennent des implémentations historiques : leur présence ne signifie pas qu'ils sont conformes au catalogue/runner générique actuel.
- Ne jamais supprimer un ActiveEffect sans tag dissipable ou malédiction explicitement reconnu.
- Ne jamais créer de lumière, acteur, token, Item ou zone permanente sans convention de cycle de vie et de suppression.
- Les inverses exigeant un jet de toucher doivent réutiliser le moteur d'attaque existant ; ne pas recréer un système parallèle.
- Les sauvegardes doivent passer par les primitives génériques et refuser l'application si la valeur est indisponible.
- Toute information secrète de détection/divination doit être adressée au MJ.
- Chaque futur onUse doit conserver DialogV2, VFX, ChatMessage et retours stricts `true`/`false`.

## Validation de ce lot de préparation

- Rapport uniquement ; aucun script ou JSON modifié.
- Aucun onUse créé.
- Les 12 chemins déclarés et l'existence des 12 scripts ont été vérifiés.
- `git status --short` attendu : uniquement `audit/rapports/ONUSE-CLERC-NIVEAU-3-MAPPING.md` avant commit.
