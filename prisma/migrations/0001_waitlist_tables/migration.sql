-- Waitlisted-owned tables only. The POS tables belong to restaurant-pos Flyway; run this after the POS stack is up.

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guest_name" VARCHAR(100) NOT NULL,
    "party_size" INTEGER NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    "access_token" VARCHAR(64) NOT NULL,
    "estimated_wait_minutes" INTEGER,
    "preferred_zone" VARCHAR(50),
    "queue_position" INTEGER,
    "notified_at" TIMESTAMP(6),
    "seated_at" TIMESTAMP(6),
    "seated_table_id" UUID,
    "seated_by_user_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "waitlist_entry_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "fired_order_id" UUID,
    "fired_by_user_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pre_order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "special_instructions" TEXT,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_order_items_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_access_token_key" ON "waitlist_entries"("access_token");

-- CreateIndex
CREATE INDEX "waitlist_entries_status_idx" ON "waitlist_entries"("status");

-- CreateIndex
CREATE INDEX "waitlist_entries_created_at_idx" ON "waitlist_entries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pre_orders_waitlist_entry_id_key" ON "pre_orders"("waitlist_entry_id");

-- CreateIndex
CREATE INDEX "pre_orders_status_idx" ON "pre_orders"("status");

-- CreateIndex
CREATE INDEX "pre_order_items_pre_order_id_idx" ON "pre_order_items"("pre_order_id");

-- AddForeignKey
ALTER TABLE "pre_orders" ADD CONSTRAINT "pre_orders_waitlist_entry_id_fkey" FOREIGN KEY ("waitlist_entry_id") REFERENCES "waitlist_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_order_items" ADD CONSTRAINT "pre_order_items_pre_order_id_fkey" FOREIGN KEY ("pre_order_id") REFERENCES "pre_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
