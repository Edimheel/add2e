// ADD2E — Soin ultime / Blessures critiques
// Compatible Foundry V13/V14/V15.
// Une seule responsabilité : résoudre le sort puis déléguer PV, fenêtre et chat aux API communes.

const ADD2E_SOIN_ULTIME_VERSION = "2026-08-09-canonical-hp-dialog-chat-v3";
const ADD2E_SOIN_ULTIME_FORMULA = "3d8+3";

globalThis.ADD2E_SOIN_ULTIME_VERSION = ADD2E_SOIN_ULTIME_VERSION;

function add2eSoinUltimeCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eSoinUltimeHitPointEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (
    !engine
    || typeof engine.applyHitPointDamage !== "function"
    || typeof engine.applyHitPointHealing !== "function"
  ) {
    throw new Error("Le propriétaire canonique ADD2E des points de vie est indisponible.");
  }
  return engine;
}

async function add2eSoinUltimeChooseMode() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }

  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "heal",
    add2eClasses: ["add2e-soin-ultime-dialog"],
    window: { title: item?.name ?? "Soin ultime" },
    content: `
      <form class="add2e-soin-ultime-form">
        <p>Choisissez la forme du sort.</p>
      </form>
    `,
    buttons: [
      {
        action: "heal",
        label: "Soin ultime",
        icon: "<i class='fas fa-hand-holding-medical'></i>",
        default: true,
        callback: () => "heal"
      },
      {
        action: "damage",
        label: "Blessures critiques",
        icon: "<i class='fas fa-hand-fist'></i>",
        callback: () => "damage"
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
}

async function add2eSoinUltimeChat({ caster, casterToken, target, mode, roll, effective }) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const healing = mode === "heal";
  const title = healing ? "Soin ultime" : "Blessures critiques";
  const options = {
    actor: caster,
    title,
    icon: healing ? "fas fa-hand-holding-medical" : "fas fa-hand-fist",
    variant: healing ? "success" : "failure",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible", value: target.name },
      { label: "Jet", value: `${ADD2E_SOIN_ULTIME_FORMULA} → ${Number(roll.total) || 0}` },
      { label: healing ? "PV rendus" : "PV perdus", value: String(effective) }
    ],
    trustedBodyHtml: `<p>${healing ? "La cible récupère" : "La cible subit"} <b>${effective}</b> point(s) de vie.</p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: [roll],
      flags: {
        add2e: {
          spell: "soin-ultime",
          mode,
          version: ADD2E_SOIN_ULTIME_VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Soin ultime : lanceur introuvable.");
  return false;
}

const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
if (targets.length !== 1) {
  ui.notifications.warn("Soin ultime : cible unique obligatoire.");
  return false;
}

const mode = await add2eSoinUltimeChooseMode();
if (!mode) {
  ui.notifications.info("Soin ultime annulé.");
  return false;
}

const targetToken = targets[0];
const targetActor = targetToken.actor;
const casterToken = add2eSoinUltimeCasterToken();
const roll = await new Roll(ADD2E_SOIN_ULTIME_FORMULA).evaluate();
const amount = Math.max(0, Number(roll.total) || 0);
const engine = add2eSoinUltimeHitPointEngine();
const mutation = mode === "damage"
  ? await engine.applyHitPointDamage(targetActor, amount, { reason: "blessures-critiques" })
  : await engine.applyHitPointHealing(targetActor, amount, { reason: "soin-ultime" });
const effective = Math.max(0, Number(mutation?.effective) || 0);

await add2eSoinUltimeChat({
  caster,
  casterToken,
  target: targetActor,
  mode,
  roll,
  effective
});

return true;
