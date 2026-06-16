'use client'

import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import mStyles from './modals.module.css'
import styles from './ImportModal.module.css'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ImportState = 'idle' | 'uploading' | 'success' | 'error'

const STEPS = [
  {
    num: 1,
    title: 'Descarga el formato',
    detail: 'Usa nuestra plantilla Excel para ingresar tus productos correctamente.',
  },
  {
    num: 2,
    title: 'Completa los datos',
    detail: 'Rellena: Nombre, Vendido Por, Costo Unitario y Stock Inicial.',
  },
  {
    num: 3,
    title: 'Importa el archivo',
    detail: 'Arrastra o selecciona el archivo. La migración se procesa en segundos.',
  },
]

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile]           = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importState, setImportState] = useState<ImportState>('idle')
  const [errorMsg, setErrorMsg]   = useState('')
  const [progress, setProgress]   = useState(0)
  const fileInputRef              = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setIsDragging(false)
    setImportState('idle')
    setErrorMsg('')
    setProgress(0)
  }, [])

  const handleClose = useCallback(() => {
    if (importState === 'uploading') return
    reset()
    onClose()
  }, [importState, reset, onClose])

  const acceptFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMsg('Solo se aceptan archivos Excel (.xlsx, .xls)')
      return
    }
    setErrorMsg('')
    setFile(f)
  }, [])

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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setImportState('uploading')
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    try {
      /* Simulated progress while upload is in flight */
      const ticker = setInterval(() => {
        setProgress((p) => Math.min(p + Math.random() * 15, 85))
      }, 200)

      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      })

      clearInterval(ticker)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Error ${res.status}`)
      }

      setProgress(100)
      setImportState('success')
      setTimeout(() => {
        onSuccess()
        reset()
        onClose()
      }, 1400)
    } catch (err) {
      setImportState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Error al importar. Intenta de nuevo.')
    }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose()
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
          aria-label="Migración masiva de productos"
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
                <h2 className={mStyles.modalTitle}>Migración Masiva</h2>
                <p className={mStyles.modalSubtitle}>Importa productos desde Excel</p>
              </div>
              <button
                className={mStyles.closeBtn}
                onClick={handleClose}
                aria-label="Cerrar"
                disabled={importState === 'uploading'}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className={mStyles.modalBody}>
              {/* Steps */}
              <div className={styles.steps}>
                {STEPS.map((step) => (
                  <div key={step.num} className={styles.step}>
                    <div className={styles.stepNum}>{step.num}</div>
                    <div className={styles.stepBody}>
                      <p className={styles.stepTitle}>{step.title}</p>
                      <p className={styles.stepDetail}>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Download template */}
              <a
                href="/plantilla-productos.xlsx"
                download
                className={styles.downloadBtn}
              >
                <Download size={16} aria-hidden="true" />
                Descargar Formato Excel
              </a>

              <div className={mStyles.divider} />

              {/* Drop zone */}
              <div
                className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''} ${file ? styles.dropZoneHasFile : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Seleccionar archivo Excel"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
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

                {file ? (
                  <div className={styles.fileInfo}>
                    <FileSpreadsheet size={32} className={styles.fileIcon} aria-hidden="true" />
                    <div className={styles.fileDetails}>
                      <p className={styles.fileName}>{file.name}</p>
                      <p className={styles.fileSize}>
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className={styles.uploadIcon} aria-hidden="true" />
                    <p className={styles.dropText}>
                      Arrastra tu archivo aquí
                    </p>
                    <p className={styles.dropSub}>
                      o haz clic para seleccionar — .xlsx, .xls
                    </p>
                  </>
                )}
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className={styles.errorBar}>
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Progress bar */}
              {importState === 'uploading' && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressTrack}>
                    <motion.div
                      className={styles.progressFill}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                  <p className={styles.progressLabel}>Procesando... {Math.round(progress)}%</p>
                </div>
              )}

              {/* Success state */}
              {importState === 'success' && (
                <div className={styles.successBar}>
                  <CheckCircle size={16} aria-hidden="true" />
                  <span>Importación completada. Actualizando catálogo...</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={mStyles.modalFooter}>
              <button
                type="button"
                className={mStyles.btnSecondary}
                onClick={handleClose}
                disabled={importState === 'uploading'}
              >
                Cerrar
              </button>
              <button
                type="button"
                className={mStyles.btnPrimary}
                onClick={handleImport}
                disabled={!file || importState !== 'idle'}
              >
                {importState === 'uploading' && (
                  <span className={mStyles.spinner} aria-hidden="true" />
                )}
                {importState === 'uploading' ? 'Importando...' : 'Iniciar Migración'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
