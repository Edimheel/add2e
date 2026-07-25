// ADD2E — Documents arcaniques : intégration Foundry et hooks.
// Compatible Foundry V13/V14/V15.

import {
  norm,
  itemType,
  isSpellbook,
  isScroll,
  documentEntries,
  listLabel
} from "./07b-arcane-documents-core.mjs";
import {
  responsibleGM,
  actorDead,
  actorHostile,
  detachPersonalSpellbooks,
  restorePersonalBookSync,
  syncActorSpellbooks,
  scheduleSync,
  copySpellbook,
  viewSpellbook,
  refreshSpellbookDialog
} from "./07b-arcane-spellbooks.mjs";
import { castScroll, scribeScroll } from "./07b-arcane-scrolls.mjs";

function applicationForElement(element) {
  const root = element?.closest?.(".application");
  if (!root) return null;
  return Object.values(ui.windows ?? {}).find(app => {
    const appElement = app?.element?.jquery ? app.element[0] : app?.element;
    return appElement === root || appElement?.contains?.(element);
  }) ?? null;
}

function actorForAction(element, application = null) {
  const actorId = String(element?.dataset?.actorId ?? "").trim();
  if (actorId) {
    const actor = game.actors?.get?.(actorId);
    if (actor?.documentName === "Actor") return actor;
  }

  for (const candidate of [application?.actor, application?.document, application?.object]) {
    if (candidate?.documentName === "Actor") return candidate;
  }
  return null;
}

function arcaneEntryRow(entry) {
  const row = document.createElement("div");
  row.className = "add2e-arcane-inline-entry";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "34px minmax(180px,1fr) 80px 150px";
  row.style.gap = "8px";
  row.style.alignItems = "center";
  row.style.padding = "5px 6px";
  row.style.borderBottom = "1px solid rgba(117,85,43,.25)";

  const image = document.createElement("img");
  image.src = String(entry?.img ?? "").trim() || "icons/svg/book.svg";
  image.alt = String(entry?.name ?? "Sort");
  image.style.width = "30px";
  image.style.height = "30px";
  image.style.objectFit = "cover";
  image.style.borderRadius = "4px";

  const name = document.createElement("b");
  name.textContent = String(entry?.name ?? "Sort inconnu");

  const level = document.createElement("span");
  level.textContent = `Niveau ${Number(entry?.level) || 1}`;

  const lists = document.createElement("span");
  lists.textContent = Array.from(entry?.lists ?? []).map(listLabel).join(" / ") || "Liste inconnue";

  row.append(image, name, level, lists);
  return row;
}

function toggleArcaneDocument(element, item) {
  const sourceRow = element?.closest?.("tr");
  if (!sourceRow?.parentElement) return false;

  const detailId = `add2e-arcane-inline-${item.id}`;
  const nextRow = sourceRow.nextElementSibling;
  if (nextRow?.dataset?.add2eArcaneInlineId === detailId) {
    nextRow.remove();
    return true;
  }

  sourceRow.parentElement
    .querySelectorAll?.(`[data-add2e-arcane-inline-id="${detailId}"]`)
    .forEach(row => row.remove());

  const detailRow = document.createElement("tr");
  detailRow.dataset.add2eArcaneInlineId = detailId;
  detailRow.className = "add2e-arcane-inline-row";

  const cell = document.createElement("td");
  cell.colSpan = Math.max(1, sourceRow.cells?.length ?? 1);
  cell.style.padding = "8px 12px";

  const panel = document.createElement("div");
  panel.className = "a2e-panel add2e-arcane-inline-panel";
  panel.style.boxShadow = "none";
  panel.style.margin = "0";

  const title = document.createElement("h3");
  title.textContent = isSpellbook(item) ? "Sorts inscrits dans le livre" : "Contenu du parchemin";
  panel.append(title);

  const body = document.createElement("div");
  body.className = "a2e-panel-body";
  const entries = documentEntries(item);

  if (entries.length) {
    for (const entry of entries) body.append(arcaneEntryRow(entry));
  } else {
    const empty = document.createElement("p");
    empty.className = "a2e-muted";
    empty.textContent = isSpellbook(item) ? "Aucun sort inscrit dans ce livre." : "Aucun sort inscrit sur ce parchemin.";
    body.append(empty);
  }

  panel.append(body);
  cell.append(panel);
  detailRow.append(cell);
  sourceRow.after(detailRow);
  return true;
}

async function handleAction(element) {
  const action = String(element?.dataset?.add2eArcaneAction ?? "");
  const itemId = String(element?.dataset?.itemId ?? "");
  const application = applicationForElement(element);
  const actor = actorForAction(element, application);

  if (!actor) {
    ui.notifications.warn("Acteur introuvable pour l’action arcanique.");
    return false;
  }
  if (action === "scribe-scroll") return scribeScroll(actor);

  const item = actor.items?.get?.(itemId) ?? null;
  if (!item) {
    ui.notifications.warn("Document arcanique introuvable.");
    return false;
  }

  if (action === "view-document") return toggleArcaneDocument(element, item);
  if (action === "view-book") return viewSpellbook(item, actor);
  if (action === "copy-book") return copySpellbook(actor, item);
  if (action === "copy-book-entry") {
    const copied = await copySpellbook(actor, item, element?.dataset?.spellKey ?? "");
    await refreshSpellbookDialog(application, item, actor);
    return copied;
  }
  if (action === "cast-scroll") return castScroll(actor, item);
  return false;
}

function installActionListener() {
  if (globalThis.__ADD2E_ARCANE_DOCUMENT_ACTION_LISTENER__) return;
  globalThis.__ADD2E_ARCANE_DOCUMENT_ACTION_LISTENER__ = true;

  document.addEventListener("click", event => {
    const element = event.target instanceof Element
      ? event.target.closest("[data-add2e-arcane-action]")
      : null;
    if (!element) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    void handleAction(element).catch(error => {
      console.error("[ADD2E][ARCANE_DOCUMENTS][ACTION_ERROR]", error);
      ui.notifications.error(error?.message || "Erreur pendant l’action arcanique.");
    });
  }, true);
}

function relevantItem(item) {
  return ["sort", "classe"].includes(itemType(item))
    || isSpellbook(item)
    || isScroll(item)
    || norm(item?.name).startsWith("parchemin");
}

async function handleActorMortality(actor, options = {}) {
  if (!actor || options?.add2eArcaneLootDetach || !responsibleGM()) return;
  if (actorDead(actor) && actorHostile(actor)) {
    await detachPersonalSpellbooks(actor, { reason: "hostile-death" });
    return;
  }
  if (!actorDead(actor) && actor.getFlag?.("add2e", "arcaneBooksDetachedForLoot") === true) {
    await restorePersonalBookSync(actor, { reason: "hostile-restored" });
  }
}

export function installArcaneDocumentRuntime() {
  Hooks.on("createItem", (item, _options, userId) => {
    if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
    const actor = item?.parent;
    if (actor?.documentName !== "Actor" || actor.type !== "personnage" || !relevantItem(item)) return;
    scheduleSync(actor, "create-item");
  });

  Hooks.on("updateItem", (item, _changes, options, userId) => {
    if (options?.add2eArcaneSync || String(userId ?? "") !== String(game.user?.id ?? "")) return;
    const actor = item?.parent;
    if (actor?.documentName !== "Actor" || actor.type !== "personnage" || !relevantItem(item)) return;
    scheduleSync(actor, "update-item");
  });

  Hooks.on("deleteItem", (item, options, userId) => {
    if (options?.add2eArcaneSync || String(userId ?? "") !== String(game.user?.id ?? "")) return;
    const actor = item?.parent;
    if (actor?.documentName !== "Actor" || actor.type !== "personnage" || !relevantItem(item)) return;
    scheduleSync(actor, "delete-item");
  });

  Hooks.on("createActor", (actor, _options, userId) => {
    if (String(userId ?? "") !== String(game.user?.id ?? "") || actor?.type !== "personnage") return;
    scheduleSync(actor, "create-actor");
  });

  Hooks.on("updateActor", (actor, _changes, options) => {
    void handleActorMortality(actor, options).catch(error => {
      console.error("[ADD2E][ARCANE_DOCUMENTS][MORTALITY_ERROR]", { actor: actor?.name, error });
    });
  });

  for (const hookName of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hookName, (effect, _changes, options) => {
      const actor = effect?.parent?.documentName === "Actor" ? effect.parent : null;
      if (!actor) return;
      void handleActorMortality(actor, options ?? {}).catch(error => {
        console.error("[ADD2E][ARCANE_DOCUMENTS][MORTALITY_EFFECT_ERROR]", { actor: actor?.name, error });
      });
    });
  }

  Hooks.once("ready", async () => {
    installActionListener();
    if (!responsibleGM()) return;

    for (const actor of game.actors?.contents ?? []) {
      if (actor.type !== "personnage") continue;
      try {
        if (actorDead(actor) && actorHostile(actor)) {
          await detachPersonalSpellbooks(actor, { reason: "ready-hostile-death-migration" });
        } else {
          await syncActorSpellbooks(actor, { reason: "ready-migration" });
        }
      } catch (error) {
        console.error("[ADD2E][ARCANE_DOCUMENTS][READY_ERROR]", { actor: actor.name, error });
      }
    }
  });
}
