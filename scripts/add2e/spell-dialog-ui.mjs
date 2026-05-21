// ADD2E — UI commune des popups de sorts
// Version : 2026-05-21-v2-auto-wrap
const VERSION = "2026-05-21-v2-auto-wrap";
globalThis.ADD2E_SPELL_DIALOG_UI_VERSION = VERSION;

function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

const THEMES = {
  cleric: { label: "Clerc", bg: "#fffaf0", dark: "#5c3c0b", main: "#b88924", border: "#c99a36", text: "#2d2011", labelColor: "#6f4b12", accent: "#fff7df" },
  druid: { label: "Druide", bg: "#f4faef", dark: "#264a23", main: "#719c4a", border: "#7fa45d", text: "#202d1a", labelColor: "#355428", accent: "#e9f4df" },
  wizard: { label: "Magicien", bg: "#f8f3ff", dark: "#2e1c5a", main: "#6b49b8", border: "#8060cc", text: "#211735", labelColor: "#4b3684", accent: "#eee6ff" },
  illusionist: { label: "Illusionniste", bg: "#f9f7ff", dark: "#275a8a", main: "#925ac6", border: "#70a9d6", text: "#1e3043", labelColor: "#315d83", accent: "#e8f4ff" }
};

const SPELL_THEME_HINTS = new Map([
  ["apaisement", "cleric"],
  ["epouvante", "cleric"],
  ["aquagenese", "cleric"],
  ["destruction_eau", "cleric"],
  ["benediction", "cleric"],
  ["malediction", "cleric"],
  ["detection_de_la_magie", "cleric"]
]);

function themeData(theme) {
  return THEMES[theme] ?? THEMES.cleric;
}

function guessTheme({ title = "", content = "", theme = null } = {}) {
  if (theme && THEMES[theme]) return theme;
  const text = norm(`${title} ${content}`);
  if (text.includes("illusionniste") || text.includes("illusionist")) return "illusionist";
  if (text.includes("magicien") || text.includes("wizard")) return "wizard";
  if (text.includes("druide") || text.includes("druid")) return "druid";
  if (text.includes("clerc") || text.includes("divin") || text.includes("divine")) return "cleric";
  for (const [hint, value] of SPELL_THEME_HINTS) if (text.includes(hint)) return value;
  return "cleric";
}

function ensureStyles() {
  if (document.getElementById("add2e-spell-dialog-ui-style")) return;
  const el = document.createElement("style");
  el.id = "add2e-spell-dialog-ui-style";
  el.textContent = `
.add2e-spell-dialog-shell{border-radius:14px;overflow:hidden;border:2px solid var(--a2e-border);background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent));color:var(--a2e-text);box-shadow:0 8px 20px rgba(0,0,0,.18);font-family:var(--font-primary)}
.add2e-spell-dialog-header{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main));color:#fff;border-bottom:2px solid var(--a2e-border)}
.add2e-spell-dialog-header img{width:42px;height:42px;border-radius:8px;background:#fff;object-fit:cover;border:2px solid rgba(255,255,255,.9);flex:0 0 auto}
.add2e-spell-dialog-title{font-size:1.08rem;font-weight:800;line-height:1.15}.add2e-spell-dialog-subtitle{font-size:.84rem;opacity:.95;line-height:1.2;margin-top:2px}.add2e-spell-dialog-body{padding:12px;display:flex;flex-direction:column;gap:10px}
.add2e-spell-dialog-shell form,.add2e-spell-dialog-shell .add2e-dialog-panel{background:rgba(255,255,255,.86);border:1px solid var(--a2e-border);border-radius:9px;padding:10px;margin:0}.add2e-spell-dialog-shell .form-group{display:flex;flex-direction:column;gap:4px;margin:0 0 8px}.add2e-spell-dialog-shell label{color:var(--a2e-label);font-weight:700}.add2e-spell-dialog-shell select,.add2e-spell-dialog-shell input[type=number],.add2e-spell-dialog-shell input[type=text],.add2e-spell-dialog-shell textarea{width:100%;border:1px solid var(--a2e-border);border-radius:7px;background:rgba(255,255,255,.96);color:var(--a2e-text);padding:6px 8px}.add2e-inline-check{display:flex;align-items:center;gap:8px}.add2e-dialog-mini-list{display:grid;gap:4px;font-size:.92em;line-height:1.42}
.application:has(.add2e-spell-dialog-shell) .window-content{background:transparent;padding:10px}.application:has(.add2e-spell-dialog-shell) .dialog-buttons{padding:10px 0 0;gap:8px}.application:has(.add2e-spell-dialog-shell) .dialog-buttons button.default,.application:has(.add2e-spell-dialog-shell) .dialog-buttons button[data-action=cast]{background:linear-gradient(180deg,var(--a2e-main),var(--a2e-dark));color:white;border:1px solid var(--a2e-border);border-radius:9px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,.18)}.application:has(.add2e-spell-dialog-shell) .dialog-buttons button:not(.default):not([data-action=cast]){border-radius:9px;font-weight:700}`;
  document.head.appendChild(el);
}

function shell({ theme = "cleric", title = "Sort", subtitle = "", img = "icons/svg/book.svg", body = "" } = {}) {
  ensureStyles();
  const t = themeData(theme);
  return `<div class="add2e-spell-dialog-shell add2e-spell-dialog-theme-${esc(theme)}" style="--a2e-bg:${t.bg};--a2e-accent:${t.accent};--a2e-dark:${t.dark};--a2e-main:${t.main};--a2e-border:${t.border};--a2e-text:${t.text};--a2e-label:${t.labelColor};"><div class="add2e-spell-dialog-header"><img src="${esc(img)}"><div><div class="add2e-spell-dialog-title">${esc(title)}</div><div class="add2e-spell-dialog-subtitle">${esc(subtitle || t.label)}</div></div></div><div class="add2e-spell-dialog-body">${body}</div></div>`;
}

function primaryButtonClass(buttons) {
  return buttons;
}

function wrapDialogOptions(options = {}) {
  const windowTitle = String(options?.window?.title ?? options?.title ?? "");
  const content = String(options?.content ?? "");
  if (!windowTitle.toLowerCase().startsWith("lancement")) return options;
  if (content.includes("add2e-spell-dialog-shell")) return options;

  const rawTitle = windowTitle.replace(/^Lancement\s*:\s*/i, "").trim() || "Sort";
  const theme = guessTheme({ title: windowTitle, content, theme: options?.add2eTheme });
  const t = themeData(theme);
  const img = options?.add2eImg || "icons/svg/book.svg";

  return {
    ...options,
    content: shell({ theme, title: rawTitle, subtitle: `Sort — ${t.label}`, img, body: content })
  };
}

function patchDialogV2() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2 || DialogV2.__add2eSpellDialogPatched) return;
  const originalWait = DialogV2.wait.bind(DialogV2);
  DialogV2.wait = function add2eSpellDialogWait(options = {}, ...rest) {
    return originalWait(wrapDialogOptions(options), ...rest);
  };
  DialogV2.__add2eSpellDialogPatched = true;
  console.log("[ADD2E][SPELL_DIALOG_UI][PATCH_DIALOGV2] actif");
}

globalThis.ADD2E_SPELL_DIALOG_UI = { version: VERSION, themes: THEMES, shell, primaryButtonClass, ensureStyles, guessTheme, wrapDialogOptions, esc };
Hooks.once("ready", () => { ensureStyles(); patchDialogV2(); });
ensureStyles();
console.log("[ADD2E][SPELL_DIALOG_UI][VERSION]", VERSION);
