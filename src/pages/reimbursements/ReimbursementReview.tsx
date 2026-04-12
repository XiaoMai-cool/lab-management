import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Receipt,
  Eye,
  Paperclip,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { auditLog } from '../../lib/auditLog';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase, ReimbursementFile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import FilePreview from '../../components/FilePreview';

const categoryColors: Record<string, string> = {
  '试剂药品': 'bg-purple-50 text-purple-700',
  '实验耗材': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '服装劳保': 'bg-pink-50 text-pink-700',
  '测试加工': 'bg-teal-50 text-teal-700',
  '会议培训': 'bg-indigo-50 text-indigo-700',
  '出版知产': 'bg-blue-50 text-blue-700',
  '办公用品': 'bg-gray-100 text-gray-700',
  '差旅交通': 'bg-amber-50 text-amber-700',
  '邮寄物流': 'bg-emerald-50 text-emerald-700',
  '其他': 'bg-gray-100 text-gray-600',
};

type PurchaseWithRelations = Omit<Purchase, 'applicant' | 'approver'> & {
  applicant?: { name: string; role: string };
  approver?: { name: string };
};

type TabFilter = 'pending' | 'reviewed';

export default function ReimbursementReview() {
  const { profile, isReimbursementApprover } = useAuth();
  const [list, setList] = useState<PurchaseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('pending');

  // Review modal
  const [showModal, setShowModal] = useState(false);
  const [reviewingItem, setReviewingItem] =
    useState<PurchaseWithRelations | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recalling, setRecalling] = useState<string | null>(null);

  useEffect(() => {
    fetchList();
  }, [tab]);

  async function fetchList() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('purchases')
        .select(
          '*, applicant:profiles!purchases_applicant_id_fkey(name, role), approver:profiles!purchases_approver_id_fkey(name)'
        )
        .not('reimbursement_status', 'is', null)
        .order('created_at', { ascending: tab === 'pending' });

      if (tab === 'pending') {
        query = query.eq('reimbursement_status', 'pending');
      } else {
        query = query.in('reimbursement_status', ['approved', 'rejected']);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setList((data as PurchaseWithRelations[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function openReview(item: PurchaseWithRelations) {
    setReviewingItem(item);
    setReviewNote('');
    setShowModal(true);
  }

  async function handleReview(action: 'approved' | 'rejected') {
    if (!reviewingItem || !profile) return;
    if (action === 'rejected' && !reviewNote.trim()) {
      alert('拒绝时请填写原因');
      return;
    }

    try {
      setSubmitting(true);
      const { error: updateErr } = await supabase
        .from('purchases')
        .update({
          reimbursement_status: action,
          reimbursement_reviewer_id: profile.id,
          reimbursement_note: reviewNote || null,
          reimbursed_at: new Date().toISOString(),
        })
        .eq('id', reviewingItem.id);
      if (updateErr) throw updateErr;
      await auditLog({
        action: action === 'approved' ? 'approve' : 'reject',
        targetTable: 'purchases',
        targetId: reviewingItem.id,
        details: { type: 'reimbursement', title: reviewingItem.title, amount: reviewingItem.actual_amount, note: reviewNote || null },
      });
      setShowModal(false);
      fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecallReimbursement(item: PurchaseWithRelations) {
    if (!confirm('确定要撤回该报销审批吗？报销状态将恢复为待审批。')) return;
    try {
      setRecalling(item.id);
      const { error: updateErr } = await supabase
        .from('purchases')
        .update({
          reimbursement_status: 'pending',
          reimbursed_at: null,
          reimbursement_note: null,
        })
        .eq('id', item.id);
      if (updateErr) throw updateErr;
      await auditLog({
        action: 'recall',
        targetTable: 'purchases',
        targetId: item.id,
        details: { type: 'reimbursement', title: item.title, previousStatus: item.reimbursement_status },
      });
      fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '撤回失败');
    } finally {
      setRecalling(null);
    }
  }

  if (!isReimbursementApprover) {
    return (
      <div className="pb-8">
        <div className="p-4">
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg text-sm">
            仅报销审批人可访问此页面
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="报销审批"
        subtitle={
          tab === 'pending'
            ? `${list.length} 条待审批`
            : `${list.length} 条已处理`
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            加载失败：{error}
          </div>
        )}

        {/* Tab 切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            待审批
          </button>
          <button
            onClick={() => setTab('reviewed')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'reviewed'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            已处理
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={
              tab === 'pending'
                ? '暂无待审批的报销'
                : '暂无已处理的报销'
            }
            description={
              tab === 'pending'
                ? '所有报销申请已处理完毕'
                : '还没有处理过报销申请'
            }
          />
        ) : (
          <div className="space-y-3">
            {list.map((item) => {
              const attachmentCount = (item.receipt_attachments as ReimbursementFile[] | null)?.length ?? 0;
              return (
              <Card key={item.id}>
                <div
                  className="space-y-3 cursor-pointer"
                  onClick={() => openReview(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.title}
                        </h3>
                        <StatusBadge
                          status={item.reimbursement_status ?? 'pending'}
                          type="reimbursement"
                        />
                        {item.category && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              categoryColors[item.category] ??
                              'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.category}
                          </span>
                        )}
                        {!item.skip_registration && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.registration_status === 'registered'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {item.registration_status === 'registered'
                              ? '已登记'
                              : '未登记'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        申请人：{item.applicant?.name ?? '未知'} |{' '}
                        {dayjs(item.created_at).format('YYYY-MM-DD')}
                      </p>
                      {attachmentCount > 0 && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          {attachmentCount} 个凭证附件
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 ml-3 text-right">
                      <p className="text-lg font-bold text-gray-900">
                        ¥{(item.actual_amount ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-blue-500 mt-1 flex items-center gap-0.5 justify-end">
                        <Eye className="w-3 h-3" />
                        查看详情
                      </p>
                    </div>
                  </div>

                  {/* Review info (reviewed tab) */}
                  {tab === 'reviewed' && (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {item.reimbursed_at && (
                          <span>
                            审批时间：
                            {dayjs(item.reimbursed_at).format(
                              'YYYY-MM-DD HH:mm'
                            )}
                          </span>
                        )}
                      </div>
                      {item.reimbursement_note && (
                        <div
                          className={`p-3 rounded-lg ${
                            item.reimbursement_status === 'approved'
                              ? 'bg-green-50'
                              : 'bg-red-50'
                          }`}
                        >
                          <p
                            className={`text-xs ${
                              item.reimbursement_status === 'approved'
                                ? 'text-green-700'
                                : 'text-red-700'
                            }`}
                          >
                            <span className="font-medium">审批备注：</span>
                            {item.reimbursement_note}
                          </p>
                        </div>
                      )}
                      {item.reimbursement_status === 'approved' && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => handleRecallReimbursement(item)}
                            disabled={recalling === item.id}
                            className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                          >
                            {recalling === item.id ? '撤回中...' : '撤回报销'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail & Review Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={reviewingItem?.title ?? ''}
        footer={
          reviewingItem?.reimbursement_status === 'pending' ? (
            <div className="flex gap-3">
              <button
                onClick={() => handleReview('rejected')}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {submitting ? '处理中...' : '拒绝'}
              </button>
              <button
                onClick={() => handleReview('approved')}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? '处理中...' : '批准'}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {reviewingItem && (
            <>
              {/* 基本信息 */}
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">申请人</span>
                  <span className="text-sm font-medium">
                    {reviewingItem.applicant?.name ?? '未知'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">采购类型</span>
                  <span className="text-sm">
                    {reviewingItem.purchase_type === 'public' ? '公共采购' : '个人采购'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">类别</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[reviewingItem.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {reviewingItem.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">报销金额</span>
                  <span className="text-sm font-bold text-gray-900">
                    ¥{(reviewingItem.actual_amount ?? 0).toFixed(2)}
                  </span>
                </div>
                {reviewingItem.estimated_amount != null && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">申请预估</span>
                    <span className="text-sm text-gray-600">
                      ¥{reviewingItem.estimated_amount.toFixed(2)}
                    </span>
                  </div>
                )}
                {reviewingItem.estimated_amount != null &&
                  reviewingItem.actual_amount != null &&
                  Math.abs(reviewingItem.actual_amount - reviewingItem.estimated_amount) >= 50 && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium">
                      金额差异较大: 预估 ¥{reviewingItem.estimated_amount.toFixed(2)} → 实际 ¥{reviewingItem.actual_amount.toFixed(2)}
                    </p>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">申请日期</span>
                  <span className="text-sm">
                    {dayjs(reviewingItem.created_at).format('YYYY-MM-DD HH:mm')}
                  </span>
                </div>
                {reviewingItem.approver && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">采购审批人</span>
                    <span className="text-sm">{reviewingItem.approver.name}</span>
                  </div>
                )}
                {!reviewingItem.skip_registration && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">入库登记</span>
                    <span
                      className={`text-sm font-medium ${
                        reviewingItem.registration_status === 'registered'
                          ? 'text-green-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {reviewingItem.registration_status === 'registered'
                        ? '已登记'
                        : '未登记'}
                    </span>
                  </div>
                )}
              </div>

              {/* 用途说明 */}
              {reviewingItem.description && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1 font-medium">用途说明</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {reviewingItem.description}
                  </p>
                </div>
              )}

              <FilePreview
                files={(reviewingItem.attachments as { name: string; url: string; type?: string; size?: number }[]) ?? []}
                title="采购申请附件"
              />

              <FilePreview
                files={(reviewingItem.receipt_attachments as { name: string; url: string; type?: string; size?: number }[]) ?? []}
                title="报销凭证"
              />
            </>
          )}

          {/* 审批操作区 - 仅待审批时显示 */}
          {reviewingItem?.reimbursement_status === 'pending' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                审批备注
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                placeholder="选填，如拒绝请填写原因"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
