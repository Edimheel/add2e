# Nettoyage global des sorts Foundry hors références validées

## Résultat final

- Fichier nettoyé : `fvtt-spells-all.json`.
- Items avant : **421**.
- Items après : **412**.
- Items hors références examinés : **11**.
- Doublons historiques supprimés : **9**.
- Sorts uniques du Manuel conservés hors des 410 identifiants validés : **2** (`Asile` et `Voile illusoire`).
- Les **410** identifiants `foundry.id` des références validées sont tous conservés et structurellement inchangés.
- Le total final n’est pas 410 : supprimer `Asile` et `Voile illusoire` contredirait l’objectif de ne garder que les sorts du Manuel, car ils sont présents dans la source normalisée du Manuel et leurs découpages respectifs.

## Inventaire des 11 Items hors références

| _id | name | type | img | onUse | Raison probable de non-correspondance | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| `MjfD1BtI6Zbmcbkn` | Asile | `sort` | `systems/add2e/assets/icones/sorts/asile.webp` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/asile.js` | Sort unique du Manuel présent dans la source normalisée et dans le découpage Clerc niveau 7 ; aucun Item validé équivalent par identifiant ou par nom. | **conserver** |
| `AlmyxyBQ3JUlncRq` | Bâtons en Serpents | `sort` | `systems/add2e/assets/icones/sorts/batons-en-serpents.webp` | `systems/add2e/scripts/sorts/batons-en-serpents.js` | Doublon historique de « Bâtons à serpents » ; l’Item validé Clerc `S30nizlne` est conservé. | **supprimer** |
| `DeyfF4yHmCC6d058` | Chien fidèle de Mordekainen | `sort` | `systems/add2e/assets/icones/sorts/magicien-chien-fidele-de-mordekainen.webp` | `systems/add2e/scripts/sorts/magicien-chien-fidele-de-mordekainen.js` | Doublon avec variante orthographique de « Chien fidèle de Mordenkainen » ; l’Item validé `So9k2n77e` est conservé. | **supprimer** |
| `uRwyTvdauqDCIgbO` | Dissipation de magie | `sort` | `systems/add2e/assets/icones/sorts/druide-dissipation-de-magie.webp` | `systems/add2e/scripts/sorts/druide-dissipation-de-magie.js` | Doublon de « Dissipation de la magie » pour Druide niveau 4 ; l’Item validé `S7hx702hb` est conservé. | **supprimer** |
| `JYPI9EQRzXnTBajE` | Localisation d’un Objet | `sort` | `systems/add2e/assets/icones/sorts/localisation-d-un-objet.webp` | `systems/add2e/scripts/sorts/localisation-d-un-objet.js` | Doublon avec variante de titre de « Localisation d'objets » pour Clerc niveau 3 ; l’Item validé `Sj06p4tw4` est conservé. | **supprimer** |
| `45kLiQhVEKRId7dy` | Missile magique | `sort` | `systems/add2e/assets/icones/sorts/missile_magique.webp` | `systems/add2e/scripts/sorts/missile_magique.js` | Doublon sous traduction alternative de « Projectile magique » ; l’Item validé `Sr8hvuf42` est conservé. | **supprimer** |
| `SdDT7AaELrLPFCy7` | Protection contre le Mal (Rayon de 10 pieds) | `sort` | `systems/add2e/assets/icones/sorts/protection-contre-le-mal-rayon-de-10-pieds.webp` | `systems/add2e/scripts/sorts/protection-contre-le-mal-rayon-de-10-pieds.js` | Doublon sous ancienne mesure de « Protection contre le mal sur 3 m » pour Clerc niveau 4 ; l’Item validé `Stbgz8i1o` est conservé. | **supprimer** |
| `i1hJN7EdqPcLTVL1` | Purification de la Nourriture et de la Boisson | `sort` | `systems/add2e/assets/icones/sorts/purification-de-la-nourriture-et-de-la-boisson.webp` | `systems/add2e/scripts/sorts/purification-de-la-nourriture-et-de-la-boisson.js` | Doublon sous variante de titre de « Purification de l'eau et des aliments » ; l’Item validé `Smrpqu7x2` est conservé. | **supprimer** |
| `41cYJx1D12of5dtp` | Soins des Blessures Légères | `sort` | `systems/add2e/assets/icones/sorts/soins-des-blessures-legeres.webp` | `systems/add2e/scripts/sorts/soins-des-blessures-legeres.js` | Doublon sous ancienne appellation de « Soins mineurs » ; l’Item validé `Sxchr11u6` est conservé. | **supprimer** |
| `NT2DlgfjeVmmWktM` | Soins ultime | `sort` | `systems/add2e/assets/icones/sorts/soins-des-blessures-critiques.webp` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/soins-des-blessures-critiques.js` | Doublon avec variation singulier/pluriel de « Soin ultime » ; l’Item validé Clerc `Sq1tl2rnm` est conservé. | **supprimer** |
| `U5UsRJv9W5WnI5Uc` | Voile illusoire | `sort` | `systems/add2e/assets/icones/sorts/illusionniste-voile-illusoire.webp` | `systems/add2e/scripts/sorts/illusionniste-voile-illusoire.js` | Sort unique du Manuel présent dans la source normalisée et dans le découpage Illusionniste niveau 6 ; aucun Item validé équivalent par identifiant ou par nom. | **conserver** |

## Critères de décision

Les neuf suppressions sont des doublons de sorts du Manuel déjà présents sous un identifiant validé. Leur suppression retire uniquement l’Item redondant de l’export global ; aucun script `onUse` n’est supprimé ni modifié.

`Asile` et `Voile illusoire` sont conservés car ils sont des entrées uniques du Manuel dans `sources/Item-Sorts.manuel-joueur.normalise.json` et apparaissent respectivement dans `audit/decoupage_fichier/clerc-niveau-7.json` et `audit/decoupage_fichier/illusionniste-niveau-6.json`. Ils ne disposent pas d’un autre Item validé équivalent à conserver.

## Validations exécutées

- `fvtt-spells-all.json` relu comme JSON valide.
- Total avant/après : **421 / 412**.
- Identifiants de référence présents après nettoyage : **410 / 410**.
- Aucun Item portant un identifiant validé n’a été supprimé ou modifié.
- Les deux Items hors référence conservés sont structurellement inchangés.
- Aucun composant avec `consommation: "a_verifier"` dans `fvtt-spells-all.json` ou `audit/reference/`.
- `node audit/tools/validate-reference-schema.mjs` exécuté avec succès.
- `git status --short` contrôlé avant commit.

## Périmètre confirmé

Seuls `fvtt-spells-all.json` et `audit/rapports/FOUNDRY-SPELLS-GLOBAL-UPDATE.md` sont modifiés. Aucun script, fichier de référence, découpage, source, `system.json`, `AGENTS.md` ou workflow n’a été modifié.
