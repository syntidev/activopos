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

  // $executeRaw en vez de .update(): Prisma dispara @updatedAt en CUALQUIER
  // update(), aunque el cambio sea solo `views` — eso corrompia el lastModified
  // del sitemap cada vez que alguien leia el post. UPDATE crudo lo evita.
  await prisma.$executeRaw`UPDATE blog_posts SET views = views + 1 WHERE id = ${post.id}`
  const updated = await prisma.blogPost.findUniqueOrThrow({ where: { id: post.id } })

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
