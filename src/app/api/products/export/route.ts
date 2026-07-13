import { NextResponse } from 'next/server'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import * as XLSX from 'xlsx'

// Exporta el catálogo en el MISMO orden de columnas que el template de import
// (import-excel/template). Round-trip: exportar → editar en Excel → reimportar
// sin fricción. Mantener sincronizado con validateRow de import-excel/route.ts.
export async function GET() {
  try {
    const { session, db } = await getAuthenticatedTenant()
    if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const [products, stockAgg] = await Promise.all([
      db.product.findMany({
        where:   { active: true }, // business_id inyectado por el tenant layer
        include: { category: { select: { name: true } } },
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      }),
      db.inventoryEntry.groupBy({
        by:   ['product_id'],
        // business_id inyectado por el tenant layer
        _sum: { quantity: true, waste: true },
      }),
    ])

    const stockMap = new Map(
      stockAgg.map(s => [s.product_id, Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0)])
    )

    const headers = [
      'nombre', 'precio_usd', 'costo_usd', 'stock', 'categoria', 'product_type', 'unit_label',
      'wholesale_price_usd', 'wholesale_price_per_kg_usd', 'location', 'notes',
    ]

    const rows = products.map(p => {
      // import mapea precio_usd → price_per_unit_usd; emitimos el precio efectivo
      // para que un producto por peso también pase la validación al reimportar.
      const precio = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
      return [
        p.name,
        precio,
        p.cost_per_unit_usd != null ? Number(p.cost_per_unit_usd) : '',
        // Clamp a ≥0: el net puede ser negativo (producto sobrevendido), pero el
        // import valida stock ≥ 0 y un stock inicial negativo no tiene sentido.
        // Sin esto el round-trip export→reimport falla en esas filas.
        Math.max(0, stockMap.get(p.id) ?? 0),
        p.category?.name ?? '',
        p.product_type,
        p.base_unit_label,
        p.wholesale_price_usd != null ? Number(p.wholesale_price_usd) : '',
        p.wholesale_price_per_kg_usd != null ? Number(p.wholesale_price_per_kg_usd) : '',
        p.location ?? '',
        p.notes ?? '',
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [
      { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 14 },
      { wch: 12 }, { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 24 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')

    const raw    = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
    const buffer = new Uint8Array(raw)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="catalogo_productos.xlsx"',
      },
    })
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
