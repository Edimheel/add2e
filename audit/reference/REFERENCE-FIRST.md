# Strategie reference-first pour les sorts

Source de verite : Manuel des joueurs AD&D 2e.

## Principe

Les fichiers `audit/reference/manuel-joueurs-*.json` doivent etre enrichis avant toute mise a jour du JSON Foundry.

Le JSON Foundry ne doit jamais servir a inventer une regle manquante. Il doit seulement recevoir des corrections issues d'une reference detaillee et validee.

## Regle stricte de description

Chaque sort de reference doit utiliser un seul champ de description :

- `description`

Les anciens champs alternatifs de description sont interdits dans les references de sorts. La liste executable de ces champs est maintenue dans `audit/tools/validate-reference-schema.mjs` afin d'eviter de conserver leurs noms interdits dans les documents de reference.

Le champ `description` doit contenir le texte normalise issu du Manuel des joueurs. Normaliser signifie :

- supprimer les retours ligne artificiels du PDF ;
- supprimer les césures de fin de ligne ;
- conserver les accents, apostrophes et ponctuations utiles ;
- conserver les valeurs de regle telles que 1d4, 3 rounds, +1, -1, 70 %, etc. ;
- ne pas reecrire le sens du texte ;
- ne pas melanger description et notes techniques.

## Champs de reference attendus

Chaque sort de reference doit contenir, autant que possible :

- `ordre`
- `nom`
- `ecole`
- `niveau`
- `portee`
- `duree`
- `zone_effet`
- `composantes`
- `temps_incantation`
- `jet_sauvegarde`
- `composants_materiels_source`
- `description`
- `notes_regles`
- `onuse_strategy`
- `effectProfile` ou un profil associe dans `audit/reference/effect-profiles/`
- `status`

## effectProfile

`effectProfile` est une donnee de reference preparatoire. Elle decrit les effets mecaniques qu'un sort peut produire sans modifier immediatement les exports Foundry.

Pendant la phase de stabilisation, les profils peuvent etre conserves dans un fichier associe sous `audit/reference/effect-profiles/`. Une fois le modele valide, ils pourront etre reintegres dans chaque entree de sort du fichier `audit/reference/manuel-joueurs-*.json`, puis seulement ensuite synchronises vers Foundry.

Le transfert futur vers Foundry devra viser :

- `system.effectProfile`

ou, si une contrainte technique apparaît plus tard :

- `flags.add2e.effectProfile`

Le choix recommande reste `system.effectProfile`, car il s'agit d'une donnee metier du systeme ADD2E.

Un `effectProfile` doit pouvoir indiquer :

- un identifiant stable d'effet ;
- un libelle lisible ;
- le type d'effet : bonus, malus, soin, degat, detection, lumiere, resistance, controle, protection, creation de ressource ;
- la cible ;
- la duree ;
- les tags techniques non destructifs ;
- le niveau d'automatisation retenu ;
- si l'effet est reutilisable par un futur generateur d'objet magique ;
- les limites qui doivent rester arbitrees par le MJ.

Un `effectProfile` ne doit pas inventer une mecanique absente du Manuel. Quand l'automatisation est incertaine, le champ doit marquer l'effet comme aide MJ plutot que comme application automatique.

## Regle de patch JSON

Un patch JSON peut ajouter ou corriger :

- le nom visible si la correspondance est certaine ;
- les champs vides ;
- les chemins `onUse`, `onuse`, `on_use` ;
- les composants si la reference est complete ;
- les tags techniques non destructifs ;
- `effectProfile` seulement quand le profil d'effet a ete valide dans le codex.

Un patch JSON ne doit jamais ecraser :

- la description systeme existante ;
- les champs historiques de description systeme ;
- une liste de composants existante non vide ;
- un script `onUse` existant ;
- un objet de sort existant avec un objet minimal.

## Creation de sort manquant

Un sort manquant ne doit etre cree dans le JSON Foundry que si sa reference contient les champs principaux du Manuel et le champ `description`. Sinon, il doit rester dans un patch de preparation, avec le statut `reference_a_completer`.

## onUse

Un `onUse` generique peut etre cree uniquement comme point d'entree technique, mais il doit etre marque comme generique et ne doit pas pretendre appliquer une mecanique non verifiee.

Les vrais effets automatiques doivent etre ajoutes seulement quand la reference contient une strategie `onuse_strategy` assez precise.
