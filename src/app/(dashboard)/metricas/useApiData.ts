'use client'

import { useEffect, useState } from 'react'
import { apiError } from './format'

export interface ApiState<T> { data: T | null; loading: boolean; error: string | null }

/** GET real a `url` (null = no pedir). Cancela la petición anterior al cambiar la URL; `reloadKey` repite la actual. */
export function useApiData<T>(url: string | null, reloadKey = 0): ApiState<T> {
  // `url` viaja con el estado: si no coincide con la URL actual (render previo al efecto), esos datos son de otro filtro y no se muestran.
  const [state, setState] = useState<ApiState<T> & { url: string | null }>({ data: null, loading: url !== null, error: null, url })

  useEffect(() => {
    if (url === null) { setState({ data: null, loading: false, error: null, url }); return }
    const ctrl = new AbortController()
    setState({ data: null, loading: true, error: null, url })
    fetch(url, { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) throw new Error(await apiError(res))
        return res.json() as Promise<T>
      })
      .then(data => { if (!ctrl.signal.aborted) setState({ data, loading: false, error: null, url }) })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'No se pudo cargar.', url })
      })
    return () => ctrl.abort()
  }, [url, reloadKey])

  if (state.url !== url) return { data: null, loading: url !== null, error: null }
  return { data: state.data, loading: state.loading, error: state.error }
}
