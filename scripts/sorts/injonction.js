/**
 * ADD2E — Injonction
 * Clerc niveau 1 — Enchantement/Charme
 * Compatible Foundry V13/V14/V15 — DialogV2 et sauvegardes canoniques.
 * Contrat onUse : true = consommé ; false = non consommé.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-07-23-canonical-save-chat-v5";
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Injonction : DialogV2 indisponible.");
    return false;
  }
  if (typeof globalThis.add2eResolveSavingThrow !== "function") {
    ui.notifications.error("Injonction : le résolveur canonique de sauvegardes est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Injonction : le constructeur commun des cartes de chat est indisponible.");
    return false;
  }

  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const norm = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

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
  const isUndead = actorTags(target).some(tag => ["creature:mort_vivant", "monstre:mort_vivant", "type_monstre:mort_vivant", "mort_vivant", "undead"].includes(tag))
    || norm(target.system?.type ?? "").includes("mort_vivant");

  const commandDialog = await DialogV2.wait({
    window: { title: "Lancement : Injonction" },
    position: { width: 360 },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "systems/add2e/assets/icones/sorts/injonction.webp",
    content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:7px;"><div class="form-group"><label style="font-weight:bold;">Ordre :</label><select name="preset" style="width:100%;"><option value="Arrête">Arrête</option><option value="Fuis">Fuis</option><option value="Reviens">Reviens</option><option value="Donne">Donne</option><option value="Meurs">Meurs</option></select></div><div class="form-group"><label>Autre ordre <small>(facultatif, un mot)</small> :</label><input type="text" name="commandWord" maxlength="24" placeholder="Remplace la liste" style="width:100%;"></div><div style="font-size:.84em;border-top:1px solid currentColor;padding-top:5px;">Les morts-vivants sont insensibles. INT 13+ ou au moins 6 DV/niveaux donne droit à un jet de protection.</div></form>`,
    buttons: [
      { action: "cast", label: "Lancer", icon: "fa-solid fa-gavel", default: true, callback: (_event, button) => {
        const form = button.form;
        const typed = String(form?.elements?.commandWord?.value ?? "").trim();
        const selected = String(form?.elements?.preset?.value ?? "Arrête").trim();
        return { commandWord: typed || selected };
      } },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!commandDialog) return false;

  const commandWord = String(commandDialog.commandWord ?? "").trim();
  const commandKey = norm(commandWord);
  if (!commandKey) {
    ui.notifications.warn("Injonction : l’ordre est obligatoire.");
    return false;
  }
  if (commandKey.split("_").filter(Boolean).length !== 1) {
    ui.notifications.warn("Injonction : l’ordre doit être un seul mot.");
    return false;
  }

  const specialNoEffect = commandKey === ("sui" + "cide");
  const readNumber = value => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const values = String(value ?? "").match(/\d+(?:[.,]\d+)?/g)?.map(entry => Number(entry.replace(",", "."))).filter(Number.isFinite) ?? [];
    return values.length ? Math.max(...values) : NaN;
  };

  const effectsEngine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  const resolvedIntelligence = typeof effectsEngine?.resolveAbility === "function"
    ? Number(effectsEngine.resolveAbility(target, "intelligence", { type: "save", source: "spell:injonction" })?.total)
    : NaN;
  const intelligence = Number.isFinite(resolvedIntelligence)
    ? resolvedIntelligence
    : readNumber(target.system?.intelligence ?? target.system?.caracteristiques?.intelligence ?? target.system?.abilities?.int?.value);
  const hitDice = (() => {
    const sys = target.system ?? {};
    for (const candidate of [sys.dv, sys.hitDice, sys.hit_dice, sys.des_de_vie, sys.niveau, sys.level, sys.details?.niveau, sys.details?.level]) {
      const value = readNumber(candidate);
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  })();
  const requiresSave = (Number.isFinite(intelligence) && intelligence >= 13) || (Number.isFinite(hitDice) && hitDice >= 6);

  let save = {
    required: requiresSave,
    roll: null,
    resolution: null,
    d20: null,
    bonus: 0,
    total: null,
    target: null,
    success: false
  };
  if (requiresSave && !isUndead && !specialNoEffect) {
    const resolution = globalThis.add2eResolveSavingThrow(target, 4, {
      source: "spell:injonction",
      sourceItem,
      caster,
      targetToken,
      frontale: true
    });
    const saveTarget = Number(resolution?.target);
    if (!Number.isFinite(saveTarget) || saveTarget <= 0) {
      ui.notifications.warn(`Injonction : aucune sauvegarde contre les sortilèges pour ${target.name}.`);
      return false;
    }

    const roll = await new Roll("1d20").evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const d20 = Number(roll.total) || 0;
    const bonus = Number(resolution.bonus) || 0;
    const total = d20 + bonus;
    save = {
      required: true,
      roll,
      resolution,
      d20,
      bonus,
      total,
      target: saveTarget,
      success: total >= saveTarget
    };
  }

  const commandType = ({ arrete: "halt", halte: "halt", meurs: "catalepsy", fuis: "flee", reviens: "return", donne: "give" })[commandKey] ?? "manual";
  const outcome = isUndead ? "immune" : specialNoEffect ? "ambiguous" : save.success ? "resisted" : "applied";
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
    restrictions,
    tags: effectTags
  };
  const timeFlags = time?.flags?.({ source: "injonction.js", rounds: 1, unit: "round", endMessage: `L’injonction « ${commandWord} » imposée à {actor} prend fin.`, extra })
    ?? { timeEngine: { managed: true, unit: "round", totalRounds: 1 }, roundEngine: { managed: true, unit: "round", totalRounds: 1, endMessage: `L’injonction « ${commandWord} » imposée à {actor} prend fin.` }, endMessage: `L’injonction « ${commandWord} » imposée à {actor} prend fin.` };

  if (outcome === "applied") {
    const effectData = {
      name: `Injonction : ${commandWord}`,
      img: sourceItem.img || "systems/add2e/assets/icones/sorts/injonction.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: durationData,
      description: `Ordre : ${commandWord}. Durée : 1 round.`,
      flags: { add2e: { ...timeFlags, ...extra } },
      changes: []
    };
    const previous = Array.from(target.effects ?? []).filter(effect => (effect.flags?.add2e?.tags ?? []).includes("etat:injonction")).map(effect => effect.id);
    if (game.user.isGM || target.isOwner) {
      if (previous.length) await target.deleteEmbeddedDocuments("ActiveEffect", previous);
      await target.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } else if (game.socket) {
      game.socket.emit("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "createActiveEffect",
        payload: {
          actorUuid: target.uuid,
          actorId: target.id,
          effectData,
          removeEffectIds: previous,
          fromUserId: game.user.id,
          sentAt: Date.now()
        }
      });
    } else {
      ui.notifications.error("Injonction : impossible de contacter le MJ pour créer l’effet.");
      return false;
    }
  }

  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.("injonction", { casterToken, targetToken, jb2aOptions: { maxFiles: 2, scaleToObject: 1.25, opacity: 0.9 } });
  } catch (_error) {}

  const outcomeData = {
    applied: {
      message: commandType === "catalepsy" ? "La cible tombe en catalepsie pour un round." : commandType === "halt" ? "La cible doit cesser toute action pendant un round." : commandType === "flee" ? "La cible doit s’éloigner du clerc pendant un round." : commandType === "return" ? "La cible doit revenir vers le clerc pendant un round." : commandType === "give" ? "La cible doit remettre un objet porté, si elle le peut." : "L’ordre est enregistré pour l’arbitrage du MJ.",
      variant: "success"
    },
    immune: { message: "Les morts-vivants ne sont pas affectés par Injonction.", variant: "neutral" },
    ambiguous: { message: "L’ordre est ambigu et n’a aucun effet.", variant: "neutral" },
    resisted: { message: "La cible résiste au jet de protection contre les sortilèges.", variant: "failure" }
  }[outcome];

  const rows = [
    { label: "Cible", value: targetToken.name ?? target.name },
    { label: "Ordre", value: commandWord },
    { label: "Condition de sauvegarde", value: requiresSave ? "INT 13+ ou 6 DV/niveaux" : "Non requise" }
  ];
  if (save.required) {
    rows.push(
      { label: "D20", value: save.d20 },
      { label: "Bonus de sauvegarde", value: `${save.bonus >= 0 ? "+" : ""}${save.bonus}` },
      { label: "Total", value: save.total },
      { label: "Seuil", value: save.target }
    );
  }
  if (outcome === "applied") rows.push({ label: "Durée", value: "1 round" });

  const chatData = {
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    flags: {
      add2e: {
        spell: "injonction",
        version: VERSION,
        sourceItemUuid: sourceItem.uuid,
        targetActorUuid: target.uuid,
        commandWord,
        commandType,
        outcome,
        saveRequired: save.required,
        saveType: save.resolution?.key ?? null,
        saveTarget: save.target,
        saveBonus: save.bonus,
        saveTotal: save.total,
        saveSuccess: save.success,
        saveResolverVersion: save.resolution?.version ?? null
      }
    }
  };
  if (save.roll) chatData.rolls = [save.roll];

  const options = {
    actor: caster,
    title: sourceItem.name || "Injonction",
    icon: "fas fa-gavel",
    variant: outcomeData.variant,
    source: {
      name: caster.name,
      img: caster.img,
      type: "Sort divin",
      meta: "Clerc niveau 1"
    },
    target: {
      name: target.name,
      img: target.img,
      type: isUndead ? "Mort-vivant" : "Créature",
      meta: save.resolution?.targetResolution?.selected?.className ?? ""
    },
    rows,
    message: outcomeData.message,
    chatData
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("Injonction : carte de chat vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Injonction : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
