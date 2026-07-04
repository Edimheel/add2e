// ============================================================
// ADD2E — 08 Character Sheet UI — 02 capacités
// La feuille construit ses tuiles. Le HUD garde son rendu compact propre.
// ============================================================
import { escapeHtml, slug, expose, globalFn } from "./08-character-sheet-ui-00-utils.mjs";

const ADD2E_CAPABILITIES_SHEET_VERSION = "2026-07-04-thief-activity-sheet-source-v14";

function readNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function featureName(feature) {
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "Capacité").trim();
}

function featureMinLevel(feature) {
  return Math.max(1, readNumber(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.requiredLevel ?? feature?.niveauRequis ?? feature?.levelRequired ?? feature?.level ?? feature?.niveau, 1));
}

function featureMaxLevel(feature) {
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.levelMax ?? feature?.max;
  if (raw === undefined || raw === null || raw === "") return 999;
  return Math.max(1, readNumber(raw, 999));
}

function featureClassLevel(actor, feature) {
  const classLevel = readNumber(feature?._add2eClassLevel, NaN);
  if (Number.isFinite(classLevel) && classLevel >= 1) return Math.floor(classLevel);
  return Math.max(1, readNumber(actor?.system?.niveau, 1));
}

function featureAvailable(actor, feature) {
  const level = featureClassLevel(actor, feature);
  return level >= featureMinLevel(feature) && level <= featureMaxLevel(feature);
}

function featureOnUse(feature) {
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function featureIsActive(feature) {
  const fn = globalFn("add2eIsFeatureActivable");
  if (fn) {
    try { return fn(feature) === true; }
    catch (_error) {}
  }
  return feature?.activable === true
    || (feature?.active === true && feature?.passive !== true)
    || String(feature?._add2eFeatureSource ?? "") === "activeClassFeatures"
    || Boolean(featureOnUse(feature));
}

function classFeatures(actor) {
  const fn = globalFn("add2eGetActorClassFeatures");
  if (fn) {
    try { return Array.from(fn(actor) ?? []); }
    catch (error) { console.warn("[ADD2E][CAPACITES][CLASS_FEATURES]", error); }
  }
  return [];
}

function normalizeSkillKey(value) {
  const fn = globalFn("add2eNormalizeThiefSkillKey");
  if (fn) {
    try {
      const key = String(fn(value) ?? "").trim();
      if (key) return key;
    } catch (_error) {}
  }
  const raw = slug(value);
  return {
    pick_pockets: "pickpocket",
    pick_pocket: "pickpocket",
    open_locks: "crochetage_serrures",
    find_remove_traps: "detection_pieges",
    move_silently: "deplacement_silencieux",
    hide_in_shadows: "dissimulation",
    hear_noise: "ecoute",
    detect_noise: "ecoute",
    climb_walls: "escalade",
    backstab: "frappe_dans_le_dos",
    attaque_dans_le_dos: "frappe_dans_le_dos",
    attaque_sournoise: "frappe_dans_le_dos",
    sneak_attack: "frappe_dans_le_dos",
    read_languages: "lecture_langues"
  }[raw] ?? raw;
}

function isHiddenThiefSkill(value) {
  return normalizeSkillKey(value) === "frappe_dans_le_dos";
}

function isThiefSkillFeature(feature) {
  const systemFn = globalFn("add2eIsThiefSkillFeature");
  if (systemFn) {
    try { return systemFn(feature) === true; }
    catch (_error) {}
  }
  const text = `${slug(featureName(feature))} ${normalizeSkillKey(feature?.skillKey ?? feature?.key ?? feature?.slug ?? "")}`;
  return ["pickpocket", "crochetage", "serrure", "piege", "desamorc", "deplacement_silencieux", "dissimulation", "ecoute", "hear_noise", "escalade", "frappe_dans_le_dos", "backstab", "lecture_langues"].some(key => text.includes(key));
}

function getThiefSkills(actor) {
  const fn = globalFn("add2eGetActorThiefSkills");
  if (fn) {
    try {
      const skills = Array.from(fn(actor) ?? []);
      if (skills.length) return skills;
    } catch (error) {
      console.warn("[ADD2E][CAPACITES][THIEF_SKILLS]", error);
    }
  }
  const fallback = globalFn("add2eGetActorThiefSkillTable");
  if (!fallback) return [];
  try { return Array.from(fallback(actor) ?? []); }
  catch (error) {
    console.warn("[ADD2E][CAPACITES][THIEF_SKILLS_FALLBACK]", error);
    return [];
  }
}

function isThiefOrAssassin(actor) {
  return Array.from(actor?.items ?? []).some(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    const key = slug(item?.system?.slug ?? item?.name ?? "");
    return key.includes("voleur") || key.includes("assassin");
  });
}

function thiefPanelTitle(actor) {
  return Array.from(actor?.items ?? []).some(item => slug(item?.name).includes("assassin"))
    ? "Compétences de voleur / assassin"
    : "Compétences de voleur";
}

function skillByKey(skills) {
  return new Map(skills.map(skill => [normalizeSkillKey(skill?.key ?? skill?.label ?? ""), skill]));
}

function signedPercent(value) {
  const bonus = readNumber(value, 0);
  return `${bonus >= 0 ? "+" : ""}${bonus}%`;
}

function thiefRaceLabel(actor) {
  const raceItem = Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race");
  return String(raceItem?.name ?? actor?.system?.details_race?.label ?? actor?.system?.race ?? "Race").trim() || "Race";
}

function thiefBonusBreakdown(actor, skill) {
  const bonuses = Array.from(skill?.bonuses ?? []).filter(bonus => Number.isFinite(Number(bonus?.value)) && Number(bonus.value) !== 0);
  if (!bonuses.length) return "Aucun bonus ou malus.";
  const race = thiefRaceLabel(actor);
  return bonuses.map(bonus => {
    const source = String(bonus?.label ?? "Bonus").trim() || "Bonus";
    return `${source === "Race" ? `Race — ${race}` : source} ${signedPercent(bonus.value)}`;
  }).join(" | ");
}

function thiefActivityForSheet(sheet, actor) {
  const prepared = sheet?._add2ePreparedData?.thiefActivity;
  if (prepared && typeof prepared === "object") return prepared;
  const getActivity = globalFn("add2eGetThiefActivityEquipmentStatus");
  if (!getActivity) return { applies: false, ok: true, blockingItems: [], message: "" };
  try { return getActivity(actor) ?? { applies: false, ok: true, blockingItems: [], message: "" }; }
  catch (error) {
    console.warn("[ADD2E][CAPACITES][THIEF_ACTIVITY]", error);
    return { applies: false, ok: true, blockingItems: [], message: "" };
  }
}

function thiefActivityBlocked(activity) {
  return activity?.applies === true && activity?.ok === false;
}

function thiefActivityWarning(activity) {
  if (!thiefActivityBlocked(activity)) return "";
  const names = Array.from(activity?.blockingItems ?? [])
    .map(item => String(item?.name ?? "").trim())
    .filter(Boolean);
  const equipment = names.length ? `Équipement incompatible : ${names.join(", ")}.` : "Équipement actuellement incompatible.";
  return `<div class="a2e-thief-activity-warning" role="alert" style="display:flex;gap:8px;align-items:flex-start;margin:0 0 9px;padding:8px 10px;border:1px solid #b3261e;border-radius:8px;background:#fff0ed;color:#7a160e;font-weight:700;"><i class="fas fa-triangle-exclamation" aria-hidden="true" style="margin-top:2px;"></i><div><strong>Capacités de voleur indisponibles</strong><br><span>${escapeHtml(activity.message)}</span><br><small>${escapeHtml(equipment)}</small></div></div>`;
}

function thiefSkillIcon(key) {
  const normalized = normalizeSkillKey(key);
  if (normalized.includes("crochetage")) return "fa-key";
  if (normalized.includes("piege")) return "fa-exclamation-triangle";
  if (normalized.includes("deplacement")) return "fa-dice-d20";
  if (normalized.includes("dissimulation")) return "fa-user-secret";
  if (normalized.includes("ecoute")) return "fa-ear-listen";
  if (normalized.includes("escalade")) return "fa-mountain";
  if (normalized.includes("lecture")) return "fa-book-open";
  return "fa-hand-holding";
}

function thiefSkillTone(key) {
  const normalized = normalizeSkillKey(key);
  if (normalized.includes("crochetage")) return "lock";
  if (normalized.includes("piege")) return "trap";
  if (normalized.includes("deplacement")) return "move";
  if (normalized.includes("dissimulation")) return "hide";
  if (normalized.includes("ecoute")) return "listen";
  if (normalized.includes("escalade")) return "climb";
  if (normalized.includes("lecture")) return "language";
  return "pocket";
}

function thiefTile(actor, skill, feature = null, featureIndex = null, activity = null) {
  const name = feature ? featureName(feature) : String(skill?.shortLabel ?? skill?.label ?? "Compétence");
  const key = normalizeSkillKey(feature?.skillKey ?? skill?.key ?? name);
  const display = String(skill?.display ?? `${readNumber(skill?.finalValue ?? skill?.value ?? 0)}%`);
  const base = String(skill?.baseDisplay ?? `${readNumber(skill?.base, 0)}%`);
  const bonus = readNumber(skill?.bonusTotal, 0);
  const bonusClass = bonus > 0 ? "positive" : bonus < 0 ? "negative" : "neutral";
  const bonusTitle = thiefBonusBreakdown(actor, skill);
  const canRoll = skill?.canRoll !== false;
  const blocked = canRoll && thiefActivityBlocked(activity);
  const tileTitle = [
    blocked ? String(activity?.message ?? "Capacité indisponible") : (canRoll ? `Tester ${name}` : String(skill?.note ?? "Valeur automatique")),
    `Base ${base}`,
    bonusTitle
  ].join("\n");
  const content = `<span class="a2e-thief-skill-name">${escapeHtml(name)}</span><strong class="a2e-thief-skill-total">${escapeHtml(display)}</strong><span class="a2e-thief-skill-detail"><span>Base ${escapeHtml(base)}</span><span class="a2e-thief-skill-bonus ${bonusClass}" title="${escapeHtml(bonusTitle)}">${escapeHtml(signedPercent(bonus))}</span></span><span class="a2e-thief-skill-action"><i class="fas ${thiefSkillIcon(key)}" aria-hidden="true"></i></span>`;

  if (!canRoll || blocked) {
    return `<div class="a2e-thief-skill-card ${blocked ? "is-disabled" : "is-static"}" ${blocked ? 'aria-disabled="true" style="opacity:.55;cursor:not-allowed;filter:grayscale(.45);"' : ""} title="${escapeHtml(tileTitle)}">${content}</div>`;
  }

  if (feature) {
    return `<button type="button" class="a2e-thief-skill-card is-rollable add2e-thief-feature-roll" data-feature-index="${featureIndex}" data-feature-name="${escapeHtml(name)}" data-skill-key="${escapeHtml(key)}" data-skill-tone="${escapeHtml(thiefSkillTone(key))}" data-on-use="${escapeHtml(featureOnUse(feature))}" title="${escapeHtml(tileTitle)}">${content}</button>`;
  }

  return `<button type="button" class="a2e-thief-skill-card is-rollable add2e-thief-skill-roll" data-skill-key="${escapeHtml(key)}" data-skill-tone="${escapeHtml(thiefSkillTone(key))}" title="${escapeHtml(tileTitle)}">${content}</button>`;
}

function buildThiefTiles(actor, activity = null) {
  if (thiefActivityBlocked(activity)) return thiefActivityWarning(activity);

  const skills = getThiefSkills(actor).filter(skill => !isHiddenThiefSkill(skill?.key ?? skill?.label ?? ""));
  if (!skills.length) return "";

  const byKey = skillByKey(skills);
  const used = new Set();
  const featureTiles = [];
  classFeatures(actor).forEach((feature, index) => {
    if (!featureIsActive(feature) || !isThiefSkillFeature(feature) || !featureAvailable(actor, feature)) return;
    const key = normalizeSkillKey(feature?.skillKey ?? feature?.key ?? feature?.slug ?? featureName(feature));
    if (isHiddenThiefSkill(key)) return;
    const skill = byKey.get(key);
    if (!skill || used.has(key)) return;
    used.add(key);
    featureTiles.push(thiefTile(actor, skill, feature, index, activity));
  });

  const remaining = skills
    .filter(skill => !used.has(normalizeSkillKey(skill?.key ?? skill?.label ?? "")))
    .map(skill => thiefTile(actor, skill, null, null, activity));
  const tiles = [...featureTiles, ...remaining];
  if (!tiles.length) return "";

  return `<div class="a2e-panel add2e-thief-skills-panel"><h2>${escapeHtml(thiefPanelTitle(actor))}</h2><div class="a2e-panel-body"><div class="a2e-thief-skills-inline">${tiles.join("")}</div></div></div>`;
}

function iconControl({ className, icon, title, data = "" }) {
  return `<button type="button" class="${className}" ${data} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i class="fas ${icon}"></i></button>`;
}

function buildClassCard(feature, index, active) {
  const name = featureName(feature);
  const image = String(feature?.img ?? "").trim();
  const description = String(feature?.description ?? "").trim();
  const action = active
    ? iconControl({
      className: "add2e-feature-use add2e-feature-icon-only",
      icon: "fa-bolt",
      title: `Utiliser ${name}`,
      data: `data-feature-index="${index}" data-feature-name="${escapeHtml(name)}" data-feature-key="${escapeHtml(feature?.key ?? feature?.skillKey ?? feature?.slug ?? "")}" data-on-use="${escapeHtml(featureOnUse(feature))}"`
    })
    : "";
  return `<div class="a2e-feature-card ${active ? "is-activable" : "is-passive"}"><div class="a2e-feature-card-title">${image ? `<img class="a2e-feature-card-img" src="${escapeHtml(image)}" alt="">` : ""}<strong>${escapeHtml(name)}</strong>${action}</div>${description ? `<div class="a2e-feature-card-desc">${escapeHtml(description)}</div>` : ""}</div>`;
}

function racialEngine() {
  const engine = globalThis.Add2eEffectsEngine;
  return typeof engine?.getRacialActions === "function" ? engine : null;
}

function buildRacialCard(entry) {
  const vision = entry?.actionType === "vision-toggle";
  const enabled = entry?.enabled === true;
  const icon = vision ? (enabled ? "fa-eye" : "fa-eye-slash") : (entry?.iconClass || "fa-dice-d20");
  const title = vision ? `${enabled ? "Désactiver" : "Activer"} ${entry.label}` : `Utiliser ${entry.label}`;
  return `<div class="a2e-feature-card add2e-racial-feature-card is-activable"><div class="a2e-feature-card-title"><strong>${escapeHtml(entry?.label ?? "Capacité raciale")}</strong>${iconControl({ className: `add2e-racial-capability-use add2e-feature-icon-only ${vision ? (enabled ? "is-enabled" : "is-disabled") : "is-roll"}`, icon, title, data: `data-racial-capability-id="${escapeHtml(entry?.id ?? "")}"` })}</div>${entry?.description ? `<div class="a2e-feature-card-desc">${escapeHtml(entry.description)}</div>` : ""}</div>`;
}

function buildCapabilities(actor) {
  const all = classFeatures(actor).map((feature, index) => ({ feature, index })).filter(({ feature }) => featureAvailable(actor, feature));
  const thiefPresent = isThiefOrAssassin(actor) || getThiefSkills(actor).length > 0;
  const nonThief = all.filter(({ feature }) => !(thiefPresent && isThiefSkillFeature(feature)));
  const classActive = nonThief.filter(({ feature }) => featureIsActive(feature));
  const classPassive = nonThief.filter(({ feature }) => !featureIsActive(feature));
  const engine = racialEngine();
  const racialActions = engine?.getRacialActions?.(actor)?.filter(entry => entry?.activable !== false) ?? [];
  const racialPassives = engine?.getRacialPassiveEffects?.(actor) ?? [];
  const active = [...classActive.map(({ feature, index }) => buildClassCard(feature, index, true)), ...racialActions.map(buildRacialCard)];
  const passive = [
    ...classPassive.map(({ feature, index }) => buildClassCard(feature, index, false)),
    ...racialPassives.filter(effect => !slug(`${effect?.id ?? ""} ${effect?.name ?? ""}`).includes("infravision")).map(effect => `<div class="a2e-feature-card is-passive"><div class="a2e-feature-card-title"><strong>${escapeHtml(effect?.name ?? "Avantage racial")}</strong></div>${effect?.description ? `<div class="a2e-feature-card-desc">${escapeHtml(effect.description)}</div>` : ""}</div>`)
  ];

  return `<div class="a2e-grid-2 add2e-capacites-grid-modern"><div class="a2e-panel"><h2>Capacités activables</h2><div class="a2e-panel-body a2e-feature-card-list">${active.length ? active.join("") : `<p class="a2e-muted">Aucune capacité activable disponible à ce niveau.</p>`}</div></div><div class="a2e-panel"><h2>Capacités passives</h2><div class="a2e-panel-body a2e-feature-card-list">${passive.length ? passive.join("") : `<p class="a2e-muted">Aucune capacité passive disponible à ce niveau.</p>`}</div></div></div>`;
}

async function useRacialCapabilityFromElement(actor, element, sheet = null) {
  const engine = racialEngine();
  const capabilityId = String(element?.dataset?.racialCapabilityId ?? "").trim();
  if (!actor || !engine || !capabilityId) return false;
  if (!game.user?.isGM && !actor.isOwner && !actor.testUserPermission?.(game.user, "OWNER")) {
    ui.notifications?.warn?.("Vous ne pouvez pas utiliser les capacités de cet acteur.");
    return false;
  }
  const capability = engine.getRacialAction?.(actor, capabilityId);
  if (!capability) return ui.notifications?.warn?.("Capacité raciale introuvable."), false;

  if (capability.actionType === "vision-toggle") {
    const enabled = capability.enabled !== true;
    const result = await engine.setRacialVision?.(actor, enabled, { reason: "racial-capability-sheet" });
    if (!result || result.reason === "missing-actor") return ui.notifications?.error?.("Impossible de modifier l’infravision raciale."), false;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="add2e-card-test"><b>${escapeHtml(capability.label)}</b> : ${enabled ? "activée" : "désactivée"}.</div>` });
    sheet?.render?.(false);
    await globalThis.add2eRefreshActionHud?.();
    return true;
  }

  const result = await engine.rollRacialCapability?.(actor, capability.id);
  if (!result?.ok) return ui.notifications?.error?.("Le jet de capacité raciale n’a pas pu être résolu."), false;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="add2e-card-test"><b>${escapeHtml(capability.label)}</b> — Jet ${escapeHtml(result.formula)} : <b>${escapeHtml(result.total)}</b> / ${escapeHtml(result.successAt)} — <b>${result.success ? "Réussite" : "Échec"}</b></div>` });
  return true;
}

function bindCapabilities(root, actor, sheet) {
  for (const button of root.querySelectorAll(".add2e-thief-skill-roll")) {
    button.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();
      const roll = globalFn("add2eRollThiefSkill");
      if (!roll) return ui.notifications?.error?.("Le moteur des compétences de voleur n’est pas chargé.");
      await roll(actor, button.dataset.skillKey);
    };
  }
  for (const button of root.querySelectorAll(".add2e-feature-use, .add2e-thief-feature-roll")) {
    button.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();
      const use = globalFn("add2eUseClassFeatureFromElement");
      if (!use) return ui.notifications?.error?.("Le moteur des capacités de classe n’est pas chargé.");
      await use(actor, button, sheet);
    };
  }
  for (const button of root.querySelectorAll(".add2e-racial-capability-use")) {
    button.onclick = async event => {
      event.preventDefault();
      event.stopPropagation();
      await useRacialCapabilityFromElement(actor, button, sheet);
    };
  }
}

export function injectCapacitesTab(sheet, sheetRoot) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;
  const tab = sheetRoot?.querySelector?.('.sheet-body .a2e-tab-content[data-tab="capacites"], .sheet-body .tab[data-tab="capacites"]');
  if (!tab) return;

  const activity = thiefActivityForSheet(sheet, actor);
  const wrapper = document.createElement("div");
  wrapper.className = "add2e-capacites-modern-root";
  wrapper.dataset.add2eCapabilitiesVersion = ADD2E_CAPABILITIES_SHEET_VERSION;
  wrapper.innerHTML = `${buildThiefTiles(actor, activity)}${buildCapabilities(actor)}`;
  tab.replaceChildren(wrapper);
  bindCapabilities(wrapper, actor, sheet);
}

expose("add2eUiFeatureName", featureName);
expose("add2eUiGetThiefSkills", getThiefSkills);
expose("add2eUiInjectCapacitesTab", injectCapacitesTab);
expose("add2eUseRacialCapabilityFromElement", useRacialCapabilityFromElement);
