import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Clock, User } from 'lucide-react'
import { fetchBlogList, fetchBlogCategories, categoryColor, type BlogPostSummary } from './types'
import RevealSection from '@/components/marketing/shared/RevealSection'
import styles from './blog.module.css'

interface PageProps {
  searchParams: { page?: string; category?: string }
}

const PAGE_SIZE = 9

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Guías y recursos sobre ventas, inventario y tecnología para negocios venezolanos. Artículos prácticos de ActivoPOS.',
  alternates: { canonical: 'https://activopos.com/blog' },
  openGraph: {
    title: 'Blog | ActivoPOS',
    description: 'Guías y recursos para negocios venezolanos.',
    url: 'https://activopos.com/blog',
    type: 'website',
  },
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/blog/${post.slug}`} className={styles.card}>
      <div className={styles.cardImgWrap}>
        {post.cover_image && (
          <img src={post.cover_image} alt="" className={styles.cardImg} loading="lazy" />
        )}
        <span
          className={styles.cardBadge}
          style={{ '--badge-color': post.category_color ?? categoryColor(post.category) } as CSSProperties}
        >
          {post.category}
        </span>
      </div>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>{post.title}</h2>
        <p className={styles.cardExcerpt}>{post.excerpt}</p>
        <p className={styles.cardMeta}>
          {post.author_name} · {fmtDate(post.published_at)} · {post.read_time_minutes} min
        </p>
      </div>
    </Link>
  )
}

export default async function BlogPage({ searchParams }: PageProps) {
  const page     = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const category = searchParams.category ?? ''

  const [data, availableCategories] = await Promise.all([
    fetchBlogList({ page, category, limit: PAGE_SIZE }),
    fetchBlogCategories(),
  ])
  const posts = data?.posts ?? []
  const total = data?.total ?? 0
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1

  // El post destacado solo se muestra en la primera página sin filtro —
  // evita que reaparezca arriba de cada página/categoría filtrada.
  const showFeatured = page === 1 && !category
  const featured = showFeatured ? posts.find(p => p.is_featured) ?? null : null
  const gridPosts = featured ? posts.filter(p => p.slug !== featured.slug) : posts

  return (
    <>
      <section className={styles.hero}>
        <RevealSection>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>Blog ActivoPOS</h1>
            <p className={styles.heroSubtitle}>Guías y recursos para negocios venezolanos</p>
          </div>
        </RevealSection>
      </section>

      <div className={styles.page}>
        <div className={styles.inner}>
          {featured && (
            <RevealSection>
              <Link href={`/blog/${featured.slug}`} className={styles.featured}>
                <div className={styles.featuredImgWrap}>
                  {featured.cover_image && (
                    <img src={featured.cover_image} alt="" className={styles.featuredImg} loading="eager" />
                  )}
                </div>
                <div className={styles.featuredContent}>
                  <span
                    className={styles.featuredBadge}
                    style={{ '--badge-color': featured.category_color ?? categoryColor(featured.category) } as CSSProperties}
                  >
                    {featured.category}
                  </span>
                  <h2 className={styles.featuredTitle}>{featured.title}</h2>
                  <p className={styles.featuredExcerpt}>{featured.excerpt}</p>
                  <div className={styles.meta}>
                    <User size={13} aria-hidden="true" />
                    {featured.author_name}
                    <span className={styles.metaDot} aria-hidden="true">·</span>
                    {fmtDate(featured.published_at)}
                    <span className={styles.metaDot} aria-hidden="true">·</span>
                    <Clock size={13} aria-hidden="true" />
                    {featured.read_time_minutes} min de lectura
                  </div>
                </div>
              </Link>
            </RevealSection>
          )}

          <nav className={styles.chipsScroll} aria-label="Filtrar por categoría">
            <div className={styles.chipsTrack}>
              <Link
                href="/blog"
                className={`${styles.chip} ${!category ? styles.chipActive : ''}`}
              >
                Todos
              </Link>
              {availableCategories.map(cat => (
                <Link
                  key={cat}
                  href={`/blog?category=${encodeURIComponent(cat)}`}
                  className={`${styles.chip} ${category === cat ? styles.chipActive : ''}`}
                >
                  {cat}
                </Link>
              ))}
            </div>
          </nav>

          {gridPosts.length === 0 ? (
            <p className={styles.emptyState}>
              {data === null
                ? 'No pudimos cargar los artículos. Intenta de nuevo en unos minutos.'
                : 'Aún no hay artículos en esta categoría.'}
            </p>
          ) : (
            <RevealSection>
              <div className={styles.grid}>
                {gridPosts.map(post => <PostCard key={post.slug} post={post} />)}
              </div>
            </RevealSection>
          )}

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Link
                href={`/blog?page=${page - 1}${category ? `&category=${category}` : ''}`}
                className={`${styles.pageBtn} ${page <= 1 ? styles.pageBtnDisabled : ''}`}
                aria-disabled={page <= 1}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Anterior
              </Link>
              <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
              <Link
                href={`/blog?page=${page + 1}${category ? `&category=${category}` : ''}`}
                className={`${styles.pageBtn} ${page >= totalPages ? styles.pageBtnDisabled : ''}`}
                aria-disabled={page >= totalPages}
              >
                Siguiente
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
