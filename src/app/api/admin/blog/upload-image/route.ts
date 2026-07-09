import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { uploadLimiter, getClientIp } from '@/lib/rate-limit'

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp'])
const MAX_SIZE         = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    await uploadLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const formData = await req.formData()
    const file     = formData.get('image')

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo no puede superar 5 MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Magic-byte validation — rechaza archivos cuyos bytes no correspondan a una imagen
    let meta: Awaited<ReturnType<typeof sharp.prototype.metadata>>
    try {
      meta = await sharp(buffer).metadata()
    } catch {
      return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
    }
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      return NextResponse.json({ error: 'Solo se aceptan JPG, PNG o WebP' }, { status: 400 })
    }

    const filename   = `${randomUUID()}.webp`
    const uploadDir  = join(process.cwd(), 'public', 'uploads', 'blog')
    await mkdir(uploadDir, { recursive: true, mode: 0o755 })

    // 1200x630 — proporción estándar de imagen destacada/OG para posts de blog
    const webpBuffer = await sharp(buffer)
      .resize(1200, 630, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer()

    await writeFile(join(uploadDir, filename), webpBuffer)

    return NextResponse.json({ ok: true, url: `/uploads/blog/${filename}` }, { status: 201 })
  } catch (err) {
    console.error('Blog upload error:', err)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
