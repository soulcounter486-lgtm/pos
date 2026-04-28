// Order and OrderItem types
// Enriched UI model (used in kitchen orders page)
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  note?: string;
  product_name?: string;
  product_image_url?: string;
  category?: string;
  status?: string;
}

export interface Order {
  id: string;
  table_id: string;
  table_name?: string;
  total: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

// Raw database types (used in StaffPos for Supabase queries)
export interface OrderData {
  id: string;
  table_id: string;
  total: number;
  status: string;
  created_at: string;
  total_amount?: number;
  tax_amount?: number;
}

export interface OrderItemData {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  unit_price?: number;
  status: string;
  note?: string;
}

// History entry for local storage order history
export interface HistoryEntry {
  id: string;
  timestamp: string;
  tableNumber: string;
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  totalAmount: number;
  type: 'order' | 'edit';
}
