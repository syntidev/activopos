# HANDOFF Sprint 30 — ActivoPOS
## Para el próximo agente — Leer TODO antes de tocar una línea

---

## 0. IDENTIDAD DEL PROYECTO

**ActivoPOS** — POS SaaS venezolano para PYMEs.
- **Stack SELLADO:** Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB
- **NO es:** Laravel, Tailwind, MySQL genérico, Preline
- **Local:** `C:\laragon\www\activopos` (Windows 11 + PowerShell + Laragon)
- **VPS:** `187.124.241.213` | Puerto: `3003` | PM2 proceso id=9 (cluster mode)
- **Repo:** `syntidev/activopos` | Rama: `main`
- **Producción:** activopos.com
- **DB:** `mysql://root@127.0.0.1:3306/activopos` (root con mysql_native_password sin contraseña)
- **Credenciales admin:** `admin@activopos.com` / `Admin2026!`

---

## 1. PALETA Y BRANDING SELLADOS

```css
--brand:   #0038BD  /* Persian Blue — primario */
--brand-l: #4D7AFF
--brand-d: #002FA0
--cta:     #EF8E01  /* Carrot ámbar — CTAs */
--navy:    #0D1B2E  /* fondos oscuros */
```

**Tipografía:** Fraunces (display/headings) + DM Sans (body)

**Logo:** `/public/logo.svg` — triángulo azul/naranja diagonal

**Nombre de marca:**
```jsx
<span style={{ color: 'var(--text-primary)' }}>Activo</span>
<span style={{ color: 'var(--brand)' }}>POS</span>
```
Sin punto. Sin separador. Sin guión. Fraunces bold. Siempre junto al logo.

**Posicionamiento:**
"ActivoPOS es tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa."

**Slogan:** "El POS para negocios que andan activos."

---

## 2. REGLAS CRÍTICAS (irrompibles)

- TypeScript strict — cero `any`
- CSS Modules únicamente — cero Tailwind, cero inline styles
- `business_id` siempre desde `getSession()` — nunca del body
- Todo precio muestra USD Y Bs simultáneamente
- Venta: `qty × price` — NUNCA `monto → qty`
- Stock descuenta SOLO cuando `status='paid'`
- Sidebar siempre oscuro — independiente del tema
- Login siempre dark navy
- NUNCA tocar syntimeat ni sportbar en producción
- Scanner en VPS: NUNCA `rm -rf .next` antes de confirmar build exitoso
- Deploy seguro: `npm run build && pm2 restart activopos` (sin borrar .next antes)

---

## 3. COMANDOS ESENCIALES

**Local (PowerShell):**
```powershell
.\commit.ps1 "mensaje"    # commit + push
.\r.ps1                   # reset dev
npm run dev               # desarrollo local
```

**VPS (SSH):**
```bash
git fetch origin
git merge origin/main --no-ff -m "merge: descripción"
npm install               # si hay paquetes nuevos
npm run build && pm2 restart activopos
```

**Prisma VPS:**
```bash
npx prisma generate && npx prisma db push
# NO usar migrate dev en VPS — usar db push
```

---

## 4. PROTOCOLO MULTI-AGENTE

```
CLI-A → Backend: APIs, Prisma, lógica de negocio
CLI-B → Frontend: componentes, CSS Modules
CLI-C → Calidad: auditoría, seguridad, fixes P0
CLI-D → Tests/docs/deploy
Claude Web → Arquitecto — arbitra y coordina
```

**REGLA CRÍTICA DEL PRÓXIMO AGENTE:**
Ningún feature se marca como cerrado sin verificación visual de Carlos.
"Commiteado" ≠ "funciona y se ve". Exigir captura de pantalla antes de avanzar.

---

## 5. ESTADO ACTUAL DEL SISTEMA (Sprint 30)

### Módulos operativos — 18 total
| Módulo | Estado |
|--------|--------|
| Escritorio/Dashboard | ✅ KPIs reales + gráficos |
| POS / Punto de Venta | ✅ Multi-ticket + cobro + crédito |
| Pedidos (Kanban) | ✅ Timer MM:SS + badges urgencia |
| Clientes | ✅ Historial compras + CxC |
| Productos | ✅ Variantes tallas + toggle activo |
| Inventario | ✅ KPIs + estados OK/BAJO/AGOTADO |
| Ventas del Día | ✅ Historial tickets + anular |
| Gestión de Caja | ✅ Abrir/cerrar + movimientos |
| Reportes (4 tabs) | ✅ Ventas/Inventario/Cierres/Reporte Día |
| Finanzas | ✅ CxC + gastos + gráficos |
| Catálogo Digital | ✅ Con pedidos online |
| Cotizaciones | ✅ (convertir a venta — fix Sprint 30) |
| Devoluciones | ✅ (status returned — fix Sprint 30) |
| KDS | ✅ Timer + urgencia + sonido |
| Configuración | ✅ Tab Cobros nuevo |
| Usuarios | ✅ |
| Ayuda + Bot | ✅ Fallback local actualizado |
| Onboarding wizard | ✅ (mismatch fix Sprint 30) |

### CIMAAD (test E2E)
**7/7 pasando** en VPS. Archivo: `tests/auditoria-ciclo-real.spec.ts`

---

## 6. LO QUE SE COMPLETÓ EN SPRINT 30

1. **Fixes conectividad** (CLI-C auditó, CLI-A aplicó):
   - Cotizaciones: "Convertir a venta" → POST correcto
   - Devoluciones: `sale.status = 'returned'`
   - Notificaciones: PATCH + POST en read-all
   - Onboarding: mismatch key/done/progress_pct resuelto
   - Categorías: error al crear → fix P2002 → 409
   - Fotos: magic-byte validation + uploadLimiter

2. **Scanner migrado a Quagga2** (`@ericblade/quagga2`):
   - `@zxing/browser` desinstalado completamente
   - `src/hooks/useScanner.ts` reescrito con Quagga2
   - Dynamic import para SSR-safe en Next.js
   - `halfSample: false` + `patchSize: 'large'` + sin constraints de resolución
   - El dispositivo usa resolución nativa completa

3. **Módulo Cobros** (UI completa, backend parcial):
   - Tab "Cobros" en Configuración
   - Sección 1: Medios de pago con drag & drop
   - Sección 2: Dispositivos físicos con 27 bancos venezolanos
   - Sección 3: Datos para Cobrar (Pago Móvil/Zelle/Zinli/PayPal/Binance/USDT)
   - Preview WhatsApp en tiempo real
   - **PENDIENTE:** Endpoints backend GET/PATCH cobros/data + CRUD devices

4. **Finanzas: Gastos UI** (CLI-B entregó):
   - GastosSection con tabla completa
   - GastoModal con tipo Fijo/Variable + recurrente + due_date
   - Banner alerta en Escritorio si gastos vencen en 5 días
   - **PENDIENTE:** Endpoints backend `/api/gastos` CRUD + alerts

5. **inputMode numérico** aplicado en:
   - CobroModal, DescuentoModal, CargoModal, CreditoModal
   - Caja (apertura/cierre/movimientos)
   - ProductModal (precio, costo, stock mínimo)

6. **Dual Brand Header**:
   - Desktop: logo negocio cliente + nombre a la izquierda
   - Mobile: solo logo ActivoPOS en header

7. **Módulo Suscripción/Plan** (UI):
   - TabPlan.tsx en Configuración
   - Crown + nombre plan + fecha vencimiento + días
   - Badge Activo/Vence pronto/Vencido

8. **KDS mejorado** (patrón SportBar):
   - Timer MM:SS independiente del polling
   - Badges: normal/overflow(45min)/emergency(90min)
   - Sonido al llegar pedido nuevo (`playBeep`)
   - `src/lib/audio.ts` extraído y compartido

9. **Búsqueda híbrida** (CLI-C):
   - `api/products`: OR [name, sku, barcode]
   - Inventario: filtro name+sku+barcode
   - Ventas: ticket+cliente+método
   - Clientes: nombre+teléfono+cédula

---

## 7. PENDIENTES CRÍTICOS (ejecutar en orden)

### P0 — Scanner en barra de búsqueda (NO IMPLEMENTADO VISUALMENTE)

**El problema más urgente.** Carlos lo pidió múltiples veces.
El botón de scanner NO es visible en Inventario ni Productos.

**Lo que debe verse:**
```
[🔍 Buscar por nombre, SKU o código...] [📷]
```

El ícono `ScanBarcode` de Lucide debe estar AL LADO del input,
VISIBLE siempre (mobile Y desktop), conectado a `useScanner`.

Archivos a modificar:
- `src/app/(dashboard)/inventario/page.tsx`
- `src/app/(dashboard)/inventario/inventario.module.css`
- `src/app/(dashboard)/productos/page.tsx`
- `src/app/(dashboard)/productos/productos.module.css`

Patrón correcto:
```tsx
import { useScanner } from '@/hooks/useScanner'
import { ScanBarcode } from 'lucide-react'

const [isScanning, setIsScanning] = useState(false)
const { scannerRef } = useScanner({
  active: isScanning,
  onResult: (code) => { setSearch(code); setIsScanning(false) }
})

// En la barra de búsqueda:
<div className={styles.searchRow}>
  <input ... value={search} onChange={...} />
  <button
    type="button"
    className={styles.scanBtn}
    onClick={() => setIsScanning(true)}
  >
    <ScanBarcode size={20} />
  </button>
</div>
{isScanning && <div ref={scannerRef} className={styles.scannerContainer} />}
```

**CRITERIO DE ÉXITO:** Carlos debe ver el botón 📷 en la pantalla.

### P1 — Backend Cobros (endpoints faltantes)

```
GET  /api/config/cobros/data
PATCH /api/config/cobros/data
GET  /api/config/devices
POST /api/config/devices
PATCH /api/config/devices/[id]
DELETE /api/config/devices/[id]
src/lib/cobros.ts → generateCobroMessage()
```

Hallazgos de CLI-A antes de implementar:
- Usar nombres reales del schema: `concepto`, `monto_usd`, `categoria`
- `cobro_data` collision — verificar formato existente antes de sobrescribir
- IDOR: `findFirst({ where: { id, business_id: session.businessId } })`
- Cashier guard en todos los endpoints
- `ProductForPOS` no tiene campo `barcode` — hardware scanner debe hacer fetch a `/api/products/search?q=<barcode>`

### P1 — Backend Gastos (endpoints faltantes)

```
GET    /api/gastos
POST   /api/gastos
PATCH  /api/gastos/[id]
DELETE /api/gastos/[id]
GET    /api/gastos/alerts
```

Modelo: `Gasto` (NO `Expense`) con campos reales del schema.

### P1 — Hardware scanner lector físico

`src/hooks/useHardwareScanner.ts` con `use-scan-detection`:
- Detecta velocidad < 50ms = lector físico (keyboard wedge)
- Enter al final = búsqueda exacta por barcode
- Guard: ignorar si hay INPUT/TEXTAREA/SELECT enfocado
- Integrar en POS: scan → fetch `/api/products/search?q=<barcode>` → addProduct

### P2 — Lector físico integrado en POS

`ProductForPOS` no tiene campo `barcode`. El hardware scanner en POS
debe hacer fetch a `/api/products?q=<barcode>` para buscar por barcode exacto.

### P2 — Usuario duplicado

`admin@activopos.com` existe con id=1 (role=admin) y id=3 (role=super_admin).
Eliminar el duplicado: `DELETE FROM users WHERE id=3;` (o el que sea superfluo).

### P3 — ACR_TEST_PROD en Top Productos

Datos de prueba de auditoría CIMAAD aparecen en el dashboard.
Limpiar con: `DELETE FROM products WHERE name LIKE 'ACR_TEST%';`

---

## 8. BENCHMARK COMPETITIVO — FINA

Fina (finapartner.com) es el competidor principal. Cobra $20-$40/mes.

**Donde Fina nos supera (gaps a cerrar):**
- Bóvedas bancarias virtuales — cada método anclado a una cuenta real
- CxP — Cuentas por Pagar a proveedores
- Gastos fijos con alerta 5 días antes (UI hecha, backend pendiente)
- Listas de precios por canal (detal/mayor/cliente especial)
- Cambios de producto (talla 32 → talla 31 sin reembolso)
- CRM con segmentación y campañas
- Total Capital = Inventario + Saldos bancarios

**Donde ActivoPOS supera a Fina:**
- POS físico real con scanner cámara (Quagga2)
- Lector físico barcode (pendiente)
- Catálogo digital con pedidos online
- KDS para cocina/bar
- Ticket térmico 58mm (Roccia)
- WhatsApp post-cobro automático
- Variantes por talla con grupos predefinidos
- PWA instalable

---

## 9. REFERENCIAS DE OTROS PROYECTOS

### SYNTImeat (carnicería — producción activa)
- Stack: Laravel 11 + Vue 3 + Inertia + MariaDB
- VPS: `187.124.241.213` → `/var/www/syntimeat`
- **NO TOCAR** — cliente real con 200+ ventas diarias
- **Funciones a replicar en ActivoPOS:**
  - Módulo Cobros con datos bancarios por método
  - Ventas del Día con tabla completa (ya replicado)
  - Cierre de caja por método con cuadre

### SportBar (bar deportivo — producción activa)
- Stack: Next.js 14 + TypeScript + CSS Modules (MISMO STACK)
- VPS: `187.124.241.213` → `/var/www/sportbar` puerto 3001
- **NO TOCAR** — producción activa
- **Patrones KDS a replicar (ya aplicados Sprint 30):**
  - Timer MM:SS por pedido ✅
  - Badges urgencia 45s/90s ✅
  - Polling dual datos/reloj ✅
  - STATUS_FLOW map ✅

### SYNTIweb (plataforma multi-tenant)
- **Módulo Cobros/Bancos** — referencia para datos para cobrar
- Campos Pago Móvil: banco + teléfono + titular + tipo_doc + documento
- Lista bancos venezolanos: ver sección 10

---

## 10. LISTA OFICIAL BANCOS VENEZOLANOS (Sudeban 2026)

```javascript
const BANCOS_VENEZUELA = [
  { codigo: '0102', nombre: 'Banco de Venezuela (BDV)' },
  { codigo: '0104', nombre: 'Venezolano de Crédito' },
  { codigo: '0105', nombre: 'Banco Mercantil' },
  { codigo: '0108', nombre: 'BBVA Provincial' },
  { codigo: '0114', nombre: 'Bancaribe' },
  { codigo: '0115', nombre: 'Banco Exterior' },
  { codigo: '0116', nombre: 'Banco Occidental de Descuento (BOD)' },
  { codigo: '0128', nombre: 'Banco Caroní' },
  { codigo: '0134', nombre: 'Banesco' },
  { codigo: '0137', nombre: 'Banco Sofitasa' },
  { codigo: '0138', nombre: 'Banco Plaza' },
  { codigo: '0146', nombre: 'Bangente' },
  { codigo: '0149', nombre: 'Banco del Pueblo Soberano' },
  { codigo: '0151', nombre: 'BFC Banco Fondo Común' },
  { codigo: '0156', nombre: '100% Banco' },
  { codigo: '0157', nombre: 'DelSur' },
  { codigo: '0163', nombre: 'Banco del Tesoro' },
  { codigo: '0166', nombre: 'Banco Agrícola de Venezuela' },
  { codigo: '0168', nombre: 'Bancrecer' },
  { codigo: '0169', nombre: 'R4 Banco Microfinanciero' },
  { codigo: '0172', nombre: 'Bancamiga' },
  { codigo: '0174', nombre: 'Banplus' },
  { codigo: '0175', nombre: 'Banco Bicentenario' },
  { codigo: '0177', nombre: 'BANFANB' },
  { codigo: '0191', nombre: 'Banco Nacional de Crédito (BNC)' },
  { codigo: '0601', nombre: 'Instituto Municipal de Crédito Popular' },
]
// NOTA: R4 (0169) antes era Mi Banco — cambio Sudeban noviembre 2024
```

---

## 11. PENDIENTES DOCUMENTADOS (no ejecutar sin orden de Carlos)

1. **Teclado numérico móvil** — `inputMode="numeric"` en campos de caja, clientes, abonos (parcialmente aplicado Sprint 30, verificar completitud)

2. **Base de datos de bancos/cobros** — módulo Datos para Cobrar (UI lista, backend pendiente)

3. **Módulo suscripción/plan** — UI lista en TabPlan.tsx, falta conectar a DB con `subscription_expires_at`

4. **Dual Brand Header** — implementado en desktop, verificar con logo real del negocio

5. **CxP — Cuentas por Pagar** — no existe. Fina lo tiene. Es ventaja competitiva.

6. **Listas de precios** — detal/mayor/cliente especial. No existe. Fina lo tiene.

7. **Comisiones a personal** — no existe. Fina lo tiene.

8. **Gastos fijos con alerta** — UI lista, backend pendiente

---

## 12. SCANNER — ESTADO ACTUAL Y PROBLEMA

**Librería actual:** `@ericblade/quagga2` (migrado desde `@zxing/browser` en Sprint 30)

**Configuración actual (useScanner.ts):**
```javascript
constraints: { facingMode: { ideal: 'environment' } },  // sin restricciones
halfSample: false,   // frame completo — NO submuestrear
patchSize: 'large',  // mayor área de detección
locate: true,
```

**Estado:** La cámara ahora debería verse nítida (sin restricciones).
No confirmado visualmente por Carlos — la sesión terminó antes de la prueba.

**PENDIENTE CRÍTICO:** Botón scanner NO visible en Inventario ni Productos.
Ver sección 7 P0 para implementación exacta.

**Lector físico barcode:** `use-scan-detection` instalado, hook `useHardwareScanner.ts` pendiente de crear.

---

## 13. DEPLOY VPS — PROCEDIMIENTO CORRECTO

```bash
# NUNCA borrar .next antes del build
git fetch origin
git merge origin/main --no-ff -m "merge: descripción"
npm install  # solo si hay paquetes nuevos
npm run build && pm2 restart activopos

# Si hay cambios de schema Prisma:
npx prisma generate && npx prisma db push
# NO usar migrate dev en VPS
```

**REGLA:** Si el build falla, el sitio sigue sirviendo el build anterior.
`rm -rf .next` solo DESPUÉS de confirmar build exitoso.

---

## 14. ARCHIVOS CLAVE EN EL REPO

```
CLAUDE.md                          → gobernanza completa
.doc/AGENTS.md                     → protocolo multi-agente
.doc/SYSTEM_MAP.md                 → estado real del sistema
.doc/ACTIVOPOS_MASTER.md           → árbitro de verdad
src/styles/tokens.css              → variables CSS globales
src/hooks/useScanner.ts            → Quagga2 scanner cámara
src/hooks/useHardwareScanner.ts    → PENDIENTE (lector físico)
src/lib/audio.ts                   → playBeep compartido
src/lib/cobros.ts                  → PENDIENTE (generateCobroMessage)
tests/auditoria-ciclo-real.spec.ts → CIMAAD 7/7
```

---

## 15. MENSAJE PARA EL PRÓXIMO AGENTE

Carlos es el arquitecto y fundador de SYNTIdev. Es exigente, directo y tiene razón cuando se molesta. Trabaja con 4 CLIs en paralelo en PowerShell.

**Lo más importante:**
1. Lee CLAUDE.md del repo ANTES de cualquier acción
2. Ningún feature se cierra sin verificación visual de Carlos
3. "Commiteado" ≠ "funciona" — exige captura de pantalla
4. Todo prompt debe incluir contexto completo del stack
5. PowerShell no acepta `&&` — comandos uno por línea
6. El scanner de cámara (Quagga2) existe pero el botón no es visible en Inventario/Productos — ese es el P0 más urgente
7. Carlos usa voice-to-text en mobile — interpretar typos con contexto

**Lo primero que debes hacer:**
Verificar que el botón scanner es visible en Inventario y Productos.
Si no está visible → implementarlo con el patrón de la sección 7.

---

*Generado al cierre de Sprint 30 — Claude Web*
*Fecha: 2026-06-24*
