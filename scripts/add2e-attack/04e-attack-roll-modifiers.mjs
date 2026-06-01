// scripts/add2e-attack/04e-attack-roll-modifiers.mjs
// ADD2E - Attaque 04e : helpers generiques de modificateurs d'attaque.

import { add2eNormalizeAttackTag, add2eTagSetMatches } from "./03-attack-rules.mjs";

export const ADD2E_ATTACK_MODIFIERS_VERSION = "2026-05-24-active-effect-tags-v9";

function add2eAttackPushNormalizedTag(set, value) {
  if (!set || value === undefined || value === null || value === "") return;
  if (Array.isArray(value)) return void value.forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (value instanceof Set) return void [...value].forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (typeof value === "object") return void Object.values(value).forEach(v => add2eAttackPushNormalizedTag(set, v));
  if (typeof value !== "string") return;

  for (const part of value.split(/[,;|]/)) {
    const n = add2eNormalizeAttackTag(part);
    if (!n) continue;
    set.add(n);
    set.add(n.replace(/^race:/, ""));
    set.add(n.replace(/^type:/, ""));
    set.add(n.replace(/^type_monstre:/, ""));
    set.add(n.replace(/^creature:/, ""));
    set.add(n.replace(/^alignement:/, ""));
    set.add(n.replace(/^alignment:/, ""));
  }
}

export function add2eAttackBuildTargetTagSet(cible) {
  const targetTags = new Set();
  add2eAttackPushNormalizedTag(targetTags, cible?.name);
  add2eAttackPushNormalizedTag(targetTags, cible?.type);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.race);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.type);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.type_monstre);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.categorie);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.alignement);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.alignment);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.details?.alignment);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.tags);
  add2eAttackPushNormalizedTag(targetTags, cible?.system?.effectTags);
  add2eAttackPushNormalizedTag(targetTags, cible?.flags?.add2e?.tags);
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eAttackPushNormalizedTag(targetTags, Add2eEffectsEngine.getActiveTags(cible) ?? []);
  }
  return targetTags;
}

export function add2eAttackBuildActorTagSet(actor) {
  const actorTags = new Set();
  add2eAttackPushNormalizedTag(actorTags, actor?.name);
  add2eAttackPushNormalizedTag(actorTags, actor?.type);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.race);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.type);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.type_monstre);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.categorie);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.alignement);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.alignment);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.details?.alignment);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.tags);
  add2eAttackPushNormalizedTag(actorTags, actor?.system?.effectTags);
  add2eAttackPushNormalizedTag(actorTags, actor?.flags?.add2e?.tags);
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eAttackPushNormalizedTag(actorTags, Add2eEffectsEngine.getActiveTags(actor) ?? []);
  }
  return actorTags;
}

function add2eAttackTagSetHasMatcher(tagSet, matcher) {
  const m = add2eNormalizeAttackTag(matcher);
  if (!m) return false;
  if (tagSet.has(m)) return true;
  const stripped = m
    .replace(/^race:/, "")
    .replace(/^type:/, "")
    .replace(/^type_monstre:/, "")
    .replace(/^creature:/, "")
    .replace(/^alignement:/, "")
    .replace(/^alignment:/, "");
  if (tagSet.has(stripped)) return true;
  for (const tag of tagSet) {
    if (tag === m || tag === stripped) return true;
    if (tag.endsWith(`:${m}`) || tag.endsWith(`:${stripped}`)) return true;
    if (tag.includes(m) || tag.includes(stripped)) return true;
  }
  return false;
}

function add2eAttackIsEvilTagSet(tagSet) {
  return add2eAttackTagSetHasMatcher(tagSet, "alignement:mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "alignment:evil") ||
    add2eAttackTagSetHasMatcher(tagSet, "loyal_mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "neutre_mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "chaotique_mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "mauvais") ||
    add2eAttackTagSetHasMatcher(tagSet, "evil");
}

function add2eAttackParseSignedValue(rawValue, defaultValue = 0) {
  const n = Number(String(rawValue ?? "").trim());
  return Number.isFinite(n) ? n : defaultValue;
}

function add2eAttackReadPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function add2eAttackTagSetHasPrefix(tagSet, prefix) {
  const p = add2eNormalizeAttackTag(prefix);
  for (const tag of tagSet) if (tag.startsWith(p)) return true;
  return false;
}

function add2eAttackGetActiveTargetEffectTags(cible) {
  const tags = new Set();
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eAttackPushNormalizedTag(tags, Add2eEffectsEngine.getActiveTags(cible) ?? []);
  }
  return tags;
}

function add2eAttackEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eAttackInstallSanctuaryChatSuppressor() {
  if (globalThis.ADD2E_SANCTUARY_CHAT_SUPPRESSOR_INSTALLED) return;
  if (typeof ChatMessage === "undefined" || typeof ChatMessage.create !== "function") return;
  const originalCreate = ChatMessage.create.bind(ChatMessage);
  ChatMessage.create = async function add2eSanctuaryAwareChatCreate(data = {}, options = {}) {
    try {
      const ctx = globalThis.ADD2E_SANCTUARY_SUPPRESS_NEXT_ATTACK_CARD;
      const content = String(data?.content ?? "");
      if (ctx && Date.now() <= ctx.until && content.includes("tente de frapper")) {
        const attackerOk = !ctx.attackerName || content.includes(ctx.attackerName);
        const targetOk = !ctx.targetName || content.includes(ctx.targetName);
        if (attackerOk && targetOk) {
          console.log("[ADD2E][ATTAQUE][SANCTUAIRE][ATTACK_CARD_SUPPRESSED]", ctx);
          globalThis.ADD2E_SANCTUARY_SUPPRESS_NEXT_ATTACK_CARD = null;
          return null;
        }
      }
    } catch (err) {
      console.warn("[ADD2E][ATTAQUE][SANCTUAIRE][CHAT_SUPPRESS_ERROR]", err);
    }
    return originalCreate(data, options);
  };
  globalThis.ADD2E_SANCTUARY_CHAT_SUPPRESSOR_INSTALLED = true;
  console.log("[ADD2E][ATTAQUE][SANCTUAIRE][CHAT_SUPPRESSOR_INSTALLED]");
}

function add2eAttackCreateSanctuaryChat({ actor, cible, save, allowed }) {
  try {
    if (typeof ChatMessage === "undefined" || typeof ChatMessage.create !== "function") return;
    const actorName = add2eAttackEscapeHtml(actor?.name ?? "Attaquant");
    const targetName = add2eAttackEscapeHtml(cible?.name ?? "Cible");
    const ok = !!allowed;
    const color = ok ? "#2f8f46" : "#b33a2e";
    const bg = ok ? "#eefaf2" : "#fff1f0";
    const label = ok ? "SANCTUAIRE FRANCHI" : "ATTAQUE BLOQUEE PAR SANCTUAIRE";
    const result = save?.canRoll
      ? `Jet de protection contre les sorts : <b>${add2eAttackEscapeHtml(save.total)}</b> / seuil <b>${add2eAttackEscapeHtml(save.saveVal)}</b>`
      : "Le sanctuaire protege la cible.";
    const conclusion = save?.canRoll
      ? (ok ? "La sauvegarde reussit : l'attaque continue." : "La sauvegarde echoue : l'attaque est annulee.")
      : "L'attaque est annulee.";

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="add2e-chat-card add2e-sanctuary-card" style="font-family:var(--font-primary);background:${bg};border:1px solid ${color};border-radius:8px;padding:9px;">
          <div style="font-weight:900;color:${color};font-size:1.05em;margin-bottom:5px;">${label}</div>
          <div><b>${actorName}</b> tente d'attaquer <b>${targetName}</b>.</div>
          <div style="margin-top:5px;">${result}</div>
          <div style="margin-top:5px;font-weight:800;color:${color};">${conclusion}</div>
        </div>`
    });
  } catch (err) {
    console.warn("[ADD2E][ATTAQUE][SANCTUAIRE][CHAT_ERROR]", err);
  }
}

function add2eAttackGetSaveVsSpells(actor) {
  const sys = actor?.system ?? {};

  // ADD2E export : [mort/paralysie/poison, baguettes, petrification, souffle, sorts]
  if (Array.isArray(sys.sauvegardes)) {
    const byArray = add2eAttackReadPositiveNumber(sys.sauvegardes[4]);
    if (byArray !== null) {
      console.log("[ADD2E][ATTAQUE][SANCTUAIRE][SAVE_FROM_STRUCTURED_ARRAY]", {
        acteur: actor?.name,
        savingThrows: sys.savingThrows ?? null,
        sauvegardes: sys.sauvegardes,
        index: 4,
        saveVal: byArray
      });
      return byArray;
    }
  }

  const candidates = [
    sys.sauvegarde_sortileges,
    sys.sauvegarde_sorts,
    sys.sauvegardes?.sortileges,
    sys.sauvegardes?.sorts,
    sys.saves?.sorts,
    sys.saves?.spell,
    sys.saves?.spells,
    sys.saves?.magic,
    sys.calculatedSaves?.sorts,
    sys.calculatedSaves?.spell,
    sys.calculatedSaves?.spells,
    sys.jp_sort,
    sys.jp_sorts,
    sys.jp?.sorts,
    sys.jp?.sortileges,
    sys.jet_protection?.sorts,
    sys.jet_protection?.sortileges,
    sys.jetProtection?.sorts
  ];

  for (const raw of candidates) {
    const n = add2eAttackReadPositiveNumber(raw);
    if (n !== null) return n;
  }

  console.warn("[ADD2E][ATTAQUE][SANCTUAIRE][SAVE_STRUCTURED_MISSING]", {
    acteur: actor?.name,
    type: actor?.type,
    savingThrows: sys.savingThrows ?? null,
    sauvegardes: sys.sauvegardes ?? null
  });
  return NaN;
}

function add2eAttackRollD20Sync() {
  const rng = globalThis.CONFIG?.Dice?.randomUniform;
  const raw = typeof rng === "function" ? rng() : Math.random();
  return Math.max(1, Math.min(20, Math.floor(raw * 20) + 1));
}

function add2eAttackRollSaveVsSpellsSync(actor, bonus = 0) {
  const saveVal = add2eAttackGetSaveVsSpells(actor);
  if (!Number.isFinite(saveVal) || saveVal <= 0) {
    return { canRoll: false, saveVal: NaN, total: 0, d20: 0, success: false, note: "save-missing" };
  }

  const d20 = add2eAttackRollD20Sync();
  const total = d20 + (Number(bonus) || 0);
  return {
    canRoll: true,
    saveVal,
    roll: null,
    d20,
    total,
    bonus: Number(bonus) || 0,
    success: total >= saveVal
  };
}

function add2eAttackComputeSanctuaryModifier({ actor, cible, targetEffectTags }) {
  const hasSanctuary =
    targetEffectTags.has("protection:sanctuaire") ||
    targetEffectTags.has("etat:sanctuaire") ||
    targetEffectTags.has("defense:sanctuaire") ||
    targetEffectTags.has("attaque_contre_cible:jp_annule") ||
    targetEffectTags.has("jet:sauvegarde_annule");
  if (!hasSanctuary) return { value: 0, details: [], gate: null };

  const save = add2eAttackRollSaveVsSpellsSync(actor, 0);

  if (!save.canRoll) {
    const msg = "Sanctuaire : attaque annulee";
    console.warn("[ADD2E][ATTAQUE][SANCTUAIRE][NO_SAVE]", {
      attaquant: actor?.name,
      cible: cible?.name,
      save,
      targetEffectTags: [...targetEffectTags]
    });
    globalThis.ADD2E_SANCTUARY_SUPPRESS_NEXT_ATTACK_CARD = {
      attackerName: actor?.name ?? "",
      targetName: cible?.name ?? "",
      until: Date.now() + 5000,
      save,
      reason: "sanctuary-save-missing"
    };
    add2eAttackCreateSanctuaryChat({ actor, cible, save, allowed: false });
    return { value: -999, details: [msg], gate: { allowed: false, save } };
  }

  if (save.success) {
    add2eAttackCreateSanctuaryChat({ actor, cible, save, allowed: true });
    return {
      value: 0,
      details: [`Sanctuaire : JP reussi (${save.total}/${save.saveVal}), attaque autorisee`],
      gate: { allowed: true, save }
    };
  }

  globalThis.ADD2E_SANCTUARY_SUPPRESS_NEXT_ATTACK_CARD = {
    attackerName: actor?.name ?? "",
    targetName: cible?.name ?? "",
    until: Date.now() + 5000,
    save,
    reason: "sanctuary-save-failed"
  };
  add2eAttackCreateSanctuaryChat({ actor, cible, save, allowed: false });
  return {
    value: -999,
    details: [`Sanctuaire : JP rate (${save.total}/${save.saveVal}), attaque annulee`],
    gate: { allowed: false, save }
  };
}

function add2eAttackApplyFlatActiveTagModifier({ tag, prefix, label, accumulator }) {
  if (!tag.startsWith(prefix)) return false;
  const amount = add2eAttackParseSignedValue(tag.slice(prefix.length), 0);
  if (!amount) return true;
  accumulator.value += amount;
  accumulator.details.push(`${label} : ${amount >= 0 ? "+" : ""}${amount}`);
  return true;
}

function add2eAttackApplySignedFlatTags({ tag, touch, damage }) {
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus_attaque:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus_toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus:toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus_attaque:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus_toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus:toucher:", label: "Effet actif au toucher", accumulator: touch })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus_degats:", label: "Effet actif aux degats", accumulator: damage })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "bonus:degats:", label: "Effet actif aux degats", accumulator: damage })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus_degats:", label: "Effet actif aux degats", accumulator: damage })) return true;
  if (add2eAttackApplyFlatActiveTagModifier({ tag, prefix: "malus:degats:", label: "Effet actif aux degats", accumulator: damage })) return true;
  return false;
}

export async function add2eAttackResolveTargetAttackGate({ actor, cible, source = "attack-roll" } = {}) {
  if (!actor || !cible) return { allowed: true, reason: "missing-actor-or-target" };
  const targetEffectTags = add2eAttackGetActiveTargetEffectTags(cible);
  const sanctuary = add2eAttackComputeSanctuaryModifier({ actor, cible, targetEffectTags });
  console.log("[ADD2E][ATTAQUE][TARGET_GATE]", {
    source,
    attaquant: actor?.name,
    cible: cible?.name,
    gate: sanctuary.gate,
    details: sanctuary.details,
    targetEffectTags: [...targetEffectTags]
  });
  return {
    allowed: sanctuary.gate?.allowed !== false,
    reason: sanctuary.gate?.allowed === false ? "save-failed" : "allowed",
    save: sanctuary.gate?.save ?? null,
    targetEffectTags
  };
}

export function add2eAttackComputeTargetDefensiveAttackModifiers({ actor, cible }) {
  let value = 0;
  const details = [];
  if (!actor || !cible || typeof Add2eEffectsEngine === "undefined" || typeof Add2eEffectsEngine.getActiveTags !== "function") {
    return { value, details, attackerTags: new Set(), targetEffectTags: new Set() };
  }

  const attackerTags = add2eAttackBuildActorTagSet(actor);
  const targetEffectTags = add2eAttackGetActiveTargetEffectTags(cible);
  const sanctuary = add2eAttackComputeSanctuaryModifier({ actor, cible, targetEffectTags });
  if (sanctuary.value !== 0 || sanctuary.details.length) {
    value += sanctuary.value;
    details.push(...sanctuary.details);
  }

  const isEvil = add2eAttackIsEvilTagSet(attackerTags);
  const hasProtectionSpecificMalus = targetEffectTags.has("protection:mal") && add2eAttackTagSetHasPrefix(targetEffectTags, "malus_attaque_creature_mauvaise:");

  for (const rawTag of targetEffectTags) {
    const tag = add2eNormalizeAttackTag(rawTag);
    if (!tag) continue;

    if (tag.startsWith("malus_toucher_ennemi:") || tag.startsWith("malus_attaque_ennemi:")) {
      if (hasProtectionSpecificMalus) continue;
      const amount = Math.abs(add2eAttackParseSignedValue(tag.split(":")[1], 0));
      if (amount) {
        value -= amount;
        details.push(`Effet defensif cible : -${amount} au toucher`);
      }
      continue;
    }

    if (tag.startsWith("malus_attaque_creature_mauvaise:")) {
      const amount = Math.abs(add2eAttackParseSignedValue(tag.split(":")[1], 0));
      if (amount && isEvil) {
        value -= amount;
        details.push(`Protection contre le Mal : -${amount} au toucher`);
      }
      continue;
    }

    if (tag.startsWith("malus_attaque_vs:") || tag.startsWith("malus_toucher_vs:")) {
      const parts = tag.split(":");
      const amount = Math.abs(add2eAttackParseSignedValue(parts.at(-1), 0));
      const matcher = parts.slice(1, -1).join(":");
      if (amount && matcher && add2eAttackTagSetHasMatcher(attackerTags, matcher)) {
        value -= amount;
        details.push(`Effet defensif cible (${matcher}) : -${amount} au toucher`);
      }
      continue;
    }

    if (tag.startsWith("bonus_attaque_ennemi:")) {
      const amount = add2eAttackParseSignedValue(tag.split(":")[1], 0);
      if (amount) {
        value += amount;
        details.push(`Effet defensif cible : ${amount >= 0 ? "+" : ""}${amount} au toucher`);
      }
    }
  }
  return { value, details, attackerTags, targetEffectTags };
}

export function add2eAttackComputeActiveAttackModifiers({ actor, cible, combatProfile }) {
  let bonusToucheEffets = 0;
  let bonusDegatsEffets = 0;
  let bonusRacialVs = 0;
  const targetTags = add2eAttackBuildTargetTagSet(cible);
  let targetDefensiveAttackDetails = [];

  if (typeof Add2eEffectsEngine !== "undefined") {
    const typeCible = cible?.system?.type_monstre || cible?.system?.race || "";
    bonusRacialVs = Add2eEffectsEngine.getBonusToucheVs(actor, typeCible);
    const activeTags = Add2eEffectsEngine.getActiveTags(actor) ?? [];
    const touch = { value: 0, details: [] };
    const damage = { value: 0, details: [] };

    for (const rawTag of activeTags) {
      const t = add2eNormalizeAttackTag(rawTag);
      if (!t) continue;

      if (add2eAttackApplySignedFlatTags({ tag: t, touch, damage })) continue;

      if (t.startsWith("bonus_touche:")) {
        const parts = t.split(":");
        const matcher = parts[1];
        const valeur = Number(parts[2]) || 0;
        if (matcher && add2eTagSetMatches(combatProfile.tagSet, matcher)) bonusToucheEffets += valeur;
        continue;
      }
      if (t.startsWith("bonus_degats_vs:")) {
        const parts = t.split(":");
        const matcher = add2eNormalizeAttackTag(parts[1]);
        const valeurRaw = String(parts[2] ?? "").trim().toLowerCase();
        if (matcher && targetTags.has(matcher)) {
          bonusDegatsEffets += valeurRaw === "niveau" ? (Number(actor?.system?.niveau) || 1) : (Number(valeurRaw) || 0);
        }
      }
    }

    if (touch.value) bonusToucheEffets += touch.value;
    if (damage.value) bonusDegatsEffets += damage.value;

    const targetDefensive = add2eAttackComputeTargetDefensiveAttackModifiers({ actor, cible });
    if (targetDefensive.value !== 0 || targetDefensive.details.length) {
      bonusToucheEffets += targetDefensive.value;
      targetDefensiveAttackDetails = targetDefensive.details;
      console.log("[ADD2E][ATTAQUE][EFFETS_DEFENSIFS_CIBLE]", {
        attaquant: actor?.name,
        cible: cible?.name,
        value: targetDefensive.value,
        details: targetDefensive.details,
        attackerTags: [...targetDefensive.attackerTags],
        targetEffectTags: [...targetDefensive.targetEffectTags]
      });
    }
  }

  return { bonusToucheEffets, bonusDegatsEffets, bonusRacialVs, targetTags, targetDefensiveAttackDetails };
}

add2eAttackInstallSanctuaryChatSuppressor();
globalThis.ADD2E_ATTACK_MODIFIERS_VERSION = ADD2E_ATTACK_MODIFIERS_VERSION;
console.log("[ADD2E][ATTACK][04E][MODIFIERS_LOADED]", ADD2E_ATTACK_MODIFIERS_VERSION);
