/** ADD2E — Silence sur 5 mètres — Clerc niveau 2 — DialogV2 + VFX — V13/V14/V15 */
const __add2eOnUseResult = await (async () => {
  const SPELL = {"id":"silence","name":"Silence sur 5 mètres","fx":"silence","color":"#b6c9dd","min":0,"max":1};
  const RULES = ["Durée : 2 rounds par niveau ; sphère de 9 m de diamètre.","La zone peut être fixée dans l’air, sur un objet ou sur une créature.","Une créature non consentante sauvegarde ; en cas de réussite, la zone apparaît derrière elle et ne la suit pas.","Aucun blocage technique des composantes verbales n’est inventé."];
  const escape = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const sourceItem = (typeof item !== "undefined" && item) || (typeof sort !== "undefined" && sort) || null;
  const casterToken = canvas.tokens?.controlled?.[0] ?? ((typeof token !== "undefined" && token) ? token : null);
  const caster = casterToken?.actor ?? ((typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent);
  if (!casterToken || !caster || !sourceItem) { ui.notifications?.error?.(SPELL.name + " : sélectionne le token du lanceur et relance le sort."); return false; }
  const targets = Array.from(game.user?.targets ?? []);
  if (targets.length < SPELL.min || targets.length > SPELL.max) { ui.notifications?.warn?.(SPELL.name + " : sélectionne entre " + SPELL.min + " et " + SPELL.max + " cible(s)."); return false; }
  const level = Number(caster.system?.details?.level?.value ?? caster.system?.niveau ?? caster.system?.level ?? caster.system?.details?.niveau ?? 1) || 1;
  const details = [];
  details.push(`Durée : <b>${2 * level} rounds</b> ; zone : <b>sphère de 9 m de diamètre</b>.`);
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) { ui.notifications?.error?.(SPELL.name + " : DialogV2 est requis."); return false; }
  const targetNames = targets.length ? targets.map(t => escape(t.name)).join(", ") : "zone / lanceur";
  const rulesHtml = RULES.map(rule => "<li>" + escape(rule) + "</li>").join("");
  const result = await DialogV2.wait({
    window: { title: "Lancement : " + SPELL.name },
    content: `<form style="display:flex;flex-direction:column;gap:8px"><p><b>Cible(s) / zone :</b> ${targetNames}</p><ul>${rulesHtml}</ul><p>${details.join("<br>")}</p><div class="form-group"><label>Note MJ / scène (facultatif)</label><textarea name="note" rows="2"></textarea></div></form>`,
    buttons: [
      { action: "cast", label: "Confirmer le lancement", icon: "fa-solid fa-wand-magic-sparkles", default: true, callback: (event, button) => ({ note: String(button.form.elements.note?.value ?? "") }) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!result) return false;
  const fxTargets = targets.length ? targets : [casterToken];
  if (globalThis.ADD2E_PLAY_SPELL_FX) {
    await globalThis.ADD2E_PLAY_SPELL_FX(SPELL.fx, { casterToken, targetTokens: fxTargets, launchOptions: { text: SPELL.name.toUpperCase(), color: SPELL.color, duration: 900, durationText: 1200 }, targetOptions: { text: "✦", color: SPELL.color, duration: 800, durationText: 1000 } });
  } else {
    for (const targetToken of fxTargets) await canvas.interface?.createScrollingText?.(targetToken.center, SPELL.name, { anchor: CONST.TEXT_ANCHOR_POINTS?.CENTER ?? 0, direction: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1, duration: 1400, distance: 80, fontSize: 28, fill: SPELL.color, stroke: 0x000000, strokeThickness: 4 });
  }
  const note = result.note ? `<p><b>Note :</b> ${escape(result.note)}</p>` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken.document }),
    content: `<div class="add2e-chat-card add2e-clerc-sort" style="border:1px solid #c79222;border-radius:8px;background:#fff8e6;color:#5a3b12;padding:10px"><h3 style="margin:0 0 6px">${escape(SPELL.name)}</h3><p><b>Cible(s) / zone :</b> ${targetNames}</p><ul>${rulesHtml}</ul><p>${details.join("<br>")}</p>${note}<p><i>Résolution finale laissée au MJ lorsqu’aucun mécanisme système fiable n’est confirmé.</i></p></div>`,
    ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
  });
  return true;
})();
if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) { console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT]", { script: "silence-rayon-de-15-pieds.js", result: __add2eOnUseResult }); return false; }
return __add2eOnUseResult;
