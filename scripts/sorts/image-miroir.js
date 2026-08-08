// ADD2E — onUse canonique : Image miroir.
// Magicien : 1d4 sosies, 2 rounds/niveau.
// Illusionniste : 1d4+1 sosies, 3 rounds/niveau.
// Portée 0 ; zone de 1,80 m autour du lanceur.
// Compatible Foundry V13/V14/V15.

return await (async () => {
  const VERSION = "2026-08-08-image-miroir-foundry-v1";
  const SPELL_SLUG = "image_miroir";
  const RADIUS_METERS = 1.8;

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const array = value => {
    if (Array.isArray(value)) return value.flatMap(array).filter(Boolean);
    if (value instanceof Set) return [...value].flatMap(array).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
    return value === undefined || value === null || value === "" ? [] : [value];
  };

  const spellItem = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (typeof sourceItem !== "undefined" && sourceItem)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.item ?? args[0]?.sort ?? args[0]?.sourceItem : null)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || spellItem?.parent
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.actor : null)
    || null;
  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster?.id ? token : null)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.token : null)
    || canvas?.tokens?.controlled?.find?.(entry => entry?.actor?.id === caster?.id)
    || caster?.getActiveTokens?.()?.[0]
    || null;

  if (!caster || !spellItem) {
    ui.notifications?.warn?.("Image miroir : lanceur ou sort introuvable.");
    return false;
  }

  const system = spellItem.system ?? {};
  const flags = spellItem.flags?.add2e ?? {};
  const classKeys = [
    system.classe,
    system.class,
    system.spellLists,
    system.liste,
    flags.routedClass,
    flags.spellListsResolved
  ].flatMap(array).map(normalize).filter(Boolean);
  const illusionist = classKeys.includes("illusionniste") || classKeys.includes("illusionist");
  const classKey = illusionist ? "illusionniste" : "magicien";
  const classLabel = illusionist ? "Illusionniste" : "Magicien";

  let casterLevel = 0;
  if (typeof globalThis.add2eCanonicalClassLevel === "function") {
    try { casterLevel = Number(globalThis.add2eCanonicalClassLevel(caster, classKey, 0)) || 0; }
    catch (_error) { casterLevel = 0; }
  }
  if (casterLevel < 1) {
    const classItem = Array.from(caster.items ?? []).find(entry => {
      if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
      return [entry?.system?.slug, entry?.system?.label, entry?.system?.nom, entry?.system?.name, entry?.name]
        .map(normalize)
        .includes(classKey);
    }) ?? null;
    casterLevel = Number(classItem?.system?.niveau ?? classItem?.system?.level) || 0;
  }
  if (casterLevel < 1) {
    ui.notifications?.error?.(`Image miroir : niveau de ${classLabel.toLowerCase()} introuvable sur l'Item classe.`);
    return false;
  }
  casterLevel = Math.max(1, Math.floor(casterLevel));

  const imageFormula = illusionist ? "1d4+1" : "1d4";
  const durationPerLevel = illusionist ? 3 : 2;
  const durationRounds = durationPerLevel * casterLevel;
  const imageRoll = await new Roll(imageFormula).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(imageRoll);
  const imageCount = Math.max(1, Math.floor(Number(imageRoll.total) || 1));

  const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  if (typeof timeEngine?.effectData !== "function") {
    ui.notifications?.error?.("Image miroir : moteur de durée ADD2E indisponible.");
    return false;
  }

  const effectData = timeEngine.effectData({
    name: `Image miroir (${imageCount})`,
    img: spellItem.img ?? "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
    origin: spellItem.uuid ?? null,
    rounds: durationRounds,
    unit: "round",
    description: `${imageCount} sosie${imageCount > 1 ? "s" : ""} accompagne${imageCount > 1 ? "nt" : ""} le lanceur dans un rayon de ${RADIUS_METERS.toLocaleString("fr-FR")} m. Une image frappée disparaît.`,
    tags: [
      `sort:${SPELL_SLUG}`,
      `classe:${classKey}`,
      `liste:${classKey}`,
      "ecole:illusion_fantasme",
      "illusion:image_miroir",
      `images:${imageCount}`,
      `duree_rounds:${durationRounds}`,
      "zone:1_8m"
    ],
    changes: [],
    source: "spell",
    caster,
    sourceItem: spellItem,
    endMessage: "Les images miroir de {actor} disparaissent.",
    extraFlags: {
      mirrorImage: {
        version: VERSION,
        spell: SPELL_SLUG,
        classKey,
        classLabel,
        casterLevel,
        current: imageCount,
        maximum: imageCount,
        radiusMeters: RADIUS_METERS,
        durationRounds,
        durationPerLevel,
        sourceItemId: spellItem.id ?? null,
        sourceItemUuid: spellItem.uuid ?? null,
        casterActorId: caster.id ?? null,
        casterActorUuid: caster.uuid ?? null,
        casterTokenId: casterToken?.document?.id ?? casterToken?.id ?? null,
        sceneId: casterToken?.document?.parent?.id ?? canvas?.scene?.id ?? null
      },
      spell: {
        version: VERSION,
        slug: SPELL_SLUG,
        name: "Image miroir",
        class: classLabel,
        level: 2,
        casterLevel,
        sourceItemId: spellItem.id ?? null,
        sourceItemUuid: spellItem.uuid ?? null
      }
    }
  });
  effectData.type = "base";
  effectData.system ??= {};
  effectData.changes ??= [];

  const existing = Array.from(caster.effects ?? []).filter(effect => {
    if (!effect || effect.disabled === true) return false;
    if (effect.flags?.add2e?.mirrorImage?.spell === SPELL_SLUG) return true;
    const tags = array(effect.flags?.add2e?.tags).map(normalize);
    return tags.includes("sort_image_miroir") || tags.includes("illusion_image_miroir");
  });

  const canModifyActor = game.user?.isGM === true
    || caster.isOwner === true
    || caster.testUserPermission?.(game.user, "OWNER") === true;
  let relayed = false;

  if (canModifyActor) {
    if (existing.length) {
      await caster.deleteEmbeddedDocuments("ActiveEffect", existing.map(effect => effect.id).filter(Boolean));
    }
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    const effect = created?.[0] ?? null;
    if (!effect) {
      ui.notifications?.error?.("Image miroir : création de l'effet impossible.");
      return false;
    }
    if (typeof timeEngine?.normalizeEffect === "function") {
      try { await timeEngine.normalizeEffect(effect, Number(game.combat?.round) || 0); }
      catch (error) { console.warn("[ADD2E][IMAGE_MIROIR][TIME_NORMALIZE]", error); }
    }
  } else {
    const activeGm = game.users?.activeGM
      ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
      ?? null;
    if (!game.socket || (!game.user?.isGM && !activeGm)) {
      ui.notifications?.error?.("Image miroir : aucun MJ actif pour appliquer l'effet.");
      return false;
    }
    if (existing.length) {
      game.socket.emit("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "deleteActiveEffects",
        payload: {
          actorId: caster.id ?? null,
          actorUuid: caster.uuid ?? null,
          effectIds: existing.map(effect => effect.id).filter(Boolean),
          fromUserId: game.user.id,
          sentAt: Date.now()
        }
      });
    }
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorId: caster.id ?? null,
        actorUuid: caster.uuid ?? null,
        effectData,
        fromUserId: game.user.id,
        sentAt: Date.now()
      }
    });
    relayed = true;
  }

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Image miroir : API commune des cartes ADD2E indisponible.");
  }

  const card = {
    actor: caster,
    title: "Image miroir",
    icon: "fas fa-images",
    variant: "spell",
    source: {
      name: caster.name ?? casterToken?.name ?? classLabel,
      img: casterToken?.document?.texture?.src ?? caster.img,
      type: `Sort de ${classLabel.toLowerCase()}`,
      meta: spellItem.name ?? "Image miroir"
    },
    rows: [
      { label: "Sosies", value: `${imageCount} (${imageFormula})` },
      { label: "Zone", value: `${RADIUS_METERS.toLocaleString("fr-FR")} m autour du lanceur` },
      { label: "Durée", value: `${durationRounds} rounds (${durationPerLevel} rounds/niveau)` },
      { label: "Effet", value: "Une image frappée disparaît" }
    ],
    trustedBodyHtml: relayed
      ? "<div><small>Application de l’effet demandée au MJ.</small></div>"
      : "",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: [imageRoll],
      flags: {
        add2e: {
          version: VERSION,
          spell: SPELL_SLUG,
          classKey,
          casterLevel,
          imageCount,
          imageFormula,
          durationRounds,
          radiusMeters: RADIUS_METERS
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Image miroir : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(card);

  return true;
})();
