-- Dedup existing orders before adding unique index
-- Step 1: delete order_items belonging to duplicate orders (keep lowest id)
DELETE oi FROM order_items oi
INNER JOIN (
  SELECT business_id, order_number, MIN(id) AS keep_id
  FROM orders
  GROUP BY business_id, order_number
  HAVING COUNT(*) > 1
) dup ON oi.order_id IN (
  SELECT id FROM orders o2
  WHERE o2.business_id = dup.business_id
    AND o2.order_number = dup.order_number
    AND o2.id <> dup.keep_id
);

-- Step 2: delete the duplicate order rows (keep lowest id)
DELETE o FROM orders o
INNER JOIN (
  SELECT business_id, order_number, MIN(id) AS keep_id
  FROM orders
  GROUP BY business_id, order_number
  HAVING COUNT(*) > 1
) dup ON o.business_id = dup.business_id
      AND o.order_number = dup.order_number
      AND o.id <> dup.keep_id;

-- AddUniqueConstraint: orders(business_id, order_number)
CREATE UNIQUE INDEX `orders_business_id_order_number_key` ON `orders`(`business_id`, `order_number`);
