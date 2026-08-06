// ADD2E — Affichage détaillé des monstres
// Version : 2026-08-06-adnd2e-monster-morale-v11
// But : séparer les capacités informatives MJ des effets système activables, gérer le moral AD&D 2e et permettre au MJ de composer manuellement les sorts préparés.
// Foundry V13/V14/V15 : ApplicationV2 / DialogV2 uniquement.

const ADD2E_MONSTER_CAPABILITIES_VERSION = "2026-08-06-adnd2e-monster-morale-v11";
const ADD2E_MONSTER_SPELL_PACK = "add2e.sorts";
globalThis.ADD2E_MONSTER_CAPABILITIES_VERSION = ADD2E_MONSTER_CAPABILITIES_VERSION;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    const numeric = Object.keys(value)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]);
    if (numeric.length) return numeric;
    return Object.values(value).filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  }
  return [];
}

function monsterCaps(system) {
  return toArray(system?.capacites_monstre).map(cap => {
    if (!cap || typeof cap !== "object") return { type: "note_mj", name: "Note", description: String(cap ?? ""), tags: [], affichage: "mj" };
    const tags = toArray(cap.tags ?? cap.effectTags);
    const text = norm(`${cap.name ?? ""} ${cap.type ?? ""} ${cap.description ?? ""} ${tags.join(" ")}`);
    const explicitSystem = cap.affichage === "systeme" || cap.mechanical === true || cap.systemEffect === true;
    const mechanical = explicitSystem || text.includes("bonus_attaque") || text.includes("lumiere_du_jour") || text.includes("lumiere_vive");
    return {
      type: String(cap.type ?? "capacité"),
      name: String(cap.name ?? cap.nom ?? "Capacité"),
      description: String(cap.description ?? cap.desc ?? ""),
      activation: String(cap.activation ?? ""),
      effet_systeme: String(cap.effet_systeme ?? cap.systemEffectText ?? ""),
      tags,
      affichage: mechanical ? "systeme" : "mj"
    };
  });
}

function badges(tags, cls = "") {
  const values = toArray(tags);
  if (!values.length) return "";
  return `<div class="add2e-monster-badges">${values.map(t => `<span class="add2e-monster-badge ${cls}">${esc(t)}</span>`).join("")}</div>`;
}

function infoCard(label, value) {
  return `<div class="add2e-monster-info"><b>${esc(label)}</b><span>${esc(value || "—")}</span></div>`;
}

function capCard(cap, system = false) {
  return `
    <div class="add2e-monster-cap-card ${system ? "system" : "mj"}">
      <div class="add2e-monster-cap-head">
        <strong>${esc(cap.name)}</strong>
        <span>${system ? "Effet système" : esc(cap.type)}</span>
      </div>
      ${cap.description ? `<p>${esc(cap.description)}</p>` : ""}
      ${cap.activation ? `<p><b>Activation :</b> ${esc(cap.activation)}</p>` : ""}
      ${cap.effet_systeme ? `<p><b>Règle appliquée :</b> ${esc(cap.effet_systeme)}</p>` : ""}
      ${badges(cap.tags, system ? "bad" : "")}
    </div>`;
}

function canonicalMoraleBase(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 2 && score <= 20 ? score : null;
}

function moraleRatingLabel(score) {
  if (!Number.isFinite(score)) return "—";
  if (score <= 4) return "Instable";
  if (score <= 7) return "Agité";
  if (score <= 10) return "Moyen";
  if (score <= 12) return "Stable";
  if (score <= 14) return "Élite";
  if (score <= 16) return "Champion";
  if (score <= 18) return "Fanatique";
  return "Sans peur";
}

function monsterMoraleEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.resolve !== "function" || typeof engine?.collect !== "function" || typeof engine?.createModifier !== "function") {
    throw new Error("Le résolveur canonique ADD2E du moral n’est pas disponible.");
  }
  return engine;
}

function moraleSituationModifier(engine, actor, id, label, value) {
  return engine.createModifier({
    id: `${actor.id}:monster-morale:${id}`,
    domain: "morale",
    target: "score",
    operation: "add",
    value,
    priority: 1000,
    stacking: { mode: "stack", group: null },
    conditions: {},
    source: {
      kind: "context",
      id: `monster-morale:${id}`,
      uuid: actor.uuid ?? "",
      name: label
    },
    metadata: { transient: true, moraleSituation: true }
  });
}

function monsterMoraleSituationModifiers(engine, actor, context = {}) {
  const conditions = context?.conditions ?? context ?? {};
  const modifiers = [];
  const add = (id, label, value) => modifiers.push(moraleSituationModifier(engine, actor, id, label, value));

  const losses = Math.max(0, Number(conditions.losses) || 0);
  if (losses >= 50) add("losses-50", "Pertes de 50 %", -4);
  else if (losses >= 25) add("losses-25", "Pertes de 25 %", -2);

  if (conditions.abandoned === true) add("abandoned", "Abandonné par ses alliés", -6);
  if (conditions.hatedEnemy === true) add("hated-enemy", "Ennemi haï", 4);
  if (conditions.surprised === true) add("surprised", "Surpris", -2);
  if (conditions.fightingMagicUsers === true) add("enemy-magic", "Magie ennemie", -2);
  if (conditions.defendingHome === true) add("defending-home", "Défend son foyer", 3);
  if (conditions.defensiveTerrain === true) add("defensive-terrain", "Terrain favorable", 1);
  if (conditions.leaderDifferentAlignment === true) add("leader-alignment", "Chef d’un autre alignement", -1);
  if (conditions.mostPowerfulAllyKilled === true) add("powerful-ally-killed", "Allié principal tué", -4);
  if (conditions.favored === true) add("favored", "Bien traité", 2);
  if (conditions.poorlyTreated === true) add("poorly-treated", "Mal traité", -4);
  if (conditions.noEnemySlain === true) add("no-enemy-slain", "Aucun ennemi vaincu", -2);
  if (conditions.outnumberedThreeToOne === true) add("outnumbered", "Infériorité de trois contre un", -4);
  if (conditions.outnumbersThreeToOne === true) add("outnumbers", "Supériorité de trois contre un", 2);
  if (conditions.unableToAffectOpponent === true) add("unable-to-affect", "Adversaire impossible à blesser", -8);
  if (conditions.alliedMagicUser === true) add("allied-magic", "Magie alliée", 2);

  const additionalChecks = Math.max(0, Math.floor(Number(conditions.additionalChecks) || 0));
  if (additionalChecks > 0) add("additional-checks", "Tests supplémentaires ce round", -additionalChecks);
  return modifiers;
}

function resolveMonsterMorale(actor, context = {}) {
  const base = canonicalMoraleBase(actor?.system?.morale);
  if (!Number.isFinite(base)) {
    return {
      ok: false,
      reason: "invalid-base",
      base: null,
      total: null,
      adjustment: 0,
      label: "—",
      display: "—",
      resolution: null
    };
  }

  const engine = monsterMoraleEngine();
  const resolutionContext = {
    ...context,
    actor,
    type: "monster-morale",
    actionType: "morale",
    moraleTarget: "score",
    scope: context.scope === "individual" ? "individual" : "group",
    source: context.source ?? "monster-sheet-capabilities",
    consumer: context.consumer ?? "application-v2"
  };
  const modifiers = [
    ...engine.collect(actor, resolutionContext),
    ...monsterMoraleSituationModifiers(engine, actor, context)
  ];
  const resolution = engine.resolve(actor, {
    domain: "morale",
    target: "score",
    base,
    rounding: "round",
    modifiers,
    context: resolutionContext
  });
  const total = Number(resolution?.total);
  if (!Number.isFinite(total)) throw new Error("La résolution canonique du moral a renvoyé une valeur invalide.");
  const adjustment = total - base;
  return {
    ok: true,
    reason: "resolved",
    base,
    total,
    adjustment,
    label: moraleRatingLabel(base),
    display: adjustment === 0 ? `${base} — ${moraleRatingLabel(base)}` : `${total} (base ${base})`,
    resolution,
    context: resolutionContext
  };
}

function monsterMoraleResult(success, margin, context = {}) {
  if (success) return "Tient bon.";
  if (context?.conditions?.noEscape === true) return "Se rend.";
  if (margin <= 2) return "Se replie.";
  return "Prend la fuite.";
}

async function rollMonsterMorale(actor, context = {}) {
  if (!actor) return { ok: false, reason: "missing-actor" };
  if (!game.user?.isGM && !actor.isOwner && !actor.testUserPermission?.(game.user, "OWNER")) {
    ui.notifications?.warn?.("Vous ne pouvez pas tester le moral de cet acteur.");
    return { ok: false, reason: "permission-denied" };
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Les cartes ADD2E sont indisponibles.");
    return { ok: false, reason: "chat-card-unavailable" };
  }

  const morale = resolveMonsterMorale(actor, context);
  if (!morale.ok) {
    ui.notifications?.warn?.("Le score de moral doit être compris entre 2 et 20.");
    return morale;
  }

  const roll = await new Roll("2d10").evaluate();
  const total = Number(roll.total);
  if (!Number.isFinite(total)) return { ok: false, reason: "invalid-roll", morale, roll };
  const success = total <= morale.total;
  const margin = Math.max(0, total - morale.total);
  const result = monsterMoraleResult(success, margin, context);
  const applied = (morale.resolution?.applied ?? []).map(modifier => ({
    id: modifier.id,
    value: Number(modifier.value),
    source: String(modifier.source?.name ?? "")
  }));

  const card = {
    actor,
    title: `Test de moral — ${success ? "Réussite" : "Échec"}`,
    icon: `fas ${success ? "fa-shield" : "fa-person-running"}`,
    variant: success ? "success" : "failure",
    source: {
      name: actor.name,
      img: actor.img,
      type: context.scope === "individual" ? "Moral individuel" : "Moral du groupe"
    },
    rows: [
      { label: "Jet", value: `${total} / ${morale.total}` },
      { label: "Résultat", value: result }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      flags: {
        add2e: {
          monsterMorale: {
            actorId: actor.id,
            scope: context.scope === "individual" ? "individual" : "group",
            base: morale.base,
            score: morale.total,
            adjustment: morale.adjustment,
            roll: total,
            success,
            margin,
            result,
            conditions: foundry.utils.deepClone(context.conditions ?? {}),
            applied
          }
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  const message = await globalThis.add2eCreateChatCard(card);
  return { ok: true, morale, roll, total, success, margin, result, message };
}

function moraleCheckbox(name, label, modifier) {
  const sign = modifier > 0 ? `+${modifier}` : String(modifier);
  return `<label class="add2e-monster-morale-option"><input type="checkbox" name="${name}"><span>${label}</span><b>${sign}</b></label>`;
}

async function promptMonsterMorale(actor) {
  const base = canonicalMoraleBase(actor?.system?.morale);
  if (!Number.isFinite(base)) {
    ui.notifications?.warn?.("Le score de moral doit être compris entre 2 et 20.");
    return false;
  }
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }

  const result = await globalThis.add2eDialogWait({
    add2eTheme: "monster",
    add2ePrimaryAction: "roll",
    add2eClasses: ["add2e-monster-morale-window"],
    window: {
      title: `Moral — ${actor.name}`
    },
    content: `
      <form class="add2e-monster-morale-form">
        <div class="add2e-monster-morale-summary"><b>${esc(actor.name)}</b><span>Moral ${base} — ${moraleRatingLabel(base)}</span></div>
        <div class="add2e-monster-morale-grid">
          <label><span>Test</span><select name="scope"><option value="group">Groupe</option><option value="individual">Individu</option></select></label>
          <label><span>Pertes</span><select name="losses"><option value="0">Aucune</option><option value="25">25 % (-2)</option><option value="50">50 % (-4)</option></select></label>
          <label><span>Autres tests ce round</span><input type="number" name="additionalChecks" min="0" step="1" value="0"></label>
        </div>
        <div class="add2e-monster-morale-columns">
          <fieldset><legend>Défavorables</legend>
            ${moraleCheckbox("abandoned", "Abandonné", -6)}
            ${moraleCheckbox("surprised", "Surpris", -2)}
            ${moraleCheckbox("fightingMagicUsers", "Magie ennemie", -2)}
            ${moraleCheckbox("leaderDifferentAlignment", "Chef d’un autre alignement", -1)}
            ${moraleCheckbox("mostPowerfulAllyKilled", "Allié principal tué", -4)}
            ${moraleCheckbox("poorlyTreated", "Mal traité", -4)}
            ${moraleCheckbox("noEnemySlain", "Aucun ennemi vaincu", -2)}
            ${moraleCheckbox("outnumberedThreeToOne", "Infériorité de 3 contre 1", -4)}
            ${moraleCheckbox("unableToAffectOpponent", "Adversaire invulnérable", -8)}
          </fieldset>
          <fieldset><legend>Favorables</legend>
            ${moraleCheckbox("hatedEnemy", "Ennemi haï", 4)}
            ${moraleCheckbox("defendingHome", "Défend son foyer", 3)}
            ${moraleCheckbox("defensiveTerrain", "Terrain favorable", 1)}
            ${moraleCheckbox("favored", "Bien traité", 2)}
            ${moraleCheckbox("outnumbersThreeToOne", "Supériorité de 3 contre 1", 2)}
            ${moraleCheckbox("alliedMagicUser", "Magie alliée", 2)}
            <label class="add2e-monster-morale-option"><input type="checkbox" name="noEscape"><span>Aucune fuite possible</span><b>Issue</b></label>
          </fieldset>
        </div>
      </form>`,
    buttons: [
      {
        action: "roll",
        label: "Lancer",
        icon: "<i class='fas fa-dice'></i>",
        default: true,
        callback: (_event, button) => {
          const form = button?.form;
          const checked = name => form?.elements?.[name]?.checked === true;
          return {
            scope: String(form?.elements?.scope?.value ?? "group"),
            conditions: {
              losses: Number(form?.elements?.losses?.value ?? 0),
              additionalChecks: Math.max(0, Math.floor(Number(form?.elements?.additionalChecks?.value) || 0)),
              abandoned: checked("abandoned"),
              hatedEnemy: checked("hatedEnemy"),
              surprised: checked("surprised"),
              fightingMagicUsers: checked("fightingMagicUsers"),
              defendingHome: checked("defendingHome"),
              defensiveTerrain: checked("defensiveTerrain"),
              leaderDifferentAlignment: checked("leaderDifferentAlignment"),
              mostPowerfulAllyKilled: checked("mostPowerfulAllyKilled"),
              favored: checked("favored"),
              poorlyTreated: checked("poorlyTreated"),
              noEnemySlain: checked("noEnemySlain"),
              outnumberedThreeToOne: checked("outnumberedThreeToOne"),
              outnumbersThreeToOne: checked("outnumbersThreeToOne"),
              unableToAffectOpponent: checked("unableToAffectOpponent"),
              alliedMagicUser: checked("alliedMagicUser"),
              noEscape: checked("noEscape")
            }
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
  if (!result) return false;
  return rollMonsterMorale(actor, {
    ...result,
    source: "monster-sheet-morale-roll",
    consumer: "application-v2"
  });
}

globalThis.add2eResolveMonsterMorale = resolveMonsterMorale;
globalThis.add2eRollMonsterMorale = rollMonsterMorale;
globalThis.add2ePromptMonsterMorale = promptMonsterMorale;

function monsterSpellProfile(actor) {
  const profile = actor?.system?.spellcasting;
  return profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
}

function monsterSpellEntries(profile) {
  const explicitEntries = Array.isArray(profile?.entries)
    ? profile.entries.filter(entry => entry && typeof entry === "object")
    : [];
  if (explicitEntries.length) {
    return explicitEntries.map(entry => ({
      lists: toArray(entry.lists ?? entry.list).map(norm).filter(Boolean),
      maxSpellLevel: Number.isFinite(Number(entry.maxSpellLevel)) && Number(entry.maxSpellLevel) > 0
        ? Number(entry.maxSpellLevel)
        : null
    }));
  }
  return [{
    lists: toArray(profile?.lists).map(norm).filter(Boolean),
    maxSpellLevel: Number.isFinite(Number(profile?.maxSpellLevel)) && Number(profile.maxSpellLevel) > 0
      ? Number(profile.maxSpellLevel)
      : null
  }];
}

function monsterSpellLevel(spell) {
  const level = Number(spell?.system?.niveau);
  return Number.isFinite(level) && level > 0 ? level : 0;
}

function monsterSpellLists(spell) {
  return toArray(spell?.system?.spellLists).map(norm).filter(Boolean);
}

function monsterSpellSelectionState(actor) {
  const profile = monsterSpellProfile(actor);
  if (profile.enabled !== true) {
    return { ok: false, profile, message: "Aucun profil de lanceur de sorts n’est activé dans le JSON de ce monstre." };
  }
  if (profile.usesPreparation !== true) {
    return { ok: false, profile, message: "Ce profil n’utilise pas la préparation. Ses pouvoirs doivent rester déclarés dans le JSON." };
  }
  return { ok: true, profile, message: "" };
}

function monsterSpellAllowed(actor, spell) {
  const state = monsterSpellSelectionState(actor);
  if (!state.ok) return state;
  if (String(spell?.type ?? "").toLowerCase() !== "sort") {
    return { ok: false, profile: state.profile, message: "Seuls les objets de type sort peuvent être ajoutés." };
  }

  const level = monsterSpellLevel(spell);
  if (level <= 0) {
    return { ok: false, profile: state.profile, message: `Le niveau canonique du sort « ${spell?.name ?? "inconnu"} » est absent.` };
  }

  const lists = monsterSpellLists(spell);
  const allowed = monsterSpellEntries(state.profile).some(entry => {
    if (entry.maxSpellLevel && level > entry.maxSpellLevel) return false;
    if (!entry.lists.length) return true;
    return lists.some(list => entry.lists.includes(list));
  });

  if (!allowed) {
    const profileLists = monsterSpellEntries(state.profile).flatMap(entry => entry.lists);
    const maxLevels = monsterSpellEntries(state.profile).map(entry => entry.maxSpellLevel).filter(Boolean);
    const details = [
      profileLists.length ? `listes autorisées : ${[...new Set(profileLists)].join(", ")}` : "",
      maxLevels.length ? `niveau maximal : ${Math.max(...maxLevels)}` : ""
    ].filter(Boolean).join(" ; ");
    return {
      ok: false,
      profile: state.profile,
      message: `Le sort « ${spell.name} » ne respecte pas le profil déclaré${details ? ` (${details})` : ""}.`
    };
  }

  return { ok: true, profile: state.profile, message: "", level, lists };
}

function monsterAlreadyHasSpell(actor, spell) {
  const name = norm(spell?.name);
  const level = monsterSpellLevel(spell);
  const sourceUuid = String(spell?.uuid ?? "").trim();
  return actor?.items?.some?.(item => {
    if (String(item?.type ?? "").toLowerCase() !== "sort") return false;
    const itemSource = String(item?.flags?.core?.sourceId ?? item?.flags?.add2e?.monsterSpellSelection?.sourceUuid ?? "").trim();
    if (sourceUuid && itemSource && itemSource === sourceUuid) return true;
    return norm(item?.name) === name && monsterSpellLevel(item) === level;
  }) ?? false;
}

function monsterSpellLevelLimit(profile, level) {
  const sources = [profile?.spellsPerLevel, profile?.slotsByLevel];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const raw = source[level] ?? source[String(level)];
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function monsterPreparedTotal(actor, level) {
  return actor?.items?.filter?.(item => String(item?.type ?? "").toLowerCase() === "sort" && monsterSpellLevel(item) === level)
    .reduce((sum, item) => sum + Math.max(0, Number(item?.flags?.add2e?.memorizedCount) || 0), 0) ?? 0;
}

async function importMonsterSpell(actor, spell, { memorized = 1, method = "manual" } = {}) {
  if (!game.user?.isGM) {
    ui.notifications.warn("Seul le MJ peut modifier le répertoire de sorts d’un monstre.");
    return false;
  }

  const check = monsterSpellAllowed(actor, spell);
  if (!check.ok) {
    ui.notifications.warn(check.message);
    return false;
  }
  if (monsterAlreadyHasSpell(actor, spell)) {
    ui.notifications.warn(`« ${spell.name} » est déjà présent sur ${actor.name}.`);
    return false;
  }

  const level = check.level;
  const count = Math.max(0, Math.floor(Number(memorized) || 0));
  const limit = monsterSpellLevelLimit(check.profile, level);
  const currentTotal = monsterPreparedTotal(actor, level);
  if (limit !== null && currentTotal + count > limit) {
    ui.notifications.warn(`Limite dépassée au niveau ${level} : ${currentTotal + count}/${limit}.`);
    return false;
  }

  const data = spell.toObject();
  delete data._id;
  delete data.folder;
  data.flags = data.flags ?? {};
  data.flags.core = data.flags.core ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.core.sourceId = spell.uuid;
  data.flags.add2e.memorizedCount = count;
  data.flags.add2e.monsterSpellSelection = {
    method,
    sourceUuid: spell.uuid,
    selectedAt: new Date().toISOString(),
    selectedBy: game.user.id,
    version: ADD2E_MONSTER_CAPABILITIES_VERSION
  };

  await actor.createEmbeddedDocuments("Item", [data], {
    add2eMonsterSpellSelection: true,
    render: false
  });
  ui.notifications.info(`${spell.name} ajouté à ${actor.name}.`);
  return true;
}

async function monsterSpellPackCandidates(actor) {
  const pack = game.packs.get(ADD2E_MONSTER_SPELL_PACK);
  if (!pack) throw new Error(`Compendium introuvable : ${ADD2E_MONSTER_SPELL_PACK}`);

  const index = Array.from(await pack.getIndex({
    fields: ["name", "type", "img", "system.niveau", "system.spellLists"]
  }) ?? []);

  return index
    .filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")
    .filter(entry => monsterSpellAllowed(actor, entry).ok)
    .filter(entry => !monsterAlreadyHasSpell(actor, entry))
    .sort((a, b) => monsterSpellLevel(a) - monsterSpellLevel(b) || String(a.name).localeCompare(String(b.name), "fr"));
}

function monsterSpellOptions(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const level = monsterSpellLevel(candidate);
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(candidate);
  }

  return [...groups.entries()].map(([level, entries]) => {
    const options = entries.map(entry => {
      const lists = monsterSpellLists(entry);
      const suffix = lists.length ? ` — ${lists.join(", ")}` : "";
      return `<option value="${esc(entry._id)}">${esc(entry.name)}${esc(suffix)}</option>`;
    }).join("");
    return `<optgroup label="Niveau ${level}">${options}</optgroup>`;
  }).join("");
}

async function openMonsterSpellPicker(app, actor) {
  const state = monsterSpellSelectionState(actor);
  if (!state.ok) {
    ui.notifications.warn(state.message);
    return false;
  }

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2 || typeof DialogV2.wait !== "function") {
    throw new Error("DialogV2 est indisponible.");
  }

  const candidates = await monsterSpellPackCandidates(actor);
  if (!candidates.length) {
    ui.notifications.warn("Aucun sort compatible restant dans le compendium add2e.sorts.");
    return false;
  }

  const result = await DialogV2.wait({
    window: {
      title: `Ajouter un sort — ${actor.name}`,
      classes: ["add2e-monster-spell-picker-window"]
    },
    content: `
      <form class="add2e-monster-spell-picker-form">
        <div class="form-group">
          <label for="add2e-monster-spell-choice"><b>Sort du compendium</b></label>
          <select id="add2e-monster-spell-choice" name="spellId" required style="width:100%">${monsterSpellOptions(candidates)}</select>
        </div>
        <div class="form-group" style="margin-top:10px">
          <label for="add2e-monster-spell-count"><b>Exemplaires mémorisés</b></label>
          <input id="add2e-monster-spell-count" type="number" name="memorized" min="0" step="1" value="1" style="width:100%"/>
        </div>
        <p class="hint" style="margin-top:10px">La sélection respecte uniquement les listes et niveaux explicitement déclarés dans system.spellcasting.</p>
      </form>`,
    buttons: [
      {
        action: "add",
        label: "Ajouter",
        icon: "<i class='fas fa-plus'></i>",
        default: true,
        callback: (_event, button) => ({
          spellId: String(button?.form?.elements?.spellId?.value ?? ""),
          memorized: Math.max(0, Math.floor(Number(button?.form?.elements?.memorized?.value) || 0))
        })
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

  if (!result?.spellId) return false;
  const pack = game.packs.get(ADD2E_MONSTER_SPELL_PACK);
  const spell = await pack?.getDocument(result.spellId);
  if (!spell) {
    ui.notifications.error("Le sort sélectionné est introuvable dans le compendium.");
    return false;
  }

  const imported = await importMonsterSpell(actor, spell, {
    memorized: result.memorized,
    method: "compendium-picker"
  });
  if (imported) app?.render?.(false);
  return imported;
}

function readMonsterDropData(event) {
  const original = event?.originalEvent ?? event;
  const TextEditorImpl = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor ?? null;
  if (typeof TextEditorImpl?.getDragEventData === "function") {
    return TextEditorImpl.getDragEventData(original);
  }
  const raw = original?.dataTransfer?.getData?.("text/plain");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_error) { return {}; }
}

async function resolveMonsterDroppedItem(data) {
  const uuid = String(data?.uuid ?? "").trim();
  if (uuid) {
    const resolver = foundry.utils?.fromUuid ?? globalThis.fromUuid;
    if (typeof resolver === "function") return resolver(uuid);
  }

  const id = String(data?._id ?? data?.id ?? "").trim();
  const packId = String(data?.pack ?? "").trim();
  if (packId && id) return game.packs.get(packId)?.getDocument(id) ?? null;
  if (id) return game.items?.get(id) ?? null;
  return null;
}

function monsterSpellProfileLabel(profile) {
  const entries = monsterSpellEntries(profile);
  const lists = [...new Set(entries.flatMap(entry => entry.lists))];
  const levels = entries.map(entry => entry.maxSpellLevel).filter(Boolean);
  const values = [
    lists.length ? `Listes : ${lists.join(", ")}` : "Listes : choix MJ",
    levels.length ? `Niveau maximal : ${Math.max(...levels)}` : "Niveau maximal : non précisé",
    profile?.casterLevel ? `Niveau de lanceur : ${profile.casterLevel}` : ""
  ].filter(Boolean);
  return values.join(" · ");
}

function buildMonsterSpellLibrary(actor) {
  if (!game.user?.isGM) return "";
  const state = monsterSpellSelectionState(actor);
  const profileLabel = state.profile?.enabled === true
    ? monsterSpellProfileLabel(state.profile)
    : "Aucun profil de lanceur actif";
  const disabled = state.ok ? "" : "disabled";
  const disabledClass = state.ok ? "" : "is-disabled";

  return `
    <section class="add2e-monster-panel add2e-monster-spell-library ${disabledClass}">
      <h2><i class="fas fa-book-sparkles"></i> Répertoire de sorts du monstre</h2>
      <div class="add2e-monster-panel-body">
        <div class="add2e-monster-spell-profile">${esc(profileLabel)}</div>
        <div class="add2e-monster-spell-actions">
          <button type="button" class="add2e-monster-spell-picker" ${disabled}><i class="fas fa-list"></i> Choisir dans add2e.sorts</button>
          <div class="add2e-monster-spell-dropzone" data-disabled="${state.ok ? "0" : "1"}" tabindex="0">
            <i class="fas fa-cloud-arrow-down"></i>
            <span>Déposer ici un sort du monde ou d’un compendium</span>
          </div>
        </div>
        ${state.ok ? "" : `<p class="add2e-monster-note">${esc(state.message)}</p>`}
      </div>
    </section>`;
}

function bindMonsterMemorizationControls(app, $html, actor) {
  const profile = monsterSpellProfile(actor);
  const magicTab = $html.find('.sheet-body .tab[data-tab="magie"]');
  if (!magicTab.length) return;

  magicTab.find(".sort-memorize-plus, .sort-memorize-minus").each((_index, element) => {
    const $element = $(element);
    const sortId = String($element.data("sortId") ?? "");
    const sort = actor.items.get(sortId);
    const cell = $element.closest("td");

    if (!sort) {
      cell.html('<span class="add2e-monster-power-label">Pouvoir</span>');
      return;
    }

    const plus = $element.hasClass("sort-memorize-plus");
    const clone = element.cloneNode(true);
    clone.classList.remove("sort-memorize-plus", "sort-memorize-minus");
    clone.classList.add(plus ? "add2e-monster-spell-plus" : "add2e-monster-spell-minus");
    clone.removeAttribute("data-add2e-prep-bound");
    element.replaceWith(clone);
  });

  $html.off("click.add2e-monster-spell-count").on("click.add2e-monster-spell-count", ".add2e-monster-spell-plus, .add2e-monster-spell-minus", async event => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const sort = actor.items.get(String(button.dataset.sortId ?? ""));
    if (!sort) return;

    const current = Math.max(0, Number(sort.flags?.add2e?.memorizedCount) || 0);
    const level = monsterSpellLevel(sort);
    const isPlus = button.classList.contains("add2e-monster-spell-plus");
    const next = isPlus ? current + 1 : Math.max(0, current - 1);
    const limit = monsterSpellLevelLimit(profile, level);
    const total = monsterPreparedTotal(actor, level);

    if (isPlus && limit !== null && total >= limit) {
      ui.notifications.warn(`Limite atteinte au niveau ${level} : ${total}/${limit}.`);
      return;
    }

    await sort.setFlag("add2e", "memorizedCount", next);
    app?.render?.(false);
  });

  magicTab.find(".spell-level-header").each((_index, header) => {
    const match = String(header.textContent ?? "").match(/Niveau\s+(\d+)/i);
    const level = Number(match?.[1] ?? 0);
    if (!level) return;
    const total = monsterPreparedTotal(actor, level);
    const limit = monsterSpellLevelLimit(profile, level);
    const counter = header.querySelector("span:last-child");
    if (counter) counter.textContent = limit === null ? `Mémorisé : ${total}` : `Mémorisé : ${total}/${limit}`;
  });
}

function bindMonsterSpellLibrary(app, $html, actor) {
  const magicTab = $html.find('.sheet-body .tab[data-tab="magie"]');
  if (!magicTab.length) return;

  magicTab.find(".add2e-monster-spell-library").remove();
  const panel = buildMonsterSpellLibrary(actor);
  if (panel) magicTab.prepend(panel);

  bindMonsterMemorizationControls(app, $html, actor);

  $html.off("click.add2e-monster-spell-picker").on("click.add2e-monster-spell-picker", ".add2e-monster-spell-picker", async event => {
    event.preventDefault();
    try {
      await openMonsterSpellPicker(app, actor);
    } catch (error) {
      console.error("[ADD2E][MONSTER_SPELLS][PICKER]", error);
      ui.notifications.error("Impossible d’ouvrir la sélection de sorts du monstre.");
    }
  });

  $html.off("dragover.add2e-monster-spell-drop").on("dragover.add2e-monster-spell-drop", ".add2e-monster-spell-dropzone", event => {
    event.preventDefault();
    const zone = event.currentTarget;
    if (zone.dataset.disabled === "1") return;
    zone.classList.add("is-dragover");
    const original = event.originalEvent ?? event;
    if (original.dataTransfer) original.dataTransfer.dropEffect = "copy";
  });

  $html.off("dragleave.add2e-monster-spell-drop").on("dragleave.add2e-monster-spell-drop", ".add2e-monster-spell-dropzone", event => {
    event.currentTarget.classList.remove("is-dragover");
  });

  $html.off("drop.add2e-monster-spell-drop").on("drop.add2e-monster-spell-drop", ".add2e-monster-spell-dropzone", async event => {
    event.preventDefault();
    event.stopPropagation();
    const zone = event.currentTarget;
    zone.classList.remove("is-dragover");
    if (zone.dataset.disabled === "1") {
      ui.notifications.warn(monsterSpellSelectionState(actor).message);
      return;
    }

    try {
      const data = readMonsterDropData(event);
      const item = await resolveMonsterDroppedItem(data);
      if (!item) {
        ui.notifications.warn("Objet déposé introuvable.");
        return;
      }
      const imported = await importMonsterSpell(actor, item, {
        memorized: 1,
        method: "drag-drop"
      });
      if (imported) app?.render?.(false);
    } catch (error) {
      console.error("[ADD2E][MONSTER_SPELLS][DROP]", error);
      ui.notifications.error("Impossible d’ajouter le sort déposé.");
    }
  });
}

function bindMonsterMoraleControl(app, $html, actor) {
  const input = $html.find('input[name="system.morale"]').first();
  if (!input.length) return;
  const group = input.closest(".form-group");
  if (group.length && !group.find(".add2e-monster-morale-control").length) {
    input.wrap('<div class="add2e-monster-morale-control"></div>');
    input.after('<button type="button" class="add2e-monster-morale-roll" title="Tester le moral"><i class="fas fa-flag"></i> Tester</button>');
  }

  $html.off("click.add2e-monster-morale").on("click.add2e-monster-morale", ".add2e-monster-morale-roll", async event => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await promptMonsterMorale(actor);
    } catch (error) {
      console.error("[ADD2E][MONSTER_MORALE][ROLL]", error);
      ui.notifications?.error?.("Le test de moral n’a pas pu être lancé.");
    }
  });
}

function installStyles() {
  const id = "add2e-monster-capabilities-style";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .add2e.sheet.monster .monster-extra-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .add2e.sheet.monster .add2e-monster-panel { background:rgba(255,252,239,.96); border:1px solid #d9bf73; border-radius:9px; margin-bottom:10px; overflow:hidden; }
    .add2e.sheet.monster .add2e-monster-panel h2, .add2e.sheet.monster .add2e-monster-panel h3 { margin:0; padding:8px 10px; background:rgba(240,224,169,.68); border-bottom:1px solid #d9bf73; color:#6f4b12; font-weight:900; font-size:1.02rem; }
    .add2e.sheet.monster .add2e-monster-panel-body { padding:10px; }
    .add2e.sheet.monster .add2e-monster-info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .add2e.sheet.monster .add2e-monster-info { border:1px solid #dcc782; border-radius:7px; background:#fffdf4; padding:7px; min-height:44px; }
    .add2e.sheet.monster .add2e-monster-info b { display:block; color:#6f4b12; font-size:.8rem; text-transform:uppercase; margin-bottom:2px; }
    .add2e.sheet.monster .add2e-monster-cap-card { border:1px solid #dcc782; border-radius:8px; background:#fffdf4; padding:9px; margin-bottom:8px; }
    .add2e.sheet.monster .add2e-monster-cap-card.system { border-color:#ca8a8a; background:#fff7f2; }
    .add2e.sheet.monster .add2e-monster-cap-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:5px; }
    .add2e.sheet.monster .add2e-monster-cap-head strong { color:#3d2b0a; }
    .add2e.sheet.monster .add2e-monster-cap-head span { border:1px solid #d6bd70; background:#fff8df; color:#55390d; border-radius:999px; padding:2px 7px; font-size:.78rem; font-weight:900; white-space:nowrap; }
    .add2e.sheet.monster .add2e-monster-cap-card.system .add2e-monster-cap-head span { border-color:#ca8a8a; background:#fff0ec; color:#8a1f18; }
    .add2e.sheet.monster .add2e-monster-cap-card p { margin:.25rem 0; }
    .add2e.sheet.monster .add2e-monster-badges { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
    .add2e.sheet.monster .add2e-monster-badge { display:inline-flex; align-items:center; padding:3px 6px; border-radius:999px; border:1px solid #d6bd70; background:#fff8df; color:#55390d; font-weight:700; font-size:.78rem; }
    .add2e.sheet.monster .add2e-monster-badge.bad { border-color:#ca8a8a; background:#fff0ec; color:#8a1f18; }
    .add2e.sheet.monster .add2e-monster-note { color:#7f704d; font-style:italic; }
    .add2e.sheet.monster .add2e-monster-spell-profile { margin-bottom:8px; color:#55390d; font-weight:800; }
    .add2e.sheet.monster .add2e-monster-spell-actions { display:grid; grid-template-columns:minmax(190px,auto) 1fr; gap:10px; align-items:stretch; }
    .add2e.sheet.monster .add2e-monster-spell-picker { border:1px solid #6f4b12; border-radius:7px; background:linear-gradient(180deg,#fff8df,#ead99d); color:#3d2b0a; font-weight:900; padding:8px 10px; cursor:pointer; }
    .add2e.sheet.monster .add2e-monster-spell-picker:disabled { opacity:.5; cursor:not-allowed; }
    .add2e.sheet.monster .add2e-monster-spell-dropzone { display:flex; align-items:center; justify-content:center; gap:8px; min-height:42px; padding:8px 12px; border:2px dashed #9a7431; border-radius:8px; background:#fffdf4; color:#6f4b12; font-weight:850; }
    .add2e.sheet.monster .add2e-monster-spell-dropzone.is-dragover { border-style:solid; background:#e8f5df; box-shadow:inset 0 0 0 2px #719c4a; }
    .add2e.sheet.monster .add2e-monster-spell-library.is-disabled .add2e-monster-spell-dropzone { opacity:.5; }
    .add2e.sheet.monster .add2e-monster-power-label { color:#6f4b12; font-weight:900; }
    .add2e.sheet.monster .add2e-monster-morale-control { display:flex; align-items:center; gap:6px; }
    .add2e.sheet.monster .add2e-monster-morale-control input { min-width:0; }
    .add2e.sheet.monster .add2e-monster-morale-roll { flex:0 0 auto; border:1px solid #6f4b12; border-radius:5px; background:#ead99d; color:#3d2b0a; padding:4px 7px; font-weight:900; cursor:pointer; }
    .application.add2e-monster-spell-picker-window .window-content,
    .application.add2e-monster-morale-window .window-content { background:#f7eed3; color:#2f210d; }
    .application.add2e-monster-spell-picker-window select,
    .application.add2e-monster-spell-picker-window input,
    .application.add2e-monster-morale-window select,
    .application.add2e-monster-morale-window input { background:#fffaf0; border:1px solid #b9a15d; border-radius:5px; padding:6px; color:#1d1606; }
    .application.add2e-monster-morale-window .add2e-monster-morale-summary { display:flex; justify-content:space-between; gap:10px; margin-bottom:10px; padding:8px; border:1px solid #d9bf73; border-radius:7px; background:#fffdf4; }
    .application.add2e-monster-morale-window .add2e-monster-morale-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-bottom:10px; }
    .application.add2e-monster-morale-window .add2e-monster-morale-grid label > span { display:block; margin-bottom:3px; font-weight:900; }
    .application.add2e-monster-morale-window .add2e-monster-morale-grid select,
    .application.add2e-monster-morale-window .add2e-monster-morale-grid input { width:100%; }
    .application.add2e-monster-morale-window .add2e-monster-morale-columns { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .application.add2e-monster-morale-window fieldset { min-width:0; border:1px solid #d9bf73; border-radius:7px; padding:8px; }
    .application.add2e-monster-morale-window legend { padding:0 5px; color:#6f4b12; font-weight:900; }
    .application.add2e-monster-morale-window .add2e-monster-morale-option { display:grid; grid-template-columns:auto 1fr auto; gap:6px; align-items:center; padding:3px 0; }
    .application.add2e-monster-morale-window .add2e-monster-morale-option input { margin:0; }
    @media(max-width:800px){.add2e.sheet.monster .add2e-monster-spell-actions{grid-template-columns:1fr;}.application.add2e-monster-morale-window .add2e-monster-morale-grid,.application.add2e-monster-morale-window .add2e-monster-morale-columns{grid-template-columns:1fr;}}
  `;
  document.head.appendChild(style);
}

function buildCapTab(actor) {
  const system = actor?.system ?? {};
  const caps = monsterCaps(system);
  const mjCaps = caps.filter(c => c.affichage !== "systeme");
  const sysCaps = caps.filter(c => c.affichage === "systeme");

  const mjHtml = mjCaps.length ? mjCaps.map(c => capCard(c, false)).join("") : `<p class="add2e-monster-note">Aucune capacité informative renseignée.</p>`;
  const sysHtml = sysCaps.length ? sysCaps.map(c => capCard(c, true)).join("") : `<p class="add2e-monster-note">Aucun effet système propre au monstre. Les tactiques sans valeur chiffrée restent des notes MJ.</p>`;

  return `
    <div class="tab" data-group="primary" data-tab="capacites">
      <div class="monster-extra-grid">
        <section class="add2e-monster-panel"><h2>Capacités / notes MJ</h2><div class="add2e-monster-panel-body">${mjHtml}</div></section>
        <section class="add2e-monster-panel"><h2>Effets système prévus</h2><div class="add2e-monster-panel-body">${sysHtml}</div></section>
      </div>
      <section class="add2e-monster-panel">
        <h2>Sens, langues et tags techniques</h2>
        <div class="add2e-monster-panel-body">
          <div class="add2e-monster-info-grid">
            ${infoCard("Sens", system.senses)}
            ${infoCard("Langues", system.languages)}
          </div>
          ${badges(system.tags)}
          ${badges(system.effectTags)}
        </div>
      </section>
    </div>`;
}

function buildDetails(actor) {
  const s = actor?.system ?? {};
  const morale = resolveMonsterMorale(actor);
  return `
    <section class="add2e-monster-panel add2e-monster-details-readonly">
      <h2>Résumé complet du monstre</h2>
      <div class="add2e-monster-panel-body add2e-monster-info-grid">
        ${infoCard("Fréquence", s.frequency)}
        ${infoCard("Habitat", s.habitat)}
        ${infoCard("Organisation", s.organization)}
        ${infoCard("Cycle", s.activityCycle)}
        ${infoCard("Régime", s.diet)}
        ${infoCard("Nombre apparaissant", s.numberAppearing)}
        ${infoCard("Intelligence", s.intelligence)}
        ${infoCard("Moral", morale.display)}
        ${infoCard("Trésor", s.treasure)}
        ${infoCard("PX", s.xp)}
        ${infoCard("Sauvegardes", s.savingThrows)}
        ${infoCard("Résistance magique", s.magicResistance)}
      </div>
    </section>`;
}

function isMonsterActor(actor) {
  return [actor?.type, actor?._source?.type, actor?.baseActor?.type, actor?.document?.type]
    .some(type => norm(type) === "monster");
}

function isProjectilePropulsedWeapon(weapon) {
  return globalThis.add2eGetWeaponUsageProfile?.(weapon)?.isProjectilePropulse === true;
}

function monsterVirtualProjectile(weapon) {
  const weaponId = String(weapon?.id ?? weapon?._id ?? "weapon").replace(/[^a-zA-Z0-9_-]/g, "") || "weapon";
  return {
    id: `add2e-monster-projectile-${weaponId}`,
    name: "Munitions de monstre",
    type: "objet",
    img: weapon?.img ?? "icons/svg/target.svg",
    system: {
      equipee: true,
      equipped: true,
      quantite: 1,
      quantity: 1,
      categorie: "munition",
      munitionType: "virtuel"
    },
    flags: { add2e: { monsterVirtualProjectile: true } }
  };
}

function installMonsterRangedProjectileBridge() {
  const current = globalThis.add2eGetEquippedProjectileForWeapon;
  if (typeof current !== "function") return false;
  if (current.__add2eMonsterRangedProjectileBridge === true) return true;

  const original = current;
  const wrapped = function add2eGetEquippedProjectileForMonsterRangedAttack(actor, weapon) {
    if (isMonsterActor(actor) && isProjectilePropulsedWeapon(weapon)) return monsterVirtualProjectile(weapon);
    return original.call(this, actor, weapon);
  };

  wrapped.__add2eMonsterRangedProjectileBridge = true;
  wrapped.__add2eMonsterRangedProjectileOriginal = original;
  globalThis.add2eGetEquippedProjectileForWeapon = wrapped;
  return true;
}

function refreshCapabilitiesPanel(body, actor) {
  let panel = body.children('[data-tab="capacites"]').first();
  const replacement = $(buildCapTab(actor));

  if (!panel.length) {
    const magicPanel = body.children('[data-tab="magie"]').first();
    if (magicPanel.length) magicPanel.before(replacement);
    else body.append(replacement);
    panel = body.children('[data-tab="capacites"]').first();
    return panel;
  }

  const wasActive = panel.hasClass("active");
  panel.empty().append(replacement.contents());
  panel.toggleClass("active", wasActive);
  return panel;
}

Hooks.on("renderAdd2eMonsterSheet", (app, html, data) => {
  try {
    installStyles();
    const actor = app?.actor ?? data?.actor;
    if (!actor || actor.type !== "monster") return;

    const $html = html instanceof jQuery ? html : $(html);
    const tabs = $html.find(".sheet-tabs").first();
    const body = $html.find(".sheet-body").first();
    if (!tabs.length || !body.length) return;

    if (!tabs.children('[data-tab="capacites"]').length) {
      tabs.children('[data-tab="magie"], [data-tab="description"]').first().before(`<a class="item" data-tab="capacites"><i class="fas fa-list-check"></i> Capacités</a>`);
    }

    refreshCapabilitiesPanel(body, actor);
    bindMonsterSpellLibrary(app, $html, actor);
    bindMonsterMoraleControl(app, $html, actor);

    const descTab = body.children('[data-tab="description"]').first();
    if (descTab.length && !descTab.find(".add2e-monster-details-readonly").length) descTab.prepend(buildDetails(actor));

    const effectsTab = body.children('[data-tab="effets"]').first();
    if (effectsTab.length && !effectsTab.find(".add2e-monster-effect-explain").length) {
      effectsTab.prepend(`<div class="add2e-monster-panel add2e-monster-effect-explain"><h2>Règle d’usage</h2><div class="add2e-monster-panel-body add2e-monster-note">Cet onglet doit contenir uniquement les effets qui modifient réellement la résolution de jeu ou qui doivent être activés/désactivés. Embuscade, attaque en groupe, discipline, écholocation narrative ou tactiques non chiffrées restent dans Capacités / notes MJ.</div></div>`);
    }

    const remembered = app?._add2eActiveTab ?? app?._add2eReadStoredTab?.() ?? null;
    if (remembered && tabs.children(`[data-tab="${remembered}"]`).length && body.children(`[data-tab="${remembered}"]`).length) {
      tabs.children(".item[data-tab]").each((_index, element) => {
        element.classList.toggle("active", element.dataset.tab === remembered);
      });
      body.children(".tab[data-tab]").each((_index, element) => {
        element.classList.toggle("active", element.dataset.tab === remembered);
      });
    }
  } catch (err) {
    console.error("[ADD2E][MONSTER_SHEET][CAPABILITIES] Erreur d'affichage", err);
  }
});

Hooks.once("ready", () => {
  installMonsterRangedProjectileBridge();
  setTimeout(installMonsterRangedProjectileBridge, 500);
});

console.log("[ADD2E][MONSTER_SHEET][CAPABILITIES] Module chargé", ADD2E_MONSTER_CAPABILITIES_VERSION);