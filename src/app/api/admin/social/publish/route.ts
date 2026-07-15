import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPost, BUFFER_IG_CHANNEL } from '@/lib/social/buffer'

export const runtime = 'nodejs'

const bodySchema = z.object({
  social_post_id:    z.number().int().positive().optional(),
  calendar_entry_id: z.number().int().positive().optional(),
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

  const post = await prisma.socialPost.findUnique({ where: { id: postId } })
  if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })
  if (!post.imagen_url) {
    return NextResponse.json({ error: 'El post no tiene imagen generada (Fase C pendiente)' }, { status: 400 })
  }

  const text = buildText(post.caption, post.hashtags)
  if (!text) return NextResponse.json({ error: 'El post no tiene caption ni hashtags' }, { status: 400 })

  let bufferId: string
  try {
    const result = await createPost({
      channelId: BUFFER_IG_CHANNEL,
      text,
      imageUrl:  post.imagen_url,
      dueAt:     body.due_at,
    })
    bufferId = result.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de Buffer'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const bufferStatus = body.due_at ? 'programado' : 'en_cola'

  await prisma.socialPost.update({
    where: { id: post.id },
    data:  { buffer_post_id: bufferId, buffer_status: bufferStatus, estado: 'publicado' },
  })

  if (body.calendar_entry_id) {
    await prisma.socialCalendarEntry.update({
      where: { id: body.calendar_entry_id },
      data:  { buffer_post_id: bufferId, estado: body.due_at ? 'programado' : 'publicado' },
    })
  }

  return NextResponse.json({ ok: true, buffer_post_id: bufferId, status: bufferStatus }, { status: 201 })
}
