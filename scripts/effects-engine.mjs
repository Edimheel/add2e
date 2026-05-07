globalThis.ADD2E_EFFECTS_ENGINE_VERSION = "2026-05-02-monk-activable-features-v5";
// ADD2E — Effects engine sans règle raciale codée en dur.
// Les tags actifs viennent des objets race/classe/équipement et de leurs effets.
class Add2eEffectsEngine {
  // =====================================================
  // OUTILS GENERAUX
  // =====================================================
  static normalizeTag(tag) {
    return String(tag ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "_");
  }

  static normalizeKey(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "_")
      .replace(/s$/, "");
  }

  static toArray(raw) {
    if (!raw) return [];

    if (Array.isArray(raw)) return raw;
    if (raw instanceof Set) return Array.from(raw);

    if (typeof raw === "string") {
      return raw
        .split(/[,;\n]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    if (typeof raw === "object") {
      if (Array.isArray(raw.value)) return raw.value;
      if (Array.isArray(raw.tags)) return raw.tags;
      if (Array.isArray(raw.list)) return raw.list;
      if (Array.isArray(raw.items)) return raw.items;
      if (Array.isArray(raw.effectTags)) return raw.effectTags;
      if (typeof raw.value === "string") return this.toArray(raw.value);
      if (typeof raw.tags === "string") return this.toArray(raw.tags);
      if (typeof raw.list === "string") return this.toArray(raw.list);
      if (typeof raw.items === "string") return this.toArray(raw.items);
      if (typeof raw.effectTags === "string") return this.toArray(raw.effectTags);
    }

    return [];
  }

  static addTagsInto(target, raw) {
    for (const tag of this.toArray(raw)) {
      const t = this.normalizeTag(tag);
      if (t) target.push(t);
    }
  }

  static addEffectTagsInto(target, effect) {
    if (!effect) return;

    this.addTagsInto(target, effect.flags?.add2e?.tags);
    this.addTagsInto(target, effect.flags?.add2e?.effectTags);

    if (effect.getFlag) {
      try { this.addTagsInto(target, effect.getFlag("add2e", "tags")); } catch (e) {}
      try { this.addTagsInto(target, effect.getFlag("add2e", "effectTags")); } catch (e) {}
    }
  }

  static addEmbeddedItemEffectTagsInto(target, item) {
    if (!item?.effects) return;

    const effects = item.effects.contents ?? item.effects ?? [];
    for (const effect of effects) {
      if (effect?.disabled) continue;
      this.addEffectTagsInto(target, effect);
    }
  }

  static getActorLevel(actor) {
    if (!actor) return 1;

    const sys = actor.system || {};
    const candidates = [
      sys.niveau,
      sys.level,
      sys.details?.level,
      sys.details?.niveau
    ];

    for (const value of candidates) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }

    return 1;
  }

  static addClassFeatureTagsInto(target, rawFeatures, actorLevel = 1) {
    if (!rawFeatures) return;

    const features = Array.isArray(rawFeatures)
      ? rawFeatures
      : (typeof rawFeatures === "object" ? Object.values(rawFeatures) : []);

    for (const feature of features) {
      if (!feature || typeof feature !== "object") continue;

      const minLevel = Number(
        feature.minLevel ??
        feature.minimumLevel ??
        feature.level ??
        feature.niveau ??
        1
      ) || 1;

      if (actorLevel < minLevel) continue;

      this.addTagsInto(target, feature.tags);
      this.addTagsInto(target, feature.tag);
      this.addTagsInto(target, feature.effectTags);
      this.addTagsInto(target, feature.effets);
      this.addTagsInto(target, feature.effects);
      this.addTagsInto(target, feature.flags?.add2e?.tags);
    }
  }


  static classFeatureMinLevel(feature) {
    const n = Number(
      feature?.minLevel ??
      feature?.minimumLevel ??
      feature?.niveauMin ??
      feature?.level ??
      feature?.niveau ??
      1
    );
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  static classFeatureMaxLevel(feature) {
    const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
    if (raw === undefined || raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  static isClassFeatureUnlocked(feature, level) {
    if (!feature || typeof feature !== "object") return false;
    const min = this.classFeatureMinLevel(feature);
    const max = this.classFeatureMaxLevel(feature);
    if (level < min) return false;
    if (max !== null && level > max) return false;
    return true;
  }

  static normalizeClassFeature(feature) {
    return {
      ...foundry.utils.deepClone(feature),
      minLevel: this.classFeatureMinLevel(feature),
      maxLevel: this.classFeatureMaxLevel(feature),
      available: true,
      activable: feature?.activable === true
    };
  }

  static isClassFeatureActivable(feature) {
    return feature?.activable === true;
  }

  static getUnlockedClassFeatures(actor) {
    if (!actor) return [];
    const level = this.getActorLevel(actor);
    const out = [];
    const pushFeatures = raw => {
      const features = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === "object" ? Object.values(raw) : []);

      for (const feature of features) {
        if (!this.isClassFeatureUnlocked(feature, level)) continue;
        out.push(this.normalizeClassFeature(feature));
      }
    };

    pushFeatures(actor.system?.classFeatures);
    pushFeatures(actor.system?.details_classe?.classFeaturesDebloquees);
    pushFeatures(actor.system?.details_classe?.classFeatures);

    if (actor.items) {
      for (const item of actor.items) {
        if (String(item.type || "").toLowerCase() === "classe") pushFeatures(item.system?.classFeatures);
      }
    }

    const seen = new Set();
    return out.filter(f => {
      const key = `${f.minLevel}|${f.name ?? f.label ?? f.title ?? f.nom ?? JSON.stringify(f.tags ?? [])}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  static getActiveClassFeatures(actor) {
    // Par convention ADD2E : "active" = activable/clicable.
    // Les passifs restent traités par getActiveTags() mais ne doivent
    // pas polluer l’onglet Capacités.
    return this.getUnlockedClassFeatures(actor).filter(f => this.isClassFeatureActivable(f));
  }

  static getConstitutionTotal(actor) {
    if (!actor) return 0;

    const sys = actor.system || {};

    const direct = Number(sys.constitution);
    if (!Number.isNaN(direct) && direct > 0) return direct;

    const base = Number(sys.constitution_base || 0);
    const race = Number(
      sys.constitution_race ??
      sys.bonus_caracteristiques?.constitution ??
      0
    );
    const divers = Number(
      sys.constitution_bonus ??
      sys.bonus_divers_caracteristiques?.constitution ??
      0
    );

    return base + race + divers;
  }

  static getConstitutionSaveBonus(actor) {
    const total = this.getConstitutionTotal(actor);
    return Math.max(0, Math.min(5, Math.floor(total / 3.5)));
  }

  // =====================================================
  // TAGS RACIAUX
  // =====================================================
  // Cette fonction reste présente pour compatibilité avec les anciens appels,
  // mais elle ne contient plus aucune règle raciale en dur.
  // Les tags doivent venir de l'objet race : system.tags, system.effectTags,
  // flags.add2e.tags/effectTags ou effets embarqués de l'item race.
  static getRacialTagsForRace(raceName) {
    return [];
  }

  static getRaceSlug(actor) {
    if (!actor) return "";

    const raceField = actor.system?.race;
    let raw = "";

    if (typeof raceField === "string") raw = raceField;
    else if (raceField && typeof raceField === "object") {
      raw = raceField.value ?? raceField.name ?? raceField.label ?? "";
    }

    raw = raw || actor.system?.details_race?.slug || actor.system?.details_race?.name || actor.system?.details_race?.label || actor.system?.details?.race || actor.system?.race_nom || "";

    if (!raw && actor.items) {
      raw = actor.items.find(i => String(i.type).toLowerCase() === "race")?.name || "";
    }

    return String(raw)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "-")
      .trim();
  }

  // =====================================================
  // TAGS ACTIFS
  // Lit :
  // - flags raciaux posés par le drop race
  // - flags de classe posés par le drop classe
  // - ActiveEffects actifs
  // - tags des items actifs / équipés
  // - effets embarqués dans les items race/classe/équipés
  // - classFeatures avec minLevel <= niveau acteur
  // =====================================================
  static getActiveTags(actor) {
    if (!actor) return [];

    const tags = [];
    const actorLevel = this.getActorLevel(actor);

    // 1. Compatibilité ancienne : ne retourne plus rien, mais évite de casser les appels.
    const raceSlug = this.getRaceSlug(actor);
    this.addTagsInto(tags, this.getRacialTagsForRace(raceSlug));

    // 2. Tags stockés directement sur l'acteur.
    this.addTagsInto(tags, actor.flags?.add2e?.racialTags);
    this.addTagsInto(tags, actor.flags?.add2e?.classTags);
    if (actor.getFlag) {
      try { this.addTagsInto(tags, actor.getFlag("add2e", "racialTags")); } catch (e) {}
      try { this.addTagsInto(tags, actor.getFlag("add2e", "classTags")); } catch (e) {}
    }

    // 2b. ClassFeatures stockées directement sur l'acteur ou sur details_classe.
    this.addClassFeatureTagsInto(tags, actor.system?.classFeatures, actorLevel);
    this.addClassFeatureTagsInto(tags, actor.system?.details_classe?.classFeatures, actorLevel);

    // 3. ActiveEffects de l'acteur.
    if (actor.effects) {
      for (const eff of actor.effects) {
        if (eff.disabled) continue;

        // Si l'effet vient d'un objet équipé/déséquipé, on respecte l'état équipé.
        if (eff.origin) {
          try {
            const sourceItem = fromUuidSync(eff.origin);
            if (
              sourceItem &&
              sourceItem.parent === actor &&
              typeof sourceItem.system?.equipee !== "undefined" &&
              sourceItem.system.equipee === false
            ) {
              continue;
            }
          } catch (e) {
            // Effet orphelin : on ne bloque pas le moteur.
          }
        }

        this.addEffectTagsInto(tags, eff);
      }
    }

    // 4. Items possédés.
    if (actor.items) {
      for (const item of actor.items) {
        const type = String(item.type || "").toLowerCase();

        const alwaysActive = type === "race" || type === "classe";
        const equipable = ["arme", "armure", "objet", "weapon", "armor", "equipment"].includes(type);

        if (!alwaysActive && !equipable) continue;
        if (equipable && item.system?.equipee !== true) continue;

        this.addTagsInto(tags, item.system?.tags);
        this.addTagsInto(tags, item.system?.tag);
        this.addTagsInto(tags, item.system?.effectTags);
        this.addTagsInto(tags, item.system?.effets);
        this.addTagsInto(tags, item.system?.effects);
        this.addTagsInto(tags, item.flags?.add2e?.tags);
        this.addTagsInto(tags, item.flags?.add2e?.effectTags);

        this.addEmbeddedItemEffectTagsInto(tags, item);

        if (alwaysActive) {
          this.addClassFeatureTagsInto(tags, item.system?.classFeatures, actorLevel);
        }

        if (item.getFlag) {
          try { this.addTagsInto(tags, item.getFlag("add2e", "tags")); } catch (e) {}
          try { this.addTagsInto(tags, item.getFlag("add2e", "effectTags")); } catch (e) {}
        }
      }
    }


    // 4b. Moine : ajoute uniquement les tags de la ligne de progression active.
    // Cela évite d'activer toutes les valeurs de tous les niveaux à la fois.
    if (actor.items) {
      const monkClass = actor.items.find(i => {
        if (String(i.type || "").toLowerCase() !== "classe") return false;
        const label = this.normalizeKey(i.system?.label || i.name || "");
        return label.includes("moine") || this.toArray(i.system?.tags).map(t => this.normalizeTag(t)).includes("classe:moine");
      });

      if (monkClass) {
        const level = this.getActorLevel(actor);
        const progression = Array.isArray(monkClass.system?.monkProgression) && monkClass.system.monkProgression.length
          ? monkClass.system.monkProgression
          : Array.isArray(monkClass.system?.progression) ? monkClass.system.progression : [];

        const row = progression.find(p => Number(p?.niveau ?? p?.level) === level)
          ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
          ?? null;

        this.addTagsInto(tags, row?.tags);
      }
    }

    return [...new Set(tags.map(t => this.normalizeTag(t)).filter(Boolean))];
  }

  static hasTag(actor, tag) {
    return this.getActiveTags(actor).includes(this.normalizeTag(tag));
  }

  // =====================================================
  // IMMUNITES / RESISTANCES
  // =====================================================
  static hasImmunity(actor, tag) {
    const wanted = this.normalizeTag(tag);
    const tags = this.getActiveTags(actor);

    return (
      tags.includes(wanted) ||
      tags.some(t => {
        if (!t.startsWith("immunite:")) return false;
        const key = this.normalizeTag(t.split(":")[1] || "");
        return key && wanted.includes(key);
      })
    );
  }

  static getResistanceAliases(typeResist) {
    const raw = String(typeResist ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "_");

    const aliases = new Set([raw]);

    if (["charme", "charm", "sommeil", "sleep", "suggestion", "charme_suggestion"].includes(raw)) {
      aliases.add("charme_sommeil");
      aliases.add("charme");
      aliases.add("sommeil");
      aliases.add("suggestion");
      aliases.add("charme_suggestion");
    }

    if (["esp", "perception_extrasensorielle", "pensee", "pensees"].includes(raw)) {
      aliases.add("esp");
      aliases.add("perception_extrasensorielle");
    }

    if (["maladie", "disease"].includes(raw)) {
      aliases.add("maladie");
      aliases.add("disease");
    }

    return [...aliases].filter(Boolean);
  }

  static getResistanceInfo(actor, typeResist) {
    const tags = this.getActiveTags(actor);
    const aliases = this.getResistanceAliases(typeResist);

    let valeurTag = null;
    let matchedType = "";

    for (const alias of aliases) {
      valeurTag = tags.find(t => t.startsWith(`resistance:${alias}:`));
      if (valeurTag) {
        matchedType = alias;
        break;
      }
    }

    if (!valeurTag) {
      return {
        found: false,
        type: String(typeResist ?? ""),
        matchedType: "",
        tag: "",
        pct: 0
      };
    }

    let brut = Number(valeurTag.split(":")[2]) || 0;
    let pct = brut >= 0 && brut <= 1 ? brut * 100 : brut;
    pct = Math.max(0, Math.min(100, pct));

    return {
      found: true,
      type: String(typeResist ?? ""),
      matchedType,
      tag: valeurTag,
      pct
    };
  }

  static checkResistanceDetails(actor, typeResist, options = {}) {
    const info = this.getResistanceInfo(actor, typeResist);

    if (!info.found) {
      const result = {
        found: false,
        resiste: false,
        type: String(typeResist ?? ""),
        matchedType: "",
        tag: "",
        pct: 0,
        jet: 0,
        details: `Aucune résistance contre ${typeResist}`
      };

      globalThis.add2eLastResistanceRoll = result;
      return result;
    }

    const jet = Math.ceil(Math.random() * 100);
    const resiste = jet <= info.pct;

    const result = {
      found: true,
      resiste,
      type: info.type,
      matchedType: info.matchedType,
      tag: info.tag,
      pct: info.pct,
      jet,
      details: `Résistance ${info.pct}% contre ${typeResist} : jet ${jet} => ${resiste ? "réussite" : "échec"}`
    };

    globalThis.add2eLastResistanceRoll = result;

    console.log(
      `[ADD2eEffectsEngine][checkResistance] ${actor?.name || "Acteur"} | ${typeResist} | ${info.pct}% | Jet d100=${jet} | ${resiste ? "RÉUSSITE" : "ÉCHEC"}`,
      result
    );

    const shouldChat = options.chat !== false;

    if (shouldChat && typeof ChatMessage !== "undefined") {
      try {
        const color = resiste ? "#1f8f3a" : "#b42318";
        const label = resiste ? "RÉSISTANCE RÉUSSIE" : "RÉSISTANCE ÉCHOUÉE";

        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `
            <div class="add2e-chat-card" style="border:1px solid #999; border-radius:6px; padding:8px; background:#fff;">
              <h3 style="margin:0 0 6px 0; color:#333;">Résistance raciale / magique</h3>
              <p style="margin:3px 0;"><b>${actor?.name || "Cible"}</b> teste une résistance contre <b>${typeResist}</b>.</p>
              <p style="margin:3px 0;"><b>Tag utilisé :</b> ${info.tag}</p>
              <p style="margin:3px 0;"><b>Chance :</b> ${info.pct}%</p>
              <p style="margin:3px 0;"><b>Jet d100 :</b> ${jet}</p>
              <p style="margin:6px 0 0 0; font-weight:bold; color:${color};">${label}</p>
            </div>
          `
        });
      } catch (e) {
        console.warn("[ADD2eEffectsEngine][checkResistance] Impossible de créer le message chat.", e);
      }
    }

    return result;
  }

  static checkResistance(actor, typeResist, options = {}) {
    return this.checkResistanceDetails(actor, typeResist, options).resiste;
  }

  // =====================================================
  // CLASSE D'ARMURE
  // =====================================================
  static getCAFixe(actor, context = {}) {
    const tags = this.getActiveTags(actor);
    let ca = null;

    if (context.sousType === "projectile_lance") {
      const t = tags.find(t => t.startsWith("ca_fixe_projectile_lance:"));
      if (t) ca = Number(t.split(":")[1]);
    } else if (context.sousType === "projectile_propulse") {
      const t = tags.find(t => t.startsWith("ca_fixe_projectile_propulse:"));
      if (t) ca = Number(t.split(":")[1]);
    } else {
      const t = tags.find(t => t.startsWith("ca_fixe_autres:"));
      if (t) ca = Number(t.split(":")[1]);
    }

    return Number.isFinite(ca) ? ca : null;
  }

  static getCABonus(actor, context = {}) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;

    for (const tag of tags) {
      if (tag.startsWith("bonus_ca:")) bonus += Number(tag.split(":")[1]) || 0;
      if (context.type === "magique" && tag.startsWith("bonus_ca_magique:")) bonus += Number(tag.split(":")[1]) || 0;
      if (context.type === "melee" && tag.startsWith("bonus_ca_melee:")) bonus += Number(tag.split(":")[1]) || 0;
      if (context.type === "projectile" && tag.startsWith("bonus_ca_projectile:")) bonus += Number(tag.split(":")[1]) || 0;
    }

    return bonus;
  }

  static getBonusCAVs(actor, typeAttaquant) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    const typeAttNorm = this.normalizeKey(typeAttaquant);

    for (const tag of tags) {
      if (!tag.startsWith("bonus_ca_vs:")) continue;
      const [, attaquantTag, val] = tag.split(":");
      const attaquantTagNorm = this.normalizeKey(attaquantTag);
      if (attaquantTagNorm === typeAttNorm) bonus += Number(val) || 0;
    }

    return bonus;
  }

  // =====================================================
  // SAUVEGARDES
  // =====================================================
  static getSaveBonusFrontal(actor) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;

    for (const tag of tags) {
      if (tag.startsWith("bonus_save_frontal:")) bonus += Number(tag.split(":")[1]) || 0;
    }

    return bonus;
  }

  static getSaveBonusVs(actor, vsType) {
    if (!actor || !vsType) return 0;

    const tags = this.getActiveTags(actor);
    let bonus = 0;
    const vsNorm = this.normalizeKey(vsType);

    for (const tag of tags) {
      if (!tag.startsWith("bonus_save_vs:")) continue;

      const parts = tag.split(":");
      const rawType = parts[1] || "";
      const val = parts[2];

      // Les tags avec :const sont traités par getBonusSaveConstitution.
      if (val === "const") continue;

      const tagTypeNorm = this.normalizeKey(rawType);
      if (tagTypeNorm && vsNorm.includes(tagTypeNorm)) bonus += Number(val) || 0;
    }

    return bonus;
  }

  static getBonusSaveConstitution(actor, saveType) {
    if (!actor) return 0;

    const tags = this.getActiveTags(actor);
    let bonus = 0;

    const saveNorm = this.normalizeKey(saveType);

    const isPoison = saveNorm.includes("poison");
    const isMagie =
      saveNorm.includes("magie") ||
      saveNorm.includes("magic") ||
      saveNorm.includes("sort") ||
      saveNorm.includes("baguette") ||
      saveNorm.includes("badine") ||
      saveNorm.includes("baton") ||
      saveNorm.includes("paralysie") ||
      saveNorm.includes("petrification") ||
      saveNorm.includes("souffle");

    if (isPoison && tags.includes("bonus_save_vs:poison:const")) {
      bonus += this.getConstitutionSaveBonus(actor);
    }

    if (
      isMagie &&
      (
        tags.includes("bonus_save_vs:magie:const") ||
        tags.includes("bonus_save_vs:sort:const") ||
        tags.includes("bonus_save_vs:baguette:const")
      )
    ) {
      bonus += this.getConstitutionSaveBonus(actor);
    }

    return bonus;
  }

  // =====================================================
  // ATTAQUE
  // =====================================================
  static getBonusTouche(actor, typeArme) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    const typeArmeNorm = this.normalizeKey(typeArme);

    if (!typeArmeNorm) return 0;

    for (const tag of tags) {
      if (!tag.startsWith("bonus_touche:")) continue;

      const [_, arme, val] = tag.split(":");
      const armeNorm = this.normalizeKey(arme);

      if (armeNorm && armeNorm === typeArmeNorm) bonus += Number(val) || 0;
    }

    return bonus;
  }

  static getBonusToucheVs(actor, typeCible) {
    const tags = this.getActiveTags(actor);
    let bonus = 0;
    const typeCibleNorm = this.normalizeKey(typeCible);

    if (!typeCibleNorm) return 0;

    for (const tag of tags) {
      if (!tag.startsWith("bonus_touche_vs:")) continue;

      const [, cibleTag, val] = tag.split(":");
      const cibleTagNorm = this.normalizeKey(cibleTag);

      if (cibleTagNorm === typeCibleNorm) bonus += Number(val) || 0;
    }

    return bonus;
  }



  // =====================================================
  // MOINE — progression spéciale pilotée par tags + données de classe
  // =====================================================
  static getActorClassSystem(actor) {
    if (!actor) return null;

    const classItem = actor.items?.find?.(i => String(i.type || "").toLowerCase() === "classe") ?? null;
    return classItem?.system ?? actor.system?.details_classe ?? null;
  }

  static isMonk(actor) {
    const cls = this.getActorClassSystem(actor);
    const label = this.normalizeKey(cls?.label || cls?.name || cls?.nom || actor?.system?.classe || "");
    return label.includes("moine") || this.hasTag(actor, "classe:moine");
  }

  static getClassProgressionEntry(actor, progressionField = "progression") {
    const cls = this.getActorClassSystem(actor);
    const level = this.getActorLevel(actor);
    const progression = cls?.[progressionField] ?? cls?.progression ?? [];

    if (!Array.isArray(progression) || !progression.length) return null;

    return progression.find(p => Number(p?.niveau ?? p?.level) === level)
      ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
      ?? null;
  }

  static getMonkProgression(actor) {
    if (!this.isMonk(actor)) return null;
    return this.getClassProgressionEntry(actor, "monkProgression")
      ?? this.getClassProgressionEntry(actor, "progression");
  }

  static getMonkArmorClass(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.monkAC ?? p?.caMoine ?? p?.ca_moine);
    return Number.isFinite(v) ? v : null;
  }

  static getMonkMove(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.move ?? p?.movement ?? p?.mouvement);
    return Number.isFinite(v) ? v : null;
  }

  static getMonkOpenDoors(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.openDoors ?? p?.ouvrir_portes);
    return Number.isFinite(v) ? v : null;
  }

  static getMonkUnarmedDamage(actor) {
    const p = this.getMonkProgression(actor);
    return String(p?.unarmedDamage ?? p?.main_nue ?? p?.damage ?? "").trim();
  }

  static getMonkAttacksPerRound(actor) {
    const p = this.getMonkProgression(actor);
    return String(p?.attacksPerRound ?? p?.attaquesParRound ?? "").trim();
  }

  static getMonkStunParalyze(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.stunParalyze ?? p?.etourdissement ?? p?.paralysie);
    return Number.isFinite(v) ? v : 0;
  }

  static getMonkSlowFall(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.slowFall ?? p?.chute_ralentie);
    return Number.isFinite(v) ? v : 0;
  }

  static getMonkSelfHealPerDay(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.selfHealPerDay ?? p?.auto_soin);
    return Number.isFinite(v) ? v : 0;
  }

  static getMonkWeaponDamageBonus(actor) {
    const p = this.getMonkProgression(actor);
    const explicit = Number(p?.monkWeaponDamageBonus ?? p?.bonusDegatsArme ?? p?.bonus_degats_arme);
    if (Number.isFinite(explicit)) return explicit;
    if (!this.isMonk(actor)) return 0;
    return Math.floor(this.getActorLevel(actor) / 2);
  }

  static hasMonkDiseaseImmunity(actor) {
    return this.hasImmunity(actor, "maladie");
  }

  static getMonkProgressionTags(actor) {
    const p = this.getMonkProgression(actor);
    if (!p) return [];
    return this.toArray(p.tags).map(t => this.normalizeTag(t)).filter(Boolean);
  }

  static getMonkResistCharmSuggestion(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.resistCharmSuggestion ?? p?.resistance_charme_suggestion);
    return Number.isFinite(v) ? v : 0;
  }

  static getMonkResistESP(actor) {
    const p = this.getMonkProgression(actor);
    const v = Number(p?.resistESP ?? p?.resistance_esp);
    return Number.isFinite(v) ? v : 0;
  }

  static hasMonkQuiveringPalm(actor) {
    const p = this.getMonkProgression(actor);
    return !!p?.quiveringPalm || this.hasTag(actor, "moine:paume_palpitante") || this.hasTag(actor, "paume_palpitante");
  }

  static getMonkSummary(actor) {
    const p = this.getMonkProgression(actor);
    if (!p) return null;

    return {
      level: this.getActorLevel(actor),
      title: p.title ?? "",
      armorClass: this.getMonkArmorClass(actor),
      move: this.getMonkMove(actor),
      openDoors: this.getMonkOpenDoors(actor),
      unarmedDamage: this.getMonkUnarmedDamage(actor),
      weaponDamageBonus: this.getMonkWeaponDamageBonus(actor),
      attacksPerRound: this.getMonkAttacksPerRound(actor),
      stunParalyze: this.getMonkStunParalyze(actor),
      slowFall: this.getMonkSlowFall(actor),
      selfHealPerDay: this.getMonkSelfHealPerDay(actor),
      resistCharmSuggestion: this.getMonkResistCharmSuggestion(actor),
      resistESP: this.getMonkResistESP(actor),
      quiveringPalm: this.hasMonkQuiveringPalm(actor),
      activeCapabilities: this.getActiveClassFeatures(actor)
        .filter(f => {
          const tags = this.toArray(f.tags).map(t => this.normalizeTag(t));
          const name = this.normalizeKey(f.name ?? f.label ?? f.title ?? f.nom ?? "");
          return tags.some(t => t.startsWith("moine:") || t.startsWith("immunite:") || t.startsWith("resistance:")) || name.includes("moine") || name.includes("chute") || name.includes("auto") || name.includes("paume");
        })
    };
  }


  // =====================================================
  // ANALYSE GENERIQUE
  // =====================================================
  static analyze(actor, action) {
    const tags = this.getActiveTags(actor);
    const out = {};

    if (action.type === "spell" && String(action.name || "").toLowerCase().includes("missile magique")) {
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

      if (action.frontale) bonus += this.getSaveBonusFrontal(actor);
      if (action.vsType) bonus += this.getSaveBonusVs(actor, action.vsType);
      if (action.vsType) bonus += this.getBonusSaveConstitution(actor, action.vsType);

      if (bonus !== 0) out.bonus_save = (out.bonus_save || 0) + bonus;
    }

    if (action.type === "moine" || action.type === "monk") out.moine = this.getMonkSummary(actor);

    if (tags.includes("camouflage")) out.camouflage = true;

    return out;
  }

  static getInfravision(actor) {
    const tags = this.getActiveTags(actor);
    let best = 0;

    for (const tag of tags) {
      if (!tag.startsWith("infravision:")) continue;
      const val = Number(tag.split(":")[1]) || 0;
      if (val > best) best = val;
    }

    return best;
  }
}

globalThis.Add2eEffectsEngine = Add2eEffectsEngine;
