// ============================================================================
// ADD2E — États vitaux : constantes, lecture PV et règles métier.
// Version : 2026-06-01-vital-status-split-core-v1
// ============================================================================

export const ADD2E_VITAL_STATUS_CORE_VERSION = "2026-06-01-vital-status-split-core-v1";

export const ADD2E_VITAL_STATUS = {
  unconscious: { key: "unconscious", name: "Inconscient", icon: "icons/svg/daze.svg" },
  dead: { key: "dead", name: "Mort", icon: "icons/svg/skull.svg" }
};

export const ADD2E_VITAL_STATUS_EFFECT_IDS = {
  dead: "ADD2Edead0000000",
  unconscious: "ADD2Eunconsc0000"
};

export const ADD2E_VITAL_ICONS = new Set(Object.values(ADD2E_VITAL_STATUS).map(s => s.icon));

export function add2eVitalArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eVitalArray);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

export function add2eVitalNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function add2eVitalNumber(value, fallback = NaN) {
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return fallback;
    value = m[0].replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function add2eVitalActorType(actor) {
  return add2eVitalNorm(actor?.type);
}

export function add2eVitalIsMonster(actor) {
  const values = [
    actor?.type,
    actor?.system?.type,
    actor?.system?.actorType,
    actor?.system?.details?.type,
    actor?.system?.details?.creatureType,
    actor?.system?.categorie,
    actor?.system?.category
  ].map(add2eVitalNorm);

  return values.some(v => ["monster", "monstre", "monsters", "monstres", "creature", "creature_monstre", "npc_monster"].includes(v));
}

export function add2eVitalReadHP(actor) {
  const sys = actor?.system ?? {};
  const raw = sys.pdv ?? sys.pv?.value ?? sys.hp?.value ?? sys.hp;
  const fallback = sys.points_de_coup ?? sys.pv?.max ?? sys.hp?.max ?? 0;
  return add2eVitalNumber(raw, add2eVitalNumber(fallback, 0));
}

export function add2eVitalDesiredStatus(actor) {
  const hp = add2eVitalReadHP(actor);

  // Monstres : même flux technique, règle différente.
  // PV > 0 = vivant ; PV <= 0 = mort ; jamais Inconscient.
  if (add2eVitalIsMonster(actor)) return hp <= 0 ? "dead" : null;

  // Personnages : règle AD&D 2e demandée.
  if (add2eVitalActorType(actor) === "personnage") {
    if (hp <= -11) return "dead";
    if (hp <= 0) return "unconscious";
  }

  return null;
}

export function add2eVitalStatusAliases(effect) {
  return [effect?.id, effect?._id, effect?.name, effect?.label, effect?.flags?.core?.statusId, effect?.flags?.add2e?.vitalStatus]
    .map(add2eVitalNorm)
    .filter(Boolean);
}

export function add2eVitalEffectStatuses(effect) {
  return new Set(add2eVitalArray(effect?.statuses ?? effect?.system?.statuses ?? effect?.flags?.core?.statusId ?? []).map(add2eVitalNorm).filter(Boolean));
}

export function add2eVitalEffectFlag(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const values = [
    flags.vitalStatus,
    flags.status,
    flags.etat,
    flags.autoVitalStatus === true ? "autoVitalStatus" : "",
    typeof effect?.getFlag === "function" ? effect.getFlag("add2e", "vitalStatus") : null,
    typeof effect?.getFlag === "function" && effect.getFlag("add2e", "autoVitalStatus") === true ? "autoVitalStatus" : ""
  ];
  return values.map(add2eVitalNorm).find(v => ["dead", "unconscious", "mort", "inconscient", "autovitalstatus"].includes(v)) ?? "";
}

export function add2eVitalEffectKind(effect) {
  const name = add2eVitalNorm(effect?.name ?? effect?.label ?? "");
  const statuses = add2eVitalEffectStatuses(effect);
  const flag = add2eVitalEffectFlag(effect);
  if (flag === "dead" || flag === "mort") return "dead";
  if (flag === "unconscious" || flag === "inconscient") return "unconscious";
  if (flag === "autovitalstatus") return "vital";
  if (name === "mort" || name === "dead" || name === "etat_mort") return "dead";
  if (name === "inconscient" || name === "unconscious" || name === "etat_inconscient") return "unconscious";
  if (statuses.has("dead") || statuses.has("mort")) return "dead";
  if (statuses.has("unconscious") || statuses.has("inconscient")) return "unconscious";
  return null;
}
