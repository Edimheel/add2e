// ADD2E — Effects Engine / effets temporaires génériques.
// Compatible Foundry V13/V14/V15.

import { add2eTimeEffectData } from "../add2e/19a-time-engine.mjs";

export const ADD2E_GENERIC_EFFECTS_VERSION = "2026-07-15-generic-timed-effects-v1";
globalThis.ADD2E_GENERIC_EFFECTS_VERSION = ADD2E_GENERIC_EFFECTS_VERSION;

const Engine = globalThis.Add2eEffectsEngine;
if (!Engine) throw new Error("[ADD2E][EFFECTS_ENGINE] Add2eEffectsEngine indisponible pour 60-generic-effects.mjs");

const esc = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const clone = value => {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
};

const normalize = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

function contextActor(context = {}) {
  return context.actor ?? context.args?.[0]?.actor ?? null;
}

function contextItem(context = {}) {
  return context.sourceItem ?? context.item ?? context.args?.[0]?.sourceItem ?? context.args?.[0]?.item ?? null;
}

function actorLevel(actor) {
  return Number(actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.details?.niveau ?? 0) || 0;
}

async function rollFormula(formula, actor, flavor) {
  const roll = await new Roll(String(formula || "0")).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  return { roll, total: Number(roll.total) || 0 };
}

async function postChat(actor, title, html, item = null) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-chat-card add2e-generic-effect" style="border:1px solid #7a4b19;border-radius:8px;overflow:hidden;background:#fff8e7;color:#38250d;">
      <div style="display:flex;align-items:center;gap:8px;background:#8b5a22;color:#fff;padding:7px 9px;">
        <img src="${esc(item?.img || actor?.img || "icons/svg/aura.svg")}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #ead8ad;background:#fff;">
        <div style="font-weight:900;">${esc(title)}</div>
      </div>
      <div style="padding:9px 10px;line-height:1.35;">${html}</div>
    </div>`
  });
}

function selectedActors(actor, selfOnly = false) {
  if (selfOnly) return actor ? [actor] : [];
  const targets = Array.from(game.user?.targets ?? []).map(token => token.actor).filter(Boolean);
  return targets.length ? targets : (actor ? [actor] : []);
}

async function confirmConfiguredEffect(config, targets, durationLabel) {
  if (!config.confirm) return true;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) throw new Error("DialogV2 est indisponible.");
  return DialogV2.confirm({
    window: { title: config.name || "Effet" },
    modal: true,
    content: `<div class="add2e-dialog"><p><b>${esc(config.name || "Effet")}</b></p><p>Cible(s) : <b>${esc(targets.map(target => target.name).join(", ") || "aucune")}</b></p><p>Durée : <b>${esc(durationLabel)}</b></p>${config.saveNote ? `<p>${esc(config.saveNote)}</p>` : ""}<p>Appliquer l’effet ?</p></div>`,
    yes: { label: "Appliquer", icon: "fa-solid fa-check" },
    no: { label: "Annuler", icon: "fa-solid fa-xmark" }
  });
}

function rulesFromEffect(effect) {
  if (!effect || effect.disabled) return [];
  const raw = effect.flags?.add2e?.rules ?? [];
  if (typeof Engine.toRules === "function") return Engine.toRules(raw);
  return Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? [raw] : []);
}

function characteristicOverrides(actor, characteristic) {
  const key = normalize(characteristic);
  const rows = [];
  for (const effect of actor?.effects?.contents ?? actor?.effects ?? []) {
    for (const rule of rulesFromEffect(effect)) {
      const kind = normalize(rule?.kind ?? rule?.type ?? rule?.ruleType);
      const ability = normalize(rule?.characteristic ?? rule?.ability ?? rule?.caracteristique);
      const value = Number(rule?.value ?? rule?.score ?? rule?.total);
      if (kind !== "characteristic_override" || ability !== key || !Number.isFinite(value)) continue;
      rows.push({ value, priority: Number(rule?.priority ?? 0) || 0, effect, rule });
    }
  }
  return rows.sort((a, b) => b.priority - a.priority);
}

async function createTimedEffect({ actor, name, img = null, sourceItem = null, rounds = 0, unit = "round", description = "", tags = [], rules = [], endMessage = null, silentExpiration = false, extraFlags = {} } = {}) {
  if (!actor) throw new Error("Acteur introuvable pour l’effet temporaire.");
  const data = add2eTimeEffectData({
    name,
    img: img || sourceItem?.img,
    origin: sourceItem?.uuid ?? null,
    rounds,
    unit,
    description,
    tags,
    changes: [],
    source: "objet_magique",
    caster: actor,
    sourceItem,
    endMessage,
    silentExpiration,
    extraFlags: {
      rules: clone(rules),
      genericEffect: true,
      genericEffectsVersion: ADD2E_GENERIC_EFFECTS_VERSION,
      ...clone(extraFlags)
    }
  });
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  return effect ?? null;
}

async function createTimedCharacteristicEffect({ actor, characteristic, value, priority = 100, ...options } = {}) {
  const normalized = normalize(characteristic);
  if (!normalized || !Number.isFinite(Number(value))) throw new Error("Override de caractéristique invalide.");
  const rules = [
    ...(Array.isArray(options.rules) ? options.rules : []),
    { kind: "characteristic_override", characteristic: normalized, value: Number(value), priority: Number(priority) || 0 }
  ];
  return createTimedEffect({
    ...options,
    actor,
    rules,
    extraFlags: {
      ...(options.extraFlags ?? {}),
      characteristicEffect: true,
      characteristic: normalized,
      characteristicValue: Number(value)
    }
  });
}

function hpDescriptor(actor) {
  const s = actor?.system ?? {};
  const candidates = [
    { valuePath: "system.pdv", value: s.pdv, max: s.points_de_coup },
    { valuePath: "system.pv.value", value: s?.pv?.value, max: s?.pv?.max },
    { valuePath: "system.hp.value", value: s?.hp?.value, max: s?.hp?.max },
    { valuePath: "system.points_de_vie.value", value: s?.points_de_vie?.value, max: s?.points_de_vie?.max }
  ];
  return candidates.find(row => Number.isFinite(Number(row.value))) ?? null;
}

async function applyHealing(context, config) {
  const actor = contextActor(context);
  const item = contextItem(context);
  if (!actor) return false;
  const { total } = await rollFormula(config.formula, actor, config.name);
  const hp = hpDescriptor(actor);
  if (!hp) {
    await postChat(actor, config.name, `<p>Soins obtenus : <b>${total}</b>. Aucun champ de points de vie compatible n’a été trouvé.</p>`, item);
    return true;
  }
  const before = Number(hp.value) || 0;
  const maximum = Number.isFinite(Number(hp.max)) ? Number(hp.max) : before + total;
  const after = Math.min(maximum, before + total);
  await actor.update({ [hp.valuePath]: after }, { add2eInternal: true, add2eReason: "generic-healing-effect" });
  await postChat(actor, config.name, `<p>Points de vie : <b>${before} → ${after}</b>.</p><p>Soins effectifs : <b>${after - before}</b>.</p>`, item);
  return true;
}

async function applyAgeReduction(context, config) {
  const actor = contextActor(context);
  const item = contextItem(context);
  if (!actor) return false;
  const { total } = await rollFormula(config.formula, actor, config.name);
  const s = actor.system ?? {};
  const candidates = [
    ["system.age", s.age],
    ["system.details.age", s?.details?.age],
    ["system.age_actuel", s.age_actuel]
  ];
  const target = candidates.find(([, value]) => Number.isFinite(Number(value)));
  if (target) {
    const [path, value] = target;
    const after = Math.max(0, Number(value) - total);
    await actor.update({ [path]: after }, { add2eInternal: true, add2eReason: "generic-age-reduction" });
    await postChat(actor, config.name, `<p>Âge : <b>${value} → ${after}</b>.</p>`, item);
  } else {
    await createTimedEffect({
      actor,
      name: config.name,
      img: item?.img,
      sourceItem: item,
      description: config.description || "",
      tags: ["age_reduction"],
      rules: [{ kind: "age_reduction", value: total }],
      extraFlags: { permanentUntilResolved: true }
    });
    await postChat(actor, config.name, `<p>Réduction d’âge à appliquer : <b>${total}</b> an(s).</p>`, item);
  }
  return true;
}

async function durationFromConfig(actor, config) {
  if (config.durationFormula) {
    const rolled = await rollFormula(config.durationFormula, actor, `${config.name} — durée`);
    return Math.max(0, rolled.total * (Number(config.durationMultiplier) || 1));
  }
  return Math.max(0, Number(config.durationRounds) || 0);
}

async function applyTimedConfiguredEffect(context, config) {
  const actor = contextActor(context);
  const item = contextItem(context);
  if (!actor) return false;
  const rounds = await durationFromConfig(actor, config);
  const targets = selectedActors(actor, config.selfOnly === true);
  if (!targets.length) return false;
  const durationLabel = rounds > 0 ? `${rounds} round(s)` : "jusqu’à suppression";
  if (!await confirmConfiguredEffect(config, targets, durationLabel)) return false;
  for (const target of targets) {
    await createTimedEffect({
      actor: target,
      name: config.name,
      img: item?.img,
      sourceItem: item,
      rounds,
      description: config.description || config.rule || "",
      tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
      rules: config.rules ?? [],
      endMessage: config.endMessage ?? `L’effet ${config.name} prend fin sur {actor}.`,
      extraFlags: { potion: true, potionSlug: config.slug, ...(config.extraFlags ?? {}) }
    });
  }
  await postChat(actor, config.name, `<p>Effet appliqué à : <b>${esc(targets.map(target => target.name).join(", "))}</b>.</p><p>Durée : <b>${esc(durationLabel)}</b>.</p>${config.rule ? `<p>${esc(config.rule)}</p>` : ""}`, item);
  return true;
}

async function applyHeroism(context, config) {
  const actor = contextActor(context);
  const item = contextItem(context);
  if (!actor) return false;
  const level = actorLevel(actor);
  if (level >= Number(config.maxLevelExclusive ?? Infinity)) {
    ui.notifications.warn(`${config.name} est sans effet sur un personnage de niveau ${level}.`);
    return false;
  }
  const row = (config.levelTable ?? []).find(entry => level >= Number(entry.min) && level <= Number(entry.max)) ?? null;
  if (!row) return false;
  const hpRoll = await rollFormula(row.hpDice, actor, `${config.name} — points de vie temporaires`);
  const rounds = await durationFromConfig(actor, config);
  await createTimedEffect({
    actor,
    name: config.name,
    img: item?.img,
    sourceItem: item,
    rounds,
    description: config.description || "",
    tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
    rules: [
      { kind: "temporary_levels", value: Number(row.bonus) || 0 },
      { kind: "temporary_hp", value: hpRoll.total }
    ],
    endMessage: `L’effet ${config.name} prend fin sur {actor}.`,
    extraFlags: { potion: true, potionSlug: config.slug, temporaryLevels: Number(row.bonus) || 0, temporaryHp: hpRoll.total }
  });
  await postChat(actor, config.name, `<p>Niveaux temporaires : <b>+${Number(row.bonus) || 0}</b>.</p><p>Points de vie temporaires : <b>${hpRoll.total}</b>.</p>${rounds ? `<p>Durée : <b>${rounds} round(s)</b>.</p>` : ""}`, item);
  return true;
}

async function applyDeception(context, config) {
  const actor = contextActor(context);
  const item = contextItem(context);
  if (!actor) return false;
  await createTimedEffect({
    actor,
    name: config.name,
    img: item?.img,
    sourceItem: item,
    description: config.description || "",
    tags: ["objet_magique", "potion", `potion:${config.slug}`, "tromperie"],
    rules: [{ kind: "deception", apparentEffect: config.apparentEffect || "soins" }],
    extraFlags: { potion: true, potionSlug: config.slug, deceptivePotion: true, apparentEffect: config.apparentEffect || "soins" }
  });
  await postChat(actor, config.name, "<p>Le consommateur croit que la potion a produit l’effet attendu. Aucun bénéfice réel n’est appliqué.</p>", item);
  return true;
}

async function applyConfiguredEffect(context, config = {}) {
  if (config.kind === "healing") return applyHealing(context, config);
  if (config.kind === "age") return applyAgeReduction(context, config);
  if (config.kind === "heroism") return applyHeroism(context, config);
  if (config.kind === "deception") return applyDeception(context, config);
  return applyTimedConfiguredEffect(context, config);
}

Object.defineProperties(Engine, {
  getCharacteristicOverride: { configurable: true, writable: true, value(actor, characteristic) { return characteristicOverrides(actor, characteristic)[0] ?? null; } },
  getEffectiveCharacteristic: { configurable: true, writable: true, value(actor, characteristic, fallback = 0) { return this.getCharacteristicOverride(actor, characteristic)?.value ?? Number(fallback) ?? 0; } },
  createTimedEffect: { configurable: true, writable: true, value: createTimedEffect },
  createTimedCharacteristicEffect: { configurable: true, writable: true, value: createTimedCharacteristicEffect },
  applyConfiguredEffect: { configurable: true, writable: true, value: applyConfiguredEffect },
  applyHealing: { configurable: true, writable: true, value: applyHealing },
  applyAgeReduction: { configurable: true, writable: true, value: applyAgeReduction },
  postGenericEffectChat: { configurable: true, writable: true, value: postChat }
});

function effectHasCharacteristicOverride(effect) {
  return rulesFromEffect(effect).some(rule => normalize(rule?.kind ?? rule?.type) === "characteristic_override");
}

function characteristicTable(key) {
  return {
    force: globalThis.FORCE_TABLE,
    dexterite: globalThis.DEXTERITE_TABLE,
    constitution: globalThis.CONSTITUTION_TABLE,
    intelligence: globalThis.INTELLIGENCE_TABLE,
    sagesse: globalThis.SAGESSE_TABLE,
    charisme: globalThis.CHARISME_TABLE
  }[key] ?? null;
}

async function applyCharacteristicOverridesToDerived(actor) {
  if (!actor?.system || actor.__add2eCharacteristicOverrideInProgress) return false;
  const overrides = {};
  for (const key of ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"]) {
    const row = Engine.getCharacteristicOverride(actor, key);
    if (row) overrides[key] = row.value;
  }
  if (!Object.keys(overrides).length) return false;

  actor.__add2eCharacteristicOverrideInProgress = true;
  try {
    const update = {};
    if (Number.isFinite(overrides.force)) {
      const bonus = characteristicTable("force")?.[overrides.force] ?? {};
      update["system.for_aff"] = overrides.force;
      update["system.force_bonus_toucher"] = Number(bonus.toucher || 0);
      update["system.force_bonus_degats"] = Number(bonus.degats || 0);
      update["system.force_poids"] = bonus.poids ?? 0;
      update["system.force_ouvrir"] = bonus.ouvrir ?? "—";
      update["system.force_tordre"] = bonus.tordre ?? "—";
      update["system.force_bonus_porte"] = bonus.ouvrir ?? "—";
      update["system.charge_max"] = typeof bonus.poids === "number" ? bonus.poids : 0;
      update["system.charge_max_bench"] = typeof bonus.poids === "number" ? bonus.poids : 0;
    }
    if (Number.isFinite(overrides.dexterite)) {
      const bonus = characteristicTable("dexterite")?.[overrides.dexterite] ?? {};
      update["system.dex_aff"] = overrides.dexterite;
      update["system.dex_att"] = Number(bonus.att || 0);
      update["system.dex_def"] = Number(bonus.def || 0);
    }
    if (Number.isFinite(overrides.constitution)) {
      const bonus = characteristicTable("constitution")?.[overrides.constitution] ?? {};
      update["system.con_aff"] = overrides.constitution;
      update["system.con_pv"] = Number(bonus.pv || 0);
      update["system.con_trauma"] = Number(bonus.trauma || 0);
      update["system.con_resu"] = Number(bonus.resu || 0);
    }
    if (Number.isFinite(overrides.intelligence)) {
      const bonus = characteristicTable("intelligence")?.[overrides.intelligence] ?? {};
      update["system.int_aff"] = overrides.intelligence;
      update["system.int_langues"] = Number(bonus.langues || 0);
      update["system.int_chance_sort"] = Number(bonus.chance_sort || 0);
      update["system.int_min_sort"] = Number(bonus.min_sort || 0);
      update["system.int_max_sort"] = Number(bonus.max_sort || 0);
      update["system.int_sort_par_niveau"] = Number(bonus.sort_par_niveau || 0);
    }
    if (Number.isFinite(overrides.sagesse)) {
      const bonus = characteristicTable("sagesse")?.[overrides.sagesse] ?? {};
      update["system.sag_aff"] = overrides.sagesse;
      update["system.sag_magie"] = Number(bonus.magie || 0);
      update["system.sag_sort_suppl"] = Number(bonus.sort_suppl || 0);
      update["system.sag_echec"] = Number(bonus.echec || 0);
    }
    if (Number.isFinite(overrides.charisme)) {
      const bonus = characteristicTable("charisme")?.[overrides.charisme] ?? {};
      update["system.cha_aff"] = overrides.charisme;
      update["system.cha_compagnons"] = Number(bonus.compagnons || 0);
      update["system.cha_loy"] = Number(bonus.loy || 0);
      update["system.cha_react"] = Number(bonus.react || 0);
    }
    const diff = {};
    for (const [path, value] of Object.entries(update)) {
      if (foundry.utils.getProperty(actor, path) !== value) diff[path] = value;
    }
    if (Object.keys(diff).length) await actor.update(diff, { add2eInternal: true, add2eReason: "generic-characteristic-override", render: false });
    globalThis.add2eRerenderActorSheet?.(actor, true);
    return true;
  } finally {
    actor.__add2eCharacteristicOverrideInProgress = false;
  }
}

function installSheetBridge() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  const base = proto?.autoSetCaracAjustements;
  if (typeof base !== "function" || base.__add2eGenericCharacteristicBridge) return false;
  const wrapped = async function add2eAutoSetCaracAjustementsWithGenericEffects(...args) {
    const result = await base.apply(this, args);
    await applyCharacteristicOverridesToDerived(this.actor);
    return result;
  };
  wrapped.__add2eGenericCharacteristicBridge = true;
  wrapped.__add2eBase = base;
  proto.autoSetCaracAjustements = wrapped;
  return true;
}

function scheduleCharacteristicRefresh(effect) {
  if (!effectHasCharacteristicOverride(effect)) return;
  const actor = effect.parent?.documentName === "Actor" ? effect.parent : null;
  if (!actor) return;
  setTimeout(async () => {
    if (!installSheetBridge()) {
      // Le pont peut déjà être installé ; le recalcul reste nécessaire.
    }
    if (typeof actor.sheet?.autoSetCaracAjustements === "function") await actor.sheet.autoSetCaracAjustements();
    else await applyCharacteristicOverridesToDerived(actor);
  }, 20);
}

Hooks.once("ready", () => installSheetBridge());
Hooks.on("createActiveEffect", effect => scheduleCharacteristicRefresh(effect));
Hooks.on("updateActiveEffect", effect => scheduleCharacteristicRefresh(effect));
Hooks.on("deleteActiveEffect", effect => scheduleCharacteristicRefresh(effect));
