/**
 * Feuille de Monstre ADD2e — ApplicationV2
 * - Layout stabilisé
 * - Inventaire complet
 * - Injection automatique des pouvoirs d'objets
 * - Défense et sauvegardes exclusivement canoniques
 */

const ADD2E_MONSTER_SHEET_VERSION = "2026-08-07-canonical-monster-spell-resource-v16";
globalThis.ADD2E_MONSTER_SHEET_VERSION = ADD2E_MONSTER_SHEET_VERSION;

const ADD2E_MONSTER_ACTOR_SHEET_V2 = foundry?.applications?.sheets?.ActorSheetV2;
if (!ADD2E_MONSTER_ACTOR_SHEET_V2) throw new Error("[ADD2E] ActorSheetV2 introuvable pour la feuille de monstre.");
const ActorsCollection = foundry.documents.collections.Actors;

const ADD2E_LINKED_PACKS = {
  weapons: "add2e.armes",
  armors: "add2e.armures",
  spells: "add2e.sorts",
  objects: ""
};

const ADD2E_LINKED_TYPES = {
  weapons: "arme",
  armors: "armure",
  spells: "sort",
  objects: "objet"
};

const ADD2E_LINKED_GROUP_ALIASES = {
  weapons: ["weapons", "weapon", "armes", "arme"],
  armors: ["armors", "armor", "armures", "armure"],
  spells: ["spells", "spell", "sorts", "sort"],
  objects: ["objects", "object", "objets", "objet", "magicItems", "magic_items", "objetsMagiques", "objets_magiques"]
};

const ADD2E_EQUIPPABLE_POWER_TYPES = new Set(["arme", "armure", "objet", "equipement", "consommable", "loot", "conteneur"]);
const ADD2E_LINKED_INDEX_CACHE = new Map();
const ADD2E_MONSTER_CA_SYNC_LOCK = new Set();

const ADD2E_NATURAL_ATTACKS = new Set([
  "griffe", "griffes", "morsure", "bec", "serres", "serre", "dard", "queue", "coup_de_queue",
  "tentacule", "tentacules", "corne", "cornes", "sabot", "sabots", "poing", "poings", "pince", "pinces",
  "piquants", "epines", "spores", "regard", "souffle", "contact", "toucher", "constriction", "ecrasement"
]);

const ADD2E_MONSTER_SAVE_TYPES = Object.freeze([
  "mort_paralysie",
  "petrification",
  "baguettes",
  "souffle",
  "sorts"
]);

function __add2eNormalize(str) {
  return (str ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function __add2eDisplayName(value) {
  return String(value ?? "").trim();
}

function __add2eToArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (typeof raw === "object") {
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.value)) return raw.value;
    if (Array.isArray(raw.values)) return raw.values;
    if (raw.name || raw.uuid || raw.pack) return [raw];

    const numericValues = Object.keys(raw)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => raw[k]);
    if (numericValues.length) return numericValues;
  }
  return [];
}

function __add2eGetFlagObject(actor, key) {
  try {
    return actor?.getFlag?.("add2e", key) || actor?.flags?.add2e?.[key] || null;
  } catch (_e) {
    return actor?.flags?.add2e?.[key] || null;
  }
}

function __add2eGetLinkedRoot(actor) {
  return __add2eGetFlagObject(actor, "linkedItems") || __add2eGetFlagObject(actor, "importLinks") || {};
}

function __add2eGetLinkedEntries(actor, group) {
  const root = __add2eGetLinkedRoot(actor);
  const aliases = ADD2E_LINKED_GROUP_ALIASES[group] || [group];

  for (const alias of aliases) {
    if (root?.[alias]) {
      return __add2eToArray(root[alias])
        .map(entry => typeof entry === "string" ? { name: entry } : entry)
        .filter(e => e && (e.name || e.uuid));
    }
  }

  return [];
}

function __add2eAlreadyHasItem(actor, name, type) {
  const wanted = __add2eNormalize(name);
  return actor.items.find(i => i.type === type && __add2eNormalize(i.name) === wanted);
}

function __add2eFindWorldItem(name, type) {
  const wanted = __add2eNormalize(name);
  return game.items?.find(i => i.type === type && __add2eNormalize(i.name) === wanted) || null;
}

async function __add2eGetPackIndex(packId) {
  if (!packId) return [];
  if (ADD2E_LINKED_INDEX_CACHE.has(packId)) return ADD2E_LINKED_INDEX_CACHE.get(packId);
  const pack = game.packs.get(packId);
  if (!pack) {
    ADD2E_LINKED_INDEX_CACHE.set(packId, []);
    return [];
  }
  const idx = Array.from(await pack.getIndex({ fields: ["name", "type"] }) ?? []);
  ADD2E_LINKED_INDEX_CACHE.set(packId, idx);
  return idx;
}

async function __add2eFindPackItem(name, type, packId) {
  if (!packId) return null;
  const pack = game.packs.get(packId);
  if (!pack) return null;

  const wanted = __add2eNormalize(name);
  const idx = await __add2eGetPackIndex(packId);
  const entry = idx.find(e => __add2eNormalize(e.name) === wanted && (!e.type || e.type === type))
    || idx.find(e => __add2eNormalize(e.name) === wanted);
  if (!entry) return null;

  const doc = await pack.getDocument(entry._id);
  if (!doc) return null;
  if (type && doc.type !== type) return null;
  return doc;
}

async function __add2eFindAnyPackItem(name, type) {
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    const doc = await __add2eFindPackItem(name, type, pack.collection);
    if (doc) return doc;
  }
  return null;
}

async function __add2eResolveLinkedItem(entry, group) {
  const type = ADD2E_LINKED_TYPES[group];
  const defaultPack = ADD2E_LINKED_PACKS[group];

  if (entry.uuid) {
    try {
      const doc = await foundry.utils.fromUuid(entry.uuid);
      if (doc && doc.documentName === "Item" && (!type || doc.type === type)) return doc;
    } catch (_e) {}
  }

  const name = __add2eDisplayName(entry.name);
  if (!name) return null;

  const source = String(entry.source || entry.scope || "").toLowerCase();
  const packId = entry.pack || entry.compendium || defaultPack;

  if (source === "world") return __add2eFindWorldItem(name, type);
  if (source === "pack" || source === "compendium") return __add2eFindPackItem(name, type, packId);

  return __add2eFindWorldItem(name, type)
    || await __add2eFindPackItem(name, type, packId)
    || await __add2eFindAnyPackItem(name, type);
}

function __add2ePrepareEmbeddedItemData(doc, entry, group) {
  const data = doc.toObject();
  delete data._id;

  data.system = data.system || {};
  data.flags = data.flags || {};
  data.flags.add2e = data.flags.add2e || {};
  data.flags.add2e.linkedFromMonster = true;
  data.flags.add2e.linkedSource = {
    name: doc.name,
    type: doc.type,
    uuid: doc.uuid || entry.uuid || "",
    pack: entry.pack || entry.compendium || ""
  };

  if (entry.equip === true || entry.equipee === true || entry.equipped === true) data.system.equipee = true;

  if (group === "spells") {
    const memorized = Number(entry.memorized ?? entry.memorizedCount ?? entry.prepared ?? entry.count ?? 1);
    const byList = data.flags.add2e.memorizedByList && typeof data.flags.add2e.memorizedByList === "object"
      ? add2eSpellClone(data.flags.add2e.memorizedByList)
      : {};
    byList.monster = Math.max(0, Number.isFinite(memorized) ? memorized : 1);
    data.flags.add2e.memorizedByList = byList;
    delete data.flags.add2e.memorizedCount;
  }

  return data;
}

function add2eSpellClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

async function __add2eImportLinkedGroup(actor, group) {
  const entries = __add2eGetLinkedEntries(actor, group);
  const type = ADD2E_LINKED_TYPES[group];
  let imported = 0;
  let skipped = 0;
  const missing = [];

  for (const entry of entries) {
    const name = __add2eDisplayName(entry.name || entry.uuid);
    if (!name) continue;

    if (entry.name && __add2eAlreadyHasItem(actor, entry.name, type)) {
      skipped++;
      continue;
    }

    const doc = await __add2eResolveLinkedItem(entry, group);
    if (!doc) {
      missing.push(name);
      continue;
    }

    if (__add2eAlreadyHasItem(actor, doc.name, doc.type)) {
      skipped++;
      continue;
    }

    const data = __add2ePrepareEmbeddedItemData(doc, entry, group);
    await actor.createEmbeddedDocuments("Item", [data]);
    imported++;
  }

  return { group, imported, skipped, missing };
}

async function __add2eImportLegacyAttackTypes(actor) {
  const useLegacy = __add2eGetFlagObject(actor, "useAttackTypesImport") === true;
  if (!useLegacy) return { group: "legacyAttackTypes", imported: 0, skipped: 0, missing: [] };

  const raw = actor.system?.attackTypes;
  if (!raw || typeof raw !== "string") return { group: "legacyAttackTypes", imported: 0, skipped: 0, missing: [] };

  const entries = raw.split(/[,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(name => !ADD2E_NATURAL_ATTACKS.has(__add2eNormalize(name)))
    .map(name => ({ name, pack: ADD2E_LINKED_PACKS.weapons, equip: true }));

  const root = __add2eGetLinkedRoot(actor);
  root.weapons = [...__add2eToArray(root.weapons), ...entries];
  await actor.setFlag("add2e", "linkedItems", root);
  return __add2eImportLinkedGroup(actor, "weapons");
}

async function __add2eHydrateMonsterLinkedItems(actor, options = {}) {
  try {
    if (!actor || actor.type !== "monster") return null;

    const results = [];
    for (const group of ["weapons", "armors", "spells", "objects"]) {
      results.push(await __add2eImportLinkedGroup(actor, group));
    }
    results.push(await __add2eImportLegacyAttackTypes(actor));

    const imported = results.reduce((n, r) => n + (r.imported || 0), 0);
    const missing = results.flatMap(r => r.missing || []);

    await actor.setFlag("add2e", "linkedItemsHydrated", true);
    await actor.setFlag("add2e", "linkedItemsHydratedAt", Date.now());
    await add2eSyncMonsterCanonicalArmorClass(actor, "monster-linked-items-hydrated");

    if (options.notify !== false) {
      if (imported > 0) ui.notifications.info(`${actor.name} : ${imported} item(s) importé(s).`);
      else ui.notifications.info(`${actor.name} : aucun nouvel item à importer.`);
      if (missing.length) ui.notifications.warn(`${actor.name} : item(s) introuvable(s) : ${missing.join(", ")}`);
    }

    return { imported, missing, results };
  } catch (error) {
    console.error("[ADD2E][MONSTER][HYDRATE]", error);
    ui.notifications.error("Hydratation des items du monstre impossible.");
    return null;
  }
}

function __add2eMagicPowerEntries(item) {
  const resolver = globalThis.add2eMagicObjectActivePowerEntries;
  if (typeof resolver !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des pouvoirs d’objets magiques est indisponible.");
  }
  return resolver(item) ?? [];
}

function __add2eGetEquippedPowerItems(actor) {
  const usable = globalThis.add2eMagicItemEquippedOrUsable;
  if (typeof usable !== "function") {
    throw new Error("Le propriétaire canonique ADD2E de l’état utilisable des objets magiques est indisponible.");
  }
  return actor.items.filter(item =>
    ADD2E_EQUIPPABLE_POWER_TYPES.has(item.type)
    && usable(item) === true
    && __add2eMagicPowerEntries(item).length > 0
  );
}

function __add2eBuildCanonicalVirtualPowerSpell(actor, sourceItem, power, index) {
  const builder = globalThis.add2eBuildVirtualObjectPowerSort;
  if (typeof builder !== "function") {
    throw new Error("Le constructeur canonique ADD2E des pouvoirs d’objets magiques est indisponible.");
  }
  return builder(actor, sourceItem, power, index);
}

function __add2eFindVirtualPowerEntry(actor, fakeId) {
  const idBuilder = globalThis.add2eMagicPowerGeneratedId;
  for (const sourceItem of __add2eGetEquippedPowerItems(actor)) {
    for (const { power, index } of __add2eMagicPowerEntries(sourceItem)) {
      const candidateId = typeof idBuilder === "function"
        ? idBuilder(sourceItem, index)
        : sourceItem.id.substring(0, 14) + String(index).padStart(2, "0");
      if (candidateId !== fakeId) continue;
      return {
        sourceItem,
        power,
        index,
        sort: __add2eBuildCanonicalVirtualPowerSpell(actor, sourceItem, power, index)
      };
    }
  }
  return null;
}

function __add2eMonsterSpellResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine
    || typeof engine.resolveResource !== "function"
    || typeof engine.consumeResource !== "function"
    || typeof engine.recoverResource !== "function") {
    throw new Error("Le domaine canonique ADD2E resource est indisponible pour les sorts de monstre.");
  }
  return engine;
}

function __add2eMonsterSpellMemoryMap(sort) {
  const raw = sort?.flags?.add2e?.memorizedByList ?? sort?.getFlag?.("add2e", "memorizedByList") ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? add2eSpellClone(raw) : {};
}

function __add2eMonsterSpellResource(sort, options = {}) {
  if (!sort || String(sort.type ?? "").toLowerCase() !== "sort" || sort.system?.isPower === true || sort.system?.isObjectPower === true) {
    throw new Error("La ressource de mémorisation du sort de monstre est invalide.");
  }
  const actor = sort.actor ?? sort.parent ?? null;
  const level = Math.max(1, Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1);
  return {
    id: `${sort.uuid ?? sort.id}:memorization:monster`,
    type: "spell-memorization",
    label: `${sort.name} — Monstre`,
    document: sort,
    actor,
    item: sort,
    target: `monster:${level}`,
    get current() {
      return Math.max(0, Math.floor(Number(__add2eMonsterSpellMemoryMap(sort).monster) || 0));
    },
    maximum: null,
    cost: Math.max(0, Number(options.cost ?? 1) || 0),
    recovery: Math.max(0, Number(options.recovery ?? 1) || 0),
    recoveryPeriod: "manual",
    source: {
      kind: "spell",
      id: String(sort.id ?? ""),
      uuid: String(sort.uuid ?? ""),
      name: String(sort.name ?? "Sort")
    },
    context: {
      spellList: "monster",
      spellLevel: level,
      consumer: options.consumer ?? "monster-sheet"
    },
    write: async nextValue => {
      const next = Math.max(0, Math.floor(Number(nextValue) || 0));
      const byList = __add2eMonsterSpellMemoryMap(sort);
      if (next > 0) byList.monster = next;
      else delete byList.monster;
      await sort.update({
        "flags.add2e.memorizedByList": byList,
        "flags.add2e.-=memorizedCount": null
      }, {
        render: false,
        diff: false,
        add2eSpellPreparation: true,
        add2eReason: options.reason ?? "monster-spell-memorization-resource"
      });
    }
  };
}

function __add2eMonsterSpellResourceCount(sort) {
  const engine = __add2eMonsterSpellResourceEngine();
  const state = engine.resolveResource(__add2eMonsterSpellResource(sort, {
    cost: 0,
    recovery: 0,
    consumer: "monster-sheet-display"
  }), {
    cost: 0,
    recovery: 0,
    consumer: "monster-sheet-display"
  });
  return Math.max(0, Number(state?.current) || 0);
}

async function __add2eMigrateMonsterSpellMemorization(actor) {
  if (!actor || actor.type !== "monster") return 0;
  const updates = [];
  for (const sort of actor.items.filter(item => String(item?.type ?? "").toLowerCase() === "sort")) {
    if (sort.system?.isPower === true || sort.system?.isObjectPower === true) continue;
    const legacyRaw = sort.flags?.add2e?.memorizedCount;
    if (legacyRaw === undefined || legacyRaw === null || legacyRaw === "") continue;
    const byList = __add2eMonsterSpellMemoryMap(sort);
    if (!Object.prototype.hasOwnProperty.call(byList, "monster")) {
      byList.monster = Math.max(0, Math.floor(Number(legacyRaw) || 0));
    }
    updates.push({
      _id: sort.id,
      "flags.add2e.memorizedByList": byList,
      "flags.add2e.-=memorizedCount": null
    });
  }
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments("Item", updates, {
    render: false,
    diff: false,
    add2eSpellPreparation: true,
    add2eReason: "migrate-monster-memorized-count"
  });
  return updates.length;
}

function __add2eMonsterSpellView(sort, { isPower = false } = {}) {
  const power = isPower || sort?.system?.isPower === true || sort?.system?.isObjectPower === true;
  const current = power
    ? Math.max(0, Number(sort?.getFlag?.("add2e", "memorizedCount")) || 0)
    : __add2eMonsterSpellResourceCount(sort);
  const maximum = power ? Math.max(0, Number(sort?.system?.max) || 0) : null;
  return {
    _id: sort.id,
    id: sort.id,
    name: sort.name,
    img: sort.img,
    system: sort.system,
    add2eIsPower: power,
    add2eResourceCount: current,
    add2eResourceLabel: power && maximum > 0 ? `${current} / ${maximum}` : String(current)
  };
}

globalThis.add2eHydrateMonsterLinkedItems = __add2eHydrateMonsterLinkedItems;

function add2eMonsterEffectsEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveArmorClass !== "function") {
    throw new Error("Le résolveur canonique de classe d’armure ADD2E n’est pas disponible.");
  }
  return engine;
}

function add2eResolveMonsterArmorClass(actor, context = {}) {
  return add2eMonsterEffectsEngine().resolveArmorClass(actor, {
    ...context,
    actor,
    source: context.source ?? "monster-sheet-armor-class"
  });
}

function add2eResolveMonsterSavingThrows(actor) {
  if (typeof globalThis.add2eResolveSavingThrow !== "function") {
    throw new Error("Le résolveur canonique de sauvegardes ADD2E n’est pas disponible.");
  }
  return Object.fromEntries(ADD2E_MONSTER_SAVE_TYPES.map(saveType => [
    saveType,
    globalThis.add2eResolveSavingThrow(actor, saveType, {
      source: "monster-sheet-save-display",
      frontale: true
    })
  ]));
}

async function add2eSyncMonsterCanonicalArmorClass(actor, reason = "monster-canonical-armor-class-sync") {
  if (!actor || String(actor.type ?? "").toLowerCase() !== "monster") return null;
  if (ADD2E_MONSTER_CA_SYNC_LOCK.has(actor.id)) return null;

  ADD2E_MONSTER_CA_SYNC_LOCK.add(actor.id);
  try {
    const resolution = add2eResolveMonsterArmorClass(actor, { source: reason });
    const caTotal = Number(resolution?.caTotal);
    if (!Number.isFinite(caTotal)) throw new Error(`CA canonique invalide pour ${actor.name}.`);
    if (Number(actor.system?.ca_total) !== caTotal) {
      await actor.update({ "system.ca_total": caTotal }, {
        add2eInternal: true,
        add2eReason: "monster-canonical-armor-class-sync",
        render: false
      });
    }
    return resolution;
  } finally {
    ADD2E_MONSTER_CA_SYNC_LOCK.delete(actor.id);
  }
}

function add2eCollectMonsterFormData(root) {
  const form = root?.matches?.("form") ? root : root?.querySelector?.("form");
  if (!form) return {};

  const flat = Object.fromEntries(new FormData(form).entries());
  for (const checkbox of form.querySelectorAll('input[type="checkbox"][name]')) flat[checkbox.name] = checkbox.checked;
  return foundry.utils.expandObject(flat);
}

function add2eGetFilePickerClass() {
  return foundry.applications.apps.FilePicker ?? globalThis.FilePicker ?? null;
}

function add2eGetTokenConfigClass() {
  return foundry?.applications?.sheets?.TokenConfig
    ?? foundry?.applications?.apps?.TokenConfig
    ?? globalThis.TokenConfig
    ?? null;
}

function add2eOpenMonsterTokenConfig(tokenDocument, { prototype = false } = {}) {
  if (!tokenDocument) {
    ui.notifications.warn("Document de token introuvable pour ce monstre.");
    return;
  }

  const TokenConfigClass = add2eGetTokenConfigClass();
  if (!TokenConfigClass) {
    ui.notifications.error("Application TokenConfig introuvable.");
    return;
  }

  let application;
  try {
    application = new TokenConfigClass({ document: tokenDocument });
  } catch (modernError) {
    try {
      application = new TokenConfigClass(tokenDocument, { document: tokenDocument });
    } catch (legacyError) {
      console.error("[ADD2E][MONSTER_SHEET][TOKEN_CONFIG] Impossible d’ouvrir TokenConfig", {
        actor: tokenDocument?.actor?.name ?? tokenDocument?.parent?.name ?? null,
        modernError,
        legacyError
      });
      ui.notifications.error("Configuration du token impossible.");
      return;
    }
  }

  if (prototype) {
    try { application.isPrototype = true; } catch (_error) {}
  }
  return application.render(true);
}

function add2eConfigureMonsterToken(event) {
  event?.preventDefault?.();
  const tokenDocument = this.token ?? this.actor?.prototypeToken ?? this.document?.prototypeToken ?? null;
  return add2eOpenMonsterTokenConfig(tokenDocument, { prototype: !this.token });
}

function add2eConfigureMonsterPrototypeToken(event) {
  event?.preventDefault?.();
  const prototypeToken = this.actor?.prototypeToken ?? this.document?.prototypeToken ?? null;
  return add2eOpenMonsterTokenConfig(prototypeToken, { prototype: true });
}

export class Add2eMonsterSheet extends ADD2E_MONSTER_ACTOR_SHEET_V2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-monster-sheet-{id}",
    classes: ["add2e", "sheet", "actor", "monster"],
    tag: "section",
    window: { title: "ADD2e Descartes (FR) - Monstre", resizable: true },
    position: { width: 720, height: 850 },
    actions: {
      configureToken: add2eConfigureMonsterToken,
      configurePrototypeToken: add2eConfigureMonsterPrototypeToken
    }
  };

  _add2eActiveTab = null;
  _add2eRenderSequence = 0;
  _add2ePendingViews = new Map();

  get title() {
    return this.actor?.name ?? super.title;
  }

  get editable() {
    return this.actor?.isOwner === true || game.user?.isGM === true;
  }

  _getHeaderControls() {
    const controls = super._getHeaderControls?.() ?? [];
    if (this.token) return controls;

    return controls.map(control => {
      if (control?.action !== "configureToken") return control;
      return {
        ...control,
        action: "configurePrototypeToken"
      };
    });
  }

  render(options = {}, legacyOptions = {}) {
    const sequence = ++this._add2eRenderSequence;
    const root = this.element instanceof HTMLElement
      ? this.element
      : this.element?.[0] instanceof HTMLElement
        ? this.element[0]
        : null;

    const view = root
      ? this._captureViewBeforeRender(root)
      : {
          activeTab: this._add2eActiveTab ?? this._add2eReadStoredTab() ?? "combat",
          scrollTop: 0,
          scrollLeft: 0
        };

    this._add2ePendingViews.set(sequence, view);
    for (const pendingSequence of this._add2ePendingViews.keys()) {
      if (pendingSequence < sequence - 4) this._add2ePendingViews.delete(pendingSequence);
    }

    if (typeof options === "boolean") return super.render({ force: options }, legacyOptions);
    return super.render(options, legacyOptions);
  }

  async getData() {
    await __add2eMigrateMonsterSpellMemorization(this.actor);

    const armorClassResolution = add2eResolveMonsterArmorClass(this.actor, {
      source: "monster-sheet-get-data"
    });
    const saveResolutions = add2eResolveMonsterSavingThrows(this.actor);
    const system = foundry.utils.deepClone(this.actor.system ?? {});
    system.ca_total = Number(armorClassResolution.caTotal);

    const data = {
      actor: this.actor,
      object: this.actor,
      document: this.actor,
      system,
      items: this.actor.items,
      effects: this.actor.effects,
      editable: this.editable,
      owner: this.actor.isOwner,
      limited: this.actor.limited,
      options: this.options,
      armorClassResolution,
      saveResolutions,
      calculatedSaves: {
        paralysie: saveResolutions.mort_paralysie.target,
        petrification: saveResolutions.petrification.target,
        baguettes: saveResolutions.baguettes.target,
        souffle: saveResolutions.souffle.target,
        sorts: saveResolutions.sorts.target
      }
    };

    data.listeArmes = this.actor.items.filter(i => i.type === "arme");
    data.listeArmures = this.actor.items.filter(i => i.type === "armure");
    data.listeObjets = this.actor.items.filter(i => ["objet", "equipement", "consommable", "loot", "conteneur"].includes(i.type));

    const sorts = this.actor.items
      .filter(i => i.type === "sort")
      .map(sort => __add2eMonsterSpellView(sort));
    for (const sourceItem of __add2eGetEquippedPowerItems(this.actor)) {
      for (const { power, index } of __add2eMagicPowerEntries(sourceItem)) {
        const virtualSort = __add2eBuildCanonicalVirtualPowerSpell(this.actor, sourceItem, power, index);
        sorts.push(__add2eMonsterSpellView(virtualSort, { isPower: true }));
      }
    }

    const sortsParNiveau = {};
    for (const sort of sorts) {
      const niv = Number(sort.system.niveau) || 1;
      if (!sortsParNiveau[niv]) sortsParNiveau[niv] = [];
      sortsParNiveau[niv].push(sort);
    }
    data.niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
    data.sortsParNiveau = sortsParNiveau;
    data.sortsMemorizedByLevel = {};

    for (const niv of data.niveauxSorts) {
      const count = sortsParNiveau[niv]
        .filter(sort => sort.add2eIsPower !== true)
        .reduce((sum, sort) => sum + (Number(sort.add2eResourceCount) || 0), 0);
      data.sortsMemorizedByLevel[niv] = { count, max: "-" };
    }

    data.activeEffectsList = this.actor.effects.map(effect => {
      let durationStr = "Permanente";
      if (effect.duration?.rounds) durationStr = `${effect.duration.rounds} rds`;
      else if (effect.duration?.seconds) durationStr = `${effect.duration.seconds} s`;
      else if (effect.isTemporary) durationStr = "Temporaire";

      let desc = effect.description || "";
      if (!desc && effect.flags?.add2e?.tags) desc = effect.flags.add2e.tags.join(", ");

      return {
        id: effect.id,
        name: effect.name || effect.label,
        img: effect.img || effect.icon || "icons/svg/aura.svg",
        disabled: effect.disabled,
        duration: durationStr,
        description: desc,
        sourceName: effect.origin ? "Source externe" : "Propre"
      };
    });

    return data;
  }

  async _renderHTML(_context, _options) {
    const sequence = this._add2eRenderSequence;
    const data = await this.getData();
    const html = await foundry.applications.handlebars.renderTemplate("systems/add2e/templates/actor/monster-sheet.hbs", data);
    const wrapper = document.createElement("div");
    wrapper.dataset.add2eRenderSequence = String(sequence);
    wrapper.innerHTML = html;
    return wrapper;
  }

  _replaceHTML(result, content, _options) {
    const sequence = Number(result?.dataset?.add2eRenderSequence) || this._add2eRenderSequence;
    const view = this._add2ePendingViews.get(sequence) ?? {
      activeTab: this._add2eActiveTab ?? this._add2eReadStoredTab() ?? "combat",
      scrollTop: 0,
      scrollLeft: 0
    };

    content.replaceChildren(...result.childNodes);
    this.activateListeners(content);
    this._restoreViewAfterRender(content, view, sequence);
    this._add2ePendingViews.delete(sequence);
  }

  async _updateObject(_event, formData) {
    const updateData = foundry.utils.flattenObject(formData ?? {});
    if (!updateData.name || String(updateData.name).trim() === "") updateData.name = this.actor.name;
    await this.actor.update(updateData);
  }

  _add2eTabStorageKey() {
    return `add2e.monster.${this.actor?.id || "unknown"}.activeTab`;
  }

  _add2eReadStoredTab() {
    try { return sessionStorage.getItem(this._add2eTabStorageKey()) || null; }
    catch (_error) { return null; }
  }

  _add2eRememberActiveTab(tabName) {
    const tab = String(tabName || "combat").trim() || "combat";
    this._add2eActiveTab = tab;
    if (this.tabGroups && typeof this.tabGroups === "object") this.tabGroups.primary = tab;
    try { sessionStorage.setItem(this._add2eTabStorageKey(), tab); } catch (_error) {}
    return tab;
  }

  _captureViewBeforeRender(root) {
    const sheetRoot = root?.matches?.(".add2e-monster-readable-sheet")
      ? root
      : root?.querySelector?.(".add2e-monster-readable-sheet")
        ?? null;
    const body = sheetRoot?.querySelector?.(":scope > .sheet-body") ?? null;
    const rememberedTab = this._add2eActiveTab ?? this._add2eReadStoredTab();
    const domTab = sheetRoot?.querySelector?.(":scope > .sheet-tabs .item.active[data-tab]")?.dataset?.tab ?? null;
    const activeTab = rememberedTab ?? domTab ?? "combat";
    this._add2eRememberActiveTab(activeTab);
    return {
      activeTab,
      scrollTop: body?.scrollTop ?? 0,
      scrollLeft: body?.scrollLeft ?? 0
    };
  }

  _renderPreservingView(root) {
    this._captureViewBeforeRender(root);
    this.render(false);
  }

  _restoreViewAfterRender(content, view = {}, sequence = this._add2eRenderSequence) {
    const sheetRoot = content?.matches?.(".add2e-monster-readable-sheet")
      ? content
      : content?.querySelector?.(".add2e-monster-readable-sheet")
        ?? null;
    if (!sheetRoot) return;

    const nav = sheetRoot.querySelector(":scope > .sheet-tabs");
    const body = sheetRoot.querySelector(":scope > .sheet-body");
    if (!nav || !body) return;

    const links = Array.from(nav.querySelectorAll(":scope > .item[data-tab]"));
    const panels = Array.from(body.querySelectorAll(":scope > .tab[data-tab]"));
    const requested = String(
      this._add2eActiveTab
      ?? this._add2eReadStoredTab()
      ?? view.activeTab
      ?? "combat"
    );
    const available = new Set(links.map(link => String(link.dataset.tab || "")));
    const activeTab = available.has(requested)
      ? requested
      : available.has("combat")
        ? "combat"
        : String(links[0]?.dataset?.tab || "combat");

    this._add2eRememberActiveTab(activeTab);
    for (const link of links) link.classList.toggle("active", link.dataset.tab === activeTab);
    for (const panel of panels) panel.classList.toggle("active", panel.dataset.tab === activeTab);

    const scrollTop = view.scrollTop ?? 0;
    const scrollLeft = view.scrollLeft ?? 0;
    requestAnimationFrame(() => {
      if (sequence !== this._add2eRenderSequence) return;
      if (!body.isConnected) return;
      body.scrollTop = scrollTop;
      body.scrollLeft = scrollLeft;
    });
  }

  _activateAutoSubmit(root) {
    const form = root.matches?.("form") ? root : root.querySelector?.("form");
    if (!form || !this.editable) return;

    const submit = async event => {
      event?.preventDefault?.();
      this._captureViewBeforeRender(root);
      await this._updateObject(event, add2eCollectMonsterFormData(form));
    };

    form.addEventListener("submit", submit);
    for (const input of form.querySelectorAll("input, textarea, select")) input.addEventListener("change", submit);
  }

  activateListeners(content) {
    const root = content instanceof HTMLElement ? content : content?.[0];
    if (!root) return;
    const html = $(root);

    this._injectLayoutFix();
    this._activateAutoSubmit(root);

    html.off("click.add2e-monster-tabs", ".sheet-tabs .item[data-tab]")
      .on("click.add2e-monster-tabs", ".sheet-tabs .item[data-tab]", event => {
        event.preventDefault();
        const tabName = String(event.currentTarget?.dataset?.tab ?? "combat");
        const sheetRoot = event.currentTarget?.closest?.(".add2e-monster-readable-sheet");
        const nav = sheetRoot?.querySelector?.(":scope > .sheet-tabs");
        const body = sheetRoot?.querySelector?.(":scope > .sheet-body");
        this._add2eRememberActiveTab(tabName);
        nav?.querySelectorAll?.(":scope > .item[data-tab]")?.forEach(link => {
          link.classList.toggle("active", link.dataset.tab === tabName);
        });
        body?.querySelectorAll?.(":scope > .tab[data-tab]")?.forEach(panel => {
          panel.classList.toggle("active", panel.dataset.tab === tabName);
        });
      });

    html.find(".roll-save").off("click.add2e-monster-save").on("click.add2e-monster-save", async event => {
      event.preventDefault();
      event.stopPropagation();
      const saveType = String(event.currentTarget?.dataset?.saveType ?? "").trim();
      if (!ADD2E_MONSTER_SAVE_TYPES.includes(saveType)) {
        throw new Error(`Catégorie canonique de sauvegarde invalide : ${saveType || "vide"}`);
      }
      if (typeof globalThis.add2eRollSavingThrow !== "function") {
        throw new Error("L’exécuteur canonique de sauvegardes ADD2E n’est pas disponible.");
      }
      const result = await globalThis.add2eRollSavingThrow(this.actor, saveType, {
        source: "monster-sheet-save-roll",
        frontale: true,
        createChat: true,
        showDice: true
      });
      if (!result?.ok) {
        ui.notifications.warn(`Aucune valeur canonique disponible pour ${result?.resolution?.label ?? saveType}.`);
      }
    });

    html.find(".effect-control").off("click.add2e-monster-effect").on("click.add2e-monster-effect", async event => {
      event.preventDefault();
      const button = $(event.currentTarget);
      const action = button.data("action");
      const id = button.data("effectId");

      if (action === "create") {
        return this.actor.createEmbeddedDocuments("ActiveEffect", [{
          name: "Nouvel Effet",
          icon: "icons/svg/aura.svg",
          origin: this.actor.uuid,
          duration: { rounds: 1 }
        }]);
      }

      const effect = this.actor.effects.get(id);
      if (!effect) return;
      if (action === "toggle") await effect.update({ disabled: !effect.disabled });
      else if (action === "edit") return effect.sheet.render(true);
      else if (action === "delete") await effect.delete();
      await add2eSyncMonsterCanonicalArmorClass(this.actor, `monster-effect-${action}`);
    });

    html.find(".item-equip").off("click.add2e-monster-equip").on("click.add2e-monster-equip", async event => {
      event.preventDefault();
      const id = $(event.currentTarget).data("itemId");
      const item = this.actor.items.get(id);
      if (!item) return;

      const changed = await this._onEquipItem(item);
      if (changed) this._renderPreservingView(root);
    });

    html.find(".hydrate-linked-items").off("click.add2e-monster-hydrate").on("click.add2e-monster-hydrate", async event => {
      event.preventDefault();
      await __add2eHydrateMonsterLinkedItems(this.actor, { notify: true });
      this.render(false);
    });

    html.find(".item-edit, .arme-edit, .armure-edit, .sort-edit, .objet-edit").off("click.add2e-monster-edit").on("click.add2e-monster-edit", event => {
      event.preventDefault();
      const id = $(event.currentTarget).data("itemId") || $(event.currentTarget).data("sortId");
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });

    html.find(".item-delete, .arme-delete, .armure-delete, .sort-delete, .objet-delete").off("click.add2e-monster-delete").on("click.add2e-monster-delete", async event => {
      event.preventDefault();
      const id = $(event.currentTarget).data("itemId") || $(event.currentTarget).data("sortId");
      if (id) await this.actor.deleteEmbeddedDocuments("Item", [id]);
      await add2eSyncMonsterCanonicalArmorClass(this.actor, "monster-item-delete");
      this.render(false);
    });

    html.find(".arme-img-attack").off("click.add2e-monster-attack").on("click.add2e-monster-attack", event => {
      event.preventDefault();
      const id = $(event.currentTarget).data("itemId");
      const item = this.actor.items.get(id);
      if (globalThis.add2eAttackRoll) globalThis.add2eAttackRoll({ actor: this.actor, arme: item });
    });

    html.find(".sort-cast-img").off("click.add2e-monster-cast").on("click.add2e-monster-cast", async event => {
      event.preventDefault();
      const sortId = $(event.currentTarget).data("sortId");
      const embeddedSpell = this.actor.items.get(sortId);

      if (embeddedSpell) {
        if (typeof globalThis.add2eCastSpell !== "function") {
          throw new Error("Le lanceur canonique ADD2E des sorts est indisponible.");
        }
        await globalThis.add2eCastSpell({ actor: this.actor, sort: embeddedSpell });
        this.render(false);
        return;
      }

      const powerEntry = __add2eFindVirtualPowerEntry(this.actor, sortId);
      if (!powerEntry) return;
      if (typeof globalThis.add2eExecuteObjectMagicPower !== "function") {
        throw new Error("L’exécuteur canonique ADD2E des pouvoirs d’objets magiques est indisponible.");
      }
      await globalThis.add2eExecuteObjectMagicPower(
        this.actor,
        powerEntry.sourceItem,
        powerEntry.power,
        powerEntry.index,
        this
      );
      this.render(false);
    });

    html.find(".sort-memorize-plus").off("click.add2e-monster-mem-plus").on("click.add2e-monster-mem-plus", async event => {
      event.preventDefault();
      const id = $(event.currentTarget).data("sortId");
      const sort = this.actor.items.get(id);
      if (!sort) return;
      const engine = __add2eMonsterSpellResourceEngine();
      await engine.recoverResource(__add2eMonsterSpellResource(sort, {
        recovery: 1,
        consumer: "monster-sheet-memorize-plus",
        reason: "monster-spell-memorize-plus"
      }), {
        amount: 1,
        consumer: "monster-sheet-memorize-plus",
        reason: "monster-spell-memorize-plus"
      });
      this.render(false);
    });

    html.find(".sort-memorize-minus").off("click.add2e-monster-mem-minus").on("click.add2e-monster-mem-minus", async event => {
      event.preventDefault();
      const id = $(event.currentTarget).data("sortId");
      const sort = this.actor.items.get(id);
      if (!sort) return;
      const engine = __add2eMonsterSpellResourceEngine();
      const result = await engine.consumeResource(__add2eMonsterSpellResource(sort, {
        cost: 1,
        consumer: "monster-sheet-memorize-minus",
        reason: "monster-spell-memorize-minus"
      }), {
        cost: 1,
        consumer: "monster-sheet-memorize-minus",
        reason: "monster-spell-memorize-minus"
      });
      if (result?.ok !== false) this.render(false);
    });

    html.find(".toggle-sort-desc-chat").off("click.add2e-monster-desc").on("click.add2e-monster-desc", event => {
      event.preventDefault();
      const id = $(event.currentTarget).data("sortId");
      html.find(`#desc-chat-${id}`).slideToggle(200);
    });

    html.find('img[data-edit="img"]').off("click.add2e-monster-img").on("click.add2e-monster-img", event => {
      event.preventDefault();
      const FilePicker = add2eGetFilePickerClass();
      if (!FilePicker) return;
      new FilePicker({
        type: "image",
        current: this.actor.img,
        callback: path => {
          this.actor.update({ img: path, "prototypeToken.texture.src": path });
        }
      }).render(true);
    });
  }

  _injectLayoutFix() {
    const styleId = "add2e-layout-fix";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .add2e.sheet.monster .saves-section{min-height:65px!important;margin-bottom:2px!important;display:flex;gap:5px;align-items:center;justify-content:space-around;}
      .add2e.sheet.monster .sheet-tabs{margin-top:0!important;padding-top:4px!important;border-top:2px solid #333;}
      .add2e.sheet.monster .sheet-body{margin-top:0!important;height:calc(100% - 240px);}
    `;
    document.head.appendChild(style);
  }

  async _setMonsterItemEquipped(item, equipped, reason) {
    if (!item?.id || !this.actor?.updateEmbeddedDocuments) return false;

    const updated = await this.actor.updateEmbeddedDocuments(
      "Item",
      [{ _id: item.id, "system.equipee": equipped === true }],
      { add2eReason: reason }
    );
    const current = this.actor.items.get(item.id) ?? updated?.[0] ?? null;
    return current?.system?.equipee === (equipped === true);
  }

  async _onEquipItem(item) {
    const currentlyEquipped = item?.system?.equipee === true;
    const nextState = !currentlyEquipped;
    if (!ADD2E_EQUIPPABLE_POWER_TYPES.has(item.type)) return false;

    const changed = await this._setMonsterItemEquipped(
      item,
      nextState,
      nextState ? `monster-equip-${item.type}` : `monster-unequip-${item.type}`
    );
    if (changed) await add2eSyncMonsterCanonicalArmorClass(this.actor, `monster-equipment-${item.type}`);
    return changed;
  }
}

ActorsCollection.registerSheet("add2e", Add2eMonsterSheet, {
  types: ["monster"],
  makeDefault: true,
  label: "ADD2e Descartes (FR) - Monstre"
});

Hooks.on("createActiveEffect", effect => {
  const actor = effect?.parent;
  if (actor?.type === "monster") add2eSyncMonsterCanonicalArmorClass(actor, "monster-effect-create").catch(console.error);
});

Hooks.on("updateActiveEffect", effect => {
  const actor = effect?.parent;
  if (actor?.type === "monster") add2eSyncMonsterCanonicalArmorClass(actor, "monster-effect-update").catch(console.error);
});

Hooks.on("deleteActiveEffect", async effect => {
  const enlargeData = effect.flags?.add2e?.enlargeData;
  if (enlargeData) {
    const tokenDoc = canvas.scene?.tokens?.get(enlargeData.tokenId);
    if (tokenDoc && (game.user.isGM || tokenDoc.actor?.isOwner)) {
      await tokenDoc.update({
        "texture.scaleX": enlargeData.originalScale,
        "texture.scaleY": enlargeData.originalScale
      });
    }
  }

  if (globalThis.Sequencer) {
    globalThis.Sequencer.EffectManager.endEffects({ origin: effect.uuid });
    globalThis.Sequencer.EffectManager.endEffects({ name: effect.name });
  }

  const actor = effect?.parent;
  if (actor?.type === "monster") await add2eSyncMonsterCanonicalArmorClass(actor, "monster-effect-delete");
});

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (actor?.type === "monster") add2eSyncMonsterCanonicalArmorClass(actor, "monster-item-create").catch(console.error);
});

Hooks.on("updateItem", item => {
  const actor = item?.parent;
  if (actor?.type === "monster") add2eSyncMonsterCanonicalArmorClass(actor, "monster-item-update").catch(console.error);
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (actor?.type === "monster") add2eSyncMonsterCanonicalArmorClass(actor, "monster-item-delete-hook").catch(console.error);
});

Hooks.on("createToken", async tokenDoc => {
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "monster") return;
  await __add2eHydrateMonsterLinkedItems(actor, { notify: false });
});

try { globalThis.Add2eMonsterSheet = Add2eMonsterSheet; } catch (_e) {}
