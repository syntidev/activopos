import type { DiningTableDTO, FloorElementDTO, SalonSnapshot, ServiceAreaDTO } from '@/types/restaurante'

/** Helpers de fetch para las pantallas del módulo Restaurante (cliente). */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function callApi<T>(url: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body:    body === undefined ? undefined : JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok) return { ok: false, error: json?.error ?? `Error ${res.status}` }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor' }
  }
}

/** Vuelve a leer todo el salón (áreas, mesas y mobiliario). */
export async function reloadSalon(): Promise<ApiResult<SalonSnapshot>> {
  const [areas, tables, elements] = await Promise.all([
    callApi<{ areas: ServiceAreaDTO[] }>('/api/restaurante/areas', 'GET'),
    callApi<{ tables: DiningTableDTO[] }>('/api/restaurante/mesas', 'GET'),
    callApi<{ elements: FloorElementDTO[] }>('/api/restaurante/elementos', 'GET'),
  ])
  if (!areas.ok) return areas
  if (!tables.ok) return tables
  if (!elements.ok) return elements
  return { ok: true, data: { areas: areas.data.areas, tables: tables.data.tables, elements: elements.data.elements } }
}
