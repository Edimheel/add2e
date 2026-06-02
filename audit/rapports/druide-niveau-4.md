# Audit automatique — druide-niveau-4

Généré le : 2026-06-02T07:33:34.116Z

## Fichiers

- Export découpé : `audit/decoupage_fichier/druide-niveau-4.json`
- Référence : `audit/reference/manuel-joueurs-druide-niveau-4.json`

## Résumé

- Classe : `druide`
- Niveau : `4`
- Sorts dans l’export : `10`
- Sorts attendus par la référence : `12`
- Sorts manquants : `3`
- Écarts de nom : `0`

## Comparaison à la référence

| Sort attendu | Nom | onUse | Image | Composants export |
| --- | --- | --- | --- | --- |
| Contrôle de la température sur 3 m | OK | OK | OK | Gui druidique |
| Dissipation de la magie | MANQUANT | — | — | — |
| Embrasement | OK | Manquant : scripts/sorts/druide-embrasement.js | OK | Gui druidique |
| Forêt hallucinatoire | OK | Manquant : scripts/sorts/druide-foret-hallucinatoire.js | OK | Gui druidique |
| Invocation animale I | OK | Manquant : scripts/sorts/druide-invocation-animale-i.js | OK | Gui druidique |
| Invocation des créatures sylvestres | OK | Manquant : scripts/sorts/druide-invocation-des-creatures-sylvestres.js | OK | 8 baies de houx |
| Langage des plantes | MANQUANT | — | — | — |
| Paralysie végétale | OK | OK | OK | Gui druidique |
| Porte végétale | OK | OK | OK | Gui druidique |
| Protection contre la foudre | OK | OK | OK | Gui druidique |
| Répulsion des insectes | OK | OK | OK | Gui ; 7 feuilles de navet écrasées |
| Soins majeurs | MANQUANT | — | — | — |

## Sorts manquants

- Dissipation de la magie
- Langage des plantes
- Soins majeurs

## Sorts présents hors correspondance stricte

- Dissipation de magie

## Statut

`audit_genere_reference_presente`

## Limites

Ce rapport est généré automatiquement. Il ne remplace pas la vérification humaine du Manuel des joueurs, surtout pour les descriptions longues, les composants alternatifs, les versions inverses et les sorts à arbitrage MJ.
