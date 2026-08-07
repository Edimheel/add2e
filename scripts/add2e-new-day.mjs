// scripts/add2e-new-day.mjs
// ADD2E — Nouvelle journée : effets temporaires et métadonnées de journée.
// Compatible Foundry V13/V14/V15, API commune ApplicationV2 / DialogV2.
// Version : 2026-08-07-canonical-resource-v3

const ADD2E_NEW_DAY_VERSION = "2026-08-07-canonical-resource-v3";
const TAG = "[ADD2E][NEW_DAY]";

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

function buildActorNewDayUpdate() {
  return {
    "flags.add2e.lastNewDay": {
      at: new Date().toISOString(),
      userId: game.user.id,
      userName: game.user.name,
      version: ADD2E_NEW_DAY_VERSION
    }
  };
}

async function resetActorForNewDay(actor, { dryRun = false } = {}) {
  const effects = Array.from(actor?.effects ?? []);
  const effectIdsToDelete = effects.filter(shouldDeleteEffectOnNewDay).map(effect => effect.id).filter(Boolean);
  const actorUpdate = buildActorNewDayUpdate();

  if (!dryRun) {
    if (effectIdsToDelete.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", effectIdsToDelete, { add2eNewDay: true });
    }
    await actor.update(actorUpdate, { add2eNewDay: true });
  }

  return {
    actorId: actor.id,
    actorName: actor.name,
    actorType: actor.type,
    effectsDeleted: effectIdsToDelete.length,
    actorResourcesReset: 0,
    itemResourcesReset: 0,
    deletedEffectNames: effects.filter(effect => effectIdsToDelete.includes(effect.id)).map(effect => effect.name),
    resetItemNames: []
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
  const rows = results
    .filter(result => result.effectsDeleted)
    .map(result => `
      <tr>
        <td>${foundry.utils.escapeHTML(result.actorName)}</td>
        <td>${foundry.utils.escapeHTML(result.actorType)}</td>
        <td style="text-align:center">${result.effectsDeleted}</td>
      </tr>
    `).join("");

  return `
    <div class="add2e-new-day-dialog" style="line-height:1.45">
      <p><strong>${preview ? "Prévisualisation" : "Résultat"} — Nouvelle journée ADD2E</strong></p>
      <ul>
        <li>Acteurs du monde contrôlés : <strong>${results.length}</strong></li>
        <li>Effets temporaires à supprimer : <strong>${totalEffects}</strong></li>
      </ul>
      ${rows ? `
        <table style="width:100%">
          <thead><tr><th>Acteur</th><th>Type</th><th>Effets</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : "<p><em>Aucun effet temporaire à supprimer.</em></p>"}
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
      { label: "Effets supprimés", value: String(totals.effects) }
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

  if (typeof globalThis.add2eDialogConfirm !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }

  const preview = await previewNewDay();
  const confirmed = await globalThis.add2eDialogConfirm({
    add2eTheme: "parchment",
    add2ePrimaryAction: "yes",
    add2eClasses: ["add2e-new-day-dialog"],
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
