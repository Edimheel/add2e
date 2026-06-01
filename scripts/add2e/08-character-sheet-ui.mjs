// ============================================================
// ADD2E — Améliorations UI feuille personnage
// - Onglet Effets injecté automatiquement
// - Onglet Sorts : préparation déplacée au début de ligne
// - Onglet Sorts : nombre mémorisé / maximum affiché à côté de "Sort"
// - Onglet Sorts : nom du sort cliquable au lieu du petit livre
// - Onglet Sorts : suppression de l'action "lancer" dans la colonne Actions
// - Onglet Capacités : compétences voleur/assassin en ligne avec bonus DEX/autres
// ============================================================
const ADD2E_CHARACTER_SHEET_UI_VERSION = "2026-05-19-capacites-voleur-assassin-ui-v1";
globalThis.ADD2E_CHARACTER_SHEET_UI_VERSION = ADD2E_CHARACTER_SHEET_UI_VERSION;
console.log("[ADD2E][CHARACTER_UI][VERSION]", ADD2E_CHARACTER_SHEET_UI_VERSION);

function add2eUiEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eUiNormalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function add2eUiGetSpellSlotsByLevel(actor) {
  const pools = add2eGetSpellSlotPoolsByLevel(actor);
  const totals = {};

  for (const pool of Object.values(pools)) {
    for (const [lvl, max] of Object.entries(pool.slotsByLevel || {})) {
      totals[lvl] = (Number(totals[lvl]) || 0) + (Number(max) || 0);
    }
  }

  return totals;
}

function add2eUiGetSpellPoolsByLevel(actor) {
  const pools = add2eGetSpellSlotPoolsByLevel(actor);
  const out = {};

  for (const [key, pool] of Object.entries(pools)) {
    for (const [lvl, max] of Object.entries(pool.slotsByLevel || {})) {
      const spellLevel = Number(lvl) || 1;
      if (!out[spellLevel]) out[spellLevel] = [];
      out[spellLevel].push({
        key,
        label: pool.label || add2eSpellLabel(key),
        startsAt: Number(pool.startsAt || 1),
        maxSpellLevel: Number(pool.maxSpellLevel || 0),
        max: Number(max) || 0,
        count: add2eCountPreparedForEntryLevel(actor, pool, spellLevel)
      });
    }
  }

  return out;
}

function add2eUiGetMemorizedSpellsByLevel(actor) {
  const countByLevel = {};
  for (const sort of actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const niv = Number(sort.system?.niveau || sort.system?.level || 1) || 1;
    const count = add2eGetTotalMemorizedCount(sort);
    countByLevel[niv] = (countByLevel[niv] || 0) + count;
  }
  return countByLevel;
}

function add2eUiFormatDuration(effect) {
  if (typeof effect?.duration?.remaining !== "undefined") return `${effect.duration.remaining} rounds`;
  if (typeof effect?.duration?.rounds !== "undefined") return `${effect.duration.rounds} rounds`;
  if (typeof effect?.duration?.seconds !== "undefined") return `${effect.duration.seconds} sec`;
  return "—";
}

function add2eUiBuildEffectsTab(sheet) {
  const actor = sheet?.actor;
  const effects = Array.from(actor?.effects ?? []);

  const rows = effects.length ? effects.map(eff => {
    const desc = eff.getFlag?.("core", "description")
      || eff.flags?.add2e?.desc
      || eff.description
      || (Array.isArray(eff.flags?.add2e?.tags) ? `<small>${add2eUiEscapeHtml(eff.flags.add2e.tags.join(", "))}</small>` : "");
    const sourceName = eff.parent?.name || eff.origin || "—";

    return `
      <tr>
        <td style="width:42px;text-align:center;">
          <img src="${add2eUiEscapeHtml(eff.img || "icons/svg/aura.svg")}" alt="" style="width:28px;height:28px;border:0;object-fit:cover;">
        </td>
        <td><strong>${add2eUiEscapeHtml(eff.name || eff.label || "Effet")}</strong></td>
        <td>${add2eUiEscapeHtml(sourceName)}</td>
        <td>${add2eUiEscapeHtml(add2eUiFormatDuration(eff))}</td>
        <td class="a2e-small">${desc}</td>
        <td style="white-space:nowrap;text-align:center;">
          <a class="effect-edit add2e-effect-edit a2e-action-icon a2e-action-edit" data-effect-id="${add2eUiEscapeHtml(eff.id)}" title="Éditer l’effet">
            <i class="fas fa-edit"></i>
          </a>
          <a class="effect-delete add2e-effect-delete a2e-action-icon a2e-action-delete" data-effect-id="${add2eUiEscapeHtml(eff.id)}" title="Supprimer l’effet">
            <i class="fas fa-trash"></i>
          </a>
        </td>
      </tr>`;
  }).join("") : `
      <tr>
        <td colspan="6" class="a2e-muted" style="text-align:center;padding:0.8em;">Aucun effet actif.</td>
      </tr>`;

  return `
    <section class="a2e-panel add2e-effects-panel">
      <h2><i class="fas fa-sparkles"></i> Effets actifs</h2>
      <div class="a2e-panel-body">
        <table class="a2e-table add2e-effects-table">
          <thead>
            <tr>
              <th></th>
              <th>Effet</th>
              <th>Source</th>
              <th>Durée</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

function add2eUiFeatureName(feature) {
  if (typeof add2eFeatureName === "function") return add2eFeatureName(feature);
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "Capacité").trim();
}

function add2eUiFeatureMinLevel(feature) {
  if (typeof add2eFeatureMinLevel === "function") return add2eFeatureMinLevel(feature);
  return Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1) || 1;
}

function add2eUiFeatureMaxLevel(feature) {
  if (typeof add2eFeatureMaxLevel === "function") return add2eFeatureMaxLevel(feature);
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  return raw === undefined || raw === null || raw === "" ? 999 : Number(raw) || 999;
}

function add2eUiFeatureOnUse(feature) {
  if (typeof add2eFeatureOnUse === "function") return add2eFeatureOnUse(feature);
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function add2eUiFeatureIsActivable(feature) {
  if (typeof add2eIsFeatureActivable === "function") return add2eIsFeatureActivable(feature);
  if (!feature || typeof feature !== "object") return false;
  if (feature.activable === true) return true;
  if (feature.active === true && feature.passive !== true) return true;
  if (String(feature._add2eFeatureSource ?? "") === "activeClassFeatures") return true;
  return !!add2eUiFeatureOnUse(feature);
}

function add2eUiAllClassFeatures(actor) {
  if (typeof add2eGetActorClassFeatures === "function") {
    try { return add2eGetActorClassFeatures(actor) ?? []; }
    catch (e) { console.warn("[ADD2E][CAPACITES][FEATURES] Lecture add2eGetActorClassFeatures impossible", e); }
  }

  const sys = actor?.system ?? {};
  const classItem = actor?.items?.find?.(i => String(i?.type || "").toLowerCase() === "classe") ?? null;
  const systems = [sys.details_classe, classItem?.system, sys].filter(s => s && typeof s === "object");
  const out = [];
  const push = (value, source) => {
    const arr = Array.isArray(value) ? value : (value && typeof value === "object" ? Object.values(value) : []);
    for (const f of arr) if (f && typeof f === "object") out.push({ ...f, _add2eFeatureSource: source });
  };

  for (const s of systems) {
    push(s.activeClassFeatures, "activeClassFeatures");
    push(s.activableClassFeatures, "activableClassFeatures");
    push(s.classFeaturesActives, "classFeaturesActives");
    push(s.capacitesActives, "capacitesActives");
    push(s.capacitesActivables, "capacitesActivables");
    push(s.classFeatures, "classFeatures");
    push(s.classFeaturesDebloquees, "classFeaturesDebloquees");
    push(s.capacitesClasse, "capacitesClasse");
    push(s.passiveClassFeatures, "passiveClassFeatures");
    push(s.passiveFeatures, "passiveFeatures");
    push(s.capacitesPassives, "capacitesPassives");
  }

  return out;
}

function add2eUiGetThiefSkills(actor) {
  if (typeof add2eGetActorThiefSkills !== "function") return [];
  try { return add2eGetActorThiefSkills(actor) ?? []; }
  catch (e) {
    console.warn("[ADD2E][CAPACITES][VOLEUR] Impossible de lire add2eGetActorThiefSkills", e);
    return [];
  }
}

function add2eUiBuildThiefSkillsPanel(actor) {
  const skills = add2eUiGetThiefSkills(actor);
  if (!skills.length) return "";

  const cards = skills.map(skill => {
    const bonus = Number(skill.bonusTotal ?? 0) || 0;
    const bonusHtml = bonus === 0
      ? `<span class="a2e-thief-skill-bonus neutral">+0%</span>`
      : `<span class="a2e-thief-skill-bonus ${bonus > 0 ? "positive" : "negative"}">${bonus > 0 ? "+" : ""}${bonus}%</span>`;
    const action = skill.canRoll === false
      ? `<span class="a2e-muted">—</span>`
      : `<button type="button" class="a2e-btn blue add2e-thief-skill-roll" data-skill-key="${add2eUiEscapeHtml(skill.key)}" title="Tester ${add2eUiEscapeHtml(skill.label ?? skill.shortLabel ?? skill.key)}"><i class="fas fa-dice-d100"></i></button>`;

    return `
      <div class="a2e-thief-skill-card" title="${add2eUiEscapeHtml(skill.breakdownTitle ?? "")}">
        <div class="a2e-thief-skill-name">${add2eUiEscapeHtml(skill.shortLabel || skill.label || skill.key)}</div>
        <div class="a2e-thief-skill-total">${add2eUiEscapeHtml(skill.display ?? `${skill.finalValue ?? skill.value ?? 0}%`)}</div>
        <div class="a2e-thief-skill-detail">
          <span>Base ${add2eUiEscapeHtml(skill.baseDisplay ?? `${skill.base ?? 0}%`)}</span>
          ${bonusHtml}
        </div>
        <div class="a2e-thief-skill-action">${action}</div>
      </div>`;
  }).join("");

  return `
    <div class="a2e-panel add2e-thief-skills-panel">
      <h2>Compétences de voleur / assassin</h2>
      <div class="a2e-panel-body">
        <div class="a2e-thief-skills-inline">${cards}</div>
      </div>
    </div>`;
}

function add2eUiBuildFeatureCard(actor, feature, index, mode) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  const name = add2eUiFeatureName(feature);
  const min = add2eUiFeatureMinLevel(feature);
  const max = add2eUiFeatureMaxLevel(feature);
  const locked = level < min || level > max;
  const desc = String(feature?.description ?? feature?.desc ?? feature?.text ?? "").trim();
  const onUse = add2eUiFeatureOnUse(feature);
  const skillKey = feature?.skillKey ?? feature?.key ?? feature?.slug ?? "";
  const uses = feature?.uses?.label ?? feature?.usageLabel ?? "Disponible";
  const button = mode === "active"
    ? `<div class="a2e-feature-actions"><button type="button" class="a2e-btn blue add2e-feature-use" data-feature-index="${index}" data-feature-name="${add2eUiEscapeHtml(name)}" data-skill-key="${add2eUiEscapeHtml(skillKey)}" data-on-use="${add2eUiEscapeHtml(onUse)}"><i class="fas fa-bolt"></i>&nbsp;Utiliser</button></div>`
    : "";

  return `
    <div class="a2e-feature-card ${locked ? "locked" : ""}">
      <div class="a2e-feature-card-title">
        <strong>${add2eUiEscapeHtml(name)}</strong>
        <span>${locked ? `Niveau ${min}` : (mode === "active" ? add2eUiEscapeHtml(uses) : "Actif")}</span>
      </div>
      ${desc ? `<div class="a2e-feature-card-desc">${desc}</div>` : ""}
      ${button}
    </div>`;
}

function add2eUiBuildClassFeaturesPanel(actor) {
  const features = add2eUiAllClassFeatures(actor);
  const active = [];
  const passive = [];

  features.forEach((feature, index) => {
    if (add2eUiFeatureIsActivable(feature)) active.push({ feature, index });
    else passive.push({ feature, index });
  });

  const activeHtml = active.length
    ? active.map(entry => add2eUiBuildFeatureCard(actor, entry.feature, entry.index, "active")).join("")
    : `<p class="a2e-muted">Aucune capacité activable.</p>`;

  const passiveHtml = passive.length
    ? passive.map(entry => add2eUiBuildFeatureCard(actor, entry.feature, entry.index, "passive")).join("")
    : `<p class="a2e-muted">Aucune capacité passive.</p>`;

  return `
    <div class="a2e-grid-2 add2e-capacites-grid-modern">
      <div class="a2e-panel">
        <h2>Capacités activables</h2>
        <div class="a2e-panel-body a2e-feature-card-list">${activeHtml}</div>
      </div>
      <div class="a2e-panel">
        <h2>Capacités passives</h2>
        <div class="a2e-panel-body a2e-feature-card-list">${passiveHtml}</div>
      </div>
    </div>`;
}

function add2eUiInjectCapacitesTab(sheet, sheetRoot) {
  const actor = sheet?.actor;
  if (!actor || actor.type !== "personnage") return;

  const tab = sheetRoot.querySelector('.sheet-body .a2e-tab-content[data-tab="capacites"], .sheet-body .tab[data-tab="capacites"]');
  if (!tab) return;

  const oldGrid = tab.querySelector(":scope > .a2e-grid-2:not(.add2e-capacites-grid-modern)");
  if (oldGrid) oldGrid.style.display = "none";

  const previous = tab.querySelector(".add2e-capacites-modern-root");
  if (previous) previous.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "add2e-capacites-modern-root";
  wrapper.innerHTML = `
    ${add2eUiBuildThiefSkillsPanel(actor)}
    ${add2eUiBuildClassFeaturesPanel(actor)}
  `;
  tab.insertBefore(wrapper, tab.firstElementChild || null);

  $(wrapper).find(".add2e-thief-skill-roll")
    .off("click.add2e-thief-skill-roll")
    .on("click.add2e-thief-skill-roll", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const skillKey = ev.currentTarget.dataset.skillKey;
      if (typeof add2eRollThiefSkill !== "function") {
        ui.notifications.error("Le moteur des compétences de voleur n'est pas chargé.");
        return false;
      }
      await add2eRollThiefSkill(actor, skillKey);
      return false;
    });

  $(wrapper).find(".add2e-feature-use")
    .off("click.add2e-feature-use-modern")
    .on("click.add2e-feature-use-modern", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof add2eUseClassFeatureFromElement !== "function") {
        ui.notifications.error("Le moteur des capacités de classe n'est pas chargé.");
        return false;
      }
      await add2eUseClassFeatureFromElement(actor, ev.currentTarget, sheet);
      return false;
    });

  console.log("[ADD2E][CAPACITES][UI] Rendu capacités moderne", {
    actor: actor.name,
    thiefSkills: add2eUiGetThiefSkills(actor),
    features: add2eUiAllClassFeatures(actor).map(add2eUiFeatureName)
  });
}

function add2eEnhanceCharacterSheetUi(sheet, html) {
  const actor = sheet?.actor;
  if (!actor) return;

  const root = html?.jquery ? html[0] : html;
  if (!root) return;

  const sheetRoot = root.matches?.(".add2e-character-v3")
    ? root
    : root.querySelector?.(".add2e-character-v3") || root;

  if (!sheetRoot) return;

  // ------------------------------------------------------------
  // 1. Onglet Effets
  // ------------------------------------------------------------
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
    effectsContent.innerHTML = add2eUiBuildEffectsTab(sheet);
    body.appendChild(effectsContent);
  } else {
    const effectsContent = body?.querySelector('[data-tab="effets"]');
    const effectsPanel = effectsContent?.querySelector(".add2e-effects-panel");
    if (effectsPanel) effectsPanel.outerHTML = add2eUiBuildEffectsTab(sheet);
  }

  $(sheetRoot).find('[data-tab="effets"]')
    .off("click.add2e-effects-tab")
    .on("click.add2e-effects-tab", ev => {
      ev.preventDefault();
      sheet._add2eActivateTab?.("effets", sheetRoot);
    });

  $(sheetRoot).find(".add2e-effect-edit, .effect-edit")
    .off("click.add2e-effects")
    .on("click.add2e-effects", ev => {
      ev.preventDefault();
      const effectId = $(ev.currentTarget).data("effect-id");
      const effect = actor.effects.get(effectId);
      if (effect) effect.sheet.render(true);
    });

  $(sheetRoot).find(".add2e-effect-delete, .effect-delete")
    .off("click.add2e-effects")
    .on("click.add2e-effects", async ev => {
      ev.preventDefault();
      sheet._add2eRememberActiveTab?.(sheetRoot);
      const effectId = $(ev.currentTarget).data("effect-id");
      if (effectId) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
        sheet.render(false);
      }
    });

  // ------------------------------------------------------------
  // 1b. Onglet Capacités : affichage moderne depuis les données réelles
  // ------------------------------------------------------------
  add2eUiInjectCapacitesTab(sheet, sheetRoot);

  // ------------------------------------------------------------
  // 2. Onglet Sorts : affichage lisible des lignes de sorts
  // ------------------------------------------------------------
  const poolsByLevel = add2eUiGetSpellPoolsByLevel(actor);
  const entries = add2eGetSpellcastingEntries(actor);

  const spellTab =
    sheetRoot.querySelector('.sheet-body .a2e-tab-content[data-tab="sorts"]') ||
    sheetRoot.querySelector('.sheet-body .a2e-tab-content[data-tab="sort"]') ||
    sheetRoot.querySelector('.sheet-body .tab[data-tab="sorts"]') ||
    sheetRoot.querySelector('.sheet-body .tab[data-tab="sort"]') ||
    sheetRoot.querySelector('.sheet-body [data-tab="sorts"]') ||
    sheetRoot.querySelector('.sheet-body [data-tab="sort"]');

  const firstSortTable = sheetRoot.querySelector("table.sort-table");
  const spellContainer = spellTab || firstSortTable?.closest?.(".a2e-tab-content, .tab") || firstSortTable?.parentElement;

  if (spellContainer && entries.length && !spellContainer.querySelector(".a2e-spellcasting-summary")) {
    const summary = document.createElement("div");
    summary.className = "a2e-spellcasting-summary";
    summary.innerHTML = `
      <strong>Sorts utilisables :</strong>
      ${entries.map(e => `
        <span class="a2e-spell-pool-summary">
          ${add2eUiEscapeHtml(e.label || add2eSpellLabel(e.key))}
          <small>niv. ${Number(e.startsAt || 1)}+, sorts ${Number(e.maxSpellLevel || 0) || "—"}</small>
        </span>
      `).join("")}
    `;
    spellContainer.insertBefore(summary, spellContainer.firstElementChild || null);
  }

  if (spellContainer) add2eUiInjectObjectMagicSection(spellContainer, actor);

  for (const table of sheetRoot.querySelectorAll("table.sort-table")) {
    const panel = table.closest(".a2e-panel") || table.parentElement;
    const panelText = panel?.querySelector?.("h2, h3")?.textContent || panel?.textContent || "";
    const levelMatch = panelText.match(/niveau\s*(\d+)/i);
    const spellLevel = levelMatch ? Number(levelMatch[1]) : null;
    const pools = spellLevel ? (poolsByLevel[spellLevel] || []) : [];

    const headers = Array.from(table.querySelectorAll("thead th"));
    const sortHeader = headers.find(th => add2eUiNormalizeText(th.textContent) === "sort");
    if (sortHeader && spellLevel && !sortHeader.querySelector(".a2e-sort-pool-labels")) {
      const activePools = pools.filter(p => Number(p.max) > 0 || Number(p.count) > 0);
      const poolHtml = activePools.length
        ? activePools.map(p => `
          <span class="a2e-sort-slot-label a2e-sort-slot-${add2eUiEscapeHtml(p.key)}" title="${add2eUiEscapeHtml(p.label)} : préparés / maximum">
            ${add2eUiEscapeHtml(p.label)} ${Number(p.count) || 0}/${Number(p.max) || 0}
          </span>`).join("")
        : `<span class="a2e-sort-slot-label muted" title="Aucun emplacement disponible à ce niveau">0</span>`;
      sortHeader.innerHTML = `Sort <span class="a2e-sort-pool-labels">${poolHtml}</span>`;
    }

    const memIndex = headers.findIndex(th => add2eUiNormalizeText(th.textContent).includes("memorisation"));
    if (memIndex >= 0) {
      headers[memIndex].style.display = "none";
      for (const row of table.querySelectorAll("tbody tr")) {
        const cells = Array.from(row.children).filter(el => el.tagName === "TD" || el.tagName === "TH");
        if (cells[memIndex]) cells[memIndex].style.display = "none";
      }
    }

    for (const row of table.querySelectorAll("tbody tr")) {
      if (row.classList.contains("sort-description")) continue;
      const sortId = row.querySelector("[data-sort-id]")?.dataset?.sortId || row.querySelector("[data-sort-id]")?.getAttribute("data-sort-id");
      const sort = sortId ? actor.items.get(sortId) : null;
      if (!sort) continue;

      const check = add2eCanActorUseSpell(actor, sort);
      const entry = check.entry || add2eGetSpellEntryForSpell(actor, sort);
      const label = entry?.label || add2eGetSpellListsFromItem(sort).map(add2eSpellLabel).join(" / ") || "Sort";

      const memBadge = row.querySelector(".sort-memorize-badge");
      if (memBadge && entry) {
        const memCount = add2eGetMemorizedCountForEntry(sort, entry);
        memBadge.textContent = `${memCount}`;
        memBadge.title = `Sort préparé comme ${entry.label}`;
        memBadge.dataset.spellEntryKey = entry.key;
      }
      for (const btn of row.querySelectorAll(".sort-memorize-plus, .sort-memorize-minus")) {
        if (entry) btn.dataset.spellEntryKey = entry.key;
      }

      const cells = Array.from(row.children).filter(el => el.tagName === "TD" || el.tagName === "TH");
      const targetCell = cells.find(td => td.textContent?.trim() && !td.querySelector("img")) || cells[0];
      if (targetCell) {
        let badge = row.querySelector(".a2e-sort-list-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "a2e-sort-list-badge";
          targetCell.appendChild(document.createTextNode(" "));
          targetCell.appendChild(badge);
        }
        badge.className = `a2e-sort-list-badge ${check.ok ? "ok" : "locked"}`;
        badge.title = check.ok
          ? `${label} — utilisable`
          : check.reason === "start"
            ? `${label} — disponible à partir du niveau ${entry?.startsAt}`
            : check.reason === "max-level"
              ? `${label} — niveau de sort maximum ${entry?.maxSpellLevel}`
              : `${label} — non autorisé par cette classe`;
        badge.textContent = label;
      }
    }
  }

  // Supprime le badge global déjà affiché à droite du titre de niveau,
  // puisqu'il est maintenant affiché à côté de "Sort" dans l'en-tête.
  for (const badge of sheetRoot.querySelectorAll(".sort-memorize-badge")) {
    if (!badge.closest("tbody tr")) badge.remove();
  }

  // ------------------------------------------------------------
  // 3. Onglet Sorts : préparation +/- au début de la ligne
  // ------------------------------------------------------------
  for (const row of sheetRoot.querySelectorAll("table.sort-table tbody tr")) {
    const controls = Array.from(row.querySelectorAll(".sort-memorize-minus, .sort-memorize-plus, .sort-memorize-badge"));
    if (!controls.length) continue;

    const firstCell = row.querySelector("td");
    if (!firstCell || firstCell.querySelector(".a2e-sort-prep-controls")) continue;

    const wrap = document.createElement("div");
    wrap.className = "a2e-sort-prep-controls";
    wrap.title = "Préparer / retirer un sort préparé";

    const ordered = [
      row.querySelector(".sort-memorize-minus"),
      row.querySelector(".sort-memorize-badge"),
      row.querySelector(".sort-memorize-plus")
    ].filter(Boolean);

    for (const el of ordered) wrap.appendChild(el);
    firstCell.prepend(wrap);
  }

  // ------------------------------------------------------------
  // 4. Onglet Sorts : nom cliquable au lieu du petit livre
  // ------------------------------------------------------------
  for (const toggle of Array.from(sheetRoot.querySelectorAll(".toggle-sort-desc-chat"))) {
    const sortId = toggle.dataset?.sortId || toggle.getAttribute("data-sort-id");
    const row = toggle.closest("tr");
    if (!row || !sortId) continue;

    const cells = Array.from(row.children).filter(el => el.tagName === "TD" || el.tagName === "TH");
    const nameCell = cells.find(td => td.textContent?.trim() && !td.querySelector(".sort-memorize-badge") && !td.querySelector("img")) || cells[1] || cells[0];

    if (nameCell && !nameCell.querySelector(".a2e-sort-name-link")) {
      const iconClone = nameCell.querySelector("i.toggle-sort-desc-chat");
      if (iconClone) iconClone.remove();

      const rawName = nameCell.textContent.trim();
      const link = document.createElement("a");
      link.href = "#";
      link.className = "a2e-sort-name-link";
      link.dataset.sortId = sortId;
      link.textContent = rawName || "Détail du sort";

      nameCell.textContent = "";
      nameCell.appendChild(link);
    }

    toggle.remove();
  }

  $(sheetRoot).find(".a2e-sort-name-link")
    .off("click.add2e-sort-desc")
    .on("click.add2e-sort-desc", function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const sortId = $(this).data("sort-id");
      const descRow = $(sheetRoot).find(`#desc-chat-${sortId}`);
      descRow.slideToggle(160);
      return false;
    });

  // ------------------------------------------------------------
  // 5. Onglet Sorts : retirer l'action Lancer de la colonne Actions
  // ------------------------------------------------------------
  for (const el of Array.from(sheetRoot.querySelectorAll(".sort-cast"))) {
    if (!el.classList.contains("sort-cast-img")) el.remove();
  }

  // Styles injectés une seule fois dans la feuille.
  if (!sheetRoot.querySelector("style[data-add2e-ui-enhance='1']")) {
    const style = document.createElement("style");
    style.dataset.add2eUiEnhance = "1";
    style.textContent = `
      .add2e-character-v3 .a2e-spellcasting-summary {
        margin:0 0 8px 0;
        padding:7px 9px;
        border:1px solid #d9bf73;
        border-radius:9px;
        background:#fff8df;
        color:#3d2b0a;
        line-height:1.45;
      }
      .add2e-character-v3 .a2e-spell-pool-summary {
        display:inline-flex;
        align-items:center;
        gap:0.35em;
        margin:2px 4px;
        padding:2px 7px;
        border:1px solid #c49a41;
        border-radius:999px;
        background:#fffdf6;
        font-weight:900;
      }
      .add2e-character-v3 .a2e-spell-pool-summary small {
        color:#7f704d;
        font-weight:700;
      }
      .add2e-character-v3 .a2e-sort-slot-label {
        display:inline-block;
        margin-left:0.45em;
        padding:0.08em 0.45em;
        border-radius:999px;
        background:#7c39c3;
        color:#fff;
        font-weight:900;
        font-size:0.9em;
        line-height:1.45em;
      }
      .add2e-character-v3 .a2e-sort-slot-label.muted {
        background:#918873;
      }
      .add2e-character-v3 .a2e-sort-slot-druide {
        background:#2f8f4e;
      }
      .add2e-character-v3 .a2e-sort-slot-magicien {
        background:#7c39c3;
      }
      .add2e-character-v3 .a2e-sort-slot-clerc {
        background:#b88924;
      }
      .add2e-character-v3 .a2e-sort-list-badge {
        display:inline-block;
        margin-left:0.35em;
        padding:0.05em 0.45em;
        border-radius:999px;
        font-size:0.78em;
        line-height:1.35;
        font-weight:900;
        vertical-align:middle;
        border:1px solid rgba(0,0,0,0.12);
      }
      .add2e-character-v3 .a2e-sort-list-badge.ok {
        background:#eaf8ef;
        color:#226d3b;
      }
      .add2e-character-v3 .a2e-sort-list-badge.locked {
        background:#f3eee1;
        color:#8a611d;
      }
      .add2e-character-v3 .a2e-sort-prep-controls {
        display:inline-flex;
        align-items:center;
        gap:0.25em;
        margin-right:0.45em;
        vertical-align:middle;
      }
      .add2e-character-v3 .a2e-sort-prep-controls .sort-memorize-badge {
        margin:0;
      }
      .add2e-character-v3 .a2e-sort-name-link {
        color:#2f250c;
        font-weight:900;
        text-decoration:none;
        border-bottom:1px dotted #7c39c3;
        cursor:pointer;
      }
      .add2e-character-v3 .a2e-sort-name-link:hover {
        color:#7c39c3;
        text-shadow:0 0 3px rgba(124,57,195,0.18);
      }
      .add2e-character-v3 .add2e-object-magic-panel {
        border-color:#b88924;
        box-shadow:0 1px 6px rgba(80,58,10,0.16);
      }
      .add2e-character-v3 .add2e-object-magic-panel > h2 {
        background:linear-gradient(180deg, #ead99d, #dfc36f);
      }
      .add2e-character-v3 .add2e-object-magic-table td,
      .add2e-character-v3 .add2e-object-magic-table th,
      .add2e-character-v3 .add2e-effects-table td,
      .add2e-character-v3 .add2e-effects-table th {
        vertical-align:middle;
      }
      .add2e-character-v3 .a2e-thief-skills-inline {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
        gap:7px;
      }
      .add2e-character-v3 .a2e-thief-skill-card {
        display:grid;
        grid-template-columns:1fr auto;
        grid-template-rows:auto auto auto;
        gap:2px 6px;
        align-items:center;
        padding:7px 8px;
        border:1px solid #d6b05a;
        border-radius:9px;
        background:#fffdf6;
        box-shadow:0 1px 3px rgba(80,58,10,.10);
      }
      .add2e-character-v3 .a2e-thief-skill-name {
        grid-column:1;
        font-weight:950;
        color:#3d2b0a;
        line-height:1.05;
      }
      .add2e-character-v3 .a2e-thief-skill-total {
        grid-column:1;
        font-size:1.18em;
        font-weight:950;
        color:#184a82;
      }
      .add2e-character-v3 .a2e-thief-skill-detail {
        grid-column:1;
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        align-items:center;
        color:#7f704d;
        font-size:.82em;
        font-weight:800;
      }
      .add2e-character-v3 .a2e-thief-skill-bonus {
        border-radius:999px;
        padding:1px 5px;
        border:1px solid #dac276;
        background:#fff7dc;
        font-weight:950;
      }
      .add2e-character-v3 .a2e-thief-skill-bonus.positive { color:#1f7c4d; }
      .add2e-character-v3 .a2e-thief-skill-bonus.negative { color:#a1261b; }
      .add2e-character-v3 .a2e-thief-skill-bonus.neutral { color:#7f704d; }
      .add2e-character-v3 .a2e-thief-skill-action {
        grid-column:2;
        grid-row:1 / span 3;
        text-align:center;
      }
      .add2e-character-v3 .a2e-feature-card-list {
        display:grid;
        gap:7px;
      }
      .add2e-character-v3 .a2e-feature-card {
        padding:7px 8px;
        border:1px solid #dac276;
        border-radius:9px;
        background:#fffdf6;
      }
      .add2e-character-v3 .a2e-feature-card.locked { opacity:.62; }
      .add2e-character-v3 .a2e-feature-card-title {
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:center;
        color:#3d2b0a;
      }
      .add2e-character-v3 .a2e-feature-card-title span {
        font-size:.82em;
        font-weight:900;
        color:#6f4b12;
      }
      .add2e-character-v3 .a2e-feature-card-desc {
        margin-top:5px;
        font-size:.9em;
        line-height:1.28;
      }
      .add2e-character-v3 .a2e-feature-actions {
        margin-top:7px;
        display:flex;
        justify-content:flex-start;
      }
    `;
    sheetRoot.prepend(style);
  }

  sheet._add2eActivateTab?.(sheet._add2eActiveTab || sheet._add2eReadStoredTab?.() || "resume", sheetRoot);
}

/**
 * Ajoute la gestion universelle du clic image avec data-edit="img" ou data-edit="img_portrait"
 * Utilise majImageToken pour les acteurs (img), .update pour les items,
 * gère aussi le portrait (img_portrait sur l'acteur).
 * À appeler dans activateListeners(html) de chaque feuille.
 */
function add2eRegisterImgPicker(html, sheet) {
  // Image générale (avatar, icône, token, sort, etc.)
  html.find('img[data-edit="img"]').off().on('click', ev => {
    ev.preventDefault();
    // Détecte le contexte : acteur, item, etc.
    const isActor = !!sheet.actor;
    const isItem  = !!sheet.item && !sheet.actor;
    let currentImg = "icons/svg/mystery-man.svg";
    let updateFn   = null;

    if (isActor) {
      currentImg = sheet.actor.img || currentImg;
      updateFn = path => majImageToken(sheet.actor, path);
    } else if (isItem) {
      currentImg = sheet.item.img || currentImg;
      updateFn = path => sheet.item.update({ img: path });
    } else {
      return;
    }

    new FilePicker({
      type: "image",
      current: currentImg,
      callback: path => {
        updateFn(path);
        html.find('img[data-edit="img"]').attr('src', path);
        html.find('input[name="img"]').val(path);
      }
    }).render(true);
  });

  // Portrait spécial (champ dédié : actor.system.img_portrait)
  html.find('img[data-edit="img_portrait"]').off().on('click', ev => {
    ev.preventDefault();
    // Attention : ici, on ne touche que l'acteur
    if (!sheet.actor) return;
    new FilePicker({
      type: "image",
      current: sheet.actor.system.img_portrait || "icons/svg/mystery-man.svg",
      callback: path => {
        sheet.actor.update({ "system.img_portrait": path });
        html.find('img[data-edit="img_portrait"]').attr('src', path);
      }
    }).render(true);
  });
}


function canCastSpell(spellData, actor) {
  const normalize = v => (v ?? "").toString().toLowerCase().trim();

  const sys =
    spellData?.system ??
    spellData?.data?.system ??
    {};

  // LOG 1
  console.log("[canCastSpell] sort:", spellData.name, sys.spellLists, sys.niveau);

  // Le sort DOIT avoir spellLists
  if (!Array.isArray(sys.spellLists) || !sys.spellLists.length) {
    console.log("[canCastSpell] REFUS: sort sans spellLists");
    return false;
  }

  const casting = actor.system?.spellcasting;

  // LOG 2
  console.log("[canCastSpell] actor spellcasting:", casting);

  if (!casting || !Array.isArray(casting.lists) || !casting.lists.length) {
    console.log("[canCastSpell] REFUS: acteur sans spellcasting.lists");
    return false;
  }

  const sortLists  = sys.spellLists.map(normalize);
  const actorLists = casting.lists.map(normalize);

  // LOG 3
  console.log("[canCastSpell] intersection:", sortLists, actorLists);

  if (!sortLists.some(l => actorLists.includes(l))) {
    console.log("[canCastSpell] REFUS: listes incompatibles");
    return false;
  }

  const actorLevel = Number(actor.system?.niveau) || 1;
  const spellLevel = Number(sys.niveau) || 1;

  if (casting.startsAt && actorLevel < casting.startsAt) {
    console.log("[canCastSpell] REFUS: niveau trop bas");
    return false;
  }

  if (casting.maxSpellLevel && spellLevel > casting.maxSpellLevel) {
    console.log("[canCastSpell] REFUS: niveau de sort trop élevé");
    return false;
  }

  const prog = actor.system?.details_classe?.progression?.[actorLevel - 1] || {};
  const slots = Array.isArray(prog.spellsPerLevel)
    ? Number(prog.spellsPerLevel[spellLevel - 1]) || 0
    : 0;

  // LOG 4
  console.log("[canCastSpell] slots:", slots);

  if (slots <= 0) {
    console.log("[canCastSpell] REFUS: aucun slot");
    return false;
  }

  console.log("[canCastSpell] OK");
  return true;
}


function add2eRaceTagsFromData(raceData) {
  const sys = raceData?.system ?? {};
  const tags = new Set();

  for (const raw of [
    ...add2eToEquipArray(sys.identityTags),
    ...add2eToEquipArray(sys.tags),
    ...add2eToEquipArray(raceData?.flags?.add2e?.tags)
  ]) {
    const tag = add2eNormalizeEquipTag(raw);
    if (tag.startsWith("race:")) tags.add(tag);
  }

  if (!tags.size) {
    const name = add2eNormalizeEquipTag(raceData?.name ?? sys.label ?? sys.nom ?? "");
    if (name) tags.add(`race:${name}`);
  }

  return [...tags];
}

function add2eClassRuleSystem(classeItem) {
  const sys = add2eDeepClone(classeItem?.system ?? {}) || {};
  const hasRaceRules = !!sys.raceRestriction?.races && Object.keys(sys.raceRestriction.races).length > 0;
  const hasReqTags = add2eToEquipArray(sys.requirementTags).length > 0;

  // Micro-fallback : si l'item droppé est une copie incomplète, on relit l'item Monde du même nom.
  // On ne crée pas de second système : on complète seulement les champs de règles manquants.
  if ((!hasRaceRules || !hasReqTags) && classeItem?.name && game?.items) {
    const worldClass = game.items.find(i => i.type === "classe" && i.name === classeItem.name);
    const worldSys = worldClass?.system;

    if (worldSys) {
      if (!hasRaceRules && worldSys.raceRestriction?.races) {
        sys.raceRestriction = add2eDeepClone(worldSys.raceRestriction);
      }
      if (!hasReqTags && add2eToEquipArray(worldSys.requirementTags).length) {
        sys.requirementTags = add2eDeepClone(worldSys.requirementTags);
      }
      for (const field of ["alignment", "alignements_autorises", "caracs_min"]) {
        if (!add2eHasUsefulValue(sys[field]) && add2eHasUsefulValue(worldSys[field])) {
          sys[field] = add2eDeepClone(worldSys[field]);
        }
      }
    }
  }

  return sys;
}

function add2eClassAllowedAlignments(classeSystem) {
  return add2eToEquipArray(
    classeSystem?.alignements_autorises ??
    classeSystem?.alignment ??
    []
  ).filter(Boolean);
}

function add2ePickClassAlignment(actor, classeSystem) {
  const allowed = add2eClassAllowedAlignments(classeSystem);
  if (!allowed.length) return actor?.system?.alignement ?? "";

  const current = add2eNormalizeEquipTag(actor?.system?.alignement ?? "");
  const allowedNorm = allowed.map(add2eNormalizeEquipTag);

  if (current && allowedNorm.includes(current)) return actor.system.alignement;
  return allowed[0];
}

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eUiEscapeHtml = add2eUiEscapeHtml; } catch (_e) {}
try { globalThis.add2eUiNormalizeText = add2eUiNormalizeText; } catch (_e) {}
try { globalThis.add2eUiGetSpellSlotsByLevel = add2eUiGetSpellSlotsByLevel; } catch (_e) {}
try { globalThis.add2eUiGetSpellPoolsByLevel = add2eUiGetSpellPoolsByLevel; } catch (_e) {}
try { globalThis.add2eUiGetMemorizedSpellsByLevel = add2eUiGetMemorizedSpellsByLevel; } catch (_e) {}
try { globalThis.add2eUiFormatDuration = add2eUiFormatDuration; } catch (_e) {}
try { globalThis.add2eUiBuildEffectsTab = add2eUiBuildEffectsTab; } catch (_e) {}
try { globalThis.add2eUiFeatureName = add2eUiFeatureName; } catch (_e) {}
try { globalThis.add2eUiAllClassFeatures = add2eUiAllClassFeatures; } catch (_e) {}
try { globalThis.add2eUiGetThiefSkills = add2eUiGetThiefSkills; } catch (_e) {}
try { globalThis.add2eUiBuildThiefSkillsPanel = add2eUiBuildThiefSkillsPanel; } catch (_e) {}
try { globalThis.add2eUiInjectCapacitesTab = add2eUiInjectCapacitesTab; } catch (_e) {}
try { globalThis.add2eEnhanceCharacterSheetUi = add2eEnhanceCharacterSheetUi; } catch (_e) {}
try { globalThis.add2eRegisterImgPicker = add2eRegisterImgPicker; } catch (_e) {}
try { globalThis.canCastSpell = canCastSpell; } catch (_e) {}
try { globalThis.add2eRaceTagsFromData = add2eRaceTagsFromData; } catch (_e) {}
try { globalThis.add2eClassRuleSystem = add2eClassRuleSystem; } catch (_e) {}
try { globalThis.add2eClassAllowedAlignments = add2eClassAllowedAlignments; } catch (_e) {}
try { globalThis.add2ePickClassAlignment = add2ePickClassAlignment; } catch (_e) {}
try { globalThis.ADD2E_CHARACTER_SHEET_UI_VERSION = ADD2E_CHARACTER_SHEET_UI_VERSION; } catch (_e) {}
