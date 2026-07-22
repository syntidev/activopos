/**
 * Fuente única de categorías de blog + su color. Antes existían 2 listas
 * independientes que se desincronizaron: blog-admin/constants.ts (5 categorías
 * reales) y (marketing)/blog/types.ts (7 nombres inventados, sin relación real
 * con lo que el admin permite crear -- "Operaciones" ni tenía color asignado,
 * caía al azul por default; "Venezuela"/"Catálogo"/"Casos de éxito" no existen
 * como categoría real). Ambos lados importan de acá — no puede volver a driftear.
 *
 * Paleta: los 5 colores semánticos ya sellados en el proyecto (mismos que KPI
 * cards del dashboard y el wizard de /registro, ver design-system-rules.md) —
 * no una paleta nueva inventada para el blog.
 */

// 'Misceláneos' es el catch-all para temas que no encajan en las 5 técnicas. No
// tiene color propio: solo hay 5 colores semánticos sellados y no se inventan
// hex nuevos — categoryColor lo resuelve al azul por default como cualquier
// categoría sin color asignado.
export const BLOG_CATEGORIES = ['Inventario', 'Finanzas', 'Ventas', 'Operaciones', 'Tecnología POS', 'Misceláneos'] as const

export type BlogCategory = typeof BLOG_CATEGORIES[number]

// Solo las 5 técnicas tienen color sellado; 'Misceláneos' se excluye y cae al
// default en categoryColor.
export const CATEGORY_COLORS: Record<Exclude<BlogCategory, 'Misceláneos'>, string> = {
  Inventario:      '#16A34A', // verde  -- mismo verde de KPI "cobrado/ingresos"
  Finanzas:        '#D97706', // mostaza -- mismo naranja de KPI "crédito/pendiente"
  Ventas:          '#2563EB', // azul   -- mismo azul de KPI "tickets/órdenes"
  Operaciones:     '#9333EA', // violeta -- mismo violeta de KPI "utilidad"
  'Tecnología POS': '#DC2626', // rojo  -- 5to color sellado (KPI "utilidad negativa"), único disponible sin inventar hex nuevo
}

const DEFAULT_COLOR = CATEGORY_COLORS.Ventas

/** Color homologado por categoría. Categoría desconocida (dato viejo/manual) cae al azul de Ventas, nunca a un color al azar. */
export function categoryColor(category: string | null): string {
  if (!category) return DEFAULT_COLOR
  return (CATEGORY_COLORS as Record<string, string>)[category] ?? DEFAULT_COLOR
}
