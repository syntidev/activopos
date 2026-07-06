# ActivoPOS — Design System v1.0
# Árbitro visual del ecosistema. Leer COMPLETO antes de tocar cualquier archivo CSS o TSX.
# Fecha: 2026-07-05 | Aprobado por: Carlos Bolívar
# Referencia visual: .doc/DESIGN_SYSTEM.html (abrir en browser para ver renderizado)

---

## REGLA MAESTRA

Antes de escribir UNA SOLA línea de CSS o TSX con elementos visuales:
1. Abrir `.doc/DESIGN_SYSTEM.html` en browser — verificar el componente que vas a replicar
2. Leer la sección correspondiente de este documento
3. Usar SOLO los tokens de `src/styles/tokens.css` — PROHIBIDO hardcodear hex
4. Si el token no existe → crearlo en `tokens.css` PRIMERO, luego consumirlo
5. NUNCA duplicar valores entre módulos

---

## 1. LAYOUT — ESTRUCTURA OBLIGATORIA

### Tres zonas irrompibles

```
┌─────────────────────────────────────────────────────────┐
│ ZONA A: SIDEBAR (220px fijo)                            │
│ ZONA B: TOPBAR (48px altura)          [contenido →]     │
│ ZONA C: CONTENIDO (flex:1, overflow-y:auto)             │
└─────────────────────────────────────────────────────────┘
```

### ZONA A — Sidebar
```css
width: 220px;
min-width: 220px;
background: #FAFBFC;           /* var(--sidebar-bg) */
border-right: 1px solid #E5E7EB; /* var(--sidebar-border) */
display: flex;
flex-direction: column;
overflow-y: auto;
```

**Estructura interna obligatoria (de arriba a abajo):**
1. Logo ActivoPOS — sin fondo card, sin sombra, sin borde
2. Toggle "Abrir Caja" — dentro del sidebar, bg #F0FDF4, borde #BBF7D0
3. Secciones de nav con label PRINCIPAL / VENTAS / INVENTARIO / CAJA / FINANZAS / SISTEMA
4. Pie: tasa USD/VES desde RateContext

**Nav item activo:**
```css
background: #DCE6FF;  /* var(--brand-soft) */
color: #0038BD;        /* var(--brand) */
font-weight: 600;
border-right: 2px solid #0038BD; /* var(--brand) */
```

**Nav item hover:**
```css
background: rgba(0, 0, 0, 0.04);
color: #374151;
```

**Label de sección:**
```css
font-size: 10px;
color: #9CA3AF;
font-weight: 700;
letter-spacing: 0.8px;
text-transform: uppercase;
padding: 10px 16px 4px;
```

**PROHIBIDO en sidebar:**
- box-shadow externo
- border distinto a border-right: 1px solid #E5E7EB
- background distinto a #FAFBFC
- Cualquier tema de color — sidebar SIEMPRE blanco independiente del tema

### ZONA B — Topbar
```css
height: 48px;
background: #FFFFFF;
border-bottom: 1px solid #E5E7EB;
display: flex;
align-items: center;
padding: 0 20px;
gap: 12px;
flex-shrink: 0;
```

**Contenido del topbar (de izquierda a derecha):**
1. Toggle sidebar móvil (hamburguesa)
2. Nombre del módulo actual — font-size: 15px, font-weight: 600
3. [espacio flex]
4. Pill USD/VES — bg #FEF3C7, border #FDE68A, text #92400E
5. Pill Caja — bg #DCFCE7, border #BBF7D0, text #15803D
6. Ícono campana
7. Ícono dark mode
8. Nombre usuario
9. Badge Super Admin (solo si aplica) — color #0038BD

**PROHIBIDO en topbar:**
- Botones de acción (Nueva venta, Agregar gasto, etc.) — esos van en el área de contenido
- Altura distinta a 48px

### ZONA C — Contenido
```css
flex: 1;
overflow-y: auto;
padding: 20px 24px;
background: #EEEDF4;  /* var(--bg-base) */
```

**Ancho máximo del contenido:**
```css
max-width: 1280px;
margin: 0 auto;
width: 100%;
```

---

## 2. GRIDS — ESTÁNDAR POR MÓDULO

| Módulo | Grid | Columnas |
|--------|------|----------|
| Escritorio KPIs | asimétrico | 1.5fr 1fr 1fr |
| Escritorio fila 2 | simétrico | 1fr 1fr 1fr |
| Escritorio fila 3 | simétrico | 1fr 1fr |
| Finanzas | simétrico | 1fr 1fr |
| Productos lista | 4 columnas | repeat(4, 1fr) |
| Historial / Inventario | tabla full | width: 100%, table-layout: fixed |
| Configuración | panel + contenido | 240px 1fr |

**PROHIBIDO:**
- Tablas con width: 800px hardcodeado
- Tablas con width: 1000px hardcodeado
- Cualquier ancho fijo distinto a los definidos arriba
- overflow-x sin scroll wrapper explícito

---

## 3. CARDS — 6 TIPOS, CADA UNO CON SU FUNCIÓN

### Base común a TODAS las cards
```css
background: #FFFFFF;
border-radius: 16px;
box-shadow: 0 2px 8px rgba(47,43,61,0.10), 0 0 1px rgba(47,43,61,0.06);
border: none;
```

### Tipo A — KPI con ícono circular (módulos generales)
```css
padding: 14px 18px;
display: flex;
align-items: center;
gap: 14px;
transition: transform 0.15s;
```
```css
/* hover */
transform: translateY(-1px);
box-shadow: 0 4px 14px rgba(47,43,61,.12);
```
**Ícono:** círculo 40-46px, border-radius: 50%, color semántico según métrica
**Label:** font-size: 10px, color: #9CA3AF, uppercase, letter-spacing: 0.5px
**Valor:** font-size: 20-22px, font-weight: 700, color: #0F172A
**Sub:** font-size: 10px, color: #9CA3AF

**Colores de ícono por métrica (irrompible):**
```
cobrado/ingresos → bg #DCFCE7, icon color #16A34A
crédito/pendiente → bg #FEF3C7, icon color #D97706
tickets/órdenes → bg #DBEAFE, icon color #2563EB
utilidad/margen → bg #F3E8FF, icon color #9333EA
gastos/costos → bg #FEE2E2, icon color #EF4444
```

### Tipo B — KPI Hero (métrica principal del módulo)
```css
background: #0038BD;  /* var(--brand) */
border-radius: 16px;
box-shadow: 0 4px 16px rgba(0,56,189,0.30);
padding: 18px 22px;
display: flex;
flex-direction: column;
gap: 6px;
```
**Label:** font-size: 10px, color: rgba(255,255,255,0.6), uppercase
**Valor:** font-size: 28-32px, font-weight: 800, color: #FFFFFF
**Sub (Bs):** font-size: 11px, color: rgba(255,255,255,0.55)
**Delta chip:** bg rgba(255,255,255,0.2), color: #FFFFFF

### Tipo C — Card colored background (alerta / estado crítico)
```css
/* Alerta inventario */
background: #FEF3C7;
border-radius: 16px;
padding: 14px 18px;
box-shadow: none;
```
**REGLA:** el color de fondo comunica urgencia. Solo 3 colores permitidos:
- Amarillo #FEF3C7 → alerta / stock bajo / pendiente
- Rojo #FEE2E2 → crítico / vencido / pérdida
- Verde #DCFCE7 → positivo / completado / activo

### Tipo D — Panel con tabla (rankings, CxP, CxC, top productos)
```css
padding: 0;
overflow: hidden;
```
**Header del panel:**
```css
display: flex;
align-items: center;
justify-content: space-between;
padding: 12px 18px;
border-bottom: 1px solid #F9FAFB;
border-left: 3px solid #0038BD;  /* acento brand */
padding-left: 15px;
```
**Link "Ver más":** font-size: 11px, color: #0038BD, sin subrayado

### Tipo E — Movimiento / transacción (row con estado)
```css
/* Row individual */
display: flex;
align-items: center;
gap: 10px;
padding: 7px 0;
border-bottom: 1px solid #F9FAFB;
```
**Ícono de método de pago:** 32px × 32px, border-radius: 8px, color semántico
**Nombre:** font-size: 12px, font-weight: 500
**Subtítulo (tiempo · método):** font-size: 10px, color: #9CA3AF
**Monto:** font-size: 12-13px, font-weight: 700, color semántico
**Badge estado:** pill redondeado, font-size: 9px

**Colores por método de pago:**
```
Pago Móvil → bg #DCFCE7, icon color #16A34A
Zelle → bg #DBEAFE, icon color #2563EB
Binance / USDT → bg #FEF3C7, icon color #F59E0B
Efectivo → bg #F3E8FF, icon color #9333EA
Efectivo USD → bg #DCFCE7, icon color #16A34A
Débito → bg #F1F5F9, icon color #6B7280
```

### Tipo F — Métricas por módulo (war room)
```css
padding: 14px 16px;
```
**Header:** ícono 28×28 con border-radius: 7px + título módulo + subtítulo período
**Métricas:** rows con label izquierda / valor derecha, border-bottom: 1px solid #F9FAFB

---

## 4. DUAL CURRENCY — REGLA ABSOLUTA

**Todo valor monetario muestra USD Y Bs simultáneamente. Sin toggle. Sin excepción.**

```
Formato obligatorio en cards KPI:
  Línea 1: $1,190.50          ← USD, font-weight: 700, color: #0F172A
  Línea 2: Bs 56,967          ← Bs, font-size: 10-11px, color: #9CA3AF

Formato en tablas:
  Columna USD | Columna Bs    ← dos columnas separadas, nunca una sola

Formato en rows de transacción:
  $12.40 · Bs 593             ← inline separado por ·
```

**La tasa siempre proviene de RateContext — NUNCA calculada localmente.**

---

## 5. PALETA FUNCIONAL — COLOR ENCODES MEANING

### Brand
```css
--brand:        #0038BD;  /* nav activa, botón primario, hero card, barras */
--brand-light:  #4D7AFF;  /* hover states, links secundarios */
--brand-dark:   #002FA0;  /* hover del botón primario */
--brand-darker: #001D7A;  /* activo presionado */
--brand-soft:   #DCE6FF;  /* fondo nav activa, fondo tab activo, chips */
```

### CTA (uso exclusivo)
```css
--cta:        #EF8E01;  /* SOLO: Procesar Pago, Declarar Cierre, Ir al POS */
--cta-hover:  #D97900;
--cta-active: #B56700;
```
**REGLA:** máximo UN botón CTA carrot por pantalla. Si hay dos acciones importantes,
la secundaria usa --brand, no --cta.

### Semántico
```css
--success:     #16A34A;  --success-bg: #DCFCE7;
--danger:      #EF4444;  --danger-bg:  #FEE2E2;
--warning:     #F59E0B;  --warning-bg: #FEF3C7;
--info:        #2563EB;  --info-bg:    #DBEAFE;
--purple:      #9333EA;  --purple-bg:  #F3E8FF;
```

### Superficie (3 niveles)
```css
--bg-base:     #EEEDF4;  /* fondo de página */
--sidebar-bg:  #FAFBFC;  /* sidebar */
--card-bg:     #FFFFFF;  /* cards */
```

---

## 6. TIPOGRAFÍA

```css
/* Valores KPI principal */
font-size: 24-32px; font-weight: 800; color: #0F172A;

/* Valores KPI secundario */
font-size: 18-22px; font-weight: 700; color: #0F172A;

/* Label de métrica */
font-size: 10px; font-weight: 600; color: #9CA3AF;
text-transform: uppercase; letter-spacing: 0.5px;

/* Texto de tabla */
font-size: 13px; color: #374151;

/* Texto secundario / subtítulo */
font-size: 11-12px; color: #6B7280;

/* Texto muted / tiempo */
font-size: 10px; color: #9CA3AF;

/* Título de sección */
font-size: 13px; font-weight: 600; color: #0F172A;

/* Label de nav sección */
font-size: 10px; font-weight: 700; color: #9CA3AF;
text-transform: uppercase; letter-spacing: 0.8px;
```

---

## 7. BADGES Y ESTADOS

```css
/* Base */
font-size: 9-10px; font-weight: 600;
padding: 2px 8px; border-radius: 20px;

/* Pagado */      background: #DCFCE7; color: #15803D;
/* Crédito */     background: #FEF3C7; color: #92400E;
/* Vencido */     background: #FEE2E2; color: #B91C1C;
/* Pendiente */   background: #DBEAFE; color: #1D4ED8;
/* Cotización */  background: #F3E8FF; color: #7E22CE;
/* Activo */      background: #DCFCE7; color: #15803D;
/* Inactivo */    background: #F1F5F9; color: #6B7280;
/* Sin stock */   background: #FEE2E2; color: #B91C1C;
/* Stock bajo */  background: #FEF3C7; color: #92400E;
/* En stock */    background: #DCFCE7; color: #15803D;
/* PRO */         background: #0038BD; color: #FFFFFF;
```

---

## 8. BOTONES — JERARQUÍA VISUAL

### Primario (acción principal del módulo)
```css
background: #0038BD; color: #FFFFFF;
padding: 8px 16px; border-radius: 8px; border: none;
font-size: 13px; font-weight: 600;
/* hover */ background: #002FA0;
```

### CTA (cobro / cierre — UN solo por pantalla)
```css
background: #EF8E01; color: #FFFFFF;
padding: 8px 16px; border-radius: 8px; border: none;
font-size: 13px; font-weight: 700;
/* hover */ background: #D97900;
```

### Secundario
```css
background: #FFFFFF; color: #374151;
padding: 8px 14px; border-radius: 8px;
border: 1px solid #E5E7EB;
font-size: 13px; font-weight: 500;
/* hover */ background: #F8FAFC;
```

### Peligroso (destructivo)
```css
background: #FFFFFF; color: #EF4444;
border: 1px solid #EF4444;
padding: 8px 14px; border-radius: 8px;
font-size: 13px; font-weight: 600;
```

---

## 9. TABS DE PERÍODO

```css
/* Tab inactivo */
padding: 5px 14px; border-radius: 20px;
background: transparent; border: none;
font-size: 12px; color: #6B7280; font-weight: 500;
cursor: pointer;
/* hover */ background: #F3F4F6;

/* Tab activo */
background: #DCE6FF;  /* var(--brand-soft) */
color: #0038BD;        /* var(--brand) */
font-weight: 600;
```

**PROHIBIDO:** fondo sólido oscuro (#0038BD o similar) en tab activo.

---

## 10. ACCIÓN RÁPIDA — ÁREA DE CONTENIDO

**Los botones de acción del módulo NO van en el topbar.**
**Van en el área de contenido, debajo del saludo / título de página.**

```
[+ Nueva venta] [Gasto] [Compra]    ← fila de acciones
```

Estructura:
```css
display: flex;
gap: 8px;
margin-bottom: 16px;
```

---

## 11. RESPONSIVE

```css
/* Desktop (>1024px): layout completo */
.sidebar { display: flex; width: 220px; }

/* Tablet (768-1024px): sidebar colapsado */
.sidebar { width: 56px; }
.nav-item span { display: none; }
.nav-label { display: none; }

/* Mobile (<768px): sidebar oculto, topbar con hamburguesa */
.sidebar { display: none; }
/* Grid 2 columnas → 1 columna */
/* KPI hero → full width */
/* Padding: 12px en lugar de 24px */
```

---

## 12. PROHIBICIONES ABSOLUTAS (no negociables)

- PROHIBIDO `width: 800px` o `width: 1000px` hardcodeado en tablas o contenedores
- PROHIBIDO inline styles — todo CSS va en CSS Modules
- PROHIBIDO valores hex hardcodeados fuera de `tokens.css`
- PROHIBIDO `any` en TypeScript
- PROHIBIDO Tailwind, Preline, Bootstrap — solo CSS Modules
- PROHIBIDO crear componente nuevo cuando existe uno modificable
- PROHIBIDO `overflow: hidden` en el contenedor raíz — rompe el scroll
- PROHIBIDO `position: fixed` dentro de módulos — usa el layout existente
- PROHIBIDO mostrar valor monetario sin su par (USD sin Bs o Bs sin USD)
- PROHIBIDO tab activo con fondo sólido oscuro — usar brand-soft siempre
- PROHIBIDO sidebar con tema de color — siempre #FAFBFC

---

## REFERENCIA VISUAL

Archivo: `.doc/DESIGN_SYSTEM.html`
Abrir en browser para ver TODOS los componentes renderizados.
Este documento `.md` y ese `.html` son la misma verdad — complementarios.

---

*ActivoPOS · SYNTIdev · Design System v1.0*
*Generado: 2026-07-05 | Aprobado: Carlos Bolívar*
*Próxima revisión: cuando se agregue un módulo nuevo o se apruebe cambio visual*
