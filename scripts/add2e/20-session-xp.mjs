// ADD2E — XP de session automatisée
// Version : 2026-05-23-session-xp-v1
//
// But :
// - Les monstres ne montent jamais de niveau.
// - Un monstre est enregistré comme source d'XP quand ses PV passent à 0 ou moins.
// - Un token monstre supprimé est aussi enregistré par sécurité.
// - Le bilan de session répartit uniquement vers les acteurs type "personnage".

const VERSION = "2026-05-23-session-xp-v1";
const TAG = "[ADD2E][SESSION_XP]";
const FLAG_SCOPE = "add2e";
const FLAG_LEDGER = "sessionXpLedger";
const FLAG_MONSTER_RECORDED = "sessionXpRecorded";
const FLAG_TOKEN_RECORDED = "sessionXpRecorded";

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
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "xp", "px"]) {
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

function actorWasDroppedToZero(actor, changes) {
  if (!actor || actor.type !== "monster") return false;
  const paths = [
    "system.pdv",
    "system.pv",
    "system.hp",
    "system.hp.value",
    "system.points_de_vie",
    "system.hitPoints"
  ];
  for (const path of paths) {
    if (!foundry.utils.hasProperty(changes, path)) continue;
    const before = actorHpValue(actor);
    const after = num(foundry.utils.getProperty(changes, path), before);
    return before > 0 && after <= 0;
  }
  return false;
}

function tokenWasDroppedToZero(tokenDoc, changes) {
  if (!tokenDoc?.actor || tokenDoc.actor.type !== "monster") return false;
  const delta = changes?.actorDelta ?? changes?.delta ?? null;
  if (!delta) return false;
  const paths = [
    "system.pdv",
    "system.pv",
    "system.hp",
    "system.hp.value",
    "system.points_de_vie",
    "system.hitPoints"
  ];
  for (const path of paths) {
    if (!foundry.utils.hasProperty(delta, path)) continue;
    const before = actorHpValue(tokenDoc.actor);
    const after = num(foundry.utils.getProperty(delta, path), before);
    return before > 0 && after <= 0;
  }
  return false;
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
  try { await actor?.setFlag?.(FLAG_SCOPE, FLAG_MONSTER_RECORDED, true); } catch (_e) {}
  try { await actor?.setFlag?.(FLAG_SCOPE, "sessionXpRecordedKey", entry.key); } catch (_e) {}
  try { await tokenDoc?.setFlag?.(FLAG_SCOPE, FLAG_TOKEN_RECORDED, true); } catch (_e) {}
  try { await tokenDoc?.setFlag?.(FLAG_SCOPE, "sessionXpRecordedKey", entry.key); } catch (_e) {}
}

function isAlreadyRecorded(actor, tokenDoc, ledger, entryKey) {
  if (ledger.some(e => e?.key === entryKey)) return true;
  if (tokenDoc?.getFlag?.(FLAG_SCOPE, FLAG_TOKEN_RECORDED)) return true;
  if (!tokenDoc && actor?.getFlag?.(FLAG_SCOPE, FLAG_MONSTER_RECORDED)) return true;
  return false;
}

async function recordMonsterXp(actor, { tokenDoc = null, scene = null, reason = "pv_zero", notify = false, force = false } = {}) {
  if (!game.user?.isGM) return null;
  if (!actor || actor.type !== "monster") return null;

  const entry = buildLedgerEntry(actor, { tokenDoc, scene, reason });
  const ledger = currentLedger();

  if (!force && isAlreadyRecorded(actor, tokenDoc, ledger, entry.key)) {
    log("[SKIP_ALREADY_RECORDED]", { actor: actor.name, key: entry.key });
    return null;
  }

  ledger.push(entry);
  await saveLedger(ledger);
  await markRecorded(actor, tokenDoc, entry);

  log("[RECORDED]", entry);
  if (notify) ui.notifications.info(`${entry.monsterName} enregistré pour ${entry.xp.toLocaleString()} PX.`);
  return entry;
}

function allSceneMonsterRows() {
  const ledgerKeys = new Set(currentLedger().map(e => e?.key).filter(Boolean));
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
        tokenId: tokenDoc.id,
        monsterName: actor.name,
        tokenName: tokenDoc.name,
        sceneName: scene.name,
        xp,
        hp,
        included: hp <= 0 || ledgerKeys.has(key),
        alreadyRecorded: ledgerKeys.has(key)
      });
    }
  }

  return rows;
}

function ledgerRows() {
  return currentLedger().map(entry => ({
    ...entry,
    source: "ledger",
    included: entry.included !== false,
    alreadyRecorded: true
  }));
}

function characterRows() {
  return (game.actors?.filter(a => a.type === "personnage") ?? []).map(actor => ({
    actor,
    actorId: actor.id,
    name: actor.name,
    level: Math.max(1, num(actor.system?.niveau, 1)),
    xp: Math.max(0, Math.floor(num(actor.system?.xp, 0))),
    share: 1,
    bonusPercent: 0,
    bonusFlat: 0,
    included: true
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
    charactersWithMissingXpFields: characterRowsAudit.filter(r => !r.ok)
  };
  console.table(monsterRows);
  console.table(characterRowsAudit);
  log("[AUDIT]", result);
  return result;
}

function sessionDialogContent() {
  const ledger = ledgerRows();
  const sceneRows = allSceneMonsterRows().filter(row => !row.alreadyRecorded);
  const chars = characterRows();

  const monsterHtml = [
    ...ledger.map(row => `<tr>
      <td><input type="checkbox" name="monster" value="${esc(row.key)}" checked data-xp="${row.xp}"></td>
      <td>${esc(row.monsterName)} <small>(${esc(row.reason || "registre")})</small></td>
      <td>${esc(row.sceneName || "—")}</td>
      <td style="text-align:right"><input type="number" name="monsterXp.${esc(row.key)}" value="${row.xp}" min="0" step="1" style="width:90px;text-align:right"></td>
    </tr>`),
    ...sceneRows.map(row => `<tr>
      <td><input type="checkbox" name="monster" value="${esc(row.key)}" ${row.included ? "checked" : ""} data-xp="${row.xp}"></td>
      <td>${esc(row.monsterName)} <small>PV ${row.hp}</small></td>
      <td>${esc(row.sceneName || "—")}</td>
      <td style="text-align:right"><input type="number" name="monsterXp.${esc(row.key)}" value="${row.xp}" min="0" step="1" style="width:90px;text-align:right"></td>
    </tr>`)
  ].join("");

  const charsHtml = chars.map(row => `<tr>
    <td><input type="checkbox" name="character" value="${esc(row.actorId)}" checked></td>
    <td>${esc(row.name)}</td>
    <td style="text-align:right">${row.xp.toLocaleString()}</td>
    <td><input type="number" name="share.${esc(row.actorId)}" value="1" min="0" step="0.5" style="width:70px;text-align:right"></td>
    <td><input type="number" name="bonusPercent.${esc(row.actorId)}" value="0" step="1" style="width:70px;text-align:right"></td>
    <td><input type="number" name="bonusFlat.${esc(row.actorId)}" value="0" step="1" style="width:80px;text-align:right"></td>
  </tr>`).join("");

  return `<form class="add2e-session-xp-dialog">
    <style>
      .add2e-session-xp-dialog table{width:100%;border-collapse:collapse;margin:.5rem 0;background:#fffdf4}
      .add2e-session-xp-dialog th,.add2e-session-xp-dialog td{border:1px solid #d5bd73;padding:4px 6px;vertical-align:middle}
      .add2e-session-xp-dialog th{background:#efe0a8;text-align:left}
      .add2e-session-xp-dialog h3{margin:.75rem 0 .25rem;color:#6b3b16}
      .add2e-session-xp-dialog .grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
    </style>
    <h3>Sources d'XP monstres</h3>
    <p><small>Les monstres tombés à 0 PV sont enregistrés automatiquement. Les monstres supprimés sont aussi capturés par sécurité.</small></p>
    <table>
      <thead><tr><th>Inclure</th><th>Monstre</th><th>Scène</th><th>PX</th></tr></thead>
      <tbody>${monsterHtml || `<tr><td colspan="4"><em>Aucun monstre détecté ou enregistré.</em></td></tr>`}</tbody>
    </table>

    <h3>Bonus globaux</h3>
    <div class="grid">
      <label>Objectifs / rôleplay <input type="number" name="objectivesXp" value="0" step="1"></label>
      <label>Trésors <input type="number" name="treasureXp" value="0" step="1"></label>
      <label>Bonus MJ global <input type="number" name="gmBonusXp" value="0" step="1"></label>
      <label>Motif <input type="text" name="reason" value="Bilan XP de session"></label>
    </div>

    <h3>Répartition vers les personnages</h3>
    <table>
      <thead><tr><th>Inclure</th><th>Personnage</th><th>XP actuel</th><th>Part</th><th>Bonus %</th><th>Bonus fixe</th></tr></thead>
      <tbody>${charsHtml || `<tr><td colspan="6"><em>Aucun personnage trouvé.</em></td></tr>`}</tbody>
    </table>
  </form>`;
}

function readFormRows(form) {
  const monsterMap = new Map();
  for (const entry of ledgerRows()) monsterMap.set(entry.key, entry);
  for (const row of allSceneMonsterRows()) monsterMap.set(row.key, row);

  const selectedMonsters = [...form.querySelectorAll("input[name='monster']:checked")].map(input => {
    const key = input.value;
    const xpInput = form.querySelector(`input[name="monsterXp.${CSS.escape(key)}"]`);
    const row = monsterMap.get(key) ?? { key, monsterName: key, sceneName: "" };
    return { ...row, xp: Math.max(0, Math.floor(num(xpInput?.value ?? row.xp ?? 0, 0))) };
  });

  const objectivesXp = Math.max(0, Math.floor(num(form.objectivesXp?.value, 0)));
  const treasureXp = Math.max(0, Math.floor(num(form.treasureXp?.value, 0)));
  const gmBonusXp = Math.max(0, Math.floor(num(form.gmBonusXp?.value, 0)));
  const sourceTotal = selectedMonsters.reduce((sum, row) => sum + row.xp, 0) + objectivesXp + treasureXp + gmBonusXp;

  const recipients = [...form.querySelectorAll("input[name='character']:checked")]
    .map(input => {
      const actor = game.actors.get(input.value);
      if (!actor || actor.type !== "personnage") return null;
      const share = Math.max(0, num(form.querySelector(`input[name="share.${CSS.escape(actor.id)}"]`)?.value, 1));
      const bonusPercent = num(form.querySelector(`input[name="bonusPercent.${CSS.escape(actor.id)}"]`)?.value, 0);
      const bonusFlat = Math.floor(num(form.querySelector(`input[name="bonusFlat.${CSS.escape(actor.id)}"]`)?.value, 0));
      return { actor, share, bonusPercent, bonusFlat };
    })
    .filter(Boolean)
    .filter(row => row.share > 0);

  return {
    selectedMonsters,
    objectivesXp,
    treasureXp,
    gmBonusXp,
    sourceTotal,
    recipients,
    reason: form.reason?.value || "Bilan XP de session"
  };
}

function computeDistribution(formData) {
  const shareTotal = formData.recipients.reduce((sum, row) => sum + row.share, 0) || 1;
  return formData.recipients.map(row => {
    const base = Math.floor(formData.sourceTotal * (row.share / shareTotal));
    const percentBonus = Math.floor(base * (row.bonusPercent / 100));
    const total = Math.max(0, base + percentBonus + row.bonusFlat);
    return { ...row, base, percentBonus, total };
  });
}

async function applySessionXp(formData) {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut appliquer l'XP de session.");
  const distribution = computeDistribution(formData);
  if (!distribution.length) return ui.notifications.warn("Aucun personnage destinataire sélectionné.");
  if (formData.sourceTotal <= 0) return ui.notifications.warn("Le total d'XP est à 0.");

  const results = [];
  for (const row of distribution) {
    const before = Math.max(0, Math.floor(num(row.actor.system?.xp, 0)));
    if (typeof globalThis.add2eAwardXp === "function") {
      await globalThis.add2eAwardXp(row.actor, row.base, {
        reason: formData.reason,
        percentBonus: row.bonusPercent ? row.bonusPercent : 0
      });
      if (row.bonusFlat) await globalThis.add2eAwardXp(row.actor, row.bonusFlat, { reason: `${formData.reason} — bonus fixe`, percentBonus: 0 });
    } else {
      await row.actor.update({ "system.xp": before + row.total });
    }
    results.push({ actor: row.actor, before, gained: row.total, after: Math.max(0, Math.floor(num(row.actor.system?.xp, before + row.total))) });
  }

  const ledger = currentLedger().map(entry => {
    if (formData.selectedMonsters.some(row => row.key === entry.key)) return { ...entry, included: false, appliedAt: nowIso() };
    return entry;
  });
  await saveLedger(ledger);

  const monstersHtml = formData.selectedMonsters.map(row => `<li>${esc(row.monsterName || row.tokenName)} : <b>${Number(row.xp || 0).toLocaleString()}</b> PX${row.sceneName ? ` <small>(${esc(row.sceneName)})</small>` : ""}</li>`).join("");
  const charsHtml = results.map(row => `<li>${esc(row.actor.name)} : +<b>${row.gained.toLocaleString()}</b> XP (${row.before.toLocaleString()} → ${row.after.toLocaleString()})</li>`).join("");

  await ChatMessage.create({
    content: `<div class="add2e-xp-session-chat" style="border:2px solid #a87924;border-radius:10px;background:#fff8df;padding:.7em .9em;">
      <h2 style="margin:.1em 0 .4em;color:#6b3b16;">Bilan XP de session</h2>
      <p><b>Total à répartir :</b> ${formData.sourceTotal.toLocaleString()} XP</p>
      <details open><summary><b>Sources monstres</b></summary><ul>${monstersHtml || "<li>Aucune</li>"}</ul></details>
      <p><b>Objectifs :</b> ${formData.objectivesXp.toLocaleString()} XP — <b>Trésors :</b> ${formData.treasureXp.toLocaleString()} XP — <b>Bonus MJ :</b> ${formData.gmBonusXp.toLocaleString()} XP</p>
      <details open><summary><b>Répartition</b></summary><ul>${charsHtml}</ul></details>
    </div>`
  });

  ui.notifications.info("XP de session appliquée.");
  return { formData, distribution, results };
}

function openSessionXpDialog() {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut ouvrir le bilan XP.");
  new Dialog({
    title: "ADD2E — Bilan XP de session",
    content: sessionDialogContent(),
    buttons: {
      audit: {
        label: "Audit champs",
        callback: () => auditXpFields()
      },
      apply: {
        label: "Appliquer l'XP",
        callback: async html => {
          const root = html?.[0] ?? html;
          const form = root.querySelector("form");
          const data = readFormRows(form);
          await applySessionXp(data);
        }
      },
      cancel: { label: "Fermer" }
    },
    default: "apply",
    width: 900
  }).render(true);
}

async function clearSessionXpLedger({ alsoFlags = false } = {}) {
  if (!game.user?.isGM) return;
  await saveLedger([]);
  if (alsoFlags) {
    for (const actor of game.actors?.filter(a => a.type === "monster") ?? []) {
      await actor.unsetFlag(FLAG_SCOPE, FLAG_MONSTER_RECORDED).catch(() => null);
      await actor.unsetFlag(FLAG_SCOPE, "sessionXpRecordedKey").catch(() => null);
    }
    for (const scene of game.scenes ?? []) {
      const updates = [];
      for (const token of scene.tokens ?? []) {
        const flags = foundry.utils.deepClone(token.flags ?? {});
        if (flags?.add2e?.[FLAG_TOKEN_RECORDED] || flags?.add2e?.sessionXpRecordedKey) {
          updates.push({ _id: token.id, [`flags.${FLAG_SCOPE}.-=${FLAG_TOKEN_RECORDED}`]: null, [`flags.${FLAG_SCOPE}.-=sessionXpRecordedKey`]: null });
        }
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
  if (tokenDoc.getFlag?.(FLAG_SCOPE, FLAG_TOKEN_RECORDED)) return;

  const hp = actorHpValue(actor);
  const reason = hp <= 0 ? "token_deleted_dead" : "token_deleted";
  await recordMonsterXp(actor, { tokenDoc, scene: tokenDoc.parent, reason, notify: false });
}

Hooks.once("init", () => {
  game.settings.register("add2e", FLAG_LEDGER, {
    name: "ADD2E — Registre XP de session",
    hint: "Registre interne des monstres tombés à 0 PV ou supprimés pendant la session.",
    scope: "world",
    config: false,
    type: Array,
    default: []
  });
});

Hooks.once("ready", () => {
  log("[READY]", { version: VERSION });
});

Hooks.on("updateActor", async (actor, changes, _options, userId) => {
  if (!game.user?.isGM) return;
  if (game.user.id !== userId && !game.users.get(userId)?.isGM) return;
  if (!actorWasDroppedToZero(actor, changes)) return;
  await recordMonsterXp(actor, { reason: "pv_zero", notify: true });
});

Hooks.on("updateToken", async (tokenDoc, changes, _options, userId) => {
  if (!game.user?.isGM) return;
  if (game.user.id !== userId && !game.users.get(userId)?.isGM) return;
  if (!tokenWasDroppedToZero(tokenDoc, changes)) return;
  await recordMonsterXp(tokenDoc.actor, { tokenDoc, scene: tokenDoc.parent, reason: "token_pv_zero", notify: true });
});

Hooks.on("preDeleteToken", async (tokenDoc) => {
  await registerTokenDeletion(tokenDoc);
});

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM) return;
  const tokenControl = controls.find?.(c => c.name === "token") ?? controls.tokens;
  const tool = {
    name: "add2e-session-xp",
    title: "ADD2E — Bilan XP",
    icon: "fas fa-coins",
    button: true,
    onClick: () => openSessionXpDialog()
  };
  if (Array.isArray(tokenControl?.tools)) {
    if (!tokenControl.tools.some(t => t.name === tool.name)) tokenControl.tools.push(tool);
  }
});

globalThis.ADD2E_SESSION_XP_VERSION = VERSION;
globalThis.add2eRecordMonsterXp = recordMonsterXp;
globalThis.add2eAuditXpFields = auditXpFields;
globalThis.add2eOpenXpSession = openSessionXpDialog;
globalThis.add2eCollectMonsterXpRows = allSceneMonsterRows;
globalThis.add2eCollectCharacterXpRows = characterRows;
globalThis.add2eSessionXpLedger = currentLedger;
globalThis.add2eClearSessionXpLedger = clearSessionXpLedger;
