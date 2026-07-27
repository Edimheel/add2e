// ADD2E — Objets magiques : profils statiques du créateur.

export const ADD2E_MAGIC_CREATOR_PROFILES = Object.freeze({
  objet: Object.freeze({
    label: "Objet",
    itemType: "objet",
    sousType: "objet_magique",
    img: "icons/svg/item-bag.svg",
    tags: ["objet_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  arme: Object.freeze({
    label: "Arme",
    itemType: "arme",
    baseType: "arme",
    img: "icons/weapons/swords/sword-guard-gold.webp",
    tags: ["objet_magique", "arme_magique"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  armure: Object.freeze({
    label: "Armure",
    itemType: "armure",
    baseType: "armure",
    img: "icons/equipment/chest/breastplate-layered-steel.webp",
    tags: ["objet_magique", "armure_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  anneau: Object.freeze({
    label: "Anneau",
    itemType: "objet",
    sousType: "anneau",
    img: "icons/equipment/finger/ring-band-engraved-gold.webp",
    tags: ["objet_magique", "sous_type:anneau", "anneau", "actif_si_equipe"],
    enchantable: true,
    charges: false
  }),
  parchemin: Object.freeze({
    label: "Parchemin",
    itemType: "objet",
    sousType: "parchemin_de_sort",
    img: "icons/sundries/scrolls/scroll-runed-brown.webp",
    tags: ["objet_magique", "parchemin", "parchemin_de_sort", "consommable"],
    consumable: true,
    enchantable: false,
    charges: false
  }),
  baguette: Object.freeze({
    label: "Baguette",
    itemType: "objet",
    sousType: "baguette",
    img: "icons/weapons/wands/wand-gem-blue.webp",
    tags: ["objet_magique", "sous_type:baguette", "baguette", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  batonnet: Object.freeze({
    label: "Bâtonnet",
    itemType: "objet",
    sousType: "batonnet",
    img: "icons/weapons/staves/staff-engraved-brown.webp",
    tags: ["objet_magique", "sous_type:batonnet", "batonnet", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  potion: Object.freeze({
    label: "Potion",
    itemType: "objet",
    sousType: "potion",
    img: "icons/consumables/potions/potion-bottle-corked-blue.webp",
    tags: ["objet_magique", "potion", "consommable_potion", "consommable"],
    consumable: true,
    enchantable: true,
    charges: true,
    defaultCharges: 10,
    defaultMax: 10
  }),
  livre_illusionniste: Object.freeze({
    label: "Livre de sorts d’illusionniste",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-blue.webp",
    spellbookOwnerList: "illusionniste",
    enchantable: false,
    charges: false
  }),
  livre_magicien: Object.freeze({
    label: "Livre de sorts de magicien",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-red.webp",
    spellbookOwnerList: "magicien",
    enchantable: false,
    charges: false
  })
});
