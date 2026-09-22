import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

const currentYear = new Date().getFullYear()

// El slug en sí no es editable acá a propósito: es la clave pública usada en
// GET /api/collections/[slug]/products y en el link externo compartible.
// Vive junto a ese subfolder (mismo `[slug]`) porque Next.js no permite mezclar
// nombres de segmento dinámico distintos ('id' vs 'slug') al mismo nivel de ruta.
const patchSchema = z.object({
  name:       z.string().trim().min(1).max(120).optional(),
  year:       z.number().int().min(2000).max(currentYear + 5).nullable().optional(),
  cover_path: z.string().trim().max(500).refine(
    v => v === '' || v.startsWith('/uploads/') || v.startsWith('/storage/tenants/'),
    'cover_path debe ser una ruta interna (/uploads/... o /storage/tenants/...)',
  ).nullable().optional(),
  active:     z.boolean().optional(),
  // "Cartelera del momento" (grid premium del catálogo). true = esta pasa a ser
  // LA cartelera y las demás del negocio se apagan (una sola activa a la vez).
  is_cartelera_activa: z.boolean().optional(),
}).strict()

type RouteContext = { params: { slug: string } }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    let data: z.infer<typeof patchSchema>
    try {
      data = patchSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const existing = await db.collection.findFirst({ where: { slug: params.slug } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Una colección desactivada (soft delete) no puede ser la cartelera.
    if (data.is_cartelera_activa === true && (data.active ?? existing.active) === false) {
      return NextResponse.json({ error: 'Una colección inactiva no puede ser la cartelera' }, { status: 422 })
    }

    const scalarData = {
      ...(data.name       !== undefined ? { name:       data.name }               : {}),
      ...(data.year       !== undefined ? { year:       data.year }               : {}),
      ...(data.cover_path !== undefined ? { cover_path: data.cover_path || null } : {}),
      ...(data.active     !== undefined ? { active:     data.active }             : {}),
    }

    // Regla "solo UNA cartelera activa por negocio": activar una apaga las demás
    // en la MISMA transacción (si falla algo, no queda ninguna o dos a medias).
    // El tenant layer inyecta business_id en ambas operaciones.
    if (data.is_cartelera_activa === true) {
      const [, collection] = await db.$transaction([
        db.collection.updateMany({
          where: { is_cartelera_activa: true, NOT: { id: existing.id } },
          data:  { is_cartelera_activa: false },
        }),
        db.collection.update({
          where: { id: existing.id },
          data:  { ...scalarData, is_cartelera_activa: true },
        }),
      ])
      return NextResponse.json({ ok: true, collection })
    }

    // Apagar la cartelera (o desactivar la colección) deja el negocio sin cartelera:
    // el catálogo vuelve al bloque de colección de siempre.
    const clearsCartelera = data.is_cartelera_activa === false || data.active === false
    const collection = await db.collection.update({
      where: { id: existing.id },
      data:  { ...scalarData, ...(clearsCartelera ? { is_cartelera_activa: false } : {}) },
    })

    return NextResponse.json({ ok: true, collection })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const existing = await db.collection.findFirst({ where: { slug: params.slug } }) // business_id inyectado
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Soft delete (active=false) igual que Category/Product -- evita romper el
    // FK de product_collections y preserva el historial si el admin se arrepiente.
    await db.collection.update({ where: { id: existing.id }, data: { active: false, is_cartelera_activa: false } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
