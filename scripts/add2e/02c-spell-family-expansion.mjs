const ADD2E_SPELL_FAMILY_VERSION = "2026-06-23-spell-family-material-profiles-v7";
const ADD2E_SPELL_FAMILY_MATERIAL_MIGRATION = "2026-06-23-spell-family-material-profiles-v8";

const SPELL_FAMILY_PENDING = globalThis.ADD2E_SPELL_FAMILY_PENDING instanceof Set
  ? globalThis.ADD2E_SPELL_FAMILY_PENDING
  : new Set();
const SPELL_FAMILY_PENDING_REMOVALS = globalThis.ADD2E_SPELL_FAMILY_PENDING_REMOVALS instanceof Set
  ? globalThis.ADD2E_SPELL_FAMILY_PENDING_REMOVALS
  : new Set();

globalThis.ADD2E_SPELL_FAMILY_PENDING = SPELL_FAMILY_PENDING;
globalThis.ADD2E_SPELL_FAMILY_PENDING_REMOVALS = SPELL_FAMILY_PENDING_REMOVALS;

const clone = value => {
  if (value == null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_err) {
    try { return foundry.utils.duplicate(value); }
    catch (_duplicateError) { return JSON.parse(JSON.stringify(value)); }
  }
};

const normalize = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/\s*\([^)]*\)\s*$/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

function asArray(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(asArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["spellLists", "lists", "classes", "classe", "class", "value", "values", "items"]) {
      if (value[key] !== undefined) return asArray(value[key]);
    }
  }
  return [value];
}

const spellLevel = system => Number(String(system?.niveau ?? system?.niveau_sort ?? system?.spellLevel ?? system?.level ?? 0).match(/\d+/)?.[0] ?? 0) || 0;
const spellLists = system => [...new Set([
  "spellLists", "lists", "classes", "classe", "class", "liste", "tags", "effectTags"
].flatMap(key => asArray(system?.[key])).map(normalize).filter(Boolean))];
const stableSpellKey = data => `${spellLists(data?.system).sort().join("+") || "liste_inconnue"}|${spellLevel(data?.system)}|${normalize(data?.name ?? data?.system?.nom)}`;

function matchingProfiles(flag, system) {
  const profiles = Array.isArray(flag?.profiles) ? flag.profiles.filter(Boolean) : [];
  if (!profiles.length) return [];
  const level = spellLevel(system);
  const lists = new Set(spellLists(system));
  const matched = profiles.filter(profile =>
    (!Number(profile?.level) || Number(profile.level) === level)
    && (!normalize(profile?.class) || !lists.size || lists.has(normalize(profile.class)))
  );
  return matched.length ? matched : profiles.length === 1 ? profiles : [];
}

const modeFor = (profile, id) => (profile?.modes ?? []).find(mode => String(mode?.id ?? "").toLowerCase() === id) ?? null;
const profileKey = (profile, name) => [normalize(profile?.class), Number(profile?.level) || 0, normalize(profile?.referenceName ?? name)].join("|");
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);

function applySystemOverrides(data, overrides = {}) {
  const result = clone(data);
  result.system ??= {};
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key.includes(".")) foundry.utils.setProperty(result.system, key, clone(value));
    else result.system[key] = clone(value);
  }
  return result;
}

function hasStructuredMaterials(value) {
  return Array.isArray(value) && value.some(entry =>
    entry && typeof entry === "object" && !Array.isArray(entry)
    && String(entry.nom ?? entry.name ?? entry.label ?? entry.component ?? entry.composant ?? "").trim()
  );
}

function synchronizeMaterialFields(data, overrides = {}) {
  const result = clone(data);
  const system = result.system ??= {};
  const structured = system.composants_materiels_objets;
  const explicitMaterialList = hasOwn(overrides, "composants_materiels") || hasOwn(overrides, "composants_materiels_objets");

  if (hasStructuredMaterials(structured)) {
    if (!hasOwn(overrides, "composants_materiels") || hasOwn(overrides, "composants_materiels_objets")) {
      system.composants_materiels = clone(structured);
    }
  } else if (hasStructuredMaterials(system.composants_materiels)) {
    system.composants_materiels_objets = clone(system.composants_materiels);
  } else if (!explicitMaterialList && Array.isArray(system.composants_materiels_objets) && system.composants_materiels_objets.length) {
    system.composants_materiels = clone(system.composants_materiels_objets);
  }

  return result;
}

function applyMode(data, mode = null) {
  const overrides = mode?.systemOverrides ?? {};
  return synchronizeMaterialFields(applySystemOverrides(data, overrides), overrides);
}

function withName(data, name) {
  const result = clone(data);
  result.name = String(name ?? "").trim();
  result.system ??= {};
  result.system.nom = result.name;
  return result;
}

function markFamily(data, key, kind, extra = {}, sortOrder = 0) {
  const result = clone(data);
  result.flags ??= {};
  result.flags.add2e ??= {};
  result.flags.add2e.spellFamily = {
    version: ADD2E_SPELL_FAMILY_VERSION,
    key,
    kind,
    sortOrder,
    generated: kind !== "base",
    ...clone(extra)
  };
  return result;
}

function expectedSpellFamily(base) {
  const source = typeof base?.toObject === "function" ? base.toObject() : clone(base);
  const name = String(source?.name ?? source?.system?.nom ?? "").trim();
  const key = stableSpellKey(source);
  const reversibleProfiles = matchingProfiles(source?.flags?.add2e?.reversible, source?.system);
  const normalMode = reversibleProfiles.map(profile => modeFor(profile, "normal")).find(Boolean);
  const normalData = applyMode(source, normalMode);
  const output = [{
    id: "base",
    kind: "base",
    data: markFamily(normalData, key, "base", { sourceItemId: base.id, sourceItemName: name }, 0)
  }];

  let inverseOrder = 1;
  for (const profile of reversibleProfiles) {
    if (profile?.splitOnActorGrant !== true) continue;
    const inverseMode = modeFor(profile, "inverse");
    const inverseName = String(inverseMode?.actorItemName ?? inverseMode?.manualName ?? "").trim();
    if (!inverseName) continue;
    const keyForProfile = profileKey(profile, name);
    let data = withName(normalData, inverseName);
    data = applyMode(data, inverseMode);
    data = markFamily(data, key, "inverse", {
      sourceItemId: base.id,
      sourceItemName: name,
      profileKey: keyForProfile,
      reversibleMode: "inverse",
      inverseNameStatus: profile.inverseNameStatus ?? "manual_explicit"
    }, inverseOrder++);
    data.flags.add2e.reversibleActorEntry = {
      version: ADD2E_SPELL_FAMILY_VERSION,
      profileKey: keyForProfile,
      mode: "inverse",
      sourceItemName: name
    };
    output.push({ id: `inverse:${keyForProfile}`, kind: "inverse", data });
  }

  let variantOrder = 10;
  for (const profile of matchingProfiles(source?.flags?.add2e?.variant ?? source?.flags?.add2e?.variants, source?.system)) {
    const keyForProfile = profileKey(profile, name);
    for (const choice of profile?.choices ?? []) {
      const choiceId = String(choice?.id ?? "").trim() || normalize(choice?.nom ?? choice?.name);
      const choiceName = String(choice?.nom ?? choice?.name ?? "").trim();
      if (!choiceId || !choiceName) continue;
      let data = withName(normalData, `${name} — ${choiceName}`);
      data = applyMode(data, choice?.systemOverrides ?? choice?.systemOverride ?? null);
      data = markFamily(data, key, "variant", {
        sourceItemId: base.id,
        sourceItemName: name,
        profileKey: keyForProfile,
        variantChoiceId: choiceId,
        variantChoiceName: choiceName
      }, variantOrder++);
      data.flags.add2e.variantChoice = {
        version: ADD2E_SPELL_FAMILY_VERSION,
        profileKey: keyForProfile,
        id: choiceId,
        nom: choiceName,
        reference: clone(choice?.reference ?? null)
      };
      output.push({ id: `variant:${keyForProfile}:${choiceId}`, kind: "variant", data });
    }
  }

  return {
    key,
    output: [...new Map(output.map(entry => [`${entry.id}|${stableSpellKey(entry.data)}`, entry])).values()]
  };
}

const isGeneratedFamilySpell = item => item?.flags?.add2e?.spellFamily?.generated === true;
function familyIdentity(item) {
  const family = item?.flags?.add2e?.spellFamily ?? {};
  if (family.kind === "base") return "base";
  if (family.kind === "inverse") return `inverse:${family.profileKey ?? ""}`;
  if (family.kind === "variant") return `variant:${family.profileKey ?? ""}:${family.variantChoiceId ?? ""}`;
  return "";
}

function itemUpdate(item, expected) {
  const add2e = expected.data.flags?.add2e ?? {};
  const update = {
    _id: item.id,
    name: expected.data.name,
    img: expected.data.img,
    system: clone(expected.data.system ?? {}),
    "flags.add2e.spellFamily": clone(add2e.spellFamily)
  };
  if (add2e.reversibleActorEntry) update["flags.add2e.reversibleActorEntry"] = clone(add2e.reversibleActorEntry);
  if (add2e.variantChoice) update["flags.add2e.variantChoice"] = clone(add2e.variantChoice);
  return update;
}

function scheduleVariantParentRemoval(actor, id) {
  const key = `${actor?.uuid ?? actor?.id ?? ""}|${id}`;
  if (!key || SPELL_FAMILY_PENDING_REMOVALS.has(key)) return false;
  SPELL_FAMILY_PENDING_REMOVALS.add(key);
  setTimeout(async () => {
    try {
      const parent = actor.items?.get?.(id);
      if (!parent || String(parent.type).toLowerCase() !== "sort" || isGeneratedFamilySpell(parent)) return;
      await actor.deleteEmbeddedDocuments("Item", [id], {
        add2eInternal: true,
        add2eSpellFamilyExpansion: true,
        reason: "replace-generic-variant-parent",
        render: false
      });
      globalThis.add2eRerenderActorSheet?.(actor, false);
    } catch (error) {
      if (!/does not exist|undefined id/i.test(String(error?.message ?? error))) {
        console.error("[ADD2E][SPELL_FAMILY][PARENT_REMOVAL_ERROR]", error);
      }
    } finally {
      SPELL_FAMILY_PENDING_REMOVALS.delete(key);
    }
  }, 500);
  return true;
}

async function ensureSpellFamily(item) {
  const actor = item?.actor ?? item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage" || !actor.items?.has?.(item.id)
    || String(item?.type).toLowerCase() !== "sort" || isGeneratedFamilySpell(item)) {
    return { handled: false };
  }

  const { key, output } = expectedSpellFamily(item);
  const derived = output.filter(entry => entry.id !== "base");
  const variants = derived.filter(entry => entry.kind === "variant");
  if (!derived.length) return { handled: true, created: 0, updated: 0, baseUpdated: 0 };

  const existingByIdentity = new Map();
  const occupiedKeys = new Set();
  for (const actorSpell of actor.items?.filter?.(candidate => String(candidate.type).toLowerCase() === "sort") ?? []) {
    if (actorSpell.id !== item.id) occupiedKeys.add(stableSpellKey(actorSpell));
    if (actorSpell.flags?.add2e?.spellFamily?.key === key) {
      const identity = familyIdentity(actorSpell);
      if (identity) existingByIdentity.set(identity, actorSpell);
    }
  }

  let baseUpdated = 0;
  if (!variants.length) {
    const baseEntry = output.find(entry => entry.id === "base");
    if (baseEntry && actor.items.has(item.id)) {
      await actor.updateEmbeddedDocuments("Item", [itemUpdate(item, baseEntry)], {
        add2eInternal: true,
        add2eSpellFamilyExpansion: true,
        render: false
      });
      baseUpdated = 1;
    }
  }

  const updates = [];
  const creates = [];
  const createdVariantIds = new Set();
  const conflictingVariantIds = [];

  for (const entry of derived) {
    const existing = existingByIdentity.get(entry.id);
    if (existing) {
      updates.push(itemUpdate(existing, entry));
      if (entry.kind === "variant") createdVariantIds.add(entry.id);
      continue;
    }

    const expectedKey = stableSpellKey(entry.data);
    if (occupiedKeys.has(expectedKey)) {
      if (entry.kind === "variant") conflictingVariantIds.push(entry.id);
      continue;
    }

    const data = clone(entry.data);
    delete data._id;
    data.folder = null;
    creates.push(data);
    occupiedKeys.add(expectedKey);
    if (entry.kind === "variant") createdVariantIds.add(entry.id);
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      add2eInternal: true,
      add2eSpellFamilyExpansion: true,
      render: false
    });
  }
  if (creates.length) {
    await actor.createEmbeddedDocuments("Item", creates, {
      add2eInternal: true,
      add2eSpellFamilyExpansion: true,
      render: false
    });
  }

  const queued = variants.length > 0 && createdVariantIds.size === variants.length && !conflictingVariantIds.length
    ? scheduleVariantParentRemoval(actor, item.id)
    : false;

  if (conflictingVariantIds.length) {
    console.warn("[ADD2E][SPELL_FAMILY][KEEP_PARENT_VARIANT_CONFLICT]", {
      actor: actor.name,
      sort: item.name,
      conflicts: conflictingVariantIds
    });
  }

  if (baseUpdated || updates.length || creates.length) globalThis.add2eRerenderActorSheet?.(actor, false);
  return { handled: true, created: creates.length, updated: updates.length, baseUpdated, queued };
}

async function expandActorSpellFamilies(actor) {
  if (!actor || actor.type !== "personnage") return { handled: false };
  let created = 0;
  let updated = 0;
  let baseUpdated = 0;
  let queued = 0;
  for (const item of actor.items?.filter?.(candidate => String(candidate.type).toLowerCase() === "sort" && !isGeneratedFamilySpell(candidate)) ?? []) {
    if (!actor.items.has(item.id)) continue;
    const result = await ensureSpellFamily(item);
    created += result?.created ?? 0;
    updated += result?.updated ?? 0;
    baseUpdated += result?.baseUpdated ?? 0;
    queued += result?.queued ? 1 : 0;
  }
  return { handled: true, created, updated, baseUpdated, queued };
}

function compareSpellFamilyRows(left, right) {
  const leftFamily = left?.flags?.add2e?.spellFamily ?? {};
  const rightFamily = right?.flags?.add2e?.spellFamily ?? {};
  const leftName = String(left?.name ?? left?.system?.nom ?? "");
  const rightName = String(right?.name ?? right?.system?.nom ?? "");
  const leftSource = String(leftFamily.sourceItemName ?? leftName);
  const rightSource = String(rightFamily.sourceItemName ?? rightName);
  const sourceCompare = leftSource.localeCompare(rightSource, "fr", { sensitivity: "base" });
  if (sourceCompare) return sourceCompare;
  if (leftFamily.key && leftFamily.key === rightFamily.key) {
    const leftOrder = Number.isFinite(Number(leftFamily.sortOrder)) ? Number(leftFamily.sortOrder) : leftFamily.kind === "inverse" ? 1 : leftFamily.kind === "variant" ? 10 : 0;
    const rightOrder = Number.isFinite(Number(rightFamily.sortOrder)) ? Number(rightFamily.sortOrder) : rightFamily.kind === "inverse" ? 1 : rightFamily.kind === "variant" ? 10 : 0;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  }
  return leftName.localeCompare(rightName, "fr", { sensitivity: "base" });
}

function sortSpellFamilyRows(data) {
  if (!data || typeof data !== "object") return data;
  for (const rows of Object.values(data.sortsParNiveau ?? {})) {
    if (Array.isArray(rows)) rows.sort(compareSpellFamilyRows);
  }
  for (const level of Array.isArray(data.add2eSpellLevels) ? data.add2eSpellLevels : []) {
    if (Array.isArray(level?.sorts)) level.sorts.sort(compareSpellFamilyRows);
    for (const group of Array.isArray(level?.groups) ? level.groups : []) {
      if (Array.isArray(group?.sorts)) group.sorts.sort(compareSpellFamilyRows);
    }
  }
  return data;
}

function comparableMaterialData(value) {
  if (Array.isArray(value)) return value.map(comparableMaterialData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, comparableMaterialData(value[key])]));
  }
  return value ?? null;
}

function sameMaterialData(left, right) {
  return JSON.stringify(comparableMaterialData(left)) === JSON.stringify(comparableMaterialData(right));
}

function spellFamilyMaterialsNeedMigration(actor, item) {
  if (!actor?.items?.has?.(item?.id)) return false;

  const { key, output } = expectedSpellFamily(item);
  const existingByIdentity = new Map();
  for (const actorSpell of actor.items?.filter?.(candidate => String(candidate.type).toLowerCase() === "sort") ?? []) {
    if (actorSpell.flags?.add2e?.spellFamily?.key !== key) continue;
    const identity = familyIdentity(actorSpell);
    if (identity) existingByIdentity.set(identity, actorSpell);
  }

  for (const entry of output) {
    const actual = entry.id === "base" ? item : existingByIdentity.get(entry.id);
    if (!actual) return true;

    const expectedSystem = entry.data?.system ?? {};
    const actualSystem = actual.system ?? {};
    for (const field of ["composants_materiels", "composants_materiels_objets"]) {
      if (!sameMaterialData(actualSystem[field], expectedSystem[field])) return true;
    }
  }

  return false;
}

async function migrateExistingSpellFamilyMaterials() {
  if (!game.user?.isGM) return;
  for (const actor of game.actors?.filter?.(candidate => candidate.type === "personnage") ?? []) {
    const candidates = actor.items?.filter?.(item =>
      String(item.type).toLowerCase() === "sort"
      && !isGeneratedFamilySpell(item)
      && matchingProfiles(item.flags?.add2e?.reversible, item.system).some(profile => profile?.splitOnActorGrant === true)
    ) ?? [];
    if (!candidates.length) continue;

    let repaired = false;
    for (const item of candidates) {
      if (!actor.items.has(item.id) || !spellFamilyMaterialsNeedMigration(actor, item)) continue;
      await ensureSpellFamily(item);
      repaired = true;
    }

    if (repaired || actor.getFlag?.("add2e", "spellFamilyMaterialMigration") !== ADD2E_SPELL_FAMILY_MATERIAL_MIGRATION) {
      await actor.setFlag?.("add2e", "spellFamilyMaterialMigration", ADD2E_SPELL_FAMILY_MATERIAL_MIGRATION);
    }
  }
}

Hooks.on("createItem", (item, options = {}, userId) => {
  if (options?.add2eSpellFamilyExpansion || String(userId ?? "") !== String(game.user?.id ?? "")
    || String(item?.type).toLowerCase() !== "sort" || isGeneratedFamilySpell(item)) return;
  const key = String(item.uuid ?? item.id ?? "");
  if (!key || SPELL_FAMILY_PENDING.has(key)) return;
  SPELL_FAMILY_PENDING.add(key);
  setTimeout(() => ensureSpellFamily(item)
    .catch(error => console.error("[ADD2E][SPELL_FAMILY][EXPANSION_ERROR]", error))
    .finally(() => SPELL_FAMILY_PENDING.delete(key)), 50);
});

Hooks.once("ready", () => {
  const sheetPrototype = globalThis.Add2eActorSheet?.prototype;
  if (sheetPrototype && !sheetPrototype.__add2eSpellFamilyDisplaySortingV7 && typeof sheetPrototype.getData === "function") {
    const originalGetData = sheetPrototype.getData;
    sheetPrototype.__add2eSpellFamilyDisplaySortingV7 = true;
    sheetPrototype.getData = async function add2eSpellFamilyGetData(...args) {
      const data = await originalGetData.apply(this, args);
      try { return sortSpellFamilyRows(data); }
      catch (error) {
        console.error("[ADD2E][SPELL_FAMILY][DISPLAY_SORT_ERROR]", error);
        return data;
      }
    };
  }

  if (game.user?.isGM) {
    setTimeout(() => migrateExistingSpellFamilyMaterials()
      .catch(error => console.error("[ADD2E][SPELL_FAMILY][MATERIAL_MIGRATION_ERROR]", error)), 250);
  }
});

globalThis.ADD2E_SPELL_FAMILY_VERSION = ADD2E_SPELL_FAMILY_VERSION;
globalThis.add2eEnsureActorSpellFamily = ensureSpellFamily;
globalThis.add2eExpandActorSpellFamilies = expandActorSpellFamilies;
globalThis.add2eSortActorSpellFamilyRows = sortSpellFamilyRows;

const ADD2E_SPELL_CLASS_LEVEL_VERSION="2026-06-23-progression-ceiling-v1";
function add2eSpellClassLevel(actor,classSlug=""){
  const actorLevel=Math.max(1,Number(actor?.system?.niveau??actor?.system?.level??1)||1),wanted=normalize(classSlug),classes=actor?.items?.filter?.(item=>String(item?.type??"").toLowerCase()==="classe")??[];
  const cls=classes.find(item=>[item?.system?.slug,item?.system?.label,item?.system?.nom,item?.system?.name,item?.name].map(normalize).includes(wanted))??classes[0]??null;
  const read=value=>{const n=Number(value?.niveau??value?.level??value?.value??value);return Number.isFinite(n)&&n>0?Math.floor(n):0};
  let requested=0;
  for(const root of [actor?.system?.niveaux_par_classe,actor?.system?.niveauxParClasse,actor?.system?.levelsByClass,actor?.system?.classLevels]){
    if(!root||typeof root!=="object")continue;
    for(const [key,value] of Object.entries(root)){if(normalize(key)!==wanted)continue;requested=read(value);break}
    if(requested)break;
  }
  if(!requested&&classes.length>1)requested=read(cls?.system?.niveau??cls?.system?.level??cls?.system?.currentLevel??cls?.system?.niveauActuel);
  requested=requested||actorLevel;
  const rows=Array.isArray(cls?.system?.progression)?cls.system.progression:[];
  const ceiling=rows.reduce((highest,row)=>Math.max(highest,read(row?.niveau??row?.level)),0);
  return ceiling&&requested>ceiling?ceiling:requested;
}
globalThis.ADD2E_SPELL_CLASS_LEVEL_VERSION=ADD2E_SPELL_CLASS_LEVEL_VERSION;
globalThis.add2eSpellClassLevel=add2eSpellClassLevel;

const ADD2E_SPELL_SYNC_MODAL_VERSION="2026-06-23-modal-fast-level-down-v2";
const ADD2E_SPELL_SYNC_LEVEL_DOWNS=globalThis.ADD2E_SPELL_SYNC_LEVEL_DOWNS instanceof Map?globalThis.ADD2E_SPELL_SYNC_LEVEL_DOWNS:new Map();
const ADD2E_SPELL_SYNC_MODAL_STATE=globalThis.ADD2E_SPELL_SYNC_MODAL_STATE instanceof Map?globalThis.ADD2E_SPELL_SYNC_MODAL_STATE:new Map();
globalThis.ADD2E_SPELL_SYNC_LEVEL_DOWNS=ADD2E_SPELL_SYNC_LEVEL_DOWNS;
globalThis.ADD2E_SPELL_SYNC_MODAL_STATE=ADD2E_SPELL_SYNC_MODAL_STATE;
globalThis.ADD2E_SPELL_SYNC_MODAL_VERSION=ADD2E_SPELL_SYNC_MODAL_VERSION;

function add2eSpellSyncRunKey(actor){return String(actor?.uuid??actor?.id??actor?.name??"acteur-inconnu")}
function add2eSpellSyncCurrentLevel(actor){return Math.max(1,Number(actor?.system?.niveau??actor?.system?.level??1)||1)}
function add2eSpellSyncChangedLevel(changes){const direct=changes?.system?.niveau??changes?.["system.niveau"]??changes?.system?.level??changes?.["system.level"];const n=Number(direct);return Number.isFinite(n)&&n>0?Math.floor(n):0}
function add2eSpellSyncClassLabel(cls){return normalize(cls?.system?.slug??cls?.system?.label??cls?.system?.nom??cls?.system?.name??cls?.name??"")}
function add2eSpellSyncClassIsAutomatic(cls){if(String(cls?.type??"").toLowerCase()!=="classe")return false;const sys=cls?.system??{},slug=add2eSpellSyncClassLabel(cls);if(slug.includes("clerc")||slug.includes("pretre")||slug.includes("priest")||slug.includes("druide")||slug.includes("druid"))return true;let casting=sys.spellcasting??{};if(typeof casting==="string"){try{casting=JSON.parse(casting)}catch(_e){casting={}}}const values=[...asArray(sys.spellLists),...asArray(sys.lists),...asArray(casting?.lists),...asArray(casting?.spellLists)].map(normalize);return values.includes("clerc")||values.includes("druide")}
function add2eSpellSyncAutoClasses(actor){return actor?.items?.filter?.(add2eSpellSyncClassIsAutomatic)??[]}
function add2eSpellSyncOpenModal(actor,message="Synchronisation des sorts en cours…"){
  const key=add2eSpellSyncRunKey(actor),existing=ADD2E_SPELL_SYNC_MODAL_STATE.get(key);
  if(existing){existing.count+=1;return()=>add2eSpellSyncCloseModal(actor)}
  const DialogV2=foundry?.applications?.api?.DialogV2;
  let dialog=null;
  if(DialogV2){
    try{
      dialog=new DialogV2({
        window:{title:"Synchronisation des sorts"},
        content:`<section class="add2e-spell-sync-wait" style="min-width:330px;text-align:center;line-height:1.45;padding:8px 4px;"><i class="fas fa-circle-notch fa-spin" style="font-size:2rem;margin:8px;color:#b88924;"></i><p style="margin:8px 0 4px;font-weight:700;">${String(actor?.name??"Personnage")}</p><p style="margin:0;">${message}</p><p style="margin:12px 0 0;font-size:.9em;opacity:.8;">Veuillez patienter. Les actions sur cette fiche sont temporairement bloquées.</p></section>`,
        buttons:[{action:"wait",label:"Synchronisation en cours…",default:true,callback:()=>false}],
        close:()=>false
      },{width:420,height:"auto"});
      dialog.render({force:true});
    }catch(error){console.warn("[ADD2E][SPELL_SYNC][WAIT_DIALOG_ERROR]",error)}
  }
  ADD2E_SPELL_SYNC_MODAL_STATE.set(key,{count:1,dialog});
  return()=>add2eSpellSyncCloseModal(actor);
}
function add2eSpellSyncCloseModal(actor){
  const key=add2eSpellSyncRunKey(actor),entry=ADD2E_SPELL_SYNC_MODAL_STATE.get(key);
  if(!entry)return;
  entry.count-=1;
  if(entry.count>0)return;
  ADD2E_SPELL_SYNC_MODAL_STATE.delete(key);
  try{entry.dialog?.close?.({force:true})}catch(error){console.warn("[ADD2E][SPELL_SYNC][WAIT_DIALOG_CLOSE_ERROR]",error)}
}
function add2eSpellSyncSignature(actor){
  const classes=actor?.items?.filter?.(item=>String(item?.type??"").toLowerCase()==="classe")??[],multi=actor?.system?.multiclasse?.enabled===true||classes.length>1,sig={};
  if(!multi)sig.__mono=add2eSpellSyncCurrentLevel(actor);
  for(const cls of classes){const key=add2eSpellSyncClassLabel(cls)||cls.id||cls.name;if(!key)continue;const stored=Number(cls?.system?.niveau??cls?.system?.level??cls?.system?.currentLevel??cls?.system?.niveauActuel);sig[key]=Number.isFinite(stored)&&stored>0?Math.floor(stored):add2eSpellSyncCurrentLevel(actor)}
  for(const root of [actor?.system?.niveaux_par_classe,actor?.system?.niveauxParClasse,actor?.system?.levelsByClass,actor?.system?.classLevels]){if(!root||typeof root!=="object")continue;for(const [key,value] of Object.entries(root)){const n=Number(value?.niveau??value?.level??value?.value??value);if(Number.isFinite(n)&&n>0)sig[normalize(key)]=Math.floor(n)}}
  return sig;
}
async function add2eSpellSyncFastLevelDown(actor){
  const key=add2eSpellSyncRunKey(actor),running=globalThis.ADD2E_SPELL_SYNC_RUNNING;
  if(!(running instanceof Set)||running.has(key))return false;
  running.add(key);
  const release=add2eSpellSyncOpenModal(actor,"Mise à jour des sorts accessibles après la baisse de niveau…");
  try{
    const reset=await globalThis.add2eResetActorSpellMemorization?.(actor,"level-down");
    let deleted=0;
    for(const classItem of add2eSpellSyncAutoClasses(actor)){
      const classLevel=globalThis.add2eSpellClassLevel?.(actor,add2eSpellSyncClassLabel(classItem))??add2eSpellSyncCurrentLevel(actor);
      const result=await globalThis.add2ePruneActorSpellsForClassLevel?.(actor,classItem,classLevel,{notify:false});
      deleted+=Number(result?.deleted??0)||0;
    }
    await actor.setFlag?.("add2e","autoSpellSyncLevelSignature",add2eSpellSyncSignature(actor));
    globalThis.ADD2E_SPELL_SYNC_PREUPDATE_LEVELS?.delete?.(key);
    if(deleted||Number(reset?.reset??0)>0)globalThis.add2eRerenderActorSheet?.(actor,false);
    return true;
  }catch(error){
    console.error("[ADD2E][SPELL_SYNC][FAST_LEVEL_DOWN_ERROR]",error);
    ui.notifications?.error?.("Erreur pendant la mise à jour des sorts après la baisse de niveau.");
    return false;
  }finally{
    setTimeout(()=>{running.delete(key);release()},180);
  }
}
function add2eSpellSyncWatchScheduledRun(actor){
  const release=add2eSpellSyncOpenModal(actor),key=add2eSpellSyncRunKey(actor),running=globalThis.ADD2E_SPELL_SYNC_RUNNING;
  setTimeout(()=>{
    let attempts=0;
    const check=()=>{
      attempts+=1;
      if(running instanceof Set&&running.has(key)&&attempts<600){setTimeout(check,75);return}
      release();
    };
    check();
  },140);
}
function add2eSpellSyncInstallModalWrapper(){
  const original=globalThis.add2eSyncActorSpellsFromClass;
  if(typeof original!=="function"||original.__add2eSyncModalWrapped)return;
  const wrapped=async function add2eSyncActorSpellsWithModal(actor,classItem,...rest){
    const release=add2eSpellSyncOpenModal(actor,`Synchronisation des sorts de ${classItem?.name??"classe"}…`);
    try{return await original.call(this,actor,classItem,...rest)}finally{release()}
  };
  wrapped.__add2eSyncModalWrapped=true;
  globalThis.add2eSyncActorSpellsFromClass=wrapped;
}
if(!globalThis.__ADD2E_SPELL_SYNC_MODAL_FAST_DOWN_HOOKS__){
  globalThis.__ADD2E_SPELL_SYNC_MODAL_FAST_DOWN_HOOKS__=true;
  Hooks.on("preUpdateActor",(actor,changes={},options={})=>{
    if(!actor||actor.type!=="personnage"||options?.add2eInternal)return;
    const next=add2eSpellSyncChangedLevel(changes),current=add2eSpellSyncCurrentLevel(actor);
    if(next&&next<current)ADD2E_SPELL_SYNC_LEVEL_DOWNS.set(add2eSpellSyncRunKey(actor),{from:current,to:next});
  });
  Hooks.on("updateActor",(actor,changes={},options={})=>{
    if(!game.user?.isGM||!actor||actor.type!=="personnage"||options?.add2eInternal)return;
    const next=add2eSpellSyncChangedLevel(changes),key=add2eSpellSyncRunKey(actor),down=ADD2E_SPELL_SYNC_LEVEL_DOWNS.get(key);
    if(down){
      ADD2E_SPELL_SYNC_LEVEL_DOWNS.delete(key);
      if(add2eSpellSyncAutoClasses(actor).length)add2eSpellSyncFastLevelDown(actor).catch(error=>console.error("[ADD2E][SPELL_SYNC][FAST_LEVEL_DOWN_UNHANDLED]",error));
      return;
    }
    if(next&&add2eSpellSyncAutoClasses(actor).length)add2eSpellSyncWatchScheduledRun(actor);
  });
  Hooks.once("ready",()=>add2eSpellSyncInstallModalWrapper());
}
