AUDITORIA DE CATEGORIAS, MARCAS Y ORDEN EN EL CATALOGO
Fecha: 2026-10-16 | Solo lectura, sin cambios de codigo, sin deploy

======================================================================
1) COMO SE EDITA Category.sort_order EN EL PANEL
======================================================================

Hay interfaz de reordenamiento: flechas izquierda/derecha. No hay arrastrar ni campo numerico.

- Archivo: src/app/(dashboard)/productos/page.tsx
- Boton "Ordenar" (activa el modo): lineas 810-814 (estado reorderMode en :190, reordering en :191).
- Flechas por categoria (ChevronLeft / ChevronRight): lineas 765-785; la primera deshabilita "izquierda", la ultima "derecha".
- Texto de ayuda del modo: linea ~820 ("Usa las flechas para ordenar. Las primeras categorias con productos aparecen en la portada del catalogo (hasta 4).").
- Logica: moveCategory, lineas 493-516.

Reasigna la secuencia completa: SI.
- Intercambia dos posiciones en el arreglo local (optimista) y luego hace un PATCH por CADA categoria con sort_order = indice (0..n-1) (lineas 505-512, Promise.all, una peticion por categoria).
- Endpoint: PATCH /api/categories/[id] (src/app/api/categories/[id]/route.ts:9 acepta sort_order entero; :36 hace el update).
- No es atomico: son n peticiones independientes; si una falla, la secuencia queda mezclada hasta el siguiente fetchCategories.

Otros lugares donde entra sort_order:
- Crear categoria: el modal (handleSaveCategory, productos/page.tsx:461-475) hace POST a /api/products/categories (src/app/api/products/categories/route.ts:4, que solo re-exporta POST de /api/categories). El cuerpo NO envia sort_order, asi que el zod (src/app/api/categories/route.ts:12) aplica default(0). Una categoria nueva queda con 0 y empata con la primera.
- Registro (onboarding): src/app/registro/page.tsx:78-82 si manda sort_order = indice.
- GET /api/categories ordena por sort_order asc y luego name asc (route.ts:25).
- Dato real (BD local, negocio 87): 26 categorias, sort_order 0..5 y luego 100, 101, 102... (saltos; el panel no los renumera hasta que se usa "Ordenar").

======================================================================
2) JERARQUIA EN Category
======================================================================

No existe. prisma/schema.prisma:335-348 define Category con: id, business_id, name, color, image_url, sort_order, active, requires_preparation, y las relaciones business y products. No hay parent_id ni ningun campo de jerarquia. (El unico parent_id del schema es ProductComponent.parent_id, linea 1091, que es de combos, no de categorias.)
Unicidad: @@unique([business_id, name]) (:345).

======================================================================
3) MODELO Brand
======================================================================

- Tabla real: "brands" (@@map, schema.prisma:543). Modelo en :530-544.
- Campos: id, business_id, name (VarChar 60), image_url (VarChar 500, opcional), search_term (VarChar 60), order (Int, default 0), visible (Boolean, default true), created_at. Indice (business_id, order).
- NO hay relacion con Product (Product no tiene brand_id).

Donde se crea y edita:
- UI: src/app/(dashboard)/configuracion/tabs/TabBrands.tsx (alta :124, edicion :144, borrar :69, subir/bajar con ChevronUp/ChevronDown, visible con Eye/EyeOff).
- API: src/app/api/brands/route.ts (GET :16-27, POST :29-); src/app/api/brands/[id]/route.ts (PATCH, DELETE). POST agrega al final: order = count de marcas (route.ts "const order = await db.brand.count()"). Rol cashier bloqueado.
- Reordenar marcas NO reasigna toda la secuencia: intercambia el campo order entre dos marcas vecinas (TabBrands.tsx:85-93, dos PATCH).

Que hace search_term en el catalogo:
- Solo existe en el catalogo PREMIUM. Lectura: catalogo-premium/[slug]/page.tsx:231-241 y productos/page.tsx:109-115 (solo marcas visible=true, orden por order asc).
- Cada tarjeta de marca es un enlace a /catalogo-premium/{slug}/productos?buscar={search_term} (CatalogoGrid.tsx premium :1213, con encodeURIComponent).
- La pagina /productos pasa searchParams.buscar como initialQuery (productos/page.tsx:235) y el grid lo usa como texto de busqueda (CatalogoGrid premium :199).
- La busqueda compara SOLO contra el nombre del producto y el nombre de la categoria (CatalogoGrid premium ~:340-346). Por eso una marca solo "funciona" si su search_term aparece escrito en el nombre del producto.
- El filtro "Marca" del panel de filtros (premium, filterBrands) usa el mismo criterio de texto contra p.name (:370-381); el propio codigo lo documenta como GAP-BRAND-FILTER (no es un filtro relacional).
- El catalogo clasico no muestra marcas.

======================================================================
4) CATEGORIAS SIN PRODUCTOS Y PRODUCTOS SIN CATEGORIA EN EL CATALOGO PUBLICO
======================================================================

Categorias sin productos: NO se muestran (clasico y premium).
- La lista que alimenta chips/pestanas/sidebar/secciones se deriva de los PRODUCTOS cargados, no de la tabla categories:
  - Premium: catalogo-premium/[slug]/page.tsx:324-336 (catMeta se llena recorriendo products; categories = claves de catMeta ordenadas).
  - Clasico: catalogo/[slug]/page.tsx:192-200, mismo patron.
  - En ambos, la consulta de categorias de BD (premium page.tsx:211-215; clasico page.tsx:132-136) solo se usa para imagenes y para resolver los bloques category_list; las secciones ademas filtran items.length > 0 (CatalogoGrid premium :413-415; clasico equivalente).
- Una categoria con active=false cuyos productos siguen visibles SI aparece: la consulta de productos no filtra por Category.active (include: category { select name, color, sort_order }). Es un detalle de datos, no verificado en produccion.
- Bloque category_list (landing premium): descarta categorias sin productos (page.tsx:383-387, "cat && catMeta.has(cat.name)").

Productos sin categoria: caen en una seccion llamada "Otros".
- Clave interna '__otros__' (ORPHAN_KEY).
  - Premium: CatalogoGrid.tsx:402 (definicion), :416 (seccion "Otros" al FINAL de la lista).
  - Clasico: CatalogoGrid.tsx:276, :290; encabezado especial en :1048.
- "Otros" solo existe como seccion del modo browse (estanterias apiladas). NO es una categoria navegable: no aparece en chips, pestanas ni sidebar (esas listas salen de categories, que no la incluye). En /productos con filtro de categoria no hay forma de elegir "Otros"; solo se ven en el listado completo sin filtro.
- Tampoco se les asigna color (color: null).
- Tambien incluye productos cuyo nombre de categoria no este en la lista (por ejemplo categoria desconocida).

======================================================================
5) CATALOGO PREMIUM: ¿MISMO sort_order EN SECCIONES, CIRCULOS Y CHIPS?
======================================================================

Secciones y chips (pestanas/sidebar): SI, el mismo orden.
- Un solo arreglo categories (premium page.tsx:333-335): ordena por Category.sort_order y desempata con name.localeCompare.
- Secciones del modo browse: CatalogoGrid premium :406-418 recorren categories en ese orden.
- Pestanas superiores: :996. Sidebar de /productos: :1065. Ambos iteran categories.
- Panel de filtros: categories={categories} (:1445).

Circulos de categoria: NO existen en el premium como elemento de la home propio.
- La prop categoryImages se declara (CatalogoGrid premium :86, :171) pero no se usa dentro del componente premium (sin otras referencias).
- Lo mas parecido es el bloque de landing "category_list" (LandingSections.tsx:272 y siguientes; tarjetas brandCard). Su orden NO usa sort_order: sigue el orden de config.category_ids elegido en Configuracion > Landing (page.tsx:383-386, flatMap sobre category_ids).
- Los circulos de categoria (catCircleTrack) estan en el catalogo CLASICO (catalogo/[slug]/CatalogoGrid.tsx:908-910), recorren categories (mismo sort_order) y usan categoryImages.

Resumen del orden: secciones = chips = pestanas = sidebar = sort_order (desempate por nombre). El bloque category_list del premium usa un orden propio (el de la configuracion de la landing). Marcas usan su propio campo order.

Nota de empates: sort_order no es unico; categorias nuevas nacen en 0 (ver punto 1) y empatan con la primera; entre empatadas manda el nombre alfabetico (localeCompare).

======================================================================
FIN
======================================================================
