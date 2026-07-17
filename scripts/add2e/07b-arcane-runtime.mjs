// ADD2E — Documents arcaniques : intégration Foundry et hooks.
import {
  norm,
  itemType,
  isSpellbook,
  isScroll
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
  viewSpellbook
} from "./07b-arcane-spellbooks.mjs";
import { castScroll } from "./07b-arcane-scrolls.mjs";

function applicationForElement(element) {
  const root = element?.closest?.(".application");
  if (!root) return null;
  return Object.values(ui.windows ?? {}).find(app => {
    const appElement = app?.element?.jquery ? app.element[0] : app?.element;
    return appElement === root || appElement?.contains?.(element);
  }) ?? null;
}

async function handleAction(element) {
  const action = String(element?.dataset?.add2eArcaneAction ?? "");
  const itemId = String(element?.dataset?.itemId ?? "");
  const application = applicationForElement(element);
  const actor = application?.actor ?? application?.document ?? game.actors?.get?.(element?.dataset?.actorId) ?? null;
  const item = actor?.items?.get?.(itemId) ?? null;
  if (!actor || !item) {
    ui.notifications.warn("Document arcanique introuvable.");
    return false;
  }
  application?._add2eRememberActiveTab?.();
  if (action === "view-book") return viewSpellbook(item, actor);
  if (action === "copy-book") return copySpellbook(actor, item);
  if (action === "copy-book-entry") return copySpellbook(actor, item, element?.dataset?.spellKey ?? "");
  if (action === "cast-scroll") return castScroll(actor, item);
  return false;
}

function installActionListener() {
  if (globalThis.__ADD2E_ARCANE_DOCUMENT_ACTION_LISTENER__) return;
  globalThis.__ADD2E_ARCANE_DOCUMENT_ACTION_LISTENER__ = true;
  document.addEventListener("click", event => {
    const element = event.target instanceof Element ? event.target.closest("[data-add2e-arcane-action]") : null;
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
  return ["sort", "classe"].includes(itemType(item)) || isSpellbook(item) || isScroll(item) || norm(item?.name).startsWith("parchemin");
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
    void handleActorMortality(actor, options).catch(error => console.error("[ADD2E][ARCANE_DOCUMENTS][MORTALITY_ERROR]", { actor: actor?.name, error }));
  });

  for (const hookName of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hookName, (effect, _changes, options) => {
      const actor = effect?.parent?.documentName === "Actor" ? effect.parent : null;
      if (!actor) return;
      void handleActorMortality(actor, options ?? {}).catch(error => console.error("[ADD2E][ARCANE_DOCUMENTS][MORTALITY_EFFECT_ERROR]", { actor: actor?.name, error }));
    });
  }

  Hooks.once("ready", async () => {
    installActionListener();
    if (!responsibleGM()) return;
    for (const actor of game.actors?.contents ?? []) {
      if (actor.type !== "personnage") continue;
      try {
        if (actorDead(actor) && actorHostile(actor)) await detachPersonalSpellbooks(actor, { reason: "ready-hostile-death-migration" });
        else await syncActorSpellbooks(actor, { reason: "ready-migration" });
      } catch (error) {
        console.error("[ADD2E][ARCANE_DOCUMENTS][READY_ERROR]", { actor: actor.name, error });
      }
    }
  });
}
