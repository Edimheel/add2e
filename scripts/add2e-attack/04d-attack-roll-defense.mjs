// scripts/add2e-attack/04d-attack-roll-defense.mjs
// ADD2E - Attaque 04d : helpers generiques de defense et CA cible.

import {
  add2eAttackReadFirstNumber,
  add2eAttackIsEquipped,
  add2eNormalizeAttackText
} from "./04c-attack-roll-state.mjs";

export function add2eAttackItemTags(item) {
  const sysItem = item?.system ?? {};
  const raw = [
    item?.name,
    sysItem.nom,
    sysItem.categorie,
    sysItem.type,
    ...(Array.isArray(sysItem.tags) ? sysItem.tags : []),
    ...(Array.isArray(sysItem.effectTags) ? sysItem.effectTags : [])
  ];

  return raw.map(add2eNormalizeAttackText).filter(Boolean);
}

export function add2eAttackItemHasAnyTag(item, ...needles) {
  const text = add2eAttackItemTags(item).join(" ");
  return needles.some(n => text.includes(add2eNormalizeAttackText(n)));
}

export function add2eAttackDexDefenseFromScore(score) {
  const dex = Number(score);
  if (!Number.isFinite(dex)) return 0;
  if (dex <= 3) return 4;
  if (dex === 4) return 3;
  if (dex === 5) return 2;
  if (dex === 6) return 1;
  if (dex <= 14) return 0;
  if (dex === 15) return -1;
  if (dex === 16) return -2;
  if (dex === 17) return -3;
  return -4;
}

export function add2eAttackGetDexDefenseMod(targetActor) {
  const s = targetActor?.system ?? {};

  const direct = add2eAttackReadFirstNumber(
    s.dex_defense,
    s.dexDefense,
    s.ca_defense,
    s.caDefense,
    s.defense_ca,
    s.defenseCA,
    s.dexterite_defense,
    s.dexteriteDefense,
    s.dexterite_ca_defense,
    s.mod_dex_defense,
    s.modDexDefense,
    s?.caracs?.dexterite?.ca,
    s?.caracs?.dexterite?.defense,
    s?.caracs?.dex?.ca,
    s?.caracs?.dex?.defense,
    s?.abilities?.dex?.defense,
    s?.abilities?.dexterite?.defense
  );

  if (direct !== null) return { value: direct, source: "stored-dex-defense" };

  const score = add2eAttackReadFirstNumber(
    s.dexterite,
    s.dexterite_base,
    s.dex,
    s.dex_base,
    s.dexterity,
    s.dexterity_base,
    s?.caracs?.dexterite?.value,
    s?.caracs?.dexterite?.base,
    s?.abilities?.dex?.value,
    s?.abilities?.dex?.base
  );

  return {
    value: add2eAttackDexDefenseFromScore(score ?? 10),
    source: score === null ? "dex-default-10" : `dex-score-${score}`
  };
}

export function add2eAttackGetArmorBaseCA(targetActor) {
  let best = 10;
  let source = "base-10";

  for (const item of targetActor?.items ?? []) {
    if (item?.type !== "armure") continue;
    if (!add2eAttackIsEquipped(item)) continue;
    if (add2eAttackItemHasAnyTag(item, "bouclier", "shield", "heaume", "casque", "helmet")) continue;

    const si = item.system ?? {};
    const itemCA = add2eAttackReadFirstNumber(si.ca, si.ac, si.armorClass, si.ca_base, si.base_ca, si.caTotal, si.ca_total);
    if (itemCA !== null && itemCA < best) {
      best = itemCA;
      source = `armure:${item.name}`;
    }
  }

  return { value: best, source };
}

export function add2eAttackGetShieldAdjustment(targetActor) {
  let total = 0;
  const sources = [];

  for (const item of targetActor?.items ?? []) {
    if (item?.type !== "armure") continue;
    if (!add2eAttackIsEquipped(item)) continue;
    if (!add2eAttackItemHasAnyTag(item, "bouclier", "shield")) continue;

    const si = item.system ?? {};
    const raw = add2eAttackReadFirstNumber(si.bonus_ca, si.bonus_ac, si.ca_bonus, si.ac_bonus, si.mod_ca, si.mod_ac);
    const adj = raw === null ? -1 : (raw > 0 ? -raw : raw);
    total += adj;
    sources.push(`${item.name}:${adj}`);
  }

  return { value: total, source: sources.length ? sources.join(", ") : "none" };
}

export function add2eAttackComputeCharacterDisplayedCA(targetActor) {
  const s = targetActor?.system ?? {};
  const armor = add2eAttackGetArmorBaseCA(targetActor);
  const dex = add2eAttackGetDexDefenseMod(targetActor);
  const shield = add2eAttackGetShieldAdjustment(targetActor);

  const total = armor.value + dex.value + shield.value;

  return {
    caTotal: total,
    armorBase: armor.value,
    armorSource: armor.source,
    dexMod: dex.value,
    dexSource: dex.source,
    shieldMod: shield.value,
    shieldSource: shield.source,
    stored: {
      ca: s.ca,
      armorClass: s.armorClass,
      ca_total: s.ca_total,
      ca_naturel: s.ca_naturel
    }
  };
}

console.log("[ADD2E][ATTACK][04D][DEFENSE_LOADED]");
