const KEY_ID   = 'prono_profile_id';
const KEY_NAME = 'prono_profile_name';

export function getLocalProfile() {
  const id   = localStorage.getItem(KEY_ID);
  const name = localStorage.getItem(KEY_NAME);
  return id && name ? { id, name } : null;
}

export function setLocalProfile(id, name) {
  localStorage.setItem(KEY_ID, id);
  localStorage.setItem(KEY_NAME, name);
}

export function clearLocalProfile() {
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_NAME);
}

export async function requireProfile(onReady) {
  const profile = getLocalProfile();
  if (profile) { onReady(profile); return; }
  showProfileModal(onReady);
}

async function showProfileModal(onReady) {
  const { getProfiles, createProfile } = await import('./db.js');

  const overlay = document.createElement('div');
  overlay.className = 'profile-overlay';
  overlay.innerHTML = `
    <div class="profile-modal">
      <div class="profile-logo">
        <span class="profile-logo-icon">⚡</span>
        <div class="profile-logo-title">Pronostics LoL</div>
        <div class="profile-logo-sub">MSI · Worlds · Compétitions régionales</div>
      </div>
      <div class="profile-tabs">
        <button class="profile-tab active" data-tab="login">Se connecter</button>
        <button class="profile-tab" data-tab="create">Créer un profil</button>
      </div>
      <div id="tab-login" class="profile-section">
        <div>
          <div class="profile-label">Choisir son profil</div>
          <select class="profile-select" id="prof-select">
            <option value="">Chargement…</option>
          </select>
        </div>
        <button class="btn-primary" id="btn-login">Jouer →</button>
      </div>
      <div id="tab-create" class="profile-section hidden">
        <div>
          <div class="profile-label">Ton prénom ou pseudo</div>
          <input class="profile-input" id="prof-name" type="text"
            placeholder="Ex : Tom" maxlength="20" autocomplete="off" />
        </div>
        <button class="btn-primary" id="btn-create">Créer mon profil →</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Charger les profils existants
  getProfiles().then(profiles => {
    const sel = document.getElementById('prof-select');
    sel.innerHTML = profiles.length === 0
      ? '<option value="">Aucun profil — crée le tien !</option>'
      : '<option value="">— Choisir —</option>' +
        profiles.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  });

  // Tabs
  overlay.querySelectorAll('.profile-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const t = btn.dataset.tab;
      document.getElementById('tab-login').classList.toggle('hidden', t !== 'login');
      document.getElementById('tab-create').classList.toggle('hidden', t !== 'create');
    });
  });

  // Connexion
  document.getElementById('btn-login').addEventListener('click', () => {
    const sel = document.getElementById('prof-select');
    if (!sel.value) return;
    const name = sel.options[sel.selectedIndex].text;
    setLocalProfile(sel.value, name);
    overlay.remove();
    onReady({ id: sel.value, name });
  });

  // Création
  const btnCreate = document.getElementById('btn-create');
  btnCreate.addEventListener('click', async () => {
    const input = document.getElementById('prof-name');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    btnCreate.disabled = true;
    btnCreate.textContent = 'Création…';
    try {
      const id = await createProfile(name);
      setLocalProfile(id, name);
      overlay.remove();
      onReady({ id, name });
    } catch (e) {
      btnCreate.disabled = false;
      btnCreate.textContent = 'Créer mon profil →';
    }
  });

  document.getElementById('prof-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') btnCreate.click();
  });
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
