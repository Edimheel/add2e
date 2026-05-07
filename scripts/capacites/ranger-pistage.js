// systems/add2e/scripts/capacites/ranger-pistage.js
// ADD2E — Ranger : Pistage

const niveau = Number(actor?.system?.niveau ?? 1) || 1;
const classe = actor?.items?.find(i => i.type === "classe" && String(i.name).toLowerCase().includes("ranger"));
const progression = Array.isArray(classe?.system?.progression) ? classe.system.progression : [];
const ligne = progression.find(p => Number(p.niveau ?? p.level) === niveau) ?? progression[Math.max(0, niveau - 1)] ?? {};

let exterieur = ligne?.tracking?.exterieur;
let souterrain = ligne?.tracking?.souterrain;

if ((exterieur === undefined || souterrain === undefined) && Array.isArray(ligne?.skills)) {
  exterieur = ligne.skills[0];
  souterrain = ligne.skills[1];
}

exterieur = Number(exterieur ?? 0) || 0;
souterrain = Number(souterrain ?? 0) || 0;

const content = `
<div class="add2e-chat-card" style="border:1px solid #7a8f55;border-radius:8px;padding:8px;background:#f7fbef;">
  <h3 style="margin:0 0 6px 0;color:#425d1f;">Pistage — ${actor.name}</h3>
  <p>Le ranger tente de suivre une piste. Le MJ applique les modificateurs selon le terrain, le temps écoulé, la météo et le nombre de créatures.</p>
  <ul>
    <li><b>Base extérieur :</b> ${exterieur || "selon situation"}%</li>
    <li><b>Base souterrain :</b> ${souterrain || "selon situation"}%</li>
    <li><b>Rappel :</b> +2 % par créature au-delà de la première ; −10 % par jour écoulé ; −25 % par heure de précipitations.</li>
  </ul>
</div>`;

await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
return true;
