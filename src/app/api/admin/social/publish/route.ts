import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPost, BUFFER_CHANNELS, type BufferChannelName } from '@/lib/social/buffer'

export const runtime = 'nodejs'

const bodySchema = z.object({
  social_post_id:    z.number().int().positive().optional(),
  calendar_entry_id: z.number().int().positive().optional(),
  // Default ['instagram']: mismo comportamiento exacto que antes de agregar Facebook
  // para cualquier caller que no mande este campo.
  channels:          z.array(z.enum(['instagram', 'facebook'])).min(1).default(['instagram']),
  // ISO 8601 UTC. Si viene, se programa (customScheduled); si no, addToQueue.
  due_at:            z.string().datetime().optional(),
}).refine(b => b.social_post_id || b.calendar_entry_id, {
  message: 'Se requiere social_post_id o calendar_entry_id',
})

function buildText(caption: string | null, hashtags: unknown): string {
  const tags = Array.isArray(hashtags)
    ? hashtags.map(h => `#${String(h).replace(/^#/, '')}`).join(' ')
    : typeof hashtags === 'string' ? hashtags : ''
  return [caption ?? '', tags].filter(Boolean).join('\n\n').trim()
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

  // Resolver el SocialPost (tiene la imagen). Una calendar_entry publica a través de su
  // SocialPost vinculado — sin él no hay media que enviar a Buffer.
  const postId = body.social_post_id
    ?? (await prisma.socialCalendarEntry.findUnique({
          where:  { id: body.calendar_entry_id },
          select: { social_post_id: true },
        }))?.social_post_id
    ?? null

  if (!postId) {
    return NextResponse.json({ error: 'La entrada no tiene un post generado con imagen' }, { status: 400 })
  }

  const post = await prisma.socialPost.findUnique({
    where:   { id: postId },
    include: { assets: { orderBy: { orden: 'asc' } } },
  })
  if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })

  // Carrusel: cada SocialAsset es una imagen, en orden. Si no hay assets, se cae
  // a imagen_url (post simple de una sola imagen). Antes solo se enviaba
  // imagen_url, así que un carrusel llegaba a Buffer con una sola imagen.
  const mediaUrls = post.assets.length > 0
    ? post.assets.map(a => a.imagen_url)
    : post.imagen_url
      ? [post.imagen_url]
      : []

  if (mediaUrls.length === 0) {
    return NextResponse.json({ error: 'El post no tiene imágenes generadas' }, { status: 400 })
  }

  const text = buildText(post.caption, post.hashtags)
  if (!text) return NextResponse.json({ error: 'El post no tiene caption ni hashtags' }, { status: 400 })

  // Un canal = una mutation createPost independiente (CreatePostInput.channelId
  // es scalar no-lista, verificado por introspection real del schema de Buffer).
  // Se intentan todos los canales aunque alguno falle — resultado parcial es
  // mejor que all-or-nothing cuando ya se generó la imagen y el copy.
  const channels = body.channels as BufferChannelName[]
  const results: { channel: BufferChannelName; ok: boolean; buffer_post_id?: string; error?: string }[] = []

  for (const channel of channels) {
    try {
      const result = await createPost({
        channelId: BUFFER_CHANNELS[channel],
        text,
        imageUrls: mediaUrls,
        dueAt:     body.due_at,
      })
      results.push({ channel, ok: true, buffer_post_id: result.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de Buffer'
      results.push({ channel, ok: false, error: message })
    }
  }

  const succeeded = results.filter(r => r.ok)
  if (succeeded.length === 0) {
    return NextResponse.json({ error: 'Buffer rechazó todos los canales', results }, { status: 502 })
  }

  const bufferStatus = body.due_at ? 'programado' : 'en_cola'
  // Un solo canal exitoso: mismo formato de siempre (string plano), sin romper
  // a nadie que ya lea buffer_post_id como string. 2+ canales: mapa JSON
  // {canal: id} — no hay forma de guardar 2 IDs distintos en un solo campo string.
  const bufferPostIdValue = succeeded.length === 1
    ? succeeded[0].buffer_post_id!
    : JSON.stringify(Object.fromEntries(succeeded.map(r => [r.channel, r.buffer_post_id])))

  await prisma.socialPost.update({
    where: { id: post.id },
    data:  { buffer_post_id: bufferPostIdValue, buffer_status: bufferStatus, estado: 'publicado' },
  })

  if (body.calendar_entry_id) {
    await prisma.socialCalendarEntry.update({
      where: { id: body.calendar_entry_id },
      data:  { buffer_post_id: bufferPostIdValue, estado: body.due_at ? 'programado' : 'publicado' },
    })
  }

  return NextResponse.json({ ok: true, buffer_post_id: bufferPostIdValue, status: bufferStatus, results }, { status: 201 })
}
