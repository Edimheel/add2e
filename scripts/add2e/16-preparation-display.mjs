// ============================================================
// ADD2E — Contrôles de mémorisation des sorts
// Version : 2026-06-12-v42-delegate-central-quotas-components
// ============================================================
// Ce fichier ne calcule plus les quotas lui-même.
// Source de vérité : 07-spellcasting-rules.mjs.
// Ici : boutons +/-, restauration de scroll et affichage des composants sur les lignes.

const ADD2E_SPELL_PREP_SCROLL_VERSION = "2026-06-12-v42-delegate-central-quotas-components";
globalThis.ADD2E_SPELL_PREP_SCROLL_VERSION = ADD2E_SPELL_PREP_SCROLL_VERSION;

const ADD2E_SPELL_PREP_PENDING_SCROLL = new Map();

function add2eSpellPrepRootFromNode(node) {
  if (!node) return null;
  return node.closest?.(".add2e-character-v3") ?? node.querySelector?.(".add2e-character-v3") ?? node;
}

function add2eSpellPrepWindowRootFromNode(node) {
  if (!node) return null;
  return node.closest?.(".window-app, .application, .app") ?? node;
}

function add2eSpellPrepActorWindows(actor) {
  const actorId = String(actor?.id ?? "");
  if (!actorId) return [];
  return Object.values(ui.windows ?? {}).filter(app => {
    const doc = app?.actor ?? app?.document ?? app?.object ?? null;
    return doc?.documentName === "Actor" && String(doc.id) === actorId;
  });
}

function add2eSpellPrepResolveActorFromButton(btn) {
  const appRoot = btn?.closest?.(".application, .window-app, .app");
  const appId = appRoot?.dataset?.appid || appRoot?.dataset?.appId || appRoot?.id?.replace(/^app-/, "") || null;
  if (appId) {
    const app = Object.values(ui.windows ?? {}).find(w => String(w.appId) === String(appId) || String(w.id) === String(appId));
    const actor = app?.actor ?? app?.document ?? app?.object ?? null;
    if (actor?.documentName === "Actor") return actor;
  }

  const actorId = btn?.closest?.("[data-actor-id]")?.dataset?.actorId;
  if (actorId && game.actors?.get(actorId)) return game.actors.get(actorId);

  const selected = canvas?.tokens?.controlled?.[0]?.actor;
  if (selected?.documentName === "Actor") return selected;

  return game.user?.character ?? null;
}

function add2eSpellPrepScrollableNodes(root) {
  if (!root) return [];
  const nodes = [];
  const add = el => {
    if (!el || typeof el.scrollTop !== "number") return;
    if (!nodes.includes(el)) nodes.push(el);
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
  add(root);
  add(document.scrollingElement);
  return nodes;
}

function add2eSpellPrepCaptureScroll(root) {
  return add2eSpellPrepScrollableNodes(root).map((el, index) => ({
    index,
    scrollTop: Number(el.scrollTop) || 0,
    scrollLeft: Number(el.scrollLeft) || 0
  }));
}

function add2eSpellPrepRestoreScroll(root, snapshot) {
  if (!root || !snapshot?.length) return;
  const nodes = add2eSpellPrepScrollableNodes(root);
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

function add2eSpellPrepCaptureActorScroll(actor) {
  return add2eSpellPrepActorWindows(actor).map(app => {
    const root = app.element?.[0] ?? app.element ?? null;
    const activeTab = root?.querySelector?.(".a2e-tabs .item.active[data-tab]")?.dataset?.tab
      ?? root?.querySelector?.(".a2e-tab-content.active[data-tab]")?.dataset?.tab
      ?? null;
    return { appId: app.appId, actorId: actor?.id, activeTab, scroll: add2eSpellPrepCaptureScroll(root) };
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
        root.querySelectorAll?.(".a2e-tabs .item[data-tab]").forEach(el => el.classList.toggle("active", el.dataset.tab === snap.activeTab));
        root.querySelectorAll?.(".a2e-tab-content[data-tab]").forEach(el => el.classList.toggle("active", el.dataset.tab === snap.activeTab));
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

function add2eSpellPrepStorePendingActorScroll(actor, snapshot, reason) {
  const actorId = String(actor?.id ?? "");
  if (!actorId || !snapshot?.length) return;
  ADD2E_SPELL_PREP_PENDING_SCROLL.set(actorId, { reason, createdAt: Date.now(), expiresAt: Date.now() + 5000, snapshot });
}

function add2eSpellPrepConsumePendingActorScroll(actor) {
  const actorId = String(actor?.id ?? "");
  if (!actorId) return null;
  const pending = ADD2E_SPELL_PREP_PENDING_SCROLL.get(actorId);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    ADD2E_SPELL_PREP_PENDING_SCROLL.delete(actorId);
    return null;
  }
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

function add2eSpellPrepUpdateBadgeInContainer(container, count, entryKey = null) {
  if (!container) return 0;
  const text = String(Math.max(0, Number(count) || 0));
  const selectors = entryKey
    ? [`.add2e-spell-prep-entry [data-add2e-memorized-count]`, `.sort-memorize-badge[data-entry-key="${add2eSpellPrepEscapeCss(entryKey)}"]`, `.sort-memorize-badge[data-spell-entry-key="${add2eSpellPrepEscapeCss(entryKey)}"]`]
    : [".sort-memorize-badge", "[data-memorized-count]", "[data-add2e-memorized-count]"];
  const badges = Array.from(container.querySelectorAll?.(selectors.join(",")) ?? []);
  for (const badge of badges) {
    badge.textContent = text;
    badge.dataset.memorizedCount = text;
    badge.dataset.add2eMemorizedCount = text;
    badge.setAttribute("data-memorized-count", text);
  }
  return badges.length;
}

function add2eSpellPrepComputeCounter(actor, entry, spellLevel) {
  const key = add2eNormalizeSpellKey(entry?.key);
  const slots = add2eGetSpellSlotPoolsByLevel(actor);
  const pool = slots?.[key] ?? entry;
  return {
    key,
    label: entry?.label || pool?.label || add2eSpellLabel(key),
    count: add2eCountPreparedForEntryLevel(actor, entry, spellLevel),
    max: Number(pool?.slotsByLevel?.[spellLevel] ?? add2eGetSlotsForEntryLevel(actor, entry, spellLevel) ?? 0) || 0
  };
}

function add2eSpellPrepRefreshLevelCounters(actor, spellLevel, entry, clickedButton = null) {
  if (!actor || !entry || !spellLevel) return;
  const thisCounter = add2eSpellPrepComputeCounter(actor, entry, spellLevel);
  const labelText = `${thisCounter.label} : ${thisCounter.count} / ${thisCounter.max}`;

  for (const app of add2eSpellPrepActorWindows(actor)) {
    const root = app.element?.[0] ?? app.element ?? null;
    if (!root) continue;
    const panels = new Set();
    if (clickedButton?.isConnected) {
      const panel = clickedButton.closest?.(".add2e-spell-list-group, .a2e-panel");
      if (panel) panels.add(panel);
    }
    root.querySelectorAll?.(".add2e-spell-list-group, .a2e-panel").forEach(panel => {
      const text = String(panel.querySelector?.("h2, h3, th")?.textContent ?? panel.textContent ?? "");
      if (text.includes(thisCounter.label)) panels.add(panel);
    });
    for (const panel of panels) {
      for (const badge of panel.querySelectorAll?.("h2 .sort-memorize-badge, h3 .sort-memorize-badge, th .a2e-sort-slot-label") ?? []) {
        if (String(badge.textContent ?? "").includes(thisCounter.label) || badge.className?.includes?.(thisCounter.key)) badge.textContent = labelText;
      }
    }
  }
}

function add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, count, clickedButton = null) {
  const sortId = String(sort?.id ?? sort?._id ?? "");
  const entryKey = add2eNormalizeSpellKey(entry?.key);
  if (clickedButton) {
    add2eSpellPrepUpdateBadgeInContainer(clickedButton.closest?.(".add2e-spell-prep-entry"), count, entryKey);
    add2eSpellPrepUpdateBadgeInContainer(clickedButton.closest?.("td"), count, entryKey);
    add2eSpellPrepUpdateBadgeInContainer(clickedButton.closest?.("tr"), count, entryKey);
  }
  for (const app of add2eSpellPrepActorWindows(actor)) {
    const root = app.element?.[0] ?? app.element ?? null;
    if (!root) continue;
    for (const row of add2eSpellPrepFindRowsForSort(root, sortId)) add2eSpellPrepUpdateBadgeInContainer(row, count, entryKey);
  }
}

function add2eSpellPrepArray(value) {
  if (Array.isArray(value)) return value.flatMap(add2eSpellPrepArray).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+|\bet\b/gi).map(x => x.trim()).filter(Boolean);
  if (typeof value === "object") {
    const name = value.name ?? value.nom ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    const qty = value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? null;
    if (name) return [qty ? `${name} ×${qty}` : String(name)];
  }
  return [String(value)];
}

function add2eSpellPrepIsOnlyComponentCode(value) {
  const t = String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(t);
}

function add2eSpellPrepMaterialComponents(sort) {
  const s = sort?.system ?? {};
  const f = sort?.flags?.add2e ?? {};
  const values = [];
  for (const field of [s.composants_requis, s.composantsMateriels, s.composants_materiels, s.composantsMateriel, s.composant_materiel, s.composantMateriel, s.materiel, s.matériel, s.material, s.materialComponent, s.materialComponents, s.material_components, s.requiredComponents, s.componentsRequired, s.components?.material, s.components?.materials, f.composants_requis, f.components, f.requiredComponents]) {
    values.push(...add2eSpellPrepArray(field));
  }
  for (const tag of [...add2eSpellPrepArray(s.tags), ...add2eSpellPrepArray(s.effectTags), ...add2eSpellPrepArray(f.tags), ...add2eSpellPrepArray(f.effectTags)]) {
    const raw = String(tag ?? "").trim();
    if (/^composant[:_]/i.test(raw)) values.push(raw.replace(/^composant[:_]/i, ""));
  }
  return [...new Set(values.map(v => String(v ?? "").trim()).filter(v => v && !add2eSpellPrepIsOnlyComponentCode(v)))];
}

function add2eSpellPrepEnsureComponentStyle(root) {
  if (!root || root.querySelector?.("style[data-add2e-spell-components='1']")) return;
  const style = document.createElement("style");
  style.dataset.add2eSpellComponents = "1";
  style.textContent = `.add2e-character-v3 .add2e-sort-components{display:inline-flex;align-items:center;margin-left:.45em;padding:.08em .45em;border:1px solid #b98b2d;border-radius:999px;background:#fff7dc;color:#4b330a;font-size:.78em;font-weight:850;line-height:1.35}.add2e-character-v3 .add2e-sort-components.empty{background:#f3eee1;color:#7f704d}`;
  root.appendChild(style);
}

function add2eSpellPrepInjectComponents(actor, root) {
  if (!actor?.items || !root) return;
  add2eSpellPrepEnsureComponentStyle(root);
  for (const row of root.querySelectorAll?.("table.sort-table tbody tr") ?? []) {
    if (row.classList.contains("sort-description")) continue;
    const sortId = row.querySelector("[data-sort-id]")?.dataset?.sortId || row.getAttribute("data-sort-id");
    const sort = sortId ? actor.items.get(sortId) : null;
    if (!sort) continue;
    row.querySelector(".add2e-sort-components")?.remove();
    const comps = add2eSpellPrepMaterialComponents(sort);
    const badge = document.createElement("span");
    badge.className = `add2e-sort-components ${comps.length ? "" : "empty"}`;
    badge.textContent = comps.length ? `Composants : ${comps.join(", ")}` : "Composants : aucun";
    badge.title = comps.length ? `Composants matériels nécessaires : ${comps.join(", ")}` : "Aucun composant matériel identifié sur ce sort.";
    const target = row.querySelector(".a2e-sort-name-link")?.parentElement
      ?? Array.from(row.children).find(td => td.textContent?.trim() && !td.querySelector("img"))
      ?? row.querySelector("td");
    target?.appendChild(document.createTextNode(" "));
    target?.appendChild(badge);
  }
}

async function add2eHandleSpellPreparationButton(btn, event = null, actorOverride = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  btn?.blur?.();

  const actor = actorOverride ?? add2eSpellPrepResolveActorFromButton(btn);
  if (!actor?.items) return ui.notifications.warn("Acteur introuvable pour la préparation du sort.");

  const sheetRoot = add2eSpellPrepRootFromNode(btn);
  const windowRoot = add2eSpellPrepWindowRootFromNode(btn);
  const scrollRoot = windowRoot ?? sheetRoot;
  const scrollSnapshot = add2eSpellPrepCaptureScroll(scrollRoot);
  const actorScrollSnapshot = add2eSpellPrepCaptureActorScroll(actor);
  add2eSpellPrepStorePendingActorScroll(actor, actorScrollSnapshot, "spell-prep-update");

  let sort = null;
  let entry = null;
  let cur = 0;
  let spellLevel = 1;

  try {
    const sortId = btn.dataset.sortId;
    const entryKey = add2eNormalizeSpellKey(btn.dataset.entryKey || btn.dataset.spellEntryKey || btn.getAttribute("data-entry-key") || btn.getAttribute("data-spell-entry-key"));
    sort = actor.items.get(sortId);
    if (!sort) return ui.notifications.warn("Sort introuvable.");

    if (typeof add2eIsObjectMagicSpellForPreparation === "function" && add2eIsObjectMagicSpellForPreparation(sort)) {
      return ui.notifications.warn("Ce pouvoir d'objet magique ne se prépare pas comme un sort.");
    }

    const check = add2eCanActorUseSpell(actor, sort);
    entry = entryKey ? add2eGetSpellcastingEntries(actor).find(e => add2eNormalizeSpellKey(e.key) === entryKey) : check?.entry;
    if (!entry) return ui.notifications.warn("Type de préparation introuvable.");

    const sortLists = add2eGetSpellListsFromItem(sort);
    const resolvedEntryKey = add2eNormalizeSpellKey(entry.key);
    spellLevel = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
    const maxSpellLevel = Number(entry.maxSpellLevel ?? 0) || 0;

    if (!sortLists.includes(resolvedEntryKey)) return ui.notifications.warn(`Ce sort n'appartient pas à la liste ${entry.label}.`);
    if (maxSpellLevel && spellLevel > maxSpellLevel) return ui.notifications.warn(`${entry.label} ne permet pas les sorts de niveau ${spellLevel}.`);

    const limit = add2eGetSlotsForEntryLevel(actor, entry, spellLevel);
    if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${spellLevel} disponible.`);

    cur = add2eGetMemorizedCountForEntry(sort, entry);
    const isPlus = btn.classList.contains("a2e-spell-entry-plus") || btn.classList.contains("sort-memorize-plus");

    if (isPlus) {
      const total = add2eCountPreparedForEntryLevel(actor, entry, spellLevel);
      if (total >= limit) return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${spellLevel} (${total}/${limit}).`);
      cur++;
    } else {
      if (cur <= 0) return ui.notifications.warn(`Aucun sort ${entry.label} à retirer.`);
      cur--;
    }

    add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, cur, btn);
    add2eSpellPrepRefreshLevelCounters(actor, spellLevel, entry, btn);
    await add2eSetMemorizedCountForEntry(sort, entry, cur);
    add2eSpellPrepUpdateVisibleBadges(actor, sort, entry, cur, btn);
    add2eSpellPrepRefreshLevelCounters(actor, spellLevel, entry, btn);
  } catch (err) {
    console.error("[ADD2E][SPELL_PREP][ERROR]", err);
    ui.notifications.error("Erreur pendant la mémorisation du sort.");
  } finally {
    add2eSpellPrepRestoreScrollRepeated(scrollRoot, scrollSnapshot);
    add2eSpellPrepRestoreActorScrollRepeated(actor, actorScrollSnapshot);
  }
}

function add2eBindNativeHbsSpellPreparationControls(actor, root) {
  if (!actor || !root) return;
  root.querySelectorAll(".a2e-spell-entry-plus, .a2e-spell-entry-minus, .sort-memorize-plus, .sort-memorize-minus").forEach(btn => {
    if (btn.dataset.add2ePrepBound === "1") return;
    btn.dataset.add2ePrepBound = "1";
    btn.addEventListener("pointerdown", ev => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true });
    btn.addEventListener("mousedown", ev => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true });
    btn.addEventListener("click", ev => add2eHandleSpellPreparationButton(btn, ev, actor), { capture: true });
  });
}

function add2eInstallDelegatedSpellPreparationControls() {
  if (globalThis.ADD2E_SPELL_PREP_DELEGATED_V42_INSTALLED) return;
  globalThis.ADD2E_SPELL_PREP_DELEGATED_V42_INSTALLED = true;

  document.addEventListener("click", ev => {
    const btn = ev.target?.closest?.(".a2e-spell-entry-plus, .a2e-spell-entry-minus, .sort-memorize-plus, .sort-memorize-minus");
    if (!btn) return;
    if (btn.dataset.add2ePrepBound === "1") return;
    add2eHandleSpellPreparationButton(btn, ev, null);
  }, true);
}

Hooks.once("ready", add2eInstallDelegatedSpellPreparationControls);

Hooks.on("renderActorSheet", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;
  const pending = add2eSpellPrepConsumePendingActorScroll(actor);
  if (pending) add2eSpellPrepRestoreActorScrollRepeated(actor, pending);
  setTimeout(() => {
    add2eBindNativeHbsSpellPreparationControls(actor, root);
    add2eSpellPrepInjectComponents(actor, root);
  }, 20);
});

Hooks.on("renderApplication", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;
  if (actor?.documentName === "Actor") {
    const pending = add2eSpellPrepConsumePendingActorScroll(actor);
    if (pending) add2eSpellPrepRestoreActorScrollRepeated(actor, pending);
  }
  setTimeout(() => {
    add2eBindNativeHbsSpellPreparationControls(actor, root);
    add2eSpellPrepInjectComponents(actor, root);
  }, 20);
});

Hooks.on("updateItem", (item, changes) => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor") return;
  if (!changes?.flags?.add2e) return;
  const pending = add2eSpellPrepConsumePendingActorScroll(actor);
  if (pending) add2eSpellPrepRestoreActorScrollRepeated(actor, pending);
  const spellLevel = Number(item.system?.niveau ?? item.system?.level ?? 1) || 1;
  const check = typeof add2eCanActorUseSpell === "function" ? add2eCanActorUseSpell(actor, item) : null;
  if (check?.entry) add2eSpellPrepRefreshLevelCounters(actor, spellLevel, check.entry, null);
});

try { globalThis.add2eBindNativeHbsSpellPreparationControls = add2eBindNativeHbsSpellPreparationControls; } catch (_e) {}
try { globalThis.add2eHandleSpellPreparationButton = add2eHandleSpellPreparationButton; } catch (_e) {}
try { globalThis.add2eSpellPrepInjectComponents = add2eSpellPrepInjectComponents; } catch (_e) {}
