# Sauvegarde avant reconstruction marchands

Branche : `dev-multiclasse`
Date : 2026-06-14

Cette sauvegarde conserve les identifiants exacts des fichiers avant suppression/reconstruction de la mécanique marchand.

Fichiers impactés et SHA avant reconstruction :

- `scripts/add2e/22-vendor.mjs` : `7bf0be18335889be556ea80b1b7528ef0cbcc08c`
- `scripts/add2e/22a-vendor-core.mjs` : `b2fcbc7db1418c1451344c89d11b68239997dec1`
- `scripts/add2e/22b-vendor-app.mjs` : `714b870c35e59dbf1dcdee36d1c7466042ed44ab`

Contexte : reconstruction complète de la mécanique du marchand de composants/projectiles.

Sources externes consultées :

- Foundry V14 ApplicationV2 : ApplicationV2 rend un HTMLElement dans l’interface Foundry.
- Foundry V14 DialogV2 : DialogV2 est dans l’API ApplicationV2.
- Item Piles : module existant de piles/merchants/trading ; architecture trop large pour ADD2E, mais principe retenu : acteur marchand + UI dédiée + transactions côté autorité/MJ.

Le retour arrière peut se faire en récupérant les blobs ci-dessus depuis GitHub.