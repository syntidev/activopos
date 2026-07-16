# ActivoPOS — Tags PWA para `<head>`

## Next.js 14 — implementación en `app/layout.tsx`

La forma correcta en Next.js 14 NO es poner tags manuales en el `<head>`.
Se usa el objeto `metadata` exportado desde `layout.tsx`.

```typescript
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ActivoPOS',
  description: 'Tu sistema de control de ventas e inventario',
  manifest: '/brand/activopos/site.webmanifest',
  themeColor: '#EF8E01',
  appleWebApp: {
    capable: true,
    title: 'ActivoPOS',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/brand/activopos/favicon.ico', sizes: 'any' },
      { url: '/brand/activopos/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/brand/activopos/activopos-logo-icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/brand/activopos/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
}
```

---

## HTML puro — si necesitas los tags directos

```html
<!-- ActivoPOS — PWA + Favicon -->
<link rel="icon" type="image/x-icon" href="/brand/activopos/favicon.ico">
<link rel="icon" type="image/svg+xml" href="/brand/activopos/activopos-logo-icon.svg">
<link rel="icon" type="image/png" sizes="96x96" href="/brand/activopos/favicon-96x96.png">
<link rel="apple-touch-icon" sizes="180x180" href="/brand/activopos/apple-touch-icon.png">
<link rel="manifest" href="/brand/activopos/site.webmanifest">
<meta name="theme-color" content="#EF8E01">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ActivoPOS">
```

---

## Estructura de archivos en `/public`

```
public/
  brand/
    activopos/
      favicon.ico                    ← ICO multi-resolución (16, 32, 48px)
      favicon-96x96.png              ← PNG 96×96
      favicon.svg                    ← SVG favicon adaptive
      apple-touch-icon.png           ← PNG 180×180 para iOS
      web-app-manifest-192x192.png   ← PNG 192×192 maskable (Android)
      web-app-manifest-512x512.png   ← PNG 512×512 maskable (Android splash)
      activopos-logo-icon.svg        ← SVG isotipo flat (sidebar, general)
      activopos-logo-flat-positive.svg
      activopos-logo-flat-negative.svg
      activopos-logo-adaptive.svg
      activopos-logo-monochrome.svg
      activopos-logo-positive.svg
      activopos-logo-negative.svg
      site.webmanifest
```

---

## Qué hace cada archivo de imagen

| Archivo | Tamaño | Propósito |
|---|---|---|
| `favicon.ico` | 16/32/48px | Browser tab, bookmarks — legado |
| `favicon-96x96.png` | 96×96 | Android Chrome tab |
| `favicon.svg` | vectorial | Browsers modernos — mejor opción |
| `apple-touch-icon.png` | 180×180 | iOS "Añadir a pantalla de inicio" |
| `web-app-manifest-192x192.png` | 192×192 | Android PWA icon |
| `web-app-manifest-512x512.png` | 512×512 | Android splash screen + Play Store |

---

## Nota crítica — `purpose: maskable`

Los íconos `192x192` y `512x512` están marcados como `maskable`.
Esto significa que Android puede recortarlos en círculo, cuadrado redondeado, etc.

**El logo ActivoPOS necesita padding interno para maskable:**
El círculo central debe quedar dentro del 80% central del canvas.
Los brackets actuales llegan casi al borde — en modo maskable Android
los recortará y los brackets se cortarán.

**Solución:** generar versiones con fondo `#0038BD` y el isotipo centrado
al 75% del tamaño total. Eso garantiza que ningún recorte de forma
elimine elementos visuales.

¿Genero esas versiones maskable con fondo azul?

---

## Verificación PWA — checklist

Después de implementar, verificar en Chrome DevTools:
1. `F12` → Application → Manifest → sin errores en rojo
2. `F12` → Application → Service Workers → registrado
3. Lighthouse → PWA audit → score > 90
4. En móvil Android: Chrome → menú → "Añadir a pantalla de inicio"
5. En iOS Safari: compartir → "Añadir a pantalla de inicio"
