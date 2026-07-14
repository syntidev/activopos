import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FORMATS } from '@/lib/social/brand'
import { generateBackground, generateCopy } from '@/lib/social/gemini'
import { composeSlide } from '@/lib/social/compose'

// Un carrusel de 6 slides son 6 llamadas al modelo de imagen con throttle de 7s entre
// ellas (free tier: 10 RPM). El default de Next.js no alcanza.
export const runtime     = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  tipo:      z.enum(['post', 'story', 'carrusel']),
  nicho:     z.string().min(1).max(80),
  gancho:    z.string().min(1).max(300),
  beneficio: z.string().max(300).optional(),
  objetivo:  z.string().min(1).max(120),
  slides:    z.number().int().min(1).max(8).optional(),
})

async function saveImage(buffer: Buffer): Promise<string> {
  const filename = `${randomUUID()}.webp`
  const dir      = join(process.cwd(), 'public', 'uploads', 'social')
  await mkdir(dir, { recursive: true, mode: 0o755 })
  await writeFile(join(dir, filename), buffer)
  return `/uploads/social/${filename}`
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const slideCount = body.tipo === 'carrusel' ? (body.slides ?? 4) : 1
  const { aspect } = FORMATS[body.tipo]

  // Se crea en 'pendiente' antes de llamar a Gemini: si la generación muere a mitad de un
  // carrusel queda rastro en DB con el error, en vez de desaparecer sin dejar huella.
  const post = await prisma.socialPost.create({
    data: {
      tipo:        body.tipo,
      nicho:       body.nicho,
      titulo:      body.gancho.slice(0, 200),
      descripcion: body.beneficio ?? null,
      estado:      'pendiente',
    },
  })

  try {
    const copy = await generateCopy({
      tipo:      body.tipo,
      nicho:     body.nicho,
      gancho:    body.gancho,
      beneficio: body.beneficio,
      objetivo:  body.objetivo,
      slides:    slideCount,
    })

    const slides = copy.slides.slice(0, slideCount)
    if (slides.length === 0) throw new Error('Gemini no devolvió slides')

    // Secuencial a propósito: generateBackground comparte un throttle de 10 RPM.
    // En paralelo solo llegaríamos al 429 más rápido.
    const assets: { orden: number; imagen_url: string; titulo: string; subtitulo: string }[] = []
    for (let index = 0; index < slides.length; index++) {
      const slide      = slides[index]
      const background = await generateBackground(slide.escena, body.nicho, aspect)
      const composed   = await composeSlide({
        background,
        titulo:    slide.titulo,
        subtitulo: slide.subtitulo,
        formato:   body.tipo,
      })
      assets.push({
        orden:      index,
        imagen_url: await saveImage(composed),
        titulo:     slide.titulo,
        subtitulo:  slide.subtitulo,
      })
    }

    const updated = await prisma.socialPost.update({
      where: { id: post.id },
      data:  {
        titulo:     slides[0].titulo,
        caption:    copy.caption,
        hashtags:   copy.hashtags,
        estado:     'generado',
        imagen_url: assets[0].imagen_url,
        assets:     { create: assets },
      },
      include: { assets: { orderBy: { orden: 'asc' } } },
    })

    return NextResponse.json({ ok: true, post: updated }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('Social generate error:', err)

    await prisma.socialPost.update({
      where: { id: post.id },
      data:  { estado: 'error', error_msg: message.slice(0, 500) },
    })

    return NextResponse.json({ error: message, postId: post.id }, { status: 502 })
  }
}
