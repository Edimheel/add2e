// ADD2E — Lumières dansantes — Illusionniste
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l’API commune ADD2E.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

return await (async () => {
  const VERSION = "2026-08-13-illusionist-dancing-lights-v2";
  const SPELL_KEY = "lumieres_dansantes";

  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications?.error?.("Lumières dansantes : l’API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Lumières dansantes : les constructeurs communs de cartes ADD2E sont indisponibles.");
    return false;
  }
  if (typeof globalThis.add2eGetSpellListsFromItem !== "function" || typeof globalThis.add2eCanActorUseSpell !== "function") {
    ui.notifications?.error?.("Lumières dansantes : les règles canoniques de lancement des sorts sont indisponibles.");
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

  const spellLists = globalThis.add2eGetSpellListsFromItem(sourceItem);
  const listKeys = (Array.isArray(spellLists) ? spellLists : [])
    .map(value => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  const isObjectPower = sourceItem.system?.isObjectPower === true;
  if (!isObjectPower && !listKeys.includes("illusionniste")) {
    ui.notifications?.error?.("Lumières dansantes : cet Item n’appartient pas à la liste Illusionniste.");
    return false;
  }

  let casterLevel = null;
  if (isObjectPower) {
    const explicit = Number(sourceItem.system?.casterLevel);
    if (!Number.isInteger(explicit) || explicit < 1) {
      ui.notifications?.error?.("Lumières dansantes : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      return false;
    }
    casterLevel = explicit;
  } else {
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    const resolvedLevel = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(resolvedLevel) || resolvedLevel < 1) {
      ui.notifications?.error?.(`Lumières dansantes : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
      return false;
    }
    casterLevel = resolvedLevel;
  }

  const parseRangeInches = raw => {
    const text = String(raw ?? "")
      .trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/pouces?/g, "\"")
      .replace(/''/g, "\"");
    const baseMatch = text.match(/(^|\s)(\d+(?:[.,]\d+)?)\s*"/);
    const perLevelMatch = text.match(/\+\s*(\d+(?:[.,]\d+)?)\s*"\s*\/\s*(?:niveau|level)/);
    const base = baseMatch ? Number(baseMatch[2].replace(",", ".")) : NaN;
    const perLevel = perLevelMatch ? Number(perLevelMatch[1].replace(",", ".")) : NaN;
    if (!Number.isFinite(base) || !Number.isFinite(perLevel)) return null;
    return {
      base,
      perLevel,
      total: base + (perLevel * casterLevel),
      raw: String(raw ?? "")
    };
  };

  const parseDurationRounds = raw => {
    const text = String(raw ?? "")
      .trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const perLevel = text.match(/(\d+(?:[.,]\d+)?)\s*rounds?\s*\/\s*(?:niveau|level)/);
    if (!perLevel) return null;
    const factor = Number(perLevel[1].replace(",", "."));
    return Number.isFinite(factor) && factor > 0 ? Math.max(1, Math.floor(factor * casterLevel)) : null;
  };

  const range = parseRangeInches(sourceItem.system?.portee ?? sourceItem.system?.range);
  if (!range) {
    ui.notifications?.error?.(`Lumières dansantes : portée illisible dans l’Item (${sourceItem.system?.portee ?? sourceItem.system?.range ?? "absente"}).`);
    return false;
  }
  const durationRounds = parseDurationRounds(sourceItem.system?.duree ?? sourceItem.system?.duration);
  if (!Number.isInteger(durationRounds) || durationRounds < 1) {
    ui.notifications?.error?.(`Lumières dansantes : durée illisible dans l’Item (${sourceItem.system?.duree ?? sourceItem.system?.duration ?? "absente"}).`);
    return false;
  }

  const choice = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-dancing-lights-dialog"],
    window: { title: sourceItem.name ?? "Lumières dansantes" },
    content: `
      <form class="add2e-dancing-lights-form">
        <p>Créez de 1 à 4 lumières mobiles. Elles restent sous votre contrôle tant que vous vous concentrez et que la portée n’est pas dépassée.</p>
        <div class="form-group">
          <label>Nombre de lumières</label>
          <select name="count">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
        <div class="form-group">
          <label>Forme</label>
          <select name="form">
            <option value="torches">Torches / lanternes</option>
            <option value="spheres">Sphères brillantes</option>
            <option value="humanoide">Forme lumineuse humanoïde</option>
          </select>
        </div>
        <div class="form-group">
          <label>Déplacement / disposition initiale</label>
          <textarea name="note" rows="3" placeholder="Facultatif"></textarea>
        </div>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Créer les lumières",
        icon: "<i class='fas fa-lightbulb'></i>",
        default: true,
        callback: (_event, button) => ({
          count: Math.max(1, Math.min(4, Number(button?.form?.elements?.count?.value) || 1)),
          form: String(button?.form?.elements?.form?.value ?? "torches"),
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

  const labels = {
    torches: "Torches / lanternes",
    spheres: "Sphères brillantes",
    humanoide: "Forme lumineuse humanoïde"
  };
  const formLabel = labels[choice.form] ?? labels.torches;

  const durationData = rounds => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    if (typeof time?.durationData === "function") return time.durationData(rounds, { unit: "round" });
    return {
      rounds,
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  };

  const tags = [
    `sort:${SPELL_KEY}`,
    "classe:illusionniste",
    "liste:illusionniste",
    `niveau:${Number(sourceItem.system?.niveau ?? 1) || 1}`,
    "lumiere",
    "lumieres:dansantes",
    "concentration",
    "duree:round"
  ];
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const extraFlags = {
    spellName: sourceItem.name ?? "Lumières dansantes",
    spellKey: SPELL_KEY,
    sourceItemUuid: sourceItem.uuid ?? null,
    casterId: caster.id,
    casterUuid: caster.uuid,
    casterLevel,
    listKey: "illusionniste",
    lightCount: choice.count,
    lightForm: choice.form,
    rangeInches: range.total,
    concentration: true,
    note: choice.note,
    tags,
    version: VERSION
  };
  const managedFlags = typeof time?.flags === "function"
    ? time.flags({
        source: "illusionniste-lumieres-dansantes.js",
        rounds: durationRounds,
        unit: "round",
        endMessage: "Les Lumières dansantes de {actor} s’éteignent.",
        extra: extraFlags
      })
    : {
        timeEngine: { managed: true, unit: "round", totalRounds: durationRounds },
        roundEngine: { managed: true, unit: "round", totalRounds: durationRounds, endMessage: "Les Lumières dansantes de {actor} s’éteignent." },
        endMessage: "Les Lumières dansantes de {actor} s’éteignent.",
        ...extraFlags
      };

  const previousIds = Array.from(caster.effects ?? [])
    .filter(effect => {
      const effectTags = Array.isArray(effect.flags?.add2e?.tags) ? effect.flags.add2e.tags : [];
      return effectTags.some(tag => String(tag).toLowerCase() === `sort:${SPELL_KEY}`);
    })
    .map(effect => effect.id)
    .filter(Boolean);
  if (previousIds.length) {
    await caster.deleteEmbeddedDocuments("ActiveEffect", previousIds, {
      add2eReason: "replace-dancing-lights",
      add2eInternal: true
    });
  }

  await caster.createEmbeddedDocuments("ActiveEffect", [{
    name: sourceItem.name ?? "Lumières dansantes",
    img: sourceItem.img ?? "icons/svg/light.svg",
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration: durationData(durationRounds),
    description: `${choice.count} lumière(s) — ${formLabel}. Concentration requise ; la portée maximale est ${range.total}\".`,
    flags: { add2e: { ...managedFlags, tags } },
    changes: []
  }]);

  const rows = [
    { label: "Liste", value: "Illusionniste" },
    { label: "Niveau de lanceur", value: String(casterLevel) },
    { label: "Lumières", value: String(choice.count) },
    { label: "Forme", value: formLabel },
    { label: "Portée maximale", value: `${range.total}\" (${range.base}\" + ${range.perLevel}\"/niveau)` },
    { label: "Durée", value: `${durationRounds} rounds` },
    { label: "Concentration", value: "Requise pour les déplacements" }
  ];
  if (choice.note) rows.push({ label: "Disposition", value: choice.note });

  const card = {
    actor: caster,
    title: sourceItem.name ?? "Lumières dansantes",
    icon: "fas fa-lightbulb",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img ?? caster.img,
      type: isObjectPower ? "Pouvoir d’objet magique" : "Sort d’illusionniste",
      meta: `Niveau ${Number(sourceItem.system?.niveau ?? 1) || 1}`
    },
    rows,
    message: "Les lumières dansantes sont actives. Elles peuvent avancer, reculer ou tourner selon la volonté du lanceur tant qu’il se concentre ; elles s’éteignent si la portée ou la durée est dépassée.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "dancing-lights",
          spellKey: SPELL_KEY,
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel,
          spellLists,
          lightCount: choice.count,
          lightForm: choice.form,
          rangeInches: range.total,
          durationRounds,
          concentration: true,
          version: VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Lumières dansantes : carte de chat vide.");
  await globalThis.add2eCreateChatCard(card);
  return true;
})();