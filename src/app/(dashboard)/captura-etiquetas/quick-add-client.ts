import type { TitleSource } from '@/types/quick-add'

/** Ayudas del cliente de la pestaña "Alta rápida". */

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T
}

export async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init)
    const data = (await res.json().catch(() => ({}))) as T
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'Sin conexión con el servidor' } as T }
  }
}

export function errorOf(data: unknown, fallback: string): string {
  const msg = (data as { error?: unknown } | null)?.error
  return typeof msg === 'string' ? msg : fallback
}

export function jsonInit(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

/** Valores del formulario como los escribe la persona (todo texto hasta validar). */
export interface FormValues {
  title: string
  titleSource: TitleSource | null
  quantity: string
  categoryId: string
  subcategory: string
  price: string
  wholesale: string
}

export const EMPTY_VALUES: FormValues = {
  title: '',
  titleSource: null,
  quantity: '1',
  categoryId: '',
  subcategory: '',
  price: '',
  wholesale: '',
}

export const TITLE_SOURCE_LABEL: Record<TitleSource, string> = {
  label_captures: 'Capturas de etiquetas del negocio',
  open_products_facts: 'Open Products Facts',
  open_food_facts: 'Open Food Facts',
  upcitemdb: 'UPCitemdb',
  vision: 'Leído de la foto de la caja (revisar)',
}
