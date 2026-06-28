// ADD2E — Validation hooks et compatibilité legacy.

const ADD2E_FAMILIAR_HP_BRIDGE_VERSION = "2026-06-28-familiar-hp-bridge-v1";
globalThis.ADD2E_FAMILIAR_HP_BRIDGE_VERSION = ADD2E_FAMILIAR_HP_BRIDGE_VERSION;

if (!globalThis.__ADD2E_FAMILIAR_HP_BRIDGE_REGISTERED__) {
  globalThis.__ADD2E_FAMILIAR_HP_BRIDGE_REGISTERED__ = true;

  // 13c a déjà converti l'état du familier vers le registre générique
  // flags.add2e.hpModifiers. Ce second hook s'exécute ensuite et applique
  // le delta identique aux PV max et courants, y compris au départ.
  Hooks.on("preUpdateActor", (actor, changes = {}, options = {}) => {
    if (options?.add2eFamiliarHpShare !== true) return;

    const read = (source, path) => Object.prototype.hasOwnProperty.call(source ?? {}, path)
      ? source[path]
      : foundry?.utils?.getProperty?.(source ?? {}, path);
    const number = (value, fallback = 0) => {
      const result = Number(value);
      return Number.isFinite(result) ? result : fallback;
    };
    const before = actor?.getFlag?.("add2e", "familiarHpShare") ?? actor?.flags?.add2e?.familiarHpShare ?? null;
    const after = read(changes, "flags.add2e.familiarHpShare");
    const linkId = String(after?.linkId ?? before?.linkId ?? "").trim();
    if (!linkId || !after || typeof after !== "object") return;

    const previous = String(before?.linkId ?? "") === linkId ? Math.max(0, Math.floor(number(before?.amount, 0))) : 0;
    const desired = Math.max(0, Math.floor(number(after?.amount, 0)));
    const delta = desired - previous;
    const max = number(actor?.system?.points_de_coup, NaN);
    const current = number(actor?.system?.pdv, NaN);

    if (Number.isFinite(max)) changes["system.points_de_coup"] = Math.max(1, max + delta);
    if (Number.isFinite(current)) changes["system.pdv"] = current + delta;
  });
}

Hooks.once("ready", () => {
  add2eRegisterClassItemSheet();

  const clearClassSheetCache = (item) => {
    if (!item || item.type !== "classe") return;

    if (item._sheet && !(item._sheet instanceof Add2eItemSheet)) {
      console.warn("[ADD2E][SHEETS] Cache de fiche classe incorrect vidé", {
        item: item.name,
        cachedSheet: item._sheet?.constructor?.name,
        expected: Add2eItemSheet?.name
      });
      item._sheet = null;
    }
  };

  for (const item of game.items ?? []) clearClassSheetCache(item);

  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) clearClassSheetCache(item);
  }

  console.log("[ADD2E][SHEETS] Contrôle Item.classe", {
    importedClassSheet: Add2eItemSheet?.name,
    exampleWorldClassSheet: game.items.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null,
    exampleEmbeddedClassSheet: game.actors.find(a => a.items?.some(i => i.type === "classe"))?.items?.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null
  });
});

Hooks.on("preCreateItem", (itemData, options, userId) => {
  if (itemData.type === "sort" && Array.isArray(itemData.effects)) {
    for (const eff of itemData.effects) {
      eff.transfer = false;
      eff.disabled = true;
    }
  }
});

async function rollInitiativeD6(combatants) {
  if (!combatants.length) return;

  for (const comb of combatants) {
    const roll = await new Roll("1d6").evaluate({ async: true });

    if (comb.actor) await comb.actor.update({ "system.initiative": roll.total });
    await comb.update({ initiative: roll.total });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: comb.actor }),
      content: `Initiative : <b>${roll.total}</b> (1d6)`,
      flavor: "Initiative"
    });
  }
}

function add2eEffectExplicitlyLinkedToItem(effect, item) {
  if (!effect || !item) return false;
  const origin = String(effect.origin ?? "");
  const flags = effect.flags?.add2e ?? {};
  const itemId = String(item.id ?? "");
  const itemUuid = String(item.uuid ?? "");
  const sourceId = String(flags.sourceItemId ?? flags.sourceClassId ?? flags.sourceId ?? "");
  const sourceUuid = String(flags.sourceItemUuid ?? flags.sourceClassUuid ?? flags.sourceUuid ?? "");

  return (itemUuid && origin === itemUuid)
    || (itemId && origin.endsWith(`.${itemId}`))
    || (itemId && sourceId === itemId)
    || (itemUuid && sourceUuid === itemUuid);
}

Hooks.on("deleteItem", async (item, options = {}, userId) => {
  // Les opérations multiclasses suppriment elles-mêmes les effets source-liés
  // avant l'Item classe. Ce hook legacy ne doit jamais rejouer cette purge.
  if (options?.add2eInternal || options?.add2eMulticlassInternal || options?.add2eClassPurge) return;
  if (game.user.id !== userId) return;
  if (!item.parent || item.parent.documentName !== "Actor") return;

  const actor = item.parent;
  const effectsToDelete = Array.from(actor.effects ?? [])
    .filter(effect => add2eEffectExplicitlyLinkedToItem(effect, item))
    .map(effect => effect.id)
    .filter(id => actor.effects?.has?.(id));

  if (!effectsToDelete.length) return;

  try {
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete, {
      add2eInternal: true,
      add2eReason: "legacy-item-effect-cleanup"
    });
    ui.notifications.info(`Les effets de ${item.name} se sont dissipés.`);
  } catch (error) {
    // Une autre purge légitime peut avoir supprimé l'effet entre la lecture et
    // l'écriture. Dans ce cas, il n'y a rien à annuler ni à signaler au joueur.
    if (!/ActiveEffect .* does not exist|does not exist/i.test(String(error?.message ?? error))) throw error;
  }
});

try { globalThis.rollInitiativeD6 = rollInitiativeD6; } catch (_e) {}