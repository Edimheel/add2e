// ADD2E — Capacité de classe : Vade-rétro
// Compatible Foundry V13 / V14 / V15 - DialogV2 et Warpgate.
// Une utilisation par combat. Le cône est orienté avec le même flux que Mains Brûlantes.

const ADD2E_VADE_RETRO_VERSION = "2026-07-05-warpgate-cone-targeting-v7";

return await (async () => {
  const caster =
    (typeof actor !== "undefined" && actor) ||
    (typeof item !== "undefined" && item?.parent) ||
    canvas.tokens?.controlled?.[0]?.actor ||
    game.user?.character;
  if (!caster) {
    ui.notifications.warn("Vade-rétro : aucun clerc ou paladin sélectionné.");
    return false;
  }

  const casterToken = canvas.tokens?.controlled?.find(token => token?.actor?.id === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;
  if (!casterToken?.center || !canvas?.scene) {
    ui.notifications.warn("Vade-rétro : le clerc ou paladin doit avoir un token sur la scène.");
    return false;
  }
  if (!game.modules?.get("warpgate")?.active || !globalThis.warpgate?.crosshairs?.show) {
    ui.notifications.error("Vade-rétro : le module Warpgate est requis pour orienter le cône.");
    return false;
  }

  const normalize = value => String(value ?? "")
    .trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const numberFrom = value => {
    const match = String(value ?? "").match(/\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : NaN;
  };

  const sourceFeature = typeof feature !== "undefined" && feature ? feature : item;
  const sourceClass = normalize(
    sourceFeature?._add2eClassSlug ?? sourceFeature?.sourceClassSlug ?? sourceFeature?.classSlug ??
    sourceFeature?._add2eClassName ?? sourceFeature?.sourceClassName ?? ""
  );
  const isPaladin = sourceClass
    ? sourceClass.includes("paladin")
    : Array.from(caster.items ?? []).some(entry =>
      String(entry?.type ?? "").toLowerCase() === "classe" &&
      normalize(entry?.system?.label ?? entry?.name ?? entry?.system?.slug).includes("paladin")
    );
  const nativeLevel = Math.max(1, Number(
    sourceFeature?._add2eClassLevel ?? caster.system?.niveau ?? caster.system?.level ?? 1
  ) || 1);
  const level = isPaladin ? nativeLevel - 2 : nativeLevel;
  if (level < 1) {
    ui.notifications.warn("Vade-rétro : le paladin ne l’obtient qu’au niveau 3.");
    return false;
  }

  const combatId = String(game.combat?.id ?? "").trim();
  const usageFlagKey = combatId ? `vadeRetro.combat.${combatId}` : "";
  if (usageFlagKey && caster.getFlag("add2e", usageFlagKey)?.used) {
    ui.notifications.warn("Vade-rétro a déjà été utilisé pendant ce combat.");
    return false;
  }

  const TABLE = {
    squelette:     ["10", "7",  "4",  "T",  "T",  "D",  "D",  "D*", "D*", "D*"],
    zombie:       ["13", "10", "7",  "T",  "T",  "D",  "D",  "D",  "D*", "D*"],
    goule:        ["16", "13", "10", "4",  "T",  "T",  "D",  "D",  "D",  "D*"],
    ombre:        ["19", "16", "13", "7",  "4",  "T",  "T",  "D",  "D",  "D*"],
    necrophage:   ["20", "19", "16", "10", "7",  "4",  "T",  "T",  "D",  "D"],
    ghast:        [null, "20", "19", "13", "10", "7",  "4",  "T",  "T",  "D"],
    ame_en_peine: [null, null, "20", "16", "13", "10", "7",  "4",  "T",  "D"],
    momie:        [null, null, null, "20", "16", "13", "10", "7",  "4",  "T"],
    spectre:      [null, null, null, null, "20", "16", "13", "10", "7",  "T"],
    vampire:      [null, null, null, null, null, "20", "16", "13", "10", "4"],
    fantome:      [null, null, null, null, null, null, "20", "16", "13", "7"],
    liche:        [null, null, null, null, null, null, null, "19", "16", "10"],
    special:      [null, null, null, null, null, null, null, "20", "19", "13"]
  };
  const LABELS = {
    squelette: "Squelette", zombie: "Zombie", goule: "Goule", ombre: "Ombre",
    necrophage: "Nécrophage", ghast: "Ghast", ame_en_peine: "Âme en peine",
    momie: "Momie", spectre: "Spectre", vampire: "Vampire", fantome: "Fantôme",
    liche: "Liche", special: "Démon / diable inférieur"
  };
  const ORDER = Object.keys(TABLE);
  const ORDER_INDEX = new Map(ORDER.map((key, index) => [key, index]));

  const readHitDice = targetActor => {
    const system = targetActor?.system ?? {};
    for (const value of [system.dv, system.hitDice, system.hd, system.des_de_vie, system.niveau, system.level]) {
      const number = numberFrom(value);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return 1;
  };
  const getTypeText = targetActor => {
    const system = targetActor?.system ?? {};
    return [
      targetActor?.name, system.type, system.type_creature, system.creatureType, system.categorie,
      system.famille, system.race, system.type_mort_vivant, system.typeMortVivant,
      system.undeadType, system.tags, system.effectTags
    ].flat().map(normalize).join(" ");
  };
  const detectCategory = token => {
    const text = getTypeText(token?.actor);
    const entries = [
      ["ame_en_peine", ["ame_en_peine", "wight"]], ["necrophage", ["necrophage"]],
      ["squelette", ["squelette", "skeleton"]], ["zombie", ["zombie"]],
      ["goule", ["goule", "ghoul"]], ["ombre", ["ombre", "shadow"]],
      ["ghast", ["ghast"]], ["momie", ["momie", "mummy"]],
      ["spectre", ["spectre", "specter"]], ["vampire", ["vampire"]],
      ["fantome", ["fantome", "ghost"]], ["liche", ["liche", "lich"]],
      ["special", ["diable", "demon", "devil", "daemon", "plan_inferieur", "plans_inferieurs"]]
    ];
    return entries.find(([, tokens]) => tokens.some(tokenValue => text.includes(tokenValue)))?.[0] ?? null;
  };
  const specialEligible = targetActor => {
    const system = targetActor?.system ?? {};
    const ac = Number(system.ca_total ?? system.ca ?? system.ac ?? system.armorClass ?? NaN);
    const hd = numberFrom(system.dv ?? system.hd ?? system.hitDice ?? system.des_de_vie ?? system.niveau);
    const magicResistance = Number(system.resistance_magie ?? system.resistanceMagie ?? system.magicResistance ?? system.rm ?? system.mr ?? 0);
    return !(Number.isFinite(ac) && ac <= -5) && !(Number.isFinite(hd) && hd >= 11) && !(Number.isFinite(magicResistance) && magicResistance >= 66);
  };
  const columnIndex = clericLevel => clericLevel <= 0 ? -1 : clericLevel <= 8 ? clericLevel - 1 : clericLevel <= 13 ? 8 : 9;
  const rollFormula = async formula => {
    const roll = await new Roll(formula).evaluate({ async: true });
    try { await game.dice3d?.showForRoll?.(roll); } catch (_error) {}
    return roll;
  };

  const gridDistance = Number(canvas.scene?.grid?.distance ?? canvas.grid?.distance ?? 1) || 1;
  const coneDistance = gridDistance * 3;
  const coneAngle = 90;
  const origin = casterToken.center;

  ui.notifications.info("Vade-rétro : clique la direction du cône.");
  const aim = await warpgate.crosshairs.show({
    size: 1,
    icon: "icons/svg/angel.svg",
    label: "Cliquez la DIRECTION du vade-rétro",
    interval: -1,
    drawIcon: false
  });
  if (aim?.cancelled) return false;

  const ray = new Ray(origin, { x: aim.x, y: aim.y });
  const direction = Math.toDegrees(ray.angle);
  const templateData = {
    t: "cone",
    user: game.user.id,
    distance: coneDistance,
    angle: coneAngle,
    direction,
    x: origin.x,
    y: origin.y,
    fillColor: game.user?.color ?? "#d6b05a",
    borderColor: game.user?.color ?? "#d6b05a",
    flags: { add2e: { transient: true, source: "vade-retro", casterUuid: caster.uuid } }
  };

  let createdTemplate = null;
  try {
    [createdTemplate] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
  } catch (error) {
    console.error("[ADD2E][VADE-RETRO][CONE]", error);
    ui.notifications.error("Vade-rétro : impossible de créer le cône de sélection.");
    return false;
  }
  if (!createdTemplate) {
    ui.notifications.error("Vade-rétro : le cône de sélection n’a pas été créé.");
    return false;
  }

  await new Promise(resolve => setTimeout(resolve, 100));
  const templateObject = createdTemplate.object ?? canvas.templates?.get?.(createdTemplate.id) ?? null;
  const shape = templateObject?.shape ?? null;
  const templateX = Number(templateObject?.x ?? createdTemplate.x ?? origin.x);
  const templateY = Number(templateObject?.y ?? createdTemplate.y ?? origin.y);
  const targetTouchesCone = token => {
    const points = [
      token.center,
      { x: token.x, y: token.y }, { x: token.x + token.w, y: token.y },
      { x: token.x, y: token.y + token.h }, { x: token.x + token.w, y: token.y + token.h },
      { x: token.x + token.w / 2, y: token.y }, { x: token.x + token.w / 2, y: token.y + token.h },
      { x: token.x, y: token.y + token.h / 2 }, { x: token.x + token.w, y: token.y + token.h / 2 }
    ];
    return points.some(point => shape?.contains?.(point.x - templateX, point.y - templateY));
  };

  const candidates = Array.from(canvas.tokens?.placeables ?? [])
    .filter(token => token?.actor && token.id !== casterToken.id && token.actor.id !== caster.id)
    .filter(targetTouchesCone)
    .map(token => ({ token, actor: token.actor, category: detectCategory(token), hd: readHitDice(token.actor) }))
    .filter(candidate => candidate.category && TABLE[candidate.category])
    .sort((left, right) => left.hd - right.hd
      || (ORDER_INDEX.get(left.category) ?? 999) - (ORDER_INDEX.get(right.category) ?? 999)
      || String(left.actor.name).localeCompare(String(right.actor.name)));

  game.user?.targets?.forEach?.(token => token.setTarget(false, { releaseOthers: false }));
  for (const candidate of candidates) {
    candidate.token.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: true });
  }
  setTimeout(() => { void createdTemplate.delete(); }, 1200);

  if (!candidates.length) {
    ui.notifications.warn("Vade-rétro : aucun mort-vivant affectable dans le cône.");
    return false;
  }

  const groups = new Map();
  for (const candidate of candidates) {
    const group = groups.get(candidate.category) ?? [];
    group.push(candidate);
    groups.set(candidate.category, group);
  }
  const orderedGroups = [...groups.entries()].sort((left, right) => {
    const leftCandidate = left[1][0];
    const rightCandidate = right[1][0];
    return leftCandidate.hd - rightCandidate.hd
      || (ORDER_INDEX.get(left[0]) ?? 999) - (ORDER_INDEX.get(right[0]) ?? 999);
  });

  const poolRoll = await rollFormula("2d6");
  let remainingDV = Number(poolRoll.total) || 0;
  const column = columnIndex(level);
  let attempted = false;
  let failed = false;
  const rows = [];

  for (const [category, group] of orderedGroups) {
    if (remainingDV <= 0) break;
    const entry = TABLE[category]?.[column] ?? null;
    if (!entry) {
      rows.push(...group.map(candidate => ({
        target: candidate.actor.name,
        result: "Non affectable",
        detail: `${LABELS[category]} ne peut pas être affecté au niveau effectif ${level}.`
      })));
      break;
    }
    if (category === "special" && !group.some(candidate => specialEligible(candidate.actor))) {
      rows.push(...group.map(candidate => ({
        target: candidate.actor.name,
        result: "Non affectable",
        detail: "Démon ou diable trop puissant pour la ligne spéciale."
      })));
      break;
    }

    attempted = true;
    let success = false;
    let tableRollText = "Automatique";
    if (String(entry).startsWith("T") || String(entry).startsWith("D")) {
      success = true;
    } else {
      const tableRoll = await rollFormula("1d20");
      const threshold = Number(entry);
      tableRollText = `${tableRoll.total} / ${threshold}`;
      success = tableRoll.total >= threshold;
    }
    if (!success) {
      rows.push(...group.map(candidate => ({
        target: candidate.actor.name,
        result: "Échec",
        detail: `${LABELS[category]} — table ${entry} — jet ${tableRollText}.`
      })));
      failed = true;
      break;
    }

    for (const candidate of group) {
      if (remainingDV <= 0) break;
      if (category === "special" && !specialEligible(candidate.actor)) {
        rows.push({ target: candidate.actor.name, result: "Non affectable", detail: "Démon ou diable trop puissant pour la ligne spéciale." });
        continue;
      }
      if (candidate.hd > remainingDV) {
        rows.push({
          target: candidate.actor.name,
          result: "Pool insuffisant",
          detail: `${candidate.hd} DV requis ; ${remainingDV} DV restant(s).`
        });
        continue;
      }

      const evilCleric = normalize(caster.system?.alignement ?? caster.system?.alignment ?? "").includes("mauvais")
        || normalize(caster.system?.alignement ?? caster.system?.alignment ?? "").includes("evil");
      let resultLabel = "Repoussé";
      let effectName = "Repoussé par vade-rétro";
      let tags = [`vade_retro:${category}`, "etat:repousse_vade_retro"];
      if (String(entry).startsWith("D")) {
        if (evilCleric) {
          resultLabel = "Dominé";
          effectName = "Dominé par vade-rétro";
          tags = [`vade_retro:${category}`, "etat:domine_vade_retro", "controle:clerc"];
        } else {
          resultLabel = "Détruit / damné";
          effectName = "Détruit par vade-rétro";
          tags = [`vade_retro:${category}`, "etat:detruit_vade_retro"];
        }
      } else if (evilCleric) {
        resultLabel = "Influencé";
        effectName = "Influencé par vade-rétro";
        tags = [`vade_retro:${category}`, "etat:influence_vade_retro", "controle:clerc"];
      }

      const poolBefore = remainingDV;
      remainingDV -= candidate.hd;
      const effectData = {
        name: effectName,
        img: "icons/magic/holy/barrier-shield-winged-cross.webp",
        transfer: false,
        disabled: false,
        duration: {},
        changes: [],
        flags: {
          add2e: {
            tags,
            vadeRetro: {
              casterUuid: caster.uuid,
              casterName: caster.name,
              category,
              entry,
              effectiveClericLevel: level,
              sourceClass: isPaladin ? "paladin" : "clerc",
              targetHitDice: candidate.hd,
              cone: { distance: coneDistance, angle: coneAngle, direction },
              poolRoll: poolRoll.total,
              poolBefore,
              poolRemaining: remainingDV
            }
          }
        },
        description: `${effectName} — ${LABELS[category]} — ${candidate.hd} DV prélevés sur le pool de vade-rétro.`
      };

      if (game.user?.isGM || candidate.actor.isOwner) {
        try {
          await candidate.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
        } catch (error) {
          console.warn("[ADD2E][VADE-RETRO] ActiveEffect non appliqué.", error);
        }
      } else if (game.socket) {
        game.socket.emit("system.add2e", {
          type: "ADD2E_GM_OPERATION",
          operation: "createActiveEffect",
          payload: {
            actorUuid: candidate.actor.uuid,
            actorId: candidate.actor.id,
            effectData,
            fromUserId: game.user?.id,
            sentAt: Date.now()
          }
        });
      }
      rows.push({
        target: candidate.actor.name,
        result: resultLabel,
        detail: `${LABELS[category]} — table ${entry} — ${tableRollText} — ${candidate.hd} DV (${remainingDV} DV restant(s)).`
      });
    }
  }

  if (attempted && usageFlagKey) {
    await caster.setFlag("add2e", usageFlagKey, {
      used: true,
      combatId,
      effectiveClericLevel: level,
      sourceClass: isPaladin ? "paladin" : "clerc",
      failed,
      cone: { distance: coneDistance, angle: coneAngle, direction },
      poolRoll: poolRoll.total,
      remainingDV,
      affectedTargets: rows.filter(row => ["Repoussé", "Détruit / damné", "Influencé", "Dominé"].includes(row.result)).map(row => row.target),
      at: Date.now()
    });
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `<div class="add2e-chat-card" style="border:1.5px solid #c79b38;border-radius:12px;overflow:hidden;background:#fffaf0;box-shadow:0 3px 8px #0002;"><div style="background:linear-gradient(90deg,#8a5a13,#d4a83a);color:white;padding:8px 10px;display:flex;align-items:center;gap:8px;"><img src="${esc(caster.img)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="flex:1;"><div style="font-weight:800;">${esc(caster.name)}</div><div style="font-size:.9em;">Vade-rétro — niveau effectif de clerc ${level}${isPaladin ? ` (Paladin niveau ${nativeLevel})` : ""}</div></div></div><div style="padding:8px;"><div style="margin-bottom:7px;padding:6px 8px;border:1px solid #e7d8a0;border-radius:6px;background:#fffdf7;"><b>Cône :</b> ${coneDistance} ${esc(canvas.scene?.grid?.units || "m")}, ${coneAngle}°. <b>Pool :</b> 2d6 = <b>${poolRoll.total} DV</b> ; restant : <b>${remainingDV} DV</b>.</div>${rows.map(row => `<div style="border-bottom:1px solid #e7d8a0;padding:5px 0;"><b>${esc(row.target)}</b> — <b>${esc(row.result)}</b><br><span style="font-size:.9em;color:#5b4b26;">${esc(row.detail)}</span></div>`).join("") || "<div>Aucune créature n’a pu être affectée.</div>"}<div style="margin-top:7px;font-size:.82em;color:#5b4b26;">Vade-rétro : une utilisation par combat.</div></div></div>`
  });

  return attempted && !failed;
})();
