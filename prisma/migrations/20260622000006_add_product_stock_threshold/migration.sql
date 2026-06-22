-- Add stock_alert_threshold to products table
ALTER TABLE `products`
  ADD COLUMN `stock_alert_threshold` INT NOT NULL DEFAULT 5;
