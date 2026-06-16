import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE      = 2 * 1024 * 1024
const UPLOAD_DIR    = join(process.cwd(), 'public', 'uploads', 'products')

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' },    { status: 403 })

  try {
    const formData = await req.formData()
    const file     = formData.get('file')

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Solo se aceptan JPG, PNG o WebP' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo no puede superar 2 MB' }, { status: 400 })
    }

    const buffer   = Buffer.from(await file.arrayBuffer())
    const filename = `${randomUUID()}.jpg`

    await mkdir(UPLOAD_DIR, { recursive: true })

    const processed = await sharp(buffer)
      .resize(800, 800, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer()

    await writeFile(join(UPLOAD_DIR, filename), processed)

    return NextResponse.json({ ok: true, url: `/uploads/products/${filename}` }, { status: 201 })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
