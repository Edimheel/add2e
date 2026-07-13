// ADD2E — Actor sheet listeners : sorts, mémorisation, pouvoirs d'objets et parchemins.

let ADD2E_SCROLL_SPELL_INDEX_PROMISE = null;

function add2eScrollNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eScrollEsc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eScrollArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eScrollArray);
  if (value instanceof Set) return [...value].flatMap(add2eScrollArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["lists", "spellLists", "classes", "classe", "class", "items", "value", "values"]) {
      if (value[key] !== undefined) return add2eScrollArray(value[key]);
    }
  }
  return [value];
}

function add2eScrollListKey(value) {
  try {
    if (typeof globalThis.add2eNormalizeSpellKey === "function") return globalThis.add2eNormalizeSpellKey(value);
  } catch (_error) {}
  const key = add2eScrollNorm(value);
  return ({ wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien", illusionist: "illusionniste" })[key] ?? key;
}

function add2eScrollItemType(item) {
  return String(item?.type ?? "").toLowerCase();
}

function add2eScrollSpellLevel(item) {
  return Math.max(1, Number(item?.system?.niveau ?? item?.system?.level ?? item?.niveau ?? item?.level ?? 1) || 1);
}

function add2eScrollSpellLists(item) {
  try {
    if (typeof globalThis.add2eGetSpellListsFromItem === "function") {
      return [...new Set(globalThis.add2eGetSpellListsFromItem(item).map(add2eScrollListKey).filter(Boolean))];
    }
  } catch (_error) {}
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [...new Set([
    flags.knownSpellLists,
    flags.learnedSpellLists,
    flags.grantedSpellLists,
    system.spellLists,
    system.lists,
    system.liste,
    system.liste_sort,
    system.listeSort,
    system.classe,
    system.class
  ].flatMap(add2eScrollArray).map(add2eScrollListKey).filter(Boolean))];
}

function add2eScrollActorLists(actor) {
  const lists = new Set();
  try {
    for (const entry of globalThis.add2eGetSpellcastingEntries?.(actor) ?? []) {
      const key = add2eScrollListKey(entry?.key);
      if (["magicien", "illusionniste"].includes(key)) lists.add(key);
    }
  } catch (_error) {}
  for (const item of actor?.items ?? []) {
    if (add2eScrollItemType(item) !== "classe") continue;
    const system = item.system ?? {};
    for (const value of [item.name, system.slug, system.label, system.nom, system.name]) {
      const key = add2eScrollListKey(value);
      if (["magicien", "illusionniste"].includes(key)) lists.add(key);
    }
  }
  return [...lists];
}

function add2eScrollDocumentEntries(scroll) {
  try {
    const entries = globalThis.ADD2E_ARCANE_DOCUMENTS?.documentEntries?.(scroll);
    if (Array.isArray(entries)) return entries;
  } catch (_error) {}
  const document = scroll?.system?.arcaneDocument ?? {};
  const fallbackList = add2eScrollListKey(document.ownerList ?? document.spellList ?? "");
  const source = Array.isArray(document.spells) ? document.spells : document.spell ? [document.spell] : [];
  return source.map(entry => {
    const name = String(entry?.name ?? entry?.nom ?? entry?.label ?? "").trim();
    if (!name) return null;
    const level = Math.max(1, Number(entry?.level ?? entry?.niveau ?? entry?.spellLevel ?? 1) || 1);
    const lists = [...new Set([
      entry?.lists,
      entry?.spellLists,
      entry?.classes,
      entry?.classe,
      entry?.class,
      fallbackList
    ].flatMap(add2eScrollArray).map(add2eScrollListKey).filter(Boolean))];
    return {
      key: String(entry?.key ?? entry?.stableKey ?? entry?.spellKey ?? "").trim() || `${lists[0] ?? "sort"}|${level}|${add2eScrollNorm(name)}`,
      name,
      level,
      lists,
      sourceUuid: String(entry?.sourceUuid ?? entry?.uuid ?? entry?.sourceId ?? "").trim(),
      img: String(entry?.img ?? entry?.image ?? scroll?.img ?? "icons/svg/book.svg")
    };
  }).filter(Boolean);
}

function add2eScrollIsKnownSpell(item) {
  if (add2eScrollItemType(item) !== "sort") return false;
  if (item.system?.isPower === true || item.system?.isObjectPower === true) return false;
  if (item.system?.isCapacity === true || item.flags?.add2e?.spellFamily?.generated === true) return false;
  return true;
}

function add2eScrollActorKnows(actor, entry, list) {
  const wanted = add2eScrollListKey(list);
  return Array.from(actor?.items ?? []).some(item =>
    add2eScrollIsKnownSpell(item)
    && add2eScrollSpellLevel(item) === Number(entry?.level ?? 1)
    && add2eScrollNorm(item.name) === add2eScrollNorm(entry?.name)
    && add2eScrollSpellLists(item).includes(wanted)
  );
}

function add2eScrollQuantity(item) {
  const value = item?.system?.quantite ?? item?.system?.quantity;
  if (value === undefined || value === null || value === "") return 1;
  return Math.max(0, Math.floor(Number(value) || 0));
}

function add2eScrollCombatStarted() {
  return game.combat?.started === true;
}

function add2ePrepareArcaneScrollRows(actor) {
  const actorLists = add2eScrollActorLists(actor);
  const rows = [];
  for (const scroll of actor?.items ?? []) {
    if (add2eScrollItemType(scroll) !== "objet") continue;
    if (String(scroll.system?.arcaneDocument?.kind ?? scroll.flags?.add2e?.arcaneDocumentKind ?? "").toLowerCase() !== "spell-scroll") continue;
    const quantity = add2eScrollQuantity(scroll);
    if (quantity <= 0) continue;
    for (const entry of add2eScrollDocumentEntries(scroll)) {
      const compatibleLists = entry.lists.filter(list => actorLists.includes(add2eScrollListKey(list)));
      const unknownLists = compatibleLists.filter(list => !add2eScrollActorKnows(actor, entry, list));
      rows.push({
        rowId: `${scroll.id}-${add2eScrollNorm(entry.key)}`,
        itemId: scroll.id,
        spellKey: entry.key,
        name: entry.name,
        level: entry.level,
        img: entry.img || scroll.img,
        scrollName: scroll.name,
        quantity,
        listLabel: entry.lists.map(list => list === "illusionniste" ? "Illusionniste" : list === "magicien" ? "Magicien" : list).join(" / ") || "Liste inconnue",
        canCast: compatibleLists.length > 0,
        canWrite: unknownLists.length > 0,
        alreadyKnown: compatibleLists.length > 0 && unknownLists.length === 0,
        writeBlockedCombat: add2eScrollCombatStarted()
      });
    }
  }
  return rows.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, "fr"));
}

function add2eInstallArcaneScrollSheetDataPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eArcaneScrollSheetDataV1 || typeof proto.getData !== "function") return false;
  proto.__add2eArcaneScrollSheetDataV1 = true;
  const originalGetData = proto.getData;
  proto.getData = async function add2eArcaneScrollGetData(...args) {
    const data = await originalGetData.apply(this, args);
    const rows = add2ePrepareArcaneScrollRows(this.actor ?? data?.actor);
    data.add2eArcaneScrollRows = rows;
    data.add2eArcaneScrollQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    return data;
  };
  return true;
}

async function add2eScrollBuildSpellIndex() {
  if (ADD2E_SCROLL_SPELL_INDEX_PROMISE) return ADD2E_SCROLL_SPELL_INDEX_PROMISE;
  ADD2E_SCROLL_SPELL_INDEX_PROMISE = (async () => {
    const candidates = [];
    for (const id of ["add2e.sorts", "world.sorts"]) {
      const pack = game.packs?.get?.(id);
      if (pack?.documentName !== "Item") continue;
      let index;
      try {
        index = await pack.getIndex({ fields: ["name", "type", "system.niveau", "system.level", "system.spellLists", "system.liste", "system.classe"] });
      } catch (_error) {
        index = await pack.getIndex();
      }
      const entries = Array.isArray(index?.contents) ? index.contents : typeof index?.values === "function" ? [...index.values()] : [...(index ?? [])];
      for (const entry of entries) {
        if (add2eScrollItemType(entry) !== "sort") continue;
        candidates.push({ pack, id: entry._id, name: entry.name, level: add2eScrollSpellLevel(entry), lists: add2eScrollSpellLists(entry) });
      }
    }
    return candidates;
  })();
  return ADD2E_SCROLL_SPELL_INDEX_PROMISE;
}

async function add2eResolveScrollSpell(entry) {
  const sourceUuid = String(entry?.sourceUuid ?? "").trim();
  if (sourceUuid.startsWith("Compendium.") && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(sourceUuid);
      if (document?.documentName === "Item" && add2eScrollItemType(document) === "sort") return document;
    } catch (_error) {}
  }
  const wantedName = add2eScrollNorm(entry?.name);
  const wantedLevel = Math.max(1, Number(entry?.level ?? 1) || 1);
  const wantedLists = (entry?.lists ?? []).map(add2eScrollListKey).filter(Boolean);
  const candidates = (await add2eScrollBuildSpellIndex()).filter(candidate => add2eScrollNorm(candidate.name) === wantedName && candidate.level === wantedLevel);
  const selected = candidates.find(candidate => !wantedLists.length || wantedLists.some(list => candidate.lists.includes(list))) ?? candidates[0] ?? null;
  return selected ? selected.pack.getDocument(selected.id) : null;
}

function add2eScrollCleanEmbedded(source) {
  const data = foundry.utils.deepClone(source ?? {});
  delete data._id;
  delete data._stats;
  delete data.folder;
  delete data.ownership;
  delete data.sort;
  for (const effect of data.effects ?? []) {
    delete effect._id;
    delete effect._stats;
    delete effect.folder;
    delete effect.sort;
  }
  return data;
}

function add2eScrollIntelligence(actor) {
  const system = actor?.system ?? {};
  const direct = Number(system.intelligence ?? system.intelligence_total ?? system.intelligenceTotal);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  return Math.floor((Number(system.intelligence_base) || 10) + (Number(system.intelligence_race) || 0) + (Number(system.bonus_caracteristiques?.intelligence) || 0));
}

function add2eScrollLearningChance(actor) {
  const intelligence = Math.max(3, Math.min(18, add2eScrollIntelligence(actor)));
  const tableChance = Number(globalThis.INTELLIGENCE_TABLE?.[intelligence]?.chance_sort);
  if (Number.isFinite(tableChance)) return Math.max(0, Math.min(100, tableChance));
  return ({ 9: 35, 10: 45, 11: 45, 12: 45, 13: 55, 14: 55, 15: 65, 16: 65, 17: 75, 18: 85 })[intelligence] ?? 0;
}

async function add2eLearnSpellFromScroll(actor, scroll, entry, sourceDocument, lists, roll, chance) {
  const allowedLists = [...new Set(lists.map(add2eScrollListKey).filter(list => ["magicien", "illusionniste"].includes(list)))];
  let existing = Array.from(actor.items ?? []).find(item =>
    add2eScrollIsKnownSpell(item)
    && add2eScrollSpellLevel(item) === entry.level
    && add2eScrollNorm(item.name) === add2eScrollNorm(entry.name)
  ) ?? null;
  if (existing) {
    const mergedLists = [...new Set([...add2eScrollSpellLists(existing), ...allowedLists])];
    await existing.update({
      "system.spellLists": mergedLists,
      "flags.add2e.learnedSpellLists": mergedLists,
      "flags.add2e.knownSpellLists": mergedLists,
      "flags.add2e.manuallyLearnedSpell": true,
      "flags.add2e.lastLearnedSpellList": allowedLists[0] ?? mergedLists[0] ?? "",
      "flags.add2e.learnedFromScrollUuid": scroll.uuid,
      "flags.add2e.learnedFromScrollName": scroll.name,
      "flags.add2e.scrollCopyRoll": roll,
      "flags.add2e.scrollCopyChance": chance
    }, { add2eInternal: true, add2eArcaneCopy: true, render: false });
    return existing;
  }
  const data = add2eScrollCleanEmbedded(sourceDocument.toObject());
  data.system ??= {};
  data.flags ??= {};
  data.flags.core ??= {};
  data.flags.add2e ??= {};
  data.system.spellLists = allowedLists;
  data.flags.core.sourceId = sourceDocument.uuid;
  data.flags.add2e.learnedSpellLists = allowedLists;
  data.flags.add2e.knownSpellLists = allowedLists;
  data.flags.add2e.manuallyLearnedSpell = true;
  data.flags.add2e.lastLearnedSpellList = allowedLists[0] ?? "";
  data.flags.add2e.learnedFromScrollUuid = scroll.uuid;
  data.flags.add2e.learnedFromScrollName = scroll.name;
  data.flags.add2e.scrollCopyRoll = roll;
  data.flags.add2e.scrollCopyChance = chance;
  const [created] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true, add2eArcaneCopy: true, render: false });
  return created ?? null;
}

function add2eFindScrollEntry(scroll, spellKey) {
  const entries = add2eScrollDocumentEntries(scroll);
  return entries.find(entry => String(entry.key) === String(spellKey)) ?? null;
}

async function add2eCastScrollEntry(actor, scroll, spellKey) {
  const entry = add2eFindScrollEntry(scroll, spellKey);
  if (!entry) return ui.notifications.warn("Le sort inscrit sur ce parchemin est introuvable.");
  const compatible = entry.lists.filter(list => add2eScrollActorLists(actor).includes(add2eScrollListKey(list)));
  if (!compatible.length) return ui.notifications.warn(`${actor.name} ne peut pas lire ${entry.name} sur ce parchemin.`);
  const sourceDocument = await add2eResolveScrollSpell(entry);
  if (!sourceDocument) return ui.notifications.error(`${entry.name} est introuvable dans le compendium add2e.sorts.`);
  if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Le moteur add2eCastSpell est introuvable.");
  const data = add2eScrollCleanEmbedded(sourceDocument.toObject());
  data._id = foundry.utils.randomID();
  data.system ??= {};
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.system.scrollCast = true;
  data.flags.add2e.scrollCast = true;
  data.flags.add2e.scrollSourceItemId = scroll.id;
  data.flags.add2e.scrollSpellKey = entry.key;
  const virtualSpell = new CONFIG.Item.documentClass(data, { parent: actor });
  const result = await globalThis.add2eCastSpell({ actor, sort: virtualSpell, mode: "scroll", sourceItem: scroll, sourceSpellKey: entry.key });
  if (result === true) globalThis.add2eRerenderActorSheet?.(actor, true);
  return result;
}

async function add2eWriteScrollEntry(actor, scroll, spellKey) {
  if (add2eScrollCombatStarted()) {
    ui.notifications.warn("La copie d'un parchemin dans un livre de sorts est impossible pendant un combat.");
    return false;
  }
  const api = globalThis.ADD2E_ARCANE_DOCUMENTS;
  if (!api?.consumeScrollSpell || !api?.syncActorSpellbooks) {
    ui.notifications.error("Le moteur des documents arcaniques est introuvable.");
    return false;
  }
  const entry = add2eFindScrollEntry(scroll, spellKey);
  if (!entry) return false;
  const actorLists = add2eScrollActorLists(actor);
  const compatible = entry.lists.filter(list => actorLists.includes(add2eScrollListKey(list)));
  const unknown = compatible.filter(list => !add2eScrollActorKnows(actor, entry, list));
  if (!compatible.length) {
    ui.notifications.warn(`${actor.name} ne possède aucune classe compatible avec ${entry.name}.`);
    return false;
  }
  if (!unknown.length) {
    ui.notifications.info(`${actor.name} connaît déjà ${entry.name} dans les listes compatibles.`);
    return false;
  }
  const sourceDocument = await add2eResolveScrollSpell(entry);
  if (!sourceDocument) {
    ui.notifications.error(`${entry.name} est introuvable dans le compendium add2e.sorts.`);
    return false;
  }
  const chance = add2eScrollLearningChance(actor);
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  const confirmed = await DialogV2.wait({
    window: { title: `Écrire ${entry.name}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:500px;padding:8px;"><p><b>${add2eScrollEsc(actor.name)}</b> tente de copier <b>${add2eScrollEsc(entry.name)}</b> dans son livre personnel.</p><p>Intelligence : <b>${add2eScrollIntelligence(actor)}</b> — chance de compréhension : <b>${chance}%</b>.</p><p><b>L'inscription sera effacée du parchemin après la tentative, que le jet réussisse ou échoue.</b></p></div>`,
    buttons: [
      {
        action: "copy",
        label: "Tenter la copie",
        icon: "fa-solid fa-pen-nib",
        default: true,
        callback: () => true
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => false
      }
    ]
  });
  if (confirmed !== true) return false;
  if (add2eScrollCombatStarted()) {
    ui.notifications.warn("Le combat a commencé : la copie est annulée et le parchemin est conservé.");
    return false;
  }
  const roll = await new Roll("1d100").evaluate();
  const total = Number(roll.total) || 100;
  const success = total <= chance;
  try {
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Compréhension de ${add2eScrollEsc(entry.name)} — chance ${chance}% — ${success ? "réussite" : "échec"}`
    });
  } catch (error) {
    console.warn("[ADD2E][ARCANE_DOCUMENTS][SCROLL_COPY_ROLL_MESSAGE_FAILED]", {
      actor: actor.name,
      spell: entry.name,
      total,
      chance,
      error
    });
  }
  let learned = null;
  if (success) {
    learned = await add2eLearnSpellFromScroll(actor, scroll, entry, sourceDocument, unknown, total, chance);
    if (!learned) {
      ui.notifications.error("La création du sort a échoué. Le parchemin n'a pas été consommé.");
      return false;
    }
  }
  const consumed = await api.consumeScrollSpell(actor, scroll, entry.key);
  if (!consumed) ui.notifications.error("La tentative a été résolue, mais l'inscription du parchemin n'a pas pu être effacée.");
  if (success) {
    try { await globalThis.add2eExpandActorSpellFamilies?.(actor); } catch (_error) {}
    try { await globalThis.add2eRemoveDuplicateActorSpells?.(actor, "scroll-writing"); } catch (_error) {}
    await api.syncActorSpellbooks(actor, { reason: "scroll-writing" });
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-chat-card" style="border:1px solid #75552b;border-radius:8px;background:#fff8e7;padding:8px;"><h3 style="margin:0 0 6px;">Copie depuis un parchemin</h3><p><b>${add2eScrollEsc(entry.name)}</b> — jet ${total}/${chance}</p><p>${success ? "Le sort est copié dans le livre personnel." : "Le sort n'est pas compris et l'inscription disparaît du parchemin."}</p></div>`
  });
  globalThis.add2eRerenderActorSheet?.(actor, true);
  return success;
}

function add2eBindArcaneScrollControls(sheet, html) {
  const actor = sheet?.actor;
  if (!actor) return;
  html.find(".add2e-scroll-entry-cast").off("click.add2eScrollCast").on("click.add2eScrollCast", async function(event) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = String(this.dataset?.itemId ?? "");
    const spellKey = String(this.dataset?.spellKey ?? "");
    const scroll = actor.items?.get?.(itemId);
    if (!scroll) return ui.notifications.warn("Parchemin introuvable.");
    sheet._add2eRememberActiveTab?.(html);
    await add2eCastScrollEntry(actor, scroll, spellKey);
  });
  html.find(".add2e-scroll-entry-write").off("click.add2eScrollWrite").on("click.add2eScrollWrite", async function(event) {
    event.preventDefault();
    event.stopPropagation();
    const itemId = String(this.dataset?.itemId ?? "");
    const spellKey = String(this.dataset?.spellKey ?? "");
    const scroll = actor.items?.get?.(itemId);
    if (!scroll) return ui.notifications.warn("Parchemin introuvable.");
    sheet._add2eRememberActiveTab?.(html);
    await add2eWriteScrollEntry(actor, scroll, spellKey);
  });
}

function add2eBindModernSheetSpellPreparationControls(sheet, html) {
  const actor = sheet?.actor ?? null;
  const root = html?.jquery ? html[0] : (html?.[0] ?? html);
  if (!actor?.items || !root || typeof root.querySelectorAll !== "function") return;

  const handler = globalThis.add2eHandleSpellPreparationButton;
  const buttons = Array.from(root.querySelectorAll(".a2e-spell-entry-plus, .a2e-spell-entry-minus"));
  if (typeof handler !== "function") {
    if (globalThis.ADD2E_DEBUG_SPELL_PREP === true && buttons.length) {
      console.warn("[ADD2E][SPELL_PREP][SHEET_BIND_13D_UNAVAILABLE]", { actor: actor.name, actorId: actor.id, controls: buttons.length });
    }
    return;
  }

  for (const button of buttons) {
    button.dataset.actorId = String(actor.id ?? "");
    button.dataset.actorUuid = String(actor.uuid ?? "");
    if (button.dataset.add2ePrepBound === "1") continue;

    button.dataset.add2ePrepBound = "1";
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true });
    button.addEventListener("mousedown", event => {
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true });
    button.addEventListener("click", event => {
      void handler(button, event, actor);
    }, { capture: true });
  }

  if (globalThis.ADD2E_DEBUG_SPELL_PREP === true && buttons.length) {
    console.info("[ADD2E][SPELL_PREP][SHEET_BIND_13D]", {
      actor: actor.name,
      actorId: actor.id,
      actorUuid: actor.uuid,
      controls: buttons.length
    });
  }
}

add2eInstallArcaneScrollSheetDataPatch();

export function add2eBindActorSheetSpellListeners(sheet, html) {
  const self = sheet;

  // La feuille V2 peut afficher un acteur synthétique de token. Les boutons
  // modernes de préparation doivent conserver ce document exact au clic.
  add2eBindModernSheetSpellPreparationControls(self, html);
  add2eBindArcaneScrollControls(self, html);

  html.find('.toggle-sort-desc-chat').off('click').on('click', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const sortId = $(this).data('sort-id');
    const descRow = html.find(`#desc-chat-${sortId}`);
    descRow.slideToggle(160);
    return false;
  });

  html.find('.sort-edit').off().on('click', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const sortId = $(this).data('sort-id');
    const sort = self.actor.items.get(sortId);
    if (sort) sort.sheet.render(true);
    return false;
  });

  html.find('.sort-delete').off().on('click', async function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const sortId = $(this).data('sort-id');
    await self.actor.deleteEmbeddedDocuments("Item", [sortId]);
    add2eRerenderActorSheet(self.actor);
    return false;
  });

  html.find('.sort-memorize-plus, .sort-memorize-minus').off('click').on('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();

    const $btn = $(ev.currentTarget);
    const sortId = $btn.data('sort-id');
    const sort = sheet.actor.items.get(sortId);
    if (!sort) return;

    const isPlus = $btn.hasClass('sort-memorize-plus');
    const niv = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
    const requestedEntryKey = add2eNormalizeSpellKey($btn.data('spell-entry-key') || $btn.attr('data-spell-entry-key') || "");

    let check = add2eCanActorUseSpell(sheet.actor, sort);

    if (requestedEntryKey) {
      const entries = add2eGetSpellcastingEntries(sheet.actor);
      const sortLists = add2eGetSpellListsFromItem(sort);
      const requestedEntry = entries.find(e => add2eNormalizeSpellKey(e.key) === requestedEntryKey) || null;

      if (!requestedEntry || !sortLists.includes(requestedEntryKey)) return ui.notifications.warn(`Ce sort ne peut pas être préparé comme ${requestedEntry?.label || requestedEntryKey}.`);

      const actorLevel = Math.max(1, Number(sheet.actor?.system?.niveau) || 1);
      const startsAt = Number(requestedEntry.startsAt || 1);
      const maxLevel = Number(requestedEntry.maxSpellLevel || 0);

      if (actorLevel < startsAt) return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${startsAt}.`);
      if (maxLevel && niv > maxLevel) return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);

      check = { ok: true, reason: "ok", entry: requestedEntry };
    }

    if (!check.ok) {
      const entry = check.entry;
      if (check.reason === "start") return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${entry?.startsAt}.`);
      if (check.reason === "max-level") return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);
      return ui.notifications.warn(`Ce sort n'est pas autorisé pour cette classe.`);
    }

    const entry = check.entry;
    let cur = add2eGetMemorizedCountForEntry(sort, entry);

    if (isPlus) {
      const limit = add2eGetSlotsForEntryLevel(sheet.actor, entry, niv);
      const total = add2eCountPreparedForEntryLevel(sheet.actor, entry, niv);
      if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${niv} disponible.`);
      if (total >= limit) return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${niv} (${total}/${limit}).`);
      cur++;
    } else {
      if (cur > 0) cur--;
      else return ui.notifications.warn(`Aucun emplacement ${entry.label} à libérer.`);
    }

    await add2eSetMemorizedCountForEntry(sort, entry, cur);
    add2eRerenderActorSheet(sheet.actor);
  });

  html.off("click.add2eSortCast").on("click.add2eSortCast", ".sort-cast, .sort-cast-img, .add2e-object-magic-cast", async function(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    const sortId = String(this.dataset?.sortId || this.getAttribute?.("data-sort-id") || $(this).data("sort-id") || "").trim();
    const debug = !!globalThis.ADD2E_DEBUG_OBJETS_MAGIQUES;

    if (debug) {
      console.group("[ADD2E][OBJETS_MAGIQUES][CLICK]");
      console.log("element", this);
      console.log("sortId", sortId);
    }

    if (!sortId) {
      if (debug) console.groupEnd();
      ui.notifications.warn("Impossible de lancer : identifiant du sort introuvable.");
      return false;
    }

    let sort = self.actor.items.get(sortId) ?? null;
    if (debug) console.log("Sort réel trouvé", !!sort, sort);

    if (!sort) {
      const itemSources = self.actor.items.filter(i => {
        if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(String(i.type || "").toLowerCase())) return false;
        if (typeof add2eMagicItemEquippedOrUsable === "function") {
          if (!add2eMagicItemEquippedOrUsable(i)) return false;
        } else if (i.system?.equipee === false) return false;
        const pouvoirs = typeof add2eMagicObjectPowerArray === "function" ? add2eMagicObjectPowerArray(i) : [];
        return pouvoirs.length > 0;
      });

      if (debug) console.log("Sources objets magiques candidates", itemSources.map(i => ({ id: i.id, name: i.name, type: i.type })));

      for (const itemSource of itemSources) {
        const pouvoirs = typeof add2eMagicObjectPowerArray === "function" ? add2eMagicObjectPowerArray(itemSource) : [];

        for (let idx = 0; idx < pouvoirs.length; idx++) {
          const generatedId = typeof add2eMagicPowerGeneratedId === "function" ? add2eMagicPowerGeneratedId(itemSource, idx) : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");
          if (generatedId !== sortId) continue;

          if (typeof add2eBuildVirtualObjectPowerSort === "function") {
            sort = add2eBuildVirtualObjectPowerSort(self.actor, itemSource, pouvoirs[idx], idx);
          } else {
            const p = pouvoirs[idx];
            const onUse = String(p?.onUse ?? p?.onuse ?? p?.on_use ?? p?.script ?? "").trim();
            const cost = Math.max(0, Number(p?.cout ?? p?.cost ?? 0) || 0);
            const maxGlobal = Number(itemSource.system?.charges?.max ?? itemSource.system?.max_charges ?? 0) || 0;
            const isGlobal = maxGlobal > 0;
            const max = cost <= 0 ? 1 : (isGlobal ? maxGlobal : (Number(p?.max ?? p?.charges ?? 1) || 1));

            sort = new Item({
              _id: generatedId,
              name: String(p?.name ?? p?.nom ?? itemSource.name ?? "Pouvoir"),
              type: "sort",
              img: p?.img || itemSource.img,
              system: {
                niveau: Number(p?.niveau ?? p?.level ?? 1) || 1,
                école: p?.ecole || p?.["école"] || "Magique",
                description: p?.description || "",
                composantes: "Objet",
                temps_incantation: p?.activation || "Objet magique",
                isPower: true,
                isObjectPower: true,
                sourceWeaponId: itemSource.id,
                sourceItemId: itemSource.id,
                sourceItemName: itemSource.name,
                powerIndex: idx,
                cost,
                cout: cost,
                max,
                isGlobalCharge: isGlobal,
                onUse,
                onuse: onUse,
                on_use: onUse
              },
              flags: { add2e: { memorizedCount: cost <= 0 ? 1 : max, originalOnUse: onUse, sourceType: "objet_magique", sourceItemId: itemSource.id, sourceItemName: itemSource.name, powerIndex: idx } }
            }, { parent: self.actor });

            sort.getFlag = (scope, key) => {
              if (scope !== "add2e") return null;
              if (key === "memorizedCount") return cost <= 0 ? 1 : max;
              if (key === "originalOnUse") return onUse;
              return sort.flags?.add2e?.[key] ?? null;
            };
          }
          break;
        }
        if (sort) break;
      }
    }

    if (sort) {
      if (typeof globalThis.add2eCastSpell === "function") {
        if (debug) console.groupEnd();
        await globalThis.add2eCastSpell({ actor: self.actor, sort });
        self.render(false);
      } else {
        if (debug) console.groupEnd();
        ui.notifications.error("La fonction add2eCastSpell est introuvable.");
      }
    } else {
      if (debug) {
        console.warn("Aucun sort/pouvoir retrouvé pour", sortId);
        console.groupEnd();
      }
      ui.notifications.warn("Impossible de retrouver les données de ce sort ou pouvoir d'objet magique.");
    }
    return false;
  });

  html.find('.sort-cast-img').off('dragstart').on('dragstart', ev => {
    const sortId = $(ev.currentTarget).data('sort-id');
    const item = sheet.actor.items.get(sortId);
    if (!item) return;
    ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
  });
}
