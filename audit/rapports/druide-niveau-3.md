# Audit automatique — druide-niveau-3

Généré le : 2026-06-02T08:15:45.062Z

## Fichiers

- Export découpé : `audit/decoupage_fichier/druide-niveau-3.json`
- Référence : `audit/reference/manuel-joueurs-druide-niveau-3.json`

## Résumé

- Classe : `druide`
- Niveau : `3`
- Sorts dans l’export : `9`
- Sorts attendus par la référence : `12`
- Sorts manquants : `3`
- Écarts de nom : `0`

## Comparaison à la référence

| Sort attendu | Nom | onUse | Image | Composants export |
| --- | --- | --- | --- | --- |
| Arbre | OK | OK | OK | Gui |
| Contre-poison | OK | OK | OK | V, S |
| Embroussaillement | MANQUANT | — | — | — |
| Guérison des maladies | MANQUANT | — | — | — |
| Invocation de la foudre | OK | Manquant : scripts/sorts/druide-invocation-de-la-foudre.js | OK | Gui druidique |
| Invocation d'insectes | OK | Manquant : scripts/sorts/druide-invocation-d-insectes.js | OK | Gui |
| Lithomorphose | OK | OK | OK | Gui comme composante matérielle supplémentaire |
| Paralysie animale | OK | OK | OK | Gui druidique |
| Piège sylvestre | OK | OK | OK | Gui druidique |
| Protection contre le feu | OK | OK | OK | Gui druidique |
| Pyrotechnie | MANQUANT | — | — | — |
| Respiration aquatique | OK | OK | Manquante : assets/icones/sorts/druide-respiration-aquatique.webp | V, S |

## Sorts manquants

- Embroussaillement
- Guérison des maladies
- Pyrotechnie

## Statut

`audit_genere_reference_presente`

## Limites

Ce rapport est généré automatiquement. Il ne remplace pas la vérification humaine du Manuel des joueurs, surtout pour les descriptions longues, les composants alternatifs, les versions inverses et les sorts à arbitrage MJ.
