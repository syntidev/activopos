import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

// Auth de sesión normal — el dueño marca su propio aviso como visto.
// Tenant layer inyecta business_id en el WHERE del update: un id de otro
// negocio falla con P2025 (fail-closed), nunca filtra ni pisa datos ajenos.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    }

    const updated = await db.monthlyReport.update({
      where: { id },
      data:  { seen_at: new Date() },
    })

    return NextResponse.json({ ok: true, id: updated.id, seen_at: updated.seen_at })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
    }
    throw e
  }
}
