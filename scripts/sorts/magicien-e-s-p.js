// ADD2E — onUse canonique : E.S.P.
// Sort de magicien niveau 2 + pouvoirs E.S.P. des objets explicitement télépathiques.
// Compatible Foundry V13/V14/V15 — fenêtres et cartes communes ADD2E.

return await (async () => {
  const VERSION = "2026-08-08-esp-foundry-v1";
  const SPELL_SLUG = "e_s_p";
  const METERS_PER_SCALE_INCH = 3;

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const toArray = value => {
    if (Array.isArray(value)) return value.flatMap(toArray).filter(Boolean);
    if (value instanceof Set) return [...value].flatMap(toArray).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
    return value === undefined || value === null || value === "" ? [] : [value];
  };

  const escapeHtml = value => {
    const text = String(value ?? "");
    try {
      if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
    } catch (_error) {}
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const showAlert = async ({ title, content, theme = "wizard" }) => {
    if (typeof globalThis.add2eDialogAlert !== "function") {
      throw new Error("E.S.P. : l’API de fenêtre ADD2E est indisponible.");
    }
    await globalThis.add2eDialogAlert({
      add2eTheme: theme,
      window: { title },
      content
    });
  };

  const spellItem = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.item ?? args[0]?.sort : null)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || spellItem?.parent
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.actor : null)
    || null;

  if (!caster || !spellItem) {
    await showAlert({
      title: "E.S.P.",
      content: "<p>Le lanceur ou la source de l’effet est introuvable.</p>",
      theme: "danger"
    });
    return false;
  }

  const virtualPower = spellItem?.system?.isPower === true
    || Boolean(spellItem?.system?.sourceObjectItemId)
    || Boolean(spellItem?.system?.powerId);

  let sourceObject = null;
  if (virtualPower) {
    const explicitSource = (typeof sourceItem !== "undefined" && sourceItem) ? sourceItem : null;
    if (explicitSource && explicitSource !== spellItem && explicitSource?.documentName === "Item") sourceObject = explicitSource;
    if (!sourceObject && explicitSource && explicitSource !== spellItem && explicitSource?.type !== "sort") sourceObject = explicitSource;
    const sourceObjectItemId = String(spellItem?.system?.sourceObjectItemId ?? "").trim();
    if (!sourceObject && sourceObjectItemId) sourceObject = caster.items?.get?.(sourceObjectItemId) ?? null;
    if (!sourceObject && spellItem?.parent?.documentName === "Actor" && spellItem?.type !== "sort") sourceObject = spellItem;
  }

  const sourcePowers = toArray(sourceObject?.system?.pouvoirs ?? sourceObject?.system?.powers)
    .filter(entry => entry && typeof entry === "object");
  const powerIndex = Number(spellItem?.system?.powerIndex);
  const powerId = String(spellItem?.system?.powerId ?? spellItem?.system?.powerKey ?? "").trim();
  const sourcePower = Number.isInteger(powerIndex) && powerIndex >= 0
    ? sourcePowers[powerIndex] ?? null
    : sourcePowers.find(entry => String(entry?.id ?? entry?.key ?? "") === powerId) ?? null;

  const tagValues = [
    sourceObject?.system?.tags,
    sourceObject?.system?.effectTags,
    sourceObject?.flags?.add2e?.tags,
    sourcePower?.tags,
    sourcePower?.effectTags,
    spellItem?.system?.tags,
    spellItem?.system?.effectTags,
    spellItem?.flags?.add2e?.tags
  ].flatMap(toArray).map(normalize).filter(Boolean);
  const tagSet = new Set(tagValues);
  const hasTag = tag => tagSet.has(normalize(tag));

  let context = "spell";
  if (virtualPower) {
    if (hasTag("objet:medaillon_de_pensees") || hasTag("objet_medaillon_de_pensees")) context = "medallion";
    else if (hasTag("objet:heaume_de_telepathie") || hasTag("objet_heaume_de_telepathie")) context = "helm";
    else context = "invalid-item";
  }

  if (context === "invalid-item") {
    const objectLabel = sourceObject?.name ?? "objet magique";
    await showAlert({
      title: "E.S.P. — source incohérente",
      theme: "danger",
      content: `<p><b>${escapeHtml(objectLabel)}</b> référence le script E.S.P. sans être identifié par les données canoniques comme un médaillon de pensées ou un heaume de télépathie.</p><p>L’utilisation est annulée afin de ne pas appliquer les règles du sort à un objet sans rapport. La donnée source de cet objet doit être corrigée.</p>`
    });
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster?.id ? token : null)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.token : null)
    || canvas?.tokens?.controlled?.find?.(entry => entry?.actor?.id === caster?.id)
    || caster?.getActiveTokens?.()?.[0]
    || null;
  if (!casterToken) {
    await showAlert({
      title: "E.S.P.",
      content: "<p>Le lanceur doit disposer d’un token sur la scène pour mesurer la portée de l’E.S.P.</p>",
      theme: "danger"
    });
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []).filter(entry => entry?.actor);
  if (targets.length !== 1) {
    await showAlert({
      title: "E.S.P. — cible",
      content: "<p>Sélectionne exactement <b>une créature</b> à examiner. L’E.S.P. ne permet de sonder qu’une créature par round.</p>"
    });
    return false;
  }
  const targetToken = targets[0];
  const targetActor = targetToken.actor;

  let casterLevel = 0;
  if (context === "spell") {
    if (typeof globalThis.add2eCanonicalClassLevel === "function") {
      try { casterLevel = Number(globalThis.add2eCanonicalClassLevel(caster, "magicien", 0)) || 0; }
      catch (_error) { casterLevel = 0; }
    }
    if (casterLevel < 1) {
      const classItem = Array.from(caster.items ?? []).find(entry => {
        if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
        return [entry?.system?.slug, entry?.system?.label, entry?.system?.nom, entry?.system?.name, entry?.name]
          .map(normalize)
          .includes("magicien");
      }) ?? null;
      casterLevel = Number(classItem?.system?.niveau ?? classItem?.system?.level) || 0;
    }
    if (casterLevel < 1) {
      await showAlert({
        title: "E.S.P.",
        content: "<p>Le niveau de magicien est introuvable sur l’Item classe.</p>",
        theme: "danger"
      });
      return false;
    }
    casterLevel = Math.max(1, Math.floor(casterLevel));
  }

  const rangeSpaces = context === "spell"
    ? Math.min(9, casterLevel * 0.5)
    : (context === "medallion" ? 5 : 6);
  const rangeMeters = rangeSpaces * METERS_PER_SCALE_INCH;
  const durationRounds = context === "spell" ? casterLevel : 0;

  const tokenCenter = tokenObject => {
    if (tokenObject?.center) return { x: Number(tokenObject.center.x), y: Number(tokenObject.center.y) };
    const doc = tokenObject?.document ?? tokenObject;
    const gridSize = Number(canvas?.grid?.size || 100) || 100;
    return {
      x: Number(doc?.x || 0) + Number(doc?.width || 1) * gridSize / 2,
      y: Number(doc?.y || 0) + Number(doc?.height || 1) * gridSize / 2
    };
  };

  const measureSpaces = (fromToken, toToken) => {
    const from = tokenCenter(fromToken);
    const to = tokenCenter(toToken);
    const grid = canvas?.grid;
    const gridSize = Number(grid?.size || 100) || 100;
    if (typeof grid?.measurePath === "function") {
      try {
        const result = grid.measurePath([from, to], { gridSpaces: true });
        const measured = Number(result?.distance ?? result?.gridDistance ?? result?.spaces ?? result?.cost ?? result);
        if (Number.isFinite(measured)) return measured;
      } catch (error) {
        console.warn("[ADD2E][ESP][DISTANCE][MEASURE_PATH]", error);
      }
    }
    return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / gridSize;
  };

  const distanceSpaces = measureSpaces(casterToken, targetToken);
  const distanceMeters = distanceSpaces * METERS_PER_SCALE_INCH;
  if (distanceSpaces > rangeSpaces + 0.001) {
    await showAlert({
      title: "E.S.P. — hors de portée",
      content: `<p><b>${escapeHtml(targetToken.name ?? targetActor.name)}</b> se trouve à <b>${distanceSpaces.toFixed(1)} cases</b> (${distanceMeters.toFixed(1)} m), au-delà de la portée maximale de <b>${rangeSpaces} cases</b> (${rangeMeters} m).</p>`
    });
    return false;
  }

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("E.S.P. : l’API de fenêtre ADD2E est indisponible.");
  }

  const obstacleOptions = context === "spell"
    ? [
        ["none", "Aucun obstacle bloquant"],
        ["rock", "Au moins 60 cm de roche"],
        ["metal", "Au moins 5 cm de métal"],
        ["lead", "Une feuille de plomb"]
      ]
    : context === "medallion"
      ? [
          ["none", "Aucun obstacle bloquant"],
          ["stone", "Plus de 90 cm de pierre"],
          ["metal", "Au moins 5 cm de métal"],
          ["precious-plating", "Plaquage d’or, plomb ou platine plus épais qu’une couche de peinture"]
        ]
      : [
          ["none", "Aucun obstacle bloquant"],
          ["stone", "Plus de 90 cm de pierre"],
          ["iron", "Plus de 7,5 cm de fer"],
          ["shielding", "Plaquage compact de plomb ou d’or"]
        ];

  const obstacleChoice = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "scan",
    add2eClasses: ["add2e-esp-dialog"],
    window: { title: "E.S.P. — obstacle mental" },
    content: `
      <form class="add2e-esp-form">
        <p><b>Cible :</b> ${escapeHtml(targetToken.name ?? targetActor.name)}</p>
        <p><b>Distance :</b> ${distanceSpaces.toFixed(1)} cases (${distanceMeters.toFixed(1)} m)</p>
        <div class="form-group">
          <label>Obstacle entre la source et la cible</label>
          <select name="obstacle">
            ${obstacleOptions.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("")}
          </select>
        </div>
        <p>Foundry ne connaît pas l’épaisseur ni la matière des murs : ce choix applique uniquement les seuils prévus par la règle.</p>
      </form>`,
    buttons: [
      {
        action: "scan",
        label: "Examiner",
        icon: "<i class='fas fa-brain'></i>",
        default: true,
        callback: (_event, button) => ({
          obstacle: String(button.form?.elements?.obstacle?.value ?? "none")
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
  if (!obstacleChoice) return false;

  const obstacleBlocked = obstacleChoice.obstacle !== "none";
  const selectedObstacleLabel = obstacleOptions.find(([value]) => value === obstacleChoice.obstacle)?.[1]
    ?? "Obstacle bloquant";

  let deviceFailureRoll = null;
  let deviceFailed = false;
  if (context === "medallion" && !obstacleBlocked) {
    deviceFailureRoll = await new Roll("1d6").evaluate();
    deviceFailed = Number(deviceFailureRoll.total) === 6;
  }

  const effectsEngine = globalThis.ADD2E_EFFECTS;
  let resistancePercent = 0;
  let resistanceRoll = null;
  let resistanceBlocked = false;
  if (!obstacleBlocked && !deviceFailed && typeof effectsEngine?.getMonkResistESP === "function") {
    try { resistancePercent = Math.max(0, Math.min(100, Number(effectsEngine.getMonkResistESP(targetActor)) || 0)); }
    catch (error) {
      console.warn("[ADD2E][ESP][MONK_RESISTANCE]", error);
      resistancePercent = 0;
    }
    if (resistancePercent > 0) {
      resistanceRoll = await new Roll("1d100").evaluate();
      resistanceBlocked = Number(resistanceRoll.total) <= resistancePercent;
    }
  }

  let effectRelayed = false;
  if (context === "spell") {
    const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
    if (typeof timeEngine?.effectData !== "function") {
      await showAlert({
        title: "E.S.P.",
        content: "<p>Le moteur de durée ADD2E est indisponible.</p>",
        theme: "danger"
      });
      return false;
    }

    const effectData = timeEngine.effectData({
      name: "E.S.P.",
      img: spellItem.img ?? "icons/magic/perception/eye-ringed-glow-angry-small-blue.webp",
      origin: spellItem.uuid ?? null,
      rounds: durationRounds,
      unit: "round",
      description: `Permet d’examiner les pensées immédiates d’une créature par round jusqu’à ${rangeSpaces} case${rangeSpaces > 1 ? "s" : ""}, pendant ${durationRounds} round${durationRounds > 1 ? "s" : ""}.`,
      tags: [
        `sort:${SPELL_SLUG}`,
        `effet:${SPELL_SLUG}`,
        "classe:magicien",
        "liste:magicien",
        "niveau:2",
        "ecole:divination",
        "mental:esp",
        "telepathie:lecture_pensees",
        "cible:une_creature_par_round",
        `portee_cases:${rangeSpaces}`,
        `duree_rounds:${durationRounds}`,
        "jet:aucun"
      ],
      changes: [],
      source: "spell",
      caster,
      sourceItem: spellItem,
      endMessage: "La perception E.S.P. de {actor} prend fin.",
      extraFlags: {
        esp: {
          version: VERSION,
          spell: SPELL_SLUG,
          mode: "spell",
          casterLevel,
          rangeSpaces,
          rangeMeters,
          durationRounds,
          scansPerRound: 1,
          canRetarget: true,
          materialComponentHandledByCastEngine: true,
          obstacles: {
            rockMeters: 0.6,
            metalMeters: 0.05,
            leadSheetBlocks: true
          },
          savingThrow: "none"
        },
        spell: {
          version: VERSION,
          slug: SPELL_SLUG,
          name: "E.S.P.",
          class: "Magicien",
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

    const existing = Array.from(caster.effects ?? []).filter(effect =>
      effect?.disabled !== true
      && effect?.flags?.add2e?.esp?.spell === SPELL_SLUG
      && effect?.flags?.add2e?.esp?.mode === "spell"
    );
    const canModifyActor = game.user?.isGM === true
      || caster.isOwner === true
      || caster.testUserPermission?.(game.user, "OWNER") === true;

    if (canModifyActor) {
      if (existing.length) await caster.deleteEmbeddedDocuments("ActiveEffect", existing.map(effect => effect.id).filter(Boolean));
      const created = await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
      const effect = created?.[0] ?? null;
      if (!effect) throw new Error("E.S.P. : création de l’effet actif impossible.");
      if (typeof timeEngine?.normalizeEffect === "function") {
        try { await timeEngine.normalizeEffect(effect, Number(game.combat?.round) || 0); }
        catch (error) { console.warn("[ADD2E][ESP][TIME_NORMALIZE]", error); }
      }
    } else {
      const activeGm = game.users?.activeGM
        ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
        ?? null;
      if (!game.socket || (!game.user?.isGM && !activeGm)) {
        await showAlert({
          title: "E.S.P.",
          content: "<p>Aucun MJ actif ne peut appliquer l’effet E.S.P.</p>",
          theme: "danger"
        });
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
      effectRelayed = true;
    }
  }

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("E.S.P. : API commune des cartes ADD2E indisponible.");
  }

  const contextLabel = context === "spell"
    ? "Sort de magicien"
    : context === "medallion"
      ? "Médaillon de pensées"
      : "Heaume de télépathie";
  const sourceLabel = context === "spell" ? spellItem.name : (sourceObject?.name ?? contextLabel);

  let resultLabel = "Pensées superficielles détectables";
  if (obstacleBlocked) resultLabel = "Perception bloquée par l’obstacle";
  else if (deviceFailed) resultLabel = "Le médaillon n’a perçu aucune pensée";
  else if (resistanceBlocked) resultLabel = "Esprit protégé contre l’E.S.P.";

  const rows = [
    { label: "Source", value: sourceLabel },
    { label: "Cible examinée", value: targetToken.name ?? targetActor.name },
    { label: "Distance", value: `${distanceSpaces.toFixed(1)} cases (${distanceMeters.toFixed(1)} m)` },
    { label: "Portée maximale", value: `${rangeSpaces} case${rangeSpaces > 1 ? "s" : ""} (${rangeMeters} m)` }
  ];

  if (context === "spell") {
    rows.push(
      { label: "Durée", value: `${durationRounds} round${durationRounds > 1 ? "s" : ""} (1 round/niveau)` },
      { label: "Examen", value: "1 créature par round" },
      { label: "Jet de protection", value: "Aucun" }
    );
  } else if (context === "medallion") {
    const widthSteps = Math.max(0, Math.min(5, Math.floor((distanceMeters + 0.0001) / 3)));
    const widthMeters = Math.min(3.3, 0.3 + 0.6 * widthSteps);
    rows.push(
      { label: "Activation", value: "1 round complet de concentration" },
      { label: "Largeur à cette distance", value: `${widthMeters.toFixed(1)} m` },
      { label: "Zone", value: "Directionnelle" },
      { label: "Fiabilité", value: deviceFailureRoll ? `d6 = ${deviceFailureRoll.total} ; échec sur 6` : "1 chance sur 6 d’échec" }
    );
  } else {
    rows.push(
      { label: "Activation", value: "Concentration" },
      { label: "Zone", value: "Directionnelle" },
      { label: "Localisation d’un esprit", value: distanceSpaces <= 1 ? "Oui — cible à 1 case ou moins" : "Non — au-delà de 1 case" }
    );
  }

  rows.push({
    label: "Obstacle",
    value: obstacleBlocked ? `${selectedObstacleLabel} — bloque l’E.S.P.` : "Aucun obstacle bloquant déclaré"
  });
  if (resistancePercent > 0) {
    rows.push({
      label: "Masquer son esprit",
      value: resistanceRoll
        ? `${resistancePercent}% de résistance · d100 = ${resistanceRoll.total} · ${resistanceBlocked ? "résiste" : "ESP passe"}`
        : `${resistancePercent}% de résistance`
    });
  }
  rows.push({ label: "Résultat", value: resultLabel });

  const ruleNote = context === "medallion"
    ? "Les pensées ne sont compréhensibles que si leur langue est connue. Une créature sans langage ne fournit que des émotions si le médaillon possède la faculté d’empathie. Les êtres réellement sans esprit n’émettent aucune pensée perceptible."
    : "Le contenu exact des pensées n’est pas inventé par le système : le MJ fournit la pensée immédiate ou les images instinctives appropriées. Une langue inconnue n’est pas comprise et un être réellement sans esprit n’émet aucune pensée perceptible.";

  const card = {
    actor: caster,
    title: "E.S.P.",
    icon: "fas fa-brain",
    variant: "spell",
    source: {
      name: caster.name ?? casterToken.name ?? "Lanceur",
      img: casterToken?.document?.texture?.src ?? caster.img,
      type: contextLabel,
      meta: sourceLabel
    },
    rows,
    trustedBodyHtml: `<div><small>${escapeHtml(ruleNote)}${effectRelayed ? " Application de l’effet demandée au MJ." : ""}</small></div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          version: VERSION,
          spell: SPELL_SLUG,
          context,
          sourceObjectId: sourceObject?.id ?? null,
          sourcePowerId: (sourcePower?.id ?? powerId) || null,
          targetActorId: targetActor.id ?? null,
          targetTokenId: targetToken.document?.id ?? targetToken.id ?? null,
          distanceSpaces,
          rangeSpaces,
          obstacle: obstacleChoice.obstacle,
          obstacleBlocked,
          deviceFailed,
          resistancePercent,
          resistanceBlocked
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("E.S.P. : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(card);

  return true;
})();
