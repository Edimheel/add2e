// ADD2E — onUse Magicien : Amitié
// Compatible Foundry V13/V14/V15.
// La zone est exprimée dans l'unité tactique AD&D du manuel, jamais en cases.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][AMITIE]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : null;
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];

const ADD2E_SORT_CONFIG = Object.freeze({
  name: "Amitié",
  slug: "amitie",
  level: 1,
  school: "Enchantement/Charme",
  rangeText: "0",
  durationText: "1 round par niveau",
  castingTimeText: "1 segment",
  saveText: "Spécial",
  areaText: "sphère d’un rayon de 1\" + 1\" par niveau",
  areaUnit: "adnd-inch",
  areaUsage: "area",
  materialText: "craie ou farine blanche, noir de fumée ou suie, vermillon",
  img: "systems/add2e/assets/icones/sorts/magicien-amitie.webp",
  imgFallback: "icons/magic/control/hypnosis-mesmerism-eye.webp"
});

function add2eClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eRandomId() {
  return foundry?.utils?.randomID?.(16)
    ?? globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 16)
    ?? `amitie_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellImg() {
  const img = ADD2E_ITEM?.img || "";
  if (img && !String(img).includes("magicien-amitie.webp")) return img;
  return ADD2E_SORT_CONFIG.imgFallback;
}

function add2eReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eReadNumber(value.value, value.valeur, value.total, value.current, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const match = String(value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    if (!match) continue;
    const number = Number(match[0]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function add2eCasterLevel(actorDoc) {
  const classItem = Array.from(actorDoc?.items ?? []).find(entry => {
    if (!/(classe|class)/.test(add2eNormalize(entry?.type))) return false;
    const label = add2eNormalize(entry?.name ?? entry?.system?.nom);
    return label === "magicien" || label.includes("magicien");
  }) ?? null;

  const classLevel = add2eReadNumber(
    classItem?.system?.niveau,
    classItem?.system?.level,
    classItem?.system?.details?.niveau,
    classItem?.system?.details?.level
  );
  if (Number.isFinite(classLevel) && classLevel > 0) return Math.floor(classLevel);

  const actorLevel = add2eReadNumber(
    actorDoc?.system?.niveau,
    actorDoc?.system?.level,
    actorDoc?.system?.details?.niveau,
    actorDoc?.system?.details?.level
  );
  return Math.max(1, Math.floor(actorLevel || 1));
}

function add2eGetCasterToken(actorDoc) {
  return ADD2E_TOKEN
    ?? ADD2E_ARGS?.[0]?.token
    ?? canvas?.tokens?.controlled?.find(tokenDoc => tokenDoc.actor?.id === actorDoc?.id)
    ?? actorDoc?.getActiveTokens?.()?.[0]
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eAreaRadiusInches(level) {
  // Manuel : 1" + 1" par niveau. Ici " est l'unité tactique AD&D.
  return 1 + Math.max(1, Math.floor(Number(level) || 1));
}

function add2eFallbackSceneArea(level) {
  const sourceDistance = add2eAreaRadiusInches(level);
  const sourceMeters = sourceDistance * 3;
  const scene = canvas?.scene ?? null;
  const unit = String(scene?.grid?.units ?? scene?.grid?.unit ?? "ft").trim().toLowerCase();
  const metric = /^(m|metre|metres|meter|meters)$/.test(unit);
  const sceneUnit = metric ? "m" : "ft";
  const sceneDistance = metric ? sourceMeters : sourceMeters / 0.3048;
  const gridDistance = Math.max(0.000001, Number(scene?.grid?.distance) || 1);
  const gridSize = Math.max(1, Number(scene?.grid?.size ?? canvas?.grid?.size) || 100);
  const gridCells = sceneDistance / gridDistance;

  return {
    sourceDistance,
    sourceUnit: "adnd-inch",
    sourceLabel: `${sourceDistance}\"`,
    sourceMeters,
    tactical: { usage: "area", environment: "interior", metersPerInch: 3 },
    sceneDistance,
    sceneUnit,
    sceneLabel: `${Math.round(sceneDistance * 1000) / 1000} ${sceneUnit}`,
    gridDistance,
    gridSize,
    gridCells,
    pixels: gridCells * gridSize
  };
}

function add2eSceneArea(level) {
  const generic = globalThis.add2eSceneDistance;
  if (typeof generic === "function") {
    const area = generic({
      scene: canvas?.scene ?? null,
      distance: add2eAreaRadiusInches(level),
      unit: ADD2E_SORT_CONFIG.areaUnit,
      usage: ADD2E_SORT_CONFIG.areaUsage
    });
    if (Number.isFinite(Number(area?.sceneDistance)) && Number.isFinite(Number(area?.pixels))) return area;
  }
  return add2eFallbackSceneArea(level);
}

function add2eDisplayNumber(value, decimals = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return String(Math.round(number * (10 ** decimals)) / (10 ** decimals)).replace(".", ",");
}

function add2eAreaRadiusText(level) {
  const area = add2eSceneArea(level);
  return `${add2eAreaRadiusInches(level)}\" AD&D (${add2eDisplayNumber(area.sceneDistance)} ${area.sceneUnit} ; ${add2eDisplayNumber(area.gridCells, 2)} case${Math.abs(area.gridCells - 1) < 0.001 ? "" : "s"})`;
}

function add2eEffectDuration(level) {
  const rounds = Math.max(1, Math.floor(Number(level) || 1));
  return {
    rounds,
    startRound: game.combat?.round ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

function add2eTokenCenter(tokenDocOrPlaceable) {
  const placeable = tokenDocOrPlaceable?.object ?? tokenDocOrPlaceable;
  if (placeable?.center) return { x: Number(placeable.center.x), y: Number(placeable.center.y) };

  const doc = tokenDocOrPlaceable?.document ?? tokenDocOrPlaceable;
  const gridSize = Number(canvas?.scene?.grid?.size ?? canvas?.grid?.size) || 100;
  return {
    x: Number(doc?.x ?? 0) + (Math.max(1, Number(doc?.width) || 1) * gridSize) / 2,
    y: Number(doc?.y ?? 0) + (Math.max(1, Number(doc?.height) || 1) * gridSize) / 2
  };
}

function add2eCanvasEventPosition(event) {
  try {
    const point = event?.data?.getLocalPosition?.(canvas.stage)
      ?? event?.getLocalPosition?.(canvas.stage)
      ?? null;
    if (point) return { x: Number(point.x), y: Number(point.y) };
  } catch (_error) {}

  const original = event?.data?.originalEvent ?? event?.nativeEvent ?? event;
  const rect = canvas?.app?.view?.getBoundingClientRect?.();
  if (!original || !rect) return null;
  return {
    x: ((original.clientX - rect.left) / rect.width) * canvas.dimensions.width,
    y: ((original.clientY - rect.top) / rect.height) * canvas.dimensions.height
  };
}

function add2eBuildTemplateData(center, level, templateRequestId) {
  const area = add2eSceneArea(level);
  return {
    t: "circle",
    user: game.user.id,
    x: Number(center.x),
    y: Number(center.y),
    // La valeur est exprimée dans l'unité choisie pour la scène Foundry.
    distance: area.sceneDistance,
    direction: 0,
    fillColor: "#b36bff",
    borderColor: "#fff2a8",
    flags: {
      add2e: {
        spell: ADD2E_SORT_CONFIG.slug,
        spellName: ADD2E_SORT_CONFIG.name,
        templateRequestId,
        areaRadiusInches: add2eAreaRadiusInches(level),
        areaUnit: ADD2E_SORT_CONFIG.areaUnit,
        areaUsage: ADD2E_SORT_CONFIG.areaUsage,
        areaRadiusMeters: area.sourceMeters,
        areaRadiusSceneDistance: area.sceneDistance,
        areaRadiusSceneUnit: area.sceneUnit,
        areaRadiusGridCells: area.gridCells,
        casterId: ADD2E_ACTOR?.id ?? null,
        casterUuid: ADD2E_ACTOR?.uuid ?? null,
        sourceItemId: ADD2E_ITEM?.id ?? null,
        sourceItemUuid: ADD2E_ITEM?.uuid ?? null
      }
    }
  };
}

async function add2eCreateNativePreviewTemplate(initialCenter, level, templateRequestId) {
  const TemplateDocument = CONFIG?.MeasuredTemplate?.documentClass;
  const TemplateObject = CONFIG?.MeasuredTemplate?.objectClass;
  if (!TemplateDocument || !TemplateObject || !canvas?.templates) return null;

  const document = new TemplateDocument(add2eBuildTemplateData(initialCenter, level, templateRequestId), { parent: canvas.scene });
  const template = new TemplateObject(document);
  const layer = canvas.templates.preview ?? canvas.templates;
  await template.draw();
  layer.addChild(template);
  template.refresh?.();
  return template;
}

function add2eEmitGmOperation(operation, payload) {
  game.socket?.emit?.("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload
  });
}

async function add2eTryCreateSceneTemplate(templateData, previewTemplate, templateRequestId) {
  if (!canvas?.scene?.createEmbeddedDocuments) return { persisted: false, templateId: null, via: "none" };
  try {
    const created = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [add2eClone(templateData)]);
    previewTemplate?.destroy?.({ children: true });
    return { persisted: true, templateId: created?.[0]?.id ?? null, via: "direct" };
  } catch (error) {
    console.warn(`${ADD2E_ONUSE_TAG}[TEMPLATE_CREATE_DENIED] Création du gabarit relayée au MJ.`, error);
    add2eEmitGmOperation("createMeasuredTemplate", {
      sceneId: canvas?.scene?.id ?? null,
      templateData,
      templateRequestId,
      spell: ADD2E_SORT_CONFIG.slug,
      spellName: ADD2E_SORT_CONFIG.name
    });
    setTimeout(() => previewTemplate?.destroy?.({ children: true }), 1500);
    return { persisted: true, templateId: null, via: "gm-relay" };
  }
}

async function add2eDeleteLinkedTemplate(zone, reason = "cleanup") {
  if (!zone?.templateRequestId) return false;
  const payload = {
    sceneId: zone.sceneId ?? canvas?.scene?.id ?? null,
    templateId: zone.templateId ?? null,
    templateRequestId: zone.templateRequestId,
    spell: ADD2E_SORT_CONFIG.slug,
    reason
  };

  if (game.user?.isGM && canvas?.scene?.deleteEmbeddedDocuments) {
    const ids = Array.from(canvas.scene.templates ?? [])
      .filter(template => template.id === payload.templateId || template.flags?.add2e?.templateRequestId === payload.templateRequestId)
      .map(template => template.id)
      .filter(Boolean);
    if (ids.length) {
      await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
      return true;
    }
  }

  add2eEmitGmOperation("deleteMeasuredTemplates", payload);
  return true;
}

async function add2eChooseNativeTemplateZone(level, casterToken, templateRequestId) {
  if (!canvas?.ready || !canvas?.stage || !canvas?.templates) {
    ui.notifications?.warn?.("Amitié : scène ou canevas indisponible.");
    return null;
  }

  const casterCenter = casterToken ? add2eTokenCenter(casterToken) : { x: canvas.dimensions.width / 2, y: canvas.dimensions.height / 2 };
  const previewTemplate = await add2eCreateNativePreviewTemplate(casterCenter, level, templateRequestId);
  const view = canvas.app?.view;
  const previousCursor = view?.style?.cursor ?? "";
  if (view?.style) view.style.cursor = "crosshair";
  canvas.templates.activate?.();
  ui.notifications?.info?.("Amitié : cliquez sur la scène pour placer la zone, clic droit pour annuler.");

  return new Promise(resolve => {
    let done = false;
    let current = { ...casterCenter };
    const cleanup = () => {
      canvas.stage.off("mousemove", onMove);
      canvas.stage.off("mousedown", onConfirm);
      canvas.stage.off("rightdown", onCancel);
      if (view?.style) view.style.cursor = previousCursor;
    };
    const finish = async value => {
      if (done) return;
      done = true;
      cleanup();
      if (!value) {
        try { previewTemplate?.destroy?.({ children: true }); } catch (_error) {}
        resolve(null);
        return;
      }
      const templateData = add2eBuildTemplateData(value, level, templateRequestId);
      const creation = await add2eTryCreateSceneTemplate(templateData, previewTemplate, templateRequestId);
      resolve({
        x: value.x,
        y: value.y,
        templateData,
        templateRequestId,
        sceneId: canvas?.scene?.id ?? null,
        persisted: creation.persisted,
        templateId: creation.templateId,
        templateVia: creation.via
      });
    };
    const refresh = position => {
      if (!position) return;
      current = { x: Number(position.x), y: Number(position.y) };
      previewTemplate?.document?.updateSource?.({ x: current.x, y: current.y });
      previewTemplate?.refresh?.();
    };
    const onMove = event => {
      event?.stopPropagation?.();
      refresh(add2eCanvasEventPosition(event));
    };
    const onConfirm = event => {
      event?.stopPropagation?.();
      event?.data?.originalEvent?.preventDefault?.();
      refresh(add2eCanvasEventPosition(event) ?? current);
      finish(current);
    };
    const onCancel = event => {
      event?.stopPropagation?.();
      event?.data?.originalEvent?.preventDefault?.();
      finish(null);
    };

    canvas.stage.on("mousemove", onMove);
    canvas.stage.once("mousedown", onConfirm);
    canvas.stage.once("rightdown", onCancel);
    refresh(casterCenter);
  });
}

function add2eTokensInZone(center, level, casterToken) {
  const radiusPixels = add2eSceneArea(level).pixels;
  const casterId = casterToken?.id ?? casterToken?.document?.id ?? null;
  return (canvas?.tokens?.placeables ?? [])
    .filter(target => target?.actor && target.id !== casterId)
    .filter(target => {
      const targetCenter = add2eTokenCenter(target);
      return Math.hypot(targetCenter.x - center.x, targetCenter.y - center.y) <= radiusPixels;
    });
}

function add2eReadSaveVsSpells(actorDoc) {
  const system = actorDoc?.system ?? {};
  const direct = add2eReadNumber(
    system.sauvegarde_sortileges,
    system.sauvegarde_sortilege,
    system.saveSorts,
    system.saveSpells,
    system.saves?.sorts,
    system.saves?.spells,
    system.savingThrows?.sorts,
    system.savingThrows?.spells,
    system.sauvegardes?.sorts,
    system.sauvegardes?.sortileges
  );
  if (Number.isFinite(direct)) return direct;

  for (const collection of [system.sauvegardes, system.savingThrows]) {
    if (!Array.isArray(collection)) continue;
    const named = collection.find(entry => /sort|spell/i.test(String(entry?.type ?? entry?.key ?? entry?.name ?? entry?.label ?? entry?.nom ?? "")));
    const namedValue = add2eReadNumber(named?.value, named?.valeur, named?.total, named?.score);
    if (Number.isFinite(namedValue)) return namedValue;
    const values = collection.map(entry => add2eReadNumber(entry)).filter(Number.isFinite);
    if (values.length >= 5) return values[4];
    if (values.length) return values.at(-1);
  }

  for (const raw of [system.savingThrows, system.sauvegardes]) {
    if (typeof raw !== "string") continue;
    const labeled = raw.match(/(?:sortil[eè]ges?|sorts?|spells?)\D*(\d+)/i);
    if (labeled) return Number(labeled[1]);
    const values = raw.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
    if (values.length >= 5) return values[4];
    if (values.length) return values.at(-1);
  }
  return null;
}

function add2eSaveBonus(actorDoc) {
  try {
    const analyzed = globalThis.Add2eEffectsEngine?.analyze?.(actorDoc, {
      type: "save",
      vsType: "sort",
      spell: ADD2E_SORT_CONFIG.slug
    });
    return Number(analyzed?.bonus_save) || 0;
  } catch (_error) {
    return 0;
  }
}

function add2eIsAnimalIntelligenceOrLess(actorDoc) {
  const system = actorDoc?.system ?? {};
  const number = add2eReadNumber(system.intelligence, system.int, system.intel, system.mental?.intelligence);
  if (Number.isFinite(number)) return number <= 2;
  const text = String(system.intelligence ?? system.intelligenceText ?? system.intelligence_monstre ?? system.description ?? "").toLowerCase();
  return /animal|non.?intelligent|semi.?intelligent|faible/.test(text);
}

async function add2eRollTargetSave(actorDoc) {
  const saveTarget = add2eReadSaveVsSpells(actorDoc);
  const bonus = add2eSaveBonus(actorDoc);
  const roll = await new Roll("1d20").evaluate({ async: true });
  const total = Number(roll.total) + bonus;
  const hasSave = Number.isFinite(saveTarget);
  return { roll, saveTarget, bonus, total, hasSave, success: hasSave ? total >= saveTarget : null };
}

function add2eBuildTargetEffect({ targetToken, casterActor, choice, level, modifier, saveData, zone }) {
  const favorable = choice === "favorable";
  const signedModifier = favorable ? Math.abs(modifier) : -Math.abs(modifier);
  const area = add2eSceneArea(level);
  const casterSlug = String(casterActor?.id ?? "caster").replace(/[^a-zA-Z0-9_-]/g, "_");

  return {
    name: favorable ? "Amitié — impression favorable" : "Amitié — irritation",
    img: add2eSpellImg(),
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [{
      key: `flags.add2e.amitie.${casterSlug}.charismeApparent`,
      mode: CONST?.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5,
      value: String(signedModifier),
      priority: 20
    }],
    duration: add2eEffectDuration(level),
    description: favorable
      ? `${targetToken.name} est favorablement impressionné par ${casterActor?.name ?? "le magicien"}.`
      : `${targetToken.name} se montre irrité par la présence de ${casterActor?.name ?? "le magicien"}.`,
    flags: {
      add2e: {
        templateRequestId: zone?.templateRequestId ?? null,
        templateId: zone?.templateId ?? null,
        templateSceneId: zone?.sceneId ?? canvas?.scene?.id ?? null,
        tags: [
          "classe:magicien",
          "liste:magicien",
          "niveau:1",
          "sort:amitie",
          "ecole:enchantement_charme",
          "type:charme",
          "type:social",
          `caster:${casterActor?.id ?? ""}`,
          `caster_uuid:${casterActor?.uuid ?? ""}`,
          favorable ? "reaction:favorable" : "reaction:irritee",
          favorable ? `charisme_apparent_lanceur:+${Math.abs(modifier)}` : `charisme_apparent_lanceur:-${Math.abs(modifier)}`,
          "duree:1_round_par_niveau",
          `duree_rounds:${Math.max(1, level)}`,
          "jet_sauvegarde:special",
          `template_request:${zone?.templateRequestId ?? ""}`
        ],
        spell: {
          slug: ADD2E_SORT_CONFIG.slug,
          name: ADD2E_SORT_CONFIG.name,
          level: ADD2E_SORT_CONFIG.level,
          school: ADD2E_SORT_CONFIG.school,
          casterId: casterActor?.id ?? null,
          casterUuid: casterActor?.uuid ?? null,
          casterName: casterActor?.name ?? "",
          targetTokenId: targetToken?.id ?? null,
          targetActorUuid: targetToken?.actor?.uuid ?? null,
          reaction: favorable ? "favorable" : "irritated",
          charismaApparentModifier: signedModifier,
          saveRoll: saveData?.roll?.total ?? null,
          saveBonus: saveData?.bonus ?? 0,
          saveTotal: saveData?.total ?? null,
          saveTarget: saveData?.saveTarget ?? null,
          casterLevel: level,
          durationRounds: Math.max(1, level),
          areaRadiusInches: add2eAreaRadiusInches(level),
          areaUnit: ADD2E_SORT_CONFIG.areaUnit,
          areaUsage: ADD2E_SORT_CONFIG.areaUsage,
          areaRadiusMeters: area.sourceMeters,
          areaRadiusSceneDistance: area.sceneDistance,
          areaRadiusSceneUnit: area.sceneUnit,
          areaRadiusGridCells: area.gridCells,
          templateRequestId: zone?.templateRequestId ?? null,
          templateId: zone?.templateId ?? null,
          templateSceneId: zone?.sceneId ?? canvas?.scene?.id ?? null,
          sourceItemId: ADD2E_ITEM?.id ?? null,
          sourceItemUuid: ADD2E_ITEM?.uuid ?? null
        }
      }
    }
  };
}

async function add2eApplyEffectOnTarget(targetToken, effectData) {
  if (!targetToken?.actor || !effectData) return false;
  if (game.user?.isGM || targetToken.actor.isOwner) {
    try {
      await targetToken.actor.createEmbeddedDocuments("ActiveEffect", [add2eClone(effectData)]);
      return true;
    } catch (error) {
      console.warn(`${ADD2E_ONUSE_TAG}[DIRECT_EFFECT_FAILED] Passage par relais MJ.`, error);
    }
  }

  add2eEmitGmOperation("createActiveEffect", {
    actorUuid: targetToken.actor.uuid,
    actorId: targetToken.actor.id,
    sceneId: canvas?.scene?.id ?? null,
    tokenId: targetToken.document?.id ?? targetToken.id ?? null,
    effectData
  });
  return true;
}

async function add2eResolveAmitieTarget(targetToken, casterActor, level, zone) {
  if (!targetToken?.actor) return null;
  if (add2eIsAnimalIntelligenceOrLess(targetToken.actor)) {
    return { token: targetToken, actor: targetToken.actor, status: "ignored", label: "non affecté", modifier: 0, saveData: null, effectRequested: false };
  }

  const saveData = await add2eRollTargetSave(targetToken.actor);
  if (!saveData.hasSave) {
    return { token: targetToken, actor: targetToken.actor, status: "manual", label: "à résoudre par le MD", modifier: 0, saveData, effectRequested: false };
  }

  const successfulSave = saveData.success === true;
  const modifierRoll = await new Roll(successfulSave ? "1d4" : "2d4").evaluate({ async: true });
  const modifier = Math.abs(Number(modifierRoll.total) || 1);
  const effectData = add2eBuildTargetEffect({
    targetToken,
    casterActor,
    choice: successfulSave ? "irritated" : "favorable",
    level,
    modifier,
    saveData,
    zone
  });
  const effectRequested = await add2eApplyEffectOnTarget(targetToken, effectData);

  return successfulSave
    ? { token: targetToken, actor: targetToken.actor, status: "success", label: "résiste et s’irrite", modifier: -modifier, saveData, effectRequested }
    : { token: targetToken, actor: targetToken.actor, status: "failure", label: "favorable", modifier, saveData, effectRequested };
}

function add2eResultLine(result) {
  const name = add2eHtmlEscape(result?.token?.name ?? result?.actor?.name ?? "Créature");
  if (result.status === "ignored") return `<tr><td>${name}</td><td colspan="3">Non affecté</td></tr>`;
  if (result.status === "manual") {
    const rollText = result.saveData?.roll?.total ? `Jet ${result.saveData.roll.total}` : "Jet effectué";
    return `<tr><td>${name}</td><td>${add2eHtmlEscape(rollText)}</td><td>—</td><td>À résoudre</td></tr>`;
  }

  const total = Number(result.saveData?.total ?? result.saveData?.roll?.total ?? 0);
  const bonus = Number(result.saveData?.bonus ?? 0);
  const threshold = result.saveData?.saveTarget;
  const modifier = Number(result.modifier) || 0;
  const modifierText = modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `<tr><td>${name}</td><td>${add2eHtmlEscape(String(total))}${bonus ? ` <small>(${bonus > 0 ? "+" : ""}${bonus})</small>` : ""}</td><td>${add2eHtmlEscape(String(threshold))}</td><td>${add2eHtmlEscape(result.label)} <b>${add2eHtmlEscape(modifierText)}</b></td></tr>`;
}

async function add2eChatAmitie(actorDoc, level, results) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = add2eSpellImg();
  const durationRounds = Math.max(1, level);
  const radiusText = add2eAreaRadiusText(level);
  const tableRows = results.length
    ? results.map(add2eResultLine).join("\n")
    : `<tr><td colspan="4">Aucune créature n’est prise dans l’enchantement.</td></tr>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-amitie"
           style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
          <img src="${add2eHtmlEscape(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${add2eHtmlEscape(casterName)}</div>
            <div style="font-size:12px;font-weight:700;">lance ${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. ${level}</div>
          <img src="${add2eHtmlEscape(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
        </div>
        <div style="padding:9px 10px 10px;background:#f6f0ff;">
          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;text-align:center;">Enchantement social</div>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">Le visage du magicien se pare de signes colorés et son aura devient plus marquante.</p>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Rayon :</b> ${add2eHtmlEscape(radiusText)} — <b>Durée :</b> ${durationRounds} round${durationRounds > 1 ? "s" : ""}.</p>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#fffaff;border:1px solid #8e63c7;font-size:12px;">
            <thead><tr style="background:#e8d9ff;color:#2d2144;"><th style="text-align:left;padding:4px;border-bottom:1px solid #8e63c7;">Créature</th><th style="text-align:center;padding:4px;border-bottom:1px solid #8e63c7;">Jet</th><th style="text-align:center;padding:4px;border-bottom:1px solid #8e63c7;">Seuil</th><th style="text-align:left;padding:4px;border-bottom:1px solid #8e63c7;">Réaction</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Paramètres du sort</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p><b>École :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.school)} — <b>Portée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.rangeText)}.</p>
              <p><b>Zone :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.areaText)}.</p>
              <p><b>Composantes :</b> V, S, M — <b>Incantation :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.castingTimeText)} — <b>Jet de sauvegarde :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.saveText)}.</p>
              <p><b>Composante matérielle :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.materialText)} appliqués sur le visage.</p>
            </div>
          </details>
        </div>
      </div>`
  });
}

if (!ADD2E_ACTOR) {
  ui.notifications?.warn?.("Amitié : acteur lanceur introuvable.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_ACTOR] Acteur lanceur introuvable.`);
  return false;
}

const level = add2eCasterLevel(ADD2E_ACTOR);
const casterToken = add2eGetCasterToken(ADD2E_ACTOR);
const templateRequestId = add2eRandomId();
const zone = await add2eChooseNativeTemplateZone(level, casterToken, templateRequestId);
if (!zone) {
  console.log(`${ADD2E_ONUSE_TAG}[CANCEL] Zone annulée : remboursement du slot mémorisé par le dispatcher.`);
  return false;
}

const area = add2eSceneArea(level);
const targetTokens = add2eTokensInZone(zone, level, casterToken);
const results = [];

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR.name,
  sort: ADD2E_ITEM?.name,
  level,
  zoneCenter: { x: zone.x, y: zone.y },
  templatePersisted: zone.persisted,
  templateVia: zone.templateVia,
  templateRequestId: zone.templateRequestId,
  templateId: zone.templateId,
  radiusTacticalInches: add2eAreaRadiusInches(level),
  radiusMeters: area.sourceMeters,
  radiusSceneDistance: area.sceneDistance,
  radiusSceneUnit: area.sceneUnit,
  radiusGridCells: area.gridCells,
  radiusPixels: area.pixels,
  targets: targetTokens.map(target => ({ name: target.name, actor: target.actor?.name }))
});

for (const targetToken of targetTokens) {
  const result = await add2eResolveAmitieTarget(targetToken, ADD2E_ACTOR, level, zone);
  if (result) results.push(result);
}

await add2eChatAmitie(ADD2E_ACTOR, level, results);

if (!results.some(result => result.effectRequested)) {
  await add2eDeleteLinkedTemplate(zone, "no-active-effect");
}

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  targetCount: targetTokens.length,
  templatePersisted: zone.persisted,
  templateVia: zone.templateVia,
  templateRequestId: zone.templateRequestId,
  results: results.map(result => ({
    token: result.token?.name,
    status: result.status,
    saveTotal: result.saveData?.total ?? null,
    saveTarget: result.saveData?.saveTarget ?? null,
    modifier: result.modifier,
    effectRequested: result.effectRequested
  }))
});

return true;
