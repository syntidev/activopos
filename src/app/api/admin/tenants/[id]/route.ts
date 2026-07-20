import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: { id: string } }

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (session.role !== 'super_admin') return { error: NextResponse.json({ error: 'Sin permiso' }, { status: 403 }) }
  return { session }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireSuperAdmin()
  if (guard.error) return guard.error

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const business = await prisma.business.findUnique({
    where:  { id },
    select: {
      id:           true,
      name:         true,
      city:         true,
      segment:      true,
      catalog_slug: true,
      catalog_plan: true,
      active:       true,
      created_at:   true,
      _count:       { select: { products: true, users: true, orders: true } },
    },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const [salesMonth, recentActivity] = await Promise.all([
    prisma.sale.count({ where: { business_id: id, status: 'paid', sold_at: { gte: monthStart } } }),
    prisma.activityLog.findMany({
      where:   { business_id: id },
      orderBy: { created_at: 'desc' },
      take:    15,
      select:  { id: true, action: true, model_type: true, created_at: true, user: { select: { name: true } } },
    }),
  ])

  return NextResponse.json({ ok: true, business, salesMonth, recentActivity })
}

const PatchSchema = z.object({
  active: z.boolean().optional(),
  plan:   z.enum(['gratis', 'negocio_activo']).optional(),
})

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireSuperAdmin()
  if (guard.error) return guard.error

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  let data: z.infer<typeof PatchSchema>
  try {
    data = PatchSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  const business = await prisma.business.update({
    where: { id },
    data: {
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.plan !== undefined ? { catalog_plan: data.plan } : {}),
      // Subir a negocio_activo enciende el catálogo. El downgrade a gratis NO
      // lo apaga: el dueño puede haberlo activado por su cuenta.
      ...(data.plan === 'negocio_activo' ? { catalog_active: true } : {}),
    },
    select: { id: true, active: true, catalog_plan: true },
  })

  return NextResponse.json({ ok: true, business })
}

/* ── DELETE — baja definitiva de un tenant ────────────────────────────────────
 *
 * Hard delete, sin vuelta atrás. Es v1 y solo lo usa super_admin sobre negocios
 * de prueba; cuando haya clientes pagando esto debería migrar a soft-delete.
 *
 * Todas las FK son RESTRICT, así que el orden de borrado NO es decorativo: cada
 * tabla hija va antes que su padre o MariaDB rechaza la operación. Dos casos que
 * no son obvios:
 *   - Gasto referencia Purchase, Supplier y ExpenseCategory → va antes que los tres.
 *   - Order referencia Sale → va antes que Sale.
 * QuotationItem NO aparece: su relación con Quotation ya es onDelete: Cascade.
 *
 * Los archivos se borran DESPUÉS del commit. Si se borraran adentro y la
 * transacción hiciera rollback, quedaría un negocio vivo sin sus imágenes: la
 * DB revierte, el disco no.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireSuperAdmin()
  if (guard.error) return guard.error

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const business = await prisma.business.findUnique({
    where:  { id },
    select: { id: true, name: true },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  try {
    // timeout alto a propósito: un tenant con historial real son decenas de
    // miles de filas y el default de 5s hace rollback a mitad de camino.
    await prisma.$transaction(async (tx) => {
      const bid = id

      // Hijas de Sale
      await tx.saleItem.deleteMany({ where: { sale: { business_id: bid } } })
      await tx.salePayment.deleteMany({ where: { sale: { business_id: bid } } })
      await tx.saleAbono.deleteMany({ where: { sale: { business_id: bid } } })
      await tx.return.deleteMany({ where: { business_id: bid } })

      // Pedidos (Order referencia Sale)
      await tx.orderItem.deleteMany({ where: { order: { business_id: bid } } })
      await tx.order.deleteMany({ where: { business_id: bid } })

      // Ventas y cotizaciones (Sale referencia Quotation)
      await tx.sale.deleteMany({ where: { business_id: bid } })
      await tx.quotation.deleteMany({ where: { business_id: bid } })

      // Inventario y compras (Gasto referencia Purchase/Supplier/ExpenseCategory)
      await tx.inventoryEntry.deleteMany({ where: { business_id: bid } })
      await tx.gasto.deleteMany({ where: { business_id: bid } })
      await tx.purchaseItem.deleteMany({ where: { purchase: { business_id: bid } } })
      await tx.purchase.deleteMany({ where: { business_id: bid } })

      // Catálogo
      await tx.productComponent.deleteMany({ where: { business_id: bid } })
      await tx.productVariant.deleteMany({ where: { product: { business_id: bid } } })
      await tx.product.deleteMany({ where: { business_id: bid } })
      await tx.category.deleteMany({ where: { business_id: bid } })

      // Caja y métodos de pago
      await tx.cashMovement.deleteMany({ where: { business_id: bid } })
      await tx.cashRegister.deleteMany({ where: { business_id: bid } })
      await tx.paymentMethod.deleteMany({ where: { business_id: bid } })
      await tx.expenseCategory.deleteMany({ where: { business_id: bid } })

      // Terceros
      await tx.supplier.deleteMany({ where: { business_id: bid } })
      await tx.client.deleteMany({ where: { business_id: bid } })

      // Operativas sueltas
      await tx.activityLog.deleteMany({ where: { business_id: bid } })
      await tx.pushSubscription.deleteMany({ where: { business_id: bid } })
      await tx.notification.deleteMany({ where: { business_id: bid } })
      await tx.businessDevice.deleteMany({ where: { business_id: bid } })
      await tx.monthlyReport.deleteMany({ where: { business_id: bid } })
      await tx.invoice.deleteMany({ where: { business_id: bid } })
      await tx.supportTicket.deleteMany({ where: { business_id: bid } })
      await tx.socialStylePreset.deleteMany({ where: { business_id: bid } })
      await tx.dollarRate.deleteMany({ where: { business_id: bid } })
      await tx.pinRateLimit.deleteMany({ where: { business_id: bid } })

      await tx.user.deleteMany({ where: { business_id: bid } })
      await tx.business.delete({ where: { id: bid } })
    }, { timeout: 30_000, maxWait: 10_000 })
  } catch (err) {
    console.error('admin tenant DELETE:', err)
    return NextResponse.json(
      { error: 'No se pudo eliminar el negocio. No se borró nada.' },
      { status: 500 }
    )
  }

  // Fuera de la transacción: la DB ya está commiteada. Si falla el borrado de
  // archivos no se revierte nada — se reporta y quedan huérfanos, que es el
  // fallo barato comparado con perder archivos de un negocio vivo.
  const orphanDirs = removeTenantFiles(id)

  return NextResponse.json({ ok: true, deleted: business.name, orphanDirs })
}

/* Borra los directorios del tenant. Son DOS: config/business acepta rutas
 * `/uploads/` y `/storage/tenants/`, así que limpiar solo una deja basura.
 * Devuelve los directorios que no se pudieron borrar. */
function removeTenantFiles(bid: number): string[] {
  const dirs = [
    path.join(process.cwd(), 'storage', 'tenants', String(bid)),
    path.join(process.cwd(), 'public', 'uploads', 'tenants', String(bid)),
  ]
  const failed: string[] = []
  for (const dir of dirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch (err) {
      console.error('admin tenant DELETE — archivos:', dir, err)
      failed.push(dir)
    }
  }
  return failed
}
