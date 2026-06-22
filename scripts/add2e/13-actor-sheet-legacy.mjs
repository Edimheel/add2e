// ADD2E — Feuille personnage découpée
// Ancien fichier monolithique remplacé par les imports 13a à 13f.

import "./13a-actor-sheet-class.mjs";
import "./13b-actor-sheet-get-data.mjs";
import "./13b-actor-sheet-object-magic-postprocess.mjs";
import "./13c-actor-sheet-caracs-pv-tabs-render.mjs";
import "./13d-actor-sheet-listeners.mjs";
import "./13e-actor-sheet-drop.mjs";
import "./13e-actor-sheet-drop-compendium-resolver.mjs";
import "./13f-actor-sheet-registration.mjs";

const ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = "2026-06-22-canonical-character-defense-v1";
globalThis.ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION;

function a2eN(...vals){for(const v of vals){if(v===undefined||v===null||v==="")continue;if(typeof v==="object"){const n=a2eN(v.value,v.current,v.actuel,v.total,v.max);if(Number.isFinite(n))return n;continue;}const n=Number(String(v).replace(",", "."));if(Number.isFinite(n))return n;}return null;}
function a2eNorm(v){return String(v??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"").replace(/[^a-z0-9:+\-]+/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"");}
function a2eArr(v){if(!v)return[];if(Array.isArray(v))return v.flatMap(a2eArr).filter(x=>String(x??"").trim()!=="");if(typeof v==="string")return v.split(/[,;|\n]+/).map(x=>x.trim()).filter(Boolean);if(typeof v==="object"){for(const k of["value","tags","effectTags","effets","effects","list","items"]){if(v[k]!==undefined&&v[k]!==null)return a2eArr(v[k]);}}return[];}
function a2eBool(v){if(v===true)return true;if(v===false||v===undefined||v===null)return false;return ["true","1","yes","oui","on","checked","equipped","equipe","équipé","equipee","équipée","worn","portee","portée"].includes(String(v).trim().toLowerCase());}
function a2eEq(i){const s=i?.system??{};return a2eBool(s.equipee)||a2eBool(s.equipped)||a2eBool(s.portee)||a2eBool(s.worn)||a2eBool(s.estEquipee)||a2eBool(s.est_equipee)||a2eBool(s.equipe)||a2eBool(s["équipé"])||a2eBool(s["équipée"]);}
function a2eType(i){return String(i?.type??"").toLowerCase();}
function a2eTags(i){const s=i?.system??{};return [i?.name,s.nom,s.categorie,s.category,s.type,s.sousType,s.sous_type,s.slot,s.emplacement,...a2eArr(s.tags),...a2eArr(s.effectTags)].map(a2eNorm).filter(Boolean);}
function a2eName(i){return a2eNorm(i?.name??i?.system?.nom??"");}
function a2eShield(i){const n=a2eName(i),t=new Set(a2eTags(i));return n.includes("bouclier")||n.includes("shield")||t.has("bouclier")||t.has("shield")||t.has("role:bouclier")||t.has("emplacement:bouclier")||t.has("categorie_armure:bouclier")||t.has("type_armure:bouclier");}
function a2eHelmet(i){const n=a2eName(i),t=new Set(a2eTags(i));return n.includes("heaume")||n.includes("casque")||n.includes("helmet")||t.has("heaume")||t.has("casque")||t.has("helmet")||t.has("role:casque")||t.has("emplacement:casque");}
function a2eBonusName(i){const m=String(i?.name??i?.system?.nom??"").match(/\+\s*(\d+)/);return m?Number(m[1])||0:0;}
function a2eBonus(i){const s=i?.system??{};return Math.abs(a2eN(s.bonus_ca,s.bonus_ac,s.ca_bonus,s.ac_bonus,s.protectionBonus,s.protection_bonus)??0)||a2eBonusName(i);}
function a2eFixedCA(i){const s=i?.system??{},type=a2eType(i),tags=a2eTags(i);let ca=a2eN(s.ca_fixe,s.caFixe,s.fixedCA,s.fixed_ac,s.ac_fixe,s.acFixe);for(const tag of tags){const m=tag.match(/^(?:ca_fixe|ca_fixe_autres|ac_fixe|fixed_ca|classe_armure):([+\-]?\d+)$/);if(m)ca=Number(m[1]);}const text=tags.join(" ");if(!Number.isFinite(ca)&&["objet","object","equipment"].includes(type)&&(text.includes("bracelet")||text.includes("bracer"))){const name=String(i?.name??s.nom??"");const m=name.match(/(?:ca|classe\s+d[’']?armure|ac)\s*([\-]?\d+)/i)||name.match(/\b([\-]?\d+)\b\s*$/);if(m)ca=Number(m[1]);}return Number.isFinite(ca)?ca:null;}
function a2eProtectionItem(i){const type=a2eType(i);if(["arme","weapon"].includes(type))return false;if(["armure","armor"].includes(type))return false;if(!["objet","object","equipment","magic","objet_magique"].includes(type))return false;const text=a2eTags(i).join(" "),name=a2eName(i);return text.includes("anneau")||text.includes("bague")||text.includes("cape")||text.includes("protection")||text.includes("amulette")||text.includes("talisman")||name.includes("anneau")||name.includes("bague")||name.includes("cape")||name.includes("protection")||name.includes("amulette")||name.includes("talisman");}
function a2eDex(actor){const s=actor?.system??{};const direct=a2eN(s.dex_def,s.dexDefense,s.dex_defense,s.mod_dex_defense);if(Number.isFinite(direct))return direct;const d=a2eN(s.dexterite,s.dexterite_base,s.dex,s.dexterity)??10;if(d<=3)return 4;if(d===4)return 3;if(d===5)return 2;if(d===6)return 1;if(d<=14)return 0;if(d===15)return-1;if(d===16)return-2;if(d===17)return-3;return-4;}
function a2eMonkBaseCA(actor){const classes=[...(actor?.items??[])].filter(i=>a2eType(i)==="classe");const cls=classes.find(i=>a2eName(i).includes("moine")||a2eTags(i).includes("classe:moine"));if(!cls)return null;const level=Math.max(1,Number(actor?.system?.niveau)||1);const progression=Array.isArray(cls.system?.monkProgression)&&cls.system.monkProgression.length?cls.system.monkProgression:(Array.isArray(cls.system?.progression)?cls.system.progression:[]);const row=progression.find(p=>Number(p?.niveau??p?.level)===level)??progression[Math.max(0,Math.min(progression.length-1,level-1))]??null;return a2eN(row?.monkAC,row?.monkAc,row?.ca_naturel,row?.ca,row?.armorClass);}
function a2eEffectCaAdjustments(actor){const seen=new Set(),sources=[];let naturel=0,total=0;const effects=[...(actor?.effects?.contents??actor?.effects??[]),...(actor?.appliedEffects??[])];for(const effect of effects){const id=effect?.id??effect?._id??effect?.uuid??effect?.name;if(!effect||effect.disabled===true||seen.has(id))continue;seen.add(id);for(const change of effect.changes??[]){const key=a2eNorm(change?.key);if(key!=="system_ca_naturel"&&key!=="system_ca_total")continue;if(Number(change?.mode)!==2)continue;const value=a2eN(change?.value);if(!Number.isFinite(value)||value===0)continue;if(key==="system_ca_naturel")naturel+=value;else total+=value;sources.push(`${effect.name??effect.label??"Effet"}:${value>=0?"+":""}${value}`);}}return{naturel,total,sources};}
function a2eMagicDefense(actor,context={}){const items=[...(actor?.items??[])].filter(a2eEq),armors=items.filter(i=>["armure","armor"].includes(a2eType(i))),objects=items.filter(i=>!["armure","armor"].includes(a2eType(i))),worn=armors.filter(i=>!a2eShield(i)&&!a2eHelmet(i)),shields=armors.filter(a2eShield),helmets=armors.filter(a2eHelmet);const monkBase=a2eMonkBaseCA(actor);let armorBase=Number.isFinite(monkBase)&&!worn.length?monkBase:10,armorName=Number.isFinite(monkBase)&&!worn.length?"Moine":"Aucune",armorMagicBonus=0;for(const a of worn){const ac=a2eN(a.system?.ac,a.system?.ca,a.system?.armorClass,a.system?.base_ca,a.system?.baseAC);if(Number.isFinite(ac)&&ac<armorBase){armorBase=ac;armorName=a.name;armorMagicBonus=a2eBonus(a);}}let fixedCA=null,fixedSource="";for(const o of objects){const ca=a2eFixedCA(o);if(Number.isFinite(ca)&&(fixedCA===null||ca<fixedCA)){fixedCA=ca;fixedSource=o.name;}}const fixedCAActive=Number.isFinite(fixedCA);let shieldBonus=0,shieldSources=[];for(const sh of shields){const bonus=1+a2eBonus(sh);shieldBonus+=bonus;shieldSources.push(`${sh.name}:${bonus}`);}let helmetBonus=0;for(const h of helmets)helmetBonus+=Math.abs(a2eN(h.system?.ac,h.system?.ca,h.system?.armorClass)??0)+a2eBonus(h);let objectProtectionBonus=0,objectSources=[];for(const o of objects){if(a2eFixedCA(o)!==null)continue;if(!a2eProtectionItem(o))continue;const b=a2eBonus(o);if(b){objectProtectionBonus+=b;objectSources.push(`${o.name}:${b}`);}}const effectCA=a2eEffectCaAdjustments(actor),dex=a2eDex(actor),baseAfterFixed=fixedCAActive?fixedCA:armorBase,appliedArmorMagicBonus=fixedCAActive?0:armorMagicBonus,armorLayerCA=baseAfterFixed-appliedArmorMagicBonus,caNaturel=armorLayerCA+dex-shieldBonus-helmetBonus+effectCA.naturel,caTotal=caNaturel-objectProtectionBonus+effectCA.total;return{armorBase,armorName,armorMagicBonus:appliedArmorMagicBonus,ignoredArmorMagicBonus:fixedCAActive?armorMagicBonus:0,fixedCA,fixedSource,fixedCAActive,baseAfterFixed,armorLayerCA,dex,shieldBonus,shieldSources,helmetBonus,objectProtectionBonus,objectSources,effectCaNaturelAdjustment:effectCA.naturel,effectCaTotalAdjustment:effectCA.total,effectCaSources:effectCA.sources,caNaturel,caTotal,syntheticArmorAC:armorLayerCA-objectProtectionBonus,context,version:ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION};}

if(globalThis.Add2eEffectsEngine){globalThis.Add2eEffectsEngine.itemEquipped=a2eEq;globalThis.Add2eEffectsEngine.getMagicPassiveDefense=a2eMagicDefense;}

if(globalThis.Add2eActorSheet?.prototype&&!globalThis.Add2eActorSheet.prototype.__add2eBraceletsDefenseDisplayFixV6){
  globalThis.Add2eActorSheet.prototype.__add2eBraceletsDefenseDisplayFixV6=true;
  const originalGetData=globalThis.Add2eActorSheet.prototype.getData;
  globalThis.Add2eActorSheet.prototype.getData=async function add2eBraceletsDefenseGetData(...args){
    const data=await originalGetData.apply(this,args);
    try{
      if(this.actor?.type!=="personnage")return data;
      const defense=a2eMagicDefense(this.actor,{source:"actor-sheet-postprocess"});
      data.combatDefense=data.combatDefense||{};
      data.combatDefense.ac_naturelle=defense.caNaturel;
      data.combatDefense.ac_totale=defense.caTotal;
      data.combatDefense.objets_magiques_defense=defense;
      if(defense.fixedCAActive)data.combatDefense.armure=`${defense.fixedSource} <small style="color:#7f704d;">(CA fixe, armure ignorée)</small>`;
    }catch(err){console.warn("[ADD2E][BRACELETS_DEFENSE][SHEET_FIX_ERROR]",err);}
    return data;
  };
}

const ADD2E_ACTOR_ITEM_OPEN_VERSION = "2026-06-11-click-item-names-v2-dom-compatible";
globalThis.ADD2E_ACTOR_ITEM_OPEN_VERSION = ADD2E_ACTOR_ITEM_OPEN_VERSION;

async function add2eItemDescriptionHTML(item) {
  const raw = String(item?.system?.description ?? "").trim();
  if (!raw) return "<p><em>Aucune description renseignée.</em></p>";
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor ?? null;
  if (!editor?.enrichHTML) return raw;
  try { return await editor.enrichHTML(raw, { async: true, relativeTo: item }); }
  catch (_e) { return raw; }
}

function add2eLegacyRoot(html) {
  if (html?.jquery) return html[0];
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

const ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = "2026-06-22-level-pipeline-v2";
globalThis.ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION = ADD2E_SHEET_LEVEL_PIPELINE_GUARD_VERSION;

function add2eLegacySameValue(left, right) {
  if (foundry?.utils?.deepEqual) return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

function add2eLegacySameScalar(left, right) {
  if (left === right) return true;
  const leftText = String(left ?? "").trim();
  const rightText = String(right ?? "").trim();
  if (leftText && rightText) {
    const leftNumber = Number(leftText);
    const rightNumber = Number(rightText);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  }
  return add2eLegacySameValue(left, right);
}

function add2eLegacyPruneUnchangedFormXp(actor, changes) {
  const system = changes?.system;
  if (!system || typeof system !== "object") return;
  if (!Object.prototype.hasOwnProperty.call(system, "xp")) return;
  if (add2eLegacySameScalar(system.xp, actor?.system?.xp)) delete system.xp;
}

function add2eLegacyFilterMoveXpRecalc(actor, changes, options) {
  const reason = options?.add2eReason;
  if (reason !== "move-xp-recalc:movement" && reason !== "move-xp-preupdate:movement") return null;
  const system = changes?.system;
  if (!system || typeof system !== "object") return false;

  const allowed = ["mouvement", "movement", "vitesse_deplacement"];
  const filtered = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(system, key)) continue;
    if (!add2eLegacySameValue(system[key], actor?.system?.[key])) filtered[key] = system[key];
  }

  if (Object.keys(filtered).length) {
    changes.system = filtered;
    return true;
  }

  delete changes.system;
  return false;
}

if (!globalThis.ADD2E_SHEET_LEVEL_PIPELINE_GUARD_INSTALLED) {
  globalThis.ADD2E_SHEET_LEVEL_PIPELINE_GUARD_INSTALLED = true;

  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (actor?.type !== "personnage") return true;
    add2eLegacyPruneUnchangedFormXp(actor, changes);
    return add2eLegacyFilterMoveXpRecalc(actor, changes, options) !== false;
  });

  Hooks.once("ready", () => {
    Hooks.on("preUpdateActor", (actor, changes, options) => {
      if (actor?.type !== "personnage") return true;
      return add2eLegacyFilterMoveXpRecalc(actor, changes, options) !== false;
    });
  });

  Hooks.on("updateActor", async (actor, changes, options) => {
    if (actor?.type !== "personnage" || options?.add2eInternal) return;
    if (!Object.prototype.hasOwnProperty.call(changes?.system ?? {}, "niveau")) return;
    try { await globalThis.add2eSyncClassPassiveEffect?.(actor); }
    catch (err) { console.warn("[ADD2E][CLASSE][EFFETS][LEVEL_SYNC_ERROR]", err); }
  });
}

if (globalThis.Add2eActorSheet?.prototype && !globalThis.Add2eActorSheet.prototype.__add2eOpenItemsFromNamesV2) {
  globalThis.Add2eActorSheet.prototype.__add2eOpenItemsFromNamesV2 = true;
  const originalActivateListeners = globalThis.Add2eActorSheet.prototype.activateListeners;
  globalThis.Add2eActorSheet.prototype.activateListeners = function add2eOpenItemNamesActivateListeners(html) {
    originalActivateListeners.call(this, html);
    const sheet = this;
    const root = add2eLegacyRoot(html);
    if (!root?.querySelectorAll) return;
    $(root).find('input[name="system.niveau"]').off("change.add2e");
    const selector = "tr.item[data-item-id] > td:first-child b, tr.item[data-item-id] > td:nth-child(2) b, .a2e-summary-weapon-name";
    for (const el of root.querySelectorAll(selector)) {
      el.style.cursor = "pointer";
      el.style.textDecoration = "underline";
      el.style.textUnderlineOffset = "2px";
      el.title = "Cliquer pour ouvrir la fiche. Maj+clic pour afficher la description.";
    }
    if (root.dataset.add2eOpenItemNamesV2 === "1") return;
    root.dataset.add2eOpenItemNamesV2 = "1";
    root.addEventListener("click", async ev => {
      const target = ev.target?.closest?.(selector);
      if (!target || !root.contains(target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const row = target.closest(".item[data-item-id]");
      const itemId = row?.dataset?.itemId;
      const item = sheet.actor?.items?.get(String(itemId));
      if (!item) return ui.notifications.warn("Objet introuvable sur l'acteur.");
      if (ev.shiftKey) {
        const description = await add2eItemDescriptionHTML(item);
        const DialogV2 = foundry?.applications?.api?.DialogV2;
        if (DialogV2?.wait) {
          return DialogV2.wait({
            window: { title: item.name },
            content: `<div class="add2e-item-description-dialog" style="max-height:520px;overflow:auto;line-height:1.35;">${description}</div>`,
            buttons: [
              { action: "open", label: "Ouvrir la fiche", callback: () => { item.sheet.render(true); return true; } },
              { action: "close", label: "Fermer", default: true, callback: () => true }
            ],
            modal: true,
            rejectClose: false
          });
        }
        return item.sheet.render(true);
      }
      return item.sheet.render(true);
    }, true);
  };
}

// Diagnostic temporaire — niveau, XP et rafraîchissements après synchronisation de sorts.
const ADD2E_LEVEL_DIAGNOSTIC_VERSION = "2026-06-22-level-refresh-trace-v1";
const ADD2E_LEVEL_DIAGNOSTIC_MAX_PER_ACTOR = 300;
globalThis.ADD2E_LEVEL_DIAGNOSTIC_VERSION = ADD2E_LEVEL_DIAGNOSTIC_VERSION;

globalThis.__ADD2E_LEVEL_DIAGNOSTIC_STATE__ ??= { sequence: 0, events: [], counts: Object.create(null), limited: Object.create(null) };

function add2eLevelDiagActorKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? actor?.name ?? "unknown");
}

function add2eLevelDiagOptions(options = {}) {
  return {
    reason: options?.add2eReason ?? options?.reason ?? null,
    internal: options?.add2eInternal === true,
    moveXpInternal: options?.add2eMoveXpInternal === true,
    spellSync: options?.add2eSpellSync === true,
    compendiumTruth: options?.add2eCompendiumTruth === true,
    dropPurge: options?.add2eDropPurge === true,
    render: options?.render ?? null
  };
}

function add2eLevelDiagChanges(changes = {}) {
  const flattened = foundry?.utils?.flattenObject ? foundry.utils.flattenObject(changes ?? {}) : (changes ?? {});
  const entries = Object.entries(flattened)
    .filter(([key]) => key.startsWith("system.") || key === "name")
    .slice(0, 30)
    .map(([key, value]) => [key, value]);
  return {
    keys: entries.map(([key]) => key),
    values: Object.fromEntries(entries),
    niveau: changes?.system?.niveau ?? flattened["system.niveau"] ?? null,
    xp: changes?.system?.xp ?? flattened["system.xp"] ?? null
  };
}

function add2eLevelDiag(label, actor, data = {}) {
  if (actor?.type !== "personnage") return;
  const state = globalThis.__ADD2E_LEVEL_DIAGNOSTIC_STATE__;
  const key = add2eLevelDiagActorKey(actor);
  const count = Number(state.counts[key] ?? 0);
  if (count >= ADD2E_LEVEL_DIAGNOSTIC_MAX_PER_ACTOR) {
    if (!state.limited[key]) {
      state.limited[key] = true;
      console.warn("[ADD2E][LEVEL_DIAG][LIMIT]", { actor: actor.name, actorId: key, limit: ADD2E_LEVEL_DIAGNOSTIC_MAX_PER_ACTOR });
    }
    return;
  }

  state.counts[key] = count + 1;
  const event = {
    id: ++state.sequence,
    timestamp: new Date().toISOString(),
    label,
    actor: actor.name,
    actorId: key,
    niveau: actor.system?.niveau ?? null,
    xp: actor.system?.xp ?? null,
    itemCount: actor.items?.size ?? actor.items?.length ?? 0,
    ...data
  };
  state.events.push(event);
  if (state.events.length > 1200) state.events.splice(0, state.events.length - 1200);
  console.log("[ADD2E][LEVEL_DIAG]", event);
}

function add2eLevelDiagResult(result) {
  if (!result || typeof result !== "object") return result ?? null;
  return {
    handled: result.handled ?? null,
    imported: result.imported ?? null,
    deleted: result.deleted ?? null,
    reset: result.reset ?? null,
    maxSpellLevel: result.maxSpellLevel ?? null,
    levelDecreased: result.levelDecreased ?? null,
    skippedRunning: result.skippedRunning ?? null,
    mode: result.mode ?? null
  };
}

const add2eLegacyPruneUnchangedFormXpDiagnosticBase = add2eLegacyPruneUnchangedFormXp;
add2eLegacyPruneUnchangedFormXp = function add2eLegacyPruneUnchangedFormXpDiagnostic(actor, changes) {
  const before = changes?.system?.xp;
  const result = add2eLegacyPruneUnchangedFormXpDiagnosticBase(actor, changes);
  if (before !== undefined) {
    add2eLevelDiag("FORM_XP_PRUNE", actor, {
      before,
      actorXpBefore: actor?.system?.xp ?? null,
      removed: !Object.prototype.hasOwnProperty.call(changes?.system ?? {}, "xp"),
      changes: add2eLevelDiagChanges(changes)
    });
  }
  return result;
};

const add2eLegacyFilterMoveXpRecalcDiagnosticBase = add2eLegacyFilterMoveXpRecalc;
add2eLegacyFilterMoveXpRecalc = function add2eLegacyFilterMoveXpRecalcDiagnostic(actor, changes, options) {
  const reason = options?.add2eReason;
  const watched = reason === "move-xp-recalc:movement" || reason === "move-xp-preupdate:movement";
  const before = watched ? add2eLevelDiagChanges(changes) : null;
  const result = add2eLegacyFilterMoveXpRecalcDiagnosticBase(actor, changes, options);
  if (watched) add2eLevelDiag("MOVE_XP_MOVEMENT_FILTER", actor, {
    result,
    before,
    after: add2eLevelDiagChanges(changes),
    options: add2eLevelDiagOptions(options)
  });
  return result;
};

function add2eLevelDiagWrapSheetMethod(methodName) {
  const proto = globalThis.Add2eActorSheet?.prototype;
  const original = proto?.[methodName];
  if (!proto || typeof original !== "function" || original.__add2eLevelDiagnosticWrapped) return;
  const wrapped = async function add2eLevelDiagnosticSheetMethod(...args) {
    add2eLevelDiag(`SHEET_${methodName}_START`, this.actor, { args: methodName === "autoSetPointsDeCoup" ? args[0] ?? {} : {} });
    try {
      const result = await original.apply(this, args);
      add2eLevelDiag(`SHEET_${methodName}_END`, this.actor, { args: methodName === "autoSetPointsDeCoup" ? args[0] ?? {} : {} });
      return result;
    } catch (error) {
      add2eLevelDiag(`SHEET_${methodName}_ERROR`, this.actor, { error: String(error?.message ?? error) });
      throw error;
    }
  };
  wrapped.__add2eLevelDiagnosticWrapped = true;
  proto[methodName] = wrapped;
}

function add2eLevelDiagWrapSubmit() {
  const Sheet = globalThis.Add2eActorSheet;
  const original = Sheet?._add2eSubmitForm;
  if (!Sheet || typeof original !== "function" || original.__add2eLevelDiagnosticWrapped) return;
  const wrapped = async function add2eLevelDiagnosticSubmit(event, form, formData) {
    const actor = this?.actor ?? this?.document ?? null;
    const raw = formData?.object ?? {};
    add2eLevelDiag("V2_FORM_SUBMIT_START", actor, {
      eventType: event?.type ?? null,
      niveau: raw["system.niveau"] ?? null,
      xp: raw["system.xp"] ?? null,
      formKeys: Object.keys(raw).filter(key => key === "name" || key.startsWith("system.")).slice(0, 40)
    });
    try {
      const result = await original.call(this, event, form, formData);
      add2eLevelDiag("V2_FORM_SUBMIT_END", actor, {});
      return result;
    } catch (error) {
      add2eLevelDiag("V2_FORM_SUBMIT_ERROR", actor, { error: String(error?.message ?? error) });
      throw error;
    }
  };
  wrapped.__add2eLevelDiagnosticWrapped = true;
  Sheet._add2eSubmitForm = wrapped;
  if (Sheet.DEFAULT_OPTIONS?.form) Sheet.DEFAULT_OPTIONS.form.handler = wrapped;
}

function add2eLevelDiagWrapGlobal(name, label) {
  const original = globalThis[name];
  if (typeof original !== "function" || original.__add2eLevelDiagnosticWrapped) return;
  const wrapped = async function add2eLevelDiagnosticGlobal(...args) {
    const actor = args.find(arg => arg?.type === "personnage") ?? null;
    add2eLevelDiag(`${label}_START`, actor, {
      className: args.find(arg => arg?.type === "classe")?.name ?? null,
      options: args.find(arg => arg && typeof arg === "object" && (Object.prototype.hasOwnProperty.call(arg, "mode") || Object.prototype.hasOwnProperty.call(arg, "reason"))) ?? null
    });
    try {
      const result = await original.apply(this, args);
      add2eLevelDiag(`${label}_END`, actor, { result: add2eLevelDiagResult(result) });
      return result;
    } catch (error) {
      add2eLevelDiag(`${label}_ERROR`, actor, { error: String(error?.message ?? error) });
      throw error;
    }
  };
  wrapped.__add2eLevelDiagnosticWrapped = true;
  globalThis[name] = wrapped;
}

add2eLevelDiagWrapSheetMethod("autoSetCaracAjustements");
add2eLevelDiagWrapSheetMethod("autoSetPointsDeCoup");
add2eLevelDiagWrapSubmit();

if (globalThis.Add2eActorSheet?.prototype && !globalThis.Add2eActorSheet.prototype.__add2eLevelDiagnosticDomBound) {
  globalThis.Add2eActorSheet.prototype.__add2eLevelDiagnosticDomBound = true;
  const previousActivateListeners = globalThis.Add2eActorSheet.prototype.activateListeners;
  globalThis.Add2eActorSheet.prototype.activateListeners = function add2eLevelDiagnosticActivateListeners(html) {
    previousActivateListeners.call(this, html);
    const root = add2eLegacyRoot(html);
    if (!root || root.dataset.add2eLevelDiagnosticBound === "1") return;
    root.dataset.add2eLevelDiagnosticBound = "1";
    root.addEventListener("change", event => {
      const field = event.target?.closest?.("input[name='system.niveau'], input[name='system.xp']");
      if (!field || !root.contains(field)) return;
      add2eLevelDiag("DOM_FIELD_CHANGE", this.actor, { field: field.name, value: field.value });
    }, true);
  };
}

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (actor?.type !== "personnage") return;
  add2eLevelDiag("PREUPDATE_OBSERVER_EARLY", actor, { changes: add2eLevelDiagChanges(changes), options: add2eLevelDiagOptions(options) });
});

Hooks.on("updateActor", (actor, changes, options) => {
  if (actor?.type !== "personnage") return;
  add2eLevelDiag("UPDATE_ACTOR", actor, { changes: add2eLevelDiagChanges(changes), options: add2eLevelDiagOptions(options) });
});

Hooks.on("createItem", (item, options = {}) => {
  const actor = item?.parent;
  if (actor?.type !== "personnage") return;
  add2eLevelDiag("CREATE_ITEM", actor, { item: { id: item.id, name: item.name, type: item.type }, options: add2eLevelDiagOptions(options) });
});

Hooks.on("updateItem", (item, changes = {}, options = {}) => {
  const actor = item?.parent;
  if (actor?.type !== "personnage") return;
  add2eLevelDiag("UPDATE_ITEM", actor, { item: { id: item.id, name: item.name, type: item.type }, changes: add2eLevelDiagChanges(changes), options: add2eLevelDiagOptions(options) });
});

Hooks.on("deleteItem", (item, options = {}) => {
  const actor = item?.parent;
  if (actor?.type !== "personnage") return;
  add2eLevelDiag("DELETE_ITEM", actor, { item: { id: item.id, name: item.name, type: item.type }, options: add2eLevelDiagOptions(options) });
});

Hooks.on("renderApplication", app => {
  const actor = app?.actor ?? app?.document ?? null;
  if (actor?.type !== "personnage") return;
  add2eLevelDiag("RENDER_APPLICATION", actor, { app: app?.constructor?.name ?? null, appId: app?.id ?? null });
});

Hooks.once("ready", () => {
  add2eLevelDiagWrapGlobal("add2eSyncActorSpellsFromClass", "SPELL_SYNC_CLASS");
  add2eLevelDiagWrapGlobal("add2eSyncNewSpellLevelsAfterActorLevelChange", "SPELL_SYNC_LEVEL");
  add2eLevelDiagWrapGlobal("add2eRecalcMoveXp", "MOVE_XP_RECALC");

  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (actor?.type !== "personnage") return;
    add2eLevelDiag("PREUPDATE_OBSERVER_LATE", actor, { changes: add2eLevelDiagChanges(changes), options: add2eLevelDiagOptions(options) });
  });
});

globalThis.add2eLevelDiagClear = function add2eLevelDiagClear() {
  globalThis.__ADD2E_LEVEL_DIAGNOSTIC_STATE__ = { sequence: 0, events: [], counts: Object.create(null), limited: Object.create(null) };
  console.info("[ADD2E][LEVEL_DIAG] Trace vidée.");
};

globalThis.add2eLevelDiagDump = function add2eLevelDiagDump() {
  const events = [...(globalThis.__ADD2E_LEVEL_DIAGNOSTIC_STATE__?.events ?? [])];
  console.table(events);
  return events;
};

console.info("[ADD2E][LEVEL_DIAG][BOOT]", { version: ADD2E_LEVEL_DIAGNOSTIC_VERSION, limitPerActor: ADD2E_LEVEL_DIAGNOSTIC_MAX_PER_ACTOR });
