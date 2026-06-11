# Génération des références de sorts

## Résultat final

- Branche : `agent-audit-sorts`
- Descriptions manquantes : 0
- Composants résolus global : 204
- Composants à vérifier global : 10
- Clerc : 74 composants résolus, 0 à vérifier
- Druide : 9 composants résolus, 1 à vérifier
- Magicien : 111 composants résolus, 9 à vérifier
- Illusionniste : 10 composants résolus, 0 à vérifier

Les descriptions présentes sont reprises strictement depuis `audit/source/reference-descriptions.json`. Les consommations non explicites restent `a_verifier`.

## Descriptions réellement manquantes

Aucune. Les 19 descriptions fournies ont été intégrées strictement dans la source.

## Règle d’arbitrage ADD2E appliquée

- Les matières, substances, poudres, plantes, liquides, pincées, gouttes, morceaux périssables et ingrédients produisant l’effet magique sont consommés par défaut.
- Les focus durables et objets réutilisables sont non consommés, sauf destruction explicite.
- Les composants alternatifs ou propres à une variante sont optionnels.
- Les composants composites mêlant focus durable et ingrédient consommable restent `a_verifier` lorsqu’ils ne peuvent pas être séparés sans invention.

## Composants à vérifier

### Clerc

Aucun.

### Druide

- druide-niveau-1: Shillelagh

### Magicien

- magicien-niveau-4: Globe mineur d'invulnérabilité
- magicien-niveau-4: Maladresse
- magicien-niveau-5: Chien fidèle de Mordenkainen
- magicien-niveau-6: Abaissement des eaux
- magicien-niveau-6: Désintégration
- magicien-niveau-6: Glissement de terrain
- magicien-niveau-6: Réincarnation
- magicien-niveau-7: Inversion de la gravité
- magicien-niveau-9: Main broyante de Bigby

### Illusionniste

Aucun.

## Composants résolus dans ce lot

- clerc-niveau-1: Résistance au froid — pincée de souffre → consomme
- clerc-niveau-3: Catalepsie — pincée de poussière d’un cimetière → consomme
- clerc-niveau-3: Nécro-animation — goutte de sang → consomme
- clerc-niveau-3: Nécro-animation — morceau de chair humaine → consomme
- clerc-niveau-4: Abaissement des eaux — pincée de poussière → consomme
- clerc-niveau-4: Bâtons à serpents — petit morceau d’écorce → consomme
- clerc-niveau-4: Bâtons à serpents — écailles de serpent → consomme
- clerc-niveau-4: Divination — encens → consomme
- clerc-niveau-4: Langage des plantes — goutte d’eau → consomme
- clerc-niveau-4: Langage des plantes — pincée de bouse → consomme
- clerc-niveau-4: Langage des plantes — flamme → consomme
- clerc-niveau-5: Communion — eau bénite → consomme
- clerc-niveau-5: Communion — encens → consomme
- clerc-niveau-5: Fléau d'insectes — grains de sucre → consomme
- clerc-niveau-5: Fléau d'insectes — amandes → consomme
- clerc-niveau-5: Fléau d'insectes — matière grasse → consomme
- clerc-niveau-5: Pilier de feu — pincée de souffre → consomme
- clerc-niveau-7: Symbole — mercure → consomme
- clerc-niveau-7: Symbole — phosphore → consomme
- clerc-niveau-7: Tremblement de terre — pincée de poussière → consomme
- clerc-niveau-7: Tremblement de terre — petit caillou → consomme
- clerc-niveau-7: Tremblement de terre — motte de terre → consomme
- druide-niveau-1: Amitié animale — du gui et un peu de nourriture appréciée par l’animal → consomme
- druide-niveau-1: Invisibilité aux animaux — du houx avec lequel le druide doit se frotter → consomme
- druide-niveau-1: Passage sans trace — aiguille de pin ou d’un autre conifère → optionnel
- druide-niveau-2: Catalepsie — une feuille morte de chêne et du gui → consomme
- druide-niveau-3: Arbre — du gui et une petite branche d’arbre → consomme
- druide-niveau-4: Invocation des créatures sylvestres — une pomme de pin et 8 baies de houx → consomme
- druide-niveau-4: Langage des plantes — typiquement druidique (à savoir du gui), ce sort est le même que le sort de niveau 4 de clerc langage des plantes → consomme
- illusionniste-niveau-1: Mur de brouillard — de la poudre de poix séchés → consomme
- illusionniste-niveau-2: Surdité — de la cire d’abeille → consomme
- illusionniste-niveau-3: Écriture illusoire — encre fabriquée à base de plomb par un alchimiste → consomme
- magicien-niveau-1: Compréhension des langues — une pincée de suie et quelques grains de sel → consomme
- magicien-niveau-1: Disque flottant de Tenser — une goutte de mercure → consomme
- magicien-niveau-1: Serviteur invisible — un bout de ficelle et un morceau de bois → consomme
- magicien-niveau-2: Bouche magique — un petit morceau de rayon de miel → consomme
- magicien-niveau-2: Corde enchantée — de la poudre de blé et un parchemin torsadé en forme de boucle → consomme
- magicien-niveau-2: Force — quelques cheveux ou un peu d’excrément d’un animal particulièrement fort — singe, ours, bœuf, etc → optionnel
- magicien-niveau-2: Fracassement — un éclat de mica → consomme
- magicien-niveau-2: Invisibilité — un cil mis dans de la gomme arabique → consomme
- magicien-niveau-2: Peur — un morceau d’os de mort-vivant (squelette, zombie, goule, ghast ou momie) → optionnel
- magicien-niveau-2: Toile d'araignée — un peu de toile d’araignée → consomme
- magicien-niveau-3: Boule de feu — une petite boule composée de fiente de chauve-souris et de souffre → consomme
- magicien-niveau-3: Clairvoyance — une pincée de poudre faite à partir de la glande pinéale d’un humain ou d’un humanoïde → optionnel
- magicien-niveau-3: Force fantasmagorique — un morceau de toison de mouton → consomme
- magicien-niveau-3: Foudre — fourrure → consomme
- magicien-niveau-3: Protection contre les projectiles normaux — une graine de légume → consomme
- magicien-niveau-3: Rafale de vent — langue de serpent → consomme
- magicien-niveau-3: Ralentissement — une goutte de mélasse → consomme
- magicien-niveau-3: Rapidité — un fragment de racine de réglisse → consomme
- magicien-niveau-3: Respiration aquatique — un petit roseau ou un brin de paille → optionnel
- magicien-niveau-3: Suggestion — une plume d’aile d’oiseau → consomme
- magicien-niveau-3: Vol — un cocon de chenille → consomme
- magicien-niveau-4: Charme-monstres — un jeu de 3 coquilles de noisettes → consomme
- magicien-niveau-4: Invocation de monstre II — un petit morceau de lait solidifié (crème épaisse ou beurre) → optionnel
- magicien-niveau-4: Mur de feu — du phosphore → consomme
- magicien-niveau-4: Mur de glace — un petit morceau de quartz ou une pierre cristalline de même type → optionnel
- magicien-niveau-4: Œil magique — un morceau de fourrure de chauve-souris → consomme
- magicien-niveau-4: Phytomorphose — une poignée de morceaux d'écorce → consomme
- magicien-niveau-4: Porte dimensionnelle — une pincée de poussière et quelques gouttes d’eau → consomme
- magicien-niveau-4: Terrain hallucinatoire — une pierre, une brindille et un morceau de plante verte, feuille ou brin d’herbe → optionnel
- magicien-niveau-5: Débilité mentale — une poignée de petites sphères d’argile, de cristal, de verre ou minérales → optionnel
- magicien-niveau-5: Distorsion des distances — un peu d’argile grasse → consomme
- magicien-niveau-5: Eau aérée — une petite poignée de sels alcalins ou de bromure → optionnel
- magicien-niveau-5: Mur de force — une pincée de poudre de diamant (issue d’une ou plusieurs pierres) pour une valeur minimale de 10 → consomme
- magicien-niveau-5: Mur de roc — un petit bloc de granit → consomme
- magicien-niveau-5: Passe-muraille — une pincée de graines de sésame → consomme
- magicien-niveau-6: Répulsion — une paire de petites barres de fer magnétisées, attachées à deux statuettes de chien, l’une en ivoire, l’autre en ébène → non_consomme
- magicien-niveau-6: Transmutation de pierre en chair — une pincée de terre et une goutte de sang; de la chaux, de l’eau et de la terre sont nécessaires pour l’inverse → optionnel
- magicien-niveau-7: Charme-plantes — une pincée d’humus, une goutte d’eau et une feuille ou une brindille → optionnel
- magicien-niveau-8: Antipathie/sympathie — un morceau d’alun trempé dans du vinaigre → optionnel
- magicien-niveau-8: Clone — un morceau de chair de l’original → consomme
- magicien-niveau-8: Cristairain — un petit morceau de verre et un petit morceau d’acier → consomme
- magicien-niveau-8: Transformation d'objets — du mercure, de la gomme arabique, et de la fumée → consomme

## Fichiers modifiés

- `audit/reference/manuel-joueurs-clerc-niveau-1.json`
- `audit/reference/manuel-joueurs-clerc-niveau-3.json`
- `audit/reference/manuel-joueurs-clerc-niveau-4.json`
- `audit/reference/manuel-joueurs-clerc-niveau-5.json`
- `audit/reference/manuel-joueurs-clerc-niveau-6.json`
- `audit/reference/manuel-joueurs-clerc-niveau-7.json`
- `audit/reference/manuel-joueurs-druide-niveau-1.json`
- `audit/reference/manuel-joueurs-druide-niveau-2.json`
- `audit/reference/manuel-joueurs-druide-niveau-3.json`
- `audit/reference/manuel-joueurs-druide-niveau-4.json`
- `audit/reference/manuel-joueurs-druide-niveau-5.json`
- `audit/reference/manuel-joueurs-druide-niveau-6.json`
- `audit/reference/manuel-joueurs-druide-niveau-7.json`
- `audit/reference/manuel-joueurs-illusionniste-niveau-1.json`
- `audit/reference/manuel-joueurs-illusionniste-niveau-2.json`
- `audit/reference/manuel-joueurs-illusionniste-niveau-3.json`
- `audit/reference/manuel-joueurs-illusionniste-niveau-4.json`
- `audit/reference/manuel-joueurs-illusionniste-niveau-5.json`
- `audit/reference/manuel-joueurs-illusionniste-niveau-6.json`
- `audit/reference/manuel-joueurs-illusionniste-niveau-7.json`
- `audit/reference/manuel-joueurs-magicien-niveau-1.json`
- `audit/reference/manuel-joueurs-magicien-niveau-2.json`
- `audit/reference/manuel-joueurs-magicien-niveau-3.json`
- `audit/reference/manuel-joueurs-magicien-niveau-4.json`
- `audit/reference/manuel-joueurs-magicien-niveau-5.json`
- `audit/reference/manuel-joueurs-magicien-niveau-6.json`
- `audit/reference/manuel-joueurs-magicien-niveau-7.json`
- `audit/reference/manuel-joueurs-magicien-niveau-8.json`
- `audit/reference/manuel-joueurs-magicien-niveau-9.json`
- `audit/rapports/REFERENCE-SPELLS-GENERATION.md`

## Validations exécutées

- JSON de référence validés avec `node audit/tools/validate-reference-schema.mjs` après chaque lot.
- Recherche finale des occurrences de `consommation: "a_verifier"`.
- Vérification de `git status --short`.
- Vérification du diff final : seuls `audit/reference/*.json` et `audit/rapports/REFERENCE-SPELLS-GENERATION.md` sont modifiés.
- 74 composants matériels ont été résolus par arbitrage ADD2E ; 10 restent à vérifier.
- Les fichiers `audit/reference/*.json` ont été régénérés depuis `audit/source/reference-descriptions.json` ; les 19 descriptions auparavant manquantes ont été propagées sans reformulation.
- Aucun script, JSON Foundry, fichier de découpage, fichier source, `system.json`, `AGENTS.md` ou workflow n'est modifié par ce commit.
