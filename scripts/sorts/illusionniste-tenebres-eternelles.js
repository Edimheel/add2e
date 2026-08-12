/**
 * ADD2E — Ténèbres éternelles (Illusionniste)
 * Globe d'obscurité totale permanent, statique, basé sur l'Item sort lancé.
 * Compatible Foundry V13/V14/V15 — fenêtres via l'API ADD2E commune.
 */

const ADD2E_ILLUSIONIST_ETERNAL_DARKNESS_VERSION = "2026-08-12-illusionist-eternal-darkness-runtime-v1";

function add2eEternalDarknessEmitGM(operation, payload) {
  if (!game.socket) return false;
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
  });
  return true;
}

globalThis.ADD2E_ETERNAL_DARKNESS_FIND_AMBIENT = payload => {
  if (!payload) return null;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  if (!scene) return null;

  if (payload.lightId) {
    const byId = scene.lights?.get(payload.lightId) ?? null;
    if (byId) return byId;
  }

  if (payload.requestId) {
    return scene.lights?.find(light =>
      light.flags?.add2e?.requestId === payload.requestId
      || light.getFlag?.("add2e", "requestId") === payload.requestId
    ) ?? null;
  }

  return null;
};

globalThis.ADD2E_ETERNAL_DARKNESS_DELETE_AMBIENT = async payload => {
  if (!payload || payload.type !== "ambient") return;
  const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
  if (!scene) return;
  const light = globalThis.ADD2E_ETERNAL_DARKNESS_FIND_AMBIENT(payload);

  if (game.user.isGM) {
    if (light) await light.delete();
    return;
  }

  add2eEternalDarknessEmitGM("deleteAmbientLight", {
    sceneId: scene.id,
    lightId: light?.id ?? payload.lightId ?? null,
    requestId: payload.requestId ?? null,
    actorId: payload.actorId ?? null,
    actorUuid: payload.actorUuid ?? null,
    spellKey: "tenebres_eternelles",
    x: payload.x ?? null,
    y: payload.y ?? null
  });
};

if (globalThis.ADD2E_ETERNAL_DARKNESS_HOOKS_VERSION !== ADD2E_ILLUSIONIST_ETERNAL_DARKNESS_VERSION) {
  globalThis.ADD2E_ETERNAL_DARKNESS_HOOKS_VERSION = ADD2E_ILLUSIONIST_ETERNAL_DARKNESS_VERSION;

  const cleanup = async effect => {
    const flags = effect?.flags?.add2e ?? {};
    if (flags.spellKey !== "tenebres_eternelles" || flags.runtime !== "illusionist-eternal-darkness") return;
    const payload = flags.lightPayload ?? null;
    if (payload?.type === "ambient") await globalThis.ADD2E_ETERNAL_DARKNESS_DELETE_AMBIENT(payload);
  };

  Hooks.on("deleteActiveEffect", cleanup);
  Hooks.on("updateActiveEffect", async (effect, changes) => {
    if (changes?.disabled === true) await cleanup(effect);
  });
}

return await (async () => {
  const sourceItem = (typeof sort !== "undefined" && sort?.type === "sort")
    ? sort
    : ((typeof item !== "undefined" && item?.type === "sort")
      ? item
      : ((typeof spell !== "undefined" && spell?.type === "sort")
        ? spell
        : ((typeof args !== "undefined" && args?.[0]?.item?.type === "sort") ? args[0].item : null)));

  if (!sourceItem) {
    ui.notifications.error("Ténèbres éternelles : Item sort canonique introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Ténèbres éternelles : lanceur introuvable.");
    return false;
  }

  const required = [
    "add2eNormalizeSpellKey",
    "add2eGetSpellListsFromItem",
    "add2eResolveSpellDistance",
    "add2eCanActorUseSpell",
    "add2eDialogWait",
    "add2eBuildChatCard",
    "add2eCreateChatCard"
  ];
  const missing = required.filter(name => typeof globalThis[name] !== "function");
  if (missing.length) {
    ui.notifications.error(`Ténèbres éternelles : API ADD2E indisponible (${missing.join(", ")}).`);
    return false;
  }

  const spellLevel = Number(sourceItem.system?.niveau);
  if (!Number.isInteger(spellLevel) || spellLevel < 1) {
    ui.notifications.error("Ténèbres éternelles : system.niveau canonique invalide.");
    return false;
  }

  const spellLists = globalThis.add2eGetSpellListsFromItem(sourceItem)
    .map(value => globalThis.add2eNormalizeSpellKey(value))
    .filter(Boolean);
  const uniqueLists = [...new Set(spellLists)];
  if (uniqueLists.length !== 1 || uniqueLists[0] !== "illusionniste") {
    ui.notifications.error("Ténèbres éternelles : ce runtime est réservé à la liste Illusionniste.");
    return false;
  }

  let casterLevel = 0;
  if (sourceItem.system?.isObjectPower === true) {
    casterLevel = Number(sourceItem.system?.casterLevel);
    if (!Number.isInteger(casterLevel) || casterLevel < 1) {
      ui.notifications.error("Ténèbres éternelles : casterLevel canonique absent du pouvoir d'objet magique.");
      return false;
    }
  } else {
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    if (access?.ok !== true) {
      ui.notifications.error(`Ténèbres éternelles : accès canonique refusé (${access?.reason ?? "raison inconnue"}).`);
      return false;
    }
    const resolvedList = globalThis.add2eNormalizeSpellKey(access.entry?.key);
    if (resolvedList !== "illusionniste") {
      ui.notifications.error(`Ténèbres éternelles : liste résolue incohérente (${resolvedList || "vide"}).`);
      return false;
    }
    casterLevel = Number(access.actorLevel);
    if (!Number.isInteger(casterLevel) || casterLevel < 1) {
      ui.notifications.error("Ténèbres éternelles : niveau canonique du lanceur invalide.");
      return false;
    }
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  if (!casterToken || !canvas.scene) {
    ui.notifications.warn("Ténèbres éternelles : le lanceur doit être présent sur une scène active.");
    return false;
  }

  const environment = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "interieur",
    add2eClasses: ["add2e-tenebres-eternelles-context"],
    window: { title: "Ténèbres éternelles" },
    content: `
      <form class="add2e-tenebres-eternelles-context-form">
        <p>Choisissez le contexte de portée.</p>
        <p>La zone d'effet conserve ses dimensions normales en intérieur comme en extérieur.</p>
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

  const normalizeText = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[″”]/g, "\"")
    .replace(/\s+/g, " ");

  const canonicalText = (value, field) => {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valeur")) {
      const text = String(value.valeur ?? "").trim();
      if (text) return text;
    }
    throw new Error(`Ténèbres éternelles : ${field} canonique invalide.`);
  };

  const parseRangeInches = value => {
    const text = canonicalText(value, "system.portee");
    const match = normalizeText(text).match(/^(\d+(?:[.,]\d+)?)\s*(?:\"|pouces?)$/);
    if (!match) throw new Error(`Ténèbres éternelles : portée canonique non supportée (${text}).`);
    return Number(match[1].replace(",", "."));
  };

  const parseRadiusInches = value => {
    const text = canonicalText(value, "system.zone_effet");
    const match = normalizeText(text).match(/^sphere de (\d+(?:[.,]\d+)?)\s*(?:\"|pouces?) de rayon$/);
    if (!match) throw new Error(`Ténèbres éternelles : zone_effet canonique non supportée (${text}).`);
    return Number(match[1].replace(",", "."));
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
      throw new Error(`Ténèbres éternelles : unité de distance de scène non supportée (${scene?.grid?.units || "vide"}).`);
    }
    return factor;
  };

  const sceneDistanceFromMeters = meters => {
    const value = Number(meters);
    const gridDistance = Number(canvas.scene?.grid?.distance);
    const gridSize = Number(canvas.scene?.grid?.size);
    if (!Number.isFinite(value) || value < 0 || !(gridDistance > 0) || !(gridSize > 0)) {
      throw new Error("Ténèbres éternelles : configuration de distance de scène invalide.");
    }
    const sceneUnits = value / sceneMetersPerUnit(canvas.scene);
    return {
      sceneUnits,
      pixels: (sceneUnits / gridDistance) * gridSize
    };
  };

  let rangeRule;
  let radiusRule;
  let rangePixels;
  let radiusSceneUnits;
  try {
    const durationText = canonicalText(sourceItem.system?.duree, "system.duree");
    if (!["permanent", "permanente"].includes(normalizeText(durationText))) {
      throw new Error(`Ténèbres éternelles : durée canonique non supportée (${durationText}).`);
    }

    const rangeInches = parseRangeInches(sourceItem.system?.portee);
    const radiusInches = parseRadiusInches(sourceItem.system?.zone_effet);
    rangeRule = globalThis.add2eResolveSpellDistance(rangeInches, { environment, kind: "range" });
    radiusRule = globalThis.add2eResolveSpellDistance(radiusInches, { environment, kind: "area" });
    rangePixels = sceneDistanceFromMeters(rangeRule.meters).pixels;
    radiusSceneUnits = sceneDistanceFromMeters(radiusRule.meters).sceneUnits;
  } catch (error) {
    console.error("[ADD2E][TENEBRES_ETERNELLES][RULES]", {
      item: sourceItem.name,
      portee: sourceItem.system?.portee,
      zone_effet: sourceItem.system?.zone_effet,
      duree: sourceItem.system?.duree,
      environment,
      error
    });
    ui.notifications.error(error.message);
    return false;
  }

  const chooseCanvasPoint = () => {
    ui.notifications.info("Ténèbres éternelles : clique sur la scène pour placer le centre du globe. Échap ou clic droit annule.");
    return new Promise(resolve => {
      const stage = canvas.stage;
      if (!stage?.on || !stage?.off) {
        ui.notifications.error("Ténèbres éternelles : sélection de point indisponible sur cette scène.");
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
        if (event.key !== "Escape") return;
        event.preventDefault?.();
        finish(null);
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
        if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) {
          ui.notifications.warn("Ténèbres éternelles : position de scène illisible.");
          return finish(null);
        }
        finish({ x: Number(point.x), y: Number(point.y) });
      };

      stage.on("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown, true);
    });
  };

  const point = await chooseCanvasPoint();
  if (!point) return false;

  const distancePixels = Math.hypot(
    Number(point.x) - Number(casterToken.center?.x ?? 0),
    Number(point.y) - Number(casterToken.center?.y ?? 0)
  );
  if (distancePixels > rangePixels + 0.1) {
    ui.notifications.warn(`Ténèbres éternelles : point hors de portée (${rangeRule.inches}\").`);
    return false;
  }

  try {
    if (canvas.walls?.checkCollision && typeof Ray !== "undefined"
      && canvas.walls.checkCollision(new Ray(casterToken.center, point), { type: "sight", mode: "any" }) === true) {
      ui.notifications.warn("Ténèbres éternelles : un obstacle bloque la ligne d'effet.");
      return false;
    }
  } catch (_error) {}

  const darknessConfig = {
    dim: radiusSceneUnits,
    bright: 0,
    angle: 360,
    color: "#000000",
    alpha: 1,
    coloration: 1,
    luminosity: -1,
    attenuation: 0.5,
    animation: { type: null, speed: 5, intensity: 5, reverse: false }
  };

  const requestId = foundry.utils.randomID();
  const ambientFlags = {
    add2e: {
      spellName: "Ténèbres éternelles",
      spellKey: "tenebres_eternelles",
      familyKey: "lumiere_eternelle",
      runtime: "illusionist-eternal-darkness",
      permanent: true,
      requestId,
      actorId: caster.id,
      actorUuid: caster.uuid,
      sourceItemUuid: sourceItem.uuid ?? null,
      fromUserId: game.user.id,
      interactionTags: [
        "obscurite:totale",
        "bloque:infravision",
        "bloque:ultravision",
        "annule:lumiere",
        "interaction:lumiere_eternelle"
      ]
    }
  };

  let lightId = null;
  if (game.user.isGM) {
    const created = await canvas.scene.createEmbeddedDocuments("AmbientLight", [{
      x: point.x,
      y: point.y,
      rotation: 0,
      walls: true,
      vision: true,
      config: darknessConfig,
      flags: ambientFlags
    }]);
    lightId = created?.[0]?.id ?? null;
    if (!lightId) {
      ui.notifications.error("Ténèbres éternelles : création de la zone d'obscurité impossible.");
      return false;
    }
  } else {
    const sent = add2eEternalDarknessEmitGM("createAmbientLight", {
      sceneId: canvas.scene.id,
      x: point.x,
      y: point.y,
      rotation: 0,
      walls: true,
      vision: true,
      dim: darknessConfig.dim,
      bright: darknessConfig.bright,
      angle: darknessConfig.angle,
      color: darknessConfig.color,
      alpha: darknessConfig.alpha,
      coloration: darknessConfig.coloration,
      luminosity: darknessConfig.luminosity,
      attenuation: darknessConfig.attenuation,
      animation: darknessConfig.animation,
      flags: ambientFlags
    });
    if (!sent) {
      ui.notifications.error("Ténèbres éternelles : relais MJ indisponible pour créer la zone.");
      return false;
    }
  }

  const lightPayload = {
    type: "ambient",
    sceneId: canvas.scene.id,
    lightId,
    requestId,
    actorId: caster.id,
    actorUuid: caster.uuid,
    spellKey: "tenebres_eternelles",
    x: point.x,
    y: point.y
  };

  const effectData = {
    name: "Ténèbres éternelles : zone",
    img: sourceItem.img || "icons/magic/unholy/projectile-smoke-black.webp",
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration: { startTime: game.time?.worldTime ?? null },
    description: "Globe d'obscurité totale permanent. Infravision et ultravision sont inefficaces dans la zone.",
    flags: {
      add2e: {
        permanent: true,
        spellName: "Ténèbres éternelles",
        spellKey: "tenebres_eternelles",
        familyKey: "lumiere_eternelle",
        runtime: "illusionist-eternal-darkness",
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id,
        casterUuid: caster.uuid,
        casterLevel,
        spellLevel,
        listKey: "illusionniste",
        environment,
        rangeMeters: rangeRule.meters,
        radiusMeters: radiusRule.meters,
        lightPayload,
        tags: [
          "sort:tenebres_eternelles",
          "liste:illusionniste",
          `niveau:${spellLevel}`,
          "etat:tenebres_eternelles",
          "famille:lumiere_eternelle",
          "tenebres:eternelles",
          "obscurite:totale",
          "bloque:infravision",
          "bloque:ultravision",
          "permanent",
          "ambient_light",
          "annule:lumiere",
          "interaction:lumiere_eternelle"
        ],
        version: ADD2E_ILLUSIONIST_ETERNAL_DARKNESS_VERSION
      }
    },
    changes: []
  };

  let effectCreated = false;
  if (game.user.isGM || caster.isOwner) {
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    effectCreated = Boolean(created?.[0]);
  } else {
    effectCreated = add2eEternalDarknessEmitGM("createActiveEffect", {
      actorUuid: caster.uuid,
      actorId: caster.id,
      effectData
    });
  }

  if (!effectCreated) {
    await globalThis.ADD2E_ETERNAL_DARKNESS_DELETE_AMBIENT(lightPayload);
    ui.notifications.error("Ténèbres éternelles : l'effet de suivi n'a pas pu être créé.");
    return false;
  }

  const card = {
    actor: caster,
    title: "Ténèbres éternelles",
    icon: "fas fa-moon",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img ?? caster.img,
      type: `Illusionniste niveau ${casterLevel}`
    },
    rows: [
      { label: "Liste", value: `Illusionniste — niveau de lanceur ${casterLevel}` },
      { label: "Contexte", value: environment === "exterieur" ? "Extérieur" : "Intérieur" },
      { label: "Portée", value: `${rangeRule.inches}\" = ${rangeRule.meters} m` },
      { label: "Zone", value: `sphère de ${radiusRule.inches}\" de rayon = ${radiusRule.meters} m` },
      { label: "Durée", value: "Permanente" },
      { label: "Jet de protection", value: "Aucun" },
      { label: "Résultat", value: "Globe d'obscurité totale créé" }
    ],
    message: `${caster.name} lance Ténèbres éternelles.`,
    trustedBodyHtml: `
      <div class="add2e-tenebres-eternelles-results">
        <p>Le globe est une obscurité totale : infravision et ultravision y sont inefficaces.</p>
        <p>Les interactions avec Lumière et Lumière éternelle sont conservées dans les métadonnées de l'effet pour leur résolution par la mécanique de contre-sort correspondante.</p>
      </div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "tenebres-eternelles",
          version: ADD2E_ILLUSIONIST_ETERNAL_DARKNESS_VERSION,
          spellKey: "tenebres_eternelles",
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel,
          spellLevel,
          listKey: "illusionniste",
          environment,
          rangeInches: rangeRule.inches,
          rangeMeters: rangeRule.meters,
          radiusInches: radiusRule.inches,
          radiusMeters: radiusRule.meters,
          permanent: true,
          requestId,
          sceneId: canvas.scene.id,
          lightId
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) {
    await globalThis.ADD2E_ETERNAL_DARKNESS_DELETE_AMBIENT(lightPayload);
    throw new Error("Ténèbres éternelles : carte ADD2E vide.");
  }
  await globalThis.add2eCreateChatCard(card);

  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.("tenebres_eternelles", { casterToken, targetToken: null });
  } catch (_error) {}

  return true;
})();