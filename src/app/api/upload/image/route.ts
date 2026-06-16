import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { uploadImage } from '@/lib/cloudinary'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE      = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session)                   return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' },    { status: 403 })

  try {
    const formData = await req.formData()
    const file     = formData.get('file')
    const rawFolder = formData.get('folder')
    const folder   = typeof rawFolder === 'string' ? rawFolder : 'activopos/products'

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Solo se aceptan JPG, PNG o WebP' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo no puede superar 2 MB' }, { status: 400 })
    }

    const buffer            = Buffer.from(await file.arrayBuffer())
    const { url, publicId } = await uploadImage(buffer, folder)

    return NextResponse.json({ ok: true, url, public_id: publicId }, { status: 201 })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}
