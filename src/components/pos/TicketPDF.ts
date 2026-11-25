// Helpers de impresión: abre un documento HTML en una ventana vía Blob URL y llama a print().
// La cotización ya no se arma acá: vive en src/lib/quotation-document.ts (documento único).

/* ── XSS protection: escape all user-controlled strings ── */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ── Safe print helper via Blob URL (avoids document.write) ── */
export function openPrintDocument(fullDoc: string): void {
  const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)

  const win = window.open(url, '_blank', 'width=900,height=650,toolbar=no,scrollbars=yes')
  if (!win) {
    URL.revokeObjectURL(url)
    // eslint-disable-next-line no-alert
    alert('Activa las ventanas emergentes para imprimir. Busca el ícono bloqueado en la barra de direcciones.')
    return
  }

  // Give the browser time to render the blob before triggering print
  const cleanup = () => { URL.revokeObjectURL(url) }
  setTimeout(() => {
    win.print()
    win.addEventListener('afterprint', () => { win.close(); cleanup() }, { once: true })
    // Fallback cleanup if afterprint never fires (some browsers)
    setTimeout(cleanup, 30_000)
  }, 400)
}

export function openPrintWindow(html: string, css: string): void {
  openPrintDocument([
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head><meta charset="utf-8">',
    '<title>ActivoPOS — Ticket</title>',
    `<style>${css}</style>`,
    '</head><body>',
    html,
    '</body></html>',
  ].join(''))
}
