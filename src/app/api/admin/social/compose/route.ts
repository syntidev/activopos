import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { composeSlide, type LayerOverride } from '@/lib/social/compose'
import { uploadImage } from '@/lib/social/cloudinary'

export const runtime = 'nodejs'

/* ── POST /api/admin/social/compose ───────────────────────────────────────────
 *
 * Re-sella una imagen ya generada aplicando los ajustes del editor (Fase B).
 * Recibe la URL del fondo CRUDO (la que devolvió generate en background_urls),
 * los textos y el override de capas; compone con sharp y sube el resultado.
 *
 * generate ya dejó una versión sellada con posiciones default (Opción A), así
 * que esto solo corre cuando el usuario editó y confirmó — nunca deja un post
 * sin marca.
 */

const posSchema = z.object({ x: z.number(), y: z.number() })
const alignSchema = z.enum(['left', 'center', 'right'])

const overrideSchema = z.object({
  titlePos:       posSchema.optional(),
  subtitlePos:    posSchema.optional(),
  logoPos:        posSchema.optional(),
  titleSize:      z.number().min(8).max(200).optional(),
  subtitleSize:   z.number().min(8).max(200).optional(),
  logoSize:       z.number().min(16).max(400).optional(),
  titleColor:     z.string().max(30).optional(),
  subtitleColor:  z.string().max(30).optional(),
  logoType:       z.enum(['negative', 'positive']).optional(),
  showLogo:       z.boolean().optional(),
  showTitle:      z.boolean().optional(),
  showSubtitle:   z.boolean().optional(),
  titleAlign:     alignSchema.optional(),
  subtitleAlign:  alignSchema.optional(),
  titleShadow:    z.boolean().optional(),
  subtitleShadow: z.boolean().optional(),
}).strict()

const bodySchema = z.object({
  social_post_id: z.number().int().positive(),
  background_url: z.string().url(),
  titulo:         z.string().max(300),
  subtitulo:      z.string().max(300),
  formato:        z.enum(['post', 'story', 'carrusel']),
  aspect:         z.enum(['1:1', '4:5', '3:4', '9:16']),
  override:       overrideSchema,
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // El post debe existir (solo super_admin llega acá).
  const post = await prisma.socialPost.findUnique({
    where: { id: body.social_post_id }, select: { id: true },
  })
  if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })

  try {
    // Baja el fondo crudo de Cloudinary. composeSlide trabaja con Buffer.
    const res = await fetch(body.background_url)
    if (!res.ok) return NextResponse.json({ error: 'No se pudo leer el fondo' }, { status: 502 })
    const background = Buffer.from(await res.arrayBuffer())

    const composed = await composeSlide({
      background,
      titulo:    body.titulo,
      subtitulo: body.subtitulo,
      formato:   body.formato,
      aspect:    body.aspect,
      override:  body.override as LayerOverride,
    })
    const sealedUrl = await uploadImage(composed)

    // El post pasa a apuntar a la versión editada. El asset de portada también,
    // para que historial y publish usen la imagen sellada por el usuario.
    await prisma.$transaction([
      prisma.socialPost.update({ where: { id: post.id }, data: { imagen_url: sealedUrl } }),
      prisma.socialAsset.updateMany({
        where: { post_id: post.id, orden: 0 }, data: { imagen_url: sealedUrl },
      }),
    ])

    return NextResponse.json({ ok: true, imagen_url: sealedUrl }, { status: 201 })
  } catch (err) {
    console.error('social compose POST:', err)
    return NextResponse.json({ error: 'Error al sellar la imagen' }, { status: 500 })
  }
}
