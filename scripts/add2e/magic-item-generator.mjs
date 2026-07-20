// ADD2E — Intégration armes, armures et objets dans le générateur magique existant.
// Compatible Foundry V13/V14/V15 — DialogV2, sans second bouton de création.

const ADD2E_MAGIC_ITEM_GENERATOR_VERSION = "2026-07-20-magic-item-generator-v1";
const ADD2E_MAGIC_GENERATOR_TYPES = new Set(["arme", "armure", "objet"]);

const ADD2E_MAGIC_GENERATOR_PROFILES = Object.freeze({
  arme_magique: Object.freeze({
    label: "Arme magique",
    itemType: "arme",
    baseAllowed: true,
    enchantable: true,
    allowCharges: true,
    defaultCharges: 0,
    defaultMax: 0,
    img: "icons/weapons/swords/sword-guard-gold.webp",
    tags: ["objet_magique", "arme_magique"]
  }),
  armure_magique: Object.freeze({
    label: "Armure magique",
    itemType: "armure",
    baseAllowed: true,
    enchantable: true,
    allowCharges: true,
    defaultCharges: 0,
    defaultMax: 0,
    img: "icons/equipment/chest/breastplate-layered-steel.webp",
    tags: ["objet_magique", "armure_magique", "actif_si_equipe"]
  }),
  objet_magique: Object.freeze({
    label: "Objet magique libre",
    itemType: "objet",
    baseAllowed: true,
    enchantable: true,
    allowCharges: true,
    defaultCharges: 0,
    defaultMax: 0,
    sousType: "objet_magique",
    img: "icons/svg/item-bag.svg",
    tags: ["objet_magique", "actif_si_equipe"]
  }),
  anneau: Object.freeze({
    label: "Anneau",
    itemType: "objet",
    baseAllowed: false,
    enchantable: true,
    allowCharges: true,
    defaultCharges: 0,
    defaultMax: 0,
    sousType: "anneau",
    img: "icons/equipment/finger/ring-band-engraved-gold.webp",
    tags: ["objet_magique", "sous_type:anneau", "anneau", "actif_si_equipe"]
  }),
  parchemin: Object.freeze({
    label: "Parchemin",
    itemType: "objet",
    baseAllowed: false,
    enchantable: false,
    allowCharges: false,
    consumable: true,
    sousType: "parchemin_de_sort",
    img: "icons/sundries/scrolls/scroll-runed-brown.webp",
    tags: ["objet_magique", "parchemin", "parchemin_de_sort", "consommable"]
  }),
  baguette: Object.freeze({
    label: "Baguette",
    itemType: "objet",
    baseAllowed: false,
    enchantable: true,
    allowCharges: true,
    defaultCharges: 10,
    defaultMax: 10,
    defaultRechargeable: true,
    defaultRechargeFormula: "1d6",
    sousType: "baguette",
    img: "icons/weapons/wands/wand-gem-blue.webp",
    tags: ["objet_magique", "sous_type:baguette", "baguette", "charges", "actif_si_equipe"]
  }),
  batonnet: Object.freeze({
    label: "Bâtonnet",
    itemType: "objet",
    baseAllowed: false,
    enchantable: true,
    allowCharges: true,
    defaultCharges: 10,
    defaultMax: 10,
    defaultRechargeable: true,
    defaultRechargeFormula: "1d6",
    sousType: "batonnet",
    img: "icons/weapons/staves/staff-engraved-brown.webp",
    tags: ["objet_magique", "sous_type:batonnet", "batonnet", "charges", "actif_si_equipe"]
  }),
  potion: Object.freeze({
    label: "Potion",
    itemType: "objet",
    baseAllowed: false,
    enchantable: true,
    allowCharges: true,
    defaultCharges: 10,
    defaultMax: 10,
    consumable: true,
    sousType: "potion",
    img: "icons/consumables/potions/potion-bottle-corked-blue.webp",
    tags: ["objet_magique", "potion", "consommable_potion", "consommable"]
  }),
  livre_illusionniste: Object.freeze({
    label: "Livre de sorts d’illusionniste",
    itemType: "objet",
    baseAllowed: false,
    enchantable: false,
    allowCharges: false,
    spellbookOwnerList: "illusionniste",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-blue.webp"
  }),
  livre_magicien: Object.freeze({
    label: "Livre de sorts de magicien",
    itemType: "objet",
    baseAllowed: false,
    enchantable: false,
    allowCharges: false,
    spellbookOwnerList: "magicien",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-red.webp"
  })
});

function add2eMagicGeneratorEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eMagicGeneratorClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
}

function add2eMagicGeneratorNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function add2eMagicGeneratorOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function add2eMagicGeneratorValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eMagicGeneratorValues);
  if (value instanceof Set) return [...value].flatMap(add2eMagicGeneratorValues);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "values", "items", "list", "tags", "effectTags"]) {
      if (value[key] !== undefined) return add2eMagicGeneratorValues(value[key]);
    }
  }
  return [value];
}

function add2eMagicGeneratorUnique(...values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    for (const value of add2eMagicGeneratorValues(raw)) {
      const text = String(value ?? "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

function add2eMagicGeneratorGet(object, path) {
  try { return foundry.utils.getProperty(object, path); }
  catch (_error) { return String(path).split(".").reduce((current, key) => current?.[key], object); }
}

function add2eMagicGeneratorSet(object, path, value) {
  try { return foundry.utils.setProperty(object, path, value); }
  catch (_error) {
    const parts = String(path).split(".");
    let current = object;
    while (parts.length > 1) {
      const key = parts.shift();
      current[key] ??= {};
      current = current[key];
    }
    current[parts[0]] = value;
    return true;
  }
}

function add2eMagicGeneratorBasePaths(type) {
  if (type === "arme") {
    return [
      "type", "categorie", "famille", "famille_arme", "facteur_rapidité", "facteur_rapidite",
      "type_degats", "degats", "dégâts", "ajustement_ca", "portee_courte", "portee_moyenne",
      "portee_longue", "poids", "deuxMains", "arme_de_jet", "encombrante", "proprietes",
      "properties", "tags", "effectTags", "description", "prix"
    ];
  }
  if (type === "armure") {
    return [
      "ac", "ca", "armorClass", "categorie", "properties", "proprietes", "poids", "weight",
      "prix", "cost", "materiau", "type_armure", "structure", "bouclier", "tags", "effectTags",
      "description"
    ];
  }
  return [
    "categorie", "sousType", "sous_type", "quantite", "poids", "prix", "activation", "cible",
    "duree", "tags", "effectTags", "description"
  ];
}

function add2eMagicGeneratorCopyBaseSystem(baseItem, type) {
  const source = baseItem?.system ?? {};
  const system = {};
  for (const path of add2eMagicGeneratorBasePaths(type)) {
    const value = add2eMagicGeneratorGet(source, path);
    if (value !== undefined) add2eMagicGeneratorSet(system, path, add2eMagicGeneratorClone(value));
  }
  return system;
}

function add2eMagicGeneratorBaseStats(baseItem) {
  const system = baseItem?.system ?? {};
  return {
    bonusToucher: add2eMagicGeneratorNumber(system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus, 0),
    bonusDegats: add2eMagicGeneratorNumber(system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus, 0),
    bonusCA: add2eMagicGeneratorNumber(system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus, 0),
    caFixe: add2eMagicGeneratorOptionalNumber(system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac)
  };
}

function add2eMagicGeneratorItemType(item) {
  return String(item?.type ?? "").trim().toLowerCase();
}

function add2eMagicGeneratorProfileForItem(item) {
  const configured = String(item?.flags?.add2e?.magicItemProfile ?? "").trim();
  if (configured) return configured;
  const type = add2eMagicGeneratorItemType(item);
  if (type === "arme") return "arme_magique";
  if (type === "armure") return "armure_magique";
  const markers = [
    item?.name,
    item?.system?.sousType,
    item?.system?.sous_type,
    item?.system?.categorie,
    ...add2eMagicGeneratorValues(item?.system?.tags),
    ...add2eMagicGeneratorValues(item?.system?.effectTags)
  ].map(value => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  if (markers.some(value => value.includes("potion"))) return "potion";
  if (markers.some(value => value.includes("parchemin"))) return "parchemin";
  if (markers.some(value => value.includes("baguette"))) return "baguette";
  if (markers.some(value => value.includes("batonnet"))) return "batonnet";
  if (markers.some(value => value.includes("anneau"))) return "anneau";
  return type === "objet" ? "objet_magique" : "";
}

async function add2eMagicGeneratorResolveUuid(uuid) {
  const value = String(uuid ?? "").trim();
  if (!value || typeof fromUuid !== "function") return null;
  try {
    const document = await fromUuid(value);
    return document?.documentName === "Item" ? document : null;
  } catch (_error) {
    return null;
  }
}

async function add2eMagicGeneratorCollectBases() {
  const entries = [];
  const seen = new Set();
  const push = entry => {
    const uuid = String(entry?.uuid ?? "").trim();
    const type = String(entry?.type ?? "").trim().toLowerCase();
    if (!uuid || !ADD2E_MAGIC_GENERATOR_TYPES.has(type) || seen.has(uuid)) return;
    seen.add(uuid);
    entries.push({ uuid, type, name: String(entry?.name ?? "Base"), source: String(entry?.source ?? "Monde") });
  };

  for (const item of game.items ?? []) {
    push({ uuid: item.uuid, type: item.type, name: item.name, source: "Monde" });
  }

  for (const pack of game.packs ?? []) {
    if (String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;
    let index;
    try { index = await pack.getIndex({ fields: ["name", "type", "img"] }); }
    catch (_error) { continue; }
    for (const entry of index ?? []) {
      push({
        uuid: entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`,
        type: entry.type,
        name: entry.name,
        source: pack.title ?? pack.metadata?.label ?? pack.collection
      });
    }
  }

  return entries.sort((left, right) => left.type.localeCompare(right.type) || left.source.localeCompare(right.source, "fr") || left.name.localeCompare(right.name, "fr"));
}

function add2eMagicGeneratorBaseOptions(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.type}|${entry.source}`;
    if (!groups.has(key)) groups.set(key, { type: entry.type, source: entry.source, entries: [] });
    groups.get(key).entries.push(entry);
  }
  return [
    '<option value="">Aucune base</option>',
    ...[...groups.values()].map(group => {
      const label = `${group.type === "arme" ? "Armes" : group.type === "armure" ? "Armures" : "Objets"} — ${group.source}`;
      const options = group.entries.map(entry => `<option value="${add2eMagicGeneratorEscape(entry.uuid)}" data-item-type="${entry.type}">${add2eMagicGeneratorEscape(entry.name)}</option>`).join("");
      return `<optgroup label="${add2eMagicGeneratorEscape(label)}" data-item-type="${group.type}">${options}</optgroup>`;
    })
  ].join("");
}

function add2eMagicGeneratorDialogRoot(dialog) {
  const element = dialog?.element;
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

function add2eMagicGeneratorRefreshForm(form) {
  if (!(form instanceof HTMLFormElement)) return;
  const profileKey = String(form.elements.profile?.value ?? "");
  const profile = ADD2E_MAGIC_GENERATOR_PROFILES[profileKey] ?? ADD2E_MAGIC_GENERATOR_PROFILES.objet_magique;
  const itemType = profile.itemType;
  const previousProfile = String(form.dataset.currentProfile ?? "");
  const profileChanged = previousProfile !== profileKey;
  form.dataset.currentProfile = profileKey;
  form.dataset.itemType = itemType;

  const nameInput = form.elements.name;
  if (nameInput) {
    const previousDefault = String(nameInput.dataset.defaultName ?? "Objet magique");
    if (!String(nameInput.value ?? "").trim() || nameInput.value === previousDefault || nameInput.value === "Objet magique") nameInput.value = profile.label;
    nameInput.dataset.defaultName = profile.label;
  }

  const baseGroup = form.querySelector('[data-generator-section="base"]');
  if (baseGroup) baseGroup.hidden = profile.baseAllowed !== true;
  const baseSelect = form.elements.baseUuid;
  if (baseSelect) {
    for (const option of baseSelect.querySelectorAll("option[data-item-type]")) option.disabled = option.dataset.itemType !== itemType;
    if (profile.baseAllowed !== true || (baseSelect.selectedOptions[0]?.dataset?.itemType && baseSelect.selectedOptions[0].dataset.itemType !== itemType)) baseSelect.value = "";
  }

  const enchantment = form.querySelector('[data-generator-section="enchantment"]');
  if (enchantment) enchantment.hidden = profile.enchantable === false;
  const applicationGroup = form.querySelector('[data-generator-field="application"]');
  if (applicationGroup) applicationGroup.hidden = itemType !== "arme";
  const application = form.elements.application;
  if (application && itemType !== "arme") application.value = "porteur";

  const charges = form.querySelector('[data-generator-section="charges"]');
  if (charges) charges.hidden = profile.allowCharges !== true;
  if (profileChanged) {
    if (form.elements.chargesValue) form.elements.chargesValue.value = String(profile.defaultCharges ?? 0);
    if (form.elements.chargesMax) form.elements.chargesMax.value = String(profile.defaultMax ?? 0);
    if (form.elements.rechargeable) form.elements.rechargeable.checked = profile.defaultRechargeable === true;
    if (form.elements.rechargeFormula) form.elements.rechargeFormula.value = String(profile.defaultRechargeFormula ?? "1d6");
  }
}

async function add2eMagicGeneratorAskSpellCost(item, spell) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;
  return DialogV2.wait({
    window: { title: `Ajouter ${spell.name}` },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-dialog" style="min-width:440px;padding:8px"><p>Ajouter <b>${add2eMagicGeneratorEscape(spell.name)}</b> à <b>${add2eMagicGeneratorEscape(item.name)}</b>.</p><div class="form-group"><label>Coût en charges</label><input name="cost" type="number" min="0" step="1" value="1"></div></form>`,
    buttons: [
      {
        action: "add",
        label: "Ajouter le sort",
        icon: "fa-solid fa-plus",
        default: true,
        callback: (_event, button, dialog) => {
          const form = button?.form ?? add2eMagicGeneratorDialogRoot(dialog)?.querySelector("form");
          return Math.max(0, Math.trunc(Number(form?.elements?.cost?.value) || 0));
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}

async function add2eMagicGeneratorStoreSpell(item, spell) {
  if (!item || !ADD2E_MAGIC_GENERATOR_TYPES.has(add2eMagicGeneratorItemType(item))) return false;
  const profileKey = add2eMagicGeneratorProfileForItem(item);
  if (profileKey === "parchemin" || profileKey.startsWith("livre_")) return false;
  if (String(spell?.type ?? "").toLowerCase() !== "sort") {
    ui.notifications.warn("Déposez un Item de type sort.");
    return false;
  }
  if (spell.system?.isPower === true || spell.system?.isObjectPower === true || spell.system?.isCapacity === true) {
    ui.notifications.warn("Déposez le sort source, pas un pouvoir ou une capacité générée.");
    return false;
  }

  const onUse = String(spell.system?.onUse ?? spell.system?.onuse ?? spell.system?.on_use ?? spell.flags?.add2e?.onUse ?? "").trim();
  if (!onUse) {
    ui.notifications.warn(`${spell.name} ne possède aucun script onUse utilisable.`);
    return false;
  }

  const rawPowers = item.system?.pouvoirs ?? item.system?.powers ?? [];
  const powers = Array.isArray(rawPowers) ? rawPowers.filter(entry => entry && typeof entry === "object") : Object.values(rawPowers ?? {}).filter(entry => entry && typeof entry === "object");
  if (profileKey === "potion" && powers.length >= 1) {
    ui.notifications.warn("Une potion ne peut contenir qu'un seul sort ou pouvoir.");
    return false;
  }

  const sourceUuid = String(spell.flags?.core?.sourceId ?? spell._stats?.compendiumSource ?? spell.flags?.add2e?.sourceUuid ?? spell.uuid ?? "").trim();
  const normalizedName = String(spell.name ?? "").trim().toLowerCase();
  const level = Math.max(1, Number(spell.system?.niveau ?? spell.system?.level ?? 1) || 1);
  const duplicate = powers.some(power => String(power?.sourceUuid ?? power?.linkedSpell?.sourceUuid ?? "") === sourceUuid || (String(power?.name ?? power?.nom ?? "").trim().toLowerCase() === normalizedName && Number(power?.niveau ?? power?.level ?? 1) === level));
  if (duplicate) {
    ui.notifications.info(`${spell.name} est déjà présent dans ${item.name}.`);
    return false;
  }

  const cost = await add2eMagicGeneratorAskSpellCost(item, spell);
  if (cost === null || cost === undefined) return false;
  const embedded = {
    name: spell.name,
    img: spell.img || item.img || "icons/svg/book.svg",
    niveau: level,
    ecole: spell.system?.ecole ?? spell.system?.["école"] ?? spell.system?.school ?? "Magique",
    description: spell.system?.description ?? "",
    activation: spell.system?.temps_incantation ?? spell.system?.castingTime ?? "Objet magique",
    onUse,
    onuse: onUse,
    on_use: onUse,
    cost,
    cout: cost,
    chargeCost: cost,
    add2eEmbeddedSpell: true,
    sourceKind: "embedded-spell",
    sourceUuid,
    linkedSpell: {
      name: spell.name,
      img: spell.img || "icons/svg/book.svg",
      sourceUuid,
      system: add2eMagicGeneratorClone(spell.system ?? {})
    }
  };

  await item.update({
    "system.pouvoirs": [...powers, embedded],
    "system.magique": true,
    "flags.add2e.magicItemProfile": profileKey,
    "flags.add2e.magicItemBuilderVersion": ADD2E_MAGIC_ITEM_GENERATOR_VERSION
  }, { add2eInternal: true, add2eMagicItemBuilder: true, render: false });
  ui.notifications.info(`${spell.name} a été ajouté à ${item.name} pour ${cost} charge${cost > 1 ? "s" : ""}.`);
  item.sheet?.render?.({ force: true });
  globalThis.add2eRerenderActorSheet?.(item.parent, true);
  return true;
}

function add2eMagicGeneratorSpellbookData(profile, name) {
  const ownerList = String(profile.spellbookOwnerList ?? "");
  return {
    name,
    type: "objet",
    img: profile.img,
    system: {
      nom: name,
      type: "objet",
      categorie: "objet_magique",
      sousType: "livre_de_sorts",
      quantite: 1,
      poids: 5,
      equipee: false,
      magique: true,
      consommable: false,
      description: "Livre de sorts indépendant. Il peut être placé dans un coffre, ramassé et consulté par un personnage compatible.",
      arcaneDocument: { schema: 1, kind: "spellbook", personal: false, ownerList, ownerActorUuid: "", spells: [] },
      nom_non_identifie: "Livre de sorts"
    },
    effects: [],
    flags: {
      add2e: {
        arcaneDocumentKind: "spellbook",
        personalSpellbook: false,
        ownerActorUuid: "",
        ownerSpellList: ownerList,
        generatedBy: "migration-livres-parchemins-v1"
      }
    }
  };
}

function add2eMagicGeneratorBuildItemData(result, profile, baseItem, folder) {
  const type = profile.itemType;
  const name = String(result.name ?? "").trim() || profile.label;
  if (profile.spellbookOwnerList) {
    const data = add2eMagicGeneratorSpellbookData(profile, name);
    if (folder) data.folder = folder;
    return data;
  }

  const system = baseItem ? add2eMagicGeneratorCopyBaseSystem(baseItem, type) : {};
  const baseStats = baseItem ? add2eMagicGeneratorBaseStats(baseItem) : { bonusToucher: 0, bonusDegats: 0, bonusCA: 0, caFixe: null };
  const bonusToucher = profile.enchantable === false ? 0 : add2eMagicGeneratorNumber(result.bonusToucher, 0);
  const bonusDegats = profile.enchantable === false ? 0 : add2eMagicGeneratorNumber(result.bonusDegats, 0);
  const bonusCA = profile.enchantable === false ? 0 : add2eMagicGeneratorNumber(result.bonusCA, 0);
  const caFixe = profile.enchantable === false ? null : add2eMagicGeneratorOptionalNumber(result.caFixe);
  const application = type === "arme" && result.application === "source" ? "source" : "porteur";
  const generatedTags = [];
  if (application === "porteur") {
    if (bonusToucher) generatedTags.push(`bonus_attaque:${bonusToucher >= 0 ? "+" : ""}${bonusToucher}`);
    if (bonusDegats) generatedTags.push(`bonus_degats:${bonusDegats >= 0 ? "+" : ""}${bonusDegats}`);
  }

  const baseUuid = String(baseItem?.uuid ?? "");
  const enchantement = {
    schema: 1,
    baseUuid,
    baseName: String(baseItem?.name ?? ""),
    baseType: String(baseItem?.type ?? ""),
    application,
    bonusToucher,
    bonusDegats,
    bonusCA,
    caFixe,
    baseStats
  };

  system.nom = name;
  system.magique = true;
  system.identifie = result.identified === true;
  system.maudit = result.cursed === true;
  system.nom_non_identifie = String(result.unidentifiedName ?? "").trim() || (type === "arme" ? "Arme inhabituelle" : type === "armure" ? "Armure inhabituelle" : "Objet inhabituel");
  system.equipee = false;
  system.enchantement = enchantement;
  system.pouvoirs = [];
  system.tags = add2eMagicGeneratorUnique(system.tags, profile.tags);
  system.effectTags = add2eMagicGeneratorUnique(system.effectTags, profile.tags, generatedTags);

  if (type === "arme") {
    system.bonus_hit = baseStats.bonusToucher + (application === "source" ? bonusToucher : 0);
    system.bonus_dom = baseStats.bonusDegats + (application === "source" ? bonusDegats : 0);
  } else {
    system.bonus_toucher = bonusToucher;
    system.bonus_degats = bonusDegats;
  }
  system.bonus_ac = baseStats.bonusCA + bonusCA;
  system.ca_fixe = caFixe ?? baseStats.caFixe ?? null;

  if (type === "objet") {
    system.type ??= "objet";
    system.categorie ??= "objet_magique";
    if (profile.sousType) {
      system.sousType = profile.sousType;
      system.sous_type = profile.sousType;
    }
    system.quantite ??= 1;
    system.poids ??= 0;
    system.consommable = profile.consumable === true;
  }

  if (profile.allowCharges === true) {
    const max = Math.max(0, Math.trunc(add2eMagicGeneratorNumber(result.chargesMax, 0)));
    const current = Math.min(max, Math.max(0, Math.trunc(add2eMagicGeneratorNumber(result.chargesValue, 0))));
    const rechargeable = result.rechargeable === true;
    if (max > 0 || current > 0 || rechargeable) {
      system.charges = rechargeable
        ? { value: current, max, mode: "charges", recharge: "rechargeable", rechargeable: true, rechargeFormula: String(result.rechargeFormula || "1d6") }
        : { value: current, max };
      system.max_charges = max;
    }
  }

  if (profile === ADD2E_MAGIC_GENERATOR_PROFILES.parchemin) {
    system.arcaneDocument = { schema: 1, kind: "spell-scroll", personal: false, spells: [] };
  }

  const flags = {
    add2e: {
      magicItemProfile: String(result.profile ?? ""),
      magicItemBuilderVersion: ADD2E_MAGIC_ITEM_GENERATOR_VERSION,
      kind: profile.sousType ?? type,
      category: "objet_magique",
      ...(baseUuid ? { baseItemUuid: baseUuid, baseItemName: baseItem.name, baseItemType: baseItem.type } : {}),
      ...(profile === ADD2E_MAGIC_GENERATOR_PROFILES.parchemin ? { arcaneDocumentKind: "spell-scroll" } : {})
    }
  };

  const data = {
    name,
    type,
    img: baseItem?.img || profile.img,
    system,
    flags
  };
  if (folder) data.folder = folder;
  return data;
}

async function add2eMagicGeneratorDialog(directory = null) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable.");
  const bases = await add2eMagicGeneratorCollectBases();
  const profileOptions = Object.entries(ADD2E_MAGIC_GENERATOR_PROFILES)
    .map(([key, profile]) => `<option value="${key}">${add2eMagicGeneratorEscape(profile.label)}</option>`)
    .join("");
  const baseOptions = add2eMagicGeneratorBaseOptions(bases);
  let submittedData = null;

  const content = `<form class="add2e-dialog add2e-magic-item-create-form" style="min-width:620px;padding:10px">
    <style>.add2e-magic-item-create-form .add2e-generator-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.add2e-magic-item-create-form .add2e-generator-section{margin-top:10px;padding:9px;border:1px solid #b88924;border-radius:8px;background:#fffaf0}.add2e-magic-item-create-form .add2e-generator-section h3{margin:0 0 8px;color:#5b3a0e}.add2e-magic-item-create-form label{display:grid;gap:4px}.add2e-magic-item-create-form input,.add2e-magic-item-create-form select{width:100%}</style>
    <div class="add2e-generator-grid">
      <label><b>Type</b><select name="profile" onchange="globalThis.add2eMagicGeneratorRefreshForm?.(this.form)">${profileOptions}</select></label>
      <label><b>Nom</b><input name="name" type="text" value="Objet magique" data-default-name="Objet magique"></label>
      <label><b>Nom non identifié</b><input name="unidentifiedName" type="text" value="Objet inhabituel"></label>
      <label><b>État</b><span><input name="identified" type="checkbox"> Identifié &nbsp; <input name="cursed" type="checkbox"> Maudit</span></label>
    </div>
    <section class="add2e-generator-section" data-generator-section="base"><h3><i class="fas fa-link"></i> Objet de base</h3><label><b>Base copiée</b><select name="baseUuid">${baseOptions}</select></label><p>La base fournit les caractéristiques ordinaires. Les bonus, charges et pouvoirs magiques sont ajoutés par-dessus.</p></section>
    <section class="add2e-generator-section" data-generator-section="enchantment"><h3><i class="fas fa-wand-magic-sparkles"></i> Enchantement</h3><div class="add2e-generator-grid"><label><b>Bonus toucher</b><input name="bonusToucher" type="number" step="1" value="0"></label><label><b>Bonus dégâts</b><input name="bonusDegats" type="number" step="1" value="0"></label><label><b>Bonus CA</b><input name="bonusCA" type="number" step="1" value="0"></label><label><b>CA fixe</b><input name="caFixe" type="number" step="1" value="" placeholder="Aucune"></label><label data-generator-field="application"><b>Application</b><select name="application"><option value="source">Cette arme uniquement</option><option value="porteur">Toutes les attaques du porteur</option></select></label></div></section>
    <section class="add2e-generator-section" data-generator-section="charges"><h3><i class="fas fa-battery-three-quarters"></i> Charges</h3><div class="add2e-generator-grid"><label><b>Actuelles</b><input name="chargesValue" type="number" min="0" step="1" value="0"></label><label><b>Maximum</b><input name="chargesMax" type="number" min="0" step="1" value="0"></label><label><b>Recharge</b><span><input name="rechargeable" type="checkbox"> Rechargeable</span></label><label><b>Formule</b><input name="rechargeFormula" type="text" value="1d6"></label></div></section>
    <p style="font-size:.85em;opacity:.8">Les pouvoirs sont ajoutés ensuite depuis l’onglet Pouvoirs de la feuille créée, par dépôt d’un sort. Potion : un seul pouvoir. Les profils historiques restent disponibles.</p>
    <img src="icons/svg/d20-grey.svg" alt="" style="display:none" onload="globalThis.add2eMagicGeneratorRefreshForm?.(this.closest('form'))">
  </form>`;

  const dialogResult = await DialogV2.wait({
    window: { title: "Créer un objet magique" },
    modal: true,
    rejectClose: false,
    content,
    buttons: [
      {
        action: "create",
        label: "Créer l'objet magique",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button, dialog) => {
          const form = button?.form ?? add2eMagicGeneratorDialogRoot(dialog)?.querySelector("form.add2e-magic-item-create-form");
          if (!form) return null;
          const data = Object.fromEntries(new FormData(form).entries());
          submittedData = {
            profile: String(data.profile ?? "").trim(),
            name: String(data.name ?? "").trim(),
            unidentifiedName: String(data.unidentifiedName ?? "").trim(),
            identified: form.elements.identified?.checked === true,
            cursed: form.elements.cursed?.checked === true,
            baseUuid: String(data.baseUuid ?? "").trim(),
            application: String(data.application ?? "porteur").trim(),
            bonusToucher: add2eMagicGeneratorNumber(data.bonusToucher, 0),
            bonusDegats: add2eMagicGeneratorNumber(data.bonusDegats, 0),
            bonusCA: add2eMagicGeneratorNumber(data.bonusCA, 0),
            caFixe: data.caFixe === "" ? null : add2eMagicGeneratorOptionalNumber(data.caFixe),
            chargesValue: Math.max(0, Math.trunc(add2eMagicGeneratorNumber(data.chargesValue, 0))),
            chargesMax: Math.max(0, Math.trunc(add2eMagicGeneratorNumber(data.chargesMax, 0))),
            rechargeable: form.elements.rechargeable?.checked === true,
            rechargeFormula: String(data.rechargeFormula ?? "1d6").trim() || "1d6"
          };
          return submittedData;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });

  const result = dialogResult && typeof dialogResult === "object" ? dialogResult : submittedData;
  if (!result) return null;
  const profile = ADD2E_MAGIC_GENERATOR_PROFILES[result.profile];
  if (!profile) return ui.notifications.error("Le type d'objet magique sélectionné n'a pas pu être lu.");

  let baseItem = null;
  if (profile.baseAllowed === true && result.baseUuid) {
    baseItem = await add2eMagicGeneratorResolveUuid(result.baseUuid);
    if (!baseItem) return ui.notifications.error("L'objet de base sélectionné est introuvable.");
    if (add2eMagicGeneratorItemType(baseItem) !== profile.itemType) return ui.notifications.error(`La base doit être un Item de type ${profile.itemType}.`);
  }

  const folder = directory?.currentFolder?.id ?? directory?.folder?.id ?? null;
  const itemData = add2eMagicGeneratorBuildItemData(result, profile, baseItem, folder);
  const ItemClass = CONFIG?.Item?.documentClass ?? globalThis.Item;
  const created = await ItemClass.create(itemData, { renderSheet: false });
  created?.sheet?.render?.({ force: true });
  ui.notifications.info(`${created?.name ?? itemData.name} a été créé.`);
  return created;
}

function add2eMagicGeneratorInstallDirectoryButton(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] instanceof HTMLElement ? html[0] : app?.element;
  const existing = root?.querySelector?.(".add2e-create-magic-item");
  if (!existing || existing.dataset.add2eEnhancedGenerator === "1") return;
  const button = existing.cloneNode(true);
  button.dataset.add2eEnhancedGenerator = "1";
  button.title = "Créer un objet magique, une arme magique ou une armure magique";
  existing.replaceWith(button);
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    add2eMagicGeneratorDialog(app).catch(error => {
      console.error("[ADD2E][OBJET_MAGIQUE][GENERATOR][CREATE_ERROR]", error);
      ui.notifications.error(error?.message || "Erreur pendant la création de l'objet magique.");
    });
  });
}

Hooks.on("renderItemDirectory", add2eMagicGeneratorInstallDirectoryButton);
Hooks.on("renderSidebarTab", (app, html) => {
  const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase();
  if (id.includes("item")) add2eMagicGeneratorInstallDirectoryButton(app, html);
});

globalThis.ADD2E_MAGIC_ITEM_GENERATOR_VERSION = ADD2E_MAGIC_ITEM_GENERATOR_VERSION;
globalThis.add2eMagicGeneratorRefreshForm = add2eMagicGeneratorRefreshForm;
globalThis.add2eCreateMagicItem = add2eMagicGeneratorDialog;
globalThis.add2eStoreSpellInMagicItem = add2eMagicGeneratorStoreSpell;
globalThis.add2eMagicBuilderProfile = add2eMagicGeneratorProfileForItem;
