// ============================================================
// ADD2E — on_use capacité de voleur
// Appelé par les activeClassFeatures des objets classe.
// Reçoit : actor, feature, item, sort, game, ui, ChatMessage, Roll, foundry, canvas
// ============================================================

const featureName = String(feature?.name ?? feature?.label ?? item?.name ?? "Compétence de voleur");
const rawSkillKey = String(
  feature?.skillKey ??
  feature?.key ??
  feature?.slug ??
  feature?.id ??
  featureName ??
  ""
).trim();

if (!actor) {
  ui.notifications.error("Compétence de voleur : acteur introuvable.");
  return false;
}

if (!rawSkillKey) {
  ui.notifications.error(`Compétence de voleur : clé introuvable pour « ${featureName} ».`);
  return false;
}

if (typeof globalThis.add2eRollThiefSkill !== "function") {
  ui.notifications.error("Le moteur des compétences de voleur n'est pas chargé.");
  console.error("[ADD2E][VOLEUR][ON_USE][ERROR] add2eRollThiefSkill introuvable", {
    actor: actor.name,
    feature,
    rawSkillKey
  });
  return false;
}

console.log("[ADD2E][VOLEUR][ON_USE]", {
  actor: actor.name,
  feature: featureName,
  skillKey: rawSkillKey
});

await globalThis.add2eRollThiefSkill(actor, rawSkillKey);
return true;
