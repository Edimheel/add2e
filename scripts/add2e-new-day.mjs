// scripts/add2e-new-day.mjs
// ADD2E — Bouton MJ "Nouvelle journée"
// Version : 2026-05-15-v1

const ADD2E_NEW_DAY_VERSION = "2026-05-15-v1";
const TAG = "[ADD2E][NEW_DAY]";

function add2eClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(add2eArray);
  return [value];
}

function add2eNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eEffectFlag(effect, key, fallback = undefined) {
  try {
    const flags = effect?.flags?.add2e ?? {};
    if (flags && typeof flags === "object" && key in flags) return flags[key];
    const direct = effect?.getFlag?.("add2e", key);
    return direct ?? fallback;
  } catch (_e) {
    return fallback;
  }
}

function add2eEffectTags(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const tags = [
    ...add2eArray(flags.tags),
    ...add2eArray(flags.effectTags),
    ...add2eArray(effect?.statuses),
    ...add2eArray(effect?.system?.tags),
    ...add2eArray(effect?.system?.effectTags)
  ];
  return tags.map(add2eNormalize).filter(Boolean);
}

function add2eIsRacialOrPermanentEffect(effect) {
  const resetPolicy = add2eNormalize(add2eEffectFlag(effect, "resetPolicy", ""));
  const sourceType = add2eNormalize(add2eEffectFlag(effect, "sourceType", ""));
  const tags = add2eEffectTags(effect);

  if (["never", "manual", "whileequipped", "while_equipped"].includes(resetPolicy)) return true;
  if (["race", "racial"].includes(sourceType)) return true;
  if (tags.includes("racial") || tags.includes("race")) return true;
  if (tags.some(t => t.startsWith("race:"))) return true;

  return false;
}

function add2eHasFiniteDuration(effect) {
  const d = effect?.duration ?? {};
  const rounds = Number(d.rounds ?? 0) || 0;
  const turns = Number(d.turns ?? 0) || 0;
  const seconds = Number(d.seconds ?? 0) || 0;
  return rounds > 0 || turns > 0 || seconds > 0;
}

function add2eShouldDeleteEffectOnNewDay(effect) {
  if (!effect || add2eIsRacialOrPermanentEffect(effect)) return false;

  const resetPolicy = add2eNormalize(add2eEffectFlag(effect, "resetPolicy", ""));
  const sourceType = add2eNormalize(add2eEffectFlag(effect, "sourceType", ""));
  const tags = add2eEffectTags(effect);

  if (["newday", "new_day", "daily", "jour", "nouvelle_journee"].includes(resetPolicy)) return true;

  if (["spell", "sort", "classfeature", "class_feature", "capacite", "capacity"].includes(sourceType)) {
    if (add2eHasFiniteDuration(effect)) return true;
    if (tags.includes("temporaire") || tags.includes("temporary")) return true;
    if (tags.includes("reset:new_day") || tags.includes("reset:newday")) return true;
  }

  if (add2eHasFiniteDuration(effect)) return true;

  return false;
}

function add2eResetObjectResources(container, path = "") {
  const updates = [];

  const walk = (obj, currentPath) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;

    const reset = add2eNormalize(obj.reset ?? obj.resetPolicy ?? obj.recharge ?? "");
    const hasDailyReset = ["newday", "new_day", "daily", "jour", "nouvelle_journee"].includes(reset);

    if (hasDailyReset) {
      const max = Number(obj.max ?? obj.maximum ?? obj.total ?? 0);
      if (Number.isFinite(max) && max > 0 && "value" in obj) updates.push({ path: `${currentPath}.value`, value: max });
      if ("used" in obj) updates.push({ path: `${currentPath}.used`, value: false });
      if ("spent" in obj) updates.push({ path: `${currentPath}.spent`, value: 0 });
      if ("targets" in obj) updates.push({ path: `${currentPath}.targets`, value: [] });
      if ("targetIds" in obj) updates.push({ path: `${currentPath}.targetIds`, value: [] });
    }

    for (const [key, value] of Object.entries(obj)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      walk(value, currentPath ? `${currentPath}.${key}` : key);
    }
  };

  walk(container, path);
  return updates;
}

function add2eBuildFlagUpdate(actor) {
  const flags = actor?.flags?.add2e ?? {};
  const updates = {};

  for (const item of add2eResetObjectResources(flags.resources ?? {}, "flags.add2e.resources")) {
    updates[item.path] = item.value;
  }

  const dailyUses = add2eClone(flags.dailyUses ?? {});
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

async function add2eResetActorForNewDay(actor, { dryRun = false } = {}) {
  const effects = Array.from(actor?.effects ?? []);
  const effectIdsToDelete = effects
    .filter(add2eShouldDeleteEffectOnNewDay)
    .map(e => e.id)
    .filter(Boolean);

  const updateData = add2eBuildFlagUpdate(actor);
  const updateKeys = Object.keys(updateData).filter(k => k !== "flags.add2e.lastNewDay");

  if (!dryRun) {
    if (effectIdsToDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIdsToDelete, { add2eNewDay: true });
    await actor.update(updateData, { add2eNewDay: true });
  }

  return {
    actorId: actor.id,
    actorName: actor.name,
    effectsDeleted: effectIdsToDelete.length,
    resourcesReset: updateKeys.length,
    deletedEffectNames: effects.filter(e => effectIdsToDelete.includes(e.id)).map(e => e.name)
  };
}

function add2eGetPlayerActors() {
  return game.actors.filter(actor => actor?.type === "personnage" && !actor.compendium);
}

async function add2ePreviewNewDay() {
  const results = [];
  for (const actor of add2eGetPlayerActors()) results.push(await add2eResetActorForNewDay(actor, { dryRun: true }));
  return results;
}

function add2eNewDaySummaryHtml(results, preview = true) {
  const totalActors = results.length;
  const totalEffects = results.reduce((sum, r) => sum + Number(r.effectsDeleted ?? 0), 0);
  const totalResources = results.reduce((sum, r) => sum + Number(r.resourcesReset ?? 0), 0);

  const rows = results
    .filter(r => r.effectsDeleted || r.resourcesReset)
    .map(r => `
      <tr>
        <td>${foundry.utils.escapeHTML(r.actorName)}</td>
        <td style="text-align:center;">${r.effectsDeleted}</td>
        <td style="text-align:center;">${r.resourcesReset}</td>
      </tr>
    `)
    .join("");

  return `
    <div class="add2e-new-day-dialog" style="line-height:1.45;">
      <p><b>${preview ? "Prévisualisation" : "Résultat"} — Nouvelle journée ADD2E</b></p>
      <ul>
        <li>Acteurs personnage trouvés : <b>${totalActors}</b></li>
        <li>Effets temporaires à supprimer : <b>${totalEffects}</b></li>
        <li>Ressources journalières à réinitialiser : <b>${totalResources}</b></li>
      </ul>
      <p style="margin-top:0.6em;">Les effets raciaux/permanents sont conservés. Les effets sans durée et sans flag de réinitialisation ne sont pas supprimés.</p>
      ${rows ? `
        <table style="width:100%;margin-top:0.7em;">
          <thead><tr><th style="text-align:left;">Acteur</th><th>Effets</th><th>Ressources</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : `<p><i>Aucune modification détectée.</i></p>`}
    </div>
  `;
}

async function add2ePostNewDayChat(results) {
  const totalActors = results.length;
  const totalEffects = results.reduce((sum, r) => sum + Number(r.effectsDeleted ?? 0), 0);
  const totalResources = results.reduce((sum, r) => sum + Number(r.resourcesReset ?? 0), 0);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ alias: "ADD2E" }),
    content: `
      <div class="add2e-chat add2e-new-day-chat">
        <h2 style="margin:0 0 0.35em 0;">☀️ Nouvelle journée</h2>
        <p>Le Maître de Jeu déclare le début d'une nouvelle journée.</p>
        <ul>
          <li>Acteurs traités : <b>${totalActors}</b></li>
          <li>Effets temporaires supprimés : <b>${totalEffects}</b></li>
          <li>Ressources journalières réinitialisées : <b>${totalResources}</b></li>
        </ul>
      </div>
    `
  });
}

async function add2eStartNewDay() {
  if (!game.user.isGM) {
    ui.notifications.warn("Seul le MJ peut lancer une nouvelle journée.");
    return;
  }

  const preview = await add2ePreviewNewDay();

  new Dialog({
    title: "ADD2E — Nouvelle journée",
    content: add2eNewDaySummaryHtml(preview, true),
    buttons: {
      validate: {
        icon: '<i class="fas fa-sun"></i>',
        label: "Lancer la nouvelle journée",
        callback: async () => {
          const results = [];
          for (const actor of add2eGetPlayerActors()) results.push(await add2eResetActorForNewDay(actor, { dryRun: false }));
          console.log(`${TAG}[DONE]`, results);
          ui.notifications.info("ADD2E | Nouvelle journée appliquée.");
          await add2ePostNewDayChat(results);
        }
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Annuler" }
    },
    default: "validate"
  }, { width: 520 }).render(true);
}

function add2eBuildNewDayTool() {
  return {
    name: "add2e-new-day",
    title: "ADD2E | Nouvelle journée",
    icon: "fas fa-sun",
    button: true,
    visible: game.user.isGM,
    onClick: () => add2eStartNewDay()
  };
}

function add2eRegisterNewDaySceneControl(controls) {
  if (!game.user.isGM) return;

  const tool = add2eBuildNewDayTool();

  if (Array.isArray(controls)) {
    const tokenControls = controls.find(c => c.name === "token") ?? controls[0];
    if (tokenControls?.tools && Array.isArray(tokenControls.tools)) {
      if (!tokenControls.tools.some(t => t.name === tool.name)) tokenControls.tools.push(tool);
      return;
    }

    controls.push({
      name: "add2e",
      title: "ADD2E",
      icon: "fas fa-dragon",
      layer: "TokenLayer",
      tools: [tool],
      activeTool: tool.name
    });
    return;
  }

  const tokenControls = controls?.token ?? controls?.tokens ?? null;
  if (tokenControls?.tools) {
    if (Array.isArray(tokenControls.tools)) {
      if (!tokenControls.tools.some(t => t.name === tool.name)) tokenControls.tools.push(tool);
    } else if (typeof tokenControls.tools === "object") {
      tokenControls.tools[tool.name] = tool;
    }
  }
}

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.newDayVersion = ADD2E_NEW_DAY_VERSION;
  game.add2e.startNewDay = add2eStartNewDay;
  game.add2e.resetActorForNewDay = add2eResetActorForNewDay;
  game.add2e.shouldDeleteEffectOnNewDay = add2eShouldDeleteEffectOnNewDay;
  console.log(`${TAG}[INIT]`, ADD2E_NEW_DAY_VERSION);
});

Hooks.on("getSceneControlButtons", add2eRegisterNewDaySceneControl);

export {
  add2eStartNewDay,
  add2eResetActorForNewDay,
  add2eShouldDeleteEffectOnNewDay
};
