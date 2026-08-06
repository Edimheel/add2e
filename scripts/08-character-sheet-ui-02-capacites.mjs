// ============================================================
// ADD2E — 08 Character Sheet UI — 02 capacités
// La feuille construit ses tuiles. Le HUD garde son rendu compact propre.
// ============================================================
import { escapeHtml, slug, expose, globalFn } from "./08-character-sheet-ui-00-utils.mjs";

const ADD2E_CAPABILITIES_SHEET_VERSION = "2026-08-06-canonical-racial-skill-cards-v3";
const ADD2E_CAPABILITY_ICON_ROOT = "systems/add2e/assets/icones/capacites";
const ADD2E_RACIAL_ARTWORK_FLAG = "__ADD2E_RACIAL_CAPABILITY_ARTWORK_V1";

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

function isBackstabFeature(feature) {
  return isHiddenThiefSkill(feature?.skillKey ?? feature?.key ?? feature?.slug ?? featureName(feature));
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

function capacityIcon(filename) {
  return `${ADD2E_CAPABILITY_ICON_ROOT}/${filename}`;
}

function thiefSkillImage(key) {
  const normalized = normalizeSkillKey(key);
  const images = {
    pickpocket: "pickpocket.webp",
    crochetage_serrures: "crochetage-serrures.webp",
    detection_pieges: "detection-pieges.webp",
    deplacement_silencieux: "deplacement-silencieux.webp",
    dissimulation: "dissimulation.webp",
    ecoute: "ecoute.webp",
    escalade: "escalade.webp",
    lecture_langues: "lecture-langues.webp",
    frappe_dans_le_dos: "frappe-dans-le-dos.webp"
  };
  return capacityIcon(images[normalized] ?? "pickpocket.webp");
}

function classFeatureImage(feature) {
  const name = featureName(feature);
  const tokens = `${slug(name)} ${slug(featureOnUse(feature))}`;
  if (tokens.includes("vade_retro") || tokens.includes("repousser_morts_vivants")) return capacityIcon("vade-retro.webp");
  if (["frappe_dans_le_dos", "attaque_dans_le_dos", "attaque_sournoise", "backstab"].some(token => tokens.includes(token))) return capacityIcon("frappe-dans-le-dos.webp");
  return String(feature?.img ?? feature?.image ?? "").trim();
}

function racialCapabilityImage(id, label = "") {
  const key = slug(`${id ?? ""} ${label ?? ""}`);
  const images = [
    [/infravision|vision_infrarouge/, "infravision.webp"],
    [/porte_secrete|porte_derobee|secret_door|secret_porte|hidden_door/, "detection-portes-secretes.webp"],
    [/ouie|auditive|hear_noise|bruit/, "ouie-affutee.webp"],
    [/pente|direction|profondeur|paroi|construction|pierre|stonework/, "sens-de-la-pierre.webp"],
    [/compartiment|cachette|cache_secret|hidden_cache/, "detection-compartiments-secrets.webp"],
    [/piege|trap/, "detection-pieges.webp"],
    [/discretion|surprise|camouflage|furtiv/, "discretion-naturelle.webp"],
    [/charme|charm/, "resistance-charmes.webp"],
    [/sommeil|sleep/, "resistance-sommeil.webp"],
    [/poison|venin/, "resistance-poison.webp"]
  ];
  const match = images.find(([pattern]) => pattern.test(key));
  return match ? capacityIcon(match[1]) : "";
}

function plainFeatureDescription(feature) {
  const raw = String(feature?.description ?? feature?.desc ?? feature?.text ?? "").trim();
  if (!raw) return "";
  const holder = document.createElement("div");
  holder.innerHTML = raw.replace(/<img\b[^>]*>/gi, " ");
  return String(holder.textContent ?? "").replace(/\s+/g, " ").trim();
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
  const content = `<span class="a2e-thief-skill-art"><img src="${escapeHtml(thiefSkillImage(key))}" alt="" aria-hidden="true"></span><span class="a2e-thief-skill-name">${escapeHtml(name)}</span><strong class="a2e-thief-skill-total">${escapeHtml(display)}</strong><span class="a2e-thief-skill-detail"><span>Base ${escapeHtml(base)}</span><span class="a2e-thief-skill-bonus ${bonusClass}" title="${escapeHtml(bonusTitle)}">${escapeHtml(signedPercent(bonus))}</span></span>`;
  if (!canRoll || blocked) return `<div class="a2e-thief-skill-card ${blocked ? "is-disabled" : "is-static"}" ${blocked ? 'aria-disabled="true" style="opacity:.55;cursor:not-allowed;filter:grayscale(.45);"' : ""} title="${escapeHtml(tileTitle)}">${content}</div>`;
  if (feature) return `<button type="button" class="a2e-thief-skill-card is-rollable add2e-thief-feature-roll" data-feature-index="${featureIndex}" data-feature-name="${escapeHtml(name)}" data-skill-key="${escapeHtml(key)}" data-on-use="${escapeHtml(featureOnUse(feature))}" title="${escapeHtml(tileTitle)}">${content}</button>`;
  return `<button type="button" class="a2e-thief-skill-card is-rollable add2e-thief-skill-roll" data-skill-key="${escapeHtml(key)}" title="${escapeHtml(tileTitle)}">${content}</button>`;
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
  const remaining = skills.filter(skill => !used.has(normalizeSkillKey(skill?.key ?? skill?.label ?? ""))).map(skill => thiefTile(actor, skill, null, null, activity));
  const tiles = [...featureTiles, ...remaining];
  if (!tiles.length) return "";
  return `<div class="a2e-panel add2e-thief-skills-panel"><h2>${escapeHtml(thiefPanelTitle(actor))}</h2><div class="a2e-panel-body"><div class="a2e-thief-skills-inline">${tiles.join("")}</div></div></div>`;
}

function iconControl({ className, icon, title, data = "" }) {
  return `<button type="button" class="${className}" ${data} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i class="fas ${icon}"></i></button>`;
}

function buildClassCard(feature, index, active) {
  const name = featureName(feature);
  const image = classFeatureImage(feature);
  const description = plainFeatureDescription(feature);
  const data = `data-feature-index="${index}" data-feature-name="${escapeHtml(name)}" data-feature-key="${escapeHtml(feature?.key ?? feature?.skillKey ?? feature?.slug ?? "")}" data-on-use="${escapeHtml(featureOnUse(feature))}"`;
  const visual = image
    ? active
      ? `<button type="button" class="add2e-feature-use a2e-feature-image-button" ${data} title="${escapeHtml(`Utiliser ${name}`)}" aria-label="${escapeHtml(`Utiliser ${name}`)}"><img class="a2e-feature-card-img" src="${escapeHtml(image)}" alt=""></button>`
      : `<span class="a2e-feature-image-static"><img class="a2e-feature-card-img" src="${escapeHtml(image)}" alt=""></span>`
    : active
      ? iconControl({ className: "add2e-feature-use add2e-feature-icon-only", icon: "fa-bolt", title: `Utiliser ${name}`, data })
      : "";
  return `<div class="a2e-feature-card ${active ? "is-activable" : "is-passive"}">${visual ? `<div class="a2e-feature-card-visual">${visual}</div>` : ""}<div class="a2e-feature-card-content"><div class="a2e-feature-card-title"><strong>${escapeHtml(name)}</strong></div>${description ? `<div class="a2e-feature-card-desc">${escapeHtml(description)}</div>` : ""}</div></div>`;
}

function racialEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  return typeof engine?.getRacialActions === "function" ? engine : null;
}

function racialVisionStateHtml(enabled) {
  const active = enabled === true;
  const color = active ? "#116b9d" : "#8f451f";
  const background = active ? "#e6f7ff" : "#fff0e6";
  const border = active ? "#48b5e4" : "#d69061";
  const icon = active ? "fa-eye" : "fa-eye-slash";
  const label = active ? "Infravision active" : "Infravision inactive";
  return `<span class="a2e-racial-vision-state ${active ? "is-active" : "is-inactive"}" style="display:inline-flex;align-items:center;gap:4px;margin-left:7px;padding:2px 6px;border:1px solid ${border};border-radius:999px;background:${background};color:${color};font-size:.72em;font-weight:900;white-space:nowrap;"><i class="fas ${icon}" aria-hidden="true"></i>${label}</span>`;
}

function buildRacialCard(entry, active = true) {
  const vision = entry?.actionType === "vision-toggle";
  const actionable = vision || entry?.canRoll === true;
  const enabled = entry?.enabled === true;
  const name = String(entry?.label ?? "Capacité raciale").trim() || "Capacité raciale";
  const title = vision
    ? `${enabled ? "Désactiver" : "Activer"} ${name}`
    : actionable
      ? `Utiliser ${name}`
      : name;
  const image = racialCapabilityImage(entry?.id ?? entry?.key, name);
  const data = `data-racial-capability-id="${escapeHtml(entry?.id ?? "")}"`;
  const visionClass = vision ? (enabled ? "is-enabled is-vision-active" : "is-disabled is-vision-inactive") : "is-roll";
  const visualStyle = vision ? (enabled ? "border-color:#48b5e4!important;background:#07364e!important;box-shadow:0 0 0 2px rgba(72,181,228,.25),0 0 12px rgba(72,181,228,.42)!important;" : "border-color:#a66a47!important;background:#35261f!important;box-shadow:none!important;filter:grayscale(.82) brightness(.78);") : "";
  const imageStyle = vision && !enabled ? " style=\"filter:grayscale(1) brightness(.7);\"" : "";
  const visual = image
    ? actionable
      ? `<button type="button" class="add2e-racial-capability-use a2e-feature-image-button ${visionClass}" ${data} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"${visualStyle ? ` style="${visualStyle}"` : ""}><img class="a2e-feature-card-img" src="${escapeHtml(image)}" alt=""${imageStyle}></button>`
      : `<span class="a2e-feature-image-static"><img class="a2e-feature-card-img" src="${escapeHtml(image)}" alt=""></span>`
    : actionable
      ? iconControl({ className: `add2e-racial-capability-use add2e-feature-icon-only ${visionClass}`, icon: vision ? (enabled ? "fa-eye" : "fa-eye-slash") : (entry?.iconClass || "fa-dice-d20"), title, data })
      : "";
  const state = vision ? racialVisionStateHtml(enabled) : "";
  return `<div class="a2e-feature-card add2e-racial-feature-card ${active && actionable ? "is-activable" : "is-passive"} ${vision ? (enabled ? "a2e-racial-vision-active" : "a2e-racial-vision-inactive") : ""}">${visual ? `<div class="a2e-feature-card-visual">${visual}</div>` : ""}<div class="a2e-feature-card-content"><div class="a2e-feature-card-title"><strong>${escapeHtml(name)}</strong>${state}</div>${entry?.description ? `<div class="a2e-feature-card-desc">${escapeHtml(entry.description)}</div>` : ""}</div></div>`;
}

function buildCapabilities(actor) {
  const all = classFeatures(actor).map((feature, index) => ({ feature, index })).filter(({ feature }) => featureAvailable(actor, feature));
  const thiefPresent = isThiefOrAssassin(actor) || getThiefSkills(actor).length > 0;
  const nonThief = all.filter(({ feature }) => !(thiefPresent && isThiefSkillFeature(feature) && !isBackstabFeature(feature)));
  const classActive = nonThief.filter(({ feature }) => featureIsActive(feature) && !isBackstabFeature(feature));
  const classPassive = nonThief.filter(({ feature }) => !featureIsActive(feature) || isBackstabFeature(feature));
  const engine = racialEngine();
  const racialActions = engine?.getRacialActions?.(actor)?.filter(entry => entry?.activable !== false) ?? [];
  const racialNarratives = engine?.getRacialCapabilities?.(actor)?.filter(entry => entry?.canRoll !== true) ?? [];
  const racialPassives = engine?.getRacialPassiveEffects?.(actor) ?? [];
  const active = [...classActive.map(({ feature, index }) => buildClassCard(feature, index, true)), ...racialActions.map(entry => buildRacialCard(entry, true))];
  const passive = [
    ...classPassive.map(({ feature, index }) => buildClassCard(feature, index, false)),
    ...racialNarratives.map(entry => buildRacialCard(entry, false)),
    ...racialPassives.filter(effect => !slug(`${effect?.id ?? ""} ${effect?.name ?? ""}`).includes("infravision")).map(effect => `<div class="a2e-feature-card is-passive"><div class="a2e-feature-card-content"><div class="a2e-feature-card-title"><strong>${escapeHtml(effect?.name ?? "Avantage racial")}</strong></div>${effect?.description ? `<div class="a2e-feature-card-desc">${escapeHtml(effect.description)}</div>` : ""}</div></div>`)
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
    if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
      return ui.notifications?.error?.("Les cartes ADD2E sont indisponibles."), false;
    }
    const state = enabled ? "Activée" : "Désactivée";
    const card = {
      actor,
      title: `${capability.label} — ${state}`,
      icon: `fas ${enabled ? "fa-eye" : "fa-eye-slash"}`,
      variant: enabled ? "success" : "neutral",
      source: {
        name: actor.name,
        img: actor.img,
        type: "Capacité raciale"
      },
      rows: [{ label: "État", value: state }],
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor }),
        flags: {
          add2e: {
            racialCapability: {
              actorId: actor.id,
              raceSourceId: capability.sourceId ?? "",
              capabilityId: capability.id,
              action: "vision-toggle",
              enabled
            }
          }
        }
      }
    };
    globalThis.add2eBuildChatCard(card);
    await globalThis.add2eCreateChatCard(card);
    sheet?.render?.(false);
    await globalThis.add2eRefreshActionHud?.();
    return true;
  }
  const roll = globalThis.add2eRollRacialCapability;
  if (typeof roll !== "function") return ui.notifications?.error?.("Le moteur des capacités raciales n’est pas chargé."), false;
  const result = await roll(actor, capability.id, { source: "actor-sheet-racial-capability" });
  if (!result?.ok) return false;
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

function decorateRacialHudArtwork(root = document) {
  const buttons = root?.matches?.("button.a2e-hud-racial-icon[data-racial-capability-id]") ? [root] : Array.from(root?.querySelectorAll?.("button.a2e-hud-racial-icon[data-racial-capability-id]") ?? []);
  for (const button of buttons) {
    const row = button.closest?.(".a2e-hud-racial-row");
    const label = String(row?.querySelector?.(".title")?.textContent ?? "").trim();
    const image = racialCapabilityImage(button.dataset.racialCapabilityId, label);
    if (!image || button.dataset.add2eRacialArtwork === image) continue;
    button.dataset.add2eRacialArtwork = image;
    button.classList.add("a2e-hud-racial-capability-art");
    button.innerHTML = `<img src="${escapeHtml(image)}" alt="" aria-hidden="true" style="display:block!important;width:24px!important;height:24px!important;object-fit:cover!important;border:0!important;border-radius:5px!important;pointer-events:none!important;">`;
  }
}

function installRacialHudArtwork() {
  if (globalThis[ADD2E_RACIAL_ARTWORK_FLAG]) return;
  globalThis[ADD2E_RACIAL_ARTWORK_FLAG] = true;
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes ?? []) {
        if (node?.nodeType === Node.ELEMENT_NODE) decorateRacialHudArtwork(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  decorateRacialHudArtwork();
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

if (game?.ready) installRacialHudArtwork();
else Hooks.once("ready", installRacialHudArtwork);

expose("add2eUiFeatureName", featureName);
expose("add2eUiGetThiefSkills", getThiefSkills);
expose("add2eUiInjectCapacitesTab", injectCapacitesTab);
expose("add2eUseRacialCapabilityFromElement", useRacialCapabilityFromElement);
