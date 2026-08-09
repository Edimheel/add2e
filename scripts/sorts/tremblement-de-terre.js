// ADD2E — Tremblement de terre
// Compatible Foundry V13/V14/V15.
// Le script orchestre le terrain et les créatures concernées ; les sauvegardes et états vitaux restent dans leurs propriétaires canoniques.

const ADD2E_TREMBLEMENT_DE_TERRE_VERSION = "2026-08-09-canonical-earthquake-v5";
const ADD2E_TREMBLEMENT_DE_TERRE_CONFIG = Object.freeze({
  name: "Tremblement de terre",
  slug: "tremblement_de_terre",
  level: 7,
  durationRounds: 1,
  range: '12"',
  areaPerLevel: '1/2" de diamètre',
  terrains: Object.freeze({
    sol: Object.freeze({ label: "Sol", icon: "fas fa-road" }),
    grotte: Object.freeze({ label: "Grottes / souterrains", icon: "fas fa-dungeon" }),
    falaise: Object.freeze({ label: "Falaises", icon: "fas fa-mountain" }),
    marais: Object.freeze({ label: "Marais", icon: "fas fa-water" }),
    tunnel: Object.freeze({ label: "Tunnels", icon: "fas fa-archway" }),
    sous_eau: Object.freeze({ label: "Sous l’eau", icon: "fas fa-water" })
  })
});

globalThis.ADD2E_TREMBLEMENT_DE_TERRE_VERSION = ADD2E_TREMBLEMENT_DE_TERRE_VERSION;

function add2eTremblementDeTerreEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eTremblementDeTerreNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eTremblementDeTerreSourceItem() {
  return typeof item !== "undefined" ? item : null;
}

function add2eTremblementDeTerreCasterToken() {
  return (typeof token !== "undefined" ? token : null)
    ?? (typeof args !== "undefined" ? args?.[0]?.token : null)
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eTremblementDeTerreTargets() {
  return Array.from(game.user?.targets ?? []).filter(target => target?.actor);
}

function add2eTremblementDeTerreRequireApis() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.rollActionSave !== "function") {
    throw new Error("Le résolveur canonique ADD2E des jets de sauvegarde est indisponible.");
  }
  if (typeof globalThis.add2eSpellClassLevel !== "function") {
    throw new Error("Le propriétaire canonique ADD2E du niveau de classe est indisponible.");
  }
  if (typeof globalThis.add2eApplyLethalOutcome !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des issues létales est indisponible.");
  }
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  return engine;
}

function add2eTremblementDeTerreCasterLevel(caster) {
  const level = Number(globalThis.add2eSpellClassLevel(caster, "clerc"));
  if (!Number.isFinite(level) || level < 1) {
    throw new Error("Tremblement de terre : niveau canonique de Clerc introuvable sur l’Item classe du lanceur.");
  }
  return Math.floor(level);
}

function add2eTremblementDeTerreSizeKey(actor) {
  const explicit = actor?.system?.size;
  if (explicit === undefined || explicit === null || explicit === "") return "";
  const key = add2eTremblementDeTerreNormalize(explicit);
  if (["p", "petit", "petite", "small", "s"].includes(key)) return "p";
  if (["m", "moyen", "moyenne", "medium"].includes(key)) return "m";
  if (["g", "grand", "grande", "large", "l"].includes(key)) return "g";
  return "";
}

function add2eTremblementDeTerreSizeLabel(key) {
  return key === "p" ? "Petite (1 sur 4)"
    : key === "m" ? "Moyenne (1 sur 6)"
      : key === "g" ? "Grande (1 sur 8)"
        : "Non renseignée";
}

function add2eTremblementDeTerreSizeDie(key) {
  if (key === "p") return 4;
  if (key === "m") return 6;
  if (key === "g") return 8;
  return 0;
}

async function add2eTremblementDeTerreRoll(formula) {
  const roll = await new Roll(formula).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return roll;
}

async function add2eTremblementDeTerreCreateEffect(targetActor, effectData) {
  if (game.user?.isGM === true || targetActor?.isOwner === true) {
    const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData], {
      add2eInternal: true,
      add2eReason: "tremblement-de-terre-effect"
    });
    return { applied: Boolean(created?.[0]), relayed: false };
  }
  if (typeof game.socket?.emit !== "function") {
    throw new Error("Le relais MJ ADD2E est indisponible pour appliquer l’effet du tremblement de terre.");
  }
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation: "createActiveEffect",
    payload: {
      actorUuid: targetActor?.uuid ?? "",
      actorId: targetActor?.id ?? "",
      effectData
    }
  });
  return { applied: true, relayed: true };
}

function add2eTremblementDeTerreStunEffect(sourceItem, rounds) {
  return {
    name: "Tremblement de terre — Étourdissement",
    img: sourceItem?.img || "icons/svg/daze.svg",
    origin: sourceItem?.uuid ?? null,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {
      rounds,
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    },
    description: `Onde de choc sous-marine : étourdi pendant ${rounds} rounds après échec du jet de protection contre la mort magique.`,
    flags: {
      add2e: {
        tags: [
          "sort:tremblement_de_terre",
          "classe:clerc",
          "niveau:7",
          "etat:etourdissement",
          "terrain:sous_eau"
        ],
        spellConsumerVersion: ADD2E_TREMBLEMENT_DE_TERRE_VERSION,
        earthquake: {
          managed: true,
          terrain: "sous_eau",
          effect: "etourdissement"
        }
      }
    }
  };
}

async function add2eTremblementDeTerreParameters(targets) {
  const terrainOptions = Object.entries(ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.terrains)
    .map(([key, terrain]) => `<option value="${key}">${add2eTremblementDeTerreEscape(terrain.label)}</option>`)
    .join("");
  const sizeRows = targets.map(target => {
    const detected = add2eTremblementDeTerreSizeKey(target.actor);
    return `
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:8px;align-items:center;">
        <span>${add2eTremblementDeTerreEscape(target.name)}</span>
        <select name="size_${add2eTremblementDeTerreEscape(target.actor.id)}">
          <option value=""${detected ? "" : " selected"}>Taille non déterminée</option>
          <option value="p"${detected === "p" ? " selected" : ""}>Petite — 1 sur 4</option>
          <option value="m"${detected === "m" ? " selected" : ""}>Moyenne — 1 sur 6</option>
          <option value="g"${detected === "g" ? " selected" : ""}>Grande — 1 sur 8</option>
        </select>
      </div>
    `;
  }).join("");

  return globalThis.add2eDialogWait({
    add2eTheme: "danger",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-tremblement-de-terre-dialog"],
    window: { title: ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.name },
    content: `
      <form class="add2e-tremblement-de-terre-form">
        <div class="form-group">
          <label>Terrain principal de la zone</label>
          <select name="terrain">${terrainOptions}</select>
        </div>
        <div class="form-group">
          <label>Construction présente dans la zone</label>
          <select name="structure">
            <option value="none" selected>Aucune structure à résoudre</option>
            <option value="normal">Structure normale — 5d12 dégâts structurels</option>
            <option value="rock">Fondations atteignant le roc — moitié des dégâts</option>
          </select>
        </div>
        <div class="form-group">
          <label>Nombre d’arbres dans la zone</label>
          <input name="trees" type="number" min="0" step="1" value="0">
        </div>
        <fieldset>
          <legend>Taille des créatures — utilisée uniquement pour les crevasses au sol</legend>
          <div style="display:grid;gap:6px;">${sizeRows || "<p>Aucune créature sélectionnée.</p>"}</div>
        </fieldset>
        <div class="form-group">
          <label>Note de scène</label>
          <textarea name="note" rows="2"></textarea>
        </div>
        <p><small>Les cibles sélectionnées représentent les créatures présentes dans la zone. Aucun mur, tuile, arbre ou bâtiment Foundry n’est modifié automatiquement.</small></p>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Déclencher le séisme",
        icon: "<i class='fas fa-mountain'></i>",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          const sizes = {};
          for (const target of targets) sizes[target.actor.id] = String(form?.elements?.[`size_${target.actor.id}`]?.value ?? "");
          return {
            terrain: String(form?.elements?.terrain?.value ?? "sol"),
            structure: String(form?.elements?.structure?.value ?? "none"),
            trees: Math.max(0, Math.floor(Number(form?.elements?.trees?.value) || 0)),
            sizes,
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

async function add2eTremblementDeTerreResolveGround(targets, parameters) {
  const results = [];
  const rolls = [];
  for (const target of targets) {
    const size = String(parameters.sizes?.[target.actor.id] ?? "");
    const die = add2eTremblementDeTerreSizeDie(size);
    if (!die) {
      results.push({ target: target.name, result: "Taille non déterminée", detail: "Le MD doit résoudre le risque de crevasse selon la catégorie P/M/G." });
      continue;
    }
    const roll = await add2eTremblementDeTerreRoll(`1d${die}`);
    rolls.push(roll);
    const killed = Number(roll.total) === 1;
    if (killed) {
      const lethal = await globalThis.add2eApplyLethalOutcome(target.actor, { reason: "tremblement-de-terre-crevasse" });
      results.push({
        target: target.name,
        result: lethal?.relayed ? "Chute dans une crevasse — mort transmise au MJ" : "Chute dans une crevasse — mort",
        detail: `${add2eTremblementDeTerreSizeLabel(size)} · jet ${roll.total} sur d${die}`
      });
    } else {
      results.push({
        target: target.name,
        result: "Évite la crevasse létale",
        detail: `${add2eTremblementDeTerreSizeLabel(size)} · jet ${roll.total} sur d${die}`
      });
    }
  }
  return { results, rolls };
}

async function add2eTremblementDeTerreResolveUnderwater(targets, engine, sourceItem) {
  const results = [];
  const rolls = [];
  for (const target of targets) {
    const save = await engine.rollActionSave(target.actor, "mort", 0);
    if (save?.roll) rolls.push(save.roll);
    if (!save?.canRoll) {
      results.push({ target: target.name, result: "JP contre la mort magique indisponible", detail: "Aucun étourdissement automatique appliqué." });
      continue;
    }
    if (save.success === true) {
      results.push({ target: target.name, result: "JP réussi — pas d’étourdissement", detail: `Jet ${save.total} contre seuil ${save.threshold}` });
      continue;
    }
    const duration = await add2eTremblementDeTerreRoll("1d16+4");
    rolls.push(duration);
    const rounds = Math.max(5, Math.min(20, Math.floor(Number(duration.total) || 5)));
    const applied = await add2eTremblementDeTerreCreateEffect(target.actor, add2eTremblementDeTerreStunEffect(sourceItem, rounds));
    results.push({
      target: target.name,
      result: applied.relayed ? "Étourdissement transmis au MJ" : "Étourdi",
      detail: `JP raté · ${rounds} rounds`
    });
  }
  return { results, rolls };
}

async function add2eTremblementDeTerreResolveEnvironment(parameters) {
  const rolls = [];
  const details = [];

  if (parameters.structure !== "none") {
    const roll = await add2eTremblementDeTerreRoll("5d12");
    rolls.push(roll);
    const raw = Math.max(0, Math.floor(Number(roll.total) || 0));
    const applied = parameters.structure === "rock" ? Math.floor(raw / 2) : raw;
    const ruin = raw === 60;
    details.push(
      `Structure : ${raw} dégâts structurels${parameters.structure === "rock" ? `, réduits à ${applied} grâce aux fondations atteignant le roc` : ""}${ruin && parameters.structure !== "rock" ? " — dommages maximum : la structure tombe en ruine" : ""}.`
    );
  }

  if (parameters.trees > 0) {
    const uprooted = [];
    for (let index = 0; index < parameters.trees; index += 1) {
      const roll = await add2eTremblementDeTerreRoll("1d3");
      rolls.push(roll);
      if (Number(roll.total) === 1) uprooted.push(index + 1);
    }
    details.push(`Arbres : ${uprooted.length}/${parameters.trees} déraciné(s) selon la chance de 1 sur 3.`);
  }

  const terrainDetail = {
    grotte: "Grottes / souterrains : le plafond s’effondre. Les conséquences précises sur la scène et les créatures ensevelies restent à résoudre par le MD.",
    falaise: "Falaises : la paroi s’effondre et provoque un glissement de terrain. Le tracé et les conséquences restent à résoudre par le MD.",
    marais: "Marais : l’eau s’écoule hors des dépressions et forme de la boue sur les terrains alentours.",
    tunnel: "Tunnels : ils s’écroulent. Les passages concernés restent à déterminer sur la scène par le MD.",
    sol: "Sol : des crevasses se forment ; le risque létal des créatures sélectionnées a été résolu selon leur taille.",
    sous_eau: "Sous l’eau : les ondes de choc imposent un JP contre la mort magique ; les échecs sont étourdis pendant 5 à 20 rounds."
  }[parameters.terrain];
  if (terrainDetail) details.unshift(terrainDetail);

  return { details, rolls };
}

async function add2eTremblementDeTerreChat(caster, casterToken, sourceItem, casterLevel, targets, parameters, resolution) {
  const terrain = ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.terrains[parameters.terrain];
  const rows = [
    { label: "Terrain", value: terrain?.label ?? parameters.terrain },
    { label: "Portée", value: ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.range },
    { label: "Zone", value: `${casterLevel / 2}\" de diamètre (${ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.areaPerLevel} par niveau)` },
    { label: "Durée", value: "1 round" },
    { label: "Cibles sélectionnées", value: targets.length ? targets.map(target => target.name).join(", ") : "Aucune" }
  ];
  for (const entry of resolution.creatures) {
    rows.push({ label: entry.target, value: [entry.result, entry.detail].filter(Boolean).join(" · ") });
  }

  const safeEnvironment = resolution.environment.map(add2eTremblementDeTerreEscape).map(line => `<p>${line}</p>`).join("");
  const safeNote = add2eTremblementDeTerreEscape(parameters.note);
  const options = {
    actor: caster,
    title: ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.name,
    icon: "fas fa-mountain",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? sourceItem?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows,
    trustedBodyHtml: `${safeEnvironment}${safeNote ? `<p><b>Note :</b> ${safeNote}</p>` : ""}<p><em>Aucun élément de scène Foundry n’est détruit ou déplacé automatiquement ; la carte fournit les résultats réglementaires à appliquer par le MD.</em></p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: resolution.rolls,
      flags: {
        add2e: {
          spell: ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.slug,
          terrain: parameters.terrain,
          version: ADD2E_TREMBLEMENT_DE_TERRE_VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const sourceItem = add2eTremblementDeTerreSourceItem();
const caster = (typeof actor !== "undefined" ? actor : null) ?? sourceItem?.parent ?? null;
if (!caster || !sourceItem) {
  ui.notifications.error("Tremblement de terre : lanceur ou Item sort introuvable.");
  return false;
}

const engine = add2eTremblementDeTerreRequireApis();
const casterLevel = add2eTremblementDeTerreCasterLevel(caster);
const targets = add2eTremblementDeTerreTargets();
const parameters = await add2eTremblementDeTerreParameters(targets);
if (!parameters) {
  ui.notifications.info("Tremblement de terre annulé.");
  return false;
}
if (!ADD2E_TREMBLEMENT_DE_TERRE_CONFIG.terrains[parameters.terrain]) {
  ui.notifications.error("Tremblement de terre : terrain inconnu.");
  return false;
}

try {
  let creatureResolution = { results: [], rolls: [] };
  if (parameters.terrain === "sol" && targets.length) {
    creatureResolution = await add2eTremblementDeTerreResolveGround(targets, parameters);
  } else if (parameters.terrain === "sous_eau" && targets.length) {
    creatureResolution = await add2eTremblementDeTerreResolveUnderwater(targets, engine, sourceItem);
  }

  const environmentResolution = await add2eTremblementDeTerreResolveEnvironment(parameters);
  await add2eTremblementDeTerreChat(
    caster,
    add2eTremblementDeTerreCasterToken(),
    sourceItem,
    casterLevel,
    targets,
    parameters,
    {
      creatures: creatureResolution.results,
      environment: environmentResolution.details,
      rolls: [...creatureResolution.rolls, ...environmentResolution.rolls]
    }
  );
  return true;
} catch (error) {
  console.error("[ADD2E][TREMBLEMENT_DE_TERRE]", error);
  ui.notifications.error(`Tremblement de terre : ${error?.message ?? "erreur de résolution"}`);
  return false;
}