// ADD2E — Capacité de classe : Vade-rétro
// Compatible Foundry V13 / V14 / V15 - DialogV2 uniquement.

const ADD2E_VADE_RETRO_VERSION = "2026-07-05-dialog-v2-paladin-level-combat-use-v2";

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

  const combatId = game.combat?.id ?? null;
  const usageFlagKey = combatId ? `vadeRetro.${combatId}` : "";
  const priorUse = usageFlagKey ? caster.getFlag("add2e", usageFlagKey) : null;
  if (priorUse?.used) {
    ui.notifications.warn("Vade-rétro a déjà été tenté pour ce combat.");
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []);
  if (!targets.length) {
    ui.notifications.warn("Vade-rétro : cible au moins une créature.");
    return false;
  }

  const alignement = String(caster.system?.alignement ?? caster.system?.alignment ?? "").toLowerCase();
  const defaultMode = alignement.includes("mauvais") ? "commander" : "repousser";

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
    squelette: "Squelette",
    zombie: "Zombie",
    goule: "Goule",
    ombre: "Ombre",
    necrophage: "Nécrophage",
    ghast: "Ghast",
    ame_en_peine: "Âme en peine",
    momie: "Momie",
    spectre: "Spectre",
    vampire: "Vampire",
    fantome: "Fantôme",
    liche: "Liche",
    special: "Démon / diable inférieur"
  };
  const ORDER = ["squelette", "zombie", "goule", "ombre", "necrophage", "ghast", "ame_en_peine", "momie", "spectre", "vampire", "fantome", "liche", "special"];

  const columnIndex = clericLevel => {
    if (clericLevel <= 0) return -1;
    if (clericLevel <= 8) return clericLevel - 1;
    if (clericLevel <= 13) return 8;
    return 9;
  };

  const getTypeText = targetActor => {
    const system = targetActor?.system ?? {};
    return [
      targetActor?.name,
      system.type,
      system.type_creature,
      system.creatureType,
      system.categorie,
      system.famille,
      system.race,
      system.type_mort_vivant,
      system.typeMortVivant,
      system.undeadType,
      system.tags,
      system.effectTags
    ].flat().map(normalize).join(" ");
  };

  const detectCategory = (targetToken, forced) => {
    if (forced && forced !== "auto") return forced;
    const text = getTypeText(targetToken?.actor);
    const entries = [
      ["ame_en_peine", ["ame_en_peine", "wight"]],
      ["necrophage", ["necrophage"]],
      ["squelette", ["squelette", "skeleton"]],
      ["zombie", ["zombie"]],
      ["goule", ["goule", "ghoul"]],
      ["ombre", ["ombre", "shadow"]],
      ["ghast", ["ghast"]],
      ["momie", ["momie", "mummy"]],
      ["spectre", ["spectre", "specter"]],
      ["vampire", ["vampire"]],
      ["fantome", ["fantome", "ghost"]],
      ["liche", ["liche", "lich"]],
      ["special", ["diable", "demon", "devil", "daemon", "plan_inferieur", "plans_inferieurs"]]
    ];
    for (const [category, keys] of entries) if (keys.some(key => text.includes(key))) return category;
    if (text.includes("mort_vivant") || text.includes("undead")) return null;
    return null;
  };

  const specialEligible = targetActor => {
    const system = targetActor?.system ?? {};
    const ac = Number(system.ca_total ?? system.ca ?? system.ac ?? system.armorClass ?? NaN);
    const hd = Number(system.dv ?? system.hd ?? system.hitDice ?? system.des_de_vie ?? system.niveau ?? NaN);
    const magicResistance = Number(system.resistance_magie ?? system.resistanceMagie ?? system.magicResistance ?? system.rm ?? system.mr ?? 0);
    return !(Number.isFinite(ac) && ac <= -5) && !(Number.isFinite(hd) && hd >= 11) && !(Number.isFinite(magicResistance) && magicResistance >= 66);
  };

  const dialogContent = `
    <form class="add2e-dialog" style="display:flex;flex-direction:column;gap:8px;">
      <div style="background:#fff8e1;border:1px solid #d9bf73;border-radius:8px;padding:8px;">
        <b>${caster.name}</b> tente un vade-rétro sur <b>${targets.length}</b> cible(s).<br>
        <span style="font-size:.9em;">Niveau effectif de clerc : <b>${level}</b>${isPaladin ? ` (Paladin niveau ${nativeLevel} − 2)` : ""}.</span>
      </div>
      <div class="form-group"><label>Action</label><select name="mode"><option value="repousser" ${defaultMode === "repousser" ? "selected" : ""}>Repousser / détruire</option><option value="commander" ${defaultMode === "commander" ? "selected" : ""}>Commander / influencer</option></select></div>
      <div class="form-group"><label>Catégorie forcée si nécessaire</label><select name="category"><option value="auto">Automatique</option>${ORDER.map(key => `<option value="${key}">${LABELS[key]}</option>`).join("")}</select></div>
    </form>`;

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Vade-rétro : DialogV2 est indisponible.");
    return false;
  }
  const dialogResult = await DialogV2.wait({
    window: { title: "Vade-rétro" },
    content: dialogContent,
    buttons: [
      {
        action: "roll",
        label: "Lancer",
        default: true,
        callback: (_event, button) => ({
          mode: String(button.form?.elements?.mode?.value ?? defaultMode),
          category: String(button.form?.elements?.category?.value ?? "auto")
        })
      },
      { action: "cancel", label: "Annuler", callback: () => null }
    ],
    rejectClose: false
  });
  if (!dialogResult) return false;

  const col = columnIndex(level);
  const rows = [];
  let used = false;
  const rollFormula = async formula => {
    const roll = await new Roll(formula).evaluate({ async: true });
    try { await game.dice3d?.showForRoll?.(roll); } catch (_error) {}
    return roll;
  };

  for (const targetToken of targets) {
    const targetActor = targetToken?.actor;
    if (!targetActor) continue;
    const category = detectCategory(targetToken, dialogResult.category);
    if (!category) {
      rows.push({ target: targetActor.name, result: "Catégorie inconnue", detail: "Le type est mort-vivant, mais la catégorie exacte doit être choisie." });
      continue;
    }

    const entry = TABLE[category]?.[col] ?? null;
    if (!entry) {
      rows.push({ target: targetActor.name, result: "Aucun effet", detail: `${LABELS[category]} impossible à affecter au niveau effectif ${level}.` });
      used = true;
      continue;
    }
    if (category === "special" && !specialEligible(targetActor)) {
      rows.push({ target: targetActor.name, result: "Non affectable", detail: "Démon ou diable trop puissant pour la ligne spéciale." });
      used = true;
      continue;
    }

    let success = false;
    let rollText = "Automatique";
    if (String(entry).startsWith("T") || String(entry).startsWith("D")) {
      success = true;
    } else {
      const threshold = Number(entry);
      const roll = await rollFormula("1d20");
      rollText = `${roll.total} / ${threshold}`;
      success = roll.total >= threshold;
    }

    if (!success) {
      rows.push({ target: targetActor.name, result: "Échec", detail: `${LABELS[category]} — table ${entry} — jet ${rollText}` });
      used = true;
      continue;
    }

    const qtyFormula = category === "special" ? "1d2" : String(entry).includes("*") ? "1d6+6" : "1d12";
    const qty = await rollFormula(qtyFormula);
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

    const effectData = {
      name: effectName,
      img: "icons/magic/holy/barrier-shield-winged-cross.webp",
      transfer: false,
      disabled: false,
      duration: {},
      changes: [],
      flags: { add2e: { tags, vadeRetro: { casterUuid: caster.uuid, casterName: caster.name, category, entry, mode: dialogResult.mode, quantity: qty.total, effectiveClericLevel: level, sourceClass: isPaladin ? "paladin" : "clerc" } } },
      description: `${effectName} — ${LABELS[category]} — ${qty.total} créature(s) affectable(s).`
    };

    if (game.user?.isGM || targetActor.isOwner) {
      try { await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]); } catch (error) { console.warn("[ADD2E][VADE-RETRO] ActiveEffect non appliqué.", error); }
    } else if (game.socket) {
      game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: targetActor.uuid, actorId: targetActor.id, effectData, fromUserId: game.user?.id, sentAt: Date.now() } });
    }

    rows.push({ target: targetActor.name, result: resultLabel, detail: `${LABELS[category]} — table ${entry} — jet ${rollText} — nombre ${qty.result} = ${qty.total}` });
    used = true;
  }

  if (used && usageFlagKey) {
    await caster.setFlag("add2e", usageFlagKey, { used: true, combatId, level, sourceClass: isPaladin ? "paladin" : "clerc", at: Date.now() });
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="add2e-chat-card" style="border:1.5px solid #c79b38;border-radius:12px;overflow:hidden;background:#fffaf0;box-shadow:0 3px 8px #0002;"><div style="background:linear-gradient(90deg,#8a5a13,#d4a83a);color:white;padding:8px 10px;display:flex;align-items:center;gap:8px;"><img src="${caster.img}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="flex:1;"><div style="font-weight:800;">${caster.name}</div><div style="font-size:.9em;">Vade-rétro — niveau effectif de clerc ${level}${isPaladin ? ` (Paladin niveau ${nativeLevel})` : ""}</div></div></div><div style="padding:8px;">${rows.map(row => `<div style="border-bottom:1px solid #e7d8a0;padding:5px 0;"><b>${row.target}</b> — <b>${row.result}</b><br><span style="font-size:.9em;color:#5b4b26;">${row.detail}</span></div>`).join("")}</div></div>`
  });

  return used;
})();
