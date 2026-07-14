// ADD2E — UI commune des fenêtres et messages liés aux sorts.
// Compatible Foundry V13/V14/V15 — DialogV2 / ApplicationV2 uniquement.
const VERSION = "2026-07-14-v8-arcane-dialogs-chat-refresh";
globalThis.ADD2E_SPELL_DIALOG_UI_VERSION = VERSION;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

const THEMES = {
  cleric: { label: "Clerc", bg: "#fffaf0", accent: "#f3e6c8", dark: "#6f4b12", main: "#b88924", border: "#c99a36", text: "#2d2011", labelColor: "#6f4b12" },
  druid: { label: "Druide", bg: "#f4faef", accent: "#dfeccd", dark: "#264a23", main: "#719c4a", border: "#7fa45d", text: "#202d1a", labelColor: "#355428" },
  wizard: { label: "Magicien", bg: "#f8f3ff", accent: "#e8ddfb", dark: "#2e1c5a", main: "#6b49b8", border: "#8060cc", text: "#211735", labelColor: "#4b3684" },
  illusionist: { label: "Illusionniste", bg: "#f9f7ff", accent: "#dff2ff", dark: "#275a8a", main: "#925ac6", border: "#70a9d6", text: "#1e3043", labelColor: "#315d83" },
  thief: { label: "Voleur", bg: "#eff9fa", accent: "#cce9ed", dark: "#164a58", main: "#2a8293", border: "#3b9daf", text: "#14333b", labelColor: "#1b6372" }
};

function themeData(theme) {
  return THEMES[theme] ?? THEMES.cleric;
}

function guessTheme({ title = "", content = "", theme = null } = {}) {
  if (theme && THEMES[theme]) return theme;
  const text = norm(`${title} ${content}`);
  if (text.includes("voleur") || text.includes("assassin") || text.includes("thief")) return "thief";
  if (text.includes("illusionniste") || text.includes("illusionist")) return "illusionist";
  if (text.includes("magicien") || text.includes("wizard") || text.includes("livre_de_sorts") || text.includes("parchemin") || text.includes("connaissance")) return "wizard";
  if (text.includes("druide") || text.includes("druid")) return "druid";
  return "cleric";
}

function guessIcon({ title = "", content = "", img = null } = {}) {
  if (img) return img;
  const text = norm(`${title} ${content}`);
  if (text.includes("voleur") || text.includes("assassin")) return "icons/svg/eye.svg";
  return "icons/svg/book.svg";
}

function ensureStyles() {
  const id = "add2e-spell-dialog-ui-style";
  const old = document.getElementById(id);
  if (old?.dataset?.version === VERSION) return;
  old?.remove();

  const style = document.createElement("style");
  style.id = id;
  style.dataset.version = VERSION;
  style.textContent = `
.application.add2e-spell-dialog-window{border:2px solid var(--a2e-border)!important;border-radius:16px!important;overflow:hidden!important;box-shadow:0 10px 26px rgba(0,0,0,.22)!important;background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent))!important;color:var(--a2e-text)!important}
.application.add2e-spell-dialog-window .window-header{background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main))!important;color:#fff!important;border:0!important;border-bottom:2px solid var(--a2e-border)!important}
.application.add2e-spell-dialog-window .window-content{background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent))!important;color:var(--a2e-text)!important;border:0!important;padding:12px!important}
.application.add2e-spell-dialog-window .dialog-content,.application.add2e-spell-dialog-window .add2e-dialog,.application.add2e-spell-dialog-window form{background:transparent!important;color:var(--a2e-text)!important;border:0!important;box-shadow:none!important}
.application.add2e-spell-dialog-window table{background:rgba(255,255,255,.48)!important;border:1px solid var(--a2e-border)!important}
.application.add2e-spell-dialog-window th{background:rgba(255,255,255,.58)!important;color:var(--a2e-dark)!important;border-color:var(--a2e-border)!important}
.application.add2e-spell-dialog-window td{border-color:rgba(128,96,204,.28)!important}
.application.add2e-spell-dialog-window tbody tr:nth-child(even){background:rgba(128,96,204,.08)!important}
.application.add2e-spell-dialog-window .dialog-buttons{background:transparent!important;border:0!important;padding-top:10px!important;gap:8px!important}
.application.add2e-spell-dialog-window .dialog-buttons button{border:1px solid var(--a2e-border)!important;border-radius:9px!important;background:#fff!important;color:var(--a2e-dark)!important;font-weight:800!important;box-shadow:none!important}
.application.add2e-spell-dialog-window .dialog-buttons button.default,.application.add2e-spell-dialog-window .dialog-buttons button[data-action="yes"],.application.add2e-spell-dialog-window .dialog-buttons button[data-action="roll"],.application.add2e-spell-dialog-window .dialog-buttons button[data-action="cast"]{background:linear-gradient(180deg,var(--a2e-main),var(--a2e-dark))!important;color:#fff!important}
.add2e-spell-dialog-shell{border:2px solid var(--a2e-border);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent));color:var(--a2e-text)}
.add2e-spell-dialog-header{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main));color:#fff;border-bottom:2px solid var(--a2e-border)}
.add2e-spell-dialog-header img{width:42px;height:42px;border-radius:8px;background:#fff;object-fit:cover;border:2px solid rgba(255,255,255,.9)}
.add2e-spell-dialog-title{font-size:1.08rem;font-weight:800}.add2e-spell-dialog-subtitle{font-size:.84rem;opacity:.95}.add2e-spell-dialog-body{padding:12px}
.chat-message .add2e-arcane-chat-card{border:2px solid #8060cc!important;border-radius:10px!important;background:linear-gradient(180deg,#f8f3ff,#e8ddfb)!important;color:#211735!important;box-shadow:0 3px 10px rgba(46,28,90,.16)!important;overflow:hidden!important}
.chat-message .add2e-arcane-chat-card>header,.chat-message .add2e-arcane-chat-card>.card-header{background:linear-gradient(90deg,#2e1c5a,#6b49b8)!important;color:#fff!important;border:0!important}
`;
  document.head.append(style);
}

function shell({ theme = "cleric", title = "Sort", subtitle = "", img = "icons/svg/book.svg", body = "" } = {}) {
  ensureStyles();
  const t = themeData(theme);
  return `<div class="add2e-spell-dialog-shell add2e-spell-dialog-theme-${esc(theme)}" style="--a2e-bg:${t.bg};--a2e-accent:${t.accent};--a2e-dark:${t.dark};--a2e-main:${t.main};--a2e-border:${t.border};--a2e-text:${t.text};--a2e-label:${t.labelColor};"><div class="add2e-spell-dialog-header"><img src="${esc(img)}" alt=""><div><div class="add2e-spell-dialog-title">${esc(title)}</div><div class="add2e-spell-dialog-subtitle">${esc(subtitle || t.label)}</div></div></div><div class="add2e-spell-dialog-body">${body}</div></div>`;
}

function primaryButtonClass(buttons) { return buttons; }

function isManagedDialog(title, content) {
  const text = norm(`${title} ${content}`);
  return text.startsWith("lancement_")
    || text.includes("add2e_thief_roll_dialog")
    || text.includes("livre_de_sorts")
    || text.includes("grimoire")
    || text.includes("parchemin")
    || text.includes("copie_du_sort")
    || text.includes("copier_un_sort")
    || text.includes("jet_de_connaissance")
    || text.includes("test_de_connaissance");
}

function wrapDialogOptions(options = {}) {
  const title = String(options?.window?.title ?? options?.title ?? "");
  const content = String(options?.content ?? "");
  if (!isManagedDialog(title, content) || content.includes("add2e-spell-dialog-shell")) return options;

  const theme = guessTheme({ title, content, theme: options?.add2eTheme });
  const t = themeData(theme);
  const rawTitle = title.replace(/^Lancement\s*:\s*/i, "").trim() || "ADD2E";
  const classes = [...(Array.isArray(options?.window?.classes) ? options.window.classes : []), "add2e-spell-dialog-window"];
  return {
    ...options,
    window: { ...(options.window ?? {}), classes: [...new Set(classes)] },
    classes: [...new Set([...(Array.isArray(options.classes) ? options.classes : []), "add2e-spell-dialog-window"])],
    content: shell({ theme, title: rawTitle, subtitle: t.label, img: guessIcon({ title, content, img: options?.add2eImg }), body: content })
  };
}

function patchDialogV2() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2 || DialogV2.__add2eSpellDialogPatched) return;
  for (const method of ["wait", "confirm", "prompt", "alert"]) {
    if (typeof DialogV2[method] !== "function") continue;
    const original = DialogV2[method].bind(DialogV2);
    DialogV2[method] = (options = {}, ...rest) => original(wrapDialogOptions(options), ...rest);
  }
  DialogV2.__add2eSpellDialogPatched = true;
}

function rootElement(html, app = null) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function styleRenderedDialog(app, html) {
  const root = rootElement(html, app);
  if (!root) return;
  const title = String(app?.title ?? root.querySelector(".window-title")?.textContent ?? "");
  const content = String(root.querySelector(".window-content")?.textContent ?? root.textContent ?? "");
  if (!isManagedDialog(title, content)) return;
  const theme = guessTheme({ title, content });
  const t = themeData(theme);
  root.classList.add("add2e-spell-dialog-window");
  for (const [key, value] of Object.entries({ "--a2e-bg": t.bg, "--a2e-accent": t.accent, "--a2e-dark": t.dark, "--a2e-main": t.main, "--a2e-border": t.border, "--a2e-text": t.text, "--a2e-label": t.labelColor })) root.style.setProperty(key, value);
}

function styleChatMessage(message, html) {
  const root = rootElement(html);
  if (!root) return;
  const content = String(message?.content ?? root.textContent ?? "");
  const text = norm(content);
  if (!text.includes("connaissance") && !text.includes("copie_du_sort") && !text.includes("livre_de_sorts") && !text.includes("parchemin")) return;
  const card = root.querySelector(".add2e-card-test,.chat-card,.message-content>div") ?? root.querySelector(".message-content");
  card?.classList?.add("add2e-arcane-chat-card");
}

const refreshTimers = new Map();
function refreshActorSheetForSpell(item) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage" || !["sort", "spell"].includes(String(item.type).toLowerCase())) return;
  const key = actor.uuid ?? actor.id;
  clearTimeout(refreshTimers.get(key));
  refreshTimers.set(key, setTimeout(() => {
    refreshTimers.delete(key);
    const apps = new Set([...Object.values(actor.apps ?? {}), ...Object.values(ui.windows ?? {}).filter(app => (app?.actor ?? app?.document ?? app?.object)?.id === actor.id)]);
    for (const app of apps) {
      try {
        app._add2eRememberActiveTab?.(app.element, app._add2eActiveTab || app._add2eReadStoredTab?.() || "sorts");
        app.render?.({ force: true });
      } catch (_error) {
        try { app.render?.(true); } catch (error) { console.warn("[ADD2E][SPELL_DIALOG_UI][REFRESH_ERROR]", error); }
      }
    }
  }, 50));
}

globalThis.ADD2E_SPELL_DIALOG_UI = { version: VERSION, themes: THEMES, shell, primaryButtonClass, ensureStyles, guessTheme, guessIcon, wrapDialogOptions, esc };
Hooks.once("ready", () => { ensureStyles(); patchDialogV2(); });
Hooks.on("renderDialogV2", styleRenderedDialog);
Hooks.on("renderApplicationV2", styleRenderedDialog);
Hooks.on("renderChatMessageHTML", styleChatMessage);
Hooks.on("createItem", refreshActorSheetForSpell);
Hooks.on("updateItem", refreshActorSheetForSpell);
Hooks.on("deleteItem", refreshActorSheetForSpell);
ensureStyles();
console.log("[ADD2E][SPELL_DIALOG_UI][VERSION]", VERSION);
