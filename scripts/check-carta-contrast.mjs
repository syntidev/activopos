// Verifica contraste AA (4.5:1) de cada preset y de cada acento de la Carta leyendo src/styles/tokens.css.
// Uso: node scripts/check-carta-contrast.mjs   -> codigo 1 si algun par queda bajo 4.5:1.
import { readFileSync } from "node:fs"

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8")
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const vars = body => Object.fromEntries([...body.matchAll(/--carta-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2].toUpperCase()]))
const blocks = [...css.matchAll(/(\[data-carta-[^{]+\])\s*\{([^}]*)\}/g)].map(m => ({ sel: m[1], vars: vars(m[2]) }))

const presets = Object.fromEntries(blocks.filter(b => /^\[data-carta-preset="\w+"\]$/.test(b.sel)).map(b => [b.sel.match(/"(\w+)"/)[1], b.vars]))
const accents = blocks.filter(b => /accent/.test(b.sel)).map(b => ({ preset: b.sel.match(/preset="(\w+)"/)[1], name: b.sel.match(/accent="(\w+)"/)[1], vars: b.vars }))

const PARES = [
  ["tinta", "papel"], ["tinta", "card"], ["tinta-2", "papel"], ["tinta-2", "card"], ["muted", "papel"], ["muted", "card"], ["tinta", "strip"],
  ["acento", "papel"], ["acento", "card"], ["sobre-acento", "acento"],
  ["ok", "ok-soft"], ["aji", "aji-soft"], ["oro", "oro-soft"], ["neutro", "neutro-soft"], ["sobre-fab", "fab"],
]
let fallos = 0
const check = (etiqueta, v) => {
  for (const [fg, bg] of PARES) {
    if (!v[fg] || !v[bg]) continue
    const r = ratio(v[fg], v[bg])
    if (r < 4.5) { fallos++; console.log("FALLA", etiqueta, fg + " sobre " + bg, r.toFixed(2)) }
  }
}
for (const [name, v] of Object.entries(presets)) { check("preset " + name, v); console.log("ok   preset", name) }
for (const a of accents) { check("acento " + a.preset + "/" + a.name, { ...presets[a.preset], ...a.vars }); console.log("ok   acento", a.preset + "/" + a.name) }
console.log(fallos === 0 ? "AA OK" : "FALLOS=" + fallos)
process.exit(fallos === 0 ? 0 : 1)
