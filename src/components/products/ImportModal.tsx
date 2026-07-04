'use client'

import { useState, useRef, useCallback } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
import mStyles from './modals.module.css'
import styles from './ImportModal.module.css'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface RowError {
  row: number
  message: string
}

type ImportState = 'idle' | 'validating' | 'validated' | 'importing' | 'success' | 'error'

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  useScrollLock(isOpen)

  const [file, setFile]               = useState<File | null>(null)
  const [isDragging, setIsDragging]   = useState(false)
  const [importState, setImportState] = useState<ImportState>('idle')
  const [validCount, setValidCount]   = useState(0)
  const [rowErrors, setRowErrors]     = useState<RowError[]>([])
  const [errorMsg, setErrorMsg]       = useState('')
  const [progress, setProgress]       = useState(0)
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setIsDragging(false)
    setImportState('idle')
    setValidCount(0)
    setRowErrors([])
    setErrorMsg('')
    setProgress(0)
  }, [])

  const handleClose = useCallback(() => {
    if (importState === 'validating' || importState === 'importing') return
    reset()
    onClose()
  }, [importState, reset, onClose])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose()
  }

  const runDryRun = useCallback(async (f: File) => {
    setImportState('validating')
    setErrorMsg('')

    const fd = new FormData()
    fd.append('file', f)
    fd.append('dry_run', 'true')

    try {
      const res = await fetch('/api/products/import-excel', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({})) as {
        error?: string
        valid?: number
        errors?: RowError[]
      }

      if (!res.ok) {
        setErrorMsg(data.error ?? `Error ${res.status}`)
        setImportState('error')
        return
      }

      setValidCount(data.valid ?? 0)
      setRowErrors(data.errors ?? [])
      setImportState('validated')
    } catch {
      setErrorMsg('No se pudo conectar al servidor.')
      setImportState('error')
    }
  }, [])

  const acceptFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMsg('Solo se aceptan archivos Excel (.xlsx, .xls)')
      return
    }
    setFile(f)
    void runDryRun(f)
  }, [runDryRun])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) acceptFile(f)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }

  const handleImport = async () => {
    if (!file || importState !== 'validated' || validCount === 0) return
    setImportState('importing')
    setProgress(0)

    const fd = new FormData()
    fd.append('file', file)

    const ticker = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 18, 88))
    }, 200)

    try {
      const res = await fetch('/api/products/import-excel', { method: 'POST', body: fd })
      clearInterval(ticker)

      const data = await res.json().catch(() => ({})) as {
        error?: string
        created?: number
        errors?: RowError[]
      }

      if (!res.ok) {
        setErrorMsg(data.error ?? `Error ${res.status}`)
        setImportState('error')
        return
      }

      setProgress(100)
      setImportState('success')
      setTimeout(() => {
        onSuccess()
        reset()
        onClose()
      }, 1400)
    } catch {
      clearInterval(ticker)
      setErrorMsg('Error al importar. Intenta de nuevo.')
      setImportState('error')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={mStyles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onClick={handleOverlayClick}
          aria-modal="true"
          role="dialog"
          aria-label="Importar productos desde Excel"
        >
          <motion.div
            className={`${mStyles.modal} ${mStyles.modalLg}`}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={mStyles.modalHeader}>
              <div>
                <h2 className={mStyles.modalTitle}>Importar desde Excel</h2>
                <p className={mStyles.modalSubtitle}>Hasta 1000 productos por archivo</p>
              </div>
              <button
                className={mStyles.closeBtn}
                onClick={handleClose}
                aria-label="Cerrar"
                disabled={importState === 'validating' || importState === 'importing'}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className={mStyles.modalBody}>
              {/* Download template */}
              <a href="/api/products/import-excel/template" download className={styles.downloadBtn}>
                <Download size={16} aria-hidden="true" />
                Descargar plantilla .xlsx
              </a>

              {/* Drop zone — hidden during import/success */}
              {(importState === 'idle' || importState === 'error') && (
                <div
                  className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Seleccionar archivo Excel"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className={styles.fileInput}
                    onChange={handleFileChange}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <Upload size={28} className={styles.uploadIcon} aria-hidden="true" />
                  <p className={styles.dropText}>Arrastra tu archivo aquí</p>
                  <p className={styles.dropSub}>o haz clic para seleccionar — .xlsx, .xls</p>
                </div>
              )}

              {/* Validating spinner */}
              {importState === 'validating' && (
                <div className={styles.validatingRow}>
                  <Loader2 size={18} className={styles.spinIcon} aria-hidden="true" />
                  <span>Validando <strong>{file?.name}</strong>…</span>
                </div>
              )}

              {/* Validated — dry-run result */}
              {importState === 'validated' && (
                <div className={styles.dryRunSection}>
                  <div className={styles.fileSelectedRow}>
                    <FileSpreadsheet size={18} className={styles.fileIcon} aria-hidden="true" />
                    <span className={styles.fileName}>{file?.name}</span>
                    <button
                      type="button"
                      className={styles.changeFile}
                      onClick={() => { reset(); fileInputRef.current?.click() }}
                    >
                      Cambiar
                    </button>
                  </div>

                  {validCount > 0 && (
                    <div className={styles.dryRunValid}>
                      <CheckCircle size={15} aria-hidden="true" />
                      <span><strong>{validCount}</strong> {validCount === 1 ? 'producto válido' : 'productos válidos'}</span>
                    </div>
                  )}

                  {rowErrors.length > 0 && (
                    <div className={styles.dryRunErrors}>
                      <div className={styles.dryRunErrorsHeader}>
                        <AlertCircle size={14} aria-hidden="true" />
                        <span><strong>{rowErrors.length}</strong> {rowErrors.length === 1 ? 'fila con error' : 'filas con errores'} (se omitirán)</span>
                      </div>
                      <ul className={styles.errorList} aria-label="Errores de validación">
                        {rowErrors.slice(0, 8).map((e) => (
                          <li key={e.row} className={styles.errorRow}>
                            <span className={styles.errorRowNum}>Fila {e.row}</span>
                            <span className={styles.errorRowMsg}>{e.message}</span>
                          </li>
                        ))}
                        {rowErrors.length > 8 && (
                          <li className={styles.errorRowMore}>
                            +{rowErrors.length - 8} errores más…
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {validCount === 0 && (
                    <div className={styles.dryRunNoValid}>
                      No hay filas válidas para importar. Corrige el archivo e inténtalo de nuevo.
                    </div>
                  )}
                </div>
              )}

              {/* Import progress */}
              {importState === 'importing' && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressTrack}>
                    <motion.div
                      className={styles.progressFill}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                  <p className={styles.progressLabel}>Importando… {Math.round(progress)}%</p>
                </div>
              )}

              {/* Success */}
              {importState === 'success' && (
                <div className={styles.successBar}>
                  <CheckCircle size={16} aria-hidden="true" />
                  <span>Importación completada. Actualizando catálogo…</span>
                </div>
              )}

              {/* General error message */}
              {errorMsg && (
                <div className={styles.errorBar}>
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={mStyles.modalFooter}>
              <button
                type="button"
                className={mStyles.btnSecondary}
                onClick={handleClose}
                disabled={importState === 'validating' || importState === 'importing'}
              >
                Cerrar
              </button>
              <button
                type="button"
                className={mStyles.btnPrimary}
                onClick={handleImport}
                disabled={importState !== 'validated' || validCount === 0}
              >
                {importState === 'importing' && (
                  <span className={mStyles.spinner} aria-hidden="true" />
                )}
                {importState === 'importing'
                  ? 'Importando…'
                  : `Importar ${validCount > 0 ? validCount : ''} productos`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
