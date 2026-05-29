// scripts/add2e-attack/04i-attack-roll-chat-card.mjs
// ADD2E — Rendu du message de combat.
// Version : 2026-05-29-attack-chat-mj-player-split-v1

function esc(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function signed(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? "+" : ""}${n}`;
}

function chip(label, value, color = "#5d3d0d") {
  return [
    `<div style="border:1px solid #d8c489;background:#fff9e8;border-radius:8px;padding:6px 8px;min-width:0;">`,
    `<div style="font-size:.68rem;font-weight:900;text-transform:uppercase;color:#6f5520;letter-spacing:.03em;line-height:1;">${esc(label)}</div>`,
    `<div style="font-size:.98rem;font-weight:900;color:${color};margin-top:3px;line-height:1.15;">${value || "—"}</div>`,
    `</div>`
  ].join("");
}

function add2eAttackOutcome(ctx) {
  if (Number(ctx.d20) === 20) {
    return {
      key: "natural20",
      hit: true,
      title: "Coup exceptionnel !",
      publicTitle: "Coup exceptionnel !",
      icon: "fa-star",
      color: "#b7791f",
      bg: "#fff7d6"
    };
  }
  if (Number(ctx.d20) === 1) {
    return {
      key: "natural1",
      hit: false,
      title: "Échec critique !",
      publicTitle: "Échec critique !",
      icon: "fa-skull-crossbones",
      color: "#9f1239",
      bg: "#fff1f2"
    };
  }
  const hit = !!ctx.finalResult;
  return {
    key: hit ? "hit" : "miss",
    hit,
    title: hit ? "TOUCHÉ !" : "Raté.",
    publicTitle: hit ? "Touché !" : "Raté.",
    icon: hit ? "fa-check" : "fa-times",
    color: hit ? "#27ae60" : "#b7473f",
    bg: hit ? "#eefaf2" : "#fff1f0"
  };
}

function pickRandom(list) {
  if (!Array.isArray(list) || !list.length) return "";
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

function add2eAttackRoleplayPhrase(ctx) {
  const attacker = esc(ctx.actor?.name ?? "L’assaillant");
  const target = esc(ctx.nomCible ?? ctx.cible?.name ?? "la cible");
  const weapon = esc(ctx.arme?.name ?? "son arme");
  const outcome = add2eAttackOutcome(ctx);

  if (outcome.key === "natural20") return pickRandom([
    `${attacker} trouve une ouverture parfaite : ${weapon} frappe avec une précision remarquable.` ,
    `Le geste de ${attacker} est net, presque trop rapide à suivre. ${target} encaisse un coup d’exception.`,
    `La fortune sourit à ${attacker} : l’attaque passe au moment exact où la défense cède.`,
    `${attacker} transforme son attaque en coup magistral. ${target} est pris de court.`
  ]);

  if (outcome.key === "natural1") return pickRandom([
    `${attacker} se précipite et son attaque tourne court dans un déséquilibre dangereux.`,
    `Le coup part mal : ${weapon} manque sa trajectoire et laisse ${attacker} exposé.`,
    `Un faux mouvement ruine l’assaut de ${attacker}. ${target} échappe à l’attaque sans effort.`,
    `${attacker} tente une manœuvre trop ambitieuse ; l’attaque se transforme en échec critique.`
  ]);

  if (outcome.hit) return pickRandom([
    `${attacker} force la garde de ${target} et place son attaque.`,
    `${weapon} trouve son chemin malgré la défense de ${target}.`,
    `${attacker} ajuste son geste et touche ${target}.`,
    `L’attaque de ${attacker} passe : ${target} subit le choc.`
  ]);

  return pickRandom([
    `${target} évite l’attaque de justesse.`,
    `${attacker} frappe, mais ${target} parvient à détourner le danger.`,
    `${weapon} fend l’air sans trouver sa cible.`,
    `${target} tient bon : l’attaque ne passe pas.`
  ]);
}

export function add2eBuildAttackPlayerChatCard(ctx) {
  const outcome = add2eAttackOutcome(ctx);
  const roleplay = add2eAttackRoleplayPhrase(ctx);
  const hit = !!ctx.finalResult;
  const showDamage = hit && Number(ctx.degats) > 0;

  return [
    `<div class="add2e-chat-card add2e-attack-chat-card-player-v1" style="font-family:var(--font-primary);border:1px solid #b58b3a;border-radius:12px;background:linear-gradient(180deg,#fffaf0 0%,#f3e4bf 100%);box-shadow:0 2px 9px rgba(66,39,8,.22);overflow:hidden;color:#2c2212;">`,
    `<div style="display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#3d2307,#8b5e20);color:#fff;padding:8px 10px;border-bottom:2px solid #d7b45a;">`,
    `<i class="fas ${outcome.icon}" style="font-size:1.22rem;color:#ffd978;"></i>`,
    `<div style="min-width:0;flex:1;"><div style="font-size:1.04rem;font-weight:950;line-height:1.1;">Attaque</div><div style="font-size:.78rem;font-weight:750;color:#f7e3b1;line-height:1.18;margin-top:2px;">${esc(ctx.actor?.name)} attaque ${esc(ctx.nomCible)} avec ${esc(ctx.arme?.name)}</div></div>`,
    `<div style="white-space:nowrap;border:1px solid rgba(255,255,255,.45);background:${outcome.color};color:#fff;border-radius:999px;padding:4px 9px;font-weight:950;font-size:.86rem;">${esc(outcome.publicTitle)}</div>`,
    `</div>`,
    `<div style="padding:10px;">`,
    `<div style="display:grid;grid-template-columns:minmax(0,1fr) 32px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:9px;">`,
    `<div style="text-align:center;border:1px solid #d7c28a;background:#fffdf5;border-radius:9px;padding:7px;"><img src="${esc(ctx.actor?.img || ctx.chatImg || "icons/svg/mystery-man.svg")}" style="width:44px;height:44px;object-fit:cover;border:1px solid #6d4b18;border-radius:7px;background:#fff;"><div style="font-weight:950;margin-top:3px;line-height:1.1;">${esc(ctx.actor?.name)}</div><div style="font-size:.78rem;color:#6f5520;font-weight:850;margin-top:2px;">${esc(ctx.arme?.name)}</div></div>`,
    `<div style="text-align:center;font-size:1.5rem;color:#8b5e20;font-weight:950;">→</div>`,
    `<div style="text-align:center;border:1px solid #d7c28a;background:#fffdf5;border-radius:9px;padding:7px;"><img src="${esc(ctx.cible?.img || "icons/svg/mystery-man.svg")}" style="width:44px;height:44px;object-fit:cover;border:1px solid #6d4b18;border-radius:7px;background:#fff;"><div style="font-weight:950;margin-top:3px;line-height:1.1;">${esc(ctx.nomCible)}</div></div>`,
    `</div>`,
    `<div style="border:1px solid ${outcome.color};background:${outcome.bg};border-radius:10px;padding:9px 10px;margin-bottom:8px;">`,
    `<div style="font-weight:950;color:${outcome.color};font-size:1rem;margin-bottom:4px;"><i class="fas ${outcome.icon}"></i> ${esc(outcome.publicTitle)}</div>`,
    `<div style="font-size:.94rem;line-height:1.45;">${roleplay}</div>`,
    `</div>`,
    showDamage ? `<div style="border:1px solid #c8a557;background:#fff6df;border-radius:9px;padding:8px;text-align:center;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Dégâts infligés</div><div style="font-size:1.25rem;font-weight:950;color:#7a2e17;margin-top:2px;">${esc(ctx.degats)}</div></div>` : "",
    `</div></div>`
  ].filter(Boolean).join("");
}

export function add2eBuildAttackChatCard(ctx) {
  const outcome = add2eAttackOutcome(ctx);
  const hit = !!ctx.finalResult;
  const statusColor = outcome.color;
  const statusText = outcome.title;
  const statusIcon = outcome.icon;
  const positionDetails = ctx.activePositionAttackAdjustment?.details ?? [];
  const calculSimple = `<b>${ctx.d20}</b> <span style="color:#6d654f;font-size:0.8em;">(d20)</span> ${signed(ctx.totalBonusToucher)} = <b style="font-size:1.1em;">${ctx.totalAuToucher}</b>`;
  const naturalLine = outcome.key === "natural20"
    ? `<div style="color:#b7791f;"><b>20 naturel :</b> coup exceptionnel, réussite automatique.</div>`
    : outcome.key === "natural1"
      ? `<div style="color:#9f1239;"><b>1 naturel :</b> échec critique, échec automatique.</div>`
      : "";

  const touchLines = [
    naturalLine,
    `<div><b>Base THAC0 :</b> ${ctx.thaco}</div>`,
    `<div><b>Classe d’armure cible :</b> ${ctx.caFinaleCible}${ctx.activePositionAttackAdjustment?.caAdjustment ? ` <span style="color:#7a4b00;">(position : ${ctx.caAvantPosition} → ${ctx.caAvantConditionnelle})</span>` : ""}</div>`,
    ctx.conditionalACLine || "",
    positionDetails.length ? `<div><b>Position :</b> ${positionDetails.join(" ; ")}</div>` : "",
    `<div><b>Seuil sans modificateur :</b> ${ctx.valeurPourToucher}</div>`,
    `<hr style="border:0;border-top:1px solid #e0d3ad;margin:6px 0;">`,
    `<div><b>Modificateur ${esc(ctx.modCaracToucherLabel)} :</b> ${signed(ctx.modCaracToucher)}</div>`,
    `<div><b>Modificateur magique arme :</b> ${signed(ctx.bonusHit)}</div>`,
    `<div><b>Modificateur effets actifs :</b> ${signed(ctx.bonusToucheEffets)}</div>`,
    `<div><b>Modificateur portée :</b> ${signed(ctx.malusPortee)} (${esc(ctx.descPortee)})</div>`,
    `<div><b>Modificateur temporaire :</b> ${signed(ctx.userBonus)}</div>`,
    ctx.useBackstab ? `<div><b>Attaque sournoise :</b> +4 toucher, dégâts ×${ctx.backstabMultiplier}</div>` : "",
    ctx.useAssassination ? `<div><b>Assassinat :</b> ${ctx.assassinationInfo?.score ?? 0}%${ctx.assassinatMod ? ` (${signed(ctx.assassinatMod)} situation)` : ""}</div>` : "",
    `<div><b>Modificateur armure / arme :</b> ${signed(ctx.ajustementCA)}</div>`,
    `<hr style="border:0;border-top:1px solid #e0d3ad;margin:6px 0;">`,
    `<div style="font-size:1.08em;"><b>Total modificateur :</b><span style="font-weight:bold;color:#2563eb;"> ${signed(ctx.totalBonusToucher)}</span></div>`,
    `<div style="font-size:1.08em;"><b>Seuil final au d20 :</b><span style="font-weight:bold;color:#15803d;"> ${ctx.seuilFinalD20}</span></div>`
  ].filter(Boolean).join("");

  const damageLines = hit
    ? [
        `<div><b>Dégâts :</b> ${esc(ctx.degats)}</div>`,
        `<div><b>Calcul :</b> ${esc(ctx.formulaDegats)} → ${esc(ctx.detailsDegats)}</div>`,
        ctx.useBackstab ? `<div><b>Attaque sournoise :</b> dégâts ×${ctx.backstabMultiplier}</div>` : ""
      ].filter(Boolean).join("")
    : `<div>Aucun dommage : l’attaque ne touche pas.</div>`;

  const assassination = ctx.assassinatResult ? [
    `<div style="border:1px solid ${ctx.assassinatResult.success ? "#1f8f4d" : "#b3261e"};background:${ctx.assassinatResult.success ? "#eefaf2" : "#fff1f0"};border-radius:8px;padding:7px;margin-bottom:10px;text-align:center;">`,
    `<div style="font-weight:900;color:${ctx.assassinatResult.success ? "#1f8f4d" : "#b3261e"};">Assassinat ${ctx.assassinatResult.success ? "réussi" : "échoué"}</div>`,
    `<div style="font-size:.92em;">Jet : <b>${ctx.assassinatResult.total}</b> / Score : <b>${ctx.assassinatResult.finalScore}%</b></div>`,
    `<div style="font-size:.82em;color:#666;">${esc(ctx.assassinationInfo?.breakdownTitle ?? "")}</div>`,
    `</div>`
  ].join("") : "";

  return [
    `<div class="add2e-chat-card add2e-attack-chat-card-v2" style="font-family:var(--font-primary);border:1px solid #b58b3a;border-radius:12px;background:linear-gradient(180deg,#fffaf0 0%,#f3e4bf 100%);box-shadow:0 2px 9px rgba(66,39,8,.22);overflow:hidden;color:#2c2212;">`,
    `<div style="display:flex;align-items:center;gap:8px;background:linear-gradient(90deg,#3d2307,#8b5e20);color:#fff;padding:8px 10px;border-bottom:2px solid #d7b45a;">`,
    `<i class="fas ${statusIcon}" style="font-size:1.22rem;color:#ffd978;"></i>`,
    `<div style="min-width:0;flex:1;"><div style="font-size:1.04rem;font-weight:950;line-height:1.1;">Attaque — MJ</div><div style="font-size:.78rem;font-weight:750;color:#f7e3b1;line-height:1.18;margin-top:2px;">${esc(ctx.actor?.name)} attaque ${esc(ctx.nomCible)} avec ${esc(ctx.arme?.name)}</div></div>`,
    `<div style="white-space:nowrap;border:1px solid rgba(255,255,255,.45);background:${statusColor};color:#fff;border-radius:999px;padding:4px 9px;font-weight:950;font-size:.86rem;">${esc(statusText)}</div>`,
    `</div>`,
    `<div style="padding:10px;">`,
    `<div style="display:grid;grid-template-columns:minmax(0,1fr) 32px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:9px;">`,
    `<div style="text-align:center;border:1px solid #d7c28a;background:#fffdf5;border-radius:9px;padding:7px;"><img src="${esc(ctx.actor?.img || ctx.chatImg || "icons/svg/mystery-man.svg")}" style="width:44px;height:44px;object-fit:cover;border:1px solid #6d4b18;border-radius:7px;background:#fff;"><div style="font-weight:950;margin-top:3px;line-height:1.1;">${esc(ctx.actor?.name)}</div><div style="font-size:.78rem;color:#6f5520;font-weight:850;margin-top:2px;">${esc(ctx.arme?.name)}</div></div>`,
    `<div style="text-align:center;font-size:1.5rem;color:#8b5e20;font-weight:950;">→</div>`,
    `<div style="text-align:center;border:1px solid #d7c28a;background:#fffdf5;border-radius:9px;padding:7px;"><img src="${esc(ctx.cible?.img || "icons/svg/mystery-man.svg")}" style="width:44px;height:44px;object-fit:cover;border:1px solid #6d4b18;border-radius:7px;background:#fff;"><div style="font-weight:950;margin-top:3px;line-height:1.1;">${esc(ctx.nomCible)}</div></div>`,
    `</div>`,
    `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px;">${chip("Portée", `${esc(ctx.descPortee || "—")} <span style=\"font-size:.78rem;color:#7b6a40;\">${esc(ctx.typePortee || "")}</span>`)}${chip("Seuil", esc(ctx.seuilFinalD20), "#c06000")}${chip("Issue", esc(statusText), statusColor)}</div>`,
    `<div style="border:1px solid #d7c28a;background:#f7f0df;border-radius:9px;padding:8px;text-align:center;margin-bottom:8px;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Jet d’attaque</div><div style="font-size:1.1rem;font-weight:950;margin-top:2px;"><i class="fas fa-dice-d20"></i> ${calculSimple}</div></div>`,
    hit ? `<div style="border:1px solid #c8a557;background:#fff6df;border-radius:9px;padding:8px;text-align:center;margin-bottom:8px;"><div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#6f5520;">Dégâts infligés</div><div style="font-size:1.25rem;font-weight:950;color:#7a2e17;margin-top:2px;">${esc(ctx.degats)}</div><div style="font-size:.78rem;color:#71624b;font-weight:850;">${esc(ctx.formulaDegats)} → ${esc(ctx.detailsDegats)}</div></div>` : "",
    assassination,
    `<details style="margin-top:8px;border:1px solid #c6a85b;border-radius:9px;background:#fffdf6;overflow:hidden;"><summary style="cursor:pointer;background:#ead7a4;color:#3f2d0e;padding:7px 9px;font-weight:950;"><i class="fas fa-list-check"></i> Détails du jet</summary><div style="padding:8px;display:grid;gap:7px;">`,
    `<details style="border:1px solid #d9c894;border-radius:8px;background:#fff;overflow:hidden;"><summary style="cursor:pointer;padding:6px 8px;background:#f4ead1;font-weight:950;color:#5a3c11;"><i class="fas fa-bullseye"></i> Toucher</summary><div style="padding:8px;line-height:1.55;color:#2f2a20;">${touchLines}</div></details>`,
    `<details style="border:1px solid #d9c894;border-radius:8px;background:#fff;overflow:hidden;"><summary style="cursor:pointer;padding:6px 8px;background:#f4ead1;font-weight:950;color:#5a3c11;"><i class="fas fa-burst"></i> Dommages</summary><div style="padding:8px;line-height:1.55;color:#2f2a20;">${damageLines}</div></details>`,
    `</div></details>`,
    `</div></div>`
  ].filter(Boolean).join("");
}
