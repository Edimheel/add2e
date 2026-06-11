# Génération des références de sorts — audit des composants matériels

## Résumé final

- Sorts PHB audités contre les descriptions issues du Manuel : **411**.
- Sorts corrigés : **41**.
- Composants avec `consommation: "a_verifier"` : **0**.
- Descriptions modifiées : **0**.

## Sorts corrigés

- `Agrandissement`
- `Bâtons à serpents`
- `Bénédiction`
- `Bouclier de feu`
- `Chaos`
- `Contrôle du climat`
- `Création mineure`
- `Croissance animale`
- `Détection des mensonges`
- `Écriture`
- `Exorcisme`
- `Fléau d’insectes`
- `Flèche de feu`
- `Graines de feu`
- `Identification`
- `Infravision`
- `Invocation d'élémental`
- `Invocation d'insectes`
- `Lithomancie`
- `Lithomorphose`
- `Marche des vents`
- `Motif hypnotique`
- `Or des fous`
- `Peau d'écorce`
- `Piège à feu`
- `Piège à feu`
- `Piège sylvestre`
- `Porte dimensionnelle`
- `Protection contre le mal`
- `Quête religieuse`
- `Séparation des eaux`
- `Simulacre`
- `Soin ultime`
- `Soins majeurs`
- `Sphère glaciale d'Otiluke`
- `Statue`
- `Tempête de glace`
- `Ténèbres éternelles`
- `Ténèbres sur 5 mètres`
- `Transmutation de pierre en boue`
- `Vision`

## Cas explicitement vérifiés

- **Motif hypnotique** contient désormais le bâtonnet d’encens allumé, la baguette de cristal et les matières phosphorescentes, avec leurs alternatives et conditions.
- **Surdité** conserve uniquement la cire d’abeille ; aucun de ses composants n’est rattaché à Motif hypnotique.
- **Porte dimensionnelle** ne porte plus les composants de Tempête de glace.
- **Infravision** ne porte plus la statuette de ziggourat sans rapport avec sa description.
- **Enchantement** reste sans tableau fixe : le Manuel indique explicitement que les composants varient et sont décidés par le MD.

## Validation

- Tous les JSON modifiés sont valides.
- `node audit/tools/validate-reference-schema.mjs` exécuté avec succès.
- Total Foundry conservé : **411 Items**.
- Aucun `a_verifier` restant.
- Aucun script, découpage, source, `system.json`, `AGENTS.md` ou workflow modifié.
