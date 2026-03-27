import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';

export default function ReimbursementForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    // 暂时使用文件名作为占位，实际应上传到 Supabase Storage
    const urls = Array.from(files).map((f) => f.name);
    setReceiptUrls((prev) => [...prev, ...urls]);
  }

  function removeReceipt(index: number) {
    setReceiptUrls((prev) => prev.filter((_, i) => i !== index));
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

      const { error: insertErr } = await supabase
        .from('reimbursements')
        .insert({
          user_id: profile.id,
          title,
          amount: parsedAmount,
          description,
          receipt_urls: receiptUrls,
          status: 'pending',
        });

      if (insertErr) throw insertErr;

      navigate('/reimbursements');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="报销申请"
        subtitle="填写报销信息并提交审批"
        action={
          <button
            onClick={() => navigate('/reimbursements')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
        }
      />

      <div className="px-4 md:px-6">
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card>
          <div className="space-y-4">
            {/* 标题 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                报销标题
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：2月实验耗材采购报销"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 金额 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金额（¥）
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

            {/* 详细说明 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                详细说明
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="请详细列出报销项目，如：&#10;1. XX试剂 x2 ¥120&#10;2. XX耗材 x5 ¥85&#10;..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 票据上传 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                票据/发票
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-2">
                  点击或拖拽上传票据照片
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* 已选文件 */}
              {receiptUrls.length > 0 && (
                <div className="mt-3 space-y-2">
                  {receiptUrls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-xs text-gray-600 truncate flex-1">
                        {url}
                      </span>
                      <button
                        onClick={() => removeReceipt(index)}
                        className="ml-2 text-xs text-red-500 hover:text-red-700"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 提交 */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !title || !amount}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? '提交中...' : '提交报销申请'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              提交后将由管理员审批，请确保信息准确
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
