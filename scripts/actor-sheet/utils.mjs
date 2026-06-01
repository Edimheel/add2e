// scripts/actor-sheet/utils.mjs
// ADD2E — Utilitaires partagés de la feuille acteur.

export const ADD2E_CARACS = [
  "force",
  "dexterite",
  "constitution",
  "intelligence",
  "sagesse",
  "charisme"
];

export function add2eNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function add2eGetProperty(obj, path) {
  try {
    if (foundry?.utils?.getProperty) return foundry.utils.getProperty(obj, path);
  } catch (e) {}

  try {
    if (typeof getProperty === "function") return getProperty(obj, path);
  } catch (e) {}

  return String(path || "")
    .split(".")
    .reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

export function add2eRaceAbilityValue(adjustments, shortKey, longKey) {
  return Number(adjustments?.[shortKey] ?? adjustments?.[longKey] ?? 0);
}

export function add2eToTextList(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join(", ");
  }

  return String(value);
}

export function add2eToMultilineText(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join("\n");
  }

  return String(value);
}

export function add2eNormalizeTags(raw) {
  const result = [];

  const add = (v) => {
    if (!v) return;

    if (Array.isArray(v)) {
      for (const x of v) add(x);
      return;
    }

    if (v instanceof Set) {
      for (const x of Array.from(v)) add(x);
      return;
    }

    if (typeof v === "object") {
      if (Array.isArray(v.value)) add(v.value);
      else if (Array.isArray(v.tags)) add(v.tags);
      else if (Array.isArray(v.list)) add(v.list);
      else if (Array.isArray(v.items)) add(v.items);
      else if (Array.isArray(v.effectTags)) add(v.effectTags);
      else if (typeof v.value === "string") add(v.value);
      else if (typeof v.tags === "string") add(v.tags);
      else if (typeof v.list === "string") add(v.list);
      else if (typeof v.items === "string") add(v.items);
      else if (typeof v.effectTags === "string") add(v.effectTags);
      return;
    }

    String(v)
      .split(/[,;\n]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .forEach(t => result.push(t));
  };

  add(raw);

  return [...new Set(result)];
}

export function add2eSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_")
    .replace(/s$/, "");
}

export function add2eCollectTagsFromEffect(effect) {
  if (!effect) return [];

  return [
    ...add2eNormalizeTags(effect.flags?.add2e?.tags),
    ...add2eNormalizeTags(effect.flags?.add2e?.effectTags)
  ];
}

export function add2eCollectTagsFromItem(item) {
  const tags = [];
  if (!item) return tags;

  tags.push(...add2eNormalizeTags(item.system?.tags));
  tags.push(...add2eNormalizeTags(item.system?.tag));
  tags.push(...add2eNormalizeTags(item.system?.effectTags));
  tags.push(...add2eNormalizeTags(item.system?.effets));
  tags.push(...add2eNormalizeTags(item.system?.effects));
  tags.push(...add2eNormalizeTags(item.flags?.add2e?.tags));
  tags.push(...add2eNormalizeTags(item.flags?.add2e?.effectTags));

  const effects = item.effects?.contents ?? item.effects ?? [];
  for (const effect of effects) {
    tags.push(...add2eCollectTagsFromEffect(effect));
  }

  return [...new Set(tags)].filter(Boolean);
}

export function add2eGetAbilityBase(actor, carac) {
  const sys = actor?.system ?? {};

  const explicitBase = Number(sys[`${carac}_base`]);
  if (Number.isFinite(explicitBase)) return explicitBase;

  const current = add2eNumber(sys[carac], 10);
  const oldRaceBonus = add2eNumber(sys.bonus_caracteristiques?.[carac], 0);
  const oldDiversBonus = add2eNumber(sys.bonus_divers_caracteristiques?.[carac], 0);

  return current - oldRaceBonus - oldDiversBonus;
}

export async function add2eUpdateFinalCaracsLocal(actor) {
  if (!actor) return;

  const updates = {};

  for (const c of ADD2E_CARACS) {
    const base = add2eGetAbilityBase(actor, c);
    const bonusRace = add2eNumber(add2eGetProperty(actor.system, `bonus_caracteristiques.${c}`), 0);
    const bonusDivers = add2eNumber(add2eGetProperty(actor.system, `bonus_divers_caracteristiques.${c}`), 0);

    updates[`system.${c}_base`] = base;
    updates[`system.${c}`] = base + bonusRace + bonusDivers;
  }

  await actor.update(updates);
}
