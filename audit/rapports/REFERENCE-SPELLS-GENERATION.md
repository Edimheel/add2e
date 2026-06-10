# Génération des références de sorts

## Résultat final

- Branche : `agent-audit-sorts`
- Descriptions manquantes : 0
- Composants à vérifier global : 90
- Clerc : 40 composants résolus, 24 à vérifier
- Druide : 2 composants résolus, 8 à vérifier
- Magicien : 65 composants résolus, 55 à vérifier
- Illusionniste : 7 composants résolus, 3 à vérifier

Les descriptions présentes sont reprises strictement depuis `audit/source/reference-descriptions.json`. Les consommations non explicites restent `a_verifier`.

## Descriptions réellement manquantes

Aucune. Les 19 descriptions fournies ont été intégrées strictement dans la source.

## Composants à vérifier

La liste suivante regroupe les sorts contenant encore au moins un composant avec `consommation: "a_verifier"`.

### Clerc

- clerc-niveau-1: Résistance au froid
- clerc-niveau-3: Catalepsie
- clerc-niveau-3: Glyphe de garde
- clerc-niveau-3: Nécro-animation
- clerc-niveau-4: Abaissement des eaux
- clerc-niveau-4: Bâtons à serpents
- clerc-niveau-4: Divination
- clerc-niveau-4: Langage des plantes
- clerc-niveau-5: Communion
- clerc-niveau-5: Fléau d'insectes
- clerc-niveau-5: Pilier de feu
- clerc-niveau-7: Symbole
- clerc-niveau-7: Tremblement de terre

### Druide

- druide-niveau-1: Amitié animale
- druide-niveau-1: Invisibilité aux animaux
- druide-niveau-1: Passage sans trace
- druide-niveau-1: Shillelagh
- druide-niveau-2: Catalepsie
- druide-niveau-3: Arbre
- druide-niveau-4: Invocation des créatures sylvestres
- druide-niveau-4: Langage des plantes

### Magicien

- magicien-niveau-1: Compréhension des langues
- magicien-niveau-1: Disque flottant de Tenser
- magicien-niveau-1: Serviteur invisible
- magicien-niveau-2: Bouche magique
- magicien-niveau-2: Corde enchantée
- magicien-niveau-2: Force
- magicien-niveau-2: Fracassement
- magicien-niveau-2: Invisibilité
- magicien-niveau-2: Peur
- magicien-niveau-2: Toile d'araignée
- magicien-niveau-3: Boule de feu
- magicien-niveau-3: Clairvoyance
- magicien-niveau-3: Force fantasmagorique
- magicien-niveau-3: Foudre
- magicien-niveau-3: Protection contre les projectiles normaux
- magicien-niveau-3: Rafale de vent
- magicien-niveau-3: Ralentissement
- magicien-niveau-3: Rapidité
- magicien-niveau-3: Respiration aquatique
- magicien-niveau-3: Suggestion
- magicien-niveau-3: Vol
- magicien-niveau-4: Charme-monstres
- magicien-niveau-4: Globe mineur d'invulnérabilité
- magicien-niveau-4: Invocation de monstre II
- magicien-niveau-4: Maladresse
- magicien-niveau-4: Mur de feu
- magicien-niveau-4: Mur de glace
- magicien-niveau-4: Œil magique
- magicien-niveau-4: Phytomorphose
- magicien-niveau-4: Porte dimensionnelle
- magicien-niveau-4: Terrain hallucinatoire
- magicien-niveau-5: Chien fidèle de Mordenkainen
- magicien-niveau-5: Débilité mentale
- magicien-niveau-5: Distorsion des distances
- magicien-niveau-5: Eau aérée
- magicien-niveau-5: Mur de fer
- magicien-niveau-5: Mur de force
- magicien-niveau-5: Mur de roc
- magicien-niveau-5: Paralysie des monstres
- magicien-niveau-5: Passe-muraille
- magicien-niveau-6: Abaissement des eaux
- magicien-niveau-6: Désintégration
- magicien-niveau-6: Glissement de terrain
- magicien-niveau-6: Holographie
- magicien-niveau-6: Réincarnation
- magicien-niveau-6: Répulsion
- magicien-niveau-6: Transmutation de pierre en chair
- magicien-niveau-7: Charme-plantes
- magicien-niveau-7: Inversion de la gravité
- magicien-niveau-8: Antipathie/sympathie
- magicien-niveau-8: Clone
- magicien-niveau-8: Cristairain
- magicien-niveau-8: Poing de Bigby
- magicien-niveau-8: Transformation d'objets
- magicien-niveau-9: Main broyante de Bigby

### Illusionniste

- illusionniste-niveau-1: Mur de brouillard
- illusionniste-niveau-2: Surdité
- illusionniste-niveau-3: Écriture illusoire

## Validations exécutées

- JSON de référence validés avec `node audit/tools/validate-reference-schema.mjs` après chaque lot.
- Recherche finale des occurrences de `consommation: "a_verifier"`.
- Vérification de `git status --short`.
- Vérification du diff final : seuls `audit/source/reference-descriptions.json` et `audit/rapports/REFERENCE-SPELLS-GENERATION.md` sont modifiés.
- Les composants à vérifier restent inchangés : 90 au total.
- Aucun script, JSON Foundry, fichier de découpage, source technique ou `system.json` n'est modifié par ce commit ; les fichiers de référence générés ont été restaurés après validation.
