import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { handleReservaError, requireReservasAccess } from '@/lib/reservas'
import { KitConfigSchema, EMPTY_KIT_CONFIG } from '@/lib/kit-config'

// Admin GET/PATCH de la config del microsite /kit-200k. business_id SIEMPRE
// de getSession() (vía requireReservasAccess) -- nunca de body/query (regla
// sellada CLAUDE.md). Mismo gate que el resto del módulo de Reservas: rol
// cashier sin permiso, y Business.reservas_enabled=false con el mismo
// mensaje ya usado en /api/reservas -- este endpoint configura un módulo que
// solo existe si Reservas está habilitado para el negocio, así que no tiene
// sentido editarlo con el módulo apagado.
// PATCH reemplaza el blob completo (no merge parcial): es un solo formulario
// de 7 campos, se guarda entero cada vez -- no hay subsecciones independientes
// como en cobro_data.

export async function GET() {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { session } = access

    const business = await prisma.business.findUnique({
      where:  { id: session.businessId },
      select: { kit200k_config: true },
    })

    const stored = business?.kit200k_config
    const isValid = stored !== null && typeof stored === 'object' && !Array.isArray(stored) &&
      KitConfigSchema.safeParse(stored).success

    return NextResponse.json({ ok: true, config: isValid ? stored : EMPTY_KIT_CONFIG })
  } catch (err) {
    return handleReservaError(err, 'GET /api/config/kit200k')
  }
}

export async function PATCH(req: Request) {
  try {
    const access = await requireReservasAccess()
    if (access instanceof NextResponse) return access
    const { session } = access

    let data: z.infer<typeof KitConfigSchema>
    try {
      data = KitConfigSchema.parse(await req.json())
    } catch (err) {
      if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
      throw err
    }

    const business = await prisma.business.update({
      where:  { id: session.businessId },
      data:   { kit200k_config: data },
      select: { kit200k_config: true },
    })

    return NextResponse.json({ ok: true, config: business.kit200k_config })
  } catch (err) {
    return handleReservaError(err, 'PATCH /api/config/kit200k')
  }
}
