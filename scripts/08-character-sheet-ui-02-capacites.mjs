// ============================================================
// ADD2E — 08 Character Sheet UI — 02 capacités
// ============================================================
import { escapeHtml, slug, expose, globalFn } from "./08-character-sheet-ui-00-utils.mjs";

function featureName(feature) {
  const fn = globalFn("add2eFeatureName");
  if (fn) return fn(feature);
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "Capacité").trim();
}

function featureMinLevel(feature) {
  const fn = globalFn("add2eFeatureMinLevel");
  if (fn) return fn(feature);
  return Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1) || 1;
}

function featureMaxLevel(feature) {
  const fn = globalFn("add2eFeatureMaxLevel");
  if (fn) return fn(feature);
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  return raw === undefined || raw === null || raw === "" ? 999 : Number(raw) || 999;
}

function featureOnUse(feature) {
  const fn = globalFn("add2eFeatureOnUse");
  if (fn) return fn(feature);
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function isFeatureActivable(feature) {
  const fn = globalFn("add2eIsFeatureActivable");
  if (fn) return fn(feature);
  if (!feature || typeof feature !== "object") return false;
  if (feature.activable === true) return true;
  if (feature.active === true && feature.passive !== true) return true;
  if (String(feature._add2eFeatureSource ?? "") === "activeClassFeatures") return true;
  return !!featureOnUse(feature);
}

function allClassFeatures(actor) {
  const fn = globalFn("add2eGetActorClassFeatures");
  if (fn) {
    try { return fn(actor) ?? []; }
    catch (e) { console.warn("[ADD2E][CAPACITES][FEATURES] Lecture add2eGetActorClassFeatures impossible", e); }
  }

  const sys = actor?.system ?? {};
  const classItem = actor?.items?.find?.(i => String(i?.type || "").toLowerCase() === "classe") ?? null;
  const systems = [sys.details_classe, classItem?.system, sys].filter(s => s && typeof s === "object");
  const out = [];
  const push = (value, source) => {
    const arr = Array.isArray(value) ? value : (value && typeof value === "object" ? Object.values(value) : []);
    for (const f of arr) if (f && typeof f === "object") out.push({ ...f, _add2eFeatureSource: source });
  };

  for (const s of systems) {
    push(s.activeClassFeatures, "activeClassFeatures");
    push(s.activableClassFeatures, "activableClassFeatures");
    push(s.classFeaturesActives, "classFeaturesActives");
    push(s.capacitesActives, "capacitesActives");
    push(s.capacitesActivables, "capacitesActivables");
    push(s.classFeatures, "classFeatures");
    push(s.classFeaturesDebloquees, "classFeaturesDebloquees");
    push(s.capacitesClasse, "capacitesClasse");
    push(s.passiveClassFeatures, "passiveClassFeatures");
    push(s.passiveFeatures, "passiveFeatures");
    push(s.capacitesPassives, "capacitesPassives");
  }

  return out;
}

function getThiefSkills(actor) {
  const fn = globalFn("add2eGetActorThiefSkills");
  if (!fn) return [];
  try { return fn(actor) ?? []; }
  catch (e) {
    console.warn("[ADD2E][CAPACITES][VOLEUR] Impossible de lire add2eGetActorThiefSkills", e);
    return [];
  }
}

function isThiefLikeActor(actor) {
  const className = String(actor?.system?.classe ?? actor?.system?.details_classe?.label ?? actor?.system?.details_classe?.name ?? "");
  const s = slug(className);
  return s.includes("voleur") || s.includes("assassin");
}

function isThiefSkillFeature(feature) {
  const name = slug(featureName(feature));
  const key = slug(feature?.skillKey ?? feature?.key ?? feature?.slug ?? "");
  const joined = `${name} ${key}`;

  return [
    "pickpocket",
    "faire_les_poches",
    "crochetage",
    "serrure",
    "piege",
    "desamorc",
    "deplacement_silencieux",
    "silence",
    "dissimulation",
    "cacher",
    "ecoute",
    "bruit",
    "escalade",
    "grimper",
    "frappe_dans_le_dos",
    "attaque_dans_le_dos",
    "backstab"
  ].some(token => joined.includes(token));
}

function visibleFeatures(actor) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  const thiefLike = isThiefLikeActor(actor);
  const seen = new Set();

  return allClassFeatures(actor)
    .map((feature, index) => ({ feature, index }))
    .filter(({ feature }) => level >= featureMinLevel(feature) && level <= featureMaxLevel(feature))
    .filter(({ feature }) => !(thiefLike && isThiefSkillFeature(feature)))
    .filter(({ feature }) => {
      const key = `${slug(featureName(feature))}|${featureMinLevel(feature)}|${isFeatureActivable(feature) ? "A" : "P"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildThiefSkillsPanel(actor) {
  const skills = getThiefSkills(actor);
  if (!skills.length) return "";

  const cards = skills.map(skill => {
    const bonus = Number(skill.bonusTotal ?? 0) || 0;
    const bonusHtml = bonus === 0
      ? `<span class="a2e-thief-skill-bonus neutral">+0%</span>`
      : `<span class="a2e-thief-skill-bonus ${bonus > 0 ? "positive" : "negative"}">${bonus > 0 ? "+" : ""}${bonus}%</span>`;
    const action = skill.canRoll === false
      ? `<span class="a2e-muted">—</span>`
      : `<button type="button" class="a2e-btn blue add2e-thief-skill-roll" data-skill-key="${escapeHtml(skill.key)}" title="Tester ${escapeHtml(skill.label ?? skill.shortLabel ?? skill.key)}"><i class="fas fa-dice-d100"></i></button>`;

    return `
      <div class="a2e-thief-skill-card" title="${escapeHtml(skill.breakdownTitle ?? "")}">
        <div class="a2e-thief-skill-name">${escapeHtml(skill.shortLabel || skill.label || skill.key)}</div>
        <div class="a2e-thief-skill-total">${escapeHtml(skill.display ?? `${skill.finalValue ?? skill.value ?? 0}%`)}</div>
        <div class="a2e-thief-skill-detail"><span>Base ${escapeHtml(skill.baseDisplay ?? `${skill.base ?? 0}%`)}</span>${bonusHtml}</div>
        <div class="a2e-thief-skill-action">${action}</div>
      </div>`;
  }).join("");

  return `
    <div class="a2e-panel add2e-thief-skills-panel">
      <h2>Compétences de voleur / assassin</h2>
      <div class="a2e-panel-body"><div class="a2e-thief-skills-inline">${cards}</div></div>
    </div>`;
}

function buildFeatureCard(actor, feature, index, mode) {
  const name = featureName(feature);
  const desc = String(feature?.description ?? feature?.desc ?? feature?.text ?? "").trim();
  const onUse = featureOnUse(feature);
  const skillKey = feature?.skillKey ?? feature?.key ?? feature?.slug ?? "";
  const uses = feature?.uses?.label ?? feature?.usageLabel ?? "Disponible";
  const button = mode === "active"
    ? `<div class="a2e-feature-actions"><button type="button" class="a2e-btn blue add2e-feature-use" data-feature-index="${index}" data-feature-name="${escapeHtml(name)}" data-skill-key="${escapeHtml(skillKey)}" data-on-use="${escapeHtml(onUse)}"><i class="fas fa-bolt"></i>&nbsp;Utiliser</button></div>`
    : "";

  return `
    <div class="a2e-feature-card">
      <div class="a2e-feature-card-title"><strong>${escapeHtml(name)}</strong><span>${mode === "active" ? escapeHtml(uses) : "Actif"}</span></div>
      ${desc ? `<div class="a2e-feature-card-desc">${desc}</div>` : ""}
      ${button}
    </div>`;
}

function buildClassFeaturesPanel(actor) {
  const features = visibleFeatures(actor);
  const active = features.filter(({ feature }) => isFeatureActivable(feature));
  const passive = features.filter(({ feature }) => !isFeatureActivable(feature));

  const activeHtml = active.length
    ? active.map(entry => buildFeatureCard(actor, entry.feature, entry.index, "active")).join("")
    : `<p class="a2e-muted">Aucune capacité activable disponible à ce niveau.</p>`;

  const passiveHtml = passive.length
    ? passive.map(entry => buildFeatureCard(actor, entry.feature, entry.index, "passive")).join("")
    : `<p class="a2e-muted">Aucune capacité passive disponible à ce niveau.</p>`;

  return `
    <div class="a2e-grid-2 add2e-capacites-grid-modern">
      <div class="a2e-panel"><h2>Capacités activables</h2><div class="a2e-panel-body a2e-feature-card-list">${activeHtml}</div></div>
      <div class="a2e-panel"><h2>Capacités passives</h2><div class="a2e-panel-body a2e-feature-card-list">${passiveHtml}</div></div>
    </div>`;
}

export function injectCapacitesTab(sheet, sheetRoot) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;

  const tab = sheetRoot.querySelector('.sheet-body .a2e-tab-content[data-tab="capacites"], .sheet-body .tab[data-tab="capacites"]');
  if (!tab) return;

  const oldGrid = tab.querySelector(":scope > .a2e-grid-2:not(.add2e-capacites-grid-modern)");
  if (oldGrid) oldGrid.style.display = "none";

  const previous = tab.querySelector(".add2e-capacites-modern-root");
  if (previous) previous.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "add2e-capacites-modern-root";
  wrapper.innerHTML = `${buildThiefSkillsPanel(actor)}${buildClassFeaturesPanel(actor)}`;
  tab.insertBefore(wrapper, tab.firstElementChild || null);

  $(wrapper).find(".add2e-thief-skill-roll")
    .off("click.add2e-thief-skill-roll")
    .on("click.add2e-thief-skill-roll", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const fn = globalFn("add2eRollThiefSkill");
      if (!fn) return ui.notifications.error("Le moteur des compétences de voleur n'est pas chargé.");
      await fn(actor, ev.currentTarget.dataset.skillKey);
      return false;
    });

  $(wrapper).find(".add2e-feature-use")
    .off("click.add2e-feature-use-modern")
    .on("click.add2e-feature-use-modern", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const fn = globalFn("add2eUseClassFeatureFromElement");
      if (!fn) return ui.notifications.error("Le moteur des capacités de classe n'est pas chargé.");
      await fn(actor, ev.currentTarget, sheet);
      return false;
    });

  console.log("[ADD2E][CAPACITES][UI][SPLIT] Rendu capacités", {
    actor: actor.name,
    level: actor.system?.niveau,
    thiefSkills: getThiefSkills(actor).length,
    features: visibleFeatures(actor).map(e => featureName(e.feature))
  });
}

expose("add2eUiFeatureName", featureName);
expose("add2eUiAllClassFeatures", allClassFeatures);
expose("add2eUiGetThiefSkills", getThiefSkills);
expose("add2eUiBuildThiefSkillsPanel", buildThiefSkillsPanel);
expose("add2eUiInjectCapacitesTab", injectCapacitesTab);
