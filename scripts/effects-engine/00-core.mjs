// ADD2E — Effects Engine / noyau partagé.
// Ce module ne corrige aucune règle : il extrait les primitives du moteur existant.
// Compatible Foundry V13/V14/V15.

import { add2eTimeEffectData } from "../add2e/19a-time-engine.mjs";

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const clone = value => {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
};

const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function potionContextActor(context = {}) {
  return context.actor ?? context.args?.[0]?.actor ?? null;
}

function potionContextItem(context = {}) {
  return context.sourceItem ?? context.item ?? context.args?.[0]?.sourceItem ?? context.args?.[0]?.item ?? null;
}

async function potionRoll(formula, actor, flavor) {
  const roll = await new Roll(String(formula || "0")).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  return Number(roll.total) || 0;
}

function potionTargets(actor, selfOnly = false) {
  if (selfOnly) return actor ? [actor] : [];
  const targets = Array.from(game.user?.targets ?? []).map(token => token.actor).filter(Boolean);
  return targets.length ? targets : (actor ? [actor] : []);
}

function potionHpDescriptor(actor) {
  const system = actor?.system ?? {};
  return [
    { path: "system.pdv", value: system.pdv, max: system.points_de_coup },
    { path: "system.pv.value", value: system.pv?.value, max: system.pv?.max },
    { path: "system.hp.value", value: system.hp?.value, max: system.hp?.max },
    { path: "system.points_de_vie.value", value: system.points_de_vie?.value, max: system.points_de_vie?.max }
  ].find(row => Number.isFinite(Number(row.value))) ?? null;
}

async function potionDuration(actor, config = {}) {
  if (config.durationFormula) {
    const total = await potionRoll(config.durationFormula, actor, `${config.name} — durée`);
    return Math.max(0, total * (Number(config.durationMultiplier) || 1));
  }
  return Math.max(0, Number(config.durationRounds) || 0);
}

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
      const passiveArmorClass = typeof this.getPassiveArmorClassBase === "function"
        ? this.getPassiveArmorClassBase(actor, { ruleScope: "owner", source: "dex-defense" })
        : null;
      if (passiveArmorClass?.ignoreDex === true) return 0;

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
    },

    async createTimedEffect({ actor, name, img = null, sourceItem = null, rounds = 0, unit = "round", description = "", tags = [], rules = [], changes = [], endMessage = null, silentExpiration = false, extraFlags = {} } = {}) {
      if (!actor) throw new Error("Acteur introuvable pour l’effet temporaire.");
      const data = add2eTimeEffectData({
        name,
        img: img || sourceItem?.img || "icons/svg/aura.svg",
        origin: sourceItem?.uuid ?? null,
        rounds,
        unit,
        description,
        tags,
        changes,
        source: "objet_magique",
        caster: actor,
        sourceItem,
        endMessage,
        silentExpiration,
        extraFlags: {
          rules: clone(rules),
          genericEffect: true,
          ...clone(extraFlags)
        }
      });
      const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
      return effect ?? null;
    },

    async createTimedCharacteristicEffect({ actor, characteristic, value, displayValue = null, profile = {}, priority = 100, rules = [], changes = [], ...options } = {}) {
      const ability = this.normalizeKey(characteristic);
      if (!actor || !ability || value === undefined || value === null || value === "") throw new Error("Override de caractéristique invalide.");
      const mode = CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5;
      const profileChanges = [];
      if (ability === "force") {
        if (displayValue !== null) profileChanges.push({ key: "system.for_aff", mode, value: String(displayValue), priority });
        if (profile.toucher !== undefined) profileChanges.push({ key: "system.force_bonus_toucher", mode, value: Number(profile.toucher) || 0, priority });
        if (profile.degats !== undefined) profileChanges.push({ key: "system.force_bonus_degats", mode, value: Number(profile.degats) || 0, priority });
        if (profile.poids !== undefined) {
          const weight = Number(profile.poids) || 0;
          profileChanges.push(
            { key: "system.force_poids", mode, value: weight, priority },
            { key: "system.charge_max", mode, value: weight, priority },
            { key: "system.charge_max_bench", mode, value: weight, priority }
          );
        }
        if (profile.ouvrir !== undefined) profileChanges.push(
          { key: "system.force_ouvrir", mode, value: String(profile.ouvrir), priority },
          { key: "system.force_bonus_porte", mode, value: String(profile.ouvrir), priority }
        );
        if (profile.tordre !== undefined) profileChanges.push({ key: "system.force_tordre", mode, value: String(profile.tordre), priority });
      }
      return this.createTimedEffect({
        ...options,
        actor,
        changes: [...changes, ...profileChanges],
        rules: [
          ...rules,
          { kind: "characteristic_override", characteristic: ability, value, displayValue: displayValue ?? value, profile: clone(profile), priority }
        ],
        extraFlags: {
          ...(options.extraFlags ?? {}),
          characteristicEffect: true,
          characteristic: ability,
          characteristicValue: value,
          characteristicDisplayValue: displayValue ?? value,
          characteristicProfile: clone(profile)
        }
      });
    },

    async postGenericEffectChat(actor, title, html, item = null) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="add2e-chat-card add2e-generic-effect" style="border:1px solid #7a4b19;border-radius:8px;overflow:hidden;background:#fff8e7;color:#38250d;">
          <div style="display:flex;align-items:center;gap:8px;background:#8b5a22;color:#fff;padding:7px 9px;">
            <img src="${escapeHtml(item?.img || actor?.img || "icons/svg/aura.svg")}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #ead8ad;background:#fff;">
            <div style="font-weight:900;">${escapeHtml(title)}</div>
          </div>
          <div style="padding:9px 10px;line-height:1.35;">${html}</div>
        </div>`
      });
    },

    async applyConfiguredEffect(context, config = {}) {
      const actor = potionContextActor(context);
      const item = potionContextItem(context);
      if (!actor) return false;

      if (config.kind === "healing") {
        const total = await potionRoll(config.formula, actor, config.name);
        const hp = potionHpDescriptor(actor);
        if (!hp) {
          await this.postGenericEffectChat(actor, config.name, `<p>Soins obtenus : <b>${total}</b>. Aucun champ de points de vie compatible n’a été trouvé.</p>`, item);
          return true;
        }
        const before = Number(hp.value) || 0;
        const maximum = Number.isFinite(Number(hp.max)) ? Number(hp.max) : before + total;
        const after = Math.min(maximum, before + total);
        await actor.update({ [hp.path]: after }, { add2eInternal: true, add2eReason: "potion-healing" });
        await this.postGenericEffectChat(actor, config.name, `<p>Points de vie : <b>${before} → ${after}</b>.</p><p>Soins effectifs : <b>${after - before}</b>.</p>`, item);
        return true;
      }

      if (config.kind === "age") {
        const total = await potionRoll(config.formula, actor, config.name);
        const system = actor.system ?? {};
        const target = [
          ["system.age", system.age],
          ["system.details.age", system.details?.age],
          ["system.age_actuel", system.age_actuel]
        ].find(([, value]) => Number.isFinite(Number(value)));
        if (target) {
          const [path, before] = target;
          const after = Math.max(0, Number(before) - total);
          await actor.update({ [path]: after }, { add2eInternal: true, add2eReason: "potion-age" });
          await this.postGenericEffectChat(actor, config.name, `<p>Âge : <b>${before} → ${after}</b>.</p>`, item);
        } else {
          await this.postGenericEffectChat(actor, config.name, `<p>Réduction d’âge à appliquer : <b>${total}</b> an(s).</p>`, item);
        }
        return true;
      }

      if (config.kind === "deception") {
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, "tromperie"],
          rules: [{ kind: "deception", apparentEffect: config.apparentEffect || "soins" }],
          extraFlags: { potion: true, potionSlug: config.slug, deceptivePotion: true }
        });
        await this.postGenericEffectChat(actor, config.name, "<p>Le consommateur croit que la potion a produit l’effet attendu. Aucun bénéfice réel n’est appliqué.</p>", item);
        return true;
      }

      if (config.kind === "heroism") {
        const level = this.getActorLevel(actor);
        if (level >= Number(config.maxLevelExclusive ?? Infinity)) {
          ui.notifications.warn(`${config.name} est sans effet sur un personnage de niveau ${level}.`);
          return false;
        }
        const row = (config.levelTable ?? []).find(entry => level >= Number(entry.min) && level <= Number(entry.max));
        if (!row) return false;
        const temporaryHp = await potionRoll(row.hpDice, actor, `${config.name} — points de vie temporaires`);
        const rounds = await potionDuration(actor, config);
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: [
            { kind: "temporary_levels", value: Number(row.bonus) || 0 },
            { kind: "temporary_hp", value: temporaryHp }
          ],
          endMessage: `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, temporaryLevels: Number(row.bonus) || 0, temporaryHp }
        });
        await this.postGenericEffectChat(actor, config.name, `<p>Niveaux temporaires : <b>+${Number(row.bonus) || 0}</b>.</p><p>Points de vie temporaires : <b>${temporaryHp}</b>.</p>${rounds ? `<p>Durée : <b>${rounds} round(s)</b>.</p>` : ""}`, item);
        return true;
      }

      const rounds = await potionDuration(actor, config);
      const targets = potionTargets(actor, config.selfOnly === true);
      if (!targets.length) return false;
      if (config.confirm === true) {
        const DialogV2 = foundry.applications?.api?.DialogV2;
        if (!DialogV2?.confirm) throw new Error("DialogV2 est indisponible.");
        const accepted = await DialogV2.confirm({
          window: { title: config.name || "Effet" },
          modal: true,
          content: `<div class="add2e-dialog"><p><b>${escapeHtml(config.name || "Effet")}</b></p><p>Cible(s) : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b></p>${config.saveNote ? `<p>${escapeHtml(config.saveNote)}</p>` : ""}<p>Appliquer l’effet ?</p></div>`,
          yes: { label: "Appliquer", icon: "fa-solid fa-check" },
          no: { label: "Annuler", icon: "fa-solid fa-xmark" }
        });
        if (!accepted) return false;
      }
      for (const target of targets) {
        await this.createTimedEffect({
          actor: target,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds,
          description: config.description || config.rule || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: config.rules ?? [],
          endMessage: config.endMessage ?? `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, ...(config.extraFlags ?? {}) }
        });
      }
      await this.postGenericEffectChat(actor, config.name, `<p>Effet appliqué à : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b>.</p>${rounds ? `<p>Durée : <b>${rounds} round(s)</b>.</p>` : ""}${config.rule ? `<p>${escapeHtml(config.rule)}</p>` : ""}`, item);
      return true;
    }
  });
}
