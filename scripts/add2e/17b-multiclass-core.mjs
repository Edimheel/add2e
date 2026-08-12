// ADD2E — Multiclassage : noyau canonique
// Source de vérité : chaque Item embarqué de type "classe".
// La définition et la progression (system.niveau / system.xp) vivent ensemble.

export const MULTICLASS_VERSION = "2026-08-12-canonical-thac0-v5";
export const MULTICLASS_SCHEMA = 3;
export const INTERNAL = "add2eMulticlassInternal";
export const TAG = "[ADD2E][MULTICLASSE]";

export function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

export function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "base", "max", "niveau", "level", "xp"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") {
        return num(value[key], fallback);
      }
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

export function cloneItemData(itemLike) {
  const data = typeof itemLike?.toObject === "function"
    ? itemLike.toObject()
    : foundry.utils.deepClone(itemLike ?? {});
  if (!data || typeof data !== "object") return null;
  const copy = foundry.utils.deepClone(data);
  delete copy._id;
  delete copy._stats;
  return copy;
}

export function itemLabel(data, fallback = "Item") {
  const sys = data?.system ?? data ?? {};
  return String(data?.name ?? sys.label ?? sys.nom ?? sys.name ?? fallback).trim() || fallback;
}

function canonicalIdentityFromTag(data, prefix, label) {
  const sys = data?.system ?? data ?? {};
  const tags = Array.isArray(sys.tags) ? sys.tags : [];
  const normalizedPrefix = `${norm(prefix)}_`;
  const identityTag = tags.map(norm).find(tag => tag.startsWith(normalizedPrefix));
  if (!identityTag) {
    throw new Error(`Item ${label} « ${data?.name ?? data?.id ?? "inconnu"} » sans tag canonique ${prefix}:*.`);
  }
  const slug = identityTag.slice(normalizedPrefix.length);
  if (!slug) {
    throw new Error(`Item ${label} « ${data?.name ?? data?.id ?? "inconnu"} » avec tag ${prefix}:* invalide.`);
  }
  return slug;
}

export function classSlug(data) {
  return canonicalIdentityFromTag(data, "classe", "de classe");
}

export function raceSlug(data) {
  return canonicalIdentityFromTag(data, "race", "race");
}

export function classItems(actor) {
  const contents = actor?.items?.contents ?? Array.from(actor?.items ?? []);
  return contents.filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

export function classItem(actor, itemOrSlug) {
  if (!actor) return null;
  const itemId = typeof itemOrSlug === "object" ? String(itemOrSlug?.id ?? "") : "";
  const slug = typeof itemOrSlug === "object" ? classSlug(itemOrSlug) : norm(itemOrSlug);
  return classItems(actor).find(item =>
    (itemId && String(item.id ?? "") === itemId)
    || (slug && classSlug(item) === slug)
  ) ?? null;
}

export function raceItem(actor) {
  const contents = actor?.items?.contents ?? Array.from(actor?.items ?? []);
  const races = contents.filter(item => String(item?.type ?? "").toLowerCase() === "race");
  if (races.length > 1) {
    throw new Error(`L’acteur « ${actor?.name ?? actor?.id ?? "inconnu"} » possède plusieurs Items race.`);
  }
  return races[0] ?? null;
}

export function systemRace(actor, override = null) {
  if (override) return override;
  return raceItem(actor);
}

function exactInteger(value, minimum = 0) {
  const parsed = num(value, NaN);
  if (!Number.isFinite(parsed)) return null;
  const integer = Math.floor(parsed);
  return integer >= minimum ? integer : null;
}

function strictFiniteNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Lit exclusivement les champs de progression de l'Item classe.
 * Aucun champ de l'acteur n'est consulté ici.
 */
export function classProgression(item, { level = 1, xp = 0 } = {}) {
  const system = item?.system ?? {};
  const itemLevel = exactInteger(system.niveau, 1);
  const itemXp = exactInteger(system.xp, 0);
  return {
    level: itemLevel ?? Math.max(1, Math.floor(num(level, 1))),
    xp: itemXp ?? Math.max(0, Math.floor(num(xp, 0))),
    hasLevel: itemLevel !== null,
    hasXp: itemXp !== null
  };
}

/**
 * Retourne strictement la ligne de progression correspondant au system.niveau
 * de l'Item classe. Aucun accès par index de tableau n'est autorisé.
 */
export function classProgressionRow(item) {
  const state = classProgression(item);
  if (!state.hasLevel) {
    throw new Error(`Niveau canonique absent sur l’Item classe « ${item?.name ?? item?.id ?? "inconnu"} ».`);
  }

  const progression = Array.isArray(item?.system?.progression) ? item.system.progression : [];
  const row = progression.find(entry => Number(entry?.niveau) === state.level) ?? null;
  if (!row) {
    throw new Error(`Progression canonique absente pour « ${item?.name ?? "classe"} » au niveau ${state.level}.`);
  }

  return {
    item,
    level: state.level,
    row
  };
}

export function canonicalClassThac0(item) {
  const progression = classProgressionRow(item);
  const thac0 = strictFiniteNumber(progression.row?.thac0);
  if (thac0 === null) {
    throw new Error(`THAC0 canonique invalide pour ${item?.name ?? "classe"} au niveau ${progression.level}.`);
  }

  return {
    value: thac0,
    itemId: item?.id ?? null,
    itemUuid: item?.uuid ?? null,
    className: item?.name ?? itemLabel(item, "Classe"),
    classSlug: classSlug(item),
    level: progression.level
  };
}

/**
 * Résolution canonique unique du THAC0.
 * - transformation : priorité absolue si elle fournit un THAC0 ;
 * - personnage : progression de chaque Item classe, meilleur THAC0 en multiclassage ;
 * - autres acteurs : system.thac0 uniquement.
 */
export function resolveCanonicalThac0(actor, { transformation = undefined } = {}) {
  if (!actor) throw new Error("Acteur absent pour la résolution canonique du THAC0.");

  const transformationProfile = transformation === undefined
    ? globalThis.add2eGetCapabilityTransformationCombatProfile?.(actor) ?? null
    : transformation;
  const transformationThac0 = strictFiniteNumber(transformationProfile?.thac0);
  if (transformationThac0 !== null) {
    return {
      value: transformationThac0,
      source: "transformation.thac0",
      transformation: transformationProfile,
      selectedClass: null,
      classes: []
    };
  }

  if (String(actor?.type ?? "").toLowerCase() === "personnage") {
    const classes = classItems(actor);
    if (!classes.length) {
      throw new Error(`${actor?.name ?? "Personnage"} : aucun Item classe canonique pour résoudre le THAC0.`);
    }

    const resolutions = classes.map(canonicalClassThac0);
    const selected = resolutions.reduce((best, current) => current.value < best.value ? current : best);
    return {
      value: selected.value,
      source: "class.progression.thac0",
      transformation: null,
      selectedClass: selected,
      classes: resolutions
    };
  }

  const actorThac0 = strictFiniteNumber(actor?.system?.thac0);
  if (actorThac0 === null) {
    throw new Error(`${actor?.name ?? "Acteur"} : THAC0 canonique absent dans system.thac0.`);
  }

  return {
    value: actorThac0,
    source: "actor.system.thac0",
    transformation: null,
    selectedClass: null,
    classes: []
  };
}

export function classProgressionUpdate(item, { level, xp } = {}) {
  const update = { _id: item?.id };
  if (!update._id) return null;
  if (level !== undefined) update["system.niveau"] = Math.max(1, Math.floor(num(level, 1)));
  if (xp !== undefined) update["system.xp"] = Math.max(0, Math.floor(num(xp, 0)));
  return update;
}

/**
 * Métadonnées d'acteur uniquement : elles ne portent jamais de progression.
 */
export function canonicalMulticlass(actor) {
  if (actor?.type !== "personnage" || classItems(actor).length <= 1) return null;
  const stored = actor?.system?.multiclasse;
  return {
    schema: MULTICLASS_SCHEMA,
    enabled: true,
    mode: stored?.mode === "racial" ? "racial" : "racial",
    xpSplit: stored?.xpSplit === "equal" ? "equal" : "equal",
    label: String(stored?.label ?? "")
  };
}

export function canonicalClassState(actor, itemOrSlug) {
  const item = typeof itemOrSlug === "object" && itemOrSlug?.type === "classe"
    ? itemOrSlug
    : classItem(actor, itemOrSlug);
  if (!item) return null;
  const progression = classProgression(item);
  return {
    itemId: item.id ?? null,
    uuid: item.uuid ?? null,
    name: item.name ?? itemLabel(item, "Classe"),
    slug: classSlug(item),
    level: progression.level,
    xp: progression.xp,
    hasLevel: progression.hasLevel,
    hasXp: progression.hasXp
  };
}

export function canonicalClassStates(actor) {
  return classItems(actor).map(item => canonicalClassState(actor, item)).filter(Boolean);
}

export function canonicalClassLevel(actor, itemOrSlug, fallback = 1) {
  const state = canonicalClassState(actor, itemOrSlug);
  return state?.hasLevel ? state.level : Math.max(1, Math.floor(num(fallback, 1)));
}

export function canonicalClassXp(actor, itemOrSlug, fallback = 0) {
  const state = canonicalClassState(actor, itemOrSlug);
  return state?.hasXp ? state.xp : Math.max(0, Math.floor(num(fallback, 0)));
}

export function multiclassEnabled(actor) {
  return actor?.type === "personnage" && classItems(actor).length > 1;
}

export function pickClassAlignment(actor, classData) {
  try {
    if (typeof globalThis.add2ePickClassAlignment === "function") {
      return globalThis.add2ePickClassAlignment(actor, classData?.system ?? classData ?? {});
    }
  } catch (error) {
    warn("[ALIGNMENT_PICK_ERROR]", error);
  }
  return actor?.system?.alignement ?? "";
}

try {
  globalThis.add2eCanonicalMulticlass = canonicalMulticlass;
  globalThis.add2eCanonicalClassStates = canonicalClassStates;
  globalThis.add2eCanonicalClassState = canonicalClassState;
  globalThis.add2eCanonicalClassLevel = canonicalClassLevel;
  globalThis.add2eCanonicalClassXp = canonicalClassXp;
  globalThis.add2eClassProgression = classProgression;
  globalThis.add2eClassProgressionRow = classProgressionRow;
  globalThis.add2eResolveCanonicalThac0 = resolveCanonicalThac0;
} catch (_error) {}