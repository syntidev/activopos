import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// Supported product types
const VALID_PRODUCT_TYPES = ['simple', 'combo', 'fabricable'] as const
type ProductTypeLiteral = typeof VALID_PRODUCT_TYPES[number]

const toNum = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? ''))
  return isNaN(n) ? null : n
}

const toString = (v: unknown): string =>
  String(v ?? '').trim()

interface RowValidation {
  row:          number
  name:         string
  price_usd:    number
  cost_usd:     number | null
  stock:        number
  category:     string | null
  product_type: ProductTypeLiteral
  unit_label:   string
}

interface RowError {
  row:     number
  message: string
}

function validateRow(
  raw: Record<string, unknown>,
  rowNum: number
): { valid: RowValidation } | { error: RowError } {
  const name = toString(raw['nombre'] ?? raw['Nombre'])
  if (!name) return { error: { row: rowNum, message: 'Columna "nombre" es requerida' } }
  if (name.length > 120) return { error: { row: rowNum, message: '"nombre" supera 120 caracteres' } }

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

  const ptRaw = toString(raw['product_type'] ?? raw['Tipo'] ?? 'simple').toLowerCase()
  const product_type: ProductTypeLiteral = VALID_PRODUCT_TYPES.includes(ptRaw as ProductTypeLiteral)
    ? (ptRaw as ProductTypeLiteral)
    : 'simple'

  const unit_label = toString(raw['unit_label'] ?? raw['Unidad'] ?? 'und') || 'und'

  return {
    valid: { row: rowNum, name, price_usd: price, cost_usd: cost, stock, category, product_type, unit_label },
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
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
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

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
    return NextResponse.json({ ok: true, dry_run: true, valid: validRows.length, errors })
  }

  // Create products for valid rows
  const categoryCache = new Map<string, number>()
  let created = 0
  const createErrors: RowError[] = [...errors]

  for (const row of validRows) {
    // Resolve category
    let categoryId: number | null = null
    if (row.category) {
      if (categoryCache.has(row.category)) {
        categoryId = categoryCache.get(row.category)!
      } else {
        const existing = await prisma.category.findFirst({
          where: { business_id: session.businessId, name: row.category },
          select: { id: true },
        })
        if (existing) {
          categoryId = existing.id
        } else {
          const newCat = await prisma.category.create({
            data: { business_id: session.businessId, name: row.category },
          })
          categoryId = newCat.id
        }
        categoryCache.set(row.category, categoryId)
      }
    }

    try {
      await prisma.$transaction(async tx => {
        const product = await tx.product.create({
          data: {
            business_id:        session.businessId,
            name:               row.name,
            category_id:        categoryId,
            product_type:       row.product_type,
            unit_label:         row.unit_label,
            base_unit_label:    row.unit_label,
            price_per_unit_usd: row.price_usd,
            cost_per_unit_usd:  row.cost_usd,
          },
        })

        if (row.stock > 0) {
          await tx.inventoryEntry.create({
            data: {
              business_id:       session.businessId,
              product_id:        product.id,
              quantity:          row.stock,
              cost_per_unit_usd: row.cost_usd ?? 0,
              notes:             'Importación Excel',
              created_by:        session.userId,
            },
          })
        }
      })
      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      createErrors.push({ row: row.row, message: msg })
    }
  }

  return NextResponse.json({ ok: true, dry_run: false, created, errors: createErrors })
}
