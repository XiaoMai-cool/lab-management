import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { CheckCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PurchaseApproval, Profile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import SubNav from '../../components/SubNav';

const subNavItems = [
  { to: '/reimbursements', label: '报销记录', exact: true },
  { to: '/reimbursements/new', label: '新建报销' },
  { to: '/purchase-approvals/new', label: '采购审批' },
  { to: '/purchase-approvals', label: '我的采购' },
];

const categoryColors: Record<string, string> = {
  '个人药品': 'bg-purple-50 text-purple-700',
  '外送检测': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '加工定制': 'bg-pink-50 text-pink-700',
  '办公打印': 'bg-gray-100 text-gray-700',
  '差旅费': 'bg-indigo-50 text-indigo-700',
  '邮寄快递': 'bg-teal-50 text-teal-700',
  '其他': 'bg-gray-100 text-gray-600',
};

interface PurchaseApprovalWithRequester extends PurchaseApproval {
  requester?: Profile;
}

type TabFilter = 'pending' | 'reviewed';

export default function PurchaseApprovalReview() {
  const { profile, isTeacher, isAdmin } = useAuth();
  const [list, setList] = useState<PurchaseApprovalWithRequester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('pending');

  // Review modal
  const [showModal, setShowModal] = useState(false);
  const [reviewingItem, setReviewingItem] =
    useState<PurchaseApprovalWithRequester | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) fetchApprovals();
  }, [profile, tab]);

  async function fetchApprovals() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('purchase_approvals')
        .select('*, requester:profiles!purchase_approvals_requester_id_fkey(*)')
        .order('created_at', { ascending: tab === 'pending' });

      // super_admin sees all; others only see their own
      if (profile.role !== 'super_admin') {
        query = query.eq('approver_id', profile.id);
      }

      if (tab === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        query = query.in('status', ['approved', 'rejected']);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setList(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function openReview(item: PurchaseApprovalWithRequester) {
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
        .from('purchase_approvals')
        .update({
          status: action,
          review_note: reviewNote || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reviewingItem.id);

      if (updateErr) throw updateErr;
      setShowModal(false);
      fetchApprovals();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
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
            {list.map((item) => (
              <Card key={item.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.title}
                        </h3>
                        <StatusBadge
                          status={item.status}
                          type="reimbursement"
                        />
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
                        申请人：{item.requester?.name ?? '未知'}
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
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      用途说明
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {item.purpose}
                    </p>
                  </div>

                  {/* 审批备注（已处理） */}
                  {tab === 'reviewed' && item.review_note && (
                    <div
                      className={`p-3 rounded-lg ${
                        item.status === 'approved'
                          ? 'bg-green-50'
                          : 'bg-red-50'
                      }`}
                    >
                      <p
                        className={`text-xs ${
                          item.status === 'approved'
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}
                      >
                        <span className="font-medium">审批备注：</span>
                        {item.review_note}
                      </p>
                    </div>
                  )}

                  {/* 待审批操作按钮 */}
                  {tab === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => openReview(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        批准
                      </button>
                      <button
                        onClick={() => openReview(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        拒绝
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
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
                  {reviewingItem.requester?.name}
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

          {reviewingItem?.purpose && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1 font-medium">
                用途说明
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {reviewingItem.purpose}
              </p>
            </div>
          )}

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
