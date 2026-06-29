import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import * as XLSX from 'xlsx'

type SaleMode = 'weight' | 'unit' | 'service'

const normalizeSaleMode = (raw: unknown): { mode: SaleMode; label: string } => {
  const lower = String(raw ?? '').toLowerCase().trim()
  if (['kg', 'kilo', 'kilos', 'peso', 'pesos'].includes(lower)) {
    return { mode: 'weight', label: 'kg' }
  }
  if (['servicio', 'service', 'srv'].includes(lower)) {
    return { mode: 'service', label: 'srv' }
  }
  return { mode: 'unit', label: 'und' }
}

const toNum = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? ''))
  return isNaN(n) ? null : n
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

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  if (rows.length === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }

  // Cache de categorías para evitar queries repetidas
  const categoryCache = new Map<string, number>()

  let created = 0
  const errors: Array<{ row: number; message: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // fila 1 = header

    const name = String(row['Nombre'] ?? '').trim()
    if (!name) {
      errors.push({ row: rowNum, message: 'Columna "Nombre" requerida' })
      continue
    }

    const cost = toNum(row['Costo'])
    if (cost === null) {
      errors.push({ row: rowNum, message: '"Costo" debe ser un número' })
      continue
    }

    const quantity = toNum(row['Stock']) ?? 0
    const { mode, label } = normalizeSaleMode(row['Vendido por'])
    const margin = toNum(row['Margen'])
    const price = margin !== null ? cost / (1 - margin / 100) : null

    // Resolver categoría
    let categoryId: number | null = null
    const catName = String(row['Categoría'] ?? '').trim()
    if (catName) {
      if (categoryCache.has(catName)) {
        categoryId = categoryCache.get(catName)!
      } else {
        const cat = await db.category.findFirst({
          where: { name: catName }, // business_id inyectado por el tenant layer
        })
        if (cat) {
          categoryId = cat.id
        } else {
          const newCat = await db.category.create({
            data: { business_id: session.businessId, name: catName }, // business_id explícito (tipo de create)
          })
          categoryId = newCat.id
        }
        categoryCache.set(catName, categoryId)
      }
    }

    try {
      await prisma.$transaction(async tx => {
        const product = await tx.product.create({
          data: {
            business_id: session.businessId,
            name,
            sku: String(row['SKU'] ?? '').trim() || null,
            barcode: String(row['Barcode'] ?? '').trim() || null,
            description: String(row['Descripción'] ?? '').trim() || null,
            category_id: categoryId,
            sale_mode: mode,
            base_unit_label: label,
            cost_per_unit_usd: cost,
            price_per_unit_usd: mode !== 'weight' ? price : null,
            price_per_kg_usd: mode === 'weight' ? price : null,
          },
        })

        if (quantity > 0) {
          await tx.inventoryEntry.create({
            data: {
              business_id: session.businessId,
              product_id: product.id,
              quantity,
              cost_per_unit_usd: cost,
              notes: 'Importación inicial',
              created_by: session.userId,
            },
          })
        }
      })
      created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      errors.push({ row: rowNum, message: msg })
    }
  }

  return NextResponse.json({ ok: true, created, errors })
}
