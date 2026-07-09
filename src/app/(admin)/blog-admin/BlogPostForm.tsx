'use client'

import { useState, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { X } from 'lucide-react'
import { RichTextEditor } from '@/components/admin/RichTextEditor'
import { BLOG_CATEGORIES, slugify, type BlogPost, type BlogPostPayload } from './constants'
import styles from './blog-admin.module.css'

export interface BlogPostFormValues {
  title:             string
  slug:              string
  excerpt:           string
  content:           string
  featured_image:    string
  category:          string
  tags:              string[]
  author:            string
  status:            'draft' | 'published'
  publishedAtDate:   string
  read_time:         string
  is_featured:       boolean
  meta_title:        string
  meta_description:  string
}

function toFormValues(post?: BlogPost): BlogPostFormValues {
  return {
    title:            post?.title ?? '',
    slug:             post?.slug ?? '',
    excerpt:          post?.excerpt ?? '',
    content:          post?.content ?? '',
    featured_image:   post?.featured_image ?? '',
    category:         post?.category ?? BLOG_CATEGORIES[0],
    tags:             post?.tags ?? [],
    author:           post?.author ?? '',
    status:           post?.status ?? 'draft',
    publishedAtDate:  post?.published_at ? post.published_at.slice(0, 10) : '',
    read_time:        post?.read_time ?? '',
    is_featured:      post?.is_featured ?? false,
    meta_title:       post?.meta_title ?? '',
    meta_description: post?.meta_description ?? '',
  }
}

export function valuesToPayload(v: BlogPostFormValues): BlogPostPayload {
  return {
    title:             v.title.trim(),
    slug:              v.slug.trim() ? slugify(v.slug) : undefined,
    excerpt:           v.excerpt.trim() || null,
    content:           v.content,
    featured_image:    v.featured_image.trim() || null,
    category:          v.category || null,
    tags:              v.tags.length ? v.tags : null,
    author:            v.author.trim() || undefined,
    status:            v.status,
    published_at:      v.publishedAtDate ? new Date(v.publishedAtDate).toISOString() : null,
    is_featured:       v.is_featured,
    meta_title:        v.meta_title.trim() || null,
    meta_description:  v.meta_description.trim() || null,
    read_time:         v.read_time.trim() || null,
  }
}

interface BlogPostFormProps {
  post?:        BlogPost
  submitLabel:  string
  submitting:   boolean
  error?:       string | null
  onSubmit:     (payload: BlogPostPayload) => void
}

export function BlogPostForm({ post, submitLabel, submitting, error, onSubmit }: BlogPostFormProps) {
  const [values, setValues]           = useState<BlogPostFormValues>(() => toFormValues(post))
  const [slugTouched, setSlugTouched] = useState(!!post?.slug)
  const [tagInput, setTagInput]       = useState('')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof BlogPostFormValues>(key: K, value: BlogPostFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res  = await fetch('/api/admin/blog/upload-image', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) {
        setUploadError(body.error ?? 'No se pudo subir la imagen.')
        return
      }
      set('featured_image', body.url)
    } catch {
      setUploadError('Error de red al subir la imagen.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function handleTitleChange(title: string) {
    set('title', title)
    if (!slugTouched) set('slug', slugify(title))
  }

  function handleSlugChange(slug: string) {
    setSlugTouched(true)
    set('slug', slug)
  }

  function addTag() {
    const tag = tagInput.trim()
    if (!tag || values.tags.includes(tag)) { setTagInput(''); return }
    set('tags', [...values.tags, tag])
    setTagInput('')
  }

  function removeTag(tag: string) {
    set('tags', values.tags.filter(t => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(valuesToPayload(values))
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="title">Título *</label>
        <input
          id="title"
          className={styles.input}
          value={values.title}
          onChange={e => handleTitleChange(e.target.value)}
          required
          maxLength={255}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="slug">Slug</label>
        <input
          id="slug"
          className={styles.input}
          value={values.slug}
          onChange={e => handleSlugChange(e.target.value)}
          placeholder={slugify(values.title) || 'se-genera-del-titulo'}
          maxLength={255}
        />
        <p className={styles.hint}>Se genera del título si se deja vacío.</p>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="excerpt">Excerpt</label>
        <textarea
          id="excerpt"
          className={styles.textarea}
          value={values.excerpt}
          onChange={e => set('excerpt', e.target.value)}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="content">Contenido *</label>
        <RichTextEditor value={values.content} onChange={html => set('content', html)} />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="featured_image_upload">Imagen destacada</label>
        {values.featured_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={values.featured_image} alt="" className={styles.imagePreview} />
        )}
        <div className={styles.imageUploadRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Subiendo...' : 'Subir imagen'}
          </button>
          <input
            id="featured_image_upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenFileInput}
            onChange={e => void handleImageUpload(e)}
          />
        </div>
        {uploadError && <p className={styles.errorText}>{uploadError}</p>}
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="category">Categoría</label>
          <select
            id="category"
            className={styles.select}
            value={values.category}
            onChange={e => set('category', e.target.value)}
          >
            {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="author">Autor</label>
          <input
            id="author"
            className={styles.input}
            value={values.author}
            onChange={e => set('author', e.target.value)}
            placeholder="Equipo ActivoPOS"
            maxLength={100}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="tags">Tags</label>
        <div className={styles.chipsInput} id="tags">
          {values.tags.map(tag => (
            <span key={tag} className={styles.chip}>
              {tag}
              <button type="button" className={styles.chipRemove} onClick={() => removeTag(tag)} aria-label={`Quitar tag ${tag}`}>
                <X size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            className={styles.chipsInputField}
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={addTag}
            placeholder={values.tags.length ? '' : 'Enter para agregar'}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="read_time">Tiempo de lectura</label>
          <input
            id="read_time"
            className={styles.input}
            value={values.read_time}
            onChange={e => set('read_time', e.target.value)}
            placeholder="5 min"
            maxLength={20}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="publishedAtDate">Fecha de publicación</label>
          <input
            id="publishedAtDate"
            type="date"
            className={styles.input}
            value={values.publishedAtDate}
            onChange={e => set('publishedAtDate', e.target.value)}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="status">Estado</label>
          <select
            id="status"
            className={styles.select}
            value={values.status}
            onChange={e => set('status', e.target.value as 'draft' | 'published')}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <span className={styles.label}>Destacado</span>
          <div className={styles.checkboxRow}>
            <input
              id="is_featured"
              type="checkbox"
              className={styles.checkbox}
              checked={values.is_featured}
              onChange={e => set('is_featured', e.target.checked)}
            />
            <label className={styles.checkboxLabel} htmlFor="is_featured">Mostrar como destacado</label>
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="meta_title">Meta título (SEO)</label>
        <input
          id="meta_title"
          className={styles.input}
          value={values.meta_title}
          onChange={e => set('meta_title', e.target.value)}
          maxLength={255}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="meta_description">Meta descripción (SEO)</label>
        <textarea
          id="meta_description"
          className={styles.textarea}
          value={values.meta_description}
          onChange={e => set('meta_description', e.target.value)}
          maxLength={255}
        />
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.formActions}>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={submitting}>
          {submitting ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
