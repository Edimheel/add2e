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

function clone(value) {
  try { return foundry.utils.deepClone(value); } catch {}
  try { return foundry.utils.duplicate(value); } catch {}
  return JSON.parse(JSON.stringify(value));
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
      sourceName: `Race - ${sourceName}`,
      virtual: true,
      readonly: true,
      racial: true
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
      sourceName: `Race - ${sourceName}`,
      virtual: true,
      readonly: true,
      racial: true,
      capabilityId: kind === "capability" ? key : ""
    });
  };
  for (const passive of records(context.profile.passives)) add(passive, "passive");
  for (const capability of records(context.profile.capabilities)) add(capability, "capability");
  return entries;
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
  installRacialImmunityAliases(Engine);
}
