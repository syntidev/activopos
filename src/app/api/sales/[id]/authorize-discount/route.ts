import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  pin:          z.string().min(1).max(20),
  discount_pct: z.number().min(0.01).max(100),
})

type RouteContext = { params: { id: string } }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const saleId = parseInt(params.id, 10)
  if (isNaN(saleId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = schema.parse(await req.json())

    const [sale, business, users] = await Promise.all([
      prisma.sale.findFirst({
        where: { id: saleId, business_id: session.businessId },
        select: { id: true, status: true, total_usd: true, total_bs: true, rate_used: true },
      }),
      prisma.business.findUnique({
        where: { id: session.businessId },
        select: { max_discount_pct: true },
      }),
      prisma.user.findMany({
        where: { business_id: session.businessId, is_active: true },
        select: { id: true, name: true, role: true, password: true },
      }),
    ])

    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (sale.status === 'paid') {
      return NextResponse.json({ error: 'La venta ya fue cobrada' }, { status: 409 })
    }
    if (sale.status === 'cancelled') {
      return NextResponse.json({ error: 'La venta está anulada' }, { status: 409 })
    }

    // Find the user whose PIN matches
    let authorizer: { id: number; name: string; role: string } | null = null
    for (const user of users) {
      const matches = await bcrypt.compare(body.pin, user.password)
      if (matches) {
        authorizer = { id: user.id, name: user.name, role: user.role }
        break
      }
    }

    if (!authorizer) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }

    const maxPct = business?.max_discount_pct ?? 0
    const isAdmin = authorizer.role === 'admin' || authorizer.role === 'super_admin'

    // Cashiers can only authorize up to max_discount_pct
    if (!isAdmin && body.discount_pct > maxPct) {
      return NextResponse.json(
        {
          error: `Descuento ${body.discount_pct}% supera el máximo permitido (${maxPct}%). Se requiere PIN de administrador.`,
        },
        { status: 403 }
      )
    }

    // Apply discount: update sale totals
    const factor = 1 - body.discount_pct / 100
    const originalUsd = Number(sale.total_usd)
    const newTotalUsd = Math.round(originalUsd * factor * 100) / 100
    const newTotalBs  = Math.round(newTotalUsd * Number(sale.rate_used) * 100) / 100

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        discount_pct:     body.discount_pct,
        discount_auth_by: authorizer.id,
        total_usd:        newTotalUsd,
        total_bs:         newTotalBs,
      },
    })

    return NextResponse.json({
      ok:              true,
      authorized_by:   authorizer.name,
      discount_pct:    body.discount_pct,
      new_total_usd:   newTotalUsd,
      new_total_bs:    newTotalBs,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('authorize-discount error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
