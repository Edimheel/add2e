/**
 * ADD2E — Ténèbres sur 5 mètres (Magicien)
 * Globe d'obscurité totale temporaire, statique, basé sur l'Item lancé.
 * Compatible Foundry V13/V14/V15 — fenêtres via l'API ADD2E commune.
 */

const ADD2E_WIZARD_DARKNESS_VERSION = "2026-08-12-wizard-darkness-area-runtime-v1";
const ADD2E_WIZARD_DARKNESS_RUNTIME = "wizard-darkness-area";

function add2eWizardDarknessEmitGM(operation, payload) {
  if (!game.socket) return false;
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
  });
  return true;
}

globalThis.ADD2E_WIZARD_DARKNESS_FIND_AMBIENT = payload => {
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

globalThis.ADD2E_WIZARD_DARKNESS_DELETE_AMBIENT = async payload => {
  if (!payload || payload.type !== "ambient") return;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  if (!scene) return;
  const light = globalThis.ADD2E_WIZARD_DARKNESS_FIND_AMBIENT(payload);
  if (game.user.isGM) {
    if (light) await light.delete();
    return;
  }
  add2eWizardDarknessEmitGM("deleteAmbientLight", {
    sceneId: scene.id,
    lightId: light?.id ?? payload.lightId ?? null,
    requestId: payload.requestId ?? null,
    actorId: payload.actorId ?? null,
    actorUuid: payload.actorUuid ?? null,
    spellKey: "tenebres_sur_5_metres",
    x: payload.x ?? null,
    y: payload.y ?? null
  });
};

if (globalThis.ADD2E_WIZARD_DARKNESS_HOOKS_VERSION !== ADD2E_WIZARD_DARKNESS_VERSION) {
  globalThis.ADD2E_WIZARD_DARKNESS_HOOKS_VERSION = ADD2E_WIZARD_DARKNESS_VERSION;
  const cleanup = async effect => {
    const flags = effect?.flags?.add2e ?? {};
    if (flags.runtime !== ADD2E_WIZARD_DARKNESS_RUNTIME) return;
    const payload = flags.lightPayload ?? null;
    if (payload?.type === "ambient") await globalThis.ADD2E_WIZARD_DARKNESS_DELETE_AMBIENT(payload);
  };
  Hooks.on("deleteActiveEffect", cleanup);
  Hooks.on("updateActiveEffect", async (effect, changes) => {
    if (changes?.disabled === true) await cleanup(effect);
  });
}

return await (async () => {
  const spellName = "Ténèbres sur 5 mètres";
  const spellKey = "tenebres_sur_5_metres";
  const sourceItem = (typeof sort !== "undefined" && sort?.type === "sort")
    ? sort
    : ((typeof item !== "undefined" && item?.type === "sort")
      ? item
      : ((typeof spell !== "undefined" && spell?.type === "sort")
        ? spell
        : ((typeof args !== "undefined" && args?.[0]?.item?.type === "sort") ? args[0].item : null)));
  if (!sourceItem) {
    ui.notifications.error(`${spellName} : Item sort canonique introuvable.`);
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error(`${spellName} : lanceur introuvable.`);
    return false;
  }

  const required = [
    "add2eNormalizeSpellKey", "add2eGetSpellListsFromItem", "add2eResolveSpellDistance",
    "add2eCanActorUseSpell", "add2eDialogWait", "add2eBuildChatCard", "add2eCreateChatCard"
  ];
  const missing = required.filter(name => typeof globalThis[name] !== "function");
  if (missing.length) {
    ui.notifications.error(`${spellName} : API ADD2E indisponible (${missing.join(", ")}).`);
    return false;
  }

  const spellLevel = Number(sourceItem.system?.niveau);
  if (!Number.isInteger(spellLevel) || spellLevel < 1) {
    ui.notifications.error(`${spellName} : system.niveau canonique invalide.`);
    return false;
  }
  const lists = globalThis.add2eGetSpellListsFromItem(sourceItem)
    .map(value => globalThis.add2eNormalizeSpellKey(value)).filter(Boolean);
  const uniqueLists = [...new Set(lists)];
  if (uniqueLists.length !== 1 || uniqueLists[0] !== "magicien") {
    ui.notifications.error(`${spellName} : ce runtime est réservé à la liste Magicien.`);
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
    if (globalThis.add2eNormalizeSpellKey(access.entry?.key) !== "magicien") {
      ui.notifications.error(`${spellName} : liste résolue incohérente.`);
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
    add2eTheme: "wizard",
    add2ePrimaryAction: "interieur",
    add2eClasses: ["add2e-tenebres-5m-context"],
    window: { title: spellName },
    content: `<form><p>Choisissez le contexte de portée.</p><p>Le rayon de la zone reste celui indiqué par le sort.</p></form>`,
    buttons: [
      { action: "interieur", label: "Intérieur", icon: "<i class='fas fa-building'></i>", default: true, callback: () => "interieur" },
      { action: "exterieur", label: "Extérieur", icon: "<i class='fas fa-tree'></i>", callback: () => "exterieur" },
      { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
    ], close: () => null
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

  const parseRangeInches = value => {
    const text = canonicalText(value, "system.portee");
    const normalized = normalizeText(text);
    let match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(?:\"|pouces?)\/niveau$/);
    if (match) return Number(match[1].replace(",", ".")) * casterLevel;
    match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(?:\"|pouces?)$/);
    if (match) return Number(match[1].replace(",", "."));
    throw new Error(`${spellName} : portée canonique non supportée (${text}).`);
  };

  const parseRadiusMeters = value => {
    const text = canonicalText(value, "system.zone_effet");
    const match = normalizeText(text).match(/^sphere de (\d+(?:[.,]\d+)?)\s*(?:m|metres?) de rayon$/);
    if (!match) throw new Error(`${spellName} : zone_effet canonique non supportée (${text}).`);
    return Number(match[1].replace(",", "."));
  };

  const parseDurationRounds = value => {
    const text = canonicalText(value, "system.duree");
    const normalized = normalizeText(text);
    let match = normalized.match(/^(\d+(?:[.,]\d+)?) tours? \+ (\d+(?:[.,]\d+)?) rounds?\/niveau$/);
    if (match) {
      return Math.round((Number(match[1].replace(",", ".")) * 10)
        + (Number(match[2].replace(",", ".")) * casterLevel));
    }
    match = normalized.match(/^(\d+(?:[.,]\d+)?) rounds? \+ (\d+(?:[.,]\d+)?) rounds?\/niveau$/);
    if (match) {
      return Math.round(Number(match[1].replace(",", "."))
        + (Number(match[2].replace(",", ".")) * casterLevel));
    }
    throw new Error(`${spellName} : durée canonique non supportée (${text}).`);
  };

  const sceneMetersPerUnit = scene => {
    const unit = String(scene?.grid?.units ?? "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const factors = new Map([
      ["m", 1], ["metre", 1], ["metres", 1], ["meter", 1], ["meters", 1],
      ["km", 1000], ["cm", 0.01],
      ["ft", 0.3048], ["foot", 0.3048], ["feet", 0.3048], ["pied", 0.3048], ["pieds", 0.3048],
      ["yd", 0.9144], ["yard", 0.9144], ["yards", 0.9144]
    ]);
    const factor = factors.get(unit);
    if (!(factor > 0)) throw new Error(`${spellName} : unité de scène non supportée (${scene?.grid?.units || "vide"}).`);
    return factor;
  };
  const sceneDistance = meters => {
    const gridDistance = Number(canvas.scene?.grid?.distance);
    const gridSize = Number(canvas.scene?.grid?.size);
    if (!(gridDistance > 0) || !(gridSize > 0)) throw new Error(`${spellName} : grille Foundry invalide.`);
    const units = Number(meters) / sceneMetersPerUnit(canvas.scene);
    return { units, pixels: (units / gridDistance) * gridSize };
  };

  let rangeRule;
  let radiusMeters;
  let rangePixels;
  let radiusUnits;
  let durationRounds;
  try {
    rangeRule = globalThis.add2eResolveSpellDistance(parseRangeInches(sourceItem.system?.portee), { environment, kind: "range" });
    radiusMeters = parseRadiusMeters(sourceItem.system?.zone_effet);
    durationRounds = parseDurationRounds(sourceItem.system?.duree);
    rangePixels = sceneDistance(rangeRule.meters).pixels;
    radiusUnits = sceneDistance(radiusMeters).units;
    if (!(durationRounds > 0)) throw new Error(`${spellName} : durée résolue invalide.`);
  } catch (error) {
    console.error("[ADD2E][TENEBRES_5M][RULES]", { item: sourceItem.name, error });
    ui.notifications.error(error.message);
    return false;
  }

  const durationData = rounds => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(rounds) ?? {
      rounds, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null
    };
  };

  const choosePoint = () => {
    ui.notifications.info(`${spellName} : clique sur la scène pour placer le centre du globe. Échap ou clic droit annule.`);
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

  const point = await choosePoint();
  if (!point) return false;
  const distancePixels = Math.hypot(point.x - casterToken.center.x, point.y - casterToken.center.y);
  if (distancePixels > rangePixels + 0.1) {
    ui.notifications.warn(`${spellName} : point hors de portée.`);
    return false;
  }
  try {
    if (canvas.walls?.checkCollision && typeof Ray !== "undefined"
      && canvas.walls.checkCollision(new Ray(casterToken.center, point), { type: "sight", mode: "any" }) === true) {
      ui.notifications.warn(`${spellName} : un obstacle bloque la ligne d'effet.`);
      return false;
    }
  } catch (_error) {}

  const darknessConfig = {
    dim: radiusUnits, bright: 0, angle: 360, color: "#000000", alpha: 1,
    coloration: 1, luminosity: -1, attenuation: 0.5,
    animation: { type: null, speed: 5, intensity: 5, reverse: false }
  };
  const requestId = foundry.utils.randomID();
  const ambientFlags = { add2e: {
    runtime: ADD2E_WIZARD_DARKNESS_RUNTIME, spellKey, requestId,
    actorId: caster.id, actorUuid: caster.uuid, sourceItemUuid: sourceItem.uuid ?? null,
    interactionTags: ["obscurite:totale", "bloque:infravision", "bloque:ultravision", "annule:lumiere", "suspend:lumiere_eternelle"]
  } };

  let lightId = null;
  if (game.user.isGM) {
    const created = await canvas.scene.createEmbeddedDocuments("AmbientLight", [{
      x: point.x, y: point.y, rotation: 0, walls: true, vision: true, config: darknessConfig, flags: ambientFlags
    }]);
    lightId = created?.[0]?.id ?? null;
    if (!lightId) return false;
  } else {
    const sent = add2eWizardDarknessEmitGM("createAmbientLight", {
      sceneId: canvas.scene.id, x: point.x, y: point.y, rotation: 0, walls: true, vision: true,
      dim: darknessConfig.dim, bright: 0, angle: 360, color: darknessConfig.color, alpha: darknessConfig.alpha,
      coloration: darknessConfig.coloration, luminosity: darknessConfig.luminosity,
      attenuation: darknessConfig.attenuation, animation: darknessConfig.animation, flags: ambientFlags
    });
    if (!sent) return false;
  }

  const lightPayload = {
    type: "ambient", sceneId: canvas.scene.id, lightId, requestId,
    actorId: caster.id, actorUuid: caster.uuid, spellKey, x: point.x, y: point.y
  };
  const effectData = {
    name: `${spellName} : zone`,
    img: sourceItem.img || "icons/magic/unholy/projectile-smoke-black.webp",
    origin: sourceItem.uuid ?? null,
    disabled: false, transfer: false,
    duration: durationData(durationRounds),
    description: "Obscurité totale : infravision et ultravision sont inefficaces dans la zone.",
    flags: { add2e: {
      runtime: ADD2E_WIZARD_DARKNESS_RUNTIME, spellName, spellKey,
      sourceItemUuid: sourceItem.uuid ?? null, casterId: caster.id, casterUuid: caster.uuid,
      casterLevel, spellLevel, listKey: "magicien", environment,
      rangeMeters: rangeRule.meters, radiusMeters, durationRounds, lightPayload,
      tags: [
        `sort:${spellKey}`, "liste:magicien", `niveau:${spellLevel}`, "tenebres", "obscurite:totale",
        "bloque:infravision", "bloque:ultravision", "ambient_light", "annule:lumiere", "suspend:lumiere_eternelle"
      ],
      version: ADD2E_WIZARD_DARKNESS_VERSION
    } },
    changes: []
  };

  let effectCreated = false;
  if (game.user.isGM || caster.isOwner) {
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    effectCreated = Boolean(created?.[0]);
  } else {
    effectCreated = add2eWizardDarknessEmitGM("createActiveEffect", { actorUuid: caster.uuid, actorId: caster.id, effectData });
  }
  if (!effectCreated) {
    await globalThis.ADD2E_WIZARD_DARKNESS_DELETE_AMBIENT(lightPayload);
    return false;
  }

  const card = {
    actor: caster,
    title: spellName,
    icon: "fas fa-moon",
    variant: "spell",
    source: { name: caster.name, img: sourceItem.img ?? caster.img, type: `Magicien niveau ${casterLevel}` },
    rows: [
      { label: "Liste", value: `Magicien — niveau de lanceur ${casterLevel}` },
      { label: "Contexte", value: environment === "exterieur" ? "Extérieur" : "Intérieur" },
      { label: "Portée", value: `${rangeRule.inches}\" = ${rangeRule.meters} m` },
      { label: "Zone", value: `sphère de ${radiusMeters} m de rayon` },
      { label: "Durée", value: `${durationRounds} rounds` },
      { label: "Jet de protection", value: "Aucun" },
      { label: "Résultat", value: "Globe d'obscurité totale créé" }
    ],
    message: `${caster.name} lance ${spellName}.`,
    trustedBodyHtml: `<div class="add2e-tenebres-5m-results"><p>Infravision et ultravision sont inefficaces. Le sort dissipe Lumière et suspend temporairement Lumière éternelle selon les règles d'interaction de la famille.</p></div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: { add2e: {
        chatCardType: "tenebres-sur-5-metres", version: ADD2E_WIZARD_DARKNESS_VERSION,
        spellKey, sourceItemUuid: sourceItem.uuid ?? null, casterLevel, spellLevel,
        listKey: "magicien", environment, rangeMeters: rangeRule.meters, radiusMeters,
        durationRounds, requestId, sceneId: canvas.scene.id, lightId
      } }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) {
    await globalThis.ADD2E_WIZARD_DARKNESS_DELETE_AMBIENT(lightPayload);
    throw new Error(`${spellName} : carte ADD2E vide.`);
  }
  await globalThis.add2eCreateChatCard(card);
  try { await globalThis.ADD2E_PLAY_SPELL_FX?.(spellKey, { casterToken, targetToken: null }); } catch (_error) {}
  return true;
})();