/*
 * ADD2E — Moine : Auto-guérison
 * Script exécuté via on_use d'une classFeature.
 * Compatible Foundry V13 / V14 / V15.
 */
const ADD2E_MOINE_AUTO_GUERISON_VERSION = "2026-08-07-canonical-resource-v6";

globalThis.ADD2E_MOINE_AUTO_GUERISON_VERSION = ADD2E_MOINE_AUTO_GUERISON_VERSION;

function a2eNum(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function a2eMonkFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function a2eMonkClassItem(currentActor, currentFeature) {
  const itemId = String(currentFeature?._add2eClassItemId ?? "").trim();
  if (itemId) {
    const byId = currentActor?.items?.get?.(itemId)
      ?? Array.from(currentActor?.items ?? []).find(item => String(item?.id ?? "") === itemId)
      ?? null;
    if (byId) return byId;
  }

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return Array.from(currentActor?.items ?? []).find(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    const system = item.system ?? {};
    const label = normalize(item.name || system.slug || system.label || system.nom || system.name || "");
    const tags = Array.isArray(system.tags) ? system.tags.map(normalize) : [];
    return label === "moine" || tags.includes("classe_moine") || tags.includes("classe:moine");
  }) ?? null;
}

function a2eGetMonkRow(classItem, level) {
  const rows = classItem?.system?.progression;
  if (!Array.isArray(rows)) return null;
  return rows.find(row => Number(row?.niveau ?? row?.level) === level)
    ?? rows.slice().reverse().find(row => Number(row?.niveau ?? row?.level ?? 0) <= level)
    ?? null;
}

function a2eMonkSelfHealFormula(row) {
  return String(row?.monk?.selfHealFormula ?? "").trim();
}

async function a2eRollMonkHealFormula(formula) {
  const clean = String(formula ?? "").trim();
  if (!clean) return { total: 0, roll: null };
  if (/^[0-9]+$/.test(clean)) return { total: Math.max(0, Number(clean) || 0), roll: null };

  const roll = new Roll(clean);
  try {
    await roll.evaluate({ async: true });
  } catch (_error) {
    await roll.evaluate();
  }
  return { total: Math.max(0, Math.floor(a2eNum(roll.total, 0))), roll };
}

if (!actor) {
  ui.notifications.error("Auto-guérison du moine : acteur introuvable.");
  return false;
}

const level = a2eMonkFeatureLevel(actor, feature);
const monkClass = a2eMonkClassItem(actor, feature);
if (level === null || !monkClass) {
  ui.notifications.error("Auto-guérison du moine : niveau ou classe Moine introuvable.");
  return false;
}

const row = a2eGetMonkRow(monkClass, level);
const healFormula = a2eMonkSelfHealFormula(row);
if (!healFormula) {
  ui.notifications.warn("Auto-guérison indisponible à ce niveau.");
  return false;
}

const current = a2eNum(actor.system?.pdv, 0);
const max = a2eNum(actor.system?.points_de_coup, current);
const healRoll = await a2eRollMonkHealFormula(healFormula);
const healAmount = healRoll.total;
if (healAmount <= 0) {
  ui.notifications.warn("Auto-guérison : la formule de soin n’a produit aucun PV.");
  return false;
}

const healed = Math.min(max, current + healAmount);
const gained = Math.max(0, healed - current);
if (gained <= 0) {
  ui.notifications.info(`${actor.name} est déjà à ses PV maximum.`);
  return false;
}

await actor.update(
  { "system.pdv": healed },
  { add2eInternal: true, add2eReason: "monk-self-heal", render: false }
);

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}
const cardOptions = {
  actor,
  title: "Auto-guérison du moine",
  icon: "fas fa-hand-holding-medical",
  variant: "success",
  rows: [
    { label: "Récupération", value: `+${gained} PV` },
    { label: "Formule", value: `${healFormula} → ${healAmount}` },
    { label: "PV", value: `${current} → ${healed} / ${max}` },
    { label: "Utilisation", value: feature?.uses?.label ?? "1 / jour" }
  ],
  chatData: {
    flags: {
      add2e: {
        sourceCapacite: "moine-auto-guerison",
        version: ADD2E_MOINE_AUTO_GUERISON_VERSION
      }
    }
  }
};
buildChatCard(cardOptions);
await createChatCard(cardOptions);
return true;