// Planificador puro de la importación Excel de productos: sin DB ni I/O.
//
// El endpoint lee un snapshot del negocio, llama planImport() y, según sea
// dry_run o no, devuelve summarizePlan(plan) o ejecuta ESE mismo plan. Una sola
// fuente de verdad: lo que el dry-run muestra es exactamente lo que se aplica.
//
// Reglas de conciliación (el archivo REEMPLAZA el stock, nunca lo suma):
//   producto = por `id` si viene; si no, por nombre exacto (sin distinguir
//   mayúsculas) entre los productos activos.
//   - producto no existe                    -> crear (con sus variantes)
//   - producto existe, variante no existe   -> agregar la variante
//   - producto y variante existen           -> stock = valor del Excel
//   - variante existente ausente del archivo -> no se toca (no se borra nada)

export const VALID_PRODUCT_TYPES = ['simple', 'combo', 'fabricable'] as const
export type ProductTypeLiteral = typeof VALID_PRODUCT_TYPES[number]

// Modos de venta del schema (enum SaleMode). La plantilla documenta los 3 de uso
// común (unit/weight/service); los otros 3 se aceptan porque son válidos en DB.
export const VALID_SALE_MODES = ['unit', 'weight', 'service', 'length', 'volume', 'package'] as const
export type SaleModeLiteral = typeof VALID_SALE_MODES[number]

// Mismo conjunto que acepta POST /api/products/[id]/variants (Zod).
export const VARIANT_TIPOS = ['talla', 'color', 'personalizado'] as const
export type VariantTipo = typeof VARIANT_TIPOS[number]

export interface ImportRow {
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
  // Ambos null = producto simple; ambos con valor = fila de variante.
  variant_tipo:  VariantTipo | null
  variant_valor: string | null
}

export interface RowError {
  row:     number
  message: string
}

export interface ExistingProduct {
  id:           number
  name:         string
  barcode:      string | null
  sku:          string | null
  category:     string | null
  product_type: string
  sale_mode:    string
  unit_label:   string
  price_usd:    number
  cost_usd:     number | null
  wholesale_price_usd:        number | null
  wholesale_price_per_kg_usd: number | null
  location:     string | null
  notes:        string | null
  active:       boolean
  has_variants: boolean
  // Neto de inventory_entries del padre, SIN clamp (puede ser negativo).
  net_stock:    number
  // Solo variantes activas.
  variants:     { id: number; tipo: string; valor: string; stock: number }[]
}

type Scalar = string | number | null

export interface FieldChange {
  field: string
  old:   Scalar
  new:   Scalar
}

export interface VariantPlan {
  tipo:       VariantTipo
  valor:      string
  action:     'create' | 'update' | 'same'
  variant_id: number | null
  old:        number | null
  new:        number
  row:        number
}

export interface ProductPlan {
  kind:       'create' | 'update' | 'same'
  product_id: number | null
  name:       string
  // Fila de la que salen los datos a nivel producto (la primera del grupo).
  source:     ImportRow
  changes:    FieldChange[]
  // Solo productos simples. `delta` es contra el neto real (puede diferir de
  // new - old si el neto era negativo). null = sin movimiento de stock.
  stock:      { old: number; new: number; delta: number } | null
  variants:   VariantPlan[]
}

export interface ImportPlan {
  products: ProductPlan[]
  errors:   RowError[]
}

const norm = (s: string): string => s.trim().toLowerCase()

function sameScalar(field: string, a: Scalar, b: Scalar): boolean {
  if (a === null || b === null) return a === b
  if (typeof a === 'number' && typeof b === 'number') return Math.round(a * 1e4) === Math.round(b * 1e4)
  // La DB resuelve la categoría sin distinguir mayúsculas; el diff también.
  return field === 'categoria' ? norm(String(a)) === norm(String(b)) : String(a) === String(b)
}

function diffProduct(ex: ExistingProduct, r: ImportRow): FieldChange[] {
  const pairs: [string, Scalar, Scalar][] = [
    ['nombre',                  ex.name,                       r.name],
    ['codigo_barras',           ex.barcode,                    r.barcode],
    ['sku',                     ex.sku,                        r.sku],
    ['precio_usd',              ex.price_usd,                  r.price_usd],
    ['costo_usd',               ex.cost_usd,                   r.cost_usd],
    ['categoria',               ex.category,                   r.category],
    ['tipo_producto',           ex.product_type,               r.product_type],
    ['modo_venta',              ex.sale_mode,                  r.sale_mode],
    ['unidad',                  ex.unit_label,                 r.unit_label],
    ['precio_mayorista_usd',    ex.wholesale_price_usd,        r.wholesale_price_usd],
    ['precio_mayorista_kg_usd', ex.wholesale_price_per_kg_usd, r.wholesale_price_per_kg_usd],
    ['ubicacion',               ex.location,                   r.location],
    ['notas',                   ex.notes,                      r.notes],
  ]
  return pairs
    .filter(([field, a, b]) => !sameScalar(field, a, b))
    .map(([field, a, b]) => ({ field, old: a, new: b }))
}

interface Group {
  product: ExistingProduct | null
  rows:    ImportRow[]
}

export function planImport(
  rows: ImportRow[],
  existing: ExistingProduct[],
  // barcode -> id del producto dueño (de TODOS los productos del negocio).
  barcodeOwners: Map<string, number>,
): ImportPlan {
  const errors: RowError[] = []

  const byId = new Map(existing.map(p => [p.id, p]))
  const byName = new Map<string, ExistingProduct[]>()
  for (const p of existing) {
    if (!p.active) continue
    const k = norm(p.name)
    byName.set(k, [...(byName.get(k) ?? []), p])
  }

  // 1) Cada fila se resuelve a un producto y se agrupa. Una fila sin id cuyo
  // nombre coincide con un producto existente cae en el MISMO grupo que las
  // filas con su id (agregar una talla nueva sin repetir el id).
  const groups = new Map<string, Group>()
  for (const r of rows) {
    let product: ExistingProduct | null = null
    let key: string
    if (r.id !== null) {
      product = byId.get(r.id) ?? null
      if (!product) {
        errors.push({ row: r.row, message: `Producto ID ${r.id} no encontrado en este negocio` })
        continue
      }
      key = `p:${product.id}`
    } else {
      const matches = byName.get(norm(r.name)) ?? []
      if (matches.length > 1) {
        errors.push({ row: r.row, message: `Hay ${matches.length} productos llamados "${r.name}" — usa la columna id para elegir cuál` })
        continue
      }
      product = matches[0] ?? null
      key = product ? `p:${product.id}` : `n:${norm(r.name)}`
    }
    const g = groups.get(key)
    if (g) g.rows.push(r)
    else groups.set(key, { product, rows: [r] })
  }

  const products: ProductPlan[] = []
  const seenBarcodes = new Set<string>()

  for (const { product, rows: grpRows } of Array.from(groups.values())) {
    const varRows   = grpRows.filter(r => r.variant_valor !== null)
    const plainRows = grpRows.filter(r => r.variant_valor === null)

    let usable: ImportRow[]
    if (varRows.length > 0) {
      for (const r of plainRows) {
        errors.push({ row: r.row, message: `"${r.name}" mezcla filas con y sin variante — todas sus filas deben llevar variante_valor` })
      }
      usable = varRows
    } else {
      for (const r of plainRows.slice(1)) {
        errors.push({ row: r.row, message: `Producto duplicado dentro del archivo: "${r.name}"` })
      }
      usable = plainRows.slice(0, 1)
    }
    const source = usable[0]
    const isVariantGroup = varRows.length > 0

    // Un producto existente conserva su forma: no se convierte de simple a
    // variantes (o al revés) por importación — el stock del padre y el de las
    // variantes no se pueden mezclar sin perder uno de los dos.
    if (product && isVariantGroup && !product.has_variants) {
      for (const r of usable) errors.push({ row: r.row, message: `"${product.name}" es un producto sin variantes — conviértelo a variantes desde el panel antes de importar tallas` })
      continue
    }
    if (product && !isVariantGroup && product.has_variants) {
      errors.push({ row: source.row, message: `"${product.name}" tiene variantes — cada fila necesita variante_tipo y variante_valor` })
      continue
    }

    // Barcode: se valida una vez por producto (las filas de variante lo repiten).
    if (source.barcode) {
      if (seenBarcodes.has(source.barcode)) {
        errors.push({ row: source.row, message: `Código de barras duplicado dentro del archivo: ${source.barcode}` })
        continue
      }
      const owner = barcodeOwners.get(source.barcode)
      if (owner !== undefined && owner !== product?.id) {
        errors.push({ row: source.row, message: `Código de barras duplicado: ${source.barcode} ya pertenece a otro producto` })
        continue
      }
      seenBarcodes.add(source.barcode)
    }

    const variants: VariantPlan[] = []
    if (isVariantGroup) {
      const seenVariants = new Set<string>()
      for (const r of usable) {
        const tipo = r.variant_tipo as VariantTipo
        const valor = r.variant_valor as string
        const vk = `${tipo}|${norm(valor)}`
        if (seenVariants.has(vk)) {
          errors.push({ row: r.row, message: `Variante duplicada dentro del archivo: ${valor}` })
          continue
        }
        seenVariants.add(vk)
        const found = product?.variants.find(v => v.tipo === tipo && norm(v.valor) === norm(valor)) ?? null
        variants.push({
          tipo, valor, row: r.row,
          variant_id: found?.id ?? null,
          old:        found?.stock ?? null,
          new:        r.stock,
          action:     !found ? 'create' : found.stock === r.stock ? 'same' : 'update',
        })
      }
    }

    // Stock del producto simple: el Excel es el neto deseado, no un movimiento.
    // El export recorta a >= 0, así que un neto negativo que el archivo devuelve
    // como 0 cuenta como "sin cambio" (si no, exportar y reimportar sin tocar
    // nada movería el inventario).
    let stock: ProductPlan['stock'] = null
    if (!isVariantGroup) {
      const net = product?.net_stock ?? 0
      if (source.stock !== Math.max(0, net)) {
        stock = { old: Math.max(0, net), new: source.stock, delta: source.stock - net }
      }
    }

    const changes = product ? diffProduct(product, source) : []
    const kind: ProductPlan['kind'] = !product
      ? 'create'
      : changes.length > 0 || stock !== null || variants.some(v => v.action !== 'same')
        ? 'update'
        : 'same'

    products.push({
      kind, product_id: product?.id ?? null, name: product?.name ?? source.name,
      source, changes, stock, variants,
    })
  }

  return { products, errors }
}

export type PlanSummary = ReturnType<typeof summarizePlan>

// Forma JSON del dry-run: sin la fila cruda, solo lo que la UI necesita mostrar.
export function summarizePlan(plan: ImportPlan) {
  const created   = plan.products.filter(p => p.kind === 'create')
  const updated   = plan.products.filter(p => p.kind === 'update')
  const unchanged = plan.products.filter(p => p.kind === 'same')
  const variantsOf = (p: ProductPlan) =>
    p.variants.map(v => ({ tipo: v.tipo, valor: v.valor, action: v.action, old: v.old, new: v.new }))
  return {
    created: created.map(p => ({
      row: p.source.row, name: p.name,
      stock: p.variants.length === 0 ? p.source.stock : null,
      variants: variantsOf(p),
    })),
    updated: updated.map(p => ({
      row: p.source.row, id: p.product_id, name: p.name,
      changes:  p.changes,
      stock:    p.stock ? { old: p.stock.old, new: p.stock.new } : null,
      variants: variantsOf(p).filter(v => v.action !== 'same'),
      variants_unchanged: p.variants.filter(v => v.action === 'same').length,
    })),
    unchanged: unchanged.map(p => ({ id: p.product_id, name: p.name })),
  }
}
