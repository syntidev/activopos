'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BlogPostForm } from '../BlogPostForm'
import type { BlogPostPayload } from '../constants'
import adminStyles from '../../admin.module.css'

export default function NewBlogPostPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(payload: BlogPostPayload) {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/blog', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'No se pudo crear el post.')
        return
      }
      router.push('/blog-admin')
    } catch {
      setError('Error de red al crear el post.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Link href="/blog-admin" className={adminStyles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Volver a Blog
      </Link>

      <div className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Nuevo post</h1>
      </div>

      <BlogPostForm
        submitLabel="Crear post"
        submitting={submitting}
        error={error}
        onSubmit={(payload) => void handleSubmit(payload)}
      />
    </div>
  )
}
