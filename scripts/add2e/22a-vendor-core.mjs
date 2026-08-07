// ADD2E — Core vendeur : stock, monnaie, achats et affectation MJ.
// Les projectiles dépensés en jeu passent par ce cœur vendeur et le relais MJ générique ADD2E_GM_OPERATION.
// Compatible Foundry V13/V14/V15.

export const ADD2E_VENDOR_VERSION = "2026-08-07-vendor-v26-thrown-reequip";
export const VENDOR_SCOPE = "add2e";
export const VENDOR_NAME = "Marchand de composants et projectiles";
export const VENDOR_FOLDER = "ADD2E — Boutique";
export const VENDOR_SETTING = "vendorCreationVersion";
export const TOKEN_IMG = "systems/add2e/assets/ui/boutique.webp";
export const PROJECTILE_FLAG = "projectilesDepensesCombat";
export const SOCKET_RECOVERY = "ADD2E_PROJECTILE_RECOVERY_RESULT";
export const RECOVERY_RATE = 0.6;
export const GM_OPERATION_TYPE = "ADD2E_GM_OPERATION";
export const GM_OPERATION_PROJECTILE_SPENT = "vendorRecordProjectileSpent";

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

function actorType(actor) {
  return slug(actor?.type ?? actor?._source?.type ?? actor?.baseActor?.type ?? actor?.document?.type ?? "");
}

function actorUsesProjectileInventory(actor) {
  return actorType(actor) === "personnage";
}

function projectileResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine
    || typeof engine.consumeResource !== "function"
    || typeof engine.recoverResource !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour les projectiles.");
  }
  return engine;
}

function projectileResource(actor, projectile, { cost = 0, recovery = 0 } = {}) {
  if (!actor || !projectile) throw new Error("Projectile ou acteur introuvable pour la ressource canonique.");
  const resourceKind = isThrownWeapon(projectile) ? "thrown-weapon" : "ammunition";
  return {
    id: `${projectile.uuid ?? projectile.id}:projectile-stack`,
    type: resourceKind,
    label: projectile.name,
    document: projectile,
    actor,
    item: projectile,
    target: String(projectile.id ?? "projectile"),
    get current() {
      return quantity(projectile);
    },
    maximum: null,
    cost: Math.max(0, Math.floor(num(cost, 0))),
    recovery: Math.max(0, Math.floor(num(recovery, 0))),
    source: {
      kind: resourceKind,
      id: String(projectile.id ?? ""),
      uuid: String(projectile.uuid ?? ""),
      name: String(projectile.name ?? "Projectile")
    },
    context: {
      consumer: "22a-vendor-core",
      actorId: String(actor.id ?? ""),
      projectileId: String(projectile.id ?? "")
    },
    write: next => {
      const update = quantityUpdate(next);
      if (resourceKind === "thrown-weapon" && recovery > 0 && Number(next) > 0) update["system.equipee"] = true;
      return projectile.update(update, {
        add2eInternal: true,
        add2eReason: resourceKind === "thrown-weapon" && recovery > 0 ? "thrown-weapon-recovery-resource" : "projectile-resource",
        render: false
      });
    }
  };
}

function packIds(kind) {
  const base = kind === "armes"
    ? ["add2e.armes", "world.armes"]
    : ["add2e.equipements", "world.equipements", "add2e.equipement", "world.equipement"];

  for (const [id, pack] of game.packs ?? []) {
    const text = `${id} ${pack?.metadata?.label ?? ""}`;
    if (kind === "armes" && /\barmes?\b|weapons?/i.test(text) && !base.includes(id)) base.push(id);
    if (kind === "equipements" && /equip|équip|objets?/i.test(text) && !/magique|magic/i.test(text) && !base.includes(id)) base.push(id);
  }
  return base;
}

export function isAmmunition(item) {
  const s = item?.system ?? {};
  const name = lower(item?.name);
  const fields = [s.categorie, s.category, s.sousType, s.sous_type, s.type, s.subtype, s.kind, s.slot].map(lower).filter(Boolean);
  const t = tags(item);
  const accepted = new Set([
    "munition", "munitions", "projectile", "projectiles", "ammo", "ammunition",
    "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile",
    "type:munition", "type:projectile"
  ]);

  if (/\b(carquois|quiver|etui|etuis|étui|étuis|sac|sacoche|container|contenant|boite|boîte|bourse)\b/.test(name)) return false;
  if (fields.some(v => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(v))) return false;
  if (t.some(v => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(v))) return false;
  if (fields.some(v => accepted.has(v))) return true;
  if (t.some(v => accepted.has(v) || v.startsWith("munition:") || v.startsWith("projectile:"))) return true;
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|pierre de fronde|pierres de fronde)\b/.test(name);
}

function isThrownWeapon(item) {
  if (!item || isAmmunition(item)) return false;
  if (!["arme", "weapon"].includes(lower(item?.type))) return false;
  if (typeof globalThis.add2eGetWeaponUsageProfile !== "function") {
    throw new Error("Le propriétaire canonique du profil d’usage des armes est indisponible.");
  }
  return globalThis.add2eGetWeaponUsageProfile(item)?.isThrown === true;
}

function recoveryItemForEntry(actor, entry) {
  const byId = entry?.itemId ? actor?.items?.get?.(entry.itemId) ?? null : null;
  if (byId && (isAmmunition(byId) || isThrownWeapon(byId))) return byId;
  return Array.from(actor?.items ?? []).find(item =>
    item?.name === entry?.itemName && (isAmmunition(item) || isThrownWeapon(item))
  ) ?? null;
}

export function isComponent(item) {
  const s = item?.system ?? {};
  if (lower(s.categorie ?? s.category) === "composant_sort") return true;
  if (lower(s.sousType ?? s.sous_type ?? s.type) === "composant") return true;
  return tags(item).some(t => t === "composant_sort" || t.startsWith("composant:"));
}

export function isMagic(item) {
  const s = item?.system ?? {};
  const name = lower(item?.name);
  const cat = lower(s.categorie ?? s.category ?? s.sousType ?? s.sous_type ?? "");
  if (item?.getFlag?.(VENDOR_SCOPE, "vendorMagic") === true || item?.getFlag?.(VENDOR_SCOPE, "magicItem") === true) return true;
  if (s.magique === true || s.magic === true || s.isMagic === true) return true;
  if (cat.includes("magique") || cat.includes("magic")) return true;
  if (tags(item).some(t => /magique|magic|objet_magique|magic_item/.test(t))) return true;
  if (/\+\d/.test(name)) return true;
  return /anneau|bracelet|baguette|baton|bâton|potion|parchemin|amulette|cape|ceinture|gantelet|heaume|botte|bottes|collier|robe magique/.test(name);
}

export const isEquipment = item => item?.type === "objet" && !isMagic(item) && !isComponent(item);

export function vendorKind(item) {
  const k = item?.getFlag?.(VENDOR_SCOPE, "vendorKind");
  if (k === "component") return "Composant";
  if (k === "projectile") return "Projectile";
  if (k === "equipment") return "Equipement";
  if (isComponent(item)) return "Composant";
  if (isAmmunition(item)) return "Projectile";
  return "Equipement";
}

export function isStockItem(item) {
  if (!item || isMagic(item)) return false;
  if (item.type === "objet" && isComponent(item)) return true;
  if (isAmmunition(item)) return true;
  return item.type === "objet" && item.getFlag?.(VENDOR_SCOPE, "vendorKind") === "equipment";
}

export const isVendorActor = actor => actor?.getFlag?.(VENDOR_SCOPE, "isVendor") === true || actor?.name === VENDOR_NAME;
export const defaultStock = item => isAmmunition(item) ? 40 : isComponent(item) ? 20 : 10;

export function moneyFrom(raw = {}) {
  const m = { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 };
  for (const c of COINS) m[c.key] = Math.max(0, Math.floor(num(raw?.[c.key], 0)));
  return m;
}

export function getMoney(actor) {
  const f = actor?.getFlag?.(VENDOR_SCOPE, "monnaie");
  if (f && typeof f === "object") return moneyFrom(f);
  const s = actor?.system?.monnaie ?? actor?.system?.argent ?? actor?.system?.currency;
  return s && typeof s === "object" ? moneyFrom(s) : moneyFrom({});
}

export async function setMoney(actor, money) {
  if (!actor?.setFlag) return false;
  await actor.setFlag(VENDOR_SCOPE, "monnaie", moneyFrom(money));
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
  const raw = s.prix ?? s.price ?? s.cout ?? s.coût ?? item?.getFlag?.(VENDOR_SCOPE, "prix") ?? null;
  let value = 0;
  let devise = s.devise ?? s.currency ?? item?.getFlag?.(VENDOR_SCOPE, "devise") ?? "po";

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
    devise = isAmmunition(item) ? "pa" : "po";
  }

  const coin = COINS.find(c => c.key === lower(devise)) ?? COINS.find(c => c.key === "po");
  return Math.max(1, Math.round(Number(value) * coin.pc));
}

function sameItem(a, b) {
  const type = isAmmunition(a) || isAmmunition(b) ? "munition" : String(a?.type ?? b?.type ?? "");
  return type && slug(a?.name) === slug(b?.name);
}

export function getBuyer() {
  const c = game.user?.character;
  if (c && !isVendorActor(c) && (c.isOwner || game.user?.isGM)) return c;
  const controlled = canvas?.tokens?.controlled?.[0]?.actor;
  if (controlled && !isVendorActor(controlled) && (controlled.isOwner || game.user?.isGM)) return controlled;
  return null;
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

export async function dialog({ title = "Marchand", content = "", yes = "Compris", no = "Fermer" } = {}) {
  if (typeof globalThis.add2eDialogConfirm !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogConfirm({
    add2eTheme: "parchment",
    add2ePrimaryAction: "yes",
    add2eClasses: ["add2e-vendor-dialog"],
    window: { title },
    content,
    yes: { label: yes },
    no: { label: no },
    modal: true
  });
}

export const alertBox = (title, message) => dialog({
  title,
  content: `<div class="add2e-dialog add2e-vendor-alert"><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`
});

async function readPack(packId) {
  const pack = game.packs?.get?.(packId);
  if (!pack) return [];
  try {
    const docs = await pack.getDocuments();
    if (Array.isArray(docs) && docs.length) return docs;
  } catch (e) {
    console.warn("[ADD2E][VENDOR][PACK_DOCUMENTS_ERROR]", packId, e);
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
    console.warn("[ADD2E][VENDOR][PACK_INDEX_ERROR]", packId, e);
    return [];
  }
}

async function collectSources() {
  const sources = [
    { kind: "component", packs: packIds("equipements"), accept: i => i?.type === "objet" && isComponent(i) },
    { kind: "projectile", packs: packIds("armes"), accept: i => isAmmunition(i) },
    { kind: "equipment", packs: packIds("equipements"), accept: i => isEquipment(i) }
  ];
  const out = [];
  const seen = new Set();
  const add = (doc, src) => {
    if (!doc || isMagic(doc) || !src.accept(doc)) return;
    const key = `${src.kind}:${slug(doc.name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ doc, kind: src.kind });
  };

  for (const src of sources) for (const pid of src.packs) for (const doc of await readPack(pid)) add(doc, src);
  for (const item of game.items ?? []) {
    if (item?.type === "objet" && isComponent(item)) add(item, sources[0]);
    if (isAmmunition(item)) add(item, sources[1]);
    if (isEquipment(item)) add(item, sources[2]);
  }
  return out.sort((a, b) => String(a.doc.name).localeCompare(String(b.doc.name)));
}

async function buildStockData() {
  return (await collectSources()).map(({ doc, kind }) => {
    const data = doc.toObject ? doc.toObject() : foundry.utils.deepClone(doc);
    delete data._id;
    if (kind === "projectile") data.type = "objet";
    data.system = data.system ?? {};
    data.system.quantite = defaultStock(doc);
    if (kind === "projectile") data.system.categorie = "munition";
    if (kind === "component" && !data.system.categorie) data.system.categorie = "composant_sort";
    data.flags = data.flags ?? {};
    data.flags.add2e = data.flags.add2e ?? {};
    data.flags.add2e.vendorItem = true;
    data.flags.add2e.vendorKind = kind;
    data.flags.add2e.vendorStockMax = data.system.quantite;
    return data;
  });
}

export async function ensureStock(vendor) {
  if (!game.user?.isGM || !vendor) return 0;
  const docs = await buildStockData();
  const existing = Array.from(vendor.items ?? []);
  const create = docs.filter(d => !existing.some(i => sameItem(i, d)));
  if (create.length) await vendor.createEmbeddedDocuments("Item", create, { add2eReason: "vendor-ensure-stock" });
  if (create.length) ui.notifications?.info?.(`${vendor.name} : ${create.length} article(s) ajouté(s) au stock.`);
  return create.length;
}

export function findVendor() {
  return Array.from(game.actors ?? []).find(isVendorActor) ?? null;
}

async function ensureFolder() {
  if (!game.user?.isGM) return null;
  return Array.from(game.folders ?? []).find(f => f.type === "Actor" && f.name === VENDOR_FOLDER)
    ?? Folder.create({ name: VENDOR_FOLDER, type: "Actor", color: "#8d641b" }, { add2eReason: "vendor-folder-create" });
}

export async function moveToFolder(vendor = null) {
  if (!game.user?.isGM) return false;
  vendor = vendor ?? findVendor();
  if (!vendor) return false;
  const folder = await ensureFolder();
  if (folder && vendor.folder?.id !== folder.id && vendor.folder !== folder.id) {
    await vendor.update({ folder: folder.id }, { add2eReason: "vendor-folder-move" });
  }
  return true;
}

export async function updateTokenSize(vendor = null) {
  if (!game.user?.isGM) return false;
  vendor = vendor ?? findVendor();
  if (!vendor) return false;
  await vendor.update({
    img: TOKEN_IMG,
    "prototypeToken.width": 2,
    "prototypeToken.height": 2,
    "prototypeToken.texture.src": TOKEN_IMG,
    "flags.add2e.vendorVersion": ADD2E_VENDOR_VERSION
  }, { add2eReason: "vendor-token-image-size" });
  return true;
}

export async function createVendor({ force = false } = {}) {
  if (!game.user?.isGM) return null;
  const ex = findVendor();
  if (ex && !force) {
    await moveToFolder(ex);
    await updateTokenSize(ex);
    await ensureStock(ex);
    return ex;
  }

  const folder = await ensureFolder();
  const actor = await Actor.create({
    name: VENDOR_NAME,
    type: "personnage",
    folder: folder?.id ?? null,
    img: TOKEN_IMG,
    ownership: { default: CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
    prototypeToken: { name: VENDOR_NAME, actorLink: true, width: 2, height: 2, texture: { src: TOKEN_IMG } },
    flags: { add2e: { isVendor: true, vendorVersion: ADD2E_VENDOR_VERSION, monnaie: { pc: 0, pa: 0, pe: 0, po: 500, pp: 0 } } }
  }, { renderSheet: false, add2eReason: "vendor-create" });

  const stock = await buildStockData();
  if (stock.length) await actor.createEmbeddedDocuments("Item", stock, { add2eReason: "vendor-initial-stock" });
  await game.settings.set("add2e", VENDOR_SETTING, ADD2E_VENDOR_VERSION);
  return actor;
}

export async function ensureVendorOnLaunch() {
  if (!game.user?.isGM) return;
  const v = findVendor();
  if (v) {
    await moveToFolder(v);
    await updateTokenSize(v);
    await ensureStock(v);
    return;
  }
  if (game.settings.get("add2e", VENDOR_SETTING) !== ADD2E_VENDOR_VERSION) await createVendor();
}

async function subtractMoney(actor, copper) {
  const total = toCopper(getMoney(actor));
  if (total < copper) return false;
  await setMoney(actor, fromCopper(total - copper));
  return true;
}

async function mergeOrCreate(actor, item, qty) {
  const ex = Array.from(actor.items ?? []).find(i => sameItem(i, item));
  if (ex) return ex.update(quantityUpdate(quantity(ex) + qty), { add2eReason: "vendor-buy-merge" });

  const data = item.toObject ? item.toObject() : foundry.utils.deepClone(item);
  delete data._id;
  if (isAmmunition(item)) data.type = "objet";
  data.system = data.system ?? {};
  data.system.quantite = qty;
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.purchasedFromVendor = true;
  const c = await actor.createEmbeddedDocuments("Item", [data], { add2eReason: "vendor-buy-create" });
  return c?.[0] ?? null;
}

export async function buyLocal({ vendor, buyer, item, quantity: qty }, { confirm = true } = {}) {
  if (!vendor || !buyer || !item) return { ok: false, message: "Vendeur, acheteur ou article introuvable." };
  qty = Math.max(1, Math.floor(num(qty, 1)));
  if (quantity(item) < qty) return { ok: false, message: `${item.name} : stock disponible ${quantity(item)}.` };
  const total = priceCopper(item) * qty;
  if (toCopper(getMoney(buyer)) < total) return { ok: false, message: `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.` };
  if (confirm && !await dialog({ title: "Confirmer l’achat", content: `<p>Acheter <b>${qty} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: "Acheter", no: "Annuler" })) return { ok: false, cancelled: true };
  if (!await subtractMoney(buyer, total)) return { ok: false, message: "Paiement impossible." };
  await item.update(quantityUpdate(quantity(item) - qty), { add2eReason: "vendor-stock-decrease" });
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

  const { vendor, buyer, item } = args;
  const qty = Math.max(1, Math.floor(num(args.quantity, 1)));
  if (!vendor || !buyer || !item) return false;
  const total = priceCopper(item) * qty;
  if (quantity(item) < qty) return alertBox("Stock insuffisant", `${item.name} : stock disponible ${quantity(item)}.`).then(() => false);
  if (toCopper(getMoney(buyer)) < total) return alertBox("Argent insuffisant", `${buyer.name} n’a pas assez d’argent. Prix : ${formatMoney(total)}.`).then(() => false);
  if (!await dialog({ title: "Confirmer l’achat", content: `<p>Acheter <b>${qty} × ${esc(item.name)}</b> pour <b>${formatMoney(total)}</b> ?</p>`, yes: "Acheter", no: "Annuler" })) return false;
  game.socket?.emit?.("system.add2e", { type: "ADD2E_VENDOR_BUY_REQUEST", requestId: foundry.utils.randomID(), userId: game.user.id, vendorId: vendor.id, buyerId: buyer.id, itemId: item.id, quantity: qty });
  return true;
}

export const stockMax = item => Math.max(1, Math.floor(num(item?.getFlag?.(VENDOR_SCOPE, "vendorStockMax"), defaultStock(item))));

export async function restockAll(vendor) {
  if (!game.user?.isGM) return false;
  const updates = Array.from(vendor.items ?? []).filter(isStockItem).map(i => ({ _id: i.id, "system.quantite": stockMax(i) }));
  if (updates.length) await vendor.updateEmbeddedDocuments("Item", updates, { add2eReason: "vendor-restock-all" });
  return true;
}

export async function setStock(item, value) {
  if (!game.user?.isGM || !item) return false;
  await item.update(quantityUpdate(value), { add2eReason: "vendor-manual-restock" });
  return true;
}

export function sceneTokenChoices() {
  return Array.from(canvas?.tokens?.placeables ?? [])
    .filter(t => t?.actor && !isVendorActor(t.actor))
    .map(t => ({ token: t, tokenId: t.id, label: `${t.name} — ${t.actor.name}` }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

export async function assignItemToToken({ vendor, item, token, quantity: qty } = {}) {
  if (!game.user?.isGM) return { ok: false, message: "Action réservée au MJ." };
  if (!vendor || !item) return { ok: false, message: "Vendeur ou article introuvable." };
  if (!isStockItem(item)) return { ok: false, message: `${item.name} ne fait pas partie du stock vendeur.` };
  const actor = token?.actor ?? null;
  if (!actor) return { ok: false, message: "Token ou acteur cible introuvable." };
  qty = Math.max(1, Math.floor(num(qty, 1)));
  if (quantity(item) < qty) return { ok: false, message: `${item.name} : stock disponible ${quantity(item)}.` };
  await item.update(quantityUpdate(quantity(item) - qty), { add2eReason: "vendor-assign-item-stock-decrease" });
  await mergeOrCreate(actor, item, qty);
  return { ok: true, message: `${qty} × ${item.name} affecté(s) à ${token.name}.` };
}

export const assignProjectileToToken = assignItemToToken;

function weaponRequiresProjectile(arme) {
  const s = arme?.system ?? {};
  const name = lower(arme?.name);
  const t = tags(arme);
  if (!(Number(s.portee_courte ?? 0) > 0)) return false;
  if (t.some(x => ["usage:projectile_propulse", "categorie:projectile_propulse", "trait:projectile_propulse", "type:projectile_propulse", "arme:projectile_propulse"].includes(x))) return true;
  if (/\b(arc|arbalete|arbalète|fronde)\b/.test(name)) return true;
  if (t.some(x => ["usage:lancer", "usage:jet", "usage:arme_de_jet"].includes(x))) return false;
  return true;
}

function isEquippedProjectile(item) {
  const s = item?.system ?? {};
  const f = item?.flags?.add2e ?? {};
  return s.equipee === true || s.equiped === true || s.equipped === true || f.equippedProjectile === true || f.carquoisEquipe === true || f.selectedProjectile === true;
}

function projectileCompatibilityKeys(arme) {
  const text = `${lower(arme?.name)} ${tags(arme).join(" ")}`;
  if (/\barbalete\b/.test(text)) return ["carreau", "carreaux", "bolt"];
  if (/\barc\b/.test(text)) return ["fleche", "fleches", "arrow"];
  if (/\bfronde\b/.test(text)) return ["bille", "billes", "pierre", "pierres", "bullet"];
  return [];
}

function projectileMatchesWeapon(projectile, arme) {
  const keys = projectileCompatibilityKeys(arme);
  if (!keys.length) return true;
  const text = `${lower(projectile?.name)} ${tags(projectile).join(" ")}`;
  return keys.some(key => text.includes(key));
}

function findEquippedProjectile(actor, arme = null) {
  const compatible = Array.from(actor?.items ?? [])
    .filter(isAmmunition)
    .filter(isEquippedProjectile)
    .filter(item => !arme || projectileMatchesWeapon(item, arme));
  return compatible.find(item => quantity(item) > 0) ?? compatible[0] ?? null;
}

export function resolveProjectileForAttack({ actor, arme } = {}) {
  const required = weaponRequiresProjectile(arme);
  const compatibility = projectileCompatibilityKeys(arme);
  if (!required) {
    return { ok: true, required: false, ignored: !actorUsesProjectileInventory(actor), projectile: null, current: null, compatibility };
  }
  if (!actorUsesProjectileInventory(actor)) {
    return { ok: true, required: true, ignored: true, projectile: null, current: null, compatibility };
  }

  const projectile = findEquippedProjectile(actor, arme);
  const current = projectile ? quantity(projectile) : 0;
  return {
    ok: !!projectile && current > 0,
    required: true,
    ignored: false,
    projectile,
    current,
    compatibility
  };
}

function projectileSummary(actor, arme = null) {
  return Array.from(actor?.items ?? [])
    .filter(isAmmunition)
    .filter(item => !arme || projectileMatchesWeapon(item, arme))
    .map(i => `${i.name} (${quantity(i)})`)
    .join(", ");
}

function emitGmOperation(operation, payload) {
  game.socket?.emit?.("system.add2e", { type: GM_OPERATION_TYPE, operation, payload });
}

function projectileRequestSet() {
  const set = globalThis.__ADD2E_VENDOR_PROJECTILE_SPENT_REQUESTS ?? new Set();
  globalThis.__ADD2E_VENDOR_PROJECTILE_SPENT_REQUESTS = set;
  return set;
}

function recoveryCombatSet() {
  const set = globalThis.__ADD2E_PROJECTILE_RECOVERY_DONE_COMBATS ?? new Set();
  globalThis.__ADD2E_PROJECTILE_RECOVERY_DONE_COMBATS = set;
  return set;
}

function combatRecoveryKey(combat) {
  return combat?.uuid ?? combat?.id ?? combat?._id ?? `${game.world?.id ?? "world"}:${Date.now()}`;
}

async function recordProjectileSpentLocal(payload = {}) {
  if (!isResponsibleGM()) return false;

  const requestId = payload.requestId ?? null;
  const seen = projectileRequestSet();
  if (requestId && seen.has(requestId)) return true;

  const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
  if (!combat?.getFlag || !combat?.setFlag) {
    console.warn("[ADD2E][PROJECTILES][SPENT][NO_COMBAT]", payload);
    return false;
  }

  const actor = payload.actorUuid
    ? await fromUuid(payload.actorUuid).catch(() => null)
    : game.actors?.get?.(payload.actorId) ?? null;

  if (!actorUsesProjectileInventory(actor)) return false;

  const actorId = actor.id ?? payload.actorId;
  const itemKey = payload.itemId ?? payload.itemName ?? null;
  if (!actorId || !itemKey) return false;

  const spent = foundry.utils.deepClone(await combat.getFlag(VENDOR_SCOPE, PROJECTILE_FLAG) ?? {});
  spent[actorId] ??= { actorId, actorName: actor.name ?? payload.actorName ?? "Acteur", items: {} };
  spent[actorId].actorName = actor.name ?? payload.actorName ?? spent[actorId].actorName;
  spent[actorId].items ??= {};
  spent[actorId].items[itemKey] ??= {
    itemId: payload.itemId ?? null,
    itemName: payload.itemName ?? "Projectile",
    img: payload.img ?? null,
    spent: 0
  };

  const entry = spent[actorId].items[itemKey];
  entry.itemId = payload.itemId ?? entry.itemId ?? null;
  entry.itemName = payload.itemName ?? entry.itemName ?? "Projectile";
  entry.img = payload.img ?? entry.img ?? null;
  entry.spent = Math.max(0, Math.floor(num(entry.spent, 0))) + Math.max(1, Math.floor(num(payload.quantity, 1)));

  await combat.setFlag(VENDOR_SCOPE, PROJECTILE_FLAG, spent);
  if (requestId) seen.add(requestId);
  return true;
}

async function recordProjectileSpent({ actor, projectile, quantity: qty = 1 }) {
  if (!actorUsesProjectileInventory(actor)) return false;
  const combat = game.combat;
  if (!combat?.id) return false;

  const payload = {
    requestId: foundry.utils.randomID(),
    userId: game.user?.id,
    combatId: combat.id,
    actorId: actor?.id,
    actorUuid: actor?.uuid,
    actorName: actor?.name,
    actorType: actor?.type,
    itemId: projectile?.id,
    itemName: projectile?.name,
    img: projectile?.img,
    quantity: Math.max(1, Math.floor(num(qty, 1)))
  };

  if (!payload.actorId || !(payload.itemId || payload.itemName)) return false;
  if (game.user?.isGM) return recordProjectileSpentLocal(payload);
  emitGmOperation(GM_OPERATION_PROJECTILE_SPENT, payload);
  return true;
}

export async function spendProjectileForAttack({ actor, arme } = {}) {
  const resolved = resolveProjectileForAttack({ actor, arme });
  if (!resolved.required) return { ok: true, required: false, spent: 0, ignored: resolved.ignored };
  if (resolved.ignored) return { ok: true, required: true, spent: 0, ignored: true };

  const projectile = resolved.projectile;
  if (!resolved.ok || !projectile) {
    const detail = projectileSummary(actor, arme);
    await alertBox(
      "Projectile indisponible",
      detail
        ? `Aucun projectile compatible équipé avec une quantité disponible. Projectiles compatibles dans le carquois : ${detail}.`
        : "Aucun projectile compatible disponible dans le carquois."
    );
    return { ok: false, required: true, spent: 0 };
  }

  const consumed = await projectileResourceEngine().consumeResource(
    projectileResource(actor, projectile, { cost: 1 }),
    {
      cost: 1,
      reason: "projectile-spent-attack",
      consumer: "22a-vendor-core"
    }
  );
  if (!consumed.ok) {
    await alertBox("Projectile indisponible", `${projectile.name} n’est plus disponible.`);
    return { ok: false, required: true, spent: 0 };
  }

  await recordProjectileSpent({ actor, projectile, quantity: 1 });
  return {
    ok: true,
    required: true,
    spent: 1,
    projectile,
    remaining: Math.max(0, Number(consumed.resources?.[0]?.after ?? quantity(projectile)) || 0)
  };
}

async function showRecovery(rows) {
  if (!rows?.length) return false;
  const body = rows.map(r => `<tr><td>${esc(r.actor)}</td><td>${esc(r.item)}</td><td>${esc(r.typeLabel ?? "Projectile")}</td><td>${r.spent}</td><td>${r.recovered}</td></tr>`).join("");
  return dialog({
    title: "Récupération des projectiles",
    content: `<h3>Récupération des projectiles</h3><p>Les munitions ordinaires sont récupérées à 60 %. Les armes lancées sont ramassées intégralement.</p><table><thead><tr><th>Acteur</th><th>Projectile</th><th>Type</th><th>Dépensés</th><th>Récupérés</th></tr></thead><tbody>${body}</tbody></table>`
  });
}

export async function recoverProjectilesForCombat(combat) {
  if (!isResponsibleGM() || !combat?.getFlag) return false;

  const recoveryKey = combatRecoveryKey(combat);
  const recoveredCombats = recoveryCombatSet();
  if (recoveredCombats.has(recoveryKey)) return false;

  const spent = foundry.utils.deepClone(await combat.getFlag(VENDOR_SCOPE, PROJECTILE_FLAG) ?? {});
  const rows = [];
  const byUser = {};

  for (const ae of Object.values(spent)) {
    const actor = game.actors?.get(ae.actorId);
    if (!actor || !actorUsesProjectileInventory(actor)) continue;

    for (const ie of Object.values(ae.items ?? {})) {
      const spentQty = Math.max(0, Math.floor(num(ie.spent, 0)));
      if (!spentQty) continue;

      const item = recoveryItemForEntry(actor, ie);
      const thrown = isThrownWeapon(item);
      const recovered = item
        ? thrown ? spentQty : Math.max(0, Math.round(spentQty * RECOVERY_RATE))
        : 0;

      if (!item) {
        console.warn("[ADD2E][PROJECTILES][RECOVERY][ITEM_MISSING]", {
          actor: actor.name,
          itemId: ie.itemId ?? null,
          itemName: ie.itemName ?? "Projectile",
          spent: spentQty
        });
      } else if (recovered) {
        const result = await projectileResourceEngine().recoverResource(
          projectileResource(actor, item, { recovery: recovered }),
          {
            amount: recovered,
            reason: thrown ? "thrown-weapon-combat-recovery" : "projectile-combat-recovery",
            consumer: "22a-vendor-core"
          }
        );
        if (!result.ok) {
          console.warn("[ADD2E][PROJECTILES][RECOVERY][RESOURCE_FAILED]", {
            actor: actor.name,
            item: item.name,
            recovered
          });
        }
      }

      const row = {
        actor: actor.name,
        actorId: actor.id,
        item: ie.itemName,
        type: thrown ? "thrown-weapon" : "ammunition",
        typeLabel: thrown ? "Arme lancée" : "Munition",
        spent: spentQty,
        recovered
      };
      rows.push(row);

      for (const user of game.users ?? []) {
        if (!user.isGM && user.active && actor.testUserPermission?.(user, "OWNER")) {
          byUser[user.id] = byUser[user.id] ?? [];
          byUser[user.id].push(row);
        }
      }
    }
  }

  if (!rows.length) return false;
  recoveredCombats.add(recoveryKey);

  for (const [userId, userRows] of Object.entries(byUser)) {
    game.socket?.emit?.("system.add2e", { type: SOCKET_RECOVERY, userId, rows: userRows });
  }

  await showRecovery(rows);
  return true;
}

export function registerSockets() {
  if (globalThis.__ADD2E_VENDOR_SOCKET_REGISTERED_V22_PROJECTILE_RECOVERY) return;
  globalThis.__ADD2E_VENDOR_SOCKET_REGISTERED_V22_PROJECTILE_RECOVERY = true;

  game.socket?.on?.("system.add2e", async data => {
    if (!data || typeof data !== "object") return;

    if (data.type === SOCKET_RECOVERY) {
      if (data.userId === game.user?.id) await showRecovery(data.rows ?? []);
      return;
    }

    if (data.type === "ADD2E_VENDOR_BUY_RESULT") {
      if (data.userId !== game.user?.id) return;
      data.ok ? ui.notifications?.info?.(data.message ?? "Achat effectué.") : ui.notifications?.warn?.(data.message ?? "Achat impossible.");
      return;
    }

    if (data.type !== "ADD2E_VENDOR_BUY_REQUEST" || !isResponsibleGM()) return;

    const vendor = game.actors?.get(data.vendorId);
    const buyer = game.actors?.get(data.buyerId);
    const item = vendor?.items?.get(data.itemId);
    let result = { ok: false, message: "Achat impossible." };

    try {
      result = await buyLocal({ vendor, buyer, item, quantity: data.quantity }, { confirm: false });
    } catch (e) {
      result = { ok: false, message: e?.message || "Erreur pendant l'achat." };
    }

    game.socket?.emit?.("system.add2e", {
      type: "ADD2E_VENDOR_BUY_RESULT",
      requestId: data.requestId,
      userId: data.userId,
      ok: !!result.ok,
      message: result.message
    });
  });
}

export function registerRecoveryHooks() {
  if (globalThis.__ADD2E_PROJECTILE_RECOVERY_HOOKS_V22_PROJECTILE_RECOVERY) return;
  globalThis.__ADD2E_PROJECTILE_RECOVERY_HOOKS_V22_PROJECTILE_RECOVERY = true;

  const recover = (combat, hookName) => recoverProjectilesForCombat(combat).catch(e => console.warn(`[ADD2E][PROJECTILES][RECOVERY][${hookName}]`, e));
  Hooks.on("preDeleteCombat", c => recover(c, "preDeleteCombat"));
  Hooks.on("deleteCombat", c => recover(c, "deleteCombat"));
  Hooks.on("updateCombat", (c, ch) => {
    if (ch?.active === false || ch?.round === null) recover(c, "updateCombat");
  });
}

function bindMoneyInputs(sheet, root) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || !root?.querySelectorAll) return;
  if (root.dataset?.add2eMoneyBound === "1") return;
  if (root.dataset) root.dataset.add2eMoneyBound = "1";

  root.addEventListener("change", async event => {
    const input = event.target?.closest?.(".add2e-money-input[data-coin]");
    if (!input) return;
    const coin = String(input.dataset.coin ?? "").toLowerCase();
    if (!COINS.some(c => c.key === coin)) return;
    const money = getMoney(actor);
    money[coin] = Math.max(0, Math.floor(num(input.value, 0)));
    await setMoney(actor, money);
    sheet.render?.(false);
  }, true);
}

export function patchActorSheetMoney() {
  const p = globalThis.Add2eActorSheet?.prototype;
  if (!p || p.__add2eVendorMoneySheetV20_ASSIGN_ALL) return;
  p.__add2eVendorMoneySheetV20_ASSIGN_ALL = true;

  if (typeof p.getData === "function") {
    const g = p.getData;
    p.getData = async function(...args) {
      const data = await g.apply(this, args);
      data.add2eVendorMoney = getMoney(this.actor);
      data.add2eVendorMoneyLabel = formatMoney(data.add2eVendorMoney);
      return data;
    };
  }

  if (typeof p.activateListeners === "function") {
    const a = p.activateListeners;
    p.activateListeners = function(html, ...args) {
      const result = a.call(this, html?.[0] ?? html);
      bindMoneyInputs(this, html?.[0] ?? html);
      return result;
    };
  }

  if (typeof p._onRender === "function") {
    const r = p._onRender;
    p._onRender = async function(context, options) {
      const result = await r.call(this, context, options);
      bindMoneyInputs(this, this.element);
      return result;
    };
  }
}

export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  Object.assign(game.add2e, {
    vendorVersion: ADD2E_VENDOR_VERSION,
    createDefaultVendor: createVendor,
    findDefaultVendor: findVendor,
    ensureVendorStock: ensureStock,
    updateVendorTokenSize: updateTokenSize,
    moveToFolder,
    resolveProjectileForAttack,
    spendProjectileForAttack,
    recoverProjectilesForCombat,
    assignItemToToken,
    assignProjectileToToken,
    sceneTokenChoices,
    vendorProjectiles: {
      resolveProjectileForAttack,
      spendProjectileForAttack,
      recoverProjectilesForCombat,
      recordProjectileSpent
    },
    vendorMoney: { coins: COINS, get: getMoney, set: setMoney, format: formatMoney, toCopper, fromCopper }
  });

  globalThis.ADD2E_VENDOR_VERSION = ADD2E_VENDOR_VERSION;
  globalThis.ADD2E_VENDOR_PROJECTILES = game.add2e.vendorProjectiles;
  globalThis.add2eCreateDefaultVendor = createVendor;
  globalThis.add2eVendorMoney = game.add2e.vendorMoney;
  globalThis.add2eResolveProjectileForAttack = resolveProjectileForAttack;
  globalThis.add2eSpendProjectileForAttack = spendProjectileForAttack;
  globalThis.add2eRecoverProjectilesForCombat = recoverProjectilesForCombat;
  globalThis.add2eAssignItemToToken = assignItemToToken;
  globalThis.add2eAssignProjectileToToken = assignItemToToken;
  globalThis.add2eVendorActorUsesProjectileInventory = actorUsesProjectileInventory;
}
