// ADD2E — UI commune des popups de sorts
// Version : 2026-05-21-v3-window-harmonized
const VERSION = "2026-05-21-v3-window-harmonized";
globalThis.ADD2E_SPELL_DIALOG_UI_VERSION = VERSION;

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function norm(v) {
  return String(v ?? "")
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
  illusionist: { label: "Illusionniste", bg: "#f9f7ff", accent: "#dff2ff", dark: "#275a8a", main: "#925ac6", border: "#70a9d6", text: "#1e3043", labelColor: "#315d83" }
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
.application.add2e-spell-dialog-window.add2e-theme-cleric,.window-app.add2e-spell-dialog-window.add2e-theme-cleric{--a2e-bg:#fffaf0;--a2e-accent:#f3e6c8;--a2e-dark:#6f4b12;--a2e-main:#b88924;--a2e-border:#c99a36;--a2e-text:#2d2011;--a2e-label:#6f4b12;}
.application.add2e-spell-dialog-window.add2e-theme-druid,.window-app.add2e-spell-dialog-window.add2e-theme-druid{--a2e-bg:#f4faef;--a2e-accent:#dfeccd;--a2e-dark:#264a23;--a2e-main:#719c4a;--a2e-border:#7fa45d;--a2e-text:#202d1a;--a2e-label:#355428;}
.application.add2e-spell-dialog-window.add2e-theme-wizard,.window-app.add2e-spell-dialog-window.add2e-theme-wizard{--a2e-bg:#f8f3ff;--a2e-accent:#e8ddfb;--a2e-dark:#2e1c5a;--a2e-main:#6b49b8;--a2e-border:#8060cc;--a2e-text:#211735;--a2e-label:#4b3684;}
.application.add2e-spell-dialog-window.add2e-theme-illusionist,.window-app.add2e-spell-dialog-window.add2e-theme-illusionist{--a2e-bg:#f9f7ff;--a2e-accent:#dff2ff;--a2e-dark:#275a8a;--a2e-main:#925ac6;--a2e-border:#70a9d6;--a2e-text:#1e3043;--a2e-label:#315d83;}

.application.add2e-spell-dialog-window,.window-app.add2e-spell-dialog-window{border:2px solid var(--a2e-border);border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,.22);background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent));}
.application.add2e-spell-dialog-window .window-header,.window-app.add2e-spell-dialog-window .window-header{background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main));color:white;border-bottom:2px solid var(--a2e-border);}
.application.add2e-spell-dialog-window .window-title,.window-app.add2e-spell-dialog-window .window-title{color:white;font-weight:800;}
.application.add2e-spell-dialog-window .header-button,.application.add2e-spell-dialog-window .window-header a,.window-app.add2e-spell-dialog-window .header-button,.window-app.add2e-spell-dialog-window .window-header a{color:white;}
.application.add2e-spell-dialog-window .window-content,.window-app.add2e-spell-dialog-window .window-content{background:transparent;color:var(--a2e-text);padding:10px;}
.application.add2e-spell-dialog-window .dialog-buttons,.window-app.add2e-spell-dialog-window .dialog-buttons{background:transparent;padding:10px 0 0 0;gap:8px;}
.application.add2e-spell-dialog-window .dialog-buttons button.default,.application.add2e-spell-dialog-window .dialog-buttons button[data-action="cast"],.window-app.add2e-spell-dialog-window .dialog-buttons button.default,.window-app.add2e-spell-dialog-window .dialog-buttons button[data-action="cast"]{background:linear-gradient(180deg,var(--a2e-main),var(--a2e-dark));color:white;border:1px solid var(--a2e-border);border-radius:9px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,.18);}
.application.add2e-spell-dialog-window .dialog-buttons button:not(.default):not([data-action="cast"]),.window-app.add2e-spell-dialog-window .dialog-buttons button:not(.default):not([data-action="cast"]){border-radius:9px;font-weight:700;}

.add2e-spell-dialog-shell{border-radius:14px;overflow:hidden;border:2px solid var(--a2e-border);background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent));color:var(--a2e-text);font-family:var(--font-primary);}
.add2e-spell-dialog-header{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main));color:white;border-bottom:2px solid var(--a2e-border);}
.add2e-spell-dialog-header img{width:42px;height:42px;border-radius:8px;background:rgba(255,255,255,.95);object-fit:cover;border:2px solid rgba(255,255,255,.9);flex:0 0 auto;}
.add2e-spell-dialog-title{font-size:1.08rem;font-weight:800;line-height:1.15;}
.add2e-spell-dialog-subtitle{font-size:.84rem;opacity:.95;line-height:1.2;margin-top:2px;}
.add2e-spell-dialog-body{padding:12px;display:flex;flex-direction:column;gap:10px;}
.add2e-spell-dialog-shell form,.add2e-spell-dialog-shell .add2e-dialog-panel{background:rgba(255,255,255,.72);border:1px solid var(--a2e-border);border-radius:9px;padding:10px;margin:0;}
.add2e-spell-dialog-shell .form-group{display:flex;flex-direction:column;gap:4px;margin:0 0 8px 0;}
.add2e-spell-dialog-shell .form-group:last-child{margin-bottom:0;}
.add2e-spell-dialog-shell label{color:var(--a2e-label);font-weight:700;}
.add2e-spell-dialog-shell select,.add2e-spell-dialog-shell input[type="number"],.add2e-spell-dialog-shell input[type="text"],.add2e-spell-dialog-shell textarea{width:100%;border:1px solid var(--a2e-border);border-radius:7px;background:rgba(255,255,255,.96);color:var(--a2e-text);padding:6px 8px;}
.add2e-inline-check{display:flex;align-items:center;gap:8px;}
.add2e-dialog-mini-list{display:grid;gap:4px;font-size:.92em;line-height:1.42;}
`;
  document.head.appendChild(el);
}

function shell({ theme = "cleric", title = "Sort", subtitle = "", img = "icons/svg/book.svg", body = "" } = {}) {
  ensureStyles();
  const t = themeData(theme);
  return `
    <div
      class="add2e-spell-dialog-shell add2e-spell-dialog-theme-${esc(theme)}"
      style="--a2e-bg:${t.bg};--a2e-accent:${t.accent};--a2e-dark:${t.dark};--a2e-main:${t.main};--a2e-border:${t.border};--a2e-text:${t.text};--a2e-label:${t.labelColor};"
    >
      <div class="add2e-spell-dialog-header">
        <img src="${esc(img)}" alt="">
        <div>
          <div class="add2e-spell-dialog-title">${esc(title)}</div>
          <div class="add2e-spell-dialog-subtitle">${esc(subtitle || t.label)}</div>
        </div>
      </div>
      <div class="add2e-spell-dialog-body">${body}</div>
    </div>
  `;
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
  const classes = Array.isArray(options?.window?.classes) ? [...options.window.classes] : [];
  classes.push("add2e-spell-dialog-window", `add2e-theme-${theme}`);

  return {
    ...options,
    window: { ...(options.window ?? {}), classes: [...new Set(classes)] },
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
