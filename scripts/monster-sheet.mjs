/**
 * Feuille de Monstre ADD2e - Version Finale Dynamique
 * - Layout stabilisé (CSS injecté)
 * - Inventaire complet (Armes, Armures, Loot)
 * - Injection automatique des pouvoirs d'objets (Baguettes, etc.)
 * - NETTOYAGE VISUEL AUTOMATIQUE (Hooks à la fin du fichier)
 */

// TABLE DE SAUVEGARDE GUERRIER (AD&D 2e)
const FIGHTER_SAVES = [
  { level: 0,  saves: [16, 17, 18, 20, 19] }, // < 1 DV
  { level: 1,  saves: [14, 16, 15, 17, 17] }, // 1-2 DV
  { level: 3,  saves: [13, 15, 14, 16, 16] }, // 3-4 DV
  { level: 5,  saves: [11, 13, 12, 13, 14] }, // 5-6 DV
  { level: 7,  saves: [10, 12, 11, 12, 13] }, // 7-8 DV
  { level: 9,  saves: [8,  10, 9,  9,  11] }, // 9-10 DV
  { level: 11, saves: [7,  9,  8,  8,  10] }, // 11-12 DV
  { level: 13, saves: [5,  7,  6,  5,  8]  }, // 13-14 DV
  { level: 15, saves: [4,  6,  5,  4,  7]  }, // 15-16 DV
  { level: 17, saves: [3,  5,  4,  4,  6]  }  // 17+ DV
];

/* ========================================================== */
/* ADD2E — OUTILS MONSTRES : TAGS, POUVOIRS, HYDRATATION       */
/* ========================================================== */

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

// Noms qui apparaissent dans les statblocks mais qui ne doivent PAS être cherchés dans le compendium armes.
const ADD2E_NATURAL_ATTACKS = new Set([
  "griffe", "griffes", "morsure", "bec", "serres", "serre", "dard", "queue", "coup_de_queue",
  "tentacule", "tentacules", "corne", "cornes", "sabot", "sabots", "poing", "poings", "pince", "pinces",
  "piquants", "epines", "spores", "regard", "souffle", "contact", "toucher", "constriction", "ecrasement"
]);

function __add2eNormalize(str) {
  return (str ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
  if (typeof raw === "string") {
    return raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  }
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
  } catch (e) {
    return actor?.flags?.add2e?.[key] || null;
  }
}

function __add2eGetLinkedRoot(actor) {
  return (
    __add2eGetFlagObject(actor, "linkedItems") ||
    __add2eGetFlagObject(actor, "importLinks") ||
    {}
  );
}

function __add2eGetLinkedEntries(actor, group) {
  const root = __add2eGetLinkedRoot(actor);
  const aliases = ADD2E_LINKED_GROUP_ALIASES[group] || [group];

  for (const alias of aliases) {
    if (root?.[alias]) {
      return __add2eToArray(root[alias]).map(entry => {
        if (typeof entry === "string") return { name: entry };
        return entry;
      }).filter(e => e && (e.name || e.uuid));
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
    console.warn(`[ADD2E][MONSTER][LINK] Pack introuvable: ${packId}`);
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
  const entry =
    idx.find(e => __add2eNormalize(e.name) === wanted && (!e.type || e.type === type)) ||
    idx.find(e => __add2eNormalize(e.name) === wanted);

  if (!entry) return null;

  const doc = await pack.getDocument(entry._id);
  if (!doc) return null;
  if (type && doc.type !== type) {
    console.warn(`[ADD2E][MONSTER][LINK] Document trouvé mais mauvais type: ${doc.name} (${doc.type}) attendu ${type}`);
    return null;
  }
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
      const doc = await fromUuid(entry.uuid);
      if (doc && doc.documentName === "Item" && (!type || doc.type === type)) return doc;
    } catch (e) {
      console.warn(`[ADD2E][MONSTER][LINK] UUID introuvable: ${entry.uuid}`, e);
    }
  }

  const name = __add2eDisplayName(entry.name);
  if (!name) return null;

  const source = String(entry.source || entry.scope || "").toLowerCase();
  const packId = entry.pack || entry.compendium || defaultPack;

  if (source === "world") return __add2eFindWorldItem(name, type);
  if (source === "pack" || source === "compendium") return __add2eFindPackItem(name, type, packId);

  // Par défaut : monde d'abord, puis pack indiqué/défaut, puis autres compendiums Item.
  return (
    __add2eFindWorldItem(name, type) ||
    await __add2eFindPackItem(name, type, packId) ||
    await __add2eFindAnyPackItem(name, type)
  );
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

  if (entry.equip === true || entry.equipee === true || entry.equipped === true) {
    data.system.equipee = true;
  }

  if (group === "spells") {
    const memorized = Number(entry.memorized ?? entry.memorizedCount ?? entry.prepared ?? entry.count ?? 1);
    data.flags.add2e.memorizedCount = Math.max(0, Number.isFinite(memorized) ? memorized : 1);
  }

  return data;
}

async function __add2eImportLinkedGroup(actor, group) {
  const entries = __add2eGetLinkedEntries(actor, group);
  const type = ADD2E_LINKED_TYPES[group];
  let imported = 0;
  let skipped = 0;
  let missing = [];

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
  // Compatibilité ancienne optionnelle : ne s'active que si le flag est explicitement vrai.
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

    console.log(`[ADD2E][MONSTER][LINK] ${actor.name}: hydratation terminée`, { imported, missing, results });

    if (options.notify !== false) {
      if (imported > 0) ui.notifications.info(`${actor.name} : ${imported} item(s) importé(s).`);
      else ui.notifications.info(`${actor.name} : aucun nouvel item à importer.`);
      if (missing.length) ui.notifications.warn(`${actor.name} : item(s) introuvable(s) : ${missing.join(", ")}`);
    }

    return { imported, missing, results };
  } catch (e) {
    console.error("[ADD2E][MONSTER][LINK] Hydratation impossible", e);
    ui.notifications.error("Hydratation des items du monstre impossible. Voir console.");
    return null;
  }
}

function __add2eGetEquippedPowerItems(actor) {
  return actor.items.filter(i =>
    ADD2E_EQUIPPABLE_POWER_TYPES.has(i.type) &&
    i.system?.equipee === true &&
    Array.isArray(i.system?.pouvoirs)
  );
}

function __add2eBuildVirtualPowerSpell(actor, sourceItem, idx, p) {
  const validFakeId = sourceItem.id.substring(0, 14) + idx.toString().padStart(2, "0");
  const fakeSpellData = {
    _id: validFakeId,
    name: `${p.name}`,
    type: "sort",
    img: p.img || sourceItem.img,
    system: {
      niveau: p.niveau || 1,
      école: p.ecole || p.école || "Magique",
      description: p.description || "",
      composantes: "Objet",
      temps_incantation: p.temps_incantation || { valeur: "1", unite: "" },
      portee: p.portee || { valeur: "Obj", unite: "" },
      duree: p.duree || { valeur: "Spec", unite: "" },
      isPower: true,
      sourceItemId: sourceItem.id,
      sourceWeaponId: sourceItem.id,
      powerIndex: idx,
      cost: p.cout || p.cost || 1,
      max: p.max || 1,
      onUse: p.onUse || ""
    }
  };

  const virtualSpell = new Item(fakeSpellData, { parent: actor });
  virtualSpell.getFlag = (scope, key) => {
    if (scope === "add2e" && key === "memorizedCount") {
      const charges = sourceItem.getFlag("add2e", `charges_${idx}`);
      return (charges !== undefined) ? charges : (p.max ?? 1);
    }
    return null;
  };
  return virtualSpell;
}

function __add2eFindVirtualPowerSpell(actor, fakeId) {
  for (const sourceItem of __add2eGetEquippedPowerItems(actor)) {
    for (let [idx, p] of sourceItem.system.pouvoirs.entries()) {
      const candidateId = sourceItem.id.substring(0, 14) + idx.toString().padStart(2, "0");
      if (candidateId === fakeId) return __add2eBuildVirtualPowerSpell(actor, sourceItem, idx, p);
    }
  }
  return null;
}

globalThis.add2eHydrateMonsterLinkedItems = __add2eHydrateMonsterLinkedItems;


export class Add2eMonsterSheet extends ActorSheet {
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "monster"],
      template: "systems/add2e/templates/actor/monster-sheet.hbs",
      width: 720,
      height: 850,
      resizable: true,
      tabs: [{ 
        navSelector: ".sheet-tabs", 
        contentSelector: ".sheet-body", 
        initial: "combat" 
      }]
    });
  }

  async getData() {
    const data = await super.getData();
    data.system = this.actor.system;
    data.actor = this.actor; 

    // 1. CALCUL DES SAUVEGARDES
    const manualSaves = data.system.sauvegardes;
    let finalSaves = [];

    if (manualSaves && (Array.isArray(manualSaves) || typeof manualSaves === 'object')) {
        const arr = Array.isArray(manualSaves) ? manualSaves : Object.values(manualSaves);
        if (arr.length >= 5) finalSaves = arr.map(Number);
    }

    if (finalSaves.length < 5) {
        let dv = parseInt(data.system.hitDice) || 1;
        let saveLine = FIGHTER_SAVES.slice().reverse().find(l => dv >= l.level) || FIGHTER_SAVES[1];
        finalSaves = saveLine.saves;
    }

    data.calculatedSaves = {
      paralysie: finalSaves[0],
      baguettes: finalSaves[1],
      petrification: finalSaves[2],
      souffle: finalSaves[3],
      sorts: finalSaves[4]
    };
    
    // Force l'affichage des boutons
    data.isSavingThrowString = false; 

    // 2. LISTES D'ITEMS
    data.listeArmes = this.actor.items.filter(i => i.type === "arme");
    data.listeArmures = this.actor.items.filter(i => i.type === "armure");
    data.listeObjets = this.actor.items.filter(i => 
        ["objet", "equipement", "consommable", "loot", "conteneur"].includes(i.type)
    );

    const sorts = this.actor.items.filter(i => i.type === "sort");

    // 3. INJECTION POUVOIRS (ARMES / ARMURES / OBJETS MAGIQUES ÉQUIPÉS)
    for (const sourceItem of __add2eGetEquippedPowerItems(this.actor)) {
      for (let [idx, p] of sourceItem.system.pouvoirs.entries()) {
        sorts.push(__add2eBuildVirtualPowerSpell(this.actor, sourceItem, idx, p));
      }
    }

    // Organisation Sorts
    const sortsParNiveau = {};
    for (const sort of sorts) {
      let niv = Number(sort.system.niveau) || 1;
      if (!sortsParNiveau[niv]) sortsParNiveau[niv] = [];
      sortsParNiveau[niv].push(sort);
    }
    data.niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
    data.sortsParNiveau = sortsParNiveau;
    
    data.sortsMemorizedByLevel = {}; 
    for (const niv of data.niveauxSorts) {
        let count = 0;
        for (const s of sortsParNiveau[niv]) {
            count += Number(s.getFlag("add2e", "memorizedCount") || 0);
        }
        data.sortsMemorizedByLevel[niv] = { count: count, max: "-" };
    }

    // 4. EFFETS ACTIFS
    data.activeEffectsList = this.actor.effects.map(eff => {
      let durationStr = "Permanente";
      if (eff.duration?.rounds) durationStr = `${eff.duration.rounds} rds`;
      else if (eff.duration?.seconds) durationStr = `${eff.duration.seconds} s`;
      else if (eff.isTemporary) durationStr = "Temporaire";

      let desc = eff.description || "";
      if (!desc && eff.flags?.add2e?.tags) {
         desc = eff.flags.add2e.tags.join(", ");
      }

      return {
        id: eff.id,
        name: eff.name || eff.label,
        img: eff.img || eff.icon || "icons/svg/aura.svg",
        disabled: eff.disabled,
        duration: durationStr,
        description: desc,
        sourceName: eff.origin ? "Source externe" : "Propre"
      };
    });

    await this._recalculerCA();

    return data;
  }

  async _updateObject(event, formData) {
    if (!formData.name || formData.name.trim() === "") formData.name = this.actor.name;
    return super._updateObject(event, formData);
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Injection du CSS correctif pour le layout
    this._injectLayoutFix(html);

    // Onglets
    html.find('.sheet-tabs .item').click(ev => {
      ev.preventDefault();
      const tabName = $(ev.currentTarget).data("tab");
      html.find('.sheet-tabs .item').removeClass("active");
      html.find('.tab').removeClass("active");
      $(ev.currentTarget).addClass("active");
      html.find(`.tab[data-tab="${tabName}"]`).addClass("active");
    });

    // Jets de Sauvegarde
    html.find('.roll-save').click(async ev => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const index = Number(btn.data('saveIndex'));
      const seuil = parseInt(btn.data('saveVal')) || 20;
      
      const labels = ["Paralysie / Mort", "Baguettes", "Pétrification", "Souffle", "Sorts"];
      const label = labels[index] || "Sauvegarde";
      const colors = ["#16a085", "#f39c12", "#8e44ad", "#d35400", "#c0392b"];
      const icons = ["fa-skull-crossbones", "fa-magic", "fa-cubes", "fa-wind", "fa-scroll"];
      const color = colors[index] || "#444";
      const icon = icons[index] || "fa-dice-d20";

      const roll = new Roll("1d20");
      await roll.evaluate();
      if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

      const success = roll.total >= seuil;
      const content = `
        <div class="add2e-card-test" style="border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.2); background:linear-gradient(135deg, #fff 0%, #f0f0f0 100%); border:2px solid ${color}; padding:5px 10px; font-family:var(--font-primary);">
          <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:5px;">
            <i class="fas ${icon}" style="font-size:1.5em; color:${color};"></i>
            <div><div style="font-weight:bold; font-size:1.1em; color:${color};">${label}</div><div style="font-size:0.8em; color:#666;">Jet de Sauvegarde (Monstre)</div></div>
          </div>
          <div style="font-size:1.1em; text-align:center; margin:5px 0;">Seuil : <b>${seuil}</b> | Résultat : <b>${roll.total}</b></div>
          <div style="text-align:center; font-weight:bold; font-size:1.2em; margin-top:5px; color:${success ? '#27ae60' : '#c0392b'};">${success ? 'SUCCÈS' : 'ÉCHEC'}</div>
        </div>
      `;
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
    });

    // Effets
    html.find('.effect-control').click(async ev => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const action = btn.data('action');
      const id = btn.data('effectId');
      
      if (action === 'create') {
          return this.actor.createEmbeddedDocuments("ActiveEffect", [{
              name: "Nouvel Effet",
              icon: "icons/svg/aura.svg",
              origin: this.actor.uuid,
              duration: { rounds: 1 }
          }]);
      }
      const eff = this.actor.effects.get(id);
      if (!eff) return;
      if (action === 'toggle') return eff.update({ disabled: !eff.disabled });
      if (action === 'edit') return eff.sheet.render(true);
      if (action === 'delete') return eff.delete(); // Déclenche le Hook défini plus bas
    });

    // Items (Équipement & Objets & Sorts)
    html.find('.item-equip').click(async ev => {
      const id = $(ev.currentTarget).data("itemId");
      const item = this.actor.items.get(id);
      if (item) await this._onEquipItem(item);
    });
    html.find('.hydrate-linked-items').click(async ev => {
      ev.preventDefault();
      await __add2eHydrateMonsterLinkedItems(this.actor, { notify: true });
      this.render(false);
    });
    html.find('.item-edit, .arme-edit, .armure-edit, .sort-edit, .objet-edit').click(ev => {
      const id = $(ev.currentTarget).data("itemId") || $(ev.currentTarget).data("sortId");
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });
    html.find('.item-delete, .arme-delete, .armure-delete, .sort-delete, .objet-delete').click(async ev => {
      const id = $(ev.currentTarget).data("itemId") || $(ev.currentTarget).data("sortId");
      await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Actions Spéciales
    html.find('.arme-img-attack').click(ev => {
      const id = $(ev.currentTarget).data("itemId");
      const item = this.actor.items.get(id);
      if (globalThis.add2eAttackRoll) globalThis.add2eAttackRoll({ actor: this.actor, arme: item });
    });

    // Sorts & Pouvoirs
    html.find('.sort-cast-img').click(ev => {
      ev.preventDefault();
      const sortId = $(ev.currentTarget).data("sortId");
      let item = this.actor.items.get(sortId);

      // Pouvoirs virtuels d'objets équipés (armes, armures, objets magiques...)
      if (!item) item = __add2eFindVirtualPowerSpell(this.actor, sortId);
      if (item && globalThis.add2eCastSpell) {
          globalThis.add2eCastSpell({ actor: this.actor, sort: item });
          this.render(false);
      }
    });

    html.find('.sort-memorize-plus').click(async ev => {
        const id = $(ev.currentTarget).data("sortId");
        const sort = this.actor.items.get(id);
        if(!sort) return;
        let cur = Number(sort.getFlag("add2e", "memorizedCount") || 0);
        await sort.setFlag("add2e", "memorizedCount", cur + 1);
        this.render(false);
    });
    html.find('.sort-memorize-minus').click(async ev => {
        const id = $(ev.currentTarget).data("sortId");
        const sort = this.actor.items.get(id);
        if(!sort) return;
        let cur = Number(sort.getFlag("add2e", "memorizedCount") || 0);
        await sort.setFlag("add2e", "memorizedCount", Math.max(0, cur - 1));
        this.render(false);
    });
    html.find('.toggle-sort-desc-chat').click(ev => {
      const id = $(ev.currentTarget).data("sortId");
      html.find(`#desc-chat-${id}`).slideToggle(200);
    });

    html.find('img[data-edit="img"]').click(ev => {
      new FilePicker({
        type: "image",
        current: this.actor.img,
        callback: path => {
            this.actor.update({ img: path });
            this.actor.update({ "prototypeToken.texture.src": path });
        }
      }).render(true);
    });
  }

  // --- STABILISATION LAYOUT ---
  _injectLayoutFix(html) {
      const styleId = "add2e-layout-fix";
      if ($(`#${styleId}`).length === 0) {
          $('head').append(`
            <style id="${styleId}">
                .add2e.sheet.monster .saves-section {
                    min-height: 65px !important;
                    margin-bottom: 2px !important;
                    display: flex; gap: 5px; align-items: center; justify-content: space-around;
                }
                .add2e.sheet.monster .sheet-tabs {
                    margin-top: 0 !important;
                    padding-top: 4px !important;
                    border-top: 2px solid #333;
                }
                .add2e.sheet.monster .sheet-body {
                    margin-top: 0 !important;
                    height: calc(100% - 240px);
                }
            </style>
          `);
      }
  }

  async _onEquipItem(item) {
    const actor = this.actor;
    const dejaEquipee = item.system.equipee === true;

    if (item.type === "arme") {
      if (dejaEquipee) { await item.update({ "system.equipee": false }); return; }
      if (item.system.deuxMains) {
        const bouclier = actor.items.find(i => i.type === "armure" && i.system.equipee && i.name.toLowerCase().includes("bouclier"));
        if (bouclier) { ui.notifications.warn(`Impossible : Bouclier équipé.`); return; }
      }
      await item.update({ "system.equipee": true });
      return;
    }

    if (item.type === "armure") {
      if (dejaEquipee) {
        await item.update({ "system.equipee": false });
        await this._recalculerCA();
        return;
      }
      await item.update({ "system.equipee": true });
      await this._recalculerCA();
      return;
    }

    if (["objet", "equipement", "consommable", "loot", "conteneur"].includes(item.type)) {
      await item.update({ "system.equipee": !dejaEquipee });
      return;
    }
  }

  async _recalculerCA() {
    const itemsEquipes = this.actor.items.filter(i => i.type === "armure" && i.system.equipee);
    let caBase = Number(this.actor.system.armorClass) || Number(this.actor.system.ca_naturel) || 10;
    let nouveauCA = caBase;
    for (const item of itemsEquipes) {
        let acItem = Number(item.system.ac);
        if (!isNaN(acItem)) {
            if (item.name.toLowerCase().includes("bouclier")) nouveauCA -= 1; 
            else if (acItem < nouveauCA) nouveauCA = acItem; 
        }
    }
    const dexDef = Number(this.actor.system.dex_def) || 0;
    nouveauCA += dexDef;
    if (nouveauCA !== this.actor.system.ca_total) await this.actor.update({ "system.ca_total": nouveauCA });
  }
}

// Enregistrement
Actors.registerSheet("add2e", Add2eMonsterSheet, {
  types: ["monster"],
  makeDefault: true,
  label: "ADD2e Descartes (FR) - Monstre"
});


/* ========================================================== */
/* HOOK GLOBAL : NETTOYAGE VISUEL LORS DE LA SUPPRESSION D'EFFET */
/* ========================================================== */
Hooks.on("deleteActiveEffect", async (effect, options, userId) => {
    // 1. Gestion du Sort "Agrandissement" (Scale Token)
    const enlargeData = effect.flags?.add2e?.enlargeData;
    if (enlargeData) {
        const tokenDoc = canvas.scene.tokens.get(enlargeData.tokenId);
        if (tokenDoc) {
            console.log(`[ADD2e] Restauration taille token ${tokenDoc.name} à ${enlargeData.originalScale}`);
            // Si l'utilisateur a les droits, il le fait, sinon le GM le fera via le hook
            if (game.user.isGM || tokenDoc.actor?.isOwner) {
                await tokenDoc.update({
                    "texture.scaleX": enlargeData.originalScale,
                    "texture.scaleY": enlargeData.originalScale
                });
            } else if (game.socket && game.user.isGM) {
                // Securité supplémentaire: le GM execute toujours
            }
        }
    }

    // 2. Gestion Sequencer (Nettoyage Effets Visuels liés à l'effet)
    // Si le module Sequencer est actif, on tente de supprimer les effets liés à cet ActiveEffect
    if (globalThis.Sequencer) {
        // La convention Sequencer est souvent d'utiliser l'origin ou une ID spécifique
        // On tente de fermer les effets qui ont pour origine cet effet
        Sequencer.EffectManager.endEffects({ origin: effect.uuid });
        
        // Ou si l'effet a été créé avec un nom spécifique
        Sequencer.EffectManager.endEffects({ name: effect.name });
    }
});
/* ========================================================== */
/* ADD2E — HYDRATATION ITEMS MONSTRES AU DROP                  */
/* - N'utilise plus system.attackTypes par défaut              */
/* - Utilise flags.add2e.linkedItems / importLinks             */
/* - Importe armes, armures, sorts, objets depuis monde/pack   */
/* ========================================================== */

Hooks.on("createToken", async (tokenDoc) => {
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "monster") return;

  // Au drop, on hydrate les références déclarées dans flags.add2e.linkedItems.
  await __add2eHydrateMonsterLinkedItems(actor, { notify: false });
});
