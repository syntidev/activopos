import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { uploadLimiter, getClientIp } from '@/lib/rate-limit'

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])
const MAX_SIZE        = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    await uploadLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' },    { status: 403 })

  try {
    const formData = await req.formData()
    const file     = formData.get('file')

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo no puede superar 2 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Magic-byte validation — rejects files whose bytes don't match an image format
    let meta: Awaited<ReturnType<typeof sharp.prototype.metadata>>
    try {
      meta = await sharp(buffer).metadata()
    } catch {
      return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
    }
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      return NextResponse.json({ error: 'Solo se aceptan JPG, PNG o WebP' }, { status: 400 })
    }

    const filename  = `${randomUUID()}.webp`
    const uploadDir = join(process.cwd(), 'public', 'uploads', String(session.businessId))

    await mkdir(uploadDir, { recursive: true })

    const processed = await sharp(buffer)
      .resize(800, 800, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    await writeFile(join(uploadDir, filename), processed)

    return NextResponse.json(
      { ok: true, url: `/uploads/${session.businessId}/${filename}` },
      { status: 201 },
    )
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
