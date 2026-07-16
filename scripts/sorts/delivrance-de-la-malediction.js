// ADD2E — OnUse Clerc niveau 3 : Délivrance de la Malédiction
// Compatible Foundry V13/V14/V15.
// DialogV2 uniquement.
// Retour attendu : true = sort consommé, false = sort non consommé.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][DELIVRANCE_MALEDICTION]";

function add2eEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eTargetActors() {
  const targets = Array.from(game.user?.targets ?? []).map(target => target?.actor).filter(Boolean);
  const casterActor = actor ?? add2eCasterToken()?.actor ?? args?.[0]?.actor ?? null;
  return targets.length ? targets : (casterActor ? [casterActor] : []);
}

async function add2ePostChat({ title, outcome, targetLabel, detail }) {
  const casterToken = add2eCasterToken();
  const casterActor = actor ?? casterToken?.actor ?? args?.[0]?.actor ?? null;
  const sourceItem = item ?? args?.[0]?.item ?? args?.[0]?.sourceItem ?? null;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-clerc-sort" style="border:1px solid #c79222;border-radius:8px;overflow:hidden;background:#fff8e6;color:#5a3b12;">
        <div style="display:flex;align-items:center;gap:8px;background:#9f6b0a;color:#fff;padding:7px 9px;">
          <img src="${add2eEscapeHtml(sourceItem?.img ?? "icons/svg/holy-shield.svg")}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #f0d391;background:#fff;">
          <div style="flex:1;font-weight:900;">${add2eEscapeHtml(title)}</div>
          <div style="font-size:12px;font-weight:800;">Sort divin</div>
        </div>
        <div style="padding:9px 10px;">
          <p><b>Cible :</b> ${add2eEscapeHtml(targetLabel)}</p>
          <div style="border:1px solid #e0ae37;border-radius:6px;background:#fffdf5;padding:8px;text-align:center;">
            <div style="color:#1c9b4b;font-weight:900;text-transform:uppercase;">${add2eEscapeHtml(outcome)}</div>
            <div>${detail}</div>
          </div>
        </div>
      </div>`
  });
}

async function add2eChooseMode() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible.");
  return DialogV2.wait({
    window: { title: "Délivrance de la Malédiction" },
    modal: true,
    content: `<div class="add2e-dialog"><p>Choisissez la forme du sort.</p></div>`,
    buttons: [
      { action: "normal", label: "Désenvoûtement", icon: "fa-solid fa-shield-halved", default: true, callback: () => "normal" },
      { action: "inverse", label: "Malédiction", icon: "fa-solid fa-skull", callback: () => "inverse" },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    close: () => null
  });
}

async function add2eChooseCursedItem(entries) {
  if (entries.length === 1) return entries[0];
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible.");
  const options = entries.map((entry, index) =>
    `<option value="${index}">${add2eEscapeHtml(entry.actor.name)} — ${add2eEscapeHtml(entry.item.name)}</option>`
  ).join("");
  const result = await DialogV2.wait({
    window: { title: "Objet maudit à désenvoûter" },
    modal: true,
    content: `<form class="add2e-dialog"><div class="form-group"><label>Objet maudit</label><select name="cursedItem">${options}</select></div></form>`,
    buttons: [
      {
        action: "remove",
        label: "Désenvoûter",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button) => Number(button.form?.elements?.cursedItem?.value ?? 0)
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    close: () => null
  });
  return result === null || result === undefined ? null : entries[result] ?? null;
}

async function add2eApplyInverseCurse(targetActors) {
  for (const targetActor of targetActors) {
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Malédiction",
      img: item?.img ?? "icons/svg/skull.svg",
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: { startTime: game.time?.worldTime ?? null },
      description: "Malédiction appliquée par la forme inverse de Délivrance de la Malédiction. Les détails sont fixés par le MD.",
      flags: {
        add2e: {
          tags: ["etat:malediction", "reversible:malediction"],
          effectTags: ["etat:malediction", "reversible:malediction"],
          rules: []
        }
      }
    }]);
  }
  await add2ePostChat({
    title: "Malédiction",
    outcome: "MALÉDICTION APPLIQUÉE",
    targetLabel: targetActors.map(target => target.name).join(", "),
    detail: "<p>La malédiction est active. Ses effets précis sont déterminés par le MD.</p>"
  });
  return true;
}

try {
  const targetActors = add2eTargetActors();
  if (!targetActors.length) {
    ui.notifications?.warn?.("Délivrance de la Malédiction : aucune cible disponible.");
    return false;
  }

  const mode = await add2eChooseMode();
  if (!mode) return false;
  if (mode === "inverse") return await add2eApplyInverseCurse(targetActors);

  const isCursed = globalThis.add2eIsCursedItem;
  const removeCursed = globalThis.add2eDeleteCursedItemByDisenchantment;
  if (typeof isCursed !== "function" || typeof removeCursed !== "function") {
    throw new Error("Le contrôleur générique des objets maudits n’est pas chargé.");
  }

  const entries = targetActors.flatMap(targetActor =>
    Array.from(targetActor.items ?? [])
      .filter(ownedItem => isCursed(ownedItem))
      .map(ownedItem => ({ actor: targetActor, item: ownedItem }))
  );

  if (!entries.length) {
    ui.notifications?.info?.("Aucun objet maudit n’a été trouvé sur la cible.");
    await add2ePostChat({
      title: "Délivrance de la Malédiction",
      outcome: "AUCUN OBJET MAUDIT",
      targetLabel: targetActors.map(target => target.name).join(", "),
      detail: "<p>Aucun objet maudit n’a été trouvé dans l’inventaire de la cible.</p>"
    });
    return true;
  }

  const selected = await add2eChooseCursedItem(entries);
  if (!selected) return false;

  await removeCursed(selected.item, {
    add2eReason: "delivrance-de-la-malediction",
    add2eCasterId: actor?.id ?? null
  });

  await add2ePostChat({
    title: "Délivrance de la Malédiction",
    outcome: "OBJET DÉSENVOÛTÉ",
    targetLabel: selected.actor.name,
    detail: `<p><b>${add2eEscapeHtml(selected.item.name)}</b> est libéré de sa malédiction et disparaît de l’inventaire.</p>`
  });
  ui.notifications?.info?.(`${selected.item.name} a été désenvoûté.`);
  return true;
} catch (error) {
  console.error(ADD2E_ONUSE_TAG, error);
  ui.notifications?.error?.("Erreur lors de Délivrance de la Malédiction.");
  return false;
}
