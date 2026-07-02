// ADD2E — Profils raciaux canoniques pour Effects Engine.
// Données AD&D 2e consommées uniquement par des API génériques.

const RAW_PROFILES = {
  demi_elfe: {
    id: 'demi_elfe',
    vision: { type: 'infravision', range: 18 },
    resistances: [{ types: ['charme', 'sommeil'], percent: 30 }],
    capabilities: [
      { id: 'porte_derobee_passage', label: 'Détecter une porte dérobée au passage', description: 'À 3 m ou moins : 1 chance sur 6.', formula: '1d6', successAt: 1, requires: ['within_three_meters'] },
      { id: 'porte_derobee_recherche', label: 'Rechercher une porte dérobée', description: 'Recherche active à 3 m ou moins : 3 chances sur 6.', formula: '1d6', successAt: 3, requires: ['search_active', 'within_three_meters'] },
      { id: 'porte_secrete_recherche', label: 'Rechercher une porte secrète', description: 'Recherche active à 3 m ou moins : 2 chances sur 6.', formula: '1d6', successAt: 2, requires: ['search_active', 'within_three_meters'] }
    ]
  },
  demi_orque: {
    id: 'demi_orque',
    vision: { type: 'infravision', range: 18 },
    abilityBounds: { max: { constitution: 19 } }
  },
  elfe: {
    id: 'elfe',
    vision: { type: 'infravision', range: 18 },
    abilityBounds: { max: { dexterite: 19 } },
    resistances: [{ types: ['charme', 'sommeil'], percent: 90 }],
    attackModifiers: [
      { mode: 'bonus_touche', weapons: ['arc', 'epee_courte', 'epee_longue'], value: 1 }
    ],
    capabilities: [
      { id: 'porte_derobee_passage', label: 'Détecter une porte dérobée au passage', description: 'À 3 m ou moins : 1 chance sur 6.', formula: '1d6', successAt: 1, requires: ['within_three_meters'] },
      { id: 'porte_derobee_recherche', label: 'Rechercher une porte dérobée', description: 'Recherche active à 3 m ou moins : 3 chances sur 6.', formula: '1d6', successAt: 3, requires: ['search_active', 'within_three_meters'] },
      { id: 'porte_secrete_recherche', label: 'Rechercher une porte secrète', description: 'Recherche active à 3 m ou moins : 2 chances sur 6.', formula: '1d6', successAt: 2, requires: ['search_active', 'within_three_meters'] },
      { id: 'surprise_silencieuse', label: 'Surprise silencieuse', description: 'Seul ou éloigné du groupe, sans armure de métal : 4 chances sur 6.', formula: '1d6', successAt: 4, requires: ['alone', 'no_metal_armor'] },
      { id: 'surprise_porte', label: 'Surprise après ouverture de porte', description: 'Même condition, mais 2 chances sur 6 lorsqu’une porte est ouverte.', formula: '1d6', successAt: 2, requires: ['alone', 'no_metal_armor', 'opens_door'] }
    ]
  },
  gnome: {
    id: 'gnome',
    vision: { type: 'infravision', range: 18 },
    disabledTags: ['bonus_save_vs:poison:const'],
    saveBonuses: [{ mode: 'constitution', categories: ['baguettes', 'sorts'] }],
    attackModifiers: [
      { mode: 'bonus_touche_vs', targets: ['kobold', 'gobelin'], value: 1 },
      { mode: 'bonus_ca_vs', targets: ['gnoll', 'goblour', 'ogre', 'troll', 'ogre_mage', 'geant', 'titan'], value: 4 }
    ],
    capabilities: [
      { id: 'pente_souterraine', label: 'Détecter une pente', description: 'Recherche active en souterrain : 80 %.', formula: '1d10', successAt: 8, requires: ['search_active', 'underground', 'within_three_meters', 'concentration'] },
      { id: 'ouvrages_peu_solides', label: 'Détecter des ouvrages peu solides', description: 'Murs, plafonds ou planchers : 70 %.', formula: '1d10', successAt: 7, requires: ['search_active', 'underground', 'within_three_meters', 'concentration'] },
      { id: 'profondeur_souterraine', label: 'Déterminer la profondeur', description: 'En souterrain : 60 % ; sans limite de distance.', formula: '1d10', successAt: 6, requires: ['search_active', 'underground', 'concentration'] },
      { id: 'direction_souterraine', label: 'Déterminer la direction suivie', description: 'En souterrain : 50 %.', formula: '1d2', successAt: 1, requires: ['search_active', 'underground', 'concentration'] }
    ]
  },
  humain: { id: 'humain' },
  kender: {
    id: 'kender',
    disabledTags: ['resistance:poison:1'],
    immunities: ['peur'],
    saveBonuses: [{ categories: ['peur'], value: 4 }],
    resistances: [{ types: ['poison'], percent: 'manual' }],
    thiefAdjustments: {
      pick_pockets: 5,
      open_locks: 5,
      find_remove_traps: 5,
      move_silently: 10,
      hide_in_shadows: 10,
      detect_noise: 5,
      climb_walls: 5,
      read_languages: -5
    }
  },
  nain: {
    id: 'nain',
    vision: { type: 'infravision', range: 18 },
    abilityBounds: { max: { constitution: 19 } },
    disabledTags: ['bonus_touche_vs:goblinoide:1'],
    saveBonuses: [{ mode: 'constitution', categories: ['poison', 'baguettes', 'sorts'] }],
    attackModifiers: [
      { mode: 'bonus_touche_vs', targets: ['demi_orque', 'gobelin', 'hobgobelin', 'orque'], value: 1 },
      { mode: 'bonus_ca_vs', targets: ['ogre', 'troll', 'ogre_mage', 'geant', 'titan'], value: 4 }
    ],
    capabilities: [
      { id: 'pente_souterraine', label: 'Détecter une pente', description: 'Recherche active en souterrain : 75 %.', formula: '1d4', successAt: 3, requires: ['search_active', 'underground', 'within_three_meters', 'concentration'] },
      { id: 'construction_recente', label: 'Détecter un ouvrage récent', description: 'Construction, passage ou tunnel récemment bâti : 75 %.', formula: '1d4', successAt: 3, requires: ['search_active', 'underground', 'within_three_meters', 'concentration'] },
      { id: 'murs_pivotants', label: 'Détecter un mur coulissant ou pivotant', description: 'Murs ou pièces coulissants/pivotants : 66 %.', formula: '1d6', successAt: 4, requires: ['search_active', 'underground', 'within_three_meters', 'concentration'] },
      { id: 'pieges_pierre', label: 'Détecter certains pièges de pierre', description: 'Puits, chutes de rochers et ouvrages en pierre : 50 %.', formula: '1d2', successAt: 1, requires: ['search_active', 'underground', 'within_three_meters', 'concentration'] },
      { id: 'profondeur_souterraine', label: 'Déterminer la profondeur', description: 'En souterrain : 50 % ; sans limite de distance.', formula: '1d2', successAt: 1, requires: ['search_active', 'underground', 'concentration'] }
    ]
  },
  petite_gens: {
    id: 'petite_gens',
    vision: { type: 'infravision', range: 9, note: 'Sous-race non renseignée : valeur par défaut pieds-poilus.' },
    saveBonuses: [{ mode: 'constitution', categories: ['poison', 'baguettes', 'sorts'] }],
    capabilities: [
      { id: 'pente_souterraine', label: 'Détecter une pente', description: 'En souterrain : 75 %.', formula: '1d4', successAt: 3, requires: ['search_active', 'underground', 'concentration'] },
      { id: 'direction_souterraine', label: 'Déterminer la direction suivie', description: 'En souterrain : 50 %.', formula: '1d2', successAt: 1, requires: ['search_active', 'underground', 'concentration'] },
      { id: 'surprise_silencieuse', label: 'Surprise silencieuse', description: 'Seul ou éloigné du groupe, sans armure de métal : 4 chances sur 6.', formula: '1d6', successAt: 4, requires: ['alone', 'no_metal_armor'] },
      { id: 'surprise_porte', label: 'Surprise après ouverture de porte', description: 'Même condition, mais 2 chances sur 6 lorsqu’une porte est ouverte.', formula: '1d6', successAt: 2, requires: ['alone', 'no_metal_armor', 'opens_door'] }
    ]
  }
};

function key(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[\s-]+/g, '_');
}

function list(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function clone(value) {
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
}

function profileFor(engine, actor, source) {
  const candidates = [
    source?.name,
    source?.system?.slug,
    source?.system?.label,
    actor?.system?.race,
    actor?.system?.details_race?.slug,
    actor?.system?.details_race?.name,
    actor?.system?.details_race?.label
  ].map(key).filter(Boolean);
  for (const candidate of candidates) {
    const profile = RAW_PROFILES[candidate];
    if (!profile) continue;
    return {
      ...clone(profile),
      sourceId: source?.id ?? source?.uuid ?? `fallback:${candidate}`,
      sourceName: source?.name ?? source?.system?.label ?? candidate,
      sourceSystem: source?.system ?? {}
    };
  }
  return null;
}

function saveTag(category) {
  const normalized = key(category);
  if (normalized === 'baguettes') return 'baguette';
  if (normalized === 'sorts') return 'sort';
  return normalized;
}

function addProfileTags(engine, out, profile) {
  engine.addTagsInto(out, profile.tags);
  engine.addTagsInto(out, profile.effectTags);
  engine.addTagsInto(out, profile.passiveTags);

  const vision = profile.vision ?? {};
  const range = engine.readNumber(vision.range, vision.distance);
  if (key(vision.type ?? vision.mode) === 'infravision' && Number.isFinite(range) && range > 0) out.push(`infravision:${range}`);

  for (const rule of list(profile.saveBonuses)) {
    if (!rule || typeof rule !== 'object') continue;
    if (key(rule.mode ?? rule.bonus) === 'constitution') {
      for (const category of list(rule.categories ?? rule.category)) {
        const categoryKey = saveTag(category);
        if (categoryKey) out.push(`bonus_save_vs:${categoryKey}:const`);
      }
      continue;
    }
    const value = engine.readNumber(rule.value, rule.bonus, rule.amount);
    if (!Number.isFinite(value) || !value) continue;
    for (const category of list(rule.categories ?? rule.category)) {
      const categoryKey = saveTag(category);
      if (categoryKey) out.push(`bonus_save_vs:${categoryKey}:${value}`);
    }
  }

  for (const rule of list(profile.resistances)) {
    if (!rule || typeof rule !== 'object') continue;
    const value = String(rule.percent ?? rule.pct ?? rule.value ?? '').trim();
    if (!value) continue;
    for (const type of list(rule.types ?? rule.type)) {
      const typeKey = key(type);
      if (typeKey) out.push(`resistance:${typeKey}:${value}`);
    }
  }

  for (const type of list(profile.immunities)) {
    const typeKey = key(type);
    if (typeKey) out.push(`immunite:${typeKey}`);
  }

  for (const rule of list(profile.attackModifiers)) {
    if (!rule || typeof rule !== 'object') continue;
    const mode = key(rule.mode ?? rule.kind);
    const value = engine.readNumber(rule.value, rule.bonus, rule.amount);
    if (!mode || !Number.isFinite(value) || !value) continue;
    if (mode === 'bonus_touche') {
      for (const weapon of list(rule.weapons ?? rule.weapon ?? rule.targets ?? rule.target)) {
        const weaponKey = key(weapon);
        if (weaponKey) out.push(`bonus_touche:${weaponKey}:${value}`);
      }
      continue;
    }
    if (!['bonus_touche_vs', 'bonus_ca_vs', 'malus_attaque_vs', 'malus_toucher_vs'].includes(mode)) continue;
    for (const target of list(rule.targets ?? rule.target ?? rule.against)) {
      const targetKey = key(target);
      if (targetKey) out.push(`${mode}:${targetKey}:${value}`);
    }
  }
}

function installCanonicalSaveBridge(engine) {
  if (globalThis.ADD2E_RACIAL_SAVE_BRIDGE_INSTALLED || typeof document === 'undefined') return;
  globalThis.ADD2E_RACIAL_SAVE_BRIDGE_INSTALLED = true;
  const labels = [
    'Mort / Paralysie / Poison',
    'Pétrification / Métamorphose',
    'Baguettes, bâtons et bâtonnets',
    'Souffles',
    'Sorts'
  ];
  const categories = ['mort_paralysie_poison', 'petrification', 'baguettes', 'souffle', 'sorts'];
  const icons = ['fa-skull-crossbones', 'fa-mountain', 'fa-magic', 'fa-wind', 'fa-scroll'];

  globalThis.add2eRollSaveCardCanonical = async function add2eRollSaveCardCanonical(actor, index) {
    if (!actor) return ui.notifications?.warn?.('Aucun acteur pour ce jet.');
    const idx = Math.max(0, Math.min(4, Number(index) || 0));
    const saves = actor.system?.details_classe?.progression?.[Number(actor.system?.niveau || 1) - 1]?.savingThrows ?? actor.system?.sauvegardes ?? [];
    const threshold = Number(saves[idx]);
    if (!threshold) return ui.notifications?.warn?.('Aucune valeur pour ce jet.');
    const roll = await new Roll('1d20').evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const bonus = Number(engine.getSaveBonus?.(actor, categories[idx]) || 0);
    const total = Number(roll.total || 0) + bonus;
    const success = total >= threshold;
    const color = success ? '#2f8f46' : '#b33a2e';
    const effectLabel = bonus ? `<div>Bonus raciaux / effets : <b>${bonus >= 0 ? '+' : ''}${bonus}</b> → <b>${total}</b></div>` : '';
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class='add2e-card-test' style='border:1px solid ${color};border-radius:10px;padding:9px;'>
        <div style='font-weight:900;color:${color};'><i class='fas ${icons[idx]}'></i> ${labels[idx]}</div>
        <div>Seuil : <b>${threshold}</b> — dé : <b>${roll.total}</b></div>
        ${effectLabel}
        <div style='margin-top:4px;font-weight:900;color:${color};'>${success ? 'RÉUSSITE' : 'ÉCHEC'}</div>
      </div>`
    });
  };

  document.addEventListener('click', async event => {
    const button = event.target?.closest?.('.roll-save, #add2e-action-hud [data-action=roll-save]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const actor = canvas?.tokens?.controlled?.[0]?.actor
      ?? game.actors?.get?.(button.dataset?.actorId)
      ?? game.user?.character
      ?? null;
    const index = Number(button.dataset?.save ?? button.dataset?.saveIndex ?? 0);
    await globalThis.add2eRollSaveCardCanonical(actor, index);
  }, true);
}

export function installRacialProfileFallbacks(Engine) {
  const install = () => {
    if (!Engine || Engine.__add2eCanonicalRacialProfilesInstalled || typeof Engine.getRacialProfiles !== 'function') return;
    Engine.__add2eCanonicalRacialProfilesInstalled = true;
    const originalProfiles = Engine.getRacialProfiles.bind(Engine);

    Object.defineProperty(Engine, 'getRacialProfiles', {
      configurable: true,
      writable: true,
      value(actor) {
        const direct = originalProfiles(actor) ?? [];
        if (direct.length) return direct;
        const profiles = [];
        const seen = new Set();
        for (const source of this.getRacialSources?.(actor) ?? []) {
          const profile = profileFor(this, actor, source);
          if (!profile || seen.has(profile.id)) continue;
          seen.add(profile.id);
          profiles.push(profile);
        }
        if (!profiles.length) {
          const profile = profileFor(this, actor, null);
          if (profile) profiles.push(profile);
        }
        return profiles;
      }
    });

    Object.defineProperty(Engine, 'getRacialPassiveTags', {
      configurable: true,
      writable: true,
      value(actor) {
        const tags = [];
        for (const source of this.getRacialSources?.(actor) ?? []) {
          this.addTagsInto(tags, source.system?.tags);
          this.addTagsInto(tags, source.system?.effectTags);
          this.addTagsInto(tags, source.system?.effecttags);
        }
        for (const profile of this.getRacialProfiles(actor)) addProfileTags(this, tags, profile);
        return [...new Set(tags.map(tag => this.normalizeTag(tag)).filter(Boolean))];
      }
    });

    Object.defineProperty(Engine, 'getRacialCapabilities', {
      configurable: true,
      writable: true,
      value(actor) {
        const capabilities = [];
        const seen = new Set();
        for (const profile of this.getRacialProfiles(actor)) {
          for (const raw of list(profile.capabilities)) {
            if (!raw || typeof raw !== 'object') continue;
            const id = this.normalizeTag(raw.id ?? raw.key ?? raw.label ?? raw.name);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            capabilities.push({ ...clone(raw), id, key: id, sourceName: profile.sourceName, sourceId: profile.sourceId, activable: raw.activable !== false });
          }
        }
        return capabilities;
      }
    });

    installCanonicalSaveBridge(Engine);
  };

  queueMicrotask(install);
  Hooks?.once?.('ready', install);
}
