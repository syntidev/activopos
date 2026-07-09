import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams
  const page     = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const limit    = Math.min(50, Math.max(1, parseInt(sp.get('limit') ?? '9', 10) || 9))
  const category = sp.get('category')
  const featured = sp.get('featured') === 'true'

  const where = {
    status:       'published',
    published_at: { lte: new Date() },
    ...(category ? { category } : {}),
    ...(featured ? { is_featured: true } : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { published_at: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      select: {
        id: true, title: true, slug: true, excerpt: true, featured_image: true,
        category: true, tags: true, author: true, published_at: true,
        read_time: true, views: true, is_featured: true,
      },
    }),
    prisma.blogPost.count({ where }),
  ])

  // cover_image/author_name/read_time_minutes son alias — contrato documentado
  // por CLI-B en src/app/(marketing)/blog/types.ts (BlogPostSummary).
  const posts = rows.map(p => ({
    ...p,
    cover_image:       p.featured_image,
    author_name:       p.author,
    read_time_minutes: parseInt(p.read_time ?? '', 10) || 5,
  }))

  return NextResponse.json({
    ok:    true,
    posts,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  })
}
