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
        include: {
          category: { select: { name: true } },
          // ProductVariant no tiene business_id: se aísla vía el producto ya scopeado.
          variants: {
            where:   { is_active: true },
            orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
            select:  { tipo: true, valor: true, stock: true },
          },
        },
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

    // Mismas cabeceras en español que emite import-excel/template. El import
    // acepta además los nombres viejos en inglés, así que los archivos que el
    // cliente ya tenga descargados siguen subiendo sin cambios.
    const headers = [
      'id', 'nombre', 'codigo_barras', 'sku', 'precio_usd', 'costo_usd', 'stock', 'categoria',
      'tipo_producto', 'modo_venta', 'unidad',
      'precio_mayorista_usd', 'precio_mayorista_kg_usd', 'ubicacion', 'notas',
      'variante_tipo', 'variante_valor',
    ]

    const rows = products.flatMap(p => {
      // import mapea precio_usd → price_per_unit_usd; emitimos el precio efectivo
      // para que un producto por peso también pase la validación al reimportar.
      const precio = Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0)
      const base = [
        // El id hace que reimportar este archivo ACTUALICE en vez de duplicar.
        p.id,
        p.name,
        p.barcode ?? '',
        p.sku ?? '',
        precio,
        p.cost_per_unit_usd != null ? Number(p.cost_per_unit_usd) : '',
        // Clamp a ≥0: el net puede ser negativo (producto sobrevendido), pero el
        // import valida stock ≥ 0 y un stock inicial negativo no tiene sentido.
        // Sin esto el round-trip export→reimport falla en esas filas.
        Math.max(0, stockMap.get(p.id) ?? 0),
        p.category?.name ?? '',
        p.product_type,
        p.sale_mode,
        p.base_unit_label,
        p.wholesale_price_usd != null ? Number(p.wholesale_price_usd) : '',
        p.wholesale_price_per_kg_usd != null ? Number(p.wholesale_price_per_kg_usd) : '',
        p.location ?? '',
        p.notes ?? '',
      ]
      // Producto con variantes: UNA fila por talla/color, repitiendo los datos del
      // producto; `stock` pasa a ser el de esa variante (ProductVariant.stock es la
      // fuente autoritativa -- el neto del padre no cuenta). Es el formato que el
      // import agrupa por producto y concilia variante por variante.
      if (p.has_variants && p.variants.length > 0) {
        return p.variants.map(v => {
          const row: (string | number)[] = [...base, v.tipo, v.valor]
          row[6] = v.stock
          return row
        })
      }
      return [[...base, '', '']]
    })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [
      { wch:  6 }, { wch: 25 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch:  8 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
      { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 16 },
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
