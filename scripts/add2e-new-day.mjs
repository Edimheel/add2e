// scripts/add2e-new-day.mjs
// ADD2E — Nouvelle journée : effets temporaires et ressources quotidiennes.
// Compatible Foundry V13/V14/V15, DialogV2.
// Version : 2026-08-05-monster-daily-powers-v2

const ADD2E_NEW_DAY_VERSION = "2026-08-05-monster-daily-powers-v2";
const TAG = "[ADD2E][NEW_DAY]";

const clone = value => {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
};

const arrayify = value => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(arrayify);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(arrayify);
  return [value];
};

const normalize = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

function effectFlag(effect, key, fallback = undefined) {
  try {
    const flags = effect?.flags?.add2e ?? {};
    if (key in flags) return flags[key];
    return effect?.getFlag?.("add2e", key) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function effectTags(effect) {
  const flags = effect?.flags?.add2e ?? {};
  return [
    ...arrayify(flags.tags),
    ...arrayify(flags.effectTags),
    ...arrayify(effect?.statuses),
    ...arrayify(effect?.system?.tags),
    ...arrayify(effect?.system?.effectTags)
  ].map(normalize).filter(Boolean);
}

function isRacialOrPermanentEffect(effect) {
  const resetPolicy = normalize(effectFlag(effect, "resetPolicy", ""));
  const sourceType = normalize(effectFlag(effect, "sourceType", ""));
  const tags = effectTags(effect);

  if (["never", "manual", "whileequipped", "while_equipped"].includes(resetPolicy)) return true;
  if (["race", "racial"].includes(sourceType)) return true;
  return tags.includes("racial") || tags.includes("race") || tags.some(tag => tag.startsWith("race:"));
}

function hasFiniteDuration(effect) {
  const duration = effect?.duration ?? {};
  return [duration.rounds, duration.turns, duration.seconds].some(value => (Number(value) || 0) > 0);
}

function shouldDeleteEffectOnNewDay(effect) {
  if (!effect || isRacialOrPermanentEffect(effect)) return false;

  const resetPolicy = normalize(effectFlag(effect, "resetPolicy", ""));
  const sourceType = normalize(effectFlag(effect, "sourceType", ""));
  const tags = effectTags(effect);

  if (["newday", "new_day", "daily", "jour", "nouvelle_journee"].includes(resetPolicy)) return true;
  if (["spell", "sort", "classfeature", "class_feature", "capacite", "capacity"].includes(sourceType)) {
    if (hasFiniteDuration(effect)) return true;
    if (tags.includes("temporaire") || tags.includes("temporary")) return true;
    if (tags.includes("reset:new_day") || tags.includes("reset:newday")) return true;
  }
  return hasFiniteDuration(effect);
}

function resetObjectResources(container, path = "") {
  const updates = [];

  const walk = (object, currentPath) => {
    if (!object || typeof object !== "object" || Array.isArray(object)) return;

    const reset = normalize(object.reset ?? object.resetPolicy ?? object.recharge ?? "");
    if (["newday", "new_day", "daily", "jour", "nouvelle_journee"].includes(reset)) {
      const max = Number(object.max ?? object.maximum ?? object.total ?? 0);
      if (Number.isFinite(max) && max > 0 && "value" in object) updates.push({ path: `${currentPath}.value`, value: max });
      if ("used" in object) updates.push({ path: `${currentPath}.used`, value: false });
      if ("spent" in object) updates.push({ path: `${currentPath}.spent`, value: 0 });
      if ("targets" in object) updates.push({ path: `${currentPath}.targets`, value: [] });
      if ("targetIds" in object) updates.push({ path: `${currentPath}.targetIds`, value: [] });
    }

    for (const [key, value] of Object.entries(object)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      walk(value, currentPath ? `${currentPath}.${key}` : key);
    }
  };

  walk(container, path);
  return updates;
}

function buildActorFlagUpdate(actor) {
  const flags = actor?.flags?.add2e ?? {};
  const updates = {};

  for (const resource of resetObjectResources(flags.resources ?? {}, "flags.add2e.resources")) {
    updates[resource.path] = resource.value;
  }

  const dailyUses = clone(flags.dailyUses ?? {});
  if (dailyUses && typeof dailyUses === "object" && !Array.isArray(dailyUses)) {
    let changed = false;
    for (const value of Object.values(dailyUses)) {
      if (!value || typeof value !== "object") continue;
      if ("used" in value) { value.used = false; changed = true; }
      if (Array.isArray(value.targets)) { value.targets = []; changed = true; }
      if (Array.isArray(value.targetIds)) { value.targetIds = []; changed = true; }
    }
    if (changed) updates["flags.add2e.dailyUses"] = dailyUses;
  }

  updates["flags.add2e.lastNewDay"] = {
    at: new Date().toISOString(),
    userId: game.user.id,
    userName: game.user.name,
    version: ADD2E_NEW_DAY_VERSION
  };

  return updates;
}

function buildDailyItemUpdates(actor) {
  const updates = [];

  for (const item of actor?.items ?? []) {
    const charges = item?.system?.charges;
    if (!charges || typeof charges !== "object") continue;

    const recharge = normalize(charges.recharge ?? charges.reset ?? item.flags?.add2e?.resetPolicy ?? "");
    if (!["newday", "new_day", "daily", "jour", "nouvelle_journee"].includes(recharge)) continue;

    const max = Number(charges.max ?? charges.maximum ?? item.system?.max_charges ?? 0);
    if (!Number.isFinite(max) || max <= 0) continue;

    const current = Number(charges.value ?? charges.current ?? 0);
    if (current === max) continue;

    updates.push({
      _id: item.id,
      "system.charges.value": max,
      "flags.add2e.global_charges": max
    });
  }

  return updates;
}

async function resetActorForNewDay(actor, { dryRun = false } = {}) {
  const effects = Array.from(actor?.effects ?? []);
  const effectIdsToDelete = effects.filter(shouldDeleteEffectOnNewDay).map(effect => effect.id).filter(Boolean);
  const actorUpdate = buildActorFlagUpdate(actor);
  const itemUpdates = buildDailyItemUpdates(actor);
  const actorResourceKeys = Object.keys(actorUpdate).filter(key => key !== "flags.add2e.lastNewDay");

  if (!dryRun) {
    if (effectIdsToDelete.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", effectIdsToDelete, { add2eNewDay: true });
    }
    if (itemUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", itemUpdates, { add2eNewDay: true, add2eReason: "daily-recharge" });
    }
    await actor.update(actorUpdate, { add2eNewDay: true });
  }

  return {
    actorId: actor.id,
    actorName: actor.name,
    actorType: actor.type,
    effectsDeleted: effectIdsToDelete.length,
    actorResourcesReset: actorResourceKeys.length,
    itemResourcesReset: itemUpdates.length,
    deletedEffectNames: effects.filter(effect => effectIdsToDelete.includes(effect.id)).map(effect => effect.name),
    resetItemNames: itemUpdates.map(update => actor.items.get(update._id)?.name).filter(Boolean)
  };
}

function getWorldActors() {
  return game.actors.filter(actor => !actor.compendium && ["personnage", "monster"].includes(String(actor.type)));
}

async function previewNewDay() {
  const results = [];
  for (const actor of getWorldActors()) results.push(await resetActorForNewDay(actor, { dryRun: true }));
  return results;
}

function summaryHtml(results, preview = true) {
  const totalEffects = results.reduce((sum, result) => sum + result.effectsDeleted, 0);
  const totalActorResources = results.reduce((sum, result) => sum + result.actorResourcesReset, 0);
  const totalItemResources = results.reduce((sum, result) => sum + result.itemResourcesReset, 0);
  const rows = results
    .filter(result => result.effectsDeleted || result.actorResourcesReset || result.itemResourcesReset)
    .map(result => `
      <tr>
        <td>${foundry.utils.escapeHTML(result.actorName)}</td>
        <td>${foundry.utils.escapeHTML(result.actorType)}</td>
        <td style="text-align:center">${result.effectsDeleted}</td>
        <td style="text-align:center">${result.actorResourcesReset}</td>
        <td style="text-align:center">${result.itemResourcesReset}</td>
      </tr>
    `).join("");

  return `
    <div class="add2e-new-day-dialog" style="line-height:1.45">
      <p><strong>${preview ? "Prévisualisation" : "Résultat"} — Nouvelle journée ADD2E</strong></p>
      <ul>
        <li>Acteurs du monde contrôlés : <strong>${results.length}</strong></li>
        <li>Effets temporaires : <strong>${totalEffects}</strong></li>
        <li>Ressources d’acteur : <strong>${totalActorResources}</strong></li>
        <li>Charges quotidiennes d’objets ou pouvoirs : <strong>${totalItemResources}</strong></li>
      </ul>
      ${rows ? `
        <table style="width:100%">
          <thead><tr><th>Acteur</th><th>Type</th><th>Effets</th><th>Acteur</th><th>Objets</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : "<p><em>Aucune modification détectée.</em></p>"}
    </div>
  `;
}

async function postNewDayChat(results) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const totals = {
    actors: results.length,
    effects: results.reduce((sum, result) => sum + result.effectsDeleted, 0),
    actorResources: results.reduce((sum, result) => sum + result.actorResourcesReset, 0),
    itemResources: results.reduce((sum, result) => sum + result.itemResourcesReset, 0)
  };

  const card = {
    title: "Nouvelle journée",
    icon: "fas fa-sun",
    variant: "utility",
    source: { name: game.user.name, type: "Maître de jeu" },
    rows: [
      { label: "Acteurs traités", value: String(totals.actors) },
      { label: "Effets supprimés", value: String(totals.effects) },
      { label: "Ressources d’acteur", value: String(totals.actorResources) },
      { label: "Pouvoirs rechargés", value: String(totals.itemResources) }
    ],
    chatData: { speaker: ChatMessage.getSpeaker({ alias: "ADD2E" }) }
  };

  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

async function startNewDay() {
  if (!game.user.isGM) {
    ui.notifications.warn("Seul le MJ peut lancer une nouvelle journée.");
    return false;
  }

  const DialogV2 = foundry.applications.api.DialogV2;
  const preview = await previewNewDay();
  const confirmed = await DialogV2.confirm({
    window: { title: "ADD2E — Nouvelle journée" },
    content: summaryHtml(preview, true),
    yes: { label: "Lancer la nouvelle journée", icon: "fas fa-sun" },
    no: { label: "Annuler", icon: "fas fa-times" },
    modal: true,
    rejectClose: false
  });
  if (!confirmed) return false;

  const results = [];
  for (const actor of getWorldActors()) results.push(await resetActorForNewDay(actor));

  console.log(`${TAG}[DONE]`, results);
  ui.notifications.info("ADD2E | Nouvelle journée appliquée.");
  await postNewDayChat(results);
  return true;
}

function buildNewDayTool() {
  return {
    name: "add2e-new-day",
    title: "ADD2E | Nouvelle journée",
    icon: "fas fa-sun",
    button: true,
    visible: game.user.isGM,
    onClick: () => startNewDay()
  };
}

function registerNewDaySceneControl(controls) {
  if (!game.user.isGM) return;
  const tool = buildNewDayTool();

  if (Array.isArray(controls)) {
    const tokenControls = controls.find(control => control.name === "token") ?? controls[0];
    if (Array.isArray(tokenControls?.tools)) {
      if (!tokenControls.tools.some(existing => existing.name === tool.name)) tokenControls.tools.push(tool);
      return;
    }
    controls.push({ name: "add2e", title: "ADD2E", icon: "fas fa-dragon", layer: "TokenLayer", tools: [tool], activeTool: tool.name });
    return;
  }

  const tokenControls = controls?.token ?? controls?.tokens ?? null;
  if (Array.isArray(tokenControls?.tools)) {
    if (!tokenControls.tools.some(existing => existing.name === tool.name)) tokenControls.tools.push(tool);
  } else if (tokenControls?.tools && typeof tokenControls.tools === "object") {
    tokenControls.tools[tool.name] = tool;
  }
}

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.newDayVersion = ADD2E_NEW_DAY_VERSION;
  game.add2e.startNewDay = startNewDay;
  game.add2e.resetActorForNewDay = resetActorForNewDay;
  game.add2e.shouldDeleteEffectOnNewDay = shouldDeleteEffectOnNewDay;
  console.log(`${TAG}[INIT]`, ADD2E_NEW_DAY_VERSION);
});

Hooks.on("getSceneControlButtons", registerNewDaySceneControl);

export { startNewDay as add2eStartNewDay, resetActorForNewDay as add2eResetActorForNewDay, shouldDeleteEffectOnNewDay as add2eShouldDeleteEffectOnNewDay };
