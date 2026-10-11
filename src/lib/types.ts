export type Stage = 'Cutting' | 'Sewing' | 'Ready' | 'Delivered';
export type Role = 'Admin' | 'Front desk' | 'Tailor';
export type Lang = 'English' | 'Dari' | 'Pashto';
export type Calendar = 'Solar Hijri' | 'Gregorian';

export type MeasKey =
  | 'shoulder' | 'chest' | 'waist' | 'hem' | 'length' | 'sleeve' | 'collar'
  | 'tlength' | 'twaist' | 'thigh' | 'cuff';
export type Meas = Partial<Record<MeasKey, number | null>>;

export interface Garment { name: string; price: number; m: number }

export interface Shop {
  id: string;
  name: string;
  phone: string | null;
  calendar: Calendar;
  lang: Lang;
  flip_rtl: boolean;
  receipt_printer: string;
  label_printer: string;
  auto_backup: boolean;
  last_backup: string | null;
  order_prefix: string;
  low_fabric_m: number;
  low_perfume: number;
  garments: Garment[];
  created_at?: string;
  updated_at?: string;
}

export interface Staff {
  id: string;
  shop_id: string;
  name: string;
  role: Role;
  phone: string | null;
  active: boolean;
  piece_rate: number;
  pin_hash: string | null;
  pin_salt: string | null;
  last_seen: string | null;
  user_id?: string | null; // set when this person is a Supabase Auth user (always Admin)
  created_at?: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  code: string;
  name: string;
  phone: string;
  since: number;
  meas: Meas;
  created_at?: string;
}

export interface HistoryEntry {
  id: string;
  shop_id: string;
  customer_id: string;
  staff_id: string | null;
  text: string;
  meas: Meas;
  created_at: string;
}

export interface Fabric {
  id: string;
  shop_id: string;
  code: string;
  name: string;
  color: string;
  swatch: string;
  metres_left: number;
  metres_of: number;
  price_per_metre: number;
  created_at?: string;
}

export interface Perfume {
  id: string;
  shop_id: string;
  code: string;
  name: string;
  size: string;
  price: number;
  stock: number;
  tint: string;
  created_at?: string;
}

export interface Order {
  id: string;
  shop_id: string;
  code: string;
  customer_id: string;
  garment: string;
  qty: number;
  fabric_id: string | null;
  metres: number;
  tailor_id: string | null;
  stage: Stage;
  due: string; // YYYY-MM-DD
  total: number;
  paid: number;
  notes: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  shop_id: string;
  order_id: string;
  amount: number;
  staff_id: string | null;
  created_at: string;
}

export interface FabricMovement {
  id: string;
  shop_id: string;
  fabric_id: string;
  delta: number;
  reason: 'order' | 'sale' | 'restock' | 'adjust';
  order_id: string | null;
  staff_id: string | null;
  created_at: string;
}

export interface PerfumeMovement {
  id: string;
  shop_id: string;
  perfume_id: string;
  delta: number;
  reason: 'sale' | 'restock' | 'adjust';
  unit_price: number | null;
  staff_id: string | null;
  created_at: string;
}

export type CashDirection = 'in' | 'out';
export type CashCategory = 'fabric_sale' | 'perfume_sale' | 'opening' | 'other_in' | 'wages' | 'rent' | 'bills' | 'purchase' | 'other_out';

/** Cash book: money in that is not an order payment (sales, opening cash) and every money out. */
export interface CashEntry {
  id: string;
  shop_id: string;
  direction: CashDirection;
  amount: number;
  category: CashCategory;
  note: string | null;
  staff_id: string | null;
  created_at: string;
}

/** Everything the app keeps for one shop. */
export interface Snapshot {
  shop: Shop | null;
  staff: Staff[];
  customers: Customer[];
  measurement_history: HistoryEntry[];
  fabrics: Fabric[];
  perfumes: Perfume[];
  orders: Order[];
  payments: Payment[];
  cash_entries: CashEntry[];
}

export type ListTable = Exclude<keyof Snapshot, 'shop'>;
export type LedgerTable = 'fabric_movements' | 'perfume_movements';
export type WriteTable = ListTable | LedgerTable;

/** A queued change. Applied locally at once, pushed to Supabase when online. */
export type Op =
  | { id: string; ts: number; kind: 'insert'; table: WriteTable; row: Record<string, unknown> }
  | { id: string; ts: number; kind: 'update'; table: ListTable; rowId: string; patch: Record<string, unknown> }
  | { id: string; ts: number; kind: 'shop'; patch: Partial<Shop> };

export interface FailedOp { op: Op; error: string }
