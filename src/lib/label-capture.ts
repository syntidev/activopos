import { NextResponse } from 'next/server'
import { getSession, type SessionPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { REF_RE, isValidEan13, normalizeSize } from '@/lib/label-capture-shared'
import type { LabelCaptureDTO } from '@/types/label-capture'

/**
 * Captura de etiquetas Safetti — acceso y reglas de validación (servidor).
 * Solo role 'admin' de un negocio listado en LABEL_CAPTURE_BUSINESS_IDS (vacía = nadie).
 * Todo lo demás responde 404: la ruta "no existe". businessId SIEMPRE de getSession().
 */

const AUTO_PREFIX = '[auto] '
const REVIEW_PREFIX = '[REVISAR'

function allowedBusinessIds(): number[] {
  return (process.env.LABEL_CAPTURE_BUSINESS_IDS ?? '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0)
}

export function isLabelCaptureSession(session: SessionPayload | null): session is SessionPayload {
  return !!session && session.role === 'admin' && allowedBusinessIds().includes(session.businessId)
}

/** Puerta ÚNICA de las APIs de captura: sesión válida o respuesta 404 lista para retornar. */
export async function requireLabelCapture(): Promise<SessionPayload | NextResponse> {
  const session = await getSession()
  if (!isLabelCaptureSession(session)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  return session
}

/* ── Derivación desde el producto ── */

const GARMENT_KIND_RE = /\b(camisa|maillot|jersey|chaqueta|chaleco|culotte?|bib|short|enterizo)\b/i

export function deriveGender(productName: string): 'MAN' | 'WOM' | '' {
  const man = /\b(hombre|caballero)\b/i.test(productName)
  const wom = /\b(mujer|dama)\b/i.test(productName)
  if (man === wom) return ''
  return man ? 'MAN' : 'WOM'
}

/** "CAMISA MC" / "CAMISA ML" a partir del nombre del producto; '' si no hay certeza. */
export function deriveGarment(productName: string): string {
  const kind = GARMENT_KIND_RE.exec(productName)?.[1]?.toUpperCase()
  const long = /manga\s+larga/i.test(productName)
  const short = /manga\s+corta/i.test(productName)
  if (!kind || long === short) return ''
  return `${kind} ${short ? 'MC' : 'ML'}`
}

export interface LabelEvaluation {
  status: 'ok' | 'review'
  gender: string
  garment: string
  /** Texto de la línea [auto]: motivos de revisión o aviso de derivación. */
  auto: string
}

/**
 * Reglas de estado. 'ok' solo si: EAN con dígito de control válido, ref \d{5}[A-Z] que existe
 * como sku en products del negocio, producto sin marca [REVISAR, talla de lista cerrada y
 * género/prenda derivables del nombre del producto. Cualquier otra cosa → 'review'.
 */
export async function evaluateCapture(
  businessId: number,
  input: { ean: string; ref: string; size: string },
): Promise<LabelEvaluation> {
  const reasons: string[] = []
  if (!isValidEan13(input.ean)) reasons.push('EAN inválido')
  if (!normalizeSize(input.size)) reasons.push('talla vacía o fuera de lista')

  let gender = ''
  let garment = ''
  let derived = false
  if (!REF_RE.test(input.ref)) {
    reasons.push('ref inválida')
  } else {
    const products = await prisma.product.findMany({
      where: { business_id: businessId, sku: input.ref },
      select: { name: true },
      take: 2,
    })
    if (products.length === 0) reasons.push('ref sin producto en el negocio')
    else if (products.length > 1) reasons.push('ref en varios productos')
    else {
      const name = products[0].name
      if (name.startsWith(REVIEW_PREFIX)) reasons.push('producto marcado [REVISAR')
      gender = deriveGender(name)
      garment = deriveGarment(name)
      if (!gender) reasons.push('género no derivable del producto')
      if (!garment) reasons.push('prenda no derivable del producto')
      derived = true
    }
  }

  const parts = [
    ...(reasons.length ? [`revisar: ${reasons.join('; ')}`] : []),
    ...(derived ? ['género/prenda derivados del producto'] : []),
  ]
  return { status: reasons.length ? 'review' : 'ok', gender, garment, auto: parts.join(' | ') }
}

/** Reemplaza la línea [auto] de las notas sin tocar lo que escribió la persona. */
export function withAutoNote(notes: string | null | undefined, auto: string): string | null {
  const user = (notes ?? '')
    .split('\n')
    .filter(line => !line.startsWith(AUTO_PREFIX))
    .join('\n')
    .trim()
  return [auto ? `${AUTO_PREFIX}${auto}` : '', user].filter(Boolean).join('\n') || null
}

/* ── Serialización ── */

interface LabelCaptureRow {
  id: number
  ean: string
  ref: string
  model_name: string
  label_color: string
  garment: string
  size: string
  gender: string
  units: number
  color_actual: string | null
  status: string
  notes: string | null
  created_at: Date
  updated_at: Date
}

export function toDTO(row: LabelCaptureRow): LabelCaptureDTO {
  return {
    id: row.id,
    ean: row.ean,
    ref: row.ref,
    model_name: row.model_name,
    label_color: row.label_color,
    garment: row.garment,
    size: row.size,
    gender: row.gender,
    units: row.units,
    color_actual: row.color_actual,
    status: row.status === 'ok' ? 'ok' : 'review',
    notes: row.notes,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}
