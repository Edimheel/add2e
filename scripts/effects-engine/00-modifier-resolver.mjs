// ADD2E — Effects Engine / résolveur générique de modificateurs.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_MODIFIER_DOMAINS,
  ADD2E_MODIFIER_OPERATIONS,
  ADD2E_MODIFIER_STACKING,
  ADD2E_ABILITIES,
  ADD2E_HIT_POINT_TARGETS,
  ADD2E_HIT_POINT_CALCULATIONS,
  ADD2E_HIT_POINTS_VERSION,
  register,
  clone,
  isObject,
  canonicalKey,
  abilityKey,
  hitPointTargetKey,
  hitPointCalculationKey,
  sourceStableKey,
  modifierSignature,
  rawList,
  effectArray,
  itemArray
} from "./00-core-shared.mjs";

export function installModifierResolver(Engine) {
  register(Engine, {
    normalizeTag(v) {
      return String(v ?? "").trim().toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/\s+/g, "_");
    },

    normalizeKey(v) {
      return canonicalKey(v);
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

    normalizeModifier(raw = {}, defaults = {}) {
      if (!isObject(raw)) return null;
      const domain = canonicalKey(raw.domain ?? defaults.domain);
      const target = domain === "hit-points"
        ? hitPointTargetKey(raw.target ?? defaults.target)
        : abilityKey(raw.target ?? defaults.target);
      const operation = canonicalKey(raw.operation ?? defaults.operation ?? "add");
      const priorityValue = Number(raw.priority ?? defaults.priority ?? 100);
      const priority = Number.isFinite(priorityValue) ? priorityValue : 100;
      const rawStacking = isObject(raw.stacking) ? raw.stacking : { mode: raw.stacking };
      const stackingMode = canonicalKey(rawStacking?.mode ?? defaults?.stacking?.mode ?? "stack") || "stack";
      const stacking = {
        mode: stackingMode,
        group: String(rawStacking?.group ?? defaults?.stacking?.group ?? "").trim() || null
      };
      const sourceRaw = {
        ...(isObject(defaults.source) ? defaults.source : {}),
        ...(isObject(raw.source) ? raw.source : {})
      };
      const source = {
        kind: canonicalKey(sourceRaw.kind ?? "effect") || "effect",
        id: String(sourceRaw.id ?? "").trim(),
        uuid: String(sourceRaw.uuid ?? "").trim(),
        name: String(sourceRaw.name ?? "").trim()
      };
      let value = raw.value;
      if (operation === "minmax") {
        const bounds = isObject(value) ? value : {};
        const minimum = bounds.min === undefined || bounds.min === null || bounds.min === "" ? null : Number(bounds.min);
        const maximum = bounds.max === undefined || bounds.max === null || bounds.max === "" ? null : Number(bounds.max);
        value = {
          min: Number.isFinite(minimum) ? minimum : null,
          max: Number.isFinite(maximum) ? maximum : null
        };
      } else {
        value = Number(value);
      }
      const metadata = clone(raw.metadata ?? defaults.metadata ?? {}) ?? {};
      if (domain === "hit-points") {
        metadata.calculation = hitPointCalculationKey(
          raw.calculation
          ?? metadata.calculation
          ?? defaults.calculation
          ?? defaults.metadata?.calculation
          ?? "fixed"
        ) || "fixed";
        if (metadata.levelSource === undefined && raw.levelSource !== undefined) metadata.levelSource = raw.levelSource;
        if (metadata.level === undefined && raw.level !== undefined) metadata.level = raw.level;
      }
      const id = String(raw.id ?? `${sourceStableKey(source) || "modifier"}:${domain}:${target}:${operation}:${priority}`).trim();
      return {
        id,
        domain,
        target,
        operation,
        value,
        priority,
        stacking,
        conditions: clone(raw.conditions ?? {}),
        source,
        duration: clone(raw.duration ?? null),
        metadata
      };
    },

    validateModifier(raw = {}, defaults = {}) {
      const modifier = this.normalizeModifier(raw, defaults);
      const errors = [];
      if (!modifier) errors.push("modifier-invalid");
      else {
        if (!ADD2E_MODIFIER_DOMAINS.has(modifier.domain)) errors.push(`domain:${modifier.domain || "missing"}`);
        if (!modifier.target) errors.push("target:missing");
        if (!ADD2E_MODIFIER_OPERATIONS.has(modifier.operation)) errors.push(`operation:${modifier.operation || "missing"}`);
        if (!ADD2E_MODIFIER_STACKING.has(modifier.stacking?.mode)) errors.push(`stacking:${modifier.stacking?.mode || "missing"}`);
        if (!sourceStableKey(modifier.source)) errors.push("source:missing");
        if (modifier.domain === "hit-points") {
          if (modifier.target !== "all" && !ADD2E_HIT_POINT_TARGETS.has(modifier.target)) {
            errors.push(`hit-points-target:${modifier.target || "missing"}`);
          }
          const calculation = hitPointCalculationKey(modifier.metadata?.calculation ?? "fixed");
          if (!ADD2E_HIT_POINT_CALCULATIONS.has(calculation)) errors.push(`hit-points-calculation:${calculation || "missing"}`);
          if (calculation === "per-level" && modifier.operation !== "add") errors.push("hit-points-per-level-operation:add-required");
        }
        if (modifier.operation === "minmax") {
          if (modifier.value?.min === null && modifier.value?.max === null) errors.push("value:bounds-missing");
        } else if (!Number.isFinite(Number(modifier.value))) errors.push("value:not-number");
      }
      return { valid: errors.length === 0, errors, modifier };
    },

    createModifier(raw = {}, defaults = {}) {
      const result = this.validateModifier(raw, defaults);
      if (!result.valid) throw new Error(`Modificateur ADD2E invalide : ${result.errors.join(", ")}`);
      return result.modifier;
    },

    collectDocumentModifiers(document, defaults = {}) {
      if (!document) return [];
      let raw = document.flags?.add2e?.modifiers;
      if ((raw === undefined || raw === null) && document.getFlag) {
        try { raw = document.getFlag("add2e", "modifiers"); } catch (_error) {}
      }
      return rawList(raw).map(entry => {
        const normalized = this.normalizeModifier(entry, defaults);
        const validation = this.validateModifier(normalized);
        return validation.valid ? validation.modifier : null;
      }).filter(Boolean);
    },

    collect(actor, context = {}) {
      if (!actor) return [];
      const collected = [];
      const modifierKey = modifier => `${modifier.id}|${sourceStableKey(modifier.source)}|${modifierSignature(modifier)}`;
      const pushDocument = (document, defaults, sourceContext = {}, skippedKeys = null) => {
        for (const modifier of this.collectDocumentModifiers(document, defaults)) {
          if (skippedKeys?.has(modifierKey(modifier))) continue;
          collected.push({
            ...modifier,
            _context: {
              sourceDocument: document,
              sourceItem: sourceContext.sourceItem ?? null,
              sourceEffect: sourceContext.sourceEffect ?? null
            }
          });
        }
      };

      pushDocument(actor, {
        source: { kind: "actor", id: actor.id, uuid: actor.uuid, name: actor.name }
      });

      const actorEffects = effectArray(actor).filter(Boolean);
      const materializedModifierKeys = new Set();
      for (const effect of actorEffects) {
        const flags = effect.flags?.add2e ?? {};
        const defaults = {
          source: {
            kind: canonicalKey(flags.sourceType ?? flags.sourceKind ?? "effect") || "effect",
            id: String(flags.sourceItemId ?? effect.id ?? ""),
            uuid: String(flags.sourceItemUuid ?? effect.uuid ?? ""),
            name: String(flags.classFeatureName ?? effect.name ?? "")
          }
        };
        for (const modifier of this.collectDocumentModifiers(effect, defaults)) {
          materializedModifierKeys.add(modifierKey(modifier));
        }
        if (effect.disabled === true || effect.isSuppressed === true) continue;
        pushDocument(effect, defaults, { sourceEffect: effect });
      }

      for (const item of itemArray(actor)) {
        if (!item) continue;
        pushDocument(item, {
          source: {
            kind: canonicalKey(item.flags?.add2e?.sourceType ?? item.type ?? "item") || "item",
            id: item.id,
            uuid: item.uuid,
            name: item.name
          }
        }, { sourceItem: item });

        for (const effect of Array.from(item.effects?.contents ?? item.effects ?? [])) {
          if (!effect || effect.disabled === true || effect.isSuppressed === true) continue;
          pushDocument(effect, {
            source: {
              kind: canonicalKey(effect.flags?.add2e?.sourceType ?? item.type ?? "item-effect") || "item-effect",
              id: String(item.id ?? effect.id ?? ""),
              uuid: String(item.uuid ?? effect.uuid ?? ""),
              name: String(effect.name ?? item.name ?? "")
            }
          }, { sourceItem: item, sourceEffect: effect }, materializedModifierKeys);
        }
      }

      const seen = new Set();
      return collected.filter(modifier => {
        const key = modifierKey(modifier);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    evaluateModifierConditions(modifier, context = {}) {
      const conditions = isObject(modifier?.conditions) ? modifier.conditions : {};
      const sourceContext = modifier?._context ?? {};
      const sourceItem = sourceContext.sourceItem ?? context.sourceItem ?? context.item ?? null;
      const sourceEffect = sourceContext.sourceEffect ?? null;
      const targetActor = context.targetActor ?? context.target?.actor ?? context.target ?? null;
      const includes = (actual, expected) => {
        const wanted = Array.isArray(expected) ? expected : [expected];
        const actualKey = canonicalKey(actual);
        return wanted.map(canonicalKey).includes(actualKey);
      };

      if (conditions.active !== undefined) {
        const active = sourceEffect ? sourceEffect.disabled !== true && sourceEffect.isSuppressed !== true : true;
        if (active !== Boolean(conditions.active)) return { applicable: false, reason: "condition-active" };
      }
      if (conditions.equipped !== undefined) {
        const equipped = sourceItem ? this.itemEquipped(sourceItem) : false;
        if (equipped !== Boolean(conditions.equipped)) return { applicable: false, reason: "condition-equipped" };
      }
      if (conditions.sourceType && !includes(modifier?.source?.kind, conditions.sourceType)) return { applicable: false, reason: "condition-source-type" };
      if (conditions.actorType && !includes(context.actor?.type, conditions.actorType)) return { applicable: false, reason: "condition-actor-type" };
      if (conditions.itemId && String(sourceItem?.id ?? context.item?.id ?? "") !== String(conditions.itemId)) return { applicable: false, reason: "condition-item-id" };
      if (conditions.itemIds && !rawList(conditions.itemIds).map(String).includes(String(sourceItem?.id ?? context.item?.id ?? ""))) return { applicable: false, reason: "condition-item-ids" };

      const weaponType = context.weaponType ?? context.item?.system?.famille_arme ?? context.item?.system?.type_arme ?? context.item?.system?.type;
      if (conditions.weaponType && !includes(weaponType, conditions.weaponType)) return { applicable: false, reason: "condition-weapon-type" };
      if (conditions.weaponTypes && !includes(weaponType, conditions.weaponTypes)) return { applicable: false, reason: "condition-weapon-types" };
      if (conditions.targetType && !includes(targetActor?.type ?? context.targetType, conditions.targetType)) return { applicable: false, reason: "condition-target-type" };
      const targetRace = context.targetRace ?? targetActor?.system?.race ?? targetActor?.system?.details_race?.slug ?? targetActor?.system?.details_race?.name;
      if (conditions.targetRace && !includes(targetRace, conditions.targetRace)) return { applicable: false, reason: "condition-target-race" };
      if (conditions.targetRaces && !includes(targetRace, conditions.targetRaces)) return { applicable: false, reason: "condition-target-races" };
      if (conditions.position && !includes(context.position, conditions.position)) return { applicable: false, reason: "condition-position" };

      if (conditions.range !== undefined && conditions.range !== null) {
        if (isObject(conditions.range)) {
          const distance = Number(context.distance ?? context.range);
          if (!Number.isFinite(distance)) return { applicable: false, reason: "condition-range-missing" };
          const minimum = Number(conditions.range.min);
          const maximum = Number(conditions.range.max);
          if (Number.isFinite(minimum) && distance < minimum) return { applicable: false, reason: "condition-range-min" };
          if (Number.isFinite(maximum) && distance > maximum) return { applicable: false, reason: "condition-range-max" };
        } else if (!includes(context.rangeBand ?? context.range, conditions.range)) {
          return { applicable: false, reason: "condition-range" };
        }
      }
      return { applicable: true, reason: "applicable" };
    },

    applyStacking(modifiers = []) {
      const accepted = [];
      const rejected = [];
      const grouped = new Map();

      for (const modifier of modifiers) {
        const mode = modifier.stacking?.mode ?? "stack";
        if (mode === "stack") {
          accepted.push(modifier);
          continue;
        }
        const group = modifier.stacking?.group || `${modifier.domain}:${modifier.target}`;
        const sourcePart = mode === "unique-source" ? `:${sourceStableKey(modifier.source)}` : "";
        const key = `${mode}:${group}${sourcePart}`;
        const list = grouped.get(key) ?? [];
        list.push(modifier);
        grouped.set(key, list);
      }

      const stableSort = (left, right) => {
        const priority = Number(right.priority) - Number(left.priority);
        if (priority) return priority;
        return sourceStableKey(left.source).localeCompare(sourceStableKey(right.source));
      };

      for (const [key, list] of grouped.entries()) {
        const mode = key.split(":")[0];
        let winner = null;
        if (mode === "highest") {
          winner = [...list].sort((left, right) => Number(right.value) - Number(left.value) || stableSort(left, right))[0];
        } else if (mode === "lowest") {
          winner = [...list].sort((left, right) => Number(left.value) - Number(right.value) || stableSort(left, right))[0];
        } else {
          winner = [...list].sort(stableSort)[0];
        }
        accepted.push(winner);
        for (const modifier of list) {
          if (modifier !== winner) rejected.push({ modifier, reason: `stacking-${mode}` });
        }
      }
      return { accepted, rejected };
    },

    resolve(actor, query = {}) {
      const domain = canonicalKey(query.domain);
      const target = domain === "hit-points" ? hitPointTargetKey(query.target) : abilityKey(query.target);
      if (!ADD2E_MODIFIER_DOMAINS.has(domain)) throw new Error(`Domaine de modificateur inconnu : ${domain || "vide"}`);
      if (!target) throw new Error("Cible de modificateur manquante.");

      const baseValue = Number(query.base ?? 0);
      const base = Number.isFinite(baseValue) ? baseValue : 0;
      const context = { ...(query.context ?? {}), actor, item: query.item ?? query.context?.item, targetActor: query.targetActor ?? query.context?.targetActor };
      const all = Array.isArray(query.modifiers) ? query.modifiers : this.collect(actor, context);
      const applicable = [];
      const rejected = [];

      for (const raw of all) {
        const modifier = this.normalizeModifier(raw, { source: raw?.source });
        const validation = this.validateModifier(modifier);
        if (!validation.valid) {
          rejected.push({ modifier: raw, reason: `invalid:${validation.errors.join("|")}` });
          continue;
        }
        if (modifier.domain !== domain || ![target, "all"].includes(modifier.target)) continue;
        modifier._context = raw?._context ?? {};
        const condition = this.evaluateModifierConditions(modifier, context);
        if (!condition.applicable) {
          rejected.push({ modifier, reason: condition.reason });
          continue;
        }
        applicable.push(modifier);
      }

      const stacking = this.applyStacking(applicable);
      rejected.push(...stacking.rejected);
      const ordered = [...stacking.accepted].sort((left, right) => {
        const priority = Number(left.priority) - Number(right.priority);
        if (priority) return priority;
        return sourceStableKey(left.source).localeCompare(sourceStableKey(right.source));
      });

      let afterOverride = base;
      let override = null;
      const additions = [];
      const multipliers = [];
      const bounds = [];

      for (const modifier of ordered) {
        if (modifier.operation === "set") {
          afterOverride = Number(modifier.value);
          override = { modifier, value: afterOverride };
        } else if (modifier.operation === "add") additions.push(modifier);
        else if (modifier.operation === "multiply") multipliers.push(modifier);
        else if (modifier.operation === "minmax") bounds.push(modifier);
      }

      const additionsTotal = additions.reduce((total, modifier) => total + Number(modifier.value), 0);
      const afterAdditions = afterOverride + additionsTotal;
      const multiplierTotal = multipliers.reduce((total, modifier) => total * Number(modifier.value), 1);
      const afterMultipliers = afterAdditions * multiplierTotal;
      let afterBounds = afterMultipliers;
      for (const modifier of bounds) {
        const minimum = modifier.value?.min;
        const maximum = modifier.value?.max;
        if (Number.isFinite(minimum)) afterBounds = Math.max(afterBounds, minimum);
        if (Number.isFinite(maximum)) afterBounds = Math.min(afterBounds, maximum);
      }

      const rounding = canonicalKey(query.rounding ?? "none");
      const total = rounding === "floor" ? Math.floor(afterBounds)
        : rounding === "ceil" ? Math.ceil(afterBounds)
          : rounding === "round" ? Math.round(afterBounds)
            : afterBounds;

      const applied = ordered.map(modifier => ({
        modifier,
        contribution: modifier.operation === "add"
          ? Number(modifier.value)
          : modifier.operation === "multiply"
            ? Number(modifier.value)
            : modifier.operation === "set"
              ? Number(modifier.value)
              : clone(modifier.value),
        reason: "applicable"
      }));

      return {
        domain,
        target,
        base,
        additionsTotal,
        multiplierTotal,
        override,
        total,
        applied,
        rejected,
        stages: { afterOverride, afterAdditions, afterMultipliers, afterBounds }
      };
    },

    explain(actor, query = {}) {
      return this.resolve(actor, { ...query, explain: true });
    },

    getAbilityBase(actor, ability) {
      const target = abilityKey(ability);
      if (!ADD2E_ABILITIES.has(target)) throw new Error(`Caractéristique inconnue : ${target || ability}`);
      const value = Number(actor?.system?.[`${target}_base`] ?? actor?.system?.[target] ?? 10);
      return Number.isFinite(value) ? value : 10;
    },

    resolveAbility(actor, ability, context = {}) {
      const target = abilityKey(ability);
      return this.resolve(actor, {
        domain: "ability",
        target,
        base: this.getAbilityBase(actor, target),
        context
      });
    },

    getHitPointModifierLevel(actor, modifier, context = {}) {
      const metadata = modifier?.metadata ?? {};
      const directLevel = Number(metadata.level);
      if (Number.isFinite(directLevel) && directLevel >= 0) return Math.floor(directLevel);

      const sourceItem = modifier?._context?.sourceItem ?? context.sourceItem ?? null;
      const levelSource = canonicalKey(metadata.levelSource ?? "actor");
      const levelBySource = isObject(context.levelBySource) ? context.levelBySource : {};
      for (const key of [modifier?.source?.uuid, modifier?.source?.id, sourceItem?.uuid, sourceItem?.id].filter(Boolean)) {
        const mapped = Number(levelBySource[key]);
        if (Number.isFinite(mapped) && mapped >= 0) return Math.floor(mapped);
      }

      const classItemId = String(metadata.classItemId ?? "").trim();
      const classItem = classItemId
        ? Array.from(actor?.items ?? []).find(item => String(item?.id ?? "") === classItemId || String(item?.uuid ?? "") === classItemId)
        : null;
      const item = classItem ?? sourceItem;
      if (["source", "source-item", "source-class", "class", "class-item"].includes(levelSource)) {
        const itemLevel = Number(item?.system?.niveau ?? item?.system?.level);
        if (Number.isFinite(itemLevel) && itemLevel >= 0) return Math.floor(itemLevel);
        const contextClassLevel = Number(context.classLevel);
        if (Number.isFinite(contextClassLevel) && contextClassLevel >= 0) return Math.floor(contextClassLevel);
      }

      const contextLevel = Number(context.level);
      if (Number.isFinite(contextLevel) && contextLevel >= 0) return Math.floor(contextLevel);
      return Math.max(0, Math.floor(this.getActorLevel(actor)));
    },

    prepareHitPointModifiers(actor, target, context = {}, provided = null) {
      const canonicalTarget = hitPointTargetKey(target);
      const source = Array.isArray(provided) ? provided : this.collect(actor, context);
      return source.flatMap(raw => {
        const modifier = this.normalizeModifier(raw, { source: raw?.source });
        if (!modifier || modifier.domain !== "hit-points" || ![canonicalTarget, "all"].includes(modifier.target)) return [];
        modifier._context = raw?._context ?? {};
        const calculation = hitPointCalculationKey(modifier.metadata?.calculation ?? "fixed") || "fixed";
        if (calculation !== "per-level") return [{ ...modifier, _context: modifier._context }];
        const level = this.getHitPointModifierLevel(actor, modifier, context);
        return [{
          ...modifier,
          value: Number(modifier.value) * level,
          metadata: {
            ...clone(modifier.metadata ?? {}),
            calculation,
            baseValue: Number(modifier.value),
            resolvedLevel: level
          },
          _context: modifier._context
        }];
      });
    },

    preserveHitPointWounds(previousMaximum, previousCurrent, nextMaximum) {
      const oldMaximum = Number(previousMaximum);
      const oldCurrent = Number(previousCurrent);
      const maximum = Math.max(1, Math.floor(Number(nextMaximum) || 1));
      const hasHistory = Number.isFinite(oldMaximum) && oldMaximum > 0 && Number.isFinite(oldCurrent);
      const wounds = hasHistory ? Math.max(0, oldMaximum - oldCurrent) : 0;
      const current = hasHistory ? Math.min(maximum, maximum - wounds) : maximum;
      return { previousMaximum: oldMaximum, previousCurrent: oldCurrent, maximum, wounds, current, initialized: !hasHistory };
    },

    resolveHitPoints(actor, options = {}) {
      if (!actor?.system) throw new Error("Acteur invalide pour la résolution canonique des points de vie.");
      const previousMaximum = Number(options.previousMaximum ?? actor.system.points_de_coup);
      const previousCurrent = Number(options.previousCurrent ?? actor.system.pdv);
      const requestedBase = Number(options.baseMaximum);
      const baseMaximum = Math.max(1, Math.floor(Number.isFinite(requestedBase)
        ? requestedBase
        : (Number.isFinite(previousMaximum) && previousMaximum > 0 ? previousMaximum : 1)));
      const context = {
        ...(options.context ?? {}),
        actor,
        level: options.level ?? options.context?.level ?? this.getActorLevel(actor),
        source: options.source ?? options.context?.source ?? "hit-points-resolution",
        consumer: options.consumer ?? options.context?.consumer ?? "effects-engine"
      };
      const provided = Array.isArray(options.modifiers) ? options.modifiers : null;
      const maximumModifiers = this.prepareHitPointModifiers(actor, "maximum", context, provided);
      const maximumResolution = this.resolve(actor, {
        domain: "hit-points",
        target: "maximum",
        base: baseMaximum,
        context,
        modifiers: maximumModifiers,
        rounding: options.rounding ?? "floor"
      });
      const maximum = Math.max(1, Math.floor(Number(maximumResolution.total) || 1));
      const preserved = this.preserveHitPointWounds(previousMaximum, previousCurrent, maximum);
      const requestedCurrentBase = Number(options.currentBase);
      const currentBase = Number.isFinite(requestedCurrentBase) ? requestedCurrentBase : preserved.current;
      const currentModifiers = this.prepareHitPointModifiers(actor, "current", context, provided);
      const currentResolution = this.resolve(actor, {
        domain: "hit-points",
        target: "current",
        base: currentBase,
        context,
        modifiers: currentModifiers,
        rounding: options.rounding ?? "floor"
      });
      const current = Math.min(maximum, Math.floor(Number(currentResolution.total) || 0));
      return {
        version: ADD2E_HIT_POINTS_VERSION,
        actor,
        baseMaximum,
        previousMaximum,
        previousCurrent,
        wounds: preserved.wounds,
        initialized: preserved.initialized,
        maximum: { ...maximumResolution, total: maximum, unclampedTotal: maximumResolution.total },
        current: { ...currentResolution, base: currentBase, total: current, unclampedTotal: currentResolution.total },
        context
      };
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
      const effects = item?.effects?.contents ?? item.effects ?? [];
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
      if (typeof this.armorIsShield !== "function") {
        throw new Error("Le profil canonique des boucliers ADD2E n’est pas installé.");
      }
      return this.armorIsShield(item) === true;
    },

    isHelmetItem(item) {
      const system = item?.system ?? {};
      const values = new Set([
        system.type_armure,
        system.categorie,
        system.structure,
        ...this.toArray(system.tags)
      ].map(value => this.normalizeTag(value)).filter(Boolean));
      return values.has("casque")
        || values.has("heaume")
        || values.has("armure:casque")
        || values.has("armure:heaume")
        || values.has("type_armure:casque")
        || values.has("type_armure:heaume")
        || values.has("structure:casque")
        || values.has("structure:heaume");
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
    }
  });
}
