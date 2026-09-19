import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { imagePath } from '@/lib/landing-sections'

const trimmed = (max: number) => z.string().trim().min(1).max(max)

const postSchema = z.object({
  name:        trimmed(60),
  image_url:   imagePath().optional(),
  search_term: trimmed(60),
  visible:     z.boolean().optional(),
}).strict()

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const brands = await db.brand.findMany({
      orderBy: { order: 'asc' }, // business_id inyectado por el tenant layer
    })

    return NextResponse.json({ ok: true, brands })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    let body: z.infer<typeof postSchema>
    try {
      body = postSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    // Append al final — el orden existente se reordena vía PATCH, no aquí.
    const order = await db.brand.count() // business_id inyectado

    const brand = await db.brand.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        name:        body.name,
        image_url:   body.image_url,
        search_term: body.search_term,
        order,
        visible:     body.visible ?? true,
      },
    })

    return NextResponse.json({ ok: true, brand }, { status: 201 })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
