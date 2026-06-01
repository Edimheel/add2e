// ADD2E — Postprocess getData objets magiques — full ApplicationV2
// Restaure les données HBS V1 add2eObjectMagicPowers/add2eObjectMagicItems sans ActorSheet.prototype.getData.

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
      const magicItemTypes = ["arme", "armure", "objet", "object", "magic", "objet_magique"];

      const hasPowerOnUse = power => String(
        power?.onUse ?? power?.onuse ?? power?.on_use ?? power?.script ?? power?.macro ?? power?.objetMagicOnUse ?? power?.fallbackOnUse ?? power?.onUseSortPath ?? ""
      ).trim() !== "";

      const itemEquipped = item => item?.system?.equipee === true || item?.system?.equipped === true;

      const itemsAvecPouvoirs = items.filter(item => {
        if (!magicItemTypes.includes(String(item.type || "").toLowerCase())) return false;
        if (!itemEquipped(item)) return false;
        const entries = typeof add2eMagicObjectActivePowerEntries === "function"
          ? add2eMagicObjectActivePowerEntries(item)
          : (typeof add2eMagicObjectPowerArray === "function" ? add2eMagicObjectPowerArray(item).map((power, index) => ({ power, index })).filter(entry => hasPowerOnUse(entry.power)) : []);
        return entries.length > 0;
      });

      for (const itemSource of itemsAvecPouvoirs) {
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

          add2eObjectMagicPowersForHbs.push(virtualSpell);
          itemPowers.push(powerForHbs);
        }

        if (itemPowers.length) {
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
      console.warn("[ADD2E][OBJETS_MAGIQUES][GETDATA][V2] restauration échouée", err);
      data.add2eObjectMagicPowers ??= [];
      data.add2eObjectMagicItems ??= [];
    }
    return data;
  };

  console.log("[ADD2E][OBJETS_MAGIQUES][GETDATA][V2] restauré");
}
