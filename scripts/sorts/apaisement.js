/**
 * ADD2E — Apaisement / Épouvante
 * Clerc niveau 1
 * Version : 2026-06-28-apaisement-touch-resolution-v4
 *
 * Contrat onUse : true = sort consommé, false = sort non consommé.
 * Chaque item lance exclusivement son propre effet : aucun choix de variante.
 * Apaisement sur un personnage est consenti ; les autres contacts exigent un toucher.
 */

console.log("%c[ADD2E][APAISEMENT] 2026-06-28-apaisement-touch-resolution-v4", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const COLORS = { main: "#b88924", dark: "#6f4b12", pale: "#fff7df", pale2: "#fffaf0", border: "#e2bc63", success: "#2f8f46", fail: "#b33a2e", warn: "#b88924" };

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const norm = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  function resolveSpellMode(sourceItem) {
    const exactMode = value => {
      const key = norm(value);
      if (key === "epouvante") return "epouvante";
      if (key === "apaisement") return "apaisement";
      return null;
    };

    const nameMode = exactMode(sourceItem?.name);
    if (nameMode) return nameMode;

    const candidates = [
      sourceItem?.system?.nom,
      sourceItem?.system?.label,
      sourceItem?.system?.slug,
      sourceItem?.system?.spellKey,
      sourceItem?.system?.sortKey,
      sourceItem?.flags?.add2e?.spellKey,
      sourceItem?.flags?.add2e?.slug,
      sourceItem?.flags?.add2e?.variantKey,
      sourceItem?.flags?.add2e?.reversible?.key,
      sourceItem?.flags?.add2e?.reversible?.variant
    ];
    const modes = new Set(candidates.map(exactMode).filter(Boolean));
    return modes.size === 1 ? Array.from(modes)[0] : null;
  }

  function num(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value && typeof value === "object") {
      for (const key of ["actuel", "max", "value", "valeur", "current", "base", "total", "vitesse", "movement", "move", "metresTour", "movement_max", "movement_base"]) {
        if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key]);
      }
      return NaN;
    }
    const raw = String(value ?? "").trim();
    if (!raw) return NaN;
    const match = raw.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return NaN;
    const parsed = Number(match[0].replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function readNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function chatStyleData() {
    return CONST.CHAT_MESSAGE_STYLES
      ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
      : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

  function timeApi() {
    return game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  }

  function durationData(rounds) {
    const time = timeApi();
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  }

  function toRounds(value, unit, level = 1) {
    const time = timeApi();
    return time?.toRounds?.(value, unit, { level }) ?? (unit === "tour" ? Number(value) * 10 : Number(value));
  }

  function gmRelay(operation, payload) {
    const message = { type: "ADD2E_GM_OPERATION", operation, payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() } };
    console.log("[ADD2E][APAISEMENT][GM-RELAY] emit", message);
    game.socket?.emit("system.add2e", message);
  }

  function effectTags(effect) {
    const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
    const list = Array.isArray(raw) ? raw : String(raw).split(/[,;\n]+/);
    return list.map(norm).filter(Boolean);
  }

  function findEffects(actorDoc, mode) {
    if (!actorDoc?.effects) return [];
    const wanted = mode === "epouvante"
      ? ["etat:epouvante", "etat:peur", "controle:fuite"]
      : ["etat:apaise", "bonus_js_peur:4", "bonus_save_vs:peur:4"];
    const wantedNorm = wanted.map(norm);
    return actorDoc.effects.filter(effect => {
      const name = norm(effect.name);
      const tags = effectTags(effect);
      if (mode === "epouvante") return name.includes("epouvante") || name.includes("peur") || wantedNorm.some(tag => tags.includes(tag));
      return name.includes("apaisement") || name.includes("apaise") || wantedNorm.some(tag => tags.includes(tag));
    });
  }

  async function createEffect(actorDoc, effectData, tokenDoc = null, removeTags = []) {
    if (!actorDoc) return false;
    const wanted = removeTags.map(norm).filter(Boolean);

    if (game.user.isGM || actorDoc.isOwner) {
      if (wanted.length) {
        const ids = Array.from(actorDoc.effects ?? [])
          .filter(effect => wanted.some(tag => effectTags(effect).includes(tag)))
          .map(effect => effect.id)
          .filter(Boolean);
        if (ids.length) await actorDoc.deleteEmbeddedDocuments("ActiveEffect", ids);
      }
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }

    if (!game.socket) {
      ui.notifications.error("Apaisement : socket indisponible, impossible de demander l’effet au MJ.");
      return false;
    }

    gmRelay("createActiveEffect", { actorUuid: actorDoc.uuid, actorId: actorDoc.id, sceneId: tokenDoc?.parent?.id ?? canvas.scene?.id, tokenId: tokenDoc?.id ?? null, effectData });
    return true;
  }

  async function deleteEffects(actorDoc, effects) {
    if (!effects?.length) return { deleted: 0, blocked: false };
    if (game.user.isGM || actorDoc.isOwner) {
      const ids = effects.map(effect => effect.id).filter(Boolean);
      if (ids.length) await actorDoc.deleteEmbeddedDocuments("ActiveEffect", ids);
      return { deleted: ids.length, blocked: false };
    }
    return { deleted: 0, blocked: true };
  }

  function tokensAtTouch(a, b) {
    if (!a || !b || a.id === b.id) return true;
    const grid = canvas.grid?.size || canvas.scene?.grid?.size || 100;
    const aLeft = Number(a.document.x ?? 0) / grid;
    const aTop = Number(a.document.y ?? 0) / grid;
    const aRight = aLeft + Number(a.document.width || 1);
    const aBottom = aTop + Number(a.document.height || 1);
    const bLeft = Number(b.document.x ?? 0) / grid;
    const bTop = Number(b.document.y ?? 0) / grid;
    const bRight = bLeft + Number(b.document.width || 1);
    const bBottom = bTop + Number(b.document.height || 1);
    const gapX = Math.max(0, bLeft - aRight, aLeft - bRight);
    const gapY = Math.max(0, bTop - aBottom, aTop - bBottom);
    return gapX <= 0.01 && gapY <= 0.01;
  }

  function getThac0(actorDoc) {
    const sys = actorDoc?.system ?? {};
    if (actorDoc?.type === "personnage") {
      const classeItem = actorDoc.items?.find(itemDoc => itemDoc.type === "classe");
      const niveau = Number(sys.niveau) || 1;
      const progression = Array.isArray(classeItem?.system?.progression)
        ? classeItem.system.progression[niveau - 1]
        : null;
      const progressionThac0 = readNumber(progression?.thac0);
      if (progressionThac0 !== null) return progressionThac0;
    }
    return readNumber(sys.thac0) ?? 20;
  }

  function getTargetCA(targetActor, caster, sourceItem) {
    const sys = targetActor?.system ?? {};
    if (targetActor?.type === "personnage" && typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicPassiveDefense === "function") {
      const details = Add2eEffectsEngine.getMagicPassiveDefense(targetActor, {
        source: "spell-touch-attack",
        attacker: caster?.name,
        weapon: sourceItem?.name ?? "Apaisement"
      });
      const ca = readNumber(details?.caTotal);
      if (ca !== null) return { ca, source: "effects-engine:magic-passive-defense" };
    }
    return {
      ca: readNumber(sys.armorClass) ?? readNumber(sys.ca_total) ?? readNumber(sys.ca) ?? 10,
      source: "actor-system"
    };
  }

  async function rollTouchAttack({ caster, targetActor, sourceItem }) {
    const thac0 = getThac0(caster);
    const caInfo = getTargetCA(targetActor, caster, sourceItem);
    const seuil = thac0 - caInfo.ca;
    const roll = await new Roll("1d20").evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const d20 = Number(roll.total) || 0;
    const success = d20 === 20 || (d20 !== 1 && d20 >= seuil);
    return { roll, d20, thac0, ca: caInfo.ca, caSource: caInfo.source, seuil, success };
  }

  function touchResultHtml(touch) {
    if (!touch) return "";
    const color = touch.success ? COLORS.success : COLORS.fail;
    const background = touch.success ? "#f1fff4" : "#fff5f2";
    return `<div style="margin-bottom:7px;border:1px solid ${color};background:${background};border-radius:6px;padding:7px;text-align:center;color:${COLORS.dark};"><b style="color:${color};">JET DE TOUCHER ${touch.success ? "RÉUSSI" : "RATÉ"}</b><br>Jet : <b>${touch.d20}</b> / Seuil : <b>${touch.seuil}</b><br><span style="font-size:0.85em;">THAC0 ${touch.thac0} - CA ${touch.ca} = ${touch.seuil}</span></div>`;
  }

  function unitToMeters(distance, unit) {
    const normalizedUnit = String(unit ?? "").toLowerCase();
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(normalizedUnit)) return distance * 0.3048;
    if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(normalizedUnit)) return distance * 1000;
    return distance;
  }

  function tokenCenter(tokenDoc) {
    const scene = tokenDoc?.parent ?? canvas.scene;
    const grid = Number(scene?.grid?.size ?? canvas.grid?.size ?? 100) || 100;
    return {
      x: Number(tokenDoc?.x ?? 0) + Number(tokenDoc?.width ?? 1) * grid / 2,
      y: Number(tokenDoc?.y ?? 0) + Number(tokenDoc?.height ?? 1) * grid / 2
    };
  }

  function getMovementMeters(actorDoc) {
    const sys = actorDoc?.system ?? {};
    const candidates = [
      ["system.mouvement.actuel", sys.mouvement?.actuel],
      ["system.mouvement.max", sys.mouvement?.max],
      ["system.mouvement.metresTour", sys.mouvement?.metresTour],
      ["system.mouvement.vitesse", sys.mouvement?.vitesse],
      ["system.movement_max", sys.movement_max],
      ["system.movement_modes.vol.value", sys.movement_modes?.vol?.value],
      ["system.movement_modes.nage.value", sys.movement_modes?.nage?.value],
      ["system.movement_modes.creuser.value", sys.movement_modes?.creuser?.value],
      ["system.movement_modes.marche.value", sys.movement_modes?.marche?.value],
      ["system.movement.value", sys.movement?.value],
      ["system.movement", sys.movement],
      ["system.vitesse_deplacement", sys.vitesse_deplacement],
      ["system.vitesse", sys.vitesse],
      ["system.deplacement", sys.deplacement],
      ["system.déplacement", sys["déplacement"]]
    ];
    for (const [source, raw] of candidates) {
      const value = num(raw);
      if (Number.isFinite(value)) {
        console.log("[ADD2E][APAISEMENT][EPOUVANTE][MOVE_SOURCE]", { actor: actorDoc?.name, actorType: actorDoc?.type, source, raw, value });
        return { ok: true, source, value, raw };
      }
    }
    console.error("[ADD2E][APAISEMENT][EPOUVANTE][MOVE_MISSING]", { actor: actorDoc?.name, actorType: actorDoc?.type, system: { mouvement: sys.mouvement, movement: sys.movement, movement_raw: sys.movement_raw, movement_max: sys.movement_max, movement_modes: sys.movement_modes, vitesse_deplacement: sys.vitesse_deplacement } });
    return { ok: false, source: null, value: NaN, raw: null };
  }

  function fleeDestination(casterDoc, targetDoc, maxMeters) {
    const scene = targetDoc?.parent ?? canvas.scene;
    const grid = Number(scene?.grid?.size ?? canvas.grid?.size ?? 100) || 100;
    const gridDistance = Number(scene?.grid?.distance ?? canvas.scene?.grid?.distance ?? 1) || 1;
    const gridUnits = scene?.grid?.units ?? canvas.scene?.grid?.units ?? "m";
    const metersPerGrid = Math.max(0.01, unitToMeters(gridDistance, gridUnits));
    const maxPixels = Math.max(0, Number(maxMeters) || 0) / metersPerGrid * grid;
    const casterCenter = tokenCenter(casterDoc);
    const targetCenter = tokenCenter(targetDoc);
    let dx = targetCenter.x - casterCenter.x;
    let dy = targetCenter.y - casterCenter.y;
    let length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 1) { dx = 1; dy = 0; length = 1; }
    const tokenWidthPx = Number(targetDoc.width ?? 1) * grid;
    const tokenHeightPx = Number(targetDoc.height ?? 1) * grid;
    let x = targetCenter.x + (dx / length) * maxPixels - tokenWidthPx / 2;
    let y = targetCenter.y + (dy / length) * maxPixels - tokenHeightPx / 2;
    x = Math.round(x / grid) * grid;
    y = Math.round(y / grid) * grid;
    const maxX = Math.max(0, Number(scene?.width ?? canvas.dimensions?.width ?? x) - tokenWidthPx);
    const maxY = Math.max(0, Number(scene?.height ?? canvas.dimensions?.height ?? y) - tokenHeightPx);
    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));
    const movedMeters = unitToMeters((Math.hypot(x - Number(targetDoc.x ?? 0), y - Number(targetDoc.y ?? 0)) / grid) * gridDistance, gridUnits);
    return { x, y, maxMeters: Math.round(maxMeters * 100) / 100, movedMeters: Math.round(movedMeters * 100) / 100, from: { x: Number(targetDoc.x ?? 0), y: Number(targetDoc.y ?? 0) } };
  }

  async function moveTokenForEpouvante(casterDoc, targetDoc, actorDoc) {
    const move = getMovementMeters(actorDoc);
    if (!move.ok) return { moved: false, requested: false, fatal: true, reason: "Mouvement absent ou invalide dans le JSON de la cible.", maxMeters: 0, movedMeters: 0 };
    if (move.value <= 0) return { moved: false, requested: false, fatal: false, reason: "La cible a un mouvement de 0 : aucune fuite possible.", maxMeters: 0, movedMeters: 0 };

    const dest = fleeDestination(casterDoc, targetDoc, move.value);
    console.log("[ADD2E][APAISEMENT][EPOUVANTE][DESTINATION]", { actor: actorDoc?.name, move, dest });
    if (!Number.isFinite(dest.x) || !Number.isFinite(dest.y)) return { moved: false, requested: false, fatal: true, reason: "Destination de fuite invalide.", maxMeters: move.value, movedMeters: 0 };
    if (Math.abs(dest.x - Number(targetDoc.x ?? 0)) < 1 && Math.abs(dest.y - Number(targetDoc.y ?? 0)) < 1) return { moved: false, requested: false, fatal: false, reason: "La cible ne peut pas être éloignée davantage dans cette direction.", ...dest };

    const flagData = { casterTokenId: casterDoc?.id ?? null, casterTokenName: casterDoc?.name ?? null, movedAt: Date.now(), movementSource: move.source, maxMeters: dest.maxMeters, movedMeters: dest.movedMeters, from: dest.from, to: { x: dest.x, y: dest.y } };
    const updateData = { x: dest.x, y: dest.y, flags: { add2e: { epouvanteForcedMove: flagData, lastAllowedPosition: { x: dest.x, y: dest.y } } } };
    const updateOptions = { add2eIgnoreMovement: true, add2eForcedMovement: true, add2eReason: "epouvante-forced-flee" };

    console.log("[ADD2E][APAISEMENT][EPOUVANTE][MOVE_ATTEMPT]", { user: game.user.name, isGM: game.user.isGM, target: targetDoc?.name, tokenId: targetDoc?.id, updateData, updateOptions });
    if (game.user.isGM) {
      try {
        const updated = await targetDoc.update(updateData, updateOptions);
        console.log("[ADD2E][APAISEMENT][EPOUVANTE][MOVE_APPLIED]", { target: targetDoc.name, updated, expected: { x: dest.x, y: dest.y } });
        return { moved: true, requested: false, fatal: false, reason: "Déplacement appliqué.", ...dest };
      } catch (error) {
        console.error("[ADD2E][APAISEMENT][EPOUVANTE][MOVE_ERROR]", { target: targetDoc.name, updateData, updateOptions, error });
        return { moved: false, requested: false, fatal: true, reason: error?.message || "Erreur pendant la mise à jour du token.", ...dest };
      }
    }

    gmRelay("updateToken", { sceneId: targetDoc.parent?.id ?? canvas.scene?.id, tokenId: targetDoc.id, updateData, options: updateOptions });
    return { moved: false, requested: true, fatal: false, reason: "Déplacement demandé au MJ.", ...dest };
  }

  async function saveVsSpells(actorDoc) {
    if (!actorDoc) return NaN;
    if (actorDoc.type === "monster") {
      try {
        const data = await actorDoc.sheet.getData();
        const value = Number(data?.calculatedSaves?.sorts);
        if (Number.isFinite(value) && value > 0) return value;
      } catch (error) { console.warn("[ADD2E][APAISEMENT] sauvegarde monstre impossible", error); }
    }
    for (const raw of [actorDoc.system?.sauvegarde_sortileges, actorDoc.system?.sauvegardes?.sortileges, actorDoc.system?.saves?.sorts, actorDoc.system?.calculatedSaves?.sorts]) {
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return NaN;
  }

  function timeFlags({ sourceItem, caster, targetActor, mode, rounds }) {
    const isFear = mode === "epouvante";
    const tags = isFear
      ? ["sort:apaisement", "etat:epouvante", "etat:peur", "controle:fuite"]
      : ["sort:apaisement", "etat:apaise", "bonus_js_peur:4", "bonus_save_vs:peur:4"];
    const endMessage = isFear ? "L’épouvante de {actor} prend fin." : "L’apaisement de {actor} prend fin.";
    const time = timeApi();
    return time?.flags?.({
      source: "apaisement.js",
      rounds,
      unit: "round",
      endMessage,
      extra: {
        spellName: isFear ? "Épouvante" : "Apaisement",
        spellKey: isFear ? "epouvante" : "apaisement",
        mode,
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        targetId: targetActor?.id ?? null,
        targetUuid: targetActor?.uuid ?? null,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage },
      endMessage,
      spellName: isFear ? "Épouvante" : "Apaisement",
      spellKey: isFear ? "epouvante" : "apaisement",
      mode,
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      tags
    };
  }

  function effectData({ sourceItem, caster, targetActor, mode, rounds }) {
    const isFear = mode === "epouvante";
    const tags = isFear
      ? ["sort:apaisement", "etat:epouvante", "etat:peur", "controle:fuite"]
      : ["sort:apaisement", "etat:apaise", "bonus_js_peur:4", "bonus_save_vs:peur:4"];
    return {
      name: isFear ? "Épouvante" : "Apaisement",
      img: sourceItem.img || (isFear ? "icons/magic/control/fear-fright-monster-red.webp" : "icons/magic/holy/barrier-shield-winged-blue.webp"),
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: isFear
        ? `Épouvante : la victime touchée fuit le plus vite possible et le plus loin possible du clerc pendant ${rounds} round(s).`
        : "Apaisement : +4 aux jets de protection contre les attaques magiques provoquant la peur pendant 1 tour.",
      flags: { add2e: { ...timeFlags({ sourceItem, caster, targetActor, mode, rounds }), tags } },
      changes: []
    };
  }

  function spellCard({ caster, sourceItem, targetActor, title, resultHtml, mode }) {
    const casterName = esc(caster?.name ?? "Lanceur");
    const targetName = esc(targetActor?.name ?? "Cible");
    const spellName = esc(title || sourceItem?.name || "Apaisement");
    const modeLabel = mode === "epouvante" ? "Sort divin inversé" : "Sort divin";
    const casterImg = esc(caster?.img || "icons/svg/mystery-man.svg");
    const spellImg = esc(sourceItem?.img || "icons/magic/holy/barrier-shield-winged-blue.webp");
    return `<div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;font-family:var(--font-primary);"><div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;"><img src="${casterImg}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${casterName}</div><div style="font-size:0.85em;opacity:0.95;">lance <b>${spellName}</b></div></div><div style="text-align:right;font-size:0.78em;opacity:0.95;">${esc(modeLabel)}</div><img src="${spellImg}" style="width:32px;height:32px;border-radius:4px;background:#fff;"></div><div style="padding:10px;"><div style="margin-bottom:6px;font-size:0.95em;color:${COLORS.dark};"><b>Cible :</b> ${targetName}</div>${resultHtml}<details style="margin-top:8px;background:white;border:1px solid ${COLORS.border};border-radius:6px;"><summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Règle appliquée</summary><div style="padding:8px;font-size:0.85em;line-height:1.45;color:${COLORS.dark};"><div><b>Apaisement</b> : +4 aux JS contre les attaques magiques provoquant la peur pendant 1 tour.</div><div>Si la cible est déjà apeurée, elle peut retenter un JS avec +1 par niveau du clerc.</div><div><b>Épouvante</b> : la cible fuit immédiatement au maximum de son déplacement, à l'opposé du clerc, pendant 1 round par niveau.</div></div></details></div></div>`;
  }

  let sourceItem = (typeof item !== "undefined" && item) ? item : ((typeof sort !== "undefined" && sort) ? sort : this);
  if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;
  if (!sourceItem) { ui.notifications.error("Apaisement / Épouvante : sort introuvable."); return false; }

  const mode = resolveSpellMode(sourceItem);
  if (!mode) {
    ui.notifications.error(`Apaisement / Épouvante : impossible d’identifier le sort lancé (« ${sourceItem.name ?? "sans nom"} »). Le lancement est annulé pour éviter d’appliquer la mauvaise variante.`);
    return false;
  }
  const title = mode === "epouvante" ? "Épouvante" : "Apaisement";

  const casterTokenObj = canvas.tokens.controlled[0] ?? ((typeof token !== "undefined" && token) ? token : null);
  if (!casterTokenObj) { ui.notifications.warn(`Sélectionne le token du lanceur avant d’utiliser ${title}.`); return false; }
  const casterTokenDoc = casterTokenObj.document;
  const caster = casterTokenObj.actor ?? sourceItem.parent ?? ((typeof actor !== "undefined" && actor) ? actor : null);
  if (!caster) { ui.notifications.error(`${title} : lanceur introuvable.`); return false; }

  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1) { ui.notifications.warn(`${title} : cible exactement une créature.`); return false; }
  const targetTokenObj = targets[0];
  const targetTokenDoc = targetTokenObj.document;
  const targetActorDoc = targetTokenObj.actor;
  if (!targetActorDoc) { ui.notifications.warn(`${title} : cible sans acteur.`); return false; }
  if (!tokensAtTouch(casterTokenObj, targetTokenObj)) { ui.notifications.warn(`${title} : la cible doit être au toucher.`); return false; }

  const targetIsConsentingCharacter = mode === "apaisement" && targetActorDoc.type === "personnage";
  const touch = targetIsConsentingCharacter ? null : await rollTouchAttack({ caster, targetActor: targetActorDoc, sourceItem });
  if (touch && !touch.success) {
    const resultHtml = `${touchResultHtml(touch)}<div style="border:1px solid ${COLORS.fail};background:#fff5f2;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.fail};">CONTACT MANQUÉ</div><div>L’effet du sort n’est pas appliqué.</div></div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: spellCard({ caster, sourceItem, targetActor: targetActorDoc, title, resultHtml, mode }), ...chatStyleData() });
    return true;
  }

  const touchHtml = touchResultHtml(touch);
  const casterLevel = Math.max(1, Number(caster.system?.niveau) || Number(caster.system?.level) || 1);
  let resultHtml = "";

  if (mode === "apaisement") {
    const fearEffectsBefore = findEffects(targetActorDoc, "epouvante");
    let saveHtml = "";
    if (fearEffectsBefore.length) {
      const saveVal = await saveVsSpells(targetActorDoc);
      if (Number.isFinite(saveVal) && saveVal > 0) {
        const roll = await new Roll(`1d20+${casterLevel}`).evaluate({ async: true });
        if (game.dice3d) await game.dice3d.showForRoll(roll);
        const success = roll.total >= saveVal;
        const deleteResult = success ? await deleteEffects(targetActorDoc, fearEffectsBefore) : { deleted: 0, blocked: false };
        saveHtml = `<div style="margin-top:6px;border:1px solid ${success ? COLORS.success : COLORS.fail};background:${success ? "#f1fff4" : "#fff5f2"};border-radius:6px;padding:7px;text-align:center;color:${COLORS.dark};"><b style="color:${success ? COLORS.success : COLORS.fail};">${success ? "NOUVEAU JS RÉUSSI" : "NOUVEAU JS RATÉ"}</b><br>Jet : <b>${esc(roll.result)}</b> = <b>${roll.total}</b> contre ${saveVal}${success && deleteResult.deleted ? `<br>Effet de peur supprimé : <b>${deleteResult.deleted}</b>` : ""}${success && deleteResult.blocked ? `<br><span style="color:${COLORS.warn};">Suppression à effectuer par le MJ.</span>` : ""}</div>`;
      } else {
        saveHtml = `<div style="margin-top:6px;border:1px solid ${COLORS.warn};background:#fffdf4;border-radius:6px;padding:7px;text-align:center;color:${COLORS.dark};"><b>JS supplémentaire non automatisé</b><br>Sauvegarde contre les sortilèges introuvable. Bonus applicable : <b>+${casterLevel}</b>.</div>`;
      }
    }

    const rounds = toRounds(1, "tour", casterLevel);
    const created = await createEffect(
      targetActorDoc,
      effectData({ sourceItem, caster, targetActor: targetActorDoc, mode, rounds }),
      targetTokenDoc,
      ["etat:apaise", "bonus_js_peur:4", "bonus_save_vs:peur:4"]
    );
    if (!created) return false;
    resultHtml = `${touchHtml}<div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.success};">APAISEMENT APPLIQUÉ</div><div>Bonus : <b>+4</b> aux JS contre les attaques magiques provoquant la peur.</div><div>Durée : <b>1 tour</b> / ${rounds} rounds.</div></div>${saveHtml}`;
  }

  if (mode === "epouvante") {
    const deleteResult = await deleteEffects(targetActorDoc, findEffects(targetActorDoc, "apaisement"));
    const moveResult = await moveTokenForEpouvante(casterTokenDoc, targetTokenDoc, targetActorDoc);
    if (moveResult.fatal) { ui.notifications.error(`Épouvante : ${moveResult.reason}`); return false; }

    const rounds = toRounds("level", "round", casterLevel);
    const created = await createEffect(
      targetActorDoc,
      effectData({ sourceItem, caster, targetActor: targetActorDoc, mode, rounds }),
      targetTokenDoc,
      ["etat:epouvante", "etat:peur", "controle:fuite"]
    );
    if (!created) return false;

    const moveHtml = moveResult.requested
      ? `<div>Déplacement demandé au MJ : <b>${moveResult.maxMeters} m</b>.</div>`
      : moveResult.moved
        ? `<div>Déplacement appliqué : <b>${moveResult.movedMeters} m</b> sur un maximum de ${moveResult.maxMeters} m.</div>`
        : `<div>${esc(moveResult.reason)}</div>`;
    const clearHtml = deleteResult.deleted ? `<div>Apaisement retiré : <b>${deleteResult.deleted}</b>.</div>` : "";
    resultHtml = `${touchHtml}<div style="border:1px solid ${COLORS.fail};background:#fff5f2;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.fail};">ÉPOUVANTE APPLIQUÉE</div>${moveHtml}<div>Durée : <b>${rounds} round(s)</b>.</div>${clearHtml}</div>`;
  }

  await globalThis.ADD2E_PLAY_SPELL_FX?.(mode === "epouvante" ? "epouvante" : "apaisement", { casterToken: casterTokenObj, targetToken: targetTokenObj });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: spellCard({ caster, sourceItem, targetActor: targetActorDoc, title, resultHtml, mode }), ...chatStyleData() });

  console.log("[ADD2E][apaisement.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "apaisement.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Apaisement : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
