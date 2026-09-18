import { NextRequest, NextResponse } from 'next/server'
import { SIZE_GUIDES, hasSizeGuide } from '@/lib/size-guide'

// Público, sin sesión — dato genérico de industria, no de tenant (a diferencia
// de collections/landing-sections). El catálogo público y el POS lo consumen
// directo desde el navegador para mostrar la equivalencia sugerida.
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')

  if (!category) {
    return NextResponse.json({ ok: true, categories: Object.keys(SIZE_GUIDES) })
  }

  if (!hasSizeGuide(category)) {
    return NextResponse.json({ error: 'Categoría sin tabla de referencia' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, category, ...SIZE_GUIDES[category] })
}
