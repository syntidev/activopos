'use client'

import { useEffect, useRef, useState } from 'react'
import type Quagga from '@ericblade/quagga2'

type QuaggaType = typeof Quagga

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
  /** Attach to a <div> element — Quagga renders video/canvas inside it. */
  videoContainerRef: React.RefObject<HTMLDivElement>
  /** True when the camera could not be started. */
  permError: boolean
}

type DetectHandler = (result: { codeResult: { code: string | null } }) => void

/**
 * Shared scanner hook — manages @ericblade/quagga2 lifecycle, camera permissions,
 * and debounce. Quagga2's locator finds barcodes even when rotated or off-center.
 * Uses dynamic import to avoid SSR failures (Quagga accesses browser APIs at load time).
 */
export function useScanner({
  active,
  onResult,
  onError,
  debounceMs = 1500,
}: UseScannerOptions): UseScannerReturn {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [permError, setPermError]   = useState(false)

  // Stable refs for the loaded module and active handler (shared between effect and cleanup)
  const quaggaRef  = useRef<QuaggaType | null>(null)
  const handlerRef = useRef<DetectHandler | null>(null)

  // Store callbacks in refs so the effect doesn't re-run when they change identity
  const onResultRef = useRef(onResult)
  const onErrorRef  = useRef(onError)
  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  useEffect(() => {
    const target = videoContainerRef.current

    if (!active) {
      const Q = quaggaRef.current
      const H = handlerRef.current
      if (Q && H) Q.offDetected(H)
      if (Q) { try { Q.stop() } catch { /* not running */ } }
      return
    }

    if (!target) return

    setPermError(false)

    let mounted = true
    let lastCode = ''
    let lastTs   = 0

    const handler: DetectHandler = (result) => {
      const code = result.codeResult.code
      if (!code) return
      const now = Date.now()
      if (code === lastCode && now - lastTs < debounceMs) return
      lastCode = code
      lastTs   = now
      onResultRef.current(code)
    }

    void import('@ericblade/quagga2').then(({ default: Q }) => {
      if (!mounted) return
      quaggaRef.current  = Q
      handlerRef.current = handler

      Q.init(
        {
          inputStream: {
            type: 'LiveStream',
            target,
            constraints: {
              facingMode: { ideal: 'environment' },
            },
          },
          locator: {
            patchSize: 'large',
            halfSample: false,
          },
          numOfWorkers: 2,
          decoder: {
            readers: [
              'ean_reader',
              'ean_8_reader',
              'code_128_reader',
              'upc_reader',
              'upc_e_reader',
            ],
          },
          locate: true,
        },
        (err) => {
          if (!mounted) return
          if (err) {
            setPermError(true)
            onErrorRef.current?.('permission_denied')
            return
          }
          Q.start()
          Q.onDetected(handler)
        }
      )
    })

    return () => {
      mounted = false
      const Q = quaggaRef.current
      const H = handlerRef.current
      if (Q && H) Q.offDetected(H)
      if (Q) { try { Q.stop() } catch { /* already stopped */ } }
      quaggaRef.current  = null
      handlerRef.current = null
    }
  }, [active, debounceMs])

  return { videoContainerRef, permError }
}
