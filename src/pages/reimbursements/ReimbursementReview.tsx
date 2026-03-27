import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { CheckCircle, XCircle, Receipt, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Reimbursement, Profile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';

interface ReimbursementWithUser extends Reimbursement {
  user?: Profile;
}

export default function ReimbursementReview() {
  const { profile, isAdmin } = useAuth();
  const [list, setList] = useState<ReimbursementWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 审批 modal
  const [showModal, setShowModal] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<ReimbursementWithUser | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPending();
  }, []);

  async function fetchPending() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('reimbursements')
        .select('*, user:profiles(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (fetchErr) throw fetchErr;
      setList(data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function openReview(item: ReimbursementWithUser) {
    setReviewingItem(item);
    setReviewNote('');
    setShowModal(true);
  }

  async function handleReview(action: 'approved' | 'rejected') {
    if (!reviewingItem || !profile) return;
    try {
      setSubmitting(true);
      const { error: updateErr } = await supabase
        .from('reimbursements')
        .update({
          status: action,
          reviewer_id: profile.id,
          review_note: reviewNote || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reviewingItem.id);
      if (updateErr) throw updateErr;
      setShowModal(false);
      fetchPending();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg text-sm">
          仅管理员可访问此页面
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          加载失败：{error}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="报销审批"
        subtitle={`${list.length} 条待审批`}
      />

      <div className="px-4 md:px-6">
        {list.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="暂无待审批的报销"
            description="所有报销申请已处理完毕"
          />
        ) : (
          <div className="space-y-3">
            {list.map((item) => (
              <Card key={item.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.title}
                        </h3>
                        <StatusBadge status={item.status} type="reimbursement" />
                      </div>
                      <p className="text-xs text-gray-500">
                        申请人：{item.user?.name ?? '未知'} | {dayjs(item.created_at).format('YYYY-MM-DD')}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 shrink-0 ml-3">
                      ¥{item.amount.toFixed(2)}
                    </p>
                  </div>

                  {item.description && (
                    <p className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {item.description}
                    </p>
                  )}

                  {/* 票据链接 */}
                  {item.receipt_urls && item.receipt_urls.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">
                        票据附件（{item.receipt_urls.length}）
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.receipt_urls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            附件 {idx + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 审批按钮 */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openReview(item)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      批准
                    </button>
                    <button
                      onClick={() => {
                        openReview(item);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      拒绝
                    </button>
                  </div>
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
                  {reviewingItem.user?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">金额</span>
                <span className="text-sm font-bold text-gray-900">
                  ¥{reviewingItem.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">申请日期</span>
                <span className="text-sm">
                  {dayjs(reviewingItem.created_at).format('YYYY-MM-DD')}
                </span>
              </div>
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
