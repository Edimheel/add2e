class Add2eEffectsEngine {
  static getActiveTags(actor) {
    if (!actor || !actor.effects) return [];
    const tags = [];
    
    for (let eff of actor.effects) {
      // 1. Si désactivé, on ignore
      if (eff.disabled) continue;

      // 2. [MODIF] Vérification de l'équipement
      // Si l'effet provient d'un Item (arme/armure), on vérifie s'il est équipé.
      if (eff.origin) {
        try {
          // On récupère l'item lié à l'effet via son UUID
          const sourceItem = fromUuidSync(eff.origin); 
          // Si c'est un item possédé par l'acteur et qu'il a une propriété 'equipee'
          if (sourceItem && sourceItem.parent === actor && 
              typeof sourceItem.system.equipee !== "undefined") {
            // Si l'objet n'est pas équipé, on ignore cet effet
            if (sourceItem.system.equipee === false) continue;
          }
        } catch (e) {
          // En cas d'erreur (ex: item supprimé), on continue pour ne pas bloquer
        }
      }

      let effTags = [];
      if (eff.flags?.add2e?.tags) {
        try {
          effTags = Array.from(eff.flags.add2e.tags);
        } catch {
          effTags = eff.flags.add2e.tags;
        }
      } else if (eff.getFlag) {
        try { effTags = eff.getFlag("add2e", "tags"); } catch (e) {}
      }
      if (effTags && typeof effTags[Symbol.iterator] === "function") {
        tags.push(...Array.from(effTags));
      }
    }
    // console.log(`[ADD2eEffectsEngine][getActiveTags] Tags pour ${actor.name} :`, tags);
    return [...new Set(tags)];
  }

  static hasImmunity(actor, tag) {
    const tags = this.getActiveTags(actor);
    return (
      tags.includes(tag) ||
      tags.some(
        (t) =>
          t.startsWith("immunite:") &&
          tag.includes(t.split(":")[1])
      )
    );
  }

  static getCAFixe(actor, context = {}) {
    const tags = this.getActiveTags(actor);
    let ca = null;
    if (context.sousType === "projectile_lance") {
      let t = tags.find((t) => t.startsWith("ca_fixe_projectile_lance:"));
      if (t) ca = Number(t.split(":")[1]);
    } else if (context.sousType === "projectile_propulse") {
      let t = tags.find((t) => t.startsWith("ca_fixe_projectile_propulse:"));
      if (t) ca = Number(t.split(":")[1]);
    } else {
      let t = tags.find((t) => t.startsWith("ca_fixe_autres:"));
      if (t) ca = Number(t.split(":")[1]);
    }
    return ca;
  }

  static getSaveBonusFrontal(actor) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    for (let tag of tags) {
      if (tag.startsWith("bonus_save_frontal:")) {
        bonus += Number(tag.split(":")[1]);
      }
    }
    return bonus;
  }

  static getSaveBonusVs(actor, vsType) {
    if (!actor || !vsType) return 0;
    const tags = this.getActiveTags(actor);
    let bonus = 0;

    const vsNorm = (vsType || "")
      .toString()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s/g, "");

    for (let tag of tags) {
      if (!tag.startsWith("bonus_save_vs:")) continue;
      const parts = tag.split(":");
      const rawType = parts[1] || "";
      const val = Number(parts[2]) || 0;

      const tagTypeNorm = rawType
        .toString()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s/g, "");

      if (tagTypeNorm && vsNorm.includes(tagTypeNorm)) {
        bonus += val;
      }
    }

    return bonus;
  }

  static getCABonus(actor, context = {}) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    for (let tag of tags) {
      if (tag.startsWith("bonus_ca:")) bonus += Number(tag.split(":")[1]);
      if (context.type === "magique" && tag.startsWith("bonus_ca_magique:"))
        bonus += Number(tag.split(":")[1]);
      if (context.type === "melee" && tag.startsWith("bonus_ca_melee:"))
        bonus += Number(tag.split(":")[1]);
      if (context.type === "projectile" && tag.startsWith("bonus_ca_projectile:"))
        bonus += Number(tag.split(":")[1]);
    }
    return bonus;
  }

  static hasTag(actor, tag) {
    return this.getActiveTags(actor).includes(tag);
  }

  static analyze(actor, action) {
    const tags = this.getActiveTags(actor);
    let out = {};

    if (action.type === "spell" && action.name.toLowerCase().includes("missile magique")) {
      if (tags.includes("immunite:missile_magique")) out.immunise = true;
    }

    if (action.type === "attaque") {
      const caFixe = this.getCAFixe(actor, {
        sousType: action.sousType,
        frontale: !!action.frontale
      });
      if (caFixe !== null) out.ca_fixe = caFixe;
      out.bonus_ca = this.getCABonus(actor, action);
    }

    if (action.type === "save") {
      let bonus = 0;
      if (action.frontale) {
        bonus += this.getSaveBonusFrontal(actor);
      }
      if (action.vsType) {
        bonus += this.getSaveBonusVs(actor, action.vsType);
      }
      if (bonus !== 0) {
        out.bonus_save = (out.bonus_save || 0) + bonus;
      }
    }

    if (tags.includes("camouflage")) out.camouflage = true;
    return out;
  }

  static checkResistance(actor, typeResist) {
    const tags = this.getActiveTags(actor);
    let valeurTag = tags.find((t) => t.startsWith(`resistance:${typeResist}:`));

    if (valeurTag) {
      let brut = Number(valeurTag.split(":")[2]) || 0;
      let chance = 0;
      if (brut >= 0 && brut <= 1) {
        chance = brut * 100;
      } else {
        chance = brut;
      }
      chance = Math.max(0, Math.min(100, chance));
      const d100 = Math.ceil(Math.random() * 100);
      console.log(
        `[ADD2eEffectsEngine][checkResistance] Résistance détectée (${typeResist}) : ${chance}% | Jet : ${d100}`
      );
      return d100 <= chance;
    }
    return false;
  }

  static getBonusTouche(actor, typeArme) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    for (let tag of tags) {
      if (tag.startsWith("bonus_touche:")) {
        const [_, arme, val] = tag.split(":");
        if (arme && val && arme === typeArme) {
          bonus += Number(val);
        }
      }
    }
    return bonus;
  }

  static getBonusToucheVs(actor, typeCible) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    const typeCibleNorm = (typeCible || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s/g, "")
      .replace(/s$/, "");
    for (let tag of tags) {
      if (tag.startsWith("bonus_touche_vs:")) {
        const [, cibleTag, val] = tag.split(":");
        const cibleTagNorm = (cibleTag || "")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/\s/g, "")
          .replace(/s$/, "");
        if (cibleTagNorm === typeCibleNorm) {
          bonus += Number(val) || 0;
        }
      }
    }
    return bonus;
  }

  static getBonusCAVs(actor, typeAttaquant) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    const typeAttNorm = (typeAttaquant || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s/g, "")
      .replace(/s$/, "");
    for (let tag of tags) {
      if (tag.startsWith("bonus_ca_vs:")) {
        const [, attaquantTag, val] = tag.split(":");
        const attaquantTagNorm = (attaquantTag || "")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/\s/g, "")
          .replace(/s$/, "");
        if (attaquantTagNorm === typeAttNorm) {
          bonus += Number(val) || 0;
        }
      }
    }
    return bonus;
  }

  static getBonusSaveConstitution(actor, saveType) {
    if (!actor) return 0;
    const tags = (actor.effects?.contents || []).flatMap(
      (eff) => eff.flags?.add2e?.tags || []
    );
    let bonus = 0;

    function calculBonusCon(constBase, constRace) {
      const total = Number(constBase || 0) + Number(constRace || 0);
      let b = Math.min(5, Math.floor(total / 3.5));
      return b;
    }

    const SAVE_TYPES_MAGIE = [
      "magie", "magic", "bâton", "baton", "batons", "bâtonnet", "batonnet", "badine",
      "baguette", "baguettes", "sort", "sorts", "paralysie", "paralysisie", "paralyse",
      "petrification", "péetrification", "pétrification", "petrify", "souffle"
    ];

    const saveNorm = (saveType || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s/g, "");

    if (
      SAVE_TYPES_MAGIE.some((type) => saveNorm.includes(type)) &&
      tags.includes("bonus_save_vs:magie:const")
    ) {
      bonus = calculBonusCon(
        actor.system.constitution_base,
        actor.system.constitution_race
      );
    }

    if (
      saveNorm.includes("poison") &&
      tags.includes("bonus_save_vs:poison:const")
    ) {
      bonus = calculBonusCon(
        actor.system.constitution_base,
        actor.system.constitution_race
      );
    }

    return bonus;
  }
}

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;