// ============================================================
// ADD2E — Nettoyage effets de classe + compétences de voleur
// ============================================================
function add2eClassEffectKey(value) {
  return add2eNormalizeEquipTag(value);
}

function add2eEffectFlagValue(effect, keys = []) {
  const flags = effect?.flags?.add2e ?? {};
  for (const key of keys) {
    const value = flags?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function add2eShouldDeleteEffectForClassPurge(effect, itemsToDelete = []) {
  const origin = String(effect?.origin || "");
  const itemUuids = itemsToDelete.map(i => i.uuid).filter(Boolean);
  const itemIds = itemsToDelete.map(i => i.id).filter(Boolean);

  if (itemUuids.includes(origin)) return true;
  if (itemIds.some(id => origin.endsWith(`.${id}`))) return true;

  const oldClassItems = itemsToDelete.filter(i => String(i.type || "").toLowerCase() === "classe");
  if (!oldClassItems.length) return false;

  const oldClassKeys = new Set();
  for (const cls of oldClassItems) {
    const sys = cls.system ?? {};
    for (const value of [cls.name, sys.label, sys.nom, sys.name, sys.classe, sys.slug]) {
      const key = add2eClassEffectKey(value);
      if (key) oldClassKeys.add(key);
    }
    if (cls.id) oldClassKeys.add(add2eClassEffectKey(cls.id));
    if (cls.uuid) oldClassKeys.add(add2eClassEffectKey(cls.uuid));
  }

  const flags = effect?.flags?.add2e ?? {};
  const sourceType = add2eClassEffectKey(flags.sourceType ?? flags.type ?? flags.kind ?? "");
  const sourceClass = add2eClassEffectKey(
    flags.sourceClasse ?? flags.sourceClass ?? flags.className ?? flags.classe ?? flags.classKey ?? ""
  );
  const sourceId = add2eClassEffectKey(flags.sourceItemId ?? flags.sourceClassId ?? flags.classId ?? "");
  const effectName = add2eClassEffectKey(effect?.name ?? effect?.label ?? "");

  if (["classe", "class", "class_feature", "capacite_classe", "classfeature"].includes(sourceType)) return true;
  if (sourceClass && oldClassKeys.has(sourceClass)) return true;
  if (sourceId && oldClassKeys.has(sourceId)) return true;

  // Compatibilité avec les anciens effets non tagués, ex. "Moine — capacités niveau X".
  if (effectName && [...oldClassKeys].some(k => k && effectName.includes(k))) return true;

  return false;
}


function add2eCollectUnlockedClassEffectTags(actor, classItem = null) {
  const tags = new Set();
  const level = Math.max(1, Number(actor?.system?.niveau) || 1);
  const cls = classItem ?? actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  const systems = [actor?.system?.details_classe, cls?.system].filter(Boolean);

  const push = (value) => {
    for (const raw of add2eToEquipArray(value)) {
      const tag = add2eNormalizeEquipTag(raw);
      if (tag) tags.add(tag);
    }
  };

  const pushFeatures = (features) => {
    const list = Array.isArray(features)
      ? features
      : (features && typeof features === "object" ? Object.values(features) : []);

    for (const feature of list) {
      if (!feature || typeof feature !== "object") continue;
      const min = Number(feature.minLevel ?? feature.minimumLevel ?? feature.level ?? feature.niveau ?? 1) || 1;
      const maxRaw = feature.maxLevel ?? feature.maximumLevel ?? feature.maxNiveau;
      const max = maxRaw === undefined || maxRaw === null || maxRaw === "" ? 999 : Number(maxRaw) || 999;
      if (level < min || level > max) continue;

      push(feature.tags);
      push(feature.tag);
      push(feature.effectTags);
      push(feature.effets);
      push(feature.effects);
      push(feature.flags?.add2e?.tags);
      push(feature.flags?.add2e?.effectTags);
    }
  };

  for (const sys of systems) {
    push(sys.tags);
    push(sys.tag);
    push(sys.effectTags);
    push(sys.effets);
    push(sys.effects);
    push(sys.flags?.add2e?.tags);
    pushFeatures(sys.classFeatures);
    pushFeatures(sys.classFeaturesDebloquees);
  }

  return [...tags].filter(Boolean);
}

async function add2eSyncClassPassiveEffect(actor) {
  if (!actor) return null;

  const classItem = actor.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
  const existing = actor.effects?.filter?.(eff => eff.flags?.add2e?.autoClassPassiveEffect === true) ?? [];

  if (!classItem) {
    const ids = existing.map(e => e.id).filter(Boolean);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    return null;
  }

  const tags = add2eCollectUnlockedClassEffectTags(actor, classItem);
  const label = `${classItem.name} — effets de classe`;

  if (!tags.length) {
    const ids = existing.map(e => e.id).filter(Boolean);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
    return null;
  }

  const data = {
    name: label,
    label,
    icon: classItem.img || "icons/svg/aura.svg",
    origin: classItem.uuid,
    disabled: false,
    transfer: false,
    changes: [],
    flags: {
      add2e: {
        autoClassPassiveEffect: true,
        sourceType: "classe",
        sourceClasse: classItem.name,
        sourceItemId: classItem.id,
        sourceItemUuid: classItem.uuid,
        tags,
        effectTags: tags
      }
    }
  };

  const current = existing[0] ?? null;
  const oldIds = existing.slice(1).map(e => e.id).filter(Boolean);
  if (oldIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", oldIds);

  if (current) {
    await current.update(data, { render: false });
    return current;
  }

  const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  return created ?? null;
}

globalThis.add2eSyncClassPassiveEffect = add2eSyncClassPassiveEffect;

function add2eNormalizeThiefSkillKey(value) {
  const key = add2eNormalizeEquipTag(value)
    .replace(/^competence_voleur:/, "")
    .replace(/^competences_voleur:/, "")
    .replace(/^thief_skill:/, "")
    .replace(/^voleur:/, "");

  const aliases = {
    pick_pockets: "pickpocket",
    pick_pocket: "pickpocket",
    pickpockets: "pickpocket",
    pickpocket: "pickpocket",
    vol_a_la_tire: "pickpocket",
    tire_laine: "pickpocket",

    open_locks: "crochetage_serrures",
    open_lock: "crochetage_serrures",
    crochetage: "crochetage_serrures",
    crochetage_de_serrures: "crochetage_serrures",
    crochetage_serrure: "crochetage_serrures",
    crochetage_serrures: "crochetage_serrures",
    ouverture_de_serrures: "crochetage_serrures",
    ouverture_serrures: "crochetage_serrures",
    ouvrir_serrures: "crochetage_serrures",

    find_remove_traps: "detection_pieges",
    find_traps: "detection_pieges",
    remove_traps: "detection_pieges",
    detect_traps: "detection_pieges",
    detection_desamorcage_des_pieges: "detection_pieges",
    detection_desamorcage_pieges: "detection_pieges",
    detection_pieges: "detection_pieges",
    detection_de_pieges: "detection_pieges",
    desamorcage_pieges: "detection_pieges",
    desamorcage_de_pieges: "detection_pieges",
    pieges: "detection_pieges",

    move_silently: "deplacement_silencieux",
    deplacement_silencieux: "deplacement_silencieux",
    deplacement_en_silence: "deplacement_silencieux",
    silence: "deplacement_silencieux",

    hide_in_shadows: "dissimulation",
    dissimulation_dans_l_ombre: "dissimulation",
    dissimulation_dans_lombre: "dissimulation",
    dissimulation: "dissimulation",
    ombre: "dissimulation",

    detect_noise: "ecoute",
    acuite_auditive: "ecoute",
    ecoute: "ecoute",
    ecouter: "ecoute",

    climb_walls: "escalade",
    escalade: "escalade",
    grimper: "escalade",

    backstab: "frappe_dans_le_dos",
    attaque_dans_le_dos: "frappe_dans_le_dos",
    frappe_dans_le_dos: "frappe_dans_le_dos",
    dos: "frappe_dans_le_dos",

    read_languages: "lecture_langues",
    read_language: "lecture_langues",
    lecture_des_langues: "lecture_langues",
    lecture_langues: "lecture_langues",
    langues: "lecture_langues",

    assassination: "assassinat",
    assassinate: "assassinat",
    assassiner: "assassinat",
    assassinat: "assassinat",
    comp_assassin: "assassinat",
    competence_assassin: "assassinat"
  };

  return aliases[key] ?? key;
}

function add2eThiefToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(v => add2eThiefToArray(v));
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eReadThiefBonusValue(rawValue) {
  if (typeof rawValue === "number") return rawValue;
  if (typeof rawValue === "string" && rawValue.trim() !== "") return Number(rawValue) || 0;
  if (rawValue && typeof rawValue === "object") {
    const v = rawValue.value ?? rawValue.bonus ?? rawValue.mod ?? rawValue.adjustment ?? rawValue.valeur ?? rawValue.malus;
    return Number(v) || 0;
  }
  return 0;
}

function add2eGetThiefBonusFromMap(map, key) {
  if (!map) return 0;
  const wanted = add2eNormalizeThiefSkillKey(key);
  let total = 0;

  const accepts = rawKey => {
    const normKey = add2eNormalizeThiefSkillKey(rawKey);
    return [wanted, "all", "toutes", "global", "*"].includes(normKey);
  };

  if (Array.isArray(map)) {
    for (const entry of map) {
      if (!entry) continue;
      if (typeof entry === "string") {
        // Format accepté : bonus_voleur:crochetage_serrures:10
        const parsed = add2eParseThiefBonusTag(entry);
        if (parsed && accepts(parsed.key)) total += parsed.value;
        continue;
      }
      if (typeof entry === "object") {
        const rawKey = entry.key ?? entry.skill ?? entry.competence ?? entry.compétence ?? entry.name ?? entry.label ?? entry.id ?? "all";
        if (accepts(rawKey)) total += add2eReadThiefBonusValue(entry);
      }
    }
    return total;
  }

  if (typeof map === "string") {
    for (const token of map.split(/[,;|\n]+/).map(x => x.trim()).filter(Boolean)) {
      const parsed = add2eParseThiefBonusTag(token);
      if (parsed && accepts(parsed.key)) total += parsed.value;
    }
    return total;
  }

  if (typeof map !== "object") return 0;

  for (const [rawKey, rawValue] of Object.entries(map)) {
    if (!accepts(rawKey)) continue;
    total += add2eReadThiefBonusValue(rawValue);
  }

  return total;
}

function add2ePushThiefBonus(out, label, map, key) {
  const value = add2eGetThiefBonusFromMap(map, key);
  if (value !== 0) out.push({ label, value });
}

function add2eGetActorRaceSystem(actor) {
  const details = add2eDeepClone(actor?.system?.details_race ?? {}) || {};
  const raceItem = actor?.items?.find?.(i => String(i?.type || "").toLowerCase() === "race") ?? null;
  const itemSystem = add2eDeepClone(raceItem?.system ?? {}) || {};

  if (foundry?.utils?.mergeObject) {
    return foundry.utils.mergeObject(details, itemSystem, { inplace: false, recursive: true });
  }
  return { ...details, ...itemSystem };
}

function add2eGetThiefClassSystem(actor) {
  try {
    const merged = add2eGetActorClassSystem(actor);
    if (merged && typeof merged === "object") return merged;
  } catch (err) {
    console.warn("[ADD2E][VOLEUR][CLASSE] Fallback details_classe.", err);
  }
  return actor?.system?.details_classe ?? {};
}

function add2eGetEquippedThiefBonusMaps(actor) {
  const maps = [];
  for (const item of actor?.items ?? []) {
    const sys = item.system ?? {};
    const equipped = sys.equipee === true || sys.equipped === true || sys.portee === true || sys.active === true;
    if (!equipped) continue;

    const sources = [
      sys.thiefSkillAdjustments,
      sys.thiefSkillBonuses,
      sys.thief_adjustments,
      sys.thief_bonuses,
      sys.voleurSkillAdjustments,
      sys.voleurSkillBonuses,
      sys.bonus_competences_voleur,
      sys.malus_competences_voleur,
      sys.skillBonuses?.voleur,
      sys.skillAdjustments?.voleur,
      item.flags?.add2e?.thiefSkillAdjustments,
      item.flags?.add2e?.thiefSkillBonuses
    ];

    for (const map of sources) {
      if (map && typeof map === "object") maps.push({ label: item.name, map });
    }
  }
  return maps;
}

function add2eGetThiefDexBonus(actor, key) {
  const details = add2eGetThiefClassSystem(actor);
  const dex = Number(
    actor?.system?.dex_aff ??
    actor?.system?.dexterite ??
    actor?.system?.dexterite_base ??
    0
  ) || 0;

  const sources = [
    details.thiefSkillDexAdjustments,
    details.thiefDexAdjustments,
    actor?.system?.thiefSkillDexAdjustments,
    actor?.system?.thiefDexAdjustments
  ];

  for (const table of sources) {
    if (!table || typeof table !== "object") continue;
    const row = table[String(dex)] ?? table[dex];
    const value = add2eGetThiefBonusFromMap(row, key);
    if (value !== 0) return { value, label: `Dextérité ${dex}` };
  }

  return { value: 0, label: `Dextérité ${dex}` };
}

function add2eParseThiefBonusTag(raw) {
  const norm = add2eNormalizeEquipTag(raw);
  if (!norm) return null;

  const prefixes = [
    "bonus_voleur",
    "bonus_competence_voleur",
    "bonus_competences_voleur",
    "bonus_thief_skill",
    "thief_skill_bonus",
    "malus_voleur",
    "malus_competence_voleur",
    "malus_competences_voleur",
    "malus_thief_skill",
    "thief_skill_malus"
  ];

  for (const prefix of prefixes) {
    if (norm === prefix) continue;
    if (!norm.startsWith(prefix + ":") && !norm.startsWith(prefix + "_")) continue;

    const isMalus = prefix.startsWith("malus") || prefix.endsWith("malus");
    const rest = norm.slice(prefix.length + 1);
    const sep = norm[prefix.length];
    let skillKey = "all";
    let value = 0;

    if (sep === ":") {
      const parts = rest.split(":").filter(Boolean);
      if (parts.length === 1) value = Number(parts[0]) || 0;
      else {
        skillKey = parts.slice(0, -1).join(":");
        value = Number(parts.at(-1)) || 0;
      }
    } else {
      const m = rest.match(/^(.*)_(-?\d+)$/);
      if (!m) continue;
      skillKey = m[1] || "all";
      value = Number(m[2]) || 0;
    }

    if (isMalus) value = -Math.abs(value);
    return { key: add2eNormalizeThiefSkillKey(skillKey), value };
  }

  return null;
}

function add2eGetActiveTagThiefBonuses(actor, key) {
  const out = [];
  const wanted = add2eNormalizeThiefSkillKey(key);
  let tags = [];

  try {
    if (typeof Add2eEffectsEngine !== "undefined" && Add2eEffectsEngine?.getActiveTags) {
      tags = Add2eEffectsEngine.getActiveTags(actor) ?? [];
    }
  } catch (err) {
    console.warn("[ADD2E][VOLEUR][BONUS TAGS] Impossible de lire les tags actifs.", err);
  }

  for (const raw of tags) {
    const parsed = add2eParseThiefBonusTag(raw);
    if (!parsed) continue;
    if (![wanted, "all", "toutes", "global", "*"].includes(parsed.key)) continue;
    if (parsed.value !== 0) out.push({ label: "Effets actifs", value: parsed.value });
  }

  return out;
}

function add2eGetThiefSkillBonuses(actor, key) {
  const out = [];
  const details = add2eGetThiefClassSystem(actor);
  const race = add2eGetActorRaceSystem(actor);

  for (const map of [
    actor?.system?.thiefSkillAdjustments,
    actor?.system?.thiefSkillBonuses,
    actor?.system?.voleurSkillAdjustments,
    actor?.system?.voleurSkillBonuses,
    actor?.system?.bonus_competences_voleur,
    actor?.system?.bonusCompetencesVoleur
  ]) add2ePushThiefBonus(out, "Acteur", map, key);

  for (const map of [
    details.thiefSkillAdjustments,
    details.thiefSkillBonuses,
    details.thief_adjustments,
    details.thief_bonuses,
    details.voleurSkillAdjustments,
    details.voleurSkillBonuses,
    details.bonus_competences_voleur,
    details.bonus_competence_voleur,
    details.bonus_voleur,
    details.malus_competences_voleur,
    details.skillBonuses?.voleur,
    details.skillAdjustments?.voleur
  ]) add2ePushThiefBonus(out, "Classe", map, key);

  for (const map of [
    race.thief_adjustments,
    race.thief_bonuses,
    race.thiefSkillAdjustments,
    race.thiefSkillBonuses,
    race.voleurSkillAdjustments,
    race.voleurSkillBonuses,
    race.bonus_competences_voleur,
    race.bonus_competence_voleur,
    race.bonus_voleur,
    race.malus_competences_voleur,
    race.skillBonuses?.voleur,
    race.skillAdjustments?.voleur
  ]) add2ePushThiefBonus(out, "Race", map, key);

  const dexBonus = add2eGetThiefDexBonus(actor, key);
  if (dexBonus.value !== 0) out.push(dexBonus);

  for (const src of add2eGetEquippedThiefBonusMaps(actor)) {
    add2ePushThiefBonus(out, src.label, src.map, key);
  }

  out.push(...add2eGetActiveTagThiefBonuses(actor, key));

  return out.filter(b => Number(b.value || 0) !== 0);
}

function add2eFormatSigned(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n}`;
}

function add2eBuildThiefSkillRow({ keyRaw, labelRaw, valueRaw, actor, type = "percent", canRoll = true }) {
  const key = add2eNormalizeThiefSkillKey(keyRaw || labelRaw);
  if (!key) return null;

  const base = Number(valueRaw ?? 0);
  if (!Number.isFinite(base)) return null;

  const isBackstab = key.includes("frappe") || key.includes("dos") || key.includes("backstab");
  const finalType = isBackstab ? "multiplier" : type;
  const bonuses = finalType === "multiplier" ? [] : add2eGetThiefSkillBonuses(actor, key);
  const bonusTotal = bonuses.reduce((sum, b) => sum + (Number(b.value) || 0), 0);
  const finalValue = finalType === "multiplier" ? base : Math.max(0, base + bonusTotal);
  const bonusDisplay = bonusTotal === 0 ? "" : add2eFormatSigned(bonusTotal);
  const detailParts = [
    `Base ${finalType === "multiplier" ? `×${base}` : `${base}%`}`,
    ...bonuses.map(b => `${b.label} ${add2eFormatSigned(b.value)}%`)
  ];

  return {
    key,
    label: String(labelRaw || keyRaw || key).trim(),
    shortLabel: String(labelRaw || keyRaw || key).trim()
      .replace(/^Détection\/désamorçage des pièges$/i, "Pièges")
      .replace(/^Détection de pièges$/i, "Pièges")
      .replace(/^Crochetage de serrures$/i, "Crochetage")
      .replace(/^Ouverture de serrures$/i, "Serrures")
      .replace(/^Déplacement silencieux$/i, "Silence")
      .replace(/^Dissimulation dans l’ombre$/i, "Dissimulation")
      .replace(/^Lecture des langues$/i, "Langues"),
    base,
    value: finalValue,
    finalValue,
    bonusTotal,
    bonusDisplay,
    bonuses,
    display: finalType === "multiplier" ? `×${finalValue}` : `${finalValue}%`,
    baseDisplay: finalType === "multiplier" ? `×${base}` : `${base}%`,
    type: finalType,
    canRoll: finalType !== "multiplier" && canRoll === true,
    note: finalType === "multiplier" ? "Multiplicateur d'attaque dans le dos" : "Jet de pourcentage : réussite si d100 ≤ score",
    breakdownTitle: detailParts.join(" | ")
  };
}

function add2eGetActorThiefSkills(actor, progressionRow = null) {
  const details = add2eGetThiefClassSystem(actor);
  const level = Math.max(1, Number(actor?.system?.niveau ?? 1) || 1);
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const row = progressionRow || progression.find((r, idx) => Number(r?.niveau ?? r?.level ?? idx + 1) === level) || null;
  if (!row) return [];

  const labelsObj = details.thiefSkillLabels && typeof details.thiefSkillLabels === "object"
    ? details.thiefSkillLabels
    : null;
  const order = Array.isArray(details.thiefSkillOrder) && details.thiefSkillOrder.length
    ? details.thiefSkillOrder.map(add2eNormalizeThiefSkillKey)
    : labelsObj
      ? Object.keys(labelsObj).map(add2eNormalizeThiefSkillKey)
      : [];

  const legacyLabels = Array.isArray(details.skillLabels) ? details.skillLabels : [];
  const legacyValues = Array.isArray(row.skills) ? row.skills : [];
  const structured = row.thiefSkills && typeof row.thiefSkills === "object" ? row.thiefSkills : {};

  const rows = [];
  const pushed = new Set();

  const pushSkill = (keyRaw, labelRaw, valueRaw, opts = {}) => {
    const skill = add2eBuildThiefSkillRow({ keyRaw, labelRaw, valueRaw, actor, ...opts });
    if (!skill || pushed.has(skill.key)) return;
    pushed.add(skill.key);
    rows.push(skill);
  };

  if (order.length) {
    for (let idx = 0; idx < order.length; idx++) {
      const key = order[idx];
      const label = labelsObj?.[key] ?? legacyLabels[idx] ?? key;
      const value = structured[key] ?? legacyValues[idx];
      pushSkill(key, label, value);
    }
  }

  // Compatibilité pure avec l'ancien couple skillLabels/progression.skills.
  if (!rows.length && legacyLabels.length && legacyValues.length) {
    legacyLabels.forEach((label, idx) => pushSkill(label, label, legacyValues[idx]));
  }

  const readLanguages = Number(row.readLanguages ?? row.read_languages ?? row.lectureLangues ?? structured.read_languages ?? structured.lecture_langues ?? 0) || 0;
  if (readLanguages > 0 && !pushed.has("lecture_langues")) {
    pushSkill("lecture_langues", "Lecture des langues", readLanguages);
  }

  return rows;
}

async function add2ePromptThiefSkillModifiers(actor, skill) {
  return new Promise(resolve => {
    const isPickpocket = skill.key === "pickpocket";
    const content = `
      <form class="add2e-thief-roll-dialog">
        <div style="margin-bottom:0.6em;">
          <b>${skill.label}</b><br>
          <span>Score actuel : ${skill.display}</span>
        </div>
        <div style="margin-bottom:0.6em;">
          <label>Modificateur situationnel</label>
          <input type="number" name="mod" value="0" step="1" style="width:5em;">
        </div>
        ${isPickpocket ? `
          <div style="margin-bottom:0.6em;">
            <label>Niveau de la cible</label>
            <input type="number" name="targetLevel" value="" min="0" step="1" style="width:5em;">
            <p style="margin:0.3em 0 0;color:#666;font-size:0.9em;">Pickpocket : –5 % par niveau de la cible au-dessus du niveau 3.</p>
          </div>
        ` : ""}
      </form>
    `;

    new Dialog({
      title: `Jet de ${skill.label}`,
      content,
      buttons: {
        roll: {
          label: "Lancer",
          callback: html => {
            const form = html[0]?.querySelector?.("form") ?? html.find?.("form")?.[0];
            const mod = Number(form?.querySelector?.('[name="mod"]')?.value ?? 0) || 0;
            const targetLevel = Number(form?.querySelector?.('[name="targetLevel"]')?.value ?? 0) || 0;
            resolve({ mod, targetLevel });
          }
        },
        cancel: { label: "Annuler", callback: () => resolve(null) }
      },
      default: "roll",
      close: () => resolve(null)
    }).render(true);
  });
}

async function add2eRollThiefSkill(actor, key) {
  if (!actor) return ui.notifications.warn("Acteur introuvable.");

  const details = add2eGetThiefClassSystem(actor);
  const level = Math.max(1, Number(actor.system?.niveau ?? 1) || 1);
  const progression = Array.isArray(details.progression) ? details.progression : [];
  const row = progression.find((r, idx) => Number(r?.niveau ?? r?.level ?? idx + 1) === level) || null;
  const skills = add2eGetActorThiefSkills(actor, row);
  const wanted = add2eNormalizeThiefSkillKey(key);
  const skill = skills.find(s => s.key === wanted);

  if (!skill) return ui.notifications.warn("Compétence de voleur introuvable pour ce niveau.");
  if (!skill.canRoll) return ui.notifications.info(`${skill.label} : ${skill.display}. Aucun jet automatique requis.`);

  const options = await add2ePromptThiefSkillModifiers(actor, skill);
  if (!options) return;

  const isAssassination = skill.key === "assassinat";
  const situational = Number(options.mod || 0) || 0;
  const targetLevel = Number(options.targetLevel || 0) || 0;
  const targetPenalty = skill.key === "pickpocket" && targetLevel > 3 ? -5 * (targetLevel - 3) : 0;
  const finalValue = Math.max(0, Number(skill.value || 0) + situational + targetPenalty);

  const roll = await new Roll("1d100").evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const success = roll.total <= finalValue;
  const noticed = skill.key === "pickpocket" && roll.total >= finalValue + 21;
  const color = success ? "#1f8f4d" : "#b3261e";
  const allDetails = [
    { label: "Base", value: skill.base },
    ...skill.bonuses,
    ...(situational !== 0 ? [{ label: "Situation", value: situational }] : []),
    ...(targetPenalty !== 0 ? [{ label: `Cible niveau ${targetLevel}`, value: targetPenalty }] : [])
  ];

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="add2e-card-test" style="border-radius:12px;border:1px solid ${color};background:#fffdf6;padding:0.75em 1em;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:0.6em;margin-bottom:0.4em;">
          <i class="fas fa-mask" style="color:${color};font-size:1.5em;"></i>
          <b style="color:${color};font-size:1.12em;">${skill.label}</b>
          <span style="margin-left:auto;color:#666;">${isAssassination ? "Compétence d’assassin" : "Compétence de voleur"}</span>
        </div>
        <div>Score final : <b>${finalValue}%</b> — Jet : <b>${roll.total}</b></div>
        <div style="font-size:0.9em;color:#555;margin-top:0.35em;">
          ${allDetails.map(d => `${d.label} ${add2eFormatSigned(d.value)}%`).join(" ; ")}
        </div>
        <div style="margin-top:0.35em;font-weight:800;color:${color};">${success ? "Réussite" : "Échec"}</div>
        ${isAssassination && success ? `<div style="margin-top:0.25em;color:#1f8f4d;font-weight:700;">Assassinat réussi : effet létal à appliquer selon les conditions de scène et l’arbitrage du MJ.</div>` : ""}
        ${isAssassination && !success ? `<div style="margin-top:0.25em;color:#b3261e;font-weight:700;">Assassinat manqué.</div>` : ""}
        ${noticed ? `<div style="margin-top:0.25em;color:#b3261e;font-weight:700;">La victime remarque la tentative de pickpocket.</div>` : ""}
      </div>
    `
  });
}

globalThis.add2eGetActorThiefSkills = add2eGetActorThiefSkills;
globalThis.add2eRollThiefSkill = add2eRollThiefSkill;
globalThis.add2eParseThiefBonusTag = add2eParseThiefBonusTag;

async function handleItemAction({ actor, action, itemId, itemType, sheet }) {
  if (!actor || !action || !itemId) return;

  const item = actor.items.get(itemId);
  if (!item) return;

  const effectiveType = (() => {
    const t = (itemType || item.type || "").toLowerCase();
    if (t === "weapon") return "arme";
    if (t === "armor") return "armure";
    return t;
  })();

  // EDIT
  if (action === "edit") {
    return item.sheet?.render(true);
  }

  // DELETE
  if (action === "delete") {
    await actor.deleteEmbeddedDocuments("Item", [item.id]);
    sheet?._add2eRememberActiveTab?.();
    sheet?.render(false);
    return;
  }

  // EQUIP
  if (action === "equip") {

    // =======================
    // ----- OBJETS (Divers) -
    // =======================
    if (effectiveType === "objet") {
      await item.update({ "system.equipee": !item.system.equipee });
      sheet?._add2eRememberActiveTab?.();
      sheet?.render(false);
      return;
    }

    // =======================
    // ----- ARMES -----------
    // =======================
    if (effectiveType === "arme") {
      const check = add2eCheckEquipmentAllowedForClass(actor, item, "arme");

      console.log("[ADD2E][EQUIPEMENT][ARME][CHECK]", {
        actor: actor.name,
        classe: check.classeLabel,
        classItem: check.classe?.__classItemName ?? null,
        item: item.name,
        mode: check.mode,
        reason: check.reason,
        ok: check.ok,
        matchedAllowed: check.matchedAllowed ?? null,
        matchedForbidden: check.matchedForbidden ?? null,
        itemTags: check.itemTags ?? add2eGetItemEquipTags(item),
        allowedTags: check.allowedTags ?? null,
        forbiddenTags: check.forbiddenTags ?? null
      });

      if (!check.ok) {
        const reason = check.reason === "forbidden"
          ? `tag interdit : ${check.matchedForbidden}`
          : "arme non autorisée par les restrictions de classe";

        ui.notifications.error(
          `⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${reason}.`
        );
        return;
      }

      const dejaEquipee = item.system.equipee === true;
      const estDeuxMains = !!item.system.deuxMains || add2eGetItemEquipTags(item).includes("usage:deux_mains");

      const isJet = !!item.system.arme_de_jet ||
        !!item.system.portee_courte ||
        !!item.system.portee_moyenne ||
        !!item.system.portee_longue ||
        add2eGetItemEquipTags(item).includes("usage:distance") ||
        add2eGetItemEquipTags(item).includes("usage:lancer");

      const isContact = !isJet;

      if (dejaEquipee) {
        await item.update({ "system.equipee": false });
        sheet?._add2eRememberActiveTab?.();
        sheet?.render(false);
        return;
      }

      if (estDeuxMains) {
        const bouclierEquipe = actor.items.find(i => {
          const t = (i.type || "").toLowerCase();
          return (t === "armure" || t === "armor") && i.system.equipee && add2eIsShield(i);
        });

        if (bouclierEquipe) {
          ui.notifications.error(
            `⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${bouclierEquipe.name}).`
          );
          return;
        }
      }

      for (const a of actor.items.filter(i => {
        const t = (i.type || "").toLowerCase();
        return (t === "arme" || t === "weapon") && i.id !== item.id;
      })) {
        const aTags = add2eGetItemEquipTags(a);
        const aIsJet = !!a.system.arme_de_jet ||
          !!a.system.portee_courte ||
          !!a.system.portee_moyenne ||
          !!a.system.portee_longue ||
          aTags.includes("usage:distance") ||
          aTags.includes("usage:lancer");

        const aIsContact = !aIsJet;

        if ((isJet && aIsJet) || (isContact && aIsContact)) {
          await a.update({ "system.equipee": false });
        }
      }

      await item.update({ "system.equipee": true });
      sheet?._add2eRememberActiveTab?.();
      sheet?.render(false);
      return;
    }

    // =======================
    // --- ARMURE / BOUCLIER / HEAUME ---
    // =======================
    if (effectiveType === "armure") {
      const estDejaEquipee = item.system.equipee === true;

      const estBouclier = add2eIsShield(item);
      const estHeaume = add2eIsHelmet(item);
      const estArmure = !estBouclier && !estHeaume;

      const check = add2eCheckEquipmentAllowedForClass(actor, item, "armure");

      console.log("[ADD2E][EQUIPEMENT][ARMURE][CHECK]", {
        actor: actor.name,
        classe: check.classeLabel,
        classItem: check.classe?.__classItemName ?? null,
        item: item.name,
        mode: check.mode,
        reason: check.reason,
        ok: check.ok,
        matchedAllowed: check.matchedAllowed ?? null,
        matchedForbidden: check.matchedForbidden ?? null,
        itemTags: check.itemTags ?? add2eGetItemEquipTags(item),
        allowedTags: check.allowedTags ?? null,
        forbiddenTags: check.forbiddenTags ?? null
      });

      const isMonk = ((check.classe?.label || check.classe?.nom || check.classe?.name || check.classeLabel || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f’']/g, "")
        .includes("moine"));

      const armorsAllowed = add2eToEquipArray(check.classe?.armorAllowed ?? check.classe?.armures_autorisees ?? [])
        .map(add2eNormalizeEquipTag);

      if (!add2eHasTagRestriction(check.classe?.armorRestriction) && isMonk && armorsAllowed.includes("aucune")) {
        ui.notifications.error(`⚠️ Les Moines ne peuvent jamais porter d’armure !`);
        return;
      }

      if (estBouclier) {
        const armeDeuxMains = actor.items.find(i => {
          const t = (i.type || "").toLowerCase();
          const tags = add2eGetItemEquipTags(i);
          return (t === "arme" || t === "weapon") && i.system.equipee && (!!i.system.deuxMains || tags.includes("usage:deux_mains"));
        });

        if (armeDeuxMains) {
          ui.notifications.error(
            `⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${armeDeuxMains.name}) déjà équipée.`
          );
          return;
        }
      }

      // Si déjà équipé → déséquipe sans contrôle de restriction.
      if (estDejaEquipee) {
        await item.update({ "system.equipee": false });
      } else {
        if (!check.ok) {
          const reason = check.reason === "forbidden"
            ? `tag interdit : ${check.matchedForbidden}`
            : "protection non autorisée par les restrictions de classe";

          const typeLabel = estBouclier ? "Ce bouclier" : estHeaume ? "Ce heaume" : "Cette armure";
          ui.notifications.error(
            `⚠️ ${typeLabel} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${reason}.`
          );
          return;
        }

        for (const i of actor.items) {
          const t = (i.type || "").toLowerCase();
          if ((t === "armure" || t === "armor") && i.id !== item.id) {
            if (
              (estArmure && !add2eIsShield(i) && !add2eIsHelmet(i)) ||
              (estBouclier && add2eIsShield(i)) ||
              (estHeaume && add2eIsHelmet(i))
            ) {
              await i.update({ "system.equipee": false });
            }
          }
        }

        if (estBouclier) {
          for (const arme of actor.items.filter(a => {
            const t = (a.type || "").toLowerCase();
            const tags = add2eGetItemEquipTags(a);
            return (t === "arme" || t === "weapon") && a.system.equipee && (!!a.system.deuxMains || tags.includes("usage:deux_mains"));
          })) {
            await arme.update({ "system.equipee": false });
            ui.notifications.warn(`Arme à deux mains déséquipée car un bouclier est équipé.`);
          }
        }

        await item.update({ "system.equipee": true });
      }

      const itemsEquipes = actor.items.filter(i => {
        const t = (i.type || "").toLowerCase();
        return (t === "armure" || t === "armor") && i.system.equipee;
      });

      const armure = itemsEquipes.find(i => !add2eIsShield(i) && !add2eIsHelmet(i));
      const bouclier = itemsEquipes.find(i => add2eIsShield(i));
      const heaume = itemsEquipes.find(i => add2eIsHelmet(i));

      let ca_total = actor.system.ca_naturel || 10;

      if (armure) ca_total = Number(armure.system.ac);
      if (bouclier) ca_total -= Number(bouclier.system.ac);
      if (heaume) ca_total -= Number(heaume.system.ac);

      ca_total += actor.system.dex_def || 0;

      await actor.update({ "system.ca_total": ca_total });

      sheet?._add2eRememberActiveTab?.();
      sheet?.render(false);
      return;
    }
  }
}


function showAdd2eDiceRollerDialog() {
  let html = `
    <form class="flexcol" style="gap:0.7em">
      <div style="display:flex;align-items:center;gap:1em;justify-content:center;">
        <label for="add2e-nb-dice" style="min-width:5.5em;">Nombre :</label>
        <input id="add2e-nb-dice" type="number" min="1" max="100" value="1" style="width:3.5em;">
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.4em;justify-content:center;margin-top:0.5em;">
        ${[4,6,8,10,12,20,100].map(f => 
          `<button type="button" class="dice-btn" data-faces="${f}" style="padding:0.45em 1em;font-size:1.13em;font-weight:600;background:#efe9f6;border-radius:7px;border:1.5px solid #9d8bd2;color:#674197;box-shadow:0 2px 5px #0001;">
            d${f}
          </button>`
        ).join('')}
      </div>
    </form>
  `;
  new Dialog({
    title: "Lancer de dés (AD&D2e)",
    content: html,
    render: dlgHtml => {
      dlgHtml.find('.dice-btn').on('click', async function(ev) {
        ev.preventDefault();
        const faces = Number($(this).data('faces'));
        const nb = Math.max(1, parseInt(dlgHtml.find('#add2e-nb-dice').val()) || 1);
        const formula = `${nb}d${faces}`;
        const roll = new Roll(formula);
        await roll.evaluate();
        roll.toMessage({
          flavor: `<b>Lancer de ${nb}d${faces}</b> (par le lanceur de dés AD&D2e)`
        });
        dlgHtml.closest('.window-app').remove();
      });
    },
    buttons: { cancel: { label: "Annuler" } },
    default: "cancel"
  }, { width: 340 }).render(true);
}
function add2e_updateFinalCaracs(actor) {
  const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
  const updates = {};

  for (let c of CARACS) {
    const base = getProperty(actor.system, `${c}_base`) ?? 10;
    const bonusRace = getProperty(actor.system.bonus_caracteristiques, c) ?? 0;
    const bonusDivers = getProperty(actor.system.bonus_divers_caracteristiques, c) ?? 0;

    updates[`system.${c}`] = base + bonusRace + bonusDivers;
  }

  return actor.update(updates);
}

function formatSortChamp(val) {
  if (!val) return "-";
  if (typeof val === "object") {
    // Gère { valeur: ..., unite: ... }
    const v = val.valeur !== undefined ? val.valeur : "";
    const u = val.unite ? (" " + val.unite) : "";
    return `${v}${u}`.trim() || "-";
  }
  return val;
}
globalThis.formatSortChamp = formatSortChamp;

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eClassEffectKey = add2eClassEffectKey; } catch (_e) {}
try { globalThis.add2eEffectFlagValue = add2eEffectFlagValue; } catch (_e) {}
try { globalThis.add2eShouldDeleteEffectForClassPurge = add2eShouldDeleteEffectForClassPurge; } catch (_e) {}
try { globalThis.add2eCollectUnlockedClassEffectTags = add2eCollectUnlockedClassEffectTags; } catch (_e) {}
try { globalThis.add2eSyncClassPassiveEffect = add2eSyncClassPassiveEffect; } catch (_e) {}
try { globalThis.add2eNormalizeThiefSkillKey = add2eNormalizeThiefSkillKey; } catch (_e) {}
try { globalThis.add2eThiefToArray = add2eThiefToArray; } catch (_e) {}
try { globalThis.add2eReadThiefBonusValue = add2eReadThiefBonusValue; } catch (_e) {}
try { globalThis.add2eGetThiefBonusFromMap = add2eGetThiefBonusFromMap; } catch (_e) {}
try { globalThis.add2ePushThiefBonus = add2ePushThiefBonus; } catch (_e) {}
try { globalThis.add2eGetActorRaceSystem = add2eGetActorRaceSystem; } catch (_e) {}
try { globalThis.add2eGetThiefClassSystem = add2eGetThiefClassSystem; } catch (_e) {}
try { globalThis.add2eGetEquippedThiefBonusMaps = add2eGetEquippedThiefBonusMaps; } catch (_e) {}
try { globalThis.add2eGetThiefDexBonus = add2eGetThiefDexBonus; } catch (_e) {}
try { globalThis.add2eParseThiefBonusTag = add2eParseThiefBonusTag; } catch (_e) {}
try { globalThis.add2eGetActiveTagThiefBonuses = add2eGetActiveTagThiefBonuses; } catch (_e) {}
try { globalThis.add2eGetThiefSkillBonuses = add2eGetThiefSkillBonuses; } catch (_e) {}
try { globalThis.add2eFormatSigned = add2eFormatSigned; } catch (_e) {}
try { globalThis.add2eBuildThiefSkillRow = add2eBuildThiefSkillRow; } catch (_e) {}
try { globalThis.add2eGetActorThiefSkills = add2eGetActorThiefSkills; } catch (_e) {}
try { globalThis.add2ePromptThiefSkillModifiers = add2ePromptThiefSkillModifiers; } catch (_e) {}
try { globalThis.add2eRollThiefSkill = add2eRollThiefSkill; } catch (_e) {}
try { globalThis.handleItemAction = handleItemAction; } catch (_e) {}
try { globalThis.showAdd2eDiceRollerDialog = showAdd2eDiceRollerDialog; } catch (_e) {}
try { globalThis.add2e_updateFinalCaracs = add2e_updateFinalCaracs; } catch (_e) {}
try { globalThis.formatSortChamp = formatSortChamp; } catch (_e) {}
