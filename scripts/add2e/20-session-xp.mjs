// ADD2E — XP de session — ApplicationV2
// La progression est écrite exclusivement sur les Items classe.

const VERSION = "2026-06-25-session-xp-item-progression-v6";
const TAG = "[ADD2E][SESSION_XP]";
const FLAG_SCOPE = "add2e";
const FLAG_LEDGER = "sessionXpLedger";
const FLAG_RECORDED = "sessionXpRecorded";
const FLAG_RECORDED_KEY = "sessionXpRecordedKey";
const INTERNAL = "add2eSessionXpInternal";
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
function norm(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
function clone(value) { return foundry.utils.deepClone(value ?? {}); }
function nowIso() { return new Date().toISOString(); }
function classItems(actor) { return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe"); }
function classSlug(item) { return norm(item?.system?.slug ?? item?.system?.label ?? item?.name ?? "classe"); }
function classProgression(item) {
  const level = Number(item?.system?.niveau);
  const xp = Number(item?.system?.xp);
  return {
    level: Number.isFinite(level) && level >= 1 ? Math.floor(level) : null,
    xp: Number.isFinite(xp) && xp >= 0 ? Math.floor(xp) : null
  };
}
function classXp(actor, item) {
  const value = classProgression(item).xp;
  return value === null ? 0 : value;
}
function classLevel(actor, item) {
  const value = classProgression(item).level;
  return value === null ? 1 : value;
}
function isMulticlassActor(actor) { return actor?.type === "personnage" && classItems(actor).length > 1; }
function totalXp(actor) { return classItems(actor).reduce((sum, item) => sum + classXp(actor, item), 0); }
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
      slug: classSlug(item),
      level: classLevel(actor, item),
      xp: classXp(actor, item)
    }));
    return {
      actor,
      actorId: actor.id,
      name: actor.name,
      classes,
      multiclass: classes.length > 1,
      xp: classes.length ? classes.reduce((sum, entry) => sum + entry.xp, 0) : Math.max(0, Math.floor(num(actor.system?.xp, 0))),
      playerOwned: playerOwned(actor),
      checked: playerOwned(actor)
    };
  });
}
function splitInteger(total, keys) {
  const amount = Math.max(0, Math.floor(num(total, 0)));
  const list = keys.filter(Boolean);
  if (!list.length) return {};
  const base = Math.floor(amount / list.length);
  let remaining = amount - (base * list.length);
  const output = {};
  for (const key of list) {
    output[key] = base + (remaining > 0 ? 1 : 0);
    if (remaining > 0) remaining -= 1;
  }
  return output;
}
function levelForXp(item, xp) {
  if (typeof globalThis.add2eMulticlassLevelForClassXp === "function") return Math.max(1, Math.floor(globalThis.add2eMulticlassLevelForClassXp(item.system ?? {}, xp)));
  const rows = Array.isArray(item?.system?.progression) ? item.system.progression : [];
  let level = 1;
  for (const row of rows) {
    const threshold = num(row?.xp, NaN);
    if (Number.isFinite(threshold) && xp >= threshold) level = Math.max(level, Math.floor(num(row?.level ?? row?.niveau, level)));
  }
  return level;
}
function titleForLevel(item, level) {
  const row = (item?.system?.progression ?? []).find(entry => Number(entry?.level ?? entry?.niveau) === level);
  return String(row?.title ?? row?.titre ?? "");
}
function nextXpForLevel(item, level) {
  const rows = (item?.system?.progression ?? []).map(row => ({ level: num(row?.level ?? row?.niveau, 0), xp: num(row?.xp, NaN) })).filter(row => row.level > level && Number.isFinite(row.xp));
  return rows.length ? Math.min(...rows.map(row => row.xp)) : 0;
}

async function applyXpToActor(actor, amount, reason) {
  const classes = classItems(actor);
  if (!classes.length) throw new Error(`${actor.name} ne possède aucun Item classe.`);
  const gain = Math.max(0, Math.floor(num(amount, 0)));
  const before = totalXp(actor);
  const split = splitInteger(gain, classes.map(item => item.id));
  const updates = [];
  const breakdown = [];
  for (const item of classes) {
    const oldXp = classXp(actor, item);
    const xp = oldXp + (split[item.id] ?? 0);
    const level = levelForXp(item, xp);
    updates.push({ _id: item.id, "system.xp": xp, "system.niveau": level });
    breakdown.push({ item, before: oldXp, gained: split[item.id] ?? 0, after: xp, level });
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
    const next = nextXpForLevel(entry.item, entry.level);
    await actor.update({
      "system.xp": entry.after,
      "system.niveau": entry.level,
      "system.niveau_suggere": entry.level,
      "system.titre": titleForLevel(entry.item, entry.level),
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
function chatResult(results, distribution, data) {
  const lines = results.map(row => {
    const classes = row.result.classes.map(entry => `${esc(entry.item.name)} +${entry.gained.toLocaleString()} (${entry.before.toLocaleString()} → ${entry.after.toLocaleString()}, niv. ${entry.level})`).join(" ; ");
    return `<li><b>${esc(row.actor.name)}</b> : +${row.gained.toLocaleString()} XP — ${classes}</li>`;
  }).join("");
  return ChatMessage.create({ content: `<section style="border:2px solid #a87924;border-radius:10px;background:#fff8df;padding:.75em;color:#2b1b0c;"><h2 style="margin:.1em 0 .45em;color:#7d331f;">Bilan XP de session</h2><p>Total réparti : <b>${distribution.total.toLocaleString()} XP</b> — Monstres ${distribution.sourceXp.toLocaleString()} XP, objectifs ${data.objectives.toLocaleString()} XP, trésors ${data.treasure.toLocaleString()} XP, bonus MJ ${data.gmBonus.toLocaleString()} XP.</p><ul>${lines}</ul></section>` });
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

Hooks.once("init", () => {
  game.settings.register("add2e", FLAG_LEDGER, { name: "ADD2E — Registre XP de session", scope: "world", config: false, type: Array, default: [] });
});
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