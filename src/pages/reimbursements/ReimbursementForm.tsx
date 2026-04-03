import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, Send, X, FileText, Image } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  PurchaseApproval,
  ReimbursementCategory,
  ReimbursementFile,
} from '../../lib/types';
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

export default function ReimbursementForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const approvalIdFromUrl = searchParams.get('approval_id');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReimbursementCategory>('其他');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [purchaseApprovalId, setPurchaseApprovalId] = useState<string | null>(
    approvalIdFromUrl
  );

  // File uploads (placeholder - stores name & size only)
  const [screenshots, setScreenshots] = useState<ReimbursementFile[]>([]);
  const [invoices, setInvoices] = useState<ReimbursementFile[]>([]);
  const [testReports, setTestReports] = useState<ReimbursementFile[]>([]);
  const [certFiles, setCertFiles] = useState<ReimbursementFile[]>([]);

  // Approved purchase approvals for linking
  const [approvedApprovals, setApprovedApprovals] = useState<
    PurchaseApproval[]
  >([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchApprovedApprovals();
    }
  }, [profile]);

  async function fetchApprovedApprovals() {
    if (!profile) return;
    try {
      setLoadingApprovals(true);

      // Get approved purchase approvals that don't have a reimbursement yet
      const { data: approvals, error: fetchErr } = await supabase
        .from('purchase_approvals')
        .select('*')
        .eq('requester_id', profile.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      // Filter out ones that already have a reimbursement
      const { data: existingReimb } = await supabase
        .from('reimbursements')
        .select('purchase_approval_id')
        .eq('user_id', profile.id)
        .not('purchase_approval_id', 'is', null);

      const usedIds = new Set(
        (existingReimb ?? []).map((r) => r.purchase_approval_id)
      );
      const available = (approvals ?? []).filter(
        (a) => !usedIds.has(a.id)
      );
      setApprovedApprovals(available);

      // Pre-fill from URL param
      if (approvalIdFromUrl) {
        const target = (approvals ?? []).find(
          (a) => a.id === approvalIdFromUrl
        );
        if (target) {
          setTitle(target.title);
          setCategory(target.category);
          if (target.estimated_amount) {
            setAmount(String(target.estimated_amount));
          }
          setPurchaseApprovalId(target.id);
        }
      }
    } catch {
      // silent - approvals are optional
    } finally {
      setLoadingApprovals(false);
    }
  }

  function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    type: ReimbursementFile['type'],
    setter: React.Dispatch<React.SetStateAction<ReimbursementFile[]>>
  ) {
    const files = e.target.files;
    if (!files) return;
    const newFiles: ReimbursementFile[] = Array.from(files).map((f) => ({
      name: f.name,
      url: '', // placeholder - real upload later
      type,
      size: f.size,
    }));
    setter((prev) => [...prev, ...newFiles]);
    e.target.value = ''; // reset input
  }

  function removeFile(
    index: number,
    setter: React.Dispatch<React.SetStateAction<ReimbursementFile[]>>
  ) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function handleApprovalChange(id: string) {
    if (!id) {
      setPurchaseApprovalId(null);
      return;
    }
    setPurchaseApprovalId(id);
    const target = approvedApprovals.find((a) => a.id === id);
    if (target) {
      setTitle(target.title);
      setCategory(target.category);
      if (target.estimated_amount) {
        setAmount(String(target.estimated_amount));
      }
    }
  }

  async function handleSubmit() {
    if (!profile || !title || !amount) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('请输入有效的金额');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const allFiles: ReimbursementFile[] = [
        ...screenshots,
        ...invoices,
        ...testReports,
        ...certFiles,
      ];

      const { error: insertErr } = await supabase
        .from('reimbursements')
        .insert({
          user_id: profile.id,
          title,
          amount: parsedAmount,
          description,
          category,
          purchase_approval_id: purchaseApprovalId || null,
          receipt_urls: allFiles.map((f) => f.name),
          file_paths: allFiles,
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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (success) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
          <SubNav items={subNavItems} />
        </div>
        <PageHeader title="报销申请" subtitle="提交成功" />
        <div className="px-4 md:px-6">
          <Card>
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                报销申请已提交
              </h3>
              <p className="text-sm text-gray-500">
                请等待审批人审核，审核通过后将进入物资登记流程
              </p>
              <button
                onClick={() => navigate('/reimbursements')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                查看报销记录
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
      <PageHeader title="报销申请" subtitle="填写报销信息并上传凭证" />

      <div className="px-4 md:px-6">
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loadingApprovals ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4">
            <Card>
              <div className="space-y-4">
                {/* 关联采购审批 */}
                {approvedApprovals.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      关联采购审批（可选）
                    </label>
                    <select
                      value={purchaseApprovalId ?? ''}
                      onChange={(e) => handleApprovalChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">不关联</option>
                      {approvedApprovals.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                          {a.estimated_amount
                            ? ` (¥${a.estimated_amount.toFixed(2)})`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      选择后将自动填充标题和类别
                    </p>
                  </div>
                )}

                {/* 标题 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    报销标题 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：2月实验耗材采购报销"
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

                {/* 金额 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    金额（¥） <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ¥
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 明细描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    明细描述
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder={
                      '请详细列出报销项目，如：\n1. XX试剂 x2 ¥120\n2. XX耗材 x5 ¥85\n...'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            </Card>

            {/* 上传凭证 */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                上传凭证
              </h3>
              <div className="space-y-4">
                {/* 购买截图 */}
                <FileUploadSection
                  label="购买截图"
                  description="订单截图、付款截图等"
                  accept="image/*"
                  files={screenshots}
                  onSelect={(e) =>
                    handleFileSelect(e, 'screenshot', setScreenshots)
                  }
                  onRemove={(i) => removeFile(i, setScreenshots)}
                  formatSize={formatFileSize}
                  icon={<Image className="w-5 h-5 text-gray-400" />}
                />

                {/* 发票 */}
                <FileUploadSection
                  label="发票"
                  description="电子发票或纸质发票照片"
                  accept="image/*,.pdf"
                  files={invoices}
                  onSelect={(e) =>
                    handleFileSelect(e, 'invoice', setInvoices)
                  }
                  onRemove={(i) => removeFile(i, setInvoices)}
                  formatSize={formatFileSize}
                  icon={<FileText className="w-5 h-5 text-gray-400" />}
                />

                {/* 外送检测额外字段 */}
                {category === '外送检测' && (
                  <>
                    <FileUploadSection
                      label="检测报告"
                      description="第三方检测报告文件"
                      accept="image/*,.pdf"
                      files={testReports}
                      onSelect={(e) =>
                        handleFileSelect(e, 'test_report', setTestReports)
                      }
                      onRemove={(i) => removeFile(i, setTestReports)}
                      formatSize={formatFileSize}
                      icon={<FileText className="w-5 h-5 text-cyan-400" />}
                    />

                    <FileUploadSection
                      label="检测机构资质证书"
                      description="CMA/CNAS等资质证书"
                      accept="image/*,.pdf"
                      files={certFiles}
                      onSelect={(e) =>
                        handleFileSelect(e, 'cert', setCertFiles)
                      }
                      onRemove={(i) => removeFile(i, setCertFiles)}
                      formatSize={formatFileSize}
                      icon={<FileText className="w-5 h-5 text-amber-400" />}
                    />
                  </>
                )}
              </div>
            </Card>

            {/* 提交 */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !title || !amount}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? '提交中...' : '提交报销申请'}
            </button>

            <p className="text-xs text-gray-400 text-center pb-4">
              提交后将自动分配给审批人，请确保信息和凭证准确
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- File Upload Sub-component ---- */

interface FileUploadSectionProps {
  label: string;
  description: string;
  accept: string;
  files: ReimbursementFile[];
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
  formatSize: (bytes: number) => string;
  icon: React.ReactNode;
}

function FileUploadSection({
  label,
  description,
  accept,
  files,
  onSelect,
  onRemove,
  formatSize,
  icon,
}: FileUploadSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
        <div className="flex items-center gap-3 mb-2">
          {icon}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <label className="shrink-0 cursor-pointer">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              选择文件
            </span>
            <input
              type="file"
              multiple
              accept={accept}
              onChange={onSelect}
              className="hidden"
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(index)}
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
  );
}
