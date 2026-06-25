'use client'

import { useEffect, useRef } from 'react'
import useScanDetection from 'use-scan-detection'

interface UseHardwareScannerOptions {
  /** Called with the decoded barcode string when a hardware scan is detected. */
  onScan: (code: string) => void
  /** When false the hook is silent. Use to disable scanning outside of POS context. */
  enabled?: boolean
}

/**
 * Detects input from a USB/Bluetooth barcode reader by measuring inter-character
 * timing: bursts arriving faster than 50ms avg are treated as scanner input.
 * Enter terminates the code (default end character from use-scan-detection).
 *
 * Guard: silenced when an INPUT, TEXTAREA or SELECT has focus so the scanner
 * never hijacks text fields.
 */
export function useHardwareScanner({ onScan, enabled = true }: UseHardwareScannerOptions): void {
  // Stable ref so useScanDetection's closure always calls the latest onScan
  const onScanRef = useRef(onScan)
  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useScanDetection({
    averageWaitTime: 50,
    minLength:       4,
    onComplete: (code) => {
      if (!enabled) return
      const tag = document.activeElement?.tagName?.toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      onScanRef.current(String(code))
    },
  })
}
