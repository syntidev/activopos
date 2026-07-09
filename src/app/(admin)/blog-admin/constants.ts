export interface BlogPost {
  id:                number
  title:             string
  slug:              string
  excerpt:           string | null
  content:           string
  featured_image:    string | null
  category:          string | null
  tags:              string[] | null
  author:            string
  status:            'draft' | 'published'
  published_at:      string | null
  read_time:         string | null
  views:             number
  is_featured:       boolean
  meta_title:        string | null
  meta_description:  string | null
  created_at:        string
  updated_at:        string
}

export interface BlogPostPayload {
  title:             string
  slug?:             string
  excerpt:           string | null
  content:           string
  featured_image:    string | null
  category:          string | null
  tags:              string[] | null
  author?:           string
  status:            'draft' | 'published'
  published_at:      string | null
  is_featured:       boolean
  meta_title:        string | null
  meta_description:  string | null
  read_time?:        string | null
}

export const BLOG_CATEGORIES = ['Inventario', 'Finanzas', 'Ventas', 'Operaciones', 'Tecnología POS'] as const

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 250)
}
