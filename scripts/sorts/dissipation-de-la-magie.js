/**
 * ADD2E — Dissipation de la magie
 * Runtime canonique commun Clerc / Magicien / Druide et pouvoirs d'objet équivalents.
 * Résout les effets magiques actifs dans le cube du sort selon le Manuel :
 * 50 % de base, +5 %/niveau supérieur, -2 %/niveau inférieur, automatique sur ses propres sorts.
 * Compatible Foundry V13/V14/V15 — fenêtres et cartes via les API ADD2E communes.
 */

const ADD2E_DISPEL_MAGIC_VERSION = "2026-08-12-canonical-dispel-magic-runtime-v1";

function add2eDispelMagicEmitGM(operation, payload) {
  if (!game.socket) return false;
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
  });
  return true;
}

return await (async () => {
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[″”]/g, "\"")
    .replace(/\s+/g, " ");

  const sourceItem = (typeof sort !== "undefined" && sort?.type === "sort")
    ? sort
    : ((typeof item !== "undefined" && item?.type === "sort")
      ? item
      : ((typeof spell !== "undefined" && spell?.type === "sort")
        ? spell
        : ((typeof args !== "undefined" && args?.[0]?.item?.type === "sort") ? args[0].item : null)));

  if (!sourceItem) {
    ui.notifications.error("Dissipation de la magie : Item sort canonique introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Dissipation de la magie : lanceur introuvable.");
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
    ui.notifications.error(`Dissipation de la magie : API ADD2E indisponible (${missing.join(", ")}).`);
    return false;
  }

  const spellLevel = Number(sourceItem.system?.niveau);
  if (!Number.isInteger(spellLevel) || spellLevel < 1) {
    ui.notifications.error("Dissipation de la magie : system.niveau canonique invalide.");
    return false;
  }

  const lists = globalThis.add2eGetSpellListsFromItem(sourceItem)
    .map(value => globalThis.add2eNormalizeSpellKey(value))
    .filter(Boolean);
  const supportedLists = [...new Set(lists.filter(value => ["clerc", "magicien", "druide"].includes(value)))];
  if (supportedLists.length !== 1) {
    ui.notifications.error("Dissipation de la magie : exactement une liste Clerc, Magicien ou Druide est requise.");
    return false;
  }
  const listKey = supportedLists[0];
  const listLabel = listKey === "clerc" ? "Clerc" : listKey === "druide" ? "Druide" : "Magicien";

  let casterLevel = 0;
  if (sourceItem.system?.isObjectPower === true) {
    casterLevel = Number(sourceItem.system?.casterLevel);
    if (!Number.isInteger(casterLevel) || casterLevel < 1) {
      ui.notifications.error("Dissipation de la magie : casterLevel canonique absent du pouvoir d'objet magique.");
      return false;
    }
  } else {
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    if (access?.ok !== true) {
      ui.notifications.error(`Dissipation de la magie : accès canonique refusé (${access?.reason ?? "raison inconnue"}).`);
      return false;
    }
    const resolvedList = globalThis.add2eNormalizeSpellKey(access.entry?.key);
    if (resolvedList !== listKey) {
      ui.notifications.error(`Dissipation de la magie : liste résolue incohérente (${resolvedList || "vide"}).`);
      return false;
    }
    casterLevel = Number(access.actorLevel);
    if (!Number.isInteger(casterLevel) || casterLevel < 1) {
      ui.notifications.error("Dissipation de la magie : niveau canonique du lanceur invalide.");
      return false;
    }
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  if (!casterToken || !canvas.scene) {
    ui.notifications.warn("Dissipation de la magie : le lanceur doit être présent sur une scène active.");
    return false;
  }

  const environment = await globalThis.add2eDialogWait({
    add2eTheme: listKey === "druide" ? "druid" : (listKey === "clerc" ? "parchment" : "wizard"),
    add2ePrimaryAction: "interieur",
    add2eClasses: ["add2e-dissipation-context"],
    window: { title: "Dissipation de la magie" },
    content: `<form><p>Choisissez le contexte utilisé pour convertir la portée du sort.</p><p>La taille du cube ne change pas entre intérieur et extérieur.</p></form>`,
    buttons: [
      { action: "interieur", label: "Intérieur", icon: "<i class='fas fa-building'></i>", default: true, callback: () => "interieur" },
      { action: "exterieur", label: "Extérieur", icon: "<i class='fas fa-tree'></i>", callback: () => "exterieur" },
      { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
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
    throw new Error(`Dissipation de la magie : ${field} canonique invalide.`);
  };

  const parseRangeInches = value => {
    const text = canonicalText(value, "system.portee");
    const raw = normalize(text);
    let match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(?:\"|pouces?)$/);
    if (match) return Number(match[1].replace(",", "."));
    match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(?:\"|pouces?)\s*\/\s*niveau$/);
    if (match) return Number(match[1].replace(",", ".")) * casterLevel;
    throw new Error(`Dissipation de la magie : portée canonique non supportée (${text}).`);
  };

  const parseCubeInches = value => {
    const text = canonicalText(value, "system.zone_effet");
    const raw = normalize(text);
    const match = raw.match(/^cube de (\d+(?:[.,]\d+)?)\s*(?:\"|pouces?) d[' ]?arete$/);
    if (!match) throw new Error(`Dissipation de la magie : zone_effet canonique non supportée (${text}).`);
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
    if (!(factor > 0)) throw new Error(`Dissipation de la magie : unité de scène non supportée (${scene?.grid?.units || "vide"}).`);
    return factor;
  };

  const sceneDistance = meters => {
    const gridDistance = Number(canvas.scene?.grid?.distance);
    const gridSize = Number(canvas.scene?.grid?.size);
    if (!(gridDistance > 0) || !(gridSize > 0)) throw new Error("Dissipation de la magie : grille Foundry invalide.");
    const sceneUnits = Number(meters) / sceneMetersPerUnit(canvas.scene);
    return { units: sceneUnits, pixels: (sceneUnits / gridDistance) * gridSize };
  };

  let rangeRule;
  let cubeRule;
  let rangePixels;
  let cubePixels;
  try {
    const rangeInches = parseRangeInches(sourceItem.system?.portee);
    const cubeInches = parseCubeInches(sourceItem.system?.zone_effet);
    rangeRule = globalThis.add2eResolveSpellDistance(rangeInches, { environment, kind: "range" });
    cubeRule = globalThis.add2eResolveSpellDistance(cubeInches, { environment, kind: "area" });
    rangePixels = sceneDistance(rangeRule.meters).pixels;
    cubePixels = sceneDistance(cubeRule.meters).pixels;
  } catch (error) {
    console.error("[ADD2E][DISPEL_MAGIC][RULES]", {
      item: sourceItem.name,
      portee: sourceItem.system?.portee,
      zone_effet: sourceItem.system?.zone_effet,
      environment,
      error
    });
    ui.notifications.error(error.message);
    return false;
  }

  const selectedTargets = Array.from(game.user.targets ?? []).filter(entry => !!entry?.actor);
  const destinationMode = await globalThis.add2eDialogWait({
    add2eTheme: listKey === "druide" ? "druid" : (listKey === "clerc" ? "parchment" : "wizard"),
    add2ePrimaryAction: selectedTargets.length === 1 ? "target" : "point",
    add2eClasses: ["add2e-dissipation-destination"],
    window: { title: "Dissipation de la magie — centre du cube" },
    content: `<form><p>Choisissez le centre du cube de dissipation.</p><p>${selectedTargets.length === 1 ? `Cible actuelle : <b>${escapeHtml(selectedTargets[0].name ?? selectedTargets[0].actor?.name)}</b>.` : selectedTargets.length > 1 ? `${selectedTargets.length} cibles sont sélectionnées : gardez-en une pour centrer directement sur elle.` : "Aucune cible unique n'est sélectionnée."}</p></form>`,
    buttons: [
      ...(selectedTargets.length === 1 ? [{ action: "target", label: "Cible actuelle", icon: "<i class='fas fa-crosshairs'></i>", default: true, callback: () => "target" }] : []),
      { action: "point", label: "Point sur la scène", icon: "<i class='fas fa-location-dot'></i>", default: selectedTargets.length !== 1, callback: () => "point" },
      { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
    ],
    close: () => null
  });
  if (!destinationMode) return false;

  const chooseCanvasPoint = () => {
    ui.notifications.info("Dissipation de la magie : clique sur la scène pour placer le centre du cube. Échap ou clic droit annule.");
    return new Promise(resolve => {
      const stage = canvas.stage;
      if (!stage?.on || !stage?.off) {
        ui.notifications.error("Dissipation de la magie : sélection de point indisponible sur cette scène.");
        resolve(null);
        return;
      }
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true;
        stage.off("pointerdown", onPointerDown);
        window.removeEventListener("keydown", onKeyDown, true);
        resolve(value);
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
        if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) return finish(null);
        finish({ x: Number(point.x), y: Number(point.y) });
      };
      stage.on("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown, true);
    });
  };

  const center = destinationMode === "target"
    ? { x: Number(selectedTargets[0].center?.x), y: Number(selectedTargets[0].center?.y) }
    : await chooseCanvasPoint();
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return false;

  const distanceFromCaster = Math.hypot(
    center.x - Number(casterToken.center?.x ?? 0),
    center.y - Number(casterToken.center?.y ?? 0)
  );
  if (distanceFromCaster > rangePixels + 0.1) {
    ui.notifications.warn(`Dissipation de la magie : centre hors de portée (${rangeRule.inches}\").`);
    return false;
  }

  try {
    if (canvas.walls?.checkCollision && typeof Ray !== "undefined"
      && canvas.walls.checkCollision(new Ray(casterToken.center, center), { type: "sight", mode: "any" }) === true) {
      ui.notifications.warn("Dissipation de la magie : un obstacle bloque la ligne d'effet.");
      return false;
    }
  } catch (_error) {}

  const halfCube = cubePixels / 2;
  const pointInsideCube = point => {
    const x = Number(point?.x);
    const y = Number(point?.y);
    return Number.isFinite(x) && Number.isFinite(y)
      && Math.abs(x - center.x) <= halfCube + 0.1
      && Math.abs(y - center.y) <= halfCube + 0.1;
  };

  const tokenInsideCube = tokenPlaceable => pointInsideCube(tokenPlaceable?.center);

  const effectTags = effect => {
    const tags = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
    const list = Array.isArray(tags) ? tags : String(tags ?? "").split(/[,;|]/);
    return list.map(value => normalize(value)).filter(Boolean);
  };

  const isDissipableSpellEffect = effect => {
    if (!effect || effect.disabled === true) return false;
    const flags = effect.flags?.add2e ?? {};
    const tags = effectTags(effect);
    if (tags.some(tag => tag === "indissipable" || tag === "dissipation:impossible")) return false;
    if (tags.some(tag => tag.startsWith("sort:") || tag === "magique" || tag === "effet:magique" || tag === "dissipable:magie")) return true;
    if (flags.spellKey || flags.sourceItemUuid || flags.casterLevel || flags.casterUuid) return true;
    return false;
  };

  const effectAnchorInside = effect => {
    const payload = effect?.flags?.add2e?.lightPayload ?? null;
    if (!payload) return false;
    const payloadScene = String(payload.sceneId ?? "");
    if (payloadScene && payloadScene !== String(canvas.scene.id)) return false;
    if (payload.type === "ambient") return pointInsideCube(payload);
    if (payload.type === "token" && payload.tokenId) {
      const tokenPlaceable = canvas.tokens?.get?.(payload.tokenId)
        ?? canvas.tokens?.placeables?.find(entry => entry?.id === payload.tokenId || entry?.document?.id === payload.tokenId)
        ?? null;
      return tokenInsideCube(tokenPlaceable);
    }
    return false;
  };

  const candidates = new Map();
  const addCandidate = (ownerActor, effect, anchor = "actor") => {
    if (!ownerActor || !isDissipableSpellEffect(effect)) return;
    const key = `${ownerActor.uuid ?? ownerActor.id}:${effect.id}`;
    if (!candidates.has(key)) candidates.set(key, { actor: ownerActor, effect, anchor });
  };

  for (const tokenPlaceable of canvas.tokens?.placeables ?? []) {
    if (!tokenInsideCube(tokenPlaceable) || !tokenPlaceable?.actor) continue;
    for (const effect of tokenPlaceable.actor.effects ?? []) addCandidate(tokenPlaceable.actor, effect, "token");
  }

  const actorsToScan = new Map();
  for (const actorDoc of game.actors ?? []) actorsToScan.set(actorDoc.uuid ?? actorDoc.id, actorDoc);
  for (const tokenPlaceable of canvas.tokens?.placeables ?? []) {
    if (tokenPlaceable?.actor) actorsToScan.set(tokenPlaceable.actor.uuid ?? tokenPlaceable.actor.id, tokenPlaceable.actor);
  }
  for (const actorDoc of actorsToScan.values()) {
    for (const effect of actorDoc.effects ?? []) {
      if (effectAnchorInside(effect)) addCandidate(actorDoc, effect, "spatial-effect");
    }
  }

  const resolveOriginDocument = async effect => {
    const flags = effect?.flags?.add2e ?? {};
    for (const uuid of [flags.sourceItemUuid, effect?.origin]) {
      if (!uuid || typeof fromUuid !== "function") continue;
      try {
        const doc = await fromUuid(uuid);
        if (doc) return doc;
      } catch (_error) {}
    }
    return null;
  };

  const resolveEffectLevel = async candidate => {
    const { actor: ownerActor, effect } = candidate;
    const flags = effect.flags?.add2e ?? {};
    const direct = [flags.casterLevel, flags.sourceCasterLevel, flags.niveauLanceur, flags.caster_level]
      .map(Number).find(value => Number.isInteger(value) && value > 0);
    if (direct) return { level: direct, own: String(flags.casterUuid ?? "") === String(caster.uuid ?? "") || String(flags.casterId ?? "") === String(caster.id ?? ""), origin: null };

    const originDoc = await resolveOriginDocument(effect);
    const originActor = originDoc?.actor ?? originDoc?.parent?.actor ?? (originDoc?.parent?.documentName === "Actor" ? originDoc.parent : null);
    const own = String(originActor?.id ?? "") === String(caster.id ?? "")
      || String(flags.casterUuid ?? "") === String(caster.uuid ?? "")
      || String(flags.casterId ?? "") === String(caster.id ?? "");
    if (own) return { level: casterLevel, own: true, origin: originDoc };

    if (originDoc?.type === "sort" && originActor) {
      try {
        const access = globalThis.add2eCanActorUseSpell(originActor, originDoc);
        const level = Number(access?.actorLevel);
        if (access?.ok === true && Number.isInteger(level) && level > 0) return { level, own: false, origin: originDoc };
      } catch (_error) {}
    }

    const tagged = effectTags(effect)
      .map(tag => tag.match(/^(?:niveau_lanceur|caster_level|niveau:acteur):(\d+)$/)?.[1])
      .filter(Boolean)
      .map(Number)
      .find(value => Number.isInteger(value) && value > 0);
    if (tagged) return { level: tagged, own: false, origin: originDoc };

    return { level: null, own: false, origin: originDoc, ownerActor };
  };

  const resolvedCandidates = [];
  for (const candidate of candidates.values()) {
    const resolved = await resolveEffectLevel(candidate);
    resolvedCandidates.push({ ...candidate, ...resolved });
  }

  const unresolved = resolvedCandidates.filter(entry => !entry.own && !Number.isInteger(entry.level));
  let manualLevels = {};
  if (unresolved.length) {
    const rows = unresolved.map((entry, index) => `
      <div class="form-group">
        <label>${escapeHtml(entry.effect.name ?? "Effet")} — ${escapeHtml(entry.actor.name ?? "Acteur")}</label>
        <input type="number" min="1" step="1" name="level-${index}" placeholder="niveau du créateur" />
      </div>`).join("");
    const values = await globalThis.add2eDialogWait({
      add2eTheme: "parchment",
      add2ePrimaryAction: "resolve",
      add2eClasses: ["add2e-dissipation-levels"],
      window: { title: "Dissipation — niveaux manquants" },
      content: `<form><p>Certains anciens effets ne portent pas encore le niveau de leur créateur. Renseignez uniquement les niveaux connus ; un champ vide laisse l'effet intact.</p>${rows}</form>`,
      buttons: [
        {
          action: "resolve",
          label: "Résoudre",
          icon: "<i class='fas fa-wand-magic-sparkles'></i>",
          default: true,
          callback: (_event, button) => {
            const form = button.form;
            const result = {};
            unresolved.forEach((_entry, index) => {
              const raw = form?.elements?.[`level-${index}`]?.value;
              const level = Number(raw);
              if (Number.isInteger(level) && level > 0) result[index] = level;
            });
            return result;
          }
        },
        { action: "cancel", label: "Annuler", icon: "<i class='fas fa-times'></i>", callback: () => null }
      ],
      close: () => null
    });
    if (values === null) return false;
    manualLevels = values ?? {};
    unresolved.forEach((entry, index) => {
      const level = Number(manualLevels[index]);
      if (Number.isInteger(level) && level > 0) entry.level = level;
    });
  }

  const cleanLinkedLight = async entry => {
    const payload = entry.effect?.flags?.add2e?.lightPayload ?? null;
    if (!payload) return;
    const scene = game.scenes?.get(payload.sceneId) ?? canvas.scene;
    if (!scene) return;

    if (payload.type === "ambient") {
      const light = payload.lightId ? scene.lights?.get?.(payload.lightId) ?? null : null;
      if (game.user.isGM) {
        if (light) await light.delete();
      } else {
        add2eDispelMagicEmitGM("deleteAmbientLight", {
          sceneId: scene.id,
          lightId: light?.id ?? payload.lightId ?? null,
          requestId: payload.requestId ?? null,
          actorId: payload.actorId ?? entry.actor.id,
          actorUuid: payload.actorUuid ?? entry.actor.uuid,
          spellKey: payload.spellKey ?? entry.effect?.flags?.add2e?.spellKey ?? null,
          x: payload.x ?? null,
          y: payload.y ?? null
        });
      }
      return;
    }

    if (payload.type === "token" && payload.tokenId) {
      const tokenDoc = scene.tokens?.get?.(payload.tokenId) ?? null;
      if (!tokenDoc) return;
      const originalLight = payload.originalLight && typeof payload.originalLight === "object"
        ? foundry.utils.deepClone(payload.originalLight)
        : {};
      if (game.user.isGM || tokenDoc.isOwner) await tokenDoc.update({ light: originalLight });
      else add2eDispelMagicEmitGM("updateToken", { sceneId: scene.id, tokenId: tokenDoc.id, updateData: { light: originalLight } });
    }
  };

  const deleteEffect = async entry => {
    await cleanLinkedLight(entry);
    if (game.user.isGM || entry.actor.isOwner) {
      await entry.effect.delete();
      return true;
    }
    return add2eDispelMagicEmitGM("deleteActiveEffects", {
      actorUuid: entry.actor.uuid,
      actorId: entry.actor.id,
      effectIds: [entry.effect.id]
    });
  };

  const results = [];
  const rolls = [];
  for (const entry of resolvedCandidates) {
    if (!entry.own && !Number.isInteger(entry.level)) {
      results.push({
        name: entry.effect.name ?? "Effet magique",
        actorName: entry.actor.name ?? "Acteur",
        level: null,
        chance: null,
        roll: null,
        success: false,
        unresolved: true,
        automatic: false
      });
      continue;
    }

    const effectLevel = entry.own ? casterLevel : entry.level;
    const difference = casterLevel - effectLevel;
    const rawChance = entry.own ? 100 : 50 + (difference > 0 ? difference * 5 : difference < 0 ? difference * 2 : 0);
    const chance = Math.max(0, Math.min(100, rawChance));
    let roll = null;
    let total = null;
    let success = entry.own;
    if (!entry.own) {
      roll = await new Roll("1d100").evaluate();
      rolls.push(roll);
      total = Number(roll.total);
      success = total <= chance;
    }
    if (success) await deleteEffect(entry);
    results.push({
      name: entry.effect.name ?? "Effet magique",
      actorName: entry.actor.name ?? "Acteur",
      level: effectLevel,
      chance,
      roll: total,
      success,
      unresolved: false,
      automatic: entry.own
    });
  }

  const successes = results.filter(result => result.success).length;
  const failures = results.filter(result => !result.success && !result.unresolved).length;
  const unresolvedCount = results.filter(result => result.unresolved).length;
  const resultRows = results.length
    ? `<ul>${results.map(result => {
        if (result.unresolved) return `<li><b>${escapeHtml(result.name)}</b> — ${escapeHtml(result.actorName)} : niveau du créateur inconnu, effet conservé.</li>`;
        if (result.automatic) return `<li><b>${escapeHtml(result.name)}</b> — ${escapeHtml(result.actorName)} : propre sort, dissipation automatique.</li>`;
        return `<li><b>${escapeHtml(result.name)}</b> — ${escapeHtml(result.actorName)} : d100 ${result.roll} / ${result.chance}% (niveau ${result.level}) — <b>${result.success ? "dissipé" : "résiste"}</b>.</li>`;
      }).join("")}</ul>`
    : "<p>Aucun effet magique actif identifiable dans le cube.</p>";

  const card = {
    actor: caster,
    title: "Dissipation de la magie",
    icon: "fas fa-wand-magic-sparkles",
    variant: "spell",
    source: { name: caster.name, img: sourceItem.img ?? caster.img, type: `${listLabel} niveau ${casterLevel}` },
    rows: [
      { label: "Liste", value: `${listLabel} — niveau de lanceur ${casterLevel}` },
      { label: "Contexte", value: environment === "exterieur" ? "Extérieur" : "Intérieur" },
      { label: "Portée", value: `${rangeRule.inches}\" = ${rangeRule.meters} m` },
      { label: "Zone", value: `cube de ${cubeRule.inches}\" d'arête = ${cubeRule.meters} m` },
      { label: "Effets examinés", value: String(results.length) },
      { label: "Dissipés", value: String(successes) },
      { label: "Résistants", value: String(failures) },
      ...(unresolvedCount ? [{ label: "Non résolus", value: String(unresolvedCount) }] : [])
    ],
    message: `${caster.name} lance Dissipation de la magie.`,
    trustedBodyHtml: `<div class="add2e-dissipation-results">${resultRows}<p>Chance : 50 % de base, +5 % par niveau du lanceur au-dessus du créateur, -2 % par niveau en dessous. Les propres sorts du lanceur sont annulés automatiquement.</p></div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls,
      flags: { add2e: {
        chatCardType: "dissipation-de-la-magie",
        version: ADD2E_DISPEL_MAGIC_VERSION,
        sourceItemUuid: sourceItem.uuid ?? null,
        listKey,
        casterLevel,
        spellLevel,
        environment,
        rangeInches: rangeRule.inches,
        rangeMeters: rangeRule.meters,
        cubeInches: cubeRule.inches,
        cubeMeters: cubeRule.meters,
        sceneId: canvas.scene.id,
        center,
        successes,
        failures,
        unresolved: unresolvedCount
      } }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Dissipation de la magie : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(card);
  try { await globalThis.ADD2E_PLAY_SPELL_FX?.("dissipation_de_la_magie", { casterToken, targetToken: selectedTargets[0] ?? null }); } catch (_error) {}
  return true;
})();