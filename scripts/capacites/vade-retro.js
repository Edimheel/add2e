// ADD2E — Capacité de classe : Vade-rétro
// Compatible Foundry V13 / V14 / V15.
// Contrat onUse : true = capacité utilisée ; false = annulée / non utilisée.
// La visée utilise un cône PIXI, sans Warpgate, sur le modèle de Mains brûlantes.

const __add2eVadeRetroResult = await (async () => {
  const VERSION = "2026-07-05-vade-retro-rewrite-v3";
  const ICON = "icons/magic/holy/barrier-shield-winged-cross.webp";
  const CONE = Object.freeze({ angle: 90, cells: 3 });
  const TABLE = Object.freeze({
    squelette:     ["10", "7",  "4",  "T",  "T",  "D",  "D",  "D*", "D*", "D*"],
    zombie:        ["13", "10", "7",  "T",  "T",  "D",  "D",  "D",  "D*", "D*"],
    goule:         ["16", "13", "10", "4",  "T",  "T",  "D",  "D",  "D",  "D*"],
    ombre:         ["19", "16", "13", "7",  "4",  "T",  "T",  "D",  "D",  "D*"],
    necrophage:    ["20", "19", "16", "10", "7",  "4",  "T",  "T",  "D",  "D"],
    ghast:         [null, "20", "19", "13", "10", "7",  "4",  "T",  "T",  "D"],
    ame_en_peine:  [null, null, "20", "16", "13", "10", "7",  "4",  "T",  "D"],
    momie:         [null, null, null, "20", "16", "13", "10", "7",  "4",  "T"],
    spectre:       [null, null, null, null, "20", "16", "13", "10", "7",  "T"],
    vampire:       [null, null, null, null, null, "20", "16", "13", "10", "4"],
    fantome:       [null, null, null, null, null, null, "20", "16", "13", "7"],
    liche:         [null, null, null, null, null, null, null, "19", "16", "10"],
    special:       [null, null, null, null, null, null, null, "20", "19", "13"]
  });
  const ORDER = Object.freeze(["squelette", "zombie", "goule", "ombre", "necrophage", "ghast", "ame_en_peine", "momie", "spectre", "vampire", "fantome", "liche", "special"]);
  const LABELS = Object.freeze({
    squelette: "Squelette", zombie: "Zombie", goule: "Goule", ombre: "Ombre", necrophage: "Nécrophage", ghast: "Ghast",
    ame_en_peine: "Âme en peine", momie: "Momie", spectre: "Spectre", vampire: "Vampire", fantome: "Fantôme", liche: "Liche",
    special: "Créature mauvaise des plans inférieurs"
  });
  const UNDEAD_TAG = "creature_label:mort-vivant";
  const ORDER_INDEX = new Map(ORDER.map((key, index) => [key, index]));

  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const norm = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const numberFrom = value => {
    const match = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : NaN;
  };
  const flatten = (value, out = []) => {
    if (value === null || value === undefined || value === "") return out;
    if (Array.isArray(value) || value instanceof Set) {
      for (const entry of value) flatten(entry, out);
      return out;
    }
    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) entry === true ? out.push(key) : flatten(entry, out);
      return out;
    }
    for (const entry of String(value).split(/[,;|\n]+/)) if (entry.trim()) out.push(entry.trim());
    return out;
  };
  const roll = async formula => {
    const result = await new Roll(formula).evaluate({ async: true });
    try { await game.dice3d?.showForRoll?.(result); } catch (_error) {}
    return result;
  };

  const source = (typeof item !== "undefined" && item) || (typeof feature !== "undefined" && feature) || null;
  const caster = (typeof actor !== "undefined" && actor) || source?.parent || null;
  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster?.id ? token : null)
    ?? canvas.tokens?.controlled?.find(entry => entry?.actor?.id === caster?.id)
    ?? caster?.getActiveTokens?.()[0]
    ?? null;
  if (!caster) {
    ui.notifications.error("Vade-rétro : clerc ou paladin introuvable.");
    return false;
  }
  if (!casterToken?.center || !canvas?.scene) {
    ui.notifications.warn("Vade-rétro : le clerc ou paladin doit avoir un token sur la scène.");
    return false;
  }

  const sourceClass = norm(source?._add2eClassSlug ?? source?.sourceClassSlug ?? source?.classSlug ?? source?._add2eClassName ?? source?.sourceClassName ?? "");
  const isPaladin = sourceClass
    ? sourceClass.includes("paladin")
    : Array.from(caster.items ?? []).some(entry => norm(entry?.type) === "classe" && norm(entry?.system?.slug ?? entry?.system?.label ?? entry?.name).includes("paladin"));
  const nativeLevel = Math.max(1, Math.floor(Number(source?._add2eClassLevel ?? caster.system?.niveau ?? caster.system?.level ?? 1) || 1));
  const clericLevel = isPaladin ? nativeLevel - 2 : nativeLevel;
  if (clericLevel < 1) {
    ui.notifications.warn("Vade-rétro : le paladin obtient ce pouvoir au niveau 3.");
    return false;
  }
  const column = clericLevel <= 8 ? clericLevel - 1 : clericLevel <= 13 ? 8 : 9;
  const alignment = norm(caster.system?.alignement ?? caster.system?.alignment ?? "");
  const evilCleric = alignment.includes("mauvais") || alignment.includes("evil");

  function metersPerGridCell() {
    const grid = canvas.scene?.grid ?? canvas.grid;
    const distance = Number(grid?.distance ?? 0);
    const units = String(grid?.units ?? "").trim().toLowerCase();
    if (distance > 0 && /^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return distance;
    if (distance > 0 && /^(ft|feet|foot|pied|pieds)$/.test(units)) return distance * 0.3048;
    return distance > 1 ? distance : 3;
  }
  function gridSizePx() { return Number(canvas.grid?.size ?? canvas.dimensions?.size ?? 100) || 100; }
  function coneDistanceMeters() { return metersPerGridCell() * CONE.cells; }
  function pixelsToMeters(pixels) { return pixels / gridSizePx() * metersPerGridCell(); }
  function angleDifference(left, right) { return Math.abs(((right - left + 540) % 360) - 180); }
  function pointBearing(point) {
    const center = casterToken.center;
    return (Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI + 90 + 360) % 360;
  }
  function tokenPoints(target) {
    const x = Number(target.document?.x ?? target.x ?? 0);
    const y = Number(target.document?.y ?? target.y ?? 0);
    const width = Number(target.w ?? gridSizePx());
    const height = Number(target.h ?? gridSizePx());
    return [
      target.center, { x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height },
      { x: x + width / 2, y }, { x: x + width / 2, y: y + height }, { x, y: y + height / 2 }, { x: x + width, y: y + height / 2 }
    ].filter(Boolean);
  }
  function tokenInCone(target, direction) {
    const origin = casterToken.center;
    return tokenPoints(target).some(point => pixelsToMeters(Math.hypot(point.x - origin.x, point.y - origin.y)) <= coneDistanceMeters() && angleDifference(direction, pointBearing(point)) <= CONE.angle / 2);
  }
  function clearRulerArtifacts() {
    try { canvas.controls?.ruler?.clear?.(); } catch (_error) {}
    try { canvas.controls?.ruler?.destroyChildren?.(); } catch (_error) {}
    try { canvas.controls?.ruler?.render?.(true); } catch (_error) {}
  }
  function browserEventToCanvasPoint(event) {
    const view = canvas.app?.view;
    const renderer = canvas.app?.renderer;
    if (!view || !renderer || typeof PIXI === "undefined") return null;
    const rect = view.getBoundingClientRect();
    const scaleX = renderer.screen?.width ? renderer.screen.width / rect.width : 1;
    const scaleY = renderer.screen?.height ? renderer.screen.height / rect.height : 1;
    const global = new PIXI.Point((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY);
    return canvas.stage?.worldTransform?.applyInverse(global) ?? null;
  }
  const foundryToCanvasRadians = rotation => (Number(rotation ?? 0) - 90) * Math.PI / 180;
  const canvasToFoundryRotation = radians => (radians * 180 / Math.PI + 90 + 360) % 360;
  function drawCone(overlay, direction) {
    if (!overlay) return;
    const radius = coneDistanceMeters() / metersPerGridCell() * gridSizePx();
    const center = casterToken.center;
    const centerRadians = foundryToCanvasRadians(direction);
    const halfRadians = (CONE.angle / 2) * Math.PI / 180;
    const start = centerRadians - halfRadians;
    const end = centerRadians + halfRadians;
    overlay.clear();
    overlay.lineStyle(3, 0xc79b38, 0.95);
    overlay.beginFill(0xffe0a3, 0.30);
    overlay.moveTo(center.x, center.y);
    overlay.arc(center.x, center.y, radius, start, end);
    overlay.lineTo(center.x, center.y);
    overlay.endFill();
    overlay.lineStyle(2, 0xfff2c9, 0.95);
    overlay.moveTo(center.x, center.y);
    overlay.lineTo(center.x + Math.cos(start) * radius, center.y + Math.sin(start) * radius);
    overlay.moveTo(center.x, center.y);
    overlay.lineTo(center.x + Math.cos(end) * radius, center.y + Math.sin(end) * radius);
  }
  function createConeOverlay() {
    const parent = canvas.interface ?? canvas.controls ?? canvas.stage;
    if (!parent || typeof PIXI === "undefined") return null;
    const previous = parent.getChildByName?.("add2e-vade-retro-cone-overlay");
    if (previous) previous.destroy({ children: true });
    const overlay = new PIXI.Graphics();
    overlay.name = "add2e-vade-retro-cone-overlay";
    overlay.zIndex = 100000;
    overlay.eventMode = "none";
    overlay.interactive = false;
    parent.sortableChildren = true;
    parent.addChild(overlay);
    return overlay;
  }
  async function placeCone() {
    clearRulerArtifacts();
    const view = canvas.app?.view;
    const overlay = createConeOverlay();
    if (!view || !overlay) return { direction: Number(casterToken.document?.rotation ?? 0) || 0, manual: false };
    ui.notifications.info("Vade-rétro : déplace la souris pour orienter le cône, clic gauche pour valider, clic droit ou Échap pour annuler.");
    const oldCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    let direction = Number(casterToken.document?.rotation ?? 0) || 0;
    drawCone(overlay, direction);
    return new Promise(resolve => {
      let finished = false;
      const cleanup = (result, keepOverlay = false) => {
        if (finished) return;
        finished = true;
        view.removeEventListener("mousemove", onMove, true);
        view.removeEventListener("mousedown", onDown, true);
        view.removeEventListener("contextmenu", onContextMenu, true);
        window.removeEventListener("keydown", onKeyDown, true);
        view.style.cursor = oldCursor;
        clearRulerArtifacts();
        if (keepOverlay) {
          window.setTimeout(() => {
            if (!overlay.destroyed) overlay.destroy({ children: true });
            clearRulerArtifacts();
          }, 2400);
        } else if (!overlay.destroyed) overlay.destroy({ children: true });
        resolve(result);
      };
      const updateDirection = event => {
        const point = browserEventToCanvasPoint(event);
        if (!point) return;
        const center = casterToken.center;
        direction = canvasToFoundryRotation(Math.atan2(point.y - center.y, point.x - center.x));
        drawCone(overlay, direction);
      };
      function onMove(event) { updateDirection(event); }
      function onDown(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) return cleanup(null, false);
        if (event.button !== 0) return;
        updateDirection(event);
        cleanup({ direction, manual: true }, true);
      }
      function onContextMenu(event) { event.preventDefault(); event.stopPropagation(); cleanup(null, false); }
      function onKeyDown(event) {
        if (event.key !== "Escape") return;
        event.preventDefault(); event.stopPropagation(); cleanup(null, false);
      }
      view.addEventListener("mousemove", onMove, true);
      view.addEventListener("mousedown", onDown, true);
      view.addEventListener("contextmenu", onContextMenu, true);
      window.addEventListener("keydown", onKeyDown, true);
    });
  }

  function actorTags(targetActor) {
    const system = targetActor?.system ?? {};
    const flags = targetActor?.flags?.add2e ?? {};
    return new Set(flatten([system.tags, system.effectTags, flags.tags, flags.effectTags]).map(norm).filter(Boolean));
  }
  function hasUndeadTag(targetActor) {
    return actorTags(targetActor).has(norm(UNDEAD_TAG));
  }
  function actorText(targetActor) {
    const system = targetActor?.system ?? {};
    const values = flatten([targetActor?.name, system.type, system.type_monstre, system.type_creature, system.race]);
    for (const embedded of targetActor?.items ?? []) flatten([embedded?.name, embedded?.system?.label], values);
    return values.map(norm).filter(Boolean).join(" ");
  }
  function targetHitDice(targetActor) {
    for (const value of [targetActor?.system?.dv, targetActor?.system?.hitDice, targetActor?.system?.hd, targetActor?.system?.des_de_vie, targetActor?.system?.niveau, targetActor?.system?.level]) {
      const parsed = numberFrom(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }
  function specialEligible(targetActor) {
    const system = targetActor?.system ?? {};
    const armorClass = numberFrom(system.ca_total ?? system.ca ?? system.ac ?? system.armorClass);
    const hitDice = targetHitDice(targetActor);
    const magicResistance = numberFrom(system.resistance_magie ?? system.resistanceMagie ?? system.magicResistance ?? system.rm ?? system.mr);
    return !(Number.isFinite(armorClass) && armorClass <= -5) && !(Number.isFinite(hitDice) && hitDice >= 11) && !(Number.isFinite(magicResistance) && magicResistance >= 66);
  }
  function paladinRow(targetActor) {
    const level = Math.max(1, Math.floor(numberFrom(targetActor?.system?.niveau ?? targetActor?.system?.level) || 1));
    if (level <= 2) return "momie";
    if (level <= 4) return "spectre";
    if (level <= 6) return "vampire";
    if (level <= 8) return "fantome";
    if (level <= 10) return "liche";
    return "special";
  }
  function categoryFor(target) {
    const targetActor = target?.actor;
    if (!targetActor) return null;
    const text = actorText(targetActor);
    if (evilCleric && norm(targetActor.type) === "personnage" && text.includes("paladin")) {
      const row = paladinRow(targetActor);
      const level = Math.max(1, Math.floor(numberFrom(targetActor.system?.niveau ?? targetActor.system?.level) || 1));
      return { category: row, label: `Paladin niveau ${level}`, kind: "paladin", lowerPlane: false };
    }
    const aliases = [
      ["ame_en_peine", ["ame_en_peine", "wight"]], ["necrophage", ["necrophage", "wraith"]], ["squelette", ["squelette", "skeleton"]],
      ["zombie", ["zombie"]], ["goule", ["goule", "ghoul"]], ["ombre", ["ombre", "shadow"]], ["ghast", ["ghast"]],
      ["momie", ["momie", "mummy"]], ["spectre", ["spectre", "specter"]], ["vampire", ["vampire"]], ["fantome", ["fantome", "ghost"]], ["liche", ["liche", "lich"]]
    ];
    if (hasUndeadTag(targetActor)) {
      const found = aliases.find(([, words]) => words.some(word => text.includes(word)));
      if (found) return { category: found[0], label: LABELS[found[0]], kind: "mort-vivant", lowerPlane: false };
      return null;
    }
    const lowerPlane = ["demon", "diable", "devil", "daemon", "mezzodaemon", "sorciere_des_tenebres", "plan_inferieur", "plans_inferieurs"].some(word => text.includes(word));
    if (lowerPlane && specialEligible(targetActor)) return { category: "special", label: LABELS.special, kind: "plan inférieur", lowerPlane: true };
    return null;
  }
  function tableEntry(group) { return TABLE[group?.category]?.[column] ?? null; }
  function resolveToken(id) {
    return canvas.tokens?.get?.(id) ?? canvas.tokens?.placeables?.find(entry => entry?.id === id || entry?.document?.id === id) ?? null;
  }
  function groupsFrom(tokens) {
    const map = new Map();
    for (const target of tokens) {
      const info = categoryFor(target);
      if (!info || !tableEntry(info)) continue;
      const key = `${info.kind}|${info.category}`;
      const group = map.get(key) ?? { key, category: info.category, kind: info.kind, label: info.label, lowerPlane: info.lowerPlane, ids: [] };
      group.ids.push(target.id);
      map.set(key, group);
    }
    return [...map.values()].sort((left, right) => (ORDER_INDEX.get(left.category) ?? 999) - (ORDER_INDEX.get(right.category) ?? 999));
  }
  function combatState() {
    if (!game.combat?.id) return null;
    const all = caster.getFlag("add2e", "vadeRetro") ?? caster.flags?.add2e?.vadeRetro ?? {};
    return all?.[game.combat.id] ?? null;
  }
  async function saveCombatState(state) {
    if (!game.combat?.id) return;
    const all = caster.getFlag("add2e", "vadeRetro") ?? caster.flags?.add2e?.vadeRetro ?? {};
    await caster.setFlag("add2e", "vadeRetro", { ...all, [game.combat.id]: state });
  }

  const prior = combatState();
  const currentRound = Number(game.combat?.round ?? 0) || 0;
  if (prior?.status === "closed" || prior?.status === "complete") {
    ui.notifications.warn("Vade-rétro a déjà été résolu pour ce combat.");
    return false;
  }
  if (prior?.status === "pending" && Number(prior.lastRound ?? -1) === currentRound) {
    ui.notifications.warn("Vade-rétro : la tentative suivante contre un autre type se fait au round suivant.");
    return false;
  }

  const placement = await placeCone();
  if (!placement) {
    ui.notifications.info("Vade-rétro : tentative annulée.");
    return false;
  }
  const targetsInCone = Array.from(canvas.tokens?.placeables ?? [])
    .filter(target => target?.visible !== false && target?.actor && target.id !== casterToken.id && target.actor.id !== caster.id)
    .filter(target => tokenInCone(target, placement.direction));
  const queue = Array.isArray(prior?.pending) ? prior.pending : groupsFrom(targetsInCone);
  const group = queue[0] ?? null;
  if (!group) {
    ui.notifications.warn("Vade-rétro : aucun mort-vivant ou adversaire des plans inférieurs affectable dans le cône.");
    return false;
  }
  const groupTargets = group.ids.map(resolveToken).filter(target => target?.actor && tokenInCone(target, placement.direction))
    .sort((left, right) => String(left.name ?? left.actor?.name).localeCompare(String(right.name ?? right.actor?.name), "fr"));
  if (!groupTargets.length) {
    ui.notifications.warn(`Vade-rétro : aucun ${group.label.toLowerCase()} de la tentative en cours n’est dans le cône.`);
    return false;
  }

  const entry = tableEntry(group);
  const automatic = String(entry).startsWith("T") || String(entry).startsWith("D");
  const d20 = automatic ? null : await roll("1d20");
  const success = automatic || Number(d20.total) >= Number(entry);
  const stateBase = {
    version: VERSION, status: "", combatId: game.combat?.id ?? null, casterUuid: caster.uuid,
    sourceClass: isPaladin ? "paladin" : "clerc", effectiveClericLevel: clericLevel,
    lastRound: currentRound, direction: placement.direction,
    cone: { angle: CONE.angle, distance: coneDistanceMeters(), units: canvas.scene?.grid?.units ?? "m" }, updatedAt: Date.now()
  };
  if (!success) {
    await saveCombatState({ ...stateBase, status: "closed", reason: "failed", pending: [] });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      content: `<div class="add2e-chat-card" style="border:1.5px solid #aa473a;border-radius:10px;overflow:hidden;background:#fff8f5;"><div style="padding:8px 10px;background:#8c3428;color:#fff;display:flex;gap:8px;align-items:center;"><img src="${esc(caster.img || ICON)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid #fff;"><div><b>${esc(caster.name)}</b><div style="font-size:.88em;">Vade-rétro</div></div></div><div style="padding:9px 10px;"><b>ÉCHEC</b> — ${esc(group.label)} : d20 = <b>${d20.total}</b>, score requis <b>${esc(entry)}</b>.<div style="margin-top:5px;font-size:.9em;">Aucune autre tentative n’est possible dans ce combat.</div></div></div>`
    });
    return true;
  }

  const countFormula = group.lowerPlane ? "1d2" : String(entry).endsWith("*") ? "1d6+6" : "1d12";
  const countRoll = await roll(countFormula);
  const count = Math.max(1, Number(countRoll.total) || 1);
  const affected = groupTargets.slice(0, count);
  const remainder = groupTargets.slice(count).map(target => target.id);
  const pending = [...(remainder.length ? [{ ...group, ids: remainder }] : []), ...queue.slice(1)];

  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const createEffect = async (targetActor, effectData) => {
    if (game.user?.isGM || targetActor?.isOwner) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION", operation: "createActiveEffect",
      payload: { actorUuid: targetActor.uuid, actorId: targetActor.id, effectData, fromUserId: game.user?.id, sentAt: Date.now() }
    });
    return true;
  };
  const destroyTarget = async targetActor => {
    const current = [targetActor?.system?.pdv, targetActor?.system?.pv, targetActor?.system?.hp?.value, targetActor?.system?.attributes?.hp?.value]
      .map(numberFrom).find(Number.isFinite) ?? 1;
    if (game.user?.isGM || targetActor?.isOwner) {
      await targetActor.update({ "system.pdv": 0 }, { add2eReason: "vade-retro-destruction" });
      return true;
    }
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION", operation: "applyDamage",
      payload: { actorUuid: targetActor.uuid, actorId: targetActor.id, montant: Math.max(1, current), type: "vade-retro", details: "Vade-rétro — destruction / damnation" }
    });
    return true;
  };
  const roundEffect = rounds => {
    const extra = { source: "vade-retro.js", rounds, unit: "round", endMessage: "L’effet de Vade-rétro sur {actor} prend fin." };
    return {
      duration: time?.durationData?.(rounds) ?? { rounds, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null },
      flags: time?.flags?.(extra) ?? { timeEngine: { managed: true, unit: "round", totalRounds: rounds }, roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: extra.endMessage }, endMessage: extra.endMessage }
    };
  };
  const hoursEffect = hours => ({ startTime: game.time?.worldTime ?? null, seconds: Math.max(1, hours) * 3600 });

  const destroy = String(entry).startsWith("D") && !evilCleric;
  const dominate = String(entry).startsWith("D") && evilCleric;
  let outcome = "";
  let effectName = "";
  let effectDuration = {};
  let durationLabel = "";
  let tags = [];
  let reaction = null;
  if (destroy) {
    outcome = "Détruit / damné";
    effectName = "Détruit par Vade-rétro";
    tags = ["vade_retro", "etat:detruit_vade_retro", `vade_retro:${group.category}`];
  } else if (dominate) {
    outcome = "Dominé";
    effectName = "Dominé par Vade-rétro";
    effectDuration = hoursEffect(24 * 6);
    durationLabel = "6 jours (renouvellement requis)";
    tags = ["vade_retro", "etat:domine_vade_retro", "controle:clerc", `vade_retro:${group.category}`];
  } else if (evilCleric) {
    const threshold = String(entry).startsWith("T") ? null : Number(entry);
    const reactionRoll = await roll("1d100");
    const charismaAdjustment = Number(caster.system?.cha_react ?? 0) || 0;
    const adjusted = Number(reactionRoll.total) + charismaAdjustment;
    const attitude = adjusted >= 56 ? "Amical" : "Neutre";
    const hours = String(entry).startsWith("T") ? 24 : Math.max(1, 24 - threshold);
    outcome = `Influencé — ${attitude.toLowerCase()}`;
    effectName = `Influencé par Vade-rétro — ${attitude}`;
    effectDuration = hoursEffect(hours);
    durationLabel = `${hours} heure${hours > 1 ? "s" : ""}`;
    tags = ["vade_retro", "etat:influence_vade_retro", "controle:clerc", `attitude:${norm(attitude)}`, `vade_retro:${group.category}`];
    reaction = { rolled: reactionRoll.total, adjustment: charismaAdjustment, adjusted, attitude };
  } else {
    const durationRoll = await roll("3d4");
    const rounds = Math.max(3, Number(durationRoll.total) || 3);
    const timing = roundEffect(rounds);
    outcome = "Repoussé";
    effectName = "Repoussé par Vade-rétro";
    effectDuration = timing.duration;
    durationLabel = `${rounds} rounds (3d4 = ${rounds})`;
    tags = ["vade_retro", "etat:repousse_vade_retro", "interdiction:attaque", "interdiction:sort", "mouvement:eloignement_obligatoire", `vade_retro:${group.category}`];
    reaction = { timingFlags: timing.flags };
  }

  const rows = [];
  for (const target of affected) {
    const targetActor = target.actor;
    const effectData = {
      name: effectName,
      img: ICON,
      origin: caster.uuid,
      disabled: false,
      transfer: false,
      duration: effectDuration,
      changes: [],
      description: `${outcome} par ${caster.name}.${durationLabel ? ` Durée : ${durationLabel}.` : ""}`,
      flags: {
        add2e: {
          ...(reaction?.timingFlags ?? {}),
          tags,
          vadeRetro: {
            version: VERSION, casterId: caster.id, casterUuid: caster.uuid, casterName: caster.name,
            sourceClass: isPaladin ? "paladin" : "clerc", effectiveClericLevel: clericLevel,
            category: group.category, entry, outcome, direction: placement.direction,
            combatId: game.combat?.id ?? null, countFormula, count, reaction
          }
        }
      }
    };
    try {
      await createEffect(targetActor, effectData);
      if (destroy) await destroyTarget(targetActor);
      rows.push({ target: target.name ?? targetActor.name, result: outcome });
    } catch (error) {
      console.error("[ADD2E][VADE-RETRO][EFFECT]", { target: targetActor.name, error });
      rows.push({ target: target.name ?? targetActor.name, result: "Erreur d’application" });
    }
  }

  const status = pending.length ? "pending" : "complete";
  await saveCombatState({ ...stateBase, status, pending, attempted: { category: group.category, entry, countFormula, count, result: outcome, targets: affected.map(target => target.id) } });
  const reactionText = reaction?.rolled
    ? `<div><b>Réaction :</b> d100 ${reaction.rolled}${reaction.adjustment ? ` ${reaction.adjustment >= 0 ? "+" : ""}${reaction.adjustment}` : ""} = <b>${reaction.adjusted}</b> — ${esc(reaction.attitude)}.</div>`
    : "";
  const nextText = game.combat
    ? status === "pending" ? "Une tentative réussie peut être poursuivie au round suivant contre le type restant le plus faible." : "Aucune autre tentative n’est disponible dans ce combat."
    : "Hors combat, la durée et les suites de l’effet restent sous l’arbitrage du MJ.";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `<div class="add2e-chat-card" style="border:1.5px solid #c79b38;border-radius:12px;overflow:hidden;background:#fffaf0;box-shadow:0 3px 8px #0002;"><div style="background:linear-gradient(90deg,#765014,#c79b38);color:#fff;padding:8px 10px;display:flex;align-items:center;gap:8px;"><img src="${esc(caster.img || ICON)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #fff;"><div style="flex:1;"><div style="font-weight:800;">${esc(caster.name)}</div><div style="font-size:.88em;">Vade-rétro — niveau effectif ${clericLevel}${isPaladin ? ` (paladin niveau ${nativeLevel})` : ""}</div></div><img src="${ICON}" style="width:32px;height:32px;border-radius:4px;background:#fff;"></div><div style="padding:9px 10px;"><div style="padding:7px 8px;border:1px solid #e6cf86;border-radius:7px;background:#fffdf7;margin-bottom:7px;"><b>Cône :</b> ${CONE.angle}°, ${coneDistanceMeters()} ${esc(canvas.scene?.grid?.units || "m")}.<br><b>${esc(group.label)} :</b> ${automatic ? "résultat automatique" : `d20 ${d20.total} / ${esc(entry)}`} — <b>${esc(outcome)}</b>.<br><b>Nombre affecté :</b> ${countFormula} = <b>${count}</b>.${durationLabel ? `<br><b>Durée :</b> ${esc(durationLabel)}.` : ""}${reactionText}</div>${rows.map(row => `<div style="padding:5px 0;border-bottom:1px solid #ecd99c;"><b>${esc(row.target)}</b> — ${esc(row.result)}</div>`).join("")}<div style="margin-top:7px;font-size:.84em;color:#665121;">${nextText}</div></div></div>`
  });
  return true;
})();

if (__add2eVadeRetroResult !== true && __add2eVadeRetroResult !== false) {
  ui.notifications?.error?.("Vade-rétro : le script onUse n'a pas retourné true/false.");
  return false;
}
return __add2eVadeRetroResult;