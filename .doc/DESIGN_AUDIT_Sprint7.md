# DESIGN_AUDIT_Sprint7 — ActivoPOS Dashboard
**Fecha:** 17 de junio de 2026  
**Auditor:** Revisión automatizada con skill ui-ux-pro-max  
**Alcance:** `src/app/(dashboard)/` — 12 módulos / 43 archivos  
**Instrucción:** Solo reporte, cero cambios en código.

---

## Resumen ejecutivo

| Categoría | Crítico (P0) | Alto (P1) | Medio (P2) | Bajo (P3) |
|---|---|---|---|---|
| Layout / max-width / centrado | 0 | 6 | 2 | 1 |
| Tipografía | 0 | 1 | 4 | 2 |
| Touch targets < 44px | 0 | 4 | 4 | 2 |
| Empty states sin diseño | 0 | 1 | 3 | 1 |
| Dark/Light mode | 1 | 2 | 3 | 1 |
| **TOTAL** | **1** | **18** | **16** | **7** |

---

## 1. Problemas de Layout (max-width, centrado, spacing)

### 1.1 Double padding en páginas que agregan su propio `padding`
**Severidad: P1 — Alto**

El layout shell (`layout.module.css`) ya aplica `padding: var(--space-6)` (24 px) al contenedor `.content`. Los siguientes módulos añaden un segundo bloque de padding en su propia clase `.page`, generando **48 px de margen acumulado en cada lado**:

| Módulo | CSS | Padding duplicado |
|---|---|---|
| `caja/caja.module.css` | `.page { padding: var(--space-6) }` | Sí |
| `caja/historial/historial.module.css` | `.page { padding: var(--space-6) }` | Sí |
| `reportes/reportes.module.css` | `.page { padding: var(--space-6) }` | Sí |
| `pedidos/pedidos.module.css` | `.page { padding: var(--space-6) }` | Sí |
| `ayuda/ayuda.module.css` | `.page { padding: var(--space-6) }` | Sí |

Los módulos que **no** presentan este problema (referencia correcta): `escritorio`, `finanzas`, `clientes`, `productos`.

**Impacto visual:** En pantallas medianas (1024–1280 px), el contenido queda visiblemente encogido respecto a los módulos sin doble padding, creando inconsistencia lateral notoria entre módulos.

---

### 1.2 `max-width` definido sin `margin: 0 auto` → no centra en pantallas anchas
**Severidad: P1 — Alto**

Todos los módulos que definen `max-width` lo hacen sin añadir `margin: 0 auto`. En monitores ≥ 1440 px el contenido queda pegado a la izquierda.

| Módulo | max-width definido | margin: auto |
|---|---|---|
| `escritorio.module.css` | `1200px` | ❌ No |
| `caja/caja.module.css` | `1400px` | ❌ No |
| `caja/historial/historial.module.css` | `1400px` | ❌ No |
| `reportes/reportes.module.css` | `1400px` | ❌ No |
| `finanzas/finanzas.module.css` | `960px` | ❌ No |
| `clientes/clientes.module.css` | `1100px` | ❌ No |

**Único módulo correcto:** `ayuda/ayuda.module.css` — usa `.container { max-width: 900px; margin: 0 auto }`. Este patrón es la referencia a seguir.

**Fix genérico sugerido** (no tocar código en este sprint):
```css
.page {
  max-width: 1200px;  /* según módulo */
  margin: 0 auto;     /* ← faltante en todos los casos */
}
```

---

### 1.3 `max-width` inconsistente entre módulos
**Severidad: P2 — Medio**

No existe un sistema coherente de ancho máximo. Cuatro valores distintos coexisten:

| Valor | Módulos |
|---|---|
| `960px` | finanzas |
| `1100px` | clientes |
| `1200px` | escritorio |
| `1400px` | caja, historial, reportes |
| Sin max-width | pedidos, pos (full-bleed por diseño Kanban/POS) |

La variación entre `960 px` y `1400 px` es excesiva para una sola aplicación. Recomendable definir dos anchos canónicos: `content-narrow` (≈960 px) y `content-wide` (≈1280 px).

---

### 1.4 `pedidos/page.tsx` — empty state con `position: absolute; top: 180px` hardcoded
**Severidad: P2 — Medio**

```css
/* pedidos.module.css */
.emptyState {
  position: absolute;
  inset: 0;
  top: 180px;   /* ← valor fijo, frágil */
}
```

Si el header del Kanban cambia de altura (ej.: títulos más largos en móvil), el empty state flota en una posición incorrecta. No es un sistema de centrado relativo al contenedor disponible.

---

### 1.5 `clientes/clientes.module.css` — página mínimamente estilizada
**Severidad: P3 — Bajo**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 1100px;
}
```

Toda la lógica visual está delegada al componente `ClientesView`. Sin auditar ese componente (fuera de scope), se detecta que `clientes.module.css` no tiene estilos de responsive ni de centrado. Si `ClientesView` tampoco los tiene, el módulo hereda el problema 1.2.

---

## 2. Inconsistencias de Tipografía

### 2.1 Font-size del título de página (`h1`) varía en 3 valores distintos
**Severidad: P1 — Alto**

El elemento `h1` de cada página usa tamaños diferentes sin justificación jerárquica:

| Módulo | Clase | Font-size | Font-weight |
|---|---|---|---|
| `escritorio` | `.welcomeTitle` | `var(--text-xl)` → 20px | semibold |
| `pedidos` | `.pageTitle` | `var(--text-xl)` → 20px | semibold |
| `finanzas` | `.pageTitle` | `var(--text-xl)` → 20px | semibold |
| `caja` | `.pageTitle` | `var(--text-2xl)` → 24px | bold |
| `historial` | `.pageTitle` | `var(--text-2xl)` → 24px | bold |
| `reportes` | `.pageTitle` | `var(--text-2xl)` → 24px | bold |
| `ayuda` | `.pageTitle` | `var(--text-3xl)` → 30px | bold |

`ayuda` usa 30 px para su título, haciendo que parezca un landing page dentro de un panel de gestión. No hay ningún motivo de jerarquía que justifique esta divergencia.

**Estándar recomendado:** `var(--text-2xl)` / `font-weight: bold` para todos los `h1` de módulo.

---

### 2.2 Etiquetas de KPI con dos tamaños distintos para la misma función visual
**Severidad: P2 — Medio**

Los componentes KPI tienen dos tratamientos en el mismo dashboard:

| Componente | Clase | Font-size label | Uppercase |
|---|---|---|---|
| `escritorio` — `KpiCards` | `.kpiLabel` | `var(--text-sm)` → 14px | No |
| `caja` — `KpiCard` | `.kpiLabel` | `var(--text-2xs)` → 10px | Sí + tracking |
| `DashboardCharts` — `metricCard` | `.metricLabel` | `var(--text-xs)` → 12px | No |

En la pantalla de Escritorio coexisten visualmente las KPI cards (`text-sm`) y las metric cards de Rendimiento (`text-xs`), generando inconsistencia dentro del mismo viewport.

---

### 2.3 `sectionTitle` con dos tamaños en el mismo módulo (Escritorio)
**Severidad: P2 — Medio**

```css
/* escritorio.module.css */
.sectionTitle { font-size: var(--text-sm); }   /* 14px */

/* DashboardCharts.module.css */
.sectionTitle { font-size: var(--text-base); } /* 16px */
```

Ambos clases se llaman igual (`sectionTitle`) pero son archivos diferentes. El usuario ve "Rendimiento" (16px) y los títulos de sección del Operativo (14px) en la misma página, sin jerarquía clara.

---

### 2.4 `cardTitle` vs `sectionTitle` vs `chartTitle`: tres nombres para el mismo nivel
**Severidad: P2 — Medio**

Hay al menos tres nombres distintos para lo que visualmente es el título de una card:
- `.cardTitle` (caja.module.css): `var(--text-base)` / semibold
- `.sectionTitle` (DashboardCharts.module.css): `var(--text-base)` / semibold  
- `.chartTitle` (DashboardCharts.module.css): `var(--text-sm)` / semibold / `color-text-secondary`
- `.alertTitle` (DashboardOperativo.module.css): `var(--text-sm)` / semibold

No existe un componente `<CardHeader>` reutilizable. Cada módulo re-implementa el mismo patrón con nombres y tamaños ligeramente distintos.

---

### 2.5 KPI value de Escritorio usa `2rem` hardcoded, no un token
**Severidad: P3 — Bajo**

```css
/* escritorio.module.css */
.kpiValue { font-size: 2rem; }   /* ← no usa var(--text-4xl) = 2.25rem */
```

El sistema de tokens define `--text-4xl: 2.25rem`. Usar `2rem` directamente crea un valor fuera del sistema tipográfico.

---

### 2.6 `onboarding` usa `var(--text-2xl)` para `stepTitle`, que en móvil se reduce a `var(--text-xl)`
**Severidad: P3 — Bajo**

El breakpoint móvil reduce el título pero no ajusta el `line-height` ni el `letter-spacing`, lo que puede producir títulos de 2 líneas con espaciado demasiado apretado en dispositivos pequeños.

---

## 3. Touch targets menores a 44px

El token `--touch-min: 44px` está correctamente definido. El POS lo respeta en todos sus botones interactivos. Sin embargo, varios módulos los ignoran:

### 3.1 Botones de acción en pedidos/Kanban: 28px
**Severidad: P1 — Alto**

```css
/* pedidos.module.css */
.advanceBtn { height: 28px; }   /* ← 36% menor que --touch-min */
.waBtn { width: 28px; height: 28px; }  /* ← 36% menor */
```

El `advanceBtn` es el CTA principal de cada order card. En un flujo de trabajo en touch (tablet de caja), esta altura es inaceptable.

---

### 3.2 Botones de período en DashboardCharts: 30px
**Severidad: P1 — Alto**

```css
/* DashboardCharts.module.css */
.periodBtn { height: 30px; }  /* ← 31% menor que --touch-min */
```

El selector de período "7 días / 30 días / 12 meses" tiene targets de 30px. En modo tablet o en monitores táctiles, es difícil de activar con precisión.

---

### 3.3 Botones secundarios de finanzas: 30–36px
**Severidad: P1 — Alto**

```css
/* finanzas.module.css */
.monthInput { height: 36px; }   /* ← 18% menor */
.newBtn     { height: 36px; }   /* ← 18% menor */
.abonarBtn  { height: 30px; }   /* ← 31% menor */
```

El botón "Abonar" en la lista CxC es especialmente crítico porque es el CTA de cobro de deudas, acción frecuente en un POS táctil.

---

### 3.4 Paginación de reportes y chat close: 36–38px
**Severidad: P1 — Alto**

```css
/* reportes.module.css */
.pageBtn { min-width: 36px; height: 36px; }  /* ← 18% menor */

/* ayuda.module.css */
.chatClose { width: 28px; height: 28px; }    /* ← 36% menor */
.chatSendBtn { width: 38px; height: 38px; }  /* ← 13% menor */
```

---

### 3.5 Step dots de Onboarding: 24–28px (elementos con rol tab)
**Severidad: P2 — Medio**

```css
/* onboarding.module.css */
.dot       { width: 24px; height: 24px; }   /* role="tab" */
.dotActive { width: 28px; }                 /* role="tab" */
```

Los dots tienen `role="tab"` y `aria-selected`, lo que los hace elementos interactivos en el árbol de accesibilidad. Con 24px son inaceptables para accesibilidad táctil según WCAG 2.5.5.

---

### 3.6 `filterToggle` en reportes y `presetPill`
**Severidad: P2 — Medio**

```css
/* reportes.module.css */
.filterToggle { height: var(--touch-min); }  /* ✅ 44px — correcto */
.presetPill   { height: var(--touch-min); }  /* ✅ 44px — correcto */
```

Estos **sí cumplen** el estándar. Se documentan como referencia positiva.

---

### 3.7 Botones footer en historial caja (`filterActions`)
**Severidad: P2 — Medio**

Los botones "Filtrar" y "Actualizar" en `historial/page.tsx` usan el componente `Button` con `size="sm"`. El tamaño `sm` del Button component debe verificarse en `components/ui/Button.tsx` (fuera del scope de este archivo), pero si su altura es < 44px, los filtros de historial también incumplen.

---

### 3.8 `chatBubbleBtn` en ayuda: correcto
**Severidad: N/A — Positivo**

```css
/* ayuda.module.css */
.chatBubbleBtn { width: 52px; height: 52px; }  /* ✅ supera --touch-min */
```

---

## 4. Empty states sin diseño

### 4.1 Columnas Kanban de pedidos: texto plano sin ilustración
**Severidad: P1 — Alto**

```css
/* pedidos.module.css */
.columnEmpty {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-8) var(--space-4);
}
```

El texto "Sin pedidos" aparece solo, sin ícono ni llamada a la acción. En el estado inicial del sistema (antes de que lleguen pedidos), el Kanban se ve completamente vacío y sin contexto. No hay diferenciación visual entre "aún no hay pedidos" y "no aplica en este estado".

---

### 4.2 Historial de caja — estado previo a filtrado
**Severidad: P2 — Medio**

```tsx
{!fetched ? (
  <div className={styles.emptyPrompt}>
    <Archive size={28} className={styles.emptyIcon} aria-hidden="true" />
    <p>Selecciona un rango de fechas y presiona <strong>Filtrar</strong>.</p>
  </div>
) : ...}
```

Tiene ícono y texto, pero el ícono (`Archive`) es opaco al 50% y el estado no incluye acción directa (botón/call-to-action). El usuario ve la página vacía sin saber si puede hacer algo más allá de leer las instrucciones. El empty state de "cero resultados" sí está cubierto, pero el estado "aún no buscaste" podría ser más directivo.

---

### 4.3 Sección de movimientos de caja vacía
**Severidad: P2 — Medio**

```tsx
<div className={styles.emptyMovements}>
  <span className={styles.emptyIcon}>
    <ArrowDownLeft size={28} aria-hidden="true" />
  </span>
  Ningún movimiento extra registrado
</div>
```

```css
.emptyIcon { color: var(--color-text-muted); opacity: 0.4; }
```

El ícono al 40% de opacidad con un texto descriptivo sin jerarquía clara es minimal pero funcional. Sin embargo, no hay un botón "Agregar primero" dentro del estado vacío, forzando al usuario a localizar el botón en el `cardHeader` separado.

---

### 4.4 Módulo de productos — sin verificar en esta auditoría
**Severidad: P2 — Medio (estimado)**

`productos/page.tsx` no pudo leerse completo por límite de contexto. Por la estructura del módulo (filtros, tabla/grid de productos, `ImportModal`), es probable que exista un empty state cuando no hay productos. No se confirma si tiene diseño adecuado. **Requiere revisión manual.**

---

### 4.5 Empty states bien implementados (referencia)
**Severidad: N/A — Positivo**

Los siguientes módulos tienen empty states con ícono + título + subtítulo correctamente jerarquizados:
- **POS** (`LeftPanel` / `TicketPanel`): `SearchEmpty`, `NoResults`, `ticketEmpty` — todos con ícono, título y subtítulo.
- **Reportes**: `emptyState` con ícono + texto.
- **Pedidos** (estado global): el empty state general tiene ícono + título + descripción, aunque con el problema de posicionamiento absoluto descrito en 1.4.

---

## 5. Dark/Light mode

### 5.1 Tokens de badge NO se redefinen en el tema light (bug de contraste)
**Severidad: P0 — Crítico**

En `tokens.css`, el bloque `[data-theme="light"]` **no sobreescribe** las variables `--badge-*`. Estas heredan los valores de `:root` (modo dark):

```css
/* Solo en :root (dark) */
--badge-paid-text: #4ADE80;       /* verde brillante para fondo oscuro */
--badge-pending-text: #FCD34D;    /* amarillo brillante para fondo oscuro */
--badge-quote-text: #93C5FD;      /* azul claro para fondo oscuro */
--badge-cancelled-text: #FCA5A5;  /* rojo claro para fondo oscuro */
```

En light mode, estos colores claros sobre fondos casi blancos (`rgba(29,158,117,0.08)`) producen **ratios de contraste < 3:1**, incumpliendo WCAG 2.1 AA (mínimo 4.5:1 para texto pequeño). Los badges de estado en `reportes` y cualquier módulo que los use quedarán ilegibles en el tema claro.

**Tokens faltantes en `[data-theme="light"]`:**

```css
/* Añadir al bloque light en tokens.css */
--badge-paid-bg:       rgba(26,127,100,0.08);
--badge-paid-text:     #1A7F64;
--badge-paid-border:   rgba(26,127,100,0.3);

--badge-pending-bg:    rgba(180,83,9,0.08);
--badge-pending-text:  #B45309;
--badge-pending-border:rgba(180,83,9,0.3);

--badge-quote-bg:      rgba(37,99,235,0.08);
--badge-quote-text:    #1D4ED8;
--badge-quote-border:  rgba(37,99,235,0.3);

--badge-cancelled-bg:  rgba(207,34,46,0.08);
--badge-cancelled-text:#CF222E;
--badge-cancelled-border:rgba(207,34,46,0.3);

--badge-low-stock-bg:  rgba(207,34,46,0.08);
--badge-low-stock-text:#CF222E;
```

---

### 5.2 Variables de método de pago (`--color-cash`, `--color-zelle`, etc.) sin override en light
**Severidad: P1 — Alto**

Análogo al punto 5.1: las variables de color de métodos de pago (`--color-cash: #1D9E75`, `--color-transfer: #3B82F6`, `--color-zelle: #6C2BD9`, `--color-binance: #F0B90B`) se definen **solo en el bloque dark** (`:root`). El tema light las hereda sin ajuste.

`#F0B90B` (Binance/amarillo) sobre un fondo `#EAEEF2` (light surface) tiene contraste < 2:1. El indicador de método de pago Binance resultará invisible en light mode.

---

### 5.3 Colores hardcoded en `DashboardCharts.tsx`
**Severidad: P1 — Alto**

Los componentes Recharts usan colores hardcoded en JSX, no variables CSS:

```tsx
<Line stroke="#2563EB" ... />
<Bar fill="#1D9E75" ... />
<Cell fill={e.color} />   // color viene de la API, sin control CSS
```

En el tema dark, `#2563EB` y `#1D9E75` se ven bien sobre fondos oscuros. En light mode, especialmente para el gráfico de barras (`#1D9E75` verde oscuro sobre fondo blanco), el contraste es aceptable, pero el sistema no es extensible: si se cambia el color de brand en `tokens.css`, los gráficos no lo reflejarán.

**Workaround sin tocar código:** Si se introduce un tercer tema o se ajusta el brand color, los gráficos quedarán desincronizados. Para el Sprint 7 es un riesgo manejable pero debe planificarse.

---

### 5.4 Color WhatsApp hardcoded en `pedidos.module.css`
**Severidad: P2 — Medio**

```css
.waBtn {
  background: rgba(37, 211, 102, 0.12);
  border: 1px solid rgba(37, 211, 102, 0.3);
  color: #25D366;
}
```

`#25D366` es el verde de WhatsApp. Hardcodearlo es intencional por brand identity, pero sobre fondo light (`var(--color-surface-2): #F6F8FA`) el contraste del borde `rgba(37,211,102,0.3)` es muy bajo. El botón puede percibirse como deshabilitado en light mode.

---

### 5.5 Confetti de Onboarding: colores hardcoded en JS
**Severidad: P2 — Medio**

```tsx
const CONFETTI_COLORS = ['#2563EB', '#1D9E75', '#D97706', '#F0B90B', '#F0F6FC']
```

`#F0F6FC` (blanco hueso) es casi invisible en light mode. El confetti incluirá piezas invisibles en el tema claro, reduciendo el impacto visual de la celebración del onboarding.

---

### 5.6 `kpiBs` en caja: usa `--color-warning-text` para valores normales
**Severidad: P3 — Bajo**

```css
/* caja.module.css */
.kpiBs { color: var(--color-warning-text); }
```

Mostrar el valor en Bolívares con color amarillo warning (`#FCD34D` dark / `#B45309` light) implica semánticamente que es una alerta. Un usuario nuevo interpretará el Bs como un dato problemático. Se recomienda usar `--color-bs` (definido como `#8B949E` dark / `#57606A` light) para consistencia con el resto del sistema que usa `--color-bs` específicamente para este propósito.

---

## Hallazgos adicionales notables

### A. `onboarding/page.tsx` usa `localStorage` directamente
```tsx
const [step, setStep] = useState<number>(() => {
  if (typeof window === 'undefined') return 1
  return Number(localStorage.getItem(STORAGE_KEY) ?? '1')
})
```
El acceso a `localStorage` en el inicializador de `useState` no es problemático en un Client Component, pero la guarda `typeof window === 'undefined'` sugiere que en algún momento se intentó renderizar server-side. Esto puede producir hidratación inconsistente si Next.js pre-renderiza el componente. Consideración para Sprint posterior.

### B. `ayuda/page.tsx` — link de WhatsApp con número de ejemplo
```tsx
href="https://wa.me/584121234567"
```
El número de soporte es un placeholder. Esto pasará a producción si no se parametriza desde `configuracion` o una variable de entorno.

### C. Módulo `configuracion/tabs/` no auditado
Los tabs de Configuración (`TabEmpresa`, `TabGeneral`, `TabImpresion`, `TabPagos`, `TabTema`, `TabUsuarios`) no se auditaron en detalle por límite de contexto. Deben revisarse manualmente para detectar touch targets y dark mode en formularios.

---

## Tabla de priorización (para backlog Sprint 8)

| ID | Descripción | Módulos afectados | Severidad | Esfuerzo estimado |
|---|---|---|---|---|
| DES-01 | Tokens badge faltantes en light mode | `tokens.css` | **P0** | 1h |
| DES-02 | Añadir `margin: 0 auto` a todos los `.page` con max-width | 6 módulos | **P1** | 1h |
| DES-03 | Eliminar padding duplicado en páginas con layout wrapper | 5 módulos | **P1** | 45m |
| DES-04 | Touch targets Kanban: `advanceBtn` y `waBtn` a 44px | `pedidos.module.css` | **P1** | 30m |
| DES-05 | Touch targets `periodBtn` a 44px | `DashboardCharts.module.css` | **P1** | 15m |
| DES-06 | Touch targets `abonarBtn`, `newBtn`, `monthInput` a 44px | `finanzas.module.css` | **P1** | 30m |
| DES-07 | Touch targets `pageBtn`, `chatClose`, `chatSendBtn` | `reportes`, `ayuda` | **P1** | 30m |
| DES-08 | Tokens color-cash/zelle/binance en light mode | `tokens.css` | **P1** | 45m |
| DES-09 | Hardcoded colors en Recharts → CSS vars via JS | `DashboardCharts.tsx` | **P1** | 2h |
| DES-10 | Estandarizar font-size de `h1` a `var(--text-2xl)` | 7 módulos | **P1** | 1h |
| DES-11 | Empty state Kanban columnas con ícono y texto | `pedidos/page.tsx` | **P1** | 1h |
| DES-12 | Estandarizar max-width (2 valores: 960 / 1280) | Todos los módulos | **P2** | 2h |
| DES-13 | Unificar `cardTitle` / `sectionTitle` / `chartTitle` en token tipográfico | Todos los módulos | **P2** | 3h |
| DES-14 | Touch targets step dots onboarding (`role="tab"`) | `onboarding.module.css` | **P2** | 15m |
| DES-15 | Confetti color `#F0F6FC` reemplazar con token adaptado | `onboarding/page.tsx` | **P2** | 15m |
| DES-16 | `kpiBs` color semántico: warning → `--color-bs` | `caja.module.css` | **P3** | 10m |
| DES-17 | `kpiValue` de Escritorio: `2rem` → `var(--text-4xl)` | `escritorio.module.css` | **P3** | 5m |
| DES-18 | Parametrizar número WhatsApp soporte | `ayuda/page.tsx` | **P3** | 30m |

**Esfuerzo total estimado:** ~15 horas de desarrollo frontend

---

## Referencias

- `src/styles/tokens.css` — Sistema de tokens v1.0
- `src/app/(dashboard)/layout.module.css` — Shell del dashboard
- WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum) — 4.5:1 para texto normal
- WCAG 2.1 Success Criterion 2.5.5 (Target Size) — 44×44 CSS px mínimo

---
*Generado por auditoría automatizada — no modificar archivos de código. Para aplicar fixes, ver tabla DES-01 a DES-18.*
