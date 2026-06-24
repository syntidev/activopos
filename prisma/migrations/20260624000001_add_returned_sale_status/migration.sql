-- AddEnumValue: SaleStatus.returned
ALTER TABLE `sales` MODIFY COLUMN `status` ENUM('draft','quote','pending','paid','cancelled','returned') NOT NULL DEFAULT 'pending';
