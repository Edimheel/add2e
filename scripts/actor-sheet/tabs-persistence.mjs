// scripts/actor-sheet/tabs-persistence.mjs
// ADD2E — Persistance de l'onglet actif de la feuille acteur.

const ADD2E_ACTOR_TAB_KEY = "add2e.actorSheet.activeTab.";
globalThis.ADD2E_ACTOR_TABS_LAST ??= {};

function add2eSheetActorId(sheet) {
  if (!sheet) return "unknown";

  const fromSheet =
    sheet.dataset?.actorId ||
    sheet.getAttribute?.("data-actor-id") ||
    sheet.closest?.("[data-actor-id]")?.dataset?.actorId ||
    sheet.closest?.("[data-document-id]")?.dataset?.documentId ||
    "";

  if (fromSheet) return String(fromSheet);

  const app = sheet.closest?.(".application, .app, .window-app");
  const appId = app?.dataset?.appid || app?.id || "";

  return appId ? `app:${appId}` : "unknown";
}

function add2eSheetStorageKeys(sheet) {
  const actorId = add2eSheetActorId(sheet);
  return [
    `${ADD2E_ACTOR_TAB_KEY}${actorId}`,
    `${ADD2E_ACTOR_TAB_KEY}last`
  ];
}

function add2eSheetCurrentTab(sheet) {
  if (!sheet) return "resume";

  return (
    sheet.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
    sheet.querySelector(".sheet-body .a2e-tab-content.active[data-tab]")?.dataset?.tab ||
    sheet.querySelector(".a2e-active-tab-input")?.value ||
    sheet.dataset?.activeTab ||
    "resume"
  );
}

function add2eSheetRememberTab(sheet, tabName = null) {
  if (!sheet) return;

  const tab = tabName || add2eSheetCurrentTab(sheet) || "resume";

  sheet.dataset.activeTab = tab;

  const hidden = sheet.querySelector(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;

  for (const key of add2eSheetStorageKeys(sheet)) {
    try {
      sessionStorage.setItem(key, tab);
      localStorage.setItem(key, tab);
    } catch (e) {}
  }

  globalThis.ADD2E_ACTOR_TABS_LAST[add2eSheetActorId(sheet)] = tab;
  globalThis.ADD2E_ACTOR_TABS_LAST.last = tab;
}

function add2eSheetStoredTab(sheet) {
  if (!sheet) return "resume";

  const actorId = add2eSheetActorId(sheet);
  const keys = add2eSheetStorageKeys(sheet);

  return (
    globalThis.ADD2E_ACTOR_TABS_LAST[actorId] ||
    globalThis.ADD2E_ACTOR_TABS_LAST.last ||
    keys.map(k => {
      try { return sessionStorage.getItem(k); } catch (e) { return null; }
    }).find(Boolean) ||
    keys.map(k => {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    }).find(Boolean) ||
    sheet.querySelector(".a2e-active-tab-input")?.value ||
    "resume"
  );
}

function add2eSheetActivateTab(sheet, tabName = "resume") {
  if (!sheet) return;

  const tab = tabName || "resume";

  sheet.dataset.activeTab = tab;

  const hidden = sheet.querySelector(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;

  sheet.querySelectorAll(".a2e-tabs .item[data-tab]").forEach(link => {
    link.classList.toggle("active", link.dataset.tab === tab);
  });

  sheet.querySelectorAll(".sheet-body .a2e-tab-content[data-tab]").forEach(section => {
    section.classList.toggle("active", section.dataset.tab === tab);
  });
}

function add2eSheetRestoreTab(sheet) {
  if (!sheet) return;

  const tab = add2eSheetStoredTab(sheet) || "resume";

  add2eSheetActivateTab(sheet, tab);
  add2eSheetRememberTab(sheet, tab);
}

function add2eRestoreAllActorSheetTabs() {
  for (const sheet of document.querySelectorAll(".add2e-character-v3")) {
    add2eSheetRestoreTab(sheet);
  }
}

export function add2eInstallActorSheetTabPersistence() {
  if (globalThis.ADD2E_ACTOR_SHEET_TABS_V15_INSTALLED) return;
  globalThis.ADD2E_ACTOR_SHEET_TABS_V15_INSTALLED = true;

  document.addEventListener("pointerdown", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (!sheet) return;

    const tabLink = event.target.closest?.(".a2e-tabs .item[data-tab]");
    if (tabLink) {
      add2eSheetActivateTab(sheet, tabLink.dataset.tab || "resume");
      add2eSheetRememberTab(sheet, tabLink.dataset.tab || "resume");
      return;
    }

    add2eSheetRememberTab(sheet);
  }, true);

  document.addEventListener("click", event => {
    const link = event.target.closest?.(".add2e-character-v3 .a2e-tabs .item[data-tab]");
    if (!link) return;

    event.preventDefault();

    const sheet = link.closest(".add2e-character-v3");
    const tab = link.dataset.tab || "resume";

    add2eSheetActivateTab(sheet, tab);
    add2eSheetRememberTab(sheet, tab);

    const actorId = add2eSheetActorId(sheet);
    const actor = game.actors?.get(actorId);
    if (actor?.isOwner) {
      actor.setFlag("add2e", "activeSheetTab", tab).catch(() => {});
    }
  }, true);

  document.addEventListener("change", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (sheet) add2eSheetRememberTab(sheet);
  }, true);

  document.addEventListener("submit", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (sheet) add2eSheetRememberTab(sheet);
  }, true);

  const delayedRestore = () => {
    requestAnimationFrame(() => {
      add2eRestoreAllActorSheetTabs();
      setTimeout(add2eRestoreAllActorSheetTabs, 30);
      setTimeout(add2eRestoreAllActorSheetTabs, 120);
    });
  };

  Hooks.on("renderAdd2eActorSheet", delayedRestore);
  Hooks.on("renderActorSheet", delayedRestore);
  Hooks.on("renderApplication", delayedRestore);
  Hooks.on("updateActor", delayedRestore);
  Hooks.on("updateItem", delayedRestore);
  Hooks.on("createItem", delayedRestore);
  Hooks.on("deleteItem", delayedRestore);

  const observer = new MutationObserver(() => delayedRestore());
  observer.observe(document.body, { childList: true, subtree: true });

  delayedRestore();

  console.log("[ADD2E][TABS] Persistance robuste V15 installée.");
}
