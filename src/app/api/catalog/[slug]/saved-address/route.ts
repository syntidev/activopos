import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { savedAddressCedulaLimiter, savedAddressIpLimiter, getClientIp } from '@/lib/rate-limit'
import { isCatalogLive } from '@/lib/catalog'
import { checkCheckoutCedula, hasUsablePhone, phoneLookupVariants } from '@/lib/customer-identity'
import { validateAddress } from '@/lib/shipping'
import type { SavedAddressResponse } from '@/types/shipping'

/**
 * POST /api/catalog/[slug]/saved-address  { customer_cedula, customer_phone }  →  { has_saved_address: boolean }
 *
 * Única consulta pública sobre clientes. Para no ser un oráculo de cédulas:
 *  - exige cédula Y teléfono: solo hay "true" si ambos corresponden al MISMO cliente (conocer solo la
 *    cédula no revela nada, ni siquiera que existe);
 *  - responde SIEMPRE 200 con la misma forma: cédula o teléfono inválidos, negocio inexistente, cliente
 *    sin dirección, cédula desconocida o teléfono que no coincide dan exactamente { has_saved_address: false };
 *  - nunca devuelve la dirección, el nombre ni ningún otro dato;
 *  - tiempo de respuesta con piso fijo (la rama "existe" y la "no existe" no se distinguen por latencia);
 *  - limitada por IP y por slug+cédula (RateLimiterMemory: por proceso, ver rate-limit.ts).
 * El POST del pedido hace la comprobación definitiva (nombre y dirección válida): aquí "true" solo
 * significa "vale la pena ofrecer 'misma dirección'".
 */

const slugSchema = z.string().regex(/^[a-z0-9-]{3,50}$/)
const bodySchema = z.object({ customer_cedula: z.string().max(20), customer_phone: z.string().max(20) })
const MIN_RESPONSE_MS = 150

async function respond(startedAt: number, has: boolean): Promise<NextResponse> {
  const wait = startedAt + MIN_RESPONSE_MS - Date.now()
  if (wait > 0) await new Promise<void>(resolve => setTimeout(resolve, wait))
  const body: SavedAddressResponse = { has_saved_address: has }
  return NextResponse.json(body)
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }): Promise<NextResponse> {
  const startedAt = Date.now()
  try {
    await savedAddressIpLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
  }

  const slug = slugSchema.safeParse(params.slug)
  if (!slug.success) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return respond(startedAt, false)
  const cedula = checkCheckoutCedula(parsed.data.customer_cedula)
  if (!cedula.ok || !hasUsablePhone(parsed.data.customer_phone)) return respond(startedAt, false)
  const phoneVariants = phoneLookupVariants(parsed.data.customer_phone)

  try {
    await savedAddressCedulaLimiter.consume(`${slug.data}:${cedula.value}`)
  } catch {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
  }

  try {
    const business = await prisma.business.findFirst({
      where:  { catalog_slug: slug.data, catalog_active: true, active: true },
      select: {
        id: true, catalog_plan: true, subscription_active: true, subscription_expires_at: true,
      },
    })
    if (!business || !isCatalogLive(business)) return respond(startedAt, false)

    const client = await prisma.client.findFirst({
      where:   { business_id: business.id, cedula: cedula.value, phone: { in: phoneVariants }, address: { not: null } },
      orderBy: [{ verified: 'desc' }, { id: 'asc' }],
      select:  { address: true },
    })
    return respond(startedAt, !!client && validateAddress(client.address) === null)
  } catch (err) {
    console.error('saved-address error:', err)
    return respond(startedAt, false)
  }
}
