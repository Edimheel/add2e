/*
 * ADD2E — Moine : Auto-guérison
 * Script exécuté via on_use d'une classFeature.
 * Compatible Foundry V13 / V14 / V15.
 */
const ADD2E_MOINE_AUTO_GUERISON_VERSION = "2026-07-10-add2e-time-cooldown-v4";
const ADD2E_MOINE_AUTO_GUERISON_DAY_ROUNDS = 1440;

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

function a2eMonkCurrentTick() {
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  try {
    const tick = Number(engine?.currentTick?.());
    if (Number.isFinite(tick)) return Math.max(0, Math.floor(tick));
  } catch (_error) {}

  try {
    const tick = Number(game.settings?.get?.("add2e", "worldTimeTick"));
    if (Number.isFinite(tick)) return Math.max(0, Math.floor(tick));
  } catch (_error) {}

  const worldTime = Number(game.time?.worldTime);
  return Number.isFinite(worldTime) ? Math.max(0, Math.floor(worldTime / 60)) : 0;
}

function a2eMonkCooldownState(currentActor, currentTick) {
  const raw = currentActor.getFlag("add2e", "moine.autoGuerison");
  const data = raw && typeof raw === "object" ? raw : {};
  const lastUseTick = Number(data.lastUseTick ?? data.usedAtTick);
  const storedAvailableAtTick = Number(data.availableAtTick);
  const availableAtTick = Number.isFinite(storedAvailableAtTick)
    ? Math.max(0, Math.floor(storedAvailableAtTick))
    : (Number.isFinite(lastUseTick)
      ? Math.max(0, Math.floor(lastUseTick)) + ADD2E_MOINE_AUTO_GUERISON_DAY_ROUNDS
      : null);
  const remainingRounds = availableAtTick === null
    ? 0
    : Math.max(0, availableAtTick - currentTick);

  return {
    data,
    lastUseTick: Number.isFinite(lastUseTick) ? Math.max(0, Math.floor(lastUseTick)) : null,
    availableAtTick,
    remainingRounds
  };
}

function a2eMonkFormatRounds(rounds) {
  let remaining = Math.max(0, Math.ceil(Number(rounds) || 0));
  const days = Math.floor(remaining / 1440);
  remaining %= 1440;
  const hours = Math.floor(remaining / 60);
  const rest = remaining % 60;
  const parts = [];
  if (days) parts.push(`${days} jour(s)`);
  if (hours) parts.push(`${hours} heure(s)`);
  if (rest || !parts.length) parts.push(`${rest} round(s)`);
  return parts.join(" et ");
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

const currentTick = a2eMonkCurrentTick();
const cooldown = a2eMonkCooldownState(actor, currentTick);
if (cooldown.remainingRounds > 0) {
  ui.notifications.warn(`Auto-guérison déjà utilisée : disponible dans ${a2eMonkFormatRounds(cooldown.remainingRounds)}.`);
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

const availableAtTick = currentTick + ADD2E_MOINE_AUTO_GUERISON_DAY_ROUNDS;
await actor.update({ "system.pdv": healed });
await actor.setFlag("add2e", "moine.autoGuerison", {
  used: true,
  lastUseTick: currentTick,
  availableAtTick,
  cooldownRounds: ADD2E_MOINE_AUTO_GUERISON_DAY_ROUNDS,
  amount: gained,
  formula: healFormula,
  rollTotal: healAmount,
  timeEngineVersion: globalThis.ADD2E_TIME_ENGINE_VERSION ?? game?.add2e?.time?.version ?? null,
  at: Date.now()
});

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `<div class="add2e-chat-card"><h3>Auto-guérison du moine</h3><p><b>${actor.name}</b> récupère <b>${gained} PV</b>.</p><p>Formule : <b>${healFormula}</b> → ${healAmount}</p><p>PV : ${current} → ${healed} / ${max}</p><p>Utilisation : <b>1 / jour</b>.</p></div>`
});
return true;
