// ADD2E — Actor sheet listeners : jets de caractéristiques, sauvegardes et HUD.
// Compatible Foundry V13/V14/V15.

export const ADD2E_SHEET_ROLL_DELEGATION_VERSION = "2026-07-23-canonical-save-executor-v4";
const ADD2E_SAVE_RESOLVER_VERSION = "2026-07-23-canonical-save-resolver-v2";

const ADD2E_SAVE_DEFINITIONS = Object.freeze([
  Object.freeze({
    index: 0,
    key: "mort_paralysie",
    label: "Paralysie / poison / mort magique",
    shortLabel: "Paralysie",
    icon: "fas fa-skull-crossbones",
    aliases: Object.freeze(["mort_paralysie", "mort", "mort_magique", "paralysie", "poison", "death", "paralysis"])
  }),
  Object.freeze({
    index: 1,
    key: "petrification",
    label: "Pétrification / polymorphose",
    shortLabel: "Pétrification",
    icon: "fas fa-gem",
    aliases: Object.freeze(["petrification", "polymorphose", "polymorph", "metamorphose", "transformation"])
  }),
  Object.freeze({
    index: 2,
    key: "baguettes",
    label: "Baguettes et badines",
    shortLabel: "Baguettes",
    icon: "fas fa-magic",
    aliases: Object.freeze(["baguette", "baguettes", "badine", "badines", "baton", "batons", "batonnet", "batonnets", "wand", "wands", "rod", "rods", "staff", "staves"])
  }),
  Object.freeze({
    index: 3,
    key: "souffle",
    label: "Souffles",
    shortLabel: "Souffles",
    icon: "fas fa-fire",
    aliases: Object.freeze(["souffle", "souffles", "breath", "breath_weapon", "breath_weapons"])
  }),
  Object.freeze({
    index: 4,
    key: "sorts",
    label: "Sortilèges",
    shortLabel: "Sorts",
    icon: "fas fa-scroll",
    aliases: Object.freeze(["sort", "sorts", "sortilege", "sortileges", "spell", "spells", "magie", "magic"])
  })
]);

const ADD2E_SAVE_EQUIPMENT_TYPES = new Set([
  "arme", "weapon", "armure", "armor", "objet", "object",
  "equipment", "magic", "objet_magique"
]);

export async function add2eEvaluateRollSafe(formula) {
  const roll = new Roll(formula);
  await roll.evaluate();
  return roll;
}

function add2eSheetRollEffectsEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine) return null;
  add2eInstallCanonicalSaveResolver(engine);
  return engine;
}

function add2eSaveNormalize(engine, value) {
  const raw = typeof engine?.normalizeTag === "function"
    ? engine.normalizeTag(value)
    : String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return String(raw ?? "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSaveTag(engine, value) {
  return typeof engine?.normalizeTag === "function"
    ? String(engine.normalizeTag(value) ?? "")
    : String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

function add2eSaveDefinition(engine, value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < ADD2E_SAVE_DEFINITIONS.length) {
    return ADD2E_SAVE_DEFINITIONS[numeric];
  }
  const normalized = add2eSaveNormalize(engine, value);
  if (!normalized) return null;
  return ADD2E_SAVE_DEFINITIONS.find(definition =>
    definition.key === normalized || definition.aliases.includes(normalized)
  ) ?? null;
}

function add2eSaveReadNumber(engine, ...values) {
  if (typeof engine?.readNumber === "function") return engine.readNumber(...values);
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function add2eSaveReadFromCollection(engine, raw, definition) {
  if (!definition || raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    const value = add2eSaveReadNumber(engine, raw[definition.index]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof raw !== "object") return null;

  const accepted = new Set([definition.key, ...definition.aliases, `save${definition.index}`]);
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    if (!accepted.has(add2eSaveNormalize(engine, rawKey))) continue;
    const value = add2eSaveReadNumber(engine, rawValue);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function add2eSaveClassSources(engine, actor, definition) {
  const sources = [];
  const classItems = typeof engine.getEmbeddedClassItems === "function"
    ? engine.getEmbeddedClassItems(actor)
    : Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");

  for (const classItem of classItems) {
    const classLevel = typeof engine.getEmbeddedClassLevel === "function"
      ? engine.getEmbeddedClassLevel(classItem)
      : add2eSaveReadNumber(engine, classItem?.system?.niveau, classItem?.system?.level);

    let progression = null;
    if (typeof engine.getClassProgressionEntryForPassiveRule === "function") {
      progression = engine.getClassProgressionEntryForPassiveRule({
        progression: "progression",
        source: {
          actor,
          classItemId: classItem?.id ?? null,
          classItemUuid: classItem?.uuid ?? null,
          className: classItem?.name ?? classItem?.system?.label ?? "Classe",
          classLevel
        }
      }, { actor });
    }

    if (!progression) {
      const rows = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
      progression = rows.find(row => Number(row?.niveau ?? row?.level) === Number(classLevel))
        ?? rows[Math.max(0, Math.min(rows.length - 1, Number(classLevel || 1) - 1))]
        ?? null;
    }

    const target = add2eSaveReadFromCollection(engine,
      progression?.savingThrows
        ?? progression?.saves
        ?? progression?.jets_sauvegarde
        ?? progression?.sauvegardes,
      definition
    );
    if (!Number.isFinite(target) || target <= 0) continue;

    sources.push({
      kind: "class",
      target,
      classItem,
      className: classItem?.name ?? classItem?.system?.label ?? "Classe",
      classLevel: Number(classLevel) || null,
      progression
    });
  }
  return sources;
}

function add2eSaveActorSource(engine, actor, definition) {
  const system = actor?.system ?? {};
  for (const raw of [
    system.sauvegardes,
    system.savingThrows,
    system.saves,
    system.jets_sauvegarde,
    system.defense?.savingThrows,
    system.combat?.savingThrows
  ]) {
    const target = add2eSaveReadFromCollection(engine, raw, definition);
    if (Number.isFinite(target) && target > 0) {
      return { kind: "actor", target, actor, name: actor?.name ?? "Acteur" };
    }
  }
  return null;
}

function add2eSaveTargetResolution(engine, actor, definition) {
  const classSources = add2eSaveClassSources(engine, actor, definition);
  const actorSource = add2eSaveActorSource(engine, actor, definition);
  const candidates = classSources.length ? classSources : (actorSource ? [actorSource] : []);
  const selected = [...candidates].sort((left, right) => Number(left.target) - Number(right.target))[0] ?? null;
  return {
    definition,
    target: Number(selected?.target),
    selected,
    candidates,
    classSources,
    actorSource,
    source: classSources.length ? "classes" : actorSource ? "actor" : "none"
  };
}

function add2eSaveTagMatches(engine, definition, matcher) {
  const normalized = add2eSaveNormalize(engine, matcher);
  return normalized === "all"
    || normalized === "tout"
    || normalized === definition.key
    || definition.aliases.includes(normalized);
}

function add2eSaveConstitutionBonus(engine, actor) {
  const total = typeof engine.resolveAbility === "function"
    ? Number(engine.resolveAbility(actor, "constitution", { type: "save", source: "saving-throw" })?.total)
    : add2eSaveReadNumber(engine, actor?.system?.constitution_base, actor?.system?.constitution);
  if (!Number.isFinite(total)) return 0;
  return Math.max(0, Math.min(5, Math.floor(total / 3.5)));
}

function add2eSaveLegacyTagModifiers(engine, actor, definition, context = {}) {
  const modifiers = [];
  const tags = typeof engine.getActiveTags === "function" ? engine.getActiveTags(actor) : [];
  const push = ({ tag, value, label, suffix }) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0) return;
    modifiers.push(engine.createModifier({
      id: `${actor.id}:save:${definition.key}:${suffix}:${tag}`,
      domain: "save",
      target: definition.key,
      operation: "add",
      value: amount,
      priority: 100,
      stacking: { mode: "stack", group: null },
      source: {
        kind: "legacy-save-tag",
        id: `${actor.id}:${tag}`,
        uuid: actor.uuid ?? "",
        name: actor.name ?? "Acteur"
      },
      metadata: { label, sourceTag: tag, producer: "legacy-save-tag" }
    }));
  };

  for (const rawTag of tags) {
    const tag = add2eSaveTag(engine, rawTag);
    if (!tag) continue;

    if (tag.startsWith("bonus_save:")) {
      push({ tag, value: Number(tag.split(":").at(-1)), label: "Bonus général de sauvegarde", suffix: "general" });
      continue;
    }
    if (context.frontale === true && tag.startsWith("bonus_save_frontal:")) {
      push({ tag, value: Number(tag.split(":").at(-1)), label: "Bonus frontal de sauvegarde", suffix: "frontal" });
      continue;
    }
    if (!tag.startsWith("bonus_save_vs:")) continue;

    const parts = tag.split(":");
    const rawValue = parts.at(-1);
    const matcher = parts.slice(1, -1).join(":");
    if (!add2eSaveTagMatches(engine, definition, matcher)) continue;

    if (rawValue === "const") {
      push({
        tag,
        value: add2eSaveConstitutionBonus(engine, actor),
        label: `Bonus racial de Constitution contre ${definition.shortLabel.toLowerCase()}`,
        suffix: "constitution"
      });
    } else {
      push({
        tag,
        value: Number(rawValue),
        label: `Bonus de sauvegarde contre ${definition.shortLabel.toLowerCase()}`,
        suffix: "conditional"
      });
    }
  }
  return modifiers;
}

function add2eSaveCanonicalModifiers(engine, actor, definition, context = {}) {
  const collected = typeof engine.collect === "function" ? engine.collect(actor, context) : [];
  const modifiers = [];

  for (const raw of collected) {
    const normalized = engine.normalizeModifier(raw, { source: raw?.source });
    if (!normalized || normalized.domain !== "save") continue;

    const sourceContext = raw?._context ?? {};
    const sourceItem = sourceContext.sourceItem ?? null;
    const sourceType = String(sourceItem?.type ?? "").toLowerCase();
    if (sourceItem && ADD2E_SAVE_EQUIPMENT_TYPES.has(sourceType) && !engine.itemEquipped(sourceItem)) continue;

    const target = add2eSaveNormalize(engine, normalized.target);
    if (target !== "all" && target !== "tout" && !add2eSaveTagMatches(engine, definition, target)) continue;
    modifiers.push({
      ...normalized,
      target: target === "all" || target === "tout" ? "all" : definition.key,
      _context: sourceContext
    });
  }
  return modifiers;
}

function add2eSaveDeduplicate(modifiers = []) {
  const seen = new Set();
  return modifiers.filter(modifier => {
    if (!modifier) return false;
    const source = modifier.source ?? {};
    const key = JSON.stringify([
      modifier.id,
      modifier.domain,
      modifier.target,
      modifier.operation,
      modifier.value,
      modifier.priority,
      modifier.stacking?.mode,
      modifier.stacking?.group,
      source.uuid ?? source.id ?? source.name ?? ""
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2eResolveSavingThrow(engine, actor, saveType, context = {}) {
  if (!actor) throw new Error("Acteur manquant pour la résolution du jet de sauvegarde.");
  const definition = add2eSaveDefinition(engine, saveType);
  if (!definition) throw new Error(`Catégorie de sauvegarde inconnue : ${saveType}`);

  const targetResolution = add2eSaveTargetResolution(engine, actor, definition);
  const saveContext = {
    ...context,
    actor,
    type: "save",
    actionType: "save",
    saveType: definition.key,
    saveCategory: definition.key,
    saveIndex: definition.index,
    source: context.source ?? "canonical-save-resolver"
  };
  const canonical = add2eSaveCanonicalModifiers(engine, actor, definition, saveContext);
  const canonicalSourceTags = new Set(canonical.map(modifier => String(modifier?.metadata?.sourceTag ?? "")).filter(Boolean));
  const legacy = add2eSaveLegacyTagModifiers(engine, actor, definition, saveContext)
    .filter(modifier => !canonicalSourceTags.has(String(modifier?.metadata?.sourceTag ?? "")));
  const bonusResolution = engine.resolve(actor, {
    domain: "save",
    target: definition.key,
    base: 0,
    context: saveContext,
    modifiers: add2eSaveDeduplicate([...canonical, ...legacy])
  });

  return {
    definition,
    index: definition.index,
    key: definition.key,
    label: definition.label,
    target: targetResolution.target,
    targetResolution,
    bonus: Number(bonusResolution.total) || 0,
    bonusResolution,
    context: saveContext,
    version: ADD2E_SAVE_RESOLVER_VERSION
  };
}

async function add2eRollSavingThrow(engine, actor, saveType, options = {}) {
  const {
    createChat = false,
    showDice = true,
    source = "canonical-save-executor",
    ...context
  } = options ?? {};

  if (!actor) {
    return {
      ok: false,
      canRoll: false,
      reason: "missing-actor",
      actor: null,
      resolution: null,
      roll: null,
      d20: null,
      bonus: 0,
      total: null,
      target: null,
      threshold: null,
      success: false,
      chatMessage: null,
      version: ADD2E_SAVE_RESOLVER_VERSION
    };
  }

  const resolution = engine.resolveSavingThrow(actor, saveType, { ...context, source });
  const target = Number(resolution?.target);
  if (!Number.isFinite(target) || target <= 0) {
    return {
      ok: false,
      canRoll: false,
      reason: "missing-target",
      actor,
      resolution,
      roll: null,
      d20: null,
      bonus: Number(resolution?.bonus) || 0,
      total: null,
      target: null,
      threshold: null,
      success: false,
      chatMessage: null,
      version: ADD2E_SAVE_RESOLVER_VERSION
    };
  }

  const roll = await add2eEvaluateRollSafe("1d20");
  if (showDice !== false && game.dice3d) await game.dice3d.showForRoll(roll);
  const d20 = Number(roll.total) || 0;
  const bonus = Number(resolution.bonus) || 0;
  const total = d20 + bonus;
  const success = total >= target;
  const result = {
    ok: true,
    canRoll: true,
    reason: "rolled",
    actor,
    resolution,
    roll,
    d20,
    bonus,
    total,
    target,
    threshold: target,
    success,
    chatMessage: null,
    version: ADD2E_SAVE_RESOLVER_VERSION
  };

  if (createChat === true) {
    result.chatMessage = await add2eCreateSavingThrowCard({ actor, roll, resolution, total, success });
  }
  return result;
}

function add2eInstallCanonicalSaveResolver(engine) {
  if (!engine || engine.__add2eCanonicalSaveResolverVersion === ADD2E_SAVE_RESOLVER_VERSION) return engine;
  Object.defineProperties(engine, {
    resolveSavingThrow: {
      configurable: true,
      writable: true,
      value(actor, saveType, context = {}) {
        return add2eResolveSavingThrow(this, actor, saveType, context);
      }
    },
    rollSavingThrow: {
      configurable: true,
      writable: true,
      value(actor, saveType, options = {}) {
        return add2eRollSavingThrow(this, actor, saveType, options);
      }
    },
    getSaveTarget: {
      configurable: true,
      writable: true,
      value(actor, saveType) {
        return this.resolveSavingThrow(actor, saveType, { source: "get-save-target" }).target;
      }
    },
    getSaveBonus: {
      configurable: true,
      writable: true,
      value(actor, saveType, options = {}) {
        return this.resolveSavingThrow(actor, saveType, {
          ...options,
          source: options.source ?? "get-save-bonus"
        }).bonus;
      }
    }
  });
  engine.__add2eCanonicalSaveResolverVersion = ADD2E_SAVE_RESOLVER_VERSION;
  globalThis.ADD2E_SAVE_RESOLVER_VERSION = ADD2E_SAVE_RESOLVER_VERSION;
  return engine;
}

function add2eSaveSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eSaveSourceLabel(resolution) {
  const selected = resolution?.targetResolution?.selected;
  if (selected?.kind === "class") {
    return [selected.className, selected.classLevel ? `niveau ${selected.classLevel}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return selected?.name ?? "Valeur de l’acteur";
}

function add2eSaveModifierLabel(entry) {
  const modifier = entry?.modifier ?? entry;
  const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur").trim();
  const value = modifier?.operation === "add"
    ? add2eSaveSigned(modifier.value)
    : String(entry?.contribution ?? modifier?.value ?? "");
  return `${label} ${value}`.trim();
}

async function add2eCreateSavingThrowCard({ actor, roll, resolution, total, success }) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes de chat ADD2E n’est pas disponible.");
  }

  const applied = resolution.bonusResolution?.applied ?? [];
  const options = {
    actor,
    title: resolution.label,
    icon: resolution.definition.icon,
    variant: success ? "success" : "failure",
    source: {
      name: actor.name,
      img: actor.img,
      type: "Jet de sauvegarde",
      meta: add2eSaveSourceLabel(resolution)
    },
    rows: [
      { label: "Seuil", value: resolution.target },
      { label: "D20", value: Number(roll.total) || 0 },
      { label: "Modificateurs", value: add2eSaveSigned(resolution.bonus) },
      { label: "Total", value: total },
      { label: "Détail", value: applied.length ? applied.map(add2eSaveModifierLabel).join(" ; ") : "Aucun" }
    ],
    message: success ? "Réussite du jet de sauvegarde." : "Échec du jet de sauvegarde.",
    chatData: {
      rolls: [roll],
      flags: {
        add2e: {
          saveRoll: true,
          saveType: resolution.key,
          saveIndex: resolution.index,
          saveTarget: resolution.target,
          saveBonus: resolution.bonus,
          saveTotal: total,
          saveSuccess: success,
          saveResolverVersion: ADD2E_SAVE_RESOLVER_VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte de sauvegarde ADD2E n’a pas pu être construite.");
  return globalThis.add2eCreateChatCard(options);
}

export async function add2eRollCharacteristicCard(actor, carac) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  const label = carac?.toUpperCase() || "Caractéristique";
  const val = Number(actor.system?.[carac]) || 10;
  const roll = await add2eEvaluateRollSafe("1d20");
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const icons = { force: "fa-dumbbell", dexterite: "fa-running", constitution: "fa-heartbeat", intelligence: "fa-brain", sagesse: "fa-eye", charisme: "fa-theater-masks" };
  const colors = { force: "#4ab878", dexterite: "#f3aa3c", constitution: "#e74c3c", intelligence: "#2980b9", sagesse: "#9b59b6", charisme: "#e056fd" };
  const icon = icons[carac] || "fa-dice-d20";
  const color = colors[carac] || "#6c4e95";
  const success = roll.total <= val;
  const result = success ? "✔️ Réussite" : "❌ Échec";
  const resultColor = success ? "#1cb360" : "#c34040";
  const content = `<div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #b5e7c388;background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%);border:1.4px solid ${color};max-width:420px;padding:.85em 1.1em .8em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.17em;font-weight:bold;color:${color};">${label}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Test de caractéristique</span></div><div style="font-size:1.11em;margin-bottom:.25em;">Seuil&nbsp;: <b>${val}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b></div><div style="margin:.2em 0 .1em;font-size:1.1em;"><span style="font-weight:600;color:${resultColor};">${result}</span></div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export async function add2eRollSaveCard(actor, saveType, context = {}) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  const engine = add2eSheetRollEffectsEngine();
  if (!engine?.rollSavingThrow) {
    throw new Error("L’exécuteur canonique ADD2E de sauvegardes n’est pas disponible.");
  }

  const result = await engine.rollSavingThrow(actor, saveType, {
    ...context,
    frontale: context.frontale !== false,
    source: context.source ?? "actor-sheet-save-roll",
    createChat: true,
    showDice: true
  });
  if (!result.ok) {
    const label = result.resolution?.label ?? "sauvegarde";
    return ui.notifications.warn(`Aucune valeur pour le jet ${label}.`);
  }
  return result.chatMessage;
}

function add2eHudRollActorFallback() {
  const hudState = globalThis.add2eHudFixDebug?.();
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.actors?.get?.(hudState?.actorId) ?? game.user?.character ?? null;
}

export function add2eInstallHudSheetRollBridge() {
  const engine = add2eSheetRollEffectsEngine();
  if (engine) add2eInstallCanonicalSaveResolver(engine);
  globalThis.ADD2E_SHEET_ROLL_DELEGATION_VERSION = ADD2E_SHEET_ROLL_DELEGATION_VERSION;
  globalThis.ADD2E_SAVE_RESOLVER_VERSION = ADD2E_SAVE_RESOLVER_VERSION;
  globalThis.add2eResolveSavingThrow = (actor, saveType, context = {}) => {
    const current = add2eSheetRollEffectsEngine();
    if (!current?.resolveSavingThrow) {
      throw new Error("Le résolveur canonique ADD2E de sauvegardes n’est pas disponible.");
    }
    return current.resolveSavingThrow(actor, saveType, context);
  };
  globalThis.add2eRollSavingThrow = async (actor, saveType, options = {}) => {
    const current = add2eSheetRollEffectsEngine();
    if (!current?.rollSavingThrow) {
      throw new Error("L’exécuteur canonique ADD2E de sauvegardes n’est pas disponible.");
    }
    return current.rollSavingThrow(actor, saveType, options);
  };
  globalThis.add2eGetSaveTarget = (actor, saveType) =>
    globalThis.add2eResolveSavingThrow(actor, saveType, { source: "global-get-save-target" }).target;
  globalThis.add2eRollCharacteristicCard = add2eRollCharacteristicCard;
  globalThis.add2eRollSaveCard = add2eRollSaveCard;

  if (globalThis.__add2eHudSheetRollBridgeV1) return;
  globalThis.__add2eHudSheetRollBridgeV1 = true;
  document.addEventListener("click", async ev => {
    const btn = ev.target?.closest?.("#add2e-action-hud [data-action='roll-ability'], #add2e-action-hud [data-action='roll-save']");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    const actor = add2eHudRollActorFallback();
    if (!actor) return ui.notifications.warn("Aucun acteur sélectionné pour le jet.");
    if (btn.dataset.action === "roll-ability") return add2eRollCharacteristicCard(actor, btn.dataset.ability);
    if (btn.dataset.action === "roll-save") {
      return add2eRollSaveCard(actor, Number(btn.dataset.saveIndex), { source: "action-hud-save-roll" });
    }
  }, true);
}
