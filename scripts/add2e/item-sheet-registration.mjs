// scripts/add2e/item-sheet-registration.mjs
// ADD2E — Enregistrement strict des fiches d'items spécialisées.
// Version : 2026-07-23-magic-power-sheet-editor-v1

import { Add2eItemSheet } from "../add2e-item-sheet.mjs";
globalThis.Add2eItemSheet = Add2eItemSheet;

const POWER_FIELDS = ["pouvoirs", "powers", "pouvoirsMagiques", "magicalPowers"];
const EDITOR_VERSION = "2026-07-23-magic-power-sheet-editor-v1";

function add2eItemsCollection() { return foundry?.documents?.collections?.Items ?? globalThis.Items; }
function add2eItemDocumentClass() { return foundry?.documents?.Item ?? globalThis.Item; }
function clone(value) { try { return foundry.utils.deepClone(value); } catch (_e) { try { return structuredClone(value); } catch (_e2) { return JSON.parse(JSON.stringify(value)); } } }
function esc(value) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function norm(value) { return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
function list(value) { if (value == null || value === "") return []; if (Array.isArray(value)) return value.flatMap(list); if (value instanceof Set) return [...value].flatMap(list); if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v=>v.trim()).filter(Boolean); if (typeof value === "object") return Object.values(value).flatMap(list); return [value]; }
function format(value) { if (value == null || value === "") return "—"; if (typeof value !== "object") return String(value); try { return JSON.stringify(value,null,2); } catch (_e) { return String(value); } }

function defaultActorTokenLink(actor, data={}) {
  const type=String(actor?.type ?? data?.type ?? "").trim().toLowerCase();
  if (type === "personnage") return true;
  if (["monstre","monster"].includes(type)) return false;
  return null;
}
function defaultCharacterSightRange() {
  const distance=Number(canvas?.scene?.grid?.distance ?? game?.scenes?.active?.grid?.distance ?? 1);
  return Number.isFinite(distance) && distance > 0 ? distance*5 : 5;
}

function powerStore(item) {
  const system=item?.system ?? {};
  let fallback=null;
  for (const field of POWER_FIELDS) {
    const raw=system[field];
    let store=null;
    if (Array.isArray(raw)) store={path:`system.${field}`,entries:raw,keys:raw.map((_v,i)=>i),object:false};
    else if (raw && typeof raw === "object") { const keys=Object.keys(raw); store={path:`system.${field}`,entries:keys.map(k=>raw[k]),keys,object:true,raw}; }
    if (!store) continue;
    if (store.entries.length) return store;
    fallback ??= store;
  }
  return fallback ?? {path:"system.pouvoirs",entries:[],keys:[],object:false};
}

const CATEGORY_LABELS={attribute:"Caractéristiques",charges:"Charges",combat:"Combat",consumable:"Consommable",control:"Contrôle",curse:"Malédiction",defense:"Défense",destruction:"Destruction",detection:"Détection",environment:"Environnement",healing:"Guérison",holy:"Sacré",illusion:"Illusion",immunity:"Immunité",light:"Lumière",movement:"Déplacement",negation:"Négation",poison:"Poison",protection:"Protection",random:"Aléatoire",ranged:"Distance",resistance:"Résistance",restriction:"Restriction",scroll:"Parchemin",social:"Social",spell:"Sort",summoning:"Invocation",survival:"Survie",transformation:"Transformation"};
function categoryLabel(value) { return CATEGORY_LABELS[norm(value)] ?? String(value ?? "Autre"); }
function automationLabel(value) { return ({automatic:"Automatique",assisted:"Assisté par le MD",manual:"Manuel",chat_card:"Carte de chat"})[norm(value)] ?? String(value ?? "—"); }
function activationLabel(value) { if (!value) return "—"; if (typeof value === "string") return value; return [value.type,value.trigger].map(v=>String(v ?? "").trim()).filter(Boolean).join(" — ") || "—"; }

function sheetPowers(item) {
  return powerStore(item).entries.map((power,index)=>({power,index})).filter(e=>e.power && typeof e.power === "object").map(({power,index})=>{
    const parameters=power.parameters && typeof power.parameters === "object" ? power.parameters : {};
    const effects=Array.isArray(power.effects) ? power.effects : power.effects && typeof power.effects === "object" ? Object.values(power.effects) : [];
    const section=String(power.source?.section ?? "").trim();
    const page=String(power.source?.page ?? "").trim();
    return {...power,
      _add2eIndex:index,
      _add2eName:String(power.name ?? power.nom ?? power.label ?? `Pouvoir ${index+1}`).trim(),
      _add2eCost:Math.max(0,Number(power.cout ?? power.cost ?? power.chargeCost ?? 0)||0),
      _add2eKindLabel:power.catalogueId || power.kind === "catalogue" ? "Catalogue canonique" : "Sort lié",
      _add2eCategoryLabel:categoryLabel(power.category),
      _add2eAutomationLabel:automationLabel(power.automation),
      _add2eActivationLabel:activationLabel(power.activation),
      _add2eHasParameters:Object.keys(parameters).length>0,
      _add2eParametersJson:format(parameters),
      _add2eHasEffects:effects.length>0,
      _add2eEffectsJson:format(effects),
      _add2eSourceLabel:[section,page?`page ${page}`:""].filter(Boolean).join(", ")||"—"
    };
  });
}

async function resolveItem(uuid) {
  const value=String(uuid ?? "").trim();
  if (!value) return null;
  try { const doc=await fromUuid?.(value); if (doc?.documentName === "Item") return doc; } catch (_e) {}
  const id=value.split(".").at(-1);
  return game.items?.get?.(id) ?? game.actors?.contents?.flatMap(a=>a.items?.contents ?? []).find(i=>i.id===id) ?? null;
}
function initial(schema,current) { if (current !== undefined) return current; if (schema.default !== undefined) return clone(schema.default); if (schema.value !== undefined) return clone(schema.value); return undefined; }

function control(name,schema={},current) {
  const type=norm(schema.type), value=initial(schema,current), required=schema.required===true?' <span style="color:#a40000">*</span>':"", label=`${esc(name)}${required}`, common=`name="${esc(name)}" data-add2e-parameter-type="${esc(type)}"`;
  if (type === "boolean") return `<label class="form-group" style="display:flex;align-items:center;gap:8px"><input ${common} type="checkbox" ${value===true?"checked":""}> <span>${label}</span></label>`;
  if (["fixed","fixed_list"].includes(type)) { const fixed=schema.value!==undefined?schema.value:value; return `<div class="form-group"><label>${label}</label><input ${common} type="hidden" value="${esc(format(fixed))}"><div>${esc(format(fixed))}</div></div>`; }
  if (type === "choice" && Array.isArray(schema.values)) return `<div class="form-group"><label>${label}</label><select ${common}>${schema.values.map(v=>`<option value="${esc(v)}"${String(v)===String(value)?" selected":""}>${esc(v)}</option>`).join("")}</select></div>`;
  if (type === "choice_list" && Array.isArray(schema.values)) { const selected=new Set(list(value).map(String)); return `<div class="form-group"><label>${label}</label><select ${common} multiple size="${Math.min(7,Math.max(3,schema.values.length))}">${schema.values.map(v=>`<option value="${esc(v)}"${selected.has(String(v))?" selected":""}>${esc(v)}</option>`).join("")}</select></div>`; }
  if (["integer","number","percentage","percentage_per_use"].includes(type)) return `<div class="form-group"><label>${label}</label><input ${common} type="number" step="${type==="integer"?"1":"any"}" value="${esc(value ?? "")}"></div>`;
  if (["object","effect_list","effect_table","spell_list","form_list","save_rule","percentage_or_save","percentage_or_table","number_or_table","weight_or_table","formula_or_table"].includes(type)) return `<div class="form-group"><label>${label}</label><textarea ${common} rows="4">${esc(value===undefined?"":format(value))}</textarea></div>`;
  if (["tag_list","string_list","integer_list"].includes(type)) return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${esc(list(value).join(", "))}"></div>`;
  return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${esc(value===undefined?"":format(value))}"></div>`;
}

function read(input,schema={}) {
  const type=norm(schema.type);
  if (type === "boolean") return input.checked===true;
  if (type === "choice_list") return [...input.selectedOptions].map(o=>o.value);
  if (["fixed","fixed_list"].includes(type)) return clone(schema.value);
  const raw=String(input.value ?? "").trim(); if (!raw) return undefined;
  if (["integer","number","percentage","percentage_per_use"].includes(type)) { const n=Number(raw.replace(",",".")); return Number.isFinite(n)?n:undefined; }
  if (["tag_list","string_list"].includes(type)) return list(raw).map(String);
  if (type === "integer_list") return list(raw).map(Number).filter(Number.isFinite);
  if (["formula_or_integer","integer_or_null","number_or_formula","number_or_distance"].includes(type)) { const n=Number(raw.replace(",",".")); return Number.isFinite(n)?n:raw; }
  if (["object","effect_list","effect_table","spell_list","form_list","save_rule","percentage_or_save","percentage_or_table","number_or_table","weight_or_table","formula_or_table"].includes(type)) { try { return JSON.parse(raw); } catch (_e) { return raw; } }
  return raw;
}
function missingParameters(definition,parameters) {
  const missing=Object.entries(definition.parameters ?? {}).filter(([name,schema])=>schema?.required===true && (parameters[name]===undefined || parameters[name]===null || parameters[name]==="" || (Array.isArray(parameters[name])&&!parameters[name].length))).map(([name])=>name);
  const alternatives=list(definition.validation?.requiresOneOf);
  if (alternatives.length && !alternatives.some(name=>parameters[name]!==undefined && parameters[name]!==null && parameters[name]!=="" && (!Array.isArray(parameters[name])||parameters[name].length))) missing.push(`un des paramètres suivants : ${alternatives.join(", ")}`);
  return missing;
}
function resolveTemplates(value,parameters) {
  if (Array.isArray(value)) return value.map(v=>resolveTemplates(v,parameters));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolveTemplates(v,parameters)]));
  if (typeof value !== "string") return clone(value);
  const exact=value.match(/^@([A-Za-z0-9_]+)$/); if (exact && Object.hasOwn(parameters,exact[1])) return clone(parameters[exact[1]]);
  return value.replace(/@([A-Za-z0-9_]+)/g,(match,key)=>Object.hasOwn(parameters,key)?(typeof parameters[key]==="object"?JSON.stringify(parameters[key]):String(parameters[key])):match);
}

async function editCanonical(definition,current={}) {
  const DialogV2=foundry?.applications?.api?.DialogV2; if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable."),null;
  const entries=Object.entries(definition.parameters ?? {}), controls=entries.length?entries.map(([name,schema])=>control(name,schema,current[name])).join(""):'<p><em>Ce pouvoir ne possède aucun paramètre modifiable.</em></p>';
  const result=await DialogV2.wait({window:{title:`Modifier — ${definition.label}`},modal:true,rejectClose:false,content:`<div class="add2e-dialog add2e-magic-power-parameter-form" style="min-width:560px;padding:10px;display:grid;gap:8px"><strong>${esc(definition.label)}</strong>${controls}</div>`,buttons:[{action:"save",label:"Enregistrer",icon:"fa-solid fa-check",default:true,callback:(_e,button,dialog)=>{const root=button?.form ?? dialog?.element,parameters={};for(const [name,schema] of entries){const input=root?.querySelector?.(`[name="${CSS.escape(name)}"]`);if(!input)continue;const value=read(input,schema);if(value!==undefined)parameters[name]=value;}const missing=missingParameters(definition,parameters);if(missing.length){ui.notifications.warn(`Paramètres obligatoires manquants : ${missing.join(", ")}.`);return false;}return parameters;}},{action:"cancel",label:"Annuler",icon:"fa-solid fa-xmark",callback:()=>null}]});
  return result && typeof result === "object" ? result : null;
}
async function editLegacy(power) {
  const DialogV2=foundry?.applications?.api?.DialogV2; if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable."),null;
  const name=String(power.name ?? power.nom ?? power.label ?? "Pouvoir").trim()||"Pouvoir",description=String(power.description ?? power.desc ?? ""),cost=Math.max(0,Number(power.cout ?? power.cost ?? power.chargeCost ?? 0)||0);
  return DialogV2.wait({window:{title:`Modifier — ${name}`},modal:true,rejectClose:false,content:`<div class="add2e-dialog" style="min-width:520px;padding:10px;display:grid;gap:8px"><label>Nom affiché<input name="name" value="${esc(name)}"></label><label>Coût en charges<input name="cost" type="number" min="0" step="1" value="${cost}"></label><label>Description<textarea name="description" rows="6">${esc(description)}</textarea></label><p>Le sort lié et son script d’exécution sont conservés.</p></div>`,buttons:[{action:"save",label:"Enregistrer",icon:"fa-solid fa-check",default:true,callback:(_e,button,dialog)=>{const root=button?.form ?? dialog?.element,nextName=String(root?.querySelector('[name="name"]')?.value ?? "").trim();if(!nextName){ui.notifications.warn("Le nom du pouvoir est obligatoire.");return false;}return {name:nextName,cost:Math.max(0,Math.trunc(Number(root?.querySelector('[name="cost"]')?.value ?? 0)||0)),description:String(root?.querySelector('[name="description"]')?.value ?? "")};}},{action:"cancel",label:"Annuler",icon:"fa-solid fa-xmark",callback:()=>null}]});
}
async function storePower(item,store,index,power) {
  if (store.object) { const next=clone(store.raw),key=store.keys[index]; if(key===undefined)return false; next[key]=power; await item.update({[store.path]:next},{add2eMagicItemBuilder:true,add2eMagicPowerSheetEditor:true}); }
  else { const next=store.entries.map(clone); if(!next[index])return false; next[index]=power; await item.update({[store.path]:next},{add2eMagicItemBuilder:true,add2eMagicPowerSheetEditor:true}); }
  return true;
}

async function editPower(itemUuid,powerIndex) {
  const item=await resolveItem(itemUuid); if(!item)return ui.notifications.error("L’objet magique est introuvable."),false; if(item.isOwner===false)return ui.notifications.warn("Tu ne peux pas modifier cet objet."),false;
  const store=powerStore(item),index=Number(powerIndex),power=Number.isInteger(index)?store.entries[index]:null; if(!power || typeof power!=="object")return ui.notifications.error("Le pouvoir sélectionné est introuvable."),false;
  let next;
  if (power.catalogueId) {
    if(typeof globalThis.add2eLoadMagicPowerCatalogue!=="function")return ui.notifications.error("Le catalogue de pouvoirs est indisponible."),false;
    const catalogue=await globalThis.add2eLoadMagicPowerCatalogue(),definition=catalogue?.powerById?.get?.(String(power.catalogueId)); if(!definition)return ui.notifications.error(`Pouvoir inconnu : ${power.catalogueId}.`),false;
    const parameters=await editCanonical(definition,power.parameters ?? {}); if(parameters===null)return false;
    next={...clone(power),schema:Number(power.schema ?? 2)||2,kind:"catalogue",catalogueId:definition.id,name:definition.label,label:definition.label,category:definition.category,automation:definition.automation,activation:clone(definition.activation ?? {}),parameters:clone(parameters),effects:resolveTemplates(definition.effects ?? [],parameters),effectTemplates:clone(definition.effects ?? []),compatibility:clone(definition.compatibility ?? {}),validation:clone(definition.validation ?? {}),source:clone(definition.source ?? {}),catalogue:{...clone(power.catalogue ?? {}),id:catalogue?.manifest?.catalogueId ?? catalogue?.manifest?.id ?? "add2e-gdm-magic-powers",version:catalogue?.manifest?.version ?? "",runtimeVersion:catalogue?.runtimeVersion ?? ""}};
  } else {
    const edited=await editLegacy(power); if(!edited || typeof edited!=="object")return false;
    next={...clone(power),name:edited.name,nom:edited.name,label:edited.name,description:edited.description,cout:edited.cost,cost:edited.cost};
  }
  if(!await storePower(item,store,index,next))return false;
  ui.notifications.info(`${next.name ?? next.nom ?? "Pouvoir"} a été mis à jour.`); item.sheet?.render?.({force:true}); return true;
}

Hooks.on("preCreateActor",(actor,data={})=>{const type=String(actor?.type ?? data?.type ?? "").trim().toLowerCase(),actorLink=defaultActorTokenLink(actor,data);if(actorLink===null)return;const prototypeToken={actorLink};if(type==="personnage")prototypeToken.sight={enabled:true,angle:270,range:defaultCharacterSightRange()};actor.updateSource({prototypeToken});});

export function add2eRegisterClassItemSheet() {
  const options={types:["classe"],makeDefault:true,canConfigure:true,canBeDefault:true,label:"ADD2E | Fiche Classe"},ItemsCollection=add2eItemsCollection();
  if(ItemsCollection?.registerSheet)ItemsCollection.registerSheet("add2e",Add2eItemSheet,options);else console.warn("[ADD2E][SHEETS] Collection Items introuvable : fiche classe non enregistrée.");
  const DSC=globalThis.DocumentSheetConfig ?? foundry?.applications?.apps?.DocumentSheetConfig,ItemDocument=add2eItemDocumentClass();
  if(DSC?.registerSheet && ItemDocument){try{DSC.registerSheet(ItemDocument,"add2e",Add2eItemSheet,options);}catch(e){console.warn("[ADD2E][SHEETS] DocumentSheetConfig classe non appliqué, fallback Items.registerSheet conservé.",e);}}
  console.log("[ADD2E][SHEETS] Fiche Item.classe enregistrée :",Add2eItemSheet?.name);
}
function registerHelper(){if(typeof Handlebars!=="undefined" && !Handlebars.helpers.add2eMagicSheetPowers)Handlebars.registerHelper("add2eMagicSheetPowers",item=>sheetPowers(item));}

globalThis.add2eRegisterClassItemSheet=add2eRegisterClassItemSheet;
globalThis.add2eMagicBuilderEditPower=editPower;
globalThis.add2eMagicBuilderSheetPowers=sheetPowers;
globalThis.ADD2E_MAGIC_POWER_SHEET_EDITOR_VERSION=EDITOR_VERSION;
registerHelper();
Hooks.once("init",()=>{registerHelper();console.log("ADD2e | Initialisation du système...");add2eRegisterClassItemSheet();});
