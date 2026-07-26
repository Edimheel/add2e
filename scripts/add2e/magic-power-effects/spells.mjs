// ADD2E — Pouvoirs d'objets magiques / sorts liés et sélecteur de compendium.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  INTERNAL_ON_USE, SPELL_PACK_ID, clone, esc, executionResult, getSpellIndexPromise,
  hasValue, list, merge, norm, number, powerArray, powerName, setSpellIndexPromise
} from "./runtime.mjs";
import { actorToken, powerContext } from "./targeting.mjs";

const LINKED_SPELL_RESOLUTION_VERSION = "2026-07-26-linked-spell-auto-resolution-v2";
const SPELL_REFERENCE_TEMPLATE = /^@[A-Za-z0-9_]+$/;

export function onUsePath(document) {
  return String(
    document?.onUse ?? document?.onuse ?? document?.on_use ?? document?.script ?? document?.macro
    ?? document?.system?.onUse ?? document?.system?.onuse ?? document?.system?.on_use ?? document?.system?.script
    ?? ""
  ).trim();
}

function referenceText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text || SPELL_REFERENCE_TEMPLATE.test(text)) continue;
    return text;
  }
  return "";
}

function spellNameKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularToken(token) {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("ses")) return token.slice(0, -1);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function canonicalSpellName(value) {
  return spellNameKey(value).split(" ").filter(Boolean).map(singularToken).join(" ");
}

function scriptSpellKey(value) {
  const path = referenceText(value);
  if (!path) return "";
  const filename = path.split(/[/?#]/g).filter(Boolean).pop() ?? "";
  return canonicalSpellName(
    filename
      .replace(/\.(?:m?js)$/i, "")
      .replace(/^(?:magicien|illusionniste|clerc|druide|pretre|prêtre|paladin|ranger)[-_]+/i, "")
  );
}

function spellLists(value) {
  return [...new Set(list(value).map(entry => spellNameKey(entry)).filter(Boolean))];
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
    try {
      index = await pack.getIndex({
        fields: [
          "name", "type", "img", "system.niveau", "system.level",
          "system.onUse", "system.onuse", "system.on_use", "system.script",
          "system.spellLists", "system.lists", "system.liste", "system.classe"
        ]
      });
    } catch (_error) {
      try { index = await pack.getIndex(); } catch (_indexError) { return []; }
    }
    return packIndexEntries(index)
      .filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")
      .map(entry => ({
        uuid: `Compendium.${SPELL_PACK_ID}.${entry._id}`,
        name: String(entry.name ?? "Sort"),
        nameKey: spellNameKey(entry.name),
        canonicalName: canonicalSpellName(entry.name),
        img: entry.img ?? "icons/svg/book.svg",
        level: spellLevel(entry),
        onUse: onUsePath(entry),
        scriptKey: scriptSpellKey(onUsePath(entry)),
        lists: spellLists(
          entry?.system?.spellLists
          ?? entry?.system?.lists
          ?? entry?.system?.liste
          ?? entry?.system?.classe
        ),
        source: String(pack.title ?? pack.metadata?.label ?? SPELL_PACK_ID)
      }))
      .sort((left, right) => Number(left.level) - Number(right.level) || left.name.localeCompare(right.name, "fr"));
  })());
}

function matchingSpellEntries(entries, reference = {}) {
  const wantedName = referenceText(reference.spellName, reference.name, reference.nom);
  const wantedNameKey = spellNameKey(wantedName);
  const wantedCanonical = canonicalSpellName(wantedName);
  const wantedScript = scriptSpellKey(referenceText(reference.onUse, reference.onuse, reference.on_use, reference.script));
  const wantedLevel = number(reference.spellLevel, reference.level, reference.niveau);
  const wantedLists = spellLists(reference.spellLists ?? reference.lists ?? reference.liste ?? reference.classe);

  let candidates = entries;
  if (wantedNameKey) {
    const exact = candidates.filter(entry => entry.nameKey === wantedNameKey);
    if (exact.length) candidates = exact;
    else {
      const canonical = candidates.filter(entry => entry.canonicalName === wantedCanonical);
      if (canonical.length) candidates = canonical;
      else {
        const byScriptName = candidates.filter(entry => entry.scriptKey && entry.scriptKey === wantedCanonical);
        candidates = byScriptName;
      }
    }
  } else if (wantedScript) {
    candidates = candidates.filter(entry => entry.scriptKey === wantedScript);
  } else {
    return [];
  }

  if (candidates.length > 1 && Number.isFinite(wantedLevel)) {
    const sameLevel = candidates.filter(entry => Number(entry.level) === Number(wantedLevel));
    if (sameLevel.length) candidates = sameLevel;
  }
  if (candidates.length > 1 && wantedScript) {
    const sameScript = candidates.filter(entry => entry.scriptKey === wantedScript);
    if (sameScript.length) candidates = sameScript;
  }
  if (candidates.length > 1 && wantedLists.length) {
    const sameList = candidates.filter(entry => wantedLists.some(value => entry.lists.includes(value)));
    if (sameList.length) candidates = sameList;
  }
  if (candidates.length > 1) {
    const first = candidates[0];
    const equivalent = candidates.every(entry =>
      entry.canonicalName === first.canonicalName
      && Number(entry.level) === Number(first.level)
    );
    if (equivalent) {
      candidates = [...candidates].sort((left, right) => {
        const leftExecutable = left.onUse ? 0 : 1;
        const rightExecutable = right.onUse ? 0 : 1;
        if (leftExecutable !== rightExecutable) return leftExecutable - rightExecutable;
        const leftMage = left.lists.includes("magicien") ? 0 : 1;
        const rightMage = right.lists.includes("magicien") ? 0 : 1;
        if (leftMage !== rightMage) return leftMage - rightMage;
        return String(left.uuid).localeCompare(String(right.uuid), "fr");
      }).slice(0, 1);
    }
  }
  return candidates;
}

export function spellOptions(entries, selectedUuid = "", selectedName = "") {
  const selectedUuidText = referenceText(selectedUuid);
  const wantedName = canonicalSpellName(selectedName);
  const matching = !selectedUuidText && wantedName
    ? matchingSpellEntries(entries, { spellName: selectedName })
    : [];
  const selectedByName = matching.length === 1 ? matching[0].uuid : "";
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }
  const html = [...groups.entries()].map(([source, spells]) => {
    const options = spells.map(entry => {
      const selected = entry.uuid === selectedUuidText || (!selectedUuidText && entry.uuid === selectedByName);
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
    content: `<div class="add2e-dialog" style="min-width:620px;padding:10px;display:grid;gap:8px;"><p style="margin:0;">Associez le pouvoir à un sort du compendium ADD2E. Ce choix est enregistré dans l'objet.</p><select name="spellUuid" size="14" style="width:100%;">${spellOptions(entries, currentUuid, currentName)}</select></div>`,
    buttons: [
      {
        action: "select",
        label: "Associer ce sort",
        icon: "fa-solid fa-link",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          const select = root?.querySelector?.('[name="spellUuid"]');
          const uuid = referenceText(select?.value);
          const name = referenceText(select?.selectedOptions?.[0]?.dataset?.spellName);
          const entry = entries.find(candidate => candidate.uuid === uuid) ?? null;
          return uuid ? {
            uuid,
            name,
            level: entry?.level ?? null,
            onUse: entry?.onUse ?? "",
            lists: entry?.lists ?? []
          } : null;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}

async function spellDocumentFromUuid(uuid) {
  const value = referenceText(uuid);
  const allowedPrefix = `Compendium.${SPELL_PACK_ID}.`;
  if (!value || !value.startsWith(allowedPrefix) || typeof fromUuid !== "function") return null;
  try {
    const document = await fromUuid(value);
    return document?.documentName === "Item" && String(document.type ?? "").toLowerCase() === "sort" ? document : null;
  } catch (_error) {
    return null;
  }
}

export async function resolveSpellReference(reference = {}, { refresh = true } = {}) {
  const uuid = referenceText(reference.spellUuid, reference.uuid, reference.sourceUuid, reference.sourceId);
  if (uuid) {
    const spell = await spellDocumentFromUuid(uuid);
    if (spell) return { spell, entry: null, matchedBy: "uuid", ambiguous: false };
  }

  const entries = await spellIndex();
  let matches = matchingSpellEntries(entries, reference);
  if (!matches.length && refresh) {
    matches = matchingSpellEntries(await spellIndex({ force: true }), reference);
  }
  if (matches.length !== 1) {
    return { spell: null, entry: null, matchedBy: "name", ambiguous: matches.length > 1, matches };
  }
  const entry = matches[0];
  const spell = await spellDocumentFromUuid(entry.uuid);
  return { spell, entry, matchedBy: "name", ambiguous: false, matches };
}

export async function resolveSpell(reference = {}) {
  return (await resolveSpellReference(reference))?.spell ?? null;
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
  if (Number.isFinite(Number(selection.level))) stored.parameters.spellLevel = Number(selection.level);
  if (selection.onUse) stored.parameters.spellOnUse = selection.onUse;
  if (Array.isArray(selection.lists) && selection.lists.length) stored.parameters.spellLists = selection.lists;
  if (Array.isArray(stored.effects)) {
    stored.effects = stored.effects.map(effect => norm(effect?.type ?? effect?.kind) === "linked_spell"
      ? {
          ...effect,
          spellUuid: selection.uuid,
          spellName: selection.name,
          ...(Number.isFinite(Number(selection.level)) ? { spellLevel: Number(selection.level) } : {}),
          ...(selection.onUse ? { spellOnUse: selection.onUse } : {}),
          ...(Array.isArray(selection.lists) && selection.lists.length ? { spellLists: selection.lists } : {})
        }
      : effect);
  }
  if (stored.linkedSpell && typeof stored.linkedSpell === "object" && !Array.isArray(stored.linkedSpell)) {
    stored.linkedSpell = {
      ...stored.linkedSpell,
      uuid: selection.uuid,
      sourceUuid: selection.uuid,
      spellUuid: selection.uuid,
      name: selection.name
    };
  }
  await item.update({
    "system.pouvoirs": powers,
    "flags.add2e.linkedSpellResolutionVersion": LINKED_SPELL_RESOLUTION_VERSION
  }, {
    add2eMagicPowerEffectsAdapter: true,
    add2eMagicPowerExecution: true,
    add2eLinkedSpellMigration: true,
    render: false
  });
  return true;
}

function linkedSpellReference(power, effect) {
  const parameters = power?.parameters ?? {};
  const linked = power?.linkedSpell ?? {};
  return {
    spellUuid: referenceText(
      effect?.spellUuid, effect?.uuid, effect?.sourceUuid, effect?.sourceId,
      parameters?.spellUuid, parameters?.uuid, parameters?.sourceUuid, parameters?.sourceId,
      power?.spellUuid, power?.sourceUuid, linked?.spellUuid, linked?.uuid, linked?.sourceUuid, linked?.sourceId
    ),
    spellName: referenceText(
      effect?.spellName, effect?.name, effect?.nom,
      parameters?.spellName, parameters?.name, parameters?.nom,
      power?.spellName, linked?.spellName, linked?.name, linked?.nom
    ),
    spellLevel: number(
      effect?.spellLevel, effect?.level, effect?.niveau,
      parameters?.spellLevel, parameters?.level, parameters?.niveau,
      power?.spellLevel, linked?.spellLevel, linked?.level, linked?.niveau
    ),
    onUse: referenceText(
      effect?.spellOnUse, effect?.onUse, effect?.onuse, effect?.on_use,
      parameters?.spellOnUse, parameters?.onUse, parameters?.onuse, parameters?.on_use,
      linked?.onUse, linked?.onuse, linked?.on_use
    ),
    spellLists: effect?.spellLists ?? parameters?.spellLists ?? linked?.spellLists ?? linked?.lists ?? linked?.liste
  };
}

function allowsRuntimeSpellSelection(power, effect) {
  const parameters = power?.parameters ?? {};
  return effect?.allowSpellSelection === true
    || effect?.genericSpellSelection === true
    || parameters?.allowSpellSelection === true
    || parameters?.genericSpellSelection === true
    || power?.allowSpellSelection === true
    || power?.genericSpellSelection === true;
}

export async function linkedSpellHandler(context) {
  const { actor, item, power, index, effect } = context;
  const reference = linkedSpellReference(power, effect);
  let resolution = await resolveSpellReference(reference);
  let spell = resolution.spell;
  let selection = spell ? {
    uuid: spell.uuid,
    name: spell.name,
    level: spellLevel(spell),
    onUse: onUsePath(spell),
    lists: spellLists(spell?.system?.spellLists ?? spell?.system?.lists ?? spell?.system?.liste ?? spell?.system?.classe)
  } : null;

  if (!spell && allowsRuntimeSpellSelection(power, effect)) {
    selection = await chooseSpell(reference.spellUuid, reference.spellName);
    if (!selection) return executionResult("cancelled", { handled: "linked-spell", chargesManaged: true, consumeCharges: false });
    resolution = await resolveSpellReference({ spellUuid: selection.uuid, spellName: selection.name });
    spell = resolution.spell;
  }

  if (!spell) {
    const label = reference.spellName || reference.spellUuid || powerName(power, item);
    if (resolution.ambiguous) {
      throw new Error(`Plusieurs sorts correspondent à « ${label} ». Ouvrez l'objet dans le générateur et associez explicitement le sort du compendium.`);
    }
    throw new Error(`Le sort configuré « ${label} » est introuvable dans ${SPELL_PACK_ID}. Le pouvoir doit être corrigé dans le générateur.`);
  }

  selection ??= {
    uuid: spell.uuid,
    name: spell.name,
    level: spellLevel(spell),
    onUse: onUsePath(spell),
    lists: spellLists(spell?.system?.spellLists ?? spell?.system?.lists ?? spell?.system?.liste ?? spell?.system?.classe)
  };

  const storedUuid = referenceText(reference.spellUuid);
  const storedName = referenceText(reference.spellName);
  if (storedUuid !== selection.uuid || canonicalSpellName(storedName) !== canonicalSpellName(selection.name)) {
    try {
      await persistSpellChoice(item, index, selection);
    } catch (error) {
      console.warn("[ADD2E][MAGIC_POWER_EFFECTS][LINKED_SPELL_PERSIST]", {
        item: item?.name,
        itemId: item?.id,
        power: powerName(power, item),
        spellUuid: selection.uuid,
        error
      });
    }
    effect.spellUuid = selection.uuid;
    effect.spellName = selection.name;
    power.parameters ??= {};
    power.parameters.spellUuid = selection.uuid;
    power.parameters.spellName = selection.name;
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
    const name = referenceText(select.selectedOptions?.[0]?.dataset?.spellName);
    if (spellNameInput && name) spellNameInput.value = name;
  };
  select.addEventListener("change", syncName);
  if (select.value) syncName();
}
