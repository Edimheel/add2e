// ============================================================
// ADD2E — Contrôles de mémorisation des sorts
// Version : 2026-08-10-canonical-preparation-consumer-v3
// Source exclusive des quotas et compteurs : 07-spellcasting-rules.mjs.
// Source exclusive des composants : 22e-consumables-core.mjs.
// Compatible Foundry V13/V14/V15 et ApplicationV2.
// ============================================================

const ADD2E_SPELL_PREP_SCROLL_VERSION = "2026-08-10-canonical-preparation-consumer-v3";
globalThis.ADD2E_SPELL_PREP_SCROLL_VERSION = ADD2E_SPELL_PREP_SCROLL_VERSION;

function add2eSpellPrepDebug(stage, payload = {}) {
  if (globalThis.ADD2E_DEBUG_SPELL_PREP !== true) return;
  console.info(`[ADD2E][SPELL_PREP][${stage}]`, payload);
}

function add2eSpellPrepEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eSpellPrepApi() {
  const required = {
    normalizeKey: globalThis.add2eNormalizeSpellKey,
    entries: globalThis.add2eGetSpellcastingEntries,
    canUse: globalThis.add2eCanActorUseSpell,
    slots: globalThis.add2eGetSlotsForEntryLevel,
    current: globalThis.add2eGetMemorizedCountForEntry,
    total: globalThis.add2eCountPreparedForEntryLevel,
    set: globalThis.add2eSetMemorizedCountForEntry,
    isObjectPower: globalThis.add2eIsObjectMagicSpellForPreparation
  };
  for (const [name, fn] of Object.entries(required)) {
    if (typeof fn !== "function") throw new Error(`API canonique de préparation indisponible : ${name}.`);
  }
  return required;
}

async function add2eSpellPrepShowLimitDialog(entry, spellLevel, total, limit) {
  if (typeof globalThis.add2eDialogAlert !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  const label = entry?.label || globalThis.add2eSpellLabel?.(entry?.key) || "Sorts";
  return globalThis.add2eDialogAlert({
    add2eTheme: "wizard",
    add2ePrimaryAction: "ok",
    add2eClasses: ["add2e-spell-preparation-limit-dialog"],
    window: { title: "Mémorisation des sorts" },
    content: `
      <div class="add2e-spell-preparation-limit">
        <p><strong>${add2eSpellPrepEscapeHtml(label)} — niveau ${Number(spellLevel) || 1}</strong></p>
        <p>Le nombre maximal de sorts mémorisables pour ce niveau est atteint.</p>
        <p>Emplacements utilisés : <strong>${Math.max(0, Number(total) || 0)} / ${Math.max(0, Number(limit) || 0)}</strong>.</p>
      </div>
    `
  });
}

function add2eSpellPrepNormalizeKey(value) {
  if (typeof globalThis.add2eNormalizeSpellKey !== "function") {
    throw new Error("Le normaliseur canonique des listes de sorts ADD2E est indisponible.");
  }
  return globalThis.add2eNormalizeSpellKey(value);
}

function add2eSpellPrepStableKeyForItem(item) {
  return String(item?.flags?.add2e?.stableSpellKey ?? "").trim();
}

function add2eSpellPrepCandidateStableKeys(button, row) {
  const values = [
    button?.dataset?.spellStableKey,
    button?.closest?.("[data-spell-stable-key]")?.dataset?.spellStableKey,
    row?.dataset?.spellStableKey,
    button?.getAttribute?.("data-spell-stable-key"),
    row?.getAttribute?.("data-spell-stable-key")
  ];
  return [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))];
}

function add2eSpellPrepDomRoot(app, html) {
  const candidates = [
    html?.[0],
    html,
    app?.element?.[0],
    app?.element,
    app?._element?.[0],
    app?._element
  ];
  return candidates.find(candidate => typeof candidate?.querySelectorAll === "function") ?? null;
}

function add2eSpellPrepRepairDomSpellId(row, found) {
  if (!row || !found) return;
  const stable = add2eSpellPrepStableKeyForItem(found);
  row.dataset.sortId = found.id;
  if (stable) row.dataset.spellStableKey = stable;
  row.querySelectorAll?.("[data-sort-id]").forEach(element => { element.dataset.sortId = found.id; });
  if (stable) row.querySelectorAll?.("[data-spell-stable-key]").forEach(element => { element.dataset.spellStableKey = stable; });
}

function add2eSpellPrepActorWindows(actor) {
  const actorId = String(actor?.id ?? "");
  if (!actorId) return [];
  return Object.values(ui.windows ?? {}).filter(app => {
    const document = app?.actor ?? app?.document ?? app?.object ?? null;
    return document?.documentName === "Actor" && String(document.id) === actorId;
  });
}

function add2eSpellPrepResolveActorFromButton(button) {
  const actorId = button?.dataset?.actorId ?? button?.closest?.("[data-actor-id]")?.dataset?.actorId;
  if (actorId && game.actors?.get(actorId)) return game.actors.get(actorId);

  const appRoot = button?.closest?.(".application, .window-app, .app");
  const appId = appRoot?.dataset?.appid || appRoot?.dataset?.appId || appRoot?.id?.replace(/^app-/, "") || null;
  if (appId) {
    const app = Object.values(ui.windows ?? {}).find(candidate => String(candidate.appId) === String(appId) || String(candidate.id) === String(appId));
    const actor = app?.actor ?? app?.document ?? app?.object ?? null;
    if (actor?.documentName === "Actor") return actor;
  }

  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

function add2eSpellPrepResolveSort(actor, button) {
  const directId = button?.dataset?.sortId || button?.closest?.("[data-sort-id]")?.dataset?.sortId;
  const direct = directId ? actor?.items?.get?.(directId) : null;
  if (direct && String(direct.type ?? "").toLowerCase() === "sort") return direct;

  const row = button?.closest?.("tr.sort-row, tr[data-sort-id]");
  const stableKeys = add2eSpellPrepCandidateStableKeys(button, row);
  if (!stableKeys.length) return null;

  const found = Array.from(actor?.items ?? []).find(item =>
    String(item?.type ?? "").toLowerCase() === "sort"
    && stableKeys.includes(add2eSpellPrepStableKeyForItem(item))
  ) ?? null;
  if (found) add2eSpellPrepRepairDomSpellId(row, found);
  return found;
}

function add2eSpellPrepSnapshot(actor) {
  return add2eSpellPrepActorWindows(actor).map(app => {
    const root = app.element?.[0] ?? app.element ?? null;
    const scrollables = [root?.closest?.(".window-content"), root?.querySelector?.(".a2e-tab-content.active"), root, document.scrollingElement].filter(Boolean);
    const activeTab = root?.querySelector?.(".a2e-tabs .item.active[data-tab]")?.dataset?.tab
      ?? root?.querySelector?.(".a2e-tab-content.active[data-tab]")?.dataset?.tab
      ?? null;
    return {
      appId: app.appId,
      activeTab,
      scroll: scrollables.map((element, index) => ({ index, top: Number(element.scrollTop) || 0, left: Number(element.scrollLeft) || 0 }))
    };
  });
}

function add2eSpellPrepRestoreSnapshot(snapshot) {
  for (const saved of snapshot ?? []) {
    const app = ui.windows?.[saved.appId];
    const root = app?.element?.[0] ?? app?.element ?? null;
    if (!root) continue;
    if (saved.activeTab) {
      root.querySelectorAll?.(".a2e-tabs .item[data-tab]").forEach(element => element.classList.toggle("active", element.dataset.tab === saved.activeTab));
      root.querySelectorAll?.(".a2e-tab-content[data-tab]").forEach(element => element.classList.toggle("active", element.dataset.tab === saved.activeTab));
    }
    const scrollables = [root.closest?.(".window-content"), root.querySelector?.(".a2e-tab-content.active"), root, document.scrollingElement].filter(Boolean);
    for (const position of saved.scroll ?? []) {
      const element = scrollables[position.index];
      if (!element) continue;
      element.scrollTop = position.top;
      element.scrollLeft = position.left;
    }
  }
}

function add2eSpellPrepRestoreRepeated(snapshot) {
  for (const delay of [0, 20, 80, 180, 360, 700]) setTimeout(() => add2eSpellPrepRestoreSnapshot(snapshot), delay);
}

function add2eSpellPrepCounterRoots(actor, clickedButton = null) {
  const roots = add2eSpellPrepActorWindows(actor).map(app => app.element?.[0] ?? app.element ?? null).filter(Boolean);
  const clickedRoot = clickedButton?.closest?.(".application, .window-app, .app");
  if (clickedRoot) roots.push(clickedRoot);
  return [...new Set(roots)];
}

function add2eSpellPrepSetGlobalCounters(actor, entry, spellLevel, total, max, clickedButton = null) {
  const key = add2eSpellPrepNormalizeKey(entry?.key);
  const label = entry?.label || globalThis.add2eSpellLabel?.(key) || key;
  const count = Math.max(0, Number(total) || 0);
  const limit = Math.max(0, Number(max) || 0);
  const compactText = `${label} ${count}/${limit}`;
  const pillText = `${label} N${spellLevel} ${count}/${limit}`;
  for (const root of add2eSpellPrepCounterRoots(actor, clickedButton)) {
    const escaped = globalThis.CSS?.escape ? CSS.escape(key) : key.replace(/(["'\\.#:[\],>+~*=])/g, "\\$1");
    root.querySelectorAll?.(`.a2e-sort-slot-${escaped}`).forEach(element => { element.textContent = compactText; });
    root.querySelectorAll?.(".a2e-spell-capacity-pill").forEach(element => {
      const text = String(element.textContent ?? "").toLowerCase();
      if (text.includes(String(label).toLowerCase()) && text.includes(`n${spellLevel}`)) element.textContent = pillText;
    });
  }
}

function add2eSpellPrepSetRowCount(sort, next, clickedButton = null) {
  const text = String(Math.max(0, Number(next) || 0));
  const containers = [clickedButton?.closest?.(".add2e-spell-prep-entry"), clickedButton?.closest?.("tr")].filter(Boolean);
  for (const container of containers) {
    for (const badge of container.querySelectorAll?.(".sort-memorize-badge, [data-memorized-count], [data-add2e-memorized-count]") ?? []) {
      badge.textContent = text;
      badge.dataset.memorizedCount = text;
      badge.dataset.add2eMemorizedCount = text;
    }
  }
  add2eSpellPrepDebug("ROW_COUNT", { sort: sort?.name, next });
}

function add2eSpellPrepEnsureComponentStyle(root) {
  if (!root || root.querySelector?.("style[data-add2e-spell-components='1']")) return;
  const style = document.createElement("style");
  style.dataset.add2eSpellComponents = "1";
  style.textContent = `.add2e-character-v3 .add2e-sort-components{display:inline-flex;align-items:center;margin-left:.45em;padding:.08em .45em;border:1px solid #b98b2d;border-radius:999px;background:#fff7dc;color:#4b330a;font-size:.78em;font-weight:850;line-height:1.35}`;
  root.appendChild(style);
}

function add2eSpellPrepInjectComponents(actor, root) {
  if (!actor?.items || !root) return;
  if (typeof globalThis.add2eGetSpellComponentStatus !== "function") {
    throw new Error("Le propriétaire canonique des composants de sort ADD2E est indisponible.");
  }
  add2eSpellPrepEnsureComponentStyle(root);
  for (const row of root.querySelectorAll?.("table.sort-table tbody tr") ?? []) {
    if (row.classList.contains("sort-description") || row.classList.contains("add2e-object-magic-power-row")) continue;
    const trigger = row.querySelector("[data-sort-id]") ?? row;
    const sort = add2eSpellPrepResolveSort(actor, trigger);
    if (!sort) continue;
    row.querySelector(".add2e-sort-components")?.remove();
    const statuses = globalThis.add2eGetSpellComponentStatus(actor, sort) ?? [];
    if (!statuses.length) continue;
    const badge = document.createElement("span");
    badge.className = "add2e-sort-components";
    badge.textContent = `Composants : ${statuses.map(status => `${status.name}${status.quantity > 1 && !status.alternatives ? ` ×${status.quantity}` : ""}`).join(", ")}`;
    const target = row.querySelector(".a2e-sort-name-link")?.parentElement ?? row.querySelector("td:nth-child(3)") ?? row.querySelector("td");
    target?.append(document.createTextNode(" "), badge);
  }
}

function add2eSpellPrepAccessMessage(check, entry, spellLevel) {
  if (check?.reason === "intelligence-level") {
    return `Intelligence insuffisante : niveau maximal de sort ${check.maximumSpellLevel || 0}.`;
  }
  if (check?.reason === "ability-requirement") {
    return `Prérequis insuffisant : ${check.requiredAbility || "caractéristique"} ${check.requiredScore || 0}.`;
  }
  if (check?.reason === "list") return "Ce sort n’appartient à aucune liste disponible pour cet acteur.";
  return `${entry?.label ?? "Cette liste"} ne permet pas les sorts de niveau ${spellLevel}.`;
}

async function add2eHandleSpellPreparationButton(button, event = null, actorOverride = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  button?.blur?.();

  const actor = actorOverride ?? add2eSpellPrepResolveActorFromButton(button);
  if (!actor?.items) return ui.notifications.warn("Acteur introuvable pour la préparation du sort.");
  const snapshot = add2eSpellPrepSnapshot(actor);

  try {
    const api = add2eSpellPrepApi();
    const entryKey = api.normalizeKey(button.dataset.entryKey || button.dataset.spellEntryKey || button.getAttribute("data-entry-key") || button.getAttribute("data-spell-entry-key"));
    const sort = add2eSpellPrepResolveSort(actor, button);
    if (!sort) return ui.notifications.warn("Sort introuvable sur l’acteur après rafraîchissement de la feuille.");
    if (api.isObjectPower(sort)) return ui.notifications.warn("Ce pouvoir d’objet magique ne se prépare pas comme un sort.");

    const check = api.canUse(actor, sort);
    const entry = entryKey
      ? api.entries(actor).find(candidate => api.normalizeKey(candidate.key) === entryKey)
      : check?.entry;
    if (!entry) return ui.notifications.warn("Type de préparation introuvable.");

    const spellLevel = Number(sort.system?.niveau) || 0;
    if (spellLevel < 1) throw new Error(`${sort.name} : system.niveau canonique absent ou invalide.`);
    if (!check?.ok) return ui.notifications.warn(add2eSpellPrepAccessMessage(check, entry, spellLevel));

    const limit = Math.max(0, Number(api.slots(actor, entry, spellLevel)) || 0);
    if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${spellLevel} disponible.`);

    const current = Math.max(0, Number(api.current(sort, entry)) || 0);
    const totalBefore = Math.max(0, Number(api.total(actor, entry, spellLevel)) || 0);
    const isPlus = button.classList.contains("a2e-spell-entry-plus") || button.classList.contains("sort-memorize-plus");
    const isMinus = button.classList.contains("a2e-spell-entry-minus") || button.classList.contains("sort-memorize-minus");
    if (!isPlus && !isMinus) return;

    if (isPlus && totalBefore >= limit) {
      await add2eSpellPrepShowLimitDialog(entry, spellLevel, totalBefore, limit);
      return;
    }
    if (isMinus && current <= 0) return ui.notifications.warn(`Aucun sort ${entry.label} à retirer.`);

    const requested = isPlus ? current + 1 : current - 1;
    await api.set(sort, entry, requested);

    const currentAfter = Math.max(0, Number(api.current(sort, entry)) || 0);
    const totalAfter = Math.max(0, Number(api.total(actor, entry, spellLevel)) || 0);
    add2eSpellPrepSetRowCount(sort, currentAfter, button);
    add2eSpellPrepSetGlobalCounters(actor, entry, spellLevel, totalAfter, limit, button);

    setTimeout(() => {
      for (const app of add2eSpellPrepActorWindows(actor)) app.render?.(false);
      add2eSpellPrepRestoreRepeated(snapshot);
    }, 120);
  } catch (error) {
    console.error("[ADD2E][SPELL_PREP][ERROR]", error);
    ui.notifications.error(error?.message || "Erreur pendant la mémorisation du sort.");
  } finally {
    add2eSpellPrepRestoreRepeated(snapshot);
  }
}

function add2eBindNativeHbsSpellPreparationControls(actor, root) {
  if (!actor || !root || typeof root.querySelectorAll !== "function") return;
  if (root.dataset) root.dataset.actorId = String(actor.id ?? "");
  for (const button of root.querySelectorAll(".a2e-spell-entry-plus, .a2e-spell-entry-minus, .sort-memorize-plus, .sort-memorize-minus")) {
    const row = button.closest?.("tr.sort-row, tr[data-sort-id]");
    const parent = button.closest?.(".add2e-spell-prep-entry");
    button.dataset.actorId = String(actor.id ?? "");
    if (row?.dataset?.sortId && !button.dataset.sortId) button.dataset.sortId = row.dataset.sortId;
    if (row?.dataset?.spellStableKey && !button.dataset.spellStableKey) button.dataset.spellStableKey = row.dataset.spellStableKey;
    if (parent?.dataset?.entryKey && !button.dataset.entryKey) button.dataset.entryKey = parent.dataset.entryKey;
    const resolved = add2eSpellPrepResolveSort(actor, button);
    if (resolved) add2eSpellPrepRepairDomSpellId(row, resolved);
    if (button.dataset.add2ePrepBound === "1") continue;
    button.dataset.add2ePrepBound = "1";
    button.addEventListener("pointerdown", currentEvent => { currentEvent.preventDefault(); currentEvent.stopPropagation(); }, { capture: true });
    button.addEventListener("mousedown", currentEvent => { currentEvent.preventDefault(); currentEvent.stopPropagation(); }, { capture: true });
    button.addEventListener("click", currentEvent => add2eHandleSpellPreparationButton(button, currentEvent, actor), { capture: true });
  }
}

function add2eInstallDelegatedSpellPreparationControls() {
  if (globalThis.ADD2E_SPELL_PREP_DELEGATED_CANONICAL_INSTALLED) return;
  globalThis.ADD2E_SPELL_PREP_DELEGATED_CANONICAL_INSTALLED = true;
  document.addEventListener("click", event => {
    const button = event.target?.closest?.(".a2e-spell-entry-plus, .a2e-spell-entry-minus, .sort-memorize-plus, .sort-memorize-minus");
    if (!button || button.dataset.add2ePrepBound === "1") return;
    void add2eHandleSpellPreparationButton(button, event, null);
  }, true);
}

function add2eOnActorSheetRendered(app, html) {
  const actor = app?.actor ?? app?.document;
  if (actor?.documentName !== "Actor") return;
  const root = add2eSpellPrepDomRoot(app, html);
  setTimeout(() => {
    add2eBindNativeHbsSpellPreparationControls(actor, root);
    add2eSpellPrepInjectComponents(actor, root);
  }, 20);
}

Hooks.once("ready", add2eInstallDelegatedSpellPreparationControls);
Hooks.on("renderActorSheet", add2eOnActorSheetRendered);
Hooks.on("renderApplication", (app, html) => add2eOnActorSheetRendered(app, html));

globalThis.add2eBindNativeHbsSpellPreparationControls = add2eBindNativeHbsSpellPreparationControls;
globalThis.add2eHandleSpellPreparationButton = add2eHandleSpellPreparationButton;
globalThis.add2eSpellPrepInjectComponents = add2eSpellPrepInjectComponents;
globalThis.add2eSpellPrepResolveSort = add2eSpellPrepResolveSort;
