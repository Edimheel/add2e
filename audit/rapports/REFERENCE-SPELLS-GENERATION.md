# Génération des références de sorts — état final

## Résumé final

- Descriptions manquantes : **0**
- Composants résolus dans ce lot : **10 cas ambigus**
- Composants résolus global : **227 objets techniques**
- Composants restant à vérifier : **0**
- Clerc : **0 à vérifier**
- Druide : **0 à vérifier**
- Magicien : **0 à vérifier**
- Illusionniste : **0 à vérifier**

## Corrections effectuées

Les huit composants composites demandés ont été séparés entre focus durables, contenants et ingrédients consommables. Les deux cas suspects de magicien niveau 4 ont été résolus, ainsi que le décalage confirmé autour des huit sorts audités :

- **Désenvoûtement** : description source exacte rétablie; les perles mal rattachées ont été retirées.
- **Globe mineur d'invulnérabilité** : description source exacte et perles de verre ou de cristal rétablies.
- **Invocation de monstre II** : description source exacte rétablie; le faux composant « la même; il y a également 1 à 4 rounds de délai » a été supprimé.
- **Maladresse** : description source exacte et composant de lait solidifié rétablis.
- **Moyen mnémonique de Rary** : description source exacte rétablie; ficelle, ivoire et deux alternatives d’encre structurés séparément.
- **Piège à feu** : description source exacte rétablie.
- **Porte dimensionnelle** : description source exacte rétablie après confirmation du décalage adjacent.
- **Tempête de glace** : description source exacte rétablie après confirmation du décalage adjacent.

Les descriptions n’ont été modifiées que pour corriger ces rattachements manifestement erronés, à partir de `audit/source/reference-descriptions.json`. Aucun chemin ou champ `foundry` n’a été modifié.

## Fichiers modifiés

- `audit/reference/manuel-joueurs-druide-niveau-1.json`
- `audit/reference/manuel-joueurs-magicien-niveau-4.json`
- `audit/reference/manuel-joueurs-magicien-niveau-5.json`
- `audit/reference/manuel-joueurs-magicien-niveau-6.json`
- `audit/reference/manuel-joueurs-magicien-niveau-7.json`
- `audit/reference/manuel-joueurs-magicien-niveau-9.json`
- `audit/rapports/REFERENCE-SPELLS-GENERATION.md`

## Validations exécutées

- JSON valide pour tous les fichiers de référence modifiés.
- `node audit/tools/validate-reference-schema.mjs`
- `grep -R '"consommation": "a_verifier"' audit/reference/manuel-joueurs-druide-niveau-1.json audit/reference/manuel-joueurs-magicien-niveau-4.json audit/reference/manuel-joueurs-magicien-niveau-5.json audit/reference/manuel-joueurs-magicien-niveau-6.json audit/reference/manuel-joueurs-magicien-niveau-7.json audit/reference/manuel-joueurs-magicien-niveau-9.json || true` : aucune occurrence.
- `git status --short` contrôlé avant commit.

## Périmètre confirmé

Aucun script, JSON Foundry, découpage, fichier source, `system.json`, `AGENTS.md`, workflow, fichier Clerc, fichier Illusionniste ou autre fichier Druide/Magicien hors périmètre n’a été modifié.
