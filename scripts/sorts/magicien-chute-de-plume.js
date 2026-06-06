// ADD2E — onUse Magicien niveau 1 : Chute de plume
// Version : 2026-06-06-magicien-chute-plume-time-engine-v1
//
// Contrat : true = sort consommé, false = sort non consommé.
// Source règle : Manuel des joueurs, magicien niveau 1, durée 1 segment/niveau.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][CHUTE_PLUME]";
const ADD2E_ITEM = typeof item !== "undefined" ? item : (typeof sort !== "undefined" ? sort : (typeof spell !== "undefined" ? spell : null));
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : ADD2E_ITEM?.parent ?? null;
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];

const ADD2E_SORT_CONFIG = {
  name: "Chute de plume",
  slug: "chute_de_plume",
  level: 1,
  school: "Altération",
  rangeText: "1\"/niveau",
  durationText: "1 segment/niveau",
  castingTimeText: "1 segment",
  saveText: "Aucun",
  areaText: "créature(s) ou objet(s), 27 m³ et 100 kg + 100 kg/niveau",
  imgFallback: "icons/magic/air/wind-tornado-funnel-blue.webp"
};

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eCasterLevel(actorDoc) {
  return Number(
    actorDoc?.system?.niveau ??
    actorDoc?.system?.level ??
    actorDoc?.system?.details?.niveau ??
    actorDoc?.system?.details?.level ??
    1
  ) || 1;
}

function add2eGetCasterToken(actorDoc) {
  return ADD2E_TOKEN
    ?? ADD2E_ARGS?.[0]?.token
    ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id)
    ?? actorDoc?.getActiveTokens?.()?.[0]
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eTimeApi() {
  return game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
}

function add2eDurationRounds(level) {
  const time = add2eTimeApi();
  return time?.toRounds?.("level", "segment", { level }) ?? Math.max(1, Math.ceil(Math.max(1, Number(level) || 1) / 10));
}

function add2eDurationData(rounds) {
  const time = add2eTimeApi();
  return time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

function add2eChatStyleData() {
  return CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function add2eSpellImg() {
  return ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.imgFallback;
}

function add2eEmitGmOperation(operation, payload) {
  game.socket?.emit?.("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: {
      ...(payload ?? {}),
      fromUserId: game.user?.id ?? null,
      sentAt: Date.now()
    }
  });
}

function add2eEffectTags(rounds, level) {
  return [
    "classe:magicien",
    "liste:magicien",
    "niveau:1",
    "sort:chute_de_plume",
    "ecole:alteration",
    "type:mouvement",
    "type:protection_chute",
    "chute:plume",
    "degats_chute:annules",
    "vitesse_chute:0_60m_par_seconde",
    "duree:1_segment_par_niveau",
    `duree_segments:${Math.max(1, Number(level) || 1)}`,
    `duree_rounds:${rounds}`
  ];
}

function add2eTimeFlags({ caster, targetActor, rounds, level, note }) {
  const tags = add2eEffectTags(rounds, level);
  const time = add2eTimeApi();
  return time?.flags?.({
    source: "magicien-chute-de-plume.js",
    rounds,
    unit: "round",
    endMessage: "La chute de plume de {actor} prend fin.",
    extra: {
      spellName: ADD2E_SORT_CONFIG.name,
      spellKey: ADD2E_SORT_CONFIG.slug,
      spellList: "wizard",
      sourceItemId: ADD2E_ITEM?.id ?? null,
      sourceItemUuid: ADD2E_ITEM?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      originalDurationSegments: Math.max(1, Number(level) || 1),
      convertedRounds: rounds,
      note: note ?? "",
      tags
    }
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: rounds },
    roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "La chute de plume de {actor} prend fin." },
    endMessage: "La chute de plume de {actor} prend fin.",
    spellName: ADD2E_SORT_CONFIG.name,
    spellKey: ADD2E_SORT_CONFIG.slug,
    spellList: "wizard",
    sourceItemId: ADD2E_ITEM?.id ?? null,
    sourceItemUuid: ADD2E_ITEM?.uuid ?? null,
    casterId: caster?.id ?? null,
    casterUuid: caster?.uuid ?? null,
    targetId: targetActor?.id ?? null,
    targetUuid: targetActor?.uuid ?? null,
    originalDurationSegments: Math.max(1, Number(level) || 1),
    convertedRounds: rounds,
    note: note ?? "",
    tags
  };
}

function add2eEffectData({ caster, targetActor, rounds, level, note }) {
  const timeFlags = add2eTimeFlags({ caster, targetActor, rounds, level, note });
  const tags = timeFlags.tags ?? add2eEffectTags(rounds, level);

  return {
    name: ADD2E_SORT_CONFIG.name,
    img: add2eSpellImg(),
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    origin: ADD2E_ITEM?.uuid ?? null,
    changes: [],
    duration: add2eDurationData(rounds),
    description: `La cible devient aussi légère qu’une plume. Elle chute lentement et ne subit pas de dégâts de chute pendant ${Math.max(1, Number(level) || 1)} segment(s), convertis en ${rounds} round(s) pour le moteur de combat.`,
    flags: {
      add2e: {
        ...timeFlags,
        tags,
        spell: {
          slug: ADD2E_SORT_CONFIG.slug,
          name: ADD2E_SORT_CONFIG.name,
          level: ADD2E_SORT_CONFIG.level,
          school: ADD2E_SORT_CONFIG.school,
          casterId: caster?.id ?? null,
          casterUuid: caster?.uuid ?? null,
          targetId: targetActor?.id ?? null,
          targetUuid: targetActor?.uuid ?? null,
          durationSegments: Math.max(1, Number(level) || 1),
          durationRounds: rounds,
          noFallDamage: true,
          fallSpeedMetersPerSecond: 0.6,
          note: note ?? ""
        }
      }
    }
  };
}

function add2eEffectIsFeatherFall(effect) {
  const tags = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
  const list = Array.isArray(tags) ? tags : String(tags).split(/[,;|\n]+/);
  return list.includes("sort:chute_de_plume") || effect?.flags?.add2e?.spell?.slug === ADD2E_SORT_CONFIG.slug;
}

async function add2eApplyEffect(targetActor, effectData) {
  if (!targetActor || !effectData) return false;

  if (game.user?.isGM || targetActor.isOwner) {
    const oldIds = Array.from(targetActor.effects ?? [])
      .filter(add2eEffectIsFeatherFall)
      .map(e => e.id)
      .filter(Boolean);
    if (oldIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
    await targetActor.createEmbeddedDocuments("ActiveEffect", [foundry.utils.deepClone(effectData)]);
    return true;
  }

  add2eEmitGmOperation("createActiveEffect", {
    actorUuid: targetActor.uuid,
    actorId: targetActor.id,
    sceneId: canvas?.scene?.id ?? null,
    effectData
  });
  return true;
}

async function add2eAskDialog({ caster, targets, level, rounds }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("Chute de plume : DialogV2 introuvable.");
    return null;
  }

  const targetList = targets.length ? targets.map(t => `<li>${add2eHtmlEscape(t.name)}</li>`).join("") : "<li>Aucune cible</li>";
  return await DialogV2.wait({
    window: { title: "Lancement : Chute de plume" },
    add2eTheme: "wizard",
    add2eImg: add2eSpellImg(),
    content: `
      <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
        <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;">
          <div><b>Lanceur :</b> ${add2eHtmlEscape(caster?.name ?? "Magicien")}</div>
          <div><b>Durée règle :</b> ${level} segment(s).</div>
          <div><b>Durée moteur :</b> ${rounds} round(s).</div>
          <div><b>Cibles :</b><ul style="margin:4px 0 0 18px;">${targetList}</ul></div>
        </div>
        <div class="form-group">
          <label style="font-weight:bold;">Note / contexte de chute :</label>
          <textarea name="note" rows="3" style="width:100%;" placeholder="Ex. chute depuis une corniche, projectile propulsé, objet lancé..."></textarea>
        </div>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-feather",
        default: true,
        callback: (event, button) => ({ note: String(button.form.elements.note?.value ?? "") })
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
}

async function add2eChat({ caster, targets, level, rounds, note }) {
  const casterToken = add2eGetCasterToken(caster);
  const casterName = caster?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = add2eSpellImg();
  const targetLabel = targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-chute-plume"
           style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
          <img src="${add2eHtmlEscape(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${add2eHtmlEscape(casterName)}</div>
            <div style="font-size:12px;font-weight:700;">lance ${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
          <img src="${add2eHtmlEscape(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
        </div>
        <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;text-align:center;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">Chute ralentie</div>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">Cible(s) : ${targetLabel}</p>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Durée règle :</b> ${level} segment(s). <b>Durée moteur :</b> ${rounds} round(s).</p>
            ${note ? `<p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Note :</b> ${add2eHtmlEscape(note)}</p>` : ""}
          </div>
          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Règle appliquée</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p>La vitesse de chute est réduite à 60 cm par seconde et aucun dégât n’est subi à l’arrivée au sol tant que l’effet dure.</p>
              <p>À l’expiration, la chute redevient normale si elle n’est pas terminée.</p>
            </div>
          </details>
        </div>
      </div>`,
    ...add2eChatStyleData()
  });
}

if (!ADD2E_ACTOR) {
  ui.notifications.warn("Chute de plume : acteur lanceur introuvable.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_ACTOR]`);
  return false;
}

const casterToken = add2eGetCasterToken(ADD2E_ACTOR);
const targets = Array.from(game.user?.targets ?? []);
if (!targets.length && casterToken) targets.push(casterToken);

const validTargets = targets.filter(t => t?.actor);
if (!validTargets.length) {
  ui.notifications.warn("Chute de plume : cible au moins une créature ou sélectionne le lanceur.");
  return false;
}

const level = add2eCasterLevel(ADD2E_ACTOR);
const rounds = add2eDurationRounds(level);
const choice = await add2eAskDialog({ caster: ADD2E_ACTOR, targets: validTargets, level, rounds });
if (!choice) return false;

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  level,
  durationSegments: level,
  durationRounds: rounds,
  targets: validTargets.map(t => t.name)
});

for (const target of validTargets) {
  const data = add2eEffectData({
    caster: ADD2E_ACTOR,
    targetActor: target.actor,
    rounds,
    level,
    note: choice.note
  });
  await add2eApplyEffect(target.actor, data);
}

try {
  await globalThis.ADD2E_PLAY_SPELL_FX?.("chute_de_plume", {
    casterToken,
    targetTokens: validTargets
  });
} catch (err) {
  console.warn(`${ADD2E_ONUSE_TAG}[VFX_IGNORED]`, err);
}

await add2eChat({ caster: ADD2E_ACTOR, targets: validTargets, level, rounds, note: choice.note });

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  durationRounds: rounds
});

return true;
