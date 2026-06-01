# AGENTS.md — Règles de travail pour ADD2E

Ce fichier définit les règles obligatoires pour tout agent qui travaille sur le dépôt `Edimheel/add2e`, en particulier pour l’audit, la création, la correction et l’automatisation des sorts du système Foundry VTT ADD2E.

La branche de travail dédiée au chantier agent est :

```text
agent-audit-sorts
```

Cette branche part de :

```text
dev-grosses-modifications
```

---

## 1. Objectif général

L’objectif est de permettre un travail contrôlé sur la totalité des sorts ADD2E sans régression du système Foundry.

Les tâches principales sont :

- inventorier tous les sorts existants ;
- comparer les sorts avec les sources AD&D fournies ;
- corriger les champs JSON manquants ou incohérents ;
- classer les sorts par mécanique ;
- créer ou corriger les `onUse` uniquement quand l’automatisation est fiable ;
- vérifier ou créer les images de sorts dans le bon répertoire ;
- documenter les sorts qui doivent rester en arbitrage MJ ;
- préserver la compatibilité Foundry V13, V14 et V15 ;
- éviter toute invention de règle, de champ ou de valeur mécanique.

---

## 2. Sources de vérité

Les sources doivent être utilisées dans cet ordre de priorité.

### 2.1. Fichiers JSON Foundry existants

Les fichiers JSON commençant par `fvtt-` sont la référence stricte pour la structure des objets Foundry.

Un agent ne doit jamais inventer un schéma à partir de zéro si un fichier `fvtt-...json` existant montre déjà la structure attendue.

Exemples de champs à respecter quand ils existent :

- `name`
- `type`
- `img`
- `system`
- `system.nom`
- `system.niveau`
- `system.level`
- `system.ecole`
- `system.classe`
- `system.liste`
- `system.portee`
- `system.duree`
- `system.temps_incantation`
- `system.composantes`
- `system.jet_sauvegarde`
- `system.description`
- `system.description_reelle`
- `system.description_source`
- `system.onUse`
- `system.on_use`
- `system.onuse`
- `system.tags`
- `system.effectTags`
- `effects`
- `flags.add2e`

Si plusieurs variantes existent dans les exports, l’agent doit signaler l’incohérence avant de normaliser.

### 2.2. Manuel des joueurs

Le Manuel des joueurs est la source principale pour :

- les listes de sorts ;
- les niveaux de sorts ;
- les descriptions réelles ;
- la portée ;
- la durée ;
- les composantes ;
- le temps d’incantation ;
- les jets de sauvegarde ;
- les effets mécaniques de base.

### 2.3. Guide du Maître

Le Guide du Maître sert uniquement de source complémentaire pour :

- les règles d’arbitrage ;
- les cas ambigus ;
- les objets magiques ;
- les interactions avancées ;
- les règles qui ne figurent pas clairement dans le Manuel des joueurs.

### 2.4. Code existant du système

Le code existant du système ADD2E est une source de vérité technique. Il ne remplace pas les règles AD&D, mais il détermine comment une donnée ou un `onUse` doit être branché dans Foundry.

Avant toute correction mécanique, l’agent doit lire les fichiers réellement concernés depuis la branche cible.

### 2.5. Aucune invention

Si une valeur n’est pas trouvée dans les sources ou dans le schéma existant, l’agent doit :

1. laisser le champ vide ou conservé tel quel ;
2. ajouter une note `a_verifier` si le schéma le permet ;
3. poser une question avant de remplir une valeur incertaine.

Il est interdit d’inventer :

- un niveau de sort ;
- une durée ;
- une portée ;
- un type de jet de sauvegarde ;
- un effet automatique ;
- un composant matériel ;
- une règle de concentration ;
- une école de magie ;
- un script `onUse` qui dépasse ce que le système sait résoudre.

---

## 3. Contraintes Foundry obligatoires

### 3.1. Compatibilité Foundry

Toute modification doit être compatible avec :

- Foundry V13 ;
- Foundry V14 ;
- Foundry V15.

Ne jamais utiliser une API qui casse explicitement l’une de ces versions sans garde de compatibilité.

### 3.2. Application V2 et Dialog V2

Toute nouvelle interface doit utiliser :

- `ApplicationV2` ;
- `DialogV2`.

Il est interdit d’introduire :

- `Application` V1 ;
- `Dialog` V1 ;
- des patterns V1 obsolètes si une alternative V2 est disponible.

### 3.3. Préserver le système existant

Un agent doit éviter :

- les refontes globales ;
- les renommages massifs ;
- les changements de conventions non demandés ;
- les suppressions de champs existants ;
- les déplacements de fichiers ;
- les corrections opportunistes hors sujet.

Les corrections doivent être chirurgicales, justifiées et vérifiables.

---

## 4. Méthode GitHub obligatoire

Avant toute modification d’un fichier existant :

1. lire le fichier depuis la branche cible avec `GitHub.fetch_file` ;
2. récupérer son `sha` ;
3. analyser le contenu existant ;
4. expliquer pourquoi le fichier doit être modifié ;
5. proposer clairement la modification ;
6. ne pousser qu’après demande explicite, sauf si l’utilisateur a déjà demandé de pousser ;
7. utiliser `GitHub.update_file` avec le contenu complet corrigé et le `sha` actuel ;
8. relire le fichier après modification ;
9. vérifier que la correction attendue est bien présente ;
10. communiquer le `commit_sha`.

Pour un nouveau fichier :

1. vérifier d’abord qu’il n’existe pas avec `GitHub.fetch_file` ;
2. expliquer pourquoi le fichier est nécessaire ;
3. utiliser `GitHub.create_file` uniquement après demande explicite ;
4. relire le fichier après création ;
5. communiquer le `commit_sha`.

L’agent ne doit pas :

- lancer `git clone` ;
- utiliser un terminal pour pousser ;
- modifier un dépôt local Windows ;
- prétendre avoir testé dans Foundry ;
- pousser sur `main` sans demande explicite.

---

## 5. Découpage obligatoire du travail sur les sorts

Le travail doit être fait par petits lots.

Ordre recommandé :

1. inventaire global des sorts ;
2. audit des sorts par classe et niveau ;
3. normalisation JSON sans `onUse` ;
4. classification mécanique ;
5. audit des images ;
6. automatisation des sorts simples ;
7. automatisation des sorts complexes un par un ;
8. vérification des imports Foundry ;
9. rapport final.

Découpage conseillé :

- Clerc niveau 1 ;
- Clerc niveau 2 ;
- Clerc niveau 3 ;
- Druide niveau 1 ;
- Druide niveau 2 ;
- Magicien niveau 1 ;
- Magicien niveau 2 ;
- Illusionniste niveau 1 ;
- puis continuer niveau par niveau.

Chaque lot doit produire :

- un rapport des sorts présents ;
- les sorts manquants ;
- les doublons ;
- les écarts avec les sources ;
- les champs modifiés ;
- les `onUse` présents ou manquants ;
- les images présentes ou manquantes ;
- les sorts automatisables ;
- les sorts à garder en manuel ;
- les incertitudes.

---

## 6. Structure attendue d’un sort

Avant toute création ou correction de sort, l’agent doit vérifier le schéma réel dans les exports `fvtt-Item-...json`.

Un sort doit au minimum être analysé selon ces catégories :

```text
nom
classe / liste
niveau
ecole
portee
duree
temps_incantation
composantes
zone_effet / cible
jet_sauvegarde
description_reelle
description_source
mecanique
onUse éventuel
img
tags
effectTags
flags.add2e
```

Les noms de champs exacts doivent suivre le schéma existant du système, pas une préférence théorique.

Si le système utilise plusieurs synonymes historiques (`onUse`, `on_use`, `onuse`), ne pas supprimer les variantes sans audit préalable du moteur qui les lit.

---

## 7. Classification mécanique des sorts

Chaque sort doit être classé dans une ou plusieurs catégories.

Catégories principales :

```text
description_seulement
soin
degats
jet_sauvegarde
effet_temporaire
effet_token
zone_persistante
protection
detection
alteration_etat
invocation
illusion
charme_controle
mouvement
lumiere_obscurite
objet_cible
arbitrage_mj
```

Cette classification sert à décider :

- si un `onUse` est justifié ;
- si une image dédiée mérite une iconographie spécifique ;
- si le sort doit rester manuel.

---

## 8. Règles de création et de correction des onUse

### 8.1. Emplacement réel des scripts onUse

Les scripts `onUse` de sorts doivent être recherchés et modifiés en priorité dans :

```text
scripts/sorts/
```

Avant de créer, corriger ou remplacer un `onUse`, l’agent doit toujours vérifier s’il existe déjà un script correspondant dans `scripts/sorts/`.

Il est interdit de créer un nouveau script `onUse` sans vérifier d’abord :

- le fichier existant dans `scripts/sorts/` ;
- les chemins `onUse`, `on_use` ou `onuse` déjà présents dans le JSON du sort ;
- les scripts voisins du même niveau ou de la même famille mécanique ;
- les helpers globaux déjà utilisés dans les scripts existants.

### 8.2. Fichiers moteur à consulter avant modification d’un onUse

Les scripts de `scripts/sorts/` sont la source directe des `onUse`, mais les fichiers moteur suivants doivent être lus pour comprendre le contrat d’exécution :

```text
scripts/add2e/07-spellcasting-rules.mjs
scripts/add2e/object-magic-powers.mjs
scripts/add2e/spell-dialog-ui.mjs
scripts/add2e/15-validation-sockets.mjs
scripts/add2e/16-preparation-display.mjs
scripts/add2e/21-consumables.mjs
scripts/add2e.mjs
```

Règle : ne pas copier la logique moteur dans un `onUse`. Utiliser les helpers et relais existants quand ils existent.

### 8.3. Contrat d’exécution d’un onUse

Un `onUse` ne doit être créé que s’il apporte une automatisation fiable et testable.

Un `onUse` doit :

- retourner explicitement `true` si le sort est consommé ;
- retourner explicitement `false` si le sort ne doit pas être consommé ;
- gérer les erreurs sans bloquer Foundry ;
- afficher des messages clairs ;
- fonctionner côté MJ et côté joueur via les sockets existants si nécessaire ;
- respecter les permissions Foundry ;
- ne pas modifier un acteur/token sans vérifier l’autorité requise.

### 8.4. Interdictions

Un `onUse` ne doit pas :

- inventer un effet non présent dans les règles ;
- consommer automatiquement le sort en cas d’échec technique ;
- créer plusieurs effets identiques sans nettoyage préalable ;
- poser un effet global sur tous les acteurs portant le même nom ;
- modifier tous les tokens d’un acteur non lié sans vérification ;
- dépendre d’une API V1 obsolète ;
- utiliser `Dialog` V1 ;
- utiliser `Application` V1 ;
- nécessiter un module externe sans fallback propre ;
- casser le comportement manuel du sort ;
- créer une mécanique parallèle si `scripts/sorts/` ou les helpers existants résolvent déjà le problème.

### 8.5. Sorts simples automatisables

Automatisation généralement autorisée après vérification :

- soins directs ;
- dégâts directs simples ;
- bonus/malus temporaires simples ;
- jets de sauvegarde simples ;
- application d’un état unique ;
- suppression d’un état unique ;
- messages de chat contrôlés.

### 8.6. Sorts complexes à traiter un par un

Automatisation prudente, jamais massive :

- charme ;
- sommeil ;
- invisibilité ;
- toile d’araignée ;
- nuage puant ;
- silence ;
- dissipation de la magie ;
- illusions ;
- invocations ;
- contrôle mental ;
- sorts à interprétation ouverte ;
- sorts avec zone persistante ;
- sorts qui déplacent ou transforment des tokens.

---

## 9. Règles de gestion des images de sorts

### 9.1. Emplacement des images

Les images de sorts doivent être recherchées ou créées dans :

```text
assets/sorts/
```

Le champ `img` du sort doit pointer vers ce répertoire si le système utilise cette convention pour les icônes de sorts.

### 9.2. Audit des images

Pour chaque sort, l’agent doit vérifier :

- si une image existe déjà ;
- si l’image existante correspond bien au sort ;
- si le chemin de l’image est cohérent ;
- si l’image est réutilisable ou doit être remplacée ;
- si une nouvelle image doit être générée.

### 9.3. Génération d’image si l’image n’existe pas

Si aucune image de sort n’existe, l’agent doit prévoir la génération d’une image en rapport avec la description du sort.

Règles de génération :

- l’image doit être cohérente avec la description réelle du sort ;
- l’image doit évoquer clairement l’effet ou le thème du sort ;
- l’image doit rester lisible comme icône de sort ;
- l’image ne doit pas être générique au point de perdre l’identité du sort ;
- l’image ne doit pas inventer une mécanique différente de celle du sort ;
- si plusieurs sorts proches existent, les images doivent rester distinctes quand c’est utile.

### 9.4. Priorités graphiques

Pour générer ou choisir une image de sort, l’agent doit s’appuyer en priorité sur :

1. la description réelle du sort ;
2. son école ou sa famille magique ;
3. son effet principal ;
4. sa cible ou sa zone ;
5. l’esthétique déjà présente dans `assets/sorts/`.

### 9.5. Cas où l’image ne doit pas être modifiée

Si une image existe déjà et qu’elle est cohérente, l’agent ne doit pas la remplacer sans raison explicite.

---

## 10. Jets de sauvegarde

Un sort avec sauvegarde doit préciser :

- le type de sauvegarde ;
- si la sauvegarde annule ;
- si la sauvegarde réduit de moitié ;
- si la sauvegarde modifie seulement la durée ;
- si la sauvegarde dépend du type de cible.

Si le type exact de sauvegarde n’est pas clair, l’agent doit marquer le sort comme `arbitrage_mj` ou `a_verifier`.

Ne jamais supposer un jet de sauvegarde moderne de type D&D 5e.

---

## 11. Effets actifs et états

Lorsqu’un sort pose un effet :

- vérifier si le système a déjà une mécanique d’effets actifs ;
- vérifier les tags existants ;
- éviter les doublons ;
- retirer ou remplacer l’effet existant si nécessaire ;
- ne jamais empiler deux états identiques ;
- cibler le token ou l’acteur selon la logique du système ;
- tenir compte des acteurs liés et non liés ;
- éviter tout effet appliqué par nom d’acteur seul.

Pour les états critiques comme mort, inconscient, sommeil, paralysie ou immobilisé, vérifier le moteur existant avant d’ajouter une logique.

---

## 12. Effets visuels

Les effets visuels ne doivent jamais remplacer la mécanique.

Pour les effets visuels :

- vérifier si JB2A ou un autre module est disponible ;
- prévoir un fallback sans module ;
- ne pas créer d’animation infinie sans mécanisme d’arrêt ;
- lier la durée visuelle à la durée réelle de l’effet quand c’est possible ;
- supprimer les effets visuels à la fin du sort ;
- éviter les cercles techniques visibles si l’utilisateur demande un effet immersif.

Un sort doit rester jouable même si l’effet visuel échoue.

Si le système expose un helper global d’effet visuel, l’agent doit le réutiliser plutôt que réimplémenter une animation dans chaque `onUse`.

---

## 13. Messages de chat

Les messages de chat doivent distinguer :

- message MJ technique ;
- message joueur narratif ;
- message d’erreur ;
- popup d’information.

Pour les joueurs, éviter d’exposer inutilement :

- seuils techniques ;
- détails de calculs ;
- informations réservées MJ.

Pour le MJ, conserver les détails utiles au diagnostic et à l’arbitrage.

Les messages de notification simples doivent utiliser des popups plutôt que des warnings console quand cela concerne l’utilisateur.

---

## 14. Sockets et permissions

Toute automatisation qui modifie un acteur ou un token doit respecter les permissions Foundry.

Si le joueur ne possède pas l’autorité nécessaire :

- envoyer une demande au MJ via le système socket existant ;
- ne pas tenter une mise à jour directe qui provoque une erreur de permission ;
- journaliser clairement le routage côté MJ ;
- préserver la compatibilité V13/V14/V15.

Avant de créer un nouveau handler socket, vérifier qu’un handler générique existe déjà.

Ne pas multiplier les sockets spécifiques si le système possède déjà un relais MJ générique.

---

## 15. Tags et effectTags

Les tags doivent rester utiles au moteur d’effets.

Règles :

- ne pas créer deux conventions concurrentes pour la même notion ;
- conserver les tags déjà lus par le système ;
- préférer les tags explicites et stables ;
- ne pas supprimer un tag sans rechercher son usage dans le code ;
- synchroniser `tags` et `effectTags` seulement si le système le fait déjà pour ce type d’objet.

Exemples de familles de tags possibles :

```text
sort
sort:clerc
sort:druide
sort:magicien
sort:illusionniste
niveau_sort:1
ecole:abjuration
mecanique:soin
mecanique:degats
mecanique:jet_sauvegarde
mecanique:zone_persistante
etat:sommeil
etat:paralyse
etat:invisible
arbitrage_mj
```

Ne pas ajouter ces tags mécaniquement si le schéma existant utilise une autre convention.

---

## 16. Composantes de sorts

Pour les composantes :

- distinguer verbal, somatique et matériel ;
- ne pas inventer un composant matériel absent des sources ;
- ne pas connecter un composant à l’inventaire sans vérifier la mécanique existante ;
- si le système gère déjà les composants, utiliser cette mécanique ;
- si la mécanique n’existe pas, documenter le besoin au lieu de créer un système parallèle.

Les composants consommés doivent être explicitement identifiés par les règles ou par une décision validée.

---

## 17. Import Foundry

Tout JSON destiné à l’import Foundry doit :

- respecter le type Foundry attendu ;
- éviter les champs incompatibles V13/V14/V15 ;
- conserver les champs `_stats`, `flags`, `ownership` uniquement si le modèle d’import les accepte ;
- être validé comme JSON strict ;
- ne pas contenir de commentaire ;
- ne pas contenir de virgule finale.

Si l’utilisateur demande un JSON importable, l’agent doit se référer strictement aux documents `fvtt-...json` du projet.

---

## 18. Vérifications obligatoires avant proposition de push

Avant de proposer un push, l’agent doit fournir :

```text
Fichier concerné
Pourquoi il faut le modifier
Ce qui est modifié
Ce qui n’est pas modifié
Risques de régression
Compatibilité V13/V14/V15
Méthode de vérification dans Foundry ou console
```

Pour les sorts, ajouter :

```text
Sorts concernés
Classe/liste
Niveau
Champs corrigés
onUse créé ou non
Script scripts/sorts concerné
Image présente ou non
Chemin d’image assets/sorts concerné
Image générée ou non
Raison du onUse
Sorts laissés en arbitrage MJ
```

---

## 19. Tests et limites

L’agent peut :

- relire les fichiers GitHub ;
- vérifier la cohérence du code ;
- produire des commandes console Foundry ;
- produire des macros de test ;
- vérifier la syntaxe JSON ;
- vérifier les imports et les appels connus ;
- proposer ou générer une image de sort si elle n’existe pas.

L’agent ne peut pas :

- tester réellement dans Foundry ;
- confirmer un comportement runtime sans retour utilisateur ;
- modifier le dépôt local Windows ;
- exécuter un vrai monde Foundry ;
- garantir l’absence totale de régression sans test utilisateur.

Toute affirmation de test doit donc distinguer :

```text
vérifié par lecture de code
vérifié par syntaxe
à tester dans Foundry
confirmé par retour utilisateur
```

---

## 20. Format de rapport attendu

Chaque intervention doit produire une réponse claire :

```text
1. Diagnostic
2. Cause probable
3. Fichiers concernés
4. Modification proposée
5. Pourquoi cette modification est nécessaire
6. Risques
7. Vérification proposée
8. Demande explicite avant push, sauf si l’utilisateur a déjà demandé de pousser
```

Quand un push réussit, donner :

```text
Branche
Fichier
Commit SHA
Vérification après push
```

---

## 21. Règles spécifiques au chantier global des sorts

Pour travailler sur tous les sorts, l’agent doit suivre cette procédure.

### Étape A — Inventaire

Créer un tableau de suivi avec :

```text
nom
classe
niveau
présent dans Foundry
présent dans source
écart nom
écart niveau
écart description
écart mécanique
script scripts/sorts existant
image assets/sorts existante
statut
```

### Étape B — Normalisation

Corriger d’abord les données passives :

```text
nom
niveau
classe/liste
ecole
portee
duree
temps_incantation
composantes
jet_sauvegarde
description_reelle
source
img
```

Ne pas créer de `onUse` pendant cette étape sauf demande explicite.

### Étape C — Audit des scripts/sorts

Pour chaque sort automatisé ou automatisable :

1. chercher le chemin `onUse` dans le JSON ;
2. vérifier si le fichier cible existe dans `scripts/sorts/` ;
3. lire le script existant ;
4. comparer avec les règles AD&D ;
5. vérifier le contrat `true` / `false` ;
6. vérifier les permissions ;
7. vérifier les effets actifs ;
8. vérifier les messages MJ / joueur ;
9. vérifier les effets visuels ;
10. proposer une correction uniquement si le comportement est sûr.

### Étape D — Audit des images

Pour chaque sort :

1. lire le champ `img` ;
2. vérifier si l’image pointe vers `assets/sorts/` ou vers une convention existante valide ;
3. vérifier si le fichier image existe ;
4. si l’image manque, générer ou proposer une image cohérente avec la description du sort ;
5. ne remplacer une image existante que si elle est absente, cassée ou manifestement incohérente.

### Étape E — Automatisation sûre

Traiter les sorts simples :

```text
soins directs
dégâts directs
bonus temporaires simples
états simples
jets de sauvegarde standards
```

### Étape F — Automatisation complexe

Traiter individuellement :

```text
zones persistantes
animations
contrôles mentaux
illusions
invocations
transformations
sorts à arbitrage MJ
```

### Étape G — Validation Foundry

Pour chaque lot, fournir une macro ou une procédure de test console.

---

## 22. Principe de sécurité contre les régressions

Si une mécanique fonctionne déjà, ne pas la réécrire sans nécessité.

Si un bug est localisé dans un fichier précis, corriger le fichier précis.

Si une correction nécessite un refactor global, expliquer pourquoi et demander validation avant toute modification.

Si une ancienne version a été confirmée stable par l’utilisateur, ne pas l’écraser sans comparer.

---

## 23. Convention de décision

Quand une règle est incertaine, l’ordre de décision est :

1. source AD&D fournie ;
2. schéma JSON Foundry existant ;
3. script `onUse` existant dans `scripts/sorts/` ;
4. image existante dans `assets/sorts/` ;
5. code moteur ADD2E existant ;
6. décision explicite de l’utilisateur ;
7. note `a_verifier`.

L’agent doit préférer une correction incomplète mais sûre à une automatisation complète mais inventée.

---

## 24. Résumé impératif

Ne pas inventer.

Ne pas refondre sans demande.

Ne pas casser V13/V14/V15.

Toujours utiliser Application V2 et Dialog V2.

Toujours lire avant de modifier.

Toujours lire `scripts/sorts/` avant de créer ou corriger un `onUse`.

Toujours vérifier `assets/sorts/` avant de créer ou remplacer une image de sort.

Toujours générer une image cohérente avec la description du sort si l’image n’existe pas.

Toujours expliquer pourquoi un fichier est modifié.

Toujours relire après push.

Toujours traiter les sorts par lots.

Toujours distinguer ce qui est automatisé, manuel, incertain ou à tester dans Foundry.
