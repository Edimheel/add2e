// ADD2E — Actor sheet getData : orchestrateur ApplicationV2.

import { add2ePrepareActorSheetBaseData } from "./13b-actor-sheet-get-data-base.mjs";
import { add2ePrepareActorSheetCombatData } from "./13b-actor-sheet-get-data-combat.mjs";
import { add2ePopulateActorSheetSpellData } from "./13b-actor-sheet-get-data-spells.mjs";

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant getData.");

const ADD2E_ACTIVE_EFFECTS_DATA_VERSION = "2026-07-11-hide-technical-class-rules-v3";
const ADD2E_HIDDEN_TECHNICAL_CLASS_RULE_KINDS = new Set(["armor_class_base", "attack_modifier"]);

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
