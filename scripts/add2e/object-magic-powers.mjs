function e(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function t(e){if(!e)return[];if(Array.isArray(e))return e.flatMap(e=>t(e)).filter(e=>null!=e&&""!==String(e).trim());if("string"==typeof e)return e.split(/[,;\n|]+/).map(e=>e.trim()).filter(Boolean);if(e&&"object"==typeof e)for(const a of["value","list","lists","items","tags","effectTags"])if(void 0!==e[a]&&null!==e[a])return t(e[a]);return[]}function a(e){return String(e??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"").replace(/[\s\-]+/g,"_").replace(/_+/g,"_")}export function add2eObjectPowerOnUsePath(e){return String(e?.onUse??e?.onuse??e?.on_use??e?.script??e?.macro??e?.objetMagicOnUse??e?.fallbackOnUse??e?.onUseSortPath??e?.linkedSpell?.onUse??e?.linkedSpell?.onuse??e?.linkedSpell?.on_use??"").trim()}export function add2eObjectPowerCost(e){return Math.max(0,Number(e?.cout??e?.cost??e?.chargeCost??0)||0)}export function add2eObjectPowerMaxCharges(e,t,a){const r=e?.system??{},i=add2eMagicReadNumber(r?.charges?.max,r?.charges?.maximum,r?.max_charges,r?.maxCharges,r?.chargesMax);return Number.isFinite(i)&&i>0?i:Number(t?.max??t?.chargesMax??t?.maxCharges??t?.charges?.max??t?.charges??1)||1}export function add2eObjectPowerCurrentCharges(e,t,a){const r=e?.system??{};if(add2eObjectPowerCost(t)<=0)return 1;const i=add2eMagicReadNumber(r?.charges?.max,r?.charges?.maximum,r?.max_charges,r?.maxCharges,r?.chargesMax);if(Number.isFinite(i)&&i>0){const t=add2eMagicReadNumber(r?.charges?.value,r?.charges?.current,r?.charges?.actuel,r?.charges?.remaining,r?.chargesValeur,r?.charges_value,r?.current_charges,r?.currentCharges,r?.charges_actuelles,r?.chargesRestantes,r?.remainingCharges);if(Number.isFinite(t))return Math.max(0,Math.min(t,i));const a=add2eMagicReadNumber(e.getFlag?.("add2e","global_charges"),e.getFlag?.("add2e","charges"));return Number.isFinite(a)?Math.max(0,Math.min(a,i)):i}const o=e.getFlag?.("add2e",`charges_${a}`);return null!=o&&""!==o?Number(o)||0:Number(t?.charges?.value??t?.charges??t?.value??t?.max??1)||0}export async function add2eObjectPowerSetCharges(e,t,a,r){const i=e?.system??{},o=add2eMagicReadNumber(i?.charges?.max,i?.charges?.maximum,i?.max_charges,i?.maxCharges,i?.chargesMax),n=Math.max(0,Number(r)||0);if(Number.isFinite(o)&&o>0)return i?.charges&&"object"==typeof i.charges&&await e.update({"system.charges.value":Math.min(n,o)}),void await(e.setFlag?.("add2e","global_charges",Math.min(n,o)));await(e.setFlag?.("add2e",`charges_${a}`,n))}export function add2eMagicPowerGeneratedId(e,t){return String(e?.id??"00000000000000").substring(0,14)+String(t).padStart(2,"0")}export function add2eBuildVirtualObjectPowerSort(e,t,a,r){const i=add2eMagicPowerGeneratedId(t,r),o=add2eObjectPowerOnUsePath(a),n=add2eObjectPowerCost(a),s=n<=0?Math.max(1,add2eObjectPowerMaxCharges(t,a,r)):add2eObjectPowerMaxCharges(t,a,r),c=n<=0?1:add2eObjectPowerCurrentCharges(t,a,r),d=a?.linkedSpell?.system&&"object"==typeof a.linkedSpell.system?foundry.utils.deepClone(a.linkedSpell.system):{},l={_id:i,name:String(a?.name??a?.nom??t?.name??"Pouvoir").trim()||"Pouvoir",type:"sort",img:a?.img||t?.img||"icons/svg/aura.svg",system:{...d,niveau:Number(a?.niveau??a?.level??d.niveau??d.level??1)||1,"école":a?.ecole||a?.["école"]||"Magique",description:a?.description||a?.desc||t?.system?.description||"",composantes:"Objet",temps_incantation:a?.activation||a?.temps_incantation||"Objet magique",isPower:!0,isObjectPower:!0,sourceItemId:t.id,sourceWeaponId:t.id,sourceItemName:t.name,powerIndex:r,cost:n,cout:n,max:s,isGlobalCharge:Number(t?.system?.charges?.max??t?.system?.max_charges??0)>0,onUse:o,onuse:o,on_use:o,objetMagicOnUse:a?.objetMagicOnUse||a?.fallbackOnUse||"",linkedSpell:a?.linkedSpell||null},flags:{add2e:{memorizedCount:c,originalOnUse:o,sourceType:"objet_magique",sourceItemId:t.id,sourceItemName:t.name,powerIndex:r}}},u=new Item(l,{parent:e});return u.getFlag=(e,i)=>"add2e"!==e?null:"memorizedCount"===i?n<=0?1:add2eObjectPowerCurrentCharges(t,a,r):"originalOnUse"===i?o:l.flags?.add2e?.[i]??null,u}export async function add2eExecuteObjectMagicPower(e,t,a,r,i=null){if(!e||!t||!a)return ui.notifications.error("Pouvoir d'objet magique introuvable."),!1;const o=String(a?.name??a?.nom??t.name??"Pouvoir").trim()||"Pouvoir",n=add2eObjectPowerOnUsePath(a),s=add2eObjectPowerCost(a),c=add2eObjectPowerCurrentCharges(t,a,r);if(!n)return ui.notifications.warn(`${o} n'a pas de script utilisable.`),!1;if(s>0&&c<s)return ui.notifications.warn(`${t.name} n'a pas assez de charges pour utiliser ${o}.`),!1;const d=add2eBuildVirtualObjectPowerSort(e,t,a,r);try{let o=!0;const l=n.includes("?")?`${n}&cb=${Date.now()}`:`${n}?cb=${Date.now()}`,u=await fetch(l);if(!u.ok)throw new Error(`${u.status} ${u.statusText}`);const g=await u.text(),m=Object.getPrototypeOf(async function(){}).constructor,p={actor:e,item:t,sourceItem:t,sort:d,power:a,pouvoir:a,powerIndex:r,isObjectPower:!0},b=[{actor:e,item:t,sourceItem:t,sort:d,power:a,pouvoir:a,powerIndex:r,scope:p}],f=new m("actor","item","sourceItem","sort","power","pouvoir","powerIndex","scope","args","game","ui","ChatMessage","Roll","foundry","canvas",g);return o=await f(e,t,t,d,a,a,r,p,b,game,ui,ChatMessage,Roll,foundry,canvas),!1!==o&&s>0&&await add2eObjectPowerSetCharges(t,a,r,c-s),!1!==o&&(i?._add2eRememberActiveTab?.(),i?.render?.(!1),!0)}catch(a){return console.error("[ADD2E][OBJET_MAGIQUE][POUVOIR_ERREUR]",{actor:e.name,item:t.name,power:o,onUse:n,err:a}),ui.notifications.error(`Erreur pendant l'utilisation de ${o} : ${a.message}`),!1}}export function add2eMagicItemEquippedOrUsable(e){const r=e?.system??{};return!!function(e){if("objet"!==String(e?.type??"").toLowerCase())return!1;const r=e?.system??{};return[r.sousType,r.sous_type,r.typeObjet,r.type_objet,r.categorie,r.category,r.forme,r.kind,...t(r.tags),...t(r.effectTags),e?.flags?.add2e?.kind,e?.flags?.add2e?.category].map(a).filter(Boolean).some(e=>"potion"===e||e.startsWith("potion_")||e.endsWith("_potion")||e.includes("consommable_potion"))}(e)||(!0===r.equipee||!0===r.equipped)}export function add2eMagicObjectRawPowers(e){if(!add2eMagicItemEquippedOrUsable(e))return[];const t=e?.system??{};return t.pouvoirs??t.powers??t.pouvoirsMagiques??t.magicalPowers??t.sorts??t.spells??[]}export function add2eMagicObjectPowerArray(e){const t=add2eMagicObjectRawPowers(e);return Array.isArray(t)?t.filter(e=>e&&"object"==typeof e):t&&"object"==typeof t?Object.values(t).filter(e=>e&&"object"==typeof e):[]}export function add2eMagicObjectActivePowerEntries(e){return add2eMagicObjectPowerArray(e).map((e,t)=>({power:e,index:t})).filter(e=>add2eObjectPowerOnUsePath(e.power))}export function add2eMagicReadNumber(...e){for(const t of e){if(null==t||""===t)continue;if("object"==typeof t){const e=add2eMagicReadNumber(t.value,t.current,t.actuel,t.max);if(Number.isFinite(e))return e;continue}const e=Number(t);if(Number.isFinite(e))return e}return NaN}export function add2eMagicObjectChargeInfo(e,t=null){const a=e?.system??{},r=t??add2eMagicObjectPowerArray(e);let i=add2eMagicReadNumber(...[a.charges?.max,a.charges?.maximum,a.max_charges,a.maxCharges,a.charges_max,a.chargesMax,a.max,...r.map(e=>e.max??e.maxCharges??e.chargesMax??e.charges_max)]);(!Number.isFinite(i)||i<0)&&(i=0);let o=add2eMagicReadNumber(...[a.charges?.value,a.charges?.current,a.charges?.actuel,a.charges?.remaining,a.current_charges,a.currentCharges,a.charges_actuelles,a.chargesRestantes,a.remainingCharges,e?.getFlag?.("add2e","global_charges"),e?.getFlag?.("add2e","charges")]);return Number.isFinite(o)||(o=i),i>0&&(o=Math.max(0,Math.min(o,i))),{current:o,max:i,label:i>0?`${o}/${i}`:"—"}}export function add2eMagicLooksMagical(e){const r=e?.system??{},i=t(r.tags??r.effectTags??r.effets??r.effects).map(a),o=String(e?.name??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");return i.some(e=>e.includes("magique")||e.includes("magic"))||o.includes("magique")||!0===r.magique||!0===r.magic}export function add2eUiCollectObjectMagicGroups(e){const t=[],a=e?.items?.filter?.(e=>{const t=String(e?.type??"").toLowerCase();return!!["arme","armure","objet","object","magic","objet_magique"].includes(t)&&(!!add2eMagicItemEquippedOrUsable(e)&&add2eMagicObjectActivePowerEntries(e).length>0)})??[];for(const e of a){const a=add2eMagicObjectActivePowerEntries(e);if(!a.length)continue;const r=add2eMagicObjectChargeInfo(e,a.map(e=>e.power)),i=Number(r.max)||0,o=i>0,n=[];for(const{power:t,index:s}of a){const a=o?i:Number(t.max??t.maxCharges??t.chargesMax??t.charges_max??e.system?.charges??1)||1,c=o?r.current:e.getFlag?.("add2e",`charges_${s}`)??t.charges??e.system?.charges??a;n.push({id:add2eMagicPowerGeneratedId(e,s),name:String(t.name||t.nom||e.name||"Pouvoir").trim()||"Pouvoir",img:t.img||e.img||"icons/svg/aura.svg",sourceItemId:e.id,sourceName:e.name||"Objet magique",sourceImg:e.img||"icons/svg/item-bag.svg",niveau:Number(t.niveau??t.level??1)||1,description:t.description||t.desc||"",charges:Number(c)||0,max:a,cost:Number(t.cout??t.cost??0)||0})}t.push({itemId:e.id,itemName:e.name||"Objet magique",itemImg:e.img||"icons/svg/item-bag.svg",charges:r.current,max:r.max,chargeLabel:r.label,powers:n.sort((e,t)=>String(e.name).localeCompare(String(t.name),"fr"))})}return t.sort((e,t)=>String(e.itemName).localeCompare(String(t.itemName),"fr"))}export function add2eUiCollectObjectMagicPowers(e){return add2eUiCollectObjectMagicGroups(e).flatMap(e=>e.powers)}export function add2eUiBuildObjectMagicSection(t){const a=add2eUiCollectObjectMagicGroups(t);return`<section class="a2e-panel add2e-object-magic-panel"><h2><i class="fas fa-wand-sparkles"></i> Objets magiques</h2><div class="a2e-panel-body">${a.length?a.map(t=>{const a=t.powers.length?t.powers.map(t=>`\n      <tr class="add2e-object-magic-power-row" data-sort-id="${e(t.id)}">\n        <td style="width:46px;text-align:center;"><img class="sort-cast-img add2e-object-magic-cast" data-sort-id="${e(t.id)}" src="${e(t.img)}" title="Utiliser ${e(t.name)}" style="width:32px;height:32px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;cursor:pointer;"></td>\n        <td><strong>${e(t.name)}</strong><br><small>Niveau ${Number(t.niveau)||1}${t.cost?` — coût ${Number(t.cost)}`:""}</small></td>\n        <td class="a2e-small">${t.description||""}</td>\n      </tr>`).join(""):'<tr><td colspan="3" class="a2e-muted" style="text-align:center;padding:0.6em;">Aucun pouvoir détaillé.</td></tr>';return`<div class="add2e-object-magic-group" data-item-id="${e(t.itemId)}" style="border:1px solid #d9bf73;border-radius:9px;margin-bottom:8px;background:#fffdf6;overflow:hidden;"><div class="add2e-object-magic-header" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#ead99d;border-bottom:1px solid #dac276;color:#3d2b0a;font-weight:900;"><img src="${e(t.itemImg)}" alt="" style="width:28px;height:28px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;"><span style="flex:1;">${e(t.itemName)}</span><span title="Charges restantes / charges maximum" style="padding:2px 8px;border:1px solid #9f7a24;border-radius:999px;background:#fffaf0;white-space:nowrap;">Charges ${e(t.chargeLabel)}</span></div><table class="a2e-table add2e-object-magic-table" style="margin:0;"><thead><tr><th style="width:46px;">Utiliser</th><th>Pouvoir</th><th>Description</th></tr></thead><tbody>${a}</tbody></table></div>`}).join(""):'<div class="a2e-muted" style="text-align:center;padding:0.8em;border:1px solid #dac276;border-radius:9px;background:#fffdf6;">Aucun objet magique doté d’un pouvoir utilisable.</div>'}</div></section>`}export function add2eUiInjectObjectMagicSection(e,t){if(!e||!t)return;if(e.matches?.(".item, a.item, .sheet-tabs, .tabs, nav"))return;e.querySelectorAll(".add2e-object-magic-panel").forEach(e=>e.remove());const a=add2eUiBuildObjectMagicSection(t);if(!a)return;const r=document.createElement("div");r.innerHTML=a.trim();const i=r.firstElementChild;if(!i)return;const o=e.querySelector(".a2e-spellcasting-summary"),n=Array.from(e.querySelectorAll(".a2e-panel")).find(e=>e.querySelector?.("table.sort-table"));o?e.insertBefore(i,o.nextElementSibling||n||null):n?e.insertBefore(i,n):e.insertBefore(i,e.firstElementChild||null)}function r(e){if("objet"!==String(e?.type??"").toLowerCase())return!1;return"potion_vide"===a(e?.system?.sousType??e?.system?.sous_type??"")||!0===e?.flags?.add2e?.emptyPotion}function i(e){const t=e?.system??{};return String(t.onUse??t.onuse??t.on_use??"").trim()}async function o(e,t){if("sort"!==String(t?.type??"").toLowerCase())return ui.notifications.warn("Déposez un Item de type sort dans la potion."),!1;if(!0===t.system?.isPower||!0===t.system?.isObjectPower||!0===t.system?.isCapacity||!0===t.flags?.add2e?.spellFamily?.generated)return ui.notifications.warn("Les pouvoirs, capacités et variantes générées ne peuvent pas être placés dans une potion."),!1;if(!i(t))return ui.notifications.warn(`${t.name} ne possède aucun script onUse utilisable.`),!1;if(add2eMagicObjectPowerArray(e).length)return ui.notifications.warn("Cette potion contient déjà un sort. Retirez-le avant d'en déposer un autre."),!1;const a=function(e){const t=e?.system??{},a=i(e),r=String(e?.flags?.core?.sourceId??e?._stats?.compendiumSource??e?.uuid??"").trim();return{name:e.name,nom:e.name,img:e.img||"icons/svg/potion.svg",niveau:Math.max(1,Number(t.niveau??t.level??t.niveau_sort??t.spellLevel??1)||1),description:String(t.description??""),activation:String(t.temps_incantation??t.castingTime??"Boire la potion"),onUse:a,onuse:a,on_use:a,objetMagicOnUse:String(t.objetMagicOnUse??t.fallbackOnUse??"").trim(),cout:1,cost:1,max:1,linkedSpell:{sourceUuid:r,name:e.name,niveau:Math.max(1,Number(t.niveau??t.level??t.niveau_sort??t.spellLevel??1)||1),img:e.img||"icons/svg/aura.svg",system:foundry.utils.deepClone(t),flags:foundry.utils.deepClone(e.flags??{}),onUse:a,onuse:a,on_use:a}}}(t);return await e.update({"system.pouvoirs":[a],"system.magique":!0,"system.consommable":!0,"system.charges.value":1,"system.charges.max":1,"system.charges.mode":"consommable","system.activation":"Boire la potion","flags.add2e.emptyPotion":!0,"flags.add2e.containedSpellUuid":a.linkedSpell.sourceUuid,"flags.add2e.containedSpellName":a.name},{add2eInternal:!0,add2eEmptyPotion:!0,render:!1}),await(e.setFlag?.("add2e","global_charges",1)),ui.notifications.info(`${t.name} a été placé dans ${e.name}.`),!0}function n(t,a){const i=t?.item??t?.document??t?.object??null;if(!r(i))return;const n=function(e,t){if(e instanceof HTMLElement)return e;if(e?.[0]instanceof HTMLElement)return e[0];const a=t?.element;return a?.jquery?a[0]:a}(a,t);if(!n?.querySelector||n.querySelector(".add2e-empty-potion-panel"))return;const s=n.querySelector('[data-tab="pouvoirs"].content, .content[data-tab="pouvoirs"], .tab[data-tab="pouvoirs"]');if(!s)return;const c=add2eMagicObjectPowerArray(i)[0]??null,d=document.createElement("fieldset");d.className="add2e-empty-potion-panel",d.style.cssText="margin:0 0 12px;border:1px solid #d0b16b;border-radius:7px;padding:10px;background:#fffaf0;",d.innerHTML=c?`\n    <legend>Potion contenant un sort</legend>\n    <div style="display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;">\n      <img src="${e(c.img||i.img||"icons/svg/potion.svg")}" alt="" width="40" height="40" style="object-fit:cover;border:1px solid #8b6d2a;border-radius:6px;">\n      <div><b>${e(c.name??c.nom??"Sort")}</b><br><small>Niveau ${Number(c.niveau??c.level??1)||1} — cible choisie normalement dans Foundry</small></div>\n      <button type="button" class="add2e-empty-potion-remove" title="Retirer le sort"><i class="fas fa-trash"></i></button>\n    </div>`:'\n    <legend>Potion vide</legend>\n    <div class="add2e-empty-potion-drop" tabindex="0" style="display:grid;place-items:center;min-height:96px;padding:14px;border:2px dashed #9b7434;border-radius:8px;background:#fff8e7;text-align:center;cursor:copy;">\n      <div><i class="fas fa-flask" style="font-size:1.5rem;"></i><p style="margin:6px 0 0;"><b>Déposez ici un sort</b></p><p style="margin:3px 0 0;">La potion conservera le ciblage normal du sort.</p></div>\n    </div>',s.prepend(d);const l=d.querySelector(".add2e-empty-potion-drop");if(l){const e=()=>{l.style.background="#fff8e7"};l.addEventListener("dragenter",e=>{e.preventDefault(),e.stopPropagation(),l.style.background="#eef7e7"}),l.addEventListener("dragover",e=>{e.preventDefault(),e.stopPropagation(),e.dataTransfer&&(e.dataTransfer.dropEffect="copy"),l.style.background="#eef7e7"}),l.addEventListener("dragleave",e),l.addEventListener("drop",async a=>{a.preventDefault(),a.stopPropagation(),e();try{const e=await async function(e){let t=null;const a=foundry?.applications?.ux?.TextEditor?.implementation??globalThis.TextEditor??null;try{t=a?.getDragEventData?.(e)??null}catch(e){}if(!t)try{t=JSON.parse(e?.dataTransfer?.getData?.("text/plain")||"null")}catch(e){t=null}if(!t||t.type&&"Item"!==t.type)return null;if(t.uuid&&"function"==typeof fromUuid)try{const e=await fromUuid(t.uuid);if("Item"===e?.documentName)return e}catch(e){}const r=CONFIG?.Item?.documentClass;if("function"==typeof r?.fromDropData)try{const e=await r.fromDropData(t);if("Item"===e?.documentName)return e}catch(e){}if(t.pack&&(t.id||t._id))try{return await(game.packs?.get?.(t.pack)?.getDocument?.(t.id??t._id))??null}catch(e){}return null}(a);if(!e)return ui.notifications.warn("Le sort déposé est introuvable.");await o(i,e)&&t.render?.({force:!0})}catch(e){console.error("[ADD2E][EMPTY_POTION][DROP_ERROR]",{item:i?.name,error:e}),ui.notifications.error(e?.message||"Erreur pendant le remplissage de la potion.")}})}d.querySelector(".add2e-empty-potion-remove")?.addEventListener("click",async a=>{a.preventDefault(),a.stopPropagation();try{await async function(t){const a=add2eMagicObjectPowerArray(t)[0]??null;if(!a)return!1;const r=foundry?.applications?.api?.DialogV2;return r?.confirm?!!await r.confirm({window:{title:`Retirer ${a.name??a.nom??"le sort"}`},content:`<div class="add2e-dialog" style="min-width:420px;padding:8px;"><p>Retirer <b>${e(a.name??a.nom??"ce sort")}</b> de <b>${e(t.name)}</b> ?</p><p>La potion redeviendra vide.</p></div>`,yes:{label:"Retirer le sort",icon:"fa-solid fa-flask"},no:{label:"Annuler",icon:"fa-solid fa-xmark"},modal:!0})&&(await t.update({"system.pouvoirs":[],"system.charges.value":0,"system.charges.max":1,"flags.add2e.containedSpellUuid":null,"flags.add2e.containedSpellName":null},{add2eInternal:!0,add2eEmptyPotion:!0,render:!1}),await(t.setFlag?.("add2e","global_charges",0)),!0):(ui.notifications.error("DialogV2 est introuvable."),!1)}(i)&&t.render?.({force:!0})}catch(e){console.error("[ADD2E][EMPTY_POTION][REMOVE_ERROR]",{item:i?.name,error:e}),ui.notifications.error(e?.message||"Erreur pendant le retrait du sort.")}})}Hooks.on("renderAdd2eObjetSheet",n),Hooks.on("renderApplicationV2",(e,t)=>{const a=e?.item??e?.document??e?.object??null;"Item"===a?.documentName&&r(a)&&n(e,t)}),globalThis.add2eObjectPowerOnUsePath=add2eObjectPowerOnUsePath,globalThis.add2eObjectPowerCost=add2eObjectPowerCost,globalThis.add2eObjectPowerMaxCharges=add2eObjectPowerMaxCharges,globalThis.add2eObjectPowerCurrentCharges=add2eObjectPowerCurrentCharges,globalThis.add2eObjectPowerSetCharges=add2eObjectPowerSetCharges,globalThis.add2eBuildVirtualObjectPowerSort=add2eBuildVirtualObjectPowerSort,globalThis.add2eExecuteObjectMagicPower=add2eExecuteObjectMagicPower,globalThis.add2eMagicItemEquippedOrUsable=add2eMagicItemEquippedOrUsable,globalThis.add2eMagicObjectRawPowers=add2eMagicObjectRawPowers,globalThis.add2eMagicObjectPowerArray=add2eMagicObjectPowerArray,globalThis.add2eMagicObjectActivePowerEntries=add2eMagicObjectActivePowerEntries,globalThis.add2eMagicReadNumber=add2eMagicReadNumber,globalThis.add2eMagicObjectChargeInfo=add2eMagicObjectChargeInfo,globalThis.add2eMagicLooksMagical=add2eMagicLooksMagical,globalThis.add2eMagicPowerGeneratedId=add2eMagicPowerGeneratedId,globalThis.add2eUiCollectObjectMagicGroups=add2eUiCollectObjectMagicGroups,globalThis.add2eUiCollectObjectMagicPowers=add2eUiCollectObjectMagicPowers,globalThis.add2eUiBuildObjectMagicSection=add2eUiBuildObjectMagicSection,globalThis.add2eUiInjectObjectMagicSection=add2eUiInjectObjectMagicSection;

// ADD2E — Constructeur commun d'armes, armures et objets magiques.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

const ADD2E_MAGIC_ITEM_BUILDER_VERSION = "2026-07-21-magic-item-builder-v5-creator-profiles";
const ADD2E_MAGIC_ITEM_TYPES = new Set(["arme", "armure", "objet"]);

function add2eMagicBuilderClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
}

function add2eMagicBuilderEscape(value) {
  const text = String(value ?? "");
  try {
    if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
  } catch (_error) {}
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eMagicBuilderType(item) {
  return String(item?.type ?? "").trim().toLowerCase();
}

function add2eMagicBuilderSupported(item) {
  return ADD2E_MAGIC_ITEM_TYPES.has(add2eMagicBuilderType(item));
}

function add2eMagicBuilderArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eMagicBuilderArray);
  if (value instanceof Set) return [...value].flatMap(add2eMagicBuilderArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(add2eMagicBuilderArray);
  return [String(value)];
}

function add2eMagicBuilderNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function add2eMagicBuilderOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function add2eMagicBuilderSigned(value) {
  const number = add2eMagicBuilderNumber(value, 0);
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eMagicBuilderGetProperty(object, path) {
  try { return foundry.utils.getProperty(object, path); }
  catch (_error) { return String(path).split(".").reduce((current, key) => current?.[key], object); }
}

function add2eMagicBuilderSetProperty(object, path, value) {
  try { return foundry.utils.setProperty(object, path, value); }
  catch (_error) {
    const parts = String(path).split(".");
    let current = object;
    while (parts.length > 1) {
      const key = parts.shift();
      current[key] ??= {};
      current = current[key];
    }
    current[parts[0]] = value;
    return true;
  }
}

function add2eMagicBuilderMerge(base, update) {
  try {
    return foundry.utils.mergeObject(add2eMagicBuilderClone(base ?? {}), add2eMagicBuilderClone(update ?? {}), {
      inplace: false,
      insertKeys: true,
      overwrite: true,
      recursive: true
    });
  } catch (_error) {
    return { ...(base ?? {}), ...(update ?? {}) };
  }
}

function add2eMagicBuilderDefaultApplication(itemOrType) {
  const type = typeof itemOrType === "string" ? itemOrType : add2eMagicBuilderType(itemOrType);
  return type === "arme" ? "source" : "porteur";
}

function add2eMagicBuilderEnchantment(item, systemOverride = null) {
  const system = systemOverride ?? item?.system ?? {};
  const hasRawEnchantement = Boolean(
    system.enchantement
    && typeof system.enchantement === "object"
    && !Array.isArray(system.enchantement)
  );
  const raw = hasRawEnchantement ? system.enchantement : {};
  const baseStats = raw.baseStats && typeof raw.baseStats === "object" ? raw.baseStats : {};
  const type = add2eMagicBuilderType(item);
  const legacyToucher = type === "arme"
    ? system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus
    : system.bonus_toucher ?? system.bonus_hit ?? system.attack_bonus;
  const legacyDegats = type === "arme"
    ? system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus
    : system.bonus_degats ?? system.bonus_dom ?? system.damage_bonus;
  const legacyBonusCA = system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus;
  const legacyCAFixe = system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac;

  return {
    schema: 1,
    baseUuid: String(raw.baseUuid ?? item?.flags?.add2e?.baseItemUuid ?? "").trim(),
    baseName: String(raw.baseName ?? item?.flags?.add2e?.baseItemName ?? "").trim(),
    baseType: String(raw.baseType ?? item?.flags?.add2e?.baseItemType ?? "").trim(),
    application: ["source", "porteur"].includes(String(raw.application ?? "").trim())
      ? String(raw.application).trim()
      : add2eMagicBuilderDefaultApplication(item),
    bonusToucher: add2eMagicBuilderNumber(
      raw.bonusToucher ?? raw.bonus_toucher ?? (hasRawEnchantement ? 0 : legacyToucher),
      0
    ),
    bonusDegats: add2eMagicBuilderNumber(
      raw.bonusDegats ?? raw.bonus_degats ?? (hasRawEnchantement ? 0 : legacyDegats),
      0
    ),
    bonusCA: add2eMagicBuilderNumber(
      raw.bonusCA ?? raw.bonus_ca ?? (hasRawEnchantement ? 0 : legacyBonusCA),
      0
    ),
    caFixe: add2eMagicBuilderOptionalNumber(
      raw.caFixe ?? raw.ca_fixe ?? (hasRawEnchantement ? null : legacyCAFixe)
    ),
    baseStats: {
      bonusToucher: add2eMagicBuilderNumber(baseStats.bonusToucher, 0),
      bonusDegats: add2eMagicBuilderNumber(baseStats.bonusDegats, 0),
      bonusCA: add2eMagicBuilderNumber(baseStats.bonusCA, 0),
      caFixe: add2eMagicBuilderOptionalNumber(baseStats.caFixe)
    }
  };
}

function add2eMagicBuilderReadBaseStats(item) {
  const system = item?.system ?? {};
  return {
    bonusToucher: add2eMagicBuilderNumber(
      system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus,
      0
    ),
    bonusDegats: add2eMagicBuilderNumber(
      system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus,
      0
    ),
    bonusCA: add2eMagicBuilderNumber(
      system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus,
      0
    ),
    caFixe: add2eMagicBuilderOptionalNumber(
      system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac
    )
  };
}

function add2eMagicBuilderNormalizeTag(value) {
  return String(value ?? "").trim();
}

function add2eMagicBuilderMergeUniqueValues(...values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    for (const value of add2eMagicBuilderArray(raw)) {
      const text = String(value ?? "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

function add2eMagicBuilderSyncUpdate(item, change) {
  if (!add2eMagicBuilderSupported(item) || !change || typeof change !== "object") return;

  const touchesEnchantement = add2eMagicBuilderGetProperty(change, "system.enchantement") !== undefined;
  const touchesLegacyBuilder = [
    "system.bonus_hit", "system.bonus_dom", "system.bonus_toucher", "system.bonus_degats",
    "system.bonus_ac", "system.bonus_ca", "system.ca_fixe", "system.caFixe"
  ].some(path => add2eMagicBuilderGetProperty(change, path) !== undefined);
  if (!touchesEnchantement && !touchesLegacyBuilder) return;

  const mergedSystem = add2eMagicBuilderMerge(item.system ?? {}, change.system ?? {});
  const enchantement = add2eMagicBuilderEnchantment(item, mergedSystem);
  const type = add2eMagicBuilderType(item);
  const base = enchantement.baseStats;
  const sourceMode = enchantement.application === "source";

  if (type === "arme") {
    add2eMagicBuilderSetProperty(change, "system.bonus_hit", base.bonusToucher + (sourceMode ? enchantement.bonusToucher : 0));
    add2eMagicBuilderSetProperty(change, "system.bonus_dom", base.bonusDegats + (sourceMode ? enchantement.bonusDegats : 0));
  } else {
    add2eMagicBuilderSetProperty(change, "system.bonus_toucher", enchantement.bonusToucher);
    add2eMagicBuilderSetProperty(change, "system.bonus_degats", enchantement.bonusDegats);
  }

  add2eMagicBuilderSetProperty(change, "system.bonus_ac", base.bonusCA + enchantement.bonusCA);
  add2eMagicBuilderSetProperty(change, "system.ca_fixe", enchantement.caFixe ?? base.caFixe ?? null);

  const previousGenerated = new Set(
    add2eMagicBuilderArray(item.flags?.add2e?.magicItemBuilder?.generatedTags)
      .map(add2eMagicBuilderNormalizeTag)
      .filter(Boolean)
  );
  const existingTags = add2eMagicBuilderArray(mergedSystem.effectTags ?? mergedSystem.effets ?? mergedSystem.effects)
    .map(add2eMagicBuilderNormalizeTag)
    .filter(Boolean)
    .filter(tag => !previousGenerated.has(tag));
  const generatedTags = [];

  if (enchantement.application === "porteur") {
    if (enchantement.bonusToucher) generatedTags.push(`bonus_attaque:${add2eMagicBuilderSigned(enchantement.bonusToucher)}`);
    if (enchantement.bonusDegats) generatedTags.push(`bonus_degats:${add2eMagicBuilderSigned(enchantement.bonusDegats)}`);
  }

  add2eMagicBuilderSetProperty(change, "system.effectTags", [...new Set([...existingTags, ...generatedTags])]);
  add2eMagicBuilderSetProperty(change, "system.enchantement", enchantement);
  add2eMagicBuilderSetProperty(change, "flags.add2e.magicItemBuilder", {
    version: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    generatedTags
  });

  const powers = mergedSystem.pouvoirs ?? mergedSystem.powers ?? [];
  const chargeMax = add2eMagicBuilderNumber(mergedSystem.charges?.max, 0);
  const isMagic = Boolean(
    enchantement.baseUuid
    || enchantement.bonusToucher
    || enchantement.bonusDegats
    || enchantement.bonusCA
    || enchantement.caFixe !== null
    || add2eMagicBuilderArray(powers).length
    || chargeMax > 0
  );
  if (isMagic) add2eMagicBuilderSetProperty(change, "system.magique", true);
}

function add2eMagicBuilderCopyPaths(sourceSystem, targetUpdate, paths) {
  for (const path of paths) {
    const value = add2eMagicBuilderGetProperty(sourceSystem, path);
    if (value === undefined) continue;
    add2eMagicBuilderSetProperty(targetUpdate, `system.${path}`, add2eMagicBuilderClone(value));
  }
}

function add2eMagicBuilderBasePaths(type) {
  if (type === "arme") {
    return [
      "type", "categorie", "famille", "famille_arme", "facteur_rapidité", "facteur_rapidite",
      "type_degats", "degats", "dégâts", "ajustement_ca", "portee_courte", "portee_moyenne",
      "portee_longue", "poids", "deuxMains", "arme_de_jet", "encombrante", "proprietes",
      "properties", "tags", "effectTags"
    ];
  }
  if (type === "armure") {
    return [
      "ac", "ca", "armorClass", "categorie", "properties", "proprietes", "poids", "weight",
      "prix", "cost", "materiau", "type_armure", "structure", "bouclier", "tags", "effectTags"
    ];
  }
  return [
    "categorie", "sousType", "sous_type", "quantite", "poids", "prix", "activation", "cible",
    "duree", "tags", "effectTags"
  ];
}

async function add2eMagicBuilderResolveItem(value) {
  if (!value) return null;
  if (value.documentName === "Item") return value;
  if (typeof value === "string" && typeof fromUuid === "function") {
    try {
      const item = await fromUuid(value);
      if (item?.documentName === "Item") return item;
    } catch (_error) {}
  }
  return null;
}

async function add2eMagicBuilderResolveDrop(event) {
  let data = null;
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor ?? null;
  try { data = editor?.getDragEventData?.(event) ?? null; } catch (_error) {}
  if (!data) {
    try { data = JSON.parse(event?.dataTransfer?.getData?.("text/plain") || "null"); }
    catch (_error) { data = null; }
  }
  if (!data || (data.type && data.type !== "Item")) return null;
  if (data.uuid) {
    const item = await add2eMagicBuilderResolveItem(data.uuid);
    if (item) return item;
  }
  if (typeof CONFIG?.Item?.documentClass?.fromDropData === "function") {
    try {
      const item = await CONFIG.Item.documentClass.fromDropData(data);
      if (item?.documentName === "Item") return item;
    } catch (_error) {}
  }
  if (data.pack && data.id) {
    try { return await game.packs?.get?.(data.pack)?.getDocument?.(data.id) ?? null; }
    catch (_error) {}
  }
  return null;
}

async function add2eMagicBuilderConfirm(title, content, yesLabel = "Confirmer") {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  return await DialogV2.wait({
    window: { title },
    modal: true,
    rejectClose: false,
    content,
    buttons: [
      { action: "yes", label: yesLabel, icon: "fa-solid fa-check", default: true, callback: () => true },
      { action: "no", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }
    ]
  }) === true;
}

async function add2eMagicBuilderApplyBase(targetItem, baseItem) {
  if (!add2eMagicBuilderSupported(targetItem) || !add2eMagicBuilderSupported(baseItem)) {
    ui.notifications.warn("La base doit être une arme, une armure ou un objet ADD2E.");
    return false;
  }
  const targetType = add2eMagicBuilderType(targetItem);
  const baseType = add2eMagicBuilderType(baseItem);
  if (targetType !== baseType) {
    ui.notifications.warn(`Une ${targetType} doit utiliser une base du même type.`);
    return false;
  }
  if (targetItem.uuid === baseItem.uuid) {
    ui.notifications.warn("Un objet ne peut pas être sa propre base.");
    return false;
  }

  const currentTags = add2eMagicBuilderArray(targetItem.system?.tags);
  const currentEffectTags = add2eMagicBuilderArray(
    targetItem.system?.effectTags ?? targetItem.system?.effets ?? targetItem.system?.effects
  );
  const update = {};
  add2eMagicBuilderCopyPaths(baseItem.system ?? {}, update, add2eMagicBuilderBasePaths(targetType));
  add2eMagicBuilderSetProperty(
    update,
    "system.tags",
    add2eMagicBuilderMergeUniqueValues(add2eMagicBuilderGetProperty(update, "system.tags"), currentTags)
  );
  add2eMagicBuilderSetProperty(
    update,
    "system.effectTags",
    add2eMagicBuilderMergeUniqueValues(add2eMagicBuilderGetProperty(update, "system.effectTags"), currentEffectTags)
  );

  const currentEnchantement = add2eMagicBuilderEnchantment(targetItem);
  const nextEnchantement = {
    ...currentEnchantement,
    schema: 1,
    baseUuid: String(baseItem.uuid ?? ""),
    baseName: String(baseItem.name ?? "Base"),
    baseType,
    baseStats: add2eMagicBuilderReadBaseStats(baseItem)
  };
  add2eMagicBuilderSetProperty(update, "system.enchantement", nextEnchantement);
  add2eMagicBuilderSetProperty(update, "flags.add2e.baseItemUuid", nextEnchantement.baseUuid);
  add2eMagicBuilderSetProperty(update, "flags.add2e.baseItemName", nextEnchantement.baseName);
  add2eMagicBuilderSetProperty(update, "flags.add2e.baseItemType", nextEnchantement.baseType);
  add2eMagicBuilderSetProperty(update, "flags.add2e.magicItemBuilderVersion", ADD2E_MAGIC_ITEM_BUILDER_VERSION);

  const currentDescription = String(targetItem.system?.description ?? "").trim();
  if (!currentDescription && String(baseItem.system?.description ?? "").trim()) {
    add2eMagicBuilderSetProperty(update, "system.description", baseItem.system.description);
  }
  if (baseItem.img) update.img = baseItem.img;

  await targetItem.update(update, { add2eMagicItemBuilder: true, add2eInternal: true });
  ui.notifications.info(`${targetItem.name} utilise maintenant ${baseItem.name} comme base.`);
  targetItem.sheet?.render?.({ force: true });
  return true;
}

async function add2eMagicBuilderCollectBases(type, currentUuid = "") {
  const groups = [];
  const world = [...(game.items ?? [])]
    .filter(item => add2eMagicBuilderType(item) === type && item.uuid !== currentUuid)
    .map(item => ({ uuid: item.uuid, name: item.name, img: item.img }));
  if (world.length) groups.push({ label: "Monde", entries: world });

  for (const pack of game.packs ?? []) {
    if (String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;
    let index = null;
    try { index = await pack.getIndex({ fields: ["name", "type", "img"] }); }
    catch (_error) { continue; }
    const entries = [...(index ?? [])]
      .filter(entry => String(entry.type ?? "").toLowerCase() === type)
      .map(entry => ({
        uuid: entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`,
        name: entry.name,
        img: entry.img
      }));
    if (entries.length) groups.push({ label: pack.title ?? pack.metadata?.label ?? pack.collection, entries });
  }
  return groups;
}

async function add2eMagicBuilderChooseBase(itemUuid) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }

  const groups = await add2eMagicBuilderCollectBases(add2eMagicBuilderType(item), item.uuid);
  const options = groups.map(group => {
    const rows = group.entries
      .sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"))
      .map(entry => `<option value="${add2eMagicBuilderEscape(entry.uuid)}">${add2eMagicBuilderEscape(entry.name)}</option>`)
      .join("");
    return `<optgroup label="${add2eMagicBuilderEscape(group.label)}">${rows}</optgroup>`;
  }).join("");

  if (!options) {
    ui.notifications.warn(`Aucune base de type ${item.type} n'est disponible.`);
    return false;
  }

  const selectedUuid = await DialogV2.wait({
    window: { title: `Choisir la base de ${item.name}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:520px;padding:10px"><p>La base fournit les caractéristiques ordinaires. Les pouvoirs, charges et bonus magiques actuels sont conservés.</p><label style="display:grid;gap:5px"><b>Objet de base</b><select name="baseUuid" style="width:100%">${options}</select></label></div>`,
    buttons: [
      {
        action: "apply",
        label: "Utiliser cette base",
        icon: "fa-solid fa-link",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          return root?.querySelector?.('[name="baseUuid"]')?.value ?? "";
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });

  if (!selectedUuid) return false;
  const baseItem = await add2eMagicBuilderResolveItem(selectedUuid);
  if (!baseItem) {
    ui.notifications.error("L'objet de base sélectionné est introuvable.");
    return false;
  }
  return add2eMagicBuilderApplyBase(item, baseItem);
}

async function add2eMagicBuilderDropBase(event, itemUuid) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  const baseItem = await add2eMagicBuilderResolveDrop(event);
  if (!item || !baseItem) {
    ui.notifications.warn("Objet de base introuvable.");
    return false;
  }
  if (add2eMagicBuilderType(item) !== add2eMagicBuilderType(baseItem)) {
    ui.notifications.warn(`Déposez un Item de type ${item.type}.`);
    return false;
  }
  const confirmed = await add2eMagicBuilderConfirm(
    `Utiliser ${baseItem.name} comme base`,
    `<div class="add2e-dialog" style="min-width:460px;padding:8px"><p>Copier les caractéristiques ordinaires de <b>${add2eMagicBuilderEscape(baseItem.name)}</b> dans <b>${add2eMagicBuilderEscape(item.name)}</b> ?</p><p>Les pouvoirs, charges et bonus magiques seront conservés.</p></div>`,
    "Appliquer la base"
  );
  if (!confirmed) return false;
  return add2eMagicBuilderApplyBase(item, baseItem);
}

async function add2eMagicBuilderClearBase(itemUuid) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const confirmed = await add2eMagicBuilderConfirm(
    "Dissocier l'objet de base",
    `<div class="add2e-dialog" style="min-width:440px;padding:8px"><p>Dissocier <b>${add2eMagicBuilderEscape(item.name)}</b> de sa base ?</p><p>Les caractéristiques déjà copiées restent présentes.</p></div>`,
    "Dissocier"
  );
  if (!confirmed) return false;
  const enchantement = add2eMagicBuilderEnchantment(item);
  enchantement.baseUuid = "";
  enchantement.baseName = "";
  enchantement.baseType = "";
  await item.update({
    "system.enchantement": enchantement,
    "flags.add2e.-=baseItemUuid": null,
    "flags.add2e.-=baseItemName": null,
    "flags.add2e.-=baseItemType": null
  }, { add2eMagicItemBuilder: true, add2eInternal: true });
  item.sheet?.render?.({ force: true });
  return true;
}

async function add2eMagicBuilderDropPower(event, itemUuid) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  const spell = await add2eMagicBuilderResolveDrop(event);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  if (!spell || String(spell.type ?? "").toLowerCase() !== "sort") {
    ui.notifications.warn("Déposez un Item de type sort.");
    return false;
  }
  const store = globalThis.add2eStoreSpellInMagicItem;
  if (typeof store !== "function") {
    ui.notifications.error("Le gestionnaire de pouvoirs magiques est indisponible.");
    return false;
  }
  const stored = await store(item, spell);
  if (stored) item.sheet?.render?.({ force: true });
  return stored !== false;
}

async function add2eMagicBuilderRemovePower(itemUuid, powerIndex) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const remove = globalThis.add2eRemoveMagicItemPower;
  if (typeof remove !== "function") {
    ui.notifications.error("Le gestionnaire de pouvoirs magiques est indisponible.");
    return false;
  }
  const removed = await remove(item, Number(powerIndex));
  if (removed) item.sheet?.render?.({ force: true });
  return removed !== false;
}

Hooks.on("preUpdateItem", (item, change) => add2eMagicBuilderSyncUpdate(item, change));

globalThis.ADD2E_MAGIC_ITEM_BUILDER_VERSION = ADD2E_MAGIC_ITEM_BUILDER_VERSION;
globalThis.add2eMagicBuilderChooseBase = add2eMagicBuilderChooseBase;
globalThis.add2eMagicBuilderDropBase = add2eMagicBuilderDropBase;
globalThis.add2eMagicBuilderClearBase = add2eMagicBuilderClearBase;
globalThis.add2eMagicBuilderDropPower = add2eMagicBuilderDropPower;
globalThis.add2eMagicBuilderRemovePower = add2eMagicBuilderRemovePower;
globalThis.add2eMagicBuilderApplyBase = add2eMagicBuilderApplyBase;

// ---------------------------------------------------------------------------
// Générateur unifié : conserve le bouton historique et crée directement
// un Item objet, arme ou armure. Les bases d'armes et d'armures proviennent
// exclusivement des compendiums d'Items correspondants.
// ---------------------------------------------------------------------------

const ADD2E_MAGIC_CREATOR_PROFILES = Object.freeze({
  objet: Object.freeze({
    label: "Objet",
    itemType: "objet",
    sousType: "objet_magique",
    img: "icons/svg/item-bag.svg",
    tags: ["objet_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  arme: Object.freeze({
    label: "Arme",
    itemType: "arme",
    baseType: "arme",
    img: "icons/weapons/swords/sword-guard-gold.webp",
    tags: ["objet_magique", "arme_magique"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  armure: Object.freeze({
    label: "Armure",
    itemType: "armure",
    baseType: "armure",
    img: "icons/equipment/chest/breastplate-layered-steel.webp",
    tags: ["objet_magique", "armure_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  anneau: Object.freeze({
    label: "Anneau",
    itemType: "objet",
    sousType: "anneau",
    img: "icons/equipment/finger/ring-band-engraved-gold.webp",
    tags: ["objet_magique", "sous_type:anneau", "anneau", "actif_si_equipe"],
    enchantable: true,
    charges: false
  }),
  parchemin: Object.freeze({
    label: "Parchemin",
    itemType: "objet",
    sousType: "parchemin_de_sort",
    img: "icons/sundries/scrolls/scroll-runed-brown.webp",
    tags: ["objet_magique", "parchemin", "parchemin_de_sort", "consommable"],
    consumable: true,
    enchantable: false,
    charges: false
  }),
  baguette: Object.freeze({
    label: "Baguette",
    itemType: "objet",
    sousType: "baguette",
    img: "icons/weapons/wands/wand-gem-blue.webp",
    tags: ["objet_magique", "sous_type:baguette", "baguette", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  batonnet: Object.freeze({
    label: "Bâtonnet",
    itemType: "objet",
    sousType: "batonnet",
    img: "icons/weapons/staves/staff-engraved-brown.webp",
    tags: ["objet_magique", "sous_type:batonnet", "batonnet", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  potion: Object.freeze({
    label: "Potion",
    itemType: "objet",
    sousType: "potion",
    img: "icons/consumables/potions/potion-bottle-corked-blue.webp",
    tags: ["objet_magique", "potion", "consommable_potion", "consommable"],
    consumable: true,
    enchantable: true,
    charges: true,
    defaultCharges: 10,
    defaultMax: 10
  }),
  livre_illusionniste: Object.freeze({
    label: "Livre de sorts d’illusionniste",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-blue.webp",
    spellbookOwnerList: "illusionniste",
    enchantable: false,
    charges: false
  }),
  livre_magicien: Object.freeze({
    label: "Livre de sorts de magicien",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-red.webp",
    spellbookOwnerList: "magicien",
    enchantable: false,
    charges: false
  })
});

async function add2eMagicBuilderCollectCreatorBases() {
  const result = { arme: [], armure: [] };

  for (const pack of game.packs ?? []) {
    if (String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;

    let index;
    try {
      index = await pack.getIndex({ fields: ["name", "type", "img"] });
    } catch (error) {
      console.warn("[ADD2E][OBJET_MAGIQUE][BASE_INDEX_ERROR]", {
        pack: pack.collection,
        error
      });
      continue;
    }

    const source = String(pack.title ?? pack.metadata?.label ?? pack.collection);
    for (const entry of index ?? []) {
      const type = String(entry.type ?? "").trim().toLowerCase();
      if (type !== "arme" && type !== "armure") continue;
      result[type].push({
        uuid: String(entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`),
        name: String(entry.name ?? "Base"),
        source
      });
    }
  }

  for (const type of ["arme", "armure"]) {
    result[type].sort((left, right) =>
      left.source.localeCompare(right.source, "fr")
      || left.name.localeCompare(right.name, "fr")
    );
  }
  return result;
}

function add2eMagicBuilderCreatorBaseOptions(entries) {
  const groups = new Map();
  for (const entry of entries ?? []) {
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }

  return [...groups.entries()].map(([source, rows]) => {
    const options = rows.map(entry =>
      `<option value="${add2eMagicBuilderEscape(entry.uuid)}">${add2eMagicBuilderEscape(entry.name)}</option>`
    ).join("");
    return `<optgroup label="${add2eMagicBuilderEscape(source)}">${options}</optgroup>`;
  }).join("");
}

function add2eMagicBuilderToggleCreatorType(form) {
  const root = form?.closest?.(".window-content") ?? form;
  const profile = String(form?.elements?.profile?.value ?? "objet");
  const defaults = ADD2E_MAGIC_CREATOR_PROFILES[profile];
  const weaponGroup = root?.querySelector?.('[data-add2e-base-group="arme"]');
  const armorGroup = root?.querySelector?.('[data-add2e-base-group="armure"]');
  const applicationGroup = root?.querySelector?.('[data-add2e-application-group]');
  const applicationModeGroup = root?.querySelector?.('[data-add2e-application-mode-group]');
  const chargesGroup = root?.querySelector?.('[data-add2e-charges-group]');
  const rechargeGroup = root?.querySelector?.('[data-add2e-recharge-group]');

  if (weaponGroup) weaponGroup.hidden = profile !== "arme";
  if (armorGroup) armorGroup.hidden = profile !== "armure";
  if (applicationGroup) applicationGroup.hidden = !["objet", "arme", "armure", "anneau", "baguette", "batonnet", "potion"].includes(profile);
  if (applicationModeGroup) applicationModeGroup.hidden = profile !== "arme";
  if (chargesGroup) chargesGroup.hidden = defaults?.charges !== true;
  if (rechargeGroup) rechargeGroup.hidden = defaults?.charges !== true;

  const application = form?.elements?.application;
  const current = form?.elements?.chargesValue;
  const maximum = form?.elements?.chargesMax;
  if (application && application.dataset.profile !== profile) {
    application.value = add2eMagicBuilderDefaultApplication(defaults?.itemType ?? profile);
    application.dataset.profile = profile;
  }
  if (current && current.dataset.profile !== profile) {
    current.value = String(defaults?.defaultCharges ?? 0);
    current.dataset.profile = profile;
  }
  if (maximum && maximum.dataset.profile !== profile) {
    maximum.value = String(defaults?.defaultMax ?? 0);
    maximum.dataset.profile = profile;
  }
}

globalThis.add2eMagicBuilderToggleCreatorType = add2eMagicBuilderToggleCreatorType;

function add2eMagicBuilderCreatorForm(dialogOrElement) {
  const element = dialogOrElement?.element ?? dialogOrElement ?? null;
  return element?.querySelector?.("form.add2e-magic-item-create-form")
    ?? element?.closest?.("dialog")?.querySelector?.("form.add2e-magic-item-create-form")
    ?? null;
}

function add2eMagicBuilderCreateDialogV2Class(DialogV2) {
  return class Add2eMagicItemCreatorDialogV2 extends DialogV2 {
    _onRender(context, options) {
      super._onRender?.(context, options);
      this.add2eBindCreatorTypeSelect();
    }

    add2eBindCreatorTypeSelect() {
      const form = add2eMagicBuilderCreatorForm(this);
      const select = form?.elements?.profile ?? form?.querySelector?.('select[name="profile"]');
      if (!form || !select) return false;

      if (select.dataset.add2eCreatorTypeBound !== "1") {
        select.dataset.add2eCreatorTypeBound = "1";
        const refresh = () => add2eMagicBuilderToggleCreatorType(form);
        select.addEventListener("change", refresh);
        select.addEventListener("input", refresh);
      }

      add2eMagicBuilderToggleCreatorType(form);
      return true;
    }
  };
}

async function add2eMagicBuilderWaitCreatorDialog(DialogV2, config) {
  const CreatorDialogV2 = add2eMagicBuilderCreateDialogV2Class(DialogV2);

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      return value;
    };

    const buttons = (config.buttons ?? []).map(button => ({
      ...button,
      callback: async (...args) => finish(await button.callback?.(...args))
    }));

    const dialog = new CreatorDialogV2({ ...config, buttons });
    dialog.addEventListener?.("close", () => finish(null), { once: true });
    Promise.resolve(dialog.render({ force: true })).then(() => dialog.add2eBindCreatorTypeSelect?.());
  });
}

function add2eMagicBuilderCreatorSpellbookData(profile, name) {
  const ownerList = String(profile.spellbookOwnerList ?? "");
  return {
    name,
    type: "objet",
    img: profile.img,
    system: {
      nom: name,
      type: "objet",
      categorie: "objet_magique",
      sousType: "livre_de_sorts",
      quantite: 1,
      poids: 5,
      equipee: false,
      magique: true,
      consommable: false,
      description: "Livre de sorts indépendant. Il peut être placé dans un coffre, ramassé et consulté par un personnage compatible.",
      arcaneDocument: {
        schema: 1,
        kind: "spellbook",
        personal: false,
        ownerList,
        ownerActorUuid: "",
        spells: []
      },
      nom_non_identifie: "Livre de sorts"
    },
    effects: [],
    flags: {
      add2e: {
        arcaneDocumentKind: "spellbook",
        personalSpellbook: false,
        ownerActorUuid: "",
        ownerSpellList: ownerList,
        generatedBy: "migration-livres-parchemins-v1"
      }
    }
  };
}

function add2eMagicBuilderCreatorReadForm(button, dialog) {
  const form = button?.form
    ?? button?.element?.closest?.("form")
    ?? dialog?.element?.querySelector?.("form.add2e-magic-item-create-form");
  if (!form) return null;

  const data = Object.fromEntries(new FormData(form).entries());
  const profile = String(data.profile ?? "objet").trim();
  const baseUuid = profile === "arme"
    ? String(data.weaponBaseUuid ?? "").trim()
    : profile === "armure"
      ? String(data.armorBaseUuid ?? "").trim()
      : "";

  return {
    profile,
    baseUuid,
    name: String(data.name ?? "").trim(),
    unidentifiedName: String(data.unidentifiedName ?? "").trim(),
    identified: data.identified === "on",
    cursed: data.cursed === "on",
    application: String(data.application ?? "").trim(),
    bonusToucher: add2eMagicBuilderNumber(data.bonusToucher, 0),
    bonusDegats: add2eMagicBuilderNumber(data.bonusDegats, 0),
    bonusCA: add2eMagicBuilderNumber(data.bonusCA, 0),
    caFixe: add2eMagicBuilderOptionalNumber(data.caFixe),
    chargesValue: Math.max(0, Math.trunc(add2eMagicBuilderNumber(data.chargesValue, 0))),
    chargesMax: Math.max(0, Math.trunc(add2eMagicBuilderNumber(data.chargesMax, 0))),
    rechargeable: data.rechargeable === "on",
    rechargeFormula: String(data.rechargeFormula ?? "").trim()
  };
}

function add2eMagicBuilderCreatorSanitizeBase(baseItem, profile, name) {
  const source = add2eMagicBuilderClone(baseItem.toObject?.() ?? {});
  delete source._id;
  delete source.folder;
  delete source.sort;
  delete source.ownership;
  delete source._stats;

  source.name = name;
  source.type = profile.itemType;
  source.img = baseItem.img || profile.img;
  source.system = add2eMagicBuilderClone(baseItem.system ?? {});
  source.effects = Array.isArray(source.effects) ? source.effects : [];
  source.flags = add2eMagicBuilderClone(baseItem.flags ?? {});
  source.flags.add2e ??= {};
  return source;
}

function add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, baseItem = null) {
  const system = itemData.system ??= {};
  const type = profile.itemType;
  const baseStats = baseItem ? add2eMagicBuilderReadBaseStats(baseItem) : {
    bonusToucher: 0,
    bonusDegats: 0,
    bonusCA: 0,
    caFixe: null
  };
  const application = ["source", "porteur"].includes(result.application)
    ? result.application
    : add2eMagicBuilderDefaultApplication(type);

  system.nom = itemData.name;
  system.type = type;
  system.magique = true;
  system.identifie = result.identified;
  system.maudit = result.cursed;
  system.nom_non_identifie = result.unidentifiedName || (type === "arme" ? "Arme inconnue" : type === "armure" ? "Armure inconnue" : "Objet inconnu");
  system.equipee ??= false;
  system.pouvoirs = [];
  system.tags = add2eMagicBuilderMergeUniqueValues(system.tags, profile.tags);
  system.effectTags = add2eMagicBuilderMergeUniqueValues(system.effectTags, profile.tags);

  const enchantement = {
    schema: 1,
    baseUuid: String(baseItem?.uuid ?? ""),
    baseName: String(baseItem?.name ?? ""),
    baseType: String(baseItem?.type ?? ""),
    application,
    bonusToucher: result.bonusToucher,
    bonusDegats: result.bonusDegats,
    bonusCA: result.bonusCA,
    caFixe: result.caFixe,
    baseStats
  };
  system.enchantement = enchantement;

  if (type === "arme") {
    const sourceMode = application === "source";
    system.bonus_hit = baseStats.bonusToucher + (sourceMode ? result.bonusToucher : 0);
    system.bonus_dom = baseStats.bonusDegats + (sourceMode ? result.bonusDegats : 0);
  } else {
    system.bonus_toucher = result.bonusToucher;
    system.bonus_degats = result.bonusDegats;
  }
  system.bonus_ac = baseStats.bonusCA + result.bonusCA;
  system.ca_fixe = result.caFixe ?? baseStats.caFixe ?? null;

  if (application === "porteur") {
    if (result.bonusToucher) system.effectTags = add2eMagicBuilderMergeUniqueValues(system.effectTags, `bonus_attaque:${add2eMagicBuilderSigned(result.bonusToucher)}`);
    if (result.bonusDegats) system.effectTags = add2eMagicBuilderMergeUniqueValues(system.effectTags, `bonus_degats:${add2eMagicBuilderSigned(result.bonusDegats)}`);
  }

  const max = profile.charges ? Math.max(result.chargesMax, result.chargesValue) : 0;
  const current = profile.charges ? Math.min(result.chargesValue, max) : 0;
  if (profile.charges || max > 0) {
    system.charges = {
      value: current,
      max,
      ...(result.rechargeable || profile.rechargeable ? {
        mode: "charges",
        recharge: "rechargeable",
        rechargeable: true,
        rechargeFormula: result.rechargeFormula || profile.rechargeFormula || "1d6"
      } : {})
    };
  }

  itemData.flags ??= {};
  itemData.flags.add2e ??= {};
  Object.assign(itemData.flags.add2e, {
    magicItemProfile: profileKey,
    magicItemBuilderVersion: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    kind: profile.sousType ?? profileKey,
    category: "objet_magique",
    ...(baseItem ? {
      baseItemUuid: baseItem.uuid,
      baseItemName: baseItem.name,
      baseItemType: baseItem.type
    } : {})
  });
  itemData.flags.add2e.magicItemBuilder = {
    version: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    generatedTags: application === "porteur"
      ? [
          result.bonusToucher ? `bonus_attaque:${add2eMagicBuilderSigned(result.bonusToucher)}` : "",
          result.bonusDegats ? `bonus_degats:${add2eMagicBuilderSigned(result.bonusDegats)}` : ""
        ].filter(Boolean)
      : []
  };
}

async function add2eMagicBuilderCreateMagicItem(directory = null) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable.");

  const bases = await add2eMagicBuilderCollectCreatorBases();
  const weaponOptions = add2eMagicBuilderCreatorBaseOptions(bases.arme);
  const armorOptions = add2eMagicBuilderCreatorBaseOptions(bases.armure);
  const profileOptions = Object.entries(ADD2E_MAGIC_CREATOR_PROFILES)
    .map(([key, profile]) => `<option value="${key}">${add2eMagicBuilderEscape(profile.label)}</option>`)
    .join("");

  const result = await add2eMagicBuilderWaitCreatorDialog(DialogV2, {
    window: { title: "Créer un objet magique" },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-dialog add2e-magic-item-create-form" style="min-width:560px;padding:8px;display:grid;gap:8px;">
      <div class="form-group"><label>Type</label><select name="profile">${profileOptions}</select></div>
      <div class="form-group" data-add2e-base-group="arme" hidden><label>Arme de base</label><select name="weaponBaseUuid"><option value="">— Choisir une arme —</option>${weaponOptions}</select></div>
      <div class="form-group" data-add2e-base-group="armure" hidden><label>Armure de base</label><select name="armorBaseUuid"><option value="">— Choisir une armure —</option>${armorOptions}</select></div>
      <div class="form-group"><label>Nom</label><input name="name" type="text" value="Objet magique"></div>
      <div class="form-group"><label>Nom non identifié</label><input name="unidentifiedName" type="text" value="Objet inconnu"></div>
      <div class="form-group" style="display:flex;gap:18px;"><label><input name="identified" type="checkbox"> Identifié</label><label><input name="cursed" type="checkbox"> Maudit</label></div>
      <div data-add2e-application-group>
        <div class="form-group" data-add2e-application-mode-group><label>Application des bonus de toucher/dégâts</label><select name="application"><option value="source">Cette arme uniquement</option><option value="porteur">Toutes les attaques du porteur</option></select></div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
          <div class="form-group"><label>Bonus au toucher</label><input name="bonusToucher" type="number" step="1" value="0"></div>
          <div class="form-group"><label>Bonus aux dégâts</label><input name="bonusDegats" type="number" step="1" value="0"></div>
          <div class="form-group"><label>Bonus de CA</label><input name="bonusCA" type="number" step="1" value="0"></div>
          <div class="form-group"><label>CA fixe</label><input name="caFixe" type="number" step="1" value=""></div>
        </div>
      </div>
      <div data-add2e-charges-group style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
        <div class="form-group"><label>Charges actuelles</label><input name="chargesValue" data-profile="objet" type="number" min="0" step="1" value="0"></div>
        <div class="form-group"><label>Charges maximales</label><input name="chargesMax" data-profile="objet" type="number" min="0" step="1" value="0"></div>
      </div>
      <div class="form-group" data-add2e-recharge-group style="display:flex;align-items:center;gap:12px;"><label><input name="rechargeable" type="checkbox"> Rechargeable</label><label style="flex:1;">Formule <input name="rechargeFormula" type="text" value="1d6"></label></div>
      <p style="margin:0;font-size:.85em;opacity:.8;">Arme et Armure exigent une base issue d'un compendium. Objet crée un objet magique générique. Les autres types conservent leur fonctionnement spécialisé.</p>
    </form>`,
    buttons: [
      {
        action: "create",
        label: "Créer l'objet magique",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button, dialog) => add2eMagicBuilderCreatorReadForm(button, dialog)
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });

  if (!result || typeof result !== "object") return null;
  const profileKey = String(result.profile ?? "").trim();
  const profile = ADD2E_MAGIC_CREATOR_PROFILES[profileKey];
  if (!profile) return ui.notifications.error("Le type d'objet magique sélectionné est invalide.");

  let baseItem = null;
  if (profile.baseType) {
    if (!result.baseUuid) {
      ui.notifications.warn(`Choisissez une ${profile.baseType} de base dans la liste.`);
      return null;
    }
    baseItem = await add2eMagicBuilderResolveItem(result.baseUuid);
    if (!baseItem || add2eMagicBuilderType(baseItem) !== profile.baseType || !String(baseItem.uuid ?? "").startsWith("Compendium.")) {
      ui.notifications.error(`La base sélectionnée doit être une ${profile.baseType} provenant d'un compendium.`);
      return null;
    }
  }

  const requestedName = String(result.name ?? "").trim();
  const name = (!requestedName || requestedName === "Objet magique")
    ? (baseItem ? `${baseItem.name} magique` : profile.label)
    : requestedName;
  const folder = directory?.currentFolder?.id ?? directory?.folder?.id ?? null;

  let itemData;
  if (profile.spellbookOwnerList) {
    itemData = add2eMagicBuilderCreatorSpellbookData(profile, name);
  } else if (baseItem) {
    itemData = add2eMagicBuilderCreatorSanitizeBase(baseItem, profile, name);
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, baseItem);
  } else {
    itemData = {
      name,
      type: profile.itemType,
      img: profile.img,
      system: {
        nom: name,
        type: profile.itemType,
        categorie: "objet_magique",
        sousType: profile.sousType ?? "objet_magique",
        sous_type: profile.sousType ?? "objet_magique",
        quantite: 1,
        poids: 0,
        equipee: false,
        magique: true,
        consommable: profile.consumable === true,
        description: "",
        tags: [...(profile.tags ?? [])],
        effectTags: [...(profile.tags ?? [])],
        pouvoirs: []
      },
      effects: [],
      flags: { add2e: {} }
    };
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, null);
    if (profileKey === "parchemin") {
      itemData.system.arcaneDocument = { schema: 1, kind: "spell-scroll", personal: false, spells: [] };
      itemData.flags.add2e.arcaneDocumentKind = "spell-scroll";
    }
  }

  if (folder) itemData.folder = folder;
  const ItemClass = CONFIG?.Item?.documentClass ?? globalThis.Item;
  const created = await ItemClass.create(itemData, { renderSheet: true });
  ui.notifications.info(`${created?.name ?? name} a été créé.`);
  return created;
}

function add2eMagicBuilderInstallDirectoryCreator(app, html) {
  queueMicrotask(() => {
    const root = html instanceof HTMLElement
      ? html
      : html?.[0] instanceof HTMLElement
        ? html[0]
        : app?.element;
    const current = root?.querySelector?.(".add2e-create-magic-item");
    if (!current || current.dataset.add2eUnifiedCreator === "true") return;

    const button = current.cloneNode(true);
    button.dataset.add2eUnifiedCreator = "true";
    button.title = "Créer un objet, une arme ou une armure magique";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      add2eMagicBuilderCreateMagicItem(app).catch(error => {
        console.error("[ADD2E][OBJET_MAGIQUE][CREATE_ERROR]", error);
        ui.notifications.error(error?.message || "Erreur pendant la création de l'objet magique.");
      });
    });
    current.replaceWith(button);
  });
}

Hooks.on("renderItemDirectory", add2eMagicBuilderInstallDirectoryCreator);
Hooks.on("renderSidebarTab", (app, html) => {
  const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase();
  if (id.includes("item")) add2eMagicBuilderInstallDirectoryCreator(app, html);
});

Hooks.once("ready", () => {
  globalThis.add2eCreateMagicItem = add2eMagicBuilderCreateMagicItem;
});

