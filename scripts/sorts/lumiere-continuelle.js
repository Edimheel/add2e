/**
 * ADD2E — Lumière éternelle / Ténèbres éternelles (Clerc)
 * Runtime canonique du sort réversible de Clerc niveau 3.
 * Compatible Foundry V13/V14/V15 — fenêtres via l'API ADD2E commune.
 */

const ADD2E_ETERNAL_LIGHT_VERSION = "2026-08-13-canonical-eternal-light-runtime-v3";
const ADD2E_ETERNAL_LIGHT_RUNTIME = "cleric-eternal-light";

function add2eEternalLightEmitGM(operation, payload) {
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
    const light = scene.lights?.get(payload.lightId) ?? null;
    if (light) return light;
  }
  if (payload.requestId) {
    return scene.lights?.find(light =>
      light.flags?.add2e?.requestId === payload.requestId
      || light.getFlag?.("add2e", "requestId") === payload.requestId
    ) ?? null;
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
  add2eEternalLightEmitGM("deleteAmbientLight", {
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

globalThis.ADD2E_ETERNAL_LIGHT_RESTORE_TOKEN = async payload => {
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
  add2eEternalLightEmitGM("updateToken", {
    sceneId: scene.id,
    tokenId: tokenDoc.id,
    updateData: { light: originalLight }
  });
};

if (globalThis.ADD2E_ETERNAL_LIGHT_HOOKS_VERSION !== ADD2E_ETERNAL_LIGHT_VERSION) {
  globalThis.ADD2E_ETERNAL_LIGHT_HOOKS_VERSION = ADD2E_ETERNAL_LIGHT_VERSION;
  const cleanup = async effect => {
    const flags = effect?.flags?.add2e ?? {};
    if (flags.runtime !== ADD2E_ETERNAL_LIGHT_RUNTIME) return;
    const payload = flags.lightPayload ?? null;
    if (payload?.type === "ambient") await globalThis.ADD2E_ETERNAL_LIGHT_DELETE_AMBIENT(payload);
    if (payload?.type === "token") await globalThis.ADD2E_ETERNAL_LIGHT_RESTORE_TOKEN(payload);
  };
  Hooks.on("deleteActiveEffect", cleanup);
  Hooks.on("updateActiveEffect", async (effect, changes) => {
    if (changes?.disabled === true) await cleanup(effect);
  });
}

return await (async () => {
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

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

  const required = [
    "add2eNormalizeSpellKey", "add2eGetSpellListsFromItem", "add2eResolveSpellDistance", "add2eSceneDistance",
    "add2eCanActorUseSpell", "add2eDialogWait", "add2eBuildChatCard", "add2eCreateChatCard"
  ];
  const missing = required.filter(name => typeof globalThis[name] !== "function");
  if (missing.length) {
    ui.notifications.error(`Lumière éternelle / Ténèbres éternelles : API ADD2E indisponible (${missing.join(", ")}).`);
    return false;
  }

  const familyKindRaw = sourceItem.flags?.add2e?.spellFamily?.kind;
  const familyKind = familyKindRaw === undefined || familyKindRaw === null || familyKindRaw === ""
    ? "base"
    : String(familyKindRaw).trim().toLowerCase();
  if (!["base", "inverse"].includes(familyKind)) {
    ui.notifications.error(`Lumière éternelle / Ténèbres éternelles : spellFamily.kind invalide (${String(familyKindRaw)}).`);
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

  const lists = globalThis.add2eGetSpellListsFromItem(sourceItem)
    .map(value => globalThis.add2eNormalizeSpellKey(value)).filter(Boolean);
  const uniqueLists = [...new Set(lists)];
  if (uniqueLists.length !== 1 || uniqueLists[0] !== "clerc") {
    ui.notifications.error(`${spellName} : ce runtime est réservé à la liste Clerc.`);
    return false;
  }

  let casterLevel = 0;
  if (sourceItem.system?.isObjectPower === true) {
    casterLevel = Number(sourceItem.system?.casterLevel);
    if (!Number.isInteger(casterLevel) || casterLevel < 1) {
      ui.notifications.error(`${spellName} : casterLevel canonique absent du pouvoir d'objet magique.`);
      return false;
    }
  } else {
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    if (access?.ok !== true) {
      ui.notifications.error(`${spellName} : accès canonique refusé (${access?.reason ?? "raison inconnue"}).`);
      return false;
    }
    const resolvedList = globalThis.add2eNormalizeSpellKey(access.entry?.key);
    if (resolvedList !== "clerc") {
      ui.notifications.error(`${spellName} : liste résolue incohérente (${resolvedList || "vide"}).`);
      return false;
    }
    casterLevel = Number(access.actorLevel);
    if (!Number.isInteger(casterLevel) || casterLevel < 1) {
      ui.notifications.error(`${spellName} : niveau canonique du lanceur invalide.`);
      return false;
    }
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  if (!casterToken || !canvas.scene) {
    ui.notifications.warn(`${spellName} : le lanceur doit être présent sur une scène active.`);
    return false;
  }

  const environment = await globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "interieur",
    add2eClasses: ["add2e-lumiere-eternelle-context"],
    window: { title: spellName },
    content: `<form><p>Choisissez le contexte de portée.</p><p>La zone d'effet conserve ses dimensions normales.</p></form>`,
    buttons: [
      { action: "interieur", label: "Intérieur", icon: "<i class='fas fa-building'></i>", default: true, callback: () => "interieur" },
      { action: "exterieur", label: "Extérieur", icon: "<i class='fas fa-tree'></i>", callback: () => "exterieur" },
      { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
    ],
    close: () => null
  });
  if (!environment) return false;

  const normalizeText = value => String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[″”]/g, "\"").replace(/\s+/g, " ");
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
  const parseInches = (value, field, radius = false) => {
    const text = canonicalText(value, field);
    const normalized = normalizeText(text);
    const pattern = radius
      ? /^sphere de (\d+(?:[.,]\d+)?)\s*(?:\"|pouces?) de rayon$/
      : /^(\d+(?:[.,]\d+)?)\s*(?:\"|pouces?)$/;
    const match = normalized.match(pattern);
    if (!match) throw new Error(`${spellName} : ${field} non supporté (${text}).`);
    return Number(match[1].replace(",", "."));
  };

  const sceneDistance = (meters, usage = "area") => {
    const value = Number(meters);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${spellName} : distance de scène invalide.`);
    const resolved = globalThis.add2eSceneDistance({
      scene: canvas.scene,
      distance: value,
      unit: "m",
      usage,
      environment,
      measure: "radius"
    });
    const units = Number(resolved?.radiusSceneDistance ?? resolved?.sceneDistance);
    const pixels = Number(resolved?.radiusPixels ?? resolved?.pixels);
    if (!Number.isFinite(units) || units < 0 || !Number.isFinite(pixels) || pixels < 0) {
      throw new Error(`${spellName} : conversion canonique de distance de scène impossible.`);
    }
    return { units, pixels };
  };

  let rangeRule;
  let radiusRule;
  let rangePixels;
  let radiusUnits;
  try {
    const duration = canonicalText(sourceItem.system?.duree, "system.duree");
    if (!["permanent", "permanente"].includes(normalizeText(duration))) {
      throw new Error(`${spellName} : durée non supportée (${duration}).`);
    }
    rangeRule = globalThis.add2eResolveSpellDistance(parseInches(sourceItem.system?.portee, "system.portee"), { environment, kind: "range" });
    radiusRule = globalThis.add2eResolveSpellDistance(parseInches(sourceItem.system?.zone_effet, "system.zone_effet", true), { environment, kind: "area" });
    rangePixels = sceneDistance(rangeRule.meters, "range").pixels;
    radiusUnits = sceneDistance(radiusRule.meters, "area").units;
  } catch (error) {
    console.error("[ADD2E][LUMIERE_ETERNELLE_CLERC][RULES]", { item: sourceItem.name, error });
    ui.notifications.error(error.message);
    return false;
  }

  const inRange = point => Math.hypot(
    Number(point?.x ?? 0) - Number(casterToken.center?.x ?? 0),
    Number(point?.y ?? 0) - Number(casterToken.center?.y ?? 0)
  ) <= rangePixels + 0.1;
  const blocked = (from, to) => {
    try {
      return Boolean(canvas.walls?.checkCollision && typeof Ray !== "undefined"
        && canvas.walls.checkCollision(new Ray(from, to), { type: "sight", mode: "any" }) === true);
    } catch (_error) { return false; }
  };

  const choosePoint = () => {
    ui.notifications.info(`${spellName} : clique sur la scène. Échap ou clic droit annule.`);
    return new Promise(resolve => {
      const stage = canvas.stage;
      if (!stage?.on || !stage?.off) return resolve(null);
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        stage.off("pointerdown", onPointer);
        window.removeEventListener("keydown", onKey, true);
        resolve(value);
      };
      const onKey = event => {
        if (event.key !== "Escape") return;
        event.preventDefault?.();
        finish(null);
      };
      const onPointer = event => {
        const button = Number(event?.button ?? event?.nativeEvent?.button ?? event?.data?.originalEvent?.button ?? 0);
        if (button === 2) return finish(null);
        if (button !== 0) return;
        event?.stopPropagation?.();
        event?.data?.originalEvent?.preventDefault?.();
        const point = event?.getLocalPosition?.(stage)
          ?? event?.data?.getLocalPosition?.(stage)
          ?? stage.toLocal?.(event?.global ?? event?.data?.global ?? null)
          ?? null;
        if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) return finish(null);
        finish({ x: Number(point.x), y: Number(point.y) });
      };
      stage.on("pointerdown", onPointer);
      window.addEventListener("keydown", onKey, true);
    });
  };

  const chooseTarget = async () => {
    const selected = Array.from(game.user.targets ?? []).filter(entry => !!entry?.actor);
    if (selected.length > 1) {
      ui.notifications.warn(`${spellName} : garde une seule créature ciblée.`);
      return null;
    }
    if (selected.length === 1) return selected[0];
    ui.notifications.info(`${spellName} : cible une créature avec le ciblage Foundry. Échap annule.`);
    return new Promise(resolve => {
      let done = false;
      let hookId = null;
      const finish = value => {
        if (done) return;
        done = true;
        if (hookId !== null) Hooks.off("targetToken", hookId);
        window.removeEventListener("keydown", onKey, true);
        resolve(value);
      };
      const onKey = event => {
        if (event.key !== "Escape") return;
        event.preventDefault?.();
        finish(null);
      };
      hookId = Hooks.on("targetToken", (user, target, targeted) => {
        if (user?.id === game.user?.id && targeted === true && target?.actor) finish(target);
      });
      window.addEventListener("keydown", onKey, true);
    });
  };

  const chooseObject = async bearerActor => {
    const candidates = Array.from(bearerActor?.items ?? []).filter(entry => entry?.type !== "sort")
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "fr"));
    if (!candidates.length) {
      ui.notifications.warn(`${spellName} : ${bearerActor?.name ?? "la cible"} ne porte aucun objet sélectionnable.`);
      return null;
    }
    const options = candidates.map(entry => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`).join("");
    const id = await globalThis.add2eDialogWait({
      add2eTheme: "parchment",
      add2ePrimaryAction: "select",
      add2eClasses: ["add2e-lumiere-eternelle-object"],
      window: { title: `${spellName} — objet porté` },
      content: `<form><p>Choisissez l'objet porté par <b>${escapeHtml(bearerActor.name)}</b>.</p><select name="itemId">${options}</select></form>`,
      buttons: [
        { action: "select", label: "Choisir", icon: "<i class='fas fa-hand-holding'></i>", default: true, callback: (_event, button) => button.form?.elements?.itemId?.value ?? null },
        { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
      ], close: () => null
    });
    return id ? (bearerActor.items?.get?.(id) ?? candidates.find(entry => entry.id === id) ?? null) : null;
  };

  const choosePlacement = async () => {
    if (isDarkness) return "body";
    return globalThis.add2eDialogWait({
      add2eTheme: "parchment",
      add2ePrimaryAction: "body",
      add2eClasses: ["add2e-lumiere-eternelle-placement"],
      window: { title: "Lumière éternelle — emplacement" },
      content: `<form><p>Où placez-vous la lumière sur la créature ?</p><p>L'aveuglement ne s'applique que si la lumière couvre les organes visuels.</p></form>`,
      buttons: [
        { action: "body", label: "Corps", icon: "<i class='fas fa-person'></i>", default: true, callback: () => "body" },
        { action: "eyes", label: "Visage / yeux", icon: "<i class='fas fa-eye'></i>", callback: () => "eyes" },
        { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
      ], close: () => null
    });
  };

  const magicResistance = targetActor => {
    const engine = globalThis.ADD2E_EFFECTS;
    if (!engine || typeof engine.checkResistanceDetails !== "function") {
      throw new Error(`${spellName} : résolveur canonique de résistance magique indisponible.`);
    }
    const result = engine.checkResistanceDetails(targetActor, "magie", { chat: false });
    if (!result?.found) return { applicable: false, resisted: false, chance: 0, roll: null };
    return { applicable: true, resisted: result.resiste === true, chance: Number(result.pct) || 0, roll: Number(result.jet) || null };
  };

  const lightConfig = isDarkness
    ? { dim: radiusUnits, bright: 0, angle: 360, color: "#000000", alpha: 1, coloration: 1, luminosity: -1, attenuation: 0.5, animation: { type: null, speed: 5, intensity: 5, reverse: false } }
    : { dim: radiusUnits, bright: radiusUnits, angle: 360, color: "#fffbd0", alpha: 0.55, coloration: 1, luminosity: 0.75, attenuation: 0.35, animation: { type: null, speed: 5, intensity: 5, reverse: false } };

  const updateToken = async tokenDoc => {
    if (game.user.isGM || tokenDoc.isOwner) {
      await tokenDoc.update({ light: lightConfig });
      return true;
    }
    return add2eEternalLightEmitGM("updateToken", {
      sceneId: tokenDoc.parent?.id ?? canvas.scene.id,
      tokenId: tokenDoc.id,
      updateData: { light: lightConfig }
    });
  };

  const createAmbient = async (point, destination) => {
    const requestId = foundry.utils.randomID();
    const flags = { add2e: {
      familyKey: "lumiere_eternelle", spellKey, runtime: ADD2E_ETERNAL_LIGHT_RUNTIME,
      requestId, destination, actorId: caster.id, actorUuid: caster.uuid, sourceItemUuid: sourceItem.uuid ?? null
    } };
    let lightId = null;
    if (game.user.isGM) {
      const created = await canvas.scene.createEmbeddedDocuments("AmbientLight", [{
        x: point.x, y: point.y, rotation: 0, walls: true, vision: isDarkness, config: lightConfig, flags
      }]);
      lightId = created?.[0]?.id ?? null;
      if (!lightId) return null;
    } else {
      const sent = add2eEternalLightEmitGM("createAmbientLight", {
        sceneId: canvas.scene.id, x: point.x, y: point.y, rotation: 0, walls: true, vision: isDarkness,
        dim: lightConfig.dim, bright: lightConfig.bright, angle: lightConfig.angle, color: lightConfig.color,
        alpha: lightConfig.alpha, coloration: lightConfig.coloration, luminosity: lightConfig.luminosity,
        attenuation: lightConfig.attenuation, animation: lightConfig.animation, flags
      });
      if (!sent) return null;
    }
    return { type: "ambient", sceneId: canvas.scene.id, lightId, requestId, actorId: caster.id, actorUuid: caster.uuid, spellKey, x: point.x, y: point.y };
  };

  const createEffect = async (actorDoc, { destination, payload, targetActor = null, objectItem = null, blinded = false, placement = null }) => {
    const tags = [
      `sort:${spellKey}`, "liste:clerc", `niveau:${spellLevel}`, `etat:${spellKey}`, "famille:lumiere_eternelle",
      isDarkness ? "tenebres:eternelles" : "lumiere:eternelle", "permanent", `lumiere_destination:${destination}`,
      ...(placement ? [`lumiere_emplacement:${placement}`] : []),
      ...(blinded ? ["etat:cecite", "aveugle", "lumiere:aveuglement"] : []),
      ...(objectItem ? [`objet:${globalThis.add2eNormalizeSpellKey(objectItem.name)}`] : []),
      destination === "point" || destination === "derriere" ? "ambient_light" : "illumination:token"
    ];
    const data = {
      name: destination === "point" || destination === "derriere" ? `${spellName} : zone` : spellName,
      img: sourceItem.img || (isDarkness ? "icons/magic/unholy/projectile-smoke-black.webp" : "icons/svg/light.svg"),
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: { startTime: game.time?.worldTime ?? null },
      description: blinded
        ? `${spellName} est permanent ; la lumière placée sur les organes visuels aveugle la cible.`
        : `${spellName} est permanent jusqu'à annulation ou dissipation.`,
      flags: { add2e: {
        permanent: true, runtime: ADD2E_ETERNAL_LIGHT_RUNTIME, spellName, spellKey, familyKey: "lumiere_eternelle", familyKind,
        sourceItemUuid: sourceItem.uuid ?? null, casterId: caster.id, casterUuid: caster.uuid, casterLevel, spellLevel,
        listKey: "clerc", environment, rangeMeters: rangeRule.meters, radiusMeters: radiusRule.meters,
        destination, placement, blinded, targetId: targetActor?.id ?? null, targetUuid: targetActor?.uuid ?? null,
        objectItemId: objectItem?.id ?? null, objectItemUuid: objectItem?.uuid ?? null, objectItemName: objectItem?.name ?? null,
        lightPayload: payload, tags, version: ADD2E_ETERNAL_LIGHT_VERSION
      } },
      changes: []
    };
    if (game.user.isGM || actorDoc.isOwner) {
      const created = await actorDoc.createEmbeddedDocuments("ActiveEffect", [data]);
      return Boolean(created?.[0]);
    }
    return add2eEternalLightEmitGM("createActiveEffect", { actorUuid: actorDoc.uuid, actorId: actorDoc.id, effectData: data });
  };

  const pointBehind = targetToken => {
    const origin = casterToken.center;
    const target = targetToken.center;
    const dx = Number(target.x) - Number(origin.x);
    const dy = Number(target.y) - Number(origin.y);
    const length = Math.hypot(dx, dy) || 1;
    const behindPixels = sceneDistance(0.3).pixels;
    const halfToken = Math.max(Number(targetToken.w ?? 0), Number(targetToken.h ?? 0)) / 2;
    const offset = halfToken + behindPixels;
    return { x: target.x + (dx / length) * offset, y: target.y + (dy / length) * offset };
  };

  const selectedTargets = Array.from(game.user.targets ?? []).filter(entry => !!entry?.actor);
  const destination = await globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "creature",
    add2eClasses: ["add2e-lumiere-eternelle-destination"],
    window: { title: `${spellName} — destination` },
    content: `<form><p>Choisissez la destination du sort.</p><p>${selectedTargets.length === 1 ? `Cible actuelle : ${escapeHtml(selectedTargets[0].name ?? selectedTargets[0].actor?.name)}.` : selectedTargets.length > 1 ? `${selectedTargets.length} cibles sont sélectionnées.` : "Aucune créature n'est ciblée."}</p></form>`,
    buttons: [
      { action: "creature", label: "Créature", icon: "<i class='fas fa-crosshairs'></i>", default: true, callback: () => "creature" },
      { action: "object", label: "Objet porté", icon: "<i class='fas fa-hand-holding'></i>", callback: () => "object" },
      { action: "point", label: "Point sur la scène", icon: "<i class='fas fa-location-dot'></i>", callback: () => "point" },
      { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
    ], close: () => null
  });
  if (!destination) return false;

  const details = [];
  let targetToken = null;
  let targetActor = null;
  let objectItem = null;
  let placement = null;
  let blinded = false;
  let resistance = null;
  let saveResult = null;
  let destinationLabel = "";
  let outcome = "";

  if (destination === "point") {
    const point = await choosePoint();
    if (!point) return false;
    if (!inRange(point) || blocked(casterToken.center, point)) {
      ui.notifications.warn(`${spellName} : point hors de portée ou masqué par un obstacle.`);
      return false;
    }
    const payload = await createAmbient(point, "point");
    if (!payload) return false;
    if (!await createEffect(caster, { destination: "point", payload })) {
      await globalThis.ADD2E_ETERNAL_LIGHT_DELETE_AMBIENT(payload);
      return false;
    }
    destinationLabel = "Point choisi sur la scène";
    outcome = isDarkness ? "Zone de ténèbres éternelles créée" : "Zone de lumière éternelle créée";
  }

  if (destination === "object") {
    if (selectedTargets.length > 1) {
      ui.notifications.warn(`${spellName} : garde au plus une créature ciblée pour choisir un objet porté.`);
      return false;
    }
    targetToken = selectedTargets[0] ?? casterToken;
    targetActor = targetToken?.actor ?? null;
    if (!targetActor || !inRange(targetToken.center) || blocked(casterToken.center, targetToken.center)) {
      ui.notifications.warn(`${spellName} : porteur de l'objet invalide, hors de portée ou masqué par un obstacle.`);
      return false;
    }
    objectItem = await chooseObject(targetActor);
    if (!objectItem) return false;
    const payload = {
      type: "token", sceneId: targetToken.document?.parent?.id ?? canvas.scene.id, tokenId: targetToken.id,
      actorId: targetActor.id, actorUuid: targetActor.uuid, spellKey,
      objectItemId: objectItem.id, objectItemUuid: objectItem.uuid ?? null, objectItemName: objectItem.name,
      originalLight: foundry.utils.deepClone(targetToken.document?.light ?? {})
    };
    if (!await updateToken(targetToken.document)) return false;
    if (!await createEffect(targetActor, { destination: "object", payload, targetActor, objectItem })) {
      await globalThis.ADD2E_ETERNAL_LIGHT_RESTORE_TOKEN(payload);
      return false;
    }
    destinationLabel = `${objectItem.name} — porté par ${targetToken.name ?? targetActor.name}`;
    outcome = isDarkness ? "Ténèbres éternelles liées à l'objet" : "Lumière éternelle liée à l'objet";
  }

  if (destination === "creature") {
    targetToken = await chooseTarget();
    if (!targetToken) return false;
    targetActor = targetToken.actor ?? null;
    if (!targetActor || !inRange(targetToken.center) || blocked(casterToken.center, targetToken.center)) {
      ui.notifications.warn(`${spellName} : cible invalide, hors de portée ou masquée par un obstacle.`);
      return false;
    }

    placement = await choosePlacement();
    if (!placement) return false;

    const needsDefense = targetToken.id !== casterToken.id && targetActor.id !== caster.id;
    if (needsDefense) {
      try { resistance = magicResistance(targetActor); }
      catch (error) { ui.notifications.error(error.message); return false; }
      if (resistance.applicable) details.push(`Résistance magique : ${resistance.roll}/${resistance.chance}% — ${resistance.resisted ? "réussie" : "échouée"}`);
      if (resistance.resisted) outcome = "Résistance magique réussie — aucun effet";
    }

    if (!outcome && needsDefense) {
      if (typeof globalThis.add2eRollSavingThrow !== "function") {
        ui.notifications.error(`${spellName} : résolveur canonique des jets de sauvegarde indisponible.`);
        return false;
      }
      saveResult = await globalThis.add2eRollSavingThrow(targetActor, "sorts", {
        source: `spell:${spellKey}`, sourceItem, caster, targetToken, createChat: false, showDice: true
      });
      if (!saveResult?.ok) return false;
      details.push(`Jet de protection : ${saveResult.d20}${saveResult.bonus ? `${saveResult.bonus >= 0 ? "+" : ""}${saveResult.bonus}` : ""} = ${saveResult.total} / ${saveResult.target} — ${saveResult.success ? "réussi" : "raté"}`);
    }

    if (!outcome && saveResult?.success === true) {
      const point = pointBehind(targetToken);
      const payload = await createAmbient(point, "derriere");
      if (!payload) return false;
      if (!await createEffect(caster, { destination: "derriere", payload, targetActor, placement })) {
        await globalThis.ADD2E_ETERNAL_LIGHT_DELETE_AMBIENT(payload);
        return false;
      }
      destinationLabel = `${targetToken.name ?? targetActor.name} — 30 cm derrière`;
      outcome = `Jet de protection réussi — ${isDarkness ? "ténèbres" : "lumière"} créée 30 cm derrière`;
    }

    if (!outcome) {
      const payload = {
        type: "token", sceneId: targetToken.document?.parent?.id ?? canvas.scene.id, tokenId: targetToken.id,
        actorId: targetActor.id, actorUuid: targetActor.uuid, spellKey,
        originalLight: foundry.utils.deepClone(targetToken.document?.light ?? {})
      };
      if (!await updateToken(targetToken.document)) return false;
      blinded = !isDarkness && placement === "eyes";
      if (!await createEffect(targetActor, { destination: "token", payload, targetActor, blinded, placement })) {
        await globalThis.ADD2E_ETERNAL_LIGHT_RESTORE_TOKEN(payload);
        return false;
      }
      destinationLabel = targetToken.name ?? targetActor.name;
      outcome = blinded
        ? "Lumière éternelle appliquée — cible aveuglée"
        : `${spellName} appliqué${isDarkness ? "es" : "e"} à la créature`;
      if (blinded) details.push("La lumière placée sur les organes visuels aveugle la cible.");
    }
  }

  const card = {
    actor: caster,
    title: spellName,
    icon: isDarkness ? "fas fa-moon" : "fas fa-sun",
    variant: "spell",
    source: { name: caster.name, img: sourceItem.img ?? caster.img, type: `Clerc niveau ${casterLevel}` },
    target: targetActor ? {
      name: targetToken?.name ?? targetActor.name, img: targetActor.img,
      type: destination === "object" ? "Porteur de l'objet" : "Cible du sort", meta: objectItem?.name ?? ""
    } : null,
    rows: [
      { label: "Liste", value: `Clerc — niveau de lanceur ${casterLevel}` },
      { label: "Contexte", value: environment === "exterieur" ? "Extérieur" : "Intérieur" },
      { label: "Portée", value: `${rangeRule.inches}\" = ${rangeRule.meters} m` },
      { label: "Zone", value: `sphère de ${radiusRule.inches}\" de rayon = ${radiusRule.meters} m` },
      { label: "Durée", value: "Permanente" },
      { label: "Destination", value: destinationLabel || destination },
      ...(!isDarkness && placement ? [{ label: "Emplacement", value: placement === "eyes" ? "Visage / yeux" : "Corps" }] : []),
      ...(objectItem ? [{ label: "Objet", value: objectItem.name }] : []),
      { label: "Résultat", value: outcome || "Effet appliqué" }
    ],
    message: `${caster.name} lance ${spellName}.`,
    trustedBodyHtml: `<div class="add2e-lumiere-eternelle-results">${details.length ? `<ul>${details.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>` : ""}<p>${escapeHtml(isDarkness ? "Ténèbres éternelles crée une obscurité totale permanente." : "Lumière éternelle est permanente ; sur une créature, la cécité ne s'applique que si la lumière couvre les organes visuels.")}</p></div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: saveResult?.roll ? [saveResult.roll] : [],
      flags: { add2e: {
        chatCardType: "lumiere-eternelle", version: ADD2E_ETERNAL_LIGHT_VERSION, spellKey, familyKind,
        sourceItemUuid: sourceItem.uuid ?? null, casterLevel, spellLevel, listKey: "clerc", environment,
        rangeMeters: rangeRule.meters, radiusMeters: radiusRule.meters, permanent: true,
        destination, placement, blinded, objectItemId: objectItem?.id ?? null,
        targetActorUuid: targetActor?.uuid ?? null, targetTokenId: targetToken?.id ?? null,
        resistance, saveSuccess: saveResult?.success ?? null, outcome
      } }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${spellName} : carte ADD2E vide.`);
  await globalThis.add2eCreateChatCard(card);
  try { await globalThis.ADD2E_PLAY_SPELL_FX?.(spellKey, { casterToken, targetToken }); } catch (_error) {}
  return true;
})();