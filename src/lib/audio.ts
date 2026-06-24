export function playBeep(freq: number, durationMs: number): void {
  try {
    const ctx  = new window.AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000)
    osc.onended = () => void ctx.close()
  } catch {
    // AudioContext not supported
  }
}
