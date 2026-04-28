// Table types
export interface Table {
  id: string;
  name: string;
  status: 'available' | 'occupied';
}

// Additional table-related types (if needed)
export type TableStatus = 'available' | 'occupied';
