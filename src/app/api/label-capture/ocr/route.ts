import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { labelOcrLimiter } from '@/lib/rate-limit'
import { requireLabelCapture } from '@/lib/label-capture'
import { DEFAULT_PROFILE, isProfileId } from '@/lib/label-profiles'
import { VisionError, readLabel, readOnLabel } from '@/lib/label-vision'

const MAX_SIZE = 3 * 1024 * 1024 // 3 MB
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])

export async function POST(req: Request): Promise<NextResponse> {
  const session = await requireLabelCapture()
  if (session instanceof NextResponse) return session

  try {
    await labelOcrLimiter.consume(String(session.userId))
  } catch {
    return NextResponse.json({ error: 'Demasiadas lecturas, espera un momento' }, { status: 429 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  // Sin perfil = Safetti (comportamiento original); un perfil desconocido se rechaza.
  const profile = form?.get('profile') ?? DEFAULT_PROFILE
  if (!isProfileId(profile)) return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'La imagen no puede superar 3 MB' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  // Validación por bytes: el Content-Type del cliente no cuenta.
  const meta = await sharp(buffer).metadata().catch(() => null)
  if (!meta?.format || !ALLOWED_FORMATS.has(meta.format)) {
    return NextResponse.json({ error: 'Solo se aceptan JPG, PNG o WebP' }, { status: 400 })
  }

  try {
    return NextResponse.json(profile === 'on' ? await readOnLabel(buffer) : await readLabel(buffer))
  } catch (err) {
    if (err instanceof VisionError) return NextResponse.json({ error: err.message }, { status: 502 })
    console.error('label-capture ocr error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo leer la etiqueta' }, { status: 500 })
  }
}
