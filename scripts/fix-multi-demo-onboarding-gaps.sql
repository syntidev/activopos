-- ============================================================
-- ActivoPOS — Cerrar gaps de onboarding en multi-demo
-- Sprint Demo-7 | 2026-07-12
--
-- Diff confirmado contra src/app/api/onboarding/setup/route.ts (flujo
-- real de registro): multi-demo se creó con INSERT directo y le
-- faltaban 2 cosas reales que el registro real siempre siembra:
--   1. payment_methods (4 defaults, siempre -- PAYMENT_METHODS array
--      del endpoint, no depende de lo que el wizard mande)
--   2. onboarding_completed=true
-- Más un fix cosmético (city).
-- expense_categories NO se toca acá -- gap real pero fuera de scope
-- de este fix puntual (no afecta catálogo público, solo Finanzas).
-- ============================================================

SET NAMES utf8mb4;

SET @bid = (SELECT id FROM businesses WHERE catalog_slug = 'multi-demo');
SELECT @bid AS business_id;

-- ── 1. payment_methods — mismos 4 defaults del endpoint real ──
-- PAYMENT_METHODS en /api/onboarding/setup/route.ts:
--   Efectivo Bs (cash, 1) / Efectivo USD (cash, 2) / Pago Móvil (transfer, 3) / Zelle (zelle, 4)
INSERT INTO payment_methods (business_id, name, type, is_active, sort_order) VALUES
(@bid, 'Efectivo Bs',  'cash',     1, 1),
(@bid, 'Efectivo USD', 'cash',     1, 2),
(@bid, 'Pago Móvil',   'transfer', 1, 3),
(@bid, 'Zelle',        'zelle',    1, 4);

-- ── 2. onboarding_completed ──────────────────────────────────
UPDATE businesses SET onboarding_completed = 1 WHERE catalog_slug = 'multi-demo';

-- ── 3. city (cosmético) ───────────────────────────────────────
UPDATE businesses SET city = 'Caracas' WHERE catalog_slug = 'multi-demo';

-- ── Verificación ──────────────────────────────────────────────
SELECT COUNT(*) AS payment_methods_creados FROM payment_methods WHERE business_id = @bid;
SELECT onboarding_completed, city FROM businesses WHERE catalog_slug = 'multi-demo';
