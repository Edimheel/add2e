// ADD2E — Rappel
// Compatible Foundry V13/V14/V15.
// Le script orchestre les règles du sort ; le niveau de clerc reste la propriété du moteur de préparation des sorts.

const ADD2E_RAPPEL_VERSION = "2026-08-09-canonical-word-of-recall-v5";
const ADD2E_RAPPEL_CONFIG = Object.freeze({
  name: "Rappel",
  slug: "rappel",
  level: 6,
  weightPerLevel: 250,
  planarRiskPerPlane: 10,
  description: "Rappel ramène instantanément le clerc vers un sanctuaire désigné avant la préparation du sort. La distance n'intervient pas ; le sort peut emporter une charge supplémentaire limitée et présente un risque lorsqu'un ou plusieurs plans séparent le lanceur de son sanctuaire."
});

globalThis.ADD2E_RAPPEL_VERSION = ADD2E_RAPPEL_VERSION;

function add2eRappelEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eRappelSourceItem() {
  return typeof item !== "undefined" ? item : null;
}

function add2eRappelCasterToken() {
  return (typeof token !== "undefined" ? token : null)
    ?? (typeof args !== "undefined" ? args?.[0]?.token : null)
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eRappelRequireApis() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API commune de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  if (typeof globalThis.add2eSpellClassLevel !== "function") {
    throw new Error("Le propriétaire canonique ADD2E du niveau de classe est indisponible.");
  }
}

function add2eRappelCasterLevel(caster) {
  const level = Number(globalThis.add2eSpellClassLevel(caster, "clerc"));
  if (!Number.isFinite(level) || level < 1) {
    throw new Error("Rappel : niveau canonique de Clerc introuvable sur l’Item classe du lanceur.");
  }
  return Math.floor(level);
}

function add2eRappelNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

async function add2eRappelRollPlanarRisk(chance) {
  const roll = await new Roll("1d100").evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const total = Math.max(1, Math.floor(Number(roll.total) || 1));
  return {
    roll,
    total,
    chance,
    lost: total <= chance
  };
}

async function add2eRappelParameters(casterLevel) {
  const capacity = casterLevel * ADD2E_RAPPEL_CONFIG.weightPerLevel;
  return globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-rappel-dialog"],
    window: { title: ADD2E_RAPPEL_CONFIG.name },
    content: `
      <form class="add2e-rappel-form">
        <p><b>Clerc niveau ${casterLevel}</b> — charge supplémentaire maximale : <b>${capacity} po</b>.</p>
        <div class="form-group">
          <label>Sanctuaire de rappel déjà désigné</label>
          <input name="sanctuary" type="text" required placeholder="Nom ou description du sanctuaire">
        </div>
        <div class="form-group">
          <label style="display:flex;gap:8px;align-items:flex-start;">
            <input name="predesignated" type="checkbox">
            <span>Je confirme que ce sanctuaire a été désigné <b>avant la préparation / mémorisation</b> de ce sort.</span>
          </label>
        </div>
        <div class="form-group">
          <label>Poids supplémentaire à transporter (po)</label>
          <input name="additionalWeight" type="number" min="0" step="1" value="0">
          <p><small>Ce poids représente les créatures et/ou le matériel emportés en plus du lanceur.</small></p>
        </div>
        <div class="form-group">
          <label>Nombre de plans séparant le lanceur du sanctuaire</label>
          <input name="interveningPlanes" type="number" min="0" step="1" value="0">
          <p><small>Chaque plan de séparation ajoute 10 % de risque cumulatif de se perdre entre les plans.</small></p>
        </div>
        <div class="form-group">
          <label>Note du MD</label>
          <textarea name="note" rows="2"></textarea>
        </div>
        <p><small>Le système ne possède pas de propriétaire canonique de sanctuaire ou de téléportation inter-scène : cette utilisation résout la règle mais ne déplace aucun token automatiquement.</small></p>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Effectuer le rappel",
        icon: "<i class='fas fa-place-of-worship'></i>",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          return {
            sanctuary: String(form?.elements?.sanctuary?.value ?? "").trim(),
            predesignated: form?.elements?.predesignated?.checked === true,
            additionalWeight: Math.max(0, Math.floor(add2eRappelNumber(form?.elements?.additionalWeight?.value, 0))),
            interveningPlanes: Math.max(0, Math.floor(add2eRappelNumber(form?.elements?.interveningPlanes?.value, 0))),
            note: String(form?.elements?.note?.value ?? "").trim()
          };
        }
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

async function add2eRappelResolve(casterLevel, parameters) {
  const capacity = casterLevel * ADD2E_RAPPEL_CONFIG.weightPerLevel;
  const declaredWeight = Math.max(0, Math.floor(Number(parameters.additionalWeight) || 0));
  const excessWeight = Math.max(0, declaredWeight - capacity);
  const planes = Math.max(0, Math.floor(Number(parameters.interveningPlanes) || 0));
  const planarRisk = Math.min(100, planes * ADD2E_RAPPEL_CONFIG.planarRiskPerPlane);
  const planar = planarRisk > 0 ? await add2eRappelRollPlanarRisk(planarRisk) : null;

  return {
    capacity,
    declaredWeight,
    excessWeight,
    planes,
    planarRisk,
    planar,
    lost: planar?.lost === true,
    rolls: planar?.roll ? [planar.roll] : []
  };
}

async function add2eRappelChat(caster, casterToken, sourceItem, casterLevel, parameters, resolution) {
  const weightStatus = resolution.excessWeight > 0
    ? `Capacité dépassée de ${resolution.excessWeight} po — les créatures ou objets excédentaires restent sur place`
    : "Charge supplémentaire dans la limite autorisée";
  const planarStatus = resolution.planar
    ? `${resolution.planarRisk}% · d100 ${resolution.planar.total} · ${resolution.lost ? "PERDU ENTRE LES PLANS" : "retour réussi"}`
    : "Aucun plan intermédiaire — aucun risque planaire";
  const outcome = resolution.lost
    ? "Le lanceur et ce qui l’accompagne sont perdus dans un plan intermédiaire ; le sanctuaire n’est pas atteint."
    : "Le rappel atteint le sanctuaire désigné. Le placement effectif des tokens et de la scène reste à effectuer par le MD.";

  const rows = [
    { label: "Clerc", value: `Niveau ${casterLevel}` },
    { label: "Sanctuaire", value: parameters.sanctuary },
    { label: "Désignation préalable", value: "Confirmée avant préparation / mémorisation" },
    { label: "Distance", value: "Sans incidence" },
    { label: "Capacité supplémentaire", value: `${resolution.capacity} po (${ADD2E_RAPPEL_CONFIG.weightPerLevel} po × ${casterLevel})` },
    { label: "Charge déclarée", value: `${resolution.declaredWeight} po` },
    { label: "Transport", value: weightStatus },
    { label: "Plans de séparation", value: resolution.planes },
    { label: "Risque planaire", value: planarStatus },
    { label: "Résultat", value: resolution.lost ? "PERDU ENTRE LES PLANS" : "RAPPEL RÉUSSI" }
  ];

  const safeDescription = add2eRappelEscape(ADD2E_RAPPEL_CONFIG.description);
  const safeOutcome = add2eRappelEscape(outcome);
  const safeNote = add2eRappelEscape(parameters.note);
  const options = {
    actor: caster,
    title: ADD2E_RAPPEL_CONFIG.name,
    icon: "fas fa-place-of-worship",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? sourceItem?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows,
    trustedBodyHtml: `
      <p>${safeDescription}</p>
      <p><b>Issue :</b> ${safeOutcome}</p>
      ${resolution.excessWeight > 0 ? `<p><b>Charge excédentaire :</b> ${resolution.excessWeight} po. Le MD détermine quels objets ou créatures ne peuvent pas accompagner le lanceur.</p>` : ""}
      ${safeNote ? `<p><b>Note :</b> ${safeNote}</p>` : ""}
      <p><em>Aucune destination ni position de token n’est enregistrée ou modifiée par ce script : il n’existe actuellement aucun propriétaire canonique ADD2E pour la téléportation inter-scène.</em></p>
    `,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: resolution.rolls,
      flags: {
        add2e: {
          spell: ADD2E_RAPPEL_CONFIG.slug,
          version: ADD2E_RAPPEL_VERSION,
          sanctuaryPredesignated: true,
          additionalWeight: resolution.declaredWeight,
          capacity: resolution.capacity,
          interveningPlanes: resolution.planes,
          planarRisk: resolution.planarRisk,
          planarLost: resolution.lost
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const sourceItem = add2eRappelSourceItem();
const caster = (typeof actor !== "undefined" ? actor : null) ?? sourceItem?.parent ?? null;
if (!caster || !sourceItem) {
  ui.notifications.error("Rappel : lanceur ou Item sort introuvable.");
  return false;
}

try {
  add2eRappelRequireApis();
  const casterLevel = add2eRappelCasterLevel(caster);
  const parameters = await add2eRappelParameters(casterLevel);
  if (!parameters) {
    ui.notifications.info("Rappel annulé.");
    return false;
  }
  if (!parameters.sanctuary) {
    ui.notifications.warn("Rappel : indique le sanctuaire déjà désigné avant la préparation du sort.");
    return false;
  }
  if (!parameters.predesignated) {
    ui.notifications.warn("Rappel : le sanctuaire doit avoir été désigné avant la préparation / mémorisation du sort.");
    return false;
  }

  const resolution = await add2eRappelResolve(casterLevel, parameters);
  await add2eRappelChat(caster, add2eRappelCasterToken(), sourceItem, casterLevel, parameters, resolution);
  return true;
} catch (error) {
  console.error("[ADD2E][RAPPEL]", error);
  ui.notifications.error(`Rappel : ${error?.message ?? "erreur de résolution"}`);
  return false;
}
