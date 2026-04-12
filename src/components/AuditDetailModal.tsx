import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import FilePreview from './FilePreview';
import LoadingSpinner from './LoadingSpinner';

interface AuditDetailModalProps {
  open: boolean;
  onClose: () => void;
  targetTable: string;
  targetId: string;
}

interface TimelineEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: '新建', approve: '批准', reject: '拒绝', recall: '撤回',
  stock_add: '增加库存', update: '更新', delete: '删除',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-blue-500', approve: 'bg-green-500', reject: 'bg-red-500',
  recall: 'bg-orange-500', stock_add: 'bg-indigo-500', update: 'bg-gray-500', delete: 'bg-red-700',
};

export default function AuditDetailModal({ open, onClose, targetTable, targetId }: AuditDetailModalProps) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && targetId) loadData();
  }, [open, targetTable, targetId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      let recordQuery;
      switch (targetTable) {
        case 'purchases':
          recordQuery = supabase.from('purchases')
            .select('*, applicant:profiles!purchases_applicant_id_fkey(name), approver:profiles!purchases_approver_id_fkey(name)')
            .eq('id', targetId).single();
          break;
        case 'chemicals':
          recordQuery = supabase.from('chemicals').select('*').eq('id', targetId).single();
          break;
        case 'supply_reservations':
          recordQuery = supabase.from('supply_reservations')
            .select('*, supply:supplies(name), user:profiles!user_id(name)')
            .eq('id', targetId).single();
          break;
        case 'supply_borrowings':
          recordQuery = supabase.from('supply_borrowings')
            .select('*, supply:supplies(name), user:profiles!user_id(name)')
            .eq('id', targetId).single();
          break;
        case 'profiles':
          recordQuery = supabase.from('profiles')
            .select('name, email, role, managed_modules')
            .eq('id', targetId).single();
          break;
        default:
          recordQuery = null;
      }

      const [recordResult, timelineResult] = await Promise.all([
        recordQuery,
        supabase.from('audit_log')
          .select('id, action, details, created_at, user:profiles!audit_log_user_id_fkey(name)')
          .eq('target_table', targetTable)
          .eq('target_id', targetId)
          .order('created_at', { ascending: true }),
      ]);

      if (recordResult?.data) setRecord(recordResult.data);
      setTimeline((timelineResult.data as TimelineEntry[]) ?? []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function renderRecordDetail() {
    if (!record) return <p className="text-sm text-gray-400">记录不存在或已删除</p>;
    switch (targetTable) {
      case 'purchases': return <PurchaseDetail record={record} />;
      case 'chemicals': return <ChemicalDetail record={record} />;
      case 'supply_reservations': return <ReservationDetail record={record} />;
      case 'supply_borrowings': return <BorrowingDetail record={record} />;
      case 'profiles': return <ProfileDetail record={record} />;
      default: return <p className="text-sm text-gray-400">不支持的记录类型</p>;
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="操作详情">
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : (
        <div className="space-y-6">
          {renderRecordDetail()}

          {timeline.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-3">操作时间线</h4>
              <div className="relative pl-4 space-y-3">
                <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-gray-200" />
                {timeline.map((entry) => (
                  <div key={entry.id} className="relative flex items-start gap-3">
                    <div className={`absolute left-[-9px] top-1 w-3 h-3 rounded-full border-2 border-white ${ACTION_COLORS[entry.action] ?? 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-900">{entry.user?.name ?? '未知'}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          entry.action === 'approve' ? 'bg-green-50 text-green-700' :
                          entry.action === 'reject' ? 'bg-red-50 text-red-700' :
                          entry.action === 'create' ? 'bg-blue-50 text-blue-700' :
                          entry.action === 'stock_add' ? 'bg-indigo-50 text-indigo-700' :
                          entry.action === 'recall' ? 'bg-orange-50 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {dayjs(entry.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {formatTimelineDetails(entry.details)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function formatTimelineDetails(details: Record<string, unknown>): string {
  const parts: string[] = [];
  if (details.note) parts.push(`备注: ${details.note}`);
  if (details.added != null) parts.push(`库存 +${details.added} (${details.before}→${details.after})`);
  if (details.title) parts.push(String(details.title));
  if (details.batch_number) parts.push(`编号 ${details.batch_number}`);
  if (details.amount != null) parts.push(`金额 ¥${details.amount}`);
  return parts.join(' · ');
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function PurchaseDetail({ record }: { record: Record<string, unknown> }) {
  const applicant = record.applicant as Record<string, unknown> | null;
  const approver = record.approver as Record<string, unknown> | null;
  const attachments = (record.attachments ?? []) as { name: string; url: string; type?: string; size?: number }[];
  const receipts = (record.receipt_attachments ?? []) as { name: string; url: string; type?: string; size?: number }[];
  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
        <DetailRow label="标题" value={record.title as string} />
        <DetailRow label="申请人" value={applicant?.name as string} />
        <DetailRow label="类别" value={record.category as string} />
        <DetailRow label="采购类型" value={record.purchase_type === 'personal' ? '个人采购' : '公共采购'} />
        <DetailRow label="预估金额" value={record.estimated_amount != null ? `¥${Number(record.estimated_amount).toFixed(2)}` : undefined} />
        <DetailRow label="实际金额" value={record.actual_amount != null ? `¥${Number(record.actual_amount).toFixed(2)}` : undefined} />
        <DetailRow label="审批状态" value={record.approval_status as string} />
        <DetailRow label="审批人" value={approver?.name as string} />
        <DetailRow label="报销状态" value={record.reimbursement_status as string} />
      </div>
      {record.description && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1 font-medium">描述</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.description as string}</p>
        </div>
      )}
      <FilePreview files={attachments} title="采购附件" />
      <FilePreview files={receipts} title="报销凭证" />
    </div>
  );
}

function ChemicalDetail({ record }: { record: Record<string, unknown> }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="名称" value={record.name as string} />
      <DetailRow label="编号" value={record.batch_number as string} />
      <DetailRow label="CAS号" value={record.cas_number as string} />
      <DetailRow label="规格" value={record.specification as string} />
      <DetailRow label="纯度" value={record.purity as string} />
      <DetailRow label="厂家" value={record.manufacturer as string} />
      <DetailRow label="库存" value={`${record.stock ?? 0} ${record.unit ?? ''}`} />
      <DetailRow label="存放位置" value={record.storage_location as string} />
      <DetailRow label="分类" value={record.category as string} />
    </div>
  );
}

function ReservationDetail({ record }: { record: Record<string, unknown> }) {
  const supply = record.supply as Record<string, unknown> | null;
  const user = record.user as Record<string, unknown> | null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="物品" value={supply?.name as string} />
      <DetailRow label="申请人" value={user?.name as string} />
      <DetailRow label="数量" value={String(record.quantity)} />
      <DetailRow label="用途" value={record.purpose as string} />
      <DetailRow label="状态" value={record.status as string} />
      <DetailRow label="审批备注" value={record.review_note as string} />
    </div>
  );
}

function BorrowingDetail({ record }: { record: Record<string, unknown> }) {
  const supply = record.supply as Record<string, unknown> | null;
  const user = record.user as Record<string, unknown> | null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="物品" value={supply?.name as string} />
      <DetailRow label="借用人" value={user?.name as string} />
      <DetailRow label="数量" value={String(record.quantity)} />
      <DetailRow label="用途" value={record.purpose as string} />
      <DetailRow label="状态" value={record.status === 'borrowed' ? '借用中' : record.status === 'returned' ? '已归还' : String(record.status)} />
      <DetailRow label="借出时间" value={record.borrowed_at ? dayjs(record.borrowed_at as string).format('YYYY-MM-DD HH:mm') : undefined} />
      <DetailRow label="归还时间" value={record.returned_at ? dayjs(record.returned_at as string).format('YYYY-MM-DD HH:mm') : undefined} />
    </div>
  );
}

function ProfileDetail({ record }: { record: Record<string, unknown> }) {
  const ROLE_LABELS: Record<string, string> = { super_admin: '超级管理员', admin: '管理员', manager: '板块负责人', teacher: '教师', student: '学生' };
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <DetailRow label="用户名" value={record.name as string} />
      <DetailRow label="邮箱" value={record.email as string} />
      <DetailRow label="角色" value={ROLE_LABELS[record.role as string] ?? (record.role as string)} />
      <DetailRow label="管理模块" value={(record.managed_modules as string[])?.join(', ') || '无'} />
    </div>
  );
}
