'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { BlogPostForm } from '../../BlogPostForm'
import type { BlogPost, BlogPostPayload } from '../../constants'
import adminStyles from '../../../admin.module.css'
import styles from '../../blog-admin.module.css'

type LoadState = 'loading' | 'error' | 'ready'

export default function EditBlogPostPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const id      = params.id

  const [post, setPost]             = useState<BlogPost | null>(null)
  const [loadState, setLoadState]   = useState<LoadState>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/blog/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((body: { ok: boolean; post: BlogPost }) => {
        setPost(body.post)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [id])

  async function handleSubmit(payload: BlogPostPayload) {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'No se pudo guardar el post.')
        return
      }
      router.push('/blog-admin')
    } catch {
      setError('Error de red al guardar el post.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!post) return
    if (!confirm(`¿Eliminar el post "${post.title}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/blog-admin')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <Link href="/blog-admin" className={adminStyles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Volver a Blog
      </Link>

      {loadState === 'loading' && <div className={adminStyles.emptyState}>Cargando...</div>}
      {loadState === 'error' && <div className={adminStyles.emptyState}>No se pudo cargar el post.</div>}

      {loadState === 'ready' && post && (
        <>
          <div className={adminStyles.detailHeaderRow}>
            <h1 className={adminStyles.pageTitle}>{post.title}</h1>
            <div className={adminStyles.detailActions}>
              {post.status === 'published' && (
                <a
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Ver post
                </a>
              )}
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>

          <BlogPostForm
            post={post}
            submitLabel="Guardar cambios"
            submitting={submitting}
            error={error}
            onSubmit={(payload) => void handleSubmit(payload)}
          />
        </>
      )}
    </div>
  )
}
