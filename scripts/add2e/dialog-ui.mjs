// ADD2E — Service commun des fenêtres DialogV2.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 uniquement.

const ADD2E_DIALOG_UI_VERSION = "2026-08-06-dialog-ui-v1";

globalThis.ADD2E_DIALOG_UI_VERSION = ADD2E_DIALOG_UI_VERSION;

const ADD2E_DIALOG_THEMES = Object.freeze({
  parchment: {
    dark: "#5d3d0d",
    main: "#9a7431",
    light: "#c9a756",
    border: "#9a7431",
    paper: "#fff8df",
    paperLight: "#fffdf4",
    paperDark: "#ead99d",
    text: "#2f210d"
  },
  monster: {
    dark: "#5b1915",
    main: "#8f3128",
    light: "#b45a49",
    border: "#9a7431",
    paper: "#fff8df",
    paperLight: "#fffdf4",
    paperDark: "#ead99d",
    text: "#2f210d"
  },
  danger: {
    dark: "#4f1512",
    main: "#9f2f27",
    light: "#c65c50",
    border: "#9f2f27",
    paper: "#fff4ef",
    paperLight: "#fffaf7",
    paperDark: "#edc1b7",
    text: "#32150f"
  },
  success: {
    dark: "#264a23",
    main: "#4f7f3b",
    light: "#719c4a",
    border: "#719c4a",
    paper: "#f4faef",
    paperLight: "#fbfff7",
    paperDark: "#dfeccd",
    text: "#202d1a"
  },
  wizard: {
    dark: "#2e1c5a",
    main: "#6b49b8",
    light: "#925ac6",
    border: "#8060cc",
    paper: "#f8f3ff",
    paperLight: "#fdfbff",
    paperDark: "#e8ddfb",
    text: "#211735"
  },
  druid: {
    dark: "#264a23",
    main: "#4f7f3b",
    light: "#719c4a",
    border: "#7fa45d",
    paper: "#f4faef",
    paperLight: "#fbfff7",
    paperDark: "#dfeccd",
    text: "#202d1a"
  },
  thief: {
    dark: "#164a58",
    main: "#2a8293",
    light: "#46a4b3",
    border: "#3b9daf",
    paper: "#eff9fa",
    paperLight: "#f8ffff",
    paperDark: "#cce9ed",
    text: "#14333b"
  }
});

const ADD2E_DIALOG_ADAPTERS = [
  {
    selector: ".add2e-monster-morale-form",
    theme: "monster",
    windowClass: "add2e-monster-morale-window",
    primaryAction: "roll"
  }
];

function add2eDialogEsc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eDialogTheme(name) {
  return ADD2E_DIALOG_THEMES[String(name ?? "parchment").trim()] ?? ADD2E_DIALOG_THEMES.parchment;
}

function add2eDialogElement(value) {
  if (value instanceof HTMLElement) return value;
  if (value?.[0] instanceof HTMLElement) return value[0];
  return null;
}

function add2eDialogRoot(app, html) {
  const appElement = add2eDialogElement(app?.element);
  if (appElement) return appElement.closest?.(".application, .window-app") ?? appElement;
  const htmlElement = add2eDialogElement(html);
  if (!htmlElement) return null;
  return htmlElement.closest?.(".application, .window-app") ?? htmlElement;
}

function add2eDialogEnsureStyles() {
  const id = "add2e-dialog-ui-style";
  const current = document.getElementById(id);
  if (current?.dataset?.version === ADD2E_DIALOG_UI_VERSION) return;
  current?.remove();

  const style = document.createElement("style");
  style.id = id;
  style.dataset.version = ADD2E_DIALOG_UI_VERSION;
  style.textContent = `
.application.add2e-dialog-window,
.window-app.add2e-dialog-window {
  min-width: min(680px, calc(100vw - 24px)) !important;
  max-width: min(900px, calc(100vw - 24px)) !important;
  max-height: calc(100vh - 24px) !important;
  border: 2px solid var(--a2e-dialog-dark) !important;
  border-radius: 14px !important;
  overflow: hidden !important;
  background: linear-gradient(180deg, var(--a2e-dialog-paper), var(--a2e-dialog-paper-dark)) !important;
  color: var(--a2e-dialog-text) !important;
  box-shadow: 0 10px 30px rgba(0,0,0,.42), inset 0 0 0 1px rgba(255,255,255,.45) !important;
}
.application.add2e-dialog-window > .window-header,
.application.add2e-dialog-window .window-header,
.window-app.add2e-dialog-window > .window-header,
.window-app.add2e-dialog-window .window-header {
  min-height: 46px !important;
  padding: 8px 12px !important;
  border: 0 !important;
  border-bottom: 2px solid var(--a2e-dialog-border) !important;
  background: linear-gradient(90deg, var(--a2e-dialog-dark), var(--a2e-dialog-main), var(--a2e-dialog-light)) !important;
  color: #fff !important;
  text-shadow: 0 1px 2px rgba(0,0,0,.75) !important;
}
.application.add2e-dialog-window .window-title,
.window-app.add2e-dialog-window .window-title {
  color: #fff !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: 1.08rem !important;
  font-weight: 900 !important;
  letter-spacing: .02em !important;
}
.application.add2e-dialog-window .window-header button,
.application.add2e-dialog-window .window-header .header-control,
.application.add2e-dialog-window .window-header i,
.window-app.add2e-dialog-window .window-header button,
.window-app.add2e-dialog-window .window-header .header-control,
.window-app.add2e-dialog-window .window-header i {
  border: 0 !important;
  background: transparent !important;
  color: #fff !important;
}
.application.add2e-dialog-window > .window-content,
.application.add2e-dialog-window .window-content,
.window-app.add2e-dialog-window > .window-content,
.window-app.add2e-dialog-window .window-content {
  min-height: 0 !important;
  max-height: calc(100vh - 72px) !important;
  padding: 0 !important;
  overflow: auto !important;
  background:
    radial-gradient(circle at 15% 20%, rgba(133,91,37,.08) 0 1px, transparent 2px),
    radial-gradient(circle at 80% 70%, rgba(133,91,37,.07) 0 1px, transparent 2px),
    linear-gradient(180deg, var(--a2e-dialog-paper-light), var(--a2e-dialog-paper-dark)) !important;
  background-size: 42px 42px, 57px 57px, 100% 100% !important;
  color: var(--a2e-dialog-text) !important;
}
.application.add2e-dialog-window .dialog-content,
.window-app.add2e-dialog-window .dialog-content,
.add2e-dialog-shell {
  padding: 12px !important;
  background: transparent !important;
  color: var(--a2e-dialog-text) !important;
}
.add2e-dialog-shell {
  display: block !important;
  min-width: 0 !important;
}
.application.add2e-dialog-window footer,
.application.add2e-dialog-window .form-footer,
.application.add2e-dialog-window .window-footer,
.application.add2e-dialog-window .dialog-buttons,
.window-app.add2e-dialog-window footer,
.window-app.add2e-dialog-window .form-footer,
.window-app.add2e-dialog-window .window-footer,
.window-app.add2e-dialog-window .dialog-buttons {
  display: grid !important;
  grid-auto-flow: column !important;
  grid-auto-columns: minmax(120px, 1fr) !important;
  gap: 9px !important;
  margin: 0 !important;
  padding: 9px 12px !important;
  border: 0 !important;
  border-top: 1px solid var(--a2e-dialog-border) !important;
  background: linear-gradient(180deg, var(--a2e-dialog-paper-dark), var(--a2e-dialog-border)) !important;
}
.application.add2e-dialog-window footer button,
.application.add2e-dialog-window .form-footer button,
.application.add2e-dialog-window .window-footer button,
.application.add2e-dialog-window .dialog-buttons button,
.window-app.add2e-dialog-window footer button,
.window-app.add2e-dialog-window .form-footer button,
.window-app.add2e-dialog-window .window-footer button,
.window-app.add2e-dialog-window .dialog-buttons button {
  width: 100% !important;
  min-height: 38px !important;
  margin: 0 !important;
  padding: 7px 14px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 7px !important;
  background: linear-gradient(180deg, var(--a2e-dialog-paper-light), var(--a2e-dialog-paper-dark)) !important;
  color: var(--a2e-dialog-text) !important;
  font-weight: 950 !important;
  box-shadow: 0 2px 4px rgba(0,0,0,.18) !important;
}
.application.add2e-dialog-window button.add2e-dialog-primary,
.window-app.add2e-dialog-window button.add2e-dialog-primary {
  border-color: var(--a2e-dialog-dark) !important;
  background: linear-gradient(180deg, var(--a2e-dialog-light), var(--a2e-dialog-dark)) !important;
  color: #fff !important;
  text-shadow: 0 1px 2px rgba(0,0,0,.65) !important;
}
.application.add2e-dialog-window footer button:hover,
.application.add2e-dialog-window .form-footer button:hover,
.application.add2e-dialog-window .dialog-buttons button:hover,
.window-app.add2e-dialog-window footer button:hover,
.window-app.add2e-dialog-window .form-footer button:hover,
.window-app.add2e-dialog-window .dialog-buttons button:hover {
  filter: brightness(1.08) !important;
  transform: translateY(-1px) !important;
}
.application.add2e-dialog-window input,
.application.add2e-dialog-window select,
.application.add2e-dialog-window textarea,
.window-app.add2e-dialog-window input,
.window-app.add2e-dialog-window select,
.window-app.add2e-dialog-window textarea {
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 6px !important;
  background: var(--a2e-dialog-paper-light) !important;
  color: var(--a2e-dialog-text) !important;
}
.application.add2e-dialog-window input[type="checkbox"],
.window-app.add2e-dialog-window input[type="checkbox"] {
  width: 17px !important;
  height: 17px !important;
  margin: 0 !important;
  accent-color: var(--a2e-dialog-main) !important;
}

/* Fenêtre de moral : contenu compact et lisible. */
.application.add2e-dialog-window.add2e-monster-morale-window,
.window-app.add2e-dialog-window.add2e-monster-morale-window {
  width: min(760px, calc(100vw - 24px)) !important;
}
.add2e-monster-morale-form {
  display: grid !important;
  gap: 10px !important;
  color: var(--a2e-dialog-text) !important;
}
.add2e-monster-morale-form .add2e-monster-morale-summary {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  margin: 0 !important;
  padding: 10px 12px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 9px !important;
  background: linear-gradient(180deg, var(--a2e-dialog-paper-light), var(--a2e-dialog-paper-dark)) !important;
}
.add2e-monster-morale-form .add2e-monster-morale-summary b {
  color: var(--a2e-dialog-dark) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: 1.12rem !important;
  font-weight: 900 !important;
}
.add2e-monster-morale-form .add2e-monster-morale-summary span {
  color: #5d3d0d !important;
  font-weight: 900 !important;
}
.add2e-monster-morale-form .add2e-monster-morale-grid {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 8px !important;
  margin: 0 !important;
}
.add2e-monster-morale-form .add2e-monster-morale-grid > label {
  min-width: 0 !important;
  padding: 8px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 8px !important;
  background: var(--a2e-dialog-paper-light) !important;
}
.add2e-monster-morale-form .add2e-monster-morale-grid label > span {
  display: block !important;
  margin-bottom: 4px !important;
  color: #6f4b12 !important;
  font-size: .8rem !important;
  font-weight: 950 !important;
  text-transform: uppercase !important;
}
.add2e-monster-morale-form .add2e-monster-morale-grid select,
.add2e-monster-morale-form .add2e-monster-morale-grid input {
  width: 100% !important;
  min-height: 34px !important;
  padding: 5px 7px !important;
  font-weight: 800 !important;
}
.add2e-monster-morale-form .add2e-monster-morale-columns {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 10px !important;
}
.add2e-monster-morale-form fieldset {
  min-width: 0 !important;
  margin: 0 !important;
  padding: 9px 10px 10px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 9px !important;
  background: linear-gradient(180deg, var(--a2e-dialog-paper-light), var(--a2e-dialog-paper)) !important;
}
.add2e-monster-morale-form legend {
  padding: 0 7px !important;
  color: var(--a2e-dialog-dark) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-weight: 900 !important;
}
.add2e-monster-morale-form .add2e-monster-morale-option {
  display: grid !important;
  grid-template-columns: 20px minmax(0,1fr) auto !important;
  gap: 8px !important;
  align-items: center !important;
  min-height: 29px !important;
  margin: 0 !important;
  padding: 3px 5px !important;
  border-radius: 5px !important;
}
.add2e-monster-morale-form .add2e-monster-morale-option:nth-of-type(odd) {
  background: rgba(217,191,115,.15) !important;
}
.add2e-monster-morale-form .add2e-monster-morale-option span {
  min-width: 0 !important;
  font-weight: 750 !important;
}
.add2e-monster-morale-form .add2e-monster-morale-option b {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 36px !important;
  padding: 1px 7px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 999px !important;
  background: #fff3c7 !important;
  color: #6f4b12 !important;
  font-weight: 950 !important;
  line-height: 1.3 !important;
}
@media (max-width: 800px) {
  .application.add2e-dialog-window,
  .window-app.add2e-dialog-window {
    width: calc(100vw - 16px) !important;
    min-width: calc(100vw - 16px) !important;
  }
  .add2e-monster-morale-form .add2e-monster-morale-grid,
  .add2e-monster-morale-form .add2e-monster-morale-columns {
    grid-template-columns: 1fr !important;
  }
}
`;
  document.head.appendChild(style);
}

function add2eDialogDescriptor(root) {
  const shell = root.querySelector?.(".add2e-dialog-shell[data-add2e-dialog-ui]") ?? null;
  if (shell) {
    return {
      shell,
      theme: shell.dataset.add2eDialogTheme || "parchment",
      windowClass: shell.dataset.add2eWindowClass || "",
      primaryAction: shell.dataset.add2ePrimaryAction || ""
    };
  }

  for (const adapter of ADD2E_DIALOG_ADAPTERS) {
    const marker = root.matches?.(adapter.selector) ? root : root.querySelector?.(adapter.selector);
    if (!marker) continue;
    return {
      shell: marker,
      theme: adapter.theme,
      windowClass: adapter.windowClass,
      primaryAction: adapter.primaryAction
    };
  }
  return null;
}

function add2eDialogApplyTheme(root, descriptor) {
  if (!root || !descriptor) return false;
  const theme = add2eDialogTheme(descriptor.theme);
  root.classList.add("add2e-dialog-window");
  if (descriptor.windowClass) {
    for (const className of descriptor.windowClass.split(/\s+/).filter(Boolean)) root.classList.add(className);
  }
  root.dataset.add2eDialogUi = ADD2E_DIALOG_UI_VERSION;
  root.style.setProperty("--a2e-dialog-dark", theme.dark);
  root.style.setProperty("--a2e-dialog-main", theme.main);
  root.style.setProperty("--a2e-dialog-light", theme.light);
  root.style.setProperty("--a2e-dialog-border", theme.border);
  root.style.setProperty("--a2e-dialog-paper", theme.paper);
  root.style.setProperty("--a2e-dialog-paper-light", theme.paperLight);
  root.style.setProperty("--a2e-dialog-paper-dark", theme.paperDark);
  root.style.setProperty("--a2e-dialog-text", theme.text);

  const buttons = root.querySelectorAll?.("footer button, .form-footer button, .window-footer button, .dialog-buttons button") ?? [];
  for (const button of buttons) {
    const action = String(button.dataset?.action ?? button.value ?? "");
    const primary = action === descriptor.primaryAction || button.classList.contains("default") || button.dataset?.default === "true";
    button.classList.toggle("add2e-dialog-primary", primary);
  }
  return true;
}

function add2eDialogDecorate(app, html) {
  add2eDialogEnsureStyles();
  const root = add2eDialogRoot(app, html);
  if (!root) return false;
  const apply = () => {
    const descriptor = add2eDialogDescriptor(root);
    if (descriptor) add2eDialogApplyTheme(root, descriptor);
  };
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 50);
  return true;
}

function add2eDialogShell({ content = "", theme = "parchment", windowClass = "", primaryAction = "" } = {}) {
  return `<div class="add2e-dialog-shell" data-add2e-dialog-ui="${add2eDialogEsc(ADD2E_DIALOG_UI_VERSION)}" data-add2e-dialog-theme="${add2eDialogEsc(theme)}" data-add2e-window-class="${add2eDialogEsc(windowClass)}" data-add2e-primary-action="${add2eDialogEsc(primaryAction)}">${content}</div>`;
}

function add2eDialogPrepareOptions(options = {}) {
  const theme = String(options.add2eTheme ?? options.theme ?? "parchment");
  const primaryAction = String(
    options.add2ePrimaryAction
    ?? options.primaryAction
    ?? options.buttons?.find?.(button => button?.default === true)?.action
    ?? ""
  );
  const extraClasses = [
    ...(Array.isArray(options?.window?.classes) ? options.window.classes : []),
    ...(Array.isArray(options.add2eClasses) ? options.add2eClasses : []),
    "add2e-dialog-window"
  ].filter(Boolean);
  const windowClass = [...new Set(extraClasses)].join(" ");
  const content = String(options.content ?? "");
  const prepared = {
    ...options,
    window: {
      ...(options.window ?? {}),
      classes: [...new Set(extraClasses)]
    },
    content: content.includes("data-add2e-dialog-ui=")
      ? content
      : add2eDialogShell({ content, theme, windowClass, primaryAction })
  };
  delete prepared.add2eTheme;
  delete prepared.theme;
  delete prepared.add2ePrimaryAction;
  delete prepared.primaryAction;
  delete prepared.add2eClasses;
  return prepared;
}

function add2eDialogClass() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) throw new Error("DialogV2 est indisponible.");
  return DialogV2;
}

async function add2eDialogCall(method, options = {}, ...rest) {
  add2eDialogEnsureStyles();
  const DialogV2 = add2eDialogClass();
  if (typeof DialogV2[method] !== "function") throw new Error(`DialogV2.${method} est indisponible.`);
  return DialogV2[method](add2eDialogPrepareOptions(options), ...rest);
}

function add2eRegisterDialogAdapter(adapter = {}) {
  const selector = String(adapter.selector ?? "").trim();
  if (!selector) throw new Error("Le sélecteur de fenêtre ADD2E est requis.");
  ADD2E_DIALOG_ADAPTERS.push({
    selector,
    theme: String(adapter.theme ?? "parchment"),
    windowClass: String(adapter.windowClass ?? ""),
    primaryAction: String(adapter.primaryAction ?? "")
  });
}

globalThis.ADD2E_DIALOG_UI = Object.freeze({
  version: ADD2E_DIALOG_UI_VERSION,
  themes: ADD2E_DIALOG_THEMES,
  wait: (options, ...rest) => add2eDialogCall("wait", options, ...rest),
  confirm: (options, ...rest) => add2eDialogCall("confirm", options, ...rest),
  prompt: (options, ...rest) => add2eDialogCall("prompt", options, ...rest),
  alert: (options, ...rest) => add2eDialogCall("alert", options, ...rest),
  prepareOptions: add2eDialogPrepareOptions,
  registerAdapter: add2eRegisterDialogAdapter,
  decorate: add2eDialogDecorate,
  ensureStyles: add2eDialogEnsureStyles
});

globalThis.add2eDialogWait = globalThis.ADD2E_DIALOG_UI.wait;
globalThis.add2eDialogConfirm = globalThis.ADD2E_DIALOG_UI.confirm;
globalThis.add2eDialogPrompt = globalThis.ADD2E_DIALOG_UI.prompt;
globalThis.add2eDialogAlert = globalThis.ADD2E_DIALOG_UI.alert;

Hooks.on("renderDialogV2", add2eDialogDecorate);
Hooks.on("renderApplicationV2", add2eDialogDecorate);
Hooks.once("ready", add2eDialogEnsureStyles);

add2eDialogEnsureStyles();
console.log("[ADD2E][DIALOG_UI][VERSION]", ADD2E_DIALOG_UI_VERSION);
