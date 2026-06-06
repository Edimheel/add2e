/**
 * ADD2E — Détection du mal / Détection du bien
 * Version : 2026-06-02-detect-alignement-time-engine-v1
 *
 * Contrat onUse : true = sort lancé et consommé ; false = sort non consommé.
 */

console.log("%c[ADD2E][DETECTION_DU_MAL] 2026-06-02-detect-alignement-time-engine-v1", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (!DialogV2) {
    ui.notifications.error("Détection du mal : DialogV2 introuvable. Foundry V13/V14 requis.");
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
    warn: "#b88924",
    muted: "#6b5a35"
  };

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

  function chatStyleData() {
    return CONST.CHAT_MESSAGE_STYLES
      ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
      : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

  function sourceItemFromContext() {
    let sourceItem = null;
    if (typeof sort !== "undefined" && sort) sourceItem = sort;
    else if (typeof item !== "undefined" && item) sourceItem = item;
    else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;
    else if (typeof spell !== "undefined" && spell) sourceItem = spell;
    if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;
    return sourceItem;
  }

  function casterFromContext(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  }

  function casterTokenFor(caster) {
    return canvas.tokens?.controlled?.[0]
      ?? ((typeof token !== "undefined" && token) ? token : null)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  }

  function getLevel(actorDoc) {
    const candidates = [
      actorDoc?.system?.niveau,
      actorDoc?.system?.level,
      actorDoc?.system?.details?.niveau,
      actorDoc?.system?.details?.level,
      actorDoc?.system?.details_classe?.niveau
    ];
    for (const raw of candidates) {
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 1;
  }

  function durationRounds(level) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.toRounds?.("10+5*level", "round", { level }) ?? (10 + (5 * Math.max(1, Number(level) || 1)));
  }

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

  function unitToMeters(distance, unit) {
    const u = String(unit ?? "").toLowerCase();
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(u)) return distance * 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(u)) return distance * 0.9144;
    if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(u)) return distance * 1000;
    return distance;
  }

  function distanceMeters(a, b) {
    if (!a || !b) return 0;
    try {
      const gridSize = Number(canvas.grid?.size || canvas.scene?.grid?.size || 100) || 100;
      const gridDistance = Number(canvas.scene?.grid?.distance ?? 1) || 1;
      const gridUnits = canvas.scene?.grid?.units ?? "m";
      const dx = Number(a.center?.x ?? a.document?.x ?? 0) - Number(b.center?.x ?? b.document?.x ?? 0);
      const dy = Number(a.center?.y ?? a.document?.y ?? 0) - Number(b.center?.y ?? b.document?.y ?? 0);
      return unitToMeters((Math.hypot(dx, dy) / gridSize) * gridDistance, gridUnits);
    } catch (e) {
      console.warn("[ADD2E][DETECTION_DU_MAL][DISTANCE] mesure impossible", e);
      return 0;
    }
  }

  function collectTags(actorDoc) {
    const sys = actorDoc?.system ?? {};
    const flags = actorDoc?.flags?.add2e ?? {};
    const all = [];

    const push = value => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        for (const v of value) push(v);
        return;
      }
      if (typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
          if (v === true) all.push(k);
          else if (typeof v !== "object") all.push(`${k}:${v}`);
          else push(v);
        }
        return;
      }
      String(value).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(s => all.push(s));
    };

    push(sys.tags);
    push(sys.effectTags);
    push(sys.traits?.tags);
    push(sys.capacites_monstre);
    push(flags.tags);
    push(flags.monsterCapabilities);
    push(flags.effectTags);

    for (const item of actorDoc?.items ?? []) {
      push(item.system?.tags);
      push(item.flags?.add2e?.tags);
    }

    return [...new Set(all.map(norm).filter(Boolean))];
  }

  function alignmentText(actorDoc) {
    const sys = actorDoc?.system ?? {};
    const values = [
      sys.alignement,
      sys.alignment,
      sys.details?.alignement,
      sys.details?.alignment,
      sys.details_bio?.alignement,
      sys.profil?.alignement,
      sys.monstre?.alignement,
      sys.biographie?.alignement,
      actorDoc?.flags?.add2e?.alignement,
      actorDoc?.flags?.add2e?.alignment
    ];

    return values.filter(v => v !== undefined && v !== null && String(v).trim()).join(" ");
  }

  function detectedSide(actorDoc) {
    const a = norm(alignmentText(actorDoc));
    const tags = collectTags(actorDoc);

    const evil =
      a.includes("mauvais") ||
      a.includes("evil") ||
      tags.some(t => ["alignement:mauvais", "alignment:evil", "alignement:evil", "aura:mal", "detection:mal", "evil", "mauvais"].includes(t));

    const good =
      a.includes("bon") ||
      a.includes("good") ||
      tags.some(t => ["alignement:bon", "alignment:good", "alignement:good", "aura:bien", "detection:bien", "good", "bon"].includes(t));

    return { evil, good, alignmentNorm: a, tags };
  }

  function hitDiceOrLevel(actorDoc) {
    const sys = actorDoc?.system ?? {};
    const candidates = [sys.dv, sys.hitDice, sys.hit_dice, sys.des_de_vie, sys.niveau, sys.level, sys.details?.niveau, sys.details?.level];

    for (const raw of candidates) {
      if (raw === undefined || raw === null || raw === "") continue;
      const match = String(raw).match(/\d+(?:[.,]\d+)?/);
      if (!match) continue;
      const value = Number(match[0].replace(",", "."));
      if (Number.isFinite(value) && value > 0) return value;
    }

    return 1;
  }

  function auraDegree(actorDoc) {
    const hd = hitDiceOrLevel(actorDoc);
    const tags = collectTags(actorDoc);

    if (tags.some(t => ["extraplanaire", "demon", "diable", "fiend", "mort_vivant_majeur", "aura:extraordinaire"].includes(t))) {
      return { label: "extraordinaire", hd };
    }

    if (hd >= 11) return { label: "extraordinaire", hd };
    if (hd >= 5) return { label: "forte", hd };
    if (hd >= 2) return { label: "moyenne", hd };
    return { label: "faible", hd };
  }

  function tendency(actorDoc) {
    const a = norm(alignmentText(actorDoc));
    if (a.includes("loyal") || a.includes("lawful")) return "loyale";
    if (a.includes("chaotique") || a.includes("chaotic")) return "chaotique";
    if (a.includes("neutre") || a.includes("neutral")) return "neutre";
    return "indéterminée";
  }

  async function rollExtraordinaryTendency(casterLevel, actorDoc, degree) {
    if (degree.label !== "extraordinaire") return { applicable: false };
    const chance = Math.min(100, Math.max(0, casterLevel * 10));
    const roll = await new Roll("1d100").evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    return { applicable: true, chance, roll: roll.total, success: roll.total <= chance, tendency: tendency(actorDoc) };
  }

  function effectData({ name, sourceItem, caster, mode, direction, rounds }) {
    const isGood = mode === "bien";
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    const tags = [
      "sort:clerc",
      "niveau:1",
      "detection:alignement",
      isGood ? "detection:bien" : "detection:mal",
      isGood ? "aura:bien" : "aura:mal",
      isGood ? "reversible:detection_du_mal" : "reversible:detection_du_bien"
    ];
    const timeFlags = time?.flags?.({
      source: "detection-du-mal.js",
      rounds,
      unit: "round",
      endMessage: `La ${name.toLowerCase()} de {actor} prend fin.`,
      extra: {
        spellName: name,
        spellKey: mode === "bien" ? "detection_du_bien" : "detection_du_mal",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        mode,
        direction,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: `La ${name.toLowerCase()} de {actor} prend fin.` },
      endMessage: `La ${name.toLowerCase()} de {actor} prend fin.`,
      spellName: name,
      spellKey: mode === "bien" ? "detection_du_bien" : "detection_du_mal",
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      mode,
      direction,
      tags
    };

    return {
      name,
      img: sourceItem?.img || "systems/add2e/assets/icones/sorts/detection-du-mal.webp",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: `${name} : le lanceur détecte les émanations ${isGood ? "du bien" : "du mal"} dans la direction observée.`,
      flags: { add2e: { ...timeFlags, tags } },
      changes: []
    };
  }

  async function createOrRefreshEffect(caster, data) {
    const wantedMode = data.flags?.add2e?.mode;
    const existing = caster.effects.find(e =>
      e.name === data.name ||
      (e.flags?.add2e?.spellName === data.name) ||
      (e.flags?.add2e?.mode === wantedMode && ["mal", "bien"].includes(wantedMode))
    );

    if (existing) {
      await existing.update(data);
      return existing;
    }

    const created = await caster.createEmbeddedDocuments("ActiveEffect", [data]);
    return created?.[0] ?? null;
  }

  function tokenCandidates(casterToken, maxMeters) {
    return Array.from(canvas.tokens?.placeables ?? []).filter(t => {
      if (!t?.actor) return false;
      if (casterToken && t.id === casterToken.id) return false;
      if (t.document?.hidden && !game.user.isGM) return false;
      if (!casterToken) return true;
      return distanceMeters(casterToken, t) <= maxMeters;
    });
  }

  async function scanTokens({ caster, casterToken, mode, maxMeters }) {
    const casterLevel = getLevel(caster);
    const matches = [];
    const scanned = [];

    for (const tok of tokenCandidates(casterToken, maxMeters)) {
      const actorDoc = tok.actor;
      const side = detectedSide(actorDoc);
      const matched = mode === "bien" ? side.good : side.evil;
      scanned.push({ name: actorDoc.name, matched, alignment: alignmentText(actorDoc), tags: side.tags });
      if (!matched) continue;

      const degree = auraDegree(actorDoc);
      const tendencyRoll = await rollExtraordinaryTendency(casterLevel, actorDoc, degree);
      matches.push({ token: tok, actor: actorDoc, side, degree, tendencyRoll, distance: casterToken ? distanceMeters(casterToken, tok) : 0 });
    }

    console.log("[ADD2E][DETECTION_DU_MAL][SCAN]", { mode, maxMeters, scanned, matches });
    return matches;
  }

  function resultHtml({ mode, direction, matches, rounds }) {
    const sideLabel = mode === "bien" ? "bien" : "mal";
    const title = mode === "bien" ? "ÉMANATIONS DU BIEN" : "ÉMANATIONS DU MAL";

    const rows = matches.length
      ? matches.map(m => {
        const tendency = m.tendencyRoll?.applicable
          ? m.tendencyRoll.success
            ? ` — tendance ${esc(m.tendencyRoll.tendency)} (${m.tendencyRoll.roll}/${m.tendencyRoll.chance}%)`
            : ` — tendance non déterminée (${m.tendencyRoll.roll}/${m.tendencyRoll.chance}%)`
          : "";
        return `<li><b>${esc(m.actor.name)}</b> : aura ${esc(sideLabel)}, degré <b>${esc(m.degree.label)}</b>, nature générale : créature${tendency}${m.distance ? `, distance ${Math.round(m.distance)} m` : ""}</li>`;
      }).join("")
      : `<li>Aucune émanation du ${esc(sideLabel)} détectée.</li>`;

    return `
      <div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;color:${COLORS.dark};">
        <div style="text-align:center;font-weight:bold;color:${matches.length ? COLORS.success : COLORS.warn};">${title}</div>
        <div><b>Direction / zone :</b> ${esc(direction || "devant le lanceur")}</div>
        <div><b>Durée :</b> ${rounds} round(s)</div>
        <ul style="margin:6px 0 0 18px;">${rows}</ul>
      </div>`;
  }

  function ruleHtml(mode) {
    const side = mode === "bien" ? "bien" : "mal";
    const reverse = mode === "bien" ? "Détection du mal" : "Détection du bien";
    return `
      <div>Le sort détecte les émanations du ${esc(side)} provenant de créatures ou d’objets dans la direction observée.</div>
      <div>Il révèle le degré et la nature générale de l’émanation, mais pas une identité complète ni les pensées de la cible.</div>
      <div>Si l’émanation est extraordinaire, le script tente la tendance loyal/neutre/chaotique avec une chance de <b>10 % par niveau</b>.</div>
      <div>Version inverse : <b>${esc(reverse)}</b>.</div>`;
  }

  async function createChat({ caster, sourceItem, title, mode, direction, matches, rounds }) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
            <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div>
              <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(title)}</b></div>
            </div>
            <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
            <img src="${esc(sourceItem?.img || "systems/add2e/assets/icones/sorts/detection-du-mal.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="margin-bottom:6px;font-size:0.95em;color:${COLORS.dark};"><b>Cible :</b> ${esc(direction || "Direction / zone")}</div>
            ${resultHtml({ mode, direction, matches, rounds })}
            <details style="margin-top:8px;background:white;border:1px solid ${COLORS.border};border-radius:6px;">
              <summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:${COLORS.dark};">${ruleHtml(mode)}</div>
            </details>
          </div>
        </div>`,
      ...chatStyleData()
    });
  }

  const sourceItem = sourceItemFromContext();
  if (!sourceItem) {
    ui.notifications.error("Détection du mal : sort introuvable.");
    return false;
  }

  const caster = casterFromContext(sourceItem);
  if (!caster) {
    ui.notifications.error("Détection du mal : lanceur introuvable.");
    return false;
  }

  const casterToken = casterTokenFor(caster);
  const level = getLevel(caster);
  const rounds = durationRounds(level);
  const defaultRangeMeters = 110;

  const content = `
    <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
      <div class="form-group">
        <label style="font-weight:bold;">Mode :</label>
        <select name="mode" style="width:100%;">
          <option value="mal">Détection du mal</option>
          <option value="bien">Inverse : détection du bien</option>
        </select>
      </div>
      <div class="form-group">
        <label style="font-weight:bold;">Direction / zone observée :</label>
        <input type="text" name="direction" value="devant le lanceur" style="width:100%;">
      </div>
      <label style="display:flex;align-items:center;gap:6px;">
        <input type="checkbox" name="autoScan" checked>
        <span>Détecter les émanations présentes sur les tokens visibles.</span>
      </label>
      <div class="form-group">
        <label style="font-weight:bold;">Portée en mètres :</label>
        <input type="number" name="rangeMeters" value="${defaultRangeMeters}" min="1" step="1" style="width:100%;">
      </div>
    </form>`;

  const result = await DialogV2.wait({
    window: { title: "Lancement : Détection du mal" },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "systems/add2e/assets/icones/sorts/detection-du-mal.webp",
    content,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-eye",
        default: true,
        callback: (event, button) => ({
          mode: button.form.elements.mode?.value || "mal",
          direction: button.form.elements.direction?.value || "devant le lanceur",
          autoScan: !!button.form.elements.autoScan?.checked,
          rangeMeters: Number(button.form.elements.rangeMeters?.value || defaultRangeMeters)
        })
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });

  if (!result) return false;

  const mode = result.mode === "bien" ? "bien" : "mal";
  const title = mode === "bien" ? "Détection du bien" : "Détection du mal";
  const direction = String(result.direction || "devant le lanceur");
  const maxMeters = Math.max(1, Number(result.rangeMeters) || defaultRangeMeters);

  const data = effectData({ name: title, sourceItem, caster, mode, direction, rounds });
  await createOrRefreshEffect(caster, data);

  const matches = result.autoScan
    ? await scanTokens({ caster, casterToken, mode, maxMeters })
    : [];

  if (globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX) {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX(casterToken ?? caster, "detection");
  }

  await createChat({ caster, sourceItem, title, mode, direction, matches, rounds });

  console.log("[ADD2E][detection-du-mal.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", {
    script: "detection-du-mal.js",
    result: __add2eOnUseResult
  });
  ui.notifications?.error?.("Détection du mal : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
