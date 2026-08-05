// ADD2E — Diagnostic temporaire des onglets de la feuille de monstre
// Compatible Foundry V13/V14/V15 — ApplicationV2 uniquement.
// Ce module ne modifie aucun état métier : il observe et journalise le cycle de rendu.

const ADD2E_MONSTER_TAB_DIAGNOSTICS_VERSION = "2026-08-05-monster-tab-diagnostics-v1";
const ADD2E_MONSTER_TAB_PREFIX = "[ADD2E][MONSTER_TABS]";
const ADD2E_MONSTER_TAB_TRACE_DELAYS = [0, 25, 100, 250, 500];

globalThis.ADD2E_MONSTER_TAB_DIAGNOSTICS_VERSION = ADD2E_MONSTER_TAB_DIAGNOSTICS_VERSION;

function add2eDiagElement(value) {
  if (!value) return null;
  if (value instanceof HTMLElement) return value;
  if (value.jquery && value[0] instanceof HTMLElement) return value[0];
  if (value[0] instanceof HTMLElement) return value[0];
  return null;
}

function add2eDiagSheetRoot(app, source = null) {
  const explicit = add2eDiagElement(source);
  const element = explicit ?? add2eDiagElement(app?.element);
  if (!element) return null;
  if (element.matches?.(".add2e-monster-readable-sheet")) return element;
  return element.querySelector?.(".add2e-monster-readable-sheet") ?? null;
}

function add2eDiagStorageKey(app) {
  return `add2e.monster.${app?.actor?.id || app?.document?.id || "unknown"}.activeTab`;
}

function add2eDiagStoredTab(app) {
  try {
    return sessionStorage.getItem(add2eDiagStorageKey(app));
  } catch (_error) {
    return null;
  }
}

function add2eDiagActiveTabs(root) {
  if (!root) return { nav: [], panels: [], allNav: [], allPanels: [] };
  const nav = root.querySelector(":scope > .sheet-tabs");
  const body = root.querySelector(":scope > .sheet-body");
  const links = Array.from(nav?.querySelectorAll?.(":scope > .item[data-tab]") ?? []);
  const panels = Array.from(body?.querySelectorAll?.(":scope > .tab[data-tab]") ?? []);
  return {
    nav: links.filter(element => element.classList.contains("active")).map(element => element.dataset.tab),
    panels: panels.filter(element => element.classList.contains("active")).map(element => element.dataset.tab),
    allNav: links.map(element => ({ tab: element.dataset.tab, active: element.classList.contains("active") })),
    allPanels: panels.map(element => ({ tab: element.dataset.tab, active: element.classList.contains("active") }))
  };
}

function add2eDiagSnapshot(app, source = null) {
  const root = add2eDiagSheetRoot(app, source);
  const tabs = add2eDiagActiveTabs(root);
  return {
    diagnosticVersion: ADD2E_MONSTER_TAB_DIAGNOSTICS_VERSION,
    sheetVersion: globalThis.ADD2E_MONSTER_SHEET_VERSION ?? null,
    capabilitiesVersion: globalThis.ADD2E_MONSTER_CAPABILITIES_VERSION ?? null,
    actor: app?.actor?.name ?? app?.document?.name ?? null,
    actorId: app?.actor?.id ?? app?.document?.id ?? null,
    appId: app?.id ?? null,
    appState: app?.state ?? null,
    renderSequence: app?.__add2eMonsterTabRenderSequence ?? 0,
    rootConnected: root?.isConnected === true,
    memoryTab: app?._add2eActiveTab ?? null,
    pendingTab: app?._add2ePendingView?.activeTab ?? null,
    storedTab: add2eDiagStoredTab(app),
    tabGroups: app?.tabGroups && typeof app.tabGroups === "object" ? { ...app.tabGroups } : null,
    activeNavigationTabs: tabs.nav,
    activeContentTabs: tabs.panels,
    navigationTabs: tabs.allNav,
    contentTabs: tabs.allPanels,
    timestamp: Math.round(performance.now() * 100) / 100
  };
}

function add2eMonsterTabDiagnostic(app, stage, extra = {}, source = null) {
  const payload = {
    ...add2eDiagSnapshot(app, source),
    stage,
    ...extra
  };
  console.log(ADD2E_MONSTER_TAB_PREFIX, stage, payload);
  return payload;
}

globalThis.add2eMonsterTabDiagnostic = add2eMonsterTabDiagnostic;
globalThis.add2eDumpMonsterTabState = actorOrApp => {
  const app = actorOrApp?.actor || actorOrApp?.document
    ? actorOrApp
    : actorOrApp?.sheet
      ?? (typeof actorOrApp === "string" ? game.actors?.get(actorOrApp)?.sheet : null);
  if (!app) {
    console.warn(ADD2E_MONSTER_TAB_PREFIX, "MANUAL_DUMP_NO_APP", { actorOrApp });
    return null;
  }
  return add2eMonsterTabDiagnostic(app, "MANUAL_DUMP");
};

function add2eDiagCaller() {
  return String(new Error().stack ?? "")
    .split("\n")
    .slice(2, 8)
    .join("\n");
}

function add2eDiagTraceStages(app, source, sequence, origin) {
  queueMicrotask(() => add2eMonsterTabDiagnostic(app, `${origin}_MICROTASK`, { sequence }, source));
  requestAnimationFrame(() => add2eMonsterTabDiagnostic(app, `${origin}_RAF`, { sequence }, source));
  for (const delay of ADD2E_MONSTER_TAB_TRACE_DELAYS) {
    setTimeout(() => add2eMonsterTabDiagnostic(app, `${origin}_TIMER_${delay}`, { sequence }, source), delay);
  }
}

function add2eDiagObserveClassChanges(app, source, sequence) {
  const root = add2eDiagSheetRoot(app, source);
  if (!root || typeof MutationObserver !== "function") return;

  app.__add2eMonsterTabObserver?.disconnect?.();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      const target = record.target;
      if (!(target instanceof HTMLElement)) continue;
      if (!target.matches?.(".sheet-tabs .item[data-tab], .sheet-body .tab[data-tab]")) continue;
      add2eMonsterTabDiagnostic(app, "CLASS_MUTATION", {
        sequence,
        targetTab: target.dataset.tab ?? null,
        targetKind: target.matches(".sheet-tabs .item[data-tab]") ? "navigation" : "content",
        oldClass: record.oldValue ?? "",
        newClass: target.className
      }, root);
    }
  });

  observer.observe(root, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
    attributeOldValue: true
  });
  app.__add2eMonsterTabObserver = observer;

  setTimeout(() => {
    if (app.__add2eMonsterTabObserver !== observer) return;
    observer.disconnect();
    app.__add2eMonsterTabObserver = null;
    add2eMonsterTabDiagnostic(app, "MUTATION_OBSERVER_STOP", { sequence }, root);
  }, 1000);
}

function add2eDiagPatchMethod(prototype, name, wrap) {
  const original = prototype?.[name];
  if (typeof original !== "function" || original.__add2eMonsterTabDiagnosticPatched === true) return false;
  const patched = wrap(original);
  patched.__add2eMonsterTabDiagnosticPatched = true;
  patched.__add2eMonsterTabDiagnosticOriginal = original;
  prototype[name] = patched;
  return true;
}

function add2eInstallMonsterTabDiagnostics() {
  const SheetClass = globalThis.Add2eMonsterSheet;
  const prototype = SheetClass?.prototype;
  if (!prototype) return false;
  if (prototype.__add2eMonsterTabDiagnosticsInstalled === true) return true;
  prototype.__add2eMonsterTabDiagnosticsInstalled = true;

  add2eDiagPatchMethod(prototype, "render", original => function add2eDiagnosticRender(...args) {
    const sequence = (this.__add2eMonsterTabRenderSequence ?? 0) + 1;
    this.__add2eMonsterTabRenderSequence = sequence;
    add2eMonsterTabDiagnostic(this, "RENDER_ENTER", {
      sequence,
      arguments: args.map(value => typeof value === "object" ? { ...value } : value),
      caller: add2eDiagCaller()
    });

    let result;
    try {
      result = original.apply(this, args);
    } catch (error) {
      add2eMonsterTabDiagnostic(this, "RENDER_THROW", { sequence, error });
      throw error;
    }

    Promise.resolve(result).then(
      () => add2eMonsterTabDiagnostic(this, "RENDER_RESOLVED", { sequence }),
      error => add2eMonsterTabDiagnostic(this, "RENDER_REJECTED", { sequence, error })
    );
    return result;
  });

  add2eDiagPatchMethod(prototype, "_replaceHTML", original => function add2eDiagnosticReplaceHTML(result, content, options) {
    const sequence = this.__add2eMonsterTabRenderSequence ?? 0;
    add2eMonsterTabDiagnostic(this, "REPLACE_BEFORE", { sequence, options }, content);
    const returned = original.call(this, result, content, options);
    add2eMonsterTabDiagnostic(this, "REPLACE_AFTER", { sequence }, content);
    add2eDiagObserveClassChanges(this, content, sequence);
    add2eDiagTraceStages(this, content, sequence, "REPLACE_AFTER");
    return returned;
  });

  add2eDiagPatchMethod(prototype, "_captureViewBeforeRender", original => function add2eDiagnosticCaptureView(root) {
    add2eMonsterTabDiagnostic(this, "CAPTURE_VIEW_BEFORE", {}, root);
    const view = original.call(this, root);
    add2eMonsterTabDiagnostic(this, "CAPTURE_VIEW_AFTER", { capturedView: view }, root);
    return view;
  });

  add2eDiagPatchMethod(prototype, "_restoreViewAfterRender", original => function add2eDiagnosticRestoreView(content) {
    const sequence = this.__add2eMonsterTabRenderSequence ?? 0;
    add2eMonsterTabDiagnostic(this, "RESTORE_CALL_BEFORE", {
      sequence,
      pendingViewBeforeCall: this._add2ePendingView ? { ...this._add2ePendingView } : null
    }, content);
    const returned = original.call(this, content);
    add2eMonsterTabDiagnostic(this, "RESTORE_CALL_AFTER", {
      sequence,
      pendingViewAfterCall: this._add2ePendingView ? { ...this._add2ePendingView } : null
    }, content);
    add2eDiagTraceStages(this, content, sequence, "RESTORE_CALL_AFTER");
    return returned;
  });

  add2eDiagPatchMethod(prototype, "_add2eRememberActiveTab", original => function add2eDiagnosticRememberTab(tabName) {
    add2eMonsterTabDiagnostic(this, "REMEMBER_TAB_BEFORE", { requestedTab: tabName });
    const returned = original.call(this, tabName);
    add2eMonsterTabDiagnostic(this, "REMEMBER_TAB_AFTER", { requestedTab: tabName, returnedTab: returned });
    return returned;
  });

  add2eDiagPatchMethod(prototype, "_updateObject", original => async function add2eDiagnosticUpdateObject(event, formData) {
    const flat = foundry.utils.flattenObject(formData ?? {});
    add2eMonsterTabDiagnostic(this, "UPDATE_OBJECT_BEGIN", {
      eventType: event?.type ?? null,
      fieldName: event?.target?.name ?? null,
      updateKeys: Object.keys(flat),
      caller: add2eDiagCaller()
    });
    try {
      const returned = await original.call(this, event, formData);
      add2eMonsterTabDiagnostic(this, "UPDATE_OBJECT_END", {
        eventType: event?.type ?? null,
        fieldName: event?.target?.name ?? null,
        updateKeys: Object.keys(flat)
      });
      return returned;
    } catch (error) {
      add2eMonsterTabDiagnostic(this, "UPDATE_OBJECT_ERROR", { error, updateKeys: Object.keys(flat) });
      throw error;
    }
  });

  console.info(ADD2E_MONSTER_TAB_PREFIX, "DIAGNOSTICS_INSTALLED", {
    version: ADD2E_MONSTER_TAB_DIAGNOSTICS_VERSION,
    sheetClass: SheetClass.name
  });
  return true;
}

Hooks.on("renderAdd2eMonsterSheet", (app, html) => {
  const root = add2eDiagSheetRoot(app, html);
  const sequence = app?.__add2eMonsterTabRenderSequence ?? 0;

  if (root && root.dataset.add2eMonsterTabDiagnosticBound !== "1") {
    root.dataset.add2eMonsterTabDiagnosticBound = "1";
    root.addEventListener("click", event => {
      const tab = event.target?.closest?.(":scope > .sheet-tabs .item[data-tab]")
        ?? event.target?.closest?.(".sheet-tabs .item[data-tab]");
      if (!tab || !root.contains(tab)) return;
      add2eMonsterTabDiagnostic(app, "DOM_TAB_CLICK_CAPTURE", {
        clickedTab: tab.dataset.tab ?? null,
        eventPhase: event.eventPhase
      }, root);
      queueMicrotask(() => add2eMonsterTabDiagnostic(app, "DOM_TAB_CLICK_AFTER", {
        clickedTab: tab.dataset.tab ?? null
      }, root));
    }, true);

    root.addEventListener("change", event => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      add2eMonsterTabDiagnostic(app, "DOM_CHANGE_CAPTURE", {
        fieldName: field.name || null,
        fieldType: field.type || field.tagName.toLowerCase()
      }, root);
    }, true);
  }

  add2eMonsterTabDiagnostic(app, "FINAL_RENDER_HOOK", { sequence }, root);
  add2eDiagTraceStages(app, root, sequence, "FINAL_RENDER_HOOK");
});

Hooks.on("preUpdateActor", (actor, change, options, userId) => {
  if (actor?.type !== "monster") return;
  const app = actor.sheet;
  add2eMonsterTabDiagnostic(app, "PRE_UPDATE_ACTOR", {
    userId,
    updateKeys: Object.keys(foundry.utils.flattenObject(change ?? {})),
    optionKeys: Object.keys(options ?? {}),
    caller: add2eDiagCaller()
  });
});

Hooks.on("updateActor", (actor, change, options, userId) => {
  if (actor?.type !== "monster") return;
  const app = actor.sheet;
  add2eMonsterTabDiagnostic(app, "UPDATE_ACTOR", {
    userId,
    updateKeys: Object.keys(foundry.utils.flattenObject(change ?? {})),
    optionKeys: Object.keys(options ?? {})
  });
});

if (!add2eInstallMonsterTabDiagnostics()) {
  Hooks.once("ready", () => {
    if (!add2eInstallMonsterTabDiagnostics()) {
      console.error(ADD2E_MONSTER_TAB_PREFIX, "DIAGNOSTICS_INSTALL_FAILED", {
        version: ADD2E_MONSTER_TAB_DIAGNOSTICS_VERSION,
        sheetClassAvailable: Boolean(globalThis.Add2eMonsterSheet)
      });
    }
  });
}

console.info(ADD2E_MONSTER_TAB_PREFIX, "DIAGNOSTICS_MODULE_LOADED", ADD2E_MONSTER_TAB_DIAGNOSTICS_VERSION);
