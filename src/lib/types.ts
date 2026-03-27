export type Role = 'super_admin' | 'admin' | 'manager' | 'teacher' | 'student';

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

export interface Chemical {
  id: string;
  name: string;
  cas_number: string;
  specification: string;
  stock: number;
  unit: string;
  location: string;
  updated_at: string;
}

export interface ChemicalUsageLog {
  id: string;
  chemical_id: string;
  chemical?: Chemical;
  user_id: string;
  user?: Profile;
  amount: number;
  unit: string;
  purpose: string;
  used_at: string;
}

export interface ChemicalPurchase {
  id: string;
  chemical_id: string;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  requester_id: string;
  requester?: Profile;
  status: string;
  approved_by: string | null;
  created_at: string;
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

export interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  location: string;
  notes: string | null;
  created_at: string;
}

export interface MeetingReport {
  id: string;
  meeting_id: string;
  user_id: string;
  user?: Profile;
  content: string;
  file_url: string | null;
  submitted_at: string;
}

export interface Reimbursement {
  id: string;
  user_id: string;
  user?: Profile;
  title: string;
  amount: number;
  description: string;
  receipt_urls: string[];
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
