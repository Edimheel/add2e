// ADD2E — Pilier de feu
// Compatible Foundry V13/V14/V15.
// Le comportement actuel est conservé : jet indicatif 6d8, sans mutation automatique des PV.

const ADD2E_PILIER_DE_FEU_VERSION = "2026-08-09-canonical-damage-roll-card-v4";
const ADD2E_PILIER_DE_FEU_CONFIG = Object.freeze({
  name: "Pilier de feu",
  slug: "pilier_de_feu",
  level: 5,
  formula: "6d8",
  description: "Pilier de feu inflige un effet offensif divin. Les dégâts, les jets de protection éventuels, les résistances et les effets secondaires sont résolus selon les règles du sort, la cible, la portée, les obstacles et l’arbitrage du MD."
});

globalThis.ADD2E_PILIER_DE_FEU_VERSION = ADD2E_PILIER_DE_FEU_VERSION;

function add2ePilierDeFeuEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2ePilierDeFeuCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

async function add2ePilierDeFeuChat(caster, casterToken, roll) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const targets = Array.from(game.user?.targets ?? []);
  const targetLabel = targets.length ? targets.map(target => target.name).join(", ") : "Aucune cible sélectionnée";
  const safeDescription = add2ePilierDeFeuEscape(ADD2E_PILIER_DE_FEU_CONFIG.description);
  const options = {
    actor: caster,
    title: ADD2E_PILIER_DE_FEU_CONFIG.name,
    icon: "fas fa-fire-flame-curved",
    variant: "failure",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible(s)", value: targetLabel },
      { label: "Jet indicatif", value: `${ADD2E_PILIER_DE_FEU_CONFIG.formula} → ${Number(roll.total) || 0}` },
      { label: "Résultat", value: "EFFET OFFENSIF" }
    ],
    trustedBodyHtml: `<p>Jet indicatif : <b>${Number(roll.total) || 0}</b> (${ADD2E_PILIER_DE_FEU_CONFIG.formula}).</p>${targets.length ? "" : "<p>Aucune cible sélectionnée : appliquer manuellement si nécessaire.</p>"}<details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${safeDescription}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: [roll],
      flags: { add2e: { spell: ADD2E_PILIER_DE_FEU_CONFIG.slug, version: ADD2E_PILIER_DE_FEU_VERSION } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Pilier de feu : lanceur introuvable.");
  return false;
}

const roll = await new Roll(ADD2E_PILIER_DE_FEU_CONFIG.formula).evaluate();
await add2ePilierDeFeuChat(caster, add2ePilierDeFeuCasterToken(), roll);
return true;
