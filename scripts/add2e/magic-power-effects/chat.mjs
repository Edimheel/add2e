// ADD2E — Pouvoirs d'objets magiques / cartes de chat et confirmations.

import { VERSION, effectTypes, esc, norm, powerName } from "./runtime.mjs";

export async function createCard(actor, item, power, {
  title = powerName(power, item), variant = "magic", rows = [], message = "", targets = []
} = {}) {
  if (typeof globalThis.add2eCreateChatCard !== "function") throw new Error("Le constructeur de carte ADD2E est indisponible.");
  return globalThis.add2eCreateChatCard({
    actor,
    title,
    icon: "fas fa-wand-magic-sparkles",
    variant,
    source: { name: item.name, img: item.img, type: "Objet magique", meta: powerName(power, item) },
    target: targets.length === 1 ? { name: targets[0].name, img: targets[0].img } : null,
    rows,
    message,
    chatData: { flags: { add2e: {
      magicItemCataloguePower: true,
      sourceItemId: item.id,
      magicPowerId: power.catalogueId ?? power.id,
      version: VERSION
    } } }
  });
}

export function parameterRows(power) {
  const rows = [{ label: "Automatisation", value: power.automation ?? "manual" }];
  const activation = [power.activation?.type, power.activation?.trigger].filter(Boolean).join(" / ");
  if (activation) rows.push({ label: "Activation", value: activation });
  if (effectTypes(power).length) rows.push({ label: "Effets", value: effectTypes(power).join(", ") });
  for (const [key, value] of Object.entries(power.parameters ?? {})) {
    rows.push({ label: key, value: typeof value === "object" ? JSON.stringify(value) : String(value) });
  }
  return rows.slice(0, 12);
}

export async function confirmPower(actor, item, power) {
  if (norm(power.automation) === "automatic" && !["action", "command", "use"].includes(norm(power.activation?.type))) return true;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) throw new Error("DialogV2 est indisponible.");
  return DialogV2.confirm({
    window: { title: `Utiliser ${powerName(power, item)}` },
    modal: true,
    content: `<div class="add2e-dialog" style="min-width:480px;padding:8px;"><p><b>${esc(actor.name)}</b> utilise <b>${esc(powerName(power, item))}</b> depuis <b>${esc(item.name)}</b>.</p><p>Traitement : <b>${esc(effectTypes(power).join(", ") || "résolution assistée")}</b>.</p></div>`,
    yes: { label: "Utiliser le pouvoir", icon: "fa-solid fa-wand-magic-sparkles" },
    no: { label: "Annuler", icon: "fa-solid fa-xmark" }
  });
}

export async function evaluate(formulaText) {
  const roll = await new Roll(formulaText).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return roll;
}
