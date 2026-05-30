const HASH = "338ec34fc7ae19b157ed2725b46dfcb3b932d148574e6cef3fd7149f03451b7d";
const SESSION_KEY = "perso_auth";

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

function showGate() {
  const overlay = document.createElement("div");
  overlay.id = "auth-gate";
  overlay.innerHTML = `
    <style>
      #auth-gate {
        position: fixed; inset: 0;
        background: #070d0c;
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 1rem;
      }
      #auth-gate .gate-card {
        background: #101a19;
        border: 1px solid #1c2c2b;
        border-radius: 12px;
        padding: 2.5rem 3rem;
        width: 100%; max-width: 360px;
        text-align: center;
      }
      #auth-gate .gate-icon { font-size: 2rem; margin-bottom: 1rem; display: block; }
      #auth-gate h2 { font-size: 1.05rem; font-weight: 700; color: #d4e0df; margin-bottom: .3rem; font-family: 'Segoe UI', sans-serif; }
      #auth-gate p { font-size: .82rem; color: #5f9ea0; margin-bottom: 1.5rem; font-family: 'Segoe UI', sans-serif; }
      #auth-gate input {
        width: 100%; background: #0a1312; border: 1px solid #1c2c2b;
        border-radius: 6px; color: #d4e0df; padding: .6rem .8rem;
        font-size: .95rem; font-family: 'Segoe UI', sans-serif;
        text-align: center; letter-spacing: .1em;
        transition: border-color .15s; margin-bottom: .75rem;
        outline: none;
      }
      #auth-gate input:focus { border-color: #14b8a6; }
      #auth-gate button {
        width: 100%; background: #14b8a6; color: #022b27;
        border: none; border-radius: 6px; padding: .6rem;
        font-size: .9rem; font-weight: 700; cursor: pointer;
        font-family: 'Segoe UI', sans-serif; transition: background .15s;
      }
      #auth-gate button:hover { background: #0d9488; }
      #auth-gate .gate-error { font-size: .8rem; color: #f87171; margin-top: .5rem; min-height: 1.2em; }
    </style>
    <div class="gate-card">
      <span class="gate-icon">🔒</span>
      <h2>Espace personnel</h2>
      <p>Accès privé — mot de passe requis</p>
      <input type="password" id="gate-input" placeholder="••••••••" autocomplete="current-password">
      <button id="gate-btn">Entrer</button>
      <div class="gate-error" id="gate-error"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#gate-input");
  const btn = overlay.querySelector("#gate-btn");
  const error = overlay.querySelector("#gate-error");

  input.focus();

  async function attempt() {
    const val = input.value;
    if (!val) return;
    btn.disabled = true;
    btn.textContent = "…";
    const h = await sha256(val);
    if (h === HASH) {
      sessionStorage.setItem(SESSION_KEY, "1");
      overlay.remove();
    } else {
      error.textContent = "Mot de passe incorrect.";
      input.value = "";
      input.focus();
      btn.disabled = false;
      btn.textContent = "Entrer";
    }
  }

  btn.addEventListener("click", attempt);
  input.addEventListener("keydown", e => { if (e.key === "Enter") attempt(); });
}

export async function requireAuth() {
  if (!isAuthenticated()) {
    showGate();
    await new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (!document.getElementById("auth-gate")) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true });
    });
  }
}
