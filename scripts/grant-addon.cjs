'use strict'
/**
 * Concede un add-on (hoy solo 'kds') a una lista EXPLÍCITA de negocios. Planes v2: el KDS es un derecho (plan Operación o add-on de un
 * plan pago): los tenants que ya lo usan necesitan el add-on ANTES de desplegar, o pierden el acceso.
 *
 * NODE SIMPLE, sin ts-node ni dotenv: solo usa @prisma/client y @prisma/adapter-mariadb (dependencias de producción) y lee los .env a mano.
 *
 *   DRY-RUN (por defecto, no escribe nada):
 *     node scripts/grant-addon.cjs --addon kds --ids 4,8,33,55
 *   APLICAR (solo con --apply y --by <id de un super_admin>, que queda en el ActivityLog):
 *     node scripts/grant-addon.cjs --addon kds --ids 4,8,33,55 --apply --by <ID_SUPER_ADMIN>
 *
 * Por id imprime: nombre, plan, subscription_active, subscription_expires_at, si 'kds' está en modules_enabled y las ADVERTENCIAS
 * (plan gratis, suscripción suspendida o vencida, módulo apagado). La primera línea dice a qué base de datos se conecta.
 *
 * Reglas: sin ids no hace NADA (sale con error); nunca descubre negocios por su cuenta y NO contiene ids fijos; idempotente (si ya lo tiene
 * no cambia ni registra); un negocio en plan gratis se omite (el add-on no concede derecho sobre gratis); un ActivityLog 'addon_updated'
 * por negocio dentro de la misma transacción que el UPDATE. NO lo invoca ninguna migración ni el build: se corre a mano.
 */
const fs = require('fs')
const path = require('path')

// Deben coincidir con src/lib/plan-limits.ts (ADDON_KEYS, isPaidPlan): planes-v2.spec verifica que no se desalineen.
const ADDON_KEYS = ['kds']
const PAID_PLANS = ['negocio_activo', 'operacion']

/** Carga .env.production y luego .env (el primero que define una variable gana; nunca pisa lo que ya viene en el entorno). Igual que Next en producción. */
function loadEnv(root) {
  for (const file of ['.env.production', '.env']) {
    let text
    try { text = fs.readFileSync(path.join(root, file), 'utf8') } catch { continue }
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*#/.test(line)) continue
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
      if (!m) continue
      let v = m[2]
      if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1)
      else v = v.replace(/\s+#.*$/, '')
      if (process.env[m[1]] === undefined) process.env[m[1]] = v
    }
  }
}

function parseAddons(raw) {
  const set = new Set(String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean))
  return ADDON_KEYS.filter(k => set.has(k))
}
const serializeAddons = keys => ADDON_KEYS.filter(k => keys.includes(k)).join(',')

function parseArgs(argv) {
  const out = { addon: null, ids: [], apply: false, by: null, invalid: [] }
  const ids = new Set()
  const addId = raw => { if (/^\d+$/.test(raw) && Number(raw) > 0) ids.add(Number(raw)); else out.invalid.push(raw) }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') out.apply = true
    else if (a === '--addon') out.addon = argv[++i] ?? null
    else if (a === '--by') { const v = argv[++i] ?? ''; out.by = /^\d+$/.test(v) ? Number(v) : null; if (out.by === null) out.invalid.push(v || '--by') }
    else if (a === '--ids') (argv[++i] ?? '').split(',').filter(Boolean).forEach(addId)
    else if (/^\d+(,\d+)*$/.test(a)) a.split(',').forEach(addId)
    else out.invalid.push(a)
  }
  out.ids = Array.from(ids)
  return out
}

const ymd = d => (d ? d.toISOString().slice(0, 10) : null)

/** Lo que se muestra de un negocio y sus advertencias (lo que podría dejar al cliente sin KDS aunque tenga el add-on). */
function describe(b, addon, now = new Date()) {
  const modules = String(b.modules_enabled ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const kdsOn = modules.includes(addon)
  const warnings = []
  if (!PAID_PLANS.includes(b.catalog_plan)) warnings.push(`plan ${b.catalog_plan ?? 'gratis'}: el add-on NO concede derecho sobre gratis (se omite)`)
  if (!b.subscription_active) warnings.push('suscripción suspendida: sin derecho hasta reactivarla')
  else if (b.subscription_expires_at && now > b.subscription_expires_at) warnings.push(`suscripción vencida el ${ymd(b.subscription_expires_at)}: sin derecho hasta renovar`)
  if (!kdsOn) warnings.push(`${addon} apagado en modules_enabled: el tenant debe encenderlo en Configuración > Módulos (el add-on no basta)`)
  return { kdsOn, warnings }
}

function printBusiness(id, b, addon) {
  const d = describe(b, addon)
  console.log(`  #${id}  ${b.name}`)
  console.log(`      plan: ${b.catalog_plan ?? 'gratis'} | subscription_active: ${b.subscription_active ? 'sí' : 'NO'} | subscription_expires_at: ${ymd(b.subscription_expires_at) ?? 'sin vencimiento'}`)
  console.log(`      ${addon} en modules_enabled: ${d.kdsOn ? 'sí' : 'NO'} | add-ons actuales: [${parseAddons(b.addons).join(',')}]`)
  for (const w of d.warnings) console.log(`      ⚠ ${w}`)
}

function createPrisma() {
  const { PrismaClient } = require('@prisma/client')
  const { PrismaMariaDb } = require('@prisma/adapter-mariadb')
  const host = process.env.DB_HOST ?? '127.0.0.1'
  const isLoopback = host === '127.0.0.1' || host === 'localhost'
  const adapter = new PrismaMariaDb({
    host,
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'activopos',
    connectionLimit: 2,
    ...(isLoopback ? { allowPublicKeyRetrieval: true } : {}),
  })
  return new PrismaClient({ adapter, log: ['error'] })
}

const BUSINESS_SELECT = { id: true, name: true, catalog_plan: true, addons: true, modules_enabled: true, subscription_active: true, subscription_expires_at: true }

async function grantOne(prisma, id, addon, apply, by) {
  if (!apply) {
    const b = await prisma.business.findUnique({ where: { id }, select: BUSINESS_SELECT })
    if (!b) return { outcome: 'not_found' }
    printBusiness(id, b, addon)
    if (!PAID_PLANS.includes(b.catalog_plan)) return { outcome: 'skipped_free' }
    if (parseAddons(b.addons).includes(addon)) return { outcome: 'already' }
    return { outcome: 'would_grant', detail: `[${parseAddons(b.addons).join(',')}] → [${serializeAddons([...parseAddons(b.addons), addon])}]` }
  }

  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${id} FOR UPDATE`
    const b = await tx.business.findUnique({ where: { id }, select: BUSINESS_SELECT })
    if (!b) return { outcome: 'not_found' }
    printBusiness(id, b, addon)
    if (!PAID_PLANS.includes(b.catalog_plan)) return { outcome: 'skipped_free' }
    const prev = parseAddons(b.addons)
    if (prev.includes(addon)) return { outcome: 'already' }
    const next = parseAddons(serializeAddons([...prev, addon]))
    await tx.business.update({ where: { id }, data: { addons: serializeAddons(next) } })
    await tx.activityLog.create({
      data: {
        business_id: id, user_id: by, action: 'addon_updated', model_type: 'Business', model_id: id,
        reason: 'Concesión por script (scripts/grant-addon.cjs)',
        old_values: { addons: prev }, new_values: { addons: next, plan: b.catalog_plan, source: 'scripts/grant-addon.cjs' },
      },
    })
    return { outcome: 'granted', detail: `[${prev.join(',')}] → [${next.join(',')}]` }
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const usage = 'Uso: node scripts/grant-addon.cjs --addon kds --ids 12,34 [--apply --by <id super_admin>]   (sin --apply es dry-run)'

  if (args.invalid.length > 0) { console.error(`Argumentos no válidos: ${args.invalid.join(', ')}\n${usage}`); return 1 }
  if (args.ids.length === 0) { console.error(`Sin ids: no se hace nada. El script nunca elige negocios por su cuenta.\n${usage}`); return 1 }
  if (!args.addon || !ADDON_KEYS.includes(args.addon)) { console.error(`--addon debe ser uno de: ${ADDON_KEYS.join(', ')}\n${usage}`); return 1 }
  if (args.apply && args.by === null) { console.error(`--apply exige --by <id de un super_admin> (queda en el ActivityLog).\n${usage}`); return 1 }

  loadEnv(path.join(__dirname, '..'))
  const prisma = createPrisma()
  try {
    if (args.apply) {
      const by = await prisma.user.findUnique({ where: { id: args.by }, select: { id: true, role: true } })
      if (!by || by.role !== 'super_admin') { console.error(`--by ${args.by} no es un super_admin: no se aplica nada.`); return 1 }
    }
    console.log(`Base de datos: ${process.env.DB_HOST ?? '127.0.0.1'} / ${process.env.DB_NAME ?? 'activopos'}`)
    console.log(`${args.apply ? 'APLICANDO' : 'DRY-RUN (no se escribe nada)'} — add-on "${args.addon}" en ${args.ids.length} negocio(s): ${args.ids.join(', ')}`)
    const tally = { granted: 0, would_grant: 0, already: 0, skipped_free: 0, not_found: 0 }
    for (const id of args.ids) {
      const r = await grantOne(prisma, id, args.addon, args.apply, args.by)
      tally[r.outcome]++
      if (r.outcome === 'not_found') console.log(`  #${id}  no existe en esta base de datos`)
      console.log(`      → ${r.outcome}${r.detail ? `  ${r.detail}` : ''}`)
    }
    console.log(`Resumen: concedidos=${tally.granted} concedería=${tally.would_grant} ya_lo_tenían=${tally.already} omitidos_gratis=${tally.skipped_free} no_existen=${tally.not_found}`)
    if (!args.apply && tally.would_grant > 0) console.log('Para aplicar: repite el comando con --apply --by <id de un super_admin>.')
    return 0
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1) })
}

module.exports = { ADDON_KEYS, PAID_PLANS, parseArgs, parseAddons, serializeAddons, describe }
