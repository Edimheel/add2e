// systems/add2e/scripts/onuse/capacites/vade-retro.js
// ADD2E — Capacité de classe : Vade-rétro
// À appeler exactement comme un on_use de sort/capacité.
// Retour attendu par le moteur :
// - true  = capacité réellement utilisée, consommation validée
// - false = rien consommé

return await (async () => {
  const caster =
    (typeof actor !== "undefined" && actor) ||
    (typeof item !== "undefined" && item?.parent) ||
    canvas.tokens.controlled[0]?.actor ||
    game.user.character;

  if (!caster) {
    ui.notifications.warn("Vade-rétro : aucun clerc sélectionné.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);
  if (!targets.length) {
    ui.notifications.warn("Vade-rétro : cible au moins une créature.");
    return false;
  }

  const level = Number(caster.system?.niveau ?? 1) || 1;
  if (level < 1) {
    ui.notifications.warn("Vade-rétro : niveau de clerc invalide.");
    return false;
  }

  const alignement = String(caster.system?.alignement ?? "").toLowerCase();
  const defaultMode = alignement.includes("mauvais") ? "commander" : "repousser";

  const TABLE = {
    squelette:     ["10", "7",  "4",  "T",  "T",  "D",  "D",  "D*", "D*", "D*"],
    zombie:       ["13", "10", "7",  "T",  "T",  "D",  "D",  "D",  "D*", "D*"],
    goule:        ["16", "13", "10", "4",  "T",  "T",  "D",  "D",  "D",  "D*"],
    ombre:        ["19", "16", "13", "7",  "4",  "T",  "T",  "D",  "D",  "D*"],
    necrophage:   ["20", "19", "16", "10", "7",  "4",  "T",  "T",  "D",  "D"],
    ghast:        [null, "20", "19", "13", "10", "7",  "4",  "T",  "T",  "D"],
    ame_en_peine: [null, null, "20", "16", "13", "10", "7",  "4",  "T",  "D"],
    momie:        [null, null, null, "20", "16", "13", "10", "7",  "4",  "T"],
    spectre:      [null, null, null, null, "20", "16", "13", "10", "7",  "T"],
    vampire:      [null, null, null, null, null, "20", "16", "13", "10", "4"],
    fantome:      [null, null, null, null, null, null, "20", "16", "13", "7"],
    liche:        [null, null, null, null, null, null, null, "19", "16", "10"],
    special:      [null, null, null, null, null, null, null, "20", "19", "13"]
  };

  const LABELS = {
    squelette: "Squelette",
    zombie: "Zombie",
    goule: "Goule",
    ombre: "Ombre",
    necrophage: "Nécrophage",
    ghast: "Ghast",
    ame_en_peine: "Âme en peine",
    momie: "Momie",
    spectre: "Spectre",
    vampire: "Vampire",
    fantome: "Fantôme",
    liche: "Liche",
    special: "Démon / diable inférieur"
  };

  const ORDER = [
    "squelette", "zombie", "goule", "ombre", "necrophage", "ghast",
    "ame_en_peine", "momie", "spectre", "vampire", "fantome", "liche", "special"
  ];

  function norm(v) {
    return String(v ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  function columnIndex(clericLevel) {
    if (clericLevel <= 0) return -1;
    if (clericLevel <= 8) return clericLevel - 1;
    if (clericLevel <= 13) return 8;
    return 9;
  }

  function getTypeText(a) {
    const s = a.system ?? {};
    return [
      a.name,
      s.type,
      s.type_creature,
      s.creatureType,
      s.categorie,
      s.famille,
      s.race,
      s.type_mort_vivant,
      s.typeMortVivant,
      s.undeadType,
      s.tags,
      s.effectTags
    ].flat().map(norm).join(" ");
  }

  function detectCategory(token, forced) {
    if (forced && forced !== "auto") return forced;

    const a = token?.actor;
    const text = getTypeText(a);

    const entries = [
      ["ame_en_peine", ["ame_en_peine", "wight"]],
      ["necrophage", ["necrophage"]],
      ["squelette", ["squelette", "skeleton"]],
      ["zombie", ["zombie"]],
      ["goule", ["goule", "ghoul"]],
      ["ombre", ["ombre", "shadow"]],
      ["ghast", ["ghast"]],
      ["momie", ["momie", "mummy"]],
      ["spectre", ["spectre", "specter"]],
      ["vampire", ["vampire"]],
      ["fantome", ["fantome", "ghost"]],
      ["liche", ["liche", "lich"]],
      ["special", ["diable", "demon", "devil", "daemon", "plan_inferieur", "plans_inferieurs"]]
    ];

    for (const [cat, keys] of entries) {
      if (keys.some(k => text.includes(k))) return cat;
    }

    // Cas demandé : les monstres ont type "mort vivant" ou "diable".
    if (text.includes("diable") || text.includes("demon")) return "special";

    // Type mort vivant générique : on demandera la catégorie dans la fenêtre.
    if (text.includes("mort_vivant") || text.includes("undead")) return null;

    return null;
  }

  function specialEligible(actor) {
    const s = actor.system ?? {};
    const ac = Number(s.ca_total ?? s.ca ?? s.ac ?? s.armorClass ?? NaN);
    const hd = Number(s.dv ?? s.hd ?? s.hitDice ?? s.des_de_vie ?? s.niveau ?? NaN);
    const mr = Number(s.resistance_magie ?? s.resistanceMagie ?? s.magicResistance ?? s.rm ?? s.mr ?? 0);

    if (Number.isFinite(ac) && ac <= -5) return false;
    if (Number.isFinite(hd) && hd >= 11) return false;
    if (Number.isFinite(mr) && mr >= 66) return false;

    return true;
  }

  const dialogResult = await new Promise(resolve => {
    const content = `
      <form style="display:flex;flex-direction:column;gap:8px;">
        <div style="background:#fff8e1;border:1px solid #d9bf73;border-radius:8px;padding:8px;">
          <b>${caster.name}</b> tente un vade-rétro sur <b>${targets.length}</b> cible(s).
        </div>

        <div class="form-group">
          <label>Action</label>
          <select name="mode">
            <option value="repousser" ${defaultMode === "repousser" ? "selected" : ""}>Repousser / détruire</option>
            <option value="commander" ${defaultMode === "commander" ? "selected" : ""}>Commander / influencer</option>
          </select>
        </div>

        <div class="form-group">
          <label>Catégorie forcée si nécessaire</label>
          <select name="category">
            <option value="auto">Automatique</option>
            ${ORDER.map(k => `<option value="${k}">${LABELS[k]}</option>`).join("")}
          </select>
        </div>
      </form>
    `;

    new Dialog({
      title: "Vade-rétro",
      content,
      buttons: {
        ok: {
          label: "Lancer",
          callback: html => {
            const form = html[0]?.querySelector("form");
            const fd = new FormData(form);
            resolve({
              mode: String(fd.get("mode") || defaultMode),
              category: String(fd.get("category") || "auto")
            });
          }
        },
        cancel: {
          label: "Annuler",
          callback: () => resolve(null)
        }
      },
      default: "ok",
      close: () => resolve(null)
    }).render(true);
  });

  if (!dialogResult) return false;

  const col = columnIndex(level);
  const rows = [];
  let used = false;

  async function rollFormula(formula) {
    const r = await new Roll(formula).evaluate({ async: true });
    if (game.dice3d) {
      try { await game.dice3d.showForRoll(r); } catch (e) {}
    }
    return r;
  }

  for (const targetToken of targets) {
    const targetActor = targetToken.actor;
    if (!targetActor) continue;

    let category = detectCategory(targetToken, dialogResult.category);

    if (!category) {
      rows.push({
        target: targetActor.name,
        result: "Catégorie inconnue",
        detail: "Le type est mort vivant, mais la catégorie exacte doit être forcée."
      });
      continue;
    }

    const entry = TABLE[category]?.[col] ?? null;
    if (!entry) {
      rows.push({
        target: targetActor.name,
        result: "Aucun effet",
        detail: `${LABELS[category]} impossible à affecter au niveau ${level}.`
      });
      used = true;
      continue;
    }

    if (category === "special" && !specialEligible(targetActor)) {
      rows.push({
        target: targetActor.name,
        result: "Non affectable",
        detail: "Démon/diable trop puissant pour la ligne spéciale."
      });
      used = true;
      continue;
    }

    let success = false;
    let rollText = "Automatique";

    if (String(entry).startsWith("T") || String(entry).startsWith("D")) {
      success = true;
    } else {
      const threshold = Number(entry);
      const roll = await rollFormula("1d20");
      rollText = `${roll.total} / ${threshold}`;
      success = roll.total >= threshold;
    }

    if (!success) {
      rows.push({
        target: targetActor.name,
        result: "Échec",
        detail: `${LABELS[category]} — table ${entry} — jet ${rollText}`
      });
      used = true;
      continue;
    }

    const qtyFormula = category === "special" ? "1d2" : String(entry).includes("*") ? "1d6+6" : "1d12";
    const qty = await rollFormula(qtyFormula);

    let resultLabel = "Repoussé";
    let effectName = "Repoussé par vade-rétro";
    let tags = [`vade_retro:${category}`, "etat:repousse_vade_retro"];

    if (String(entry).startsWith("D")) {
      if (dialogResult.mode === "commander") {
        resultLabel = "Dominé";
        effectName = "Dominé par vade-rétro";
        tags = [`vade_retro:${category}`, "etat:domine_vade_retro", "controle:clerc"];
      } else {
        resultLabel = "Détruit / damné";
        effectName = "Détruit par vade-rétro";
        tags = [`vade_retro:${category}`, "etat:detruit_vade_retro"];
      }
    } else if (dialogResult.mode === "commander") {
      resultLabel = "Influencé";
      effectName = "Influencé par vade-rétro";
      tags = [`vade_retro:${category}`, "etat:influence_vade_retro", "controle:clerc"];
    }

    const effectData = {
      name: effectName,
      img: "icons/magic/holy/barrier-shield-winged-cross.webp",
      transfer: false,
      disabled: false,
      duration: {},
      changes: [],
      flags: {
        add2e: {
          tags,
          vadeRetro: {
            casterUuid: caster.uuid,
            casterName: caster.name,
            category,
            entry,
            mode: dialogResult.mode,
            quantity: qty.total
          }
        }
      },
      description: `${effectName} — ${LABELS[category]} — ${qty.total} créature(s) affectable(s).`
    };

    if (game.user.isGM || targetActor.isOwner) {
      try {
        await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      } catch (e) {
        console.warn("[ADD2E][VADE-RETRO] ActiveEffect non appliqué.", e);
      }
    }

    rows.push({
      target: targetActor.name,
      result: resultLabel,
      detail: `${LABELS[category]} — table ${entry} — jet ${rollText} — nombre ${qty.result} = ${qty.total}`
    });

    used = true;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `
      <div style="border:1.5px solid #c79b38;border-radius:12px;overflow:hidden;background:#fffaf0;box-shadow:0 3px 8px #0002;">
        <div style="background:linear-gradient(90deg,#8a5a13,#d4a83a);color:white;padding:8px 10px;display:flex;align-items:center;gap:8px;">
          <img src="${caster.img}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="flex:1;">
            <div style="font-weight:800;">${caster.name}</div>
            <div style="font-size:0.9em;">Vade-rétro — niveau ${level}</div>
          </div>
        </div>
        <div style="padding:8px;">
          ${rows.map(r => `
            <div style="border-bottom:1px solid #e7d8a0;padding:5px 0;">
              <b>${r.target}</b> — <b>${r.result}</b><br>
              <span style="font-size:0.9em;color:#5b4b26;">${r.detail}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `
  });

  return used;
})();
