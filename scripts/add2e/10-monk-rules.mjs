// ADD2E — Moine : mécanique liée à l'Item classe Moine.
// Compatible Foundry V13/V14/V15.

const ADD2E_MONK_RULES_VERSION = "2026-07-08-generic-passive-rules-v1";
const ADD2E_MONK_UNARMED_SYNC_LOCK = new Set();
const ADD2E_MONK_UNARMED_IMG = "systems/add2e/assets/icones/armes/main-nue.webp";
const ADD2E_MONK_GENERATED_FEATURE_SOURCE = "10-monk-rules";
globalThis.ADD2E_MONK_RULES_VERSION = ADD2E_MONK_RULES_VERSION;

function add2eMonkNorm(value) {
  if (typeof globalThis.add2eNormalizeEquipTag === "function") return globalThis.add2eNormalizeEquipTag(value);
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function add2eMonkClone(value) {
  try { return foundry.utils.deepClone(value ?? {}); } catch (_error) { return { ...(value ?? {}) }; }
}
function add2eMonkToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eMonkToArray).filter(v => String(v ?? "").trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "list", "lists", "items", "tags", "allowedTags", "weaponsAllowed", "armes_autorisees"]) {
      if (value[key] !== undefined) return add2eMonkToArray(value[key]);
    }
  }
  return [value];
}
function add2eMonkFeatureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(entry => entry && typeof entry === "object").map(add2eMonkClone);
  if (typeof value === "object") return Object.values(value).filter(entry => entry && typeof entry === "object").map(add2eMonkClone);
  return [];
}
function add2eMonkUniqueList(...values) {
  const out = [];
  const seen = new Set();
  for (const value of values.flatMap(add2eMonkToArray)) {
    const raw = String(value ?? "").trim();
    const key = add2eMonkNorm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}
function add2eMonkNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(String(value).replace(",", "."));
    if (Number.isFinite(number)) return number;
  }
  return null;
}
function add2eMonkClassItem(actor) {
  return Array.from(actor?.items ?? []).find(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    const system = item.system ?? {};
    const label = add2eMonkNorm(item.name || system.slug || system.label || system.nom || system.name || "");
    const tags = (Array.isArray(system.tags) ? system.tags : []).map(add2eMonkNorm);
    return label === "moine" || label.includes("moine") || tags.includes("classe:moine") || tags.includes("classe_moine");
  }) ?? null;
}
function add2eMonkClassLevel(item) {
  const level = Number(item?.system?.niveau);
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}
function add2eGetMonkClassSystem(actor) {
  const item = add2eMonkClassItem(actor);
  return item ? add2eMonkClone(item.system ?? {}) : null;
}
function add2eGetMonkProgressionRow(actor) {
  const item = add2eMonkClassItem(actor);
  const level = add2eMonkClassLevel(item);
  if (!item || level === null) return null;
  const system = item.system ?? {};
  const progression = Array.isArray(system.monkProgression) && system.monkProgression.length
    ? system.monkProgression
    : (Array.isArray(system.progression) ? system.progression : []);
  return progression.find(row => Number(row?.level ?? row?.niveau) === level)
    ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
    ?? null;
}
function add2eMonkDamageParts(raw) {
  if (raw && typeof raw === "object") raw = raw.raw ?? raw.value ?? raw.contre_moyen ?? raw.medium ?? raw.moyen;
  const parts = String(raw ?? "1d6/1d3").split(/[\/|]/).map(part => part.trim()).filter(Boolean);
  const moyen = parts[0] || "1d6";
  const grand = parts[1] || moyen;
  return { raw: `${moyen} / ${grand}`, moyen, grand };
}
function add2eIsMonkAutoUnarmed(item) {
  if (!item || String(item.type ?? "").toLowerCase() !== "arme") return false;
  const system = item.system ?? {};
  const name = add2eMonkNorm(item.name);
  return ["main_nue", "mainnue"].includes(name)
    || (system.add2eAutoCreated === true && add2eMonkNorm(system.sourceClasse) === "moine")
    || add2eMonkNorm(system.sourceCapacite) === "main_nue_moine";
}
function add2eMonkUnarmedImgFor(item = null) {
  const current = String(item?.img ?? "").trim();
  if (current && !["icons/svg/fist.svg", "icons/svg/mystery-man.svg", "icons/svg/item-bag.svg", "assets/icones/armes/main-nue.svg"].includes(current)) return current;
  return ADD2E_MONK_UNARMED_IMG;
}
function add2eMonkFeature(key, minLevel, name, description, tags = [], rules = []) {
  return {
    key: `moine_passif:${key}`,
    minLevel,
    name,
    description,
    tags: add2eMonkUniqueList("classe:moine", "moine:passif", `moine:passif:${key}`, tags),
    rules: add2eMonkFeatureArray(rules),
    activable: false,
    passive: true,
    flags: { add2e: { generatedBy: ADD2E_MONK_GENERATED_FEATURE_SOURCE, monkPassive: true, key } }
  };
}
function add2eBuildMonkPassiveFeatures(actor, monk, row) {
  const level = add2eMonkClassLevel(monk) ?? 1;
  const ca = add2eMonkNumber(row?.monkAC, row?.caMoine, row?.ca_moine);
  const move = add2eMonkNumber(row?.move, row?.movement, row?.mouvement);
  const attacks = String(row?.attacksPerRound ?? row?.attaquesParRound ?? "").trim();
  const damage = String(row?.unarmedDamage ?? row?.main_nue ?? row?.damage ?? "").trim();
  const slowFall = add2eMonkNumber(row?.slowFall, row?.chute_ralentie);
  const resistESP = add2eMonkNumber(row?.resistESP, row?.resistance_esp);
  const resistCharm = add2eMonkNumber(row?.resistCharmSuggestion, row?.resistance_charme_suggestion);

  const weaponDamageRule = {
    kind: "attack_modifier",
    actions: ["attaque"],
    selector: "degats",
    mode: "add",
    valueSource: "classLevel",
    multiplier: 0.5,
    actionNotAnyTags: ["main_nue", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "combat:mains_nues"],
    label: "Bonus martial"
  };
  const cancelForceHitRule = {
    kind: "attack_modifier",
    actions: ["attaque"],
    selector: "toucher",
    mode: "cancel_ability_bonus",
    ability: "force",
    label: "Bonus de Force ignoré"
  };
  const cancelForceDamageRule = {
    kind: "attack_modifier",
    actions: ["attaque"],
    selector: "degats",
    mode: "cancel_ability_bonus",
    ability: "force",
    label: "Bonus de Force ignoré"
  };

  const features = [
    add2eMonkFeature("discipline_loyale", 1, "Discipline loyale", "Le moine doit rester d’alignement loyal. En cas de perte de la discipline loyale, ses capacités de moine sont perdues.", ["alignement:loyal", "discipline:monastique", "perte_pouvoirs_si:non_loyal"]),
    add2eMonkFeature("restrictions_ascetiques", 1, "Restrictions ascétiques", "Le moine ne peut porter ni armure ni bouclier, ne lance pas de sorts et n’utilise pas d’huile enflammée.", ["armure:interdite", "bouclier:interdit", "sorts:interdits", "huile_enflammee:interdite"]),
    add2eMonkFeature("progression_martiale", 1, "Progression martiale du moine", `CA naturelle ${Number.isFinite(ca) ? ca : "—"}, mouvement ${Number.isFinite(move) ? move : "—"}, attaques ${attacks || "—"}, dégâts à mains nues ${damage || "—"}.`, ["moine:progression_speciale", "moine:ca_naturelle", "moine:mouvement", "moine:degats_main_nue"]),
    add2eMonkFeature("combat_main_nue", 1, "Combat à mains nues", "Le moine reçoit une arme virtuelle Main nue. Ses dégâts sont synchronisés avec sa progression de niveau.", ["combat:mains_nues", "arme:main_nue", "type_arme:main_nue"]),
    add2eMonkFeature("bonus_degats_martial", 1, "Bonus de dégâts martial", "Avec les armes autorisées autres que Main nue, le moine ajoute +1/2 par niveau aux dégâts.", ["bonus_degats:classe:demi_niveau"], [weaponDamageRule]),
    add2eMonkFeature("ajustements_physiques", 1, "Ajustements physiques particuliers", "La Dextérité ne donne pas d’ajustement à la CA du moine et les bonus de Force habituels au toucher ou aux dégâts sont ignorés.", ["dex_ca:ignore", "force_bonus:toucher:ignore", "force_bonus:degats:ignore"], [cancelForceHitRule, cancelForceDamageRule]),
    add2eMonkFeature("sauvegardes_speciales", 1, "Sauvegardes spéciales", "Le moine utilise les jets de protection de voleur. Une sauvegarde réussie contre une attaque de dégâts annule les dégâts.", ["moine:jp_voleur", "moine:save_no_damage_on_success"]),
    add2eMonkFeature("parade_projectiles", 1, "Parade de projectiles", "Le moine peut éviter ou détourner les projectiles non magiques qui devraient le toucher avec un jet de sauvegarde contre la pétrification.", ["moine:parade_projectiles", "projectile_non_magique:save_petrification"])
  ];

  if (level >= 9) features.push(add2eMonkFeature("sauvegarde_demi_degats", 9, "Demi-dégâts sur sauvegarde ratée", "À partir du niveau 9, si le moine rate une sauvegarde contre une attaque de dégâts, il ne subit que la moitié des dégâts potentiels.", ["moine:save_half_damage_on_failure"]));
  if (level >= 3) features.push(add2eMonkFeature("langage_animal", 3, "Langage animal", "Le moine peut parler aux animaux comme les druides.", ["langage:animaux", "moine:langage_animal"]));
  if (level >= 4 || (Number.isFinite(slowFall) && slowFall > 0)) features.push(add2eMonkFeature("chute_ralentie", 4, "Chute ralentie", `Le moine peut ralentir une chute en restant au contact d’un mur ou d’une surface équivalente${Number.isFinite(slowFall) && slowFall > 0 ? ` — valeur actuelle : ${slowFall} m` : ""}.`, ["moine:chute_ralentie", Number.isFinite(slowFall) ? `moine:chute_ralentie:${slowFall}` : ""]));
  if (level >= 4) features.push(add2eMonkFeature("esprit_masque", 4, "Masquer son esprit", `L’ESP n’a qu’une chance réduite d’atteindre le moine${Number.isFinite(resistESP) ? ` — résistance actuelle : ${resistESP} %` : ""}.`, ["moine:esprit_masque", Number.isFinite(resistESP) ? `resistance:esp:${resistESP}` : ""]));
  if (level >= 5 || row?.immuneDisease === true || row?.immuneHasteSlow === true) features.push(add2eMonkFeature("immunites_maladie_rapidite_lenteur", 5, "Immunité maladie, rapidité et lenteur", "Le moine est immunisé aux maladies et insensible aux effets de rapidité et lenteur.", ["immunite:maladie", "immunite:rapidite", "immunite:lenteur"]));
  if (level >= 6 || Number.isFinite(add2eMonkNumber(row?.catalepsyTurnsPerLevel))) features.push(add2eMonkFeature("catalepsie", 6, "Catalepsie", "Le moine peut se mettre en catalepsie et maintenir cet état pendant 2 tours par niveau.", ["moine:catalepsie", "catalepsie:2_tours_par_niveau"]));
  if (level >= 8) features.push(add2eMonkFeature("langage_plantes", 8, "Langage des plantes", "Le moine peut parler aux plantes comme les druides.", ["langage:plantes", "moine:parler_aux_plantes"]));
  if (level >= 9) features.push(add2eMonkFeature("resistance_charme_suggestion", 9, "Résistance aux charmes et suggestions", `Les charmes, suggestions, hypnotismes et séductions n’ont que peu de chance d’affecter le moine${Number.isFinite(resistCharm) ? ` — résistance actuelle : ${resistCharm} %` : ""}.`, ["moine:resistance_charme_suggestion", Number.isFinite(resistCharm) ? `resistance:charme_suggestion:${resistCharm}` : ""]));
  if (level >= 10) features.push(add2eMonkFeature("defense_mentale", 10, "Défense mentale", "Contre les attaques télépathiques ou les chocs mentaux, le moine est traité comme ayant 18 en Intelligence.", ["moine:defense_mentale", "defense_mentale:intelligence_18"]));
  if (level >= 11 || row?.immunePoison === true) features.push(add2eMonkFeature("immunite_poison", 11, "Immunité au poison", "Le moine est immunisé contre les poisons de tout type.", ["immunite:poison"]));
  if (level >= 12 || row?.immuneQuestGeas === true) features.push(add2eMonkFeature("immunite_quete_geas", 12, "Immunité quête et geas", "Le moine est immunisé contre quête et geas.", ["immunite:quete", "immunite:quest", "immunite:geas"]));

  return features.filter(Boolean);
}
async function add2eEnsureMonkPassiveClassFeatures(actor, monk, row) {
  if (!monk?.id || !row) return false;
  const generated = add2eBuildMonkPassiveFeatures(actor, monk, row);
  const current = add2eMonkFeatureArray(monk.system?.classFeatures);
  const preserved = current.filter(feature => feature?.flags?.add2e?.generatedBy !== ADD2E_MONK_GENERATED_FEATURE_SOURCE);
  const next = [...preserved, ...generated];
  if (JSON.stringify(current) === JSON.stringify(next)) return false;
  await monk.update({ "system.classFeatures": next }, { add2eInternal: true, add2eReason: "monk-passive-feature-rules-sync" });
  return true;
}
async function add2eEnsureMonkUnarmedAllowed(monk) {
  if (!monk?.id || String(monk.type ?? "").toLowerCase() !== "classe") return false;
  const system = monk.system ?? {};
  const allowedTags = [
    "main_nue",
    "arme:main_nue",
    "type_arme:main_nue",
    "famille_arme:main_nue",
    "combat:mains_nues",
    "classe:moine"
  ];

  const updates = {};
  const currentAllowed = add2eMonkToArray(system.armes_autorisees ?? system.weaponsAllowed ?? []);
  const nextAllowed = add2eMonkUniqueList(currentAllowed, "main_nue");
  if (nextAllowed.length !== currentAllowed.length || !currentAllowed.map(add2eMonkNorm).includes("main_nue")) {
    updates["system.armes_autorisees"] = nextAllowed;
    if (system.weaponsAllowed !== undefined) updates["system.weaponsAllowed"] = nextAllowed;
  }

  if (system.weaponRestriction && typeof system.weaponRestriction === "object") {
    const currentRestrictionAllowed = add2eMonkToArray(system.weaponRestriction.allowedTags);
    const nextRestrictionAllowed = add2eMonkUniqueList(currentRestrictionAllowed, allowedTags);
    if (nextRestrictionAllowed.length !== currentRestrictionAllowed.length) {
      updates["system.weaponRestriction.allowedTags"] = nextRestrictionAllowed;
    }
  }

  if (!Object.keys(updates).length) return false;
  await monk.update(updates, { add2eInternal: true, add2eReason: "monk-unarmed-equipment-allowance" });
  return true;
}
async function add2eSyncMonkUnarmedWeapon(actor) {
  if (!actor || actor.type !== "personnage") return false;
  const monk = add2eMonkClassItem(actor);
  const existing = Array.from(actor.items ?? []).filter(add2eIsMonkAutoUnarmed);
  if (!monk) {
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing.map(item => item.id), { add2eInternal: true });
    return false;
  }
  await add2eEnsureMonkUnarmedAllowed(monk);
  const row = add2eGetMonkProgressionRow(actor);
  if (!row) {
    console.warn("[ADD2E][MOINE][PROGRESSION_MISSING]", { actor: actor.name, classItemId: monk.id });
    return false;
  }
  await add2eEnsureMonkPassiveClassFeatures(actor, monk, row);
  const damage = add2eMonkDamageParts(row.unarmedDamage ?? row.main_nue ?? row.damage ?? actor.system?.moine?.main_nue);
  const system = {
    nom: "Main nue", equipee: true, categorie: "melee", type_degats: "contondant", type_arme: "main_nue", famille_arme: "main_nue",
    degats: damage.raw, "dégâts": { contre_moyen: damage.moyen, contre_grand: damage.grand }, bonus_hit: 0, bonus_dom: 0,
    facteur_rapidité: 1, portee_courte: 0, portee_moyenne: 0, portee_longue: 0,
    tags: ["arme", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "combat:mains_nues", "classe:moine", "mod_carac:toucher:none", "mod_carac:degats:none"],
    effectTags: ["arme", "arme:main_nue", "type_arme:main_nue", "famille_arme:main_nue", "usage:corps_a_corps", "degat:contondant", "combat:mains_nues", "classe:moine", "mod_carac:toucher:none", "mod_carac:degats:none"],
    add2eAutoCreated: true, sourceClasse: "moine", sourceClassId: monk.id, sourceCapacite: "main_nue_moine"
  };
  await actor.update({
    "system.moine.main_nue": damage.raw,
    "system.moine.main_nue_contre_moyen": damage.moyen,
    "system.moine.main_nue_contre_grand": damage.grand
  }, { add2eInternal: true });
  if (existing.length) {
    const [first, ...duplicates] = existing;
    await actor.updateEmbeddedDocuments("Item", [{ _id: first.id, name: "Main nue", img: add2eMonkUnarmedImgFor(first), system }], { add2eInternal: true });
    if (duplicates.length) await actor.deleteEmbeddedDocuments("Item", duplicates.map(item => item.id), { add2eInternal: true });
  } else {
    await actor.createEmbeddedDocuments("Item", [{ type: "arme", name: "Main nue", img: ADD2E_MONK_UNARMED_IMG, system, flags: { add2e: { autoCreated: true, sourceClasse: "moine", sourceClassId: monk.id, sourceCapacite: "main_nue_moine" } } }], { add2eInternal: true });
  }
  return true;
}
function add2eGetRaceTagsForLevelCap(actor) {
  const tags = new Set();
  const push = value => { const tag = add2eMonkNorm(value); if (tag) tags.add(tag); };
  const pushAll = value => { if (Array.isArray(value)) value.forEach(pushAll); else if (value && typeof value === "object") Object.values(value).forEach(pushAll); else push(value); };
  for (const race of Array.from(actor?.items ?? []).filter(item => String(item.type ?? "").toLowerCase() === "race")) {
    push(`race:${race.system?.slug || race.name}`); pushAll(race.system?.tags); pushAll(race.system?.identityTags);
  }
  return tags;
}
function add2eGetClassMaxLevelForActor(actor, classItemOrSystem = null) {
  const classItem = classItemOrSystem?.type === "classe" ? classItemOrSystem : null;
  const system = classItem?.system ?? classItemOrSystem ?? (Array.from(actor?.items ?? []).filter(item => String(item.type ?? "").toLowerCase() === "classe").length === 1 ? Array.from(actor.items).find(item => String(item.type ?? "").toLowerCase() === "classe")?.system : null);
  if (!system || typeof system !== "object") return null;
  const rows = Array.isArray(system.progression) ? system.progression : [];
  let maxLevel = rows.map((row, index) => Number(row?.niveau ?? row?.level ?? index + 1) || 0).reduce((max, value) => Math.max(max, value), 0) || null;
  const rules = system.raceRestriction?.races;
  if (rules && typeof rules === "object") {
    const tags = add2eGetRaceTagsForLevelCap(actor);
    for (const [rawTag, rule] of Object.entries(rules)) {
      if (!tags.has(add2eMonkNorm(rawTag)) || rule?.allowed === false) continue;
      const racial = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max);
      if (Number.isFinite(racial) && racial > 0) maxLevel = maxLevel ? Math.min(maxLevel, racial) : racial;
    }
  }
  return Number.isFinite(maxLevel) && maxLevel > 0 ? Math.floor(maxLevel) : null;
}
function add2eClampLevelToClassMax(actor, desiredLevel, classItemOrSystem = null, { notify = false } = {}) {
  const requested = Math.max(1, Number.parseInt(desiredLevel, 10) || 1);
  const maximum = add2eGetClassMaxLevelForActor(actor, classItemOrSystem);
  const level = maximum && requested > maximum ? maximum : requested;
  if (notify && level !== requested) ui.notifications.warn(`${classItemOrSystem?.name ?? classItemOrSystem?.label ?? "Cette classe"} est limitée au niveau ${maximum}. Niveau ramené à ${maximum}.`);
  return { level, maxLevel: maximum, changed: level !== requested, original: requested };
}
async function add2eClampActorLevelToClassMax(actor, classItemOrSystem = null, options = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const item = classItemOrSystem?.type === "classe" ? classItemOrSystem : (Array.from(actor.items ?? []).filter(entry => String(entry.type ?? "").toLowerCase() === "classe").length === 1 ? Array.from(actor.items).find(entry => String(entry.type ?? "").toLowerCase() === "classe") : null);
  if (!item) return null;
  const current = Number(item.system?.niveau);
  if (!Number.isFinite(current) || current < 1) return null;
  const clamp = add2eClampLevelToClassMax(actor, current, item, options);
  if (clamp.changed) await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.niveau": clamp.level }], { add2eInternal: true });
  return clamp;
}

function add2eMonkActorFromEmbeddedItem(item) {
  const parent = item?.parent ?? item?.actor ?? null;
  return parent?.documentName === "Actor" ? parent : null;
}

function add2eMonkIsClassItem(item) {
  return String(item?.type ?? "").toLowerCase() === "classe";
}

function add2eMonkClassUpdateRelevant(changes = {}) {
  if (!changes || typeof changes !== "object") return true;
  return foundry.utils.hasProperty(changes, "name")
    || foundry.utils.hasProperty(changes, "system.niveau")
    || foundry.utils.hasProperty(changes, "system.level")
    || foundry.utils.hasProperty(changes, "system.progression")
    || foundry.utils.hasProperty(changes, "system.monkProgression")
    || foundry.utils.hasProperty(changes, "system.tags")
    || foundry.utils.hasProperty(changes, "system.slug")
    || foundry.utils.hasProperty(changes, "system.label")
    || foundry.utils.hasProperty(changes, "system.nom")
    || foundry.utils.hasProperty(changes, "system.name")
    || foundry.utils.hasProperty(changes, "system.classFeatures");
}

function add2eQueueMonkUnarmedSync(actor, reason = "item-class-change") {
  if (!actor || actor.type !== "personnage") return false;
  if (!actor.isOwner && !game.user?.isGM) return false;
  const key = String(actor.uuid ?? actor.id ?? actor.name ?? "unknown");
  if (ADD2E_MONK_UNARMED_SYNC_LOCK.has(key)) return false;
  ADD2E_MONK_UNARMED_SYNC_LOCK.add(key);
  setTimeout(async () => {
    try {
      await add2eSyncMonkUnarmedWeapon(actor);
    } catch (error) {
      console.error("[ADD2E][MOINE][MAIN_NUE][SYNC_ERROR]", { actor: actor?.name, reason, error });
    } finally {
      ADD2E_MONK_UNARMED_SYNC_LOCK.delete(key);
    }
  }, 0);
  return true;
}

function add2eQueueExistingMonksSync() {
  if (!game.user?.isGM) return;
  setTimeout(() => {
    for (const actor of game.actors?.contents ?? []) {
      if (actor?.type !== "personnage") continue;
      const hasMonk = !!add2eMonkClassItem(actor);
      const hasAutoUnarmed = Array.from(actor.items ?? []).some(add2eIsMonkAutoUnarmed);
      if (hasMonk || hasAutoUnarmed) add2eQueueMonkUnarmedSync(actor, "ready-existing-monk-sync");
    }
  }, 250);
}

function add2eRegisterMonkItemHooks() {
  if (globalThis.ADD2E_MONK_ITEM_HOOKS_REGISTERED === ADD2E_MONK_RULES_VERSION) return;
  globalThis.ADD2E_MONK_ITEM_HOOKS_REGISTERED = ADD2E_MONK_RULES_VERSION;

  Hooks.on("createItem", (item, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!add2eMonkIsClassItem(item)) return;
    add2eQueueMonkUnarmedSync(add2eMonkActorFromEmbeddedItem(item), "create-class-item");
  });

  Hooks.on("updateItem", (item, changes = {}, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!add2eMonkIsClassItem(item) || !add2eMonkClassUpdateRelevant(changes)) return;
    add2eQueueMonkUnarmedSync(add2eMonkActorFromEmbeddedItem(item), "update-class-item");
  });

  Hooks.on("deleteItem", (item, _options = {}, userId = null) => {
    if (userId && game.user?.id !== userId) return;
    if (!add2eMonkIsClassItem(item)) return;
    add2eQueueMonkUnarmedSync(add2eMonkActorFromEmbeddedItem(item), "delete-class-item");
  });

  if (game?.ready) add2eQueueExistingMonksSync();
  else Hooks.once("ready", add2eQueueExistingMonksSync);
}

globalThis.add2eGetMonkClassItem = add2eMonkClassItem;
globalThis.add2eGetMonkClassSystem = add2eGetMonkClassSystem;
globalThis.add2eGetMonkProgressionRow = add2eGetMonkProgressionRow;
globalThis.add2eMonkDamageParts = add2eMonkDamageParts;
globalThis.add2eIsMonkAutoUnarmed = add2eIsMonkAutoUnarmed;
globalThis.add2eSyncMonkUnarmedWeapon = add2eSyncMonkUnarmedWeapon;
globalThis.add2eEnsureMonkUnarmedAllowed = add2eEnsureMonkUnarmedAllowed;
globalThis.add2eBuildMonkPassiveFeatures = add2eBuildMonkPassiveFeatures;
globalThis.add2eGetRaceTagsForLevelCap = add2eGetRaceTagsForLevelCap;
globalThis.add2eGetClassMaxLevelForActor = add2eGetClassMaxLevelForActor;
globalThis.add2eClampLevelToClassMax = add2eClampLevelToClassMax;
globalThis.add2eClampActorLevelToClassMax = add2eClampActorLevelToClassMax;
globalThis.add2eQueueMonkUnarmedSync = add2eQueueMonkUnarmedSync;

add2eRegisterMonkItemHooks();
