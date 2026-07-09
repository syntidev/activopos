import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 250)
}

const postSchema = z.object({
  title:            z.string().min(1).max(255),
  slug:             z.string().min(1).max(255).optional(),
  excerpt:          z.string().nullable().optional(),
  content:          z.string().min(1),
  featured_image:   z.string().max(500).nullable().optional(),
  category:         z.string().max(80).nullable().optional(),
  tags:             z.array(z.string()).nullable().optional(),
  author:           z.string().max(100).optional(),
  status:           z.enum(['draft', 'published']).default('draft'),
  published_at:     z.string().datetime().nullable().optional(),
  is_featured:      z.boolean().optional(),
  meta_title:       z.string().max(255).nullable().optional(),
  meta_description: z.string().max(255).nullable().optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const posts = await prisma.blogPost.findMany({ orderBy: { created_at: 'desc' } })
  return NextResponse.json({ ok: true, posts })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'super_admin') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = await req.json()
    const data = postSchema.parse(body)
    const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.title)

    const post = await prisma.blogPost.create({
      data: {
        title:            data.title,
        slug,
        excerpt:          data.excerpt ?? null,
        content:          data.content,
        featured_image:   data.featured_image ?? null,
        category:         data.category ?? null,
        tags:             data.tags ?? undefined,
        author:           data.author ?? undefined,
        status:           data.status,
        published_at:     data.published_at ? new Date(data.published_at) : null,
        is_featured:      data.is_featured ?? false,
        meta_title:       data.meta_title ?? null,
        meta_description: data.meta_description ?? null,
      },
    })

    return NextResponse.json({ ok: true, post }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un post con ese slug' }, { status: 409 })
    }
    console.error('Blog post create error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
