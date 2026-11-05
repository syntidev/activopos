import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { signToken, setSessionCookie } from '@/lib/auth'
import { onboardingLimiter, getClientIp } from '@/lib/rate-limit'
import { sendRegistrationConfirmationEmail, sendNewBusinessAlertEmail } from '@/lib/mail'
import { PAYMENT_TYPE_IDS, SEGMENT_MAX_LEN, createTenant } from '@/lib/tenant-create'

const PaymentMethodSchema = z.object({
  type:        z.enum(PAYMENT_TYPE_IDS),
  bankCode:    z.string().optional(),
  bankName:    z.string().optional(),
  phoneNumber: z.string().optional(),
  email:       z.string().email().optional().or(z.literal('')),
  detail:      z.string().optional(),
})

const OnboardingSchema = z.object({
  owner_name:     z.string().trim().min(2).max(100),
  business_name:  z.string().trim().min(2).max(100),
  business_slug:  z.string().regex(/^[a-z0-9-]+$/).min(3).max(50),
  email:          z.string().email(),
  password:       z.string().min(8),
  business_type:  z.string().min(1),
  sells_products: z.boolean().default(true),
  sells_services: z.boolean().default(false),
  sells_food:     z.boolean().default(false),
  city:           z.string().trim().max(80).optional(),
  description:    z.string().trim().max(500).optional(),
  // Extendido Sprint Día 2 — ver notas de persistencia en src/lib/tenant-create.ts
  subSegment:     z.string().max(SEGMENT_MAX_LEN).optional(),
  // Sin columna propia: comparte Business.segment con subSegment (una sola VarChar(40)), así que
  // el macro-bucket (productos/servicios/comida/mixto) NO se persiste — requiere columna nueva, fuera de este sprint.
  segment:        z.string().optional(),
  categories:     z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  paymentMethods: z.array(PaymentMethodSchema).max(10).optional(),
  schedule:       z.enum(['always', 'custom']).optional(),      // sin columna — no se persiste
  scheduleConfig: z.record(z.string(), z.unknown()).optional(),  // sin columna — no se persiste
})

export async function POST(req: NextRequest) {
  try {
    await onboardingLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  let data: z.infer<typeof OnboardingSchema>
  try {
    data = OnboardingSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    throw err
  }

  // data.schedule / data.scheduleConfig: sin columna en Business — no se persiste este sprint (gap documentado)
  const created = await createTenant({
    ownerName:      data.owner_name,
    businessName:   data.business_name,
    slug:           data.business_slug,
    email:          data.email,
    password:       data.password,
    businessType:   data.business_type,
    subSegment:     data.subSegment,
    city:           data.city,
    description:    data.description,
    categories:     data.categories,
    paymentMethods: data.paymentMethods,
  })
  if (!created.ok) {
    return NextResponse.json({ error: created.error, ...(created.field ? { field: created.field } : {}) }, { status: created.status })
  }
  const { business, user } = created

  const token = await signToken({
    userId:               user.id,
    businessId:           business.id,
    role:                 'admin',
    name:                 user.name,
    onboardingCompleted:  true,
  })

  setSessionCookie(token)

  // Correos best-effort — un fallo de SMTP nunca debe tumbar un registro ya persistido
  const createdAt = new Date()
  Promise.all([
    sendRegistrationConfirmationEmail(user.email, data.owner_name, data.business_name),
    sendNewBusinessAlertEmail(data.business_name, business.catalog_plan ?? 'trial', createdAt),
  ]).catch(err => {
    console.error('[onboarding/setup] fallo envío de correo (no bloqueante):', err)
  })

  return NextResponse.json(
    { ok: true, business_id: business.id, user_id: user.id },
    { status: 201 }
  )
}
