// ADD2E — API commune des fenêtres DialogV2.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 uniquement.

const ADD2E_DIALOG_UI_VERSION = "2026-08-08-dialog-ui-v4";
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

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function theme(name) {
  return ADD2E_DIALOG_THEMES[String(name ?? "parchment").trim()] ?? ADD2E_DIALOG_THEMES.parchment;
}

function htmlElement(value) {
  if (value instanceof HTMLElement) return value;
  if (value?.[0] instanceof HTMLElement) return value[0];
  return null;
}

function applicationRoot(app, html) {
  const appElement = htmlElement(app?.element);
  if (appElement) return appElement.closest?.(".application, .window-app") ?? appElement;

  const rendered = htmlElement(html);
  if (!rendered) return null;
  return rendered.closest?.(".application, .window-app") ?? rendered;
}

function ensureStyles() {
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

.application.add2e-dialog-window .window-header,
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

.application.add2e-dialog-window .window-content,
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

.application.add2e-dialog-window input:not([type="checkbox"]):not([type="radio"]),
.application.add2e-dialog-window select,
.application.add2e-dialog-window textarea,
.window-app.add2e-dialog-window input:not([type="checkbox"]):not([type="radio"]),
.window-app.add2e-dialog-window select,
.window-app.add2e-dialog-window textarea {
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 6px !important;
  background: var(--a2e-dialog-paper-light) !important;
  color: var(--a2e-dialog-text) !important;
}

.application.add2e-dialog-window input[type="checkbox"],
.window-app.add2e-dialog-window input[type="checkbox"] {
  appearance: none !important;
  -webkit-appearance: none !important;
  display: inline-grid !important;
  place-content: center !important;
  box-sizing: border-box !important;
  flex: 0 0 18px !important;
  width: 18px !important;
  min-width: 18px !important;
  max-width: 18px !important;
  height: 18px !important;
  min-height: 18px !important;
  max-height: 18px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 2px solid var(--a2e-dialog-border) !important;
  border-radius: 4px !important;
  background: var(--a2e-dialog-paper-light) !important;
  color: #fff !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.65) !important;
  cursor: pointer !important;
}

.application.add2e-dialog-window input[type="checkbox"]::before,
.window-app.add2e-dialog-window input[type="checkbox"]::before {
  content: none !important;
  display: none !important;
}

.application.add2e-dialog-window input[type="checkbox"]::after,
.window-app.add2e-dialog-window input[type="checkbox"]::after {
  content: "" !important;
  display: block !important;
  width: 8px !important;
  height: 4px !important;
  border: 0 solid transparent !important;
  transform: rotate(-45deg) !important;
}

.application.add2e-dialog-window input[type="checkbox"]:checked,
.window-app.add2e-dialog-window input[type="checkbox"]:checked {
  border-color: var(--a2e-dialog-dark) !important;
  background: var(--a2e-dialog-main) !important;
}

.application.add2e-dialog-window input[type="checkbox"]:checked::after,
.window-app.add2e-dialog-window input[type="checkbox"]:checked::after {
  border-left: 2px solid #fff !important;
  border-bottom: 2px solid #fff !important;
}

.application.add2e-dialog-window input[type="checkbox"]:focus-visible,
.window-app.add2e-dialog-window input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--a2e-dialog-light) !important;
  outline-offset: 2px !important;
}

/* Boutique générique : contenu métier commun à tous les marchands. */
.application.add2e-dialog-window.add2e-shop-window,
.window-app.add2e-dialog-window.add2e-shop-window {
  width: min(1040px, calc(100vw - 24px)) !important;
  max-width: min(1040px, calc(100vw - 24px)) !important;
}

.add2e-shop-content {
  display: grid !important;
  gap: 8px !important;
  min-width: 0 !important;
}

.add2e-shop-summary {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  padding: 8px 10px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 8px !important;
  background: linear-gradient(180deg, var(--a2e-dialog-paper-light), var(--a2e-dialog-paper-dark)) !important;
}

.add2e-shop-summary .add2e-shop-money {
  color: var(--a2e-dialog-dark) !important;
  font-weight: 950 !important;
  white-space: nowrap !important;
}

.add2e-shop-toolbar {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 6px !important;
}

.add2e-shop-tabs {
  display: flex !important;
  flex: 1 1 auto !important;
  flex-wrap: wrap !important;
  gap: 5px !important;
}

.add2e-shop-tabs button,
.add2e-shop-toolbar button,
.add2e-shop-action {
  min-height: 28px !important;
  margin: 0 !important;
  padding: 4px 9px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 6px !important;
  background: linear-gradient(180deg, var(--a2e-dialog-paper-light), var(--a2e-dialog-paper-dark)) !important;
  color: var(--a2e-dialog-text) !important;
  font-weight: 900 !important;
  cursor: pointer !important;
}

.add2e-shop-tabs button.active {
  border-color: var(--a2e-dialog-dark) !important;
  background: linear-gradient(180deg, var(--a2e-dialog-light), var(--a2e-dialog-dark)) !important;
  color: #fff !important;
}

.add2e-shop-action.icon-only {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 30px !important;
  padding: 4px 7px !important;
}

.add2e-shop-action:disabled,
.add2e-shop-action[aria-disabled="true"] {
  opacity: .35 !important;
  cursor: not-allowed !important;
}

.add2e-shop-search {
  width: 100% !important;
  min-height: 34px !important;
  padding: 5px 8px !important;
}

.add2e-shop-scroll {
  max-height: 430px !important;
  overflow: auto !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 8px !important;
  background: var(--a2e-dialog-paper-light) !important;
}

.add2e-shop-table {
  width: 100% !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
  background: var(--a2e-dialog-paper-light) !important;
}

.add2e-shop-table th {
  position: sticky !important;
  top: 0 !important;
  z-index: 1 !important;
  padding: 6px 7px !important;
  background: var(--a2e-dialog-dark) !important;
  color: #fff !important;
  font-size: .75rem !important;
  text-transform: uppercase !important;
}

.add2e-shop-table td {
  padding: 5px 7px !important;
  border-bottom: 1px solid rgba(90,58,18,.18) !important;
  vertical-align: middle !important;
}

.add2e-shop-table tbody tr:nth-child(even) {
  background: rgba(234,217,157,.25) !important;
}

.add2e-shop-table tbody tr:hover {
  background: rgba(201,167,86,.22) !important;
}

.add2e-shop-col-article { width: 25% !important; font-weight: 900 !important; }
.add2e-shop-col-type { width: 12% !important; }
.add2e-shop-col-detail { width: 27% !important; }
.add2e-shop-col-price { width: 10% !important; font-weight: 900 !important; }
.add2e-shop-col-stock { width: 7% !important; text-align: center !important; }
.add2e-shop-col-qty { width: 7% !important; text-align: center !important; }
.add2e-shop-col-action { width: 6% !important; text-align: center !important; }
.add2e-shop-col-gm { width: 16% !important; text-align: right !important; }

.add2e-shop-type-pill,
.add2e-shop-status-pill {
  display: inline-flex !important;
  max-width: 100% !important;
  padding: 1px 7px !important;
  border: 1px solid rgba(90,58,18,.24) !important;
  border-radius: 999px !important;
  background: var(--a2e-dialog-paper-dark) !important;
  color: var(--a2e-dialog-dark) !important;
  font-size: .82rem !important;
  font-weight: 900 !important;
}

.add2e-shop-status-pill.unusable {
  border-color: #9f2f27 !important;
  background: #f5d2c9 !important;
  color: #6f1712 !important;
}

.add2e-shop-table input[type="number"] {
  width: 50px !important;
  min-height: 26px !important;
  text-align: center !important;
}

.add2e-shop-gm-actions {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 5px !important;
}

.add2e-shop-section {
  display: block !important;
  margin: 0 0 7px !important;
  border: 1px solid var(--a2e-dialog-border) !important;
  border-radius: 8px !important;
  overflow: hidden !important;
  background: var(--a2e-dialog-paper-light) !important;
}

.add2e-shop-section > summary {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
  padding: 7px 10px !important;
  background: var(--a2e-dialog-dark) !important;
  color: #fff !important;
  font-weight: 900 !important;
  cursor: pointer !important;
}

.add2e-shop-empty {
  margin: 0 !important;
  padding: 12px !important;
  text-align: center !important;
  opacity: .75 !important;
}

/* Fenêtre de moral : contenu métier commun. */
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
  grid-template-columns: 18px minmax(0,1fr) auto !important;
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

  .add2e-shop-col-detail,
  .add2e-shop-col-type {
    display: none !important;
  }
}
`;
  document.head.appendChild(style);
}

function shellDescriptor(root) {
  const shell = root?.querySelector?.(".add2e-dialog-shell[data-add2e-dialog-ui]") ?? null;
  if (!shell) return null;

  return {
    shell,
    theme: shell.dataset.add2eDialogTheme || "parchment",
    windowClass: shell.dataset.add2eWindowClass || "",
    primaryAction: shell.dataset.add2ePrimaryAction || ""
  };
}

function applyTheme(root, descriptor) {
  if (!root || !descriptor) return false;
  const palette = theme(descriptor.theme);

  root.classList.add("add2e-dialog-window");
  for (const className of String(descriptor.windowClass).split(/\s+/).filter(Boolean)) {
    root.classList.add(className);
  }

  root.dataset.add2eDialogUi = ADD2E_DIALOG_UI_VERSION;
  root.style.setProperty("--a2e-dialog-dark", palette.dark);
  root.style.setProperty("--a2e-dialog-main", palette.main);
  root.style.setProperty("--a2e-dialog-light", palette.light);
  root.style.setProperty("--a2e-dialog-border", palette.border);
  root.style.setProperty("--a2e-dialog-paper", palette.paper);
  root.style.setProperty("--a2e-dialog-paper-light", palette.paperLight);
  root.style.setProperty("--a2e-dialog-paper-dark", palette.paperDark);
  root.style.setProperty("--a2e-dialog-text", palette.text);

  const buttons = root.querySelectorAll?.("footer button, .form-footer button, .window-footer button, .dialog-buttons button") ?? [];
  for (const button of buttons) {
    const action = String(button.dataset?.action ?? button.value ?? "");
    const primary = action === descriptor.primaryAction
      || button.classList.contains("default")
      || button.dataset?.default === "true";
    button.classList.toggle("add2e-dialog-primary", primary);
  }
  return true;
}

function decorate(app, html) {
  ensureStyles();
  const root = applicationRoot(app, html);
  if (!root) return false;

  const apply = () => {
    const descriptor = shellDescriptor(root);
    if (descriptor) applyTheme(root, descriptor);
  };

  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 50);
  return true;
}

function buildShell({ content = "", selectedTheme = "parchment", windowClass = "", primaryAction = "" } = {}) {
  return `<div class="add2e-dialog-shell" data-add2e-dialog-ui="${esc(ADD2E_DIALOG_UI_VERSION)}" data-add2e-dialog-theme="${esc(selectedTheme)}" data-add2e-window-class="${esc(windowClass)}" data-add2e-primary-action="${esc(primaryAction)}">${content}</div>`;
}

function prepareOptions(options = {}) {
  const selectedTheme = String(options.add2eTheme ?? "parchment");
  const primaryAction = String(
    options.add2ePrimaryAction
    ?? options.buttons?.find?.(button => button?.default === true)?.action
    ?? ""
  );
  const classes = [
    ...(Array.isArray(options?.window?.classes) ? options.window.classes : []),
    ...(Array.isArray(options.add2eClasses) ? options.add2eClasses : []),
    "add2e-dialog-window"
  ].filter(Boolean);
  const uniqueClasses = [...new Set(classes)];
  const windowClass = uniqueClasses.join(" ");
  const content = String(options.content ?? "");

  const prepared = {
    ...options,
    window: {
      ...(options.window ?? {}),
      classes: uniqueClasses
    },
    content: content.includes("data-add2e-dialog-ui=")
      ? content
      : buildShell({ content, selectedTheme, windowClass, primaryAction })
  };

  delete prepared.add2eTheme;
  delete prepared.add2ePrimaryAction;
  delete prepared.add2eClasses;
  return prepared;
}

function dialogClass() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) throw new Error("DialogV2 est indisponible.");
  return DialogV2;
}

async function callDialog(method, options = {}, ...rest) {
  ensureStyles();
  const DialogV2 = dialogClass();
  if (typeof DialogV2[method] !== "function") {
    throw new Error(`DialogV2.${method} est indisponible.`);
  }
  return DialogV2[method].call(DialogV2, prepareOptions(options), ...rest);
}

const ADD2E_DIALOG_UI = Object.freeze({
  version: ADD2E_DIALOG_UI_VERSION,
  themes: ADD2E_DIALOG_THEMES,
  wait: (options, ...rest) => callDialog("wait", options, ...rest),
  confirm: (options, ...rest) => callDialog("confirm", options, ...rest),
  prompt: (options, ...rest) => callDialog("prompt", options, ...rest),
  alert: (options, ...rest) => callDialog("prompt", options, ...rest),
  prepareOptions,
  decorate,
  ensureStyles
});

globalThis.ADD2E_DIALOG_UI = ADD2E_DIALOG_UI;
globalThis.add2eDialogWait = ADD2E_DIALOG_UI.wait;
globalThis.add2eDialogConfirm = ADD2E_DIALOG_UI.confirm;
globalThis.add2eDialogPrompt = ADD2E_DIALOG_UI.prompt;
globalThis.add2eDialogAlert = ADD2E_DIALOG_UI.alert;

Hooks.on("renderDialogV2", decorate);
Hooks.on("renderApplicationV2", decorate);
Hooks.once("ready", ensureStyles);

ensureStyles();
console.log("[ADD2E][DIALOG_UI][VERSION]", ADD2E_DIALOG_UI_VERSION);
