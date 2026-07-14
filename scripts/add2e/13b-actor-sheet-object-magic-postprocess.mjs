// ADD2E — Postprocess getData objets magiques — full ApplicationV2
// Version : 2026-07-14-identification-gating-v1
// Prépare les pouvoirs d'objets magiques pour la feuille sans ActorSheet.prototype.getData.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant le postprocess objets magiques.");

if (globalThis.Add2eActorSheet.prototype.__add2eObjectMagicGetDataV2Restored) {
  console.warn("[ADD2E][OBJETS_MAGIQUES][GETDATA] Postprocess déjà installé.");
} else {
  globalThis.Add2eActorSheet.prototype.__add2eObjectMagicGetDataV2Restored = true;
  const originalGetData = globalThis.Add2eActorSheet.prototype.getData;

  const isIdentified = item => item?.system?.identifie === true
    || item?.system?.identified === true
    || item?.getFlag?.("add2e", "identified") === true;

  const genericName = item => String(
    item?.system?.nom_non_identifie
    ?? item?.system?.unidentifiedName
    ?? item?.system?.sousType
    ?? "Objet magique"
  ).trim() || "Objet magique";

  const trueName = item => String(
    item?.system?.nom
    ?? item?.system?.nom_reel
    ?? item?.system?.trueName
    ?? item?.name
    ?? "Objet magique"
  ).trim() || "Objet magique";

  const hasPowerOnUse = power => String(
    power?.onUse
    ?? power?.onuse
    ?? power?.on_use
    ?? power?.script
    ?? power?.macro
    ?? power?.objetMagicOnUse
    ?? power?.fallbackOnUse
    ?? power?.onUseSortPath
    ?? ""
  ).trim() !== "";

  const itemEquipped = item => item?.system?.equipee === true || item?.system?.equipped === true;

  globalThis.Add2eActorSheet.prototype.getData = async function add2eObjectMagicGetDataV2(...args) {
    const data = await originalGetData.apply(this, args);

    try {
      const items = data.actor?.items ?? this.actor?.items ?? [];
      const powerDocuments = [];
      const magicItems = [];
      const magicItemTypes = ["arme", "armure", "objet", "object", "magic", "objet_magique"];

      const eligibleItems = items.filter(item => {
        if (!magicItemTypes.includes(String(item.type || "").toLowerCase())) return false;
        if (!itemEquipped(item)) return false;
        if (!isIdentified(item)) return false;

        const entries = typeof add2eMagicObjectActivePowerEntries === "function"
          ? add2eMagicObjectActivePowerEntries(item)
          : (typeof add2eMagicObjectPowerArray === "function"
            ? add2eMagicObjectPowerArray(item)
              .map((power, index) => ({ power, index }))
              .filter(entry => hasPowerOnUse(entry.power))
            : []);

        return entries.length > 0;
      });

      for (const itemSource of eligibleItems) {
        const powerEntries = typeof add2eMagicObjectActivePowerEntries === "function"
          ? add2eMagicObjectActivePowerEntries(itemSource)
          : add2eMagicObjectPowerArray(itemSource)
            .map((power, index) => ({ power, index }))
            .filter(entry => hasPowerOnUse(entry.power));

        if (!powerEntries.length) continue;

        const powers = powerEntries.map(entry => entry.power);
        const chargeInfo = typeof add2eMagicObjectChargeInfo === "function"
          ? add2eMagicObjectChargeInfo(itemSource, powers)
          : {
              current: Number(itemSource.system?.charges?.value ?? itemSource.system?.charges ?? 0) || 0,
              max: Number(itemSource.system?.charges?.max ?? itemSource.system?.max_charges ?? itemSource.system?.maxCharges ?? 0) || 0
            };

        const maxGlobal = Number(chargeInfo.max) || 0;
        const currentGlobal = Number(chargeInfo.current) || 0;
        const isGlobal = maxGlobal > 0;
        const itemPowers = [];

        for (const { power, index } of powerEntries) {
          let iconImage = power.img;
          const realSpell = game.items.find(candidate =>
            candidate.type === "sort"
            && candidate.name.toLowerCase() === String(power.name || power.nom || "").toLowerCase()
          );

          if (realSpell) iconImage = realSpell.img;
          if (!iconImage) iconImage = itemSource.img;

          const generatedId = typeof add2eMagicPowerGeneratedId === "function"
            ? add2eMagicPowerGeneratedId(itemSource, index)
            : itemSource.id.substring(0, 14) + index.toString().padStart(2, "0");

          const powerMax = isGlobal
            ? maxGlobal
            : (Number(power.max ?? power.maxCharges ?? power.chargesMax ?? power.charges_max ?? power.charges ?? 1) || 1);

          const onUse = String(
            power.onUse
            ?? power.onuse
            ?? power.on_use
            ?? power.script
            ?? power.macro
            ?? power.objetMagicOnUse
            ?? power.fallbackOnUse
            ?? power.onUseSortPath
            ?? ""
          ).trim();

          const powerCharges = isGlobal
            ? currentGlobal
            : (Number(itemSource.getFlag?.("add2e", `charges_${index}`) ?? power.charges ?? power.uses ?? powerMax) || 0);

          const cost = Number(power.cout ?? power.cost ?? power.chargeCost ?? 0) || 0;
          const sourceName = trueName(itemSource);

          const fakeSpellData = {
            _id: generatedId,
            name: String(power.name || power.nom || sourceName),
            type: "sort",
            img: iconImage,
            system: {
              niveau: power.niveau || power.level || 1,
              école: power.ecole || power["école"] || "Magique",
              description: power.description || power.desc || "",
              composantes: "Objet",
              temps_incantation: "1",
              isPower: true,
              isObjectPower: true,
              sourceWeaponId: itemSource.id,
              sourceItemId: itemSource.id,
              sourceItemName: sourceName,
              sourceItemDescription: itemSource.system?.description || "",
              powerIndex: index,
              cost,
              max: powerMax,
              isGlobalCharge: isGlobal,
              onUse,
              onuse: onUse,
              on_use: onUse,
              objetMagicOnUse: power.objetMagicOnUse || power.fallbackOnUse || "",
              linkedSpell: power.linkedSpell || null
            }
          };

          const virtualSpell = new Item(fakeSpellData, { parent: this.actor });
          virtualSpell.getFlag = (scope, key) => {
            if (scope !== "add2e") return null;
            if (key === "memorizedCount") {
              if (isGlobal) {
                const value = itemSource.getFlag?.("add2e", "global_charges");
                return value !== undefined ? value : currentGlobal;
              }

              const value = itemSource.getFlag?.("add2e", `charges_${index}`);
              return value !== undefined ? value : powerCharges;
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
            sourceItemName: sourceName,
            sourceItemDescription: itemSource.system?.description || "",
            powerIndex: index,
            charges: Number(virtualSpell.getFlag?.("add2e", "memorizedCount") ?? powerCharges) || 0,
            max: powerMax,
            cost,
            onUse,
            onuse: onUse,
            on_use: onUse
          };

          powerDocuments.push(virtualSpell);
          itemPowers.push(powerForHbs);
        }

        if (itemPowers.length) {
          magicItems.push({
            id: itemSource.id,
            name: trueName(itemSource),
            img: itemSource.img || "icons/svg/aura.svg",
            description: itemSource.system?.description || "",
            charges: isGlobal ? currentGlobal : null,
            max: isGlobal ? maxGlobal : null,
            powers: itemPowers
          });
        }
      }

      data.add2eObjectMagicPowers = powerDocuments.map(power => ({
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

      data.add2eObjectMagicItems = magicItems;
      data.add2eUnidentifiedMagicItems = items
        .filter(item => magicItemTypes.includes(String(item.type || "").toLowerCase()) && !isIdentified(item))
        .map(item => ({
          id: item.id,
          name: genericName(item),
          img: item.img || "icons/svg/item-bag.svg",
          identified: false
        }));
    } catch (error) {
      console.warn("[ADD2E][OBJETS_MAGIQUES][GETDATA][V2] préparation échouée", error);
      data.add2eObjectMagicPowers ??= [];
      data.add2eObjectMagicItems ??= [];
      data.add2eUnidentifiedMagicItems ??= [];
    }

    return data;
  };

  console.log("[ADD2E][OBJETS_MAGIQUES][GETDATA][V2] identification et verrouillage des pouvoirs installés");
}
