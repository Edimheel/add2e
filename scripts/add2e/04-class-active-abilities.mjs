// ============================================================
// ADD2E — Capacités activables de classe : exécution on_use
// Format accepté pour les objets classe :
// - system.activeClassFeatures : boutons / capacités utilisables
// - system.classFeatures       : capacités passives ou mixtes
// - system.passiveClassFeatures: capacités passives
// - anciens alias conservés : capacitesClasse, classFeaturesDebloquees
// ============================================================

const ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = "2026-05-19-thief-skills-table-v3";
globalThis.ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = ADD2E_CLASS_ACTIVE_ABILITIES_VERSION;
console.log("[ADD2E][CAPACITES][VERSION]", ADD2E_CLASS_ACTIVE_ABILITIES_VERSION);

function add2eToClassFeatureArray(value) {
  if (Array.isArray(value)) return value.filter(v => v && typeof v === "object");
  if (value && typeof value === "object") return Object.values(value).filter(v => v && typeof v === "object");
  return [];
}

function add2eFeatureMinLevel(feature) {
  return Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1) || 1;
}

function add2eFeatureMaxLevel(feature) {
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  if (raw === undefined || raw === null || raw === "") return 999;
  return Number(raw) || 999;
}

function add2eFeatureName(feature) {
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "").trim();
}

function add2eFeatureOnUse(feature) {
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function add2eFeatureKey(feature) {
  const raw =
    feature?.id ??
    feature?._id ??
    feature?.key ??
    feature?.slug ??
    feature?.skillKey ??
    feature?.name ??
    feature?.label ??
    feature?.title ??
    feature?.nom ??
    "";

  if (typeof add2eNormalizeEquipTag === "function") return add2eNormalizeEquipTag(raw);

  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_");
}

function add2ePushClassFeatures(out, value, source = "unknown") {
  for (const feature of add2eToClassFeatureArray(value)) {
    out.push({
      ...feature,
      _add2eFeatureSource: feature?._add2eFeatureSource ?? source
    });
  }
}

function add2eGetActorClassSystems(actor) {
  const sys = actor?.system ?? {};
  const details = sys.details_classe && typeof sys.details_classe === "object" ? sys.details_classe : null;
  const classItem = actor?.items?.find?.(i => String(i?.type || "").toLowerCase() === "classe") ?? null;
  const itemSystem = classItem?.system ?? null;

  return [details, itemSystem, sys].filter(s => s && typeof s === "object");
}

function add2eGetActorClassFeatures(actor) {
  const features = [];
  const seen = new Set();

  for (const system of add2eGetActorClassSystems(actor)) {
    // Nouveau format : boutons utilisables séparés.
    add2ePushClassFeatures(features, system.activeClassFeatures, "activeClassFeatures");
    add2ePushClassFeatures(features, system.activableClassFeatures, "activableClassFeatures");
    add2ePushClassFeatures(features, system.classFeaturesActives, "classFeaturesActives");
    add2ePushClassFeatures(features, system.capacitesActives, "capacitesActives");
    add2ePushClassFeatures(features, system.capacitesActivables, "capacitesActivables");

    // Format commun / ancien : peut contenir du passif et de l'activable.
    add2ePushClassFeatures(features, system.classFeatures, "classFeatures");
    add2ePushClassFeatures(features, system.classFeaturesDebloquees, "classFeaturesDebloquees");
    add2ePushClassFeatures(features, system.capacitesClasse, "capacitesClasse");

    // Passifs séparés : utiles pour l'affichage/diagnostic, filtrés ensuite si on ne veut que les activables.
    add2ePushClassFeatures(features, system.passiveClassFeatures, "passiveClassFeatures");
    add2ePushClassFeatures(features, system.passiveFeatures, "passiveFeatures");
    add2ePushClassFeatures(features, system.capacitesPassives, "capacitesPassives");
  }

  return features.filter(feature => {
    const key = add2eFeatureKey(feature);
    const onUse = add2eFeatureOnUse(feature);
    const source = String(feature?._add2eFeatureSource ?? "");
    const unique = `${key}|${onUse}|${source}`;
    if (!key && !onUse) return false;
    if (seen.has(unique)) return false;
    seen.add(unique);
    return true;
  });
}

function add2eIsFeatureActivable(feature) {
  if (!feature || typeof feature !== "object") return false;
  if (feature.activable === true) return true;
  if (feature.active === true && feature.passive !== true) return true;
  if (feature.usageType === "classFeature" && add2eFeatureOnUse(feature)) return true;
  if (String(feature?._add2eFeatureSource ?? "") === "activeClassFeatures") return true;
  return false;
}

function add2eGetActorActivableClassFeatures(actor, { includeLocked = true } = {}) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  return add2eGetActorClassFeatures(actor).filter(f => {
    if (!add2eIsFeatureActivable(f)) return false;
    if (includeLocked) return true;
    return level >= add2eFeatureMinLevel(f) && level <= add2eFeatureMaxLevel(f);
  });
}

function add2eGetActorPassiveClassFeatures(actor, { includeLocked = true } = {}) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  return add2eGetActorClassFeatures(actor).filter(f => {
    if (add2eIsFeatureActivable(f)) return false;
    if (includeLocked) return true;
    return level >= add2eFeatureMinLevel(f) && level <= add2eFeatureMaxLevel(f);
  });
}

function add2eDatasetValue(dataset, keys) {
  if (!dataset) return undefined;
  for (const k of keys) {
    if (dataset[k] !== undefined && dataset[k] !== null && String(dataset[k]).trim() !== "") return dataset[k];
  }
  return undefined;
}

function add2eFindClassFeatureFromElement(actor, element) {
  const allFeatures = add2eGetActorClassFeatures(actor);
  const activeFeatures = add2eGetActorActivableClassFeatures(actor);
  const el = element instanceof HTMLElement ? element : element?.[0];
  if (!el) return null;

  const holder = el.closest?.("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use], [data-skill-key]") ?? el;
  const ds = holder?.dataset ?? el?.dataset ?? {};

  const rawIndex = add2eDatasetValue(ds, ["featureIndex", "index", "idx"]);
  if (rawIndex !== undefined) {
    const idx = Number(rawIndex);
    if (Number.isInteger(idx)) {
      const byOriginalIndex = allFeatures[idx];
      if (add2eIsFeatureActivable(byOriginalIndex)) return byOriginalIndex;
      const byActiveIndex = activeFeatures[idx];
      if (byActiveIndex) return byActiveIndex;
    }
  }

  const rawOnUse = add2eDatasetValue(ds, ["onUse", "onuse", "on_use"]);
  if (rawOnUse !== undefined) {
    const wanted = String(rawOnUse).trim();
    const byScript = activeFeatures.find(f => add2eFeatureOnUse(f) === wanted);
    if (byScript) return byScript;
  }

  const rawSkillKey = add2eDatasetValue(ds, ["skillKey", "skill", "competence", "competenceKey"]);
  if (rawSkillKey !== undefined) {
    const wanted = typeof add2eNormalizeThiefSkillKey === "function"
      ? add2eNormalizeThiefSkillKey(rawSkillKey)
      : add2eFeatureKey({ skillKey: rawSkillKey });
    const bySkill = activeFeatures.find(f => {
      const skill = typeof add2eNormalizeThiefSkillKey === "function"
        ? add2eNormalizeThiefSkillKey(f.skillKey ?? f.key ?? f.slug ?? f.name)
        : add2eFeatureKey({ skillKey: f.skillKey ?? f.key ?? f.slug ?? f.name });
      return skill === wanted;
    });
    if (bySkill) return bySkill;
  }

  const rawId = add2eDatasetValue(ds, ["featureId", "featureKey", "id", "key"]);
  if (rawId !== undefined) {
    const wanted = add2eFeatureKey({ id: rawId });
    const byId = activeFeatures.find(f => {
      const values = [f.id, f._id, f.key, f.slug, f.skillKey, f.name, f.label, f.title, f.nom]
        .map(v => add2eFeatureKey({ id: v }))
        .filter(Boolean);
      return values.includes(wanted);
    });
    if (byId) return byId;
  }

  const rawName = add2eDatasetValue(ds, ["featureName", "name", "feature", "nom"]);
  if (rawName !== undefined) {
    const wanted = add2eFeatureKey({ name: rawName });
    const byName = activeFeatures.find(f => add2eFeatureKey({ name: add2eFeatureName(f) }) === wanted);
    if (byName) return byName;
  }

  let cursor = el;
  for (let depth = 0; cursor && depth < 8; depth++, cursor = cursor.parentElement) {
    const text = add2eFeatureKey({ name: cursor.textContent ?? "" });
    if (!text || text === "utiliser") continue;

    const matches = activeFeatures.filter(f => {
      const n = add2eFeatureKey({ name: add2eFeatureName(f) });
      return n && text.includes(n);
    });

    if (matches.length === 1) return matches[0];
  }

  if (activeFeatures.length === 1) return activeFeatures[0];
  return null;
}

async function add2eExecuteClassFeatureOnUse(actor, feature, sheet = null) {
  if (!actor) {
    ui.notifications.error("Capacité de classe : acteur introuvable.");
    return false;
  }

  if (!feature) {
    ui.notifications.error("Capacité de classe introuvable dans les données de l'acteur.");
    return false;
  }

  const level = Number(actor.system?.niveau ?? 1) || 1;
  const min = add2eFeatureMinLevel(feature);
  const max = add2eFeatureMaxLevel(feature);
  const name = add2eFeatureName(feature) || "Capacité";

  if (level < min || level > max) {
    ui.notifications.warn(`La capacité « ${name} » n'est pas disponible au niveau ${level}.`);
    return false;
  }

  const onUse = add2eFeatureOnUse(feature);
  if (!onUse) {
    ui.notifications.warn(`La capacité « ${name} » n'a pas de script on_use.`);
    return false;
  }

  try {
    const url = onUse.includes("?") ? `${onUse}&cb=${Date.now()}` : `${onUse}?cb=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const code = await response.text();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const runner = new AsyncFunction(
      "actor",
      "feature",
      "item",
      "sort",
      "game",
      "ui",
      "ChatMessage",
      "Roll",
      "foundry",
      "canvas",
      code
    );

    const result = await runner(actor, feature, feature, null, game, ui, ChatMessage, Roll, foundry, canvas);

    console.log("[ADD2E][CAPACITE][ON_USE]", {
      actor: actor.name,
      feature: name,
      source: feature._add2eFeatureSource ?? null,
      skillKey: feature.skillKey ?? null,
      onUse,
      result
    });

    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    return result !== false;
  } catch (err) {
    console.error("[ADD2E][CAPACITE][ON_USE][ERREUR]", { actor: actor.name, feature: name, onUse, err });
    ui.notifications.error(`Erreur pendant l'utilisation de « ${name} » : ${err.message}`);
    return false;
  }
}

async function add2eUseClassFeatureFromElement(actor, element, sheet = null) {
  const feature = add2eFindClassFeatureFromElement(actor, element);
  return add2eExecuteClassFeatureOnUse(actor, feature, sheet);
}

// ============================================================
// Tableau dédié des compétences de voleur dans l'onglet Capacités
// Source : progression[n].thiefSkills, ou ancien progression[n].skills.
// ============================================================

const ADD2E_THIEF_SKILL_ROWS = [
  ["pickpocket", "Pickpocket"],
  ["crochetage_serrures", "Crochetage / ouverture des serrures"],
  ["detection_pieges", "Détection / désamorçage des pièges"],
  ["deplacement_silencieux", "Déplacement silencieux"],
  ["dissimulation", "Dissimulation"],
  ["ecoute", "Écoute"],
  ["escalade", "Escalade"],
  ["lecture_langues", "Lecture des langues"]
];

const ADD2E_THIEF_SKILL_ALIASES = {
  pick_pockets: "pickpocket",
  pick_pocket: "pickpocket",
  pickpockets: "pickpocket",
  pickpocket: "pickpocket",
  open_locks: "crochetage_serrures",
  open_lock: "crochetage_serrures",
  crochetage: "crochetage_serrures",
  crochetage_serrures: "crochetage_serrures",
  ouverture_serrures: "crochetage_serrures",
  ouverture_de_serrures: "crochetage_serrures",
  find_remove_traps: "detection_pieges",
  find_traps: "detection_pieges",
  remove_traps: "detection_pieges",
  detect_traps: "detection_pieges",
  detection_pieges: "detection_pieges",
  detection_de_pieges: "detection_pieges",
  desamorcage_pieges: "detection_pieges",
  move_silently: "deplacement_silencieux",
  deplacement_silencieux: "deplacement_silencieux",
  hide_in_shadows: "dissimulation",
  dissimulation: "dissimulation",
  dissimulation_dans_l_ombre: "dissimulation",
  dissimulation_dans_lombre: "dissimulation",
  hear_noise: "ecoute",
  hear_noises: "ecoute",
  listen: "ecoute",
  detect_noise: "ecoute",
  ecoute: "ecoute",
  climb_walls: "escalade",
  climb_wall: "escalade",
  escalade: "escalade",
  read_languages: "lecture_langues",
  read_language: "lecture_langues",
  lecture_langues: "lecture_langues",
  lecture_des_langues: "lecture_langues"
};

function add2eNormalizeThiefSkillKeyLocal(value) {
  if (typeof globalThis.add2eNormalizeThiefSkillKey === "function") return globalThis.add2eNormalizeThiefSkillKey(value);
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_");
  return ADD2E_THIEF_SKILL_ALIASES[raw] ?? raw;
}

function add2eGetActorClassProgression(actor) {
  const level = Math.max(1, Number(actor?.system?.niveau ?? 1) || 1);
  for (const system of add2eGetActorClassSystems(actor)) {
    const progression = system?.progression;
    if (!Array.isArray(progression)) continue;
    const byLevel = progression.find(p => Number(p?.level ?? p?.niveau ?? 0) === level);
    if (byLevel) return byLevel;
    if (progression[level - 1]) return progression[level - 1];
  }
  return null;
}

function add2eGetActorThiefSkillTable(actor) {
  const progression = add2eGetActorClassProgression(actor);
  const raw = progression?.thiefSkills ?? progression?.voleurSkills ?? progression?.competencesVoleur ?? null;
  const output = {};

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const normalized = add2eNormalizeThiefSkillKeyLocal(key);
      output[normalized] = Number(value ?? 0) || 0;
    }
  }

  if (!Object.keys(output).length && Array.isArray(progression?.skills)) {
    const keys = ADD2E_THIEF_SKILL_ROWS.map(([key]) => key);
    for (let i = 0; i < keys.length; i++) output[keys[i]] = Number(progression.skills[i] ?? 0) || 0;
  }

  if (!Object.keys(output).length) return [];

  return ADD2E_THIEF_SKILL_ROWS.map(([key, label]) => ({
    key,
    label,
    value: Number(output[key] ?? 0) || 0
  }));
}

function add2eRenderThiefSkillsTable(actor) {
  const rows = add2eGetActorThiefSkillTable(actor);
  if (!rows.length) return "";

  const body = rows.map(row => `
    <tr>
      <td><b>${row.label}</b></td>
      <td style="text-align:center;font-weight:900;">${row.value}%</td>
      <td style="text-align:center;">
        <button type="button" class="a2e-btn blue add2e-thief-skill-roll" data-skill-key="${row.key}" title="Tester ${row.label}">
          <i class="fas fa-dice-d100"></i>&nbsp;Jet
        </button>
      </td>
    </tr>
  `).join("");

  return `
    <div class="a2e-panel a2e-thief-skills-panel">
      <h2>Compétences de voleur</h2>
      <div class="a2e-panel-body">
        <table class="a2e-table">
          <thead>
            <tr>
              <th>Compétence</th>
              <th style="width:90px;text-align:center;">%</th>
              <th style="width:100px;text-align:center;">Jet</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

function add2eInjectThiefSkillsTable(sheet, html) {
  const actor = sheet?.actor;
  if (!actor || actor.type !== "personnage") return;

  const root = html?.jquery ? html[0] : (html instanceof HTMLElement ? html : html?.[0]);
  if (!root?.querySelector) return;

  const tab = root.querySelector('.tab-capacites[data-tab="capacites"]');
  if (!tab) return;

  const existing = tab.querySelector(".a2e-thief-skills-panel");
  if (existing) existing.remove();

  const markup = add2eRenderThiefSkillsTable(actor);
  if (!markup) return;

  tab.insertAdjacentHTML("afterbegin", markup);
  console.log("[ADD2E][VOLEUR][TABLE] Tableau compétences injecté", {
    actor: actor.name,
    skills: add2eGetActorThiefSkillTable(actor)
  });
}

function add2eInstallThiefSkillsTableHooks() {
  if (globalThis.ADD2E_THIEF_SKILLS_TABLE_HOOKS_INSTALLED) return;
  globalThis.ADD2E_THIEF_SKILLS_TABLE_HOOKS_INSTALLED = true;

  const inject = (app, html) => {
    try { add2eInjectThiefSkillsTable(app, html); }
    catch (e) { console.warn("[ADD2E][VOLEUR][TABLE] Erreur injection tableau", e); }
  };

  Hooks.on("renderAdd2eActorSheet", inject);
  Hooks.on("renderActorSheet", inject);

  document.addEventListener("click", async event => {
    const button = event.target.closest?.(".add2e-thief-skill-roll[data-skill-key]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const sheetRoot = button.closest(".add2e-character-v3");
    const appEl = sheetRoot?.closest?.(".application, .app, .window-app");
    const appId = appEl?.dataset?.appid || appEl?.id?.replace(/^app-/, "");
    const app = Object.values(ui.windows ?? {}).find(w => String(w.appId) === String(appId) || String(w.id) === String(appId));
    const actor = app?.actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
    const skillKey = add2eNormalizeThiefSkillKeyLocal(button.dataset.skillKey);

    if (!actor) {
      ui.notifications.error("Acteur introuvable pour le jet de compétence de voleur.");
      return;
    }

    if (typeof globalThis.add2eRollThiefSkill !== "function") {
      ui.notifications.error("Le moteur de jet des compétences de voleur n'est pas chargé.");
      console.error("[ADD2E][VOLEUR][TABLE][ERROR] add2eRollThiefSkill introuvable", { actor: actor.name, skillKey });
      return;
    }

    await globalThis.add2eRollThiefSkill(actor, skillKey);
  }, true);
}

if (game?.ready) add2eInstallThiefSkillsTableHooks();
else Hooks.once("ready", add2eInstallThiefSkillsTableHooks);

globalThis.add2eGetActorClassFeatures = add2eGetActorClassFeatures;
globalThis.add2eGetActorActivableClassFeatures = add2eGetActorActivableClassFeatures;
globalThis.add2eGetActorPassiveClassFeatures = add2eGetActorPassiveClassFeatures;
globalThis.add2eUseClassFeatureFromElement = add2eUseClassFeatureFromElement;
globalThis.add2eExecuteClassFeatureOnUse = add2eExecuteClassFeatureOnUse;

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eToClassFeatureArray = add2eToClassFeatureArray; } catch (_e) {}
try { globalThis.add2eFeatureMinLevel = add2eFeatureMinLevel; } catch (_e) {}
try { globalThis.add2eFeatureMaxLevel = add2eFeatureMaxLevel; } catch (_e) {}
try { globalThis.add2eFeatureName = add2eFeatureName; } catch (_e) {}
try { globalThis.add2eFeatureOnUse = add2eFeatureOnUse; } catch (_e) {}
try { globalThis.add2eFeatureKey = add2eFeatureKey; } catch (_e) {}
try { globalThis.add2eIsFeatureActivable = add2eIsFeatureActivable; } catch (_e) {}
try { globalThis.add2eGetActorClassSystems = add2eGetActorClassSystems; } catch (_e) {}
try { globalThis.add2eGetActorClassFeatures = add2eGetActorClassFeatures; } catch (_e) {}
try { globalThis.add2eGetActorActivableClassFeatures = add2eGetActorActivableClassFeatures; } catch (_e) {}
try { globalThis.add2eGetActorPassiveClassFeatures = add2eGetActorPassiveClassFeatures; } catch (_e) {}
try { globalThis.add2eDatasetValue = add2eDatasetValue; } catch (_e) {}
try { globalThis.add2eFindClassFeatureFromElement = add2eFindClassFeatureFromElement; } catch (_e) {}
try { globalThis.add2eExecuteClassFeatureOnUse = add2eExecuteClassFeatureOnUse; } catch (_e) {}
try { globalThis.add2eUseClassFeatureFromElement = add2eUseClassFeatureFromElement; } catch (_e) {}
try { globalThis.add2eGetActorClassProgression = add2eGetActorClassProgression; } catch (_e) {}
try { globalThis.add2eGetActorThiefSkillTable = add2eGetActorThiefSkillTable; } catch (_e) {}
try { globalThis.add2eRenderThiefSkillsTable = add2eRenderThiefSkillsTable; } catch (_e) {}
try { globalThis.ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = ADD2E_CLASS_ACTIVE_ABILITIES_VERSION; } catch (_e) {}
