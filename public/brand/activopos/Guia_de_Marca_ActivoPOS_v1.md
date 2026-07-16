# ActivoPOS — Guía de Marca v1
**Última actualización:** JUL 2026 (v1.0 — sistema inicial)
**Producto:** ActivoPOS — sistema de control de ventas e inventario para PYMES venezolanas
**Posición en familia SYNTI:** producto hermano de SYNTIweb · desarrollado bajo SYNTIdev
**Dominio:** `activopos.com`

---

## 0. Posición en la familia SYNTI

ActivoPOS hereda el ADN visual de la familia SYNTI con identidad propia:

| Producto | Nivel | Símbolo | Acento | Relación |
|---|---|---|---|---|
| **SYNTI.dev** | Padre | 2 brackets diagonales + 2 círculos | `#38BDF8` azul cielo | Marca paraguas corporativa |
| **SYNTIpos** | Hermano | 4 brackets + 4 círculos | `#4A80E4` azul plataforma | Sistema base POS |
| **ActivoPOS** | Producto | 4 brackets + círculo central + anillos | `#EF8E01` ámbar | POS comercial venezolano |
| **ordena.menu** | Hermano | 1 bracket + 3 píldoras | `#E8541A` naranja | Menú digital gastronómico |

**Regla de herencia:** los 4 brackets son el ADN compartido con SYNTIpos. ActivoPOS reemplaza los 4 círculos por un único círculo central rodeado de anillos concéntricos — representando el punto de venta como centro de actividad del negocio.

**Filosofía del símbolo:**
- Los **brackets** → control, orden, gestión, software
- El **círculo naranja** → la venta, el cliente, la transacción, el negocio
- Los **anillos concéntricos** → actividad, flujo, respuesta inmediata, datos en movimiento
- Lectura completa: *"Todo gira alrededor de tu negocio."*

**Doble lectura del símbolo (intencional):**
- Lectura 1 — tecnología: sensor digital, lector NFC, radar de actividad comercial
- Lectura 2 — negocio: el punto de venta como centro de gravedad del emprendimiento

---

## 1. Paleta de color

### 1.1 Tokens CSS canónicos

```css
/* Primario — brackets, estructura, tipografía de marca */
--ap-blue:          #0038BD;
--ap-blue-hover:    #0030A8;
--ap-blue-soft:     #EEF2FF;   /* fondos de sección, highlights suaves */

/* Acento — círculo, CTA principal, anillos, highlights */
--ap-amber:         #EF8E01;
--ap-amber-hover:   #D97900;
--ap-amber-active:  #B56700;

/* Fondos */
--ap-bg:            #F4F6FB;   /* fondo base dashboard y landing */
--ap-bg-alt:        #EEF2FF;   /* secciones alternadas landing */
--ap-surface:       #FFFFFF;   /* cards, modales, inputs */

/* Estructura oscura */
--ap-navy:          #0D1B2E;   /* hero oscuro, footer, login */

/* Texto */
--ap-text:          #0D1B2E;
--ap-text-muted:    #6B7280;
--ap-text-inverse:  #FFFFFF;
```

### 1.2 Paleta visual completa

| Token | Hex | Uso |
|---|---|---|
| `--ap-blue` | `#0038BD` | Brackets, nav, tipografía principal de marca |
| `--ap-blue-hover` | `#0030A8` | Hover de elementos azules |
| `--ap-blue-soft` | `#EEF2FF` | Fondos de sección, chips, badges informativos |
| `--ap-amber` | `#EF8E01` | Círculo isotipo, CTA "Procesar Pago", highlights |
| `--ap-amber-hover` | `#D97900` | Hover de botones naranja |
| `--ap-amber-active` | `#B56700` | Active/pressed de botones naranja |
| `--ap-bg` | `#F4F6FB` | Fondo base — nunca blanco puro |
| `--ap-bg-alt` | `#EEF2FF` | Secciones alternadas en landing |
| `--ap-surface` | `#FFFFFF` | Cards con elevación, modales, inputs |
| `--ap-navy` | `#0D1B2E` | Hero, footer, login — fondo oscuro exclusivo |
| `--ap-text-muted` | `#6B7280` | Subtítulos, labels, metadatos |

**Regla crítica:** `--ap-amber` aparece exactamente **dos veces** por página de marketing: en el CTA "Procesar Pago" y en "Declarar Cierre". No usar como color decorativo general.

**Colores SYNTI reservados:** `#38BDF8` (SYNTI.dev) y `#4A80E4` (SYNTIpos/SYNTIweb) están reservados para la familia. ActivoPOS nunca los usa como acento.

---

## 2. Tipografía

```css
/* Display — wordmark, heroes, títulos de impacto */
h1, h2, .wordmark { font-family: 'Space Grotesk', sans-serif; }

/* Body — interfaces, textos, dashboard */
body, p, label    { font-family: system-ui, sans-serif; }
```

| Elemento | Familia | Peso | Tamaño |
|---|---|---|---|
| Wordmark "Activo" | Space Grotesk | 700 | Contextual |
| Wordmark "POS" | Space Grotesk | 700 | Contextual — color `#EF8E01` |
| H1 hero landing | Space Grotesk | 700 | `clamp(2rem, 5vw, 3.5rem)` |
| H2 sección | Space Grotesk | 600 | `1.75rem` |
| Body global | system-ui | 400 | 16px |
| Labels / muted | system-ui | 400 | 12–14px |
| Botones / CTA | system-ui | 600 | 14–16px |

**Regla del wordmark:** "Activo" en `#0D1B2E` (o blanco en oscuro), "POS" siempre en `#EF8E01`. Nunca invertir.

---

## 3. Símbolo — especificación técnica

El símbolo se construye sobre un viewBox `0 0 500 500`. Centro matemático en `cx="250" cy="250"`.

### 3.1 Construcción del símbolo

```svg
<!-- 4 Brackets — herencia directa de SYNTIpos, paths inmutables -->
<path d="M 26,82 Q 26,26 82,26 L 190,26 Q 220,26 220,56 Q 220,88 190,88
         L 100,88 Q 88,88 88,100 L 88,190 Q 88,220 56,220 Q 26,220 26,190 Z"/>
<path d="M 474,82 Q 474,26 418,26 L 310,26 Q 280,26 280,56 Q 280,88 310,88
         L 400,88 Q 412,88 412,100 L 412,190 Q 412,220 444,220 Q 474,220 474,190 Z"/>
<path d="M 26,418 Q 26,474 82,474 L 190,474 Q 220,474 220,444 Q 220,412 190,412
         L 100,412 Q 88,412 88,400 L 88,310 Q 88,280 56,280 Q 26,280 26,310 Z"/>
<path d="M 474,418 Q 474,474 418,474 L 310,474 Q 280,474 280,444 Q 280,412 310,412
         L 400,412 Q 412,412 412,400 L 412,310 Q 412,280 444,280 Q 474,280 474,310 Z"/>

<!-- Anillos concéntricos — opacidad decreciente, grosor decreciente -->
<circle fill="none" stroke="#EF8E01" stroke-width="5"   opacity="0.75" cx="250" cy="250" r="96"/>
<circle fill="none" stroke="#EF8E01" stroke-width="3.5" opacity="0.45" cx="250" cy="250" r="120"/>
<circle fill="none" stroke="#EF8E01" stroke-width="2"   opacity="0.25" cx="250" cy="250" r="144"/>

<!-- Círculo central — el punto de venta -->
<circle fill="#EF8E01" cx="250" cy="250" r="72"/>
```

### 3.2 Proporciones irrompibles

| Elemento | Valor | Regla |
|---|---|---|
| Círculo central | `r="72"` | Nunca menor a r=60 ni mayor a r=80 |
| Anillo 1 | `r="96"` `stroke-width="5"` `opacity="0.75"` | Gap de 24px desde el círculo |
| Anillo 2 | `r="120"` `stroke-width="3.5"` `opacity="0.45"` | Gap de 24px desde anillo 1 |
| Anillo 3 | `r="144"` `stroke-width="2"` `opacity="0.25"` | Gap de 24px desde anillo 2 |
| Separación entre anillos | 24px | Irrompible — da el "aire" del pulso |
| Brackets | paths exactos arriba | Nunca modificar los paths |

**Regla de los anillos:** grosor y opacidad siempre decrecientes hacia afuera. El anillo exterior debe verse casi como un susurro. La sensación es radar, no explosión.

---

## 4. Archivos SVG — sistema de variantes

```
public/brand/activopos/
  activopos-logo-positive.svg       ← fondo claro, con sombras
  activopos-logo-negative.svg       ← fondo oscuro navy, con glow naranja
  activopos-logo-flat-positive.svg  ← sin efectos, fondo transparente
  activopos-logo-flat-negative.svg  ← sin efectos, fondo navy
  activopos-logo-monochrome.svg     ← un solo color, para impresión
  activopos-logo-adaptive.svg       ← auto light/dark via @media CSS
  activopos-logo-icon.svg           ← solo isotipo, sin wordmark
```

### 4.1 Tabla de uso por variante

| Archivo | Cuándo usar |
|---|---|
| `positive.svg` | Navbar landing fondo claro, documentos, headers sobre blanco/gris |
| `negative.svg` | Footer navy, hero oscuro, fondos `#0D1B2E` |
| `flat-positive.svg` | Favicon 16–32px, badges, emails, "Powered by", print digital |
| `flat-negative.svg` | App icon dark, PWA dark mode, social media oscuro |
| `monochrome.svg` | Sellos, documentos legales, bordado, grabado, marca de agua |
| `adaptive.svg` | Web general — responde automáticamente al modo del OS |
| `icon.svg` | Sidebar del dashboard, app icon 512px, PWA manifest |

### 4.2 Especificación de efectos por variante

**`positive` — fondo claro:**
```svg
<!-- Brackets: sombra diagonal oscura suave -->
<filter id="sh-bracket">
  <feDropShadow dx="1" dy="2" stdDeviation="2.5"
    flood-color="#000000" flood-opacity="0.18"/>
</filter>

<!-- Círculo: sombra cálida ámbar — da volumen y flotación -->
<filter id="sh-circle">
  <feDropShadow dx="2" dy="3" stdDeviation="4"
    flood-color="#B56700" flood-opacity="0.45"/>
</filter>

<!-- Anillos: sombra muy sutil para no verse completamente flat -->
<filter id="sh-rings">
  <feDropShadow dx="1" dy="1" stdDeviation="1.5"
    flood-color="#000000" flood-opacity="0.10"/>
</filter>
```

**`negative` — fondo oscuro:**
```svg
<!-- Brackets: glow blanco difuso -->
<filter id="sh-bracket-dk">
  <feDropShadow dx="0" dy="0" stdDeviation="4"
    flood-color="#FFFFFF" flood-opacity="0.12"/>
</filter>

<!-- Círculo: glow naranja — el punto de venta "encendido" -->
<filter id="glow-circle">
  <feGaussianBlur stdDeviation="12" result="blur"/>
  <feMerge>
    <feMergeNode in="blur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>

<!-- Anillos: glow naranja muy sutil -->
<filter id="sh-rings-dk">
  <feDropShadow dx="0" dy="0" stdDeviation="2"
    flood-color="#EF8E01" flood-opacity="0.15"/>
</filter>
```

---

## 5. Wordmark — código canónico

**Navbar fondo claro:**
```html
<a href="/" style="display:inline-flex; align-items:center; gap:10px;">
  <img src="/brand/activopos/activopos-logo-flat-positive.svg"
       alt="ActivoPOS" width="36" height="36">
  <span style="font-family:'Space Grotesk',sans-serif; font-weight:700;
               font-size:18px; color:#0D1B2E; letter-spacing:-0.3px;">
    Activo<span style="color:#EF8E01;">POS</span>
  </span>
</a>
```

**Navbar fondo oscuro / footer:**
```html
<a href="/" style="display:inline-flex; align-items:center; gap:10px;">
  <img src="/brand/activopos/activopos-logo-flat-negative.svg"
       alt="ActivoPOS" width="32" height="32">
  <span style="font-family:'Space Grotesk',sans-serif; font-weight:700;
               font-size:18px; color:#FFFFFF; letter-spacing:-0.3px;">
    Activo<span style="color:#EF8E01;">POS</span>
  </span>
</a>
```

**Sidebar dashboard (solo icon):**
```html
<img src="/brand/activopos/activopos-logo-icon.svg"
     alt="ActivoPOS" width="32" height="32">
```

---

## 6. Favicon y app icon

### 6.1 Variantes de app icon

| Fondo | Brackets | Anillos | Círculo | Uso |
|---|---|---|---|---|
| Transparente | `#0038BD` | `#EF8E01` | `#EF8E01` | Favicon light, web |
| `#0D1B2E` navy | `#FFFFFF` | `#EF8E01` | `#EF8E01` | Favicon dark, PWA dark |
| `#0038BD` azul | `#FFFFFF` | `#EF8E01` | `#EF8E01` | App Store, Play Store |

### 6.2 Implementación en `<head>`

```html
<!-- SVG adaptive — responde al modo del OS -->
<link rel="icon" type="image/svg+xml"
      href="/brand/activopos/activopos-logo-adaptive.svg">

<!-- PNG fallback -->
<link rel="icon" type="image/png" sizes="32x32"
      href="/brand/activopos/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16"
      href="/brand/activopos/favicon-16.png">

<!-- Apple touch icon -->
<link rel="apple-touch-icon" sizes="180x180"
      href="/brand/activopos/apple-touch-icon.png">

<!-- PWA manifest -->
<link rel="manifest" href="/brand/activopos/site.webmanifest">
<meta name="theme-color" content="#EF8E01">
```

### 6.3 `site.webmanifest`

```json
{
  "name": "ActivoPOS",
  "short_name": "ActivoPOS",
  "description": "Tu sistema de control de ventas e inventario",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0D1B2E",
  "theme_color": "#EF8E01",
  "icons": [
    { "src": "/brand/activopos/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/brand/activopos/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/brand/activopos/activopos-logo-adaptive.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

---

## 7. Patrones visuales recurrentes

| Elemento | Valor |
|---|---|
| Fondo base landing | `#F4F6FB` sólido |
| Secciones alternadas | `#EEF2FF` |
| Hero fondo recomendado | `#F4F6FB` — nunca navy puro en hero principal |
| Footer fondo | `#0D1B2E` |
| Cards / superficies | `#FFFFFF` + `box-shadow: 0 2px 8px rgba(47,43,61,0.10)` |
| CTA primario | bg `#EF8E01` · hover `#D97900` · shadow `0 4px 16px rgba(239,142,1,0.35)` |
| CTA ghost | bg `rgba(239,142,1,0.08)` · border `rgba(239,142,1,0.3)` · color `#EF8E01` |
| Badge / pill | bg `rgba(0,56,189,0.08)` · border `rgba(0,56,189,0.2)` · color `#0038BD` |
| Border radius cards | `16px` |
| Border radius botones | `8px` |
| Login | siempre dark navy `#0D1B2E` — es la fachada de ActivoPOS |
| Dashboard sidebar | siempre blanco `#FAFBFC` · borde `#E5E7EB` |

---

## 8. Reglas de uso por contexto

| Contexto | Archivo | Brackets | Círculo |
|---|---|---|---|
| Navbar landing (fondo claro) | `flat-positive.svg` | `#0038BD` | `#EF8E01` |
| Navbar landing (fondo oscuro) | `flat-negative.svg` | `#FFFFFF` | `#EF8E01` |
| Hero claro / documentos | `positive.svg` | `#0038BD` + sombra | `#EF8E01` + sombra ámbar |
| Footer landing | `flat-negative.svg` | `#FFFFFF` | `#EF8E01` |
| Hero oscuro / banners | `negative.svg` | `#FFFFFF` + glow | `#EF8E01` + glow naranja |
| Favicon / PWA | `adaptive.svg` | auto OS | `#EF8E01` siempre |
| Sidebar dashboard | `icon.svg` | `#0038BD` | `#EF8E01` |
| Login screen | `negative.svg` o `flat-negative.svg` | `#FFFFFF` | `#EF8E01` |
| Impresión / sello legal | `monochrome.svg` | `#0D1B2E` | `#0D1B2E` |
| Emails / notificaciones | `flat-positive.svg` (inline base64) | `#0038BD` | `#EF8E01` |
| App Store / Play Store | `flat-negative.svg` sobre `#0038BD` | `#FFFFFF` | `#EF8E01` |

---

## 9. Lo que NO se hace

| ❌ Prohibido | ✅ Correcto |
|---|---|
| Modificar los paths de los 4 brackets | Los paths son herencia inmutable de SYNTIpos |
| Cambiar el radio del círculo central fuera de r=60–80 | Mantener `r="72"` como valor canónico |
| Alterar la separación de 24px entre anillos | El espacio entre anillos es la "respiración" del símbolo |
| Usar anillos con opacidad creciente hacia afuera | Siempre decreciente: 0.75 → 0.45 → 0.25 |
| Usar `#D97900` o `#B56700` en el círculo del isotipo | Solo `#EF8E01` en el símbolo |
| Usar `#38BDF8` o `#4A80E4` como acento | Reservados para SYNTI.dev y SYNTIpos |
| Hero principal en navy puro | Hero en `#F4F6FB` — navy solo en footer y login |
| Sidebar del dashboard con color o tema del cliente | Sidebar siempre blanco `#FAFBFC` |
| "Activo" en naranja o "POS" en azul | "Activo" en navy/blanco, "POS" siempre en `#EF8E01` |
| Usar `adaptive.svg` en emails | Siempre `flat-positive.svg` en emails |
| Logo con fondo de color arbitrario | Solo fondos documentados en §8 |

---

## 10. Cómo extender el sistema

Si se agregan módulos o productos bajo ActivoPOS:

1. Heredan los 4 brackets (mismo path SVG, inmutable).
2. Definen su acento diferenciador si es un producto independiente.
3. Si es un módulo interno, usan la paleta ActivoPOS sin cambios.
4. Tipografía: Space Grotesk para display, system-ui para body.
5. Agregar variante en `public/brand/` con nomenclatura `producto-logo-{variante}.svg`.
6. Documentar en esta guía en §8.

---

## 11. Histórico

- **v1.0 — JUL 2026:** sistema inicial. 4 brackets heredados de SYNTIpos, círculo central `r=72` con 3 anillos concéntricos como símbolo de pulso digital. Paleta `#0038BD` / `#EF8E01`. 7 variantes SVG. Guía alineada al esquema de marca de la familia SYNTI.
