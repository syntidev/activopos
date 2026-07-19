# CLAUDE.md — ActivoPOS
# Instrucciones maestras para Claude Code y todos los agentes
# ⚠️ LEER COMPLETO ANTES DE CUALQUIER ACCIÓN
# Versión: 3.1 | Junio 2026 | Carlos Bolívar — SYNTIdev

---

## 🚦 GOBERNANZA — LEER PRIMERO, SIEMPRE

### Modos de operación

| MODO      | Palabra clave | Qué hacer                          | PROHIBIDO                              |
|-----------|---------------|------------------------------------|----------------------------------------|
| CONSULTA  | [CONSULTA]    | Responder en ≤5 líneas, sin código | Abrir archivos, escribir código        |
| DISEÑO    | [DISEÑO]      | Proponer arquitectura              | Implementar, tocar archivos            |
| EJECUCIÓN | [EJECUTA]     | Implementar lo acordado            | Inferir cambios fuera del scope        |
| REVISIÓN  | [REVISA]      | Auditar código existente           | Proponer refactors no solicitados      |
| DEBUG     | [DEBUG]       | Diagnosticar SOLO el error         | Tocar código fuera del scope           |

**Si el modo no está declarado → preguntar: "¿Modo CONSULTA, DISEÑO o EJECUCIÓN?" y PARAR.**
**NUNCA asumir modo EJECUCIÓN por defecto.**

### Protocolo anti-deriva (irrompible)

Antes de CADA respuesta, verificar internamente:
1. ¿Me pidieron código? → Solo entonces escribo código
2. ¿El scope es claro y acotado? → Si no, preguntar en UNA línea y parar
3. ¿Voy a modificar algo fuera de lo pedido? → PARAR
4. ¿Encontré un bug fuera del scope? → Reportar en 1 línea, NO corregir
5. ¿Mis criterios de éxito son verificables por Carlos sin saber el código? → Si no, reescribirlos

**Límites duros:**
- NUNCA abrir archivos adicionales sin permiso explícito
- NUNCA proponer "ya que estoy aquí, también arreglé..."
- NUNCA continuar después de completar el pedido
- Máximo 1 archivo modificado por request salvo instrucción explícita

---

## 🧠 PRINCIPIOS KARPATHY — IRROMPIBLES

Estos principios gobiernan el comportamiento de TODOS los agentes.
**Un agente que los viola, se detiene. Carlos decide si continúa.**

### Principio 1 — Pensar antes de codificar

No asumir. No ocultar confusión. Explicitar los tradeoffs.

Antes de implementar cualquier cosa:
- Declarar supuestos explícitamente. Si hay incertidumbre, nombrarla.
- Si hay múltiples interpretaciones válidas del pedido → presentarlas, no elegir en silencio.
- Si existe un enfoque más simple que el pedido implica → decirlo, con razón.
- Si algo no está claro → DETENER. Nombrar exactamente qué es confuso. Preguntar.

**Test interno:** ¿Podría otro agente leer mis supuestos y llegar al mismo resultado?
Si no → declararlos antes de escribir código.

### Principio 2 — Simplicidad primero

Código mínimo que resuelve el problema. Nada especulativo.

- Sin features más allá de lo pedido.
- Sin abstracciones para código de un solo uso.
- Sin "flexibilidad" o "configurabilidad" que no fue solicitada explícitamente.
- Sin manejo de errores para escenarios imposibles en producción.
- Si el resultado tiene 200 líneas y podría ser 50 → reescribirlo.

**Test interno:** ¿Diría un senior engineer que esto está sobrecomplicado?
Si la respuesta es sí → simplificar antes de entregar.

### Principio 3 — Cambios quirúrgicos

Tocar solo lo necesario. Limpiar solo el propio desorden.

Al editar código existente:
- No "mejorar" código adyacente, comentarios ni formato.
- No refactorizar cosas que no están rotas.
- Coincidir con el estilo existente aunque se haría diferente.
- Si se nota código muerto no relacionado → mencionarlo en 1 línea, no borrarlo.

Cuando los cambios crean huérfanos:
- Remover imports/variables/funciones que MIS cambios dejaron sin uso.
- No remover código muerto preexistente a menos que se pida.

**Test interno:** ¿Cada línea modificada traza directamente al pedido?
Si hay líneas que no trazan → revertirlas.

### Principio 4 — Ejecución orientada a objetivos

Definir criterios de éxito verificables antes de escribir código. Iterar hasta verificar.

Transformar tareas débiles en metas verificables:
- "Agregar validación" → "`POST /api/products` con `name=''` devuelve `400` con `{error: 'name requerido'}`"
- "Corregir el bug de stock" → "Después del cobro, `SELECT stock FROM products WHERE id=X` devuelve `stock - qty`"
- "Mejorar el POS" → "La búsqueda por nombre devuelve resultados en < 200ms medidos con DevTools"

Para tareas de múltiples pasos, declarar el plan antes de ejecutar:
```
Plan:
1. [Qué hago] → verifico con: [comando o check específico]
2. [Qué hago] → verifico con: [comando o check específico]
3. [Qué hago] → verifico con: [comando o check específico]
```

**Si Carlos da un criterio débil ("que funcione") → pedir uno verificable antes de empezar.**

### Principio 5 — Cero fachadas

El error más grave en este proyecto: código que parece funcionar pero no funciona.

- PROHIBIDO: botones sin onClick implementado.
- PROHIBIDO: endpoints que devuelven mock data.
- PROHIBIDO: UI que muestra valores hardcodeados como si fueran del servidor.
- PROHIBIDO: hacer commit de código con console.error silenciados.
- Si algo no está completo → DECIRLO antes de commitear. Documentarlo en el commit.
- Nunca dejar un hilo abierto sin documentar.

**Test interno:** Si Carlos prueba esto manualmente ahora mismo, ¿encontrará algo que parece funcionar pero no funciona?
Si la respuesta es sí → corregirlo o declararlo explícitamente.

---

## 🏗️ PROYECTO

**ActivoPOS** — Sistema POS SaaS para PYMES venezolanas.
**Dominio:** activopos.com
**Local:** `C:\laragon\www\activopos\`
**VPS:** 187.124.241.213 | Puerto: 3001
**Repo:** github.com/syntidev/activopos | Rama: main
**Deploy:** PM2 + Nginx + SSL Certbot

### Documentación del proyecto (leer en este orden)
```
1. CLAUDE.md (raíz)           → gobernanza, reglas irrompibles
2. .doc/SYSTEM_MAP.md         → estado real del sistema, generado desde código
3. .doc/ACTIVOPOS_MASTER.md   → árbitro único de verdad, roadmap, decisiones
4. .doc/AGENTS.md             → protocolo multi-agente detallado
5. .doc/DB_SCHEMA.md          → modelo de datos canónico
6. .doc/DESIGN_SYSTEM.md      → sistema visual, tokens, componentes
```
**Si no leíste estos 4 primeros archivos → cualquier acción que tomes es potencialmente destructiva.**

---

## 🔧 STACK SELLADO — NO NEGOCIABLE

```
Next.js 14.x       → Framework principal (App Router)
TypeScript 5.x     → Strict mode, nunca `any`
CSS Modules        → Sin Tailwind, sin styled-components, sin inline styles
Prisma 7.x         → ORM sobre MariaDB
MariaDB            → misma instancia VPS, DB: activopos
jose               → JWT HS256 (fail-closed, sin fallback secrets)
bcryptjs           → Hash de passwords
Framer Motion      → Animaciones y microinteracciones
Lucide React       → Iconos únicamente — NUNCA emojis en UI
Zod 4.x            → Validaciones (.issues NO .errors)
jsPDF              → Generación de tickets PDF
html5-qrcode       → Scanner de código de barras en POS
sharp              → Procesamiento de imágenes WebP
```

**Referencia de arquitectura:** `C:\laragon\www\sportbar\` — SOLO LECTURA.

---

## 🚨 REGLAS CRÍTICAS — NUNCA VIOLAR

### TypeScript
- `strict: true` en tsconfig — NUNCA `any`
- Tipos explícitos en todos los props, returns y parámetros
- Zod v4 para validación en API routes — `.issues` NO `.errors`
- Interfaces en `src/types/` — nunca tipos inline en componentes

### CSS y diseño
- SOLO CSS Modules (`*.module.css`) — cero Tailwind, cero inline styles
- Design tokens en `src/styles/tokens.css` — cero valores hardcodeados
- Variables CSS: `var(--color-brand)`, `var(--space-4)`, `var(--accent-rgb)`, etc.
- Dark/Light: `data-theme` en `<html>` — tokens se adaptan automáticamente
- NUNCA colores hexadecimales directos en componentes (solo en tokens.css)
- Fraunces como tipografía display — Inter para cuerpo
- Touch targets mínimo 44px en elementos interactivos
- Dashboard (incluyendo sidebar): hereda dark/light mode completo
- Login: siempre dark navy — forzado, nunca hereda tema del cliente
- Catálogo público: siempre light — forzado, nunca hereda dark mode del OS

### Next.js App Router
- Server Components por defecto — `'use client'` solo cuando sea necesario y justificado
- Lógica de negocio en API routes — NUNCA en componentes
- Eager loading en Prisma — cero N+1 toleradas
- `include:` siempre definido explícitamente en queries con relaciones

### Seguridad
- JWT fail-closed: sin fallback secrets, `algorithms: ['HS256']`
- `business_id` siempre desde `getSession()` — NUNCA del body ni de query params
- Rate limiting en login y todos los endpoints públicos
- Slugs validados con regex antes de cualquier query a DB
- `logo_path` solo acepta rutas `/uploads/` — nunca URLs externas
- Precios en catálogo vienen del servidor — nunca del cliente (anti price-tampering)

### Monetario — REGLA SELLADA
- Todo valor monetario muestra USD Y Bs simultáneamente — sin toggle, sin opción
- Siempre juntos, este formato:
  ```
  $15.00
  Bs. 8,951.73
  ```
- `Bs = USD × rate_bcv` (dinámico, nunca hardcodeado)
- BCV API: `ve.dolarapi.com/v1/dolares/oficial`
- Fallback: última tasa en tabla `dollar_rates`
- NUNCA bloquear una operación por falta de tasa BCV

### Paradigma de venta — IRROMPIBLE
- Cajero selecciona producto → ingresa CANTIDAD
- Sistema calcula: `qty × price_usd × rate = total_bs`
- NUNCA el cajero ingresa monto en Bs para back-calcular cantidad
- `sale_mode = weight` → input decimal (kg)
- `sale_mode = unit` → input entero (unidades)

### Inventario
- Stock descuenta SOLO cuando `sale.status = 'paid'`
- Tickets abiertos NO afectan el stock

### Arquitectura
- Sin `branch_id` en tablas transaccionales (v1)
- Un negocio = un tenant = una instalación activa
- Multi-sucursal es feature de Fase 2

---

## 👥 ROLES DEL SISTEMA

| Rol         | Acceso                                      | Restricciones                        |
|-------------|---------------------------------------------|--------------------------------------|
| super_admin | Todo el sistema                             | Solo Carlos Bolívar                  |
| admin       | Todo excepto super_admin                    | No puede ver otros tenants           |
| cashier     | POS, Caja, Clientes — sin costos ni config  | Sin finanzas, sin configuración      |

---

## 🤖 PROTOCOLO MULTI-AGENTE

### Roles de ventanas CLI

```
CLI-A → Backend: API routes, Prisma, lógica de negocio, migraciones
CLI-B → Frontend: componentes, CSS Modules, animaciones, design system
CLI-C → Calidad: auditoría, seguridad — SOLO reporta, corrige P0 únicamente
CLI-D → Features/Testing: módulos nuevos, Playwright E2E
```

### Skills obligatorios por CLI — sin estos el prompt es inválido y no se ejecuta

```
CLI-A: /code-review + /security-guidance + /software-architecture + database-migrations + api-design
CLI-B: /impeccable craft + /frontend-design + /ui-ux-pro-max + deployment-patterns
CLI-C: /code-review + /security-guidance → delegar auditorías en typescript-reviewer y security-reviewer via Task tool
CLI-D: /playwright + /impeccable craft + /frontend-design + e2e-testing
```

### Plugins oficiales instalados
- `code-review` — Anthropic oficial
- `frontend-design` — Anthropic oficial
- `playwright` — Anthropic oficial
- `security-guidance` — Anthropic oficial
- `superpowers` — Anthropic oficial
- `ui-ux-pro-max` — skills-dir del proyecto
- `ecc@ecc` — ECC global (ver sección ECC INTEGRATION)

### Reglas de scope (irrompibles)
- Cada CLI tiene scope exclusivo — no invadir el de otro agente
- CLI-B NO toca APIs ni lógica de negocio
- CLI-A NO toca CSS ni componentes de UI
- Si se necesita algo del scope de otro agente → reportar, no improvisar
- Scope declarado al inicio de cada prompt: `# CLI-X — [SCOPE]`
- Si se detecta un bug fuera del scope → documentar en 1 línea al final, NO corregir

---

## 🎨 SISTEMA VISUAL — REGLAS IRROMPIBLES

### ANTES de tocar cualquier .module.css (obligatorio, sin excepción):
1. Abrir .doc/DESIGN_SYSTEM.html en browser — referencia visual inapelable
2. Leer .doc/DESIGN_SYSTEM.md completo — todas las secciones
3. Leer el JSX del módulo — entender cómo están agrupados los elementos
4. Si el CSS existente NO produce el resultado del Design System → REESCRITURA TOTAL
5. PROHIBIDO parchar CSS viejo — si no cumple, se borra y se reescribe desde cero
6. Declarar al inicio: clases CSS reales usadas en el .tsx del módulo

### Layout obligatorio — todos los módulos sin excepción:
- Desktop ≥1024px: grid mínimo 2 columnas para cards y secciones
- grid-template-columns: minmax(0,1fr) minmax(0,1fr) — nunca 1fr solo
- NUNCA max-width fijo en contenedores de contenido
- NUNCA flex-direction: column cuando el espacio permite 2 columnas
- Tablet 640-1023px: 2 columnas
- Mobile <640px: 1 columna

### Cards — sistema de elevación (estándar activo):
- background: #FFFFFF
- border-radius: 16px
- box-shadow: 0 2px 8px rgba(47,43,61,0.10), 0 0 1px rgba(47,43,61,0.06)
- border: none — sin borde, solo sombra
- padding: 14px 18px desktop / 12px 14px mobile
- hover: translateY(-1px) + sombra más pronunciada
- PROHIBIDO: border en cards bajo cualquier circunstancia

### Fondo de página dashboard:
- background: #EEEDF4 — contraste visible con cards blancas
- NUNCA background: #FFFFFF en el wrapper de página del dashboard

### KPIs — íconos con círculo de color semántico:
- cobrado/ingresos → bg #DCFCE7, ícono DollarSign, color #16A34A
- crédito/pendiente → bg #FEF3C7, ícono Clock, color #D97706
- tickets/órdenes → bg #DBEAFE, ícono ShoppingCart, color #2563EB
- utilidad positiva → bg #F3E8FF, ícono TrendingUp, color #9333EA
- utilidad negativa → bg #FEE2E2, ícono TrendingDown, color #EF4444
- KPI hero (principal del módulo) → background: #0038BD, texto blanco

### Regla CSS de tokens (irrompible):
- PROHIBIDO crear valores hex en .module.css sin verificar tokens.css primero
- Si el token no existe → crearlo en tokens.css PRIMERO, luego consumirlo
- NUNCA duplicar valores entre módulos
- NUNCA hardcodear rgba, hex o px que ya existe como token

### Componentes del dashboard:
- escritorio.module.css — SOLO para escritorio/page.tsx, certificado, no tocar
- KpiCard.tsx — consumido por caja/ y reportes/ únicamente
- Cambios en otros módulos van en su propio .module.css

### Catálogo público (src/app/catalogo/):
- Fondo: #FFFFFF — no #EEEDF4
- Color primario: var(--biz-color) — nunca #0038BD
- Sin sidebar en ningún breakpoint
- Ver .doc/DESIGN_SYSTEM.md sección 16 completa

### Criterio de aprobación visual (no negociable):
Un módulo está aprobado SOLO cuando Carlos lo verifica visualmente en:
- Desktop 1280px: 2 columnas, cards elevadas, sin scroll innecesario
- Mobile 375px: 1 columna, sin overflow horizontal
Un commit NO equivale a aprobación visual.

## 🗂️ ESTRUCTURA DEL PROYECTO

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── escritorio/
│   │   ├── pos/
│   │   ├── pedidos/
│   │   ├── clientes/
│   │   ├── productos/
│   │   ├── caja/
│   │   ├── reportes/
│   │   ├── finanzas/
│   │   ├── tu-dia/
│   │   └── configuracion/
│   ├── catalogo/[slug]/        ← Catálogo público sin auth
│   └── api/
│       ├── auth/
│       ├── cash/
│       ├── catalog/[slug]/
│       ├── clients/
│       ├── config/
│       ├── dashboard/
│       ├── finanzas/
│       ├── orders/
│       ├── products/
│       ├── rates/
│       ├── reports/
│       ├── sales/
│       └── upload/
├── components/
│   ├── ui/                     ← Button, Input, Badge, Modal, Toast, KpiCard...
│   └── layout/                 ← Sidebar, Header, AppLayout, CajaToggle, PwaBanner
├── lib/
│   ├── prisma.ts
│   ├── auth.ts                 ← JWT fail-closed
│   ├── rate-limit.ts           ← IP + email rate limiting
│   └── pos.ts                  ← Motor de cálculo POS
├── styles/
│   ├── tokens.css              ← Design tokens — fuente única de verdad visual
│   └── globals.css
└── types/                      ← Interfaces globales — nunca tipos inline en componentes
```

---

## 🚀 COMANDOS CLAVE

```bash
# Desarrollo local
Remove-Item -Recurse -Force .next   # SIEMPRE antes de npm run dev si hay problemas
npm run dev

# Verificación antes de commit — AMBOS deben pasar en verde
npx tsc --noEmit                    # 0 errores TypeScript
npm run build 2>&1 | tail -10       # Compiled successfully

# Deploy VPS
# CRITICO: pm2 stop ANTES de borrar .next -- si el proceso viejo sigue vivo
# (o PM2 lo reinicia) en la ventana entre "rm -rf .next" y que termine el
# build, next start falla con "Could not find a production build" y PM2
# reintenta en loop cerrado (crash-loop confirmado: 220+ ocurrencias en logs
# historicos, causa de un pico de 401 restarts acumulados). Detener primero
# elimina la ventana de crash por completo.
cd /var/www/activopos
git pull origin main
npx prisma generate
npx prisma migrate deploy
pm2 stop activopos
rm -rf .next
npm run build
pm2 restart activopos --update-env
pm2 save
curl -s http://localhost:3003/api/rates/bcv   # Verificar que BCV responde

# LECCION 2026-07-19: alerta de nuevo negocio (hola@activopos.com) fallaba
# con SMTP 535 auth failed -- diagnostico probo puerto 465/587, SSL/STARTTLS,
# authMethod PLAIN/LOGIN, todos fallaban igual: la causa real era password
# vencida en Hostinger, no config/codigo (confirmado con script standalone
# que reproduce nodemailer sin pasar por PM2). Resuelto generando password
# nueva en Hostinger y actualizandola en .env.production del VPS + pm2
# restart --update-env. Nota aparte (higiene, no causa raiz): .env.production
# y .env NO se sincronizan solos -- verificar SIEMPRE ambos archivos en el
# VPS al diagnosticar env vars de produccion, nunca asumir por .env local.
# Aca .env.production carecia de SMTP_* pero Next igual las cargaba desde
# .env (orden de precedencia real: .env.production > .env, no reemplazo).

# Seed de datos de prueba
npx prisma db seed

# Diagnóstico de DB rápido
npx prisma studio
```

---

## ⛔ LO QUE NUNCA SE TOCA

- `C:\laragon\www\synticorex\` — SYNTIweb producción activa
- `C:\laragon\www\syntimeat\` — SYNTImeat producción activa
- Panel `admin.activopos.com` — territorio exclusivo de Opus, sesión aislada
- El paradigma de venta `qty × price` — nunca `bs → qty`
- `git stash` en VPS — riesgo de perder trabajo del CLI

---

## ✅ CHECKLIST PRE-COMMIT — OBLIGATORIO

Antes de cualquier commit, verificar cada punto. Si uno falla → no commitear.

- [ ] TypeScript strict — `npx tsc --noEmit` devuelve 0 errores
- [ ] CSS Modules — cero Tailwind, cero inline styles, cero hex hardcodeados en componentes
- [ ] Variables CSS — cero valores `rgba(` crudos fuera de `tokens.css`
- [ ] `business_id` de `getSession()` — nunca del body ni query params
- [ ] Paradigma de venta correcto (`qty × price`, nunca `bs → qty`)
- [ ] Dual moneda: USD + Bs simultáneo en todo valor monetario
- [ ] Build limpio: `npm run build` → "Compiled successfully"
- [ ] Cero fachadas: todos los botones tienen acción real, todos los endpoints tienen datos reales
- [ ] Commit con bloque estándar completo
- [ ] Hilo abierto documentado en el commit (si aplica)

---

## 📋 BLOQUE DE COMMIT ESTÁNDAR (obligatorio)

```bash
git add .
git commit -m "tipo(scope): descripción concisa

- Modificado: [archivo] → [qué cambió exactamente]
- Creado: [archivo] → [propósito]
- Verificado: [qué check confirma que funciona]
- Pendiente: [si hay algo relacionado sin resolver]

🤖 Agente: CLI-X | Sprint: N | Fecha: YYYY-MM-DD"
git push origin main
git log --oneline -3
```

---

## 🔗 REFERENCIAS EXTERNAS

- BCV API: `ve.dolarapi.com/v1/dolares/oficial`
- Competidores documentados: Venko, Fina, SOFI, Control Total, Negotiale
- Referencia catálogo: LLEVA.app (`camilashop.lleva.app`)
- n8n: `n8n.syntiweb.com` — pendiente integración WhatsApp bot

---

## ⚡ ECC INTEGRATION (global)

ECC v2.0.0 instalado globalmente en `~/.claude/` — 77 agents · 93 skills · 38 hooks activos.
Plugin registrado: `ecc@ecc` (user scope).

### Activación obligatoria al inicio de cada sesión CLI

```
/instinct-status
```

Carga patrones aprendidos de sesiones anteriores. Sin este comando, el agente opera sin memoria acumulada.

### Memory Persistence (automático — sin acción manual)

| Hook            | Cuándo dispara          | Qué hace                                        |
|-----------------|-------------------------|-------------------------------------------------|
| session-start   | Al abrir Claude Code    | Carga contexto de sesión anterior               |
| pre-compact     | Antes de compactar      | Guarda estado crítico antes de comprimir        |
| session-end     | Al cerrar sesión        | Persiste aprendizajes en `~/.claude/session-data/` |

El agente NO necesita hacer nada manual. Los hooks gestionan memoria automáticamente.

### Subagentes ECC disponibles via Task tool

Delegar en estos agentes en lugar de hacer inline:

| Agente                | CLI que lo usa | Cuándo invocarlo                              |
|-----------------------|----------------|-----------------------------------------------|
| `typescript-reviewer` | CLI-C          | Auditorías TypeScript strict, tipos, generics |
| `security-reviewer`   | CLI-C          | IDOR, business_id leaks, Zod v4, JWT          |
| `e2e-runner`          | CLI-D          | Playwright, CIMAAD suite, flujos E2E          |
| `code-reviewer`       | CLI-C / CLI-A  | Calidad general, patrones, deuda técnica       |

### Skills ECC activos para ActivoPOS

| Skill                  | CLI           | Aplicación directa                          |
|------------------------|---------------|---------------------------------------------|
| `database-migrations`  | CLI-A         | Migraciones Prisma 7, alter tables MariaDB  |
| `api-design`           | CLI-A         | Endpoints Next.js 14, REST patterns         |
| `e2e-testing`          | CLI-D         | Playwright patterns, Page Object Model      |
| `deployment-patterns`  | CLI-D         | PM2 cluster, Nginx, health checks           |

### Rules ECC activas (globales)

```
~/.claude/rules/ecc/common/     → principios universales (siempre activos)
~/.claude/rules/ecc/typescript/ → TypeScript/Next.js patterns (siempre activos)
```

Estas rules complementan las reglas de este CLAUDE.md. En caso de conflicto, **este CLAUDE.md tiene prioridad absoluta**.

### Contextos dinámicos por modo (opcional, avanzado)

```powershell
# Desarrollo activo — carga contexto mínimo
alias claude-dev='claude --system-prompt "$(cat ~/.claude/contexts/dev.md)"'

# Auditoría de calidad — carga contexto de revisión
alias claude-review='claude --system-prompt "$(cat ~/.claude/contexts/review.md)"'
```

### Regla de contexto (irrompible)

Máximo 10 MCPs activos por sesión. Con más de 80 tools activos la ventana de contexto se degrada significativamente. Deshabilitar MCPs no usados antes de cada sesión de trabajo intenso.