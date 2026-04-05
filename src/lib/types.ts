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

export interface AnnouncementAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

// 通用文件附件接口，公告和文档共用
export type FileAttachment = AnnouncementAttachment;

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  author_id: string;
  author?: Profile;
  published: boolean;
  attachments?: AnnouncementAttachment[];
  show_on_login?: boolean;
  login_sort_order?: number;
  dashboard_sort_order?: number;
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
  attachments?: FileAttachment[];  // 新增
  author?: { name: string };       // join 查询时
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
  is_returnable: boolean;
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
  status: 'borrowed' | 'returned' | 'damaged';
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

export type PurchaseCategory =
  | '试剂药品'
  | '实验耗材'
  | '设备配件'
  | '服装劳保'
  | '测试加工'
  | '会议培训'
  | '出版知产'
  | '办公用品'
  | '差旅交通'
  | '邮寄物流'
  | '其他';

export type PurchaseType = 'personal' | 'public';

export interface Purchase {
  id: string;
  applicant_id: string;
  applicant?: Profile;
  title: string;
  purchase_type: PurchaseType;
  category: PurchaseCategory;
  estimated_amount: number | null;
  description: string;
  attachments: ReimbursementFile[];

  approver_id: string | null;
  approver?: Profile;
  approval_status: 'pending' | 'approved' | 'rejected';
  approval_note: string | null;
  approved_at: string | null;
  auto_approved: boolean;

  skip_registration: boolean;
  extra_fields: Record<string, unknown>;

  actual_amount: number | null;
  receipt_attachments: ReimbursementFile[];
  reimbursement_status: 'pending' | 'approved' | 'rejected' | null;
  reimbursement_reviewer_id: string | null;
  reimbursement_reviewer?: Profile;
  reimbursement_note: string | null;
  reimbursed_at: string | null;

  registration_status: 'registered' | null;
  registered_by: string | null;
  registered_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface StudentTeacherAssignment {
  id: string;
  student_id: string;
  student?: Profile;
  teacher_id: string;
  teacher?: Profile;
  created_at: string;
  updated_at: string;
}
