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
export function spellLevel(sort) { return Math.max(0, num(sort?.system?.niveau ?? sort?.system?.level ?? sort?.system?.niveau_sort, 0)); }
export function spellListLabel(sort) {
  const system = sort?.system ?? {};
  const raw = [system.liste, system.list, system.spellList, system.classe, system.class, system.sourceClasse, system.casterClass, ...arr(system.lists), ...arr(system.listes), ...arr(system.classes)].map(value => String(value ?? "").trim()).find(Boolean) || "Mag";
  const normalized = norm(raw);
  if (normalized.includes("clerc") || normalized.includes("pretre") || normalized.includes("priest")) return "Clerc";
  if (normalized.includes("druid")) return "Dru";
  if (normalized.includes("ranger")) return "Rng";
  if (normalized.includes("paladin")) return "Pal";
  if (normalized.includes("mag") || normalized.includes("wizard") || normalized.includes("mage")) return "Mag";
  return String(raw).slice(0, 6);
}
export function spellRows(actor, selectedGroup = null) {
  const rows = spells(actor).sort((a, b) => String(spellListLabel(a)).localeCompare(String(spellListLabel(b))) || spellLevel(a) - spellLevel(b) || String(a.name).localeCompare(String(b.name)));
  if (!rows.length) return { html: `<div class="empty">Aucun sort mémorisé.</div>`, selectedGroup: null };
  const groups = new Map();
  for (const spell of rows) { const key = `${spellListLabel(spell)}|${spellLevel(spell)}`; if (!groups.has(key)) groups.set(key, { key, label: spellListLabel(spell), level: spellLevel(spell), items: [] }); groups.get(key).items.push(spell); }
  const list = [...groups.values()];
  const active = groups.get(selectedGroup) ?? list[0];
  const buttons = list.map(group => `<button type="button" class="spell-level ${group.key === active.key ? "active" : ""}" data-action="select-spell-group" data-spell-group="${esc(group.key)}">${esc(group.label)} niv. ${esc(group.level || "—")} <span>${group.items.length}</span></button>`).join("");
  const rowsHtml = active.items.map(spell => {
    const componentBadges = actorType(actor) === "pnj" ? "" : spellComponentBadges(actor, spell);
    const casting = spell.system?.temps_incantation ?? spell.system?.casting_time ?? spell.system?.castingTime ?? "—";
    const states = spellResourceStates(actor, spell);
    const preparedStates = states.filter(state => Math.max(0, Number(state.current) || 0) > 0);
    const available = preparedStates.length ? preparedStates.some(state => state.available !== false) : preparedCount(spell) > 0;
    const resourceText = preparedStates.length
      ? preparedStates.map(state => {
          const current = Math.max(0, Number(state.current) || 0);
          const maximum = Number.isFinite(Number(state.maximum)) ? Math.max(0, Number(state.maximum)) : "—";
          const cost = Math.max(0, Number(state.cost) || 1);
          const label = state.entry?.label || globalThis.add2eSpellLabel?.(state.entry?.key) || state.entry?.key || "Sort";
          return `<span>${esc(label)} ${esc(current)}/${esc(maximum)} · coût ${esc(cost)} · ${state.available === false ? "indisponible" : "disponible"}</span>`;
        }).join("")
      : `<span>Mémorisé ${preparedCount(spell)}</span>`;
    const castTitle = available ? `Lancer ${spell.name}` : `${spell.name} n’est plus mémorisé`;
    const initiativeTitle = available ? "Choisir cette action pour l’initiative" : `${spell.name} n’est plus mémorisé`;
    return `<div class="row initiative-row"><button type="button" class="img-act" data-action="cast-spell" data-item-id="${esc(spell.id)}" title="${esc(castTitle)}"${available ? "" : " disabled aria-disabled=\"true\""}><img src="${esc(spell.img || "icons/svg/book.svg")}" alt=""></button><div><div class="title">${esc(spell.name)}</div><div class="meta">${resourceText}<span>Incantation ${esc(casting)}</span>${componentBadges}</div></div>${declarationButton(actor, spell, "spell", { disabled: !available, title: initiativeTitle })}</div>`;
  }).join("");
  return { html: `<div class="spell-layout"><div class="spell-levels">${buttons}</div><div class="spell-list"><div class="spell-list-title">${esc(active.label)} niveau ${esc(active.level || "—")}</div>${rowsHtml}</div></div>`, selectedGroup: active.key };
}
function thiefSkillArtwork(skill) {
  const key = String(skill?.key ?? "").trim();
  if (!key) throw new Error("La clé canonique de la compétence de voleur est absente.");
  return `systems/add2e/assets/icones/capacites/${key.replaceAll("_", "-")}.webp`;
}
function classFeatureArtwork(actor, feature) {
  const explicit = String(feature?.img ?? "").trim();
  if (explicit) return explicit;
  const classItemId = String(feature?._add2eClassItemId ?? "").trim();
  const classItem = classItemId ? actor?.items?.get?.(classItemId) ?? null : null;
  return classItem?.img || "icons/svg/aura.svg";
}
function classFeatureResourceStates(actor, feature) {
  const resolver = globalThis.add2eGetClassFeatureUsageResource;
  if (typeof resolver !== "function") {
    throw new Error("Le propriétaire canonique des ressources de capacités de classe est indisponible pour le HUD.");
  }
  const categories = Array.isArray(feature?.uses?.categories) ? feature.uses.categories.filter(Boolean) : [];
  const usages = categories.length
    ? categories.map(category => resolver(actor, feature, { category })).filter(Boolean)
    : [resolver(actor, feature)].filter(Boolean);
  if (!usages.length) return [];
  const engine = hudResourceEngine();
  return usages.map(usage => ({
    ...engine.resolveResource(usage.descriptor, {
      cost: 1,
      consumer: "action-hud:class-feature-resource"
    }),
    usage
  }));
}
function classFeaturePeriodLabel(period) {
  return ({ day: "jour", week: "semaine", combat: "combat", career: "carrière", "10_years": "10 ans" })[String(period ?? "")] || String(period ?? "");
}
function classFeatureResourceMeta(actor, feature) {
  const states = classFeatureResourceStates(actor, feature);
  if (!states.length) return { states, available: true, html: '<span>À volonté</span>' };
  const available = states.some(state => state.available !== false);
  const html = states.map(state => {
    const current = Math.max(0, Number(state.current) || 0);
    const maximum = Number.isFinite(Number(state.maximum)) ? Math.max(0, Number(state.maximum)) : "—";
    const cost = Math.max(0, Number(state.cost) || 1);
    const category = state.usage?.category ? ` · ${state.usage.category}` : "";
    const period = classFeaturePeriodLabel(state.usage?.period);
    const source = state.source?.name || state.usage?.descriptor?.source?.name || "Classe";
    return `<span>Source : ${esc(source)}${esc(category)}</span><span>${esc(current)}/${esc(maximum)} · coût ${esc(cost)}${period ? ` / ${esc(period)}` : ""} · ${state.available === false ? "indisponible" : "disponible"}</span>`;
  }).join("");
  return { states, available, html };
}
export function featureRows(actor) {
  const rows = features(actor);
  if (!rows.length) return `<div class="empty">Aucune capacité utilisable.</div>`;
  return rows.map((feature, index) => {
    const label = globalThis.add2eFeatureName?.(feature) || feature.name || feature.label || feature.nom || `Capacité ${index + 1}`;
    const thiefSkill = feature?._add2eThiefSkill ?? null;
    if (thiefSkill) {
      const title = `Tester ${thiefSkill.label ?? label}`;
      const image = thiefSkillArtwork(thiefSkill);
      return `<div class="row capability-row"><button type="button" class="img-act capability-icon" data-action="use-feature" data-feature-index="${index}" data-skill-key="${esc(thiefSkill.key)}" title="${esc(title)}" aria-label="${esc(title)}"><img src="${esc(image)}" alt="" aria-hidden="true"></button><div><div class="title">${esc(label)}</div><div class="meta"><span>Compétence de voleur</span></div></div></div>`;
    }
    const resource = classFeatureResourceMeta(actor, feature);
    const title = resource.available ? `Utiliser ${label}` : `${label} n’est plus disponible pour cette période`;
    const image = classFeatureArtwork(actor, feature);
    return `<div class="row capability-row"><button type="button" class="img-act capability-icon" data-action="use-feature" data-feature-index="${index}" title="${esc(title)}" aria-label="${esc(title)}"${resource.available ? "" : " disabled aria-disabled=\"true\""}><img src="${esc(image)}" alt="" aria-hidden="true"></button><div><div class="title">${esc(label)}</div><div class="meta"><span>Capacité de classe</span>${resource.html}</div></div></div>`;
  }).join("");
}
