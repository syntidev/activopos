import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DOMPurify from 'isomorphic-dompurify'
import { Clock, User, ArrowLeft, ArrowRight } from 'lucide-react'
import {
  fetchBlogPost, fetchBlogList, categoryColor,
  type BlogPostSummary,
} from '../types'
import styles from '../blog.module.css'

interface PageProps {
  params: { slug: string }
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await fetchBlogPost(params.slug)
  if (!post) return { title: 'Artículo no encontrado' }

  const ogImages = post.cover_image ? [{ url: post.cover_image, alt: post.title }] : []
  return {
    title:       post.title,
    description: post.excerpt,
    alternates:  { canonical: `https://activopos.com/blog/${post.slug}` },
    openGraph: {
      title:       post.title,
      description: post.excerpt,
      url:         `https://activopos.com/blog/${post.slug}`,
      type:        'article',
      images:      ogImages,
      publishedTime: post.published_at,
      authors:     [post.author_name],
    },
    twitter: {
      card:  ogImages.length ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.excerpt,
      images: ogImages.map(i => i.url),
    },
  }
}

function RelatedCard({ post }: { post: BlogPostSummary }) {
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
        <h3 className={styles.cardTitle}>{post.title}</h3>
        <p className={styles.cardExcerpt}>{post.excerpt}</p>
        <p className={styles.cardMeta}>{post.read_time_minutes} min de lectura</p>
      </div>
    </Link>
  )
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = await fetchBlogPost(params.slug)
  if (!post) notFound()

  // Relacionados + prev/next se derivan de la misma categoría vía el único
  // endpoint de listado disponible (GET /api/blog) — no se inventa un
  // endpoint nuevo solo para esto.
  const siblings = await fetchBlogList({ category: post.category, limit: 12 })
  const inCategory = (siblings?.posts ?? []).filter(p => p.slug !== post.slug)
  const related = inCategory.slice(0, 3)

  const ordered = siblings?.posts ?? []
  const idx = ordered.findIndex(p => p.slug === post.slug)
  const prev = idx > 0 ? ordered[idx - 1] : null
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null

  const badgeColor = post.category_color ?? categoryColor(post.category)

  // dangerouslySetInnerHTML x2 abajo: 1) contenido del post — viene de un backend
  // aún no entregado (sin garantía de sanitización propia), se sanitiza acá antes
  // de renderizar público. 2) JSON-LD — JSON.stringify ya escapa comillas/backslash,
  // pero no "</script>" dentro de un string; se reemplaza para evitar breakout.
  const contentHtml = DOMPurify.sanitize(post.content_html)

  const jsonLd = {
    '@context':      'https://schema.org',
    '@type':         'BlogPosting',
    headline:        post.title,
    description:     post.excerpt,
    image:           post.cover_image ?? undefined,
    datePublished:   post.published_at,
    author:          { '@type': 'Person', name: post.author_name },
    publisher:       { '@type': 'Organization', name: 'ActivoPOS' },
    mainEntityOfPage: `https://activopos.com/blog/${post.slug}`,
  }
  const jsonLdSafe = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return (
    <div className={styles.detailPage}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe }}
      />

      <div className={styles.detailHero}>
        {post.cover_image && (
          <img src={post.cover_image} alt={post.title} className={styles.detailHeroImg} />
        )}
      </div>

      <div className={styles.articleWrap}>
        <article className={styles.article}>
          <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
            <Link href="/">Inicio</Link>
            <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
            <Link href="/blog">Blog</Link>
            <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
            <Link href={`/blog?category=${encodeURIComponent(post.category)}`}>{post.category}</Link>
            <span className={styles.breadcrumbSep} aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent}>{post.title}</span>
          </nav>

          <div className={styles.detailBadgeRow}>
            <span
              className={styles.featuredBadge}
              style={{ '--badge-color': badgeColor } as CSSProperties}
            >
              {post.category}
            </span>
            <span className={styles.meta}>
              {fmtDate(post.published_at)}
              <span className={styles.metaDot} aria-hidden="true">·</span>
              <Clock size={13} aria-hidden="true" />
              {post.read_time_minutes} min de lectura
            </span>
          </div>

          <h1 className={styles.detailTitle}>{post.title}</h1>

          <p className={styles.detailAuthor}>
            <User size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Por <strong>{post.author_name}</strong>
          </p>

          <div className={styles.prose} dangerouslySetInnerHTML={{ __html: contentHtml }} />

          {post.tags.length > 0 && (
            <div className={styles.tags}>
              {post.tags.map(tag => (
                <span key={tag} className={styles.tagChip}>#{tag}</span>
              ))}
            </div>
          )}
        </article>
      </div>

      {(prev || next) && (
        <div className={styles.navRow}>
          {prev ? (
            <Link href={`/blog/${prev.slug}`} className={styles.navBtn}>
              <span className={styles.navBtnLabel}>
                <ArrowLeft size={12} aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
                Anterior
              </span>
              <span className={styles.navBtnTitle}>{prev.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/blog/${next.slug}`} className={`${styles.navBtn} ${styles.navBtnNext}`}>
              <span className={styles.navBtnLabel}>
                Siguiente
                <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: '-1px', marginLeft: 4 }} />
              </span>
              <span className={styles.navBtnTitle}>{next.title}</span>
            </Link>
          ) : <span />}
        </div>
      )}

      {related.length > 0 && (
        <section className={styles.related} aria-label="Artículos relacionados">
          <h2 className={styles.relatedTitle}>Artículos relacionados</h2>
          <div className={styles.grid}>
            {related.map(p => <RelatedCard key={p.slug} post={p} />)}
          </div>
        </section>
      )}

      <section className={styles.detailCta}>
        <div className={styles.detailCtaCard}>
          <h2 className={styles.detailCtaTitle}>¿Listo para controlar tu negocio?</h2>
          <p className={styles.detailCtaSubtitle}>14 días gratis. Sin tarjeta de crédito.</p>
          <Link href="/registro" className={styles.detailCtaBtn}>Empezar gratis</Link>
        </div>
      </section>
    </div>
  )
}
