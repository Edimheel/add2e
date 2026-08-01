// ADD2E — Actor sheet getData : CA canonique, sauvegardes, équipement et synthèse de combat.
// Compatible Foundry V13/V14/V15.

import {
  add2eGetCombatStatProfile,
  add2eAttackAbilityLabel
} from "../add2e-attack/03-attack-rules.mjs";
import { add2eAttackComputeActiveAttackModifiers } from "../add2e-attack/04e-attack-roll-modifiers.mjs";
import { add2eGetEquippedProjectileForWeapon } from "./21-consumables.mjs";

function add2eSheetCombatNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSheetSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eSheetModifierValue(modifier) {
  const operation = String(modifier?.operation ?? "add");
  const raw = modifier?.value;
  if (operation === "add") return add2eSheetSigned(raw);
  if (operation === "set") return `= ${String(raw ?? "—")}`;
  if (operation === "multiply") return `× ${String(raw ?? "—")}`;
  if (operation === "minmax" && raw && typeof raw === "object") {
    if (raw.min !== undefined) return `min. ${raw.min}`;
    if (raw.max !== undefined) return `max. ${raw.max}`;
  }
  return String(raw ?? "—");
}

function add2eSheetAppliedRows(resolution) {
  return Array.isArray(resolution?.applied)
    ? resolution.applied.map(entry => {
      const modifier = entry?.modifier ?? {};
      const numericValue = modifier.operation === "add" && Number.isFinite(Number(modifier.value))
        ? Number(modifier.value)
        : 0;
      return {
        id: String(modifier.id ?? ""),
        label: String(modifier.metadata?.label ?? modifier.source?.name ?? modifier.id ?? "Modificateur"),
        value: add2eSheetModifierValue(modifier),
        numericValue,
        sourceId: String(modifier.source?.id ?? ""),
        sourceName: String(modifier.source?.name ?? ""),
        sourceKind: String(modifier.source?.kind ?? ""),
        producer: String(modifier.metadata?.producer ?? ""),
        domain: String(modifier.domain ?? ""),
        target: String(modifier.target ?? "")
      };
    })
    : [];
}

function add2eSheetArmorClassEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveArmorClass !== "function") {
    throw new Error("Le résolveur canonique ADD2E de classe d’armure n’est pas disponible.");
  }
  if (typeof engine.itemEquipped !== "function") {
    throw new Error("Le résolveur canonique ADD2E de l’équipement n’est pas disponible.");
  }
  return engine;
}

function add2eSheetSavingThrowEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveSavingThrow !== "function") {
    throw new Error("Le résolveur canonique ADD2E de sauvegardes n’est pas disponible.");
  }
  return engine;
}

function add2eSheetSaveSourceLabel(resolution) {
  const selected = resolution?.targetResolution?.selected;
  if (selected?.kind === "class") {
    return [selected.className, selected.classLevel ? `niveau ${selected.classLevel}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return selected?.name ?? "Valeur de l’acteur";
}

function add2eSheetSavingThrowRows(actor) {
  const engine = add2eSheetSavingThrowEngine();
  return Array.from({ length: 5 }, (_unused, index) => {
    const resolution = engine.resolveSavingThrow(actor, index, {
      source: "actor-sheet-get-data",
      consumer: "application-v2",
      frontale: true
    });
    const target = Number(resolution?.target);
    const hasTarget = Number.isFinite(target) && target > 0;
    const bonus = Number(resolution?.bonus) || 0;
    const sourceLabel = add2eSheetSaveSourceLabel(resolution);
    const targetDisplay = hasTarget ? String(target) : "—";
    const bonusDisplay = add2eSheetSigned(bonus);
    const title = [
      `Jet de ${resolution?.label ?? "sauvegarde"}`,
      `Seuil : ${targetDisplay}`,
      `Bonus : ${bonusDisplay}`,
      `Source : ${sourceLabel}`
    ].join(" · ");

    return {
      index,
      key: resolution?.key ?? `save${index}`,
      label: resolution?.label ?? "Sauvegarde",
      shortLabel: resolution?.definition?.shortLabel ?? resolution?.label ?? "Sauvegarde",
      icon: resolution?.definition?.icon ?? "fas fa-dice-d20",
      target: hasTarget ? target : null,
      targetDisplay,
      bonus,
      bonusDisplay,
      hasBonus: bonus !== 0,
      sourceLabel,
      title,
      resolution
    };
  });
}

function add2eSheetSyncArmorClass(actor, resolution) {
  const caNaturel = Number(resolution?.caNaturel);
  const caTotal = Number(resolution?.caTotal);
  if (!Number.isFinite(caNaturel) || !Number.isFinite(caTotal)) {
    throw new Error(`Résolution de CA invalide pour ${actor?.name ?? "acteur"}.`);
  }
  if (Number(actor.system?.ca_naturel) === caNaturel && Number(actor.system?.ca_total) === caTotal) return;
  void actor.update({
    "system.ca_naturel": caNaturel,
    "system.ca_total": caTotal
  }, {
    render: false,
    add2eInternal: true,
    add2eReason: "canonical-armor-class-sync"
  }).catch(error => console.error("[ADD2E][ARMOR_CLASS][SYNC_ERROR]", { actor: actor.name, error }));
}

function add2eSheetDefenseBaseLabel(resolution) {
  if (resolution?.mode === "transformation") return resolution.transformation?.label ?? "Transformation";
  if (resolution?.mode === "monk") return "Défense martiale du moine";
  if (resolution?.mode === "passive") return resolution.passiveArmorClass?.label ?? "Défense passive de classe";
  if (resolution?.fixedCAActive) return `${resolution.fixedSource || "CA fixe"} (CA fixe)`;
  if (resolution?.selectedArmor?.name) return resolution.selectedArmor.name;
  return "Sans armure";
}

function add2eSheetDefenseRows(armorClass) {
  const rows = [{
    id: "armor-class-base",
    label: add2eSheetDefenseBaseLabel(armorClass),
    value: String(armorClass?.baseAfterFixed ?? armorClass?.armorBase ?? 10),
    sourceName: "Base défensive",
    sourceKind: String(armorClass?.mode ?? "equipment"),
    sourceId: String(armorClass?.selectedArmor?.id ?? "")
  }];
  rows.push(...add2eSheetAppliedRows(armorClass?.naturalResolution));
  rows.push(...add2eSheetAppliedRows(armorClass?.totalResolution));
  return rows;
}

function add2eSheetClassSlug(classItem) {
  const system = classItem?.system ?? {};
  return add2eSheetCombatNormalize(system.slug ?? system.label ?? system.nom ?? system.name ?? classItem?.name ?? "classe");
}

function add2eSheetClassLevel(actor, classItem) {
  const levels = actor?.system?.niveaux_par_classe ?? {};
  const slug = add2eSheetClassSlug(classItem);
  const raw = levels?.[classItem?.id]
    ?? levels?.[slug]
    ?? classItem?.system?.niveau
    ?? classItem?.system?.level
    ?? actor?.system?.niveau;
  return Math.max(1, Math.floor(Number(raw) || 1));
}

function add2eSheetClassThaco(actor, classItem) {
  const level = add2eSheetClassLevel(actor, classItem);
  const progression = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
  const row = progression.find(entry => Number(entry?.niveau ?? entry?.level) === level)
    ?? progression[level - 1]
    ?? null;
  if (!row) {
    throw new Error(`Progression THAC0 absente pour ${classItem?.name ?? "classe"} au niveau ${level}.`);
  }
  const thaco = Number(row.thac0 ?? row.thaco ?? row.THAC0);
  if (!Number.isFinite(thaco)) {
    throw new Error(`THAC0 invalide pour ${classItem?.name ?? "classe"} au niveau ${level}.`);
  }
  return thaco;
}

function add2eSheetResolveThaco(actor, transformation) {
  const transformationThaco = Number(transformation?.thac0);
  if (Number.isFinite(transformationThaco)) return transformationThaco;
  const classes = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  if (!classes.length) return 20;
  return Math.min(...classes.map(classItem => add2eSheetClassThaco(actor, classItem)));
}

function add2eSheetDamageData(item) {
  const system = item?.system ?? {};
  return system.dégâts ?? system.degats ?? system.damage ?? system.damages ?? null;
}

function add2eSheetDamagePart(data, keys) {
  if (!data || typeof data !== "object") return "";
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function add2eSheetDisplayDamage(item) {
  const data = add2eSheetDamageData(item);
  if (typeof data === "string" && data.trim()) return data.trim();
  const medium = add2eSheetDamagePart(data, ["contre_moyen", "moyen", "medium", "m", "M"]);
  const large = add2eSheetDamagePart(data, ["contre_grand", "grand", "large", "g", "G", "L"]);
  if (medium || large) return `${medium || "-"} / ${large || "-"}`;
  return "-";
}

function add2eSheetRowsTotal(rows, predicate) {
  return rows.filter(predicate).reduce((total, row) => total + Number(row.numericValue || 0), 0);
}

function add2eSheetWeaponRows(actor, weapons, thaco, engine) {
  return weapons.map(weapon => {
    const combatProfile = add2eGetCombatStatProfile(weapon);
    const canonical = add2eAttackComputeActiveAttackModifiers({
      actor,
      cible: null,
      arme: weapon,
      combatProfile
    });
    const attackRows = add2eSheetAppliedRows(canonical.attackResolution);
    const damageRows = add2eSheetAppliedRows(canonical.damageResolution);
    const abilityHit = add2eSheetRowsTotal(attackRows, row => row.producer === "ability-table");
    const abilityDamage = add2eSheetRowsTotal(damageRows, row => row.producer === "ability-table");
    const weaponHit = add2eSheetRowsTotal(attackRows, row => row.producer === "weapon-base-field" && row.sourceId === String(weapon.id));
    const weaponDamage = add2eSheetRowsTotal(damageRows, row => row.producer === "weapon-base-field" && row.sourceId === String(weapon.id));
    const totalHit = Number(canonical.attackResolution?.total) || 0;
    const totalDamage = Number(canonical.damageResolution?.total) || 0;
    const otherHit = totalHit - abilityHit - weaponHit;
    const otherDamage = totalDamage - abilityDamage - weaponDamage;
    const projectile = combatProfile.isProjectilePropulse
      ? add2eGetEquippedProjectileForWeapon(actor, weapon)
      : null;
    const damageSource = projectile ?? weapon;
    const attackDetailsTitle = attackRows.map(row => `${row.label} ${row.value}`).join(" · ") || "Aucun modificateur";
    const damageDetailsTitle = damageRows.map(row => `${row.label} ${row.value}`).join(" · ") || "Aucun modificateur";
    const effectRows = [...attackRows, ...damageRows].filter(row => !["ability-table", "weapon-base-field"].includes(row.producer));
    const effectSummary = [...new Set(effectRows.map(row => `${row.label} ${row.value}`))].join(" · ");

    return {
      id: weapon.id,
      name: weapon.name,
      img: weapon.img,
      equipped: engine.itemEquipped(weapon),
      damage: add2eSheetDisplayDamage(damageSource),
      damageSourceName: damageSource?.name ?? weapon.name,
      type: String(weapon.system?.type_degats ?? ""),
      speed: weapon.system?.facteur_rapidité ?? "—",
      combatProfile,
      abilityHitLabel: combatProfile.toucherCarac ? add2eAttackAbilityLabel(combatProfile.toucherCarac) : "—",
      abilityDamageLabel: combatProfile.degatsCarac ? add2eAttackAbilityLabel(combatProfile.degatsCarac) : "—",
      abilityHit,
      abilityDamage,
      abilityHitSigned: add2eSheetSigned(abilityHit),
      abilityDamageSigned: add2eSheetSigned(abilityDamage),
      weaponHit,
      weaponDamage,
      weaponHitSigned: add2eSheetSigned(weaponHit),
      weaponDamageSigned: add2eSheetSigned(weaponDamage),
      otherHit,
      otherDamage,
      otherHitSigned: add2eSheetSigned(otherHit),
      otherDamageSigned: add2eSheetSigned(otherDamage),
      totalHit,
      totalDamage,
      totalHitSigned: add2eSheetSigned(totalHit),
      totalDamageSigned: add2eSheetSigned(totalDamage),
      thacoBase: thaco,
      thacoEffectif: thaco - totalHit,
      attackRows,
      damageRows,
      attackDetailsTitle,
      damageDetailsTitle,
      effectSummary,
      projectileId: projectile?.id ?? null,
      projectileName: projectile?.name ?? "",
      projectileQuantity: projectile ? Number(projectile.system?.quantite ?? projectile.system?.quantity ?? 0) || 0 : null,
      projectileMissing: combatProfile.isProjectilePropulse && !projectile
    };
  });
}

function add2eSheetArmorRows(armors, armorClass, defenseRows, engine) {
  return armors.map(armor => {
    const contributions = defenseRows.filter(row => row.sourceId === String(armor.id));
    const selectedAsBase = String(armorClass?.selectedArmor?.id ?? "") === String(armor.id);
    const baseAc = Number(armor.system?.ac ?? armor.system?.ca ?? armor.system?.armorClass);
    const contributionSummary = contributions.map(row => `${row.label} ${row.value}`).join(" · ");
    const baseSummary = selectedAsBase ? `CA de base ${armorClass.armorBase}` : "";
    return {
      id: armor.id,
      name: armor.name,
      img: armor.img,
      equipped: engine.itemEquipped(armor),
      selectedAsBase,
      baseAc: Number.isFinite(baseAc) ? baseAc : "—",
      canonicalDelta: contributions.reduce((total, row) => total + Number(row.numericValue || 0), 0),
      canonicalDeltaDisplay: add2eSheetSigned(contributions.reduce((total, row) => total + Number(row.numericValue || 0), 0)),
      effectSummary: [baseSummary, contributionSummary].filter(Boolean).join(" · ") || "—"
    };
  });
}

export function add2ePrepareActorSheetCombatData({ actor, data, sys }) {
  const engine = add2eSheetArmorClassEngine();
  const transformation = globalThis.add2eGetCapabilityTransformationCombatProfile?.(actor) ?? null;

  const armorClass = engine.resolveArmorClass(actor, {
    source: "actor-sheet",
    consumer: "application-v2",
    frontale: true,
    position: "front"
  });
  sys.ca_naturel = Number(armorClass.caNaturel);
  sys.ca_total = Number(armorClass.caTotal);
  add2eSheetSyncArmorClass(actor, armorClass);

  const thaco = add2eSheetResolveThaco(actor, transformation);
  const defenseRows = add2eSheetDefenseRows(armorClass);
  const weaponRows = add2eSheetWeaponRows(actor, data.listeArmes, thaco, engine);
  const armorRows = add2eSheetArmorRows(data.listeArmures, armorClass, defenseRows, engine);
  const monkMartial = armorClass.monk ?? null;

  data.weaponRows = weaponRows;
  data.equippedWeaponRows = weaponRows.filter(row => row.equipped);
  data.armorRows = armorRows;
  data.monkMartialProgression = monkMartial;
  data.combatDefense = {
    ac_base: Number(armorClass.baseAfterFixed),
    ac_naturelle: Number(armorClass.caNaturel),
    ac_totale: Number(armorClass.caTotal),
    dex: Number(armorClass.dex) || 0,
    dexIgnored: armorClass.dexIgnored === true,
    thaco,
    detailRows: defenseRows,
    summaryRows: defenseRows,
    armor_class_resolution: armorClass,
    objets_magiques_defense: armorClass,
    monk_martial: monkMartial,
    attaques_par_round: monkMartial?.attacksPerRound ?? "",
    degats_main_nue: monkMartial?.unarmedDamage ?? "",
    mouvement_martial: monkMartial?.move ?? null,
    chute_ralentie: monkMartial?.slowFallText ?? "",
    transformation: armorClass.transformation ? {
      label: armorClass.transformation.label,
      sourceKey: armorClass.transformation.sourceKey,
      formKey: armorClass.transformation.formKey,
      armorClass: armorClass.transformation.armorClass,
      thac0: transformation?.thac0,
      movement: transformation?.movement
    } : null
  };

  data.saveRows = add2eSheetSavingThrowRows(actor);
  data.forceExValues = [];
  for (let value = 1; value <= 100; value += 1) {
    data.forceExValues.push({ value, label: value === 100 ? "00" : value.toString().padStart(2, "0") });
  }
}
