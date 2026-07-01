// ADD2E — Core armurier : stock armes/armures/projectiles, achats, affectation MJ et compatibilité acteur.

export const ADD2E_ARMORER_VERSION = "2026-07-01-armorer-v6-world-projectile-stock";
export const ARMORER_SCOPE = "add2e";
export const ARMORER_NAME = "Armurier";
export const ARMORER_FOLDER = "ADD2E — Boutique";
export const ARMORER_SETTING = "armorerCreationVersion";
export const ARMORER_TOKEN_IMG = "icons/environment/settlement/blacksmith.webp";
export const ARMORER_BUY_REQUEST = "ADD2E_ARMORER_BUY_REQUEST";
export const ARMORER_BUY_RESULT = "ADD2E_ARMORER_BUY_RESULT";

export const COINS = [
  { key: "pp", label: "PP", pc: 500 },
  { key: "po", label: "PO", pc: 100 },
  { key: "pe", label: "PE", pc: 50 },
  { key: "pa", label: "PA", pc: 10 },
  { key: "pc", label: "PC", pc: 1 }
];

export const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
export const lower = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const slug = v => lower(v).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function esc(v) {
  const d = document.createElement("div");
  d.textContent = String(v ?? "");
  return d.innerHTML;
}

const asArray = v => Array.isArray(v)
  ? v
  : v === null || v === undefined || v === ""
    ? []
    : typeof v === "string"
      ? v.split(/[,;|]/g).map(x => x.trim()).filter(Boolean)
      : [v];

export function tags(item) {
  const s = item?.system ?? {};
  const f = item?.flags?.add2e ?? {};
  return [...asArray(s.tags), ...asArray(s.effectTags), ...asArray(f.tags)].map(lower).filter(Boolean);
}

export const quantity = item => Math.max(0, Math.floor(num(item?.system?.quantite ?? item?.system?.quantity ?? 0, 0)));
export const quantityUpdate = v => ({ "system.quantite": Math.max(0, Math.floor(num(v, 0))) });
export const isArmorerActor = actor => actor?.getFlag?.(ARMORER_SCOPE, "isArmorer") === true || actor?.name === ARMORER_NAME;

function ammunitionNameMatch(item) {
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|aiguille|aiguilles|pierre de fronde|pierres de fronde|balle d[’']arquebuse|balles d[’']arquebuse)\b/i.test(String(item?.name ?? ""));
}

export function isArmorerAmmunition(item) {
  if (!item) return false;
  const s = item.system ?? {};
  const fields = [s.categorie, s.category, s.sousType, s.sous_type, s.type, s.subtype, s.kind, s.slot].map(lower).filter(Boolean);
  const t = tags(item);
  const name = lower(item.name);

  if (/\b(carquois|quiver|etui|etuis|étui|étuis|sac|sacoche|container|contenant|boite|boîte|bourse)\b/.test(name)) return false;
  if (fields.some(v => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(v))) return false;
  if (t.some(v => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(v))) return false;

  if (fields.some(v => ["munition", "munitions", "ammo", "ammunition"].includes(v))) return true;
  if (t.some(v => v === "munition" || v === "trait:munition" || v === "categorie:munition" || v === "type:munition" || v.startsWith("munition:"))) return true;

  if (t.some(v => ["usage:projectile_propulse", "type_arme:projectile_propulse", "trait:projectile_propulse"].includes(v))) return false;
  if (fields.some(v => ["projectile_propulse", "arc", "arbalete", "arbalète", "fronde"].includes(v))) return false;

  return ammunitionNameMatch(item);
}

export const isArmorerStockItem = item => item?.type === "arme" || item?.type === "armure" || isArmorerAmmunition(item);
export const defaultStock = item => isArmorerAmmunition(item) ? 40 : item?.type === "arme" ? 5 : 4;
export const stockMax = item => Math.max(1, Math.floor(num(item?.getFlag?.(ARMORER_SCOPE, "armorerStockMax"), defaultStock(item))));
export const armorerKind = item => isArmorerAmmunition(item) ? "Projectile" : item?.type === "arme" ? "Arme" : item?.type === "armure" ? "Armure" : "Article";
export const itemKey = item => `${isArmorerAmmunition(item) ? "munition" : item?.type ?? "item"}:${slug(item?.name ?? "")}`;

let ARMORER_CATALOG_CACHE = null;
let ARMORER_CATALOG_PROMISE = null;
let ARMORER_WORLD_ITEM_SYNC_TIMER = null;
export function clearArmorerCatalogCache() { ARMORER_CATALOG_CACHE = null; ARMORER_CATALOG_PROMISE = null; }

function packIds(kind) {
  const base = kind === "armes" ? ["add2e.armes", "world.armes"] : ["add2e.armures", "world.armures"];
  for (const [id, pack] of game.packs ?? []) {
    const text = `${id} ${pack?.metadata?.label ?? ""}`;
    if (kind === "armes" && /\barmes?\b|weapons?/i.test(text) && !base.includes(id)) base.push(id);
    if (kind === "armures" && /armures?|armor|armour/i.test(text) && !base.includes(id)) base.push(id);
  }
  return base;
}

export function moneyFrom(raw = {}) {
  const m = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const c of COINS) m[c.key] = Math.max(0, Math.floor(num(raw?.[c.key], 0)));
  return m;
}

export function getMoney(actor) {
  const f = actor?.getFlag?.(ARMORER_SCOPE, "monnaie") ?? actor?.getFlag?.("add2e", "monnaie");
  if (f && typeof f === "object") return moneyFrom(f);
  const s = actor?.system?.monnaie ?? actor?.system?.argent ?? actor?.system?.currency;
  return s && typeof s === "object" ? moneyFrom(s) : moneyFrom({});
}

export async function setMoney(actor, money) {
  if (!actor?.setFlag) return false;
  await actor.setFlag("add2e", "monnaie", moneyFrom(money));
  return true;
}

export function toCopper(money) {
  const m = moneyFrom(money);
  return COINS.reduce((sum, c) => sum + m[c.key] * c.pc, 0);
}

export function fromCopper(total) {
  let rest = Math.max(0, Math.floor(num(total, 0)));
  const m = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const c of COINS) {
    m[c.key] = Math.floor(rest / c.pc);
    rest %= c.pc;
  }
  return m;
}

export function formatMoney(value) {
  const m = typeof value === "number" ? fromCopper(value) : moneyFrom(value);
  const parts = COINS.map(c => m[c.key] ? `${m[c.key]} ${c.label}` : "").filter(Boolean);
  return parts.length ? parts.join(" ") : "0 PC";
}

export function priceCopper(item) {
  const s = item?.system ?? {};
  const raw = s.prix ?? s.price ?? s.cout ?? s.coût ?? s.cost ?? item?.getFlag?.(ARMORER_SCOPE, "prix") ?? null;
  let value = 0;
  let devise = s.devise ?? s.currency ?? item?.getFlag?.(ARMORER_SCOPE, "devise") ?? "po";

  if (typeof raw === "number") value = raw;
  else if (typeof raw === "string") {
    const m = raw.match(/([0-9]+(?:[\.,][0-9]+)?)\s*(pp|po|pe|pa|pc)?/i);
    if (m) {
      value = Number(String(m[1]).replace(",", "."));
      if (m[2]) devise = m[2].toLowerCase();
    }
  } else if (raw && typeof raw === "object") {
    value = raw.valeur ?? raw.value ?? raw.montant ?? raw.amount ?? 0;
    devise = raw.devise ?? raw.currency ?? devise;
  }

  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    value = 1;
    devise = isArmorerAmmunition(item) ? "pa" : "po";
  }
  const coin = COINS.find(c => c.key === lower(devise)) ?? COINS.find(c => c.key === "po");
  return Math.max(1, Math.round(Number(value) * coin.pc));
}

function sameItem(a, b) {
  if (isArmorerAmmunition(a) || isArmorerAmmunition(b)) return slug(a?.name) === slug(b?.name);
  return String(a?.type ?? b?.type ?? "") && slug(a?.name) === slug(b?.name) && String(a?.type) === String(b?.type);
}

export function getBuyer() {
  const c = game.user?.character;
  if (c && !isArmorerActor(c) && (c.isOwner || game.user?.isGM)) return c;
  const controlled = canvas?.tokens?.controlled?.[0]?.actor;
  if (controlled && !isArmorerActor(controlled) && (controlled.isOwner || game.user?.isGM)) return controlled;
  return null;
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

export async function dialog({ title = "Armurier", content = "", yes = "Compris", no = "Fermer" } = {}) {
  const D = foundry?.applications?.api?.DialogV2;
  if (D?.confirm) return D.confirm({ window: { title }, content, yes: { label: yes }, no: { label: no }, modal: true });
  ui.notifications?.warn?.(content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
  return false;
}

export const alertBox = (title, message) => dialog({
  title,
  content: `<div class="add2e-dialog add2e-armorer-alert"><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`
});

async function readPack(packId) {
  const pack = game.packs?.get?.(packId);
  if (!pack) return [];
  try {
    const docs = await pack.getDocuments();
    if (Array.isArray(docs) && docs.length) return docs;
  } catch (e) {
    console.warn("[ADD2E][ARMORER][PACK_DOCUMENTS_ERROR]", packId, e);
  }
  try {
    const index = await pack.getIndex({ fields: ["name", "type", "system"] });
    const docs = [];
    for (const e of index ?? []) {
      const d = await pack.getDocument(e._id);
      if (d) docs.push(d);
    }
    return docs;
  } catch (e) {
    console.warn("[ADD2E][ARMORER][PACK_INDEX_ERROR]", packId, e);
    return [];
  }
}

async function collectSources() {
  const out = [];
  const seen = new Set();
  const add = doc => {
    if (!isArmorerStockItem(doc)) return;
    const key = itemKey(doc);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(doc);
  };

  for (const pid of packIds("armes")) for (const doc of await readPack(pid)) add(doc);
  for (const pid of packIds("armures")) for (const doc of await readPack(pid)) add(doc);
  // Les munitions importées en objets Monde ne résident pas forcément dans add2e.armes.
  for (const item of game.items ?? []) add(item);
  return out.sort((a, b) => String(armorerKind(a)).localeCompare(String(armorerKind(b))) || String(a.name).localeCompare(String(b.name)));
}

async function buildStockData() {
  if (ARMORER_CATALOG_CACHE) return foundry.utils.deepClone(ARMORER_CATALOG_CACHE);
  if (ARMORER_CATALOG_PROMISE) return foundry.utils.deepClone(await ARMORER_CATALOG_PROMISE);

  ARMORER_CATALOG_PROMISE = (async () => (await collectSources()).map(doc => {
    const data = doc.toObject ? doc.toObject() : foundry.utils.deepClone(doc);
    delete data._id;
    data.system = data.system ?? {};
    data.system.quantite = Math.max(quantity(doc), defaultStock(doc));
    data.flags = data.flags ?? {};
    data.flags.add2e = data.flags.add2e ?? {};
    data.flags.add2e.armorerItem = true;
    data.flags.add2e.armorerCatalogKey = itemKey(doc);
    data.flags.add2e.armorerStockMax = data.system.quantite;
    if (isArmorerAmmunition(data)) data.flags.add2e.armorerKind = "projectile";
    return data;
  }))();

  ARMORER_CATALOG_CACHE = await ARMORER_CATALOG_PROMISE;
  ARMORER_CATALOG_PROMISE = null;
  return foundry.utils.deepClone(ARMORER_CATALOG_CACHE);
}

function pseudoItemFromData(data) {
  return {
    id: `catalog:${data.flags?.add2e?.armorerCatalogKey ?? slug(data.name)}`,
    name: data.name,
    type: data.type,
    img: data.img,
    system: data.system ?? {},
    flags: data.flags ?? {},
    getFlag: (scope, key) => data.flags?.[scope]?.[key],
    toObject: () => foundry.utils.deepClone(data)
  };
}

export async function getArmorerDisplayItems(armorer) {
  const actorItems = Array.from(armorer?.items ?? []).filter(isArmorerStockItem);
  if (actorItems.length) return actorItems;
  return (await buildStockData()).map(pseudoItemFromData);
}

export async function ensureStock(armorer) {
  if (!game.user?.isGM || !armorer) return 0;
  const docs = await buildStockData();
  const existing = Array.from(armorer.items ?? []);
  const create = docs.filter(d => !existing.some(i => sameItem(i, d)));
  if (create.length) await armorer.createEmbeddedDocuments("Item", create, { add2eReason: "armorer-ensure-stock" });
  if (create.length) ui.notifications?.info?.(`${armorer.name} : ${create.length} article(s) ajouté(s) au stock.`);
  return create.length;
}

export function findArmorer() {
  return Array.from(game.actors ?? []).find(isArmorerActor) ?? null;
}

async function ensureFolder() {
  if (!game.user?.isGM) return null;
  return Array.from(game.folders ?? []).find(f => f.type === "Actor" && f.name === ARMORER_FOLDER)
    ?? Folder.create({ name: ARMORER_FOLDER, type: "Actor", color: "#69431a" }, { add2eReason: "armorer-folder-create" });
}

export async function moveToFolder(armorer = null) {
  if (!game.user?.isGM) return false;
  armorer = armorer ?? findArmorer();
  if (!armorer) return false;
  const folder = await ensureFolder();
  if (folder && armorer.folder?.id !== folder.id && armorer.folder !== folder.id) await armorer.update({ folder: folder.id }, { add2eReason: "armorer-folder-move" });
  return true;
}

export async function updateTokenSize(armorer = null) {
  if (!game.user?.isGM) return false;
  armorer = armorer ?? findArmorer();
  if (!armorer) return false;
  await armorer.update({
    img: ARMORER_TOKEN_IMG,
    "prototypeToken.width": 2,
    "prototypeToken.height": 2,
    "prototypeToken.texture.src": ARMORER_TOKEN_IMG,
    "flags.add2e.armorerVersion": ADD2E_ARMORER_VERSION
  }, { add2eReason: "armorer-token-image-size" });
  return true;
}

export async function createArmorer({ force = false } = {}) {
  if (!game.user?.isGM) return null;
  const ex = findArmorer();
  if (ex && !force) {
    await moveToFolder(ex);
    await updateTokenSize(ex);
    await ensureStock(ex);
    return ex;
  }

  const folder = await ensureFolder();
  const actor = await Actor.create({
    name: ARMORER_NAME,
    type: "personnage",
    folder: folder?.id ?? null,
    img: ARMORER_TOKEN_IMG,
    ownership: { default: CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
    prototypeToken: { name: ARMORER_NAME, actorLink: true, width: 2, height: 2, texture: { src: ARMORER_TOKEN_IMG } },
    flags: { add2e: { isArmorer: true, armorerVersion: ADD2E_ARMORER_VERSION, monnaie: { pc: 0, pa: 0, pe: 0, po: 1000, pp: 0 } } }
  }, { renderSheet: false, add2eReason: "armorer-create" });

  const stock = await buildStockData();
  if (stock.length) await actor.createEmbeddedDocuments("Item", stock, { add2eReason: "armorer-initial-stock" });
  await game.settings.set("add2e", ARMORER_SETTING, ADD2E_ARMORER_VERSION);
  return actor;
}

export async function ensureArmorerOnLaunch() {
  if (!game.user?.isGM) return;
  const a = findArmorer();
  if (a) {
    await moveToFolder(a);
    await updateTokenSize(a);
    await ensureStock(a);
    return;
  }
  if (game.settings.get("add2e", ARMORER_SETTING) !== ADD2E_ARMORER_VERSION) await createArmorer();
}

function resolveStockItem(armorer, itemId, key) {
  return armorer?.items?.get?.(itemId)
    ?? Array.from(armorer?.items ?? []).find(i => i.getFlag?.(ARMORER_SCOPE, "armorerCatalogKey") === key || itemKey(i) === key)
    ?? null;
}

async function subtractMoney(actor, copper) {
  const total = toCopper(getMoney(actor));
  if (total < copper) return false;
  await setMoney(actor, fromCopper(total - copper));
  return true;
}

function purchasedItemData(item, qty) {
  const data = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
  delete data._id;
  data.system = data.system ?? {};
  data.system.quantite = qty;
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.purchasedFromArmorer = true;

  if (isArmorerAmmunition(item)) {
    data.type = "objet";
    data.system.categorie = "munition";
    data.system.type = "munition";
    data.flags.add2e.armorerKind = "projectile";
  }

  return data;
}

async function mergeOrCreate(actor, item, qty) {
  const ex = Array.from(actor.items ?? []).find(i => sameItem(i, item));
  if (ex) return ex.update(quantityUpdate(quantity(ex) + qty), { add2eReason: "armorer-buy-merge" });

  const data = purchasedItemData(item, qty);
  const created = await actor.createEmbeddedDocuments("Item", [data], { add2eReason: "armorer-buy-create" });
  return created?.[0] ?? null;
}

export async function buyLocal({ armorer, buyer, item, quantity: qty }, { confirm = true } = {}) {
  if (!armorer || !buyer || !item) return { ok: false, message: "Armurier, acheteur ou article introuvable." };
  qty = Math.max(1, Math.floor(num(qty, 1)));
  if (quantity(item) < qty) return { ok: false, message: `${item.name} : stock disponible ${quantity(item)}.` };
  const total = priceCopper(item) * qty;
  if (toCopper(getMoney(buyer)) < total) return { ok: false, message: `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.` };
  if (confirm && !await dialog({ title: "Confirmer l’achat", content: `<p>Acheter <b>${qty} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: "Acheter", no: "Annuler" })) return { ok: false, cancelled: true };
  if (!await subtractMoney(buyer, total)) return { ok: false, message: "Paiement impossible." };
  await item.update(quantityUpdate(quantity(item) - qty), { add2eReason: "armorer-stock-decrease" });
  await mergeOrCreate(buyer, item, qty);
  return { ok: true, message: `${buyer.name} achète ${qty} × ${item.name} pour ${formatMoney(total)}.` };
}

export async function buy(args) {
  if (game.user?.isGM) {
    const r = await buyLocal(args, { confirm: true });
    if (!r.ok && !r.cancelled) await alertBox("Achat impossible", r.message);
    else if (r.ok) ui.notifications?.info?.(r.message);
    return r.ok;
  }

  const { armorer, buyer, item } = args;
  const qty = Math.max(1, Math.floor(num(args.quantity, 1)));
  if (!armorer || !buyer || !item) return false;
  const total = priceCopper(item) * qty;
  if (quantity(item) < qty) return alertBox("Stock insuffisant", `${item.name} : stock disponible ${quantity(item)}.`).then(() => false);
  if (toCopper(getMoney(buyer)) < total) return alertBox("Argent insuffisant", `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.`).then(() => false);
  if (!await dialog({ title: "Confirmer l’achat", content: `<p>Acheter <b>${qty} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: "Acheter", no: "Annuler" })) return false;

  game.socket?.emit?.("system.add2e", {
    type: ARMORER_BUY_REQUEST,
    requestId: foundry.utils.randomID(),
    userId: game.user.id,
    armorerId: armorer.id,
    buyerId: buyer.id,
    itemId: item.id?.startsWith?.("catalog:") ? null : item.id,
    itemKey: item.getFlag?.(ARMORER_SCOPE, "armorerCatalogKey") ?? itemKey(item),
    quantity: qty
  });
  return true;
}

export async function restockAll(armorer) {
  if (!game.user?.isGM) return false;
  const updates = Array.from(armorer.items ?? []).filter(isArmorerStockItem).map(i => ({ _id: i.id, "system.quantite": stockMax(i) }));
  if (updates.length) await armorer.updateEmbeddedDocuments("Item", updates, { add2eReason: "armorer-restock-all" });
  return true;
}

export async function setStock(item, value) {
  if (!game.user?.isGM || !item?.update) return false;
  await item.update(quantityUpdate(value), { add2eReason: "armorer-manual-restock" });
  return true;
}

export function sceneTokenChoices() {
  return Array.from(canvas?.tokens?.placeables ?? [])
    .filter(t => t?.actor && !isArmorerActor(t.actor))
    .map(t => ({ token: t, tokenId: t.id, label: `${t.name} — ${t.actor.name}` }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

export async function assignItemToToken({ armorer, item, token, quantity: qty } = {}) {
  if (!game.user?.isGM) return { ok: false, message: "Action réservée au MJ." };
  if (!armorer || !item) return { ok: false, message: "Armurier ou article introuvable." };
  const actor = token?.actor ?? null;
  if (!actor) return { ok: false, message: "Token ou acteur cible introuvable." };
  qty = Math.max(1, Math.floor(num(qty, 1)));
  if (quantity(item) < qty) return { ok: false, message: `${item.name} : stock disponible ${quantity(item)}.` };
  await item.update(quantityUpdate(quantity(item) - qty), { add2eReason: "armorer-assign-item-stock-decrease" });
  await mergeOrCreate(actor, item, qty);
  return { ok: true, message: `${qty} × ${item.name} affecté(s) à ${token.name}.` };
}

function actorClassItems(actor) {
  return Array.from(actor?.items ?? []).filter(i => i?.type === "classe");
}

function flattenTokens(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(flattenTokens);
  if (typeof v === "object") return Object.values(v).flatMap(flattenTokens);
  return String(v).split(/[,;|/]/g).map(x => x.trim()).filter(Boolean);
}

function actorClassNames(actor) {
  const names = actorClassItems(actor).map(c => c.name);
  const s = actor?.system ?? {};
  names.push(...flattenTokens([s.classe, s.class, s.details_classe, s.details?.classe, s.details?.class, s.classes, s.details?.classes]));
  return names.map(lower).filter(Boolean);
}

function classFallbackTokensFromName(name, category) {
  if (category === "armure") {
    if (/magicien|illusionniste|voleur|moine/.test(name)) return ["aucune"];
    if (/clerc|druide|guerrier|paladin|ranger|assassin/.test(name)) return ["toutes"];
    return [];
  }
  if (/magicien|illusionniste/.test(name)) return ["baton", "bâton", "dague", "flechette", "fléchette"];
  if (/clerc/.test(name)) return ["baton", "bâton", "fleau", "fléau", "marteau", "masse", "massue"];
  if (/druide/.test(name)) return ["serpe", "faucille", "dague", "lance", "fronde", "baton", "bâton", "cimeterre"];
  if (/voleur/.test(name)) return ["dague", "epee", "épée", "flechette", "fléchette", "fronde", "massue", "arc court"];
  if (/guerrier|paladin|ranger|assassin/.test(name)) return ["toutes"];
  if (/moine/.test(name)) return ["gourdin", "arbalete", "arbalète", "dague", "hachette", "javelot", "jo", "nunchaku", "baton", "bâton", "shuriken", "fronde", "lance"];
  return [];
}

function classTokens(actor, category) {
  const vals = [];
  for (const cls of actorClassItems(actor)) {
    const s = cls.system ?? {};
    const source = category === "arme"
      ? [s.weaponsAllowed, s.weaponAllowed, s.weaponRestriction, s.allowedWeapons, s.armes_autorisees, s.armesAutorisees]
      : [s.armorAllowed, s.armorsAllowed, s.armorRestriction, s.allowedArmor, s.armures_autorisees, s.armuresAutorisees, s.shieldAllowed];
    for (const v of source) vals.push(...flattenTokens(v));
  }
  for (const name of actorClassNames(actor)) vals.push(...classFallbackTokensFromName(name, category));
  return vals.map(lower).filter(Boolean);
}

function itemTokens(item) {
  const s = item?.system ?? {};
  return [item?.name, s.nom, s.categorie, s.category, s.sousType, s.sous_type, s.type, s.famille_arme, s.famille, s.taille, ...tags(item)].flatMap(flattenTokens).map(lower).filter(Boolean);
}

function tokenMatches(a, t) {
  if (!a || !t) return false;
  if (a === t) return true;
  if (a.length >= 4 && t.includes(a)) return true;
  return false;
}

function matchAllowed(allowed, item, hasClass) {
  if (!allowed.length) return { known: hasClass, ok: !hasClass, reason: hasClass ? "Aucune autorisation de classe trouvée" : "Aucune classe détectée" };
  if (allowed.some(t => /^(aucune|aucun|none|interdit|non)$/i.test(t))) return { known: true, ok: false, reason: "Aucune armure/arme autorisée par la classe" };
  if (allowed.some(t => /^(toutes?|all|any|libre|autorisees?|autorise)$/i.test(t))) return { known: true, ok: true, reason: "Toutes les options sont autorisées" };
  const tokens = itemTokens(item);
  const ok = allowed.some(a => tokens.some(t => tokenMatches(a, t)));
  return { known: true, ok, reason: ok ? "Autorisé par la classe" : "Non listé dans les restrictions de classe" };
}

export function usabilityForActor(actor, item) {
  if (!actor || !item) return { state: "neutral", usable: true, label: "Aucun acteur acheteur", reason: "Aucun acteur acheteur" };
  if (isArmorerAmmunition(item)) return { state: "usable", usable: true, label: "Projectile", reason: "Munition rangée dans le carquois" };

  const hasClass = actorClassItems(actor).length > 0 || actorClassNames(actor).length > 0;
  if (item.type === "arme") {
    const r = matchAllowed(classTokens(actor, "arme"), item, hasClass);
    return { state: r.ok ? "usable" : "unusable", usable: r.ok, label: r.ok ? "Utilisable" : "Non utilisable", reason: r.reason };
  }
  if (item.type === "armure") {
    const r = matchAllowed(classTokens(actor, "armure"), item, hasClass);
    return { state: r.ok ? "usable" : "unusable", usable: r.ok, label: r.ok ? "Utilisable" : "Non utilisable", reason: r.reason };
  }
  return { state: "neutral", usable: true, label: "Article", reason: "Article hors armurerie" };
}

function queueWorldItemStockSync() {
  clearArmorerCatalogCache();
  if (!game.user?.isGM || ARMORER_WORLD_ITEM_SYNC_TIMER) return;
  ARMORER_WORLD_ITEM_SYNC_TIMER = window.setTimeout(async () => {
    ARMORER_WORLD_ITEM_SYNC_TIMER = null;
    const armorer = findArmorer();
    if (armorer) await ensureStock(armorer);
  }, 150);
}

function registerWorldItemCatalogSync() {
  if (globalThis.__ADD2E_ARMORER_WORLD_ITEM_CATALOG_SYNC_V6) return;
  globalThis.__ADD2E_ARMORER_WORLD_ITEM_CATALOG_SYNC_V6 = true;
  Hooks.on("createItem", item => {
    if (item?.parent || !isArmorerStockItem(item)) return;
    queueWorldItemStockSync();
  });
  Hooks.on("deleteItem", item => {
    if (item?.parent || !isArmorerStockItem(item)) return;
    clearArmorerCatalogCache();
  });
}

export function registerSockets() {
  if (globalThis.__ADD2E_ARMORER_SOCKET_REGISTERED_V5_AMMUNITION_TO_QUIVER) return;
  globalThis.__ADD2E_ARMORER_SOCKET_REGISTERED_V5_AMMUNITION_TO_QUIVER = true;

  game.socket?.on?.("system.add2e", async data => {
    if (!data || typeof data !== "object") return;

    if (data.type === ARMORER_BUY_RESULT) {
      if (data.userId !== game.user?.id) return;
      data.ok ? ui.notifications?.info?.(data.message ?? "Achat effectué.") : ui.notifications?.warn?.(data.message ?? "Achat impossible.");
      Hooks.callAll?.("add2eArmorerMoneyChanged", data);
      return;
    }

    if (data.type !== ARMORER_BUY_REQUEST || !isResponsibleGM()) return;

    const armorer = game.actors?.get(data.armorerId) ?? findArmorer();
    if (armorer) await ensureStock(armorer);
    const buyer = game.actors?.get(data.buyerId);
    const item = resolveStockItem(armorer, data.itemId, data.itemKey);
    let result = { ok: false, message: "Achat impossible." };

    try {
      result = await buyLocal({ armorer, buyer, item, quantity: data.quantity }, { confirm: false });
    } catch (e) {
      result = { ok: false, message: e?.message || "Erreur pendant l'achat." };
    }

    game.socket?.emit?.("system.add2e", {
      type: ARMORER_BUY_RESULT,
      requestId: data.requestId,
      userId: data.userId,
      ok: !!result.ok,
      message: result.message
    });
  });
}

export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  Object.assign(game.add2e, {
    armorerVersion: ADD2E_ARMORER_VERSION,
    createDefaultArmorer: createArmorer,
    findDefaultArmorer: findArmorer,
    ensureArmorerStock: ensureStock,
    updateArmorerTokenSize: updateTokenSize,
    moveArmorerToFolder: moveToFolder,
    armorerUsability: usabilityForActor,
    getArmorerDisplayItems,
    assignArmorerItemToToken: assignItemToToken,
    clearArmorerCatalogCache,
    isArmorerAmmunition
  });

  registerWorldItemCatalogSync();
  globalThis.ADD2E_ARMORER_VERSION = ADD2E_ARMORER_VERSION;
  globalThis.add2eCreateDefaultArmorer = createArmorer;
  globalThis.add2eArmorerUsability = usabilityForActor;
  globalThis.add2eAssignArmorerItemToToken = assignItemToToken;
  globalThis.add2eClearArmorerCatalogCache = clearArmorerCatalogCache;
  globalThis.add2eIsArmorerAmmunition = isArmorerAmmunition;
}
