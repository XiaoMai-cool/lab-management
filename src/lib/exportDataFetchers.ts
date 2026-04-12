import { supabase } from './supabase';

export async function fetchSupplies() {
  const { data, error } = await supabase
    .from('supplies')
    .select('name, specification, stock, unit, min_stock, category:supply_categories(name), updated_at')
    .order('name');
  if (error) throw error;
  return {
    name: '耗材库存',
    data: (data ?? []).map((s: Record<string, unknown>) => ({
      '名称': s.name,
      '规格': s.specification,
      '库存': s.stock,
      '单位': s.unit,
      '最低库存': s.min_stock,
      '分类': (s.category as Record<string, unknown>)?.name ?? '',
      '更新时间': s.updated_at,
    })),
  };
}

export async function fetchReservations() {
  const { data, error } = await supabase
    .from('supply_reservations')
    .select('*, supply:supplies(name), user:profiles!user_id(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const reservationIds = (data ?? []).map((r: Record<string, unknown>) => r.id as string);
  const itemsByReservation: Record<string, { name: string; quantity: number }[]> = {};
  if (reservationIds.length > 0) {
    const { data: items } = await supabase
      .from('supply_reservation_items')
      .select('reservation_id, quantity, supply:supplies(name)')
      .in('reservation_id', reservationIds);
    if (items) {
      for (const item of items as any[]) {
        const rid = item.reservation_id as string;
        if (!itemsByReservation[rid]) itemsByReservation[rid] = [];
        itemsByReservation[rid].push({ name: item.supply?.name ?? '', quantity: item.quantity });
      }
    }
  }

  return {
    name: '耗材申领记录',
    data: (data ?? []).map((r: Record<string, unknown>) => {
      const rid = r.id as string;
      const items = itemsByReservation[rid];
      const itemsText = items && items.length > 0
        ? items.map(i => `${i.name}(${i.quantity})`).join(', ')
        : (r.supply as Record<string, unknown>)?.name ?? '';
      return {
        '物品明细': itemsText,
        '申请人': (r.user as Record<string, unknown>)?.name ?? '',
        '数量': r.quantity,
        '用途': r.purpose,
        '是否归还': r.is_returnable ? '是' : '否',
        '状态': r.status,
        '申请时间': r.created_at,
        '审批备注': r.review_note ?? '',
      };
    }),
  };
}

export async function fetchBorrowings() {
  const { data, error } = await supabase
    .from('supply_borrowings')
    .select('*, supply:supplies(name), user:profiles!user_id(name)')
    .order('borrowed_at', { ascending: false });
  if (error) throw error;
  return {
    name: '耗材借用记录',
    data: (data ?? []).map((b: Record<string, unknown>) => ({
      '物品名称': (b.supply as Record<string, unknown>)?.name ?? '',
      '借用人': (b.user as Record<string, unknown>)?.name ?? '',
      '数量': b.quantity,
      '用途': b.purpose,
      '状态': b.status === 'borrowed' ? '借用中' : b.status === 'returned' ? '已归还' : b.status === 'damaged' ? '已损坏' : b.status,
      '借出时间': b.borrowed_at,
      '归还时间': b.returned_at ?? '',
    })),
  };
}

export async function fetchChemicalInventory() {
  const { data, error } = await supabase
    .from('chemicals')
    .select('name, batch_number, cas_number, category, stock, unit, location, storage_location, molecular_formula, specification, purity, manufacturer, expiry_date, updated_at')
    .order('batch_number');
  if (error) throw error;
  const getZone = (bn: string | null) => {
    if (!bn) return '未编号';
    const prefix = bn.charAt(0).toUpperCase();
    const zones: Record<string, string> = { A: 'A区', B: 'B区', C: 'C区', D: 'D区' };
    return zones[prefix] ?? '上架';
  };
  return {
    name: '药品库存',
    data: (data ?? []).map((c: Record<string, unknown>) => ({
      '区域': getZone(c.batch_number as string | null),
      '编号': c.batch_number ?? '',
      '名称': c.name,
      'CAS号': c.cas_number ?? '',
      '规格': c.specification ?? '',
      '纯度': c.purity ?? '',
      '厂家': c.manufacturer ?? '',
      '库存': c.stock,
      '单位': c.unit,
      '存放位置': c.storage_location ?? c.location ?? '',
      '分类': c.category ?? '',
      '分子式': c.molecular_formula ?? '',
      '有效期': c.expiry_date ?? '',
      '更新时间': c.updated_at,
    })),
  };
}

export async function fetchChemicalUsage() {
  const { data, error } = await supabase
    .from('chemical_usage_logs')
    .select('*, chemical:chemicals(name), user:profiles!user_id(name)')
    .order('used_at', { ascending: false });
  if (error) throw error;
  return {
    name: '药品使用记录',
    data: (data ?? []).map((l: Record<string, unknown>) => ({
      '药品': (l.chemical as Record<string, unknown>)?.name ?? '',
      '使用人': (l.user as Record<string, unknown>)?.name ?? '',
      '用量': l.amount,
      '单位': l.unit,
      '用途': l.purpose,
      '使用时间': l.used_at,
    })),
  };
}

export async function fetchChemicalWarnings() {
  const { data, error } = await supabase
    .from('chemical_warnings')
    .select('*, chemical:chemicals(name, batch_number), reporter:profiles!reported_by(name)')
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return {
    name: '药品补货记录',
    data: (data ?? []).map((w: Record<string, unknown>) => ({
      '药品名称': (w.chemical as Record<string, unknown>)?.name ?? '',
      '编号': (w.chemical as Record<string, unknown>)?.batch_number ?? '',
      '报告人': (w.reporter as Record<string, unknown>)?.name ?? '',
      '状态': w.status === 'pending' ? '待处理' : w.status === 'ordered' ? '已下单' : w.status === 'arrived' ? '已到货' : w.status,
      '报告时间': w.reported_at,
      '预计送达': w.estimated_delivery_date ?? '',
      '实际送达': w.arrived_at ?? '',
    })),
  };
}

export async function fetchPurchases() {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, applicant:profiles!purchases_applicant_id_fkey(name), approver:profiles!purchases_approver_id_fkey(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return {
    name: '采购记录',
    data: (data ?? []).map((p: Record<string, unknown>) => ({
      '申请人': (p.applicant as Record<string, unknown>)?.name ?? '',
      '标题': p.title,
      '类别': p.category,
      '采购类型': p.purchase_type === 'personal' ? '个人' : '公共',
      '预估金额': p.estimated_amount,
      '实际金额': p.actual_amount,
      '审批状态': p.approval_status,
      '审批人': (p.approver as Record<string, unknown>)?.name ?? '',
      '报销状态': p.reimbursement_status ?? '',
      '入库状态': p.skip_registration ? '无需登记' : (p.registration_status as string) === 'registered' ? '已登记' : '未登记',
      '日期': p.created_at,
    })),
  };
}

export async function fetchAuditLog(userId?: string) {
  let query = supabase
    .from('audit_log')
    .select('*, user:profiles!audit_log_user_id_fkey(name)')
    .order('created_at', { ascending: false });
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return {
    name: '操作日志',
    data: (data ?? []).map((a: Record<string, unknown>) => ({
      '操作人': (a.user as Record<string, unknown>)?.name ?? '',
      '操作类型': a.action,
      '目标表': a.target_table,
      '详情': a.details ? JSON.stringify(a.details) : '',
      '时间': a.created_at,
    })),
  };
}

export async function fetchAllExportData(auditLogUserId?: string) {
  const results = await Promise.all([
    fetchSupplies(),
    fetchReservations(),
    fetchBorrowings(),
    fetchChemicalInventory(),
    fetchChemicalUsage(),
    fetchChemicalWarnings(),
    fetchPurchases(),
    fetchAuditLog(auditLogUserId),
  ]);
  return results;
}
