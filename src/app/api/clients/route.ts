import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { z } from 'zod'
import { checkCedula } from '@/lib/cedula'
import { validateAddress } from '@/lib/shipping'
import { logError } from '@/lib/safe-log'

const clientSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(120).nullable().optional(),
  cedula: z.string().max(20).nullable().optional(),
  notes: z.string().nullable().optional(),
  // Dirección de envío guardada ("misma dirección" en el checkout). Vacío = sin dirección.
  address: z.string().trim().max(500).nullable().optional(),
})

// Entero acotado: un valor no numérico ("abc") cae al default en vez de llegar como NaN a Prisma.
const intParam = (raw: string | null, fallback: number, min: number, max: number): number => {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export async function GET(req: NextRequest) {
  try {
    const { db } = await getAuthenticatedTenant()

    const sp = req.nextUrl.searchParams
    const search = sp.get('search')?.trim() ?? ''
    const page = intParam(sp.get('page'), 1, 1, 100000)
    const limit = intParam(sp.get('limit'), 20, 1, 50)
    const skip = (page - 1) * limit

    const where = {
      // business_id inyectado por el tenant layer
      is_active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { cedula: { contains: search } },
            ],
          }
        : {}),
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      db.client.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      clients,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    logError('Clients list error', e)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body: unknown = await req.json().catch(() => undefined)
    if (body === undefined) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    const data = clientSchema.parse(body)

    // Cédula / RIF opcional: misma regla y mismo mensaje que el checkout (lib/cedula.ts).
    const cedulaCheck = checkCedula(data.cedula, null)
    if (!cedulaCheck.ok) {
      return NextResponse.json({ error: cedulaCheck.message, field: 'cedula' }, { status: 422 })
    }

    const address = data.address?.trim() || null
    const addressError = address ? validateAddress(address) : null
    if (addressError) return NextResponse.json({ error: addressError, field: 'address' }, { status: 422 })

    // Unicidad por cédula a nivel de aplicación (la DB solo tiene un índice normal: hay duplicados históricos).
    if (cedulaCheck.value) {
      const dup = await db.client.findFirst({ where: { cedula: cedulaCheck.value }, select: { id: true } }) // business_id inyectado
      if (dup) return NextResponse.json({ error: 'Ya existe un cliente con esa cédula.', field: 'cedula' }, { status: 409 })
    }

    const client = await db.client.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        cedula: cedulaCheck.value,
        notes: data.notes ?? null,
        address,
        origin: 'pos',
      },
    })

    return NextResponse.json({ ok: true, client }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    logError('Client create error', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
