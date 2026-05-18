// ============================================================
// ADD2E — Affichage compact des emplacements de préparation
// V34 : préservation stricte du scroll lors du clic + / -.
// Le comportement de mémorisation existant est conservé.
// ============================================================

function add2eSpellPrepRootFromNode(node) {
  if (!node) return null;
  return node.closest?.(".add2e-character-v3") ?? node.querySelector?.(".add2e-character-v3") ?? node;
}

function add2eSpellPrepWindowRootFromNode(node) {
  if (!node) return null;
  return node.closest?.(".window-app, .application, .app") ?? node;
}

function add2eSpellPrepScrollableNodes(root) {
  if (!root) return [];

  const nodes = [];
  const add = el => {
    if (el && typeof el.scrollTop === "number" && !nodes.includes(el)) nodes.push(el);
  };

  // Le scroll réel de la feuille Foundry est souvent un ancêtre du <form>,
  // donc querySelector seul ne suffit pas.
  add(root.closest?.(".window-content"));
  add(root.closest?.(".sheet-body"));
  add(root.closest?.(".a2e-tab-content"));
  add(root.closest?.(".tab-sorts"));

  add(root.querySelector?.(".window-content"));
  add(root.querySelector?.(".sheet-body"));
  add(root.querySelector?.(".a2e-tab-content.active"));
  add(root.querySelector?.('.a2e-tab-content[data-tab="sorts"]'));
  add(root.querySelector?.(".tab-sorts"));

  add(root);

  return nodes;
}

function add2eSpellPrepCaptureScroll(root) {
  const sheetRoot = add2eSpellPrepRootFromNode(root) ?? root;
  const windowRoot = add2eSpellPrepWindowRootFromNode(root);
  const allRoots = [windowRoot, sheetRoot, root].filter(Boolean);
  const nodes = [];

  for (const r of allRoots) {
    for (const el of add2eSpellPrepScrollableNodes(r)) {
      if (!nodes.includes(el)) nodes.push(el);
    }
  }

  return nodes.map((el, index) => ({
    index,
    scrollTop: el.scrollTop,
    scrollLeft: el.scrollLeft
  }));
}

function add2eSpellPrepRestoreScroll(root, snapshot) {
  if (!root || !snapshot?.length) return;

  const sheetRoot = add2eSpellPrepRootFromNode(root) ?? root;
  const windowRoot = add2eSpellPrepWindowRootFromNode(root);
  const allRoots = [windowRoot, sheetRoot, root].filter(Boolean);
  const nodes = [];

  for (const r of allRoots) {
    for (const el of add2eSpellPrepScrollableNodes(r)) {
      if (!nodes.includes(el)) nodes.push(el);
    }
  }

  for (const item of snapshot) {
    const el = nodes[item.index];
    if (!el) continue;
    el.scrollTop = item.scrollTop;
    el.scrollLeft = item.scrollLeft;
  }
}

function add2eSpellPrepRestoreScrollRepeated(root, snapshot) {
  for (const delay of [0, 10, 25, 60, 120, 240, 420, 700]) {
    setTimeout(() => add2eSpellPrepRestoreScroll(root, snapshot), delay);
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

function add2eSpellPrepCaptureActorScroll(actor) {
  return add2eSpellPrepActorWindows(actor).map(app => {
    const root = app.element?.[0] ?? app.element ?? null;
    const activeTab = root?.querySelector?.(".a2e-tabs .item.active[data-tab]")?.dataset?.tab
      ?? root?.querySelector?.(".a2e-tab-content.active[data-tab]")?.dataset?.tab
      ?? null;
    return {
      appId: app.appId,
      activeTab,
      scroll: add2eSpellPrepCaptureScroll(root)
    };
  });
}

function add2eSpellPrepRestoreActorScroll(actor, snapshot) {
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

    add2eSpellPrepRestoreScroll(root, snap.scroll);
  }
}

function add2eSpellPrepRestoreActorScrollRepeated(actor, snapshot) {
  for (const delay of [0, 10, 25, 60, 120, 240, 420, 700]) {
    setTimeout(() => add2eSpellPrepRestoreActorScroll(actor, snapshot), delay);
  }
}

function add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, count, clickedButton = null) {
  const sortId = String(sort?.id ?? "");
  const entryKey = add2eNormalizeSpellKey(entry?.key);
  if (!sortId || !entryKey) return;

  const updateRow = row => {
    if (!row) return;
    const badges = Array.from(row.querySelectorAll?.(".sort-memorize-badge") ?? []);
    const editableBadge = badges.find(b => String(b.title ?? "").includes(entry?.label ?? "")) ?? badges[0];
    if (editableBadge) editableBadge.textContent = String(Math.max(0, Number(count) || 0));
  };

  if (clickedButton) updateRow(clickedButton.closest?.("tr"));

  for (const app of add2eSpellPrepActorWindows(actor)) {
    const root = app.element?.[0] ?? app.element ?? null;
    if (!root) continue;

    const escaped = globalThis.CSS?.escape ? CSS.escape(sortId) : sortId.replace(/(["'\\.#:[\],>+~*=])/g, "\\$1");
    const row = root.querySelector?.(`tr.sort-row[data-sort-id="${escaped}"]`)
      ?? root.querySelector?.(`[data-sort-id="${escaped}"]`)?.closest?.("tr");

    updateRow(row);
  }
}

function add2eBindNativeHbsSpellPreparationControls(actor, root) {
  if (!actor || !root) return;

  root.querySelectorAll(".a2e-spell-entry-plus, .a2e-spell-entry-minus, .sort-memorize-plus, .sort-memorize-minus").forEach(btn => {
    if (btn.dataset.add2ePrepBound === "1") return;
    btn.dataset.add2ePrepBound = "1";

    // Empêche le navigateur de déplacer le scroll/focus sur le <a> avant le click.
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
      const scrollSnapshot = add2eSpellPrepCaptureScroll(scrollRoot);
      const actorScrollSnapshot = add2eSpellPrepCaptureActorScroll(actor);

      try {
        const sortId = btn.dataset.sortId;
        const entryKey = add2eNormalizeSpellKey(btn.dataset.entryKey || btn.dataset.spellEntryKey || btn.getAttribute("data-spell-entry-key"));
        const sort = actor.items.get(sortId);
        if (!sort) return ui.notifications.warn("Sort introuvable.");

        const check = add2eCanActorUseSpell(actor, sort);
        const entry = entryKey
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

        let cur = add2eGetMemorizedCountForEntry(sort, entry);
        const isPlus = btn.classList.contains("a2e-spell-entry-plus") || btn.classList.contains("sort-memorize-plus");

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

        await add2eSetMemorizedCountForEntry(sort, entry, cur);

        add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, cur, btn);
      } finally {
        add2eSpellPrepRestoreScrollRepeated(scrollRoot, scrollSnapshot);
        add2eSpellPrepRestoreActorScrollRepeated(actor, actorScrollSnapshot);
      }
    }, { capture: true });
  });
}

Hooks.on("renderActorSheet", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;
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

console.log("ADD2E | Spell preparation native HBS V34 scroll-root-fix loaded");

try { globalThis.add2eBindNativeHbsSpellPreparationControls = add2eBindNativeHbsSpellPreparationControls; } catch (_e) {}
