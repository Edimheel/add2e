// ============================================================================
// ADD2E — Noyau générique des transformations de capacités.
// Compatible Foundry V13/V14/V15.
// ============================================================================

export const ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION = "2026-07-07-capability-transformations-v2";

const FLAG_SCOPE = "add2e";
const FLAG_KEY = "capabilityTransformation";
const COMBAT_SYSTEM_PATHS = Object.freeze([
  "system.ca",
  "system.ca_optimale",
  "system.ca_naturel",
  "system.ca_total",
  "system.dex_def",
  "system.thac0",
  "system.vitesse_deplacement"
]);

function add2eTransformationArray(value) {
  if (Array.isArray(value)) return value;
  if (value?.contents) return Array.from(value.contents);
  if (typeof value?.values === "function") return Array.from(value.values());
  return value ? Array.from(value) : [];
}

function add2eTransformationNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function add2eTransformationClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eTransformationGetProperty(object, path) {
  if (foundry?.utils?.getProperty) return foundry.utils.getProperty(object, path);
  return String(path).split(".").reduce((current, key) => current?.[key], object);
}

function add2eTransformationFlag(document) {
  const flag = document?.flags?.[FLAG_SCOPE]?.[FLAG_KEY];
  return flag && typeof flag === "object" ? flag : null;
}

function add2eTransformationIsActiveFormEffect(effect) {
  const flag = add2eTransformationFlag(effect);
  return !!(
    effect &&
    effect.disabled !== true &&
    flag?.kind === "form" &&
    String(flag?.sourceKey ?? "").trim()
  );
}

function add2eTransformationCompare(left, right) {
  const leftTick = add2eTransformationNumber(add2eTransformationFlag(left)?.activatedAtTick) ?? -1;
  const rightTick = add2eTransformationNumber(add2eTransformationFlag(right)?.activatedAtTick) ?? -1;
  if (leftTick !== rightTick) return rightTick - leftTick;
  return String(right?.id ?? "").localeCompare(String(left?.id ?? ""));
}

function add2eTransformationClassItems(actor) {
  return add2eTransformationArray(actor?.items)
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function add2eTransformationClassLevel(actor, classItem) {
  const system = classItem?.system ?? {};
  const key = String(system.slug ?? system.label ?? system.nom ?? system.name ?? classItem?.name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const perClass = actor?.system?.niveaux_par_classe ?? {};
  const level = Number(perClass?.[key] ?? system.niveau ?? system.level ?? actor?.system?.niveau ?? 1);
  return Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
}

function add2eTransformationArrayValue(value) {
  if (Array.isArray(value)) return value.slice();
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  return [];
}

export function add2eGetCapabilityTransformationEffects(actor, { sourceKey = null } = {}) {
  const wanted = sourceKey === null || sourceKey === undefined ? "" : String(sourceKey).trim();
  return add2eTransformationArray(actor?.effects)
    .filter(add2eTransformationIsActiveFormEffect)
    .filter(effect => !wanted || add2eTransformationFlag(effect)?.sourceKey === wanted)
    .sort(add2eTransformationCompare);
}

export function add2eGetActiveCapabilityTransformation(actor, options = {}) {
  return add2eGetCapabilityTransformationEffects(actor, options)[0] ?? null;
}

export function add2eGetCapabilityTransformationCombatProfile(actor, options = {}) {
  const effect = add2eGetActiveCapabilityTransformation(actor, options);
  if (!effect) return null;

  const transformation = add2eTransformationFlag(effect) ?? {};
  const combat = transformation.combat && typeof transformation.combat === "object"
    ? transformation.combat
    : {};
  const armorClass = add2eTransformationNumber(
    combat.armorClass ?? combat.ca ?? combat.ac ?? transformation.armorClass ?? transformation.ca ?? transformation.ac
  );
  const thac0 = add2eTransformationNumber(combat.thac0 ?? combat.thaco ?? transformation.thac0 ?? transformation.thaco);
  const movement = String(
    combat.movement ?? transformation.movement?.display ?? transformation.movement ?? transformation.movementDisplay ?? ""
  ).trim();

  return {
    version: String(transformation.version ?? ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION),
    effect,
    effectId: effect.id ?? null,
    sourceKey: String(transformation.sourceKey ?? ""),
    formKey: String(transformation.formKey ?? ""),
    category: String(transformation.category ?? ""),
    label: String(transformation.label ?? effect.name ?? effect.label ?? "Transformation"),
    armorClass,
    thac0,
    movement,
    raw: transformation
  };
}

export function add2eCaptureCapabilityTransformationCombatState(actor) {
  const actorSystem = {};
  for (const path of COMBAT_SYSTEM_PATHS) {
    actorSystem[path] = add2eTransformationClone(add2eTransformationGetProperty(actor, path));
  }

  const classes = add2eTransformationClassItems(actor).map(item => ({
    id: item.id,
    progression: add2eTransformationClone(item?.system?.progression),
    thac0: add2eTransformationClone(item?.system?.thac0)
  })).filter(entry => entry.id);

  return { version: ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION, actorSystem, classes };
}

export async function add2eApplyCapabilityTransformationCombatProfile(actor, profile = {}) {
  if (!actor?.update) return false;

  const armorClass = add2eTransformationNumber(profile.armorClass ?? profile.ca ?? profile.ac);
  const thac0 = add2eTransformationNumber(profile.thac0 ?? profile.thaco);
  const movement = String(profile.movement ?? "").trim();
  const actorUpdate = {};

  if (armorClass !== null) {
    // Le moteur ADD2E calcule la CA effective depuis la DEX défensive lorsque
    // aucune armure n'est équipée. Les équipements sont suspendus par la
    // transformation ; cette adaptation rend donc la CA de forme visible et
    // utilisable par feuille, effets et jets d'attaque existants.
    actorUpdate["system.ca"] = armorClass;
    actorUpdate["system.ca_optimale"] = armorClass;
    actorUpdate["system.ca_naturel"] = armorClass;
    actorUpdate["system.ca_total"] = armorClass;
    actorUpdate["system.dex_def"] = armorClass - 10;
  }
  if (thac0 !== null) actorUpdate["system.thac0"] = thac0;
  if (movement) actorUpdate["system.vitesse_deplacement"] = movement;
  if (Object.keys(actorUpdate).length) {
    await actor.update(actorUpdate, { add2eInternal: true, add2eReason: "capability-transformation-combat-profile" });
  }

  if (thac0 === null || !actor.updateEmbeddedDocuments) return true;
  const updates = [];
  for (const classItem of add2eTransformationClassItems(actor)) {
    const progression = Array.isArray(classItem?.system?.progression)
      ? add2eTransformationClone(classItem.system.progression)
      : [];
    const level = add2eTransformationClassLevel(actor, classItem);
    const index = progression.findIndex(row => Number(row?.niveau ?? row?.level) === level);
    const rowIndex = index >= 0 ? index : (level - 1 < progression.length ? level - 1 : -1);
    if (rowIndex < 0 || !progression[rowIndex] || typeof progression[rowIndex] !== "object") continue;
    progression[rowIndex] = { ...progression[rowIndex], thac0 };
    updates.push({ _id: classItem.id, "system.progression": progression, "system.thac0": thac0 });
  }
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      add2eInternal: true,
      add2eReason: "capability-transformation-combat-profile"
    });
  }
  return true;
}

export async function add2eRestoreCapabilityTransformationCombatState(actor, snapshot = {}) {
  if (!actor?.update) return false;
  const actorUpdate = snapshot?.actorSystem && typeof snapshot.actorSystem === "object" ? snapshot.actorSystem : {};
  if (Object.keys(actorUpdate).length) {
    await actor.update(actorUpdate, { add2eInternal: true, add2eReason: "capability-transformation-combat-restore" });
  }

  const updates = (Array.isArray(snapshot?.classes) ? snapshot.classes : [])
    .filter(entry => entry?.id)
    .map(entry => ({
      _id: entry.id,
      "system.progression": add2eTransformationClone(entry.progression),
      "system.thac0": add2eTransformationClone(entry.thac0)
    }));
  if (updates.length && actor.updateEmbeddedDocuments) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      add2eInternal: true,
      add2eReason: "capability-transformation-combat-restore"
    });
  }
  return true;
}

export function add2eCaptureCapabilityTransformationWeaponAllowance(actor) {
  return add2eTransformationClassItems(actor).map(item => ({
    id: item.id,
    armesAutorisees: add2eTransformationClone(item?.system?.armes_autorisees),
    weaponsAllowed: add2eTransformationClone(item?.system?.weaponsAllowed)
  })).filter(entry => entry.id);
}

export async function add2eGrantCapabilityTransformationWeaponAllowance(actor, tags = []) {
  if (!actor?.updateEmbeddedDocuments) return false;
  const grants = add2eTransformationArray(tags).map(value => String(value ?? "").trim()).filter(Boolean);
  if (!grants.length) return true;

  const updates = [];
  for (const classItem of add2eTransformationClassItems(actor)) {
    const system = classItem.system ?? {};
    const legacy = add2eTransformationArrayValue(system.armes_autorisees);
    const english = add2eTransformationArrayValue(system.weaponsAllowed);
    if (legacy.length) {
      const merged = [...legacy];
      for (const tag of grants) if (!merged.some(value => String(value).toLowerCase() === tag.toLowerCase())) merged.push(tag);
      updates.push({ _id: classItem.id, "system.armes_autorisees": merged });
      continue;
    }
    if (english.length) {
      const merged = [...english];
      for (const tag of grants) if (!merged.some(value => String(value).toLowerCase() === tag.toLowerCase())) merged.push(tag);
      updates.push({ _id: classItem.id, "system.weaponsAllowed": merged });
    }
  }
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      add2eInternal: true,
      add2eReason: "capability-transformation-weapon-allowance"
    });
  }
  return true;
}

export async function add2eRestoreCapabilityTransformationWeaponAllowance(actor, snapshot = []) {
  if (!actor?.updateEmbeddedDocuments) return false;
  const updates = (Array.isArray(snapshot) ? snapshot : [])
    .filter(entry => entry?.id)
    .map(entry => ({
      _id: entry.id,
      "system.armes_autorisees": add2eTransformationClone(entry.armesAutorisees),
      "system.weaponsAllowed": add2eTransformationClone(entry.weaponsAllowed)
    }));
  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      add2eInternal: true,
      add2eReason: "capability-transformation-weapon-allowance-restore"
    });
  }
  return true;
}

export function add2eIsCapabilityTransformationNaturalAttack(item) {
  const transformation = add2eTransformationFlag(item);
  return !!(
    item &&
    transformation?.kind === "natural-attack" &&
    String(transformation?.sourceKey ?? "").trim()
  );
}

export function add2eIsCapabilityTransformationNaturalAttackActive(actor, item) {
  if (!add2eIsCapabilityTransformationNaturalAttack(item)) return false;

  const attack = add2eTransformationFlag(item) ?? {};
  const form = add2eGetActiveCapabilityTransformation(actor, { sourceKey: attack.sourceKey });
  if (!form) return false;

  const active = add2eTransformationFlag(form) ?? {};
  const attackFormKey = String(attack.formKey ?? "").trim();
  const activeFormKey = String(active.formKey ?? "").trim();
  return !attackFormKey || !activeFormKey || attackFormKey === activeFormKey;
}

export function add2eCanEquipCapabilityTransformationItem(actor, item) {
  return add2eIsCapabilityTransformationNaturalAttackActive(actor, item);
}

export function add2eGetCapabilityTransformationNaturalAttacks(actor, options = {}) {
  const sourceKey = options?.sourceKey === undefined || options?.sourceKey === null ? "" : String(options.sourceKey).trim();
  return add2eTransformationArray(actor?.items).filter(item => {
    if (!add2eIsCapabilityTransformationNaturalAttackActive(actor, item)) return false;
    const attack = add2eTransformationFlag(item) ?? {};
    return !sourceKey || attack.sourceKey === sourceKey;
  });
}

globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION = ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION;
globalThis.add2eGetCapabilityTransformationEffects = add2eGetCapabilityTransformationEffects;
globalThis.add2eGetActiveCapabilityTransformation = add2eGetActiveCapabilityTransformation;
globalThis.add2eGetCapabilityTransformationCombatProfile = add2eGetCapabilityTransformationCombatProfile;
globalThis.add2eCaptureCapabilityTransformationCombatState = add2eCaptureCapabilityTransformationCombatState;
globalThis.add2eApplyCapabilityTransformationCombatProfile = add2eApplyCapabilityTransformationCombatProfile;
globalThis.add2eRestoreCapabilityTransformationCombatState = add2eRestoreCapabilityTransformationCombatState;
globalThis.add2eCaptureCapabilityTransformationWeaponAllowance = add2eCaptureCapabilityTransformationWeaponAllowance;
globalThis.add2eGrantCapabilityTransformationWeaponAllowance = add2eGrantCapabilityTransformationWeaponAllowance;
globalThis.add2eRestoreCapabilityTransformationWeaponAllowance = add2eRestoreCapabilityTransformationWeaponAllowance;
globalThis.add2eIsCapabilityTransformationNaturalAttack = add2eIsCapabilityTransformationNaturalAttack;
globalThis.add2eIsCapabilityTransformationNaturalAttackActive = add2eIsCapabilityTransformationNaturalAttackActive;
globalThis.add2eCanEquipCapabilityTransformationItem = add2eCanEquipCapabilityTransformationItem;
globalThis.add2eGetCapabilityTransformationNaturalAttacks = add2eGetCapabilityTransformationNaturalAttacks;
