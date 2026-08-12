/**
 * ADD2E — Détection du mal / Détection du bien.
 * Source canonique : Item sort du compendium ADD2E.
 * Portée AD&D résolue par add2eResolveSpellDistance.
 * Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l’API ADD2E commune.
 */

const ADD2E_DETECTION_ALIGNEMENT_VERSION = "2026-08-12-canonical-spell-runtime-v4";
console.log("[ADD2E][DETECTION_ALIGNEMENT][VERSION]", ADD2E_DETECTION_ALIGNEMENT_VERSION);

const __add2eOnUseResult = await (async () => {
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const sourceItem = (typeof sort !== "undefined" && sort?.type === "sort")
    ? sort
    : ((typeof item !== "undefined" && item?.type === "sort") ? item : null);
  if (!sourceItem) {
    ui.notifications.error("Détection du mal / Détection du bien : Item sort canonique introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Détection du mal / Détection du bien : lanceur introuvable.");
    return false;
  }

  if (typeof globalThis.add2eNormalizeSpellKey !== "function"
    || typeof globalThis.add2eGetSpellListsFromItem !== "function"
    || typeof globalThis.add2eResolveSpellDistance !== "function") {
    ui.notifications.error("Détection du mal / Détection du bien : règles canoniques de sorts ADD2E indisponibles.");
    return false;
  }
  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications.error("L’API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const familyKindRaw = sourceItem.flags?.add2e?.spellFamily?.kind;
  const familyKind = familyKindRaw === undefined || familyKindRaw === null || familyKindRaw === ""
    ? "base"
    : globalThis.add2eNormalizeSpellKey(familyKindRaw);
  if (!["base", "inverse"].includes(familyKind)) {
    ui.notifications.error(`Détection du mal / Détection du bien : spellFamily.kind canonique invalide (${String(familyKindRaw)}).`);
    return false;
  }

  const mode = familyKind === "inverse" ? "bien" : "mal";
  const spellKey = mode === "bien" ? "detection_du_bien" : "detection_du_mal";
  const spellName = mode === "bien" ? "Détection du bien" : "Détection du mal";

  const spellLevel = Number(sourceItem.system?.niveau);
  if (!Number.isInteger(spellLevel) || spellLevel < 1) {
    ui.notifications.error(`${spellName} : system.niveau canonique invalide.`);
    return false;
  }

  const spellLists = globalThis.add2eGetSpellListsFromItem(sourceItem);
  if (!Array.isArray(spellLists)) {
    ui.notifications.error(`${spellName} : listes de sorts canoniques invalides.`);
    return false;
  }

  const resolveCastingProfile = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const casterLevel = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(casterLevel) || casterLevel < 1) {
        throw new Error(`${spellName} : casterLevel canonique absent du pouvoir d’objet magique.`);
      }
      const supportedLists = spellLists
        .map(value => globalThis.add2eNormalizeSpellKey(value))
        .filter(value => ["clerc", "magicien"].includes(value));
      const uniqueLists = [...new Set(supportedLists)];
      if (uniqueLists.length !== 1) {
        throw new Error(`${spellName} : le pouvoir d’objet doit porter exactement une liste canonique Clerc ou Magicien.`);
      }
      return { casterLevel, listKey: uniqueLists[0], access: null };
    }

    if (typeof globalThis.add2eCanActorUseSpell !== "function") {
      throw new Error(`${spellName} : résolveur canonique d’accès aux sorts indisponible.`);
    }
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    if (access?.ok !== true) {
      throw new Error(`${spellName} : accès canonique au sort refusé (${access?.reason ?? "raison inconnue"}).`);
    }
    const casterLevel = Number(access.actorLevel);
    if (!Number.isInteger(casterLevel) || casterLevel < 1) {
      throw new Error(`${spellName} : niveau canonique du lanceur invalide.`);
    }
    const listKey = globalThis.add2eNormalizeSpellKey(access.entry?.key);
    if (!["clerc", "magicien"].includes(listKey)) {
      throw new Error(`${spellName} : liste de lancement canonique non supportée (${String(access.entry?.key ?? "absente")}).`);
    }
    return { casterLevel, listKey, access };
  };

  let casting;
  try {
    casting = resolveCastingProfile();
  } catch (error) {
    console.error("[ADD2E][DETECTION_ALIGNEMENT][CASTING_PROFILE]", {
      actor: caster.name,
      spell: sourceItem.name,
      error
    });
    ui.notifications.error(error.message);
    return false;
  }

  const { casterLevel, listKey } = casting;
  const classLabel = typeof globalThis.add2eSpellLabel === "function"
    ? globalThis.add2eSpellLabel(listKey)
    : (listKey === "clerc" ? "Clerc" : "Magicien");

  const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc.actor?.id === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;
  if (!casterToken) {
    ui.notifications.warn(`${spellName} : le lanceur doit être présent sur la scène.`);
    return false;
  }

  const environment = await globalThis.add2eDialogWait({
    add2eTheme: listKey === "magicien" ? "wizard" : "parchment",
    add2ePrimaryAction: "interieur",
    add2eClasses: ["add2e-detection-alignement-context"],
    window: { title: spellName },
    content: `
      <form class="add2e-detection-alignement-form">
        <p>Choisissez le contexte de portée pour ce lancement.</p>
        <p>La zone d’effet conserve sa largeur normale dans les deux contextes.</p>
      </form>`,
    buttons: [
      {
        action: "interieur",
        label: "Intérieur",
        icon: "<i class='fas fa-building'></i>",
        default: true,
        callback: () => "interieur"
      },
      {
        action: "exterieur",
        label: "Extérieur",
        icon: "<i class='fas fa-tree'></i>",
        callback: () => "exterieur"
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
  if (!environment) return false;

  const parseRangeInches = value => {
    const match = String(value ?? "").trim().match(/^(\d+(?:[.,]\d+)?)\s*"$/);
    if (!match) throw new Error(`${spellName} : portée canonique invalide (${String(value ?? "vide")}).`);
    return Number(match[1].replace(",", "."));
  };
  const parseWidthInches = value => {
    const match = String(value ?? "").trim().match(/^(\d+(?:[.,]\d+)?)\s*"\s*de\s*large$/i);
    if (!match) throw new Error(`${spellName} : zone_effet canonique invalide (${String(value ?? "vide")}).`);
    return Number(match[1].replace(",", "."));
  };

  let range;
  let width;
  try {
    const rangeInches = parseRangeInches(sourceItem.system?.portee);
    const widthInches = parseWidthInches(sourceItem.system?.zone_effet);
    range = globalThis.add2eResolveSpellDistance(rangeInches, { environment, kind: "range" });
    width = globalThis.add2eResolveSpellDistance(widthInches, { environment, kind: "area" });
  } catch (error) {
    console.error("[ADD2E][DETECTION_ALIGNEMENT][DISTANCE]", {
      spell: sourceItem.name,
      portee: sourceItem.system?.portee,
      zone_effet: sourceItem.system?.zone_effet,
      environment,
      error
    });
    ui.notifications.error(error.message);
    return false;
  }

  const rounds = listKey === "clerc"
    ? 10 + (5 * casterLevel)
    : 5 * casterLevel;
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const tags = [
    `sort:${spellKey}`,
    `liste:${listKey}`,
    `niveau:${spellLevel}`,
    "detection:alignement",
    `detection:${mode}`
  ];
  const timeFlags = time?.flags?.({
    source: "detection-du-mal.js",
    rounds,
    unit: "round",
    endMessage: `La ${spellName.toLowerCase()} de {actor} prend fin.`,
    extra: {
      spellName,
      spellKey,
      mode,
      sourceItemUuid: sourceItem.uuid,
      casterId: caster.id,
      casterUuid: caster.uuid,
      casterLevel,
      listKey,
      environment,
      rangeMeters: range.meters,
      widthMeters: width.meters,
      direction: "devant le lanceur",
      tags
    }
  }) ?? {};
  const effectData = {
    name: spellName,
    img: sourceItem.img || "systems/add2e/assets/icones/sorts/detection-du-mal.webp",
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration,
    description: `${spellName} : détection dans la zone devant le lanceur.`,
    flags: {
      add2e: {
        ...timeFlags,
        spellName,
        spellKey,
        mode,
        sourceItemUuid: sourceItem.uuid,
        casterId: caster.id,
        casterUuid: caster.uuid,
        casterLevel,
        spellLevel,
        listKey,
        environment,
        rangeMeters: range.meters,
        widthMeters: width.meters,
        direction: "devant le lanceur",
        tags,
        version: ADD2E_DETECTION_ALIGNEMENT_VERSION
      }
    },
    changes: []
  };
  const previous = Array.from(caster.effects ?? []).find(effect => effect.flags?.add2e?.spellKey === spellKey) ?? null;
  if (previous) await previous.update(effectData);
  else await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

  const normalizeUnit = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const sceneUnitMeters = value => {
    const key = normalizeUnit(value);
    if (["m", "metre", "metres", "meter", "meters"].includes(key)) return 1;
    if (["ft", "foot", "feet", "pied", "pieds", "pi"].includes(key)) return 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(key)) return 0.9144;
    if (["km", "kilometre", "kilometres", "kilometer", "kilometers"].includes(key)) return 1000;
    throw new Error(`${spellName} : unité de grille Foundry non supportée (${String(value ?? "vide")}).`);
  };

  let rangePixels;
  let halfWidthPixels;
  try {
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size);
    const gridDistance = Number(canvas.scene?.grid?.distance);
    if (!(gridSize > 0) || !(gridDistance > 0)) {
      throw new Error(`${spellName} : configuration de grille Foundry invalide.`);
    }
    const metersPerGridUnit = sceneUnitMeters(canvas.scene?.grid?.units);
    const metersPerGridSpace = gridDistance * metersPerGridUnit;
    rangePixels = (range.meters / metersPerGridSpace) * gridSize;
    halfWidthPixels = ((width.meters / 2) / metersPerGridSpace) * gridSize;
  } catch (error) {
    console.error("[ADD2E][DETECTION_ALIGNEMENT][SCENE_GRID]", { scene: canvas.scene?.name, error });
    ui.notifications.error(error.message);
    return false;
  }

  const rotation = Number(casterToken.document?.rotation ?? casterToken.rotation ?? 0) || 0;
  const radians = (rotation * Math.PI / 180) - (Math.PI / 2);
  const forward = { x: Math.cos(radians), y: Math.sin(radians) };
  const right = { x: -forward.y, y: forward.x };
  const origin = casterToken.center;

  const hasDetectedAlignment = targetActor => {
    const alignment = globalThis.add2eNormalizeSpellKey(targetActor?.system?.alignement);
    if (mode === "bien") return alignment.includes("bon");
    if (alignment.includes("mauvais")) return true;
    return Array.from(targetActor?.items ?? []).some(targetItem => targetItem?.system?.maudit === true);
  };

  const matches = [];
  for (const targetToken of canvas.tokens?.placeables ?? []) {
    if (!targetToken?.actor || targetToken.id === casterToken.id) continue;
    if (targetToken.document?.hidden && !game.user?.isGM) continue;

    const dx = targetToken.center.x - origin.x;
    const dy = targetToken.center.y - origin.y;
    const forwardDistance = (dx * forward.x) + (dy * forward.y);
    const sideDistance = Math.abs((dx * right.x) + (dy * right.y));
    if (forwardDistance < 0 || forwardDistance > rangePixels || sideDistance > halfWidthPixels) continue;
    if (!hasDetectedAlignment(targetToken.actor)) continue;
    matches.push({ name: targetToken.actor.name });
  }

  const sideLabel = mode === "bien" ? "bien" : "mal";
  const resultRows = matches.length
    ? matches.map(match => {
        const detail = listKey === "magicien"
          ? "intensité à déterminer par le MD"
          : "degré et nature générale à déterminer par le MD";
        return `<li><b>${escapeHtml(match.name)}</b> : émanation du ${sideLabel} — ${detail}.</li>`;
      }).join("")
    : `<li>Aucune émanation du ${sideLabel} détectée parmi les présences accessibles dans la zone.</li>`;

  const tendencyChance = Math.min(100, casterLevel * 10);
  const ruleNotes = listKey === "magicien"
    ? `<p>Le magicien ne perçoit que l’intensité de l’émanation. Son degré exact reste à déterminer par le MD.</p>`
    : `<p>Le clerc perçoit le degré et la nature générale de l’émanation. Si le MD détermine qu’elle est extraordinaire, la chance d’en connaître la tendance est de <b>${tendencyChance}%</b>.</p>`;

  const card = {
    actor: caster,
    title: spellName,
    icon: "fas fa-eye",
    variant: "spell",
    source: {
      name: caster.name,
      img: caster.img,
      type: `${classLabel} niveau ${casterLevel}`
    },
    rows: [
      { label: "Contexte", value: environment === "exterieur" ? "Extérieur" : "Intérieur" },
      { label: "Portée", value: `${range.inches}\" = ${range.meters} m` },
      { label: "Zone", value: `${width.inches}\" de large = ${width.meters} m` },
      { label: "Durée", value: `${rounds} rounds` },
      { label: "Direction", value: "Devant le lanceur" }
    ],
    message: `${caster.name} se concentre sur les émanations du ${sideLabel}.`,
    trustedBodyHtml: `
      <div class="add2e-detection-alignement-results">
        <ul>${resultRows}</ul>
        ${ruleNotes}
        <p>Les objets ou présences non représentés par un token restent à l’appréciation du MD.</p>
      </div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      flags: {
        add2e: {
          spell: spellKey,
          mode,
          casterLevel,
          spellLevel,
          listKey,
          environment,
          rangeInches: range.inches,
          rangeMeters: range.meters,
          widthInches: width.inches,
          widthMeters: width.meters,
          durationRounds: rounds,
          sourceItemUuid: sourceItem.uuid,
          version: ADD2E_DETECTION_ALIGNEMENT_VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) {
    throw new Error(`${spellName} : carte ADD2E vide.`);
  }
  await globalThis.add2eCreateChatCard(card);

  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.(spellKey, { casterToken });
  } catch (_error) {}
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Détection du mal / Détection du bien : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
