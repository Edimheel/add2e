// ADD2E — Effects Engine / analyse de contexte.
// Extraction fonctionnelle sans changement de règle.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineAnalysis(Engine) {
  register(Engine, {
    analyze(actor, action = {}) {
      const tags = this.getActiveTags(actor);
      const out = {};

      if (
        action.type === "spell"
        && String(action.name || "").toLowerCase().includes("missile magique")
        && tags.includes("immunite:missile_magique")
      ) out.immunise = true;

      if (action.type === "attaque") {
        const fixed = this.getConditionalFixedCA(actor, {
          sousType: action.sousType,
          frontale: !!action.frontale,
          type: action.type,
          source: action.source
        });
        if (fixed.ca !== null) out.ca_fixe = fixed.ca;
        out.ca_fixe_details = fixed;
        out.bonus_ca = this.getCABonus(actor, action);
      }

      if (action.type === "save") {
        let bonus = 0;
        if (action.frontale) bonus += this.getSaveBonusFrontal(actor);
        if (action.vsType) bonus += this.getSaveBonusVs(actor, action.vsType) + this.getBonusSaveConstitution(actor, action.vsType);
        if (bonus !== 0) out.bonus_save = (out.bonus_save || 0) + bonus;
      }

      if (action.type === "moine" || action.type === "monk") out.moine = this.getMonkSummary(actor);
      if (tags.includes("camouflage")) out.camouflage = true;
      return out;
    },

    getInfravision(actor) {
      let best = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (!tag.startsWith("infravision:")) continue;
        const value = Number(tag.split(":")[1]) || 0;
        if (value > best) best = value;
      }
      return best;
    }
  });
}
