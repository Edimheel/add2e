// ADD2E — XP de session — ApplicationV2
// La progression est écrite exclusivement sur les Items classe.

import {
  classItems as add2eCanonicalClassItems,
  classProgression as add2eCanonicalClassProgression,
  classSlug as add2eCanonicalClassSlug
} from "./17b-multiclass-core.mjs";
import {
  classTitleForLevel as add2eClassTitleForLevel,
  levelForClassXp as add2eLevelForClassXp,
  nextXpForClassLevel as add2eNextXpForClassLevel,
  splitMulticlassXp as add2eSplitMulticlassXp
} from "./17b-multiclass-rules.mjs";

const VERSION = "2026-08-11-canonical-class-progression-v8";
const TAG = "[ADD2E][SESSION_XP]";
const FLAG_SCOPE = "add2e";
const FLAG_LEDGER = "sessionXpLedger";
const FLAG_RECORDED = "sessionXpRecorded";
const FLAG_RECORDED_KEY = "sessionXpRecordedKey";
const INTERNAL = "add2eSessionXpInternal";
const XP_TOOL_NAME = "add2e-session-xp";
const ApplicationV2 = foundry.applications.api.ApplicationV2;

globalThis.ADD2E_SESSION_XP_VERSION = VERSION;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }
function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "xp", "px", "niveau", "level", "pdv", "pv"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
  }
  const parsed = Number(String(value ?? "").replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function nowIso() { return new Date().toISOString(); }

function classItems(actor) {
  return add2eCanonicalClassItems(actor);
}
function requireClassProgression(item, context = "XP de session") {
  const state = add2eCanonicalClassProgression(item);
  if (!state.hasLevel || !state.hasXp) {
    throw new Error(`Item de classe « ${item?.name ?? item?.id ?? "inconnu"} » sans system.niveau/system.xp canonique (${context}).`);
  }
  return state;
}
function classXp(item) {
  return requireClassProgression(item, "lecture XP").xp;
}
function classLevel(item) {
  return requireClassProgression(item, "lecture niveau").level;
}
function totalXp(actor) {
  return classItems(actor).reduce((sum, item) => sum + classXp(item), 0);
}
function hpValue(actor) { return num(actor?.system?.pdv ?? actor?.system?.pv ?? actor?.system?.hp ?? 0, 0); }
function monsterXpValue(actor) { return Math.max(0, Math.floor(num(actor?.system?.xp ?? actor?.system?.px ?? actor?.system?.experience ?? 0, 0))); }

function currentLedger() {
  try {
    const ledger = game.settings.get("add2e", FLAG_LEDGER);
    return Array.isArray(ledger) ? ledger : [];
  } catch (_error) { return []; }
}
async function saveLedger(ledger) {
  if (!game.user?.isGM) return;
  await game.settings.set("add2e", FLAG_LEDGER, Array.isArray(ledger) ? ledger : []);
}
function tokenKey({ actor = null, tokenDoc = null, scene = null } = {}) {
  return `${scene?.id ?? tokenDoc?.parent?.id ?? "world"}:${tokenDoc?.id ?? "actor"}:${actor?.id ?? tokenDoc?.actorId ?? "unknown"}`;
}
function sourceIsDead(entry) {
  if (!entry || entry.included === false) return false;
  if (entry.dead === true || num(entry.hp, 1) <= 0) return true;
  const actor = game.actors?.get?.(entry.actorId);
  return actor?.type === "monster" && hpValue(actor) <= 0;
}
function buildSource(actor, { tokenDoc = null, scene = null, reason = "pv_zero" } = {}) {
  const realScene = scene ?? tokenDoc?.parent ?? canvas?.scene ?? null;
  const hp = hpValue(actor);
  return {
    key: tokenKey({ actor, tokenDoc, scene: realScene }),
    actorId: actor?.id ?? "",
    actorUuid: actor?.uuid ?? "",
    tokenId: tokenDoc?.id ?? "",
    tokenName: tokenDoc?.name ?? actor?.name ?? "Monstre",
    monsterName: actor?.name ?? tokenDoc?.name ?? "Monstre",
    sceneId: realScene?.id ?? "",
    sceneName: realScene?.name ?? "",
    xp: monsterXpValue(actor),
    hp,
    dead: hp <= 0,
    reason,
    recordedAt: nowIso(),
    included: hp <= 0
  };
}
async function recordMonsterXp(actor, { tokenDoc = null, scene = null, reason = "pv_zero", force = false } = {}) {
  if (!game.user?.isGM || actor?.type !== "monster" || hpValue(actor) > 0) return null;
  const source = buildSource(actor, { tokenDoc, scene, reason });
  const ledger = currentLedger();
  if (!force && ledger.some(entry => entry?.key === source.key && entry.included !== false)) return null;
  ledger.push(source);
  await saveLedger(ledger);
  await actor.setFlag?.(FLAG_SCOPE, FLAG_RECORDED, true).catch(() => null);
  await actor.setFlag?.(FLAG_SCOPE, FLAG_RECORDED_KEY, source.key).catch(() => null);
  await tokenDoc?.setFlag?.(FLAG_SCOPE, FLAG_RECORDED, true).catch(() => null);
  await tokenDoc?.setFlag?.(FLAG_SCOPE, FLAG_RECORDED_KEY, source.key).catch(() => null);
  log("[RECORD]", source);
  return source;
}
function queueRecord(actor, options = {}) { setTimeout(() => recordMonsterXp(actor, options).catch(error => warn("[RECORD_ERROR]", error)), 0); }

function sceneDeadSources() {
  const output = [];
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens ?? []) {
      const actor = tokenDoc.actor;
      if (actor?.type !== "monster" || hpValue(actor) > 0) continue;
      output.push(buildSource(actor, { tokenDoc, scene, reason: "pv_zero_scene" }));
    }
  }
  return output;
}
function availableSources() {
  const map = new Map();
  for (const source of [...currentLedger().filter(sourceIsDead), ...sceneDeadSources()]) {
    if (!source?.key) continue;
    const existing = map.get(source.key);
    if (!existing || source.reason === "pv_zero_scene") map.set(source.key, { ...source, checked: true });
  }
  return [...map.values()];
}

function playerOwned(actor) {
  if (!actor || actor.type !== "personnage") return false;
  return Array.from(game.users ?? []).filter(user => !user.isGM).some(user => {
    try { return actor.testUserPermission?.(user, "OWNER") === true; } catch (_error) { return false; }
  });
}
function characterRows() {
  return (game.actors?.filter(actor => actor.type === "personnage") ?? []).map(actor => {
    const classes = classItems(actor).map(item => ({
      id: item.id,
      name: item.name,
      slug: add2eCanonicalClassSlug(item),
      level: classLevel(item),
      xp: classXp(item)
    }));
    const owned = playerOwned(actor);
    return {
      actor,
      actorId: actor.id,
      name: actor.name,
      classes,
      multiclass: classes.length > 1,
      xp: classes.reduce((sum, entry) => sum + entry.xp, 0),
      playerOwned: owned,
      checked: owned && classes.length > 0
    };
  });
}

async function applyXpToActor(actor, amount, reason) {
  const classes = classItems(actor);
  if (!classes.length) throw new Error(`${actor.name} ne possède aucun Item classe.`);
  const gain = Math.max(0, Math.floor(num(amount, 0)));
  const before = totalXp(actor);
  const shares = add2eSplitMulticlassXp(gain, classes.length);
  const updates = [];
  const breakdown = [];
  for (const [index, item] of classes.entries()) {
    const oldXp = classXp(item);
    const gained = shares[index] ?? 0;
    const xp = oldXp + gained;
    const level = add2eLevelForClassXp(item.system ?? {}, xp);
    updates.push({ _id: item.id, "system.xp": xp, "system.niveau": level });
    breakdown.push({ item, before: oldXp, gained, after: xp, level });
  }
  await actor.updateEmbeddedDocuments("Item", updates, {
    [INTERNAL]: true,
    add2eInternal: true,
    add2eReason: reason
  });

  if (classes.length > 1) {
    await globalThis.add2eRecalcMulticlassActor?.(actor);
  } else {
    const entry = breakdown[0];
    const next = add2eNextXpForClassLevel(entry.item.system ?? {}, entry.level);
    await actor.update({
      "system.xp": entry.after,
      "system.niveau": entry.level,
      "system.niveau_suggere": entry.level,
      "system.titre": add2eClassTitleForLevel(entry.item.system ?? {}, entry.level),
      "system.xp_next": next,
      "system.xp_to_next": next ? Math.max(0, next - entry.after) : 0,
      "system.progression_xp": next ? `${entry.after.toLocaleString()} / ${next.toLocaleString()} XP` : `${entry.after.toLocaleString()} XP`
    }, { [INTERNAL]: true, add2eInternal: true, add2eReason: `${reason}:summary` });
  }

  const live = game.actors?.get?.(actor.id) ?? actor;
  const after = totalXp(live);
  return { before, after, gained: gain, classes: breakdown };
}

function unlinkedTokenActors(actor) {
  const output = [];
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens ?? []) {
      if (tokenDoc.actorId !== actor?.id || tokenDoc.actorLink === true || tokenDoc.actor?.type !== "personnage") continue;
      output.push({ scene, tokenDoc, actor: tokenDoc.actor });
    }
  }
  return output;
}
async function syncUnlinkedTokens(actor, amount, reason) {
  const results = [];
  for (const row of unlinkedTokenActors(actor)) {
    try {
      const result = await applyXpToActor(row.actor, amount, `${reason}:token`);
      results.push({ scene: row.scene.name, token: row.tokenDoc.name, ok: true, ...result });
    } catch (error) {
      results.push({ scene: row.scene.name, token: row.tokenDoc.name, ok: false, error: error.message });
    }
  }
  return results;
}

function sourceHtml(source) {
  return `<tr data-source-key="${esc(source.key)}"><td><input type="checkbox" data-role="source" checked></td><td><b>${esc(source.monsterName)}</b><br><small>${esc(source.sceneName || "Scène inconnue")} — PV ${esc(source.hp)}</small></td><td><input type="number" data-role="source-xp" value="${Math.max(0, Math.floor(num(source.xp, 0)))}" min="0" step="1"></td></tr>`;
}
function characterHtml(row) {
  const classes = row.classes.map(entry => `${esc(entry.name)} ${entry.level} (${entry.xp.toLocaleString()} XP)`).join(" / ");
  return `<tr data-actor-id="${esc(row.actorId)}"><td><input type="checkbox" data-role="character" ${row.checked ? "checked" : ""}></td><td><b>${esc(row.name)}</b><br><small>${row.multiclass ? "Multiclasse — " : ""}${classes}</small></td><td>${row.xp.toLocaleString()}</td><td><input type="number" data-role="weight" value="1" min="0" step="0.5"></td><td><input type="number" data-role="percent" value="0" step="1"></td><td><input type="number" data-role="flat" value="0" step="1"></td></tr>`;
}
function appHtml() {
  const sources = availableSources();
  const characters = characterRows();
  return `<section class="add2e-session-xp-v6">
    <style>
      .add2e-session-xp-v6{height:100%;display:flex;flex-direction:column;color:#2b1b0c;background:#f8efd7}.add2e-session-xp-v6 .scroll{padding:10px;overflow:auto;flex:1}.add2e-session-xp-v6 table{width:100%;border-collapse:collapse;background:#fffaf0;margin:8px 0 14px}.add2e-session-xp-v6 th,.add2e-session-xp-v6 td{border:1px solid #b99742;padding:6px;vertical-align:middle}.add2e-session-xp-v6 th{background:#ead08f}.add2e-session-xp-v6 input[type=number]{width:94px;max-width:100%;padding:4px}.add2e-session-xp-v6 .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.add2e-session-xp-v6 label{display:grid;gap:3px;font-weight:700}.add2e-session-xp-v6 .actions{display:flex;gap:8px;justify-content:flex-end;padding:10px;border-top:1px solid #b99742;background:#e7d19a}.add2e-session-xp-v6 button{padding:7px 12px;border:1px solid #6d4a12;border-radius:6px;font-weight:800;cursor:pointer}.add2e-session-xp-v6 .apply{background:#2f7c3f;color:#fff}.add2e-session-xp-v6 .reset{background:#8d2b22;color:#fff}
    </style>
    <div class="scroll">
      <h2>Sources d’XP : monstres morts</h2>
      <table><thead><tr><th>Incl.</th><th>Monstre</th><th>XP</th></tr></thead><tbody>${sources.map(sourceHtml).join("") || "<tr><td colspan='3'><em>Aucun monstre mort enregistré.</em></td></tr>"}</tbody></table>
      <h2>Bonus globaux</h2>
      <div class="grid"><label>Objectifs<input data-role="objectives" type="number" value="0" min="0"></label><label>Trésors<input data-role="treasure" type="number" value="0" min="0"></label><label>Bonus MJ<input data-role="gm-bonus" type="number" value="0" min="0"></label><label>Motif<input data-role="reason" type="text" value="XP de session"></label></div>
      <h2>Personnages</h2>
      <table><thead><tr><th>Incl.</th><th>Personnage</th><th>XP actuel</th><th>Part</th><th>Bonus %</th><th>Bonus fixe</th></tr></thead><tbody>${characters.map(characterHtml).join("") || "<tr><td colspan='6'><em>Aucun personnage.</em></td></tr>"}</tbody></table>
      <p><small>Pour un multiclassé, la part reçue est divisée de façon égale entre ses Items classe. Chaque Item classe reçoit son XP et son niveau propres.</small></p>
    </div>
    <footer class="actions"><button type="button" data-action="audit">Audit</button><button type="button" class="reset" data-action="reset">Réinitialiser le registre</button><button type="button" class="apply" data-action="apply">Appliquer l’XP</button></footer>
  </section>`;
}
function readNumber(root, selector) { return Math.max(0, num(root.querySelector(selector)?.value, 0)); }
function readAppData(root) {
  const sourceRows = [...root.querySelectorAll("tr[data-source-key]")].map(row => ({
    key: row.dataset.sourceKey,
    included: row.querySelector("[data-role='source']")?.checked === true,
    xp: Math.max(0, num(row.querySelector("[data-role='source-xp']")?.value, 0))
  }));
  const recipients = [...root.querySelectorAll("tr[data-actor-id]")].map(row => ({
    actor: game.actors?.get?.(row.dataset.actorId) ?? null,
    included: row.querySelector("[data-role='character']")?.checked === true,
    weight: Math.max(0, num(row.querySelector("[data-role='weight']")?.value, 0)),
    percent: num(row.querySelector("[data-role='percent']")?.value, 0),
    flat: num(row.querySelector("[data-role='flat']")?.value, 0)
  })).filter(row => row.actor && row.included && row.weight > 0);
  const selected = sourceRows.filter(row => row.included);
  return {
    selected,
    recipients,
    objectives: readNumber(root, "[data-role='objectives']"),
    treasure: readNumber(root, "[data-role='treasure']"),
    gmBonus: readNumber(root, "[data-role='gm-bonus']"),
    reason: String(root.querySelector("[data-role='reason']")?.value ?? "XP de session").trim() || "XP de session"
  };
}
function buildDistribution(data) {
  const sourceXp = data.selected.reduce((sum, row) => sum + row.xp, 0);
  const total = sourceXp + data.objectives + data.treasure + data.gmBonus;
  const weightTotal = data.recipients.reduce((sum, row) => sum + row.weight, 0);
  const output = [];
  let allocated = 0;
  data.recipients.forEach((row, index) => {
    const base = index === data.recipients.length - 1 ? total - allocated : Math.floor(total * (row.weight / weightTotal));
    allocated += base;
    const percent = Math.floor(base * (row.percent / 100));
    output.push({ ...row, base, gained: Math.max(0, base + percent + row.flat) });
  });
  return { sourceXp, total, output };
}
async function markSourcesApplied(selected, reason) {
  const ledger = currentLedger();
  const at = nowIso();
  for (const source of selected) {
    const index = ledger.findIndex(entry => entry?.key === source.key);
    if (index < 0) continue;
    ledger[index] = { ...ledger[index], included: false, appliedAt: at, appliedReason: reason };
  }
  await saveLedger(ledger);
}
async function chatResult(results, distribution, data) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const rows = [
    { label: "Total réparti", value: `${distribution.total.toLocaleString()} XP` },
    { label: "Sources", value: `Monstres ${distribution.sourceXp.toLocaleString()} XP · objectifs ${data.objectives.toLocaleString()} XP · trésors ${data.treasure.toLocaleString()} XP · bonus MJ ${data.gmBonus.toLocaleString()} XP` },
    ...results.map(row => ({
      label: row.actor.name,
      value: `+${row.gained.toLocaleString()} XP — ${row.result.classes.map(entry => `${entry.item.name} +${entry.gained.toLocaleString()} (${entry.before.toLocaleString()} → ${entry.after.toLocaleString()}, niv. ${entry.level})`).join(" ; ")}`
    }))
  ];
  const options = {
    actor: results[0]?.actor ?? null,
    title: "Bilan XP de session",
    icon: "fas fa-coins",
    variant: "success",
    source: { name: "XP de session", type: "Progression" },
    rows,
    message: data.reason,
    chatData: { flags: { add2e: { sessionXp: true, version: VERSION } } }
  };
  const preview = build(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte de bilan XP ADD2E est vide.");
  return create(options);
}
async function applySessionXp(data) {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut appliquer l’XP de session.");
  if (!data.recipients.length) return ui.notifications.warn("Aucun personnage destinataire sélectionné.");
  const distribution = buildDistribution(data);
  if (distribution.total <= 0) return ui.notifications.warn("Le total d’XP est à 0.");
  const results = [];
  for (const row of distribution.output) {
    const result = await applyXpToActor(row.actor, row.gained, "session-xp-item-progression");
    const tokenSync = await syncUnlinkedTokens(row.actor, row.gained, "session-xp-item-progression");
    results.push({ actor: row.actor, gained: row.gained, result, tokenSync });
  }
  await markSourcesApplied(data.selected, data.reason);
  await chatResult(results, distribution, data);
  for (const row of results) row.actor.sheet?.render?.(false);
  ui.notifications.info("XP de session appliquée.");
  return { results, distribution };
}
function audit() {
  const rows = characterRows().map(row => ({ actor: row.name, totalXp: row.xp, classes: row.classes.map(entry => `${entry.name} n${entry.level} xp${entry.xp}`).join(" / ") }));
  console.table(rows);
  return { version: VERSION, characters: rows, sources: availableSources() };
}
async function clearLedger() {
  await saveLedger([]);
  ui.notifications.info("Registre XP de session vidé.");
}

class Add2eSessionXpApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "add2e-session-xp-app-v6", classes: ["add2e", "session-xp", "app-v2"], tag: "section", window: { title: "ADD2E — Bilan XP de session", resizable: true }, position: { width: 980, height: 780 } };
  async _renderHTML() { const wrapper = document.createElement("div"); wrapper.innerHTML = appHtml(); return wrapper; }
  _replaceHTML(result, content) { content.replaceChildren(...result.childNodes); this._activateListeners(content); }
  _activateListeners(content) {
    const root = content.querySelector(".add2e-session-xp-v6");
    root?.querySelector("[data-action='audit']")?.addEventListener("click", () => audit());
    root?.querySelector("[data-action='reset']")?.addEventListener("click", async () => { await clearLedger(); this.render({ force: true }); });
    root?.querySelector("[data-action='apply']")?.addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try { await applySessionXp(readAppData(root)); this.render({ force: true }); }
      catch (error) { console.error(`${TAG}[APPLY_ERROR]`, error); ui.notifications.error("Application de l’XP impossible. Voir console."); }
      finally { event.currentTarget.disabled = false; }
    });
  }
}
function openSessionXpApplication() {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut ouvrir le bilan XP.");
  const existing = Object.values(ui.windows ?? {}).find(app => app instanceof Add2eSessionXpApp);
  return existing ? existing.render({ force: true }) : new Add2eSessionXpApp().render(true);
}

function sessionXpToolDefinition() {
  const open = () => openSessionXpApplication();
  return {
    name: XP_TOOL_NAME,
    title: "ADD2E — Bilan XP de session",
    icon: "fas fa-coins",
    button: true,
    visible: game.user?.isGM === true,
    onClick: open,
    onChange: value => {
      if (value === false) return;
      return open();
    }
  };
}

function upsertSessionXpTool(control, tool) {
  if (!control) return false;
  const tools = control.tools;
  if (Array.isArray(tools)) {
    const index = tools.findIndex(entry => entry?.name === tool.name || entry?.id === tool.name);
    if (index >= 0) tools[index] = tool;
    else tools.push(tool);
    return true;
  }
  if (tools instanceof Map) {
    tools.set(tool.name, tool);
    return true;
  }
  if (tools && typeof tools === "object") {
    tools[tool.name] = tool;
    return true;
  }
  return false;
}

function registerSessionXpSceneControl(controls) {
  if (game.user?.isGM !== true) return;
  const tool = sessionXpToolDefinition();

  if (Array.isArray(controls)) {
    const tokenControl = controls.find(control => control?.name === "token" || control?.name === "tokens") ?? controls[0];
    return upsertSessionXpTool(tokenControl, tool);
  }

  if (controls && typeof controls === "object") {
    const tokenControl = controls.token
      ?? controls.tokens
      ?? Object.values(controls).find(control => control?.name === "token" || control?.name === "tokens");
    return upsertSessionXpTool(tokenControl, tool);
  }

  return false;
}

Hooks.once("init", () => {
  game.settings.register("add2e", FLAG_LEDGER, { name: "ADD2E — Registre XP de session", scope: "world", config: false, type: Array, default: [] });
});
Hooks.on("getSceneControlButtons", registerSessionXpSceneControl);
Hooks.on("updateActor", (actor, changes) => {
  if (!game.user?.isGM || actor?.type !== "monster") return;
  const before = hpValue(actor);
  const after = num(foundry.utils.getProperty(changes, "system.pdv") ?? foundry.utils.getProperty(changes, "system.pv") ?? before, before);
  if (before > 0 && after <= 0) queueRecord(actor, { reason: "pv_zero" });
});
Hooks.on("deleteToken", tokenDoc => {
  if (game.user?.isGM && tokenDoc?.actor?.type === "monster" && hpValue(tokenDoc.actor) <= 0) queueRecord(tokenDoc.actor, { tokenDoc, scene: tokenDoc.parent, reason: "token_deleted" });
});

globalThis.add2eOpenSessionXp = openSessionXpApplication;
globalThis.add2eSessionXpAudit = audit;
globalThis.add2eSessionXpApplyToActor = applyXpToActor;
console.log(`${TAG}[READY]`, VERSION);
