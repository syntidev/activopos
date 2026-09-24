import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import * as XLSX from 'xlsx'
import { revalidateCatalogCache } from '@/lib/catalog'
import {
  VALID_PRODUCT_TYPES, VALID_SALE_MODES, VARIANT_TIPOS, planImport, summarizePlan,
} from '@/lib/product-import-plan'
import type {
  ImportRow, RowError, ExistingProduct, ProductTypeLiteral, SaleModeLiteral, VariantTipo,
} from '@/lib/product-import-plan'

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

function validateRow(
  raw: Record<string, unknown>,
  rowNum: number
): { valid: ImportRow } | { error: RowError } {
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

  // Variante: el mismo producto en varias filas, una por talla/color. `stock`
  // de una fila de variante es el de ESA variante (ProductVariant.stock es Int).
  const variantValor = toString(raw['variante_valor'] ?? '') || null
  const variantTipoRaw = toString(raw['variante_tipo'] ?? '').toLowerCase()
  if (variantValor === null && variantTipoRaw !== '') {
    return { error: { row: rowNum, message: '"variante_tipo" sin "variante_valor" — escribe la talla/color o borra el tipo' } }
  }
  if (variantValor !== null && variantValor.length > 50) {
    return { error: { row: rowNum, message: '"variante_valor" supera 50 caracteres' } }
  }
  const variantTipo = variantValor === null ? null : (variantTipoRaw || 'talla')
  if (variantTipo !== null && !VARIANT_TIPOS.includes(variantTipo as VariantTipo)) {
    return { error: { row: rowNum, message: `"variante_tipo" inválido — usa: ${VARIANT_TIPOS.join(', ')}` } }
  }
  if (variantValor !== null && !Number.isInteger(stock)) {
    return { error: { row: rowNum, message: '"stock" de una variante debe ser un entero' } }
  }

  return {
    valid: {
      row: rowNum, id, name, barcode, sku, price_usd: price, cost_usd: cost, stock, category,
      product_type, sale_mode, unit_label,
      wholesale_price_usd, wholesale_price_per_kg_usd, location, notes,
      variant_tipo: variantTipo as VariantTipo | null, variant_valor: variantValor,
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
  const validRows: ImportRow[] = []
  const errors: RowError[] = []

  for (let i = 0; i < rows.length; i++) {
    const result = validateRow(rows[i], i + 2)
    if ('error' in result) {
      errors.push(result.error)
    } else {
      validRows.push(result.valid)
    }
  }

  // Snapshot del negocio sobre el que se calcula el plan: productos con su
  // categoría y variantes activas, más el stock neto del padre. El plan es la
  // única fuente de verdad: el dry-run lo muestra y la aplicación lo ejecuta.
  const [products, stockAgg] = await Promise.all([
    db.product.findMany({ // business_id inyectado por el tenant layer
      select: {
        id: true, name: true, barcode: true, sku: true, product_type: true, sale_mode: true,
        base_unit_label: true, price_per_unit_usd: true, price_per_kg_usd: true,
        cost_per_unit_usd: true, wholesale_price_usd: true, wholesale_price_per_kg_usd: true,
        location: true, notes: true, active: true, has_variants: true,
        category: { select: { name: true } },
        variants: { where: { is_active: true }, select: { id: true, tipo: true, valor: true, stock: true } },
      },
    }),
    db.inventoryEntry.groupBy({
      by:   ['product_id'],
      _sum: { quantity: true, waste: true },
    }),
  ])
  const netStock = new Map(
    stockAgg.map(s => [s.product_id, Number(s._sum.quantity ?? 0) - Number(s._sum.waste ?? 0)]),
  )
  const num = (v: { toString(): string } | null): number | null => (v === null ? null : Number(v))
  const existing: ExistingProduct[] = products.map(p => ({
    id: p.id, name: p.name, barcode: p.barcode, sku: p.sku,
    category: p.category?.name ?? null,
    product_type: p.product_type, sale_mode: p.sale_mode, unit_label: p.base_unit_label,
    // Mismo precio efectivo que emite el export.
    price_usd: Number(p.price_per_unit_usd ?? p.price_per_kg_usd ?? 0),
    cost_usd: num(p.cost_per_unit_usd),
    wholesale_price_usd: num(p.wholesale_price_usd),
    wholesale_price_per_kg_usd: num(p.wholesale_price_per_kg_usd),
    location: p.location, notes: p.notes, active: p.active, has_variants: p.has_variants,
    net_stock: netStock.get(p.id) ?? 0,
    variants: p.variants,
  }))
  const barcodeOwners = new Map<string, number>()
  for (const p of existing) if (p.barcode) barcodeOwners.set(p.barcode, p.id)

  const plan = planImport(validRows, existing, barcodeOwners)
  const rowErrors: RowError[] = [...errors, ...plan.errors].sort((a, b) => a.row - b.row)

  if (dryRun) {
    const summary = summarizePlan(plan)
    return NextResponse.json({
      ok:        true,
      dry_run:   true,
      valid:     summary.created.length + summary.updated.length,
      created:   summary.created.length,
      updated:   summary.updated.length,
      unchanged: summary.unchanged.length,
      errors:    rowErrors,
      plan:      summary,
    })
  }

  const categoryCache = new Map<string, number>()
  const resolveCategory = async (name: string | null): Promise<number | null> => {
    if (!name) return null
    const cached = categoryCache.get(name)
    if (cached !== undefined) return cached
    const found = await db.category.findFirst({
      where:  { name }, // business_id inyectado por el tenant layer
      select: { id: true },
    })
    const id = found
      ? found.id
      : (await db.category.create({ data: { business_id: session.businessId, name } })).id // business_id explícito (tipo de create)
    categoryCache.set(name, id)
    return id
  }

  // Campos a nivel producto que comparten alta y actualización.
  const productData = (r: ImportRow, categoryId: number | null) => ({
    name:               r.name,
    barcode:            r.barcode,
    sku:                r.sku,
    category_id:        categoryId,
    product_type:       r.product_type,
    sale_mode:          r.sale_mode,
    unit_label:         r.unit_label,
    base_unit_label:    r.unit_label,
    price_per_unit_usd: r.price_usd,
    cost_per_unit_usd:  r.cost_usd,
    wholesale_price_usd:        r.wholesale_price_usd,
    wholesale_price_per_kg_usd: r.wholesale_price_per_kg_usd,
    location:                   r.location,
    notes:                      r.notes,
  })

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const p of plan.products) {
    if (p.kind === 'same') { unchanged++; continue }

    try {
      const categoryId = await resolveCategory(p.source.category)
      await prisma.$transaction(async tx => {
        let productId = p.product_id
        if (p.kind === 'create') {
          const product = await tx.product.create({
            data: {
              business_id: session.businessId,
              // El prospecto que importa su catálogo espera verlo en el catálogo
              // público. El default false del schema aplica al alta manual.
              show_in_catalog: true,
              has_variants:    p.variants.length > 0,
              ...productData(p.source, categoryId),
            },
          })
          productId = product.id
        } else if (p.changes.length > 0) {
          await tx.product.update({ where: { id: productId as number }, data: productData(p.source, categoryId) })
        }

        // Producto simple: el stock del Excel es el neto deseado, no un
        // movimiento -- se asienta solo la diferencia contra el neto real.
        // Sin esto, reimportar duplicaría el inventario en cada pasada.
        if (p.stock && p.stock.delta !== 0) {
          await tx.inventoryEntry.create({
            data: {
              business_id:       session.businessId,
              product_id:        productId as number,
              quantity:          p.stock.delta,
              cost_per_unit_usd: p.source.cost_usd ?? 0,
              // entry_type explícito: 'adjustment' es valor válido del String
              // (purchase|adjustment|sale|return|reservation, ver schema).
              entry_type:        'adjustment',
              notes:             p.kind === 'create' ? 'Importación Excel' : 'Ajuste por importación Excel',
              created_by:        session.userId,
            },
          })
        }

        // Variantes: ProductVariant.stock es la fuente autoritativa. Cada cambio
        // se refleja además en inventory_entries del padre (mismo mecanismo dual
        // que PATCH/POST /api/products/[id]/variants) para que el neto que lee el
        // dashboard siga a la suma de tallas: delta > 0 entra como `quantity`,
        // delta < 0 como `waste`.
        for (let i = 0; i < p.variants.length; i++) {
          const v = p.variants[i]
          if (v.action === 'same') continue
          const delta = v.new - (v.old ?? 0)
          if (v.action === 'create') {
            await tx.productVariant.create({
              data: { product_id: productId as number, tipo: v.tipo, valor: v.valor, stock: v.new, sort_order: i },
            })
          } else {
            await tx.productVariant.update({ where: { id: v.variant_id as number }, data: { stock: v.new } })
          }
          if (delta !== 0) {
            await tx.inventoryEntry.create({
              data: {
                business_id: session.businessId,
                product_id:  productId as number,
                quantity:    delta > 0 ? delta : 0,
                waste:       delta < 0 ? -delta : 0,
                entry_type:  'adjustment',
                notes:       `Importación Excel variante ${v.valor}`,
                created_by:  session.userId,
              },
            })
          }
        }
      })
      if (p.kind === 'create') created++
      else updated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      rowErrors.push({ row: p.source.row, message: msg })
    }
  }

  // El catálogo público cachea 60 s: sin esto el dueño vería el stock/alta
  // nuevos recién al vencer el caché.
  if (created + updated > 0) {
    try { await revalidateCatalogCache(session.businessId) }
    catch (err) { console.error('[import-excel] revalidateCatalogCache falló', { business_id: session.businessId, err }) }
  }

  return NextResponse.json({ ok: true, dry_run: false, created, updated, unchanged, errors: rowErrors })
}
