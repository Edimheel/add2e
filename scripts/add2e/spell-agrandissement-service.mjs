// ADD2E — Service canonique du sort Agrandissement / Rétrécissement.
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.

export const ADD2E_ENLARGE_SERVICE_VERSION = "2026-08-02-canonical-enlarge-service-v1";
const TRANSFORM_GROUP = "agrandissement-retrecissement";
const SPELL_SLUG = "agrandissement";

globalThis.ADD2E_ENLARGE_SERVICE_VERSION = ADD2E_ENLARGE_SERVICE_VERSION;

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function clone(value) {
  if (value === undefined) return undefined;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function modeLabel(mode) {
  return mode === "retrecissement" ? "Rétrécissement" : "Agrandissement";
}

function spellMode(spellItem) {
  return norm(spellItem?.name ?? spellItem?.system?.nom).startsWith("retrecissement")
    ? "retrecissement"
    : "agrandissement";
}

function magicianLevel(actor) {
  try {
    const canonical = Number(globalThis.add2eCanonicalClassLevel?.(actor, "magicien", 0));
    if (Number.isFinite(canonical) && canonical > 0) return Math.floor(canonical);
  } catch (_error) {}

  const classItem = Array.from(actor?.items ?? []).find(entry => {
    if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
    return [entry.name, entry.system?.slug, entry.system?.label, entry.system?.nom, entry.system?.name]
      .map(norm)
      .includes("magicien");
  }) ?? null;
  const classLevel = Number(classItem?.system?.niveau ?? classItem?.system?.level);
  if (Number.isFinite(classLevel) && classLevel > 0) return Math.floor(classLevel);

  const actorLevel = Number(actor?.system?.niveau ?? actor?.system?.level ?? 1);
  return Math.max(1, Math.floor(Number.isFinite(actorLevel) ? actorLevel : 1));
}

function casterToken(actor, token, args = []) {
  const direct = token?.document ? token : token?.object ?? token;
  if (direct) return direct;
  const fromArgs = Array.isArray(args) ? args[0]?.token ?? null : null;
  if (fromArgs) return fromArgs;
  return canvas?.tokens?.controlled?.find?.(entry => entry.actor?.id === actor?.id)
    ?? actor?.getActiveTokens?.()?.[0]
    ?? null;
}

function visibleTarget() {
  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (targets.length !== 1) {
    ui.notifications?.warn?.("Agrandissement : sélectionne exactement une cible visible.");
    return null;
  }
  const target = targets[0];
  if (target.document?.hidden === true && !game.user?.isGM) {
    ui.notifications?.warn?.("Agrandissement : la cible doit être visible.");
    return null;
  }
  return target;
}

function targetKind(target) {
  const actorType = norm(target?.actor?.type);
  return ["objet", "object", "item"].includes(actorType) ? "objet" : "creature";
}

function targetConsenting(target) {
  return norm(target?.actor?.type) !== "monster";
}

function metrics({ mode, kind, level }) {
  const percentage = kind === "objet"
    ? Math.min(100, Math.max(10, level * 10))
    : Math.min(200, Math.max(20, level * 20));
  const enlargementFactor = 1 + (percentage / 100);
  const factor = mode === "retrecissement" ? 1 / enlargementFactor : enlargementFactor;
  return {
    percentage,
    enlargementFactor,
    factor,
    displayPercent: Math.round(factor * 1000) / 10
  };
}

async function confirmCasting({ target, mode, level, kind, consenting }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications?.error?.("Agrandissement : DialogV2 est indisponible.");
    return null;
  }
  const values = metrics({ mode, kind, level });
  const label = modeLabel(mode);
  const variation = mode === "retrecissement"
    ? `${values.displayPercent} % de la taille normale`
    : `+${values.percentage} % · taille × ${values.enlargementFactor}`;
  const content = [
    '<form style="display:grid;gap:8px">',
    `<div><b>Cible :</b> ${escapeHtml(target?.name ?? "Cible")}</div>`,
    `<div><b>Variation :</b> ${escapeHtml(variation)}</div>`,
    `<div><b>Durée :</b> ${level} tour${level > 1 ? "s" : ""} (${level * 10} rounds)</div>`,
    consenting ? "" : "<div><b>Jet de protection :</b> Sorts</div>",
    "</form>"
  ].join("");
  return DialogV2.wait({
    window: { title: label },
    position: { width: 390 },
    content,
    modal: true,
    rejectClose: false,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: () => ({ kind, consenting })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ]
  });
}

function effectTags({ mode, kind, values, level }) {
  const shrinking = mode === "retrecissement";
  return [
    `sort:${shrinking ? "retrecissement" : "agrandissement"}`,
    "classe:magicien",
    "liste:magicien",
    "ecole:alteration",
    "type:taille",
    "reversible:retrecissement",
    `cible:${kind}`,
    shrinking ? "etat:retrecissement" : "etat:agrandissement",
    shrinking ? "taille:reduite" : "taille:agrandie",
    shrinking ? "poids:reduit" : "poids:augmente",
    shrinking ? "force_effective:reduite" : "force_effective:augmentee",
    `variation_reference_pct:${values.percentage}`,
    `facteur_taille:${String(values.factor).replace(".", "_")}`,
    `niveau_lanceur:${level}`,
    `duree_rounds:${level * 10}`
  ];
}

function buildEffectData({ actor, target, spellItem, mode, kind, level, values }) {
  const label = modeLabel(mode);
  const engine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  if (typeof engine?.effectData !== "function") return null;
  const detail = mode === "retrecissement"
    ? `Taille et poids ramenés à ${values.displayPercent} % de leur valeur normale.`
    : `Taille et poids augmentés de ${values.percentage} % (facteur ${values.displayPercent} %).`;
  const effect = engine.effectData({
    name: label,
    img: spellItem?.img ?? "icons/magic/control/debuff-energy-hold-teal.webp",
    origin: spellItem?.uuid ?? null,
    rounds: Math.max(10, level * 10),
    unit: "round",
    description: `${detail} La Force effective est signalée par les tags de l’effet, sans conversion chiffrée non décrite par le Manuel.`,
    tags: effectTags({ mode, kind, values, level }),
    changes: [],
    source: "spell",
    caster: actor,
    sourceItem: spellItem,
    endMessage: `${label} prend fin sur {actor}.`,
    extraFlags: {
      capabilityTransformation: {
        version: ADD2E_ENLARGE_SERVICE_VERSION,
        sourceKey: `spell:${SPELL_SLUG}`,
        kind: "size",
        size: mode === "retrecissement" ? "reduite" : "agrandie",
        factor: values.factor,
        mode,
        targetKind: kind
      },
      spell: {
        version: ADD2E_ENLARGE_SERVICE_VERSION,
        slug: SPELL_SLUG,
        name: label,
        class: "Magicien",
        level: 1,
        casterId: actor?.id ?? null,
        casterUuid: actor?.uuid ?? null,
        casterName: actor?.name ?? "",
        targetActorId: target?.actor?.id ?? null,
        targetTokenId: target?.document?.id ?? target?.id ?? null,
        targetKind: kind,
        mode,
        casterLevel: level,
        factor: values.factor,
        sourceItemId: spellItem?.id ?? null,
        sourceItemUuid: spellItem?.uuid ?? null
      }
    }
  });
  effect.type = "base";
  effect.system ??= {};
  effect.changes ??= [];
  return effect;
}

function canModifyActor(actor) {
  if (!actor) return false;
  if (game.user?.isGM) return true;
  try { return actor.isOwner === true || actor.testUserPermission?.(game.user, "OWNER") === true; }
  catch (_error) { return false; }
}

function canModifyToken(target) {
  const document = target?.document ?? target;
  if (!document) return false;
  if (game.user?.isGM) return true;
  try { return document.canUserModify?.(game.user, "update") === true; }
  catch (_error) { return false; }
}

function socketPayload(target, extra = {}) {
  const document = target?.document ?? target;
  return {
    sceneId: document?.parent?.id ?? canvas?.scene?.id ?? null,
    tokenId: document?.id ?? target?.id ?? null,
    actorId: target?.actor?.id ?? null,
    actorUuid: target?.actor?.uuid ?? null,
    ...extra
  };
}

function emitGmOperation(operation, payload) {
  const activeGm = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  if (!game.socket || (!game.user?.isGM && !activeGm)) {
    ui.notifications?.error?.("Agrandissement : aucun MJ actif ne peut appliquer cet effet.");
    return false;
  }
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...payload, fromUserId: game.user.id, sentAt: Date.now() }
  });
  return true;
}

async function applyTransformation({ target, effectData, values, mode }) {
  const actor = target?.actor;
  if (!actor || !effectData) return { ok: false, reason: "missing-target" };
  const existing = globalThis.add2eFindTokenTransformationEffects?.(actor, target, { group: TRANSFORM_GROUP }) ?? [];
  const opposite = existing.filter(effect => String(effect?.flags?.add2e?.tokenTransform?.mode ?? "") !== mode);

  if (canModifyActor(actor) && canModifyToken(target)) {
    if (opposite.length) {
      const removed = await globalThis.add2eDeleteTokenTransformationEffects?.(actor, opposite, { reason: "reverse-spell" });
      return removed?.ok ? { ok: true, cancelled: true, relayed: false } : { ok: false, reason: removed?.reason ?? "reverse-delete-failed" };
    }
    return globalThis.add2eApplyTimedTokenTransformation?.({
      actor,
      token: target,
      effectData,
      factor: values.factor,
      group: TRANSFORM_GROUP,
      mode,
      source: `spell:${SPELL_SLUG}`
    }) ?? { ok: false, reason: "transform-service-missing" };
  }

  if (existing.length) {
    if (opposite.length) {
      const emitted = emitGmOperation("deleteActiveEffects", socketPayload(target, {
        effectIds: opposite.map(effect => effect.id).filter(Boolean)
      }));
      return emitted ? { ok: true, cancelled: true, relayed: true } : { ok: false, reason: "relay-unavailable" };
    }
    ui.notifications?.warn?.(`${modeLabel(mode)} est déjà actif sur cette cible. Seul le MJ peut actuellement renouveler cet effet.`);
    return { ok: false, reason: "active-transform-without-permission" };
  }

  const prepared = globalThis.add2ePrepareTokenTransformation?.({
    token: target,
    factor: values.factor,
    group: TRANSFORM_GROUP,
    mode,
    source: `spell:${SPELL_SLUG}`
  });
  if (!prepared) return { ok: false, reason: "transform-service-missing" };
  const remoteEffect = clone(effectData);
  remoteEffect.flags ??= {};
  remoteEffect.flags.add2e ??= {};
  remoteEffect.flags.add2e.tokenTransform = prepared.transform;
  const effectSent = emitGmOperation("createActiveEffect", socketPayload(target, { effectData: remoteEffect }));
  const tokenSent = effectSent && emitGmOperation("updateToken", socketPayload(target, { updateData: prepared.updateData }));
  return tokenSent ? { ok: true, relayed: true, cancelled: false } : { ok: false, reason: "relay-unavailable" };
}

async function postCard({ actor, token, spellItem, target, mode, kind, level, values, outcome, detail, relayed = false }) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const label = modeLabel(mode);
  const ratio = mode === "retrecissement"
    ? `${values.displayPercent} % de la taille et du poids normaux`
    : `+${values.percentage} % de taille et de poids`;
  const body = [
    `<div>${escapeHtml(detail)}</div>`,
    relayed ? "<div><small>Application demandée au MJ.</small></div>" : "",
    '<details style="margin-top:7px"><summary>Règle du Manuel</summary>',
    '<div>Une créature visible varie de 20 % par niveau du magicien, jusqu’à 200 %. ',
    'Un objet visible varie de 10 % par niveau, jusqu’à 100 %. ',
    'Rétrécissement annule Agrandissement ou applique le rapport inverse. ',
    'Un acteur monstre a droit à un jet de protection contre les sorts.</div></details>'
  ].join("");
  const options = {
    actor,
    title: label,
    icon: "fas fa-up-right-and-down-left-from-center",
    variant: outcome === "EFFET ACTIF" ? "success" : "neutral",
    source: {
      name: actor?.name ?? token?.name ?? "Magicien",
      img: token?.document?.texture?.src ?? actor?.img,
      type: "Sort de magicien",
      meta: spellItem?.name ?? label
    },
    rows: [
      { label: "Cible", value: target?.name ?? "Cible" },
      { label: "Résultat", value: outcome },
      { label: "Variation", value: ratio },
      { label: "Durée", value: `${level} tour${level > 1 ? "s" : ""} (${level * 10} rounds)` }
    ],
    trustedBodyHtml: body,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor, token }),
      flags: {
        add2e: {
          version: ADD2E_ENLARGE_SERVICE_VERSION,
          spell: SPELL_SLUG,
          mode,
          targetKind: kind,
          factor: values.factor,
          percentage: values.percentage,
          targetActorUuid: target?.actor?.uuid ?? null,
          targetTokenId: target?.document?.id ?? target?.id ?? null
        }
      }
    }
  };
  const preview = build(options);
  if (!String(preview ?? "").trim()) throw new Error(`${label} : carte de chat vide.`);
  return create(options);
}

export async function add2eCastAgrandissement(context = {}) {
  const actor = context.actor ?? context.args?.[0]?.actor ?? null;
  const spellItem = context.item ?? context.sort ?? context.sourceItem ?? null;
  const token = casterToken(actor, context.token, context.args);
  if (!actor || !spellItem) {
    ui.notifications?.warn?.("Agrandissement : lanceur ou sort introuvable.");
    return false;
  }

  const target = visibleTarget();
  if (!target) return false;
  const mode = spellMode(spellItem);
  const level = magicianLevel(actor);
  const kind = targetKind(target);
  const consenting = targetConsenting(target);
  const choice = await confirmCasting({ target, mode, level, kind, consenting });
  if (!choice) return false;

  const values = metrics({ mode, kind: choice.kind, level });
  const effectData = buildEffectData({ actor, target, spellItem, mode, kind: choice.kind, level, values });
  if (!effectData) {
    ui.notifications?.error?.("Agrandissement : moteur de durée ADD2E indisponible.");
    return false;
  }

  if (choice.kind === "creature" && !choice.consenting) {
    const save = await globalThis.add2eRollSavingThrow?.(target.actor, {
      index: 4,
      label: "Sorts",
      sourceName: modeLabel(mode),
      token: target,
      createChat: true
    });
    if (!save?.ok) {
      ui.notifications?.error?.("Agrandissement : jet de protection contre les sorts introuvable pour cette cible.");
      return false;
    }
    if (save.success) {
      await postCard({
        actor,
        token,
        spellItem,
        target,
        mode,
        kind: choice.kind,
        level,
        values,
        outcome: "EFFET ANNULÉ",
        detail: "L’acteur monstre réussit son jet de protection contre les sorts."
      });
      return true;
    }
  }

  const application = await applyTransformation({ target, effectData, values, mode });
  if (!application?.ok) {
    console.error("[ADD2E][AGRANDISSEMENT][APPLY_FAILED]", {
      version: ADD2E_ENLARGE_SERVICE_VERSION,
      actor: actor.name,
      spell: spellItem.name,
      target: target.name,
      mode,
      application
    });
    ui.notifications?.error?.(`Agrandissement : l’effet n’a pas pu être appliqué (${application?.reason ?? "raison inconnue"}).`);
    return false;
  }

  await postCard({
    actor,
    token,
    spellItem,
    target,
    mode,
    kind: choice.kind,
    level,
    values,
    outcome: application.cancelled ? "EFFET ANNULÉ" : "EFFET ACTIF",
    detail: application.cancelled
      ? `${modeLabel(mode)} dissipe l’effet inverse déjà actif sur la cible.`
      : mode === "retrecissement"
        ? "La cible est réduite selon le rapport inverse calculé."
        : "La cible est agrandie selon la proportion calculée.",
    relayed: application.relayed === true
  });
  return true;
}

globalThis.add2eCastAgrandissement = add2eCastAgrandissement;
