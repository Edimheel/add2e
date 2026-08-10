// scripts/add2e/handlebars-helpers.mjs
// ADD2E — Helpers Handlebars partagés.
// Version : 2026-08-10-display-only-helpers-v8-canonical-components

if (typeof Handlebars !== "undefined" && !Handlebars.helpers.json) {
  Handlebars.registerHelper("json", ctx => JSON.stringify(ctx, null, 2));
}
if (!Handlebars.helpers.subtract) Handlebars.registerHelper("subtract", (a, b) => a - b);
if (!Handlebars.helpers.eq) Handlebars.registerHelper("eq", (a, b) => a === b);
if (!Handlebars.helpers.add) Handlebars.registerHelper("add", (a, b) => Number(a ?? 0) + Number(b ?? 0));
if (!Handlebars.helpers.gt) Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.array) {
  Handlebars.registerHelper("array", function() { return Array.prototype.slice.call(arguments, 0, -1); });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.lowercase) {
  Handlebars.registerHelper("lowercase", function(str) { return (str || "").toLowerCase(); });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.padLeft) {
  Handlebars.registerHelper("padLeft", function(value, width, char) {
    value = (value !== undefined && value !== null) ? String(value) : "";
    width = parseInt(width) || 2;
    char = (typeof char === "string" && char.length) ? char : "0";
    while (value.length < width) value = char + value;
    return value;
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.formatSortChamp) {
  Handlebars.registerHelper("formatSortChamp", function(val) {
    if (!val) return "-";
    if (typeof val === "object") {
      const v = val.valeur !== undefined ? val.valeur : "";
      const u = val.unite ? (" " + val.unite) : "";
      return `${v}${u}`.trim() || "-";
    }
    return val;
  });
}

function add2eHbsSlug(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "_").replace(/[^a-z0-9:+-]+/g, "_").replace(/^_+|_+$/g, "");
}

function add2eHbsAsArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eHbsDamageData(item) {
  const s = item?.system ?? {};
  return s.dégâts ?? s.degats ?? s.damage ?? s.damages ?? null;
}

function add2eHbsDamagePart(data, keys) {
  if (!data || typeof data !== "object") return "";
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function add2eHbsDisplayDamageForItem(item) {
  const data = add2eHbsDamageData(item);
  if (typeof data === "string" && data.trim()) return data.trim();
  const medium = add2eHbsDamagePart(data, ["contre_moyen", "moyen", "medium", "m", "M"]);
  const large = add2eHbsDamagePart(data, ["contre_grand", "grand", "large", "g", "G", "L"]);
  if (medium || large) return `${medium || "-"} / ${large || "-"}`;
  const s = item?.system ?? {};
  const directMedium = s.degats_moyen ?? s.dégâts_moyen ?? s.degatsMoyen ?? s.damageMedium;
  const directLarge = s.degats_grand ?? s.dégâts_grand ?? s.degatsGrand ?? s.damageLarge;
  if (directMedium || directLarge) return `${directMedium || "-"} / ${directLarge || "-"}`;
  return "-";
}

function add2eHbsComponentSlug(component) {
  return add2eHbsSlug(component?.flags?.add2e?.slug);
}

function add2eHbsIsOnlyComponentCode(value) {
  const text = add2eHbsSlug(value).replace(/_/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}

function add2eHbsMaterialName(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String(value.nom ?? value.slug ?? "").trim();
}

function add2eHbsMaterialSlug(value, name = add2eHbsMaterialName(value)) {
  if (value && typeof value === "object" && !Array.isArray(value) && value.slug) return add2eHbsSlug(value.slug);
  return add2eHbsSlug(name);
}

function add2eHbsMaterialQty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 1;
  return Math.max(1, Math.floor(Number(value.quantite) || 1));
}

function add2eHbsMaterialConsumes(value) {
  return !(value && typeof value === "object" && !Array.isArray(value) && value.consomme === false);
}

function add2eHbsMakeMaterialEntry(value) {
  const nom = add2eHbsMaterialName(value);
  if (!nom || add2eHbsIsOnlyComponentCode(nom)) return null;
  const materialSlug = add2eHbsMaterialSlug(value, nom);
  if (!materialSlug) return null;
  return {
    slug: materialSlug,
    nom,
    quantite: add2eHbsMaterialQty(value),
    consomme: add2eHbsMaterialConsumes(value)
  };
}

function add2eHbsPushMaterialEntry(entries, entry) {
  const existing = entries.find(candidate => candidate.slug === entry.slug && candidate.consomme === entry.consomme && !candidate.alternatives);
  if (existing) existing.quantite += entry.quantite;
  else entries.push(entry);
}

function add2eHbsAddSpellMaterialEntry(entries, value) {
  const entry = add2eHbsMakeMaterialEntry(value);
  if (entry) add2eHbsPushMaterialEntry(entries, entry);
}

function add2eHbsAddAlternativeMaterials(entries, alternatives) {
  const clean = [];
  for (const alternative of alternatives) {
    const entry = add2eHbsMakeMaterialEntry(alternative);
    if (entry && !clean.some(candidate => candidate.slug === entry.slug && candidate.consomme === entry.consomme)) clean.push(entry);
  }
  if (!clean.length) return;
  if (clean.length === 1) {
    add2eHbsPushMaterialEntry(entries, clean[0]);
    return;
  }
  entries.push({
    slug: clean.map(entry => entry.slug).join("__or__"),
    nom: clean.map(entry => entry.nom).join(" ou "),
    quantite: 1,
    consomme: clean.some(entry => entry.consomme !== false),
    alternatives: clean
  });
}

function add2eHbsCollectSpellMaterials(entries, value) {
  if (value === null || value === undefined || value === "") return;

  if (Array.isArray(value)) {
    for (const entry of value) add2eHbsCollectSpellMaterials(entries, entry);
    return;
  }

  if (typeof value === "string") {
    for (const rawPart of value.split(/[,;|\n]+/g).map(part => part.trim()).filter(Boolean)) {
      const alternatives = rawPart.split(/\bou\b/gi).map(entry => entry.trim()).filter(Boolean);
      if (alternatives.length > 1) add2eHbsAddAlternativeMaterials(entries, alternatives);
      else add2eHbsAddSpellMaterialEntry(entries, rawPart);
    }
    return;
  }

  if (typeof value === "object") {
    if (Array.isArray(value.alternatives) && value.alternatives.length) {
      add2eHbsAddAlternativeMaterials(entries, value.alternatives);
      return;
    }
    add2eHbsAddSpellMaterialEntry(entries, value);
  }
}

function add2eHbsSpellMaterialEntries(sort) {
  const entries = [];
  add2eHbsCollectSpellMaterials(entries, sort?.system?.composants_materiels ?? sort?.composants_materiels);
  return entries;
}

function add2eHbsSpellMaterialSlugs(sort) {
  return add2eHbsSpellMaterialEntries(sort)
    .flatMap(entry => entry.alternatives?.length ? entry.alternatives.map(alternative => alternative.slug) : [entry.slug])
    .filter(Boolean);
}

function add2eHbsSpellComponentTypes(sort) {
  const raw = sort?.system?.composantes ?? sort?.composantes ?? "";
  if (Array.isArray(raw)) return raw.map(value => String(value).trim().toUpperCase()).filter(Boolean).join(", ") || "—";
  const text = String(raw ?? "").trim();
  if (!text) return "—";
  return text.replaceAll("/", ",").split(/[,;|\s]+/g).map(value => value.trim().toUpperCase()).filter(Boolean).join(", ") || "—";
}

function add2eHbsSigned(value) {
  const n = Number(value || 0);
  return `${n >= 0 ? "+" : ""}${n}`;
}

if (typeof Handlebars !== "undefined") {
  Handlebars.registerHelper("capitalize", str => (str && typeof str === "string") ? str.charAt(0).toUpperCase() + str.slice(1) : str);
  Handlebars.registerHelper("uppercase", str => (str && typeof str === "string") ? str.toUpperCase() : str);
  Handlebars.registerHelper("substr", (str, start, len) => (str && typeof str === "string") ? str.substr(start, len) : str);
  Handlebars.registerHelper("concat", function () { return Array.from(arguments).slice(0, -1).join(''); });
  Handlebars.registerHelper("array", function () { return Array.prototype.slice.call(arguments, 0, -1); });
  Handlebars.registerHelper("joinLines", function(value, fallback) { if (Array.isArray(value) && value.length) return value.filter(Boolean).join("\n"); if (typeof value === "string" && value.trim()) return value; return typeof fallback === "string" ? fallback : ""; });
  Handlebars.registerHelper("negativeNumber", function(value) { const n = Number(value || 0); return n === 0 ? 0 : -Math.abs(n); });
  Handlebars.registerHelper("signedNumber", function(value) { return add2eHbsSigned(value); });
  Handlebars.registerHelper("add2eItemDisplayDamage", function(item) { return add2eHbsDisplayDamageForItem(item); });
  Handlebars.registerHelper("componentSpellNames", function(component, sortsParNiveau) {
    const componentSlug = add2eHbsComponentSlug(component);
    if (!componentSlug || !sortsParNiveau || typeof sortsParNiveau !== "object") return "—";
    const spells = [];
    for (const list of Object.values(sortsParNiveau)) {
      for (const sort of add2eHbsAsArray(list)) {
        if (add2eHbsSpellMaterialSlugs(sort).includes(componentSlug)) spells.push(String(sort?.name ?? "Sort"));
      }
    }
    return spells.length ? [...new Set(spells)].sort((a, b) => a.localeCompare(b)).join(", ") : "—";
  });
  Handlebars.registerHelper("spellMaterialComponents", function(sort) {
    const entries = add2eHbsSpellMaterialEntries(sort);
    if (!entries.length) return "—";
    const text = entries.map(entry => {
      const qty = entry.quantite > 1 ? ` x${entry.quantite}` : "";
      const state = entry.consomme ? "" : " (non consommé)";
      return `${entry.nom}${qty}${state}`;
    }).join(", ");
    return text || "—";
  });
  Handlebars.registerHelper("spellComponentTypes", function(sort) { return add2eHbsSpellComponentTypes(sort); });
}

if (typeof Handlebars !== "undefined" && !Handlebars.helpers.getFlag) Handlebars.registerHelper("getFlag", function(item, flag) { try { if (!item || typeof item.getFlag !== "function") return false; const [scope, key] = flag.split('.'); return item.getFlag(scope, key); } catch { return false; } });
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.toSpecialArray) Handlebars.registerHelper("toSpecialArray", function (val) { if (Array.isArray(val)) return val.filter(e => !!e && e !== "" && e !== "NEW"); if (typeof val === "object" && val !== null) return Object.values(val).filter(e => !!e && e !== "" && e !== "NEW"); return []; });
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.length) Handlebars.registerHelper("length", function(x) { return x ? x.length : 0; });
