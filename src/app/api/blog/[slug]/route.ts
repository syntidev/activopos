import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SLUG_RE = /^[a-z0-9-]{1,255}$/

type Context = { params: { slug: string } }

export async function GET(_req: NextRequest, { params }: Context) {
  if (!SLUG_RE.test(params.slug)) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  const post = await prisma.blogPost.findFirst({
    where: { slug: params.slug, status: 'published' },
  })
  if (!post) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const updated = await prisma.blogPost.update({
    where: { id: post.id },
    data:  { views: { increment: 1 } },
  })

  // content_html/cover_image/author_name/read_time_minutes son alias —
  // contrato documentado por CLI-B en src/app/(marketing)/blog/types.ts (BlogPostFull).
  return NextResponse.json({
    ok:   true,
    post: {
      ...updated,
      content_html:       updated.content,
      cover_image:        updated.featured_image,
      author_name:        updated.author,
      read_time_minutes:  parseInt(updated.read_time ?? '', 10) || 5,
    },
  })
}
