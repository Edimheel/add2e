// ============================================================
// ADD2E — Contrôles de mémorisation des sorts
// Version : 2026-08-08-canonical-preparation-consumer-v2
// Source exclusive des quotas et compteurs : 07-spellcasting-rules.mjs.
// Compatible Foundry V13/V14/V15 et ApplicationV2.
// ============================================================

const ADD2E_SPELL_PREP_SCROLL_VERSION = "2026-08-08-canonical-preparation-consumer-v2";
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

function add2eSpellPrepNormalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellPrepNormalizeKey(value) {
  return typeof globalThis.add2eNormalizeSpellKey === "function"
    ? globalThis.add2eNormalizeSpellKey(value)
    : add2eSpellPrepNormalizeText(value);
}

function add2eSpellPrepDescribeItem(item) {
  if (!item) return null;
  return {
    id: item.id ?? item._id ?? null,
    name: item.name ?? item.system?.nom ?? "",
    level: Number(item.system?.niveau ?? item.system?.level ?? 0) || 0,
    lists: (globalThis.add2eGetSpellListsFromItem?.(item) ?? []).map(add2eSpellPrepNormalizeKey),
    stableKey: add2eSpellPrepStableKeyForItem(item)
  };
}

function add2eSpellPrepDescribeButton(button) {
  if (!button) return null;
  const row = button.closest?.("tr.sort-row, tr[data-sort-id]");
  return {
    className: String(button.className ?? ""),
    sortId: button.dataset?.sortId ?? row?.dataset?.sortId ?? null,
    stableKey: button.dataset?.spellStableKey ?? row?.dataset?.spellStableKey ?? null,
    entryKey: button.dataset?.entryKey ?? button.dataset?.spellEntryKey ?? null,
    spellName: button.dataset?.spellName ?? row?.dataset?.spellName ?? null,
    spellLevel: button.dataset?.spellLevel ?? row?.dataset?.spellLevel ?? null,
    actorId: button.dataset?.actorId ?? button.closest?.("[data-actor-id]")?.dataset?.actorId ?? null,
    bound: button.dataset?.add2ePrepBound ?? null
  };
}

function add2eSpellPrepStableKeyForItem(item) {
  const flags = item?.flags?.add2e ?? {};
  const existing = String(flags.stableSpellKey ?? flags.spellStableKey ?? "").trim();
  if (existing) return existing;
  const name = add2eSpellPrepNormalizeText(item?.name ?? item?.system?.nom ?? "");
  const level = Number(item?.system?.niveau ?? item?.system?.level ?? 0) || 0;
  const lists = (globalThis.add2eGetSpellListsFromItem?.(item) ?? [])
    .map(add2eSpellPrepNormalizeKey)
    .filter(Boolean)
    .sort()
    .join("+");
  return name ? `${lists || "liste_inconnue"}|${level}|${name}` : "";
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

function add2eSpellPrepResolveSort(actor, button, entryKey = "") {
  const directId = button?.dataset?.sortId || button?.closest?.("[data-sort-id]")?.dataset?.sortId;
  const direct = directId ? actor?.items?.get?.(directId) : null;
  if (direct) return direct;

  const row = button?.closest?.("tr.sort-row, tr[data-sort-id]");
  const stableKeys = add2eSpellPrepCandidateStableKeys(button, row);
  if (stableKeys.length) {
    const found = Array.from(actor?.items ?? []).find(item =>
      String(item?.type ?? "").toLowerCase() === "sort"
      && stableKeys.includes(add2eSpellPrepStableKeyForItem(item))
    ) ?? null;
    if (found) {
      add2eSpellPrepRepairDomSpellId(row, found);
      return found;
    }
  }

  const rawName = row?.dataset?.spellName
    || button?.dataset?.spellName
    || row?.querySelector?.(".a2e-sort-name-link, .toggle-sort-desc-chat")?.textContent
    || row?.querySelector?.("[title^='Lancer ']")?.getAttribute?.("title")?.replace(/^Lancer\s+/i, "")
    || row?.children?.[2]?.textContent
    || "";
  const targetName = add2eSpellPrepNormalizeText(String(rawName).replace(/Composants\s*:.*$/i, ""));
  const explicitLevel = Number(row?.dataset?.spellLevel ?? button?.dataset?.spellLevel ?? 0) || null;
  const groupText = row?.closest?.(".a2e-panel")?.querySelector?.("h3")?.textContent ?? "";
  const levelMatch = String(groupText).match(/niveau\s*(\d+)/i);
  const targetLevel = explicitLevel || (levelMatch ? Number(levelMatch[1]) : null);
  const key = add2eSpellPrepNormalizeKey(entryKey);

  const found = Array.from(actor?.items ?? []).find(item => {
    if (String(item?.type ?? "").toLowerCase() !== "sort") return false;
    if (targetName && add2eSpellPrepNormalizeText(item.name) !== targetName) return false;
    if (targetLevel && (Number(item.system?.niveau ?? item.system?.level ?? 1) || 1) !== targetLevel) return false;
    if (key) {
      const lists = (globalThis.add2eGetSpellListsFromItem?.(item) ?? []).map(add2eSpellPrepNormalizeKey);
      if (!lists.includes(key)) return false;
    }
    return true;
  }) ?? null;

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

function add2eSpellPrepReadVisibleTotal(actor, entry, spellLevel, clickedButton = null) {
  const label = String(entry?.label || globalThis.add2eSpellLabel?.(entry?.key) || "").toLowerCase();
  const levelText = `n${Number(spellLevel) || 1}`;
  const readRatio = text => {
    const match = String(text ?? "").match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { count: Number(match[1]), max: Number(match[2]) } : null;
  };
  for (const root of add2eSpellPrepCounterRoots(actor, clickedButton)) {
    for (const element of root.querySelectorAll?.(".a2e-spell-capacity-pill") ?? []) {
      const text = String(element.textContent ?? "").toLowerCase();
      if (!text.includes(label) || !text.includes(levelText)) continue;
      const ratio = readRatio(text);
      if (ratio) return ratio;
    }
  }
  return null;
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

function add2eSpellPrepArray(value) {
  if (Array.isArray(value)) return value.flatMap(add2eSpellPrepArray).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+|\bet\b/gi).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    const name = value.name ?? value.nom ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    const quantity = value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? null;
    if (name) return [quantity ? `${name} ×${quantity}` : String(name)];
  }
  return [String(value)];
}

function add2eSpellPrepIsOnlyComponentCode(value) {
  const text = String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}

function add2eSpellPrepMaterialComponents(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const values = [];
  for (const field of [
    system.composants_requis, system.composantsMateriels, system.composants_materiels,
    system.composantsMateriel, system.composant_materiel, system.composantMateriel,
    system.materiel, system.matériel, system.material, system.materialComponent,
    system.materialComponents, system.material_components, system.requiredComponents,
    system.componentsRequired, system.components?.material, system.components?.materials,
    flags.composants_requis, flags.components, flags.requiredComponents
  ]) values.push(...add2eSpellPrepArray(field));
  for (const tag of [...add2eSpellPrepArray(system.tags), ...add2eSpellPrepArray(system.effectTags), ...add2eSpellPrepArray(flags.tags), ...add2eSpellPrepArray(flags.effectTags)]) {
    const raw = String(tag ?? "").trim();
    if (/^composant[:_]/i.test(raw)) values.push(raw.replace(/^composant[:_]/i, ""));
  }
  return [...new Set(values.map(value => String(value ?? "").trim()).filter(value => value && !add2eSpellPrepIsOnlyComponentCode(value)))];
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
  add2eSpellPrepEnsureComponentStyle(root);
  for (const row of root.querySelectorAll?.("table.sort-table tbody tr") ?? []) {
    if (row.classList.contains("sort-description") || row.classList.contains("add2e-object-magic-power-row")) continue;
    const trigger = row.querySelector("[data-sort-id]") ?? row;
    const sort = add2eSpellPrepResolveSort(actor, trigger);
    if (!sort) continue;
    row.querySelector(".add2e-sort-components")?.remove();
    const components = add2eSpellPrepMaterialComponents(sort);
    if (!components.length) continue;
    const badge = document.createElement("span");
    badge.className = "add2e-sort-components";
    badge.textContent = `Composants : ${components.join(", ")}`;
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
    const entryKey = add2eSpellPrepNormalizeKey(button.dataset.entryKey || button.dataset.spellEntryKey || button.getAttribute("data-entry-key") || button.getAttribute("data-spell-entry-key"));
    const sort = add2eSpellPrepResolveSort(actor, button, entryKey);
    if (!sort) return ui.notifications.warn("Sort introuvable sur l’acteur après rafraîchissement de la feuille.");
    if (globalThis.add2eIsObjectMagicSpellForPreparation?.(sort)) return ui.notifications.warn("Ce pouvoir d’objet magique ne se prépare pas comme un sort.");

    const check = globalThis.add2eCanActorUseSpell?.(actor, sort);
    const entry = entryKey
      ? globalThis.add2eGetSpellcastingEntries?.(actor)?.find(candidate => add2eSpellPrepNormalizeKey(candidate.key) === entryKey)
      : check?.entry;
    if (!entry) return ui.notifications.warn("Type de préparation introuvable.");

    const spellLevel = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
    if (!check?.ok) return ui.notifications.warn(add2eSpellPrepAccessMessage(check, entry, spellLevel));

    const limit = Number(globalThis.add2eGetSlotsForEntryLevel?.(actor, entry, spellLevel) || 0);
    if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${spellLevel} disponible.`);

    const current = Number(globalThis.add2eGetMemorizedCountForEntry?.(sort, entry) || 0);
    const centralTotal = Number(globalThis.add2eCountPreparedForEntryLevel?.(actor, entry, spellLevel) || 0);
    const visibleRatio = add2eSpellPrepReadVisibleTotal(actor, entry, spellLevel, button);
    const isPlus = button.classList.contains("a2e-spell-entry-plus") || button.classList.contains("sort-memorize-plus");
    const isMinus = button.classList.contains("a2e-spell-entry-minus") || button.classList.contains("sort-memorize-minus");
    if (!isPlus && !isMinus) return;

    const totalBefore = isPlus && visibleRatio && visibleRatio.count < centralTotal ? visibleRatio.count : centralTotal;
    if (isPlus && totalBefore >= limit) {
      await add2eSpellPrepShowLimitDialog(entry, spellLevel, totalBefore, limit);
      return;
    }
    if (isMinus && current <= 0) return ui.notifications.warn(`Aucun sort ${entry.label} à retirer.`);

    const next = isPlus ? current + 1 : current - 1;
    const totalAfter = isPlus ? totalBefore + 1 : Math.max(0, totalBefore - 1);
    add2eSpellPrepSetRowCount(sort, next, button);
    add2eSpellPrepSetGlobalCounters(actor, entry, spellLevel, totalAfter, limit, button);
    await globalThis.add2eSetMemorizedCountForEntry?.(sort, entry, next);

    setTimeout(() => {
      for (const app of add2eSpellPrepActorWindows(actor)) app.render?.(false);
      add2eSpellPrepRestoreRepeated(snapshot);
    }, 120);
  } catch (error) {
    console.error("[ADD2E][SPELL_PREP][ERROR]", error);
    ui.notifications.error("Erreur pendant la mémorisation du sort.");
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
    if (row?.dataset?.spellName && !button.dataset.spellName) button.dataset.spellName = row.dataset.spellName;
    if (row?.dataset?.spellLevel && !button.dataset.spellLevel) button.dataset.spellLevel = row.dataset.spellLevel;
    if (parent?.dataset?.entryKey && !button.dataset.entryKey) button.dataset.entryKey = parent.dataset.entryKey;
    const resolved = add2eSpellPrepResolveSort(actor, button, add2eSpellPrepNormalizeKey(button.dataset.entryKey || button.dataset.spellEntryKey || ""));
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
