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
  if (value === undefined) return undefined;
  if (value === null) return null;
  try { return foundry.utils.deepClone(value); } catch {}
  try { return foundry.utils.duplicate(value); } catch {}
  return JSON.parse(JSON.stringify(value));
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
  if (key.includes("infravision") || key.includes("vision")) return "fa-eye";
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
    const capability = clone(raw);
    delete capability.requires;
    return [{
      ...capability,
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
      actionType: canRoll ? "roll" : "narrative",
      activable: canRoll && raw.activable !== false,
      canRoll
    }];
  });
}

function normalizeSight(sight = {}) {
  return {
    enabled: sight?.enabled === true,
    range: Math.max(0, Number(sight?.range) || 0),
    visionMode: String(sight?.visionMode ?? "basic") || "basic"
  };
}

function sightEquals(left, right) {
  const a = normalizeSight(left);
  const b = normalizeSight(right);
  return a.enabled === b.enabled && a.range === b.range && a.visionMode === b.visionMode;
}

function activeActorTokens(actor) {
  const tokens = actor?.getActiveTokens?.() ?? [];
  return tokens.filter(token => token?.document && (token?.actor?.id === actor?.id || token?.document?.actorId === actor?.id));
}

function sceneRange(engine, rangeMeters) {
  const units = engine.normalizeTag(canvas?.scene?.grid?.units ?? "");
  return units.includes("ft") || units.includes("feet") || units.includes("pied") ? rangeMeters * 3.28084 : rangeMeters;
}

function visionModeForSight(current = {}) {
  const darkvision = globalThis.CONFIG?.Canvas?.visionModes?.darkvision ? "darkvision" : "";
  if (darkvision && (!current?.visionMode || current.visionMode === "basic")) return darkvision;
  return String(current?.visionMode ?? "basic") || "basic";
}

function actionRequirements(entry) {
  return scalarList(entry?.requires)
    .map(value => String(value ?? "").trim())
    .filter(Boolean);
}

async function updateSightDocument(document, sight, options = {}) {
  if (!document?.update) return false;
  const current = normalizeSight(document?.sight ?? document?._source?.sight ?? {});
  const next = normalizeSight(sight);
  if (sightEquals(current, next)) return false;
  await document.update({
    "sight.enabled": next.enabled,
    "sight.range": next.range,
    "sight.visionMode": next.visionMode
  }, options);
  return true;
}

async function restoreRacialVision(engine, actor, state, { reason = "racial-vision-disable" } = {}) {
  if (!actor?.update) return { applied: false, reason: "missing-actor" };
  const base = state?.base ?? {};
  const prototype = normalizeSight(base.prototype ?? base);
  const currentPrototype = normalizeSight(actor.prototypeToken?.sight ?? actor._source?.prototypeToken?.sight ?? {});
  let applied = false;
  if (!sightEquals(currentPrototype, prototype)) {
    await actor.update({
      "prototypeToken.sight.enabled": prototype.enabled,
      "prototypeToken.sight.range": prototype.range,
      "prototypeToken.sight.visionMode": prototype.visionMode
    }, { add2eInternal: true, add2eReason: reason });
    applied = true;
  }

  const tokenBases = base.tokens && typeof base.tokens === "object" ? base.tokens : {};
  for (const token of activeActorTokens(actor)) {
    const tokenBase = tokenBases[token.id] ?? prototype;
    try {
      applied = (await updateSightDocument(token.document, tokenBase, { add2eInternal: true, add2eReason: reason })) || applied;
    } catch (error) {
      console.warn("[ADD2E][RACIAL_VISION][RESTORE_TOKEN]", { actor: actor.name, token: token.name, error });
    }
  }

  await actor.unsetFlag?.("add2e", "racialVision");
  return { applied, restored: true, enabled: false, range: 0 };
}

async function enableRacialVision(engine, actor, vision, state, { reason = "racial-vision-enable" } = {}) {
  if (!actor?.update) return { applied: false, reason: "missing-actor" };
  const currentPrototype = normalizeSight(actor.prototypeToken?.sight ?? actor._source?.prototypeToken?.sight ?? {});
  const legacyBase = state?.base && typeof state.base === "object" ? state.base : null;
  const base = legacyBase ? clone(legacyBase) : { prototype: currentPrototype, tokens: {} };
  if (!base.prototype) base.prototype = currentPrototype;
  if (!base.tokens || typeof base.tokens !== "object") base.tokens = {};

  const range = sceneRange(engine, vision.range);
  const nextPrototype = {
    enabled: true,
    range: Math.max(currentPrototype.range, range),
    visionMode: visionModeForSight(currentPrototype)
  };
  let applied = false;
  if (!sightEquals(currentPrototype, nextPrototype)) {
    await actor.update({
      "prototypeToken.sight.enabled": nextPrototype.enabled,
      "prototypeToken.sight.range": nextPrototype.range,
      "prototypeToken.sight.visionMode": nextPrototype.visionMode
    }, { add2eInternal: true, add2eReason: reason });
    applied = true;
  }

  for (const token of activeActorTokens(actor)) {
    const current = normalizeSight(token.document?.sight ?? token.document?._source?.sight ?? {});
    if (!base.tokens[token.id]) base.tokens[token.id] = current;
    const next = {
      enabled: true,
      range: Math.max(current.range, range),
      visionMode: visionModeForSight(current)
    };
    try {
      applied = (await updateSightDocument(token.document, next, { add2eInternal: true, add2eReason: reason })) || applied;
    } catch (error) {
      console.warn("[ADD2E][RACIAL_VISION][ENABLE_TOKEN]", { actor: actor.name, token: token.name, error });
    }
  }

  const nextState = {
    enabled: true,
    base,
    range,
    visionMode: nextPrototype.visionMode,
    type: vision.type
  };
  await actor.setFlag?.("add2e", "racialVision", nextState);
  return { applied, enabled: true, range, visionMode: nextPrototype.visionMode };
}

async function add2eRollRacialCapability(actor, capabilityId, context = {}) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!actor || typeof engine?.rollRacialCapability !== "function") {
    ui.notifications?.warn?.("Capacité raciale indisponible.");
    return null;
  }
  if (!game.user?.isGM && !actor.isOwner && !actor.testUserPermission?.(game.user, "OWNER")) {
    ui.notifications?.warn?.("Vous ne pouvez pas utiliser les capacités de cet acteur.");
    return null;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Les cartes ADD2E sont indisponibles.");
    return null;
  }

  const result = await engine.rollRacialCapability(actor, capabilityId, context);
  if (!result?.ok) {
    const message = result?.reason === "requirements-missing"
      ? `Conditions manquantes : ${(result.missing ?? []).join(", ")}.`
      : "Cette capacité raciale n’a pas pu être résolue.";
    ui.notifications?.warn?.(message);
    return result;
  }

  const capability = result.capability;
  const success = result.success === true;
  const card = {
    actor,
    title: `${capability.label} — ${success ? "Réussite" : "Échec"}`,
    icon: `fas ${capability.iconClass || "fa-dice-d20"}`,
    variant: success ? "success" : "failure",
    source: {
      name: actor.name,
      img: actor.img,
      type: "Capacité raciale"
    },
    rows: [
      { label: "Jet", value: `${result.total} / ${result.successAt}` },
      { label: "Résultat", value: success ? "Réussite." : "Échec." }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: result.roll ? [result.roll] : [],
      flags: {
        add2e: {
          racialCapability: {
            actorId: actor.id,
            raceSourceId: capability.sourceId,
            capabilityId: capability.id,
            skillTarget: result.skillTarget,
            success,
            total: result.total,
            baseSuccessAt: result.baseSuccessAt,
            successAt: result.successAt,
            adjustment: result.adjustment
          }
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  const message = await globalThis.add2eCreateChatCard(card);
  return { ...result, message };
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
      getRacialVisionState: {
        configurable: true,
        writable: true,
        value(actor) {
          const vision = this.getRacialVision(actor);
          const raw = actor?.getFlag?.("add2e", "racialVision") ?? actor?.flags?.add2e?.racialVision ?? null;
          const enabled = vision.range > 0 && (raw?.enabled === true || (raw?.enabled === undefined && !!raw?.base));
          return {
            available: vision.range > 0,
            enabled,
            type: vision.type,
            range: vision.range,
            state: raw && typeof raw === "object" ? clone(raw) : null
          };
        }
      },
      getRacialActions: {
        configurable: true,
        writable: true,
        value(actor) {
          const vision = this.getRacialVisionState(actor);
          const actions = [];
          if (vision.available) {
            actions.push({
              id: "infravision",
              key: "infravision",
              label: `Infravision ${vision.range} m`,
              description: "Active ou désactive l’infravision raciale. Elle est sans effet à proximité d’une source de lumière ou de chaleur intense.",
              img: "icons/svg/eye.svg",
              iconClass: "fa-eye",
              sourceId: this.getRacialContext(actor).source?.id ?? "",
              sourceName: this.getRacialContext(actor).source?.name ?? "Race",
              actionType: "vision-toggle",
              enabled: vision.enabled,
              activable: true,
              canRoll: false,
              requires: ["no_intense_light"]
            });
          }
          return [...actions, ...this.getRacialCapabilities(actor).filter(capability => capability?.activable !== false)];
        }
      },
      getRacialAction: {
        configurable: true,
        writable: true,
        value(actor, actionId) {
          const wanted = this.normalizeTag(actionId);
          if (!wanted) return null;
          return this.getRacialActions(actor).find(action => this.normalizeTag(action.id) === wanted) ?? null;
        }
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
      setRacialVision: {
        configurable: true,
        writable: true,
        async value(actor, enabled, options = {}) {
          if (!actor?.update) return { applied: false, reason: "missing-actor" };
          const vision = this.getRacialVision(actor);
          const state = actor.getFlag?.("add2e", "racialVision") ?? actor.flags?.add2e?.racialVision ?? null;
          if (!enabled || !vision.range) return restoreRacialVision(this, actor, state, options);
          return enableRacialVision(this, actor, vision, state, options);
        }
      },
      syncRacialVision: {
        configurable: true,
        writable: true,
        async value(actor) {
          if (!actor?.update) return { applied: false, reason: "missing-actor" };
          const vision = this.getRacialVision(actor);
          const state = actor.getFlag?.("add2e", "racialVision") ?? actor.flags?.add2e?.racialVision ?? null;
          const enabled = state?.enabled === true || (state?.enabled === undefined && !!state?.base);
          if (!vision.range) {
            if (!state?.base) return { applied: false, reason: "no-racial-vision" };
            return restoreRacialVision(this, actor, state, { reason: "racial-vision-race-removed" });
          }
          if (!enabled) return { applied: false, reason: "disabled" };
          return enableRacialVision(this, actor, vision, state, { reason: "racial-vision-sync" });
        }
      },
      rollRacialCapability: {
        configurable: true,
        writable: true,
        async value(actor, capabilityId, context = {}) {
          const capability = this.getRacialCapability(actor, capabilityId);
          if (!actor || !capability) return { ok: false, success: false, reason: "capability-not-found" };
          const missing = actionRequirements(capability).filter(key => context?.[key] !== true);
          if (missing.length) return { ok: false, success: false, reason: "requirements-missing", capability, missing };
          const formula = String(capability.formula ?? capability.die ?? "").trim();
          const baseSuccessAt = this.readNumber(capability.successAt, capability.maxSuccess, capability.threshold, capability.pct);
          if (!formula || !Number.isFinite(baseSuccessAt) || baseSuccessAt <= 0) {
            return { ok: false, success: false, reason: "invalid-capability", capability };
          }

          const skillTarget = this.normalizeTag(capability.key ?? capability.id);
          if (!skillTarget) return { ok: false, success: false, reason: "invalid-skill-target", capability };
          const sourceItem = directRaceItem(actor);
          const resolutionContext = {
            ...context,
            actor,
            sourceItem,
            raceItem: sourceItem,
            actionType: "skill",
            skillKey: skillTarget,
            skillTarget,
            racialCapabilityId: capability.id,
            source: context.source ?? "racial-capability"
          };
          const modifiers = [
            ...this.collect(actor, resolutionContext),
            ...records(context.modifiers ?? context.extraModifiers)
          ];
          const circumstance = context.circumstance;
          const circumstanceValue = Number(circumstance?.value ?? circumstance?.amount ?? circumstance?.bonus ?? 0);
          if (Number.isFinite(circumstanceValue) && circumstanceValue !== 0) {
            modifiers.push(this.createModifier({
              id: `${actor.id}:racial-skill:${skillTarget}:circumstance`,
              domain: "skill",
              target: skillTarget,
              operation: "add",
              value: circumstanceValue,
              priority: 1000,
              stacking: { mode: "stack", group: null },
              conditions: {},
              source: {
                kind: "context",
                id: `racial-skill:${skillTarget}:circumstance`,
                uuid: actor.uuid ?? "",
                name: String(circumstance?.label ?? circumstance?.name ?? "Circonstance").trim() || "Circonstance"
              },
              metadata: { transient: true, circumstance: true }
            }));
          }
          const resolution = this.resolve(actor, {
            domain: "skill",
            target: skillTarget,
            base: baseSuccessAt,
            rounding: "floor",
            modifiers,
            context: resolutionContext
          });
          const successAt = Math.max(0, Math.trunc(Number(resolution?.total) || 0));
          const roll = await new Roll(formula).evaluate();
          const total = Number(roll.total);
          return {
            ok: Number.isFinite(total),
            success: Number.isFinite(total) && total <= successAt,
            reason: Number.isFinite(total) ? "rolled" : "invalid-roll",
            capability,
            roll,
            total,
            baseSuccessAt,
            successAt,
            adjustment: successAt - baseSuccessAt,
            formula,
            skillTarget,
            resolution
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
        Promise.resolve(Engine.syncRacialVision?.(item.parent)).catch(error => console.warn("[ADD2E][RACIAL_VISION][SYNC]", error));
      };
      Hooks.on("createItem", invalidate);
      Hooks.on("updateItem", invalidate);
      Hooks.on("deleteItem", invalidate);
      Hooks.on("createToken", tokenDocument => {
        const actor = tokenDocument?.actor;
        if (actor) Promise.resolve(Engine.syncRacialVision?.(actor)).catch(error => console.warn("[ADD2E][RACIAL_VISION][TOKEN]", error));
      });
      Hooks.once("ready", () => {
        for (const actor of game.actors ?? []) Promise.resolve(Engine.syncRacialVision?.(actor)).catch(error => console.warn("[ADD2E][RACIAL_VISION][READY]", error));
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
      data.activeRacialCapabilities = engine?.getRacialActions?.(actor) ?? [];
      return data;
    };
    wrapped.__add2eStrictRacialEffectsSheetDataBridge = true;
    proto.getData = wrapped;
  });
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
