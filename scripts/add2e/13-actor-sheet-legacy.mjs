// ADD2E — Feuille personnage découpée
// Ancien fichier monolithique remplacé par les imports 13a à 13f.
// Découpage structurel uniquement : aucune correction métier appliquée ici.

import "./13a-actor-sheet-class.mjs";
import "./13b-actor-sheet-get-data.mjs";
import "./13c-actor-sheet-caracs-pv-tabs-render.mjs";
import "./13d-actor-sheet-listeners.mjs";
import "./13e-actor-sheet-drop.mjs";
import "./13f-actor-sheet-registration.mjs";

// ============================================================
// ADD2E — Cohérence CA fixe des bracelets / objets de défense
// ============================================================
const ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = "2026-05-19-bracers-fixed-ca-sheet-v1";
globalThis.ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION;

function add2eSheetBool(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  const s = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "oui", "on", "checked", "equipped", "equipe", "équipé", "equipee", "équipée"].includes(s);
}

function add2eSheetNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:+\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eSheetNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eSheetNumber(value.value, value.current, value.actuel, value.total, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const n = Number(String(value).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function add2eSheetArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eSheetArray).filter(v => String(v ?? "").trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "tags", "effectTags", "effets", "effects", "list", "items"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eSheetArray(value[key]);
    }
  }
  return [];
}

function add2eSheetItemTags(item) {
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
    ...add2eSheetArray(sys.tags),
    ...add2eSheetArray(sys.effectTags),
    ...add2eSheetArray(sys.effets),
    ...add2eSheetArray(sys.effects),
    ...add2eSheetArray(item?.flags?.add2e?.tags),
    ...add2eSheetArray(item?.flags?.add2e?.effectTags)
  ];
  return raw.map(add2eSheetNorm).filter(Boolean);
}

function add2eSheetItemText(item) {
  return add2eSheetItemTags(item).join(" ");
}

function add2eSheetIsEquipped(item) {
  const s = item?.system ?? {};
  return add2eSheetBool(s.equipee)
    || add2eSheetBool(s.equipped)
    || add2eSheetBool(s.portee)
    || add2eSheetBool(s.worn)
    || add2eSheetBool(s.estEquipee)
    || add2eSheetBool(s.est_equipee)
    || add2eSheetBool(s.equipe)
    || add2eSheetBool(s["équipé"])
    || add2eSheetBool(s["équipée"]);
}

function add2eSheetIsShield(item) {
  const text = add2eSheetItemText(item);
  return text.includes("bouclier") || text.includes("shield");
}

function add2eSheetIsHelmet(item) {
  const text = add2eSheetItemText(item);
  return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
}

function add2eSheetBonusFromName(item) {
  const m = String(item?.name ?? item?.system?.nom ?? "").match(/\+\s*(\d+)/);
  return m ? Number(m[1]) || 0 : 0;
}

function add2eSheetLooksMagic(item) {
  const sys = item?.system ?? {};
  const text = add2eSheetItemText(item);
  return add2eSheetBool(sys.magique) || add2eSheetBool(sys.magic) || text.includes("magique") || text.includes("magic") || /\+\s*\d+/.test(String(item?.name ?? ""));
}

function add2eSheetDefenseBonus(item) {
  const sys = item?.system ?? {};
  let bonus = Math.abs(add2eSheetNumber(sys.bonus_ca, sys.bonus_ac, sys.ca_bonus, sys.ac_bonus, sys.protectionBonus, sys.protection_bonus) ?? 0);
  for (const tag of add2eSheetItemTags(item)) {
    const m = tag.match(/^(?:bonus_ca|bonus_ac|protection|protection_ca):([+\-]?\d+)$/);
    if (m) bonus += Math.abs(Number(m[1]) || 0);
  }
  if (!bonus && add2eSheetLooksMagic(item)) {
    const type = String(item?.type ?? "").toLowerCase();
    const text = add2eSheetItemText(item);
    if (type === "armure" || type === "armor" || text.includes("anneau") || text.includes("bague") || text.includes("cape") || text.includes("protection")) {
      bonus = add2eSheetBonusFromName(item);
    }
  }
  return bonus;
}

function add2eSheetFixedCA(item) {
  const sys = item?.system ?? {};
  const type = String(item?.type ?? "").toLowerCase();
  const text = add2eSheetItemText(item);
  let ca = add2eSheetNumber(sys.ca_fixe, sys.caFixe, sys.fixedCA, sys.fixed_ac, sys.ac_fixe, sys.acFixe);
  for (const tag of add2eSheetItemTags(item)) {
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

function add2eSheetDexDefense(actor) {
  const sys = actor?.system ?? {};
  const direct = add2eSheetNumber(sys.dex_def, sys.dexDefense, sys.dex_defense, sys.mod_dex_defense);
  if (Number.isFinite(direct)) return direct;
  const dex = add2eSheetNumber(sys.dexterite, sys.dexterite_base, sys.dex, sys.dexterity) ?? 10;
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

function add2eSheetComputeMagicDefense(actor, context = {}) {
  const items = [...(actor?.items ?? [])].filter(add2eSheetIsEquipped);
  const armors = items.filter(i => ["armure", "armor"].includes(String(i.type ?? "").toLowerCase()));
  const objects = items.filter(i => !["armure", "armor"].includes(String(i.type ?? "").toLowerCase()));
  const wornArmors = armors.filter(i => !add2eSheetIsShield(i) && !add2eSheetIsHelmet(i));
  const shields = armors.filter(add2eSheetIsShield);
  const helmets = armors.filter(add2eSheetIsHelmet);

  let armorBase = 10;
  let armorName = "Aucune";
  let armorMagicBonus = 0;

  for (const armor of wornArmors) {
    const ac = add2eSheetNumber(armor.system?.ac, armor.system?.ca, armor.system?.armorClass, armor.system?.base_ca, armor.system?.baseAC);
    if (Number.isFinite(ac) && ac < armorBase) {
      armorBase = ac;
      armorName = armor.name;
      armorMagicBonus = add2eSheetDefenseBonus(armor);
    }
  }

  let fixedCA = null;
  let fixedSource = "";
  for (const item of objects) {
    const ca = add2eSheetFixedCA(item);
    if (Number.isFinite(ca) && (fixedCA === null || ca < fixedCA)) {
      fixedCA = ca;
      fixedSource = item.name;
    }
  }

  const fixedCAActive = Number.isFinite(fixedCA);
  const baseAfterFixed = fixedCAActive ? fixedCA : armorBase;
  const appliedArmorMagicBonus = fixedCAActive ? 0 : armorMagicBonus;

  let shieldBonus = 0;
  const shieldSources = [];
  for (const shield of shields) {
    const base = Math.max(1, Math.abs(add2eSheetNumber(shield.system?.ac, shield.system?.ca, shield.system?.armorClass) ?? 1));
    const magic = add2eSheetDefenseBonus(shield);
    shieldBonus += base + magic;
    shieldSources.push(`${shield.name}:${base + magic}`);
  }

  let helmetBonus = 0;
  for (const helmet of helmets) {
    helmetBonus += Math.abs(add2eSheetNumber(helmet.system?.ac, helmet.system?.ca, helmet.system?.armorClass) ?? 0) + add2eSheetDefenseBonus(helmet);
  }

  let objectProtectionBonus = 0;
  const objectSources = [];
  for (const item of objects) {
    if (add2eSheetFixedCA(item) !== null) continue;
    const bonus = add2eSheetDefenseBonus(item);
    if (!bonus) continue;
    objectProtectionBonus += bonus;
    objectSources.push(`${item.name}:${bonus}`);
  }

  const dex = add2eSheetDexDefense(actor);
  const armorLayerCA = baseAfterFixed - appliedArmorMagicBonus;
  const caNaturel = armorLayerCA + dex - shieldBonus - helmetBonus;
  const caTotal = caNaturel - objectProtectionBonus;

  return {
    armorBase,
    armorName,
    armorMagicBonus: appliedArmorMagicBonus,
    ignoredArmorMagicBonus: fixedCAActive ? armorMagicBonus : 0,
    fixedCA,
    fixedSource,
    fixedCAActive,
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
    context,
    version: ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION
  };
}

// On remplace la méthode du moteur par la version robuste pour que la fiche ET les attaques utilisent la même CA.
if (globalThis.Add2eEffectsEngine) {
  globalThis.Add2eEffectsEngine.itemEquipped = add2eSheetIsEquipped;
  globalThis.Add2eEffectsEngine.getMagicPassiveDefense = add2eSheetComputeMagicDefense;
}

if (globalThis.Add2eActorSheet?.prototype && !globalThis.Add2eActorSheet.prototype.__add2eBraceletsDefenseDisplayFix) {
  globalThis.Add2eActorSheet.prototype.__add2eBraceletsDefenseDisplayFix = true;
  const originalGetData = globalThis.Add2eActorSheet.prototype.getData;

  globalThis.Add2eActorSheet.prototype.getData = async function add2eBraceletsDefenseGetData(...args) {
    const data = await originalGetData.apply(this, args);
    try {
      if (this.actor?.type !== "personnage") return data;
      const defense = add2eSheetComputeMagicDefense(this.actor, { source: "actor-sheet-postprocess" });
      data.combatDefense = data.combatDefense || {};
      data.combatDefense.ac_naturelle = defense.caNaturel;
      data.combatDefense.ac_totale = defense.caTotal;
      data.combatDefense.objets_magiques_defense = defense;

      if (defense.fixedCAActive) {
        data.combatDefense.armure = `${defense.fixedSource} <small style="color:#7f704d;">(remplace l'armure portée)</small>`;
      }

      data.actor.system.ca_naturel = defense.caNaturel;
      data.actor.system.ca_total = defense.caTotal;

      if (this.actor.system.ca_total !== defense.caTotal || this.actor.system.ca_naturel !== defense.caNaturel) {
        setTimeout(() => this.actor.update({ "system.ca_naturel": defense.caNaturel, "system.ca_total": defense.caTotal }, { add2eInternal: true }), 0);
      }
    } catch (err) {
      console.warn("[ADD2E][BRACELETS_DEFENSE][SHEET_FIX_ERROR]", err);
    }
    return data;
  };
}

console.log("[ADD2E][BRACELETS_DEFENSE][FIX]", ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION);
