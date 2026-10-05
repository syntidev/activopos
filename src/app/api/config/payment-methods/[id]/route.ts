import { NextResponse } from 'next/server'
import { z } from 'zod'
import { PmType } from '@prisma/client'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

type RouteContext = { params: { id: string } }

// P1 silencio 2026-10-05 (auditoría CLI-C) -- decisión de Carlos 2026-10-05:
// type de un método EXISTENTE no se cambia. Se consume con JOIN EN VIVO contra
// el método ya guardado (nunca un snapshot por venta/pago), en datos
// financieros reales:
//   - cash/status/route.ts:49 y cash/history/route.ts:63 -- filtran
//     payment_method.type === 'cash' para calcular el efectivo real de la caja
//     (cashVentasBs). Cambiar el type de un método YA USADO reclasificaría
//     retroactivamente cierres de caja pasados.
//   - dashboard/charts/route.ts, analytics/summary/route.ts, reports/daily/route.ts
//     -- agrupan ventas históricas por payment_method.type.
//   - CobroModal.tsx (REFERENCE_TYPES) -- decide si el POS exige número de
//     referencia según el type actual del método.
// Antes este schema ni siquiera aceptaba "type": Zod (sin .strict()) lo
// descartaba en silencio y el toast decía "actualizado" sin haber cambiado
// nada. Ahora SÍ se acepta, para poder comparar contra el valor guardado y
// responder 400 explícito si de verdad intenta cambiarlo -- mismo type (o
// campo ausente) sigue funcionando exactamente igual que hoy.
const PatchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  type: z.nativeEnum(PmType).optional(),
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

    if (data.type !== undefined && data.type !== existing.type) {
      return NextResponse.json(
        { error: 'El tipo de un método existente no se puede cambiar. Crea uno nuevo y desactiva este.' },
        { status: 400 },
      )
    }

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
