import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getActiveRate } from '@/lib/bcv'
import {
  catalogLimiter, catalogOrderCedulaLimiter, catalogOrderIpLimiter, catalogOrderPhoneLimiter, getClientIp,
} from '@/lib/rate-limit'
import { logError } from '@/lib/safe-log'
import { isCatalogLive, CATALOG_WHERE_FILTER } from '@/lib/catalog'
import { buildWhatsAppMessage, whatsappUrl } from '@/lib/whatsapp-message'
import { checkCedula } from '@/lib/cedula'
import { FinancingError, PAYMENT_KINDS, assertFinancingEligible } from '@/lib/ticket-financing'
import type { PaymentKind } from '@/lib/ticket-financing'
import { validateAddress, validateShipping } from '@/lib/shipping'
import { resolveUnitPriceUsd, VARIANT_PRICING_SELECT } from '@/lib/pricing'
import {
  checkCheckoutCedula, hasUsablePhone, normalizeClientPhone, phoneLookupVariants, sameName,
} from '@/lib/customer-identity'
import {
  ensureWebCheckoutLocks, lockWebCheckout, resolveWebClient, WebCheckoutBusyError, webCheckoutKeys,
} from '@/lib/web-client'

const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)

// price_usd and name intentionally omitted — server fetches canonical values from DB
const ItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty:        z.number().positive().max(9999),
  variant_id: z.number().int().positive().optional(),
})

const BodySchema = z.object({
  items:              z.array(ItemSchema).min(1).max(50),
  customer_name:      z.string().min(1).max(120).trim(),
  customer_phone:     z.string().min(7).max(20).trim(),
  customer_reference: z.string().min(1).max(200).trim(),
  payment_method:     z.string().min(1).max(60).trim(),
  // Método declarado por el cliente: cashea (financiamiento, exige elegibilidad) | bs | divisa. Si falta y el método elegido
  // es financiador (is_financing) se toma como cashea. El precio del pedido siempre nace en BCV.
  payment_kind:       z.enum(PAYMENT_KINDS).optional(),
  // OBLIGATORIA siempre (retiro y envío). Va nullable/optional en el schema solo para que la falta
  // salga como 422 con field 'customer_cedula' (mensaje claro) y no como "Datos inválidos" genérico.
  customer_cedula:    z.string().max(20).trim().nullable().optional(),
  notes:              z.string().max(500).trim().optional(),
  delivery_type:      z.enum(['pickup', 'delivery']).default('pickup'),
  // .nullable() además de .optional(): CartDrawer manda `null` explícito
  // (`recipientName.trim() || null`) cuando el campo queda vacío -- típico
  // en TODO pedido "Retirar en tienda". .optional() solo acepta undefined,
  // no null -- rechazaba null con 422 "Datos inválidos" en cada pickup.
  // Root cause confirmado con test aislado de Zod antes de tocar esto.
  recipient_name:     z.string().max(120).trim().nullable().optional(),
  delivery_address:   z.string().max(500).trim().nullable().optional(),
  // "Misma dirección": el servidor la toma del Client identificado por cédula; la del body se ignora.
  use_saved_address:  z.boolean().optional(),
  // Método de envío del negocio (GET /api/catalog/[slug]/shipping-methods). Solo aplica a delivery.
  shipping_method_id: z.number().int().positive().nullable().optional(),
  // Oficina de destino: obligatoria SOLO si el método elegido tiene requires_branch. El servidor la antepone
  // a la dirección ("Oficina: X | dirección"); en el resto de métodos se ignora.
  branch_office:      z.string().max(120).trim().nullable().optional(),
})

/** Error de negocio dentro de la transacción: la deshace y responde con este status. */
class CheckoutError extends Error {
  constructor(readonly status: number, message: string, readonly field?: string) { super(message) }
}

// Mismo mensaje exista o no el cliente/la dirección: no es un oráculo de cédulas.
const SAVED_ADDRESS_MESSAGE = 'No pudimos usar una dirección guardada. Escribe la dirección de envío.'
// Dirección de relleno (≥ 15 caracteres, no "sin especificar") para validar solo nombre/cédula/teléfono
// antes de leer la guardada.
const ADDRESS_PLACEHOLDER = 'direccion guardada del cliente'
const OPEN_ORDERS_LIMIT = 3
const MIN_NAME_WORDS = 2     // "misma dirección": el nombre debe coincidir en al menos 2 palabras
const MIN_BRANCH_CHARS = 3
const MAX_NUMBER_RETRIES = 8 // reintentos del número de pedido si otro lo tomó primero
// La transacción espera el lock del cliente: tiempos explícitos (los de Prisma por defecto son 2 s / 5 s).
const TX_MAX_WAIT_MS = 5000
const TX_TIMEOUT_MS = 15000
const BUSY_MESSAGE = 'Estamos recibiendo muchos pedidos. Reintenta en unos segundos.'
// P2034 = deadlock/conflicto de escritura; P2028 = la transacción venció; P2024 = sin conexión libre en el pool.
const CONTENTION_CODES: readonly string[] = ['P2034', 'P2028', 'P2024']

interface ChosenMethod {
  id:              number
  label:           string
  kind:            string
  requires_branch: boolean
}

type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

interface ResolvedItem {
  product_id:    number
  product_name:  string
  qty:           number
  price_usd:     number
  subtotal_usd:  number
  variant_id:    number | null
  variant_label: string | null
}

/** Número que sigue a `last` (o el primero). Mismo formato de siempre: PREFIJO-00001. */
function bumpOrderNumber(prefix: string, last: string | null): string {
  let nextNum = 1
  if (last) {
    const parts = last.split('-')
    const n = parseInt(parts[parts.length - 1] ?? '0', 10)
    nextNum = !isNaN(n) && n < 99999 ? n + 1 : 1
  }
  return `${prefix}-${nextNum.toString().padStart(5, '0')}`
}

async function generateOrderNumber(businessId: number, prefix: string, tx: TxClient): Promise<string> {
  const last = await tx.order.findFirst({
    where: {
      business_id:  businessId,
      order_number: { startsWith: `${prefix}-` },
    },
    orderBy: { id: 'desc' },
    select: { order_number: true },
  })
  return bumpOrderNumber(prefix, last?.order_number ?? null)
}

/** P2002 sobre (business_id, order_number): otro pedido (web o del POS) tomó ese número. */
function isOrderNumberTaken(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' &&
    `${JSON.stringify(err.meta ?? {})} ${err.message}`.includes('order_number')
}

type RouteContext = { params: { slug: string } }

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    return await createOrder(req, ctx)
  } catch (err) {
    logError('catalog order error', err)
    return NextResponse.json({ error: 'No se pudo crear el pedido. Intenta de nuevo.' }, { status: 500 })
  }
}

async function createOrder(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const clientIp = getClientIp(req)
  try {
    await catalogLimiter.consume(clientIp)
    await catalogOrderIpLimiter.consume(clientIp)
  } catch {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta más tarde.' },
      { status: 429 },
    )
  }

  const parsedSlug = slugSchema.safeParse(params.slug)
  if (!parsedSlug.success) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const body = parsed.data

  const business = await prisma.business.findFirst({
    where: { catalog_slug: parsedSlug.data, catalog_active: true, active: true },
    select: {
      id: true, name: true, phone: true, ticket_prefix: true,
      catalog_default_currency: true,
      catalog_plan: true, subscription_active: true, subscription_expires_at: true,
    },
  })

  if (!business || !isCatalogLive(business)) {
    return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
  }

  // El método llega como texto: se resuelve por coincidencia exacta con los
  // métodos ACTIVOS de este negocio y se lee is_financing (nunca por nombre).
  const chosenMethod = await prisma.paymentMethod.findFirst({
    where:  { business_id: business.id, is_active: true, name: body.payment_method },
    select: { name: true, is_financing: true },
  })
  const isDelivery = body.delivery_type === 'delivery'
  const useSaved   = isDelivery && body.use_saved_address === true

  // Cédula OBLIGATORIA siempre (retiro y envío): V/E/J/G, sin ceros. Es la llave del cliente.
  const idCheck = checkCheckoutCedula(body.customer_cedula)
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.message, field: 'customer_cedula' }, { status: 422 })
  }
  const clientCedula = idCheck.value
  const paymentKind: PaymentKind | null = body.payment_kind ?? (chosenMethod?.is_financing ? 'cashea' : null)
  // Financiadora o Cashea declarado: además exige persona natural (V/E).
  if (chosenMethod?.is_financing || paymentKind === 'cashea') {
    const financingCheck = checkCedula(clientCedula, chosenMethod?.name ?? body.payment_method)
    if (!financingCheck.ok) {
      return NextResponse.json({ error: financingCheck.message, field: 'customer_cedula' }, { status: 422 })
    }
  }

  if (!hasUsablePhone(body.customer_phone)) {
    return NextResponse.json({ error: 'Indica un teléfono válido.', field: 'customer_phone' }, { status: 422 })
  }
  const clientPhone = normalizeClientPhone(body.customer_phone)

  // Todo envío sale por encomienda nacional: nombre y apellido, cédula, teléfono y dirección completa
  // son obligatorios (regla de servidor). Con "misma dirección" la dirección real se valida más
  // abajo, ya leída del Client; aquí solo nombre, cédula y teléfono.
  if (isDelivery) {
    const shippingError = validateShipping({
      recipient: body.recipient_name || body.customer_name,
      cedula:    clientCedula,
      phone:     body.customer_phone,
      address:   useSaved ? ADDRESS_PLACEHOLDER : body.delivery_address,
    })
    if (shippingError) {
      return NextResponse.json({ error: shippingError, field: 'delivery' }, { status: 422 })
    }
  }

  // Método de envío: si el negocio configuró métodos activos, el envío debe elegir uno suyo.
  let shippingMethod: ChosenMethod | null = null
  if (isDelivery) {
    const methods: ChosenMethod[] = await prisma.businessShippingMethod.findMany({
      where:  { business_id: business.id, active: true },
      select: { id: true, label: true, kind: true, requires_branch: true },
    })
    if (methods.length > 0) {
      shippingMethod = methods.find(m => m.id === body.shipping_method_id) ?? null
      if (!shippingMethod) {
        return NextResponse.json({ error: 'Elige un método de envío.', field: 'shipping_method_id' }, { status: 422 })
      }
      // Un método de retiro en tienda no lleva dirección de envío (y todo envío exige una).
      if (shippingMethod.kind === 'pickup') {
        return NextResponse.json(
          { error: 'Ese método es retiro en tienda: elige "Retirar en tienda" en lugar de envío.', field: 'shipping_method_id' },
          { status: 422 },
        )
      }
      if (shippingMethod.requires_branch && (body.branch_office ?? '').length < MIN_BRANCH_CHARS) {
        return NextResponse.json({ error: 'Indica la oficina de destino.', field: 'branch_office' }, { status: 422 })
      }
    }
  }
  // La oficina solo cuenta si el método la pide; el servidor la antepone a la dirección.
  const branchOffice = shippingMethod?.requires_branch ? (body.branch_office ?? '') : ''
  const withBranch = (addr: string | null): string | null => (addr && branchOffice ? `Oficina: ${branchOffice} | ${addr}` : addr)


  // Fetch canonical products from DB — never trust client-supplied prices or names
  // Ascendente: todos los pedidos piden los locks de producto en el MISMO orden ([1,2] y [2,1] no se cruzan).
  const uniqueProductIds = Array.from(new Set(body.items.map(i => i.product_id))).sort((a, b) => a - b)

  const dbProducts = await prisma.product.findMany({
    where: {
      id:              { in: uniqueProductIds },
      business_id:     business.id,
      active:          true,
      ...CATALOG_WHERE_FILTER,
    },
    select: {
      id:                 true,
      name:               true,
      sale_mode:          true,
      price_per_unit_usd: true,
      price_per_kg_usd:   true,
      category:           { select: { requires_preparation: true } },
    },
  })

  if (dbProducts.length !== uniqueProductIds.length) {
    return NextResponse.json(
      { error: 'Uno o más productos no están disponibles en este catálogo' },
      { status: 422 },
    )
  }

  const productMap = new Map(dbProducts.map(p => [p.id, p]))

  // Cashea: financiamiento activo en el negocio y NINGÚN producto excluido; si no, 409 con el producto que lo impide.
  let financingSnapshot: { provider: string; phrase: string } | null = null
  if (paymentKind === 'cashea') {
    try {
      financingSnapshot = await assertFinancingEligible(prisma, business.id, uniqueProductIds)
    } catch (err) {
      if (err instanceof FinancingError) {
        return NextResponse.json({ error: err.message, field: 'payment_kind', blocked_products: err.blockedProducts }, { status: err.status })
      }
      throw err
    }
  }

  const needsKds = dbProducts.some(p => p.category?.requires_preparation === true)

  const { rate } = await getActiveRate(business.id)

  // Reservas automáticas se atribuyen al admin del negocio — la ruta es pública, sin sesión
  const adminUser = await prisma.user.findFirst({
    where:   { business_id: business.id, is_active: true, role: { in: ['admin', 'super_admin'] } },
    orderBy: { id: 'asc' },
    select:  { id: true },
  })
  if (!adminUser) {
    return NextResponse.json({ error: 'Catálogo no disponible' }, { status: 500 })
  }

  let resolvedItems: ResolvedItem[] = []
  let order: { id: number; order_number: string; total_usd: unknown; total_bs: unknown }
  try {
    const lockKeys = webCheckoutKeys(clientCedula, body.customer_phone)
    await ensureWebCheckoutLocks(business.id, lockKeys)
    order = await prisma.$transaction(async (tx) => {
    // Serializa los pedidos web del MISMO cliente (cédula o teléfono) ANTES de la primera lectura: el tope de
    // pedidos abiertos y la creación del cliente se evalúan sobre lo ya confirmado. Es lock de DB, así que vale
    // entre procesos PM2 (los limiters en memoria no) y NO toca la fila del negocio (no frena las ventas del POS).
    await lockWebCheckout(tx, business.id, lockKeys)

    // Row lock de producto, en orden ascendente (sin deadlock entre [1,2] y [2,1]): serializa pedidos
    // concurrentes sobre el mismo producto (previene sobreventa). Va ANTES de la primera lectura
    // consistente (el conteo de abajo): los locking reads no abren el snapshot de la transacción, así que
    // stock, variantes y número de pedido se leen ya con lo que confirmó quien tenía el lock.
    for (const productId of uniqueProductIds) {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`
    }

    const openOrders = await tx.order.count({
      where: {
        business_id: business.id,
        status:      'received',
        OR: [{ client_cedula: clientCedula }, { client_phone: { in: phoneLookupVariants(body.customer_phone) } }],
      },
    })
    if (openOrders >= OPEN_ORDERS_LIMIT) {
      throw new CheckoutError(429, 'Tienes pedidos pendientes por confirmar. Espera a que el negocio los atienda.')
    }

    // Precio final por ítem: base del producto + precio_extra de la variante
    // seleccionada. El variant_id se valida contra product_id en el mismo where
    // — evita que un cliente mande el variant_id de OTRO producto para colar
    // un precio_extra ajeno (product_id ya viene tenant-verificado via dbProducts).
    const items: ResolvedItem[] = []
    for (const item of body.items) {
      const p = productMap.get(item.product_id)!

      let variantLabel: string | null = null
      const variant = item.variant_id
        ? await tx.productVariant.findFirst({
            where:  { id: item.variant_id, product_id: item.product_id, is_active: true },
            select: { stock: true, valor: true, ...VARIANT_PRICING_SELECT },
          })
        : null
      if (variant) {
        variantLabel = variant.valor
        if (variant.stock < item.qty) {
          throw new Error(`STOCK_INSUFICIENTE:${p.name} (${variant.valor})`)
        }
      }
      // Regla única en lib/pricing.ts (catálogo público = precio detal).
      const finalPrice = resolveUnitPriceUsd(p, variant ?? undefined)

      items.push({
        product_id:    item.product_id,
        product_name:  p.name,
        qty:           item.qty,
        price_usd:     finalPrice,
        subtotal_usd:  Math.round(item.qty * finalPrice * 100) / 100,
        variant_id:    item.variant_id ?? null,
        variant_label: variantLabel,
      })
    }
    resolvedItems = items

    let candidateNumber = await generateOrderNumber(business.id, business.ticket_prefix, tx)

    const stockAgg = await tx.inventoryEntry.groupBy({
      by:    ['product_id'],
      where: { business_id: business.id, product_id: { in: uniqueProductIds } },
      _sum:  { quantity: true, waste: true },
    })
    const stockMap = new Map(
      stockAgg.map(s => [s.product_id, Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0)]),
    )

    // Solo para ítems SIN variante: su stock vive en inventory_entries. Un ítem
    // CON variante ya se validó arriba contra product_variants.stock, que es su
    // única fuente autoritativa -- volver a medirlo por el agregado del padre
    // (que se queda en 0) rechazaba con 409 "Stock insuficiente" todo pedido de
    // un producto con tallas, aunque las tallas tuvieran unidades. Misma regla
    // que effectiveStock() en lib/catalog.ts.
    for (const item of resolvedItems) {
      if (item.variant_id !== null) continue
      const available = stockMap.get(item.product_id) ?? 0
      if (available < item.qty) {
        throw new Error(`STOCK_INSUFICIENTE:${item.product_name}`)
      }
    }

    const totalUsd = Math.round(
      resolvedItems.reduce((s, i) => s + i.subtotal_usd, 0) * 100,
    ) / 100
    const totalBs = Math.round(totalUsd * rate * 100) / 100

    // Cliente por CÉDULA normalizada (teléfono solo como respaldo). El Client conserva su nombre y su
    // dirección: el pedido guarda lo tecleado y, si la cédula ya existía con otro nombre, va con alerta.
    const client = await resolveWebClient(tx, {
      businessId: business.id,
      cedula:     clientCedula,
      phone:      body.customer_phone,
      name:       body.customer_name,
      newAddress: isDelivery && !useSaved ? (body.delivery_address ?? null) : null,
      canCreate:  !useSaved,
    })

    // "Misma dirección": sale del Client (por business_id), nunca del body. Solo se honra si la cédula Y el
    // teléfono son del MISMO cliente (igual que /saved-address), el nombre coincide en ≥ 2 palabras y la
    // dirección es válida; si no, 422 genérico idéntico en todos los casos (no es un oráculo).
    let shipAddress: string | null = isDelivery ? withBranch(body.delivery_address ?? null) : null
    if (useSaved) {
      const saved = client?.address ?? null
      const samePhone = !!client?.phone && normalizeClientPhone(client.phone) === clientPhone
      const sameFullName = !!client && sameName(body.customer_name, client.name, MIN_NAME_WORDS)
      if (!client || !samePhone || !sameFullName || !saved || validateAddress(saved) !== null) {
        throw new CheckoutError(422, SAVED_ADDRESS_MESSAGE, 'delivery_address')
      }
      shipAddress = withBranch(saved)
    }
    if (!client) throw new CheckoutError(422, SAVED_ADDRESS_MESSAGE, 'delivery_address')
    const clientId = client.id

    const noteLines = [
      `Método de pago: ${body.payment_method}`,
      body.notes ?? '',
    ].filter(Boolean).join('\n')

    const createWithNumber = (order_number: string) => tx.order.create({
      data: {
        business_id:    business.id,
        order_number,
        status:         'received',
        origin:         'catalog',
        client_id:      clientId,
        client_name:    body.customer_name,
        client_phone:   clientPhone,
        client_address: body.customer_reference,
        client_cedula:  clientCedula,
        delivery_type:    body.delivery_type,
        recipient_name:   isDelivery ? (body.recipient_name || body.customer_name) : (body.recipient_name ?? null),
        delivery_address: shipAddress,
        // Snapshot de envío: lo capturado en ESTE pedido (el Client puede cambiar después).
        ship_nombre:     isDelivery ? (body.recipient_name || body.customer_name) : null,
        ship_cedula:     isDelivery ? clientCedula : null,
        ship_telefono:   isDelivery ? clientPhone : null,
        ship_direccion:  isDelivery ? shipAddress : null,
        ship_metodo_id:  isDelivery ? (shippingMethod?.id ?? null) : null,
        // Congelado: si el negocio renombra o borra el método, el pedido conserva el que se eligió.
        ship_metodo_label: isDelivery ? (shippingMethod?.label ?? null) : null,
        ship_metodo_kind:  isDelivery ? (shippingMethod?.kind ?? null) : null,
        // La cédula ya existía con OTRO nombre: aviso para el negocio, nunca visible al público.
        cedula_alert:    client.nameMismatch,
        notes:          noteLines,
        total_usd:      totalUsd,
        total_bs:       totalBs,
        rate_used:      rate,
        send_to_kds:    needsKds,
        // Lo declarado en el checkout; con Cashea queda 'requested' y el snapshot de proveedor y frase.
        payment_kind:   paymentKind,
        ...(financingSnapshot
          ? { financing_status: 'requested', financing_provider: financingSnapshot.provider, financing_phrase: financingSnapshot.phrase }
          : {}),
        items: {
          create: resolvedItems.map(item => ({
            product_id:         item.product_id,
            product_name:       item.product_name,
            variant_id:         item.variant_id,
            variant_label:      item.variant_label,
            quantity:           item.qty,
            price_per_unit_usd: item.price_usd,
            subtotal_usd:       item.subtotal_usd,
          })),
        },
      },
      select: {
        id:           true,
        order_number: true,
        total_usd:    true,
        total_bs:     true,
      },
    })

    // Los puntos de cédula y teléfono se gastan AL FINAL, cuando el pedido ya pasó todas las validaciones
    // (ítems, método, stock, tope, dirección guardada): un tercero no puede agotar los puntos de una víctima
    // con pedidos inválidos.
    try {
      await catalogOrderCedulaLimiter.consume(`${parsedSlug.data}:${clientCedula}`)
      await catalogOrderPhoneLimiter.consume(`${parsedSlug.data}:${clientPhone}`)
    } catch {
      throw new CheckoutError(429, 'Demasiados intentos. Intenta más tarde.')
    }

    // El número sale de una lectura previa: otro pedido (web o del POS) pudo tomarlo. En MySQL/MariaDB un
    // error de unicidad deshace solo esa sentencia (la transacción sigue viva), así que se reintenta con el
    // siguiente número; agotados los intentos → 503 "reintenta", nunca 500.
    let newOrder: Awaited<ReturnType<typeof createWithNumber>> | null = null
    for (let attempt = 0; newOrder === null; attempt++) {
      try {
        newOrder = await createWithNumber(candidateNumber)
      } catch (err) {
        if (!isOrderNumberTaken(err)) throw err
        if (attempt >= MAX_NUMBER_RETRIES) throw new WebCheckoutBusyError()
        candidateNumber = bumpOrderNumber(business.ticket_prefix, candidateNumber)
      }
    }
    if (newOrder === null) throw new WebCheckoutBusyError()

    await tx.inventoryEntry.createMany({
      data: resolvedItems.map(item => ({
        business_id: business.id,
        product_id:  item.product_id,
        quantity:    -Number(item.qty),
        waste:       0,
        entry_type:  'reservation',
        notes:       `Reserva pedido catálogo #${newOrder.order_number}`,
        created_by:  adminUser.id,
      })),
    })

    return newOrder
    }, { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS })
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, field: err.field }, { status: err.status })
    }
    if (err instanceof WebCheckoutBusyError ||
        (err instanceof Prisma.PrismaClientKnownRequestError && CONTENTION_CODES.includes(err.code))) {
      logError('catalog order contention', err)
      return NextResponse.json({ error: BUSY_MESSAGE }, { status: 503, headers: { 'Retry-After': '2' } })
    }
    if (err instanceof Error && err.message.startsWith('STOCK_INSUFICIENTE:')) {
      return NextResponse.json(
        { error: `Stock insuficiente: ${err.message.split(':')[1]}` },
        { status: 409 },
      )
    }
    logError('catalog order error', err)
    return NextResponse.json({ error: 'No se pudo crear el pedido. Intenta de nuevo.' }, { status: 500 })
  }

  const waMessage = buildWhatsAppMessage({
    kind:         'pedido',
    audience:     'business',
    orderNumber:  order.order_number,
    clientName:   body.customer_name,
    clientPhone:  body.customer_phone,
    clientCedula,
    sector:       body.customer_reference,
    lines:        resolvedItems.map(i => ({
      name:         i.product_name,
      qty:          i.qty,
      subtotalUsd:  i.subtotal_usd,
      variantLabel: i.variant_label,
    })),
    totalUsd:     Number(order.total_usd),
    rate,
    paymentMethod: body.payment_method,
    fulfillment:  body.delivery_type === 'delivery'
      ? {
          type: 'delivery',
          recipient: body.recipient_name,
          // Con "misma dirección" el texto guardado NO viaja en el enlace de WhatsApp (iría a quien conozca la cédula).
          address: withBranch(useSaved ? 'Misma dirección de pedidos anteriores' : (body.delivery_address ?? null)),
          // Solo en este mensaje al negocio; el ticket de envío (shippingCopyText) sigue con sus 4 datos.
          method:  shippingMethod?.label ?? null,
        }
      : { type: 'pickup' },
    notes:        body.notes,
  })

  // null si el negocio no tiene un WhatsApp válido: el carrito ya avisa en ese caso.
  const whatsapp_url = whatsappUrl(business.phone, waMessage)

  return NextResponse.json(
    {
      ok:            true,
      order_id:      order.id,
      ticket_number: order.order_number,
      whatsapp_url,
    },
    { status: 201 },
  )
}
