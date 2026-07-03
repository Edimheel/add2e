// ============================================================
// ADD2E — 08 Character Sheet UI — 02 capacités
// Version : 2026-07-03-racial-capacities-merged-v2
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

function normalizeThiefSkillRow(row) {
  const value = Number(row?.finalValue ?? row?.value ?? row?.base ?? 0) || 0;
  const label = String(row?.label ?? row?.shortLabel ?? row?.key ?? "Compétence");
  const key = String(row?.key ?? label);
  return {
    ...row,
    key,
    label,
    shortLabel: row?.shortLabel ?? label,
    base: Number(row?.base ?? value) || 0,
    value,
    finalValue: value,
    bonusTotal: Number(row?.bonusTotal ?? 0) || 0,
    display: row?.display ?? `${value}%`,
    baseDisplay: row?.baseDisplay ?? `${Number(row?.base ?? value) || 0}%`,
    canRoll: row?.canRoll !== false
  };
}

function getThiefSkills(actor) {
  const legacyFn = globalFn("add2eGetActorThiefSkills");
  if (legacyFn) {
    try {
      const rows = legacyFn(actor) ?? [];
      if (Array.isArray(rows) && rows.length) return rows.map(normalizeThiefSkillRow);
    } catch (e) {
      console.warn("[ADD2E][CAPACITES][VOLEUR] Impossible de lire add2eGetActorThiefSkills", e);
    }
  }

  const multiclassFn = globalFn("add2eGetActorThiefSkillTable");
  if (multiclassFn) {
    try {
      const rows = multiclassFn(actor) ?? [];
      if (Array.isArray(rows) && rows.length) return rows.map(normalizeThiefSkillRow);
    } catch (e) {
      console.warn("[ADD2E][CAPACITES][VOLEUR] Impossible de lire add2eGetActorThiefSkillTable", e);
    }
  }

  return [];
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

function actorClassSlugs(actor) {
  const values = [];
  const sys = actor?.system ?? {};
  values.push(sys.classe, sys.class, sys.details_classe?.label, sys.details_classe?.name, sys.details_classe?.nom, sys.details_classe?.slug);
  for (const item of actor?.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "classe") continue;
    values.push(item.name, item.system?.label, item.system?.name, item.system?.nom, item.system?.classe, item.system?.slug);
  }
  return values.map(value => slug(value)).filter(Boolean);
}

function isThiefSkillClass(actor) {
  const slugs = actorClassSlugs(actor);
  const s = classSlug(actor);
  return s.includes("voleur") || s.includes("assassin") || s.includes("moine") || slugs.some(x => x.includes("voleur") || x.includes("assassin") || x.includes("moine"));
}

function thiefSkillPanelTitle(actor) {
  const s = classSlug(actor);
  if (s.includes("moine")) return "Compétences spéciales du moine";
  if (s.includes("assassin")) return "Compétences de voleur / assassin";
  if (s.includes("voleur")) return "Compétences de voleur";
  if (actorClassSlugs(actor).some(x => x.includes("voleur"))) return "Compétences de voleur";
  return "Compétences de voleur";
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
  const fn = globalFn("add2eIsThiefSkillFeature");
  if (fn) {
    try { return fn(feature) === true; }
    catch (_e) {}
  }

  const name = slug(featureName(feature));
  const key = slug(feature?.skillKey ?? feature?.key ?? feature?.slug ?? "");
  const joined = `${name} ${key}`;
  return [
    "faculte_de_voleur", "facultes_de_voleur", "competence_de_voleur", "competences_de_voleur",
    "pickpocket", "faire_les_poches", "crochetage", "serrure", "piege", "desamorc",
    "deplacement_silencieux", "silence", "dissimulation", "cacher", "ecoute", "auditiv",
    "ouie", "entendre", "bruit", "escalade", "grimper", "lecture_langues",
    "lecture_des_langues", "frappe_dans_le_dos", "attaque_dans_le_dos", "backstab",
    "attaque_sournoise", "assassination", "assassinat"
  ].some(token => joined.includes(token));
}

function thiefArmorRestriction(actor) {
  const fn = globalFn("add2eGetThiefActivityEquipmentStatus");
  if (fn) {
    try {
      const status = fn(actor);
      if (status && typeof status === "object") return status;
    } catch (e) {
      console.warn("[ADD2E][CAPACITES][VOLEUR][EQUIPEMENT] Contrôle central indisponible", e);
    }
  }
  return { applies: false, ok: true, blockingItems: [], message: "" };
}

function buildThiefArmorWarningPanel(actor, status) {
  const blockingItems = Array.isArray(status?.blockingItems) ? status.blockingItems : [];
  const names = blockingItems.map(item => String(item?.name ?? "").trim()).filter(Boolean);
  const equipmentLabel = names.length
    ? `Équipement actuellement incompatible : <strong>${escapeHtml(names.join(", "))}</strong>.`
    : "Un équipement actuellement porté est incompatible avec les activités de voleur.";
  const message = String(status?.message ?? "").trim() || "Les capacités de voleur ne peuvent pas être utilisées avec l'équipement actuellement porté.";

  return `
    <div class="a2e-panel add2e-thief-skills-panel">
      <h2>${escapeHtml(thiefSkillPanelTitle(actor))}</h2>
      <div class="a2e-panel-body a2e-thief-armor-warning" style="border:2px solid #8b0000;background:rgba(255,70,70,.82);color:#111;border-radius:12px;padding:18px;text-align:center;font-size:1.25em;font-weight:900;line-height:1.35;">
        <div style="font-size:1.45em;color:#111;margin-bottom:8px;"><i class="fas fa-triangle-exclamation"></i> Capacités de voleur indisponibles</div>
        <div>${escapeHtml(message)}</div>
        <div style="font-size:.85em;margin-top:8px;color:#111;">${equipmentLabel}</div>
      </div>
    </div>`;
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
  const activityStatus = thiefArmorRestriction(actor);
  if (activityStatus.applies && !activityStatus.ok) return buildThiefArmorWarningPanel(actor, activityStatus);

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

  return `<div class="a2e-panel add2e-thief-skills-panel"><h2>${escapeHtml(thiefSkillPanelTitle(actor))}</h2><div class="a2e-panel-body"><div class="a2e-thief-skills-inline" style="grid-template-columns:repeat(${skills.length}, minmax(0, 1fr));">${cards}</div></div></div>`;
}

function racialEngine() {
  const engine = globalThis.Add2eEffectsEngine;
  return typeof engine?.getRacialActions === "function" ? engine : null;
}

function racialActions(actor) {
  return racialEngine()?.getRacialActions?.(actor)?.filter(entry => entry?.activable !== false) ?? [];
}

function racialPassives(actor) {
  const passives = racialEngine()?.getRacialPassiveEffects?.(actor) ?? [];
  return passives.filter(effect => {
    const key = slug(`${effect?.id ?? ""} ${effect?.name ?? ""}`);
    return !key.includes("infravision");
  });
}

function racialActionIcon(entry) {
  return String(entry?.iconClass ?? "").trim() || (entry?.actionType === "vision-toggle" ? "fa-eye" : "fa-dice-d20");
}

function racialActionLabel(entry) {
  if (entry?.actionType === "vision-toggle") return String(entry?.label ?? "Infravision");
  const roll = String(entry?.rollLabel ?? "").trim();
  return roll ? `${String(entry?.label ?? "Capacité raciale")} — Jet ${roll}` : String(entry?.label ?? "Capacité raciale");
}

function buildFeatureCard(actor, feature, index, mode) {
  const name = featureName(feature);
  const desc = String(feature?.description ?? feature?.desc ?? feature?.text ?? "").trim();
  const onUse = featureOnUse(feature);
  const skillKey = feature?.skillKey ?? feature?.key ?? feature?.slug ?? "";
  const action = mode === "active"
    ? `<button type="button" class="add2e-feature-use add2e-feature-icon-only" data-feature-index="${index}" data-feature-name="${escapeHtml(name)}" data-skill-key="${escapeHtml(skillKey)}" data-on-use="${escapeHtml(onUse)}" title="Utiliser ${escapeHtml(name)}" aria-label="Utiliser ${escapeHtml(name)}"><i class="fas fa-bolt"></i></button>`
    : "";
  return `
    <div class="a2e-feature-card ${mode === "active" ? "is-activable" : "is-passive"}">
      <div class="a2e-feature-card-title"><strong>${escapeHtml(name)}</strong>${action}</div>
      ${mode === "passive" && desc ? `<div class="a2e-feature-card-desc">${escapeHtml(desc)}</div>` : ""}
    </div>`;
}

function buildRacialActionCard(entry) {
  const isVisionToggle = entry?.actionType === "vision-toggle";
  const enabled = entry?.enabled === true;
  const icon = isVisionToggle && enabled ? "fa-eye" : (isVisionToggle ? "fa-eye-slash" : racialActionIcon(entry));
  const stateClass = isVisionToggle ? (enabled ? "is-enabled" : "is-disabled") : "is-roll";
  const label = racialActionLabel(entry);
  const title = isVisionToggle
    ? `${enabled ? "Désactiver" : "Activer"} ${entry.label}`
    : `Utiliser ${entry.label}`;
  return `
    <div class="a2e-feature-card add2e-racial-feature-card is-activable">
      <div class="a2e-feature-card-title">
        <strong>${escapeHtml(label)}</strong>
        <button type="button" class="add2e-racial-capability-use add2e-feature-icon-only ${stateClass}" data-racial-capability-id="${escapeHtml(entry.id)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><i class="fas ${icon}"></i></button>
      </div>
    </div>`;
}

function buildRacialPassiveCard(effect) {
  return `
    <div class="a2e-feature-card add2e-racial-feature-card is-passive">
      <div class="a2e-feature-card-title"><strong>${escapeHtml(effect?.name ?? "Avantage racial")}</strong></div>
      ${effect?.description ? `<div class="a2e-feature-card-desc">${escapeHtml(effect.description)}</div>` : ""}
    </div>`;
}

function buildFeaturesPanel(actor) {
  const features = visibleFeatures(actor);
  const classActive = features.filter(({ feature }) => isFeatureActivable(feature));
  const classPassive = features.filter(({ feature }) => !isFeatureActivable(feature));
  const active = [
    ...classActive.map(entry => buildFeatureCard(actor, entry.feature, entry.index, "active")),
    ...racialActions(actor).map(buildRacialActionCard)
  ];
  const passive = [
    ...classPassive.map(entry => buildFeatureCard(actor, entry.feature, entry.index, "passive")),
    ...racialPassives(actor).map(buildRacialPassiveCard)
  ];

  const activeHtml = active.length ? active.join("") : `<p class="a2e-muted">Aucune capacité activable disponible à ce niveau.</p>`;
  const passiveHtml = passive.length ? passive.join("") : `<p class="a2e-muted">Aucune capacité passive disponible à ce niveau.</p>`;
  return `
    <div class="a2e-grid-2 add2e-capacites-grid-modern">
      <div class="a2e-panel"><h2>Capacités activables</h2><div class="a2e-panel-body a2e-feature-card-list">${activeHtml}</div></div>
      <div class="a2e-panel"><h2>Capacités passives</h2><div class="a2e-panel-body a2e-feature-card-list">${passiveHtml}</div></div>
    </div>`;
}

function racialRequirements(entry) {
  const value = entry?.requires;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value instanceof Set) return [...value].map(String).filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).map(String).filter(Boolean);
  return value ? [String(value)] : [];
}

function racialRequirementLabel(value) {
  return {
    within_three_meters: "à 3 m ou moins",
    search_active: "recherche active",
    underground: "sous terre",
    concentration: "concentration",
    alone: "isolé",
    no_metal_armor: "sans armure de métal",
    opens_door: "après ouverture d’une porte",
    no_intense_light: "aucune source de lumière ou de chaleur intense"
  }[String(value ?? "").trim()] ?? String(value ?? "").replaceAll("_", " ");
}

function racialDialogRoot(button, dialog) {
  return button?.form?.querySelector?.(".add2e-racial-capability-form")
    ?? dialog?.element?.querySelector?.(".add2e-racial-capability-form")
    ?? document.querySelector?.(".add2e-racial-capability-form")
    ?? null;
}

async function promptRacialAction(entry) {
  const isVisionToggle = entry?.actionType === "vision-toggle";
  const enablingVision = isVisionToggle && entry?.enabled !== true;
  const requirements = (!isVisionToggle || enablingVision) ? racialRequirements(entry) : [];
  if (!requirements.length) return {};
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error?.("DialogV2 est indisponible.");
    return null;
  }
  const checks = requirements.map(key => {
    const name = String(key).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `<label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0;font-weight:700;"><input type="checkbox" name="${name}"><span>${escapeHtml(racialRequirementLabel(key))}</span></label>`;
  }).join("");
  const actionLabel = isVisionToggle ? "Confirmer" : "Lancer le jet";
  const title = isVisionToggle ? `${entry.enabled ? "Désactiver" : "Activer"} — ${entry.label}` : `Capacité raciale — ${entry.label}`;
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      return value;
    };
    const dialog = new DialogV2({
      window: { title },
      classes: ["add2e", "add2e-racial-capability-dialog"],
      position: { width: 460, height: "auto" },
      content: `<form class="add2e-racial-capability-form" style="display:grid;gap:8px;"><div style="font-weight:900;font-size:1.05em;">${escapeHtml(entry.label)}</div><div>${escapeHtml(entry.description)}</div><div style="border:1px solid rgba(90,65,15,.35);border-radius:8px;padding:8px;background:rgba(255,248,222,.55);"><div style="font-weight:800;margin-bottom:5px;">Conditions à confirmer</div>${checks}</div></form>`,
      buttons: [
        {
          action: "confirm",
          label: actionLabel,
          icon: isVisionToggle ? "fas fa-eye" : "fas fa-dice-d20",
          default: true,
          callback: (_event, button, dlg) => {
            const root = racialDialogRoot(button, dlg);
            const context = {};
            for (const key of requirements) context[key] = !!root?.querySelector?.(`[name="${String(key).replace(/[^a-zA-Z0-9_-]/g, "_")}"]`)?.checked;
            return finish(context);
          }
        },
        { action: "cancel", label: "Annuler", callback: () => finish(null) }
      ],
      default: "confirm"
    });
    dialog.addEventListener?.("close", () => finish(null), { once: true });
    Promise.resolve(dialog.render({ force: true })).catch(() => finish(null));
  });
}

async function postRacialResult(actor, result) {
  const capability = result.capability;
  const success = result.success === true;
  const color = success ? "#2f8f46" : "#b33a2e";
  const content = `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;padding:8px;"><div style="font-weight:900;color:${color};">${escapeHtml(capability.label)} — ${success ? "RÉUSSITE" : "ÉCHEC"}</div><div><b>${escapeHtml(actor.name)}</b> : ${escapeHtml(result.formula)} = <b>${escapeHtml(result.total)}</b> / réussite ≤ <b>${escapeHtml(result.successAt)}</b></div><div style="margin-top:4px;font-size:.88em;">${escapeHtml(capability.description)}</div></div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { add2e: { racialCapability: { actorId: actor.id, raceSourceId: capability.sourceId, capabilityId: capability.id, success } } }
  });
}

async function useRacialCapabilityFromElement(actor, element, sheet = null) {
  const engine = racialEngine();
  const capabilityId = String(element?.dataset?.racialCapabilityId ?? element?.dataset?.racialActionId ?? "").trim();
  if (!actor || !engine || !capabilityId) return false;
  if (!game.user?.isGM && !actor.isOwner && !actor.testUserPermission?.(game.user, "OWNER")) {
    ui.notifications?.warn?.("Vous ne pouvez pas utiliser les capacités de cet acteur.");
    return false;
  }
  const entry = engine.getRacialAction?.(actor, capabilityId);
  if (!entry) {
    ui.notifications?.warn?.("Capacité raciale introuvable.");
    return false;
  }
  const context = await promptRacialAction(entry);
  if (context === null) return false;

  if (entry.actionType === "vision-toggle") {
    const enabling = entry.enabled !== true;
    const result = await engine.setRacialVision?.(actor, enabling, { reason: "racial-capability-sheet" });
    if (!result || result.reason === "missing-actor") {
      ui.notifications?.error?.("Impossible de modifier l’infravision raciale.");
      return false;
    }
    ui.notifications?.info?.(`${entry.label} ${enabling ? "activée" : "désactivée"}.`);
    sheet?.render?.(false);
    await globalThis.add2eRefreshActionHud?.();
    return true;
  }

  const result = await engine.rollRacialCapability?.(actor, entry.id, context);
  if (!result?.ok) {
    if (result?.reason === "requirements-missing") ui.notifications?.warn?.(`Conditions manquantes : ${(result.missing ?? []).map(racialRequirementLabel).join(", ")}.`);
    else ui.notifications?.error?.("Le jet de capacité raciale n’a pas pu être résolu.");
    return false;
  }
  await postRacialResult(actor, result);
  return true;
}

export function injectCapacitesTab(sheet, sheetRoot) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;

  const tab = sheetRoot.querySelector('.sheet-body .a2e-tab-content[data-tab="capacites"], .sheet-body .tab[data-tab="capacites"]');
  if (!tab) return;

  const wrapper = document.createElement("div");
  wrapper.className = "add2e-capacites-modern-root";
  wrapper.innerHTML = `${buildThiefSkillsPanel(actor)}${buildFeaturesPanel(actor)}`;
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

  $(wrapper).find(".add2e-racial-capability-use")
    .off("click.add2e-racial-capability-use")
    .on("click.add2e-racial-capability-use", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      await useRacialCapabilityFromElement(actor, ev.currentTarget, sheet);
      return false;
    });
}

expose("add2eUiFeatureName", featureName);
expose("add2eUiAllClassFeatures", allClassFeatures);
expose("add2eUiGetThiefSkills", getThiefSkills);
expose("add2eUiBuildThiefSkillsPanel", buildThiefSkillsPanel);
expose("add2eUiCheckThiefArmorRestriction", thiefArmorRestriction);
expose("add2eUseRacialCapabilityFromElement", useRacialCapabilityFromElement);
expose("add2eUiInjectCapacitesTab", injectCapacitesTab);
