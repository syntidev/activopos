import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { z } from 'zod'
import { checkCedula } from '@/lib/cedula'
import { validateAddress } from '@/lib/shipping'
import { logError } from '@/lib/safe-log'

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(120).nullable().optional(),
  cedula: z.string().max(20).nullable().optional(),
  notes: z.string().nullable().optional(),
  price_tier: z.enum(['detal', 'mayorista']).optional(),
  // Dirección de envío guardada. null o vacío la borra.
  address: z.string().trim().max(500).nullable().optional(),
  // Marca que el negocio ya confirmó la identidad (solo admin).
  verified: z.boolean().optional(),
})

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw)
  return isNaN(id) ? null : id
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { db } = await getAuthenticatedTenant()

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const client = await db.client.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!client) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const [recentSales, cxcAgg] = await Promise.all([
      db.sale.findMany({
        where: {
          client_id: id,
          status: { not: 'cancelled' },
        },
        select: {
          id: true,
          ticket_number: true,
          status: true,
          total_usd: true,
          total_bs: true,
          sold_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      // Saldo CxC = suma de ventas pendientes (crédito sin pagar)
      db.sale.aggregate({
        where: {
          client_id: id,
          status: 'credit',
        },
        _sum: { total_bs: true, total_usd: true },
      }),
    ])

    return NextResponse.json({
    ok: true,
    client,
    cxc: {
      balance_bs: Number(cxcAgg._sum.total_bs ?? 0),
      balance_usd: Number(cxcAgg._sum.total_usd ?? 0),
    },
      recentSales: recentSales.map(s => ({
        ...s,
        total_usd: Number(s.total_usd),
        total_bs: Number(s.total_bs),
      })),
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    logError('Client get error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body: unknown = await req.json().catch(() => undefined)
    if (body === undefined) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    const data = patchSchema.parse(body)

    // price_tier (detal/mayorista) reclasifica al cliente de forma permanente y cambia
    // el precio de TODAS sus compras futuras — es distinto de un override de precio puntual
    // en una venta. Solo admin/super_admin. cashier puede editar datos de contacto, no el tier.
    if (data.price_tier !== undefined && session.role === 'cashier') {
      return NextResponse.json({ error: 'Sin permiso para cambiar el tipo de precio' }, { status: 403 })
    }
    // Confirmar la identidad de un cliente web es decisión del admin, no del mostrador.
    if (data.verified !== undefined && session.role === 'cashier') {
      return NextResponse.json({ error: 'Sin permiso para verificar clientes' }, { status: 403 })
    }

    const existing = await db.client.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // La dirección de un cliente ya verificado alimenta "misma dirección" del checkout: cambiarla
    // equivale a redirigir sus envíos, así que solo el admin puede.
    if (data.address !== undefined && existing.verified && session.role !== 'admin') {
      return NextResponse.json({ error: 'Cliente verificado: solo el administrador puede cambiar su dirección.' }, { status: 403 })
    }

    // Cédula / RIF: solo se valida si CAMBIÓ respecto a lo guardado (clientes antiguos
    // con texto libre siguen pudiendo editarse). Un valor nuevo se guarda normalizado.
    let cedulaPatch: { cedula: string | null } | Record<string, never> = {}
    if (data.cedula !== undefined && data.cedula !== existing.cedula) {
      const cedulaCheck = checkCedula(data.cedula, null)
      if (!cedulaCheck.ok) {
        return NextResponse.json({ error: cedulaCheck.message, field: 'cedula' }, { status: 422 })
      }
      // Unicidad por cédula a nivel de aplicación (la DB solo tiene un índice normal).
      if (cedulaCheck.value) {
        const dup = await db.client.findFirst({ where: { cedula: cedulaCheck.value, id: { not: id } }, select: { id: true } }) // business_id inyectado
        if (dup) return NextResponse.json({ error: 'Ya existe otro cliente con esa cédula.', field: 'cedula' }, { status: 409 })
      }
      cedulaPatch = { cedula: cedulaCheck.value }
    }

    // Dirección guardada: vacía = borrarla; con texto debe servir para un envío.
    let addressPatch: { address: string | null } | Record<string, never> = {}
    if (data.address !== undefined) {
      const address = data.address?.trim() || null
      const addressError = address ? validateAddress(address) : null
      if (addressError) return NextResponse.json({ error: addressError, field: 'address' }, { status: 422 })
      addressPatch = { address }
    }
    const { cedula: _ignored, address: _addr, ...rest } = data

    const client = await db.client.update({ where: { id }, data: { ...rest, ...cedulaPatch, ...addressPatch } }) // business_id inyectado
    return NextResponse.json({ ok: true, client })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    logError('Client patch error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.client.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const pendingBalance = await db.sale.count({
      where: { client_id: id, status: 'credit' }, // business_id inyectado
    })
    if (pendingBalance > 0) {
      return NextResponse.json(
        { error: `El cliente tiene ${pendingBalance} venta(s) pendiente(s) de cobro` },
        { status: 409 }
      )
    }

    await db.client.update({ where: { id }, data: { is_active: false } }) // business_id inyectado
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    logError('Client delete error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
