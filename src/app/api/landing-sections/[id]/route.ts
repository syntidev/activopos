import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { checkPlanLimit, planDenied } from '@/lib/plan-guard'
import { CONFIG_SCHEMAS, isSectionType } from '@/lib/landing-sections'

const patchSchema = z.object({
  config:  z.record(z.string(), z.unknown()).optional(),
  visible: z.boolean().optional(),
  order:   z.number().int().min(0).optional(),
}).strict()

type RouteContext = { params: { id: string } }

const parseId = (raw: string) => {
  const id = parseInt(raw)
  return isNaN(id) ? null : id
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const planCheck = await checkPlanLimit('access_landing_sections')
    if (!planCheck.allowed) return planDenied(planCheck.reason)

    let body: z.infer<typeof patchSchema>
    try {
      body = patchSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      }
      throw err
    }

    const existing = await db.landingSection.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    let config: Record<string, unknown> | undefined
    if (body.config !== undefined) {
      if (!isSectionType(existing.type)) {
        return NextResponse.json({ error: 'Tipo de sección desconocido' }, { status: 500 })
      }
      const configParsed = CONFIG_SCHEMAS[existing.type].safeParse(body.config)
      if (!configParsed.success) {
        return NextResponse.json(
          { error: 'Config inválida para el tipo de sección', issues: configParsed.error.issues },
          { status: 400 },
        )
      }
      config = configParsed.data
    }

    const section = await db.landingSection.update({
      where: { id }, // business_id inyectado
      data: {
        ...(config !== undefined       ? { config }                : {}),
        ...(body.visible !== undefined ? { visible: body.visible } : {}),
        ...(body.order   !== undefined ? { order:   body.order   } : {}),
      },
    })

    return NextResponse.json({ ok: true, section })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.landingSection.findFirst({
      where: { id }, // business_id inyectado por el tenant layer
    })
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await db.landingSection.delete({ where: { id } }) // business_id inyectado

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
