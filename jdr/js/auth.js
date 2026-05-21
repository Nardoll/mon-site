const HASH = "1acdb3aa2fe5a0872845aac6436856fc381ff742686abc7c8eda579a5b053fcb";
const SESSION_KEY = "jdr_auth";

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function requireAuth(onUnlock) {
  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    onUnlock();
    return;
  }

  const gate = document.createElement("div");
  gate.id = "auth-gate";
  gate.innerHTML = `
    <div class="gate-card">
      <span class="gate-icon">🎲</span>
      <h2>Jeux de rôle</h2>
      <p>Espace privé — mot de passe requis</p>
      <input type="password" id="gate-input" placeholder="••••••••" autocomplete="current-password">
      <button id="gate-btn">Entrer</button>
      <div class="gate-error" id="gate-error"></div>
    </div>`;
  document.body.appendChild(gate);

  const input = document.getElementById("gate-input");
  const btn = document.getElementById("gate-btn");
  const error = document.getElementById("gate-error");
  input.focus();

  async function attempt() {
    const val = input.value;
    if (!val) return;
    btn.disabled = true;
    btn.textContent = "…";
    const h = await sha256(val);
    if (h === HASH) {
      sessionStorage.setItem(SESSION_KEY, "1");
      gate.remove();
      onUnlock();
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
