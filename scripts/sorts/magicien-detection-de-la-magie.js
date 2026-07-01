// ADD2E — Détection de la magie — Foundry V13/V14/V15, DialogV2.
// Lit le contrat générique flags.add2e.magicAura, notamment Aura magique de Nystul.
const A = typeof actor !== "undefined" ? actor : null;
const I = typeof item !== "undefined" ? item : (typeof sort !== "undefined" ? sort : null);
const T = typeof token !== "undefined" ? token : null;
const R = typeof args !== "undefined" ? args : [];
const C = Object.freeze({ name: "Détection de la magie", slug: "detection_de_la_magie", img: "icons/magic/perception/eye-ringed-glow-angry-large-purple.webp" });
const esc = v => { const d = document.createElement("div"); d.innerText = String(v ?? ""); return d.innerHTML; };
const norm = v => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const array = v => Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;|\n]+/).filter(Boolean) : [];
const number = (...values) => { for (const v of values) { if (v && typeof v === "object") { const n = number(v.value, v.valeur, v.total, v.score); if (Number.isFinite(n)) return n; } const m = String(v ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/); if (m && Number.isFinite(Number(m[0]))) return Number(m[0]); } return null; };
const casterToken = actorDoc => T ?? R?.[0]?.token ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id) ?? actorDoc?.getActiveTokens?.()?.[0] ?? canvas?.tokens?.controlled?.[0] ?? null;
const carried = itemDoc => ["equipee", "equipped", "portee", "worn", "tenu", "carried"].some(k => itemDoc?.system?.[k] === true);
const formOf = (button, dialog, id) => button?.form ?? dialog?.element?.querySelector?.("form") ?? dialog?.element?.[0]?.querySelector?.("form") ?? document.getElementById(id);
const valueOf = (form, key) => String(new FormData(form).get(key) ?? "").trim();
function saveVsSpells(actorDoc) {
  const s = actorDoc?.system ?? {}; const direct = number(s.sauvegarde_sortileges, s.sauvegarde_sortilege, s.saveSorts, s.saveSpells, s.saves?.sorts, s.saves?.spells, s.savingThrows?.sorts, s.savingThrows?.spells, s.sauvegardes?.sorts, s.sauvegardes?.sortileges);
  if (Number.isFinite(direct)) return direct;
  for (const set of [s.sauvegardes, s.savingThrows]) {
    if (!Array.isArray(set)) continue;
    const named = set.find(x => /sort|spell/i.test(String(x?.type ?? x?.key ?? x?.name ?? x?.label ?? x?.nom ?? ""))); const namedValue = number(named?.value, named?.valeur, named?.total, named?.score); if (Number.isFinite(namedValue)) return namedValue;
    const values = set.map(x => number(x)).filter(Number.isFinite); if (values.length >= 5) return values[4]; if (values.length) return values.at(-1);
  }
  for (const raw of [s.sauvegardes, s.savingThrows]) if (typeof raw === "string") { const labeled = raw.match(/(?:sortil[eè]ges?|sorts?|spells?)\D*(\d+)/i); if (labeled) return Number(labeled[1]); }
  return null;
}
async function rollSave(actorDoc) { const target = saveVsSpells(actorDoc); if (!Number.isFinite(target)) return { available: false }; const roll = await new Roll("1d20").evaluate({ async: true }); return { available: true, total: Number(roll.total), target, success: Number(roll.total) >= target }; }
function aura(effect) {
  if (!effect || effect.disabled) return null;
  const f = effect.flags?.add2e ?? {}, m = f.magicAura ?? {}, s = f.spell ?? {}, tags = array(f.tags).map(norm);
  if (m.detectedAsMagical === true) return { kind: m.kind ?? "magic_aura", objectName: m.objectName ?? s.objectName ?? effect.name, itemId: m.itemId ?? s.itemId ?? null, itemUuid: m.itemUuid ?? s.itemUuid ?? null, revealableWhenHeld: m.revealableWhenHeld === true, revealSave: m.revealSave ?? "spells" };
  if (s.slug === "aura_magique_de_nystul" || tags.includes("sort_aura_magique_de_nystul")) return { kind: "false_magic_aura", objectName: s.objectName ?? effect.name, itemId: s.itemId ?? null, itemUuid: s.itemUuid ?? null, revealableWhenHeld: true, revealSave: "spells" };
  return null;
}
async function inspect(detector, target) {
  const holder = target?.actor; if (!holder) return [];
  const out = [];
  for (const a of [...(holder.effects ?? [])].map(aura).filter(Boolean)) {
    const ownedItem = holder.id === detector.id && a.itemId ? (holder.items?.get(a.itemId) ?? [...(holder.items ?? [])].find(i => i.uuid === a.itemUuid)) : null;
    const heldByDetector = a.revealableWhenHeld && carried(ownedItem);
    if (a.kind === "false_magic_aura" && heldByDetector && norm(a.revealSave) === "spells") {
      const save = await rollSave(detector); out.push({ state: !save.available ? "manual" : save.success ? "revealed" : "false", a, save });
    } else out.push({ state: a.kind === "false_magic_aura" ? "false" : "magical", a, save: null });
  }
  return out;
}
async function choose() {
  const DialogV2 = foundry?.applications?.api?.DialogV2; if (!DialogV2?.wait) { ui.notifications?.error?.(`${C.name} : DialogV2 indisponible.`); return null; }
  const id = `add2e-detect-magic-${foundry?.utils?.randomID?.(8) ?? Date.now()}`;
  return DialogV2.wait({ window: { title: C.name }, modal: true, rejectClose: false, content: `<form id="${id}" class="add2e-dialog"><p>Cible un jeton pour examiner son équipement ; sans cible, le sort examine l'équipement du lanceur.</p><div class="form-group"><label>Note MD (facultative)</label><textarea name="note" rows="3"></textarea></div></form>`, buttons: [{ action: "cast", label: "Détecter", default: true, callback: (_e,b,d) => ({ note: valueOf(formOf(b,d,id), "note") }) }, { action: "cancel", label: "Annuler", callback: () => null }] });
}
function line(result) {
  const name = esc(result.a.objectName ?? "Objet");
  if (result.state === "revealed") return `<li><b>${name}</b> : la supercherie est révélée par le jet de protection contre les sorts (${result.save.total} / ${result.save.target}).</li>`;
  if (result.state === "manual") return `<li><b>${name}</b> : aura magique détectée ; le MD résout le jet de protection contre les sorts du détenteur.</li>`;
  if (result.state === "false") return `<li><b>${name}</b> : une aura magique est détectée, mais sa nature ne peut pas être révélée.</li>`;
  return `<li><b>${name}</b> : une aura magique est détectée.</li>`;
}
async function chat(targets, results, note) {
  const tokenDoc = casterToken(A), casterName = A?.name ?? tokenDoc?.name ?? "Magicien", casterImg = tokenDoc?.document?.texture?.src ?? A?.img ?? "icons/svg/mystery-man.svg", targetNames = targets.map(t => t.name).join(", ") || casterName;
  const details = results.length ? `<ul style="margin:.35em 0;padding-left:1.25em;font-size:13px;line-height:1.4">${results.map(line).join("")}</ul>` : `<p>Aucune aura artificielle connue d'ADD2E n'est détectée sur l'équipement examiné.</p>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: A, token: tokenDoc }), content: `<div class="add2e-chat-card add2e-magicien-sort add2e-sort-detection-magie" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary)"><div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px"><img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff"><div style="flex:1"><b>${esc(casterName)}</b><div style="font-size:12px;font-weight:700">lance ${C.name}</div></div><div style="font-weight:800;font-size:12px">Sort profane</div><img src="${esc(I?.img || C.img)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff"></div><div style="padding:9px 10px"><div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px"><div style="color:#6c31b5;font-weight:900;text-align:center">PERCEPTION MAGIQUE</div><p><b>Équipement examiné :</b> ${esc(targetNames)}.</p>${details}${note ? `<p style="font-size:12px"><b>Note MD :</b> ${esc(note)}</p>` : ""}</div><details style="margin-top:7px"><summary>Règle appliquée</summary><p>Une fausse aura déclarée dans <code>flags.add2e.magicAura</code> paraît magique. Si le détecteur tient l'objet de Nystul, son jet de protection contre les sorts peut révéler la supercherie.</p></details></div></div>` });
}
if (!A) { ui.notifications?.warn?.(`${C.name} : acteur lanceur introuvable.`); return false; }
const choice = await choose(); if (!choice) return false;
const targets = [...(game.user?.targets ?? [])].filter(t => t?.actor); if (!targets.length && casterToken(A)) targets.push(casterToken(A));
const results = []; for (const target of targets) results.push(...await inspect(A, target));
await chat(targets, results, choice.note); return true;
