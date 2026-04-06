import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { auditLog } from '../../lib/auditLog';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import SubNav from '../../components/SubNav';

const subNavItems = [
  { to: '/purchase-approvals/new', label: '新建采购' },
  { to: '/purchase-approvals', label: '我的采购' },
];

const categoryColors: Record<string, string> = {
  '试剂药品': 'bg-purple-50 text-purple-700',
  '实验耗材': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '服装劳保': 'bg-pink-50 text-pink-700',
  '测试加工': 'bg-teal-50 text-teal-700',
  '会议培训': 'bg-indigo-50 text-indigo-700',
  '出版知产': 'bg-rose-50 text-rose-700',
  '办公用品': 'bg-gray-100 text-gray-700',
  '差旅交通': 'bg-indigo-50 text-indigo-700',
  '邮寄物流': 'bg-teal-50 text-teal-700',
  '其他': 'bg-gray-100 text-gray-600',
};

type TabFilter = 'pending' | 'reviewed';

export default function PurchaseApprovalReview() {
  const { profile, isTeacher, isAdmin } = useAuth();
  const [list, setList] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('pending');

  // Review modal
  const [showModal, setShowModal] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<Purchase | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [skipRegistration, setSkipRegistration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recalling, setRecalling] = useState<string | null>(null);

  useEffect(() => {
    if (profile) fetchPurchases();
  }, [profile, tab]);

  async function fetchPurchases() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('purchases')
        .select('*, applicant:profiles!purchases_applicant_id_fkey(name, role)')
        .order('created_at', { ascending: tab === 'pending' });

      // super_admin sees all; others only see their own
      if (profile.role !== 'super_admin') {
        query = query.eq('approver_id', profile.id);
      }

      if (tab === 'pending') {
        query = query.eq('approval_status', 'pending');
      } else {
        query = query.in('approval_status', ['approved', 'rejected']);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setList((data as Purchase[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function openReview(item: Purchase) {
    setReviewingItem(item);
    setReviewNote('');
    setSkipRegistration(item.skip_registration);
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
          approval_status: action,
          approval_note: reviewNote || null,
          approved_at: new Date().toISOString(),
          skip_registration: skipRegistration,
        })
        .eq('id', reviewingItem.id);

      if (updateErr) throw updateErr;
      await auditLog({
        action: action === 'approved' ? 'approve' : 'reject',
        targetTable: 'purchases',
        targetId: reviewingItem.id,
        details: { title: reviewingItem.title, note: reviewNote || null, skipRegistration },
      });
      setShowModal(false);
      fetchPurchases();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecallApproval(item: Purchase) {
    if (item.reimbursement_status != null) {
      alert('该采购已进入报销流程，无法撤回审批');
      return;
    }
    if (!confirm('确定要撤回该采购审批吗？审批状态将恢复为待审批，关联的报销状态也会被清除。')) return;
    try {
      setRecalling(item.id);
      const updateData: Record<string, unknown> = {
        approval_status: 'pending',
        approved_at: null,
        approval_note: null,
      };
      if (item.reimbursement_status) {
        updateData.reimbursement_status = null;
        updateData.reimbursed_at = null;
        updateData.reimbursement_note = null;
      }
      const { error: updateErr } = await supabase
        .from('purchases')
        .update(updateData)
        .eq('id', item.id);
      if (updateErr) throw updateErr;
      await auditLog({
        action: 'recall',
        targetTable: 'purchases',
        targetId: item.id,
        details: { title: item.title, previousStatus: item.approval_status },
      });
      fetchPurchases();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '撤回失败');
    } finally {
      setRecalling(null);
    }
  }

  function getReimbursementLabel(item: Purchase): { label: string; color: string } {
    if (item.reimbursement_status === 'approved') {
      return { label: '已报销', color: 'text-green-600' };
    }
    if (item.reimbursement_status === 'pending') {
      return { label: '报销审核中', color: 'text-yellow-600' };
    }
    return { label: '未报销', color: 'text-gray-400' };
  }

  function getRegistrationLabel(item: Purchase): { label: string; color: string } | null {
    if (item.skip_registration) return null;
    if (item.registration_status === 'registered') {
      return { label: '已登记', color: 'text-green-600' };
    }
    return { label: '未登记', color: 'text-gray-400' };
  }

  if (!isTeacher && !isAdmin) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
          <SubNav items={subNavItems} />
        </div>
        <div className="p-4">
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg text-sm">
            仅老师及管理员可访问此页面
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="px-4 md:px-6 pt-4">
        <SubNav items={subNavItems} />
      </div>
      <PageHeader
        title="审批采购申请"
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
            icon={ClipboardCheck}
            title={
              tab === 'pending'
                ? '暂无待审批的采购申请'
                : '暂无已处理的采购申请'
            }
            description={
              tab === 'pending'
                ? '所有采购申请已处理完毕'
                : '还没有处理过采购申请'
            }
          />
        ) : (
          <div className="space-y-3">
            {list.map((item) => {
              const reimbInfo = getReimbursementLabel(item);
              const regInfo = getRegistrationLabel(item);
              return (
                <Card key={item.id}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {item.title}
                          </h3>
                          <StatusBadge
                            status={item.approval_status}
                            type="reimbursement"
                          />
                          {item.auto_approved && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              教师自购
                            </span>
                          )}
                          {item.purchase_type === 'public' && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                              公共
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              categoryColors[item.category] ??
                              'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          申请人：{item.applicant?.name ?? '未知'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                        </p>
                      </div>

                      {item.estimated_amount != null && (
                        <div className="shrink-0 ml-3 text-right">
                          <p className="text-lg font-bold text-gray-900">
                            ¥{item.estimated_amount.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 用途说明 */}
                    {item.description && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1 font-medium">
                          用途说明
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {item.description}
                        </p>
                      </div>
                    )}

                    {/* 已处理 tab: 审批备注 + 后续状态 */}
                    {tab === 'reviewed' && (
                      <>
                        {item.approval_note && (
                          <div
                            className={`p-3 rounded-lg ${
                              item.approval_status === 'approved'
                                ? 'bg-green-50'
                                : 'bg-red-50'
                            }`}
                          >
                            <p
                              className={`text-xs ${
                                item.approval_status === 'approved'
                                  ? 'text-green-700'
                                  : 'text-red-700'
                              }`}
                            >
                              <span className="font-medium">审批备注：</span>
                              {item.approval_note}
                            </p>
                          </div>
                        )}

                        {item.approval_status === 'approved' && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 text-xs">
                              <span className={`font-medium ${reimbInfo.color}`}>
                                {reimbInfo.label}
                              </span>
                              {regInfo && (
                                <>
                                  <span className="text-gray-300">|</span>
                                  <span className={`font-medium ${regInfo.color}`}>
                                    {regInfo.label}
                                  </span>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => handleRecallApproval(item)}
                              disabled={recalling === item.id}
                              className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                            >
                              {recalling === item.id ? '撤回中...' : '撤回审批'}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* 待审批操作按钮 */}
                    {tab === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => openReview(item)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          审批
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 审批 Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={`审批 - ${reviewingItem?.title ?? ''}`}
        footer={
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
        }
      >
        <div className="space-y-4">
          {reviewingItem && (
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">申请人</span>
                <span className="text-sm font-medium">
                  {reviewingItem.applicant?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">类别</span>
                <span className="text-sm">{reviewingItem.category}</span>
              </div>
              {reviewingItem.estimated_amount != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">预计金额</span>
                  <span className="text-sm font-bold text-gray-900">
                    ¥{reviewingItem.estimated_amount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">申请日期</span>
                <span className="text-sm">
                  {dayjs(reviewingItem.created_at).format('YYYY-MM-DD')}
                </span>
              </div>
            </div>
          )}

          {reviewingItem?.description && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1 font-medium">
                用途说明
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {reviewingItem.description}
              </p>
            </div>
          )}

          {/* Skip registration toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">跳过物资登记</p>
              <p className="text-xs text-gray-400">关闭后需要在采购后进行物资登记</p>
            </div>
            <button
              type="button"
              onClick={() => setSkipRegistration(!skipRegistration)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                skipRegistration ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  skipRegistration ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

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
        </div>
      </Modal>
    </div>
  );
}
