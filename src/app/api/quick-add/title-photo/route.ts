import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { labelOcrLimiter } from '@/lib/rate-limit'
import { requireQuickAdd } from '@/lib/quick-add'
import { VisionError, readBoxTitle } from '@/lib/label-vision'
import type { TitleHit } from '@/types/quick-add'

const MAX_SIZE = 3 * 1024 * 1024 // 3 MB
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

/** Último recurso para el título: lo que está impreso en la foto de la caja (nunca deducido del EAN). */
export async function POST(req: Request): Promise<NextResponse> {
  const session = await requireQuickAdd()
  if (session instanceof NextResponse) return session

  try {
    await labelOcrLimiter.consume(String(session.userId))
  } catch {
    return NextResponse.json({ error: 'Demasiadas lecturas, espera un momento' }, { status: 429 })
  }

  const file = (await req.formData().catch(() => null))?.get('file')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'La imagen no puede superar 3 MB' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  // Validación por bytes: el Content-Type del cliente no cuenta.
  const meta = await sharp(buffer).metadata().catch(() => null)
  if (!meta?.format || !ALLOWED_FORMATS.has(meta.format)) {
    return NextResponse.json({ error: 'Solo se aceptan JPG, PNG o WebP' }, { status: 400 })
  }

  try {
    const title = await readBoxTitle(buffer)
    const hit: TitleHit | null = title ? { title, source: 'vision' } : null
    return NextResponse.json({ title: hit })
  } catch (err) {
    if (err instanceof VisionError) return NextResponse.json({ error: err.message }, { status: 502 })
    console.error('quick-add title-photo error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo leer el título' }, { status: 500 })
  }
}
