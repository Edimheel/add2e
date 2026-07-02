// ADD2E — Effects Engine / analyse de contexte.
// Extraction fonctionnelle sans changement de règle.

import { installRacialProfileFallbacks } from './60-racial-profiles.mjs';

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

function installRacialImmunityAliases(Engine) {
  queueMicrotask(() => {
    if (Engine.__add2eRacialImmunityAliasesInstalled || typeof Engine.hasImmunity !== 'function') return;
    Engine.__add2eRacialImmunityAliasesInstalled = true;
    const previous = Engine.hasImmunity.bind(Engine);
    Object.defineProperty(Engine, 'hasImmunity', {
      configurable: true,
      writable: true,
      value(actor, type) {
        const normalized = this.normalizeTag(type);
        const aliases = new Set([normalized]);
        if (normalized === 'peur' || normalized === 'fear') {
          aliases.add('peur');
          aliases.add('fear');
        }
        const tags = this.getActiveTags(actor);
        if ([...aliases].some(alias => tags.includes(`immunite:${alias}`) || tags.includes(`protection:${alias}`))) return true;
        return previous(actor, type);
      }
    });
  });
}

export function installEffectsEngineAnalysis(Engine) {
  register(Engine, {
    analyze(actor, action = {}) {
      const tags = this.getActiveTags(actor);
      const out = {};

      if (
        action.type === 'spell'
        && String(action.name || '').toLowerCase().includes('missile magique')
        && tags.includes('immunite:missile_magique')
      ) out.immunise = true;

      if (action.type === 'attaque') {
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

      if (action.type === 'save') {
        let bonus = 0;
        if (action.frontale) bonus += this.getSaveBonusFrontal(actor);
        if (action.vsType) bonus += this.getSaveBonus(actor, action.vsType);
        if (bonus !== 0) out.bonus_save = (out.bonus_save || 0) + bonus;
      }

      if (action.type === 'moine' || action.type === 'monk') out.moine = this.getMonkSummary(actor);
      if (tags.includes('camouflage')) out.camouflage = true;
      return out;
    },

    getInfravision(actor) {
      let best = 0;
      for (const tag of this.getActiveTags(actor)) {
        if (!tag.startsWith('infravision:')) continue;
        const value = Number(tag.split(':')[1]) || 0;
        if (value > best) best = value;
      }
      return best;
    }
  });

  installRacialProfileFallbacks(Engine);
  installRacialImmunityAliases(Engine);
}
