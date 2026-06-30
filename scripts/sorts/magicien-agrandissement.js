// ADD2E — onUse Magicien : Agrandissement / Rétrécissement
// Compatible Foundry V13/V14/V15.
// Contrat : return true consomme le sort ; return false rembourse la réservation.
// Les composants, la durée, le jet de sauvegarde et la transformation de token
// sont délégués aux services génériques du système.

const ADD2E_SPELL = Object.freeze({
  name: "Agrandissement",
  slug: "agrandissement",
  level: 1,
  school: "Altération",
  range: "1/2\" par niveau",
  duration: "1 tour par niveau"
});

const ADD2E_TRANSFORM_GROUP = "agrandissement-retrecissement";

function add2eNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eEscapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function add2eClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eCurrentItem() {
  return typeof item !== "undefined" && item ? item : null;
}

function add2eCurrentActor() {
  if (typeof actor !== "undefined" && actor) return actor;
  return typeof args !== "undefined" && Array.isArray(args) ? args[0]?.actor ?? null : null;
}

function add2eCurrentToken() {
  if (typeof token !== "undefined" && token) return token;
  if (typeof args !== "undefined" && Array.isArray(args) && args[0]?.token) return args[0].token;
  const actorDoc = add2eCurrentActor();
  return canvas?.tokens?.controlled?.find?.(entry => entry.actor?.id === actorDoc?.id)
    ?? actorDoc?.getActiveTokens?.()?.[0]
    ?? null;
}

function add2eSpellMode(spellItem) {
  const key = add2eNormalize(spellItem?.name ?? spellItem?.system?.nom ?? "");
  return key.startsWith("retrecissement") ? "retrecissement" : "agrandissement";
}

function add2eModeLabel(mode) {
  return mode === "retrecissement" ? "Rétrécissement" : "Agrandissement";
}

function add2eMagicianLevel(casterActor) {
  try {
    const canonical = Number(globalThis.add2eCanonicalClassLevel?.(casterActor, "magicien", 0));
    if (Number.isFinite(canonical) && canonical > 0) return Math.floor(canonical);
  } catch (_error) {}

  const classItem = Array.from(casterActor?.items ?? []).find(entry => {
    if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
    const values = [entry.name, entry.system?.slug, entry.system?.label, entry.system?.nom, entry.system?.name];
    return values.map(add2eNormalize).includes("magicien");
  }) ?? null;

  const classLevel = Number(classItem?.system?.niveau ?? classItem?.system?.level);
  if (Number.isFinite(classLevel) && classLevel > 0) return Math.floor(classLevel);

  const actorLevel = Number(casterActor?.system?.niveau ?? casterActor?.system?.level ?? 1);
  return Math.max(1, Math.floor(Number.isFinite(actorLevel) ? actorLevel : 1));
}

function add2eExactlyOneVisibleTarget() {
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

function add2eTargetKind(targetToken) {
  const actorType = add2eNormalize(targetToken?.actor?.type);
  return ["objet", "object", "item"].includes(actorType) ? "objet" : "creature";
}

function add2eTargetIsConsenting(targetToken) {
  return add2eNormalize(targetToken?.actor?.type) !== "monster";
}

function add2eTransformationMetrics({ mode, targetKind, level }) {
  const percentage = targetKind === "objet"
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

async function add2eConfirmCasting({ target, mode, level, targetKind, consenting }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications?.error?.("Agrandissement : DialogV2 est indisponible.");
    return null;
  }

  const metrics = add2eTransformationMetrics({ mode, targetKind, level });
  const modeLabel = add2eModeLabel(mode);
  const targetLabel = target?.name ?? "Cible";
  const appliedLabel = mode === "retrecissement"
    ? `${metrics.displayPercent} % de la taille normale`
    : `+${metrics.percentage} % · taille × ${metrics.enlargementFactor}`;
  const saveLine = consenting
    ? ""
    : `<div style="margin-top:8px;padding:6px 8px;border-radius:5px;background:#f0e3f7;color:#54226a;font-size:11px;font-weight:700;text-align:center;">Jet de protection contre les sorts</div>`;

  const content = `
    <section class="add2e-dialog add2e-enlarge-dialog" style="width:270px;overflow:hidden;border:1px solid #7b3f98;border-radius:8px;background:#faf6fc;color:#36223d;">
      <header style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:linear-gradient(135deg,#351447,#6d2d82 70%,#8d4eac);color:#fff;">
        <span style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#ecdaf6;color:#4e1d64;font-weight:900;">✦</span>
        <span style="font-size:14px;font-weight:800;">${add2eEscapeHtml(modeLabel)}</span>
      </header>
      <div style="padding:10px 11px;">
        <div style="font-size:13px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${add2eEscapeHtml(targetLabel)}</div>
        <div style="margin-top:7px;color:#6b2d82;font-size:13px;font-weight:900;">${appliedLabel}</div>
        <div style="margin-top:4px;font-size:12px;color:#5f4768;">${level} tour${level > 1 ? "s" : ""} · ${level * 10} rounds</div>
        ${saveLine}
      </div>
    </section>`;

  return DialogV2.wait({
    window: { title: modeLabel },
    position: { width: 330 },
    content,
    modal: true,
    rejectClose: false,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        default: true,
        callback: () => ({ targetKind, consenting })
      },
      {
        action: "cancel",
        label: "Annuler",
        callback: () => null
      }
    ]
  });
}

function add2eCanModifyActor(actorDoc) {
  if (!actorDoc) return false;
  if (game.user?.isGM) return true;
  try { return actorDoc.isOwner === true || actorDoc.testUserPermission?.(game.user, "OWNER") === true; }
  catch (_error) { return false; }
}

function add2eCanModifyToken(targetToken) {
  const tokenDoc = targetToken?.document ?? targetToken;
  if (!tokenDoc) return false;
  if (game.user?.isGM) return true;
  try { return tokenDoc.canUserModify?.(game.user, "update") === true; }
  catch (_error) { return false; }
}

function add2eSocketPayload(targetToken, extra = {}) {
  const tokenDoc = targetToken?.document ?? targetToken;
  return {
    sceneId: tokenDoc?.parent?.id ?? canvas?.scene?.id ?? null,
    tokenId: tokenDoc?.id ?? targetToken?.id ?? null,
    actorId: targetToken?.actor?.id ?? null,
    actorUuid: targetToken?.actor?.uuid ?? null,
    ...extra
  };
}

function add2eEmitGmOperation(operation, payload) {
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  if (!game.socket || (!game.user?.isGM && !activeGM)) {
    ui.notifications?.error?.("Agrandissement : aucun MJ actif ne peut appliquer cet effet.");
    return false;
  }
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
  });
  return true;
}

function add2eEffectTags({ mode, targetKind, metrics, level }) {
  const shrinking = mode === "retrecissement";
  return [
    `sort:${shrinking ? "retrecissement" : "agrandissement"}`,
    "classe:magicien",
    "liste:magicien",
    "ecole:alteration",
    "type:taille",
    "reversible:retrecissement",
    `cible:${targetKind}`,
    shrinking ? "etat:retrecissement" : "etat:agrandissement",
    shrinking ? "taille:reduite" : "taille:agrandie",
    shrinking ? "poids:reduit" : "poids:augmente",
    shrinking ? "force_effective:reduite" : "force_effective:augmentee",
    `variation_reference_pct:${metrics.percentage}`,
    `facteur_taille:${String(metrics.factor).replace(".", "_")}`,
    `niveau_lanceur:${level}`,
    `duree_rounds:${level * 10}`
  ];
}

function add2eBuildEffectData({ casterActor, targetToken, spellItem, mode, targetKind, level, metrics }) {
  const modeLabel = add2eModeLabel(mode);
  const rounds = Math.max(10, level * 10);
  const tags = add2eEffectTags({ mode, targetKind, metrics, level });
  const engine = game.add2e?.time;
  if (typeof engine?.effectData !== "function") return null;

  const detail = mode === "retrecissement"
    ? `Taille et poids ramenés à ${metrics.displayPercent} % de leur valeur normale.`
    : `Taille et poids augmentés de ${metrics.percentage} % (facteur ${metrics.displayPercent} %).`;

  const effect = engine.effectData({
    name: modeLabel,
    img: spellItem?.img ?? "icons/magic/control/debuff-energy-hold-teal.webp",
    origin: spellItem?.uuid ?? null,
    rounds,
    unit: "round",
    description: `${detail} La Force effective est signalée par les tags de l’effet, sans conversion chiffrée non décrite par le Manuel.`,
    tags,
    changes: [],
    source: "spell",
    caster: casterActor,
    sourceItem: spellItem,
    endMessage: `${modeLabel} prend fin sur {actor}.`,
    extraFlags: {
      spell: {
        slug: ADD2E_SPELL.slug,
        name: modeLabel,
        class: "Magicien",
        level: ADD2E_SPELL.level,
        casterId: casterActor?.id ?? null,
        casterUuid: casterActor?.uuid ?? null,
        casterName: casterActor?.name ?? "",
        targetActorId: targetToken?.actor?.id ?? null,
        targetTokenId: targetToken?.document?.id ?? targetToken?.id ?? null,
        targetKind,
        mode,
        casterLevel: level,
        factor: metrics.factor,
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

async function add2eApplyTransformation({ targetToken, effectData, metrics, mode }) {
  const targetActor = targetToken?.actor;
  if (!targetActor || !effectData) return { ok: false, reason: "missing-target" };

  const existing = globalThis.add2eFindTokenTransformationEffects?.(targetActor, targetToken, { group: ADD2E_TRANSFORM_GROUP }) ?? [];
  const opposite = existing.filter(effect => String(effect?.flags?.add2e?.tokenTransform?.mode ?? "") !== mode);

  if (add2eCanModifyActor(targetActor) && add2eCanModifyToken(targetToken)) {
    return globalThis.add2eApplyTimedTokenTransformation?.({
      actor: targetActor,
      token: targetToken,
      effectData,
      factor: metrics.factor,
      group: ADD2E_TRANSFORM_GROUP,
      mode,
      source: `spell:${ADD2E_SPELL.slug}`
    }) ?? { ok: false, reason: "transform-service-missing" };
  }

  if (existing.length) {
    if (opposite.length) {
      const emitted = add2eEmitGmOperation("deleteActiveEffects", add2eSocketPayload(targetToken, {
        effectIds: opposite.map(effect => effect.id).filter(Boolean)
      }));
      return emitted ? { ok: true, cancelled: true, relayed: true } : { ok: false, reason: "relay-unavailable" };
    }

    ui.notifications?.warn?.(`${add2eModeLabel(mode)} est déjà actif sur cette cible. Seul le MJ peut actuellement renouveler cet effet.`);
    return { ok: false, reason: "active-transform-without-permission" };
  }

  const prepared = globalThis.add2ePrepareTokenTransformation?.({
    token: targetToken,
    factor: metrics.factor,
    group: ADD2E_TRANSFORM_GROUP,
    mode,
    source: `spell:${ADD2E_SPELL.slug}`
  });
  if (!prepared) return { ok: false, reason: "transform-service-missing" };

  const remoteEffect = add2eClone(effectData);
  remoteEffect.flags ??= {};
  remoteEffect.flags.add2e ??= {};
  remoteEffect.flags.add2e.tokenTransform = prepared.transform;

  const effectSent = add2eEmitGmOperation("createActiveEffect", add2eSocketPayload(targetToken, { effectData: remoteEffect }));
  const tokenSent = effectSent && add2eEmitGmOperation("updateToken", add2eSocketPayload(targetToken, { updateData: prepared.updateData }));
  return tokenSent ? { ok: true, relayed: true, cancelled: false } : { ok: false, reason: "relay-unavailable" };
}

async function add2ePostSpellCard({ casterActor, casterToken, spellItem, targetToken, mode, targetKind, level, metrics, outcome, detail, relayed = false }) {
  const casterName = casterActor?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? casterActor?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = spellItem?.img ?? "icons/svg/book.svg";
  const modeLabel = add2eModeLabel(mode);
  const ratioLine = mode === "retrecissement"
    ? `Rapport inverse : <b>${metrics.displayPercent} %</b> de la taille et du poids normaux.`
    : `Variation : <b>+${metrics.percentage} %</b> de taille et de poids.`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort" style="border:1px solid #7b3f98;border-radius:8px;overflow:hidden;background:#f8f2fb;color:#34203d;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#351447,#6d2d82 65%,#8d4eac);color:#fff;padding:7px 9px;">
          <img src="${add2eEscapeHtml(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #ecdaf6;background:#fff;" />
          <div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${add2eEscapeHtml(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${add2eEscapeHtml(modeLabel)}</div></div>
          <img src="${add2eEscapeHtml(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #ecdaf6;background:#fff;" />
        </div>
        <div style="padding:9px 10px 10px;background:#f8f2fb;">
          <div style="font-size:13px;margin:0 0 6px 0;"><b>Cible :</b> ${add2eEscapeHtml(targetToken?.name ?? "Cible")}</div>
          <div style="border:1px solid #b77bd0;border-radius:6px;background:#fffaff;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#6b2d82;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${add2eEscapeHtml(outcome)}</div>
            <div style="font-size:13px;line-height:1.35;text-align:center;">${detail}</div>
          </div>
          <div style="font-size:12px;line-height:1.4;"><b>${targetKind === "objet" ? "Objet" : "Créature vivante"}</b> — ${ratioLine}<br />Durée : <b>${level} tour${level > 1 ? "s" : ""}</b> (${level * 10} rounds).${relayed ? "<br />Application demandée au MJ." : ""}</div>
          <details style="margin-top:7px;border:1px solid #b77bd0;border-radius:5px;background:#fffaff;padding:5px 7px;"><summary style="cursor:pointer;font-weight:800;color:#54226a;">Règle du Manuel</summary><div style="margin-top:5px;font-size:12px;line-height:1.35;">Une créature visible varie de 20 % par niveau du magicien, jusqu’à 200 %. Un objet visible varie de 10 % par niveau, jusqu’à 100 %. Rétrécissement annule Agrandissement ou applique le rapport inverse. Un acteur monstre a droit à un jet de protection contre les sorts.</div></details>
        </div>
      </div>`
  });
}

const casterActor = add2eCurrentActor();
const spellItem = add2eCurrentItem();
const casterToken = add2eCurrentToken();
if (!casterActor || !spellItem) {
  ui.notifications?.warn?.("Agrandissement : lanceur ou sort introuvable.");
  return false;
}

const targetToken = add2eExactlyOneVisibleTarget();
if (!targetToken) return false;

const mode = add2eSpellMode(spellItem);
const level = add2eMagicianLevel(casterActor);
const targetKind = add2eTargetKind(targetToken);
const consenting = add2eTargetIsConsenting(targetToken);
const choice = await add2eConfirmCasting({ target: targetToken, mode, level, targetKind, consenting });
if (!choice) return false;

const metrics = add2eTransformationMetrics({ mode, targetKind: choice.targetKind, level });
const effectData = add2eBuildEffectData({
  casterActor,
  targetToken,
  spellItem,
  mode,
  targetKind: choice.targetKind,
  level,
  metrics
});
if (!effectData) {
  ui.notifications?.error?.("Agrandissement : moteur de durée ADD2E indisponible.");
  return false;
}

if (choice.targetKind === "creature" && !choice.consenting) {
  const save = await globalThis.add2eRollSavingThrow?.(targetToken.actor, {
    index: 4,
    label: "Sorts",
    sourceName: add2eModeLabel(mode),
    token: targetToken,
    createChat: true
  });
  if (!save?.ok) {
    ui.notifications?.error?.("Agrandissement : jet de protection contre les sorts introuvable pour cette cible.");
    return false;
  }
  if (save.success) {
    await add2ePostSpellCard({
      casterActor,
      casterToken,
      spellItem,
      targetToken,
      mode,
      targetKind: choice.targetKind,
      level,
      metrics,
      outcome: "EFFET ANNULÉ",
      detail: "L’acteur monstre réussit son jet de protection contre les sorts."
    });
    return true;
  }
}

const application = await add2eApplyTransformation({ targetToken, effectData, metrics, mode });
if (!application?.ok) {
  ui.notifications?.error?.("Agrandissement : l’effet n’a pas pu être appliqué.");
  return false;
}

await add2ePostSpellCard({
  casterActor,
  casterToken,
  spellItem,
  targetToken,
  mode,
  targetKind: choice.targetKind,
  level,
  metrics,
  outcome: application.cancelled ? "EFFET ANNULÉ" : "EFFET ACTIF",
  detail: application.cancelled
    ? `${add2eModeLabel(mode)} dissipe l’effet inverse déjà actif sur la cible.`
    : mode === "retrecissement"
      ? "La cible est réduite selon le rapport inverse calculé."
      : "La cible est agrandie selon la proportion calculée.",
  relayed: application.relayed === true
});

return true;