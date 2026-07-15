'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Upload, Download, FileDown, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import adminStyles from '../admin.module.css'
import styles from './calendar.module.css'

interface Tenant {
  id:   number
  name: string
}

interface CalendarEntry {
  id:             number
  business_id:    number
  business:       { id: number; name: string }
  dia:            string
  tipo:           string
  segmento:       string
  objetivo:       string
  titulo:         string
  subtitulo:      string | null
  caption:        string | null
  hashtags:       string | null
  estado:         string
  content_engine: string
  buffer_post_id: string | null
  notas:          string | null
}

interface EntryForm {
  dia:            string
  tipo:           string
  segmento:       string
  objetivo:       string
  titulo:         string
  subtitulo:      string
  caption:        string
  hashtags:       string
  estado:         string
  content_engine: string
  buffer_post_id: string
  notas:          string
}

interface ImportResult {
  created: number
  skipped: number
  errors:  { row: number; message: string }[]
}

const EMPTY_FORM: EntryForm = {
  dia: '', tipo: '', segmento: '', objetivo: '', titulo: '',
  subtitulo: '', caption: '', hashtags: '', estado: 'pendiente',
  content_engine: 'manual', buffer_post_id: '', notas: '',
}

const ESTADO_CLASS: Record<string, string> = {
  pendiente: adminStyles.badgeTrial,
  generado:  adminStyles.badgeActive,
  publicado: adminStyles.badgeInfo,
  error:     adminStyles.badgeDanger,
}

function formatDia(iso: string): string {
  return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CalendarTab() {
  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [businessId, setBusinessId] = useState<number | ''>('')
  const [entries, setEntries]       = useState<CalendarEntry[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm]           = useState<EntryForm>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/tenants')
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((body: { tenants: Tenant[] }) => setTenants(body.tenants ?? []))
      .catch(() => {})
  }, [])

  const loadEntries = useCallback(() => {
    setLoading(true)
    setError(null)
    const qs = businessId ? `?business_id=${businessId}` : ''
    fetch(`/api/admin/social/calendar${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((body: { entries: CalendarEntry[] }) => setEntries(body.entries ?? []))
      .catch(() => setError('No se pudo cargar el calendario.'))
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(loadEntries, [loadEntries])

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(entry: CalendarEntry) {
    setEditingId(entry.id)
    setForm({
      dia:            entry.dia.slice(0, 10),
      tipo:           entry.tipo,
      segmento:       entry.segmento,
      objetivo:       entry.objetivo,
      titulo:         entry.titulo,
      subtitulo:      entry.subtitulo ?? '',
      caption:        entry.caption ?? '',
      hashtags:       entry.hashtags ?? '',
      estado:         entry.estado,
      content_engine: entry.content_engine,
      buffer_post_id: entry.buffer_post_id ?? '',
      notas:          entry.notas ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!businessId) { setFormError('Selecciona un negocio primero.'); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        business_id:    Number(businessId),
        dia:            form.dia,
        tipo:           form.tipo.trim(),
        segmento:       form.segmento.trim(),
        objetivo:       form.objetivo.trim(),
        titulo:         form.titulo.trim(),
        subtitulo:      form.subtitulo.trim() || null,
        caption:        form.caption.trim() || null,
        hashtags:       form.hashtags.trim() || null,
        estado:         form.estado,
        content_engine: form.content_engine.trim(),
        buffer_post_id: form.buffer_post_id.trim() || null,
        notas:          form.notas.trim() || null,
      }
      const res = await fetch(
        editingId ? `/api/admin/social/calendar/${editingId}` : '/api/admin/social/calendar',
        {
          method:  editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }
      )
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'No se pudo guardar')
      setModalOpen(false)
      loadEntries()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entry: CalendarEntry) {
    if (!confirm(`¿Eliminar "${entry.titulo}"?`)) return
    try {
      const res = await fetch(`/api/admin/social/calendar/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      loadEntries()
    } catch {
      setError('No se pudo eliminar la entrada.')
    }
  }

  async function handleImport(file: File) {
    if (!businessId) return
    setImporting(true)
    setImportResult(null)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('business_id', String(businessId))
      const res = await fetch('/api/admin/social/calendar/import', { method: 'POST', body: fd })
      const body = await res.json() as { error?: string; created?: number; skipped?: number; errors?: ImportResult['errors'] }
      if (!res.ok) throw new Error(body.error ?? 'Falló la importación')
      setImportResult({ created: body.created ?? 0, skipped: body.skipped ?? 0, errors: body.errors ?? [] })
      loadEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falló la importación')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={styles.calendarTab}>
      <div className={adminStyles.tableWrap}>
        <div className={adminStyles.tableHeader}>
          <h2 className={adminStyles.tableTitle}>Calendario editorial</h2>

          <div className={adminStyles.filterBar}>
            <select
              className={adminStyles.planSelect}
              value={businessId}
              onChange={e => setBusinessId(e.target.value ? Number(e.target.value) : '')}
              aria-label="Filtrar por negocio"
            >
              <option value="">Todos los negocios</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <button type="button" className={styles.toolBtn} onClick={openNew} disabled={!businessId}>
              <Plus size={15} aria-hidden="true" /> Nuevo
            </button>

            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={!businessId || importing}
            >
              {importing
                ? <Loader2 size={15} className={styles.spin} aria-hidden="true" />
                : <Upload size={15} aria-hidden="true" />}
              Importar Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className={styles.hiddenInput}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) void handleImport(file)
                e.target.value = ''
              }}
            />

            {businessId ? (
              <a className={styles.toolBtn} href={`/api/admin/social/calendar/export?business_id=${businessId}`}>
                <Download size={15} aria-hidden="true" /> Exportar Excel
              </a>
            ) : (
              <button type="button" className={styles.toolBtn} disabled>
                <Download size={15} aria-hidden="true" /> Exportar Excel
              </button>
            )}

            {/* Sin gate de businessId: template/route.ts es genérico, no recibe
                ni valida business_id -- confirmado leyendo el endpoint real. */}
            <a className={styles.toolBtn} href="/api/admin/social/calendar/template">
              <FileDown size={15} aria-hidden="true" /> Descargar plantilla
            </a>
          </div>
        </div>

        {!businessId && (
          <p className={styles.hintBar}>Selecciona un negocio para crear, importar o exportar entradas.</p>
        )}

        {importResult && (
          <div className={styles.importResult}>
            <p>{importResult.created} creadas, {importResult.skipped} omitidas (ya existían).</p>
            {importResult.errors.length > 0 && (
              <ul>
                {importResult.errors.map((e, i) => <li key={i}>Fila {e.row}: {e.message}</li>)}
              </ul>
            )}
          </div>
        )}

        {loading ? (
          <p className={adminStyles.emptyState}>Cargando…</p>
        ) : error ? (
          <p className={adminStyles.emptyState}>{error}</p>
        ) : entries.length === 0 ? (
          <p className={adminStyles.emptyState}>
            {businessId
              ? 'Este negocio no tiene entradas en el calendario todavía.'
              : 'No hay entradas registradas. Selecciona un negocio para crear la primera.'}
          </p>
        ) : (
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>Día</th>
                <th>Negocio</th>
                <th>Tipo</th>
                <th>Segmento</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{formatDia(entry.dia)}</td>
                  <td>{entry.business.name}</td>
                  <td>{entry.tipo}</td>
                  <td>{entry.segmento}</td>
                  <td className={adminStyles.tdName}>{entry.titulo}</td>
                  <td>
                    <span className={`${adminStyles.badge} ${ESTADO_CLASS[entry.estado] ?? adminStyles.badgeInfo}`}>
                      {entry.estado}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={`${adminStyles.actionLink} ${adminStyles.actionBtn}`}
                        onClick={() => openEdit(entry)}
                        aria-label={`Editar "${entry.titulo}"`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${adminStyles.actionLink} ${adminStyles.actionBtn} ${adminStyles.actionDanger}`}
                        onClick={() => void handleDelete(entry)}
                        aria-label={`Eliminar "${entry.titulo}"`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar entrada' : 'Nueva entrada'}
        size="lg"
        footer={
          <>
            <button type="button" className={styles.btn} onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cal-dia">Día</label>
              <input
                id="cal-dia" type="date" className={styles.input}
                value={form.dia} onChange={e => setForm(f => ({ ...f, dia: e.target.value }))} required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cal-tipo">Tipo</label>
              <input
                id="cal-tipo" className={styles.input} placeholder="POST, CARRUSEL, STORY"
                value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cal-segmento">Segmento</label>
              <input
                id="cal-segmento" className={styles.input} placeholder="bodega, boutique..."
                value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))} required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cal-estado">Estado</label>
              <select
                id="cal-estado" className={styles.input}
                value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
              >
                <option value="pendiente">Pendiente</option>
                <option value="generado">Generado</option>
                <option value="publicado">Publicado</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cal-objetivo">Objetivo</label>
            <input
              id="cal-objetivo" className={styles.input} placeholder="Que prueben ActivoPOS gratis"
              value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cal-titulo">Título</label>
            <input
              id="cal-titulo" className={styles.input}
              value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cal-subtitulo">Subtítulo</label>
            <input
              id="cal-subtitulo" className={styles.input}
              value={form.subtitulo} onChange={e => setForm(f => ({ ...f, subtitulo: e.target.value }))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cal-caption">Caption</label>
            <textarea
              id="cal-caption" className={styles.textarea}
              value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cal-hashtags">Hashtags</label>
              <input
                id="cal-hashtags" className={styles.input} placeholder="#activopos #pos"
                value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cal-engine">Motor</label>
              <input
                id="cal-engine" className={styles.input} placeholder="manual"
                value={form.content_engine} onChange={e => setForm(f => ({ ...f, content_engine: e.target.value }))} required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cal-buffer">Buffer post ID</label>
            <input
              id="cal-buffer" className={styles.input}
              value={form.buffer_post_id} onChange={e => setForm(f => ({ ...f, buffer_post_id: e.target.value }))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="cal-notas">Notas</label>
            <textarea
              id="cal-notas" className={styles.textarea}
              value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            />
          </div>

          {formError && <p className={styles.error} role="alert">{formError}</p>}
        </div>
      </Modal>
    </div>
  )
}
