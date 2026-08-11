// ADD2E — Actor sheet getData : orchestrateur ApplicationV2 natif.

import { add2ePrepareActorSheetBaseData } from "./13b-actor-sheet-get-data-base.mjs";
import { add2ePrepareActorSheetCombatData } from "./13b-actor-sheet-get-data-combat.mjs";
import { add2ePopulateActorSheetSpellData } from "./13b-actor-sheet-get-data-spells.mjs";

const ADD2E_ACTIVE_EFFECTS_DATA_VERSION = "2026-08-11-canonical-sheet-alignments-v8";
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

function add2eSheetAllowedAlignments(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.getActorAllowedAlignments !== "function") {
    throw new Error("Le résolveur canonique ADD2E des alignements de classe est indisponible.");
  }
  const allowed = engine.getActorAllowedAlignments(actor);
  if (!Array.isArray(allowed) || !allowed.length) {
    throw new Error(`Aucun alignement canonique disponible pour ${actor?.name ?? "acteur"}.`);
  }
  return allowed;
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

function add2eEffectModifiers(effect) {
  let raw = effect?.flags?.add2e?.modifiers;
  if ((raw === undefined || raw === null) && typeof effect?.getFlag === "function") {
    try { raw = effect.getFlag("add2e", "modifiers"); }
    catch (_error) { raw = null; }
  }
  if (Array.isArray(raw)) return raw.filter(modifier => modifier && typeof modifier === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(modifier => modifier && typeof modifier === "object");
  return [];
}

function add2eEffectHasCanonicalModifier(effect) {
  return add2eEffectModifiers(effect).some(modifier => String(modifier?.domain ?? "").trim());
}

function add2eEffectFamiliarData(effect) {
  return effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
}

function add2eEffectFamiliarKind(effect) {
  return add2eNormEffectValue(add2eEffectFamiliarData(effect)?.kind);
}

function add2eEffectIsAppliedFamiliar(effect) {
  return ["benefit", "penalty"].includes(add2eEffectFamiliarKind(effect));
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
  if (add2eEffectHasCanonicalModifier(effect)) return true;
  if (add2eEffectIsAppliedFamiliar(effect)) return true;
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
  const familiarLabel = String(add2e.familiar?.familiarLabel ?? "").trim();
  if (familiarLabel) return `Familier — ${familiarLabel}`;
  return String(
    add2e.sourceClasse
    ?? add2e.sourceClass
    ?? add2e.className
    ?? effect?.parent?.name
    ?? effect?.origin
    ?? ""
  );
}

function add2eEffectTags(effect) {
  const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,;|\n]+/g)
      : raw && typeof raw === "object"
        ? Object.values(raw)
        : [];
  return values.map(value => String(value ?? "").trim().toLowerCase()).filter(Boolean);
}

function add2eFamiliarCapabilityIcon(effect) {
  const text = `${effect?.name ?? ""} ${add2eEffectTags(effect).join(" ")}`;
  const normalized = add2eNormEffectValue(text);
  if (/vision|infravision|sens|vue/.test(normalized)) return "fa-eye";
  if (/ouie|audition|ecoute/.test(normalized)) return "fa-ear-listen";
  if (/resistance|protection|save|sauvegarde/.test(normalized)) return "fa-shield-halved";
  if (/regeneration|soin/.test(normalized)) return "fa-heart-pulse";
  if (/dexterite|agilite/.test(normalized)) return "fa-person-running";
  if (/surprise/.test(normalized)) return "fa-user-shield";
  if (/niveau/.test(normalized)) return "fa-arrow-up-right-dots";
  return "fa-paw";
}

function add2eIsFamiliarCapabilityEffect(effect) {
  if (!effect || effect.disabled === true || effect.isSuppressed === true) return false;
  if (add2eEffectFamiliarKind(effect) !== "benefit") return false;
  const tags = add2eEffectTags(effect);
  return !tags.includes("familier:partage_pv");
}

function add2eFamiliarCapability(effect) {
  const familiar = add2eEffectFamiliarData(effect) ?? {};
  const label = String(effect?.name ?? effect?.label ?? "Capacité de familier")
    .replace(/^\s*Familier\s*[—–-]\s*/i, "")
    .trim() || "Capacité de familier";
  return {
    id: `familiar-effect:${effect.id}`,
    key: `familiar-effect:${effect.id}`,
    label,
    description: String(add2eEffectDescription(effect) ?? ""),
    img: effect.img || "icons/svg/aura.svg",
    iconClass: add2eFamiliarCapabilityIcon(effect),
    sourceName: `Familier — ${String(familiar.familiarLabel ?? "Familier").trim()}`,
    canRoll: false,
    rollLabel: "",
    familiar: true
  };
}

export function add2ePopulateActorSheetActiveEffectsData(actor, data) {
  const visibleEffects = Array.from(actor?.effects ?? []).filter(add2eShouldShowEffect);
  data.activeEffectsList = visibleEffects.map(effect => ({
    id: effect.id,
    name: effect.name || "",
    img: effect.img || "icons/svg/aura.svg",
    description: add2eEffectDescription(effect),
    duration: add2eEffectDuration(effect),
    sourceName: add2eEffectSourceName(effect)
  }));

  const existingCapabilities = Array.isArray(data.activeRacialCapabilities) ? data.activeRacialCapabilities : [];
  const familiarCapabilities = visibleEffects
    .filter(add2eIsFamiliarCapabilityEffect)
    .map(add2eFamiliarCapability);
  const seen = new Set();
  data.activeRacialCapabilities = [...existingCapabilities, ...familiarCapabilities].filter(capability => {
    const key = String(capability?.id ?? capability?.key ?? capability?.label ?? "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return data.activeEffectsList;
}

export async function add2ePrepareActorSheetData(sheet) {
  if (!sheet || typeof sheet._add2eNativeGetData !== "function") {
    throw new Error("La feuille ApplicationV2 ADD2E ne fournit pas son contexte natif.");
  }
  const data = sheet._add2eNativeGetData();
  const state = add2ePrepareActorSheetBaseData({ sheet, data });
  const actor = sheet.document ?? state.actor;
  if (!actor) throw new Error("Acteur introuvable pendant la préparation de la feuille ADD2E.");

  const forceEx = add2eExceptionalStrengthValue(actor.system?.force_ex);
  data.forceExCurrent = forceEx;
  data.forceExNoneSelected = forceEx === 0;
  data.forceExValues = data.canExceptionalStrength ? add2eExceptionalStrengthValues(forceEx) : [];

  add2ePrepareActorSheetCombatData({
    actor: state.actor,
    data,
    sys: state.sys
  });

  add2ePopulateActorSheetSpellData({ actor: state.actor, data, items: state.items });
  add2ePopulateActorSheetActiveEffectsData(actor, data);

  data.alignementsDisponibles = add2eSheetAllowedAlignments(state.actor);
  data.activeTab = sheet._add2eGetNativeActiveTab?.() || sheet._add2eActiveTab || sheet._add2eReadStoredTab?.() || "resume";
  sheet._add2ePreparedData = data;
  return data;
}

globalThis.add2ePrepareActorSheetData = add2ePrepareActorSheetData;
globalThis.ADD2E_ACTIVE_EFFECTS_DATA_VERSION = ADD2E_ACTIVE_EFFECTS_DATA_VERSION;