import type { Line, ProductStatus, MovementType } from "@/domain/types";

export interface ProductRow {
  id: string;
  name: string;
  line: Line;
  type: string;
  description: string;
  price: number; // centavos
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface VariantRow {
  id: string;
  product_id: string;
  color: string;
  color_hex: string;
  size: string;
  stock: number;
  sku: string | null;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
  color: string | null;
}

export interface StockMovementRow {
  id: string;
  variant_id: string;
  delta: number;
  type: MovementType;
  reference: string | null;
  reason: string | null;
  po_item_id: string | null;
  order_item_id: string | null;
  created_at: string;
}

export interface InventoryLotRow {
  id: string;
  variant_id: string;
  source_movement_id: string | null;
  unit_cost: number; // centavos
  qty_received: number;
  qty_remaining: number;
  created_at: string;
}

export interface InventoryConsumptionRow {
  id: string;
  movement_id: string;
  lot_id: string;
  qty: number;
  unit_cost: number; // centavos
}
