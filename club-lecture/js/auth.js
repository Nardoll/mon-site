const HASH = "fa9e4e15fe0b8512d702a5ea7746373ff20539e21054e9c6ab251b5452ac8c6d";
const SESSION_KEY = "cl_auth";

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
        background: #0f0f0f;
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 1rem;
      }
      #auth-gate .gate-card {
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 2.5rem 3rem;
        width: 100%; max-width: 380px;
        text-align: center;
      }
      #auth-gate .gate-icon { font-size: 2rem; margin-bottom: 1rem; display: block; }
      #auth-gate h2 { font-size: 1.1rem; font-weight: 700; color: #e0e0e0; margin-bottom: .35rem; font-family: 'Segoe UI', sans-serif; }
      #auth-gate p { font-size: .83rem; color: #888; margin-bottom: 1.5rem; font-family: 'Segoe UI', sans-serif; }
      #auth-gate input {
        width: 100%; background: #111; border: 1px solid #2a2a2a;
        border-radius: 6px; color: #e0e0e0; padding: .6rem .8rem;
        font-size: .95rem; font-family: 'Segoe UI', sans-serif;
        text-align: center; letter-spacing: .1em;
        transition: border-color .15s; margin-bottom: .75rem;
      }
      #auth-gate input:focus { outline: none; border-color: #e8a44a; }
      #auth-gate button {
        width: 100%; background: #e8a44a; color: #1a1000;
        border: none; border-radius: 6px; padding: .6rem;
        font-size: .9rem; font-weight: 600; cursor: pointer;
        font-family: 'Segoe UI', sans-serif; transition: background .15s;
      }
      #auth-gate button:hover { background: #f0b55a; }
      #auth-gate .gate-error { font-size: .8rem; color: #cf6679; margin-top: .5rem; min-height: 1.2em; }
    </style>
    <div class="gate-card">
      <span class="gate-icon">🔒</span>
      <h2>Club de lecture</h2>
      <p>Espace privé — mot de passe requis</p>
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
