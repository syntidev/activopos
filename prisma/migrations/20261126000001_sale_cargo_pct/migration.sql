-- sales.cargo_pct: cargo global del ticket en % (POS). Ya estaba en schema.prisma SIN migración; en el VPS la columna ya existe (db push),
-- así que esta migración se MARCA como aplicada (migrate resolve --applied) y, si alguna vez se ejecuta, es un no-op.
-- Aditiva e IDEMPOTENTE: agrega la columna solo si falta. Equivale a `ADD COLUMN IF NOT EXISTS` (MariaDB), pero con la guarda por
-- information_schema porque MySQL 8 no acepta esa sintaxis y la misma migración debe correr igual en ambos motores.
SET @cargo_pct_existe := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'cargo_pct'
);
SET @cargo_pct_sql := IF(
  @cargo_pct_existe = 0,
  'ALTER TABLE `sales` ADD COLUMN `cargo_pct` DOUBLE NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE cargo_pct_stmt FROM @cargo_pct_sql;
EXECUTE cargo_pct_stmt;
DEALLOCATE PREPARE cargo_pct_stmt;
