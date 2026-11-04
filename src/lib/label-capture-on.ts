import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toDTO, withAutoNote } from '@/lib/label-capture'
import { evaluateOn, normalizeGender, normalizeOnStyle, normalizeShoeSize, onVariantValue, parseOnStyle } from '@/lib/label-profiles'
import type { OnCaptureBody, OnCaptureResponse } from '@/types/label-capture'

/** El EAN ya existe pero pertenece a otro perfil de marca: no se suma ni se pisa. */
export class OnProfileConflictError extends Error {}

/**
 * Guarda una captura del perfil On. Producto = estilo completo, variante = el EAN con su talla.
 * Un EAN repetido suma 1 unidad a su variante (nunca crea otra fila). Lo que no cumple las
 * reglas se guarda igual en 'review' con el motivo en las notas.
 */
export async function saveOnCapture(businessId: number, input: Omit<OnCaptureBody, 'profile'>): Promise<OnCaptureResponse> {
  const style = normalizeOnStyle(input.style)
  const gender = normalizeGender(input.gender)
  const [us, eu, uk, jp] = [input.us, input.eu, input.uk, input.jp].map(normalizeShoeSize)
  const ev = evaluateOn({ ean: input.ean, style, gender, us, eu })
  const byEan = { business_id_ean: { business_id: businessId, ean: input.ean } }

  const bump = async (): Promise<OnCaptureResponse> => {
    const row = await prisma.labelCapture.update({ where: byEan, data: { units: { increment: 1 } } })
    return { item: toDTO(row), added: true, reasons: [] }
  }

  const existing = await prisma.labelCapture.findUnique({ where: byEan, select: { profile: true } })
  if (existing) {
    if (existing.profile !== 'on') throw new OnProfileConflictError('Ese EAN está registrado en otro perfil')
    return bump()
  }

  try {
    const row = await prisma.labelCapture.create({
      data: {
        business_id: businessId,
        profile: 'on',
        ean: input.ean,
        ref: parseOnStyle(style)?.base ?? '',
        style,
        model_name: input.model_name,
        label_color: input.colorway,
        garment: '',
        gender,
        size: onVariantValue(us, eu),
        size_us: us,
        size_eu: eu,
        size_uk: uk,
        size_jp: jp,
        status: ev.status,
        notes: withAutoNote(null, ev.reasons.length ? `revisar: ${ev.reasons.join('; ')}` : ''),
      },
    })
    return { item: toDTO(row), added: false, reasons: ev.reasons }
  } catch (err) {
    // Dos capturas del mismo EAN a la vez: la segunda cae aquí y también suma.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return bump()
    throw err
  }
}
