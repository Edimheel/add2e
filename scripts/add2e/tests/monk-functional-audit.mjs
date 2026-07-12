// ADD2E — Audit fonctionnel automatisé du moine.
const ADD2E_MONK_FUNCTIONAL_AUDIT_VERSION = "2026-07-12-functional-audit-v4";
globalThis.ADD2E_MONK_FUNCTIONAL_AUDIT_VERSION = ADD2E_MONK_FUNCTIONAL_AUDIT_VERSION;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const norm = v => String(v ?? "").trim().toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function monkItem(actor) {
  return [...(actor?.items ?? [])].find(i =>
    String(i.type ?? "").toLowerCase() === "classe" &&
    [i.name, i.system?.slug, i.system?.label, i.system?.nom, i.system?.name]
      .map(norm).some(v => v === "moine" || v.includes("moine"))
  ) ?? null;
}
function level(actor, item) {
  const n = Number(item?.system?.niveau ?? item?.system?.level);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : Math.max(1, Number(actor?.system?.niveau) || 1);
}
function progressionRow(actor, item) {
  const lvl = level(actor, item);
  const rows = Array.isArray(item?.system?.progression) ? item.system.progression : [];
  return rows.find((r, i) => Number(r?.niveau ?? r?.level ?? i + 1) === lvl) ?? rows[lvl - 1] ?? null;
}
function equipped(item) { return item?.system?.equipee === true || item?.system?.equipped === true; }
function mainNue(actor) {
  return [...(actor?.items ?? [])].find(i =>
    String(i.type ?? "").toLowerCase() === "arme" &&
    (norm(i.name) === "main_nue" || i.system?.sourceCapacite === "main_nue_moine")
  ) ?? null;
}
function featureName(f) { return f?.name ?? f?.label ?? f?.id ?? "Capacité"; }
function stripHtml(html) {
  const el = document.createElement("div");
  el.innerHTML = String(html ?? "");
  return String(el.textContent ?? "").replace(/\s+/g, " ").trim();
}
function add(results, capability, status, test, expected = "", actual = "", details = "") {
  results.push({ capability, status, test, expected, actual, details });
}
function featureKey(f) {
  return norm(f?.id ?? f?.key ?? f?.slug ?? f?.name ?? f?.label);
}
function findFeature(features, ...needles) {
  const ns = needles.map(norm);
  return features.find(f => {
    const hay = [featureKey(f), norm(featureName(f)), norm(f?._add2eClassSlug), norm(f?._add2eClassName)].join("|");
    return ns.some(n => hay.includes(n));
  }) ?? null;
}
function effectFor(actor, feature, ...names) {
  const keys = [featureKey(feature), ...names.map(norm)].filter(Boolean);
  return [...(actor?.effects ?? [])].find(e => {
    const hay = [
      e.name,
      e.flags?.add2e?.classFeatureId,
      e.flags?.add2e?.featureId,
      e.flags?.add2e?.passiveKey,
      e.system?.key
    ].map(norm).join("|");
    return keys.some(k => hay.includes(k));
  }) ?? null;
}
function effectPayload(effect) {
  return {
    disabled: effect?.disabled === true,
    changes: effect?.changes ?? effect?.system?.changes ?? [],
    system: effect?.system ?? {},
    flags: effect?.flags?.add2e ?? {}
  };
}
function mechanicalPayload(effect) {
  if (!effect) return false;
  const p = effectPayload(effect);
  return !p.disabled && (
    (Array.isArray(p.changes) && p.changes.length > 0) ||
    Object.keys(p.system ?? {}).length > 0 ||
    Object.keys(p.flags ?? {}).some(k => !["classFeatureId", "featureId", "passiveKey", "sourceItemId", "sourceItemUuid", "classLevel"].includes(k))
  );
}
function payloadSummary(effect) {
  if (!effect) return "Effet absent";
  const p = effectPayload(effect);
  const changes = Array.isArray(p.changes) ? p.changes.length : 0;
  const systems = Object.keys(p.system ?? {}).length;
  const flags = Object.keys(p.flags ?? {}).length;
  return `actif=${!p.disabled}, changes=${changes}, system=${systems}, flags=${flags}`;
}

function dialogValue(name, element) {
  const k = norm(name);
  if (element?.type === "checkbox") return element.checked ? "on" : "";
  if (k.includes("height")) return "6";
  if (k.includes("walldistance")) return "0.3";
  if (k.includes("contact")) return "on";
  if (k.includes("turn")) return "1";
  if (k.includes("modifier") || k.includes("bonus") || k.includes("malus") || k === "mod") return "0";
  return element?.value ?? "0";
}
async function autoDialog(fn) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const original = DialogV2?.wait;
  if (DialogV2?.wait) {
    DialogV2.wait = async config => {
      const form = document.createElement("form");
      form.innerHTML = String(config?.content ?? "");
      const values = {};
      for (const e of form.querySelectorAll("input[name],select[name],textarea[name]")) values[e.name] = dialogValue(e.name, e);
      return values;
    };
  }
  try { return await fn(); }
  finally { if (DialogV2 && original) DialogV2.wait = original; }
}
function autoAttackDialog() {
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };
    const submit = () => {
      const root = document.querySelector(".add2e-attack-dialog,.add2e-attack-dialog-compact");
      if (!root) return false;
      const button = root.querySelector("button[data-action='ok'],button[type='submit']");
      if (!button) return false;
      queueMicrotask(() => button.click());
      finish(true);
      return true;
    };
    const observer = new MutationObserver(submit);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => finish(false), 3000);
    submit();
  });
}

async function runAttack(actor, weapon, targetToken, messages) {
  if (!weapon) return { ok: false, text: "", reason: "Arme absente" };
  if (!equipped(weapon)) await weapon.update({ "system.equipee": true }, { add2eAudit: true });
  await targetToken.setTarget(true, { user: game.user, releaseOthers: true, groupSelection: false });
  const before = messages.length;
  const submit = autoAttackDialog();
  const ok = await globalThis.add2eAttackRoll({ actor, arme: weapon, actorId: actor.id, itemId: weapon.id });
  await submit;
  await wait(800);
  return { ok: ok === true, text: messages.slice(before).map(m => stripHtml(m.content)).join(" | ") };
}

function thiefSnapshot(actor) {
  const sys = actor?.system ?? {};
  const candidates = [
    sys.voleur, sys.thief, sys.competencesVoleur, sys.competences_voleur,
    sys.skills?.voleur, sys.skills?.thief, sys.capacitesVoleur
  ].filter(v => v && typeof v === "object");
  const source = candidates[0] ?? null;
  if (!source) return { found: false, count: 0, values: {} };
  const values = {};
  const walk = (obj, prefix = "") => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "number" && Number.isFinite(v)) values[key] = v;
      else if (v && typeof v === "object" && !Array.isArray(v)) walk(v, key);
    }
  };
  walk(source);
  return { found: true, count: Object.keys(values).length, values };
}

async function testActiveCapability({ actor, targetToken, feature, messages, results, expectedText = null }) {
  const run = globalThis.add2eExecuteClassFeatureOnUse;
  if (!feature || typeof run !== "function") {
    add(results, feature ? featureName(feature) : "Capacité absente", "ÉCHEC", "Exécution réelle", "Capacité disponible", feature ? "Moteur absent" : "Capacité absente");
    return;
  }
  await targetToken.setTarget(true, { user: game.user, releaseOthers: true, groupSelection: false });
  const before = messages.length;
  try {
    const value = await autoDialog(() => run(actor, feature, null));
    await wait(400);
    const out = messages.slice(before).map(m => stripHtml(m.content)).join(" | ");
    const textOk = expectedText ? expectedText.test(out) : true;
    const ok = value !== false && textOk;
    add(results, featureName(feature), ok ? "OK" : "ÉCHEC", "Exécution réelle",
      expectedText ? `Exécution + message ${expectedText}` : "Exécution réussie",
      `retour=${String(value)}`, out || "Aucun message");
  } catch (error) {
    add(results, featureName(feature), "ÉCHEC", "Exécution réelle", "Aucune erreur", error.message, "");
  }
}

function testPassiveEffect(results, actor, feature, label, semanticPattern = null) {
  const effect = effectFor(actor, feature, label);
  if (!effect) {
    add(results, label, "ÉCHEC", "Effet passif", "ActiveEffect actif", "Absent", "");
    return;
  }
  const summary = JSON.stringify(effectPayload(effect));
  const semanticOk = semanticPattern ? semanticPattern.test(summary) : true;
  const mechanical = mechanicalPayload(effect);
  const ok = !effect.disabled && mechanical && semanticOk;
  add(results, label, ok ? "OK" : "ÉCHEC", "Effet passif mécanique",
    semanticPattern ? `Effet actif avec règle ${semanticPattern}` : "Effet actif avec données mécaniques",
    payloadSummary(effect), semanticOk ? "" : "Le contenu de l’effet ne décrit pas la règle attendue");
}

function buildReportHtml(actorName, results) {
  const esc = foundry?.utils?.escapeHTML ?? (s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])));
  const rows = results.map(r => `<tr>
    <td><strong>${esc(r.capability)}</strong></td>
    <td>${esc(r.status)}</td>
    <td>${esc(r.test)}</td>
    <td>${esc(r.expected)}</td>
    <td>${esc(r.actual)}</td>
    <td>${esc(r.details)}</td>
  </tr>`).join("");
  const counts = results.reduce((o, r) => (o[r.status] = (o[r.status] ?? 0) + 1, o), {});
  return `<div class="add2e-monk-audit-report">
    <h2>Audit fonctionnel du moine — ${esc(actorName)}</h2>
    <p><strong>Version :</strong> ${ADD2E_MONK_FUNCTIONAL_AUDIT_VERSION}</p>
    <p><strong>Résumé :</strong> ${Object.entries(counts).map(([k,v]) => `${esc(k)} : ${v}`).join(" — ")}</p>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th>Capacité</th><th>Statut</th><th>Test</th><th>Attendu</th><th>Observé</th><th>Détails</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
async function showReport(actorName, results) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return;
  await DialogV2.wait({
    window: { title: `Audit moine — ${actorName}`, resizable: true },
    position: { width: 1100, height: 720 },
    content: buildReportHtml(actorName, results),
    buttons: [{ action: "close", label: "Fermer", default: true }]
  });
}

async function cloneActor(source, suffix) {
  const data = source.toObject();
  delete data._id;
  data.name = `[AUDIT MOINE] ${source.name} — ${suffix}`;
  data.folder = null;
  data.ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
  return Actor.create(data, { add2eAudit: true });
}
async function cloneToken(scene, actor, sourceToken, x, y) {
  const data = sourceToken?.document?.toObject?.() ?? actor.prototypeToken?.toObject?.() ?? {};
  delete data._id;
  delete data.flags;
  data.actorId = actor.id;
  data.actorLink = true;
  data.name = actor.name;
  data.x = x;
  data.y = y;
  data.hidden = true;
  const [doc] = await scene.createEmbeddedDocuments("Token", [data], { add2eAudit: true });
  return doc?.object ?? canvas.tokens?.get(doc?.id) ?? null;
}

async function add2eRunMonkFunctionalAudit(options = {}) {
  if (!game.user?.isGM) throw new Error("L’audit fonctionnel du moine doit être lancé par un MJ.");
  const sourceToken = options.token ?? canvas.tokens?.controlled?.[0] ?? null;
  const sourceActor = options.actor ?? sourceToken?.actor ?? null;
  const selectedTarget = options.targetToken ?? [...(game.user?.targets ?? [])][0] ?? null;
  const targetActor = options.target ?? selectedTarget?.actor ?? null;
  if (!sourceActor || !monkItem(sourceActor)) throw new Error("Sélectionne un token possédant la classe Moine.");
  if (!targetActor) throw new Error("Cible un token avant de lancer l’audit.");
  if (!canvas.scene) throw new Error("Aucune scène active.");

  const results = [], messages = [], createdMessages = [];
  let monkClone = null, targetClone = null, monkToken = null, targetToken = null;
  const chatHook = Hooks.on("createChatMessage", message => {
    if (![monkClone?.id, targetClone?.id].includes(message.speaker?.actor)) return;
    messages.push(message);
    createdMessages.push(message);
  });

  try {
    monkClone = await cloneActor(sourceActor, "MOINE");
    targetClone = await cloneActor(targetActor, "CIBLE");
    const grid = canvas.grid?.size ?? 100;
    monkToken = await cloneToken(canvas.scene, monkClone, sourceToken, grid, grid);
    targetToken = await cloneToken(canvas.scene, targetClone, selectedTarget, grid * 2, grid);
    if (!monkToken || !targetToken) throw new Error("Impossible de créer les tokens temporaires.");

    await targetToken.setTarget(true, { user: game.user, releaseOthers: true, groupSelection: false });
    await globalThis.add2eSyncMonkUnarmedWeapon?.(monkClone);
    await wait(750);

    const classItem = monkItem(monkClone);
    const row = progressionRow(monkClone, classItem);
    const unarmed = mainNue(monkClone);
    const passiveFeatures = (globalThis.add2eGetActorPassiveClassFeatures?.(monkClone, { includeLocked: false }) ?? [])
      .filter(f => norm(f?._add2eClassSlug ?? f?._add2eClassName ?? "moine").includes("moine"));
    const activeFeatures = (globalThis.add2eGetActorActivableClassFeatures?.(monkClone, { includeLocked: false }) ?? [])
      .filter(f => norm(f?._add2eClassSlug ?? f?._add2eClassName ?? "moine").includes("moine"));

    const expectedDamage = row?.monk?.unarmedDamage ?? row?.unarmedDamage ?? "Non renseigné";
    const actualDamage = unarmed?.system?.degats ?? unarmed?.system?.dégâts?.contre_moyen ?? "Absent";
    add(results, "Combat à mains nues", unarmed ? "OK" : "ÉCHEC", "Création et progression de Main nue",
      String(expectedDamage), String(actualDamage), `Niveau ${level(monkClone, classItem)}`);

    const attack = await runAttack(monkClone, unarmed, targetToken, messages);
    const strengthApplied = /(bonus|modificateur).{0,25}(force|for\b)/i.test(attack.text) &&
      !/(force|for\b).{0,12}(0|aucun)/i.test(attack.text);
    add(results, "Combat à mains nues", attack.ok && !strengthApplied ? "OK" : "ÉCHEC",
      "Attaque réelle sans bonus de Force", "Attaque résolue, modificateur Force = 0",
      `attaque=${attack.ok}, bonusForce=${strengthApplied}`, attack.text);

    const martial = findFeature(passiveFeatures, "bonus_de_degats_martial");
    const martialEffect = effectFor(monkClone, martial, "bonus de degats martial");
    const expectedMartial = row?.monk?.damageBonus ?? row?.monk?.martialDamageBonus ?? row?.damageBonus ?? row?.bonusDegats ?? null;
    const martialText = JSON.stringify(effectPayload(martialEffect));
    const martialHasValue = expectedMartial == null ? mechanicalPayload(martialEffect) : martialText.includes(String(expectedMartial));
    add(results, "Bonus de dégâts martial",
      martial && martialEffect && !martialEffect.disabled && martialHasValue ? "OK" : "ÉCHEC",
      "Progression + ActiveEffect", expectedMartial == null ? "Effet mécanique actif" : `Bonus attendu ${expectedMartial}`,
      martialEffect ? payloadSummary(martialEffect) : "Effet absent",
      expectedMartial == null ? "" : `Valeur recherchée dans l’effet : ${expectedMartial}`);

    const thief = findFeature(passiveFeatures, "habilites_de_voleur_du_moine", "habiletes_de_voleur_du_moine");
    const thiefData = thiefSnapshot(monkClone);
    add(results, "Habiletés de voleur du moine",
      thief && thiefData.found && thiefData.count > 0 ? "OK" : "ÉCHEC",
      "Alimentation du moteur voleur", "Bloc de compétences présent avec valeurs numériques",
      `capacité=${Boolean(thief)}, bloc=${thiefData.found}, valeurs=${thiefData.count}`,
      Object.entries(thiefData.values).slice(0, 12).map(([k,v]) => `${k}=${v}`).join(", "));

    const surprise = findFeature(activeFeatures, "surprise_reduite");
    await testActiveCapability({ actor: monkClone, targetToken, feature: surprise, messages, results, expectedText: /surprise|surpris/i });

    const slowFall = findFeature(activeFeatures, "chute_ralentie");
    await testActiveCapability({ actor: monkClone, targetToken, feature: slowFall, messages, results, expectedText: /chute|hauteur|mur|degats/i });

    testPassiveEffect(results, monkClone, findFeature(passiveFeatures, "masquer_son_esprit"), "Masquer son esprit", /esprit|mental|telepath|esp/i);
    testPassiveEffect(results, monkClone, findFeature(passiveFeatures, "parade_des_projectiles"), "Parade des projectiles", /projectile|parade|distance|missile/i);

    const catalepsy = findFeature(activeFeatures, "catalepsie");
    await testActiveCapability({ actor: monkClone, targetToken, feature: catalepsy, messages, results, expectedText: /catalepsie|apparence de la mort|actions/i });
    const catEffect = effectFor(monkClone, catalepsy, "catalepsie");
    add(results, "Catalepsie", catEffect && !catEffect.disabled ? "OK" : "ÉCHEC",
      "État appliqué après activation", "ActiveEffect actif", catEffect?.name ?? "Absent", payloadSummary(catEffect));

    testPassiveEffect(results, monkClone, findFeature(passiveFeatures, "resistance_aux_charmes_et_suggestions"),
      "Résistance aux charmes et suggestions", /charme|suggestion|resistance/i);
    testPassiveEffect(results, monkClone, findFeature(passiveFeatures, "defense_mentale"),
      "Défense mentale", /mental|telepath|esp|intelligence|choc/i);
    testPassiveEffect(results, monkClone, findFeature(passiveFeatures, "immunite_aux_poisons"),
      "Immunité aux poisons", /poison|immun/i);
    testPassiveEffect(results, monkClone, findFeature(passiveFeatures, "immunite_aux_quetes"),
      "Immunité aux quêtes", /quete|quest|immun/i);

    const defense = globalThis.Add2eEffectsEngine?.getMagicPassiveDefense?.(monkClone, { source: "monk-functional-audit" });
    add(results, "Ajustement de Dextérité à la CA",
      defense ? (Number(defense.dex) === 0 ? "OK" : "ÉCHEC") : "NON AUTOMATISABLE",
      "Calcul défensif réel", "DEX = 0", defense ? String(defense.dex) : "Indisponible",
      defense ? `CA totale ${defense.caTotal}` : "");

  } finally {
    try { game.user.updateTokenTargets([]); } catch (_) {}
    await wait(3000);
    Hooks.off("createChatMessage", chatHook);
    try { await canvas.scene.deleteEmbeddedDocuments("Token", [monkToken?.id, targetToken?.id].filter(Boolean), { add2eAudit: true }); } catch (e) { console.warn("[ADD2E][AUDIT MOINE][CLEANUP][TOKENS]", e); }
    await wait(1000);
    try { if (monkClone?.id && game.actors?.get(monkClone.id)) await monkClone.delete({ add2eAudit: true }); } catch (e) { console.warn("[ADD2E][AUDIT MOINE][CLEANUP][MOINE]", e); }
    try { if (targetClone?.id && game.actors?.get(targetClone.id)) await targetClone.delete({ add2eAudit: true }); } catch (e) { console.warn("[ADD2E][AUDIT MOINE][CLEANUP][CIBLE]", e); }
    await wait(1000);
    try { await Promise.all(createdMessages.filter(m => m?.id && game.messages?.get(m.id)).map(m => m.delete())); } catch (e) { console.warn("[ADD2E][AUDIT MOINE][CLEANUP][MESSAGES]", e); }
  }

  const counts = results.reduce((o, r) => (o[r.status] = (o[r.status] ?? 0) + 1, o), {});
  console.group(`[ADD2E][AUDIT MOINE] ${sourceActor.name}`);
  console.table(results.map(r => ({
    "Capacité": r.capability, "Statut": r.status, "Test effectué": r.test,
    "Attendu": r.expected, "Observé": r.actual, "Détails": r.details
  })));
  console.log("Résumé", counts);
  console.groupEnd();
  ui.notifications.info(`Audit du moine terminé : ${counts.OK ?? 0} OK, ${counts["ÉCHEC"] ?? 0} échec(s).`);
  await showReport(sourceActor.name, results);
  return { version: ADD2E_MONK_FUNCTIONAL_AUDIT_VERSION, actor: sourceActor.name, results, counts };
}
globalThis.add2eRunMonkFunctionalAudit = add2eRunMonkFunctionalAudit;
