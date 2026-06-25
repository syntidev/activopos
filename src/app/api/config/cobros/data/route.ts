import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Schema nested — coincide exactamente con CobrosFormData en TabCobros.tsx
const PagoMovilSchema = z.object({
  banco:                z.string().max(10).default(''),
  telefono:             z.string().max(16).default(''),
  usa_whatsapp_negocio: z.boolean().default(false),
  titular:              z.string().max(80).default(''),
  tipo_doc:             z.string().max(2).default('V'),
  documento:            z.string().max(12).default(''),
})

const SimplePaySchema = z.object({
  contacto: z.string().max(120).default(''),
  titular:  z.string().max(80).default(''),
})

const UsdtSchema = z.object({
  wallet:  z.string().max(100).default(''),
  red:     z.string().max(10).default('TRC20'),
  titular: z.string().max(80).default(''),
})

const CobroDataSchema = z.object({
  pago_movil: PagoMovilSchema.optional(),
  zelle:      SimplePaySchema.optional(),
  zinli:      SimplePaySchema.optional(),
  paypal:     SimplePaySchema.optional(),
  binance:    SimplePaySchema.optional(),
  usdt:       UsdtSchema.optional(),
})

const EMPTY_COBROS = {
  pago_movil: { banco: '', telefono: '', usa_whatsapp_negocio: false, titular: '', tipo_doc: 'V', documento: '' },
  zelle:      { contacto: '', titular: '' },
  zinli:      { contacto: '', titular: '' },
  paypal:     { contacto: '', titular: '' },
  binance:    { contacto: '', titular: '' },
  usdt:       { wallet: '', red: 'TRC20', titular: '' },
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { cobro_data: true },
  })

  const stored = business?.cobro_data
  // Si cobro_data tiene formato nested (key 'pago_movil') → devolverlo.
  // Si es null o el formato flat legacy → devolver EMPTY_COBROS.
  const isNested = stored !== null &&
    typeof stored === 'object' &&
    !Array.isArray(stored) &&
    'pago_movil' in (stored as Record<string, unknown>)

  return NextResponse.json({ ok: true, data: isNested ? stored : EMPTY_COBROS })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let incoming: z.infer<typeof CobroDataSchema>
  try {
    incoming = CobroDataSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    throw err
  }

  // Merge top-level para preservar otras keys de cobro_data (e.g. payment-methods)
  const current = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { cobro_data: true },
  })

  const merged = Object.assign({}, current?.cobro_data ?? {}, incoming)

  const updated = await prisma.business.update({
    where:  { id: session.businessId },
    data:   { cobro_data: merged },
    select: { cobro_data: true },
  })

  return NextResponse.json({ ok: true, data: updated.cobro_data })
}
