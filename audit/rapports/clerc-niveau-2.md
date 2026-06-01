# Audit — Sorts de Clerc niveau 2

Branche : `agent-audit-sorts`

Fichiers audités :

- `audit/decoupage_fichier/clerc-niveau-2.json`
- `scripts/sorts/*.js`
- `assets/icones/sorts/*.webp`

Référence de règle :

- Manuel des joueurs AD&D 2e
- Fichier structuré : `audit/reference/manuel-joueurs-clerc-niveau-2.json`

Règle de décision : le Manuel des joueurs est la source de vérité pour toutes les règles ADD2E. Les exports Foundry sont la référence de structure technique uniquement.

---

## 1. Résumé

Le Manuel des joueurs attend 12 sorts de Clerc niveau 2.

L’export Foundry découpé contient 11 sorts.

Écart majeur : `Paralysie` est absent de `audit/decoupage_fichier/clerc-niveau-2.json`.

---

## 2. Sorts attendus selon le Manuel des joueurs

| Ordre | Sort attendu | Statut dans l’export |
|---:|---|---|
| 1 | Augure | Présent |
| 2 | Cantique | Présent |
| 3 | Charme-serpents | Présent, nom à normaliser selon casse source |
| 4 | Détection des charmes | Présent |
| 5 | Détection des pièges | Présent |
| 6 | Langage animal | Présent sous `Langage des Animaux` |
| 7 | Marteau spirituel | Présent |
| 8 | Paralysie | Manquant |
| 9 | Perception des alignements | Présent sous nom correct, mais script historique `connaissance-des-alignements.js` |
| 10 | Résistance au feu | Présent sous `Résistance au Feu/Résistance au Froid` |
| 11 | Retardement du poison | Présent, mais script/image historique `ralentissement-du-poison` |
| 12 | Silence sur 5 mètres | Présent sous `Silence (Rayon de 15 pieds)` |

---

## 3. Corrections à préparer

### 3.1. Ajouter le sort manquant : Paralysie

À créer selon le schéma Foundry existant.

Données de règle à utiliser :

- Nom : `Paralysie`
- Classe : `Clerc`
- Niveau : `2`
- École : `Enchantement/Charme`
- Portée : `6 pouces`
- Durée : `4 rounds + 1 round/niveau`
- Zone d’effet : `1 à 3 créatures`
- Composantes : `V, S, M`
- Temps d’incantation : `5 segments`
- Jet de sauvegarde : `annule`
- Composant matériel : `petite tige de métal droite et rigide`
- Image attendue : `systems/add2e/assets/icones/sorts/paralysie.webp`
- Script onUse à prévoir : `systems/add2e/scripts/sorts/paralysie.js`

Automatisation recommandée : prudente. Le sort applique un état d’immobilisation/paralysie à 1 à 3 humanoïdes, avec malus au jet de sauvegarde selon le nombre de cibles. Il faut vérifier le moteur d’états avant création du script.

### 3.2. Normaliser les noms selon le Manuel des joueurs

Corrections attendues :

| Export actuel | Nom Manuel des joueurs |
|---|---|
| `Charme-Serpents` | `Charme-serpents` |
| `Langage des Animaux` | `Langage animal` |
| `Marteau Spirituel` | `Marteau spirituel` |
| `Résistance au Feu/Résistance au Froid` | `Résistance au feu` |
| `Retardement du Poison` | `Retardement du poison` |
| `Silence (Rayon de 15 pieds)` | `Silence sur 5 mètres` |

Les chemins historiques de scripts peuvent être conservés temporairement si le moteur les utilise déjà, mais les noms visibles des sorts doivent suivre le Manuel.

### 3.3. Corriger les composants matériels

#### Augure

L’export ne doit pas imposer simultanément tous les composants alternatifs.

Règle : les composants sont alternatifs selon la méthode choisie :

- baguettes serties de gemmes ;
- os de dragon ;
- objets divinatoires similaires ;
- feuilles d’infusion humides ;
- si méthode infusion : perle écrasée d’au moins 100 po ajoutée à la boisson.

Correction recommandée : marquer les composants comme alternatifs ou laisser une note d’arbitrage MJ si le schéma ne sait pas représenter une alternative.

#### Marteau spirituel

Composant matériel attendu :

- marteau de guerre normal lancé sur l’ennemi ;
- consommé/disparaît quand le sort est lancé.

Vérifier que le composant existant correspond exactement à cette règle.

#### Résistance au feu

Nom attendu : `Résistance au feu`.

Composant matériel attendu :

- goutte de mercure.

Le symbole sacré ne doit pas remplacer ce composant spécifique.

#### Retardement du poison

Composants matériels attendus :

- symbole sacré du clerc ;
- gousse d’ail écrasée et répandue sur les pieds nus de la victime.

L’export actuel ne doit pas omettre la gousse d’ail.

### 3.4. Corriger les descriptions parasites

À retirer des descriptions :

- `Marteau spirituel` contient une mention parasite de section : `SORTS DE CLERC (NIVEAU 2)`.
- `Silence sur 5 mètres` contient une mention parasite : `SORTS DE NIVEAU 3`.

Ces mentions doivent être retirées de :

- `system.description`
- `system.description_reelle`
- `system.description_texte`
- `system.description_html`

### 3.5. Images

Le bon chemin est :

```text
assets/icones/sorts/
```

Dans les JSON Foundry, le champ `img` doit pointer vers :

```text
systems/add2e/assets/icones/sorts/<slug>.webp
```

Les images existantes ne doivent pas être remplacées si elles sont cohérentes.

Image à créer ou vérifier :

- `assets/icones/sorts/paralysie.webp`

### 3.6. Scripts onUse

Tous les scripts des 11 sorts présents existent dans `scripts/sorts/`.

Script à créer ou vérifier pour le sort manquant :

- `scripts/sorts/paralysie.js`

Règles de script attendues :

- compatible Foundry V13/V14/V15 ;
- pas de `Application` V1 ;
- pas de `Dialog` V1 ;
- retour `true` si le sort est consommé ;
- retour `false` si le sort ne doit pas être consommé ;
- gestion des sauvegardes ;
- application d’un état unique sans doublon ;
- respect des permissions via socket/relais MJ si nécessaire.

---

## 4. Corrections à ne pas faire sans validation

Ne pas renommer brutalement les fichiers de scripts historiques sans vérifier tous les chemins existants.

Exemples :

- `connaissance-des-alignements.js` peut rester le script de `Perception des alignements` si le chemin est déjà utilisé.
- `ralentissement-du-poison.js` peut rester le script de `Retardement du poison` si le chemin est déjà utilisé.

Le nom visible du sort doit être aligné sur le Manuel, mais le chemin technique peut être conservé si cela évite une régression.

---

## 5. Statut du lot

Statut : `audit_termine_corrections_a_preparer`

Prochaine étape : préparer les corrections JSON et le script `paralysie.js`, puis fournir la liste des fichiers qui seront modifiés avant push.
