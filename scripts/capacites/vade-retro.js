// ADD2E — Capacité de classe : Vade-rétro
// Compatible Foundry V13 / V14 / V15 - DialogV2 uniquement.
// Une tentative par combat. La sélection se fait dans un cône temporaire ancré sur le prêtre.

const ADD2E_VADE_RETRO_VERSION = "2026-07-05-anchored-cone-targeting-v4";

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

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const asNumber = value => {
    const match = String(value ?? "").match(/\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : NaN;
  };

  const sourceFeature = typeof feature !== "undefined" && feature ? feature : item;
  const sourceClass = normalize(
    sourceFeature?._add2eClassSlug ??
    sourceFeature?.sourceClassSlug ??
    sourceFeature?.classSlug ??
    sourceFeature?._add2eClassName ??
    sourceFeature?.sourceClassName ??
    ""
  );
  const isPaladin = sourceClass
    ? sourceClass.includes("paladin")
    : Array.from(caster.items ?? []).some(entry =>
      String(entry?.type ?? "").toLowerCase() === "classe" &&
      normalize(entry?.system?.label ?? entry?.name ?? entry?.system?.slug).includes("paladin")
    );
  const nativeLevel = Math.max(1, Number(
    sourceFeature?._add2eClassLevel ??
    caster.system?.niveau ??
    caster.system?.level ??
    1
  ) || 1);
  const level = isPaladin ? nativeLevel - 2 : nativeLevel;
  if (level < 1) {
    ui.notifications.warn("Vade-rétro : le paladin ne l’obtient qu’au niveau 3.");
    return false;
  }

  const combatId = String(game.combat?.id ?? "").trim();
  const usageFlagKey = combatId ? `vadeRetro.combat.${combatId}` : "";
  const previousUse = usageFlagKey ? caster.getFlag("add2e", usageFlagKey) : null;
  if (previousUse?.used) {
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
      const number = asNumber(value);
      if (Number.isFinite(number) && number > 0) return number;
    }
    return 1;
  };
  const typeText = targetActor => {
    const system = targetActor?.system ?? {};
    return [
      targetActor?.name, system.type, system.type_creature, system.creatureType,
      system.categorie, system.famille, system.race, system.type_mort_vivant,
      system.typeMortVivant, system.undeadType, system.tags, system.effectTags
    ].flat().map(normalize).join(" ");
  };
  const detectCategory = targetToken => {
    const text = typeText(targetToken?.actor);
    const entries = [
      ["ame_en_peine", ["ame_en_peine", "wight"]], ["necrophage", ["necrophage"]],
      ["squelette", ["squelette", "skeleton"]], ["zombie", ["zombie"]],
      ["goule", ["goule", "ghoul"]], ["ombre", ["ombre", "shadow"]],
      ["ghast", ["ghast"]], ["momie", ["momie", "mummy"]],
      ["spectre", ["spectre", "specter"]], ["vampire", ["vampire"]],
      ["fantome", ["fantome", "ghost"]], ["liche", ["liche", "lich"]],
      ["special", ["diable", "demon", "devil", "daemon", "plan_inferieur", "plans_inferieurs"]]
    ];
    for (const [category, keys] of entries) if (keys.some(key => text.includes(key))) return category;
    return null;
  };
  const specialEligible = targetActor => {
    const system = targetActor?.system ?? {};
    const ac = Number(system.ca_total ?? system.ca ?? system.ac ?? system.armorClass ?? NaN);
    const hd = asNumber(system.dv ?? system.hd ?? system.hitDice ?? system.des_de_vie ?? system.niveau);
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
  const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
  const origin = { x: casterToken.center.x, y: casterToken.center.y };
  const defaultDistance = Math.max(gridDistance, gridDistance * 3);
  const minDistance = gridDistance;
  const maxDistance = gridDistance * 30;

  const previewData = {
    t: "cone",
    user: game.user.id,
    distance: defaultDistance,
    angle: 90,
    direction: 0,
    x: origin.x,
    y: origin.y,
    fillColor: game.user?.color ?? "#d6b05a",
    borderColor: game.user?.color ?? "#d6b05a",
    flags: { add2e: { transient: true, source: "vade-retro", casterUuid: caster.uuid } }
  };

  let preview = null;
  try {
    [preview] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [previewData]);
  } catch (error) {
    console.error("[ADD2E][VADE-RETRO][CONE]", error);
    ui.notifications.error("Vade-rétro : impossible de créer le cône de sélection.");
    return false;
  }
  if (!preview) {
    ui.notifications.error("Vade-rétro : le cône de sélection n’a pas été créé.");
    return false;
  }

  const deletePreview = async () => {
    try {
      if (canvas.scene?.templates?.get?.(preview.id)) await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [preview.id]);
    } catch (_error) {}
  };

  const view = canvas?.app?.view ?? canvas?.app?.renderer?.view ?? null;
  const stage = canvas?.stage ?? canvas?.app?.stage ?? null;
  const canvasPointFromEvent = event => {
    if (!view || !stage?.toLocal || !event) return null;
    const target = event.target;
    if (target !== view && !view.contains?.(target)) return null;
    const rect = view.getBoundingClientRect?.();
    const renderer = canvas?.app?.renderer ?? null;
    if (!rect || !renderer?.width || !renderer?.height) return null;
    const point = {
      x: (event.clientX - rect.left) * (renderer.width / rect.width),
      y: (event.clientY - rect.top) * (renderer.height / rect.height)
    };
    try {
      const local = stage.toLocal(point);
      return Number.isFinite(local?.x) && Number.isFinite(local?.y) ? local : null;
    } catch (_error) {
      return null;
    }
  };
  const directionFromPoint = point => {
    const radians = Math.atan2(point.y - origin.y, point.x - origin.x);
    return (radians * 180 / Math.PI + 360) % 360;
  };

  ui.notifications.info("Vade-rétro : oriente le cône avec la souris. Molette : longueur ; Maj + molette : ouverture. Clic gauche : valider ; Échap : annuler.");

  let cone = null;
  try {
    cone = await new Promise(resolve => {
      let distance = defaultDistance;
      let angle = 90;
      let direction = 0;
      let pending = Promise.resolve();
      let timer = null;
      let resolved = false;

      const updatePreview = () => {
        const data = { x: origin.x, y: origin.y, distance, angle, direction };
        pending = pending.then(() => preview.update(data, { diff: false })).catch(() => {});
        return pending;
      };
      const scheduleUpdate = () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          void updatePreview();
        }, 35);
      };
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("wheel", onWheel, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
      };
      const finish = async value => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (value) await updatePreview();
        resolve(value ? { distance, angle, direction } : null);
      };
      const onMove = event => {
        const point = canvasPointFromEvent(event);
        if (!point) return;
        direction = directionFromPoint(point);
        scheduleUpdate();
      };
      const onWheel = event => {
        const point = canvasPointFromEvent(event);
        if (!point) return;
        event.preventDefault();
        event.stopPropagation();
        direction = directionFromPoint(point);
        const delta = event.deltaY > 0 ? -1 : 1;
        if (event.shiftKey) angle = Math.max(30, Math.min(180, angle + delta * 15));
        else distance = Math.max(minDistance, Math.min(maxDistance, distance + delta * gridDistance));
        scheduleUpdate();
      };
      const onClick = event => {
        if (event.button !== 0) return;
        const point = canvasPointFromEvent(event);
        if (!point) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        direction = directionFromPoint(point);
        void finish(true);
      };
      const onKeyDown = event => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        void finish(false);
      };

      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("wheel", onWheel, { capture: true, passive: false });
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      void updatePreview();
    });
  } catch (_error) {
    cone = null;
  }

  if (!cone) {
    await deletePreview();
    return false;
  }

  await new Promise(resolve => setTimeout(resolve, 40));
  const templateObject = canvas.templates?.get?.(preview.id) ?? preview.object ?? null;
  const shape = templateObject?.shape ?? null;
  const templateX = Number(templateObject?.x ?? preview.x ?? origin.x);
  const templateY = Number(templateObject?.y ?? preview.y ?? origin.y);
  const distancePixels = (cone.distance / gridDistance) * gridSize;
  const withinConeFallback = point => {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    if (Math.hypot(dx, dy) > distancePixels + 0.001) return false;
    const bearing = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const delta = Math.abs(((bearing - cone.direction + 540) % 360) - 180);
    return delta <= cone.angle / 2;
  };
  const tokenTouchesCone = token => {
    const points = [
      token.center,
      { x: token.x, y: token.y }, { x: token.x + token.w, y: token.y },
      { x: token.x, y: token.y + token.h }, { x: token.x + token.w, y: token.y + token.h },
      { x: token.x + token.w / 2, y: token.y }, { x: token.x + token.w / 2, y: token.y + token.h },
      { x: token.x, y: token.y + token.h / 2 }, { x: token.x + token.w, y: token.y + token.h / 2 }
    ].filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    return points.some(point => shape?.contains?.(point.x - templateX, point.y - templateY) || withinConeFallback(point));
  };

  const candidates = Array.from(canvas.tokens?.placeables ?? [])
    .filter(token => token?.actor && token.id !== casterToken.id && token.actor.id !== caster.id)
    .filter(tokenTouchesCone)
    .map(token => ({ token, actor: token.actor, category: detectCategory(token), hd: readHitDice(token.actor) }))
    .filter(candidate => candidate.category && TABLE[candidate.category])
    .sort((left, right) => left.hd - right.hd
      || (ORDER_INDEX.get(left.category) ?? 999) - (ORDER_INDEX.get(right.category) ?? 999)
      || String(left.actor.name).localeCompare(String(right.actor.name)));

  const candidateHtml = candidates.length
    ? candidates.map(candidate => `<li><b>${esc(candidate.actor.name)}</b> — ${esc(LABELS[candidate.category])}, ${candidate.hd} DV</li>`).join("")
    : "<li>Aucun mort-vivant ou démon/diable inférieur dans le cône.</li>";
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const confirmed = DialogV2?.confirm
    ? await DialogV2.confirm({
      window: { title: "Vade-rétro : confirmer le cône" },
      content: `<div class="add2e-dialog"><p><b>Cône sélectionné :</b> ${Math.round(cone.distance * 10) / 10} ${esc(canvas.scene?.grid?.units || "m")}, ${cone.angle}°.</p><p>Les cibles seront prises du plus faible au plus puissant. Le tableau détermine le succès ; le dé indique ensuite combien de créatures sont affectées.</p><ul style="max-height:180px;overflow:auto;margin:0;padding-left:1.2em;">${candidateHtml}</ul></div>`,
      yes: { label: "Effectuer le vade-rétro", icon: "fas fa-hand-sparkles" },
      no: { label: "Annuler" }
    })
    : window.confirm("Effectuer le vade-rétro sur les créatures dans le cône ?");

  await deletePreview();
  if (!confirmed) return false;
  if (!candidates.length) {
    ui.notifications.warn("Vade-rétro : aucune créature affectable dans le cône.");
    return false;
  }

  const groups = new Map();
  for (const candidate of candidates) {
    const group = groups.get(candidate.category) ?? [];
    group.push(candidate);
    groups.set(candidate.category, group);
  }
  const orderedGroups = [...groups.entries()].sort((left, right) => {
    const leftFirst = left[1][0];
    const rightFirst = right[1][0];
    return leftFirst.hd - rightFirst.hd || (ORDER_INDEX.get(left[0]) ?? 999) - (ORDER_INDEX.get(right[0]) ?? 999);
  });

  const col = columnIndex(level);
  let maximum = null;
  let countRoll = null;
  let countFormula = "";
  let remaining = 0;
  let attempted = false;
  let failed = false;
  const rows = [];

  for (const [category, group] of orderedGroups) {
    const entry = TABLE[category]?.[col] ?? null;
    if (!entry) {
      rows.push(...group.map(candidate => ({ target: candidate.actor.name, result: "Non affectable", detail: `${LABELS[category]} ne peut pas être affecté au niveau effectif ${level}.` })));
      break;
    }
    if (category === "special" && !group.some(candidate => specialEligible(candidate.actor))) {
      rows.push(...group.map(candidate => ({ target: candidate.actor.name, result: "Non affectable", detail: "Démon ou diable trop puissant pour la ligne spéciale." })));
      break;
    }

    attempted = true;
    let success = false;
    let tableText = "Automatique";
    if (String(entry).startsWith("T") || String(entry).startsWith("D")) {
      success = true;
    } else {
      const roll = await rollFormula("1d20");
      const threshold = Number(entry);
      tableText = `${roll.total} / ${threshold}`;
      success = roll.total >= threshold;
    }

    if (!success) {
      rows.push(...group.map(candidate => ({ target: candidate.actor.name, result: "Échec", detail: `${LABELS[category]} — table ${entry} — jet ${tableText}.` })));
      failed = true;
      break;
    }

    if (maximum === null) {
      countFormula = String(entry).includes("*") ? "1d6+6" : "1d12";
      countRoll = await rollFormula(countFormula);
      maximum = Number(countRoll.total) || 0;
      remaining = maximum;
    }

    for (const candidate of group) {
      if (remaining <= 0) break;
      if (category === "special" && !specialEligible(candidate.actor)) {
        rows.push({ target: candidate.actor.name, result: "Non affectable", detail: "Démon ou diable trop puissant pour la ligne spéciale." });
        continue;
      }

      let resultLabel = "Repoussé";
      let effectName = "Repoussé par vade-rétro";
      let tags = [`vade_retro:${category}`, "etat:repousse_vade_retro"];
      const alignment = normalize(caster.system?.alignement ?? caster.system?.alignment ?? "");
      const evilCleric = alignment.includes("mauvais") || alignment.includes("evil");
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

      remaining -= 1;
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
              cone: { distance: cone.distance, angle: cone.angle, direction: cone.direction },
              maximum,
              remaining
            }
          }
        },
        description: `${effectName} — ${LABELS[category]} — sélectionné dans le cône de vade-rétro.`
      };

      if (game.user?.isGM || candidate.actor.isOwner) {
        try { await candidate.actor.createEmbeddedDocuments("ActiveEffect", [effectData]); } catch (error) { console.warn("[ADD2E][VADE-RETRO] ActiveEffect non appliqué.", error); }
      } else if (game.socket) {
        game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: candidate.actor.uuid, actorId: candidate.actor.id, effectData, fromUserId: game.user?.id, sentAt: Date.now() } });
      }
      rows.push({ target: candidate.actor.name, result: resultLabel, detail: `${LABELS[category]} — table ${entry} — ${tableText} — ${candidate.hd} DV — ${remaining} créature(s) restante(s) sur ${maximum}.` });
    }

    if (remaining <= 0) break;
  }

  if (attempted && usageFlagKey) {
    await caster.setFlag("add2e", usageFlagKey, {
      used: true,
      combatId,
      effectiveClericLevel: level,
      sourceClass: isPaladin ? "paladin" : "clerc",
      failed,
      cone: { distance: cone.distance, angle: cone.angle, direction: cone.direction },
      affectedActorUuids: rows.filter(row => ["Repoussé", "Détruit / damné", "Influencé", "Dominé"].includes(row.result)).map(row => row.target),
      at: Date.now()
    });
  }

  const countLabel = countRoll ? `${countFormula} = ${countRoll.total}` : "—";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `<div class="add2e-chat-card" style="border:1.5px solid #c79b38;border-radius:12px;overflow:hidden;background:#fffaf0;box-shadow:0 3px 8px #0002;"><div style="background:linear-gradient(90deg,#8a5a13,#d4a83a);color:white;padding:8px 10px;display:flex;align-items:center;gap:8px;"><img src="${esc(caster.img)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="flex:1;"><div style="font-weight:800;">${esc(caster.name)}</div><div style="font-size:.9em;">Vade-rétro — niveau effectif de clerc ${level}${isPaladin ? ` (Paladin niveau ${nativeLevel})` : ""}</div></div></div><div style="padding:8px;"><div style="margin-bottom:7px;padding:6px 8px;border:1px solid #e7d8a0;border-radius:6px;background:#fffdf7;"><b>Cône :</b> ${Math.round(cone.distance * 10) / 10} ${esc(canvas.scene?.grid?.units || "m")}, ${cone.angle}°. <b>Nombre affecté :</b> ${esc(countLabel)}.</div>${rows.map(row => `<div style="border-bottom:1px solid #e7d8a0;padding:5px 0;"><b>${esc(row.target)}</b> — <b>${esc(row.result)}</b><br><span style="font-size:.9em;color:#5b4b26;">${esc(row.detail)}</span></div>`).join("") || "<div>Aucune créature n’a pu être affectée.</div>"}<div style="margin-top:7px;font-size:.82em;color:#5b4b26;">Vade-rétro : une utilisation par combat.</div></div></div>`
  });

  return attempted && !failed;
})();
