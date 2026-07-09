import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const rows = await prisma.blogPost.findMany({
    where:    { category: { not: null } },
    select:   { category: true },
    distinct: ['category'],
    orderBy:  { category: 'asc' },
  })

  return NextResponse.json({ categories: rows.map(r => r.category as string) })
}
