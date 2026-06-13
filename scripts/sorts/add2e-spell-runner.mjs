/** ADD2E - Runners generiques par type de mecanique - Foundry V13/V14/V15. */
import { ADD2E_SPELL_MECHANICS } from "./add2e-spell-mechanics.mjs";
import { ADD2E_SPELL_CATALOG } from "./add2e-spell-catalog.mjs";

const { escapeHtml: esc, targetActors, activeTags, sourceContext, confirmDialog, playVfx, chat, standardStatus, effectData, createEffect, createTemporaryItems, rollSave, targetRule, targetNames: names, alignmentOf, applyMany } = ADD2E_SPELL_MECHANICS;

async function runAugure(ctx, spell) {
  const chance = Math.min(100, 70 + ctx.level);
  const result = await confirmDialog(spell, `<p>Décris l'action envisagée. L'augure porte sur les <b>3 prochains tours</b>.</p><p>Chance correcte calculée : <b>${chance} %</b>. Le MJ formule la réponse.</p>`, `<label>Action envisagée<textarea name="question" rows="3" required></textarea></label>`, form => ({ question: String(form.elements.question?.value ?? "").trim() }));
  if (!result?.question) return false;
  await playVfx(spell, ctx.casterToken);
  await chat(ctx.caster, ctx.casterToken, spell, `<p><b>Action :</b> ${esc(result.question)}</p><p><b>Chance correcte :</b> ${chance} %.</p><p>Réponse et ajustements réservés au MJ.</p>`);
  return true;
}
async function runCantique(ctx, spell) {
  const result = await confirmDialog(spell, `<p>Le clerc chante sans se déplacer. Applique les effets aux cibles sélectionnées dans le rayon de 3 pouces.</p><p><b>Cibles :</b> ${names(ctx.targets)}</p>`, `<label>Groupe<select name="group"><option value="allies">Alliés (+1)</option><option value="enemies">Ennemis (-1)</option></select></label>`, form => ({ group: form.elements.group?.value }));
  if (!result) return false;
  await createEffect(ctx.caster, effectData({ spell, sourceItem: ctx.sourceItem, tags: ["etat:cantique", "requires_concentration", "suppression:manuelle", "zone:cantique:3_pouces"], extra: { requiresConcentration: true, manualRemoval: true } }));
  const plus = result.group === "allies";
  const tags = plus ? ["etat:cantique_allie", "bonus_attaque:1", "bonus_degats:1", "bonus_save:1"] : ["etat:cantique_ennemi", "malus_attaque:-1", "malus_degats:-1", "bonus_save:-1"];
  await applyMany(targetActors(ctx.targets), () => effectData({ spell, sourceItem: ctx.sourceItem, tags, extra: { manualRemoval: true, group: result.group } }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>${ctx.targets.length} cible(s) affectée(s) comme <b>${plus ? "alliées" : "ennemies"}</b>.</p><p>Effet sans durée fixe : retirer les ActiveEffects dès que le chant, l'immobilité ou la concentration cesse.</p>`);
  return true;
}
async function runSnakeCharm(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 1, 99)) return false;
  const hpLimit = Number(ctx.caster.system?.points_de_coup ?? ctx.caster.system?.pdv ?? 0) || 0;
  const result = await confirmDialog(spell, `<p><b>Cibles ophidiennes :</b> ${names(ctx.targets)}</p><p>Limite de PV du clerc : <b>${hpLimit || "à confirmer"}</b>.</p>`, `<label>Total des PV ciblés<input name="hp" type="number" min="0" required></label><label>État<select name="state"><option value="torpor">torpeur (1d4+2 tours)</option><option value="awake">éveillés sans agressivité (1d3 tours)</option><option value="aggressive">agressifs (1d4+4 rounds)</option></select></label><label><input name="ophidian" type="checkbox" required> Je confirme que toutes les cibles sont ophidiennes</label>`, form => ({ hp: Number(form.elements.hp?.value), state: form.elements.state?.value, ophidian: form.elements.ophidian?.checked }));
  if (!result?.ophidian || (hpLimit > 0 && result.hp > hpLimit)) { ui.notifications?.warn?.(`${spell.name} : nature ophidienne ou limite de PV non confirmée.`); return false; }
  const formula = result.state === "torpor" ? "1d4+2" : result.state === "awake" ? "1d3" : "1d4+4";
  const roll = await new Roll(formula).evaluate({ async: true });
  const rounds = Number(roll.total) * (result.state === "aggressive" ? 1 : 10);
  await applyMany(targetActors(ctx.targets), () => effectData({ spell, sourceItem: ctx.sourceItem, rounds, tags: ["etat:charme_serpents", "etat:calme", `charme_serpents:${result.state}`], status: standardStatus("charmed", "charm"), extra: { state: result.state, totalTargetHp: result.hp } }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>${ctx.targets.length} serpent(s), ${result.hp} PV déclarés. Durée : <b>${roll.total} ${result.state === "aggressive" ? "rounds" : "tours"}</b>.</p>`);
  return true;
}
async function runDetectCharms(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 1, 10)) return false;
  const result = await confirmDialog(spell, `<p>Inspecter les états centralisés de ${names(ctx.targets)}. Maximum : 10 créatures.</p>`);
  if (!result) return false;
  const findings = targetActors(ctx.targets).map(a => ({ name: a.name, found: activeTags(a).some(t => t.includes("charme") || t.includes("charm")) }));
  await createEffect(ctx.caster, effectData({ spell, sourceItem: ctx.sourceItem, rounds: 10, tags: ["etat:detection_charmes", "detection:charme"] }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  const gm = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  await chat(ctx.caster, ctx.casterToken, spell, findings.map(f => `<p><b>${esc(f.name)}</b> : ${f.found ? "état de charme centralisé détecté" : "aucun état centralisé détecté ; vérification MJ requise"}.</p>`).join(""), { whisper: gm });
  return true;
}
async function runDetectTraps(ctx, spell) {
  const result = await confirmDialog(spell, `<p>Active la détection des pièges dans un chemin de <b>3 m de large et 12 m de long</b>, dans la direction choisie.</p><p>Chance de détection : <b>10 % par niveau, maximum 90 %</b>. Durée : 3 tours.</p>`);
  if (!result) return false;
  await createEffect(ctx.caster, effectData({ spell, sourceItem: ctx.sourceItem, rounds: 30, tags: ["etat:detection_pieges", "detection:pieges"], extra: { chancePercent: Math.min(90, 10 * ctx.level), zone: "3m x 12m" } }));
  await playVfx(spell, ctx.casterToken);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>Détection active pendant <b>3 tours</b>. Chance : <b>${Math.min(90, 10 * ctx.level)} %</b>. Le MJ révèle les pièges compatibles.</p>`);
  return true;
}
async function runAnimalLanguage(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 0, 1)) return false;
  const result = await confirmDialog(spell, `<p>Communication avec un type d'animal pendant <b>${2 * ctx.level} rounds</b>. La réaction et les services restent résolus par le MJ.</p><p><b>Cible :</b> ${names(ctx.targets)}</p>`);
  if (!result) return false;
  const rounds = 2 * ctx.level;
  await createEffect(ctx.caster, effectData({ spell, sourceItem: ctx.sourceItem, rounds, tags: ["etat:langage_animal", "communication:animal"] }));
  await applyMany(targetActors(ctx.targets), () => effectData({ spell, sourceItem: ctx.sourceItem, rounds, tags: ["communication:langage_animal"] }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>Communication active pendant <b>${rounds} rounds</b>.</p>`);
  return true;
}
async function runSpiritualHammer(ctx, spell) {
  const result = await confirmDialog(spell, `<p>Crée un marteau temporaire équipé : dégâts <b>1d6 contre P-M</b>, <b>1d4 contre G</b>, attaque comme le clerc, sans bonus propre au toucher ou aux dégâts.</p><p>Durée : <b>${ctx.level} rounds</b>. Valeur magique contre immunités : <b>+${Math.floor(ctx.level / 3)}</b>.</p>`);
  if (!result) return false;
  if (!(ctx.caster.isOwner || game.user?.isGM)) { ui.notifications?.error?.(`${spell.name} : droits insuffisants pour créer l'arme temporaire.`); return false; }
  const [weapon] = await ctx.caster.createEmbeddedDocuments("Item", [{ name: spell.name, type: "arme", img: ctx.sourceItem?.img, system: { equipee: true, degats_pm: "1d6", degats_g: "1d4", degats: "1d6", damage: "1d6", type_degats: "contondant", tags: ["arme:marteau_spirituel", "attaque:magique", `arme_magique:${Math.floor(ctx.level / 3)}`] }, flags: { add2e: { temporarySpellItem: true, sourceSpell: spell.name, attackAsCaster: true, noIntrinsicHitOrDamageBonus: true } } }]);
  await createEffect(ctx.caster, effectData({ spell, sourceItem: ctx.sourceItem, rounds: ctx.level, tags: ["etat:marteau_spirituel", "arme:marteau_spirituel", "attaque:magique"], extra: { temporaryItemId: weapon?.id ?? null, magicValue: Math.floor(ctx.level / 3) } }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>Arme temporaire créée et équipée pour <b>${ctx.level} rounds</b>. Elle sera supprimée à l'expiration de l'ActiveEffect.</p><p>Les composants sont gérés par le résolveur central de lancement.</p>`);
  return true;
}
async function runParalysis(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 1, 3)) return false;
  const penalty = ctx.targets.length === 1 ? -2 : ctx.targets.length === 2 ? -1 : 0;
  const result = await confirmDialog(spell, `<p><b>${ctx.targets.length}</b> cible(s) humanoïde(s). JP paralysie avec modificateur <b>${penalty}</b>. Durée sur échec : <b>${4 + ctx.level} rounds</b>.</p>`, `<label><input name="humanoids" type="checkbox" required> Je confirme que les cibles sont humanoïdes</label>`, form => ({ humanoids: form.elements.humanoids?.checked }));
  if (!result?.humanoids) return false;
  const failed = [], lines = [];
  for (const actor of targetActors(ctx.targets)) {
    const save = await rollSave(actor, { index: 0, vsType: "paralysie", modifier: penalty });
    lines.push(`<p><b>${esc(actor.name)}</b> : ${save.available ? `${save.total}/${save.threshold} (${save.success ? "réussite" : "échec"})` : "JP indisponible, aucun effet appliqué"}.</p>`);
    if (save.available && !save.success) failed.push(actor);
  }
  await applyMany(failed, () => effectData({ spell, sourceItem: ctx.sourceItem, rounds: 4 + ctx.level, tags: ["etat:paralysie", "etat:immobilisation"], status: standardStatus("paralyzed", "paralysis") }));
  await playVfx(spell, ctx.casterToken, ctx.targets.filter(t => failed.includes(t.actor)));
  await chat(ctx.caster, ctx.casterToken, spell, lines.join("") + `<p>${failed.length} ActiveEffect(s) de paralysie appliqué(s).</p>`);
  return true;
}
async function runAlignment(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 1, 10)) return false;
  const result = await confirmDialog(spell, `<p>Perçoit l'alignement de ${names(ctx.targets)} pendant 1 tour. Les protections et objets contraires restent soumis à validation du MJ.</p>`);
  if (!result) return false;
  await createEffect(ctx.caster, effectData({ spell, sourceItem: ctx.sourceItem, rounds: 10, tags: ["etat:perception_alignements", "detection:alignement"] }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  const gm = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  const body = targetActors(ctx.targets).map(a => `<p><b>${esc(a.name)}</b> : ${alignmentOf(a) ? esc(alignmentOf(a)) : "alignement non structuré ; validation MJ requise"}.</p>`).join("");
  await chat(ctx.caster, ctx.casterToken, spell, body, { whisper: gm });
  return true;
}
async function runFireResistance(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 1, 1)) return false;
  const result = await confirmDialog(spell, `<p>Applique à <b>${names(ctx.targets)}</b> une résistance au feu pendant <b>${ctx.level} tours</b> : +3 au JP, quart des dégâts si réussi, moitié si raté.</p>`);
  if (!result) return false;
  await createEffect(ctx.targets[0].actor, effectData({ spell, sourceItem: ctx.sourceItem, rounds: 10 * ctx.level, tags: ["resistance:feu", "etat:resistance_feu", "sort:resistance_au_feu", "bonus_js_vs:feu:3", "bonus_save_vs:feu:3", "degats_feu_si_save_rate:moitie", "degats_feu_si_save_reussi:quart"] }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>ActiveEffect appliqué pour <b>${10 * ctx.level} rounds</b>. Le résolveur central de dégâts gère désormais le JP et la réduction feu.</p>`);
  return true;
}
async function runDelayPoison(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 1, 1)) return false;
  const result = await confirmDialog(spell, `<p>Suspend temporairement les effets du poison sur <b>${names(ctx.targets)}</b> pendant <b>${ctx.level} heure(s)</b>.</p><p>Le suivi de 1 PV par tour, sans descendre sous 1 PV, et le cas post-mortem restent validés par le MJ.</p>`);
  if (!result) return false;
  await createEffect(ctx.targets[0].actor, effectData({ spell, sourceItem: ctx.sourceItem, rounds: 600 * ctx.level, tags: ["etat:poison_retarde", "poison:retarde"], extra: { periodicDamage: { amount: 1, intervalRounds: 10, minimumHp: 1 }, canTemporarilyRestorePoisonDeath: true } }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>ActiveEffect de suivi appliqué pour <b>${600 * ctx.level} rounds</b>. La perte de PV n'est pas automatisée faute de moteur périodique central.</p>`);
  return true;
}
async function runSilence(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 0, 1)) return false;
  const result = await confirmDialog(spell, `<p>Zone sphérique de <b>9 m de diamètre</b>, durée <b>${2 * ctx.level} rounds</b>.</p><p>Cible sélectionnée : ${names(ctx.targets)}.</p>`, `<label>Mode<select name="mode"><option value="attached">sur créature / objet mobile</option><option value="fixed">zone fixe suivie sur le lanceur</option></select></label><label><input name="unwilling" type="checkbox"> cible non consentante (JP contre les sorts)</label>`, form => ({ mode: form.elements.mode?.value, unwilling: form.elements.unwilling?.checked }));
  if (!result) return false;
  if (result.mode === "attached" && ctx.targets.length !== 1) { ui.notifications?.warn?.(`${spell.name} : le mode mobile exige exactement une cible.`); return false; }
  let recipient = result.mode === "attached" ? ctx.targets[0].actor : ctx.caster;
  if (result.unwilling && result.mode === "attached") {
    const save = await rollSave(recipient, { index: 4, vsType: "sorts", modifier: 0 });
    if (!save.available) { ui.notifications?.warn?.(`${spell.name} : JP indisponible, aucun effet appliqué.`); return false; }
    if (save.success) recipient = ctx.caster;
  }
  const mobile = recipient !== ctx.caster || result.mode === "attached";
  const tags = mobile ? ["etat:silence", "silence:verbal", "anti_sort:verbal", "zone:silence:9m"] : ["etat:silence_zone_fixe", "zone:silence:9m", "suivi:mj"];
  await createEffect(recipient, effectData({ spell, sourceItem: ctx.sourceItem, rounds: 2 * ctx.level, tags, extra: { mode: mobile ? "attached" : "fixed", diameterMeters: 9 } }));
  await playVfx(spell, ctx.casterToken, ctx.targets);
  await chat(ctx.caster, ctx.casterToken, spell, `<p>Effet appliqué pour <b>${2 * ctx.level} rounds</b>. Le résolveur central bloque les sorts verbaux lorsqu'un acteur porte l'effet de silence.</p><p>Une zone fixe reste suivie par le MJ, le système ne disposant pas d'un résolveur géométrique central des zones.</p>`);
  return true;
}

async function runCreateFoodWaterAssist(ctx, spell) {
  const totalVolume = 27 * ctx.level;
  const humanoids = 3 * ctx.level;
  const horses = ctx.level;
  const recipients = Array.from(new Map([ctx.caster, ...targetActors(ctx.targets)].filter(Boolean).map(actor => [actor.id, actor])).values());
  const recipientOptions = recipients.map(actor => '<option value="' + esc(actor.id) + '">' + esc(actor.name) + '</option>').join("");
  const result = await confirmDialog(spell, '<p>Crée <b>' + totalVolume + ' dm³</b> de nourriture et/ou d’eau.</p><p>Cette quantité nourrit <b>' + humanoids + ' créatures de taille humaine</b> ou <b>' + horses + ' créature(s) de taille cheval</b> pendant une journée.</p>', '<label>Répartition<select name="mode"><option value="food">nourriture uniquement</option><option value="water">eau uniquement</option><option value="equal">nourriture et eau en quantités égales</option></select></label><label>Inventaire destinataire<select name="recipient">' + recipientOptions + '</select></label>', form => ({ mode: form.elements.mode?.value, recipientId: form.elements.recipient?.value }));
  if (!result) return false;
  const recipient = recipients.find(actor => actor.id === result.recipientId) ?? ctx.caster;
  if (!recipient) return false;
  const portions = result.mode === "equal" ? totalVolume / 2 : totalVolume;
  const items = [];
  if (result.mode !== "water") items.push({ name: "Nourriture créée par Manne", type: spell.itemType, quantity: portions, unit: "dm³", img: "icons/consumables/food/bowl-stew-brown.webp", description: "Nourriture créée par Manne. Volume : " + portions + " dm³.", tags: ["sort:manne", "creation:nourriture"], flags: { creationKind: "food", volumeDm3: portions } });
  if (result.mode !== "food") items.push({ name: "Eau créée par Manne", type: spell.itemType, quantity: portions, unit: "dm³", img: "icons/consumables/drinks/water-jug-blue.webp", description: "Eau créée par Manne. Volume : " + portions + " dm³.", tags: ["sort:manne", "creation:eau"], flags: { creationKind: "water", volumeDm3: portions } });
  const created = await createTemporaryItems(recipient, { spell, sourceItem: ctx.sourceItem, creator: ctx.caster, items });
  if (created.length !== items.length) return false;
  await playVfx(spell, ctx.casterToken, ctx.targets);
  const itemSummary = created.map(item => esc(item.name) + " (" + (item.system?.quantite ?? "?") + " dm³)").join(", ");
  await chat(ctx.caster, ctx.casterToken, spell, '<p><b>' + created.length + ' Item(s) technique(s)</b> créé(s) dans l’inventaire de <b>' + esc(recipient.name) + '</b>.</p><p>Quantité : ' + itemSummary + '.</p><p>Capacité journalière : ' + humanoids + ' créatures de taille humaine ou ' + horses + ' créature(s) de taille cheval.</p>');
  return true;
}
function speakDeadLimits(level) {
  if (level <= 6) return { elapsed: "1 semaine", rounds: 1, duration: "1 round", questions: 2 };
  if (level <= 8) return { elapsed: "1 mois", rounds: 3, duration: "3 rounds", questions: 3 };
  if (level <= 12) return { elapsed: "1 année", rounds: 10, duration: "1 tour", questions: 4 };
  if (level <= 15) return { elapsed: "10 ans", rounds: 20, duration: "2 tours", questions: 5 };
  if (level <= 20) return { elapsed: "100 ans", rounds: 30, duration: "3 tours", questions: 6 };
  return { elapsed: "1 000 ans", rounds: 60, duration: "6 tours", questions: 7 };
}
async function runSpeakWithDead(ctx, spell) {
  if (!targetRule(spell, ctx.targets, 0, 1)) return false;
  const limits = speakDeadLimits(ctx.level);
  const result = await confirmDialog(spell, '<p>Aide MJ pour converser avec des restes. Le lanceur doit parler la langue de la créature morte.</p><p><b>Temps maximal depuis la mort :</b> ' + limits.elapsed + '. <b>Durée :</b> ' + limits.duration + '. <b>Questions :</b> ' + limits.questions + '.</p><p><b>Cible/restes sélectionnés :</b> ' + names(ctx.targets) + '.</p>', '<label><input name="remains" type="checkbox" required> Je confirme que le corps, les restes ou la partie concernée sont disponibles</label><label><input name="language" type="checkbox" required> Je confirme une langue commune</label>', form => ({ remains: form.elements.remains?.checked, language: form.elements.language?.checked }));
  if (!result?.remains || !result?.language) return false;
  const recipient = ctx.targets[0]?.actor ?? ctx.caster;
  const tracking = await createEffect(recipient, effectData({ spell, sourceItem: ctx.sourceItem, rounds: limits.rounds, tags: ["etat:necromancie", "communication:morts", "suivi:questions_morts"], extra: { effectType: "speak_with_dead", questionsMax: limits.questions, questionsRemaining: limits.questions, maxTimeSinceDeath: limits.elapsed, durationText: limits.duration, requiresGMAnswers: true } }));
  if (!tracking) return false;
  await playVfx(spell, ctx.casterToken, ctx.targets);
  const gm = ChatMessage.getWhisperRecipients("GM").map(user => user.id);
  await chat(ctx.caster, ctx.casterToken, spell, '<p><b>Suivi posé sur :</b> ' + esc(recipient.name) + '.</p><p>Temps maximal depuis la mort : <b>' + limits.elapsed + '</b>. Durée : <b>' + limits.duration + '</b>. Questions restantes : <b>' + limits.questions + '</b>.</p><p>Les réponses dépendent uniquement des connaissances de la créature morte et sont déterminées par le MJ.</p>', { whisper: gm });
  return true;
}
async function runLocateOrHideObject(ctx, spell) {
  const range = 6 + ctx.level;
  const rounds = ctx.level;
  const result = await confirmDialog(spell, '<p>Portée : <b>' + range + ' pouces</b>. Durée : <b>' + rounds + ' round(s)</b>. Le sort ne fonctionne pas sur un être vivant.</p>', '<label>Mode<select name="mode"><option value="locate">localiser un objet connu ou familier</option><option value="hide">dissimuler un objet de la détection</option></select></label><label>Description de l’objet<input name="object" type="text" required></label><label><input name="notLiving" type="checkbox" required> Je confirme que la cible n’est pas un être vivant</label>', form => ({ mode: form.elements.mode?.value, object: String(form.elements.object?.value ?? "").trim(), notLiving: form.elements.notLiving?.checked }));
  if (!result?.object || !result?.notLiving) return false;
  const tags = result.mode === "hide" ? ["etat:dissimulation_objet", "protection:localisation_objet"] : ["etat:localisation_objet", "detection:objet"];
  const tracking = await createEffect(ctx.caster, effectData({ spell, sourceItem: ctx.sourceItem, rounds, tags, extra: { effectType: "locate_object", mode: result.mode, objectDescription: result.object, rangeInches: range, durationRounds: rounds, noAutomaticReveal: true } }));
  if (!tracking) return false;
  await playVfx(spell, ctx.casterToken);
  const gm = ChatMessage.getWhisperRecipients("GM").map(user => user.id);
  await chat(ctx.caster, ctx.casterToken, spell, '<p><b>Mode :</b> ' + (result.mode === "hide" ? "dissimulation" : "localisation") + '.</p><p><b>Objet déclaré :</b> ' + esc(result.object) + '.</p><p>Portée : <b>' + range + ' pouces</b>. Durée : <b>' + rounds + ' round(s)</b>.</p><p>ActiveEffect de suivi créé ; aucune position ou information secrète n’est révélée automatiquement.</p>', { whisper: gm });
  return true;
}

export async function runDivinationAssistSpell(ctx, spell) { return runAugure(ctx, spell); }
export async function runBuffDebuffSpell(ctx, spell) { return runCantique(ctx, spell); }
export async function runCommunicationSpell(ctx, spell) {
  const operations = { animal_language: runAnimalLanguage, speak_with_dead: runSpeakWithDead };
  return operations[spell.operation]?.(ctx, spell) ?? false;
}
export async function runCreationSpell(ctx, spell) {
  const operations = { create_food_water_assist: runCreateFoodWaterAssist };
  return operations[spell.operation]?.(ctx, spell) ?? false;
}
export async function runTemporaryWeaponSpell(ctx, spell) { return runSpiritualHammer(ctx, spell); }
export async function runProtectionSpell(ctx, spell) { return runFireResistance(ctx, spell); }
export async function runSilenceSpell(ctx, spell) { return runSilence(ctx, spell); }
export async function runDetectionSpell(ctx, spell) {
  const operations = { structured_charms: runDetectCharms, traps: runDetectTraps, alignment: runAlignment, locate_or_hide_object: runLocateOrHideObject };
  return operations[spell.operation]?.(ctx, spell) ?? false;
}
export async function runStatusSpell(ctx, spell) {
  const operations = { snake_charm: runSnakeCharm, paralysis: runParalysis, delay_poison: runDelayPoison };
  return operations[spell.operation]?.(ctx, spell) ?? false;
}

const MECHANIC_RUNNERS = Object.freeze({
  divination_assist: runDivinationAssistSpell,
  buff_debuff: runBuffDebuffSpell,
  communication: runCommunicationSpell,
  creation: runCreationSpell,
  temporary_weapon: runTemporaryWeaponSpell,
  protection: runProtectionSpell,
  silence: runSilenceSpell,
  detection: runDetectionSpell,
  status: runStatusSpell
});

export async function runAdd2eSpell({ slug, ...context }) {
  const spell = ADD2E_SPELL_CATALOG[slug];
  if (!spell) return false;
  const mechanicRunner = MECHANIC_RUNNERS[spell.mechanic];
  if (!mechanicRunner) return false;
  const ctx = sourceContext(context);
  if (!ctx.sourceItem || !ctx.caster || !ctx.casterToken) { ui.notifications?.error?.(`${spell.name} : source, lanceur ou token introuvable.`); return false; }
  try { return (await mechanicRunner(ctx, spell)) === true; }
  catch (error) { console.error(`[ADD2E][SPELL_MECHANICS][${slug}]`, error); ui.notifications?.error?.(`${spell.name} : erreur de résolution.`); return false; }
}
