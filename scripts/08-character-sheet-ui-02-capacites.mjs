// ============================================================
// ADD2E — 08 Character Sheet UI — 02 capacités
// ============================================================
import { escapeHtml, slug, expose, globalFn } from "./08-character-sheet-ui-00-utils.mjs";

function featureName(feature) {
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "Capacité").trim();
}

function readLevel(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function featureMinLevel(feature) {
  return readLevel(
    feature?.minLevel ??
    feature?.minimumLevel ??
    feature?.niveauMin ??
    feature?.requiredLevel ??
    feature?.niveauRequis ??
    feature?.levelRequired ??
    feature?.level ??
    feature?.niveau,
    1
  );
}

function featureMaxLevel(feature) {
  return readLevel(
    feature?.maxLevel ??
    feature?.maximumLevel ??
    feature?.niveauMax ??
    feature?.levelMax ??
    feature?.max,
    999
  );
}

function featureOnUse(feature) {
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function isFeatureActivable(feature) {
  const fn = globalFn("add2eIsFeatureActivable");
  if (fn) {
    try { return fn(feature); }
    catch (_e) {}
  }

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

function classSlug(actor) {
  return slug(
    actor?.system?.classe ??
    actor?.system?.details_classe?.label ??
    actor?.system?.details_classe?.name ??
    actor?.items?.find?.(i => String(i?.type || "").toLowerCase() === "classe")?.name ??
    ""
  );
}

function isThiefSkillClass(actor) {
  const s = classSlug(actor);
  return s.includes("voleur") || s.includes("assassin") || s.includes("moine");
}

function thiefSkillPanelTitle(actor) {
  const s = classSlug(actor);
  if (s.includes("moine")) return "Compétences spéciales du moine";
  if (s.includes("assassin")) return "Compétences de voleur / assassin";
  if (s.includes("voleur")) return "Compétences de voleur";
  return "Compétences spéciales";
}

function isBackstabLike(value) {
  const s = slug(value);
  return s.includes("backstab")
    || s.includes("frappe_dans_le_dos")
    || s.includes("attaque_dans_le_dos")
    || s.includes("dos")
    || s.includes("sournoise")
    || s.includes("assassination");
}

function isListenLike(value) {
  const s = slug(value);
  return s.includes("ecoute")
    || s.includes("auditiv")
    || s.includes("ouie")
    || s.includes("entendre")
    || s.includes("bruit");
}

function thiefSkillSlug(skill) {
  return slug(`${skill?.key ?? ""} ${skill?.label ?? ""} ${skill?.shortLabel ?? ""}`);
}

function thiefSkillIcon(skill) {
  const s = thiefSkillSlug(skill);

  if (s.includes("pickpocket") || s.includes("poche")) return "fa-hand-holding";
  if (s.includes("crochetage") || s.includes("serrure")) return "fa-key";
  if (s.includes("piege") || s.includes("desamorc")) return "fa-triangle-exclamation";
  if (s.includes("silence")) return "fa-shoe-prints";
  if (s.includes("dissimulation") || s.includes("cacher")) return "fa-user-secret";
  if (isListenLike(s)) return "fa-ear-listen";
  if (s.includes("escalade") || s.includes("grimper")) return "fa-mountain";
  if (s.includes("langue")) return "fa-language";

  return "fa-dice-d20";
}

function thiefSkillTone(skill) {
  const s = thiefSkillSlug(skill);

  if (s.includes("crochetage") || s.includes("serrure")) return "lock";
  if (s.includes("piege") || s.includes("desamorc")) return "trap";
  if (s.includes("silence")) return "move";
  if (s.includes("dissimulation") || s.includes("cacher")) return "hide";
  if (isListenLike(s)) return "listen";
  if (s.includes("escalade") || s.includes("grimper")) return "climb";
  if (s.includes("langue")) return "language";
  if (s.includes("pickpocket") || s.includes("poche")) return "pocket";

  return "default";
}

function isThiefSkillFeature(feature) {
  const name = slug(featureName(feature));
  const key = slug(feature?.skillKey ?? feature?.key ?? feature?.slug ?? "");
  const joined = `${name} ${key}`;

  return [
    "faculte_de_voleur",
    "facultes_de_voleur",
    "competence_de_voleur",
    "competences_de_voleur",
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
    "auditiv",
    "ouie",
    "entendre",
    "bruit",
    "escalade",
    "grimper",
    "lecture_langues",
    "lecture_des_langues",
    "frappe_dans_le_dos",
    "attaque_dans_le_dos",
    "backstab",
    "attaque_sournoise",
    "assassination"
  ].some(token => joined.includes(token));
}

function visibleFeatures(actor) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  const thiefSkills = getThiefSkills(actor);
  const usesThiefSkillTiles = thiefSkills.length > 0 || isThiefSkillClass(actor);
  const hasListenTile = thiefSkills.some(s => isListenLike(`${s?.key ?? ""} ${s?.label ?? ""} ${s?.shortLabel ?? ""}`));
  const seen = new Set();

  return allClassFeatures(actor)
    .map((feature, index) => ({ feature, index }))
    .filter(({ feature }) => level >= featureMinLevel(feature) && level <= featureMaxLevel(feature))
    .filter(({ feature }) => !(usesThiefSkillTiles && isThiefSkillFeature(feature)))
    .filter(({ feature }) => !(hasListenTile && isListenLike(`${featureName(feature)} ${feature?.key ?? ""} ${feature?.skillKey ?? ""} ${feature?.slug ?? ""}`)))
    .filter(({ feature }) => {
      const key = `${slug(featureName(feature))}|${featureMinLevel(feature)}|${isFeatureActivable(feature) ? "A" : "P"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildThiefSkillsPanel(actor) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  const skills = getThiefSkills(actor)
    .filter(skill => !isBackstabLike(`${skill?.key ?? ""} ${skill?.label ?? ""} ${skill?.shortLabel ?? ""}`))
    .filter(skill => level >= readLevel(skill?.minLevel ?? skill?.niveauMin ?? skill?.requiredLevel ?? skill?.level ?? skill?.niveau, 1));

  if (!skills.length) return "";

  const cards = skills.map(skill => {
    const bonus = Number(skill.bonusTotal ?? 0) || 0;
    const bonusHtml = bonus === 0
      ? `<span class="a2e-thief-skill-bonus neutral">+0%</span>`
      : `<span class="a2e-thief-skill-bonus ${bonus > 0 ? "positive" : "negative"}">${bonus > 0 ? "+" : ""}${bonus}%</span>`;
    const iconClass = thiefSkillIcon(skill);
    const tone = thiefSkillTone(skill);
    const action = skill.canRoll === false
      ? `<span class="a2e-muted">—</span>`
      : `<button type="button" class="add2e-thief-skill-roll" data-skill-key="${escapeHtml(skill.key)}" data-skill-tone="${escapeHtml(tone)}" title="Tester ${escapeHtml(skill.label ?? skill.shortLabel ?? skill.key)}" aria-label="Tester ${escapeHtml(skill.label ?? skill.shortLabel ?? skill.key)}"><i class="fas ${iconClass}"></i></button>`;

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
      <h2>${escapeHtml(thiefSkillPanelTitle(actor))}</h2>
      <div class="a2e-panel-body"><div class="a2e-thief-skills-inline" style="grid-template-columns:repeat(${skills.length}, minmax(0, 1fr));">${cards}</div></div>
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

  const wrapper = document.createElement("div");
  wrapper.className = "add2e-capacites-modern-root";
  wrapper.innerHTML = `${buildThiefSkillsPanel(actor)}${buildClassFeaturesPanel(actor)}`;

  tab.replaceChildren(wrapper);

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
}

expose("add2eUiFeatureName", featureName);
expose("add2eUiAllClassFeatures", allClassFeatures);
expose("add2eUiGetThiefSkills", getThiefSkills);
expose("add2eUiBuildThiefSkillsPanel", buildThiefSkillsPanel);
expose("add2eUiInjectCapacitesTab", injectCapacitesTab);
