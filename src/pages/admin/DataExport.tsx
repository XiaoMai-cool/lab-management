import { useState } from 'react';
import {
  Package,
  ClipboardList,
  FlaskConical,
  Receipt,
  Download,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { downloadExcel } from '../../lib/exportExcel';
import PageHeader from '../../components/PageHeader';

interface ExportCard {
  key: string;
  title: string;
  description: string;
  icon: typeof Package;
  color: string;
}

const exportCards: ExportCard[] = [
  {
    key: 'supplies',
    title: '导出耗材库存',
    description: '导出所有耗材的库存信息',
    icon: Package,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    key: 'reservations',
    title: '导出预约记录',
    description: '导出所有耗材预约申请记录',
    icon: ClipboardList,
    color: 'bg-green-50 text-green-600',
  },
  {
    key: 'chemicals',
    title: '导出药品记录',
    description: '导出所有药品信息',
    icon: FlaskConical,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    key: 'purchases',
    title: '导出采购记录',
    description: '导出所有采购申请记录',
    icon: Receipt,
    color: 'bg-amber-50 text-amber-600',
  },
];

export default function DataExport() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleExport(key: string) {
    setExporting(key);
    setError(null);

    try {
      switch (key) {
        case 'supplies': {
          const { data, error: err } = await supabase
            .from('supplies')
            .select('name, specification, stock, unit, min_stock, category:supply_categories(name), updated_at')
            .order('name');
          if (err) throw err;
          const rows = (data ?? []).map((s: Record<string, unknown>) => ({
            '名称': s.name,
            '规格': s.specification,
            '库存': s.stock,
            '单位': s.unit,
            '最低库存': s.min_stock,
            '分类': (s.category as Record<string, unknown>)?.name ?? '',
            '更新时间': s.updated_at,
          }));
          downloadExcel(rows, '耗材库存');
          break;
        }

        case 'reservations': {
          const { data, error: err } = await supabase
            .from('supply_reservations')
            .select('*, supply:supplies(name), user:profiles!user_id(name)')
            .order('created_at', { ascending: false });
          if (err) throw err;
          const rows = (data ?? []).map((r: Record<string, unknown>) => ({
            '耗材': (r.supply as Record<string, unknown>)?.name ?? '',
            '申请人': (r.user as Record<string, unknown>)?.name ?? '',
            '数量': r.quantity,
            '用途': r.purpose,
            '是否归还': r.is_returnable ? '是' : '否',
            '状态': r.status,
            '申请时间': r.created_at,
            '审批备注': r.review_note ?? '',
          }));
          downloadExcel(rows, '预约记录');
          break;
        }

        case 'chemicals': {
          const { data, error: err } = await supabase
            .from('chemical_usage_logs')
            .select('*, chemical:chemicals(name), user:profiles!user_id(name)')
            .order('used_at', { ascending: false });
          if (err) throw err;
          const rows = (data ?? []).map((l: Record<string, unknown>) => ({
            '化学品': (l.chemical as Record<string, unknown>)?.name ?? '',
            '使用人': (l.user as Record<string, unknown>)?.name ?? '',
            '用量': l.amount,
            '单位': l.unit,
            '用途': l.purpose,
            '使用时间': l.used_at,
          }));
          downloadExcel(rows, '药品记录');
          break;
        }

        case 'purchases': {
          const { data, error: err } = await supabase
            .from('purchases')
            .select('*, applicant:profiles!purchases_applicant_id_fkey(name), approver:profiles!purchases_approver_id_fkey(name)')
            .order('created_at', { ascending: false });
          if (err) throw err;
          const rows = (data ?? []).map((p: Record<string, unknown>) => ({
            '申请人': (p.applicant as Record<string, unknown>)?.name ?? '',
            '标题': p.title,
            '类别': p.category,
            '采购类型': p.purchase_type === 'personal' ? '个人' : '公共',
            '金额': p.estimated_amount,
            '审批状态': p.approval_status,
            '审批人': (p.approver as Record<string, unknown>)?.name ?? '',
            '报销状态': p.reimbursement_status ?? '',
            '入库状态': p.skip_registration ? '无需登记' : (p.registration_status as string) === 'registered' ? '已登记' : '未登记',
            '日期': p.created_at,
          }));
          downloadExcel(rows, '采购记录');
          break;
        }
      }

      setExported((prev) => new Set([...prev, key]));
    } catch (err) {
      console.error('Export failed:', err);
      setError('导出失败，请重试');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader title="数据导出" subtitle="导出各类数据为 Excel 文件" />

      <div className="px-4 md:px-6 pb-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {exportCards.map((card) => {
            const Icon = card.icon;
            const isExporting = exporting === card.key;
            const isExported = exported.has(card.key);

            return (
              <div
                key={card.key}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {card.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {card.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleExport(card.key)}
                  disabled={isExporting}
                  className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    isExported
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      导出中...
                    </>
                  ) : isExported ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      重新导出
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      下载 Excel
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
