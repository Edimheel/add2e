// ADD2E — Effects Engine / progression et capacités du moine.
// Extraction fonctionnelle sans changement de règle.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineMonk(Engine) {
  register(Engine, {
    getActorClassSystem(actor) {
      return actor?.items?.find?.(item => String(item.type || "").toLowerCase() === "classe")?.system
        ?? actor?.system?.details_classe
        ?? null;
    },

    isMonk(actor) {
      const classSystem = this.getActorClassSystem(actor);
      const label = this.normalizeKey(
        classSystem?.label || classSystem?.name || classSystem?.nom || actor?.system?.classe || ""
      );
      return label.includes("moine") || this.hasTag(actor, "classe:moine");
    },

    getClassProgressionEntry(actor, field = "progression") {
      const classSystem = this.getActorClassSystem(actor);
      const level = this.getActorLevel(actor);
      const progression = classSystem?.[field] ?? classSystem?.progression ?? [];
      if (!Array.isArray(progression) || !progression.length) return null;
      return progression.find(entry => Number(entry?.niveau ?? entry?.level) === level)
        ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
        ?? null;
    },

    getMonkProgression(actor) {
      return this.isMonk(actor)
        ? this.getClassProgressionEntry(actor, "monkProgression") ?? this.getClassProgressionEntry(actor, "progression")
        : null;
    },

    getMonkArmorClass(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.monkAC ?? progression?.caMoine ?? progression?.ca_moine);
      return Number.isFinite(value) ? value : null;
    },

    getMonkMove(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.move ?? progression?.movement ?? progression?.mouvement);
      return Number.isFinite(value) ? value : null;
    },

    getMonkOpenDoors(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.openDoors ?? progression?.ouvrir_portes);
      return Number.isFinite(value) ? value : null;
    },

    getMonkUnarmedDamage(actor) {
      const progression = this.getMonkProgression(actor);
      return String(progression?.unarmedDamage ?? progression?.main_nue ?? progression?.damage ?? "").trim();
    },

    getMonkAttacksPerRound(actor) {
      const progression = this.getMonkProgression(actor);
      return String(progression?.attacksPerRound ?? progression?.attaquesParRound ?? "").trim();
    },

    getMonkStunParalyze(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.stunParalyze ?? progression?.etourdissement ?? progression?.paralysie);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkSlowFall(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.slowFall ?? progression?.chute_ralentie);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkSelfHealPerDay(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.selfHealPerDay ?? progression?.auto_soin);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkWeaponDamageBonus(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.monkWeaponDamageBonus ?? progression?.bonusDegatsArme ?? progression?.bonus_degats_arme);
      return Number.isFinite(value) ? value : (this.isMonk(actor) ? Math.floor(this.getActorLevel(actor) / 2) : 0);
    },

    hasMonkDiseaseImmunity(actor) {
      return this.hasImmunity(actor, "maladie");
    },

    getMonkProgressionTags(actor) {
      const progression = this.getMonkProgression(actor);
      return progression ? this.toArray(progression.tags).map(tag => this.normalizeTag(tag)).filter(Boolean) : [];
    },

    getMonkResistCharmSuggestion(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.resistCharmSuggestion ?? progression?.resistance_charme_suggestion);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkResistESP(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.resistESP ?? progression?.resistance_esp);
      return Number.isFinite(value) ? value : 0;
    },

    hasMonkQuiveringPalm(actor) {
      const progression = this.getMonkProgression(actor);
      return !!progression?.quiveringPalm
        || this.hasTag(actor, "moine:paume_palpitante")
        || this.hasTag(actor, "paume_palpitante");
    },

    getMonkSummary(actor) {
      const progression = this.getMonkProgression(actor);
      if (!progression) return null;
      return {
        level: this.getActorLevel(actor),
        title: progression.title ?? "",
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
      };
    }
  });
}
