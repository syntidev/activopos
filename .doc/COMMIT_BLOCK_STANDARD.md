# ═══════════════════════════════════════════════════
# BLOQUE COMMIT OBLIGATORIO — AGREGAR AL FINAL DE CADA PROMPT CLI
# ═══════════════════════════════════════════════════
# Copiar este bloque y pegarlo al final de cada prompt antes de entregarlo.
# El mensaje de commit identifica QUÉ agente hizo QUÉ y en QUÉ sprint.

## PASO FINAL — VERIFICAR Y HACER COMMIT

### 1. Verificar que el código compila
```bash
npm run build 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -10
```

Si hay errores → corregirlos ANTES del commit. No hacer commit de código roto.

### 2. Commit con mensaje descriptivo
```bash
cd C:\laragon\www\activopos

git add .

git commit -m "feat(sprint-N/CLI-X): descripción concisa de lo entregado

- Archivos creados: lista los principales
- Archivos modificados: lista los principales  
- Decisiones: cualquier decisión arquitectural tomada
- Pendiente: lo que quedó fuera del scope

🤖 Agente: CLI-X | Sprint: N | Fecha: $(date +%Y-%m-%d)"

git push origin main
```

### Ejemplos de mensajes por CLI:

**CLI-A (backend/API):**
```
feat(sprint-5/CLI-A): variantes producto + Cloudinary + schema IVA

- Creado: ProductVariant model, upload/image route, variants API
- Modificado: schema.prisma (iva_enabled, is_available, images[])
- Migración: add_variants_iva_catalog aplicada
- Pendiente: seed de ejemplo con variantes

🤖 Agente: CLI-A | Sprint: 5 | Fecha: 2026-06-16
```

**CLI-B (frontend/UI):**
```
feat(sprint-5/CLI-B): UI variantes + POS conectado API real + IVA ticket

- Creado: VariantSelector, CatalogUpgradeModal, imágenes múltiples
- Modificado: ProductModal, usePOS hook (mock → API real), TicketPanel IVA
- Decisión: VariantSelector usa grid 3 cols en mobile, 4 en desktop
- Pendiente: animación drag de imágenes

🤖 Agente: CLI-B | Sprint: 5 | Fecha: 2026-06-16
```

**CLI-C (quality/fixes):**
```
fix(sprint-5/CLI-C): arch fixes + IVA config + is_available filter

- Fix: overpayment epsilon en cash/close y sales/pay
- Fix: ThemeProvider como Server Component
- Fix: types consolidados en src/types/index.ts
- Creado: config/iva route, QUALITY_REPORT_16JUN2026.md

🤖 Agente: CLI-C | Sprint: 5 | Fecha: 2026-06-16
```

**CLI-D (features nuevas):**
```
feat(sprint-5/CLI-D): unidades ampliadas + pedidos kanban + delivery

- Creado: orders model, OrderItem, kanban UI, delivery config
- Modificado: SaleMode enum (6 tipos), Sidebar (+ Pedidos), units.ts
- Decisión: Kanban con HTML5 drag nativo, sin librerías
- Pendiente: notificación WhatsApp al crear pedido

🤖 Agente: CLI-D | Sprint: 5 | Fecha: 2026-06-16
```

### 3. Verificar que el push llegó
```bash
git log --oneline -3
```

### 4. Reportar al arquitecto
Al terminar, entregar:
- ✅ Lista de archivos creados/modificados
- ✅ Hash del commit (los primeros 7 caracteres)
- ✅ Resultado del build (✓ Compiled o errores pendientes)
- ⚠️ Anomalías encontradas fuera del scope (reportar, NO corregir)
