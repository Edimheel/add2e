// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison.
// Point d'entrée conservé pour system.json.
// Le cœur canonique reste dans scripts/add2e-action-hud/core.mjs.

export {
  add2eRenderActionHud,
  add2eRefreshActionHud,
  add2eCloseActionHud
} from "./add2e-action-hud/core.mjs";

// ADD2E — Vues HUD complémentaires.
// Les listes et les actions d'équipement sont celles de la feuille.

const ADD2E_HUD_COMBAT_TABS_VERSION = "2026-07-29-hud-canonical-spells-v11";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_COMBAT_STYLE_ID = "add2e-action-hud-combat-tabs-style";
let add2eHudCombatTab = "armes";
let add2eHudCombatRenderScheduled = false;
let add2eHudCombatRendering = false;
let add2eHudCombatSuppressMutation = false;
let add2eHudCombatBodyObserver = null;
let add2eHudCombatRootObserver = null;
let add2eHudCombatObservedRoot = null;
let add2eHudThiefActivityRenderScheduled = false;
let add2eHudThiefActivityRendering = false;
let add2eHudFamiliarActionsRenderScheduled = false;
let add2eHudFamiliarActionsRendering = false;
let add2eHudRacialRenderScheduled = false;
let add2eHudRacialRendering = false;

function add2eHudCombatEscape(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_err) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}

function add2eHudCombatItemId(item) {
  return String(item?.id ?? item?._id ?? "");
}

function add2eHudCombatCurrentActor() {
  const state = globalThis.add2eHudCheck?.();
  const actorId = state?.actorId;
  if (actorId) {
    const tokenActor = (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actorId)?.actor
      ?? (canvas?.tokens?.placeables ?? []).find(token => token?.actor?.id === actorId)?.actor
      ?? null;
    return tokenActor ?? game.actors?.get?.(actorId) ?? null;
  }
  if ((canvas?.tokens?.controlled ?? []).length === 1) return canvas.tokens.controlled[0]?.actor ?? null;
  return game.user?.character ?? null;
}

function add2eHudCombatIsEquipped(item) {
  return item?.system?.equipee === true;
}

function add2eHudCombatItemDamage(item) {
  const helper = Handlebars?.helpers?.add2eItemDisplayDamage;
  if (typeof helper !== "function") return "—";
  return String(helper(item) ?? "—");
}

function add2eHudCombatWeaponDamage(weapon, objects) {
  const helper = Handlebars?.helpers?.add2eWeaponDisplayDamage;
  if (typeof helper !== "function") return add2eHudCombatItemDamage(weapon);
  return String(helper(weapon, objects) ?? "—");
}

function add2eHudCombatHybridWeaponAvailability(weapon) {
  const system = weapon?.system ?? {};
  const rawQuantity = system.quantite ?? system.quantity;
  if (rawQuantity === undefined || rawQuantity === null || rawQuantity === "") return null;

  const tags = [
    ...(Array.isArray(system.tags) ? system.tags : []),
    ...(Array.isArray(system.effectTags) ? system.effectTags : []),
    ...(Array.isArray(weapon?.flags?.add2e?.tags) ? weapon.flags.add2e.tags : [])
  ].map(value => String(value ?? "").toLowerCase());
  const hasThrownTag = tags.some(tag => tag.includes("usage:lancer") || tag.includes("usage:jet") || tag.includes("arme_de_jet"));
  const hasThrownRange = Number(system.portee_courte ?? system.porteeCourte ?? 0) > 0
    || Number(system.portee_moyenne ?? system.porteeMoyenne ?? 0) > 0
    || Number(system.portee_longue ?? system.porteeLongue ?? 0) > 0;
  if (!hasThrownTag && !hasThrownRange) return null;

  const available = Math.max(0, Math.floor(Number(rawQuantity) || 0));
  return `<span>Disponibles ${add2eHudCombatEscape(available)}</span>`;
}

async function add2eHudCombatSheetData(actor) {
  const sheet = actor?.sheet ?? null;
  if (typeof sheet?.getData !== "function") return null;
  try {
    return await sheet.getData();
  } catch (_error) {
    return null;
  }
}

function add2eHudCombatCollections(sheetData) {
  const collection = value => Array.isArray(value) ? value : [];
  return {
    objects: collection(sheetData?.listeObjets),
    weapons: collection(sheetData?.listeArmes),
    armors: collection(sheetData?.listeArmures),
    projectiles: collection(sheetData?.listeCarquois),
    equipment: collection(sheetData?.listeObjetsDivers)
  };
}

function add2eHudCombatState(item) {
  return add2eHudCombatIsEquipped(item)
    ? '<span class="state equip-ok">Équipé</span>'
    : '<span class="state equip-bad">Rangé</span>';
}

function add2eHudCombatWeaponRow(weapon, objects) {
  const itemId = add2eHudCombatEscape(add2eHudCombatItemId(weapon));
  const equipped = add2eHudCombatIsEquipped(weapon);
  const damage = add2eHudCombatEscape(add2eHudCombatWeaponDamage(weapon, objects));
  const type = add2eHudCombatEscape(weapon?.system?.type_degats ?? "—");
  const factor = add2eHudCombatEscape(weapon?.system?.facteur_rapidité ?? "—");
  const available = add2eHudCombatHybridWeaponAvailability(weapon) ?? "";
  const actionLabel = equipped ? "Retirer" : "Équiper";
  const attackTitle = add2eHudCombatEscape(`Attaquer avec ${weapon?.name ?? "l'arme"}`);

  return `<div class="row equipment-row">
    <button type="button" class="img-act" data-add2e-hud-combat-action="attack" data-item-id="${itemId}" title="${attackTitle}">
      <img src="${add2eHudCombatEscape(weapon?.img || "icons/svg/sword.svg")}" alt="">
    </button>
    <div>
      <div class="title">${add2eHudCombatEscape(weapon?.name ?? "Arme")}</div>
      <div class="meta">${add2eHudCombatState(weapon)}<span>Dégâts ${damage}</span><span>${type}</span><span>Facteur ${factor}</span>${available}</div>
    </div>
    <button type="button" class="act" data-add2e-hud-combat-action="equip" data-item-id="${itemId}">${actionLabel}</button>
  </div>`;
}

function add2eHudCombatProjectileRow(projectile) {
  const itemId = add2eHudCombatEscape(add2eHudCombatItemId(projectile));
  const type = projectile?.system?.sousType ?? projectile?.system?.sous_type ?? projectile?.system?.munitionType ?? "—";
  const quantity = projectile?.system?.quantite ?? projectile?.system?.quantity ?? "—";
  const actionLabel = add2eHudCombatIsEquipped(projectile) ? "Retirer" : "Équiper";

  return `<div class="row equipment-row">
    <img src="${add2eHudCombatEscape(projectile?.img || "icons/svg/target.svg")}" alt="">
    <div>
      <div class="title">${add2eHudCombatEscape(projectile?.name ?? "Projectile")}</div>
      <div class="meta">${add2eHudCombatState(projectile)}<span>Type ${add2eHudCombatEscape(type)}</span><span>Dégâts ${add2eHudCombatEscape(add2eHudCombatItemDamage(projectile))}</span><span>Qté ${add2eHudCombatEscape(quantity)}</span></div>
    </div>
    <button type="button" class="act" data-add2e-hud-combat-action="equip" data-item-id="${itemId}">${actionLabel}</button>
  </div>`;
}

function add2eHudCombatArmorRow(armor) {
  const itemId = add2eHudCombatEscape(add2eHudCombatItemId(armor));
  const ca = armor?.system?.ac ?? armor?.system?.ca ?? "—";
  const bonus = armor?.system?.bonus_ac ?? "—";
  const actionLabel = add2eHudCombatIsEquipped(armor) ? "Retirer" : "Équiper";

  return `<div class="row equipment-row">
    <img src="${add2eHudCombatEscape(armor?.img || "icons/svg/shield.svg")}" alt="">
    <div>
      <div class="title">${add2eHudCombatEscape(armor?.name ?? "Armure")}</div>
      <div class="meta">${add2eHudCombatState(armor)}<span>CA ${add2eHudCombatEscape(ca)}</span><span>Bonus CA ${add2eHudCombatEscape(bonus)}</span></div>
    </div>
    <button type="button" class="act" data-add2e-hud-combat-action="equip" data-item-id="${itemId}">${actionLabel}</button>
  </div>`;
}

function add2eHudEquipmentRow(item) {
  const itemId = add2eHudCombatEscape(add2eHudCombatItemId(item));
  const quantity = item?.system?.quantite ?? item?.system?.quantity ?? "—";
  const weight = item?.system?.poids ?? "—";
  const actionLabel = add2eHudCombatIsEquipped(item) ? "Retirer" : "Équiper";

  return `<div class="row equipment-row">
    <img src="${add2eHudCombatEscape(item?.img || "icons/svg/item-bag.svg")}" alt="">
    <div>
      <div class="title">${add2eHudCombatEscape(item?.name ?? "Objet")}${quantity !== "—" ? ` ×${add2eHudCombatEscape(quantity)}` : ""}</div>
      <div class="meta">${add2eHudCombatState(item)}<span>Poids ${add2eHudCombatEscape(weight)}</span></div>
    </div>
    <button type="button" class="act" data-add2e-hud-combat-action="equip" data-item-id="${itemId}">${actionLabel}</button>
  </div>`;
}

function add2eHudCombatSubtab(key, label, count) {
  return `<button type="button" class="a2e-hud-combat-subtab ${add2eHudCombatTab === key ? "active" : ""}" data-add2e-hud-combat-tab="${key}">${label} <span>${count}</span></button>`;
}

function add2eHudCombatContent(sheetData) {
  const { objects, weapons, projectiles, armors } = add2eHudCombatCollections(sheetData);
  if (!["armes", "projectiles", "armures"].includes(add2eHudCombatTab)) add2eHudCombatTab = "armes";
  const tabs = `<div class="a2e-hud-combat-subtabs">
    ${add2eHudCombatSubtab("armes", "Armes", weapons.length)}
    ${add2eHudCombatSubtab("projectiles", "Projectiles", projectiles.length)}
    ${add2eHudCombatSubtab("armures", "Armures", armors.length)}
  </div>`;

  let rows = "";
  if (add2eHudCombatTab === "projectiles") rows = projectiles.map(add2eHudCombatProjectileRow).join("") || '<div class="empty">Aucun projectile dans le carquois.</div>';
  else if (add2eHudCombatTab === "armures") rows = armors.map(add2eHudCombatArmorRow).join("") || '<div class="empty">Aucune armure.</div>';
  else rows = weapons.map(weapon => add2eHudCombatWeaponRow(weapon, objects)).join("") || '<div class="empty">Aucune arme.</div>';
  return `<div class="spell-layout"><div class="a2e-hud-combat-panel">${tabs}<div class="a2e-hud-combat-list">${rows}</div></div></div>`;
}

function add2eHudEquipmentContent(sheetData, moneyHtml = "") {
  const { equipment } = add2eHudCombatCollections(sheetData);
  const rows = equipment.map(add2eHudEquipmentRow).join("") || '<div class="empty">Aucun équipement.</div>';
  return `${moneyHtml}<div class="a2e-hud-equipment-list">${rows}</div>`;
}

function add2eHudCombatEnsureStyle() {
  if (document.getElementById(ADD2E_HUD_COMBAT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD2E_HUD_COMBAT_STYLE_ID;
  style.textContent = `
    #${ADD2E_HUD_ID} .a2e-hud-combat-subtabs{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:4px;border-bottom:1px solid rgba(214,176,90,.28)}
    #${ADD2E_HUD_ID} .a2e-hud-combat-subtab{min-height:30px;padding:5px 10px;border:1px solid rgba(214,176,90,.55);border-radius:999px;background:rgba(214,176,90,.12);color:#ffe4a1;font-weight:900;font-size:.82em;cursor:pointer}
    #${ADD2E_HUD_ID} .a2e-hud-combat-subtab.active{background:linear-gradient(180deg,#f0c66d,#c78d2e);color:#211307}
    #${ADD2E_HUD_ID} .a2e-hud-combat-list,#${ADD2E_HUD_ID} .a2e-hud-equipment-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;padding-right:3px}
    #${ADD2E_HUD_ID} .a2e-hud-combat-list .state,#${ADD2E_HUD_ID} .a2e-hud-equipment-list .state{min-width:64px;text-align:center;font-weight:900;border:1px solid rgba(214,176,90,.35);border-radius:999px;padding:2px 6px;background:rgba(0,0,0,.18)}
    #${ADD2E_HUD_ID} .a2e-hud-combat-list .equip-bad,#${ADD2E_HUD_ID} .a2e-hud-equipment-list .equip-bad{color:#ffb1a8}
    #${ADD2E_HUD_ID} .a2e-hud-thief-activity{display:grid;gap:7px;padding:9px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}
    #${ADD2E_HUD_ID} .a2e-hud-thief-warning{border:2px solid #8b0000;background:rgba(255,70,70,.82);color:#111;text-align:center;font-weight:900;line-height:1.3}
    #${ADD2E_HUD_ID} .a2e-hud-thief-warning h3{margin:0;color:#111;font-size:1.08em}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px 8px;border:1px solid rgba(113,155,218,.7);border-radius:10px;background:rgba(58,88,136,.22)}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-actions-title{flex:1 1 100%;color:#d9ebff;font-size:.82em;font-weight:900}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-action{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:5px 9px;border:1px solid rgba(152,194,255,.75);border-radius:8px;background:rgba(90,136,204,.32);color:#eff7ff;font-size:.8em;font-weight:900;cursor:pointer}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-action:hover{filter:brightness(1.2)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-panel{display:grid;gap:6px;padding:7px;border:1px solid rgba(126,181,221,.74);border-radius:10px;background:rgba(41,81,125,.24)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-title{color:#d9ebff;font-size:.82em;font-weight:950}
    #${ADD2E_HUD_ID} .a2e-hud-racial-row{border-color:rgba(126,181,221,.54);background:rgba(10,24,42,.24)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-icon{color:#e8f4ff;border-color:rgba(152,194,255,.85);background:rgba(64,116,175,.35)}
    #${ADD2E_HUD_ID} .a2e-hud-racial-icon i{font-size:1.25em}
    #${ADD2E_HUD_ID} .a2e-hud-racial-description{color:#d8e8fa;font-size:.78em;line-height:1.35;margin-top:3px}
  `;
  document.head.appendChild(style);
}

function add2eHudCombatObserveRoot(root) {
  if (add2eHudCombatObservedRoot === root) return;
  add2eHudCombatRootObserver?.disconnect?.();
  add2eHudCombatObservedRoot = root ?? null;
  if (!root) return;
  add2eHudCombatRootObserver = new MutationObserver(() => {
    if (add2eHudCombatSuppressMutation) return;
    add2eHudCombatScheduleRender();
    add2eHudThiefActivityScheduleRender();
    add2eHudFamiliarActionsScheduleRender();
    add2eHudRacialScheduleRender();
  });
  add2eHudCombatRootObserver.observe(root, { childList: true, subtree: true });
}

async function add2eHudCombatRender() {
  if (add2eHudCombatRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudCombatCurrentActor();
  if (!root || !actor) return;
  const combatSection = root.querySelector('[data-section="attaques"]');
  const equipmentSection = root.querySelector('[data-section="equipement"]');
  if (!combatSection && !equipmentSection) return;
  add2eHudCombatRendering = true;
  add2eHudCombatSuppressMutation = true;
  try {
    add2eHudCombatEnsureStyle();
    add2eHudCombatObserveRoot(root);
    const moneyHtml = equipmentSection?.querySelector?.(".money-row")?.outerHTML ?? "";
    const sheetData = await add2eHudCombatSheetData(actor);
    if (!root.isConnected || add2eHudCombatCurrentActor()?.id !== actor.id) return;
    if (combatSection) {
      combatSection.innerHTML = sheetData
        ? add2eHudCombatContent(sheetData)
        : '<div class="empty">Données de combat de la feuille indisponibles.</div>';
    }
    if (equipmentSection) {
      equipmentSection.innerHTML = sheetData
        ? add2eHudEquipmentContent(sheetData, moneyHtml)
        : `${moneyHtml}<div class="empty">Données d’équipement de la feuille indisponibles.</div>`;
    }
  } finally {
    add2eHudCombatRendering = false;
    window.setTimeout(() => { add2eHudCombatSuppressMutation = false; }, 0);
  }
}

function add2eHudCombatScheduleRender() {
  if (add2eHudCombatRenderScheduled) return;
  add2eHudCombatRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    add2eHudCombatRenderScheduled = false;
    add2eHudCombatRender();
  });
}

function add2eHudCombatScheduleStableRender() {
  add2eHudCombatScheduleRender();
  add2eHudFamiliarActionsScheduleRender();
  add2eHudRacialScheduleRender();
  window.setTimeout(add2eHudCombatScheduleRender, 90);
  window.setTimeout(add2eHudCombatScheduleRender, 180);
  window.setTimeout(add2eHudFamiliarActionsScheduleRender, 90);
  window.setTimeout(add2eHudFamiliarActionsRender, 180);
  window.setTimeout(add2eHudRacialScheduleRender, 90);
  window.setTimeout(add2eHudRacialScheduleRender, 180);
}

function add2eHudFamiliarEffectData(effect) {
  return effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
}

function add2eHudFamiliarActionEffects(actor) {
  return Array.from(actor?.effects ?? [])
    .filter(effect => effect?.disabled !== true && effect?.isSuppressed !== true)
    .map(effect => ({ effect, data: add2eHudFamiliarEffectData(effect) }))
    .filter(({ data }) => data?.kind === "action" && ["share-senses", "toggle-follow"].includes(String(data.action ?? "")));
}

function add2eHudFamiliarActionInfo(data = {}) {
  if (data.action === "share-senses") return { icon: "fa-eye", label: "Vision partagée", title: "Voir avec les sens du familier" };
  return { icon: "fa-link", label: "Suivi", title: "Activer ou désactiver le suivi automatique" };
}

function add2eHudFamiliarActionsSignature(actor, rows) {
  return JSON.stringify({ actorId: actor?.id ?? "", rows: rows.map(({ effect, data }) => ({ id: effect?.id ?? effect?._id ?? "", action: data?.action ?? "", name: effect?.name ?? "", description: effect?.description ?? "" })) });
}

function add2eHudFamiliarActionsHtml(actor, rows) {
  const controls = rows.map(({ effect, data }) => {
    const info = add2eHudFamiliarActionInfo(data);
    return `<button type="button" class="a2e-hud-familiar-action a2e-familiar-effect-action" data-actor-id="${add2eHudCombatEscape(actor.id)}" data-effect-id="${add2eHudCombatEscape(effect.id ?? effect._id ?? "")}" data-familiar-action="${add2eHudCombatEscape(data.action)}" title="${add2eHudCombatEscape(info.title)}"><i class="fas ${info.icon}"></i> ${add2eHudCombatEscape(info.label)}</button>`;
  }).join("");
  return `<div class="a2e-hud-familiar-actions-title"><i class="fas fa-paw"></i> Commandes du familier</div>${controls}`;
}

function add2eHudFamiliarActionsRender() {
  if (add2eHudFamiliarActionsRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudCombatCurrentActor();
  const section = root?.querySelector?.('[data-section="effets"]');
  if (!root || !actor || !section) return;
  const rows = add2eHudFamiliarActionEffects(actor);
  const existing = section.querySelector(':scope > .a2e-hud-familiar-actions');
  if (!rows.length) {
    existing?.remove?.();
    return;
  }
  const signature = add2eHudFamiliarActionsSignature(actor, rows);
  if (existing?.dataset?.add2eHudFamiliarSignature === signature) return;
  add2eHudFamiliarActionsRendering = true;
  add2eHudCombatSuppressMutation = true;
  try {
    add2eHudCombatEnsureStyle();
    existing?.remove?.();
    const panel = document.createElement("div");
    panel.className = "a2e-hud-familiar-actions";
    panel.dataset.add2eHudFamiliarSignature = signature;
    panel.innerHTML = add2eHudFamiliarActionsHtml(actor, rows);
    section.prepend(panel);
  } finally {
    add2eHudFamiliarActionsRendering = false;
    window.setTimeout(() => { add2eHudCombatSuppressMutation = false; }, 0);
  }
}

function add2eHudFamiliarActionsScheduleRender() {
  if (add2eHudFamiliarActionsRenderScheduled) return;
  add2eHudFamiliarActionsRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    add2eHudFamiliarActionsRenderScheduled = false;
    add2eHudFamiliarActionsRender();
  });
}

function add2eHudThiefActivityStatus(actor) {
  try {
    const status = globalThis.add2eGetThiefActivityEquipmentStatus?.(actor);
    if (status && typeof status === "object") return status;
  } catch (err) {
    console.warn("[ADD2E][HUD][VOLEUR][ACTIVITE]", err);
  }
  return { applies: false, ok: true, blockingItems: [], message: "" };
}

function add2eHudThiefActivitySignature(status) {
  return JSON.stringify({ applies: status?.applies === true, ok: status?.ok !== false, message: status?.message ?? "", blockingItems: (status?.blockingItems ?? []).map(item => item?.name ?? "") });
}

function add2eHudThiefActivityWarningHtml(status) {
  const names = (status?.blockingItems ?? []).map(item => String(item?.name ?? "").trim()).filter(Boolean);
  const equipment = names.length ? `Équipement actuellement incompatible : <strong>${add2eHudCombatEscape(names.join(", "))}</strong>.` : "Un équipement actuellement porté est incompatible avec les activités de voleur.";
  const message = add2eHudCombatEscape(status?.message || "Les capacités de voleur ne peuvent pas être utilisées avec l'équipement actuellement porté.");
  return `<h3><i class="fas fa-triangle-exclamation"></i> Capacités de voleur indisponibles</h3><div>${message}</div><div style="font-size:.84em;">${equipment}</div>`;
}

function add2eHudThiefActivityRender() {
  if (add2eHudThiefActivityRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudCombatCurrentActor();
  const section = root?.querySelector?.('[data-section="capacites"]');
  if (!root || !actor || !section) return;
  const status = add2eHudThiefActivityStatus(actor);
  const panels = [...section.querySelectorAll(':scope > .a2e-hud-thief-activity')];
  if (!status.applies || status.ok !== false) {
    panels.forEach(panel => panel.remove());
    return;
  }
  const signature = add2eHudThiefActivitySignature(status);
  if (panels.length === 1 && panels[0]?.dataset?.add2eHudThiefSignature === signature) return;
  add2eHudThiefActivityRendering = true;
  add2eHudCombatSuppressMutation = true;
  try {
    panels.forEach(panel => panel.remove());
    const panel = document.createElement("div");
    panel.className = "a2e-hud-thief-activity a2e-hud-thief-warning";
    panel.dataset.add2eHudThiefSignature = signature;
    panel.innerHTML = add2eHudThiefActivityWarningHtml(status);
    section.prepend(panel);
  } finally {
    add2eHudThiefActivityRendering = false;
    window.setTimeout(() => { add2eHudCombatSuppressMutation = false; }, 0);
  }
}

function add2eHudThiefActivityScheduleRender() {
  if (add2eHudThiefActivityRenderScheduled) return;
  add2eHudThiefActivityRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    add2eHudThiefActivityRenderScheduled = false;
    add2eHudThiefActivityRender();
  });
}

// ---------------------------------------------------------------------------
// Racial HUD — affichage des données de la feuille ; les actions sont déléguées
// au contrôleur unique add2eUseRacialCapabilityFromElement.
// ---------------------------------------------------------------------------

function add2eHudRacialEngine() {
  const engine = globalThis.Add2eEffectsEngine;
  return typeof engine?.getRacialActions === "function" ? engine : null;
}

function add2eHudRacialPassives(actor) {
  const engine = add2eHudRacialEngine();
  if (!engine) return [];
  return engine.getRacialPassiveEffects?.(actor)
    ?? engine.getRacialVirtualEffects?.(actor)?.filter(effect => effect?.kind !== "capability")
    ?? [];
}

function add2eHudRacialCapabilities(actor) {
  return add2eHudRacialEngine()?.getRacialActions?.(actor)?.filter(capability => capability?.activable !== false) ?? [];
}

function add2eHudRacialIcon(capability) {
  const explicit = String(capability?.iconClass ?? "").trim();
  if (explicit) return explicit;
  const key = String(capability?.id ?? capability?.label ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (key.includes("infravision") || key.includes("vision")) return "fa-eye";
  if (key.includes("porte")) return "fa-door-closed";
  if (key.includes("pente")) return "fa-mountain";
  if (key.includes("direction") || key.includes("profondeur")) return "fa-compass";
  if (key.includes("paroi") || key.includes("construction")) return "fa-hammer";
  if (key.includes("piege")) return "fa-triangle-exclamation";
  if (key.includes("surprise")) return "fa-user-ninja";
  return "fa-dice-d20";
}

function add2eHudRacialRequirementLabel(value) {
  return {
    within_three_meters: "à 3 m ou moins",
    search_active: "recherche active",
    underground: "sous terre",
    concentration: "concentration",
    alone: "isolé",
    no_metal_armor: "sans armure de métal",
    opens_door: "après ouverture d’une porte",
    no_intense_light: "aucune lumière ou chaleur intense"
  }[String(value ?? "").trim()] ?? String(value ?? "").replaceAll("_", " ");
}

function add2eHudRacialRequirements(capability) {
  const value = capability?.requires;
  const raw = Array.isArray(value) ? value : (value instanceof Set ? [...value] : (value ? Object.values(value) : []));
  return raw.map(add2eHudRacialRequirementLabel).filter(Boolean);
}

function add2eHudRacialSignature(actor, passives, capabilities) {
  return JSON.stringify({
    actorId: actor?.id ?? "",
    passives: passives.map(effect => [effect.id, effect.name, effect.description]),
    capabilities: capabilities.map(capability => [capability.id, capability.label, capability.description, capability.formula, capability.successAt, capability.requires, capability.actionType, capability.enabled])
  });
}

function add2eHudRacialPassiveRow(effect) {
  return `<div class="row effect-row a2e-hud-racial-row">
    <img src="${add2eHudCombatEscape(effect.img || "icons/svg/aura.svg")}" alt="">
    <div><div class="title">${add2eHudCombatEscape(effect.name)}</div><div class="meta"><span>${add2eHudCombatEscape(effect.sourceName || "Race")}</span><span>${add2eHudCombatEscape(effect.duration || "Permanent")}</span></div><div class="a2e-hud-racial-description">${add2eHudCombatEscape(effect.description)}</div></div>
    <span aria-hidden="true"></span>
  </div>`;
}

function add2eHudRacialCapabilityRow(capability) {
  const isVisionToggle = capability?.actionType === "vision-toggle";
  const conditions = (!isVisionToggle || capability?.enabled !== true) ? add2eHudRacialRequirements(capability) : [];
  const state = isVisionToggle
    ? (capability?.enabled ? "Active" : "Inactive")
    : (capability?.canRoll ? `Jet ${capability.formula} : réussite ≤ ${capability.successAt}` : "Capacité narrative");
  const conditionLabel = conditions.length ? `<span>Conditions : ${add2eHudCombatEscape(conditions.join(", "))}</span>` : "";
  const title = isVisionToggle
    ? `${capability?.enabled ? "Désactiver" : "Activer"} ${capability.label}`
    : (capability.canRoll ? `Lancer ${capability.label}` : capability.label);
  const icon = isVisionToggle && capability?.enabled ? "fa-eye-slash" : add2eHudRacialIcon(capability);
  const control = (isVisionToggle || capability.canRoll)
    ? `<button type="button" class="img-act a2e-hud-racial-icon" data-add2e-hud-racial-action="use" data-racial-capability-id="${add2eHudCombatEscape(capability.id)}" title="${add2eHudCombatEscape(title)}"><i class="fas ${icon}"></i></button>`
    : '<span aria-hidden="true"></span>';
  return `<div class="row a2e-hud-racial-row">
    ${control}
    <div><div class="title">${add2eHudCombatEscape(capability.label)}</div><div class="meta"><span>Capacité raciale</span><span>${add2eHudCombatEscape(state)}</span>${conditionLabel}</div><div class="a2e-hud-racial-description">${add2eHudCombatEscape(capability.description)}</div></div>
  </div>`;
}

function add2eHudRacialRender() {
  if (add2eHudRacialRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudCombatCurrentActor();
  const engine = add2eHudRacialEngine();
  if (!root || !actor || !engine) return;
  const passives = add2eHudRacialPassives(actor);
  const capabilities = add2eHudRacialCapabilities(actor);
  const signature = add2eHudRacialSignature(actor, passives, capabilities);

  add2eHudRacialRendering = true;
  add2eHudCombatSuppressMutation = true;
  try {
    add2eHudCombatEnsureStyle();
    const effectsSection = root.querySelector('[data-section="effets"]');
    if (effectsSection) {
      const existing = effectsSection.querySelector(':scope > .a2e-hud-racial-effects');
      if (!passives.length) existing?.remove?.();
      else if (existing?.dataset?.add2eHudRacialSignature !== signature) {
        existing?.remove?.();
        const panel = document.createElement("div");
        panel.className = "a2e-hud-racial-panel a2e-hud-racial-effects";
        panel.dataset.add2eHudRacialSignature = signature;
        panel.innerHTML = `<div class="a2e-hud-racial-title"><i class="fas fa-dna"></i> Effets raciaux</div>${passives.map(add2eHudRacialPassiveRow).join("")}`;
        effectsSection.prepend(panel);
        for (const empty of effectsSection.querySelectorAll(':scope > .empty')) empty.remove();
      }
    }

    const capabilitiesSection = root.querySelector('[data-section="capacites"]');
    if (capabilitiesSection) {
      const existing = capabilitiesSection.querySelector(':scope > .a2e-hud-racial-capabilities');
      if (!capabilities.length) existing?.remove?.();
      else if (existing?.dataset?.add2eHudRacialSignature !== signature) {
        existing?.remove?.();
        const panel = document.createElement("div");
        panel.className = "a2e-hud-racial-panel a2e-hud-racial-capabilities";
        panel.dataset.add2eHudRacialSignature = signature;
        panel.innerHTML = `<div class="a2e-hud-racial-title"><i class="fas fa-dna"></i> Capacités raciales</div>${capabilities.map(add2eHudRacialCapabilityRow).join("")}`;
        capabilitiesSection.prepend(panel);
        for (const empty of capabilitiesSection.querySelectorAll(':scope > .empty')) empty.remove();
      }
    }
  } finally {
    add2eHudRacialRendering = false;
    window.setTimeout(() => { add2eHudCombatSuppressMutation = false; }, 0);
  }
}

function add2eHudRacialScheduleRender() {
  if (add2eHudRacialRenderScheduled) return;
  add2eHudRacialRenderScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    add2eHudRacialRenderScheduled = false;
    add2eHudRacialRender();
  });
}

async function add2eHudRacialRun(actor, capabilityId) {
  const use = globalThis.add2eUseRacialCapabilityFromElement;
  if (typeof use !== "function") {
    ui.notifications?.error?.("Le contrôleur des capacités raciales de la feuille n’est pas chargé.");
    return false;
  }
  const relay = document.createElement("button");
  relay.dataset.racialCapabilityId = String(capabilityId ?? "");
  return use(actor, relay, null);
}

async function add2eHudCombatRunAction(actor, itemId, action) {
  const item = actor?.items?.get?.(itemId) ?? null;
  if (!item) return ui.notifications?.warn?.("Objet introuvable.");
  if (action === "attack") {
    if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications?.error?.("Mécanique d'attaque indisponible.");
    return globalThis.add2eAttackRoll({ actor, arme: item });
  }
  if (action === "equip") {
    if (typeof globalThis.handleItemAction !== "function") return ui.notifications?.error?.("Mécanique d'équipement indisponible.");
    return globalThis.handleItemAction({ actor, action: "equip", itemId: item.id, itemType: item.type, sheet: null });
  }
}

function add2eHudCombatInstall() {
  if (globalThis.__ADD2E_HUD_COMBAT_DELEGATE_SHEET_MECHANICS_V1) return;
  globalThis.__ADD2E_HUD_COMBAT_DELEGATE_SHEET_MECHANICS_V1 = true;

  document.addEventListener("click", async event => {
    const racial = event.target?.closest?.("[data-add2e-hud-racial-action][data-racial-capability-id]");
    if (racial) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const actor = add2eHudCombatCurrentActor();
      if (!actor) return ui.notifications?.warn?.("Acteur HUD introuvable.");
      await add2eHudRacialRun(actor, racial.dataset.racialCapabilityId);
      add2eHudRacialScheduleRender();
      return;
    }

    const tab = event.target?.closest?.("[data-add2e-hud-combat-tab]");
    if (tab) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      add2eHudCombatTab = tab.dataset.add2eHudCombatTab || "armes";
      add2eHudCombatRender();
      return;
    }

    const button = event.target?.closest?.("[data-add2e-hud-combat-action][data-item-id]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const actor = add2eHudCombatCurrentActor();
    if (!actor) return ui.notifications?.warn?.("Acteur HUD introuvable.");
    await add2eHudCombatRunAction(actor, button.dataset.itemId, button.dataset.add2eHudCombatAction);
    globalThis.add2eRefreshActionHud?.();
    add2eHudCombatScheduleStableRender();
  }, true);

  add2eHudCombatBodyObserver = new MutationObserver(mutations => {
    if (add2eHudCombatSuppressMutation) return;
    const hudAdded = mutations.some(mutation => [...(mutation.addedNodes ?? [])].some(node => node?.id === ADD2E_HUD_ID || node?.querySelector?.(`#${ADD2E_HUD_ID}`)));
    if (hudAdded) {
      add2eHudCombatScheduleStableRender();
      add2eHudThiefActivityScheduleRender();
      add2eHudFamiliarActionsScheduleRender();
      add2eHudRacialScheduleRender();
    }
  });
  add2eHudCombatBodyObserver.observe(document.body, { childList: true, subtree: true });

  Hooks.on("updateItem", item => {
    const actor = add2eHudCombatCurrentActor();
    if (item?.parent?.id !== actor?.id) return;
    add2eHudCombatScheduleStableRender();
  });
  Hooks.on("updateActor", actor => {
    if (actor?.id === add2eHudCombatCurrentActor()?.id) add2eHudRacialScheduleRender();
  });

  const refresh = globalThis.add2eRefreshActionHud;
  if (typeof refresh === "function" && !refresh.__add2eHudCombatDelegated) {
    const wrapped = async function add2eRefreshActionHudWithCombatDelegation(...args) {
      const result = await refresh.apply(this, args);
      add2eHudCombatScheduleStableRender();
      add2eHudThiefActivityScheduleRender();
      add2eHudFamiliarActionsScheduleRender();
      add2eHudRacialScheduleRender();
      return result;
    };
    wrapped.__add2eHudCombatDelegated = true;
    globalThis.add2eRefreshActionHud = wrapped;
  }

  game.add2e = game.add2e ?? {};
  game.add2e.actionHudCombatTabsVersion = ADD2E_HUD_COMBAT_TABS_VERSION;
  add2eHudCombatScheduleStableRender();
  add2eHudThiefActivityScheduleRender();
  add2eHudFamiliarActionsScheduleRender();
  add2eHudRacialScheduleRender();
}

if (game?.ready) add2eHudCombatInstall();
else Hooks.once("ready", add2eHudCombatInstall());
