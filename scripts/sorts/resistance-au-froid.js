// ADD2E — onUse Clerc niveau 1 : Résistance au Froid
// Version : 2026-06-02-clerc-n1-resistance-froid-time-engine-v1
// Retour attendu par le moteur ADD2E : true = sort consommé, false = sort non consommé.

const ADD2E_SORT_CONFIG = {
  name: "Résistance au Froid",
  slug: "resistance_au_froid",
  level: 1,
  classe: "Clerc",
  description: "Ce sort protège la créature touchée contre les effets du froid naturel ou magique. La durée est d’un tour par niveau du clerc.",
  effect_rounds: "level",
  effect_unit: "tour",
  effectTags: [
    "classe:clerc",
    "liste:clerc",
    "niveau:1",
    "sort:resistance_au_froid",
    "ecole:alteration",
    "resistance:froid",
    "etat:resistance_froid",
    "bonus_js_vs:froid:3",
    "bonus_save_vs:froid:3",
    "degats_froid_si_save_rate:moitie",
    "degats_froid_si_save_reussi:quart",
    "temperature:froid_naturel:-18",
    "duree:1_tour_par_niveau"
  ]
};

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][CLERC_N1][RESISTANCE_FROID]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eCasterLevel(actor) {
  return Number(actor?.system?.niveau ?? actor?.system?.level ?? actor?.system?.details?.niveau ?? 1) || 1;
}

function add2eRoundCount(expr, unit, level) {
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  if (time?.toRounds) return time.toRounds(expr, unit, { level });
  if (typeof expr === "number") return expr;
  if (!expr) return 0;
  const s = String(expr);
  if (s === "level" && unit === "tour") return 10 * level;
  if (s === "10*level") return 10 * level;
  return Number(s) || 0;
}

function add2eDurationData(rounds) {
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  return time?.durationData?.(rounds) ?? {
    rounds: rounds || undefined,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

function add2eTimeFlags({ rounds, level, caster, targetActor }) {
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  return time?.flags?.({
    source: "resistance-au-froid.js",
    rounds,
    unit: "round",
    endMessage: "La résistance au froid de {actor} prend fin.",
    extra: {
      spellKey: ADD2E_SORT_CONFIG.slug,
      spellName: ADD2E_SORT_CONFIG.name,
      spellList: "cleric",
      level,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      tags: ADD2E_SORT_CONFIG.effectTags
    }
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: rounds },
    roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "La résistance au froid de {actor} prend fin." },
    endMessage: "La résistance au froid de {actor} prend fin.",
    spellKey: ADD2E_SORT_CONFIG.slug,
    spellName: ADD2E_SORT_CONFIG.name,
    spellList: "cleric",
    level,
    casterId: caster?.id ?? null,
    casterUuid: caster?.uuid ?? null,
    targetId: targetActor?.id ?? null,
    targetUuid: targetActor?.uuid ?? null,
    tags: ADD2E_SORT_CONFIG.effectTags
  };
}

function add2eGetCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eGetTargets({ fallbackCaster = true } = {}) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length) return targets;
  const casterToken = add2eGetCasterToken();
  return (fallbackCaster && casterToken) ? [casterToken] : [];
}

async function add2eChat(title, html, speakerToken = null, options = {}) {
  const casterToken = speakerToken ?? (typeof add2eGetCasterToken === "function" ? add2eGetCasterToken() : null);
  const casterActor = actor ?? casterToken?.actor ?? null;
  const casterName = casterActor?.name ?? casterToken?.name ?? "Clerc";
  const spellName = item?.name ?? title ?? "Sort divin";
  const casterImg = casterToken?.document?.texture?.src ?? casterActor?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = item?.img ?? "icons/svg/book.svg";
  const targets = Array.from(game.user.targets ?? []);
  const targetLabel = options.targetLabel ?? (targets.length ? targets.map(t => t.name).join(", ") : casterName);
  const outcome = options.outcome ?? title ?? spellName;
  const rule = options.rule ?? options.regle ?? "";
  const subtitle = options.subtitle ?? "Sort divin";

  const safeCaster = add2eHtmlEscape(casterName);
  const safeSpell = add2eHtmlEscape(spellName);
  const safeSubtitle = add2eHtmlEscape(subtitle);
  const safeTarget = add2eHtmlEscape(targetLabel);
  const safeOutcome = add2eHtmlEscape(outcome);
  const safeCasterImg = add2eHtmlEscape(casterImg);
  const safeSpellImg = add2eHtmlEscape(spellImg);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-clerc-sort"
           style="border:1px solid #c79222;border-radius:8px;overflow:hidden;background:#fff8e6;color:#5a3b12;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#9f6b0a;color:#fff;padding:7px 9px;">
          <img src="${safeCasterImg}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #f3d48a;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${safeCaster}</div>
            <div style="font-size:12px;font-weight:700;">lance ${safeSpell}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">${safeSubtitle}</div>
          <img src="${safeSpellImg}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #f0d391;background:#fff;" />
        </div>

        <div style="padding:9px 10px 10px 10px;background:#fff8e6;">
          <div style="font-size:13px;margin:0 0 6px 0;"><b>Cible :</b> ${safeTarget}</div>

          <div style="border:1px solid #e0ae37;border-radius:6px;background:#fffdf5;padding:8px;text-align:center;margin-bottom:7px;">
            <div style="color:#1c9b4b;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${safeOutcome}</div>
            <div style="font-size:13px;line-height:1.35;text-align:center;">${html}</div>
          </div>

          <details style="border:1px solid #e0ae37;border-radius:5px;background:#fffdf5;padding:5px 7px;">
            <summary style="cursor:pointer;font-weight:800;color:#6a4611;">Règle appliquée</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">${rule || "Effet du sort appliqué selon sa description et l’arbitrage du MD."}</div>
          </details>
        </div>
      </div>`
  });
}

async function add2eApplyTaggedEffect(targetActor, { name, img, tags, rounds = 0, description = "", level = 1, caster = null }) {
  if (!targetActor) return false;

  const data = {
    name,
    img: img || item?.img || "icons/svg/aura.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: add2eDurationData(rounds),
    description,
    flags: {
      add2e: {
        ...add2eTimeFlags({ rounds, level, caster, targetActor }),
        tags: tags ?? []
      }
    }
  };

  try {
    await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
    return true;
  } catch (e) {
    console.warn(`${ADD2E_ONUSE_TAG}[EFFECT_CREATE_FAILED]`, {
      sort: ADD2E_SORT_CONFIG.name,
      target: targetActor.name,
      error: e
    });
    return false;
  }
}

const targets = add2eGetTargets({ fallbackCaster: true });

if (!targets.length) {
  ui.notifications.warn("Résistance au Froid : aucune cible disponible.");
  return false;
}

const level = add2eCasterLevel(actor);
const rounds = add2eRoundCount(ADD2E_SORT_CONFIG.effect_rounds, ADD2E_SORT_CONFIG.effect_unit, level);

for (const t of targets) {
  await add2eApplyTaggedEffect(t.actor, {
    name: ADD2E_SORT_CONFIG.name,
    img: item?.img,
    tags: ADD2E_SORT_CONFIG.effectTags,
    rounds,
    level,
    caster: actor,
    description: `${ADD2E_SORT_CONFIG.name} lancé par ${actor?.name ?? "un clerc"}.`
  });
}

await add2eChat(ADD2E_SORT_CONFIG.name, `
  <p>Résistance au froid appliquée.</p>
  <p>Durée mécanique : <b>${rounds}</b> round(s), soit <b>1 tour par niveau</b>.</p>
  <p>La cible bénéficie de +3 au jet de protection contre le froid magique. En cas d’échec, les dégâts de froid sont réduits de moitié ; en cas de réussite, ils sont réduits au quart.</p>
`, null, {
  targetLabel: targets.map(t => t.name).join(", "),
  outcome: "RÉSISTANCE AU FROID",
  rule: "Protège contre le froid naturel jusqu’à environ -18°C. Contre le froid magique ou intense : +3 au jet de protection ; dégâts réduits de moitié si le jet échoue, au quart si le jet réussit. Durée : 1 tour par niveau du clerc."
});

return true;
