// ADD2E — onUse Magicien : Agrandissement / Retrecissement
// Version : 2026-05-24-magicien-agrandissement-v2-token-scale
// Retour attendu : true = sort consomme, false = sort non consomme.

const ADD2E_SORT_NAME = "Agrandissement";
const ADD2E_SORT_SLUG = "agrandissement";
const ADD2E_SORT_LEVEL = 1;
const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][AGRANDISSEMENT]";
const ADD2E_AGRANDISSEMENT_RULE = "Agrandissement : portee 1/2 pouce par niveau, duree 1 tour par niveau, jet de protection annule si cible non consentante. La taille, le poids et la force effective varient de 10% par niveau, jusqu'a un maximum de 50%. L'inverse, Retrecissement, reduit dans les memes proportions.";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eGetGlobal(name) {
  try { return globalThis?.[name]; } catch (_) { return undefined; }
}

function add2eGetItem() {
  return (typeof item !== "undefined" && item) ? item : add2eGetGlobal("item") ?? null;
}

function add2eGetActor() {
  if (typeof actor !== "undefined" && actor) return actor;
  const t = add2eGetCasterToken();
  return t?.actor ?? add2eGetGlobal("actor") ?? null;
}

function add2eGetCasterToken() {
  if (typeof token !== "undefined" && token) return token;
  const args0 = (typeof args !== "undefined" && Array.isArray(args)) ? args[0] : null;
  return args0?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eCasterLevel(casterActor) {
  const sys = casterActor?.system ?? {};
  const candidates = [
    sys.niveau,
    sys.level,
    sys.details?.niveau,
    sys.details?.level,
    sys.details_classe?.niveau,
    sys.details_classe?.level
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.floor(n));
  }
  return 1;
}

function add2eGetTargets({ fallbackCaster = true } = {}) {
  const targets = Array.from(game.user?.targets ?? []);
  if (targets.length) return targets;
  const casterToken = add2eGetCasterToken();
  return (fallbackCaster && casterToken) ? [casterToken] : [];
}

function add2eReadSaveVsSpells(targetActor) {
  const sys = targetActor?.system ?? {};
  const candidates = [
    Array.isArray(sys.sauvegardes) ? sys.sauvegardes[4] : null,
    Array.isArray(sys.savingThrows) ? sys.savingThrows[4] : null,
    sys.sauvegarde_sortileges,
    sys.sauvegarde_sorts,
    sys.sauvegardes?.sortileges,
    sys.sauvegardes?.sorts,
    sys.saves?.sorts,
    sys.saves?.spell,
    sys.saves?.spells,
    sys.saves?.magic,
    sys.calculatedSaves?.sorts,
    sys.calculatedSaves?.spell,
    sys.calculatedSaves?.spells,
    sys.jp_sort,
    sys.jp_sorts,
    sys.jp?.sorts,
    sys.jp?.sortileges,
    sys.jet_protection?.sorts,
    sys.jet_protection?.sortileges,
    sys.jetProtection?.sorts
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
}

async function add2eRollSaveVsSpells(targetActor) {
  const saveVal = add2eReadSaveVsSpells(targetActor);
  if (!Number.isFinite(saveVal) || saveVal <= 0) {
    return { canRoll: false, saveVal: NaN, roll: null, total: 0, success: false };
  }
  const roll = await new Roll("1d20").evaluate();
  return {
    canRoll: true,
    saveVal,
    roll,
    total: Number(roll.total) || 0,
    success: (Number(roll.total) || 0) >= saveVal
  };
}

async function add2eAskAgrandissement(level) {
  const pct = Math.min(50, Math.max(10, level * 10));
  return await new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    new Dialog({
      title: "Agrandissement / Retrecissement",
      content: `
        <form>
          <p><b>Agrandissement</b> modifie temporairement la taille de 10% par niveau, jusqu'a 50%.</p>
          <div class="form-group">
            <label>Mode</label>
            <select name="mode">
              <option value="agrandissement">Agrandissement</option>
              <option value="retrecissement">Retrecissement</option>
            </select>
          </div>
          <div class="form-group">
            <label>Variation calculee</label>
            <input type="text" value="${pct}%" disabled />
          </div>
          <div class="form-group">
            <label>Cible consentante</label>
            <input type="checkbox" name="consentante" checked />
          </div>
          <div class="form-group">
            <label>Modificateur toucher applique par le MD</label>
            <input type="number" name="bonusAttaque" value="0" step="1" />
          </div>
          <div class="form-group">
            <label>Modificateur degats applique par le MD</label>
            <input type="number" name="bonusDegats" value="0" step="1" />
          </div>
          <p style="font-size:12px;opacity:.85;">Si la cible n'est pas consentante, un jet de protection contre les sorts annule l'effet.</p>
        </form>`,
      buttons: {
        cast: {
          label: "Lancer le sort",
          callback: html => finish({
            mode: String(html.find("[name='mode']").val() || "agrandissement"),
            consentante: !!html.find("[name='consentante']").prop("checked"),
            bonusAttaque: Number(html.find("[name='bonusAttaque']").val()) || 0,
            bonusDegats: Number(html.find("[name='bonusDegats']").val()) || 0
          })
        },
        cancel: { label: "Annuler", callback: () => finish(null) }
      },
      default: "cast",
      close: () => finish(null)
    }).render(true);
  });
}

function add2eEffectTags({ mode, level, pct, bonusAttaque, bonusDegats }) {
  const isShrink = mode === "retrecissement";
  const tags = [
    `sort:${ADD2E_SORT_SLUG}`,
    "classe:magicien",
    "liste:magicien",
    `niveau:${ADD2E_SORT_LEVEL}`,
    "ecole:alteration",
    "type:taille",
    "reversible:retrecissement",
    isShrink ? "etat:retrecissement" : "etat:agrandissement",
    isShrink ? "taille:reduite" : "taille:agrandie",
    isShrink ? "poids:reduit" : "poids:augmente",
    isShrink ? "force_effective:reduite" : "force_effective:augmentee",
    `variation_taille_pct:${pct}`,
    `duree_rounds:${level * 10}`
  ];

  if (bonusAttaque) {
    tags.push(`bonus_attaque:${bonusAttaque}`);
    tags.push(`bonus:toucher:${bonusAttaque}`);
  }
  if (bonusDegats) {
    tags.push(`bonus_degats:${bonusDegats}`);
    tags.push(`bonus:degats:${bonusDegats}`);
  }
  return tags;
}

function add2eRoundSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.2, Math.round(n * 1000) / 1000);
}

async function add2eApplyTokenScale(targetToken, { mode, pct, effectId }) {
  const doc = targetToken?.document;
  if (!doc) return null;

  const isShrink = mode === "retrecissement";
  const factor = isShrink ? Math.max(0.2, 1 - (pct / 100)) : 1 + (pct / 100);
  const oldWidth = Number(doc.width ?? 1) || 1;
  const oldHeight = Number(doc.height ?? 1) || 1;
  const oldScaleX = Number(doc.texture?.scaleX ?? 1) || 1;
  const oldScaleY = Number(doc.texture?.scaleY ?? 1) || 1;
  const gridSize = Number(canvas?.scene?.grid?.size ?? 0) || 0;
  const newWidth = add2eRoundSize(oldWidth * factor);
  const newHeight = add2eRoundSize(oldHeight * factor);
  const newScaleX = add2eRoundSize(oldScaleX * factor);
  const newScaleY = add2eRoundSize(oldScaleY * factor);
  const updateData = {
    width: newWidth,
    height: newHeight,
    "texture.scaleX": newScaleX,
    "texture.scaleY": newScaleY,
    "flags.add2e.agrandissement": {
      effectId: effectId ?? null,
      mode,
      pct,
      factor,
      previous: {
        width: oldWidth,
        height: oldHeight,
        scaleX: oldScaleX,
        scaleY: oldScaleY,
        x: Number(doc.x ?? 0) || 0,
        y: Number(doc.y ?? 0) || 0
      },
      current: {
        width: newWidth,
        height: newHeight,
        scaleX: newScaleX,
        scaleY: newScaleY
      }
    }
  };

  if (gridSize > 0) {
    updateData.x = Math.round((Number(doc.x ?? 0) || 0) + ((oldWidth - newWidth) * gridSize / 2));
    updateData.y = Math.round((Number(doc.y ?? 0) || 0) + ((oldHeight - newHeight) * gridSize / 2));
  }

  await doc.update(updateData);
  return { factor, oldWidth, oldHeight, oldScaleX, oldScaleY, newWidth, newHeight, newScaleX, newScaleY };
}

async function add2eApplyEffect(targetToken, { mode, level, pct, bonusAttaque, bonusDegats }) {
  const targetActor = targetToken?.actor;
  if (!targetActor) return null;

  const currentItem = add2eGetItem();
  const isShrink = mode === "retrecissement";
  const rounds = Math.max(10, level * 10);
  const name = isShrink ? "Retrecissement" : "Agrandissement";
  const tags = add2eEffectTags({ mode, level, pct, bonusAttaque, bonusDegats });
  const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name,
    img: currentItem?.img || "icons/svg/growth.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {
      rounds,
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    },
    description: `${name} : variation temporaire de taille de ${pct}%. Duree ${rounds} rounds.`,
    flags: { add2e: { tags } }
  }]);

  const tokenScale = await add2eApplyTokenScale(targetToken, { mode, pct, effectId: created?.[0]?.id ?? null });
  return { tags, tokenScale, effectId: created?.[0]?.id ?? null };
}

async function add2eChat(title, html, speakerToken = null, options = {}) {
  const casterToken = speakerToken ?? add2eGetCasterToken();
  const casterActor = add2eGetActor() ?? casterToken?.actor ?? null;
  const currentItem = add2eGetItem();
  const casterName = casterActor?.name ?? casterToken?.name ?? "Magicien";
  const spellName = currentItem?.name ?? title ?? ADD2E_SORT_NAME;
  const casterImg = casterToken?.document?.texture?.src ?? casterActor?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = currentItem?.img ?? "icons/svg/book.svg";
  const targetLabel = options.targetLabel ?? casterName;
  const outcome = options.outcome ?? title ?? spellName;
  const rule = options.rule ?? ADD2E_AGRANDISSEMENT_RULE;

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
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Regle appliquee</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">${add2eHtmlEscape(rule)}</div>
          </details>
        </div>
      </div>`
  });
}

const casterActor = add2eGetActor();
if (!casterActor) {
  ui.notifications?.warn("Agrandissement : aucun lanceur trouve.");
  return false;
}

const level = add2eCasterLevel(casterActor);
const pct = Math.min(50, Math.max(10, level * 10));
const choice = await add2eAskAgrandissement(level);
if (!choice) return false;

const targets = add2eGetTargets({ fallbackCaster: true });
if (!targets.length) {
  ui.notifications?.warn("Agrandissement : aucune cible trouvee.");
  return false;
}

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: casterActor?.name,
  level,
  pct,
  targets: targets.map(t => t.name),
  choice
});

const applied = [];
const resisted = [];
const missingSave = [];
const tokenScaled = [];

for (const target of targets) {
  const targetActor = target?.actor;
  if (!targetActor) continue;

  if (!choice.consentante) {
    const save = await add2eRollSaveVsSpells(targetActor);
    if (save.roll) {
      await save.roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: targetActor, token: target }),
        flavor: `${targetActor.name} — Jet de protection contre les sorts (${ADD2E_SORT_NAME})`
      });
    }

    if (!save.canRoll) {
      missingSave.push(target.name);
      continue;
    }

    if (save.success) {
      resisted.push(`${target.name} (${save.total}/${save.saveVal})`);
      continue;
    }
  }

  const result = await add2eApplyEffect(target, {
    mode: choice.mode,
    level,
    pct,
    bonusAttaque: choice.bonusAttaque,
    bonusDegats: choice.bonusDegats
  });
  applied.push(target.name);
  if (result?.tokenScale) tokenScaled.push(`${target.name} x${Math.round(result.tokenScale.factor * 100) / 100}`);
}

const modeLabel = choice.mode === "retrecissement" ? "Retrecissement" : "Agrandissement";
const bonusLines = [];
if (choice.bonusAttaque) bonusLines.push(`Toucher : ${choice.bonusAttaque >= 0 ? "+" : ""}${choice.bonusAttaque}`);
if (choice.bonusDegats) bonusLines.push(`Degats : ${choice.bonusDegats >= 0 ? "+" : ""}${choice.bonusDegats}`);

await add2eChat(modeLabel, `
  <p><b>${add2eHtmlEscape(modeLabel)}</b> : variation temporaire de <b>${pct}%</b>.</p>
  <p>Duree : <b>${level * 10} rounds</b> (${level} tour(s)).</p>
  ${applied.length ? `<p>Effet applique : <b>${applied.map(add2eHtmlEscape).join(", ")}</b></p>` : ""}
  ${tokenScaled.length ? `<p>Token redimensionne : <b>${tokenScaled.map(add2eHtmlEscape).join(", ")}</b></p>` : ""}
  ${resisted.length ? `<p>Jet de protection reussi, effet annule : <b>${resisted.map(add2eHtmlEscape).join(", ")}</b></p>` : ""}
  ${missingSave.length ? `<p>Jet de protection introuvable, effet non applique : <b>${missingSave.map(add2eHtmlEscape).join(", ")}</b></p>` : ""}
  ${bonusLines.length ? `<p>Modificateurs MD : <b>${bonusLines.map(add2eHtmlEscape).join(" ; ")}</b></p>` : ""}
`, null, {
  outcome: applied.length ? "EFFET ACTIF" : "EFFET ANNULE",
  targetLabel: targets.map(t => t.name).join(", "),
  rule: ADD2E_AGRANDISSEMENT_RULE
});

return true;
