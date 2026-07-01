// ADD2E — Core armurier : armes, armures et projectiles du compendium.

export const ADD2E_ARMORER_VERSION = "2026-07-01-armorer-v6-compendium-projectiles";
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

export const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const lower = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const slug = value => lower(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
export function esc(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }

const array = value => Array.isArray(value) ? value : value === null || value === undefined || value === "" ? [] : typeof value === "string" ? value.split(/[,;|]/g).map(v => v.trim()).filter(Boolean) : [value];
export function tags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [...array(system.tags), ...array(system.effectTags), ...array(flags.tags), ...array(flags.effectTags)].map(lower).filter(Boolean);
}

export const quantity = item => Math.max(0, Math.floor(num(item?.system?.quantite ?? item?.system?.quantity, 0)));
export const quantityUpdate = value => ({ "system.quantite": Math.max(0, Math.floor(num(value, 0))) });
export const isArmorerActor = actor => actor?.getFlag?.(ARMORER_SCOPE, "isArmorer") === true || actor?.name === ARMORER_NAME;

export function isArmorerAmmunition(item) {
  if (!item) return false;
  const system = item.system ?? {};
  const fields = [system.categorie, system.category, system.sousType, system.sous_type, system.type, system.subtype, system.kind, system.slot].map(lower).filter(Boolean);
  const itemTags = tags(item);
  const name = lower(item.name);
  const markers = new Set(["munition", "munitions", "projectile", "projectiles", "ammo", "ammunition", "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile", "type:munition", "type:projectile", "type_arme:munition"]);

  if (/\b(carquois|quiver|etui|etuis|étui|étuis|sac|sacoche|container|contenant|boite|boîte|bourse)\b/.test(name)) return false;
  if (fields.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (itemTags.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (fields.some(value => markers.has(value))) return true;
  if (itemTags.some(value => markers.has(value) || value.startsWith("munition:") || value.startsWith("projectile:"))) return true;
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|aiguille|aiguilles|pierre de fronde|pierres de fronde|balle d[’']arquebuse|balles d[’']arquebuse)\b/.test(name);
}

export const isArmorerStockItem = item => item?.type === "arme" || item?.type === "armure" || isArmorerAmmunition(item);
export const defaultStock = item => isArmorerAmmunition(item) ? 40 : item?.type === "arme" ? 5 : 4;
export const stockMax = item => Math.max(1, Math.floor(num(item?.getFlag?.(ARMORER_SCOPE, "armorerStockMax"), defaultStock(item))));
export const armorerKind = item => isArmorerAmmunition(item) ? "Projectile" : item?.type === "arme" ? "Arme" : item?.type === "armure" ? "Armure" : "Article";
export const itemKey = item => `${isArmorerAmmunition(item) ? "munition" : item?.type ?? "item"}:${slug(item?.name)}`;

let catalogCache = null;
let catalogPromise = null;
export function clearArmorerCatalogCache() { catalogCache = null; catalogPromise = null; }

function packIds(kind) {
  const ids = kind === "armes" ? ["add2e.armes", "world.armes"] : ["add2e.armures", "world.armures"];
  for (const [id, pack] of game.packs ?? []) {
    const text = `${id} ${pack?.metadata?.label ?? ""}`;
    if (kind === "armes" && /\barmes?\b|weapons?/i.test(text) && !ids.includes(id)) ids.push(id);
    if (kind === "armures" && /armures?|armor|armour/i.test(text) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function moneyFrom(raw = {}) {
  const money = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const coin of COINS) money[coin.key] = Math.max(0, Math.floor(num(raw?.[coin.key], 0)));
  return money;
}
export function getMoney(actor) {
  const flagged = actor?.getFlag?.(ARMORER_SCOPE, "monnaie") ?? actor?.getFlag?.("add2e", "monnaie");
  const system = actor?.system?.monnaie ?? actor?.system?.argent ?? actor?.system?.currency;
  return moneyFrom(flagged && typeof flagged === "object" ? flagged : system && typeof system === "object" ? system : {});
}
export async function setMoney(actor, money) { if (!actor?.setFlag) return false; await actor.setFlag("add2e", "monnaie", moneyFrom(money)); return true; }
export const toCopper = money => COINS.reduce((total, coin) => total + moneyFrom(money)[coin.key] * coin.pc, 0);
export function fromCopper(value) {
  let remaining = Math.max(0, Math.floor(num(value, 0)));
  const money = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const coin of COINS) { money[coin.key] = Math.floor(remaining / coin.pc); remaining %= coin.pc; }
  return money;
}
export function formatMoney(value) {
  const money = typeof value === "number" ? fromCopper(value) : moneyFrom(value);
  const parts = COINS.map(coin => money[coin.key] ? `${money[coin.key]} ${coin.label}` : "").filter(Boolean);
  return parts.length ? parts.join(" ") : "0 PC";
}
export function priceCopper(item) {
  const system = item?.system ?? {};
  const raw = system.prix ?? system.price ?? system.cout ?? system.coût ?? system.cost ?? item?.getFlag?.(ARMORER_SCOPE, "prix");
  let value = 0;
  let currency = system.devise ?? system.currency ?? item?.getFlag?.(ARMORER_SCOPE, "devise") ?? "po";
  if (typeof raw === "number") value = raw;
  else if (typeof raw === "string") {
    const match = raw.match(/([0-9]+(?:[\.,][0-9]+)?)\s*(pp|po|pe|pa|pc)?/i);
    if (match) { value = Number(String(match[1]).replace(",", ".")); if (match[2]) currency = match[2].toLowerCase(); }
  } else if (raw && typeof raw === "object") { value = raw.valeur ?? raw.value ?? raw.montant ?? raw.amount ?? 0; currency = raw.devise ?? raw.currency ?? currency; }
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) { value = 1; currency = isArmorerAmmunition(item) ? "pa" : "po"; }
  const coin = COINS.find(entry => entry.key === lower(currency)) ?? COINS.find(entry => entry.key === "po");
  return Math.max(1, Math.round(Number(value) * coin.pc));
}

function sameItem(a, b) { return (isArmorerAmmunition(a) || isArmorerAmmunition(b)) ? slug(a?.name) === slug(b?.name) : Boolean(a?.type ?? b?.type) && a?.type === b?.type && slug(a?.name) === slug(b?.name); }
export function getBuyer() {
  const character = game.user?.character;
  if (character && !isArmorerActor(character) && (character.isOwner || game.user?.isGM)) return character;
  const actor = canvas?.tokens?.controlled?.[0]?.actor;
  return actor && !isArmorerActor(actor) && (actor.isOwner || game.user?.isGM) ? actor : null;
}
function isResponsibleGM() { return game.user?.isGM && (typeof game.user.isActiveGM !== "boolean" || game.user.isActiveGM || game.users?.activeGM?.id === game.user.id || !game.users?.activeGM); }
export async function dialog({ title = "Armurier", content = "", yes = "Compris", no = "Fermer" } = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.confirm) return DialogV2.confirm({ window: { title }, content, yes: { label: yes }, no: { label: no }, modal: true });
  ui.notifications?.warn?.(content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
  return false;
}
export const alertBox = (title, message) => dialog({ title, content: `<div class="add2e-dialog add2e-armorer-alert"><h3>${esc(title)}</h3><p>${esc(message)}</p></div>` });

async function readPack(id) {
  const pack = game.packs?.get?.(id);
  if (!pack) return [];
  try { const docs = await pack.getDocuments(); if (Array.isArray(docs) && docs.length) return docs; } catch (_) {}
  try {
    const index = await pack.getIndex({ fields: ["name", "type", "system"] });
    const docs = [];
    for (const entry of index ?? []) { const doc = await pack.getDocument(entry._id); if (doc) docs.push(doc); }
    return docs;
  } catch (_) { return []; }
}

async function collectSources() {
  const out = [];
  const seen = new Set();
  const add = item => {
    if (!isArmorerStockItem(item)) return;
    const key = itemKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  for (const id of packIds("armes")) for (const item of await readPack(id)) add(item);
  for (const id of packIds("armures")) for (const item of await readPack(id)) add(item);
  for (const item of game.items ?? []) if (isArmorerAmmunition(item)) add(item);
  return out.sort((a, b) => String(armorerKind(a)).localeCompare(String(armorerKind(b))) || String(a.name).localeCompare(String(b.name)));
}

async function buildStockData() {
  if (catalogCache) return foundry.utils.deepClone(catalogCache);
  if (catalogPromise) return foundry.utils.deepClone(await catalogPromise);
  catalogPromise = (async () => (await collectSources()).map(item => {
    const data = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
    const ammunition = isArmorerAmmunition(item);
    delete data._id;
    data.system = data.system ?? {};
    data.system.quantite = Math.max(quantity(item), defaultStock(item));
    data.flags = data.flags ?? {};
    data.flags.add2e = data.flags.add2e ?? {};
    data.flags.add2e.armorerItem = true;
    data.flags.add2e.armorerCatalogKey = itemKey(item);
    data.flags.add2e.armorerStockMax = data.system.quantite;
    if (ammunition) {
      data.type = "objet";
      data.system.categorie = "munition";
      data.system.type = "munition";
      data.flags.add2e.armorerKind = "projectile";
    }
    return data;
  }))();
  catalogCache = await catalogPromise;
  catalogPromise = null;
  return foundry.utils.deepClone(catalogCache);
}

function pseudoItem(data) {
  return { id: `catalog:${data.flags?.add2e?.armorerCatalogKey ?? slug(data.name)}`, name: data.name, type: data.type, img: data.img, system: data.system ?? {}, flags: data.flags ?? {}, getFlag: (scope, key) => data.flags?.[scope]?.[key], toObject: () => foundry.utils.deepClone(data) };
}
function projectileMigrations(items) {
  return items.flatMap(item => {
    if (!isArmorerAmmunition(item)) return [];
    const previousMaximum = Math.max(0, Math.floor(num(item.getFlag?.(ARMORER_SCOPE, "armorerStockMax"), quantity(item))));
    const nextMaximum = defaultStock(item);
    const flags = item.flags?.add2e ?? {};
    const update = { _id: item.id };
    let changed = false;
    if (flags.armorerItem !== true) { update["flags.add2e.armorerItem"] = true; changed = true; }
    if (flags.armorerKind !== "projectile") { update["flags.add2e.armorerKind"] = "projectile"; changed = true; }
    if (flags.armorerCatalogKey !== itemKey(item)) { update["flags.add2e.armorerCatalogKey"] = itemKey(item); changed = true; }
    if (previousMaximum < nextMaximum) {
      update["flags.add2e.armorerStockMax"] = nextMaximum;
      if (quantity(item) === previousMaximum) update["system.quantite"] = nextMaximum;
      changed = true;
    }
    return changed ? [update] : [];
  });
}

export async function ensureStock(armorer) {
  if (!game.user?.isGM || !armorer) return 0;
  const catalogue = await buildStockData();
  const existing = Array.from(armorer.items ?? []);
  const create = catalogue.filter(data => !existing.some(item => sameItem(item, data)));
  if (create.length) await armorer.createEmbeddedDocuments("Item", create, { add2eReason: "armorer-ensure-stock" });
  const updates = projectileMigrations(Array.from(armorer.items ?? []));
  if (updates.length) await armorer.updateEmbeddedDocuments("Item", updates, { add2eReason: "armorer-projectile-catalog-migration" });
  if (create.length) ui.notifications?.info?.(`${armorer.name} : ${create.length} article(s) ajouté(s) au stock.`);
  return create.length + updates.length;
}
export async function getArmorerDisplayItems(armorer) {
  if (game.user?.isGM && armorer) await ensureStock(armorer);
  const items = Array.from(armorer?.items ?? []).filter(isArmorerStockItem);
  return items.length ? items : (await buildStockData()).map(pseudoItem);
}

export function findArmorer() { return Array.from(game.actors ?? []).find(isArmorerActor) ?? null; }
async function ensureFolder() { return !game.user?.isGM ? null : Array.from(game.folders ?? []).find(folder => folder.type === "Actor" && folder.name === ARMORER_FOLDER) ?? Folder.create({ name: ARMORER_FOLDER, type: "Actor", color: "#69431a" }, { add2eReason: "armorer-folder-create" }); }
export async function moveToFolder(armorer = null) {
  if (!game.user?.isGM || !(armorer = armorer ?? findArmorer())) return false;
  const folder = await ensureFolder();
  if (folder && armorer.folder?.id !== folder.id && armorer.folder !== folder.id) await armorer.update({ folder: folder.id }, { add2eReason: "armorer-folder-move" });
  return true;
}
export async function updateTokenSize(armorer = null) {
  if (!game.user?.isGM || !(armorer = armorer ?? findArmorer())) return false;
  await armorer.update({ img: ARMORER_TOKEN_IMG, "prototypeToken.width": 2, "prototypeToken.height": 2, "prototypeToken.texture.src": ARMORER_TOKEN_IMG, "flags.add2e.armorerVersion": ADD2E_ARMORER_VERSION }, { add2eReason: "armorer-token-image-size" });
  return true;
}
export async function createArmorer({ force = false } = {}) {
  if (!game.user?.isGM) return null;
  const existing = findArmorer();
  if (existing && !force) { await moveToFolder(existing); await updateTokenSize(existing); await ensureStock(existing); return existing; }
  const folder = await ensureFolder();
  const armorer = await Actor.create({ name: ARMORER_NAME, type: "personnage", folder: folder?.id ?? null, img: ARMORER_TOKEN_IMG, ownership: { default: CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 }, prototypeToken: { name: ARMORER_NAME, actorLink: true, width: 2, height: 2, texture: { src: ARMORER_TOKEN_IMG } }, flags: { add2e: { isArmorer: true, armorerVersion: ADD2E_ARMORER_VERSION, monnaie: { pc: 0, pa: 0, pe: 0, po: 1000, pp: 0 } } } }, { renderSheet: false, add2eReason: "armorer-create" });
  const stock = await buildStockData();
  if (stock.length) await armorer.createEmbeddedDocuments("Item", stock, { add2eReason: "armorer-initial-stock" });
  await game.settings.set("add2e", ARMORER_SETTING, ADD2E_ARMORER_VERSION);
  return armorer;
}
export async function ensureArmorerOnLaunch() {
  if (!game.user?.isGM) return;
  const armorer = findArmorer();
  if (armorer) { await moveToFolder(armorer); await updateTokenSize(armorer); await ensureStock(armorer); return; }
  if (game.settings.get("add2e", ARMORER_SETTING) !== ADD2E_ARMORER_VERSION) await createArmorer();
}

function resolveStockItem(armorer, itemId, key) { return armorer?.items?.get?.(itemId) ?? Array.from(armorer?.items ?? []).find(item => item.getFlag?.(ARMORER_SCOPE, "armorerCatalogKey") === key || itemKey(item) === key) ?? null; }
async function subtractMoney(actor, copper) { const total = toCopper(getMoney(actor)); if (total < copper) return false; await setMoney(actor, fromCopper(total - copper)); return true; }
function purchasedItemData(item, requestedQuantity) {
  const data = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
  delete data._id;
  data.system = data.system ?? {};
  data.system.quantite = requestedQuantity;
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.purchasedFromArmorer = true;
  if (isArmorerAmmunition(item)) { data.type = "objet"; data.system.categorie = "munition"; data.system.type = "munition"; data.flags.add2e.armorerKind = "projectile"; }
  return data;
}
async function mergeOrCreate(actor, item, requestedQuantity) {
  const existing = Array.from(actor.items ?? []).find(candidate => sameItem(candidate, item));
  if (existing) return existing.update(quantityUpdate(quantity(existing) + requestedQuantity), { add2eReason: "armorer-buy-merge" });
  return (await actor.createEmbeddedDocuments("Item", [purchasedItemData(item, requestedQuantity)], { add2eReason: "armorer-buy-create" }))?.[0] ?? null;
}
export async function buyLocal({ armorer, buyer, item, quantity: requestedQuantity }, { confirm = true } = {}) {
  if (!armorer || !buyer || !item) return { ok: false, message: "Armurier, acheteur ou article introuvable." };
  const requested = Math.max(1, Math.floor(num(requestedQuantity, 1)));
  if (quantity(item) < requested) return { ok: false, message: `${item.name} : stock disponible ${quantity(item)}.` };
  const total = priceCopper(item) * requested;
  if (toCopper(getMoney(buyer)) < total) return { ok: false, message: `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.` };
  if (confirm && !await dialog({ title: "Confirmer l’achat", content: `<p>Acheter <b>${requested} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: "Acheter", no: "Annuler" })) return { ok: false, cancelled: true };
  if (!await subtractMoney(buyer, total)) return { ok: false, message: "Paiement impossible." };
  await item.update(quantityUpdate(quantity(item) - requested), { add2eReason: "armorer-stock-decrease" });
  await mergeOrCreate(buyer, item, requested);
  return { ok: true, message: `${buyer.name} achète ${requested} × ${item.name} pour ${formatMoney(total)}.` };
}
export async function buy(args) {
  if (game.user?.isGM) {
    const result = await buyLocal(args, { confirm: true });
    if (!result.ok && !result.cancelled) await alertBox("Achat impossible", result.message);
    else if (result.ok) ui.notifications?.info?.(result.message);
    return result.ok;
  }
  const { armorer, buyer, item } = args;
  const requested = Math.max(1, Math.floor(num(args.quantity, 1)));
  if (!armorer || !buyer || !item) return false;
  const total = priceCopper(item) * requested;
  if (quantity(item) < requested) return alertBox("Stock insuffisant", `${item.name} : stock disponible ${quantity(item)}.`).then(() => false);
  if (toCopper(getMoney(buyer)) < total) return alertBox("Argent insuffisant", `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.`).then(() => false);
  if (!await dialog({ title: "Confirmer l’achat", content: `<p>Acheter <b>${requested} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: "Acheter", no: "Annuler" })) return false;
  game.socket?.emit?.("system.add2e", { type: ARMORER_BUY_REQUEST, requestId: foundry.utils.randomID(), userId: game.user.id, armorerId: armorer.id, buyerId: buyer.id, itemId: item.id?.startsWith?.("catalog:") ? null : item.id, itemKey: item.getFlag?.(ARMORER_SCOPE, "armorerCatalogKey") ?? itemKey(item), quantity: requested });
  return true;
}
export async function restockAll(armorer) { if (!game.user?.isGM || !armorer) return false; const updates = Array.from(armorer.items ?? []).filter(isArmorerStockItem).map(item => ({ _id: item.id, "system.quantite": stockMax(item) })); if (updates.length) await armorer.updateEmbeddedDocuments("Item", updates, { add2eReason: "armorer-restock-all" }); return true; }
export async function setStock(item, value) { if (!game.user?.isGM || !item?.update) return false; await item.update(quantityUpdate(value), { add2eReason: "armorer-manual-restock" }); return true; }
export function sceneTokenChoices() { return Array.from(canvas?.tokens?.placeables ?? []).filter(token => token?.actor && !isArmorerActor(token.actor)).map(token => ({ token, tokenId: token.id, label: `${token.name} — ${token.actor.name}` })).sort((a, b) => String(a.label).localeCompare(String(b.label))); }
export async function assignItemToToken({ armorer, item, token, quantity: requestedQuantity } = {}) {
  if (!game.user?.isGM || !armorer || !item) return { ok: false, message: !game.user?.isGM ? "Action réservée au MJ." : "Armurier ou article introuvable." };
  const actor = token?.actor;
  if (!actor) return { ok: false, message: "Token ou acteur cible introuvable." };
  const requested = Math.max(1, Math.floor(num(requestedQuantity, 1)));
  if (quantity(item) < requested) return { ok: false, message: `${item.name} : stock disponible ${quantity(item)}.` };
  await item.update(quantityUpdate(quantity(item) - requested), { add2eReason: "armorer-assign-item-stock-decrease" });
  await mergeOrCreate(actor, item, requested);
  return { ok: true, message: `${requested} × ${item.name} affecté(s) à ${token.name}.` };
}

function classItems(actor) { return Array.from(actor?.items ?? []).filter(item => item?.type === "classe"); }
function flatten(value) { if (!value) return []; if (Array.isArray(value)) return value.flatMap(flatten); if (typeof value === "object") return Object.values(value).flatMap(flatten); return String(value).split(/[,;|/]/g).map(v => v.trim()).filter(Boolean); }
function classNames(actor) { const system = actor?.system ?? {}; return [...classItems(actor).map(item => item.name), ...flatten([system.classe, system.class, system.details_classe, system.details?.classe, system.details?.class, system.classes, system.details?.classes])].map(lower).filter(Boolean); }
function fallback(name, category) {
  if (category === "armure") { if (/magicien|illusionniste|voleur|moine/.test(name)) return ["aucune"]; if (/clerc|druide|guerrier|paladin|ranger|assassin/.test(name)) return ["toutes"]; return []; }
  if (/magicien|illusionniste/.test(name)) return ["baton", "bâton", "dague", "flechette", "fléchette"];
  if (/clerc/.test(name)) return ["baton", "bâton", "fleau", "fléau", "marteau", "masse", "massue"];
  if (/druide/.test(name)) return ["serpe", "faucille", "dague", "lance", "fronde", "baton", "bâton", "cimeterre"];
  if (/voleur/.test(name)) return ["dague", "epee", "épée", "flechette", "fléchette", "fronde", "massue", "arc court"];
  if (/guerrier|paladin|ranger|assassin/.test(name)) return ["toutes"];
  if (/moine/.test(name)) return ["gourdin", "arbalete", "arbalète", "dague", "hachette", "javelot", "jo", "nunchaku", "baton", "bâton", "shuriken", "fronde", "lance"];
  return [];
}
function allowed(actor, category) {
  const values = [];
  for (const cls of classItems(actor)) {
    const system = cls.system ?? {};
    for (const source of category === "arme" ? [system.weaponsAllowed, system.weaponAllowed, system.weaponRestriction, system.allowedWeapons, system.armes_autorisees, system.armesAutorisees] : [system.armorAllowed, system.armorsAllowed, system.armorRestriction, system.allowedArmor, system.armures_autorisees, system.armuresAutorisees, system.shieldAllowed]) values.push(...flatten(source));
  }
  for (const name of classNames(actor)) values.push(...fallback(name, category));
  return values.map(lower).filter(Boolean);
}
function itemTokens(item) { const system = item?.system ?? {}; return [item?.name, system.nom, system.categorie, system.category, system.sousType, system.sous_type, system.type, system.famille_arme, system.famille, system.taille, ...tags(item)].flatMap(flatten).map(lower).filter(Boolean); }
function allowedResult(values, item, hasClass) {
  if (!values.length) return { ok: !hasClass, reason: hasClass ? "Aucune autorisation de classe trouvée" : "Aucune classe détectée" };
  if (values.some(value => /^(aucune|aucun|none|interdit|non)$/i.test(value))) return { ok: false, reason: "Aucune armure/arme autorisée par la classe" };
  if (values.some(value => /^(toutes?|all|any|libre|autorisees?|autorise)$/i.test(value))) return { ok: true, reason: "Toutes les options sont autorisées" };
  const tokens = itemTokens(item);
  const ok = values.some(value => tokens.some(token => value === token || (value.length >= 4 && token.includes(value))));
  return { ok, reason: ok ? "Autorisé par la classe" : "Non listé dans les restrictions de classe" };
}
export function usabilityForActor(actor, item) {
  if (!actor || !item) return { state: "neutral", usable: true, label: "Aucun acteur acheteur", reason: "Aucun acteur acheteur" };
  if (isArmorerAmmunition(item)) return { state: "usable", usable: true, label: "Projectile", reason: "Munition rangée dans le carquois" };
  const hasClass = classItems(actor).length > 0 || classNames(actor).length > 0;
  if (item.type === "arme" || item.type === "armure") { const result = allowedResult(allowed(actor, item.type === "arme" ? "arme" : "armure"), item, hasClass); return { state: result.ok ? "usable" : "unusable", usable: result.ok, label: result.ok ? "Utilisable" : "Non utilisable", reason: result.reason }; }
  return { state: "neutral", usable: true, label: "Article", reason: "Article hors armurerie" };
}

export function registerSockets() {
  if (globalThis.__ADD2E_ARMORER_SOCKET_REGISTERED_V6_COMPENDIUM_PROJECTILES) return;
  globalThis.__ADD2E_ARMORER_SOCKET_REGISTERED_V6_COMPENDIUM_PROJECTILES = true;
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
    const item = resolveStockItem(armorer, data.itemId, data.itemKey);
    let result = { ok: false, message: "Achat impossible." };
    try { result = await buyLocal({ armorer, buyer: game.actors?.get(data.buyerId), item, quantity: data.quantity }, { confirm: false }); } catch (error) { result = { ok: false, message: error?.message || "Erreur pendant l'achat." }; }
    game.socket?.emit?.("system.add2e", { type: ARMORER_BUY_RESULT, requestId: data.requestId, userId: data.userId, ok: !!result.ok, message: result.message });
  });
}
export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  Object.assign(game.add2e, { armorerVersion: ADD2E_ARMORER_VERSION, createDefaultArmorer: createArmorer, findDefaultArmorer: findArmorer, ensureArmorerStock: ensureStock, updateArmorerTokenSize: updateTokenSize, moveArmorerToFolder: moveToFolder, armorerUsability: usabilityForActor, getArmorerDisplayItems, assignArmorerItemToToken: assignItemToToken, clearArmorerCatalogCache, isArmorerAmmunition });
  globalThis.ADD2E_ARMORER_VERSION = ADD2E_ARMORER_VERSION;
  globalThis.add2eCreateDefaultArmorer = createArmorer;
  globalThis.add2eArmorerUsability = usabilityForActor;
  globalThis.add2eAssignArmorerItemToToken = assignItemToToken;
  globalThis.add2eClearArmorerCatalogCache = clearArmorerCatalogCache;
  globalThis.add2eIsArmorerAmmunition = isArmorerAmmunition;
}
