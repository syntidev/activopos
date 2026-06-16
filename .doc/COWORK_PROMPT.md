# PROMPT PARA COWORK — Crear estructura completa ActivoPOS
# Pegar este prompt en CoWork apuntando a C:\laragon\www\activopos\

## MISIÓN

Eres el arquitecto senior de ActivoPOS. Tienes una tarea específica y acotada:
crear la estructura de carpetas del proyecto y todos los archivos fundacionales de gobernanza.
NO escribas código de la aplicación. Solo estructura y documentación.

---

## PASO 1 — Crear carpetas base

Crea estas carpetas en C:\laragon\www\activopos\ :

```
.doc/
src/
src/app/
src/app/(auth)/
src/app/(auth)/login/
src/app/(dashboard)/
src/app/api/
src/components/
src/components/ui/
src/components/layout/
src/components/pos/
src/components/shared/
src/lib/
src/styles/
src/styles/themes/
src/types/
prisma/
public/
```

---

## PASO 2 — Crear archivos de gobernanza en raíz

Crea los siguientes archivos en C:\laragon\www\activopos\ con el contenido EXACTO especificado:

### CLAUDE.md (raíz)
[CONTENIDO DEL ARCHIVO CLAUDE.md GENERADO]

### AGENTS.md (raíz)
[CONTENIDO DEL ARCHIVO AGENTS.md GENERADO]

---

## PASO 3 — Crear documentos en .doc/

Crea en C:\laragon\www\activopos\.doc\ estos archivos:

- MASTER_DOC_ACTIVOPOS.md
- SYSTEM_MAP.md  
- DB_SCHEMA.md
- ROADMAP_MAESTRO.md
- DESIGN_SYSTEM.md
- BRAND_PLAYBOOK.md
- SESSION_HANDOFF_TEMPLATE.md

[Con los contenidos de cada archivo generado]

---

## PASO 4 — Crear archivos base del proyecto Next.js

### .env.local (solo variables, sin valores reales)
```
DATABASE_URL="mysql://user:password@localhost:3306/activopos"
JWT_SECRET="cambiar_en_produccion"
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
BCV_API_URL=https://ve.dolarapi.com/v1/dolares/oficial
BCV_FALLBACK_RATE=36.50
PORT=3001
```

### .gitignore
```
.env
.env.local
.env.production
node_modules/
.next/
prisma/generated/
*.log
```

### prisma/schema.prisma (esquema base)
[Con el contenido del DB_SCHEMA.md convertido a Prisma schema]

---

## PASO 5 — Crear README.md del proyecto

Con esta estructura:
- Descripción del proyecto
- Stack técnico
- Comandos de instalación
- Estructura de carpetas
- Links a documentación

---

## VERIFICACIÓN FINAL

Al terminar, lista todos los archivos creados y confirma:
- [ ] Carpetas .doc/ y src/ creadas
- [ ] CLAUDE.md en raíz
- [ ] AGENTS.md en raíz  
- [ ] 7 documentos en .doc/
- [ ] .env.local base
- [ ] .gitignore
- [ ] prisma/schema.prisma base
- [ ] README.md

NO inicialices el proyecto de Next.js (no corras npx create-next-app).
Eso lo hace Carlos manualmente para aprender el proceso.
Solo crea los archivos de estructura y documentación.
