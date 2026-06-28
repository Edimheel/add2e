// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison.
// Point d'entrée conservé pour system.json.
// Le cœur historique reste dans scripts/add2e-action-hud/core.mjs.

export {
  add2eRenderActionHud,
  add2eRefreshActionHud,
  add2eCloseActionHud
} from "./add2e-action-hud/core.mjs";

// ADD2E — Sous-onglets Combat du HUD.
// Cette vue est volontairement une version compacte de la feuille personnage :
// - listes directes de la feuille (armes, armures, carquois préparé) ;
// - attaque via add2eAttackRoll ;
// - équipement via handleItemAction.
// Aucune règle d'arme, projectile, armure, bouclier ou compatibilité n'est dupliquée ici.

const ADD2E_HUD_COMBAT_TABS_VERSION = "2026-06-28-hud-combat-lists-familiar-actions-spell-memory-v6";
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
let add2eHudSpellMemorySyncScheduled = false;
let add2eHudSpellMemorySyncing = false;

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
  const hasThrownRange = Number(system.portee_courte ?? system.porteeCourte ?? 0) > 0 ||
    Number(system.portee_moyenne ?? system.porteeMoyenne ?? 0) > 0 ||
    Number(system.portee_longue ?? system.porteeLongue ?? 0) > 0;
  if (!hasThrownTag && !hasThrownRange) return null;

  const available = Math.max(0, Math.floor(Number(rawQuantity) || 0));
  return `<span>Disponibles ${add2eHudCombatEscape(available)}</span>`;
}

function add2eHudCombatCollections(actor) {
  const items = [...(actor?.items ?? [])];
  const objects = items.filter(item => String(item?.type ?? "").toLowerCase() === "objet");
  const data = { actor, listeObjets: objects };
  const prepare = game?.add2e?.consumables?.prepareActorSheetConsumables
    ?? globalThis.ADD2E_CONSUMABLES?.prepareActorSheetConsumables;

  if (typeof prepare === "function") prepare(data);

  return {
    objects,
    weapons: items.filter(item => String(item?.type ?? "").toLowerCase() === "arme"),
    armors: items.filter(item => String(item?.type ?? "").toLowerCase() === "armure"),
    projectiles: Array.isArray(data.listeCarquois) ? data.listeCarquois : []
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

function add2eHudCombatSubtab(key, label, count) {
  return `<button type="button" class="a2e-hud-combat-subtab ${add2eHudCombatTab === key ? "active" : ""}" data-add2e-hud-combat-tab="${key}">${label} <span>${count}</span></button>`;
}

function add2eHudCombatContent(actor) {
  const { objects, weapons, projectiles, armors } = add2eHudCombatCollections(actor);
  if (!["armes", "projectiles", "armures"].includes(add2eHudCombatTab)) add2eHudCombatTab = "armes";

  const tabs = `<div class="a2e-hud-combat-subtabs">
    ${add2eHudCombatSubtab("armes", "Armes", weapons.length)}
    ${add2eHudCombatSubtab("projectiles", "Projectiles", projectiles.length)}
    ${add2eHudCombatSubtab("armures", "Armures", armors.length)}
  </div>`;

  let rows = "";
  if (add2eHudCombatTab === "projectiles") {
    rows = projectiles.map(add2eHudCombatProjectileRow).join("") || '<div class="empty">Aucun projectile dans le carquois.</div>';
  } else if (add2eHudCombatTab === "armures") {
    rows = armors.map(add2eHudCombatArmorRow).join("") || '<div class="empty">Aucune armure.</div>';
  } else {
    rows = weapons.map(weapon => add2eHudCombatWeaponRow(weapon, objects)).join("") || '<div class="empty">Aucune arme.</div>';
  }

  return `<div class="spell-layout"><div class="a2e-hud-combat-panel">${tabs}<div class="a2e-hud-combat-list">${rows}</div></div></div>`;
}

function add2eHudCombatEnsureStyle() {
  if (document.getElementById(ADD2E_HUD_COMBAT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD2E_HUD_COMBAT_STYLE_ID;
  style.textContent = `
    #${ADD2E_HUD_ID} .a2e-hud-combat-subtabs{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:4px;border-bottom:1px solid rgba(214,176,90,.28)}
    #${ADD2E_HUD_ID} .a2e-hud-combat-subtab{min-height:30px;padding:5px 10px;border:1px solid rgba(214,176,90,.55);border-radius:999px;background:rgba(214,176,90,.12);color:#ffe4a1;font-weight:900;font-size:.82em;cursor:pointer}
    #${ADD2E_HUD_ID} .a2e-hud-combat-subtab.active{background:linear-gradient(180deg,#f0c66d,#c78d2e);color:#211307}
    #${ADD2E_HUD_ID} .a2e-hud-combat-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;padding-right:3px}
    #${ADD2E_HUD_ID} .a2e-hud-combat-list .state{min-width:64px;text-align:center;font-weight:900;border:1px solid rgba(214,176,90,.35);border-radius:999px;padding:2px 6px;background:rgba(0,0,0,.18)}
    #${ADD2E_HUD_ID} .a2e-hud-combat-list .equip-bad{color:#ffb1a8}
    #${ADD2E_HUD_ID} .a2e-hud-thief-activity{display:grid;gap:7px;padding:9px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}
    #${ADD2E_HUD_ID} .a2e-hud-thief-warning{border:2px solid #8b0000;background:rgba(255,70,70,.82);color:#111;text-align:center;font-weight:900;line-height:1.3}
    #${ADD2E_HUD_ID} .a2e-hud-thief-warning h3{margin:0;color:#111;font-size:1.08em}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px 8px;border:1px solid rgba(113,155,218,.7);border-radius:10px;background:rgba(58,88,136,.22)}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-actions-title{flex:1 1 100%;color:#d9ebff;font-size:.82em;font-weight:900}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-action{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:5px 9px;border:1px solid rgba(152,194,255,.75);border-radius:8px;background:rgba(90,136,204,.32);color:#eff7ff;font-size:.8em;font-weight:900;cursor:pointer}
    #${ADD2E_HUD_ID} .a2e-hud-familiar-action:hover{filter:brightness(1.2)}
  `;
  document.head.appendChild(style);
}

function add2eHudSpellNumericTree(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value).reduce((sum, child) => sum + add2eHudSpellNumericTree(child), 0);
}

function add2eHudSpellMemorizedCount(sort) {
  try {
    const total = globalThis.add2eGetTotalMemorizedCount?.(sort);
    if (total !== undefined && total !== null && total !== "") {
      const numeric = Number(total);
      if (Number.isFinite(numeric)) return Math.max(0, Math.floor(numeric));
    }
  } catch (_error) {}

  const flags = sort?.flags?.add2e ?? {};
  const direct = sort?.getFlag?.("add2e", "memorizedCount") ?? flags.memorizedCount;
  if (direct !== undefined && direct !== null && direct !== "") {
    const numeric = Number(direct);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  }

  const byList = sort?.getFlag?.("add2e", "memorizedByList") ?? flags.memorizedByList;
  return add2eHudSpellNumericTree(byList);
}

function add2eHudSpellIsObjectPower(sort) {
  const system = sort?.system ?? {};
  if (system.isPower === true || system.isObjectPower === true || system.sourceWeaponId || system.sourceItemId || system.powerIndex !== undefined) return true;
  try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort) === true; }
  catch (_error) { return false; }
}

function add2eHudSpellLevel(sort) {
  return Math.max(0, Math.floor(Number(sort?.system?.niveau ?? sort?.system?.level ?? sort?.system?.niveau_sort ?? 0) || 0));
}

function add2eHudSpellListLabel(sort) {
  const system = sort?.system ?? {};
  const rawValues = [
    system.liste, system.list, system.spellList, system.classe, system.class,
    system.sourceClasse, system.casterClass,
    ...(Array.isArray(system.lists) ? system.lists : [system.lists]),
    ...(Array.isArray(system.listes) ? system.listes : [system.listes]),
    ...(Array.isArray(system.classes) ? system.classes : [system.classes])
  ];
  const raw = rawValues.map(value => String(value ?? "").trim()).find(Boolean) || "Mag";
  const normalized = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_");
  if (normalized.includes("clerc") || normalized.includes("pretre") || normalized.includes("priest")) return "Clerc";
  if (normalized.includes("druid") || normalized.includes("druide")) return "Dru";
  if (normalized.includes("ranger")) return "Rng";
  if (normalized.includes("paladin")) return "Pal";
  if (normalized.includes("mag") || normalized.includes("wizard") || normalized.includes("mage")) return "Mag";
  return String(raw).slice(0, 6);
}

function add2eHudSpellGroupKey(sort) {
  return `${add2eHudSpellListLabel(sort)}|${add2eHudSpellLevel(sort)}`;
}

function add2eHudSpellGroups(actor) {
  const groups = new Map();
  for (const sort of Array.from(actor?.items ?? [])) {
    if (String(sort?.type ?? "").toLowerCase() !== "sort" || add2eHudSpellIsObjectPower(sort)) continue;
    const memorized = add2eHudSpellMemorizedCount(sort);
    if (memorized <= 0) continue;
    const key = add2eHudSpellGroupKey(sort);
    const current = groups.get(key) ?? { spells: 0, memorized: 0 };
    current.spells += 1;
    current.memorized += memorized;
    groups.set(key, current);
  }
  return groups;
}

function add2eHudSpellMemorySignature(actor, groups) {
  return JSON.stringify({
    actorId: actor?.id ?? "",
    groups: [...groups.entries()].map(([key, value]) => [key, value.spells, value.memorized]),
    spells: Array.from(actor?.items ?? [])
      .filter(item => String(item?.type ?? "").toLowerCase() === "sort")
      .map(item => [item.id, add2eHudSpellMemorizedCount(item)])
  });
}

function add2eHudSpellMemorySynchronize() {
  if (add2eHudSpellMemorySyncing) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudCombatCurrentActor();
  const section = root?.querySelector?.('[data-section="sorts"]');
  if (!root || !actor || !section) return;

  const groups = add2eHudSpellGroups(actor);
  const signature = add2eHudSpellMemorySignature(actor, groups);
  if (section.dataset.add2eHudSpellMemorySignature === signature) return;

  add2eHudSpellMemorySyncing = true;
  add2eHudCombatSuppressMutation = true;
  try {
    const groupButtons = [...section.querySelectorAll('button[data-action="select-spell-group"][data-spell-group]')];
    let activeMissing = false;
    let firstAvailable = null;

    for (const button of groupButtons) {
      const group = groups.get(button.dataset.spellGroup ?? "");
      if (!group) {
        if (button.classList.contains("active")) activeMissing = true;
        button.remove();
        continue;
      }
      firstAvailable ??= button;
      const badge = button.querySelector("span");
      if (badge) badge.textContent = String(group.memorized);
    }

    for (const button of [...section.querySelectorAll('button[data-action="cast-spell"][data-item-id]')]) {
      const sort = actor.items?.get?.(button.dataset.itemId) ?? null;
      const row = button.closest?.(".row");
      const memorized = sort ? add2eHudSpellMemorizedCount(sort) : 0;
      if (!row || memorized <= 0) {
        row?.remove?.();
        continue;
      }
      const badge = [...row.querySelectorAll(".meta span")]
        .find(element => /^Mémorisé\s+/i.test(String(element.textContent ?? "")));
      if (badge) badge.textContent = `Mémorisé ${memorized}`;
    }

    if (!groups.size) {
      section.innerHTML = '<div class="empty">Aucun sort mémorisé.</div>';
    } else if (activeMissing && firstAvailable?.isConnected) {
      window.setTimeout(() => firstAvailable.click(), 0);
    } else if (!section.querySelector('button[data-action="cast-spell"]')) {
      const list = section.querySelector(".spell-list");
      if (list) list.innerHTML = '<div class="empty">Aucun sort mémorisé.</div>';
    }

    section.dataset.add2eHudSpellMemorySignature = signature;
  } finally {
    add2eHudSpellMemorySyncing = false;
    window.setTimeout(() => { add2eHudCombatSuppressMutation = false; }, 0);
  }
}

function add2eHudSpellMemoryScheduleSync() {
  if (add2eHudSpellMemorySyncScheduled) return;
  add2eHudSpellMemorySyncScheduled = true;
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(() => {
    add2eHudSpellMemorySyncScheduled = false;
    add2eHudSpellMemorySynchronize();
  });
}

function add2eHudCombatObserveRoot(root) {
  if (add2eHudCombatObservedRoot === root) return;
  add2eHudCombatRootObserver?.disconnect?.();
  add2eHudCombatObservedRoot = root ?? null;
  if (!root) return;

  add2eHudCombatRootObserver = new MutationObserver(() => {
    if (!add2eHudCombatSuppressMutation) {
      add2eHudCombatScheduleRender();
      add2eHudThiefActivityScheduleRender();
      add2eHudFamiliarActionsScheduleRender();
      add2eHudSpellMemoryScheduleSync();
    }
  });
  add2eHudCombatRootObserver.observe(root, { childList: true, subtree: true });
}

function add2eHudCombatRender() {
  if (add2eHudCombatRendering) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudCombatCurrentActor();
  if (!root || !actor) return;
  const section = root.querySelector('[data-section="attaques"]');
  if (!section) return;

  add2eHudCombatRendering = true;
  add2eHudCombatSuppressMutation = true;
  try {
    add2eHudCombatEnsureStyle();
    add2eHudCombatObserveRoot(root);
    section.innerHTML = add2eHudCombatContent(actor);
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
  add2eHudSpellMemoryScheduleSync();
  // core.mjs reconstruit le HUD à la suite d'un updateItem. Ces deux passages
  // restaurent immédiatement les listes complètes après ce rendu tardif.
  window.setTimeout(add2eHudCombatScheduleRender, 90);
  window.setTimeout(add2eHudCombatScheduleRender, 180);
  window.setTimeout(add2eHudFamiliarActionsScheduleRender, 90);
  window.setTimeout(add2eHudFamiliarActionsScheduleRender, 180);
  window.setTimeout(add2eHudSpellMemoryScheduleSync, 90);
  window.setTimeout(add2eHudSpellMemoryScheduleSync, 180);
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
  if (data.action === "share-senses") {
    return { icon: "fa-eye", label: "Vision partagée", title: "Voir avec les sens du familier" };
  }
  return { icon: "fa-link", label: "Suivi", title: "Activer ou désactiver le suivi automatique" };
}

function add2eHudFamiliarActionsSignature(actor, rows) {
  return JSON.stringify({
    actorId: actor?.id ?? "",
    rows: rows.map(({ effect, data }) => ({ id: effect?.id ?? effect?._id ?? "", action: data?.action ?? "", name: effect?.name ?? "", description: effect?.description ?? "" }))
  });
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
  return JSON.stringify({
    applies: status?.applies === true,
    ok: status?.ok !== false,
    message: status?.message ?? "",
    blockingItems: (status?.blockingItems ?? []).map(item => item?.name ?? "")
  });
}

function add2eHudThiefActivityWarningHtml(status) {
  const names = (status?.blockingItems ?? []).map(item => String(item?.name ?? "").trim()).filter(Boolean);
  const equipment = names.length
    ? `Équipement actuellement incompatible : <strong>${add2eHudCombatEscape(names.join(", "))}</strong>.`
    : "Un équipement actuellement porté est incompatible avec les activités de voleur.";
  const message = add2eHudCombatEscape(status?.message || "Les capacités de voleur ne peuvent pas être utilisées avec l'équipement actuellement porté.");
  return `<h3><i class="fas fa-triangle-exclamation"></i> Capacités de voleur indisponibles</h3>
    <div>${message}</div>
    <div style="font-size:.84em;">${equipment}</div>`;
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
    const hudAdded = mutations.some(mutation => [...(mutation.addedNodes ?? [])].some(node =>
      node?.id === ADD2E_HUD_ID || node?.querySelector?.(`#${ADD2E_HUD_ID}`)
    ));
    if (hudAdded) {
      add2eHudCombatScheduleStableRender();
      add2eHudThiefActivityScheduleRender();
      add2eHudFamiliarActionsScheduleRender();
      add2eHudSpellMemoryScheduleSync();
    }
  });
  add2eHudCombatBodyObserver.observe(document.body, { childList: true, subtree: true });

  Hooks.on("updateItem", item => {
    const actor = add2eHudCombatCurrentActor();
    if (item?.parent?.id !== actor?.id) return;
    add2eHudCombatScheduleStableRender();
  });

  const refresh = globalThis.add2eRefreshActionHud;
  if (typeof refresh === "function" && !refresh.__add2eHudCombatDelegated) {
    const wrapped = async function add2eRefreshActionHudWithCombatDelegation(...args) {
      const result = await refresh.apply(this, args);
      add2eHudCombatScheduleStableRender();
      add2eHudThiefActivityScheduleRender();
      add2eHudFamiliarActionsScheduleRender();
      add2eHudSpellMemoryScheduleSync();
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
  add2eHudSpellMemoryScheduleSync();
}

if (game?.ready) add2eHudCombatInstall();
else Hooks.once("ready", add2eHudCombatInstall);
