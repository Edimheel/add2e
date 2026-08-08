// ADD2E — onUse canonique : Détection de l'invisibilité.
// Magicien niveau 2 / Illusionniste niveau 1.
// Portée : 1 case/niveau ; champ visuel : 1 case de large ; durée : 5 rounds/niveau.
// Compatible Foundry V13/V14/V15.

return await (async () => {
  const VERSION = "2026-08-08-detection-invisibilite-foundry-v1";
  const SPELL_SLUG = "detection_de_l_invisibilite";
  const METERS_PER_SCALE_INCH = 3;

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const toArray = value => {
    if (Array.isArray(value)) return value.flatMap(toArray).filter(Boolean);
    if (value instanceof Set) return [...value].flatMap(toArray).filter(Boolean);
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
    ui.notifications?.warn?.("Détection de l'invisibilité : lanceur ou sort introuvable.");
    return false;
  }

  const system = spellItem.system ?? {};
  const primaryClassKeys = [system.classe, system.class, system.spellLists, system.liste]
    .flatMap(toArray).map(normalize).filter(Boolean);
  const illusionist = primaryClassKeys.includes("illusionniste") || primaryClassKeys.includes("illusionist");
  const classKey = illusionist ? "illusionniste" : "magicien";
  const classLabel = illusionist ? "Illusionniste" : "Magicien";
  const spellLevel = illusionist ? 1 : 2;

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
    ui.notifications?.error?.(`Détection de l'invisibilité : niveau de ${classLabel.toLowerCase()} introuvable sur l'Item classe.`);
    return false;
  }
  casterLevel = Math.max(1, Math.floor(casterLevel));

  const rangeSpaces = casterLevel;
  const rangeMeters = rangeSpaces * METERS_PER_SCALE_INCH;
  const widthSpaces = 1;
  const widthMeters = METERS_PER_SCALE_INCH;
  const durationRounds = 5 * casterLevel;

  const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  if (typeof timeEngine?.effectData !== "function") {
    ui.notifications?.error?.("Détection de l'invisibilité : moteur de durée ADD2E indisponible.");
    return false;
  }

  const effectData = timeEngine.effectData({
    name: "Détection de l’invisibilité",
    img: spellItem.img ?? "icons/magic/perception/eye-ringed-glow-angry-small-blue.webp",
    origin: spellItem.uuid ?? null,
    rounds: durationRounds,
    unit: "round",
    description: `Le lanceur perçoit dans son champ visuel les créatures et objets invisibles, astraux, éthérés, cachés ou hors de phase jusqu'à ${rangeSpaces} case${rangeSpaces > 1 ? "s" : ""} (${rangeMeters} m), sur ${widthSpaces} case (${widthMeters} m) de large. Les obstacles ordinaires bloquent la perception.`,
    tags: [
      `sort:${SPELL_SLUG}`,
      "sort:detection_de_linvisibilite",
      `classe:${classKey}`,
      `liste:${classKey}`,
      `niveau:${spellLevel}`,
      "ecole:divination",
      "detection:invisibilite",
      "detection:astral",
      "detection:ethere",
      "detection:cache",
      "detection:hors_phase",
      "vision:ligne_de_vue",
      "vision:obstacles_bloquent",
      `portee_cases:${rangeSpaces}`,
      `largeur_cases:${widthSpaces}`,
      `duree_rounds:${durationRounds}`,
      "jet:aucun"
    ],
    changes: [],
    source: "spell",
    caster,
    sourceItem: spellItem,
    endMessage: "La détection de l’invisibilité de {actor} prend fin.",
    extraFlags: {
      detectInvisibility: {
        version: VERSION,
        spell: SPELL_SLUG,
        classKey,
        classLabel,
        spellLevel,
        casterLevel,
        rangeSpaces,
        rangeMeters,
        widthSpaces,
        widthMeters,
        durationRounds,
        area: "line-of-sight",
        obstaclesBlock: true,
        savingThrow: "none",
        detects: ["invisible", "astral", "ethereal", "hidden", "out-of-phase"],
        casterTokenId: casterToken?.document?.id ?? casterToken?.id ?? null,
        sceneId: casterToken?.document?.parent?.id ?? canvas?.scene?.id ?? null
      },
      spell: {
        version: VERSION,
        slug: SPELL_SLUG,
        name: "Détection de l’invisibilité",
        class: classLabel,
        level: spellLevel,
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
    if (effect.flags?.add2e?.detectInvisibility?.spell === SPELL_SLUG) return true;
    const tags = toArray(effect.flags?.add2e?.tags).map(normalize);
    return tags.includes("sort_detection_de_l_invisibilite") || tags.includes("sort_detection_de_linvisibilite");
  });

  const canModifyActor = game.user?.isGM === true
    || caster.isOwner === true
    || caster.testUserPermission?.(game.user, "OWNER") === true;
  let relayed = false;

  if (canModifyActor) {
    if (existing.length) await caster.deleteEmbeddedDocuments("ActiveEffect", existing.map(effect => effect.id).filter(Boolean));
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    const effect = created?.[0] ?? null;
    if (!effect) {
      ui.notifications?.error?.("Détection de l'invisibilité : création de l'effet impossible.");
      return false;
    }
    if (typeof timeEngine?.normalizeEffect === "function") {
      try { await timeEngine.normalizeEffect(effect, Number(game.combat?.round) || 0); }
      catch (error) { console.warn("[ADD2E][DETECTION_INVISIBILITE][TIME_NORMALIZE]", error); }
    }
  } else {
    const activeGm = game.users?.activeGM
      ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
      ?? null;
    if (!game.socket || (!game.user?.isGM && !activeGm)) {
      ui.notifications?.error?.("Détection de l'invisibilité : aucun MJ actif pour appliquer l'effet.");
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
    throw new Error("Détection de l'invisibilité : API commune des cartes ADD2E indisponible.");
  }

  const card = {
    actor: caster,
    title: "Détection de l’invisibilité",
    icon: "fas fa-eye",
    variant: "spell",
    source: {
      name: caster.name ?? casterToken?.name ?? classLabel,
      img: casterToken?.document?.texture?.src ?? caster.img,
      type: `Sort de ${classLabel.toLowerCase()}`,
      meta: spellItem.name ?? "Détection de l’invisibilité"
    },
    rows: [
      { label: "Portée du regard", value: `${rangeSpaces} case${rangeSpaces > 1 ? "s" : ""} (${rangeMeters} m)` },
      { label: "Largeur", value: `${widthSpaces} case (${widthMeters} m)` },
      { label: "Durée", value: `${durationRounds} rounds (5 rounds/niveau)` },
      { label: "Détecte", value: "Invisible · astral · éthéré · caché · hors phase" },
      { label: "Obstacle", value: "La ligne de vue ordinaire doit être libre" },
      { label: "Jet de protection", value: "Aucun" }
    ],
    trustedBodyHtml: relayed
      ? "<div><small>Application de l’effet demandée au MJ.</small></div>"
      : "",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          version: VERSION,
          spell: SPELL_SLUG,
          classKey,
          casterLevel,
          rangeSpaces,
          widthSpaces,
          durationRounds
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Détection de l'invisibilité : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(card);

  return true;
})();
