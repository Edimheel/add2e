// ============================================================================
// ADD2E — Noyau générique des transformations de capacités.
// Compatible Foundry V13/V14/V15.
// ============================================================================

export const ADD2E_CAPABILITY_TRANSFORMATIONS_VERSION = "2026-07-07-capability-transformations-v1";

const FLAG_SCOPE = "add2e";
const FLAG_KEY = "capabilityTransformation";

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
globalThis.add2eIsCapabilityTransformationNaturalAttack = add2eIsCapabilityTransformationNaturalAttack;
globalThis.add2eIsCapabilityTransformationNaturalAttackActive = add2eIsCapabilityTransformationNaturalAttackActive;
globalThis.add2eCanEquipCapabilityTransformationItem = add2eCanEquipCapabilityTransformationItem;
globalThis.add2eGetCapabilityTransformationNaturalAttacks = add2eGetCapabilityTransformationNaturalAttacks;
