# Génération des références de sorts

## Résultat

La génération complète ne peut pas être exécutée sans inventer ou reformuler des règles : la branche `agent-audit-sorts` ne contient ni `AD&D-Manuel-des-joueurs-restauré-mars-2024.pdf` ni `audit/source/reference-descriptions.json`.

Le Manuel des joueurs étant la source de vérité obligatoire pour les descriptions exactes, les composants matériels et les écarts Manuel/Foundry, les fichiers incomplets sont laissés à vérifier manuellement. Aucun fichier incomplet n'a été marqué `reference_complete_description_normalisee`.

## Synthèse

- Fichiers de référence attendus : 30
- Fichiers déjà présents : 30
- Fichiers déjà complets : 1
- Fichiers créés : 0
- Fichiers complétés : 0
- Fichiers laissés à vérifier : 29
- Sorts attendus au total : 413
- Sorts dans le seul fichier finalisé : 12
- Sorts restant à traiter : 401

## Fichiers déjà complets

| Fichier | Sorts | Statut |
|---|---:|---|
| `audit/reference/manuel-joueurs-clerc-niveau-2.json` | 12 | `reference_complete_description_normalisee` |

## Fichiers laissés à vérifier

| Lot | Fichier | Sorts attendus | Statut observé |
|---|---|---:|---|
| Clerc 1 | `audit/reference/manuel-joueurs-clerc-niveau-1.json` | 12 | `reference_blocs_techniques_complete_description_a_completer` |
| Clerc 3 | `audit/reference/manuel-joueurs-clerc-niveau-3.json` | 12 | statut de fichier absent ; descriptions et blocs Foundry à compléter |
| Clerc 4 | `audit/reference/manuel-joueurs-clerc-niveau-4.json` | 10 | `reference_blocs_techniques_partielle_description_a_completer` |
| Clerc 5 | `audit/reference/manuel-joueurs-clerc-niveau-5.json` | 10 | `reference_champs_techniques_complete_description_a_importer` |
| Clerc 6 | `audit/reference/manuel-joueurs-clerc-niveau-6.json` | 10 | `reference_champs_techniques_complete_description_a_importer` |
| Clerc 7 | `audit/reference/manuel-joueurs-clerc-niveau-7.json` | 10 | `reference_champs_techniques_complete_description_a_importer` |
| Druide 1 | `audit/reference/manuel-joueurs-druide-niveau-1.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Druide 2 | `audit/reference/manuel-joueurs-druide-niveau-2.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Druide 3 | `audit/reference/manuel-joueurs-druide-niveau-3.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Druide 4 | `audit/reference/manuel-joueurs-druide-niveau-4.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Druide 5 | `audit/reference/manuel-joueurs-druide-niveau-5.json` | 10 | `reference_liste_noms_complete_regles_a_completer` |
| Druide 6 | `audit/reference/manuel-joueurs-druide-niveau-6.json` | 10 | `reference_liste_noms_complete_regles_a_completer` |
| Druide 7 | `audit/reference/manuel-joueurs-druide-niveau-7.json` | 10 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 1 | `audit/reference/manuel-joueurs-magicien-niveau-1.json` | 30 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 2 | `audit/reference/manuel-joueurs-magicien-niveau-2.json` | 24 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 3 | `audit/reference/manuel-joueurs-magicien-niveau-3.json` | 24 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 4 | `audit/reference/manuel-joueurs-magicien-niveau-4.json` | 24 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 5 | `audit/reference/manuel-joueurs-magicien-niveau-5.json` | 24 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 6 | `audit/reference/manuel-joueurs-magicien-niveau-6.json` | 24 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 7 | `audit/reference/manuel-joueurs-magicien-niveau-7.json` | 16 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 8 | `audit/reference/manuel-joueurs-magicien-niveau-8.json` | 16 | `reference_liste_noms_complete_regles_a_completer` |
| Magicien 9 | `audit/reference/manuel-joueurs-magicien-niveau-9.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Illusionniste 1 | `audit/reference/manuel-joueurs-illusionniste-niveau-1.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Illusionniste 2 | `audit/reference/manuel-joueurs-illusionniste-niveau-2.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Illusionniste 3 | `audit/reference/manuel-joueurs-illusionniste-niveau-3.json` | 12 | `reference_liste_noms_complete_regles_a_completer` |
| Illusionniste 4 | `audit/reference/manuel-joueurs-illusionniste-niveau-4.json` | 8 | `reference_liste_noms_complete_regles_a_completer` |
| Illusionniste 5 | `audit/reference/manuel-joueurs-illusionniste-niveau-5.json` | 8 | `reference_liste_noms_complete_regles_a_completer` |
| Illusionniste 6 | `audit/reference/manuel-joueurs-illusionniste-niveau-6.json` | 7 | `reference_liste_noms_complete_regles_a_completer` |
| Illusionniste 7 | `audit/reference/manuel-joueurs-illusionniste-niveau-7.json` | 6 | `reference_liste_noms_complete_regles_a_completer` |

## Anomalies Foundry

- Clerc niveau 5 : le fichier de référence attend 10 sorts, tandis que `audit/decoupage_fichier/clerc-niveau-5.json` annonce 11 objets. L'écart doit être comparé au Manuel avant toute correction.
- Les anomalies Foundry des autres lots ne peuvent pas être qualifiées de façon fiable sans comparaison avec le Manuel.

## Écarts Manuel / JSON

- Sorts présents dans le Manuel mais absents du JSON : non déterminables tant que le Manuel ou une extraction fidèle n'est pas disponible.
- Sorts présents dans le JSON mais non retrouvés dans le Manuel : non déterminables tant que le Manuel ou une extraction fidèle n'est pas disponible.

## Validations effectuées

- Lecture de `AGENTS.md`.
- Vérification de la structure du modèle `audit/reference/manuel-joueurs-clerc-niveau-2.json`.
- Inventaire des 30 fichiers de référence attendus et de leur statut de fichier.
- Vérification que le PDF obligatoire n'est pas présent dans l'arborescence de la branche.
- Vérification que `audit/source/reference-descriptions.json`, attendu par `audit/tools/import-reference-descriptions.mjs`, n'est pas présent.
- Aucun champ `description_*` interdit n'a été ajouté.
- Aucun statut finalisé n'a été appliqué à un fichier incomplet.

## Fichiers non modifiés

- `scripts/sorts/`
- `fvtt-spells-all.json`
- `audit/decoupage_fichier/*.json`
- `system.json`
- `audit/reference/*.json`

## Condition de reprise

Fournir sur la branche le PDF `AD&D-Manuel-des-joueurs-restauré-mars-2024.pdf` ou une extraction fidèle dans `audit/source/reference-descriptions.json`. Les lots pourront ensuite être générés dans l'ordre demandé, validés, puis committés séparément sans invention de règles.