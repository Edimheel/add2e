// scripts/actor-sheet/actor-identity.mjs
// ADD2E — Lecture des identités race/classe de l'acteur.

import {
  add2eCollectTagsFromItem,
  add2eNormalizeTags
} from "./utils.mjs";

import {
  add2eRaceIdentityTags
} from "./race-class-compatibility.mjs";

export function add2eGetActorClassName(actor) {
  const sys = actor?.system ?? {};
  const ownedClass = actor?.items?.find?.(i => String(i.type).toLowerCase() === "classe");

  return (
    sys.details_classe?.name ||
    sys.details_classe?.label ||
    sys.details_classe?.slug ||
    sys.classe ||
    ownedClass?.name ||
    ownedClass?.system?.label ||
    ownedClass?.system?.slug ||
    ""
  );
}

export function add2eGetActorClassSystem(actor) {
  const sys = actor?.system ?? {};

  if (sys.details_classe && typeof sys.details_classe === "object") return sys.details_classe;

  const ownedClass = actor?.items?.find?.(i => String(i.type).toLowerCase() === "classe");
  if (!ownedClass) return {};

  const system = foundry.utils.deepClone(ownedClass.system ?? {});
  system.name ??= ownedClass.name;
  system.label ??= ownedClass.name;
  system.appliedTags ??= add2eCollectTagsFromItem(ownedClass);
  return system;
}

export function add2eGetActorRaceName(actor) {
  const sys = actor?.system ?? {};
  const ownedRace = actor?.items?.find?.(i => String(i.type).toLowerCase() === "race");

  return (
    sys.details_race?.name ||
    sys.details_race?.label ||
    sys.details_race?.slug ||
    sys.race ||
    ownedRace?.name ||
    ownedRace?.system?.label ||
    ownedRace?.system?.slug ||
    ""
  );
}

export function add2eGetActorRaceSystem(actor) {
  const sys = actor?.system ?? {};

  if (sys.details_race && typeof sys.details_race === "object") {
    const details = foundry.utils.deepClone(sys.details_race);
    details.appliedTags = [
      ...add2eNormalizeTags(details.appliedTags),
      ...add2eNormalizeTags(actor?.flags?.add2e?.racialTags)
    ];
    return details;
  }

  const ownedRace = actor?.items?.find?.(i => String(i.type).toLowerCase() === "race");
  if (!ownedRace) return {};

  const system = foundry.utils.deepClone(ownedRace.system ?? {});
  system.name ??= ownedRace.name;
  system.label ??= ownedRace.name;
  system.appliedTags = [
    ...add2eRaceIdentityTags(ownedRace.name, system),
    ...add2eCollectTagsFromItem(ownedRace),
    ...add2eNormalizeTags(actor?.flags?.add2e?.racialTags)
  ];

  return system;
}

export function add2eClassNameFromItem(item) {
  return item?.system?.slug || item?.system?.name || item?.system?.label || item?.name || "";
}

export function add2eRaceNameFromItem(item) {
  return item?.system?.slug || item?.system?.name || item?.system?.label || item?.name || "";
}
