// ADD2E — Lumières dansantes
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l’API commune ADD2E.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eDancingLightsResult = await (async () => {
  const VERSION = "2026-08-12-canonical-dancing-lights-v4";

  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications?.error?.("Lumières dansantes : l’API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Lumières dansantes : les constructeurs communs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem || String(sourceItem.type ?? "").toLowerCase() !== "sort") {
    ui.notifications?.error?.("Lumières dansantes : Item sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.("Lumières dansantes : lanceur introuvable.");
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;

  const resolveCasterLevel = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Lumières dansantes : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }
    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("Lumières dansantes : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(caster, sourceItem);
    const actorLevel = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(actorLevel) || actorLevel < 1) {
      throw new Error(`Lumières dansantes : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return actorLevel;
  };

  const casterLevel = resolveCasterLevel();
  const listResolver = globalThis.add2eGetSpellListsFromItem;
  if (typeof listResolver !== "function") {
    throw new Error("Lumières dansantes : le résolveur canonique des listes de sorts est indisponible.");
  }
  const spellLists = listResolver(sourceItem);
  if (!Array.isArray(spellLists) || !spellLists.length) {
    throw new Error("Lumières dansantes : aucune liste de sorts canonique n’est définie.");
  }

  const choice = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-dancing-lights-dialog"],
    window: { title: sourceItem.name ?? "Lumières dansantes" },
    modal: true,
    rejectClose: false,
    content: `
      <form class="add2e-dancing-lights-form">
        <p>Indique éventuellement la forme, la disposition ou le déplacement souhaité pour les lumières.</p>
        <div class="form-group">
          <label>Note / paramètres</label>
          <textarea name="note" rows="3"></textarea>
        </div>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-wand-magic-sparkles'></i>",
        default: true,
        callback: (_event, button) => ({
          note: String(button?.form?.elements?.note?.value ?? "").trim()
        })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
  if (!choice) return false;

  const description = String(sourceItem.system?.description ?? "").trim();
  const targetNames = Array.from(game.user?.targets ?? []).map(target => target?.name).filter(Boolean);
  const rows = [
    { label: "Liste", value: spellLists.join(" / ") },
    { label: "Niveau de lanceur", value: String(casterLevel) }
  ];
  if (choice.note) rows.push({ label: "Note", value: choice.note });

  const card = {
    actor: caster,
    title: sourceItem.name ?? "Lumières dansantes",
    icon: "fas fa-lightbulb",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img ?? caster.img,
      type: "Sort profane",
      meta: spellLists.join(" / ")
    },
    ...(targetNames.length ? {
      target: {
        name: targetNames.join(", "),
        img: null,
        type: "Cible(s) sélectionnée(s)",
        meta: ""
      }
    } : {}),
    rows,
    message: description || "Lumières dansantes est lancé ; le déplacement des lumières reste sous le contrôle du lanceur selon la description du sort.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "dancing-lights",
          version: VERSION,
          sourceItemUuid: sourceItem.uuid,
          casterLevel,
          spellLists,
          note: choice.note
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Lumières dansantes : carte de chat vide.");
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2eDancingLightsResult === true ? true : false;