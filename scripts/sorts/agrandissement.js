// ADD2E — onUse autonome : Agrandissement / Rétrécissement.
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.

return await (async () => {
  const VERSION = "2026-08-02-agrandissement-onuse-v3";
  const TRANSFORM_GROUP = "agrandissement-retrecissement";
  const SPELL_SLUG = "agrandissement";

  const norm = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const escapeHtml = value => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };

  const clone = value => {
    if (value === undefined) return undefined;
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
    if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
    return JSON.parse(JSON.stringify(value));
  };

  const modeLabel = mode => mode === "retrecissement" ? "Rétrécissement" : "Agrandissement";

  const spellItem = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (typeof sourceItem !== "undefined" && sourceItem)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.item ?? args[0]?.sort ?? args[0]?.sourceItem : null)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || spellItem?.parent
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.actor : null)
    || null;
  const casterToken = (typeof token !== "undefined" && token)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.token : null)
    || canvas?.tokens?.controlled?.find?.(entry => entry.actor?.id === caster?.id)
    || caster?.getActiveTokens?.()?.[0]
    || null;

  if (!caster || !spellItem) {
    ui.notifications?.warn?.("Agrandissement : lanceur ou sort introuvable.");
    return false;
  }

  const mode = norm(spellItem.name ?? spellItem.system?.nom).startsWith("retrecissement")
    ? "retrecissement"
    : "agrandissement";
  const label = modeLabel(mode);

  let casterLevel = 0;
  try {
    casterLevel = Number(globalThis.add2eCanonicalClassLevel?.(caster, "magicien", 0)) || 0;
  } catch (_error) {}
  if (casterLevel < 1) {
    const classItem = Array.from(caster.items ?? []).find(entry => {
      if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
      return [entry.name, entry.system?.slug, entry.system?.label, entry.system?.nom, entry.system?.name]
        .map(norm)
        .includes("magicien");
    }) ?? null;
    casterLevel = Number(classItem?.system?.niveau ?? classItem?.system?.level) || 0;
  }
  if (casterLevel < 1) casterLevel = Number(caster.system?.niveau ?? caster.system?.level ?? 1) || 1;
  casterLevel = Math.max(1, Math.floor(casterLevel));

  const targets = Array.from(game.user?.targets ?? []).filter(entry => entry?.actor);
  if (targets.length !== 1) {
    ui.notifications?.warn?.(`${label} : sélectionne exactement une cible visible.`);
    return false;
  }
  const target = targets[0];
  if (target.document?.hidden === true && !game.user?.isGM) {
    ui.notifications?.warn?.(`${label} : la cible doit être visible.`);
    return false;
  }

  const targetKind = ["objet", "object", "item"].includes(norm(target.actor?.type)) ? "objet" : "creature";
  const consenting = norm(target.actor?.type) !== "monster";
  const percentage = targetKind === "objet"
    ? Math.min(100, Math.max(10, casterLevel * 10))
    : Math.min(200, Math.max(20, casterLevel * 20));
  const enlargementFactor = 1 + (percentage / 100);
  const factor = mode === "retrecissement" ? 1 / enlargementFactor : enlargementFactor;
  const displayPercent = Math.round(factor * 1000) / 10;
  const durationRounds = Math.max(10, casterLevel * 10);

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications?.error?.(`${label} : DialogV2 est indisponible.`);
    return false;
  }

  const variation = mode === "retrecissement"
    ? `${displayPercent} % de la taille normale`
    : `+${percentage} % · taille × ${enlargementFactor}`;
  const choice = await DialogV2.wait({
    window: { title: label },
    position: { width: 390 },
    content: [
      '<form style="display:grid;gap:8px">',
      `<div><b>Cible :</b> ${escapeHtml(target.name ?? "Cible")}</div>`,
      `<div><b>Variation :</b> ${escapeHtml(variation)}</div>`,
      `<div><b>Durée :</b> ${casterLevel} tour${casterLevel > 1 ? "s" : ""} (${durationRounds} rounds)</div>`,
      consenting ? "" : "<div><b>Jet de protection :</b> Sorts</div>",
      "</form>"
    ].join(""),
    modal: true,
    rejectClose: false,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: () => true
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => false
      }
    ]
  });
  if (!choice) return false;

  const postCard = async ({ outcome, detail, relayed = false }) => {
    const build = globalThis.add2eBuildChatCard;
    const create = globalThis.add2eCreateChatCard;
    if (typeof build !== "function" || typeof create !== "function") {
      throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
    }
    const ratio = mode === "retrecissement"
      ? `${displayPercent} % de la taille et du poids normaux`
      : `+${percentage} % de taille et de poids`;
    const options = {
      actor: caster,
      title: label,
      icon: "fas fa-up-right-and-down-left-from-center",
      variant: outcome === "EFFET ACTIF" ? "success" : "neutral",
      source: {
        name: caster.name ?? casterToken?.name ?? "Magicien",
        img: casterToken?.document?.texture?.src ?? caster.img,
        type: "Sort de magicien",
        meta: spellItem.name ?? label
      },
      rows: [
        { label: "Cible", value: target.name ?? "Cible" },
        { label: "Résultat", value: outcome },
        { label: "Variation", value: ratio },
        { label: "Durée", value: `${casterLevel} tour${casterLevel > 1 ? "s" : ""} (${durationRounds} rounds)` }
      ],
      trustedBodyHtml: [
        `<div>${escapeHtml(detail)}</div>`,
        relayed ? "<div><small>Application demandée au MJ.</small></div>" : "",
        '<details style="margin-top:7px"><summary>Règle du Manuel</summary>',
        '<div>Une créature visible varie de 20 % par niveau du magicien, jusqu’à 200 %. ',
        'Un objet visible varie de 10 % par niveau, jusqu’à 100 %. ',
        'Rétrécissement annule Agrandissement ou applique le rapport inverse. ',
        'Un acteur monstre a droit à un jet de protection contre les sorts.</div></details>'
      ].join(""),
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
        flags: {
          add2e: {
            version: VERSION,
            spell: SPELL_SLUG,
            mode,
            targetKind,
            factor,
            percentage,
            targetActorUuid: target.actor?.uuid ?? null,
            targetTokenId: target.document?.id ?? target.id ?? null
          }
        }
      }
    };
    const preview = build(options);
    if (!String(preview ?? "").trim()) throw new Error(`${label} : carte de chat vide.`);
    return create(options);
  };

  if (targetKind === "creature" && !consenting) {
    const save = await globalThis.add2eRollSavingThrow?.(
      target.actor,
      "sorts",
      {
        source: `spell:${SPELL_SLUG}`,
        sourceName: label,
        sourceItem: spellItem,
        token: target,
        spellType: "alteration",
        spellTags: [
          `sort:${mode === "retrecissement" ? "retrecissement" : "agrandissement"}`,
          "ecole:alteration"
        ],
        createChat: true,
        showDice: true
      }
    );
    if (!save?.ok) {
      ui.notifications?.error?.(`${label} : jet de protection contre les sorts introuvable pour cette cible.`);
      return false;
    }
    if (save.success) {
      await postCard({
        outcome: "EFFET ANNULÉ",
        detail: "L’acteur monstre réussit son jet de protection contre les sorts."
      });
      return true;
    }
  }

  const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  if (typeof timeEngine?.effectData !== "function") {
    ui.notifications?.error?.(`${label} : moteur de durée ADD2E indisponible.`);
    return false;
  }

  const shrinking = mode === "retrecissement";
  const effectData = timeEngine.effectData({
    name: label,
    img: spellItem.img ?? "icons/magic/control/debuff-energy-hold-teal.webp",
    origin: spellItem.uuid ?? null,
    rounds: durationRounds,
    unit: "round",
    description: shrinking
      ? `Taille et poids ramenés à ${displayPercent} % de leur valeur normale.`
      : `Taille et poids augmentés de ${percentage} % (facteur ${displayPercent} %).`,
    tags: [
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
      `variation_reference_pct:${percentage}`,
      `facteur_taille:${String(factor).replace(".", "_")}`,
      `niveau_lanceur:${casterLevel}`,
      `duree_rounds:${durationRounds}`
    ],
    changes: [],
    source: "spell",
    caster,
    sourceItem: spellItem,
    endMessage: `${label} prend fin sur {actor}.`,
    extraFlags: {
      capabilityTransformation: {
        version: VERSION,
        sourceKey: `spell:${SPELL_SLUG}`,
        kind: "size",
        size: shrinking ? "reduite" : "agrandie",
        factor,
        mode,
        targetKind
      },
      spell: {
        version: VERSION,
        slug: SPELL_SLUG,
        name: label,
        class: "Magicien",
        level: 1,
        casterId: caster.id ?? null,
        casterUuid: caster.uuid ?? null,
        casterName: caster.name ?? "",
        targetActorId: target.actor?.id ?? null,
        targetTokenId: target.document?.id ?? target.id ?? null,
        targetKind,
        mode,
        casterLevel,
        factor,
        sourceItemId: spellItem.id ?? null,
        sourceItemUuid: spellItem.uuid ?? null
      }
    }
  });
  effectData.type = "base";
  effectData.system ??= {};
  effectData.changes ??= [];

  const canModifyActor = game.user?.isGM === true
    || target.actor?.isOwner === true
    || target.actor?.testUserPermission?.(game.user, "OWNER") === true;
  let canModifyToken = game.user?.isGM === true;
  if (!canModifyToken) {
    try { canModifyToken = target.document?.canUserModify?.(game.user, "update") === true; }
    catch (_error) { canModifyToken = false; }
  }

  const existing = globalThis.add2eFindTokenTransformationEffects?.(
    target.actor,
    target,
    { group: TRANSFORM_GROUP }
  ) ?? [];
  const opposite = existing.filter(effect => String(effect?.flags?.add2e?.tokenTransform?.mode ?? "") !== mode);

  let application = null;
  if (canModifyActor && canModifyToken) {
    if (opposite.length) {
      const removed = await globalThis.add2eDeleteTokenTransformationEffects?.(
        target.actor,
        opposite,
        { reason: "reverse-spell" }
      );
      application = removed?.ok
        ? { ok: true, cancelled: true, relayed: false }
        : { ok: false, reason: removed?.reason ?? "reverse-delete-failed" };
    } else {
      application = await globalThis.add2eApplyTimedTokenTransformation?.({
        actor: target.actor,
        token: target,
        effectData,
        factor,
        group: TRANSFORM_GROUP,
        mode,
        source: `spell:${SPELL_SLUG}`
      }) ?? { ok: false, reason: "transform-service-missing" };
    }
  } else {
    const activeGm = game.users?.activeGM
      ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
      ?? null;
    if (!game.socket || (!game.user?.isGM && !activeGm)) {
      application = { ok: false, reason: "relay-unavailable" };
    } else if (opposite.length) {
      game.socket.emit("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "deleteActiveEffects",
        payload: {
          sceneId: target.document?.parent?.id ?? canvas?.scene?.id ?? null,
          tokenId: target.document?.id ?? target.id ?? null,
          actorId: target.actor?.id ?? null,
          actorUuid: target.actor?.uuid ?? null,
          effectIds: opposite.map(effect => effect.id).filter(Boolean),
          fromUserId: game.user.id,
          sentAt: Date.now()
        }
      });
      application = { ok: true, cancelled: true, relayed: true };
    } else if (existing.length) {
      application = { ok: false, reason: "active-transform-without-permission" };
    } else {
      const prepared = globalThis.add2ePrepareTokenTransformation?.({
        token: target,
        factor,
        group: TRANSFORM_GROUP,
        mode,
        source: `spell:${SPELL_SLUG}`
      });
      if (!prepared) {
        application = { ok: false, reason: "transform-service-missing" };
      } else {
        const remoteEffect = clone(effectData);
        remoteEffect.flags ??= {};
        remoteEffect.flags.add2e ??= {};
        remoteEffect.flags.add2e.tokenTransform = prepared.transform;
        const commonPayload = {
          sceneId: target.document?.parent?.id ?? canvas?.scene?.id ?? null,
          tokenId: target.document?.id ?? target.id ?? null,
          actorId: target.actor?.id ?? null,
          actorUuid: target.actor?.uuid ?? null,
          fromUserId: game.user.id,
          sentAt: Date.now()
        };
        game.socket.emit("system.add2e", {
          type: "ADD2E_GM_OPERATION",
          operation: "createActiveEffect",
          payload: { ...commonPayload, effectData: remoteEffect }
        });
        game.socket.emit("system.add2e", {
          type: "ADD2E_GM_OPERATION",
          operation: "updateToken",
          payload: { ...commonPayload, updateData: prepared.updateData }
        });
        application = { ok: true, cancelled: false, relayed: true };
      }
    }
  }

  if (!application?.ok) {
    console.error("[ADD2E][AGRANDISSEMENT][APPLY_FAILED]", {
      version: VERSION,
      actor: caster.name,
      spell: spellItem.name,
      target: target.name,
      mode,
      application
    });
    ui.notifications?.error?.(`${label} : l’effet n’a pas pu être appliqué (${application?.reason ?? "raison inconnue"}).`);
    return false;
  }

  await postCard({
    outcome: application.cancelled ? "EFFET ANNULÉ" : "EFFET ACTIF",
    detail: application.cancelled
      ? `${label} dissipe l’effet inverse déjà actif sur la cible.`
      : shrinking
        ? "La cible est réduite selon le rapport inverse calculé."
        : "La cible est agrandie selon la proportion calculée.",
    relayed: application.relayed === true
  });
  return true;
})();