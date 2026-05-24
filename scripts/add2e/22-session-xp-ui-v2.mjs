// ADD2E — Interface XP session V2
// Version : 2026-05-24-session-xp-ui-v2
//
// Remplace l'ouverture de fenêtre XP exposée par 20-session-xp.mjs :
// - fenêtre plus large, scroll vertical, tables compactes ;
// - couleurs plus lisibles ;
// - lecture fiable des lignes via dataset au lieu de name + CSS.escape ;
// - répartition fiable vers tous les personnages cochés ;
// - les sources appliquées sont masquées à la réouverture ;
// - bouton de réinitialisation du registre.

const VERSION = "2026-05-24-session-xp-ui-v2";
const TAG = "[ADD2E][SESSION_XP_UI_V2]";
const FLAG_LEDGER = "sessionXpLedger";

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
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

function activeLedgerRows() {
  return currentLedger()
    .filter(entry => entry && entry.included !== false)
    .map(entry => ({ ...entry, source: "ledger", alreadyRecorded: true, checked: true }));
}

function sceneRowsNotApplied() {
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

function characterRows() {
  const rows = typeof globalThis.add2eCollectCharacterXpRows === "function"
    ? globalThis.add2eCollectCharacterXpRows()
    : [];
  return rows.map(row => {
    const actor = row.actor ?? game.actors.get(row.actorId);
    return {
      actor,
      actorId: actor?.id ?? row.actorId ?? "",
      name: actor?.name ?? row.name ?? "Personnage",
      xp: Math.max(0, Math.floor(num(actor?.system?.xp ?? row.xp, 0))),
      level: Math.max(1, num(actor?.system?.niveau ?? row.level, 1))
    };
  }).filter(row => row.actor && row.actor.type === "personnage");
}

function sourceRowHtml(row) {
  const checked = row.checked ? "checked" : "";
  const hpText = row.source === "scene" ? `<span class="a2e-xp-chip ${row.hp <= 0 ? "dead" : "alive"}">PV ${esc(row.hp)}</span>` : `<span class="a2e-xp-chip ledger">registre</span>`;
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

function dialogContent() {
  const sourceRows = [...activeLedgerRows(), ...sceneRowsNotApplied()];
  const chars = characterRows();

  return `<form class="add2e-session-xp-v2">
    <style>
      .add2e-session-xp-v2{--gold:#d7ba63;--brown:#6a3a16;--red:#8d2b22;--green:#267a3d;--blue:#235f8f;--panel:#fffaf0;--soft:#f5e8bd;max-height:68vh;overflow-y:auto;padding:8px 10px 4px;color:#2b1b0c;background:linear-gradient(135deg,#f8efd7 0%,#ead7a8 100%)}
      .add2e-session-xp-v2 *{box-sizing:border-box}
      .add2e-session-xp-v2 h3{margin:10px 0 6px;padding:7px 10px;border-radius:7px;background:linear-gradient(90deg,#7d331f,#b06b2d);color:#fff;font-size:1.05rem;text-shadow:0 1px 1px #000}
      .add2e-session-xp-v2 .hint{margin:4px 0 8px;padding:7px 9px;border-left:4px solid var(--blue);background:#eef6ff;border-radius:5px;color:#1f3550}
      .add2e-session-xp-v2 table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6px 0 12px;background:var(--panel);box-shadow:0 1px 3px rgba(0,0,0,.18)}
      .add2e-session-xp-v2 th,.add2e-session-xp-v2 td{border:1px solid var(--gold);padding:6px 7px;vertical-align:middle;color:#2b1b0c}
      .add2e-session-xp-v2 th{background:linear-gradient(180deg,#f0dda2,#d9bd65);color:#3b2207;font-weight:900;text-shadow:none}
      .add2e-session-xp-v2 tbody tr:nth-child(even){background:#fff5dc}
      .add2e-session-xp-v2 tbody tr:hover{background:#fff0bd}
      .add2e-session-xp-v2 .center{text-align:center}.add2e-session-xp-v2 .right{text-align:right}
      .add2e-session-xp-v2 input[type="checkbox"]{width:20px;height:20px;accent-color:#346f38}
      .add2e-session-xp-v2 .a2e-xp-number{width:86px;max-width:100%;text-align:right;padding:4px 6px;border:1px solid #9d8542;border-radius:5px;background:#fff;color:#111;font-weight:700}
      .add2e-session-xp-v2 .a2e-xp-number.small{width:68px}
      .add2e-session-xp-v2 .a2e-xp-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .add2e-session-xp-v2 .a2e-xp-chip{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:.72rem;font-weight:800;border:1px solid #bfa65a;background:#fff6d8;color:#4a300b}
      .add2e-session-xp-v2 .a2e-xp-chip.dead{border-color:#9d2d25;background:#ffe4df;color:#8d2b22}.add2e-session-xp-v2 .a2e-xp-chip.alive{border-color:#3b7b45;background:#e5f7e8;color:#267a3d}.add2e-session-xp-v2 .a2e-xp-chip.ledger{border-color:#235f8f;background:#e7f2ff;color:#235f8f}
      .add2e-session-xp-v2 .global-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:6px 0 12px}
      .add2e-session-xp-v2 .global-grid label{display:flex;flex-direction:column;gap:3px;padding:7px;border:1px solid var(--gold);border-radius:7px;background:#fffaf0;font-weight:800;color:#4a2d0a}
      .add2e-session-xp-v2 .global-grid input{width:100%;padding:5px 7px;border:1px solid #9d8542;border-radius:5px;background:#fff;color:#111}
      .add2e-session-xp-v2 .footer-note{padding:7px 9px;border-radius:6px;background:#f1fff0;border:1px solid #7caf78;color:#285c2a;font-weight:700}
      .add2e-session-xp-v2 .source-table col:nth-child(1){width:62px}.add2e-session-xp-v2 .source-table col:nth-child(2){width:auto}.add2e-session-xp-v2 .source-table col:nth-child(3){width:120px}.add2e-session-xp-v2 .source-table col:nth-child(4){width:105px}
      .add2e-session-xp-v2 .char-table col:nth-child(1){width:62px}.add2e-session-xp-v2 .char-table col:nth-child(2){width:auto}.add2e-session-xp-v2 .char-table col:nth-child(3){width:105px}.add2e-session-xp-v2 .char-table col:nth-child(4){width:82px}.add2e-session-xp-v2 .char-table col:nth-child(5){width:92px}.add2e-session-xp-v2 .char-table col:nth-child(6){width:92px}
    </style>

    <h3>Sources d'XP monstres</h3>
    <div class="hint">Les monstres tombés à 0 PV sont enregistrés automatiquement. Les sources déjà appliquées disparaissent à la réouverture. Le bouton de réinitialisation permet de repartir à zéro.</div>
    <table class="source-table">
      <colgroup><col><col><col><col></colgroup>
      <thead><tr><th>Incl.</th><th>Monstre</th><th>Scène</th><th>PX</th></tr></thead>
      <tbody>${sourceRows.map(sourceRowHtml).join("") || `<tr><td colspan="4"><em>Aucune source d'XP disponible.</em></td></tr>`}</tbody>
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
      <tbody>${chars.map(characterRowHtml).join("") || `<tr><td colspan="6"><em>Aucun personnage trouvé.</em></td></tr>`}</tbody>
    </table>
    <div class="footer-note">Application : seuls les acteurs de type <code>personnage</code> reçoivent l'XP. Les monstres restent uniquement des sources de PX.</div>
  </form>`;
}

function readDialogForm(form) {
  const selectedSources = [...form.querySelectorAll(".a2e-xp-source-row")]
    .map(row => {
      const checked = row.querySelector("[data-role='include-source']")?.checked === true;
      if (!checked) return null;
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

  const recipients = [...form.querySelectorAll(".a2e-xp-character-row")]
    .map(row => {
      const checked = row.querySelector("[data-role='include-character']")?.checked === true;
      if (!checked) return null;
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

  const objectivesXp = Math.max(0, Math.floor(num(form.objectivesXp?.value, 0)));
  const treasureXp = Math.max(0, Math.floor(num(form.treasureXp?.value, 0)));
  const gmBonusXp = Math.max(0, Math.floor(num(form.gmBonusXp?.value, 0)));
  const monsterXp = selectedSources.reduce((sum, row) => sum + row.xp, 0);

  return {
    selectedSources,
    recipients,
    monsterXp,
    objectivesXp,
    treasureXp,
    gmBonusXp,
    sourceTotal: monsterXp + objectivesXp + treasureXp + gmBonusXp,
    reason: form.reason?.value || "Bilan XP de session"
  };
}

function computeDistribution(data) {
  const shareTotal = data.recipients.reduce((sum, row) => sum + row.share, 0);
  if (shareTotal <= 0) return [];

  const baseRows = data.recipients.map(row => {
    const raw = data.sourceTotal * (row.share / shareTotal);
    const base = Math.floor(raw);
    return { ...row, raw, base, fraction: raw - base };
  });

  let remainder = data.sourceTotal - baseRows.reduce((sum, row) => sum + row.base, 0);
  for (const row of [...baseRows].sort((a, b) => b.fraction - a.fraction)) {
    if (remainder <= 0) break;
    row.base += 1;
    remainder -= 1;
  }

  return baseRows.map(row => {
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

async function applySessionXpV2(data) {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut appliquer l'XP de session.");
  if (data.sourceTotal <= 0) return ui.notifications.warn("Le total d'XP est à 0.");
  if (!data.recipients.length) return ui.notifications.warn("Aucun personnage destinataire sélectionné.");

  const distribution = computeDistribution(data);
  const results = [];

  for (const row of distribution) {
    const before = Math.max(0, Math.floor(num(row.actor.system?.xp, 0)));
    const afterTarget = before + row.total;
    await row.actor.update({ "system.xp": afterTarget }, { add2eReason: "session-xp-v2" });
    const after = Math.max(0, Math.floor(num(row.actor.system?.xp, afterTarget)));
    results.push({ actor: row.actor, before, after, gained: row.total, base: row.base, percentBonus: row.percentBonus, bonusFlat: row.bonusFlat });
  }

  await markSourcesApplied(data.selectedSources, data.reason);

  const monsterLines = data.selectedSources.map(row => `<li>${esc(row.monsterName)} : <b>${row.xp.toLocaleString()}</b> PX${row.sceneName ? ` <small>(${esc(row.sceneName)})</small>` : ""}</li>`).join("");
  const resultLines = results.map(row => `<li>${esc(row.actor.name)} : +<b>${row.gained.toLocaleString()}</b> XP <small>(base ${row.base.toLocaleString()}${row.percentBonus ? `, bonus % ${row.percentBonus.toLocaleString()}` : ""}${row.bonusFlat ? `, bonus fixe ${row.bonusFlat.toLocaleString()}` : ""})</small> — ${row.before.toLocaleString()} → ${row.after.toLocaleString()}</li>`).join("");

  await ChatMessage.create({
    content: `<div class="add2e-xp-session-chat" style="border:2px solid #a87924;border-radius:10px;background:#fff8df;padding:.75em .95em;color:#2b1b0c;">
      <h2 style="margin:.1em 0 .45em;color:#7d331f;">Bilan XP de session</h2>
      <p><b>Total réparti :</b> ${data.sourceTotal.toLocaleString()} XP</p>
      <p><b>Monstres :</b> ${data.monsterXp.toLocaleString()} XP — <b>Objectifs :</b> ${data.objectivesXp.toLocaleString()} XP — <b>Trésors :</b> ${data.treasureXp.toLocaleString()} XP — <b>Bonus MJ :</b> ${data.gmBonusXp.toLocaleString()} XP</p>
      <details open><summary><b>Sources</b></summary><ul>${monsterLines || "<li>Aucune source monstre.</li>"}</ul></details>
      <details open><summary><b>Répartition</b></summary><ul>${resultLines}</ul></details>
    </div>`
  });

  ui.notifications.info("XP de session appliquée. Les sources utilisées sont maintenant masquées.");
  log("[APPLIED]", { data, distribution, results });
  return { data, distribution, results };
}

function tuneDialogWindow(dialog) {
  setTimeout(() => {
    const el = dialog?.element?.[0] ?? dialog?.element;
    if (!el?.querySelector) return;
    el.style.minWidth = "940px";
    el.style.maxWidth = "1100px";
    el.style.maxHeight = "90vh";
    const content = el.querySelector(".window-content");
    if (content) {
      content.style.overflow = "hidden";
      content.style.background = "#e8d7a8";
    }
  }, 50);
}

function openSessionXpDialogV2() {
  if (!game.user?.isGM) return ui.notifications.warn("Seul le MJ peut ouvrir le bilan XP.");

  const dialog = new Dialog({
    title: "ADD2E — Bilan XP de session",
    content: dialogContent(),
    buttons: {
      audit: {
        label: "Audit champs",
        callback: () => globalThis.add2eAuditXpFields?.()
      },
      reset: {
        label: "Réinitialiser registre",
        callback: async () => {
          if (typeof globalThis.add2eClearSessionXpLedger === "function") await globalThis.add2eClearSessionXpLedger({ alsoFlags: true });
          else await saveLedger([]);
        }
      },
      apply: {
        label: "Appliquer l'XP",
        callback: async html => {
          const root = html?.[0] ?? html;
          const form = root.querySelector("form");
          const data = readDialogForm(form);
          await applySessionXpV2(data);
        }
      },
      cancel: { label: "Fermer" }
    },
    default: "apply"
  }, { width: 980, height: 780, resizable: true });

  dialog.render(true);
  tuneDialogWindow(dialog);
  return dialog;
}

Hooks.once("ready", () => {
  globalThis.ADD2E_SESSION_XP_UI_V2_VERSION = VERSION;
  globalThis.add2eOpenXpSession = openSessionXpDialogV2;
  globalThis.add2eApplySessionXpV2 = applySessionXpV2;
  log("[READY]", { version: VERSION });
});

// Exposition immédiate si le fichier est importé après ready via reload partiel.
globalThis.ADD2E_SESSION_XP_UI_V2_VERSION = VERSION;
globalThis.add2eOpenXpSession = openSessionXpDialogV2;
globalThis.add2eApplySessionXpV2 = applySessionXpV2;
