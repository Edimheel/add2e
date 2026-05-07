// ADD2E — onUse Magicien : Nuage incendiaire
// Version : 2026-05-05-magicien-n1-9-v2
// Retour attendu : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  "name": "Nuage incendiaire",
  "slug": "nuage_incendiaire",
  "level": 8,
  "kind": "damage",
  "description": "Nuage incendiaire produit un effet offensif de magicien. Les dégâts, jets de sauvegarde, résistances, immunités et effets secondaires doivent être appliqués selon la règle du sort et l’arbitrage du MD.",
  "dice": null,
  "modes": [
    {
      "id": "normal",
      "label": "Nuage incendiaire"
    }
  ]
};
const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eCasterLevel(actor) {
  return Number(actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.details?.niveau ?? 1) || 1;
}

async function add2eEvalRoll(formula) {
  return await new Roll(formula).evaluate();
}

function add2eDamageFormula(raw, level) {
  const s = String(raw || "1d6");
  if (s === "leveld3") return `${Math.max(1, level)}d3`;
  if (s === "leveld4+level") return `${Math.max(1, level)}d4+${level}`;
  if (s === "leveld6") return `${Math.max(1, Math.min(10, level))}d6`;
  if (s === "1d8+level") return `1d8+${level}`;
  if (s === "1d6+level") return `1d6+${level}`;
  if (s === "special" || s === "variable") return "1d20";
  return s;
}

function add2eRoundCount(level) {
  return Math.max(1, level);
}

function add2eGetCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eGetTargets({ fallbackCaster = true } = {}) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length) return targets;
  const casterToken = add2eGetCasterToken();
  return (fallbackCaster && casterToken) ? [casterToken] : [];
}

async function add2eChat(title, html, speakerToken = null, options = {}) {
  const casterToken = speakerToken ?? add2eGetCasterToken();
  const casterActor = actor ?? casterToken?.actor ?? null;
  const casterName = casterActor?.name ?? casterToken?.name ?? "Magicien";
  const spellName = item?.name ?? title ?? "Sort de magicien";
  const casterImg = casterToken?.document?.texture?.src ?? casterActor?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = item?.img ?? "icons/svg/book.svg";
  const targets = Array.from(game.user.targets ?? []);
  const targetLabel = options.targetLabel ?? (targets.length ? targets.map(t => t.name).join(", ") : casterName);
  const outcome = options.outcome ?? title ?? spellName;
  const rule = options.rule ?? "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
          <img src="${add2eHtmlEscape(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${add2eHtmlEscape(casterName)}</div>
            <div style="font-size:12px;font-weight:700;">lance ${add2eHtmlEscape(spellName)}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Sort profane</div>
          <img src="${add2eHtmlEscape(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
        </div>
        <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
          <div style="font-size:13px;margin:0 0 6px 0;"><b>Cible :</b> ${add2eHtmlEscape(targetLabel)}</div>
          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${add2eHtmlEscape(outcome)}</div>
            <div style="font-size:13px;line-height:1.35;text-align:center;">${html}</div>
          </div>
          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Règle appliquée</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">${rule || "Effet du sort appliqué selon sa description et l’arbitrage du MD."}</div>
          </details>
        </div>
      </div>`
  });
}

async function add2eApplyEffect(targetActor, name, tags, rounds = 0) {
  if (!targetActor) return false;
  await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name,
    img: item?.img || "icons/svg/aura.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: { rounds: rounds || undefined, startRound: game.combat?.round ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null },
    description: ADD2E_SORT_CONFIG.description,
    flags: { add2e: { tags } }
  }]);
  return true;
}

async function add2eAskNote(config) {
  const needsNote = ["note","summon","summon_note","movement","terrain","utility","detection"].includes(config.kind) || (config.modes?.length > 1);
  if (!needsNote) return { mode: "normal", note: "" };
  return await new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const buttons = {};
    for (const m of config.modes ?? [{id:"normal",label:config.name}]) {
      buttons[m.id] = { label: m.label, callback: html => finish({ mode:m.id, note: html.find("[name='note']").val() ?? "" }) };
    }
    buttons.cancel = { label: "Annuler", callback: () => finish(null) };
    new Dialog({
      title: config.name,
      content: `<form><p><b>${add2eHtmlEscape(config.name)}</b></p><div class="form-group"><label>Note / paramètres</label><textarea name="note" rows="3"></textarea></div></form>`,
      buttons,
      default: Object.keys(buttons)[0],
      close: () => finish(null)
    }).render(true);
  });
}

const choice = await add2eAskNote(ADD2E_SORT_CONFIG);
if (!choice) return false;

const level = add2eCasterLevel(actor);
const targets = add2eGetTargets({ fallbackCaster: ADD2E_SORT_CONFIG.kind !== "damage" });
const baseTags = [`sort:${ADD2E_SORT_CONFIG.slug}`, "classe:magicien", "liste:magicien", `niveau:${ADD2E_SORT_CONFIG.level}`, `type:${ADD2E_SORT_CONFIG.kind}`];

console.log(`${ADD2E_ONUSE_TAG}[START]`, { sort: ADD2E_SORT_CONFIG.name, actor: actor?.name, level, targets: targets.map(t => t.name), mode: choice.mode });

if (ADD2E_SORT_CONFIG.kind === "damage") {
  const formula = add2eDamageFormula(ADD2E_SORT_CONFIG.dice, level);
  const roll = await add2eEvalRoll(formula);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }), flavor: ADD2E_SORT_CONFIG.name });
  await add2eChat(ADD2E_SORT_CONFIG.name, `
    <p>Jet indicatif : <b>${roll.total}</b> (${formula})</p>
    ${targets.length ? `<p>Cible(s) : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>` : "<p>Aucune cible sélectionnée : appliquer manuellement si nécessaire.</p>"}
  `, null, { outcome: "EFFET OFFENSIF", rule: add2eHtmlEscape(ADD2E_SORT_CONFIG.description) });
  return true;
}

if (["condition","protection"].includes(ADD2E_SORT_CONFIG.kind)) {
  for (const t of targets) await add2eApplyEffect(t.actor, ADD2E_SORT_CONFIG.name, baseTags, add2eRoundCount(level));
  await add2eChat(ADD2E_SORT_CONFIG.name, `<p>Effet actif appliqué à : ${targets.map(t => `<b>${add2eHtmlEscape(t.name)}</b>`).join(", ")}</p>`, null, { outcome: "EFFET ACTIF", rule: add2eHtmlEscape(ADD2E_SORT_CONFIG.description) });
  return true;
}

await add2eChat(ADD2E_SORT_CONFIG.name, `
  <p>${add2eHtmlEscape(ADD2E_SORT_CONFIG.description)}</p>
  ${choice.note ? `<p>Note : <b>${add2eHtmlEscape(choice.note)}</b></p>` : ""}
`, null, { outcome: ADD2E_SORT_CONFIG.name.toUpperCase(), rule: add2eHtmlEscape(ADD2E_SORT_CONFIG.description) });
return true;
