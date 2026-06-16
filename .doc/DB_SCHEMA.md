# DB_SCHEMA.md — ActivoPOS
# Modelo de datos canónico — fuente de verdad
# Versión: 1.0 | Junio 2026
# ⚠️ Toda migración Prisma debe respetar este esquema

---

## PRINCIPIOS DEL MODELO

- **Sin branch_id** en ninguna tabla transaccional (v1)
- **Moneda en USD** como referencia interna — Bs al cobrar
- **Snapshots** en sale_items: guardar nombre y precio al momento de venta
- **sale_status** como máquina de estados: `quote → pending → paid → cancelled`
- **product_type** para adaptar a cualquier negocio sin lógica específica
- **net_qty** como campo VIRTUAL en inventory_entries

---

## TABLAS PRINCIPALES

### businesses
```prisma
model Business {
  id                    Int       @id @default(autoincrement())
  name                  String    @db.VarChar(255)
  legal_name            String?   @db.VarChar(255)
  rif                   String?   @db.VarChar(20)
  logo_path             String?
  address               String?
  city                  String?
  state                 String?
  phone                 String?
  email                 String?
  theme                 String    @default("dark")        // dark | light
  theme_color           String    @default("#2563EB")     // color de acento
  ticket_prefix         String    @default("VEN")        @db.VarChar(10)
  ticket_footer         String?   @db.Text
  currency_default      String    @default("USD")
  rate_source           String    @default("bcv")
  subscription_active   Boolean   @default(true)
  onboarding_completed  Boolean   @default(false)
  active                Boolean   @default(true)
  settings              Json?
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  users                 User[]
  products              Product[]
  sales                 Sale[]
  cash_registers        CashRegister[]
  clients               Client[]
  payment_methods       PaymentMethod[]
  activity_logs         ActivityLog[]
}
```

### users
```prisma
model User {
  id            Int       @id @default(autoincrement())
  business_id   Int
  name          String    @db.VarChar(255)
  email         String?   @unique @db.VarChar(255)
  password      String    @db.VarChar(255)
  role          Role      @default(cashier)
  is_active     Boolean   @default(true)
  access_start  String?   @db.VarChar(5)   // HH:MM
  access_end    String?   @db.VarChar(5)   // HH:MM
  access_days   Json?                       // ["mon","tue",...]
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  business      Business  @relation(fields: [business_id], references: [id])
  sales         Sale[]
  activity_logs ActivityLog[]
}

enum Role {
  super_admin
  admin
  cashier
}
```

### products
```prisma
model Product {
  id                Int       @id @default(autoincrement())
  business_id       Int
  category_id       Int?
  name              String    @db.VarChar(120)
  barcode           String?   @db.VarChar(50)
  sku               String?   @db.VarChar(50)
  description       String?   @db.Text
  sale_mode         SaleMode  @default(unit)   // weight | unit | service
  product_type      String    @default("physical") // physical | service | intangible
  base_unit_label   String    @default("und")  @db.VarChar(10)
  price_per_kg_usd  Decimal?  @db.Decimal(10,2)
  price_per_unit_usd Decimal? @db.Decimal(10,2)
  cost_per_unit_usd Decimal?  @db.Decimal(10,4)
  min_stock         Decimal   @default(0) @db.Decimal(8,3)
  image_path        String?
  is_favorite       Boolean   @default(false)
  active            Boolean   @default(true)
  sort_order        Int       @default(0)
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  business          Business        @relation(fields: [business_id], references: [id])
  category          Category?       @relation(fields: [category_id], references: [id])
  inventory_entries InventoryEntry[]
  sale_items        SaleItem[]
}

enum SaleMode {
  weight      // venta por kg — precio por kg
  unit        // venta por unidad — precio por unidad
  service     // sin descuento de inventario
}
```

### categories
```prisma
model Category {
  id          Int       @id @default(autoincrement())
  business_id Int
  name        String    @db.VarChar(80)
  color       String?   @db.VarChar(20)
  sort_order  Int       @default(0)
  active      Boolean   @default(true)

  business    Business  @relation(fields: [business_id], references: [id])
  products    Product[]
}
```

### inventory_entries
```prisma
model InventoryEntry {
  id              Int       @id @default(autoincrement())
  business_id     Int
  product_id      Int
  quantity        Decimal   @db.Decimal(10,3)   // cantidad entrada
  waste           Decimal   @default(0) @db.Decimal(10,3)
  // net_qty = quantity - waste  (VIRTUAL — calcular en queries)
  cost_per_unit_usd Decimal? @db.Decimal(10,4)
  supplier        String?   @db.VarChar(120)
  notes           String?   @db.Text
  entered_at      DateTime  @default(now())
  created_by      Int
  created_at      DateTime  @default(now())

  business        Business  @relation(fields: [business_id], references: [id])
  product         Product   @relation(fields: [product_id], references: [id])
}
```

### sales
```prisma
model Sale {
  id               Int         @id @default(autoincrement())
  business_id      Int
  cashier_id       Int
  ticket_number    String      @db.VarChar(20)    // VEN-00001
  status           SaleStatus  @default(pending)
  origin           SaleOrigin  @default(pos)
  total_usd        Decimal     @db.Decimal(10,2)
  total_bs         Decimal     @db.Decimal(12,2)
  rate_used        Decimal     @db.Decimal(10,4)
  client_id        Int?
  client_name      String?     @db.VarChar(120)
  client_phone     String?     @db.VarChar(20)
  notes            String?     @db.Text
  accounting_date  DateTime?   @db.Date
  sold_at          DateTime?
  created_at       DateTime    @default(now())
  updated_at       DateTime    @updatedAt

  business         Business      @relation(fields: [business_id], references: [id])
  cashier          User          @relation(fields: [cashier_id], references: [id])
  client           Client?       @relation(fields: [client_id], references: [id])
  items            SaleItem[]
  payments         SalePayment[]
  abonos           SaleAbono[]
}

enum SaleStatus {
  quote       // cotización — no descuenta stock
  pending     // venta a crédito — descuenta stock al confirmar
  paid        // pagado — stock descontado
  cancelled   // anulado
}

enum SaleOrigin {
  pos         // venta directa en mostrador
  quote       // generada desde cotizaciones
  credit      // venta a crédito
}
```

### sale_items
```prisma
model SaleItem {
  id                 Int      @id @default(autoincrement())
  sale_id            Int
  product_id         Int
  // SNAPSHOTS al momento de venta — nunca referenciar producto directo
  product_name       String   @db.VarChar(120)
  sale_mode          String   @db.VarChar(10)
  unit_label         String   @db.VarChar(10)
  quantity           Decimal  @db.Decimal(10,3)
  price_per_unit_usd Decimal  @db.Decimal(10,4)
  subtotal_usd       Decimal  @db.Decimal(10,2)
  subtotal_bs        Decimal  @db.Decimal(12,2)
  rate_used          Decimal  @db.Decimal(10,4)
  discount_usd       Decimal  @default(0) @db.Decimal(10,2)

  sale               Sale     @relation(fields: [sale_id], references: [id])
  product            Product  @relation(fields: [product_id], references: [id])
}
```

### sale_payments
```prisma
model SalePayment {
  id                Int           @id @default(autoincrement())
  sale_id           Int
  payment_method_id Int
  amount_bs         Decimal       @db.Decimal(12,2)
  amount_usd        Decimal       @db.Decimal(10,2)
  reference         String?       @db.VarChar(100)
  rate_used         Decimal       @db.Decimal(10,4)
  created_at        DateTime      @default(now())

  sale              Sale          @relation(fields: [sale_id], references: [id])
  payment_method    PaymentMethod @relation(fields: [payment_method_id], references: [id])
}
```

### sale_abonos (crédito parcial)
```prisma
model SaleAbono {
  id                Int           @id @default(autoincrement())
  sale_id           Int
  payment_method_id Int
  amount_bs         Decimal       @db.Decimal(12,2)
  amount_usd        Decimal       @db.Decimal(10,2)
  reference         String?       @db.VarChar(100)
  rate_used         Decimal       @db.Decimal(10,4)
  notes             String?       @db.Text
  created_by        Int
  created_at        DateTime      @default(now())

  sale              Sale          @relation(fields: [sale_id], references: [id])
  payment_method    PaymentMethod @relation(fields: [payment_method_id], references: [id])
}
```

### payment_methods
```prisma
model PaymentMethod {
  id          Int     @id @default(autoincrement())
  business_id Int
  name        String  @db.VarChar(60)   // "Efectivo Bs", "Pago Móvil", "Zelle"...
  type        PmType  @default(cash)
  is_active   Boolean @default(true)
  sort_order  Int     @default(0)

  business    Business      @relation(fields: [business_id], references: [id])
  payments    SalePayment[]
  abonos      SaleAbono[]
  movements   CashMovement[]
}

enum PmType {
  cash          // efectivo (Bs o USD)
  transfer      // pago móvil, transferencia
  zelle
  binance
  card          // débito/crédito
  other
}
```

### cash_registers
```prisma
model CashRegister {
  id                   Int       @id @default(autoincrement())
  business_id          Int
  cashier_id           Int
  opening_amount_bs    Decimal   @default(0) @db.Decimal(12,2)
  opening_amount_usd   Decimal   @default(0) @db.Decimal(10,2)
  closing_amount_bs    Decimal?  @db.Decimal(12,2)
  closing_amount_usd   Decimal?  @db.Decimal(10,2)
  rate_at_open         Decimal   @db.Decimal(10,4)
  opened_at            DateTime  @default(now())
  closed_at            DateTime?
  close_notes          String?   @db.Text

  business             Business       @relation(fields: [business_id], references: [id])
  cashier              User           @relation(fields: [cashier_id], references: [id])
  movements            CashMovement[]
}
```

### cash_movements
```prisma
model CashMovement {
  id                Int           @id @default(autoincrement())
  business_id       Int
  cash_register_id  Int
  payment_method_id Int?
  type              MoveType      // in | out
  amount_bs         Decimal       @db.Decimal(12,2)
  amount_usd        Decimal       @db.Decimal(10,2)
  rate_used         Decimal       @db.Decimal(10,4)
  concept           String        @db.VarChar(150)
  created_by        Int
  created_at        DateTime      @default(now())

  cash_register     CashRegister  @relation(fields: [cash_register_id], references: [id])
  payment_method    PaymentMethod? @relation(fields: [payment_method_id], references: [id])
}

enum MoveType {
  in
  out
}
```

### clients
```prisma
model Client {
  id          Int      @id @default(autoincrement())
  business_id Int
  name        String   @db.VarChar(120)
  phone       String?  @db.VarChar(20)
  email       String?  @db.VarChar(120)
  cedula      String?  @db.VarChar(15)
  notes       String?  @db.Text
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  business    Business @relation(fields: [business_id], references: [id])
  sales       Sale[]
}
```

### dollar_rates
```prisma
model DollarRate {
  id           Int      @id @default(autoincrement())
  rate         Decimal  @db.Decimal(10,4)
  source       String   @default("bcv") @db.VarChar(20)
  is_active    Boolean  @default(true)
  fetched_at   DateTime @default(now())
  created_at   DateTime @default(now())
}
```

### activity_logs
```prisma
model ActivityLog {
  id          Int      @id @default(autoincrement())
  business_id Int
  user_id     Int
  action      String   @db.VarChar(60)   // 'sale.void', 'inventory.adjust', 'cash.close'
  model_type  String?  @db.VarChar(60)
  model_id    Int?
  reason      String?  @db.Text          // motivo obligatorio en anulaciones
  old_values  Json?
  new_values  Json?
  ip_address  String?  @db.VarChar(45)
  created_at  DateTime @default(now())

  business    Business @relation(fields: [business_id], references: [id])
  user        User     @relation(fields: [user_id], references: [id])
}
```

---

## CÁLCULO DE STOCK (lógica canónica)

```typescript
// Stock disponible de un producto
const stock = await prisma.inventoryEntry.aggregate({
  where: { product_id: productId, business_id: businessId },
  _sum: { quantity: true, waste: true }
})
const net = (stock._sum.quantity ?? 0) - (stock._sum.waste ?? 0)

// Al pagar una venta: crear entrada negativa en inventory_entries
// quantity = -qty_vendida, waste = 0
// NUNCA descontar en el momento de crear el ticket — solo al pagar
```

---

## MÉTODOS DE PAGO DEFAULT (seed al crear negocio)

```
1. Efectivo Bs      → type: cash
2. Efectivo USD     → type: cash
3. Pago Móvil       → type: transfer
4. Zelle            → type: zelle
5. Transferencia    → type: transfer
6. Binance USDT     → type: binance
```
