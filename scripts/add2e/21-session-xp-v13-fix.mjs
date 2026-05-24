// ADD2E — Correctif XP session Foundry v13
// Version : 2026-05-24-session-xp-v13-fix-v1
//
// Corrige :
// - bouton MJ invisible si getSceneControlButtons fournit tools en objet/Map au lieu d'un tableau ;
// - détection 0 PV trop tardive si faite en updateActor au lieu de preUpdateActor ;
// - bouton de secours dans le répertoire des acteurs.

const VERSION = "2026-05-24-session-xp-v13-fix-v1";
const TAG = "[ADD2E][SESSION_XP_V13_FIX]";

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
}

function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "xp", "px"]){
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
    return fallback;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function actorHpValue(actor) {
  const sys = actor?.system ?? {};
  return num(sys.pdv ?? sys.pv ?? sys.hp ?? sys.points_de_vie ?? sys.hitPoints ?? 0, 0);
}

function changedHpValue(changes, fallback) {
  const paths = [
    "system.pdv",
    "system.pv",
    "system.hp",
    "system.hp.value",
    "system.points_de_vie",
    "system.hitPoints"
  ];
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

function queueRecord(actor, options = {}) {
  if (!actor || actor.type !== "monster") return;
  setTimeout(async () => {
    try {
      if (typeof globalThis.add2eRecordMonsterXp !== "function") {
        console.warn(`${TAG}[RECORD][MISSING_API] add2eRecordMonsterXp introuvable.`);
        return;
      }
      await globalThis.add2eRecordMonsterXp(actor, options);
    } catch (err) {
      console.error(`${TAG}[RECORD][ERROR]`, err);
    }
  }, 0);
}

function xpToolDefinition() {
  return {
    name: "add2e-session-xp",
    title: "ADD2E — Bilan XP",
    icon: "fas fa-coins",
    button: true,
    visible: game.user?.isGM === true,
    onClick: () => globalThis.add2eOpenXpSession?.()
  };
}

function hasToolArray(tools, name) {
  return Array.isArray(tools) && tools.some(t => t?.name === name || t?.id === name);
}

function installToolInControl(control, tool = xpToolDefinition()) {
  if (!control) return false;

  if (Array.isArray(control.tools)) {
    if (!hasToolArray(control.tools, tool.name)) control.tools.push(tool);
    return true;
  }

  if (control.tools instanceof Map) {
    if (!control.tools.has(tool.name)) control.tools.set(tool.name, tool);
    return true;
  }

  if (control.tools && typeof control.tools === "object") {
    if (!control.tools[tool.name]) control.tools[tool.name] = tool;
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

  const target =
    root.querySelector(".directory-header .header-actions") ||
    root.querySelector(".directory-header") ||
    root.querySelector("header") ||
    root.querySelector(".window-content") ||
    root;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "add2e-session-xp-sidebar-btn";
  btn.title = "ADD2E — Bilan XP de session";
  btn.innerHTML = `<i class="fas fa-coins"></i> XP MJ`;
  btn.style.cssText = "margin:4px 4px 6px 4px;padding:4px 8px;border:1px solid #9b7a2f;border-radius:5px;background:#ead99d;color:#3b2a08;font-weight:700;cursor:pointer;";
  btn.addEventListener("click", ev => {
    ev.preventDefault();
    ev.stopPropagation();
    globalThis.add2eOpenXpSession?.();
  });

  target.prepend(btn);
}

Hooks.once("ready", () => {
  log("[READY]", { version: VERSION, sessionXpApi: typeof globalThis.add2eOpenXpSession });
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

Hooks.on("getSceneControlButtons", controls => installSceneControlButton(controls));
Hooks.on("renderActorDirectory", injectActorDirectoryButton);
Hooks.on("renderSidebarTab", (app, html) => {
  const id = app?.id ?? app?.tabName ?? app?.constructor?.name ?? "";
  if (/actor/i.test(String(id))) injectActorDirectoryButton(app, html);
});

globalThis.ADD2E_SESSION_XP_V13_FIX_VERSION = VERSION;
globalThis.add2eInstallXpSceneButton = installSceneControlButton;
globalThis.add2eInjectXpActorDirectoryButton = injectActorDirectoryButton;
