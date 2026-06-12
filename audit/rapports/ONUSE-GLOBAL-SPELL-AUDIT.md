# Audit global des scripts onUse des sorts PHB

## Périmètre et méthode

Audit statique des **411** Items PHB de `fvtt-spells-all.json`, croisés avec les références validées et les fichiers JavaScript sous `scripts/sorts/`. Aucun script ni fichier de données n’a été modifié. Les détections VFX, fallback legacy et écritures risquées sont heuristiques et doivent être confirmées en test Foundry.

## Résumé

- Sorts analysés : **411**
- Sorts avec un onUse déclaré : **411**
- Sorts dont le script déclaré existe : **385**
- Scripts existants et raccordés uniques : **370**
- Scripts référencés mais absents : **26** chemins uniques, concernant **26** sorts
- Scripts orphelins : **145**
- Scripts avec Dialog legacy : **420** (`new Dialog`: 420, `Dialog.prompt`: 0)
- Scripts sans retour `true` et `false` clair : **5**
- Scripts raccordés sans VFX identifiable : **325**
- Scripts avec fallback legacy probable : **1**
- Scripts avec écriture Foundry directe potentiellement risquée : **456**
- Sorts avec composants matériels : **181**
- Sorts avec effet actif dans l’Item : **346**

## Lots déjà validés et exclus des modifications

- **Clerc niveau 1 — Apaisement** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Aquagenèse** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Bénédiction** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Détection du mal** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Injonction** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Magicien niveau 1 — Mains brûlantes** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Magicien niveau 1 — Poigne électrique** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Protection contre le Mal** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Résistance au Froid** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Sanctuaire** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Détection de la magie** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Lumière** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Purification de l'eau et des aliments** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Clerc niveau 1 — Soins mineurs** : conserver ; aucune modification proposée sans anomalie critique confirmée.
- **Magicien niveau 1 — Projectile magique** : conserver ; aucune modification proposée sans anomalie critique confirmée.

## Répartition des stratégies

| Stratégie | Sorts |
|---|---:|
| aide_mj_avec_vfx | 29 |
| conserver | 15 |
| corriger | 314 |
| créer | 26 |
| effet_visuel_seul_plus_message_mj | 27 |

Aucun sort n’est classé `automatisation_complete` par audit statique seul : ce niveau exige un test fonctionnel dans Foundry.

## Types probables

| Type probable | Sorts |
|---|---:|
| aide MJ nécessaire | 12 |
| contrôle | 21 |
| divination | 19 |
| dégâts cible | 53 |
| dégâts zone | 39 |
| déplacement | 7 |
| illusion | 20 |
| invocation | 25 |
| protection | 12 |
| soin | 5 |
| utilitaire | 198 |

## Scripts référencés mais absents

- `scripts/sorts/clerc-niveaux-5-6-7/animation-d-un-objet.js`
- `scripts/sorts/clerc-niveaux-5-6-7/barriere-de-lames.js`
- `scripts/sorts/clerc-niveaux-5-6-7/changement-de-plan.js`
- `scripts/sorts/clerc-niveaux-5-6-7/colonne-de-feu.js`
- `scripts/sorts/clerc-niveaux-5-6-7/communion.js`
- `scripts/sorts/clerc-niveaux-5-6-7/controle-du-climat.js`
- `scripts/sorts/clerc-niveaux-5-6-7/dissipation-du-mal.js`
- `scripts/sorts/clerc-niveaux-5-6-7/fleau-d-insectes.js`
- `scripts/sorts/clerc-niveaux-5-6-7/guerison.js`
- `scripts/sorts/clerc-niveaux-5-6-7/langage-des-monstres.js`
- `scripts/sorts/clerc-niveaux-5-6-7/marche-sur-le-vent.js`
- `scripts/sorts/clerc-niveaux-5-6-7/mot-de-rappel.js`
- `scripts/sorts/clerc-niveaux-5-6-7/orientation.js`
- `scripts/sorts/clerc-niveaux-5-6-7/parole-sacree.js`
- `scripts/sorts/clerc-niveaux-5-6-7/penitence.js`
- `scripts/sorts/clerc-niveaux-5-6-7/pierres-parlantes.js`
- `scripts/sorts/clerc-niveaux-5-6-7/quete-religieuse.js`
- `scripts/sorts/clerc-niveaux-5-6-7/rappel-a-la-vie.js`
- `scripts/sorts/clerc-niveaux-5-6-7/regeneration.js`
- `scripts/sorts/clerc-niveaux-5-6-7/restauration.js`
- `scripts/sorts/clerc-niveaux-5-6-7/resurrection.js`
- `scripts/sorts/clerc-niveaux-5-6-7/separation-des-eaux.js`
- `scripts/sorts/clerc-niveaux-5-6-7/serviteur-aerien.js`
- `scripts/sorts/clerc-niveaux-5-6-7/sort-astral.js`
- `scripts/sorts/clerc-niveaux-5-6-7/symbole.js`
- `scripts/sorts/clerc-niveaux-5-6-7/tremblement-de-terre.js`

## Scripts orphelins

- `scripts/sorts/agrandissement.js`
- `scripts/sorts/amitie-avec-les-animaux.js`
- `scripts/sorts/amitie.js`
- `scripts/sorts/animation-des-objets.js`
- `scripts/sorts/appel-de-creatures-sylvestres.js`
- `scripts/sorts/appel-de-la-foudre.js`
- `scripts/sorts/arbre.js`
- `scripts/sorts/baie-delicieuse-consommation.js`
- `scripts/sorts/baie-delicieuse.js`
- `scripts/sorts/barriere-de-lames.js`
- `scripts/sorts/bassin-reflechissant.js`
- `scripts/sorts/batons-en-serpents.js`
- `scripts/sorts/changement-de-plan.js`
- `scripts/sorts/charmes-personne-ou-mammifere.js`
- `scripts/sorts/chute_de_plume.js`
- `scripts/sorts/clair-d-etoiles.js`
- `scripts/sorts/collet.js`
- `scripts/sorts/communion.js`
- `scripts/sorts/comprehension_langue.js`
- `scripts/sorts/conjuration-d-animaux-i.js`
- `scripts/sorts/conjuration-d-insectes.js`
- `scripts/sorts/controle-de-la-temperature-rayon-de-10.js`
- `scripts/sorts/croc-en-jambe.js`
- `scripts/sorts/croissance-d-epines.js`
- `scripts/sorts/croissance-vegetale.js`
- `scripts/sorts/detect_magic.js`
- `scripts/sorts/detection-des-collets-et-des-fosses.js`
- `scripts/sorts/detection_invisibilite.js`
- `scripts/sorts/diable-de-poussiere.js`
- `scripts/sorts/dissipation-du-mal.js`
- `scripts/sorts/distorsion-du-bois.js`
- `scripts/sorts/druide-aquagenese.js`
- `scripts/sorts/druide-confusion.js`
- `scripts/sorts/druide-controle-du-climat.js`
- `scripts/sorts/druide-croissance-animale.js`
- `scripts/sorts/druide-debilite-mentale.js`
- `scripts/sorts/druide-langage-des-plantes.js`
- `scripts/sorts/druide-piege-a-feu.js`
- `scripts/sorts/druide-pyrotechnie.js`
- `scripts/sorts/druide-soins-majeurs.js`
- `scripts/sorts/enchevetrement.js`
- `scripts/sorts/endurance-de-la-chaleur-endurance-du-froid.js`
- `scripts/sorts/escalade_araignee.js`
- `scripts/sorts/esp.js`
- `scripts/sorts/expiation.js`
- `scripts/sorts/fermeture.js`
- `scripts/sorts/feu-feerique.js`
- `scripts/sorts/fleau-d-insectes.js`
- `scripts/sorts/foret-hallucinatoire.js`
- `scripts/sorts/gourdin-magique.js`
- `scripts/sorts/guerison.js`
- `scripts/sorts/illusionniste-confusion.js`
- `scripts/sorts/illusionniste-corde-enchantee.js`
- `scripts/sorts/illusionniste-detection-de-la-magie.js`
- `scripts/sorts/illusionniste-effroi.js`
- `scripts/sorts/illusionniste-image-miroir.js`
- `scripts/sorts/illusionniste-labyrinthe.js`
- `scripts/sorts/illusionniste-lumiere-eternelle.js`
- `scripts/sorts/illusionniste-lumiere.js`
- `scripts/sorts/illusionniste-lumieres-dansantes.js`
- `scripts/sorts/illusionniste-sort-astral.js`
- `scripts/sorts/illusionniste-terrain-hallucinatoire.js`
- `scripts/sorts/image_miroir.js`
- `scripts/sorts/immobilisation-des-animaux.js`
- `scripts/sorts/immobilisation-des-personnes.js`
- `scripts/sorts/immobilisation-des-plantes.js`
- `scripts/sorts/insecte-geant.js`
- `scripts/sorts/invisibilite-aux-animaux.js`
- `scripts/sorts/invisibilite-aux-morts-vivants.js`
- `scripts/sorts/invisibilite.js`
- `scripts/sorts/lame-enflammee.js`
- `scripts/sorts/langage-des-monstres.js`
- `scripts/sorts/langues.js`
- `scripts/sorts/lithomancie.js`
- `scripts/sorts/localisation-d-animaux-ou-de-plantes.js`
- `scripts/sorts/localisation-d-un-objet.js`
- `scripts/sorts/magicien-abaissement-des-eaux.js`
- `scripts/sorts/magicien-bouche-magique.js`
- `scripts/sorts/magicien-bruitage.js`
- `scripts/sorts/magicien-catalepsie.js`
- `scripts/sorts/magicien-chien-fidele-de-mordekainen.js`
- `scripts/sorts/magicien-controle-du-climat.js`
- `scripts/sorts/magicien-desenvoutement.js`
- `scripts/sorts/magicien-detection-de-l-invisibilite.js`
- `scripts/sorts/magicien-detection-de-la-magie.js`
- `scripts/sorts/magicien-detection-du-mal.js`
- `scripts/sorts/magicien-dissipation-de-la-magie.js`
- `scripts/sorts/magicien-force-fantasmagorique.js`
- `scripts/sorts/magicien-holographie.js`
- `scripts/sorts/magicien-invisibilite-sur-3-m.js`
- `scripts/sorts/magicien-invisibilite.js`
- `scripts/sorts/magicien-lithomorphose.js`
- `scripts/sorts/magicien-lumiere-eternelle.js`
- `scripts/sorts/magicien-lumiere.js`
- `scripts/sorts/magicien-mur-de-feu.js`
- `scripts/sorts/magicien-phytomorphose.js`
- `scripts/sorts/magicien-protection-contre-le-mal.js`
- `scripts/sorts/magicien-reincarnation.js`
- `scripts/sorts/magicien-respiration-aquatique.js`
- `scripts/sorts/magicien-separation-des-eaux.js`
- `scripts/sorts/magicien-sort-astral.js`
- `scripts/sorts/magicien-suggestion.js`
- `scripts/sorts/magicien-symbole.js`
- `scripts/sorts/magicien-transmutation-de-pierre-en-boue.js`
- `scripts/sorts/magicien-ventriloquie.js`
- `scripts/sorts/mains_brulantes.js`
- `scripts/sorts/marche-des-vents.js`
- `scripts/sorts/messager.js`
- `scripts/sorts/metal-brulant.js`
- `scripts/sorts/missile_magique.js`
- `scripts/sorts/mort-simulee.js`
- `scripts/sorts/neutralisation-du-poison.js`
- `scripts/sorts/obscurcissement.js`
- `scripts/sorts/orientation.js`
- `scripts/sorts/parole-sacree-maudite.js`
- `scripts/sorts/passage-sans-traces.js`
- `scripts/sorts/peau-d-ecorce.js`
- `scripts/sorts/piege-de-feu.js`
- `scripts/sorts/pierre-magique.js`
- `scripts/sorts/pilier-de-feu.js`
- `scripts/sorts/porte-vegetale.js`
- `scripts/sorts/poussee.js`
- `scripts/sorts/production-de-feu.js`
- `scripts/sorts/production-de-flammes.js`
- `scripts/sorts/protection-contre-la-foudre.js`
- `scripts/sorts/protection-contre-le-mal-rayon-de-10-pieds.js`
- `scripts/sorts/protection-contre-le-plan-negatif.js`
- `scripts/sorts/purification-de-la-nourriture-et-de-la-boisson.js`
- `scripts/sorts/quete-religieuse.js`
- `scripts/sorts/rappel-a-la-vie.js`
- `scripts/sorts/rappel.js`
- `scripts/sorts/regeneration.js`
- `scripts/sorts/repulsion-des-insectes.js`
- `scripts/sorts/resistance.js`
- `scripts/sorts/restauration.js`
- `scripts/sorts/resurrection.js`
- `scripts/sorts/saut.js`
- `scripts/sorts/serviteur-aerien.js`
- `scripts/sorts/serviteur_invisible.js`
- `scripts/sorts/soins-des-blessures-legeres.js`
- `scripts/sorts/soins_mineurs.js`
- `scripts/sorts/tenebres_5m.js`
- `scripts/sorts/tenser.js`
- `scripts/sorts/traversee-des-flammes.js`
- `scripts/sorts/tremblement-de-terre.js`

## Dialog legacy

### new Dialog

- `scripts/sorts/abaissement-des-eaux.js`
- `scripts/sorts/amitie-avec-les-animaux.js`
- `scripts/sorts/animation-des-morts.js`
- `scripts/sorts/animation-des-objets.js`
- `scripts/sorts/appel-de-creatures-sylvestres.js`
- `scripts/sorts/appel-de-la-foudre.js`
- `scripts/sorts/arbre.js`
- `scripts/sorts/augure.js`
- `scripts/sorts/baie-delicieuse.js`
- `scripts/sorts/barriere-de-lames.js`
- `scripts/sorts/bassin-reflechissant.js`
- `scripts/sorts/batons-en-serpents.js`
- `scripts/sorts/benediction.js`
- `scripts/sorts/cantique.js`
- `scripts/sorts/changement-de-plan.js`
- `scripts/sorts/charme-serpents.js`
- `scripts/sorts/charmes-personne-ou-mammifere.js`
- `scripts/sorts/clair-d-etoiles.js`
- `scripts/sorts/collet.js`
- `scripts/sorts/communication-avec-les-morts.js`
- `scripts/sorts/communion.js`
- `scripts/sorts/conjuration-d-animaux-i.js`
- `scripts/sorts/conjuration-d-insectes.js`
- `scripts/sorts/connaissance-des-alignements.js`
- `scripts/sorts/controle-de-la-temperature-rayon-de-10.js`
- `scripts/sorts/controle-du-climat.js`
- `scripts/sorts/creation-de-nourriture-et-d-eau.js`
- `scripts/sorts/croc-en-jambe.js`
- `scripts/sorts/croissance-d-epines.js`
- `scripts/sorts/croissance-vegetale.js`
- `scripts/sorts/delivrance-de-la-malediction.js`
- `scripts/sorts/detection-de-la-magie.js`
- `scripts/sorts/detection-des-charmes.js`
- `scripts/sorts/detection-des-collets-et-des-fosses.js`
- `scripts/sorts/detection-des-mensonges.js`
- `scripts/sorts/detection-des-pieges.js`
- `scripts/sorts/diable-de-poussiere.js`
- `scripts/sorts/dissipation-de-la-magie.js`
- `scripts/sorts/dissipation-du-mal.js`
- `scripts/sorts/distorsion-du-bois.js`
- `scripts/sorts/divination.js`
- `scripts/sorts/druide-amitie-animale.js`
- `scripts/sorts/druide-animation-de-la-roche.js`
- `scripts/sorts/druide-aquagenese.js`
- `scripts/sorts/druide-arbre.js`
- `scripts/sorts/druide-aura-feerique.js`
- `scripts/sorts/druide-batons-a-serpents.js`
- `scripts/sorts/druide-bouclier-anti-animal.js`
- `scripts/sorts/druide-bouclier-anti-plantes.js`
- `scripts/sorts/druide-catalepsie.js`
- `scripts/sorts/druide-chariot-de-sustarre.js`
- `scripts/sorts/druide-charme-personnes-ou-mammiferes.js`
- `scripts/sorts/druide-communion-avec-la-nature.js`
- `scripts/sorts/druide-confusion.js`
- `scripts/sorts/druide-contre-poison.js`
- `scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js`
- `scripts/sorts/druide-controle-des-vents.js`
- `scripts/sorts/druide-controle-du-climat.js`
- `scripts/sorts/druide-croc-en-jambe.js`
- `scripts/sorts/druide-croissance-animale.js`
- `scripts/sorts/druide-debilite-mentale.js`
- `scripts/sorts/druide-detection-de-la-magie.js`
- `scripts/sorts/druide-detection-des-pieges-sylvestres.js`
- `scripts/sorts/druide-langage-animal.js`
- `scripts/sorts/druide-langage-des-plantes.js`
- `scripts/sorts/druide-lithomorphose.js`
- `scripts/sorts/druide-localisation-des-animaux.js`
- `scripts/sorts/druide-localisation-des-plantes.js`
- `scripts/sorts/druide-metal-brulant.js`
- `scripts/sorts/druide-mort-rampante.js`
- `scripts/sorts/druide-mur-d-epines.js`
- `scripts/sorts/druide-mur-de-feu.js`
- `scripts/sorts/druide-obscurcissement.js`
- `scripts/sorts/druide-paralysie-animale.js`
- `scripts/sorts/druide-paralysie-vegetale.js`
- `scripts/sorts/druide-passage-sans-trace.js`
- `scripts/sorts/druide-passe-plantes.js`
- `scripts/sorts/druide-peau-d-ecorce.js`
- `scripts/sorts/druide-piege-a-feu.js`
- `scripts/sorts/druide-piege-sylvestre.js`
- `scripts/sorts/druide-porte-vegetale.js`
- `scripts/sorts/druide-prevision-du-temps.js`
- `scripts/sorts/druide-protection-contre-la-foudre.js`
- `scripts/sorts/druide-protection-contre-le-feu.js`
- `scripts/sorts/druide-purification-de-l-eau.js`
- `scripts/sorts/druide-pyrotechnie.js`
- `scripts/sorts/druide-reincarnation.js`
- `scripts/sorts/druide-repulsion-des-insectes.js`
- `scripts/sorts/druide-repulsion-du-bois.js`
- `scripts/sorts/druide-respiration-aquatique.js`
- `scripts/sorts/druide-shillelagh.js`
- `scripts/sorts/druide-soin-ultime.js`
- `scripts/sorts/druide-soins-majeurs.js`
- `scripts/sorts/druide-soins-mineurs.js`
- `scripts/sorts/druide-tempete-de-feu.js`
- `scripts/sorts/druide-transit-vegetal.js`
- `scripts/sorts/druide-transmutation-de-pierre-en-boue.js`
- `scripts/sorts/druide-transmutation-du-metal-en-bois.js`
- `scripts/sorts/enchevetrement.js`
- `scripts/sorts/endurance-de-la-chaleur-endurance-du-froid.js`
- `scripts/sorts/exorcisme.js`
- `scripts/sorts/expiation.js`
- `scripts/sorts/feu-feerique.js`
- `scripts/sorts/fleau-d-insectes.js`
- `scripts/sorts/foret-hallucinatoire.js`
- `scripts/sorts/glyphe-de-garde.js`
- `scripts/sorts/gourdin-magique.js`
- `scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js`
- `scripts/sorts/guerison-des-maladies.js`
- `scripts/sorts/guerison.js`
- `scripts/sorts/illusionniste-alteration-de-la-realite.js`
- `scripts/sorts/illusionniste-bouche-magique.js`
- `scripts/sorts/illusionniste-bruitage.js`
- `scripts/sorts/illusionniste-cecite.js`
- `scripts/sorts/illusionniste-changement-d-apparence.js`
- `scripts/sorts/illusionniste-chaos.js`
- `scripts/sorts/illusionniste-confusion.js`
- `scripts/sorts/illusionniste-corde-enchantee.js`
- `scripts/sorts/illusionniste-creation-majeure.js`
- `scripts/sorts/illusionniste-creation-mineure.js`
- `scripts/sorts/illusionniste-desinformation.js`
- `scripts/sorts/illusionniste-detection-de-l-invisibilite.js`
- `scripts/sorts/illusionniste-detection-de-la-magie.js`
- `scripts/sorts/illusionniste-detection-des-illusions.js`
- `scripts/sorts/illusionniste-dissipation-de-l-epuisement.js`
- `scripts/sorts/illusionniste-dissipation-des-illusions.js`
- `scripts/sorts/illusionniste-ecriture-illusoire.js`
- `scripts/sorts/illusionniste-effroi.js`
- `scripts/sorts/illusionniste-emotion.js`
- `scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js`
- `scripts/sorts/illusionniste-force-fantasmagorique.js`
- `scripts/sorts/illusionniste-force-spectrale.js`
- `scripts/sorts/illusionniste-holographie.js`
- `scripts/sorts/illusionniste-hypnotisme.js`
- `scripts/sorts/illusionniste-illusion-permanente.js`
- `scripts/sorts/illusionniste-illusion-programmee.js`
- `scripts/sorts/illusionniste-image-miroir.js`
- `scripts/sorts/illusionniste-invisibilite-amelioree.js`
- `scripts/sorts/illusionniste-invisibilite-sur-3-m.js`
- `scripts/sorts/illusionniste-invisibilite.js`
- `scripts/sorts/illusionniste-invocation-des-animaux.js`
- `scripts/sorts/illusionniste-invocation-des-ombres.js`
- `scripts/sorts/illusionniste-jet-de-couleurs.js`
- `scripts/sorts/illusionniste-jet-prismatique.js`
- `scripts/sorts/illusionniste-labyrinthe.js`
- `scripts/sorts/illusionniste-lumiere-eternelle.js`
- `scripts/sorts/illusionniste-lumiere.js`
- `scripts/sorts/illusionniste-lumieres-dansantes.js`
- `scripts/sorts/illusionniste-magie-demi-ombre.js`
- `scripts/sorts/illusionniste-magie-des-ombres.js`
- `scripts/sorts/illusionniste-monstres-demi-ombre.js`
- `scripts/sorts/illusionniste-monstres-des-ombres.js`
- `scripts/sorts/illusionniste-motif-hypnotique.js`
- `scripts/sorts/illusionniste-mur-de-brouillard.js`
- `scripts/sorts/illusionniste-mur-prismatique.js`
- `scripts/sorts/illusionniste-nappe-de-brouillard.js`
- `scripts/sorts/illusionniste-non-detection.js`
- `scripts/sorts/illusionniste-ombres.js`
- `scripts/sorts/illusionniste-paralysie-musculaire.js`
- `scripts/sorts/illusionniste-phytomorphose.js`
- `scripts/sorts/illusionniste-porte-des-ombres.js`
- `scripts/sorts/illusionniste-reflexion-des-regards.js`
- `scripts/sorts/illusionniste-sort-astral.js`
- `scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js`
- `scripts/sorts/illusionniste-suggestion-de-masse.js`
- `scripts/sorts/illusionniste-suggestion.js`
- `scripts/sorts/illusionniste-surdite.js`
- `scripts/sorts/illusionniste-tenebres-eternelles.js`
- `scripts/sorts/illusionniste-tenebres.js`
- `scripts/sorts/illusionniste-terrain-hallucinatoire.js`
- `scripts/sorts/illusionniste-trouble.js`
- `scripts/sorts/illusionniste-tueur-fantasmagorique.js`
- `scripts/sorts/illusionniste-ventriloquie.js`
- `scripts/sorts/illusionniste-vision-reelle.js`
- `scripts/sorts/illusionniste-vision.js`
- `scripts/sorts/illusionniste-voile-illusoire.js`
- `scripts/sorts/immobilisation-des-animaux.js`
- `scripts/sorts/immobilisation-des-personnes.js`
- `scripts/sorts/immobilisation-des-plantes.js`
- `scripts/sorts/insecte-geant.js`
- `scripts/sorts/invisibilite-aux-animaux.js`
- `scripts/sorts/invisibilite-aux-morts-vivants.js`
- `scripts/sorts/invocation-des-animaux.js`
- `scripts/sorts/lame-enflammee.js`
- `scripts/sorts/langage-des-animaux.js`
- `scripts/sorts/langage-des-monstres.js`
- `scripts/sorts/langage-des-plantes.js`
- `scripts/sorts/langues.js`
- `scripts/sorts/lithomancie.js`
- `scripts/sorts/localisation-d-animaux-ou-de-plantes.js`
- `scripts/sorts/localisation-d-un-objet.js`
- `scripts/sorts/lumiere-continuelle.js`
- `scripts/sorts/magicien-abaissement-des-eaux.js`
- `scripts/sorts/magicien-agrandissement.js`
- `scripts/sorts/magicien-allometamorphose.js`
- `scripts/sorts/magicien-antipathie-sympathie.js`
- `scripts/sorts/magicien-arme-enchantee.js`
- `scripts/sorts/magicien-arret-du-temps.js`
- `scripts/sorts/magicien-autometamorphose.js`
- `scripts/sorts/magicien-bouche-magique.js`
- `scripts/sorts/magicien-bouclier-de-feu.js`
- `scripts/sorts/magicien-boule-de-feu-a-retardement.js`
- `scripts/sorts/magicien-bruitage.js`
- `scripts/sorts/magicien-bulle-anti-magique.js`
- `scripts/sorts/magicien-cacodemon.js`
- `scripts/sorts/magicien-catalepsie.js`
- `scripts/sorts/magicien-charme-masse.js`
- `scripts/sorts/magicien-charme-monstres.js`
- `scripts/sorts/magicien-charme-plantes.js`
- `scripts/sorts/magicien-chasseur-invisible.js`
- `scripts/sorts/magicien-chaumiere-de-leomund.js`
- `scripts/sorts/magicien-chien-fidele-de-mordekainen.js`
- `scripts/sorts/magicien-chute-de-plume.js`
- `scripts/sorts/magicien-clairaudience.js`
- `scripts/sorts/magicien-clairvoyance.js`
- `scripts/sorts/magicien-clone.js`
- `scripts/sorts/magicien-coffre-secret-de-leomund.js`
- `scripts/sorts/magicien-comprehension-des-langues.js`
- `scripts/sorts/magicien-cone-de-froid.js`
- `scripts/sorts/magicien-confusion.js`
- `scripts/sorts/magicien-contact-d-autres-plans.js`
- `scripts/sorts/magicien-controle-du-climat.js`
- `scripts/sorts/magicien-corde-enchantee.js`
- `scripts/sorts/magicien-cristairain.js`
- `scripts/sorts/magicien-croissance-animale.js`
- `scripts/sorts/magicien-danse-irresistible-d-otto.js`
- `scripts/sorts/magicien-debilite-mentale.js`
- `scripts/sorts/magicien-desenvoutement.js`
- `scripts/sorts/magicien-desintegration.js`
- `scripts/sorts/magicien-detection-de-l-invisibilite.js`
- `scripts/sorts/magicien-detection-de-la-magie.js`
- `scripts/sorts/magicien-detection-du-mal.js`
- `scripts/sorts/magicien-disparition.js`
- `scripts/sorts/magicien-disque-flottant-de-tenser.js`
- `scripts/sorts/magicien-dissipation-de-la-magie.js`
- `scripts/sorts/magicien-distorsion-des-distances.js`
- `scripts/sorts/magicien-duo-dimension.js`
- `scripts/sorts/magicien-e-s-p.js`
- `scripts/sorts/magicien-eau-aeree.js`
- `scripts/sorts/magicien-ecriture.js`
- `scripts/sorts/magicien-effacement.js`
- `scripts/sorts/magicien-effroi.js`
- `scripts/sorts/magicien-embroussaillement.js`
- `scripts/sorts/magicien-emprisonnement-de-l-ame.js`
- `scripts/sorts/magicien-emprisonnement.js`
- `scripts/sorts/magicien-enchantement.js`
- `scripts/sorts/magicien-epee-de-mordenkainen.js`
- `scripts/sorts/magicien-escalade-d-araignee.js`
- `scripts/sorts/magicien-excavation.js`
- `scripts/sorts/magicien-extension-i.js`
- `scripts/sorts/magicien-extension-ii.js`
- `scripts/sorts/magicien-extension-iii.js`
- `scripts/sorts/magicien-fermeture.js`
- `scripts/sorts/magicien-feu-charmeur.js`
- `scripts/sorts/magicien-fleche-de-feu.js`
- `scripts/sorts/magicien-force-fantasmagorique.js`
- `scripts/sorts/magicien-force.js`
- `scripts/sorts/magicien-fracassement.js`
- `scripts/sorts/magicien-glissement-de-terrain.js`
- `scripts/sorts/magicien-globe-d-invulnerabilite.js`
- `scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js`
- `scripts/sorts/magicien-heteromorphisme.js`
- `scripts/sorts/magicien-holographie.js`
- `scripts/sorts/magicien-identification.js`
- `scripts/sorts/magicien-il-magique.js`
- `scripts/sorts/magicien-image-miroir.js`
- `scripts/sorts/magicien-immunite-magique-de-serten.js`
- `scripts/sorts/magicien-incantation-mortelle.js`
- `scripts/sorts/magicien-infravision.js`
- `scripts/sorts/magicien-intermittence.js`
- `scripts/sorts/magicien-inversion-de-la-gravite.js`
- `scripts/sorts/magicien-invisibilite-de-masse.js`
- `scripts/sorts/magicien-invisibilite-sur-3-m.js`
- `scripts/sorts/magicien-invisibilite.js`
- `scripts/sorts/magicien-invocation-d-elemental.js`
- `scripts/sorts/magicien-invocation-d-un-familier.js`
- `scripts/sorts/magicien-invocation-de-monstre-ii.js`
- `scripts/sorts/magicien-invocation-de-monstre-iii.js`
- `scripts/sorts/magicien-invocation-de-monstre-iv.js`
- `scripts/sorts/magicien-invocation-de-monstre-v.js`
- `scripts/sorts/magicien-invocation-de-monstre-vi.js`
- `scripts/sorts/magicien-invocation-de-monstre-vii.js`
- `scripts/sorts/magicien-invocation-de-monstres-i.js`
- `scripts/sorts/magicien-invocation-instantanee-de-drawmij.js`
- `scripts/sorts/magicien-labyrinthe.js`
- `scripts/sorts/magicien-langues.js`
- `scripts/sorts/magicien-lecture-de-la-magie.js`
- `scripts/sorts/magicien-levitation.js`
- `scripts/sorts/magicien-lithomorphose.js`
- `scripts/sorts/magicien-localisation-d-objets.js`
- `scripts/sorts/magicien-lumiere-eternelle.js`
- `scripts/sorts/magicien-lumiere.js`
- `scripts/sorts/magicien-lumieres-dansantes.js`
- `scripts/sorts/magicien-main-broyante-de-bigby.js`
- `scripts/sorts/magicien-main-d-interposition-de-bigby.js`
- `scripts/sorts/magicien-main-de-force-de-bigby.js`
- `scripts/sorts/magicien-maladresse.js`
- `scripts/sorts/magicien-message.js`
- `scripts/sorts/magicien-metempsycose.js`
- `scripts/sorts/magicien-mot-de-pouvoir-cecite.js`
- `scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js`
- `scripts/sorts/magicien-mot-de-pouvoir-mort.js`
- `scripts/sorts/magicien-moyen-mnemonique-de-rary.js`
- `scripts/sorts/magicien-mur-de-fer.js`
- `scripts/sorts/magicien-mur-de-feu.js`
- `scripts/sorts/magicien-mur-de-force.js`
- `scripts/sorts/magicien-mur-de-glace.js`
- `scripts/sorts/magicien-mur-de-roc.js`
- `scripts/sorts/magicien-mythomancie.js`
- `scripts/sorts/magicien-necro-animation.js`
- `scripts/sorts/magicien-nuage-incendiaire.js`
- `scripts/sorts/magicien-nuage-letal.js`
- `scripts/sorts/magicien-nuee-de-meteores.js`
- `scripts/sorts/magicien-or-des-fous.js`
- `scripts/sorts/magicien-oubli.js`
- `scripts/sorts/magicien-ouverture.js`
- `scripts/sorts/magicien-paralysie-des-monstres.js`
- `scripts/sorts/magicien-paralysie.js`
- `scripts/sorts/magicien-passe-muraille.js`
- `scripts/sorts/magicien-permanence.js`
- `scripts/sorts/magicien-phytomorphose.js`
- `scripts/sorts/magicien-piege-a-feu.js`
- `scripts/sorts/magicien-piege-de-leomund.js`
- `scripts/sorts/magicien-poigne-de-bigby.js`
- `scripts/sorts/magicien-poing-de-bigby.js`
- `scripts/sorts/magicien-porte-de-phase.js`
- `scripts/sorts/magicien-porte-dimensionnelle.js`
- `scripts/sorts/magicien-poussee.js`
- `scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js`
- `scripts/sorts/magicien-protection-contre-le-mal.js`
- `scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js`
- `scripts/sorts/magicien-protection-d-esprit.js`
- `scripts/sorts/magicien-punition-spirituelle.js`
- `scripts/sorts/magicien-pyrotechnie.js`
- `scripts/sorts/magicien-quete-magique.js`
- `scripts/sorts/magicien-rafale-de-vent.js`
- `scripts/sorts/magicien-ralentissement.js`
- `scripts/sorts/magicien-rapidite.js`
- `scripts/sorts/magicien-reincarnation.js`
- `scripts/sorts/magicien-reparation.js`
- `scripts/sorts/magicien-repulsion.js`
- `scripts/sorts/magicien-respiration-aquatique.js`
- `scripts/sorts/magicien-runes-explosives.js`
- `scripts/sorts/magicien-saut.js`
- `scripts/sorts/magicien-separation-des-eaux.js`
- `scripts/sorts/magicien-serviteur-invisible.js`
- `scripts/sorts/magicien-seuil.js`
- `scripts/sorts/magicien-simulacre.js`
- `scripts/sorts/magicien-sort-astral.js`
- `scripts/sorts/magicien-souhait-majeur.js`
- `scripts/sorts/magicien-souhait-mineur.js`
- `scripts/sorts/magicien-sphere-glaciale-d-otiluke.js`
- `scripts/sorts/magicien-sphere-prismatique.js`
- `scripts/sorts/magicien-stase-temporelle.js`
- `scripts/sorts/magicien-statue.js`
- `scripts/sorts/magicien-suggestion.js`
- `scripts/sorts/magicien-symbole.js`
- `scripts/sorts/magicien-telekinesie.js`
- `scripts/sorts/magicien-teleportation.js`
- `scripts/sorts/magicien-tempete-de-glace.js`
- `scripts/sorts/magicien-tenebres-sur-5-metres.js`
- `scripts/sorts/magicien-terrain-hallucinatoire.js`
- `scripts/sorts/magicien-transformation-d-objets.js`
- `scripts/sorts/magicien-transformation-de-tenser.js`
- `scripts/sorts/magicien-transmutation-de-pierre-en-boue.js`
- `scripts/sorts/magicien-transmutation-de-pierre-en-chair.js`
- `scripts/sorts/magicien-transvision.js`
- `scripts/sorts/magicien-ventriloquie.js`
- `scripts/sorts/magicien-verrou-magique.js`
- `scripts/sorts/magicien-vigiles-et-sentinelles.js`
- `scripts/sorts/magicien-vol.js`
- `scripts/sorts/marche-des-vents.js`
- `scripts/sorts/marteau-spirituel.js`
- `scripts/sorts/messager.js`
- `scripts/sorts/metal-brulant.js`
- `scripts/sorts/mort-simulee.js`
- `scripts/sorts/neutralisation-du-poison.js`
- `scripts/sorts/obscurcissement.js`
- `scripts/sorts/orientation.js`
- `scripts/sorts/parole-sacree-maudite.js`
- `scripts/sorts/passage-sans-traces.js`
- `scripts/sorts/peau-d-ecorce.js`
- `scripts/sorts/piege-de-feu.js`
- `scripts/sorts/pierre-magique.js`
- `scripts/sorts/pilier-de-feu.js`
- `scripts/sorts/porte-vegetale.js`
- `scripts/sorts/priere.js`
- `scripts/sorts/production-de-feu.js`
- `scripts/sorts/production-de-flammes.js`
- `scripts/sorts/protection-contre-la-foudre.js`
- `scripts/sorts/protection-contre-le-mal-rayon-de-10-pieds.js`
- `scripts/sorts/protection-contre-le-mal.js`
- `scripts/sorts/protection-contre-le-plan-negatif.js`
- `scripts/sorts/purification-de-la-nourriture-et-de-la-boisson.js`
- `scripts/sorts/pyrotechnie.js`
- `scripts/sorts/quete-religieuse.js`
- `scripts/sorts/ralentissement-du-poison.js`
- `scripts/sorts/rappel-a-la-vie.js`
- `scripts/sorts/rappel.js`
- `scripts/sorts/regeneration.js`
- `scripts/sorts/repulsion-des-insectes.js`
- `scripts/sorts/resistance-au-feu-resistance-au-froid.js`
- `scripts/sorts/respiration-aquatique.js`
- `scripts/sorts/restauration.js`
- `scripts/sorts/resurrection.js`
- `scripts/sorts/sanctuaire.js`
- `scripts/sorts/separation-des-eaux.js`
- `scripts/sorts/serviteur-aerien.js`
- `scripts/sorts/seuil.js`
- `scripts/sorts/silence-rayon-de-15-pieds.js`
- `scripts/sorts/soin-ultime.js`
- `scripts/sorts/soins-des-blessures-graves.js`
- `scripts/sorts/soins-des-blessures-legeres.js`
- `scripts/sorts/soins-mineurs.js`
- `scripts/sorts/sort-astral.js`
- `scripts/sorts/symbole.js`
- `scripts/sorts/tenebres_5m.js`
- `scripts/sorts/traversee-des-flammes.js`
- `scripts/sorts/tremblement-de-terre.js`
- `scripts/sorts/vision-reelle.js`

### Dialog.prompt

Aucun.

## Scripts sans retour booléen clair

- `scripts/sorts/comprehension_langue.js`
- `scripts/sorts/detection_invisibilite.js`
- `scripts/sorts/esp.js`
- `scripts/sorts/invisibilite.js`
- `scripts/sorts/tenser.js`

## Scripts raccordés sans VFX identifiable

- `scripts/sorts/abaissement-des-eaux.js`
- `scripts/sorts/aquagenese.js`
- `scripts/sorts/augure.js`
- `scripts/sorts/batons-a-serpents.js`
- `scripts/sorts/bouche-magique.js`
- `scripts/sorts/cantique.js`
- `scripts/sorts/catalepsie.js`
- `scripts/sorts/charme-serpents.js`
- `scripts/sorts/chien-fidele-de-mordenkainen.js`
- `scripts/sorts/confusion.js`
- `scripts/sorts/connaissance-des-alignements.js`
- `scripts/sorts/contre-poison.js`
- `scripts/sorts/corde-enchantee.js`
- `scripts/sorts/croissance-animale.js`
- `scripts/sorts/debilite-mentale.js`
- `scripts/sorts/desenvoutement.js`
- `scripts/sorts/detection-de-linvisibilite.js`
- `scripts/sorts/detection-des-charmes.js`
- `scripts/sorts/detection-des-mensonges.js`
- `scripts/sorts/detection-des-pieges.js`
- `scripts/sorts/divination.js`
- `scripts/sorts/druide-amitie-animale.js`
- `scripts/sorts/druide-arbre.js`
- `scripts/sorts/druide-aura-feerique.js`
- `scripts/sorts/druide-batons-a-serpents.js`
- `scripts/sorts/druide-bouclier-anti-animal.js`
- `scripts/sorts/druide-bouclier-anti-plantes.js`
- `scripts/sorts/druide-catalepsie.js`
- `scripts/sorts/druide-chariot-de-sustarre.js`
- `scripts/sorts/druide-charme-personnes-ou-mammiferes.js`
- `scripts/sorts/druide-communion-avec-la-nature.js`
- `scripts/sorts/druide-contre-poison.js`
- `scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js`
- `scripts/sorts/druide-controle-des-vents.js`
- `scripts/sorts/druide-croc-en-jambe.js`
- `scripts/sorts/druide-detection-de-la-magie.js`
- `scripts/sorts/druide-detection-des-pieges-sylvestres.js`
- `scripts/sorts/druide-distorsion-du-bois.js`
- `scripts/sorts/druide-doigt-de-mort.js`
- `scripts/sorts/druide-embrasement.js`
- `scripts/sorts/druide-enchevetrement.js`
- `scripts/sorts/druide-flamme.js`
- `scripts/sorts/druide-foret-hallucinatoire.js`
- `scripts/sorts/druide-graines-de-feu.js`
- `scripts/sorts/druide-invisibilite-aux-animaux.js`
- `scripts/sorts/druide-invocation-animale-i.js`
- `scripts/sorts/druide-invocation-animale-ii.js`
- `scripts/sorts/druide-invocation-animale-iii.js`
- `scripts/sorts/druide-invocation-d-insectes.js`
- `scripts/sorts/druide-invocation-d-un-elemental-de-terre.js`
- `scripts/sorts/druide-invocation-d-un-elemental-du-feu.js`
- `scripts/sorts/druide-invocation-de-la-foudre.js`
- `scripts/sorts/druide-invocation-des-creatures-sylvestres.js`
- `scripts/sorts/druide-invocation-du-temps.js`
- `scripts/sorts/druide-langage-animal.js`
- `scripts/sorts/druide-lithomorphose.js`
- `scripts/sorts/druide-localisation-des-animaux.js`
- `scripts/sorts/druide-localisation-des-plantes.js`
- `scripts/sorts/druide-metal-brulant.js`
- `scripts/sorts/druide-mort-rampante.js`
- `scripts/sorts/druide-mur-d-epines.js`
- `scripts/sorts/druide-mur-de-feu.js`
- `scripts/sorts/druide-obscurcissement.js`
- `scripts/sorts/druide-paralysie-animale.js`
- `scripts/sorts/druide-paralysie-vegetale.js`
- `scripts/sorts/druide-passage-sans-trace.js`
- `scripts/sorts/druide-passe-plantes.js`
- `scripts/sorts/druide-peau-d-ecorce.js`
- `scripts/sorts/druide-piege-sylvestre.js`
- `scripts/sorts/druide-porte-vegetale.js`
- `scripts/sorts/druide-prevision-du-temps.js`
- `scripts/sorts/druide-protection-contre-la-foudre.js`
- `scripts/sorts/druide-protection-contre-le-feu.js`
- `scripts/sorts/druide-purification-de-l-eau.js`
- `scripts/sorts/druide-reincarnation.js`
- `scripts/sorts/druide-repulsion-des-insectes.js`
- `scripts/sorts/druide-repulsion-du-bois.js`
- `scripts/sorts/druide-respiration-aquatique.js`
- `scripts/sorts/druide-shillelagh.js`
- `scripts/sorts/druide-soin-ultime.js`
- `scripts/sorts/druide-soins-mineurs.js`
- `scripts/sorts/druide-tempete-de-feu.js`
- `scripts/sorts/druide-transit-vegetal.js`
- `scripts/sorts/druide-transmutation-de-pierre-en-boue.js`
- `scripts/sorts/druide-transmutation-du-metal-en-bois.js`
- `scripts/sorts/effroi.js`
- `scripts/sorts/embroussaillement.js`
- `scripts/sorts/exorcisme.js`
- `scripts/sorts/fleau-dinsectes.js`
- `scripts/sorts/force-fantasmagorique.js`
- `scripts/sorts/holographie.js`
- `scripts/sorts/illusionniste-alteration-de-la-realite.js`
- `scripts/sorts/illusionniste-bouche-magique.js`
- `scripts/sorts/illusionniste-bruitage.js`
- `scripts/sorts/illusionniste-cecite.js`
- `scripts/sorts/illusionniste-changement-d-apparence.js`
- `scripts/sorts/illusionniste-chaos.js`
- `scripts/sorts/illusionniste-creation-majeure.js`
- `scripts/sorts/illusionniste-creation-mineure.js`
- `scripts/sorts/illusionniste-desinformation.js`
- `scripts/sorts/illusionniste-detection-de-l-invisibilite.js`
- `scripts/sorts/illusionniste-detection-des-illusions.js`
- `scripts/sorts/illusionniste-dissipation-de-l-epuisement.js`
- `scripts/sorts/illusionniste-dissipation-des-illusions.js`
- `scripts/sorts/illusionniste-ecriture-illusoire.js`
- `scripts/sorts/illusionniste-emotion.js`
- `scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js`
- `scripts/sorts/illusionniste-force-fantasmagorique.js`
- `scripts/sorts/illusionniste-force-spectrale.js`
- `scripts/sorts/illusionniste-holographie.js`
- `scripts/sorts/illusionniste-hypnotisme.js`
- `scripts/sorts/illusionniste-illusion-permanente.js`
- `scripts/sorts/illusionniste-illusion-programmee.js`
- `scripts/sorts/illusionniste-invisibilite-amelioree.js`
- `scripts/sorts/illusionniste-invisibilite-sur-3-m.js`
- `scripts/sorts/illusionniste-invisibilite.js`
- `scripts/sorts/illusionniste-invocation-des-animaux.js`
- `scripts/sorts/illusionniste-invocation-des-ombres.js`
- `scripts/sorts/illusionniste-jet-de-couleurs.js`
- `scripts/sorts/illusionniste-jet-prismatique.js`
- `scripts/sorts/illusionniste-magie-demi-ombre.js`
- `scripts/sorts/illusionniste-magie-des-ombres.js`
- `scripts/sorts/illusionniste-monstres-demi-ombre.js`
- `scripts/sorts/illusionniste-monstres-des-ombres.js`
- `scripts/sorts/illusionniste-motif-hypnotique.js`
- `scripts/sorts/illusionniste-mur-de-brouillard.js`
- `scripts/sorts/illusionniste-mur-prismatique.js`
- `scripts/sorts/illusionniste-nappe-de-brouillard.js`
- `scripts/sorts/illusionniste-non-detection.js`
- `scripts/sorts/illusionniste-ombres.js`
- `scripts/sorts/illusionniste-paralysie-musculaire.js`
- `scripts/sorts/illusionniste-phytomorphose.js`
- `scripts/sorts/illusionniste-porte-des-ombres.js`
- `scripts/sorts/illusionniste-reflexion-des-regards.js`
- `scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js`
- `scripts/sorts/illusionniste-suggestion-de-masse.js`
- `scripts/sorts/illusionniste-suggestion.js`
- `scripts/sorts/illusionniste-surdite.js`
- `scripts/sorts/illusionniste-tenebres-eternelles.js`
- `scripts/sorts/illusionniste-tenebres.js`
- `scripts/sorts/illusionniste-trouble.js`
- `scripts/sorts/illusionniste-tueur-fantasmagorique.js`
- `scripts/sorts/illusionniste-ventriloquie.js`
- `scripts/sorts/illusionniste-vision-reelle.js`
- `scripts/sorts/illusionniste-vision.js`
- `scripts/sorts/illusionniste-voile-illusoire.js`
- `scripts/sorts/image-miroir.js`
- `scripts/sorts/invisibilite-sur-3-m.js`
- `scripts/sorts/labyrinthe.js`
- `scripts/sorts/langage-des-animaux.js`
- `scripts/sorts/langage-des-plantes.js`
- `scripts/sorts/langue.js`
- `scripts/sorts/lithomorphose.js`
- `scripts/sorts/localisation-dobjets.js`
- `scripts/sorts/lumiere-eternelle.js`
- `scripts/sorts/magicien-agrandissement.js`
- `scripts/sorts/magicien-allometamorphose.js`
- `scripts/sorts/magicien-alteration-des-feux-normaux.js`
- `scripts/sorts/magicien-antipathie-sympathie.js`
- `scripts/sorts/magicien-arme-enchantee.js`
- `scripts/sorts/magicien-arret-du-temps.js`
- `scripts/sorts/magicien-aura-magique-de-nystul.js`
- `scripts/sorts/magicien-autometamorphose.js`
- `scripts/sorts/magicien-bouclier-de-feu.js`
- `scripts/sorts/magicien-boule-de-feu-a-retardement.js`
- `scripts/sorts/magicien-bulle-anti-magique.js`
- `scripts/sorts/magicien-cacodemon.js`
- `scripts/sorts/magicien-charme-masse.js`
- `scripts/sorts/magicien-charme-monstres.js`
- `scripts/sorts/magicien-charme-plantes.js`
- `scripts/sorts/magicien-chasseur-invisible.js`
- `scripts/sorts/magicien-chaumiere-de-leomund.js`
- `scripts/sorts/magicien-chute-de-plume.js`
- `scripts/sorts/magicien-clairaudience.js`
- `scripts/sorts/magicien-clairvoyance.js`
- `scripts/sorts/magicien-clone.js`
- `scripts/sorts/magicien-coffre-secret-de-leomund.js`
- `scripts/sorts/magicien-comprehension-des-langues.js`
- `scripts/sorts/magicien-cone-de-froid.js`
- `scripts/sorts/magicien-confusion.js`
- `scripts/sorts/magicien-contact-d-autres-plans.js`
- `scripts/sorts/magicien-corde-enchantee.js`
- `scripts/sorts/magicien-cristairain.js`
- `scripts/sorts/magicien-croissance-animale.js`
- `scripts/sorts/magicien-danse-irresistible-d-otto.js`
- `scripts/sorts/magicien-debilite-mentale.js`
- `scripts/sorts/magicien-desintegration.js`
- `scripts/sorts/magicien-disparition.js`
- `scripts/sorts/magicien-disque-flottant-de-tenser.js`
- `scripts/sorts/magicien-distorsion-des-distances.js`
- `scripts/sorts/magicien-duo-dimension.js`
- `scripts/sorts/magicien-e-s-p.js`
- `scripts/sorts/magicien-eau-aeree.js`
- `scripts/sorts/magicien-ecriture.js`
- `scripts/sorts/magicien-effacement.js`
- `scripts/sorts/magicien-effroi.js`
- `scripts/sorts/magicien-embroussaillement.js`
- `scripts/sorts/magicien-emprisonnement-de-l-ame.js`
- `scripts/sorts/magicien-emprisonnement.js`
- `scripts/sorts/magicien-enchantement.js`
- `scripts/sorts/magicien-epee-de-mordenkainen.js`
- `scripts/sorts/magicien-escalade-d-araignee.js`
- `scripts/sorts/magicien-excavation.js`
- `scripts/sorts/magicien-extension-i.js`
- `scripts/sorts/magicien-extension-ii.js`
- `scripts/sorts/magicien-extension-iii.js`
- `scripts/sorts/magicien-fermeture.js`
- `scripts/sorts/magicien-feu-charmeur.js`
- `scripts/sorts/magicien-fleche-de-feu.js`
- `scripts/sorts/magicien-force.js`
- `scripts/sorts/magicien-fracassement.js`
- `scripts/sorts/magicien-glissement-de-terrain.js`
- `scripts/sorts/magicien-globe-d-invulnerabilite.js`
- `scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js`
- `scripts/sorts/magicien-heteromorphisme.js`
- `scripts/sorts/magicien-identification.js`
- `scripts/sorts/magicien-il-magique.js`
- `scripts/sorts/magicien-image-miroir.js`
- `scripts/sorts/magicien-immunite-magique-de-serten.js`
- `scripts/sorts/magicien-incantation-mortelle.js`
- `scripts/sorts/magicien-infravision.js`
- `scripts/sorts/magicien-intermittence.js`
- `scripts/sorts/magicien-inversion-de-la-gravite.js`
- `scripts/sorts/magicien-invisibilite-de-masse.js`
- `scripts/sorts/magicien-invocation-d-elemental.js`
- `scripts/sorts/magicien-invocation-d-un-familier.js`
- `scripts/sorts/magicien-invocation-de-monstre-ii.js`
- `scripts/sorts/magicien-invocation-de-monstre-iii.js`
- `scripts/sorts/magicien-invocation-de-monstre-iv.js`
- `scripts/sorts/magicien-invocation-de-monstre-v.js`
- `scripts/sorts/magicien-invocation-de-monstre-vi.js`
- `scripts/sorts/magicien-invocation-de-monstre-vii.js`
- `scripts/sorts/magicien-invocation-de-monstres-i.js`
- `scripts/sorts/magicien-invocation-instantanee-de-drawmij.js`
- `scripts/sorts/magicien-labyrinthe.js`
- `scripts/sorts/magicien-langues.js`
- `scripts/sorts/magicien-lecture-de-la-magie.js`
- `scripts/sorts/magicien-levitation.js`
- `scripts/sorts/magicien-localisation-d-objets.js`
- `scripts/sorts/magicien-lumieres-dansantes.js`
- `scripts/sorts/magicien-main-broyante-de-bigby.js`
- `scripts/sorts/magicien-main-d-interposition-de-bigby.js`
- `scripts/sorts/magicien-main-de-force-de-bigby.js`
- `scripts/sorts/magicien-maladresse.js`
- `scripts/sorts/magicien-message.js`
- `scripts/sorts/magicien-metempsycose.js`
- `scripts/sorts/magicien-mot-de-pouvoir-cecite.js`
- `scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js`
- `scripts/sorts/magicien-mot-de-pouvoir-mort.js`
- `scripts/sorts/magicien-moyen-mnemonique-de-rary.js`
- `scripts/sorts/magicien-mur-de-fer.js`
- `scripts/sorts/magicien-mur-de-force.js`
- `scripts/sorts/magicien-mur-de-glace.js`
- `scripts/sorts/magicien-mur-de-roc.js`
- `scripts/sorts/magicien-mythomancie.js`
- `scripts/sorts/magicien-nuage-incendiaire.js`
- `scripts/sorts/magicien-nuage-letal.js`
- `scripts/sorts/magicien-nuee-de-meteores.js`
- `scripts/sorts/magicien-or-des-fous.js`
- `scripts/sorts/magicien-oubli.js`
- `scripts/sorts/magicien-ouverture.js`
- `scripts/sorts/magicien-paralysie-des-monstres.js`
- `scripts/sorts/magicien-paralysie.js`
- `scripts/sorts/magicien-passe-muraille.js`
- `scripts/sorts/magicien-permanence.js`
- `scripts/sorts/magicien-piege-a-feu.js`
- `scripts/sorts/magicien-piege-de-leomund.js`
- `scripts/sorts/magicien-poigne-de-bigby.js`
- `scripts/sorts/magicien-poing-de-bigby.js`
- `scripts/sorts/magicien-porte-de-phase.js`
- `scripts/sorts/magicien-porte-dimensionnelle.js`
- `scripts/sorts/magicien-poussee.js`
- `scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js`
- `scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js`
- `scripts/sorts/magicien-protection-d-esprit.js`
- `scripts/sorts/magicien-punition-spirituelle.js`
- `scripts/sorts/magicien-pyrotechnie.js`
- `scripts/sorts/magicien-quete-magique.js`
- `scripts/sorts/magicien-rafale-de-vent.js`
- `scripts/sorts/magicien-ralentissement.js`
- `scripts/sorts/magicien-rapidite.js`
- `scripts/sorts/magicien-reparation.js`
- `scripts/sorts/magicien-repulsion.js`
- `scripts/sorts/magicien-runes-explosives.js`
- `scripts/sorts/magicien-saut.js`
- `scripts/sorts/magicien-serviteur-invisible.js`
- `scripts/sorts/magicien-seuil.js`
- `scripts/sorts/magicien-simulacre.js`
- `scripts/sorts/magicien-souhait-majeur.js`
- `scripts/sorts/magicien-souhait-mineur.js`
- `scripts/sorts/magicien-sphere-glaciale-d-otiluke.js`
- `scripts/sorts/magicien-sphere-prismatique.js`
- `scripts/sorts/magicien-stase-temporelle.js`
- `scripts/sorts/magicien-statue.js`
- `scripts/sorts/magicien-telekinesie.js`
- `scripts/sorts/magicien-teleportation.js`
- `scripts/sorts/magicien-tempete-de-glace.js`
- `scripts/sorts/magicien-tenebres-sur-5-metres.js`
- `scripts/sorts/magicien-terrain-hallucinatoire.js`
- `scripts/sorts/magicien-transformation-d-objets.js`
- `scripts/sorts/magicien-transformation-de-tenser.js`
- `scripts/sorts/magicien-transmutation-de-pierre-en-chair.js`
- `scripts/sorts/magicien-transvision.js`
- `scripts/sorts/magicien-verrou-magique.js`
- `scripts/sorts/magicien-vigiles-et-sentinelles.js`
- `scripts/sorts/magicien-vol.js`
- `scripts/sorts/marteau-spirituel.js`
- `scripts/sorts/mur-de-feu.js`
- `scripts/sorts/paralysie.js`
- `scripts/sorts/phytomorphose.js`
- `scripts/sorts/piege-a-feu.js`
- `scripts/sorts/projectile-magique.js`
- `scripts/sorts/protection-contre-le-mal-sur-3-m.js`
- `scripts/sorts/purification-de-leau-et-des-aliments.js`
- `scripts/sorts/ralentissement-du-poison.js`
- `scripts/sorts/reincarnation.js`
- `scripts/sorts/resistance-au-feu-resistance-au-froid.js`
- `scripts/sorts/resistance-au-froid.js`
- `scripts/sorts/silence-rayon-de-15-pieds.js`
- `scripts/sorts/soins-des-blessures-graves.js`
- `scripts/sorts/soins-majeurs.js`
- `scripts/sorts/suggestion.js`
- `scripts/sorts/terrain-hallucinatoire.js`
- `scripts/sorts/transmutation-de-pierre-en-boue.js`
- `scripts/sorts/ventriloquie.js`

## Fallback legacy probable

- `scripts/sorts/magicien-aura-magique-de-nystul.js`

## Écritures Foundry directes potentiellement risquées

- `scripts/sorts/abaissement-des-eaux.js`
- `scripts/sorts/agrandissement.js`
- `scripts/sorts/amitie-avec-les-animaux.js`
- `scripts/sorts/amitie.js`
- `scripts/sorts/animation-des-morts.js`
- `scripts/sorts/animation-des-objets.js`
- `scripts/sorts/apaisement.js`
- `scripts/sorts/appel-de-creatures-sylvestres.js`
- `scripts/sorts/appel-de-la-foudre.js`
- `scripts/sorts/arbre.js`
- `scripts/sorts/augure.js`
- `scripts/sorts/baie-delicieuse-consommation.js`
- `scripts/sorts/baie-delicieuse.js`
- `scripts/sorts/barriere-de-lames.js`
- `scripts/sorts/bassin-reflechissant.js`
- `scripts/sorts/batons-en-serpents.js`
- `scripts/sorts/benediction.js`
- `scripts/sorts/bouclier.js`
- `scripts/sorts/bruitage.js`
- `scripts/sorts/cantique.js`
- `scripts/sorts/changement-de-plan.js`
- `scripts/sorts/charme-serpents.js`
- `scripts/sorts/charme_personne.js`
- `scripts/sorts/charmes-personne-ou-mammifere.js`
- `scripts/sorts/chute_de_plume.js`
- `scripts/sorts/clair-d-etoiles.js`
- `scripts/sorts/collet.js`
- `scripts/sorts/communication-avec-les-morts.js`
- `scripts/sorts/communion.js`
- `scripts/sorts/comprehension_langue.js`
- `scripts/sorts/conjuration-d-animaux-i.js`
- `scripts/sorts/conjuration-d-insectes.js`
- `scripts/sorts/connaissance-des-alignements.js`
- `scripts/sorts/controle-de-la-temperature-rayon-de-10.js`
- `scripts/sorts/controle-du-climat.js`
- `scripts/sorts/creation-d-eau.js`
- `scripts/sorts/creation-de-nourriture-et-d-eau.js`
- `scripts/sorts/croc-en-jambe.js`
- `scripts/sorts/croissance-d-epines.js`
- `scripts/sorts/croissance-vegetale.js`
- `scripts/sorts/delivrance-de-la-malediction.js`
- `scripts/sorts/detect_magic.js`
- `scripts/sorts/detection-de-la-magie.js`
- `scripts/sorts/detection-des-charmes.js`
- `scripts/sorts/detection-des-collets-et-des-fosses.js`
- `scripts/sorts/detection-des-mensonges.js`
- `scripts/sorts/detection-des-pieges.js`
- `scripts/sorts/detection-du-mal.js`
- `scripts/sorts/detection_invisibilite.js`
- `scripts/sorts/diable-de-poussiere.js`
- `scripts/sorts/dissipation-de-la-magie.js`
- `scripts/sorts/dissipation-du-mal.js`
- `scripts/sorts/distorsion-du-bois.js`
- `scripts/sorts/divination.js`
- `scripts/sorts/druide-amitie-animale.js`
- `scripts/sorts/druide-animation-de-la-roche.js`
- `scripts/sorts/druide-aquagenese.js`
- `scripts/sorts/druide-arbre.js`
- `scripts/sorts/druide-aura-feerique.js`
- `scripts/sorts/druide-batons-a-serpents.js`
- `scripts/sorts/druide-bouclier-anti-animal.js`
- `scripts/sorts/druide-bouclier-anti-plantes.js`
- `scripts/sorts/druide-catalepsie.js`
- `scripts/sorts/druide-chariot-de-sustarre.js`
- `scripts/sorts/druide-charme-personnes-ou-mammiferes.js`
- `scripts/sorts/druide-communion-avec-la-nature.js`
- `scripts/sorts/druide-confusion.js`
- `scripts/sorts/druide-contre-poison.js`
- `scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js`
- `scripts/sorts/druide-controle-des-vents.js`
- `scripts/sorts/druide-controle-du-climat.js`
- `scripts/sorts/druide-croc-en-jambe.js`
- `scripts/sorts/druide-croissance-animale.js`
- `scripts/sorts/druide-debilite-mentale.js`
- `scripts/sorts/druide-detection-de-la-magie.js`
- `scripts/sorts/druide-detection-des-pieges-sylvestres.js`
- `scripts/sorts/druide-langage-animal.js`
- `scripts/sorts/druide-langage-des-plantes.js`
- `scripts/sorts/druide-lithomorphose.js`
- `scripts/sorts/druide-localisation-des-animaux.js`
- `scripts/sorts/druide-localisation-des-plantes.js`
- `scripts/sorts/druide-metal-brulant.js`
- `scripts/sorts/druide-mort-rampante.js`
- `scripts/sorts/druide-mur-d-epines.js`
- `scripts/sorts/druide-mur-de-feu.js`
- `scripts/sorts/druide-obscurcissement.js`
- `scripts/sorts/druide-paralysie-animale.js`
- `scripts/sorts/druide-paralysie-vegetale.js`
- `scripts/sorts/druide-passage-sans-trace.js`
- `scripts/sorts/druide-passe-plantes.js`
- `scripts/sorts/druide-peau-d-ecorce.js`
- `scripts/sorts/druide-piege-a-feu.js`
- `scripts/sorts/druide-piege-sylvestre.js`
- `scripts/sorts/druide-porte-vegetale.js`
- `scripts/sorts/druide-prevision-du-temps.js`
- `scripts/sorts/druide-protection-contre-la-foudre.js`
- `scripts/sorts/druide-protection-contre-le-feu.js`
- `scripts/sorts/druide-purification-de-l-eau.js`
- `scripts/sorts/druide-pyrotechnie.js`
- `scripts/sorts/druide-reincarnation.js`
- `scripts/sorts/druide-repulsion-des-insectes.js`
- `scripts/sorts/druide-repulsion-du-bois.js`
- `scripts/sorts/druide-respiration-aquatique.js`
- `scripts/sorts/druide-shillelagh.js`
- `scripts/sorts/druide-soin-ultime.js`
- `scripts/sorts/druide-soins-majeurs.js`
- `scripts/sorts/druide-soins-mineurs.js`
- `scripts/sorts/druide-tempete-de-feu.js`
- `scripts/sorts/druide-transit-vegetal.js`
- `scripts/sorts/druide-transmutation-de-pierre-en-boue.js`
- `scripts/sorts/druide-transmutation-du-metal-en-bois.js`
- `scripts/sorts/enchevetrement.js`
- `scripts/sorts/endurance-de-la-chaleur-endurance-du-froid.js`
- `scripts/sorts/escalade_araignee.js`
- `scripts/sorts/esp.js`
- `scripts/sorts/exorcisme.js`
- `scripts/sorts/expiation.js`
- `scripts/sorts/fermeture.js`
- `scripts/sorts/feu-feerique.js`
- `scripts/sorts/fleau-d-insectes.js`
- `scripts/sorts/foret-hallucinatoire.js`
- `scripts/sorts/glyphe-de-garde.js`
- `scripts/sorts/gourdin-magique.js`
- `scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js`
- `scripts/sorts/guerison-des-maladies.js`
- `scripts/sorts/guerison.js`
- `scripts/sorts/illusionniste-alteration-de-la-realite.js`
- `scripts/sorts/illusionniste-bouche-magique.js`
- `scripts/sorts/illusionniste-bruitage.js`
- `scripts/sorts/illusionniste-cecite.js`
- `scripts/sorts/illusionniste-changement-d-apparence.js`
- `scripts/sorts/illusionniste-chaos.js`
- `scripts/sorts/illusionniste-confusion.js`
- `scripts/sorts/illusionniste-corde-enchantee.js`
- `scripts/sorts/illusionniste-creation-majeure.js`
- `scripts/sorts/illusionniste-creation-mineure.js`
- `scripts/sorts/illusionniste-desinformation.js`
- `scripts/sorts/illusionniste-detection-de-l-invisibilite.js`
- `scripts/sorts/illusionniste-detection-de-la-magie.js`
- `scripts/sorts/illusionniste-detection-des-illusions.js`
- `scripts/sorts/illusionniste-dissipation-de-l-epuisement.js`
- `scripts/sorts/illusionniste-dissipation-des-illusions.js`
- `scripts/sorts/illusionniste-ecriture-illusoire.js`
- `scripts/sorts/illusionniste-effroi.js`
- `scripts/sorts/illusionniste-emotion.js`
- `scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js`
- `scripts/sorts/illusionniste-force-fantasmagorique.js`
- `scripts/sorts/illusionniste-force-spectrale.js`
- `scripts/sorts/illusionniste-holographie.js`
- `scripts/sorts/illusionniste-hypnotisme.js`
- `scripts/sorts/illusionniste-illusion-permanente.js`
- `scripts/sorts/illusionniste-illusion-programmee.js`
- `scripts/sorts/illusionniste-image-miroir.js`
- `scripts/sorts/illusionniste-invisibilite-amelioree.js`
- `scripts/sorts/illusionniste-invisibilite-sur-3-m.js`
- `scripts/sorts/illusionniste-invisibilite.js`
- `scripts/sorts/illusionniste-invocation-des-animaux.js`
- `scripts/sorts/illusionniste-invocation-des-ombres.js`
- `scripts/sorts/illusionniste-jet-de-couleurs.js`
- `scripts/sorts/illusionniste-jet-prismatique.js`
- `scripts/sorts/illusionniste-labyrinthe.js`
- `scripts/sorts/illusionniste-lumiere-eternelle.js`
- `scripts/sorts/illusionniste-lumiere.js`
- `scripts/sorts/illusionniste-lumieres-dansantes.js`
- `scripts/sorts/illusionniste-magie-demi-ombre.js`
- `scripts/sorts/illusionniste-magie-des-ombres.js`
- `scripts/sorts/illusionniste-monstres-demi-ombre.js`
- `scripts/sorts/illusionniste-monstres-des-ombres.js`
- `scripts/sorts/illusionniste-motif-hypnotique.js`
- `scripts/sorts/illusionniste-mur-de-brouillard.js`
- `scripts/sorts/illusionniste-mur-prismatique.js`
- `scripts/sorts/illusionniste-nappe-de-brouillard.js`
- `scripts/sorts/illusionniste-non-detection.js`
- `scripts/sorts/illusionniste-ombres.js`
- `scripts/sorts/illusionniste-paralysie-musculaire.js`
- `scripts/sorts/illusionniste-phytomorphose.js`
- `scripts/sorts/illusionniste-porte-des-ombres.js`
- `scripts/sorts/illusionniste-reflexion-des-regards.js`
- `scripts/sorts/illusionniste-sort-astral.js`
- `scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js`
- `scripts/sorts/illusionniste-suggestion-de-masse.js`
- `scripts/sorts/illusionniste-suggestion.js`
- `scripts/sorts/illusionniste-surdite.js`
- `scripts/sorts/illusionniste-tenebres-eternelles.js`
- `scripts/sorts/illusionniste-tenebres.js`
- `scripts/sorts/illusionniste-terrain-hallucinatoire.js`
- `scripts/sorts/illusionniste-trouble.js`
- `scripts/sorts/illusionniste-tueur-fantasmagorique.js`
- `scripts/sorts/illusionniste-ventriloquie.js`
- `scripts/sorts/illusionniste-vision-reelle.js`
- `scripts/sorts/illusionniste-vision.js`
- `scripts/sorts/illusionniste-voile-illusoire.js`
- `scripts/sorts/image_miroir.js`
- `scripts/sorts/immobilisation-des-animaux.js`
- `scripts/sorts/immobilisation-des-personnes.js`
- `scripts/sorts/immobilisation-des-plantes.js`
- `scripts/sorts/injonction.js`
- `scripts/sorts/insecte-geant.js`
- `scripts/sorts/invisibilite-aux-animaux.js`
- `scripts/sorts/invisibilite-aux-morts-vivants.js`
- `scripts/sorts/invisibilite.js`
- `scripts/sorts/invocation-des-animaux.js`
- `scripts/sorts/lame-enflammee.js`
- `scripts/sorts/langage-des-animaux.js`
- `scripts/sorts/langage-des-monstres.js`
- `scripts/sorts/langage-des-plantes.js`
- `scripts/sorts/langues.js`
- `scripts/sorts/lithomancie.js`
- `scripts/sorts/localisation-d-animaux-ou-de-plantes.js`
- `scripts/sorts/localisation-d-un-objet.js`
- `scripts/sorts/lumiere-continuelle.js`
- `scripts/sorts/lumiere.js`
- `scripts/sorts/magicien-abaissement-des-eaux.js`
- `scripts/sorts/magicien-agrandissement.js`
- `scripts/sorts/magicien-allometamorphose.js`
- `scripts/sorts/magicien-amitie.js`
- `scripts/sorts/magicien-antipathie-sympathie.js`
- `scripts/sorts/magicien-arme-enchantee.js`
- `scripts/sorts/magicien-arret-du-temps.js`
- `scripts/sorts/magicien-aura-magique-de-nystul.js`
- `scripts/sorts/magicien-autometamorphose.js`
- `scripts/sorts/magicien-bouche-magique.js`
- `scripts/sorts/magicien-bouclier-de-feu.js`
- `scripts/sorts/magicien-boule-de-feu-a-retardement.js`
- `scripts/sorts/magicien-boule-de-feu.js`
- `scripts/sorts/magicien-bruitage.js`
- `scripts/sorts/magicien-bulle-anti-magique.js`
- `scripts/sorts/magicien-cacodemon.js`
- `scripts/sorts/magicien-catalepsie.js`
- `scripts/sorts/magicien-charme-masse.js`
- `scripts/sorts/magicien-charme-monstres.js`
- `scripts/sorts/magicien-charme-plantes.js`
- `scripts/sorts/magicien-chasseur-invisible.js`
- `scripts/sorts/magicien-chaumiere-de-leomund.js`
- `scripts/sorts/magicien-chien-fidele-de-mordekainen.js`
- `scripts/sorts/magicien-chute-de-plume.js`
- `scripts/sorts/magicien-clairaudience.js`
- `scripts/sorts/magicien-clairvoyance.js`
- `scripts/sorts/magicien-clone.js`
- `scripts/sorts/magicien-coffre-secret-de-leomund.js`
- `scripts/sorts/magicien-comprehension-des-langues.js`
- `scripts/sorts/magicien-cone-de-froid.js`
- `scripts/sorts/magicien-confusion.js`
- `scripts/sorts/magicien-contact-d-autres-plans.js`
- `scripts/sorts/magicien-controle-du-climat.js`
- `scripts/sorts/magicien-corde-enchantee.js`
- `scripts/sorts/magicien-cristairain.js`
- `scripts/sorts/magicien-croissance-animale.js`
- `scripts/sorts/magicien-danse-irresistible-d-otto.js`
- `scripts/sorts/magicien-debilite-mentale.js`
- `scripts/sorts/magicien-desenvoutement.js`
- `scripts/sorts/magicien-desintegration.js`
- `scripts/sorts/magicien-detection-de-l-invisibilite.js`
- `scripts/sorts/magicien-detection-de-la-magie.js`
- `scripts/sorts/magicien-detection-du-mal.js`
- `scripts/sorts/magicien-disparition.js`
- `scripts/sorts/magicien-disque-flottant-de-tenser.js`
- `scripts/sorts/magicien-dissipation-de-la-magie.js`
- `scripts/sorts/magicien-distorsion-des-distances.js`
- `scripts/sorts/magicien-duo-dimension.js`
- `scripts/sorts/magicien-e-s-p.js`
- `scripts/sorts/magicien-eau-aeree.js`
- `scripts/sorts/magicien-ecriture.js`
- `scripts/sorts/magicien-effacement.js`
- `scripts/sorts/magicien-effroi.js`
- `scripts/sorts/magicien-embroussaillement.js`
- `scripts/sorts/magicien-emprisonnement-de-l-ame.js`
- `scripts/sorts/magicien-emprisonnement.js`
- `scripts/sorts/magicien-enchantement.js`
- `scripts/sorts/magicien-epee-de-mordenkainen.js`
- `scripts/sorts/magicien-escalade-d-araignee.js`
- `scripts/sorts/magicien-excavation.js`
- `scripts/sorts/magicien-extension-i.js`
- `scripts/sorts/magicien-extension-ii.js`
- `scripts/sorts/magicien-extension-iii.js`
- `scripts/sorts/magicien-fermeture.js`
- `scripts/sorts/magicien-feu-charmeur.js`
- `scripts/sorts/magicien-fleche-de-feu.js`
- `scripts/sorts/magicien-force-fantasmagorique.js`
- `scripts/sorts/magicien-force.js`
- `scripts/sorts/magicien-foudre.js`
- `scripts/sorts/magicien-fracassement.js`
- `scripts/sorts/magicien-glissement-de-terrain.js`
- `scripts/sorts/magicien-globe-d-invulnerabilite.js`
- `scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js`
- `scripts/sorts/magicien-heteromorphisme.js`
- `scripts/sorts/magicien-holographie.js`
- `scripts/sorts/magicien-identification.js`
- `scripts/sorts/magicien-il-magique.js`
- `scripts/sorts/magicien-image-miroir.js`
- `scripts/sorts/magicien-immunite-magique-de-serten.js`
- `scripts/sorts/magicien-incantation-mortelle.js`
- `scripts/sorts/magicien-infravision.js`
- `scripts/sorts/magicien-intermittence.js`
- `scripts/sorts/magicien-inversion-de-la-gravite.js`
- `scripts/sorts/magicien-invisibilite-de-masse.js`
- `scripts/sorts/magicien-invisibilite-sur-3-m.js`
- `scripts/sorts/magicien-invisibilite.js`
- `scripts/sorts/magicien-invocation-d-elemental.js`
- `scripts/sorts/magicien-invocation-d-un-familier.js`
- `scripts/sorts/magicien-invocation-de-monstre-ii.js`
- `scripts/sorts/magicien-invocation-de-monstre-iii.js`
- `scripts/sorts/magicien-invocation-de-monstre-iv.js`
- `scripts/sorts/magicien-invocation-de-monstre-v.js`
- `scripts/sorts/magicien-invocation-de-monstre-vi.js`
- `scripts/sorts/magicien-invocation-de-monstre-vii.js`
- `scripts/sorts/magicien-invocation-de-monstres-i.js`
- `scripts/sorts/magicien-invocation-instantanee-de-drawmij.js`
- `scripts/sorts/magicien-labyrinthe.js`
- `scripts/sorts/magicien-langues.js`
- `scripts/sorts/magicien-lecture-de-la-magie.js`
- `scripts/sorts/magicien-levitation.js`
- `scripts/sorts/magicien-lithomorphose.js`
- `scripts/sorts/magicien-localisation-d-objets.js`
- `scripts/sorts/magicien-lumiere-eternelle.js`
- `scripts/sorts/magicien-lumiere.js`
- `scripts/sorts/magicien-lumieres-dansantes.js`
- `scripts/sorts/magicien-main-broyante-de-bigby.js`
- `scripts/sorts/magicien-main-d-interposition-de-bigby.js`
- `scripts/sorts/magicien-main-de-force-de-bigby.js`
- `scripts/sorts/magicien-mains-brulantes.js`
- `scripts/sorts/magicien-maladresse.js`
- `scripts/sorts/magicien-message.js`
- `scripts/sorts/magicien-metempsycose.js`
- `scripts/sorts/magicien-mot-de-pouvoir-cecite.js`
- `scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js`
- `scripts/sorts/magicien-mot-de-pouvoir-mort.js`
- `scripts/sorts/magicien-moyen-mnemonique-de-rary.js`
- `scripts/sorts/magicien-mur-de-fer.js`
- `scripts/sorts/magicien-mur-de-feu.js`
- `scripts/sorts/magicien-mur-de-force.js`
- `scripts/sorts/magicien-mur-de-glace.js`
- `scripts/sorts/magicien-mur-de-roc.js`
- `scripts/sorts/magicien-mythomancie.js`
- `scripts/sorts/magicien-necro-animation.js`
- `scripts/sorts/magicien-nuage-incendiaire.js`
- `scripts/sorts/magicien-nuage-letal.js`
- `scripts/sorts/magicien-nuage-puant.js`
- `scripts/sorts/magicien-nuee-de-meteores.js`
- `scripts/sorts/magicien-or-des-fous.js`
- `scripts/sorts/magicien-oubli.js`
- `scripts/sorts/magicien-ouverture.js`
- `scripts/sorts/magicien-paralysie-des-monstres.js`
- `scripts/sorts/magicien-paralysie.js`
- `scripts/sorts/magicien-passe-muraille.js`
- `scripts/sorts/magicien-permanence.js`
- `scripts/sorts/magicien-peur.js`
- `scripts/sorts/magicien-phytomorphose.js`
- `scripts/sorts/magicien-piege-a-feu.js`
- `scripts/sorts/magicien-piege-de-leomund.js`
- `scripts/sorts/magicien-poigne-de-bigby.js`
- `scripts/sorts/magicien-poigne-electrique.js`
- `scripts/sorts/magicien-poing-de-bigby.js`
- `scripts/sorts/magicien-porte-de-phase.js`
- `scripts/sorts/magicien-porte-dimensionnelle.js`
- `scripts/sorts/magicien-poussee.js`
- `scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js`
- `scripts/sorts/magicien-protection-contre-le-mal.js`
- `scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js`
- `scripts/sorts/magicien-protection-d-esprit.js`
- `scripts/sorts/magicien-punition-spirituelle.js`
- `scripts/sorts/magicien-pyrotechnie.js`
- `scripts/sorts/magicien-quete-magique.js`
- `scripts/sorts/magicien-rafale-de-vent.js`
- `scripts/sorts/magicien-ralentissement.js`
- `scripts/sorts/magicien-rapidite.js`
- `scripts/sorts/magicien-rayon-d-affaiblissement.js`
- `scripts/sorts/magicien-reincarnation.js`
- `scripts/sorts/magicien-reparation.js`
- `scripts/sorts/magicien-repulsion.js`
- `scripts/sorts/magicien-respiration-aquatique.js`
- `scripts/sorts/magicien-runes-explosives.js`
- `scripts/sorts/magicien-saut.js`
- `scripts/sorts/magicien-separation-des-eaux.js`
- `scripts/sorts/magicien-serviteur-invisible.js`
- `scripts/sorts/magicien-seuil.js`
- `scripts/sorts/magicien-simulacre.js`
- `scripts/sorts/magicien-sort-astral.js`
- `scripts/sorts/magicien-souhait-majeur.js`
- `scripts/sorts/magicien-souhait-mineur.js`
- `scripts/sorts/magicien-sphere-glaciale-d-otiluke.js`
- `scripts/sorts/magicien-sphere-prismatique.js`
- `scripts/sorts/magicien-stase-temporelle.js`
- `scripts/sorts/magicien-statue.js`
- `scripts/sorts/magicien-suggestion.js`
- `scripts/sorts/magicien-symbole.js`
- `scripts/sorts/magicien-telekinesie.js`
- `scripts/sorts/magicien-teleportation.js`
- `scripts/sorts/magicien-tempete-de-glace.js`
- `scripts/sorts/magicien-tenebres-sur-5-metres.js`
- `scripts/sorts/magicien-terrain-hallucinatoire.js`
- `scripts/sorts/magicien-toile-d-araignee.js`
- `scripts/sorts/magicien-transformation-d-objets.js`
- `scripts/sorts/magicien-transformation-de-tenser.js`
- `scripts/sorts/magicien-transmutation-de-pierre-en-boue.js`
- `scripts/sorts/magicien-transmutation-de-pierre-en-chair.js`
- `scripts/sorts/magicien-transvision.js`
- `scripts/sorts/magicien-ventriloquie.js`
- `scripts/sorts/magicien-verrou-magique.js`
- `scripts/sorts/magicien-vigiles-et-sentinelles.js`
- `scripts/sorts/magicien-vol.js`
- `scripts/sorts/mains_brulantes.js`
- `scripts/sorts/marche-des-vents.js`
- `scripts/sorts/marteau-spirituel.js`
- `scripts/sorts/messager.js`
- `scripts/sorts/metal-brulant.js`
- `scripts/sorts/missile_magique.js`
- `scripts/sorts/mort-simulee.js`
- `scripts/sorts/neutralisation-du-poison.js`
- `scripts/sorts/obscurcissement.js`
- `scripts/sorts/orientation.js`
- `scripts/sorts/parole-sacree-maudite.js`
- `scripts/sorts/passage-sans-traces.js`
- `scripts/sorts/peau-d-ecorce.js`
- `scripts/sorts/piege-de-feu.js`
- `scripts/sorts/pierre-magique.js`
- `scripts/sorts/pilier-de-feu.js`
- `scripts/sorts/porte-vegetale.js`
- `scripts/sorts/poussee.js`
- `scripts/sorts/priere.js`
- `scripts/sorts/production-de-feu.js`
- `scripts/sorts/production-de-flammes.js`
- `scripts/sorts/protection-contre-la-foudre.js`
- `scripts/sorts/protection-contre-le-mal-rayon-de-10-pieds.js`
- `scripts/sorts/protection-contre-le-mal.js`
- `scripts/sorts/protection-contre-le-plan-negatif.js`
- `scripts/sorts/purification-de-la-nourriture-et-de-la-boisson.js`
- `scripts/sorts/pyrotechnie.js`
- `scripts/sorts/quete-religieuse.js`
- `scripts/sorts/ralentissement-du-poison.js`
- `scripts/sorts/rappel-a-la-vie.js`
- `scripts/sorts/rappel.js`
- `scripts/sorts/regeneration.js`
- `scripts/sorts/repulsion-des-insectes.js`
- `scripts/sorts/resistance-au-feu-resistance-au-froid.js`
- `scripts/sorts/resistance-au-froid.js`
- `scripts/sorts/resistance.js`
- `scripts/sorts/respiration-aquatique.js`
- `scripts/sorts/restauration.js`
- `scripts/sorts/resurrection.js`
- `scripts/sorts/sanctuaire.js`
- `scripts/sorts/saut.js`
- `scripts/sorts/separation-des-eaux.js`
- `scripts/sorts/serviteur-aerien.js`
- `scripts/sorts/serviteur_invisible.js`
- `scripts/sorts/seuil.js`
- `scripts/sorts/silence-rayon-de-15-pieds.js`
- `scripts/sorts/soin-ultime.js`
- `scripts/sorts/soins-des-blessures-graves.js`
- `scripts/sorts/sommeil.js`
- `scripts/sorts/sort-astral.js`
- `scripts/sorts/symbole.js`
- `scripts/sorts/tenebres_5m.js`
- `scripts/sorts/traversee-des-flammes.js`
- `scripts/sorts/tremblement-de-terre.js`
- `scripts/sorts/vision-reelle.js`

## Sorts à traiter en priorité

| Sort | Classe | Niveau | Script retenu | Motifs | Stratégie | VFX requis |
|---|---|---:|---|---|---|---|
| Agrandissement | Magicien | 1 | `scripts/sorts/magicien-agrandissement.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Amitié | Magicien | 1 | `scripts/sorts/magicien-amitie.js` | écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Amitié animale | Druide | 1 | `scripts/sorts/druide-amitie-animale.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Aura féérique | Druide | 1 | `scripts/sorts/druide-aura-feerique.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Aura magique de Nystul | Magicien | 1 | `scripts/sorts/magicien-aura-magique-de-nystul.js` | fallback legacy; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Bouclier | Magicien | 1 | `scripts/sorts/bouclier.js` | écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Bruitage | Illusionniste | 1 | `scripts/sorts/illusionniste-bruitage.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Changement d’apparence | Illusionniste | 1 | `scripts/sorts/illusionniste-changement-d-apparence.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Charme-personnes | Magicien | 1 | `scripts/sorts/charme_personne.js` | écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Chute de plume | Magicien | 1 | `scripts/sorts/magicien-chute-de-plume.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Compréhension des langues | Magicien | 1 | `scripts/sorts/magicien-comprehension-des-langues.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Détection de l’invisibilité | Illusionniste | 1 | `scripts/sorts/illusionniste-detection-de-l-invisibilite.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Détection de la magie | Druide | 1 | `scripts/sorts/druide-detection-de-la-magie.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Détection de la magie | Magicien | 1 | `scripts/sorts/detection-de-la-magie.js` | new Dialog; écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Détection des illusions | Illusionniste | 1 | `scripts/sorts/illusionniste-detection-des-illusions.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Détection des pièges sylvestres | Druide | 1 | `scripts/sorts/druide-detection-des-pieges-sylvestres.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Disque flottant de Tenser | Magicien | 1 | `scripts/sorts/magicien-disque-flottant-de-tenser.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Écriture | Magicien | 1 | `scripts/sorts/magicien-ecriture.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Effacement | Magicien | 1 | `scripts/sorts/magicien-effacement.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Escalade d’araignée | Magicien | 1 | `scripts/sorts/magicien-escalade-d-araignee.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Fermeture | Magicien | 1 | `scripts/sorts/magicien-fermeture.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Force fantasmagorique | Illusionniste | 1 | `scripts/sorts/illusionniste-force-fantasmagorique.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Hypnotisme | Illusionniste | 1 | `scripts/sorts/illusionniste-hypnotisme.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Identification | Magicien | 1 | `scripts/sorts/magicien-identification.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Invocation d’un familier | Magicien | 1 | `scripts/sorts/magicien-invocation-d-un-familier.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Jet de couleurs | Illusionniste | 1 | `scripts/sorts/illusionniste-jet-de-couleurs.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Langage animal | Druide | 1 | `scripts/sorts/druide-langage-animal.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Lecture de la magie | Magicien | 1 | `scripts/sorts/magicien-lecture-de-la-magie.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Localisation des animaux | Druide | 1 | `scripts/sorts/druide-localisation-des-animaux.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Lumières dansantes | Illusionniste | 1 | `scripts/sorts/lumiere.js` | écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Lumières dansantes | Magicien | 1 | `scripts/sorts/magicien-lumieres-dansantes.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Message | Magicien | 1 | `scripts/sorts/magicien-message.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Mur de brouillard | Illusionniste | 1 | `scripts/sorts/illusionniste-mur-de-brouillard.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Passage sans trace | Druide | 1 | `scripts/sorts/druide-passage-sans-trace.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Poussée | Magicien | 1 | `scripts/sorts/magicien-poussee.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Prévision du temps | Druide | 1 | `scripts/sorts/druide-prevision-du-temps.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Protection contre le mal | Magicien | 1 | `scripts/sorts/protection-contre-le-mal.js` | new Dialog; écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Purification de l'eau | Druide | 1 | `scripts/sorts/druide-purification-de-l-eau.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Réflexion des regards | Illusionniste | 1 | `scripts/sorts/illusionniste-reflexion-des-regards.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Réparation | Magicien | 1 | `scripts/sorts/magicien-reparation.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Saut | Magicien | 1 | `scripts/sorts/magicien-saut.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Serviteur invisible | Magicien | 1 | `scripts/sorts/magicien-serviteur-invisible.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Shillelagh | Druide | 1 | `scripts/sorts/druide-shillelagh.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Sommeil | Magicien | 1 | `scripts/sorts/sommeil.js` | écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Ténèbres | Illusionniste | 1 | `scripts/sorts/illusionniste-tenebres.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Augure | Clerc | 2 | `scripts/sorts/augure.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Bouche magique | Illusionniste | 2 | `scripts/sorts/illusionniste-bouche-magique.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Bruitage | Magicien | 2 | `scripts/sorts/bruitage.js` | écriture risquée;  | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Cantique | Clerc | 2 | `scripts/sorts/cantique.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Catalepsie | Druide | 2 | `scripts/sorts/druide-catalepsie.js` | new Dialog; écriture risquée; VFX absent | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |

## Premier lot recommandé

**Clerc niveau 2 — 12 sorts.** Ce lot respecte la priorité demandée, reste limité et contrôlable, et dispose déjà de références complètes. Il permet de traiter en premier les scripts raccordés legacy ou incomplets, puis d’ajouter un VFX approprié sans toucher au lot Clerc niveau 1 validé.

| Sort | Script | Existe | Stratégie | VFX requis |
|---|---|---|---|---|
| Augure | `scripts/sorts/augure.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Cantique | `scripts/sorts/cantique.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Charme-Serpents | `scripts/sorts/charme-serpents.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Détection des Charmes | `scripts/sorts/detection-des-charmes.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Détection des Pièges | `scripts/sorts/detection-des-pieges.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Langage animal | `scripts/sorts/langage-des-animaux.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Marteau Spirituel | `scripts/sorts/marteau-spirituel.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Perception des Alignements | `scripts/sorts/connaissance-des-alignements.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Résistance au feu | `scripts/sorts/resistance-au-feu-resistance-au-froid.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Retardement du Poison | `scripts/sorts/ralentissement-du-poison.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Silence sur 5 mètres | `scripts/sorts/silence-rayon-de-15-pieds.js` | oui | corriger | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |
| Paralysie | `scripts/sorts/paralysie.js` | oui | effet_visuel_seul_plus_message_mj | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' |

## Proposition de lots de travail

Lots limités à **15 sorts maximum**, suivant la priorité demandée.

1. **Clerc niveau 2** — 12 sorts ; 11 à corriger, 0 à créer.
2. **Clerc niveau 3** — 12 sorts ; 10 à corriger, 0 à créer.
3. **Clerc niveau 4** — 10 sorts ; 6 à corriger, 0 à créer.
4. **Clerc niveau 5** — 10 sorts ; 2 à corriger, 8 à créer.
5. **Clerc niveau 6** — 10 sorts ; 1 à corriger, 9 à créer.
6. **Clerc niveau 7** — 10 sorts ; 1 à corriger, 9 à créer.
7. **Magicien niveau 1 — partie 1** — 15 sorts ; 14 à corriger, 0 à créer.
8. **Magicien niveau 1 — partie 2** — 11 sorts ; 10 à corriger, 0 à créer.
9. **Magicien niveau 2 — partie 1** — 15 sorts ; 12 à corriger, 0 à créer.
10. **Magicien niveau 2 — partie 2** — 8 sorts ; 8 à corriger, 0 à créer.
11. **Magicien niveau 3 — partie 1** — 15 sorts ; 12 à corriger, 0 à créer.
12. **Magicien niveau 3 — partie 2** — 9 sorts ; 8 à corriger, 0 à créer.
13. **Magicien niveau 4 — partie 1** — 15 sorts ; 14 à corriger, 0 à créer.
14. **Magicien niveau 4 — partie 2** — 9 sorts ; 7 à corriger, 0 à créer.
15. **Magicien niveau 5 — partie 1** — 15 sorts ; 13 à corriger, 0 à créer.
16. **Magicien niveau 5 — partie 2** — 9 sorts ; 8 à corriger, 0 à créer.
17. **Magicien niveau 6 — partie 1** — 15 sorts ; 14 à corriger, 0 à créer.
18. **Magicien niveau 6 — partie 2** — 9 sorts ; 8 à corriger, 0 à créer.
19. **Magicien niveau 7 — partie 1** — 15 sorts ; 15 à corriger, 0 à créer.
20. **Magicien niveau 7 — partie 2** — 1 sorts ; 1 à corriger, 0 à créer.
21. **Magicien niveau 8 — partie 1** — 15 sorts ; 15 à corriger, 0 à créer.
22. **Magicien niveau 8 — partie 2** — 1 sorts ; 1 à corriger, 0 à créer.
23. **Magicien niveau 9** — 12 sorts ; 12 à corriger, 0 à créer.
24. **Druide niveau 1** — 12 sorts ; 10 à corriger, 0 à créer.
25. **Druide niveau 2** — 12 sorts ; 8 à corriger, 0 à créer.
26. **Druide niveau 3** — 12 sorts ; 9 à corriger, 0 à créer.
27. **Druide niveau 4** — 12 sorts ; 7 à corriger, 0 à créer.
28. **Druide niveau 5** — 10 sorts ; 7 à corriger, 0 à créer.
29. **Druide niveau 6** — 10 sorts ; 5 à corriger, 0 à créer.
30. **Druide niveau 7** — 10 sorts ; 7 à corriger, 0 à créer.
31. **Illusionniste niveau 1** — 11 sorts ; 11 à corriger, 0 à créer.
32. **Illusionniste niveau 2** — 12 sorts ; 11 à corriger, 0 à créer.
33. **Illusionniste niveau 3** — 12 sorts ; 8 à corriger, 0 à créer.
34. **Illusionniste niveau 4** — 8 sorts ; 7 à corriger, 0 à créer.
35. **Illusionniste niveau 5** — 8 sorts ; 7 à corriger, 0 à créer.
36. **Illusionniste niveau 6** — 8 sorts ; 8 à corriger, 0 à créer.
37. **Illusionniste niveau 7** — 6 sorts ; 6 à corriger, 0 à créer.

## Inventaire des 411 sorts

| Nom | ID | Classe | Niv. | system.onUse | system.onuse | system.on_use | Chemin retenu | Script | Matériel | ActiveEffect Item | Type probable | VFX requis | VFX détecté | Stratégie |
|---|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|
| Apaisement | `XQgdghDowrDCCQ1b` | Clerc | 1 | `systems/add2e/scripts/sorts/apaisement.js` | `systems/add2e/scripts/sorts/apaisement.js` | `systems/add2e/scripts/sorts/apaisement.js` | `scripts/sorts/apaisement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Aquagenèse | `NxItV2LPH4Cbl5I2` | Clerc | 1 | `systems/add2e/scripts/sorts/creation-d-eau.js` | `systems/add2e/scripts/sorts/creation-d-eau.js` | `systems/add2e/scripts/sorts/creation-d-eau.js` | `scripts/sorts/creation-d-eau.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Bénédiction | `u1L6JpAXZ113qpVG` | Clerc | 1 | `systems/add2e/scripts/sorts/benediction.js` | `systems/add2e/scripts/sorts/benediction.js` | `systems/add2e/scripts/sorts/benediction.js` | `scripts/sorts/benediction.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Détection de la magie | `Sxt9iofe7` | Clerc | 1 | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `scripts/sorts/detection-de-la-magie.js` | oui | non | non | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Détection du mal | `yAqsU5sPfwAfnzKI` | Clerc | 1 | `systems/add2e/scripts/sorts/detection-du-mal.js` | `systems/add2e/scripts/sorts/detection-du-mal.js` | `systems/add2e/scripts/sorts/detection-du-mal.js` | `scripts/sorts/detection-du-mal.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Injonction | `3U2YJApOJHhpPi36` | Clerc | 1 | `systems/add2e/scripts/sorts/injonction.js` | `systems/add2e/scripts/sorts/injonction.js` | `systems/add2e/scripts/sorts/injonction.js` | `scripts/sorts/injonction.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Lumière | `Sdlz5sn18` | Clerc | 1 | `systems/add2e/scripts/sorts/lumiere.js` | `systems/add2e/scripts/sorts/lumiere.js` | `systems/add2e/scripts/sorts/lumiere.js` | `scripts/sorts/lumiere.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Protection contre le Mal | `TqhVMP92bVsGe1Ze` | Clerc | 1 | `systems/add2e/scripts/sorts/protection-contre-le-mal.js` | `systems/add2e/scripts/sorts/protection-contre-le-mal.js` | `systems/add2e/scripts/sorts/protection-contre-le-mal.js` | `scripts/sorts/protection-contre-le-mal.js` | oui | non | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Purification de l'eau et des aliments | `Smrpqu7x2` | Clerc | 1 | `systems/add2e/scripts/sorts/purification-de-leau-et-des-aliments.js` | `systems/add2e/scripts/sorts/purification-de-leau-et-des-aliments.js` | `systems/add2e/scripts/sorts/purification-de-leau-et-des-aliments.js` | `scripts/sorts/purification-de-leau-et-des-aliments.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | conserver |
| Résistance au Froid | `2eIiTt870xCg5cX2` | Clerc | 1 | `systems/add2e/scripts/sorts/resistance-au-froid.js` | `systems/add2e/scripts/sorts/resistance-au-froid.js` | `systems/add2e/scripts/sorts/resistance-au-froid.js` | `scripts/sorts/resistance-au-froid.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | conserver |
| Sanctuaire | `vKWHLf1xrjZNtMdr` | Clerc | 1 | `systems/add2e/scripts/sorts/sanctuaire.js` | `systems/add2e/scripts/sorts/sanctuaire.js` | `systems/add2e/scripts/sorts/sanctuaire.js` | `scripts/sorts/sanctuaire.js` | oui | oui | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Soins mineurs | `Sxchr11u6` | Clerc | 1 | `systems/add2e/scripts/sorts/soins-mineurs.js` | `systems/add2e/scripts/sorts/soins-mineurs.js` | `systems/add2e/scripts/sorts/soins-mineurs.js` | `scripts/sorts/soins-mineurs.js` | oui | non | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Augure | `Rs2UXeoGOPw95lTa` | Clerc | 2 | `systems/add2e/scripts/sorts/augure.js` | `systems/add2e/scripts/sorts/augure.js` | `systems/add2e/scripts/sorts/augure.js` | `scripts/sorts/augure.js` | oui | oui | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Cantique | `wdtkfJYwuk9dsqR1` | Clerc | 2 | `systems/add2e/scripts/sorts/cantique.js` | `systems/add2e/scripts/sorts/cantique.js` | `systems/add2e/scripts/sorts/cantique.js` | `scripts/sorts/cantique.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Charme-Serpents | `tp59YPoHeXjNe6Ym` | Clerc | 2 | `systems/add2e/scripts/sorts/charme-serpents.js` | `systems/add2e/scripts/sorts/charme-serpents.js` | `systems/add2e/scripts/sorts/charme-serpents.js` | `scripts/sorts/charme-serpents.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection des Charmes | `QIQwPiiJp7G4g4g7` | Clerc | 2 | `systems/add2e/scripts/sorts/detection-des-charmes.js` | `systems/add2e/scripts/sorts/detection-des-charmes.js` | `systems/add2e/scripts/sorts/detection-des-charmes.js` | `scripts/sorts/detection-des-charmes.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection des Pièges | `Wy1dn4BiE0hw8Llu` | Clerc | 2 | `systems/add2e/scripts/sorts/detection-des-pieges.js` | `systems/add2e/scripts/sorts/detection-des-pieges.js` | `systems/add2e/scripts/sorts/detection-des-pieges.js` | `scripts/sorts/detection-des-pieges.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Langage animal | `vhPECKdSgNgk4KaP` | Clerc | 2 | `systems/add2e/scripts/sorts/langage-des-animaux.js` | `systems/add2e/scripts/sorts/langage-des-animaux.js` | `systems/add2e/scripts/sorts/langage-des-animaux.js` | `scripts/sorts/langage-des-animaux.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Marteau Spirituel | `6izVz4iVr2hKNNRQ` | Clerc | 2 | `systems/add2e/scripts/sorts/marteau-spirituel.js` | `systems/add2e/scripts/sorts/marteau-spirituel.js` | `systems/add2e/scripts/sorts/marteau-spirituel.js` | `scripts/sorts/marteau-spirituel.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Paralysie | `Syawg1fas` | Clerc | 2 | `systems/add2e/scripts/sorts/paralysie.js` | `systems/add2e/scripts/sorts/paralysie.js` | `systems/add2e/scripts/sorts/paralysie.js` | `scripts/sorts/paralysie.js` | oui | oui | non | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Perception des Alignements | `hZHuARHUGpOY5PvR` | Clerc | 2 | `systems/add2e/scripts/sorts/connaissance-des-alignements.js` | `systems/add2e/scripts/sorts/connaissance-des-alignements.js` | `systems/add2e/scripts/sorts/connaissance-des-alignements.js` | `scripts/sorts/connaissance-des-alignements.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Résistance au feu | `7zHxP5ZI6iLBpdla` | Clerc | 2 | `systems/add2e/scripts/sorts/resistance-au-feu-resistance-au-froid.js` | `systems/add2e/scripts/sorts/resistance-au-feu-resistance-au-froid.js` | `systems/add2e/scripts/sorts/resistance-au-feu-resistance-au-froid.js` | `scripts/sorts/resistance-au-feu-resistance-au-froid.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Retardement du Poison | `Z6nSdRcOjfcEapru` | Clerc | 2 | `systems/add2e/scripts/sorts/ralentissement-du-poison.js` | `systems/add2e/scripts/sorts/ralentissement-du-poison.js` | `systems/add2e/scripts/sorts/ralentissement-du-poison.js` | `scripts/sorts/ralentissement-du-poison.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Silence sur 5 mètres | `NYOXmMomYixpF5pS` | Clerc | 2 | `systems/add2e/scripts/sorts/silence-rayon-de-15-pieds.js` | `systems/add2e/scripts/sorts/silence-rayon-de-15-pieds.js` | `systems/add2e/scripts/sorts/silence-rayon-de-15-pieds.js` | `scripts/sorts/silence-rayon-de-15-pieds.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Catalepsie | `Sa3zkx6mz` | Clerc | 3 | `systems/add2e/scripts/sorts/catalepsie.js` | `systems/add2e/scripts/sorts/catalepsie.js` | `systems/add2e/scripts/sorts/catalepsie.js` | `scripts/sorts/catalepsie.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Désenvoûtement | `D4M1z3FJEUq8qUZN` | Clerc | 3 | `systems/add2e/scripts/sorts/delivrance-de-la-malediction.js` | `systems/add2e/scripts/sorts/delivrance-de-la-malediction.js` | `systems/add2e/scripts/sorts/delivrance-de-la-malediction.js` | `scripts/sorts/delivrance-de-la-malediction.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Dissipation de la Magie | `XEcAG3l135UrSgp1` | Clerc | 3 | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `scripts/sorts/dissipation-de-la-magie.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Glyphe de Garde | `upRGuCu26UmMcTaN` | Clerc | 3 | `systems/add2e/scripts/sorts/glyphe-de-garde.js` | `systems/add2e/scripts/sorts/glyphe-de-garde.js` | `systems/add2e/scripts/sorts/glyphe-de-garde.js` | `scripts/sorts/glyphe-de-garde.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Guérison de la Cécité | `WS0WlZcSPXN3BzVj` | Clerc | 3 | `systems/add2e/scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js` | `systems/add2e/scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js` | `systems/add2e/scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js` | `scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js` | oui | non | oui | soin | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Guérison des Maladies | `YCzH60fklmXZm4NG` | Clerc | 3 | `systems/add2e/scripts/sorts/guerison-des-maladies.js` | `systems/add2e/scripts/sorts/guerison-des-maladies.js` | `systems/add2e/scripts/sorts/guerison-des-maladies.js` | `scripts/sorts/guerison-des-maladies.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Localisation d'objets | `Sj06p4tw4` | Clerc | 3 | `systems/add2e/scripts/sorts/localisation-dobjets.js` | `systems/add2e/scripts/sorts/localisation-dobjets.js` | `systems/add2e/scripts/sorts/localisation-dobjets.js` | `scripts/sorts/localisation-dobjets.js` | oui | oui | non | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Lumière éternelle | `MOvZkfwTwOmPaoo6` | Clerc | 3 | `systems/add2e/scripts/sorts/lumiere-continuelle.js` | `systems/add2e/scripts/sorts/lumiere-continuelle.js` | `systems/add2e/scripts/sorts/lumiere-continuelle.js` | `scripts/sorts/lumiere-continuelle.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Manne | `mKVH2qdZQt1lTD7R` | Clerc | 3 | `systems/add2e/scripts/sorts/creation-de-nourriture-et-d-eau.js` | `systems/add2e/scripts/sorts/creation-de-nourriture-et-d-eau.js` | `systems/add2e/scripts/sorts/creation-de-nourriture-et-d-eau.js` | `scripts/sorts/creation-de-nourriture-et-d-eau.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Nécro animation | `J03xF2w0p1eUArSJ` | Clerc | 3 | `systems/add2e/scripts/sorts/animation-des-morts.js` | `systems/add2e/scripts/sorts/animation-des-morts.js` | `systems/add2e/scripts/sorts/animation-des-morts.js` | `scripts/sorts/animation-des-morts.js` | oui | oui | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Nécromancie | `Q2bKJDwPnQ49figr` | Clerc | 3 | `systems/add2e/scripts/sorts/communication-avec-les-morts.js` | `systems/add2e/scripts/sorts/communication-avec-les-morts.js` | `systems/add2e/scripts/sorts/communication-avec-les-morts.js` | `scripts/sorts/communication-avec-les-morts.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Prière | `OY8n4w7N4Vw06Gz0` | Clerc | 3 | `systems/add2e/scripts/sorts/priere.js` | `systems/add2e/scripts/sorts/priere.js` | `systems/add2e/scripts/sorts/priere.js` | `scripts/sorts/priere.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Abaissement des Eaux | `2u7CQtfpQUqiKKMi` | Clerc | 4 | `systems/add2e/scripts/sorts/abaissement-des-eaux.js` | `systems/add2e/scripts/sorts/abaissement-des-eaux.js` | `systems/add2e/scripts/sorts/abaissement-des-eaux.js` | `scripts/sorts/abaissement-des-eaux.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bâtons à serpents | `S30nizlne` | Clerc | 4 | `systems/add2e/scripts/sorts/batons-a-serpents.js` | `systems/add2e/scripts/sorts/batons-a-serpents.js` | `systems/add2e/scripts/sorts/batons-a-serpents.js` | `scripts/sorts/batons-a-serpents.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Contre-poison | `Sjiuuls8d` | Clerc | 4 | `systems/add2e/scripts/sorts/contre-poison.js` | `systems/add2e/scripts/sorts/contre-poison.js` | `systems/add2e/scripts/sorts/contre-poison.js` | `scripts/sorts/contre-poison.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Détection des Mensonges | `dgAqjED194Zh2Fsx` | Clerc | 4 | `systems/add2e/scripts/sorts/detection-des-mensonges.js` | `systems/add2e/scripts/sorts/detection-des-mensonges.js` | `systems/add2e/scripts/sorts/detection-des-mensonges.js` | `scripts/sorts/detection-des-mensonges.js` | oui | oui | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Divination | `Ioq0hTYTNqY25yTp` | Clerc | 4 | `systems/add2e/scripts/sorts/divination.js` | `systems/add2e/scripts/sorts/divination.js` | `systems/add2e/scripts/sorts/divination.js` | `scripts/sorts/divination.js` | oui | oui | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Exorcisme | `VzYlAqxdcGsXjLUx` | Clerc | 4 | `systems/add2e/scripts/sorts/exorcisme.js` | `systems/add2e/scripts/sorts/exorcisme.js` | `systems/add2e/scripts/sorts/exorcisme.js` | `scripts/sorts/exorcisme.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Langage des Plantes | `NB7cY2JkIVWpAJxi` | Clerc | 4 | `systems/add2e/scripts/sorts/langage-des-plantes.js` | `systems/add2e/scripts/sorts/langage-des-plantes.js` | `systems/add2e/scripts/sorts/langage-des-plantes.js` | `scripts/sorts/langage-des-plantes.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Langue | `Sa1v4ptqy` | Clerc | 4 | `systems/add2e/scripts/sorts/langue.js` | `systems/add2e/scripts/sorts/langue.js` | `systems/add2e/scripts/sorts/langue.js` | `scripts/sorts/langue.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Protection contre le mal sur 3 m | `Stbgz8i1o` | Clerc | 4 | `systems/add2e/scripts/sorts/protection-contre-le-mal-sur-3-m.js` | `systems/add2e/scripts/sorts/protection-contre-le-mal-sur-3-m.js` | `systems/add2e/scripts/sorts/protection-contre-le-mal-sur-3-m.js` | `scripts/sorts/protection-contre-le-mal-sur-3-m.js` | oui | non | non | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Soins Majeurs | `BC3xSS1IBBosglWX` | Clerc | 4 | `systems/add2e/scripts/sorts/soins-des-blessures-graves.js` | `systems/add2e/scripts/sorts/soins-des-blessures-graves.js` | `systems/add2e/scripts/sorts/soins-des-blessures-graves.js` | `scripts/sorts/soins-des-blessures-graves.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Changement de Plan | `ArNVRD6NMCcfJVO8` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/changement-de-plan.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/changement-de-plan.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/changement-de-plan.js` | `scripts/sorts/clerc-niveaux-5-6-7/changement-de-plan.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Communion | `f0xvzPjR5eql4RnX` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/communion.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/communion.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/communion.js` | `scripts/sorts/clerc-niveaux-5-6-7/communion.js` | non | oui | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Dissipation du Mal | `8xjaHEHQJH38zT5v` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/dissipation-du-mal.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/dissipation-du-mal.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/dissipation-du-mal.js` | `scripts/sorts/clerc-niveaux-5-6-7/dissipation-du-mal.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Expiation | `a0RDLD25YSALcpQ3` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/penitence.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/penitence.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/penitence.js` | `scripts/sorts/clerc-niveaux-5-6-7/penitence.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Fléau d’Insectes | `agSJJopB3wVJ7JnL` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/fleau-d-insectes.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/fleau-d-insectes.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/fleau-d-insectes.js` | `scripts/sorts/clerc-niveaux-5-6-7/fleau-d-insectes.js` | non | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Pilier de Feu | `JIVPA8sAdvSA48F3` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/colonne-de-feu.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/colonne-de-feu.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/colonne-de-feu.js` | `scripts/sorts/clerc-niveaux-5-6-7/colonne-de-feu.js` | non | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Quête Religieuse | `LEjrYHsqdLZt9u9z` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/quete-religieuse.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/quete-religieuse.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/quete-religieuse.js` | `scripts/sorts/clerc-niveaux-5-6-7/quete-religieuse.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Rappel à la Vie | `BDlrjtmEtCW6VeM3` | Clerc | 5 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/rappel-a-la-vie.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/rappel-a-la-vie.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/rappel-a-la-vie.js` | `scripts/sorts/clerc-niveaux-5-6-7/rappel-a-la-vie.js` | non | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Soin ultime | `Sq1tl2rnm` | Clerc | 5 | `systems/add2e/scripts/sorts/soin-ultime.js` | `systems/add2e/scripts/sorts/soin-ultime.js` | `systems/add2e/scripts/sorts/soin-ultime.js` | `scripts/sorts/soin-ultime.js` | oui | non | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Vision réelle | `Sg8vv5wrq` | Clerc | 5 | `systems/add2e/scripts/sorts/vision-reelle.js` | `systems/add2e/scripts/sorts/vision-reelle.js` | `systems/add2e/scripts/sorts/vision-reelle.js` | `scripts/sorts/vision-reelle.js` | oui | oui | non | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Animation des objets | `YhKHovBxDFPT3zjD` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/animation-d-un-objet.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/animation-d-un-objet.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/animation-d-un-objet.js` | `scripts/sorts/clerc-niveaux-5-6-7/animation-d-un-objet.js` | non | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Barrière de Lames | `NfojDpSSWss8K7ox` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/barriere-de-lames.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/barriere-de-lames.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/barriere-de-lames.js` | `scripts/sorts/clerc-niveaux-5-6-7/barriere-de-lames.js` | non | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Guérison | `oSfALhtUqR6esjsF` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/guerison.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/guerison.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/guerison.js` | `scripts/sorts/clerc-niveaux-5-6-7/guerison.js` | non | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Invocation des animaux | `Sh66nk11o` | Clerc | 6 | `systems/add2e/scripts/sorts/invocation-des-animaux.js` | `systems/add2e/scripts/sorts/invocation-des-animaux.js` | `systems/add2e/scripts/sorts/invocation-des-animaux.js` | `scripts/sorts/invocation-des-animaux.js` | oui | non | non | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Langage des Monstres | `E3sn9oDE2jRcng5n` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/langage-des-monstres.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/langage-des-monstres.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/langage-des-monstres.js` | `scripts/sorts/clerc-niveaux-5-6-7/langage-des-monstres.js` | non | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Lithomancie | `zZvMkZh0eT9iXbOV` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/pierres-parlantes.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/pierres-parlantes.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/pierres-parlantes.js` | `scripts/sorts/clerc-niveaux-5-6-7/pierres-parlantes.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Orientation | `lTY0W2UcSICDXAIu` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/orientation.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/orientation.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/orientation.js` | `scripts/sorts/clerc-niveaux-5-6-7/orientation.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Rappel | `ojEuPap5qVulUg4p` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/mot-de-rappel.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/mot-de-rappel.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/mot-de-rappel.js` | `scripts/sorts/clerc-niveaux-5-6-7/mot-de-rappel.js` | non | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Séparation des Eaux | `Ao2pXwVBoC7v1AcZ` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/separation-des-eaux.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/separation-des-eaux.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/separation-des-eaux.js` | `scripts/sorts/clerc-niveaux-5-6-7/separation-des-eaux.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Serviteur Aérien | `vq8X8DO5iO7LIWJx` | Clerc | 6 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/serviteur-aerien.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/serviteur-aerien.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/serviteur-aerien.js` | `scripts/sorts/clerc-niveaux-5-6-7/serviteur-aerien.js` | non | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Contrôle du Climat | `PSUPfcabfhbrxWG1` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/controle-du-climat.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/controle-du-climat.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/controle-du-climat.js` | `scripts/sorts/clerc-niveaux-5-6-7/controle-du-climat.js` | non | oui | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Marche des vents | `0vew4Dsadk48WK8X` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/marche-sur-le-vent.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/marche-sur-le-vent.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/marche-sur-le-vent.js` | `scripts/sorts/clerc-niveaux-5-6-7/marche-sur-le-vent.js` | non | oui | oui | déplacement | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Parole sacrée/maudite | `faa1xkvCpaxj8mzy` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/parole-sacree.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/parole-sacree.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/parole-sacree.js` | `scripts/sorts/clerc-niveaux-5-6-7/parole-sacree.js` | non | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Régénération | `wTY2BA9kkcAc3IJu` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/regeneration.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/regeneration.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/regeneration.js` | `scripts/sorts/clerc-niveaux-5-6-7/regeneration.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Restauration | `KV9j89SM2tko3iDL` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/restauration.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/restauration.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/restauration.js` | `scripts/sorts/clerc-niveaux-5-6-7/restauration.js` | non | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Résurrection | `x3fOxKCADgNdvfyU` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/resurrection.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/resurrection.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/resurrection.js` | `scripts/sorts/clerc-niveaux-5-6-7/resurrection.js` | non | oui | oui | soin | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Seuil | `Shi1vnnug` | Clerc | 7 | `systems/add2e/scripts/sorts/seuil.js` | `systems/add2e/scripts/sorts/seuil.js` | `systems/add2e/scripts/sorts/seuil.js` | `scripts/sorts/seuil.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Sort Astral | `4Aaby7ywbSbUbzLG` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/sort-astral.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/sort-astral.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/sort-astral.js` | `scripts/sorts/clerc-niveaux-5-6-7/sort-astral.js` | non | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Symbole | `edocrNiNW6x6TWX1` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/symbole.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/symbole.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/symbole.js` | `scripts/sorts/clerc-niveaux-5-6-7/symbole.js` | non | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Tremblement de Terre | `ruWwPBZl56IRcqt2` | Clerc | 7 | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/tremblement-de-terre.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/tremblement-de-terre.js` | `systems/add2e/scripts/sorts/clerc-niveaux-5-6-7/tremblement-de-terre.js` | `scripts/sorts/clerc-niveaux-5-6-7/tremblement-de-terre.js` | non | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | créer |
| Amitié animale | `ilgf9I5cZPQitFJy` | Druide | 1 | `systems/add2e/scripts/sorts/druide-amitie-animale.js` | `systems/add2e/scripts/sorts/druide-amitie-animale.js` | `systems/add2e/scripts/sorts/druide-amitie-animale.js` | `scripts/sorts/druide-amitie-animale.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Aura féérique | `FPCcOTwEZM4FB4AG` | Druide | 1 | `systems/add2e/scripts/sorts/druide-aura-feerique.js` | `systems/add2e/scripts/sorts/druide-aura-feerique.js` | `systems/add2e/scripts/sorts/druide-aura-feerique.js` | `scripts/sorts/druide-aura-feerique.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection de la magie | `7rYWVSj9qG6J4CgE` | Druide | 1 | `systems/add2e/scripts/sorts/druide-detection-de-la-magie.js` | `systems/add2e/scripts/sorts/druide-detection-de-la-magie.js` | `systems/add2e/scripts/sorts/druide-detection-de-la-magie.js` | `scripts/sorts/druide-detection-de-la-magie.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection des pièges sylvestres | `gb1VJgkDBmpxHRqW` | Druide | 1 | `systems/add2e/scripts/sorts/druide-detection-des-pieges-sylvestres.js` | `systems/add2e/scripts/sorts/druide-detection-des-pieges-sylvestres.js` | `systems/add2e/scripts/sorts/druide-detection-des-pieges-sylvestres.js` | `scripts/sorts/druide-detection-des-pieges-sylvestres.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Enchevêtrement | `gchPPB6o9UcwOWO4` | Druide | 1 | `systems/add2e/scripts/sorts/druide-enchevetrement.js` | `systems/add2e/scripts/sorts/druide-enchevetrement.js` | `systems/add2e/scripts/sorts/druide-enchevetrement.js` | `scripts/sorts/druide-enchevetrement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Invisibilité aux animaux | `wGAk7UDQiD8culJ2` | Druide | 1 | `systems/add2e/scripts/sorts/druide-invisibilite-aux-animaux.js` | `systems/add2e/scripts/sorts/druide-invisibilite-aux-animaux.js` | `systems/add2e/scripts/sorts/druide-invisibilite-aux-animaux.js` | `scripts/sorts/druide-invisibilite-aux-animaux.js` | oui | oui | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Langage animal | `jtVmvY0cNNKzc8sw` | Druide | 1 | `systems/add2e/scripts/sorts/druide-langage-animal.js` | `systems/add2e/scripts/sorts/druide-langage-animal.js` | `systems/add2e/scripts/sorts/druide-langage-animal.js` | `scripts/sorts/druide-langage-animal.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Localisation des animaux | `AzUlTx8pPfOqZS2Q` | Druide | 1 | `systems/add2e/scripts/sorts/druide-localisation-des-animaux.js` | `systems/add2e/scripts/sorts/druide-localisation-des-animaux.js` | `systems/add2e/scripts/sorts/druide-localisation-des-animaux.js` | `scripts/sorts/druide-localisation-des-animaux.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Passage sans trace | `ny1kTEpQBJdwExzN` | Druide | 1 | `systems/add2e/scripts/sorts/druide-passage-sans-trace.js` | `systems/add2e/scripts/sorts/druide-passage-sans-trace.js` | `systems/add2e/scripts/sorts/druide-passage-sans-trace.js` | `scripts/sorts/druide-passage-sans-trace.js` | oui | oui | oui | déplacement | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Prévision du temps | `evIx4b26WpJLeXyT` | Druide | 1 | `systems/add2e/scripts/sorts/druide-prevision-du-temps.js` | `systems/add2e/scripts/sorts/druide-prevision-du-temps.js` | `systems/add2e/scripts/sorts/druide-prevision-du-temps.js` | `scripts/sorts/druide-prevision-du-temps.js` | oui | non | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Purification de l'eau | `qWQgy9OIassdDWDQ` | Druide | 1 | `systems/add2e/scripts/sorts/druide-purification-de-l-eau.js` | `systems/add2e/scripts/sorts/druide-purification-de-l-eau.js` | `systems/add2e/scripts/sorts/druide-purification-de-l-eau.js` | `scripts/sorts/druide-purification-de-l-eau.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Shillelagh | `XbRgfyOQelhZ1LvY` | Druide | 1 | `systems/add2e/scripts/sorts/druide-shillelagh.js` | `systems/add2e/scripts/sorts/druide-shillelagh.js` | `systems/add2e/scripts/sorts/druide-shillelagh.js` | `scripts/sorts/druide-shillelagh.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Aquagenèse | `Scjl76ai5` | Druide | 2 | `systems/add2e/scripts/sorts/aquagenese.js` | `systems/add2e/scripts/sorts/aquagenese.js` | `systems/add2e/scripts/sorts/aquagenese.js` | `scripts/sorts/aquagenese.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Catalepsie | `sRd64Nw20WZ1cSFk` | Druide | 2 | `systems/add2e/scripts/sorts/druide-catalepsie.js` | `systems/add2e/scripts/sorts/druide-catalepsie.js` | `systems/add2e/scripts/sorts/druide-catalepsie.js` | `scripts/sorts/druide-catalepsie.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Charme-personnes ou mammifères | `A5ByNdQ49OPXdHGs` | Druide | 2 | `systems/add2e/scripts/sorts/druide-charme-personnes-ou-mammiferes.js` | `systems/add2e/scripts/sorts/druide-charme-personnes-ou-mammiferes.js` | `systems/add2e/scripts/sorts/druide-charme-personnes-ou-mammiferes.js` | `scripts/sorts/druide-charme-personnes-ou-mammiferes.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Croc-en-jambe | `j5rfK0nQ9OfvVRP0` | Druide | 2 | `systems/add2e/scripts/sorts/druide-croc-en-jambe.js` | `systems/add2e/scripts/sorts/druide-croc-en-jambe.js` | `systems/add2e/scripts/sorts/druide-croc-en-jambe.js` | `scripts/sorts/druide-croc-en-jambe.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Distorsion du bois | `VGjbP8bf6jxpaH2r` | Druide | 2 | `systems/add2e/scripts/sorts/druide-distorsion-du-bois.js` | `systems/add2e/scripts/sorts/druide-distorsion-du-bois.js` | `systems/add2e/scripts/sorts/druide-distorsion-du-bois.js` | `scripts/sorts/druide-distorsion-du-bois.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Flamme | `bGozecWB2h2bzLHW` | Druide | 2 | `systems/add2e/scripts/sorts/druide-flamme.js` | `systems/add2e/scripts/sorts/druide-flamme.js` | `systems/add2e/scripts/sorts/druide-flamme.js` | `scripts/sorts/druide-flamme.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Localisation des plantes | `u9Y1HnfaWsDkiH2j` | Druide | 2 | `systems/add2e/scripts/sorts/druide-localisation-des-plantes.js` | `systems/add2e/scripts/sorts/druide-localisation-des-plantes.js` | `systems/add2e/scripts/sorts/druide-localisation-des-plantes.js` | `scripts/sorts/druide-localisation-des-plantes.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Métal brûlant | `N7TTlafX2FuoYgAD` | Druide | 2 | `systems/add2e/scripts/sorts/druide-metal-brulant.js` | `systems/add2e/scripts/sorts/druide-metal-brulant.js` | `systems/add2e/scripts/sorts/druide-metal-brulant.js` | `scripts/sorts/druide-metal-brulant.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Obscurcissement | `NU1wGTCbnOH6Oz1H` | Druide | 2 | `systems/add2e/scripts/sorts/druide-obscurcissement.js` | `systems/add2e/scripts/sorts/druide-obscurcissement.js` | `systems/add2e/scripts/sorts/druide-obscurcissement.js` | `scripts/sorts/druide-obscurcissement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Peau d'écorce | `RA3FoJdMhOl9lLSY` | Druide | 2 | `systems/add2e/scripts/sorts/druide-peau-d-ecorce.js` | `systems/add2e/scripts/sorts/druide-peau-d-ecorce.js` | `systems/add2e/scripts/sorts/druide-peau-d-ecorce.js` | `scripts/sorts/druide-peau-d-ecorce.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Piège à feu | `Slo4ivq91` | Druide | 2 | `systems/add2e/scripts/sorts/piege-a-feu.js` | `systems/add2e/scripts/sorts/piege-a-feu.js` | `systems/add2e/scripts/sorts/piege-a-feu.js` | `scripts/sorts/piege-a-feu.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Soins mineurs | `193bqqLSQr0HC1bm` | Druide | 2 | `systems/add2e/scripts/sorts/druide-soins-mineurs.js` | `systems/add2e/scripts/sorts/druide-soins-mineurs.js` | `systems/add2e/scripts/sorts/druide-soins-mineurs.js` | `scripts/sorts/druide-soins-mineurs.js` | oui | non | oui | soin | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Arbre | `gL6K13UI6GzIh3vR` | Druide | 3 | `systems/add2e/scripts/sorts/druide-arbre.js` | `systems/add2e/scripts/sorts/druide-arbre.js` | `systems/add2e/scripts/sorts/druide-arbre.js` | `scripts/sorts/druide-arbre.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Contre-poison | `cmqFxT1lil3aJ6eL` | Druide | 3 | `systems/add2e/scripts/sorts/druide-contre-poison.js` | `systems/add2e/scripts/sorts/druide-contre-poison.js` | `systems/add2e/scripts/sorts/druide-contre-poison.js` | `scripts/sorts/druide-contre-poison.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Embroussaillement | `Sbg9ej0jd` | Druide | 3 | `systems/add2e/scripts/sorts/embroussaillement.js` | `systems/add2e/scripts/sorts/embroussaillement.js` | `systems/add2e/scripts/sorts/embroussaillement.js` | `scripts/sorts/embroussaillement.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Guérison des maladies | `S1k5t1jju` | Druide | 3 | `systems/add2e/scripts/sorts/guerison-des-maladies.js` | `systems/add2e/scripts/sorts/guerison-des-maladies.js` | `systems/add2e/scripts/sorts/guerison-des-maladies.js` | `scripts/sorts/guerison-des-maladies.js` | oui | non | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Invocation d'insectes | `dnVcLvdXrySEeWge` | Druide | 3 | `systems/add2e/scripts/sorts/druide-invocation-d-insectes.js` | `systems/add2e/scripts/sorts/druide-invocation-d-insectes.js` | `systems/add2e/scripts/sorts/druide-invocation-d-insectes.js` | `scripts/sorts/druide-invocation-d-insectes.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invocation de la foudre | `lfkj1T7y8pa5ARG0` | Druide | 3 | `systems/add2e/scripts/sorts/druide-invocation-de-la-foudre.js` | `systems/add2e/scripts/sorts/druide-invocation-de-la-foudre.js` | `systems/add2e/scripts/sorts/druide-invocation-de-la-foudre.js` | `scripts/sorts/druide-invocation-de-la-foudre.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Lithomorphose | `qDrkAocsXPPoz6ym` | Druide | 3 | `systems/add2e/scripts/sorts/druide-lithomorphose.js` | `systems/add2e/scripts/sorts/druide-lithomorphose.js` | `systems/add2e/scripts/sorts/druide-lithomorphose.js` | `scripts/sorts/druide-lithomorphose.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Paralysie animale | `d5VYBbd8J6A0KZDW` | Druide | 3 | `systems/add2e/scripts/sorts/druide-paralysie-animale.js` | `systems/add2e/scripts/sorts/druide-paralysie-animale.js` | `systems/add2e/scripts/sorts/druide-paralysie-animale.js` | `scripts/sorts/druide-paralysie-animale.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Piège sylvestre | `ILCNplGHyXKdpH4I` | Druide | 3 | `systems/add2e/scripts/sorts/druide-piege-sylvestre.js` | `systems/add2e/scripts/sorts/druide-piege-sylvestre.js` | `systems/add2e/scripts/sorts/druide-piege-sylvestre.js` | `scripts/sorts/druide-piege-sylvestre.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Protection contre le feu | `vyq7ewIujEefLfx3` | Druide | 3 | `systems/add2e/scripts/sorts/druide-protection-contre-le-feu.js` | `systems/add2e/scripts/sorts/druide-protection-contre-le-feu.js` | `systems/add2e/scripts/sorts/druide-protection-contre-le-feu.js` | `scripts/sorts/druide-protection-contre-le-feu.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Pyrotechnie | `S03e9192t` | Druide | 3 | `systems/add2e/scripts/sorts/pyrotechnie.js` | `systems/add2e/scripts/sorts/pyrotechnie.js` | `systems/add2e/scripts/sorts/pyrotechnie.js` | `scripts/sorts/pyrotechnie.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Respiration aquatique | `Fm4984m1dcunpwiB` | Druide | 3 | `systems/add2e/scripts/sorts/druide-respiration-aquatique.js` | `systems/add2e/scripts/sorts/druide-respiration-aquatique.js` | `systems/add2e/scripts/sorts/druide-respiration-aquatique.js` | `scripts/sorts/druide-respiration-aquatique.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Contrôle de la température sur 3 m | `HVNQPx5qWs1cNFRT` | Druide | 4 | `systems/add2e/scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js` | `systems/add2e/scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js` | `systems/add2e/scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js` | `scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Dissipation de la magie | `S7hx702hb` | Druide | 4 | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `scripts/sorts/dissipation-de-la-magie.js` | oui | non | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Embrasement | `OMmnUrjpCVcCASNR` | Druide | 4 | `systems/add2e/scripts/sorts/druide-embrasement.js` | `systems/add2e/scripts/sorts/druide-embrasement.js` | `systems/add2e/scripts/sorts/druide-embrasement.js` | `scripts/sorts/druide-embrasement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Forêt hallucinatoire | `jOxhcQtvs1oUOpak` | Druide | 4 | `systems/add2e/scripts/sorts/druide-foret-hallucinatoire.js` | `systems/add2e/scripts/sorts/druide-foret-hallucinatoire.js` | `systems/add2e/scripts/sorts/druide-foret-hallucinatoire.js` | `scripts/sorts/druide-foret-hallucinatoire.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invocation animale I | `bQVB6rizjkXdUET0` | Druide | 4 | `systems/add2e/scripts/sorts/druide-invocation-animale-i.js` | `systems/add2e/scripts/sorts/druide-invocation-animale-i.js` | `systems/add2e/scripts/sorts/druide-invocation-animale-i.js` | `scripts/sorts/druide-invocation-animale-i.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invocation des créatures sylvestres | `TF3ui2XtaRyUwwRG` | Druide | 4 | `systems/add2e/scripts/sorts/druide-invocation-des-creatures-sylvestres.js` | `systems/add2e/scripts/sorts/druide-invocation-des-creatures-sylvestres.js` | `systems/add2e/scripts/sorts/druide-invocation-des-creatures-sylvestres.js` | `scripts/sorts/druide-invocation-des-creatures-sylvestres.js` | oui | oui | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Langage des plantes | `Sqd9hvks6` | Druide | 4 | `systems/add2e/scripts/sorts/langage-des-plantes.js` | `systems/add2e/scripts/sorts/langage-des-plantes.js` | `systems/add2e/scripts/sorts/langage-des-plantes.js` | `scripts/sorts/langage-des-plantes.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Paralysie végétale | `n0ScQmYB3qGB7V3g` | Druide | 4 | `systems/add2e/scripts/sorts/druide-paralysie-vegetale.js` | `systems/add2e/scripts/sorts/druide-paralysie-vegetale.js` | `systems/add2e/scripts/sorts/druide-paralysie-vegetale.js` | `scripts/sorts/druide-paralysie-vegetale.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Porte végétale | `VzcxE29VIVIX7Agf` | Druide | 4 | `systems/add2e/scripts/sorts/druide-porte-vegetale.js` | `systems/add2e/scripts/sorts/druide-porte-vegetale.js` | `systems/add2e/scripts/sorts/druide-porte-vegetale.js` | `scripts/sorts/druide-porte-vegetale.js` | oui | non | oui | déplacement | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Protection contre la foudre | `MgZcW1UgY4vOIats` | Druide | 4 | `systems/add2e/scripts/sorts/druide-protection-contre-la-foudre.js` | `systems/add2e/scripts/sorts/druide-protection-contre-la-foudre.js` | `systems/add2e/scripts/sorts/druide-protection-contre-la-foudre.js` | `scripts/sorts/druide-protection-contre-la-foudre.js` | oui | non | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Répulsion des insectes | `R8kqIcaXdLu1nUFh` | Druide | 4 | `systems/add2e/scripts/sorts/druide-repulsion-des-insectes.js` | `systems/add2e/scripts/sorts/druide-repulsion-des-insectes.js` | `systems/add2e/scripts/sorts/druide-repulsion-des-insectes.js` | `scripts/sorts/druide-repulsion-des-insectes.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Soins majeurs | `Sz67vrc8p` | Druide | 4 | `systems/add2e/scripts/sorts/soins-majeurs.js` | `systems/add2e/scripts/sorts/soins-majeurs.js` | `systems/add2e/scripts/sorts/soins-majeurs.js` | `scripts/sorts/soins-majeurs.js` | oui | oui | non | soin | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Bâtons à serpents | `tLb7xw1oUqTWIBSP` | Druide | 5 | `systems/add2e/scripts/sorts/druide-batons-a-serpents.js` | `systems/add2e/scripts/sorts/druide-batons-a-serpents.js` | `systems/add2e/scripts/sorts/druide-batons-a-serpents.js` | `scripts/sorts/druide-batons-a-serpents.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bouclier anti-plantes | `nBIJOOTA44bGxVyL` | Druide | 5 | `systems/add2e/scripts/sorts/druide-bouclier-anti-plantes.js` | `systems/add2e/scripts/sorts/druide-bouclier-anti-plantes.js` | `systems/add2e/scripts/sorts/druide-bouclier-anti-plantes.js` | `scripts/sorts/druide-bouclier-anti-plantes.js` | oui | non | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Communion avec la nature | `2mQgGKskOfdYgHLB` | Druide | 5 | `systems/add2e/scripts/sorts/druide-communion-avec-la-nature.js` | `systems/add2e/scripts/sorts/druide-communion-avec-la-nature.js` | `systems/add2e/scripts/sorts/druide-communion-avec-la-nature.js` | `scripts/sorts/druide-communion-avec-la-nature.js` | oui | non | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Contrôle des vents | `EtVots6HKBlcVdlr` | Druide | 5 | `systems/add2e/scripts/sorts/druide-controle-des-vents.js` | `systems/add2e/scripts/sorts/druide-controle-des-vents.js` | `systems/add2e/scripts/sorts/druide-controle-des-vents.js` | `scripts/sorts/druide-controle-des-vents.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Croissance animale | `S0gfyorie` | Druide | 5 | `systems/add2e/scripts/sorts/croissance-animale.js` | `systems/add2e/scripts/sorts/croissance-animale.js` | `systems/add2e/scripts/sorts/croissance-animale.js` | `scripts/sorts/croissance-animale.js` | oui | non | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Fléau d’insectes | `Sl13yrvj2` | Druide | 5 | `systems/add2e/scripts/sorts/fleau-dinsectes.js` | `systems/add2e/scripts/sorts/fleau-dinsectes.js` | `systems/add2e/scripts/sorts/fleau-dinsectes.js` | `scripts/sorts/fleau-dinsectes.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Invocation animale II | `ev1iqqbluPZsooao` | Druide | 5 | `systems/add2e/scripts/sorts/druide-invocation-animale-ii.js` | `systems/add2e/scripts/sorts/druide-invocation-animale-ii.js` | `systems/add2e/scripts/sorts/druide-invocation-animale-ii.js` | `scripts/sorts/druide-invocation-animale-ii.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Mur de feu | `ibRsKWkteFkyQdDO` | Druide | 5 | `systems/add2e/scripts/sorts/druide-mur-de-feu.js` | `systems/add2e/scripts/sorts/druide-mur-de-feu.js` | `systems/add2e/scripts/sorts/druide-mur-de-feu.js` | `scripts/sorts/druide-mur-de-feu.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Passe-plantes | `x5iMO3BUv9Ze8igE` | Druide | 5 | `systems/add2e/scripts/sorts/druide-passe-plantes.js` | `systems/add2e/scripts/sorts/druide-passe-plantes.js` | `systems/add2e/scripts/sorts/druide-passe-plantes.js` | `scripts/sorts/druide-passe-plantes.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Transmutation de pierre en boue | `UxlwIIKcYa8bf6AK` | Druide | 5 | `systems/add2e/scripts/sorts/druide-transmutation-de-pierre-en-boue.js` | `systems/add2e/scripts/sorts/druide-transmutation-de-pierre-en-boue.js` | `systems/add2e/scripts/sorts/druide-transmutation-de-pierre-en-boue.js` | `scripts/sorts/druide-transmutation-de-pierre-en-boue.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bouclier anti-animal | `YiZsypsA769c8dDS` | Druide | 6 | `systems/add2e/scripts/sorts/druide-bouclier-anti-animal.js` | `systems/add2e/scripts/sorts/druide-bouclier-anti-animal.js` | `systems/add2e/scripts/sorts/druide-bouclier-anti-animal.js` | `scripts/sorts/druide-bouclier-anti-animal.js` | oui | non | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Débilité mentale | `Sd2vcuep5` | Druide | 6 | `systems/add2e/scripts/sorts/debilite-mentale.js` | `systems/add2e/scripts/sorts/debilite-mentale.js` | `systems/add2e/scripts/sorts/debilite-mentale.js` | `scripts/sorts/debilite-mentale.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Graines de feu | `xVtsnh3iA6UMGbDy` | Druide | 6 | `systems/add2e/scripts/sorts/druide-graines-de-feu.js` | `systems/add2e/scripts/sorts/druide-graines-de-feu.js` | `systems/add2e/scripts/sorts/druide-graines-de-feu.js` | `scripts/sorts/druide-graines-de-feu.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invocation animale III | `nMNhqWS2kUnSRcTD` | Druide | 6 | `systems/add2e/scripts/sorts/druide-invocation-animale-iii.js` | `systems/add2e/scripts/sorts/druide-invocation-animale-iii.js` | `systems/add2e/scripts/sorts/druide-invocation-animale-iii.js` | `scripts/sorts/druide-invocation-animale-iii.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invocation d'un élémental du feu | `jxGkK0Nw9BmWs5eu` | Druide | 6 | `systems/add2e/scripts/sorts/druide-invocation-d-un-elemental-du-feu.js` | `systems/add2e/scripts/sorts/druide-invocation-d-un-elemental-du-feu.js` | `systems/add2e/scripts/sorts/druide-invocation-d-un-elemental-du-feu.js` | `scripts/sorts/druide-invocation-d-un-elemental-du-feu.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invocation du temps | `8fZOj9M2oULzHaK1` | Druide | 6 | `systems/add2e/scripts/sorts/druide-invocation-du-temps.js` | `systems/add2e/scripts/sorts/druide-invocation-du-temps.js` | `systems/add2e/scripts/sorts/druide-invocation-du-temps.js` | `scripts/sorts/druide-invocation-du-temps.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Mur d'épines | `vvlyNag1pWQlMqqw` | Druide | 6 | `systems/add2e/scripts/sorts/druide-mur-d-epines.js` | `systems/add2e/scripts/sorts/druide-mur-d-epines.js` | `systems/add2e/scripts/sorts/druide-mur-d-epines.js` | `scripts/sorts/druide-mur-d-epines.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Répulsion du bois | `MtgHg2ggpRB851uE` | Druide | 6 | `systems/add2e/scripts/sorts/druide-repulsion-du-bois.js` | `systems/add2e/scripts/sorts/druide-repulsion-du-bois.js` | `systems/add2e/scripts/sorts/druide-repulsion-du-bois.js` | `scripts/sorts/druide-repulsion-du-bois.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Soin ultime | `2HXdutkNuMd7wEme` | Druide | 6 | `systems/add2e/scripts/sorts/druide-soin-ultime.js` | `systems/add2e/scripts/sorts/druide-soin-ultime.js` | `systems/add2e/scripts/sorts/druide-soin-ultime.js` | `scripts/sorts/druide-soin-ultime.js` | oui | oui | oui | soin | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Transit végétal | `9Y55amDwSzGZYPiM` | Druide | 6 | `systems/add2e/scripts/sorts/druide-transit-vegetal.js` | `systems/add2e/scripts/sorts/druide-transit-vegetal.js` | `systems/add2e/scripts/sorts/druide-transit-vegetal.js` | `scripts/sorts/druide-transit-vegetal.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Animation de la roche | `ta6CWp0VMuC8z4oI` | Druide | 7 | `systems/add2e/scripts/sorts/druide-animation-de-la-roche.js` | `systems/add2e/scripts/sorts/druide-animation-de-la-roche.js` | `systems/add2e/scripts/sorts/druide-animation-de-la-roche.js` | `scripts/sorts/druide-animation-de-la-roche.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Chariot de Sustarre | `6lBtsrAE6tTEJDJI` | Druide | 7 | `systems/add2e/scripts/sorts/druide-chariot-de-sustarre.js` | `systems/add2e/scripts/sorts/druide-chariot-de-sustarre.js` | `systems/add2e/scripts/sorts/druide-chariot-de-sustarre.js` | `scripts/sorts/druide-chariot-de-sustarre.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Confusion | `Siwmacb6r` | Druide | 7 | `systems/add2e/scripts/sorts/confusion.js` | `systems/add2e/scripts/sorts/confusion.js` | `systems/add2e/scripts/sorts/confusion.js` | `scripts/sorts/confusion.js` | oui | non | non | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Contrôle du climat | `Szz8xxhao` | Druide | 7 | `systems/add2e/scripts/sorts/controle-du-climat.js` | `systems/add2e/scripts/sorts/controle-du-climat.js` | `systems/add2e/scripts/sorts/controle-du-climat.js` | `scripts/sorts/controle-du-climat.js` | oui | non | non | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Doigt de mort | `FLwWKlyZWASHf4dY` | Druide | 7 | `systems/add2e/scripts/sorts/druide-doigt-de-mort.js` | `systems/add2e/scripts/sorts/druide-doigt-de-mort.js` | `systems/add2e/scripts/sorts/druide-doigt-de-mort.js` | `scripts/sorts/druide-doigt-de-mort.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Invocation d'un élémental de terre | `FaufBhAcCD3n9phk` | Druide | 7 | `systems/add2e/scripts/sorts/druide-invocation-d-un-elemental-de-terre.js` | `systems/add2e/scripts/sorts/druide-invocation-d-un-elemental-de-terre.js` | `systems/add2e/scripts/sorts/druide-invocation-d-un-elemental-de-terre.js` | `scripts/sorts/druide-invocation-d-un-elemental-de-terre.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Mort rampante | `QNM2PTjpOuOr5twS` | Druide | 7 | `systems/add2e/scripts/sorts/druide-mort-rampante.js` | `systems/add2e/scripts/sorts/druide-mort-rampante.js` | `systems/add2e/scripts/sorts/druide-mort-rampante.js` | `scripts/sorts/druide-mort-rampante.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Réincarnation | `ytUzMMlAcWovQf2A` | Druide | 7 | `systems/add2e/scripts/sorts/druide-reincarnation.js` | `systems/add2e/scripts/sorts/druide-reincarnation.js` | `systems/add2e/scripts/sorts/druide-reincarnation.js` | `scripts/sorts/druide-reincarnation.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Tempête de feu | `IzJgixDIb7nrR1wQ` | Druide | 7 | `systems/add2e/scripts/sorts/druide-tempete-de-feu.js` | `systems/add2e/scripts/sorts/druide-tempete-de-feu.js` | `systems/add2e/scripts/sorts/druide-tempete-de-feu.js` | `scripts/sorts/druide-tempete-de-feu.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Transmutation du métal en bois | `TpsMHSV6jiYmiht6` | Druide | 7 | `systems/add2e/scripts/sorts/druide-transmutation-du-metal-en-bois.js` | `systems/add2e/scripts/sorts/druide-transmutation-du-metal-en-bois.js` | `systems/add2e/scripts/sorts/druide-transmutation-du-metal-en-bois.js` | `scripts/sorts/druide-transmutation-du-metal-en-bois.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bruitage | `xuHjKxIJ94AhH610` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-bruitage.js` | `systems/add2e/scripts/sorts/illusionniste-bruitage.js` | `systems/add2e/scripts/sorts/illusionniste-bruitage.js` | `scripts/sorts/illusionniste-bruitage.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Changement d’apparence | `CTePPmPBPiUTyQ8x` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-changement-d-apparence.js` | `systems/add2e/scripts/sorts/illusionniste-changement-d-apparence.js` | `systems/add2e/scripts/sorts/illusionniste-changement-d-apparence.js` | `scripts/sorts/illusionniste-changement-d-apparence.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection de l’invisibilité | `wtxFaRkEeY5m5vGW` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-detection-de-l-invisibilite.js` | `systems/add2e/scripts/sorts/illusionniste-detection-de-l-invisibilite.js` | `systems/add2e/scripts/sorts/illusionniste-detection-de-l-invisibilite.js` | `scripts/sorts/illusionniste-detection-de-l-invisibilite.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection des illusions | `RoPNQW1lonPdXpIL` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-detection-des-illusions.js` | `systems/add2e/scripts/sorts/illusionniste-detection-des-illusions.js` | `systems/add2e/scripts/sorts/illusionniste-detection-des-illusions.js` | `scripts/sorts/illusionniste-detection-des-illusions.js` | oui | oui | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Force fantasmagorique | `whLrq31uhuv0Vg2x` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-force-fantasmagorique.js` | `systems/add2e/scripts/sorts/illusionniste-force-fantasmagorique.js` | `systems/add2e/scripts/sorts/illusionniste-force-fantasmagorique.js` | `scripts/sorts/illusionniste-force-fantasmagorique.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Hypnotisme | `aJTNURTuGz0aElPr` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-hypnotisme.js` | `systems/add2e/scripts/sorts/illusionniste-hypnotisme.js` | `systems/add2e/scripts/sorts/illusionniste-hypnotisme.js` | `scripts/sorts/illusionniste-hypnotisme.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Jet de couleurs | `PingWPeTX4P9EAag` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-jet-de-couleurs.js` | `systems/add2e/scripts/sorts/illusionniste-jet-de-couleurs.js` | `systems/add2e/scripts/sorts/illusionniste-jet-de-couleurs.js` | `scripts/sorts/illusionniste-jet-de-couleurs.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Lumières dansantes | `lnB96ugHg2ZeHjzf` | Illusionniste | 1 | `systems/add2e/scripts/sorts/lumiere.js` | `systems/add2e/scripts/sorts/lumiere.js` | `systems/add2e/scripts/sorts/lumiere.js` | `scripts/sorts/lumiere.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Mur de brouillard | `ActWRo5tz4Wab8sh` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-mur-de-brouillard.js` | `systems/add2e/scripts/sorts/illusionniste-mur-de-brouillard.js` | `systems/add2e/scripts/sorts/illusionniste-mur-de-brouillard.js` | `scripts/sorts/illusionniste-mur-de-brouillard.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Réflexion des regards | `WCOEjYv79WQ8VYqY` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-reflexion-des-regards.js` | `systems/add2e/scripts/sorts/illusionniste-reflexion-des-regards.js` | `systems/add2e/scripts/sorts/illusionniste-reflexion-des-regards.js` | `scripts/sorts/illusionniste-reflexion-des-regards.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Ténèbres | `yE4kzcw7UIok8p8Y` | Illusionniste | 1 | `systems/add2e/scripts/sorts/illusionniste-tenebres.js` | `systems/add2e/scripts/sorts/illusionniste-tenebres.js` | `systems/add2e/scripts/sorts/illusionniste-tenebres.js` | `scripts/sorts/illusionniste-tenebres.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bouche magique | `wBz84BLOyTmGed9y` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-bouche-magique.js` | `systems/add2e/scripts/sorts/illusionniste-bouche-magique.js` | `systems/add2e/scripts/sorts/illusionniste-bouche-magique.js` | `scripts/sorts/illusionniste-bouche-magique.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Cécité | `N6fR1IQH2M2CZHwV` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-cecite.js` | `systems/add2e/scripts/sorts/illusionniste-cecite.js` | `systems/add2e/scripts/sorts/illusionniste-cecite.js` | `scripts/sorts/illusionniste-cecite.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Désinformation | `uqypjhvmid2zcZip` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-desinformation.js` | `systems/add2e/scripts/sorts/illusionniste-desinformation.js` | `systems/add2e/scripts/sorts/illusionniste-desinformation.js` | `scripts/sorts/illusionniste-desinformation.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection de la magie | `St2jkwm4x` | Illusionniste | 2 | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `scripts/sorts/detection-de-la-magie.js` | oui | non | non | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Force fantasmagorique améliorée | `EsgoQh0nlj7f2bp6` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js` | `systems/add2e/scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js` | `systems/add2e/scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js` | `scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Image miroir | `Ssx6j4e18` | Illusionniste | 2 | `systems/add2e/scripts/sorts/image-miroir.js` | `systems/add2e/scripts/sorts/image-miroir.js` | `systems/add2e/scripts/sorts/image-miroir.js` | `scripts/sorts/image-miroir.js` | oui | non | non | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invisibilité | `4VA5OcJS8DaXKyVw` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-invisibilite.js` | `systems/add2e/scripts/sorts/illusionniste-invisibilite.js` | `systems/add2e/scripts/sorts/illusionniste-invisibilite.js` | `scripts/sorts/illusionniste-invisibilite.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Motif hypnotique | `ChKu6jVRMkzSxKhr` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-motif-hypnotique.js` | `systems/add2e/scripts/sorts/illusionniste-motif-hypnotique.js` | `systems/add2e/scripts/sorts/illusionniste-motif-hypnotique.js` | `scripts/sorts/illusionniste-motif-hypnotique.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Nappe de brouillard | `FYrBpsDerJsdUgz5` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-nappe-de-brouillard.js` | `systems/add2e/scripts/sorts/illusionniste-nappe-de-brouillard.js` | `systems/add2e/scripts/sorts/illusionniste-nappe-de-brouillard.js` | `scripts/sorts/illusionniste-nappe-de-brouillard.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Surdité | `HeupZXq4vQjY3EK8` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-surdite.js` | `systems/add2e/scripts/sorts/illusionniste-surdite.js` | `systems/add2e/scripts/sorts/illusionniste-surdite.js` | `scripts/sorts/illusionniste-surdite.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Trouble | `zKAqiJZxs9A3MPtd` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-trouble.js` | `systems/add2e/scripts/sorts/illusionniste-trouble.js` | `systems/add2e/scripts/sorts/illusionniste-trouble.js` | `scripts/sorts/illusionniste-trouble.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Ventriloquie | `eKltp2YyNCfdS6Qg` | Illusionniste | 2 | `systems/add2e/scripts/sorts/illusionniste-ventriloquie.js` | `systems/add2e/scripts/sorts/illusionniste-ventriloquie.js` | `systems/add2e/scripts/sorts/illusionniste-ventriloquie.js` | `scripts/sorts/illusionniste-ventriloquie.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Corde enchantée | `S1h2ue786` | Illusionniste | 3 | `systems/add2e/scripts/sorts/corde-enchantee.js` | `systems/add2e/scripts/sorts/corde-enchantee.js` | `systems/add2e/scripts/sorts/corde-enchantee.js` | `scripts/sorts/corde-enchantee.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Dissipation des illusions | `OHO4xJXJxW5gygat` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-dissipation-des-illusions.js` | `systems/add2e/scripts/sorts/illusionniste-dissipation-des-illusions.js` | `systems/add2e/scripts/sorts/illusionniste-dissipation-des-illusions.js` | `scripts/sorts/illusionniste-dissipation-des-illusions.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Écriture illusoire | `WweEfY9hLciMDbwM` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-ecriture-illusoire.js` | `systems/add2e/scripts/sorts/illusionniste-ecriture-illusoire.js` | `systems/add2e/scripts/sorts/illusionniste-ecriture-illusoire.js` | `scripts/sorts/illusionniste-ecriture-illusoire.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Effroi | `Soif3xut2` | Illusionniste | 3 | `systems/add2e/scripts/sorts/effroi.js` | `systems/add2e/scripts/sorts/effroi.js` | `systems/add2e/scripts/sorts/effroi.js` | `scripts/sorts/effroi.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Force spectrale | `3xDP7GlFKFXuADfj` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-force-spectrale.js` | `systems/add2e/scripts/sorts/illusionniste-force-spectrale.js` | `systems/add2e/scripts/sorts/illusionniste-force-spectrale.js` | `scripts/sorts/illusionniste-force-spectrale.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invisibilité sur 3 m | `3iWgC8Mq0KHNLWHX` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-invisibilite-sur-3-m.js` | `systems/add2e/scripts/sorts/illusionniste-invisibilite-sur-3-m.js` | `systems/add2e/scripts/sorts/illusionniste-invisibilite-sur-3-m.js` | `scripts/sorts/illusionniste-invisibilite-sur-3-m.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Lumière éternelle | `Sjv8diap7` | Illusionniste | 3 | `systems/add2e/scripts/sorts/lumiere-eternelle.js` | `systems/add2e/scripts/sorts/lumiere-eternelle.js` | `systems/add2e/scripts/sorts/lumiere-eternelle.js` | `scripts/sorts/lumiere-eternelle.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Non-détection | `jMHf785AxLZXArOB` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-non-detection.js` | `systems/add2e/scripts/sorts/illusionniste-non-detection.js` | `systems/add2e/scripts/sorts/illusionniste-non-detection.js` | `scripts/sorts/illusionniste-non-detection.js` | oui | oui | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Paralysie musculaire | `Pp7IjtyLnkBvooZ8` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-paralysie-musculaire.js` | `systems/add2e/scripts/sorts/illusionniste-paralysie-musculaire.js` | `systems/add2e/scripts/sorts/illusionniste-paralysie-musculaire.js` | `scripts/sorts/illusionniste-paralysie-musculaire.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Suggestion | `CTNAYVpDwWldT0PT` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-suggestion.js` | `systems/add2e/scripts/sorts/illusionniste-suggestion.js` | `systems/add2e/scripts/sorts/illusionniste-suggestion.js` | `scripts/sorts/illusionniste-suggestion.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Ténèbres éternelles | `9dKrtDMJTTb8uQ69` | Illusionniste | 3 | `systems/add2e/scripts/sorts/illusionniste-tenebres-eternelles.js` | `systems/add2e/scripts/sorts/illusionniste-tenebres-eternelles.js` | `systems/add2e/scripts/sorts/illusionniste-tenebres-eternelles.js` | `scripts/sorts/illusionniste-tenebres-eternelles.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Terrain hallucinatoire | `S98lx26ye` | Illusionniste | 3 | `systems/add2e/scripts/sorts/terrain-hallucinatoire.js` | `systems/add2e/scripts/sorts/terrain-hallucinatoire.js` | `systems/add2e/scripts/sorts/terrain-hallucinatoire.js` | `scripts/sorts/terrain-hallucinatoire.js` | oui | non | non | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Confusion | `Sxn92jrvw` | Illusionniste | 4 | `systems/add2e/scripts/sorts/confusion.js` | `systems/add2e/scripts/sorts/confusion.js` | `systems/add2e/scripts/sorts/confusion.js` | `scripts/sorts/confusion.js` | oui | non | non | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Création mineure | `XdIvmjAtSNZAr6OD` | Illusionniste | 4 | `systems/add2e/scripts/sorts/illusionniste-creation-mineure.js` | `systems/add2e/scripts/sorts/illusionniste-creation-mineure.js` | `systems/add2e/scripts/sorts/illusionniste-creation-mineure.js` | `scripts/sorts/illusionniste-creation-mineure.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Dissipation de l’épuisement | `wJIL6DTErJknVsvM` | Illusionniste | 4 | `systems/add2e/scripts/sorts/illusionniste-dissipation-de-l-epuisement.js` | `systems/add2e/scripts/sorts/illusionniste-dissipation-de-l-epuisement.js` | `systems/add2e/scripts/sorts/illusionniste-dissipation-de-l-epuisement.js` | `scripts/sorts/illusionniste-dissipation-de-l-epuisement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Émotion | `lJQ17k2WBz4PPxLG` | Illusionniste | 4 | `systems/add2e/scripts/sorts/illusionniste-emotion.js` | `systems/add2e/scripts/sorts/illusionniste-emotion.js` | `systems/add2e/scripts/sorts/illusionniste-emotion.js` | `scripts/sorts/illusionniste-emotion.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invisibilité améliorée | `OneHXc9zQXYEFo8z` | Illusionniste | 4 | `systems/add2e/scripts/sorts/illusionniste-invisibilite-amelioree.js` | `systems/add2e/scripts/sorts/illusionniste-invisibilite-amelioree.js` | `systems/add2e/scripts/sorts/illusionniste-invisibilite-amelioree.js` | `scripts/sorts/illusionniste-invisibilite-amelioree.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Monstres des ombres | `rAnIttzWwgXNUpNM` | Illusionniste | 4 | `systems/add2e/scripts/sorts/illusionniste-monstres-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-monstres-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-monstres-des-ombres.js` | `scripts/sorts/illusionniste-monstres-des-ombres.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Phytomorphose | `BEdKOeb8qiHSn7cb` | Illusionniste | 4 | `systems/add2e/scripts/sorts/illusionniste-phytomorphose.js` | `systems/add2e/scripts/sorts/illusionniste-phytomorphose.js` | `systems/add2e/scripts/sorts/illusionniste-phytomorphose.js` | `scripts/sorts/illusionniste-phytomorphose.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Tueur fantasmagorique | `83Cg1HWiPXCrqS0c` | Illusionniste | 4 | `systems/add2e/scripts/sorts/illusionniste-tueur-fantasmagorique.js` | `systems/add2e/scripts/sorts/illusionniste-tueur-fantasmagorique.js` | `systems/add2e/scripts/sorts/illusionniste-tueur-fantasmagorique.js` | `scripts/sorts/illusionniste-tueur-fantasmagorique.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Chaos | `h3w9xJRIMFBZSPQK` | Illusionniste | 5 | `systems/add2e/scripts/sorts/illusionniste-chaos.js` | `systems/add2e/scripts/sorts/illusionniste-chaos.js` | `systems/add2e/scripts/sorts/illusionniste-chaos.js` | `scripts/sorts/illusionniste-chaos.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Création majeure | `bfKkGhHAvYuzbb4B` | Illusionniste | 5 | `systems/add2e/scripts/sorts/illusionniste-creation-majeure.js` | `systems/add2e/scripts/sorts/illusionniste-creation-majeure.js` | `systems/add2e/scripts/sorts/illusionniste-creation-majeure.js` | `scripts/sorts/illusionniste-creation-majeure.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Holographie | `FrUiFMdhrdEVVoGU` | Illusionniste | 5 | `systems/add2e/scripts/sorts/illusionniste-holographie.js` | `systems/add2e/scripts/sorts/illusionniste-holographie.js` | `systems/add2e/scripts/sorts/illusionniste-holographie.js` | `scripts/sorts/illusionniste-holographie.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation des ombres | `PBTAq8GBzCXTrX17` | Illusionniste | 5 | `systems/add2e/scripts/sorts/illusionniste-invocation-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-invocation-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-invocation-des-ombres.js` | `scripts/sorts/illusionniste-invocation-des-ombres.js` | oui | oui | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Labyrinthe | `Sa6lcn10r` | Illusionniste | 5 | `systems/add2e/scripts/sorts/labyrinthe.js` | `systems/add2e/scripts/sorts/labyrinthe.js` | `systems/add2e/scripts/sorts/labyrinthe.js` | `scripts/sorts/labyrinthe.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Magie des ombres | `QGnxlhJpGGXH7fpw` | Illusionniste | 5 | `systems/add2e/scripts/sorts/illusionniste-magie-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-magie-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-magie-des-ombres.js` | `scripts/sorts/illusionniste-magie-des-ombres.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Monstres demi-ombre | `zRjgdAjHkaeS13gL` | Illusionniste | 5 | `systems/add2e/scripts/sorts/illusionniste-monstres-demi-ombre.js` | `systems/add2e/scripts/sorts/illusionniste-monstres-demi-ombre.js` | `systems/add2e/scripts/sorts/illusionniste-monstres-demi-ombre.js` | `scripts/sorts/illusionniste-monstres-demi-ombre.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Porte des ombres | `wDl7Rbi8fLQo907c` | Illusionniste | 5 | `systems/add2e/scripts/sorts/illusionniste-porte-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-porte-des-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-porte-des-ombres.js` | `scripts/sorts/illusionniste-porte-des-ombres.js` | oui | non | oui | déplacement | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Illusion permanente | `yZrXoPn8wLsrDl0Y` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-illusion-permanente.js` | `systems/add2e/scripts/sorts/illusionniste-illusion-permanente.js` | `systems/add2e/scripts/sorts/illusionniste-illusion-permanente.js` | `scripts/sorts/illusionniste-illusion-permanente.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Illusion programmée | `n7BeLjXJJQDQbrCM` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-illusion-programmee.js` | `systems/add2e/scripts/sorts/illusionniste-illusion-programmee.js` | `systems/add2e/scripts/sorts/illusionniste-illusion-programmee.js` | `scripts/sorts/illusionniste-illusion-programmee.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation des animaux | `JAla8edUQvbursmM` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-invocation-des-animaux.js` | `systems/add2e/scripts/sorts/illusionniste-invocation-des-animaux.js` | `systems/add2e/scripts/sorts/illusionniste-invocation-des-animaux.js` | `scripts/sorts/illusionniste-invocation-des-animaux.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Magie demi-ombre | `cqKzX9eU9thvYrTU` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-magie-demi-ombre.js` | `systems/add2e/scripts/sorts/illusionniste-magie-demi-ombre.js` | `systems/add2e/scripts/sorts/illusionniste-magie-demi-ombre.js` | `scripts/sorts/illusionniste-magie-demi-ombre.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Ombres | `xakbt6nUQ0tbeVvH` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-ombres.js` | `systems/add2e/scripts/sorts/illusionniste-ombres.js` | `scripts/sorts/illusionniste-ombres.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Suggestion de masse | `ouXDv5CbPVKygOnj` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-suggestion-de-masse.js` | `systems/add2e/scripts/sorts/illusionniste-suggestion-de-masse.js` | `systems/add2e/scripts/sorts/illusionniste-suggestion-de-masse.js` | `scripts/sorts/illusionniste-suggestion-de-masse.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Vision réelle | `MkQfB6H23z1EPyXq` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-vision-reelle.js` | `systems/add2e/scripts/sorts/illusionniste-vision-reelle.js` | `systems/add2e/scripts/sorts/illusionniste-vision-reelle.js` | `scripts/sorts/illusionniste-vision-reelle.js` | oui | non | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Voile illusoire | `U5UsRJv9W5WnI5Uc` | Illusionniste | 6 | `systems/add2e/scripts/sorts/illusionniste-voile-illusoire.js` | `systems/add2e/scripts/sorts/illusionniste-voile-illusoire.js` | `systems/add2e/scripts/sorts/illusionniste-voile-illusoire.js` | `scripts/sorts/illusionniste-voile-illusoire.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Altération de la réalité | `WLWi5ajizykNFffK` | Illusionniste | 7 | `systems/add2e/scripts/sorts/illusionniste-alteration-de-la-realite.js` | `systems/add2e/scripts/sorts/illusionniste-alteration-de-la-realite.js` | `systems/add2e/scripts/sorts/illusionniste-alteration-de-la-realite.js` | `scripts/sorts/illusionniste-alteration-de-la-realite.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Jet prismatique | `qEqxbIe6jPNTHEgC` | Illusionniste | 7 | `systems/add2e/scripts/sorts/illusionniste-jet-prismatique.js` | `systems/add2e/scripts/sorts/illusionniste-jet-prismatique.js` | `systems/add2e/scripts/sorts/illusionniste-jet-prismatique.js` | `scripts/sorts/illusionniste-jet-prismatique.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mur prismatique | `ULLJUpLwbeQMLzAt` | Illusionniste | 7 | `systems/add2e/scripts/sorts/illusionniste-mur-prismatique.js` | `systems/add2e/scripts/sorts/illusionniste-mur-prismatique.js` | `systems/add2e/scripts/sorts/illusionniste-mur-prismatique.js` | `scripts/sorts/illusionniste-mur-prismatique.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Sort astral | `S6ybq84lw` | Illusionniste | 7 | `systems/add2e/scripts/sorts/sort-astral.js` | `systems/add2e/scripts/sorts/sort-astral.js` | `systems/add2e/scripts/sorts/sort-astral.js` | `scripts/sorts/sort-astral.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Sorts de niveau 1 de magicien | `yxZAGhZDEaT0e6Am` | Illusionniste | 7 | `systems/add2e/scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js` | `systems/add2e/scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js` | `systems/add2e/scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js` | `scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Vision | `1FDkJAlbuzYtOUON` | Illusionniste | 7 | `systems/add2e/scripts/sorts/illusionniste-vision.js` | `systems/add2e/scripts/sorts/illusionniste-vision.js` | `systems/add2e/scripts/sorts/illusionniste-vision.js` | `scripts/sorts/illusionniste-vision.js` | oui | oui | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Agrandissement | `Ql44mewOhfw0CGSS` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-agrandissement.js` | `systems/add2e/scripts/sorts/magicien-agrandissement.js` | `systems/add2e/scripts/sorts/magicien-agrandissement.js` | `scripts/sorts/magicien-agrandissement.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Altération des feux normaux | `aYPpwB93lzPfZUka` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-alteration-des-feux-normaux.js` | `systems/add2e/scripts/sorts/magicien-alteration-des-feux-normaux.js` | `systems/add2e/scripts/sorts/magicien-alteration-des-feux-normaux.js` | `scripts/sorts/magicien-alteration-des-feux-normaux.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Amitié | `XWJnBEbhnOoQJ3jA` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-amitie.js` | `systems/add2e/scripts/sorts/magicien-amitie.js` | `systems/add2e/scripts/sorts/magicien-amitie.js` | `scripts/sorts/magicien-amitie.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Aura magique de Nystul | `H8oggIty1B5amxPl` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-aura-magique-de-nystul.js` | `systems/add2e/scripts/sorts/magicien-aura-magique-de-nystul.js` | `systems/add2e/scripts/sorts/magicien-aura-magique-de-nystul.js` | `scripts/sorts/magicien-aura-magique-de-nystul.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bouclier | `vfbToqj3FmCBkCZY` | Magicien | 1 | `systems/add2e/scripts/sorts/bouclier.js` | `systems/add2e/scripts/sorts/bouclier.js` | `systems/add2e/scripts/sorts/bouclier.js` | `scripts/sorts/bouclier.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Charme-personnes | `vzsXf3ju8KaPX7gg` | Magicien | 1 | `systems/add2e/scripts/sorts/charme_personne.js` | `systems/add2e/scripts/sorts/charme_personne.js` | `systems/add2e/scripts/sorts/charme_personne.js` | `scripts/sorts/charme_personne.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Chute de plume | `eHS5KR95WVarU3pc` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-chute-de-plume.js` | `systems/add2e/scripts/sorts/magicien-chute-de-plume.js` | `systems/add2e/scripts/sorts/magicien-chute-de-plume.js` | `scripts/sorts/magicien-chute-de-plume.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Compréhension des langues | `87QO92XmR11xX6d8` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-comprehension-des-langues.js` | `systems/add2e/scripts/sorts/magicien-comprehension-des-langues.js` | `systems/add2e/scripts/sorts/magicien-comprehension-des-langues.js` | `scripts/sorts/magicien-comprehension-des-langues.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection de la magie | `Sxmmsj8ap` | Magicien | 1 | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `systems/add2e/scripts/sorts/detection-de-la-magie.js` | `scripts/sorts/detection-de-la-magie.js` | oui | non | non | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Disque flottant de Tenser | `yg6KwuVZ0LX0iAJR` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-disque-flottant-de-tenser.js` | `systems/add2e/scripts/sorts/magicien-disque-flottant-de-tenser.js` | `systems/add2e/scripts/sorts/magicien-disque-flottant-de-tenser.js` | `scripts/sorts/magicien-disque-flottant-de-tenser.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Écriture | `0xDSJQMk6eczXt8X` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-ecriture.js` | `systems/add2e/scripts/sorts/magicien-ecriture.js` | `systems/add2e/scripts/sorts/magicien-ecriture.js` | `scripts/sorts/magicien-ecriture.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Effacement | `xRkHrKxTwrMBU0S6` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-effacement.js` | `systems/add2e/scripts/sorts/magicien-effacement.js` | `systems/add2e/scripts/sorts/magicien-effacement.js` | `scripts/sorts/magicien-effacement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Escalade d’araignée | `foYtagnFToouiATL` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-escalade-d-araignee.js` | `systems/add2e/scripts/sorts/magicien-escalade-d-araignee.js` | `systems/add2e/scripts/sorts/magicien-escalade-d-araignee.js` | `scripts/sorts/magicien-escalade-d-araignee.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Fermeture | `R2sA71p9mFINt8Rc` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-fermeture.js` | `systems/add2e/scripts/sorts/magicien-fermeture.js` | `systems/add2e/scripts/sorts/magicien-fermeture.js` | `scripts/sorts/magicien-fermeture.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Identification | `j4mcEDMWWZDmHxVc` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-identification.js` | `systems/add2e/scripts/sorts/magicien-identification.js` | `systems/add2e/scripts/sorts/magicien-identification.js` | `scripts/sorts/magicien-identification.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation d’un familier | `uaf9HJHgrTYgwKTG` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-invocation-d-un-familier.js` | `systems/add2e/scripts/sorts/magicien-invocation-d-un-familier.js` | `systems/add2e/scripts/sorts/magicien-invocation-d-un-familier.js` | `scripts/sorts/magicien-invocation-d-un-familier.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Lecture de la magie | `C3BPJmqOmR14lZgX` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-lecture-de-la-magie.js` | `systems/add2e/scripts/sorts/magicien-lecture-de-la-magie.js` | `systems/add2e/scripts/sorts/magicien-lecture-de-la-magie.js` | `scripts/sorts/magicien-lecture-de-la-magie.js` | oui | oui | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Lumières dansantes | `1ZPprzuVFnjKQGVz` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-lumieres-dansantes.js` | `systems/add2e/scripts/sorts/magicien-lumieres-dansantes.js` | `systems/add2e/scripts/sorts/magicien-lumieres-dansantes.js` | `scripts/sorts/magicien-lumieres-dansantes.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mains brûlantes | `KdSGwTV1VKI5YjDI` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-mains-brulantes.js` | `systems/add2e/scripts/sorts/magicien-mains-brulantes.js` | `systems/add2e/scripts/sorts/magicien-mains-brulantes.js` | `scripts/sorts/magicien-mains-brulantes.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Message | `K9mYUPeDhXdXBopk` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-message.js` | `systems/add2e/scripts/sorts/magicien-message.js` | `systems/add2e/scripts/sorts/magicien-message.js` | `scripts/sorts/magicien-message.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Poigne électrique | `m9Z8xebP4Od4RlsP` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-poigne-electrique.js` | `systems/add2e/scripts/sorts/magicien-poigne-electrique.js` | `systems/add2e/scripts/sorts/magicien-poigne-electrique.js` | `scripts/sorts/magicien-poigne-electrique.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | conserver |
| Poussée | `ZwE7ceveF3dbKFdF` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-poussee.js` | `systems/add2e/scripts/sorts/magicien-poussee.js` | `systems/add2e/scripts/sorts/magicien-poussee.js` | `scripts/sorts/magicien-poussee.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Projectile magique | `Sr8hvuf42` | Magicien | 1 | `systems/add2e/scripts/sorts/projectile-magique.js` | `systems/add2e/scripts/sorts/projectile-magique.js` | `systems/add2e/scripts/sorts/projectile-magique.js` | `scripts/sorts/projectile-magique.js` | oui | non | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | conserver |
| Protection contre le mal | `S3owai0q7` | Magicien | 1 | `systems/add2e/scripts/sorts/protection-contre-le-mal.js` | `systems/add2e/scripts/sorts/protection-contre-le-mal.js` | `systems/add2e/scripts/sorts/protection-contre-le-mal.js` | `scripts/sorts/protection-contre-le-mal.js` | oui | oui | non | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Réparation | `JasfW0d6Q6kD6Ocu` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-reparation.js` | `systems/add2e/scripts/sorts/magicien-reparation.js` | `systems/add2e/scripts/sorts/magicien-reparation.js` | `scripts/sorts/magicien-reparation.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Saut | `jrbDmeQEatjKE6n5` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-saut.js` | `systems/add2e/scripts/sorts/magicien-saut.js` | `systems/add2e/scripts/sorts/magicien-saut.js` | `scripts/sorts/magicien-saut.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Serviteur invisible | `sqe9tEofCRkLumNr` | Magicien | 1 | `systems/add2e/scripts/sorts/magicien-serviteur-invisible.js` | `systems/add2e/scripts/sorts/magicien-serviteur-invisible.js` | `systems/add2e/scripts/sorts/magicien-serviteur-invisible.js` | `scripts/sorts/magicien-serviteur-invisible.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Sommeil | `YzvHRmS0SVf0NDfO` | Magicien | 1 | `systems/add2e/scripts/sorts/sommeil.js` | `systems/add2e/scripts/sorts/sommeil.js` | `systems/add2e/scripts/sorts/sommeil.js` | `scripts/sorts/sommeil.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Ventriloquie | `Sh0s7nf55` | Magicien | 1 | `systems/add2e/scripts/sorts/ventriloquie.js` | `systems/add2e/scripts/sorts/ventriloquie.js` | `systems/add2e/scripts/sorts/ventriloquie.js` | `scripts/sorts/ventriloquie.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Bouche magique | `Sd3h2eywj` | Magicien | 2 | `systems/add2e/scripts/sorts/bouche-magique.js` | `systems/add2e/scripts/sorts/bouche-magique.js` | `systems/add2e/scripts/sorts/bouche-magique.js` | `scripts/sorts/bouche-magique.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Bruitage | `Skwo3qibs` | Magicien | 2 | `systems/add2e/scripts/sorts/bruitage.js` | `systems/add2e/scripts/sorts/bruitage.js` | `systems/add2e/scripts/sorts/bruitage.js` | `scripts/sorts/bruitage.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Corde enchantée | `lXUOJQPzhAffHVMC` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-corde-enchantee.js` | `systems/add2e/scripts/sorts/magicien-corde-enchantee.js` | `systems/add2e/scripts/sorts/magicien-corde-enchantee.js` | `scripts/sorts/magicien-corde-enchantee.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Détection du mal | `S744pccyj` | Magicien | 2 | `systems/add2e/scripts/sorts/detection-du-mal.js` | `systems/add2e/scripts/sorts/detection-du-mal.js` | `systems/add2e/scripts/sorts/detection-du-mal.js` | `scripts/sorts/detection-du-mal.js` | oui | non | non | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| E.S.P. | `ySqQUdkEBf3Sav2Z` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-e-s-p.js` | `systems/add2e/scripts/sorts/magicien-e-s-p.js` | `systems/add2e/scripts/sorts/magicien-e-s-p.js` | `scripts/sorts/magicien-e-s-p.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Force | `Y6tsRuejC7qRqtCd` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-force.js` | `systems/add2e/scripts/sorts/magicien-force.js` | `systems/add2e/scripts/sorts/magicien-force.js` | `scripts/sorts/magicien-force.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Fracassement | `cGT3rT7VlCh7BuWd` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-fracassement.js` | `systems/add2e/scripts/sorts/magicien-fracassement.js` | `systems/add2e/scripts/sorts/magicien-fracassement.js` | `scripts/sorts/magicien-fracassement.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Image miroir | `0vUHIpvUNS4TA1XZ` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-image-miroir.js` | `systems/add2e/scripts/sorts/magicien-image-miroir.js` | `systems/add2e/scripts/sorts/magicien-image-miroir.js` | `scripts/sorts/magicien-image-miroir.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invisibilité | `S3n5s30rh` | Magicien | 2 | `systems/add2e/scripts/sorts/detection-de-linvisibilite.js` | `systems/add2e/scripts/sorts/detection-de-linvisibilite.js` | `systems/add2e/scripts/sorts/detection-de-linvisibilite.js` | `scripts/sorts/detection-de-linvisibilite.js` | oui | oui | non | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Lévitation | `2sz9FJMkEg5Ljywr` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-levitation.js` | `systems/add2e/scripts/sorts/magicien-levitation.js` | `systems/add2e/scripts/sorts/magicien-levitation.js` | `scripts/sorts/magicien-levitation.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Localisation d’objets | `FMsUijIK9egwdICC` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-localisation-d-objets.js` | `systems/add2e/scripts/sorts/magicien-localisation-d-objets.js` | `systems/add2e/scripts/sorts/magicien-localisation-d-objets.js` | `scripts/sorts/magicien-localisation-d-objets.js` | oui | non | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Lumière éternelle | `Sejwb1zfk` | Magicien | 2 | `systems/add2e/scripts/sorts/lumiere-eternelle.js` | `systems/add2e/scripts/sorts/lumiere-eternelle.js` | `systems/add2e/scripts/sorts/lumiere-eternelle.js` | `scripts/sorts/lumiere-eternelle.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Nuage puant | `fnSR2CAHU3rU3WGm` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-nuage-puant.js` | `systems/add2e/scripts/sorts/magicien-nuage-puant.js` | `systems/add2e/scripts/sorts/magicien-nuage-puant.js` | `scripts/sorts/magicien-nuage-puant.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Or des fous | `F1AYLNQxgPkbAKvP` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-or-des-fous.js` | `systems/add2e/scripts/sorts/magicien-or-des-fous.js` | `systems/add2e/scripts/sorts/magicien-or-des-fous.js` | `scripts/sorts/magicien-or-des-fous.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Oubli | `6bFZjficFTtSOd3X` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-oubli.js` | `systems/add2e/scripts/sorts/magicien-oubli.js` | `systems/add2e/scripts/sorts/magicien-oubli.js` | `scripts/sorts/magicien-oubli.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Ouverture | `IiCnwcKzkfECzT5b` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-ouverture.js` | `systems/add2e/scripts/sorts/magicien-ouverture.js` | `systems/add2e/scripts/sorts/magicien-ouverture.js` | `scripts/sorts/magicien-ouverture.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Peur | `nEnY0rOhsUcIvGw9` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-peur.js` | `systems/add2e/scripts/sorts/magicien-peur.js` | `systems/add2e/scripts/sorts/magicien-peur.js` | `scripts/sorts/magicien-peur.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Piège de Léomund | `XeoIbrIuWzQQeqhb` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-piege-de-leomund.js` | `systems/add2e/scripts/sorts/magicien-piege-de-leomund.js` | `systems/add2e/scripts/sorts/magicien-piege-de-leomund.js` | `scripts/sorts/magicien-piege-de-leomund.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Pyrotechnie | `HrKOTw0kqX1w6X3C` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-pyrotechnie.js` | `systems/add2e/scripts/sorts/magicien-pyrotechnie.js` | `systems/add2e/scripts/sorts/magicien-pyrotechnie.js` | `scripts/sorts/magicien-pyrotechnie.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Rayon d’affaiblissement | `JdNLcU95SJeFJWf0` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-rayon-d-affaiblissement.js` | `systems/add2e/scripts/sorts/magicien-rayon-d-affaiblissement.js` | `systems/add2e/scripts/sorts/magicien-rayon-d-affaiblissement.js` | `scripts/sorts/magicien-rayon-d-affaiblissement.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Ténèbres sur 5 mètres | `CvNVh364E6mHLbiC` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-tenebres-sur-5-metres.js` | `systems/add2e/scripts/sorts/magicien-tenebres-sur-5-metres.js` | `systems/add2e/scripts/sorts/magicien-tenebres-sur-5-metres.js` | `scripts/sorts/magicien-tenebres-sur-5-metres.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Toile d’araignée | `orptvU3p8BkABXhH` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-toile-d-araignee.js` | `systems/add2e/scripts/sorts/magicien-toile-d-araignee.js` | `systems/add2e/scripts/sorts/magicien-toile-d-araignee.js` | `scripts/sorts/magicien-toile-d-araignee.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Verrou magique | `YzA9lPZieNlGZn1V` | Magicien | 2 | `systems/add2e/scripts/sorts/magicien-verrou-magique.js` | `systems/add2e/scripts/sorts/magicien-verrou-magique.js` | `systems/add2e/scripts/sorts/magicien-verrou-magique.js` | `scripts/sorts/magicien-verrou-magique.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Boule de feu | `OdjZbZ6yCK8f7Cej` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-boule-de-feu.js` | `systems/add2e/scripts/sorts/magicien-boule-de-feu.js` | `systems/add2e/scripts/sorts/magicien-boule-de-feu.js` | `scripts/sorts/magicien-boule-de-feu.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Catalepsie | `Slpogd4zw` | Magicien | 3 | `systems/add2e/scripts/sorts/catalepsie.js` | `systems/add2e/scripts/sorts/catalepsie.js` | `systems/add2e/scripts/sorts/catalepsie.js` | `scripts/sorts/catalepsie.js` | oui | non | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Chaumière de Léomund | `eQP2mvNXNEHDkl0Y` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-chaumiere-de-leomund.js` | `systems/add2e/scripts/sorts/magicien-chaumiere-de-leomund.js` | `systems/add2e/scripts/sorts/magicien-chaumiere-de-leomund.js` | `scripts/sorts/magicien-chaumiere-de-leomund.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Clairaudience | `bs5Yev27GKosckIi` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-clairaudience.js` | `systems/add2e/scripts/sorts/magicien-clairaudience.js` | `systems/add2e/scripts/sorts/magicien-clairaudience.js` | `scripts/sorts/magicien-clairaudience.js` | oui | oui | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Clairvoyance | `PeKgX0v88L8WqgdP` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-clairvoyance.js` | `systems/add2e/scripts/sorts/magicien-clairvoyance.js` | `systems/add2e/scripts/sorts/magicien-clairvoyance.js` | `scripts/sorts/magicien-clairvoyance.js` | oui | oui | oui | divination | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Dissipation de la magie | `S1yedhqtw` | Magicien | 3 | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `systems/add2e/scripts/sorts/dissipation-de-la-magie.js` | `scripts/sorts/dissipation-de-la-magie.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Flèche de feu | `cdoLylDIdTX30880` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-fleche-de-feu.js` | `systems/add2e/scripts/sorts/magicien-fleche-de-feu.js` | `systems/add2e/scripts/sorts/magicien-fleche-de-feu.js` | `scripts/sorts/magicien-fleche-de-feu.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Force fantasmagorique | `Sjv9g51wv` | Magicien | 3 | `systems/add2e/scripts/sorts/force-fantasmagorique.js` | `systems/add2e/scripts/sorts/force-fantasmagorique.js` | `systems/add2e/scripts/sorts/force-fantasmagorique.js` | `scripts/sorts/force-fantasmagorique.js` | oui | oui | non | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Foudre | `mURPcJOWStwfHLSD` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-foudre.js` | `systems/add2e/scripts/sorts/magicien-foudre.js` | `systems/add2e/scripts/sorts/magicien-foudre.js` | `scripts/sorts/magicien-foudre.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Infravision | `TVQDVtYjgIIl4Qwp` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-infravision.js` | `systems/add2e/scripts/sorts/magicien-infravision.js` | `systems/add2e/scripts/sorts/magicien-infravision.js` | `scripts/sorts/magicien-infravision.js` | oui | non | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Intermittence | `U6jlnGdUZAhfesYx` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-intermittence.js` | `systems/add2e/scripts/sorts/magicien-intermittence.js` | `systems/add2e/scripts/sorts/magicien-intermittence.js` | `scripts/sorts/magicien-intermittence.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invisibilité sur 3 m | `Sleh5na5u` | Magicien | 3 | `systems/add2e/scripts/sorts/invisibilite-sur-3-m.js` | `systems/add2e/scripts/sorts/invisibilite-sur-3-m.js` | `systems/add2e/scripts/sorts/invisibilite-sur-3-m.js` | `scripts/sorts/invisibilite-sur-3-m.js` | oui | non | non | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Invocation de monstres I | `azzcDv1FWb4UfqXk` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-invocation-de-monstres-i.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstres-i.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstres-i.js` | `scripts/sorts/magicien-invocation-de-monstres-i.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Langues | `m10Pwr1wzT3BZTGP` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-langues.js` | `systems/add2e/scripts/sorts/magicien-langues.js` | `systems/add2e/scripts/sorts/magicien-langues.js` | `scripts/sorts/magicien-langues.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Paralysie | `Uer3SMWo8VGodjcf` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-paralysie.js` | `systems/add2e/scripts/sorts/magicien-paralysie.js` | `systems/add2e/scripts/sorts/magicien-paralysie.js` | `scripts/sorts/magicien-paralysie.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Protection contre le mal sur 3 m | `RK3Dwq9cpDrc4JKy` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js` | `systems/add2e/scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js` | `systems/add2e/scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js` | `scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js` | oui | non | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Protection contre les projectiles normaux | `2xS2zLfqcMi0wyu7` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js` | `systems/add2e/scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js` | `systems/add2e/scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js` | `scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js` | oui | oui | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Rafale de vent | `4Fefn3TPB5BiMRw8` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-rafale-de-vent.js` | `systems/add2e/scripts/sorts/magicien-rafale-de-vent.js` | `systems/add2e/scripts/sorts/magicien-rafale-de-vent.js` | `scripts/sorts/magicien-rafale-de-vent.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Ralentissement | `bKU3hWAg9dK3XNJ2` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-ralentissement.js` | `systems/add2e/scripts/sorts/magicien-ralentissement.js` | `systems/add2e/scripts/sorts/magicien-ralentissement.js` | `scripts/sorts/magicien-ralentissement.js` | oui | oui | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Rapidité | `Ua8x9g7HihK7cXGY` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-rapidite.js` | `systems/add2e/scripts/sorts/magicien-rapidite.js` | `systems/add2e/scripts/sorts/magicien-rapidite.js` | `scripts/sorts/magicien-rapidite.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Respiration aquatique | `Smspazki5` | Magicien | 3 | `systems/add2e/scripts/sorts/respiration-aquatique.js` | `systems/add2e/scripts/sorts/respiration-aquatique.js` | `systems/add2e/scripts/sorts/respiration-aquatique.js` | `scripts/sorts/respiration-aquatique.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Runes explosives | `s4srAEb0LL48XW0c` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-runes-explosives.js` | `systems/add2e/scripts/sorts/magicien-runes-explosives.js` | `systems/add2e/scripts/sorts/magicien-runes-explosives.js` | `scripts/sorts/magicien-runes-explosives.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Suggestion | `Siybiihzj` | Magicien | 3 | `systems/add2e/scripts/sorts/suggestion.js` | `systems/add2e/scripts/sorts/suggestion.js` | `systems/add2e/scripts/sorts/suggestion.js` | `scripts/sorts/suggestion.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Vol | `L0KzlhAHlY5WnALd` | Magicien | 3 | `systems/add2e/scripts/sorts/magicien-vol.js` | `systems/add2e/scripts/sorts/magicien-vol.js` | `systems/add2e/scripts/sorts/magicien-vol.js` | `scripts/sorts/magicien-vol.js` | oui | oui | oui | déplacement | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Allométamorphose | `OwC37LQnhgfxfBPC` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-allometamorphose.js` | `systems/add2e/scripts/sorts/magicien-allometamorphose.js` | `systems/add2e/scripts/sorts/magicien-allometamorphose.js` | `scripts/sorts/magicien-allometamorphose.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Arme enchantée | `i9oPB799yhmXRNTj` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-arme-enchantee.js` | `systems/add2e/scripts/sorts/magicien-arme-enchantee.js` | `systems/add2e/scripts/sorts/magicien-arme-enchantee.js` | `scripts/sorts/magicien-arme-enchantee.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Autométamorphose | `PXmZOAl9DCJAeUeJ` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-autometamorphose.js` | `systems/add2e/scripts/sorts/magicien-autometamorphose.js` | `systems/add2e/scripts/sorts/magicien-autometamorphose.js` | `scripts/sorts/magicien-autometamorphose.js` | oui | non | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bouclier de feu | `EjNM7yMhVXwwaOc4` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-bouclier-de-feu.js` | `systems/add2e/scripts/sorts/magicien-bouclier-de-feu.js` | `systems/add2e/scripts/sorts/magicien-bouclier-de-feu.js` | `scripts/sorts/magicien-bouclier-de-feu.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Charme-monstres | `Hq0MiaQGHC04aCs8` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-charme-monstres.js` | `systems/add2e/scripts/sorts/magicien-charme-monstres.js` | `systems/add2e/scripts/sorts/magicien-charme-monstres.js` | `scripts/sorts/magicien-charme-monstres.js` | oui | oui | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Confusion | `qc2S7OiREu8cVCKQ` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-confusion.js` | `systems/add2e/scripts/sorts/magicien-confusion.js` | `systems/add2e/scripts/sorts/magicien-confusion.js` | `scripts/sorts/magicien-confusion.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Désenvoûtement | `Sq750xrgb` | Magicien | 4 | `systems/add2e/scripts/sorts/desenvoutement.js` | `systems/add2e/scripts/sorts/desenvoutement.js` | `systems/add2e/scripts/sorts/desenvoutement.js` | `scripts/sorts/desenvoutement.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Effroi | `VTqrTRciI6HhhBw0` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-effroi.js` | `systems/add2e/scripts/sorts/magicien-effroi.js` | `systems/add2e/scripts/sorts/magicien-effroi.js` | `scripts/sorts/magicien-effroi.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Embroussaillement | `WZuRPMokWkRk8S0N` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-embroussaillement.js` | `systems/add2e/scripts/sorts/magicien-embroussaillement.js` | `systems/add2e/scripts/sorts/magicien-embroussaillement.js` | `scripts/sorts/magicien-embroussaillement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Excavation | `4gmO2NbHZxkLXarh` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-excavation.js` | `systems/add2e/scripts/sorts/magicien-excavation.js` | `systems/add2e/scripts/sorts/magicien-excavation.js` | `scripts/sorts/magicien-excavation.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Extension I | `ol1qo1S9byPbktdo` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-extension-i.js` | `systems/add2e/scripts/sorts/magicien-extension-i.js` | `systems/add2e/scripts/sorts/magicien-extension-i.js` | `scripts/sorts/magicien-extension-i.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Feu charmeur | `ej2pDpTcbBp59ioV` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-feu-charmeur.js` | `systems/add2e/scripts/sorts/magicien-feu-charmeur.js` | `systems/add2e/scripts/sorts/magicien-feu-charmeur.js` | `scripts/sorts/magicien-feu-charmeur.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Globe mineur d’invulnérabilité | `OQFWHUXg5wCpvWiU` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js` | `systems/add2e/scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js` | `systems/add2e/scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js` | `scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js` | oui | oui | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation de monstre II | `xPNrvuMVoTHmz9GY` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-ii.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-ii.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-ii.js` | `scripts/sorts/magicien-invocation-de-monstre-ii.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Maladresse | `od5HnEJxmcuxoc7b` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-maladresse.js` | `systems/add2e/scripts/sorts/magicien-maladresse.js` | `systems/add2e/scripts/sorts/magicien-maladresse.js` | `scripts/sorts/magicien-maladresse.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Moyen mnémonique de Rary | `wtQdhwfXLq5KI8dx` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-moyen-mnemonique-de-rary.js` | `systems/add2e/scripts/sorts/magicien-moyen-mnemonique-de-rary.js` | `systems/add2e/scripts/sorts/magicien-moyen-mnemonique-de-rary.js` | `scripts/sorts/magicien-moyen-mnemonique-de-rary.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mur de feu | `Sl22x1gv4` | Magicien | 4 | `systems/add2e/scripts/sorts/mur-de-feu.js` | `systems/add2e/scripts/sorts/mur-de-feu.js` | `systems/add2e/scripts/sorts/mur-de-feu.js` | `scripts/sorts/mur-de-feu.js` | oui | oui | non | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Mur de glace | `Oe6kWMmtqXjUdluK` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-mur-de-glace.js` | `systems/add2e/scripts/sorts/magicien-mur-de-glace.js` | `systems/add2e/scripts/sorts/magicien-mur-de-glace.js` | `scripts/sorts/magicien-mur-de-glace.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Œil magique | `NENvm4CbdMhFClxo` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-il-magique.js` | `systems/add2e/scripts/sorts/magicien-il-magique.js` | `systems/add2e/scripts/sorts/magicien-il-magique.js` | `scripts/sorts/magicien-il-magique.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Phytomorphose | `Sjja6qk18` | Magicien | 4 | `systems/add2e/scripts/sorts/phytomorphose.js` | `systems/add2e/scripts/sorts/phytomorphose.js` | `systems/add2e/scripts/sorts/phytomorphose.js` | `scripts/sorts/phytomorphose.js` | oui | oui | non | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Piège à feu | `p9jlQvfec03qUS4e` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-piege-a-feu.js` | `systems/add2e/scripts/sorts/magicien-piege-a-feu.js` | `systems/add2e/scripts/sorts/magicien-piege-a-feu.js` | `scripts/sorts/magicien-piege-a-feu.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Porte dimensionnelle | `9xooSY6MIFWhmC0h` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-porte-dimensionnelle.js` | `systems/add2e/scripts/sorts/magicien-porte-dimensionnelle.js` | `systems/add2e/scripts/sorts/magicien-porte-dimensionnelle.js` | `scripts/sorts/magicien-porte-dimensionnelle.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Tempête de glace | `zPQP5olmpPjaRgmf` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-tempete-de-glace.js` | `systems/add2e/scripts/sorts/magicien-tempete-de-glace.js` | `systems/add2e/scripts/sorts/magicien-tempete-de-glace.js` | `scripts/sorts/magicien-tempete-de-glace.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Terrain hallucinatoire | `afrGD9EO4FsC15qj` | Magicien | 4 | `systems/add2e/scripts/sorts/magicien-terrain-hallucinatoire.js` | `systems/add2e/scripts/sorts/magicien-terrain-hallucinatoire.js` | `systems/add2e/scripts/sorts/magicien-terrain-hallucinatoire.js` | `scripts/sorts/magicien-terrain-hallucinatoire.js` | oui | oui | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Chien fidèle de Mordenkainen | `So9k2n77e` | Magicien | 5 | `systems/add2e/scripts/sorts/chien-fidele-de-mordenkainen.js` | `systems/add2e/scripts/sorts/chien-fidele-de-mordenkainen.js` | `systems/add2e/scripts/sorts/chien-fidele-de-mordenkainen.js` | `scripts/sorts/chien-fidele-de-mordenkainen.js` | oui | oui | non | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | effet_visuel_seul_plus_message_mj |
| Coffre secret de Léomund | `YmY1ZfpSrQmJqRIX` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-coffre-secret-de-leomund.js` | `systems/add2e/scripts/sorts/magicien-coffre-secret-de-leomund.js` | `systems/add2e/scripts/sorts/magicien-coffre-secret-de-leomund.js` | `scripts/sorts/magicien-coffre-secret-de-leomund.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Cône de froid | `daKCJF4Luaija46f` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-cone-de-froid.js` | `systems/add2e/scripts/sorts/magicien-cone-de-froid.js` | `systems/add2e/scripts/sorts/magicien-cone-de-froid.js` | `scripts/sorts/magicien-cone-de-froid.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Contact d'autres plans | `k0JnUphmxVtqdDkd` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-contact-d-autres-plans.js` | `systems/add2e/scripts/sorts/magicien-contact-d-autres-plans.js` | `systems/add2e/scripts/sorts/magicien-contact-d-autres-plans.js` | `scripts/sorts/magicien-contact-d-autres-plans.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Croissance animale | `f2k3BWjZABrQKWZW` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-croissance-animale.js` | `systems/add2e/scripts/sorts/magicien-croissance-animale.js` | `systems/add2e/scripts/sorts/magicien-croissance-animale.js` | `scripts/sorts/magicien-croissance-animale.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Débilité mentale | `WK5FYRTJv5l03gmy` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-debilite-mentale.js` | `systems/add2e/scripts/sorts/magicien-debilite-mentale.js` | `systems/add2e/scripts/sorts/magicien-debilite-mentale.js` | `scripts/sorts/magicien-debilite-mentale.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Distorsion des distances | `TyxGTNAe1knBWFwn` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-distorsion-des-distances.js` | `systems/add2e/scripts/sorts/magicien-distorsion-des-distances.js` | `systems/add2e/scripts/sorts/magicien-distorsion-des-distances.js` | `scripts/sorts/magicien-distorsion-des-distances.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Eau aérée | `2o6VDQqrx5bx6rLv` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-eau-aeree.js` | `systems/add2e/scripts/sorts/magicien-eau-aeree.js` | `systems/add2e/scripts/sorts/magicien-eau-aeree.js` | `scripts/sorts/magicien-eau-aeree.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Extension II | `j8RBv6DtA7saCnGy` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-extension-ii.js` | `systems/add2e/scripts/sorts/magicien-extension-ii.js` | `systems/add2e/scripts/sorts/magicien-extension-ii.js` | `scripts/sorts/magicien-extension-ii.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation d’élémental | `naBatu3eatZHd1ZQ` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-invocation-d-elemental.js` | `systems/add2e/scripts/sorts/magicien-invocation-d-elemental.js` | `systems/add2e/scripts/sorts/magicien-invocation-d-elemental.js` | `scripts/sorts/magicien-invocation-d-elemental.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation de Monstre III | `PBUGHsDhjfmhPM0p` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-iii.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-iii.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-iii.js` | `scripts/sorts/magicien-invocation-de-monstre-iii.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Lithomorphose | `Smft9cj75` | Magicien | 5 | `systems/add2e/scripts/sorts/lithomorphose.js` | `systems/add2e/scripts/sorts/lithomorphose.js` | `systems/add2e/scripts/sorts/lithomorphose.js` | `scripts/sorts/lithomorphose.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Main d’interposition de Bigby | `Kmy6PUAQMmaBW2Dn` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-main-d-interposition-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-main-d-interposition-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-main-d-interposition-de-bigby.js` | `scripts/sorts/magicien-main-d-interposition-de-bigby.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Métempsycose | `ttJqTVO09PEhayZ1` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-metempsycose.js` | `systems/add2e/scripts/sorts/magicien-metempsycose.js` | `systems/add2e/scripts/sorts/magicien-metempsycose.js` | `scripts/sorts/magicien-metempsycose.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mur de fer | `sd1VA2m7L1HNvPxt` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-mur-de-fer.js` | `systems/add2e/scripts/sorts/magicien-mur-de-fer.js` | `systems/add2e/scripts/sorts/magicien-mur-de-fer.js` | `scripts/sorts/magicien-mur-de-fer.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mur de force | `AefoyJiwmSnT9qEM` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-mur-de-force.js` | `systems/add2e/scripts/sorts/magicien-mur-de-force.js` | `systems/add2e/scripts/sorts/magicien-mur-de-force.js` | `scripts/sorts/magicien-mur-de-force.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mur de roc | `isr5twi7UEGprtel` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-mur-de-roc.js` | `systems/add2e/scripts/sorts/magicien-mur-de-roc.js` | `systems/add2e/scripts/sorts/magicien-mur-de-roc.js` | `scripts/sorts/magicien-mur-de-roc.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Nécro-animation | `E5Jf7Dh2lk8V5H45` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-necro-animation.js` | `systems/add2e/scripts/sorts/magicien-necro-animation.js` | `systems/add2e/scripts/sorts/magicien-necro-animation.js` | `scripts/sorts/magicien-necro-animation.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Nuage létal | `m9giICqkP6PLgPIN` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-nuage-letal.js` | `systems/add2e/scripts/sorts/magicien-nuage-letal.js` | `systems/add2e/scripts/sorts/magicien-nuage-letal.js` | `scripts/sorts/magicien-nuage-letal.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Paralysie des monstres | `C4NFQjWH7tilr2KL` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-paralysie-des-monstres.js` | `systems/add2e/scripts/sorts/magicien-paralysie-des-monstres.js` | `systems/add2e/scripts/sorts/magicien-paralysie-des-monstres.js` | `scripts/sorts/magicien-paralysie-des-monstres.js` | oui | oui | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Passe-muraille | `319ECVaG7zViAnWl` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-passe-muraille.js` | `systems/add2e/scripts/sorts/magicien-passe-muraille.js` | `systems/add2e/scripts/sorts/magicien-passe-muraille.js` | `scripts/sorts/magicien-passe-muraille.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Télékinésie | `bRRHc2GEzYv8h3pQ` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-telekinesie.js` | `systems/add2e/scripts/sorts/magicien-telekinesie.js` | `systems/add2e/scripts/sorts/magicien-telekinesie.js` | `scripts/sorts/magicien-telekinesie.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Téléportation | `fz3mzpALqk4DBvS8` | Magicien | 5 | `systems/add2e/scripts/sorts/magicien-teleportation.js` | `systems/add2e/scripts/sorts/magicien-teleportation.js` | `systems/add2e/scripts/sorts/magicien-teleportation.js` | `scripts/sorts/magicien-teleportation.js` | oui | non | oui | déplacement | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Transmutation de pierre en boue | `Sd3li1719` | Magicien | 5 | `systems/add2e/scripts/sorts/transmutation-de-pierre-en-boue.js` | `systems/add2e/scripts/sorts/transmutation-de-pierre-en-boue.js` | `systems/add2e/scripts/sorts/transmutation-de-pierre-en-boue.js` | `scripts/sorts/transmutation-de-pierre-en-boue.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Abaissement des eaux | `Sqozhllak` | Magicien | 6 | `systems/add2e/scripts/sorts/abaissement-des-eaux.js` | `systems/add2e/scripts/sorts/abaissement-des-eaux.js` | `systems/add2e/scripts/sorts/abaissement-des-eaux.js` | `scripts/sorts/abaissement-des-eaux.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Bulle anti-magique | `5WMtm7xIvHpRxLhr` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-bulle-anti-magique.js` | `systems/add2e/scripts/sorts/magicien-bulle-anti-magique.js` | `systems/add2e/scripts/sorts/magicien-bulle-anti-magique.js` | `scripts/sorts/magicien-bulle-anti-magique.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Chasseur invisible | `9nvajLF9dtYWr6aM` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-chasseur-invisible.js` | `systems/add2e/scripts/sorts/magicien-chasseur-invisible.js` | `systems/add2e/scripts/sorts/magicien-chasseur-invisible.js` | `scripts/sorts/magicien-chasseur-invisible.js` | oui | oui | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Contrôle du climat | `S4cpb203e` | Magicien | 6 | `systems/add2e/scripts/sorts/controle-du-climat.js` | `systems/add2e/scripts/sorts/controle-du-climat.js` | `systems/add2e/scripts/sorts/controle-du-climat.js` | `scripts/sorts/controle-du-climat.js` | oui | oui | non | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Désintégration | `EnOSTDnyj7jFMgr0` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-desintegration.js` | `systems/add2e/scripts/sorts/magicien-desintegration.js` | `systems/add2e/scripts/sorts/magicien-desintegration.js` | `scripts/sorts/magicien-desintegration.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Enchantement | `87ete731gVApgoPg` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-enchantement.js` | `systems/add2e/scripts/sorts/magicien-enchantement.js` | `systems/add2e/scripts/sorts/magicien-enchantement.js` | `scripts/sorts/magicien-enchantement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Extension III | `CJf7e3HhnfDKa8yU` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-extension-iii.js` | `systems/add2e/scripts/sorts/magicien-extension-iii.js` | `systems/add2e/scripts/sorts/magicien-extension-iii.js` | `scripts/sorts/magicien-extension-iii.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Glissement de terrain | `HpN7G6ucRp5lTSTw` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-glissement-de-terrain.js` | `systems/add2e/scripts/sorts/magicien-glissement-de-terrain.js` | `systems/add2e/scripts/sorts/magicien-glissement-de-terrain.js` | `scripts/sorts/magicien-glissement-de-terrain.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Globe d’invulnérabilité | `6I5bM9qnrycTKvFM` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-globe-d-invulnerabilite.js` | `systems/add2e/scripts/sorts/magicien-globe-d-invulnerabilite.js` | `systems/add2e/scripts/sorts/magicien-globe-d-invulnerabilite.js` | `scripts/sorts/magicien-globe-d-invulnerabilite.js` | oui | non | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Holographie | `Srso4sdrs` | Magicien | 6 | `systems/add2e/scripts/sorts/holographie.js` | `systems/add2e/scripts/sorts/holographie.js` | `systems/add2e/scripts/sorts/holographie.js` | `scripts/sorts/holographie.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Incantation mortelle | `wCbNKb1p4IKuYZyQ` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-incantation-mortelle.js` | `systems/add2e/scripts/sorts/magicien-incantation-mortelle.js` | `systems/add2e/scripts/sorts/magicien-incantation-mortelle.js` | `scripts/sorts/magicien-incantation-mortelle.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation de monstre IV | `RIc3gsPapbFEJrRO` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-iv.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-iv.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-iv.js` | `scripts/sorts/magicien-invocation-de-monstre-iv.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Main de force de Bigby | `dD4Y9LGSZhXi7HBK` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-main-de-force-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-main-de-force-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-main-de-force-de-bigby.js` | `scripts/sorts/magicien-main-de-force-de-bigby.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mythomancie | `EZOEGGOSPq7gZysz` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-mythomancie.js` | `systems/add2e/scripts/sorts/magicien-mythomancie.js` | `systems/add2e/scripts/sorts/magicien-mythomancie.js` | `scripts/sorts/magicien-mythomancie.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Punition spirituelle | `BB3iG4AMGXwqim5l` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-punition-spirituelle.js` | `systems/add2e/scripts/sorts/magicien-punition-spirituelle.js` | `systems/add2e/scripts/sorts/magicien-punition-spirituelle.js` | `scripts/sorts/magicien-punition-spirituelle.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Quête magique | `pw5HMMNe9CTXYfHL` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-quete-magique.js` | `systems/add2e/scripts/sorts/magicien-quete-magique.js` | `systems/add2e/scripts/sorts/magicien-quete-magique.js` | `scripts/sorts/magicien-quete-magique.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Réincarnation | `Shqdpgv1q` | Magicien | 6 | `systems/add2e/scripts/sorts/reincarnation.js` | `systems/add2e/scripts/sorts/reincarnation.js` | `systems/add2e/scripts/sorts/reincarnation.js` | `scripts/sorts/reincarnation.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | aide_mj_avec_vfx |
| Répulsion | `a6nrRQq6KcoLOCNY` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-repulsion.js` | `systems/add2e/scripts/sorts/magicien-repulsion.js` | `systems/add2e/scripts/sorts/magicien-repulsion.js` | `scripts/sorts/magicien-repulsion.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Séparation des eaux | `Sg4dt4buk` | Magicien | 6 | `systems/add2e/scripts/sorts/separation-des-eaux.js` | `systems/add2e/scripts/sorts/separation-des-eaux.js` | `systems/add2e/scripts/sorts/separation-des-eaux.js` | `scripts/sorts/separation-des-eaux.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Sphère glaciale d’Otiluke | `3VZ2hwpNHAeU7JRp` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-sphere-glaciale-d-otiluke.js` | `systems/add2e/scripts/sorts/magicien-sphere-glaciale-d-otiluke.js` | `systems/add2e/scripts/sorts/magicien-sphere-glaciale-d-otiluke.js` | `scripts/sorts/magicien-sphere-glaciale-d-otiluke.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Transformation de Tenser | `zbAIGNpgVHnYqTSo` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-transformation-de-tenser.js` | `systems/add2e/scripts/sorts/magicien-transformation-de-tenser.js` | `systems/add2e/scripts/sorts/magicien-transformation-de-tenser.js` | `scripts/sorts/magicien-transformation-de-tenser.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Transmutation de pierre en chair | `Rayebc1FcgH7qAzl` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-transmutation-de-pierre-en-chair.js` | `systems/add2e/scripts/sorts/magicien-transmutation-de-pierre-en-chair.js` | `systems/add2e/scripts/sorts/magicien-transmutation-de-pierre-en-chair.js` | `scripts/sorts/magicien-transmutation-de-pierre-en-chair.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Transvision | `099z397bV3y5hUDt` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-transvision.js` | `systems/add2e/scripts/sorts/magicien-transvision.js` | `systems/add2e/scripts/sorts/magicien-transvision.js` | `scripts/sorts/magicien-transvision.js` | oui | oui | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Vigiles et sentinelles | `QBSmwoiVg1fTiVbR` | Magicien | 6 | `systems/add2e/scripts/sorts/magicien-vigiles-et-sentinelles.js` | `systems/add2e/scripts/sorts/magicien-vigiles-et-sentinelles.js` | `systems/add2e/scripts/sorts/magicien-vigiles-et-sentinelles.js` | `scripts/sorts/magicien-vigiles-et-sentinelles.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Boule de feu à retardement | `mV9ra1fRVpnBeCjh` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-boule-de-feu-a-retardement.js` | `systems/add2e/scripts/sorts/magicien-boule-de-feu-a-retardement.js` | `systems/add2e/scripts/sorts/magicien-boule-de-feu-a-retardement.js` | `scripts/sorts/magicien-boule-de-feu-a-retardement.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Cacodémon | `iqIwPvTxcgl4rPbw` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-cacodemon.js` | `systems/add2e/scripts/sorts/magicien-cacodemon.js` | `systems/add2e/scripts/sorts/magicien-cacodemon.js` | `scripts/sorts/magicien-cacodemon.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Charme-plantes | `sH3OXreq75Zw9e9W` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-charme-plantes.js` | `systems/add2e/scripts/sorts/magicien-charme-plantes.js` | `systems/add2e/scripts/sorts/magicien-charme-plantes.js` | `scripts/sorts/magicien-charme-plantes.js` | oui | oui | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Disparition | `m63ZR7K71ZuYpFQW` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-disparition.js` | `systems/add2e/scripts/sorts/magicien-disparition.js` | `systems/add2e/scripts/sorts/magicien-disparition.js` | `scripts/sorts/magicien-disparition.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Duo-dimension | `f8pifdWCFFcLeyvl` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-duo-dimension.js` | `systems/add2e/scripts/sorts/magicien-duo-dimension.js` | `systems/add2e/scripts/sorts/magicien-duo-dimension.js` | `scripts/sorts/magicien-duo-dimension.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Épée de Mordenkainen | `IXG8uzCpQ5qpIsN1` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-epee-de-mordenkainen.js` | `systems/add2e/scripts/sorts/magicien-epee-de-mordenkainen.js` | `systems/add2e/scripts/sorts/magicien-epee-de-mordenkainen.js` | `scripts/sorts/magicien-epee-de-mordenkainen.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Inversion de la gravité | `mzAdqJsIUuesaFZp` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-inversion-de-la-gravite.js` | `systems/add2e/scripts/sorts/magicien-inversion-de-la-gravite.js` | `systems/add2e/scripts/sorts/magicien-inversion-de-la-gravite.js` | `scripts/sorts/magicien-inversion-de-la-gravite.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invisibilité de masse | `JDNcfhvRpMwstMnV` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-invisibilite-de-masse.js` | `systems/add2e/scripts/sorts/magicien-invisibilite-de-masse.js` | `systems/add2e/scripts/sorts/magicien-invisibilite-de-masse.js` | `scripts/sorts/magicien-invisibilite-de-masse.js` | oui | non | oui | illusion | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation de monstre V | `YrbPeiD5D7vKuZga` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-v.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-v.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-v.js` | `scripts/sorts/magicien-invocation-de-monstre-v.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation instantanée de Drawmij | `yrBFmSm59mx7Q7HN` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-invocation-instantanee-de-drawmij.js` | `systems/add2e/scripts/sorts/magicien-invocation-instantanee-de-drawmij.js` | `systems/add2e/scripts/sorts/magicien-invocation-instantanee-de-drawmij.js` | `scripts/sorts/magicien-invocation-instantanee-de-drawmij.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mot de pouvoir : « étourdissement » | `grimbAQpwEflPDvb` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js` | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js` | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js` | `scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Poigne de Bigby | `vvhMZVFLUPBZCsMm` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-poigne-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-poigne-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-poigne-de-bigby.js` | `scripts/sorts/magicien-poigne-de-bigby.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Porte de phase | `RZIlm8nxGzJ4NOgu` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-porte-de-phase.js` | `systems/add2e/scripts/sorts/magicien-porte-de-phase.js` | `systems/add2e/scripts/sorts/magicien-porte-de-phase.js` | `scripts/sorts/magicien-porte-de-phase.js` | oui | non | oui | déplacement | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Simulacre | `TH7LxMtCxwD0LXBC` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-simulacre.js` | `systems/add2e/scripts/sorts/magicien-simulacre.js` | `systems/add2e/scripts/sorts/magicien-simulacre.js` | `scripts/sorts/magicien-simulacre.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Souhait mineur | `JwVX4SDziizeDdWT` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-souhait-mineur.js` | `systems/add2e/scripts/sorts/magicien-souhait-mineur.js` | `systems/add2e/scripts/sorts/magicien-souhait-mineur.js` | `scripts/sorts/magicien-souhait-mineur.js` | oui | non | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Statue | `RasgmaIC4muPvU6s` | Magicien | 7 | `systems/add2e/scripts/sorts/magicien-statue.js` | `systems/add2e/scripts/sorts/magicien-statue.js` | `systems/add2e/scripts/sorts/magicien-statue.js` | `scripts/sorts/magicien-statue.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Antipathie/sympathie | `BIkKCn2RR7NKs0KA` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-antipathie-sympathie.js` | `systems/add2e/scripts/sorts/magicien-antipathie-sympathie.js` | `systems/add2e/scripts/sorts/magicien-antipathie-sympathie.js` | `scripts/sorts/magicien-antipathie-sympathie.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Charme-masse | `mwPBqby6Itm7W7CW` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-charme-masse.js` | `systems/add2e/scripts/sorts/magicien-charme-masse.js` | `systems/add2e/scripts/sorts/magicien-charme-masse.js` | `scripts/sorts/magicien-charme-masse.js` | oui | non | oui | contrôle | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Clone | `Jm1AM0ecAlL7BeiN` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-clone.js` | `systems/add2e/scripts/sorts/magicien-clone.js` | `systems/add2e/scripts/sorts/magicien-clone.js` | `scripts/sorts/magicien-clone.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Cristairain | `R9WN3By99pDgcg4Y` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-cristairain.js` | `systems/add2e/scripts/sorts/magicien-cristairain.js` | `systems/add2e/scripts/sorts/magicien-cristairain.js` | `scripts/sorts/magicien-cristairain.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Danse irrésistible d’Otto | `MCJR3VlxLTfal1Uc` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-danse-irresistible-d-otto.js` | `systems/add2e/scripts/sorts/magicien-danse-irresistible-d-otto.js` | `systems/add2e/scripts/sorts/magicien-danse-irresistible-d-otto.js` | `scripts/sorts/magicien-danse-irresistible-d-otto.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Emprisonnement de l’âme | `3qJwKB09NwuQPJ5T` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-emprisonnement-de-l-ame.js` | `systems/add2e/scripts/sorts/magicien-emprisonnement-de-l-ame.js` | `systems/add2e/scripts/sorts/magicien-emprisonnement-de-l-ame.js` | `scripts/sorts/magicien-emprisonnement-de-l-ame.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Immunité magique de Serten | `XMCoIYELAPOZIT3n` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-immunite-magique-de-serten.js` | `systems/add2e/scripts/sorts/magicien-immunite-magique-de-serten.js` | `systems/add2e/scripts/sorts/magicien-immunite-magique-de-serten.js` | `scripts/sorts/magicien-immunite-magique-de-serten.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation de monstre VI | `QWjB3yW5ZTZsqP51` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-vi.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-vi.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-vi.js` | `scripts/sorts/magicien-invocation-de-monstre-vi.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Labyrinthe | `ORN3az8leSKqVf47` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-labyrinthe.js` | `systems/add2e/scripts/sorts/magicien-labyrinthe.js` | `systems/add2e/scripts/sorts/magicien-labyrinthe.js` | `scripts/sorts/magicien-labyrinthe.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mot de pouvoir : « Cécité » | `6mTt7KT00qtGZmjU` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-cecite.js` | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-cecite.js` | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-cecite.js` | `scripts/sorts/magicien-mot-de-pouvoir-cecite.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Nuage incendiaire | `RXlGxnjPaqWQmINd` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-nuage-incendiaire.js` | `systems/add2e/scripts/sorts/magicien-nuage-incendiaire.js` | `systems/add2e/scripts/sorts/magicien-nuage-incendiaire.js` | `scripts/sorts/magicien-nuage-incendiaire.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Permanence | `BPaga50F4U0MdJmM` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-permanence.js` | `systems/add2e/scripts/sorts/magicien-permanence.js` | `systems/add2e/scripts/sorts/magicien-permanence.js` | `scripts/sorts/magicien-permanence.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Poing de Bigby | `pNKBYV5nREzT4rbP` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-poing-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-poing-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-poing-de-bigby.js` | `scripts/sorts/magicien-poing-de-bigby.js` | oui | oui | oui | dégâts cible | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Protection d’esprit | `vrCUvwu6dEY2mQpa` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-protection-d-esprit.js` | `systems/add2e/scripts/sorts/magicien-protection-d-esprit.js` | `systems/add2e/scripts/sorts/magicien-protection-d-esprit.js` | `scripts/sorts/magicien-protection-d-esprit.js` | oui | non | oui | protection | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Symbole | `Sgvc3uuqk` | Magicien | 8 | `systems/add2e/scripts/sorts/symbole.js` | `systems/add2e/scripts/sorts/symbole.js` | `systems/add2e/scripts/sorts/symbole.js` | `scripts/sorts/symbole.js` | oui | oui | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Transformation d’objets | `6SpRQBy7sR53Ptsm` | Magicien | 8 | `systems/add2e/scripts/sorts/magicien-transformation-d-objets.js` | `systems/add2e/scripts/sorts/magicien-transformation-d-objets.js` | `systems/add2e/scripts/sorts/magicien-transformation-d-objets.js` | `scripts/sorts/magicien-transformation-d-objets.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Arrêt du temps | `tWKvW4ahVQ2ANiFR` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-arret-du-temps.js` | `systems/add2e/scripts/sorts/magicien-arret-du-temps.js` | `systems/add2e/scripts/sorts/magicien-arret-du-temps.js` | `scripts/sorts/magicien-arret-du-temps.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Emprisonnement | `iykW82ri4ir2kJbY` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-emprisonnement.js` | `systems/add2e/scripts/sorts/magicien-emprisonnement.js` | `systems/add2e/scripts/sorts/magicien-emprisonnement.js` | `scripts/sorts/magicien-emprisonnement.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Hétéromorphisme | `SaSj5P1VI9svAYyC` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-heteromorphisme.js` | `systems/add2e/scripts/sorts/magicien-heteromorphisme.js` | `systems/add2e/scripts/sorts/magicien-heteromorphisme.js` | `scripts/sorts/magicien-heteromorphisme.js` | oui | oui | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Invocation de Monstre VII | `ahm7oemgFvV85Lkp` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-vii.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-vii.js` | `systems/add2e/scripts/sorts/magicien-invocation-de-monstre-vii.js` | `scripts/sorts/magicien-invocation-de-monstre-vii.js` | oui | non | oui | invocation | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Main broyante de Bigby | `pDjjfXthimcJF8L7` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-main-broyante-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-main-broyante-de-bigby.js` | `systems/add2e/scripts/sorts/magicien-main-broyante-de-bigby.js` | `scripts/sorts/magicien-main-broyante-de-bigby.js` | oui | oui | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Mot de pouvoir : « mort » | `4WhGYPz6t6SX2ImV` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-mort.js` | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-mort.js` | `systems/add2e/scripts/sorts/magicien-mot-de-pouvoir-mort.js` | `scripts/sorts/magicien-mot-de-pouvoir-mort.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Nuée de météores | `lbCWMQBWvtqGvi65` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-nuee-de-meteores.js` | `systems/add2e/scripts/sorts/magicien-nuee-de-meteores.js` | `systems/add2e/scripts/sorts/magicien-nuee-de-meteores.js` | `scripts/sorts/magicien-nuee-de-meteores.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Seuil | `MmczinwlejcFyrC0` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-seuil.js` | `systems/add2e/scripts/sorts/magicien-seuil.js` | `systems/add2e/scripts/sorts/magicien-seuil.js` | `scripts/sorts/magicien-seuil.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Sort astral | `S3uv2zi0o` | Magicien | 9 | `systems/add2e/scripts/sorts/sort-astral.js` | `systems/add2e/scripts/sorts/sort-astral.js` | `systems/add2e/scripts/sorts/sort-astral.js` | `scripts/sorts/sort-astral.js` | oui | non | non | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | oui | corriger |
| Souhait majeur | `9Uvnif7ea2lFaGpn` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-souhait-majeur.js` | `systems/add2e/scripts/sorts/magicien-souhait-majeur.js` | `systems/add2e/scripts/sorts/magicien-souhait-majeur.js` | `scripts/sorts/magicien-souhait-majeur.js` | oui | non | oui | aide MJ nécessaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Sphère prismatique | `UNXXLQYQfLs7yKMJ` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-sphere-prismatique.js` | `systems/add2e/scripts/sorts/magicien-sphere-prismatique.js` | `systems/add2e/scripts/sorts/magicien-sphere-prismatique.js` | `scripts/sorts/magicien-sphere-prismatique.js` | oui | non | oui | dégâts zone | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |
| Stase temporelle | `T61EpbWgHCtr2BRH` | Magicien | 9 | `systems/add2e/scripts/sorts/magicien-stase-temporelle.js` | `systems/add2e/scripts/sorts/magicien-stase-temporelle.js` | `systems/add2e/scripts/sorts/magicien-stase-temporelle.js` | `scripts/sorts/magicien-stase-temporelle.js` | oui | non | oui | utilitaire | t=>t==='dégâts cible'?'VFX projectile lanceur vers cible':t==='dégâts zone'?'VFX de zone':t==='soin'||t==='protection'?'VFX sur cible':t==='contrôle'?'VFX sur cible':t==='divination'||t==='aide MJ nécessaire'?'VFX rituel/divination autour du lanceur':t==='illusion'?'VFX illusion':t==='invocation'?'VFX persistant':t==='déplacement'?'VFX sur le lanceur':'VFX sur le lanceur' | non | corriger |

## Contraintes des futurs travaux

- Compatibilité Foundry V13/V14/V15.
- DialogV2 obligatoire pour toute fenêtre de choix ou confirmation.
- ApplicationV2 uniquement pour une fenêtre persistante.
- Aucun Dialog legacy, `new Dialog`, `Dialog.prompt` ou fallback legacy.
- Aucun effet inventé si la règle n’est pas claire ; préférer une aide MJ avec VFX.
- Chaque onUse doit retourner `false` si annulé ou non consommé et `true` si lancé et consommé.
- Chaque futur onUse doit avoir un effet visuel.
