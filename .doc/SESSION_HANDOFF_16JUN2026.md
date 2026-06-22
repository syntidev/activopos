# SESSION HANDOFF — ActivoPOS
# Fecha: 16 Junio 2026 | Sesión Fundacional
# Para: Próximo agente Claude (Sonnet o Opus)
# De: Claude Sonnet 4.6 — sesión de 16+ horas

---

## LEER ANTES DE CUALQUIER ACCIÓN

Este documento es la fuente de verdad de la sesión anterior.
Antes de escribir una sola línea de código, leer en este orden:

1. Este documento completo
2. `.doc/CLAUDE.md` — gobernanza y reglas críticas
3. `.doc/AGENTS.md` — orquestación de agentes
4. `.doc/SYSTEM_MAP.md` — estado actual del sistema
5. `.doc/DB_SCHEMA.md` — modelo de datos canónico
6. `.doc/PLAN_MAESTRO_ESTADO_v2.md` — roadmap completo

**NUNCA asumir. NUNCA improvisar. Si algo no está en los documentos, preguntar.**

---

## ESTADO ACTUAL DEL PROYECTO

### Infraestructura
- **URL producción:** https://activopos.com ✅ LIVE con SSL
- **VPS:** 187.124.241.213 | PM2 proceso `activopos` | Puerto 3003
- **DB:** MySQL `activopos` @ 127.0.0.1:3306 — 15 tablas migradas
- **Nginx:** Virtual host configurado con Certbot SSL
- **GitHub:** github.com/syntidev/activopos (branch: main)
- **Local:** C:\laragon\www\activopos\

### Stack (SELLADO — no cambiar)
```
Next.js 14.2.35 + TypeScript 5 (strict) + CSS Modules
Prisma 7.8.0 + @prisma/adapter-mariadb + MySQL
jose (JWT HS256) + bcryptjs
Framer Motion 12 + Radix UI + Lucide React
Recharts (charts) + jsPDF (tickets) + html5-qrcode (scanner)
Supabase FREE (broadcast bus — no guarda datos)
PM2 + Nginx en VPS
```

### Credenciales de prueba
```
Admin:  admin@activopos.com / admin123
Cajero: cajero@activopos.com / cajero123
```

### Deploy workflow
```bash
# LOCAL → siempre trabajar en local
# Al finalizar jornada o validación crítica:

# 1. Commit local
git add .
git commit -m "feat: descripción del sprint"
git push origin main

# 2. En VPS (SSH root@187.124.241.213)
cd /var/www/activopos
git pull https://TOKEN@github.com/syntidev/activopos.git main
npx prisma migrate deploy
npm run build
pm2 restart activopos
pm2 save
curl -s http://localhost:3003/api/rates/bcv
```

---

## LO QUE ESTÁ CONSTRUIDO (Sprint 1-4)

### ✅ Sprint 1 — Fundación
- Auth JWT completo (login, logout, me, middleware)
- BCV Service live (ve.dolarapi.com + fallback)
- 14 tablas Prisma migradas
- Design tokens 436 líneas (dark/light/sidebar)
- Login page, Sidebar, Header, AppLayout
- Escritorio con KPIs reales de DB + Recharts

### ✅ Sprint 2 — Inventario + Caja
- 7 endpoints productos (CRUD, search, import XLSX)
- Fórmula precio: costo + margen% → sistema calcula
- 10 endpoints caja/ventas con transacciones atómicas
- UI Productos con 4 modales
- 8 primitivos design system (Button, Input, Badge, Modal, Toast, Table, EmptyState, Skeleton)

### ✅ Sprint 3 — POS
- Motor POS puro (`src/lib/pos.ts`) — funciones puras, sin side effects
- Hook `usePOS.ts` con debounce, Promise.all paralelo
- POS Layout dos paneles (grid productos + ticket panel)
- 8 modales POS: Cobro, Cliente, Cotización, Descuento, Cargo, QtyInput, CajaApertura
- Búsqueda por nombre + SKU + barcode con cámara html5-qrcode
- UI Clientes con historial y abonos
- UI Caja con turno activo, movimientos, cuadre, historial
- UI Reportes con filas expandibles y paginación

### ✅ Sprint 4 — Finanzas + Config + Onboarding
- Dashboard Bento Grid completo con Recharts (line, donut, bar charts)
- Finanzas: Estado de Resultados P&L, CxC, CxP, gastos operativos
- Tabla `gastos` agregada a Prisma
- Configuración completa (6 tabs: General, Empresa, Impresión, Pagos, Tema, Usuarios)
- Onboarding interactivo 5 pasos con polling
- Centro de Ayuda con chatbot offline
- PWA manifest con íconos generados

---

## CÓMO TRABAJA CARLOS (LEER CON ATENCIÓN)

### Personalidad y contexto
- Arquitecto de software con 20+ años en banca, Venezuela
- No es programador tradicional — orquesta agentes
- Usa voz-a-texto en móvil — hay typos, interpretarlos correctamente
- Es directo, no acepta halagos ni rodeos
- Prefiere decisiones rápidas y claras sobre análisis interminables
- Estuvo 10 años fuera de Venezuela — aprendiendo el ecosistema local

### Método de trabajo
- **4 ventanas CLI paralelas** (CLI-A, B, C, D) — siempre en local
- **Claude Design** para prototipos visuales antes de implementar
- Tú (este agente) generas los prompts → Carlos los pega en los CLIs
- Los CLIs trabajan → Carlos trae los resultados → tú los procesas
- **NUNCA** darle comandos uno por uno para ejecutar manualmente
- **SIEMPRE** scripts completos listos para copiar/pegar

### Reglas de entrega
1. **Scripts en bandeja de plata** — completos, listos para pegar
2. **Prompts de CLI** — un archivo por CLI, descargable
3. **Sin improvisación** — si no está en el spec, reportar como anomalía
4. **Local first** — deploy al VPS solo al final de jornada o validación crítica
5. **Un problema a la vez** — diagnosticar completo antes de corregir

### Estrategia de ventanas CLI
```
CLI-A → Backend: API routes, Prisma, lógica de negocio
CLI-B → Frontend: Componentes, CSS Modules, animaciones
CLI-C → Quality: /software-architecture + /code-review + fixes
CLI-D → Features: módulos nuevos, integraciones, PWA
```

### Skills disponibles en CLI (invocar con /nombre)
```
/impeccable craft      → UI production-grade
/software-architecture → Clean Architecture, SOLID
/frontend-design       → Design thinking
/emil-design-eng       → Polish invisible
/webapp-testing        → Tests Playwright
/code-review high      → Revisión exhaustiva
/security-review       → OWASP
/ui-ux-pro-max         → 67 estilos, 96 paletas (instalado local)
```

---

## DECISIONES ARQUITECTURALES SELLADAS

| Decisión | Valor | Razón |
|----------|-------|-------|
| Stack | Next.js 14 + TS + CSS Modules | SportBar lo validó en producción |
| Sin tenant/branch v1 | Un negocio = una instalación | Simplicidad |
| Paradigma venta | qty × price — NUNCA monto→qty | La "monstruosidad" de SYNTImeat |
| Fórmula precio | costo + margen% → sistema calcula | Venko lo demostró |
| Moneda | USD interno, Bs al cobrar, BCV auto | Mercado venezolano |
| Sin SENIAT v1 | Ticket térmico propio | Lanzar rápido |
| CSS | CSS Modules — cero Tailwind | Control total del pixel |
| Iconos | Lucide React — cero emojis en UI | Consistencia |
| Sidebar | Siempre oscuro en dark Y light | Identidad visual |
| PIN cajero | 4 dígitos para autorizar descuentos | Venko lo tiene |

---

## NUEVO BACKLOG — FEATURES SOLICITADAS POR CARLOS

Categorizado por fase. **NADA de esto va en v1 sin aprobación explícita.**

### FASE 2 — Inmediato post-lanzamiento

**Productos mejorados:**
- Toggle "Habilitado para venta" — si OFF no aparece en POS
- Toggle "Mostrar en catálogo digital" — valida si tiene plan activo
- Si no tiene plan catálogo → modal invitación con propuesta de valor
- Variantes de producto: Talla (XS/S/M/L/XL/XXL) + Color (selector)
- Múltiples imágenes por producto (hasta 3) — para ropa, zapatos, etc.
- Unidades de medida ampliadas: und, kg, g, lb, m, ml, litro, caja, par, set

**Módulo Carrito / Pedidos:**
- Cliente puede armar carrito desde catálogo digital
- Pedidos por WhatsApp (link pre-formateado)
- Delivery con dirección y costo de envío configurable
- Estado de pedido: recibido → preparando → despachado → entregado

**Financiero:**
- IVA configurable (toggle en Configuración — desactivado por defecto)
- Si activo: porcentaje configurable (16% default Venezuela)
- IVA se calcula sobre el total y se muestra separado en ticket
- Módulo de recaudación IVA para declaraciones

**Catálogo digital:**
- Integración LLEVA.app (Carlos ya tiene el producto)
- Subdominio: negocio.activopos.com
- QR personalizable por mesa/zona
- Plan "Catálogo Activo" a $25/mes

### FASE 3 — Crecimiento

**Sistema de crédito avanzado:**
- Límite de crédito por cliente configurable
- Alertas automáticas al cajero si cliente supera límite
- Recordatorio automático de deudas vía WhatsApp
- Reporte de cartera de crédito

**Recarga por concepto:**
- Módulo para servicios recurrentes (recargas, suscripciones)
- Compatible con cualquier negocio de servicios

**Multi-sucursal:**
- Solo para plan Pro
- branch_id en tablas transaccionales
- Dashboard consolidado multi-sede

**PWA avanzado:**
- Offline mode con sync cuando recupera conexión
- Push notifications para alertas de caja y ventas
- Instalable en POS físico (tablet Android)

---

## REGLAS PARA PRÓXIMOS AGENTES

### Lo que SIEMPRE debes hacer
1. Leer `.doc/CLAUDE.md` antes de cualquier acción
2. Verificar que el código compile antes de reportar como completado
3. Reportar anomalías en lugar de inventar soluciones
4. Entregar prompts de CLI como archivos descargables
5. Entregar scripts de VPS completos, listos para pegar
6. Trabajar en local — VPS solo al final de jornada
7. Usar `npm run build` local para verificar antes de cualquier push
8. TypeScript strict — cero `any` — verificar con `tsc --noEmit`

### Lo que NUNCA debes hacer
1. Improvisar soluciones fuera del spec
2. Usar `sed` ciego sin leer el archivo primero
3. Ejecutar `git reset --hard` sin confirmar con Carlos
4. Modificar `.env` en VPS sin hacer backup
5. Mezclar trabajo de VPS con trabajo local
6. Dar comandos uno por uno — siempre scripts completos
7. Tocar `synticorex` (SYNTIweb) — es producción activa
8. Agregar features no solicitadas "ya que estoy aquí"
9. Crear código sin leer los tipos existentes en `src/types/`
10. N+1 queries — siempre eager loading con `include`

### Protocolo de corrección de bugs
```
1. Leer el archivo COMPLETO primero
2. Buscar el mismo patrón en TODOS los archivos afectados
3. grep -rn "patrón" src/ para encontrar todos los casos
4. Corregir todos de una vez
5. npm run build para verificar
6. Reportar exactamente qué se cambió y por qué
```

---

## SISTEMA DE CERTIFICACIÓN AL FINAL DE SESIÓN

Antes de cerrar cada sesión, ejecutar este checklist en CLI-C:

```bash
# 1. TypeScript limpio
npx tsc --noEmit 2>&1 | head -20

# 2. Build exitoso
npm run build 2>&1 | tail -10

# 3. Sin N+1 (buscar includes faltantes)
grep -rn "findMany\|findFirst" src/app/api --include="*.ts" | grep -v "include:" | head -10

# 4. Sin any
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"

# 5. Sin colores hardcodeados
grep -rn "#[0-9A-Fa-f]\{3,6\}" src/components --include="*.module.css" | head -10

# 6. BCV respondiendo
curl -s http://localhost:3000/api/rates/bcv | python3 -m json.tool
```

Prompt para CLI-C al final de cada sesión:
```
/code-review high
Revisar todo el diff de esta sesión buscando:
1. TypeScript strict violations (any, missing types)
2. N+1 queries sin eager loading
3. Lógica de negocio en componentes UI
4. Colores hardcodeados fuera de tokens
5. Touch targets < 44px
6. Componentes Client innecesarios (debería ser Server)
Reportar en QUALITY_REPORT_[FECHA].md
NO corregir — solo reportar para la próxima sesión
```

---

## PRÓXIMO SPRINT RECOMENDADO

### Sprint 5 — Certificación y Pulido v1

**CLI-A:**
- Migrar tabla gastos en VPS (`npx prisma migrate deploy`)
- API upload de logo (Cloudinary — Carlos tiene cuenta activa)
- Endpoint `/api/products` agregar campo `is_available` (toggle en POS)

**CLI-B:**
- Conectar POS al API real (actualmente usa datos mock)
- Probar flujo completo: abrir caja → buscar producto → cobrar → ticket
- Fix visual de lo que se vea mal en producción

**CLI-C:**
- `/code-review ultra` de todo el codebase
- Corregir issues P0 y P1 del ARCHITECTURE_REPORT_v2.md
- Verificar que todos los endpoints tengan manejo de errores correcto

**CLI-D:**
- `/webapp-testing` — tests E2E del flujo POS completo
- Generar reporte de cobertura
- Fix de PWA: verificar que el manifest funcione en Android y iOS

### Después del Sprint 5 — Primera demo con primer cliente
Eso es el hito. No lanzar más features hasta tener feedback real de un usuario.

---

## CONTEXTO DEL ECOSISTEMA SYNTIDEV

```
SYNTIweb   → synticorex  [NUNCA TOCAR] → lleva.app + ordena.menu + syntiweb.com
SYNTImeat  → syntimeat   [SOLO LECTURA] → meat.synti.cloud (PRODUCCIÓN)
SportBar   → sportbar    [SOLO LECTURA] → tusport.bar (PRODUCCIÓN)
ActivoPOS  → activopos   [PROYECTO ACTIVO] → activopos.com
```

**Dominio del VPS (187.124.241.213):**
- Puerto 3001: Uptime Kuma (monitor.syntiweb.com)
- Puerto 3002: SportBar (tusport.bar)
- Puerto 3003: ActivoPOS (activopos.com) ← nuestro
- Puerto 5678: N8N (n8n.syntiweb.com) — sin usar, disponible
- Cloudinary: cuenta activa, sin usar en ActivoPOS aún

**N8N disponible para:**
- Actualización BCV automática (cron)
- Alertas WhatsApp al dueño (cierre de caja, stock bajo)
- Reporte diario automático
- Backup de DB nocturno

---

## VARIABLES DE ENTORNO VPS

```env
DATABASE_URL="mysql://root@127.0.0.1:3306/activopos"
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=activopos
DB_POOL=5
JWT_SECRET="activopos_prod_2026_cambiar"
NEXT_PUBLIC_APP_URL="https://activopos.com"
BCV_API_URL="https://ve.dolarapi.com/v1/dolares/oficial"
BCV_FALLBACK_RATE="36.50"
PORT=3003
NODE_ENV=production
```

⚠️ El `.env` está en `.gitignore` — se recrea manualmente en el VPS si se pierde.

---

## COMMIT DEL ESTADO ACTUAL

Al iniciar la próxima sesión, verificar que el repo esté sincronizado:

```bash
# Local
git log --oneline -5
git status

# VPS
cd /var/www/activopos
git log --oneline -3
pm2 status
curl -s http://localhost:3003/api/rates/bcv
```

---

*ActivoPOS — syntidev — activopos.com*
*"El POS para negocios que andan activos"*
*Handoff generado: 16 Junio 2026 — Claude Sonnet 4.6*
