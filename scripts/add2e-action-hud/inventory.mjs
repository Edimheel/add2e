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
function toFieldArray(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(toFieldArray).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value", "material", "materials", "components"]) if (value[key] !== undefined) return toFieldArray(value[key]);
  }
  return arr(value);
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
function isOnlyComponentCode(value) {
  const text = lower(value).replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}
function cleanComponentName(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/[()\[\]{}]/g, " ").replace(/\s+/g, " ").trim().replace(/[.!?;:]+$/g, "").trim().replace(/^d['’]\s*/i, "").replace(/^(un|une)?\s*peu\s+de\s+/i, "").replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "").replace(/^(quelques|plusieurs)\s+/i, "").replace(/^(petit morceau de|morceau de|poignee de|poignée de)\s+/i, "");
  return text.trim();
}
function rawRequirementName(value) { return typeof value === "object" && value ? value.name ?? value.nom ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id : value; }
function rawRequirementQuantity(value) { return typeof value === "object" && value ? value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? value.value ?? 1 : 1; }
function requirementKey(rawName) { const key = slug(cleanComponentName(rawName)); return ["eau_benite_ou_maudite", "eau_benite_maudite"].includes(key) ? "eau_benite" : key; }
function makeRequirement(rawName, rawQty = 1) {
  const name = cleanComponentName(rawName);
  if (!name || isOnlyComponentCode(name)) return null;
  const key = requirementKey(name);
  return key ? { name, key, quantity: Math.max(1, Math.floor(num(rawQty, 1))) } : null;
}
function addComponentRequirement(out, rawName, rawQty = 1) {
  const requirement = makeRequirement(rawName, rawQty);
  if (!requirement) return;
  const existing = out.find(entry => entry.key === requirement.key && !entry.alternatives);
  if (existing) existing.quantity += requirement.quantity;
  else out.push(requirement);
}
function addAlternativeRequirement(out, alternatives) {
  const clean = alternatives.map(value => makeRequirement(rawRequirementName(value), rawRequirementQuantity(value))).filter(Boolean);
  const unique = clean.filter((entry, index) => clean.findIndex(other => other.key === entry.key) === index);
  if (!unique.length) return;
  if (unique.length === 1) return addComponentRequirement(out, unique[0].name, unique[0].quantity);
  out.push({ name: unique.map(entry => entry.name).join(" ou "), key: unique.map(entry => entry.key).join("__or__"), quantity: 1, alternatives: unique });
}
function isStructuredAlternative(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const condition = lower(value.condition ?? value.conditions ?? value.note ?? value.notes ?? value.sourceCondition ?? "");
  const consumption = lower(value.consommation ?? value.consumption ?? value.consume ?? "");
  return condition.includes("alternative") || /\bou\b/i.test(condition) || (consumption.includes("optionnel") && condition.length > 0);
}
function collectComponentRequirement(out, value) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    const alternatives = value.filter(isStructuredAlternative);
    const alternativeKeys = new Set(alternatives.map(entry => `${rawRequirementName(entry)}|${rawRequirementQuantity(entry)}`));
    if (alternatives.length > 1) addAlternativeRequirement(out, alternatives);
    for (const entry of value) {
      const key = `${rawRequirementName(entry)}|${rawRequirementQuantity(entry)}`;
      if (alternatives.length > 1 && alternativeKeys.has(key)) continue;
      collectComponentRequirement(out, entry);
    }
    return;
  }
  if (typeof value === "string") {
    for (const rawPart of value.split(/[,;|\n]+|\bet\b/gi).map(part => part.trim()).filter(Boolean)) {
      const alternatives = rawPart.replace(/[()\[\]{}]/g, " ").replace(/\s+/g, " ").trim().split(/\bou\b/gi).map(part => part.trim()).filter(Boolean);
      if (alternatives.length > 1) addAlternativeRequirement(out, alternatives); else addComponentRequirement(out, rawPart, 1);
    }
    return;
  }
  if (typeof value === "object") {
    const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alternatives) && alternatives.length) return addAlternativeRequirement(out, alternatives);
    const name = rawRequirementName(value);
    if (name) addComponentRequirement(out, name, rawRequirementQuantity(value));
  }
}
function componentRequirements(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const out = [];
  const primary = [system.composants_materiels, system.composantsMateriels, sort?.composants_materiels];
  const fallback = [system.composants_requis, system.composantsMateriel, system.composant_materiel, system.composantMateriel, system.materiel, system.matériel, system.material, system.materialComponent, system.materialComponents, system.material_components, system.requiredComponents, system.componentsRequired, system.components?.material, system.components?.materials, system.components?.materialComponent, system.components?.materialComponents, system.composants_materiels_objets, sort?.materialComponents, sort?.composants_requis, sort?.composants_materiels_objets, flags.composants_requis, flags.composants, flags.components, flags.requiredComponents, flags.effectTags, flags.effecttags];
  for (const field of primary.filter(value => value !== undefined && value !== null && value !== "")) collectComponentRequirement(out, field);
  if (!out.length) for (const field of fallback.filter(value => value !== undefined && value !== null && value !== "")) collectComponentRequirement(out, field);
  for (const tag of [...toFieldArray(system.tags), ...toFieldArray(system.effectTags), ...toFieldArray(system.effecttags), ...toFieldArray(flags.tags), ...toFieldArray(flags.effectTags), ...toFieldArray(flags.effecttags)]) {
    const text = String(tag ?? "").trim();
    for (const prefix of ["composant", "component", "spell_component"]) if (new RegExp(`^${prefix}[:_]`, "i").test(text)) addComponentRequirement(out, text.replace(new RegExp(`^${prefix}[:_]`, "i"), ""), 1);
  }
  return out;
}
function componentKeyVariants(value) {
  const base = slug(cleanComponentName(String(value ?? "").replace(/^(composant|component|spell_component)[:_]/i, "")));
  const keys = new Set(base ? [base] : []);
  if (base.endsWith("s") && base.length > 4) keys.add(base.replace(/s+$/g, ""));
  if (base.includes("eau_benite") && base.includes("maudite")) ["eau_benite", "eau_maudite", "eau_benite_ou_maudite", "eau_benite_maudite"].forEach(key => keys.add(key));
  if (base === "eau_benite" || base === "eau_maudite") keys.add("eau_benite_ou_maudite");
  return [...keys].filter(Boolean);
}
function componentKeys(item) { const keys = new Set(); for (const field of itemTextFields(item)) for (const key of componentKeyVariants(field)) keys.add(key); return [...keys]; }
function compatibleComponentKey(itemKey, requirementKey) {
  if (!itemKey || !requirementKey) return false;
  if (itemKey === requirementKey || itemKey.includes(requirementKey) || requirementKey.includes(itemKey)) return true;
  return ["eau_benite", "eau_maudite"].includes(requirementKey) && ["eau_benite_ou_maudite", "eau_benite_maudite"].includes(itemKey);
}
export function quantity(item) {
  const system = item?.system ?? {};
  const value = system.quantite ?? system.quantity ?? system.qty ?? system.nombre ?? system.nb ?? system.uses?.value ?? system.charges?.value;
  return value === undefined || value === null || value === "" ? "—" : String(value);
}
function quantityNumber(item, fallback = 1) { const value = quantity(item); return value === "—" ? fallback : num(value, fallback); }
function requirementKeys(requirement) { return componentKeyVariants(requirement?.key ?? requirement?.name); }
function candidateComponentItems(actor, requirement = null) {
  const reqKeys = requirement ? requirementKeys(requirement) : [];
  return actorItems(actor).filter(item => {
    if (String(item?.type ?? "").toLowerCase() !== "objet" || isAmmunitionItem(item) || isContainerLike(item)) return false;
    if (isSpellComponentItem(item)) return true;
    const keys = componentKeys(item);
    return reqKeys.some(reqKey => keys.some(itemKey => compatibleComponentKey(itemKey, reqKey)));
  });
}
function findActorComponent(actor, requirement) {
  const reqKeys = requirementKeys(requirement);
  const matches = candidateComponentItems(actor, requirement).filter(item => { const keys = componentKeys(item); return reqKeys.some(reqKey => keys.some(itemKey => compatibleComponentKey(itemKey, reqKey))); });
  return matches.find(item => quantityNumber(item, 0) >= Number(requirement?.quantity ?? 1)) ?? matches[0] ?? null;
}
function findActorComponentForRequirement(actor, requirement) {
  if (!requirement?.alternatives?.length) {
    const item = findActorComponent(actor, requirement);
    return item && quantityNumber(item, 0) >= Number(requirement?.quantity ?? 1) ? { item, requirement } : null;
  }
  for (const alternative of requirement.alternatives) {
    const item = findActorComponent(actor, alternative);
    if (item && quantityNumber(item, 0) >= Number(alternative.quantity ?? 1)) return { item, requirement: alternative, group: requirement };
  }
  return null;
}
function spellComponentBadges(actor, sort) {
  const requirements = componentRequirements(sort);
  if (!requirements.length) return "";
  return `<span class="component-title">Composants</span>${requirements.map(requirement => {
    const owned = !!findActorComponentForRequirement(actor, requirement);
    const quantityLabel = requirement.quantity > 1 && !requirement.alternatives ? ` ×${requirement.quantity}` : "";
    const title = owned ? "Composant disponible" : "Composant manquant ou quantité insuffisante";
    return `<span class="${owned ? "component-ok" : "component-bad"}" title="${esc(title)}">${esc(requirement.name)}${quantityLabel}</span>`;
  }).join("")}`;
}
export function isAmmunitionItem(item) {
  const system = item?.system ?? {};
  const name = lower(item?.name);
  const fields = [system.categorie, system.category, system.sousType, system.sous_type, system.type, system.subtype, system.kind, system.slot].map(lower).filter(Boolean);
  const tags = itemTags(item);
  const accepted = new Set(["munition", "munitions", "projectile", "projectiles", "ammo", "ammunition", "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile", "type:munition", "type:projectile"]);
  if (/\b(carquois|quiver|etui|etuis|étui|étuis|sac|sacoche|container|contenant|boite|boîte|bourse)\b/.test(name)) return false;
  if (fields.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (tags.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  return fields.some(value => accepted.has(value)) || tags.some(value => accepted.has(value) || value.startsWith("munition:") || value.startsWith("projectile:")) || /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|pierre de fronde|pierres de fronde)\b/.test(name);
}
export function isPropelledWeapon(item) {
  const tags = itemTags(item);
  const name = norm(item?.name);
  const system = item?.system ?? {};
  return system.projectile_propulse === true || system.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || ["arc", "arbalete", "fronde"].some(key => name.includes(key));
}
function projectileKeys(item) {
  const text = `${norm(item?.name)} ${itemTags(item).join(" ")}`;
  if (text.includes("arbalete")) return ["carreau", "carreaux", "bolt"];
  if (text.includes("arc")) return ["fleche", "fleches", "arrow"];
  if (text.includes("fronde")) return ["bille", "billes", "pierre", "pierres", "bullet"];
  return ["munition", "projectile", "ammo"];
}
function equippedProjectile(actor, weapon) {
  if (!usesProjectileInventory(actor) || !isPropelledWeapon(weapon)) return null;
  const keys = projectileKeys(weapon).map(norm);
  const items = actorItems(actor).filter(item => item.id !== weapon.id && itemEquipped(item) && keys.some(key => norm(item.name).includes(key) || itemTags(item).some(tag => tag.includes(key))));
  return items.find(item => quantity(item) !== "0") ?? items[0] ?? null;
}
function damage(item) { const system = item?.system ?? {}; return system?.dégâts?.contre_moyen ?? system?.degats?.contre_moyen ?? system?.degats_moyen ?? system?.damage ?? system?.degats ?? system?.dmg ?? "—"; }
function range(item) {
  const system = item?.system ?? {};
  const values = [system.portee_courte ?? system.portee_short, system.portee_moyenne ?? system.portee_medium, system.portee_longue ?? system.portee_long].filter(value => value !== undefined && value !== null && String(value) !== "");
  return values.length ? values.join(" / ") : "Contact";
}
export function weapons(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "arme" && itemEquipped(item)); }
export function features(actor) { return typeof globalThis.add2eGetActorActivableClassFeatures === "function" ? globalThis.add2eGetActorActivableClassFeatures(actor, { includeLocked: false }) ?? [] : []; }
function declaredAction(actor) { try { return globalThis.add2eGetDeclaredInitiativeAction?.(actor) ?? null; } catch (_error) { return null; } }
function declarationButton(actor, item, kind) {
  const declared = declaredAction(actor);
  const active = String(declared?.itemId ?? "") === String(item?.id ?? "") && declared?.kind === kind;
  return `<button type="button" class="act initiative-declare${active ? " declared" : ""}" data-action="declare-initiative-${kind}" data-item-id="${esc(item.id)}">${active ? "Déclarée" : "Déclarer"}</button>`;
}
export function weaponRows(actor) {
  const rows = weapons(actor);
  if (!rows.length) return `<div class="empty">Aucune arme équipée.</div>`;
  return rows.map(item => {
    const projectile = equippedProjectile(actor, item);
    const propelled = isPropelledWeapon(item);
    const dmg = propelled && projectile ? `Dégâts projectile ${damage(projectile)}` : `Dégâts ${damage(item)}`;
    const ammo = propelled ? (usesProjectileInventory(actor) ? (projectile ? `<span class="ammo"><img src="${esc(projectile.img || "icons/svg/target.svg")}" alt="">${esc(projectile.name)} ×${esc(quantity(projectile))}</span>` : `<span class="ammo-missing">Aucune munition équipée</span>`) : `<span class="ammo-free">Munition PNJ non suivie</span>`) : "";
    const speed = num(item.system?.facteur_rapidité ?? item.system?.facteur_rapidite, 0);
    return `<div class="row initiative-row"><button type="button" class="img-act" data-action="attack" data-item-id="${esc(item.id)}" title="Attaquer avec ${esc(item.name)}"><img src="${esc(item.img || "icons/svg/sword.svg")}" alt=""></button><div><div class="title">${esc(item.name)}</div><div class="meta"><span>${esc(dmg)}</span><span>Portée ${esc(range(item))}</span><span>Rapidité ${esc(speed || "—")}</span>${ammo}</div></div>${declarationButton(actor, item, "weapon")}</div>`;
  }).join("");
}
function moneyRaw(actor) { const flag = actor?.getFlag?.("add2e", "monnaie"); if (flag && typeof flag === "object") return flag; const system = actor?.system ?? {}; return system.monnaie ?? system.argent ?? system.currency ?? {}; }
function moneyPanel(actor) { return `<div class="money-row"><span class="money-title">Argent</span>${COINS.map(([key, label]) => `<span class="money-pill">${label} ${esc(Math.max(0, Math.floor(num(moneyRaw(actor)?.[key], 0))))}</span>`).join("")}</div>`; }
function equipmentItems(actor) { return actorItems(actor).filter(item => String(item?.type ?? "").toLowerCase() === "objet" && !isAmmunitionItem(item) && !isSpellComponentItem(item) && !isContainerLike(item)).sort((a, b) => String(a.name).localeCompare(String(b.name))); }
export function equipmentRows(actor) {
  const rows = equipmentItems(actor);
  const body = rows.length ? rows.map(item => {
    const equipped = itemEquipped(item); const qty = quantity(item);
    return `<div class="row equipment-row"><img src="${esc(item.img || "icons/svg/item-bag.svg")}" alt=""><div><div class="title">${esc(item.name)}${qty !== "—" ? ` ×${esc(qty)}` : ""}</div><div class="meta"><span>Équipement</span><span class="${equipped ? "equip-ok" : "equip-off"}">${equipped ? "Équipé" : "Non équipé"}</span></div></div><button type="button" class="act" data-action="toggle-equipment" data-item-id="${esc(item.id)}">${equipped ? "Retirer" : "Équiper"}</button></div>`;
  }).join("") : `<div class="empty">Aucun équipement.</div>`;
  return `${moneyPanel(actor)}${body}`;
}
function sumPreparedTree(value) { if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value); if (typeof value === "string") return Math.max(0, num(value, 0)); if (!value || typeof value !== "object") return 0; return Object.values(value).reduce((sum, child) => sum + sumPreparedTree(child), 0); }
export function preparedCount(sort) {
  const flags = sort?.flags?.add2e ?? {}; const system = sort?.system ?? {};
  const direct = [sort?.getFlag?.("add2e", "memorizedCount"), flags.memorizedCount, flags.preparedCount, system.memorizedCount, system.preparedCount, system.prepared, system.memorise, system.memorized, system.memorisation?.value, system.memorisation, system.slots?.prepared, system.slots?.value];
  let best = direct.reduce((maximum, value) => { const numeric = num(value, NaN); return Number.isFinite(numeric) ? Math.max(maximum, numeric) : maximum; }, 0);
  best = Math.max(best, sumPreparedTree(sort?.getFlag?.("add2e", "memorizedByList")), sumPreparedTree(flags.memorizedByList), sumPreparedTree(flags.preparedByList), sumPreparedTree(system.memorizedByList), sumPreparedTree(system.preparedByList));
  try { best = Math.max(best, Number(globalThis.add2eGetTotalMemorizedCount?.(sort)) || 0); } catch (_error) {}
  return Math.max(0, best);
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
    return `<div class="row initiative-row"><button type="button" class="img-act" data-action="cast-spell" data-item-id="${esc(spell.id)}" title="Lancer ${esc(spell.name)}"><img src="${esc(spell.img || "icons/svg/book.svg")}" alt=""></button><div><div class="title">${esc(spell.name)}</div><div class="meta"><span>Mémorisé ${preparedCount(spell)}</span><span>Incantation ${esc(casting)}</span>${componentBadges}</div></div>${declarationButton(actor, spell, "spell")}</div>`;
  }).join("");
  return { html: `<div class="spell-layout"><div class="spell-levels">${buttons}</div><div class="spell-list"><div class="spell-list-title">${esc(active.label)} niveau ${esc(active.level || "—")}</div>${rowsHtml}</div></div>`, selectedGroup: active.key };
}
function thiefSkillArtwork(skill) {
  const key = String(skill?.key ?? "").trim();
  if (!key) throw new Error("La clé canonique de la compétence de voleur est absente.");
  return `systems/add2e/assets/icones/capacites/${key.replaceAll("_", "-")}.webp`;
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
    return `<div class="row compact"><div><div class="title">${esc(label)}</div><div class="meta"><span>Capacité de classe</span></div></div><button type="button" class="act" data-action="use-feature" data-feature-index="${index}">Utiliser</button></div>`;
  }).join("");
}
