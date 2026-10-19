import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireLabelCapture } from '@/lib/label-capture'
import { getNetStock } from '@/lib/stock-adjust'
import { CODE_RE } from '@/lib/quick-add-shared'
import type { QuickAddProductResult } from '@/types/quick-add'

/**
 * Alta rápida — acceso y utilidades compartidas por las rutas /api/quick-add/*.
 * Hoy comparte la puerta de /captura-etiquetas (admin + LABEL_CAPTURE_BUSINESS_IDS).
 * Para abrirla a otros negocios se cambia SOLO esta constante (p. ej. a una puerta
 * por rol admin sin lista de negocios); ninguna ruta ni la página la duplica.
 */
export const requireQuickAdd = requireLabelCapture

/** Re-exportado para las rutas: una sola definición del formato (compartida con el cliente). */
export { CODE_RE }

/**
 * Formas equivalentes de un mismo GTIN: un UPC-A (12) se lee a veces como EAN-13 con un 0 delante.
 * Evita crear un duplicado de un producto cargado con la otra forma.
 */
export function barcodeForms(code: string): string[] {
  const forms = new Set([code])
  if (/^\d+$/.test(code)) {
    if (code.length === 12) forms.add(`0${code}`)
    if (code.length === 13 && code.startsWith('0')) forms.add(code.slice(1))
  }
  return Array.from(forms)
}

/** Redondeo a 2 decimales (columnas Decimal(10,2)). */
export const toMoney = (n: number): number => Math.round(n * 100) / 100

/** Producto activo del negocio que usa ese código (o null). business_id siempre explícito. */
export async function findByBarcode(businessId: number, code: string): Promise<QuickAddProductResult | null> {
  const p = await prisma.product.findFirst({
    where: { business_id: businessId, barcode: { in: barcodeForms(code) }, active: true },
    select: { id: true },
  })
  return p ? productResult(businessId, p.id) : null
}

export async function productResult(businessId: number, productId: number): Promise<QuickAddProductResult | null> {
  const p = await prisma.product.findFirst({
    where: { id: productId, business_id: businessId },
    select: { id: true, name: true, barcode: true, price_per_unit_usd: true, wholesale_price_usd: true },
  })
  if (!p) return null
  const num = (v: { toString(): string } | null): number | null => (v === null ? null : Number(v))
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode ?? '',
    stock: await getNetStock(prisma, businessId, p.id),
    price_usd: num(p.price_per_unit_usd),
    wholesale_usd: num(p.wholesale_price_usd),
  }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}
