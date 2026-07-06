// ADD2E — Capacité de classe : Vade-rétro
// Compatible Foundry V13 / V14 / V15.
// Contrat onUse : true = capacité utilisée ; false = annulée / non utilisée.

const __add2eVadeRetroResult = await (async () => {
  const VERSION = "2026-07-06-vade-retro-player-continuation-v11";
  const ICON = "icons/magic/holy/barrier-shield-winged-cross.webp";
  const CONE = Object.freeze({ angle: 90, cells: 3 });
  const CONTEXTS_FLAG = "__ADD2E_VADE_RETRO_CONTINUATION_CONTEXTS";
  const TABLE = Object.freeze({
    squelette: ["10", "7", "4", "T", "T", "D", "D", "D*", "D*", "D*"],
    zombie: ["13", "10", "7", "T", "T", "D", "D", "D", "D*", "D*"],
    goule: ["16", "13", "10", "4", "T", "T", "D", "D", "D", "D*"],
    ombre: ["19", "16", "13", "7", "4", "T", "T", "D", "D", "D*"],
    necrophage: ["20", "19", "16", "10", "7", "4", "T", "T", "D", "D"],
    ghast: [null, "20", "19", "13", "10", "7", "4", "T", "T", "D"],
    ame_en_peine: [null, null, "20", "16", "13", "10", "7", "4", "T", "D"],
    momie: [null, null, null, "20", "16", "13", "10", "7", "4", "T"],
    spectre: [null, null, null, null, "20", "16", "13", "10", "7", "T"],
    vampire: [null, null, null, null, null, "20", "16", "13", "10", "4"],
    fantome: [null, null, null, null, null, null, "20", "16", "13", "7"],
    liche: [null, null, null, null, null, null, null, "19", "16", "10"],
    special: [null, null, null, null, null, null, null, "20", "19", "13"]
  });
  const ORDER = Object.freeze(["squelette", "zombie", "goule", "ombre", "necrophage", "ghast", "ame_en_peine", "momie", "spectre", "vampire", "fantome", "liche", "special"]);
  const LABELS = Object.freeze({
    squelette: "Squelette", zombie: "Zombie", goule: "Goule", ombre: "Ombre", necrophage: "Nécrophage", ghast: "Ghast",
    ame_en_peine: "Âme en peine", momie: "Momie", spectre: "Spectre", vampire: "Vampire", fantome: "Fantôme", liche: "Liche",
    special: "Créature mauvaise des plans inférieurs"
  });
  const UNDEAD_TAGS = new Set(["type_mort_vivant", "type_monstre_mort_vivant", "creature_mort_vivant", "monstre_mort_vivant"]);
  const UNDEAD_ROWS = Object.freeze({
    squelette: "squelette", combattant_squelette: "squelette", squelette_animal: "squelette", squelette_geant: "squelette",
    zombie: "zombie", zombie_animal: "zombie", zombie_jaune: "zombie", zombie_juju: "zombie", zombie_monstre: "zombie",
    goule: "goule", goule_lacedon: "goule", ombre: "ombre", necrophage: "necrophage", ghast: "ghast", bleme: "ghast",
    ame_en_peine: "ame_en_peine", momie: "momie", spectre: "spectre", vampire: "vampire", banshee: "fantome", fantome: "fantome", liche: "liche"
  });
  const ORDER_INDEX = new Map(ORDER.map((key, index) => [key, index]));
  const UNDEAD_ALIASES = Object.keys(UNDEAD_ROWS).sort((left, right) => right.length - left.length);

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
  const evilCleric = norm(caster.system?.alignement ?? caster.system?.alignment ?? "").includes("mauvais");
  const featureKey = norm(source?.id ?? source?._id ?? source?.key ?? source?.slug ?? source?.name ?? source?.label ?? "vade_retro");
  const featureOnUse = String(source?.on_use ?? source?.onUse ?? source?.script ?? source?.macro ?? "").trim();

  async function postClassCard({ title = "Vade-rétro", lead = "", details = [], rows = [], footer = "" } = {}) {
    const shared = game.add2e?.postVadeRetroCard ?? globalThis.add2ePostVadeRetroCard;
    if (typeof shared === "function") {
      await shared(caster, { title, lead, details, rows: rows.map(row => ({ name: row.target ?? row.name, result: row.result })), footer });
      return;
    }
    const detailsHtml = details.filter(Boolean).map(detail => `<p>${detail}</p>`).join("");
    const rowsHtml = rows.length ? `<ul>${rows.map(row => `<li><b>${esc(row.target ?? row.name)}</b> : ${esc(row.result)}</li>`).join("")}</ul>` : "";
    const styles = globalThis.CONST?.CHAT_MESSAGE_STYLES;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      content: `<div class="add2e-chat-card add2e-class-ability"><h3>${esc(title)}</h3>${lead ? `<p>${lead}</p>` : ""}${detailsHtml}${rowsHtml}${footer ? `<p>${footer}</p>` : ""}</div>`,
      ...(styles?.OTHER !== undefined ? { style: styles.OTHER } : { type: globalThis.CONST?.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
    });
  }

  function metersPerGridCell() {
    const grid = canvas.scene?.grid ?? canvas.grid;
    const distance = Number(grid?.distance ?? 0);
    const units = String(grid?.units ?? "").trim().toLowerCase();
    if (distance > 0 && /^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return distance;
    if (distance > 0 && /^(ft|feet|foot|pied|pieds)$/.test(units)) return distance * .3048;
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
    return [target.center, { x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }, { x: x + width / 2, y }, { x: x + width / 2, y: y + height }, { x, y: y + height / 2 }, { x: x + width, y: y + height / 2 }].filter(Boolean);
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
    const sx = renderer.screen?.width ? renderer.screen.width / rect.width : 1;
    const sy = renderer.screen?.height ? renderer.screen.height / rect.height : 1;
    const point = new PIXI.Point((event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy);
    return canvas.stage?.worldTransform?.applyInverse(point) ?? null;
  }
  const foundryToCanvasRadians = rotation => (Number(rotation ?? 0) - 90) * Math.PI / 180;
  const canvasToFoundryRotation = radians => (radians * 180 / Math.PI + 90 + 360) % 360;
  function drawCone(overlay, direction) {
    const radius = coneDistanceMeters() / metersPerGridCell() * gridSizePx();
    const center = casterToken.center;
    const middle = foundryToCanvasRadians(direction);
    const half = CONE.angle * Math.PI / 360;
    const start = middle - half;
    const end = middle + half;
    overlay.clear();
    overlay.lineStyle(3, 0xc79b38, .95);
    overlay.beginFill(0xffe0a3, .30);
    overlay.moveTo(center.x, center.y);
    overlay.arc(center.x, center.y, radius, start, end);
    overlay.lineTo(center.x, center.y);
    overlay.endFill();
    overlay.lineStyle(2, 0xfff2c9, .95);
    overlay.moveTo(center.x, center.y);
    overlay.lineTo(center.x + Math.cos(start) * radius, center.y + Math.sin(start) * radius);
    overlay.moveTo(center.x, center.y);
    overlay.lineTo(center.x + Math.cos(end) * radius, center.y + Math.sin(end) * radius);
  }
  async function placeCone() {
    const view = canvas.app?.view;
    const parent = canvas.interface ?? canvas.controls ?? canvas.stage;
    if (!view || !parent || typeof PIXI === "undefined") return { direction: Number(casterToken.document?.rotation ?? 0) || 0 };
    clearRulerArtifacts();
    parent.getChildByName?.("add2e-vade-retro-cone-overlay")?.destroy({ children: true });
    const overlay = new PIXI.Graphics();
    overlay.name = "add2e-vade-retro-cone-overlay";
    overlay.zIndex = 100000;
    overlay.eventMode = "none";
    parent.sortableChildren = true;
    parent.addChild(overlay);
    ui.notifications.info("Vade-rétro : déplace la souris pour orienter le cône, clic gauche pour valider, clic droit ou Échap pour annuler.");
    const oldCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    let direction = Number(casterToken.document?.rotation ?? 0) || 0;
    drawCone(overlay, direction);
    return new Promise(resolve => {
      let done = false;
      const finish = (value, keep = false) => {
        if (done) return;
        done = true;
        view.removeEventListener("mousemove", onMove, true);
        view.removeEventListener("mousedown", onDown, true);
        view.removeEventListener("contextmenu", onContext, true);
        window.removeEventListener("keydown", onKey, true);
        view.style.cursor = oldCursor;
        clearRulerArtifacts();
        if (keep) window.setTimeout(() => { if (!overlay.destroyed) overlay.destroy({ children: true }); }, 2400);
        else if (!overlay.destroyed) overlay.destroy({ children: true });
        resolve(value);
      };
      const setDirection = event => {
        const point = browserEventToCanvasPoint(event);
        if (!point) return;
        direction = canvasToFoundryRotation(Math.atan2(point.y - casterToken.center.y, point.x - casterToken.center.x));
        drawCone(overlay, direction);
      };
      const onMove = event => setDirection(event);
      const onDown = event => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) return finish(null);
        if (event.button !== 0) return;
        setDirection(event);
        finish({ direction }, true);
      };
      const onContext = event => { event.preventDefault(); event.stopPropagation(); finish(null); };
      const onKey = event => { if (event.key === "Escape") { event.preventDefault(); finish(null); } };
      view.addEventListener("mousemove", onMove, true);
      view.addEventListener("mousedown", onDown, true);
      view.addEventListener("contextmenu", onContext, true);
      window.addEventListener("keydown", onKey, true);
    });
  }

  function actorTags(targetActor) { return new Set(flatten(targetActor?.system?.tags).map(norm).filter(Boolean)); }
  function actorEffectTags(targetActor) { return new Set(flatten(targetActor?.system?.effectTags).map(norm).filter(Boolean)); }
  function allActorTags(targetActor) { return new Set([...actorTags(targetActor), ...actorEffectTags(targetActor)]); }
  function actorText(targetActor) {
    const system = targetActor?.system ?? {};
    const values = flatten([targetActor?.name, system.type, system.type_monstre, system.type_creature, system.creatureType, system.sous_type, system.sousType, system.race]);
    for (const item of targetActor?.items ?? []) flatten([item?.name, item?.system?.label], values);
    return values.map(norm).filter(Boolean).join(" ");
  }
  function hasUndeadTag(targetActor) {
    const tags = allActorTags(targetActor);
    if ([...UNDEAD_TAGS].some(tag => tags.has(tag))) return true;
    const system = targetActor?.system ?? {};
    return [system.type, system.type_monstre, system.type_creature, system.creatureType, system.sous_type, system.sousType].map(norm).some(value => value === "mort_vivant" || value.endsWith("_mort_vivant"));
  }
  function targetHitDice(targetActor) {
    for (const value of [targetActor?.system?.dv, targetActor?.system?.hitDice, targetActor?.system?.hd, targetActor?.system?.des_de_vie, targetActor?.system?.niveau, targetActor?.system?.level]) {
      const parsed = numberFrom(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }
  function effectiveHitDice(targetActor) {
    const raw = String(targetActor?.system?.dv ?? targetActor?.system?.hitDice ?? targetActor?.system?.hd ?? "");
    const plus = raw.match(/(\d+)\s*\+\s*(\d+)/);
    return plus ? Number(plus[1]) + Math.floor(Number(plus[2]) / 3) : targetHitDice(targetActor);
  }
  function targetArmorClass(targetActor) {
    const system = targetActor?.system ?? {};
    const values = [system.armorClass, system.ca_naturel, system.ca, system.ac, system.ca_total].map(numberFrom).filter(Number.isFinite);
    return values.length ? Math.min(...values) : NaN;
  }
  function targetMagicResistance(targetActor) {
    const system = targetActor?.system ?? {};
    return numberFrom(system.resistance_magie ?? system.resistanceMagie ?? system.magicResistance ?? system.rm ?? system.mr);
  }
  function undeadProfile(targetActor) {
    const tags = allActorTags(targetActor);
    const energyDrain = tags.has("attaque_drain_energie");
    return { hitDice: effectiveHitDice(targetActor), armorClass: targetArmorClass(targetActor), magicResistance: targetMagicResistance(targetActor), drain: energyDrain || tags.has("attaque_drain"), energyDrain };
  }
  function extrapolateUndeadCategory(targetActor) {
    const profile = undeadProfile(targetActor);
    const hd = Number(profile.hitDice) || 0;
    if ((Number.isFinite(profile.magicResistance) && profile.magicResistance >= 66) || (Number.isFinite(profile.armorClass) && profile.armorClass <= -5) || hd >= 11) return { category: "liche", mode: "extrapole", profile };
    if (profile.energyDrain || profile.drain) {
      if (hd >= 10) return { category: "vampire", mode: "extrapole", profile };
      if (hd >= 7) return { category: "spectre", mode: "extrapole", profile };
      if (hd >= 5) return { category: "necrophage", mode: "extrapole", profile };
      return { category: "ame_en_peine", mode: "extrapole", profile };
    }
    if (hd >= 9) return { category: "vampire", mode: "extrapole", profile };
    if (hd >= 7) return { category: "fantome", mode: "extrapole", profile };
    if (hd >= 6) return { category: "momie", mode: "extrapole", profile };
    if (hd >= 5) return { category: "spectre", mode: "extrapole", profile };
    if (hd >= 4) return { category: "ame_en_peine", mode: "extrapole", profile };
    if (hd >= 3) return { category: "ghast", mode: "extrapole", profile };
    if (hd >= 2) return { category: "goule", mode: "extrapole", profile };
    return { category: "zombie", mode: "extrapole", profile };
  }
  function undeadCategoryInfo(targetActor) {
    const system = targetActor?.system ?? {};
    const direct = [system.vadeRetroCategory, system.type_monstre, system.sous_type, system.sousType, system.type_creature, system.creatureType].map(norm).find(key => UNDEAD_ROWS[key]);
    if (direct) return { category: UNDEAD_ROWS[direct], mode: "canonique", profile: null };
    const matched = UNDEAD_ALIASES.find(alias => actorText(targetActor).includes(alias));
    if (matched) return { category: UNDEAD_ROWS[matched], mode: "canonique", profile: null };
    return extrapolateUndeadCategory(targetActor);
  }
  function specialEligible(targetActor) {
    const armorClass = targetArmorClass(targetActor);
    const hitDice = targetHitDice(targetActor);
    const resistance = targetMagicResistance(targetActor);
    return !(Number.isFinite(armorClass) && armorClass <= -5) && !(Number.isFinite(hitDice) && hitDice >= 11) && !(Number.isFinite(resistance) && resistance >= 66);
  }
  function paladinRow(targetActor) {
    const level = Math.max(1, Math.floor(numberFrom(targetActor?.system?.niveau ?? targetActor?.system?.level) || 1));
    return level <= 2 ? "momie" : level <= 4 ? "spectre" : level <= 6 ? "vampire" : level <= 8 ? "fantome" : level <= 10 ? "liche" : "special";
  }
  function categoryFor(target) {
    const targetActor = target?.actor;
    if (!targetActor) return null;
    const text = actorText(targetActor);
    if (evilCleric && norm(targetActor.type) === "personnage" && text.includes("paladin")) {
      const category = paladinRow(targetActor);
      return { category, label: `Paladin niveau ${Math.max(1, Math.floor(numberFrom(targetActor.system?.niveau ?? targetActor.system?.level) || 1))}`, kind: "paladin", lowerPlane: false, classification: { mode: "paladin" } };
    }
    if (hasUndeadTag(targetActor)) {
      const resolved = undeadCategoryInfo(targetActor);
      return { category: resolved.category, label: LABELS[resolved.category], kind: "mort-vivant", lowerPlane: false, classification: resolved };
    }
    const lowerPlane = ["demon", "diable", "devil", "daemon", "mezzodaemon", "sorciere_des_tenebres", "plan_inferieur", "plans_inferieurs"].some(word => text.includes(word));
    return lowerPlane && specialEligible(targetActor) ? { category: "special", label: LABELS.special, kind: "plan inférieur", lowerPlane: true, classification: { mode: "plan_inferieur" } } : null;
  }
  function tableEntry(group) { return TABLE[group?.category]?.[column] ?? null; }
  function minimumEffectiveLevel(category) {
    const row = TABLE[category] ?? [];
    const first = row.findIndex(value => value !== null && value !== undefined);
    return first < 0 ? null : first <= 7 ? first + 1 : first === 8 ? 9 : 14;
  }
  function diagnostics(tokens) {
    return tokens.map(target => {
      const info = categoryFor(target);
      if (!info) return null;
      const profile = info.classification?.profile ?? null;
      const entry = TABLE[info.category]?.[column] ?? null;
      return { token: target.name ?? target.actor?.name ?? "—", typeMonstre: target.actor?.system?.type_monstre ?? "—", ligne: LABELS[info.category] ?? info.category, classification: info.classification?.mode ?? "—", dv: profile?.hitDice ?? targetHitDice(target.actor), ca: profile?.armorClass ?? targetArmorClass(target.actor), rm: profile?.magicResistance ?? targetMagicResistance(target.actor), drain: profile?.drain ?? false, entree_table: entry ?? "—", niveau_effectif_minimum: entry === null ? minimumEffectiveLevel(info.category) : null };
    }).filter(Boolean);
  }
  function diagnosticText(rows) {
    return rows.slice(0, 4).map(row => {
      const extra = row.classification === "extrapole" ? " extrapolée" : "";
      if (row.entree_table === "—") return `${row.token} — ligne ${row.ligne}${extra} : non affectable avant niveau effectif ${row.niveau_effectif_minimum ?? "—"}`;
      return /^[TD]/.test(String(row.entree_table)) ? `${row.token} — ligne ${row.ligne}${extra} : résultat automatique` : `${row.token} — ligne ${row.ligne}${extra} : score requis ${row.entree_table}`;
    }).join(" • ");
  }
  function resolveToken(id) { return canvas.tokens?.get?.(id) ?? canvas.tokens?.placeables?.find(target => target?.id === id || target?.document?.id === id) ?? null; }
  function groupsFrom(tokens) {
    const groups = new Map();
    for (const target of tokens) {
      const info = categoryFor(target);
      if (!info || !tableEntry(info)) continue;
      const key = `${info.kind}|${info.category}`;
      const group = groups.get(key) ?? { key, category: info.category, kind: info.kind, label: info.label, lowerPlane: info.lowerPlane, ids: [], extrapolated: false, profiles: [] };
      group.ids.push(target.id);
      if (info.classification?.mode === "extrapole") {
        group.extrapolated = true;
        group.profiles.push({ name: target.name ?? target.actor?.name ?? "", typeMonstre: target.actor?.system?.type_monstre ?? "", ...info.classification.profile });
      }
      groups.set(key, group);
    }
    return [...groups.values()].sort((left, right) => (ORDER_INDEX.get(left.category) ?? 999) - (ORDER_INDEX.get(right.category) ?? 999));
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
  function hpPath(targetActor) {
    const system = targetActor?.system ?? {};
    if (system.pdv !== undefined) return "system.pdv";
    if (system.pv?.value !== undefined) return "system.pv.value";
    if (system.hp?.value !== undefined) return "system.hp.value";
    if (system.points_de_coup !== undefined) return "system.points_de_coup";
    return "system.pdv";
  }
  async function moveAwayThroughGm(target) {
    const forceFlee = game.add2e?.forceFleeToken ?? globalThis.add2eForceFleeToken;
    if (typeof forceFlee !== "function") return { moved: false, requested: false, fatal: true, reason: "Moteur de fuite ADD2E indisponible." };
    return forceFlee({ sourceToken: casterToken, targetToken: target, actor: target?.actor, reason: "vade-retro-initial-flee", flagKey: "vadeRetroForcedMove", allowGridFallback: true, currentRound: Number(game.combat?.round ?? 0) || null });
  }

  const prior = combatState();
  const currentRound = Number(game.combat?.round ?? 0) || 0;
  const continuationContexts = globalThis[CONTEXTS_FLAG];
  const continuationContext = continuationContexts?.get?.(`${caster.id}:${game.combat?.id ?? ""}`) ?? null;
  const isPlayerContinuation = continuationContext?.kind === "vade-retro-continuation"
    && String(continuationContext.actorId ?? "") === String(caster.id)
    && String(continuationContext.combatId ?? "") === String(game.combat?.id ?? "")
    && Number(continuationContext.round ?? NaN) === currentRound
    && String(continuationContext.initiatorUserId ?? "") === String(game.user?.id ?? "");
  if (prior?.status === "closed" || prior?.status === "complete") {
    ui.notifications.warn("Vade-rétro a déjà été résolu pour ce combat.");
    return false;
  }
  if (isPlayerContinuation && (!prior || prior.status !== "pending" || Number(prior.lastRound ?? currentRound) >= currentRound)) return false;
  if (prior?.status === "pending" && !isPlayerContinuation) {
    ui.notifications.warn("Vade-rétro : la tentative suivante est automatique au round suivant.");
    return false;
  }
  const placement = isPlayerContinuation
    ? { direction: Number(prior?.direction ?? casterToken.document?.rotation ?? 0) || 0 }
    : await placeCone();
  if (!placement) {
    ui.notifications.info("Vade-rétro : tentative annulée.");
    return false;
  }
  const targetsInCone = isPlayerContinuation
    ? []
    : Array.from(canvas.tokens?.placeables ?? [])
      .filter(target => target?.visible !== false && target?.actor && target.id !== casterToken.id && target.actor.id !== caster.id)
      .filter(target => tokenInCone(target, placement.direction));
  const queue = Array.isArray(prior?.pending) ? prior.pending : groupsFrom(targetsInCone);
  const group = queue[0] ?? null;
  if (!group) {
    if (!targetsInCone.length) ui.notifications.warn("Vade-rétro : aucun token adverse n’est dans le cône validé.");
    else {
      const rows = diagnostics(targetsInCone);
      if (rows.length) {
        console.table(rows);
        ui.notifications.warn(`Vade-rétro : ${rows.length} cible(s) reconnue(s) dans le cône. ${diagnosticText(rows)}.`);
      } else ui.notifications.warn(`Vade-rétro : ${targetsInCone.length} token(s) dans le cône, mais aucun mort-vivant ni adversaire des plans inférieurs affectable.`);
    }
    return false;
  }
  const groupTargets = group.ids.map(resolveToken)
    .filter(target => target?.actor && (isPlayerContinuation || tokenInCone(target, placement.direction)))
    .sort((left, right) => String(left.name ?? left.actor?.name).localeCompare(String(right.name ?? right.actor?.name), "fr"));
  if (!groupTargets.length) {
    ui.notifications.warn(`Vade-rétro : aucun ${group.label.toLowerCase()} de la tentative en cours n’est dans le cône.`);
    return false;
  }
  const entry = tableEntry(group);
  const automatic = /^[TD]/.test(String(entry));
  const d20 = automatic ? null : await roll("1d20");
  const success = automatic || Number(d20.total) >= Number(entry);
  const stateBase = {
    version: VERSION,
    status: "",
    combatId: game.combat?.id ?? null,
    casterUuid: caster.uuid,
    sourceClass: isPaladin ? "paladin" : "clerc",
    effectiveClericLevel: clericLevel,
    initiatorUserId: prior?.initiatorUserId ?? game.user?.id ?? null,
    featureKey: prior?.featureKey ?? featureKey,
    featureOnUse: prior?.featureOnUse ?? featureOnUse,
    lastRound: currentRound,
    direction: placement.direction,
    cone: { angle: CONE.angle, distance: coneDistanceMeters(), units: canvas.scene?.grid?.units ?? "m" },
    updatedAt: Date.now()
  };
  if (!success) {
    await saveCombatState({ ...stateBase, status: "closed", reason: "failed", pending: [] });
    await postClassCard({ lead: `<b>${esc(caster.name)}</b> présente son symbole sacré.`, details: [`<b>Échec :</b> ${esc(group.label)} — d20 = <b>${d20.total}</b>, score requis <b>${esc(entry)}</b>.`], footer: "Aucune autre tentative n’est possible dans ce combat." });
    return true;
  }
  const countFormula = group.lowerPlane ? "1d2" : String(entry).endsWith("*") ? "1d6+6" : "1d12";
  const count = Math.max(1, Number((await roll(countFormula)).total) || 1);
  const affected = groupTargets.slice(0, count);
  const remainder = groupTargets.slice(count).map(target => target.id);
  const pending = [...(remainder.length ? [{ ...group, ids: remainder }] : []), ...queue.slice(1)];
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const createEffect = async (targetActor, effectData) => {
    if (game.user?.isGM || targetActor?.isOwner) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    game.socket?.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: targetActor.uuid, actorId: targetActor.id, effectData, fromUserId: game.user?.id, sentAt: Date.now() } });
    return !!game.socket;
  };
  const destroyTarget = async targetActor => {
    if (game.user?.isGM || targetActor?.isOwner) {
      await targetActor.update({ [hpPath(targetActor)]: 0 }, { add2eReason: "vade-retro-destruction" });
      return true;
    }
    const current = [targetActor?.system?.pdv, targetActor?.system?.pv?.value, targetActor?.system?.hp?.value].map(numberFrom).find(Number.isFinite) ?? 1;
    game.socket?.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "applyDamage", payload: { actorUuid: targetActor.uuid, actorId: targetActor.id, montant: Math.max(1, current), type: "vade-retro", details: "Vade-rétro — destruction / damnation" } });
    return !!game.socket;
  };
  const timedRounds = rounds => {
    const extra = { source: "vade-retro.js", rounds, unit: "round", endMessage: "L’effet de Vade-rétro sur {actor} prend fin." };
    return { duration: time?.durationData?.(rounds) ?? { rounds, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null }, flags: time?.flags?.(extra) ?? { timeEngine: { managed: true, unit: "round", totalRounds: rounds }, roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: extra.endMessage }, endMessage: extra.endMessage } };
  };
  const destroy = String(entry).startsWith("D") && !evilCleric;
  const dominate = String(entry).startsWith("D") && evilCleric;
  let outcome = "";
  let effectName = "";
  let effectDuration = {};
  let durationLabel = "";
  let effectTags = [];
  let extraFlags = {};
  let reaction = null;
  if (destroy) {
    outcome = "Détruit / damné";
    effectName = "Détruit par Vade-rétro";
    effectTags = ["vade_retro", "etat:detruit_vade_retro", `vade_retro:${group.category}`];
  } else if (dominate) {
    outcome = "Dominé";
    effectName = "Dominé par Vade-rétro";
    effectDuration = { startTime: game.time?.worldTime ?? null, seconds: 518400 };
    durationLabel = "6 jours (renouvellement requis)";
    effectTags = ["vade_retro", "etat:domine_vade_retro", "controle:clerc", `vade_retro:${group.category}`];
  } else if (evilCleric) {
    const threshold = String(entry).startsWith("T") ? null : Number(entry);
    const reactionRoll = await roll("1d100");
    const adjustment = Number(caster.system?.cha_react ?? 0) || 0;
    const total = Number(reactionRoll.total) + adjustment;
    const attitude = total >= 56 ? "Amical" : "Neutre";
    const hours = String(entry).startsWith("T") ? 24 : Math.max(1, 24 - threshold);
    outcome = `Influencé — ${attitude.toLowerCase()}`;
    effectName = `Influencé par Vade-rétro — ${attitude}`;
    effectDuration = { startTime: game.time?.worldTime ?? null, seconds: hours * 3600 };
    durationLabel = `${hours} heure${hours > 1 ? "s" : ""}`;
    effectTags = ["vade_retro", "etat:influence_vade_retro", "controle:clerc", `attitude:${norm(attitude)}`, `vade_retro:${group.category}`];
    reaction = { rolled: reactionRoll.total, adjustment, adjusted: total, attitude };
  } else {
    const rounds = Math.max(3, Number((await roll("3d4")).total) || 3);
    const timed = timedRounds(rounds);
    outcome = "Repoussé";
    effectName = "Repoussé par Vade-rétro";
    effectDuration = timed.duration;
    durationLabel = `${rounds} rounds`;
    extraFlags = timed.flags;
    effectTags = ["vade_retro", "etat:repousse_vade_retro", "interdiction:attaque", "interdiction:sort", "mouvement:eloignement_obligatoire", "fuite", `vade_retro:${group.category}`];
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
      flags: { add2e: { ...extraFlags, tags: effectTags, vadeRetro: { version: VERSION, casterId: caster.id, casterUuid: caster.uuid, casterName: caster.name, effectiveClericLevel: clericLevel, category: group.category, classification: group.extrapolated ? "extrapole" : "canonique", profiles: group.extrapolated ? group.profiles : [], entry, outcome, direction: placement.direction, combatId: game.combat?.id ?? null, countFormula, count, reaction } } }
    };
    try {
      await createEffect(targetActor, effectData);
      if (destroy) await destroyTarget(targetActor);
      if (outcome === "Repoussé") {
        const flee = await moveAwayThroughGm(target);
        if (flee?.fatal) console.warn("[ADD2E][VADE-RETRO][FLEE]", { target: targetActor.name, reason: flee.reason });
      }
      rows.push({ target: target.name ?? targetActor.name, result: outcome });
    } catch (error) {
      console.error("[ADD2E][VADE-RETRO][EFFECT]", { target: targetActor.name, error });
      rows.push({ target: target.name ?? targetActor.name, result: "Erreur d’application" });
    }
  }
  const status = pending.length ? "pending" : "complete";
  await saveCombatState({ ...stateBase, status, pending, attempted: { category: group.category, classification: group.extrapolated ? "extrapole" : "canonique", profiles: group.extrapolated ? group.profiles : [], entry, countFormula, count, result: outcome, targets: affected.map(target => target.id) } });
  const resultText = automatic ? "résultat automatique" : `d20 ${d20.total} / ${entry}`;
  const continuation = game.combat ? (status === "pending" ? "Vade-rétro continuera automatiquement au round suivant contre le type restant le plus faible." : "La séquence de Vade-rétro est terminée.") : "Hors combat, le MD arbitre la poursuite éventuelle.";
  const details = [
    `<b>Cône :</b> ${CONE.angle}°, ${coneDistanceMeters()} ${esc(canvas.scene?.grid?.units || "m")}.`,
    `<b>${esc(group.label)} :</b> ${esc(resultText)} — <b>${esc(outcome)}</b>.`,
    `<b>Nombre affecté :</b> ${esc(countFormula)} = <b>${count}</b>.`,
    durationLabel ? `<b>Durée :</b> ${esc(durationLabel)}.` : "",
    reaction?.rolled ? `<b>Réaction :</b> d100 ${reaction.rolled}${reaction.adjustment ? ` ${reaction.adjustment >= 0 ? "+" : ""}${reaction.adjustment}` : ""} = <b>${reaction.adjusted}</b> — ${esc(reaction.attitude)}.` : "",
    group.extrapolated ? "Classement extrapolé depuis les DV et les propriétés mécaniques." : ""
  ];
  await postClassCard({ lead: `<b>${esc(caster.name)}</b> présente son symbole sacré.`, details, rows, footer: continuation });
  return true;
})();

if (__add2eVadeRetroResult !== true && __add2eVadeRetroResult !== false) {
  ui.notifications?.error?.("Vade-rétro : le script onUse n'a pas retourné true/false.");
  return false;
}
return __add2eVadeRetroResult;
