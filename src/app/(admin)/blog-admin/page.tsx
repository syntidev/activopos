'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ImageOff, Sparkles, Plus } from 'lucide-react'
import { GenerateAiModal } from './GenerateAiModal'
import type { BlogPost } from './constants'
import adminStyles from '../admin.module.css'
import styles from './blog-admin.module.css'

type LoadState = 'loading' | 'error' | 'ready'

function statusBadge(status: BlogPost['status']) {
  const cls   = status === 'published' ? adminStyles.badgeActive : adminStyles.badgeTrial
  const label = status === 'published' ? 'Publicado' : 'Borrador'
  return <span className={`${adminStyles.badge} ${cls}`}>{label}</span>
}

export default function BlogAdminPage() {
  const [posts, setPosts]         = useState<BlogPost[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [aiOpen, setAiOpen]       = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadPosts = useCallback(() => {
    setLoadState('loading')
    fetch('/api/admin/blog')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((body: { ok: boolean; posts: BlogPost[] }) => {
        setPosts(body.posts ?? [])
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  async function handleDelete(post: BlogPost) {
    if (!confirm(`¿Eliminar el post "${post.title}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(post.id)
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' })
      if (res.ok) setPosts(prev => prev.filter(p => p.id !== post.id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Blog</h1>
        <p className={adminStyles.pageSubtitle}>
          {posts.length} post{posts.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className={adminStyles.tableWrap}>
        <div className={adminStyles.tableHeader}>
          <p className={adminStyles.tableTitle}>Todos los posts</p>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setAiOpen(true)}
            >
              <Sparkles size={14} aria-hidden="true" />
              Generar con IA
            </button>
            <Link href="/blog-admin/nuevo" className={`${styles.btn} ${styles.btnPrimary}`}>
              <Plus size={14} aria-hidden="true" />
              Nuevo Post
            </Link>
          </div>
        </div>

        {loadState === 'loading' && <div className={adminStyles.emptyState}>Cargando...</div>}
        {loadState === 'error' && <div className={adminStyles.emptyState}>No se pudo cargar la lista de posts.</div>}
        {loadState === 'ready' && posts.length === 0 && (
          <div className={adminStyles.emptyState}>Sin posts todavía. Crea uno o genera con IA.</div>
        )}

        {loadState === 'ready' && posts.length > 0 && (
          <table className={`${adminStyles.table} ${styles.table}`}>
            <thead>
              <tr>
                <th></th>
                <th>Título</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Vistas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id}>
                  <td>
                    {post.featured_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.featured_image} alt="" className={styles.thumb} />
                    ) : (
                      <div className={styles.thumbPlaceholder}>
                        <ImageOff size={16} aria-hidden="true" />
                      </div>
                    )}
                  </td>
                  <td className={adminStyles.tdName}>{post.title}</td>
                  <td>{post.category ?? '—'}</td>
                  <td>{statusBadge(post.status)}</td>
                  <td>{new Date(post.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{post.views}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link href={`/blog-admin/${post.id}/editar`} className={adminStyles.actionLink}>
                        Editar
                      </Link>
                      <button
                        type="button"
                        className={`${adminStyles.actionLink} ${adminStyles.actionBtn} ${adminStyles.actionDanger}`}
                        onClick={() => void handleDelete(post)}
                        disabled={deletingId === post.id}
                      >
                        {deletingId === post.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <GenerateAiModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onSaved={() => { setAiOpen(false); loadPosts() }}
      />
    </div>
  )
}
