// ADD2E — onUse Magicien : Amitié
// Version : 2026-05-25-magicien-amitie-zone-cases-v2
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => le sort est lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation technique, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][AMITIE]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : null;
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];

const ADD2E_SORT_CONFIG = {
  name: "Amitié",
  slug: "amitie",
  level: 1,
  school: "Enchantement/Charme",
  rangeText: "0",
  durationText: "1 round par niveau",
  castingTimeText: "1 segment",
  saveText: "Spécial",
  areaText: "sphère d’un rayon de 1\" + 1\" par niveau",
  materialText: "craie ou farine blanche, noir de fumée ou suie, vermillon",
  imgFallback: "icons/magic/control/hypnosis-mesmerism-eye.webp"
};

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eCasterLevel(actorDoc) {
  return Number(
    actorDoc?.system?.niveau ??
    actorDoc?.system?.level ??
    actorDoc?.system?.details?.niveau ??
    actorDoc?.system?.details?.level ??
    1
  ) || 1;
}

function add2eGetCasterToken(actorDoc) {
  return ADD2E_TOKEN
    ?? ADD2E_ARGS?.[0]?.token
    ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id)
    ?? actorDoc?.getActiveTokens?.()?.[0]
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eAreaRadiusInches(level) {
  return 1 + Math.max(1, level);
}

function add2eAreaRadiusGridCells(level) {
  // Dans le système ADD2E, pour la résolution sur carte Foundry, 1" de rayon = 1 case.
  // Cela évite de convertir deux fois les unités de scène et d'englober toute la carte.
  return add2eAreaRadiusInches(level);
}

function add2eAreaRadiusText(level) {
  return `${add2eAreaRadiusInches(level)}\" (${add2eAreaRadiusGridCells(level)} case${add2eAreaRadiusGridCells(level) > 1 ? "s" : ""})`;
}

function add2eGridSize() {
  return Number(canvas?.grid?.size) || Number(canvas?.scene?.grid?.size) || 100;
}

function add2eRadiusPixels(level) {
  return add2eAreaRadiusGridCells(level) * add2eGridSize();
}

async function add2eRollFormula(formula) {
  return await new Roll(formula).evaluate({ async: true });
}

function add2eEffectDuration(level) {
  return {
    rounds: Math.max(1, level),
    startRound: game.combat?.round ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

function add2eTokenCenter(tokenDocOrPlaceable) {
  const placeable = tokenDocOrPlaceable?.object ?? tokenDocOrPlaceable;
  if (placeable?.center) return { x: Number(placeable.center.x), y: Number(placeable.center.y) };
  const doc = tokenDocOrPlaceable?.document ?? tokenDocOrPlaceable;
  const gridSize = add2eGridSize();
  const width = Number(doc?.width) || 1;
  const height = Number(doc?.height) || 1;
  return {
    x: Number(doc?.x ?? 0) + (width * gridSize) / 2,
    y: Number(doc?.y ?? 0) + (height * gridSize) / 2
  };
}

async function add2eChooseZone(level, casterToken) {
  if (!globalThis.warpgate?.crosshairs?.show) {
    ui.notifications?.warn?.("Amitié nécessite Warp Gate pour choisir la zone.");
    console.warn(`${ADD2E_ONUSE_TAG}[NO_WARPGATE] Warp Gate ou crosshairs indisponible.`);
    return null;
  }

  const radiusCells = add2eAreaRadiusGridCells(level);
  const diameterCells = Math.max(1, radiusCells * 2);
  const casterCenter = casterToken ? add2eTokenCenter(casterToken) : null;

  const location = await warpgate.crosshairs.show({
    size: diameterCells,
    interval: 1,
    drawOutline: true,
    drawIcon: true,
    lockSize: true,
    icon: ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.imgFallback,
    label: `${ADD2E_SORT_CONFIG.name} — rayon ${add2eAreaRadiusText(level)}`,
    fillColor: "#8e63c7",
    outlineColor: "#5b3f8c",
    x: casterCenter?.x,
    y: casterCenter?.y
  });

  if (!location || location.cancelled) return null;
  return { x: Number(location.x), y: Number(location.y) };
}

function add2eTokensInZone(center, level, casterToken) {
  const radiusPx = add2eRadiusPixels(level);
  const casterId = casterToken?.id ?? casterToken?.document?.id ?? null;
  return (canvas?.tokens?.placeables ?? [])
    .filter(t => t?.actor && t.id !== casterId)
    .filter(t => {
      const c = add2eTokenCenter(t);
      const dx = c.x - center.x;
      const dy = c.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= radiusPx;
    });
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
    const n = Number(match[0]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function add2eReadSaveVsSpells(actorDoc) {
  const s = actorDoc?.system ?? {};
  const direct = add2eReadNumber(
    s.sauvegarde_sortileges,
    s.sauvegarde_sortilege,
    s.saveSorts,
    s.saveSpells,
    s.saves?.sorts,
    s.saves?.spells,
    s.savingThrows?.sorts,
    s.savingThrows?.spells,
    s.sauvegardes?.sorts,
    s.sauvegardes?.sortileges
  );
  if (Number.isFinite(direct)) return direct;

  if (Array.isArray(s.sauvegardes) && s.sauvegardes.length) {
    const named = s.sauvegardes.find(x => /sort|spell/i.test(String(x?.type ?? x?.key ?? x?.name ?? x?.label ?? x?.nom ?? "")));
    const namedValue = add2eReadNumber(named?.value, named?.valeur, named?.total, named?.score);
    if (Number.isFinite(namedValue)) return namedValue;

    const nums = s.sauvegardes.map(v => add2eReadNumber(v)).filter(Number.isFinite);
    if (nums.length >= 5) return nums[4];
    if (nums.length) return nums[nums.length - 1];
  }

  if (Array.isArray(s.savingThrows) && s.savingThrows.length) {
    const named = s.savingThrows.find(x => /sort|spell/i.test(String(x?.type ?? x?.key ?? x?.name ?? x?.label ?? x?.nom ?? "")));
    const namedValue = add2eReadNumber(named?.value, named?.valeur, named?.total, named?.score);
    if (Number.isFinite(namedValue)) return namedValue;

    const nums = s.savingThrows.map(v => add2eReadNumber(v)).filter(Number.isFinite);
    if (nums.length >= 5) return nums[4];
    if (nums.length) return nums[nums.length - 1];
  }

  for (const raw of [s.savingThrows, s.sauvegardes]) {
    if (typeof raw !== "string") continue;
    const labeled = raw.match(/(?:sortil[eè]ges?|sorts?|spells?)\D*(\d+)/i);
    if (labeled) return Number(labeled[1]);
    const nums = raw.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
    if (nums.length >= 5) return nums[4];
    if (nums.length) return nums[nums.length - 1];
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
  } catch (_err) {
    return 0;
  }
}

function add2eIsAnimalIntelligenceOrLess(actorDoc) {
  const s = actorDoc?.system ?? {};
  const n = add2eReadNumber(s.intelligence, s.int, s.intel, s.mental?.intelligence);
  if (Number.isFinite(n)) return n <= 2;
  const text = String(s.intelligence ?? s.intelligenceText ?? s.intelligence_monstre ?? s.description ?? "").toLowerCase();
  return /animal|non.?intelligent|semi.?intelligent|faible/.test(text);
}

async function add2eRollTargetSave(actorDoc) {
  const saveTarget = add2eReadSaveVsSpells(actorDoc);
  const bonus = add2eSaveBonus(actorDoc);
  const roll = await add2eRollFormula("1d20");
  const total = Number(roll.total) + bonus;
  const hasSave = Number.isFinite(saveTarget);
  const success = hasSave ? total >= saveTarget : null;
  return { roll, saveTarget, bonus, total, hasSave, success };
}

function add2eBuildTargetEffect({ targetToken, casterActor, choice, level, modifier, saveData }) {
  const favorable = choice === "favorable";
  const signed = favorable ? Math.abs(modifier) : -Math.abs(modifier);
  const mode = foundry?.CONST?.ACTIVE_EFFECT_MODES?.OVERRIDE ?? CONST?.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5;
  const casterSlug = String(casterActor?.id ?? "caster").replace(/[^a-zA-Z0-9_\-]/g, "_");

  return {
    name: favorable ? "Amitié — impression favorable" : "Amitié — irritation",
    img: ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.imgFallback,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [
      {
        key: `flags.add2e.amitie.${casterSlug}.charismeApparent`,
        mode,
        value: String(signed),
        priority: 20
      }
    ],
    duration: add2eEffectDuration(level),
    description: favorable
      ? `${targetToken.name} est favorablement impressionné par ${casterActor?.name ?? "le magicien"}.`
      : `${targetToken.name} se montre irrité par la présence de ${casterActor?.name ?? "le magicien"}.`,
    flags: {
      add2e: {
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
          "jet_sauvegarde:special"
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
          charismaApparentModifier: signed,
          saveRoll: saveData?.roll?.total ?? null,
          saveBonus: saveData?.bonus ?? 0,
          saveTotal: saveData?.total ?? null,
          saveTarget: saveData?.saveTarget ?? null,
          casterLevel: level,
          durationRounds: Math.max(1, level),
          areaRadiusInches: add2eAreaRadiusInches(level),
          areaRadiusGridCells: add2eAreaRadiusGridCells(level),
          sourceItemId: ADD2E_ITEM?.id ?? null,
          sourceItemUuid: ADD2E_ITEM?.uuid ?? null
        }
      }
    }
  };
}

async function add2eApplyEffectOnTarget(targetToken, effectData) {
  if (!targetToken?.actor || !effectData) return false;

  const payload = {
    actorUuid: targetToken.actor.uuid,
    actorId: targetToken.actor.id,
    sceneId: canvas?.scene?.id ?? null,
    tokenId: targetToken.document?.id ?? targetToken.id ?? null,
    effectData
  };

  if (game.user?.isGM || targetToken.actor.isOwner) {
    try {
      await targetToken.actor.createEmbeddedDocuments("ActiveEffect", [foundry.utils.duplicate(effectData)]);
      return true;
    } catch (err) {
      console.warn(`${ADD2E_ONUSE_TAG}[DIRECT_EFFECT_FAILED] Passage par relais MJ.`, err);
    }
  }

  game.socket?.emit?.("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation: "createActiveEffect",
    payload
  });

  return true;
}

async function add2eResolveAmitieTarget(targetToken, casterActor, level) {
  if (!targetToken?.actor) return null;

  if (add2eIsAnimalIntelligenceOrLess(targetToken.actor)) {
    return {
      token: targetToken,
      actor: targetToken.actor,
      status: "ignored",
      label: "non affecté",
      modifier: 0,
      saveData: null,
      effectRequested: false
    };
  }

  const saveData = await add2eRollTargetSave(targetToken.actor);

  if (!saveData.hasSave) {
    return {
      token: targetToken,
      actor: targetToken.actor,
      status: "manual",
      label: "à résoudre par le MD",
      modifier: 0,
      saveData,
      effectRequested: false
    };
  }

  if (saveData.success) {
    const modRoll = await add2eRollFormula("1d4");
    const effectData = add2eBuildTargetEffect({
      targetToken,
      casterActor,
      choice: "irritated",
      level,
      modifier: Number(modRoll.total) || 1,
      saveData
    });
    const effectRequested = await add2eApplyEffectOnTarget(targetToken, effectData);
    return {
      token: targetToken,
      actor: targetToken.actor,
      status: "success",
      label: "résiste et s’irrite",
      modifier: -Math.abs(Number(modRoll.total) || 1),
      saveData,
      effectRequested
    };
  }

  const modRoll = await add2eRollFormula("2d4");
  const effectData = add2eBuildTargetEffect({
    targetToken,
    casterActor,
    choice: "favorable",
    level,
    modifier: Number(modRoll.total) || 1,
    saveData
  });
  const effectRequested = await add2eApplyEffectOnTarget(targetToken, effectData);

  return {
    token: targetToken,
    actor: targetToken.actor,
    status: "failure",
    label: "favorable",
    modifier: Math.abs(Number(modRoll.total) || 1),
    saveData,
    effectRequested
  };
}

function add2eResultLine(result) {
  const name = add2eHtmlEscape(result?.token?.name ?? result?.actor?.name ?? "Créature");
  if (result.status === "ignored") {
    return `<tr><td>${name}</td><td colspan="3">Non affecté</td></tr>`;
  }
  if (result.status === "manual") {
    const rollText = result.saveData?.roll?.total ? `Jet ${result.saveData.roll.total}` : "Jet effectué";
    return `<tr><td>${name}</td><td>${add2eHtmlEscape(rollText)}</td><td>—</td><td>À résoudre</td></tr>`;
  }

  const total = Number(result.saveData?.total ?? result.saveData?.roll?.total ?? 0);
  const bonus = Number(result.saveData?.bonus ?? 0);
  const seuil = result.saveData?.saveTarget;
  const mod = Number(result.modifier) || 0;
  const modText = mod > 0 ? `+${mod}` : `${mod}`;

  return `
    <tr>
      <td>${name}</td>
      <td>${add2eHtmlEscape(String(total))}${bonus ? ` <small>(${bonus > 0 ? "+" : ""}${bonus})</small>` : ""}</td>
      <td>${add2eHtmlEscape(String(seuil))}</td>
      <td>${add2eHtmlEscape(result.label)} <b>${add2eHtmlEscape(modText)}</b></td>
    </tr>`;
}

async function add2eChatAmitie(actorDoc, center, level, results) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = ADD2E_ITEM?.img ?? ADD2E_SORT_CONFIG.imgFallback;
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
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
          <img src="${add2eHtmlEscape(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
        </div>

        <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;text-align:center;">Enchantement social</div>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">Le visage du magicien se pare de signes colorés et son aura devient plus marquante.</p>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Rayon :</b> ${add2eHtmlEscape(radiusText)} — <b>Durée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.durationText)} (${durationRounds} round${durationRounds > 1 ? "s" : ""}).</p>
          </div>

          <table style="width:100%;border-collapse:collapse;background:#fffaff;border:1px solid #8e63c7;font-size:12px;">
            <thead>
              <tr style="background:#e8d9ff;color:#2d2144;">
                <th style="text-align:left;padding:4px;border-bottom:1px solid #8e63c7;">Créature</th>
                <th style="text-align:center;padding:4px;border-bottom:1px solid #8e63c7;">Jet</th>
                <th style="text-align:center;padding:4px;border-bottom:1px solid #8e63c7;">Seuil</th>
                <th style="text-align:left;padding:4px;border-bottom:1px solid #8e63c7;">Réaction</th>
              </tr>
            </thead>
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
const zoneCenter = await add2eChooseZone(level, casterToken);
if (!zoneCenter) {
  console.log(`${ADD2E_ONUSE_TAG}[CANCEL] Zone annulée : remboursement du slot mémorisé par le dispatcher.`);
  return false;
}

const targetTokens = add2eTokensInZone(zoneCenter, level, casterToken);
const results = [];

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  level,
  zoneCenter,
  radiusInches: add2eAreaRadiusInches(level),
  radiusGridCells: add2eAreaRadiusGridCells(level),
  radiusPixels: add2eRadiusPixels(level),
  targets: targetTokens.map(t => ({ name: t.name, actor: t.actor?.name }))
});

for (const targetToken of targetTokens) {
  const result = await add2eResolveAmitieTarget(targetToken, ADD2E_ACTOR, level);
  if (result) results.push(result);
}

await add2eChatAmitie(ADD2E_ACTOR, zoneCenter, level, results);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  targetCount: targetTokens.length,
  results: results.map(r => ({
    token: r.token?.name,
    status: r.status,
    saveTotal: r.saveData?.total ?? null,
    saveTarget: r.saveData?.saveTarget ?? null,
    modifier: r.modifier,
    effectRequested: r.effectRequested
  }))
});

return true;
