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

const ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = "2026-05-20-bracers-fixed-ca-sheet-v6-defensive-items-only";
globalThis.ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION = ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION;

function a2eN(...vals){for(const v of vals){if(v===undefined||v===null||v==="")continue;if(typeof v==="object"){const n=a2eN(v.value,v.current,v.actuel,v.total,v.max);if(Number.isFinite(n))return n;continue;}const n=Number(String(v).replace(",","."));if(Number.isFinite(n))return n;}return null;}
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
function a2eMagicDefense(actor,context={}){const items=[...(actor?.items??[])].filter(a2eEq),armors=items.filter(i=>["armure","armor"].includes(a2eType(i))),objects=items.filter(i=>!["armure","armor"].includes(a2eType(i))),worn=armors.filter(i=>!a2eShield(i)&&!a2eHelmet(i)),shields=armors.filter(a2eShield),helmets=armors.filter(a2eHelmet);let armorBase=10,armorName="Aucune",armorMagicBonus=0;for(const a of worn){const ac=a2eN(a.system?.ac,a.system?.ca,a.system?.armorClass,a.system?.base_ca,a.system?.baseAC);if(Number.isFinite(ac)&&ac<armorBase){armorBase=ac;armorName=a.name;armorMagicBonus=a2eBonus(a);}}let fixedCA=null,fixedSource="";for(const o of objects){const ca=a2eFixedCA(o);if(Number.isFinite(ca)&&(fixedCA===null||ca<fixedCA)){fixedCA=ca;fixedSource=o.name;}}const fixedCAActive=Number.isFinite(fixedCA);let shieldBonus=0,shieldSources=[];for(const sh of shields){const total=1+a2eBonus(sh);shieldBonus+=total;shieldSources.push(`${sh.name}:${total}`);}let helmetBonus=0;for(const h of helmets)helmetBonus+=Math.abs(a2eN(h.system?.ac,h.system?.ca,h.system?.armorClass)??0)+a2eBonus(h);let objectProtectionBonus=0,objectSources=[];for(const o of objects){if(a2eFixedCA(o)!==null)continue;if(!a2eProtectionItem(o))continue;const b=a2eBonus(o);if(b){objectProtectionBonus+=b;objectSources.push(`${o.name}:${b}`);}}const dex=a2eDex(actor),baseAfterFixed=fixedCAActive?fixedCA:armorBase,appliedArmorMagicBonus=fixedCAActive?0:armorMagicBonus,armorLayerCA=baseAfterFixed-appliedArmorMagicBonus,caNaturel=armorLayerCA+dex-shieldBonus-helmetBonus,caTotal=caNaturel-objectProtectionBonus;return{armorBase,armorName,armorMagicBonus:appliedArmorMagicBonus,ignoredArmorMagicBonus:fixedCAActive?armorMagicBonus:0,fixedCA,fixedSource,fixedCAActive,baseAfterFixed,armorLayerCA,dex,shieldBonus,shieldSources,helmetBonus,objectProtectionBonus,objectSources,caNaturel,caTotal,syntheticArmorAC:armorLayerCA-objectProtectionBonus,context,version:ADD2E_SHEET_MAGIC_DEFENSE_FIX_VERSION};}

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
      data.actor.system.ca_naturel=defense.caNaturel;
      data.actor.system.ca_total=defense.caTotal;
      if(this.actor.system.ca_total!==defense.caTotal||this.actor.system.ca_naturel!==defense.caNaturel)setTimeout(()=>this.actor.update({"system.ca_naturel":defense.caNaturel,"system.ca_total":defense.caTotal},{add2eInternal:true}),0);
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

if (globalThis.Add2eActorSheet?.prototype && !globalThis.Add2eActorSheet.prototype.__add2eOpenItemsFromNamesV2) {
  globalThis.Add2eActorSheet.prototype.__add2eOpenItemsFromNamesV2 = true;
  const originalActivateListeners = globalThis.Add2eActorSheet.prototype.activateListeners;
  globalThis.Add2eActorSheet.prototype.activateListeners = function add2eOpenItemNamesActivateListeners(html) {
    originalActivateListeners.call(this, html);
    const sheet = this;
    const root = add2eLegacyRoot(html);
    if (!root?.querySelectorAll) return;
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
