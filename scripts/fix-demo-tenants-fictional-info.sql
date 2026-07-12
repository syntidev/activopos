-- ============================================================
-- ActivoPOS — Datos de contacto ficticios para tenants demo
-- Sprint Demo-8 | 2026-07-12
--
-- boutique-demo y multi-demo son demos publicos -- necesitan verse
-- completos (telefono/instagram/direccion/horario/RIF/razon social/
-- email) pero con datos 100% ficticios, no numeros/cuentas reales.
-- No se toca CatalogoGrid.tsx (CLI-B) -- el WhatsApp/Instagram siguen
-- siendo links reales pero a numeros/cuentas ficticias, no rompen nada,
-- solo no van a ningun destino real. Icono de correo no existe en el
-- codigo actual (confirmado) -- el campo email se llena igual por
-- completitud de datos aunque hoy no se renderice en el catalogo.
-- ============================================================

SET NAMES utf8mb4;

UPDATE businesses SET
  legal_name        = 'Boutique Demo Pro, C.A.',
  rif                = 'J-40123456-7',
  address            = 'Av. Francisco de Miranda, C.C. Lido, Local 12',
  state              = 'Distrito Capital',
  phone              = '584121234567',
  email              = 'contacto@boutiquedemo.com',
  catalog_instagram  = 'boutiquedemo',
  catalog_hours      = 'Lun - Sáb: 9:00am - 7:00pm'
WHERE catalog_slug = 'boutique-demo';

UPDATE businesses SET
  legal_name        = 'Abasto Multi Demo, C.A.',
  rif                = 'J-40987654-3',
  address            = 'Av. Libertador, Sector El Rosal',
  state              = 'Distrito Capital',
  phone              = '584169876543',
  email              = 'contacto@abastomultidemo.com',
  catalog_instagram  = 'abastomultidemo',
  catalog_hours      = 'Lun - Dom: 7:00am - 9:00pm'
WHERE catalog_slug = 'multi-demo';

SELECT catalog_slug, legal_name, rif, address, city, state, phone, email, catalog_instagram, catalog_hours
FROM businesses WHERE catalog_slug IN ('boutique-demo','multi-demo');
