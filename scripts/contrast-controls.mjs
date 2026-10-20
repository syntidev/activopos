// Contraste de los tokens de control (WCAG 1.4.11 / 1.4.3) por tema.
// Uso:  node scripts/contrast-controls.mjs [--full]
// Compara el tokens.css de HEAD (antes) con el del árbol de trabajo (después).
// Falla (exit 1) si algún criterio "después" no cumple.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const COLORS = ['azul-sereno', 'amanecer', 'aguamarina', 'medianoche', 'tierra-dorada', 'brasa-viva', 'cielo-abierto', 'menta-fresca', 'champan', 'jardin']
const FULL = process.argv.includes('--full')

function parseBlocks(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) {
    const selectors = m[1].split(',').map(s => s.trim().replace(/\s+/g, ' '))
    const decls = {}
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':')
      if (i > 0 && d.trim().startsWith('--')) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim()
    }
    if (Object.keys(decls).length) blocks.push({ selectors, decls })
  }
  return blocks
}

function contextVars(blocks, mode, color) {
  const has = (b, f) => b.selectors.some(f)
  const vars = {}
  const apply = b => Object.assign(vars, b.decls)
  blocks.filter(b => has(b, s => s === ':root' || s === '[data-theme="light"]')).forEach(apply)
  if (mode === 'dark') blocks.filter(b => has(b, s => s === '[data-theme="dark"]')).forEach(apply)
  blocks.filter(b => has(b, s => s === '#dashboard-root')).forEach(apply)
  if (color) {
    blocks.filter(b => has(b, s => s === `#dashboard-root[data-color="${color}"]`)).forEach(apply)
    if (mode === 'dark') blocks.filter(b => has(b, s => s === `[data-theme="dark"] #dashboard-root[data-color="${color}"]`)).forEach(apply)
  }
  return vars
}

function resolve(vars, v, depth = 0) {
  if (depth > 20) throw new Error('var() circular: ' + v)
  return v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fb) => {
    if (vars[name] !== undefined) return resolve(vars, vars[name], depth + 1)
    if (fb) return resolve(vars, fb, depth + 1)
    throw new Error('token sin definir: ' + name)
  })
}

function parseColor(str) {
  str = str.trim()
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str)
  if (m) {
    let h = m[1]
    if (h.length === 3) h = [...h].map(c => c + c).join('')
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/i.exec(str)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  throw new Error('color no soportado: ' + str)
}

const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
})
const lum = ({ r, g, b }) => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const x = lum(a), y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// Cada criterio: fg token, fondos contra los que se mide, mínimo exigido.
// before/after: tokens que realmente consumían / consumen los controles.
// En "bgs", "a|b" = a en antes, b en después (el fondo del input se llamaba distinto).
const CRITERIA = [
  { id: 'Borde input/select/textarea', min: 3, before: { fg: '--border-input' }, after: { fg: '--ctl-border' }, bgs: ['--bg-card', '--bg-base', '--bg-input|--ctl-bg'] },
  { id: 'Borde botón secundario', min: 3, before: { fg: '--color-border' }, after: { fg: '--ctl-border-strong' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Anillo de foco (2px)', min: 3, before: { fg: '--border-input-focus' }, after: { fg: '--ctl-focus-ring' }, bgs: ['--bg-card', '--bg-base', '--bg-input|--ctl-bg'] },
  { id: 'Placeholder', min: 4.5, before: { fg: '--text-tertiary' }, after: { fg: '--ctl-placeholder' }, bgs: ['--bg-input|--ctl-bg'] },
  { id: 'Pestaña inactiva (texto)', min: 4.5, before: { fg: '--text-tertiary' }, after: { fg: '--ctl-tab-text' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Pestaña activa subrayada (texto)', min: 4.5, before: { fg: '--color-brand' }, after: { fg: '--ctl-tab-underline-text' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Pestaña activa subrayada (línea)', min: 3, before: { fg: '--color-brand' }, after: { fg: '--ctl-tab-indicator' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Pestaña activa rellena (texto/fondo)', min: 4.5, before: { fg: '--color-brand', bg: '--color-surface' }, after: { fg: '--ctl-tab-active-text', bg: '--ctl-tab-active-bg' } },
  { id: 'Toggle apagado (track)', min: 3, before: { fg: '--border-input' }, after: { fg: '--ctl-toggle-off' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Toggle apagado (thumb sobre track)', min: 3, before: { fg: '--text-tertiary', bg: '--bg-input' }, after: { fg: '--ctl-toggle-thumb', bg: '--ctl-toggle-off' } },
  { id: 'Toggle encendido (track)', min: 3, before: { fg: '--color-brand' }, after: { fg: '--ctl-toggle-on' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Toggle encendido (thumb sobre track)', min: 3, before: { fg: '--bg-card', bg: '--color-brand' }, after: { fg: '--ctl-toggle-thumb', bg: '--ctl-toggle-on' } },
  { id: 'Checkbox/radio (borde 2px)', min: 3, before: { fg: '--border-input' }, after: { fg: '--ctl-check-border' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Checkbox/radio marcado (relleno)', min: 3, before: { fg: '--color-brand' }, after: { fg: '--ctl-check-on' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Checkbox/radio marcado (check sobre relleno)', min: 3, before: { fg: '--bg-card', bg: '--color-brand' }, after: { fg: '--ctl-check-mark', bg: '--ctl-check-on' } },
  { id: 'Icono de botón sin texto (1.4.11)', min: 3, before: { fg: '--color-text-muted' }, after: { fg: '--ctl-icon' }, bgs: ['--bg-card', '--bg-base'] },
  { id: 'Botón primario (texto sobre relleno)', min: 4.5, before: { fg: '--color-text-on-brand', bg: '--color-brand' }, after: { fg: '--ctl-on-accent', bg: '--ctl-accent' } },
]

function colorOf(vars, token, bgFallback) {
  const c = parseColor(resolve(vars, `var(${token})`))
  return c.a < 1 ? over(c, bgFallback) : c
}

function measure(blocks, side, crit, mode, color) {
  const vars = contextVars(blocks, mode, color)
  const page = parseColor(resolve(vars, 'var(--bg-base)'))
  const spec = crit[side]
  const bgList = spec.bg ? [spec.bg] : crit.bgs.map(t => (t.includes('|') ? t.split('|')[side === 'before' ? 0 : 1] : t))
  let worst = Infinity
  for (const bgToken of bgList) {
    const bg = colorOf(vars, bgToken, page)
    const fg = colorOf(vars, spec.fg, bg)
    worst = Math.min(worst, ratio(fg, bg))
  }
  return worst
}

const after = parseBlocks(readFileSync('src/styles/tokens.css', 'utf8'))
let before = null
try {
  before = parseBlocks(execFileSync('git', ['show', 'HEAD:src/styles/tokens.css'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
} catch { /* sin git: solo "después" */ }

const contexts = []
for (const mode of ['light', 'dark']) {
  contexts.push({ mode, color: null, label: `${mode}/base` })
  for (const c of COLORS) contexts.push({ mode, color: c, label: `${mode}/${c}` })
}

let failures = 0
const rows = []
for (const crit of CRITERIA) {
  const perCtx = contexts.map(ctx => ({
    ctx: ctx.label,
    a: measure(after, 'after', crit, ctx.mode, ctx.color),
    b: before ? measure(before, 'before', crit, ctx.mode, ctx.color) : NaN,
  }))
  const minA = Math.min(...perCtx.map(r => r.a))
  const minB = before ? Math.min(...perCtx.map(r => r.b)) : NaN
  const ok = minA + 1e-9 >= crit.min
  if (!ok) failures++
  rows.push({ crit, perCtx, minA, minB, ok })
}

const f = n => (Number.isNaN(n) ? '  - ' : n.toFixed(2).padStart(5))
console.log(`Contraste de controles. Contextos: ${contexts.length} (light/dark x base + ${COLORS.length} temas de color)\n`)
console.log('| Criterio | Mín. | Antes (peor ctx) | Después (peor ctx) | Estado |')
console.log('|---|---|---|---|---|')
for (const r of rows) {
  console.log(`| ${r.crit.id} | ${r.crit.min}:1 | ${f(r.minB)} | ${f(r.minA)} | ${r.ok ? 'OK' : 'FALLA'} |`)
}
if (FULL) {
  console.log('\nDetalle por contexto (después / antes):')
  for (const r of rows) {
    console.log(`\n${r.crit.id} (mín ${r.crit.min}:1)`)
    for (const c of r.perCtx) console.log(`  ${c.ctx.padEnd(24)} ${f(c.a)}  /  ${f(c.b)}${c.a + 1e-9 < r.crit.min ? '   <-- FALLA' : ''}`)
  }
}
if (failures) {
  console.error(`\n${failures} criterio(s) fuera de mínimo.`)
  process.exit(1)
}
console.log('\nTodos los criterios cumplen en todos los contextos.')
