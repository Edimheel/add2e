// ADD2E — Aura magique de Nystul
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l’API ADD2E commune.
// Version : 2026-09-18-common-ui-chat-v2

const A = typeof actor !== "undefined" ? actor : null;
const I = typeof item !== "undefined" ? item : (typeof sort !== "undefined" ? sort : null);
const T = typeof token !== "undefined" ? token : null;
const R = typeof args !== "undefined" ? args : [];
const C = Object.freeze({
  name: "Aura magique de Nystul", slug: "aura_magique_de_nystul", level: 1,
  school: "Illusion/Fantasme", range: "au toucher", duration: "1 jour par niveau",
  casting: "1 round", save: "spécial", area: "un objet de 50 po maximum par niveau",
  material: "un petit morceau de soie"
});

if (typeof globalThis.add2eDialogWait !== "function") {
  throw new Error(`${C.name} : l’API de fenêtre ADD2E est indisponible.`);
}
if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
  throw new Error(`${C.name} : les constructeurs communs de cartes ADD2E sont indisponibles.`);
}

const spellImg = () => String(I?.img ?? "").trim() || "icons/svg/aura.svg";
const clone = v => foundry?.utils?.deepClone?.(v) ?? JSON.parse(JSON.stringify(v));
const esc = v => { const d = document.createElement("div"); d.innerText = String(v ?? ""); return d.innerHTML; };
const norm = v => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const number = (...values) => { for (const v of values) { const m = String(v ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/); if (m && Number.isFinite(Number(m[0]))) return Number(m[0]); } return null; };
const casterToken = actorDoc => T ?? R?.[0]?.token ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id) ?? actorDoc?.getActiveTokens?.()?.[0] ?? canvas?.tokens?.controlled?.[0] ?? null;
const casterLevel = actorDoc => {
  const wizard = [...(actorDoc?.items ?? [])].find(i => /classe|class/.test(norm(i.type)) && norm(i.name).includes("magicien"));
  return Math.max(1, Math.floor(number(wizard?.system?.niveau, wizard?.system?.level, actorDoc?.system?.niveau, actorDoc?.system?.level) || 1));
};
const carried = itemDoc => ["equipee", "equipped", "portee", "worn", "tenu", "carried"].some(k => itemDoc?.system?.[k] === true);
const itemWeight = itemDoc => number(itemDoc?.system?.poids, itemDoc?.system?.weight, itemDoc?.system?.poids_total, itemDoc?.system?.totalWeight);
const activeNystul = effect => {
  const f = effect?.flags?.add2e ?? {}; const s = f.spell ?? {}; const a = f.magicAura ?? {};
  return !effect?.disabled && (a.kind === "false_magic_aura" || s.slug === C.slug || (Array.isArray(f.tags) && f.tags.includes(`sort:${C.slug}`)));
};
const effectFor = (actorDoc, itemDoc, objectName) => [...(actorDoc?.effects ?? [])].find(e => {
  if (!activeNystul(e)) return false;
  const f = e.flags?.add2e ?? {}; const a = f.magicAura ?? {}; const s = f.spell ?? {};
  return itemDoc ? (a.itemId === itemDoc.id || s.itemId === itemDoc.id) : norm(a.objectName ?? s.objectName) === norm(objectName);
}) ?? null;
const valueOf = (form, key) => String(new FormData(form).get(key) ?? "").trim();
const checked = (form, key) => new FormData(form).get(key) === "on";

function candidates(actorDoc, level) {
  const limit = 50 * level; const target = [...(game.user?.targets ?? [])][0] ?? null;
  const holders = [{ actor: actorDoc, token: casterToken(actorDoc), label: actorDoc.name }];
  if (target?.actor && target.actor.id !== actorDoc?.id) holders.push({ actor: target.actor, token: target, label: target.name });
  const out = []; const seen = new Set();
  for (const h of holders) for (const itemDoc of h.actor.items ?? []) {
    if (["classe", "race", "sort"].includes(norm(itemDoc.type))) continue;
    const key = `${h.actor.id}:${itemDoc.id}`; if (seen.has(key)) continue; seen.add(key);
    const weight = itemWeight(itemDoc), known = Number.isFinite(weight), valid = !known || weight <= limit, aura = effectFor(h.actor, itemDoc, itemDoc.name);
    out.push({ kind: "item", actor: h.actor, token: h.token, item: itemDoc, weight, known, valid, aura,
      label: `${h.label} — ${itemDoc.name} [${itemDoc.type}${carried(itemDoc) ? ", porté" : ""}${known ? `, ${weight} po` : ", poids à confirmer"}]${aura ? " ✨ aura active" : ""}${valid ? "" : " — hors limite"}` });
  }
  out.push({ kind: "manual", actor: actorDoc, token: casterToken(actorDoc), item: null, known: false, valid: true, aura: null, label: "Objet non listé / élément du décor" });
  return out;
}

async function choose(actorDoc, level) {
  const list = candidates(actorDoc, level), limit = 50 * level;
  const options = list.map((x, n) => `<option value="${n}"${x.kind === "item" && !x.valid ? " disabled" : ""}>${esc(x.label)}</option>`).join("");
  const content = `<form class="add2e-nystul-dialog-form">
    <p><b>Limite :</b> 50 po/niveau, soit ${limit} po.</p>
    <div class="form-group"><label>Objet touché</label><select name="choice">${options}</select></div>
    <div class="form-group"><label>Objet non listé</label><input name="manual" placeholder="Coffre, pierre, porte…"></div>
    <label><input type="checkbox" name="weight"> Je confirme que le poids inconnu ne dépasse pas ${limit} po.</label>
    <p class="hint">L'objet paraît magique à Détection de la magie. Son détenteur peut percer la supercherie par un jet de protection contre les sorts lorsqu'il tient l'objet pendant la détection.</p>
  </form>`;

  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-nystul-dialog"],
    window: { title: C.name },
    content,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-wand-magic-sparkles'></i>",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          const choice = list[Number(valueOf(form, "choice"))] ?? list.at(-1);
          const manual = valueOf(form, "manual");
          const objectName = choice.item?.name ?? manual;
          if (choice.kind === "manual" && !objectName) return { invalid: "Indique l'objet à affecter." };
          if (!choice.valid) return { invalid: `Cet objet dépasse ${limit} po.` };
          if ((choice.kind === "manual" || !choice.known) && !checked(form, "weight")) return { invalid: `Confirme que l'objet ne dépasse pas ${limit} po.` };
          return { ...choice, objectName };
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
}

function effectData(choice, level) {
  const days = Math.max(1, level), itemDoc = choice.item, itemId = itemDoc?.id ?? null;
  return {
    name: `Aura magique illusoire — ${choice.objectName}`, img: spellImg(), disabled: false, transfer: false, type: "base", system: {}, changes: [], origin: I?.uuid ?? null,
    duration: { seconds: days * 86400, startTime: game.time?.worldTime ?? null, startRound: game.combat?.round ?? null, combat: game.combat?.id ?? null },
    description: `${choice.objectName} paraît magique à une détection. Le détenteur peut découvrir la supercherie avec un jet de protection contre les sorts lorsqu'il tient l'objet.`,
    flags: { add2e: {
      endMessage: "L'aura magique illusoire de {effect} se dissipe sur {actor}.",
      tags: ["classe:magicien", "liste:magicien", "niveau:1", `sort:${C.slug}`, "ecole:illusion_fantasme", "type:illusion", "type:objet", "aura:magique", "aura:illusoire", "aura:faux_positif", "detection_magie:fausse_aura", "detection_magie:nature_indeterminable", "jet_sauvegarde:sortileges_si_tenu", "duree:1_jour_par_niveau", `duree_jours:${days}`, `objet:${norm(itemId || choice.objectName)}`, itemId ? `item_id:${itemId}` : "item_id:manuel"],
      magicAura: { version: 1, kind: "false_magic_aura", detectedAsMagical: true, revealableWhenHeld: true, revealSave: "spells", identifiableSchool: false, objectName: choice.objectName, itemId, itemUuid: itemDoc?.uuid ?? null, weightPoints: Number.isFinite(choice.weight) ? choice.weight : null, weightLimitPoints: 50 * level, carrierActorId: choice.actor?.id ?? null, carrierActorUuid: choice.actor?.uuid ?? null },
      spell: { slug: C.slug, name: C.name, level: C.level, school: C.school, casterId: A?.id ?? null, casterUuid: A?.uuid ?? null, casterName: A?.name ?? "", carrierActorId: choice.actor?.id ?? null, carrierActorUuid: choice.actor?.uuid ?? null, objectName: choice.objectName, itemId, itemUuid: itemDoc?.uuid ?? null, casterLevel: level, durationDays: days, sourceItemId: I?.id ?? null, sourceItemUuid: I?.uuid ?? null }
    }}
  };
}

function emit(operation, payload) {
  if (!game.socket) return false;
  game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation, payload });
  return true;
}

async function removeExisting(choice) {
  const existing = effectFor(choice.actor, choice.item, choice.objectName);
  if (!existing) return false;
  if (game.user?.isGM || choice.actor.isOwner) {
    await choice.actor.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
    return true;
  }
  return emit("deleteActiveEffects", { actorUuid: choice.actor.uuid, actorId: choice.actor.id, effectIds: [existing.id], tags: [`sort:${C.slug}`], names: [C.name] });
}

async function apply(choice, data) {
  if (game.user?.isGM || choice.actor.isOwner) {
    try {
      await choice.actor.createEmbeddedDocuments("ActiveEffect", [clone(data)]);
      return true;
    } catch (_error) {}
  }
  return emit("createActiveEffect", { actorUuid: choice.actor.uuid, actorId: choice.actor.id, sceneId: canvas?.scene?.id ?? null, tokenId: choice.token?.document?.id ?? choice.token?.id ?? null, effectData: data });
}

async function chat(choice, level, replaced) {
  const tokenDoc = casterToken(A);
  const days = Math.max(1, level);
  const card = {
    actor: A,
    title: C.name,
    icon: "fas fa-wand-magic-sparkles",
    variant: "spell",
    source: {
      name: A?.name ?? tokenDoc?.name ?? "Magicien",
      img: tokenDoc?.document?.texture?.src ?? A?.img ?? spellImg(),
      type: "Sort profane",
      meta: `Niveau de lanceur ${level}`
    },
    target: {
      name: choice.objectName,
      img: choice.item?.img ?? spellImg(),
      type: "Objet touché",
      meta: Number.isFinite(choice.weight) ? `${choice.weight} po` : "Poids confirmé"
    },
    rows: [
      { label: "Effet", value: "Aura magique illusoire" },
      { label: "Durée", value: `${days} jour${days > 1 ? "s" : ""}` },
      { label: "Détection", value: "L’objet paraît magique" },
      { label: "Supercherie", value: "JP contre les sorts si l’objet est tenu" },
      ...(replaced ? [{ label: "Aura précédente", value: "Remplacée" }] : [])
    ],
    message: `${choice.objectName} paraît désormais magique à une détection de la magie.`,
    trustedBodyHtml: `<p>Sa nature ne peut pas être révélée. Si le détecteur tient lui-même l'objet, un jet de protection contre les sorts réussi découvre la supercherie.</p><p><b>École :</b> ${esc(C.school)} — <b>Portée :</b> ${esc(C.range)} — <b>Zone :</b> ${esc(C.area)}.</p><p><b>Composantes :</b> V, S, M (${esc(C.material)}) — <b>Incantation :</b> ${esc(C.casting)} — <b>Jet :</b> ${esc(C.save)}.</p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: A, token: tokenDoc }),
      flags: {
        add2e: {
          chatCardType: "nystul-magic-aura",
          version: "2026-09-18-common-ui-chat-v2",
          sourceItemUuid: I?.uuid ?? null,
          targetActorUuid: choice.actor?.uuid ?? null,
          targetItemUuid: choice.item?.uuid ?? null,
          objectName: choice.objectName,
          casterLevel: level,
          durationDays: days,
          replaced: replaced === true
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${C.name} : carte ADD2E vide.`);
  return globalThis.add2eCreateChatCard(card);
}

if (!A) {
  ui.notifications?.warn?.(`${C.name} : acteur lanceur introuvable.`);
  return false;
}
const level = casterLevel(A);
const choice = await choose(A, level);
if (!choice) return false;
if (choice.invalid) {
  ui.notifications?.warn?.(`${C.name} : ${choice.invalid}`);
  return false;
}
const replaced = await removeExisting(choice);
const applied = await apply(choice, effectData(choice, level));
if (!applied) {
  ui.notifications?.error?.(`${C.name} : impossible d'appliquer l'aura.`);
  return false;
}
await chat(choice, level, replaced);
return true;
