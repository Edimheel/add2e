// ADD2E — onUse canonique : Bruitage.
// Magicien : portée 6 + niveau cases, durée 2 rounds/niveau.
// Illusionniste : portée 6 + niveau cases, durée 3 rounds/niveau.
// Zone d'effet : portée d'ouïe ; aucun rayon artificiel n'est inventé.
// Compatible Foundry V13/V14/V15 — fenêtre ADD2E commune.

return await (async () => {
  const VERSION = "2026-08-08-bruitage-foundry-v1";
  const SPELL_SLUG = "bruitage";
  const METERS_PER_SCALE_INCH = 3;

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const toArray = value => {
    if (Array.isArray(value)) return value.flatMap(toArray).filter(Boolean);
    if (value instanceof Set) return [...value].flatMap(toArray).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
    return value === undefined || value === null || value === "" ? [] : [value];
  };

  const escapeHtml = value => {
    const text = String(value ?? "");
    try {
      if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
    } catch (_error) {}
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const spellItem = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (typeof sourceItem !== "undefined" && sourceItem)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.item ?? args[0]?.sort ?? args[0]?.sourceItem : null)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || spellItem?.parent
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.actor : null)
    || null;
  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster?.id ? token : null)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.token : null)
    || canvas?.tokens?.controlled?.find?.(entry => entry?.actor?.id === caster?.id)
    || caster?.getActiveTokens?.()?.[0]
    || null;

  if (!caster || !spellItem) {
    ui.notifications?.warn?.("Bruitage : lanceur ou sort introuvable.");
    return false;
  }
  if (!casterToken) {
    if (typeof globalThis.add2eDialogAlert === "function") {
      await globalThis.add2eDialogAlert({
        add2eTheme: "wizard",
        window: { title: "Bruitage" },
        content: "<p>Le lanceur doit disposer d’un token sur la scène pour déterminer la source et la portée du bruit.</p>"
      });
    } else {
      ui.notifications?.error?.("Bruitage : le lanceur doit disposer d’un token sur la scène.");
    }
    return false;
  }

  const system = spellItem.system ?? {};
  const primaryClassKeys = [system.classe, system.class, system.spellLists, system.liste]
    .flatMap(toArray).map(normalize).filter(Boolean);
  const illusionist = primaryClassKeys.includes("illusionniste") || primaryClassKeys.includes("illusionist");
  const classKey = illusionist ? "illusionniste" : "magicien";
  const classLabel = illusionist ? "Illusionniste" : "Magicien";

  let casterLevel = 0;
  if (typeof globalThis.add2eCanonicalClassLevel === "function") {
    try { casterLevel = Number(globalThis.add2eCanonicalClassLevel(caster, classKey, 0)) || 0; }
    catch (_error) { casterLevel = 0; }
  }
  if (casterLevel < 1) {
    const classItem = Array.from(caster.items ?? []).find(entry => {
      if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
      return [entry?.system?.slug, entry?.system?.label, entry?.system?.nom, entry?.system?.name, entry?.name]
        .map(normalize)
        .includes(classKey);
    }) ?? null;
    casterLevel = Number(classItem?.system?.niveau ?? classItem?.system?.level) || 0;
  }
  if (casterLevel < 1) {
    ui.notifications?.error?.(`Bruitage : niveau de ${classLabel.toLowerCase()} introuvable sur l'Item classe.`);
    return false;
  }
  casterLevel = Math.max(1, Math.floor(casterLevel));

  const rangeSpaces = 6 + casterLevel;
  const rangeMeters = rangeSpaces * METERS_PER_SCALE_INCH;
  const durationPerLevel = illusionist ? 3 : 2;
  const durationRounds = durationPerLevel * casterLevel;
  const minimumCastingLevel = illusionist ? 1 : 3;
  const volumeMen = Math.max(4, 4 * (casterLevel - minimumCastingLevel + 1));

  const selectedTargets = Array.from(game.user?.targets ?? []).filter(entry => entry?.actor);
  if (selectedTargets.length > 1) {
    if (typeof globalThis.add2eDialogAlert === "function") {
      await globalThis.add2eDialogAlert({
        add2eTheme: "wizard",
        window: { title: "Bruitage" },
        content: "<p>Sélectionne au maximum un token : il peut servir de point d’origine au bruit.</p>"
      });
    } else {
      ui.notifications?.warn?.("Bruitage : sélectionne au maximum un token source.");
    }
    return false;
  }
  const targetToken = selectedTargets[0] ?? null;

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("Bruitage : l’API de fenêtre ADD2E est indisponible.");
  }

  const targetOption = targetToken
    ? `<option value="target">Token ciblé — ${escapeHtml(targetToken.name ?? targetToken.actor?.name ?? "Cible")}</option>`
    : "";
  const choice = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-bruitage-dialog"],
    window: { title: "Bruitage" },
    content: `
      <form class="add2e-bruitage-form">
        <div class="form-group">
          <label>Source apparente du bruit</label>
          <select name="sourceAnchor">
            <option value="caster">Lanceur — ${escapeHtml(casterToken.name ?? caster.name)}</option>
            ${targetOption}
          </select>
        </div>
        <div class="form-group">
          <label>Déplacement apparent</label>
          <select name="movement">
            <option value="fixed">Reste au même endroit</option>
            <option value="approach">Semble se rapprocher</option>
            <option value="away">Semble s’éloigner</option>
          </select>
        </div>
        <div class="form-group">
          <label>Bruit créé</label>
          <input type="text" name="soundDescription" value="Bruit illusoire" autocomplete="off">
        </div>
        <p><b>Portée maximale :</b> ${rangeSpaces} cases (${rangeMeters} m)</p>
        <p><b>Volume maximal :</b> équivalent à ${volumeMen} hommes.</p>
        <p><b>Zone :</b> portée d’ouïe. Le jet de protection spécial n’est effectué que par une créature qui met l’illusion en doute.</p>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Créer le bruit",
        icon: "<i class='fas fa-volume-high'></i>",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          return {
            sourceAnchor: String(form.elements.sourceAnchor?.value ?? "caster"),
            movement: String(form.elements.movement?.value ?? "fixed"),
            soundDescription: String(form.elements.soundDescription?.value ?? "Bruit illusoire").trim() || "Bruit illusoire"
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
  if (!choice) return false;

  const sourceToken = choice.sourceAnchor === "target" && targetToken ? targetToken : casterToken;
  const point = tokenObject => {
    if (tokenObject?.center) return { x: Number(tokenObject.center.x), y: Number(tokenObject.center.y) };
    const doc = tokenObject?.document ?? tokenObject;
    const gridSize = Number(canvas?.grid?.size || 100) || 100;
    return {
      x: Number(doc?.x || 0) + Number(doc?.width || 1) * gridSize / 2,
      y: Number(doc?.y || 0) + Number(doc?.height || 1) * gridSize / 2
    };
  };
  const casterPoint = point(casterToken);
  const sourcePoint = point(sourceToken);

  const measureSpaces = (from, to) => {
    const grid = canvas?.grid;
    const gridSize = Number(grid?.size || 100) || 100;
    if (typeof grid?.measurePath === "function") {
      try {
        const result = grid.measurePath([from, to], { gridSpaces: true });
        const measured = Number(result?.distance ?? result?.gridDistance ?? result?.spaces ?? result?.cost ?? result);
        if (Number.isFinite(measured)) return measured;
      } catch (error) {
        console.warn("[ADD2E][BRUITAGE][DISTANCE][MEASURE_PATH]", error);
      }
    }
    return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / gridSize;
  };

  const sourceDistanceSpaces = measureSpaces(casterPoint, sourcePoint);
  if (sourceDistanceSpaces > rangeSpaces + 0.001) {
    if (typeof globalThis.add2eDialogAlert === "function") {
      await globalThis.add2eDialogAlert({
        add2eTheme: "wizard",
        window: { title: "Bruitage — hors de portée" },
        content: `<p>La source choisie se trouve à <b>${sourceDistanceSpaces.toFixed(1)} cases</b>, au-delà de la portée maximale de <b>${rangeSpaces} cases</b>.</p>`
      });
    } else {
      ui.notifications?.warn?.("Bruitage : source sonore hors de portée.");
    }
    return false;
  }

  const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  if (typeof timeEngine?.effectData !== "function") {
    ui.notifications?.error?.("Bruitage : moteur de durée ADD2E indisponible.");
    return false;
  }

  const movementLabels = {
    fixed: "fixe",
    approach: "se rapproche",
    away: "s’éloigne"
  };
  const movementLabel = movementLabels[choice.movement] ?? movementLabels.fixed;
  const sourceLabel = sourceToken.name ?? sourceToken.actor?.name ?? caster.name;

  const effectData = timeEngine.effectData({
    name: "Bruitage",
    img: spellItem.img ?? "icons/svg/sound.svg",
    origin: spellItem.uuid ?? null,
    rounds: durationRounds,
    unit: "round",
    description: `${choice.soundDescription} — source apparente ${movementLabel}, volume maximal équivalent à ${volumeMen} hommes.`,
    tags: [
      `sort:${SPELL_SLUG}`,
      `classe:${classKey}`,
      `liste:${classKey}`,
      "ecole:illusion_fantasme",
      "illusion:son",
      "bruitage",
      `source:${choice.sourceAnchor}`,
      `mouvement:${choice.movement}`,
      `volume_hommes:${volumeMen}`,
      `portee_cases:${rangeSpaces}`,
      `duree_rounds:${durationRounds}`,
      "zone:portee_ouie",
      "jet:special_si_doute"
    ],
    changes: [],
    source: "spell",
    caster,
    sourceItem: spellItem,
    endMessage: "Le bruit illusoire créé par {actor} cesse.",
    extraFlags: {
      bruitage: {
        version: VERSION,
        spell: SPELL_SLUG,
        classKey,
        classLabel,
        casterLevel,
        rangeSpaces,
        rangeMeters,
        durationRounds,
        durationPerLevel,
        volumeMen,
        sourceAnchor: choice.sourceAnchor,
        sourceTokenId: sourceToken.document?.id ?? sourceToken.id ?? null,
        sourceActorId: sourceToken.actor?.id ?? null,
        sceneId: sourceToken.document?.parent?.id ?? canvas?.scene?.id ?? null,
        sourcePoint,
        sourceDistanceSpaces,
        movement: choice.movement,
        movementLabel,
        soundDescription: choice.soundDescription,
        area: "hearing-range",
        savingThrow: "special-on-disbelief"
      },
      spell: {
        version: VERSION,
        slug: SPELL_SLUG,
        name: "Bruitage",
        class: classLabel,
        level: illusionist ? 1 : 2,
        casterLevel,
        sourceItemId: spellItem.id ?? null,
        sourceItemUuid: spellItem.uuid ?? null
      }
    }
  });
  effectData.type = "base";
  effectData.system ??= {};
  effectData.changes ??= [];

  const existing = Array.from(caster.effects ?? []).filter(effect =>
    effect?.disabled !== true
    && (effect?.flags?.add2e?.bruitage?.spell === SPELL_SLUG
      || toArray(effect?.flags?.add2e?.tags).map(normalize).includes("sort_bruitage"))
  );
  const canModifyActor = game.user?.isGM === true
    || caster.isOwner === true
    || caster.testUserPermission?.(game.user, "OWNER") === true;
  let relayed = false;

  if (canModifyActor) {
    if (existing.length) await caster.deleteEmbeddedDocuments("ActiveEffect", existing.map(effect => effect.id).filter(Boolean));
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
    const effect = created?.[0] ?? null;
    if (!effect) {
      ui.notifications?.error?.("Bruitage : création de l'effet impossible.");
      return false;
    }
    if (typeof timeEngine?.normalizeEffect === "function") {
      try { await timeEngine.normalizeEffect(effect, Number(game.combat?.round) || 0); }
      catch (error) { console.warn("[ADD2E][BRUITAGE][TIME_NORMALIZE]", error); }
    }
  } else {
    const activeGm = game.users?.activeGM
      ?? Array.from(game.users ?? []).find(user => user.active && user.isGM)
      ?? null;
    if (!game.socket || (!game.user?.isGM && !activeGm)) {
      ui.notifications?.error?.("Bruitage : aucun MJ actif pour appliquer l'effet.");
      return false;
    }
    if (existing.length) {
      game.socket.emit("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "deleteActiveEffects",
        payload: {
          actorId: caster.id ?? null,
          actorUuid: caster.uuid ?? null,
          effectIds: existing.map(effect => effect.id).filter(Boolean),
          fromUserId: game.user.id,
          sentAt: Date.now()
        }
      });
    }
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorId: caster.id ?? null,
        actorUuid: caster.uuid ?? null,
        effectData,
        fromUserId: game.user.id,
        sentAt: Date.now()
      }
    });
    relayed = true;
  }

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Bruitage : API commune des cartes ADD2E indisponible.");
  }

  const card = {
    actor: caster,
    title: "Bruitage",
    icon: "fas fa-volume-high",
    variant: "spell",
    source: {
      name: caster.name ?? casterToken.name ?? classLabel,
      img: casterToken.document?.texture?.src ?? caster.img,
      type: `Sort de ${classLabel.toLowerCase()}`,
      meta: spellItem.name ?? "Bruitage"
    },
    rows: [
      { label: "Source apparente", value: `${sourceLabel} · ${sourceDistanceSpaces.toFixed(1)} case${sourceDistanceSpaces > 1 ? "s" : ""}` },
      { label: "Déplacement", value: movementLabel },
      { label: "Bruit", value: choice.soundDescription },
      { label: "Volume maximal", value: `≈ ${volumeMen} hommes` },
      { label: "Portée maximale", value: `${rangeSpaces} cases (${rangeMeters} m)` },
      { label: "Zone", value: "Portée d’ouïe" },
      { label: "Durée", value: `${durationRounds} rounds (${durationPerLevel} rounds/niveau)` },
      { label: "Jet de protection", value: "Spécial — seulement si la créature met le bruit en doute" }
    ],
    trustedBodyHtml: relayed
      ? "<div><small>Application de l’effet demandée au MJ.</small></div>"
      : "",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          version: VERSION,
          spell: SPELL_SLUG,
          classKey,
          casterLevel,
          rangeSpaces,
          durationRounds,
          volumeMen,
          sourceTokenId: sourceToken.document?.id ?? sourceToken.id ?? null,
          movement: choice.movement
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Bruitage : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(card);

  return true;
})();
