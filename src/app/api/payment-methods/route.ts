import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { readCobroEffective } from '@/lib/cobro-precios'

export async function GET() {
  try {
    const { db, session } = await getAuthenticatedTenant()

    const methods = await db.paymentMethod.findMany({
      where: { is_active: true }, // business_id inyectado por el tenant layer
      orderBy: { sort_order: 'asc' },
      select: { id: true, name: true, type: true, sort_order: true, is_active: true, is_financing: true },
    })

    // Configuración › Cobro y precios: Cashea apagado = ninguna financiadora en el POS.
    const business = await prisma.business.findUnique({ where: { id: session.businessId }, select: { settings: true } })
    const { casheaActive } = readCobroEffective(business?.settings)
    return NextResponse.json({ ok: true, methods: methods.filter(m => !m.is_financing || casheaActive) })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
