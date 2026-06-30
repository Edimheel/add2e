// ADD2E — Effects Engine / noyau partagé.
// Ce module ne corrige aucune règle : il extrait les primitives du moteur existant.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineCore(Engine) {
  register(Engine, {
    normalizeTag(v) {
      return String(v ?? "").trim().toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/\s+/g, "_");
    },

    normalizeKey(v) {
      return this.normalizeTag(v).replace(/s$/, "");
    },

    toArray(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (v instanceof Set) return [...v];
      if (typeof v === "string") return v.split(/[,;\n|]+/).map(s => s.trim()).filter(Boolean);
      if (typeof v === "object") {
        for (const k of ["value", "tags", "list", "items", "effectTags"]) {
          if (v[k] !== undefined && v[k] !== null) return this.toArray(v[k]);
        }
      }
      return [];
    },

    readNumber(...vals) {
      for (const v of vals) {
        if (v === undefined || v === null || v === "") continue;
        if (typeof v === "object") {
          const n = this.readNumber(v.value, v.current, v.actuel, v.total, v.max);
          if (Number.isFinite(n)) return n;
          continue;
        }
        const n = Number(String(v).replace(",", "."));
        if (Number.isFinite(n)) return n;
      }
      return null;
    },

    addTagsInto(dst, raw) {
      if (!dst) return;
      const add = typeof dst.add === "function"
        ? value => dst.add(value)
        : typeof dst.push === "function"
          ? value => dst.push(value)
          : null;
      if (!add) return;
      for (const tag of this.toArray(raw)) {
        const normalized = this.normalizeTag(tag);
        if (normalized) add(normalized);
      }
    },

    addEffectTagsInto(dst, effect) {
      if (!effect) return;
      this.addTagsInto(dst, effect.flags?.add2e?.tags);
      this.addTagsInto(dst, effect.flags?.add2e?.effectTags);
      if (!effect.getFlag) return;
      try { this.addTagsInto(dst, effect.getFlag("add2e", "tags")); } catch {}
      try { this.addTagsInto(dst, effect.getFlag("add2e", "effectTags")); } catch {}
    },

    addEmbeddedItemEffectTagsInto(dst, item) {
      const effects = item?.effects?.contents ?? item?.effects ?? [];
      for (const effect of effects) if (!effect?.disabled) this.addEffectTagsInto(dst, effect);
    },

    getActorLevel(actor) {
      const system = actor?.system ?? {};
      for (const value of [system.niveau, system.level, system.details?.level, system.details?.niveau]) {
        const level = Number(value);
        if (Number.isFinite(level) && level > 0) return level;
      }
      return 1;
    },

    itemTags(item) {
      const system = item?.system ?? {};
      const out = [];
      for (const value of [
        item?.name, system.nom, system.categorie, system.category, system.type,
        system.sousType, system.sous_type, system.famille, system.famille_arme,
        system.tags, system.tag, system.effectTags, system.effets, system.effects,
        item?.flags?.add2e?.tags, item?.flags?.add2e?.effectTags
      ]) this.addTagsInto(out, value);
      return [...new Set(out.map(tag => this.normalizeTag(tag)).filter(Boolean))];
    },

    itemText(item) {
      return this.itemTags(item).join(" ");
    },

    itemEquipped(item) {
      const system = item?.system ?? {};
      return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
    },

    isShieldItem(item) {
      const text = this.itemText(item);
      return text.includes("bouclier") || text.includes("shield");
    },

    isHelmetItem(item) {
      const text = this.itemText(item);
      return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
    },

    bonusFromName(item) {
      const match = String(item?.name ?? item?.system?.nom ?? "").match(/\+\s*(\d+)/);
      return match ? Number(match[1]) || 0 : 0;
    },

    looksMagical(item) {
      const system = item?.system ?? {};
      const text = this.itemText(item);
      return system.magique === true
        || system.magic === true
        || text.includes("magique")
        || text.includes("magic")
        || /\+\s*\d+/.test(String(item?.name ?? ""));
    },

    itemDefenseBonus(item) {
      const system = item?.system ?? {};
      let bonus = Math.abs(this.readNumber(
        system.bonus_ca, system.bonus_ac, system.ca_bonus, system.ac_bonus,
        system.protectionBonus, system.protection_bonus
      ) ?? 0);
      for (const tag of this.itemTags(item)) {
        const match = tag.match(/^(?:bonus_ca|bonus_ac|protection|protection_ca):([+\-]?\d+)$/);
        if (match) bonus += Math.abs(Number(match[1]) || 0);
      }
      if (!bonus && this.looksMagical(item)) {
        const type = String(item?.type ?? "").toLowerCase();
        const text = this.itemText(item);
        if (type === "armure" || type === "armor" || text.includes("anneau") || text.includes("bague") || text.includes("cape") || text.includes("protection")) {
          bonus = this.bonusFromName(item);
        }
      }
      return bonus;
    },

    itemFixedCA(item) {
      const system = item?.system ?? {};
      const type = String(item?.type ?? "").toLowerCase();
      const text = this.itemText(item);
      let ca = this.readNumber(
        system.ca_fixe, system.caFixe, system.fixedCA, system.fixed_ac, system.ac_fixe, system.acFixe
      );
      for (const tag of this.itemTags(item)) {
        const match = tag.match(/^(?:ca_fixe|ca_fixe_autres|ac_fixe|fixed_ca|classe_armure):([+\-]?\d+)$/);
        if (match) ca = Number(match[1]);
      }
      if (!Number.isFinite(ca)
        && (type === "objet" || type === "object" || type === "equipment")
        && (text.includes("bracelet") || text.includes("bracer"))) {
        const match = String(item?.name ?? system.nom ?? "").match(/(?:ca|classe\s+d[’']?armure|ac)\s*([\-]?\d+)/i)
          || String(item?.name ?? system.nom ?? "").match(/\b([\-]?\d+)\b\s*$/);
        if (match) ca = Number(match[1]);
      }
      return Number.isFinite(ca) ? ca : null;
    },

    getMagicWeaponBonus(item, kind = "hit") {
      const system = item?.system ?? {};
      const value = kind === "damage"
        ? this.readNumber(system.bonus_dom, system.bonus_degats, system.damage_bonus, system.degats_bonus, system.bonusDegats)
        : this.readNumber(system.bonus_hit, system.bonus_toucher, system.hit_bonus, system.attack_bonus, system.bonusAttaque);
      if (Number.isFinite(value)) return value;
      return this.looksMagical(item) ? this.bonusFromName(item) : 0;
    },

    equippedItems(actor, types = null) {
      const allowed = types ? new Set(types.map(type => String(type).toLowerCase())) : null;
      return [...(actor?.items ?? [])].filter(item => {
        const type = String(item?.type ?? "").toLowerCase();
        return (!allowed || allowed.has(type)) && this.itemEquipped(item);
      });
    },

    getDexDefense(actor) {
      const system = actor?.system ?? {};
      const direct = this.readNumber(system.dex_def, system.dexDefense, system.dex_defense, system.mod_dex_defense);
      if (Number.isFinite(direct)) return direct;
      const dex = this.readNumber(system.dexterite, system.dexterite_base, system.dex, system.dexterity) ?? 10;
      if (dex <= 3) return 4;
      if (dex === 4) return 3;
      if (dex === 5) return 2;
      if (dex === 6) return 1;
      if (dex <= 14) return 0;
      if (dex === 15) return -1;
      if (dex === 16) return -2;
      if (dex === 17) return -3;
      return -4;
    }
  });
}
