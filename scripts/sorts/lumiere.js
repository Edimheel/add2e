/**
 * ADD2E — Sort LUMIÈRE
 * Foundry V13/V14
 *
 * - DialogV2 natif uniquement
 * - Mode créature : lumière sur token + ActiveEffect
 * - Mode sol : Warpgate crosshairs + AmbientLight
 * - Côté joueur : utilise le relais MJ générique ADD2E_GM_OPERATION
 *
 * Corrections :
 * - effet actif créé sur le lanceur en mode sol
 * - suppression/restauration de la lumière quand l’effet actif est supprimé
 * - sauvegarde automatique si la cible est un autre acteur
 * - sauvegarde monstre lue depuis la fiche monstre : calculatedSaves.sorts
 * - aucun fallback 14
 * - suppression du double affichage du d20
 * - aucun socket spécifique à Lumière
 */

console.log("%c[ADD2E][LUMIERE] V13/V14-DIALOGV2-GM-RELAY", "color:#e67e22;font-weight:bold;");

const ADD2E_LUMIERE_VERSION = "2026-04-29-gm-relay";

// =========================================================
// FONCTIONS GLOBALES — réassignées à chaque exécution
// pendant les tests pour éviter de garder une ancienne version.
// =========================================================

globalThis.ADD2E_LUMIERE_IS_RESPONSIBLE_GM = function () {
  if (!game.user.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users.activeGM?.id === game.user.id;
};

globalThis.ADD2E_LUMIERE_FIND_AMBIENT = function (payload) {
  if (!payload) return null;

  const scene = game.scenes.get(payload.sceneId) || canvas.scene;
  if (!scene) return null;

  let lightDoc = null;

  if (payload.lightId) {
    lightDoc = scene.lights?.get(payload.lightId) || null;
  }

  if (!lightDoc && payload.requestId) {
    lightDoc = scene.lights?.find(l =>
      l.flags?.add2e?.requestId === payload.requestId ||
      l.getFlag?.("add2e", "requestId") === payload.requestId
    ) || null;
  }

  if (
    !lightDoc &&
    Number.isFinite(Number(payload.x)) &&
    Number.isFinite(Number(payload.y))
  ) {
    const px = Number(payload.x);
    const py = Number(payload.y);

    lightDoc = scene.lights?.find(l => {
      const lx = Number(l.x);
      const ly = Number(l.y);

      const samePos =
        Number.isFinite(lx) &&
        Number.isFinite(ly) &&
        Math.abs(lx - px) < 4 &&
        Math.abs(ly - py) < 4;

      const sameSpell =
        !payload.spellName ||
        l.flags?.add2e?.spellName === payload.spellName ||
        l.getFlag?.("add2e", "spellName") === payload.spellName;

      const sameActor =
        !payload.actorId ||
        l.flags?.add2e?.actorId === payload.actorId ||
        l.flags?.add2e?.actorUuid === payload.actorUuid ||
        l.getFlag?.("add2e", "actorId") === payload.actorId ||
        l.getFlag?.("add2e", "actorUuid") === payload.actorUuid;

      return samePos && sameSpell && sameActor;
    }) || null;
  }

  return lightDoc;
};

globalThis.ADD2E_LUMIERE_WAIT_FOR_AMBIENT = async function (payload, tries = 8, delay = 250) {
  for (let i = 0; i < tries; i++) {
    const found = globalThis.ADD2E_LUMIERE_FIND_AMBIENT(payload);
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return null;
};

globalThis.ADD2E_LUMIERE_CREATE_AMBIENT_LOCAL = async function (scene, ambientData) {
  const created = await scene.createEmbeddedDocuments("AmbientLight", [ambientData]);
  return created?.[0] ?? null;
};

globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION = function (operation, payload) {
  const message = {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: {
      ...(payload ?? {}),
      fromUserId: game.user.id,
      sentAt: Date.now()
    }
  };

  console.log("[ADD2E][LUMIERE][GM-RELAY] emit :", message);
  game.socket?.emit("system.add2e", message);
};

globalThis.ADD2E_LUMIERE_DELETE_AMBIENT = async function (payload) {
  try {
    if (!payload || payload.type !== "ambient") return;

    const scene = game.scenes.get(payload.sceneId) || canvas.scene;
    if (!scene) {
      console.warn("[ADD2E][LUMIERE][CLEANUP] scène introuvable", payload);
      return;
    }

    const lightDoc = globalThis.ADD2E_LUMIERE_FIND_AMBIENT(payload);

    if (game.user.isGM) {
      if (!lightDoc) {
        console.warn("[ADD2E][LUMIERE][CLEANUP] aucune lumière trouvée côté GM", payload);
        return;
      }

      console.log("[ADD2E][LUMIERE][CLEANUP] suppression AmbientLight locale", {
        sceneId: scene.id,
        lightId: lightDoc.id,
        payload
      });

      await lightDoc.delete();
      return;
    }

    globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION("deleteAmbientLight", {
      sceneId: scene.id,
      lightId: lightDoc?.id ?? payload.lightId ?? null,
      requestId: payload.requestId ?? null,
      actorId: payload.actorId ?? null,
      actorUuid: payload.actorUuid ?? null,
      spellName: payload.spellName ?? "Lumière",
      x: payload.x ?? null,
      y: payload.y ?? null
    });
  } catch (e) {
    console.error("[ADD2E][LUMIERE][CLEANUP] erreur suppression AmbientLight", e);
  }
};

globalThis.ADD2E_LUMIERE_RESTORE_TOKEN_LIGHT = async function (payload) {
  try {
    if (!payload || payload.type !== "token") return;

    const scene = game.scenes.get(payload.sceneId) || canvas.scene;
    if (!scene) return;

    const tokenDoc = scene.tokens.get(payload.tokenId);
    if (!tokenDoc) return;

    const restoreData = {
      "light.dim": payload.originalDim ?? 0,
      "light.bright": payload.originalBright ?? 0,
      "light.color": payload.originalColor ?? null,
      "light.alpha": payload.originalAlpha ?? 0.5,
      "light.angle": payload.originalAngle ?? 360,
      "light.animation": payload.originalAnimation ?? {
        type: null,
        speed: 5,
        intensity: 5,
        reverse: false
      }
    };

    if (game.user.isGM || tokenDoc.isOwner) {
      console.log("[ADD2E][LUMIERE][CLEANUP] restauration lumière token locale", {
        tokenId: tokenDoc.id,
        tokenName: tokenDoc.name,
        restoreData
      });

      await tokenDoc.update(restoreData);
      return;
    }

    globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION("updateToken", {
      sceneId: scene.id,
      tokenId: tokenDoc.id,
      updateData: restoreData
    });
  } catch (e) {
    console.error("[ADD2E][LUMIERE][CLEANUP] erreur restauration token", e);
  }
};

// =========================================================
// HOOKS CLEANUP
// Enregistrés une seule fois par version.
// =========================================================

if (globalThis.ADD2E_LUMIERE_HOOKS_VERSION !== ADD2E_LUMIERE_VERSION) {
  globalThis.ADD2E_LUMIERE_HOOKS_VERSION = ADD2E_LUMIERE_VERSION;

  const cleanupEffect = async effect => {
    const payload =
      effect?.flags?.add2e?.lightPayload ??
      effect?.getFlag?.("add2e", "lightPayload");

    if (!payload) return;

    if (payload.type === "ambient") {
      await globalThis.ADD2E_LUMIERE_DELETE_AMBIENT(payload);
      return;
    }

    if (payload.type === "token") {
      await globalThis.ADD2E_LUMIERE_RESTORE_TOKEN_LIGHT(payload);
      return;
    }
  };

  Hooks.on("deleteActiveEffect", async effect => {
    await cleanupEffect(effect);
  });

  Hooks.on("updateActiveEffect", async (effect, changes) => {
    if (changes?.disabled === true) {
      await cleanupEffect(effect);
    }
  });
}

// =========================================================
// SORT
// =========================================================

return await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (!DialogV2) {
    ui.notifications.error("DialogV2 est introuvable. Ce script nécessite Foundry V13/V14.");
    return false;
  }

  let sourceItem =
    (typeof item !== "undefined" && item)
      ? item
      : ((typeof sort !== "undefined" && sort) ? sort : this);

  if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) {
    sourceItem = args[0].item;
  }

  if (!sourceItem) {
    ui.notifications.error("Sort introuvable.");
    return false;
  }

  const casterTokenObj =
    canvas.tokens.controlled[0]
    ?? ((typeof token !== "undefined" && token) ? token : null);

  if (!casterTokenObj) {
    ui.notifications.warn("Sélectionne le token du lanceur avant d’utiliser Lumière.");
    return false;
  }

  const casterTokenDoc = casterTokenObj.document;
  const caster = casterTokenObj.actor ?? sourceItem.parent ?? actor;

  if (!caster) {
    ui.notifications.error("Lanceur introuvable.");
    return false;
  }

  console.log("[ADD2E][LUMIERE] caster:", {
    casterName: caster.name,
    casterId: caster.id,
    casterUuid: caster.uuid,
    casterTokenId: casterTokenDoc.id,
    casterTokenName: casterTokenDoc.name,
    actorLink: casterTokenDoc.actorLink,
    user: game.user.name,
    isGM: game.user.isGM,
    activeGM: game.users.activeGM?.name
  });

  const niveau = Number(caster.system?.niveau) || 1;
  const dureeRounds = Math.max(10, niveau * 10);
  const rayon = 6;

  const lightColor = "#fffec4";
  const lightAnim = {
    type: "torch",
    speed: 2,
    intensity: 2,
    reverse: false
  };

  const durationData = {
    rounds: dureeRounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time.worldTime
  };

  const content = `
    <form class="add2e-lumiere-form" style="font-family:var(--font-primary); display:flex; flex-direction:column; gap:8px;">
      <div class="form-group">
        <label style="font-weight:bold;">Cible :</label>
        <select name="mode" style="width:100%;">
          <option value="creature">Sur une créature ciblée</option>
          <option value="ground">Au sol</option>
        </select>
      </div>

      <div style="font-size:0.9em; color:#666; border-top:1px solid #ddd; padding-top:6px;">
        <div><b>Durée :</b> ${dureeRounds} rounds</div>
        <div><b>Rayon faible :</b> ${rayon} m</div>
        <div><b>Rayon vif :</b> ${rayon / 2} m</div>
        <div style="margin-top:4px;">
          Si la cible est un autre acteur que le lanceur, un jet de sauvegarde contre les sortilèges est lancé automatiquement.
        </div>
      </div>
    </form>
  `;

  const dialogResult = await DialogV2.wait({
    window: {
      title: "Lancement : Lumière"
    },
    content,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-sun",
        default: true,
        callback: (event, button) => {
          return {
            mode: String(button.form.elements.mode?.value || "creature")
          };
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });

  if (!dialogResult) return false;

  const mode = dialogResult.mode;

  console.log("[ADD2E][LUMIERE] mode:", mode);

  let statusHtml = "";
  let cibleTxt = mode === "creature" ? "Cible" : "Sol";

  // =======================================================
  // MODE CRÉATURE
  // =======================================================
  if (mode === "creature") {
    const targets = Array.from(game.user.targets ?? []);

    console.log("[ADD2E][LUMIERE] creature | targets:", targets.map(t => ({
      id: t.id,
      name: t.name,
      actorId: t.actor?.id,
      actorUuid: t.actor?.uuid,
      disposition: t.document?.disposition
    })));

    if (!targets.length) {
      ui.notifications.warn("Veuillez sélectionner un token cible avec l’outil de ciblage.");
      return false;
    }

    const targetTokenObj = targets[0];
    const targetTokenDoc = targetTokenObj.document;
    const targetActorDoc = targetTokenObj.actor;
    const sceneId = targetTokenDoc.parent?.id || canvas.scene?.id || null;

    if (!targetActorDoc) {
      ui.notifications.error("La cible n’a pas d’acteur.");
      return false;
    }

    cibleTxt = targetTokenDoc.name;

    const sameToken =
      String(targetTokenDoc.id) === String(casterTokenDoc.id) &&
      String(sceneId) === String(casterTokenDoc.parent?.id || canvas.scene?.id || "");

    const sameActor =
      !!targetActorDoc.uuid &&
      !!caster.uuid &&
      String(targetActorDoc.uuid) === String(caster.uuid);

    const needsSave = !(sameToken || sameActor);

    console.log("[ADD2E][LUMIERE] creature | target:", {
      tokenId: targetTokenDoc.id,
      tokenName: targetTokenDoc.name,
      sceneId,
      targetActorId: targetActorDoc.id,
      targetActorUuid: targetActorDoc.uuid,
      casterActorId: caster.id,
      casterActorUuid: caster.uuid,
      targetType: targetActorDoc.type,
      sameToken,
      sameActor,
      needsSave,
      isOwner: targetTokenDoc.isOwner,
      userIsGM: game.user.isGM
    });

    let saveVal = NaN;

    if (needsSave) {
      if (targetActorDoc.type === "monster") {
        try {
          const monsterSheetData = await targetActorDoc.sheet.getData();
          saveVal = Number(monsterSheetData?.calculatedSaves?.sorts);

          console.log("[ADD2E][LUMIERE] sauvegarde monstre depuis fiche :", {
            target: targetActorDoc.name,
            savingThrowsKey: targetActorDoc.system?.savingThrows,
            calculatedSaves: foundry.utils.duplicate(monsterSheetData?.calculatedSaves ?? null),
            saveVal
          });
        } catch (e) {
          console.error("[ADD2E][LUMIERE] impossible de lire calculatedSaves depuis la fiche monstre :", e);
        }

        if (!Number.isFinite(saveVal) || saveVal <= 0) {
          ui.notifications.error(
            `Impossible de lire la sauvegarde contre les sortilèges de ${targetActorDoc.name} depuis la fiche monstre.`
          );
          return false;
        }
      } else {
        saveVal = Number(targetActorDoc.system?.sauvegarde_sortileges);

        if (!Number.isFinite(saveVal) || saveVal <= 0) {
          ui.notifications.error(
            `Impossible de lire la sauvegarde contre les sortilèges de ${targetActorDoc.name}.`
          );

          console.error("[ADD2E][LUMIERE] sauvegarde personnage introuvable :", {
            target: targetActorDoc.name,
            type: targetActorDoc.type,
            sauvegarde_sortileges: targetActorDoc.system?.sauvegarde_sortileges,
            system: foundry.utils.duplicate(targetActorDoc.system)
          });

          return false;
        }

        console.log("[ADD2E][LUMIERE] sauvegarde personnage utilisée :", {
          target: targetActorDoc.name,
          saveVal
        });
      }
    }

    let roll = null;
    let saved = false;

    if (needsSave) {
      try {
        roll = new Roll("1d20");
        await roll.evaluate();

        // Ne pas appeler game.dice3d.showForRoll :
        // roll.toMessage déclenche déjà Dice So Nice si activé.
        saved = roll.total >= saveVal;

        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: targetActorDoc }),
          flavor: `
            <b>Jet de sauvegarde contre Lumière</b><br>
            Cible : ${targetActorDoc.name}<br>
            Sauvegarde sortilèges : ${saveVal}<br>
            Résultat : ${roll.total} — ${saved ? "Réussite" : "Échec"}
          `
        });
      } catch (e) {
        console.error("[ADD2E][LUMIERE] creature | Roll failed:", e);
        ui.notifications.error("Erreur pendant le jet de sauvegarde.");
        return false;
      }
    }

    console.log("[ADD2E][LUMIERE] creature | saved:", saved, "roll:", roll?.total, "vs", saveVal);

    if (saved) {
      statusHtml = `
        <div style="margin:5px 0 8px 0; padding:6px; border-radius:6px; text-align:center;
                    background:#eafaf1; border:1px solid #ccebd9; color:#27ae60;">
          <div style="font-weight:bold; font-size:1.1em;">🛡️ RÉSISTE</div>
          <div style="font-size:0.85em;">Sauvegarde réussie (${roll.total} vs ${saveVal})</div>
        </div>
      `;
    } else {
      statusHtml = `
        <div style="margin:5px 0 8px 0; padding:6px; border-radius:6px; text-align:center;
                    background:#f4efff; border:1px solid #e0d4fc; color:#8e44ad;">
          <div style="font-weight:bold; font-size:1.1em;">✨ ILLUMINÉ</div>
          <div style="font-size:0.85em;">
            ${needsSave ? `Échec sauvegarde (${roll.total} vs ${saveVal})` : "Sort appliqué au lanceur ou à son propre token"}
          </div>
        </div>
      `;

      const lightPayload = {
        type: "token",
        sceneId,
        tokenId: targetTokenDoc.id,

        originalDim: targetTokenDoc.light?.dim ?? 0,
        originalBright: targetTokenDoc.light?.bright ?? 0,
        originalColor: targetTokenDoc.light?.color ?? null,
        originalAlpha: targetTokenDoc.light?.alpha ?? 0.5,
        originalAngle: targetTokenDoc.light?.angle ?? 360,
        originalAnimation: foundry.utils.duplicate(targetTokenDoc.light?.animation ?? {
          type: null,
          speed: 5,
          intensity: 5,
          reverse: false
        })
      };

      const newLight = {
        "light.dim": rayon,
        "light.bright": rayon / 2,
        "light.color": lightColor,
        "light.alpha": 0.5,
        "light.angle": 360,
        "light.animation": lightAnim
      };

      try {
        if (game.user.isGM || targetTokenDoc.isOwner) {
          console.log("[ADD2E][LUMIERE] creature | update token local:", targetTokenDoc.id, newLight);
          await targetTokenDoc.update(newLight);
        } else {
          globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION("updateToken", {
            sceneId,
            tokenId: targetTokenDoc.id,
            updateData: newLight
          });
        }
      } catch (e) {
        console.error("[ADD2E][LUMIERE] creature | token update failed:", e);
        ui.notifications.error("Impossible de mettre à jour la lumière du token.");
      }

      const effectData = {
        name: "Lumière",
        icon: sourceItem.img || "icons/svg/light.svg",
        origin: sourceItem.uuid,
        disabled: false,
        transfer: false,
        duration: durationData,
        description: "Émet de la lumière magique.",
        flags: {
          add2e: {
            lightPayload
          }
        }
      };

      try {
        if (game.user.isGM || targetActorDoc.isOwner) {
          console.log("[ADD2E][LUMIERE] creature | create ActiveEffect local:", targetActorDoc.uuid, effectData);
          await targetActorDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
        } else {
          globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION("createActiveEffect", {
            actorUuid: targetActorDoc.uuid,
            actorId: targetActorDoc.id,
            effectData
          });
        }
      } catch (e) {
        console.error("[ADD2E][LUMIERE] creature | ActiveEffect create failed:", e);
        ui.notifications.error("Impossible de créer l’effet Lumière.");
      }
    }
  }

  // =======================================================
  // MODE SOL
  // =======================================================
  if (mode === "ground") {
    console.log("[ADD2E][LUMIERE] ground start | socket:", !!game.socket, "canvas.ready:", !!canvas?.ready);

    if (!canvas?.ready) {
      ui.notifications.warn("La scène n’est pas prête.");
      return false;
    }

    const wgActive = game.modules.get("warpgate")?.active && typeof warpgate?.crosshairs?.show === "function";

    console.log("[ADD2E][LUMIERE] warpgate active:", wgActive, "module:", game.modules.get("warpgate"));

    if (!wgActive) {
      ui.notifications.warn("Warpgate est requis pour le placement au sol de Lumière.");
      return false;
    }

    let cross = null;

    try {
      const config = {
        size: rayon,
        icon: sourceItem.img || "icons/svg/light.svg",
        label: "Lumière",
        interval: canvas.grid.size,
        drawIcon: true,
        drawOutline: true,
        rememberControlled: false
      };

      const callbacks = {
        show: () => {},
        move: () => {},
        cancel: () => {}
      };

      console.log("[ADD2E][LUMIERE] crosshairs.show:", { config, callbacks });
      cross = await warpgate.crosshairs.show(config, callbacks);
      console.log("[ADD2E][LUMIERE] crosshairs result:", cross);
    } catch (e) {
      console.error("[ADD2E][LUMIERE] crosshairs.show failed:", e);
      ui.notifications.error("Le placement Warpgate a échoué.");
      return false;
    }

    if (!cross || cross.cancelled) {
      console.log("[ADD2E][LUMIERE] placement annulé.");
      return false;
    }

    const sceneId = canvas.scene?.id;

    if (!sceneId) {
      ui.notifications.error("Aucune scène active.");
      return false;
    }

    cibleTxt = "Sol";

    const requestId = foundry.utils.randomID();

    const ambientAdd2eFlags = {
      spellName: sourceItem.name,
      actorId: caster.id,
      actorUuid: caster.uuid,
      requestId,
      fromUserId: game.user.id
    };

    const ambientData = {
      x: cross.x,
      y: cross.y,
      rotation: 0,
      walls: true,
      vision: false,
      config: {
        dim: rayon,
        bright: rayon / 2,
        angle: 360,
        color: lightColor,
        alpha: 0.5,
        coloration: 1,
        luminosity: 0.5,
        attenuation: 0.5,
        animation: lightAnim
      },
      flags: {
        add2e: ambientAdd2eFlags
      }
    };

    let lightId = null;

    if (game.user.isGM) {
      try {
        const lightDoc = await globalThis.ADD2E_LUMIERE_CREATE_AMBIENT_LOCAL(canvas.scene, ambientData);

        if (!lightDoc) {
          ui.notifications.error("La lumière au sol n’a pas pu être créée.");
          return false;
        }

        lightId = lightDoc.id;

        console.log("[ADD2E][LUMIERE] ambient light created locally:", lightId);
      } catch (e) {
        console.error("[ADD2E][LUMIERE] ground local creation failed:", e);
        ui.notifications.error("Impossible de créer la lumière au sol.");
        return false;
      }
    } else {
      if (!game.socket) {
        ui.notifications.warn("Impossible de poser la lumière au sol : socket indisponible.");
        return false;
      }

      globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION("createAmbientLight", {
        sceneId,
        x: cross.x,
        y: cross.y,
        dim: rayon,
        bright: rayon / 2,
        color: lightColor,
        alpha: 0.5,
        angle: 360,
        animation: lightAnim,
        flags: {
          add2e: ambientAdd2eFlags
        }
      });

      const lightDoc = await globalThis.ADD2E_LUMIERE_WAIT_FOR_AMBIENT({
        type: "ambient",
        sceneId,
        requestId,
        actorId: caster.id,
        actorUuid: caster.uuid,
        spellName: sourceItem.name,
        x: cross.x,
        y: cross.y
      });

      lightId = lightDoc?.id ?? null;

      console.log("[ADD2E][LUMIERE] lightId after socket wait:", {
        lightId,
        found: !!lightDoc
      });
    }

    const groundEffectData = {
      name: "Lumière (Zone)",
      icon: sourceItem.img || "icons/svg/sun.svg",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: durationData,
      description: "Maintient une zone de lumière magique.",
      flags: {
        add2e: {
          lightPayload: {
            type: "ambient",
            actorId: caster.id,
            actorUuid: caster.uuid,
            spellName: sourceItem.name,
            sceneId,
            lightId,
            requestId,
            x: cross.x,
            y: cross.y
          }
        }
      }
    };

    try {
      if (game.user.isGM || caster.isOwner) {
        console.log("[ADD2E][LUMIERE] ground | create AE on caster:", caster.uuid, groundEffectData);
        await caster.createEmbeddedDocuments("ActiveEffect", [groundEffectData]);
      } else {
        globalThis.ADD2E_LUMIERE_EMIT_GM_OPERATION("createActiveEffect", {
          actorUuid: caster.uuid,
          actorId: caster.id,
          effectData: groundEffectData
        });
      }
    } catch (e) {
      console.error("[ADD2E][LUMIERE] ground | AE caster failed:", e);
      ui.notifications.error("La lumière est posée, mais l’effet actif n’a pas pu être créé sur le lanceur.");
    }

    statusHtml = `
      <div style="margin:5px 0 8px 0; padding:6px; border-radius:6px; text-align:center;
                  background:#fff9c4; border:1px solid #f9e79f; color:#d4ac0d;">
        <div style="font-weight:bold; font-size:1.1em;">✨ LUMIÈRE AU SOL</div>
        <div style="font-size:0.85em;">Zone de lumière maintenue par le lanceur</div>
      </div>
    `;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `
      <div class="add2e-spell-card">
        <b>${sourceItem.name}</b><br>
        <em>${cibleTxt}</em>
        ${statusHtml}
      </div>
    `,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });

  return true;
})();