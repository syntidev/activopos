import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import * as XLSX from 'xlsx'

// Supported product types
const VALID_PRODUCT_TYPES = ['simple', 'combo', 'fabricable'] as const
type ProductTypeLiteral = typeof VALID_PRODUCT_TYPES[number]

// Modos de venta del schema (enum SaleMode). La plantilla documenta los 3 de uso
// común (unit/weight/service); los otros 3 se aceptan porque son válidos en DB.
const VALID_SALE_MODES = ['unit', 'weight', 'service', 'length', 'volume', 'package'] as const
type SaleModeLiteral = typeof VALID_SALE_MODES[number]

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return isNaN(v) ? null : v

  // Normalización de números escritos a mano en Excel venezolano.
  // Excel entrega number cuando la celda es numérica; llegamos acá solo cuando
  // la celda quedó como TEXTO (pegado desde WhatsApp, CSV, columna formateada
  // como texto). Ahí aparecen "$3,50" y "1.234,56".
  let s = String(v ?? '').trim().replace(/[$\s]/g, '')
  if (!s) return null

  // Coma decimal: "1,80" → 1.80 | "1.234,56" → 1234.56
  // Exige exactamente 2 decimales tras la coma para no confundir con un
  // separador de miles ("1,234" se deja como está y parsea a 1).
  if (/^-?[\d.]+,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')

  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

const toString = (v: unknown): string =>
  String(v ?? '').trim()

interface RowValidation {
  row:          number
  id:           number | null
  name:         string
  barcode:      string | null
  sku:          string | null
  price_usd:    number
  cost_usd:     number | null
  stock:        number
  category:     string | null
  product_type: ProductTypeLiteral
  sale_mode:    SaleModeLiteral
  unit_label:   string
  wholesale_price_usd:        number | null
  wholesale_price_per_kg_usd: number | null
  location:     string | null
  notes:        string | null
}

interface RowError {
  row:     number
  message: string
}

function validateRow(
  raw: Record<string, unknown>,
  rowNum: number
): { valid: RowValidation } | { error: RowError } {
  // id vacío → alta. id con valor → actualización de un producto existente.
  const idRaw = raw['id'] ?? raw['ID']
  const id = toString(idRaw) !== '' ? toNum(idRaw) : null
  if (id !== null && (!Number.isInteger(id) || id <= 0)) {
    return { error: { row: rowNum, message: '"id" debe ser un entero positivo (déjalo vacío para crear)' } }
  }

  const name = toString(raw['nombre'] ?? raw['Nombre'])
  if (!name) return { error: { row: rowNum, message: 'Columna "nombre" es requerida' } }
  if (name.length > 120) return { error: { row: rowNum, message: '"nombre" supera 120 caracteres' } }

  // Cada campo acepta 3 nombres: el español de la plantilla actual, el inglés
  // de las plantillas viejas y el rótulo con tildes que emitía el export.
  const barcode = toString(raw['codigo_barras'] ?? raw['barcode'] ?? raw['Código de barras'] ?? '') || null
  if (barcode !== null && barcode.length > 50) {
    return { error: { row: rowNum, message: '"barcode" supera 50 caracteres' } }
  }

  const sku = toString(raw['sku'] ?? raw['SKU'] ?? '') || null
  if (sku !== null && sku.length > 50) {
    return { error: { row: rowNum, message: '"sku" supera 50 caracteres' } }
  }

  const priceRaw = raw['precio_usd'] ?? raw['Precio USD']
  const price = toNum(priceRaw)
  if (price === null || price < 0) {
    return { error: { row: rowNum, message: '"precio_usd" debe ser un número ≥ 0' } }
  }

  const costRaw = raw['costo_usd'] ?? raw['Costo USD']
  const cost = costRaw !== undefined && toString(costRaw) !== '' ? toNum(costRaw) : null
  if (cost !== null && cost < 0) {
    return { error: { row: rowNum, message: '"costo_usd" debe ser ≥ 0' } }
  }

  const stockRaw = raw['stock'] ?? raw['Stock']
  const stock = toNum(stockRaw) ?? 0
  if (stock < 0) return { error: { row: rowNum, message: '"stock" debe ser ≥ 0' } }

  const catRaw = toString(raw['categoria'] ?? raw['Categoría'] ?? '')
  const category = catRaw || null

  const ptRaw = toString(raw['tipo_producto'] ?? raw['product_type'] ?? raw['Tipo'] ?? 'simple').toLowerCase()
  const product_type: ProductTypeLiteral = VALID_PRODUCT_TYPES.includes(ptRaw as ProductTypeLiteral)
    ? (ptRaw as ProductTypeLiteral)
    : 'simple'

  // sale_mode inválido se rechaza en vez de degradarse a 'unit': un producto por
  // peso creado como unit no se puede cobrar fraccionado en el POS.
  // La plantilla en español escribe "unidad"/"peso"/"servicio"; la DB guarda los
  // literales en inglés. Se aceptan ambos para no romper archivos viejos.
  const SALE_MODE_ES: Record<string, SaleModeLiteral> = {
    unidad: 'unit', peso: 'weight', servicio: 'service',
  }
  const smInput = toString(raw['modo_venta'] ?? raw['sale_mode'] ?? raw['Modo de venta'] ?? 'unit').toLowerCase() || 'unit'
  const smRaw   = SALE_MODE_ES[smInput] ?? smInput
  if (!VALID_SALE_MODES.includes(smRaw as SaleModeLiteral)) {
    return { error: { row: rowNum, message: `"modo_venta" inválido — usa: unidad, peso, servicio` } }
  }
  const sale_mode = smRaw as SaleModeLiteral

  const unit_label = toString(raw['unidad'] ?? raw['unit_label'] ?? raw['Unidad'] ?? 'und') || 'und'
  if (unit_label.length > 20) {
    return { error: { row: rowNum, message: '"unit_label" supera 20 caracteres' } }
  }

  // Campos opcionales — solo se validan/incluyen si vienen con valor.
  const whUnitRaw = raw['precio_mayorista_usd'] ?? raw['wholesale_price_usd'] ?? raw['Precio Mayorista USD']
  const wholesale_price_usd = whUnitRaw !== undefined && toString(whUnitRaw) !== '' ? toNum(whUnitRaw) : null
  if (wholesale_price_usd !== null && wholesale_price_usd < 0) {
    return { error: { row: rowNum, message: '"wholesale_price_usd" debe ser ≥ 0' } }
  }

  const whKgRaw = raw['precio_mayorista_kg_usd'] ?? raw['wholesale_price_per_kg_usd'] ?? raw['Precio Mayorista Kg USD']
  const wholesale_price_per_kg_usd = whKgRaw !== undefined && toString(whKgRaw) !== '' ? toNum(whKgRaw) : null
  if (wholesale_price_per_kg_usd !== null && wholesale_price_per_kg_usd < 0) {
    return { error: { row: rowNum, message: '"wholesale_price_per_kg_usd" debe ser ≥ 0' } }
  }

  const locRaw = toString(raw['ubicacion'] ?? raw['location'] ?? raw['Ubicación'] ?? '')
  const location = locRaw || null
  if (location !== null && location.length > 120) {
    return { error: { row: rowNum, message: '"location" supera 120 caracteres' } }
  }

  const notesRaw = toString(raw['notas'] ?? raw['notes'] ?? raw['Notas'] ?? '')
  const notes = notesRaw || null

  return {
    valid: {
      row: rowNum, id, name, barcode, sku, price_usd: price, cost_usd: cost, stock, category,
      product_type, sale_mode, unit_label,
      wholesale_price_usd, wholesale_price_per_kg_usd, location, notes,
    },
  }
}

export async function POST(req: NextRequest) {
  let session: SessionPayload
  let db: TenantPrisma
  try {
    const t = await getAuthenticatedTenant()
    session = t.session
    db = t.db
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data con campo "file"' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Campo "file" requerido' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 413 })
  }

  const dryRun = formData.get('dry_run') === 'true'

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  // La plantilla trae una fila de ejemplo marcada con id = EJEMPLO. Se descarta
  // antes de validar: si el usuario no la borra no queremos crearle un producto
  // fantasma, y tampoco reportársela como error (no es culpa suya).
  const rows = allRows.filter(r =>
    String(r['id'] ?? r['ID'] ?? '').trim().toUpperCase() !== 'EJEMPLO')

  if (rows.length === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: 'Máximo 1000 filas por importación' }, { status: 400 })
  }

  // Validate all rows first
  const validRows: RowValidation[] = []
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i++) {
    const result = validateRow(rows[i], i + 2)
    if ('error' in result) {
      errors.push(result.error)
    } else {
      validRows.push(result.valid)
    }
  }

  if (dryRun) {
    return NextResponse.json({
      ok:      true,
      dry_run: true,
      valid:   validRows.length,
      created: validRows.filter(r => r.id === null).length,
      updated: validRows.filter(r => r.id !== null).length,
      errors,
    })
  }

  // Dueño actual de cada barcode del archivo — una sola query en vez de N.
  const fileBarcodes = validRows.map(r => r.barcode).filter((b): b is string => b !== null)
  const barcodeOwner = new Map<string, number>()
  if (fileBarcodes.length > 0) {
    const owned = await db.product.findMany({
      where:  { barcode: { in: fileBarcodes } }, // business_id inyectado por el tenant layer
      select: { id: true, barcode: true },
    })
    for (const p of owned) if (p.barcode) barcodeOwner.set(p.barcode, p.id)
  }

  // Stock neto actual de los productos a actualizar, para calcular el delta.
  const updateIds = validRows.map(r => r.id).filter((id): id is number => id !== null)
  const stockMap = new Map<number, number>()
  if (updateIds.length > 0) {
    const agg = await db.inventoryEntry.groupBy({
      by:    ['product_id'],
      where: { product_id: { in: updateIds } }, // business_id inyectado por el tenant layer
      _sum:  { quantity: true, waste: true },
    })
    for (const s of agg) {
      stockMap.set(s.product_id, Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0))
    }
  }

  const categoryCache = new Map<string, number>()
  const seenBarcodes  = new Set<string>()
  let created = 0
  let updated = 0
  const rowErrors: RowError[] = [...errors]

  for (const row of validRows) {
    // Barcode duplicado — dentro del archivo o contra otro producto del tenant.
    if (row.barcode) {
      if (seenBarcodes.has(row.barcode)) {
        rowErrors.push({ row: row.row, message: `Código de barras duplicado dentro del archivo: ${row.barcode}` })
        continue
      }
      const owner = barcodeOwner.get(row.barcode)
      if (owner !== undefined && owner !== row.id) {
        rowErrors.push({ row: row.row, message: `Código de barras duplicado: ${row.barcode} ya pertenece a otro producto` })
        continue
      }
      seenBarcodes.add(row.barcode)
    }

    // Resolve category
    let categoryId: number | null = null
    if (row.category) {
      if (categoryCache.has(row.category)) {
        categoryId = categoryCache.get(row.category)!
      } else {
        const existing = await db.category.findFirst({
          where: { name: row.category }, // business_id inyectado por el tenant layer
          select: { id: true },
        })
        if (existing) {
          categoryId = existing.id
        } else {
          const newCat = await db.category.create({
            data: { business_id: session.businessId, name: row.category }, // business_id explícito (tipo de create)
          })
          categoryId = newCat.id
        }
        categoryCache.set(row.category, categoryId)
      }
    }

    // Campos que comparten alta y actualización.
    const productData = {
      name:               row.name,
      barcode:            row.barcode,
      sku:                row.sku,
      category_id:        categoryId,
      product_type:       row.product_type,
      sale_mode:          row.sale_mode,
      unit_label:         row.unit_label,
      base_unit_label:    row.unit_label,
      price_per_unit_usd: row.price_usd,
      cost_per_unit_usd:  row.cost_usd,
      wholesale_price_usd:        row.wholesale_price_usd,
      wholesale_price_per_kg_usd: row.wholesale_price_per_kg_usd,
      location:                   row.location,
      notes:                      row.notes,
    }

    try {
      if (row.id === null) {
        await prisma.$transaction(async tx => {
          const product = await tx.product.create({
            data: {
              business_id: session.businessId,
              // El prospecto que importa su catálogo espera verlo en el catálogo
              // público. El default false del schema aplica al alta manual.
              show_in_catalog: true,
              ...productData,
            },
          })

          if (row.stock > 0) {
            await tx.inventoryEntry.create({
              data: {
                business_id:       session.businessId,
                product_id:        product.id,
                quantity:          row.stock,
                cost_per_unit_usd: row.cost_usd ?? 0,
                // DT Sprint 44.5: entry_type explícito. Carga inicial de import =
                // 'adjustment' (valor válido del String entry_type, ver schema:
                // purchase|adjustment|sale|return|reservation). Antes heredaba el
                // default implícito.
                entry_type:        'adjustment',
                notes:             'Importación Excel',
                created_by:        session.userId,
              },
            })
          }
        })
        created++
      } else {
        // Ownership verificada con el cliente tenant ANTES de escribir con el
        // cliente crudo dentro de la transacción.
        const owned = await db.product.findFirst({
          where:  { id: row.id }, // business_id inyectado por el tenant layer
          select: { id: true },
        })
        if (!owned) {
          rowErrors.push({ row: row.row, message: `Producto ID ${row.id} no encontrado en este negocio` })
          continue
        }

        const productId = row.id
        await prisma.$transaction(async tx => {
          await tx.product.update({ where: { id: productId }, data: productData })

          // El stock del Excel es el neto deseado, no un movimiento: se asienta
          // solo la diferencia contra el neto actual. Sin esto, reimportar
          // duplicaría el inventario en cada pasada.
          const delta = row.stock - (stockMap.get(productId) ?? 0)
          if (delta !== 0) {
            await tx.inventoryEntry.create({
              data: {
                business_id:       session.businessId,
                product_id:        productId,
                quantity:          delta,
                cost_per_unit_usd: row.cost_usd ?? 0,
                entry_type:        'adjustment',
                notes:             'Ajuste por importación Excel',
                created_by:        session.userId,
              },
            })
          }
        })
        updated++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      rowErrors.push({ row: row.row, message: msg })
    }
  }

  return NextResponse.json({ ok: true, dry_run: false, created, updated, errors: rowErrors })
}
