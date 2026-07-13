import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    // No hay query a DB — plantilla estática; solo se valida sesión + rol
    const { session } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    // Orden de columnas = orden que espera el import Y que emite el export.
    // Mantener sincronizado con validateRow (import-excel) y export/route.ts
    // para round-trip sin fricción.
    const headers = [
      'nombre', 'precio_usd', 'costo_usd', 'stock', 'categoria', 'product_type', 'unit_label',
      'wholesale_price_usd', 'wholesale_price_per_kg_usd', 'location', 'notes',
    ]

    const examples = [
      ['Café Americano',  3.50, 1.20, 100, 'Bebidas', 'simple', 'und', 2.80, '',   'Pasillo 2, Estante A', 'Producto de temporada'],
      ['Azúcar (kg)',     1.80, 0.90,  50, 'Insumos', 'simple', 'kg',  '',   1.50, 'Depósito, Estante B',  'Venta a granel'],
      ['Combo Desayuno',  5.00, 2.50,   0, 'Combos',  'combo',  'und', 4.20, '',   'Mostrador',            'Combo promocional'],
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
      { wch: 20 }, // wholesale_price_usd
      { wch: 24 }, // wholesale_price_per_kg_usd
      { wch: 22 }, // location
      { wch: 24 }, // notes
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
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
