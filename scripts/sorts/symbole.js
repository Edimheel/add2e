// ADD2E — Symbole (Clerc 7 / Magicien 8)
// Compatible Foundry V13/V14/V15.
// Le script orchestre la variante choisie ; les sauvegardes, résistances, modificateurs et états vitaux restent dans leurs propriétaires canoniques.

const ADD2E_SYMBOLE_VERSION = "2026-08-09-canonical-symbol-v5";
const ADD2E_SYMBOLE_TURN_ROUNDS = 10;

const ADD2E_SYMBOLE_PROFILES = Object.freeze({
  clerc: Object.freeze({
    classKey: "clerc",
    classLabel: "Clerc",
    spellLevel: 7,
    sourceType: "Sort divin",
    theme: "parchment",
    variants: Object.freeze({
      desespoir: Object.freeze({
        label: "Désespoir",
        saveModifier: 0,
        durationFormula: "3d4",
        durationUnit: "turns",
        effectKeys: Object.freeze(["desespoir"]),
        effectTags: Object.freeze(["etat:desespoir", "attitude:soumission"]),
        description: "Les créatures qui ratent leur jet de protection contre les sorts tombent dans un profond désespoir et se soumettent aux demandes d’un adversaire pendant 3d4 tours."
      }),
      souffrance: Object.freeze({
        label: "Souffrance",
        saveModifier: 0,
        durationFormula: "2d10",
        durationUnit: "turns",
        effectKeys: Object.freeze(["souffrance"]),
        effectTags: Object.freeze(["etat:souffrance"]),
        suffering: true,
        description: "Les créatures qui ratent leur jet de protection subissent −2 en Dextérité et −4 aux jets pour toucher pendant 2d10 tours."
      }),
      persuasion: Object.freeze({
        label: "Persuasion",
        saveModifier: 0,
        durationFormula: "1d20",
        durationUnit: "turns",
        effectKeys: Object.freeze(["persuasion"]),
        effectTags: Object.freeze(["etat:persuasion", "attitude:amicale"]),
        persuasion: true,
        description: "Les créatures qui ratent leur jet de protection prennent temporairement l’alignement du clerc et se montrent amicales envers lui pendant 1d20 tours."
      })
    })
  }),
  magicien: Object.freeze({
    classKey: "magicien",
    classLabel: "Magicien",
    spellLevel: 8,
    sourceType: "Sort profane",
    theme: "wizard",
    variants: Object.freeze({
      desespoir: Object.freeze({
        label: "Désespoir",
        saveModifier: 0,
        durationFormula: "3d4",
        durationUnit: "turns",
        effectKeys: Object.freeze(["desespoir"]),
        effectTags: Object.freeze(["etat:desespoir", "attitude:soumission"]),
        description: "Les créatures qui ratent leur jet de protection se soumettent aux demandes d’un adversaire pendant 3d4 tours. Pendant cette période, la règle prévoit aussi 25 % de chances de ne rien faire et 25 % de chances, pour celles qui agissent, de faire demi-tour ou de se retirer."
      }),
      discorde: Object.freeze({
        label: "Discorde",
        durationFormula: "5d4",
        durationUnit: "rounds",
        effectKeys: Object.freeze(["discorde"]),
        effectTags: Object.freeze(["etat:discorde"]),
        discord: true,
        description: "Toutes les créatures affectées se disputent pendant 5d4 rounds. Des créatures d’alignement différent ont 50 % de chances de se battre entre elles ; un tel combat dure 2d4 rounds."
      }),
      effroi: Object.freeze({
        label: "Effroi",
        saveModifier: -4,
        casterLevelDuration: true,
        durationUnit: "rounds",
        effectKeys: Object.freeze(["effroi", "peur"]),
        effectTags: Object.freeze(["etat:effroi", "etat:peur", "mouvement:fuite_maximale"]),
        description: "Les créatures qui ratent leur jet de protection à −4 sont prises de panique et fuient au maximum de leur vitesse pendant un nombre de rounds égal au niveau de magicien du lanceur. La règle d’Effroi prévoit aussi qu’elles puissent lâcher ce qu’elles tiennent selon leur niveau ou leurs dés de vie ; ce point reste arbitré par le MD tant qu’aucun propriétaire canonique ne le modélise."
      }),
      etourdissement: Object.freeze({
        label: "Étourdissement",
        hpCap: 160,
        durationFormula: "3d4",
        durationUnit: "rounds",
        effectKeys: Object.freeze(["etourdissement"]),
        effectTags: Object.freeze(["etat:etourdissement", "action:lache_objets"]),
        description: "Une ou plusieurs créatures dont le total de points de vie ne dépasse pas 160 sont étourdies et chancelantes pendant 3d4 rounds et laissent tomber ce qu’elles tiennent."
      }),
      insanite: Object.freeze({
        label: "Insanité",
        hpCap: 120,
        permanent: true,
        effectKeys: Object.freeze(["insanite", "confusion"]),
        effectTags: Object.freeze(["etat:insanite", "etat:confusion"]),
        description: "Une ou plusieurs créatures dont le total de points de vie ne dépasse pas 120 deviennent folles de façon permanente et agissent comme sous Confusion, jusqu’à Guérison, Souhait majeur ou Restauration."
      }),
      mort: Object.freeze({
        label: "Mort",
        hpCap: 80,
        lethal: true,
        effectKeys: Object.freeze(["mort"]),
        effectTags: Object.freeze(["etat:mort"]),
        description: "Une ou plusieurs créatures dont le total de points de vie ne dépasse pas 80 sont tuées. L’issue létale est appliquée par le propriétaire canonique des états vitaux."
      }),
      sommeil: Object.freeze({
        label: "Sommeil",
        durationFormula: "1d12+4",
        durationUnit: "turns",
        effectKeys: Object.freeze(["sommeil"]),
        effectTags: Object.freeze(["etat:sommeil", "etat:catalepsie", "reveil:impossible"]),
        sleep: true,
        description: "Les créatures ayant moins de 8+1 dés de vie tombent immédiatement dans un état cataleptique et ne peuvent être réveillées pendant 1d12+4 tours."
      }),
      souffrance: Object.freeze({
        label: "Souffrance",
        durationFormula: "2d10",
        durationUnit: "turns",
        effectKeys: Object.freeze(["souffrance"]),
        effectTags: Object.freeze(["etat:souffrance"]),
        suffering: true,
        description: "Toutes les créatures affectées subissent −2 en Dextérité et −4 aux jets pour toucher pendant 2d10 tours."
      })
    })
  })
});

globalThis.ADD2E_SYMBOLE_VERSION = ADD2E_SYMBOLE_VERSION;

function add2eSymboleEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eSymboleNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSymboleSourceItem() {
  return typeof item !== "undefined" ? item : null;
}

function add2eSymboleCasterToken() {
  return (typeof token !== "undefined" ? token : null)
    ?? (typeof args !== "undefined" ? args?.[0]?.token : null)
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eSymboleTargets() {
  return Array.from(game.user?.targets ?? []).filter(target => target?.actor);
}

function add2eSymboleRequireApis() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.rollActionSave !== "function" || typeof engine.readHitPoints !== "function" || typeof engine.createModifier !== "function") {
    throw new Error("Les propriétaires canoniques ADD2E des sauvegardes, points de vie ou modificateurs sont indisponibles.");
  }
  if (typeof globalThis.add2eResolveIncomingActiveEffect !== "function") {
    throw new Error("Le résolveur canonique ADD2E des immunités et résistances aux effets entrants est indisponible.");
  }
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  if (typeof globalThis.add2eNormalizeSpellKey !== "function" || typeof globalThis.add2eGetSpellListsFromItem !== "function" || typeof globalThis.add2eSpellClassLevel !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des listes et niveaux de sorts est indisponible.");
  }
  if (typeof globalThis.add2eApplyLethalOutcome !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des issues létales est indisponible.");
  }
  return engine;
}

function add2eSymboleProfile(sourceItem) {
  if (!sourceItem?.system) return null;
  const normalizeSpell = value => add2eSymboleNormalize(globalThis.add2eNormalizeSpellKey(value));
  const declaredClass = normalizeSpell(sourceItem.system.classe);
  const lists = globalThis.add2eGetSpellListsFromItem(sourceItem).map(normalizeSpell).filter(Boolean);
  const keys = [...new Set([declaredClass, ...lists].filter(key => key === "clerc" || key === "magicien"))];
  if (keys.length !== 1) return null;
  return ADD2E_SYMBOLE_PROFILES[keys[0]] ?? null;
}

function add2eSymboleCasterLevel(caster, profile) {
  const level = Number(globalThis.add2eSpellClassLevel(caster, profile.classKey));
  if (!Number.isFinite(level) || level < 1) {
    throw new Error(`Symbole : niveau canonique de ${profile.classLabel} introuvable sur l’Item classe du lanceur.`);
  }
  return Math.floor(level);
}

function add2eSymboleActorAlignment(actor) {
  const system = actor?.system ?? {};
  if (Object.prototype.hasOwnProperty.call(system, "alignement")) return String(system.alignement ?? "").trim();
  if (Object.prototype.hasOwnProperty.call(system, "alignment")) return String(system.alignment ?? "").trim();
  return "";
}

function add2eSymboleAlignmentPath(actor) {
  const system = actor?.system ?? {};
  if (Object.prototype.hasOwnProperty.call(system, "alignement")) return "system.alignement";
  if (Object.prototype.hasOwnProperty.call(system, "alignment")) return "system.alignment";
  return "";
}

function add2eSymboleSource(_engine, sourceItem) {
  return {
    kind: "spell",
    id: String(sourceItem?.id ?? "symbole"),
    uuid: String(sourceItem?.uuid ?? ""),
    name: String(sourceItem?.name ?? "Symbole")
  };
}

function add2eSymboleSufferingModifiers(engine, sourceItem) {
  const source = add2eSymboleSource(engine, sourceItem);
  return [
    engine.createModifier({
      id: `${source.id}:symbole:souffrance:dexterite`,
      domain: "ability",
      target: "dexterite",
      operation: "add",
      value: -2,
      priority: 100,
      stacking: { mode: "stack", group: null },
      source,
      metadata: { label: "Symbole — Souffrance : Dextérité −2", producer: "spell-active-effect" }
    }),
    engine.createModifier({
      id: `${source.id}:symbole:souffrance:toucher`,
      domain: "attack",
      target: "toucher",
      operation: "add",
      value: -4,
      priority: 100,
      stacking: { mode: "stack", group: null },
      source,
      metadata: { label: "Symbole — Souffrance : toucher −4", producer: "spell-active-effect" }
    })
  ];
}

function add2eSymboleIncoming(engine, targetActor, variant) {
  const keys = new Set((variant.effectKeys ?? []).map(add2eSymboleNormalize).filter(Boolean));
  const tags = new Set([
    "sort:symbole",
    `symbole:${variant.id ?? add2eSymboleNormalize(variant.label)}`,
    ...[...keys].map(key => `effect:${key}`)
  ].map(tag => engine.normalizeTag?.(tag) ?? tag));
  return globalThis.add2eResolveIncomingActiveEffect(targetActor, {
    effect: null,
    data: null,
    tags,
    keys,
    name: `Symbole — ${variant.label}`
  });
}

function add2eSymboleIncomingLabel(result) {
  if (!result || result.kind === "none") return "";
  if (result.kind === "resistance") {
    return result.blocked
      ? `${result.label ?? "Résistance"} ${result.pct}% réussie (${result.roll})`
      : `${result.label ?? "Résistance"} ${result.pct}% échouée (${result.roll})`;
  }
  return result.blocked ? String(result.label ?? "Immunité active") : "";
}

async function add2eSymboleRoll(formula, unit) {
  const roll = await new Roll(formula).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const value = Math.max(0, Math.floor(Number(roll.total) || 0));
  return {
    roll,
    value,
    rounds: unit === "turns" ? value * ADD2E_SYMBOLE_TURN_ROUNDS : value,
    label: unit === "turns"
      ? `${value} tour(s) (${value * ADD2E_SYMBOLE_TURN_ROUNDS} rounds)`
      : `${value} round(s)`
  };
}

function add2eSymboleEffectData(_engine, sourceItem, profile, variant, _targetActor, {
  rounds = 0,
  description = variant.description,
  extraTags = [],
  extraFlags = {},
  changes = [],
  modifiers = []
} = {}) {
  const tags = [...new Set([
    "sort:symbole",
    `classe:${profile.classKey}`,
    `liste:${profile.classKey}`,
    `niveau:${profile.spellLevel}`,
    `symbole:${variant.id}`,
    ...(variant.effectTags ?? []),
    ...extraTags
  ])];
  const add2e = {
    tags,
    incomingEffectResolutionBypass: true,
    spellConsumerVersion: ADD2E_SYMBOLE_VERSION,
    symbole: {
      managed: true,
      variant: variant.id,
      classKey: profile.classKey,
      sourceItemUuid: sourceItem?.uuid ?? "",
      ...extraFlags
    }
  };
  if (modifiers.length) add2e.modifiers = modifiers;

  return {
    name: `Symbole — ${variant.label}`,
    img: sourceItem?.img || "icons/svg/aura.svg",
    origin: sourceItem?.uuid ?? null,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes,
    duration: rounds > 0 ? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    } : {},
    description,
    flags: { add2e }
  };
}

async function add2eSymboleCreateEffect(targetActor, effectData) {
  if (game.user?.isGM === true || targetActor?.isOwner === true) {
    const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData], {
      add2eInternal: true,
      add2eReason: "symbole-apply-effect"
    });
    return { applied: Boolean(created?.[0]), relayed: false, effect: created?.[0] ?? null };
  }
  if (typeof game.socket?.emit !== "function") {
    throw new Error("Le relais MJ ADD2E est indisponible pour appliquer l’effet de Symbole.");
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
  return { applied: true, relayed: true, effect: null };
}

function add2eSymboleHitDice(actor) {
  const raw = String(actor?.system?.hitDice ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d+)(?:\s*d\s*\d+)?(?:\s*\+\s*(\d+))?/i);
  if (!match) return null;
  return {
    raw,
    dice: Math.max(0, Number(match[1]) || 0),
    bonus: Math.max(0, Number(match[2]) || 0)
  };
}

function add2eSymboleSleepEligibleByHitDice(actor) {
  const hd = add2eSymboleHitDice(actor);
  if (!hd) return null;
  return hd.dice < 8 || (hd.dice === 8 && hd.bonus < 1);
}

async function add2eSymboleSleepAdjudication(unknownTargets) {
  if (!unknownTargets.length || !game.user?.isGM) return new Set();
  const rows = unknownTargets.map(target => `
    <label style="display:flex;gap:8px;align-items:center;">
      <input type="checkbox" data-symbole-sleep-actor-id="${add2eSymboleEscape(target.actor.id)}">
      <span>${add2eSymboleEscape(target.name)} — DV non renseignés</span>
    </label>
  `).join("");
  const result = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "apply",
    add2eClasses: ["add2e-symbole-sommeil-adjudication"],
    window: { title: "Symbole — Sommeil" },
    content: `
      <form class="add2e-symbole-sommeil-adjudication-form">
        <p>Les cibles suivantes n’ont pas de <code>system.hitDice</code> canonique.</p>
        <p>Coche uniquement celles que le MD juge avoir <b>moins de 8+1 dés de vie</b>.</p>
        <div style="display:grid;gap:6px;">${rows}</div>
      </form>
    `,
    buttons: [
      {
        action: "apply",
        label: "Valider les DV",
        icon: "<i class='fas fa-check'></i>",
        default: true,
        callback: (_event, button) => new Set(
          Array.from(button.form?.querySelectorAll?.("[data-symbole-sleep-actor-id]:checked") ?? [])
            .map(input => String(input.dataset.symboleSleepActorId ?? ""))
            .filter(Boolean)
        )
      },
      {
        action: "cancel",
        label: "Aucune cible inconnue",
        icon: "<i class='fas fa-times'></i>",
        callback: () => new Set()
      }
    ],
    close: () => new Set()
  });
  return result instanceof Set ? result : new Set();
}

async function add2eSymboleParameters(profile, targets) {
  const options = Object.entries(profile.variants)
    .map(([id, variant]) => `<option value="${add2eSymboleEscape(id)}">${add2eSymboleEscape(variant.label)}</option>`)
    .join("");
  return globalThis.add2eDialogWait({
    add2eTheme: profile.theme,
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-symbole-dialog"],
    window: { title: `Symbole — ${profile.classLabel}` },
    content: `
      <form class="add2e-symbole-form">
        <p><b>${add2eSymboleEscape(targets.length)} cible(s) sélectionnée(s)</b> : elles représentent les créatures qui voient ou déclenchent actuellement le symbole.</p>
        <div class="form-group">
          <label>Variante</label>
          <select name="variant">${options}</select>
        </div>
        <div class="form-group">
          <label>Note de scène / emplacement</label>
          <textarea name="note" rows="2"></textarea>
        </div>
        <p><small>${profile.classKey === "magicien"
          ? "L’inscription matérielle du symbole et la détection ultérieure de son déclenchement restent gérées par la scène et le MD ; cette utilisation résout les créatures qui le déclenchent maintenant."
          : "Le symbole clérical brille pendant 1 tour par niveau de clerc ; les cibles sélectionnées sont celles qui le voient maintenant."}</small></p>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Résoudre le symbole",
        icon: "<i class='fas fa-signature'></i>",
        default: true,
        callback: (_event, button) => ({
          variant: String(button.form?.elements?.variant?.value ?? ""),
          note: String(button.form?.elements?.note?.value ?? "").trim()
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
}

function add2eSymboleTargetResult(target, result, detail = "") {
  return {
    target: target.name ?? target.actor?.name ?? "Créature",
    result,
    detail
  };
}

async function add2eSymboleResolve(caster, sourceItem, profile, variant, casterLevel, targets, engine) {
  const results = [];
  const rolls = [];
  const affectedActors = [];
  let duration = null;
  let totalHitPoints = null;
  let groupDetail = "";

  if (variant.casterLevelDuration) {
    duration = {
      value: casterLevel,
      rounds: casterLevel,
      label: `${casterLevel} round(s)`,
      roll: null
    };
  } else if (variant.durationFormula) {
    duration = await add2eSymboleRoll(variant.durationFormula, variant.durationUnit);
    rolls.push(duration.roll);
  }

  if (variant.persuasion && !add2eSymboleActorAlignment(caster)) {
    throw new Error("Symbole — Persuasion : l’alignement canonique du clerc est absent.");
  }

  if (variant.hpCap) {
    const hitPoints = targets.map(target => {
      const value = Number(engine.readHitPoints(target.actor));
      if (!Number.isFinite(value)) throw new Error(`PV canoniques indisponibles pour ${target.name}.`);
      return { target, value: Math.max(0, value) };
    });
    totalHitPoints = hitPoints.reduce((sum, entry) => sum + entry.value, 0);
    if (totalHitPoints > variant.hpCap) {
      for (const { target, value } of hitPoints) {
        results.push(add2eSymboleTargetResult(target, "Non affectée", `${value} PV ; total sélectionné ${totalHitPoints}/${variant.hpCap}`));
      }
      return { results, rolls, duration, totalHitPoints, groupDetail: `Plafond dépassé : ${totalHitPoints} PV sélectionnés pour un maximum de ${variant.hpCap}.` };
    }
  }

  let sleepEligibleIds = null;
  if (variant.sleep) {
    const unknown = targets.filter(target => add2eSymboleSleepEligibleByHitDice(target.actor) === null);
    const adjudicated = await add2eSymboleSleepAdjudication(unknown);
    sleepEligibleIds = new Set(
      targets
        .filter(target => add2eSymboleSleepEligibleByHitDice(target.actor) === true)
        .map(target => String(target.actor.id))
    );
    for (const id of adjudicated) sleepEligibleIds.add(String(id));
    if (unknown.length && !game.user?.isGM) {
      groupDetail = "Certaines cibles sans system.hitDice n’ont pas été affectées automatiquement ; leur éligibilité doit être arbitrée par le MD.";
    }
  }

  for (const target of targets) {
    const targetActor = target.actor;

    if (variant.sleep && !sleepEligibleIds.has(String(targetActor.id))) {
      const hd = add2eSymboleHitDice(targetActor);
      results.push(add2eSymboleTargetResult(
        target,
        "Non affectée",
        hd ? `${hd.raw} DV : seuil de moins de 8+1 DV non rempli` : "DV non modélisés / non validés par le MD"
      ));
      continue;
    }

    const incoming = add2eSymboleIncoming(engine, targetActor, variant);
    const incomingLabel = add2eSymboleIncomingLabel(incoming);
    if (incoming?.blocked === true) {
      results.push(add2eSymboleTargetResult(target, "Effet annulé", incomingLabel || "Immunité ou résistance"));
      continue;
    }

    if (variant.saveModifier !== undefined) {
      const save = await engine.rollActionSave(targetActor, "sorts", Number(variant.saveModifier) || 0);
      if (save?.roll) rolls.push(save.roll);
      if (!save?.canRoll) {
        results.push(add2eSymboleTargetResult(target, "JP indisponible", "Aucun effet appliqué sans résolution canonique du jet de protection"));
        continue;
      }
      if (save.success === true) {
        results.push(add2eSymboleTargetResult(target, "JP réussi — aucun effet", incomingLabel));
        continue;
      }
    }

    if (variant.lethal) {
      const lethal = await globalThis.add2eApplyLethalOutcome(targetActor, { reason: "symbole-mort" });
      results.push(add2eSymboleTargetResult(
        target,
        lethal?.relayed ? "Mort — transmise au MJ" : "Mort",
        incomingLabel
      ));
      affectedActors.push(targetActor);
      continue;
    }

    const changes = [];
    const extraFlags = {};
    const modifiers = variant.suffering ? add2eSymboleSufferingModifiers(engine, sourceItem) : [];

    if (variant.persuasion) {
      const path = add2eSymboleAlignmentPath(targetActor);
      const alignment = add2eSymboleActorAlignment(caster);
      if (!path) {
        results.push(add2eSymboleTargetResult(target, "Non affectée", "Champ canonique d’alignement absent sur la cible"));
        continue;
      }
      changes.push({
        key: path,
        mode: globalThis.CONST?.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5,
        value: alignment,
        priority: 20
      });
      extraFlags.casterAlignment = alignment;
      extraFlags.baseAlignment = add2eSymboleActorAlignment(targetActor);
    }

    const effectData = add2eSymboleEffectData(engine, sourceItem, profile, variant, targetActor, {
      rounds: duration?.rounds ?? 0,
      description: variant.description,
      extraFlags,
      changes,
      modifiers
    });
    const applied = await add2eSymboleCreateEffect(targetActor, effectData);
    results.push(add2eSymboleTargetResult(
      target,
      applied.relayed ? "Effet transmis au MJ" : (applied.applied ? "Effet appliqué" : "Effet non appliqué"),
      [duration?.label ?? (variant.permanent ? "Permanent" : ""), incomingLabel].filter(Boolean).join(" · ")
    ));
    if (applied.applied) affectedActors.push(targetActor);
  }

  if (variant.discord && affectedActors.length) {
    const knownAlignments = affectedActors.map(add2eSymboleActorAlignment).filter(Boolean);
    const differentAlignments = new Set(knownAlignments.map(add2eSymboleNormalize)).size > 1;
    const unknownAlignmentCount = affectedActors.length - knownAlignments.length;
    if (differentAlignments) {
      const chance = await add2eSymboleRoll("1d100", "rounds");
      rolls.push(chance.roll);
      if (chance.value <= 50) {
        const fight = await add2eSymboleRoll("2d4", "rounds");
        rolls.push(fight.roll);
        groupDetail = `Discorde : jet ${chance.value}/50, combat entre créatures d’alignements différents déclenché pour ${fight.value} round(s). Le choix des adversaires reste au MD.`;
      } else {
        groupDetail = `Discorde : jet ${chance.value}/50, aucun combat entre alignements différents.`;
      }
    } else if (unknownAlignmentCount > 0) {
      groupDetail = "Discorde : au moins un alignement canonique est absent ; le test de 50 % de combat entre alignements différents reste à arbitrer par le MD.";
    } else {
      groupDetail = "Discorde : aucune paire de créatures d’alignements différents parmi les cibles affectées.";
    }
  }

  return { results, rolls, duration, totalHitPoints, groupDetail };
}

async function add2eSymboleChat(caster, casterToken, sourceItem, profile, variant, casterLevel, targets, parameters, resolution) {
  const rows = [
    { label: "Version", value: `${profile.classLabel} · niveau ${profile.spellLevel}` },
    { label: "Variante", value: variant.label },
    { label: "Cibles", value: targets.map(target => target.name).join(", ") },
    { label: "Niveau du lanceur", value: casterLevel }
  ];
  if (profile.classKey === "clerc") rows.push({ label: "Brillance du symbole", value: `${casterLevel} tour(s)` });
  if (resolution.duration) rows.push({ label: "Durée de l’effet", value: resolution.duration.label });
  if (variant.hpCap) rows.push({ label: "Plafond de PV", value: `${resolution.totalHitPoints ?? 0} / ${variant.hpCap}` });
  for (const entry of resolution.results) {
    rows.push({ label: entry.target, value: [entry.result, entry.detail].filter(Boolean).join(" · ") });
  }

  const safeDescription = add2eSymboleEscape(variant.description);
  const safeNote = add2eSymboleEscape(parameters.note);
  const safeGroupDetail = add2eSymboleEscape(resolution.groupDetail);
  const options = {
    actor: caster,
    title: `Symbole — ${variant.label}`,
    icon: "fas fa-signature",
    variant: "spell",
    source: {
      name: caster?.name ?? profile.classLabel,
      img: casterToken?.document?.texture?.src ?? caster?.img ?? sourceItem?.img ?? "icons/svg/mystery-man.svg",
      type: profile.sourceType
    },
    rows,
    trustedBodyHtml: `
      <p>${safeDescription}</p>
      ${safeGroupDetail ? `<p><b>Résolution de groupe :</b> ${safeGroupDetail}</p>` : ""}
      ${safeNote ? `<p><b>Note :</b> ${safeNote}</p>` : ""}
      <p><em>${profile.classKey === "magicien"
        ? "Les cibles sélectionnées représentent les créatures qui déclenchent actuellement le symbole ; l’inscription physique et son déclenchement de scène restent sous le contrôle du MD."
        : "Les cibles sélectionnées représentent les créatures qui voient actuellement le symbole clérical."}</em></p>
    `,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: resolution.rolls,
      flags: {
        add2e: {
          spell: "symbole",
          symbolVariant: variant.id,
          symbolClass: profile.classKey,
          version: ADD2E_SYMBOLE_VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const sourceItem = add2eSymboleSourceItem();
const caster = (typeof actor !== "undefined" ? actor : null) ?? sourceItem?.parent ?? null;
if (!caster || !sourceItem) {
  ui.notifications.error("Symbole : lanceur ou Item sort introuvable.");
  return false;
}

const engine = add2eSymboleRequireApis();
const profile = add2eSymboleProfile(sourceItem);
if (!profile) {
  ui.notifications.error("Symbole : la liste canonique de l’Item doit identifier exactement Clerc ou Magicien.");
  return false;
}
const casterLevel = add2eSymboleCasterLevel(caster, profile);
const targets = add2eSymboleTargets();
if (!targets.length) {
  ui.notifications.warn("Symbole : sélectionne au moins une créature qui voit ou déclenche le symbole.");
  return false;
}

const parameters = await add2eSymboleParameters(profile, targets);
if (!parameters) {
  ui.notifications.info("Symbole annulé.");
  return false;
}
const baseVariant = profile.variants[parameters.variant];
if (!baseVariant) {
  ui.notifications.error("Symbole : variante inconnue pour cette liste de sorts.");
  return false;
}
const variant = { ...baseVariant, id: parameters.variant };

try {
  const resolution = await add2eSymboleResolve(caster, sourceItem, profile, variant, casterLevel, targets, engine);
  await add2eSymboleChat(caster, add2eSymboleCasterToken(), sourceItem, profile, variant, casterLevel, targets, parameters, resolution);
  return true;
} catch (error) {
  console.error("[ADD2E][SYMBOLE]", error);
  ui.notifications.error(`Symbole : ${error?.message ?? "erreur de résolution"}`);
  return false;
}