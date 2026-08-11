// ADD2E — armes, équipement, sorts et composants du HUD d'action.

import { COINS, actorItems, actorType, arr, esc, lower, norm, num, slug, usesProjectileInventory } from "./shared.mjs";

export function itemEquipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true || system.estEquipee === true;
}
function itemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [item?.name, system.nom, system.categorie, system.category, system.type, system.sousType, system.sous_type, system.type_arme, system.famille, system.famille_arme, system.tags, system.effectTags, system.effecttags, flags.tags, flags.effectTags, flags.effecttags].flatMap(arr).map(norm).filter(Boolean);
}
function itemTextFields(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [item?.name, system.nom, system.categorie, system.category, system.sousType, system.sous_type, system.type, system.subtype, system.kind, system.slot, system.slug, system.composant, system.component, system.composantSlug, system.componentSlug, flags.vendorKind, flags.kind, flags.slug, flags.componentSlug, ...arr(system.tags), ...arr(system.effectTags), ...arr(system.effecttags), ...arr(flags.tags), ...arr(flags.effectTags), ...arr(flags.effecttags)].map(lower).filter(Boolean);
}
function isContainerLike(item) {
  const text = itemTags(item).join(" ");
  const name = norm(item?.name);
  return ["sacoche", "component_pouch", "carquois", "quiver", "container", "contenant"].some(key => text.includes(key) || name.includes(key));
}
function isKnownLooseComponentName(value) {
  const key = slug(value);
  if (!key) return false;
  const exact = new Set(["eau_benite", "eau_maudite", "eau_benite_ou_maudite", "eau_benite_maudite", "symbole_sacre", "gui", "encens", "poudre_d_argent", "poudre_d_or", "poudre_de_fer", "sable", "soufre", "phosphore", "ambre", "perle", "miroir", "plume", "petite_plume"]);
  if (exact.has(key)) return true;
  return /(^|_)(eau_benite|eau_maudite|symbole_sacre|encens|gui|soufre|phosphore|poudre_d_argent|poudre_d_or|poudre_de_fer|plume|ambre|perle|miroir)(_|$)/.test(key);
}
export function isSpellComponentItem(item) {
  if (!item) return false;
  const fields = itemTextFields(item);
  if (fields.some(value => ["component", "composant", "composants", "composant_sort", "composants_sort", "composant_de_sort", "composants_de_sort", "spell_component", "spell_components", "material_component", "material_components"].includes(value))) return true;
  if (fields.some(value => value.startsWith("composant:") || value.startsWith("component:") || value.startsWith("spell_component:"))) return true;
  if (fields.some(value => (value.includes("composant") && value.includes("sort")) || (value.includes("spell") && value.includes("component")))) return true;
  return isKnownLooseComponentName(item?.name) || isKnownLooseComponentName(item?.system?.nom);
}
export function quantity(item) {
  const system = item?.system ?? {};
  const value = system.quantite ?? system.quantity ?? system.qty ?? system.nombre ?? system.nb ?? system.uses?.value ?? system.charges?.value;
  return value === undefined || value === null || value === "" ? "—" : String(value);
}
function spellComponentBadges(actor, sort) {
  const resolver = globalThis.add2eGetSpellComponentStatus;
  if (typeof resolver !== "function") {
    throw new Error("Le propriétaire canonique des composants de sorts est indisponible pour le HUD.");
  }
  const statuses = resolver(actor, sort);
  if (!Array.isArray(statuses) || !statuses.length) return "";
  return `<span class="component-title">Composants</span>${statuses.map(status => {
    const quantityLabel = Number(status.quantity) > 1 && !status.alternatives ? ` ×${Number(status.quantity)}` : "";
    const title = status.available ? "Composant disponible" : "Composant manquant ou quantité insuffisante";
    return `<span class="${status.available ? "component-ok" : "component-bad"}" title="${esc(title)}">${esc(status.name)}${quantityLabel}</span>`;
  }).join("")}`;
}
export function isAmmunitionItem(item) {
  const api = globalThis.ADD2E_CONSUMABLES ?? game?.add2e?.consumables;
  if (typeof api?.add2eIsAmmunition !== "function") {
    throw new Error("Le propriétaire canonique des munitions est indisponible pour le HUD.");
  }
  return api.add2eIsAmmunition(item) === true;
}
function weaponUsageProfile(item) {
  if (typeof globalThis.add2eGetWeaponUsageProfile !== "function") {
    throw new Error("Le propriétaire canonique du profil d’usage des armes est indisponible pour le HUD.");
  }
  return globalThis.add2eGetWeaponUsageProfile(item);
}
export function isPropelledWeapon(item) {
  const profile = weaponUsageProfile(item);
  return profile?.isProjectilePropulse === true || profile?.requiresEquippedProjectile === true;
}
function propelledProjectileState(actor, weapon) {
  const profile = weaponUsageProfile(weapon);
  const required = profile?.requiresEquippedProjectile === true;
  if (!required) return { ok: true, required: false, ignored: false, projectile: null, current: null };
  if (!usesProjectileInventory(actor)) return { ok: true, required: true, ignored: true, projectile: null, current: null };
  const api = globalThis.ADD2E_VENDOR_PROJECTILES ?? game?.add2e?.vendorProjectiles;
  if (typeof api?.resolveProjectileForAttack !== "function") {
    throw new Error("Le résolveur canonique des projectiles est indisponible pour le HUD.");
  }
  return api.resolveProjectileForAttack({ actor, arme: weapon });
}
function damage(item) { const system = item?.system ?? {}; return system?.dégâts?.contre_moyen ?? system?.degats?.contre_moyen ?? system?.degats_moyen ?? system?.damage ?? system?.degats ?? system?.dmg ?? "—"; }
function range(item) {
  const system = item?.system ?? {};
  const values = [system.portee_courte ?? system.portee_short, system.portee_moyenne ?? system.portee_medium, system.portee_longue ?? system.portee_long].filter(value => value !== undefined && value !== null && String(value) !== "");
  return values.length ? values.join(" / ") : "Contact";
}
export function weapons(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "arme"); }
function projectileItems(actor) { return actorItems(actor).filter(isAmmunitionItem).sort((a, b) => String(a.name).localeCompare(String(b.name))); }
function armorItems(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "armure").sort((a, b) => String(a.name).localeCompare(String(b.name))); }
function classEquipmentAllowed(actor, item, kind) {
  const getClassItems = globalThis.add2eGetActorClassItems;
  const checkEquipment = globalThis.add2eCheckEquipmentAllowedForClass;
  if (typeof getClassItems !== "function" || typeof checkEquipment !== "function") {
    throw new Error("Le propriétaire canonique des restrictions d’équipement est indisponible pour le HUD.");
  }
  if (String(actor?.type ?? "").toLowerCase() === "monster") return true;
  const classes = getClassItems(actor);
  if (!Array.isArray(classes) || !classes.length) return true;
  return checkEquipment(actor, item, kind)?.ok === true;
}
export function features(actor) { return typeof globalThis.add2eGetActorActivableClassFeatures === "function" ? globalThis.add2eGetActorActivableClassFeatures(actor, { includeLocked: false }) ?? [] : []; }
function declaredAction(actor) { try { return globalThis.add2eGetDeclaredInitiativeAction?.(actor) ?? null; } catch (_error) { return null; } }
function declarationButton(actor, item, kind, options = {}) {
  const declared = declaredAction(actor);
  const active = String(declared?.itemId ?? "") === String(item?.id ?? "") && declared?.kind === kind;
  const disabled = options.disabled === true;
  const title = options.title || (active ? "Action choisie pour l’initiative" : "Choisir cette action pour l’initiative");
  return `<button type="button" class="hud-icon-action initiative-declare${active ? " declared" : ""}" data-action="declare-initiative-${kind}" data-item-id="${esc(item.id)}" title="${esc(title)}" aria-label="${esc(title)}"${disabled ? " disabled aria-disabled=\"true\"" : ""}><i class="fas fa-hourglass-start" aria-hidden="true"></i></button>`;
}
function equipmentButton(item, { classAllowed = true } = {}) {
  const equipped = itemEquipped(item);
  const title = equipped ? `Déséquiper ${item.name}` : `Équiper ${item.name}`;
  const restrictionStyle = classAllowed ? "" : ' style="filter:grayscale(1);opacity:.38;"';
  return `<button type="button" class="hud-icon-action equipment-toggle${equipped ? " equipped" : ""}" data-action="toggle-equipment" data-item-id="${esc(item.id)}" title="${esc(title)}" aria-label="${esc(title)}"${restrictionStyle}><i class="fas fa-swords" aria-hidden="true"></i></button>`;
}
function equipmentState(item) {
  return `<span class="${itemEquipped(item) ? "equip-ok" : "equip-off"}">${itemEquipped(item) ? "Équipé" : "Rangé"}</span>`;
}
function thrownWeaponQuantity(item) {
  if (weaponUsageProfile(item)?.isThrown !== true) return null;
  const raw = item?.system?.quantite ?? item?.system?.quantity;
  return raw === undefined || raw === null || raw === "" ? 1 : Math.max(0, Math.floor(num(raw, 0)));
}
function thrownWeaponUnavailable(actor, item) {
  if (!usesProjectileInventory(actor)) return false;
  const current = thrownWeaponQuantity(item);
  return current !== null && current <= 0;
}
function weaponRow(actor, item) {
  const profile = weaponUsageProfile(item);
  const propelled = profile?.isProjectilePropulse === true || profile?.requiresEquippedProjectile === true;
  const projectileState = propelledProjectileState(actor, item);
  const projectile = projectileState?.projectile ?? null;
  const propelledUnavailable = propelled && usesProjectileInventory(actor) && projectileState?.ok !== true;
  const thrownQuantity = thrownWeaponQuantity(item);
  const thrownUnavailable = thrownWeaponUnavailable(actor, item);
  const unavailable = thrownUnavailable || propelledUnavailable;
  const classAllowed = classEquipmentAllowed(actor, item, "arme");
  const classRestrictionStyle = classAllowed ? "" : ' style="filter:grayscale(1);opacity:.38;"';
  const dmg = propelled && projectile ? `Dégâts projectile ${damage(projectile)}` : `Dégâts ${damage(item)}`;
  const ammo = propelled
    ? usesProjectileInventory(actor)
      ? projectile
        ? `<span class="${projectileState?.ok === true ? "ammo" : "ammo-missing"}"><img src="${esc(projectile.img || "icons/svg/target.svg")}" alt="">${esc(projectile.name)} ×${esc(quantity(projectile))}</span>`
        : `<span class="ammo-missing">Aucune munition compatible équipée</span>`
      : `<span class="ammo-free">Munition PNJ non suivie</span>`
    : "";
  const thrownQuantityState = thrownQuantity === null ? "" : `<span>Qté ${esc(thrownQuantity)}</span>`;
  const unavailableState = thrownUnavailable
    ? '<span class="equip-off">À ramasser</span>'
    : propelledUnavailable
      ? '<span class="equip-off">Munition indisponible</span>'
      : "";
  const attackTitle = thrownUnavailable
    ? `${item.name} indisponible : à ramasser en fin de combat`
    : propelledUnavailable
      ? `${item.name} indisponible : munition compatible équipée requise`
      : `Attaquer avec ${item.name}`;
  const resourceKind = thrownUnavailable ? "thrown-weapon" : propelledUnavailable ? "ammunition" : "";
  const resourceState = unavailable ? ` data-add2e-resource-unavailable="${resourceKind}" disabled aria-disabled="true"` : "";
  const initiativeTitle = unavailable ? attackTitle : "Choisir cette action pour l’initiative";
  const speed = num(item.system?.facteur_rapidité ?? item.system?.facteur_rapidite, 0);
  return `<div class="row initiative-row combat-item-row"><button type="button" class="img-act${unavailable ? " a2e-multiple-attack-blocked" : ""}" data-action="attack" data-item-id="${esc(item.id)}" title="${esc(attackTitle)}"${resourceState}><img src="${esc(item.img || "icons/svg/sword.svg")}" alt=""${classRestrictionStyle}></button><div><div class="title">${esc(item.name)}</div><div class="meta">${equipmentState(item)}${unavailableState}${thrownQuantityState}<span>${esc(dmg)}</span><span>Portée ${esc(range(item))}</span><span>Rapidité ${esc(speed || "—")}</span>${ammo}</div></div><div class="hud-row-actions">${equipmentButton(item, { classAllowed })}${declarationButton(actor, item, "weapon", { disabled: unavailable, title: initiativeTitle })}</div></div>`;
}
function projectileRow(item) {
  const system = item.system ?? {};
  const type = system.sousType ?? system.sous_type ?? system.munitionType ?? "—";
  return `<div class="row equipment-row combat-item-row"><img src="${esc(item.img || "icons/svg/target.svg")}" alt=""><div><div class="title">${esc(item.name)}</div><div class="meta">${equipmentState(item)}<span>Type ${esc(type)}</span><span>Dégâts ${esc(damage(item))}</span><span>Qté ${esc(quantity(item))}</span></div></div><div class="hud-row-actions">${equipmentButton(item)}</div></div>`;
}
function armorRow(actor, item) {
  const system = item.system ?? {};
  const ca = system.ac ?? system.ca ?? "—";
  const bonus = system.bonus_ac ?? "—";
  const classAllowed = classEquipmentAllowed(actor, item, "armure");
  const classRestrictionStyle = classAllowed ? "" : ' style="filter:grayscale(1);opacity:.38;"';
  return `<div class="row equipment-row combat-item-row"><img src="${esc(item.img || "icons/svg/shield.svg")}" alt=""${classRestrictionStyle}><div><div class="title">${esc(item.name)}</div><div class="meta">${equipmentState(item)}<span>CA ${esc(ca)}</span><span>Bonus CA ${esc(bonus)}</span></div></div><div class="hud-row-actions">${equipmentButton(item, { classAllowed })}</div></div>`;
}
export function weaponRows(actor, selectedGroup = "armes") {
  const weaponList = weapons(actor);
  const projectileList = projectileItems(actor);
  const armorList = armorItems(actor);
  const groups = [
    { key: "armes", label: "Armes", count: weaponList.length },
    { key: "projectiles", label: "Projectiles", count: projectileList.length },
    { key: "armures", label: "Armures", count: armorList.length }
  ];
  const active = groups.some(group => group.key === selectedGroup) ? selectedGroup : "armes";
  const tabs = groups.map(group => `<button type="button" class="combat-tab${active === group.key ? " active" : ""}" data-action="select-combat-group" data-combat-group="${group.key}">${group.label} <span>${group.count}</span></button>`).join("");
  let rows = "";
  if (active === "projectiles") rows = projectileList.length ? projectileList.map(projectileRow).join("") : `<div class="empty">Aucun projectile.</div>`;
  else if (active === "armures") rows = armorList.length ? armorList.map(item => armorRow(actor, item)).join("") : `<div class="empty">Aucune armure.</div>`;
  else rows = weaponList.length ? weaponList.map(item => weaponRow(actor, item)).join("") : `<div class="empty">Aucune arme.</div>`;
  return `<div class="combat-layout"><div class="combat-tabs">${tabs}</div><div class="combat-list" data-combat-group-content="${active}">${rows}</div></div>`;
}
function moneyRaw(actor) { const flag = actor?.getFlag?.("add2e", "monnaie"); if (flag && typeof flag === "object") return flag; const system = actor?.system ?? {}; return system.monnaie ?? system.argent ?? system.currency ?? {}; }
function moneyPanel(actor) { return `<div class="money-row"><span class="money-title">Argent</span>${COINS.map(([key, label]) => `<span class="money-pill">${label} ${esc(Math.max(0, Math.floor(num(moneyRaw(actor)?.[key], 0))))}</span>`).join("")}</div>`; }
function equipmentItems(actor) { return actorItems(actor).filter(item => String(item?.type ?? "").toLowerCase() === "objet" && !isAmmunitionItem(item) && !isSpellComponentItem(item) && !isContainerLike(item)).sort((a, b) => String(a.name).localeCompare(String(b.name))); }
export function equipmentRows(actor) {
  const rows = equipmentItems(actor);
  const body = rows.length ? rows.map(item => {
    const qty = quantity(item);
    return `<div class="row equipment-row"><img src="${esc(item.img || "icons/svg/item-bag.svg")}" alt=""><div><div class="title">${esc(item.name)}${qty !== "—" ? ` ×${esc(qty)}` : ""}</div><div class="meta"><span>Équipement</span>${equipmentState(item)}</div></div><div class="hud-row-actions">${equipmentButton(item)}</div></div>`;
  }).join("") : `<div class="empty">Aucun équipement.</div>`;
  return `${moneyPanel(actor)}${body}`;
}
function hudResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.resolveResource !== "function") {
    throw new Error("Le domaine canonique ADD2E resource est indisponible pour le HUD.");
  }
  return engine;
}
export function preparedCount(sort) {
  if (typeof globalThis.add2eGetTotalMemorizedCount !== "function") {
    throw new Error("Le propriétaire canonique de la mémorisation des sorts est indisponible pour le HUD.");
  }
  return Math.max(0, Number(globalThis.add2eGetTotalMemorizedCount(sort)) || 0);
}
function spellResourceStates(actor, spell) {
  if (typeof globalThis.add2eGetSpellMemorizationResource !== "function"
    || typeof globalThis.add2eGetSpellcastingEntries !== "function"
    || typeof globalThis.add2eGetSpellListsFromItem !== "function") {
    throw new Error("Le propriétaire canonique de la mémorisation des sorts est indisponible pour le HUD.");
  }
  const normalize = value => typeof globalThis.add2eNormalizeSpellKey === "function" ? globalThis.add2eNormalizeSpellKey(value) : norm(value);
  const lists = new Set((globalThis.add2eGetSpellListsFromItem(spell) ?? []).map(normalize).filter(Boolean));
  const entries = (globalThis.add2eGetSpellcastingEntries(actor) ?? []).filter(entry => lists.has(normalize(entry?.key)));
  const engine = hudResourceEngine();
  return entries.map(entry => {
    const descriptor = globalThis.add2eGetSpellMemorizationResource(spell, entry, {
      cost: 1,
      consumer: "action-hud:spell-resource"
    });
    const state = engine.resolveResource(descriptor, {
      cost: 1,
      consumer: "action-hud:spell-resource"
    });
    return { ...state, entry };
  });
}
function isObjectPowerSpell(sort) { const system = sort?.system ?? {}; if (system.isPower === true || system.isObjectPower === true || system.sourceWeaponId || system.sourceItemId || system.powerIndex !== undefined) return true; try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort) === true; } catch (_error) { return false; } }
export function spells(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "sort" && !isObjectPowerSpell(item) && preparedCount(item) > 0); }
