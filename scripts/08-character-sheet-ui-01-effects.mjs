// ============================================================
// ADD2E — 08 Character Sheet UI — 01 effets
// Compatible Foundry V13/V14/V15.
// ============================================================
import { escapeHtml, formatDuration, expose } from "./08-character-sheet-ui-00-utils.mjs";

globalThis.ADD2E_CHARACTER_EFFECTS_UI_VERSION = "2026-06-27-familiar-effect-actions-v1";
console.log("[ADD2E][CHARACTER_UI][EFFECTS][VERSION]", globalThis.ADD2E_CHARACTER_EFFECTS_UI_VERSION);

function familiarAction(effect) {
  const data = effect?.flags?.add2e?.familiar ?? effect?.getFlag?.("add2e", "familiar") ?? null;
  return String(data?.action ?? "").trim();
}

function familiarUseButton(effect) {
  const action = familiarAction(effect);
  if (!action) return "";
  const label = action === "toggle-follow" ? "Suivi" : "Utiliser";
  const icon = action === "toggle-follow" ? "fa-person-walking-arrow-right" : "fa-eye";
  return `<a class="add2e-familiar-effect-use a2e-action-icon" data-effect-id="${escapeHtml(effect.id)}" title="${label}"><i class="fas ${icon}"></i></a>`;
}

export function buildEffectsTab(sheet) {
  const actor = sheet?.actor ?? sheet?.document;
  const effects = Array.from(actor?.effects ?? []);
  const rows = effects.length ? effects.map(eff => {
    const desc = eff.getFlag?.("core", "description") || eff.flags?.add2e?.desc || eff.description || (Array.isArray(eff.flags?.add2e?.tags) ? `<small>${escapeHtml(eff.flags.add2e.tags.join(", "))}</small>` : "");
    const sourceName = eff.parent?.name || eff.origin || "—";
    return `<tr>
      <td style="width:42px;text-align:center;"><img src="${escapeHtml(eff.img || "icons/svg/aura.svg")}" alt="" style="width:28px;height:28px;border:0;object-fit:cover;"></td>
      <td><strong>${escapeHtml(eff.name || eff.label || "Effet")}</strong></td>
      <td>${escapeHtml(sourceName)}</td>
      <td>${escapeHtml(formatDuration(eff))}</td>
      <td class="a2e-small">${desc}</td>
      <td style="white-space:nowrap;text-align:center;">
        ${familiarUseButton(eff)}
        <a class="add2e-effect-edit a2e-action-icon a2e-action-edit" data-effect-id="${escapeHtml(eff.id)}" title="Éditer l’effet"><i class="fas fa-edit"></i></a>
        <a class="add2e-effect-delete a2e-action-icon a2e-action-delete" data-effect-id="${escapeHtml(eff.id)}" title="Supprimer l’effet"><i class="fas fa-trash"></i></a>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" class="a2e-muted" style="text-align:center;padding:0.8em;">Aucun effet actif.</td></tr>`;

  return `<section class="a2e-panel add2e-effects-panel">
    <h2><i class="fas fa-sparkles"></i> Effets actifs</h2>
    <div class="a2e-panel-body"><table class="a2e-table add2e-effects-table">
      <thead><tr><th></th><th>Effet</th><th>Source</th><th>Durée</th><th>Description</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

export function injectEffectsTab(sheet, sheetRoot) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || !sheetRoot) return;
  const tabs = sheetRoot.querySelector(".a2e-tabs.sheet-tabs.tabs, .sheet-tabs.tabs, .a2e-tabs");
  const body = sheetRoot.querySelector(".sheet-body");

  if (tabs && body && !tabs.querySelector('[data-tab="effets"]')) {
    const effectsTab = document.createElement("a");
    effectsTab.className = "item";
    effectsTab.dataset.tab = "effets";
    effectsTab.innerHTML = '<i class="fas fa-sparkles"></i> Effets';
    tabs.appendChild(effectsTab);
  }

  if (body && !body.querySelector('[data-tab="effets"]')) {
    const effectsContent = document.createElement("div");
    effectsContent.className = "tab a2e-tab-content";
    effectsContent.dataset.tab = "effets";
    effectsContent.innerHTML = buildEffectsTab(sheet);
    body.appendChild(effectsContent);
  } else {
    const effectsContent = body?.querySelector('[data-tab="effets"]');
    const effectsPanel = effectsContent?.querySelector(".add2e-effects-panel");
    if (effectsPanel) effectsPanel.outerHTML = buildEffectsTab(sheet);
  }

  $(sheetRoot).find('[data-tab="effets"]').off("click.add2e-effects-tab").on("click.add2e-effects-tab", ev => {
    ev.preventDefault();
    sheet._add2eActivateTab?.("effets", sheetRoot);
  });

  $(sheetRoot).find(".add2e-familiar-effect-use").off("click.add2e-familiar").on("click.add2e-familiar", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const effectId = String($(ev.currentTarget).data("effect-id") || "");
    const effect = effectId ? actor.effects.get(effectId) : null;
    if (!effect) {
      sheet.render(false);
      return;
    }
    const use = globalThis.add2eUseFamiliarEffect;
    if (typeof use !== "function") {
      ui.notifications.warn("Le contrôleur de familier n’est pas chargé.");
      return;
    }
    try {
      await use(actor, effect);
    } catch (err) {
      console.error("[ADD2E][CHARACTER_UI][FAMILIAR][USE]", err);
      ui.notifications.error("Impossible d’utiliser cette capacité de familier.");
    }
  });

  $(sheetRoot).find(".add2e-effect-edit").off("click.add2e-effects").on("click.add2e-effects", ev => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const effectId = String($(ev.currentTarget).data("effect-id") || "");
    const effect = effectId ? actor.effects.get(effectId) : null;
    if (!effect) {
      console.warn("[ADD2E][CHARACTER_UI][EFFECT_EDIT][STALE] Effet introuvable, rafraîchissement fiche", { actor: actor.name, actorId: actor.id, effectId });
      sheet.render(false);
      return;
    }
    effect.sheet.render(true);
  });

  $(sheetRoot).find(".add2e-effect-delete").off("click.add2e-effects").on("click.add2e-effects", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    sheet._add2eRememberActiveTab?.(sheetRoot);
    const effectId = String($(ev.currentTarget).data("effect-id") || "");
    if (!effectId) return;
    const effect = actor.effects.get(effectId);
    if (!effect) {
      sheet.render(false);
      return;
    }
    try {
      await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (!msg.includes("does not exist") && !msg.includes("n'existe pas")) {
        console.error("[ADD2E][CHARACTER_UI][EFFECT_DELETE][ERROR]", { actor: actor.name, actorId: actor.id, effectId, err });
        ui.notifications.error(`Impossible de supprimer l'effet ${effect.name}. Voir console.`);
        return;
      }
    }
    sheet.render(false);
  });
}

expose("add2eUiBuildEffectsTab", buildEffectsTab);
