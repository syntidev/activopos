# DESIGN_SYSTEM.md — ActivoPOS
# Sistema de diseño, tokens y principios visuales
# Versión: 1.0 | Junio 2026

---

## FILOSOFÍA

ActivoPOS se ve como Venko en escala y respira como SportBar en energía.
**Más comercial que SportBar. Más vivo que Venko.**

- Plano y limpio — sin glassmorphism, sin gradientes decorativos
- Legible en un local con luz de bodega o en un estadio
- El cajero tiene 3 segundos — cada acción crítica visible sin scroll
- Touch targets mínimo 44px — funciona en tablet con dedos
- Dark/Light: el negocio elige — ninguno es más importante

---

## TOKENS CSS

### `src/styles/tokens.css`

```css
:root {
  /* ── Tipografía ── */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* ── Escalas de fuente ── */
  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.125rem;  /* 18px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  1.875rem;  /* 30px */
  --text-4xl:  2.25rem;   /* 36px */

  /* ── Pesos ── */
  --font-normal:  400;
  --font-medium:  500;
  --font-semibold: 600;
  --font-bold:    700;

  /* ── Espaciado (escala 4px) ── */
  --space-1:  0.25rem;  /* 4px  */
  --space-2:  0.5rem;   /* 8px  */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* ── Radios ── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* ── Transiciones ── */
  --transition-fast:   150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow:   300ms ease;

  /* ── Sidebar ── */
  --sidebar-width: 220px;
  --sidebar-collapsed: 60px;

  /* ── Touch target mínimo ── */
  --touch-min: 44px;
}
```

### `src/styles/themes/dark.css`

```css
.dark, [data-theme="dark"] {
  /* Fondos */
  --color-bg:          #0D1117;
  --color-surface:     #161B22;
  --color-surface-2:   #1C2128;
  --color-surface-3:   #21262D;

  /* Marca */
  --color-brand:       #2563EB;
  --color-brand-light: #3B82F6;
  --color-brand-dark:  #1D4ED8;

  /* Texto */
  --color-text-primary:   #F0F6FC;
  --color-text-secondary: #8B949E;
  --color-text-muted:     #484F58;

  /* Bordes */
  --color-border:       #30363D;
  --color-border-light: #21262D;

  /* Estados */
  --color-success:      #1D9E75;
  --color-success-bg:   rgba(29, 158, 117, 0.1);
  --color-warning:      #D97706;
  --color-warning-bg:   rgba(217, 119, 6, 0.1);
  --color-danger:       #EF4444;
  --color-danger-bg:    rgba(239, 68, 68, 0.1);
  --color-info:         #3B82F6;
  --color-info-bg:      rgba(59, 130, 246, 0.1);

  /* Sidebar */
  --sidebar-bg:         #0D1117;
  --sidebar-text:       #8B949E;
  --sidebar-text-active:#F0F6FC;
  --sidebar-item-hover: rgba(255,255,255,0.05);
  --sidebar-item-active:rgba(37, 99, 235, 0.15);
  --sidebar-accent:     #2563EB;

  /* POS */
  --pos-card-bg:        #161B22;
  --pos-card-hover:     #1C2128;
  --pos-ticket-bg:      #0D1117;

  /* KPI cards */
  --kpi-bg:            #161B22;
  --kpi-border:        #30363D;

  /* Moneda */
  --color-usd:         #F0F6FC;
  --color-bs:          #8B949E;
  --color-rate:        #1D9E75;
}
```

### `src/styles/themes/light.css`

```css
.light, [data-theme="light"] {
  /* Fondos */
  --color-bg:          #F6F8FA;
  --color-surface:     #FFFFFF;
  --color-surface-2:   #F6F8FA;
  --color-surface-3:   #EAEEF2;

  /* Marca */
  --color-brand:       #2563EB;
  --color-brand-light: #3B82F6;
  --color-brand-dark:  #1D4ED8;

  /* Texto */
  --color-text-primary:   #1C2128;
  --color-text-secondary: #57606A;
  --color-text-muted:     #8C959F;

  /* Bordes */
  --color-border:       #D0D7DE;
  --color-border-light: #EAEEF2;

  /* Estados */
  --color-success:      #1A7F64;
  --color-success-bg:   rgba(26, 127, 100, 0.1);
  --color-warning:      #B45309;
  --color-warning-bg:   rgba(180, 83, 9, 0.1);
  --color-danger:       #CF222E;
  --color-danger-bg:    rgba(207, 34, 46, 0.1);
  --color-info:         #2563EB;
  --color-info-bg:      rgba(37, 99, 235, 0.1);

  /* Sidebar */
  --sidebar-bg:         #1C2128;    /* sidebar siempre oscuro en light mode */
  --sidebar-text:       #8B949E;
  --sidebar-text-active:#F0F6FC;
  --sidebar-item-hover: rgba(255,255,255,0.05);
  --sidebar-item-active:rgba(37, 99, 235, 0.2);
  --sidebar-accent:     #3B82F6;

  /* POS */
  --pos-card-bg:        #FFFFFF;
  --pos-card-hover:     #F6F8FA;
  --pos-ticket-bg:      #F6F8FA;

  /* KPI cards */
  --kpi-bg:            #FFFFFF;
  --kpi-border:        #D0D7DE;

  /* Moneda */
  --color-usd:         #1C2128;
  --color-bs:          #57606A;
  --color-rate:        #1A7F64;
}
```

---

## SIDEBAR

### Estructura de navegación

```
┌─────────────────────┐
│  Activo●POS  [logo] │
├─────────────────────┤
│  PRINCIPAL          │
│  ▶ Escritorio       │← activo
├─────────────────────┤
│  VENTAS             │
│    Punto de Venta   │
│    Cotizaciones     │
│    Clientes         │
├─────────────────────┤
│  INVENTARIO         │
│    Productos        │
│    Devoluciones     │
├─────────────────────┤
│  CAJA               │
│    Gestión de Caja  │
│    Reportes         │
├─────────────────────┤
│  FINANZAS           │
│    Finanzas         │
├─────────────────────┤
│  ─────────────────  │
│  ADMINISTRACIÓN     │
│    Usuarios         │
│    Configuración    │
│    Ayuda            │
├─────────────────────┤
│  USD/VES 36.50 Bs   │← tasa BCV
│  [↪ Salir]          │
└─────────────────────┘
```

### Grupos y permisos

| Grupo          | Ítems                           | Roles que ven         |
|----------------|---------------------------------|-----------------------|
| PRINCIPAL      | Escritorio                      | admin, cashier        |
| VENTAS         | POS, Cotizaciones, Clientes     | admin, cashier        |
| INVENTARIO     | Productos, Devoluciones         | admin, cashier*       |
| CAJA           | Gestión de Caja, Reportes       | admin, cashier        |
| FINANZAS       | Finanzas                        | admin only            |
| ADMINISTRACIÓN | Usuarios, Configuración, Ayuda  | admin only            |

*cashier ve Productos pero sin columna de costos ni margen

---

## COMPONENTES UI

### Button

```typescript
// Variantes: primary | secondary | ghost | danger | success
// Tamaños: sm | md | lg
// Estado: loading (spinner) | disabled

<Button variant="primary" size="md" loading={false}>
  Guardar
</Button>
```

### Badge

```typescript
// Variantes: success | warning | danger | info | neutral
// Usos: estado de venta, estado de stock, rol de usuario

<Badge variant="success">Pagado</Badge>
<Badge variant="warning">Pendiente</Badge>
<Badge variant="danger">Anulado</Badge>
```

### KpiCard

```typescript
// Componente para métricas del dashboard y caja

<KpiCard
  label="Ventas Hoy"
  value="$142.50"
  subvalue="Bs. 5,204.25"
  trend="+12%"
  trendDirection="up"
  icon={<TrendingUp />}
/>
```

---

## TIPOGRAFÍA

- **Fuente:** Inter — `next/font/google`
- **Tamaño base:** 16px
- **Escala:** 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36

### Uso por contexto

| Elemento           | Tamaño    | Peso     |
|--------------------|-----------|----------|
| Título de página   | 24px      | 600      |
| Subtítulo          | 18px      | 500      |
| Labels de sidebar  | 13px      | 500      |
| Texto de tabla     | 14px      | 400      |
| KPI principal      | 28-36px   | 700      |
| KPI secundario     | 14px      | 400      |
| Precio en POS      | 16px      | 600      |
| Total de ticket    | 24px      | 700      |
| Grupo sidebar      | 11px      | 600      uppercase |

---

## ICONOS

**Solo Lucide React.** Nunca emojis en UI.

### Mapa de iconos por módulo

| Módulo          | Icono Lucide          |
|-----------------|-----------------------|
| Escritorio      | LayoutDashboard       |
| Punto de Venta  | ShoppingCart          |
| Cotizaciones    | FileText              |
| Clientes        | Users                 |
| Productos       | Package               |
| Devoluciones    | RotateCcw             |
| Gestión de Caja | Calculator            |
| Reportes        | BarChart2             |
| Finanzas        | TrendingUp            |
| Usuarios        | UserCog               |
| Configuración   | Settings              |
| Ayuda           | HelpCircle            |
| Tasa BCV        | DollarSign            |
| Salir           | LogOut                |

---

## ANIMACIONES

- **Librería:** Framer Motion 12.x
- **Principio:** Emil Kowalski — polish invisible, animaciones naturales
- **Máximo:** 300ms — nunca más largo para UI operativa
- **Reduced motion:** siempre respetar `prefers-reduced-motion`

### Patrones estándar

```typescript
// Entrada de página
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' }
}

// Entrada de card/ítem de lista
const itemVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.15 }
}

// Modal
const modalVariants = {
  initial: { opacity: 0, scale: 0.96, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit:    { opacity: 0, scale: 0.96, y: 4 },
  transition: { duration: 0.2 }
}
```

---

## REGLAS VISUALES IRROMPIBLES

1. **Acción primaria del POS siempre visible sin scroll**
2. **Total de caja y total del ticket en tipografía grande, color de acento**
3. **Tasa BCV siempre visible en sidebar**
4. **Touch targets ≥ 44px — especialmente en POS y Caja**
5. **Estados vacíos siempre orientativos — nunca dejar pantalla en blanco**
6. **Feedback inmediato en toda acción: loading state, success toast, error message**
7. **Sidebar siempre oscuro — tanto en dark como en light mode**
8. **Sin colores hardcodeados en componentes — solo variables CSS**
