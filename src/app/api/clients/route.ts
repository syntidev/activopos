import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { z } from 'zod'

const clientSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(120).nullable().optional(),
  cedula: z.string().max(15).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { db } = await getAuthenticatedTenant()

    const sp = req.nextUrl.searchParams
    const search = sp.get('search')?.trim() ?? ''
    const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
    const limit = Math.min(50, parseInt(sp.get('limit') ?? '20'))
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
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const body = await req.json()
    const data = clientSchema.parse(body)

    const client = await db.client.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        cedula: data.cedula ?? null,
        notes: data.notes ?? null,
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
    console.error('Client create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
