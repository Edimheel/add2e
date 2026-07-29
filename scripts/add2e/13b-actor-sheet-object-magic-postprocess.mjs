// ADD2E — Postprocess getData des objets magiques.
// Les pouvoirs virtuels proviennent exclusivement du runtime canonique.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

const ADD2E_OBJECT_MAGIC_POSTPROCESS_VERSION = "2026-07-29-canonical-object-power-postprocess-v1";
globalThis.ADD2E_OBJECT_MAGIC_POSTPROCESS_VERSION = ADD2E_OBJECT_MAGIC_POSTPROCESS_VERSION;

function add2eMagicPowerDescription(power) {
  return String(
    power?.description
    ?? power?.desc
    ?? power?.linkedSpell?.system?.description
    ?? power?.linkedSpell?.description
    ?? ""
  ).trim();
}

function add2eObjectMagicNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eObjectMagicValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eObjectMagicValues);
  if (value instanceof Set) return [...value].flatMap(add2eObjectMagicValues);
  if (typeof value === "object") {
    for (const key of ["value", "values", "items", "list", "tags", "effectTags"]) {
      if (value[key] !== undefined) return add2eObjectMagicValues(value[key]);
    }
  }
  return [value];
}

function add2eObjectMagicIsPotion(item) {
  if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
  const system = item?.system ?? {};
  const markers = [
    system.sous_type,
    system.sousType,
    system.type_objet,
    system.typeObjet,
    system.categorie,
    system.category,
    system.forme,
    system.kind,
    ...add2eObjectMagicValues(system.tags),
    ...add2eObjectMagicValues(system.effectTags),
    item?.flags?.add2e?.kind,
    item?.flags?.add2e?.category
  ].map(add2eObjectMagicNormalize).filter(Boolean);
  return markers.some(marker =>
    marker === "potion"
    || marker.startsWith("potion_")
    || marker.endsWith("_potion")
    || marker.includes("consommable_potion")
  );
}

function add2eObjectMagicActivePowerEntries(item) {
  if (typeof globalThis.add2eMagicObjectActivePowerEntries !== "function") {
    throw new Error("Le registre canonique des pouvoirs d'objets magiques est indisponible.");
  }
  return globalThis.add2eMagicObjectActivePowerEntries(item);
}

function add2eObjectMagicChargeInfo(item, powers) {
  if (typeof globalThis.add2eMagicObjectChargeInfo !== "function") {
    throw new Error("Le résolveur canonique des charges d'objets magiques est indisponible.");
  }
  return globalThis.add2eMagicObjectChargeInfo(item, powers);
}

function add2eObjectMagicBuildVirtualSort(actor, item, power, index) {
  if (typeof globalThis.add2eBuildVirtualObjectPowerSort !== "function") {
    throw new Error("Le constructeur canonique des pouvoirs virtuels est indisponible.");
  }
  return globalThis.add2eBuildVirtualObjectPowerSort(actor, item, power, index);
}

function add2eObjectMagicPowerRow(virtualSpell, itemSource, power, index) {
  const system = virtualSpell?.system ?? {};
  const charges = Number(virtualSpell?.getFlag?.("add2e", "memorizedCount") ?? 0) || 0;
  return {
    id: virtualSpell?.id || virtualSpell?._id,
    name: virtualSpell?.name || "Pouvoir",
    img: virtualSpell?.img || "icons/svg/aura.svg",
    niveau: Number(system.niveau ?? 1) || 1,
    description: add2eMagicPowerDescription(power) || system.description || "",
    sourceItemId: system.sourceWeaponId || system.sourceItemId || itemSource?.id || "",
    sourceItemName: system.sourceItemName || itemSource?.name || "",
    sourceItemDescription: system.sourceItemDescription || itemSource?.system?.description || "",
    powerIndex: system.powerIndex ?? index,
    charges,
    max: Number(system.max ?? 0) || 0,
    cost: Number(system.cost ?? system.cout ?? 0) || 0,
    temps_incantation: system.temps_incantation ?? system.castingTime ?? system.casting_time ?? "Objet magique",
    onUse: system.onUse || system.onuse || system.on_use || "",
    onuse: system.onuse || system.onUse || system.on_use || "",
    on_use: system.on_use || system.onUse || system.onuse || ""
  };
}

function add2eInstallObjectMagicGetDataPostprocess() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant le postprocess objets magiques.");
  if (SheetClass.prototype.__add2eCanonicalObjectMagicGetData === ADD2E_OBJECT_MAGIC_POSTPROCESS_VERSION) return true;

  const originalGetData = SheetClass.prototype.getData;
  if (typeof originalGetData !== "function") throw new Error("[ADD2E] Add2eActorSheet.getData est indisponible.");

  SheetClass.prototype.getData = async function add2eCanonicalObjectMagicGetData(...args) {
    const data = await originalGetData.apply(this, args);
    try {
      const actor = data.actor ?? this.actor;
      const items = Array.from(actor?.items ?? []);
      const magicItemTypes = new Set(["arme", "armure", "objet", "object", "magic", "objet_magique"]);
      const powersForHbs = [];
      const itemsForHbs = [];
      const potionsForHbs = [];

      for (const itemSource of items) {
        if (!magicItemTypes.has(String(itemSource?.type ?? "").toLowerCase())) continue;
        if (typeof globalThis.add2eMagicItemEquippedOrUsable !== "function") {
          throw new Error("Le résolveur canonique d'utilisation des objets magiques est indisponible.");
        }
        if (!globalThis.add2eMagicItemEquippedOrUsable(itemSource)) continue;

        const powerEntries = add2eObjectMagicActivePowerEntries(itemSource);
        if (!powerEntries.length) continue;

        const potion = add2eObjectMagicIsPotion(itemSource);
        const powers = powerEntries.map(entry => entry.power);
        const chargeInfo = add2eObjectMagicChargeInfo(itemSource, powers);
        const itemPowers = [];

        for (const { power, index } of powerEntries) {
          const virtualSpell = add2eObjectMagicBuildVirtualSort(actor, itemSource, power, index);
          const row = add2eObjectMagicPowerRow(virtualSpell, itemSource, power, index);

          if (potion) {
            potionsForHbs.push({
              ...row,
              itemId: itemSource.id,
              potionName: itemSource.name,
              potionImg: itemSource.img || row.img,
              doses: row.charges,
              doseMax: row.max
            });
          } else {
            powersForHbs.push(row);
            itemPowers.push(row);
          }
        }

        if (!potion && itemPowers.length) {
          itemsForHbs.push({
            id: itemSource.id,
            name: itemSource.name,
            img: itemSource.img || "icons/svg/aura.svg",
            description: itemSource.system?.description || "",
            charges: Number(chargeInfo?.max) > 0 ? Number(chargeInfo.current) || 0 : null,
            max: Number(chargeInfo?.max) > 0 ? Number(chargeInfo.max) || 0 : null,
            powers: itemPowers
          });
        }
      }

      data.add2ePotionRows = potionsForHbs.sort((left, right) => String(left.potionName).localeCompare(String(right.potionName), "fr"));
      data.add2ePotionQuantity = data.add2ePotionRows.reduce((total, row) => total + Math.max(0, Number(row.doses) || 0), 0);
      data.add2eObjectMagicPowers = powersForHbs;
      data.add2eObjectMagicItems = itemsForHbs;
    } catch (error) {
      console.error("[ADD2E][OBJETS_MAGIQUES][GETDATA][ERROR]", error);
      data.add2ePotionRows ??= [];
      data.add2ePotionQuantity ??= 0;
      data.add2eObjectMagicPowers ??= [];
      data.add2eObjectMagicItems ??= [];
    }
    return data;
  };

  SheetClass.prototype.__add2eCanonicalObjectMagicGetData = ADD2E_OBJECT_MAGIC_POSTPROCESS_VERSION;
  return true;
}

function add2eScrollChatPlainText(value) {
  const source = String(value ?? "");
  try {
    const template = document.createElement("template");
    template.innerHTML = source;
    return String(template.content.textContent ?? "").replace(/\s+/g, " ").trim();
  } catch (_error) {
    return source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function add2eScrollChatEsc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eScrollChatCanonicalCard({ spellName = "Sort", total = null, chance = null, success = false, consumed = true } = {}) {
  const status = success ? "Apprentissage réussi" : "Apprentissage échoué";
  const detail = success
    ? `${spellName} est copié dans le livre personnel.`
    : `${spellName} n’a pas été compris et n’est pas ajouté au livre personnel.`;
  const consumption = consumed
    ? "L’inscription a été effacée du parchemin après la tentative."
    : "L’inscription n’a pas pu être effacée du parchemin.";
  return `<div class="add2e-card add2e-arcane-card add2e-scroll-learning-card ${success ? "is-success" : "is-failure"}"><header class="add2e-card-header"><img src="icons/sundries/scrolls/scroll-runed-brown.webp" alt=""><div><h3><i class="fas fa-scroll"></i> Apprentissage depuis un parchemin</h3><div class="add2e-card-source">Parchemin de sort</div></div></header><div class="add2e-card-body"><div class="add2e-book-learning-grid"><b>Sort</b><span>${add2eScrollChatEsc(spellName)}</span><b>Jet</b><span>${Number.isFinite(total) ? total : "—"}</span><b>Chance</b><span>${Number.isFinite(chance) ? `${chance}%` : "—"}</span></div><div class="add2e-book-learning-status">${status}</div><p>${add2eScrollChatEsc(detail)}</p><p class="add2e-scroll-consumption"><i class="fas fa-fire"></i> ${add2eScrollChatEsc(consumption)}</p></div></div>`;
}

function add2eNormalizeScrollChatRender(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] instanceof HTMLElement ? html[0] : null;
  if (!root) return;
  const messageContent = root.querySelector?.(".message-content") ?? root;
  const currentHtml = String(message?.content ?? messageContent?.innerHTML ?? "");
  const flavor = String(message?.flavor ?? "");
  const plain = add2eScrollChatPlainText(`${flavor} ${currentHtml}`);
  const normalized = add2eObjectMagicNormalize(plain);

  if (normalized.includes("comprehension_de") && normalized.includes("chance") && (normalized.includes("reussite") || normalized.includes("echec")) && !normalized.includes("apprentissage_depuis_un_parchemin")) {
    root.style.display = "none";
    return;
  }

  if (messageContent.querySelector?.(".add2e-scroll-learning-card")) return;
  if (!normalized.includes("copie_depuis_un_parchemin") && !normalized.includes("inscription_disparait_du_parchemin")) return;

  const spellMatch = plain.match(/copie\s+depuis\s+un\s+parchemin\s+(.+?)\s+[—-]\s+jet/i)
    ?? plain.match(/parchemin\s+(.+?)\s+[—-]\s+jet/i);
  const rollMatch = plain.match(/jet\s+(\d+)\s*\/\s*(\d+)/i);
  const spellName = String(spellMatch?.[1] ?? "Sort").trim();
  const total = rollMatch ? Number(rollMatch[1]) : null;
  const chance = rollMatch ? Number(rollMatch[2]) : null;
  const success = normalized.includes("sort_est_copie")
    || normalized.includes("copie_dans_le_livre_personnel")
    || (Number.isFinite(total) && Number.isFinite(chance) && total <= chance);
  const consumed = !normalized.includes("na_pas_pu_etre_effacee");
  messageContent.innerHTML = add2eScrollChatCanonicalCard({ spellName, total, chance, success, consumed });
}

function add2eInstallUnifiedScrollChatStyles() {
  const id = "add2e-unified-scroll-chat-style";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `.chat-message .add2e-scroll-learning-card{overflow:hidden;border:2px solid #9a6a20;border-radius:10px;background:linear-gradient(180deg,#fff9e9,#efe0b7);color:#38270d}.chat-message .add2e-scroll-learning-card .add2e-card-header{display:flex;align-items:center;gap:8px;padding:7px 9px;background:linear-gradient(90deg,#56370e,#a27025);color:#fff}.chat-message .add2e-scroll-learning-card .add2e-card-header img{width:38px!important;height:38px!important;min-width:38px!important;max-width:38px!important;object-fit:cover;border:1px solid rgba(255,255,255,.85);border-radius:6px;background:#fff}.chat-message .add2e-scroll-learning-card .add2e-card-header h3{margin:0!important;border:0!important;color:#fff!important;font-size:1rem!important;line-height:1.15}.chat-message .add2e-scroll-learning-card .add2e-card-source{font-size:.82rem;opacity:.92}.chat-message .add2e-scroll-learning-card .add2e-card-body{padding:9px 10px}.chat-message .add2e-scroll-learning-card .add2e-book-learning-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;margin:0 0 7px}.chat-message .add2e-scroll-learning-card .add2e-book-learning-status{font-weight:900;margin:5px 0}.chat-message .add2e-scroll-learning-card.is-success .add2e-book-learning-status{color:#17652d}.chat-message .add2e-scroll-learning-card.is-failure .add2e-book-learning-status{color:#8b1e1e}.chat-message .add2e-scroll-learning-card .add2e-scroll-consumption{margin:7px 0 0;padding-top:7px;border-top:1px solid rgba(92,57,10,.35);font-size:.88rem}`;
  document.head.append(style);
}

add2eInstallObjectMagicGetDataPostprocess();
globalThis.add2eMagicPowerDescription = add2eMagicPowerDescription;
Hooks.on("renderChatMessageHTML", add2eNormalizeScrollChatRender);
Hooks.once("ready", add2eInstallUnifiedScrollChatStyles);
