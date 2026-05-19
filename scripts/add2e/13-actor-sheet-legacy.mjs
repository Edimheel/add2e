// ADD2E — Feuille personnage découpée
// Ancien fichier monolithique remplacé par les imports 13a à 13f.

import "./13a-actor-sheet-class.mjs";
import "./13b-actor-sheet-get-data.mjs";
import "./13c-actor-sheet-caracs-pv-tabs-render.mjs";
import "./13d-actor-sheet-listeners.mjs";
import "./13e-actor-sheet-drop.mjs";
import "./13f-actor-sheet-registration.mjs";

// ============================================================
// ADD2E — Affichage CA fixe bracelets / objets de défense
// ============================================================
const ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = "2026-05-19-bracers-fixed-ca-sheet-v4-bracers-only";
globalThis.ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION;

function a2eSheetNum(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const n = a2eSheetNum(value.value, value.current, value.actuel, value.total, value.max);
      if (Number.isFinite(n)) return n;
      continue;
    }
    const n = Number(String(value).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function a2eSheetNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:+\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function a2eSheetArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(a2eSheetArray).filter(v => String(v ?? "").trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "tags", "effectTags", "effets", "effects", "list", "items"]) {
      if (value[key] !== undefined && value[key] !== null) return a2eSheetArray(value[key]);
    }
  }
  return [];
}

function a2eSheetBool(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  const s = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "oui", "on", "checked", "equipped", "equipe", "équipé", "equipee", "équipée", "worn", "portee", "portée"].includes(s);
}

function a2eSheetEquipped(item) {
  const s = item?.system ?? {};
  return a2eSheetBool(s.equipee) || a2eSheetBool(s.equipped) || a2eSheetBool(s.portee) || a2eSheetBool(s.worn) || a2eSheetBool(s.estEquipee) || a2eSheetBool(s.est_equipee) || a2eSheetBool(s.equipe) || a2eSheetBool(s["équipé"]) || a2eSheetBool(s["équipée"]);
}

function a2eSheetTags(item) {
  const s = item?.system ?? {};
  return [
    item?.name,
    s.nom,
    s.categorie,
    s.category,
    s.sousType,
    s.sous_type,
    s.slot,
    s.emplacement,
    ...a2eSheetArray(s.tags),
    ...a2eSheetArray(s.effectTags)
  ].map(a2eSheetNorm).filter(Boolean);
}

function a2eSheetNameNorm(item) {
  return a2eSheetNorm(item?.name ?? item?.system?.nom ?? "");
}

function a2eSheetIsShield(item) {
  const n = a2eSheetNameNorm(item);
  const tags = new Set(a2eSheetTags(item));
  return n.includes("bouclier") || n.includes("shield") || tags.has("bouclier") || tags.has("shield") || tags.has("role:bouclier") || tags.has("emplacement:bouclier") || tags.has("categorie_armure:bouclier") || tags.has("type_armure:bouclier");
}

function a2eSheetIsHelmet(item) {
  const n = a2eSheetNameNorm(item);
  const tags = new Set(a2eSheetTags(item));
  return n.includes("heaume") || n.includes("casque") || n.includes("helmet") || tags.has("heaume") || tags.has("casque") || tags.has("helmet") || tags.has("role:casque") || tags.has("emplacement:casque");
}

function a2eSheetBonusFromName(item) {
  const m = String(item?.name ?? item?.system?.nom ?? "").match(/\+\s*(\d+)/);
  return m ? Number(m[1]) || 0 : 0;
}

function a2eSheetBonus(item) {
  const s = item?.system ?? {};
  const explicit = Math.abs(a2eSheetNum(s.bonus_ca, s.bonus_ac, s.ca_bonus, s.ac_bonus, s.protectionBonus, s.protection_bonus) ?? 0);
  if (explicit) return explicit;
  return a2eSheetBonusFromName(item);
}

function a2eSheetFixedCA(item) {
  const s = item?.system ?? {};
  const type = String(item?.type ?? "").toLowerCase();
  const tags = a2eSheetTags(item);
  let ca = a2eSheetNum(s.ca_fixe, s.caFixe, s.fixedCA, s.fixed_ac, s.ac_fixe, s.acFixe);
  for (const tag of tags) {
    const m = tag.match(/^(?:ca_fixe|ca_fixe_autres|ac_fixe|fixed_ca|classe_armure):([+\-]?\d+)$/);
    if (m) ca = Number(m[1]);
  }
  const text = tags.join(" ");
  if (!Number.isFinite(ca) && ["objet", "object", "equipment"].includes(type) && (text.includes("bracelet") || text.includes("bracer"))) {
    const name = String(item?.name ?? s.nom ?? "");
    const m = name.match(/(?:ca|classe\s+d[’']?armure|ac)\s*([\-]?\d+)/i) || name.match(/\b([\-]?\d+)\b\s*$/);
    if (m) ca = Number(m[1]);
  }
  return Number.isFinite(ca) ? ca : null;
}

function a2eSheetDex(actor) {
  const s = actor?.system ?? {};
  const direct = a2eSheetNum(s.dex_def, s.dexDefense, s.dex_defense, s.mod_dex_defense);
  if (Number.isFinite(direct)) return direct;
  const dex = a2eSheetNum(s.dexterite, s.dexterite_base, s.dex, s.dexterity) ?? 10;
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

function a2eSheetDefense(actor, context = {}) {
  const items = [...(actor?.items ?? [])].filter(a2eSheetEquipped);
  const armors = items.filter(i => ["armure", "armor"].includes(String(i.type ?? "").toLowerCase()));
  const objects = items.filter(i => !["armure", "armor"].includes(String(i.type ?? "").toLowerCase()));
  const wornArmors = armors.filter(i => !a2eSheetIsShield(i) && !a2eSheetIsHelmet(i));
  const shields = armors.filter(a2eSheetIsShield);
  const helmets = armors.filter(a2eSheetIsHelmet);

  let armorBase = 10;
  let armorName = "Aucune";
  let armorMagicBonus = 0;
  for (const armor of wornArmors) {
    const ac = a2eSheetNum(armor.system?.ac, armor.system?.ca, armor.system?.armorClass, armor.system?.base_ca, armor.system?.baseAC);
    if (Number.isFinite(ac) && ac < armorBase) {
      armorBase = ac;
      armorName = armor.name;
      armorMagicBonus = a2eSheetBonus(armor);
    }
  }

  let fixedCA = null;
  let fixedSource = "";
  for (const item of objects) {
    const ca = a2eSheetFixedCA(item);
    if (Number.isFinite(ca) && (fixedCA === null || ca < fixedCA)) {
      fixedCA = ca;
      fixedSource = item.name;
    }
  }

  const fixedCAActive = Number.isFinite(fixedCA);

  // Règle locale demandée : si des bracelets / une CA fixe sont portés,
  // seule cette CA est prise en compte. L'armure, le bouclier, le casque,
  // la DEX et les autres bonus de protection ne sont pas empilés.
  if (fixedCAActive) {
    return {
      armorBase,
      armorName,
      armorMagicBonus: 0,
      ignoredArmorMagicBonus: armorMagicBonus,
      fixedCA,
      fixedSource,
      fixedCAActive: true,
      baseAfterFixed: fixedCA,
      armorLayerCA: fixedCA,
      dex: 0,
      shieldBonus: 0,
      shieldSources: [],
      helmetBonus: 0,
      objectProtectionBonus: 0,
      objectSources: [],
      caNaturel: fixedCA,
      caTotal: fixedCA,
      syntheticArmorAC: fixedCA,
      context,
      version: ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION
    };
  }

  let shieldBonus = 0;
  const shieldSources = [];
  for (const shield of shields) {
    const total = 1 + a2eSheetBonus(shield);
    shieldBonus += total;
    shieldSources.push(`${shield.name}:${total}`);
  }

  let helmetBonus = 0;
  for (const helmet of helmets) helmetBonus += Math.abs(a2eSheetNum(helmet.system?.ac, helmet.system?.ca, helmet.system?.armorClass) ?? 0) + a2eSheetBonus(helmet);

  let objectProtectionBonus = 0;
  const objectSources = [];
  for (const item of objects) {
    if (a2eSheetFixedCA(item) !== null) continue;
    const b = a2eSheetBonus(item);
    if (!b) continue;
    objectProtectionBonus += b;
    objectSources.push(`${item.name}:${b}`);
  }

  const dex = a2eSheetDex(actor);
  const armorLayerCA = armorBase - armorMagicBonus;
  const caNaturel = armorLayerCA + dex - shieldBonus - helmetBonus;
  const caTotal = caNaturel - objectProtectionBonus;
  return { armorBase, armorName, armorMagicBonus, ignoredArmorMagicBonus: 0, fixedCA, fixedSource, fixedCAActive: false, baseAfterFixed: armorBase, armorLayerCA, dex, shieldBonus, shieldSources, helmetBonus, objectProtectionBonus, objectSources, caNaturel, caTotal, syntheticArmorAC: armorLayerCA - objectProtectionBonus, context, version: ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION };
}

if (globalThis.Add2eEffectsEngine) {
  globalThis.Add2eEffectsEngine.itemEquipped = a2eSheetEquipped;
  globalThis.Add2eEffectsEngine.getMagicPassiveDefense = a2eSheetDefense;
}

if (globalThis.Add2eActorSheet?.prototype && !globalThis.Add2eActorSheet.prototype.__add2eBraceletsDefenseDisplayFixV4) {
  globalThis.Add2eActorSheet.prototype.__add2eBraceletsDefenseDisplayFixV4 = true;
  const originalGetData = globalThis.Add2eActorSheet.prototype.getData;
  globalThis.Add2eActorSheet.prototype.getData = async function add2eBraceletsDefenseGetData(...args) {
    const data = await originalGetData.apply(this, args);
    try {
      if (this.actor?.type !== "personnage") return data;
      const defense = a2eSheetDefense(this.actor, { source: "actor-sheet-postprocess" });
      data.combatDefense = data.combatDefense || {};
      data.combatDefense.ac_naturelle = defense.caNaturel;
      data.combatDefense.ac_totale = defense.caTotal;
      data.combatDefense.objets_magiques_defense = defense;
      if (defense.fixedCAActive) data.combatDefense.armure = `${defense.fixedSource} <small style="color:#7f704d;">(CA fixe, armure ignorée)</small>`;
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
