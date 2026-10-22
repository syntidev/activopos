import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import { checkCedula } from '@/lib/cedula'
import { FinancingError, assertPaymentMatchesFinancing } from '@/lib/ticket-financing'

class InsufficientStockError extends Error {}
class SaleStateError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

const paySchema = z.object({
  payments: z
    .array(
      z.object({
        payment_method_id: z.number().int().positive(),
        amount_bs: z.number().positive(),
        amount_usd: z.number().positive(),
        reference: z.string().optional(),
      })
    )
    .min(1),
  client_cedula: z.string().max(20).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { session, db } = await getAuthenticatedTenant()
    const body = paySchema.parse(await req.json())

    // Lectura de validación (fuera del $transaction) → tenant layer
    const sale = await db.sale.findFirst({
      where: { id: saleId }, // business_id inyectado por el tenant layer
      include: {
        items: {
          select: {
            id: true, product_id: true, quantity: true,
            recipe_snapshot: true, variant_id: true,
            product: {
              select: {
                product_type: true,
                components: { select: { component_id: true, quantity: true } },
              },
            },
          },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    }
    if (sale.status === 'paid') {
      return NextResponse.json({ error: 'La venta ya fue cobrada' }, { status: 409 })
    }
    if (sale.status === 'cancelled') {
      return NextResponse.json({ error: 'La venta está anulada' }, { status: 409 })
    }

    // SEC: payment_method_id debe pertenecer al mismo tenant — nunca confiar en el id del cliente
    const paymentMethodIds = Array.from(new Set(body.payments.map(p => p.payment_method_id)))
    const validMethods = await prisma.paymentMethod.count({
      where: { id: { in: paymentMethodIds }, business_id: session.businessId },
    })
    if (validMethods !== paymentMethodIds.length) {
      return NextResponse.json({ error: 'Método de pago no válido para este negocio' }, { status: 403 })
    }

    // Cédula: obligatoria (V/E natural) si algún método es financiadora; si no, la
    // que ya traía la venta (cotización/borrador) o la nueva opcional.
    const financing = await prisma.paymentMethod.findFirst({
      where:  { id: { in: paymentMethodIds }, business_id: session.businessId, is_financing: true },
      select: { name: true },
    })
    const cedulaCheck = checkCedula(body.client_cedula ?? sale.client_cedula, financing?.name ?? null)
    if (!cedulaCheck.ok) {
      return NextResponse.json({ error: cedulaCheck.message, field: 'client_cedula' }, { status: 422 })
    }
    const clientCedula = cedulaCheck.value

    const { rate }     = await getActiveRate(session.businessId)
    const payTotalBs   = body.payments.reduce((acc, p) => acc + p.amount_bs,  0)
    const payTotalUsd  = body.payments.reduce((acc, p) => acc + p.amount_usd, 0)

    // $transaction en prisma base: business_id manual adentro (la extension no se propaga al tx)
    const updated = await prisma.$transaction(async (tx) => {
      // Cerrojo de la fila de la venta (con business_id): serializa el cobro contra un cambio de modo de precio
      // (PATCH /price-mode). Estado y total se REVALIDAN adentro: lo leído arriba puede estar viejo.
      await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId} AND business_id = ${session.businessId} FOR UPDATE`
      const current = await tx.sale.findFirst({
        where: { id: saleId, business_id: session.businessId },
        include: {
          items: {
            select: {
              id: true, product_id: true, quantity: true,
              recipe_snapshot: true, variant_id: true,
              product: {
                select: {
                  product_type: true,
                  components: { select: { component_id: true, quantity: true } },
                },
              },
            },
          },
        },
      })
      if (!current) throw new SaleStateError(404, 'Venta no encontrada')
      if (current.status === 'paid') throw new SaleStateError(409, 'La venta ya fue cobrada')
      if (current.status === 'cancelled') throw new SaleStateError(409, 'La venta está anulada')

      // Financiamiento (Cashea): con el estado ya bloqueado, solo 'aprobado' se cobra con el método financiador (todo o nada).
      await assertPaymentMatchesFinancing(tx, session.businessId, current.financing_status, body.payments.map(p => p.payment_method_id),
        { priceMode: current.price_mode, productIds: current.items.map(i => i.product_id) })

      const totalBs  = Number(current.total_bs)
      const totalUsd = Number(current.total_usd)
      if (payTotalBs < totalBs - 0.01) {
        throw new SaleStateError(400, `Pago insuficiente. Total: ${totalBs.toFixed(2)} Bs. Recibido: ${payTotalBs.toFixed(2)} Bs`)
      }
      const montoRecibidoUsd = Math.round(payTotalUsd * 100) / 100
      const vueltoUsd        = Math.max(0, Math.round((payTotalUsd - totalUsd) * 100) / 100)

      // Guarda de estado al marcar pagada: solo pasa si sigue abierta (nunca doble cobro).
      const claimed = await tx.sale.updateMany({
        where: { id: saleId, business_id: session.businessId, status: { notIn: ['paid', 'cancelled'] } },
        data: {
          status:             'paid',
          sold_at:            new Date(),
          rate_used:          rate,
          monto_recibido_usd: montoRecibidoUsd,
          vuelto_usd:         vueltoUsd,
          client_cedula:      clientCedula,
        },
      })
      if (claimed.count !== 1) throw new SaleStateError(409, 'La venta ya fue cobrada')
      await tx.salePayment.createMany({
        data: body.payments.map(p => ({
          sale_id:           saleId,
          payment_method_id: p.payment_method_id,
          amount_bs:         p.amount_bs,
          amount_usd:        p.amount_usd,
          reference:         p.reference,
          rate_used:         rate,
        })),
      })
      const paidSale = await tx.sale.findFirstOrThrow({
        where: { id: saleId, business_id: session.businessId },
        include: {
          items: true,
          payments: {
            include: {
              payment_method: { select: { id: true, name: true, type: true } },
            },
          },
        },
      })

      // Client.cedula solo si estaba nula; nunca se pisa una existente.
      if (clientCedula && current.client_id !== null) {
        await tx.client.updateMany({
          where: { id: current.client_id, business_id: session.businessId, cedula: null },
          data:  { cedula: clientCedula },
        })
      }

      const inventoryDeductions: {
        business_id: number
        product_id:  number
        quantity:    number
        waste:       number
        entry_type:  string
        notes:       string
        created_by:  number
      }[] = []

      for (const item of current.items) {
        const productType = item.product.product_type
        if (productType === 'simple') {
          if (item.variant_id != null) {
            // Variant stock tracked on ProductVariant row
            const variant = await tx.productVariant.findUnique({
              where: { id: item.variant_id },
            })
            if (!variant || variant.stock < Number(item.quantity)) {
              throw new InsufficientStockError(
                `Stock insuficiente para variante ${item.variant_id}`
              )
            }
            await tx.productVariant.update({
              where: { id: item.variant_id },
              data:  { stock: { decrement: Number(item.quantity) } },
            })
            // Dual-mechanism: mantiene net_inventory (agregado de InventoryEntry,
            // que lee el dashboard) sincronizado con variant.stock. net = quantity - waste,
            // así waste=qty descuenta la venta de la variante del inventario neto.
            inventoryDeductions.push({
              business_id: session.businessId,
              product_id:  item.product_id,
              quantity:    0,
              waste:       Number(item.quantity),
              entry_type:  'sale',
              notes:       `Venta variante ${item.variant_id}`,
              created_by:  session.userId,
            })
          } else {
            inventoryDeductions.push({
              business_id: session.businessId,
              product_id:  item.product_id,
              quantity:    -Number(item.quantity),
              waste:       0,
              entry_type:  'sale',
              notes:       `VENTA #${current.ticket_number}`,
              created_by:  session.userId,
            })
          }
        } else {
          // SEC-02: use snapshot captured at sale creation — immune to recipe changes
          const components: { component_id: number; quantity: number }[] =
            item.recipe_snapshot
              ? (JSON.parse(item.recipe_snapshot) as { component_id: number; quantity: number }[])
              : item.product.components

          for (const comp of components) {
            inventoryDeductions.push({
              business_id: session.businessId,
              product_id:  comp.component_id,
              quantity:    -(Number(item.quantity) * comp.quantity),
              waste:       0,
              entry_type:  'sale',
              notes:       `VENTA #${current.ticket_number} (componente)`,
              created_by:  session.userId,
            })
          }
        }
      }

      if (inventoryDeductions.length > 0) {
        await tx.inventoryEntry.createMany({ data: inventoryDeductions })
      }

      // Cotización cobrada. Va adentro del $transaction: si el cobro se cae, la
      // cotización no puede quedar marcada como Cobrada sin venta detrás. Se
      // escribe acá y no vía PATCH /api/quotations/[id] porque ese endpoint no
      // acepta 'converted' y un fetch a otra ruta quedaría fuera de la
      // transacción. updateMany filtra por business_id y no explota si la
      // cotización ya no existe.
      if (current.quotation_id) {
        await tx.quotation.updateMany({
          where: { id: current.quotation_id, business_id: session.businessId },
          data:  { status: 'converted' },
        })
      }

      await tx.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id: session.userId,
          action: 'sale_paid',
          model_type: 'Sale',
          model_id: saleId,
          new_values: {
            ticket_number: current.ticket_number,
            total_bs: totalBs,
            rate,
          },
        },
      })

      return paidSale
    })

    return NextResponse.json({ ok: true, sale: updated })
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    if (err instanceof FinancingError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof SaleStateError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof InsufficientStockError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error(`sales/${saleId}/pay error:`, err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
