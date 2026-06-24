'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'

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

/* ── Decoder hints — narrow to common retail formats for faster matching ── */
const HINTS = new Map<DecodeHintType, unknown>()
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
])
HINTS.set(DecodeHintType.TRY_HARDER, true)

/* ── Camera constraints — 640p preferred, rear camera, continuous focus ── */
const CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width:      { ideal: 640, max: 1280 },
    height:     { ideal: 480, max: 720 },
    frameRate:  { ideal: 30, max: 30 },
    advanced: [
      { focusMode: 'continuous' },
      { exposureMode: 'continuous' },
      { whiteBalanceMode: 'continuous' },
    ] as unknown as MediaTrackConstraintSet[],
  },
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

    const reader = new BrowserMultiFormatReader(HINTS)
    let mounted = true

    const init = async () => {
      const el = videoRef.current
      if (!el) return
      try {
        const controls = await reader.decodeFromConstraints(
          CONSTRAINTS,
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
      // Explicitly release all camera tracks to free hardware and save battery
      const video = videoRef.current
      const stream = video?.srcObject
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach(t => t.stop())
      }
      if (video) video.srcObject = null
    }
  }, [active, debounceMs])

  return { videoRef, permError }
}
