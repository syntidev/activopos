import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Step {
  id:        string
  label:     string
  completed: boolean
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const bid = session.businessId

  const [business, productCount, paymentCount, saleCount] = await Promise.all([
    prisma.business.findUnique({
      where:  { id: bid },
      select: { name: true, logo_path: true, catalog_active: true },
    }),
    prisma.product.count({
      where: { business_id: bid, active: true },
    }),
    prisma.paymentMethod.count({
      where: { business_id: bid, is_active: true },
    }),
    prisma.sale.count({
      where: { business_id: bid, status: 'paid' },
    }),
  ])

  const steps: Step[] = [
    {
      id:        'business',
      label:     'Configura tu negocio',
      completed: Boolean(
        business && business.name !== 'Mi Negocio' && business.logo_path != null
      ),
    },
    {
      id:        'product',
      label:     'Crea tu primer producto',
      completed: productCount > 0,
    },
    {
      id:        'payment',
      label:     'Configura métodos de pago',
      completed: paymentCount > 0,
    },
    {
      id:        'sale',
      label:     'Registra tu primera venta',
      completed: saleCount > 0,
    },
    {
      id:        'catalog',
      label:     'Activa tu catálogo digital',
      completed: Boolean(business?.catalog_active),
    },
  ]

  const completedCount = steps.filter(s => s.completed).length
  const progress       = Math.round((completedCount / steps.length) * 100)

  return NextResponse.json({
    ok:           true,
    steps,
    progress,
    all_complete: completedCount === steps.length,
  })
}
