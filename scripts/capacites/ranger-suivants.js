// systems/add2e/scripts/capacites/ranger-suivants.js
// ADD2E — Ranger : Appel des suivants

const niveau = Number(actor?.system?.niveau ?? 1) || 1;
if (niveau < 10) {
  ui.notifications.warn("Le ranger doit être niveau 10 pour attirer ses suivants.");
  return false;
}

const used = await actor.getFlag("add2e", "rangerSuivantsUtilises");
if (used) {
  ui.notifications.warn("Les suivants du ranger ont déjà été appelés pour ce personnage.");
  return false;
}

const roll = await (new Roll("2d12")).evaluate({ async: true });
if (game.dice3d) await game.dice3d.showForRoll(roll);
await actor.setFlag("add2e", "rangerSuivantsUtilises", { used: true, total: roll.total, at: Date.now() });

const content = `
<div class="add2e-chat-card" style="border:1px solid #567;border-radius:8px;padding:8px;background:#f3f8ff;">
  <h3 style="margin:0 0 6px 0;color:#234;">Appel des suivants — ${actor.name}</h3>
  <p>Le ranger attire une troupe de suivants. Le résultat indique le nombre brut ; le MJ détermine leur nature.</p>
  <p style="font-size:1.2em;"><b>Nombre de suivants :</b> ${roll.total}</p>
  <p><small>Cette capacité est normalement unique pour ce ranger ; les suivants perdus ne sont pas automatiquement remplacés.</small></p>
</div>`;

await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
return true;
