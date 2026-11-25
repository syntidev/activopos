import { NextRequest, NextResponse } from 'next/server'
import { loadCatalog } from '@/lib/restaurante-cuenta'
import { handleRestauranteError, parseSearchParam, requireRestauranteAccess } from '@/lib/restaurante-server'

/**
 * GET /api/restaurante/productos?q=pasta&category_id=3 — carta que ve el mesonero: precio de venta, modificadores y la tasa.
 * Nunca devuelve costos ni datos de proveedor. Búsqueda única de productos (la misma del POS), texto siempre como parámetro.
 */
export async function GET(req: NextRequest) {
  try {
    const access = await requireRestauranteAccess()
    if (access instanceof NextResponse) return access

    const rawQ = req.nextUrl.searchParams.get('q')
    let q: string | null = null
    if (rawQ !== null && rawQ.trim() !== '') {
      const search = parseSearchParam(rawQ)
      if (!search.ok) return NextResponse.json({ error: search.error }, { status: 400 })
      q = rawQ
    }
    const catRaw = req.nextUrl.searchParams.get('category_id')
    const categoryId = catRaw === null ? null : Number(catRaw)
    if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) {
      return NextResponse.json({ error: 'category_id inválido' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, ...(await loadCatalog(access.db, access.session.businessId, q, categoryId)) })
  } catch (err) {
    return handleRestauranteError(err, 'GET /api/restaurante/productos')
  }
}
