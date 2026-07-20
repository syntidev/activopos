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
      'id', 'nombre', 'codigo_barras', 'sku', 'precio_usd', 'costo_usd', 'stock', 'categoria',
      'tipo_producto', 'modo_venta', 'unidad',
      'precio_mayorista_usd', 'precio_mayorista_kg_usd', 'ubicacion', 'notas',
    ]

    // La fila de ejemplo va en la hoja "Productos" para que se vea al abrir el
    // archivo, pero lleva id = EJEMPLO y el import la descarta antes de validar
    // (import-excel/route.ts). Sin ese seguro, al usuario que no la borre se le
    // crearía un producto fantasma en su catálogo.
    const example = [
      'EJEMPLO', 'Arepa con Pollo', '', 'AREPA-001', 3.50, 1.50, 50, 'Alimentos',
      'simple', 'unidad', 'und', '', '', 'Mostrador', 'Producto estrella del negocio',
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])

    // xlsx 0.18 (community) ignora los estilos al escribir: el resaltado amarillo
    // no es posible sin cambiar de librería. El comentario sí viaja en el archivo.
    ws['A2'] = { ...ws['A2'], c: [{ a: 'ActivoPOS', t: 'Borra esta fila antes de importar' }] }

    // Column widths
    ws['!cols'] = [
      { wch:  6 }, // id
      { wch: 25 }, // nombre
      { wch: 16 }, // barcode
      { wch: 14 }, // sku
      { wch: 12 }, // precio_usd
      { wch: 12 }, // costo_usd
      { wch:  8 }, // stock
      { wch: 18 }, // categoria
      { wch: 14 }, // product_type
      { wch: 12 }, // sale_mode
      { wch: 12 }, // unit_label
      { wch: 20 }, // wholesale_price_usd
      { wch: 24 }, // wholesale_price_per_kg_usd
      { wch: 22 }, // location
      { wch: 24 }, // notes
    ]

    const guide = [
      ['Columna', 'Obligatoria', 'Valores válidos', 'Ejemplo'],
      ['id', 'No', 'Vacío = crear producto nuevo. Con ID = actualizar ese producto.', ''],
      ['nombre', 'Sí', 'Texto, máx 120 caracteres', 'Harina de maíz 1kg'],
      ['codigo_barras', 'No', 'Texto, máx 50. No puede repetirse entre productos.', '7591234567890'],
      ['sku', 'No', 'Texto, máx 50 — tu código interno', 'HAR-001'],
      ['precio_usd', 'Sí', 'Número ≥ 0. Punto o coma decimal.', '1.20'],
      ['costo_usd', 'No', 'Número ≥ 0. Vacío = sin costo registrado.', '0.85'],
      ['stock', 'No', 'Número ≥ 0. Vacío = 0. Al actualizar, es la existencia final deseada.', '40'],
      ['categoria', 'No', 'Texto. Si no existe, se crea sola.', 'Víveres'],
      ['tipo_producto', 'No', 'simple | combo | fabricable — por defecto: simple', 'simple'],
      ['modo_venta', 'No', 'unidad | peso | servicio — por defecto: unidad', 'peso'],
      ['unidad', 'No', 'Texto, máx 20 — und, kg, lt, m… por defecto: und', 'kg'],
      ['precio_mayorista_usd', 'No', 'Número ≥ 0 — precio al mayor por unidad', '1.05'],
      ['precio_mayorista_kg_usd', 'No', 'Número ≥ 0 — precio al mayor por kilo', '0.95'],
      ['ubicacion', 'No', 'Texto, máx 120', 'Pasillo 2, Estante A'],
      ['notas', 'No', 'Texto libre', 'Producto de temporada'],
      [],
      ['Cómo llenar la plantilla'],
      ['1. Borra la fila de ejemplo (la que dice EJEMPLO en la columna "id").'],
      ['2. Escribe tus productos en la hoja "Productos", debajo de los encabezados.'],
      ['3. Deja la columna "id" VACÍA — el sistema asigna el ID al crear el producto.'],
      ['4. ¿Vendes por peso (kg, gramos)? Pon modo_venta = peso, si no no vas a poder'],
      ['   cobrar fracciones como 0,75 kg en el punto de venta.'],
      ['5. Máximo 1000 filas y 5 MB por archivo.'],
      [],
      ['Cómo ACTUALIZAR productos que ya tienes'],
      ['1. Descarga tu catálogo con el botón "Exportar" — ya viene con los IDs.'],
      ['2. Edita lo que necesites en Excel sin borrar la columna "id".'],
      ['3. Súbelo de vuelta: las filas con ID se actualizan, no se duplican.'],
    ]
    const wsGuide = XLSX.utils.aoa_to_sheet(guide)
    wsGuide['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 66 }, { wch: 22 }]

    const wb = XLSX.utils.book_new()
    // "Productos" va primero: el import lee workbook.SheetNames[0].
    XLSX.utils.book_append_sheet(wb, ws, 'Productos')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Instrucciones')

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
