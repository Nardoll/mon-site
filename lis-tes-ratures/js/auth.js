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
        background: var(--bg, #f3e9da);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 1rem;
      }
      #auth-gate .gate-card {
        background: var(--surface, #fffaf1);
        border: 1px solid var(--border, #e4d5be);
        border-radius: var(--r, 10px);
        padding: 2.5rem 3rem;
        width: 100%; max-width: 360px;
        text-align: center;
        box-shadow: 0 4px 24px oklch(from var(--accent, #b5572d) l c h / .08);
      }
      #auth-gate .gate-logo {
        font-family: Georgia, 'Iowan Old Style', serif;
        font-size: 1.4rem;
        color: var(--text, #2c2015);
        margin-bottom: .25rem;
      }
      #auth-gate .gate-logo .rature {
        text-decoration: line-through;
        text-decoration-color: var(--accent, #b5572d);
        text-decoration-thickness: 2px;
      }
      #auth-gate p {
        font-size: .82rem;
        color: var(--muted, #8a7560);
        margin-bottom: 1.75rem;
        font-family: 'Segoe UI', system-ui;
      }
      #auth-gate input {
        width: 100%; background: var(--bg, #f3e9da);
        border: 1.5px solid var(--border, #e4d5be);
        border-radius: 6px;
        color: var(--text, #2c2015);
        padding: .6rem .9rem;
        font-size: .95rem;
        font-family: 'Segoe UI', system-ui;
        text-align: center;
        letter-spacing: .1em;
        transition: border-color .15s;
        margin-bottom: .75rem;
        box-sizing: border-box;
      }
      #auth-gate input:focus { outline: none; border-color: var(--accent, #b5572d); }
      #auth-gate button {
        width: 100%;
        background: var(--accent, #b5572d);
        color: #fff;
        border: none; border-radius: 6px;
        padding: .65rem;
        font-size: .9rem; font-weight: 600;
        cursor: pointer;
        font-family: 'Segoe UI', system-ui;
        transition: opacity .15s;
      }
      #auth-gate button:hover { opacity: .88; }
      #auth-gate button:disabled { opacity: .55; cursor: default; }
      #auth-gate .gate-error {
        font-size: .8rem;
        color: var(--red, #d43565);
        margin-top: .6rem;
        min-height: 1.2em;
        font-family: 'Segoe UI', system-ui;
      }
    </style>
    <div class="gate-card">
      <div class="gate-logo">Lis tes <span class="rature">ratures</span></div>
      <p>Espace privé — mot de passe requis</p>
      <input type="password" id="gate-input" placeholder="••••••••" autocomplete="current-password">
      <button id="gate-btn">Entrer</button>
      <div class="gate-error" id="gate-error"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#gate-input");
  const btn   = overlay.querySelector("#gate-btn");
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
