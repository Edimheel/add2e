// scripts/add2e-attack/04i-attack-roll-chat-card.mjs
// ADD2E — Cartes de chat d'attaque construites par l'API commune.
// Chaque joueur actif crée sa carte simplifiée privée ; un seul MJ crée la carte détaillée.
// Compatible Foundry V13/V14/V15.

const VERSION = "2026-07-27-attack-chat-readable-details-v33";
const SOCKET = "system.add2e";
const ROUTE_TYPE = "ADD2E_ATTACK_CHAT_ROUTE_V33";
const LOG = "[ADD2E][ATTACK_CHAT]";

const ACTIVE_ITEM_TYPES = new Set([
  "arme", "armure", "objet", "weapon", "armor", "equipment", "object", "magic", "objet_magique"
]);

globalThis.ADD2E_ATTACK_CHAT_VISIBILITY_VERSION = VERSION;
globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS ??= new Set();

function escapeHtml(value) {
  const text = String(value ?? "");
  try {
    if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
  } catch (_error) {}
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function signed(value) {
  const numeric = Number(value) || 0;
  return `${numeric >= 0 ? "+" : "−"}${Math.abs(numeric)}`;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function outcome(ctx) {
  const snapshot = ctx?.snapshot ?? {};
  const d20 = number(snapshot?.roll?.d20 ?? ctx?.d20);
  const hit = snapshot?.result?.hit ?? (ctx?.finalResult === true);
  if (d20 === 20) return { key: "natural20", hit: true, title: "Coup exceptionnel !", icon: "fas fa-star", variant: "success" };
  if (d20 === 1) return { key: "natural1", hit: false, title: "Échec critique !", icon: "fas fa-times", variant: "failure" };
  return hit
    ? { key: "hit", hit: true, title: "Touché !", icon: "fas fa-check", variant: "success" }
    : { key: "miss", hit: false, title: "Raté.", icon: "fas fa-times", variant: "failure" };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)] ?? list[0] ?? "";
}

function roleplay(ctx) {
  const attacker = String(ctx?.actor?.name ?? "L’assaillant");
  const target = String(ctx?.nomCible ?? ctx?.cible?.name ?? "la cible");
  const weapon = String(ctx?.arme?.name ?? "son arme");
  const result = outcome(ctx);

  if (result.key === "natural20") return pick([
    `${attacker} trouve une ouverture parfaite : ${weapon} frappe avec une précision remarquable.`,
    `Le geste de ${attacker} est net. ${target} encaisse un coup d’exception.`,
    `La fortune sourit à ${attacker} : la défense de ${target} cède au moment exact.`
  ]);
  if (result.key === "natural1") return pick([
    `${attacker} se précipite et son attaque tourne court.`,
    `Le coup part mal : ${weapon} manque sa trajectoire.`,
    `Un faux mouvement ruine l’assaut de ${attacker}.`
  ]);
  if (result.hit) return pick([
    `${attacker} force la garde de ${target} et place son attaque.`,
    `${weapon} trouve son chemin malgré la défense de ${target}.`,
    `${attacker} ajuste son geste et touche ${target}.`
  ]);
  return pick([
    `${target} évite l’attaque de justesse.`,
    `${attacker} frappe, mais ${target} détourne le danger.`,
    `${weapon} fend l’air sans trouver sa cible.`
  ]);
}

function users() {
  return Array.isArray(game?.users?.contents) ? game.users.contents : Array.from(game?.users ?? []);
}

function gmUsers() {
  return users().filter(user => user?.isGM && user?.id);
}

function playerUsers() {
  return users().filter(user => !user?.isGM && user?.id);
}

function activeUsers(list) {
  return list.filter(user => user?.active === true && user?.id);
}

function userIds(list) {
  return list.map(user => String(user.id)).filter(Boolean);
}

function activeCreatorId(list) {
  return userIds(activeUsers(list)).sort((a, b) => a.localeCompare(b))[0] ?? null;
}

function requireCommonChatApi() {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Le constructeur commun des cartes ADD2E est indisponible.");
  }
}

function cloneForSocket(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.error(`${LOG}[SERIALIZE_FAILED]`, error);
    return null;
  }
}

function normalizeCombatTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_")
    .replace(/,([0-9]+)$/, ".$1");
}

function collectTags(target, raw) {
  if (raw === undefined || raw === null || raw === "") return;
  if (Array.isArray(raw) || raw instanceof Set) {
    for (const value of raw) collectTags(target, value);
    return;
  }
  if (typeof raw === "object") {
    for (const value of Object.values(raw)) collectTags(target, value);
    return;
  }
  if (typeof raw !== "string") return;
  for (const value of raw.split(/[,;|]/)) {
    const tag = normalizeCombatTag(value);
    if (tag) target.add(tag);
  }
}

function documentTags(document) {
  const tags = new Set();
  for (const value of [
    document?.system?.tags,
    document?.system?.tag,
    document?.system?.effectTags,
    document?.system?.effets,
    document?.system?.effects,
    document?.flags?.add2e?.tags,
    document?.flags?.add2e?.effectTags
  ]) collectTags(tags, value);
  if (document?.getFlag) {
    try { collectTags(tags, document.getFlag("add2e", "tags")); } catch (_error) {}
    try { collectTags(tags, document.getFlag("add2e", "effectTags")); } catch (_error) {}
  }
  return tags;
}

function combatTagDescriptor(rawTag) {
  const tag = normalizeCombatTag(rawTag);
  const definitions = [
    ["bonus_attaque:", "attack"],
    ["bonus_toucher:", "attack"],
    ["bonus:toucher:", "attack"],
    ["malus_attaque:", "attack"],
    ["malus_toucher:", "attack"],
    ["malus:toucher:", "attack"],
    ["bonus_degats:", "damage"],
    ["bonus:degats:", "damage"],
    ["malus_degats:", "damage"],
    ["malus:degats:", "damage"]
  ];
  for (const [prefix, domain] of definitions) {
    if (!tag.startsWith(prefix)) continue;
    const value = Number(tag.slice(prefix.length));
    return Number.isFinite(value) ? { domain, value } : null;
  }
  return null;
}

function itemTypeLabel(item) {
  const type = String(item?.type ?? "").toLowerCase();
  return {
    arme: "Arme",
    weapon: "Arme",
    armure: "Armure",
    armor: "Armure",
    objet: "Objet",
    object: "Objet",
    equipment: "Équipement",
    magic: "Objet magique",
    objet_magique: "Objet magique",
    race: "Race",
    classe: "Classe"
  }[type] ?? "Objet porté";
}

function actorItemById(actor, id) {
  const wanted = String(id ?? "").trim();
  if (!wanted) return null;
  return actor?.items?.get?.(wanted)
    ?? Array.from(actor?.items ?? []).find(item => String(item?.id ?? "") === wanted)
    ?? null;
}

function effectSourceItem(actor, effect) {
  const byFlag = actorItemById(actor, effect?.flags?.add2e?.sourceItemId);
  if (byFlag) return byFlag;
  const match = String(effect?.origin ?? "").match(/\.Item\.([^.]+)(?:\.|$)/);
  return actorItemById(actor, match?.[1]);
}

function activeTagCandidates(actor) {
  const candidates = [];
  const push = (name, kind, tags) => {
    if (!name || !tags?.size) return;
    candidates.push({ name: String(name), kind: String(kind), tags });
  };

  for (const effect of actor?.effects ?? []) {
    if (!effect || effect.disabled === true || effect.isSuppressed === true || effect.flags?.add2e?.autoClassPassiveEffect === true) continue;
    const item = effectSourceItem(actor, effect);
    if (item && ACTIVE_ITEM_TYPES.has(String(item.type ?? "").toLowerCase()) && item.system?.equipee !== true) continue;
    push(item?.name ?? effect.name ?? "Effet actif", item ? itemTypeLabel(item) : "Effet actif", documentTags(effect));
  }

  for (const item of actor?.items ?? []) {
    const type = String(item?.type ?? "").toLowerCase();
    const always = type === "race" || type === "classe";
    if (!always && !ACTIVE_ITEM_TYPES.has(type)) continue;
    if (ACTIVE_ITEM_TYPES.has(type) && item.system?.equipee !== true) continue;
    push(item.name ?? "Objet", itemTypeLabel(item), documentTags(item));
    for (const effect of Array.from(item.effects?.contents ?? item.effects ?? [])) {
      if (!effect || effect.disabled === true || effect.isSuppressed === true) continue;
      push(item.name ?? effect.name ?? "Objet", itemTypeLabel(item), documentTags(effect));
    }
  }

  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${candidate.kind}|${candidate.name}|${[...candidate.tags].sort().join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function activeTagOrigin(ctx, entry, domain) {
  const contribution = number(entry?.contribution);
  const matches = activeTagCandidates(ctx?.actor).filter(candidate => [...candidate.tags].some(tag => {
    const descriptor = combatTagDescriptor(tag);
    return descriptor?.domain === domain && descriptor.value === contribution;
  }));
  const names = [];
  const seen = new Set();
  for (const match of matches) {
    const key = `${match.kind}|${match.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(match);
  }
  return names.length === 1 ? names[0] : null;
}

function abilityLabel(value) {
  const key = normalizeCombatTag(value);
  return {
    force: "Force",
    dexterite: "Dextérité",
    constitution: "Constitution",
    intelligence: "Intelligence",
    sagesse: "Sagesse",
    charisme: "Charisme"
  }[key] ?? String(value ?? "Caractéristique");
}

function resolvedAbilityScore(actor, ability) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!actor || !ability || typeof engine?.resolveAbilityDerived !== "function") return null;
  try {
    const score = Number(engine.resolveAbilityDerived(actor, ability, {
      source: "attack-chat-card",
      consumer: "attack-chat"
    })?.total);
    return Number.isFinite(score) ? score : null;
  } catch (_error) {
    return null;
  }
}

function modifierPresentation(ctx, entry, domain) {
  const source = entry?.source ?? {};
  const metadata = entry?.metadata ?? {};
  const kind = normalizeCombatTag(source.kind).replace(/-/g, "_");
  const id = String(entry?.id ?? "");
  const rawLabel = String(entry?.label ?? metadata.label ?? source.name ?? entry?.id ?? "Modificateur");

  if (metadata.ability || kind === "ability") {
    const ability = metadata.ability ?? id.split(":").pop();
    const score = resolvedAbilityScore(ctx?.actor, ability);
    return { label: `${abilityLabel(ability)}${score === null ? "" : ` ${score}`}`, source: "Caractéristique" };
  }
  if (kind === "weapon" || metadata.producer === "weapon-base-field") {
    return {
      label: String(source.name || ctx?.arme?.name || "Arme"),
      source: domain === "damage" ? "Bonus aux dégâts de l’arme" : "Bonus au toucher de l’arme"
    };
  }
  if (kind === "weapon_effect") return { label: String(source.name || ctx?.arme?.name || "Arme"), source: "Effet magique de l’arme" };
  if (kind === "active_tags") {
    const origin = activeTagOrigin(ctx, entry, domain);
    return origin
      ? { label: origin.name, source: `${origin.kind} — effet actif` }
      : { label: rawLabel, source: "Effet actif de l’acteur" };
  }
  if (kind === "attack_action") {
    if (id.includes(":attack:position")) return { label: `Position — ${ctx?.snapshot?.position?.label ?? "Situation"}`, source: "Situation de combat" };
    if (id.includes(":attack:range")) return { label: `Portée — ${ctx?.snapshot?.range?.description ?? "Portée"}`, source: "Situation de combat" };
    if (id.includes(":attack:backstab")) return { label: "Attaque dans le dos", source: "Capacité utilisée" };
    if (id.includes(":attack:armor-adjustment")) return { label: "Ajustement arme contre armure", source: "Table arme/armure" };
    if (id.includes(":attack:manual")) return { label: "Ajustement saisi", source: "Situation de combat" };
    return { label: rawLabel, source: "Situation de combat" };
  }
  if (kind === "race") return { label: String(source.name || rawLabel), source: "Capacité raciale" };
  if (kind === "passive_rules") return { label: rawLabel, source: "Règle passive" };
  if (kind === "target_defense") return { label: String(source.name || rawLabel), source: "Défense de la cible" };
  if (["item", "item_effect", "objet", "objet_magique", "effect"].includes(kind)) {
    return { label: String(source.name || rawLabel), source: kind === "effect" ? "Effet actif" : "Objet ou effet embarqué" };
  }
  return { label: rawLabel, source: source.name && source.name !== rawLabel ? `Source : ${source.name}` : "Modificateur de combat" };
}

function infoCellHtml(label, value) {
  return `<div style="min-width:0;padding:7px 8px;border:1px solid rgba(185,139,45,.28);border-radius:6px;background:rgba(255,253,244,.72);"><div style="margin-bottom:2px;color:#76511a;font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.025em;">${escapeHtml(label)}</div><div style="color:#2f250c;font-size:.94rem;font-weight:850;line-height:1.25;overflow-wrap:anywhere;">${escapeHtml(value)}</div></div>`;
}

function contextGridHtml(cells = []) {
  return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:9px;">${cells.map(cell => infoCellHtml(cell.label, cell.value)).join("")}</div>`;
}

function modifierTableHtml(ctx, resolution, domain) {
  const applied = Array.isArray(resolution?.applied) ? resolution.applied : [];
  const rows = applied.map(entry => {
    const presentation = modifierPresentation(ctx, entry, domain);
    const contribution = number(entry?.contribution);
    return `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 2px;border-bottom:1px solid rgba(185,139,45,.22);"><div style="min-width:0;"><div style="color:#2f250c;font-size:.9rem;font-weight:850;line-height:1.25;overflow-wrap:anywhere;">${escapeHtml(presentation.label)}</div><div style="margin-top:1px;color:#76511a;font-size:.7rem;font-weight:700;line-height:1.2;overflow-wrap:anywhere;">${escapeHtml(presentation.source)}</div></div><div style="min-width:2.5rem;text-align:right;color:${contribution < 0 ? "#7b1f1f" : "#1f5f32"};font-size:1rem;font-weight:950;">${escapeHtml(signed(contribution))}</div></div>`;
  }).join("");
  const empty = `<div style="padding:7px 2px;color:#5f5138;font-size:.84rem;font-style:italic;">Aucun bonus ni malus.</div>`;
  return `<div style="margin-top:8px;"><div style="margin-bottom:3px;color:#6a4917;font-size:.72rem;font-weight:950;text-transform:uppercase;letter-spacing:.02em;">Bonus et malus appliqués</div>${rows || empty}<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 2px 2px;color:#2f250c;font-weight:950;"><span>Total des modificateurs</span><span>${escapeHtml(signed(resolution?.total))}</span></div></div>`;
}

function calculationBoxHtml(lines = [], result = null) {
  const body = lines.map(line => `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;"><span style="color:#76511a;font-size:.78rem;font-weight:800;">${escapeHtml(line.label)}</span><strong style="color:#2f250c;text-align:right;font-size:.9rem;">${escapeHtml(line.value)}</strong></div>`).join("");
  const outcomeHtml = result
    ? `<div style="margin-top:7px;padding:7px 8px;border-radius:6px;background:rgba(185,139,45,.16);color:#2f250c;text-align:center;font-size:1rem;font-weight:950;">${escapeHtml(result)}</div>`
    : "";
  return `<div style="margin-top:9px;padding:8px 9px;border:1px solid rgba(185,139,45,.34);border-radius:7px;background:rgba(255,250,235,.62);">${body}${outcomeHtml}</div>`;
}

function detailSectionHtml({ label, icon, body }) {
  if (!String(body ?? "").trim()) return "";
  return `<details open class="add2e-attack-detail-section" style="display:block!important;width:100%!important;box-sizing:border-box!important;margin-top:8px!important;border:1px solid var(--add2e-card-border,#b98b2d)!important;border-radius:8px!important;overflow:hidden!important;background:rgba(255,255,255,.35)!important;color:#2f250c!important;"><summary style="display:list-item!important;cursor:pointer!important;padding:8px 9px!important;color:#3a270c!important;font-weight:950!important;line-height:1.25!important;background:rgba(185,139,45,.18)!important;"><i class="${escapeHtml(icon)}"></i> ${escapeHtml(label)}</summary><div style="display:block!important;width:100%!important;box-sizing:border-box!important;padding:9px!important;color:#2f250c!important;background:rgba(255,250,235,.52)!important;">${body}</div></details>`;
}

function baseDamageFormula(snapshot) {
  const formula = String(snapshot?.damage?.formula ?? "").replace(/\s+/g, "");
  const bonus = number(snapshot?.damage?.bonus);
  if (!formula || bonus === 0) return formula || "—";
  const suffix = bonus > 0 ? `+${bonus}` : `${bonus}`;
  return formula.endsWith(suffix) ? formula.slice(0, -suffix.length) || formula : formula;
}

function rawDamageRollDetails(snapshot, multiplier = 1) {
  let details = String(snapshot?.damage?.details ?? "").trim();
  if (!details) return "—";
  if (multiplier > 1) details = details.replace(new RegExp(`\\s*[×x*]\\s*${multiplier}\\s*$`), "").trim();
  const bonus = number(snapshot?.damage?.bonus);
  if (bonus !== 0) {
    const sign = bonus > 0 ? "\\+" : "[-−]";
    details = details.replace(new RegExp(`\\s*${sign}\\s*${Math.abs(bonus)}\\s*$`), "").trim();
  }
  return details || "—";
}

function touchDetailsHtml(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const threshold = snapshot?.threshold ?? {};
  const range = snapshot?.range ?? {};
  const thac0 = number(threshold.thac0);
  const armorClass = number(threshold.armorClass);
  const baseThreshold = number(threshold.base);
  const attackBonus = number(snapshot?.roll?.bonus);
  const finalThreshold = number(threshold.final);
  const d20 = number(snapshot?.roll?.d20);
  const rollTotal = number(snapshot?.roll?.total, d20 + attackBonus);
  const rangeLabel = String(range.description ?? range.band ?? "Contact");
  const rangeModifier = number(range.modifier);
  const conditional = Array.isArray(snapshot?.conditionalDetails) ? snapshot.conditionalDetails.filter(Boolean) : [];

  const context = contextGridHtml([
    { label: "Cible", value: String(ctx?.nomCible ?? ctx?.cible?.name ?? "Cible") },
    { label: "CA de la cible", value: String(armorClass) },
    { label: "Position", value: String(snapshot?.position?.label ?? "Face") },
    { label: "Portée", value: `${rangeLabel}${rangeModifier === 0 ? "" : ` (${signed(rangeModifier)})`}` }
  ]);
  const modifiers = modifierTableHtml(ctx, snapshot.attackResolution, "attack");
  const calculations = calculationBoxHtml([
    { label: "Seuil de base", value: `THAC0 ${thac0} − CA ${armorClass} = ${baseThreshold}` },
    { label: "Seuil après modificateurs", value: `${baseThreshold} ${attackBonus >= 0 ? "−" : "+"} ${Math.abs(attackBonus)} = ${finalThreshold}` },
    { label: "Jet obtenu", value: `${d20} ${attackBonus >= 0 ? "+" : "−"} ${Math.abs(attackBonus)} = ${rollTotal}` }
  ], result.title);
  const conditionalHtml = conditional.length
    ? `<div style="margin-top:8px;padding:7px 8px;border-left:3px solid #b98b2d;background:rgba(185,139,45,.1);color:#4b3a1c;font-size:.78rem;line-height:1.35;"><strong>Défenses particulières :</strong> ${escapeHtml(conditional.join(" ; "))}</div>`
    : "";
  return `${context}${modifiers}${calculations}${conditionalHtml}`;
}

function damageDetailsHtml(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  if (!result.hit) return `<div style="padding:9px;border-radius:6px;background:rgba(123,31,31,.08);color:#5b2020;font-weight:850;">Aucun dégât : l’attaque ne touche pas.</div>`;

  const multiplier = ctx.useBackstab ? Math.max(1, number(ctx.backstabMultiplier, 1)) : 1;
  const damageBonus = number(snapshot?.damage?.bonus);
  const damageAmount = number(snapshot?.damage?.amount);
  const context = contextGridHtml([
    { label: "Arme", value: String(ctx?.arme?.name ?? "Arme") },
    { label: "Dés de base", value: baseDamageFormula(snapshot) },
    { label: "Résultat des dés", value: rawDamageRollDetails(snapshot, multiplier) },
    { label: "Dégâts appliqués", value: String(damageAmount) }
  ]);
  const modifiers = modifierTableHtml(ctx, snapshot.damageResolution, "damage");
  const calculationLines = [
    { label: "Calcul du jet", value: String(snapshot?.damage?.details ?? "—") },
    { label: "Total des modificateurs", value: signed(damageBonus) }
  ];
  if (multiplier > 1) calculationLines.push({ label: "Attaque sournoise", value: `Dégâts ×${multiplier}` });
  const calculations = calculationBoxHtml(calculationLines, `${damageAmount} dégâts`);
  const assassination = snapshot?.assassination?.resolved
    ? `<div style="margin-top:8px;padding:7px 8px;border-left:3px solid #b98b2d;background:rgba(185,139,45,.1);color:#4b3a1c;font-size:.78rem;line-height:1.35;"><strong>Assassinat :</strong> ${escapeHtml(snapshot.assassination.success ? "Réussi" : "Échoué")} · ${escapeHtml(snapshot.assassination.roll)} / ${escapeHtml(snapshot.assassination.score)}%</div>`
    : "";
  return `${context}${modifiers}${calculations}${assassination}`;
}

function sourceIdentity(ctx) {
  return {
    name: ctx?.actor?.name ?? "Attaquant",
    img: ctx?.chatImg ?? ctx?.actor?.img,
    type: "Attaquant",
    meta: ctx?.arme?.name ?? ""
  };
}

function targetIdentity(ctx) {
  return {
    name: ctx?.nomCible ?? ctx?.cible?.name ?? "Cible",
    img: ctx?.cible?.token?.texture?.src ?? ctx?.cible?.prototypeToken?.texture?.src ?? ctx?.cible?.img,
    type: "Défenseur"
  };
}

function baseFlags(ctx, visibility, kind) {
  return {
    add2e: {
      attackChatVisibility: visibility,
      attackChatKind: kind,
      attackChatVisibilityVersion: VERSION,
      attackDiagId: ctx.snapshot.diagId,
      attackSnapshotVersion: ctx.snapshot.version,
      createdByAttackRoll: true
    }
  };
}

function playerCardOptions(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const rows = [
    { label: "Arme", value: ctx?.arme?.name ?? "Arme" },
    { label: "Résultat", value: result.title }
  ];
  if (result.hit && number(snapshot?.damage?.amount) > 0) rows.push({ label: "Dégâts", value: String(number(snapshot.damage.amount)) });
  if (snapshot?.assassination?.resolved) rows.push({ label: "Assassinat", value: snapshot.assassination.success ? "Réussi" : "Échoué" });

  return {
    title: `Attaque — ${result.title}`,
    icon: result.icon,
    variant: result.variant,
    source: sourceIdentity(ctx),
    target: targetIdentity(ctx),
    rows,
    message: roleplay(ctx),
    chatData: {
      speaker: { alias: ctx?.actor?.name ?? "ADD2E" },
      whisper: [],
      blind: false,
      flags: baseFlags(ctx, "player-self", "player-summary")
    }
  };
}

function gmDetailsHtml(ctx) {
  return [
    detailSectionHtml({ label: "Toucher", icon: "fas fa-bullseye", body: touchDetailsHtml(ctx) }),
    detailSectionHtml({ label: "Dégâts", icon: "fas fa-burst", body: damageDetailsHtml(ctx) })
  ].join("");
}

function gmCardOptions(ctx) {
  const snapshot = ctx.snapshot;
  const result = outcome(ctx);
  const rows = [
    { label: "Arme", value: ctx?.arme?.name ?? "Arme" },
    { label: "Cible", value: `${ctx?.nomCible ?? ctx?.cible?.name ?? "Cible"} · CA ${number(snapshot?.threshold?.armorClass)}` },
    { label: "Résultat", value: result.title }
  ];
  if (result.hit) rows.push({ label: "Dégâts", value: String(number(snapshot?.damage?.amount)) });
  if (snapshot?.assassination?.resolved) {
    rows.push({
      label: "Assassinat",
      value: `${snapshot.assassination.success ? "Réussi" : "Échoué"} · ${snapshot.assassination.roll} / ${snapshot.assassination.score}%`
    });
  }

  const flags = baseFlags(ctx, "gm-only", "gm-details");
  flags.add2e.attackSnapshot = typeof foundry?.utils?.deepClone === "function"
    ? foundry.utils.deepClone(snapshot)
    : cloneForSocket(snapshot);

  return {
    title: `Détails d’attaque — ${result.title}`,
    icon: "fas fa-list-check",
    variant: result.variant,
    source: sourceIdentity(ctx),
    target: targetIdentity(ctx),
    rows,
    trustedBodyHtml: gmDetailsHtml(ctx),
    chatData: {
      speaker: { alias: ctx?.actor?.name ?? "ADD2E" },
      whisper: userIds(gmUsers()),
      blind: false,
      flags
    }
  };
}

function optionsForCurrentPlayer(options) {
  const copy = cloneForSocket(options);
  if (!copy) return null;
  copy.chatData ??= {};
  copy.chatData.whisper = [String(game.user.id)];
  copy.chatData.blind = false;
  copy.chatData.flags ??= {};
  copy.chatData.flags.add2e ??= {};
  copy.chatData.flags.add2e.attackChatVisibility = "player-self";
  copy.chatData.flags.add2e.attackRouteCreatorId = String(game.user.id);
  return copy;
}

async function createRoutedCard(payload = {}) {
  requireCommonChatApi();
  const messageId = String(payload.messageId ?? "");
  if (!messageId || globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS.has(messageId)) return null;

  const kind = String(payload.kind ?? "");
  const currentUserId = String(game.user?.id ?? "");
  let options = payload.options && typeof payload.options === "object" ? payload.options : null;
  if (!options) return null;

  if (kind === "player") {
    if (game.user?.isGM) return null;
    const targetUserIds = Array.isArray(payload.playerUserIds) ? payload.playerUserIds.map(String) : [];
    if (targetUserIds.length && !targetUserIds.includes(currentUserId)) return null;
    options = optionsForCurrentPlayer(options);
    if (!options) return null;
  } else if (kind === "gm") {
    if (!game.user?.isGM || String(payload.creatorId ?? "") !== currentUserId) return null;
  } else {
    return null;
  }

  options.chatData ??= {};
  options.chatData.flags ??= {};
  options.chatData.flags.add2e ??= {};
  options.chatData.flags.add2e.attackRouteId = messageId;

  const preview = String(globalThis.add2eBuildChatCard(options) ?? "").trim();
  if (!preview) throw new Error(`La carte d’attaque ${kind} est vide.`);

  globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS.add(messageId);
  try {
    return await globalThis.add2eCreateChatCard(options);
  } catch (error) {
    globalThis.__ADD2E_ATTACK_CHAT_ROUTE_IDS.delete(messageId);
    throw error;
  }
}

function onAttackChatSocket(data) {
  if (data?.type !== ROUTE_TYPE) return;
  const payload = data?.payload ?? {};
  if (payload.version !== VERSION) return;
  void createRoutedCard(payload).catch(error => console.error(`${LOG}[ROUTED_CREATE_FAILED]`, { payload, error }));
}

function registerAttackChatSocket() {
  if (!game?.socket?.on) return false;
  const previous = globalThis.__ADD2E_ATTACK_CHAT_SOCKET_HANDLER;
  if (previous && typeof game.socket.off === "function") game.socket.off(SOCKET, previous);
  globalThis.__ADD2E_ATTACK_CHAT_SOCKET_HANDLER = onAttackChatSocket;
  game.socket.on(SOCKET, onAttackChatSocket);
  globalThis.__ADD2E_ATTACK_CHAT_SOCKET_VERSION = VERSION;
  return true;
}

function installAttackChatSocket() {
  if (registerAttackChatSocket()) return;
  Hooks.once("ready", registerAttackChatSocket);
}

async function routePlayerCard(options, ctx) {
  const recipients = activeUsers(playerUsers());
  const playerUserIds = userIds(recipients);
  if (!playerUserIds.length) {
    console.warn(`${LOG}[NO_ACTIVE_PLAYERS]`, { diagId: ctx?.snapshot?.diagId });
    return { status: "skipped", kind: "player", playerUserIds, message: null };
  }

  const messageId = `attack-chat-player-${ctx.snapshot.diagId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = cloneForSocket({
    version: VERSION,
    messageId,
    kind: "player",
    playerUserIds,
    options
  });
  if (!payload) throw new Error("Impossible de sérialiser la carte d’attaque joueur.");

  let localMessage = null;
  if (!game.user?.isGM && playerUserIds.includes(String(game.user?.id ?? ""))) {
    localMessage = await createRoutedCard(payload);
  }

  if (!game?.socket?.emit) {
    if (!localMessage) throw new Error("Le socket ADD2E est indisponible pour router la carte d’attaque joueur.");
    return { status: "created-local", kind: "player", playerUserIds, message: localMessage };
  }

  game.socket.emit(SOCKET, { type: ROUTE_TYPE, payload });
  return { status: localMessage ? "created-and-broadcast" : "broadcast", kind: "player", playerUserIds, message: localMessage };
}

async function routeGmCard(options, ctx) {
  const recipients = gmUsers();
  const creatorId = activeCreatorId(recipients);
  if (!creatorId) {
    console.warn(`${LOG}[NO_ACTIVE_GM_CREATOR]`, { recipients: userIds(recipients), diagId: ctx?.snapshot?.diagId });
    return { status: "skipped", kind: "gm", creatorId: null, message: null };
  }

  const messageId = `attack-chat-gm-${ctx.snapshot.diagId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = cloneForSocket({
    version: VERSION,
    messageId,
    creatorId,
    kind: "gm",
    options
  });
  if (!payload) throw new Error("Impossible de sérialiser la carte d’attaque MJ.");

  if (creatorId === String(game.user?.id ?? "")) {
    const message = await createRoutedCard(payload);
    return { status: "created", kind: "gm", creatorId, message };
  }

  if (!game?.socket?.emit) throw new Error("Le socket ADD2E est indisponible pour router la carte d’attaque MJ.");
  game.socket.emit(SOCKET, { type: ROUTE_TYPE, payload });
  return { status: "queued", kind: "gm", creatorId, message: null };
}

function scheduleEffectsEngineAttackResolved(ctx) {
  setTimeout(() => {
    const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
    if (typeof engine?.handleMonkUnarmedAttackResolved !== "function") return;
    engine.handleMonkUnarmedAttackResolved(ctx).catch(error => console.error(`${LOG}[EFFECTS_ENGINE_ATTACK_RESOLVED]`, error));
  }, 0);
}

export async function add2eCreateAttackChatCards(ctx = {}) {
  requireCommonChatApi();
  if (!ctx?.snapshot || typeof ctx.snapshot !== "object") {
    throw new Error("La carte d’attaque exige un snapshot canonique de résolution.");
  }

  const playerOptions = playerCardOptions(ctx);
  const gmOptions = gmCardOptions(ctx);
  if (!String(globalThis.add2eBuildChatCard(playerOptions) ?? "").trim()) throw new Error("La carte joueur d’attaque ADD2E est vide.");
  if (!String(globalThis.add2eBuildChatCard(gmOptions) ?? "").trim()) throw new Error("La carte MJ d’attaque ADD2E est vide.");

  const [playerRoute, gmRoute] = await Promise.all([
    routePlayerCard(playerOptions, ctx),
    routeGmCard(gmOptions, ctx)
  ]);
  scheduleEffectsEngineAttackResolved(ctx);
  return { playerRoute, gmRoute };
}

installAttackChatSocket();

globalThis.add2eAttackChatDebug = function add2eAttackChatDebug() {
  return {
    version: VERSION,
    socketVersion: globalThis.__ADD2E_ATTACK_CHAT_SOCKET_VERSION ?? null,
    commonBuilder: typeof globalThis.add2eBuildChatCard === "function",
    commonCreator: typeof globalThis.add2eCreateChatCard === "function",
    user: game.user?.name,
    userId: game.user?.id,
    isGM: game.user?.isGM,
    activeGmCreatorId: activeCreatorId(gmUsers()),
    activePlayerIds: userIds(activeUsers(playerUsers())),
    gmRecipients: userIds(gmUsers()),
    playerRecipients: userIds(playerUsers()),
    ready: game?.ready
  };
};