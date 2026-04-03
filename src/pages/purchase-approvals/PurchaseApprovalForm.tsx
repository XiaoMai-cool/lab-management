import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, ReimbursementCategory } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import SubNav from '../../components/SubNav';
import LoadingSpinner from '../../components/LoadingSpinner';

const subNavItems = [
  { to: '/reimbursements', label: '报销记录', exact: true },
  { to: '/reimbursements/new', label: '新建报销' },
  { to: '/purchase-approvals/new', label: '采购审批' },
  { to: '/purchase-approvals', label: '我的采购' },
  { to: '/purchase-approvals/review', label: '审批采购', teacherOnly: true },
  { to: '/reimbursements/review', label: '审批报销', adminOnly: true },
  { to: '/reimbursements/stats', label: '报销统计', managerModule: 'supplies' },
];

const categories: ReimbursementCategory[] = [
  '个人药品',
  '外送检测',
  '设备配件',
  '加工定制',
  '办公打印',
  '差旅费',
  '邮寄快递',
  '其他',
];

export default function PurchaseApprovalForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReimbursementCategory>('其他');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [approverId, setApproverId] = useState('');
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    try {
      setLoadingTeachers(true);
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['teacher', 'admin', 'super_admin'])
        .order('name');
      if (fetchErr) throw fetchErr;
      setTeachers(data ?? []);
      if (data && data.length > 0) {
        setApproverId(data[0].id);
      }
    } catch {
      setError('加载审批老师列表失败');
    } finally {
      setLoadingTeachers(false);
    }
  }

  async function handleSubmit() {
    if (!profile || !title || !purpose || !approverId) return;

    try {
      setSubmitting(true);
      setError(null);

      const parsed = estimatedAmount ? parseFloat(estimatedAmount) : null;
      if (estimatedAmount && (isNaN(parsed!) || parsed! < 0)) {
        setError('请输入有效的金额');
        return;
      }

      const { error: insertErr } = await supabase
        .from('purchase_approvals')
        .insert({
          requester_id: profile.id,
          approver_id: approverId,
          title,
          category,
          estimated_amount: parsed,
          purpose,
          status: 'pending',
        });

      if (insertErr) throw insertErr;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
          <SubNav items={subNavItems} />
        </div>
        <PageHeader title="采购审批申请" subtitle="提交成功" />
        <div className="px-4 md:px-6">
          <Card>
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                审批申请已提交
              </h3>
              <p className="text-sm text-gray-500">
                请等待审批老师审核，审核通过后即可进行采购和报销
              </p>
              <button
                onClick={() => navigate('/purchase-approvals')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                查看我的采购申请
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="px-4 md:px-6 pt-4">
        <SubNav items={subNavItems} />
      </div>
      <PageHeader title="采购审批申请" subtitle="先审批，后采购，再报销" />

      <div className="px-4 md:px-6">
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loadingTeachers ? (
          <LoadingSpinner />
        ) : (
          <Card>
            <div className="space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  采购标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：3月水质检测费"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 类别 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  报销类别
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ReimbursementCategory)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 预计金额 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  预计金额（¥）
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={estimatedAmount}
                    onChange={(e) => setEstimatedAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 用途说明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  用途说明 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={4}
                  placeholder="请详细说明采购用途，如实验项目、具体需求等"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* 审批老师 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择审批老师 <span className="text-red-500">*</span>
                </label>
                <select
                  value={approverId}
                  onChange={(e) => setApproverId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 提交 */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !title || !purpose || !approverId}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? '提交中...' : '提交审批申请'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                提交后将由选择的老师审批，审批通过后方可采购
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
