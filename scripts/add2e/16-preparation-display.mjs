// ============================================================
// ADD2E — Affichage compact des emplacements de préparation
// V36 : diagnostics + restauration tardive du scroll + MAJ directe du badge.
// Le comportement de mémorisation existant est conservé.
// ============================================================

const ADD2E_SPELL_PREP_SCROLL_VERSION = "2026-05-18-v36-badge-direct-update";
const ADD2E_SPELL_PREP_PENDING_SCROLL = new Map();

function add2eSpellPrepDebugEnabled() {
  return true;
}

function add2eSpellPrepLog(step, data = {}) {
  if (!add2eSpellPrepDebugEnabled()) return;
  console.log(`[ADD2E][SPELL_PREP_SCROLL][${step}]`, {
    version: ADD2E_SPELL_PREP_SCROLL_VERSION,
    ...data
  });
}

function add2eSpellPrepRootFromNode(node) {
  if (!node) return null;
  return node.closest?.(".add2e-character-v3") ?? node.querySelector?.(".add2e-character-v3") ?? node;
}

function add2eSpellPrepWindowRootFromNode(node) {
  if (!node) return null;
  return node.closest?.(".window-app, .application, .app") ?? node;
}

function add2eSpellPrepNodeLabel(el) {
  if (!el) return "null";
  const tag = String(el.tagName ?? "node").toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = String(el.className ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map(c => `.${c}`)
    .join("");
  return `${tag}${id}${cls}`;
}

function add2eSpellPrepScrollableNodes(root) {
  if (!root) return [];

  const nodes = [];
  const add = el => {
    if (!el || typeof el.scrollTop !== "number") return;
    if (nodes.includes(el)) return;
    nodes.push(el);
  };

  add(root.closest?.(".window-content"));
  add(root.closest?.(".sheet-body"));
  add(root.closest?.(".a2e-tab-content"));
  add(root.closest?.(".tab-sorts"));

  add(root.querySelector?.(".window-content"));
  add(root.querySelector?.(".sheet-body"));
  add(root.querySelector?.(".a2e-tab-content.active"));
  add(root.querySelector?.('.a2e-tab-content[data-tab="sorts"]'));
  add(root.querySelector?.(".tab-sorts"));

  try {
    root.querySelectorAll?.("*").forEach(el => {
      if (typeof el.scrollTop !== "number") return;
      const canScroll = (Number(el.scrollHeight) || 0) > (Number(el.clientHeight) || 0) + 2;
      const hasScroll = Number(el.scrollTop) !== 0 || Number(el.scrollLeft) !== 0;
      if (canScroll || hasScroll) add(el);
    });
  } catch (_e) {}

  add(root);
  add(document.scrollingElement);

  return nodes;
}

function add2eSpellPrepCollectNodes(root) {
  const sheetRoot = add2eSpellPrepRootFromNode(root) ?? root;
  const windowRoot = add2eSpellPrepWindowRootFromNode(root);
  const allRoots = [windowRoot, sheetRoot, root].filter(Boolean);
  const nodes = [];

  for (const r of allRoots) {
    for (const el of add2eSpellPrepScrollableNodes(r)) {
      if (!nodes.includes(el)) nodes.push(el);
    }
  }

  return nodes;
}

function add2eSpellPrepCaptureScroll(root, reason = "capture") {
  const nodes = add2eSpellPrepCollectNodes(root);
  const snapshot = nodes.map((el, index) => ({
    index,
    label: add2eSpellPrepNodeLabel(el),
    scrollTop: Number(el.scrollTop) || 0,
    scrollLeft: Number(el.scrollLeft) || 0,
    scrollHeight: Number(el.scrollHeight) || 0,
    clientHeight: Number(el.clientHeight) || 0
  }));

  add2eSpellPrepLog("CAPTURE", {
    reason,
    root: add2eSpellPrepNodeLabel(root),
    count: snapshot.length,
    nonZero: snapshot.filter(s => s.scrollTop || s.scrollLeft)
  });

  return snapshot;
}

function add2eSpellPrepRestoreScroll(root, snapshot, reason = "restore") {
  if (!root || !snapshot?.length) return;

  const nodes = add2eSpellPrepCollectNodes(root);
  const changed = [];

  for (const item of snapshot) {
    const el = nodes[item.index];
    if (!el) continue;

    const beforeTop = Number(el.scrollTop) || 0;
    const beforeLeft = Number(el.scrollLeft) || 0;

    el.scrollTop = item.scrollTop;
    el.scrollLeft = item.scrollLeft;

    const afterTop = Number(el.scrollTop) || 0;
    const afterLeft = Number(el.scrollLeft) || 0;

    if (beforeTop !== afterTop || beforeLeft !== afterLeft) {
      changed.push({
        index: item.index,
        label: add2eSpellPrepNodeLabel(el),
        beforeTop,
        afterTop,
        targetTop: item.scrollTop,
        beforeLeft,
        afterLeft,
        targetLeft: item.scrollLeft
      });
    }
  }

  if (changed.length) add2eSpellPrepLog("RESTORE", { reason, changed });
}

function add2eSpellPrepRestoreScrollRepeated(root, snapshot, reason = "restore-repeated") {
  for (const delay of [0, 10, 25, 60, 120, 240, 420, 700, 1000, 1500, 2500]) {
    setTimeout(() => add2eSpellPrepRestoreScroll(root, snapshot, `${reason}:${delay}`), delay);
  }
}

function add2eSpellPrepActorWindows(actor) {
  const actorId = String(actor?.id ?? "");
  if (!actorId) return [];
  return Object.values(ui.windows ?? {}).filter(app => {
    const doc = app?.actor ?? app?.document ?? app?.object ?? null;
    return doc?.documentName === "Actor" && String(doc.id) === actorId;
  });
}

function add2eSpellPrepCaptureActorScroll(actor, reason = "actor-capture") {
  return add2eSpellPrepActorWindows(actor).map(app => {
    const root = app.element?.[0] ?? app.element ?? null;
    const activeTab = root?.querySelector?.(".a2e-tabs .item.active[data-tab]")?.dataset?.tab
      ?? root?.querySelector?.(".a2e-tab-content.active[data-tab]")?.dataset?.tab
      ?? null;
    return {
      appId: app.appId,
      actorId: actor?.id,
      activeTab,
      scroll: add2eSpellPrepCaptureScroll(root, reason)
    };
  });
}

function add2eSpellPrepRestoreActorScroll(actor, snapshot, reason = "actor-restore") {
  if (!snapshot?.length) return;
  for (const snap of snapshot) {
    const app = ui.windows?.[snap.appId];
    const root = app?.element?.[0] ?? app?.element ?? null;
    if (!root) continue;

    if (snap.activeTab) {
      try {
        root.querySelectorAll?.(".a2e-tabs .item[data-tab]").forEach(el => {
          el.classList.toggle("active", el.dataset.tab === snap.activeTab);
        });
        root.querySelectorAll?.(".a2e-tab-content[data-tab]").forEach(el => {
          el.classList.toggle("active", el.dataset.tab === snap.activeTab);
        });
      } catch (_e) {}
    }

    add2eSpellPrepRestoreScroll(root, snap.scroll, `${reason}:app-${snap.appId}`);
  }
}

function add2eSpellPrepRestoreActorScrollRepeated(actor, snapshot, reason = "actor-restore-repeated") {
  for (const delay of [0, 10, 25, 60, 120, 240, 420, 700, 1000, 1500, 2500]) {
    setTimeout(() => add2eSpellPrepRestoreActorScroll(actor, snapshot, `${reason}:${delay}`), delay);
  }
}

function add2eSpellPrepStorePendingActorScroll(actor, snapshot, reason) {
  const actorId = String(actor?.id ?? "");
  if (!actorId || !snapshot?.length) return;

  ADD2E_SPELL_PREP_PENDING_SCROLL.set(actorId, {
    reason,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5000,
    snapshot
  });

  add2eSpellPrepLog("PENDING_STORE", { actor: actor?.name, actorId, reason, apps: snapshot.length });
}

function add2eSpellPrepConsumePendingActorScroll(actor, reason) {
  const actorId = String(actor?.id ?? "");
  if (!actorId) return null;

  const pending = ADD2E_SPELL_PREP_PENDING_SCROLL.get(actorId);
  if (!pending) return null;

  if (Date.now() > pending.expiresAt) {
    ADD2E_SPELL_PREP_PENDING_SCROLL.delete(actorId);
    add2eSpellPrepLog("PENDING_EXPIRED", { actor: actor?.name, actorId, reason });
    return null;
  }

  add2eSpellPrepLog("PENDING_USE", { actor: actor?.name, actorId, reason, storedReason: pending.reason });
  return pending.snapshot;
}

function add2eSpellPrepEscapeCss(value) {
  const text = String(value ?? "");
  try { if (globalThis.CSS?.escape) return CSS.escape(text); } catch (_e) {}
  return text.replace(/(["'\\.#:[\],>+~*=])/g, "\\$1");
}

function add2eSpellPrepFindRowsForSort(root, sortId) {
  if (!root || !sortId) return [];
  const escaped = add2eSpellPrepEscapeCss(sortId);
  const rows = new Set();

  root.querySelectorAll?.(`tr.sort-row[data-sort-id="${escaped}"]`).forEach(row => rows.add(row));
  root.querySelectorAll?.(`[data-sort-id="${escaped}"]`).forEach(el => {
    const row = el.closest?.("tr");
    if (row) rows.add(row);
  });

  return [...rows];
}

function add2eSpellPrepUpdateBadgeInContainer(container, count, source = "unknown") {
  if (!container) return 0;

  const text = String(Math.max(0, Number(count) || 0));
  const badges = Array.from(container.querySelectorAll?.(".sort-memorize-badge, [data-memorized-count], [data-add2e-memorized-count]") ?? []);
  let changed = 0;

  for (const badge of badges) {
    const before = String(badge.textContent ?? "").trim();
    badge.textContent = text;
    badge.dataset.memorizedCount = text;
    badge.dataset.add2eMemorizedCount = text;
    badge.setAttribute("data-memorized-count", text);
    if (before !== text) changed++;
  }

  add2eSpellPrepLog("BADGE_CONTAINER", {
    source,
    container: add2eSpellPrepNodeLabel(container),
    count: text,
    badges: badges.length,
    changed
  });

  return badges.length;
}

function add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, count, clickedButton = null) {
  const sortId = String(sort?.id ?? sort?._id ?? "");
  let totalTouched = 0;

  if (clickedButton) {
    totalTouched += add2eSpellPrepUpdateBadgeInContainer(clickedButton.closest?.("td"), count, "clicked-td");
    totalTouched += add2eSpellPrepUpdateBadgeInContainer(clickedButton.closest?.("tr"), count, "clicked-tr");
    totalTouched += add2eSpellPrepUpdateBadgeInContainer(clickedButton.parentElement, count, "clicked-parent");
  }

  for (const app of add2eSpellPrepActorWindows(actor)) {
    const root = app.element?.[0] ?? app.element ?? null;
    if (!root) continue;

    for (const row of add2eSpellPrepFindRowsForSort(root, sortId)) {
      totalTouched += add2eSpellPrepUpdateBadgeInContainer(row, count, `window-row-${app.appId}`);
    }
  }

  add2eSpellPrepLog("BADGE_UPDATE", {
    actor: actor?.name,
    sort: sort?.name,
    sortId,
    entry: entry?.label,
    count,
    totalTouched
  });
}

function add2eBindNativeHbsSpellPreparationControls(actor, root) {
  if (!actor || !root) return;

  root.querySelectorAll(".a2e-spell-entry-plus, .a2e-spell-entry-minus, .sort-memorize-plus, .sort-memorize-minus").forEach(btn => {
    if (btn.dataset.add2ePrepBound === "1") return;
    btn.dataset.add2ePrepBound = "1";

    btn.addEventListener("pointerdown", ev => {
      ev.preventDefault();
      ev.stopPropagation();
    }, { capture: true });

    btn.addEventListener("mousedown", ev => {
      ev.preventDefault();
      ev.stopPropagation();
    }, { capture: true });

    btn.addEventListener("click", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      btn.blur?.();

      const sheetRoot = add2eSpellPrepRootFromNode(btn);
      const windowRoot = add2eSpellPrepWindowRootFromNode(btn);
      const scrollRoot = windowRoot ?? sheetRoot;
      const scrollSnapshot = add2eSpellPrepCaptureScroll(scrollRoot, "click-before");
      const actorScrollSnapshot = add2eSpellPrepCaptureActorScroll(actor, "click-before-actor");
      add2eSpellPrepStorePendingActorScroll(actor, actorScrollSnapshot, "click-before-update");

      let sort = null;
      let entry = null;
      let cur = 0;

      try {
        const sortId = btn.dataset.sortId;
        const entryKey = add2eNormalizeSpellKey(btn.dataset.entryKey || btn.dataset.spellEntryKey || btn.getAttribute("data-spell-entry-key"));
        sort = actor.items.get(sortId);
        if (!sort) return ui.notifications.warn("Sort introuvable.");

        const check = add2eCanActorUseSpell(actor, sort);
        entry = entryKey
          ? add2eGetSpellcastingEntries(actor).find(e => add2eNormalizeSpellKey(e.key) === entryKey)
          : check?.entry;

        if (!entry) return ui.notifications.warn("Type de préparation introuvable.");

        const sortLists = add2eGetSpellListsFromItem(sort);
        const resolvedEntryKey = add2eNormalizeSpellKey(entry.key);
        const spellLevel = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
        const actorLevel = Math.max(1, Number(actor.system?.niveau ?? 1) || 1);
        const startsAt = Number(entry.startsAt ?? 1) || 1;
        const maxSpellLevel = Number(entry.maxSpellLevel ?? 0) || 0;

        if (!sortLists.includes(resolvedEntryKey)) return ui.notifications.warn(`Ce sort n'appartient pas à la liste ${entry.label}.`);
        if (actorLevel < startsAt) return ui.notifications.warn(`${entry.label} n'est disponible qu'à partir du niveau ${startsAt}.`);
        if (maxSpellLevel && spellLevel > maxSpellLevel) return ui.notifications.warn(`${entry.label} ne permet pas les sorts de niveau ${spellLevel}.`);
        if (!check.ok && add2eNormalizeSpellKey(check.entry?.key) !== resolvedEntryKey) return ui.notifications.warn("Ce sort n'est pas autorisé pour cette classe.");

        cur = add2eGetMemorizedCountForEntry(sort, entry);
        const isPlus = btn.classList.contains("a2e-spell-entry-plus") || btn.classList.contains("sort-memorize-plus");

        add2eSpellPrepLog("CLICK", {
          actor: actor.name,
          sort: sort.name,
          sortId,
          entry: entry.label,
          before: cur,
          action: isPlus ? "plus" : "minus"
        });

        if (isPlus) {
          const limit = add2eGetSlotsForEntryLevel(actor, entry, spellLevel);
          const total = add2eCountPreparedForEntryLevel(actor, entry, spellLevel);
          if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${spellLevel} disponible.`);
          if (total >= limit) return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${spellLevel} (${total}/${limit}).`);
          cur++;
        } else {
          if (cur <= 0) return ui.notifications.warn(`Aucun sort ${entry.label} à retirer.`);
          cur--;
        }

        // Mise à jour optimiste immédiate : le compteur visible descend/monte tout de suite.
        add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, cur, btn);

        await add2eSetMemorizedCountForEntry(sort, entry, cur);

        // Deuxième mise à jour après persistance Foundry.
        add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, cur, btn);
        add2eSpellPrepLog("UPDATE_DONE", { actor: actor.name, sort: sort.name, entry: entry.label, after: cur });
      } catch (err) {
        console.error("[ADD2E][SPELL_PREP_SCROLL][ERROR]", err);
        ui.notifications.error("Erreur pendant la mémorisation du sort.");
      } finally {
        add2eSpellPrepRestoreScrollRepeated(scrollRoot, scrollSnapshot, "click-finally-root");
        add2eSpellPrepRestoreActorScrollRepeated(actor, actorScrollSnapshot, "click-finally-actor");
      }
    }, { capture: true });
  });
}

Hooks.on("renderActorSheet", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;

  add2eSpellPrepLog("RENDER_ACTOR_SHEET", {
    actor: actor?.name,
    appId: app?.appId,
    hasPending: !!ADD2E_SPELL_PREP_PENDING_SCROLL.get(String(actor?.id ?? ""))
  });

  const pending = add2eSpellPrepConsumePendingActorScroll(actor, "renderActorSheet");
  if (pending) add2eSpellPrepRestoreActorScrollRepeated(actor, pending, "renderActorSheet-pending");

  setTimeout(() => add2eBindNativeHbsSpellPreparationControls(actor, root), 20);
  for (const delay of [40, 120, 260]) {
    setTimeout(() => {
      try {
        if (actor?.type === "personnage") add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Injection après rendu impossible.", err);
      }
    }, delay);
  }
});

Hooks.on("renderApplication", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;

  if (actor?.documentName === "Actor") {
    add2eSpellPrepLog("RENDER_APPLICATION_ACTOR", {
      actor: actor?.name,
      appId: app?.appId,
      hasPending: !!ADD2E_SPELL_PREP_PENDING_SCROLL.get(String(actor?.id ?? ""))
    });
    const pending = add2eSpellPrepConsumePendingActorScroll(actor, "renderApplication");
    if (pending) add2eSpellPrepRestoreActorScrollRepeated(actor, pending, "renderApplication-pending");
  }

  setTimeout(() => add2eBindNativeHbsSpellPreparationControls(actor, root), 20);
  for (const delay of [40, 120, 260]) {
    setTimeout(() => {
      try {
        if (actor?.type === "personnage") add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Injection application impossible.", err);
      }
    }, delay);
  }
});

Hooks.on("updateItem", (item, changes, options, userId) => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor") return;
  if (!changes?.flags?.add2e) return;

  add2eSpellPrepLog("UPDATE_ITEM_FLAGS_ADD2E", {
    actor: actor.name,
    item: item.name,
    itemId: item.id,
    changes,
    options,
    userId,
    hasPending: !!ADD2E_SPELL_PREP_PENDING_SCROLL.get(String(actor.id))
  });

  const pending = add2eSpellPrepConsumePendingActorScroll(actor, "updateItem");
  if (pending) add2eSpellPrepRestoreActorScrollRepeated(actor, pending, "updateItem-pending");
});

console.log("ADD2E | Spell preparation native HBS V36 badge direct update loaded");

try { globalThis.add2eBindNativeHbsSpellPreparationControls = add2eBindNativeHbsSpellPreparationControls; } catch (_e) {}
