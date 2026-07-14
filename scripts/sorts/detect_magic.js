// ADD2E — Détection de la magie — Clerc niveau 1
// Version : 2026-07-14-detection-objets-magiques-v2
// Retour attendu : true = sort consommé, false = sort non consommé.

console.log("%c[ADD2E][DETECTION_MAGIE][CLERC] 2026-07-14-detection-objets-magiques-v2", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const chatStyleData = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  const sourceItem =
    ((typeof sort !== "undefined" && sort) ? sort : null)
    ?? ((typeof item !== "undefined" && item) ? item : null)
    ?? ((typeof this !== "undefined" && this?.documentName === "Item") ? this : null)
    ?? ((typeof args !== "undefined" && args?.[0]?.item) ? args[0].item : null);

  if (!sourceItem) {
    ui.notifications.error("Détection de la magie : sort introuvable.");
    return false;
  }

  const caster =
    ((typeof actor !== "undefined" && actor) ? actor : null)
    ?? sourceItem.parent
    ?? null;

  if (!caster) {
    ui.notifications.error("Détection de la magie : lanceur introuvable.");
    return false;
  }

  const casterToken =
    canvas.tokens?.controlled?.find?.(controlled => controlled.actor?.id === caster.id)
    ?? ((typeof token !== "undefined" && token) ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const isMagicItem = candidate => {
    const sys = candidate?.system ?? {};
    const flags = candidate?.flags?.add2e ?? {};
    const tags = [
      ...(Array.isArray(sys.tags) ? sys.tags : []),
      ...(Array.isArray(sys.effectTags) ? sys.effectTags : [])
    ].map(value => String(value ?? "").toLowerCase());

    return sys.magique === true
      || sys.magic === true
      || flags.isMagicItem === true
      || String(sys.categorie ?? "").toLowerCase() === "objet_magique"
      || tags.some(tag => tag.includes("objet_magique") || tag.includes("magique"));
  };

  const isIdentified = candidate => candidate?.system?.identifie === true
    || candidate?.system?.identified === true
    || candidate?.getFlag?.("add2e", "identified") === true;

  const detectedName = candidate => {
    if (isIdentified(candidate)) return String(candidate?.system?.nom ?? candidate?.name ?? "Objet magique");
    return String(
      candidate?.system?.nom_non_identifie
      ?? candidate?.system?.unidentifiedName
      ?? candidate?.system?.sousType
      ?? "Objet magique"
    );
  };

  const detectionStrength = candidate => {
    const sys = candidate?.system ?? {};
    const explicit = String(sys.intensite_magique ?? sys.magicIntensity ?? "").trim();
    if (explicit) return explicit;

    const rarity = String(sys.rarete ?? "").toLowerCase();
    if (["très rare", "tres rare", "légendaire", "legendaire", "artefact"].includes(rarity)) return "forte";
    return "faible";
  };

  const actorsToInspect = new Map([[caster.id, caster]]);
  for (const targetedToken of Array.from(game.user.targets ?? [])) {
    if (targetedToken?.actor?.id) actorsToInspect.set(targetedToken.actor.id, targetedToken.actor);
  }

  const detections = [];
  for (const inspectedActor of actorsToInspect.values()) {
    const magicItems = (inspectedActor.items?.contents ?? Array.from(inspectedActor.items ?? []))
      .filter(isMagicItem)
      .map(candidate => ({
        id: candidate.id,
        owner: inspectedActor.name,
        ownerId: inspectedActor.id,
        name: detectedName(candidate),
        identified: isIdentified(candidate),
        strength: detectionStrength(candidate),
        img: candidate.img || "icons/svg/item-bag.svg"
      }));

    detections.push(...magicItems);
  }

  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const durationRounds = time?.toRounds?.(1, "tour") ?? 10;
  const durationData = time?.durationData?.(durationRounds) ?? {
    rounds: durationRounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time.worldTime,
    combat: game.combat?.id ?? null
  };
  const timeFlags = time?.flags?.({
    source: "detect_magic.js",
    rounds: durationRounds,
    unit: "round",
    endMessage: "La détection de la magie de {actor} se dissipe."
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: durationRounds },
    roundEngine: { managed: true, unit: "round", totalRounds: durationRounds, endMessage: "La détection de la magie de {actor} se dissipe." },
    endMessage: "La détection de la magie de {actor} se dissipe."
  };

  const effectIcon = sourceItem.img || "systems/add2e/assets/icones/sorts/detection-magie-violet.webp";
  const effectData = {
    name: "Détection de la magie",
    img: effectIcon,
    icon: effectIcon,
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration: durationData,
    description: "Détection de la magie cléricale : le clerc perçoit les émanations magiques faibles ou fortes sans identifier les objets.",
    flags: {
      add2e: {
        ...timeFlags,
        spellKey: "detection_magie_clerc",
        spellName: "Détection de la magie",
        spellList: "cleric",
        school: "divination",
        sourceItemUuid: sourceItem.uuid,
        casterId: caster.id,
        casterUuid: caster.uuid,
        range: "3\"",
        area: "1\" de large, 3\" de long",
        duration: "1 tour",
        durationRounds,
        rotationPerRound: "60°",
        detectionDetail: "faible_ou_forte_uniquement",
        blockedBy: { stoneCm: 30, metalCm: 3, woodCm: 90 },
        detectedMagicItemIds: detections.map(entry => entry.id),
        tags: ["sort:clerc", "niveau:1", "divination", "detection:magie", "detection:faible_ou_forte", "zone:1x3", "rotation:60_par_round"]
      }
    },
    changes: []
  };

  const existing = caster.effects.find(effect =>
    effect.name === "Détection de la magie"
    || effect.flags?.add2e?.spellKey === "detection_magie_clerc"
  );

  if (existing) await existing.update(effectData);
  else await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

  const detectionRows = detections.length
    ? detections.map(entry => `
      <tr>
        <td style="padding:4px 6px;width:36px;"><img src="${esc(entry.img)}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;"></td>
        <td style="padding:4px 6px;"><b>${esc(entry.name)}</b><br><small>Porté par ${esc(entry.owner)}</small></td>
        <td style="padding:4px 6px;text-align:right;"><b>${esc(entry.strength)}</b></td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" style="padding:8px;text-align:center;">Aucune aura magique détectée parmi les objets examinés.</td></tr>`;

  const chatContent = `
    <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;margin:0.3em 0;padding:0;font-family:var(--font-primary);overflow:hidden;">
      <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;color:white;border-bottom:2px solid #8a611d;">
        <img src="${esc(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
        <div style="line-height:1.2;flex:1;">
          <div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div>
          <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(sourceItem.name)}</b></div>
        </div>
        <img src="${esc(effectIcon)}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
      </div>
      <div style="padding:10px;">
        <div style="background:#fffdf4;border:1px solid #e2bc63;border-radius:6px;padding:7px;text-align:center;margin-bottom:8px;color:#6f4b12;">
          <div style="font-weight:bold;color:#2f8f46;">DÉTECTION ACTIVE</div>
          <div>Les objets magiques sont repérés sans révéler leur identité ni leurs pouvoirs.</div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2bc63;border-radius:6px;overflow:hidden;">
          <thead><tr style="background:#fff7df;"><th></th><th style="text-align:left;padding:5px;">Aura détectée</th><th style="text-align:right;padding:5px;">Intensité</th></tr></thead>
          <tbody>${detectionRows}</tbody>
        </table>
        <details style="margin-top:8px;background:#fff;border:1px solid #e2bc63;border-radius:6px;">
          <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px 10px;background:#fff7df;">Règle appliquée</summary>
          <div style="padding:8px;font-size:0.9em;line-height:1.4;">
            La détection indique la présence et l’intensité de la magie. Un objet non identifié conserve son nom générique. Les murs de pierre de 30 cm ou plus, 3 cm ou plus de métal, ou 90 cm ou plus de bois bloquent la détection.
          </div>
        </details>
      </div>
    </div>`;

  await globalThis.ADD2E_PLAY_SPELL_FX?.("detection_magie", { casterToken });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: chatContent, ...chatStyleData() });

  console.log("[ADD2E][DETECTION_MAGIE][RESULT]", { caster: caster.name, detections });
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT]", { script: "detect_magic.js", result: __add2eOnUseResult });
  ui.notifications.error("Détection de la magie : le script onUse n’a pas retourné true ou false.");
  return false;
}

return __add2eOnUseResult;
