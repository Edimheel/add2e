// ADD2E — Effects Engine / analyse et règles raciales strictes.
// La seule source raciale est la Race Item de l'acteur et son system.racialProfile.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const ADD2E_RACIAL_CONTEXT_CACHE = new WeakMap();

function clone(value) {
  try { return foundry.utils.deepClone(value); } catch {}
  try { return foundry.utils.duplicate(value); } catch {}
  return JSON.parse(JSON.stringify(value));
}

function htmlEscape(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); } catch {}
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function records(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function scalarList(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(scalarList).filter(Boolean);
  if (value instanceof Set) return [...value].flatMap(scalarList).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "entries"]) {
      if (value[key] !== undefined) return scalarList(value[key]);
    }
    return [];
  }
  return [value];
}

function directRaceItem(actor) {
  const races = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "race");
  return races.length === 1 ? races[0] : null;
}

function directRacialContext(engine, actor) {
  if (!actor || typeof actor !== "object") return { source: null, profile: null, passiveTags: [], virtualEffects: [] };
  const item = directRaceItem(actor);
  const signature = `${item?.id ?? ""}|${item?._stats?.modifiedTime ?? ""}`;
  const cached = ADD2E_RACIAL_CONTEXT_CACHE.get(actor);
  if (cached?.signature === signature) return cached;

  const source = item ? {
    id: item.id ?? item._id ?? item.uuid ?? "",
    uuid: item.uuid ?? "",
    name: item.name ?? "",
    system: item.system ?? {},
    item
  } : null;
  const rawProfile = source?.system?.racialProfile;
  const profile = rawProfile && typeof rawProfile === "object" && !Array.isArray(rawProfile) && String(rawProfile.id ?? "").trim()
    ? { ...clone(rawProfile), sourceId: source.id, sourceName: source.name, sourceSystem: source.system }
    : null;
  const context = {
    signature,
    source,
    profile,
    passiveTags: profile ? compilePassiveTags(engine, profile) : [],
    virtualEffects: []
  };
  context.virtualEffects = createVirtualEffects(context);
  ADD2E_RACIAL_CONTEXT_CACHE.set(actor, context);
  return context;
}

function compilePassiveTags(engine, profile) {
  const tags = [];
  const vision = profile.vision ?? {};
  const range = engine.readNumber(vision.range, vision.distance);
  if (engine.normalizeTag(vision.type ?? vision.mode ?? "") === "infravision" && Number.isFinite(range) && range > 0) tags.push(`infravision:${range}`);

  for (const rule of records(profile.saveBonuses)) {
    if (!rule || typeof rule !== "object" || engine.normalizeTag(rule.mode ?? rule.bonus ?? "") !== "constitution") continue;
    for (const category of scalarList(rule.categories ?? rule.category)) {
      const key = engine.normalizeTag(category);
      if (key) tags.push(`bonus_save_vs:${key}:const`);
    }
  }
  for (const rule of records(profile.resistances)) {
    if (!rule || typeof rule !== "object") continue;
    const value = String(rule.percent ?? rule.pct ?? rule.value ?? "").trim();
    if (!value) continue;
    for (const type of scalarList(rule.types ?? rule.type)) {
      const key = engine.normalizeTag(type);
      if (key) tags.push(`resistance:${key}:${engine.normalizeTag(value) === "manual" ? "manual" : value}`);
    }
  }
  for (const type of scalarList(profile.immunities)) {
    const key = engine.normalizeTag(type);
    if (key) tags.push(`immunite:${key}`);
  }
  for (const rule of records(profile.attackModifiers)) {
    if (!rule || typeof rule !== "object") continue;
    const mode = engine.normalizeTag(rule.mode ?? rule.kind ?? "");
    const value = engine.readNumber(rule.value, rule.bonus, rule.amount);
    if (!mode || !Number.isFinite(value) || !value) continue;
    if (mode === "bonus_touche") {
      for (const weapon of scalarList(rule.weapons ?? rule.weapon ?? rule.targets ?? rule.target)) {
        const key = engine.normalizeTag(weapon);
        if (key) tags.push(`bonus_touche:${key}:${value}`);
      }
      continue;
    }
    if (!["bonus_touche_vs", "bonus_ca_vs", "malus_attaque_vs", "malus_toucher_vs"].includes(mode)) continue;
    for (const target of scalarList(rule.targets ?? rule.target ?? rule.against)) {
      const key = engine.normalizeTag(target);
      if (key) tags.push(`${mode}:${key}:${value}`);
    }
  }
  return [...new Set(tags.map(tag => engine.normalizeTag(tag)).filter(Boolean))];
}

function racialIconClass(capability = {}) {
  const key = String(capability.id ?? capability.key ?? capability.label ?? capability.name ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (key.includes("porte")) return "fa-door-closed";
  if (key.includes("pente")) return "fa-mountain";
  if (key.includes("direction") || key.includes("profondeur")) return "fa-compass";
  if (key.includes("paroi") || key.includes("construction")) return "fa-hammer";
  if (key.includes("piege")) return "fa-triangle-exclamation";
  if (key.includes("surprise")) return "fa-user-ninja";
  return "fa-dice-d20";
}

function createVirtualEffects(context) {
  const sourceName = context?.source?.name ?? "Race";
  if (!context?.source) return [];
  if (!context.profile) {
    return [{
      id: `racial-profile-missing:${context.source.id}`,
      name: "Profil racial incomplet",
      img: "icons/svg/hazard.svg",
      description: `La race ${sourceName} ne possède pas de system.racialProfile valide. Aucun effet racial mécanique n’est appliqué.`,
      duration: "Permanent",
      sourceName: `Race — ${sourceName}`,
      virtual: true,
      readonly: true,
      racial: true,
      kind: "passive",
      capabilityId: ""
    }];
  }

  const entries = [];
  const push = (raw, kind) => {
    if (!raw || typeof raw !== "object") return;
    const key = String(raw.id ?? raw.key ?? raw.label ?? raw.name ?? `${kind}-${entries.length}`);
    const name = String(raw.label ?? raw.name ?? key).trim();
    const description = String(raw.description ?? "").trim();
    if (!name || !description) return;
    entries.push({
      id: `racial:${context.source.id}:${kind}:${key}`,
      name,
      img: raw.img ?? raw.icon ?? (kind === "capability" ? "icons/svg/d20-grey.svg" : "icons/svg/aura.svg"),
      description,
      duration: kind === "capability" ? "Conditionnel" : "Permanent",
      sourceName: `Race — ${sourceName}`,
      virtual: true,
      readonly: true,
      racial: true,
      kind,
      capabilityId: kind === "capability" ? key : ""
    });
  };
  for (const passive of records(context.profile.passives)) push(passive, "passive");
  for (const capability of records(context.profile.capabilities)) push(capability, "capability");
  return entries;
}

function directRacialCapabilities(engine, actor) {
  const context = directRacialContext(engine, actor);
  if (!context.source || !context.profile) return [];
  return records(context.profile.capabilities).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const id = String(raw.id ?? raw.key ?? "").trim();
    const label = String(raw.label ?? raw.name ?? id).trim();
    const description = String(raw.description ?? "").trim();
    if (!id || !label || !description) return [];
    const formula = String(raw.formula ?? raw.die ?? "").trim();
    const successAt = engine.readNumber(raw.successAt, raw.maxSuccess, raw.threshold, raw.pct);
    const canRoll = Boolean(formula) && Number.isFinite(successAt) && successAt > 0;
    return [{
      ...clone(raw),
      id,
      key: engine.normalizeTag(id),
      label,
      description,
      formula,
      successAt,
      rollLabel: canRoll ? `${formula} ≤ ${successAt}` : "",
      iconClass: String(raw.iconClass ?? raw.faIcon ?? "").trim() || racialIconClass({ ...raw, id, label }),
      index,
      sourceId: context.source.id,
      sourceName: context.source.name,
      activable: raw.activable !== false,
      canRoll
    }];
  });
}

async function add2eRollRacialCapability(actor, capabilityId) {
  const engine = globalThis.Add2eEffectsEngine;
  if (!actor || typeof engine?.rollRacialCapability !== "function") {
    ui.notifications?.warn?.("Capacité raciale indisponible.");
    return null;
  }
  if (!game.user?.isGM && !actor.isOwner && !actor.testUserPermission?.(game.user, "OWNER")) {
    ui.notifications?.warn?.("Vous ne pouvez pas utiliser les capacités de cet acteur.");
    return null;
  }
  const result = await engine.rollRacialCapability(actor, capabilityId);
  if (!result?.ok) {
    ui.notifications?.warn?.("Cette capacité raciale n’a pas de jet défini.");
    return result;
  }
  const capability = result.capability;
  const success = result.success === true;
  const border = success ? "#197d5a" : "#9d352c";
  const background = success ? "#eefaf4" : "#fff0ee";
  const title = success ? "Réussite" : "Échec";
  const content = `<div class="add2e-card-racial" style="border:2px solid ${border};border-radius:12px;padding:10px;background:${background};color:#24180f;font-family:var(--font-primary);">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><i class="fas ${htmlEscape(capability.iconClass || "fa-dice-d20")}" style="font-size:1.55em;color:${border};"></i><strong style="font-size:1.08em;color:${border};">${htmlEscape(capability.label)}</strong><span style="margin-left:auto;font-weight:900;">Capacité raciale</span></div>
    <div>Jet : <strong>${htmlEscape(result.formula)}</strong> = <strong>${htmlEscape(result.total)}</strong> / réussite sur <strong>${htmlEscape(result.successAt)}</strong> ou moins.</div>
    <div style="margin-top:5px;font-weight:900;color:${border};">${title}</div>
    <div style="margin-top:6px;font-size:.9em;line-height:1.35;">${htmlEscape(capability.description)}</div>
  </div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { add2e: { racialCapability: { actorId: actor.id, raceSourceId: capability.sourceId, capabilityId: capability.id, success } } }
  });
  return result;
}

function resolveHudActor() {
  const actorId = globalThis.add2eHudCheck?.().actorId ?? "";
  return (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actorId)?.actor
    ?? (canvas?.tokens?.placeables ?? []).find(token => token?.actor?.id === actorId)?.actor
    ?? game.actors?.get?.(actorId)
    ?? canvas?.tokens?.controlled?.[0]?.actor
    ?? game.user?.character
    ?? null;
}

function installStrictRacialProfileAuthority(Engine) {
  const defer = globalThis.queueMicrotask ?? (callback => Promise.resolve().then(callback));
  defer(() => {
    if (!Engine || Engine.__add2eStrictRacialProfileAuthorityInstalled) return;
    Engine.__add2eStrictRacialProfileAuthorityInstalled = true;
    const inheritedGetActiveTags = Engine.getActiveTags?.bind(Engine);

    Object.defineProperties(Engine, {
      getRacialContext: {
        configurable: true,
        writable: true,
        value(actor) { return directRacialContext(this, actor); }
      },
      invalidateRacialContext: {
        configurable: true,
        writable: true,
        value(actor) { if (actor && typeof actor === "object") ADD2E_RACIAL_CONTEXT_CACHE.delete(actor); }
      },
      getRacialSources: {
        configurable: true,
        writable: true,
        value(actor) {
          const source = this.getRacialContext(actor).source;
          return source ? [source] : [];
        }
      },
      getRacialProfiles: {
        configurable: true,
        writable: true,
        value(actor) {
          const profile = this.getRacialContext(actor).profile;
          return profile ? [profile] : [];
        }
      },
      getRacialPassiveTags: {
        configurable: true,
        writable: true,
        value(actor) { return [...this.getRacialContext(actor).passiveTags]; }
      },
      getRacialVirtualEffects: {
        configurable: true,
        writable: true,
        value(actor) { return this.getRacialContext(actor).virtualEffects.map(clone); }
      },
      getRacialPassiveEffects: {
        configurable: true,
        writable: true,
        value(actor) { return this.getRacialVirtualEffects(actor).filter(effect => effect.kind !== "capability"); }
      },
      getRacialCapabilities: {
        configurable: true,
        writable: true,
        value(actor) { return directRacialCapabilities(this, actor); }
      },
      getRacialCapability: {
        configurable: true,
        writable: true,
        value(actor, capabilityId) {
          const wanted = this.normalizeTag(capabilityId);
          if (!wanted) return null;
          return this.getRacialCapabilities(actor).find(capability => this.normalizeTag(capability.id) === wanted) ?? null;
        }
      },
      getRacialVision: {
        configurable: true,
        writable: true,
        value(actor) {
          const profile = this.getRacialContext(actor).profile;
          const vision = profile?.vision ?? {};
          const range = this.readNumber(vision.range, vision.distance);
          const type = this.normalizeTag(vision.type ?? vision.mode ?? "");
          return type === "infravision" && Number.isFinite(range) && range > 0
            ? { type: "infravision", range }
            : { type: "", range: 0 };
        }
      },
      syncRacialVision: {
        configurable: true,
        writable: true,
        async value(actor) {
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
          if (current.enabled === true && Number(current.range) === nextRange && current.visionMode === nextMode) return { applied: false, reason: "already-synced", range: nextRange, visionMode: nextMode };
          await actor.update({
            "prototypeToken.sight.enabled": true,
            "prototypeToken.sight.range": nextRange,
            "prototypeToken.sight.visionMode": nextMode
          }, { add2eInternal: true });
          await actor.setFlag?.("add2e", "racialVision", { base, range, visionMode: nextMode, type: vision.type });
          return { applied: true, range: nextRange, visionMode: nextMode };
        }
      },
      rollRacialCapability: {
        configurable: true,
        writable: true,
        async value(actor, capabilityId) {
          const capability = this.getRacialCapability(actor, capabilityId);
          if (!actor || !capability) return { ok: false, success: false, reason: "capability-not-found" };
          const formula = String(capability.formula ?? capability.die ?? "").trim();
          const successAt = this.readNumber(capability.successAt, capability.maxSuccess, capability.threshold, capability.pct);
          if (!formula || !Number.isFinite(successAt) || successAt <= 0) return { ok: false, success: false, reason: "invalid-capability", capability };
          const roll = await new Roll(formula).evaluate();
          if (game?.dice3d?.showForRoll) await game.dice3d.showForRoll(roll);
          const total = Number(roll.total);
          return {
            ok: Number.isFinite(total),
            success: Number.isFinite(total) && total <= successAt,
            reason: Number.isFinite(total) ? "rolled" : "invalid-roll",
            capability,
            roll,
            total,
            successAt,
            formula
          };
        }
      }
    });

    globalThis.add2eRollRacialCapability = add2eRollRacialCapability;

    if (typeof inheritedGetActiveTags === "function") {
      Object.defineProperty(Engine, "getActiveTags", {
        configurable: true,
        writable: true,
        value(actor) {
          return [...new Set([
            ...inheritedGetActiveTags(actor),
            ...this.getRacialPassiveTags(actor)
          ].map(tag => this.normalizeTag(tag)).filter(Boolean))];
        }
      });
    }

    if (typeof Hooks !== "undefined" && !globalThis.ADD2E_RACIAL_STRICT_INVALIDATION_HOOKS_INSTALLED) {
      globalThis.ADD2E_RACIAL_STRICT_INVALIDATION_HOOKS_INSTALLED = true;
      const invalidate = item => {
        if (String(item?.type ?? "").toLowerCase() !== "race") return;
        Engine.invalidateRacialContext(item.parent);
        Promise.resolve(Engine.syncRacialVision?.(item.parent)).catch(() => {});
      };
      Hooks.on("createItem", invalidate);
      Hooks.on("updateItem", invalidate);
      Hooks.on("deleteItem", invalidate);
      Hooks.once("ready", () => {
        for (const actor of game.actors ?? []) Promise.resolve(Engine.syncRacialVision?.(actor)).catch(() => {});
      });
    }
  });
}

function installStrictRacialEffectsSheetDataBridge() {
  if (globalThis.ADD2E_RACIAL_STRICT_EFFECTS_SHEET_DATA_BRIDGE_INSTALLED || typeof Hooks === "undefined") return;
  globalThis.ADD2E_RACIAL_STRICT_EFFECTS_SHEET_DATA_BRIDGE_INSTALLED = true;
  Hooks.once("ready", () => {
    const proto = globalThis.Add2eActorSheet?.prototype;
    const base = proto?.getData;
    if (typeof base !== "function" || base.__add2eStrictRacialEffectsSheetDataBridge) return;
    const wrapped = async function add2eGetDataWithStrictRacialEffects(...args) {
      const data = await base.apply(this, args);
      const actor = this.actor ?? data?.actor;
      const engine = globalThis.Add2eEffectsEngine;
      const virtual = engine?.getRacialVirtualEffects?.(actor) ?? [];
      const active = Array.isArray(data.activeEffectsList) ? data.activeEffectsList : [];
      const seen = new Set(active.map(effect => String(effect?.id ?? "")));
      data.activeEffectsList = [...virtual.filter(effect => !seen.has(String(effect?.id ?? ""))), ...active];
      data.activeRacialCapabilities = engine?.getRacialCapabilities?.(actor)?.filter(capability => capability?.activable !== false) ?? [];
      return data;
    };
    wrapped.__add2eStrictRacialEffectsSheetDataBridge = true;
    proto.getData = wrapped;
  });

  if (!globalThis.ADD2E_RACIAL_STRICT_CLICK_BRIDGE_INSTALLED) {
    globalThis.ADD2E_RACIAL_STRICT_CLICK_BRIDGE_INSTALLED = true;
    document.addEventListener("click", event => {
      const button = event.target?.closest?.(".add2e-racial-capability-roll[data-racial-capability-id], #add2e-action-hud [data-add2e-hud-racial-action][data-racial-capability-id]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const actorId = button.dataset.actorId ?? "";
      const actor = actorId ? game.actors?.get?.(actorId) : resolveHudActor();
      if (!actor) return ui.notifications?.warn?.("Acteur introuvable pour la capacité raciale.");
      void globalThis.add2eRollRacialCapability?.(actor, button.dataset.racialCapabilityId);
    }, true);
  }
}

function installRacialImmunityAliases(Engine) {
  queueMicrotask(() => {
    if (Engine.__add2eRacialImmunityAliasesInstalled || typeof Engine.hasImmunity !== "function") return;
    Engine.__add2eRacialImmunityAliasesInstalled = true;
    const previous = Engine.hasImmunity.bind(Engine);
    Object.defineProperty(Engine, "hasImmunity", {
      configurable: true,
      writable: true,
      value(actor, type) {
        const normalized = this.normalizeTag(type);
        const aliases = new Set([normalized]);
        if (normalized === "peur" || normalized === "fear") {
          aliases.add("peur");
          aliases.add("fear");
        }
        const tags = this.getActiveTags(actor);
        if ([...aliases].some(alias => tags.includes(`immunite:${alias}`) || tags.includes(`protection:${alias}`))) return true;
        return previous(actor, type);
      }
    });
  });
}

export function installEffectsEngineAnalysis(Engine) {
  register(Engine, {
    analyze(actor, action = {}) {
      const tags = this.getActiveTags(actor);
      const out = {};

      if (
        action.type === "spell"
        && String(action.name || "").toLowerCase().includes("missile magique")
        && tags.includes("immunite:missile_magique")
      ) out.immunise = true;

      if (action.type === "attaque") {
        const fixed = this.getConditionalFixedCA(actor, {
          sousType: action.sousType,
          frontale: !!action.frontale,
          type: action.type,
          source: action.source
        });
        if (fixed.ca !== null) out.ca_fixe = fixed.ca;
        out.ca_fixe_details = fixed;
        out.bonus_ca = this.getCABonus(actor, action);
      }

      if (action.type === "save") {
        let bonus = 0;
        if (action.frontale) bonus += this.getSaveBonusFrontal(actor);
        if (action.vsType) bonus += this.getSaveBonus(actor, action.vsType);
        if (bonus !== 0) out.bonus_save = (out.bonus_save || 0) + bonus;
      }

      if (action.type === "moine" || action.type === "monk") out.moine = this.getMonkSummary(actor);
      if (tags.includes("camouflage")) out.camouflage = true;
      return out;
    },

    getInfravision(actor) {
      let best = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (!tag.startsWith("infravision:")) continue;
        const value = Number(tag.split(":")[1]) || 0;
        if (value > best) best = value;
      }
      return best;
    }
  });

  installStrictRacialProfileAuthority(Engine);
  installStrictRacialEffectsSheetDataBridge();
  installRacialImmunityAliases(Engine);
}
