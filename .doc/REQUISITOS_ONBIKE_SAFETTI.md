# REQUISITOS PERMANENTES — OnBike / Safetti

Fuente: instrucción de Carlos (2026-10-19). Se lee ANTES de tocar nada en el sprint de Safetti y se cumple TODO.
Lo que no se pueda cumplir se reporta en una sección **"NO CUMPLIDO"** al inicio del reporte, con motivo y archivo:línea.

1. Cada etiqueta escaneada = 1 pieza, salvo las medias 83919G (7 piezas, talla única, sin talla).
2. Un producto por handle de safetti.com (un color), con tallas como variantes, stock = unidades por talla y nombre = título web.
3. La referencia (5 dígitos + letra, ej. 11746H) va en la DESCRIPCIÓN del producto y en el SKU (nivel producto y variante).
   Las notas se usan solo para marcas ("talla de etiqueta, no está en web", "CORREGIR TALLA").
4. Precios 120/110; manga larga 140/115 para las refs 12977H, 12975H, 12967H, 12635H, 12974H, 12966H.
5. Se excluyen SOLO los guantes (86491H, 86492H, 86581E). Nada más se descarta.
6. Las tallas de etiqueta que no están en la web (3XL, XS) se agregan marcadas. Las variantes sin talla quedan como "POR DEFINIR".
7. Marca SAFETTI (id 3 en el 33) y categoría por tipo en cada producto.
8. Barcode y SKU por variante; el POS encuentra el producto y su talla escaneando el EAN.
9. Todas las fotos del producto (hasta 6) se guardan y se muestran al editar.
10. Producción: solo business_id=33, con respaldo y ensayo ROLLBACK antes; nada se despliega ni se importa sin orden de Carlos.

## Nuevo en este sprint

El importador debe leer una columna `descripcion` hacia `products.description` (verificar que el campo exista).
El Excel v2 lleva "Ref: 11953H" en la descripción de cada producto, la ref en el sku y las notas solo para marcas.
