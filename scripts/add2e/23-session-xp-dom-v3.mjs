// ADD2E — XP session DOM V3
// Version : 2026-05-24-session-xp-dom-v3
//
// Objectif :
// - aucune Application V1 ;
// - aucun Dialog V1 ;
// - pas de SceneControlTool#onClick ;
// - application XP directe, vérifiée, puis message chat ;
// - les sources ne sont masquées qu'après application réussie.

const VERSION = "2026-05-24-session-xp-dom-v3";
const TAG = "[ADD2E][SESSION_XP_DOM_V3]";
const FLAG_SCOPE = "add2e";
const FLAG_LEDGER = "sessionXpLedger";
const WINDOW_ID = "add2e-session-xp-dom-v3";

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
}

function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

function error(label, data = {}) {
  console.error(`${TAG}${label}`, data);
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
  return new Date().toISOString();
}

function currentLedger() {
  try {
    const ledger = game.settings.get("add2e", FLAG_LEDGER);
    return Array.isArray(ledger) ? ledger : [];
  } catch (_err) {
    return [];
  }
}

async function saveLedger(ledger) {
  await game.settings.set("add2e", FLAG_LEDGER, Array.isArray(ledger) ? ledger : []);
}

function getActiveLedgerRows() {
  return currentLedger()
    .filter(entry => entry && entry.included !== false)
    .map(entry => ({
      key: entry.key,
      source: "ledger",
      actorId: entry.actorId || "",
      actorUuid: entry.actorUuid || "",
      tokenId: entry.tokenId || "",
      tokenName: entry.tokenName || entry.monsterName || "Monstre",
      monsterName: entry.monsterName || entry.tokenName || "Monstre",
      sceneId: entry.sceneId || "",
      sceneName: entry.sceneName || "",
      xp: Math.max(0, Math.floor(num(entry.xp, 0))),
      hp: null,
      reason: entry.reason || "registre",
      checked: true
    }));
}

function getSceneRows() {
  const all = typeof globalThis.add2eCollectMonsterXpRows === "function"
    ? globalThis.add2eCollectMonsterXpRows()
    : [];

  return all
    .filter(row => row && !row.alreadyRecorded)
    .map(row => ({
      key: row.key,
      source: "scene",
      actorId: row.actorId ?? row.actor?.id ?? "",
      actorUuid: row.actor?.uuid ?? "",
      tokenId: row.tokenId ?? row.tokenDoc?.id ?? "",
      tokenName: row.tokenName ?? row.tokenDoc?.name ?? row.monsterName ?? "Monstre",
      monsterName: row.monsterName ?? row.actor?.name ?? row.tokenName ?? "Monstre",
      sceneId: row.scene?.id ?? row.sceneId ?? "",
      sceneName: row.sceneName ?? row.scene?.name ?? "",
      xp: Math.max(0, Math.floor(num(row.xp, 0))),
      hp: num(row.hp, 0),
      reason: row.hp <= 0 ? "pv_zero_scene" : "scene_scan",
      checked: row.hp <= 0
    }));
}

function getCharacterRows() {
  const rows = typeof globalThis.add2eCollectCharacterXpRows === "function"
    ? globalThis.add2eCollectCharacterXpRows()
    : (game.actors?.filter(a => a.type === "personnage") ?? []).map(actor => ({ actor, actorId: actor.id }));

  return rows.map(row => {
    const actor = row.actor ?? game.actors.get(row.actorId);
    if (!actor || actor.type !== "personnage") return null;
    return {
      actor,
      actorId: actor.id,
      name: actor.name,
      xp: Math.max(0, Math.floor(num(actor.system?.xp, 0))),
      level: Math.max(1, num(actor.system?.niveau, 1))
    };
  }).filter(Boolean);
}

function sourceRowHtml(row) {
  const checked = row.checked ? "checked" : "";
  const chip = row.source === "ledger"
    ? `<span class="a2e-chip ledger">registre</span>`
    : `<span class="a2e-chip ${row.hp <= 0 ? "dead" : "alive"}">PV ${esc(row.hp)}</span>`;

  return `<tr class="source-row" data-key="${esc(row.key)}" data-source="${esc(row.source)}" data-monster-name="${esc(row.monsterName)}" data-token-name="${esc(row.tokenName)}" data-scene-name="${esc(row.sceneName)}" data-scene-id="${esc(row.sceneId)}" data-token-id="${esc(row.tokenId)}" data-actor-id="${esc(row.actorId)}" data-actor-uuid="${esc(row.actorUuid)}" data-reason="${esc(row.reason)}">
    <td class="center"><input type="checkbox" data-role="include-source" ${checked}></td>
    <td><strong>${esc(row.monsterName)}</strong> ${chip}</td>
    <td>${esc(row.sceneName || "—")}</td>
    <td class="right"><input type="number" data-role="source-xp" value="${row.xp}" min="0" step="1"></td>
  </tr>`;
}

function characterRowHtml(row) {
  return `<tr class="character-row" data-actor-id="${esc(row.actorId)}">
    <td class="center"><input type="checkbox" data-role="include-character" checked></td>
    <td><strong>${esc(row.name)}</strong><br><small>Niv. ${row.level}</small></td>
    <td class="right">${row.xp.toLocaleString()}</td>
    <td class="right"><input type="number" data-role="share" value="1" min="0" step="0.5"></td>
    <td class="right"><input type="number" data-role="bonus-percent" value="0" step="1"></td>
    <td class="right"><input type="number" data-role="bonus-flat" value="0" step="1"></td>
  </tr>`;
}

function windowHtml() {
  const sources = [...getActiveLedgerRows(), ...getSceneRows()];
  const characters = getCharacterRows();

  return `<div id="${WINDOW_ID}" class="add2e-xp-window" role="dialog" aria-label="Bilan XP de session">
    <style>
      #${WINDOW_ID}{position:fixed;z-index:99999;left:calc(50vw - 520px);top:6vh;width:1040px;max-width:calc(100vw - 24px);height:82vh;max-height:calc(100vh - 24px);resize:both;overflow:hidden;border:2px solid #5e3814;border-radius:10px;background:#ead7a8;box-shadow:0 10px 32px rgba(0,0,0,.55);color:#261708;font-family:var(--font-primary, Arial, sans-serif)}
      #${WINDOW_ID} .xp-title{height:38px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 12px;background:linear-gradient(90deg,#3b2412,#7b3b1f);color:#fff;font-weight:900;cursor:move;user-select:none}
      #${WINDOW_ID} .xp-title button{border:1px solid rgba(255,255,255,.35);border-radius:5px;background:rgba(255,255,255,.12);color:#fff;padding:4px 8px;cursor:pointer;font-weight:800}
      #${WINDOW_ID} .xp-body{height:calc(100% - 82px);overflow:auto;padding:10px 12px;background:linear-gradient(135deg,#fbf0d0,#ead7a8)}
      #${WINDOW_ID} h3{margin:10px 0 7px;padding:8px 10px;border-radius:7px;background:linear-gradient(90deg,#7d331f,#b56f2d);color:#fff;font-size:1.05rem;text-shadow:0 1px 1px #000}
      #${WINDOW_ID} .hint{margin:6px 0 10px;padding:8px 10px;border-left:4px solid #235f8f;background:#eef6ff;border-radius:6px;color:#18344f;font-weight:650}
      #${WINDOW_ID} table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0 12px;background:#fffaf0;box-shadow:0 1px 4px rgba(0,0,0,.18)}
      #${WINDOW_ID} th,#${WINDOW_ID} td{border:1px solid #d3b65f;padding:6px 7px;vertical-align:middle;color:#261708}
      #${WINDOW_ID} th{background:linear-gradient(180deg,#f0dda2,#d9bd65);color:#3b2207;font-weight:900;text-align:left;text-shadow:none}
      #${WINDOW_ID} tbody tr:nth-child(even){background:#fff5dc}
      #${WINDOW_ID} tbody tr:hover{background:#fff0bd}
      #${WINDOW_ID} .center{text-align:center} #${WINDOW_ID} .right{text-align:right}
      #${WINDOW_ID} input[type="checkbox"]{width:20px;height:20px;accent-color:#326f38}
      #${WINDOW_ID} input[type="number"],#${WINDOW_ID} input[type="text"]{width:100%;padding:5px 7px;border:1px solid #9d8542;border-radius:5px;background:#fff;color:#111;font-weight:700}
      #${WINDOW_ID} td input[type="number"]{text-align:right;max-width:86px}
      #${WINDOW_ID} .global-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:6px 0 12px}
      #${WINDOW_ID} .global-grid label{display:flex;flex-direction:column;gap:4px;padding:7px;border:1px solid #d3b65f;border-radius:7px;background:#fffaf0;font-weight:800;color:#4a2d0a}
      #${WINDOW_ID} .chip,#${WINDOW_ID} .a2e-chip{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:.72rem;font-weight:900;border:1px solid #bfa65a;background:#fff6d8;color:#4a300b;margin-left:4px}
      #${WINDOW_ID} .a2e-chip.dead{border-color:#9d2d25;background:#ffe4df;color:#8d2b22} #${WINDOW_ID} .a2e-chip.alive{border-color:#3b7b45;background:#e5f7e8;color:#267a3d} #${WINDOW_ID} .a2e-chip.ledger{border-color:#235f8f;background:#e7f2ff;color:#235f8f}
      #${WINDOW_ID} .footer-note{padding:8px 10px;border-radius:6px;background:#f1fff0;border:1px solid #7caf78;color:#285c2a;font-weight:800}
      #${WINDOW_ID} .xp-footer{height:44px;display:flex;justify-content:flex-end;gap:8px;align-items:center;padding:6px 10px;background:#d6bf7b;border-top:1px solid #8a6a26}
      #${WINDOW_ID} .xp-footer button{min-width:120px;padding:7px 10px;border-radius:6px;border:1px solid #7b5d21;background:#fff8df;color:#2b1b0c;font-weight:900;cursor:pointer}
      #${WINDOW_ID} .xp-footer button.primary{background:#316f38;color:#fff;border-color:#214d27} #${WINDOW_ID} .xp-footer button.danger{background:#8d2b22;color:#fff;border-color:#5e1712}
      #${WINDOW_ID} .source-table col:nth-child(1){width:64px} #${WINDOW_ID} .source-table col:nth-child(2){width:auto} #${WINDOW_ID} .source-table col:nth-child(3){width:150px} #${WINDOW_ID} .source-table col:nth-child(4){width:115px}
      #${WINDOW_ID} .char-table col:nth-child(1){width:64px} #${WINDOW_ID} .char-table col:nth-child(2){width:auto} #${WINDOW_ID} .char-table col:nth-child(3){width:115px} #${WINDOW_ID} .char-table col:nth-child(4){width:90px} #${WINDOW_ID} .char-table col:nth-child(5){width:100px} #${WINDOW_ID} .char-table col:nth-child(6){width:110px}
    </style>
    <div class="xp-title"><span><i class="fas fa-coins"></i> ADD2E — Bilan XP de session</span><button type="button" data-action="close">✕ Fermer</button></div>
    <div class="xp-body">
      <h3>Sources d'XP monstres</h3>
      <div class="hint">Les monstres tombés à 0 PV sont enregistrés automatiquement. Les sources déjà appliquées disparaissent à la réouverture.</div>
      <table class="source-table">
        <colgroup><col><col><col><col></colgroup>
        <thead><tr><th>Incl.</th><th>Monstre</th><th>Scène</th><th>PX</th></tr></thead>
        <tbody>${sources.map(sourceRowHtml).join("") || `<tr><td colspan="4"><em>Aucune source d'XP disponible.</em></td></tr>`}</tbody>
      </table>

      <h3>Bonus globaux</h3>
      <div class="global-grid">
        <label>Objectifs / rôleplay <input type="number" name="objectivesXp" value="0" step="1"></label>
        <label>Trésors <input type="number" name="treasureXp" value="0" step="1"></label>
        <label>Bonus MJ global <input type="number" name="gmBonusXp" value="0" step="1"></label>
        <label>Motif <input type="text" name="reason" value="Bilan XP de session"></label>
      </div>

      <h3>Répartition vers les personnages</h3>
      <table class="char-table">
        <colgroup><col><col><col><col><col><col></colgroup>
        <thead><tr><th>Incl.</th><th>Personnage</th><th>XP actuel</th><th>Part</th><th>Bonus %</th><th>Bonus fixe</th></tr></thead>
        <tbody>${characters.map(characterRowHtml).join("") || `<tr><td colspan="6"><em>Aucun personnage trouvé.</em></td></tr>`}</tbody>
      </table>
      <div class="footer-note">Application : seuls les acteurs de type <code>personnage</code> reçoivent l'XP. Les monstres restent uniquement des sources de PX.</div>
    </div>
    <div class="xp-footer">
      <button type="button" data-action="audit">Audit champs</button>
      <button type="button" class="danger" data-action="reset">Réinitialiser registre</button>
      <button type="button" class="primary" data-action="apply">Appliquer l'XP</button>
      <button type="button" data-action="close">Fermer</button>
    </div>
  </div>`;
}

function readWindowData(root) {
  const selectedSources = [...root.querySelectorAll(".source-row")]
    .map(row => {
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
    })
    .filter(Boolean);

  const recipients = [...root.querySelectorAll(".character-row")]
    .map(row => {
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
    })
    .filter(Boolean);

  const objectivesXp = Math.max(0, Math.floor(num(root.querySelector("input[name='objectivesXp']")?.value, 0)));
  const treasureXp = Math.max(0, Math.floor(num(root.querySelector("input[name='treasureXp']")?.value, 0)));
  const gmBonusXp = Math.max(0, Math.floor(num(root.querySelector("input[name='gmBonusXp']")?.value, 0)));
  const monsterXp = selectedSources.reduce((sum, row) => sum + row.xp, 0);

  return {
    selectedSources,
    recipients,
    monsterXp,
    objectivesXp,
    treasureXp,
    gmBonusXp,
    sourceTotal: monsterXp + objectivesXp + treasureXp + gmBonusXp,
    reason: root.querySelector("input[name='reason']")?.value || "Bilan XP de session"
  };
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

async function updateActorXp(actor, amount, reason) {
  const gain = Math.max(0, Math.floor(num(amount, 0)));
  const before = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const expectedAfter = before + gain;

  await actor.update({ "system.xp": expectedAfter }, { add2eReason: "session-xp-dom-v3" });

  const liveActor = game.actors.get(actor.id) ?? actor;
  let after = Math.max(0, Math.floor(num(liveActor.system?.xp, expectedAfter)));

  if (after !== expectedAfter) {
    warn("[XP][VERIFY_RETRY]", { actor: actor.name, before, gain, expectedAfter, after, reason });
    await liveActor.update({ "system.xp": expectedAfter }, { add2eReason: "session-xp-dom-v3-retry", add2eForceXp: true });
    after = Math.max(0, Math.floor(num((game.actors.get(actor.id) ?? liveActor).system?.xp, expectedAfter)));
  }

  if (after !== expectedAfter) {
    throw new Error(`${actor.name} : XP attendue ${expectedAfter}, XP réelle ${after}`);
  }

  return { actor: liveActor, before, after, gained: gain };
}

async function markSourcesApplied(sources, reason) {
  const ledger = currentLedger();
  const appliedAt = nowIso();

  for (const source of sources) {
    const index = ledger.findIndex(entry => entry?.key === source.key);
    const entry = {
      ...(index >= 0 ? ledger[index] : {}),
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
    if (index >= 0) ledger[index] = entry;
    else ledger.push(entry);
  }

  await saveLedger(ledger);
}

async function createSessionChat(data, results, distribution) {
  const sourceLines = data.selectedSources.map(row => `<li>${esc(row.monsterName)} : <b>${row.xp.toLocaleString()}</b> PX${row.sceneName ? ` <small>(${esc(row.sceneName)})</small>` : ""}</li>`).join("");
  const resultLines = results.map(row => {
    const dist = distribution.find(d => d.actor.id === row.actor.id);
    return `<li>${esc(row.actor.name)} : +<b>${row.gained.toLocaleString()}</b> XP <small>(base ${Number(dist?.base ?? row.gained).toLocaleString()}${dist?.percentBonus ? `, bonus % ${dist.percentBonus.toLocaleString()}` : ""}${dist?.bonusFlat ? `, bonus fixe ${dist.bonusFlat.toLocaleString()}` : ""})</small> — ${row.before.toLocaleString()} → ${row.after.toLocaleString()}</li>`;
  }).join("");

  await ChatMessage.create({
    speaker: { alias: "ADD2E — XP" },
    content: `<div class="add2e-xp-session-chat" style="border:2px solid #a87924;border-radius:10px;background:#fff8df;padding:.75em .95em;color:#2b1b0c;">
      <h2 style="margin:.1em 0 .45em;color:#7d331f;">Bilan XP de session</h2>
      <p><b>Total réparti :</b> ${data.sourceTotal.toLocaleString()} XP</p>
      <p><b>Monstres :</b> ${data.monsterXp.toLocaleString()} XP — <b>Objectifs :</b> ${data.objectivesXp.toLocaleString()} XP — <b>Trésors :</b> ${data.treasureXp.toLocaleString()} XP — <b>Bonus MJ :</b> ${data.gmBonusXp.toLocaleString()} XP</p>
      <details open><summary><b>Sources</b></summary><ul>${sourceLines || "<li>Aucune source monstre.</li>"}</ul></details>
      <details open><summary><b>Répartition</b></summary><ul>${resultLines}</ul></details>
    </div>`
  });
}

async function applySessionXp(root) {
  const data = readWindowData(root);
  if (data.sourceTotal <= 0) return ui.notifications.warn("Le total d'XP est à 0.");
  if (!data.recipients.length) return ui.notifications.warn("Aucun personnage destinataire sélectionné.");

  const distribution = computeDistribution(data);
  if (!distribution.length) return ui.notifications.warn("Aucune répartition valide.");

  const applyButton = root.querySelector("[data-action='apply']");
  if (applyButton) {
    applyButton.disabled = true;
    applyButton.textContent = "Application...";
  }

  const results = [];
  try {
    for (const row of distribution) {
      const result = await updateActorXp(row.actor, row.total, data.reason);
      results.push(result);
    }

    await createSessionChat(data, results, distribution);
    await markSourcesApplied(data.selectedSources, data.reason);

    for (const result of results) {
      for (const app of Object.values(result.actor.apps ?? {})) {
        try { app.render(false); } catch (_err) {}
      }
    }

    ui.notifications.info("XP de session appliquée.");
    log("[APPLIED]", { data, distribution, results });
    closeWindow();
  } catch (err) {
    error("[APPLY][ERROR]", err);
    ui.notifications.error(`Application XP impossible : ${err.message || err}`);
    if (applyButton) {
      applyButton.disabled = false;
      applyButton.textContent = "Appliquer l'XP";
    }
  }
}

function closeWindow() {
  document.getElementById(WINDOW_ID)?.remove();
}

function makeDraggable(root) {
  const title = root.querySelector(".xp-title");
  if (!title) return;
  let drag = null;

  title.addEventListener("pointerdown", ev => {
    if (ev.target.closest("button")) return;
    drag = { x: ev.clientX, y: ev.clientY, left: root.offsetLeft, top: root.offsetTop };
    title.setPointerCapture?.(ev.pointerId);
  });

  title.addEventListener("pointermove", ev => {
    if (!drag) return;
    const left = Math.max(0, Math.min(window.innerWidth - 80, drag.left + ev.clientX - drag.x));
    const top = Math.max(0, Math.min(window.innerHeight - 42, drag.top + ev.clientY - drag.y));
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  });

  title.addEventListener("pointerup", () => { drag = null; });
  title.addEventListener("pointercancel", () => { drag = null; });
}

function bindWindow(root) {
  root.addEventListener("click", async ev => {
    const action = ev.target.closest("[data-action]")?.dataset?.action;
    if (!action) return;
    ev.preventDefault();
    ev.stopPropagation();

    if (action === "close") return closeWindow();
    if (action === "audit") return globalThis.add2eAuditXpFields?.();
    if (action === "reset") {
      const ok = window.confirm("Réinitialiser le registre XP de session et les flags de sécurité ?");
      if (!ok) return;
      if (typeof globalThis.add2eClearSessionXpLedger === "function") await globalThis.add2eClearSessionXpLedger({ alsoFlags: true });
      else await saveLedger([]);
      closeWindow();
      return openSessionXpWindow();
    }
    if (action === "apply") return applySessionXp(root);
  });

  makeDraggable(root);
}

function openSessionXpWindow() {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut ouvrir le bilan XP.");
  closeWindow();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = windowHtml();
  const root = wrapper.firstElementChild;
  document.body.appendChild(root);
  bindWindow(root);
  return root;
}

function xpToolDefinition() {
  return {
    name: "add2e-session-xp",
    title: "ADD2E — Bilan XP",
    icon: "fas fa-coins",
    button: true,
    visible: game.user?.isGM === true,
    onChange: () => openSessionXpWindow()
  };
}

function installOrReplaceTool(control) {
  if (!control) return false;
  const tool = xpToolDefinition();

  if (Array.isArray(control.tools)) {
    const index = control.tools.findIndex(t => t?.name === tool.name || t?.id === tool.name);
    if (index >= 0) control.tools[index] = tool;
    else control.tools.push(tool);
    return true;
  }

  if (control.tools instanceof Map) {
    control.tools.set(tool.name, tool);
    return true;
  }

  if (control.tools && typeof control.tools === "object") {
    control.tools[tool.name] = tool;
    return true;
  }

  control.tools = [tool];
  return true;
}

function installSceneButton(controls) {
  if (!game.user?.isGM) return;
  if (Array.isArray(controls)) {
    const tokenControl = controls.find(c => c?.name === "token" || c?.name === "tokens") ?? controls[0];
    installOrReplaceTool(tokenControl);
    return;
  }

  if (controls && typeof controls === "object") {
    const tokenControl = controls.token ?? controls.tokens ?? Object.values(controls).find(c => c?.name === "token" || c?.name === "tokens");
    if (installOrReplaceTool(tokenControl)) return;
    controls.add2e = controls.add2e ?? { name: "add2e", title: "ADD2E", icon: "fas fa-dragon", tools: [] };
    installOrReplaceTool(controls.add2e);
  }
}

Hooks.on("getSceneControlButtons", installSceneButton);

Hooks.once("ready", () => {
  globalThis.ADD2E_SESSION_XP_DOM_V3_VERSION = VERSION;
  globalThis.add2eOpenXpSession = openSessionXpWindow;
  globalThis.add2eOpenXpSessionDomV3 = openSessionXpWindow;
  game.add2e = game.add2e ?? {};
  game.add2e.openXpSession = openSessionXpWindow;
  log("[READY]", { version: VERSION });
});

globalThis.ADD2E_SESSION_XP_DOM_V3_VERSION = VERSION;
globalThis.add2eOpenXpSession = openSessionXpWindow;
globalThis.add2eOpenXpSessionDomV3 = openSessionXpWindow;
