// ADD2E — Actor sheet listeners : jets de caractéristiques, sauvegardes et HUD.

export const ADD2E_SHEET_ROLL_DELEGATION_VERSION = "2026-05-25-sheet-roll-cards-global-v2";

export async function add2eEvaluateRollSafe(formula) {
  const roll = new Roll(formula);
  await roll.evaluate();
  return roll;
}

export async function add2eRollCharacteristicCard(actor, carac) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  const label = carac?.toUpperCase() || "Caractéristique";
  const val = Number(actor.system?.[carac]) || 10;
  const roll = await add2eEvaluateRollSafe("1d20");
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const icons = { force: "fa-dumbbell", dexterite: "fa-running", constitution: "fa-heartbeat", intelligence: "fa-brain", sagesse: "fa-eye", charisme: "fa-theater-masks" };
  const colors = { force: "#4ab878", dexterite: "#f3aa3c", constitution: "#e74c3c", intelligence: "#2980b9", sagesse: "#9b59b6", charisme: "#e056fd" };
  const icon = icons[carac] || "fa-dice-d20";
  const color = colors[carac] || "#6c4e95";
  const success = roll.total <= val;
  const result = success ? "✔️ Réussite" : "❌ Échec";
  const resultColor = success ? "#1cb360" : "#c34040";
  const content = `<div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #b5e7c388;background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%);border:1.4px solid ${color};max-width:420px;padding:.85em 1.1em .8em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.17em;font-weight:bold;color:${color};">${label}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Test de caractéristique</span></div><div style="font-size:1.11em;margin-bottom:.25em;">Seuil&nbsp;: <b>${val}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b></div><div style="margin:.2em 0 .1em;font-size:1.1em;"><span style="font-weight:600;color:${resultColor};">${result}</span></div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export async function add2eRollSaveCard(actor, idx) {
  if (!actor) return ui.notifications.warn("Aucun acteur pour ce jet.");
  idx = Number(idx);
  const saves = actor.system?.details_classe?.progression?.[actor.system.niveau - 1]?.savingThrows || actor.system?.sauvegardes || [];
  const noms = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
  const nom = noms[idx] || "Jet";
  const valeur = Number(saves[idx]);
  if (!valeur) return ui.notifications.warn("Aucune valeur pour ce jet.");

  const roll = await add2eEvaluateRollSafe("1d20");
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  let bonusSave = 0;
  if (typeof Add2eEffectsEngine !== "undefined") {
    try { bonusSave = Number((Add2eEffectsEngine.analyze?.(actor, { type: "save", vsType: nom, frontale: true }) ?? {}).bonus_save || 0); }
    catch (e) { console.warn("[ADD2E][SAVE] Erreur analyse effets de sauvegarde", e); }
  }

  const totalJet = Number(roll.total || 0) + bonusSave;
  const saveIcons = ["fa-skull-crossbones", "fa-mountain", "fa-magic", "fa-fire", "fa-scroll"];
  const colors = ["#c48642", "#6394e8", "#b12f95", "#e67e22", "#a173d9"];
  const icon = saveIcons[idx] || "fa-dice-d20";
  const color = colors[idx] || "#6c4e95";
  const success = totalJet >= valeur;
  const result = success ? "✔️ Réussite" : "❌ Échec";
  const resultColor = success ? "#1cb360" : "#c34040";
  const details = bonusSave ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets&nbsp;: <b>${bonusSave >= 0 ? "+" : ""}${bonusSave}</b> → <b>${totalJet}</b>` : "";
  const content = `<div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #cfdfff88;background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%);border:1.4px solid ${color};max-width:420px;padding:.85em 1.1em .8em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.12em;font-weight:bold;color:${color};">${nom}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Jet de sauvegarde</span></div><div style="font-size:1.09em;margin-bottom:.25em;">Seuil&nbsp;: <b>${valeur}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>${details}</div><div style="margin:.2em 0 .1em;font-size:1.1em;"><span style="font-weight:600;color:${resultColor};">${result}</span></div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

function add2eHudRollActorFallback() {
  const hudState = globalThis.add2eHudFixDebug?.();
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.actors?.get?.(hudState?.actorId) ?? game.user?.character ?? null;
}

export function add2eInstallHudSheetRollBridge() {
  globalThis.ADD2E_SHEET_ROLL_DELEGATION_VERSION = ADD2E_SHEET_ROLL_DELEGATION_VERSION;
  globalThis.add2eRollCharacteristicCard = add2eRollCharacteristicCard;
  globalThis.add2eRollSaveCard = add2eRollSaveCard;
  if (globalThis.__add2eHudSheetRollBridgeV1) return;
  globalThis.__add2eHudSheetRollBridgeV1 = true;
  document.addEventListener("click", async ev => {
    const btn = ev.target?.closest?.("#add2e-action-hud [data-action='roll-ability'], #add2e-action-hud [data-action='roll-save']");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    const actor = add2eHudRollActorFallback();
    if (!actor) return ui.notifications.warn("Aucun acteur sélectionné pour le jet.");
    if (btn.dataset.action === "roll-ability") return add2eRollCharacteristicCard(actor, btn.dataset.ability);
    if (btn.dataset.action === "roll-save") return add2eRollSaveCard(actor, Number(btn.dataset.saveIndex));
  }, true);
}
