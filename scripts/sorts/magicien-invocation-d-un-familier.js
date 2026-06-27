// ADD2E — onUse Magicien : Invocation d’un familier
// Compatible Foundry V13/V14/V15.
// Les dés sont tirés côté lanceur ; la création est autoritaire côté MJ responsable.

const ADD2E_FAMILIAR_SOCKET = "system.add2e";
const ADD2E_FAMILIAR_OPERATION = "ADD2E_GM_OPERATION";
const ADD2E_FAMILIAR_RANGE = 12;
const ADD2E_FAMILIAR_ASSET_BASE = "systems/add2e/assets/token";
const ADD2E_FAMILIAR_ASSETS = Object.freeze({
  chat_noir: `${ADD2E_FAMILIAR_ASSET_BASE}/chat-noir.png`,
  corbeau: `${ADD2E_FAMILIAR_ASSET_BASE}/corbeau.png`,
  faucon: `${ADD2E_FAMILIAR_ASSET_BASE}/faucon.png`,
  hibou: `${ADD2E_FAMILIAR_ASSET_BASE}/hibou.png`,
  crapaud: `${ADD2E_FAMILIAR_ASSET_BASE}/crapaud.png`,
  belette: `${ADD2E_FAMILIAR_ASSET_BASE}/belette.png`,
  quasit: `${ADD2E_FAMILIAR_ASSET_BASE}/quasit.png`,
  pseudo_dragon: `${ADD2E_FAMILIAR_ASSET_BASE}/pseudo-dragon.png`,
  lutin: `${ADD2E_FAMILIAR_ASSET_BASE}/lutin.png`,
  diablotin: `${ADD2E_FAMILIAR_ASSET_BASE}/diablotin.png`
});

const ADD2E_NORMAL_FAMILIARS = [
  { max: 4, key: "chat_noir", label: "Chat noir", img: ADD2E_FAMILIAR_ASSETS.chat_noir, senses: "Excellente vision nocturne et ouïe supérieure.", tags: ["familier:sens:vision_nocturne", "familier:sens:ouie_superieure"] },
  { max: 6, key: "corbeau", label: "Corbeau", img: ADD2E_FAMILIAR_ASSETS.corbeau, senses: "Vision excellente.", tags: ["familier:sens:vision_excellente"] },
  { max: 8, key: "faucon", label: "Faucon", img: ADD2E_FAMILIAR_ASSETS.faucon, senses: "Vision de loin exceptionnelle.", tags: ["familier:sens:vision_lointaine_exceptionnelle"] },
  { max: 10, key: "hibou", label: "Hibou / chat huant", img: ADD2E_FAMILIAR_ASSETS.hibou, senses: "Vision nocturne égale à la vision diurne humaine et ouïe supérieure.", tags: ["familier:sens:vision_nocturne_humaine_diurne", "familier:sens:ouie_superieure"] },
  { max: 12, key: "crapaud", label: "Crapaud", img: ADD2E_FAMILIAR_ASSETS.crapaud, senses: "Angle de vision très large.", tags: ["familier:sens:vision_angle_large"] },
  { max: 14, key: "belette", label: "Belette", img: ADD2E_FAMILIAR_ASSETS.belette, senses: "Ouïe supérieure et odorat exceptionnel.", tags: ["familier:sens:ouie_superieure", "familier:sens:odorat_exceptionnel"] }
];

const ADD2E_SPECIAL_FAMILIARS = {
  quasit: {
    key: "quasit",
    label: "Quasit",
    aliases: ["quasit"],
    img: ADD2E_FAMILIAR_ASSETS.quasit,
    senses: "Lien télépathique, partage des sens incluant l’infravision ; le quasit peut servir d’éclaireur et de garde.",
    tags: ["familier:quasit", "familier:communication_telepathique", "familier:partage_sens", "familier:sens:infravision"],
    masterResistances: [{ type: "magie", percent: 25 }],
    regenerationPerRound: 1,
    temporaryLevelBonus: 1,
    deathPenalty: { type: "level", amount: 4 }
  },
  pseudo_dragon: {
    key: "pseudo_dragon",
    label: "Pseudo-dragon",
    aliases: ["pseudo-dragon", "pseudo dragon", "dragonnet, pseudo-dragon", "dragonnet pseudo-dragon", "dragonnet"],
    img: ADD2E_FAMILIAR_ASSETS.pseudo_dragon,
    senses: "Communication télépathique et transmission de tout ce que le pseudo-dragon voit ou entend ; il possède l’infravision et peut se camoufler ou devenir invisible.",
    tags: ["familier:pseudo_dragon", "familier:communication_telepathique", "familier:partage_sens", "familier:sens:infravision", "familier:camouflage", "familier:invisibilite"],
    masterResistances: [{ type: "magie", percent: 35 }]
  },
  lutin: {
    key: "lutin",
    label: "Lutin",
    aliases: ["lutin"],
    img: ADD2E_FAMILIAR_ASSETS.lutin,
    senses: "Le lutin est un ami et un compagnon ; il sert d’éclaireur, d’espion et de garde.",
    tags: ["familier:lutin", "familier:partage_sens"],
    dexterityTo18: true,
    neverSurprised: true,
    saveBonus: 2
  },
  diablotin: {
    key: "diablotin",
    label: "Diablotin",
    aliases: ["diablotin", "imp"],
    img: ADD2E_FAMILIAR_ASSETS.diablotin,
    senses: "Lien télépathique, partage des sens incluant l’infravision ; le diablotin peut servir d’éclaireur et de garde.",
    tags: ["familier:diablotin", "familier:communication_telepathique", "familier:partage_sens", "familier:sens:infravision"],
    masterResistances: [{ type: "magie", percent: 25 }],
    regenerationPerRound: 1,
    temporaryLevelBonus: 1,
    deathPenalty: { type: "level", amount: 4 }
  }
};

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function casterTokenFor(caster) {
  const contextual = (typeof token !== "undefined" && token) ? token : null;
  return contextual
    ?? canvas?.tokens?.controlled?.find?.(entry => entry?.actor?.id === caster?.id)
    ?? caster?.getActiveTokens?.()?.[0]
    ?? null;
}

function casterLevel(caster) {
  const level = Number(caster?.system?.niveau ?? caster?.system?.level ?? 1);
  return Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
}

function familiarLink(caster) {
  return caster?.getFlag?.("add2e", "familiar") ?? caster?.flags?.add2e?.familiar ?? null;
}

function hasLinkedEffects(caster, relation) {
  const linkId = String(relation?.linkId ?? "");
  return !!linkId && Array.from(caster?.effects ?? []).some(effect => {
    const data = effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
    return data?.linkId === linkId;
  });
}

function normalFamiliarFor(result) {
  return ADD2E_NORMAL_FAMILIARS.find(entry => result <= entry.max) ?? null;
}

function specialFamiliarFor(caster) {
  const alignment = normalize(caster?.system?.alignement ?? caster?.system?.alignment ?? caster?.system?.details?.alignement ?? caster?.system?.details?.alignment ?? "");
  const loyal = alignment.includes("loyal");
  const chaotic = alignment.includes("chaotique");
  const good = alignment.includes("bon");
  const evil = alignment.includes("mauvais");
  const neutral = alignment === "neutre" || alignment.includes("neutre");
  if (chaotic && (evil || neutral)) return ADD2E_SPECIAL_FAMILIARS.quasit;
  if ((loyal || neutral) && evil) return ADD2E_SPECIAL_FAMILIARS.diablotin;
  if (loyal && (neutral || good)) return ADD2E_SPECIAL_FAMILIARS.lutin;
  if (alignment === "neutre" || (chaotic && good) || (neutral && good)) return ADD2E_SPECIAL_FAMILIARS.pseudo_dragon;
  return null;
}

async function roll(formula) {
  const result = await new Roll(formula).evaluate();
  if (game.dice3d?.showForRoll) await game.dice3d.showForRoll(result);
  return result;
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id;
}

async function chat(caster, casterToken, html) {
  const type = CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `<div class="add2e-spell-card" style="border:1px solid #8e63c7;border-radius:10px;overflow:hidden;background:#f8f3ff;color:#2d2144;"><div style="display:flex;align-items:center;gap:9px;padding:8px 10px;background:#5b3f8c;color:#fff;"><img src="${escapeHtml(item?.img ?? "icons/svg/book.svg")}" style="width:34px;height:34px;border:1px solid #d8c3ff;border-radius:4px;background:#fff;object-fit:cover;"><div><b>${escapeHtml(caster?.name ?? "Magicien")}</b><br><span style="font-size:.88em;">Invocation d’un familier</span></div></div><div style="padding:10px;">${html}</div></div>`,
    ...type
  });
}

const caster = (typeof actor !== "undefined" && actor) ? actor : null;
const casterToken = casterTokenFor(caster);
if (!caster || caster.type !== "personnage") {
  ui.notifications.warn("Invocation d’un familier : le lanceur doit être un personnage.");
  return false;
}
if (!casterToken?.document) {
  ui.notifications.warn("Invocation d’un familier : le magicien doit avoir un token sur la scène.");
  return false;
}

const previous = familiarLink(caster);
if (previous?.actorId && game.actors?.get?.(previous.actorId) && hasLinkedEffects(caster, previous)) {
  ui.notifications.warn(`${caster.name} possède déjà un familier.`);
  return false;
}

// Règle du Manuel des joueurs : le d16 n’est relancé que si le d20 initial
// était entre 16 et 20 et que la réduction de niveau l’amène à 15 ou moins.
const level = casterLevel(caster);
const levelModifier = Math.floor(level / 3);
const d20 = await roll("1d20");
const initial = Number(d20.total);
const reduced = Math.max(1, initial - levelModifier);
let result = initial;
let d16 = null;
let usedD16 = false;
if (initial >= 16) {
  if (reduced <= 15) {
    d16 = await roll("1d16");
    result = Number(d16.total);
    usedD16 = true;
  } else {
    result = reduced;
  }
}

let familiar = null;
let normal = false;
let hp = null;
let failureReason = "";
if (result <= 14) {
  familiar = normalFamiliarFor(result);
  normal = !!familiar;
  if (familiar) hp = Number((await roll("1d3+1")).total);
} else if (result === 15) {
  familiar = specialFamiliarFor(caster);
  if (!familiar) failureReason = `L’alignement « ${caster.system?.alignement ?? "non renseigné"} » ne permet pas de déterminer le familier spécial.`;
} else {
  failureReason = "Aucun familier n’est à portée du sort.";
}

const d20Label = initial >= 16 && levelModifier ? `${initial} − ${levelModifier} = <b>${reduced}</b>` : `<b>${initial}</b>`;
const rollLabel = usedD16 ? `d20 : ${d20Label} ; nouveau d16 : <b>${result}</b>` : `d20 : ${d20Label}`;
if (!familiar) {
  await chat(caster, casterToken, `<div style="text-align:center;color:#8a1f18;font-weight:900;">AUCUN FAMILIER</div><div style="margin-top:6px;"><b>Jets :</b> ${rollLabel}</div><p style="margin:.55em 0 0;">${escapeHtml(failureReason || "Le tirage ne permet pas de déterminer un familier.")}</p>`);
  return true;
}

const requestId = `familiar-${caster.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const payload = {
  requestId,
  sceneId: casterToken.document.parent?.id ?? canvas?.scene?.id ?? null,
  actorId: caster.id,
  actorUuid: caster.uuid,
  tokenId: casterToken.document.id,
  tokenUuid: casterToken.document.uuid,
  casterActorId: caster.id,
  casterActorUuid: caster.uuid,
  casterTokenId: casterToken.document.id,
  casterTokenUuid: casterToken.document.uuid,
  familiar: {
    key: familiar.key,
    label: familiar.label,
    img: familiar.img,
    aliases: familiar.aliases ?? [familiar.label],
    special: !normal,
    normal,
    hp,
    armorClass: normal ? 7 : null,
    senses: familiar.senses ?? "",
    tags: familiar.tags ?? [],
    dexterityTo18: familiar.dexterityTo18 === true,
    neverSurprised: familiar.neverSurprised === true,
    saveBonus: Number(familiar.saveBonus ?? 0) || 0,
    masterResistances: Array.isArray(familiar.masterResistances) ? familiar.masterResistances : [],
    regenerationPerRound: Math.max(0, Number(familiar.regenerationPerRound ?? 0) || 0),
    temporaryLevelBonus: Math.max(0, Number(familiar.temporaryLevelBonus ?? 0) || 0),
    deathPenalty: familiar.deathPenalty && typeof familiar.deathPenalty === "object" ? familiar.deathPenalty : null,
    range: ADD2E_FAMILIAR_RANGE
  },
  roll: { d20: initial, levelModifier, reduced, d16: d16 ? Number(d16.total) : null, result }
};

const details = normal ? `Familier normal : <b>${escapeHtml(familiar.label)}</b> — CA 7, ${hp} PV.` : `Familier spécial : <b>${escapeHtml(familiar.label)}</b>.`;
await chat(caster, casterToken, `<div style="text-align:center;color:#2f8f46;font-weight:900;">FAMILIER INVOQUÉ</div><div style="margin-top:6px;"><b>Jets :</b> ${rollLabel}</div><p style="margin:.55em 0 0;">${details}</p><p style="margin:.35em 0 0;">Le token est visible et suit le magicien par défaut. Les effets sont actifs à ${ADD2E_FAMILIAR_RANGE} cases ou moins.</p>`);

if (isResponsibleGM() && typeof globalThis.add2eCreateFamiliar === "function") {
  if (!await globalThis.add2eCreateFamiliar(payload)) return false;
} else {
  game.socket.emit(ADD2E_FAMILIAR_SOCKET, { type: ADD2E_FAMILIAR_OPERATION, operation: "createFamiliar", payload });
}

return true;
