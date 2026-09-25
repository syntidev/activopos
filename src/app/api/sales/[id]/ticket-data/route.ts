import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { ThermalTicketData } from '@/types/thermal'

type RouteContext = { params: { id: string } }

// Datos de una venta para la impresión térmica (QZ Tray + ESC/POS), como JSON:
// la plantilla vive en el cliente (lib/thermal-ticket.ts) y necesita números,
// no HTML. Mismo scope de tenant y mismos flags ticket_show_* que la ruta HTML
// /api/sales/[id]/ticket, que se deja intacta.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const [sale, business] = await Promise.all([
      db.sale.findFirst({
        where: { id }, // business_id inyectado por el tenant layer
        include: {
          items: {
            select: {
              product_name:       true,
              quantity:           true,
              price_per_unit_usd: true,
              subtotal_usd:       true,
              subtotal_bs:        true,
              discount_usd:       true,
              variant:            { select: { valor: true } },
              // Descripción viva del producto (SaleItem no la persiste).
              product:            { select: { description: true } },
            },
            orderBy: { id: 'asc' },
          },
          payments: { include: { payment_method: { select: { name: true } } } },
          cashier:  { select: { name: true } },
          // Cliente elegido del listado: guarda client_id pero deja
          // client_name/client_phone en null en la venta.
          client:   { select: { name: true, phone: true } },
        },
      }),
      // Business es la raíz del tenant (no tiene business_id) → no se filtra.
      db.business.findUnique({
        where:  { id: session.businessId },
        select: {
          name: true, address: true, phone: true, rif: true, ticket_footer: true,
          ticket_show_description:    true,
          ticket_show_bs:             true,
          ticket_show_foreign:        true,
          ticket_foreign_format:      true,
          ticket_show_address:        true,
          ticket_show_phone:          true,
          ticket_show_customer_data:  true,
          ticket_show_rif:            true,
          ticket_show_cashier_name:   true,
          ticket_show_bcv_rate:       true,
          ticket_show_payment_method: true,
        },
      }),
    ])

    if (!sale)     return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const ticket: ThermalTicketData = {
      business: {
        name:    business.name,
        rif:     business.rif,
        address: business.address,
        phone:   business.phone,
        footer:  business.ticket_footer,
      },
      flags: {
        show_description:    business.ticket_show_description,
        show_bs:             business.ticket_show_bs,
        show_foreign:        business.ticket_show_foreign,
        foreign_format:      business.ticket_foreign_format === 'ref' ? 'ref' : 'usd',
        show_address:        business.ticket_show_address,
        show_phone:          business.ticket_show_phone,
        show_customer_data:  business.ticket_show_customer_data,
        show_rif:            business.ticket_show_rif,
        show_cashier_name:   business.ticket_show_cashier_name,
        show_bcv_rate:       business.ticket_show_bcv_rate,
        show_payment_method: business.ticket_show_payment_method,
      },
      sale: {
        ticket_number: sale.ticket_number,
        sold_at:       sale.sold_at ? sale.sold_at.toISOString() : null,
        cashier_name:  sale.cashier.name,
        client_name:   sale.client_name  ?? sale.client?.name  ?? null,
        client_phone:  sale.client_phone ?? sale.client?.phone ?? null,
        total_usd:     Number(sale.total_usd),
        total_bs:      Number(sale.total_bs),
        rate:          Number(sale.rate_used),
        items: sale.items.map(item => ({
          name:               item.product_name,
          variant_label:      item.variant?.valor ?? null,
          description:        item.product.description,
          quantity:           Number(item.quantity),
          price_per_unit_usd: Number(item.price_per_unit_usd),
          subtotal_usd:       Number(item.subtotal_usd),
          subtotal_bs:        Number(item.subtotal_bs),
          discount_usd:       Number(item.discount_usd),
        })),
        payments: sale.payments.map(p => ({ method: p.payment_method.name, amount_usd: Number(p.amount_usd) })),
      },
    }

    return NextResponse.json({ ok: true, ticket })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
