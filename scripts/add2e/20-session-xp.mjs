// ADD2E — XP de session automatisée — ApplicationV2
// Version : 2026-06-12-session-xp-v5-player-owned-recipients-dedupe
//
// Règles :
// - Les monstres ne montent jamais de niveau.
// - Un monstre est une source de PX uniquement.
// - Seuls les monstres morts ou tombés à 0 PV apparaissent dans le bilan/récap.
// - Le récap chat affiche le partage de chaque monstre entre les personnages.
// - Le bilan XP est une ApplicationV2 native, sans Dialog V1.
// - L'XP est appliquée uniquement aux acteurs type "personnage" cochés.
// - Seuls les personnages possédés par un joueur non-MJ sont cochés par défaut.
// - Les personnages multiclassés reçoivent leur part globale, puis cette part est divisée entre leurs classes.
// - Les tokens non liés des personnages reçoivent aussi la même XP système.

const VERSION = "2026-06-12-session-xp-v5-player-owned-recipients-dedupe";
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
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "xp", "px", "pdv", "pv", "hp", "niveau", "level"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
    return fallback;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function clone(value) {
  return foundry.utils.deepClone(value ?? {});
}

function nowIso() {
  try { return new Date().toISOString(); }
  catch (_e) { return String(Date.now()); }
}

function currentLedger() {
  try {
    const ledger = game.settings.get("add2e", FLAG_LEDGER);
    return Array.isArray(ledger) ? ledger : [];
  } catch (_e) {
    return [];
  }
}

async function saveLedger(ledger) {
  if (!game.user?.isGM) return;
  await game.settings.set("add2e", FLAG_LEDGER, Array.isArray(ledger) ? ledger : []);
}

function monsterXpValue(actor) {
  const sys = actor?.system ?? {};
  return Math.max(0, Math.floor(num(sys.xp ?? sys.px ?? sys.experience ?? sys.experiencePoints ?? sys.points_experience ?? 0, 0)));
}

function actorHpValue(actor) {
  const sys = actor?.system ?? {};
  return num(sys.pdv ?? sys.pv ?? sys.hp ?? sys.points_de_vie ?? sys.hitPoints ?? 0, 0);
}

function changedHpValue(changes, fallback) {
  const paths = ["system.pdv", "system.pv", "system.hp", "system.hp.value", "system.points_de_vie", "system.hitPoints"];
  for (const path of paths) {
    if (foundry.utils.hasProperty(changes, path)) return num(foundry.utils.getProperty(changes, path), fallback);
  }
  return null;
}

function isDeadMonsterActor(actor) {
  return actor?.type === "monster" && actorHpValue(actor) <= 0;
}

function actorDropsToZero(actor, changes) {
  if (!actor || actor.type !== "monster") return false;
  const before = actorHpValue(actor);
  const after = changedHpValue(changes, before);
  return after !== null && before > 0 && after <= 0;
}

function tokenDropsToZero(tokenDoc, changes) {
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "monster") return false;
  const delta = changes?.actorDelta ?? changes?.delta ?? null;
  if (!delta) return false;
  const before = actorHpValue(actor);
  const after = changedHpValue(delta, before);
  return after !== null && before > 0 && after <= 0;
}

function canRecordFromUser(userId) {
  if (!game.user?.isGM) return false;
  if (!userId) return true;
  return game.user.id === userId || game.users.get(userId)?.isGM;
}

function tokenKey({ actor = null, tokenDoc = null, scene = null } = {}) {
  const sceneId = scene?.id ?? tokenDoc?.parent?.id ?? tokenDoc?.scene?.id ?? "world";
  const tokenId = tokenDoc?.id ?? "actor";
  const actorId = actor?.id ?? tokenDoc?.actor?.id ?? tokenDoc?.actorId ?? "unknown";
  return `${sceneId}:${tokenId}:${actorId}`;
}

function buildLedgerEntry(actor, { tokenDoc = null, scene = null, reason = "pv_zero", xpOverride = null } = {}) {
  const xp = Math.max(0, Math.floor(num(xpOverride ?? monsterXpValue(actor), 0)));
  const realScene = scene ?? tokenDoc?.parent ?? tokenDoc?.scene ?? canvas?.scene ?? null;
  const hp = actorHpValue(actor);
  return {
    key: tokenKey({ actor, tokenDoc, scene: realScene }),
    actorId: actor?.id ?? tokenDoc?.actorId ?? "",
    actorUuid: actor?.uuid ?? "",
    tokenId: tokenDoc?.id ?? "",
    tokenName: tokenDoc?.name ?? actor?.name ?? "Monstre",
    monsterName: actor?.name ?? tokenDoc?.name ?? "Monstre",
    sceneId: realScene?.id ?? "",
    sceneName: realScene?.name ?? "",
    xp,
    hp,
    dead: hp <= 0,
    reason,
    recordedAt: nowIso(),
    included: hp <= 0
  };
}

async function markRecorded(actor, tokenDoc, entry) {
  try { await actor?.setFlag?.(FLAG_SCOPE, FLAG_RECORDED, true); } catch (_e) {}
  try { await actor?.setFlag?.(FLAG_SCOPE, FLAG_RECORDED_KEY, entry.key); } catch (_e) {}
  try { await tokenDoc?.setFlag?.(FLAG_SCOPE, FLAG_RECORDED, true); } catch (_e) {}
  try { await tokenDoc?.setFlag?.(FLAG_SCOPE, FLAG_RECORDED_KEY, entry.key); } catch (_e) {}
}

function alreadyRecorded(actor, tokenDoc, ledger, key) {
  if (ledger.some(e => e?.key === key && e.included !== false)) return true;
  if (tokenDoc?.getFlag?.(FLAG_SCOPE, FLAG_RECORDED)) return true;
  if (!tokenDoc && actor?.getFlag?.(FLAG_SCOPE, FLAG_RECORDED)) return true;
  return false;
}

function ledgerEntryIsDead(entry) {
  if (!entry || entry.included === false) return false;
  if (entry.dead === true) return true;
  if (num(entry.hp, 1) <= 0) return true;
  const actor = game.actors?.get?.(entry.actorId);
  if (actor?.type === "monster" && actorHpValue(actor) <= 0) return true;
  const reason = String(entry.reason ?? "").toLowerCase();
  return /pv_zero|dead|mort/.test(reason) && !/^token_deleted$/.test(reason);
}

async function recordMonsterXp(actor, { tokenDoc = null, scene = null, reason = "pv_zero", notify = false, force = false } = {}) {
  if (!game.user?.isGM) return null;
  if (!actor || actor.type !== "monster") return null;
  if (!isDeadMonsterActor(actor)) {
    log("[RECORD][SKIP_ALIVE]", { actor: actor.name, hp: actorHpValue(actor), reason });
    return null;
  }

  const entry = buildLedgerEntry(actor, { tokenDoc, scene, reason });
  const ledger = currentLedger();
  if (!force && alreadyRecorded(actor, tokenDoc, ledger, entry.key)) {
    log("[RECORD][SKIP_ALREADY]", { actor: actor.name, key: entry.key });
    return null;
  }

  ledger.push(entry);
  await saveLedger(ledger);
  await markRecorded(actor, tokenDoc, entry);
  log("[RECORD][OK]", entry);
  if (notify) ui.notifications.info(`${entry.monsterName} enregistré pour ${entry.xp.toLocaleString()} PX.`);
  return entry;
}

function queueRecord(actor, options = {}) {
  if (!actor || actor.type !== "monster") return;
  setTimeout(() => recordMonsterXp(actor, options).catch(err => console.error(`${TAG}[RECORD][ERROR]`, err)), 0);
}

function allSceneMonsterRows() {
  const activeKeys = new Set(currentLedger().filter(ledgerEntryIsDead).map(e => e.key));
  const rows = [];
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens ?? []) {
      const actor = tokenDoc.actor;
      if (!actor || actor.type !== "monster") continue;
      const hp = actorHpValue(actor);
      if (hp > 0) continue;
      const key = tokenKey({ actor, tokenDoc, scene });
      rows.push({
        key,
        source: "scene",
        actor,
        tokenDoc,
        scene,
        actorId: actor.id,
        actorUuid: actor.uuid,
        tokenId: tokenDoc.id,
        tokenName: tokenDoc.name,
        monsterName: actor.name,
        sceneId: scene.id,
        sceneName: scene.name,
        xp: monsterXpValue(actor),
        hp,
        dead: true,
        included: true,
        alreadyRecorded: activeKeys.has(key),
        checked: true,
        reason: "pv_zero_scene"
      });
    }
  }
  return rows;
}

function activeLedgerRows() {
  return currentLedger().filter(ledgerEntryIsDead).map(entry => ({ ...entry, source: "ledger", alreadyRecorded: true, checked: true, dead: true }));
}

function rowTokenIdentity(row) {
  if (row?.sceneId && row?.tokenId) return `token:${row.sceneId}:${row.tokenId}`;
  return "";
}

function rowActorIdentity(row) {
  const actorPart = row?.actorUuid || row?.actorId || norm(row?.monsterName || row?.tokenName || "monstre");
  const scenePart = row?.sceneId || row?.sceneName || "world";
  return `actor:${scenePart}:${actorPart}:${norm(row?.monsterName || row?.tokenName || "monstre")}`;
}

function sceneRowsNotInActiveLedger() {
  const ledgerTokenKeys = new Set(activeLedgerRows().map(rowTokenIdentity).filter(Boolean));
  return allSceneMonsterRows()
    .filter(row => row && !ledgerTokenKeys.has(rowTokenIdentity(row)) && !row.alreadyRecorded)
    .map(row => ({ ...row, checked: true }));
}

function sourceRowsForApp() {
  const sceneDeadRows = allSceneMonsterRows();
  const sceneActorKeys = new Set(sceneDeadRows.map(rowActorIdentity));
  const rows = [];
  const keys = new Set();
  const actorKeys = new Set();

  for (const row of [...activeLedgerRows(), ...sceneRowsNotInActiveLedger()]) {
    if (!row?.key) continue;
    const tokenIdentity = rowTokenIdentity(row);
    const actorIdentity = rowActorIdentity(row);

    if (row.source === "ledger" && !tokenIdentity && sceneActorKeys.has(actorIdentity)) continue;
    const dedupeKey = tokenIdentity || actorIdentity || row.key;
    if (keys.has(dedupeKey)) continue;
    if (!tokenIdentity && actorKeys.has(actorIdentity)) continue;

    keys.add(dedupeKey);
    actorKeys.add(actorIdentity);
    rows.push(row);
  }
  return rows;
}

function classItems(actor) {
  return (actor?.items?.contents ?? Array.from(actor?.items ?? [])).filter(i => String(i.type || "").toLowerCase() === "classe");
}

function classSlug(itemOrSystem) {
  const sys = itemOrSystem?.system ?? itemOrSystem ?? {};
  return norm(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? itemOrSystem?.name ?? "classe");
}

function isMulticlassActor(actor) {
  if (!actor || actor.type !== "personnage") return false;
  if (typeof globalThis.add2eMulticlassEnabled === "function") {
    try { if (globalThis.add2eMulticlassEnabled(actor)) return true; } catch (_e) {}
  }
  return actor.system?.multiclasse?.enabled === true || classItems(actor).length > 1;
}

function isPlayerOwnedCharacter(actor) {
  if (!actor || actor.type !== "personnage") return false;
  const users = Array.from(game.users ?? []).filter(user => !user?.isGM);
  for (const user of users) {
    try {
      if (actor.testUserPermission?.(user, "OWNER")) return true;
    } catch (_e) {}
    try {
      if (Number(actor.ownership?.[user.id] ?? 0) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) return true;
    } catch (_e) {}
  }
  return false;
}

function currentXp(actor) {
  return Math.max(0, Math.floor(num(actor?.system?.xp, 0)));
}

function currentClassXpMap(actor) {
  const map = clone(actor?.system?.xp_par_classe ?? {});
  for (const cls of classItems(actor)) {
    const slug = classSlug(cls);
    if (!slug) continue;
    map[slug] = Math.max(0, Math.floor(num(map[slug] ?? cls.system?.xp ?? 0, 0)));
  }
  return map;
}

function splitInteger(total, keys) {
  const amount = Math.max(0, Math.floor(num(total, 0)));
  const list = (keys ?? []).filter(Boolean);
  if (!list.length) return {};
  const base = Math.floor(amount / list.length);
  let remainder = amount - base * list.length;
  const out = {};
  for (const key of list) {
    out[key] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return out;
}

function characterDisplay(row) {
  const ownerNote = row.playerOwned ? "" : " — aucun propriétaire joueur";
  if (!row.multiclass) return `Niv. ${esc(row.level)}${ownerNote}`;
  const parts = row.classes.map(c => `${esc(c.name)} ${esc(c.level)} (${c.xp.toLocaleString()} XP)`).join(" / ");
  return `Multiclasse — ${parts}${ownerNote}`;
}

function characterRows() {
  return (game.actors?.filter(a => a.type === "personnage") ?? []).map(actor => {
    const classes = classItems(actor).map(cls => {
      const slug = classSlug(cls);
      const xpMap = actor.system?.xp_par_classe ?? {};
      const levelMap = actor.system?.niveaux_par_classe ?? {};
      return {
        slug,
        name: cls.name,
        level: Math.max(1, Math.floor(num(levelMap?.[slug] ?? cls.system?.niveau ?? actor.system?.niveau ?? 1, 1))),
        xp: Math.max(0, Math.floor(num(xpMap?.[slug] ?? cls.system?.xp ?? 0, 0)))
      };
    });
    const playerOwned = isPlayerOwnedCharacter(actor);
    return {
      actor,
      actorId: actor.id,
      name: actor.name,
      level: Math.max(1, num(actor.system?.niveau, 1)),
      xp: currentXp(actor),
      multiclass: isMulticlassActor(actor),
      classes,
      playerOwned,
      checked: playerOwned
    };
  });
}

function auditXpFields() {
  const monsters = game.actors?.filter(a => a.type === "monster") ?? [];
  const chars = game.actors?.filter(a => a.type === "personnage") ?? [];
  const monsterRows = monsters.map(actor => ({ id: actor.id, name: actor.name, xp: monsterXpValue(actor), rawXp: actor.system?.xp, hp: actorHpValue(actor), dead: actorHpValue(actor) <= 0, ok: monsterXpValue(actor) > 0 }));
  const characterRowsAudit = chars.map(actor => ({ id: actor.id, name: actor.name, playerOwned: isPlayerOwnedCharacter(actor), xp: actor.system?.xp, niveau: actor.system?.niveau, multiclasse: isMulticlassActor(actor), xp_par_classe: actor.system?.xp_par_classe, niveaux_par_classe: actor.system?.niveaux_par_classe, classes: classItems(actor).map(c => c.name), progression_xp: actor.system?.progression_xp, ok: actor.system?.xp !== undefined && actor.system?.niveau !== undefined }));
  const result = { version: VERSION, monsters: monsterRows, deadMonsters: monsterRows.filter(r => r.dead), aliveMonstersIgnored: monsterRows.filter(r => !r.dead), characters: characterRowsAudit, monstersWithoutXp: monsterRows.filter(r => !r.ok), charactersWithMissingXpFields: characterRowsAudit.filter(r => !r.ok), ledger: currentLedger(), visibleSources: sourceRowsForApp() };
  console.table(monsterRows);
  console.table(characterRowsAudit);
  log("[AUDIT]", result);
  return result;
}

function sourceRowHtml(row) {
  const checked = row.checked || row.included ? "checked" : "";
  const hpValue = row.hp ?? "0";
  const hpText = `<span class="a2e-xp-chip dead">Mort / PV ${esc(hpValue)}</span>`;
  return `<tr class="a2e-xp-source-row" data-key="${esc(row.key)}" data-source="${esc(row.source)}" data-monster-name="${esc(row.monsterName)}" data-token-name="${esc(row.tokenName)}" data-scene-name="${esc(row.sceneName)}" data-scene-id="${esc(row.sceneId)}" data-token-id="${esc(row.tokenId)}" data-actor-id="${esc(row.actorId)}" data-actor-uuid="${esc(row.actorUuid)}" data-reason="${esc(row.reason || row.source)}">
    <td class="center"><input type="checkbox" data-role="include-source" ${checked}></td>
    <td><div class="a2e-xp-name"><strong>${esc(row.monsterName || row.tokenName)}</strong>${hpText}</div></td>
    <td>${esc(row.sceneName || "—")}</td>
    <td class="right"><input class="a2e-xp-number" type="number" data-role="source-xp" value="${Math.max(0, Math.floor(num(row.xp, 0)))}" min="0" step="1"></td>
  </tr>`;
}

function characterRowHtml(row) {
  const checked = row.checked ? "checked" : "";
  const ownerChip = row.playerOwned ? `<span class="a2e-xp-chip player">Joueur</span>` : `<span class="a2e-xp-chip muted">Non joueur</span>`;
  return `<tr class="a2e-xp-character-row" data-actor-id="${esc(row.actorId)}">
    <td class="center"><input type="checkbox" data-role="include-character" ${checked}></td>
    <td><strong>${esc(row.name)}</strong> ${ownerChip}<br><small>${characterDisplay(row)}</small></td>
    <td class="right current-xp">${row.xp.toLocaleString()}</td>
    <td class="right"><input class="a2e-xp-number small" type="number" data-role="share" value="1" min="0" step="0.5"></td>
    <td class="right"><input class="a2e-xp-number small" type="number" data-role="bonus-percent" value="0" step="1"></td>
    <td class="right"><input class="a2e-xp-number small" type="number" data-role="bonus-flat" value="0" step="1"></td>
  </tr>`;
}

function appHtml() {
  const sourceRows = sourceRowsForApp();
  const chars = characterRows();
  return `<div class="add2e-session-xp-v2">
    <style>
      .add2e-session-xp-v2{--gold:#d7ba63;--red:#8d2b22;--green:#267a3d;--blue:#235f8f;--panel:#fffaf0;height:100%;overflow:hidden;display:flex;flex-direction:column;color:#2b1b0c;background:linear-gradient(135deg,#f8efd7 0%,#ead7a8 100%)}
      .add2e-session-xp-v2 *{box-sizing:border-box}.add2e-session-xp-v2 .scroll{overflow-y:auto;padding:8px 10px 4px;min-height:0;flex:1}
      .add2e-session-xp-v2 h3{margin:10px 0 6px;padding:7px 10px;border-radius:7px;background:linear-gradient(90deg,#7d331f,#b06b2d);color:#fff;font-size:1.05rem;text-shadow:0 1px 1px #000}
      .add2e-session-xp-v2 .hint{margin:4px 0 8px;padding:7px 9px;border-left:4px solid var(--blue);background:#eef6ff;border-radius:5px;color:#1f3550}
      .add2e-session-xp-v2 table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0 12px;background:var(--panel);box-shadow:0 1px 3px rgba(0,0,0,.18)}
      .add2e-session-xp-v2 th,.add2e-session-xp-v2 td{border:1px solid var(--gold);padding:6px 7px;vertical-align:middle;color:#2b1b0c}.add2e-session-xp-v2 th{background:linear-gradient(180deg,#f0dda2,#d9bd65);color:#3b2207;font-weight:900;text-shadow:none}
      .add2e-session-xp-v2 tbody tr:nth-child(even){background:#fff5dc}.add2e-session-xp-v2 tbody tr:hover{background:#fff0bd}.add2e-session-xp-v2 .center{text-align:center}.add2e-session-xp-v2 .right{text-align:right}
      .add2e-session-xp-v2 input[type="checkbox"]{width:20px;height:20px;accent-color:#346f38}.add2e-session-xp-v2 .a2e-xp-number{width:86px;max-width:100%;text-align:right;padding:4px 6px;border:1px solid #9d8542;border-radius:5px;background:#fff;color:#111;font-weight:700}.add2e-session-xp-v2 .a2e-xp-number.small{width:68px}
      .add2e-session-xp-v2 .a2e-xp-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.add2e-session-xp-v2 .a2e-xp-chip{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:.72rem;font-weight:800;border:1px solid #bfa65a;background:#fff6d8;color:#4a300b}.add2e-session-xp-v2 .a2e-xp-chip.dead{border-color:#9d2d25;background:#ffe4df;color:#8d2b22}.add2e-session-xp-v2 .a2e-xp-chip.player{border-color:#267a3d;background:#e7ffe7;color:#1f642e}.add2e-session-xp-v2 .a2e-xp-chip.muted{border-color:#9a8a70;background:#eee7dc;color:#69563f}
      .add2e-session-xp-v2 .global-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:6px 0 12px}.add2e-session-xp-v2 .global-grid label{display:flex;flex-direction:column;gap:3px;padding:7px;border:1px solid var(--gold);border-radius:7px;background:#fffaf0;font-weight:800;color:#4a2d0a}.add2e-session-xp-v2 .global-grid input{width:100%;padding:5px 7px;border:1px solid #9d8542;border-radius:5px;background:#fff;color:#111}
      .add2e-session-xp-v2 .footer-note{padding:7px 9px;border-radius:6px;background:#f1fff0;border:1px solid #7caf78;color:#285c2a;font-weight:700}.add2e-session-xp-v2 .source-table col:nth-child(1){width:62px}.add2e-session-xp-v2 .source-table col:nth-child(2){width:auto}.add2e-session-xp-v2 .source-table col:nth-child(3){width:120px}.add2e-session-xp-v2 .source-table col:nth-child(4){width:105px}.add2e-session-xp-v2 .char-table col:nth-child(1){width:62px}.add2e-session-xp-v2 .char-table col:nth-child(2){width:auto}.add2e-session-xp-v2 .char-table col:nth-child(3){width:105px}.add2e-session-xp-v2 .char-table col:nth-child(4){width:82px}.add2e-session-xp-v2 .char-table col:nth-child(5){width:92px}.add2e-session-xp-v2 .char-table col:nth-child(6){width:92px}
      .add2e-session-xp-v2 .buttons{display:flex;gap:8px;justify-content:flex-end;padding:9px 10px;border-top:1px solid #b99742;background:#e5d09a;flex:0 0 auto}.add2e-session-xp-v2 button{padding:7px 12px;border:1px solid #7a5a16;border-radius:6px;background:#fff7d9;color:#2c1a07;font-weight:800;cursor:pointer}.add2e-session-xp-v2 button.apply{background:#2d7a3e;color:#fff;border-color:#1f5a2d}.add2e-session-xp-v2 button.reset{background:#8d2b22;color:#fff;border-color:#6f1d17}.add2e-session-xp-v2 button:disabled{opacity:.55;cursor:wait}
    </style>
    <div class="scroll">
      <h3>Sources d'XP monstres morts</h3><div class="hint">Seuls les monstres morts ou à 0 PV apparaissent ici. Le registre et la scène sont dédoublonnés pour éviter de compter deux fois le même token.</div>
      <table class="source-table"><colgroup><col><col><col><col></colgroup><thead><tr><th>Incl.</th><th>Monstre mort</th><th>Scène</th><th>PX</th></tr></thead><tbody>${sourceRows.map(sourceRowHtml).join("") || `<tr><td colspan="4"><em>Aucun monstre mort enregistré ou présent sur les scènes.</em></td></tr>`}</tbody></table>
      <h3>Bonus globaux</h3><div class="global-grid"><label>Objectifs / rôleplay <input type="number" name="objectivesXp" value="0" step="1"></label><label>Trésors <input type="number" name="treasureXp" value="0" step="1"></label><label>Bonus MJ global <input type="number" name="gmBonusXp" value="0" step="1"></label><label>Motif <input type="text" name="reason" value="Bilan XP de session"></label></div>
      <h3>Répartition vers les personnages</h3><div class="hint">Seuls les personnages possédés par au moins un joueur non-MJ sont cochés par défaut. Les autres restent visibles mais décochés.</div><table class="char-table"><colgroup><col><col><col><col><col><col></colgroup><thead><tr><th>Incl.</th><th>Personnage</th><th>XP actuel</th><th>Part</th><th>Bonus %</th><th>Bonus fixe</th></tr></thead><tbody>${chars.map(characterRowHtml).join("") || `<tr><td colspan="6"><em>Aucun personnage trouvé.</em></td></tr>`}</tbody></table>
      <div class="footer-note">Application : mono-classe = XP globale. Multiclasse = XP globale répartie également entre les classes, puis recalcul des niveaux par classe.</div>
    </div>
    <div class="buttons"><button type="button" data-action="audit">Audit champs</button><button type="button" class="reset" data-action="reset">Réinitialiser registre</button><button type="button" class="apply" data-action="apply">Appliquer l'XP</button><button type="button" data-action="close">Fermer</button></div>
  </div>`;
}

function readAppData(root) {
  const selectedSources = [...root.querySelectorAll(".a2e-xp-source-row")].map(row => {
    if (row.querySelector("[data-role='include-source']")?.checked !== true) return null;
    return { key: row.dataset.key || "", source: row.dataset.source || "", monsterName: row.dataset.monsterName || row.dataset.tokenName || "Monstre", tokenName: row.dataset.tokenName || row.dataset.monsterName || "Monstre", sceneName: row.dataset.sceneName || "", sceneId: row.dataset.sceneId || "", tokenId: row.dataset.tokenId || "", actorId: row.dataset.actorId || "", actorUuid: row.dataset.actorUuid || "", reason: row.dataset.reason || "session_xp", xp: Math.max(0, Math.floor(num(row.querySelector("[data-role='source-xp']")?.value, 0))) };
  }).filter(Boolean);

  const recipients = [...root.querySelectorAll(".a2e-xp-character-row")].map(row => {
    if (row.querySelector("[data-role='include-character']")?.checked !== true) return null;
    const actor = game.actors.get(row.dataset.actorId || "");
    if (!actor || actor.type !== "personnage") return null;
    const share = Math.max(0, num(row.querySelector("[data-role='share']")?.value, 1));
    if (share <= 0) return null;
    return { actor, actorId: actor.id, name: actor.name, share, bonusPercent: num(row.querySelector("[data-role='bonus-percent']")?.value, 0), bonusFlat: Math.floor(num(row.querySelector("[data-role='bonus-flat']")?.value, 0)) };
  }).filter(Boolean);

  const objectivesXp = Math.max(0, Math.floor(num(root.querySelector("input[name='objectivesXp']")?.value, 0)));
  const treasureXp = Math.max(0, Math.floor(num(root.querySelector("input[name='treasureXp']")?.value, 0)));
  const gmBonusXp = Math.max(0, Math.floor(num(root.querySelector("input[name='gmBonusXp']")?.value, 0)));
  const monsterXp = selectedSources.reduce((sum, row) => sum + row.xp, 0);
  return { selectedSources, recipients, monsterXp, objectivesXp, treasureXp, gmBonusXp, sourceTotal: monsterXp + objectivesXp + treasureXp + gmBonusXp, reason: root.querySelector("input[name='reason']")?.value || "Bilan XP de session" };
}

function splitXpByShares(totalXp, recipients) {
  const xp = Math.max(0, Math.floor(num(totalXp, 0)));
  const shareTotal = recipients.reduce((sum, row) => sum + Math.max(0, num(row.share, 0)), 0);
  if (xp <= 0 || shareTotal <= 0) return recipients.map(row => ({ ...row, base: 0, raw: 0, fraction: 0 }));
  const rows = recipients.map(row => { const raw = xp * (row.share / shareTotal); const base = Math.floor(raw); return { ...row, raw, base, fraction: raw - base }; });
  let remainder = xp - rows.reduce((sum, row) => sum + row.base, 0);
  for (const row of [...rows].sort((a, b) => b.fraction - a.fraction)) { if (remainder <= 0) break; row.base += 1; remainder -= 1; }
  return rows;
}

function computeDistribution(data) {
  const rows = splitXpByShares(data.sourceTotal, data.recipients);
  return rows.map(row => { const percentBonus = Math.floor(row.base * (row.bonusPercent / 100)); const total = Math.max(0, row.base + percentBonus + row.bonusFlat); return { ...row, percentBonus, total }; });
}

function computeMonsterShareRows(data) {
  return data.selectedSources.map(source => ({ ...source, shares: splitXpByShares(source.xp, data.recipients).map(row => ({ actorId: row.actorId, name: row.name, share: row.share, xp: row.base })) }));
}

async function markSourcesApplied(selectedSources, reason) {
  const ledger = currentLedger();
  const appliedAt = nowIso();
  for (const source of selectedSources) {
    const existingIndex = ledger.findIndex(entry => entry?.key === source.key);
    const appliedEntry = { ...(existingIndex >= 0 ? ledger[existingIndex] : {}), key: source.key, actorId: source.actorId, actorUuid: source.actorUuid, tokenId: source.tokenId, tokenName: source.tokenName, monsterName: source.monsterName, sceneId: source.sceneId, sceneName: source.sceneName, xp: source.xp, dead: true, reason: source.reason || "session_apply", included: false, appliedAt, appliedReason: reason };
    if (existingIndex >= 0) ledger[existingIndex] = appliedEntry;
    else ledger.push(appliedEntry);
  }
  await saveLedger(ledger);
}

function unlinkedTokenDocsForActor(actor) {
  const rows = [];
  if (!actor?.id) return rows;
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens ?? []) {
      if (tokenDoc.actorId !== actor.id) continue;
      if (tokenDoc.actorLink === true) continue;
      const tokenActor = tokenDoc.actor;
      if (!tokenActor || tokenActor.type !== "personnage") continue;
      rows.push({ scene, tokenDoc, tokenActor });
    }
  }
  return rows;
}

function multiclassPayload(actor, xpMap) {
  if (typeof globalThis.add2eMulticlassUpdatePayload === "function") {
    try { const payload = globalThis.add2eMulticlassUpdatePayload(actor, null, xpMap, null); if (payload && typeof payload === "object") return payload; }
    catch (err) { warn("[MULTICLASS_PAYLOAD][ERROR]", { actor: actor.name, err }); }
  }
  const total = Object.values(xpMap ?? {}).reduce((sum, value) => sum + Math.max(0, Math.floor(num(value, 0))), 0);
  return { "system.xp": total, "system.xp_par_classe": xpMap };
}

function multiclassAwardPlan(actor, amount) {
  const classes = classItems(actor);
  const keys = classes.map(classSlug).filter(Boolean);
  const beforeMap = currentClassXpMap(actor);
  const deltas = splitInteger(amount, keys);
  const afterMap = { ...beforeMap };
  for (const key of keys) afterMap[key] = Math.max(0, Math.floor(num(beforeMap[key], 0))) + Math.max(0, Math.floor(num(deltas[key], 0)));
  return { classes, keys, beforeMap, deltas, afterMap };
}

async function syncXpToUnlinkedTokens(actor, updatePayload, fallbackXpValue) {
  const updates = [];
  const rows = unlinkedTokenDocsForActor(actor);
  for (const row of rows) {
    const before = currentXp(row.tokenActor);
    try {
      let payload = clone(updatePayload);
      if (isMulticlassActor(row.tokenActor) && updatePayload?.["system.xp_par_classe"]) payload = multiclassPayload(row.tokenActor, updatePayload["system.xp_par_classe"]);
      if (!payload || !Object.keys(payload).length) payload = { "system.xp": fallbackXpValue };
      await row.tokenActor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "session-xp-token-sync" });
      if (isMulticlassActor(row.tokenActor) && typeof globalThis.add2eRecalcMulticlassActor === "function") await globalThis.add2eRecalcMulticlassActor(row.tokenActor).catch(() => null);
      const after = currentXp(row.tokenActor);
      updates.push({ scene: row.scene.name, token: row.tokenDoc.name, before, after, ok: after === fallbackXpValue });
    } catch (err) {
      updates.push({ scene: row.scene.name, token: row.tokenDoc.name, before, after: before, ok: false, error: err?.message ?? String(err) });
      warn("[TOKEN_SYNC][ERROR]", { actor: actor.name, scene: row.scene.name, token: row.tokenDoc.name, err });
    }
  }
  if (updates.length) log("[TOKEN_SYNC][DONE]", { actor: actor.name, xp: fallbackXpValue, tokens: updates });
  return updates;
}

function refreshActorAndTokenSheets(actor) {
  const actorId = actor?.id;
  for (const app of Object.values(ui.windows ?? {})) {
    try {
      const appActor = app?.actor ?? app?.document;
      if (!appActor) continue;
      const sameWorldActor = appActor.id === actorId;
      const sameBaseActor = appActor.isToken && appActor.prototypeToken?.actorId === actorId;
      const sameTokenBase = appActor.isToken && appActor.token?.actorId === actorId;
      if (sameWorldActor || sameBaseActor || sameTokenBase) app.render(false);
    } catch (_e) {}
  }
}

async function awardCharacterXp(actor, total, reason) {
  const amount = Math.max(0, Math.floor(num(total, 0)));
  const before = currentXp(actor);
  const multiclass = isMulticlassActor(actor);
  log("[AWARD][START]", { actor: actor.name, before, amount, reason, multiclass });

  let payload;
  let classBreakdown = [];
  if (multiclass) {
    const plan = multiclassAwardPlan(actor, amount);
    payload = multiclassPayload(actor, plan.afterMap);
    classBreakdown = plan.keys.map(key => ({ key, before: Math.max(0, Math.floor(num(plan.beforeMap[key], 0))), gained: Math.max(0, Math.floor(num(plan.deltas[key], 0))), after: Math.max(0, Math.floor(num(plan.afterMap[key], 0))) }));
    await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "session-xp-v5-multiclass" });
    if (typeof globalThis.add2eRecalcMulticlassActor === "function") await globalThis.add2eRecalcMulticlassActor(actor).catch(err => warn("[AWARD][MULTICLASS_RECALC]", { actor: actor.name, err }));
  } else {
    const expectedAfter = before + amount;
    payload = { "system.xp": expectedAfter };
    await actor.update(payload, { add2eReason: "session-xp-v5" });
  }

  const liveActor = game.actors.get(actor.id) ?? actor;
  const after = currentXp(liveActor);
  const expectedAfter = multiclass ? before + amount : payload["system.xp"];
  if (after !== expectedAfter) warn("[AWARD][VERIFY]", { actor: actor.name, before, amount, expectedAfter, after, multiclass });
  const tokenSync = await syncXpToUnlinkedTokens(liveActor, payload, after);
  refreshActorAndTokenSheets(liveActor);
  log("[AWARD][DONE]", { actor: actor.name, before, amount, expectedAfter, after, multiclass, classBreakdown, tokenSync });
  return { before, after, expectedAfter, tokenSync, multiclass, classBreakdown };
}

function monsterShareHtml(monsterShareRows) {
  return monsterShareRows.map(row => {
    const parts = row.shares.map(s => `<li>${esc(s.name)} : <b>${s.xp.toLocaleString()}</b> XP <small>(part ${esc(s.share)})</small></li>`).join("");
    return `<li><b>${esc(row.monsterName)}</b> : ${row.xp.toLocaleString()} PX${row.sceneName ? ` <small>(${esc(row.sceneName)})</small>` : ""}<ul>${parts || "<li>Aucun personnage inclus.</li>"}</ul></li>`;
  }).join("");
}

function classBreakdownHtml(row) {
  if (!row.multiclass || !row.classBreakdown?.length) return "";
  const parts = row.classBreakdown.map(c => `${esc(c.key)} +${c.gained.toLocaleString()} (${c.before.toLocaleString()} → ${c.after.toLocaleString()})`).join(" ; ");
  return ` <small>— classes : ${parts}</small>`;
}

async function applySessionXp(data) {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut appliquer l'XP de session.");
  if (data.sourceTotal <= 0) return ui.notifications.warn("Le total d'XP est à 0.");
  if (!data.recipients.length) return ui.notifications.warn("Aucun personnage destinataire sélectionné.");
  if (!data.selectedSources.length && data.monsterXp <= 0 && data.objectivesXp <= 0 && data.treasureXp <= 0 && data.gmBonusXp <= 0) return ui.notifications.warn("Aucune source d'XP sélectionnée.");

  const distribution = computeDistribution(data);
  const monsterShares = computeMonsterShareRows(data);
  const results = [];
  for (const row of distribution) {
    const awarded = await awardCharacterXp(row.actor, row.total, data.reason);
    results.push({ actor: game.actors.get(row.actor.id) ?? row.actor, before: awarded.before, after: awarded.after, expectedAfter: awarded.expectedAfter, gained: row.total, base: row.base, percentBonus: row.percentBonus, bonusFlat: row.bonusFlat, tokenSync: awarded.tokenSync ?? [], multiclass: awarded.multiclass, classBreakdown: awarded.classBreakdown ?? [] });
  }

  await markSourcesApplied(data.selectedSources, data.reason);
  const monsterLines = monsterShareHtml(monsterShares);
  const resultLines = results.map(row => {
    const tokenNote = row.tokenSync?.length ? ` <small>— tokens synchronisés : ${row.tokenSync.length}</small>` : "";
    return `<li>${esc(row.actor.name)} : +<b>${row.gained.toLocaleString()}</b> XP <small>(base ${row.base.toLocaleString()}${row.percentBonus ? `, bonus % ${row.percentBonus.toLocaleString()}` : ""}${row.bonusFlat ? `, bonus fixe ${row.bonusFlat.toLocaleString()}` : ""})</small> — ${row.before.toLocaleString()} → ${row.after.toLocaleString()}${classBreakdownHtml(row)}${tokenNote}</li>`;
  }).join("");

  await ChatMessage.create({ content: `<div class="add2e-xp-session-chat" style="border:2px solid #a87924;border-radius:10px;background:#fff8df;padding:.75em .95em;color:#2b1b0c;"><h2 style="margin:.1em 0 .45em;color:#7d331f;">Bilan XP de session</h2><p><b>Total réparti :</b> ${data.sourceTotal.toLocaleString()} XP</p><p><b>Monstres morts :</b> ${data.monsterXp.toLocaleString()} XP — <b>Objectifs :</b> ${data.objectivesXp.toLocaleString()} XP — <b>Trésors :</b> ${data.treasureXp.toLocaleString()} XP — <b>Bonus MJ :</b> ${data.gmBonusXp.toLocaleString()} XP</p><details open><summary><b>Monstres morts et partage par personnage</b></summary><ul>${monsterLines || "<li>Aucun monstre mort sélectionné.</li>"}</ul></details><details open><summary><b>Répartition finale appliquée</b></summary><ul>${resultLines}</ul></details></div>` });

  for (const row of results) refreshActorAndTokenSheets(row.actor);
  ui.notifications.info("XP de session appliquée. Les sources utilisées sont maintenant masquées.");
  log("[APPLIED]", { data, distribution, monsterShares, results });
  return { data, distribution, monsterShares, results };
}

class Add2eSessionXpApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "add2e-session-xp-app-v5", classes: ["add2e", "session-xp", "app-v2"], tag: "section", window: { title: "ADD2E — Bilan XP de session", resizable: true }, position: { width: 980, height: 780 } };
  async _renderHTML(_context, _options) { const wrapper = document.createElement("div"); wrapper.innerHTML = appHtml(); return wrapper; }
  _replaceHTML(result, content, _options) { content.replaceChildren(...result.childNodes); this._activateListeners(content); }
  _activateListeners(content) {
    const root = content.querySelector(".add2e-session-xp-v2");
    if (!root) return;
    root.querySelector("[data-action='audit']")?.addEventListener("click", ev => { ev.preventDefault(); auditXpFields(); });
    root.querySelector("[data-action='reset']")?.addEventListener("click", async ev => { ev.preventDefault(); await clearSessionXpLedger({ alsoFlags: true }); this.render({ force: true }); });
    root.querySelector("[data-action='apply']")?.addEventListener("click", async ev => {
      ev.preventDefault();
      ev.currentTarget.disabled = true;
      try { const data = readAppData(root); await applySessionXp(data); this.render({ force: true }); }
      catch (err) { console.error(`${TAG}[APPLY][ERROR]`, err); ui.notifications.error("Application de l'XP impossible. Voir console."); }
      finally { ev.currentTarget.disabled = false; }
    });
    root.querySelector("[data-action='close']")?.addEventListener("click", ev => { ev.preventDefault(); this.close(); });
  }
}

function openSessionXpApplication() {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut ouvrir le bilan XP.");
  const existing = Object.values(ui.windows ?? {}).find(app => app instanceof Add2eSessionXpApp);
  if (existing) return existing.render({ force: true });
  return new Add2eSessionXpApp().render(true);
}

async function clearSessionXpLedger({ alsoFlags = false } = {}) {
  if (!game.user?.isGM) return;
  await saveLedger([]);
  if (alsoFlags) {
    for (const actor of game.actors?.filter(a => a.type === "monster") ?? []) {
      await actor.unsetFlag(FLAG_SCOPE, FLAG_RECORDED).catch(() => null);
      await actor.unsetFlag(FLAG_SCOPE, FLAG_RECORDED_KEY).catch(() => null);
    }
    for (const scene of game.scenes ?? []) {
      const updates = [];
      for (const token of scene.tokens ?? []) {
        const flags = clone(token.flags ?? {});
        if (flags?.add2e?.[FLAG_RECORDED] || flags?.add2e?.[FLAG_RECORDED_KEY]) updates.push({ _id: token.id, [`flags.${FLAG_SCOPE}.-=${FLAG_RECORDED}`]: null, [`flags.${FLAG_SCOPE}.-=${FLAG_RECORDED_KEY}`]: null });
      }
      if (updates.length) await scene.updateEmbeddedDocuments("Token", updates).catch(err => warn("[CLEAR_FLAGS_TOKEN_ERROR]", err));
    }
  }
  ui.notifications.info("Registre XP de session vidé.");
}

async function registerTokenDeletion(tokenDoc) {
  if (!game.user?.isGM) return;
  const actor = tokenDoc?.actor;
  if (!actor || actor.type !== "monster") return;
  if (tokenDoc.getFlag?.(FLAG_SCOPE, FLAG_RECORDED)) return;
  const hp = actorHpValue(actor);
  if (hp > 0) return;
  await recordMonsterXp(actor, { tokenDoc, scene: tokenDoc.parent, reason: "token_deleted_dead", notify: false });
}

function openXpSessionFromTool() {
  try { openSessionXpApplication(); }
  catch (err) { console.error(`${TAG}[OPEN][ERROR]`, err); ui.notifications.error("Ouverture du bilan XP impossible. Voir console."); }
}

function xpToolDefinition() {
  return { name: "add2e-session-xp", title: "ADD2E — Bilan XP", icon: "fas fa-coins", button: true, visible: game.user?.isGM === true, onChange: () => openXpSessionFromTool() };
}

function installToolInControl(control, tool = xpToolDefinition()) {
  if (!control) return false;
  if (Array.isArray(control.tools)) { const existing = control.tools.find(t => t?.name === tool.name || t?.id === tool.name); if (existing) { delete existing.onClick; existing.onChange = tool.onChange; existing.button = true; existing.visible = tool.visible; } else control.tools.push(tool); return true; }
  if (control.tools instanceof Map) { const existing = control.tools.get(tool.name); if (existing) { delete existing.onClick; existing.onChange = tool.onChange; existing.button = true; existing.visible = tool.visible; } else control.tools.set(tool.name, tool); return true; }
  if (control.tools && typeof control.tools === "object") { const existing = control.tools[tool.name]; if (existing) { delete existing.onClick; existing.onChange = tool.onChange; existing.button = true; existing.visible = tool.visible; } else control.tools[tool.name] = tool; return true; }
  control.tools = [tool];
  return true;
}

function installSceneControlButton(controls) {
  if (!game.user?.isGM) return;
  const tool = xpToolDefinition();
  if (Array.isArray(controls)) { const tokenControl = controls.find(c => c?.name === "token" || c?.name === "tokens") ?? controls[0]; if (installToolInControl(tokenControl, tool)) return; controls.push({ name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: [tool], activeTool: tool.name }); return; }
  if (controls && typeof controls === "object") { const tokenControl = controls.token ?? controls.tokens ?? controls.Token ?? Object.values(controls).find(c => c?.name === "token" || c?.name === "tokens"); if (installToolInControl(tokenControl, tool)) return; controls.add2e = controls.add2e ?? { name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: {} }; installToolInControl(controls.add2e, tool); }
}

function rootFromHtml(html, app = null) {
  if (html?.jquery) return html[0];
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  if (app?.element instanceof HTMLElement) return app.element;
  return null;
}

function injectActorDirectoryButton(app, html) {
  if (!game.user?.isGM) return;
  const root = rootFromHtml(html, app);
  if (!root?.querySelector) return;
  if (root.querySelector(".add2e-session-xp-sidebar-btn")) return;
  const target = root.querySelector(".directory-header .header-actions") || root.querySelector(".directory-header") || root.querySelector("header") || root.querySelector(".window-content") || root;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "add2e-session-xp-sidebar-btn";
  btn.title = "ADD2E — Bilan XP de session";
  btn.innerHTML = `<i class="fas fa-coins"></i> XP MJ`;
  btn.style.cssText = "margin:4px 4px 6px 4px;padding:4px 8px;border:1px solid #9b7a2f;border-radius:5px;background:#ead99d;color:#3b2a08;font-weight:700;cursor:pointer;";
  btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); openXpSessionFromTool(); });
  target.prepend(btn);
}

Hooks.once("init", () => { game.settings.register("add2e", FLAG_LEDGER, { name: "ADD2E — Registre XP de session", hint: "Registre interne des monstres morts ou tombés à 0 PV pendant la session.", scope: "world", config: false, type: Array, default: [] }); });
Hooks.once("ready", () => { log("[READY]", { version: VERSION }); });
Hooks.on("preUpdateActor", (actor, changes, _options, userId) => { if (!canRecordFromUser(userId)) return true; if (!actorDropsToZero(actor, changes)) return true; queueRecord(actor, { reason: "pv_zero", notify: true }); return true; });
Hooks.on("preUpdateToken", (tokenDoc, changes, _options, userId) => { if (!canRecordFromUser(userId)) return true; if (!tokenDropsToZero(tokenDoc, changes)) return true; queueRecord(tokenDoc.actor, { tokenDoc, scene: tokenDoc.parent, reason: "token_pv_zero", notify: true }); return true; });
Hooks.on("preDeleteToken", tokenDoc => registerTokenDeletion(tokenDoc));
Hooks.on("getSceneControlButtons", controls => installSceneControlButton(controls));
Hooks.on("renderActorDirectory", injectActorDirectoryButton);
Hooks.on("renderSidebarTab", (app, html) => { const id = app?.id ?? app?.tabName ?? app?.constructor?.name ?? ""; if (/actor/i.test(String(id))) injectActorDirectoryButton(app, html); });

globalThis.add2eRecordMonsterXp = recordMonsterXp;
globalThis.add2eAuditXpFields = auditXpFields;
globalThis.add2eOpenXpSession = openSessionXpApplication;
globalThis.add2eCollectMonsterXpRows = allSceneMonsterRows;
globalThis.add2eCollectCharacterXpRows = characterRows;
globalThis.add2eSessionXpLedger = currentLedger;
globalThis.add2eClearSessionXpLedger = clearSessionXpLedger;
globalThis.add2eInstallXpSceneButton = installSceneControlButton;
globalThis.add2eInjectXpActorDirectoryButton = injectActorDirectoryButton;
globalThis.add2eSyncXpToUnlinkedTokens = syncXpToUnlinkedTokens;
globalThis.add2eSessionXpComputeMonsterShares = computeMonsterShareRows;
globalThis.add2eSessionXpAwardCharacter = awardCharacterXp;
