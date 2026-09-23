// Safe storage: falls back to in-memory when localStorage is unavailable
// (e.g. inside the sandboxed preview iframe).
const mem = {}
let impl = null
try {
  window.localStorage.setItem('__bd_t', '1')
  window.localStorage.removeItem('__bd_t')
  impl = window.localStorage
} catch { impl = null }

export const store = {
  getItem: (k) => (impl ? impl.getItem(k) : (mem[k] ?? null)),
  setItem: (k, v) => { if (impl) impl.setItem(k, v); else mem[k] = String(v) },
  removeItem: (k) => { if (impl) impl.removeItem(k); else delete mem[k] },
}
