// ADD2E — Agrandissement / Rétrécissement
// Propriétaire onUse unique du sort de Magicien.
// Compatible Foundry V13/V14/V15.

return await (async () => {
  const VERSION = "2026-08-09-magicien-agrandissement-v6-canonical";
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

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const clone = value => {
    if (value === undefined) return undefined;
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
    if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
    return JSON.parse(JSON.stringify(value));
  };

  const spellItem = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (typeof sourceItem !== "undefined" && sourceItem)
    || (Array.isArray(typeof args !== "undefined" ? args : null)
      ? args[0]?.item ?? args[0]?.sort ?? args[0]?.sourceItem
      : null)
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
    ui.notifications?.error?.("Agrandissement : lanceur ou sort introuvable.");
    return false;
  }

  // La variante est décidée à la mémorisation. Les deux objets accordés par la
  // source canonique sont explicitement nommés Agrandissement et Rétrécissement.
  const grantedName = norm(spellItem.name ?? spellItem.system?.nom);
  const mode = grantedName === "retrecissement" ? "retrecissement" : "agrandissement";
  const shrinking = mode === "retrecissement";
  const label = shrinking ? "Rétrécissement" : "Agrandissement";

  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.getEmbeddedClassItems !== "function" || typeof engine?.getEmbeddedClassLevel !== "function") {
    throw new Error(`${label} : API canonique des classes ADD2E indisponible.`);
  }

  const wizardClass = engine.getEmbeddedClassItems(caster).find(entry => {
    const tags = [
      ...(Array.isArray(entry?.system?.tags) ? entry.system.tags : []),
      ...(Array.isArray(entry?.flags?.add2e?.tags) ? entry.flags.add2e.tags : [])
    ];
    return tags.some(tag => String(engine.normalizeTag?.(tag) ?? tag).toLowerCase() === "classe:magicien");
  }) ?? null;
  const casterLevel = Math.floor(Number(engine.getEmbeddedClassLevel(wizardClass)) || 0);
  if (casterLevel < 1) {
    ui.notifications?.error?.(`${label} : niveau de classe Magicien introuvable.`);
    return false;
  }

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
  const percentage = targetKind === "objet"
    ? Math.min(100, casterLevel * 10)
    : Math.min(200, casterLevel * 20);
  const enlargementFactor = 1 + (percentage / 100);
  const factor = shrinking ? 1 / enlargementFactor : enlargementFactor;
  const displayPercent = Math.round(factor * 1000) / 10;
  const durationRounds = casterLevel * 5;
  const rangeInches = casterLevel / 2;
  const variation = shrinking
    ? `${displayPercent} % de la taille normale`
    : `+${percentage} % · taille × ${enlargementFactor}`;

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error(`${label} : l’API de fenêtre ADD2E est indisponible.`);
  }

  const isSelf = target.actor?.uuid === caster.uuid || target.actor?.id === caster.id;
  const choice = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-agrandissement-dialog"],
    window: { title: label },
    content: `
      <form class="add2e-agrandissement-form">
        <p><b>Cible :</b> ${escapeHtml(target.name ?? "Cible")}</p>
        <p><b>Variation :</b> ${escapeHtml(variation)}</p>
        <p><b>Portée :</b> ${escapeHtml(`${rangeInches}\"`)}</p>
        <p><b>Durée :</b> ${durationRounds} round${durationRounds > 1 ? "s" : ""}</p>
        ${targetKind === "creature" && !isSelf ? `
          <div class="form-group">
            <label>La cible est-elle consentante ?</label>
            <select name="consent">
              <option value="yes">Oui — aucun jet de protection</option>
              <option value="no">Non — jet de protection contre les sorts</option>
            </select>
          </div>
        ` : ""}
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-wand-magic-sparkles'></i>",
        default: true,
        callback: (_event, button) => ({
          consenting: targetKind !== "creature" || isSelf
            ? true
            : String(button.form?.elements?.consent?.value ?? "yes") === "yes"
        })
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
  if (!choice) return false;

  const postCard = async ({ outcome, detail, relayed = false, saveResult = null }) => {
    const build = globalThis.add2eBuildChatCard;
    const create = globalThis.add2eCreateChatCard;
    if (typeof build !== "function" || typeof create !== "function") {
      throw new Error(`${label} : constructeurs communs de cartes ADD2E indisponibles.`);
    }

    const ratio = shrinking
      ? `${displayPercent} % de la taille et du poids normaux`
      : `+${percentage} % de taille et de poids`;
    const rows = [
      { label: "Cible", value: target.name ?? "Cible" },
      { label: "Résultat", value: outcome },
      { label: "Variation", value: ratio },
      { label: "Portée", value: `${rangeInches}\"` },
      { label: "Durée", value: `${durationRounds} round${durationRounds > 1 ? "s" : ""}` }
    ];
    if (saveResult?.ok) {
      rows.push({
        label: "Jet de protection",
        value: `${saveResult.d20} + ${saveResult.bonus} = ${saveResult.total} / ${saveResult.target} — ${saveResult.success ? "réussi" : "raté"}`
      });
    }

    const options = {
      actor: caster,
      title: label,
      icon: "fas fa-up-right-and-down-left-from-center",
      variant: outcome === "EFFET ACTIF" ? "success" : "neutral",
      source: {
        name: caster.name ?? casterToken?.name ?? "Magicien",
        img: casterToken?.document?.texture?.src ?? caster.img ?? spellItem.img,
        type: "Sort de magicien",
        meta: spellItem.name ?? label
      },
      rows,
      trustedBodyHtml: [
        `<div>${escapeHtml(detail)}</div>`,
        relayed ? "<div><small>Application demandée au MJ.</small></div>" : "",
        '<details style="margin-top:7px"><summary>Règle appliquée</summary>',
        '<div>Une créature varie de 20 % par niveau du magicien, jusqu’à 200 %. ',
        'Un objet varie de 10 % par niveau, jusqu’à 100 %. ',
        'Rétrécissement annule Agrandissement ou applique le rapport inverse. ',
        'Une créature non consentante bénéficie d’un jet de protection contre les sorts.</div></details>'
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
            casterLevel,
            durationRounds,
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

  let saveResult = null;
  if (targetKind === "creature" && choice.consenting === false) {
    if (typeof globalThis.add2eRollSavingThrow !== "function") {
      throw new Error(`${label} : résolveur canonique des jets de protection indisponible.`);
    }

    saveResult = await globalThis.add2eRollSavingThrow(
      target.actor,
      "sorts",
      {
        source: `spell:${SPELL_SLUG}`,
        sourceName: label,
        sourceItem: spellItem,
        token: target,
        spellType: "alteration",
        spellTags: [
          `sort:${shrinking ? "retrecissement" : "agrandissement"}`,
          "ecole:alteration"
        ],
        createChat: true,
        showDice: true
      }
    );

    if (!saveResult?.ok) {
      ui.notifications?.error?.(`${label} : jet de protection contre les sorts introuvable pour cette cible.`);
      return false;
    }
    if (saveResult.success) {
      await postCard({
        outcome: "EFFET ANNULÉ",
        detail: "La cible non consentante réussit son jet de protection contre les sorts.",
        saveResult
      });
      return true;
    }
  }

  const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  if (typeof timeEngine?.effectData !== "function") {
    ui.notifications?.error?.(`${label} : moteur de durée ADD2E indisponible.`);
    return false;
  }

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
    try {
      canModifyToken = target.document?.canUserModify?.(game.user, "update") === true;
    } catch (_error) {
      canModifyToken = false;
    }
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
    relayed: application.relayed === true,
    saveResult
  });

  return true;
})();
