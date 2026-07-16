// ADD2E — Postprocess getData objets magiques — full ApplicationV2

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant le postprocess objets magiques.");
if (globalThis.Add2eActorSheet.prototype.__add2eObjectMagicGetDataV2Restored) {
  console.warn("[ADD2E][OBJETS_MAGIQUES][GETDATA] Postprocess déjà installé.");
} else {
  globalThis.Add2eActorSheet.prototype.__add2eObjectMagicGetDataV2Restored = true;
  const originalGetData = globalThis.Add2eActorSheet.prototype.getData;

  globalThis.Add2eActorSheet.prototype.getData = async function add2eObjectMagicGetDataV2(...args) {
    const data = await originalGetData.apply(this, args);
    try {
      const items = data.actor?.items ?? this.actor?.items ?? [];
      const add2eObjectMagicPowersForHbs = [];
      const add2eObjectMagicItemsForHbs = [];
      const add2ePotionRowsForHbs = [];
      const magicItemTypes = ["arme", "armure", "objet", "object", "magic", "objet_magique"];

      const normalize = value => String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      const values = value => {
        if (value === undefined || value === null || value === "") return [];
        if (Array.isArray(value)) return value.flatMap(values);
        if (typeof value === "object") {
          for (const key of ["value", "values", "items", "list", "tags", "effectTags"]) {
            if (value[key] !== undefined) return values(value[key]);
          }
        }
        return [value];
      };

      const potionMarkers = item => {
        const system = item?.system ?? {};
        return [
          system.sous_type,
          system.sousType,
          system.type_objet,
          system.typeObjet,
          system.categorie,
          system.category,
          system.forme,
          system.kind,
          ...values(system.tags),
          ...values(system.effectTags),
          item?.flags?.add2e?.kind,
          item?.flags?.add2e?.category
        ].map(normalize).filter(Boolean);
      };

      const isPotion = item => {
        if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
        return potionMarkers(item).some(marker => marker === "potion" || marker.startsWith("potion_") || marker.endsWith("_potion") || marker.includes("consommable_potion"));
      };

      const hasPowerOnUse = power => String(
        power?.onUse ?? power?.onuse ?? power?.on_use ?? power?.script ?? power?.macro ?? power?.objetMagicOnUse ?? power?.fallbackOnUse ?? power?.onUseSortPath ?? ""
      ).trim() !== "";

      const itemUsable = item => typeof globalThis.add2eMagicItemEquippedOrUsable === "function"
        ? globalThis.add2eMagicItemEquippedOrUsable(item)
        : isPotion(item) || item?.system?.equipee === true || item?.system?.equipped === true;

      const itemsAvecPouvoirs = items.filter(item => {
        const type = String(item.type || "").toLowerCase();
        const typeAccepted = magicItemTypes.includes(type);
        const usable = itemUsable(item);
        const entries = typeof add2eMagicObjectActivePowerEntries === "function"
          ? add2eMagicObjectActivePowerEntries(item)
          : (typeof add2eMagicObjectPowerArray === "function" ? add2eMagicObjectPowerArray(item).map((power, index) => ({ power, index })).filter(entry => hasPowerOnUse(entry.power)) : []);

        if (!typeAccepted) return false;
        if (!usable) return false;
        return entries.length > 0;
      });

      for (const itemSource of itemsAvecPouvoirs) {
        const potion = isPotion(itemSource);
        const powerEntries = typeof add2eMagicObjectActivePowerEntries === "function"
          ? add2eMagicObjectActivePowerEntries(itemSource)
          : add2eMagicObjectPowerArray(itemSource).map((power, index) => ({ power, index })).filter(entry => hasPowerOnUse(entry.power));

        if (!powerEntries.length) continue;

        const pouvoirs = powerEntries.map(entry => entry.power);
        const chargeInfo = typeof add2eMagicObjectChargeInfo === "function"
          ? add2eMagicObjectChargeInfo(itemSource, pouvoirs)
          : { current: Number(itemSource.system?.charges?.value ?? itemSource.system?.charges ?? 0) || 0, max: Number(itemSource.system?.charges?.max ?? itemSource.system?.max_charges ?? itemSource.system?.maxCharges ?? 0) || 0 };

        const maxGlobal = Number(chargeInfo.max) || 0;
        const currentGlobal = Number(chargeInfo.current) || 0;
        const isGlobal = maxGlobal > 0;
        const itemPowers = [];

        for (const { power: p, index: idx } of powerEntries) {
          let iconImage = p.img;
          const realSpell = game.items.find(i => i.type === "sort" && i.name.toLowerCase() === String(p.name || p.nom || "").toLowerCase());
          if (realSpell) iconImage = realSpell.img;
          if (!iconImage) iconImage = itemSource.img;

          const generatedId = typeof add2eMagicPowerGeneratedId === "function" ? add2eMagicPowerGeneratedId(itemSource, idx) : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");
          const powerMax = isGlobal ? maxGlobal : (Number(p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max ?? p.charges ?? 1) || 1);
          const onUse = String(p.onUse ?? p.onuse ?? p.on_use ?? p.script ?? p.macro ?? p.objetMagicOnUse ?? p.fallbackOnUse ?? p.onUseSortPath ?? "").trim();
          const powerCharges = isGlobal
            ? currentGlobal
            : (Number(itemSource.getFlag?.("add2e", `charges_${idx}`) ?? p.charges ?? p.uses ?? powerMax) || 0);
          const cost = Number(p.cout ?? p.cost ?? p.chargeCost ?? 0) || 0;

          const fakeSpellData = {
            _id: generatedId,
            name: `${p.name || p.nom || itemSource.name}`,
            type: "sort",
            img: iconImage,
            system: {
              niveau: p.niveau || p.level || 1,
              école: p.ecole || p["école"] || "Magique",
              description: p.description || p.desc || "",
              composantes: "Objet",
              temps_incantation: "1",
              isPower: true,
              isObjectPower: true,
              sourceWeaponId: itemSource.id,
              sourceItemId: itemSource.id,
              sourceItemName: itemSource.name,
              sourceItemDescription: itemSource.system?.description || "",
              powerIndex: idx,
              cost,
              max: powerMax,
              isGlobalCharge: isGlobal,
              onUse,
              onuse: onUse,
              on_use: onUse,
              objetMagicOnUse: p.objetMagicOnUse || p.fallbackOnUse || "",
              linkedSpell: p.linkedSpell || null
            }
          };

          const virtualSpell = new Item(fakeSpellData, { parent: this.actor });
          virtualSpell.getFlag = (scope, key) => {
            if (scope !== "add2e") return null;
            if (key === "memorizedCount") {
              if (isGlobal) {
                const val = itemSource.getFlag("add2e", "global_charges");
                return (val !== undefined) ? val : currentGlobal;
              }
              const charges = itemSource.getFlag("add2e", `charges_${idx}`);
              return (charges !== undefined) ? charges : powerCharges;
            }
            return null;
          };

          const powerForHbs = {
            id: virtualSpell.id || virtualSpell._id,
            name: virtualSpell.name || "Pouvoir",
            img: virtualSpell.img || "icons/svg/aura.svg",
            niveau: Number(virtualSpell.system?.niveau ?? 1) || 1,
            description: virtualSpell.system?.description || "",
            sourceItemId: itemSource.id,
            sourceItemName: itemSource.name,
            sourceItemDescription: itemSource.system?.description || "",
            powerIndex: idx,
            charges: Number(virtualSpell.getFlag?.("add2e", "memorizedCount") ?? powerCharges) || 0,
            max: powerMax,
            cost,
            onUse,
            onuse: onUse,
            on_use: onUse
          };

          if (potion) {
            const potionRow = {
              ...powerForHbs,
              itemId: itemSource.id,
              potionName: itemSource.name,
              potionImg: itemSource.img || powerForHbs.img,
              doses: powerForHbs.charges,
              doseMax: powerForHbs.max
            };
            add2ePotionRowsForHbs.push(potionRow);
          } else {
            add2eObjectMagicPowersForHbs.push(virtualSpell);
            itemPowers.push(powerForHbs);
          }
        }

        if (!potion && itemPowers.length) {
          add2eObjectMagicItemsForHbs.push({
            id: itemSource.id,
            name: itemSource.name,
            img: itemSource.img || "icons/svg/aura.svg",
            description: itemSource.system?.description || "",
            charges: isGlobal ? currentGlobal : null,
            max: isGlobal ? maxGlobal : null,
            powers: itemPowers
          });
        }
      }

      data.add2ePotionRows = add2ePotionRowsForHbs.sort((left, right) => String(left.potionName).localeCompare(String(right.potionName), "fr"));
      data.add2ePotionQuantity = data.add2ePotionRows.reduce((total, row) => total + Math.max(0, Number(row.doses) || 0), 0);
      data.add2eObjectMagicPowers = add2eObjectMagicPowersForHbs.map(power => ({
        id: power.id || power._id,
        name: power.name || "Pouvoir",
        img: power.img || "icons/svg/aura.svg",
        niveau: Number(power.system?.niveau ?? 1) || 1,
        description: power.system?.description || "",
        sourceItemId: power.system?.sourceWeaponId || power.system?.sourceItemId || "",
        sourceItemName: power.system?.sourceItemName || "",
        sourceItemDescription: power.system?.sourceItemDescription || "",
        powerIndex: power.system?.powerIndex ?? null,
        charges: Number(power.getFlag?.("add2e", "memorizedCount") ?? power.system?.max ?? 0) || 0,
        max: Number(power.system?.max ?? 0) || 0,
        cost: Number(power.system?.cost ?? 0) || 0,
        onUse: power.system?.onUse || power.system?.onuse || power.system?.on_use || "",
        onuse: power.system?.onuse || power.system?.onUse || power.system?.on_use || "",
        on_use: power.system?.on_use || power.system?.onUse || power.system?.onuse || ""
      }));
      data.add2eObjectMagicItems = add2eObjectMagicItemsForHbs;
    } catch (err) {
      console.error("[ADD2E][OBJETS_MAGIQUES][GETDATA][ERROR]", err);
      data.add2ePotionRows ??= [];
      data.add2ePotionQuantity ??= 0;
      data.add2eObjectMagicPowers ??= [];
      data.add2eObjectMagicItems ??= [];
    }
    return data;
  };
}

// ---------------------------------------------------------------------------
// Contrat générique : un objet magique à charges peut recevoir un sort.
// Le sort est stocké comme pouvoir standard dans system.pouvoirs afin de
// réutiliser sans duplication le lanceur, les charges et l'affichage existants.
// ---------------------------------------------------------------------------
const ADD2E_CHARGED_SPELL_ITEM_VERSION = "2026-07-16-charged-spell-items-v1";
globalThis.ADD2E_CHARGED_SPELL_ITEM_VERSION = ADD2E_CHARGED_SPELL_ITEM_VERSION;

function add2eChargedSpellNormalize(value) {
  return String(value ?? "").trim().toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

function add2eChargedSpellValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eChargedSpellValues);
  if (value instanceof Set) return [...value].flatMap(add2eChargedSpellValues);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "values", "items", "list", "tags", "effectTags"]) {
      if (value[key] !== undefined) return add2eChargedSpellValues(value[key]);
    }
  }
  return [value];
}

function add2eIsChargedSpellItem(item) {
  if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
  const system = item.system ?? {};
  const markers = [
    item.name, system.sousType, system.sous_type, system.typeObjet, system.type_objet,
    system.categorie, system.category, system.kind, system.forme,
    ...add2eChargedSpellValues(system.tags), ...add2eChargedSpellValues(system.effectTags),
    item.flags?.add2e?.kind, item.flags?.add2e?.category
  ].map(add2eChargedSpellNormalize).filter(Boolean);
  return markers.some(marker =>
    marker.includes("baguette") || marker.includes("batonnet") || marker === "wand" || marker.includes("magic_wand") || marker === "rod"
  );
}

function add2eChargedSpellPowers(item) {
  const raw = item?.system?.pouvoirs ?? item?.system?.powers ?? item?.system?.pouvoirsMagiques ?? item?.system?.magicalPowers ?? [];
  return Array.isArray(raw) ? raw.filter(entry => entry && typeof entry === "object") : (raw && typeof raw === "object" ? Object.values(raw).filter(entry => entry && typeof entry === "object") : []);
}

function add2eChargedEmbeddedSpellPowers(item) {
  return add2eChargedSpellPowers(item).filter(power => power?.add2eEmbeddedSpell === true || power?.sourceKind === "embedded-spell");
}

function add2eChargedSpellOnUse(spell) {
  return String(spell?.system?.onUse ?? spell?.system?.onuse ?? spell?.system?.on_use ?? spell?.flags?.add2e?.onUse ?? "").trim();
}

function add2eChargedSpellSourceUuid(spell) {
  return String(spell?.flags?.core?.sourceId ?? spell?._stats?.compendiumSource ?? spell?.flags?.add2e?.sourceUuid ?? spell?.uuid ?? "").trim();
}

async function add2eChargedSpellResolveDrop(event) {
  let data = null;
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor ?? null;
  try { data = editor?.getDragEventData?.(event) ?? null; } catch (_error) {}
  if (!data) {
    try { data = JSON.parse(event?.dataTransfer?.getData?.("text/plain") || "null"); } catch (_error) { data = null; }
  }
  if (!data || (data.type && data.type !== "Item")) return null;
  if (data.uuid && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(data.uuid);
      if (document?.documentName === "Item") return document;
    } catch (_error) {}
  }
  if (CONFIG?.Item?.documentClass?.fromDropData) {
    try {
      const document = await CONFIG.Item.documentClass.fromDropData(data);
      if (document?.documentName === "Item") return document;
    } catch (_error) {}
  }
  return null;
}

async function add2eChargedSpellConfirm({ title, content, yesLabel }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  return await DialogV2.wait({
    window: { title }, modal: true, rejectClose: false, content,
    buttons: [
      { action: "yes", label: yesLabel, icon: "fa-solid fa-check", default: true, callback: () => true },
      { action: "no", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }
    ]
  }) === true;
}

async function add2eChargedSpellStore(item, spell) {
  if (!add2eIsChargedSpellItem(item)) return false;
  if (String(spell?.type ?? "").toLowerCase() !== "sort") {
    ui.notifications.warn("Déposez un Item de type sort.");
    return false;
  }
  if (spell.system?.isPower === true || spell.system?.isObjectPower === true || spell.system?.isCapacity === true) {
    ui.notifications.warn("Déposez le sort source, pas un pouvoir ou une capacité générée.");
    return false;
  }
  const onUse = add2eChargedSpellOnUse(spell);
  if (!onUse) {
    ui.notifications.warn(`${spell.name} ne possède aucun script onUse utilisable.`);
    return false;
  }

  const powers = add2eChargedSpellPowers(item);
  const previous = powers.filter(power => power?.add2eEmbeddedSpell === true || power?.sourceKind === "embedded-spell");
  if (previous.length) {
    const confirmed = await add2eChargedSpellConfirm({
      title: `Remplacer le sort de ${item.name}`,
      content: `<div class="add2e-dialog" style="min-width:470px;padding:8px;"><p><b>${item.name}</b> contient déjà <b>${previous.map(power => power.name ?? power.nom).filter(Boolean).join(", ")}</b>.</p><p>Le remplacer par <b>${spell.name}</b> ? Les pouvoirs natifs seront conservés.</p></div>`,
      yesLabel: "Remplacer le sort"
    });
    if (!confirmed) return false;
  }

  const embedded = {
    name: spell.name,
    img: spell.img || item.img || "icons/svg/book.svg",
    niveau: Math.max(1, Number(spell.system?.niveau ?? spell.system?.level ?? 1) || 1),
    ecole: spell.system?.ecole ?? spell.system?.["école"] ?? spell.system?.school ?? "Magique",
    description: spell.system?.description ?? "",
    activation: spell.system?.temps_incantation ?? spell.system?.castingTime ?? "Objet magique",
    onUse,
    onuse: onUse,
    on_use: onUse,
    cost: 1,
    cout: 1,
    chargeCost: 1,
    add2eEmbeddedSpell: true,
    sourceKind: "embedded-spell",
    sourceUuid: add2eChargedSpellSourceUuid(spell),
    linkedSpell: {
      name: spell.name,
      img: spell.img || "icons/svg/book.svg",
      sourceUuid: add2eChargedSpellSourceUuid(spell),
      system: foundry.utils.deepClone(spell.system ?? {})
    }
  };

  const nativePowers = powers.filter(power => power?.add2eEmbeddedSpell !== true && power?.sourceKind !== "embedded-spell");
  await item.update({
    "system.pouvoirs": [...nativePowers, embedded],
    "system.magique": true,
    "flags.add2e.chargedSpellItem": true,
    "flags.add2e.chargedSpellItemVersion": ADD2E_CHARGED_SPELL_ITEM_VERSION
  }, { add2eInternal: true, add2eChargedSpellItem: true, render: false });

  ui.notifications.info(`${spell.name} a été placé dans ${item.name}.`);
  globalThis.add2eRerenderActorSheet?.(item.parent, true);
  return true;
}

async function add2eChargedSpellRemove(item) {
  const powers = add2eChargedSpellPowers(item);
  const embedded = powers.filter(power => power?.add2eEmbeddedSpell === true || power?.sourceKind === "embedded-spell");
  if (!embedded.length) return false;
  const confirmed = await add2eChargedSpellConfirm({
    title: `Retirer le sort de ${item.name}`,
    content: `<div class="add2e-dialog" style="min-width:450px;padding:8px;"><p>Retirer <b>${embedded.map(power => power.name ?? power.nom).filter(Boolean).join(", ")}</b> de <b>${item.name}</b> ?</p><p>Les pouvoirs natifs et les charges de l'objet seront conservés.</p></div>`,
    yesLabel: "Retirer le sort"
  });
  if (!confirmed) return false;
  const nativePowers = powers.filter(power => power?.add2eEmbeddedSpell !== true && power?.sourceKind !== "embedded-spell");
  await item.update({ "system.pouvoirs": nativePowers }, { add2eInternal: true, add2eChargedSpellItem: true, render: false });
  globalThis.add2eRerenderActorSheet?.(item.parent, true);
  return true;
}

function add2eChargedSpellSheetRoot(content) {
  if (content instanceof HTMLElement) return content;
  if (content?.[0] instanceof HTMLElement) return content[0];
  return null;
}

function add2eInstallChargedSpellItemSheet() {
  const SheetClass = globalThis.Add2eObjetSheet;
  const proto = SheetClass?.prototype;
  if (!proto || proto.__add2eChargedSpellItemV1 || typeof proto.activateListeners !== "function") return false;
  proto.__add2eChargedSpellItemV1 = true;
  const originalActivateListeners = proto.activateListeners;

  proto.activateListeners = function add2eChargedSpellActivateListeners(content) {
    const result = originalActivateListeners.call(this, content);
    const root = add2eChargedSpellSheetRoot(content);
    const item = this.item ?? this.document ?? this.object;
    if (!root || !item || !add2eIsChargedSpellItem(item)) return result;

    root.querySelectorAll(".add2e-charged-spell-panel").forEach(node => node.remove());
    const embedded = add2eChargedEmbeddedSpellPowers(item);
    const chargeInfo = typeof globalThis.add2eMagicObjectChargeInfo === "function"
      ? globalThis.add2eMagicObjectChargeInfo(item, add2eChargedSpellPowers(item))
      : { current: Number(item.system?.charges?.value ?? 0) || 0, max: Number(item.system?.charges?.max ?? 0) || 0, label: "—" };

    const panel = document.createElement("section");
    panel.className = "add2e-charged-spell-panel";
    panel.style.cssText = "margin:10px;border:1px solid #b88924;border-radius:9px;background:#fffaf0;padding:10px;";
    panel.innerHTML = `
      <h3 style="margin:0 0 8px;display:flex;align-items:center;gap:7px;"><i class="fas fa-wand-magic-sparkles"></i><span style="flex:1;">Sort de l'objet</span><span style="font-size:.82em;">Charges : ${chargeInfo.label ?? `${chargeInfo.current ?? 0}/${chargeInfo.max ?? 0}`}</span></h3>
      <div class="add2e-charged-spell-drop" style="border:2px dashed #b88924;border-radius:8px;padding:12px;text-align:center;cursor:copy;background:#fffdf7;">
        ${embedded.length ? `<b>${embedded.map(power => power.name ?? power.nom).filter(Boolean).join(", ")}</b><div style="margin-top:4px;font-size:.85em;">Déposez un autre sort pour le remplacer.</div>` : `<b>Déposez un sort ici</b><div style="margin-top:4px;font-size:.85em;">Le sort utilisera les charges de l'objet. Coût par défaut : 1 charge.</div>`}
      </div>
      ${embedded.length && this.editable ? `<div style="text-align:right;margin-top:7px;"><button type="button" class="add2e-charged-spell-remove"><i class="fas fa-trash"></i> Retirer le sort</button></div>` : ""}
    `;

    const form = root.matches?.("form") ? root : root.querySelector?.("form");
    const body = form?.querySelector?.(".sheet-body") ?? form ?? root;
    body.insertBefore(panel, body.firstElementChild ?? null);

    const dropZone = panel.querySelector(".add2e-charged-spell-drop");
    if (dropZone && this.editable) {
      const clear = () => { dropZone.style.background = "#fffdf7"; };
      dropZone.addEventListener("dragenter", event => { event.preventDefault(); event.stopPropagation(); dropZone.style.background = "#fff2bd"; });
      dropZone.addEventListener("dragover", event => { event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; dropZone.style.background = "#fff2bd"; });
      dropZone.addEventListener("dragleave", clear);
      dropZone.addEventListener("drop", async event => {
        event.preventDefault(); event.stopPropagation(); clear();
        try {
          const spell = await add2eChargedSpellResolveDrop(event);
          if (!spell) return ui.notifications.warn("Le sort déposé est introuvable.");
          if (await add2eChargedSpellStore(item, spell)) this.render({ force: true });
        } catch (error) {
          console.error("[ADD2E][OBJET_MAGIQUE][SORT_CHARGE][DROP_ERROR]", { item: item.name, error });
          ui.notifications.error(error?.message || "Erreur pendant l'ajout du sort.");
        }
      });
    }

    panel.querySelector(".add2e-charged-spell-remove")?.addEventListener("click", async event => {
      event.preventDefault(); event.stopPropagation();
      try { if (await add2eChargedSpellRemove(item)) this.render({ force: true }); }
      catch (error) {
        console.error("[ADD2E][OBJET_MAGIQUE][SORT_CHARGE][REMOVE_ERROR]", { item: item.name, error });
        ui.notifications.error(error?.message || "Erreur pendant le retrait du sort.");
      }
    });

    return result;
  };
  return true;
}

globalThis.add2eIsChargedSpellItem = add2eIsChargedSpellItem;
globalThis.add2eStoreSpellInChargedItem = add2eChargedSpellStore;
globalThis.add2eRemoveSpellFromChargedItem = add2eChargedSpellRemove;
Hooks.once("ready", () => {
  if (!add2eInstallChargedSpellItemSheet()) {
    window.setTimeout(add2eInstallChargedSpellItemSheet, 250);
  }
});
