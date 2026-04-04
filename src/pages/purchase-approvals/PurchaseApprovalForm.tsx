import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Upload, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, PurchaseCategory, PurchaseType, ReimbursementFile } from '../../lib/types';
import { PURCHASE_CATEGORIES, getDefaultSkipRegistration } from '../../lib/purchaseCategories';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import LoadingSpinner from '../../components/LoadingSpinner';

// Extra fields for 试剂药品
interface ReagentExtraFields {
  item_name: string;
  cas_number: string;
  specification: string;
  concentration: string;
  purity: string;
  manufacturer: string;
  quantity: string;
  unit: string;
}

// Extra fields for 耗材/设备/服装
interface SupplyExtraFields {
  item_name: string;
  specification: string;
  quantity: string;
  unit: string;
}

const CATEGORIES_WITH_REAGENT_FIELDS: PurchaseCategory[] = ['试剂药品'];
const CATEGORIES_WITH_SUPPLY_FIELDS: PurchaseCategory[] = ['实验耗材', '设备配件', '服装劳保'];

function hasReagentFields(category: PurchaseCategory) {
  return CATEGORIES_WITH_REAGENT_FIELDS.includes(category);
}

function hasSupplyFields(category: PurchaseCategory) {
  return CATEGORIES_WITH_SUPPLY_FIELDS.includes(category);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PurchaseApprovalForm() {
  const navigate = useNavigate();
  const { profile, isTeacher } = useAuth();

  const [title, setTitle] = useState('');
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('personal');
  const [category, setCategory] = useState<PurchaseCategory>('其他');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [description, setDescription] = useState('');
  const [approverId, setApproverId] = useState('');

  // Extra fields
  const [reagentFields, setReagentFields] = useState<ReagentExtraFields>({
    item_name: '', cas_number: '', specification: '', concentration: '',
    purity: '', manufacturer: '', quantity: '', unit: '',
  });
  const [supplyFields, setSupplyFields] = useState<SupplyExtraFields>({
    item_name: '', specification: '', quantity: '', unit: '',
  });

  // Attachments
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);

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
        .in('role', ['teacher', 'manager', 'admin', 'super_admin'])
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

  // Sync supply item_name default from title
  useEffect(() => {
    if (hasSupplyFields(category) && !supplyFields.item_name) {
      setSupplyFields(prev => ({ ...prev, item_name: title }));
    }
  }, [title, category]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    setUploadingFiles(prev => [...prev, ...Array.from(selectedFiles)]);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function uploadAllFiles(): Promise<ReimbursementFile[]> {
    if (!profile) return [];
    const uploaded: ReimbursementFile[] = [];

    for (const file of uploadingFiles) {
      const ext = file.name.split('.').pop() ?? 'bin';
      const timestamp = Date.now();
      const path = `purchases/${profile.id}/${timestamp}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('attachments')
        .upload(path, file);

      if (uploadErr) throw new Error(`上传文件 ${file.name} 失败: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(path);

      uploaded.push({
        name: file.name,
        url: urlData.publicUrl,
        type: 'other',
        size: file.size,
      });
    }

    return uploaded;
  }

  function buildExtraFields(): Record<string, unknown> {
    if (hasReagentFields(category)) {
      return {
        item_name: reagentFields.item_name || '',
        cas_number: reagentFields.cas_number || '',
        specification: reagentFields.specification || '',
        concentration: reagentFields.concentration || '',
        purity: reagentFields.purity || '',
        manufacturer: reagentFields.manufacturer || '',
        quantity: reagentFields.quantity ? parseFloat(reagentFields.quantity) : null,
        unit: reagentFields.unit || '',
      };
    }
    if (hasSupplyFields(category)) {
      return {
        item_name: supplyFields.item_name || title,
        specification: supplyFields.specification || '',
        quantity: supplyFields.quantity ? parseFloat(supplyFields.quantity) : null,
        unit: supplyFields.unit || '',
      };
    }
    return {};
  }

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
    if (hasReagentFields(category) && !reagentFields.item_name.trim()) {
      setError('请输入药品名称');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const now = new Date().toISOString();
      const isAutoApproved = isTeacher;
      const skipRegistration = getDefaultSkipRegistration(category);

      // Upload attachments
      const attachments = await uploadAllFiles();

      // Determine reimbursement_status
      const parsedAmount = estimatedAmount ? parseFloat(estimatedAmount) : null;
      const autoReimbursement = attachments.length > 0 && parsedAmount != null;

      const record: Record<string, unknown> = {
        applicant_id: profile.id,
        title: title.trim(),
        purchase_type: purchaseType,
        category,
        estimated_amount: parsedAmount,
        description: description.trim(),
        skip_registration: skipRegistration,
        extra_fields: buildExtraFields(),
        attachments,
        approver_id: isAutoApproved ? profile.id : approverId,
        approval_status: isAutoApproved ? 'approved' : 'pending',
        approval_note: isAutoApproved ? '教师自行采购，自动通过' : null,
        approved_at: isAutoApproved ? now : null,
        auto_approved: isAutoApproved,
      };

      if (autoReimbursement) {
        record.reimbursement_status = 'pending';
      }

      const { error: insertErr } = await supabase.from('purchases').insert(record);

      if (insertErr) {
        setError('提交失败：' + insertErr.message);
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
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
          <button onClick={() => { setSuccess(false); setTitle(''); setDescription(''); setEstimatedAmount(''); setUploadingFiles([]); setReagentFields({ item_name: '', cas_number: '', specification: '', concentration: '', purity: '', manufacturer: '', quantity: '', unit: '' }); setSupplyFields({ item_name: '', specification: '', quantity: '', unit: '' }); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
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

          {/* 试剂药品 extra fields */}
          {hasReagentFields(category) && (
            <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs font-medium text-purple-700">药品详细信息</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">药品名称 *</label>
                <input
                  type="text"
                  value={reagentFields.item_name}
                  onChange={e => setReagentFields(prev => ({ ...prev, item_name: e.target.value }))}
                  placeholder="药品名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CAS号</label>
                  <input
                    type="text"
                    value={reagentFields.cas_number}
                    onChange={e => setReagentFields(prev => ({ ...prev, cas_number: e.target.value }))}
                    placeholder="选填"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">规格</label>
                  <input
                    type="text"
                    value={reagentFields.specification}
                    onChange={e => setReagentFields(prev => ({ ...prev, specification: e.target.value }))}
                    placeholder="选填"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">浓度</label>
                  <input
                    type="text"
                    value={reagentFields.concentration}
                    onChange={e => setReagentFields(prev => ({ ...prev, concentration: e.target.value }))}
                    placeholder="选填"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">纯度</label>
                  <input
                    type="text"
                    value={reagentFields.purity}
                    onChange={e => setReagentFields(prev => ({ ...prev, purity: e.target.value }))}
                    placeholder="选填"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">期望厂家</label>
                <input
                  type="text"
                  value={reagentFields.manufacturer}
                  onChange={e => setReagentFields(prev => ({ ...prev, manufacturer: e.target.value }))}
                  placeholder="选填"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">数量</label>
                  <input
                    type="number"
                    value={reagentFields.quantity}
                    onChange={e => setReagentFields(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="选填"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">单位</label>
                  <input
                    type="text"
                    value={reagentFields.unit}
                    onChange={e => setReagentFields(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="瓶/盒/支..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 耗材/设备/服装 extra fields */}
          {hasSupplyFields(category) && (
            <div className="space-y-3 p-3 bg-cyan-50 rounded-lg border border-cyan-100">
              <p className="text-xs font-medium text-cyan-700">物品详细信息</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">物品名称</label>
                <input
                  type="text"
                  value={supplyFields.item_name}
                  onChange={e => setSupplyFields(prev => ({ ...prev, item_name: e.target.value }))}
                  placeholder={title || '选填，默认使用标题'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">规格型号</label>
                <input
                  type="text"
                  value={supplyFields.specification}
                  onChange={e => setSupplyFields(prev => ({ ...prev, specification: e.target.value }))}
                  placeholder="选填"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">数量</label>
                  <input
                    type="number"
                    value={supplyFields.quantity}
                    onChange={e => setSupplyFields(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="选填"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">单位</label>
                  <input
                    type="text"
                    value={supplyFields.unit}
                    onChange={e => setSupplyFields(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="个/包/箱..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
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

          {/* 附件上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">附件（发票/收据等）</label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">支持图片、PDF、Word、Excel</p>
                </div>
                <label className="shrink-0 cursor-pointer">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    选择文件
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadingFiles.length > 0 && (
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {uploadingFiles.map((file, index) => (
                    <div
                      key={`pending-${index}`}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="shrink-0 ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
