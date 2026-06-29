/**
 * ADD2E — Lumière / Ténèbres
 * Clerc niveau 1 — Altération
 * Version : 2026-06-29-lumiere-tenebres-manual-resolution-v2
 *
 * Contrat onUse : true = sort consommé ; false = sort non consommé.
 * Compatible Foundry V13/V14/V15. DialogV2 uniquement.
 */

const ADD2E_LUMIERE_VERSION = "2026-06-29-lumiere-tenebres-manual-resolution-v2";

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
  const originalLight = foundry.utils.deepClone(payload.originalLight ?? legacyLight);
  const updateData = { light: originalLight };

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
  if (!DialogV2?.wait) {
    ui.notifications.error("Lumière / Ténèbres : DialogV2 indisponible.");
    return false;
  }

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

  function resolveMode(itemDoc) {
    const resolveOne = value => {
      const key = norm(value);
      if (["lumiere", "normal", "base"].includes(key)) return "lumiere";
      if (["tenebres", "inverse"].includes(key)) return "tenebres";
      return null;
    };

    const candidates = [
      itemDoc?.name,
      itemDoc?.system?.nom,
      itemDoc?.system?.slug,
      itemDoc?.system?.spellKey,
      itemDoc?.flags?.add2e?.reversibleActorEntry?.mode,
      itemDoc?.flags?.add2e?.spellFamily?.kind,
      itemDoc?.flags?.add2e?.spellFamily?.reversibleMode,
      itemDoc?.flags?.add2e?.spellKey,
      itemDoc?.flags?.add2e?.slug
    ];
    const modes = new Set(candidates.map(resolveOne).filter(Boolean));
    return modes.size === 1 ? Array.from(modes)[0] : null;
  }

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

  const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc?.actor?.id === caster.id)
    ?? ((typeof token !== "undefined" && token?.actor?.id === caster.id) ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;
  if (!casterToken) {
    ui.notifications.warn(`${spellName} : le lanceur doit être présent sur la scène.`);
    return false;
  }

  function clericLevel(actorDoc) {
    const system = actorDoc?.system ?? {};
    const direct = [
      system.details_classe?.clerc?.niveau,
      system.classes?.clerc?.niveau,
      system.niveau,
      system.level,
      system.details?.niveau,
      system.details?.level
    ];
    for (const raw of direct) {
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }

    const clericClass = Array.from(actorDoc?.items ?? []).find(itemDoc =>
      itemDoc.type === "classe" && norm(itemDoc.name).includes("clerc")
    );
    for (const raw of [clericClass?.system?.niveau, clericClass?.system?.level]) {
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 1;
  }

  const level = clericLevel(caster);
  const normalDurationRounds = 60 + (10 * level);
  const durationRounds = isDarkness ? Math.floor(normalDurationRounds / 2) : normalDurationRounds;

  function durationData(rounds) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  }

  function sceneUnitToMeters(value, unit) {
    const key = String(unit ?? "m").toLowerCase();
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(key)) return value * 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(key)) return value * 0.9144;
    if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(key)) return value * 1000;
    return value;
  }

  function metersToSceneUnits(meters) {
    const unit = canvas.scene?.grid?.units ?? "m";
    return meters / Math.max(0.0001, sceneUnitToMeters(1, unit));
  }

  function distanceMeters(from, to) {
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
    const gridDistance = Number(canvas.scene?.grid?.distance ?? 1) || 1;
    const unit = canvas.scene?.grid?.units ?? "m";
    const pixels = Math.hypot(Number(to?.x ?? 0) - Number(from?.x ?? 0), Number(to?.y ?? 0) - Number(from?.y ?? 0));
    return sceneUnitToMeters((pixels / gridSize) * gridDistance, unit);
  }

  function hasBlockingWall(from, to) {
    try {
      if (!canvas.walls?.checkCollision || typeof Ray === "undefined") return false;
      return canvas.walls.checkCollision(new Ray(from, to), { type: "sight", mode: "any" }) === true;
    } catch (_error) {
      return false;
    }
  }

  function withinRange(point) {
    return distanceMeters(casterToken.center, point) <= RANGE_METERS + 0.1;
  }

  function nativeCanvasPoint() {
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
        if (event.key === "Escape") finish(null);
      };
      const onPointerDown = event => {
        const button = Number(event?.button ?? event?.nativeEvent?.button ?? event?.data?.originalEvent?.button ?? 0);
        if (button === 2) return finish(null);
        if (button !== 0) return;

        const local = event?.getLocalPosition?.(stage)
          ?? event?.data?.getLocalPosition?.(stage)
          ?? stage.toLocal?.(event?.global ?? event?.data?.global ?? null)
          ?? null;
        if (!local || !Number.isFinite(Number(local.x)) || !Number.isFinite(Number(local.y))) {
          ui.notifications.warn(`${spellName} : position de la scène illisible.`);
          return finish(null);
        }
        finish({ x: Number(local.x), y: Number(local.y) });
      };

      stage.on("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown, true);
    });
  }

  function getTargetSave(actorDoc) {
    const system = actorDoc?.system ?? {};
    const read = value => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
      const matched = String(value ?? "").match(/\d+(?:[.,]\d+)?/);
      const parsed = Number(matched?.[0]?.replace(",", "."));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
    };

    const candidates = [
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
    ];
    for (const candidate of candidates) {
      const value = read(candidate);
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  }

  function magicResistance(actorDoc) {
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
  }

  function lightConfiguration() {
    const radius = metersToSceneUnits(RADIUS_METERS);
    const bright = metersToSceneUnits(BRIGHT_METERS);
    if (isDarkness) {
      return {
        dim: radius,
        bright: 0,
        angle: 360,
        color: "#000000",
        alpha: 0.85,
        coloration: 1,
        luminosity: -0.5,
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
  }

  function activeEffectTags({ destination, eyeEffect = false }) {
    const tags = [
      `sort:${spellKey}`,
      `etat:${spellKey}`,
      `mode:${spellKey}`,
      `lumiere_destination:${destination}`,
      "duree:round"
    ];
    if (destination === "point" || destination === "derriere") tags.push("ambient_light");
    if (destination === "token" || destination === "yeux") tags.push("illumination:token");
    if (eyeEffect) {
      tags.push(
        "etat:aveugle",
        "aveuglement:lumiere",
        "bonus_attaque:-4",
        "bonus_save:-4",
        "bonus_ca:-4",
        "bonus_attaque_ennemi:4"
      );
    }
    return tags;
  }

  function timeFlags({ targetActor = null, destination, payload, tags }) {
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
  }

  function effectData({ anchorActor, targetActor = null, destination, payload, eyeEffect = false }) {
    const tags = activeEffectTags({ destination, eyeEffect });
    const effectName = eyeEffect
      ? `${spellName} : aveuglement`
      : destination === "point" || destination === "derriere"
        ? `${spellName} : zone`
        : spellName;
    return {
      name: effectName,
      img: sourceItem.img || (isDarkness ? "icons/magic/unholy/projectile-smoke-black.webp" : "icons/svg/light.svg"),
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(durationRounds),
      description: eyeEffect
        ? `${spellName} sur les yeux : -4 au toucher, aux jets de sauvegarde et à la CA.`
        : `${spellName} maintient son effet pendant ${durationRounds} rounds.`,
      flags: {
        add2e: {
          ...timeFlags({ targetActor, destination, payload, tags }),
          lightPayload: payload,
          tags,
          anchorActorId: anchorActor?.id ?? null
        }
      },
      changes: []
    };
  }

  function effectTags(effect) {
    const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
    return (Array.isArray(raw) ? raw : String(raw).split(/[,;|\n]+/)).map(norm).filter(Boolean);
  }

  async function replaceSpellEffect(actorDoc, data) {
    if (!actorDoc) return false;
    const previousIds = Array.from(actorDoc.effects ?? [])
      .filter(effect => effectTags(effect).some(tag => tag === "sort:lumiere" || tag === "sort:tenebres"))
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
  }

  async function updateTokenLight(tokenDoc, config) {
    if (!tokenDoc) return false;
    const sceneId = tokenDoc.parent?.id ?? canvas.scene?.id ?? null;
    const updateData = { light: config };
    if (game.user.isGM || tokenDoc.isOwner) {
      await tokenDoc.update(updateData);
      return true;
    }
    return add2eLumiereEmitGMOperation("updateToken", { sceneId, tokenId: tokenDoc.id, updateData });
  }

  async function createAmbient(point, config, destination) {
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
      vision: false,
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
  }

  function pointBehindTarget(targetToken) {
    const origin = casterToken.center;
    const target = targetToken.center;
    const dx = Number(target.x) - Number(origin.x);
    const dy = Number(target.y) - Number(origin.y);
    const length = Math.hypot(dx, dy) || 1;
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
    const offset = Math.max(gridSize / 2, Number(targetToken.w ?? gridSize) / 2, Number(targetToken.h ?? gridSize) / 2) + 8;
    return { x: target.x + ((dx / length) * offset), y: target.y + ((dy / length) * offset) };
  }

  const selectedTargets = Array.from(game.user.targets ?? []);
  const hasSingleTarget = selectedTargets.length === 1 && !!selectedTargets[0]?.actor;
  const targetOptions = hasSingleTarget
    ? `<option value="token">Sur la créature ciblée</option><option value="yeux">Sur le visage ou les yeux</option>`
    : "";

  const choice = await DialogV2.wait({
    window: { title: `Lancement : ${spellName}` },
    position: { width: 390 },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "icons/svg/light.svg",
    content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:7px;"><div class="form-group"><label style="font-weight:bold;">Destination :</label><select name="destination" style="width:100%;">${targetOptions}<option value="point" ${hasSingleTarget ? "" : "selected"}>Point / objet sur la scène</option></select></div><div style="font-size:.85em;color:${COLORS.dark};border-top:1px solid ${COLORS.border};padding-top:6px;"><div><b>Portée :</b> 12&quot; (36 m)</div><div><b>Rayon :</b> 2&quot; (6 m)</div><div><b>Durée :</b> ${durationRounds} rounds${isDarkness ? " — moitié de Lumière" : ""}</div>${hasSingleTarget ? "<div>Une résistance magique, puis un jet de protection, sont appliqués à une cible hostile.</div>" : ""}</div></form>`,
    buttons: [
      { action: "cast", label: "Lancer", icon: isDarkness ? "fa-solid fa-moon" : "fa-solid fa-sun", default: true, callback: (_event, button) => ({ destination: String(button.form?.elements?.destination?.value ?? "point") }) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!choice) return false;

  const config = lightConfiguration();
  let targetToken = null;
  let targetActor = null;
  let destinationPoint = null;
  let destinationLabel = "";
  let outcome = "";
  let outcomeColor = COLORS.success;
  let details = [];
  let anchorActor = caster;
  let anchorEffect = null;

  if (choice.destination === "point") {
    destinationPoint = await nativeCanvasPoint();
    if (!destinationPoint) return false;
    if (!withinRange(destinationPoint)) {
      ui.notifications.warn(`${spellName} : le point est hors de portée (12\").`);
      return false;
    }
    if (hasBlockingWall(casterToken.center, destinationPoint)) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d’effet.`);
      return false;
    }

    const ambient = await createAmbient(destinationPoint, config, "point");
    if (!ambient.ok) {
      ui.notifications.error(`${spellName} : impossible de créer la zone.`);
      return false;
    }
    anchorEffect = effectData({ anchorActor: caster, destination: "point", payload: ambient.payload });
    destinationLabel = "Point choisi sur la scène";
    outcome = isDarkness ? "ZONE DE TÉNÈBRES CRÉÉE" : "ZONE DE LUMIÈRE CRÉÉE";
    details = [`Rayon : 6 m`, `Durée : ${durationRounds} rounds`];
  } else {
    if (!hasSingleTarget) {
      ui.notifications.warn(`${spellName} : sélectionne exactement une créature.`);
      return false;
    }
    targetToken = selectedTargets[0];
    targetActor = targetToken.actor;

    if (!withinRange(targetToken.center)) {
      ui.notifications.warn(`${spellName} : cible hors de portée (12\").`);
      return false;
    }
    if (hasBlockingWall(casterToken.center, targetToken.center)) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d’effet.`);
      return false;
    }

    destinationLabel = targetToken.name ?? targetActor.name;
    const sameToken = targetToken.id === casterToken.id;
    const sameActor = targetActor.id === caster.id;
    const needsDefense = !sameToken && !sameActor;

    let resistance = { applicable: false, resisted: false, chance: 0, roll: null };
    let save = { applicable: false, threshold: NaN, bonus: 0, roll: null, total: null, success: false, manual: false };

    if (needsDefense) {
      resistance = magicResistance(targetActor);
      if (resistance.applicable) {
        details.push(`Résistance magique : ${resistance.roll}/${resistance.chance}% — ${resistance.resisted ? "réussie" : "échouée"}`);
      }
      if (resistance.resisted) {
        outcome = "RÉSISTANCE MAGIQUE RÉUSSIE";
        outcomeColor = COLORS.fail;
      }
    }

    if (!outcome && needsDefense) {
      const threshold = getTargetSave(targetActor);
      const effectEngine = globalThis.Add2eEffectsEngine;
      const bonus = Number(effectEngine?.getSaveBonusVs?.(targetActor, "sorts") ?? 0)
        + Number(effectEngine?.getBonusSaveConstitution?.(targetActor, "sorts") ?? 0);
      save = { applicable: true, threshold, bonus, roll: null, total: null, success: false, manual: false };

      if (Number.isFinite(threshold)) {
        const roll = await new Roll("1d20").evaluate({ async: true });
        if (game.dice3d) await game.dice3d.showForRoll(roll);
        save.roll = Number(roll.total) || 0;
        save.total = save.roll + bonus;
        save.success = save.total >= threshold;
      } else if (game.user.isGM) {
        const decision = await DialogV2.wait({
          window: { title: `${spellName} — sauvegarde MJ` },
          position: { width: 350 },
          content: `<p>La sauvegarde contre les sorts de <b>${esc(targetActor.name)}</b> est absente.</p><p>Le MJ décide du résultat.</p>`,
          buttons: [
            { action: "success", label: "Réussite : placer derrière", callback: () => true },
            { action: "failure", label: "Échec : appliquer sur la cible", default: true, callback: () => false },
            { action: "cancel", label: "Annuler", callback: () => null }
          ],
          rejectClose: false
        });
        if (decision === null) return false;
        save.manual = true;
        save.success = decision === true;
      } else {
        ui.notifications.warn(`${spellName} : la sauvegarde de la cible est absente. Le MJ doit arbitrer.`);
        return false;
      }

      if (save.manual) details.push(`Jet de protection : arbitrage MJ — ${save.success ? "réussi" : "raté"}`);
      else details.push(`Jet de protection : ${save.roll}${save.bonus ? `${save.bonus >= 0 ? "+" : ""}${save.bonus}` : ""} = ${save.total} / ${save.threshold} — ${save.success ? "réussi" : "raté"}`);
    }

    if (!outcome && save.success) {
      destinationPoint = pointBehindTarget(targetToken);
      const ambient = await createAmbient(destinationPoint, config, "derriere");
      if (!ambient.ok) {
        ui.notifications.error(`${spellName} : impossible de créer la zone derrière la cible.`);
        return false;
      }
      anchorEffect = effectData({ anchorActor: caster, targetActor, destination: "derriere", payload: ambient.payload });
      anchorActor = caster;
      outcome = "SAUVEGARDE RÉUSSIE";
      outcomeColor = COLORS.warn;
      details.push("L’effet apparaît derrière la cible, sans s’attacher à elle.");
    }

    if (!outcome) {
      const originalLight = foundry.utils.deepClone(targetToken.document?.light ?? {});
      const tokenPayload = {
        type: "token",
        sceneId: targetToken.document?.parent?.id ?? canvas.scene?.id ?? null,
        tokenId: targetToken.id,
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        spellName,
        originalLight
      };
      const updated = await updateTokenLight(targetToken.document, config);
      if (!updated) {
        ui.notifications.error(`${spellName} : impossible de modifier la lumière de la cible.`);
        return false;
      }

      const eyeEffect = choice.destination === "yeux";
      anchorActor = targetActor;
      anchorEffect = effectData({
        anchorActor,
        targetActor,
        destination: eyeEffect ? "yeux" : "token",
        payload: tokenPayload,
        eyeEffect
      });
      outcome = eyeEffect ? "AVEUGLEMENT APPLIQUÉ" : (isDarkness ? "TÉNÈBRES APPLIQUÉES" : "LUMIÈRE APPLIQUÉE");
      outcomeColor = eyeEffect ? COLORS.warn : COLORS.success;
      if (eyeEffect) details.push("Malus : -4 au toucher, aux jets de protection et à la classe d’armure.");
    }

    if (resistance.resisted) {
      details.push("Aucun effet n’est appliqué à la cible.");
    }
  }

  if (anchorEffect) {
    const effectCreated = await replaceSpellEffect(anchorActor, anchorEffect);
    if (!effectCreated) {
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
    ? `Ténèbres est l’inverse de Lumière. Elle se place dans les mêmes conditions, mais dure la moitié de la durée normale.`
    : `Lumière éclaire une sphère de 2&quot; de rayon pendant 6 tours + 1 tour par niveau. Sur une créature, sa résistance magique puis son jet de protection s’appliquent ; une sauvegarde réussie place l’effet derrière la cible.`;

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
