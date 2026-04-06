import { supabase } from './supabase';

interface AuditLogEntry {
  action: string;       // approve, reject, create, update, delete, recall
  targetTable: string;  // purchases, supply_reservations, etc.
  targetId?: string;
  details?: Record<string, unknown>;
}

/**
 * 记录操作日志（静默失败，不阻塞业务流程）
 */
export async function auditLog({ action, targetTable, targetId, details }: AuditLogEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action,
      target_table: targetTable,
      target_id: targetId,
      details: details ?? {},
    });
  } catch {
    // 日志写入失败不应影响业务操作
    console.warn('审计日志写入失败');
  }
}
