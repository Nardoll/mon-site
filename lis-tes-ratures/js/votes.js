import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import {
  getLivres, getMembres, getVotes, getVoteActif,
  lancerVote, annulerVoteActif, cloturerVoteActif,
} from "./db.js";
import { formatMois, MOIS_NOMS, showToast } from "./utils.js";

await requireAuth();
initNav("votes");

// ── State ─────────────────────────────────────────────────────────────
let voteActif = null, votes = [], livres = [], membres = [];
let launchEchelle = 5;

// ── Helpers ───────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toDate(ts) { return ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null; }

function calculerResultats(bulletins, livreIds) {
  return livreIds.map(id => {
    const livre = livres.find(l => l.id === id);
    const notes = {};
    let sum = 0, count = 0;
    for (const [memId, bul] of Object.entries(bulletins)) {
      const n = bul[id];
      if (n !== undefined && n !== null && n !== '') {
        notes[memId] = Number(n);
        sum += Number(n);
        count++;
      }
    }
    return {
      livre_id: id,
      titre:    livre?.titre  ?? id,
      auteur:   livre?.auteur ?? '',
      notes,
      moyenne: count > 0 ? Math.round(sum / count * 100) / 100 : null,
    };
  }).sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
}

// ── Render : vote actif ou formulaire lancement ───────────────────────
function renderActif() {
  const mount = document.getElementById("actif-mount");

  if (voteActif) {
    const isTour2    = voteActif.tour === 2;
    const livreIds   = voteActif.livre_ids   || [];
    const bulletins  = voteActif.bulletins   || {};
    const membreIds  = voteActif.membre_ids  || [];
    const submitted  = Object.keys(bulletins);
    const pct        = membreIds.length ? Math.round(submitted.length / membreIds.length * 100) : 0;
    const deadline   = toDate(voteActif.expires_at);
    const dlStr      = deadline ? deadline.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '—';
    const daysLeft   = deadline ? Math.ceil((deadline - new Date()) / 864e5) : null;
    const dlSuffix   = daysLeft !== null
      ? daysLeft > 0  ? ` <span style="color:var(--accent);">(dans ${daysLeft} jour${daysLeft>1?'s':''})</span>`
      : daysLeft === 0 ? ` <span style="color:var(--accent);">(aujourd'hui)</span>`
      : ` <span style="color:var(--red)">(dépassée)</span>` : '';

    mount.innerHTML = `
      <div class="vac">
        <div class="vac-head">
          <div>
            <div class="vac-title">Vote en cours${isTour2 ? ' — Tour 2' : ''}</div>
            <div class="vac-sub">${formatMois(voteActif.mois, voteActif.annee)}</div>
          </div>
          <span class="vac-pill${isTour2?' t2':''}">
            ${isTour2
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> 2ème tour'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg> Vote actif'}
          </span>
        </div>

        <div class="vac-deadline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          Deadline :&nbsp;<b>${dlStr}</b>${dlSuffix}
        </div>

        <div class="vac-livres">
          ${livreIds.map(id => {
            const l = livres.find(b => b.id === id);
            return `<div class="vac-livre">
              <div class="vac-livre-title">${esc(l?.titre ?? id)}</div>
              ${l?.auteur ? `<div class="vac-livre-author">${esc(l.auteur)}</div>` : ''}
            </div>`;
          }).join('')}
        </div>

        <div class="vac-prog-label">Bulletins soumis — ${submitted.length} / ${membreIds.length}</div>
        <div class="vac-prog-bar"><div class="vac-prog-fill" style="width:${pct}%"></div></div>
        <div class="vac-bul-grid">
          ${membreIds.map(id => {
            const done = submitted.includes(id);
            const m = membres.find(x => x.id === id);
            return `<div class="vac-bul-item">
              <span class="vac-dot ${done?'done':'todo'}"></span>
              <span>${esc(m?.nom ?? id)}</span>
              ${done ? '<span class="vac-bul-ok">✓</span>' : ''}
            </div>`;
          }).join('')}
        </div>

        <div class="vac-actions">
          <a href="vote.html" class="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>
            Mon bulletin
          </a>
          <button class="btn btn-secondary" id="btn-cloture">Clôturer le vote</button>
          <button class="btn btn-danger" id="btn-annuler">Annuler</button>
        </div>
      </div>`;

    document.getElementById("btn-cloture").addEventListener("click", openCloture);
    document.getElementById("btn-annuler").addEventListener("click", async () => {
      if (!confirm(`Annuler le vote de ${formatMois(voteActif.mois, voteActif.annee)} ? Cette action est irréversible.`)) return;
      try {
        await annulerVoteActif(voteActif.id);
        showToast("Vote annulé.", "info");
        await reload();
      } catch (e) { showToast("Erreur : " + e.message, "error"); }
    });

  } else {
    // Formulaire lancement
    const props = livres.filter(l => l.statut === "en_proposition");
    const next  = nextVoteMois();
    const defaultDeadline = new Date(next.annee, next.mois - 1, 28).toISOString().split('T')[0];

    mount.innerHTML = `
      <div class="launch-card">
        <div class="launch-title">Lancer un nouveau vote</div>
        <div class="launch-grid">
          <div>
            <label class="lbl">Mois</label>
            <select class="form-select" id="lv-mois">
              ${MOIS_NOMS.map((n,i) => `<option value="${i+1}" ${i+1===next.mois?'selected':''}>${n}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="lbl">Année</label>
            <input class="form-input" type="number" id="lv-annee" value="${next.annee}" min="2020" max="2050" />
          </div>
          <div>
            <label class="lbl">Échelle de notation</label>
            <div class="echelle-row" id="lv-echelle">
              <button class="ech-btn on" data-v="5" type="button">sur 5</button>
              <button class="ech-btn" data-v="10" type="button">sur 10</button>
            </div>
          </div>
          <div>
            <label class="lbl">Deadline</label>
            <input class="form-input" type="date" id="lv-deadline" value="${defaultDeadline}" />
          </div>
          <div class="launch-full">
            <label class="lbl">Livres en jeu${props.length ? ` (${props.length} proposition${props.length>1?'s':''})` : ''}</label>
            <div class="lv-checks" id="lv-livres">
              ${props.length
                ? props.map(l => `<label class="lv-check">
                    <input type="checkbox" value="${l.id}" />
                    <span class="lvc-title">${esc(l.titre)}</span>
                    ${l.auteur ? `<span class="lvc-author">— ${esc(l.auteur)}</span>` : ''}
                  </label>`).join('')
                : '<span class="lv-empty-props">Aucun livre en proposition.</span>'}
            </div>
          </div>
          <div class="launch-full">
            <label class="lbl">Membres participants</label>
            <div class="mem-chips" id="lv-membres">
              ${membres.map(m => `<button class="mem-chip on" data-id="${m.id}" type="button">${esc(m.nom)}</button>`).join('')}
            </div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-primary" id="btn-lancer">Lancer le vote →</button>
        </div>
      </div>`;

    launchEchelle = 5;

    document.getElementById("lv-echelle").addEventListener("click", e => {
      const btn = e.target.closest(".ech-btn[data-v]");
      if (!btn) return;
      launchEchelle = Number(btn.dataset.v);
      document.querySelectorAll("#lv-echelle .ech-btn").forEach(b => b.classList.toggle("on", b === btn));
    });

    document.getElementById("lv-membres").addEventListener("click", e => {
      const chip = e.target.closest(".mem-chip[data-id]");
      if (chip) chip.classList.toggle("on");
    });

    document.getElementById("btn-lancer").addEventListener("click", async () => {
      const mois       = Number(document.getElementById("lv-mois").value);
      const annee      = Number(document.getElementById("lv-annee").value);
      const deadline   = document.getElementById("lv-deadline").value;
      const livreIds   = [...document.querySelectorAll("#lv-livres input[type=checkbox]:checked")].map(c => c.value);
      const membreIds  = [...document.querySelectorAll("#lv-membres .mem-chip.on")].map(c => c.dataset.id);
      if (!livreIds.length)  { showToast("Sélectionnez au moins un livre.", "error");  return; }
      if (!membreIds.length) { showToast("Sélectionnez au moins un membre.", "error"); return; }
      if (!deadline)         { showToast("Choisissez une deadline.", "error");          return; }
      try {
        await lancerVote({ mois, annee, livre_ids: livreIds, membre_ids: membreIds, echelle: launchEchelle, expires_at: new Date(deadline + 'T23:59:59') });
        showToast("Vote lancé !", "success");
        await reload();
      } catch (e) { showToast("Erreur : " + e.message, "error"); }
    });
  }
}

// ── Render : historique ───────────────────────────────────────────────
function renderHisto() {
  const mount = document.getElementById("histo-mount");
  if (!votes.length) {
    mount.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:.3rem 0">Aucun vote archivé pour l\'instant.</div>';
    return;
  }

  mount.innerHTML = `<div class="vh-list">${votes.map(v => {
    const resultats = [...(v.resultats || [])].sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
    const allNotes  = resultats.flatMap(r => Object.values(r.notes || {})).map(Number).filter(n => !isNaN(n));
    const echelle   = allNotes.length && Math.max(...allNotes) <= 5 ? 5 : 10;
    const eluR      = resultats.find(r => r.livre_id === v.livre_elu);
    const eluLivre  = livres.find(l => l.id === v.livre_elu);
    const eluTitre  = eluR?.titre ?? eluLivre?.titre ?? '—';
    const memCols   = membres.filter(m => resultats.some(r => m.id in (r.notes ?? {})));

    return `<div class="vh-card" id="vh-${v.id}">
      <div class="vh-head" data-id="${v.id}">
        <span class="vh-chev">▶</span>
        <span class="vh-mois">${formatMois(v.mois, v.annee)}</span>
        ${v.livre_elu
          ? `<span class="vh-elu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
              ${esc(eluTitre)}</span>`
          : '<span class="vh-no-elu">Aucun élu</span>'}
      </div>
      <div class="vh-body">
        ${v.tour2 ? `<div class="vh-t2note">⚡ 2ème tour — résultats du tour final affichés</div>` : ''}
        ${resultats.length
          ? `<div style="overflow-x:auto">
              <table class="vh-table">
                <thead><tr>
                  <th>Livre</th>
                  ${memCols.map(m => `<th class="c">${esc(m.nom.split(' ')[0])}</th>`).join('')}
                  <th class="c">Moyenne</th>
                </tr></thead>
                <tbody>${resultats.map(r => `<tr class="${r.livre_id === v.livre_elu ? 'elu' : ''}">
                  <td class="col-titre">${esc(r.titre)}${r.auteur ? `<br><span style="font-size:.73rem;color:var(--muted)">${esc(r.auteur)}</span>` : ''}</td>
                  ${memCols.map(m => {
                    const n = r.notes?.[m.id];
                    const val = (n !== undefined && n !== null && n !== '') ? Number(n).toFixed(1) : null;
                    return `<td class="c">${val ? val : '<span class="vh-abs">—</span>'}</td>`;
                  }).join('')}
                  <td class="vh-moy">${r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(2) : '—'}<span style="font-size:.62rem;color:var(--muted);font-weight:400">/${echelle}</span></td>
                </tr>`).join('')}</tbody>
              </table>
            </div>`
          : '<div style="color:var(--muted);font-size:.83rem">Aucun résultat enregistré.</div>'}
      </div>
    </div>`;
  }).join('')}</div>`;

  document.querySelectorAll(".vh-head[data-id]").forEach(head => {
    head.addEventListener("click", () => {
      document.getElementById(`vh-${head.dataset.id}`).classList.toggle("open");
    });
  });
}

// ── Modal clôture ─────────────────────────────────────────────────────
function openCloture() {
  const bulletins  = voteActif.bulletins  || {};
  const livreIds   = voteActif.livre_ids  || [];
  const echelle    = voteActif.echelle    || 5;
  const resultats  = calculerResultats(bulletins, livreIds);
  const nbBulletins = Object.keys(bulletins).length;

  const modal = document.getElementById("cloture-modal");
  modal.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.3rem">
      <h2>Clôturer le vote</h2>
      <button class="modal-close" id="cl-close">✕</button>
    </div>
    <p class="sub">Résultats calculés sur ${nbBulletins} bulletin${nbBulletins>1?'s':''} soumis. Vérifiez et confirmez le livre élu.</p>
    <div class="cl-results">
      ${resultats.map((r, i) => `
        <div class="cl-row ${i===0?'top':''}">
          <span class="cl-rank ${i===0?'gold':''}">${i+1}</span>
          <span class="cl-titre">${esc(r.titre)}${r.auteur ? ` <span style="font-size:.73rem;font-weight:400;color:var(--muted)">— ${esc(r.auteur)}</span>` : ''}</span>
          <span class="cl-nb">${Object.keys(r.notes).length}/${nbBulletins}</span>
          <span class="cl-moy">${r.moyenne !== null ? r.moyenne.toFixed(2) : '—'}/${echelle}</span>
        </div>`).join('')}
    </div>
    <div class="cloture-winner">
      <label>Livre élu (pré-sélectionné : meilleure moyenne)</label>
      <select id="cl-elu-sel">
        <option value="">— Aucun livre élu —</option>
        ${resultats.map(r => `<option value="${r.livre_id}" ${r.livre_id === resultats[0]?.livre_id ? 'selected' : ''}>${esc(r.titre)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="cl-cancel">Annuler</button>
      <button class="btn btn-primary" id="cl-confirm">Valider et archiver →</button>
    </div>`;

  document.getElementById("cloture-overlay").classList.remove("hidden");

  const close = () => document.getElementById("cloture-overlay").classList.add("hidden");
  document.getElementById("cl-close").addEventListener("click", close);
  document.getElementById("cl-cancel").addEventListener("click", close);

  document.getElementById("cl-confirm").addEventListener("click", async () => {
    const livreElu = document.getElementById("cl-elu-sel").value || null;
    try {
      await cloturerVoteActif(voteActif.id, {
        mois:      voteActif.mois,
        annee:     voteActif.annee,
        resultats,
        livre_elu: livreElu,
        date:      new Date(),
        ...(voteActif.tour === 2 ? { tour2: { resultats_tour1: voteActif.resultats_tour1, livre_ids_tour1: voteActif.livre_ids_tour1 } } : {}),
      });
      close();
      showToast("Vote clôturé !", "success");
      await reload();
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
  });
}

document.getElementById("cloture-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.getElementById("cloture-overlay").classList.add("hidden");
});

// ── Helpers ───────────────────────────────────────────────────────────
function nextVoteMois() {
  if (votes.length) {
    const last = votes[0];
    let m = last.mois + 1, a = last.annee;
    if (m > 12) { m = 1; a++; }
    return { mois: m, annee: a };
  }
  const n = new Date();
  return { mois: n.getMonth() + 1, annee: n.getFullYear() };
}

// ── Init ──────────────────────────────────────────────────────────────
async function reload() {
  [voteActif, votes, livres, membres] = await Promise.all([
    getVoteActif(), getVotes(), getLivres(), getMembres(),
  ]);
  renderActif();
  renderHisto();
}

reload().catch(console.error);
