# onUse — Clerc niveau 2

## État final

Les 12 chemins onUse déclarés par la référence Clerc niveau 2 existaient, mais utilisaient un gabarit dupliqué avec `new Dialog`, des automatismes génériques non fiables et aucun VFX. Ils ont été corrigés sans modifier les chemins Foundry.

| Sort | Script | Stratégie | VFX | Résolution conservée au MJ |
| --- | --- | --- | --- | --- |
| Augure | `scripts/sorts/augure.js` | aide MJ | `augure` + repli canvas natif | Composantes alternatives : objets divinatoires, ou infusion avec perle écrasée d’au moins 100 po. |
| Cantique | `scripts/sorts/cantique.js` | automatisation partielle | `cantique` + repli canvas natif | L’effet cesse dès que le clerc ne chante plus, se déplace ou est interrompu. |
| Charme-serpents | `scripts/sorts/charme-serpents.js` | aide MJ | `charme` + repli canvas natif | Le MJ confirme l’état, les points de vie et la durée de chaque cible. |
| Détection des charmes | `scripts/sorts/detection-des-charmes.js` | aide MJ | `detection` + repli canvas natif | Aucun état de charme n’est deviné ou révélé automatiquement. |
| Détection des pièges | `scripts/sorts/detection-des-pieges.js` | aide MJ | `detection` + repli canvas natif | Le MJ confirme les pièges présents et leur nature. |
| Langage animal | `scripts/sorts/langage-des-animaux.js` | aide MJ | `communication` + repli canvas natif | Le MJ détermine toute faveur ou service avec la réaction, le charisme et le comportement du clerc. |
| Marteau spirituel | `scripts/sorts/marteau-spirituel.js` | automatisation partielle | `projectile_magique` + repli canvas natif | Le marteau de guerre normal est lancé puis disparaît. |
| Paralysie | `scripts/sorts/paralysie.js` | automatisation partielle | `paralysie` + repli canvas natif | Les sauvegardes et l’état paralysé ne sont pas automatisés sans mécanisme système fiable. |
| Perception des alignements | `scripts/sorts/connaissance-des-alignements.js` | aide MJ | `detection` + repli canvas natif | Certains objets magiques peuvent annuler le pouvoir du sort. |
| Résistance au feu | `scripts/sorts/resistance-au-feu-resistance-au-froid.js` | automatisation partielle | `resistance_feu` + repli canvas natif | La réduction des dégâts reste au MJ faute de mécanisme centralisé confirmé. |
| Retardement du poison | `scripts/sorts/ralentissement-du-poison.js` | aide MJ | `soin` + repli canvas natif | Aucun état poison ni perte de PV n’est automatisé sans mécanisme système fiable. |
| Silence sur 5 mètres | `scripts/sorts/silence-rayon-de-15-pieds.js` | automatisation partielle | `silence` + repli canvas natif | Aucun blocage technique des composantes verbales n’est inventé. |

## Modifications justifiées

Chaque script a été modifié pour les mêmes raisons vérifiées : script existant raccordé, utilisation de Dialog legacy, gabarit générique contenant des comportements non alignés avec la référence, absence de VFX et nécessité d’un retour strict true/false. Aucun script non raccordé n’a été créé.

- **Augure** : calcule et affiche 70 % + 1 %/niveau, sans produire de réponse automatique.
- **Cantique** : rappelle les bonus/malus et les conditions d’interruption ; aucun ActiveEffect n’est créé faute de champs fiables confirmés.
- **Charme-serpents** : contrôle la présence de cibles et rappelle les limites de PV et durées contextuelles.
- **Détections / Perception** : contrôlent le nombre de cibles et fournissent l’aide divinatoire sans lire ou inventer d’état.
- **Langage animal** : confirme une cible et calcule la durée, sans automatiser la réaction.
- **Marteau spirituel** : calcule durée et valeur magique contre immunités, rappelle dégâts et composant consommé, sans créer d’arme.
- **Paralysie** : limite à 1–3 cibles et calcule durée/malus de sauvegarde, sans lancer les sauvegardes ni imposer un état non standardisé.
- **Résistance au feu** : calcule la durée et rappelle +3 / quart / moitié, sans modifier automatiquement les dégâts.
- **Retardement du poison** : calcule durée et délai post-mortem, sans état poison ni perte automatique de PV.
- **Silence sur 5 mètres** : calcule durée et affiche la zone de 9 m, sans blocage technique inventé des sorts verbaux.

## Compatibilité et limites

- Fenêtres : `foundry.applications.api.DialogV2.wait` uniquement ; aucune ApplicationV2 persistante nécessaire.
- VFX : appel à `ADD2E_PLAY_SPELL_FX`, avec repli visuel via `canvas.interface.createScrollingText`.
- Contrat : annulation et préconditions invalides retournent `false` ; lancement confirmé retourne `true`.
- Compatible Foundry V13/V14/V15 : APIs DialogV2 et canvas utilisées avec accès défensifs.
- Aucun ActiveEffect n’est ajouté : les effets concernés ne disposent pas ici de clés système centralisées confirmées.

## Validations

- 12 scripts raccordés corrigés ; aucun script créé.
- Aucun `new Dialog`, `Dialog.prompt` ou fallback legacy dans les 12 scripts.
- Chaque script contient DialogV2, ChatMessage, VFX et retours stricts true/false.
- Aucun JSON Foundry, référence, source, découpage, `system.json`, `AGENTS.md` ou workflow modifié.
