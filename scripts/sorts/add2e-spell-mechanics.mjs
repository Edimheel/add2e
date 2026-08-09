/** ADD2E - Socle generique des mecanismes de sorts - Foundry V13/V14/V15. */
const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const norm = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/\s+/g, "_");
const levelOf = actor => Number(actor?.system?.details?.level?.value ?? actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.details?.niveau ?? 1) || 1;
const targetTokens = () => Array.from(game.user?.targets ?? []);
const targetActors = targets => targets.map(t => t.actor).filter(Boolean);
const activeTags = actor => globalThis.Add2eEffectsEngine?.getActiveTags?.(actor) ?? [];
const sourceContext = context => {
  const sourceItem = context.item ?? context.sort ?? context.sourceItem ?? null;
  const casterToken = context.token ?? canvas.tokens?.controlled?.[0] ?? context.actor?.getActiveTokens?.()?.[0] ?? null;
  const caster = context.actor ?? casterToken?.actor ?? sourceItem?.parent ?? null;
  return { sourceItem, casterToken, caster, level: levelOf(caster), targets: targetTokens() };
};
async function confirmDialog(spell, content, fields = "", callback = () => ({})) {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error(`${spell.name} : l’API de fenêtre ADD2E est indisponible.`);
  }
  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-spell-confirm-dialog"],
    window: { title: `Lancement : ${spell.name}` },
    content: `<form class="add2e-spell-confirm-form" style="display:flex;flex-direction:column;gap:8px">${content}${fields}</form>`,
    buttons: [
      {
        action: "cast",
        label: "Confirmer le lancement",
        icon: "<i class='fa-solid fa-wand-magic-sparkles'></i>",
        default: true,
        callback: (_event, button) => callback(button.form)
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fa-solid fa-xmark'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
}
async function playVfx(spell, casterToken, targets = []) {
  const list = targets.length ? targets : (casterToken ? [casterToken] : []);
  if (globalThis.ADD2E_PLAY_SPELL_FX && casterToken) {
    await globalThis.ADD2E_PLAY_SPELL_FX(spell.fx, { casterToken, targetTokens: list, launchOptions: { text: spell.name.toUpperCase(), color: spell.color, duration: 900, durationText: 1200 }, targetOptions: { text: "✦", color: spell.color, duration: 800, durationText: 1000 } });
    return;
  }
  for (const token of list) await canvas.interface?.createScrollingText?.(token.center, spell.name, { anchor: CONST.TEXT_ANCHOR_POINTS?.CENTER ?? 0, direction: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1, duration: 1400, distance: 80, fontSize: 28, fill: spell.color, stroke: 0x000000, strokeThickness: 4 });
}
async function chat(caster, casterToken, spell, body, { whisper = null, rolls = [] } = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error(`${spell.name} : les constructeurs communs de cartes ADD2E sont indisponibles.`);
  }
  const options = {
    actor: caster,
    title: spell.name,
    icon: "fas fa-wand-magic-sparkles",
    variant: "spell",
    source: {
      name: caster?.name ?? "Lanceur",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? spell?.img ?? "icons/svg/book.svg",
      type: "Sort"
    },
    trustedBodyHtml: body,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken?.document }),
      ...(whisper ? { whisper } : {}),
      ...(Array.isArray(rolls) && rolls.length ? { rolls: rolls.filter(Boolean) } : {}),
      flags: {
        add2e: {
          spellMechanics: true,
          spellName: spell.name
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}
function durationData(rounds) {
  const value = Number(rounds);
  return Number.isFinite(value) && value > 0 ? { rounds: value, startRound: game.combat?.round ?? 0, startTurn: game.combat?.turn ?? 0 } : {};
}
function standardStatus(...ids) {
  const available = new Set((CONFIG.statusEffects ?? []).map(s => String(s.id ?? s._id ?? "")));
  const found = ids.find(id => available.has(id));
  return found ? [found] : [];
}
function effectData({ spell, sourceItem, rounds = null, tags = [], status = [], extra = {}, description = "" }) {
  return {
    name: spell.name,
    img: sourceItem?.img ?? "icons/svg/aura.svg",
    origin: sourceItem?.uuid ?? null,
    disabled: false,
    duration: durationData(rounds),
    statuses: status,
    flags: { add2e: { tags, sourceSpell: spell.name, sourceSpellId: sourceItem?.id ?? null, description, ...extra } }
  };
}
async function createEffect(actor, data) {
  if (!actor) return null;
  if (actor.isOwner || game.user?.isGM) return (await actor.createEmbeddedDocuments("ActiveEffect", [data]))?.[0] ?? null;
  if (!game.socket) return null;
  game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: actor.uuid, actorId: actor.id, effectData: data, fromUserId: game.user.id } });
  return { id: null, relayed: true };
}
async function createTemporaryItems(actor, { spell, sourceItem, creator = null, items = [] }) {
  if (!actor || !items.length || !(actor.isOwner || game.user?.isGM)) return [];
  const createdAtWorldTime = Number(game.time?.worldTime);
  const itemData = items.filter(item => item?.name && Number(item.quantity) > 0).map(item => ({
    name: item.name,
    type: item.type ?? "objet",
    img: item.img ?? sourceItem?.img ?? "icons/svg/item-bag.svg",
    system: { nom: item.name, description: item.description ?? "", quantite: Number(item.quantity), quantity: Number(item.quantity), unite: item.unit ?? null, equipee: false, tags: Array.from(new Set(["objet:creation_magique_temporaire", ...(item.tags ?? [])])) },
    flags: { add2e: { temporarySpellItem: true, createdBySpell: spell.name, sourceSpell: spell.name, sourceSpellId: sourceItem?.id ?? null, creatorActorId: creator?.id ?? null, createdAtWorldTime: Number.isFinite(createdAtWorldTime) ? createdAtWorldTime : null, ...(item.flags ?? {}) } }
  }));
  if (!itemData.length) return [];
  return actor.createEmbeddedDocuments("Item", itemData);
}

function saveValue(actor, index) {
  const saves = actor?.system?.sauvegardes;
  const value = Array.isArray(saves) ? Number(saves[index]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : NaN;
}
async function rollSave(actor, { index, vsType, modifier = 0 }) {
  const threshold = saveValue(actor, index);
  if (!Number.isFinite(threshold)) return { available: false, success: false, threshold, total: null, modifier };
  const engineBonus = Number(globalThis.Add2eEffectsEngine?.getSaveBonusVs?.(actor, vsType) ?? 0) || 0;
  const totalModifier = Number(modifier) + engineBonus;
  const roll = await new Roll(totalModifier ? `1d20${totalModifier >= 0 ? "+" : ""}${totalModifier}` : "1d20").evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return { available: true, success: Number(roll.total) >= threshold, threshold, total: Number(roll.total), modifier: totalModifier };
}
function targetRule(spell, targets, min, max) {
  if (targets.length >= min && targets.length <= max && targets.every(t => t.actor)) return true;
  ui.notifications?.warn?.(`${spell.name} : sélectionne entre ${min} et ${max} cible(s) avec acteur.`);
  return false;
}
function names(targets) { return targets.length ? targets.map(t => esc(t.name)).join(", ") : "aucune"; }
function alignmentOf(actor) {
  const sys = actor?.system ?? {};
  return sys.alignement ?? sys.alignment ?? sys.details?.alignment ?? sys.details?.alignement ?? null;
}
async function applyMany(actors, makeData) {
  const results = [];
  for (const actor of actors) results.push(await createEffect(actor, makeData(actor)));
  return results;
}

/** Outils communs reutilisables par tous les scripts de sorts ADD2E. */
export const ADD2E_SPELL_MECHANICS = Object.freeze({
  escapeHtml: esc,
  normalizeKey: norm,
  levelOf,
  targetTokens,
  targetActors,
  activeTags,
  sourceContext,
  confirmDialog,
  playVfx,
  chat,
  durationData,
  standardStatus,
  effectData,
  createEffect,
  createTemporaryItems,
  rollSave,
  targetRule,
  targetNames: names,
  alignmentOf,
  applyMany
});