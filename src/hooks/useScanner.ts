'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Html5Qrcode } from 'html5-qrcode'

interface UseScannerOptions {
  /** Whether the scanner should be running. Flip to true to start, false to stop. */
  active: boolean
  /** Called once per unique barcode detected. Debounced to avoid duplicates. */
  onResult: (barcode: string) => void
  /** Called if camera permission is denied or device has no camera. */
  onError?: (reason: 'permission_denied' | 'camera_unavailable') => void
  /** Debounce window in ms — same barcode ignored within this interval. Default 1500. */
  debounceMs?: number
}

interface UseScannerReturn {
  /** Attach to a <div> element — html5-qrcode renders video/canvas inside it. */
  videoContainerRef: React.RefObject<HTMLDivElement>
  /** True when the camera could not be started. */
  permError: boolean
  /** True while the camera engine is running. */
  isScanning: boolean
  /** Human-readable error from the last failed start/scanFile call. */
  error: string | null
  /** Imperative start — used by UIs that gate the camera behind a button tap. */
  startScanner: () => void
  /** Imperative stop — safe to call even if not running. */
  stopScanner: () => void
  /** Capa 3 fallback: decode a barcode from a photo file (e.g. camera capture input). */
  scanFile: (file: File) => Promise<void>
}

// focusMode no está en el tipo MediaTrackConstraints de TS (propiedad no
// estándar, soportada por Chrome/Android) — se extiende localmente en vez
// de usar `any`.
interface CameraConstraints extends MediaTrackConstraints {
  focusMode?: 'continuous' | 'manual' | 'single-shot'
}

// Sin width/height/frameRate/aspectRatio — el dispositivo elige su mejor
// resolución nativa. focusMode:'continuous' mantiene el enfoque activo
// durante el video (crítico en Samsung S24+, que si no queda desenfocado).
const CAMERA_CONFIG: CameraConstraints = {
  facingMode: 'environment',
  focusMode:  'continuous',
}

const HTML5_QR_CONFIG = {
  fps: 30,
  qrbox: { width: 300, height: 200 },
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
}

/**
 * Shared scanner hook — arquitectura en capas:
 *   Capa 1+2: html5-qrcode, que usa BarcodeDetector nativo cuando el
 *             dispositivo lo soporta (experimentalFeatures.useBarCodeDetectorIfSupported)
 *             y cae a su propio decoder JS si no.
 *   Capa 3:   scanFile() — decodifica una foto tomada como fallback final.
 * Capa 0 (input manual) vive en el componente consumidor, no aquí.
 * Dynamic import de html5-qrcode: SSR-safe, accede a APIs de browser al cargar.
 */
export function useScanner({
  active,
  onResult,
  onError,
  debounceMs = 1500,
}: UseScannerOptions): UseScannerReturn {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [permError, setPermError]   = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const rawId       = useId()
  const containerId = `scanner-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  const scannerRef  = useRef<Html5Qrcode | null>(null)
  const runningRef  = useRef(false)
  const lastCodeRef = useRef('')
  const lastTsRef   = useRef(0)

  const onResultRef = useRef(onResult)
  const onErrorRef  = useRef(onError)
  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const emit = useCallback((code: string) => {
    const now = Date.now()
    if (code === lastCodeRef.current && now - lastTsRef.current < debounceMs) return
    lastCodeRef.current = code
    lastTsRef.current   = now
    onResultRef.current(code)
  }, [debounceMs])

  const stopScanner = useCallback(() => {
    runningRef.current = false
    setIsScanning(false)
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    scanner.stop()
      .catch(() => { /* ya detenido */ })
      .finally(() => { try { scanner.clear() } catch { /* no-op */ } })
  }, [])

  const startScanner = useCallback(() => {
    const container = videoContainerRef.current
    if (!container || runningRef.current) return
    runningRef.current = true
    setError(null)
    setPermError(false)
    setIsScanning(true)

    void (async () => {
      try {
        if (!container.id) container.id = containerId
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(container.id)
        scannerRef.current = scanner
        await scanner.start(
          CAMERA_CONFIG,
          HTML5_QR_CONFIG,
          (decodedText) => emit(decodedText),
          () => { /* frame sin código — silencioso */ }
        )
      } catch (err) {
        runningRef.current = false
        setIsScanning(false)
        setPermError(true)
        // scanner.start() propaga el DOMException original de getUserMedia
        // sin envolverlo — .name llega intacto, no hace falta un preflight
        // getUserMedia aparte (evitaría pedir la cámara dos veces).
        const name = err instanceof DOMException ? err.name : null
        if (name === 'NotAllowedError') {
          setError('Permite el acceso a la cámara en tu navegador para escanear')
        } else if (name === 'NotFoundError') {
          setError('Este dispositivo no tiene cámara disponible')
        } else {
          setError('No se pudo acceder a la cámara')
        }
        onErrorRef.current?.('permission_denied')
      }
    })()
  }, [containerId, emit])

  useEffect(() => {
    if (active) startScanner()
    else stopScanner()
    return () => stopScanner()
  }, [active, startScanner, stopScanner])

  const scanFile = useCallback(async (file: File) => {
    setError(null)
    const fileScanId = `${containerId}-file`
    let el = document.getElementById(fileScanId)
    if (!el) {
      el = document.createElement('div')
      el.id = fileScanId
      el.style.display = 'none'
      document.body.appendChild(el)
    }
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(fileScanId)
      const decoded = await scanner.scanFile(file, false)
      try { scanner.clear() } catch { /* no-op */ }
      emit(decoded)
    } catch {
      setError('No se pudo leer el código en la foto')
    }
  }, [containerId, emit])

  return { videoContainerRef, permError, isScanning, error, startScanner, stopScanner, scanFile }
}
