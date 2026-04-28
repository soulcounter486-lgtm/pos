// Product and Category types
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  barcode?: string;
  stock: number;
  image_url?: string;
  tax_rate?: number;
}

export interface Category {
  id: string;
  name: string;
  tax_rate?: number;
}

// Supabase InsertResult type (commonly used in this project)
export type InsertResult<T = any> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};
