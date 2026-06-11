# Audit global des onUse des sorts PHB

## Périmètre et méthode

Audit statique des **411** Items PHB de `fvtt-spells-all.json`, croisés par `foundry.id` avec les références et par chemin avec `scripts/sorts/`. Aucun script n’a été exécuté ni modifié.

Détection VFX heuristique : présence de marqueurs `Sequence`, `Sequencer`, `.effect(...)`, `canvas`, animation, sprite, particule ou vidéo. L’absence de marqueur signifie « aucun VFX détectable statiquement », pas une preuve d’absence visuelle en jeu. La stratégie `automatisation_complete` n’est attribuée à aucun sort par audit statique seul.

## Résumé

- Sorts PHB analysés : **411**
- onUse existants raccordés : **385**
- onUse manquants ou chemin sans script : **26**
- Scripts JavaScript présents dans `scripts/sorts/` : **515**
- Scripts orphelins : **145**
- Scripts historiques liés à des doublons/suppressions : **7**
- Scripts à corriger (sorts raccordés classés `corriger`) : **305**
- Scripts legacy Dialog détectés : **420**
- Scripts sans contrat clair `return true` et `return false` : **5**
- Scripts raccordés sans VFX détectable : **325**
- Descriptions présentes : **403/411**

## Lots déjà validés

- Clerc niveau 1 : **12** sorts identifiés comme lot validé ; recommandation par défaut : conserver, sauf anomalie critique détectée.
- Dégâts Magicien niveau 1 : **3** sorts identifiés (Mains brûlantes, Poigne électrique, Projectile magique) ; recommandation par défaut : conserver, sauf anomalie critique détectée.

## Stratégies proposées

| Stratégie | Nombre |
|---|---:|
| aide_mj_avec_vfx | 57 |
| automatisation_partielle | 13 |
| conserver | 10 |
| corriger | 305 |
| créer | 26 |

## Scripts legacy Dialog

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

## Scripts sans retour booléen clair

- `scripts/sorts/comprehension_langue.js`
- `scripts/sorts/detection_invisibilite.js`
- `scripts/sorts/esp.js`
- `scripts/sorts/invisibilite.js`
- `scripts/sorts/tenser.js`

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

## Scripts historiques liés à des doublons supprimés

- `scripts/sorts/batons-en-serpents.js`
- `scripts/sorts/localisation-d-un-objet.js`
- `scripts/sorts/magicien-chien-fidele-de-mordekainen.js`
- `scripts/sorts/missile_magique.js`
- `scripts/sorts/protection-contre-le-mal-rayon-de-10-pieds.js`
- `scripts/sorts/purification-de-la-nourriture-et-de-la-boisson.js`
- `scripts/sorts/soins-des-blessures-legeres.js`

## Scripts raccordés sans VFX détectable

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

## Priorités immédiates

| Sort | Classe | Niveau | Script | Motif |
|---|---|---:|---|---|
| Abaissement des Eaux | Clerc | 4 | `scripts/sorts/abaissement-des-eaux.js` | Dialog legacy; VFX absent |
| Agrandissement | Magicien | 1 | `scripts/sorts/magicien-agrandissement.js` | Dialog legacy; VFX absent |
| Allométamorphose | Magicien | 4 | `scripts/sorts/magicien-allometamorphose.js` | Dialog legacy; VFX absent |
| Altération de la réalité | Illusionniste | 7 | `scripts/sorts/illusionniste-alteration-de-la-realite.js` | Dialog legacy; VFX absent |
| Amitié animale | Druide | 1 | `scripts/sorts/druide-amitie-animale.js` | Dialog legacy; VFX absent |
| Animation de la roche | Druide | 7 | `scripts/sorts/druide-animation-de-la-roche.js` | Dialog legacy;  |
| Antipathie/sympathie | Magicien | 8 | `scripts/sorts/magicien-antipathie-sympathie.js` | Dialog legacy; VFX absent |
| Arbre | Druide | 3 | `scripts/sorts/druide-arbre.js` | Dialog legacy; VFX absent |
| Arme enchantée | Magicien | 4 | `scripts/sorts/magicien-arme-enchantee.js` | Dialog legacy; VFX absent |
| Arrêt du temps | Magicien | 9 | `scripts/sorts/magicien-arret-du-temps.js` | Dialog legacy; VFX absent |
| Augure | Clerc | 2 | `scripts/sorts/augure.js` | Dialog legacy; VFX absent |
| Aura féérique | Druide | 1 | `scripts/sorts/druide-aura-feerique.js` | Dialog legacy; VFX absent |
| Autométamorphose | Magicien | 4 | `scripts/sorts/magicien-autometamorphose.js` | Dialog legacy; VFX absent |
| Bâtons à serpents | Druide | 5 | `scripts/sorts/druide-batons-a-serpents.js` | Dialog legacy; VFX absent |
| Bénédiction | Clerc | 1 | `scripts/sorts/benediction.js` | Dialog legacy;  |
| Bouche magique | Illusionniste | 2 | `scripts/sorts/illusionniste-bouche-magique.js` | Dialog legacy; VFX absent |
| Bouclier anti-animal | Druide | 6 | `scripts/sorts/druide-bouclier-anti-animal.js` | Dialog legacy; VFX absent |
| Bouclier anti-plantes | Druide | 5 | `scripts/sorts/druide-bouclier-anti-plantes.js` | Dialog legacy; VFX absent |
| Bouclier de feu | Magicien | 4 | `scripts/sorts/magicien-bouclier-de-feu.js` | Dialog legacy; VFX absent |
| Boule de feu à retardement | Magicien | 7 | `scripts/sorts/magicien-boule-de-feu-a-retardement.js` | Dialog legacy; VFX absent |
| Bruitage | Illusionniste | 1 | `scripts/sorts/illusionniste-bruitage.js` | Dialog legacy; VFX absent |
| Bulle anti-magique | Magicien | 6 | `scripts/sorts/magicien-bulle-anti-magique.js` | Dialog legacy; VFX absent |
| Cacodémon | Magicien | 7 | `scripts/sorts/magicien-cacodemon.js` | Dialog legacy; VFX absent |
| Cantique | Clerc | 2 | `scripts/sorts/cantique.js` | Dialog legacy; VFX absent |
| Catalepsie | Druide | 2 | `scripts/sorts/druide-catalepsie.js` | Dialog legacy; VFX absent |
| Cécité | Illusionniste | 2 | `scripts/sorts/illusionniste-cecite.js` | Dialog legacy; VFX absent |
| Changement d’apparence | Illusionniste | 1 | `scripts/sorts/illusionniste-changement-d-apparence.js` | Dialog legacy; VFX absent |
| Chaos | Illusionniste | 5 | `scripts/sorts/illusionniste-chaos.js` | Dialog legacy; VFX absent |
| Chariot de Sustarre | Druide | 7 | `scripts/sorts/druide-chariot-de-sustarre.js` | Dialog legacy; VFX absent |
| Charme-masse | Magicien | 8 | `scripts/sorts/magicien-charme-masse.js` | Dialog legacy; VFX absent |
| Charme-monstres | Magicien | 4 | `scripts/sorts/magicien-charme-monstres.js` | Dialog legacy; VFX absent |
| Charme-personnes ou mammifères | Druide | 2 | `scripts/sorts/druide-charme-personnes-ou-mammiferes.js` | Dialog legacy; VFX absent |
| Charme-plantes | Magicien | 7 | `scripts/sorts/magicien-charme-plantes.js` | Dialog legacy; VFX absent |
| Charme-Serpents | Clerc | 2 | `scripts/sorts/charme-serpents.js` | Dialog legacy; VFX absent |
| Chasseur invisible | Magicien | 6 | `scripts/sorts/magicien-chasseur-invisible.js` | Dialog legacy; VFX absent |
| Chaumière de Léomund | Magicien | 3 | `scripts/sorts/magicien-chaumiere-de-leomund.js` | Dialog legacy; VFX absent |
| Chute de plume | Magicien | 1 | `scripts/sorts/magicien-chute-de-plume.js` | Dialog legacy; VFX absent |
| Clairaudience | Magicien | 3 | `scripts/sorts/magicien-clairaudience.js` | Dialog legacy; VFX absent |
| Clairvoyance | Magicien | 3 | `scripts/sorts/magicien-clairvoyance.js` | Dialog legacy; VFX absent |
| Clone | Magicien | 8 | `scripts/sorts/magicien-clone.js` | Dialog legacy; VFX absent |

## Ordre de traitement proposé

1. Corriger les scripts raccordés utilisant Dialog legacy, en priorité hors lots déjà validés.
2. Corriger les scripts raccordés sans contrat explicite `false` à l’annulation et `true` à la consommation.
3. Créer les onUse manquants, lot par lot : Clerc, Druide, Magicien, puis Illusionniste, par niveau croissant.
4. Ajouter un VFX à chaque futur onUse et aux scripts raccordés sans VFX, sans inventer de mécanique ; utiliser une aide MJ DialogV2 lorsque l’automatisation fiable est impossible.
5. Auditer les orphelins et supprimer uniquement dans une tâche distincte après confirmation de leur caractère historique.

## Synthèse par lot

| Lot | Sorts | Raccordés | Manquants | Corriger | Sans VFX |
|---|---:|---:|---:|---:|---:|
| Clerc niveau 1 | 12 | 12 | 0 | 5 | 2 |
| Clerc niveau 2 | 12 | 12 | 0 | 11 | 12 |
| Clerc niveau 3 | 12 | 12 | 0 | 10 | 2 |
| Clerc niveau 4 | 10 | 10 | 0 | 6 | 10 |
| Clerc niveau 5 | 10 | 2 | 8 | 2 | 0 |
| Clerc niveau 6 | 10 | 1 | 9 | 1 | 0 |
| Clerc niveau 7 | 10 | 1 | 9 | 1 | 0 |
| Druide niveau 1 | 12 | 12 | 0 | 10 | 12 |
| Druide niveau 2 | 12 | 12 | 0 | 8 | 12 |
| Druide niveau 3 | 12 | 12 | 0 | 9 | 10 |
| Druide niveau 4 | 12 | 12 | 0 | 7 | 11 |
| Druide niveau 5 | 10 | 10 | 0 | 7 | 10 |
| Druide niveau 6 | 10 | 10 | 0 | 5 | 10 |
| Druide niveau 7 | 10 | 10 | 0 | 7 | 8 |
| Illusionniste niveau 1 | 11 | 11 | 0 | 10 | 10 |
| Illusionniste niveau 2 | 12 | 12 | 0 | 11 | 11 |
| Illusionniste niveau 3 | 12 | 12 | 0 | 8 | 12 |
| Illusionniste niveau 4 | 8 | 8 | 0 | 7 | 8 |
| Illusionniste niveau 5 | 8 | 8 | 0 | 7 | 8 |
| Illusionniste niveau 6 | 8 | 8 | 0 | 8 | 8 |
| Illusionniste niveau 7 | 6 | 6 | 0 | 6 | 5 |
| Magicien niveau 1 | 29 | 29 | 0 | 19 | 21 |
| Magicien niveau 2 | 23 | 23 | 0 | 14 | 17 |
| Magicien niveau 3 | 24 | 24 | 0 | 18 | 20 |
| Magicien niveau 4 | 24 | 24 | 0 | 21 | 24 |
| Magicien niveau 5 | 24 | 24 | 0 | 21 | 23 |
| Magicien niveau 6 | 24 | 24 | 0 | 22 | 22 |
| Magicien niveau 7 | 16 | 16 | 0 | 16 | 16 |
| Magicien niveau 8 | 16 | 16 | 0 | 16 | 15 |
| Magicien niveau 9 | 12 | 12 | 0 | 12 | 11 |

## Inventaire des 411 sorts

| Sort | ID | Classe | Niv. | onUse / chemin attendu | Script | École/type de référence | Composants matériels | Description | VFX | Stratégie |
|---|---|---|---:|---|---|---|---|---|---|---|
| Apaisement | `XQgdghDowrDCCQ1b` | Clerc | 1 | `scripts/sorts/apaisement.js` | oui | Abjuration | aucun | oui | oui | conserver |
| Aquagenèse | `NxItV2LPH4Cbl5I2` | Clerc | 1 | `scripts/sorts/creation-d-eau.js` | oui | Altération | goutte d’eau, pincée de poussière | oui | oui | conserver |
| Bénédiction | `u1L6JpAXZ113qpVG` | Clerc | 1 | `scripts/sorts/benediction.js` | oui | Conjuration/Appel | aucun | oui | oui | corriger |
| Détection de la magie | `Sxt9iofe7` | Clerc | 1 | `scripts/sorts/detection-de-la-magie.js` | oui | Divination | aucun | oui | oui | corriger |
| Détection du mal | `yAqsU5sPfwAfnzKI` | Clerc | 1 | `scripts/sorts/detection-du-mal.js` | oui | Divination | aucun | oui | oui | conserver |
| Injonction | `3U2YJApOJHhpPi36` | Clerc | 1 | `scripts/sorts/injonction.js` | oui | Enchantement/Charme | aucun | oui | oui | conserver |
| Lumière | `Sdlz5sn18` | Clerc | 1 | `scripts/sorts/lumiere.js` | oui | Altération | aucun | oui | oui | conserver |
| Protection contre le Mal | `TqhVMP92bVsGe1Ze` | Clerc | 1 | `scripts/sorts/protection-contre-le-mal.js` | oui | Abjuration | aucun | oui | oui | corriger |
| Purification de l'eau et des aliments | `Smrpqu7x2` | Clerc | 1 | `scripts/sorts/purification-de-leau-et-des-aliments.js` | oui | Altération | aucun | oui | non | conserver |
| Résistance au Froid | `2eIiTt870xCg5cX2` | Clerc | 1 | `scripts/sorts/resistance-au-froid.js` | oui | Altération | pincée de souffre | oui | non | conserver |
| Sanctuaire | `vKWHLf1xrjZNtMdr` | Clerc | 1 | `scripts/sorts/sanctuaire.js` | oui | Abjuration | symbole sacré du clerc, petit miroir en argent | oui | oui | corriger |
| Soins mineurs | `Sxchr11u6` | Clerc | 1 | `scripts/sorts/soins-mineurs.js` | oui | Nécromancie | aucun | oui | oui | corriger |
| Augure | `Rs2UXeoGOPw95lTa` | Clerc | 2 | `scripts/sorts/augure.js` | oui | Divination | jeu de baguettes serties de gemmes, os de dragon, objets divinatoires similaires, feuilles d’infusion encore humides, perle écrasée d’au moins 100 po | oui | non | corriger |
| Cantique | `wdtkfJYwuk9dsqR1` | Clerc | 2 | `scripts/sorts/cantique.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Charme-Serpents | `tp59YPoHeXjNe6Ym` | Clerc | 2 | `scripts/sorts/charme-serpents.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Détection des Charmes | `QIQwPiiJp7G4g4g7` | Clerc | 2 | `scripts/sorts/detection-des-charmes.js` | oui | Divination | aucun | oui | non | corriger |
| Détection des Pièges | `Wy1dn4BiE0hw8Llu` | Clerc | 2 | `scripts/sorts/detection-des-pieges.js` | oui | Divination | aucun | oui | non | corriger |
| Langage animal | `vhPECKdSgNgk4KaP` | Clerc | 2 | `scripts/sorts/langage-des-animaux.js` | oui | Altération | aucun | oui | non | corriger |
| Marteau Spirituel | `6izVz4iVr2hKNNRQ` | Clerc | 2 | `scripts/sorts/marteau-spirituel.js` | oui | Invocation | marteau de guerre normal | oui | non | corriger |
| Paralysie | `Syawg1fas` | Clerc | 2 | `scripts/sorts/paralysie.js` | oui | Enchantement/Charme | petite tige de métal droite et rigide | oui | non | aide_mj_avec_vfx |
| Perception des Alignements | `hZHuARHUGpOY5PvR` | Clerc | 2 | `scripts/sorts/connaissance-des-alignements.js` | oui | Divination | aucun | oui | non | corriger |
| Résistance au feu | `7zHxP5ZI6iLBpdla` | Clerc | 2 | `scripts/sorts/resistance-au-feu-resistance-au-froid.js` | oui | Altération | goutte de mercure | oui | non | corriger |
| Retardement du Poison | `Z6nSdRcOjfcEapru` | Clerc | 2 | `scripts/sorts/ralentissement-du-poison.js` | oui | Nécromancie | symbole sacré, gousse d’ail | oui | non | corriger |
| Silence sur 5 mètres | `NYOXmMomYixpF5pS` | Clerc | 2 | `scripts/sorts/silence-rayon-de-15-pieds.js` | oui | Altération | aucun | oui | non | corriger |
| Catalepsie | `Sa3zkx6mz` | Clerc | 3 | `scripts/sorts/catalepsie.js` | oui | Nécromancie | pincée de poussière d’un cimetière, symbole sacré du clerc | oui | non | aide_mj_avec_vfx |
| Désenvoûtement | `D4M1z3FJEUq8qUZN` | Clerc | 3 | `scripts/sorts/delivrance-de-la-malediction.js` | oui | Abjuration | aucun | oui | oui | corriger |
| Dissipation de la Magie | `XEcAG3l135UrSgp1` | Clerc | 3 | `scripts/sorts/dissipation-de-la-magie.js` | oui | Abjuration | aucun | oui | oui | corriger |
| Glyphe de Garde | `upRGuCu26UmMcTaN` | Clerc | 3 | `scripts/sorts/glyphe-de-garde.js` | oui | Abjuration/Évocation | encens, poudre d’un diamant d’au moins 2 000 po | oui | oui | corriger |
| Guérison de la Cécité | `WS0WlZcSPXN3BzVj` | Clerc | 3 | `scripts/sorts/guerison-de-la-cecite-ou-de-la-surdite.js` | oui | Abjuration | aucun | oui | oui | corriger |
| Guérison des Maladies | `YCzH60fklmXZm4NG` | Clerc | 3 | `scripts/sorts/guerison-des-maladies.js` | oui | Abjuration | aucun | oui | oui | corriger |
| Localisation d'objets | `Sj06p4tw4` | Clerc | 3 | `scripts/sorts/localisation-dobjets.js` | oui | Divination | pierre aimantée | oui | non | aide_mj_avec_vfx |
| Lumière éternelle | `MOvZkfwTwOmPaoo6` | Clerc | 3 | `scripts/sorts/lumiere-continuelle.js` | oui | Altération | aucun | oui | oui | corriger |
| Manne | `mKVH2qdZQt1lTD7R` | Clerc | 3 | `scripts/sorts/creation-de-nourriture-et-d-eau.js` | oui | Altération | aucun | oui | oui | corriger |
| Nécro animation | `J03xF2w0p1eUArSJ` | Clerc | 3 | `scripts/sorts/animation-des-morts.js` | oui | Nécromancie | goutte de sang, morceau de chair humaine, pincée d’os en poudre, écharde d’os | oui | oui | corriger |
| Nécromancie | `Q2bKJDwPnQ49figr` | Clerc | 3 | `scripts/sorts/communication-avec-les-morts.js` | oui | Nécromancie | symbole sacré du clerc, encens | oui | oui | corriger |
| Prière | `OY8n4w7N4Vw06Gz0` | Clerc | 3 | `scripts/sorts/priere.js` | oui | Conjuration/Appel | symbole religieux en argent, chapelet de prière, objet similaire ayant la même utilisation | oui | oui | corriger |
| Abaissement des Eaux | `2u7CQtfpQUqiKKMi` | Clerc | 4 | `scripts/sorts/abaissement-des-eaux.js` | oui | Altération | symbole sacré du clerc, pincée de poussière | oui | non | corriger |
| Bâtons à serpents | `S30nizlne` | Clerc | 4 | `scripts/sorts/batons-a-serpents.js` | oui | Altération | petit morceau d’écorce, écailles de serpent | oui | non | aide_mj_avec_vfx |
| Contre-poison | `Sjiuuls8d` | Clerc | 4 | `scripts/sorts/contre-poison.js` | oui | Altération | aucun | oui | non | aide_mj_avec_vfx |
| Détection des Mensonges | `dgAqjED194Zh2Fsx` | Clerc | 4 | `scripts/sorts/detection-des-mensonges.js` | oui | Divination | aucun | oui | non | corriger |
| Divination | `Ioq0hTYTNqY25yTp` | Clerc | 4 | `scripts/sorts/divination.js` | oui | Divination | petite créature, encens, symbole sacré du clerc, pierres précieuses, objets magiques | oui | non | corriger |
| Exorcisme | `VzYlAqxdcGsXjLUx` | Clerc | 4 | `scripts/sorts/exorcisme.js` | oui | Abjuration | aucun | oui | non | corriger |
| Langage des Plantes | `NB7cY2JkIVWpAJxi` | Clerc | 4 | `scripts/sorts/langage-des-plantes.js` | oui | Altération | goutte d’eau, pincée de bouse, flamme | oui | non | corriger |
| Langue | `Sa1v4ptqy` | Clerc | 4 | `scripts/sorts/langue.js` | oui | Altération | aucun | non | non | aide_mj_avec_vfx |
| Protection contre le mal sur 3 m | `Stbgz8i1o` | Clerc | 4 | `scripts/sorts/protection-contre-le-mal-sur-3-m.js` | oui | Abjuration | aucun | non | non | aide_mj_avec_vfx |
| Soins Majeurs | `BC3xSS1IBBosglWX` | Clerc | 4 | `scripts/sorts/soins-des-blessures-graves.js` | oui | Nécromancie | aucun | oui | non | corriger |
| Changement de Plan | `ArNVRD6NMCcfJVO8` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/changement-de-plan.js` | non | Altération | petite baguette fourchue métallique, sorte de diapason | oui | non | créer |
| Communion | `f0xvzPjR5eql4RnX` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/communion.js` | non | Divination | symbole sacré du clerc, eau bénite, encens | oui | non | créer |
| Dissipation du Mal | `8xjaHEHQJH38zT5v` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/dissipation-du-mal.js` | non | Abjuration | symbole sacré du clerc, eau bénite, eau maudite | oui | non | créer |
| Expiation | `a0RDLD25YSALcpQ3` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/penitence.js` | non | Abjuration | symbole sacré du clerc, chapelet, livre de prière, encens | oui | non | créer |
| Fléau d’Insectes | `agSJJopB3wVJ7JnL` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/fleau-d-insectes.js` | non | Conjuration/Appel | grains de sucre, amandes, matière grasse | oui | non | créer |
| Pilier de Feu | `JIVPA8sAdvSA48F3` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/colonne-de-feu.js` | non | Évocation | pincée de souffre | oui | non | créer |
| Quête Religieuse | `LEjrYHsqdLZt9u9z` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/quete-religieuse.js` | non | Enchantement/Charme | aucun | oui | non | créer |
| Rappel à la Vie | `BDlrjtmEtCW6VeM3` | Clerc | 5 | `scripts/sorts/clerc-niveaux-5-6-7/rappel-a-la-vie.js` | non | Nécromancie | aucun | oui | non | créer |
| Soin ultime | `Sq1tl2rnm` | Clerc | 5 | `scripts/sorts/soin-ultime.js` | oui | Nécromancie | aucun | oui | oui | corriger |
| Vision réelle | `Sg8vv5wrq` | Clerc | 5 | `scripts/sorts/vision-reelle.js` | oui | Divination | crème pour les yeux faite de poudre de champignons très rares, de safran et de graisse, crème faite d’huile, de poudre de pavot et d’essence d’orchidée rose | oui | oui | corriger |
| Animation des objets | `YhKHovBxDFPT3zjD` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/animation-d-un-objet.js` | non | Altération | aucun | oui | non | créer |
| Barrière de Lames | `NfojDpSSWss8K7ox` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/barriere-de-lames.js` | non | Évocation | aucun | oui | non | créer |
| Guérison | `oSfALhtUqR6esjsF` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/guerison.js` | non | Nécromancie | aucun | oui | non | créer |
| Invocation des animaux | `Sh66nk11o` | Clerc | 6 | `scripts/sorts/invocation-des-animaux.js` | oui | Conjuration/Appel | aucun | oui | oui | corriger |
| Langage des Monstres | `E3sn9oDE2jRcng5n` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/langage-des-monstres.js` | non | Altération | aucun | oui | non | créer |
| Lithomancie | `zZvMkZh0eT9iXbOV` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/pierres-parlantes.js` | non | Divination | aucun | oui | non | créer |
| Orientation | `lTY0W2UcSICDXAIu` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/orientation.js` | non | Divination | jeu d’objets divinatoires en os ou en ivoire, sous forme de bâtonnets ou de runes gravées | oui | non | créer |
| Rappel | `ojEuPap5qVulUg4p` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/mot-de-rappel.js` | non | Altération | aucun | oui | non | créer |
| Séparation des Eaux | `Ao2pXwVBoC7v1AcZ` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/separation-des-eaux.js` | non | Altération | symbole sacré du clerc | oui | non | créer |
| Serviteur Aérien | `vq8X8DO5iO7LIWJx` | Clerc | 6 | `scripts/sorts/clerc-niveaux-5-6-7/serviteur-aerien.js` | non | Conjuration/Appel | aucun | oui | non | créer |
| Contrôle du Climat | `PSUPfcabfhbrxWG1` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/controle-du-climat.js` | non | Évocation - Altération | symbole sacré du clerc, chapelet de prière, objet similaire au chapelet de prière | oui | non | créer |
| Marche des vents | `0vew4Dsadk48WK8X` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/marche-sur-le-vent.js` | non | Altération | aucun | oui | non | créer |
| Parole sacrée/maudite | `faa1xkvCpaxj8mzy` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/parole-sacree.js` | non | Conjuration/Appel | aucun | oui | non | créer |
| Régénération | `wTY2BA9kkcAc3IJu` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/regeneration.js` | non | Nécromancie | objet de prière, eau bénite, eau maudite | oui | non | créer |
| Restauration | `KV9j89SM2tko3iDL` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/restauration.js` | non | Nécromancie | aucun | oui | non | créer |
| Résurrection | `x3fOxKCADgNdvfyU` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/resurrection.js` | non | Nécromancie | symbole sacré du clerc, eau bénite, eau maudite | oui | non | créer |
| Seuil | `Shi1vnnug` | Clerc | 7 | `scripts/sorts/seuil.js` | oui | Conjuration/Appel | aucun | oui | oui | corriger |
| Sort Astral | `4Aaby7ywbSbUbzLG` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/sort-astral.js` | non | Altération | aucun | oui | non | créer |
| Symbole | `edocrNiNW6x6TWX1` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/symbole.js` | non | Conjuration/Appel | mercure, phosphore | oui | non | créer |
| Tremblement de Terre | `ruWwPBZl56IRcqt2` | Clerc | 7 | `scripts/sorts/clerc-niveaux-5-6-7/tremblement-de-terre.js` | non | Altération | pincée de poussière, petit caillou, motte de terre | oui | non | créer |
| Amitié animale | `ilgf9I5cZPQitFJy` | Druide | 1 | `scripts/sorts/druide-amitie-animale.js` | oui | Conjuration/Appel | du gui et un peu de nourriture appréciée par l’animal | oui | non | corriger |
| Aura féérique | `FPCcOTwEZM4FB4AG` | Druide | 1 | `scripts/sorts/druide-aura-feerique.js` | oui | Illusion/Enchantement | aucun | oui | non | corriger |
| Détection de la magie | `7rYWVSj9qG6J4CgE` | Druide | 1 | `scripts/sorts/druide-detection-de-la-magie.js` | oui | Divination | aucun | oui | non | corriger |
| Détection des pièges sylvestres | `gb1VJgkDBmpxHRqW` | Druide | 1 | `scripts/sorts/druide-detection-des-pieges-sylvestres.js` | oui | Divination | aucun | oui | non | corriger |
| Enchevêtrement | `gchPPB6o9UcwOWO4` | Druide | 1 | `scripts/sorts/druide-enchevetrement.js` | oui | Altération | aucun | oui | non | aide_mj_avec_vfx |
| Invisibilité aux animaux | `wGAk7UDQiD8culJ2` | Druide | 1 | `scripts/sorts/druide-invisibilite-aux-animaux.js` | oui | Altération | du houx avec lequel le druide doit se frotter | oui | non | aide_mj_avec_vfx |
| Langage animal | `jtVmvY0cNNKzc8sw` | Druide | 1 | `scripts/sorts/druide-langage-animal.js` | oui | Divination | aucun | oui | non | corriger |
| Localisation des animaux | `AzUlTx8pPfOqZS2Q` | Druide | 1 | `scripts/sorts/druide-localisation-des-animaux.js` | oui | Divination | aucun | oui | non | corriger |
| Passage sans trace | `ny1kTEpQBJdwExzN` | Druide | 1 | `scripts/sorts/druide-passage-sans-trace.js` | oui | Altération | feuille de gui, aiguille de pin ou d’un autre conifère | oui | non | corriger |
| Prévision du temps | `evIx4b26WpJLeXyT` | Druide | 1 | `scripts/sorts/druide-prevision-du-temps.js` | oui | Divination | aucun | oui | non | corriger |
| Purification de l'eau | `qWQgy9OIassdDWDQ` | Druide | 1 | `scripts/sorts/druide-purification-de-l-eau.js` | oui | Altération | aucun | oui | non | corriger |
| Shillelagh | `XbRgfyOQelhZ1LvY` | Druide | 1 | `scripts/sorts/druide-shillelagh.js` | oui | Altération | massue en chêne, gui, feuille de trèfle | oui | non | corriger |
| Aquagenèse | `Scjl76ai5` | Druide | 2 | `scripts/sorts/aquagenese.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Catalepsie | `sRd64Nw20WZ1cSFk` | Druide | 2 | `scripts/sorts/druide-catalepsie.js` | oui | Altération | une feuille morte de chêne et du gui | oui | non | corriger |
| Charme-personnes ou mammifères | `A5ByNdQ49OPXdHGs` | Druide | 2 | `scripts/sorts/druide-charme-personnes-ou-mammiferes.js` | oui | Altération | aucun | oui | non | corriger |
| Croc-en-jambe | `j5rfK0nQ9OfvVRP0` | Druide | 2 | `scripts/sorts/druide-croc-en-jambe.js` | oui | Altération | aucun | oui | non | corriger |
| Distorsion du bois | `VGjbP8bf6jxpaH2r` | Druide | 2 | `scripts/sorts/druide-distorsion-du-bois.js` | oui | Altération | aucun | oui | non | aide_mj_avec_vfx |
| Flamme | `bGozecWB2h2bzLHW` | Druide | 2 | `scripts/sorts/druide-flamme.js` | oui | Évocation | aucun | oui | non | aide_mj_avec_vfx |
| Localisation des plantes | `u9Y1HnfaWsDkiH2j` | Druide | 2 | `scripts/sorts/druide-localisation-des-plantes.js` | oui | Divination | aucun | oui | non | corriger |
| Métal brûlant | `N7TTlafX2FuoYgAD` | Druide | 2 | `scripts/sorts/druide-metal-brulant.js` | oui | Altération | aucun | oui | non | corriger |
| Obscurcissement | `NU1wGTCbnOH6Oz1H` | Druide | 2 | `scripts/sorts/druide-obscurcissement.js` | oui | Altération | aucun | oui | non | corriger |
| Peau d'écorce | `RA3FoJdMhOl9lLSY` | Druide | 2 | `scripts/sorts/druide-peau-d-ecorce.js` | oui | Altération | aucun | oui | non | corriger |
| Piège à feu | `Slo4ivq91` | Druide | 2 | `scripts/sorts/piege-a-feu.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Soins mineurs | `193bqqLSQr0HC1bm` | Druide | 2 | `scripts/sorts/druide-soins-mineurs.js` | oui | Nécromancie | aucun | oui | non | corriger |
| Arbre | `gL6K13UI6GzIh3vR` | Druide | 3 | `scripts/sorts/druide-arbre.js` | oui | Altération | du gui et une petite branche d’arbre | oui | non | corriger |
| Contre-poison | `cmqFxT1lil3aJ6eL` | Druide | 3 | `scripts/sorts/druide-contre-poison.js` | oui | Nécromancie | aucun | oui | non | corriger |
| Embroussaillement | `Sbg9ej0jd` | Druide | 3 | `scripts/sorts/embroussaillement.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Guérison des maladies | `S1k5t1jju` | Druide | 3 | `scripts/sorts/guerison-des-maladies.js` | oui | a_completer | aucun | oui | oui | corriger |
| Invocation d'insectes | `dnVcLvdXrySEeWge` | Druide | 3 | `scripts/sorts/druide-invocation-d-insectes.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Invocation de la foudre | `lfkj1T7y8pa5ARG0` | Druide | 3 | `scripts/sorts/druide-invocation-de-la-foudre.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Lithomorphose | `qDrkAocsXPPoz6ym` | Druide | 3 | `scripts/sorts/druide-lithomorphose.js` | oui | Altération | aucun | oui | non | corriger |
| Paralysie animale | `d5VYBbd8J6A0KZDW` | Druide | 3 | `scripts/sorts/druide-paralysie-animale.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Piège sylvestre | `ILCNplGHyXKdpH4I` | Druide | 3 | `scripts/sorts/druide-piege-sylvestre.js` | oui | Altération | aucun | oui | non | corriger |
| Protection contre le feu | `vyq7ewIujEefLfx3` | Druide | 3 | `scripts/sorts/druide-protection-contre-le-feu.js` | oui | Abjuration | aucun | oui | non | corriger |
| Pyrotechnie | `S03e9192t` | Druide | 3 | `scripts/sorts/pyrotechnie.js` | oui | a_completer | aucun | oui | oui | corriger |
| Respiration aquatique | `Fm4984m1dcunpwiB` | Druide | 3 | `scripts/sorts/druide-respiration-aquatique.js` | oui | Altération | aucun | oui | non | corriger |
| Contrôle de la température sur 3 m | `HVNQPx5qWs1cNFRT` | Druide | 4 | `scripts/sorts/druide-controle-de-la-temperature-sur-3-m.js` | oui | Altération | aucun | non | non | corriger |
| Dissipation de la magie | `S7hx702hb` | Druide | 4 | `scripts/sorts/dissipation-de-la-magie.js` | oui | a_completer | aucun | oui | oui | corriger |
| Embrasement | `OMmnUrjpCVcCASNR` | Druide | 4 | `scripts/sorts/druide-embrasement.js` | oui | Altération | aucun | oui | non | aide_mj_avec_vfx |
| Forêt hallucinatoire | `jOxhcQtvs1oUOpak` | Druide | 4 | `scripts/sorts/druide-foret-hallucinatoire.js` | oui | Illusion/Enchantement | aucun | non | non | aide_mj_avec_vfx |
| Invocation animale I | `bQVB6rizjkXdUET0` | Druide | 4 | `scripts/sorts/druide-invocation-animale-i.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Invocation des créatures sylvestres | `TF3ui2XtaRyUwwRG` | Druide | 4 | `scripts/sorts/druide-invocation-des-creatures-sylvestres.js` | oui | Conjuration/Appel | une pomme de pin et 8 baies de houx | oui | non | aide_mj_avec_vfx |
| Langage des plantes | `Sqd9hvks6` | Druide | 4 | `scripts/sorts/langage-des-plantes.js` | oui | a_completer | typiquement druidique (à savoir du gui), ce sort est le même que le sort de niveau 4 de clerc langage des plantes | oui | non | corriger |
| Paralysie végétale | `n0ScQmYB3qGB7V3g` | Druide | 4 | `scripts/sorts/druide-paralysie-vegetale.js` | oui | Altération | aucun | oui | non | corriger |
| Porte végétale | `VzcxE29VIVIX7Agf` | Druide | 4 | `scripts/sorts/druide-porte-vegetale.js` | oui | Altération | aucun | oui | non | corriger |
| Protection contre la foudre | `MgZcW1UgY4vOIats` | Druide | 4 | `scripts/sorts/druide-protection-contre-la-foudre.js` | oui | Abjuration | aucun | oui | non | corriger |
| Répulsion des insectes | `R8kqIcaXdLu1nUFh` | Druide | 4 | `scripts/sorts/druide-repulsion-des-insectes.js` | oui | Abjuration | du gui et l’un des éléments suivants: plusieurs soucis écrasés, un poireau écrasé, 7 feuilles de navet écrasées ou un peu de résine d’arbre à camphre | oui | non | corriger |
| Soins majeurs | `Sz67vrc8p` | Druide | 4 | `scripts/sorts/soins-majeurs.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Bâtons à serpents | `tLb7xw1oUqTWIBSP` | Druide | 5 | `scripts/sorts/druide-batons-a-serpents.js` | oui | Altération | aucun | oui | non | corriger |
| Bouclier anti-plantes | `nBIJOOTA44bGxVyL` | Druide | 5 | `scripts/sorts/druide-bouclier-anti-plantes.js` | oui | Abjuration | aucun | oui | non | corriger |
| Communion avec la nature | `2mQgGKskOfdYgHLB` | Druide | 5 | `scripts/sorts/druide-communion-avec-la-nature.js` | oui | Divination | aucun | oui | non | corriger |
| Contrôle des vents | `EtVots6HKBlcVdlr` | Druide | 5 | `scripts/sorts/druide-controle-des-vents.js` | oui | Altération | aucun | oui | non | corriger |
| Croissance animale | `S0gfyorie` | Druide | 5 | `scripts/sorts/croissance-animale.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Fléau d’insectes | `Sl13yrvj2` | Druide | 5 | `scripts/sorts/fleau-dinsectes.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Invocation animale II | `ev1iqqbluPZsooao` | Druide | 5 | `scripts/sorts/druide-invocation-animale-ii.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Mur de feu | `ibRsKWkteFkyQdDO` | Druide | 5 | `scripts/sorts/druide-mur-de-feu.js` | oui | Évocation | aucun | oui | non | corriger |
| Passe-plantes | `x5iMO3BUv9Ze8igE` | Druide | 5 | `scripts/sorts/druide-passe-plantes.js` | oui | Altération | aucun | oui | non | corriger |
| Transmutation de pierre en boue | `UxlwIIKcYa8bf6AK` | Druide | 5 | `scripts/sorts/druide-transmutation-de-pierre-en-boue.js` | oui | Altération | aucun | oui | non | corriger |
| Bouclier anti-animal | `YiZsypsA769c8dDS` | Druide | 6 | `scripts/sorts/druide-bouclier-anti-animal.js` | oui | Abjuration | aucun | oui | non | corriger |
| Débilité mentale | `Sd2vcuep5` | Druide | 6 | `scripts/sorts/debilite-mentale.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Graines de feu | `xVtsnh3iA6UMGbDy` | Druide | 6 | `scripts/sorts/druide-graines-de-feu.js` | oui | Évocation | aucun | oui | non | aide_mj_avec_vfx |
| Invocation animale III | `nMNhqWS2kUnSRcTD` | Druide | 6 | `scripts/sorts/druide-invocation-animale-iii.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Invocation d'un élémental du feu | `jxGkK0Nw9BmWs5eu` | Druide | 6 | `scripts/sorts/druide-invocation-d-un-elemental-du-feu.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Invocation du temps | `8fZOj9M2oULzHaK1` | Druide | 6 | `scripts/sorts/druide-invocation-du-temps.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Mur d'épines | `vvlyNag1pWQlMqqw` | Druide | 6 | `scripts/sorts/druide-mur-d-epines.js` | oui | Altération | aucun | oui | non | corriger |
| Répulsion du bois | `MtgHg2ggpRB851uE` | Druide | 6 | `scripts/sorts/druide-repulsion-du-bois.js` | oui | Abjuration | aucun | oui | non | corriger |
| Soin ultime | `2HXdutkNuMd7wEme` | Druide | 6 | `scripts/sorts/druide-soin-ultime.js` | oui | Nécromancie | aucun | oui | non | corriger |
| Transit végétal | `9Y55amDwSzGZYPiM` | Druide | 6 | `scripts/sorts/druide-transit-vegetal.js` | oui | Altération | aucun | oui | non | corriger |
| Animation de la roche | `ta6CWp0VMuC8z4oI` | Druide | 7 | `scripts/sorts/druide-animation-de-la-roche.js` | oui | Altération | aucun | oui | oui | corriger |
| Chariot de Sustarre | `6lBtsrAE6tTEJDJI` | Druide | 7 | `scripts/sorts/druide-chariot-de-sustarre.js` | oui | Altération | aucun | oui | non | corriger |
| Confusion | `Siwmacb6r` | Druide | 7 | `scripts/sorts/confusion.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Contrôle du climat | `Szz8xxhao` | Druide | 7 | `scripts/sorts/controle-du-climat.js` | oui | a_completer | aucun | oui | oui | corriger |
| Doigt de mort | `FLwWKlyZWASHf4dY` | Druide | 7 | `scripts/sorts/druide-doigt-de-mort.js` | oui | Nécromancie | aucun | oui | non | aide_mj_avec_vfx |
| Invocation d'un élémental de terre | `FaufBhAcCD3n9phk` | Druide | 7 | `scripts/sorts/druide-invocation-d-un-elemental-de-terre.js` | oui | Conjuration/Appel | aucun | oui | non | aide_mj_avec_vfx |
| Mort rampante | `QNM2PTjpOuOr5twS` | Druide | 7 | `scripts/sorts/druide-mort-rampante.js` | oui | Altération | aucun | oui | non | corriger |
| Réincarnation | `ytUzMMlAcWovQf2A` | Druide | 7 | `scripts/sorts/druide-reincarnation.js` | oui | Nécromancie | aucun | oui | non | corriger |
| Tempête de feu | `IzJgixDIb7nrR1wQ` | Druide | 7 | `scripts/sorts/druide-tempete-de-feu.js` | oui | Évocation | aucun | oui | non | corriger |
| Transmutation du métal en bois | `TpsMHSV6jiYmiht6` | Druide | 7 | `scripts/sorts/druide-transmutation-du-metal-en-bois.js` | oui | Altération | aucun | oui | non | corriger |
| Bruitage | `xuHjKxIJ94AhH610` | Illusionniste | 1 | `scripts/sorts/illusionniste-bruitage.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Changement d’apparence | `CTePPmPBPiUTyQ8x` | Illusionniste | 1 | `scripts/sorts/illusionniste-changement-d-apparence.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Détection de l’invisibilité | `wtxFaRkEeY5m5vGW` | Illusionniste | 1 | `scripts/sorts/illusionniste-detection-de-l-invisibilite.js` | oui | Divination | aucun | oui | non | corriger |
| Détection des illusions | `RoPNQW1lonPdXpIL` | Illusionniste | 1 | `scripts/sorts/illusionniste-detection-des-illusions.js` | oui | Divination | morceau de cristal teinté en jaune, morceau de verre teinté en jaune, morceau de mica teinté en jaune | oui | non | corriger |
| Force fantasmagorique | `whLrq31uhuv0Vg2x` | Illusionniste | 1 | `scripts/sorts/illusionniste-force-fantasmagorique.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Hypnotisme | `aJTNURTuGz0aElPr` | Illusionniste | 1 | `scripts/sorts/illusionniste-hypnotisme.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Jet de couleurs | `PingWPeTX4P9EAag` | Illusionniste | 1 | `scripts/sorts/illusionniste-jet-de-couleurs.js` | oui | Évocation | pincée de sable, poudre rouge, jaune et bleue | oui | non | corriger |
| Lumières dansantes | `lnB96ugHg2ZeHjzf` | Illusionniste | 1 | `scripts/sorts/lumiere.js` | oui | Évocation | aucun | oui | oui | automatisation_partielle |
| Mur de brouillard | `ActWRo5tz4Wab8sh` | Illusionniste | 1 | `scripts/sorts/illusionniste-mur-de-brouillard.js` | oui | Illusion/Fantasme | de la poudre de poix séchés | oui | non | corriger |
| Réflexion des regards | `WCOEjYv79WQ8VYqY` | Illusionniste | 1 | `scripts/sorts/illusionniste-reflexion-des-regards.js` | oui | Abjuration | aucun | oui | non | corriger |
| Ténèbres | `yE4kzcw7UIok8p8Y` | Illusionniste | 1 | `scripts/sorts/illusionniste-tenebres.js` | oui | Évocation | aucun | oui | non | corriger |
| Bouche magique | `wBz84BLOyTmGed9y` | Illusionniste | 2 | `scripts/sorts/illusionniste-bouche-magique.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Cécité | `N6fR1IQH2M2CZHwV` | Illusionniste | 2 | `scripts/sorts/illusionniste-cecite.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Désinformation | `uqypjhvmid2zcZip` | Illusionniste | 2 | `scripts/sorts/illusionniste-desinformation.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Détection de la magie | `St2jkwm4x` | Illusionniste | 2 | `scripts/sorts/detection-de-la-magie.js` | oui | a_completer | aucun | oui | oui | corriger |
| Force fantasmagorique améliorée | `EsgoQh0nlj7f2bp6` | Illusionniste | 2 | `scripts/sorts/illusionniste-force-fantasmagorique-amelioree.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Image miroir | `Ssx6j4e18` | Illusionniste | 2 | `scripts/sorts/image-miroir.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Invisibilité | `4VA5OcJS8DaXKyVw` | Illusionniste | 2 | `scripts/sorts/illusionniste-invisibilite.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Motif hypnotique | `ChKu6jVRMkzSxKhr` | Illusionniste | 2 | `scripts/sorts/illusionniste-motif-hypnotique.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Nappe de brouillard | `FYrBpsDerJsdUgz5` | Illusionniste | 2 | `scripts/sorts/illusionniste-nappe-de-brouillard.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Surdité | `HeupZXq4vQjY3EK8` | Illusionniste | 2 | `scripts/sorts/illusionniste-surdite.js` | oui | Enchantement/Charme | de la cire d’abeille | oui | non | corriger |
| Trouble | `zKAqiJZxs9A3MPtd` | Illusionniste | 2 | `scripts/sorts/illusionniste-trouble.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Ventriloquie | `eKltp2YyNCfdS6Qg` | Illusionniste | 2 | `scripts/sorts/illusionniste-ventriloquie.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Corde enchantée | `S1h2ue786` | Illusionniste | 3 | `scripts/sorts/corde-enchantee.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Dissipation des illusions | `OHO4xJXJxW5gygat` | Illusionniste | 3 | `scripts/sorts/illusionniste-dissipation-des-illusions.js` | oui | Abjuration | aucun | oui | non | corriger |
| Écriture illusoire | `WweEfY9hLciMDbwM` | Illusionniste | 3 | `scripts/sorts/illusionniste-ecriture-illusoire.js` | oui | Illusion/Fantasme | encre fabriquée à base de plomb par un alchimiste | oui | non | corriger |
| Effroi | `Soif3xut2` | Illusionniste | 3 | `scripts/sorts/effroi.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Force spectrale | `3xDP7GlFKFXuADfj` | Illusionniste | 3 | `scripts/sorts/illusionniste-force-spectrale.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Invisibilité sur 3 m | `3iWgC8Mq0KHNLWHX` | Illusionniste | 3 | `scripts/sorts/illusionniste-invisibilite-sur-3-m.js` | oui | Illusion/Fantasme | aucun | non | non | corriger |
| Lumière éternelle | `Sjv8diap7` | Illusionniste | 3 | `scripts/sorts/lumiere-eternelle.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Non-détection | `jMHf785AxLZXArOB` | Illusionniste | 3 | `scripts/sorts/illusionniste-non-detection.js` | oui | Divination | pincée de poudre de diamant | oui | non | corriger |
| Paralysie musculaire | `Pp7IjtyLnkBvooZ8` | Illusionniste | 3 | `scripts/sorts/illusionniste-paralysie-musculaire.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Suggestion | `CTNAYVpDwWldT0PT` | Illusionniste | 3 | `scripts/sorts/illusionniste-suggestion.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Ténèbres éternelles | `9dKrtDMJTTb8uQ69` | Illusionniste | 3 | `scripts/sorts/illusionniste-tenebres-eternelles.js` | oui | Évocation | aucun | oui | non | corriger |
| Terrain hallucinatoire | `S98lx26ye` | Illusionniste | 3 | `scripts/sorts/terrain-hallucinatoire.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Confusion | `Sxn92jrvw` | Illusionniste | 4 | `scripts/sorts/confusion.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Création mineure | `XdIvmjAtSNZAr6OD` | Illusionniste | 4 | `scripts/sorts/illusionniste-creation-mineure.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Dissipation de l’épuisement | `wJIL6DTErJknVsvM` | Illusionniste | 4 | `scripts/sorts/illusionniste-dissipation-de-l-epuisement.js` | oui | Abjuration | aucun | oui | non | corriger |
| Émotion | `lJQ17k2WBz4PPxLG` | Illusionniste | 4 | `scripts/sorts/illusionniste-emotion.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Invisibilité améliorée | `OneHXc9zQXYEFo8z` | Illusionniste | 4 | `scripts/sorts/illusionniste-invisibilite-amelioree.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Monstres des ombres | `rAnIttzWwgXNUpNM` | Illusionniste | 4 | `scripts/sorts/illusionniste-monstres-des-ombres.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Phytomorphose | `BEdKOeb8qiHSn7cb` | Illusionniste | 4 | `scripts/sorts/illusionniste-phytomorphose.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Tueur fantasmagorique | `83Cg1HWiPXCrqS0c` | Illusionniste | 4 | `scripts/sorts/illusionniste-tueur-fantasmagorique.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Chaos | `h3w9xJRIMFBZSPQK` | Illusionniste | 5 | `scripts/sorts/illusionniste-chaos.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Création majeure | `bfKkGhHAvYuzbb4B` | Illusionniste | 5 | `scripts/sorts/illusionniste-creation-majeure.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Holographie | `FrUiFMdhrdEVVoGU` | Illusionniste | 5 | `scripts/sorts/illusionniste-holographie.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Invocation des ombres | `PBTAq8GBzCXTrX17` | Illusionniste | 5 | `scripts/sorts/illusionniste-invocation-des-ombres.js` | oui | Conjuration/Appel | morceau de quartz fumé | oui | non | corriger |
| Labyrinthe | `Sa6lcn10r` | Illusionniste | 5 | `scripts/sorts/labyrinthe.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Magie des ombres | `QGnxlhJpGGXH7fpw` | Illusionniste | 5 | `scripts/sorts/illusionniste-magie-des-ombres.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Monstres demi-ombre | `zRjgdAjHkaeS13gL` | Illusionniste | 5 | `scripts/sorts/illusionniste-monstres-demi-ombre.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Porte des ombres | `wDl7Rbi8fLQo907c` | Illusionniste | 5 | `scripts/sorts/illusionniste-porte-des-ombres.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Illusion permanente | `yZrXoPn8wLsrDl0Y` | Illusionniste | 6 | `scripts/sorts/illusionniste-illusion-permanente.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Illusion programmée | `n7BeLjXJJQDQbrCM` | Illusionniste | 6 | `scripts/sorts/illusionniste-illusion-programmee.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Invocation des animaux | `JAla8edUQvbursmM` | Illusionniste | 6 | `scripts/sorts/illusionniste-invocation-des-animaux.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Magie demi-ombre | `cqKzX9eU9thvYrTU` | Illusionniste | 6 | `scripts/sorts/illusionniste-magie-demi-ombre.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Ombres | `xakbt6nUQ0tbeVvH` | Illusionniste | 6 | `scripts/sorts/illusionniste-ombres.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Suggestion de masse | `ouXDv5CbPVKygOnj` | Illusionniste | 6 | `scripts/sorts/illusionniste-suggestion-de-masse.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Vision réelle | `MkQfB6H23z1EPyXq` | Illusionniste | 6 | `scripts/sorts/illusionniste-vision-reelle.js` | oui | Divination | aucun | oui | non | corriger |
| Voile illusoire | `U5UsRJv9W5WnI5Uc` | Illusionniste | 6 | `scripts/sorts/illusionniste-voile-illusoire.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Altération de la réalité | `WLWi5ajizykNFffK` | Illusionniste | 7 | `scripts/sorts/illusionniste-alteration-de-la-realite.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Jet prismatique | `qEqxbIe6jPNTHEgC` | Illusionniste | 7 | `scripts/sorts/illusionniste-jet-prismatique.js` | oui | Évocation | aucun | oui | non | corriger |
| Mur prismatique | `ULLJUpLwbeQMLzAt` | Illusionniste | 7 | `scripts/sorts/illusionniste-mur-prismatique.js` | oui | Évocation | aucun | oui | non | corriger |
| Sort astral | `S6ybq84lw` | Illusionniste | 7 | `scripts/sorts/sort-astral.js` | oui | a_completer | aucun | oui | oui | corriger |
| Sorts de niveau 1 de magicien | `yxZAGhZDEaT0e6Am` | Illusionniste | 7 | `scripts/sorts/illusionniste-sorts-de-niveau-1-de-magicien.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Vision | `1FDkJAlbuzYtOUON` | Illusionniste | 7 | `scripts/sorts/illusionniste-vision.js` | oui | Divination | aucun | oui | non | corriger |
| Agrandissement | `Ql44mewOhfw0CGSS` | Magicien | 1 | `scripts/sorts/magicien-agrandissement.js` | oui | Altération | aucun | oui | non | corriger |
| Altération des feux normaux | `aYPpwB93lzPfZUka` | Magicien | 1 | `scripts/sorts/magicien-alteration-des-feux-normaux.js` | oui | Évocation | aucun | oui | non | aide_mj_avec_vfx |
| Amitié | `XWJnBEbhnOoQJ3jA` | Magicien | 1 | `scripts/sorts/magicien-amitie.js` | oui | Enchantement/Charme | aucun | oui | oui | automatisation_partielle |
| Aura magique de Nystul | `H8oggIty1B5amxPl` | Magicien | 1 | `scripts/sorts/magicien-aura-magique-de-nystul.js` | oui | Illusion/Fantasme | un petit morceau de soie que le magicien doit passer sur l’objet affecté | oui | non | aide_mj_avec_vfx |
| Bouclier | `vfbToqj3FmCBkCZY` | Magicien | 1 | `scripts/sorts/bouclier.js` | oui | Abjuration | aucun | oui | oui | automatisation_partielle |
| Charme-personnes | `vzsXf3ju8KaPX7gg` | Magicien | 1 | `scripts/sorts/charme_personne.js` | oui | Enchantement/Charme | aucun | oui | oui | automatisation_partielle |
| Chute de plume | `eHS5KR95WVarU3pc` | Magicien | 1 | `scripts/sorts/magicien-chute-de-plume.js` | oui | Altération | petite plume, duvet | oui | non | corriger |
| Compréhension des langues | `87QO92XmR11xX6d8` | Magicien | 1 | `scripts/sorts/magicien-comprehension-des-langues.js` | oui | Altération | une pincée de suie et quelques grains de sel | oui | non | corriger |
| Détection de la magie | `Sxmmsj8ap` | Magicien | 1 | `scripts/sorts/detection-de-la-magie.js` | oui | a_completer | aucun | oui | oui | corriger |
| Disque flottant de Tenser | `yg6KwuVZ0LX0iAJR` | Magicien | 1 | `scripts/sorts/magicien-disque-flottant-de-tenser.js` | oui | Altération | une goutte de mercure | oui | non | corriger |
| Écriture | `0xDSJQMk6eczXt8X` | Magicien | 1 | `scripts/sorts/magicien-ecriture.js` | oui | Altération | aucun | oui | non | corriger |
| Effacement | `xRkHrKxTwrMBU0S6` | Magicien | 1 | `scripts/sorts/magicien-effacement.js` | oui | Altération | aucun | oui | non | corriger |
| Escalade d’araignée | `foYtagnFToouiATL` | Magicien | 1 | `scripts/sorts/magicien-escalade-d-araignee.js` | oui | Altération | goutte de bitume, araignée vivante | oui | non | corriger |
| Fermeture | `R2sA71p9mFINt8Rc` | Magicien | 1 | `scripts/sorts/magicien-fermeture.js` | oui | Abjuration | aucun | oui | non | corriger |
| Identification | `j4mcEDMWWZDmHxVc` | Magicien | 1 | `scripts/sorts/magicien-identification.js` | oui | Divination | aucun | oui | non | corriger |
| Invocation d’un familier | `uaf9HJHgrTYgwKTG` | Magicien | 1 | `scripts/sorts/magicien-invocation-d-un-familier.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Lecture de la magie | `C3BPJmqOmR14lZgX` | Magicien | 1 | `scripts/sorts/magicien-lecture-de-la-magie.js` | oui | Divination | cristal clair ou prisme minéral | oui | non | corriger |
| Lumières dansantes | `1ZPprzuVFnjKQGVz` | Magicien | 1 | `scripts/sorts/magicien-lumieres-dansantes.js` | oui | Altération | phosphore, ver luisant | oui | non | corriger |
| Mains brûlantes | `KdSGwTV1VKI5YjDI` | Magicien | 1 | `scripts/sorts/magicien-mains-brulantes.js` | oui | Évocation | aucun | oui | oui | conserver |
| Message | `K9mYUPeDhXdXBopk` | Magicien | 1 | `scripts/sorts/magicien-message.js` | oui | Altération | petite pièce de cuivre finement ciselée | oui | non | corriger |
| Poigne électrique | `m9Z8xebP4Od4RlsP` | Magicien | 1 | `scripts/sorts/magicien-poigne-electrique.js` | oui | Évocation | aucun | oui | oui | conserver |
| Poussée | `ZwE7ceveF3dbKFdF` | Magicien | 1 | `scripts/sorts/magicien-poussee.js` | oui | Altération | une pincée de poudre de cuivre qui doit être soufflée de la paume de la main, avant de pointer le doigt vers l’objectif visé | oui | non | corriger |
| Projectile magique | `Sr8hvuf42` | Magicien | 1 | `scripts/sorts/projectile-magique.js` | oui | a_completer | aucun | oui | non | conserver |
| Protection contre le mal | `S3owai0q7` | Magicien | 1 | `scripts/sorts/protection-contre-le-mal.js` | oui | a_completer | aucun | oui | oui | corriger |
| Réparation | `JasfW0d6Q6kD6Ocu` | Magicien | 1 | `scripts/sorts/magicien-reparation.js` | oui | Altération | deux objets magnétiques, copeaux de métal | oui | non | corriger |
| Saut | `jrbDmeQEatjKE6n5` | Magicien | 1 | `scripts/sorts/magicien-saut.js` | oui | Altération | une patte arrière de sauterelle — une pour chaque saut — que le magicien doit casser quand le saut est effectué | oui | non | corriger |
| Serviteur invisible | `sqe9tEofCRkLumNr` | Magicien | 1 | `scripts/sorts/magicien-serviteur-invisible.js` | oui | Conjuration/Appel | un bout de ficelle et un morceau de bois | oui | non | corriger |
| Sommeil | `YzvHRmS0SVf0NDfO` | Magicien | 1 | `scripts/sorts/sommeil.js` | oui | Enchantement/Charme | pincée de sable fin, pétales de rose, criquet vivant | oui | oui | automatisation_partielle |
| Ventriloquie | `Sh0s7nf55` | Magicien | 1 | `scripts/sorts/ventriloquie.js` | oui | a_completer | un petit parchemin mis en cône | oui | non | aide_mj_avec_vfx |
| Bouche magique | `Sd3h2eywj` | Magicien | 2 | `scripts/sorts/bouche-magique.js` | oui | a_completer | un petit morceau de rayon de miel | oui | non | aide_mj_avec_vfx |
| Bruitage | `Skwo3qibs` | Magicien | 2 | `scripts/sorts/bruitage.js` | oui | a_completer | morceau de laine, cire | oui | oui | automatisation_partielle |
| Corde enchantée | `lXUOJQPzhAffHVMC` | Magicien | 2 | `scripts/sorts/magicien-corde-enchantee.js` | oui | Altération | de la poudre de blé et un parchemin torsadé en forme de boucle | oui | non | corriger |
| Détection du mal | `S744pccyj` | Magicien | 2 | `scripts/sorts/detection-du-mal.js` | oui | a_completer | aucun | oui | oui | automatisation_partielle |
| E.S.P. | `ySqQUdkEBf3Sav2Z` | Magicien | 2 | `scripts/sorts/magicien-e-s-p.js` | oui | Altération | une pièce de cuivre | oui | non | corriger |
| Force | `Y6tsRuejC7qRqtCd` | Magicien | 2 | `scripts/sorts/magicien-force.js` | oui | Altération | quelques cheveux ou un peu d’excrément d’un animal particulièrement fort — singe, ours, bœuf, etc | oui | non | corriger |
| Fracassement | `cGT3rT7VlCh7BuWd` | Magicien | 2 | `scripts/sorts/magicien-fracassement.js` | oui | Altération | un éclat de mica | oui | non | corriger |
| Image miroir | `0vUHIpvUNS4TA1XZ` | Magicien | 2 | `scripts/sorts/magicien-image-miroir.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Invisibilité | `S3n5s30rh` | Magicien | 2 | `scripts/sorts/detection-de-linvisibilite.js` | oui | a_completer | un cil mis dans de la gomme arabique | oui | non | aide_mj_avec_vfx |
| Lévitation | `2sz9FJMkEg5Ljywr` | Magicien | 2 | `scripts/sorts/magicien-levitation.js` | oui | Altération | boucle de cuir, fil d’or courbé en forme d’hameçon | oui | non | corriger |
| Localisation d’objets | `FMsUijIK9egwdICC` | Magicien | 2 | `scripts/sorts/magicien-localisation-d-objets.js` | oui | Divination | aucun | oui | non | corriger |
| Lumière éternelle | `Sejwb1zfk` | Magicien | 2 | `scripts/sorts/lumiere-eternelle.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Nuage puant | `fnSR2CAHU3rU3WGm` | Magicien | 2 | `scripts/sorts/magicien-nuage-puant.js` | oui | Évocation | œuf pourri, feuilles de symplocarpe fétide | oui | oui | automatisation_partielle |
| Or des fous | `F1AYLNQxgPkbAKvP` | Magicien | 2 | `scripts/sorts/magicien-or-des-fous.js` | oui | Altération | aucun | oui | non | corriger |
| Oubli | `6bFZjficFTtSOd3X` | Magicien | 2 | `scripts/sorts/magicien-oubli.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Ouverture | `IiCnwcKzkfECzT5b` | Magicien | 2 | `scripts/sorts/magicien-ouverture.js` | oui | Altération | aucun | oui | non | corriger |
| Peur | `nEnY0rOhsUcIvGw9` | Magicien | 2 | `scripts/sorts/magicien-peur.js` | oui | Enchantement/Charme | un morceau d’os de mort-vivant (squelette, zombie, goule, ghast ou momie) | oui | oui | automatisation_partielle |
| Piège de Léomund | `XeoIbrIuWzQQeqhb` | Magicien | 2 | `scripts/sorts/magicien-piege-de-leomund.js` | oui | Altération | un morceau de fer pyriteux (une pierre à feu) avec lequel le magicien doit toucher l’objet à «piéger» | oui | non | corriger |
| Pyrotechnie | `HrKOTw0kqX1w6X3C` | Magicien | 2 | `scripts/sorts/magicien-pyrotechnie.js` | oui | Altération | aucun | oui | non | corriger |
| Rayon d’affaiblissement | `JdNLcU95SJeFJWf0` | Magicien | 2 | `scripts/sorts/magicien-rayon-d-affaiblissement.js` | oui | Évocation | aucun | oui | oui | automatisation_partielle |
| Ténèbres sur 5 mètres | `CvNVh364E6mHLbiC` | Magicien | 2 | `scripts/sorts/magicien-tenebres-sur-5-metres.js` | oui | Altération | aucun | oui | non | corriger |
| Toile d’araignée | `orptvU3p8BkABXhH` | Magicien | 2 | `scripts/sorts/magicien-toile-d-araignee.js` | oui | Altération | un peu de toile d’araignée | oui | oui | automatisation_partielle |
| Verrou magique | `YzA9lPZieNlGZn1V` | Magicien | 2 | `scripts/sorts/magicien-verrou-magique.js` | oui | Abjuration | aucun | oui | non | corriger |
| Boule de feu | `OdjZbZ6yCK8f7Cej` | Magicien | 3 | `scripts/sorts/magicien-boule-de-feu.js` | oui | Évocation | une petite boule composée de fiente de chauve-souris et de souffre | oui | oui | automatisation_partielle |
| Catalepsie | `Slpogd4zw` | Magicien | 3 | `scripts/sorts/catalepsie.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Chaumière de Léomund | `eQP2mvNXNEHDkl0Y` | Magicien | 3 | `scripts/sorts/magicien-chaumiere-de-leomund.js` | oui | Altération | une petite perle de cristal qui se brisera à la fin du sort ou si la chaumière est détruite | oui | non | corriger |
| Clairaudience | `bs5Yev27GKosckIi` | Magicien | 3 | `scripts/sorts/magicien-clairaudience.js` | oui | Divination | une petite corne d’argent d’une valeur minimale de 100 po, qui disparaît quand le sort est lancé | oui | non | corriger |
| Clairvoyance | `PeKgX0v88L8WqgdP` | Magicien | 3 | `scripts/sorts/magicien-clairvoyance.js` | oui | Divination | une pincée de poudre faite à partir de la glande pinéale d’un humain ou d’un humanoïde | oui | non | corriger |
| Dissipation de la magie | `S1yedhqtw` | Magicien | 3 | `scripts/sorts/dissipation-de-la-magie.js` | oui | a_completer | aucun | oui | oui | corriger |
| Flèche de feu | `cdoLylDIdTX30880` | Magicien | 3 | `scripts/sorts/magicien-fleche-de-feu.js` | oui | Évocation | aucun | oui | non | corriger |
| Force fantasmagorique | `Sjv9g51wv` | Magicien | 3 | `scripts/sorts/force-fantasmagorique.js` | oui | a_completer | un morceau de toison de mouton | oui | non | aide_mj_avec_vfx |
| Foudre | `mURPcJOWStwfHLSD` | Magicien | 3 | `scripts/sorts/magicien-foudre.js` | oui | Évocation | fourrure, baguette de verre, de cristal ou d’ambre | oui | oui | automatisation_partielle |
| Infravision | `TVQDVtYjgIIl4Qwp` | Magicien | 3 | `scripts/sorts/magicien-infravision.js` | oui | Divination | une petite statuette d’argile représentant une ziggourat, qui se brise quand l’incantation est prononcée | oui | non | corriger |
| Intermittence | `U6jlnGdUZAhfesYx` | Magicien | 3 | `scripts/sorts/magicien-intermittence.js` | oui | Altération | aucun | oui | non | corriger |
| Invisibilité sur 3 m | `Sleh5na5u` | Magicien | 3 | `scripts/sorts/invisibilite-sur-3-m.js` | oui | a_completer | aucun | non | non | aide_mj_avec_vfx |
| Invocation de monstres I | `azzcDv1FWb4UfqXk` | Magicien | 3 | `scripts/sorts/magicien-invocation-de-monstres-i.js` | oui | Conjuration/Appel | aucun | non | non | corriger |
| Langues | `m10Pwr1wzT3BZTGP` | Magicien | 3 | `scripts/sorts/magicien-langues.js` | oui | Altération | aucun | oui | non | corriger |
| Paralysie | `Uer3SMWo8VGodjcf` | Magicien | 3 | `scripts/sorts/magicien-paralysie.js` | oui | Altération | aucun | oui | non | corriger |
| Protection contre le mal sur 3 m | `RK3Dwq9cpDrc4JKy` | Magicien | 3 | `scripts/sorts/magicien-protection-contre-le-mal-sur-3-m.js` | oui | Abjuration | aucun | non | non | corriger |
| Protection contre les projectiles normaux | `2xS2zLfqcMi0wyu7` | Magicien | 3 | `scripts/sorts/magicien-protection-contre-les-projectiles-normaux.js` | oui | Abjuration | une graine de légume | oui | non | corriger |
| Rafale de vent | `4Fefn3TPB5BiMRw8` | Magicien | 3 | `scripts/sorts/magicien-rafale-de-vent.js` | oui | Altération | langue de serpent, miel, goutte d’huile douce | oui | non | corriger |
| Ralentissement | `bKU3hWAg9dK3XNJ2` | Magicien | 3 | `scripts/sorts/magicien-ralentissement.js` | oui | Altération | une goutte de mélasse | oui | non | corriger |
| Rapidité | `Ua8x9g7HihK7cXGY` | Magicien | 3 | `scripts/sorts/magicien-rapidite.js` | oui | Altération | un fragment de racine de réglisse | oui | non | corriger |
| Respiration aquatique | `Smspazki5` | Magicien | 3 | `scripts/sorts/respiration-aquatique.js` | oui | a_completer | un petit roseau ou un brin de paille | oui | oui | corriger |
| Runes explosives | `s4srAEb0LL48XW0c` | Magicien | 3 | `scripts/sorts/magicien-runes-explosives.js` | oui | Altération | aucun | oui | non | corriger |
| Suggestion | `Siybiihzj` | Magicien | 3 | `scripts/sorts/suggestion.js` | oui | a_completer | une plume d’aile d’oiseau | oui | non | aide_mj_avec_vfx |
| Vol | `L0KzlhAHlY5WnALd` | Magicien | 3 | `scripts/sorts/magicien-vol.js` | oui | Altération | un cocon de chenille | oui | non | corriger |
| Allométamorphose | `OwC37LQnhgfxfBPC` | Magicien | 4 | `scripts/sorts/magicien-allometamorphose.js` | oui | Altération | aucun | oui | non | corriger |
| Arme enchantée | `i9oPB799yhmXRNTj` | Magicien | 4 | `scripts/sorts/magicien-arme-enchantee.js` | oui | Altération | du carbone et du citron réduits en poudre | oui | non | corriger |
| Autométamorphose | `PXmZOAl9DCJAeUeJ` | Magicien | 4 | `scripts/sorts/magicien-autometamorphose.js` | oui | Altération | aucun | oui | non | corriger |
| Bouclier de feu | `EjNM7yMhVXwwaOc4` | Magicien | 4 | `scripts/sorts/magicien-bouclier-de-feu.js` | oui | Abjuration | aucun | oui | non | corriger |
| Charme-monstres | `Hq0MiaQGHC04aCs8` | Magicien | 4 | `scripts/sorts/magicien-charme-monstres.js` | oui | Enchantement/Charme | un jeu de 3 coquilles de noisettes | oui | non | corriger |
| Confusion | `qc2S7OiREu8cVCKQ` | Magicien | 4 | `scripts/sorts/magicien-confusion.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Désenvoûtement | `Sq750xrgb` | Magicien | 4 | `scripts/sorts/desenvoutement.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Effroi | `VTqrTRciI6HhhBw0` | Magicien | 4 | `scripts/sorts/magicien-effroi.js` | oui | Enchantement/Charme | cœur de poule, plume blanche | oui | non | corriger |
| Embroussaillement | `WZuRPMokWkRk8S0N` | Magicien | 4 | `scripts/sorts/magicien-embroussaillement.js` | oui | Altération | aucun | oui | non | corriger |
| Excavation | `4gmO2NbHZxkLXarh` | Magicien | 4 | `scripts/sorts/magicien-excavation.js` | oui | Altération | pelle miniature, petit baquet | oui | non | corriger |
| Extension I | `ol1qo1S9byPbktdo` | Magicien | 4 | `scripts/sorts/magicien-extension-i.js` | oui | Altération | aucun | oui | non | corriger |
| Feu charmeur | `ej2pDpTcbBp59ioV` | Magicien | 4 | `scripts/sorts/magicien-feu-charmeur.js` | oui | Enchantement/Charme | un morceau de soie multicolore extrêmement fine que le magicien doit lancer dans la source du feu | oui | non | corriger |
| Globe mineur d’invulnérabilité | `OQFWHUXg5wCpvWiU` | Magicien | 4 | `scripts/sorts/magicien-globe-mineur-d-invulnerabilite.js` | oui | Abjuration | perle de verre, perle de cristal | oui | non | corriger |
| Invocation de monstre II | `xPNrvuMVoTHmz9GY` | Magicien | 4 | `scripts/sorts/magicien-invocation-de-monstre-ii.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Maladresse | `od5HnEJxmcuxoc7b` | Magicien | 4 | `scripts/sorts/magicien-maladresse.js` | oui | Altération | petit morceau de lait solidifié (crème épaisse ou beurre) | oui | non | corriger |
| Moyen mnémonique de Rary | `wtQdhwfXLq5KI8dx` | Magicien | 4 | `scripts/sorts/magicien-moyen-mnemonique-de-rary.js` | oui | Altération | morceau de ficelle, plaque d’ivoire, encre composée de sécrétion de calmar et de sang de dragon noir, encre composée de sécrétion de calmar et de suc digestif de limace géante | oui | non | corriger |
| Mur de feu | `Sl22x1gv4` | Magicien | 4 | `scripts/sorts/mur-de-feu.js` | oui | a_completer | du phosphore | oui | non | aide_mj_avec_vfx |
| Mur de glace | `Oe6kWMmtqXjUdluK` | Magicien | 4 | `scripts/sorts/magicien-mur-de-glace.js` | oui | Évocation | un petit morceau de quartz ou une pierre cristalline de même type | oui | non | corriger |
| Œil magique | `NENvm4CbdMhFClxo` | Magicien | 4 | `scripts/sorts/magicien-il-magique.js` | oui | Divination | un morceau de fourrure de chauve-souris | oui | non | corriger |
| Phytomorphose | `Sjja6qk18` | Magicien | 4 | `scripts/sorts/phytomorphose.js` | oui | a_completer | une poignée de morceaux d'écorce | oui | non | aide_mj_avec_vfx |
| Piège à feu | `p9jlQvfec03qUS4e` | Magicien | 4 | `scripts/sorts/magicien-piege-a-feu.js` | oui | Évocation | aucun | oui | non | corriger |
| Porte dimensionnelle | `9xooSY6MIFWhmC0h` | Magicien | 4 | `scripts/sorts/magicien-porte-dimensionnelle.js` | oui | Altération | une pincée de poussière et quelques gouttes d’eau | oui | non | corriger |
| Tempête de glace | `zPQP5olmpPjaRgmf` | Magicien | 4 | `scripts/sorts/magicien-tempete-de-glace.js` | oui | Évocation | aucun | oui | non | corriger |
| Terrain hallucinatoire | `afrGD9EO4FsC15qj` | Magicien | 4 | `scripts/sorts/magicien-terrain-hallucinatoire.js` | oui | Illusion/Fantasme | une pierre, une brindille et un morceau de plante verte, feuille ou brin d’herbe | oui | non | corriger |
| Chien fidèle de Mordenkainen | `So9k2n77e` | Magicien | 5 | `scripts/sorts/chien-fidele-de-mordenkainen.js` | oui | a_completer | petit sifflet en argent, morceau d’os, fil | oui | non | aide_mj_avec_vfx |
| Coffre secret de Léomund | `YmY1ZfpSrQmJqRIX` | Magicien | 5 | `scripts/sorts/magicien-coffre-secret-de-leomund.js` | oui | Altération | aucun | oui | non | corriger |
| Cône de froid | `daKCJF4Luaija46f` | Magicien | 5 | `scripts/sorts/magicien-cone-de-froid.js` | oui | Évocation | petit cône de verre, petit cône de cristal | oui | non | corriger |
| Contact d'autres plans | `k0JnUphmxVtqdDkd` | Magicien | 5 | `scripts/sorts/magicien-contact-d-autres-plans.js` | oui | Divination | aucun | oui | non | corriger |
| Croissance animale | `f2k3BWjZABrQKWZW` | Magicien | 5 | `scripts/sorts/magicien-croissance-animale.js` | oui | Altération | aucun | oui | non | corriger |
| Débilité mentale | `WK5FYRTJv5l03gmy` | Magicien | 5 | `scripts/sorts/magicien-debilite-mentale.js` | oui | Enchantement/Charme | une poignée de petites sphères d’argile, de cristal, de verre ou minérales | oui | non | corriger |
| Distorsion des distances | `TyxGTNAe1knBWFwn` | Magicien | 5 | `scripts/sorts/magicien-distorsion-des-distances.js` | oui | Altération | un peu d’argile grasse | oui | non | corriger |
| Eau aérée | `2o6VDQqrx5bx6rLv` | Magicien | 5 | `scripts/sorts/magicien-eau-aeree.js` | oui | Altération | une petite poignée de sels alcalins ou de bromure | oui | non | corriger |
| Extension II | `j8RBv6DtA7saCnGy` | Magicien | 5 | `scripts/sorts/magicien-extension-ii.js` | oui | Altération | aucun | oui | non | corriger |
| Invocation d’élémental | `naBatu3eatZHd1ZQ` | Magicien | 5 | `scripts/sorts/magicien-invocation-d-elemental.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Invocation de Monstre III | `PBUGHsDhjfmhPM0p` | Magicien | 5 | `scripts/sorts/magicien-invocation-de-monstre-iii.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Lithomorphose | `Smft9cj75` | Magicien | 5 | `scripts/sorts/lithomorphose.js` | oui | a_completer | argile grasse façonnée | oui | non | aide_mj_avec_vfx |
| Main d’interposition de Bigby | `Kmy6PUAQMmaBW2Dn` | Magicien | 5 | `scripts/sorts/magicien-main-d-interposition-de-bigby.js` | oui | Évocation | un gant | oui | non | corriger |
| Métempsycose | `ttJqTVO09PEhayZ1` | Magicien | 5 | `scripts/sorts/magicien-metempsycose.js` | oui | Altération | réceptacle | oui | non | corriger |
| Mur de fer | `sd1VA2m7L1HNvPxt` | Magicien | 5 | `scripts/sorts/magicien-mur-de-fer.js` | oui | Altération | un petit morceau de plaque de fer | oui | non | corriger |
| Mur de force | `AefoyJiwmSnT9qEM` | Magicien | 5 | `scripts/sorts/magicien-mur-de-force.js` | oui | Altération | une pincée de poudre de diamant (issue d’une ou plusieurs pierres) pour une valeur minimale de 10 | oui | non | corriger |
| Mur de roc | `isr5twi7UEGprtel` | Magicien | 5 | `scripts/sorts/magicien-mur-de-roc.js` | oui | Altération | un petit bloc de granit | oui | non | corriger |
| Nécro-animation | `E5Jf7Dh2lk8V5H45` | Magicien | 5 | `scripts/sorts/magicien-necro-animation.js` | oui | Nécromancie | aucun | oui | oui | corriger |
| Nuage létal | `m9giICqkP6PLgPIN` | Magicien | 5 | `scripts/sorts/magicien-nuage-letal.js` | oui | Évocation | aucun | oui | non | corriger |
| Paralysie des monstres | `C4NFQjWH7tilr2KL` | Magicien | 5 | `scripts/sorts/magicien-paralysie-des-monstres.js` | oui | Conjuration/Appel | une petite barre de métal, une pour chaque monstre visé | oui | non | corriger |
| Passe-muraille | `319ECVaG7zViAnWl` | Magicien | 5 | `scripts/sorts/magicien-passe-muraille.js` | oui | Altération | une pincée de graines de sésame | oui | non | corriger |
| Télékinésie | `bRRHc2GEzYv8h3pQ` | Magicien | 5 | `scripts/sorts/magicien-telekinesie.js` | oui | Altération | aucun | oui | non | corriger |
| Téléportation | `fz3mzpALqk4DBvS8` | Magicien | 5 | `scripts/sorts/magicien-teleportation.js` | oui | Altération | aucun | oui | non | corriger |
| Transmutation de pierre en boue | `Sd3li1719` | Magicien | 5 | `scripts/sorts/transmutation-de-pierre-en-boue.js` | oui | a_completer | aucun | oui | non | aide_mj_avec_vfx |
| Abaissement des eaux | `Sqozhllak` | Magicien | 6 | `scripts/sorts/abaissement-des-eaux.js` | oui | a_completer | petite fiole d’eau, petite fiole de poussière | oui | non | corriger |
| Bulle anti-magique | `5WMtm7xIvHpRxLhr` | Magicien | 6 | `scripts/sorts/magicien-bulle-anti-magique.js` | oui | Abjuration | aucun | oui | non | corriger |
| Chasseur invisible | `9nvajLF9dtYWr6aM` | Magicien | 6 | `scripts/sorts/magicien-chasseur-invisible.js` | oui | Conjuration/Appel | encens, bout de corne taillé en forme de croissant | oui | non | corriger |
| Contrôle du climat | `S4cpb203e` | Magicien | 6 | `scripts/sorts/controle-du-climat.js` | oui | a_completer | aucun | oui | oui | corriger |
| Désintégration | `EnOSTDnyj7jFMgr0` | Magicien | 6 | `scripts/sorts/magicien-desintegration.js` | oui | Évocation | pierre aimantée, pincée de poussière | oui | non | corriger |
| Enchantement | `87ete731gVApgoPg` | Magicien | 6 | `scripts/sorts/magicien-enchantement.js` | oui | Altération | aucun | oui | non | corriger |
| Extension III | `CJf7e3HhnfDKa8yU` | Magicien | 6 | `scripts/sorts/magicien-extension-iii.js` | oui | Altération | aucun | oui | non | corriger |
| Glissement de terrain | `HpN7G6ucRp5lTSTw` | Magicien | 6 | `scripts/sorts/magicien-glissement-de-terrain.js` | oui | Altération | mélange de terre, argile, terreau ou sable, petit sac, lame en fer | oui | non | corriger |
| Globe d’invulnérabilité | `6I5bM9qnrycTKvFM` | Magicien | 6 | `scripts/sorts/magicien-globe-d-invulnerabilite.js` | oui | Abjuration | aucun | oui | non | corriger |
| Holographie | `Srso4sdrs` | Magicien | 6 | `scripts/sorts/holographie.js` | oui | a_completer | une petite réplique (poupée) du magicien | oui | non | aide_mj_avec_vfx |
| Incantation mortelle | `wCbNKb1p4IKuYZyQ` | Magicien | 6 | `scripts/sorts/magicien-incantation-mortelle.js` | oui | Nécromancie | perle noire écrasée | oui | non | corriger |
| Invocation de monstre IV | `RIc3gsPapbFEJrRO` | Magicien | 6 | `scripts/sorts/magicien-invocation-de-monstre-iv.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Main de force de Bigby | `dD4Y9LGSZhXi7HBK` | Magicien | 6 | `scripts/sorts/magicien-main-de-force-de-bigby.js` | oui | Évocation | un gant | oui | non | corriger |
| Mythomancie | `EZOEGGOSPq7gZysz` | Magicien | 6 | `scripts/sorts/magicien-mythomancie.js` | oui | Illusion/Fantasme | de l’encens et des morceaux d’ivoire, placés en forme de rectangle; mais le magicien doit en plus sacrifier quelque chose (une potion, un parchemin ou objet magique, une créature, etc | oui | non | corriger |
| Punition spirituelle | `BB3iG4AMGXwqim5l` | Magicien | 6 | `scripts/sorts/magicien-punition-spirituelle.js` | oui | Altération | aucun | oui | non | corriger |
| Quête magique | `pw5HMMNe9CTXYfHL` | Magicien | 6 | `scripts/sorts/magicien-quete-magique.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Réincarnation | `Shqdpgv1q` | Magicien | 6 | `scripts/sorts/reincarnation.js` | oui | a_completer | petit tambour, goutte de sang | oui | non | aide_mj_avec_vfx |
| Répulsion | `a6nrRQq6KcoLOCNY` | Magicien | 6 | `scripts/sorts/magicien-repulsion.js` | oui | Altération | une paire de petites barres de fer magnétisées, attachées à deux statuettes de chien, l’une en ivoire, l’autre en ébène | oui | non | corriger |
| Séparation des eaux | `Sg4dt4buk` | Magicien | 6 | `scripts/sorts/separation-des-eaux.js` | oui | a_completer | aucun | oui | oui | corriger |
| Sphère glaciale d’Otiluke | `3VZ2hwpNHAeU7JRp` | Magicien | 6 | `scripts/sorts/magicien-sphere-glaciale-d-otiluke.js` | oui | Altération | aucun | oui | non | corriger |
| Transformation de Tenser | `zbAIGNpgVHnYqTSo` | Magicien | 6 | `scripts/sorts/magicien-transformation-de-tenser.js` | oui | Altération | potion d’héroïsme ou de super-héroïsme | oui | non | corriger |
| Transmutation de pierre en chair | `Rayebc1FcgH7qAzl` | Magicien | 6 | `scripts/sorts/magicien-transmutation-de-pierre-en-chair.js` | oui | Nécromancie | une pincée de terre et une goutte de sang; de la chaux, de l’eau et de la terre sont nécessaires pour l’inverse | oui | non | corriger |
| Transvision | `099z397bV3y5hUDt` | Magicien | 6 | `scripts/sorts/magicien-transvision.js` | oui | Divination | petit morceau de verre, petit morceau de cristal | oui | non | corriger |
| Vigiles et sentinelles | `QBSmwoiVg1fTiVbR` | Magicien | 6 | `scripts/sorts/magicien-vigiles-et-sentinelles.js` | oui | Abjuration | de l’encens à brûler, un peu de soufre et d’huile, une cordelette à nœuds, un peu de sang d’ombre des roches et une petite baguette d’argent | oui | non | corriger |
| Boule de feu à retardement | `mV9ra1fRVpnBeCjh` | Magicien | 7 | `scripts/sorts/magicien-boule-de-feu-a-retardement.js` | oui | Évocation | aucun | oui | non | corriger |
| Cacodémon | `iqIwPvTxcgl4rPbw` | Magicien | 7 | `scripts/sorts/magicien-cacodemon.js` | oui | Conjuration/Appel | cinq chandelles noires allumées, un brasero de charbons ardents dans lequel le magicien doit brûler du soufre, des fourrures de chauves-souris, du saindoux, de la suie, des cristaux d’acide mercuro-nitrique, une racine de mandragore, de l’alcool, un parchemin sur lequel est inscrit le nom du démon, sous formes de runes entourées d’un pentacle et une coupe de sang de mammifère (humain de préférence) placé dans l’endroit où sera retenu le cacodémon | oui | non | corriger |
| Charme-plantes | `sH3OXreq75Zw9e9W` | Magicien | 7 | `scripts/sorts/magicien-charme-plantes.js` | oui | Enchantement/Charme | une pincée d’humus, une goutte d’eau et une feuille ou une brindille | oui | non | corriger |
| Disparition | `m63ZR7K71ZuYpFQW` | Magicien | 7 | `scripts/sorts/magicien-disparition.js` | oui | Altération | aucun | oui | non | corriger |
| Duo-dimension | `f8pifdWCFFcLeyvl` | Magicien | 7 | `scripts/sorts/magicien-duo-dimension.js` | oui | Altération | figurine en ivoire représentant le magicien, parchemin | oui | non | corriger |
| Épée de Mordenkainen | `IXG8uzCpQ5qpIsN1` | Magicien | 7 | `scripts/sorts/magicien-epee-de-mordenkainen.js` | oui | Évocation | épée miniature en platine avec poignée et pommeau en cuivre et zinc | oui | non | corriger |
| Inversion de la gravité | `mzAdqJsIUuesaFZp` | Magicien | 7 | `scripts/sorts/magicien-inversion-de-la-gravite.js` | oui | Altération | pierre aimantée, limaille de fer | oui | non | corriger |
| Invisibilité de masse | `JDNcfhvRpMwstMnV` | Magicien | 7 | `scripts/sorts/magicien-invisibilite-de-masse.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Invocation de monstre V | `YrbPeiD5D7vKuZga` | Magicien | 7 | `scripts/sorts/magicien-invocation-de-monstre-v.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Invocation instantanée de Drawmij | `yrBFmSm59mx7Q7HN` | Magicien | 7 | `scripts/sorts/magicien-invocation-instantanee-de-drawmij.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Mot de pouvoir : « étourdissement » | `grimbAQpwEflPDvb` | Magicien | 7 | `scripts/sorts/magicien-mot-de-pouvoir-etourdissement.js` | oui | Altération | aucun | oui | non | corriger |
| Poigne de Bigby | `vvhMZVFLUPBZCsMm` | Magicien | 7 | `scripts/sorts/magicien-poigne-de-bigby.js` | oui | Évocation | un gant en cuir | oui | non | corriger |
| Porte de phase | `RZIlm8nxGzJ4NOgu` | Magicien | 7 | `scripts/sorts/magicien-porte-de-phase.js` | oui | Altération | aucun | oui | non | corriger |
| Simulacre | `TH7LxMtCxwD0LXBC` | Magicien | 7 | `scripts/sorts/magicien-simulacre.js` | oui | Illusion/Fantasme | aucun | oui | non | corriger |
| Souhait mineur | `JwVX4SDziizeDdWT` | Magicien | 7 | `scripts/sorts/magicien-souhait-mineur.js` | oui | Altération | aucun | oui | non | corriger |
| Statue | `RasgmaIC4muPvU6s` | Magicien | 7 | `scripts/sorts/magicien-statue.js` | oui | Altération | aucun | oui | non | corriger |
| Antipathie/sympathie | `BIkKCn2RR7NKs0KA` | Magicien | 8 | `scripts/sorts/magicien-antipathie-sympathie.js` | oui | Enchantement/Charme | un morceau d’alun trempé dans du vinaigre | oui | non | corriger |
| Charme-masse | `mwPBqby6Itm7W7CW` | Magicien | 8 | `scripts/sorts/magicien-charme-masse.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Clone | `Jm1AM0ecAlL7BeiN` | Magicien | 8 | `scripts/sorts/magicien-clone.js` | oui | Nécromancie | un morceau de chair de l’original | oui | non | corriger |
| Cristairain | `R9WN3By99pDgcg4Y` | Magicien | 8 | `scripts/sorts/magicien-cristairain.js` | oui | Altération | un petit morceau de verre et un petit morceau d’acier | oui | non | corriger |
| Danse irrésistible d’Otto | `MCJR3VlxLTfal1Uc` | Magicien | 8 | `scripts/sorts/magicien-danse-irresistible-d-otto.js` | oui | Enchantement/Charme | aucun | oui | non | corriger |
| Emprisonnement de l’âme | `3qJwKB09NwuQPJ5T` | Magicien | 8 | `scripts/sorts/magicien-emprisonnement-de-l-ame.js` | oui | Nécromancie | aucun | oui | non | corriger |
| Immunité magique de Serten | `XMCoIYELAPOZIT3n` | Magicien | 8 | `scripts/sorts/magicien-immunite-magique-de-serten.js` | oui | Abjuration | diamant réduit en poudre, diamant intact | oui | non | corriger |
| Invocation de monstre VI | `QWjB3yW5ZTZsqP51` | Magicien | 8 | `scripts/sorts/magicien-invocation-de-monstre-vi.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Labyrinthe | `ORN3az8leSKqVf47` | Magicien | 8 | `scripts/sorts/magicien-labyrinthe.js` | oui | Altération | aucun | oui | non | corriger |
| Mot de pouvoir : « Cécité » | `6mTt7KT00qtGZmjU` | Magicien | 8 | `scripts/sorts/magicien-mot-de-pouvoir-cecite.js` | oui | Altération | aucun | oui | non | corriger |
| Nuage incendiaire | `RXlGxnjPaqWQmINd` | Magicien | 8 | `scripts/sorts/magicien-nuage-incendiaire.js` | oui | Évocation | aucun | oui | non | corriger |
| Permanence | `BPaga50F4U0MdJmM` | Magicien | 8 | `scripts/sorts/magicien-permanence.js` | oui | Altération | aucun | oui | non | corriger |
| Poing de Bigby | `pNKBYV5nREzT4rbP` | Magicien | 8 | `scripts/sorts/magicien-poing-de-bigby.js` | oui | Évocation | un gant en cuir et un petit objet fait de 4 anneaux reliés entre eux, formant une ligne légèrement courbe, le tout attaché par une barrette en forme de «I» | oui | non | corriger |
| Protection d’esprit | `vrCUvwu6dEY2mQpa` | Magicien | 8 | `scripts/sorts/magicien-protection-d-esprit.js` | oui | Divination | aucun | oui | non | corriger |
| Symbole | `Sgvc3uuqk` | Magicien | 8 | `scripts/sorts/symbole.js` | oui | a_completer | diamant réduit en poudre, opale noire réduite en poudre | oui | oui | corriger |
| Transformation d’objets | `6SpRQBy7sR53Ptsm` | Magicien | 8 | `scripts/sorts/magicien-transformation-d-objets.js` | oui | Altération | du mercure, de la gomme arabique, et de la fumée | oui | non | corriger |
| Arrêt du temps | `tWKvW4ahVQ2ANiFR` | Magicien | 9 | `scripts/sorts/magicien-arret-du-temps.js` | oui | Altération | aucun | oui | non | corriger |
| Emprisonnement | `iykW82ri4ir2kJbY` | Magicien | 9 | `scripts/sorts/magicien-emprisonnement.js` | oui | Altération | aucun | oui | non | corriger |
| Hétéromorphisme | `SaSj5P1VI9svAYyC` | Magicien | 9 | `scripts/sorts/magicien-heteromorphisme.js` | oui | Altération | petite couronne de jade | oui | non | corriger |
| Invocation de Monstre VII | `ahm7oemgFvV85Lkp` | Magicien | 9 | `scripts/sorts/magicien-invocation-de-monstre-vii.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Main broyante de Bigby | `pDjjfXthimcJF8L7` | Magicien | 9 | `scripts/sorts/magicien-main-broyante-de-bigby.js` | oui | Évocation | gant en peau de serpent, coquille d’œuf | oui | non | corriger |
| Mot de pouvoir : « mort » | `4WhGYPz6t6SX2ImV` | Magicien | 9 | `scripts/sorts/magicien-mot-de-pouvoir-mort.js` | oui | Nécromancie | aucun | oui | non | corriger |
| Nuée de météores | `lbCWMQBWvtqGvi65` | Magicien | 9 | `scripts/sorts/magicien-nuee-de-meteores.js` | oui | Évocation | aucun | oui | non | corriger |
| Seuil | `MmczinwlejcFyrC0` | Magicien | 9 | `scripts/sorts/magicien-seuil.js` | oui | Conjuration/Appel | aucun | oui | non | corriger |
| Sort astral | `S3uv2zi0o` | Magicien | 9 | `scripts/sorts/sort-astral.js` | oui | a_completer | aucun | oui | oui | corriger |
| Souhait majeur | `9Uvnif7ea2lFaGpn` | Magicien | 9 | `scripts/sorts/magicien-souhait-majeur.js` | oui | Altération | aucun | oui | non | corriger |
| Sphère prismatique | `UNXXLQYQfLs7yKMJ` | Magicien | 9 | `scripts/sorts/magicien-sphere-prismatique.js` | oui | Altération | aucun | oui | non | corriger |
| Stase temporelle | `T61EpbWgHCtr2BRH` | Magicien | 9 | `scripts/sorts/magicien-stase-temporelle.js` | oui | Altération | aucun | oui | non | corriger |

## Contraintes pour les travaux futurs

- Compatibilité Foundry V13/V14/V15.
- DialogV2 obligatoire ; ApplicationV2 uniquement pour une fenêtre persistante.
- Aucun Dialog legacy, `new Dialog`, `Dialog.prompt` ou fallback legacy.
- Ne pas inventer de règle.
- Chaque futur onUse doit produire un effet visuel.
