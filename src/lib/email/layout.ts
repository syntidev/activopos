import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Shell HTML reutilizable para todos los correos transaccionales de ActivoPOS.
 * Tabla-based (compatibilidad Outlook), estilos inline, tipografía web-safe --
 * NUNCA Fraunces/Space Grotesk aquí, los clientes de correo no cargan fuentes
 * custom de forma confiable. Colores desde Guia_de_Marca_ActivoPOS_v1.md §1/§8.
 */

const BRAND_BLUE = '#0038BD'
const BRAND_AMBER = '#EF8E01'
const BRAND_NAVY = '#0D1B2E'
const TEXT_MUTED = '#6B7280'
const BG = '#F4F6FB'
const SURFACE = '#FFFFFF'
const FONT_STACK = "Arial, Helvetica, 'Segoe UI', system-ui, sans-serif"

const LOGO_SVG_PATH = join(process.cwd(), 'public', 'activopos-logo-flat-positive.svg')
const LOGO_BASE64 = Buffer.from(readFileSync(LOGO_SVG_PATH, 'utf8')).toString('base64')
const LOGO_SRC = `data:image/svg+xml;base64,${LOGO_BASE64}`

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://activopos.com'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function ctaButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
      <tr>
        <td style="border-radius:10px; background:${BRAND_AMBER};">
          <a href="${escapeHtml(url)}"
             style="display:inline-block; padding:13px 28px; font-family:${FONT_STACK};
                    font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none;
                    border-radius:10px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`
}

interface EmailShellOptions {
  previewText: string
  bodyHtml: string
}

export function emailShell({ previewText, bodyHtml }: EmailShellOptions): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ActivoPOS</title>
</head>
<body style="margin:0; padding:0; background:${BG}; font-family:${FONT_STACK};">
  <span style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(previewText)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

          <tr>
            <td style="padding:0 8px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle; padding-right:10px;">
                    <img src="${LOGO_SRC}" width="28" height="28" alt="ActivoPOS" style="display:block;">
                  </td>
                  <td style="vertical-align:middle; font-family:${FONT_STACK}; font-weight:700;
                             font-size:17px; letter-spacing:-0.3px;">
                    <span style="color:${BRAND_NAVY};">Activo</span><span style="color:${BRAND_AMBER};">POS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${SURFACE}; border-radius:16px; padding:32px 28px;
                       box-shadow:0 2px 8px rgba(47,43,61,0.10);">
              ${bodyHtml}
            </td>
          </tr>

          <tr>
            <td style="padding:24px 8px 0; text-align:center;">
              <p style="margin:0 0 4px; font-family:${FONT_STACK}; font-size:13px; color:${TEXT_MUTED};">
                El equipo de ActivoPOS
              </p>
              <p style="margin:0; font-family:${FONT_STACK}; font-size:12px; color:${TEXT_MUTED};">
                <a href="${APP_URL}/contacto" style="color:${BRAND_BLUE}; text-decoration:none;">¿Necesitas ayuda?</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export { escapeHtml, APP_URL, BRAND_NAVY, TEXT_MUTED, FONT_STACK }
