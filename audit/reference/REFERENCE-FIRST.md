# Strategie reference-first pour les sorts

Source de verite : Manuel des joueurs AD&D 2e.

## Principe

Les fichiers `audit/reference/manuel-joueurs-*.json` doivent etre enrichis avant toute mise a jour du JSON Foundry.

Le JSON Foundry ne doit jamais servir a inventer une regle manquante. Il doit seulement recevoir des corrections issues d'une reference detaillee et validee.

## Regle stricte de description

Chaque sort de reference doit utiliser un seul champ de description :

- `description`

Les champs suivants sont interdits dans les references de sorts :

- `description_exacte_manuel`
- `description_source`
- `description_reelle`
- `description_texte`
- `description_html`
- `description_resumee_regles`

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
- `status`

## Regle de patch JSON

Un patch JSON peut ajouter ou corriger :

- le nom visible si la correspondance est certaine ;
- les champs vides ;
- les chemins `onUse`, `onuse`, `on_use` ;
- les composants si la reference est complete ;
- les tags techniques non destructifs.

Un patch JSON ne doit jamais ecraser :

- `system.description` ;
- `system.description_reelle` ;
- `system.description_texte` ;
- `system.description_html` ;
- une liste de composants existante non vide ;
- un script `onUse` existant ;
- un objet de sort existant avec un objet minimal.

## Creation de sort manquant

Un sort manquant ne doit etre cree dans le JSON Foundry que si sa reference contient les champs principaux du Manuel et le champ `description`. Sinon, il doit rester dans un patch de preparation, avec le statut `reference_a_completer`.

## onUse

Un `onUse` generique peut etre cree uniquement comme point d'entree technique, mais il doit etre marque comme generique et ne doit pas pretendre appliquer une mecanique non verifiee.

Les vrais effets automatiques doivent etre ajoutes seulement quand la reference contient une strategie `onuse_strategy` assez precise.
