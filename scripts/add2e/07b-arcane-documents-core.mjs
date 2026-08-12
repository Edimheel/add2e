// ADD2E — Documents arcaniques : noyau commun.
// Compatible Foundry V13/V14/V15. ApplicationV2 / DialogV2 uniquement.

export const VERSION = "2026-08-12-canonical-spell-metadata-v7";
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

const SPELL_PACK_ID = "add2e.sorts";
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
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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
  const resolver = globalThis.add2eNormalizeSpellKey;
  if (typeof resolver !== "function") {
    throw new Error("Le normalisateur canonique ADD2E des listes de sorts est indisponible.");
  }
  return String(resolver(value) ?? "").trim();
}

export function listLabel(value) {
  const key = listKey(value);
  return ({ magicien: "Magicien", illusionniste: "Illusionniste", clerc: "Clerc", druide: "Druide" })[key] ?? String(value ?? "Liste inconnue");
}

export function itemType(item) {
  return String(item?.type ?? "").toLowerCase();
}

export function spellLevel(item) {
  const level = Number(item?.system?.niveau);
  return Number.isInteger(level) && level >= 1 ? level : 0;
}

export function spellLists(item) {
  const resolver = globalThis.add2eGetSpellListsFromItem;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E des listes d’un sort est indisponible.");
  }
  const resolved = resolver(item);
  if (!Array.isArray(resolved)) {
    throw new Error(`Listes canoniques invalides pour « ${item?.name ?? "sort inconnu"} ».`);
  }
  return [...new Set(resolved.map(listKey).filter(Boolean))];
}

export function actorLists(actor, allowedLists = SCROLL_LISTS) {
  const resolver = globalThis.add2eGetSpellcastingEntries;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E des traditions de sorts est indisponible.");
  }
  const entries = resolver(actor);
  if (!Array.isArray(entries)) {
    throw new Error(`Traditions canoniques invalides pour « ${actor?.name ?? "acteur inconnu"} ».`);
  }
  const result = new Set();
  for (const entry of entries) {
    const key = listKey(entry?.key);
    if (allowedLists.has(key)) result.add(key);
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
  const level = spellLevel(item);
  const lists = spellLists(item);
  const selectedList = listKey(list || lists[0] || "");
  const name = norm(item?.name);
  if (!selectedList || !name || level < 1) return "";
  return `${selectedList}|${level}|${name}`;
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
  const level = spellLevel(item);
  const allLists = spellLists(item);
  if (level < 1 || !allLists.length || !String(item?.name ?? "").trim()) return null;
  const wantedList = preferredList ? listKey(preferredList) : "";
  const selected = wantedList ? allLists.filter(key => key === wantedList) : allLists;
  if (wantedList && !selected.length) return null;
  return normalizeEntry({
    key: stableSpellKey(item, wantedList),
    name: item.name,
    level,
    lists: selected.length ? selected : allLists,
    sourceUuid: sourceUuid(item),
    img: item.img
  }, wantedList);
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
    const byName = new Map();
    const pack = game.packs?.get?.(SPELL_PACK_ID);
    if (!pack || pack.documentName !== "Item") return { byName };

    let index;
    try {
      index = await pack.getIndex({ fields: ["name", "type", "system.niveau", "system.spellLists"] });
    } catch (_error) {
      index = await pack.getIndex();
    }

    for (const entry of packEntries(index)) {
      if (itemType(entry) !== "sort") continue;
      const level = spellLevel(entry);
      const lists = spellLists(entry);
      if (level < 1 || !lists.length) {
        console.warn("[ADD2E][ARCANE_DOCUMENTS][INVALID_COMPENDIUM_SPELL]", {
          name: entry?.name,
          id: entry?._id,
          level,
          lists
        });
        continue;
      }
      const candidate = { pack, id: entry._id, name: entry.name, level, lists };
      const key = norm(entry.name);
      const bucket = byName.get(key) ?? [];
      bucket.push(candidate);
      byName.set(key, bucket);
    }
    return { byName };
  })();
  return spellIndexPromise;
}

export async function resolveSpell(entry) {
  const normalized = normalizeEntry(entry);
  if (!normalized) return null;
  const allowedPrefix = `Compendium.${SPELL_PACK_ID}.`;
  if (normalized.sourceUuid.startsWith(allowedPrefix) && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(normalized.sourceUuid);
      if (document?.documentName === "Item" && itemType(document) === "sort") return document;
    } catch (_error) {}
  }

  const index = await buildSpellIndex();
  const candidates = (index.byName.get(norm(normalized.name)) ?? [])
    .filter(candidate => candidate.level === normalized.level)
    .filter(candidate => !normalized.lists.length || normalized.lists.some(list => candidate.lists.includes(list)));
  if (!candidates.length) return null;

  const ordered = [...candidates].sort((left, right) => String(left.id).localeCompare(String(right.id), "fr"));
  if (ordered.length > 1) {
    console.warn("[ADD2E][ARCANE_DOCUMENTS][DUPLICATE_CANONICAL_SPELL]", {
      name: normalized.name,
      level: normalized.level,
      lists: normalized.lists,
      matches: ordered.map(candidate => candidate.id)
    });
  }
  return ordered[0].pack.getDocument(ordered[0].id);
}

export async function resolveSpellByName(name) {
  return resolveSpell({ name, level: 1, lists: [] });
}

function spellLearningChatCard({ actor = null, source = "", details = [], status = "", image = "" } = {}) {
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
    return spellLearningChatCard({ actor, source, details, status, image });
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
  if (card.title === "Copie d'un livre de sorts" || card.title === "Copie d'un sort depuis un livre") return null;
  return ChatMessage.create({ speaker: actor ? ChatMessage.getSpeaker({ actor }) : {}, content: arcaneChatCard({ actor, ...card }) });
}
