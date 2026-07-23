// ADD2E — Actor sheet getData : orchestrateur ApplicationV2.

import { add2ePrepareActorSheetBaseData } from "./13b-actor-sheet-get-data-base.mjs";
import { add2ePrepareActorSheetCombatData } from "./13b-actor-sheet-get-data-combat.mjs";
import { add2ePopulateActorSheetSpellData } from "./13b-actor-sheet-get-data-spells.mjs";

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant getData.");

const ADD2E_ACTIVE_EFFECTS_DATA_VERSION = "2026-07-11-hide-technical-class-rules-v3";
const ADD2E_FORCE_DIAGNOSTICS_VERSION = "2026-07-23-force-diagnostics-v1";
const ADD2E_HIDDEN_TECHNICAL_CLASS_RULE_KINDS = new Set(["armor_class_base", "attack_modifier"]);
let ADD2E_FORCE_DIAGNOSTIC_SEQUENCE = 0;

if (globalThis.ADD2E_FORCE_DIAGNOSTICS === undefined) globalThis.ADD2E_FORCE_DIAGNOSTICS = true;

function add2eExceptionalStrengthValue(rawValue) {
  const value = Math.trunc(Number(rawValue));
  return Number.isFinite(value) && value >= 1 && value <= 100 ? value : 0;
}

function add2eExceptionalStrengthValues(currentValue = 0) {
  const selectedValue = add2eExceptionalStrengthValue(currentValue);
  return Array.from({ length: 100 }, (_unused, index) => {
    const value = index + 1;
    return {
      value,
      label: value === 100 ? "00" : String(value).padStart(2, "0"),
      selected: value === selectedValue
    };
  });
}

function add2eForceDiagnosticsEnabled() {
  return globalThis.ADD2E_FORCE_DIAGNOSTICS !== false;
}

function add2eForceDiagnosticFlatten(value) {
  try {
    if (typeof foundry?.utils?.flattenObject === "function") return foundry.utils.flattenObject(value ?? {});
  } catch (_error) {}
  return value ?? {};
}

function add2eForceDiagnosticModifier(entry) {
  const modifier = entry?.modifier ?? entry ?? {};
  return {
    reason: entry?.reason ?? entry?.rejectionReason ?? null,
    id: modifier?.id ?? null,
    domain: modifier?.domain ?? null,
    target: modifier?.target ?? null,
    operation: modifier?.operation ?? null,
    value: modifier?.value ?? null,
    priority: modifier?.priority ?? null,
    stacking: modifier?.stacking ?? null,
    conditions: modifier?.conditions ?? null,
    source: modifier?.source ?? null,
    duration: modifier?.duration ?? null,
    metadata: modifier?.metadata ?? null
  };
}

function add2eForceDiagnosticResolution(actor, consumer) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.resolveAbility !== "function") {
    return { error: "resolveAbility indisponible" };
  }

  try {
    const resolution = engine.resolveAbility(actor, "force", { consumer });
    return {
      base: resolution?.base ?? null,
      total: resolution?.total ?? null,
      additions: resolution?.additions ?? null,
      multiplier: resolution?.multiplier ?? null,
      override: resolution?.override ? add2eForceDiagnosticModifier(resolution.override) : null,
      bounds: resolution?.bounds ?? null,
      stages: resolution?.stages ?? null,
      applied: Array.isArray(resolution?.applied) ? resolution.applied.map(add2eForceDiagnosticModifier) : resolution?.applied ?? [],
      rejected: Array.isArray(resolution?.rejected) ? resolution.rejected.map(add2eForceDiagnosticModifier) : resolution?.rejected ?? []
    };
  } catch (error) {
    return { error: String(error?.stack ?? error?.message ?? error) };
  }
}

function add2eForceDiagnosticEffect(effect) {
  return {
    id: effect?.id ?? null,
    name: effect?.name ?? effect?.label ?? "",
    disabled: effect?.disabled === true,
    origin: effect?.origin ?? null,
    changes: Array.isArray(effect?.changes) ? effect.changes : [],
    modifiers: effect?.flags?.add2e?.modifiers ?? null,
    rules: effect?.flags?.add2e?.rules ?? null,
    sourceType: effect?.flags?.add2e?.sourceType ?? null,
    sourceItemId: effect?.flags?.add2e?.sourceItemId ?? null
  };
}

function add2eForceDiagnosticItem(item) {
  return {
    id: item?.id ?? null,
    uuid: item?.uuid ?? null,
    name: item?.name ?? "",
    type: item?.type ?? "",
    slug: item?.system?.slug ?? null,
    equipped: item?.system?.equipped ?? item?.system?.equipee ?? item?.system?.portee ?? null,
    bonusCaracteristiques: item?.system?.bonus_caracteristiques ?? null,
    modifiers: item?.flags?.add2e?.modifiers ?? item?.system?.modifiers ?? null,
    rules: item?.flags?.add2e?.rules ?? item?.system?.rules ?? null,
    effects: Array.from(item?.effects ?? []).map(add2eForceDiagnosticEffect)
  };
}

function add2eForceDiagnosticRelevantEmbedded(document, changes = null) {
  const type = String(document?.type ?? "").toLowerCase();
  if (["classe", "race"].includes(type)) return true;
  const payload = {
    name: document?.name,
    type,
    system: document?.system,
    flags: document?.flags?.add2e,
    changes
  };
  try {
    return /force|ability|caracter|modifier|bonus_caracteristiques|racialability/i.test(JSON.stringify(payload));
  } catch (_error) {
    return false;
  }
}

function add2eForceDiagnosticActorUpdateTouches(changes) {
  const flat = add2eForceDiagnosticFlatten(changes);
  const prefixes = [
    "system.force",
    "system.force_base",
    "system.force_ex",
    "system.for_aff",
    "system.force_race",
    "system.force_bonus_",
    "system.bonus_caracteristiques",
    "flags.add2e.base_caracs",
    "flags.add2e.racialAbilityAdjustments",
    "flags.add2e.racialAbilitySource",
    "flags.add2e.modifiers"
  ];
  return Object.keys(flat ?? {}).some(path => prefixes.some(prefix => path === prefix || path.startsWith(prefix)));
}

function add2eForceDiagnosticSnapshot(actor, stage, extra = {}, { trace = false } = {}) {
  if (!add2eForceDiagnosticsEnabled() || !actor || actor.type !== "personnage") return null;

  const system = actor.system ?? {};
  const add2eFlags = actor.flags?.add2e ?? {};
  const classes = Array.from(actor.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe")
    .map(add2eForceDiagnosticItem);
  const races = Array.from(actor.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "race")
    .map(add2eForceDiagnosticItem);
  const activeEffects = Array.from(actor.effects ?? []).map(add2eForceDiagnosticEffect);
  const forceRelatedItems = Array.from(actor.items ?? [])
    .filter(item => !["classe", "race"].includes(String(item?.type ?? "").toLowerCase()))
    .filter(item => add2eForceDiagnosticRelevantEmbedded(item))
    .map(add2eForceDiagnosticItem);
  const sequence = ++ADD2E_FORCE_DIAGNOSTIC_SEQUENCE;
  const snapshot = {
    version: ADD2E_FORCE_DIAGNOSTICS_VERSION,
    sequence,
    stage,
    actor: { id: actor.id, uuid: actor.uuid, name: actor.name },
    system: {
      force: system.force,
      forceBase: system.force_base,
      forceEffectiveDisplay: system.for_aff,
      forceExceptional: system.force_ex,
      forceRaceLegacy: system.force_race,
      bonusCaracteristiquesLegacy: system.bonus_caracteristiques,
      toucher: system.force_bonus_toucher,
      degats: system.force_bonus_degats,
      poids: system.force_poids,
      ouvrir: system.force_ouvrir,
      tordre: system.force_tordre
    },
    flags: {
      naturalForce: add2eFlags.base_caracs?.force,
      racialForce: add2eFlags.racialAbilityAdjustments?.force,
      racialSource: add2eFlags.racialAbilitySource ?? null,
      actorModifiers: add2eFlags.modifiers ?? []
    },
    classes,
    races,
    forceRelatedItems,
    activeEffects,
    resolution: add2eForceDiagnosticResolution(actor, `force-diagnostic:${stage}`),
    extra
  };

  console.groupCollapsed(`[ADD2E][FORCE_DIAG][${sequence}][${stage}] ${actor.name}`);
  console.log(snapshot);
  if (trace) console.trace(`[ADD2E][FORCE_DIAG][${sequence}][TRACE] ${stage}`);
  console.groupEnd();
  return snapshot;
}

function add2eForceDiagnosticActorFromEmbedded(document) {
  const parent = document?.parent;
  return parent?.documentName === "Actor" ? parent : null;
}

function add2eInstallForceDiagnostics() {
  if (globalThis.__ADD2E_FORCE_DIAGNOSTICS_VERSION__ === ADD2E_FORCE_DIAGNOSTICS_VERSION) return;
  globalThis.__ADD2E_FORCE_DIAGNOSTICS_VERSION__ = ADD2E_FORCE_DIAGNOSTICS_VERSION;

  Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    if (!add2eForceDiagnosticActorUpdateTouches(changes)) return;
    add2eForceDiagnosticSnapshot(actor, "PRE_UPDATE_ACTOR", {
      changes: add2eForceDiagnosticFlatten(changes),
      options,
      userId
    }, { trace: true });
  });

  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (!add2eForceDiagnosticActorUpdateTouches(changes)) return;
    setTimeout(() => add2eForceDiagnosticSnapshot(actor, "POST_UPDATE_ACTOR", {
      changes: add2eForceDiagnosticFlatten(changes),
      options,
      userId
    }), 0);
  });

  const embeddedHooks = [
    ["createItem", "CREATE_ITEM"],
    ["updateItem", "UPDATE_ITEM"],
    ["deleteItem", "DELETE_ITEM"],
    ["createActiveEffect", "CREATE_ACTIVE_EFFECT"],
    ["updateActiveEffect", "UPDATE_ACTIVE_EFFECT"],
    ["deleteActiveEffect", "DELETE_ACTIVE_EFFECT"]
  ];

  for (const [hookName, stage] of embeddedHooks) {
    Hooks.on(hookName, (document, changesOrOptions, optionsOrUserId, maybeUserId) => {
      const changes = hookName.startsWith("update") ? changesOrOptions : null;
      if (!add2eForceDiagnosticRelevantEmbedded(document, changes)) return;
      const actor = add2eForceDiagnosticActorFromEmbedded(document);
      if (!actor) return;
      const options = hookName.startsWith("update") ? optionsOrUserId : changesOrOptions;
      const userId = hookName.startsWith("update") ? maybeUserId : optionsOrUserId;
      setTimeout(() => add2eForceDiagnosticSnapshot(actor, stage, {
        document: add2eForceDiagnosticItem(document),
        changes: changes ? add2eForceDiagnosticFlatten(changes) : null,
        options,
        userId
      }), 0);
    });
  }

  globalThis.add2eForceDiagnosticSnapshot = (actor, stage = "MANUAL") => add2eForceDiagnosticSnapshot(actor, stage, {}, { trace: true });
}

add2eInstallForceDiagnostics();

function add2eSheetAllowedAlignments(actor, sys) {
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActorAllowedAlignments === "function") {
    const fromEngine = Add2eEffectsEngine.getActorAllowedAlignments(actor);
    if (Array.isArray(fromEngine) && fromEngine.length) return fromEngine;
  }
  const fromActor = sys.alignements_autorises;
  if (Array.isArray(fromActor) && fromActor.length) return fromActor;
  const fromClass = sys.details_classe?.alignements_autorises;
  if (Array.isArray(fromClass) && fromClass.length) return fromClass;
  return [];
}

function add2eNormEffectValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eEffectHasFiniteDuration(effect) {
  const duration = effect?.duration ?? {};
  for (const key of ["remaining", "rounds", "seconds", "turns"]) {
    const value = Number(duration?.[key]);
    if (Number.isFinite(value) && value > 0) return true;
  }
  return false;
}

function add2eEffectHasFoundryStatus(effect) {
  const statuses = effect?.statuses;
  if (statuses instanceof Set) return statuses.size > 0;
  if (Array.isArray(statuses)) return statuses.length > 0;
  return false;
}

function add2eEffectHasMeaningfulChanges(effect) {
  return Array.isArray(effect?.changes) && effect.changes.some(change => String(change?.key ?? "").trim());
}

function add2eEffectIsSynchronizedClassPassive(effect) {
  const add2e = effect?.flags?.add2e ?? {};
  return add2e.autoClassPassiveEffect === true || add2e.classPassiveFeatureEffect === true;
}

function add2eEffectRules(effect) {
  let raw = effect?.flags?.add2e?.rules;
  if ((raw === undefined || raw === null) && typeof effect?.getFlag === "function") {
    try { raw = effect.getFlag("add2e", "rules"); }
    catch (_error) { raw = null; }
  }
  if (Array.isArray(raw)) return raw.filter(rule => rule && typeof rule === "object");
  if (raw && typeof raw === "object") return [raw];
  return [];
}

function add2eEffectIsTechnicalClassPassive(effect) {
  if (!add2eEffectIsSynchronizedClassPassive(effect)) return false;
  const rules = add2eEffectRules(effect);
  if (!rules.length) return false;
  return rules.every(rule => ADD2E_HIDDEN_TECHNICAL_CLASS_RULE_KINDS.has(
    add2eNormEffectValue(rule?.kind ?? rule?.type ?? rule?.ruleType ?? "")
  ));
}

function add2eEffectMarkerText(effect) {
  const add2e = effect?.flags?.add2e ?? {};
  return [
    effect?.name,
    effect?.label,
    add2e.type,
    add2e.kind,
    add2e.source,
    add2e.sourceType,
    add2e.originType,
    add2e.category,
    add2e.effectType,
    add2e.generatedBy,
    add2e.sourceClasse,
    add2e.sourceRace,
    add2e.className,
    add2e.raceName,
    add2e.reason
  ].map(add2eNormEffectValue).filter(Boolean).join(" ");
}

function add2eEffectKind(effect) {
  const text = add2eEffectMarkerText(effect);
  if (/(^|_)effets?_de_classe($|_)|(^|_)effets?_classe($|_)|class_effects?|class_feature_effects?|classe|class/.test(text)) return "class";
  if (/(^|_)effets?_de_race($|_)|(^|_)effets?_raciaux($|_)|racial_effects?|race_effects?|racial|race/.test(text)) return "race";
  if (/sort|spell/.test(text)) return "spell";
  if (/capacite|capacity|ability|feature/.test(text)) return "capacity";
  return "effect";
}

function add2eLooksLikeTechnicalTagList(value) {
  const text = String(value ?? "").replace(/<[^>]*>/g, " ").trim();
  if (!text) return false;
  const chunks = text.split(/[,;\n]+/g).map(part => part.trim()).filter(Boolean);
  if (chunks.length < 5) return false;
  const technical = chunks.filter(part => /[a-z0-9_]+[:][a-z0-9_:+\-]+/i.test(part) || /[_]/.test(part));
  return technical.length >= Math.max(5, Math.floor(chunks.length * 0.6));
}

function add2eIsTechnicalEffectContainer(effect) {
  const name = add2eNormEffectValue(`${effect?.name ?? ""} ${effect?.label ?? ""}`);
  if (/(^|_)effets?_de_classe($|_)|(^|_)effets?_classe($|_)|class_effects?|class_feature_effects?/.test(name)) return true;
  if (/(^|_)effets?_de_race($|_)|(^|_)effets?_raciaux($|_)|racial_effects?|race_effects?/.test(name)) return true;
  const raw = effect?.getFlag?.("core", "description") || effect?.flags?.add2e?.desc || effect?.description || "";
  const markers = add2eEffectMarkerText(effect);
  const looksClassOrRace = /(classe|class|race|racial)/.test(markers);
  return looksClassOrRace && !add2eEffectHasFiniteDuration(effect) && !add2eEffectHasFoundryStatus(effect) && add2eLooksLikeTechnicalTagList(raw);
}

function add2eFallbackEffectDescription(effect) {
  const kind = add2eEffectKind(effect);
  if (kind === "class") return "Effet de classe appliqué.";
  if (kind === "race") return "Effet racial appliqué.";
  if (kind === "spell") return add2eEffectHasFiniteDuration(effect) ? "Effet de sort actif." : "Effet de sort appliqué.";
  if (kind === "capacity") return add2eEffectHasFiniteDuration(effect) ? "Effet de capacité actif." : "Effet de capacité appliqué.";
  return add2eEffectHasFiniteDuration(effect) ? "Effet actif." : "Effet appliqué.";
}

function add2eEffectDescription(effect) {
  const raw = effect?.getFlag?.("core", "description") || effect?.flags?.add2e?.desc || effect?.description || "";
  if (!String(raw).trim()) return add2eFallbackEffectDescription(effect);
  if (add2eLooksLikeTechnicalTagList(raw)) return add2eFallbackEffectDescription(effect);
  return raw;
}

function add2eEffectDuration(effect) {
  const duration = effect?.duration ?? {};
  const remaining = Number(duration.remaining);
  if (Number.isFinite(remaining) && remaining > 0) return `${remaining} rounds`;
  const rounds = Number(duration.rounds);
  if (Number.isFinite(rounds) && rounds > 0) return `${rounds} rounds`;
  const turns = Number(duration.turns);
  if (Number.isFinite(turns) && turns > 0) return `${turns} tours`;
  const seconds = Number(duration.seconds);
  if (Number.isFinite(seconds) && seconds > 0) return `${seconds} sec`;
  return "Permanent";
}

function add2eEffectHasExplicitAppliedMarker(effect) {
  const add2e = effect?.flags?.add2e ?? {};
  if (add2e.applied === true || add2e.active === true || add2e.visibleEffect === true) return true;
  const text = add2eEffectMarkerText(effect);
  return /temporaire|temporary|applique|applied|actif|active|condition|etat|blessure|fuite|fear|stun|paraly|poison|sort|spell|capacity|capacite|capability_special_attack_window|timeengine|roundengine/.test(text);
}

function add2eShouldShowEffect(effect) {
  if (!effect || effect.disabled === true) return false;
  if (add2eEffectIsSynchronizedClassPassive(effect)) return !add2eEffectIsTechnicalClassPassive(effect);
  if (add2eIsTechnicalEffectContainer(effect)) return false;
  if (add2eEffectHasFiniteDuration(effect)) return true;
  if (add2eEffectHasFoundryStatus(effect)) return true;
  if (add2eEffectHasExplicitAppliedMarker(effect)) return true;
  if (add2eEffectHasMeaningfulChanges(effect)) return true;
  return false;
}

function add2eEffectSourceName(effect) {
  const add2e = effect?.flags?.add2e ?? {};
  return String(
    add2e.sourceClasse
    ?? add2e.sourceClass
    ?? add2e.className
    ?? effect?.parent?.name
    ?? effect?.origin
    ?? ""
  );
}

export function add2ePopulateActorSheetActiveEffectsData(actor, data) {
  data.activeEffectsList = Array.from(actor?.effects ?? [])
    .filter(add2eShouldShowEffect)
    .map(eff => ({
      id: eff.id,
      name: eff.name || "",
      img: eff.img || "icons/svg/aura.svg",
      description: add2eEffectDescription(eff),
      duration: add2eEffectDuration(eff),
      sourceName: add2eEffectSourceName(eff)
    }));
  return data.activeEffectsList;
}

globalThis.Add2eActorSheet.prototype.getData = async function getData() {
  const data = this._add2eNativeGetData();
  const state = add2ePrepareActorSheetBaseData({ sheet: this, data });

  const forceEx = add2eExceptionalStrengthValue(this.actor?.system?.force_ex);
  data.forceExCurrent = forceEx;
  data.forceExNoneSelected = forceEx === 0;
  data.forceExValues = data.canExceptionalStrength ? add2eExceptionalStrengthValues(forceEx) : [];

  add2eForceDiagnosticSnapshot(this.actor, "GET_DATA_AFTER_BASE", {
    preparedForce: state.sys?.force,
    preparedForceDisplay: state.sys?.for_aff,
    canExceptionalStrength: data.canExceptionalStrength === true,
    forceExCurrent: forceEx,
    forceExValuesCount: data.forceExValues.length
  });

  add2ePrepareActorSheetCombatData({
    actor: state.actor,
    data,
    sys: state.sys,
    progressionCourante: state.progressionCourante,
    isMonk: state.isMonk
  });

  add2ePopulateActorSheetSpellData({ actor: state.actor, data, items: state.items });
  add2ePopulateActorSheetActiveEffectsData(this.actor, data);

  data.alignementsDisponibles = add2eSheetAllowedAlignments(state.actor, state.sys);
  data.activeTab = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";
  this._add2ePreparedData = data;
  return data;
};

globalThis.ADD2E_ACTIVE_EFFECTS_DATA_VERSION = ADD2E_ACTIVE_EFFECTS_DATA_VERSION;
globalThis.ADD2E_FORCE_DIAGNOSTICS_VERSION = ADD2E_FORCE_DIAGNOSTICS_VERSION;
