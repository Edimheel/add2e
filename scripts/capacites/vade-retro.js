// ADD2E — Capacité de classe : Vade-rétro
// Compatible Foundry V13 / V14 / V15 - DialogV2 uniquement.
// Les cibles Foundry constituent le groupe concerné ; la résolution applique un seul pool de 2d6 DV.

const ADD2E_VADE_RETRO_VERSION = "2026-07-05-target-pool-2d6-hd-v3";

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

  const targets = Array.from(game.user?.targets ?? []).filter(token => token?.actor);
  if (!targets.length) {
    ui.notifications.warn("Vade-rétro : cible les morts-vivants concernés avant d’utiliser la capacité.");
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

  const columnIndex = clericLevel => clericLevel <= 0 ? -1 : clericLevel <= 8 ? clericLevel - 1 : clericLevel <= 13 ? 8 : 9;
  const readHitDice = targetActor => {
    const system = targetActor?.system ?? {};
    for (const value of [system.dv, system.hitDice, system.hd, system.des_de_vie, system.niveau, system.level]) {
      const match = String(value ?? "").match(/\d+(?:[.,]\d+)?/);
      if (!match) continue;
      const number = Number(match[0].replace(",", "."));
      if (Number.isFinite(number) && number > 0) return Math.max(1, Math.ceil(number));
    }
    return 1;
  };
  const getTypeText = targetActor => {
    const system = targetActor?.system ?? {};
    return [
      targetActor?.name, system.type, system.type_creature, system.creatureType,
      system.categorie, system.famille, system.race, system.type_mort_vivant,
      system.typeMortVivant, system.undeadType, system.tags, system.effectTags
    ].flat().map(normalize).join(" ");
  };
  const detectCategory = (targetToken, forced) => {
    if (forced && forced !== "auto") return forced;
    const text = getTypeText(targetToken?.actor);
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
    const hd = Number(String(system.dv ?? system.hd ?? system.hitDice ?? system.des_de_vie ?? system.niveau ?? "").match(/\d+/)?.[0] ?? NaN);
    const magicResistance = Number(system.resistance_magie ?? system.resistanceMagie ?? system.magicResistance ?? system.rm ?? system.mr ?? 0);
    return !(Number.isFinite(ac) && ac <= -5) && !(Number.isFinite(hd) && hd >= 11) && !(Number.isFinite(magicResistance) && magicResistance >= 66);
  };

  const alignement = String(caster.system?.alignement ?? caster.system?.alignment ?? "").toLowerCase();
  const defaultMode = alignement.includes("mauvais") ? "commander" : "repousser";
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Vade-rétro : DialogV2 est indisponible.");
    return false;
  }

  const preliminary = targets.map(token => ({
    token,
    actor: token.actor,
    category: detectCategory(token, "auto"),
    hd: readHitDice(token.actor)
  }));
  const targetSummary = preliminary.map(entry => `${esc(entry.actor.name)} (${entry.category ? LABELS[entry.category] : "catégorie inconnue"}, ${entry.hd} DV)`).join("<br>");
  const dialogResult = await DialogV2.wait({
    window: { title: "Vade-rétro" },
    content: `<form class="add2e-dialog" style="display:grid;gap:.7em;"><div style="padding:.6em;border:1px solid #d9bf73;border-radius:8px;background:#fff8e1;"><b>${esc(caster.name)}</b> tente un vade-rétro.<br><span style="font-size:.9em;">Niveau effectif de clerc : <b>${level}</b>${isPaladin ? ` (Paladin niveau ${nativeLevel} − 2)` : ""}. Après réussite, un unique jet de <b>2d6 DV</b> limitera les cibles affectées.</span></div><div style="font-size:.85em;line-height:1.35;max-height:160px;overflow:auto;"><b>Cibles Foundry :</b><br>${targetSummary}</div><div class="form-group"><label>Action</label><select name="mode"><option value="repousser" ${defaultMode === "repousser" ? "selected" : ""}>Repousser / détruire</option><option value="commander" ${defaultMode === "commander" ? "selected" : ""}>Commander / influencer</option></select></div><div class="form-group"><label>Catégorie forcée si nécessaire</label><select name="category"><option value="auto">Automatique</option>${ORDER.map(key => `<option value="${key}">${LABELS[key]}</option>`).join("")}</select></div></form>`,
    buttons: [
      { action: "roll", label: "Lancer", default: true, callback: (_event, button) => ({ mode: String(button.form?.elements?.mode?.value ?? defaultMode), category: String(button.form?.elements?.category?.value ?? "auto") }) },
      { action: "cancel", label: "Annuler", callback: () => null }
    ],
    rejectClose: false
  });
  if (!dialogResult) return false;

  const candidates = targets.map(token => ({
    token,
    actor: token.actor,
    category: detectCategory(token, dialogResult.category),
    hd: readHitDice(token.actor)
  })).sort((left, right) => (ORDER_INDEX.get(left.category) ?? 999) - (ORDER_INDEX.get(right.category) ?? 999) || left.hd - right.hd || String(left.actor.name).localeCompare(String(right.actor.name)));
  const col = columnIndex(level);
  const rollFormula = async formula => {
    const roll = await new Roll(formula).evaluate({ async: true });
    try { await game.dice3d?.showForRoll?.(roll); } catch (_error) {}
    return roll;
  };

  const poolRoll = await rollFormula("2d6");
  let remainingHD = Number(poolRoll.total) || 0;
  let used = false;
  let stopped = false;
  const rows = [];
  const groups = new Map();
  for (const candidate of candidates) {
    const key = candidate.category ?? "unknown";
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  for (const [category, group] of groups) {
    if (stopped) {
      for (const candidate of group) rows.push({ target: candidate.actor.name, result: "Non tenté", detail: "La tentative s’est arrêtée sur un type précédent." });
      continue;
    }
    if (!category || !TABLE[category]) {
      for (const candidate of group) rows.push({ target: candidate.actor.name, result: "Catégorie inconnue", detail: "Choisis une catégorie dans la fenêtre pour résoudre cette cible." });
      continue;
    }

    const entry = TABLE[category]?.[col] ?? null;
    if (!entry || (category === "special" && !group.some(candidate => specialEligible(candidate.actor)))) {
      for (const candidate of group) rows.push({ target: candidate.actor.name, result: "Non affectable", detail: `${LABELS[category]} ne peut pas être affecté au niveau effectif ${level}.` });
      stopped = true;
      continue;
    }

    let success = false;
    let rollText = "Automatique";
    if (String(entry).startsWith("T") || String(entry).startsWith("D")) {
      success = true;
    } else {
      const roll = await rollFormula("1d20");
      const threshold = Number(entry);
      rollText = `${roll.total} / ${threshold}`;
      success = roll.total >= threshold;
    }

    if (!success) {
      for (const candidate of group) rows.push({ target: candidate.actor.name, result: "Échec", detail: `${LABELS[category]} — table ${entry} — jet ${rollText}. Un échec met fin à la tentative.` });
      used = true;
      stopped = true;
      continue;
    }

    for (const candidate of group) {
      if (category === "special" && !specialEligible(candidate.actor)) {
        rows.push({ target: candidate.actor.name, result: "Non affectable", detail: "Démon ou diable trop puissant pour la ligne spéciale." });
        continue;
      }
      if (candidate.hd > remainingHD) {
        rows.push({ target: candidate.actor.name, result: "Pool insuffisant", detail: `${candidate.hd} DV requis ; ${remainingHD} DV restant(s). Les cibles plus puissantes ne peuvent plus être affectées.` });
        stopped = true;
        continue;
      }

      let resultLabel = "Repoussé";
      let effectName = "Repoussé par vade-rétro";
      let tags = [`vade_retro:${category}`, "etat:repousse_vade_retro"];
      if (String(entry).startsWith("D")) {
        if (dialogResult.mode === "commander") {
          resultLabel = "Dominé";
          effectName = "Dominé par vade-rétro";
          tags = [`vade_retro:${category}`, "etat:domine_vade_retro", "controle:clerc"];
        } else {
          resultLabel = "Détruit / damné";
          effectName = "Détruit par vade-rétro";
          tags = [`vade_retro:${category}`, "etat:detruit_vade_retro"];
        }
      } else if (dialogResult.mode === "commander") {
        resultLabel = "Influencé";
        effectName = "Influencé par vade-rétro";
        tags = [`vade_retro:${category}`, "etat:influence_vade_retro", "controle:clerc"];
      }

      const poolBefore = remainingHD;
      remainingHD -= candidate.hd;
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
              mode: dialogResult.mode,
              effectiveClericLevel: level,
              sourceClass: isPaladin ? "paladin" : "clerc",
              targetHitDice: candidate.hd,
              poolRoll: poolRoll.total,
              poolBefore,
              poolRemaining: remainingHD
            }
          }
        },
        description: `${effectName} — ${LABELS[category]} — coût ${candidate.hd} DV sur le pool de ${poolRoll.total} DV.`
      };

      if (game.user?.isGM || candidate.actor.isOwner) {
        try { await candidate.actor.createEmbeddedDocuments("ActiveEffect", [effectData]); } catch (error) { console.warn("[ADD2E][VADE-RETRO] ActiveEffect non appliqué.", error); }
      } else if (game.socket) {
        game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: candidate.actor.uuid, actorId: candidate.actor.id, effectData, fromUserId: game.user?.id, sentAt: Date.now() } });
      }
      rows.push({ target: candidate.actor.name, result: resultLabel, detail: `${LABELS[category]} — table ${entry} — jet ${rollText} — coût ${candidate.hd} DV (${remainingHD} DV restant(s)).` });
      used = true;
      if (remainingHD <= 0) {
        stopped = true;
        break;
      }
    }
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="add2e-chat-card" style="border:1.5px solid #c79b38;border-radius:12px;overflow:hidden;background:#fffaf0;box-shadow:0 3px 8px #0002;"><div style="background:linear-gradient(90deg,#8a5a13,#d4a83a);color:white;padding:8px 10px;display:flex;align-items:center;gap:8px;"><img src="${esc(caster.img)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="flex:1;"><div style="font-weight:800;">${esc(caster.name)}</div><div style="font-size:.9em;">Vade-rétro — niveau effectif de clerc ${level}${isPaladin ? ` (Paladin niveau ${nativeLevel})` : ""}</div></div></div><div style="padding:8px;"><div style="margin-bottom:7px;padding:6px 8px;border:1px solid #e7d8a0;border-radius:6px;background:#fffdf7;"><b>Pool de répulsion :</b> 2d6 = <b>${poolRoll.total} DV</b> — restant : <b>${remainingHD} DV</b>.</div>${rows.map(row => `<div style="border-bottom:1px solid #e7d8a0;padding:5px 0;"><b>${esc(row.target)}</b> — <b>${esc(row.result)}</b><br><span style="font-size:.9em;color:#5b4b26;">${esc(row.detail)}</span></div>`).join("") || "<div>Aucune cible n’a pu être résolue.</div>"}</div></div>`
  });

  return used;
})();
