import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Upload, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Purchase, ReimbursementFile } from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import SubNav from '../../components/SubNav';
import LoadingSpinner from '../../components/LoadingSpinner';

const subNavItems = [
  { to: '/purchase-approvals/new', label: '新建采购' },
  { to: '/purchase-approvals', label: '我的采购' },
];

export default function ReimbursementForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchase_id');

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [actualAmount, setActualAmount] = useState('');
  const [files, setFiles] = useState<ReimbursementFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile && purchaseId) {
      fetchPurchase();
    } else {
      setLoading(false);
    }
  }, [profile, purchaseId]);

  async function fetchPurchase() {
    if (!profile || !purchaseId) return;
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', purchaseId)
        .eq('applicant_id', profile.id)
        .eq('approval_status', 'approved')
        .or('reimbursement_status.is.null,reimbursement_status.eq.pending')
        .single();

      if (fetchErr || !data) {
        setNotFound(true);
        return;
      }

      setPurchase(data as Purchase);
      if (data.estimated_amount) {
        setActualAmount(String(data.estimated_amount));
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    setUploadingFiles((prev) => [...prev, ...Array.from(selectedFiles)]);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeUploadedFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function uploadAllFiles(): Promise<ReimbursementFile[]> {
    if (!profile) return [];
    const uploaded: ReimbursementFile[] = [...files];

    for (const file of uploadingFiles) {
      const ext = file.name.split('.').pop() ?? 'bin';
      const timestamp = Date.now();
      const path = `reimbursements/${profile.id}/${timestamp}.${ext}`;

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

  async function handleSubmit() {
    if (!profile || !purchase) return;

    const parsedAmount = parseFloat(actualAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('请输入有效的实际金额');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const allFiles = await uploadAllFiles();

      const { error: updateErr } = await supabase
        .from('purchases')
        .update({
          actual_amount: parsedAmount,
          receipt_attachments: allFiles,
          reimbursement_status: 'pending',
        })
        .eq('id', purchase.id);

      if (updateErr) throw updateErr;
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  // No purchase_id in URL
  if (!purchaseId) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
        </div>
        <PageHeader title="报销申请" subtitle="提交采购报销" />
        <div className="px-4 md:px-6">
          <Card>
            <div className="text-center py-8 space-y-4">
              <FileText className="w-12 h-12 text-gray-300 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900">
                请从采购列表发起报销
              </h3>
              <p className="text-sm text-gray-500">
                前往「我的采购」页面，在已批准的采购记录上点击「去报销」
              </p>
              <button
                onClick={() => navigate('/purchase-approvals')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                前往我的采购
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  if (notFound) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
        </div>
        <PageHeader title="报销申请" subtitle="未找到记录" />
        <div className="px-4 md:px-6">
          <Card>
            <div className="text-center py-8 space-y-4">
              <p className="text-sm text-gray-500">
                未找到对应的已批准采购记录，可能已报销或被删除
              </p>
              <button
                onClick={() => navigate('/purchase-approvals')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                返回我的采购
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
        </div>
        <PageHeader title="报销申请" subtitle="提交成功" />
        <div className="px-4 md:px-6">
          <Card>
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                报销申请已提交
              </h3>
              <p className="text-sm text-gray-500">
                请等待审批人审核
              </p>
              <button
                onClick={() => navigate('/purchase-approvals')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                返回我的采购
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
      <PageHeader title="报销申请" subtitle="上传凭证并提交报销" />

      <div className="px-4 md:px-6">
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* 采购信息摘要 */}
          {purchase && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">采购信息</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">标题</span>
                  <span className="text-sm font-medium text-gray-900">{purchase.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">类别</span>
                  <span className="text-sm text-gray-700">{purchase.category}</span>
                </div>
                {purchase.estimated_amount != null && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">预估金额</span>
                    <span className="text-sm font-bold text-gray-900">
                      ¥{purchase.estimated_amount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 实际金额 */}
          <Card>
            <div className="space-y-4">
              {purchase?.estimated_amount != null && (
                <p className="text-sm text-gray-500">
                  申请金额: <span className="font-medium text-gray-700">¥{purchase.estimated_amount.toFixed(2)}</span>
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  实际金额（¥） <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 上传凭证 */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              上传凭证
            </h3>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">
                    购买截图、发票、检测报告等凭证
                  </p>
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

              {/* Already uploaded files */}
              {files.length > 0 && (
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {files.map((file, index) => (
                    <div
                      key={`uploaded-${index}`}
                      className="flex items-center justify-between p-2 bg-green-50 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-green-600">已上传</p>
                      </div>
                      <button
                        onClick={() => removeUploadedFile(index)}
                        className="shrink-0 ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending upload files */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {uploadingFiles.map((file, index) => (
                    <div
                      key={`pending-${index}`}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
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
          </Card>

          {/* 提交 */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !actualAmount}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {submitting ? '提交中...' : '提交报销申请'}
          </button>

          <p className="text-xs text-gray-400 text-center pb-4">
            提交后将进入审批流程，请确保凭证准确完整
          </p>
        </div>
      </div>
    </div>
  );
}
