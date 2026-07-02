// ADD2E — Effects Engine.
// Façade publique : l'API globale historique reste inchangée.

import { installEffectsEngineCore } from "./effects-engine/00-core.mjs";
import { installEffectsEngineTagsAndFeatures } from "./effects-engine/10-tags-features.mjs";
import { installEffectsEngineDefense } from "./effects-engine/20-defense.mjs";
import { installEffectsEngineDamage } from "./effects-engine/30-resistance-damage.mjs";
import { installEffectsEngineMonk } from "./effects-engine/40-monk.mjs";
import { installEffectsEngineAnalysis } from "./effects-engine/50-analysis.mjs";

globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-07-02-racial-profile-engine-v1";

class Add2eEffectsEngine {}

installEffectsEngineCore(Add2eEffectsEngine);
installEffectsEngineTagsAndFeatures(Add2eEffectsEngine);
installEffectsEngineDefense(Add2eEffectsEngine);
installEffectsEngineDamage(Add2eEffectsEngine);
installEffectsEngineMonk(Add2eEffectsEngine);
installEffectsEngineAnalysis(Add2eEffectsEngine);

function add2eRacialArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eRacialArray).filter(Boolean);
  if (value instanceof Set) return [...value].flatMap(add2eRacialArray).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "tags", "effectTags", "entries"]) {
      if (value[key] !== undefined) return add2eRacialArray(value[key]);
    }
    return [];
  }
  return [value];
}

function add2eRacialClone(value) {
  try { return foundry.utils.deepClone(value); } catch (_err) {}
  try { return foundry.utils.duplicate(value); } catch (_err) {}
  try { return JSON.parse(JSON.stringify(value)); } catch (_err) {}
  return value;
}

function add2eRacialEscape(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); } catch (_err) {}
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eRacialProfileFromSystem(system, source = {}) {
  const profile = system?.racialProfile ?? system?.racial_profile ?? system?.raceProfile ?? null;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  return {
    ...add2eRacialClone(profile),
    sourceId: source.id ?? source.uuid ?? source.sourceId ?? "",
    sourceName: source.name ?? system?.label ?? "",
    sourceSystem: system
  };
}

function add2eRacialCapResult(capability, context = {}) {
  const requirements = add2eRacialArray(capability?.requires).map(String);
  const missing = requirements.filter(key => context?.[key] !== true);
  return { requirements, missing };
}

const ADD2E_RACIAL_PROFILE_CACHE = new Map();

function add2eRacialProfileCacheKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_");
}

function add2eStoreRacialProfile(profile, source = {}) {
  if (!profile || typeof profile !== "object") return;
  const keys = [source?.name, source?.system?.slug, source?.system?.label, source?.system?.name, profile?.slug, profile?.id]
    .map(add2eRacialProfileCacheKey)
    .filter(Boolean);
  for (const key of keys) ADD2E_RACIAL_PROFILE_CACHE.set(key, add2eRacialClone(profile));
}

async function add2eRefreshRacialProfileCache() {
  const pack = game?.packs?.get?.("add2e.races");
  if (!pack?.getDocuments) return false;
  try {
    const docs = await pack.getDocuments();
    for (const doc of docs ?? []) {
      if (String(doc?.type ?? "").toLowerCase() !== "race") continue;
      const profile = doc.system?.racialProfile ?? doc.system?.racial_profile ?? doc.system?.raceProfile;
      if (profile && typeof profile === "object") add2eStoreRacialProfile(profile, { name: doc.name, system: doc.system });
    }
    return ADD2E_RACIAL_PROFILE_CACHE.size > 0;
  } catch (error) {
    console.warn("[ADD2E][RACIAL][PROFILE_CACHE_ERROR]", error);
    return false;
  }
}

function add2eLookupCachedRacialProfile(source, actor) {
  const keys = [
    source?.name,
    source?.system?.slug,
    source?.system?.label,
    actor?.system?.race,
    actor?.system?.details_race?.slug,
    actor?.system?.details_race?.name,
    actor?.system?.details_race?.label
  ].map(add2eRacialProfileCacheKey).filter(Boolean);
  for (const key of keys) {
    const profile = ADD2E_RACIAL_PROFILE_CACHE.get(key);
    if (profile) return add2eRacialClone(profile);
  }
  return null;
}

function add2eScheduleRacialRuntimeSync(actor) {
  if (!actor) return;
  setTimeout(() => {
    const engine = globalThis.Add2eEffectsEngine;
    if ((!actor?.isOwner && !game.user?.isGM) || !engine) return;
    Promise.resolve(engine.applyRacialAbilityBounds?.(actor)).catch(error => console.warn("[ADD2E][RACIAL][ABILITY_SYNC_ERROR]", error));
    Promise.resolve(engine.syncRacialVision?.(actor)).catch(error => console.warn("[ADD2E][RACIAL][VISION_SYNC_ERROR]", error));
  }, 0);
}

function installRacialVisionHooks() {
  if (globalThis.ADD2E_RACIAL_VISION_HOOKS_INSTALLED || typeof Hooks === "undefined") return;
  globalThis.ADD2E_RACIAL_VISION_HOOKS_INSTALLED = true;
  Hooks.on("createItem", item => {
    if (String(item?.type ?? "").toLowerCase() === "race") add2eScheduleRacialRuntimeSync(item.parent);
  });
  Hooks.on("deleteItem", item => {
    if (String(item?.type ?? "").toLowerCase() === "race") add2eScheduleRacialRuntimeSync(item.parent);
  });
  Hooks.on("updateActor", (actor, changes, options = {}) => {
    if (options?.add2eInternal) return;
    if (changes?.system?.race !== undefined || changes?.system?.details_race !== undefined) add2eScheduleRacialRuntimeSync(actor);
  });
  Hooks.once("ready", async () => {
    await add2eRefreshRacialProfileCache();
    for (const actor of game.actors ?? []) add2eScheduleRacialRuntimeSync(actor);
  });
}

function add2eRacialRequirementLabel(key) {
  return {
    search_active: "Recherche active",
    underground: "En environnement souterrain",
    within_three_meters: "Élément situé à 3 m ou moins",
    concentration: "Concentration requise",
    alone: "Personnage seul ou à plus de 30 m du groupe",
    no_metal_armor: "Aucune armure de métal portée",
    opens_door: "Une porte doit être ouverte"
  }[String(key ?? "")] ?? String(key ?? "");
}

function add2eRacialDialogRoot(button, dialog) {
  return button?.form?.querySelector?.(".add2e-racial-capability-form")
    ?? dialog?.element?.querySelector?.(".add2e-racial-capability-form")
    ?? document.querySelector?.(".add2e-racial-capability-form")
    ?? null;
}

async function add2ePromptRacialCapabilityContext(actor, capability) {
  const requirements = add2eRacialArray(capability?.requires).map(String).filter(Boolean);
  if (!requirements.length) return {};
  if (typeof DialogV2 === "undefined") {
    ui.notifications?.warn?.("DialogV2 est indisponible : les conditions raciales ne peuvent pas être confirmées.");
    return null;
  }

  const id = foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random()}`;
  const label = add2eRacialEscape(capability?.label ?? capability?.name ?? capability?.id ?? "Capacité raciale");
  const description = add2eRacialEscape(capability?.description ?? "Confirmez les conditions avant le jet.");
  const checks = requirements.map(key => {
    const safe = String(key).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `<label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0;font-weight:700;"><input type="checkbox" name="${safe}"><span>${add2eRacialEscape(add2eRacialRequirementLabel(key))}</span></label>`;
  }).join("");

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      return value;
    };
    const dialog = new DialogV2({
      window: { title: `Capacité raciale — ${label}` },
      classes: ["add2e", "add2e-racial-capability-dialog"],
      position: { width: 460, height: "auto" },
      content: `<form class="add2e-racial-capability-form" data-add2e-racial-dialog="${add2eRacialEscape(id)}" style="display:grid;gap:8px;">
        <div style="font-weight:900;font-size:1.05em;">${label}</div>
        <div>${description}</div>
        <div style="border:1px solid rgba(90,65,15,.35);border-radius:8px;padding:8px;background:rgba(255,248,222,.55);">${checks}</div>
      </form>`,
      buttons: [
        {
          action: "roll",
          label: "Lancer le jet",
          default: true,
          callback: (_event, button, dlg) => {
            const root = add2eRacialDialogRoot(button, dlg);
            const context = {};
            for (const key of requirements) {
              const input = root?.querySelector?.(`[name="${String(key).replace(/[^a-zA-Z0-9_-]/g, "_")}"]`);
              context[key] = !!input?.checked;
            }
            return finish(context);
          }
        },
        { action: "cancel", label: "Annuler", callback: () => finish(null) }
      ],
      default: "roll"
    });
    dialog.addEventListener?.("close", () => finish(null), { once: true });
    Promise.resolve(dialog.render({ force: true })).catch(error => {
      console.warn("[ADD2E][RACIAL][DIALOG_ERROR]", error);
      finish(null);
    });
  });
}

function installRacialSheetDataBridge() {
  if (globalThis.ADD2E_RACIAL_SHEET_DATA_BRIDGE_INSTALLED || typeof Hooks === "undefined") return;
  globalThis.ADD2E_RACIAL_SHEET_DATA_BRIDGE_INSTALLED = true;
  Hooks.once("ready", () => {
    const proto = globalThis.Add2eActorSheet?.prototype;
    const base = proto?.getData;
    if (typeof base !== "function" || base.__add2eRacialBridge) return;
    const wrapped = async function add2eGetDataWithRacialCapabilities(...args) {
      const data = await base.apply(this, args);
      const engine = globalThis.Add2eEffectsEngine;
      const actor = this.actor ?? data?.actor;
      data.activeRacialCapabilities = engine?.getRacialCapabilities
        ? engine.getRacialCapabilities(actor).filter(capability => capability.activable !== false)
        : [];
      data.racialVision = engine?.getRacialVision ? engine.getRacialVision(actor) : { type: "", range: 0 };
      return data;
    };
    wrapped.__add2eRacialBridge = true;
    proto.getData = wrapped;
  });
}

function installRacialCapabilityClickBridge() {
  if (globalThis.ADD2E_RACIAL_CAPABILITY_CLICK_BRIDGE_INSTALLED || typeof document === "undefined") return;
  globalThis.ADD2E_RACIAL_CAPABILITY_CLICK_BRIDGE_INSTALLED = true;
  document.addEventListener("click", async event => {
    const button = event.target?.closest?.(".add2e-racial-capability-roll");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const engine = globalThis.Add2eEffectsEngine;
    const actorId = button.dataset?.actorId ?? "";
    const actor = game?.actors?.get?.(actorId)
      ?? canvas?.tokens?.controlled?.[0]?.actor
      ?? game?.user?.character
      ?? null;
    const capabilityId = button.dataset?.racialCapabilityId ?? "";
    const capability = engine?.getRacialCapability?.(actor, capabilityId);
    if (!actor || !capability) {
      ui.notifications?.warn?.("Capacité raciale introuvable.");
      return;
    }
    const context = await add2ePromptRacialCapabilityContext(actor, capability);
    if (context === null) return;
    const result = await engine.rollRacialCapability(actor, capability.id, context);
    if (!result?.ok && result?.reason === "requirements-missing") {
      const labels = (result.missing ?? []).map(add2eRacialRequirementLabel).join(", ");
      ui.notifications?.warn?.(`Conditions manquantes : ${labels}.`);
    }
  }, true);
}

function installRacialProfileEngine(Engine) {
  const baseGetActiveTags = Engine.getActiveTags;
  const baseGetBonusSaveVs = Engine.getSaveBonusVs;
  const baseGetBonusSaveConstitution = Engine.getBonusSaveConstitution;
  const baseGetResistanceInfo = Engine.getResistanceInfo;
  const baseCheckResistanceDetails = Engine.checkResistanceDetails;
  const baseRollActionSave = Engine.rollActionSave;

  Object.defineProperties(Engine, {
    getRacialSources: {
      configurable: true,
      writable: true,
      value(actor) {
        if (!actor) return [];
        const sources = [];
        for (const item of actor.items ?? []) {
          if (String(item?.type ?? "").toLowerCase() !== "race") continue;
          sources.push({
            id: item.id ?? item._id ?? item.uuid ?? item.name,
            uuid: item.uuid ?? "",
            name: item.name ?? "",
            system: item.system ?? {}
          });
        }
        const snapshot = actor.system?.details_race;
        if (snapshot && typeof snapshot === "object") {
          const snapshotId = snapshot.sourceItemId ?? snapshot.sourceItemUuid ?? "";
          const duplicate = sources.some(source =>
            (snapshotId && (source.id === snapshotId || source.uuid === snapshotId))
            || (!snapshotId && this.normalizeTag(source.name) === this.normalizeTag(snapshot.name ?? snapshot.nom ?? snapshot.label ?? ""))
          );
          if (!duplicate) {
            sources.push({
              id: snapshotId || `snapshot:${this.normalizeTag(snapshot.name ?? snapshot.nom ?? snapshot.label ?? actor.system?.race ?? "")}`,
              uuid: snapshot.sourceItemUuid ?? "",
              name: snapshot.name ?? snapshot.nom ?? snapshot.label ?? actor.system?.race ?? "",
              system: snapshot
            });
          }
        }
        return sources;
      }
    },

    getRacialProfiles: {
      configurable: true,
      writable: true,
      value(actor) {
        const seen = new Set();
        const profiles = [];
        for (const source of this.getRacialSources(actor)) {
          const direct = add2eRacialProfileFromSystem(source.system, source);
          const cached = direct ? null : add2eLookupCachedRacialProfile(source, actor);
          const profile = direct ?? (cached ? {
            ...cached,
            sourceId: source.id ?? source.uuid ?? source.sourceId ?? "",
            sourceName: source.name ?? source.system?.label ?? "",
            sourceSystem: source.system ?? {}
          } : null);
          if (!profile) continue;
          add2eStoreRacialProfile(profile, source);
          const key = String(profile.sourceId || profile.sourceName || JSON.stringify(profile));
          if (seen.has(key)) continue;
          seen.add(key);
          profiles.push(profile);
        }
        return profiles;
      }
    },

    getRacialPassiveTags: {
      configurable: true,
      writable: true,
      value(actor) {
        const tags = [];
        for (const source of this.getRacialSources(actor)) {
          this.addTagsInto(tags, source.system?.tags);
          this.addTagsInto(tags, source.system?.effectTags);
          this.addTagsInto(tags, source.system?.effecttags);
        }
        for (const profile of this.getRacialProfiles(actor)) {
          this.addTagsInto(tags, profile.tags);
          this.addTagsInto(tags, profile.effectTags);
          this.addTagsInto(tags, profile.passiveTags);
          const vision = profile.vision ?? {};
          const range = this.readNumber(vision.range, vision.distance);
          if (this.normalizeTag(vision.type ?? vision.mode ?? "") === "infravision" && Number.isFinite(range) && range > 0) tags.push(`infravision:${range}`);
          for (const rule of add2eRacialArray(profile.saveBonuses)) {
            if (!rule || typeof rule !== "object") continue;
            if (this.normalizeTag(rule.mode ?? rule.bonus ?? "") !== "constitution") continue;
            for (const category of add2eRacialArray(rule.categories ?? rule.category)) {
              const key = this.normalizeTag(category);
              if (key) tags.push(`bonus_save_vs:${key}:const`);
            }
          }
          for (const rule of add2eRacialArray(profile.resistances)) {
            if (!rule || typeof rule !== "object") continue;
            const value = String(rule.percent ?? rule.pct ?? rule.value ?? "").trim();
            if (!value) continue;
            for (const type of add2eRacialArray(rule.types ?? rule.type)) {
              const key = this.normalizeTag(type);
              if (key) tags.push(`resistance:${key}:${this.normalizeTag(value) === "manual" ? "manual" : value}`);
            }
          }
          for (const type of add2eRacialArray(profile.immunities)) {
            const key = this.normalizeTag(type);
            if (key) tags.push(`immunite:${key}`);
          }
          for (const rule of add2eRacialArray(profile.attackModifiers)) {
            if (!rule || typeof rule !== "object") continue;
            const mode = this.normalizeTag(rule.mode ?? rule.kind ?? "");
            const value = this.readNumber(rule.value, rule.bonus, rule.amount);
            if (!mode || !Number.isFinite(value) || !value) continue;
            if (mode === "bonus_touche") {
              for (const weapon of add2eRacialArray(rule.weapons ?? rule.weapon ?? rule.targets ?? rule.target)) {
                const key = this.normalizeTag(weapon);
                if (key) tags.push(`bonus_touche:${key}:${value}`);
              }
              continue;
            }
            const prefix = mode === "bonus_touche_vs"
              ? "bonus_touche_vs"
              : (mode === "bonus_ca_vs" || mode === "malus_attaque_vs" || mode === "malus_toucher_vs") ? mode : "";
            if (!prefix) continue;
            for (const target of add2eRacialArray(rule.targets ?? rule.target ?? rule.against)) {
              const key = this.normalizeTag(target);
              if (key) tags.push(`${prefix}:${key}:${value}`);
            }
          }
        }
        return [...new Set(tags.map(tag => this.normalizeTag(tag)).filter(Boolean))];
      }
    },

    getRacialCapabilities: {
      configurable: true,
      writable: true,
      value(actor) {
        const seen = new Set();
        const capabilities = [];
        for (const profile of this.getRacialProfiles(actor)) {
          for (const raw of add2eRacialArray(profile.capabilities)) {
            if (!raw || typeof raw !== "object") continue;
            const id = this.normalizeTag(raw.id ?? raw.key ?? raw.label ?? raw.name);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            capabilities.push({ ...add2eRacialClone(raw), id, key: id, sourceName: profile.sourceName, sourceId: profile.sourceId, activable: raw.activable !== false });
          }
        }
        return capabilities;
      }
    },

    getRacialCapability: {
      configurable: true,
      writable: true,
      value(actor, capabilityId) {
        const wanted = this.normalizeTag(capabilityId);
        return this.getRacialCapabilities(actor).find(capability => capability.id === wanted) ?? null;
      }
    },

    getRacialAbilityBounds: {
      configurable: true,
      writable: true,
      value(actor) {
        const bounds = { min: {}, max: {} };
        const merge = (target, raw) => {
          if (!raw || typeof raw !== "object") return;
          for (const [ability, rawValue] of Object.entries(raw)) {
            const value = this.readNumber(rawValue);
            const key = this.normalizeTag(ability);
            if (Number.isFinite(value) && key) target[key] = value;
          }
        };
        for (const source of this.getRacialSources(actor)) {
          merge(bounds.min, source.system?.min_caracteristiques);
          merge(bounds.max, source.system?.max_caracteristiques);
        }
        for (const profile of this.getRacialProfiles(actor)) {
          merge(bounds.min, profile.abilityBounds?.min);
          merge(bounds.max, profile.abilityBounds?.max);
        }
        return bounds;
      }
    },

    getRacialThiefAdjustments: {
      configurable: true,
      writable: true,
      value(actor) {
        const adjustments = {};
        for (const source of this.getRacialSources(actor)) {
          for (const [key, raw] of Object.entries(source.system?.thief_adjustments ?? {})) {
            const value = this.readNumber(raw);
            const normalized = this.normalizeTag(key);
            if (Number.isFinite(value) && normalized) adjustments[normalized] = (adjustments[normalized] ?? 0) + value;
          }
        }
        for (const profile of this.getRacialProfiles(actor)) {
          for (const [key, raw] of Object.entries(profile.thiefAdjustments ?? {})) {
            const value = this.readNumber(raw);
            const normalized = this.normalizeTag(key);
            if (Number.isFinite(value) && normalized) adjustments[normalized] = (adjustments[normalized] ?? 0) + value;
          }
        }
        return adjustments;
      }
    },

    getRacialVision: {
      configurable: true,
      writable: true,
      value(actor) {
        let best = 0;
        let type = "";
        for (const profile of this.getRacialProfiles(actor)) {
          const vision = profile.vision ?? {};
          const range = this.readNumber(vision.range, vision.distance);
          if (this.normalizeTag(vision.type ?? vision.mode ?? "") === "infravision" && Number.isFinite(range) && range > best) {
            best = range;
            type = "infravision";
          }
        }
        const tagRange = this.getInfravision(actor);
        if (tagRange > best) {
          best = tagRange;
          type = "infravision";
        }
        return { type, range: best };
      }
    },

    async rollRacialCapability(actor, capabilityId, context = {}) {
      const capability = this.getRacialCapability(actor, capabilityId);
      if (!actor || !capability) return { ok: false, success: false, reason: "capability-not-found" };
      const requirement = add2eRacialCapResult(capability, context);
      if (requirement.missing.length) return { ok: false, success: false, reason: "requirements-missing", capability, missing: requirement.missing };
      const formula = String(capability.formula ?? capability.die ?? "1d100").trim() || "1d100";
      const successAt = this.readNumber(capability.successAt, capability.maxSuccess, capability.threshold, capability.pct);
      if (!Number.isFinite(successAt) || successAt <= 0) return { ok: false, success: false, reason: "invalid-capability", capability };
      const roll = await new Roll(formula).evaluate();
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      const total = Number(roll.total) || 0;
      const success = total <= successAt;
      const label = String(capability.label ?? capability.name ?? capability.id);
      const source = capability.sourceName ? ` — ${capability.sourceName}` : "";
      const result = { ok: true, success, capability, roll, total, successAt, formula, context, requirements: requirement.requirements };
      if (typeof ChatMessage !== "undefined") {
        const color = success ? "#2f8f46" : "#b33a2e";
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;padding:8px;">
            <div style="font-weight:900;color:${color};">${add2eRacialEscape(label)}${add2eRacialEscape(source)}</div>
            <div><b>${add2eRacialEscape(actor.name)}</b> : ${add2eRacialEscape(formula)} = <b>${total}</b> / réussite ≤ <b>${successAt}</b></div>
            <div style="margin-top:4px;font-weight:800;color:${color};">${success ? "RÉUSSITE" : "ÉCHEC"}</div>
          </div>`
        });
      }
      return result;
    },

    async applyRacialAbilityBounds(actor) {
      if (!actor?.update) return { applied: false, reason: "missing-actor" };
      const bounds = this.getRacialAbilityBounds(actor);
      const rawBonuses = {};
      for (const source of this.getRacialSources(actor)) {
        for (const [ability, raw] of Object.entries(source.system?.bonus_caracteristiques ?? {})) {
          const key = this.normalizeTag(ability);
          const value = this.readNumber(raw);
          if (key && Number.isFinite(value)) rawBonuses[key] = (rawBonuses[key] ?? 0) + value;
        }
      }
      const current = actor.system?.bonus_caracteristiques ?? {};
      const desired = { ...current };
      const updates = {};
      let changed = false;
      for (const [ability, rawBonus] of Object.entries(rawBonuses)) {
        const base = this.readNumber(actor.system?.[`${ability}_base`], actor.system?.[ability]) ?? 10;
        const min = this.readNumber(bounds.min?.[ability]) ?? 3;
        const max = this.readNumber(bounds.max?.[ability]) ?? 18;
        let applied = rawBonus;
        if (rawBonus > 0) applied = Math.max(0, Math.min(rawBonus, max - base));
        if (rawBonus < 0) applied = Math.min(0, Math.max(rawBonus, min - base));
        if (Number(desired[ability] ?? 0) !== applied || Number(actor.system?.[`${ability}_race`] ?? 0) !== applied) changed = true;
        desired[ability] = applied;
        updates[`system.${ability}_race`] = applied;
      }
      if (!changed) return { applied: false, reason: "already-bounded", bonuses: desired, bounds };
      updates["system.bonus_caracteristiques"] = desired;
      await actor.update(updates, { add2eInternal: true });
      return { applied: true, bonuses: desired, bounds };
    },

    async syncRacialVision(actor) {
      if (!actor?.update) return { applied: false, reason: "missing-actor" };
      const vision = this.getRacialVision(actor);
      const state = actor.getFlag?.("add2e", "racialVision") ?? actor.flags?.add2e?.racialVision ?? null;
      const current = actor.prototypeToken?.sight ?? actor._source?.prototypeToken?.sight ?? {};
      const sceneUnits = this.normalizeTag(canvas?.scene?.grid?.units ?? "");
      const range = sceneUnits.includes("ft") || sceneUnits.includes("feet") || sceneUnits.includes("pied") ? vision.range * 3.28084 : vision.range;
      if (!vision.range) {
        if (!state?.base) return { applied: false, reason: "no-racial-vision" };
        await actor.update({
          "prototypeToken.sight.enabled": state.base.enabled,
          "prototypeToken.sight.range": state.base.range,
          "prototypeToken.sight.visionMode": state.base.visionMode
        }, { add2eInternal: true });
        await actor.unsetFlag?.("add2e", "racialVision");
        return { applied: true, restored: true, range: 0 };
      }
      const darkvision = globalThis.CONFIG?.Canvas?.visionModes?.darkvision ? "darkvision" : "";
      const base = state?.base ?? {
        enabled: current.enabled ?? false,
        range: Number(current.range) || 0,
        visionMode: current.visionMode ?? "basic"
      };
      const nextRange = Math.max(Number(current.range) || 0, range);
      const nextMode = darkvision && (!current.visionMode || current.visionMode === "basic") ? darkvision : (current.visionMode ?? "basic");
      if (current.enabled === true && Number(current.range) === nextRange && current.visionMode === nextMode) return { applied: false, restored: false, reason: "already-synced", range: nextRange, visionMode: nextMode };
      await actor.update({
        "prototypeToken.sight.enabled": true,
        "prototypeToken.sight.range": nextRange,
        "prototypeToken.sight.visionMode": nextMode
      }, { add2eInternal: true });
      await actor.setFlag?.("add2e", "racialVision", { base, range, visionMode: nextMode, type: vision.type });
      return { applied: true, restored: false, range: nextRange, visionMode: nextMode };
    }
  });

  Object.defineProperty(Engine, "getActiveTags", {
    configurable: true,
    writable: true,
    value(actor) {
      const baseTags = baseGetActiveTags.call(this, actor);
      const tags = Array.isArray(baseTags) ? baseTags : [];
      this.addTagsInto(tags, this.getRacialPassiveTags(actor));
      const disabled = new Set(this.getRacialProfiles(actor).flatMap(profile => add2eRacialArray(profile.disabledTags)).map(tag => this.normalizeTag(tag)).filter(Boolean));
      return [...new Set(tags.map(tag => this.normalizeTag(tag)).filter(Boolean))].filter(tag => !disabled.has(tag));
    }
  });

  Object.defineProperties(Engine, {
    getSaveCategory: {
      configurable: true,
      writable: true,
      value(value) {
        const key = this.normalizeTag(value);
        if (!key) return "";
        if (key.includes("peur") || key.includes("fear")) return "peur";
        if (key.includes("poison")) return "poison";
        if (key.includes("baguette") || key.includes("wand") || key.includes("baton") || key.includes("rod") || key.includes("staff")) return "baguettes";
        if (key.includes("petrification") || key.includes("metamorph") || key.includes("transformation")) return "petrification";
        if (key.includes("souffle") || key.includes("breath")) return "souffle";
        if (key.includes("sort") || key.includes("magie") || key.includes("magic") || key.includes("spell")) return "sorts";
        if (key.includes("mort") || key.includes("paralys")) return "mort_paralysie";
        return key;
      }
    },

    getSaveBonusVs: {
      configurable: true,
      writable: true,
      value(actor, vsType) {
        if (!actor || !vsType) return 0;
        const category = this.getSaveCategory(vsType);
        const aliases = {
          peur: ["peur", "fear"],
          poison: ["poison"],
          baguettes: ["baguette", "baguettes", "wand", "rod", "staff", "baton", "batons", "batonnet", "batonnets"],
          petrification: ["petrification", "metamorphose", "transformation"],
          souffle: ["souffle", "breath"],
          sorts: ["sort", "sorts", "sortilege", "sortileges", "spell", "spells", "magie", "magic"],
          mort_paralysie: ["mort", "paralysie", "death"]
        }[category] ?? [this.normalizeKey(vsType)];
        let bonus = 0;
        for (const tag of this.getActiveTags(actor)) {
          if (tag.startsWith("bonus_save:")) {
            bonus += Number(tag.split(":")[1]) || 0;
            continue;
          }
          if (!tag.startsWith("bonus_save_vs:")) continue;
          const parts = tag.split(":");
          const matcher = this.normalizeKey(parts[1] ?? "");
          if (parts[2] === "const") continue;
          if (matcher === "tout" || matcher === "all" || aliases.some(alias => matcher === this.normalizeKey(alias))) bonus += Number(parts[2]) || 0;
        }
        return bonus;
      }
    },

    getBonusSaveConstitution: {
      configurable: true,
      writable: true,
      value(actor, saveType) {
        const category = this.getSaveCategory(saveType);
        const tags = this.getActiveTags(actor);
        const has = matcher => tags.includes(`bonus_save_vs:${matcher}:const`);
        if (category === "poison" && has("poison")) return this.getConstitutionSaveBonus(actor);
        if (category === "baguettes" && (has("baguette") || has("baguettes") || has("baton") || has("staff"))) return this.getConstitutionSaveBonus(actor);
        if (category === "sorts" && (has("magie") || has("magic") || has("sort") || has("sorts") || has("spell"))) return this.getConstitutionSaveBonus(actor);
        return 0;
      }
    },

    getSaveBonus: {
      configurable: true,
      writable: true,
      value(actor, saveType, options = {}) {
        let bonus = this.getSaveBonusVs(actor, saveType) + this.getBonusSaveConstitution(actor, saveType);
        if (options.frontale === true) bonus += this.getSaveBonusFrontal(actor);
        return bonus;
      }
    },

    getResistanceInfo: {
      configurable: true,
      writable: true,
      value(actor, typeResist) {
        const aliases = this.getResistanceAliases(typeResist);
        const manualTag = this.getActiveTags(actor).find(tag => aliases.some(alias => tag === `resistance:${alias}:manual` || tag === `resistance:${alias}:manuelle`));
        if (manualTag) return { found: false, manual: true, type: String(typeResist ?? ""), matchedType: manualTag.split(":")[1] ?? "", tag: manualTag, pct: 0 };
        return baseGetResistanceInfo.call(this, actor, typeResist);
      }
    },

    checkResistanceDetails: {
      configurable: true,
      writable: true,
      value(actor, typeResist, options = {}) {
        if (this.hasImmunity(actor, typeResist)) {
          const result = { found: true, immunise: true, resiste: true, type: String(typeResist ?? ""), matchedType: this.normalizeTag(typeResist), tag: `immunite:${this.normalizeTag(typeResist)}`, pct: 100, jet: 0, details: `Immunité contre ${typeResist}` };
          globalThis.add2eLastResistanceRoll = result;
          return result;
        }
        return baseCheckResistanceDetails.call(this, actor, typeResist, options);
      }
    },

    rollActionSave: {
      configurable: true,
      writable: true,
      async value(actor, saveType = "sorts", bonus = 0) {
        const racialBonus = this.getSaveBonus(actor, saveType);
        const result = await baseRollActionSave.call(this, actor, saveType, (Number(bonus) || 0) + racialBonus);
        result.racialBonus = racialBonus;
        return result;
      }
    }
  });

  Engine.getLegacySaveBonusVs = baseGetBonusSaveVs;
  Engine.getLegacyBonusSaveConstitution = baseGetBonusSaveConstitution;
}

function installSingleReadActionRules(Engine) {
  Object.defineProperty(Engine, "getActiveRules", {
    configurable: true,
    writable: true,
    value(actor) {
      const rules = [];
      const effects = actor?.effects?.contents ?? actor?.effects ?? [];
      for (const effect of effects) {
        if (!effect || effect.disabled) continue;
        let raw = effect.flags?.add2e?.rules;
        if ((raw === undefined || raw === null) && effect.getFlag) {
          try { raw = effect.getFlag("add2e", "rules"); } catch {}
        }
        for (const rule of this.toRules(raw)) {
          rules.push({
            ...rule,
            source: {
              effectId: effect.id ?? null,
              effectName: effect.name ?? "",
              effect,
              actor
            }
          });
        }
      }
      return rules;
    }
  });
}

function installGateOnUseOutcomeContract(Engine) {
  const evaluate = Engine.evaluateActionRules;
  Object.defineProperty(Engine, "evaluateActionRules", {
    configurable: true,
    writable: true,
    async value(actor, action = {}) {
      const result = await evaluate.call(this, actor, action);
      const actionType = this.normalizeKey(action?.type ?? "");
      const actionScope = this.normalizeKey(action?.ruleScope ?? "");
      const ownerBlock = actionType === "attaque" && (actionScope === "owner" || actionScope === "self")
        ? result?.matchedRules?.find(entry => entry?.kind === "block_action")
        : null;

      if (ownerBlock) {
        const effectName = String(ownerBlock?.source?.effectName ?? "Effet actif").trim() || "Effet actif";
        ui.notifications?.info?.(`${effectName} est actif : aucune action offensive n'est possible.`);
      }

      for (const gate of result?.gateResults ?? []) {
        if (gate?.kind !== "save_gate" || gate.allowed === false) continue;
        const rule = gate.rule ?? {};
        const onUseWhen = this.normalizeKey(rule.onUseWhen ?? rule.handler?.onUseWhen ?? "failure");
        if (onUseWhen === "always" || onUseWhen === "any" || onUseWhen === "success") continue;
        gate.rule = {
          ...rule,
          onUse: "",
          handler: rule.handler && typeof rule.handler === "object"
            ? { ...rule.handler, onUse: "" }
            : rule.handler
        };
      }
      return result;
    }
  });
}

installRacialProfileEngine(Add2eEffectsEngine);
installRacialVisionHooks();
installRacialSheetDataBridge();
installRacialCapabilityClickBridge();
installSingleReadActionRules(Add2eEffectsEngine);
installGateOnUseOutcomeContract(Add2eEffectsEngine);

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;
