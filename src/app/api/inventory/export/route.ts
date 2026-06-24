import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function safe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const sp          = req.nextUrl.searchParams
  const productFilter = sp.get('product')?.trim() || null
  const typeFilter    = sp.get('type')             // 'entry' | 'adjust' | null
  const fromStr       = sp.get('from')
  const toStr         = sp.get('to')

  const fromDate = fromStr && dateRegex.test(fromStr) ? new Date(`${fromStr}T00:00:00`) : null
  const toDate   = toStr   && dateRegex.test(toStr)   ? new Date(`${toStr}T23:59:59.999`) : null

  const bid = session.businessId

  const entries = await prisma.inventoryEntry.findMany({
    where: {
      business_id: bid,
      ...(fromDate && toDate ? { entered_at: { gte: fromDate, lte: toDate } } : {}),
      ...(productFilter ? { product: { name: { contains: productFilter } } } : {}),
      ...(typeFilter === 'entry'  ? { quantity: { gt: 0 } } : {}),
      ...(typeFilter === 'adjust' ? { quantity: { lt: 0 } } : {}),
    },
    include: {
      product: { select: { name: true, sku: true } },
      user:    { select: { name: true } },
    },
    orderBy: { entered_at: 'desc' },
    take: 5000,
  })

  const fileSuffix = fromStr && toStr ? `${fromStr}-${toStr}` : new Date().toISOString().slice(0, 10)

  const rows = entries.map(e => {
    const qty      = Number(e.quantity)
    const cost     = e.cost_per_unit_usd != null ? Number(e.cost_per_unit_usd) : null
    const totalUsd = cost != null ? Math.abs(qty) * cost : null
    return {
      'Fecha':        e.entered_at.toISOString().slice(0, 16).replace('T', ' '),
      'Producto':     safe(e.product.name),
      'SKU':          safe(e.product.sku ?? ''),
      'Tipo':         qty >= 0 ? 'Entrada' : 'Ajuste',
      'Cantidad':     qty,
      'Costo/u USD':  cost ?? '',
      'Proveedor':    safe(e.supplier ?? ''),
      'Notas':        safe(e.notes ?? ''),
      'Usuario':      safe(e.user.name),
      'Total USD':    totalUsd != null ? Math.round(totalUsd * 10000) / 10000 : '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin registros': fileSuffix }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')

  const raw    = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
  const buffer = new Uint8Array(raw)

  return new Response(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inventario-${fileSuffix}.xlsx"`,
    },
  })
}
