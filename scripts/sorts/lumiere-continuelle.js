/**
 * ADD2E — Lumière éternelle / Ténèbres éternelles (Clerc)
 * Runtime canonique spécifique au sort réversible de Clerc niveau 3.
 * Les valeurs de portée et de zone proviennent exclusivement de l'Item sort lancé.
 * Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l'API ADD2E commune.
 */

const ADD2E_ETERNAL_LIGHT_VERSION = "2026-08-12-canonical-eternal-light-runtime-v1";

function add2eEternalLightEmitGMOperation(operation, payload) {
  if (!game.socket) return false;
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
  });
  return true;
}

globalThis.ADD2E_ETERNAL_LIGHT_FIND_AMBIENT = payload => {
  if (!payload) return null;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  if (!scene) return null;

  if (payload.lightId) {
    const byId = scene.lights?.get(payload.lightId) ?? null;
    if (byId) return byId;
  }

  if (payload.requestId) {
    const byRequest = scene.lights?.find(light =>
      light.flags?.add2e?.requestId === payload.requestId
      || light.getFlag?.("add2e", "requestId") === payload.requestId
    ) ?? null;
    if (byRequest) return byRequest;
  }

  return null;
};

globalThis.ADD2E_ETERNAL_LIGHT_DELETE_AMBIENT = async payload => {
  if (!payload || payload.type !== "ambient") return;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  if (!scene) return;
  const light = globalThis.ADD2E_ETERNAL_LIGHT_FIND_AMBIENT(payload);

  if (game.user.isGM) {
    if (light) await light.delete();
    return;
  }

  add2eEternalLightEmitGMOperation("deleteAmbientLight", {
    sceneId: scene.id,
    lightId: light?.id ?? payload.lightId ?? null,
    requestId: payload.requestId ?? null,
    actorId: payload.actorId ?? null,
    actorUuid: payload.actorUuid ?? null,
    spellKey: payload.spellKey ?? null,
    x: payload.x ?? null,
    y: payload.y ?? null
  });
};

globalThis.ADD2E_ETERNAL_LIGHT_RESTORE_TOKEN_LIGHT = async payload => {
  if (!payload || payload.type !== "token") return;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  const tokenDoc = scene?.tokens?.get(payload.tokenId) ?? null;
  if (!tokenDoc) return;

  const originalLight = payload.originalLight && typeof payload.originalLight === "object"
    ? foundry.utils.deepClone(payload.originalLight)
    : {};

  if (game.user.isGM || tokenDoc.isOwner) {
    await tokenDoc.update({ light: originalLight });
    return;
  }

  add2eEternalLightEmitGMOperation("updateToken", {
    sceneId: scene.id,
    tokenId: tokenDoc.id,
    updateData: { light: originalLight }
  });
};

if (globalThis.ADD2E_ETERNAL_LIGHT_HOOKS_VERSION !== ADD2E_ETERNAL_LIGHT_VERSION) {
  globalThis.ADD2E_ETERNAL_LIGHT_HOOKS_VERSION = ADD2E_ETERNAL_LIGHT_VERSION;

  const cleanup = async effect => {
    const payload = effect?.flags?.add2e?.lightPayload ?? effect?.getFlag?.("add2e", "lightPayload");
    if (!payload) return;
    if (payload.type === "ambient") await globalThis.ADD2E_ETERNAL_LIGHT_DELETE_AMBIENT(payload);
    if (payload.type === "token") await globalThis.ADD2E_ETERNAL_LIGHT_RESTORE_TOKEN_LIGHT(payload);
  };

  Hooks.on("deleteActiveEffect", cleanup);
  Hooks.on("updateActiveEffect", async (effect, changes) => {
    if (changes?.disabled === true) await cleanup(effect);
  });
}

return await (async () => {
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const sourceItem = (typeof sort !== "undefined" && sort?.type === "sort")
    ? sort
    : ((typeof item !== "undefined" && item?.type === "sort")
      ? item
      : ((typeof spell !== "undefined" && spell?.type === "sort")
        ? spell
        : ((typeof args !== "undefined" && args?.[0]?.item?.type === "sort") ? args[0].item : null)));
  if (!sourceItem) {
    ui.notifications.error("Lumière éternelle / Ténèbres éternelles : Item sort canonique introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Lumière éternelle / Ténèbres éternelles : lanceur introuvable.");
    return false;
  }

  if (typeof globalThis.add2eNormalizeSpellKey !== "function"
    || typeof globalThis.add2eGetSpellListsFromItem !== "function"
    || typeof globalThis.add2eResolveSpellDistance !== "function") {
    ui.notifications.error("Lumière éternelle / Ténèbres éternelles : règles canoniques de sorts ou de distance ADD2E indisponibles.");
    return false;
  }
  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications.error("L'API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Lumière éternelle / Ténèbres éternelles : constructeurs communs de cartes ADD2E indisponibles.");
    return false;
  }

  const familyKindRaw = sourceItem.flags?.add2e?.spellFamily?.kind;
  const familyKind = familyKindRaw === undefined || familyKindRaw === null || familyKindRaw === ""
    ? "base"
    : String(familyKindRaw).trim().toLowerCase();
  if (!["base", "inverse"].includes(familyKind)) {
    ui.notifications.error(`Lumière éternelle / Ténèbres éternelles : spellFamily.kind canonique invalide (${String(familyKindRaw)}).`);
    return false;
  }

  const isDarkness = familyKind === "inverse";
  const spellName = isDarkness ? "Ténèbres éternelles" : "Lumière éternelle";
  const spellKey = isDarkness ? "tenebres_eternelles" : "lumiere_eternelle";

  const spellLevel = Number(sourceItem.system?.niveau);
  if (!Number.isInteger(spellLevel) || spellLevel < 1) {
    ui.notifications.error(`${spellName} : system.niveau canonique invalide.`);
    return false;
  }

  const spellLists = globalThis.add2eGetSpellListsFromItem(sourceItem);
  if (!Array.isArray(spellLists) || !spellLists.length) {
    ui.notifications.error(`${spellName} : system.spellLists canonique invalide.`);
    return false;
  }

  const resolveCastingProfile = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const casterLevel = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(casterLevel) || casterLevel < 1) {
        throw new Error(`${spellName} : casterLevel canonique absent du pouvoir d'objet magique.`);
      }
      const supportedLists = spellLists
        .map(value => globalThis.add2eNormalizeSpellKey(value))
        .filter(value => value === "clerc");
      const uniqueLists = [...new Set(supportedLists)];
      if (uniqueLists.length !== 1) {
        throw new Error(`${spellName} : ce runtime attend exactement la liste canonique Clerc.`);
      }
      return { casterLevel, listKey: "clerc", access: null };
    }

    if (typeof globalThis.add2eCanActorUseSpell !== "function") {
      throw new Error(`${spellName} : résolveur canonique d'accès aux sorts indisponible.`);
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
    if (listKey !== "clerc") {
      throw new Error(`${spellName} : ce runtime est réservé au sort réversible de Clerc.`);
    }
    return { casterLevel, listKey, access };
  };

  let casting;
  try {
    casting = resolveCastingProfile();
  } catch (error) {
    console.error("[ADD2E][LUMIERE_ETERNELLE][CASTING_PROFILE]", { actor: caster.name, spell: sourceItem.name, error });
    ui.notifications.error(error.message);
    return false;
  }

  const { casterLevel, listKey } = casting;
  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  if (!casterToken) {
    ui.notifications.warn(`${spellName} : le lanceur doit être présent sur la scène.`);
    return false;
  }
  if (!canvas.scene) {
    ui.notifications.warn(`${spellName} : aucune scène active.`);
    return false;
  }

  const environment = await globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "interieur",
    add2eClasses: ["add2e-lumiere-eternelle-context"],
    window: { title: spellName },
    content: `
      <form class="add2e-lumiere-eternelle-context-form">
        <p>Choisissez le contexte de portée pour ce lancement.</p>
        <p>La zone d'effet conserve ses dimensions normales dans les deux contextes.</p>
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

  const canonicalText = (value, field) => {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valeur")) {
      const text = String(value.valeur ?? "").trim();
      if (text) return text;
    }
    throw new Error(`${spellName} : ${field} canonique invalide.`);
  };

  const normalizeRuleText = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[″”]/g, "\"")
    .replace(/\s+/g, " ");

  const parseRangeInches = value => {
    const text = canonicalText(value, "system.portee");
    const normalized = normalizeRuleText(text);
    const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(?:\"|pouces?)$/);
    if (!match) throw new Error(`${spellName} : portée canonique non supportée (${text}).`);
    return Number(match[1].replace(",", "."));
  };

  const parseRadiusInches = value => {
    const text = canonicalText(value, "system.zone_effet");
    const normalized = normalizeRuleText(text);
    const match = normalized.match(/^sphere de (\d+(?:[.,]\d+)?)\s*(?:\"|pouces?) de rayon$/);
    if (!match) throw new Error(`${spellName} : zone_effet canonique non supportée (${text}).`);
    return Number(match[1].replace(",", "."));
  };

  const assertPermanentDuration = value => {
    const text = canonicalText(value, "system.duree");
    const normalized = normalizeRuleText(text);
    if (!["permanente", "permanent"].includes(normalized)) {
      throw new Error(`${spellName} : durée canonique non supportée (${text}).`);
    }
  };

  const sceneMetersPerUnit = scene => {
    const unit = String(scene?.grid?.units ?? "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const factors = new Map([
      ["m", 1], ["metre", 1], ["metres", 1], ["meter", 1], ["meters", 1],
      ["km", 1000], ["kilometre", 1000], ["kilometres", 1000], ["kilometer", 1000], ["kilometers", 1000],
      ["cm", 0.01], ["centimetre", 0.01], ["centimetres", 0.01], ["centimeter", 0.01], ["centimeters", 0.01],
      ["ft", 0.3048], ["foot", 0.3048], ["feet", 0.3048], ["pied", 0.3048], ["pieds", 0.3048],
      ["yd", 0.9144], ["yard", 0.9144], ["yards", 0.9144]
    ]);
    const factor = factors.get(unit);
    if (!(factor > 0)) {
      throw new Error(`${spellName} : unité de distance de scène non supportée (${scene?.grid?.units || "vide"}).`);
    }
    return factor;
  };

  const sceneDistanceFromMeters = (scene, meters) => {
    const distanceMeters = Number(meters);
    const gridDistance = Number(scene?.grid?.distance);
    const gridSize = Number(scene?.grid?.size);
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
      throw new Error(`${spellName} : distance canonique invalide (${String(meters)} m).`);
    }
    if (!(gridDistance > 0) || !(gridSize > 0)) {
      throw new Error(`${spellName} : configuration de grille Foundry invalide.`);
    }
    const sceneDistance = distanceMeters / sceneMetersPerUnit(scene);
    return {
      radiusSceneDistance: sceneDistance,
      radiusPixels: (sceneDistance / gridDistance) * gridSize
    };
  };

  let rangeRule;
  let radiusRule;
  let rangeScene;
  let radiusScene;
  try {
    const rangeInches = parseRangeInches(sourceItem.system?.portee);
    const radiusInches = parseRadiusInches(sourceItem.system?.zone_effet);
    assertPermanentDuration(sourceItem.system?.duree);
    rangeRule = globalThis.add2eResolveSpellDistance(rangeInches, { environment, kind: "range" });
    radiusRule = globalThis.add2eResolveSpellDistance(radiusInches, { environment, kind: "area" });
    rangeScene = sceneDistanceFromMeters(canvas.scene, rangeRule.meters);
    radiusScene = sceneDistanceFromMeters(canvas.scene, radiusRule.meters);
    if (!(rangeScene?.radiusPixels >= 0) || !(radiusScene?.radiusSceneDistance >= 0)) {
      throw new Error(`${spellName} : résolution de portée ou de zone invalide.`);
    }
  } catch (error) {
    console.error("[ADD2E][LUMIERE_ETERNELLE][RULES]", {
      spell: sourceItem.name,
      portee: sourceItem.system?.portee,
      zone_effet: sourceItem.system?.zone_effet,
      duree: sourceItem.system?.duree,
      environment,
      error
    });
    ui.notifications.error(error.message);
    return false;
  }

  const withinRange = point => {
    const from = casterToken.center;
    const distancePixels = Math.hypot(Number(point?.x ?? 0) - Number(from?.x ?? 0), Number(point?.y ?? 0) - Number(from?.y ?? 0));
    return distancePixels <= Number(rangeScene.radiusPixels) + 0.1;
  };

  const hasBlockingWall = (from, to) => {
    try {
      if (!canvas.walls?.checkCollision || typeof Ray === "undefined") return false;
      return canvas.walls.checkCollision(new Ray(from, to), { type: "sight", mode: "any" }) === true;
    } catch (_error) {
      return false;
    }
  };

  const chooseCanvasPoint = () => {
    ui.notifications.info(`${spellName} : clique sur la scène pour choisir le point d'effet. Échap ou clic droit annule.`);
    return new Promise(resolve => {
      const stage = canvas.stage;
      if (!stage?.on || !stage?.off) {
        ui.notifications.error(`${spellName} : sélection de point indisponible sur cette scène.`);
        resolve(null);
        return;
      }

      let finished = false;
      const finish = point => {
        if (finished) return;
        finished = true;
        stage.off("pointerdown", onPointerDown);
        window.removeEventListener("keydown", onKeyDown, true);
        resolve(point);
      };
      const onKeyDown = event => {
        if (event.key === "Escape") {
          event.preventDefault?.();
          finish(null);
        }
      };
      const onPointerDown = event => {
        const button = Number(event?.button ?? event?.nativeEvent?.button ?? event?.data?.originalEvent?.button ?? 0);
        if (button === 2) return finish(null);
        if (button !== 0) return;

        event?.stopPropagation?.();
        event?.data?.originalEvent?.preventDefault?.();
        const point = event?.getLocalPosition?.(stage)
          ?? event?.data?.getLocalPosition?.(stage)
          ?? stage.toLocal?.(event?.global ?? event?.data?.global ?? null)
          ?? null;
        if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
          ui.notifications.warn(`${spellName} : position de la scène illisible.`);
          return finish(null);
        }
        finish({ x: Number(point.x), y: Number(point.y) });
      };

      stage.on("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown, true);
    });
  };

  const chooseCreatureTarget = async () => {
    const selected = Array.from(game.user.targets ?? []).filter(target => !!target?.actor);
    if (selected.length > 1) {
      ui.notifications.warn(`${spellName} : garde une seule créature ciblée.`);
      return null;
    }
    if (selected.length === 1) return selected[0];

    ui.notifications.info(`${spellName} : cible une créature avec le ciblage Foundry. Échap annule.`);
    return new Promise(resolve => {
      let finished = false;
      let hookId = null;
      const finish = target => {
        if (finished) return;
        finished = true;
        if (hookId !== null) Hooks.off("targetToken", hookId);
        window.removeEventListener("keydown", onKeyDown, true);
        resolve(target);
      };
      const onKeyDown = event => {
        if (event.key !== "Escape") return;
        event.preventDefault?.();
        finish(null);
      };
      const onTargetToken = (user, target, targeted) => {
        if (user?.id !== game.user?.id || targeted !== true || !target?.actor) return;
        finish(target);
      };

      hookId = Hooks.on("targetToken", onTargetToken);
      window.addEventListener("keydown", onKeyDown, true);
    });
  };

  const chooseCarriedObject = async bearerActor => {
    const candidates = Array.from(bearerActor?.items ?? [])
      .filter(entry => entry?.type !== "sort")
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "fr"));
    if (!candidates.length) {
      ui.notifications.warn(`${spellName} : ${bearerActor?.name ?? "la cible"} ne porte aucun objet sélectionnable.`);
      return null;
    }

    const optionsHtml = candidates
      .map(entry => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`)
      .join("");

    const itemId = await globalThis.add2eDialogWait({
      add2eTheme: "parchment",
      add2ePrimaryAction: "select",
      add2eClasses: ["add2e-lumiere-eternelle-object"],
      window: { title: `${spellName} — objet porté` },
      content: `
        <form class="add2e-lumiere-eternelle-object-form">
          <p>Choisissez l'objet porté par <b>${escapeHtml(bearerActor.name)}</b>.</p>
          <div class="form-group">
            <label>Objet</label>
            <select name="itemId">${optionsHtml}</select>
          </div>
        </form>`,
      buttons: [
        {
          action: "select",
          label: "Choisir",
          icon: "<i class='fas fa-hand-holding'></i>",
          default: true,
          callback: (_event, button) => button.form?.elements?.itemId?.value ?? null
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
    if (!itemId) return null;
    return bearerActor.items?.get?.(itemId) ?? candidates.find(entry => entry.id === itemId) ?? null;
  };

  const magicResistance = targetActor => {
    const engine = globalThis.ADD2E_EFFECTS;
    if (!engine || typeof engine.checkResistanceDetails !== "function") {
      throw new Error(`${spellName} : résolveur canonique de résistance magique indisponible.`);
    }
    const result = engine.checkResistanceDetails(targetActor, "magie", { chat: false });
    if (!result?.found) return { applicable: false, resisted: false, chance: 0, roll: null, source: "" };
    return {
      applicable: true,
      resisted: result.resiste === true,
      chance: Number(result.pct) || 0,
      roll: Number(result.jet) || null,
      source: result.tag ?? "resistance:magie"
    };
  };

  const lightConfiguration = () => {
    const radius = Number(radiusScene.radiusSceneDistance);
    if (isDarkness) {
      return {
        dim: radius,
        bright: 0,
        angle: 360,
        color: "#000000",
        alpha: 1,
        coloration: 1,
        luminosity: -1,
        attenuation: 0.5,
        animation: { type: null, speed: 5, intensity: 5, reverse: false }
      };
    }
    return {
      dim: radius,
      bright: radius,
      angle: 360,
      color: "#fffbd0",
      alpha: 0.55,
      coloration: 1,
      luminosity: 0.75,
      attenuation: 0.35,
      animation: { type: null, speed: 5, intensity: 5, reverse: false }
    };
  };

  const effectTags = ({ destination, blinded = false, objectItem = null }) => [
    `sort:${spellKey}`,
    "liste:clerc",
    `niveau:${spellLevel}`,
    `etat:${spellKey}`,
    "famille:lumiere_eternelle",
    isDarkness ? "tenebres:eternelles" : "lumiere:eternelle",
    "permanent",
    `lumiere_destination:${destination}`,
    ...(blinded ? ["etat:cecite", "aveugle", "lumiere:aveuglement"] : []),
    ...(objectItem ? [`objet:${globalThis.add2eNormalizeSpellKey(objectItem.name)}`] : []),
    destination === "point" || destination === "derriere" ? "ambient_light" : "illumination:token"
  ];

  const effectData = ({ targetActor = null, destination, payload, blinded = false, objectItem = null }) => {
    const tags = effectTags({ destination, blinded, objectItem });
    return {
      name: destination === "point" || destination === "derriere" ? `${spellName} : zone` : spellName,
      img: sourceItem.img || (isDarkness ? "icons/magic/unholy/projectile-smoke-black.webp" : "icons/svg/light.svg"),
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: { startTime: game.time?.worldTime ?? null },
      description: blinded
        ? `${spellName} est permanent jusqu'à annulation ou dissipation. La cible est aveuglée.`
        : `${spellName} est permanent jusqu'à annulation ou dissipation.`,
      flags: {
        add2e: {
          permanent: true,
          spellName,
          spellKey,
          familyKind,
          familyKey: "lumiere_eternelle",
          sourceItemUuid: sourceItem.uuid ?? null,
          casterId: caster.id,
          casterUuid: caster.uuid,
          casterLevel,
          spellLevel,
          listKey,
          environment,
          rangeMeters: rangeRule.meters,
          radiusMeters: radiusRule.meters,
          targetId: targetActor?.id ?? null,
          targetUuid: targetActor?.uuid ?? null,
          destination,
          blinded,
          objectItemId: objectItem?.id ?? null,
          objectItemUuid: objectItem?.uuid ?? null,
          objectItemName: objectItem?.name ?? null,
          lightPayload: payload,
          tags,
          version: ADD2E_ETERNAL_LIGHT_VERSION
        }
      },
      changes: []
    };
  };

  const updateTokenLight = async (tokenDoc, config) => {
    if (!tokenDoc) return false;
    const updateData = { light: config };
    if (game.user.isGM || tokenDoc.isOwner) {
      await tokenDoc.update(updateData);
      return true;
    }
    return add2eEternalLightEmitGMOperation("updateToken", {
      sceneId: tokenDoc.parent?.id ?? canvas.scene?.id ?? null,
      tokenId: tokenDoc.id,
      updateData
    });
  };

  const createAmbient = async (point, config, destination) => {
    const scene = canvas.scene;
    if (!scene) return { ok: false, payload: null };

    const requestId = foundry.utils.randomID();
    const flags = {
      add2e: {
        spellName,
        spellKey,
        familyKey: "lumiere_eternelle",
        actorId: caster.id,
        actorUuid: caster.uuid,
        requestId,
        destination,
        fromUserId: game.user.id
      }
    };
    const ambientData = {
      x: point.x,
      y: point.y,
      rotation: 0,
      walls: true,
      vision: isDarkness,
      config,
      flags
    };

    let lightId = null;
    if (game.user.isGM) {
      const created = await scene.createEmbeddedDocuments("AmbientLight", [ambientData]);
      lightId = created?.[0]?.id ?? null;
      if (!lightId) return { ok: false, payload: null };
    } else {
      const sent = add2eEternalLightEmitGMOperation("createAmbientLight", {
        sceneId: scene.id,
        x: point.x,
        y: point.y,
        rotation: 0,
        walls: true,
        vision: isDarkness,
        dim: config.dim,
        bright: config.bright,
        angle: config.angle,
        color: config.color,
        alpha: config.alpha,
        coloration: config.coloration,
        luminosity: config.luminosity,
        attenuation: config.attenuation,
        animation: config.animation,
        flags
      });
      if (!sent) return { ok: false, payload: null };
    }

    return {
      ok: true,
      payload: {
        type: "ambient",
        sceneId: scene.id,
        lightId,
        requestId,
        actorId: caster.id,
        actorUuid: caster.uuid,
        spellKey,
        x: point.x,
        y: point.y
      }
    };
  };

  const trackedTokenEffectIds = (actorDoc, tokenId) => Array.from(actorDoc?.effects ?? [])
    .filter(effect => {
      const payload = effect?.flags?.add2e?.lightPayload ?? effect?.getFlag?.("add2e", "lightPayload");
      const familyKey = effect?.flags?.add2e?.familyKey ?? effect?.getFlag?.("add2e", "familyKey");
      return familyKey === "lumiere_eternelle" && payload?.type === "token" && payload?.tokenId === tokenId;
    })
    .map(effect => effect.id)
    .filter(Boolean);

  const createTrackedEffect = async (actorDoc, data, tokenId = null) => {
    if (!actorDoc) return false;
    const previousIds = tokenId ? trackedTokenEffectIds(actorDoc, tokenId) : [];

    if (game.user.isGM || actorDoc.isOwner) {
      if (previousIds.length) {
        for (const effectId of previousIds) {
          const previous = actorDoc.effects?.get?.(effectId) ?? null;
          const payload = previous?.flags?.add2e?.lightPayload ?? previous?.getFlag?.("add2e", "lightPayload");
          if (payload?.type === "token") await globalThis.ADD2E_ETERNAL_LIGHT_RESTORE_TOKEN_LIGHT(payload);
        }
        await actorDoc.deleteEmbeddedDocuments("ActiveEffect", previousIds);
      }
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [data]);
      return true;
    }

    return add2eEternalLightEmitGMOperation("createActiveEffect", {
      actorUuid: actorDoc.uuid,
      actorId: actorDoc.id,
      effectData: data,
      removeEffectIds: previousIds
    });
  };

  const pointBehindTarget = targetToken => {
    const origin = casterToken.center;
    const target = targetToken.center;
    const dx = Number(target.x) - Number(origin.x);
    const dy = Number(target.y) - Number(origin.y);
    const length = Math.hypot(dx, dy) || 1;
    const behind = sceneDistanceFromMeters(canvas.scene, 0.3).radiusPixels;
    const halfToken = Math.max(Number(targetToken.w ?? 0), Number(targetToken.h ?? 0)) / 2;
    const offset = halfToken + behind;
    return { x: target.x + ((dx / length) * offset), y: target.y + ((dy / length) * offset) };
  };

  const selectedTargets = Array.from(game.user.targets ?? []).filter(target => !!target?.actor);
  const selectedTargetLabel = selectedTargets.length === 1
    ? `Cible actuelle : ${escapeHtml(selectedTargets[0].name ?? selectedTargets[0].actor?.name ?? "créature")}.`
    : selectedTargets.length > 1
      ? `${selectedTargets.length} cibles sont actuellement sélectionnées.`
      : "Aucune créature n'est actuellement ciblée.";

  const destinationMode = await globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "creature",
    add2eClasses: ["add2e-lumiere-eternelle-destination"],
    window: { title: `${spellName} — destination` },
    content: `
      <form class="add2e-lumiere-eternelle-destination-form">
        <p>Choisissez la destination du sort.</p>
        <p>${selectedTargetLabel}</p>
        <p>« Objet porté » utilise l'inventaire du lanceur, ou celui de l'unique créature actuellement ciblée.</p>
      </form>`,
    buttons: [
      {
        action: "creature",
        label: "Créature",
        icon: "<i class='fas fa-crosshairs'></i>",
        default: true,
        callback: () => "creature"
      },
      {
        action: "object",
        label: "Objet porté",
        icon: "<i class='fas fa-hand-holding'></i>",
        callback: () => "object"
      },
      {
        action: "point",
        label: "Point sur la scène",
        icon: "<i class='fas fa-location-dot'></i>",
        callback: () => "point"
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
  if (!destinationMode) return false;

  const config = lightConfiguration();
  const details = [];
  let targetToken = null;
  let targetActor = null;
  let objectItem = null;
  let anchorActor = caster;
  let anchorEffect = null;
  let destinationLabel = "";
  let outcome = "";
  let saveResult = null;
  let resistanceResult = null;
  let blinded = false;

  if (destinationMode === "point") {
    const point = await chooseCanvasPoint();
    if (!point) return false;
    if (!withinRange(point)) {
      ui.notifications.warn(`${spellName} : le point est hors de portée (${rangeRule.inches}\").`);
      return false;
    }
    if (hasBlockingWall(casterToken.center, point)) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d'effet.`);
      return false;
    }

    const ambient = await createAmbient(point, config, "point");
    if (!ambient.ok) {
      ui.notifications.error(`${spellName} : impossible de créer la zone.`);
      return false;
    }
    anchorEffect = effectData({ destination: "point", payload: ambient.payload });
    destinationLabel = "Point choisi sur la scène";
    outcome = isDarkness ? "Zone de ténèbres éternelles créée" : "Zone de lumière éternelle créée";
  }

  if (destinationMode === "object") {
    if (selectedTargets.length > 1) {
      ui.notifications.warn(`${spellName} : garde au plus une créature ciblée pour choisir un objet porté.`);
      return false;
    }
    targetToken = selectedTargets[0] ?? casterToken;
    targetActor = targetToken.actor ?? null;
    if (!targetActor) {
      ui.notifications.warn(`${spellName} : porteur de l'objet introuvable.`);
      return false;
    }
    if (!withinRange(targetToken.center)) {
      ui.notifications.warn(`${spellName} : le porteur de l'objet est hors de portée (${rangeRule.inches}\").`);
      return false;
    }
    if (hasBlockingWall(casterToken.center, targetToken.center)) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d'effet.`);
      return false;
    }

    objectItem = await chooseCarriedObject(targetActor);
    if (!objectItem) return false;

    const tokenPayload = {
      type: "token",
      sceneId: targetToken.document?.parent?.id ?? canvas.scene?.id ?? null,
      tokenId: targetToken.id,
      actorId: targetActor.id,
      actorUuid: targetActor.uuid,
      spellKey,
      objectItemId: objectItem.id,
      objectItemUuid: objectItem.uuid ?? null,
      objectItemName: objectItem.name,
      originalLight: foundry.utils.deepClone(targetToken.document?.light ?? {})
    };

    const updated = await updateTokenLight(targetToken.document, config);
    if (!updated) {
      ui.notifications.error(`${spellName} : impossible de modifier la lumière du porteur.`);
      return false;
    }
    anchorActor = targetActor;
    anchorEffect = effectData({ targetActor, destination: "object", payload: tokenPayload, objectItem });
    destinationLabel = `${objectItem.name} — porté par ${targetToken.name ?? targetActor.name}`;
    outcome = isDarkness ? "Ténèbres éternelles liées à l'objet" : "Lumière éternelle liée à l'objet";
  }

  if (destinationMode === "creature") {
    targetToken = await chooseCreatureTarget();
    if (!targetToken) return false;
    targetActor = targetToken.actor ?? null;
    if (!targetActor) return false;

    if (!withinRange(targetToken.center)) {
      ui.notifications.warn(`${spellName} : cible hors de portée (${rangeRule.inches}\").`);
      return false;
    }
    if (hasBlockingWall(casterToken.center, targetToken.center)) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d'effet.`);
      return false;
    }

    const sameToken = targetToken.id === casterToken.id;
    const sameActor = targetActor.id === caster.id;
    const needsDefense = !sameToken && !sameActor;

    if (needsDefense) {
      try {
        resistanceResult = magicResistance(targetActor);
      } catch (error) {
        console.error("[ADD2E][LUMIERE_ETERNELLE][MAGIC_RESISTANCE]", { target: targetActor.name, error });
        ui.notifications.error(error.message);
        return false;
      }
      if (resistanceResult.applicable) {
        details.push(`Résistance magique : ${resistanceResult.roll}/${resistanceResult.chance}% — ${resistanceResult.resisted ? "réussie" : "échouée"}`);
      }
      if (resistanceResult.resisted) {
        outcome = "Résistance magique réussie — aucun effet";
      }
    }

    if (!outcome && needsDefense) {
      if (typeof globalThis.add2eRollSavingThrow !== "function") {
        ui.notifications.error(`${spellName} : résolveur canonique des jets de sauvegarde indisponible.`);
        return false;
      }
      saveResult = await globalThis.add2eRollSavingThrow(targetActor, "sorts", {
        source: `spell:${spellKey}`,
        sourceItem,
        caster,
        targetToken,
        createChat: false,
        showDice: true
      });
      if (!saveResult?.ok) {
        ui.notifications.error(`${spellName} : jet de sauvegarde indisponible pour ${targetToken.name ?? targetActor.name}.`);
        return false;
      }
      details.push(`Jet de protection : ${saveResult.d20}${saveResult.bonus ? `${saveResult.bonus >= 0 ? "+" : ""}${saveResult.bonus}` : ""} = ${saveResult.total} / ${saveResult.target} — ${saveResult.success ? "réussi" : "raté"}`);
    }

    if (!outcome && saveResult?.success === true) {
      const point = pointBehindTarget(targetToken);
      const ambient = await createAmbient(point, config, "derriere");
      if (!ambient.ok) {
        ui.notifications.error(`${spellName} : impossible de créer la zone 30 cm derrière la cible.`);
        return false;
      }
      anchorActor = caster;
      anchorEffect = effectData({ targetActor, destination: "derriere", payload: ambient.payload });
      destinationLabel = `${targetToken.name ?? targetActor.name} — 30 cm derrière`;
      outcome = "Jet de protection réussi — effet créé 30 cm derrière la cible";
    }

    if (!outcome) {
      const tokenPayload = {
        type: "token",
        sceneId: targetToken.document?.parent?.id ?? canvas.scene?.id ?? null,
        tokenId: targetToken.id,
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        spellKey,
        originalLight: foundry.utils.deepClone(targetToken.document?.light ?? {})
      };
      const updated = await updateTokenLight(targetToken.document, config);
      if (!updated) {
        ui.notifications.error(`${spellName} : impossible de modifier la lumière de la cible.`);
        return false;
      }
      blinded = !isDarkness;
      anchorActor = targetActor;
      anchorEffect = effectData({ targetActor, destination: "token", payload: tokenPayload, blinded });
      destinationLabel = targetToken.name ?? targetActor.name;
      if (blinded) {
        details.push("La cible est aveuglée jusqu'à annulation de la lumière ou dissipation de la magie.");
        outcome = "Lumière éternelle appliquée — cible aveuglée";
      } else {
        outcome = "Ténèbres éternelles appliquées à la cible";
      }
    }
  }

  if (anchorEffect) {
    const trackedTokenId = anchorEffect.flags?.add2e?.lightPayload?.type === "token"
      ? anchorEffect.flags.add2e.lightPayload.tokenId
      : null;
    const created = await createTrackedEffect(anchorActor, anchorEffect, trackedTokenId);
    if (!created) {
      ui.notifications.error(`${spellName} : l'effet actif n'a pas pu être créé.`);
      return false;
    }
  }

  const rows = [
    { label: "Liste", value: `Clerc — niveau de lanceur ${casterLevel}` },
    { label: "Contexte", value: environment === "exterieur" ? "Extérieur" : "Intérieur" },
    { label: "Portée", value: `${rangeRule.inches}\" = ${rangeRule.meters} m` },
    { label: "Zone", value: `sphère de ${radiusRule.inches}\" de rayon = ${radiusRule.meters} m` },
    { label: "Durée", value: "Permanente" },
    { label: "Destination", value: destinationLabel || "Créature" },
    ...(objectItem ? [{ label: "Objet", value: objectItem.name }] : []),
    { label: "Résultat", value: outcome || "Effet appliqué" }
  ];

  const detailsHtml = details.length
    ? `<ul>${details.map(detail => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`
    : "";
  const ruleHtml = isDarkness
    ? "Ténèbres éternelles est la forme inverse du sort de Clerc et crée une obscurité totale permanente jusqu'à annulation ou dissipation."
    : "Lumière éternelle produit une lumière très vive permanente. Sur une créature, une sauvegarde réussie place la lumière 30 cm derrière la cible ; un échec l'aveugle.";

  const card = {
    actor: caster,
    title: spellName,
    icon: isDarkness ? "fas fa-moon" : "fas fa-sun",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img ?? caster.img,
      type: `Clerc niveau ${casterLevel}`
    },
    target: targetActor ? {
      name: targetToken?.name ?? targetActor.name,
      img: targetActor.img,
      type: destinationMode === "object" ? "Porteur de l'objet" : "Cible du sort",
      meta: objectItem?.name ?? ""
    } : null,
    rows,
    message: `${caster.name} lance ${spellName}.`,
    trustedBodyHtml: `<div class="add2e-lumiere-eternelle-results">${detailsHtml}<p>${escapeHtml(ruleHtml)}</p></div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: saveResult?.roll ? [saveResult.roll] : [],
      flags: {
        add2e: {
          chatCardType: "lumiere-eternelle",
          version: ADD2E_ETERNAL_LIGHT_VERSION,
          spellKey,
          familyKind,
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel,
          spellLevel,
          listKey,
          environment,
          rangeInches: rangeRule.inches,
          rangeMeters: rangeRule.meters,
          radiusInches: radiusRule.inches,
          radiusMeters: radiusRule.meters,
          permanent: true,
          destinationMode,
          objectItemId: objectItem?.id ?? null,
          objectItemUuid: objectItem?.uuid ?? null,
          targetActorUuid: targetActor?.uuid ?? null,
          targetTokenId: targetToken?.id ?? null,
          blinded,
          resistance: resistanceResult,
          saveSuccess: saveResult?.success ?? null,
          outcome
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${spellName} : carte ADD2E vide.`);
  await globalThis.add2eCreateChatCard(card);

  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.(spellKey, { casterToken, targetToken });
  } catch (_error) {}

  return true;
})();