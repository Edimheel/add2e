/**
 * ADD2E — Détection du mal / Détection du bien
 * Chaque item mémorisé lance sa propre version, sans choix au lancement.
 */

const __add2eOnUseResult = await (async () => {
  const normalize = value => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem) {
    ui.notifications.error("Détection du mal / Détection du bien : sort introuvable.");
    return false;
  }

  const keys = [
    sourceItem.name,
    sourceItem.system?.nom,
    sourceItem.flags?.add2e?.reversibleActorEntry?.mode,
    sourceItem.flags?.add2e?.spellFamily?.kind,
    sourceItem.flags?.add2e?.spellFamily?.reversibleMode
  ].map(normalize);
  const isGood = keys.some(key => ["detection_du_bien", "bien", "inverse"].includes(key));
  const isEvil = keys.some(key => ["detection_du_mal", "mal", "normal", "base"].includes(key));
  if (isGood === isEvil) {
    ui.notifications.error(`Détection du mal / Détection du bien : impossible d’identifier l’item lancé (« ${sourceItem.name ?? "sans nom"} »).`);
    return false;
  }

  const mode = isGood ? "bien" : "mal";
  const spellName = isGood ? "Détection du bien" : "Détection du mal";
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc.actor?.id === caster?.id) ?? caster?.getActiveTokens?.()[0] ?? null;
  if (!caster || !casterToken) {
    ui.notifications.warn(`${spellName} : le lanceur doit être présent sur la scène.`);
    return false;
  }

  const level = Number(caster.system?.details_classe?.clerc?.niveau ?? caster.system?.niveau ?? caster.system?.level ?? 1) || 1;
  const rounds = 10 + (5 * Math.max(1, level));
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const duration = time?.durationData?.(rounds) ?? { rounds, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null };
  const spellKey = isGood ? "detection_du_bien" : "detection_du_mal";
  const tags = ["sort:clerc", "niveau:1", "detection:alignement", isGood ? "detection:bien" : "detection:mal", isGood ? "aura:bien" : "aura:mal"];
  const timeFlags = time?.flags?.({
    source: "detection-du-mal.js",
    rounds,
    unit: "round",
    endMessage: `La ${spellName.toLowerCase()} de {actor} prend fin.`,
    extra: { spellName, spellKey, mode, sourceItemUuid: sourceItem.uuid, casterId: caster.id, casterUuid: caster.uuid, direction: "devant le lanceur", tags }
  }) ?? {};
  const effectData = {
    name: spellName,
    img: sourceItem.img || "systems/add2e/assets/icones/sorts/detection-du-mal.webp",
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration,
    description: `${spellName} : détection dans la zone devant le lanceur.`,
    flags: { add2e: { ...timeFlags, spellName, spellKey, mode, sourceItemUuid: sourceItem.uuid, casterId: caster.id, casterUuid: caster.uuid, direction: "devant le lanceur", tags } },
    changes: []
  };
  const previous = Array.from(caster.effects ?? []).find(effect => effect.flags?.add2e?.spellKey === spellKey || effect.name === spellName);
  if (previous) await previous.update(effectData);
  else await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
  const gridDistance = Number(canvas.scene?.grid?.distance ?? 1) || 1;
  const unit = String(canvas.scene?.grid?.units ?? "m").toLowerCase();
  const toMeters = value => ["ft", "feet", "foot", "pied", "pieds", "pi"].includes(unit) ? value * 0.3048 : ["yd", "yard", "yards", "verge", "verges"].includes(unit) ? value * 0.9144 : value;
  const pixelsForMeters = meters => (meters / (toMeters(1) || 1) / gridDistance) * gridSize;
  const rangePixels = pixelsForMeters(110);
  const halfWidthPixels = pixelsForMeters(110 / 12) / 2;
  const rotation = Number(casterToken.document?.rotation ?? casterToken.rotation ?? 0) || 0;
  const radians = (rotation * Math.PI / 180) - (Math.PI / 2);
  const forward = { x: Math.cos(radians), y: Math.sin(radians) };
  const right = { x: -forward.y, y: forward.x };
  const origin = casterToken.center;

  const extract = (value, out = []) => {
    if (value === undefined || value === null) return out;
    if (Array.isArray(value)) { value.forEach(entry => extract(entry, out)); return out; }
    if (typeof value === "object") { Object.entries(value).forEach(([key, entry]) => entry === true ? out.push(key) : typeof entry === "object" ? extract(entry, out) : out.push(`${key}:${entry}`)); return out; }
    String(value).split(/[,;\n]+/).map(entry => entry.trim()).filter(Boolean).forEach(entry => out.push(entry));
    return out;
  };
  const targetTags = targetActor => {
    const values = extract([targetActor.system?.tags, targetActor.system?.effectTags, targetActor.flags?.add2e?.tags, targetActor.flags?.add2e?.effectTags]);
    for (const targetItem of targetActor.items ?? []) extract([targetItem.system?.tags, targetItem.flags?.add2e?.tags], values);
    return values.map(normalize);
  };
  const isDetected = targetActor => {
    const alignment = normalize([targetActor.system?.alignement, targetActor.system?.alignment, targetActor.system?.details?.alignement, targetActor.flags?.add2e?.alignement].filter(Boolean).join(" "));
    const tagsForTarget = targetTags(targetActor);
    return isGood
      ? alignment.includes("bon") || alignment.includes("good") || tagsForTarget.some(tag => ["alignement:bon", "alignment:good", "aura:bien", "detection:bien", "bon", "good"].includes(tag))
      : alignment.includes("mauvais") || alignment.includes("evil") || tagsForTarget.some(tag => ["alignement:mauvais", "alignment:evil", "aura:mal", "detection:mal", "mauvais", "evil"].includes(tag));
  };
  const degree = targetActor => {
    const hitDice = Number(String(targetActor.system?.dv ?? targetActor.system?.des_de_vie ?? targetActor.system?.niveau ?? targetActor.system?.level ?? 1).match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".")) || 1;
    if (hitDice >= 11) return "extraordinaire";
    if (hitDice >= 5) return "forte";
    if (hitDice >= 2) return "moyenne";
    return "faible";
  };

  const matches = [];
  for (const targetToken of canvas.tokens?.placeables ?? []) {
    if (!targetToken?.actor || targetToken.id === casterToken.id || (targetToken.document?.hidden && !game.user.isGM)) continue;
    const dx = targetToken.center.x - origin.x;
    const dy = targetToken.center.y - origin.y;
    const forwardDistance = (dx * forward.x) + (dy * forward.y);
    const sideDistance = Math.abs((dx * right.x) + (dy * right.y));
    if (forwardDistance < 0 || forwardDistance > rangePixels || sideDistance > halfWidthPixels || !isDetected(targetToken.actor)) continue;
    matches.push({ name: targetToken.actor.name, degree: degree(targetToken.actor) });
  }

  const sideLabel = isGood ? "bien" : "mal";
  const title = isGood ? "ÉMANATIONS DU BIEN" : "ÉMANATIONS DU MAL";
  const rows = matches.length ? matches.map(match => `<li><b>${escapeHtml(match.name)}</b> : aura ${sideLabel}, degré <b>${escapeHtml(match.degree)}</b></li>`).join("") : `<li>Aucune émanation du ${sideLabel} détectée dans la zone.</li>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="add2e-spell-card add2e-spell-card-clerc"><h3>${escapeHtml(spellName)}</h3><p><b>Direction :</b> devant le lanceur</p><p><b>Zone :</b> 12&quot; de long × 1&quot; de large.</p><p><b>Durée :</b> ${rounds} rounds.</p><div><b>${title}</b><ul>${rows}</ul></div></div>`,
    ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
  });

  try { await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(casterToken, "detection"); }
  catch (_error) {}
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Détection du mal / Détection du bien : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
