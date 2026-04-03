export type Role = 'super_admin' | 'admin' | 'manager' | 'teacher' | 'student';

export type ReimbursementCategory =
  | '个人药品'
  | '外送检测'
  | '设备配件'
  | '加工定制'
  | '办公打印'
  | '差旅费'
  | '邮寄快递'
  | '其他';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  managed_modules: string[];
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  author_id: string;
  author?: Profile;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  category: string;
  content: string;
  author_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SupplyCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface Supply {
  id: string;
  category_id: string;
  category?: SupplyCategory;
  name: string;
  specification: string;
  stock: number;
  unit: string;
  min_stock: number;
  updated_at: string;
}

export interface SupplyReservation {
  id: string;
  supply_id: string;
  supply?: Supply;
  user_id: string;
  user?: Profile;
  quantity: number;
  purpose: string;
  is_returnable: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reviewer_id: string | null;
  reviewer?: Profile;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface SupplyBorrowing {
  id: string;
  supply_id: string;
  supply?: Supply;
  user_id: string;
  user?: Profile;
  quantity: number;
  purpose: string;
  status: 'borrowed' | 'returned' | 'lost';
  borrowed_at: string;
  returned_at: string | null;
  notes: string | null;
}

export interface Chemical {
  id: string;
  name: string;
  cas_number: string | null;
  molecular_formula: string | null;
  specification: string;
  concentration: string | null;
  purity: string | null;
  manufacturer: string | null;
  category: string | null;
  stock: number;
  unit: string;
  min_stock: number | null;
  location: string;
  storage_location: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  ghs_labels: string[] | null;
  price: number | null;
  msds_url: string | null;
  supplier_id: string | null;
  supplier?: { name: string };
  updated_at: string;
}

export interface ChemicalWarning {
  id: string;
  chemical_id: string;
  chemical?: Chemical;
  reported_by: string;
  reporter?: Profile;
  status: 'pending' | 'ordered' | 'arrived';
  reported_at: string;
  estimated_delivery_date: string | null;
  arrived_at: string | null;
}

export interface DutyRoster {
  id: string;
  area: 'lab' | 'office';
  user_id: string;
  user?: Profile;
  start_date: string;
  end_date: string;
}

export interface Equipment {
  id: string;
  name: string;
  location: string;
  responsible_user_id: string;
  responsible_user?: Profile;
  status: 'normal' | 'maintenance' | 'broken';
  notes: string | null;
}

export interface PurchaseApproval {
  id: string;
  requester_id: string;
  requester?: Profile;
  approver_id: string;
  approver?: Profile;
  title: string;
  category: ReimbursementCategory;
  estimated_amount: number | null;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ReimbursementFile {
  name: string;
  url: string;
  type: 'screenshot' | 'invoice' | 'test_report' | 'cert' | 'other';
  size: number;
}

export interface Reimbursement {
  id: string;
  user_id: string;
  user?: Profile;
  title: string;
  amount: number;
  description: string;
  category: ReimbursementCategory;
  purchase_approval_id: string | null;
  purchase_approval?: PurchaseApproval;
  receipt_urls: string[];
  file_paths: ReimbursementFile[];
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reviewer_id: string | null;
  reviewer?: Profile;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface PurchaseLog {
  id: string;
  user_id: string;
  user?: Profile;
  item_name: string;
  specification: string;
  quantity: number;
  unit: string;
  purpose: string;
  notes: string | null;
  created_at: string;
}
