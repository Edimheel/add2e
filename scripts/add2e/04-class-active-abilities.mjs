const ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = "2026-08-04-canonical-thief-skill-aliases-v20";

const THIEF_ORDER = [
  "pickpocket",
  "crochetage_serrures",
  "detection_pieges",
  "deplacement_silencieux",
  "dissimulation",
  "ecoute",
  "escalade",
  "frappe_dans_le_dos"
];

const THIEF_LABELS = {
  pickpocket: "Pickpocket",
  crochetage_serrures: "Crochetage de serrures",
  detection_pieges: "Détection/désamorçage des pièges",
  deplacement_silencieux: "Déplacement silencieux",
  dissimulation: "Dissimulation dans l’ombre",
  ecoute: "Acuité auditive",
  escalade: "Escalade",
  frappe_dans_le_dos: "Attaque dans le dos",
  lecture_langues: "Lecture des langues"
};

const THIEF_ALIASES = {
  pick_pockets: "pickpocket",
  pick_pocket: "pickpocket",
  pickpockets: "pickpocket",
  open_locks: "crochetage_serrures",
  open_lock: "crochetage_serrures",
  crochetage: "crochetage_serrures",
  find_remove_traps: "detection_pieges",
  find_traps: "detection_pieges",
  remove_traps: "detection_pieges",
  detect_traps: "detection_pieges",
  detection_de_pieges: "detection_pieges",
  desamorcage_pieges: "detection_pieges",
  move_silently: "deplacement_silencieux",
  hide_in_shadows: "dissimulation",
  dissimulation_dans_l_ombre: "dissimulation",
  hear_noise: "ecoute",
  hear_noises: "ecoute",
  detect_noise: "ecoute",
  listen: "ecoute",
  acuite_auditive: "ecoute",
  climb_walls: "escalade",
  climb_wall: "escalade",
  backstab: "frappe_dans_le_dos",
  attaque_dans_le_dos: "frappe_dans_le_dos",
  read_languages: "lecture_langues",
  read_language: "lecture_langues",
  lecture_des_langues: "lecture_langues"
};

const GENERIC_ACTIONS = new Map([
  ["monk-surprise-reduite", "probability_check"],
  ["monk-chute-ralentie", "fall_protection_check"],
  ["monk-catalepsie", "timed_state"]
]);

globalThis.__ADD2E_CAPABILITIES_HUD_MIRROR_V1 = true;
globalThis.ADD2E_CLASS_ACTIVE_ABILITIES_VERSION = ADD2E_CLASS_ACTIVE_ABILITIES_VERSION;

const clone = value => foundry?.utils?.deepClone
  ? foundry.utils.deepClone(value)
  : (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

const arr = value => Array.isArray(value)
  ? value.filter(entry => entry && typeof entry === "object")
  : (value && typeof value === "object"
    ? Object.values(value).filter(entry => entry && typeof entry === "object")
    : []);

const minLevel = feature => Number(
  feature?.minLevel
  ?? feature?.minimumLevel
  ?? feature?.niveauMin
  ?? feature?.level
  ?? feature?.niveau
  ?? 1
) || 1;

const maxLevel = feature => {
  const value = feature?.maxLevel
    ?? feature?.maximumLevel
    ?? feature?.niveauMax
    ?? feature?.max;
  return value === undefined || value === null || value === "" ? 999 : (Number(value) || 999);
};

const nameOf = feature => String(
  feature?._add2eHudLabel
  ?? feature?.name
  ?? feature?.label
  ?? feature?.title
  ?? feature?.nom
  ?? ""
).trim();

const onUseOf = feature => String(
  feature?.on_use
  ?? feature?.onUse
  ?? feature?.script
  ?? feature?.macro
  ?? ""
).trim();

function onUseUrl(path) {
  const clean = String(path ?? "").trim().replace(/^\/+/, "");
  if (!clean) throw new Error("Chemin on_use vide.");
  const routed = typeof foundry?.utils?.getRoute === "function" ? foundry.utils.getRoute(clean) : clean;
  const url = new URL(routed, document.baseURI);
  if (url.origin !== window.location.origin) throw new Error(`Chemin on_use externe interdit : ${url.href}`);
  return url.href;
}

async function loadOnUseCode(path) {
  const url = onUseUrl(path);
  let response = null;
  try {
    response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  } catch (error) {
    const detail = String(error?.message ?? error ?? "erreur réseau");
    throw new Error(`Chargement réseau impossible pour ${url} : ${detail}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Chargement impossible pour ${url} : ${response.status} ${response.statusText}`);
  return { url, code: await response.text() };
}

function keyOf(value) {
  const raw = value?.id
    ?? value?._id
    ?? value?.key
    ?? value?.slug
    ?? value?.skillKey
    ?? value?.name
    ?? value?.label
    ?? value?.title
    ?? value?.nom
    ?? value
    ?? "";
  if (typeof globalThis.add2eNormalizeEquipTag === "function") return globalThis.add2eNormalizeEquipTag(raw);
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const thiefKey = value => THIEF_ALIASES[keyOf(value)] ?? keyOf(value);
const classSlug = (system, name = "") => keyOf(system?.slug ?? system?.label ?? system?.nom ?? system?.name ?? name);
const classLevel = item => {
  const value = Number(item?.system?.niveau ?? item?.system?.level);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : null;
};
const isThiefClass = (system, name = "") => {
  const value = classSlug(system, name);
  return value.includes("voleur") || value.includes("assassin");
};
const isMonkClass = (system, name = "") => classSlug(system, name).includes("moine");

let THIEF_REFERENCE_SYSTEM = null;

function normalizeThiefSystem(system, name = "") {
  const copy = clone(system ?? {});
  if (!isThiefClass(copy, name)) return copy;
  copy.thiefSkillLabels = { ...THIEF_LABELS, ...(copy.thiefSkillLabels ?? {}) };
  copy.thiefSkillOrder = Array.isArray(copy.thiefSkillOrder) && copy.thiefSkillOrder.length
    ? copy.thiefSkillOrder.map(thiefKey)
    : [...THIEF_ORDER];
  if (Array.isArray(copy.progression)) {
    copy.progression = copy.progression.map(entry => {
      const row = { ...(entry ?? {}) };
      const skills = { ...(row.thiefSkills ?? {}) };
      const backstab = Number(row.backstabMultiplier);
      const readLanguages = Number(row.readLanguages);
      if (Number.isFinite(backstab) && backstab > 0) skills.frappe_dans_le_dos = backstab;
      if (Number.isFinite(readLanguages) && readLanguages > 0) skills.lecture_langues = readLanguages;
      row.thiefSkills = skills;
      return row;
    });
  }
  return copy;
}

async function loadThiefReferenceSystem() {
  const world = Array.from(game.items ?? []).find(item =>
    String(item?.type ?? "").toLowerCase() === "classe"
    && classSlug(item.system ?? {}, item.name) === "voleur"
  );
  if (world) {
    THIEF_REFERENCE_SYSTEM = normalizeThiefSystem(world.system ?? {}, world.name);
    return THIEF_REFERENCE_SYSTEM;
  }

  for (const pack of Array.from(game.packs ?? [])) {
    if (pack.documentName !== "Item") continue;
    let documents = [];
    try { documents = await pack.getDocuments(); }
    catch (_error) { continue; }
    const item = documents.find(document =>
      String(document?.type ?? "").toLowerCase() === "classe"
      && classSlug(document.system ?? {}, document.name) === "voleur"
    );
    if (!item) continue;
    THIEF_REFERENCE_SYSTEM = normalizeThiefSystem(item.system ?? {}, item.name);
    return THIEF_REFERENCE_SYSTEM;
  }
  return null;
}

function classSystems(actor) {
  return Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe")
    .map(item => {
      const level = classLevel(item);
      if (level === null) return null;
      const system = normalizeThiefSystem(item.system ?? {}, item.name);
      return {
        ...system,
        _add2eClassSlug: classSlug(system, item.name),
        _add2eClassName: item.name || system.label || system.nom || system.name || "Classe",
        _add2eClassLevel: level,
        _add2eClassItemId: item.id
      };
    })
    .filter(Boolean);
}

function pushFeatures(output, value, source, system) {
  for (const feature of arr(value)) {
    output.push({
      ...feature,
      _add2eFeatureSource: feature?._add2eFeatureSource ?? source,
      _add2eClassSlug: feature?._add2eClassSlug ?? system?._add2eClassSlug ?? null,
      _add2eClassName: feature?._add2eClassName ?? system?._add2eClassName ?? null,
      _add2eClassLevel: feature?._add2eClassLevel ?? system?._add2eClassLevel ?? null,
      _add2eClassItemId: feature?._add2eClassItemId ?? system?._add2eClassItemId ?? null
    });
  }
}

function classFeatures(actor) {
  const output = [];
  const seen = new Set();
  const featureFields = new Set([
    "activeClassFeatures",
    "activableClassFeatures",
    "classFeaturesActives",
    "capacitesActives",
    "capacitesActivables",
    "classFeatures",
    "classFeaturesDebloquees",
    "capacitesClasse",
    "passiveClassFeatures",
    "passiveFeatures",
    "capacitesPassives"
  ]);

  for (const system of classSystems(actor)) {
    for (const [field, value] of Object.entries(system)) {
      if (featureFields.has(field)) pushFeatures(output, value, field, system);
    }
  }

  return output.filter(feature => {
    const key = keyOf(feature);
    const identity = `${feature._add2eClassItemId ?? feature._add2eClassSlug ?? ""}|${key}|${onUseOf(feature)}|${feature._add2eFeatureSource ?? ""}`;
    if ((!key && !onUseOf(feature)) || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

const genericKind = feature => GENERIC_ACTIONS.get(String(feature?.id ?? feature?._id ?? "").trim()) ?? null;

function isActivable(feature) {
  if (!feature || typeof feature !== "object") return false;
  if (genericKind(feature) || feature.activable === true || (feature.active === true && feature.passive !== true)) return true;
  if (feature.usageType === "classFeature" && onUseOf(feature)) return true;
  return String(feature?._add2eFeatureSource ?? "") === "activeClassFeatures";
}

const featureLevel = (_actor, feature) => {
  const value = Number(feature?._add2eClassLevel);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : null;
};

function thiefStatus(actor) {
  try {
    return globalThis.add2eGetThiefActivityEquipmentStatus?.(actor)
      ?? { applies: false, ok: true, message: "" };
  } catch (error) {
    console.warn("[ADD2E][CAPACITES][VOLEUR][ACTIVITE]", error);
    return { applies: false, ok: true, message: "" };
  }
}

function isThiefFeature(feature) {
  return [
    feature?._add2eClassSlug,
    feature?._add2eClassName,
    feature?.sourceClassSlug,
    feature?.sourceClassName,
    feature?.classSlug,
    feature?.className,
    feature?.classe,
    feature?.class
  ].map(keyOf).some(value => value.includes("voleur") || value.includes("assassin"));
}

function isThiefSkill(feature) {
  const joined = `${keyOf(feature?.name ?? feature?.label ?? feature?.title ?? "")} ${thiefKey(feature?.skillKey ?? feature?.key ?? feature?.slug ?? "")}`;
  return [
    "pickpocket", "faire_les_poches", "crochetage", "serrure", "piege", "desamorc",
    "deplacement_silencieux", "dissimulation", "ecoute", "auditiv", "hear_noise",
    "escalade", "climb", "lecture_langues", "read_languages", "frappe_dans_le_dos",
    "backstab", "assassinat", "assassination"
  ].some(value => joined.includes(value));
}

function progression(actor, slug = null) {
  const wanted = keyOf(slug ?? "");
  const systems = classSystems(actor);
  const ordered = wanted
    ? [
      ...systems.filter(system => system._add2eClassSlug === wanted || keyOf(system._add2eClassName) === wanted),
      ...systems.filter(system => system._add2eClassSlug !== wanted && keyOf(system._add2eClassName) !== wanted)
    ]
    : systems;
  for (const system of ordered) {
    if (!Array.isArray(system.progression)) continue;
    const level = system._add2eClassLevel;
    const row = system.progression.find(entry => Number(entry?.niveau ?? entry?.level ?? 0) === level)
      ?? system.progression[level - 1];
    if (row) return row;
  }
  return null;
}

function thiefSource(actor) {
  const systems = classSystems(actor);
  const own = systems.find(system => isThiefClass(system, system._add2eClassName));
  if (own) return own;
  const monk = systems.find(system => isMonkClass(system, system._add2eClassName));
  if (!monk || !THIEF_REFERENCE_SYSTEM) return null;
  return {
    ...THIEF_REFERENCE_SYSTEM,
    _add2eClassSlug: "voleur",
    _add2eClassName: "Voleur",
    _add2eClassLevel: monk._add2eClassLevel,
    _add2eClassItemId: monk._add2eClassItemId
  };
}

function thiefProgression(actor) {
  const source = thiefSource(actor);
  if (!source || !Array.isArray(source.progression)) return null;
  const level = source._add2eClassLevel;
  return source.progression.find(row => Number(row?.niveau ?? row?.level ?? 0) === level)
    ?? source.progression[level - 1]
    ?? null;
}

function thiefTable(actor) {
  const resolver = globalThis.add2eGetActorThiefSkills;
  if (typeof resolver !== "function") {
    throw new Error("Le résolveur canonique ADD2E des compétences de voleur est indisponible.");
  }
  const rows = resolver(actor);
  if (!Array.isArray(rows)) {
    throw new Error("Le résolveur canonique ADD2E des compétences de voleur a renvoyé une valeur invalide.");
  }
  return rows;
}

function activableFeatures(actor, { includeLocked = true } = {}) {
  const status = thiefStatus(actor);
  return classFeatures(actor)
    .filter(isActivable)
    .filter(feature => {
      if (status.applies && status.ok === false && isThiefFeature(feature)) return false;
      if (includeLocked) return true;
      const level = featureLevel(actor, feature);
      return level !== null && level >= minLevel(feature) && level <= maxLevel(feature);
    })
    .map(feature => {
      if (!isThiefSkill(feature)) return feature;
      const skill = thiefTable(actor).find(entry =>
        thiefKey(entry.key) === thiefKey(feature?.skillKey ?? feature?.key ?? feature?.slug ?? feature?.name)
      );
      return skill
        ? {
          ...feature,
          _add2eThiefSkill: skill,
          _add2eHudLabel: `${feature.name ?? feature.label ?? "Capacité"} — ${skill.display}`
        }
        : null;
    })
    .filter(Boolean);
}

function passiveFeatures(actor, { includeLocked = true } = {}) {
  const status = thiefStatus(actor);
  return classFeatures(actor)
    .filter(feature => !isActivable(feature))
    .filter(feature => {
      if (status.applies && status.ok === false && isThiefFeature(feature)) return false;
      if (includeLocked) return true;
      const level = featureLevel(actor, feature);
      return level !== null && level >= minLevel(feature) && level <= maxLevel(feature);
    });
}

function findFromElement(actor, element) {
  const node = element instanceof HTMLElement ? element : element?.[0];
  if (!node) return null;
  const holder = node.closest?.("[data-feature-index],[data-feature-name],[data-feature-id],[data-feature-key],[data-on-use],[data-skill-key]") ?? node;
  const data = holder.dataset ?? {};
  const active = activableFeatures(actor, { includeLocked: false });
  const all = classFeatures(actor);
  const index = Number(data.featureIndex ?? data.index ?? data.idx);
  if (Number.isInteger(index)) {
    if (isActivable(all[index])) return all[index];
    if (active[index]) return active[index];
  }
  const rawId = data.featureId ?? data.featureKey ?? data.id ?? data.key;
  if (rawId) {
    const wanted = keyOf(rawId);
    const feature = active.find(entry => [entry.id, entry._id, entry.key, entry.slug, entry.skillKey, entry.name, entry.label].map(keyOf).includes(wanted));
    if (feature) return feature;
  }
  const rawName = data.featureName ?? data.name ?? data.feature ?? data.nom;
  if (rawName) {
    const wanted = keyOf(rawName);
    const feature = active.find(entry => keyOf(entry?.name ?? entry?.label ?? "") === wanted);
    if (feature) return feature;
  }
  return active.length === 1 ? active[0] : null;
}

const DialogV2Class = () => foundry?.applications?.api?.DialogV2 ?? globalThis.DialogV2 ?? null;

async function dialog(title, content, label = "Valider") {
  const DialogV2 = DialogV2Class();
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 n’est pas disponible.");
    return null;
  }
  return DialogV2.wait({
    window: { title },
    content,
    buttons: [
      {
        action: "ok",
        label,
        default: true,
        callback: (_event, button) => {
          const form = button?.form ?? button?.closest?.("form");
          if (!form) return {};
          const FormDataExtended = foundry?.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
          return FormDataExtended ? new FormDataExtended(form).object : Object.fromEntries(new FormData(form).entries());
        }
      },
      { action: "cancel", label: "Annuler", callback: () => null }
    ],
    close: () => null
  });
}

const monkData = (actor, feature) => progression(actor, feature?._add2eClassSlug ?? "moine")?.monk ?? {};
const esc = value => {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
};

async function chat(actor, title, rows, cssClass = "") {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }
  const variant = cssClass === "is-success" ? "success" : cssClass === "is-failure" ? "failure" : "ability";
  const options = {
    actor,
    title,
    icon: "fas fa-star",
    variant,
    rows: rows.map(([label, value]) => ({ label, value }))
  };
  build(options);
  return create(options);
}

async function surprise(actor, feature) {
  const base = Number(monkData(actor, feature).surpriseChancePercent);
  if (!Number.isFinite(base)) {
    ui.notifications.error("Pourcentage de surprise absent de la progression.");
    return false;
  }
  const values = await dialog(
    "Surprise réduite",
    `<form><div class="form-group"><label>Chance de base</label><input value="${base}" disabled></div><div class="form-group"><label>Modificateur</label><input type="number" name="modifier" value="0"></div></form>`,
    "Lancer le d100"
  );
  if (!values) return false;
  const modifier = Number(values.modifier) || 0;
  const threshold = Math.max(0, Math.min(100, base + modifier));
  const roll = await new Roll("1d100").evaluate();
  const surprised = Number(roll.total) <= threshold;
  await chat(actor, nameOf(feature), [
    ["Chance de base", `${base}%`],
    ["Modificateur", `${modifier >= 0 ? "+" : ""}${modifier}%`],
    ["Seuil", `${threshold}%`],
    ["Jet", roll.total],
    ["Résultat", surprised ? "Surpris" : "Non surpris"]
  ], surprised ? "is-failure" : "is-success");
  return true;
}

function slowFall(actor, feature, { heightMeters, wallDistanceMeters, maintainsContact = true } = {}) {
  const monk = monkData(actor, feature);
  const protectedHeight = Number(monk.slowFallDistance);
  const proximity = Number(monk.slowFallWallDistance ?? monk.slowFallProximity ?? monk.slowFallDistanceFromWall);
  const unlimited = !Number.isFinite(protectedHeight)
    || protectedHeight <= 0
    || String(monk.slowFallText ?? "").toLowerCase().includes("illimit");
  const height = Math.max(0, Number(heightMeters) || 0);
  const wallDistance = Math.max(0, Number(wallDistanceMeters) || 0);
  const protectedFall = Boolean(maintainsContact)
    && (unlimited || height <= protectedHeight)
    && Number.isFinite(proximity)
    && wallDistance <= proximity;
  const remainingHeight = protectedFall
    ? 0
    : Math.max(0, height - (
      maintainsContact && Number.isFinite(proximity) && wallDistance <= proximity && Number.isFinite(protectedHeight)
        ? protectedHeight
        : 0
    ));
  const dice = Math.min(20, Math.ceil(remainingHeight / 3));
  return {
    protectedFall,
    height,
    wallDistance,
    protectedHeight,
    proximity,
    unlimited,
    dice,
    formula: dice ? `${dice}d6` : "0"
  };
}

async function fall(actor, feature) {
  const monk = monkData(actor, feature);
  const values = await dialog(
    "Chute ralentie",
    `<form><p>${esc(monk.slowFallText ?? feature.description ?? "")}</p><div class="form-group"><label>Hauteur (m)</label><input type="number" name="height" value="6" min="0" step="0.1"></div><div class="form-group"><label>Distance au mur (m)</label><input type="number" name="wallDistance" value="0.3" min="0" step="0.1"></div><label><input type="checkbox" name="contact" checked> Maintien du contact</label></form>`,
    "Résoudre"
  );
  if (!values) return false;
  const result = slowFall(actor, feature, {
    heightMeters: values.height,
    wallDistanceMeters: values.wallDistance,
    maintainsContact: values.contact === true || values.contact === "on"
  });
  const damage = result.dice ? Number((await new Roll(result.formula).evaluate()).total) || 0 : 0;
  await chat(actor, nameOf(feature), [
    ["Hauteur", `${result.height} m`],
    ["Distance au mur", `${result.wallDistance} m`],
    ["Limite", result.unlimited ? "Illimitée" : `${result.protectedHeight} m`],
    ["Proximité requise", Number.isFinite(result.proximity) ? `${result.proximity} m` : "Non renseignée"],
    ["Protection", result.protectedFall ? "Complète" : "Insuffisante"],
    ["Dégâts", result.dice ? `${result.formula} = ${damage}` : "Aucun"]
  ], result.protectedFall ? "is-success" : "is-warning");
  return true;
}

const catEffect = actor => Array.from(actor?.effects ?? []).find(effect => effect?.flags?.add2e?.classFeatureState === "catalepsie") ?? null;

function actionBlocked(actor, action = "") {
  const wanted = keyOf(action);
  for (const effect of Array.from(actor?.effects ?? [])) {
    if (effect?.disabled || effect?.isSuppressed) continue;
    const rawRules = effect?.flags?.add2e?.rules ?? [];
    for (const rule of (Array.isArray(rawRules) ? rawRules : [rawRules])) {
      const actions = (Array.isArray(rule?.actions) ? rule.actions : [rule?.action]).filter(Boolean).map(keyOf);
      if (rule?.kind === "block_action" && actions.includes(wanted)) {
        return {
          blocked: true,
          effect,
          message: rule.message ?? `${actor.name} ne peut pas effectuer cette action tant que « ${effect.name} » est actif.`
        };
      }
    }
  }
  return { blocked: false, effect: null, message: "" };
}

async function catalepsy(actor, feature) {
  const existing = catEffect(actor);
  if (existing) {
    const values = await dialog(
      "Catalepsie",
      `<form><p>${esc(actor.name)} est déjà en catalepsie.</p></form>`,
      "Mettre fin à la catalepsie"
    );
    if (!values) return false;
    await existing.delete();
    await chat(actor, nameOf(feature), [["État", "Catalepsie terminée"]], "is-success");
    return true;
  }

  const level = featureLevel(actor, feature);
  const maximum = Math.max(1, level * 2);
  const values = await dialog(
    "Catalepsie",
    `<form><p>Durée maximale : ${maximum} tours.</p><div class="form-group"><label>Durée</label><input type="number" name="turns" value="${maximum}" min="1" max="${maximum}"></div></form>`,
    "Entrer en catalepsie"
  );
  if (!values) return false;

  const turns = Math.max(1, Math.min(maximum, Math.floor(Number(values.turns) || maximum)));
  const rounds = typeof globalThis.add2eTimeToRounds === "function"
    ? Math.max(1, Number(globalThis.add2eTimeToRounds(turns, "tour")) || turns * 10)
    : turns * 10;
  const rules = [{
    kind: "block_action",
    scope: "owner",
    actions: ["attaque", "sort", "capacite", "mouvement"],
    message: `${actor.name} est en catalepsie et ne peut pas agir.`
  }];

  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Catalepsie",
    img: feature?.img ?? "icons/magic/death/skull-humanoid-white-blue.webp",
    origin: actor.uuid,
    disabled: false,
    duration: {
      rounds,
      startRound: game.combat?.round ?? 0,
      startTurn: game.combat?.turn ?? 0,
      startTime: game.time?.worldTime ?? 0,
      seconds: rounds * 6
    },
    changes: [],
    flags: {
      add2e: {
        classFeatureState: "catalepsie",
        managed: true,
        sourceFeatureId: feature?.id ?? null,
        sourceClassItemId: feature?._add2eClassItemId ?? null,
        durationTurns: turns,
        durationRounds: rounds,
        tags: ["etat:catalepsie", "apparence:mort"],
        rules
      }
    }
  }]);
  await chat(actor, nameOf(feature), [
    ["Durée", `${turns} tours (${rounds} rounds)`],
    ["État", "Apparence de la mort"],
    ["Actions", "Attaque, sorts, capacités et déplacement bloqués"]
  ], "is-warning");
  return true;
}

async function genericAction(actor, feature) {
  const kind = genericKind(feature);
  if (!kind) return null;
  if (kind !== "timed_state") {
    const block = actionBlocked(actor, "capacite");
    if (block.blocked) {
      ui.notifications.warn(block.message);
      return false;
    }
  }
  if (kind === "probability_check") return surprise(actor, feature);
  if (kind === "fall_protection_check") return fall(actor, feature);
  return catalepsy(actor, feature);
}

async function execute(actor, feature, sheet = null) {
  if (!actor || !feature) {
    ui.notifications.error("Capacité de classe introuvable.");
    return false;
  }
  const level = featureLevel(actor, feature);
  const minimum = minLevel(feature);
  const maximum = maxLevel(feature);
  const name = nameOf(feature) || "Capacité";
  if (level === null || level < minimum || level > maximum) {
    ui.notifications.warn(`La capacité « ${name} » n’est pas disponible à ce niveau.`);
    return false;
  }
  if (!genericKind(feature)) {
    const block = actionBlocked(actor, "capacite");
    if (block.blocked) {
      ui.notifications.warn(block.message);
      return false;
    }
  }
  if (isThiefSkill(feature)) {
    const status = thiefStatus(actor);
    if (status.applies && !status.ok) {
      ui.notifications.warn(status.message);
      return false;
    }
    const roll = globalThis.add2eRollThiefSkill;
    if (typeof roll !== "function") {
      ui.notifications.error("Moteur canonique des compétences de voleur absent.");
      return false;
    }
    return (await roll(actor, thiefKey(feature?.skillKey ?? feature?.key ?? feature?.slug ?? feature?.name))) !== false;
  }

  const genericResult = await genericAction(actor, feature);
  if (genericResult !== null) {
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    return genericResult !== false;
  }

  const path = onUseOf(feature);
  if (!path) {
    ui.notifications.warn(`La capacité « ${name} » n’a ni action générique ni script on_use.`);
    return false;
  }

  let resolvedOnUse = null;
  try {
    const loaded = await loadOnUseCode(path);
    resolvedOnUse = loaded.url;
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const run = new AsyncFunction(
      "actor", "feature", "item", "sort", "game", "ui", "ChatMessage", "Roll", "foundry", "canvas",
      loaded.code
    );
    const result = await run(actor, feature, feature, null, game, ui, ChatMessage, Roll, foundry, canvas);
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    return result !== false;
  } catch (error) {
    console.error("[ADD2E][CAPACITE][ON_USE][ERREUR]", {
      actor: actor.name,
      feature: name,
      onUse: path,
      resolvedOnUse,
      error
    });
    ui.notifications.error(`Erreur pendant l’utilisation de « ${name} » : ${error.message}`);
    return false;
  }
}

async function useFromElement(actor, element, sheet = null) {
  return execute(actor, findFromElement(actor, element), sheet);
}

function hudActor() {
  const id = String(globalThis.add2eHudCheck?.()?.actorId ?? "").trim();
  if (!id) return null;
  const token = [
    ...(canvas?.tokens?.controlled ?? []),
    ...(canvas?.tokens?.placeables ?? [])
  ].find(entry => entry?.actor?.id === id);
  return token?.actor ?? game.actors?.get?.(id) ?? null;
}

function installHud() {
  if (globalThis.__ADD2E_HUD_CLASS_FEATURE_BRIDGE_V2) return;
  globalThis.__ADD2E_HUD_CLASS_FEATURE_BRIDGE_V2 = true;
  document.addEventListener("click", event => {
    const button = event.target?.closest?.("#add2e-action-hud button[data-action='use-feature']");
    if (!button) return;
    const actor = hudActor();
    if (!actor) return;
    const index = Number(button.dataset.featureIndex);
    const features = activableFeatures(actor, { includeLocked: false });
    const feature = Number.isInteger(index) ? features[index] : findFromElement(actor, button);
    if (!feature) return ui.notifications.warn("Capacité de classe introuvable dans le HUD.");
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    void execute(actor, feature, null);
  }, true);
}

function installMovementBlock() {
  if (globalThis.__ADD2E_CATALEPSY_MOVEMENT_BLOCK_V1) return;
  globalThis.__ADD2E_CATALEPSY_MOVEMENT_BLOCK_V1 = true;
  Hooks.on("preUpdateToken", (token, changes, options, userId) => {
    if (userId !== game.user?.id
      || options?.add2eIgnoreActionBlock
      || !("x" in changes || "y" in changes || "elevation" in changes)) return;
    const block = actionBlocked(token?.actor, "mouvement");
    if (!block.blocked) return;
    ui.notifications.warn(block.message);
    return false;
  });
}

function restoreHud() {
  const id = "add2e-hud-capability-presentation-reset";
  document.getElementById(id)?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `#add2e-action-hud section[data-section="capacites"]>.a2e-hud-racial-capabilities,#add2e-action-hud section[data-section="effets"]>.a2e-hud-racial-effects,#add2e-action-hud .a2e-hud-racial-panel{display:grid!important}#add2e-action-hud .a2e-hud-racial-title{display:block!important}#add2e-action-hud .a2e-hud-racial-effects .meta{display:flex!important}#add2e-action-hud .a2e-hud-racial-description{display:block!important}#add2e-action-hud .add2e-capacites-hud-root{display:none!important}`;
  document.head.appendChild(style);
}

Hooks.once("init", () => {
  const previous = globalThis.add2eNormalizeThiefSkillKey;
  if (globalThis.__ADD2E_THIEF_SKILL_ALIAS_NORMALIZER_V2) return;
  globalThis.__ADD2E_THIEF_SKILL_ALIAS_NORMALIZER_V2 = true;
  globalThis.add2eNormalizeThiefSkillKey = value =>
    THIEF_ALIASES[thiefKey(value)]
    ?? (typeof previous === "function" ? previous(value) : thiefKey(value));
});

Hooks.once("ready", async () => {
  await loadThiefReferenceSystem();
  restoreHud();
  installHud();
  installMovementBlock();
  Hooks.on("renderActorSheet", () => setTimeout(restoreHud, 0));
});

globalThis.add2eFeatureMinLevel = minLevel;
globalThis.add2eFeatureMaxLevel = maxLevel;
globalThis.add2eFeatureActorLevel = featureLevel;
globalThis.add2eGetActorClassSystems = classSystems;
globalThis.add2eGetActorClassFeatures = classFeatures;
globalThis.add2eGetActorActivableClassFeatures = activableFeatures;
globalThis.add2eGetActorPassiveClassFeatures = passiveFeatures;
globalThis.add2eFindClassFeatureFromElement = findFromElement;
globalThis.add2eExecuteClassFeatureOnUse = execute;
globalThis.add2eUseClassFeatureFromElement = useFromElement;
globalThis.add2eGetActorClassProgression = progression;
globalThis.add2eGetActorThiefProgression = thiefProgression;
globalThis.add2eNormalizeThiefSkillKeyLocal = thiefKey;
globalThis.add2eResolveSlowFallProtection = slowFall;
globalThis.add2eIsActionBlocked = actionBlocked;
