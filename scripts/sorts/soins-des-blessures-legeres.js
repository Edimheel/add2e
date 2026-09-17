// ADD2E — Soins des Blessures Légères / Blessures Légères
// Clerc niveau 1 — runtime spécialisé.
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const ADD2E_CLERIC_ONUSE_CONFIG = Object.freeze({
  kind: "healHarm",
  tags: [
    "sort:soins_des_blessures_legeres",
    "soin:1d8",
    "reversible:blessures_legeres",
    "degats_inverse:1d8",
    "etat:soin",
    "contact:jet_toucher_si_necessaire"
  ],
  rule: "Rend 1d8 points de vie à une créature vivante blessée. Inverse : Blessures légères inflige 1d8 points de dégâts par contact. Si le contact n’est pas déjà acquis, un jet de toucher est résolu avant l’effet.",
  name: "Soins des Blessures Légères",
  inverseName: "Blessures Légères",
  slug: "soins-des-blessures-legeres",
  imgFallback: "systems/add2e/assets/icones/sorts/soins-des-blessures-legeres.webp",
  version: "2026-09-17-canonical-touch-hp-chat-v2"
});

const __add2eOnUseResult = await (async () => {
  const CFG = ADD2E_CLERIC_ONUSE_CONFIG;

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error(`${CFG.name} : l’API de fenêtre ADD2E est indisponible.`);
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error(`${CFG.name} : les constructeurs communs de cartes ADD2E sont indisponibles.`);
  }
  if (typeof globalThis.add2eResolveTouchAttack !== "function") {
    throw new Error(`${CFG.name} : le résolveur canonique des jets de toucher est indisponible.`);
  }

  const hitPointEngine = globalThis.ADD2E_EFFECTS;
  if (
    !hitPointEngine
    || typeof hitPointEngine.readHitPoints !== "function"
    || typeof hitPointEngine.readMaximumHitPoints !== "function"
    || typeof hitPointEngine.applyHitPointHealing !== "function"
  ) {
    throw new Error(`${CFG.name} : le propriétaire canonique ADD2E des points de vie est indisponible.`);
  }

  function sourceItemFromContext() {
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof item !== "undefined" && item) return item;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    return null;
  }

  function casterFromContext(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent ?? null;
  }

  function casterTokenFor(caster) {
    if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token;
    return canvas.tokens?.controlled?.find(candidate => candidate?.actor?.id === caster?.id)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  }

  function singleTarget() {
    const targets = Array.from(game.user?.targets ?? []);
    if (targets.length !== 1) {
      ui.notifications.warn(`${CFG.name} : cible exactement une créature.`);
      return null;
    }
    if (!targets[0]?.actor) {
      ui.notifications.warn(`${CFG.name} : la cible ne possède pas d’acteur.`);
      return null;
    }
    return targets[0];
  }

  function tokensAtContact(left, right) {
    if (!left || !right) return false;
    if (left.id === right.id) return true;
    const gridSize = Number(canvas.dimensions?.size ?? canvas.grid?.size) || 100;
    const leftDocument = left.document ?? left;
    const rightDocument = right.document ?? right;
    const leftX = Number(leftDocument.x) / gridSize;
    const leftY = Number(leftDocument.y) / gridSize;
    const leftRight = leftX + (Number(leftDocument.width) || 1);
    const leftBottom = leftY + (Number(leftDocument.height) || 1);
    const rightX = Number(rightDocument.x) / gridSize;
    const rightY = Number(rightDocument.y) / gridSize;
    const rightRight = rightX + (Number(rightDocument.width) || 1);
    const rightBottom = rightY + (Number(rightDocument.height) || 1);
    const gapX = Math.max(0, rightX - leftRight, leftX - rightRight);
    const gapY = Math.max(0, rightY - leftBottom, leftY - rightBottom);
    return gapX <= 0.01 && gapY <= 0.01;
  }

  function emitHealingToGm(targetToken, targetActor, amount, sourceItem) {
    if (!game.socket?.emit) throw new Error(`${CFG.name} : socket Foundry indisponible pour déléguer le soin au MJ.`);
    game.socket.emit("system.add2e", {
      type: "applyDamageFlag",
      tokenId: targetToken?.id ?? targetToken?.document?.id ?? null,
      actorId: targetActor.id,
      flagData: {
        montant: -Math.max(0, Number(amount) || 0),
        type: "soin",
        details: `${sourceItem.name ?? CFG.name} : soin magique`,
        source: "spell",
        fromUserId: game.user?.id ?? null,
        timestamp: Date.now()
      }
    });
  }

  async function applyHealing(targetToken, targetActor, amount, sourceItem) {
    const requested = Math.max(0, Number(amount) || 0);
    const before = Number(hitPointEngine.readHitPoints(targetActor));
    const maximum = Number(hitPointEngine.readMaximumHitPoints(targetActor));
    if (!Number.isFinite(before) || !Number.isFinite(maximum) || maximum <= 0) {
      throw new Error(`${CFG.name} : points de vie canoniques invalides pour ${targetActor.name}.`);
    }

    if (!game.user?.isGM) {
      const effective = Math.min(requested, Math.max(0, maximum - before));
      if (effective > 0) emitHealingToGm(targetToken, targetActor, requested, sourceItem);
      return {
        changed: effective > 0,
        delegated: effective > 0,
        actor: targetActor,
        before,
        after: before + effective,
        maximum,
        amount: requested,
        effective
      };
    }

    return hitPointEngine.applyHitPointHealing(targetActor, requested, {
      reason: "spell-cure-light-wounds",
      updateOptions: {
        add2eDetails: `${sourceItem.name ?? CFG.name} : soin magique`
      }
    });
  }

  async function applyHarm(targetToken, targetActor, amount, caster, sourceItem) {
    if (typeof globalThis.add2eApplyDamage !== "function") {
      throw new Error(`${CFG.inverseName} : le pipeline canonique ADD2E des dégâts est indisponible.`);
    }
    const result = await globalThis.add2eApplyDamage({
      cible: targetToken ?? targetActor,
      montant: Math.max(0, Number(amount) || 0),
      type: "magique",
      details: `${sourceItem.name ?? CFG.inverseName} : blessure magique par sort de contact`,
      sourceItem,
      lanceur: caster,
      actionTags: ["spell", "spell:contact", "damage:magic", "sort:blessures_legeres"]
    });
    if (!result?.applied && result?.amount === undefined && !result?.hitPoints && result?.delegated !== true) {
      throw new Error(`${CFG.inverseName} : les dégâts n’ont pas pu être appliqués.`);
    }
    return result;
  }

  async function castDialog(targetActor) {
    return globalThis.add2eDialogWait({
      add2eTheme: "parchment",
      add2ePrimaryAction: "cast",
      add2eClasses: ["add2e-cure-light-wounds-dialog"],
      window: { title: `Lancement : ${CFG.name}` },
      content: `
        <form class="add2e-cure-light-wounds-form">
          <p><b>Cible :</b> ${String(targetActor?.name ?? "Créature")}</p>
          <div class="form-group">
            <label><b>Effet :</b></label>
            <select name="mode" style="width:100%;">
              <option value="heal">${CFG.name} — rend 1d8 PV</option>
              <option value="harm">${CFG.inverseName} — inflige 1d8 PV</option>
            </select>
          </div>
          <label style="display:flex;gap:6px;align-items:center;">
            <input type="checkbox" name="touchConfirmed" checked>
            Contact automatique si la cible est déjà au contact et consentante.
          </label>
          <p class="hint">Si le contact automatique n’est pas acquis, le résolveur canonique de toucher ADD2E effectue le d20.</p>
        </form>`,
      buttons: [
        {
          action: "cast",
          label: "Lancer",
          icon: "<i class='fas fa-hands-praying'></i>",
          default: true,
          callback: (_event, button) => ({
            mode: String(button.form?.elements?.mode?.value ?? "heal"),
            touchConfirmed: button.form?.elements?.touchConfirmed?.checked === true
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

  async function createResultCard({
    caster,
    casterToken,
    sourceItem,
    targetActor,
    mode,
    touch = null,
    effectRoll = null,
    healing = null,
    damage = null
  }) {
    const healingMode = mode === "heal";
    const title = healingMode ? CFG.name : CFG.inverseName;
    const rows = [];

    if (touch) {
      rows.push(
        { label: "Jet de toucher", value: `d20 ${touch.d20} / seuil ${touch.threshold}` },
        { label: "Calcul", value: `THAC0 ${touch.thac0} - CA ${touch.armorClass}${touch.bonus ? ` ; mod. ${touch.bonus >= 0 ? "+" : ""}${touch.bonus}` : ""}` }
      );
    } else {
      rows.push({ label: "Contact", value: "Automatique / cible consentante" });
    }

    let message;
    let variant;
    if (touch && touch.success !== true) {
      message = "Le contact est manqué : aucun effet n’est appliqué.";
      variant = "failure";
    } else if (healingMode) {
      rows.push(
        { label: "Jet de soin", value: `1d8 = ${Number(effectRoll?.total) || 0}` },
        { label: "PV avant", value: healing?.before ?? "—" },
        { label: "PV rendus", value: healing?.effective ?? 0 },
        { label: "PV après", value: healing?.after ?? "—" }
      );
      message = healing?.effective > 0
        ? `${targetActor.name} récupère ${healing.effective} point(s) de vie.`
        : `${targetActor.name} ne récupère aucun point de vie.`;
      variant = "success";
    } else {
      const rolled = Number(effectRoll?.total) || 0;
      const applied = Math.max(0, Number(damage?.amount ?? rolled) || 0);
      rows.push(
        { label: "Jet de blessure", value: `1d8 = ${rolled}` },
        { label: "Dégâts appliqués", value: applied }
      );
      message = `${targetActor.name} subit ${applied} point(s) de dégâts.`;
      variant = "failure";
    }

    const card = {
      actor: caster,
      title,
      icon: healingMode ? "fas fa-hand-holding-medical" : "fas fa-hand-fist",
      variant,
      source: {
        name: caster.name,
        img: caster.img,
        type: healingMode ? "Sort divin" : "Sort divin inversé"
      },
      target: {
        name: targetActor.name,
        img: targetActor.img,
        type: "Créature touchée"
      },
      rows,
      message,
      trustedBodyHtml: `<p>${CFG.rule}</p>`,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
        rolls: [touch?.roll, effectRoll].filter(Boolean),
        flags: {
          add2e: {
            chatCardType: "cure-light-wounds",
            spellMode: mode,
            sourceItemUuid: sourceItem.uuid ?? null,
            targetActorUuid: targetActor.uuid ?? null,
            touchResolverVersion: touch?.version ?? null,
            hitPointDelegated: healing?.delegated === true || damage?.delegated === true,
            version: CFG.version
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(card);
    if (!String(preview ?? "").trim()) throw new Error(`${title} : carte ADD2E vide.`);
    await globalThis.add2eCreateChatCard(card);
  }

  const sourceItem = sourceItemFromContext();
  const caster = casterFromContext(sourceItem);
  if (!sourceItem || !caster) {
    ui.notifications.error(`${CFG.name} : lanceur ou sort introuvable.`);
    return false;
  }

  const casterToken = casterTokenFor(caster);
  const targetToken = singleTarget();
  if (!targetToken) return false;
  const targetActor = targetToken.actor;

  const dialogResult = await castDialog(targetActor);
  if (!dialogResult) return false;

  const mode = dialogResult.mode === "harm" ? "harm" : "heal";
  const contactAutomatic = dialogResult.touchConfirmed === true && tokensAtContact(casterToken, targetToken);
  let touch = null;

  if (!contactAutomatic) {
    try {
      touch = await globalThis.add2eResolveTouchAttack({
        actor: caster,
        targetActor,
        sourceItem,
        showDice: false
      });
    } catch (error) {
      console.error("[ADD2E][CURE_LIGHT_WOUNDS][TOUCH]", error);
      ui.notifications.error(error?.message ?? `${CFG.name} : jet de toucher impossible.`);
      return false;
    }
    if (touch.success !== true) {
      await createResultCard({
        caster,
        casterToken,
        sourceItem,
        targetActor,
        mode,
        touch
      });
      return true;
    }
  }

  const effectRoll = await new Roll("1d8").evaluate();
  const amount = Math.max(0, Number(effectRoll.total) || 0);

  try {
    if (mode === "heal") {
      const healing = await applyHealing(targetToken, targetActor, amount, sourceItem);
      await createResultCard({
        caster,
        casterToken,
        sourceItem,
        targetActor,
        mode,
        touch,
        effectRoll,
        healing
      });
    } else {
      const damage = await applyHarm(targetToken, targetActor, amount, caster, sourceItem);
      await createResultCard({
        caster,
        casterToken,
        sourceItem,
        targetActor,
        mode,
        touch,
        effectRoll,
        damage
      });
    }
  } catch (error) {
    console.error("[ADD2E][CURE_LIGHT_WOUNDS][HP]", error);
    ui.notifications.error(error?.message ?? `${CFG.name} : modification des points de vie impossible.`);
    return false;
  }

  return true;
})();

return __add2eOnUseResult === true ? true : false;
