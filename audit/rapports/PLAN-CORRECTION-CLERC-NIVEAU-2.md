# Plan de correction - Clerc niveau 2

Branche: agent-audit-sorts

Source de verite: Manuel des joueurs AD&D 2e.

Ce fichier prepare les corrections. Il ne modifie pas encore les objets Foundry, les scripts onUse ou les images.

## Diagnostic

Rapport source: audit/rapports/clerc-niveau-2.md

- Export: 11 sorts
- Reference Manuel: 12 sorts
- Manquants rapport: 3
- Ecart de nom: 1

## Decisions

### Renommages probables avant creation

Ces entrees semblent presentes mais avec un nom non conforme au Manuel:

- Langage des Animaux -> Langage animal
- Silence (Rayon de 15 pieds) -> Silence sur 5 metres
- Resistance au Feu/Resistance au Froid -> Resistance au feu

Action: corriger le nom visible et les champs system.nom si presents. Conserver temporairement les chemins techniques existants si le moteur les utilise deja.

### Creation probable

Le sort suivant semble absent:

- Paralysie

Action: verifier une derniere fois dans l export complet, puis creer l objet et prevoir le script scripts/sorts/paralysie.js.

### Composants a corriger

- Augure: composants alternatifs, ne pas les imposer tous ensemble.
- Resistance au feu: composant materiel attendu a verifier contre le Manuel.
- Retardement du poison: composant materiel incomplet a verifier contre le Manuel.

### Description a nettoyer

- Marteau spirituel: verifier et supprimer les mentions parasites de section.
- Silence sur 5 metres: verifier et supprimer les mentions parasites de section.

## Fichiers a lire avant correction reelle

- audit/decoupage_fichier/clerc-niveau-2.json
- audit/reference/manuel-joueurs-clerc-niveau-2.json
- audit/rapports/clerc-niveau-2.md
- scripts/sorts/langage-des-animaux.js
- scripts/sorts/silence-rayon-de-15-pieds.js
- scripts/sorts/resistance-au-feu-resistance-au-froid.js
- scripts/sorts/augure.js
- scripts/sorts/ralentissement-du-poison.js
- scripts/sorts/marteau-spirituel.js

## Ordre de correction

1. Corriger les noms visibles pour eviter les faux manquants.
2. Corriger les composants passifs.
3. Nettoyer les descriptions parasites.
4. Creer Paralysie seulement apres verification anti doublon.
5. Regenerer les rapports.
6. Tester dans Foundry.

## Statut

pret_pour_preparation_correction
