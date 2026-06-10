# Génération des références de sorts

## Résultat

- Branche : `agent-audit-sorts`
- Fichiers complétés structurellement : 29
- Fichier déjà finalisé e conservé : `audit/reference/manuel-joueurs-clerc-niveau-2.json`
- Sorts traités : 401
- Sorts laisés à vérifier : 401
- Descriptions manquantes : 19
- Composants à vérifier : 128
- Correspondances Foundry absentes : 3

Les descriptions présentes sont reprises strictement depuis `audit/source/reference-descriptions.json`. Aucun sort incomplet n'est marqué `reference_complete_description_normalisee`.

## Fichiers traités

| Lot | Sorts attendus | Descriptions présentes | Sorts à vérifier | Statut |
|---|---:|---:|---:|---|
| clerc-niveau-1 | 12 | 12 | 12 | reference_a_verifier_manuellement |
| clerc-niveau-3 | 12 | 12 | 12 | reference_a_verifier_manuellement |
| clerc-niveau-4 | 10 | 10 | 10 | reference_a_verifier_manuellement |
| clerc-niveau-5 | 10 | 9 | 10 | reference_a_verifier_manuellement |
| clerc-niveau-6 | 10 | 10 | 10 | reference_a_verifier_manuellement |
| clerc-niveau-7 | 10 | 10 | 10 | reference_a_verifier_manuellement |
| druide-niveau-1 | 12 | 11 | 12 | reference_a_verifier_manuellement |
| druide-niveau-2 | 12 | 12 | 12 | reference_a_verifier_manuellement |
| druide-niveau-3 | 12 | 11 | 12 | reference_a_verifier_manuellement |
| druide-niveau-4 | 12 | 12 | 12 | reference_a_verifier_manuellement |
| druide-niveau-5 | 10 | 8 | 10 | reference_a_verifier_manuellement |
| druide-niveau-6 | 10 | 9 | 10 | reference_a_verifier_manuellement |
| druide-niveau-7 | 10 | 8 | 10 | reference_a_verifier_manuellement |
| magicien-niveau-1 | 30 | 30 | 30 | reference_a_verifier_manuellement |
| magicien-niveau-2 | 24 | 24 | 24 | reference_a_verifier_manuellement |
| magicien-niveau-3 | 24 | 22 | 24 | reference_a_verifier_manuellement |
| magicien-niveau-4 | 24 | 24 | 24 | reference_a_verifier_manuellement |
| magicien-niveau-5 | 24 | 24 | 24 | reference_a_verifier_manuellement |
| magicien-niveau-6 | 24 | 23 | 24 | reference_a_verifier_manuellement |
| magicien-niveau-7 | 16 | 15 | 16 | reference_a_verifier_manuellement |
| magicien-niveau-8 | 16 | 13 | 16 | reference_a_verifier_manuellement |
| magicien-niveau-9 | 12 | 10 | 12 | reference_a_verifier_manuellement |
| illusionniste-niveau-1 | 12 | 12 | 12 | reference_a_verifier_manuellement |
| illusionniste-niveau-2 | 12 | 12 | 12 | reference_a_verifier_manuellement |
| illusionniste-niveau-3 | 12 | 12 | 12 | reference_a_verifier_manuellement |
| illusionniste-niveau-4 | 8 | 8 | 8 | reference_a_verifier_manuellement |
| illusionniste-niveau-5 | 8 | 8 | 8 | reference_a_verifier_manuellement |
| illusionniste-niveau-6 | 7 | 7 | 7 | reference_a_verifier_manuellement |
| illusionniste-niveau-7 | 6 | 4 | 6 | reference_a_verifier_manuellement |

## Descriptions réellement manquantes

Les descriptions suivantes restent absentes : aucun texte correct ne peut leur être attribué depuis la source disponible.

- druide-niveau-1: Enchevêtrement
- druide-niveau-3: Piège Sylvestre
- druide-niveau-5: Contrôle des vents
- druide-niveau-5: Mur de feu
- druide-niveau-6: Répulsion du bois
- druide-niveau-7: Animation de la roche
- druide-niveau-7: Tempête de feu
- magicien-niveau-3: Intermittence
- magicien-niveau-3: Infravision
- magicien-niveau-6: Quête magique
- magicien-niveau-7: Mot de pouvoir : « étourdissement »
- magicien-niveau-8: Mot de pouvoir : « cécité »
- magicien-niveau-8: Permanence
- magicien-niveau-8: Protection d'esprit
- magicien-niveau-9: Arrêt du temps
- magicien-niveau-9: Mot de pouvoir : « mort »
- illusionniste-niveau-7: Vision
- illusionniste-niveau-7: Sorts de niveau 1 de magicien

## Descriptions corrigées par réalignement de clé

- Chaîne druide : les textes de Contrôle de la température sur 3 m, Dissipation de la Magie, Embrasement et Forêt hallucinatoire ont été réalignés depuis les quatre clés décalées. Piège Sylvestre reste manquant.
- Chaîne magicien : les textes de Langues à Tempête de glace ont été réalignés depuis les clés décalées de magicien-niveau-3 et magicien-niveau-4. Infravision reste manquant.
- Dix en-têtes du sort suivant, collés à la fin d'une description complète, ont été retirés sans modifier le texte de la description.

## Descriptions suspectes laissées à vérifier

- magicien-niveau-9: Stase temporelle — suffixe introductif sur les sorts d'illusionniste, non attribuable avec certitude depuis la source disponible.

## Composants Clerc résolus

40 objets matériels structurés sans consommation incertaine, sur 14 sorts :

- clerc-niveau-1: Aquagenèse
- clerc-niveau-1: Sanctuaire
- clerc-niveau-3: Localisation d'objets
- clerc-niveau-3: Nécromancie
- clerc-niveau-3: Prière
- clerc-niveau-5: Changement de plan
- clerc-niveau-5: Dissipation du mal
- clerc-niveau-5: Expiation
- clerc-niveau-5: Vision réelle
- clerc-niveau-6: Orientation
- clerc-niveau-6: Séparation des eaux
- clerc-niveau-7: Contrôle du climat
- clerc-niveau-7: Régénération
- clerc-niveau-7: Résurrection

## Composants Clerc encore à vérifier

23 objets matériels conservent `consommation: "a_verifier"`, sur 13 sorts :

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

## Sorts Clerc non finalisables

- Description manquante : clerc-niveau-5: Quête religieuse. Aucun composant n’est inventé ; `composants_materiels_objets` reste vide.
- Composant incertain : les 13 sorts listés dans « Composants Clerc encore à vérifier ».

## Fichiers Clerc modifiés

- `audit/reference/manuel-joueurs-clerc-niveau-1.json`
- `audit/reference/manuel-joueurs-clerc-niveau-3.json`
- `audit/reference/manuel-joueurs-clerc-niveau-4.json`
- `audit/reference/manuel-joueurs-clerc-niveau-5.json`
- `audit/reference/manuel-joueurs-clerc-niveau-6.json`
- `audit/reference/manuel-joueurs-clerc-niveau-7.json`
- Clerc niveau 2 conservé sans modification.

## Composants à vérifier

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
- druide-niveau-1: Amitié animale
- druide-niveau-1: Invisibilité aux animaux
- druide-niveau-1: Passage sans trace
- druide-niveau-1: Shillelagh
- druide-niveau-2: Catalepsie
- druide-niveau-3: Arbre
- druide-niveau-4: Invocation des créatures sylvestres
- druide-niveau-4: Langage des plantes
- druide-niveau-4: Répulsion des insectes
- magicien-niveau-1: Aura magique de Nystul
- magicien-niveau-1: Chute de plume
- magicien-niveau-1: Compréhension des langues
- magicien-niveau-1: Disque flottant de Tenser
- magicien-niveau-1: Escalade d’araignée
- magicien-niveau-1: Lecture de la magie
- magicien-niveau-1: Lumières dansantes
- magicien-niveau-1: Message
- magicien-niveau-1: Poussée
- magicien-niveau-1: Réparation
- magicien-niveau-1: Saut
- magicien-niveau-1: Serviteur invisible
- magicien-niveau-1: Sommeil
- magicien-niveau-1: Ventriloquie
- magicien-niveau-2: Bouche magique
- magicien-niveau-2: Bruitage
- magicien-niveau-2: Corde enchantée
- magicien-niveau-2: Détection de l'invisibilité
- magicien-niveau-2: E.S.P.
- magicien-niveau-2: Force
- magicien-niveau-2: Fracassement
- magicien-niveau-2: Invisibilité
- magicien-niveau-2: Lévitation
- magicien-niveau-2: Nuage puant
- magicien-niveau-2: Peur
- magicien-niveau-2: Piège de Léomund
- magicien-niveau-2: Toile d'araignée
- magicien-niveau-3: Boule de feu
- magicien-niveau-3: Chaumière de Léomund
- magicien-niveau-3: Clairaudience
- magicien-niveau-3: Clairvoyance
- magicien-niveau-3: Force fantasmagorique
- magicien-niveau-3: Foudre
- magicien-niveau-3: Infravision
- magicien-niveau-3: Protection contre les projectiles normaux
- magicien-niveau-3: Rafale de vent
- magicien-niveau-3: Ralentissement
- magicien-niveau-3: Rapidité
- magicien-niveau-3: Respiration aquatique
- magicien-niveau-3: Suggestion
- magicien-niveau-3: Vol
- magicien-niveau-4: Arme enchantée
- magicien-niveau-4: Charme-monstres
- magicien-niveau-4: Désenvoûtement
- magicien-niveau-4: Effroi
- magicien-niveau-4: Excavation
- magicien-niveau-4: Feu charmeur
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
- magicien-niveau-5: Cône de froid
- magicien-niveau-5: Débilité mentale
- magicien-niveau-5: Distorsion des distances
- magicien-niveau-5: Eau aérée
- magicien-niveau-5: Lithomorphose
- magicien-niveau-5: Main d'interposition de Bigby
- magicien-niveau-5: Métempsycose
- magicien-niveau-5: Mur de fer
- magicien-niveau-5: Mur de force
- magicien-niveau-5: Mur de roc
- magicien-niveau-5: Paralysie des monstres
- magicien-niveau-5: Passe-muraille
- magicien-niveau-6: Abaissement des eaux
- magicien-niveau-6: Chasseur invisible
- magicien-niveau-6: Désintégration
- magicien-niveau-6: Glissement de terrain
- magicien-niveau-6: Holographie
- magicien-niveau-6: Incantation mortelle
- magicien-niveau-6: Main de force de Bigby
- magicien-niveau-6: Mythomancie
- magicien-niveau-6: Réincarnation
- magicien-niveau-6: Répulsion
- magicien-niveau-6: Transformation de Tenser
- magicien-niveau-6: Transmutation de pierre en chair
- magicien-niveau-6: Transvision
- magicien-niveau-6: Vigiles et sentinelles
- magicien-niveau-7: Cacodémon
- magicien-niveau-7: Charme-plantes
- magicien-niveau-7: Duo-dimension
- magicien-niveau-7: Épée de Mordenkainen
- magicien-niveau-7: Inversion de la gravité
- magicien-niveau-7: Poigne de Bigby
- magicien-niveau-8: Antipathie/sympathie
- magicien-niveau-8: Clone
- magicien-niveau-8: Cristairain
- magicien-niveau-8: Immunité magique de Serten
- magicien-niveau-8: Poing de Bigby
- magicien-niveau-8: Symbole
- magicien-niveau-8: Transformation d'objets
- magicien-niveau-9: Hétéromorphisme
- magicien-niveau-9: Main broyante de Bigby
- magicien-niveau-9: Stase temporelle
- illusionniste-niveau-1: Détection des illusions
- illusionniste-niveau-1: Jet de couleurs
- illusionniste-niveau-1: Mur de brouillard
- illusionniste-niveau-2: Surdité
- illusionniste-niveau-3: Écriture illusoire
- illusionniste-niveau-3: Non-détection
- illusionniste-niveau-5: Invocation des ombres

## Anomalies Foundry

- magicien-niveau-1: Lumière
- magicien-niveau-2: Détection de l'invisibilité
- illusionniste-niveau-1: Lumière

## Validations exécutées

- `node audit/tools/import-reference-descriptions.mjs` exécuté en contrôle préalable, puis ses écritures de validation ont été annulées avant génération.
- `node audit/tools/validate-reference-schema.mjs` — exécuté après structuration des composants Clerc.
- Recherche des champs `description_*` interdits.
- Recherche des artefacts PDF interdits.
- Vérification avant chaque commit avec `git status --short`.
- Vérification que `scripts/sorts/`, `fvtt-spells-all.json`, `audit/decoupage_fichier/` et `system.json` ne sont pas modifiés.

## Limites

Les champs techniques absents des références existantes ne sont pas remplis depuis Foundry, conformément à la règle qui limite Foundry à `foundry.id`, `foundry.img`, `foundry.onUse` et `foundry.nom`. Les consommations non explicites restent `a_verifier`.
