import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, PurchaseCategory, PurchaseType } from '../../lib/types';
import { PURCHASE_CATEGORIES, getDefaultSkipRegistration } from '../../lib/purchaseCategories';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function PurchaseApprovalForm() {
  const navigate = useNavigate();
  const { profile, isTeacher } = useAuth();

  const [title, setTitle] = useState('');
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('personal');
  const [category, setCategory] = useState<PurchaseCategory>('其他');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [description, setDescription] = useState('');
  const [skipRegistration, setSkipRegistration] = useState(true);
  const [approverId, setApproverId] = useState('');

  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [defaultTeacherId, setDefaultTeacherId] = useState<string | null>(null);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile) return;

      const { data: teacherData } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['teacher', 'admin', 'super_admin'])
        .neq('email', 'fengfamily@lab')
        .order('name');

      if (teacherData) setTeachers(teacherData as Profile[]);

      if (!isTeacher) {
        const { data: assignment } = await supabase
          .from('student_teacher_assignments')
          .select('teacher_id')
          .eq('student_id', profile.id)
          .single();

        if (assignment) {
          setDefaultTeacherId(assignment.teacher_id);
          setApproverId(assignment.teacher_id);
        }
      }

      setLoadingTeachers(false);
    }
    load();
  }, [profile, isTeacher]);

  useEffect(() => {
    setSkipRegistration(getDefaultSkipRegistration(category));
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    if (!title.trim()) {
      setError('请输入采购标题');
      return;
    }
    if (!isTeacher && !approverId) {
      setError('请选择审批教师');
      return;
    }

    setSubmitting(true);
    setError('');

    const now = new Date().toISOString();
    const isAutoApproved = isTeacher;

    const record = {
      applicant_id: profile.id,
      title: title.trim(),
      purchase_type: purchaseType,
      category,
      estimated_amount: estimatedAmount ? parseFloat(estimatedAmount) : null,
      description: description.trim(),
      skip_registration: skipRegistration,
      approver_id: isAutoApproved ? profile.id : approverId,
      approval_status: isAutoApproved ? 'approved' : 'pending',
      approval_note: isAutoApproved ? '教师自行采购，自动通过' : null,
      approved_at: isAutoApproved ? now : null,
      auto_approved: isAutoApproved,
    };

    const { error: insertErr } = await supabase.from('purchases').insert(record);

    if (insertErr) {
      setError('提交失败：' + insertErr.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  if (!profile) return <LoadingSpinner />;

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">提交成功</h2>
        <p className="text-gray-500 mb-6 text-center">
          {isTeacher ? '采购申请已自动通过，请前往采购完成后提交报销。' : '采购申请已提交，请等待教师审批。'}
        </p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/purchase-approvals')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            查看我的采购
          </button>
          <button onClick={() => { setSuccess(false); setTitle(''); setDescription(''); setEstimatedAmount(''); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            继续提交
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <PageHeader title="采购申请" subtitle="提交采购申请，审批通过后进行采购和报销" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">采购标题 *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：3月水质检测试剂"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">采购类型</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPurchaseType('personal')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  purchaseType === 'personal'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                个人采购
              </button>
              <button
                type="button"
                onClick={() => setPurchaseType('public')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  purchaseType === 'public'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                公共采购
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">类别 *</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as PurchaseCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PURCHASE_CATEGORIES.map(c => (
                <option key={c.label} value={c.label}>{c.label} — {c.description}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">无需入库</p>
              <p className="text-xs text-gray-500">勾选后不流转给耗材/药品专人登记</p>
            </div>
            <button
              type="button"
              onClick={() => setSkipRegistration(!skipRegistration)}
              className={`relative w-11 h-6 rounded-full transition-colors ${skipRegistration ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${skipRegistration ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">预估金额</label>
            <input
              type="number"
              value={estimatedAmount}
              onChange={e => setEstimatedAmount(e.target.value)}
              placeholder="选填"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="选填，补充说明采购内容"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {!isTeacher && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">审批教师 *</label>
              {loadingTeachers ? (
                <p className="text-sm text-gray-400">加载中...</p>
              ) : (
                <select
                  value={approverId}
                  onChange={e => setApproverId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">请选择审批教师</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.id === defaultTeacherId ? '（默认）' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {isTeacher && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">教师提交的采购申请将自动通过审批，无需其他人审批。</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '提交采购申请'}
          </button>
        </form>
      </Card>
    </div>
  );
}
