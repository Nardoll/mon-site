export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateShort(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateISO(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

export function dateToISOToday() {
  return new Date().toISOString().slice(0, 10);
}

export function showToast(msg, type = "success") {
  const existing = document.getElementById("at-toast");
  if (existing) existing.remove();
  const t = document.createElement("div");
  t.id = "at-toast";
  t.className = `at-toast at-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("at-toast-show"));
  setTimeout(() => {
    t.classList.remove("at-toast-show");
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function pickRandom(arr, n = 1) {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return n === 1 ? result[0] : result;
}

export function weightedRandom(weights) {
  const keys = Object.keys(weights);
  const vals = keys.map(k => weights[k]);
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) return keys[Math.floor(Math.random() * keys.length)];
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= vals[i];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}
