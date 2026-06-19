# HANDOFF — Sprint 9 → Sprint 10
# ActivoPOS | 18 Junio 2026
# Estado: en progreso

---

## PRIMERA ACCIÓN AL ABRIR SESIÓN

```powershell
# Local
Remove-Item -Recurse -Force .next
npm run dev
curl http://localhost:3000/api/rates/bcv
```

```bash
# VPS (solo si es necesario)
cd /var/www/activopos
git pull origin main
npx prisma migrate deploy
rm -rf .next && npm run build
pm2 restart activopos
```

---

## QUÉ SE COMPLETÓ EN SPRINT 9

- ✅ Categorías sincronizadas entre Productos y Catálogo
- ✅ Dual moneda en todos los endpoints (USD + Bs)
- ✅ Hero catálogo: banner + logo circular + nav sticky
- ✅ Carrito catálogo + checkout WhatsApp + pedido en Kanban
- ✅ Badges en productos: Popular/Nuevo/Promo/Recomendado
- ✅ Subcategorías en productos
- ✅ "Tu Día" — narrativa de cierre de jornada
- ✅ CajaToggle en header
- ✅ Modal base corregido (Radix UI fix)
- ✅ A+C glow aplicado en todos los módulos
- ✅ RACE-001 y RACE-002 caja mejorados
- ✅ CLAUDE.md v2.0 con principios Karpathy

---

## PENDIENTE DE SPRINT 9 (CERRAR PRIMERO)

| Tarea | CLI | Estado |
|---|---|---|
| Tema login siempre dark (fachada ActivoPOS) | CLI-B | ⏳ Corriendo |
| POS flujo cobro verificado E2E | CLI-D | ❌ Pendiente |

---

## SPRINT 10 — ROADMAP ORDENADO

### PRIORIDAD 1 — Certificación del núcleo (no avanzar sin esto)

**Objetivo:** El flujo inventario → venta → cuadre de caja funciona como un reloj.

```
MÓDULO 1: Productos
[ ] Categorías: crear, editar, eliminar desde UI (no solo seed)
[ ] Producto: CRUD completo verificado con datos reales
[ ] Variantes: tallas y colores funcionan en POS
[ ] Imágenes: upload WebP funciona end-to-end

MÓDULO 2: POS — flujo completo
[ ] Buscar producto → agregar → ticket correcto
[ ] Cobrar en efectivo → stock descuenta → sale.status='paid'
[ ] Cobrar en Pago Móvil → mismo flujo
[ ] Multi-ticket paralelo (pestañas en POS)
[ ] Recientes en POS (últimos 8 productos vendidos)

MÓDULO 3: Caja
[ ] Apertura con monto inicial → registrado en DB
[ ] Ventas suman correctamente al turno
[ ] Cierre → cuadre exacto sin fuga
[ ] Historial de turnos con detalle

MÓDULO 4: Reportes
[ ] Reporte del día: ventas, productos, métodos de pago
[ ] Exportar PDF con dual moneda
[ ] Exportar Excel (como Fina)
[ ] Reporte del mes automático
```

### PRIORIDAD 2 — Deuda técnica crítica

```
[ ] DT-001: dollarRate con business_id
[ ] DT-002: sold_at NOT NULL en Sale
[ ] DT-003: SaleAbono con cash_register_id
[ ] DT-004: Service Worker PWA
```

### PRIORIDAD 3 — Features de valor

```
[ ] Banner PWA instalación (como Venko)
[ ] Temas por segmento server-side (10 colores)
[ ] Grid inventario con imagen visible directo
[ ] CRM cliente: historial, frecuencia, ticket promedio
[ ] Onboarding: primer negocio activa sin tocar código
[ ] Admin panel multitenant (Opus — sesión aislada)
```

---

## METODOLOGÍA DE CERTIFICACIÓN

Antes de marcar un módulo como ✅ certificado:

1. **Inyectar datos reales** con seed o manualmente
2. **Ejecutar el flujo completo** — no partes aisladas
3. **Verificar en DB** que los registros son correctos
4. **CLI-D corre Playwright** sobre el flujo
5. **CLI-C audita** seguridad del módulo
6. **Carlos aprueba** visualmente

Solo después de estos 6 pasos el módulo se marca certificado.

---

## REGLA DEL POLICÍA — NO NEGOCIABLE

**Ningún agente avanza al siguiente módulo sin certificar el anterior.**

Si el POS no está certificado, no se toca el catálogo.
Si la caja no cuadra, no se construyen reportes.
Si los reportes no son exactos, no se construye analytics.

El orden es:
```
Productos → POS → Caja → Reportes → Finanzas → Catálogo → Analytics
```

Cada módulo tiene criterio de éxito medible antes de empezar.
Criterios débiles ("que funcione") = no certificado.

---

## DOCUMENTOS DEL PROYECTO

| Documento | Ubicación | Propósito |
|---|---|---|
| CLAUDE.md | `/` y `/.doc/` | Gobernanza y reglas — leer siempre primero |
| AGENTS.md | `/.doc/` | Protocolo multi-agente |
| SYSTEM_MAP.md | `/.doc/` | Estado real del sistema |
| ACTIVOPOS_MASTER.md | Base de conocimiento | Árbitro de verdad, roadmap, decisiones |
| DB_SCHEMA.md | `/.doc/` | Modelo de datos canónico |
| DESIGN_SYSTEM.md | `/.doc/` | Sistema visual, tokens |
| QUALITY_REPORT_Sprint*.md | `/.doc/` | Hallazgos de calidad |

