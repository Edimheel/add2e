// ADD2E — Livres de sorts et parchemins.
// Compatible Foundry V13/V14/V15. DialogV2 uniquement.

const VERSION = "2026-07-13-arcane-documents-v2";
const ARCANE_LISTS = new Set(["magicien", "illusionniste"]);
const BOOK_NAMES = {
  magicien: "Livre de sorts — Magicien",
  illusionniste: "Livre de sorts — Illusionniste"
};
const BOOK_IMAGES = {
  magicien: "icons/sundries/books/book-embossed-gold-red.webp",
  illusionniste: "icons/sundries/books/book-embossed-gold-blue.webp"
};
const SYNC_LOCKS = new Set();
const SYNC_TIMERS = new Map();
let spellIndexPromise = null;

function clone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
}

function norm(value) {
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

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function array(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(array);
  if (value instanceof Set) return [...value].flatMap(array);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["lists", "spellLists", "classes", "classe", "class", "items", "value", "values"]) {
      if (value[key] !== undefined) return array(value[key]);
    }
  }
  return [value];
}

function listKey(value) {
  try {
    if (typeof globalThis.add2eNormalizeSpellKey === "function") {
      return globalThis.add2eNormalizeSpellKey(value);
    }
  } catch (_error) {}

  const key = norm(value);
  return ({
    wizard: "magicien",
    mage: "magicien",
    magician: "magicien",
    magic_user: "magicien",
    illusionist: "illusionniste"
  })[key] ?? key;
}

function itemType(item) {
  return String(item?.type ?? "").toLowerCase();
}

function spellLevel(item) {
  return Math.max(1, Number(
    item?.system?.niveau
    ?? item?.system?.level
    ?? item?.system?.niveau_sort
    ?? item?.system?.spellLevel
    ?? 1
  ) || 1);
}

function spellLists(item) {
  try {
    if (typeof globalThis.add2eGetSpellListsFromItem === "function") {
      return [...new Set(
        globalThis.add2eGetSpellListsFromItem(item)
          .map(listKey)
          .filter(Boolean)
      )];
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
  ].flatMap(array).map(listKey).filter(Boolean))];
}

function actorArcaneLists(actor) {
  const result = new Set();

  try {
    for (const entry of globalThis.add2eGetSpellcastingEntries?.(actor) ?? []) {
      const key = listKey(entry?.key);
      if (ARCANE_LISTS.has(key)) result.add(key);
    }
  } catch (_error) {}

  for (const item of actor?.items ?? []) {
    if (itemType(item) !== "classe") continue;
    const system = item.system ?? {};
    for (const value of [item.name, system.slug, system.label, system.nom, system.name]) {
      const key = listKey(value);
      if (ARCANE_LISTS.has(key)) result.add(key);
    }
  }

  return [...result];
}

function cleanEmbedded(source) {
  const data = clone(source ?? {});
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

function arcaneData(item) {
  const value = item?.system?.arcaneDocument;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arcaneKind(item) {
  return String(
    arcaneData(item).kind
    ?? item?.flags?.add2e?.arcaneDocumentKind
    ?? ""
  ).trim().toLowerCase();
}

function isSpellbook(item) {
  return itemType(item) === "objet" && arcaneKind(item) === "spellbook";
}

function isScroll(item) {
  return itemType(item) === "objet" && arcaneKind(item) === "spell-scroll";
}

function itemQuantity(item) {
  const value = item?.system?.quantite ?? item?.system?.quantity;
  if (value === undefined || value === null || value === "") return 1;
  return Math.max(0, Math.floor(Number(value) || 0));
}

function sourceUuid(item) {
  return String(
    item?.flags?.core?.sourceId
    ?? item?._stats?.compendiumSource
    ?? item?.flags?.add2e?.sourceUuid
    ?? item?.flags?.add2e?.dropResolvedUuid
    ?? ""
  ).trim();
}

function stableSpellKey(item, list = "") {
  const existing = String(
    item?.flags?.add2e?.stableSpellKey
    ?? item?.flags?.add2e?.spellStableKey
    ?? ""
  ).trim();

  if (existing) return existing;
  return `${listKey(list || spellLists(item)[0] || "sort")}|${spellLevel(item)}|${norm(item?.name)}`;
}

function normalizeEntry(entry, fallbackList = "") {
  if (!entry) return null;

  const name = String(entry.name ?? entry.nom ?? entry.label ?? "").trim();
  if (!name) return null;

  const level = Math.max(1, Number(
    entry.level
    ?? entry.niveau
    ?? entry.spellLevel
    ?? 1
  ) || 1);

  const lists = [...new Set([
    entry.lists,
    entry.spellLists,
    entry.classes,
    entry.classe,
    entry.class,
    fallbackList
  ].flatMap(array).map(listKey).filter(Boolean))];

  return {
    key: String(entry.key ?? entry.stableKey ?? entry.spellKey ?? "").trim()
      || `${lists[0] ?? "sort"}|${level}|${norm(name)}`,
    name,
    level,
    lists,
    sourceUuid: String(entry.sourceUuid ?? entry.uuid ?? entry.sourceId ?? "").trim(),
    img: String(entry.img ?? entry.image ?? "icons/svg/book.svg")
  };
}

function entryFromSpell(item, preferredList = "") {
  const allLists = spellLists(item);
  const selected = preferredList
    ? allLists.filter(key => key === listKey(preferredList))
    : allLists;

  return normalizeEntry({
    key: stableSpellKey(item, preferredList),
    name: item.name,
    level: spellLevel(item),
    lists: selected.length ? selected : allLists,
    sourceUuid: sourceUuid(item),
    img: item.img
  }, preferredList);
}

function documentEntries(item) {
  const document = arcaneData(item);
  const fallbackList = listKey(document.ownerList ?? document.spellList ?? "");
  const source = Array.isArray(document.spells)
    ? document.spells
    : document.spell
      ? [document.spell]
      : Array.isArray(item?.system?.sorts)
        ? item.system.sorts
        : [];

  const seen = new Set();
  const entries = [];

  for (const sourceEntry of source) {
    const entry = normalizeEntry(sourceEntry, fallbackList);
    if (!entry) continue;

    const key = `${entry.key}|${entry.lists.join(",")}`;
    if (seen.has(key)) continue;

    seen.add(key);
    entries.push(entry);
  }

  return entries.sort((left, right) =>
    left.level - right.level
    || left.name.localeCompare(right.name, "fr")
  );
}

function isKnownSpell(item) {
  if (itemType(item) !== "sort") return false;
  if (item.system?.isPower === true || item.system?.isObjectPower === true) return false;
  if (item.system?.isCapacity === true || item.flags?.add2e?.spellFamily?.generated === true) return false;
  return true;
}

function knownEntries(actor, list) {
  const wantedList = listKey(list);
  const seen = new Set();
  const entries = [];

  for (const spell of actor?.items ?? []) {
    if (!isKnownSpell(spell) || !spellLists(spell).includes(wantedList)) continue;

    const entry = entryFromSpell(spell, wantedList);
    if (!entry) continue;

    const unique = `${entry.key}|${wantedList}`;
    if (seen.has(unique)) continue;

    seen.add(unique);
    entries.push(entry);
  }

  return entries.sort((left, right) =>
    left.level - right.level
    || left.name.localeCompare(right.name, "fr")
  );
}

function personalBook(actor, list) {
  const wantedList = listKey(list);

  return Array.from(actor?.items ?? []).find(item => {
    if (!isSpellbook(item)) return false;

    const data = arcaneData(item);
    const ownerUuid = String(
      data.ownerActorUuid
      ?? item.flags?.add2e?.ownerActorUuid
      ?? ""
    );

    return data.personal === true
      && listKey(data.ownerList) === wantedList
      && (!ownerUuid || ownerUuid === actor.uuid);
  }) ?? null;
}

async function ensurePersonalBook(actor, list) {
  const wantedList = listKey(list);
  const spells = knownEntries(actor, wantedList);
  let book = personalBook(actor, wantedList);

  if (!book) {
    const name = BOOK_NAMES[wantedList];
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name,
      type: "objet",
      img: BOOK_IMAGES[wantedList] ?? "icons/svg/book.svg",
      system: {
        nom: name,
        type: "objet",
        categorie: "equipement",
        sousType: "livre_de_sorts",
        quantite: 1,
        poids: 5,
        equipee: false,
        magique: false,
        consommable: false,
        description: "Livre personnel contenant les sorts connus du personnage.",
        arcaneDocument: {
          schema: 1,
          kind: "spellbook",
          personal: true,
          ownerList: wantedList,
          ownerActorUuid: actor.uuid,
          spells
        }
      },
      effects: [],
      flags: {
        add2e: {
          arcaneDocumentKind: "spellbook",
          personalSpellbook: true,
          ownerActorUuid: actor.uuid,
          ownerSpellList: wantedList,
          generatedBy: VERSION
        }
      }
    }], {
      add2eInternal: true,
      add2eArcaneSync: true,
      render: false
    });

    return created ?? null;
  }

  const current = arcaneData(book);
  const next = {
    ...clone(current),
    schema: 1,
    kind: "spellbook",
    personal: true,
    ownerList: wantedList,
    ownerActorUuid: actor.uuid,
    spells
  };

  if (
    book.name !== BOOK_NAMES[wantedList]
    || JSON.stringify(current) !== JSON.stringify(next)
  ) {
    await book.update({
      name: BOOK_NAMES[wantedList],
      "system.nom": BOOK_NAMES[wantedList],
      "system.arcaneDocument": next,
      "flags.add2e.arcaneDocumentKind": "spellbook",
      "flags.add2e.personalSpellbook": true,
      "flags.add2e.ownerActorUuid": actor.uuid,
      "flags.add2e.ownerSpellList": wantedList,
      "flags.add2e.generatedBy": VERSION
    }, {
      add2eInternal: true,
      add2eArcaneSync: true,
      render: false
    });
  }

  return book;
}

function packEntries(index) {
  if (!index) return [];
  if (Array.isArray(index.contents)) return index.contents;
  if (typeof index.values === "function") return [...index.values()];
  try { return [...index]; } catch (_error) { return []; }
}

async function buildSpellIndex() {
  if (spellIndexPromise) return spellIndexPromise;

  spellIndexPromise = (async () => {
    const packs = [];
    const seen = new Set();

    for (const id of ["add2e.sorts", "world.sorts"]) {
      const pack = game.packs?.get?.(id);
      if (pack?.documentName !== "Item") continue;
      packs.push(pack);
      seen.add(pack.collection);
    }

    for (const pack of game.packs?.values?.() ?? []) {
      const label = norm(`${pack?.collection ?? ""} ${pack?.metadata?.label ?? ""}`);
      if (
        pack?.documentName !== "Item"
        || seen.has(pack.collection)
        || (!label.includes("sort") && !label.includes("spell"))
      ) continue;

      packs.push(pack);
      seen.add(pack.collection);
    }

    const byName = new Map();

    for (const pack of packs) {
      let index;
      try {
        index = await pack.getIndex({
          fields: [
            "name",
            "type",
            "system.niveau",
            "system.level",
            "system.spellLists",
            "system.liste",
            "system.classe"
          ]
        });
      } catch (_error) {
        index = await pack.getIndex();
      }

      for (const entry of packEntries(index)) {
        if (itemType(entry) !== "sort") continue;

        const candidate = {
          pack,
          id: entry._id,
          name: entry.name,
          level: spellLevel(entry),
          lists: spellLists(entry)
        };

        const key = norm(entry.name);
        const bucket = byName.get(key) ?? [];
        bucket.push(candidate);
        byName.set(key, bucket);
      }
    }

    return { byName };
  })();

  return spellIndexPromise;
}

async function resolveSpell(entry) {
  const normalized = normalizeEntry(entry);
  if (!normalized) return null;

  if (
    normalized.sourceUuid.startsWith("Compendium.")
    && typeof fromUuid === "function"
  ) {
    try {
      const document = await fromUuid(normalized.sourceUuid);
      if (document?.documentName === "Item" && itemType(document) === "sort") {
        return document;
      }
    } catch (_error) {}
  }

  const index = await buildSpellIndex();
  const candidates = index.byName.get(norm(normalized.name)) ?? [];

  let selected = candidates.find(candidate =>
    candidate.level === normalized.level
    && (
      !normalized.lists.length
      || normalized.lists.some(list => candidate.lists.includes(list))
    )
  ) ?? null;

  selected ??= candidates.find(candidate => candidate.level === normalized.level) ?? candidates[0] ?? null;
  return selected ? selected.pack.getDocument(selected.id) : null;
}

async function resolveSpellByName(name) {
  return resolveSpell({ name, level: 1, lists: [] });
}

function scrollSpellName(item) {
  const system = item?.system ?? {};
  const data = arcaneData(item);
  const explicit = data.spellName
    ?? system.spellName
    ?? system.sortNom
    ?? system.nomSort
    ?? (typeof system.sort === "string" ? system.sort : "")
    ?? (typeof system.spell === "string" ? system.spell : "");

  if (String(explicit ?? "").trim()) return String(explicit).trim();

  const match = String(item?.name ?? "").trim().match(
    /^parchemin(?:\s+de\s+sort)?\s*[-—:]?\s*(?:de\s+|d['’])?(.+)$/iu
  );

  return match?.[1]?.trim() ?? "";
}

async function hydrateScroll(item) {
  if (
    !item?.parent
    || item.parent.documentName !== "Actor"
    || itemType(item) !== "objet"
    || isScroll(item)
    || !norm(item.name).startsWith("parchemin")
  ) return false;

  const name = scrollSpellName(item);
  if (!name) return false;

  const spell = await resolveSpellByName(name);
  if (!spell || norm(spell.name) !== norm(name)) return false;

  const entry = entryFromSpell(spell);
  if (!entry) return false;

  await item.update({
    "system.arcaneDocument": {
      schema: 1,
      kind: "spell-scroll",
      personal: false,
      spells: [entry]
    },
    "flags.add2e.arcaneDocumentKind": "spell-scroll",
    "flags.add2e.generatedBy": VERSION
  }, {
    add2eInternal: true,
    add2eArcaneSync: true,
    render: false
  });

  return true;
}

async function syncActorSpellbooks(actor, { reason = "sync" } = {}) {
  if (!actor || actor.type !== "personnage" || !actor.items) {
    return { books: 0, scrolls: 0 };
  }

  const lockKey = actor.uuid ?? actor.id;
  if (SYNC_LOCKS.has(lockKey)) return { books: 0, scrolls: 0, locked: true };

  SYNC_LOCKS.add(lockKey);

  try {
    const lists = actorArcaneLists(actor);
    let books = 0;
    let scrolls = 0;

    for (const list of lists) {
      if (await ensurePersonalBook(actor, list)) books += 1;
    }

    for (const book of Array.from(actor.items).filter(isSpellbook)) {
      const data = arcaneData(book);
      const ownerUuid = String(data.ownerActorUuid ?? "");

      if (data.personal === true && ownerUuid && ownerUuid !== actor.uuid) {
        await book.update({
          "system.arcaneDocument.personal": false,
          "flags.add2e.personalSpellbook": false
        }, {
          add2eInternal: true,
          add2eArcaneSync: true,
          render: false
        });
      }
    }

    for (const item of Array.from(actor.items)) {
      if (await hydrateScroll(item)) scrolls += 1;
    }

    console.info("[ADD2E][ARCANE_DOCUMENTS][SYNC]", {
      version: VERSION,
      actor: actor.name,
      reason,
      lists,
      books,
      scrolls
    });

    return { books, scrolls };
  } finally {
    SYNC_LOCKS.delete(lockKey);
  }
}

function scheduleSync(actor, reason) {
  if (!actor?.id) return;

  const key = actor.uuid ?? actor.id;
  if (SYNC_TIMERS.has(key)) clearTimeout(SYNC_TIMERS.get(key));

  SYNC_TIMERS.set(key, setTimeout(() => {
    SYNC_TIMERS.delete(key);
    syncActorSpellbooks(actor, { reason }).catch(error => {
      console.error("[ADD2E][ARCANE_DOCUMENTS][SYNC_ERROR]", {
        actor: actor.name,
        reason,
        error
      });
    });
  }, 60));
}

function actorIntelligence(actor) {
  const system = actor?.system ?? {};
  const direct = Number(
    system.intelligence
    ?? system.intelligence_total
    ?? system.intelligenceTotal
  );

  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);

  return Math.floor(
    (Number(system.intelligence_base) || 10)
    + (Number(system.intelligence_race) || 0)
    + (Number(system.bonus_caracteristiques?.intelligence) || 0)
  );
}

function learningChance(actor) {
  const intelligence = Math.max(3, Math.min(18, actorIntelligence(actor)));
  const tableChance = Number(globalThis.INTELLIGENCE_TABLE?.[intelligence]?.chance_sort);

  if (Number.isFinite(tableChance)) {
    return Math.max(0, Math.min(100, tableChance));
  }

  return ({
    9: 35,
    10: 45,
    11: 45,
    12: 45,
    13: 55,
    14: 55,
    15: 65,
    16: 65,
    17: 75,
    18: 85
  })[intelligence] ?? 0;
}

function actorKnows(actor, entry, list) {
  const wantedList = listKey(list);

  return Array.from(actor?.items ?? []).some(item =>
    isKnownSpell(item)
    && spellLevel(item) === entry.level
    && norm(item.name) === norm(entry.name)
    && spellLists(item).includes(wantedList)
  );
}

async function addKnownSpell(actor, sourceDocument, entry, lists, metadata) {
  const allowedLists = [...new Set(
    lists.map(listKey).filter(list => ARCANE_LISTS.has(list))
  )];

  let existing = Array.from(actor.items).find(item =>
    isKnownSpell(item)
    && spellLevel(item) === entry.level
    && norm(item.name) === norm(entry.name)
  ) ?? null;

  if (existing) {
    const mergedLists = [...new Set([
      ...spellLists(existing),
      ...allowedLists
    ])];

    await existing.update({
      "system.spellLists": mergedLists,
      "flags.add2e.learnedSpellLists": mergedLists,
      "flags.add2e.knownSpellLists": mergedLists,
      "flags.add2e.manuallyLearnedSpell": true,
      "flags.add2e.lastLearnedSpellList": allowedLists[0] ?? mergedLists[0] ?? "",
      "flags.add2e.learnedFromSpellbookUuid": metadata.bookUuid,
      "flags.add2e.learnedFromSpellbookName": metadata.bookName,
      "flags.add2e.spellbookCopyRoll": metadata.roll,
      "flags.add2e.spellbookCopyChance": metadata.chance
    }, {
      add2eInternal: true,
      add2eArcaneCopy: true,
      render: false
    });

    return existing;
  }

  const data = cleanEmbedded(sourceDocument.toObject());
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
  data.flags.add2e.learnedFromSpellbookUuid = metadata.bookUuid;
  data.flags.add2e.learnedFromSpellbookName = metadata.bookName;
  data.flags.add2e.spellbookCopyRoll = metadata.roll;
  data.flags.add2e.spellbookCopyChance = metadata.chance;

  const [created] = await actor.createEmbeddedDocuments("Item", [data], {
    add2eInternal: true,
    add2eArcaneCopy: true,
    render: false
  });

  return created ?? null;
}

async function selectBookSpells(actor, book, candidates, chance) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return null;

  const rows = candidates.map((candidate, index) => `
    <label style="display:grid;grid-template-columns:28px 1fr 75px 150px;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid #d5c7a6;">
      <input type="checkbox" value="${index}" checked>
      <span><b>${esc(candidate.entry.name)}</b></span>
      <span>Niv. ${candidate.entry.level}</span>
      <span>${esc(candidate.lists.map(list => list === "illusionniste" ? "Illusionniste" : "Magicien").join(" / "))}</span>
    </label>
  `).join("");

  return DialogV2.wait({
    window: { title: `Copier depuis ${book.name}` },
    modal: true,
    rejectClose: false,
    content: `
      <form class="add2e-copy-spellbook" style="min-width:680px;max-height:650px;overflow:auto;padding:8px;">
        <p><b>${esc(actor.name)}</b> peut tenter de copier tous les sorts sélectionnés.</p>
        <p>Intelligence : <b>${actorIntelligence(actor)}</b> — chance par sort : <b>${chance}%</b>. Aucune limite de nombre n’est appliquée.</p>
        <div style="display:grid;grid-template-columns:28px 1fr 75px 150px;gap:8px;font-weight:800;padding:5px 6px;background:#eadfca;">
          <span></span><span>Sort</span><span>Niveau</span><span>Livre personnel</span>
        </div>
        ${rows}
      </form>
    `,
    buttons: [
      {
        action: "copy",
        label: "Copier les sorts sélectionnés",
        icon: "fa-solid fa-copy",
        default: true,
        callback: (_event, button, dialog) => {
          const element = dialog?.element?.jquery ? dialog.element[0] : dialog?.element;
          const form = button?.form ?? element?.querySelector?.("form.add2e-copy-spellbook");
          if (!form) return null;

          return [...form.querySelectorAll('input[type="checkbox"]:checked')]
            .map(input => Number(input.value))
            .filter(Number.isInteger);
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark"
      }
    ]
  });
}

async function copySpellbook(actor, book) {
  if (!actor || !book || !isSpellbook(book)) return false;

  await syncActorSpellbooks(actor, { reason: "before-copy" });

  const actorLists = actorArcaneLists(actor);
  if (!actorLists.length) {
    ui.notifications.warn(`${actor.name} n'est ni Magicien ni Illusionniste.`);
    return false;
  }

  const candidates = [];

  for (const entry of documentEntries(book)) {
    const compatible = entry.lists.filter(list => actorLists.includes(list));
    const unknown = compatible.filter(list => !actorKnows(actor, entry, list));
    if (unknown.length) candidates.push({ entry, lists: unknown });
  }

  if (!candidates.length) {
    ui.notifications.info("Aucun sort compatible et inconnu à copier dans ce livre.");
    return false;
  }

  const chance = learningChance(actor);
  const selected = await selectBookSpells(actor, book, candidates, chance);
  if (!selected?.length) return false;

  const copied = [];
  const failed = [];
  const errors = [];

  for (const index of selected) {
    const candidate = candidates[index];
    if (!candidate) continue;

    const roll = await new Roll("1d100").evaluate();
    const total = Number(roll.total) || 100;

    if (total > chance) {
      failed.push({ entry: candidate.entry, roll: total });
      continue;
    }

    const sourceDocument = await resolveSpell(candidate.entry);
    if (!sourceDocument) {
      errors.push({ entry: candidate.entry, message: "absent du compendium add2e.sorts" });
      continue;
    }

    const created = await addKnownSpell(
      actor,
      sourceDocument,
      candidate.entry,
      candidate.lists,
      {
        bookUuid: book.uuid,
        bookName: book.name,
        roll: total,
        chance
      }
    );

    if (created) copied.push({ ...candidate, roll: total });
    else errors.push({ entry: candidate.entry, message: "création impossible" });
  }

  try { await globalThis.add2eExpandActorSpellFamilies?.(actor); } catch (_error) {}
  try { await globalThis.add2eRemoveDuplicateActorSpells?.(actor, "spellbook-copy"); } catch (_error) {}

  await syncActorSpellbooks(actor, { reason: "after-copy" });

  const copiedRows = copied.length
    ? copied.map(result => `<li><b>${esc(result.entry.name)}</b> — ${result.roll}/${chance} — ${esc(result.lists.join(" / "))}</li>`).join("")
    : "<li>Aucun.</li>";

  const failedRows = failed.length
    ? failed.map(result => `<li>${esc(result.entry.name)} — ${result.roll}/${chance}</li>`).join("")
    : "<li>Aucun.</li>";

  const errorRows = errors.length
    ? errors.map(result => `<li>${esc(result.entry.name)} — ${esc(result.message)}</li>`).join("")
    : "<li>Aucune.</li>";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="add2e-chat-card" style="border:1px solid #75552b;border-radius:8px;background:#fff8e7;padding:8px;">
        <h3 style="margin:0 0 6px;">Copie de ${esc(book.name)}</h3>
        <p>Aucune limite de nombre de sorts n’a été appliquée.</p>
        <details open><summary><b>Sorts copiés (${copied.length})</b></summary><ul>${copiedRows}</ul></details>
        <details><summary><b>Échecs de compréhension (${failed.length})</b></summary><ul>${failedRows}</ul></details>
        <details ${errors.length ? "open" : ""}><summary><b>Erreurs (${errors.length})</b></summary><ul>${errorRows}</ul></details>
      </div>
    `
  });

  globalThis.add2eRerenderActorSheet?.(actor, true);
  return copied.length > 0;
}

async function viewSpellbook(book) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait || !book) return false;

  const entries = documentEntries(book);
  const rows = entries.length
    ? entries.map(entry => `
        <tr>
          <td><img src="${esc(entry.img)}" width="28" height="28" style="object-fit:cover;border-radius:4px;"></td>
          <td><b>${esc(entry.name)}</b></td>
          <td>${entry.level}</td>
          <td>${esc(entry.lists.join(" / "))}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="4"><em>Aucun sort inscrit.</em></td></tr>';

  await DialogV2.wait({
    window: { title: book.name },
    modal: true,
    rejectClose: false,
    content: `
      <div style="min-width:620px;max-height:650px;overflow:auto;padding:8px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th></th><th>Sort</th><th>Niveau</th><th>Liste</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
    buttons: [
      {
        action: "close",
        label: "Fermer",
        icon: "fa-solid fa-check",
        default: true
      }
    ]
  });

  return true;
}

async function selectScrollSpell(scroll, candidates) {
  if (candidates.length === 1) return candidates[0];

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return null;

  const options = candidates.map((candidate, index) =>
    `<option value="${index}">${esc(candidate.entry.name)} — niveau ${candidate.entry.level} — ${esc(candidate.lists.join(" / "))}</option>`
  ).join("");

  const selected = await DialogV2.wait({
    window: { title: `Lire ${scroll.name}` },
    modal: true,
    rejectClose: false,
    content: `
      <form class="add2e-cast-scroll" style="min-width:520px;padding:8px;">
        <p>Le lancement ne consomme ni sort mémorisé ni composante.</p>
        <label style="display:grid;gap:5px;">
          <b>Sort</b>
          <select name="spellIndex">${options}</select>
        </label>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Lancer le sort",
        icon: "fa-solid fa-scroll",
        default: true,
        callback: (_event, button, dialog) => {
          const element = dialog?.element?.jquery ? dialog.element[0] : dialog?.element;
          const form = button?.form ?? element?.querySelector?.("form.add2e-cast-scroll");
          return Number(form?.elements?.spellIndex?.value ?? -1);
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark"
      }
    ]
  });

  return Number.isInteger(selected) && selected >= 0
    ? candidates[selected] ?? null
    : null;
}

async function castScroll(actor, scroll) {
  if (!actor || !scroll) return false;

  if (!isScroll(scroll)) await hydrateScroll(scroll);

  const entries = documentEntries(scroll);
  if (!entries.length) {
    ui.notifications.warn(`${scroll.name} ne contient aucun sort exploitable.`);
    return false;
  }

  const actorLists = actorArcaneLists(actor);
  const candidates = entries
    .map(entry => ({
      entry,
      lists: entry.lists.filter(list => actorLists.includes(list))
    }))
    .filter(candidate => candidate.lists.length);

  if (!candidates.length) {
    ui.notifications.warn(`${actor.name} ne peut pas lire les sorts contenus dans ${scroll.name}.`);
    return false;
  }

  const selected = await selectScrollSpell(scroll, candidates);
  if (!selected) return false;

  const sourceDocument = await resolveSpell(selected.entry);
  if (!sourceDocument) {
    ui.notifications.error(`${selected.entry.name} est introuvable dans le compendium add2e.sorts.`);
    return false;
  }

  const data = cleanEmbedded(sourceDocument.toObject());
  data._id = foundry.utils.randomID();
  data.system ??= {};
  data.flags ??= {};
  data.flags.add2e ??= {};

  data.system.scrollCast = true;
  data.flags.add2e.scrollCast = true;
  data.flags.add2e.scrollSourceItemId = scroll.id;
  data.flags.add2e.scrollSpellKey = selected.entry.key;

  const virtualSpell = new CONFIG.Item.documentClass(data, { parent: actor });

  if (typeof globalThis.add2eCastSpell !== "function") {
    ui.notifications.error("Le moteur add2eCastSpell est introuvable.");
    return false;
  }

  return globalThis.add2eCastSpell({
    actor,
    sort: virtualSpell,
    mode: "scroll",
    sourceItem: scroll,
    sourceSpellKey: selected.entry.key
  });
}

async function consumeScrollSpell(actor, scroll, spellKey) {
  if (!actor || !scroll || !actor.items?.get?.(scroll.id)) return false;

  const sourceData = arcaneData(scroll);
  const entries = documentEntries(scroll);
  const selectedIndex = entries.findIndex(entry => entry.key === spellKey);
  if (selectedIndex < 0) return false;

  const remaining = entries.filter((_entry, index) => index !== selectedIndex);
  const count = itemQuantity(scroll);

  if (entries.length === 1) {
    if (count > 1) {
      await scroll.update({
        "system.quantite": count - 1
      }, {
        add2eInternal: true,
        add2eArcaneScroll: true,
        render: false
      });
    } else {
      await actor.deleteEmbeddedDocuments("Item", [scroll.id], {
        add2eInternal: true,
        add2eArcaneScroll: true,
        render: false
      });
    }

    return true;
  }

  if (count > 1) {
    await scroll.update({
      "system.quantite": count - 1
    }, {
      add2eInternal: true,
      add2eArcaneScroll: true,
      render: false
    });

    if (remaining.length) {
      const partial = cleanEmbedded(scroll.toObject());
      partial.name = `${scroll.name} (entamé)`;
      partial.system ??= {};
      partial.system.quantite = 1;
      partial.system.arcaneDocument = {
        ...clone(sourceData),
        schema: 1,
        kind: "spell-scroll",
        spells: remaining
      };

      await actor.createEmbeddedDocuments("Item", [partial], {
        add2eInternal: true,
        add2eArcaneScroll: true,
        render: false
      });
    }

    return true;
  }

  if (remaining.length) {
    await scroll.update({
      "system.arcaneDocument": {
        ...clone(sourceData),
        schema: 1,
        kind: "spell-scroll",
        spells: remaining
      }
    }, {
      add2eInternal: true,
      add2eArcaneScroll: true,
      render: false
    });
  } else {
    await actor.deleteEmbeddedDocuments("Item", [scroll.id], {
      add2eInternal: true,
      add2eArcaneScroll: true,
      render: false
    });
  }

  return true;
}

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
  const actor = application?.actor
    ?? application?.document
    ?? game.actors?.get?.(element?.dataset?.actorId)
    ?? null;
  const item = actor?.items?.get?.(itemId) ?? null;

  if (!actor || !item) {
    ui.notifications.warn("Document arcanique introuvable.");
    return false;
  }

  application?._add2eRememberActiveTab?.();

  if (action === "view-book") return viewSpellbook(item);
  if (action === "copy-book") return copySpellbook(actor, item);
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
    || norm(item?.name).startsWith("parchemin");
}

Hooks.on("createItem", (item, _options, userId) => {
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
  const actor = item?.parent;
  if (
    actor?.documentName !== "Actor"
    || actor.type !== "personnage"
    || !relevantItem(item)
  ) return;

  scheduleSync(actor, "create-item");
});

Hooks.on("updateItem", (item, _changes, options, userId) => {
  if (
    options?.add2eArcaneSync
    || String(userId ?? "") !== String(game.user?.id ?? "")
  ) return;

  const actor = item?.parent;
  if (
    actor?.documentName !== "Actor"
    || actor.type !== "personnage"
    || !relevantItem(item)
  ) return;

  scheduleSync(actor, "update-item");
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (
    options?.add2eArcaneSync
    || String(userId ?? "") !== String(game.user?.id ?? "")
  ) return;

  const actor = item?.parent;
  if (
    actor?.documentName !== "Actor"
    || actor.type !== "personnage"
    || !relevantItem(item)
  ) return;

  scheduleSync(actor, "delete-item");
});

Hooks.on("createActor", (actor, _options, userId) => {
  if (
    String(userId ?? "") !== String(game.user?.id ?? "")
    || actor?.type !== "personnage"
  ) return;

  scheduleSync(actor, "create-actor");
});

Hooks.once("ready", async () => {
  installActionListener();

  const activeGM = game.users?.activeGM
    ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
    ?? null;

  if (
    !game.user?.isGM
    || (activeGM && activeGM.id !== game.user.id)
  ) return;

  for (const actor of game.actors?.contents ?? []) {
    if (actor.type !== "personnage") continue;

    try {
      await syncActorSpellbooks(actor, { reason: "ready-migration" });
    } catch (error) {
      console.error("[ADD2E][ARCANE_DOCUMENTS][READY_ERROR]", {
        actor: actor.name,
        error
      });
    }
  }
});

globalThis.ADD2E_ARCANE_DOCUMENTS_VERSION = VERSION;
globalThis.ADD2E_ARCANE_DOCUMENTS = {
  version: VERSION,
  isSpellbook,
  isScroll,
  documentEntries,
  syncActorSpellbooks,
  copySpellbook,
  viewSpellbook,
  castScroll,
  consumeScrollSpell,
  hydrateScroll
};

globalThis.add2eSyncActorSpellbooks = syncActorSpellbooks;
globalThis.add2eCopySpellbook = copySpellbook;
globalThis.add2eCastScroll = castScroll;
