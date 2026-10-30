'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { SYNONYM_MAX_CHARS, SYNONYM_MAX_GROUPS, SYNONYM_MAX_TERMS, synonymsInputSchema } from '@/lib/search-synonyms'
import cfg from '../configuracion.module.css'
import styles from './SearchSynonyms.module.css'

const splitTerms = (raw: string): string[] => raw.split(',').map(t => t.trim()).filter(Boolean)

/** Sección "Sinónimos de búsqueda" (Tema Visual): grupos de palabras equivalentes para el buscador del catálogo. */
export function SearchSynonyms() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<string[][]>([])
  const [drafts, setDrafts] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/config/catalog')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { catalog?: { search_synonyms?: string[][] } } | null) => {
        if (!active) return
        if (!d?.catalog) { setLoadFailed(true); return }
        const g = d?.catalog?.search_synonyms ?? []
        setGroups(g)
        setDrafts(g.map(() => ''))
        setLoaded(true)
      })
      .catch(() => { if (active) setLoadFailed(true) })
    return () => { active = false }
  }, [])

  const addGroup = () => {
    if (groups.length >= SYNONYM_MAX_GROUPS) { setError(`Máximo ${SYNONYM_MAX_GROUPS} grupos`); return }
    setGroups(g => [...g, []])
    setDrafts(d => [...d, ''])
    setError('')
  }
  const removeGroup = (i: number) => {
    setGroups(g => g.filter((_, k) => k !== i))
    setDrafts(d => d.filter((_, k) => k !== i))
    setError('')
  }
  const setDraft = (i: number, v: string) => setDrafts(d => d.map((x, k) => (k === i ? v : x)))
  const addTerms = (i: number) => {
    const raw = splitTerms(drafts[i] ?? '')
    if (raw.length === 0) return
    if (raw.some(t => t.length > SYNONYM_MAX_CHARS)) { setError(`Cada término admite máximo ${SYNONYM_MAX_CHARS} caracteres`); return }
    if (groups[i].length + raw.length > SYNONYM_MAX_TERMS) { setError(`Cada grupo admite máximo ${SYNONYM_MAX_TERMS} términos`); return }
    setGroups(g => g.map((x, k) => (k === i ? [...x, ...raw] : x)))
    setDraft(i, '')
    setError('')
  }
  const removeTerm = (i: number, j: number) => setGroups(g => g.map((x, k) => (k === i ? x.filter((_, m) => m !== j) : x)))

  const save = async () => {
    // Un término escrito y no confirmado con Enter también cuenta.
    // Los grupos que quedaron vacíos ("Agregar grupo" sin llenar) se descartan en vez de bloquear el guardado.
    const pending = groups.map((g, i) => [...g, ...splitTerms(drafts[i] ?? '')]).filter(g => g.length > 0)
    const parsed = synonymsInputSchema.safeParse(pending)
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Datos inválidos'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/config/catalog', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ search_synonyms: parsed.data }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { issues?: { message: string }[]; error?: string } | null
        throw new Error(j?.issues?.[0]?.message ?? j?.error ?? 'No se pudo guardar.')
      }
      setGroups(parsed.data)
      setDrafts(parsed.data.map(() => ''))
      toast('Sinónimos de búsqueda guardados.', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cfg.formCard} data-testid="sinonimos">
      <h3 className={cfg.formCardTitle}>Sinónimos de búsqueda</h3>
      <p className={cfg.colorDesc}>
        Grupos de palabras que significan lo mismo. Si un cliente busca «maillot» y tienes un grupo con «camisa»,
        encuentra los productos que digan «camisa». Los términos pueden ser frases.
      </p>

      {loadFailed && <p className={styles.error} role="alert">No se pudieron cargar los sinónimos. Recarga la página para editarlos.</p>}
      {loaded && groups.length === 0 && <p className={cfg.logoDropHint}>Aún no tienes grupos.</p>}

      <ul className={styles.list}>
        {groups.map((g, i) => (
          <li key={i} className={styles.group}>
            <div className={styles.chips}>
              {g.map((t, j) => (
                <span key={`${t}-${j}`} className={styles.chip}>
                  {t}
                  <button type="button" className={styles.chipX} onClick={() => removeTerm(i, j)} aria-label={`Quitar ${t}`}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className={styles.addRow}>
              <input
                className={styles.input}
                value={drafts[i] ?? ''}
                maxLength={SYNONYM_MAX_CHARS * 3}
                placeholder="Escribe un término y pulsa Enter"
                aria-label={`Término del grupo ${i + 1}`}
                onChange={e => setDraft(i, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTerms(i) } }}
              />
              <button type="button" className={styles.iconBtn} onClick={() => addTerms(i)} aria-label={`Agregar término al grupo ${i + 1}`}>
                <Plus size={16} aria-hidden="true" />
              </button>
              <button type="button" className={styles.removeGroup} onClick={() => removeGroup(i)} aria-label={`Quitar grupo ${i + 1}`}>
                Quitar grupo
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={addGroup} disabled={!loaded}>Agregar grupo</Button>
        <Button variant="primary" onClick={save} loading={saving} disabled={!loaded}>Guardar sinónimos</Button>
      </div>
    </div>
  )
}
