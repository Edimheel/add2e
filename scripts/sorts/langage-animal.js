// ADD2E — onUse aide MJ : Langage animal
// Clerc niveau 2 — Altération
// Compatible Foundry V13/V14/V15 : DialogV2 uniquement, aucun Dialog legacy.
// Retour moteur : true = sort consommé ; false = sort non consommé.

const ADD2E_CLERIC_AID_CONFIG = {
  name: "Langage animal",
  level: 2,
  school: "Altération",
  range: "0",
  duration: "2 rounds/niveau",
  area: "un animal dans un rayon de 3 pouces autour du clerc",
  components: "V, S",
  castingTime: "5 segments",
  save: "aucun",
  strategy: "aide_mj"
};

function add2eEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eCurrentActor() {
  if (typeof actor !== "undefined" && actor) return actor;
  if (typeof token !== "undefined" && token?.actor) return token.actor;
  if (typeof args !== "undefined" && args?.[0]?.actor) return args[0].actor;
  return null;
}

function add2eCurrentToken() {
  if (typeof token !== "undefined" && token) return token;
  if (typeof args !== "undefined" && args?.[0]?.token) return args[0].token;
  return canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eCurrentItem() {
  if (typeof item !== "undefined" && item) return item;
  if (typeof sort !== "undefined" && sort) return sort;
  if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
  return null;
}

function add2eTargetsLabel() {
  const targets = Array.from(game.user?.targets ?? []);
  if (targets.length) return targets.map(t => t.name).join(", ");
  return "Aucune cible sélectionnée — arbitrage MJ requis";
}

async function add2eClericAidOnUse(config) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error?.(`${config.name} : DialogV2 indisponible, sort non consommé.`);
    return false;
  }

  const caster = add2eCurrentActor();
  const sourceItem = add2eCurrentItem();
  const casterToken = add2eCurrentToken();
  const spellName = sourceItem?.name ?? config.name;
  const details = [
    ["École", config.school],
    ["Niveau", `Clerc ${config.level}`],
    ["Portée", config.range],
    ["Durée", config.duration],
    ["Zone d'effet", config.area],
    ["Composantes", config.components],
    ["Temps d'incantation", config.castingTime],
    ["Jet de sauvegarde", config.save],
    ["Cible(s)", add2eTargetsLabel()]
  ];

  const detailRows = details.map(([label, value]) => `
    <tr><th style="text-align:left;padding:3px 8px;color:#6f4b12;">${add2eEscapeHtml(label)}</th><td style="padding:3px 8px;">${add2eEscapeHtml(value)}</td></tr>`).join("");

  const content = `
    <section class="add2e-dialog add2e-cleric-aid" style="line-height:1.4;">
      <p><strong>${add2eEscapeHtml(spellName)}</strong> est préparé comme aide MJ : aucune automatisation destructive n'est appliquée.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff8e6;border:1px solid #d8b35f;">${detailRows}</table>
      <p style="margin-top:8px;"><strong>Procédure MJ :</strong> résoudre la cible, les jets et les effets selon la description de référence du Manuel des joueurs. Le bouton de lancement consomme le sort.</p>
    </section>`;

  const action = await DialogV2.wait({
    window: { title: `${spellName} — aide MJ ADD2E` },
    content,
    buttons: [
      { action: "cast", label: "Consommer le sort", default: true },
      { action: "cancel", label: "Annuler" }
    ],
    rejectClose: false
  });

  if (action !== "cast") return false;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-cleric-aid" style="border:1px solid #d8b35f;border-radius:8px;background:#fff8e6;padding:8px;">
        <h3 style="margin:0 0 6px 0;color:#6f4b12;">${add2eEscapeHtml(spellName)} — aide MJ</h3>
        <p style="margin:0 0 6px 0;"><strong>Lanceur :</strong> ${add2eEscapeHtml(caster?.name ?? "Clerc")}<br><strong>Cible(s) :</strong> ${add2eEscapeHtml(add2eTargetsLabel())}</p>
        <p style="margin:0;">Résolution manuelle requise : appliquer la portée, la durée, les composantes et le jet de sauvegarde indiqués dans la référence.</p>
      </div>`
  });

  return true;
}

return await add2eClericAidOnUse(ADD2E_CLERIC_AID_CONFIG);
