import { useState } from 'react';
import {
  Package,
  ClipboardList,
  FlaskConical,
  Receipt,
  Download,
  CheckCircle,
  FileSpreadsheet,
  ArrowLeftRight,
  AlertTriangle,
  ScrollText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { downloadExcel, downloadMultiSheetExcel } from '../../lib/exportExcel';
import {
  fetchSupplies,
  fetchReservations,
  fetchBorrowings,
  fetchChemicalInventory,
  fetchChemicalUsage,
  fetchChemicalWarnings,
  fetchPurchases,
  fetchAuditLog,
  fetchAllExportData,
} from '../../lib/exportDataFetchers';
import PageHeader from '../../components/PageHeader';
import AuditLogTab from './AuditLogTab';

interface ExportCard {
  key: string;
  title: string;
  description: string;
  icon: typeof Package;
  color: string;
  fetcher: () => Promise<{ data: Record<string, unknown>[]; name: string }>;
}

export default function DataExport() {
  const { profile, isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<'export' | 'audit'>('export');
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const exportCards: ExportCard[] = [
    {
      key: 'supplies',
      title: '耗材库存',
      description: '导出所有耗材的库存信息',
      icon: Package,
      color: 'bg-blue-50 text-blue-600',
      fetcher: fetchSupplies,
    },
    {
      key: 'reservations',
      title: '耗材申领记录',
      description: '导出所有耗材申领申请记录',
      icon: ClipboardList,
      color: 'bg-green-50 text-green-600',
      fetcher: fetchReservations,
    },
    {
      key: 'borrowings',
      title: '耗材借用记录',
      description: '导出所有耗材借用记录',
      icon: ArrowLeftRight,
      color: 'bg-cyan-50 text-cyan-600',
      fetcher: fetchBorrowings,
    },
    {
      key: 'chemical_inventory',
      title: '药品库存',
      description: '导出所有药品的当前库存状态',
      icon: FlaskConical,
      color: 'bg-indigo-50 text-indigo-600',
      fetcher: fetchChemicalInventory,
    },
    {
      key: 'chemical_usage',
      title: '药品使用记录',
      description: '导出所有药品使用日志',
      icon: FlaskConical,
      color: 'bg-purple-50 text-purple-600',
      fetcher: fetchChemicalUsage,
    },
    {
      key: 'chemical_warnings',
      title: '药品补货记录',
      description: '导出药品补货与预警记录',
      icon: AlertTriangle,
      color: 'bg-orange-50 text-orange-600',
      fetcher: fetchChemicalWarnings,
    },
    {
      key: 'purchases',
      title: '采购记录',
      description: '导出所有采购申请记录',
      icon: Receipt,
      color: 'bg-amber-50 text-amber-600',
      fetcher: fetchPurchases,
    },
    {
      key: 'audit_log',
      title: '操作日志',
      description: '导出系统操作审计日志',
      icon: ScrollText,
      color: 'bg-gray-50 text-gray-600',
      fetcher: () => fetchAuditLog(isSuperAdmin ? undefined : profile?.id),
    },
  ];

  async function handleSingleExport(card: ExportCard) {
    setExporting(card.key);
    setError(null);
    try {
      const result = await card.fetcher();
      downloadExcel(result.data, result.name);
      setExported((prev) => new Set([...prev, card.key]));
    } catch (err) {
      console.error('Export failed:', err);
      setError('导出失败，请重试');
    } finally {
      setExporting(null);
    }
  }

  async function handleFullExport() {
    setExporting('__all__');
    setError(null);
    try {
      const sheets = await fetchAllExportData(isSuperAdmin ? undefined : profile?.id);
      downloadMultiSheetExcel(sheets, '实验室管理系统数据导出');
      setExported(new Set(exportCards.map((c) => c.key)));
    } catch (err) {
      console.error('Full export failed:', err);
      setError('全量导出失败，请重试');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <PageHeader title="数据管理" subtitle="导出数据与查看操作日志" />

      <div className="px-4 md:px-6 pb-6">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button
            onClick={() => setTab('export')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'export'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            数据导出
          </button>
          <button
            onClick={() => setTab('audit')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            操作日志
          </button>
        </div>

        {tab === 'audit' ? (
          <AuditLogTab />
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Full export button */}
            <div className="mb-4">
              <button
                onClick={handleFullExport}
                disabled={exporting !== null}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting === '__all__' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    全量导出
                  </>
                )}
              </button>
            </div>

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
                      onClick={() => handleSingleExport(card)}
                      disabled={exporting !== null}
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
          </>
        )}
      </div>
    </div>
  );
}
