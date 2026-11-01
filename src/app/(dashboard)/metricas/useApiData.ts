'use client'

import { useEffect, useState } from 'react'
import { apiError } from './format'

export interface ApiState<T> { data: T | null; loading: boolean; error: string | null }

/** GET real a `url` (null = no pedir). Cancela la petición anterior al cambiar la URL; `reloadKey` repite la actual. */
export function useApiData<T>(url: string | null, reloadKey = 0): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: url !== null, error: null })

  useEffect(() => {
    if (url === null) return
    const ctrl = new AbortController()
    setState(s => ({ ...s, loading: true, error: null }))
    fetch(url, { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) throw new Error(await apiError(res))
        return res.json() as Promise<T>
      })
      .then(data => setState({ data, loading: false, error: null }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'No se pudo cargar.' })
      })
    return () => ctrl.abort()
  }, [url, reloadKey])

  return state
}
