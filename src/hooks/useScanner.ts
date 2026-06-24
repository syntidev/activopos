'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface ScannerControls { stop(): void }

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
  /** Attach to a <video> element in the DOM when `active` is true. */
  videoRef: React.RefObject<HTMLVideoElement>
  /** True when the camera could not be started. */
  permError: boolean
}

/**
 * Shared scanner hook — manages @zxing/browser lifecycle, camera permissions,
 * and debounce. Any module can use this: POS split-screen, product lookup, etc.
 */
export function useScanner({
  active,
  onResult,
  onError,
  debounceMs = 1500,
}: UseScannerOptions): UseScannerReturn {
  const videoRef       = useRef<HTMLVideoElement>(null)
  const controlsRef    = useRef<ScannerControls | null>(null)
  const lastScannedRef = useRef<{ code: string; ts: number } | null>(null)
  // Store callbacks in refs so effect doesn't re-run when they change
  const onResultRef    = useRef(onResult)
  const onErrorRef     = useRef(onError)
  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const [permError, setPermError] = useState(false)

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop()
      controlsRef.current = null
      return
    }

    setPermError(false)
    lastScannedRef.current = null

    const reader = new BrowserMultiFormatReader()
    let mounted = true

    const init = async () => {
      const el = videoRef.current
      if (!el) return
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          el,
          (result) => {
            if (!result || !mounted) return
            const code = result.getText()
            const now  = Date.now()
            if (
              lastScannedRef.current &&
              lastScannedRef.current.code === code &&
              now - lastScannedRef.current.ts < debounceMs
            ) return
            lastScannedRef.current = { code, ts: now }
            onResultRef.current(code)
          }
        )
        if (mounted) controlsRef.current = controls
        else          controls.stop()
      } catch {
        if (mounted) {
          setPermError(true)
          onErrorRef.current?.('permission_denied')
        }
      }
    }

    void init()

    return () => {
      mounted = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [active, debounceMs])

  return { videoRef, permError }
}
