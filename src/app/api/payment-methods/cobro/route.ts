import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'

/* ── GET /api/payment-methods/cobro ───────────────────────────────────────────
 *
 * Devuelve lo necesario para armar el mensaje de cobro por WhatsApp en el
 * cliente: el cobro_data crudo del negocio y si hay un método de efectivo
 * activo. El armado del texto vive en lib/payments (buildPaymentMessage) para
 * no repetirlo entre Kanban y Clientes.
 *
 * business_id sale del tenant layer (getSession), nunca del request.
 */
export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const [business, methods] = await Promise.all([
      db.business.findFirst({
        // business_id inyectado por el tenant layer
        select: { name: true, cobro_data: true },
      }),
      db.paymentMethod.findMany({
        where:  { is_active: true }, // business_id inyectado
        select: { type: true },
      }),
    ])

    // Efectivo: cash/transfer no tienen datos en cobro_data, se muestran como
    // "aceptamos efectivo" si el negocio los tiene activos.
    const acceptsCash = methods.some(m => m.type === 'cash' || m.type === 'transfer')

    return NextResponse.json({
      ok:            true,
      cobro_data:    business?.cobro_data ?? null,
      business_name: business?.name ?? '',
      acceptsCash,
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
