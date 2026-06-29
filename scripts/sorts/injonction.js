/**
 * ADD2E — Injonction
 * Clerc niveau 1 — Enchantement/Charme
 * Version : 2026-06-29-injonction-manual-command-v2
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Injonction : DialogV2 indisponible.");
    return false;
  }

  const COLORS = { main: "#b88924", dark: "#6f4b12", pale: "#fff7df", pale2: "#fffaf0", border: "#e2bc63", success: "#2f8f46", fail: "#b33a2e", warn: "#b88924" };
  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const norm = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const style = () => CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem) {
    ui.notifications.error("Injonction : sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Injonction : lanceur introuvable.");
    return false;
  }

  const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc.actor?.id === caster.id)
    ?? ((typeof token !== "undefined" && token?.actor?.id === caster.id) ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;
  if (!casterToken) {
    ui.notifications.warn("Injonction : le lanceur doit être présent sur la scène.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1 || !targets[0]?.actor) {
    ui.notifications.warn("Injonction : sélectionne exactement une créature.");
    return false;
  }
  const targetToken = targets[0];
  const target = targetToken.actor;

  const unitToMeters = (distance, unit) => {
    const key = String(unit ?? "").toLowerCase();
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(key)) return distance * 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(key)) return distance * 0.9144;
    if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(key)) return distance * 1000;
    return distance;
  };
  const tokenDistanceMeters = (left, right) => {
    const size = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
    const gridDistance = Number(canvas.scene?.grid?.distance ?? 1) || 1;
    const unit = canvas.scene?.grid?.units ?? "m";
    const dx = Number(left?.center?.x ?? 0) - Number(right?.center?.x ?? 0);
    const dy = Number(left?.center?.y ?? 0) - Number(right?.center?.y ?? 0);
    return unitToMeters((Math.hypot(dx, dy) / size) * gridDistance, unit);
  };
  if (tokenDistanceMeters(casterToken, targetToken) > 3.01) {
    ui.notifications.warn("Injonction : cible hors de portée (1\").");
    return false;
  }

  const extract = (value, output = []) => {
    if (value === undefined || value === null) return output;
    if (Array.isArray(value)) { value.forEach(entry => extract(entry, output)); return output; }
    if (typeof value === "object") { Object.entries(value).forEach(([key, entry]) => entry === true ? output.push(key) : typeof entry === "object" ? extract(entry, output) : output.push(`${key}:${entry}`)); return output; }
    String(value).split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean).forEach(entry => output.push(entry));
    return output;
  };
  const actorTags = actorDoc => {
    const sys = actorDoc?.system ?? {};
    const flags = actorDoc?.flags?.add2e ?? {};
    const raw = extract([sys.tags, sys.effectTags, sys.type_monstre, flags.tags, flags.effectTags, flags.monsterCapabilities]);
    for (const embedded of actorDoc?.items ?? []) extract([embedded.system?.tags, embedded.flags?.add2e?.tags], raw);
    return [...new Set(raw.map(norm).filter(Boolean))];
  };
  const targetTags = actorTags(target);
  const isUndead = targetTags.some(tag => ["creature:mort_vivant", "monstre:mort_vivant", "type_monstre:mort_vivant", "mort_vivant", "undead"].includes(tag))
    || norm(target.system?.type ?? "").includes("mort_vivant");

  const languageKey = value => norm(value).replace(/^langue_/, "").replace(/^language_/, "").replace(/^lang_/, "");
  const actorLanguages = actorDoc => {
    const sys = actorDoc?.system ?? {};
    const values = [sys.languages, sys.langues, sys.langue, sys.details?.languages, sys.details?.langues, actorDoc?.flags?.add2e?.languages, actorDoc?.flags?.add2e?.langues];
    for (const embedded of actorDoc?.items ?? []) values.push(embedded.system?.languages, embedded.system?.langues, embedded.flags?.add2e?.languages, embedded.flags?.add2e?.langues);
    const tags = actorTags(actorDoc);
    for (const tag of tags) if (tag.startsWith("langue:") || tag.startsWith("language:")) values.push(tag.split(":")[1]);
    return [...new Set(extract(values).flatMap(value => String(value).split(/[,;/|]+/)).map(languageKey).filter(Boolean))];
  };
  const casterLanguages = actorLanguages(caster);
  const targetLanguages = actorLanguages(target);
  const defaultLanguage = casterLanguages[0] ?? "commun";

  const commandDialog = await DialogV2.wait({
    window: { title: "Lancement : Injonction" },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "systems/add2e/assets/icones/sorts/injonction.webp",
    content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;"><div class="form-group"><label style="font-weight:bold;">Ordre d’un seul mot :</label><input type="text" name="commandWord" maxlength="24" placeholder="Arrête" style="width:100%;"></div><div style="display:flex;flex-wrap:wrap;gap:6px;"><label><input type="radio" name="preset" value="arrête" checked> Arrête</label><label><input type="radio" name="preset" value="reviens"> Reviens</label><label><input type="radio" name="preset" value="fuis"> Fuis</label><label><input type="radio" name="preset" value="donne"> Donne</label><label><input type="radio" name="preset" value="meurs"> Meurs</label></div><div class="form-group"><label style="font-weight:bold;">Langue utilisée :</label><input type="text" name="language" value="${esc(defaultLanguage)}" maxlength="40" style="width:100%;"></div><div style="font-size:.9em;color:${COLORS.dark};border-top:1px solid ${COLORS.border};padding-top:6px;">La cible doit comprendre la langue. Les morts-vivants sont insensibles. Les créatures ayant INT 13+ ou au moins 6 DV/niveaux ont droit à un jet de protection contre les sorts.</div></form>`,
    buttons: [
      { action: "cast", label: "Lancer", icon: "fa-solid fa-gavel", default: true, callback: (_event, button) => {
        const form = button.form;
        const typed = String(form?.elements?.commandWord?.value ?? "").trim();
        return { commandWord: typed || String(form?.elements?.preset?.value ?? "arrête"), language: String(form?.elements?.language?.value ?? defaultLanguage).trim() };
      } },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!commandDialog) return false;

  const commandWord = String(commandDialog.commandWord ?? "").trim();
  const commandKey = norm(commandWord);
  const language = languageKey(commandDialog.language || defaultLanguage);
  if (!commandKey || !language) {
    ui.notifications.warn("Injonction : l’ordre et la langue sont obligatoires.");
    return false;
  }
  if (commandKey.split("_").filter(Boolean).length !== 1) {
    ui.notifications.warn("Injonction : l’ordre doit être un seul mot.");
    return false;
  }

  const specialNoEffect = commandKey === ("sui" + "cide");
  const languageKnown = targetLanguages.length ? targetLanguages.includes(language) : null;
  if (languageKnown === null && !game.user.isGM) {
    ui.notifications.warn("Injonction : les langues de la cible ne sont pas structurées. Le MJ doit arbitrer ce lancement.");
    return false;
  }
  let languageUnderstood = languageKnown;
  if (languageKnown === null) {
    const decision = await DialogV2.wait({
      window: { title: "Injonction — arbitrage MJ" },
      content: `<p><b>${esc(target.name)}</b> comprend-il « ${esc(language)} » ?</p><p>Les langues de la cible ne sont pas renseignées dans ses données.</p>`,
      buttons: [
        { action: "understood", label: "Comprend", default: true, callback: () => true },
        { action: "not-understood", label: "Ne comprend pas", callback: () => false },
        { action: "cancel", label: "Annuler", callback: () => null }
      ],
      rejectClose: false
    });
    if (decision === null) return false;
    languageUnderstood = decision === true;
  }

  const readNumber = value => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const values = String(value ?? "").match(/\d+(?:[.,]\d+)?/g)?.map(entry => Number(entry.replace(",", "."))).filter(Number.isFinite) ?? [];
    return values.length ? Math.max(...values) : NaN;
  };
  const intelligence = (() => {
    const sys = target.system ?? {};
    const direct = [sys.intelligence, sys.intelligence_total, sys.caracteristiques?.intelligence, sys.abilities?.int?.value];
    for (const candidate of direct) { const value = readNumber(candidate); if (Number.isFinite(value)) return value; }
    const base = readNumber(sys.intelligence_base);
    const bonus = readNumber(sys.bonus_caracteristiques?.intelligence);
    return Number.isFinite(base) ? base + (Number.isFinite(bonus) ? bonus : 0) : NaN;
  })();
  const hitDice = (() => {
    const sys = target.system ?? {};
    for (const candidate of [sys.dv, sys.hitDice, sys.hit_dice, sys.des_de_vie, sys.niveau, sys.level, sys.details?.niveau, sys.details?.level]) {
      const value = readNumber(candidate);
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  })();
  const requiresSave = (Number.isFinite(intelligence) && intelligence >= 13) || (Number.isFinite(hitDice) && hitDice >= 6);
  const saveTarget = (() => {
    const sys = target.system ?? {};
    for (const candidate of [sys.sauvegarde_sortileges, sys.sauvegardes?.sortileges, sys.sauvegardes?.sorts, sys.saves?.sorts, sys.calculatedSaves?.sorts, Array.isArray(sys.sauvegardes) ? sys.sauvegardes[4] : null]) {
      const value = readNumber(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return NaN;
  })();

  let save = { required: requiresSave, rolled: null, target: saveTarget, success: false, manual: false };
  if (requiresSave && !isUndead && languageUnderstood && !specialNoEffect) {
    if (!Number.isFinite(saveTarget)) {
      if (!game.user.isGM) {
        ui.notifications.warn("Injonction : sauvegarde de la cible introuvable. Le MJ doit arbitrer ce lancement.");
        return false;
      }
      const decision = await DialogV2.wait({
        window: { title: "Injonction — sauvegarde MJ" },
        content: `<p>La sauvegarde contre les sorts de <b>${esc(target.name)}</b> est absente.</p><p>Le MJ décide du résultat.</p>`,
        buttons: [
          { action: "failed", label: "Jet raté - effet appliqué", default: true, callback: () => false },
          { action: "success", label: "Jet réussi - effet résisté", callback: () => true },
          { action: "cancel", label: "Annuler", callback: () => null }
        ],
        rejectClose: false
      });
      if (decision === null) return false;
      save = { required: true, rolled: null, target: null, success: decision === true, manual: true };
    } else {
      const roll = await new Roll("1d20").evaluate({ async: true });
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      save = { required: true, rolled: roll.total, target: saveTarget, success: roll.total >= saveTarget, manual: false };
    }
  }

  const commandType = ({ arrete: "halt", halte: "halt", meurs: "catalepsy", fuis: "flee", reviens: "return", donne: "give" })[commandKey] ?? "manual";
  const outcome = isUndead ? "immune" : !languageUnderstood ? "not-understood" : specialNoEffect ? "ambiguous" : save.success ? "resisted" : "applied";
  const restrictions = commandType === "halt" || commandType === "catalepsy"
    ? { attacks: true, spells: true, movement: true }
    : { attacks: false, spells: false, movement: false };

  const durationData = (() => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(1) ?? { rounds: 1, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null };
  })();
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const effectTags = ["sort:injonction", "etat:injonction", `injonction:${commandKey}`, `injonction_type:${commandType}`, "duree:1_round", "cible:creature"];
  if (commandType === "catalepsy") effectTags.push("etat:catalepsie");
  if (restrictions.attacks) effectTags.push("interdiction:attaque");
  if (restrictions.spells) effectTags.push("interdiction:sort");
  if (restrictions.movement) effectTags.push("interdiction:mouvement");
  if (commandType === "flee" || commandType === "return") effectTags.push("injonction:mouvement_dirige");
  const extra = {
    spellName: "Injonction",
    spellKey: "injonction",
    sourceItemUuid: sourceItem.uuid,
    casterId: caster.id,
    casterUuid: caster.uuid,
    casterTokenId: casterToken.id,
    casterPosition: { x: casterToken.document?.x ?? casterToken.x ?? null, y: casterToken.document?.y ?? casterToken.y ?? null },
    commandWord,
    commandKey,
    commandType,
    language,
    restrictions,
    tags: effectTags
  };
  const timeFlags = time?.flags?.({ source: "injonction.js", rounds: 1, unit: "round", endMessage: `L’injonction « ${commandWord} » imposée à {actor} prend fin.`, extra }) ?? { timeEngine: { managed: true, unit: "round", totalRounds: 1 }, roundEngine: { managed: true, unit: "round", totalRounds: 1, endMessage: `L’injonction « ${commandWord} » imposée à {actor} prend fin.` }, endMessage: `L’injonction « ${commandWord} » imposée à {actor} prend fin.` };

  if (outcome === "applied") {
    const effectData = {
      name: `Injonction : ${commandWord}`,
      img: sourceItem.img || "systems/add2e/assets/icones/sorts/injonction.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: durationData,
      description: `Ordre : ${commandWord}. Langue : ${language}. Durée : 1 round.`,
      flags: { add2e: { ...timeFlags, ...extra } },
      changes: []
    };
    const previous = Array.from(target.effects ?? []).filter(effect => (effect.flags?.add2e?.tags ?? []).includes("etat:injonction")).map(effect => effect.id);
    if (game.user.isGM || target.isOwner) {
      if (previous.length) await target.deleteEmbeddedDocuments("ActiveEffect", previous);
      await target.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } else if (game.socket) {
      game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: target.uuid, actorId: target.id, effectData, removeEffectIds: previous, fromUserId: game.user.id, sentAt: Date.now() } });
    } else {
      ui.notifications.error("Injonction : impossible de contacter le MJ pour créer l’effet.");
      return false;
    }
  }

  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.("injonction", { casterToken, targetToken, jb2aOptions: { maxFiles: 2, scaleToObject: 1.25, opacity: 0.9 } });
  } catch (_error) {}

  const saveHtml = !save.required ? "<div><b>Jet de protection :</b> non requis.</div>"
    : save.manual ? `<div><b>Jet de protection :</b> arbitrage MJ - ${save.success ? "réussi" : "raté"}.</div>`
    : `<div><b>Jet de protection :</b> ${save.rolled} / ${save.target} - <b style="color:${save.success ? COLORS.success : COLORS.fail};">${save.success ? "réussi" : "raté"}</b>.</div>`;
  const outcomeData = {
    applied: { title: "INJONCTION APPLIQUÉE", color: COLORS.success, text: commandType === "catalepsy" ? "La cible tombe en catalepsie pour un round." : commandType === "halt" ? "La cible doit cesser toute action pendant un round." : commandType === "flee" ? "La cible doit s’éloigner du clerc pendant un round." : commandType === "return" ? "La cible doit revenir vers le clerc pendant un round." : commandType === "give" ? "La cible doit remettre un objet porté, si elle le peut." : "L’ordre est enregistré pour l’arbitrage du MJ." },
    immune: { title: "CIBLE INSENSIBLE", color: COLORS.warn, text: "Les morts-vivants ne sont pas affectés par Injonction." },
    "not-understood": { title: "ORDRE INCOMPRIS", color: COLORS.warn, text: `La cible ne comprend pas la langue « ${language} ».` },
    ambiguous: { title: "ORDRE SANS EFFET", color: COLORS.warn, text: "L’ordre est ambigu et n’a aucun effet." },
    resisted: { title: "INJONCTION RÉSISTÉE", color: COLORS.fail, text: "La cible résiste au jet de protection contre les sorts." }
  }[outcome];

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;padding:0;font-family:var(--font-primary);"><div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;"><img src="${esc(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div><div style="font-size:.85em;opacity:.95;">lance <b>${esc(sourceItem.name)}</b></div></div><div style="text-align:right;font-size:.78em;opacity:.95;">Sort divin</div><img src="${esc(sourceItem.img || "systems/add2e/assets/icones/sorts/injonction.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;"></div><div style="padding:10px;"><div style="margin-bottom:6px;font-size:.95em;color:${COLORS.dark};"><b>Cible :</b> ${esc(targetToken.name ?? target.name)}<br><b>Ordre :</b> ${esc(commandWord)}<br><b>Langue :</b> ${esc(language)}</div><div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${outcomeData.color};">${outcomeData.title}</div><div style="margin-top:4px;">${esc(outcomeData.text)}</div>${saveHtml}${outcome === "applied" ? "<div>Durée : <b>1 round</b></div>" : ""}</div><details style="margin-top:8px;background:white;border:1px solid ${COLORS.border};border-radius:6px;"><summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Règle appliquée</summary><div style="padding:8px;font-size:.85em;line-height:1.45;color:${COLORS.dark};"><div>Injonction exige un ordre clair d’un seul mot dans une langue comprise par la cible.</div><div>Les morts-vivants sont insensibles. INT 13+ ou au moins 6 DV/niveaux donne droit à un seul jet de protection contre les sorts.</div><div>« Meurs » impose une catalepsie d’un round ; un ordre ambigu n’a aucun effet.</div></div></details></div></div>`,
    ...style()
  });

  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Injonction : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
