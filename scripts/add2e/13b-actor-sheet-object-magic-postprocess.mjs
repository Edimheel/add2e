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

const ADD2E_MAGIC_ITEM_BUILDER_VERSION = "2026-07-16-magic-item-builder-v2";
globalThis.ADD2E_MAGIC_ITEM_BUILDER_VERSION = ADD2E_MAGIC_ITEM_BUILDER_VERSION;

function add2eMagicBuilderNormalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

function add2eMagicBuilderValues(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eMagicBuilderValues);
  if (value instanceof Set) return [...value].flatMap(add2eMagicBuilderValues);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "values", "items", "list", "tags", "effectTags"]) if (value[key] !== undefined) return add2eMagicBuilderValues(value[key]);
  }
  return [value];
}

function add2eMagicBuilderMarkers(item) {
  const system = item?.system ?? {};
  return [item?.name, system.sousType, system.sous_type, system.typeObjet, system.type_objet, system.categorie, system.category, system.kind, system.forme, ...add2eMagicBuilderValues(system.tags), ...add2eMagicBuilderValues(system.effectTags), item?.flags?.add2e?.kind, item?.flags?.add2e?.category, item?.flags?.add2e?.magicItemProfile].map(add2eMagicBuilderNormalize).filter(Boolean);
}

function add2eMagicBuilderProfile(item) {
  const markers = add2eMagicBuilderMarkers(item);
  if (markers.some(marker => marker === "potion" || marker.startsWith("potion_") || marker.endsWith("_potion"))) return "potion";
  if (markers.some(marker => marker.includes("parchemin") || marker === "spell_scroll")) return "parchemin";
  if (markers.some(marker => marker.includes("baguette") || marker === "wand" || marker.includes("magic_wand"))) return "baguette";
  if (markers.some(marker => marker.includes("batonnet") || marker === "rod")) return "batonnet";
  if (markers.some(marker => marker.includes("anneau") || marker === "ring")) return "anneau";
  return "";
}

function add2eMagicBuilderPowers(item) {
  const raw = item?.system?.pouvoirs ?? item?.system?.powers ?? item?.system?.pouvoirsMagiques ?? item?.system?.magicalPowers ?? [];
  return Array.isArray(raw) ? raw.filter(entry => entry && typeof entry === "object") : (raw && typeof raw === "object" ? Object.values(raw).filter(entry => entry && typeof entry === "object") : []);
}

function add2eMagicBuilderOnUse(spell) {
  return String(spell?.system?.onUse ?? spell?.system?.onuse ?? spell?.system?.on_use ?? spell?.flags?.add2e?.onUse ?? "").trim();
}

function add2eMagicBuilderSourceUuid(spell) {
  return String(spell?.flags?.core?.sourceId ?? spell?._stats?.compendiumSource ?? spell?.flags?.add2e?.sourceUuid ?? spell?.uuid ?? "").trim();
}

function add2eMagicBuilderEsc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function add2eMagicBuilderResolveDrop(event) {
  let data = null;
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor ?? null;
  try { data = editor?.getDragEventData?.(event) ?? null; } catch (_error) {}
  if (!data) try { data = JSON.parse(event?.dataTransfer?.getData?.("text/plain") || "null"); } catch (_error) { data = null; }
  if (!data || (data.type && data.type !== "Item")) return null;
  if (data.uuid && typeof fromUuid === "function") try { const document = await fromUuid(data.uuid); if (document?.documentName === "Item") return document; } catch (_error) {}
  if (CONFIG?.Item?.documentClass?.fromDropData) try { const document = await CONFIG.Item.documentClass.fromDropData(data); if (document?.documentName === "Item") return document; } catch (_error) {}
  return null;
}

async function add2eMagicBuilderConfirm({ title, content, yesLabel = "Confirmer" }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) { ui.notifications.error("DialogV2 est introuvable."); return false; }
  return await DialogV2.wait({ window: { title }, modal: true, rejectClose: false, content, buttons: [{ action: "yes", label: yesLabel, icon: "fa-solid fa-check", default: true, callback: () => true }, { action: "no", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }] }) === true;
}

async function add2eMagicBuilderAskSpellCost(item, spell) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) { ui.notifications.error("DialogV2 est introuvable."); return null; }
  return await DialogV2.wait({
    window: { title: `Ajouter ${spell.name}` }, modal: true, rejectClose: false,
    content: `<form class="add2e-dialog" style="min-width:440px;padding:8px;"><p>Ajouter <b>${add2eMagicBuilderEsc(spell.name)}</b> à <b>${add2eMagicBuilderEsc(item.name)}</b>.</p><div class="form-group"><label>Coût en charges</label><input name="cost" type="number" min="0" step="1" value="1"></div></form>`,
    buttons: [{ action: "add", label: "Ajouter le sort", icon: "fa-solid fa-plus", default: true, callback: (_event, _button, dialog) => Math.max(0, Math.trunc(Number(dialog?.element?.querySelector?.('input[name="cost"]')?.value) || 0)) }, { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }]
  });
}

async function add2eMagicBuilderStoreSpell(item, spell) {
  const profile = add2eMagicBuilderProfile(item);
  if (!profile || profile === "parchemin") return false;
  if (String(spell?.type ?? "").toLowerCase() !== "sort") { ui.notifications.warn("Déposez un Item de type sort."); return false; }
  if (spell.system?.isPower === true || spell.system?.isObjectPower === true || spell.system?.isCapacity === true) { ui.notifications.warn("Déposez le sort source, pas un pouvoir ou une capacité générée."); return false; }
  const onUse = add2eMagicBuilderOnUse(spell);
  if (!onUse) { ui.notifications.warn(`${spell.name} ne possède aucun script onUse utilisable.`); return false; }
  const powers = add2eMagicBuilderPowers(item);
  if (profile === "potion" && powers.length >= 1) { ui.notifications.warn("Une potion ne peut contenir qu'un seul sort ou pouvoir."); return false; }
  const sourceUuid = add2eMagicBuilderSourceUuid(spell);
  const duplicate = powers.some(power => String(power?.sourceUuid ?? power?.linkedSpell?.sourceUuid ?? "") === sourceUuid || (add2eMagicBuilderNormalize(power?.name ?? power?.nom) === add2eMagicBuilderNormalize(spell.name) && Number(power?.niveau ?? power?.level ?? 1) === Number(spell.system?.niveau ?? spell.system?.level ?? 1)));
  if (duplicate) { ui.notifications.info(`${spell.name} est déjà présent dans ${item.name}.`); return false; }
  const cost = await add2eMagicBuilderAskSpellCost(item, spell);
  if (cost === null || cost === undefined) return false;
  const embedded = { name: spell.name, img: spell.img || item.img || "icons/svg/book.svg", niveau: Math.max(1, Number(spell.system?.niveau ?? spell.system?.level ?? 1) || 1), ecole: spell.system?.ecole ?? spell.system?.["école"] ?? spell.system?.school ?? "Magique", description: spell.system?.description ?? "", activation: spell.system?.temps_incantation ?? spell.system?.castingTime ?? "Objet magique", onUse, onuse: onUse, on_use: onUse, cost, cout: cost, chargeCost: cost, add2eEmbeddedSpell: true, sourceKind: "embedded-spell", sourceUuid, linkedSpell: { name: spell.name, img: spell.img || "icons/svg/book.svg", sourceUuid, system: foundry.utils.deepClone(spell.system ?? {}) } };
  await item.update({ "system.pouvoirs": [...powers, embedded], "system.magique": true, "flags.add2e.magicItemProfile": profile, "flags.add2e.magicItemBuilderVersion": ADD2E_MAGIC_ITEM_BUILDER_VERSION }, { add2eInternal: true, add2eMagicItemBuilder: true, render: false });
  ui.notifications.info(`${spell.name} a été ajouté à ${item.name} pour ${cost} charge${cost > 1 ? "s" : ""}.`);
  globalThis.add2eRerenderActorSheet?.(item.parent, true);
  return true;
}

async function add2eMagicBuilderRemovePower(item, index) {
  const powers = add2eMagicBuilderPowers(item);
  const power = powers[index];
  if (!power) return false;
  const name = String(power.name ?? power.nom ?? `Pouvoir ${index + 1}`);
  const confirmed = await add2eMagicBuilderConfirm({ title: `Retirer ${name}`, content: `<div class="add2e-dialog" style="min-width:450px;padding:8px;"><p>Retirer <b>${add2eMagicBuilderEsc(name)}</b> de <b>${add2eMagicBuilderEsc(item.name)}</b> ?</p><p>Les autres pouvoirs, les sorts et les charges seront conservés.</p></div>`, yesLabel: "Retirer" });
  if (!confirmed) return false;
  await item.update({ "system.pouvoirs": powers.filter((_entry, position) => position !== index) }, { add2eInternal: true, add2eMagicItemBuilder: true, render: false });
  globalThis.add2eRerenderActorSheet?.(item.parent, true);
  return true;
}

function add2eMagicBuilderSheetRoot(content) { if (content instanceof HTMLElement) return content; if (content?.[0] instanceof HTMLElement) return content[0]; return null; }

function add2eInstallMagicItemSheetManager() {
  const proto = globalThis.Add2eObjetSheet?.prototype;
  if (!proto || proto.__add2eMagicItemBuilderV2 || typeof proto.activateListeners !== "function") return false;
  proto.__add2eMagicItemBuilderV2 = true;
  const originalActivateListeners = proto.activateListeners;
  proto.activateListeners = function add2eMagicItemBuilderActivateListeners(content) {
    const result = originalActivateListeners.call(this, content);
    const root = add2eMagicBuilderSheetRoot(content);
    const item = this.item ?? this.document ?? this.object;
    const profile = add2eMagicBuilderProfile(item);
    if (!root || !item || !profile || profile === "parchemin") return result;
    root.querySelectorAll(".add2e-magic-item-builder-panel, .add2e-charged-spell-panel").forEach(node => node.remove());
    const powers = add2eMagicBuilderPowers(item);
    const chargeInfo = typeof globalThis.add2eMagicObjectChargeInfo === "function" ? globalThis.add2eMagicObjectChargeInfo(item, powers) : { current: Number(item.system?.charges?.value ?? 0) || 0, max: Number(item.system?.charges?.max ?? 0) || 0, label: "—" };
    const canAdd = profile !== "potion" || powers.length === 0;
    const rows = powers.length ? powers.map((power, index) => { const embedded = power?.add2eEmbeddedSpell === true || power?.sourceKind === "embedded-spell"; const name = add2eMagicBuilderEsc(power?.name ?? power?.nom ?? `Pouvoir ${index + 1}`); const cost = Math.max(0, Number(power?.cost ?? power?.cout ?? power?.chargeCost ?? 0) || 0); return `<tr><td><img src="${add2eMagicBuilderEsc(power?.img || item.img || "icons/svg/aura.svg")}" alt="" style="width:30px;height:30px;border-radius:5px;object-fit:cover;"></td><td><b>${name}</b><div style="font-size:.78em;opacity:.75;">${embedded ? "Sort embarqué" : "Pouvoir natif"}</div></td><td style="text-align:center;">${cost}</td><td style="text-align:right;">${this.editable ? `<button type="button" class="add2e-magic-power-remove" data-power-index="${index}" title="Retirer ${name}"><i class="fas fa-trash"></i></button>` : ""}</td></tr>`; }).join("") : `<tr><td colspan="4" style="text-align:center;opacity:.7;">Aucun pouvoir ni sort configuré.</td></tr>`;
    const panel = document.createElement("section");
    panel.className = "add2e-magic-item-builder-panel";
    panel.style.cssText = "margin:10px;border:1px solid #b88924;border-radius:9px;background:#fffaf0;padding:10px;";
    panel.innerHTML = `<h3 style="margin:0 0 8px;display:flex;align-items:center;gap:7px;"><i class="fas fa-wand-magic-sparkles"></i><span style="flex:1;">Pouvoirs et sorts de l'objet</span><span style="font-size:.82em;">Charges : ${add2eMagicBuilderEsc(chargeInfo.label ?? `${chargeInfo.current ?? 0}/${chargeInfo.max ?? 0}`)}</span></h3><table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><thead><tr><th style="width:38px;"></th><th>Pouvoir / sort</th><th style="width:70px;">Coût</th><th style="width:52px;"></th></tr></thead><tbody>${rows}</tbody></table>${canAdd ? `<div class="add2e-magic-spell-drop" style="border:2px dashed #b88924;border-radius:8px;padding:12px;text-align:center;cursor:copy;background:#fffdf7;"><b>Déposez un sort ici</b><div style="margin-top:4px;font-size:.85em;">Le coût en charges sera demandé avant l'ajout.</div></div>` : `<div style="border:1px solid #d7bd70;border-radius:8px;padding:9px;text-align:center;background:#fffdf7;">Une potion ne peut contenir qu'un seul sort ou pouvoir.</div>`}`;
    const form = root.matches?.("form") ? root : root.querySelector?.("form");
    const body = form?.querySelector?.(".sheet-body") ?? form ?? root;
    body.insertBefore(panel, body.firstElementChild ?? null);
    const dropZone = panel.querySelector(".add2e-magic-spell-drop");
    if (dropZone && this.editable) {
      const clear = () => { dropZone.style.background = "#fffdf7"; };
      dropZone.addEventListener("dragenter", event => { event.preventDefault(); event.stopPropagation(); dropZone.style.background = "#fff2bd"; });
      dropZone.addEventListener("dragover", event => { event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"; dropZone.style.background = "#fff2bd"; });
      dropZone.addEventListener("dragleave", clear);
      dropZone.addEventListener("drop", async event => { event.preventDefault(); event.stopPropagation(); clear(); try { const spell = await add2eMagicBuilderResolveDrop(event); if (!spell) return ui.notifications.warn("Le sort déposé est introuvable."); if (await add2eMagicBuilderStoreSpell(item, spell)) this.render({ force: true }); } catch (error) { console.error("[ADD2E][OBJET_MAGIQUE][BUILDER][DROP_ERROR]", { item: item.name, error }); ui.notifications.error(error?.message || "Erreur pendant l'ajout du sort."); } });
    }
    for (const button of panel.querySelectorAll(".add2e-magic-power-remove")) button.addEventListener("click", async event => { event.preventDefault(); event.stopPropagation(); const index = Number(button.dataset.powerIndex); try { if (await add2eMagicBuilderRemovePower(item, index)) this.render({ force: true }); } catch (error) { console.error("[ADD2E][OBJET_MAGIQUE][BUILDER][REMOVE_ERROR]", { item: item.name, index, error }); ui.notifications.error(error?.message || "Erreur pendant le retrait du pouvoir."); } });
    return result;
  };
  return true;
}

const ADD2E_MAGIC_ITEM_PROFILES = Object.freeze({
  anneau: Object.freeze({ label: "Anneau", sousType: "anneau", img: "icons/equipment/finger/ring-band-engraved-gold.webp", consumable: false, charges: false, tags: ["objet_magique", "sous_type:anneau", "anneau", "actif_si_equipe"] }),
  parchemin: Object.freeze({ label: "Parchemin", sousType: "parchemin_de_sort", img: "icons/sundries/scrolls/scroll-runed-brown.webp", consumable: true, charges: false, tags: ["objet_magique", "parchemin", "parchemin_de_sort", "consommable"] }),
  baguette: Object.freeze({ label: "Baguette", sousType: "baguette", img: "icons/weapons/wands/wand-gem-blue.webp", consumable: false, charges: true, tags: ["objet_magique", "sous_type:baguette", "baguette", "charges", "actif_si_equipe"] }),
  batonnet: Object.freeze({ label: "Bâtonnet", sousType: "batonnet", img: "icons/weapons/staves/staff-engraved-brown.webp", consumable: false, charges: true, tags: ["objet_magique", "sous_type:batonnet", "batonnet", "charges", "actif_si_equipe"] }),
  potion: Object.freeze({ label: "Potion", sousType: "potion", img: "icons/consumables/potions/potion-bottle-corked-blue.webp", consumable: true, charges: true, tags: ["objet_magique", "potion", "consommable_potion", "consommable"] })
});

async function add2eMagicItemCreatorDialog(directory = null) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable.");
  const result = await DialogV2.wait({
    window: { title: "Créer un objet magique" }, modal: true, rejectClose: false,
    content: `<form class="add2e-dialog add2e-magic-item-create-form" style="min-width:500px;padding:8px;"><div class="form-group"><label>Type</label><select name="profile">${Object.entries(ADD2E_MAGIC_ITEM_PROFILES).map(([key, profile]) => `<option value="${key}">${profile.label}</option>`).join("")}</select></div><div class="form-group"><label>Nom</label><input name="name" type="text" value="Objet magique"></div><div class="form-group"><label>Charges actuelles</label><input name="chargesValue" type="number" min="0" step="1" value="10"></div><div class="form-group"><label>Charges maximales</label><input name="chargesMax" type="number" min="0" step="1" value="10"></div><p style="font-size:.85em;opacity:.8;">Potion : un seul sort. Baguette, bâtonnet et anneau : plusieurs pouvoirs ou sorts. Parchemin : plusieurs sorts via son document magique.</p></form>`,
    buttons: [{ action: "create", label: "Créer l'objet magique", icon: "fa-solid fa-wand-magic-sparkles", default: true, callback: (_event, _button, dialog) => { const form = dialog?.element?.querySelector?.("form.add2e-magic-item-create-form"); if (!form) return null; const data = Object.fromEntries(new FormData(form).entries()); return { profile: String(data.profile ?? "").trim(), name: String(data.name ?? "").trim(), chargesValue: Math.max(0, Math.trunc(Number(data.chargesValue) || 0)), chargesMax: Math.max(0, Math.trunc(Number(data.chargesMax) || 0)) }; } }, { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }]
  });
  if (!result) return null;
  const profile = ADD2E_MAGIC_ITEM_PROFILES[result.profile];
  if (!profile) return ui.notifications.error("Type d'objet magique inconnu.");
  const name = result.name || profile.label;
  const max = profile.charges ? Math.max(result.chargesMax, result.chargesValue) : 0;
  const current = profile.charges ? Math.min(result.chargesValue, max) : 0;
  const system = { nom: name, type: "objet", categorie: "objet_magique", sousType: profile.sousType, sous_type: profile.sousType, quantite: 1, poids: 0, magique: true, equipee: false, consommable: profile.consumable, description: "", tags: [...profile.tags], effectTags: [...profile.tags], pouvoirs: [] };
  if (profile.charges) system.charges = { value: current, max };
  if (result.profile === "parchemin") system.arcaneDocument = { schema: 1, kind: "spell-scroll", personal: false, spells: [] };
  const folder = directory?.currentFolder?.id ?? directory?.folder?.id ?? null;
  const itemData = { name, type: "objet", img: profile.img, system, flags: { add2e: { magicItemProfile: result.profile, magicItemBuilderVersion: ADD2E_MAGIC_ITEM_BUILDER_VERSION, kind: profile.sousType, category: "objet_magique", ...(result.profile === "parchemin" ? { arcaneDocumentKind: "spell-scroll" } : {}) } } };
  if (folder) itemData.folder = folder;
  const ItemClass = CONFIG?.Item?.documentClass ?? globalThis.Item;
  const created = await ItemClass.create(itemData, { renderSheet: true });
  ui.notifications.info(`${created?.name ?? name} a été créé.`);
  return created;
}

function add2eInstallMagicItemDirectoryButton(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] instanceof HTMLElement ? html[0] : app?.element;
  if (!root?.querySelector || root.querySelector(".add2e-create-magic-item")) return;
  const header = root.querySelector(".directory-header .header-actions, .directory-header .action-buttons, .directory-header");
  if (!header) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "add2e-create-magic-item";
  button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Créer un objet magique';
  button.title = "Créer un objet magique préconfiguré";
  button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); add2eMagicItemCreatorDialog(app).catch(error => { console.error("[ADD2E][OBJET_MAGIQUE][CREATE_ERROR]", error); ui.notifications.error(error?.message || "Erreur pendant la création de l'objet magique."); }); });
  header.appendChild(button);
}

Hooks.on("renderItemDirectory", add2eInstallMagicItemDirectoryButton);
Hooks.on("renderSidebarTab", (app, html) => { const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase(); if (id.includes("item")) add2eInstallMagicItemDirectoryButton(app, html); });

globalThis.add2eMagicBuilderProfile = add2eMagicBuilderProfile;
globalThis.add2eStoreSpellInMagicItem = add2eMagicBuilderStoreSpell;
globalThis.add2eRemoveMagicItemPower = add2eMagicBuilderRemovePower;
globalThis.add2eCreateMagicItem = add2eMagicItemCreatorDialog;
Hooks.once("ready", () => { if (!add2eInstallMagicItemSheetManager()) window.setTimeout(add2eInstallMagicItemSheetManager, 250); });
