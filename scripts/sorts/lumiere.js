/**
 * ADD2E — Lumière / Ténèbres
 * Clerc niveau 1 — Altération
 * Version : 2026-06-29-lumiere-tenebres-direct-target-v3
 *
 * Contrat onUse : true = sort consommé ; false = sort non consommé.
 * Compatible Foundry V13/V14/V15. DialogV2 uniquement lorsqu’un arbitrage MJ est requis.
 */

const ADD2E_LUMIERE_VERSION = "2026-06-29-lumiere-tenebres-direct-target-v3";

function add2eLumiereEmitGMOperation(operation, payload) {
  if (!game.socket) return false;
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
  });
  return true;
}

globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION = add2eLumiereEmitGMOperation;

globalThis.ADD2E_LUMIERE_FIND_AMBIENT = payload => {
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

  if (!Number.isFinite(Number(payload.x)) || !Number.isFinite(Number(payload.y))) return null;
  return scene.lights?.find(light => {
    const samePosition = Math.abs(Number(light.x) - Number(payload.x)) < 4
      && Math.abs(Number(light.y) - Number(payload.y)) < 4;
    const sameSpell = !payload.spellName
      || light.flags?.add2e?.spellName === payload.spellName
      || light.getFlag?.("add2e", "spellName") === payload.spellName;
    const sameActor = !payload.actorId
      || light.flags?.add2e?.actorId === payload.actorId
      || light.flags?.add2e?.actorUuid === payload.actorUuid
      || light.getFlag?.("add2e", "actorId") === payload.actorId
      || light.getFlag?.("add2e", "actorUuid") === payload.actorUuid;
    return samePosition && sameSpell && sameActor;
  }) ?? null;
};

globalThis.ADD2E_LUMIERE_DELETE_AMBIENT = async payload => {
  if (!payload || payload.type !== "ambient") return;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  if (!scene) return;

  const light = globalThis.ADD2E_LUMIERE_FIND_AMBIENT(payload);
  if (game.user.isGM) {
    if (light) await light.delete();
    return;
  }

  add2eLumiereEmitGMOperation("deleteAmbientLight", {
    sceneId: scene.id,
    lightId: light?.id ?? payload.lightId ?? null,
    requestId: payload.requestId ?? null,
    actorId: payload.actorId ?? null,
    actorUuid: payload.actorUuid ?? null,
    spellName: payload.spellName ?? null,
    x: payload.x ?? null,
    y: payload.y ?? null
  });
};

globalThis.ADD2E_LUMIERE_RESTORE_TOKEN_LIGHT = async payload => {
  if (!payload || payload.type !== "token") return;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  const tokenDoc = scene?.tokens?.get(payload.tokenId) ?? null;
  if (!tokenDoc) return;

  const legacyLight = {
    dim: payload.originalDim ?? 0,
    bright: payload.originalBright ?? 0,
    color: payload.originalColor ?? null,
    alpha: payload.originalAlpha ?? 0.5,
    angle: payload.originalAngle ?? 360,
    animation: payload.originalAnimation ?? { type: null, speed: 5, intensity: 5, reverse: false }
  };
  const updateData = { light: foundry.utils.deepClone(payload.originalLight ?? legacyLight) };

  if (game.user.isGM || tokenDoc.isOwner) {
    await tokenDoc.update(updateData);
    return;
  }

  add2eLumiereEmitGMOperation("updateToken", {
    sceneId: scene.id,
    tokenId: tokenDoc.id,
    updateData
  });
};

if (globalThis.ADD2E_LUMIERE_HOOKS_VERSION !== ADD2E_LUMIERE_VERSION) {
  globalThis.ADD2E_LUMIERE_HOOKS_VERSION = ADD2E_LUMIERE_VERSION;

  const cleanup = async effect => {
    const payload = effect?.flags?.add2e?.lightPayload ?? effect?.getFlag?.("add2e", "lightPayload");
    if (!payload) return;
    if (payload.type === "ambient") await globalThis.ADD2E_LUMIERE_DELETE_AMBIENT(payload);
    if (payload.type === "token") await globalThis.ADD2E_LUMIERE_RESTORE_TOKEN_LIGHT(payload);
  };

  Hooks.on("deleteActiveEffect", cleanup);
  Hooks.on("updateActiveEffect", async (effect, changes) => {
    if (changes?.disabled === true) await cleanup(effect);
  });
}

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  const COLORS = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    success: "#2f8f46",
    fail: "#b33a2e",
    warn: "#b88924"
  };
  const RANGE_METERS = 36;
  const RADIUS_METERS = 6;
  const BRIGHT_METERS = 3;

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const norm = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const chatStyle = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem) {
    ui.notifications.error("Lumière / Ténèbres : sort introuvable.");
    return false;
  }

  const resolveMode = itemDoc => {
    const fromValue = value => {
      const key = norm(value);
      if (["lumiere", "normal", "base"].includes(key)) return "lumiere";
      if (["tenebres", "inverse"].includes(key)) return "tenebres";
      return null;
    };
    const modes = new Set([
      itemDoc?.name,
      itemDoc?.system?.nom,
      itemDoc?.system?.slug,
      itemDoc?.system?.spellKey,
      itemDoc?.flags?.add2e?.reversibleActorEntry?.mode,
      itemDoc?.flags?.add2e?.spellFamily?.kind,
      itemDoc?.flags?.add2e?.spellFamily?.reversibleMode,
      itemDoc?.flags?.add2e?.spellKey,
      itemDoc?.flags?.add2e?.slug
    ].map(fromValue).filter(Boolean));
    return modes.size === 1 ? Array.from(modes)[0] : null;
  };

  const mode = resolveMode(sourceItem);
  if (!mode) {
    ui.notifications.error(`Lumière / Ténèbres : impossible d’identifier le sort lancé (« ${sourceItem.name ?? "sans nom"} »).`);
    return false;
  }

  const isDarkness = mode === "tenebres";
  const spellName = isDarkness ? "Ténèbres" : "Lumière";
  const spellKey = isDarkness ? "tenebres" : "lumiere";
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error(`${spellName} : lanceur introuvable.`);
    return false;
  }

  const casterToken = canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
    ?? ((typeof token !== "undefined" && token?.actor?.id === caster.id) ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;
  if (!casterToken) {
    ui.notifications.warn(`${spellName} : le lanceur doit être présent sur la scène.`);
    return false;
  }

  const clericLevel = actorDoc => {
    const system = actorDoc?.system ?? {};
    for (const raw of [
      system.details_classe?.clerc?.niveau,
      system.classes?.clerc?.niveau,
      system.niveau,
      system.level,
      system.details?.niveau,
      system.details?.level
    ]) {
      const level = Number(raw);
      if (Number.isFinite(level) && level > 0) return level;
    }
    const cleric = Array.from(actorDoc?.items ?? []).find(entry =>
      entry.type === "classe" && norm(entry.name).includes("clerc")
    );
    for (const raw of [cleric?.system?.niveau, cleric?.system?.level]) {
      const level = Number(raw);
      if (Number.isFinite(level) && level > 0) return level;
    }
    return 1;
  };

  const level = clericLevel(caster);
  const normalDurationRounds = 60 + (10 * level);
  const durationRounds = isDarkness ? Math.floor(normalDurationRounds / 2) : normalDurationRounds;

  const durationData = rounds => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  };

  const unitToMeters = (value, unit) => {
    const key = String(unit ?? "m").toLowerCase();
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(key)) return value * 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(key)) return value * 0.9144;
    if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(key)) return value * 1000;
    return value;
  };

  const metersToSceneUnits = meters => {
    const unit = canvas.scene?.grid?.units ?? "m";
    return meters / Math.max(0.0001, unitToMeters(1, unit));
  };

  const distanceMeters = (from, to) => {
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
    const gridDistance = Number(canvas.scene?.grid?.distance ?? 1) || 1;
    const unit = canvas.scene?.grid?.units ?? "m";
    const distancePixels = Math.hypot(Number(to?.x ?? 0) - Number(from?.x ?? 0), Number(to?.y ?? 0) - Number(from?.y ?? 0));
    return unitToMeters((distancePixels / gridSize) * gridDistance, unit);
  };

  const withinRange = point => distanceMeters(casterToken.center, point) <= RANGE_METERS + 0.1;

  const hasBlockingWall = (from, to) => {
    try {
      if (!canvas.walls?.checkCollision || typeof Ray === "undefined") return false;
      return canvas.walls.checkCollision(new Ray(from, to), { type: "sight", mode: "any" }) === true;
    } catch (_error) {
      return false;
    }
  };

  const chooseCanvasPoint = () => {
    ui.notifications.info(`${spellName} : clique sur la scène pour choisir le point d’effet. Échap ou clic droit annule.`);
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

  const targetSave = actorDoc => {
    const system = actorDoc?.system ?? {};
    const read = value => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
      const parsed = Number(String(value ?? "").match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
    };
    for (const candidate of [
      Array.isArray(system.sauvegardes) ? system.sauvegardes[4] : null,
      system.sauvegarde_sortileges,
      system.sauvegarde_sorts,
      system.sauvegardes?.sortileges,
      system.sauvegardes?.sorts,
      system.saves?.sorts,
      system.saves?.spell,
      system.saves?.spells,
      system.calculatedSaves?.sorts,
      system.calculatedSaves?.spell,
      system.calculatedSaves?.spells
    ]) {
      const value = read(candidate);
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  };

  const magicResistance = actorDoc => {
    if (!actorDoc) return { applicable: false, resisted: false, chance: 0, roll: null, source: "" };
    const engine = globalThis.Add2eEffectsEngine;
    if (typeof engine?.checkResistanceDetails === "function") {
      const result = engine.checkResistanceDetails(actorDoc, "magie", { chat: false });
      if (result?.found) {
        return {
          applicable: true,
          resisted: result.resiste === true,
          chance: Number(result.pct) || 0,
          roll: Number(result.jet) || null,
          source: result.tag ?? "resistance:magie"
        };
      }
    }

    const system = actorDoc.system ?? {};
    const raw = system.resistance_magie ?? system.resistanceMagie ?? system.magicResistance ?? system.rm ?? system.mr ?? null;
    const chance = Number(String(raw ?? "").replace(",", "."));
    if (!Number.isFinite(chance) || chance <= 0) return { applicable: false, resisted: false, chance: 0, roll: null, source: "" };
    const cappedChance = Math.max(0, Math.min(100, chance));
    const roll = Math.ceil(Math.random() * 100);
    return { applicable: true, resisted: roll <= cappedChance, chance: cappedChance, roll, source: "system.resistance_magie" };
  };

  const lightConfiguration = () => {
    const radius = metersToSceneUnits(RADIUS_METERS);
    const bright = metersToSceneUnits(BRIGHT_METERS);
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
      bright,
      angle: 360,
      color: "#fffec4",
      alpha: 0.5,
      coloration: 1,
      luminosity: 0.5,
      attenuation: 0.5,
      animation: { type: "torch", speed: 2, intensity: 2, reverse: false }
    };
  };

  const effectTags = destination => [
    `sort:${spellKey}`,
    `etat:${spellKey}`,
    `mode:${spellKey}`,
    `lumiere_destination:${destination}`,
    "duree:round",
    destination === "point" || destination === "derriere" ? "ambient_light" : "illumination:token"
  ];

  const timeFlags = ({ targetActor = null, destination, payload, tags }) => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    const endMessage = `${spellName} de {actor} prend fin.`;
    const extra = {
      spellName,
      spellKey,
      mode,
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id,
      casterUuid: caster.uuid,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      destination,
      tags,
      lightPayload: payload
    };
    return time?.flags?.({ source: "lumiere.js", rounds: durationRounds, unit: "round", endMessage, extra }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: durationRounds },
      roundEngine: { managed: true, unit: "round", totalRounds: durationRounds, endMessage },
      endMessage,
      ...extra
    };
  };

  const effectData = ({ targetActor = null, destination, payload }) => {
    const tags = effectTags(destination);
    return {
      name: destination === "point" || destination === "derriere" ? `${spellName} : zone` : spellName,
      img: sourceItem.img || (isDarkness ? "icons/magic/unholy/projectile-smoke-black.webp" : "icons/svg/light.svg"),
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(durationRounds),
      description: `${spellName} maintient son effet pendant ${durationRounds} rounds.`,
      flags: {
        add2e: {
          ...timeFlags({ targetActor, destination, payload, tags }),
          lightPayload: payload,
          tags
        }
      },
      changes: []
    };
  };

  const activeTags = effect => {
    const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
    return (Array.isArray(raw) ? raw : String(raw).split(/[,;|\n]+/)).map(norm).filter(Boolean);
  };

  const replaceSpellEffect = async (actorDoc, data) => {
    if (!actorDoc) return false;
    const previousIds = Array.from(actorDoc.effects ?? [])
      .filter(effect => activeTags(effect).some(tag => tag === "sort:lumiere" || tag === "sort:tenebres"))
      .map(effect => effect.id)
      .filter(Boolean);

    if (game.user.isGM || actorDoc.isOwner) {
      if (previousIds.length) await actorDoc.deleteEmbeddedDocuments("ActiveEffect", previousIds);
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [data]);
      return true;
    }

    return add2eLumiereEmitGMOperation("createActiveEffect", {
      actorUuid: actorDoc.uuid,
      actorId: actorDoc.id,
      effectData: data,
      removeEffectIds: previousIds
    });
  };

  const updateTokenLight = async (tokenDoc, config) => {
    if (!tokenDoc) return false;
    const updateData = { light: config };
    if (game.user.isGM || tokenDoc.isOwner) {
      await tokenDoc.update(updateData);
      return true;
    }
    return add2eLumiereEmitGMOperation("updateToken", {
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
      const sent = add2eLumiereEmitGMOperation("createAmbientLight", {
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
        spellName,
        x: point.x,
        y: point.y
      }
    };
  };

  const pointBehindTarget = targetToken => {
    const origin = casterToken.center;
    const target = targetToken.center;
    const dx = Number(target.x) - Number(origin.x);
    const dy = Number(target.y) - Number(origin.y);
    const length = Math.hypot(dx, dy) || 1;
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
    const offset = Math.max(gridSize / 2, Number(targetToken.w ?? gridSize) / 2, Number(targetToken.h ?? gridSize) / 2) + 8;
    return { x: target.x + ((dx / length) * offset), y: target.y + ((dy / length) * offset) };
  };

  const targets = Array.from(game.user.targets ?? []).filter(target => !!target?.actor);
  if (targets.length > 1) {
    ui.notifications.warn(`${spellName} : sélectionne une seule cible ou aucune pour un point sur la scène.`);
    return false;
  }

  const config = lightConfiguration();
  const targetToken = targets[0] ?? null;
  const targetActor = targetToken?.actor ?? null;
  const destination = targetToken ? "token" : "point";
  const destinationLabel = targetToken?.name ?? "Point choisi sur la scène";
  let outcome = "";
  let outcomeColor = COLORS.success;
  const details = [];
  let anchorActor = caster;
  let anchorEffect = null;

  if (!targetToken) {
    const point = await chooseCanvasPoint();
    if (!point) return false;
    if (!withinRange(point)) {
      ui.notifications.warn(`${spellName} : le point est hors de portée (12\").`);
      return false;
    }
    if (hasBlockingWall(casterToken.center, point)) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d’effet.`);
      return false;
    }

    const ambient = await createAmbient(point, config, "point");
    if (!ambient.ok) {
      ui.notifications.error(`${spellName} : impossible de créer la zone.`);
      return false;
    }
    anchorEffect = effectData({ destination: "point", payload: ambient.payload });
    outcome = isDarkness ? "ZONE DE TÉNÈBRES CRÉÉE" : "ZONE DE LUMIÈRE CRÉÉE";
    details.push("Rayon : 6 m", `Durée : ${durationRounds} rounds`);
  } else {
    if (!withinRange(targetToken.center)) {
      ui.notifications.warn(`${spellName} : cible hors de portée (12\").`);
      return false;
    }
    if (hasBlockingWall(casterToken.center, targetToken.center)) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d’effet.`);
      return false;
    }

    const sameToken = targetToken.id === casterToken.id;
    const sameActor = targetActor.id === caster.id;
    const needsDefense = !sameToken && !sameActor;
    let resistance = { applicable: false, resisted: false, chance: 0, roll: null };
    let save = { threshold: NaN, bonus: 0, roll: null, total: null, success: false, manual: false };

    if (needsDefense) {
      resistance = magicResistance(targetActor);
      if (resistance.applicable) {
        details.push(`Résistance magique : ${resistance.roll}/${resistance.chance}% — ${resistance.resisted ? "réussie" : "échouée"}`);
      }
      if (resistance.resisted) {
        outcome = "RÉSISTANCE MAGIQUE RÉUSSIE";
        outcomeColor = COLORS.fail;
        details.push("Aucun effet n’est appliqué à la cible.");
      }
    }

    if (!outcome && needsDefense) {
      const threshold = targetSave(targetActor);
      const engine = globalThis.Add2eEffectsEngine;
      const bonus = Number(engine?.getSaveBonusVs?.(targetActor, "sorts") ?? 0)
        + Number(engine?.getBonusSaveConstitution?.(targetActor, "sorts") ?? 0);
      save = { threshold, bonus, roll: null, total: null, success: false, manual: false };

      if (Number.isFinite(threshold)) {
        const roll = await new Roll("1d20").evaluate({ async: true });
        if (game.dice3d) await game.dice3d.showForRoll(roll);
        save.roll = Number(roll.total) || 0;
        save.total = save.roll + bonus;
        save.success = save.total >= threshold;
      } else {
        if (!DialogV2?.wait || !game.user.isGM) {
          ui.notifications.warn(`${spellName} : la sauvegarde de la cible est absente. Le MJ doit arbitrer.`);
          return false;
        }
        const decision = await DialogV2.wait({
          window: { title: `${spellName} — sauvegarde MJ` },
          position: { width: 350 },
          content: `<p>La sauvegarde contre les sorts de <b>${esc(targetActor.name)}</b> est absente.</p><p>Le MJ décide du résultat.</p>`,
          buttons: [
            { action: "success", label: "Réussite : placer derrière", callback: () => ({ saveSuccess: true }) },
            { action: "failure", label: "Échec : appliquer sur la cible", default: true, callback: () => ({ saveSuccess: false }) },
            { action: "cancel", label: "Annuler", callback: () => ({ cancelled: true }) }
          ],
          rejectClose: false
        });
        if (!decision || decision.cancelled === true || typeof decision.saveSuccess !== "boolean") return false;
        save.manual = true;
        save.success = decision.saveSuccess;
      }

      if (save.manual) {
        details.push(`Jet de protection : arbitrage MJ — ${save.success ? "réussi" : "raté"}`);
      } else {
        details.push(`Jet de protection : ${save.roll}${save.bonus ? `${save.bonus >= 0 ? "+" : ""}${save.bonus}` : ""} = ${save.total} / ${save.threshold} — ${save.success ? "réussi" : "raté"}`);
      }
    }

    if (!outcome && save.success) {
      const point = pointBehindTarget(targetToken);
      const ambient = await createAmbient(point, config, "derriere");
      if (!ambient.ok) {
        ui.notifications.error(`${spellName} : impossible de créer la zone derrière la cible.`);
        return false;
      }
      anchorEffect = effectData({ targetActor, destination: "derriere", payload: ambient.payload });
      anchorActor = caster;
      outcome = "SAUVEGARDE RÉUSSIE";
      outcomeColor = COLORS.warn;
      details.push("L’effet apparaît derrière la cible, sans s’attacher à elle.");
    }

    if (!outcome) {
      const tokenPayload = {
        type: "token",
        sceneId: targetToken.document?.parent?.id ?? canvas.scene?.id ?? null,
        tokenId: targetToken.id,
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        spellName,
        originalLight: foundry.utils.deepClone(targetToken.document?.light ?? {})
      };
      const updated = await updateTokenLight(targetToken.document, config);
      if (!updated) {
        ui.notifications.error(`${spellName} : impossible de modifier la lumière de la cible.`);
        return false;
      }

      anchorActor = targetActor;
      anchorEffect = effectData({ targetActor, destination, payload: tokenPayload });
      outcome = isDarkness ? "TÉNÈBRES APPLIQUÉES" : "LUMIÈRE APPLIQUÉE";
      outcomeColor = COLORS.success;
    }
  }

  if (anchorEffect) {
    const created = await replaceSpellEffect(anchorActor, anchorEffect);
    if (!created) {
      ui.notifications.error(`${spellName} : l’effet actif n’a pas pu être créé.`);
      return false;
    }
  }

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(casterToken, "divine");
  } catch (_error) {}

  const detailHtml = details.length
    ? `<ul style="margin:6px 0 0 18px;text-align:left;">${details.map(detail => `<li>${esc(detail)}</li>`).join("")}</ul>`
    : "";
  const ruleHtml = isDarkness
    ? "Ténèbres est l’inverse de Lumière. Sans cible, elle est posée au clic sur la scène ; avec une cible, elle est appliquée directement à cette cible."
    : "Lumière éclaire une sphère de 2&quot; de rayon pendant 6 tours + 1 tour par niveau. Sans cible, elle est posée au clic sur la scène ; avec une cible, elle est appliquée directement à cette cible.";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `<div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;padding:0;font-family:var(--font-primary);"><div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;"><img src="${esc(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div><div style="font-size:.85em;opacity:.95;">lance <b>${esc(spellName)}</b></div></div><div style="text-align:right;font-size:.78em;opacity:.95;">Sort divin</div><img src="${esc(sourceItem.img || "icons/svg/light.svg")}" style="width:32px;height:32px;border-radius:4px;background:#fff;"></div><div style="padding:10px;"><div style="margin-bottom:6px;font-size:.95em;color:${COLORS.dark};"><b>Destination :</b> ${esc(destinationLabel)}<br><b>Durée :</b> ${durationRounds} rounds<br><b>Rayon :</b> 6 m</div><div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${outcomeColor};">${esc(outcome || "EFFET APPLIQUÉ")}</div>${detailHtml}</div><details style="margin-top:8px;background:white;border:1px solid ${COLORS.border};border-radius:6px;"><summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Règle appliquée</summary><div style="padding:8px;font-size:.85em;line-height:1.45;color:${COLORS.dark};">${esc(ruleHtml)}</div></details></div></div>`,
    ...chatStyle()
  });

  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Lumière / Ténèbres : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
