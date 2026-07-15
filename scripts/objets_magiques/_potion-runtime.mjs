// ADD2E — moteur commun des potions du Guide du Maître — Foundry V13/V14/V15

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function actorHpPath(actor) {
  const s = actor?.system ?? {};
  const candidates = [
    ["system.pv.value", s?.pv?.value, s?.pv?.max],
    ["system.hp.value", s?.hp?.value, s?.hp?.max],
    ["system.points_de_vie.value", s?.points_de_vie?.value, s?.points_de_vie?.max],
    ["system.pointsDeVie.value", s?.pointsDeVie?.value, s?.pointsDeVie?.max]
  ];
  return candidates.find(([, value]) => Number.isFinite(Number(value))) ?? null;
}

async function rollFormula(formula) {
  const roll = await new Roll(formula).evaluate();
  return { roll, total: Number(roll.total) || 0 };
}

function selectedTargets(actor, selfOnly = false) {
  if (selfOnly) return actor ? [actor] : [];
  const targets = Array.from(game.user?.targets ?? []).map(t => t.actor).filter(Boolean);
  return targets.length ? targets : (actor ? [actor] : []);
}

async function confirmApply(config, targets, durationLabel) {
  if (!config.confirm) return true;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) return true;
  return await DialogV2.confirm({
    window: { title: config.name },
    modal: true,
    content: `<div class="add2e-dialog"><p><b>${esc(config.name)}</b></p><p>Cible(s) : <b>${esc(targets.map(t => t.name).join(", ") || "aucune")}</b></p><p>Durée : <b>${esc(durationLabel)}</b></p>${config.saveNote ? `<p>${esc(config.saveNote)}</p>` : ""}<p>Appliquer l'effet ?</p></div>`,
    yes: { label: "Appliquer", icon: "fa-solid fa-check" },
    no: { label: "Annuler", icon: "fa-solid fa-xmark" }
  });
}

async function recalculateCharacteristics(actor, reason = "potion-effect") {
  if (!actor?.system) return false;
  try {
    const sheet = actor.sheet;
    if (typeof sheet?.autoSetCaracAjustements === "function") {
      await sheet.autoSetCaracAjustements();
    }
    globalThis.add2eRerenderActorSheet?.(actor, true);
    return true;
  } catch (error) {
    console.warn("[ADD2E][POTION][CARACS][RECALCUL_ECHEC]", { actor: actor.name, reason, error });
    return false;
  }
}

function installCharacteristicEffectHooks() {
  if (globalThis.__ADD2E_POTION_CHARACTERISTIC_HOOKS_V1__) return;
  globalThis.__ADD2E_POTION_CHARACTERISTIC_HOOKS_V1__ = true;

  const needsRecalculation = effect => effect?.flags?.add2e?.potionCharacteristicEffect === true;
  const schedule = (effect, reason) => {
    if (!needsRecalculation(effect)) return;
    const actor = effect.parent?.documentName === "Actor" ? effect.parent : null;
    if (!actor) return;
    window.setTimeout(() => void recalculateCharacteristics(actor, reason), 20);
  };

  Hooks.on("createActiveEffect", effect => schedule(effect, "create-active-effect"));
  Hooks.on("updateActiveEffect", effect => schedule(effect, "update-active-effect"));
  Hooks.on("deleteActiveEffect", effect => schedule(effect, "delete-active-effect"));
}

installCharacteristicEffectHooks();

async function createEffect(target, config, durationRounds, extra = {}) {
  const tags = ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])];
  const changes = Array.isArray(config.changes) ? config.changes : [];
  const [effect] = await target.createEmbeddedDocuments("ActiveEffect", [{
    name: config.effectName || config.name,
    img: config.img || "icons/consumables/potions/potion-bottle-corked-blue.webp",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes,
    duration: durationRounds > 0 ? {
      rounds: durationRounds,
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    } : {},
    description: config.description || "",
    flags: { add2e: { tags, potion: true, potionSlug: config.slug, ...extra } }
  }]);
  if (effect && extra.potionCharacteristicEffect === true) await recalculateCharacteristics(target, "create-potion-characteristic-effect");
  return effect ?? null;
}

async function postChat(actor, config, html) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-chat-card" style="border:1px solid #7a4b19;border-radius:8px;background:#fff8e7;padding:8px;"><h3 style="margin:0 0 6px;">${esc(config.name)}</h3>${html}</div>`
  });
}

function actorIsFighter(actor) {
  return Array.from(actor?.items ?? []).some(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    const system = item.system ?? {};
    const text = [item.name, system.nom, system.name, system.label, system.slug]
      .map(value => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      .join(" ");
    return text.includes("guerrier");
  });
}

export async function runGiantStrengthPotion(context = {}) {
  const actor = context.actor ?? context.args?.[0]?.actor ?? null;
  const sourceItem = context.item ?? context.sourceItem ?? context.args?.[0]?.sourceItem ?? null;
  if (!actor) {
    ui.notifications.error("Potion de force de géant : acteur introuvable.");
    return false;
  }
  if (!actorIsFighter(actor)) {
    ui.notifications.warn("La potion de force de géant ne peut être utilisée que par un guerrier.");
    return false;
  }

  const table = [
    { giant: "Géant des collines", strength: 19, rockRange: 8, rockDamage: "1d6", doors: "50 %" },
    { giant: "Géant des pierres", strength: 20, rockRange: 16, rockDamage: "1d12", doors: "60 %" },
    { giant: "Géant du froid", strength: 21, rockRange: 10, rockDamage: "1d8", doors: "70 %" },
    { giant: "Géant du feu", strength: 22, rockRange: 12, rockDamage: "1d8", doors: "80 %" },
    { giant: "Géant des nuages", strength: 23, rockRange: 14, rockDamage: "1d10", doors: "90 %" },
    { giant: "Géant des tempêtes", strength: 24, rockRange: 16, rockDamage: "1d12", doors: "100 %" }
  ];

  const typeRoll = await new Roll("1d6").evaluate();
  const result = table[Math.max(0, Math.min(5, Number(typeRoll.total) - 1))];
  const durationRoll = await new Roll("2d4").evaluate();
  const durationRounds = Math.max(20, Number(durationRoll.total) * 10);
  const system = actor.system ?? {};
  const racialAdjustment = Number(system.bonus_caracteristiques?.force ?? 0) || Number(system.force_race ?? 0) || 0;
  const overriddenBase = result.strength - racialAdjustment;
  const overrideMode = CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5;

  await typeRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Potion de force de géant — type de géant" });
  await durationRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Potion de force de géant — durée en tours" });

  await createEffect(actor, {
    name: "Potion de force de géant",
    slug: "force_de_geant",
    img: sourceItem?.img,
    description: `Force équivalente à celle d'un ${result.giant.toLowerCase()} pendant ${durationRounds} rounds.`,
    tags: [
      `force:${result.strength}`,
      `geant:${result.giant.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_")}`,
      "lancer_rochers",
      `rocher_portee:${result.rockRange}`,
      `rocher_degats:${result.rockDamage}`,
      `portes:${result.doors.replace(/\s+/g, "")}`
    ],
    changes: [
      { key: "system.force_base", mode: overrideMode, value: String(overriddenBase), priority: 100 },
      { key: "system.force_ex", mode: overrideMode, value: "0", priority: 100 }
    ]
  }, durationRounds, {
    potionCharacteristicEffect: true,
    characteristic: "force",
    characteristicValue: result.strength,
    giantType: result.giant,
    rockRange: result.rockRange,
    rockDamage: result.rockDamage,
    doors: result.doors,
    sourceItemId: sourceItem?.id ?? null
  });

  await postChat(actor, { name: "Potion de force de géant" }, `
    <p>Type obtenu : <b>${esc(result.giant)}</b>.</p>
    <p>Force temporaire : <b>${result.strength}</b>.</p>
    <p>Durée : <b>${durationRounds} rounds</b> (${Number(durationRoll.total)} tours).</p>
    <p>Lancer de rochers : portée <b>${result.rockRange}\"</b>, dégâts <b>${esc(result.rockDamage)}</b>.</p>
    <p>Ouverture des portes : <b>${esc(result.doors)}</b>.</p>
    <p>Les ajustements de Force sont recalculés par le système de caractéristiques.</p>
  `);
  return true;
}

async function runHealing(actor, config) {
  const { roll, total } = await rollFormula(config.formula);
  const hp = actorHpPath(actor);
  if (!hp) {
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: config.name });
    await postChat(actor, config, `<p>Soins obtenus : <b>${total}</b>. Aucun champ de points de vie compatible n'a été trouvé ; appliquez-les manuellement.</p>`);
    return true;
  }
  const [path, current, max] = hp;
  const ceiling = Number.isFinite(Number(max)) ? Number(max) : Number(current) + total;
  const next = Math.min(ceiling, Number(current) + total);
  await actor.update({ [path]: next }, { add2eInternal: true, add2eReason: "potion-healing" });
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: config.name });
  await postChat(actor, config, `<p>Points de vie : <b>${current} → ${next}</b> (${total} récupérés).</p>`);
  return true;
}

async function runAge(actor, config) {
  const { roll, total } = await rollFormula(config.formula);
  const s = actor?.system ?? {};
  const paths = [
    ["system.age", s.age],
    ["system.details.age", s?.details?.age],
    ["system.age_actuel", s.age_actuel]
  ];
  const found = paths.find(([, value]) => Number.isFinite(Number(value)));
  let detail;
  if (found) {
    const [path, value] = found;
    const next = Math.max(0, Number(value) - total);
    await actor.update({ [path]: next }, { add2eInternal: true, add2eReason: "potion-age" });
    detail = `Âge : <b>${value} → ${next}</b>.`;
  } else {
    await createEffect(actor, config, 0, { ageReduction: total, permanentUntilResolved: true });
    detail = `Réduction d'âge à appliquer : <b>${total}</b> an(s).`;
  }
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: config.name });
  await postChat(actor, config, `<p>${detail}</p>`);
  return true;
}

async function runHeroism(actor, config) {
  const level = Number(actor?.system?.niveau ?? actor?.system?.level ?? 0) || 0;
  if (level >= Number(config.maxLevelExclusive ?? 10)) {
    ui.notifications.warn(`${config.name} est sans effet sur un personnage de niveau ${level}.`);
    return false;
  }
  const bonus = config.levelTable?.find(row => level >= row.min && level <= row.max)?.bonus ?? config.bonus ?? 1;
  const hpDice = config.levelTable?.find(row => level >= row.min && level <= row.max)?.hpDice ?? config.hpDice ?? "1d10";
  const { roll, total } = await rollFormula(hpDice);
  await createEffect(actor, config, Number(config.durationRounds ?? 0), { temporaryLevels: bonus, temporaryHp: total });
  await postChat(actor, config, `<p>Niveaux d'énergie temporaires : <b>+${bonus}</b>.</p><p>Résistance temporaire : <b>${total}</b> point(s).</p><p>Ces valeurs sont portées par l'effet actif et doivent être prises en compte par les jets de combat.</p>`);
  return true;
}

export async function runPotion(context, config) {
  const actor = context?.actor ?? context?.args?.[0]?.actor ?? null;
  if (!actor) {
    ui.notifications.error(`${config.name} : acteur introuvable.`);
    return false;
  }

  if (config.kind === "healing") return runHealing(actor, config);
  if (config.kind === "age") return runAge(actor, config);
  if (config.kind === "heroism") return runHeroism(actor, config);
  if (config.kind === "deception") {
    await createEffect(actor, config, 0, { deceptivePotion: true, apparentEffect: config.apparentEffect || "soins" });
    await postChat(actor, config, `<p>Le personnage est persuadé que la potion a produit l'effet attendu. Aucun bénéfice réel n'est appliqué.</p>`);
    return true;
  }

  let durationRounds = Number(config.durationRounds ?? 0) || 0;
  let durationLabel = durationRounds ? `${durationRounds} round(s)` : "selon le MD";
  if (config.durationFormula) {
    const rolled = await rollFormula(config.durationFormula);
    durationRounds = rolled.total * Number(config.durationMultiplier ?? 1);
    durationLabel = `${durationRounds} round(s)`;
    await rolled.roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${config.name} — durée` });
  }

  const targets = selectedTargets(actor, config.selfOnly === true);
  if (!targets.length) {
    ui.notifications.warn(`${config.name} : aucune cible.`);
    return false;
  }

  if (!await confirmApply(config, targets, durationLabel)) return false;
  for (const target of targets) await createEffect(target, config, durationRounds, config.extraFlags ?? {});
  await postChat(actor, config, `<p>Effet appliqué à : <b>${esc(targets.map(t => t.name).join(", "))}</b>.</p><p>Durée : <b>${esc(durationLabel)}</b>.</p>${config.rule ? `<p>${esc(config.rule)}</p>` : ""}`);
  return true;
}
