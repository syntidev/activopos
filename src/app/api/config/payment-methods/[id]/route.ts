import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type RouteContext = { params: { id: string } }

// P1 silencio 2026-10-05 (auditoría CLI-C, investigado, NO corregido a propósito):
// este schema no acepta "type" (PmType: cash|transfer|zelle|binance|card|other).
// El form de edición en TabPagos.tsx SÍ lo manda en el PATCH -- Zod (sin .strict())
// lo descarta en silencio, el update queda sin cambiarlo, y el toast dice
// "actualizado" como si hubiera funcionado.
// NO se agrega acá porque type se consume con JOIN EN VIVO contra el método ya
// guardado (nunca un snapshot por venta/pago), en datos financieros reales:
//   - cash/status/route.ts:49 y cash/history/route.ts:63 -- filtran
//     payment_method.type === 'cash' para calcular el efectivo real de la caja
//     (cashVentasBs). Cambiar el type de un método YA USADO reclasificaría
//     retroactivamente cierres de caja pasados.
//   - dashboard/charts/route.ts, analytics/summary/route.ts, reports/daily/route.ts
//     -- agrupan ventas históricas por payment_method.type.
//   - CobroModal.tsx (REFERENCE_TYPES) -- decide si el POS exige número de
//     referencia según el type actual del método.
// Cambiar el type de un método con pagos ya registrados reescribe la lectura de
// TODO lo anterior. Reportado a Carlos -- no es decisión de este sprint.
const PatchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const data = PatchSchema.parse(await request.json())

    const existing = await db.paymentMethod.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'Método no encontrado' }, { status: 404 })

    const method = await db.paymentMethod.update({
      where: { id }, // business_id inyectado por el tenant layer
      data,
    })

    return NextResponse.json({ ok: true, method })
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }
}
