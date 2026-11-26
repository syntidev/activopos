import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { planDenied } from '@/lib/plan-guard'
import { ENTITLEMENT_SELECT, entitlementDeniedReason, hasEntitlement } from '@/lib/entitlements'
import { getClientIp, restauranteToggleLimiter } from '@/lib/rate-limit'
import { badRequest, countOpenTableAccounts, readJson } from '@/lib/restaurante-server'

const bodySchema = z.object({
  enabled:    z.boolean(),
  /** Solo al activar: suma "kds" a modules_enabled (el mismo CSV que usa Configuración › Módulos). */
  enable_kds: z.boolean().optional(),
})

/**
 * POST /api/restaurante/activacion — activa o desactiva el módulo Restaurante del negocio de la sesión.
 * Es la ÚNICA ruta de tenant que escribe Business.restaurante_enabled. Solo admin y super_admin.
 * Activar pasa por el gate de plan (PLAN_LIMITS.restaurante, mismo mecanismo que los módulos de pago);
 * desactivar nunca borra datos y se bloquea si hay cuentas de mesa abiertas.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  try {
    await restauranteToggleLimiter.consume(String(session.businessId))
  } catch {
    return NextResponse.json({ error: 'Demasiados cambios seguidos. Espera un minuto.' }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error)
  const { enabled, enable_kds } = parsed.data

  try {
    const current = await prisma.business.findUnique({
      where:  { id: session.businessId },
      select: ENTITLEMENT_SELECT,
    })
    if (!current) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const modules = (current.modules_enabled ?? '').split(',').filter(Boolean)
    if (current.restaurante_enabled === enabled) {
      return NextResponse.json({ ok: true, changed: false, restaurante_enabled: enabled, modules_enabled: modules })
    }

    if (enabled) {
      // Derecho (plan Operación o el que PLAN_LIMITS.restaurante habilite) con suscripción vigente: lo lee el servidor de la DB, nunca del cliente.
      // restaurante_enabled es la PREFERENCIA del tenant; el derecho no se puede dar uno mismo.
      if (!hasEntitlement(current, 'restaurante')) return planDenied(entitlementDeniedReason(current, 'restaurante'))
    } else {
      const open = await countOpenTableAccounts(session.businessId)
      if (open > 0) {
        return NextResponse.json({
          error: `Hay ${open} ${open === 1 ? 'cuenta de mesa abierta' : 'cuentas de mesa abiertas'}. Ciérralas antes de desactivar el módulo.`,
          code: 'OPEN_ACCOUNTS', open_accounts: open,
        }, { status: 409 })
      }
    }

    const nextModules = enabled && enable_kds === true && hasEntitlement(current, 'kds') && !modules.includes('kds') ? [...modules, 'kds'] : modules
    await prisma.$transaction([
      prisma.business.update({
        where: { id: session.businessId },
        data:  { restaurante_enabled: enabled, modules_enabled: nextModules.join(',') },
      }),
      prisma.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id:     session.userId,
          action:      'restaurante_toggle',
          model_type:  'business',
          model_id:    session.businessId,
          old_values:  { restaurante_enabled: current.restaurante_enabled, modules_enabled: current.modules_enabled },
          new_values:  { restaurante_enabled: enabled, modules_enabled: nextModules.join(',') },
          ip_address:  getClientIp(req),
        },
      }),
    ])

    return NextResponse.json({ ok: true, changed: true, restaurante_enabled: enabled, modules_enabled: nextModules })
  } catch (err) {
    console.error('[restaurante] POST /api/restaurante/activacion falló:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
