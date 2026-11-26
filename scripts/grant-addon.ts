/**
 * Concede un add-on (hoy solo 'kds') a una lista EXPLÍCITA de negocios. Planes v2: el KDS pasa a ser un derecho (plan Operación o add-on),
 * así que los tenants que ya lo usan necesitan el add-on ANTES de desplegar, o se les corta el acceso.
 *
 *   DRY-RUN (por defecto, no escribe nada):
 *     npm run grant:addon -- --addon kds --ids 12,34,56
 *   APLICAR (solo con --apply y --by <id de un super_admin>, que queda en el ActivityLog):
 *     npm run grant:addon -- --addon kds --ids 12,34,56 --apply --by 1
 *
 * Reglas: sin ids no hace NADA (sale con error); nunca descubre negocios por su cuenta; idempotente (si ya lo tiene, no cambia ni registra);
 * un negocio en plan gratis se omite (el add-on es complemento de un plan pago y no concede derecho sobre gratis); un ActivityLog
 * 'addon_updated' por negocio dentro de la misma transacción que el UPDATE. NO lo invoca ninguna migración ni el build: se corre a mano.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { ADDON_KEYS, isPaidPlan, parseAddons, serializeAddons, type AddonKey } from '../src/lib/plan-limits'

type Outcome = 'granted' | 'would_grant' | 'already' | 'skipped_free' | 'not_found'

interface Args { addon: string | null; ids: number[]; apply: boolean; by: number | null; invalid: string[] }

export function parseArgs(argv: string[]): Args {
  const out: Args = { addon: null, ids: [], apply: false, by: null, invalid: [] }
  const ids = new Set<number>()
  const addId = (raw: string): void => {
    if (/^\d+$/.test(raw) && Number(raw) > 0) ids.add(Number(raw))
    else out.invalid.push(raw)
  }
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

async function grantOne(id: number, addon: AddonKey, apply: boolean, by: number | null): Promise<{ outcome: Outcome; detail: string }> {
  const read = (db: Pick<typeof prisma, 'business'>) => db.business.findUnique({ where: { id }, select: { id: true, name: true, catalog_plan: true, addons: true } })

  if (!apply) {
    const b = await read(prisma)
    if (!b) return { outcome: 'not_found', detail: 'no existe' }
    if (!isPaidPlan(b.catalog_plan)) return { outcome: 'skipped_free', detail: `${b.name}: plan ${b.catalog_plan ?? 'gratis'} — el add-on no concede derecho sobre gratis` }
    if (parseAddons(b.addons).includes(addon)) return { outcome: 'already', detail: `${b.name}: ya lo tiene` }
    return { outcome: 'would_grant', detail: `${b.name} (${b.catalog_plan}): [${b.addons}] → [${serializeAddons([...parseAddons(b.addons), addon])}]` }
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${id} FOR UPDATE`
    const b = await read(tx)
    if (!b) return { outcome: 'not_found' as const, detail: 'no existe' }
    if (!isPaidPlan(b.catalog_plan)) return { outcome: 'skipped_free' as const, detail: `${b.name}: plan ${b.catalog_plan ?? 'gratis'} — el add-on no concede derecho sobre gratis` }
    const prev = parseAddons(b.addons)
    if (prev.includes(addon)) return { outcome: 'already' as const, detail: `${b.name}: ya lo tiene` }
    const next = parseAddons(serializeAddons([...prev, addon]))
    await tx.business.update({ where: { id }, data: { addons: serializeAddons(next) } })
    await tx.activityLog.create({
      data: {
        business_id: id, user_id: by as number, action: 'addon_updated', model_type: 'Business', model_id: id,
        reason: 'Concesión por script (scripts/grant-addon.ts)', old_values: { addons: prev }, new_values: { addons: next, plan: b.catalog_plan, source: 'scripts/grant-addon.ts' },
      },
    })
    return { outcome: 'granted' as const, detail: `${b.name} (${b.catalog_plan}): [${prev.join(',')}] → [${next.join(',')}]` }
  })
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const usage = 'Uso: npm run grant:addon -- --addon kds --ids 12,34 [--apply --by <id super_admin>]   (sin --apply es dry-run)'

  if (args.invalid.length > 0) { console.error(`Argumentos no válidos: ${args.invalid.join(', ')}\n${usage}`); return 1 }
  if (args.ids.length === 0) { console.error(`Sin ids: no se hace nada. El script nunca elige negocios por su cuenta.\n${usage}`); return 1 }
  if (!args.addon || !(ADDON_KEYS as readonly string[]).includes(args.addon)) {
    console.error(`--addon debe ser uno de: ${ADDON_KEYS.join(', ')}\n${usage}`); return 1
  }
  const addon = args.addon as AddonKey

  if (args.apply) {
    if (args.by === null) { console.error(`--apply exige --by <id de un super_admin> (queda en el ActivityLog).\n${usage}`); return 1 }
    const by = await prisma.user.findUnique({ where: { id: args.by }, select: { id: true, role: true } })
    if (!by || by.role !== 'super_admin') { console.error(`--by ${args.by} no es un super_admin: no se aplica nada.`); return 1 }
  }

  console.log(`${args.apply ? 'APLICANDO' : 'DRY-RUN (no se escribe nada)'} — add-on "${addon}" en ${args.ids.length} negocio(s): ${args.ids.join(', ')}`)
  const tally: Record<Outcome, number> = { granted: 0, would_grant: 0, already: 0, skipped_free: 0, not_found: 0 }
  for (const id of args.ids) {
    const r = await grantOne(id, addon, args.apply, args.by)
    tally[r.outcome]++
    console.log(`  #${id}  ${r.outcome.padEnd(12)}  ${r.detail}`)
  }
  console.log(`Resumen: concedidos=${tally.granted} concedería=${tally.would_grant} ya_lo_tenían=${tally.already} omitidos_gratis=${tally.skipped_free} no_existen=${tally.not_found}`)
  if (!args.apply && tally.would_grant > 0) console.log('Para aplicar: repite el comando con --apply --by <id de un super_admin>.')
  return 0
}

if (require.main === module) {
  main()
    .then(code => prisma.$disconnect().finally(() => process.exit(code)))
    .catch(async err => { console.error(err); await prisma.$disconnect(); process.exit(1) })
}
