// ADD2E — UI des livres de sorts et parchemins.
// Uniformise les DialogV2 au standard ADD2E et rafraîchit immédiatement
// la feuille d'acteur après toute modification d'un sort embarqué.

const ADD2E_ARCANE_DOCUMENT_UI_VERSION = "2026-07-14-arcane-dialog-refresh-v1";
globalThis.ADD2E_ARCANE_DOCUMENT_UI_VERSION = ADD2E_ARCANE_DOCUMENT_UI_VERSION;

const ADD2E_ARCANE_REFRESH_DELAY = 40;
const add2eArcaneRefreshTimers = new Map();

function add2eArcaneText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function add2eArcaneRoot(app, html = null) {
  const candidates = [
    html?.[0],
    html,
    app?.element?.[0],
    app?.element
  ];
  return candidates.find(candidate => candidate instanceof HTMLElement) ?? null;
}

function add2eIsArcaneDocumentDialog(app, root) {
  if (!root) return false;
  if (root.classList.contains("add2e-arcane-document-dialog")) return true;

  const title = add2eArcaneText(app?.title ?? app?.window?.title ?? root.querySelector(".window-title")?.textContent);
  const content = add2eArcaneText(root.querySelector(".window-content, .dialog-content")?.textContent ?? root.textContent);
  const text = `${title} ${content}`;

  return /\b(livre de sorts?|grimoire|parchemin|inscription du sort|copier le sort|recopier le sort|retirer l inscription)\b/.test(text);
}

function add2eInstallArcaneDialogStyles() {
  const id = "add2e-arcane-document-dialog-style";
  const previous = document.getElementById(id);
  if (previous?.dataset?.version === ADD2E_ARCANE_DOCUMENT_UI_VERSION) return;
  previous?.remove();

  const style = document.createElement("style");
  style.id = id;
  style.dataset.version = ADD2E_ARCANE_DOCUMENT_UI_VERSION;
  style.textContent = `
.application.add2e-arcane-document-dialog,
.window-app.add2e-arcane-document-dialog,
.dialog.add2e-arcane-document-dialog {
  --add2e-arcane-bg: #f8f3ff;
  --add2e-arcane-accent: #e8ddfb;
  --add2e-arcane-dark: #2e1c5a;
  --add2e-arcane-main: #6b49b8;
  --add2e-arcane-border: #8060cc;
  --add2e-arcane-text: #211735;
  border: 2px solid var(--add2e-arcane-border) !important;
  border-radius: 14px !important;
  overflow: hidden !important;
  background: linear-gradient(180deg, var(--add2e-arcane-bg), var(--add2e-arcane-accent)) !important;
  box-shadow: 0 10px 26px rgba(0, 0, 0, .22) !important;
}

.application.add2e-arcane-document-dialog .window-header,
.window-app.add2e-arcane-document-dialog .window-header,
.dialog.add2e-arcane-document-dialog .window-header {
  background: linear-gradient(90deg, var(--add2e-arcane-dark), var(--add2e-arcane-main)) !important;
  color: #fff !important;
  border: 0 !important;
  border-bottom: 2px solid var(--add2e-arcane-border) !important;
}

.application.add2e-arcane-document-dialog .window-content,
.window-app.add2e-arcane-document-dialog .window-content,
.dialog.add2e-arcane-document-dialog .window-content {
  background: linear-gradient(180deg, var(--add2e-arcane-bg), var(--add2e-arcane-accent)) !important;
  color: var(--add2e-arcane-text) !important;
  border: 0 !important;
  padding: 12px !important;
}

.application.add2e-arcane-document-dialog .dialog-content,
.window-app.add2e-arcane-document-dialog .dialog-content,
.dialog.add2e-arcane-document-dialog .dialog-content,
.application.add2e-arcane-document-dialog .add2e-dialog,
.window-app.add2e-arcane-document-dialog .add2e-dialog,
.dialog.add2e-arcane-document-dialog .add2e-dialog {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  color: var(--add2e-arcane-text) !important;
}

.application.add2e-arcane-document-dialog .dialog-buttons,
.window-app.add2e-arcane-document-dialog .dialog-buttons,
.dialog.add2e-arcane-document-dialog .dialog-buttons {
  background: transparent !important;
  border: 0 !important;
  gap: 8px !important;
  padding-top: 10px !important;
}

.application.add2e-arcane-document-dialog .dialog-buttons button,
.window-app.add2e-arcane-document-dialog .dialog-buttons button,
.dialog.add2e-arcane-document-dialog .dialog-buttons button {
  border: 1px solid var(--add2e-arcane-border) !important;
  border-radius: 9px !important;
  background: #fff !important;
  color: var(--add2e-arcane-dark) !important;
  font-weight: 800 !important;
  box-shadow: none !important;
}

.application.add2e-arcane-document-dialog .dialog-buttons button.default,
.application.add2e-arcane-document-dialog .dialog-buttons button[data-action="yes"],
.application.add2e-arcane-document-dialog .dialog-buttons button[data-action="confirm"],
.window-app.add2e-arcane-document-dialog .dialog-buttons button.default,
.window-app.add2e-arcane-document-dialog .dialog-buttons button[data-action="yes"],
.window-app.add2e-arcane-document-dialog .dialog-buttons button[data-action="confirm"],
.dialog.add2e-arcane-document-dialog .dialog-buttons button.default,
.dialog.add2e-arcane-document-dialog .dialog-buttons button[data-action="yes"],
.dialog.add2e-arcane-document-dialog .dialog-buttons button[data-action="confirm"] {
  background: linear-gradient(180deg, var(--add2e-arcane-main), var(--add2e-arcane-dark)) !important;
  color: #fff !important;
}
`;
  document.head.append(style);
}

function add2eThemeArcaneDialog(app, html = null) {
  const root = add2eArcaneRoot(app, html);
  if (!add2eIsArcaneDocumentDialog(app, root)) return;
  root.classList.add("add2e", "add2e-arcane-document-dialog");
  root.querySelector(".window-content")?.classList.add("add2e-arcane-document-content");
}

function add2eActorFromSpellItem(item) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return null;
  const type = String(item?.type ?? "").toLowerCase();
  return type === "sort" || type === "spell" ? actor : null;
}

function add2eRenderActorApplications(actor) {
  const applications = new Set();

  for (const app of Object.values(actor?.apps ?? {})) {
    if (app) applications.add(app);
  }

  for (const app of Object.values(ui?.windows ?? {})) {
    const appActor = app?.actor ?? app?.document ?? app?.object;
    if (appActor?.id === actor.id) applications.add(app);
  }

  for (const app of applications) {
    try {
      app._add2eRememberActiveTab?.(
        app.element,
        app._add2eActiveTab || app._add2eReadStoredTab?.() || "sorts"
      );
      app.render?.({ force: true });
    } catch (_error) {
      try { app.render?.(true); }
      catch (error) {
        console.warn("[ADD2E][ARCANE_DOCUMENT][ACTOR_REFRESH_ERROR]", {
          actor: actor.name,
          application: app?.constructor?.name,
          error
        });
      }
    }
  }
}

function add2eQueueArcaneActorRefresh(item) {
  const actor = add2eActorFromSpellItem(item);
  if (!actor) return;

  const key = String(actor.uuid ?? actor.id ?? "");
  if (!key) return;

  const previous = add2eArcaneRefreshTimers.get(key);
  if (previous) clearTimeout(previous);

  add2eArcaneRefreshTimers.set(key, window.setTimeout(() => {
    add2eArcaneRefreshTimers.delete(key);
    add2eRenderActorApplications(actor);
  }, ADD2E_ARCANE_REFRESH_DELAY));
}

Hooks.once("ready", add2eInstallArcaneDialogStyles);
Hooks.on("renderDialogV2", add2eThemeArcaneDialog);
Hooks.on("renderApplicationV2", add2eThemeArcaneDialog);
Hooks.on("createItem", item => add2eQueueArcaneActorRefresh(item));
Hooks.on("updateItem", item => add2eQueueArcaneActorRefresh(item));
Hooks.on("deleteItem", item => add2eQueueArcaneActorRefresh(item));
