// ADD2E — Pouvoirs d'objets magiques / sorts liés et sélecteur de compendium.

import {
  INTERNAL_ON_USE, SPELL_PACK_ID, clone, esc, executionResult, getSpellIndexPromise,
  hasValue, merge, norm, number, powerArray, powerName, setSpellIndexPromise
} from "./runtime.mjs";
import { actorToken, powerContext } from "./targeting.mjs";

export function onUsePath(document) {
  return String(
    document?.onUse ?? document?.onuse ?? document?.on_use ?? document?.script ?? document?.macro
    ?? document?.system?.onUse ?? document?.system?.onuse ?? document?.system?.on_use ?? document?.system?.script
    ?? ""
  ).trim();
}

export async function executeScript(actor, item, power, index, path, linkedSpell = null) {
  if (!path || path === INTERNAL_ON_USE) return null;
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const code = await response.text();
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const source = linkedSpell ?? item;
  const token = actorToken(actor);
  const scope = {
    actor,
    item: source,
    sourceItem: item,
    objectItem: item,
    sort: linkedSpell,
    linkedSpell,
    token,
    power,
    pouvoir: power,
    powerIndex: index,
    isObjectPower: true
  };
  const args = [{ ...scope, scope }];
  const runner = new AsyncFunction(
    "actor", "item", "sourceItem", "objectItem", "sort", "linkedSpell", "token", "power", "pouvoir", "powerIndex", "scope", "args",
    "game", "ui", "ChatMessage", "Roll", "foundry", "canvas",
    code
  );
  const result = await runner(actor, source, item, item, linkedSpell, linkedSpell, token, power, power, index,
    scope, args, game, ui, ChatMessage, Roll, foundry, canvas);
  return executionResult(result === false ? "failed" : "success", { handled: "linked-script", path, ok: result !== false });
}

const spellLevel = spell => Math.max(1, Number(spell?.system?.niveau ?? spell?.system?.level ?? spell?.niveau ?? spell?.level ?? 1) || 1);

function packIndexEntries(index) {
  if (!index) return [];
  if (Array.isArray(index.contents)) return index.contents;
  if (typeof index.values === "function") return [...index.values()];
  try { return [...index]; } catch (_error) { return []; }
}

export async function spellIndex({ force = false } = {}) {
  if (force) setSpellIndexPromise(null);
  if (getSpellIndexPromise()) return getSpellIndexPromise();
  return setSpellIndexPromise((async () => {
    const pack = game.packs?.get?.(SPELL_PACK_ID);
    if (!pack || String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") return [];
    let index;
    try { index = await pack.getIndex({ fields: ["name", "type", "img", "system.niveau", "system.level"] }); }
    catch (_error) {
      try { index = await pack.getIndex(); } catch (_indexError) { return []; }
    }
    return packIndexEntries(index)
      .filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")
      .map(entry => ({
        uuid: `Compendium.${SPELL_PACK_ID}.${entry._id}`,
        name: String(entry.name ?? "Sort"),
        img: entry.img ?? "icons/svg/book.svg",
        level: spellLevel(entry),
        source: String(pack.title ?? pack.metadata?.label ?? SPELL_PACK_ID)
      }))
      .sort((left, right) => Number(left.level) - Number(right.level) || left.name.localeCompare(right.name, "fr"));
  })());
}

export function spellOptions(entries, selectedUuid = "", selectedName = "") {
  const selectedUuidText = String(selectedUuid ?? "").trim();
  const wantedName = norm(selectedName);
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }
  const html = [...groups.entries()].map(([source, spells]) => {
    const options = spells.map(entry => {
      const selected = entry.uuid === selectedUuidText || (!selectedUuidText && wantedName && norm(entry.name) === wantedName);
      return `<option value="${esc(entry.uuid)}" data-spell-name="${esc(entry.name)}"${selected ? " selected" : ""}>Niv. ${Number(entry.level) || 1} — ${esc(entry.name)}</option>`;
    }).join("");
    return `<optgroup label="${esc(source)}">${options}</optgroup>`;
  }).join("");
  return `<option value="">— Choisir un sort du compendium —</option>${html}`;
}

export async function chooseSpell(currentUuid = "", currentName = "") {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible.");
  const entries = await spellIndex();
  if (!entries.length) {
    ui.notifications.warn(`Le compendium ${SPELL_PACK_ID} ne contient aucun Item de type sort disponible.`);
    return null;
  }
  return DialogV2.wait({
    window: { title: "Choisir le sort équivalent" },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:620px;padding:10px;display:grid;gap:8px;"><p style="margin:0;">Choisissez dans le compendium ADD2E le sort que l'objet pourra lancer.</p><select name="spellUuid" size="14" style="width:100%;">${spellOptions(entries, currentUuid, currentName)}</select></div>`,
    buttons: [
      {
        action: "select",
        label: "Utiliser ce sort",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          const select = root?.querySelector?.('[name="spellUuid"]');
          const uuid = String(select?.value ?? "").trim();
          const name = String(select?.selectedOptions?.[0]?.dataset?.spellName ?? "").trim();
          return uuid ? { uuid, name } : null;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}

export async function resolveSpell(reference = {}) {
  const uuid = String(reference.spellUuid ?? reference.uuid ?? reference.sourceUuid ?? reference.sourceId ?? "").trim();
  const allowedPrefix = `Compendium.${SPELL_PACK_ID}.`;
  if (uuid) {
    if (!uuid.startsWith(allowedPrefix) || typeof fromUuid !== "function") return null;
    try {
      const document = await fromUuid(uuid);
      return document?.documentName === "Item" && String(document.type ?? "").toLowerCase() === "sort" ? document : null;
    } catch (_error) { return null; }
  }
  const name = norm(reference.spellName ?? reference.name ?? reference.nom ?? "");
  if (!name) return null;
  const entry = (await spellIndex()).find(candidate => norm(candidate.name) === name);
  if (!entry || typeof fromUuid !== "function") return null;
  try {
    const document = await fromUuid(entry.uuid);
    return document?.documentName === "Item" && String(document.type ?? "").toLowerCase() === "sort" ? document : null;
  } catch (_error) { return null; }
}

export function linkedSpellEffect(power) {
  return (power?.effects ?? []).find(effect => norm(effect?.type ?? effect?.kind) === "linked_spell") ?? null;
}

function cleanSpellSource(spell) {
  const data = clone(spell?.toObject?.() ?? spell ?? {});
  delete data._id;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  delete data._stats;
  for (const effect of data.effects ?? []) {
    delete effect._id;
    delete effect.folder;
    delete effect.sort;
    delete effect._stats;
  }
  return data;
}

const linkedSpellCost = (power, effect) => {
  const value = number(effect?.chargeCost, power?.parameters?.chargeCost, power?.chargeCost, power?.cost, power?.cout);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};

function buildVirtualSpell(actor, item, power, index, effect, spell) {
  let data = cleanSpellSource(spell);
  const overrides = effect?.overrides && typeof effect.overrides === "object" && !Array.isArray(effect.overrides) ? clone(effect.overrides) : {};
  const topLevelOverride = ["system", "flags", "name", "img", "effects", "type"]
    .some(key => Object.prototype.hasOwnProperty.call(overrides, key));
  if (Object.keys(overrides).length) data = topLevelOverride ? merge(data, overrides) : { ...data, system: merge(data.system ?? {}, overrides) };
  data._id = foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 18);
  data.type = "sort";
  data.name = String(data.name ?? spell.name ?? effect.spellName ?? powerName(power, item));
  data.img = data.img || spell.img || item.img || "icons/svg/book.svg";
  data.system ??= {};
  data.flags ??= {};
  data.flags.add2e ??= {};
  const casterLevel = number(effect?.casterLevel, power?.parameters?.casterLevel);
  const activationTime = effect?.activationTime ?? power?.parameters?.activationTime;
  const cost = linkedSpellCost(power, effect);
  const max = Math.max(1, Number(item.system?.charges?.max ?? item.system?.max_charges ?? item.system?.maxCharges ?? item.system?.chargesMax ?? 1) || 1);
  Object.assign(data.system, {
    isPower: true,
    isObjectPower: true,
    sourceItemId: item.id,
    sourceWeaponId: item.id,
    sourceItemName: item.name,
    powerIndex: index,
    cost,
    cout: cost,
    max,
    linkedSpellUuid: spell.uuid ?? effect.spellUuid ?? ""
  });
  if (Number.isFinite(casterLevel) && casterLevel > 0) {
    data.system.casterLevel = casterLevel;
    data.system.niveauLanceur = casterLevel;
    data.system.niveau_lanceur = casterLevel;
    data.flags.add2e.casterLevel = casterLevel;
  }
  if (hasValue(activationTime)) data.system.temps_incantation = activationTime;
  Object.assign(data.flags.add2e, {
    sourceType: "objet_magique",
    sourceItemId: item.id,
    sourceItemName: item.name,
    magicPowerId: power.catalogueId ?? power.id ?? "",
    powerIndex: index,
    linkedSpellUuid: spell.uuid ?? effect.spellUuid ?? ""
  });
  return new CONFIG.Item.documentClass(data, { parent: actor });
}

async function persistSpellChoice(item, index, selection) {
  if (!item || !selection?.uuid || !Number.isInteger(Number(index))) return false;
  const powers = powerArray(item).map(clone);
  const stored = powers[Number(index)];
  if (!stored) return false;
  stored.parameters ??= {};
  stored.parameters.spellUuid = selection.uuid;
  stored.parameters.spellName = selection.name;
  if (Array.isArray(stored.effects)) {
    stored.effects = stored.effects.map(effect => norm(effect?.type ?? effect?.kind) === "linked_spell"
      ? { ...effect, spellUuid: selection.uuid, spellName: selection.name } : effect);
  }
  await item.update({ "system.pouvoirs": powers }, {
    add2eMagicPowerEffectsAdapter: true,
    add2eMagicPowerExecution: true,
    render: false
  });
  return true;
}

export async function linkedSpellHandler(context) {
  const { actor, item, power, index, effect } = context;
  let reference = {
    spellUuid: effect?.spellUuid ?? power?.parameters?.spellUuid,
    spellName: effect?.spellName ?? power?.parameters?.spellName
  };
  let spell = await resolveSpell(reference);
  if (!spell) {
    const selection = await chooseSpell(reference.spellUuid, reference.spellName);
    if (!selection) return executionResult("cancelled", { handled: "linked-spell", chargesManaged: true, consumeCharges: false });
    reference = { spellUuid: selection.uuid, spellName: selection.name };
    spell = await resolveSpell(reference);
    if (!spell) throw new Error(`Le sort « ${selection.name || selection.uuid} » est introuvable.`);
    effect.spellUuid = selection.uuid;
    effect.spellName = selection.name;
    power.parameters ??= {};
    power.parameters.spellUuid = selection.uuid;
    power.parameters.spellName = selection.name;
    await persistSpellChoice(item, index, selection);
  }
  if (typeof globalThis.add2eCastSpell !== "function") throw new Error("Le moteur add2eCastSpell est indisponible.");
  const virtualSpell = buildVirtualSpell(actor, item, power, index, effect, spell);
  const launched = await globalThis.add2eCastSpell({ actor, sort: virtualSpell, mode: "power", sourceItem: item });
  return executionResult(launched === true ? "success" : "failed", {
    ok: launched === true,
    handled: "linked-spell",
    chargesManaged: true,
    consumeCharges: false,
    spellUuid: spell.uuid,
    spellName: spell.name
  });
}

export async function linkedPower(actor, item, power, index) {
  const linkedEffect = linkedSpellEffect(power);
  if (linkedEffect) return linkedSpellHandler(powerContext(actor, item, power, index, linkedEffect));
  const direct = onUsePath(power) || onUsePath(power.linkedSpell);
  if (direct) return executeScript(actor, item, power, index, direct);
  const linked = power.linkedSpell;
  if (!linked) return null;
  const spell = await resolveSpell(linked);
  const path = onUsePath(spell);
  return path ? executeScript(actor, item, power, index, path, spell) : null;
}

function rootOf(app, html) {
  return html instanceof HTMLElement ? html
    : html?.[0] instanceof HTMLElement ? html[0]
      : app?.element instanceof HTMLElement ? app.element
        : app?.element?.[0] instanceof HTMLElement ? app.element[0] : null;
}

export async function enhanceSpellParameterDialog(app, html) {
  const root = rootOf(app, html);
  const form = root?.matches?.(".add2e-magic-power-parameter-form") ? root : root?.querySelector?.(".add2e-magic-power-parameter-form");
  if (!form || form.dataset.add2eSpellSelectorBound === "1") return;
  const input = form.querySelector('input[name="spellUuid"]');
  if (!input) return;
  form.dataset.add2eSpellSelectorBound = "1";
  const entries = await spellIndex();
  const spellNameInput = form.querySelector('[name="spellName"]');
  const select = document.createElement("select");
  select.name = "spellUuid";
  select.dataset.add2eParameterType = "uuid";
  select.style.width = "100%";
  select.innerHTML = spellOptions(entries, input.value, spellNameInput?.value ?? "");
  input.replaceWith(select);
  const syncName = () => {
    const name = String(select.selectedOptions?.[0]?.dataset?.spellName ?? "").trim();
    if (spellNameInput && name) spellNameInput.value = name;
  };
  select.addEventListener("change", syncName);
  if (select.value) syncName();
}
