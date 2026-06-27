// ADD2E — onUse Magicien : Invocation d’un familier
// Compatible Foundry V13/V14/V15.
// Le tirage est fait immédiatement par le lanceur ; la création world est relayée au MJ responsable.

const ADD2E_FAMILIAR_ONUSE_VERSION = "2026-06-27-familiar-immediate-roll-v1";
const ADD2E_FAMILIAR_SOCKET = "system.add2e";
const ADD2E_FAMILIAR_OPERATION = "ADD2E_GM_OPERATION";
const ADD2E_FAMILIAR_RANGE = 12;

const ADD2E_NORMAL_FAMILIARS = [
  {
    max: 4,
    key: "chat_noir",
    label: "Chat noir",
    img: "icons/creatures/mammals/cat-black.webp",
    senses: "Excellente vision nocturne et ouïe supérieure.",
    tags: ["familier:sens:vision_nocturne", "familier:sens:ouie_superieure"]
  },
  {
    max: 6,
    key: "corbeau",
    label: "Corbeau",
    img: "icons/creatures/birds/crow-flying-black.webp",
    senses: "Vision excellente.",
    tags: ["familier:sens:vision_excellente"]
  },
  {
    max: 8,
    key: "faucon",
    label: "Faucon",
    img: "icons/creatures/birds/hawk-flying-brown.webp",
    senses: "Vision de loin exceptionnelle.",
    tags: ["familier:sens:vision_lointaine_exceptionnelle"]
  },
  {
    max: 10,
    key: "hibou",
    label: "Hibou / chat huant",
    img: "icons/creatures/birds/owl-flying-brown.webp",
    senses: "Vision nocturne égale à la vision diurne humaine et ouïe supérieure.",
    tags: ["familier:sens:vision_nocturne_humaine_diurne", "familier:sens:ouie_superieure"]
  },
  {
    max: 12,
    key: "crapaud",
    label: "Crapaud",
    img: "icons/creatures/amphibians/frog-green.webp",
    senses: "Angle de vision très large.",
    tags: ["familier:sens:vision_angle_large"]
  },
  {
    max: 14,
    key: "belette",
    label: "Belette",
    img: "icons/creatures/mammals/weasel-tan.webp",
    senses: "Ouïe supérieure et odorat exceptionnel.",
    tags: ["familier:sens:ouie_superieure", "familier:sens:odorat_exceptionnel"]
  }
];

const ADD2E_SPECIAL_FAMILIARS = {
  quasit: {
    key: "quasit",
    label: "Quasit",
    aliases: ["quasit"],
    img: "icons/creatures/abilities/demon-winged-horned-yellow.webp",
    description: "Lien télépathique, impressions sensorielles, infravision, résistance à la magie de 25 %, régénération et avantage de niveau selon le Bestiaire.",
    tags: ["familier:quasit", "familier:lien_telepathique", "familier:partage_sens", "familier:sens:infravision", "resistance:magie:25", "familier:regeneration:1_round", "familier:bonus_niveau:1"]
  },
  pseudo_dragon: {
    key: "pseudo_dragon",
    label: "Pseudo-dragon",
    aliases: ["pseudo-dragon", "pseudo dragon", "dragonet, pseudo-dragon", "dragonet pseudo-dragon"],
    img: "icons/creatures/reptiles/dragon-horned-blue.webp",
    description: "Lien télépathique et partage des sens ; les pouvoirs magiques du pseudo-dragon sont disponibles selon le Bestiaire.",
    tags: ["familier:pseudo_dragon", "familier:lien_telepathique", "familier:partage_sens", "familier:sens:telepathie", "resistance:magie:35"]
  },
  lutin: {
    key: "lutin",
    label: "Lutin",
    aliases: ["lutin"],
    img: "icons/creatures/humanoids/elf-forest-green.webp",
    description: "Dextérité féerique, jamais surpris et +2 à tous les jets de protection.",
    tags: ["familier:lutin", "familier:jamais_surpris", "immunite:surprise", "bonus_save:2"],
    dexterityTo18: true
  },
  diablotin: {
    key: "diablotin",
    label: "Diablotin",
    aliases: ["diablotin", "imp"],
    img: "icons/creatures/abilities/demon-winged-horned-red.webp",
    description: "Lien télépathique, impressions sensorielles, infravision, résistance à la magie de 25 %, régénération et avantage de niveau selon le Bestiaire.",
    tags: ["familier:diablotin", "familier:lien_telepathique", "familier:partage_sens", "familier:sens:infravision", "resistance:magie:25", "familier:regeneration:1_round", "familier:bonus_niveau:1"]
  }
};

function add2eFamiliarNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eFamiliarEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eFamiliarCasterToken(caster) {
  const contextual = (typeof token !== "undefined" && token) ? token : null;
  return contextual
    ?? canvas?.tokens?.controlled?.find?.(entry => entry?.actor?.id === caster?.id)
    ?? caster?.getActiveTokens?.()?.[0]
    ?? null;
}

function add2eFamiliarActorLevel(caster) {
  const value = Number(caster?.system?.niveau ?? caster?.system?.level ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function add2eFamiliarAlignment(caster) {
  return add2eFamiliarNorm(
    caster?.system?.alignement
    ?? caster?.system?.alignment
    ?? caster?.system?.details?.alignement
    ?? caster?.system?.details?.alignment
    ?? ""
  );
}

function add2eFamiliarSpecialForAlignment(alignment) {
  const a = add2eFamiliarNorm(alignment);
  const loyal = a.includes("loyal");
  const chaotic = a.includes("chaotique");
  const good = a.includes("bon");
  const evil = a.includes("mauvais");
  const neutral = a === "neutre" || a.includes("neutre");

  if (chaotic && (evil || neutral)) return ADD2E_SPECIAL_FAMILIARS.quasit;
  if (loyal && evil) return ADD2E_SPECIAL_FAMILIARS.diablotin;
  if (neutral && evil) return ADD2E_SPECIAL_FAMILIARS.diablotin;
  if (loyal && (neutral || good)) return ADD2E_SPECIAL_FAMILIARS.lutin;
  if (a === "neutre" || (chaotic && good) || (neutral && good)) return ADD2E_SPECIAL_FAMILIARS.pseudo_dragon;
  return null;
}

function add2eFamiliarNormalForRoll(value) {
  return ADD2E_NORMAL_FAMILIARS.find(entry => value <= entry.max) ?? null;
}

function add2eFamiliarExistingLink(caster) {
  return caster?.getFlag?.("add2e", "familiar") ?? caster?.flags?.add2e?.familiar ?? null;
}

async function add2eFamiliarRoll(formula) {
  const roll = await new Roll(formula).evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return roll;
}

async function add2eFamiliarChat(caster, casterToken, html) {
  const style = CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
      <div class="add2e-spell-card" style="border:1px solid #8e63c7;border-radius:10px;overflow:hidden;background:#f8f3ff;color:#2d2144;">
        <div style="display:flex;align-items:center;gap:9px;padding:8px 10px;background:#5b3f8c;color:#fff;">
          <img src="${add2eFamiliarEscape(item?.img ?? "icons/svg/book.svg")}" style="width:34px;height:34px;border:1px solid #d8c3ff;border-radius:4px;background:#fff;object-fit:cover;">
          <div><b>${add2eFamiliarEscape(caster?.name ?? "Magicien")}</b><br><span style="font-size:.88em;">Invocation d’un familier</span></div>
        </div>
        <div style="padding:10px;">${html}</div>
      </div>`,
    ...style
  });
}

const caster = (typeof actor !== "undefined" && actor) ? actor : null;
const casterToken = add2eFamiliarCasterToken(caster);

if (!caster || caster.type !== "personnage") {
  ui.notifications.warn("Invocation d’un familier : le lanceur doit être un personnage.");
  return false;
}

if (!casterToken?.document) {
  ui.notifications.warn("Invocation d’un familier : le magicien doit avoir un token sur la scène.");
  return false;
}

const previous = add2eFamiliarExistingLink(caster);
if (previous?.actorId && game.actors?.get?.(previous.actorId)) {
  ui.notifications.warn(`${caster.name} possède déjà un familier.`);
  return false;
}

const level = add2eFamiliarActorLevel(caster);
const primary = await add2eFamiliarRoll("1d20");
const levelModifier = Math.floor(level / 3);
const adjusted = Math.max(1, Number(primary.total) - levelModifier);

let confirm = null;
let familiar = null;
let normal = false;
let hp = null;
let failureReason = "";

// Table du Manuel : le d20 détermine si un familier est dans la portée.
// Après ajustement de niveau, un résultat de 15 ou moins impose un second jet de d16
// qui détermine le familier final (16 = aucun familier).
if (adjusted > 15) {
  failureReason = "Aucun familier n’est dans la portée du sort.";
} else {
  confirm = await add2eFamiliarRoll("1d16");
  const finalResult = Number(confirm.total);

  if (finalResult === 16) {
    failureReason = "Aucun familier n’est dans la portée du sort.";
  } else if (finalResult === 15) {
    familiar = add2eFamiliarSpecialForAlignment(add2eFamiliarAlignment(caster));
    if (!familiar) failureReason = `L’alignement « ${caster.system?.alignement ?? "non renseigné"} » ne permet pas de déterminer le familier spécial.`;
  } else {
    familiar = add2eFamiliarNormalForRoll(finalResult);
    normal = !!familiar;
    if (familiar) {
      const hpRoll = await add2eFamiliarRoll("1d3+1");
      hp = Number(hpRoll.total);
    }
  }
}

if (!familiar) {
  const confirmLine = confirm ? `<div><b>Tirage final 1d16 :</b> ${confirm.total}</div>` : "";
  await add2eFamiliarChat(caster, casterToken, `
    <div style="text-align:center;color:#8a1f18;font-weight:900;">AUCUN FAMILIER</div>
    <div style="margin-top:6px;"><b>Jet 1d20 :</b> ${primary.total}${levelModifier ? ` − ${levelModifier} (niveaux) = <b>${adjusted}</b>` : ` = <b>${adjusted}</b>`}</div>
    ${confirmLine}
    <p style="margin:.55em 0 0;">${add2eFamiliarEscape(failureReason || "Le tirage ne permet pas de déterminer un familier.")}</p>
  `);
  return true;
}

const requestId = `familiar-${caster.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const payload = {
  requestId,
  sceneId: casterToken.document.parent?.id ?? canvas?.scene?.id ?? null,
  casterActorId: caster.id,
  casterActorUuid: caster.uuid,
  casterTokenId: casterToken.document.id,
  casterTokenUuid: casterToken.document.uuid,
  familiar: {
    key: familiar.key,
    label: familiar.label,
    img: familiar.img,
    aliases: familiar.aliases ?? [familiar.label],
    special: familiar === ADD2E_SPECIAL_FAMILIARS.quasit
      || familiar === ADD2E_SPECIAL_FAMILIARS.pseudo_dragon
      || familiar === ADD2E_SPECIAL_FAMILIARS.lutin
      || familiar === ADD2E_SPECIAL_FAMILIARS.diablotin,
    normal,
    hp,
    armorClass: normal ? 7 : null,
    senses: familiar.senses ?? familiar.description ?? "",
    tags: familiar.tags ?? [],
    dexterityTo18: familiar.dexterityTo18 === true,
    range: ADD2E_FAMILIAR_RANGE
  },
  roll: {
    primary: Number(primary.total),
    levelModifier,
    adjusted,
    confirm: confirm ? Number(confirm.total) : null
  }
};

const detail = normal
  ? `Familier normal : <b>${add2eFamiliarEscape(familiar.label)}</b> — CA 7, ${hp} PV.`
  : `Familier spécial : <b>${add2eFamiliarEscape(familiar.label)}</b>.`;

await add2eFamiliarChat(caster, casterToken, `
  <div style="text-align:center;color:#2f8f46;font-weight:900;">FAMILIER INVOQUÉ</div>
  <div style="margin-top:6px;"><b>Jet 1d20 :</b> ${primary.total}${levelModifier ? ` − ${levelModifier} (niveaux) = <b>${adjusted}</b>` : ` = <b>${adjusted}</b>`}</div>
  ${confirm ? `<div><b>Tirage final 1d16 :</b> ${confirm.total}</div>` : ""}
  <p style="margin:.55em 0 0;">${detail}</p>
  <p style="margin:.35em 0 0;">Le familier suit le magicien par défaut. Ses effets sont actifs à 12 cases ou moins.</p>
`);

if (game.user?.isGM && game.user?.isActiveGM && typeof globalThis.add2eCreateFamiliar === "function") {
  const created = await globalThis.add2eCreateFamiliar(payload);
  if (!created) return false;
} else {
  game.socket.emit(ADD2E_FAMILIAR_SOCKET, {
    type: ADD2E_FAMILIAR_OPERATION,
    operation: "createFamiliar",
    payload
  });
}

return true;
