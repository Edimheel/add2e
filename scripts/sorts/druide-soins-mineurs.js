// ADD2E — onUse Druide niveau 2 : Soins mineurs
// Version : 2026-07-27-druide-soins-mineurs-common-card-v2
// Compatible Foundry V13/V14/V15.
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

return await (async () => {
  const CONFIG = {
    name: "Soins mineurs",
    level: 2,
    classe: "Druide",
    dice: "1d8",
    description: "Soins mineurs restaure la vitalité d’une créature vivante. Le soin ne dépasse pas le maximum normal de points de vie, sauf règle contraire. Le sort n’affecte normalement pas les morts-vivants ni les créatures incapables de recevoir des soins vitaux."
  };

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const spell = typeof sourceItem !== "undefined" && sourceItem
    ? sourceItem
    : typeof sort !== "undefined" && sort
      ? sort
      : typeof item !== "undefined" && item
        ? item
        : null;
  const caster = typeof actor !== "undefined" && actor ? actor : spell?.parent ?? null;

  if (!spell || !caster) {
    ui.notifications.error(`${CONFIG.name} : sort ou lanceur introuvable.`);
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (!targets.length) {
    ui.notifications.warn(`${CONFIG.name} : cible obligatoire.`);
    return false;
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;
  const roll = await new Roll(CONFIG.dice).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const amount = Number(roll.total) || 0;
  const maxHP = Number(
    targetActor.system?.points_de_coup
    ?? targetActor.system?.pv_max
    ?? targetActor.system?.hp?.max
    ?? 0
  ) || 0;
  const currentHP = Number(
    targetActor.system?.pdv
    ?? targetActor.system?.pv
    ?? targetActor.system?.hp?.value
    ?? 0
  ) || 0;
  const nextHP = maxHP ? Math.min(maxHP, currentHP + amount) : currentHP + amount;
  const healed = Math.max(0, nextHP - currentHP);

  await targetActor.update({ "system.pdv": nextHP });

  const buildCard = globalThis.add2eBuildChatCard;
  const createCard = globalThis.add2eCreateChatCard;
  if (typeof buildCard !== "function" || typeof createCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? (canvas?.tokens?.controlled ?? []).find(controlled => controlled?.actor?.id === caster.id || controlled?.document?.actorId === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const cardOptions = {
    actor: caster,
    title: spell.name ?? CONFIG.name,
    icon: "fas fa-leaf",
    variant: "success",
    source: {
      name: caster.name,
      img: caster.img,
      type: "Sort druidique"
    },
    rows: [
      { label: "Cible", value: targetActor.name },
      { label: "Jet", value: `${CONFIG.dice} = ${amount}` },
      { label: "PV rendus", value: healed },
      { label: "Points de vie", value: `${currentHP} → ${nextHP}${maxHP ? ` / ${maxHP}` : ""}` }
    ],
    trustedBodyHtml: `<details><summary>Règle appliquée</summary><div style="padding-top:6px;">${escapeHtml(CONFIG.description)}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken })
    }
  };

  buildCard(cardOptions);
  await createCard(cardOptions);
  return true;
})();
