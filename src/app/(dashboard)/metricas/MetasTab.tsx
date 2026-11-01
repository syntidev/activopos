'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { businessMonthKey } from '@/lib/business-day'
import type { GoalMetric, GoalScope, SalesGoalItem } from '@/types/metrics'
import { useRate } from '@/context/RateContext'
import { apiError, fmtBs, fmtQty, fmtUsd } from './format'
import { barStyle } from './GruposTab'
import { useApiData } from './useApiData'
import { ViewState } from './ViewState'
import styles from './metricas.module.css'

const SCOPE_LABEL: Record<GoalScope, string> = { product: 'Producto', category: 'Categoría', brand: 'Marca' }
const METRIC_LABEL: Record<GoalMetric, string> = { units: 'Unidades', usd: 'Dólares ($)' }
const REF_SEARCH_MIN = 2
const REF_SEARCH_DEBOUNCE_MS = 300
const REF_LIST_MAX = 8

/** Unidades tal cual; dólares SIEMPRE con su equivalente en Bs a la tasa del día (sin tasa: "Bs. —", nunca se bloquea). */
const fmtGoal = (metric: GoalMetric, n: number, rate: number | null): string =>
  metric === 'usd' ? `${fmtUsd(n)} · ${rate ? fmtBs(n * rate) : 'Bs. —'}` : fmtQty(n)

type GoalStatus = 'cumplida' | 'camino' | 'atrasada' | 'cerrada'
const STATUS_LABEL: Record<GoalStatus, string> = { cumplida: 'Cumplida', camino: 'En camino', atrasada: 'Atrasada', cerrada: 'Mes cerrado' }

function daysInMonth(period: string): number {
  const [y, m] = period.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Cumplida > mes cerrado > en camino / atrasada (según lo que ya debería llevar del mes, contando hoy). */
export function goalStatus(g: SalesGoalItem): GoalStatus {
  if (g.pct >= 100) return 'cumplida'
  const total = daysInMonth(g.period)
  if (g.days_left === 0) return 'cerrada'
  const elapsed = g.days_left >= total ? 0 : total - g.days_left + 1
  return g.pct >= (elapsed / total) * 100 ? 'camino' : 'atrasada'
}

function goalLine(g: SalesGoalItem, status: GoalStatus, rate: number | null): string {
  const f = (n: number): string => fmtGoal(g.metric, n, rate)
  if (status === 'cumplida') return `¡Cumpliste la meta! Llevas ${f(g.actual)} de ${f(g.target)}.`
  if (status === 'cerrada') return `El mes cerró: vendiste ${f(g.actual)} de ${f(g.target)} y te faltaron ${f(g.remaining)}.`
  const perDay = g.per_day_needed === null ? '' : `: ${f(g.per_day_needed)} por día`
  return `Te faltan ${f(g.remaining)}${perDay}`
}

interface RefOption { id: number; name: string }
interface GoalModalProps { goal: SalesGoalItem | null; defaultPeriod: string; onClose: () => void; onSaved: () => void }

function GoalModal({ goal, defaultPeriod, onClose, onSaved }: GoalModalProps) {
  const { toast } = useToast()
  const { rate } = useRate()
  const editing = goal !== null
  const [scope, setScope] = useState<GoalScope>(goal?.scope ?? 'product')
  const [ref, setRef] = useState<RefOption | null>(goal ? { id: goal.ref_id, name: goal.label } : null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [period, setPeriod] = useState(goal?.period ?? defaultPeriod)
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'units')
  const [target, setTarget] = useState(goal ? String(goal.target) : '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), REF_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  const refUrl = editing || ref !== null ? null
    : scope === 'product' ? (debounced.length >= REF_SEARCH_MIN ? `/api/products?search=${encodeURIComponent(debounced)}` : null)
    : scope === 'category' ? '/api/categories' : '/api/brands'
  const refs = useApiData<{ products?: RefOption[]; categories?: RefOption[]; brands?: RefOption[] }>(refUrl)
  const all = refs.data?.products ?? refs.data?.categories ?? refs.data?.brands ?? []
  const needle = search.trim().toLowerCase()
  const options = (scope === 'product' ? all : all.filter(o => o.name.toLowerCase().includes(needle))).slice(0, REF_LIST_MAX)

  const changeScope = (s: GoalScope): void => { setScope(s); setRef(null); setSearch(''); setDebounced('') }

  const save = async (): Promise<void> => {
    const n = Number(target)
    if (!editing && !ref) { setFormError('Elige a qué se le pone la meta.'); return }
    if (!Number.isFinite(n) || n <= 0) { setFormError('El objetivo debe ser mayor que cero.'); return }
    setSaving(true)
    setFormError('')
    try {
      const res = editing
        ? await fetch(`/api/metrics/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: n }) })
        : await fetch('/api/metrics/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, ref_id: ref?.id, period, metric, target: n }) })
      if (!res.ok) {
        setFormError(res.status === 409 ? 'Ya tienes una meta igual para ese mes. Edítala en vez de crear otra.' : await apiError(res))
        return
      }
      toast(editing ? 'Meta actualizada.' : 'Meta creada.', 'success')
      onSaved()
    } catch {
      setFormError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar meta' : 'Nueva meta'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={saving}>{editing ? 'Guardar cambios' : 'Crear meta'}</Button>
        </>
      }
    >
      <div className={styles.form} data-testid="metricas-modal-meta">
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Aplica a</span>
          <select className={styles.control} value={scope} disabled={editing} onChange={e => changeScope(e.target.value as GoalScope)} aria-label="Alcance de la meta">
            {(Object.keys(SCOPE_LABEL) as GoalScope[]).map(s => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
          </select>
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{SCOPE_LABEL[scope]}</span>
          {ref ? (
            <div className={styles.picked}>
              <span>{ref.name}</span>
              {!editing && <button type="button" className={styles.linkBtn} onClick={() => { setRef(null); setSearch('') }}>Cambiar</button>}
            </div>
          ) : (
            <>
              <input
                className={styles.control}
                value={search}
                maxLength={60}
                placeholder={scope === 'product' ? 'Escribe al menos 2 letras del producto' : `Busca la ${SCOPE_LABEL[scope].toLowerCase()}`}
                aria-label={`Buscar ${SCOPE_LABEL[scope].toLowerCase()}`}
                onChange={e => setSearch(e.target.value)}
              />
              {refs.error && <p className={styles.formError} role="alert">{refs.error}</p>}
              {refs.loading && <p className={styles.hint}>Buscando…</p>}
              {!refs.loading && !refs.error && refUrl !== null && options.length === 0 && <p className={styles.hint}>No encontramos nada con ese nombre.</p>}
              {options.length > 0 && (
                <ul className={styles.options} aria-label="Resultados">
                  {options.map(o => (
                    <li key={o.id}><button type="button" className={styles.option} onClick={() => setRef(o)}>{o.name}</button></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className={styles.formRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Mes</span>
            <input type="month" className={styles.control} value={period} disabled={editing} onChange={e => setPeriod(e.target.value)} aria-label="Mes de la meta" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Medida</span>
            <select className={styles.control} value={metric} disabled={editing} onChange={e => setMetric(e.target.value as GoalMetric)} aria-label="Medida de la meta">
              {(Object.keys(METRIC_LABEL) as GoalMetric[]).map(m => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
            </select>
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Objetivo {metric === 'usd' ? '(en $)' : '(en unidades)'}</span>
          <input type="number" inputMode="decimal" min="0" step="any" className={styles.control} value={target} onChange={e => setTarget(e.target.value)} aria-label="Objetivo de la meta" />
          {metric === 'usd' && Number(target) > 0 && <span className={styles.hint}>{fmtGoal('usd', Number(target), rate)}</span>}
        </label>

        {formError && <p className={styles.formError} role="alert">{formError}</p>}
      </div>
    </Modal>
  )
}

export function MetasTab() {
  const { toast } = useToast()
  const { rate } = useRate()
  const nowPeriod = businessMonthKey()
  const [period, setPeriod] = useState(nowPeriod)
  const [reload, setReload] = useState(0)
  const [modal, setModal] = useState<{ goal: SalesGoalItem | null } | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { data, loading, error } = useApiData<SalesGoalItem[]>(`/api/metrics/goals?period=${period}`, reload)
  const goals = data ?? []

  const remove = async (id: number): Promise<void> => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/metrics/goals/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await apiError(res))
      toast('Meta eliminada.', 'success')
      setConfirmId(null)
      setReload(n => n + 1)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar la meta.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={styles.card} aria-label="Metas del mes">
      <div className={styles.cardTools}>
        <label className={styles.inlineField}>
          <span className={styles.fieldLabel}>Mes</span>
          <input type="month" className={styles.control} value={period} onChange={e => e.target.value && setPeriod(e.target.value)} aria-label="Mes de las metas" />
        </label>
        <Button variant="primary" size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setModal({ goal: null })}>Nueva meta</Button>
      </div>

      <ViewState
        loading={loading}
        error={error}
        empty={goals.length === 0}
        emptyTitle="Todavía no tienes metas este mes"
        emptyHint='Ponte una meta, por ejemplo "400 hamburguesas", y aquí verás cuánto te falta y cuánto tienes que vender por día.'
        onRetry={() => setReload(n => n + 1)}
      >
        <ul className={styles.goals} data-testid="metricas-metas">
          {goals.map(g => {
            const status = goalStatus(g)
            return (
              <li key={g.id} className={`${styles.goal} ${styles[`goal_${status}`]}`} data-testid="metricas-meta">
                <div className={styles.goalHead}>
                  <Target size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.goalName}>{g.label}</span>
                  <span className={styles.goalBadge}>{STATUS_LABEL[status]}</span>
                </div>
                <p className={styles.goalNumbers}>
                  <strong>{fmtGoal(g.metric, g.actual, rate)}</strong> de {fmtGoal(g.metric, g.target, rate)} ({g.pct.toLocaleString('es-VE')}%)
                </p>
                <span className={styles.barTrack}><span className={styles.goalFill} style={barStyle(g.pct)} /></span>
                <p className={styles.goalLine}>{goalLine(g, status, rate)}</p>
                {confirmId === g.id ? (
                  <div className={styles.confirm} role="alert">
                    <span>¿Eliminar la meta de {g.label}?</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>Cancelar</Button>
                    <Button variant="danger" size="sm" loading={deletingId === g.id} onClick={() => remove(g.id)}>Sí, eliminar</Button>
                  </div>
                ) : (
                  <div className={styles.goalActions}>
                    <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} aria-hidden="true" />} onClick={() => setModal({ goal: g })} aria-label={`Editar meta de ${g.label}`}>Editar</Button>
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} aria-hidden="true" />} onClick={() => setConfirmId(g.id)} aria-label={`Eliminar meta de ${g.label}`}>Eliminar</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </ViewState>

      {modal && (
        <GoalModal
          goal={modal.goal}
          defaultPeriod={period}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setReload(n => n + 1) }}
        />
      )}
    </section>
  )
}
