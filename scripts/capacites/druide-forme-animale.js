/*
 * ADD2E — Druide : Forme animale
 * Script exécuté via on_use d'une classFeature.
 * Utilisation : 3 formes par jour, une fois par catégorie : reptile, oiseau, mammifère.
 */
const ADD2E_DRUIDE_FORME_ANIMALE_VERSION = "2026-05-03-v1-active-feature";
globalThis.ADD2E_DRUIDE_FORME_ANIMALE_VERSION = ADD2E_DRUIDE_FORME_ANIMALE_VERSION;

function a2eDruideNorm(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_");
}

function a2eDruideDayKey() {
  const wt = Number(game.time?.worldTime);
  if (Number.isFinite(wt) && wt > 0) return `worldday-${Math.floor(wt / 86400)}`;
  return new Date().toISOString().slice(0, 10);
}

async function a2eDruideChooseAnimalForm(available) {
  if (!available.length) return null;

  const options = available.map(f => {
    const label = f === "mammifere" ? "Mammifère" : f.charAt(0).toUpperCase() + f.slice(1);
    return `<option value="${f}">${label}</option>`;
  }).join("");

  return await new Promise(resolve => {
    new Dialog({
      title: "Forme animale du druide",
      content: `
        <form>
          <p>Choisis la catégorie de forme animale à utiliser aujourd’hui.</p>
          <select id="a2e-druide-forme" style="width:100%;">${options}</select>
        </form>
      `,
      buttons: {
        ok: {
          label: "Utiliser",
          callback: html => resolve(html.find("#a2e-druide-forme").val())
        },
        cancel: {
          label: "Annuler",
          callback: () => resolve(null)
        }
      },
      close: () => resolve(null)
    }).render(true);
  });
}

if (!actor) {
  ui.notifications.error("Forme animale : acteur introuvable.");
  return false;
}

const level = Number(actor.system?.niveau ?? 1) || 1;
if (level < 7) {
  ui.notifications.warn("Forme animale indisponible avant le niveau 7.");
  return false;
}

const dayKey = a2eDruideDayKey();
const flagKey = `formeAnimale.${dayKey}`;
const used = actor.getFlag("add2e", flagKey) ?? {};
const categories = ["reptile", "oiseau", "mammifere"];
const available = categories.filter(c => used?.[c] !== true);

if (!available.length) {
  ui.notifications.warn("Forme animale déjà utilisée trois fois aujourd’hui : reptile, oiseau et mammifère.");
  return false;
}

const choice = await a2eDruideChooseAnimalForm(available);
if (!choice) return false;

const normalized = a2eDruideNorm(choice);
if (!available.includes(normalized)) {
  ui.notifications.warn("Catégorie de forme animale indisponible aujourd’hui.");
  return false;
}

const label = normalized === "mammifere" ? "Mammifère" : normalized.charAt(0).toUpperCase() + normalized.slice(1);

const oldEffects = actor.effects
  .filter(e => e.flags?.add2e?.sourceCapacite === "forme_animale")
  .map(e => e.id);
if (oldEffects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", oldEffects);

await actor.createEmbeddedDocuments("ActiveEffect", [{
  name: `Forme animale — ${label}`,
  img: "icons/magic/nature/wolf-paw-glow-green.webp",
  disabled: false,
  transfer: false,
  changes: [],
  duration: {},
  flags: {
    add2e: {
      sourceClasse: "druide",
      sourceCapacite: "forme_animale",
      forme: normalized,
      tags: [
        "classe:druide",
        "forme_animale:active",
        `forme_animale:${normalized}`
      ]
    }
  }
}], { add2eInternal: true });

await actor.setFlag("add2e", flagKey, {
  ...used,
  [normalized]: true,
  last: normalized,
  updatedAt: Date.now()
});

await ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor }),
  content: `
    <div class="add2e-chat-card">
      <h3>Forme animale</h3>
      <p><b>${actor.name}</b> prend une forme animale : <b>${label}</b>.</p>
      <p>Utilisations restantes aujourd’hui : ${2 - Object.values({...used, [normalized]: true}).filter(Boolean).length + 1} / 3.</p>
      <p>Chaque catégorie ne peut être utilisée qu’une fois par jour : reptile, oiseau, mammifère.</p>
    </div>
  `
});

ui.notifications.info(`Forme animale utilisée : ${label}.`);
return true;
