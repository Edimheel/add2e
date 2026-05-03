/**********************************************************************
 * ADD2E — Sort CHUTE DE PLUME v13 (modèle “LUMIÈRE” / sockets + droits)
 * SemVer: 1.1.0
 * Build: 2025-12-13
 * Changelog:
 * - Ciblage: si aucune cible => lanceur ; sinon => uniquement les cibles.
 * - Droits: application/cleanup via socket GM si nécessaire (comme Lumière).
 * - Chat: message normalisé (carte ADD2E + dissipation).
 **********************************************************************/

console.log("%c[ADD2E][CHUTE] v1.1.0", "color:#9b59b6;font-weight:bold;");

return await (async () => {
  // =======================================================
  // 1) INITIALISATION
  // =======================================================
  let _item = null;
  if (typeof item !== "undefined" && item?.name) _item = item;
  else if (typeof arguments !== "undefined" && arguments?.length > 1 && arguments[1]?.name) _item = arguments[1];
  if (!_item) return ui.notifications.warn("Sort introuvable.");

  const caster = actor ?? _item?.parent;
  if (!caster) return ui.notifications.warn("Lanceur introuvable.");

  const casterToken = caster.getActiveTokens?.()?.[0] ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === caster.id) ?? null;

  // =======================================================
  // 2) CIBLES (MODELE DEMANDÉ)
  // - Si pas de cible => lanceur
  // - Sinon => cibles uniquement
  // =======================================================
  let targets = Array.from(game.user.targets ?? []);
  let appliedOnSelf = false;

  if (targets.length === 0) {
    if (!casterToken) return ui.notifications.warn("Aucune cible et aucun token lanceur trouvé.");
    targets = [casterToken];
    appliedOnSelf = true;
  }

  // =======================================================
  // 3) PARAMÈTRES & DURÉE
  // =======================================================
  const info = _item.system ?? {};
  const niveauPerso = Number(caster.system?.niveau ?? caster.system?.attributes?.level?.value ?? 1) || 1;

  // AD&D: 1 créature / niveau (warning seulement, on ne “coupe” pas)
  if (targets.length > niveauPerso) {
    ui.notifications.warn(`Chute de plume : ${targets.length} cibles, maximum conseillé ${niveauPerso} (niveau ${niveauPerso}).`);
  }

  const dureeRounds = Math.max(1, niveauPerso);
  const durationData = {
    rounds: dureeRounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null
  };

  const effectName = "Chute de plume";
  const iconEffect = _item.img || "icons/magic/air/wind-feather-falling-purple.webp";

  // =======================================================
  // 4) SOCKET — EMISSION (comme Lumière)
  // =======================================================
  const SOCKET = "system.add2e";
  const emitToGM = async (payload) => {
    if (!game.socket) return false;
    game.socket.emit(SOCKET, payload);
    return true;
  };

  const canEditActor = (a) => {
    try {
      return a?.isOwner === true || game.user?.isGM === true;
    } catch (e) {
      return false;
    }
  };

  const deleteExistingByOrigin = async (a, originUuid) => {
    const old = a?.effects?.find(e => e?.origin === originUuid);
    if (!old) return;
    if (canEditActor(a)) return old.delete();
    await emitToGM({
      type: "deleteActiveEffect",
      actorId: a.id,
      effectId: old.id,
      fromUserId: game.user.id,
      sentAt: Date.now()
    });
  };

  const applyEffect = async (a, effectData) => {
    if (canEditActor(a)) {
      return a.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
    await emitToGM({
      type: "applyActiveEffect",
      actorId: a.id,
      effectData,
      fromUserId: game.user.id,
      sentAt: Date.now()
    });
  };

  // =======================================================
  // 5) HOOK GLOBAL — DISSIPATION (message chat normalisé)
  // =======================================================
  if (!globalThis.add2eFeatherFallHookRegistered) {
    globalThis.add2eFeatherFallHookRegistered = true;

    const postDissipateChat = async (effect) => {
      const flagData = effect?.flags?.add2e?.featherPayload;
      if (!flagData) return;

      const parentActor = effect.parent;
      const who = parentActor?.name ?? "Une créature";
      const content = `
        <div class="add2e-system-note" style="border:1px solid #ddd;border-radius:10px;padding:8px 10px;background:#fafafa;">
          <div style="font-weight:700;color:#444;">Effet dissipé</div>
          <div style="margin-top:2px;color:#555;">
            <b>${who}</b> n’est plus sous <b>${effect.name}</b>.
          </div>
        </div>
      `;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: parentActor ?? null }),
        content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      });
    };

    Hooks.on("deleteActiveEffect", postDissipateChat);
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes?.disabled === true) postDissipateChat(effect);
    });
  }

  // =======================================================
  // 6) APPLICATION (BOUCLE)
  // =======================================================
  const appliedNames = [];

  for (const target of targets) {
    const targetActor = target?.actor;
    if (!targetActor) continue;

    await deleteExistingByOrigin(targetActor, _item.uuid);

    const effectData = {
      name: effectName,
      icon: iconEffect,
      origin: _item.uuid,
      duration: durationData,
      description: "Tombe lentement. Aucun dégât de chute.",
      changes: [],
      flags: {
        add2e: {
          tags: ["chute_plume", "immunite:degats_chute"],
          featherPayload: {
            castBy: caster.id,
            castByName: caster.name,
            itemUuid: _item.uuid
          }
        }
      }
    };

    await applyEffect(targetActor, effectData);
    appliedNames.push(target.name ?? targetActor.name ?? "Cible");

    // VFX (optionnel)
    if (game.modules.get("sequencer")?.active) {
      new Sequence()
        .effect()
          .file("jb2a.feathers.01.purple")
          .atLocation(target)
          .scaleToObject(1.2)
          .duration(3000)
          .fadeOut(500)
        .play();
    }
  }

  // =======================================================
  // 7) MESSAGE CHAT — NORMALISÉ
  // =======================================================
  const formatVal = (val) => {
    if (typeof globalThis.formatSortChamp === "function") return globalThis.formatSortChamp(val, niveauPerso);
    return val?.valeur ? `${val.valeur} ${val.unite}` : (val ?? "-");
  };

  const detailsData = [
    { label: "École",   val: info.école ?? "-" },
    { label: "Niveau",  val: info.niveau ?? "-" },
    { label: "Portée",  val: formatVal(info.portee) },
    { label: "Durée",   val: `${dureeRounds} round(s)` },
    { label: "Cibles",  val: `${appliedNames.length} / ${niveauPerso} max` },
    { label: "Incant.", val: formatVal(info.temps_incantation) }
  ];

  const appliedLine = appliedOnSelf
    ? `Appliqué sur le lanceur : <b>${appliedNames.join(", ") || caster.name}</b>`
    : `Appliqué sur : <b>${appliedNames.join(", ") || "-"}</b>`;

  const chatContent = `
    <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #00000022; background:linear-gradient(135deg,#ffffff 0%,#f6f0ff 100%); border:1.5px solid #9b59b6; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
      <div style="background:linear-gradient(90deg,#6a3c99 0%,#8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
        <img src="${caster.img}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
        <div style="line-height:1.2;">
          <div style="font-weight:700; font-size:1.05em;">${caster.name}</div>
          <div style="font-size:0.85em; opacity:0.95;">lance <span style="font-weight:800; color:#f1c40f;">${_item.name}</span></div>
        </div>
        <img src="${_item.img}" style="width:32px;height:32px;margin-left:auto;border-radius:4px;background:#fff;">
      </div>

      <div style="padding:10px 10px 6px 10px;">
        <div style="background:#f3ecff; border:1px solid #d9c6ff; border-radius:8px; padding:8px; text-align:center; margin-bottom:10px;">
          <div style="color:#5e35b1; font-weight:800; font-size:1.05em;">Chute ralentie</div>
          <div style="font-size:0.9em; color:#4b3a66; margin-top:3px;">${appliedLine}</div>
        </div>

        <details style="background:#fff; border:1px solid #e0d4fc; border-radius:8px;">
          <summary style="cursor:pointer; color:#6a3c99; font-weight:700; font-size:0.9em; padding:7px 10px; background:#efe9f6; border-radius:8px; list-style:none;">
            Détails & description
          </summary>
          <div style="padding:10px;">
            <table style="width:100%; font-size:0.85em; border-spacing:0; margin-bottom:10px; color:#333; border-bottom:1px solid #eee;">
              ${detailsData.map((d, i) => `
                <tr style="${i % 2 === 0 ? "background:#faf7ff;" : ""}">
                  <td style="color:#6a3c99; font-weight:700; padding:4px 6px; width:40%;">${d.label}</td>
                  <td style="text-align:right; padding:4px 6px;">${d.val}</td>
                </tr>
              `).join("")}
            </table>

            <div style="color:#4a3b69; font-size:0.9em; line-height:1.45;">
              <div style="font-weight:800; margin-bottom:4px;">Description</div>
              <div style="text-align:justify;">
                ${info.description || "<em>Aucune description.</em>"}
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: chatContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });

  // Référence interne (projet) :contentReference[oaicite:0]{index=0}

  return true;
})();
