# Audit de la cible globale des sorts Foundry

## Conclusion

Le fichier global réel est identifié avec une forte certitude comme `fvtt-spells-all.json` : c’est un export Foundry unique contenant des Items de sort.

Aucune donnée Foundry n’a été modifiée pendant cet audit.

## Fichier global et correspondances

- État de `fvtt-spells-all.json` : **présent, JSON valide et exploitable (3432419 octets; 421 Items de sort)**.
- Fichier global trouvé : **`fvtt-spells-all.json`**.
- Nombre de sorts trouvé dans la cible : **421**.
- Références disponibles : **413 sorts**, avec **410 IDs `foundry.id`**.
- Correspondances possibles via `foundry.id` vers `_id`/`id` : **410/410**.

## Emplacements vérifiés

- `packs/` : 376 fichiers, dont 38 JSON (.json: 38, .js: 1, .log: 124, sans extension: 176, .old: 17, .ldb: 20).
- `compendiums/` : absent.
- `templates/` : 28 fichiers, dont 2 JSON (.hbs: 26, .json: 2).
- `audit/decoupage_fichier/` : 33 fichiers, dont 31 JSON (.md: 1, .json: 31, .mjs: 1).

Les découpages contiennent **421 occurrences** dans **30 fichiers**, soit **421 IDs uniques**, dont **410/410** correspondent aux références. Ils ne constituent pas un fichier global.

## JSON contenant des Items de type sort

| Fichier | Sorts | IDs uniques | Correspondances référence | Racine |
|---|---:|---:|---:|---|
| `sources/Actor-Bestiaire.json` | 1707 | 1707 | 0/410 | objet JSON |
| `fvtt-spells-all.json` | 421 | 421 | 410/410 | objet JSON |
| `sources/Item-Sorts.manuel-joueur.normalise.json` | 414 | 414 | 0/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-1.json` | 30 | 30 | 29/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-5.json` | 25 | 25 | 24/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-3.json` | 24 | 24 | 24/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-4.json` | 24 | 24 | 24/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-6.json` | 24 | 24 | 24/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-2.json` | 23 | 23 | 23/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-7.json` | 16 | 16 | 16/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-8.json` | 16 | 16 | 16/410 | objet JSON |
| `audit/decoupage_fichier/clerc-niveau-1.json` | 14 | 14 | 12/410 | objet JSON |
| `audit/decoupage_fichier/clerc-niveau-3.json` | 13 | 13 | 12/410 | objet JSON |
| `audit/decoupage_fichier/druide-niveau-4.json` | 13 | 13 | 12/410 | objet JSON |
| `audit/decoupage_fichier/clerc-niveau-2.json` | 12 | 12 | 12/410 | objet JSON |
| `audit/decoupage_fichier/clerc-niveau-4.json` | 12 | 12 | 10/410 | objet JSON |
| `audit/decoupage_fichier/druide-niveau-1.json` | 12 | 12 | 12/410 | objet JSON |
| `audit/decoupage_fichier/druide-niveau-2.json` | 12 | 12 | 12/410 | objet JSON |
| `audit/decoupage_fichier/druide-niveau-3.json` | 12 | 12 | 12/410 | objet JSON |
| `audit/decoupage_fichier/illusionniste-niveau-2.json` | 12 | 12 | 12/410 | objet JSON |
| `audit/decoupage_fichier/illusionniste-niveau-3.json` | 12 | 12 | 12/410 | objet JSON |
| `audit/decoupage_fichier/magicien-niveau-9.json` | 12 | 12 | 12/410 | objet JSON |
| `audit/decoupage_fichier/clerc-niveau-5.json` | 11 | 11 | 10/410 | objet JSON |
| `audit/decoupage_fichier/clerc-niveau-7.json` | 11 | 11 | 10/410 | objet JSON |
| `audit/decoupage_fichier/illusionniste-niveau-1.json` | 11 | 11 | 11/410 | objet JSON |
| `audit/decoupage_fichier/clerc-niveau-6.json` | 10 | 10 | 10/410 | objet JSON |
| `audit/decoupage_fichier/druide-niveau-5.json` | 10 | 10 | 10/410 | objet JSON |
| `audit/decoupage_fichier/druide-niveau-6.json` | 10 | 10 | 10/410 | objet JSON |
| `audit/decoupage_fichier/druide-niveau-7.json` | 10 | 10 | 10/410 | objet JSON |
| `audit/decoupage_fichier/illusionniste-niveau-4.json` | 8 | 8 | 8/410 | objet JSON |
| `audit/decoupage_fichier/illusionniste-niveau-5.json` | 8 | 8 | 8/410 | objet JSON |
| `audit/decoupage_fichier/illusionniste-niveau-6.json` | 8 | 8 | 7/410 | objet JSON |
| `audit/decoupage_fichier/illusionniste-niveau-7.json` | 6 | 6 | 6/410 | objet JSON |

## Schéma Foundry observé

- Champs de description disponibles dans la cible : `system.description`, `system.description_reelle`, `system.description_source`, `system.description_texte`, `system.description_html`.
- Champs de composants disponibles dans la cible : `system.composantes`, `system.composants_materiels`, `system.composants_materiels_a_renseigner`, `system.composants_materiels_choix_manuel`, `system.composants_materiels_reference`, `system.composants_materiels_source`, `system.composants_materiels_verification_recommandee`.
- Les références stockent les descriptions dans `spells[].description` et les composants structurés dans `spells[].composants_materiels_objets`.
- La clé fiable de rapprochement est `spells[].foundry.id` vers `_id` ou `id`; aucun rapprochement automatique par nom n’est recommandé.

## Risque de modification

Modéré : les IDs correspondent, mais remplacer les Items complets écraserait des champs techniques Foundry.

Un remplacement d’Item complet serait destructif : il pourrait écraser images, effets, flags, listes, niveaux, données système et chemins `onUse`. Les composants de référence ne doivent pas être injectés avant confirmation d’un champ Foundry compatible.

## Méthode d’injection proposée

1. Confirmer et sauvegarder la cible globale avant toute écriture.
2. Construire un index de la cible par `_id`/`id`.
3. Apparier exclusivement par `foundry.id`; signaler absences et doublons.
4. Modifier uniquement le champ de description observé (`system.description`, `system.description_reelle`, `system.description_source`, `system.description_texte`, `system.description_html`).
5. Définir une conversion explicite pour les composants vers `system.composantes`, `system.composants_materiels`, `system.composants_materiels_a_renseigner`, `system.composants_materiels_choix_manuel`, `system.composants_materiels_reference`, `system.composants_materiels_source`, `system.composants_materiels_verification_recommandee`; ne rien injecter si aucun champ compatible n’existe.
6. Préserver tous les autres champs Foundry.
7. Générer un diff de contrôle et les comptes appariés/modifiés/ignorés avant commit.

## Validations

- JSON invalides rencontrés : **3**.
- `packs/_sources/aquagenese.js.json: Unexpected token '/', "/**
 * ADD"... is not valid JSON`
- `scripts/add2e-capacities.mjs.json: Unexpected token '/', "// scripts"... is not valid JSON`
- `scripts/sorts/lumiere.js.json: Unexpected token '/', "/**
 * ADD"... is not valid JSON`
- `git status --short` vérifié avant commit.
- Seul `audit/rapports/FOUNDRY-SPELLS-GLOBAL-UPDATE.md` est modifié.
- Aucun changement dans `fvtt-spells-all.json`, `scripts/sorts/`, `system.json`, `audit/reference/*.json`, `audit/source/reference-descriptions.json` ou `audit/decoupage_fichier/*.json`.
