// Contrato asumido de los endpoints de CLI-A (GET /api/blog, GET /api/blog/[slug]).
// No hay modelo Prisma ni endpoint todavía al momento de este commit — esta forma
// se declara explícitamente para que CLI-A la confirme/ajuste al entregar el backend.

export interface BlogPostSummary {
  slug:               string
  title:              string
  excerpt:            string
  cover_image:        string | null
  category:           string
  category_color:     string | null
  author_name:        string
  published_at:       string // ISO date
  read_time_minutes:  number
  is_featured:        boolean
}

export interface BlogPostFull extends BlogPostSummary {
  content_html: string
  tags:         string[]
}

export interface BlogListResponse {
  posts: BlogPostSummary[]
  total: number
  page:  number
  limit: number
}

export const BLOG_CATEGORIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'ventas',       label: 'Ventas',           color: '#0038BD' },
  { key: 'inventario',   label: 'Inventario',       color: '#16A34A' },
  { key: 'venezuela',    label: 'Venezuela',        color: '#D97706' },
  { key: 'tecnologia',   label: 'Tecnología',       color: '#7C3AED' },
  { key: 'catalogo',     label: 'Catálogo',         color: '#0891B2' },
  { key: 'casos-exito',  label: 'Casos de éxito',   color: '#EC4899' },
]

export function categoryColor(category: string | null): string {
  if (!category) return '#0038BD'
  const found = BLOG_CATEGORIES.find(c => c.label === category || c.key === category)
  return found?.color ?? '#0038BD'
}

// Server Components no pueden usar fetch('/ruta-relativa') — arma la URL absoluta
// desde NEXT_PUBLIC_APP_URL (ya usado en .env.example para la URL pública de la
// app). Nunca se deriva del header Host de la request: es spoofeable por el
// cliente y permitiría SSRF (el server haría fetch a un origen atacante-controlado).
function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function fetchBlogList(params: { page?: number; category?: string; limit?: number }): Promise<BlogListResponse | null> {
  const qs = new URLSearchParams()
  qs.set('page', String(params.page ?? 1))
  qs.set('limit', String(params.limit ?? 9))
  if (params.category) qs.set('category', params.category)
  try {
    const res = await fetch(`${baseUrl()}/api/blog?${qs.toString()}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return await res.json() as BlogListResponse
  } catch {
    return null
  }
}

export async function fetchBlogPost(slug: string): Promise<BlogPostFull | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/blog/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const j = await res.json() as Record<string, unknown>
    return (j.post as BlogPostFull | undefined) ?? (j as unknown as BlogPostFull) ?? null
  } catch {
    return null
  }
}
