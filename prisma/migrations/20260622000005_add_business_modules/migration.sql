-- Add modules_enabled to businesses table
ALTER TABLE `businesses`
  ADD COLUMN `modules_enabled` VARCHAR(500) NOT NULL DEFAULT 'pos,inventory,caja,pedidos,catalog,finanzas,reportes,analytics';
