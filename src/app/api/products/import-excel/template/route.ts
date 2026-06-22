import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const headers = ['nombre', 'precio_usd', 'costo_usd', 'stock', 'categoria', 'product_type', 'unit_label']

  const examples = [
    ['Café Americano',   3.50,  1.20, 100, 'Bebidas',   'simple',     'und'],
    ['Azúcar (kg)',      1.80,  0.90,  50, 'Insumos',   'simple',     'kg' ],
    ['Combo Desayuno',  5.00,  2.50,   0, 'Combos',    'combo',      'und'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])

  // Column widths
  ws['!cols'] = [
    { wch: 25 }, // nombre
    { wch: 12 }, // precio_usd
    { wch: 12 }, // costo_usd
    { wch:  8 }, // stock
    { wch: 18 }, // categoria
    { wch: 14 }, // product_type
    { wch: 12 }, // unit_label
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')

  const raw    = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
  const buffer = new Uint8Array(raw)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_productos.xlsx"',
    },
  })
}
