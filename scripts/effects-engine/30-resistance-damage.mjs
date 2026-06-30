// ADD2E — Effects Engine / résistances et dégâts élémentaires.
// Extraction fonctionnelle sans changement de règle ni correction de compatibilité.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineDamage(Engine) {
  register(Engine, {
    getDamageContext(type = "", details = "") {
      const raw = `${String(type ?? "")} ${String(details ?? "")}`;
      const normalized = this.normalizeTag(raw);
      const typeKey = this.normalizeTag(type);
      const detailKey = this.normalizeTag(details);
      const cold = typeKey.includes("froid") || typeKey.includes("cold") || detailKey.includes("froid") || detailKey.includes("cold");
      const fire = typeKey.includes("feu") || typeKey.includes("fire") || detailKey.includes("feu") || detailKey.includes("fire");
      const element = cold ? "froid" : fire ? "feu" : "";
      const natural = element === "froid" && (
        normalized.includes("froid_naturel")
        || normalized.includes("cold_natural")
        || normalized.includes("froidnaturel")
      );
      const temperatureMatch = raw.match(/(?:temperature|temp)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/i);
      const temperature = temperatureMatch ? Number(String(temperatureMatch[1]).replace(",", ".")) : null;
      return { element, natural, temperature, raw, normalized };
    },

    getNaturalTemperatureLimit(tags, element) {
      for (const tag of tags) {
        const match = tag.match(new RegExp(`^temperature:${element}_naturel:(-?\\d+(?:\\.\\d+)?)$`));
        if (match) return Number(match[1]);
      }
      return null;
    },

    getDamageReductionFactor(value, fallback) {
      const normalized = this.normalizeTag(value);
      if (["annule", "zero", "0"].includes(normalized)) return 0;
      if (["quart", "quarter", "25", "0_25"].includes(normalized)) return 0.25;
      if (["moitie", "half", "50", "0_5"].includes(normalized)) return 0.5;
      const numeric = Number(String(value).replace(",", "."));
      if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 1) return numeric;
      if (Number.isFinite(numeric) && numeric > 1 && numeric <= 100) return numeric / 100;
      return fallback;
    },

    getDamageResistanceRule(actor, element) {
      if (!actor || !element) return { found: false };
      const tags = this.getActiveTags(actor);
      const active = tags.includes(`resistance:${element}`)
        || tags.includes(`etat:resistance_${element}`)
        || tags.includes(`sort:resistance_au_${element}`)
        || tags.includes(`damage:resistance:${element}`);
      if (!active) return { found: false, tags };

      const failedTag = tags.find(tag => tag.startsWith(`reduction_degats:${element}:echec:`))
        ?? tags.find(tag => tag.startsWith(`degats_${element}_si_save_rate:`))
        ?? "";
      const succeededTag = tags.find(tag => tag.startsWith(`reduction_degats:${element}:reussite:`))
        ?? tags.find(tag => tag.startsWith(`degats_${element}_si_save_reussi:`))
        ?? "";

      return {
        found: true,
        tags,
        element,
        bonus: this.getSaveBonusVs(actor, element),
        failedMultiplier: this.getDamageReductionFactor(failedTag.split(":").at(-1), 0.5),
        succeededMultiplier: this.getDamageReductionFactor(succeededTag.split(":").at(-1), 0.25)
      };
    },

    getDamageSaveThreshold(actor) {
      const system = actor?.system ?? {};
      if (Array.isArray(system.sauvegardes)) {
        const value = this.readNumber(system.sauvegardes[4]);
        if (Number.isFinite(value) && value > 0) return value;
      }
      return this.readNumber(
        system.sauvegarde_sortileges,
        system.sauvegarde_sorts,
        system.sauvegardes?.sortileges,
        system.sauvegardes?.sorts,
        system.saves?.sorts,
        system.calculatedSaves?.sorts,
        system.jp_sort,
        system.jp_sorts,
        system.jp?.sorts,
        system.jp?.sortileges
      );
    },

    async rollDamageSave(actor, bonus = 0) {
      const threshold = this.getDamageSaveThreshold(actor);
      if (!Number.isFinite(threshold) || threshold <= 0) {
        return {
          canRoll: false,
          threshold: NaN,
          total: 0,
          success: false,
          bonus: Number(bonus) || 0
        };
      }

      const value = Number(bonus) || 0;
      const formula = value ? `1d20${value >= 0 ? "+" : ""}${value}` : "1d20";
      const roll = await new Roll(formula).evaluate();

      if (game.dice3d) await game.dice3d.showForRoll(roll);
      const total = Number(roll.total) || 0;
      return {
        canRoll: true,
        threshold,
        total,
        success: total >= threshold,
        bonus: value,
        roll
      };
    },

    escapeChatHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    async createDamageResistanceChat(actor, result) {
      if (!result?.applied || typeof ChatMessage === "undefined") return;

      const title = result.naturalProtection
        ? `PROTECTION CONTRE LE ${String(result.element ?? "").toUpperCase()} NATUREL`
        : `RÉSISTANCE AU ${String(result.element ?? "").toUpperCase()}`;

      const rule = result.naturalProtection
        ? `Température déclarée : ${result.context.temperature} °C. Protection active jusqu’à ${result.naturalLimit} °C.`
        : result.save?.canRoll
          ? `Jet de protection : ${result.save.total} / seuil ${result.save.threshold}, bonus ${result.save.bonus >= 0 ? "+" : ""}${result.save.bonus}. ${result.save.success ? "Dégâts réduits au quart." : "Dégâts réduits de moitié."}`
          : "Jet de protection indisponible : dégâts réduits de moitié.";

      const escape = this.escapeChatHtml;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="add2e-chat-card add2e-damage-resistance-card" style="font-family:var(--font-primary);background:#eef7ff;border:1px solid #5aa3d8;border-radius:8px;padding:9px;color:#15344a;"><div style="font-weight:900;color:#1f6f9f;font-size:1.05em;margin-bottom:5px;">${escape(title)}</div><div><b>${escape(actor?.name ?? "La cible")}</b> bénéficie d’une protection active.</div><div style="margin-top:5px;">${escape(rule)}</div><div style="margin-top:5px;font-weight:800;">Dégâts : <b>${result.original}</b> → <b>${result.amount}</b></div></div>`,
        ...(CONST.CHAT_MESSAGE_STYLES
          ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
          : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
      });
    },

    async resolveIncomingDamage(actor, { amount = 0, type = "", details = "", chat = true } = {}) {
      const original = Math.max(0, Number(amount) || 0);
      if (!actor || original <= 0) return { amount: original, applied: false, original };

      const context = this.getDamageContext(type, details);
      if (!context.element) return { amount: original, applied: false, original, context };

      const tags = this.getActiveTags(actor);
      const naturalLimit = this.getNaturalTemperatureLimit(tags, context.element);

      if (
        context.natural
        && Number.isFinite(context.temperature)
        && Number.isFinite(naturalLimit)
        && context.temperature >= naturalLimit
      ) {
        const result = {
          amount: 0,
          applied: true,
          original,
          element: context.element,
          context,
          naturalProtection: true,
          naturalLimit,
          save: null
        };
        if (chat) await this.createDamageResistanceChat(actor, result);
        return result;
      }

      const rule = this.getDamageResistanceRule(actor, context.element);
      if (!rule.found) return { amount: original, applied: false, original, context };

      const save = await this.rollDamageSave(actor, rule.bonus);
      const multiplier = save.canRoll && save.success ? rule.succeededMultiplier : rule.failedMultiplier;
      const reduced = Math.max(1, Math.floor(original * multiplier));

      const result = {
        amount: reduced,
        applied: true,
        original,
        element: context.element,
        context,
        rule,
        save,
        naturalProtection: false
      };

      if (chat) await this.createDamageResistanceChat(actor, result);
      return result;
    }
  });
}
