// ADD2E — onUse canonique : Fracassement
// Sort de magicien niveau 2 — portée 6", un objet, sauvegarde d’objet contre coup critique.
// Compatible Foundry V13/V14/V15 — DialogV2/Chat communs ADD2E et moteur de sauvegarde des objets.

return await (async () => {
  const VERSION = "2026-08-08-fracassement-foundry-v1";
  const RANGE_SPACES = 6;
  const KG_PER_LEVEL = 5;
  const ALLOWED_MATERIALS = new Set(["ceramic", "crystal_flask", "glass"]);

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

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
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.item ?? args[0]?.sort : null)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || spellItem?.parent
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.actor : null)
    || null;
  const runtimeArgs = Array.isArray(typeof args !== "undefined" ? args : null) ? args : [];

  const alert = async (title, content, theme = "wizard") => {
    if (typeof globalThis.add2eDialogAlert !== "function") throw new Error("Fracassement : l’API de fenêtre ADD2E est indisponible.");
    await globalThis.add2eDialogAlert({ add2eTheme: theme, window: { title }, content });
  };

  if (!caster || !spellItem) {
    await alert("Fracassement", "<p>Le lanceur ou le sort est introuvable.</p>", "danger");
    return false;
  }
  if (typeof globalThis.add2eCanonicalClassStates !== "function") throw new Error("Fracassement : le moteur canonique des classes est indisponible.");
  if (typeof globalThis.add2eDialogWait !== "function") throw new Error("Fracassement : l’API de fenêtre ADD2E est indisponible.");
  if (typeof globalThis.add2eCreateChatCard !== "function") throw new Error("Fracassement : l’API de carte ADD2E est indisponible.");

  const engine = globalThis.ADD2E_EFFECTS;
  if (typeof engine?.getObjectSaveMaterial !== "function" || typeof engine?.rollObjectSave !== "function") {
    throw new Error("Fracassement : le moteur de sauvegarde des objets est indisponible.");
  }

  const classStates = globalThis.add2eCanonicalClassStates(caster);
  const magicien = classStates.find(state => normalize(state?.slug ?? state?.name) === "magicien") ?? null;
  const casterLevel = Math.max(0, Math.floor(Number(magicien?.level) || 0));
  if (casterLevel < 1) {
    await alert("Fracassement", "<p>Le niveau de magicien est introuvable.</p>", "danger");
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster?.id ? token : null)
    || runtimeArgs[0]?.token
    || canvas?.tokens?.controlled?.find?.(entry => entry?.actor?.id === caster?.id)
    || caster?.getActiveTokens?.()?.[0]
    || null;
  if (!casterToken) {
    await alert("Fracassement", "<p>Le lanceur doit avoir un token sur la scène.</p>");
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []).filter(entry => entry?.actor);
  if (targets.length !== 1) {
    await alert("Fracassement", "<p>Sélectionne exactement une cible.</p>");
    return false;
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;

  const gridSize = Number(canvas?.grid?.size ?? canvas?.dimensions?.size ?? 100) || 100;
  const center = tokenObject => {
    if (tokenObject?.center && Number.isFinite(Number(tokenObject.center.x)) && Number.isFinite(Number(tokenObject.center.y))) {
      return { x: Number(tokenObject.center.x), y: Number(tokenObject.center.y) };
    }
    const document = tokenObject?.document ?? tokenObject;
    return {
      x: Number(document?.x ?? 0) + Number(document?.width ?? 1) * gridSize / 2,
      y: Number(document?.y ?? 0) + Number(document?.height ?? 1) * gridSize / 2
    };
  };
  const distanceSpaces = (fromToken, toToken) => {
    const from = center(fromToken);
    const to = center(toToken);
    if (typeof canvas?.grid?.measurePath === "function") {
      try {
        const result = canvas.grid.measurePath([from, to], { gridSpaces: true });
        const spaces = Number(result?.spaces ?? result?.gridDistance);
        if (Number.isFinite(spaces)) return spaces;
        const distance = Number(result?.distance ?? result?.cost ?? result);
        const unit = Number(canvas?.scene?.grid?.distance ?? canvas?.grid?.distance);
        if (Number.isFinite(distance) && Number.isFinite(unit) && unit > 0) return distance / unit;
      } catch (_error) {}
    }
    return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) / gridSize;
  };

  const distance = distanceSpaces(casterToken, targetToken);
  if (!Number.isFinite(distance) || distance > RANGE_SPACES + 0.01) {
    await alert("Fracassement", `<p><b>${escapeHtml(targetToken.name ?? targetActor.name)}</b> est hors de portée.</p>`);
    return false;
  }

  const maxWeightKg = casterLevel * KG_PER_LEVEL;
  const itemWeightKg = candidate => {
    const system = candidate?.system ?? {};
    const direct = Number(system.poids ?? system.weight);
    const unit = normalize(system.poids_unite ?? system.weightUnit ?? "kg");
    if (Number.isFinite(direct) && direct >= 0) {
      if (!unit || ["kg", "kilogramme", "kilogrammes"].includes(unit)) return direct;
      if (["g", "gramme", "grammes"].includes(unit)) return direct / 1000;
    }
    const encumbrancePo = Number(system.poids_encombrement_po);
    return Number.isFinite(encumbrancePo) && encumbrancePo >= 0 ? encumbrancePo / 20 : NaN;
  };
  const isMagical = candidate => candidate?.system?.magique === true
    || candidate?.system?.magic === true
    || candidate?.system?.isMagic === true
    || candidate?.flags?.add2e?.magicItem === true;

  const eligible = Array.from(targetActor?.items ?? [])
    .map(candidate => ({
      item: candidate,
      material: engine.getObjectSaveMaterial(candidate),
      weight: itemWeightKg(candidate),
      quantity: Math.max(0, Math.floor(Number(candidate?.system?.quantite ?? candidate?.system?.quantity ?? 1) || 0))
    }))
    .filter(entry => entry.quantity > 0)
    .filter(entry => !isMagical(entry.item))
    .filter(entry => ALLOWED_MATERIALS.has(entry.material))
    .filter(entry => Number.isFinite(entry.weight) && entry.weight <= maxWeightKg + 0.0001)
    .sort((left, right) => String(left.item.name).localeCompare(String(right.item.name), "fr"));

  if (!eligible.length) {
    await alert("Fracassement", `<p><b>${escapeHtml(targetActor.name)}</b> ne porte aucun objet compatible avec Fracassement.</p>`);
    return false;
  }

  const materialLabel = value => ({ ceramic: "Céramique / porcelaine", crystal_flask: "Cristal", glass: "Verre" }[value] ?? value);
  const options = eligible.map((entry, index) => `<option value="${index}">${escapeHtml(entry.item.name)} — ${escapeHtml(materialLabel(entry.material))} — ${entry.weight.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg</option>`).join("");
  const selected = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-fracassement"],
    window: { title: "Fracassement" },
    content: `<form class="add2e-fracassement-form"><div class="form-group"><label>Objet</label><select name="itemIndex">${options}</select></div></form>`,
    buttons: [
      {
        action: "cast",
        label: "Fracasser",
        icon: "<i class='fas fa-burst'></i>",
        default: true,
        callback: (_event, button) => Number(button.form?.elements?.itemIndex?.value ?? 0)
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
  if (selected === null || selected === undefined) return false;

  const chosen = eligible[Number(selected)] ?? null;
  if (!chosen) return false;

  const save = await engine.rollObjectSave(chosen.item, "critical_hit");
  if (!save?.canRoll || !save.roll) {
    await alert("Fracassement", `<p>Impossible de résoudre la résistance de <b>${escapeHtml(chosen.item.name)}</b>.</p>`, "danger");
    return false;
  }

  if (!save.success) {
    const nextQuantity = Math.max(0, chosen.quantity - 1);
    const canMutate = game.user?.isGM || chosen.item?.isOwner === true || targetActor?.isOwner === true;
    if (canMutate) {
      if (nextQuantity > 0) await chosen.item.update({ "system.quantite": nextQuantity }, { add2eReason: "fracassement" });
      else await chosen.item.delete({ add2eReason: "fracassement" });
    } else {
      game.socket?.emit?.("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "mutateEmbeddedItem",
        payload: {
          actorId: targetActor.id,
          actorUuid: targetActor.uuid,
          itemId: chosen.item.id,
          action: nextQuantity > 0 ? "update" : "delete",
          updateData: nextQuantity > 0 ? { "system.quantite": nextQuantity } : {},
          reason: "fracassement"
        }
      });
    }
  }

  await globalThis.add2eCreateChatCard({
    actor: caster,
    title: "Fracassement",
    icon: "fas fa-burst",
    variant: save.success ? "success" : "damage",
    target: {
      name: targetActor.name,
      img: targetToken?.document?.texture?.src ?? targetActor.img
    },
    rows: [
      { label: "Objet", value: chosen.item.name },
      { label: "Jet", value: `${save.die}${save.modifier ? ` ${save.modifier >= 0 ? "+" : "−"} ${Math.abs(save.modifier)}` : ""} / ${save.threshold}` },
      { label: "Résultat", value: save.success ? "L’objet résiste" : "Objet détruit" }
    ],
    chatData: {
      rolls: [save.roll],
      flags: {
        add2e: {
          spell: "fracassement",
          version: VERSION,
          targetActorId: targetActor.id,
          itemId: chosen.item.id,
          objectSave: { material: save.material, attack: save.attack, threshold: save.threshold, success: save.success }
        }
      }
    }
  });

  return true;
})();
