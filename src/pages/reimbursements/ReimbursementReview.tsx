import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  CheckCircle,
  XCircle,
  Receipt,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Reimbursement,
  Profile,
  PurchaseApproval,
  ReimbursementFile,
} from '../../lib/types';
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

const fileTypeLabels: Record<string, string> = {
  screenshot: '购买截图',
  invoice: '发票',
  test_report: '检测报告',
  cert: '资质证书',
  other: '其他',
};

interface ReimbursementWithRelations extends Reimbursement {
  user?: Profile;
  purchase_approval?: PurchaseApproval;
}

type TabFilter = 'pending' | 'reviewed';

export default function ReimbursementReview() {
  const { profile, isReimbursementApprover } = useAuth();
  const [list, setList] = useState<ReimbursementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('pending');

  // Review modal
  const [showModal, setShowModal] = useState(false);
  const [reviewingItem, setReviewingItem] =
    useState<ReimbursementWithRelations | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit/delete for reviewed items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchList();
  }, [tab]);

  async function fetchList() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('reimbursements')
        .select(
          '*, user:profiles!reimbursements_user_id_fkey(*), reviewer:profiles!reimbursements_reviewer_id_fkey(name), purchase_approval:purchase_approvals(*)'
        )
        .order('created_at', { ascending: tab === 'pending' });

      if (tab === 'pending') {
        query = query.eq('status', 'pending');
      } else {
        query = query.in('status', ['approved', 'rejected', 'completed']);
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

  function openReview(item: ReimbursementWithRelations) {
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
      fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditStatus(id: string, newStatus: string) {
    if (!profile) return;
    setProcessingId(id);
    try {
      const { error: updateErr } = await supabase
        .from('reimbursements')
        .update({
          status: newStatus,
          reviewer_id: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updateErr) throw updateErr;
      setEditingId(null);
      fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '修改失败');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteReimbursement(id: string) {
    if (!confirm('确定要删除该报销记录吗？此操作不可恢复。')) return;
    setProcessingId(id);
    try {
      const { error: delErr } = await supabase
        .from('reimbursements')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      setList((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setProcessingId(null);
    }
  }

  if (!isReimbursementApprover) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
          <SubNav items={subNavItems} />
        </div>
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
      <div className="px-4 md:px-6 pt-4">
        <SubNav items={subNavItems} />
      </div>
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
            {list.map((item) => (
              <Card key={item.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.title}
                        </h3>
                        <StatusBadge
                          status={item.status}
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
                      </div>
                      <p className="text-xs text-gray-500">
                        申请人：{item.user?.name ?? '未知'} |{' '}
                        {dayjs(item.created_at).format('YYYY-MM-DD')}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 shrink-0 ml-3">
                      ¥{item.amount.toFixed(2)}
                    </p>
                  </div>

                  {/* 关联采购审批信息 */}
                  {item.purchase_approval && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Link2 className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-blue-700">
                          关联采购审批
                        </span>
                      </div>
                      <p className="text-xs text-blue-600">
                        {item.purchase_approval.title}
                        {item.purchase_approval.estimated_amount != null &&
                          ` | 预计 ¥${item.purchase_approval.estimated_amount.toFixed(2)}`}
                      </p>
                    </div>
                  )}

                  {item.description && (
                    <p className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {item.description}
                    </p>
                  )}

                  {/* 上传文件列表 */}
                  {item.file_paths && item.file_paths.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">
                        上传凭证（{item.file_paths.length}）
                      </p>
                      <div className="space-y-1.5">
                        {(item.file_paths as ReimbursementFile[]).map(
                          (file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                            >
                              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-700 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {fileTypeLabels[file.type] ?? file.type}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legacy receipt_urls */}
                  {(!item.file_paths || item.file_paths.length === 0) &&
                    item.receipt_urls &&
                    item.receipt_urls.length > 0 && (
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

                  {/* 审批信息（已处理） */}
                  {tab === 'reviewed' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {(item as any).reviewer?.name && (
                          <span>审批人：{(item as any).reviewer.name}</span>
                        )}
                        {item.reviewed_at && (
                          <span>审批时间：{dayjs(item.reviewed_at).format('YYYY-MM-DD HH:mm')}</span>
                        )}
                      </div>
                      {item.review_note && (
                        <div
                          className={`p-3 rounded-lg ${
                            item.status === 'approved' || item.status === 'completed'
                              ? 'bg-green-50'
                              : 'bg-red-50'
                          }`}
                        >
                          <p
                            className={`text-xs ${
                              item.status === 'approved' ||
                              item.status === 'completed'
                                ? 'text-green-700'
                                : 'text-red-700'
                            }`}
                          >
                            <span className="font-medium">审批备注：</span>
                            {item.review_note}
                          </p>
                        </div>
                      )}

                      {/* 修改/删除操作 */}
                      <div className="flex items-center gap-2 pt-1">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                            >
                              <option value="approved">已批准</option>
                              <option value="rejected">已拒绝</option>
                              <option value="completed">已完成</option>
                              <option value="pending">待审批</option>
                            </select>
                            <button
                              onClick={() => handleEditStatus(item.id, editStatus)}
                              disabled={processingId === item.id}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingId(item.id); setEditStatus(item.status); }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              修改状态
                            </button>
                            <button
                              onClick={() => handleDeleteReimbursement(item.id)}
                              disabled={processingId === item.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              删除
                            </button>
                          </>
                        )}
                      </div>
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
            <>
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">申请人</span>
                  <span className="text-sm font-medium">
                    {reviewingItem.user?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">类别</span>
                  <span className="text-sm">{reviewingItem.category}</span>
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

              {/* 关联采购审批 */}
              {reviewingItem.purchase_approval && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-blue-700 mb-1">
                    关联采购审批
                  </p>
                  <p className="text-xs text-blue-600">
                    {reviewingItem.purchase_approval.title}
                    {reviewingItem.purchase_approval.estimated_amount != null &&
                      ` | 预计 ¥${reviewingItem.purchase_approval.estimated_amount.toFixed(2)}`}
                    {' | '}
                    状态：
                    {reviewingItem.purchase_approval.status === 'approved'
                      ? '已批准'
                      : reviewingItem.purchase_approval.status}
                  </p>
                </div>
              )}

              {/* 上传文件 */}
              {reviewingItem.file_paths &&
                reviewingItem.file_paths.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">
                      上传凭证
                    </p>
                    <div className="space-y-1">
                      {(reviewingItem.file_paths as ReimbursementFile[]).map(
                        (file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-700 truncate flex-1">
                              {file.name}
                            </span>
                            <span className="text-gray-400 shrink-0">
                              {fileTypeLabels[file.type] ?? file.type}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </>
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
