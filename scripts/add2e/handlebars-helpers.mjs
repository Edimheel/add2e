// scripts/add2e/handlebars-helpers.mjs
// ADD2E — Helpers Handlebars partagés.

// Helpers Handlebars
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.json) {
  Handlebars.registerHelper("json", ctx => JSON.stringify(ctx, null, 2));
}
if (!Handlebars.helpers.subtract) Handlebars.registerHelper("subtract", (a, b) => a - b);
if (!Handlebars.helpers.eq)       Handlebars.registerHelper("eq", (a, b) => a === b);
if (!Handlebars.helpers.add) Handlebars.registerHelper("add", (a, b) =>
  Number(a ?? 0) + Number(b ?? 0)
);
if (!Handlebars.helpers.gt)       Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.array) {
  Handlebars.registerHelper("array", function() {
    // On retire le dernier argument (obj Handlebars)
    return Array.prototype.slice.call(arguments, 0, -1);
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.lowercase) {
  Handlebars.registerHelper("lowercase", function(str) {
    return (str||"").toLowerCase();
  });
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
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9:+-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eHbsAsArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eHbsToTagArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eHbsToTagArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value"]) {
      if (value[key] !== undefined) return add2eHbsToTagArray(value[key]);
    }
  }
  return [];
}

function add2eHbsItemTags(item) {
  const s = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name,
    s.nom,
    s.categorie,
    s.category,
    s.type,
    s.sousType,
    s.sous_type,
    s.slot,
    ...add2eHbsToTagArray(s.tags),
    ...add2eHbsToTagArray(s.effectTags),
    ...add2eHbsToTagArray(s.effecttags),
    ...add2eHbsToTagArray(flags.tags)
  ].map(add2eHbsSlug).filter(Boolean);
}

function add2eHbsBool(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  return ["true", "1", "yes", "oui", "on", "checked", "equipped", "equipe", "équipé", "equipee", "équipée", "portee", "portée"].includes(String(value).trim().toLowerCase());
}

function add2eHbsItemEquipped(item) {
  const s = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return add2eHbsBool(s.equipee) || add2eHbsBool(s.equiped) || add2eHbsBool(s.equipped) || flags.equippedProjectile === true || flags.carquoisEquipe === true || flags.selectedProjectile === true;
}

function add2eHbsIsAmmunition(item) {
  const s = item?.system ?? {};
  const name = add2eHbsSlug(item?.name);
  const tags = new Set(add2eHbsItemTags(item));
  const fields = [s.categorie, s.category, s.sousType, s.sous_type, s.type, s.subtype, s.kind, s.slot].map(add2eHbsSlug).filter(Boolean);
  const rejected = new Set(["carquois", "quiver", "contenant", "container", "sac", "sacoche", "etui", "etuis", "boite", "boîte", "bourse"]);
  if ([...fields, ...tags].some(v => rejected.has(v))) return false;
  const accepted = new Set(["munition", "munitions", "projectile", "projectiles", "ammo", "ammunition", "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile", "type:munition", "type:projectile", "famille_arme:munition"]);
  if (fields.some(v => accepted.has(v))) return true;
  if ([...tags].some(v => accepted.has(v) || v.startsWith("munition:") || v.startsWith("projectile:"))) return true;
  return /\b(fleche|fleches|carreau|carreaux|trait|traits|bille|billes|pierre_de_fronde|pierres_de_fronde)\b/.test(name);
}

function add2eHbsWeaponRequiresProjectile(arme) {
  const s = arme?.system ?? {};
  const tags = new Set(add2eHbsItemTags(arme));
  const name = add2eHbsSlug(arme?.name);
  if (!(Number(s.portee_courte ?? 0) > 0)) return false;
  if (["usage:projectile_propulse", "categorie:projectile_propulse", "trait:projectile_propulse", "type:projectile_propulse", "arme:projectile_propulse"].some(t => tags.has(t))) return true;
  if (/\b(arc|arbalete|fronde)\b/.test(name)) return true;
  if (["usage:lancer", "usage:jet", "usage:arme_de_jet"].some(t => tags.has(t))) return false;
  return true;
}

function add2eHbsFindEquippedProjectile(items) {
  return add2eHbsAsArray(items).find(item => add2eHbsIsAmmunition(item) && add2eHbsItemEquipped(item)) ?? null;
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
  const s = component?.system ?? {};
  return add2eHbsSlug(s.slug ?? s.composantSlug ?? s.sousType ?? s.sous_type ?? component?.name ?? "");
}

function add2eHbsSpellMaterialEntries(sort) {
  const s = sort?.system ?? {};
  const raw = s.composants_materiels ?? s.composantsMateriels ?? s.materialComponents ?? [];
  const entries = [];
  for (const entry of add2eHbsAsArray(raw)) {
    if (!entry) continue;
    if (typeof entry === "string") {
      const slug = add2eHbsSlug(entry);
      if (slug) entries.push({ slug, nom: entry, quantite: 1, consomme: true });
      continue;
    }
    const nom = entry.nom ?? entry.name ?? entry.label ?? entry.slug ?? "Composant";
    const slug = add2eHbsSlug(entry.slug ?? nom);
    if (!slug) continue;
    entries.push({
      slug,
      nom: String(nom),
      quantite: Math.max(1, Number(entry.quantite ?? entry.quantity ?? 1) || 1),
      consomme: entry.consomme !== false && entry.consume !== false
    });
  }
  return entries;
}

function add2eHbsSpellMaterialSlugs(sort) {
  return add2eHbsSpellMaterialEntries(sort).map(entry => entry.slug).filter(Boolean);
}

function add2eHbsSigned(value) {
  const n = Number(value || 0);
  return `${n >= 0 ? "+" : ""}${n}`;
}

function add2eHbsNumeric(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function add2eHbsWeaponMagicBonus(arme, kind) {
  try {
    if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicWeaponBonus === "function") {
      return Number(Add2eEffectsEngine.getMagicWeaponBonus(arme, kind)) || 0;
    }
  } catch (_e) {}
  return kind === "damage" ? add2eHbsNumeric(arme?.system?.bonus_dom) : add2eHbsNumeric(arme?.system?.bonus_hit);
}

function add2eHbsEquippedArmorPieces(actor) {
  const items = add2eHbsAsArray(actor?.items?.contents ?? actor?.items ?? []);
  return items.filter(item => String(item?.type ?? "") === "armure" && add2eHbsItemEquipped(item));
}

function add2eHbsArmorOtherBonus(actor, key) {
  return add2eHbsEquippedArmorPieces(actor).reduce((sum, item) => sum + add2eHbsNumeric(item?.system?.[key]), 0);
}

function add2eHbsWeaponAbilityBonuses(actor, arme) {
  const sys = actor?.system ?? {};
  const type = String(arme?.system?.type_degats ?? "").toLowerCase();
  const isMelee = type.includes("tranchant") || type.includes("contondant");
  const isPiercing = type.includes("perforant");
  if (isMelee) return { hit: add2eHbsNumeric(sys.force_bonus_toucher), damage: add2eHbsNumeric(sys.force_bonus_degats), label: "FOR" };
  if (isPiercing) return { hit: add2eHbsNumeric(sys.dex_att), damage: add2eHbsNumeric(sys.dex_att), label: "DEX" };
  return { hit: 0, damage: 0, label: "—" };
}

function add2eHbsEquippedWeaponRows(actor, listeArmes, listeObjets, combatDefense) {
  const armes = add2eHbsAsArray(listeArmes).filter(arme => add2eHbsItemEquipped(arme));
  const thacoBase = add2eHbsNumeric(combatDefense?.thaco ?? actor?.system?.thac0 ?? 20);
  const otherHit = add2eHbsArmorOtherBonus(actor, "bonus_toucher");
  const otherDamage = add2eHbsArmorOtherBonus(actor, "bonus_degats");

  return armes.map(arme => {
    const ability = add2eHbsWeaponAbilityBonuses(actor, arme);
    const magicHit = add2eHbsWeaponMagicBonus(arme, "hit");
    const magicDamage = add2eHbsWeaponMagicBonus(arme, "damage");
    const totalHit = magicHit + ability.hit + otherHit;
    const totalDamage = magicDamage + ability.damage + otherDamage;
    const thacoEffectif = thacoBase - totalHit;
    return {
      id: arme?._id ?? arme?.id ?? "",
      name: arme?.name ?? "Arme",
      damage: add2eHbsWeaponRequiresProjectile(arme) ? (add2eHbsFindEquippedProjectile(listeObjets) ? add2eHbsDisplayDamageForItem(add2eHbsFindEquippedProjectile(listeObjets)) : add2eHbsDisplayDamageForItem(arme)) : add2eHbsDisplayDamageForItem(arme),
      type: arme?.system?.type_degats ?? "",
      abilityLabel: ability.label,
      magicHit,
      magicDamage,
      abilityHit: ability.hit,
      abilityDamage: ability.damage,
      otherHit,
      otherDamage,
      totalHit,
      totalDamage,
      thacoBase,
      thacoEffectif,
      magicHitSigned: add2eHbsSigned(magicHit),
      magicDamageSigned: add2eHbsSigned(magicDamage),
      abilityHitSigned: add2eHbsSigned(ability.hit),
      abilityDamageSigned: add2eHbsSigned(ability.damage),
      otherHitSigned: add2eHbsSigned(otherHit),
      otherDamageSigned: add2eHbsSigned(otherDamage),
      totalHitSigned: add2eHbsSigned(totalHit),
      totalDamageSigned: add2eHbsSigned(totalDamage)
    };
  });
}

if (typeof Handlebars !== "undefined") {
  // Capitalise la première lettre
  Handlebars.registerHelper("capitalize", str =>
    (str && typeof str === "string") ? str.charAt(0).toUpperCase() + str.slice(1) : str
  );

  // Met en majuscule
  Handlebars.registerHelper("uppercase", str =>
    (str && typeof str === "string") ? str.toUpperCase() : str
  );

  // Sous-chaîne (substr)
  Handlebars.registerHelper("substr", (str, start, len) =>
    (str && typeof str === "string") ? str.substr(start, len) : str
  );

  // Concatène deux strings
  Handlebars.registerHelper("concat", function () {
    // Prend tous les arguments sauf le dernier (qui est options)
    return Array.from(arguments).slice(0, -1).join('');
  });

  // Crée un array (utile pour boucler sur une liste fixe dans le HBS)
  Handlebars.registerHelper("array", function () {
    return Array.prototype.slice.call(arguments, 0, -1);
  });
}

if (typeof Handlebars !== "undefined" && !Handlebars.helpers.getFlag) {
  Handlebars.registerHelper("getFlag", function(item, flag) {
    try {
      // Pour éviter les crashs si getFlag n'est pas dispo (ex : preview)
      if (!item || typeof item.getFlag !== "function") return false;
      const [scope, key] = flag.split('.');
      return item.getFlag(scope, key);
    } catch {
      return false;
    }
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.toSpecialArray) {
  Handlebars.registerHelper("toSpecialArray", function (val) {
    // Si déjà un tableau, clone-le et filtre les vides/NEW
    if (Array.isArray(val)) {
      return val.filter(e => !!e && e !== "" && e !== "NEW");
    }
    // Si objet à clés numériques, convertis-le
    if (typeof val === "object" && val !== null) {
      return Object.values(val).filter(e => !!e && e !== "" && e !== "NEW");
    }
    // Rien à afficher
    return [];
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.length) {
  Handlebars.registerHelper('length', function(x) { return x ? x.length : 0; });
}

if (typeof Handlebars !== "undefined") {
  Handlebars.registerHelper("joinLines", function(value, fallback) {
    if (Array.isArray(value) && value.length) return value.filter(Boolean).join("\n");
    if (typeof value === "string" && value.trim()) return value;
    return typeof fallback === "string" ? fallback : "";
  });

  Handlebars.registerHelper("negativeNumber", function(value) {
    const n = Number(value || 0);
    return n === 0 ? 0 : -Math.abs(n);
  });

  Handlebars.registerHelper("signedNumber", function(value) {
    return add2eHbsSigned(value);
  });

  Handlebars.registerHelper("add2eItemDisplayDamage", function(item) {
    return add2eHbsDisplayDamageForItem(item);
  });

  Handlebars.registerHelper("add2eWeaponDisplayDamage", function(arme, listeObjets) {
    if (add2eHbsWeaponRequiresProjectile(arme)) {
      const projectile = add2eHbsFindEquippedProjectile(listeObjets);
      if (projectile) return add2eHbsDisplayDamageForItem(projectile);
    }
    return add2eHbsDisplayDamageForItem(arme);
  });

  Handlebars.registerHelper("add2eEquippedWeaponRows", function(actor, listeArmes, listeObjets, combatDefense) {
    return add2eHbsEquippedWeaponRows(actor, listeArmes, listeObjets, combatDefense);
  });

  Handlebars.registerHelper("magicSourceNames", function(value, fallback) {
    if (!Array.isArray(value) || !value.length) return typeof fallback === "string" ? fallback : "";
    return value
      .filter(Boolean)
      .map(source => String(source).replace(/:\s*[-+]?\d+\s*$/, ""))
      .join("\n");
  });

  Handlebars.registerHelper("componentSpellNames", function(component, sortsParNiveau) {
    const componentSlug = add2eHbsComponentSlug(component);
    if (!componentSlug || !sortsParNiveau || typeof sortsParNiveau !== "object") return "—";

    const spells = [];
    for (const list of Object.values(sortsParNiveau)) {
      for (const sort of add2eHbsAsArray(list)) {
        const slugs = add2eHbsSpellMaterialSlugs(sort);
        if (slugs.includes(componentSlug)) spells.push(String(sort?.name ?? "Sort"));
      }
    }

    if (!spells.length) return "—";
    const unique = [...new Set(spells)].sort((a, b) => a.localeCompare(b));
    return unique.join(", ");
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
}
