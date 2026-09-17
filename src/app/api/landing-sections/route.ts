import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { SECTION_TYPES, CONFIG_SCHEMAS } from '@/lib/landing-sections'

const postSchema = z.object({
  type:    z.enum(SECTION_TYPES),
  config:  z.record(z.string(), z.unknown()),
  visible: z.boolean().optional(),
}).strict()

export async function GET() {
  try {
    const { db } = await getAuthenticatedTenant()

    const sections = await db.landingSection.findMany({
      orderBy: { order: 'asc' }, // business_id inyectado por el tenant layer
    })

    return NextResponse.json({ ok: true, sections })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const planCheck = await checkPlanLimit('access_landing_sections')
    if (!planCheck.allowed) return planDenied(planCheck.reason)

    let body: z.infer<typeof postSchema>
    try {
      body = postSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const configParsed = CONFIG_SCHEMAS[body.type].safeParse(body.config)
    if (!configParsed.success) {
      return NextResponse.json(
        { error: 'Config inválida para el tipo de sección', issues: configParsed.error.issues },
        { status: 400 },
      )
    }

    // Append al final — el orden existente se reordena vía PATCH, no aquí.
    const order = await db.landingSection.count() // business_id inyectado

    const section = await db.landingSection.create({
      data: {
        business_id: session.businessId, // explícito: el tipo de create lo exige; la capa re-inyecta igual valor
        type:        body.type,
        config:      configParsed.data,
        order,
        visible:     body.visible ?? true,
      },
    })

    return NextResponse.json({ ok: true, section }, { status: 201 })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
