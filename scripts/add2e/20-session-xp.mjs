// ADD2E — XP de session automatisée — ApplicationV2
// Version : 2026-05-24-session-xp-v2-single-file-token-sync
//
// Règles :
// - Les monstres ne montent jamais de niveau.
// - Un monstre est une source de PX uniquement.
// - Un monstre est enregistré quand ses PV passent à 0 ou moins.
// - Un token monstre supprimé est enregistré par sécurité.
// - Le bilan XP est une ApplicationV2 native, sans Dialog V1.
// - Le bouton de scène utilise SceneControlTool#onChange, pas onClick.
// - L'XP est appliquée uniquement aux acteurs type "personnage".
// - Les tokens non liés des personnages reçoivent aussi la même XP.

const VERSION = "2026-05-24-session-xp-v2-single-file-token-sync";
const TAG = "[ADD2E][SESSION_XP]";
const FLAG_SCOPE = "add2e";
const FLAG_LEDGER = "sessionXpLedger";
const FLAG_RECORDED = "sessionXpRecorded";
const FLAG_RECORDED_KEY = "sessionXpRecordedKey";

const ApplicationV2 = foundry.applications.api.ApplicationV2;

globalThis.ADD2E_SESSION_XP_VERSION = VERSION;

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
}

function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "xp", "px", "pdv", "pv", "hp"]) {
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

function nowIso() {
  try { return new Date().toISOString(); }
  catch (_e) { return String(Date.now()); }
}

function currentLedger() {
  const ledger = game.settings.get("add2e", FLAG_LEDGER);
  return Array.isArray(ledger) ? ledger : [];
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
    reason,
    recordedAt: nowIso(),
    included: true
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

async function recordMonsterXp(actor, { tokenDoc = null, scene = null, reason = "pv_zero", notify = false, force = false } = {}) {
  if (!game.user?.isGM) return null;
  if (!actor || actor.type !== "monster") return null;

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
  const activeKeys = new Set(currentLedger().filter(e => e?.included !== false).map(e => e.key));
  const rows = [];

  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens ?? []) {
      const actor = tokenDoc.actor;
      if (!actor || actor.type !== "monster") continue;
      const key = tokenKey({ actor, tokenDoc, scene });
      const hp = actorHpValue(actor);
      const xp = monsterXpValue(actor);
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
        xp,
        hp,
        included: hp <= 0 || activeKeys.has(key),
        alreadyRecorded: activeKeys.has(key),
        reason: hp <= 0 ? "pv_zero_scene" : "scene_scan"
      });
    }
  }

  return rows;
}

function activeLedgerRows() {
  return currentLedger()
    .filter(entry => entry && entry.included !== false)
    .map(entry => ({ ...entry, source: "ledger", alreadyRecorded: true, checked: true }));
}

function sceneRowsNotInActiveLedger() {
  return allSceneMonsterRows()
    .filter(row => row && !row.alreadyRecorded)
    .map(row => ({ ...row, checked: row.hp <= 0 }));
}

function characterRows() {
  return (game.actors?.filter(a => a.type === "personnage") ?? []).map(actor => ({
    actor,
    actorId: actor.id,
    name: actor.name,
    level: Math.max(1, num(actor.system?.niveau, 1)),
    xp: Math.max(0, Math.floor(num(actor.system?.xp, 0)))
  }));
}

function auditXpFields() {
  const monsters = game.actors?.filter(a => a.type === "monster") ?? [];
  const chars = game.actors?.filter(a => a.type === "personnage") ?? [];
  const monsterRows = monsters.map(actor => ({
    id: actor.id,
    name: actor.name,
    xp: monsterXpValue(actor),
    rawXp: actor.system?.xp,
    hp: actorHpValue(actor),
    ok: monsterXpValue(actor) > 0
  }));
  const characterRowsAudit = chars.map(actor => ({
    id: actor.id,
    name: actor.name,
    xp: actor.system?.xp,
    niveau: actor.system?.niveau,
    progression_xp: actor.system?.progression_xp,
    ok: actor.system?.xp !== undefined && actor.system?.niveau !== undefined
  }));
  const result = {
    version: VERSION,
    monsters: monsterRows,
    characters: characterRowsAudit,
    monstersWithoutXp: monsterRows.filter(r => !r.ok),
    charactersWithMissingXpFields: characterRowsAudit.filter(r => !r.ok),
    ledger: currentLedger()
  };
  console.table(monsterRows);
  console.table(characterRowsAudit);
  log("[AUDIT]", result);
  return result;
}

function sourceRowHtml(row) {
  const checked = row.checked || row.included ? "checked" : "";
  const hpText = row.source === "scene"
    ? `<span class="a2e-xp-chip ${row.hp <= 0 ? "dead" : "alive"}">PV ${esc(row.hp)}</span>`
    : `<span class="a2e-xp-chip ledger">registre</span>`;
  return `<tr class="a2e-xp-source-row" data-key="${esc(row.key)}" data-source="${esc(row.source)}" data-monster-name="${esc(row.monsterName)}" data-token-name="${esc(row.tokenName)}" data-scene-name="${esc(row.sceneName)}" data-scene-id="${esc(row.sceneId)}" data-token-id="${esc(row.tokenId)}" data-actor-id="${esc(row.actorId)}" data-actor-uuid="${esc(row.actorUuid)}" data-reason="${esc(row.reason || row.source)}">
    <td class="center"><input type="checkbox" data-role="include-source" ${checked}></td>
    <td><div class="a2e-xp-name"><strong>${esc(row.monsterName || row.tokenName)}</strong>${hpText}</div></td>
    <td>${esc(row.sceneName || "—")}</td>
    <td class="right"><input class="a2e-xp-number" type="number" data-role="source-xp" value="${Math.max(0, Math.floor(num(row.xp, 0)))}" min="0" step="1"></td>
  </tr>`;
}

function characterRowHtml(row) {
  return `<tr class="a2e-xp-character-row" data-actor-id="${esc(row.actorId)}">
    <td class="center"><input type="checkbox" data-role="include-character" checked></td>
    <td><strong>${esc(row.name)}</strong><br><small>Niv. ${esc(row.level)}</small></td>
    <td class="right current-xp">${row.xp.toLocaleString()}</td>
    <td class="right"><input class="a2e-xp-number small" type="number" data-role="share" value="1" min="0" step="0.5"></td>
    <td class="right"><input class="a2e-xp-number small" type="number" data-role="bonus-percent" value="0" step="1"></td>
    <td class="right"><input class="a2e-xp-number small" type="number" data-role="bonus-flat" value="0" step="1"></td>
  </tr>`;
}

function appHtml() {
  const sourceRows = [...activeLedgerRows(), ...sceneRowsNotInActiveLedger()];
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
      .add2e-session-xp-v2 .a2e-xp-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.add2e-session-xp-v2 .a2e-xp-chip{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:.72rem;font-weight:800;border:1px solid #bfa65a;background:#fff6d8;color:#4a300b}.add2e-session-xp-v2 .a2e-xp-chip.dead{border-color:#9d2d25;background:#ffe4df;color:#8d2b22}.add2e-session-xp-v2 .a2e-xp-chip.alive{border-color:#3b7b45;background:#e5f7e8;color:#267a3d}.add2e-session-xp-v2 .a2e-xp-chip.ledger{border-color:#235f8f;background:#e7f2ff;color:#235f8f}
      .add2e-session-xp-v2 .global-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:6px 0 12px}.add2e-session-xp-v2 .global-grid label{display:flex;flex-direction:column;gap:3px;padding:7px;border:1px solid var(--gold);border-radius:7px;background:#fffaf0;font-weight:800;color:#4a2d0a}.add2e-session-xp-v2 .global-grid input{width:100%;padding:5px 7px;border:1px solid #9d8542;border-radius:5px;background:#fff;color:#111}
      .add2e-session-xp-v2 .footer-note{padding:7px 9px;border-radius:6px;background:#f1fff0;border:1px solid #7caf78;color:#285c2a;font-weight:700}.add2e-session-xp-v2 .source-table col:nth-child(1){width:62px}.add2e-session-xp-v2 .source-table col:nth-child(2){width:auto}.add2e-session-xp-v2 .source-table col:nth-child(3){width:120px}.add2e-session-xp-v2 .source-table col:nth-child(4){width:105px}.add2e-session-xp-v2 .char-table col:nth-child(1){width:62px}.add2e-session-xp-v2 .char-table col:nth-child(2){width:auto}.add2e-session-xp-v2 .char-table col:nth-child(3){width:105px}.add2e-session-xp-v2 .char-table col:nth-child(4){width:82px}.add2e-session-xp-v2 .char-table col:nth-child(5){width:92px}.add2e-session-xp-v2 .char-table col:nth-child(6){width:92px}
      .add2e-session-xp-v2 .buttons{display:flex;gap:8px;justify-content:flex-end;padding:9px 10px;border-top:1px solid #b99742;background:#e5d09a;flex:0 0 auto}.add2e-session-xp-v2 button{padding:7px 12px;border:1px solid #7a5a16;border-radius:6px;background:#fff7d9;color:#2c1a07;font-weight:800;cursor:pointer}.add2e-session-xp-v2 button.apply{background:#2d7a3e;color:#fff;border-color:#1f5a2d}.add2e-session-xp-v2 button.reset{background:#8d2b22;color:#fff;border-color:#6f1d17}.add2e-session-xp-v2 button:disabled{opacity:.55;cursor:wait}
    </style>
    <div class="scroll">
      <h3>Sources d'XP monstres</h3><div class="hint">Les monstres tombés à 0 PV sont enregistrés automatiquement. Les sources déjà appliquées disparaissent à la réouverture. Le bouton de réinitialisation permet de repartir à zéro.</div>
      <table class="source-table"><colgroup><col><col><col><col></colgroup><thead><tr><th>Incl.</th><th>Monstre</th><th>Scène</th><th>PX</th></tr></thead><tbody>${sourceRows.map(sourceRowHtml).join("") || `<tr><td colspan="4"><em>Aucune source d'XP disponible.</em></td></tr>`}</tbody></table>
      <h3>Bonus globaux</h3><div class="global-grid"><label>Objectifs / rôleplay <input type="number" name="objectivesXp" value="0" step="1"></label><label>Trésors <input type="number" name="treasureXp" value="0" step="1"></label><label>Bonus MJ global <input type="number" name="gmBonusXp" value="0" step="1"></label><label>Motif <input type="text" name="reason" value="Bilan XP de session"></label></div>
      <h3>Répartition vers les personnages</h3><table class="char-table"><colgroup><col><col><col><col><col><col></colgroup><thead><tr><th>Incl.</th><th>Personnage</th><th>XP actuel</th><th>Part</th><th>Bonus %</th><th>Bonus fixe</th></tr></thead><tbody>${chars.map(characterRowHtml).join("") || `<tr><td colspan="6"><em>Aucun personnage trouvé.</em></td></tr>`}</tbody></table>
      <div class="footer-note">Application : seuls les acteurs de type <code>personnage</code> reçoivent l'XP. Les monstres restent uniquement des sources de PX.</div>
    </div>
    <div class="buttons"><button type="button" data-action="audit">Audit champs</button><button type="button" class="reset" data-action="reset">Réinitialiser registre</button><button type="button" class="apply" data-action="apply">Appliquer l'XP</button><button type="button" data-action="close">Fermer</button></div>
  </div>`;
}

function readAppData(root) {
  const selectedSources = [...root.querySelectorAll(".a2e-xp-source-row")].map(row => {
    if (row.querySelector("[data-role='include-source']")?.checked !== true) return null;
    return {
      key: row.dataset.key || "",
      source: row.dataset.source || "",
      monsterName: row.dataset.monsterName || row.dataset.tokenName || "Monstre",
      tokenName: row.dataset.tokenName || row.dataset.monsterName || "Monstre",
      sceneName: row.dataset.sceneName || "",
      sceneId: row.dataset.sceneId || "",
      tokenId: row.dataset.tokenId || "",
      actorId: row.dataset.actorId || "",
      actorUuid: row.dataset.actorUuid || "",
      reason: row.dataset.reason || "session_xp",
      xp: Math.max(0, Math.floor(num(row.querySelector("[data-role='source-xp']")?.value, 0)))
    };
  }).filter(Boolean);

  const recipients = [...root.querySelectorAll(".a2e-xp-character-row")].map(row => {
    if (row.querySelector("[data-role='include-character']")?.checked !== true) return null;
    const actor = game.actors.get(row.dataset.actorId || "");
    if (!actor || actor.type !== "personnage") return null;
    const share = Math.max(0, num(row.querySelector("[data-role='share']")?.value, 1));
    if (share <= 0) return null;
    return {
      actor,
      actorId: actor.id,
      name: actor.name,
      share,
      bonusPercent: num(row.querySelector("[data-role='bonus-percent']")?.value, 0),
      bonusFlat: Math.floor(num(row.querySelector("[data-role='bonus-flat']")?.value, 0))
    };
  }).filter(Boolean);

  const objectivesXp = Math.max(0, Math.floor(num(root.querySelector("input[name='objectivesXp']")?.value, 0)));
  const treasureXp = Math.max(0, Math.floor(num(root.querySelector("input[name='treasureXp']")?.value, 0)));
  const gmBonusXp = Math.max(0, Math.floor(num(root.querySelector("input[name='gmBonusXp']")?.value, 0)));
  const monsterXp = selectedSources.reduce((sum, row) => sum + row.xp, 0);

  return { selectedSources, recipients, monsterXp, objectivesXp, treasureXp, gmBonusXp, sourceTotal: monsterXp + objectivesXp + treasureXp + gmBonusXp, reason: root.querySelector("input[name='reason']")?.value || "Bilan XP de session" };
}

function computeDistribution(data) {
  const shareTotal = data.recipients.reduce((sum, row) => sum + row.share, 0);
  if (shareTotal <= 0) return [];
  const rows = data.recipients.map(row => {
    const raw = data.sourceTotal * (row.share / shareTotal);
    const base = Math.floor(raw);
    return { ...row, raw, base, fraction: raw - base };
  });
  let remainder = data.sourceTotal - rows.reduce((sum, row) => sum + row.base, 0);
  for (const row of [...rows].sort((a, b) => b.fraction - a.fraction)) {
    if (remainder <= 0) break;
    row.base += 1;
    remainder -= 1;
  }
  return rows.map(row => {
    const percentBonus = Math.floor(row.base * (row.bonusPercent / 100));
    const total = Math.max(0, row.base + percentBonus + row.bonusFlat);
    return { ...row, percentBonus, total };
  });
}

async function markSourcesApplied(selectedSources, reason) {
  const ledger = currentLedger();
  const appliedAt = nowIso();
  for (const source of selectedSources) {
    const existingIndex = ledger.findIndex(entry => entry?.key === source.key);
    const appliedEntry = {
      ...(existingIndex >= 0 ? ledger[existingIndex] : {}),
      key: source.key,
      actorId: source.actorId,
      actorUuid: source.actorUuid,
      tokenId: source.tokenId,
      tokenName: source.tokenName,
      monsterName: source.monsterName,
      sceneId: source.sceneId,
      sceneName: source.sceneName,
      xp: source.xp,
      reason: source.reason || "session_apply",
      included: false,
      appliedAt,
      appliedReason: reason
    };
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

async function syncXpToUnlinkedTokens(actor, xpValue) {
  const updates = [];
  const rows = unlinkedTokenDocsForActor(actor);

  for (const row of rows) {
    const before = Math.max(0, Math.floor(num(row.tokenActor.system?.xp, 0)));
    try {
      await row.tokenActor.update({ "system.xp": xpValue }, { add2eReason: "session-xp-token-sync" });
      const after = Math.max(0, Math.floor(num(row.tokenActor.system?.xp, xpValue)));
      updates.push({ scene: row.scene.name, token: row.tokenDoc.name, before, after, ok: after === xpValue });
    } catch (err) {
      updates.push({ scene: row.scene.name, token: row.tokenDoc.name, before, after: before, ok: false, error: err?.message ?? String(err) });
      warn("[TOKEN_SYNC][ERROR]", { actor: actor.name, scene: row.scene.name, token: row.tokenDoc.name, err });
    }
  }

  if (updates.length) log("[TOKEN_SYNC][DONE]", { actor: actor.name, xp: xpValue, tokens: updates });
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
  const before = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const amount = Math.max(0, Math.floor(num(total, 0)));
  const expectedAfter = before + amount;
  log("[AWARD][START]", { actor: actor.name, before, amount, expectedAfter });

  await actor.update({ "system.xp": expectedAfter }, { add2eReason: "session-xp-v2" });

  const liveActor = game.actors.get(actor.id) ?? actor;
  const after = Math.max(0, Math.floor(num(liveActor.system?.xp, expectedAfter)));
  if (after !== expectedAfter) warn("[AWARD][VERIFY]", { actor: actor.name, before, amount, expectedAfter, after });

  const tokenSync = await syncXpToUnlinkedTokens(liveActor, after);
  refreshActorAndTokenSheets(liveActor);

  log("[AWARD][DONE]", { actor: actor.name, before, amount, expectedAfter, after, tokenSync });
  return { before, after, expectedAfter, tokenSync };
}

async function applySessionXp(data) {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut appliquer l'XP de session.");
  if (data.sourceTotal <= 0) return ui.notifications.warn("Le total d'XP est à 0.");
  if (!data.recipients.length) return ui.notifications.warn("Aucun personnage destinataire sélectionné.");

  const distribution = computeDistribution(data);
  const results = [];

  for (const row of distribution) {
    const awarded = await awardCharacterXp(row.actor, row.total, data.reason);
    results.push({
      actor: game.actors.get(row.actor.id) ?? row.actor,
      before: awarded.before,
      after: awarded.after,
      expectedAfter: awarded.expectedAfter,
      gained: row.total,
      base: row.base,
      percentBonus: row.percentBonus,
      bonusFlat: row.bonusFlat,
      tokenSync: awarded.tokenSync ?? []
    });
  }

  await markSourcesApplied(data.selectedSources, data.reason);

  const monsterLines = data.selectedSources.map(row => `<li>${esc(row.monsterName)} : <b>${row.xp.toLocaleString()}</b> PX${row.sceneName ? ` <small>(${esc(row.sceneName)})</small>` : ""}</li>`).join("");
  const resultLines = results.map(row => {
    const tokenNote = row.tokenSync?.length ? ` <small>— tokens synchronisés : ${row.tokenSync.length}</small>` : "";
    return `<li>${esc(row.actor.name)} : +<b>${row.gained.toLocaleString()}</b> XP <small>(base ${row.base.toLocaleString()}${row.percentBonus ? `, bonus % ${row.percentBonus.toLocaleString()}` : ""}${row.bonusFlat ? `, bonus fixe ${row.bonusFlat.toLocaleString()}` : ""})</small> — ${row.before.toLocaleString()} → ${row.after.toLocaleString()}${tokenNote}</li>`;
  }).join("");

  await ChatMessage.create({
    content: `<div class="add2e-xp-session-chat" style="border:2px solid #a87924;border-radius:10px;background:#fff8df;padding:.75em .95em;color:#2b1b0c;"><h2 style="margin:.1em 0 .45em;color:#7d331f;">Bilan XP de session</h2><p><b>Total réparti :</b> ${data.sourceTotal.toLocaleString()} XP</p><p><b>Monstres :</b> ${data.monsterXp.toLocaleString()} XP — <b>Objectifs :</b> ${data.objectivesXp.toLocaleString()} XP — <b>Trésors :</b> ${data.treasureXp.toLocaleString()} XP — <b>Bonus MJ :</b> ${data.gmBonusXp.toLocaleString()} XP</p><details open><summary><b>Sources</b></summary><ul>${monsterLines || "<li>Aucune source monstre.</li>"}</ul></details><details open><summary><b>Répartition</b></summary><ul>${resultLines}</ul></details></div>`
  });

  for (const row of results) refreshActorAndTokenSheets(row.actor);

  ui.notifications.info("XP de session appliquée. Les sources utilisées sont maintenant masquées.");
  log("[APPLIED]", { data, distribution, results });
  return { data, distribution, results };
}

class Add2eSessionXpApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-session-xp-app-v2",
    classes: ["add2e", "session-xp", "app-v2"],
    tag: "section",
    window: { title: "ADD2E — Bilan XP de session", resizable: true },
    position: { width: 980, height: 780 }
  };

  async _renderHTML(_context, _options) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = appHtml();
    return wrapper;
  }

  _replaceHTML(result, content, _options) {
    content.replaceChildren(...result.childNodes);
    this._activateListeners(content);
  }

  _activateListeners(content) {
    const root = content.querySelector(".add2e-session-xp-v2");
    if (!root) return;
    root.querySelector("[data-action='audit']")?.addEventListener("click", ev => { ev.preventDefault(); auditXpFields(); });
    root.querySelector("[data-action='reset']")?.addEventListener("click", async ev => { ev.preventDefault(); await clearSessionXpLedger({ alsoFlags: true }); this.render({ force: true }); });
    root.querySelector("[data-action='apply']")?.addEventListener("click", async ev => {
      ev.preventDefault();
      ev.currentTarget.disabled = true;
      try {
        const data = readAppData(root);
        await applySessionXp(data);
        this.render({ force: true });
      } catch (err) {
        console.error(`${TAG}[APPLY][ERROR]`, err);
        ui.notifications.error("Application de l'XP impossible. Voir console.");
      } finally {
        ev.currentTarget.disabled = false;
      }
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
        const flags = foundry.utils.deepClone(token.flags ?? {});
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
  const reason = hp <= 0 ? "token_deleted_dead" : "token_deleted";
  await recordMonsterXp(actor, { tokenDoc, scene: tokenDoc.parent, reason, notify: false });
}

function openXpSessionFromTool() {
  try { openSessionXpApplication(); }
  catch (err) {
    console.error(`${TAG}[OPEN][ERROR]`, err);
    ui.notifications.error("Ouverture du bilan XP impossible. Voir console.");
  }
}

function xpToolDefinition() {
  return { name: "add2e-session-xp", title: "ADD2E — Bilan XP", icon: "fas fa-coins", button: true, visible: game.user?.isGM === true, onChange: () => openXpSessionFromTool() };
}

function installToolInControl(control, tool = xpToolDefinition()) {
  if (!control) return false;
  if (Array.isArray(control.tools)) {
    const existing = control.tools.find(t => t?.name === tool.name || t?.id === tool.name);
    if (existing) { delete existing.onClick; existing.onChange = tool.onChange; existing.button = true; }
    else control.tools.push(tool);
    return true;
  }
  if (control.tools instanceof Map) {
    const existing = control.tools.get(tool.name);
    if (existing) { delete existing.onClick; existing.onChange = tool.onChange; existing.button = true; }
    else control.tools.set(tool.name, tool);
    return true;
  }
  if (control.tools && typeof control.tools === "object") {
    const existing = control.tools[tool.name];
    if (existing) { delete existing.onClick; existing.onChange = tool.onChange; existing.button = true; }
    else control.tools[tool.name] = tool;
    return true;
  }
  control.tools = [tool];
  return true;
}

function installSceneControlButton(controls) {
  if (!game.user?.isGM) return;
  const tool = xpToolDefinition();
  if (Array.isArray(controls)) {
    const tokenControl = controls.find(c => c?.name === "token" || c?.name === "tokens") ?? controls[0];
    if (installToolInControl(tokenControl, tool)) return;
    controls.push({ name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: [tool], activeTool: tool.name });
    return;
  }
  if (controls && typeof controls === "object") {
    const tokenControl = controls.token ?? controls.tokens ?? controls.Token ?? Object.values(controls).find(c => c?.name === "token" || c?.name === "tokens");
    if (installToolInControl(tokenControl, tool)) return;
    controls.add2e = controls.add2e ?? { name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: {} };
    installToolInControl(controls.add2e, tool);
  }
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

Hooks.once("init", () => {
  game.settings.register("add2e", FLAG_LEDGER, { name: "ADD2E — Registre XP de session", hint: "Registre interne des monstres tombés à 0 PV ou supprimés pendant la session.", scope: "world", config: false, type: Array, default: [] });
});

Hooks.once("ready", () => {
  log("[READY]", { version: VERSION });
});

Hooks.on("preUpdateActor", (actor, changes, _options, userId) => {
  if (!canRecordFromUser(userId)) return true;
  if (!actorDropsToZero(actor, changes)) return true;
  queueRecord(actor, { reason: "pv_zero", notify: true });
  return true;
});

Hooks.on("preUpdateToken", (tokenDoc, changes, _options, userId) => {
  if (!canRecordFromUser(userId)) return true;
  if (!tokenDropsToZero(tokenDoc, changes)) return true;
  queueRecord(tokenDoc.actor, { tokenDoc, scene: tokenDoc.parent, reason: "token_pv_zero", notify: true });
  return true;
});

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
