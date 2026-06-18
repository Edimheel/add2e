// scripts/add2e-attack/06-cast-spell.mjs
// ADD2E — Lancement de sorts, onUse, mémorisation, pouvoirs et composants.
// Version : 2026-06-18-cast-spell-single-consumables-setting-source-v1

import { formatSortChamp, add2eGetSortField, add2eGetSortOnUsePath, add2eGetSortComponentsText } from "./01-core-helpers.mjs";
import "./05-jb2a-vfx.mjs";

const style = () => CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
const norm = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function listKeys(sortDoc) {
  try {
    if (typeof globalThis.add2eGetSpellListsFromItem === "function") return globalThis.add2eGetSpellListsFromItem(sortDoc).map(norm).filter(Boolean);
  } catch (_e) {}
  const s = sortDoc?.system ?? {}, f = sortDoc?.flags?.add2e ?? {};
  const raw = [f.learnedSpellLists, f.knownSpellLists, f.grantedSpellLists, s.spellLists, s.liste, s.liste_sort, s.listeSort, s.classe, s.class].flatMap(v => Array.isArray(v) ? v : v ? [v] : []);
  return raw.flatMap(v => String(v ?? "").split(/[,;|\n]+/g)).map(norm).filter(Boolean);
}

function sourceKeys(sortDoc) {
  const f = sortDoc?.flags?.add2e ?? {};
  return [sortDoc?.uuid, sortDoc?._stats?.compendiumSource, sortDoc?.flags?.core?.sourceId, f.sourceUuid, f.sourceId, f.importKey, f.foundryId, sortDoc?.id, sortDoc?._id].map(v => String(v ?? "").trim()).filter(Boolean);
}

function resolveActorSpell(actorDoc, sortDoc) {
  if (!actorDoc?.items || !sortDoc) return sortDoc ?? null;
  if (sortDoc.system?.isPower) return sortDoc;
  if (sortDoc.parent?.id === actorDoc.id && actorDoc.items.get(sortDoc.id)) return sortDoc;
  for (const id of [sortDoc.id, sortDoc._id].map(v => String(v ?? "").trim()).filter(Boolean)) {
    const direct = actorDoc.items.get(id);
    if (direct) return direct;
  }
  const keys = new Set(sourceKeys(sortDoc));
  const importKey = String(sortDoc.flags?.add2e?.importKey ?? "").trim();
  const routedClass = norm(sortDoc.flags?.add2e?.routedClass ?? sortDoc.system?.classe ?? sortDoc.system?.class ?? "");
  const targetName = norm(sortDoc.name);
  const targetLevel = Number(sortDoc.system?.niveau ?? sortDoc.system?.level ?? 1) || 1;
  const targetLists = listKeys(sortDoc);
  const spells = Array.from(actorDoc.items ?? []).filter(i => String(i.type ?? "").toLowerCase() === "sort");
  let found = spells.find(i => sourceKeys(i).some(k => keys.has(k)));
  if (found) return found;
  found = spells.find(i => importKey && String(i.flags?.add2e?.importKey ?? "") === importKey);
  if (found) return found;
  found = spells.find(i => {
    if (norm(i.name) !== targetName) return false;
    if ((Number(i.system?.niveau ?? i.system?.level ?? 1) || 1) !== targetLevel) return false;
    const lists = listKeys(i);
    if (targetLists.length && !targetLists.some(k => lists.includes(k))) return false;
    if (routedClass && lists.length && !lists.includes(routedClass)) return false;
    return true;
  });
  if (found) return found;
  console.warn("[ADD2E][CAST_SPELL][RESOLVE_ACTOR_SPELL][FALLBACK_INPUT]", { actor: actorDoc.name, sort: sortDoc.name, sortId: sortDoc.id, importKey, routedClass, targetLevel, targetLists });
  return sortDoc;
}

function getCasterToken(actorDoc) { return canvas?.tokens?.controlled?.[0] ?? actorDoc?.getActiveTokens?.()?.[0] ?? null; }
function onUseManagesSpellComponents(scriptPath, sortDoc) {
  const explicit = sortDoc?.flags?.add2e?.componentManagement ?? sortDoc?.system?.componentManagement ?? sortDoc?.system?.gestionComposants;
  if (["onUse", "onuse", "script", "manual", "manuel"].includes(String(explicit ?? "").trim())) return true;
  const path = norm(scriptPath);
  return path.includes("benediction");
}
function renderApplication(app) {
  if (!app || typeof app.render !== "function") return;
  try { app.render({ force: true }); return; } catch (_e) {}
  try { app.render(true); return; } catch (_e) {}
  try { app.render(false); } catch (_e) {}
}
function actorSheetOpen(actorDoc) {
  if (!actorDoc?.id) return false;
  try {
    return Object.values(ui.windows ?? {}).some(app => {
      const doc = app?.actor ?? app?.document ?? app?.object ?? null;
      return doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
    });
  } catch (_e) { return false; }
}
function updateMemorizedBadges(sortDoc, value) {
  const textValue = String(Math.max(0, Number(value) || 0));
  try {
    for (const root of document.querySelectorAll(".add2e-character-v3")) {
      const rows = root.querySelectorAll([`[data-item-id="${sortDoc.id}"]`, `[data-itemid="${sortDoc.id}"]`, `[data-id="${sortDoc.id}"]`, `[data-uuid="${sortDoc.uuid}"]`].join(","));
      for (const row of rows) for (const badge of row.querySelectorAll?.(".sort-memorize-badge, [data-memorized-count], [data-add2e-memorized-count]") ?? []) {
        badge.textContent = textValue;
        badge.dataset.memorizedCount = textValue;
        badge.dataset.add2eMemorizedCount = textValue;
      }
    }
  } catch (e) { console.warn("[ADD2E][CAST_SPELL][UI_REFRESH][DOM_BADGE_FAILED]", e); }
}
async function refreshActorSpellSheets(actorDoc, sortDoc, value) {
  if (value !== undefined) updateMemorizedBadges(sortDoc, value);
  try {
    for (const app of Object.values(ui.windows ?? {})) {
      const doc = app?.actor ?? app?.document ?? app?.object ?? null;
      const sameActor = doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
      const sameItem = doc?.documentName === "Item" && String(doc.id) === String(sortDoc.id);
      if (sameActor || sameItem) renderApplication(app);
    }
  } catch (_e) {}
  setTimeout(() => {
    if (value !== undefined) updateMemorizedBadges(sortDoc, value);
    if (!actorSheetOpen(actorDoc)) return;
    try {
      for (const app of Object.values(ui.windows ?? {})) {
        const doc = app?.actor ?? app?.document ?? app?.object ?? null;
        const sameActor = doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
        const sameItem = doc?.documentName === "Item" && String(doc.id) === String(sortDoc.id);
        if (sameActor || sameItem) renderApplication(app);
      }
    } catch (_e) {}
  }, 80);
}
function clone(value) { try { return foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value)); } catch (_e) { return value; } }
function validMemPath(path) {
  const p = norm(path);
  if (!p) return false;
  if (p.includes("max") || p.includes("maximum") || p.includes("total") || p.includes("capacity") || p.includes("capacite")) return false;
  if (p.includes("niveau_max") || p.includes("level_max")) return false;
  return true;
}
function adjustMemorizedByList(rawByList, targetTotal) {
  const target = Math.max(0, Number(targetTotal) || 0);
  if (rawByList === undefined || rawByList === null || rawByList === "") return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };
  if (typeof rawByList === "number") return { changed: rawByList !== target, value: target, beforeSum: Number(rawByList) || 0, afterSum: target, leaves: [{ path: "", before: Number(rawByList) || 0, after: target }] };
  if (typeof rawByList !== "object") return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };
  const value = clone(rawByList), leaves = [];
  function scan(obj, pathParts = []) {
    if (!obj || typeof obj !== "object") return;
    for (const [key, val] of Object.entries(obj)) {
      const next = [...pathParts, key], path = next.join(".");
      if (typeof val === "number" && Number.isFinite(val) && validMemPath(path)) { leaves.push({ parent: obj, key, path, before: val }); continue; }
      if (val && typeof val === "object" && !Array.isArray(val)) scan(val, next);
    }
  }
  scan(value);
  if (!leaves.length) return { changed: false, value, beforeSum: 0, afterSum: 0, leaves: [] };
  const beforeSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
  let delta = target - beforeSum;
  if (delta < 0) {
    let remaining = Math.abs(delta);
    for (const leaf of leaves) {
      if (remaining <= 0) break;
      const current = Math.max(0, Number(leaf.parent[leaf.key]) || 0);
      const dec = Math.min(current, remaining);
      leaf.parent[leaf.key] = current - dec;
      remaining -= dec;
    }
  } else if (delta > 0) leaves[0].parent[leaves[0].key] = Math.max(0, Number(leaves[0].parent[leaves[0].key]) || 0) + delta;
  const afterSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
  return { changed: afterSum !== beforeSum || beforeSum !== target, value, beforeSum, afterSum, leaves: leaves.map(leaf => ({ path: leaf.path, before: leaf.before, after: Number(leaf.parent[leaf.key]) || 0 })) };
}
async function setMemorizedCount(actorDoc, sortDoc, value, reason = "") {
  const next = Math.max(0, Number(value) || 0);
  const byListBefore = await sortDoc.getFlag("add2e", "memorizedByList");
  const byListSync = adjustMemorizedByList(byListBefore, next);
  const updateData = { "flags.add2e.memorizedCount": next };
  if (byListSync.changed) updateData["flags.add2e.memorizedByList"] = byListSync.value;
  await sortDoc.update(updateData);
  await refreshActorSpellSheets(actorDoc, sortDoc, next);
  const after = Number(await sortDoc.getFlag("add2e", "memorizedCount")) || 0;
  console.log("[ADD2E][CAST_SPELL][MEMORIZED][SET]", { actor: actorDoc.name, sort: sortDoc.name, sortId: sortDoc.id, reason, wanted: next, after, byListSync });
  return after;
}
async function fallbackChat(actorDoc, sortDoc, chargeLabel = "") {
  const info = sortDoc.system ?? {}, level = Number(actorDoc.system?.niveau) || Number(info.niveau) || 1;
  const rows = ["portee", "duree", "cible", "temps_incantation"].map(k => `<tr><td>${k}</td><td>${formatSortChamp(add2eGetSortField(info, k), level) || "-"}</td></tr>`).join("");
  const description = add2eGetSortField(info, "description", "");
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actorDoc }), content: `<div class="add2e-spell-card"><h3>${sortDoc.name} ${chargeLabel}</h3><table>${rows}</table><div>${description || ""}</div></div>`, ...style() });
}

export async function add2eCastSpell({ actor, sort } = {}) {
  if (!actor || !sort) { ui.notifications.warn("Lanceur ou sort introuvable."); return false; }
  const inputSort = sort;
  sort = resolveActorSpell(actor, sort);
  if (!sort) { ui.notifications.warn("Sort introuvable sur l'acteur."); return false; }

  const tags = globalThis.Add2eEffectsEngine?.getActiveTags?.(actor) ?? [];
  const components = add2eGetSortComponentsText(sort);
  const requiresVerbal = /(^|[,;\s])V([,;\s]|$)/i.test(components);
  const silenced = tags.some(tag => ["etat:silence", "silence:verbal", "anti_sort:verbal"].includes(String(tag)));
  if (requiresVerbal && silenced) { ui.notifications.warn(`${sort.name} exige une composante verbale et le lanceur est sous Silence.`); return false; }

  console.log("[ADD2E][CAST_SPELL][ENTER]", { actor: actor.name, inputSort: inputSort.name, inputSortId: inputSort.id, sort: sort.name, sortId: sort.id, resolvedOnActor: sort.parent?.id === actor.id, onUsePath: add2eGetSortOnUsePath(sort) });

  let spellToUse = sort, reservedCost = null, componentReservation = null, labelCharge = "";
  async function refundComponents(reason = "") {
    if (!componentReservation) return false;
    const refunded = await globalThis.ADD2E_CONSUMABLES?.add2eRefundSpellComponents?.(componentReservation);
    if (refunded) console.log("[ADD2E][CAST_SPELL][REFUND][COMPONENTS]", { reason, sort: spellToUse?.name });
    componentReservation = null;
    return !!refunded;
  }
  async function refundCost(reason = "") {
    await refundComponents(reason);
    if (!reservedCost) return false;
    if (reservedCost.kind === "memorized") {
      const now = Number(await reservedCost.sort.getFlag("add2e", "memorizedCount")) || 0;
      if (now !== reservedCost.after) { await refreshActorSpellSheets(actor, reservedCost.sort, now); return false; }
      await setMemorizedCount(actor, reservedCost.sort, reservedCost.before, `refund:${reason}`);
      return true;
    }
    if (reservedCost.kind === "power") {
      const now = Number(await reservedCost.weapon.getFlag("add2e", reservedCost.flagKey)) || 0;
      if (now !== reservedCost.after) return false;
      await reservedCost.weapon.setFlag("add2e", reservedCost.flagKey, reservedCost.before);
      return true;
    }
    return false;
  }
  async function reserveComponents() {
    if (sort.system?.isPower) return true;
    const api = globalThis.ADD2E_CONSUMABLES;
    if (!api?.add2eReserveSpellComponents) return true;
    const scriptPath = add2eGetSortOnUsePath(spellToUse);
    if (onUseManagesSpellComponents(scriptPath, spellToUse)) return true;
    componentReservation = await api.add2eReserveSpellComponents(actor, spellToUse);
    if (componentReservation?.blocked) { await refundCost("composants manquants"); ui.notifications.warn(componentReservation.message || "Composant matériel manquant."); return false; }
    return true;
  }

  if (sort.system?.isPower) {
    const weapon = actor.items.get(sort.system.sourceWeaponId);
    if (!weapon) { ui.notifications.error("Objet source introuvable."); return false; }
    const maxGlobal = Number(weapon.system?.max_charges || 0), isGlobal = maxGlobal > 0;
    const flagKey = isGlobal ? "global_charges" : `charges_${sort.system.powerIndex}`;
    const max = isGlobal ? maxGlobal : Number(sort.system.max || 1);
    const currentFlag = await weapon.getFlag("add2e", flagKey);
    const current = currentFlag !== undefined && currentFlag !== null ? Number(currentFlag) : max;
    const cost = Number(sort.system.cost || 1);
    if (current < cost) { ui.notifications.warn(`L'objet ${weapon.name} n'a plus assez de charges (${current}/${cost} req).`); return false; }
    const after = current - cost;
    await weapon.setFlag("add2e", flagKey, after);
    reservedCost = { kind: "power", weapon, flagKey, before: current, after, max, cost };
    labelCharge = `<span style="color:#d35400;">Charges : ${after}/${max}</span>`;
    const baseName = sort.name.replace(/\s\(.*?\)$/, "").trim();
    const realSpell = game.items.find(i => i.type === "sort" && i.name.toLowerCase() === baseName.toLowerCase());
    if (realSpell) spellToUse = realSpell;
  } else {
    const mem = Number(await sort.getFlag("add2e", "memorizedCount")) || 0;
    if (mem <= 0) { ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé !`); await refreshActorSpellSheets(actor, sort, 0); return false; }
    const after = Math.max(0, mem - 1);
    await setMemorizedCount(actor, sort, after, "reserve before onUse");
    reservedCost = { kind: "memorized", sort, before: mem, after };
    labelCharge = `<span style="color:#2980b9;">Reste : ${after}</span>`;
  }

  if (!await reserveComponents()) return false;
  const scriptPath = add2eGetSortOnUsePath(spellToUse);
  let launched = true, scriptExecuted = false;
  if (scriptPath) {
    scriptExecuted = true;
    try {
      const response = await fetch(scriptPath, { cache: "no-store" });
      if (!response.ok) { await refundCost("script introuvable"); ui.notifications.error(`${spellToUse.name} : script onUse introuvable.`); return false; }
      const code = await response.text();
      const Fn = Object.getPrototypeOf(async function(){}).constructor;
      const casterToken = getCasterToken(actor);
      const fn = new Fn("actor", "item", "sort", "token", "args", "sourceItem", code);
      const result = await fn.call(spellToUse, actor, spellToUse, sort, casterToken, [{ actor, item: spellToUse, sort, token: casterToken, sourceItem: spellToUse }], spellToUse);
      if (result === true) launched = true;
      else if (result === false) launched = false;
      else { launched = false; ui.notifications.error(`${spellToUse.name} : le script onUse doit retourner true ou false.`); }
      console.log("[ADD2E][CAST_SPELL][ONUSE_RESULT]", { sort: spellToUse.name, result, consumed: launched });
    } catch (e) {
      await refundCost("erreur script");
      console.error("[ADD2E][CAST_SPELL][ONUSE][ERROR]", { sort: spellToUse.name, scriptPath, error: e });
      ui.notifications.error(`${spellToUse.name} : erreur dans le script onUse.`);
      return false;
    }
  }
  if (!launched) { await refundCost("onUse false"); return false; }
  componentReservation = null;
  if (!scriptExecuted) {
    await globalThis.ADD2E_PLAY_SPELL_FX?.("default", { casterToken: getCasterToken(actor) });
    await fallbackChat(actor, spellToUse, labelCharge);
  }
  await refreshActorSpellSheets(actor, sort, reservedCost?.kind === "memorized" ? reservedCost.after : undefined);
  console.log("[ADD2E][CAST_SPELL][CONSUMED]", { actor: actor.name, sort: spellToUse.name, sortId: sort.id, reservedCost });
  return true;
}

globalThis.add2eCastSpell = add2eCastSpell;
globalThis.cast_spell = add2eCastSpell;
