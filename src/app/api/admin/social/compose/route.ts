import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { composeSlide, type LayerOverride, type DeviceVariant } from '@/lib/social/compose'
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
 *
 * Persistencia real (antes efímero, migración 20260729000001): nicho y
 * device_variant se LEEN de la DB, no del body -- el nicho decide POS-vs-
 * teléfono en selectDevice() y device_variant asegura que un re-sellado
 * reproduce el MISMO mockup en vez de que selectDevice() tire el dado de
 * nuevo. layer_override y el device_variant que quedó realmente compuesto
 * se persisten de vuelta en el mismo asset.
 */

const posSchema = z.object({ x: z.number(), y: z.number() })
const alignSchema = z.enum(['left', 'center', 'right'])

// Mismo shape que layer_override persiste -- verificado antes de escribir
// esto: no hace falta un campo nuevo en el body, override ya cubre todo lo
// que LayerOverride necesita.
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

  // El post debe existir (solo super_admin llega acá). nicho se lee de acá,
  // no del body -- mismo criterio que business_id: dato de confianza sale
  // del servidor, no de lo que mande el cliente.
  const post = await prisma.socialPost.findUnique({
    where: { id: body.social_post_id }, select: { id: true, nicho: true },
  })
  if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })

  // El mockup guardado del asset de portada -- se pasa a composeSlide para
  // reproducir el mismo device, no uno nuevo random. Si el asset no existe
  // todavía (post generado antes de esta migración) queda undefined, y
  // composeSlide cae al comportamiento de siempre (selectDevice al azar).
  const existingAsset = await prisma.socialAsset.findFirst({
    where: { post_id: post.id, orden: 0 }, select: { device_variant: true },
  })

  try {
    // Baja el fondo crudo de Cloudinary. composeSlide trabaja con Buffer.
    const res = await fetch(body.background_url)
    if (!res.ok) return NextResponse.json({ error: 'No se pudo leer el fondo' }, { status: 502 })
    const background = Buffer.from(await res.arrayBuffer())

    const { buffer, deviceVariant } = await composeSlide({
      background,
      titulo:        body.titulo,
      subtitulo:     body.subtitulo,
      formato:       body.formato,
      aspect:        body.aspect,
      nicho:         post.nicho ?? undefined,
      deviceVariant: (existingAsset?.device_variant as DeviceVariant | null) ?? undefined,
      override:      body.override as LayerOverride,
    })
    const sealedUrl = await uploadImage(buffer)

    // El post pasa a apuntar a la versión editada. El asset de portada también,
    // para que historial y publish usen la imagen sellada por el usuario.
    // layer_override y device_variant quedan persistidos -- antes se perdían
    // al recargar la página, el editor era efímero.
    await prisma.$transaction([
      prisma.socialPost.update({ where: { id: post.id }, data: { imagen_url: sealedUrl } }),
      prisma.socialAsset.updateMany({
        where: { post_id: post.id, orden: 0 },
        data:  {
          imagen_url:     sealedUrl,
          background_url: body.background_url,
          device_variant: deviceVariant,
          layer_override: body.override,
        },
      }),
    ])

    return NextResponse.json({ ok: true, imagen_url: sealedUrl }, { status: 201 })
  } catch (err) {
    console.error('social compose POST:', err)
    return NextResponse.json({ error: 'Error al sellar la imagen' }, { status: 500 })
  }
}
