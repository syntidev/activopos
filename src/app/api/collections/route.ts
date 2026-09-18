import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const currentYear = new Date().getFullYear()

const collectionSchema = z.object({
  slug:       z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  name:       z.string().trim().min(1).max(120),
  year:       z.number().int().min(2000).max(currentYear + 5).nullable().optional(),
  cover_path: z.string().trim().max(500).refine(
    v => v === '' || v.startsWith('/uploads/') || v.startsWith('/storage/tenants/'),
    'cover_path debe ser una ruta interna (/uploads/... o /storage/tenants/...)',
  ).nullable().optional(),
}).strict()

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const collections = await db.collection.findMany({
      where: { active: true }, // business_id inyectado por el tenant layer
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ ok: true, collections })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    let data: z.infer<typeof collectionSchema>
    try {
      data = collectionSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const collection = await db.collection.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        slug:        data.slug,
        name:        data.name,
        year:        data.year ?? null,
        cover_path:  data.cover_path || null,
      },
    })

    return NextResponse.json({ ok: true, collection }, { status: 201 })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una colección con ese slug' }, { status: 409 })
    }
    console.error('Collection create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
