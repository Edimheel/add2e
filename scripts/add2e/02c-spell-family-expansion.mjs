const V="2026-06-21-spell-family-deferred-parent-removal-v6",Q=globalThis.ADD2E_SPELL_FAMILY_PENDING instanceof Set?globalThis.ADD2E_SPELL_FAMILY_PENDING:new Set(),R=globalThis.ADD2E_SPELL_FAMILY_PENDING_REMOVALS instanceof Set?globalThis.ADD2E_SPELL_FAMILY_PENDING_REMOVALS:new Set();globalThis.ADD2E_SPELL_FAMILY_PENDING=Q;globalThis.ADD2E_SPELL_FAMILY_PENDING_REMOVALS=R;
const copy=v=>{if(v==null)return v;try{return foundry.utils.deepClone(v)}catch(e){}try{return foundry.utils.duplicate(v)}catch(e){}return JSON.parse(JSON.stringify(v))},norm=v=>String(v??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"").replace(/\s*\([^)]*\)\s*$/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
function arr(v){if(v==null||v==="")return[];if(Array.isArray(v))return v.flatMap(arr);if(typeof v==="string")return v.split(/[,;|\n]+/).map(x=>x.trim()).filter(Boolean);if(typeof v==="object")for(const k of["spellLists","lists","classes","classe","class","value","values","items"])if(v[k]!==undefined)return arr(v[k]);return[v]}
const level=s=>Number(String(s?.niveau??s?.niveau_sort??s?.spellLevel??s?.level??0).match(/\d+/)?.[0]??0)||0,lists=s=>[...new Set(["spellLists","lists","classes","classe","class","liste","tags","effectTags"].flatMap(k=>arr(s?.[k])).map(norm).filter(Boolean))],stable=d=>`${lists(d?.system).sort().join("+")||"liste_inconnue"}|${level(d?.system)}|${norm(d?.name??d?.system?.nom)}`;
function profiles(flag,system){const p=Array.isArray(flag?.profiles)?flag.profiles.filter(Boolean):[];if(!p.length)return[];const l=level(system),cs=new Set(lists(system)),m=p.filter(x=>(!Number(x.level)||Number(x.level)===l)&&(!norm(x.class)||!cs.size||cs.has(norm(x.class))));return m.length?m:p.length===1?p:[]}
const getMode=(p,id)=>(p?.modes??[]).find(x=>String(x?.id??"").toLowerCase()===id)??null,pkey=(p,n)=>[norm(p?.class),Number(p?.level)||0,norm(p?.referenceName??n)].join("|");
function override(d,o={}){const r=copy(d);r.system??={};for(const[k,v]of Object.entries(o)){if(k.includes("."))foundry.utils.setProperty(r.system,k,copy(v));else r.system[k]=copy(v)}return r}function named(d,n){const r=copy(d);r.name=String(n??"").trim();r.system??={};r.system.nom=r.name;return r}function marked(d,key,kind,extra={},order=0){const r=copy(d);r.flags??={};r.flags.add2e??={};r.flags.add2e.spellFamily={version:V,key,kind,sortOrder:order,generated:kind!=="base",...copy(extra)};return r}
function expected(base){const src=base.toObject(),name=String(src.name??src.system?.nom??"").trim(),key=stable(src),rev=profiles(src.flags?.add2e?.reversible,src.system),normal=rev.map(p=>getMode(p,"normal")).find(Boolean),data=normal?.systemOverrides?override(src,normal.systemOverrides):copy(src),out=[{id:"base",kind:"base",data:marked(data,key,"base",{sourceItemId:base.id,sourceItemName:name},0)}];let i=1;for(const p of rev){if(p?.splitOnActorGrant!==true)continue;const m=getMode(p,"inverse"),n=String(m?.actorItemName??m?.manualName??"").trim();if(!n)continue;const pk=pkey(p,name);let x=marked(override(named(data,n),m?.systemOverrides??{}),key,"inverse",{sourceItemId:base.id,sourceItemName:name,profileKey:pk,reversibleMode:"inverse",inverseNameStatus:p.inverseNameStatus??"manual_explicit"},i++);x.flags.add2e.reversibleActorEntry={version:V,profileKey:pk,mode:"inverse",sourceItemName:name};out.push({id:`inverse:${pk}`,kind:"inverse",data:x})}let v=10;for(const p of profiles(src.flags?.add2e?.variant??src.flags?.add2e?.variants,src.system)){const pk=pkey(p,name);for(const c of p?.choices??[]){const id=String(c?.id??"").trim()||norm(c?.nom??c?.name),n=String(c?.nom??c?.name??"").trim();if(!id||!n)continue;let x=marked(named(data,`${name} — ${n}`),key,"variant",{sourceItemId:base.id,sourceItemName:name,profileKey:pk,variantChoiceId:id,variantChoiceName:n},v++);x.flags.add2e.variantChoice={version:V,profileKey:pk,id,nom:n,reference:copy(c?.reference??null)};out.push({id:`variant:${pk}:${id}`,kind:"variant",data:x})}}return{key,out:[...new Map(out.map(x=>[`${x.id}|${stable(x.data)}`,x])).values()]}}
const generated=i=>i?.flags?.add2e?.spellFamily?.generated===true,identity=i=>{const f=i?.flags?.add2e?.spellFamily??{};return f.kind==="base"?"base":f.kind==="inverse"?`inverse:${f.profileKey??""}`:f.kind==="variant"?`variant:${f.profileKey??""}:${f.variantChoiceId??""}`:""};
function update(i,e){const a=e.data.flags?.add2e??{},u={_id:i.id,name:e.data.name,img:e.data.img,system:copy(e.data.system??{}),"flags.add2e.spellFamily":copy(a.spellFamily)};if(a.reversibleActorEntry)u["flags.add2e.reversibleActorEntry"]=copy(a.reversibleActorEntry);if(a.variantChoice)u["flags.add2e.variantChoice"]=copy(a.variantChoice);return u}
function schedule(actor,id){const k=`${actor?.uuid??actor?.id??""}|${id}`;if(!k||R.has(k))return false;R.add(k);setTimeout(async()=>{try{const p=actor.items?.get?.(id);if(!p||String(p.type).toLowerCase()!=="sort"||generated(p))return;await actor.deleteEmbeddedDocuments("Item",[id],{add2eInternal:true,add2eSpellFamilyExpansion:true,reason:"replace-generic-variant-parent",render:false});add2eRerenderActorSheet?.(actor,false)}catch(e){if(!/does not exist|undefined id/i.test(String(e?.message??e)))console.error("[ADD2E][SPELL_FAMILY][PARENT_REMOVAL_ERROR]",e)}finally{R.delete(k)}},500);return true}
async function ensure(item){const actor=item?.actor??item?.parent;if(!actor||actor.documentName!=="Actor"||actor.type!=="personnage"||!actor.items?.has?.(item.id)||String(item?.type).toLowerCase()!=="sort"||generated(item))return{handled:false};const{key,out}=expected(item),derived=out.filter(x=>x.id!=="base"),variants=derived.filter(x=>x.kind==="variant");if(!derived.length)return{handled:true,created:0,updated:0};const ex=new Map(),occ=new Set();for(const a of actor.items?.filter?.(x=>String(x.type).toLowerCase()==="sort")??[]){if(a.id!==item.id)occ.add(stable(a));if(a.flags?.add2e?.spellFamily?.key===key){const id=identity(a);if(id)ex.set(id,a)}}if(!variants.length){const b=out.find(x=>x.id==="base");if(b&&actor.items.has(item.id))await actor.updateEmbeddedDocuments("Item",[update(item,b)],{add2eInternal:true,add2eSpellFamilyExpansion:true,render:false})}const us=[],cs=[],ok=new Set(),bad=[];for(const e of derived){const found=ex.get(e.id);if(found){us.push(update(found,e));if(e.kind==="variant")ok.add(e.id);continue}const sk=stable(e.data);if(occ.has(sk)){if(e.kind==="variant")bad.push(e.id);continue}const d=copy(e.data);delete d._id;d.folder=null;cs.push(d);occ.add(sk);if(e.kind==="variant")ok.add(e.id)}if(us.length)await actor.updateEmbeddedDocuments("Item",us,{add2eInternal:true,add2eSpellFamilyExpansion:true,render:false});if(cs.length)await actor.createEmbeddedDocuments("Item",cs,{add2eInternal:true,add2eSpellFamilyExpansion:true,render:false});const queued=variants.length>0&&ok.size===variants.length&&!bad.length?schedule(actor,item.id):false;if(bad.length)console.warn("[ADD2E][SPELL_FAMILY][KEEP_PARENT_VARIANT_CONFLICT]",{actor:actor.name,sort:item.name,bad});if(us.length||cs.length)add2eRerenderActorSheet?.(actor,false);return{handled:true,created:cs.length,updated:us.length,queued}}
async function expand(actor){if(!actor||actor.type!=="personnage")return{handled:false};let created=0,updated=0,queued=0;for(const i of actor.items?.filter?.(x=>String(x.type).toLowerCase()==="sort"&&!generated(x))??[]){if(!actor.items.has(i.id))continue;const r=await ensure(i);created+=r?.created??0;updated+=r?.updated??0;queued+=r?.queued?1:0}return{handled:true,created,updated,queued}}
function compare(a,b){const A=a?.flags?.add2e?.spellFamily??{},B=b?.flags?.add2e?.spellFamily??{},an=String(a?.name??a?.system?.nom??""),bn=String(b?.name??b?.system?.nom??""),af=String(A.sourceItemName??an),bf=String(B.sourceItemName??bn),fc=af.localeCompare(bf,"fr",{sensitivity:"base"});if(fc)return fc;if(A.key&&A.key===B.key){const ao=Number.isFinite(Number(A.sortOrder))?Number(A.sortOrder):A.kind==="inverse"?1:A.kind==="variant"?10:0,bo=Number.isFinite(Number(B.sortOrder))?Number(B.sortOrder):B.kind==="inverse"?1:B.kind==="variant"?10:0;if(ao!==bo)return ao-bo}return an.localeCompare(bn,"fr",{sensitivity:"base"})}
function sortRows(d){if(!d||typeof d!=="object")return d;for(const r of Object.values(d.sortsParNiveau??{}))if(Array.isArray(r))r.sort(compare);for(const l of Array.isArray(d.add2eSpellLevels)?d.add2eSpellLevels:[]){if(Array.isArray(l?.sorts))l.sorts.sort(compare);for(const g of Array.isArray(l?.groups)?l.groups:[])if(Array.isArray(g?.sorts))g.sorts.sort(compare)}return d}
Hooks.on("createItem",(item,options={},userId)=>{if(options?.add2eSpellFamilyExpansion||String(userId??"")!==String(game.user?.id??"")||String(item?.type).toLowerCase()!=="sort"||generated(item))return;const k=String(item.uuid??item.id??"");if(!k||Q.has(k))return;Q.add(k);setTimeout(()=>ensure(item).catch(e=>console.error("[ADD2E][SPELL_FAMILY][EXPANSION_ERROR]",e)).finally(()=>Q.delete(k)),50)});
Hooks.once("ready",()=>{const p=globalThis.Add2eActorSheet?.prototype;if(!p||p.__add2eSpellFamilyDisplaySortingV6||typeof p.getData!=="function")return;const old=p.getData;p.__add2eSpellFamilyDisplaySortingV6=true;p.getData=async function(...args){const d=await old.apply(this,args);try{return sortRows(d)}catch(e){console.error("[ADD2E][SPELL_FAMILY][DISPLAY_SORT_ERROR]",e);return d}}});
globalThis.ADD2E_SPELL_FAMILY_VERSION=V;globalThis.add2eEnsureActorSpellFamily=ensure;globalThis.add2eExpandActorSpellFamilies=expand;globalThis.add2eSortActorSpellFamilyRows=sortRows;

const ADD2E_SPELL_CLASS_LEVEL_VERSION="2026-06-23-progression-ceiling-v1";
function add2eSpellClassLevel(actor,classSlug=""){
  const actorLevel=Math.max(1,Number(actor?.system?.niveau??actor?.system?.level??1)||1),wanted=norm(classSlug),classes=actor?.items?.filter?.(item=>String(item?.type??"").toLowerCase()==="classe")??[];
  const cls=classes.find(item=>[item?.system?.slug,item?.system?.label,item?.system?.nom,item?.system?.name,item?.name].map(norm).includes(wanted))??classes[0]??null;
  const read=value=>{const n=Number(value?.niveau??value?.level??value?.value??value);return Number.isFinite(n)&&n>0?Math.floor(n):0};
  let requested=0;
  for(const root of [actor?.system?.niveaux_par_classe,actor?.system?.niveauxParClasse,actor?.system?.levelsByClass,actor?.system?.classLevels]){
    if(!root||typeof root!=="object")continue;
    for(const [key,value] of Object.entries(root)){if(norm(key)!==wanted)continue;requested=read(value);break}
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
function add2eSpellSyncClassLabel(cls){return norm(cls?.system?.slug??cls?.system?.label??cls?.system?.nom??cls?.system?.name??cls?.name??"")}
function add2eSpellSyncClassIsAutomatic(cls){if(String(cls?.type??"").toLowerCase()!=="classe")return false;const sys=cls?.system??{},slug=add2eSpellSyncClassLabel(cls);if(slug.includes("clerc")||slug.includes("pretre")||slug.includes("priest")||slug.includes("druide")||slug.includes("druid"))return true;let casting=sys.spellcasting??{};if(typeof casting==="string"){try{casting=JSON.parse(casting)}catch(_e){casting={}}}const values=[...arr(sys.spellLists),...arr(sys.lists),...arr(casting?.lists),...arr(casting?.spellLists)].map(norm);return values.includes("clerc")||values.includes("druide")}
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
  for(const root of [actor?.system?.niveaux_par_classe,actor?.system?.niveauxParClasse,actor?.system?.levelsByClass,actor?.system?.classLevels]){if(!root||typeof root!=="object")continue;for(const [key,value] of Object.entries(root)){const n=Number(value?.niveau??value?.level??value?.value??value);if(Number.isFinite(n)&&n>0)sig[norm(key)]=Math.floor(n)}}
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
