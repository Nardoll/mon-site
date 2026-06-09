import { requireAuth } from "./auth.js";
import { getMembres, getVoteActif, getLivres, soumettreVote } from "./db.js";
import { formatMois, showToast } from "./utils.js";

await requireAuth();

// ── State ─────────────────────────────────────────────────────────────
let voteActif = null, membres = [], livres = [];
let selectedMembreId = null;

// ── Helpers ───────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Render ────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("bul-root");

  const backLink = `<a href="votes.html" class="bul-back">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
    Retour aux votes
  </a>`;

  if (!voteActif) {
    root.innerHTML = `${backLink}
      <div class="bul-paper">
        <div class="bul-vide">
          <div class="bul-vide-icon">🗳</div>
          <div class="bul-vide-title">Aucun vote en cours</div>
          <div class="bul-vide-sub">Revenez lorsqu'un vote sera lancé.</div>
        </div>
      </div>`;
    return;
  }

  const echelle   = voteActif.echelle || 5;
  const livreIds  = voteActif.livre_ids || [];
  const bulletins = voteActif.bulletins || {};
  const isTour2   = voteActif.tour === 2;
  const half      = echelle / 2;

  root.innerHTML = `${backLink}
    <div class="bul-paper">
      <div class="bul-title">Bulletin de vote</div>
      <div class="bul-mois">${formatMois(voteActif.mois, voteActif.annee)}${isTour2 ? ' — Tour 2' : ''}</div>
      <div class="bul-instruct">Notez chaque livre de 0 à ${echelle}. 0 = pas du tout, ${echelle} = coup de cœur.</div>

      <div class="bul-divider"></div>

      <div class="bul-membre">
        <label class="bul-section-head">Qui êtes-vous ?</label>
        <select id="bul-qui">
          <option value="">— Choisir votre nom —</option>
          ${membres.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('')}
        </select>
        <div id="bul-already"></div>
      </div>

      <div class="bul-divider"></div>

      <div id="bul-livres">
        ${livreIds.map((id, i) => {
          const l = livres.find(b => b.id === id);
          return `${i > 0 ? '<div class="bul-divider"></div>' : ''}
            <div class="bul-livre" data-livre="${id}">
              <div class="bul-livre-title">${esc(l?.titre ?? id)}</div>
              ${l?.auteur ? `<div class="bul-livre-author">${esc(l.auteur)}</div>` : ''}
              <div class="bul-slider-row">
                <input class="bul-slider" type="range" min="0" max="${echelle}" step="0.5"
                  value="${half}" id="bsl-${id}" data-id="${id}" />
                <div class="bul-note-val" id="bnd-${id}">${half}</div>
                <div class="bul-note-scale">/${echelle}</div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <div class="bul-divider"></div>
      <button class="bul-submit" id="bul-submit" disabled>Soumettre mon vote</button>
    </div>`;

  // Wire sliders
  livreIds.forEach(id => {
    document.getElementById(`bsl-${id}`).addEventListener("input", e => {
      document.getElementById(`bnd-${id}`).textContent = e.target.value;
    });
  });

  // Wire membre selector
  document.getElementById("bul-qui").addEventListener("change", e => {
    selectedMembreId = e.target.value || null;
    document.getElementById("bul-submit").disabled = !selectedMembreId;
    prefillIfAlreadyVoted();
  });

  // Wire submit
  document.getElementById("bul-submit").addEventListener("click", async () => {
    if (!selectedMembreId) { showToast("Choisissez votre nom.", "error"); return; }
    const notes = {};
    livreIds.forEach(id => {
      notes[id] = Number(document.getElementById(`bsl-${id}`).value);
    });
    try {
      await soumettreVote(voteActif.id, selectedMembreId, notes);
      document.querySelector(".bul-paper").innerHTML = `
        <div class="bul-success">
          <div class="bul-success-icon">✅</div>
          <div class="bul-success-title">Vote enregistré !</div>
          <div class="bul-success-sub">Votre bulletin pour ${formatMois(voteActif.mois, voteActif.annee)} a bien été pris en compte.</div>
          <div style="margin-top:1.4rem">
            <a href="votes.html" class="bul-back">← Retour aux votes</a>
          </div>
        </div>`;
    } catch (err) { showToast("Erreur : " + err.message, "error"); }
  });
}

function prefillIfAlreadyVoted() {
  const already = document.getElementById("bul-already");
  if (!already) return;
  const bulletins = voteActif.bulletins || {};
  const livreIds  = voteActif.livre_ids || [];
  const prev = selectedMembreId ? bulletins[selectedMembreId] : null;

  if (prev) {
    livreIds.forEach(id => {
      const n = prev[id];
      if (n !== undefined && n !== null) {
        const slider = document.getElementById(`bsl-${id}`);
        const disp   = document.getElementById(`bnd-${id}`);
        if (slider) { slider.value = n; disp.textContent = Number(n).toString(); }
      }
    });
    already.innerHTML = `<div class="bul-already">✓ Vous avez déjà soumis un vote — vous pouvez le modifier.</div>`;
  } else {
    already.innerHTML = '';
  }
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  [voteActif, membres, livres] = await Promise.all([getVoteActif(), getMembres(), getLivres()]);
  render();
}

init().catch(console.error);
