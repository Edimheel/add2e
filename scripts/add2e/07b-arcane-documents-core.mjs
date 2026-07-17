// ADD2E — Documents arcaniques : noyau commun.
// Compatible Foundry V13/V14/V15. ApplicationV2 / DialogV2 uniquement.

export const VERSION = "2026-07-14-arcane-documents-v4";
export const ARCANE_LISTS = new Set(["magicien", "illusionniste"]);
export const SCROLL_LISTS = new Set(["magicien", "illusionniste", "clerc", "druide"]);
export const BOOK_NAMES = {
  magicien: "Livre de sorts — Magicien",
  illusionniste: "Livre de sorts — Illusionniste"
};
export const BOOK_IMAGES = {
  magicien: "icons/sundries/books/book-embossed-gold-red.webp",
  illusionniste: "icons/sundries/books/book-embossed-gold-blue.webp"
};

let spellIndexPromise = null;

export function clone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
}

export function norm(value) {
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

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function array(value) {
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

export function listKey(value) {
  try {
    if (typeof globalThis.add2eNormalizeSpellKey === "function") return globalThis.add2eNormalizeSpellKey(value);
  } catch (_error) {}
  const key = norm(value);
  return ({ wizard: "magicien", mage: "magicien", magician: "magicien", magic_user: "magicien", illusionist: "illusionniste", cleric: "clerc", druid: "druide" })[key] ?? key;
}

export function listLabel(value) {
  const key = listKey(value);
  return ({ magicien: "Magicien", illusionniste: "Illusionniste", clerc: "Clerc", druide: "Druide" })[key] ?? String(value ?? "Liste inconnue");
}

export function itemType(item) {
  return String(item?.type ?? "").toLowerCase();
}

export function spellLevel(item) {
  return Math.max(1, Number(item?.system?.niveau ?? item?.system?.level ?? item?.system?.niveau_sort ?? item?.system?.spellLevel ?? 1) || 1);
}

export function spellLists(item) {
  try {
    if (typeof globalThis.add2eGetSpellListsFromItem === "function") {
      return [...new Set(globalThis.add2eGetSpellListsFromItem(item).map(listKey).filter(Boolean))];
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

export function actorLists(actor, allowedLists = SCROLL_LISTS) {
  const result = new Set();
  try {
    for (const entry of globalThis.add2eGetSpellcastingEntries?.(actor) ?? []) {
      const key = listKey(entry?.key);
      if (allowedLists.has(key)) result.add(key);
    }
  } catch (_error) {}
  for (const item of actor?.items ?? []) {
    if (itemType(item) !== "classe") continue;
    const system = item.system ?? {};
    for (const value of [item.name, system.slug, system.label, system.nom, system.name]) {
      const key = listKey(value);
      if (allowedLists.has(key)) result.add(key);
    }
  }
  return [...result];
}

export function actorArcaneLists(actor) {
  return actorLists(actor, ARCANE_LISTS);
}

export function actorScrollLists(actor) {
  return actorLists(actor, SCROLL_LISTS);
}

export function cleanEmbedded(source) {
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

export function arcaneData(item) {
  const value = item?.system?.arcaneDocument;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function arcaneKind(item) {
  return String(arcaneData(item).kind ?? item?.flags?.add2e?.arcaneDocumentKind ?? "").trim().toLowerCase();
}

export function containerList(item) {
  const document = arcaneData(item);
  for (const value of [document.ownerList, document.spellList, item?.flags?.add2e?.ownerSpellList, item?.flags?.add2e?.arcaneSpellList]) {
    const key = listKey(value);
    if (SCROLL_LISTS.has(key)) return key;
  }
  const text = norm(`${item?.name ?? ""} ${item?.system?.sousType ?? item?.system?.sous_type ?? ""}`);
  if (text.includes("illusionniste")) return "illusionniste";
  if (text.includes("magicien")) return "magicien";
  if (text.includes("clerc")) return "clerc";
  if (text.includes("druide")) return "druide";
  return "";
}

export function isSpellbook(item) {
  if (itemType(item) !== "objet") return false;
  if (arcaneKind(item) === "spellbook") return true;
  const subtype = norm(item?.system?.sousType ?? item?.system?.sous_type);
  const name = norm(item?.name);
  return subtype.includes("livre_de_sorts") || name.startsWith("livre_de_sorts");
}

export function isScroll(item) {
  if (itemType(item) !== "objet") return false;
  if (arcaneKind(item) === "spell-scroll") return true;
  const subtype = norm(item?.system?.sousType ?? item?.system?.sous_type);
  const name = norm(item?.name);
  return subtype.includes("parchemin_de_sort") || name.startsWith("parchemin");
}

export function itemQuantity(item) {
  const value = item?.system?.quantite ?? item?.system?.quantity;
  if (value === undefined || value === null || value === "") return 1;
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function sourceUuid(item) {
  return String(item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.add2e?.sourceUuid ?? item?.flags?.add2e?.dropResolvedUuid ?? "").trim();
}

export function stableSpellKey(item, list = "") {
  const existing = String(item?.flags?.add2e?.stableSpellKey ?? item?.flags?.add2e?.spellStableKey ?? "").trim();
  if (existing) return existing;
  return `${listKey(list || spellLists(item)[0] || "sort")}|${spellLevel(item)}|${norm(item?.name)}`;
}

export function normalizeEntry(entry, fallbackList = "") {
  if (!entry) return null;
  const name = String(entry.name ?? entry.nom ?? entry.label ?? "").trim();
  if (!name) return null;
  const level = Math.max(1, Number(entry.level ?? entry.niveau ?? entry.spellLevel ?? 1) || 1);
  const lists = [...new Set([entry.lists, entry.spellLists, entry.classes, entry.classe, entry.class, fallbackList].flatMap(array).map(listKey).filter(Boolean))];
  return {
    key: String(entry.key ?? entry.stableKey ?? entry.spellKey ?? "").trim() || `${lists[0] ?? "sort"}|${level}|${norm(name)}`,
    name,
    level,
    lists,
    sourceUuid: String(entry.sourceUuid ?? entry.uuid ?? entry.sourceId ?? "").trim(),
    img: String(entry.img ?? entry.image ?? "icons/svg/book.svg")
  };
}

export function entryFromSpell(item, preferredList = "") {
  const allLists = spellLists(item);
  const selected = preferredList ? allLists.filter(key => key === listKey(preferredList)) : allLists;
  return normalizeEntry({
    key: stableSpellKey(item, preferredList),
    name: item.name,
    level: spellLevel(item),
    lists: selected.length ? selected : allLists,
    sourceUuid: sourceUuid(item),
    img: item.img
  }, preferredList);
}

export function documentEntries(item) {
  const document = arcaneData(item);
  const fallbackList = listKey(document.ownerList ?? document.spellList ?? containerList(item) ?? "");
  const source = Array.isArray(document.spells) ? document.spells : document.spell ? [document.spell] : Array.isArray(item?.system?.sorts) ? item.system.sorts : [];
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
  return entries.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, "fr"));
}

export function isKnownSpell(item) {
  if (itemType(item) !== "sort") return false;
  if (item.system?.isPower === true || item.system?.isObjectPower === true) return false;
  if (item.system?.isCapacity === true || item.flags?.add2e?.spellFamily?.generated === true) return false;
  return true;
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
      if (pack?.documentName !== "Item" || seen.has(pack.collection) || (!label.includes("sort") && !label.includes("spell"))) continue;
      packs.push(pack);
      seen.add(pack.collection);
    }
    const byName = new Map();
    for (const pack of packs) {
      let index;
      try {
        index = await pack.getIndex({ fields: ["name", "type", "system.niveau", "system.level", "system.spellLists", "system.liste", "system.classe"] });
      } catch (_error) {
        index = await pack.getIndex();
      }
      for (const entry of packEntries(index)) {
        if (itemType(entry) !== "sort") continue;
        const candidate = { pack, id: entry._id, name: entry.name, level: spellLevel(entry), lists: spellLists(entry) };
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

export async function resolveSpell(entry) {
  const normalized = normalizeEntry(entry);
  if (!normalized) return null;
  if (normalized.sourceUuid.startsWith("Compendium.") && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(normalized.sourceUuid);
      if (document?.documentName === "Item" && itemType(document) === "sort") return document;
    } catch (_error) {}
  }
  const index = await buildSpellIndex();
  const candidates = index.byName.get(norm(normalized.name)) ?? [];
  let selected = candidates.find(candidate => candidate.level === normalized.level && (!normalized.lists.length || normalized.lists.some(list => candidate.lists.includes(list)))) ?? null;
  selected ??= candidates.find(candidate => candidate.level === normalized.level) ?? candidates[0] ?? null;
  return selected ? selected.pack.getDocument(selected.id) : null;
}

export async function resolveSpellByName(name) {
  return resolveSpell({ name, level: 1, lists: [] });
}

function spellLearningChatCard({ actor = null, source = "", result = "", details = [], status = "", image = "" } = {}) {
  const portrait = image || actor?.img || "icons/svg/book.svg";
  const [spellNameRaw, bookNameRaw] = String(source ?? "").split(/\s+—\s+/, 2);
  const spellName = spellNameRaw?.trim() || "Sort inconnu";
  const bookName = bookNameRaw?.trim() || "Livre de sorts";
  const rows = array(details).filter(Boolean);
  const total = String(rows[0] ?? "").replace(/^Résultat\s*:\s*/i, "").replace(/<\/?b>/g, "").trim() || "—";
  const chance = String(rows[1] ?? "").replace(/^Chance\s*:\s*/i, "").replace(/<\/?b>/g, "").trim() || "—";
  const success = status === "success";
  const statusLabel = success ? "Réussite" : "Échec";
  const statusClass = success ? "is-success" : "is-failure";
  const sentence = success
    ? `${esc(spellName)} a été ajouté au livre personnel et à la liste des sorts.`
    : `${esc(spellName)} n’a pas été ajouté : le test de compréhension a échoué.`;

  return `<div class="add2e-card add2e-arcane-card add2e-book-learning-card ${statusClass}">
    <header class="add2e-card-header">
      <img src="${esc(portrait)}" alt="">
      <div>
        <h3><i class="fas fa-dice-d20"></i> Copie d’un sort depuis un livre</h3>
        <div class="add2e-card-source">${esc(bookName)}</div>
      </div>
    </header>
    <div class="add2e-card-body">
      <div class="add2e-book-learning-grid">
        <b>Sort</b><span>${esc(spellName)}</span>
        <b>Résultat</b><span>${esc(total)}</span>
        <b>Chance</b><span>${esc(chance)}</span>
      </div>
      <div class="add2e-book-learning-status">${statusLabel}</div>
      <p>${sentence}</p>
    </div>
  </div>`;
}

export function arcaneChatCard({ actor = null, title = "Document arcanique", source = "", result = "", details = [], status = "", icon = "fa-book", image = "" } = {}) {
  if (title === "Test de compréhension") {
    return spellLearningChatCard({ actor, source, result, details, status, image });
  }

  const portrait = image || actor?.img || "icons/svg/book.svg";
  const detailRows = array(details).filter(Boolean).map(detail => `<li>${detail}</li>`).join("");
  const statusClass = status ? ` is-${esc(status)}` : "";
  return `<div class="add2e-card add2e-arcane-card${statusClass}">
    <header class="add2e-card-header">
      <img src="${esc(portrait)}" alt="">
      <div>
        <h3><i class="fas ${esc(icon)}"></i> ${esc(title)}</h3>
        ${source ? `<div class="add2e-card-source">${esc(source)}</div>` : ""}
      </div>
    </header>
    <div class="add2e-card-body">
      ${result ? `<p><b>${result}</b></p>` : ""}
      ${detailRows ? `<ul>${detailRows}</ul>` : ""}
    </div>
  </div>`;
}

export async function createArcaneChatMessage({ actor = null, ...card } = {}) {
  return ChatMessage.create({ speaker: actor ? ChatMessage.getSpeaker({ actor }) : {}, content: arcaneChatCard({ actor, ...card }) });
}
