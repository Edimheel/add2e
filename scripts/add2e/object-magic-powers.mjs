// scripts/add2e/object-magic-powers.mjs
// ADD2E — Pouvoirs d'objets magiques et affichage associé.
// Extrait de scripts/add2e.mjs pour rendre la logique exploitable isolément.

function add2eObjectMagicEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eObjectMagicToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(v => add2eObjectMagicToArray(v)).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;\n|]+/).map(x => x.trim()).filter(Boolean);
  if (value && typeof value === "object") {
    for (const key of ["value", "list", "lists", "items", "tags", "effectTags"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eObjectMagicToArray(value[key]);
    }
  }
  return [];
}

function add2eObjectMagicNormalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

export function add2eObjectPowerOnUsePath(power) {
  return String(
    power?.onUse ??
    power?.onuse ??
    power?.on_use ??
    power?.script ??
    power?.macro ??
    power?.objetMagicOnUse ??
    power?.fallbackOnUse ??
    power?.onUseSortPath ??
    power?.linkedSpell?.onUse ??
    power?.linkedSpell?.onuse ??
    power?.linkedSpell?.on_use ??
    ""
  ).trim();
}

export function add2eObjectPowerCost(power) {
  return Math.max(0, Number(power?.cout ?? power?.cost ?? power?.chargeCost ?? 0) || 0);
}

export function add2eObjectPowerMaxCharges(itemSource, power, idx) {
  const sys = itemSource?.system ?? {};
  const globalMax = Number(sys?.charges?.max ?? sys?.max_charges ?? sys?.maxCharges ?? sys?.chargesMax ?? 0) || 0;
  if (globalMax > 0) return globalMax;
  return Number(power?.max ?? power?.chargesMax ?? power?.maxCharges ?? power?.charges?.max ?? power?.charges ?? 1) || 1;
}

export function add2eObjectPowerCurrentCharges(itemSource, power, idx) {
  const sys = itemSource?.system ?? {};
  const cost = add2eObjectPowerCost(power);

  if (cost <= 0) return 1;

  const globalMax = Number(sys?.charges?.max ?? sys?.max_charges ?? sys?.maxCharges ?? sys?.chargesMax ?? 0) || 0;

  if (globalMax > 0) {
    const flag = itemSource.getFlag?.("add2e", "global_charges");
    if (flag !== undefined && flag !== null && flag !== "") return Number(flag) || 0;
    return Number(sys?.charges?.value ?? sys?.chargesValeur ?? sys?.charges_value ?? globalMax) || 0;
  }

  const flag = itemSource.getFlag?.("add2e", `charges_${idx}`);
  if (flag !== undefined && flag !== null && flag !== "") return Number(flag) || 0;
  return Number(power?.charges?.value ?? power?.charges ?? power?.value ?? power?.max ?? 1) || 0;
}

export async function add2eObjectPowerSetCharges(itemSource, power, idx, value) {
  const sys = itemSource?.system ?? {};
  const globalMax = Number(sys?.charges?.max ?? sys?.max_charges ?? sys?.maxCharges ?? sys?.chargesMax ?? 0) || 0;
  const next = Math.max(0, Number(value) || 0);

  if (globalMax > 0) {
    await itemSource.setFlag?.("add2e", "global_charges", next);
    if (sys?.charges && typeof sys.charges === "object") {
      await itemSource.update({ "system.charges.value": next });
    }
    return;
  }

  await itemSource.setFlag?.("add2e", `charges_${idx}`, next);
}

export function add2eMagicPowerGeneratedId(item, index) {
  return String(item?.id ?? "00000000000000").substring(0, 14) + String(index).padStart(2, "0");
}

export function add2eBuildVirtualObjectPowerSort(actor, itemSource, power, idx) {
  const generatedId = add2eMagicPowerGeneratedId(itemSource, idx);
  const onUse = add2eObjectPowerOnUsePath(power);
  const cost = add2eObjectPowerCost(power);
  const max = cost <= 0 ? Math.max(1, add2eObjectPowerMaxCharges(itemSource, power, idx)) : add2eObjectPowerMaxCharges(itemSource, power, idx);
  const current = cost <= 0 ? 1 : add2eObjectPowerCurrentCharges(itemSource, power, idx);

  const fakeData = {
    _id: generatedId,
    name: String(power?.name ?? power?.nom ?? itemSource?.name ?? "Pouvoir").trim() || "Pouvoir",
    type: "sort",
    img: power?.img || itemSource?.img || "icons/svg/aura.svg",
    system: {
      niveau: Number(power?.niveau ?? power?.level ?? 1) || 1,
      école: power?.ecole || power?.["école"] || "Magique",
      description: power?.description || power?.desc || itemSource?.system?.description || "",
      composantes: "Objet",
      temps_incantation: power?.activation || power?.temps_incantation || "Objet magique",
      isPower: true,
      isObjectPower: true,
      sourceItemId: itemSource.id,
      sourceWeaponId: itemSource.id,
      sourceItemName: itemSource.name,
      powerIndex: idx,
      cost,
      cout: cost,
      max,
      isGlobalCharge: Number(itemSource?.system?.charges?.max ?? itemSource?.system?.max_charges ?? 0) > 0,
      onUse,
      onuse: onUse,
      on_use: onUse,
      objetMagicOnUse: power?.objetMagicOnUse || power?.fallbackOnUse || "",
      linkedSpell: power?.linkedSpell || null
    },
    flags: {
      add2e: {
        memorizedCount: current,
        originalOnUse: onUse,
        sourceType: "objet_magique",
        sourceItemId: itemSource.id,
        sourceItemName: itemSource.name,
        powerIndex: idx
      }
    }
  };

  const sort = new Item(fakeData, { parent: actor });
  sort.getFlag = (scope, key) => {
    if (scope !== "add2e") return null;
    if (key === "memorizedCount") return cost <= 0 ? 1 : add2eObjectPowerCurrentCharges(itemSource, power, idx);
    if (key === "originalOnUse") return onUse;
    return fakeData.flags?.add2e?.[key] ?? null;
  };
  return sort;
}

export async function add2eExecuteObjectMagicPower(actor, itemSource, power, idx, sheet = null) {
  if (!actor || !itemSource || !power) {
    ui.notifications.error("Pouvoir d'objet magique introuvable.");
    return false;
  }

  const powerName = String(power?.name ?? power?.nom ?? itemSource.name ?? "Pouvoir").trim() || "Pouvoir";
  const onUse = add2eObjectPowerOnUsePath(power);
  const cost = add2eObjectPowerCost(power);
  const current = add2eObjectPowerCurrentCharges(itemSource, power, idx);

  if (!onUse) {
    ui.notifications.warn(`${powerName} n'a pas de script utilisable.`);
    return false;
  }

  if (cost > 0 && current < cost) {
    ui.notifications.warn(`${itemSource.name} n'a pas assez de charges pour utiliser ${powerName}.`);
    return false;
  }

  const sort = add2eBuildVirtualObjectPowerSort(actor, itemSource, power, idx);

  try {
    let result = true;
    const url = onUse.includes("?") ? `${onUse}&cb=${Date.now()}` : `${onUse}?cb=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const code = await response.text();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const scope = { actor, item: itemSource, sourceItem: itemSource, sort, power, pouvoir: power, powerIndex: idx, isObjectPower: true };
    const args = [{ actor, item: itemSource, sourceItem: itemSource, sort, power, pouvoir: power, powerIndex: idx, scope }];

    const runner = new AsyncFunction(
      "actor", "item", "sourceItem", "sort", "power", "pouvoir", "powerIndex", "scope", "args",
      "game", "ui", "ChatMessage", "Roll", "foundry", "canvas",
      code
    );

    result = await runner(actor, itemSource, itemSource, sort, power, power, idx, scope, args, game, ui, ChatMessage, Roll, foundry, canvas);

    if (result !== false && cost > 0) await add2eObjectPowerSetCharges(itemSource, power, idx, current - cost);

    if (result !== false) {
      sheet?._add2eRememberActiveTab?.();
      sheet?.render?.(false);
      return true;
    }

    return false;
  } catch (err) {
    console.error("[ADD2E][OBJET_MAGIQUE][POUVOIR_ERREUR]", { actor: actor.name, item: itemSource.name, power: powerName, onUse, err });
    ui.notifications.error(`Erreur pendant l'utilisation de ${powerName} : ${err.message}`);
    return false;
  }
}

export function add2eMagicItemEquippedOrUsable(item) {
  const sys = item?.system ?? {};
  return sys.equipee === true || sys.equipped === true;
}

export function add2eMagicObjectRawPowers(item) {
  if (!add2eMagicItemEquippedOrUsable(item)) return [];
  const sys = item?.system ?? {};
  return sys.pouvoirs
    ?? sys.powers
    ?? sys.pouvoirsMagiques
    ?? sys.magicalPowers
    ?? sys.sorts
    ?? sys.spells
    ?? [];
}

export function add2eMagicObjectPowerArray(item) {
  const raw = add2eMagicObjectRawPowers(item);
  if (Array.isArray(raw)) return raw.filter(p => p && typeof p === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(p => p && typeof p === "object");
  return [];
}

export function add2eMagicObjectActivePowerEntries(item) {
  return add2eMagicObjectPowerArray(item)
    .map((power, index) => ({ power, index }))
    .filter(entry => add2eObjectPowerOnUsePath(entry.power));
}

export function add2eMagicReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eMagicReadNumber(value.value, value.current, value.actuel, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

export function add2eMagicObjectChargeInfo(item, powers = null) {
  const sys = item?.system ?? {};
  const list = powers ?? add2eMagicObjectPowerArray(item);

  const maxCandidates = [
    sys.max_charges,
    sys.maxCharges,
    sys.charges_max,
    sys.chargesMax,
    sys.max,
    sys.charges?.max,
    sys.charges?.maximum,
    ...list.map(p => p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max)
  ];

  let max = add2eMagicReadNumber(...maxCandidates);
  if (!Number.isFinite(max) || max < 0) max = 0;

  const currentCandidates = [
    item?.getFlag?.("add2e", "global_charges"),
    item?.getFlag?.("add2e", "charges"),
    sys.charges,
    sys.current_charges,
    sys.currentCharges,
    sys.charges_actuelles,
    sys.chargesRestantes,
    sys.remainingCharges,
    sys.charges?.value,
    sys.charges?.current,
    sys.charges?.actuel,
    sys.charges?.remaining
  ];

  let current = add2eMagicReadNumber(...currentCandidates);
  if (!Number.isFinite(current)) current = max;
  if (max > 0) current = Math.max(0, Math.min(current, max));

  return { current, max, label: max > 0 ? `${current}/${max}` : "—" };
}

export function add2eMagicLooksMagical(item) {
  const sys = item?.system ?? {};
  const tags = add2eObjectMagicToArray(sys.tags ?? sys.effectTags ?? sys.effets ?? sys.effects).map(add2eObjectMagicNormalizeTag);
  const name = String(item?.name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return tags.some(t => t.includes("magique") || t.includes("magic"))
    || name.includes("magique")
    || sys.magique === true
    || sys.magic === true;
}

export function add2eUiCollectObjectMagicGroups(actor) {
  const groups = [];

  const itemsSources = actor?.items?.filter?.(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(type)) return false;
    if (!add2eMagicItemEquippedOrUsable(item)) return false;
    return add2eMagicObjectActivePowerEntries(item).length > 0;
  }) ?? [];

  for (const itemSource of itemsSources) {
    const powerEntries = add2eMagicObjectActivePowerEntries(itemSource);
    if (!powerEntries.length) continue;

    const activePowers = powerEntries.map(e => e.power);
    const chargeInfo = add2eMagicObjectChargeInfo(itemSource, activePowers);
    const maxGlobal = Number(chargeInfo.max) || 0;
    const isGlobal = maxGlobal > 0;

    const powers = [];
    for (const { power: p, index: idx } of powerEntries) {
      const max = isGlobal ? maxGlobal : (Number(p.max ?? p.maxCharges ?? p.chargesMax ?? p.charges_max ?? itemSource.system?.charges ?? 1) || 1);
      const charges = isGlobal
        ? chargeInfo.current
        : (itemSource.getFlag?.("add2e", `charges_${idx}`) ?? p.charges ?? itemSource.system?.charges ?? max);

      powers.push({
        id: add2eMagicPowerGeneratedId(itemSource, idx),
        name: String(p.name || p.nom || itemSource.name || "Pouvoir").trim() || "Pouvoir",
        img: p.img || itemSource.img || "icons/svg/aura.svg",
        sourceItemId: itemSource.id,
        sourceName: itemSource.name || "Objet magique",
        sourceImg: itemSource.img || "icons/svg/item-bag.svg",
        niveau: Number(p.niveau ?? p.level ?? 1) || 1,
        description: p.description || p.desc || "",
        charges: Number(charges) || 0,
        max,
        cost: Number(p.cout ?? p.cost ?? 0) || 0
      });
    }

    groups.push({
      itemId: itemSource.id,
      itemName: itemSource.name || "Objet magique",
      itemImg: itemSource.img || "icons/svg/item-bag.svg",
      charges: chargeInfo.current,
      max: chargeInfo.max,
      chargeLabel: chargeInfo.label,
      powers: powers.sort((a, b) => String(a.name).localeCompare(String(b.name), "fr"))
    });
  }

  return groups.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName), "fr"));
}

export function add2eUiCollectObjectMagicPowers(actor) {
  return add2eUiCollectObjectMagicGroups(actor).flatMap(group => group.powers);
}

export function add2eUiBuildObjectMagicSection(actor) {
  const groups = add2eUiCollectObjectMagicGroups(actor);

  const content = groups.length ? groups.map(group => {
    const rows = group.powers.length ? group.powers.map(power => `
      <tr class="add2e-object-magic-power-row" data-sort-id="${add2eObjectMagicEscapeHtml(power.id)}">
        <td style="width:46px;text-align:center;">
          <img class="sort-cast-img add2e-object-magic-cast" data-sort-id="${add2eObjectMagicEscapeHtml(power.id)}" src="${add2eObjectMagicEscapeHtml(power.img)}" title="Utiliser ${add2eObjectMagicEscapeHtml(power.name)}" style="width:32px;height:32px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;cursor:pointer;">
        </td>
        <td><strong>${add2eObjectMagicEscapeHtml(power.name)}</strong><br><small>Niveau ${Number(power.niveau) || 1}${power.cost ? ` — coût ${Number(power.cost)}` : ""}</small></td>
        <td class="a2e-small">${power.description || ""}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="3" class="a2e-muted" style="text-align:center;padding:0.6em;">Aucun pouvoir détaillé.</td>
      </tr>
    `;

    return `
      <div class="add2e-object-magic-group" data-item-id="${add2eObjectMagicEscapeHtml(group.itemId)}" style="border:1px solid #d9bf73;border-radius:9px;margin-bottom:8px;background:#fffdf6;overflow:hidden;">
        <div class="add2e-object-magic-header" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#ead99d;border-bottom:1px solid #dac276;color:#3d2b0a;font-weight:900;">
          <img src="${add2eObjectMagicEscapeHtml(group.itemImg)}" alt="" style="width:28px;height:28px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;">
          <span style="flex:1;">${add2eObjectMagicEscapeHtml(group.itemName)}</span>
          <span title="Charges restantes / charges maximum" style="padding:2px 8px;border:1px solid #9f7a24;border-radius:999px;background:#fffaf0;white-space:nowrap;">Charges ${add2eObjectMagicEscapeHtml(group.chargeLabel)}</span>
        </div>
        <table class="a2e-table add2e-object-magic-table" style="margin:0;">
          <thead>
            <tr>
              <th style="width:46px;">Utiliser</th>
              <th>Pouvoir</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("") : `
    <div class="a2e-muted" style="text-align:center;padding:0.8em;border:1px solid #dac276;border-radius:9px;background:#fffdf6;">
      Aucun objet magique doté d’un pouvoir utilisable.
    </div>
  `;

  return `
    <section class="a2e-panel add2e-object-magic-panel">
      <h2><i class="fas fa-wand-sparkles"></i> Objets magiques</h2>
      <div class="a2e-panel-body">${content}</div>
    </section>
  `;
}

export function add2eUiInjectObjectMagicSection(spellContainer, actor) {
  if (!spellContainer || !actor) return;
  if (spellContainer.matches?.(".item, a.item, .sheet-tabs, .tabs, nav")) return;

  spellContainer.querySelectorAll(".add2e-object-magic-panel").forEach(el => el.remove());

  const html = add2eUiBuildObjectMagicSection(actor);
  if (!html) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const panel = wrapper.firstElementChild;
  if (!panel) return;

  const summary = spellContainer.querySelector(".a2e-spellcasting-summary");
  const firstSpellPanel = Array.from(spellContainer.querySelectorAll(".a2e-panel"))
    .find(p => p.querySelector?.("table.sort-table"));

  if (summary) {
    spellContainer.insertBefore(panel, summary.nextElementSibling || firstSpellPanel || null);
  } else if (firstSpellPanel) {
    spellContainer.insertBefore(panel, firstSpellPanel);
  } else {
    spellContainer.insertBefore(panel, spellContainer.firstElementChild || null);
  }
}

globalThis.add2eObjectPowerOnUsePath = add2eObjectPowerOnUsePath;
globalThis.add2eObjectPowerCost = add2eObjectPowerCost;
globalThis.add2eObjectPowerMaxCharges = add2eObjectPowerMaxCharges;
globalThis.add2eObjectPowerCurrentCharges = add2eObjectPowerCurrentCharges;
globalThis.add2eObjectPowerSetCharges = add2eObjectPowerSetCharges;
globalThis.add2eBuildVirtualObjectPowerSort = add2eBuildVirtualObjectPowerSort;
globalThis.add2eExecuteObjectMagicPower = add2eExecuteObjectMagicPower;
globalThis.add2eMagicItemEquippedOrUsable = add2eMagicItemEquippedOrUsable;
globalThis.add2eMagicObjectRawPowers = add2eMagicObjectRawPowers;
globalThis.add2eMagicObjectPowerArray = add2eMagicObjectPowerArray;
globalThis.add2eMagicObjectActivePowerEntries = add2eMagicObjectActivePowerEntries;
globalThis.add2eMagicReadNumber = add2eMagicReadNumber;
globalThis.add2eMagicObjectChargeInfo = add2eMagicObjectChargeInfo;
globalThis.add2eMagicLooksMagical = add2eMagicLooksMagical;
globalThis.add2eMagicPowerGeneratedId = add2eMagicPowerGeneratedId;
globalThis.add2eUiCollectObjectMagicGroups = add2eUiCollectObjectMagicGroups;
globalThis.add2eUiCollectObjectMagicPowers = add2eUiCollectObjectMagicPowers;
globalThis.add2eUiBuildObjectMagicSection = add2eUiBuildObjectMagicSection;
globalThis.add2eUiInjectObjectMagicSection = add2eUiInjectObjectMagicSection;