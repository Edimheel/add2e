// ADD2E — Effects Engine / analyse de contexte et autorité raciale stricte.
// Les règles raciales viennent exclusivement de system.racialProfile.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const ADD2E_RACIAL_CONTEXT_CACHE = new WeakMap();
const ADD2E_RACIAL_HUD_ID = "add2e-action-hud";
const ADD2E_RACIAL_HUD_STYLE_ID = "add2e-racial-profile-hud-style";

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

function raceSelectionValue(actor) {
  const raw = actor?.system?.race;
  if (raw && typeof raw === "object") return String(raw.value ?? raw.id ?? raw.name ?? raw.label ?? "").trim();
  return String(raw ?? "").trim();
}

function directRaceItem(engine, actor) {
  const races = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "race");
  if (!races.length) return null;
  const wanted = raceSelectionValue(actor);
  if (!wanted) return races.length === 1 ? races[0] : null;
  const wantedNormalized = engine.normalizeTag(wanted);
  return races.find(item => [item.id, item._id, item.uuid, item.name, item.system?.slug, item.system?.label]
    .some(value => String(value ?? "") === wanted || engine.normalizeTag(value) === wantedNormalized)) ?? null;
}

function directRacialContext(engine, actor) {
  if (!actor || typeof actor !== "object") return { source: null, profile: null, passiveTags: [], virtualEffects: [] };
  const sourceItem = directRaceItem(engine, actor);
  const signature = `${sourceItem?.id ?? ""}|${sourceItem?._stats?.modifiedTime ?? ""}|${raceSelectionValue(actor)}`;
  const cached = ADD2E_RACIAL_CONTEXT_CACHE.get(actor);
  if (cached?.signature === signature) return cached;

  const source = sourceItem ? {
    id: sourceItem.id ?? sourceItem._id ?? sourceItem.uuid ?? sourceItem.name,
    uuid: sourceItem.uuid ?? "",
    name: sourceItem.name ?? "",
    system: sourceItem.system ?? {},
    item: sourceItem
  } : null;
  const raw = source?.system?.racialProfile;
  const profile = raw && typeof raw === "object" && !Array.isArray(raw) && String(raw.id ?? "").trim()
    ? { ...clone(raw), sourceId: source.id, sourceName: source.name, sourceSystem: source.system }
    : null;
  const context = { signature, source, profile, passiveTags: profile ? compilePassiveTags(engine, profile) : [], virtualEffects: [] };
  context.virtualEffects = createVirtualEffects(context);
  ADD2E_RACIAL_CONTEXT_CACHE.set(actor, context);
  return context;
}

function scalarList(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(scalarList).filter(Boolean);
  if (value instanceof Set) return [...value].flatMap(scalarList).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "tags", "effectTags", "entries"]) {
      if (value[key] !== undefined) return scalarList(value[key]);
    }
    return [];
  }
  return [value];
}

function records(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function racialCapabilityKey(engine, value) {
  return engine.normalizeTag(String(value ?? ""));
}

function compilePassiveTags(engine, profile) {
  const tags = [];
  engine.addTagsInto(tags, profile.passiveTags);
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
  const add = (raw, kind) => {
    if (!raw || typeof raw !== "object") return;
    const key = String(raw.id ?? raw.key ?? raw.label ?? raw.name ?? `${kind}-${entries.length}`);
    const label = String(raw.label ?? raw.name ?? key).trim();
    const description = String(raw.description ?? "").trim();
    if (!label || !description) return;
    entries.push({
      id: `racial:${context.source.id}:${kind}:${key}`,
      name: label,
      img: raw.img ?? raw.icon ?? (kind === "capability" ? "icons/svg/d20.svg" : "icons/svg/aura.svg"),
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
  for (const passive of records(context.profile.passives)) add(passive, "passive");
  for (const capability of records(context.profile.capabilities)) add(capability, "capability");
  return entries;
}

function directRacialCapabilities(engine, actor) {
  const context = directRacialContext(engine, actor);
  if (!context.source || !context.profile) return [];
  return records(context.profile.capabilities).flatMap((capability, index) => {
    if (!capability || typeof capability !== "object") return [];
    const id = String(capability.id ?? capability.key ?? "").trim();
    const label = String(capability.label ?? capability.name ?? id).trim();
    const description = String(capability.description ?? "").trim();
    if (!id || !label || !description) return [];
    return [{
      ...clone(capability),
      id,
      label,
      description,
      index,
      sourceId: context.source.id,
      sourceName: context.source.name,
      canRoll: Boolean(String(capability.formula ?? "").trim()) && Number.isFinite(engine.readNumber(capability.successAt))
    }];
  });
}

function legacyRaceMechanicalTags(engine, actor) {
  const tags = [];
  const races = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "race");
  for (const item of races) {
    engine.addTagsInto(tags, item.system?.effectTags);
    engine.addTagsInto(tags, item.system?.effecttags);
    engine.addTagsInto(tags, item.system?.effects);
    engine.addTagsInto(tags, item.system?.effets);
    engine.addEmbeddedItemEffectTagsInto(tags, item);
  }
  engine.addTagsInto(tags, actor?.flags?.add2e?.racialTags);
  try { engine.addTagsInto(tags, actor?.getFlag?.("add2e", "racialTags")); } catch {}
  return new Set(tags.map(tag => engine.normalizeTag(tag)).filter(Boolean));
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
          const wanted = racialCapabilityKey(this, capabilityId);
          if (!wanted) return null;
          return this.getRacialCapabilities(actor).find(capability => racialCapabilityKey(this, capability.id) === wanted) ?? null;
        }
      },
      rollRacialCapability: {
        configurable: true,
        writable: true,
        async value(actor, capabilityId) {
          const capability = this.getRacialCapability(actor, capabilityId);
          if (!capability) return { ok: false, reason: "missing-capability", capability: null };
          const formula = String(capability.formula ?? "").trim();
          const successAt = this.readNumber(capability.successAt);
          if (!formula || !Number.isFinite(successAt)) return { ok: false, reason: "not-rollable", capability };
          const roll = await new Roll(formula).evaluate();
          if (game?.dice3d?.showForRoll) await game.dice3d.showForRoll(roll);
          const total = Number(roll.total);
          return {
            ok: Number.isFinite(total),
            reason: Number.isFinite(total) ? "rolled" : "invalid-roll",
            capability,
            roll,
            total,
            successAt,
            success: Number.isFinite(total) && total <= successAt
          };
        }
      }
    });

    if (typeof inheritedGetActiveTags === "function") {
      Object.defineProperty(Engine, "getActiveTags", {
        configurable: true,
        writable: true,
        value(actor) {
          const legacy = legacyRaceMechanicalTags(this, actor);
          return inheritedGetActiveTags(actor).filter(tag => !legacy.has(this.normalizeTag(tag)));
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
      Hooks.on("updateActor", (actor, changes) => {
        if (changes?.system?.race === undefined && changes?.system?.details_race === undefined) return;
        Engine.invalidateRacialContext(actor);
      });
    }
  });
}

function installStrictRacialEffectsSheetBridge() {
  if (globalThis.ADD2E_RACIAL_STRICT_EFFECTS_SHEET_BRIDGE_INSTALLED || typeof Hooks === "undefined") return;
  globalThis.ADD2E_RACIAL_STRICT_EFFECTS_SHEET_BRIDGE_INSTALLED = true;
  Hooks.once("ready", () => {
    const proto = globalThis.Add2eActorSheet?.prototype;
    const base = proto?.getData;
    if (typeof base !== "function" || base.__add2eStrictRacialEffectsBridge) return;
    const wrapped = async function add2eGetDataWithStrictRacialEffects(...args) {
      const data = await base.apply(this, args);
      const engine = globalThis.Add2eEffectsEngine;
      const actor = this.actor ?? data?.actor;
      const virtual = engine?.getRacialVirtualEffects?.(actor) ?? [];
      const active = Array.isArray(data.activeEffectsList) ? data.activeEffectsList : [];
      const seen = new Set(active.map(effect => String(effect?.id ?? "")));
      data.activeEffectsList = [...virtual.filter(effect => !seen.has(String(effect?.id ?? ""))), ...active];
      return data;
    };
    wrapped.__add2eStrictRacialEffectsBridge = true;
    proto.getData = wrapped;
  });
}

function racialHudActor() {
  const actorId = globalThis.add2eHudCheck?.().actorId ?? "";
  if (!actorId) return null;
  const fromCanvas = [
    ...(canvas?.tokens?.controlled ?? []),
    ...(canvas?.tokens?.placeables ?? [])
  ].find(token => token?.actor?.id === actorId)?.actor;
  return fromCanvas ?? game.actors?.get?.(actorId) ?? null;
}

function racialHudConditionLabel(value) {
  const labels = {
    within_three_meters: "à 3 m ou moins",
    search_active: "recherche active",
    underground: "sous terre",
    concentration: "concentration",
    alone: "isolé",
    no_metal_armor: "sans armure de métal",
    opens_door: "après ouverture d’une porte"
  };
  const key = String(value ?? "").trim();
  return labels[key] ?? key.replaceAll("_", " ");
}

function racialHudConditions(capability) {
  return scalarList(capability?.requires).map(racialHudConditionLabel).filter(Boolean);
}

function racialHudEnsureStyle() {
  if (document.getElementById(ADD2E_RACIAL_HUD_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD2E_RACIAL_HUD_STYLE_ID;
  style.textContent = `
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-panel{display:grid;gap:6px;padding:7px;border:1px solid rgba(113,155,218,.72);border-radius:10px;background:rgba(58,88,136,.20)}
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-title{color:#d9ebff;font-size:.82em;font-weight:900}
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px;border:1px solid rgba(152,194,255,.48);border-radius:8px;background:rgba(8,15,28,.20)}
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-row img{width:34px;height:34px;border-radius:7px;object-fit:cover;border:1px solid rgba(152,194,255,.68)}
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-name{color:#eff7ff;font-weight:900}
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c7dcf5;font-size:.76em;font-weight:750;margin-top:2px}
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-description{color:#d6e8ff;font-size:.76em;line-height:1.35;margin-top:3px}
#${ADD2E_RACIAL_HUD_ID} .a2e-hud-racial-use{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #98c2ff;border-radius:8px;background:linear-gradient(180deg,#c8e0ff,#6f9fdd);color:#101b2e;font-size:.8em;font-weight:950;cursor:pointer}
`;
  document.head.appendChild(style);
}

function racialHudPassiveHtml(effect) {
  return `<div class="a2e-hud-racial-row">
  <img src="${htmlEscape(effect.img || "icons/svg/aura.svg")}" alt="">
  <div><div class="a2e-hud-racial-name">${htmlEscape(effect.name)}</div><div class="a2e-hud-racial-meta"><span>${htmlEscape(effect.sourceName)}</span><span>${htmlEscape(effect.duration || "Permanent")}</span></div><div class="a2e-hud-racial-description">${htmlEscape(effect.description)}</div></div>
  <span aria-hidden="true"></span>
</div>`;
}

function racialHudCapabilityHtml(capability) {
  const conditions = racialHudConditions(capability);
  const formula = String(capability.formula ?? "").trim();
  const successAt = Number(capability.successAt);
  const roll = capability.canRoll ? `<span>Jet ${htmlEscape(formula)} : réussite ≤ ${htmlEscape(successAt)}</span>` : "<span>Capacité narrative</span>";
  const conditionLabel = conditions.length ? `<span>Conditions : ${htmlEscape(conditions.join(", "))}</span>` : "";
  const button = capability.canRoll
    ? `<button type="button" class="a2e-hud-racial-use" data-add2e-racial-capability-id="${htmlEscape(capability.id)}">Utiliser</button>`
    : "<span aria-hidden=\"true\"></span>";
  return `<div class="a2e-hud-racial-row">
  <img src="${htmlEscape(capability.img || capability.icon || "icons/svg/d20.svg")}" alt="">
  <div><div class="a2e-hud-racial-name">${htmlEscape(capability.label)}</div><div class="a2e-hud-racial-meta"><span>Capacité raciale</span>${roll}${conditionLabel}</div><div class="a2e-hud-racial-description">${htmlEscape(capability.description)}</div></div>
  ${button}
</div>`;
}

function racialHudSignature(actor, passives, capabilities) {
  return JSON.stringify({
    actorId: actor?.id ?? "",
    passives: passives.map(effect => [effect.id, effect.name, effect.description]),
    capabilities: capabilities.map(capability => [capability.id, capability.label, capability.description, capability.formula, capability.successAt, capability.requires])
  });
}

function racialHudRender() {
  const root = document.getElementById(ADD2E_RACIAL_HUD_ID);
  const actor = racialHudActor();
  const engine = globalThis.Add2eEffectsEngine;
  if (!root || !actor || typeof engine?.getRacialVirtualEffects !== "function") return;

  racialHudEnsureStyle();
  const passives = engine.getRacialPassiveEffects?.(actor) ?? engine.getRacialVirtualEffects(actor).filter(effect => effect.kind !== "capability");
  const capabilities = engine.getRacialCapabilities?.(actor) ?? [];
  const signature = racialHudSignature(actor, passives, capabilities);

  const effectsSection = root.querySelector('[data-section="effets"]');
  if (effectsSection) {
    const existing = effectsSection.querySelector(':scope > .a2e-hud-racial-effects');
    if (!passives.length) existing?.remove?.();
    else if (existing?.dataset?.add2eRacialHudSignature !== signature) {
      existing?.remove?.();
      const panel = document.createElement("div");
      panel.className = "a2e-hud-racial-panel a2e-hud-racial-effects";
      panel.dataset.add2eRacialHudSignature = signature;
      panel.innerHTML = `<div class="a2e-hud-racial-title"><i class="fas fa-dna"></i> Effets raciaux</div>${passives.map(racialHudPassiveHtml).join("")}`;
      effectsSection.prepend(panel);
    }
  }

  const capabilitiesSection = root.querySelector('[data-section="capacites"]');
  if (capabilitiesSection) {
    const existing = capabilitiesSection.querySelector(':scope > .a2e-hud-racial-capabilities');
    if (!capabilities.length) existing?.remove?.();
    else if (existing?.dataset?.add2eRacialHudSignature !== signature) {
      existing?.remove?.();
      const panel = document.createElement("div");
      panel.className = "a2e-hud-racial-panel a2e-hud-racial-capabilities";
      panel.dataset.add2eRacialHudSignature = signature;
      panel.innerHTML = `<div class="a2e-hud-racial-title"><i class="fas fa-dice-d20"></i> Capacités raciales</div>${capabilities.map(racialHudCapabilityHtml).join("")}`;
      capabilitiesSection.prepend(panel);
    }
  }
}

let racialHudRenderScheduled = false;
let racialHudObservedRoot = null;
let racialHudRootObserver = null;

function racialHudScheduleRender() {
  if (racialHudRenderScheduled) return;
  racialHudRenderScheduled = true;
  const schedule = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  schedule(() => {
    racialHudRenderScheduled = false;
    racialHudRender();
  });
}

function racialHudObserveRoot() {
  const root = document.getElementById(ADD2E_RACIAL_HUD_ID);
  if (root === racialHudObservedRoot) return;
  racialHudRootObserver?.disconnect?.();
  racialHudObservedRoot = root ?? null;
  if (!root) return;
  racialHudRootObserver = new MutationObserver(racialHudScheduleRender);
  racialHudRootObserver.observe(root, { childList: true, subtree: true });
  racialHudScheduleRender();
}

async function racialHudUseCapability(capabilityId) {
  const actor = racialHudActor();
  const engine = globalThis.Add2eEffectsEngine;
  if (!actor || typeof engine?.getRacialCapability !== "function") return false;
  if (!game.user?.isGM && !actor.isOwner && !actor.testUserPermission?.(game.user, "OWNER")) {
    ui.notifications.warn("Vous ne pouvez pas utiliser les capacités de cet acteur.");
    return false;
  }

  const capability = engine.getRacialCapability(actor, capabilityId);
  if (!capability) {
    ui.notifications.warn("Capacité raciale introuvable dans le profil strict de la race.");
    return false;
  }
  if (!capability.canRoll) {
    ui.notifications.warn(`La capacité « ${capability.label} » ne possède pas de jet défini.`);
    return false;
  }

  const conditions = racialHudConditions(capability);
  const conditionText = conditions.length
    ? `<p><strong>Conditions à confirmer :</strong> ${htmlEscape(conditions.join(", "))}.</p>`
    : "";
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) {
    ui.notifications.error("DialogV2 est indisponible.");
    return false;
  }
  const confirmed = await DialogV2.confirm({
    window: { title: `Capacité raciale : ${capability.label}` },
    content: `<p>${htmlEscape(capability.description)}</p><p><strong>Jet :</strong> ${htmlEscape(capability.formula)} — réussite sur ${htmlEscape(capability.successAt)} ou moins.</p>${conditionText}`,
    yes: { label: "Lancer le jet", icon: "fas fa-dice-d20" },
    no: { label: "Annuler" }
  });
  if (!confirmed) return false;

  const result = await engine.rollRacialCapability(actor, capability.id);
  if (!result?.ok) {
    ui.notifications.error("Le jet de capacité raciale n’a pas pu être résolu.");
    return false;
  }

  const outcome = result.success ? "Réussite" : "Échec";
  const color = result.success ? "#1f8f4d" : "#b3261e";
  const content = `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:9px;padding:9px;background:#fffdf6;color:#2c2212;">
  <div style="font-weight:900;color:${color};">${htmlEscape(outcome)} — ${htmlEscape(capability.label)}</div>
  <div style="margin-top:4px;">${htmlEscape(actor.name)} : <strong>${htmlEscape(result.total)}</strong> avec ${htmlEscape(capability.formula)} ; réussite ≤ <strong>${htmlEscape(result.successAt)}</strong>.</div>
  <div style="margin-top:4px;font-size:.88em;">${htmlEscape(capability.description)}</div>
</div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { add2e: { racialCapability: { actorId: actor.id, raceSourceId: capability.sourceId, capabilityId: capability.id, success: result.success } } }
  });
  return true;
}

function installStrictRacialHudBridge() {
  if (globalThis.ADD2E_RACIAL_STRICT_HUD_BRIDGE_INSTALLED || typeof Hooks === "undefined") return;
  globalThis.ADD2E_RACIAL_STRICT_HUD_BRIDGE_INSTALLED = true;
  Hooks.once("ready", () => {
    const bodyObserver = new MutationObserver(() => {
      racialHudObserveRoot();
      racialHudScheduleRender();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", event => {
      const button = event.target?.closest?.("button[data-add2e-racial-capability-id]");
      if (!button || !document.getElementById(ADD2E_RACIAL_HUD_ID)?.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      void racialHudUseCapability(button.dataset.add2eRacialCapabilityId);
    }, true);
    for (const hookName of ["controlToken", "updateActor", "createItem", "updateItem", "deleteItem"]) {
      Hooks.on(hookName, () => {
        racialHudObserveRoot();
        racialHudScheduleRender();
      });
    }
    racialHudObserveRoot();
    racialHudScheduleRender();
    window.setTimeout(() => { racialHudObserveRoot(); racialHudScheduleRender(); }, 120);
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
  installStrictRacialEffectsSheetBridge();
  installStrictRacialHudBridge();
  installRacialImmunityAliases(Engine);
}
