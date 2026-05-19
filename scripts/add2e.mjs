/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e/00-legacy-global-helpers.mjs";
import "./add2e/item-sheet-registration.mjs";
import "./add2e/handlebars-helpers.mjs";
import "./add2e/01-macros-base-caracs.mjs";
import "./add2e/02-spell-sync.mjs";
import "./add2e/02b-spell-sync-dedupe.mjs";
import "./add2e/03-equipment-rules.mjs";
import "./add2e/04-class-active-abilities.mjs";
import "./add2e/object-magic-powers.mjs";
import "./add2e/06-class-effects-thief.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/13-actor-sheet-legacy.mjs";
import "./add2e/14-item-sheets.mjs";
import "./add2e/15-validation-sockets.mjs";
import "./add2e/16-preparation-display.mjs";

// ============================================================
// ADD2E — Objets magiques passifs
// Corrige la cohérence entre fiche, effets et résolution d'attaque.
// ============================================================
const ADD2E_MAGIC_PASSIVE_VERSION = "2026-05-19-objets-magiques-passifs-v1";
globalThis.ADD2E_MAGIC_PASSIVE_VERSION = ADD2E_MAGIC_PASSIVE_VERSION;

function add2eMagicPassiveNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:+\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eMagicPassiveArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eMagicPassiveArray).filter(v => String(v ?? "").trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "current", "actuel", "tags", "effectTags", "list", "items"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eMagicPassiveArray(value[key]);
    }
  }
  return [];
}

function add2eMagicPassiveReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eMagicPassiveReadNumber(value.value, value.current, value.actuel, value.total, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const n = Number(String(value).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function add2eMagicPassiveTags(item) {
  const sys = item?.system ?? {};
  const raw = [
    item?.name,
    sys.nom,
    sys.categorie,
    sys.category,
    sys.type,
    sys.sousType,
    sys.sous_type,
    sys.famille,
    sys.famille_arme,
    ...add2eMagicPassiveArray(sys.tags),
    ...add2eMagicPassiveArray(sys.effectTags),
    ...add2eMagicPassiveArray(sys.effets),
    ...add2eMagicPassiveArray(sys.effects),
    ...add2eMagicPassiveArray(item?.flags?.add2e?.tags),
    ...add2eMagicPassiveArray(item?.flags?.add2e?.effectTags)
  ];
  return raw.map(add2eMagicPassiveNorm).filter(Boolean);
}

function add2eMagicPassiveText(item) {
  return add2eMagicPassiveTags(item).join(" ");
}

function add2eMagicPassiveEquipped(item) {
  const sys = item?.system ?? {};
  return sys.equipee === true || sys.equipped === true || sys.portee === true || sys.worn === true;
}

function add2eMagicPassiveBonusFromName(item) {
  const m = String(item?.name ?? item?.system?.nom ?? "").match(/\+\s*(\d+)/);
  return m ? Number(m[1]) || 0 : 0;
}

function add2eMagicPassiveIsMagic(item) {
  const sys = item?.system ?? {};
  const text = add2eMagicPassiveText(item);
  return sys.magique === true || sys.magic === true || text.includes("magique") || text.includes("magic") || /\+\s*\d+/.test(String(item?.name ?? ""));
}

function add2eMagicPassiveIsShield(item) {
  const text = add2eMagicPassiveText(item);
  return text.includes("bouclier") || text.includes("shield");
}

function add2eMagicPassiveIsHelmet(item) {
  const text = add2eMagicPassiveText(item);
  return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
}

function add2eMagicPassiveDefenseBonus(item) {
  const sys = item?.system ?? {};
  let bonus = Math.abs(add2eMagicPassiveReadNumber(
    sys.bonus_ca,
    sys.bonus_ac,
    sys.ac_bonus,
    sys.ca_bonus,
    sys.protectionBonus,
    sys.protection_bonus
  ) ?? 0);

  for (const tag of add2eMagicPassiveTags(item)) {
    const m = tag.match(/^(?:bonus_ca|bonus_ac|protection|protection_ca):([+\-]?\d+)$/);
    if (m) bonus += Math.abs(Number(m[1]) || 0);
  }

  if (!bonus && add2eMagicPassiveIsMagic(item)) {
    const type = String(item?.type ?? "").toLowerCase();
    const text = add2eMagicPassiveText(item);
    if (type === "armure" || type === "armor" || text.includes("anneau") || text.includes("cape") || text.includes("protection")) {
      bonus = add2eMagicPassiveBonusFromName(item);
    }
  }

  return bonus;
}

function add2eMagicPassiveFixedCA(item) {
  const sys = item?.system ?? {};
  const type = String(item?.type ?? "").toLowerCase();
  const text = add2eMagicPassiveText(item);
  let ca = add2eMagicPassiveReadNumber(sys.ca_fixe, sys.caFixe, sys.fixedCA, sys.fixed_ac, sys.ac_fixe, sys.acFixe);

  for (const tag of add2eMagicPassiveTags(item)) {
    const m = tag.match(/^(?:ca_fixe|ca_fixe_autres|ac_fixe|fixed_ca|classe_armure):([+\-]?\d+)$/);
    if (m) ca = Number(m[1]);
  }

  if (!Number.isFinite(ca) && (type === "objet" || type === "object" || type === "equipment") && (text.includes("bracelet") || text.includes("bracer"))) {
    const name = String(item?.name ?? sys.nom ?? "");
    const m = name.match(/(?:ca|classe\s+d[’']?armure|ac)\s*([\-]?\d+)/i) || name.match(/\b([\-]?\d+)\b\s*$/);
    if (m) ca = Number(m[1]);
  }

  return Number.isFinite(ca) ? ca : null;
}

function add2eMagicPassiveWeaponBonus(item, kind = "hit") {
  const sys = item?.system ?? {};
  const direct = kind === "hit"
    ? add2eMagicPassiveReadNumber(sys.bonus_hit, sys.bonus_toucher, sys.hit_bonus, sys.attack_bonus, sys.bonusAttaque)
    : add2eMagicPassiveReadNumber(sys.bonus_dom, sys.bonus_degats, sys.damage_bonus, sys.degats_bonus, sys.bonusDegats);
  if (Number.isFinite(direct)) return direct;
  return add2eMagicPassiveIsMagic(item) ? add2eMagicPassiveBonusFromName(item) : 0;
}

function add2eMagicPassiveDexDefense(actor) {
  const sys = actor?.system ?? {};
  const direct = add2eMagicPassiveReadNumber(sys.dex_def, sys.dexDefense, sys.dex_defense, sys.mod_dex_defense);
  if (Number.isFinite(direct)) return direct;
  const dex = add2eMagicPassiveReadNumber(sys.dexterite, sys.dexterite_base, sys.dex, sys.dexterity) ?? 10;
  if (dex <= 3) return 4;
  if (dex === 4) return 3;
  if (dex === 5) return 2;
  if (dex === 6) return 1;
  if (dex <= 14) return 0;
  if (dex === 15) return -1;
  if (dex === 16) return -2;
  if (dex === 17) return -3;
  return -4;
}

function add2eMagicPassiveEquippedItems(actor, types = null) {
  const allowed = types ? new Set(types.map(t => String(t).toLowerCase())) : null;
  return [...(actor?.items ?? [])].filter(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (allowed && !allowed.has(type)) return false;
    return add2eMagicPassiveEquipped(item);
  });
}

function add2eComputeMagicPassiveDefense(actor) {
  const items = add2eMagicPassiveEquippedItems(actor);
  const armors = items.filter(i => ["armure", "armor"].includes(String(i.type ?? "").toLowerCase()));
  const objects = items.filter(i => !["armure", "armor"].includes(String(i.type ?? "").toLowerCase()));
  const wornArmors = armors.filter(i => !add2eMagicPassiveIsShield(i) && !add2eMagicPassiveIsHelmet(i));
  const shields = armors.filter(add2eMagicPassiveIsShield);
  const helmets = armors.filter(add2eMagicPassiveIsHelmet);

  let armorBase = 10;
  let armorName = "Aucune";
  let armorMagicBonus = 0;

  for (const armor of wornArmors) {
    const ac = add2eMagicPassiveReadNumber(armor.system?.ac, armor.system?.ca, armor.system?.armorClass, armor.system?.base_ca, armor.system?.baseAC);
    if (Number.isFinite(ac) && ac < armorBase) {
      armorBase = ac;
      armorName = armor.name;
      armorMagicBonus = add2eMagicPassiveDefenseBonus(armor);
    }
  }

  let fixedCA = null;
  let fixedSource = "";
  for (const item of objects) {
    const ca = add2eMagicPassiveFixedCA(item);
    if (Number.isFinite(ca) && (fixedCA === null || ca < fixedCA)) {
      fixedCA = ca;
      fixedSource = item.name;
    }
  }

  const baseAfterFixed = fixedCA !== null ? Math.min(armorBase, fixedCA) : armorBase;

  let shieldBonus = 0;
  const shieldSources = [];
  for (const shield of shields) {
    const base = Math.max(1, Math.abs(add2eMagicPassiveReadNumber(shield.system?.ac, shield.system?.ca, shield.system?.armorClass) ?? 1));
    const magic = add2eMagicPassiveDefenseBonus(shield);
    shieldBonus += base + magic;
    shieldSources.push(`${shield.name}:${base + magic}`);
  }

  let helmetBonus = 0;
  for (const helmet of helmets) {
    helmetBonus += Math.abs(add2eMagicPassiveReadNumber(helmet.system?.ac, helmet.system?.ca, helmet.system?.armorClass) ?? 0) + add2eMagicPassiveDefenseBonus(helmet);
  }

  let objectProtectionBonus = 0;
  const objectSources = [];
  for (const item of objects) {
    if (add2eMagicPassiveFixedCA(item) !== null) continue;
    const bonus = add2eMagicPassiveDefenseBonus(item);
    if (!bonus) continue;
    objectProtectionBonus += bonus;
    objectSources.push(`${item.name}:${bonus}`);
  }

  const dex = add2eMagicPassiveDexDefense(actor);
  const armorLayerCA = baseAfterFixed - armorMagicBonus;
  const caNaturel = armorLayerCA + dex - shieldBonus - helmetBonus;
  const caTotal = caNaturel - objectProtectionBonus;

  return {
    armorBase,
    armorName,
    armorMagicBonus,
    fixedCA,
    fixedSource,
    baseAfterFixed,
    armorLayerCA,
    dex,
    shieldBonus,
    shieldSources,
    helmetBonus,
    objectProtectionBonus,
    objectSources,
    caNaturel,
    caTotal,
    syntheticArmorAC: armorLayerCA - objectProtectionBonus,
    version: ADD2E_MAGIC_PASSIVE_VERSION
  };
}

function add2eInstallMagicPassiveEnginePatch() {
  const Engine = globalThis.Add2eEffectsEngine;
  if (!Engine || Engine.__add2eMagicPassivePatched) return false;
  Engine.__add2eMagicPassivePatched = true;
  Engine.getMagicPassiveDefense = add2eComputeMagicPassiveDefense;
  Engine.getMagicWeaponBonus = add2eMagicPassiveWeaponBonus;

  const originalGetCAFixe = Engine.getCAFixe?.bind(Engine);
  Engine.getCAFixe = function patchedGetCAFixe(actor, context = {}) {
    const original = originalGetCAFixe ? originalGetCAFixe(actor, context) : null;
    const fixed = add2eComputeMagicPassiveDefense(actor).fixedCA;
    if (Number.isFinite(original) && Number.isFinite(fixed)) return Math.min(original, fixed);
    if (Number.isFinite(original)) return original;
    return Number.isFinite(fixed) ? fixed : null;
  };

  const originalGetCABonus = Engine.getCABonus?.bind(Engine);
  Engine.getCABonus = function patchedGetCABonus(actor, context = {}) {
    const original = Number(originalGetCABonus ? originalGetCABonus(actor, context) : 0) || 0;
    return original + add2eComputeMagicPassiveDefense(actor).objectProtectionBonus;
  };

  console.log("[ADD2E][OBJETS_MAGIQUES][ENGINE]", ADD2E_MAGIC_PASSIVE_VERSION);
  return true;
}

function add2eInstallMagicPassiveSheetPatch() {
  const Sheet = globalThis.Add2eActorSheet;
  if (!Sheet?.prototype || Sheet.prototype.__add2eMagicPassiveSheetPatched) return false;
  Sheet.prototype.__add2eMagicPassiveSheetPatched = true;
  const originalGetData = Sheet.prototype.getData;

  Sheet.prototype.getData = async function add2eMagicPassiveGetData(...args) {
    const data = await originalGetData.apply(this, args);
    try {
      const actor = this.actor ?? data?.actor;
      if (actor?.type !== "personnage") return data;
      const sys = data.actor.system;
      const def = add2eComputeMagicPassiveDefense(actor);
      sys.ca_naturel = def.caNaturel;
      sys.ca_total = def.caTotal;
      data.combatDefense = data.combatDefense || {};
      data.combatDefense.ac_naturelle = def.caNaturel;
      data.combatDefense.ac_totale = def.caTotal;
      data.combatDefense.objets_magiques_defense = def;
      const current = add2eMagicPassiveReadNumber(actor.system?.ca_total);
      if (current !== def.caTotal) {
        setTimeout(() => actor.update({ "system.ca_naturel": def.caNaturel, "system.ca_total": def.caTotal }, { add2eInternal: true }), 0);
      }
    } catch (err) {
      console.warn("[ADD2E][OBJETS_MAGIQUES][SHEET][ERROR]", err);
    }
    return data;
  };

  console.log("[ADD2E][OBJETS_MAGIQUES][SHEET]", ADD2E_MAGIC_PASSIVE_VERSION);
  return true;
}

function add2eInstallMagicPassiveAttackPatch() {
  const current = globalThis.add2eAttackRoll;
  if (typeof current !== "function" || current.__add2eMagicPassiveAttackPatched) return false;

  const wrapped = async function add2eAttackRollMagicPassiveWrapper(payload = {}) {
    const actor = payload.actor || (payload.actorId ? game.actors.get(payload.actorId) : null);
    const arme = payload.arme || (payload.itemId && actor ? actor.items.get(payload.itemId) : null);
    const targetToken = Array.from(game.user.targets ?? [])[0];
    const targetActor = targetToken?.actor ?? null;
    const restore = [];

    try {
      if (arme?.system) {
        const hit = add2eMagicPassiveWeaponBonus(arme, "hit");
        const dmg = add2eMagicPassiveWeaponBonus(arme, "damage");
        const oldHit = arme.system.bonus_hit;
        const oldDom = arme.system.bonus_dom;
        if ((oldHit === undefined || oldHit === null || oldHit === "") && hit) arme.system.bonus_hit = hit;
        if ((oldDom === undefined || oldDom === null || oldDom === "") && dmg) arme.system.bonus_dom = dmg;
        restore.push(() => { arme.system.bonus_hit = oldHit; arme.system.bonus_dom = oldDom; });
      }

      if (targetActor?.type === "personnage" && targetActor.items) {
        const def = add2eComputeMagicPassiveDefense(targetActor);
        const syntheticAC = Number(def.syntheticArmorAC);
        if (Number.isFinite(syntheticAC) && syntheticAC < 10) {
          const tempId = "A2EMagicPasv0000";
          const tempItem = new Item({
            _id: tempId,
            name: "Synthèse objets magiques",
            type: "armure",
            img: "icons/svg/aura.svg",
            system: {
              ac: syntheticAC,
              ca: syntheticAC,
              equipee: true,
              magique: true,
              tags: ["armure", "type_armure:synthese_objets_magiques"],
              effectTags: ["armure", "type_armure_synthese_objets_magiques"]
            },
            flags: { add2e: { temporaryMagicPassive: true, details: def } }
          }, { parent: targetActor });
          targetActor.items.set(tempId, tempItem);
          restore.push(() => targetActor.items.delete(tempId));
        }

        for (const shield of add2eMagicPassiveEquippedItems(targetActor, ["armure", "armor"]).filter(add2eMagicPassiveIsShield)) {
          const old = shield.system.bonus_ca;
          const base = Math.max(1, Math.abs(add2eMagicPassiveReadNumber(shield.system?.ac, shield.system?.ca, shield.system?.armorClass) ?? 1));
          const magic = add2eMagicPassiveDefenseBonus(shield);
          shield.system.bonus_ca = base + magic;
          restore.push(() => { shield.system.bonus_ca = old; });
        }
      }

      return await current.call(this, payload);
    } finally {
      for (const fn of restore.reverse()) {
        try { fn(); } catch (err) { console.warn("[ADD2E][OBJETS_MAGIQUES][RESTORE_ERROR]", err); }
      }
    }
  };

  wrapped.__add2eMagicPassiveAttackPatched = true;
  wrapped.__add2eOriginalAttackRoll = current;
  globalThis.add2eAttackRoll = wrapped;
  console.log("[ADD2E][OBJETS_MAGIQUES][ATTACK]", ADD2E_MAGIC_PASSIVE_VERSION);
  return true;
}

function add2eInstallMagicPassivePatches() {
  add2eInstallMagicPassiveEnginePatch();
  add2eInstallMagicPassiveSheetPatch();
  add2eInstallMagicPassiveAttackPatch();
}

Hooks.once("ready", () => {
  add2eInstallMagicPassivePatches();
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    add2eInstallMagicPassivePatches();
    if (globalThis.add2eAttackRoll?.__add2eMagicPassiveAttackPatched || tries >= 20) clearInterval(timer);
  }, 250);
});

globalThis.add2eComputeMagicPassiveDefense = add2eComputeMagicPassiveDefense;
globalThis.add2eMagicPassiveWeaponBonus = add2eMagicPassiveWeaponBonus;
console.log("[ADD2E][OBJETS_MAGIQUES][PASSIVE_READY]", ADD2E_MAGIC_PASSIVE_VERSION);
