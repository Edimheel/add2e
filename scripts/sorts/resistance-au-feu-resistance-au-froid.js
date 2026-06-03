// ADD2E — onUse Clerc niveau 2 : Résistance au feu
// Chemin Foundry déclaré : systems/add2e/scripts/sorts/resistance-au-feu-resistance-au-froid.js
// Compatible Foundry V13/V14/V15 : DialogV2 uniquement, aucune API Dialog legacy.
// Contrat : false = sort non consommé ; true = lancement confirmé et consommable.

const ADD2E_CLERIC_LEVEL2_SPELL = {
  "name": "Résistance au feu",
  "slug": "resistance_au_feu_resistance_au_froid",
  "level": 2,
  "school": "Altération",
  "range": "au toucher",
  "duration": "1 tour/niveau",
  "area": "créature touchée",
  "components": "V, S, M",
  "castingTime": "5 segments",
  "save": "aucun",
  "materials": "goutte de mercure",
  "description": "Quand ce sort est lancé, la personne touchée est capable de résister à des chaleurs importantes : brûlures ou canicule. Elle peut même supporter des chaleurs très importantes, tels que des feux magiques brûlants, des incendies, des braises incandescentes, de l’huile bouillante en grande quantité, des épées langues de feu, des tempêtes de feu, des boules de feu, des nuées de météores ou le souffle de dragons rouges. Cependant, la personne en question subira quand même des dommages, mais moindres que si elle ne bénéficiait pas du sort. Avec un jet de protection réussi, la victime ne subira que le quart des dégâts ; si le jet de protection est raté, elle subira la moitié des dégâts. De plus, le jet de protection obtient un bonus de +3. La résistance dure 1 tour pour chaque niveau d’expérience atteint par le clerc qui lance le sort. Le lanceur du sort a besoin d’une goutte de mercure comme composante matérielle.",
  "automation": "Aide MJ DialogV2 : rappelle +3 au jet de protection contre le feu et réduction des dégâts (quart si sauvegarde réussie, moitié si ratée). Pas de réduction automatique faute de mécanisme centralisé confirmé.",
  "ruleReminders": [
    "Bonus sauvegarde feu : +3.",
    "Dégâts de feu : un quart si la sauvegarde réussit, moitié si elle rate.",
    "Le script ne modifie pas les dégâts automatiquement."
  ]
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

function add2eTargetNames() {
  return Array.from(game.user?.targets ?? []).map(target => target.name);
}

function add2eTargetsLabel() {
  const names = add2eTargetNames();
  return names.length ? names.join(", ") : "Aucune cible sélectionnée — résolution MJ";
}

function add2eRulesList(config) {
  return (config.ruleReminders ?? [])
    .map(rule => `<li>${add2eEscapeHtml(rule)}</li>`)
    .join("");
}

function add2eDetailsRows(config) {
  const rows = [
    ["Nom référence", config.name],
    ["Niveau", `Clerc ${config.level}`],
    ["École", config.school],
    ["Portée", config.range],
    ["Durée", config.duration],
    ["Zone d'effet", config.area],
    ["Composantes", config.components],
    ["Temps d'incantation", config.castingTime],
    ["Jet de sauvegarde", config.save],
    ["Cible(s)", add2eTargetsLabel()]
  ];
  if (config.materials) rows.push(["Composants matériels", config.materials]);
  return rows.map(([label, value]) => `
    <tr>
      <th style="text-align:left;padding:4px 8px;color:#6f4b12;width:34%;">${add2eEscapeHtml(label)}</th>
      <td style="padding:4px 8px;">${add2eEscapeHtml(value)}</td>
    </tr>`).join("");
}

async function add2eConfirmClericLevel2(config) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    console.error(`[ADD2E][CLERC_N2][${config.slug}] DialogV2 indisponible.`);
    return false;
  }

  const sourceItem = add2eCurrentItem();
  const spellName = sourceItem?.name ?? config.name;
  const content = `
    <section class="add2e-cleric-level2-onuse" style="line-height:1.4;">
      <p><strong>${add2eEscapeHtml(spellName)}</strong> est résolu en aide MJ sûre. Le script ne crée pas d'effet mécanique incertain.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff8e6;border:1px solid #d8b35f;margin:6px 0;">
        ${add2eDetailsRows(config)}
      </table>
      <p><strong>Niveau d'automatisation :</strong> ${add2eEscapeHtml(config.automation)}</p>
      <ul>${add2eRulesList(config)}</ul>
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-weight:bold;">Description normalisée de référence</summary>
        <p>${add2eEscapeHtml(config.description)}</p>
      </details>
    </section>`;

  const result = await DialogV2.wait({
    window: { title: `${spellName} — Clerc niveau 2` },
    content,
    buttons: [
      { action: "cast", label: "Confirmer et consommer", icon: "fa-solid fa-check", default: true, callback: () => "cast" },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });

  return result === "cast";
}

async function add2ePostClericLevel2Chat(config) {
  const caster = add2eCurrentActor();
  const casterToken = add2eCurrentToken();
  const sourceItem = add2eCurrentItem();
  const spellName = sourceItem?.name ?? config.name;
  const targets = add2eTargetsLabel();
  const reminders = add2eRulesList(config);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-clerc-niveau-2" style="border:1px solid #d8b35f;border-radius:8px;background:#fff8e6;padding:8px;">
        <h3 style="margin:0 0 6px 0;color:#6f4b12;">${add2eEscapeHtml(spellName)} — aide MJ</h3>
        <p style="margin:0 0 6px 0;"><strong>Lanceur :</strong> ${add2eEscapeHtml(caster?.name ?? "Clerc")}<br><strong>Cible(s) :</strong> ${add2eEscapeHtml(targets)}</p>
        <p style="margin:0 0 6px 0;"><strong>Portée :</strong> ${add2eEscapeHtml(config.range)} ; <strong>Durée :</strong> ${add2eEscapeHtml(config.duration)} ; <strong>Zone :</strong> ${add2eEscapeHtml(config.area)} ; <strong>Jet :</strong> ${add2eEscapeHtml(config.save)}.</p>
        <p style="margin:0 0 6px 0;">${add2eEscapeHtml(config.automation)}</p>
        ${reminders ? `<ul style="margin:0 0 0 18px;">${reminders}</ul>` : ""}
      </div>`
  });
}

return await (async () => {
  const confirmed = await add2eConfirmClericLevel2(ADD2E_CLERIC_LEVEL2_SPELL);
  if (!confirmed) return false;
  await add2ePostClericLevel2Chat(ADD2E_CLERIC_LEVEL2_SPELL);
  return true;
})();
