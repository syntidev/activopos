import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { uploadLimiter, getClientIp } from '@/lib/rate-limit'

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])
const MAX_SIZE        = 5 * 1024 * 1024 // 5MB — fotos de teléfono son 3-4MB

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
    // type selecciona el subdirectorio del tenant; default 'product' (backward compatible)
    const type     = formData.get('type') === 'logo' ? 'logo' : 'products'

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo no puede superar 5 MB' }, { status: 400 })
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

    const filenameFull  = `${randomUUID()}.webp`
    const filenameThumb = `${randomUUID()}_thumb.webp`
    const uploadDir     = join(process.cwd(), 'storage', 'tenants', String(session.businessId), type)
    const urlBase       = `/storage/tenants/${session.businessId}/${type}`

    await mkdir(uploadDir, { recursive: true, mode: 0o755 })

    // Versión full para vitrina (1200px, retina) — fit:inside conserva aspect ratio, sin recortar
    const { data: fullData, info: fullInfo } = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true })

    // Thumbnail para grid de cards (400px, cuadrado)
    const thumbData = await sharp(buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer()

    await writeFile(join(uploadDir, filenameFull), fullData)
    await writeFile(join(uploadDir, filenameThumb), thumbData)

    return NextResponse.json(
      {
        ok:      true,
        url:     `${urlBase}/${filenameFull}`,
        thumb:   `${urlBase}/${filenameThumb}`,
        format:  'webp',
        size_kb: Math.round(fullData.length / 1024),
        width:   fullInfo.width,
        height:  fullInfo.height,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
