import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  BarChart3,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
  Link2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Reimbursement,
  Profile,
  PurchaseApproval,
  ReimbursementCategory,
  ReimbursementFile,
} from '../../lib/types';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import SubNav from '../../components/SubNav';

const subNavItems = [
  { to: '/reimbursements', label: '报销记录', exact: true },
  { to: '/reimbursements/new', label: '新建报销' },
  { to: '/purchase-approvals/new', label: '采购审批' },
  { to: '/purchase-approvals', label: '我的采购' },
  { to: '/purchase-approvals/review', label: '审批采购', teacherOnly: true },
  { to: '/reimbursements/review', label: '审批报销', adminOnly: true },
  { to: '/reimbursements/stats', label: '报销统计', managerModule: 'supplies' },
];

const categoryColors: Record<string, string> = {
  '个人药品': 'bg-purple-50 text-purple-700 border-purple-200',
  '外送检测': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  '设备配件': 'bg-orange-50 text-orange-700 border-orange-200',
  '加工定制': 'bg-pink-50 text-pink-700 border-pink-200',
  '办公打印': 'bg-gray-50 text-gray-700 border-gray-200',
  '差旅费': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '邮寄快递': 'bg-teal-50 text-teal-700 border-teal-200',
  '其他': 'bg-gray-50 text-gray-600 border-gray-200',
};

const fileTypeLabels: Record<string, string> = {
  screenshot: '购买截图',
  invoice: '发票',
  test_report: '检测报告',
  cert: '资质证书',
  other: '其他',
};

// Auto-routing rules
const routingRules: Record<string, string> = {
  '个人药品': '宋艳芳（药品专人）',
};
const defaultRouter = '王子寒（耗材专人）';

const allCategories: ReimbursementCategory[] = [
  '个人药品',
  '外送检测',
  '设备配件',
  '加工定制',
  '办公打印',
  '差旅费',
  '邮寄快递',
  '其他',
];

interface ReimbursementWithRelations extends Reimbursement {
  user?: Profile;
  purchase_approval?: PurchaseApproval;
}

export default function ReimbursementStats() {
  const { profile, isAdmin, isSuppliesManager, isChemicalsManager } =
    useAuth();
  const [list, setList] = useState<ReimbursementWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(
    dayjs().startOf('month').format('YYYY-MM-DD')
  );
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [routerFilter, setRouterFilter] = useState<string>('all');

  // Detail expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasAccess = isAdmin || isSuppliesManager || isChemicalsManager;

  useEffect(() => {
    if (hasAccess) fetchData();
  }, [hasAccess, dateFrom, dateTo]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('reimbursements')
        .select(
          '*, user:profiles!reimbursements_user_id_fkey(*), purchase_approval:purchase_approvals(*)'
        )
        .in('status', ['approved', 'completed'])
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      // Scope by role
      if (!isAdmin) {
        if (isChemicalsManager && !isSuppliesManager) {
          query = query.eq('category', '个人药品');
        } else if (isSuppliesManager && !isChemicalsManager) {
          query = query.neq('category', '个人药品');
        }
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

  function getRouter(cat: string): string {
    return routingRules[cat] ?? defaultRouter;
  }

  const filtered = useMemo(() => {
    let result = list;
    if (categoryFilter !== 'all') {
      result = result.filter((r) => r.category === categoryFilter);
    }
    if (routerFilter !== 'all') {
      result = result.filter((r) => getRouter(r.category) === routerFilter);
    }
    return result;
  }, [list, categoryFilter, routerFilter]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, r) => sum + r.amount, 0),
    [filtered]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    filtered.forEach((r) => {
      const existing = map.get(r.category) ?? { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += r.amount;
      map.set(r.category, existing);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [filtered]);

  function exportCSV() {
    const header = '申请人,标题,类别,金额,日期,状态,物资登记人\n';
    const rows = filtered
      .map(
        (r) =>
          `${r.user?.name ?? ''},${r.title},${r.category},${r.amount.toFixed(2)},${dayjs(r.created_at).format('YYYY-MM-DD')},${r.status},${getRouter(r.category)}`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `报销统计_${dateFrom}_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!hasAccess) {
    return (
      <div className="pb-8">
        <div className="px-4 md:px-6 pt-4">
          <SubNav items={subNavItems} />
        </div>
        <div className="p-4">
          <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg text-sm">
            仅物资管理员可访问此页面
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
        title="报销统计"
        subtitle="已批准报销的统计与物资登记分配"
        action={
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出 CSV
          </button>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            加载失败：{error}
          </div>
        )}

        {/* 自动分配说明 */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            物资登记自动分配
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
              <span className="text-xs font-medium text-purple-700">
                个人药品
              </span>
              <span className="text-xs text-purple-600">
                → 宋艳芳（药品专人）
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
              <span className="text-xs font-medium text-blue-700">
                其他类别
              </span>
              <span className="text-xs text-blue-600">
                → 王子寒（耗材专人）
              </span>
            </div>
          </div>
        </Card>

        {/* 筛选区域 */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">筛选</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">类别</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">全部类别</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                登记人
              </label>
              <select
                value={routerFilter}
                onChange={(e) => setRouterFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">全部</option>
                <option value="宋艳芳（药品专人）">宋艳芳（药品专人）</option>
                <option value="王子寒（耗材专人）">王子寒（耗材专人）</option>
              </select>
            </div>
          </div>
        </Card>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* 汇总卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <p className="text-xs text-gray-500">总金额</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  ¥{totalAmount.toFixed(2)}
                </p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500">报销笔数</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {filtered.length}
                </p>
              </Card>
              {categoryBreakdown.slice(0, 2).map(([cat, data]) => (
                <Card key={cat}>
                  <p className="text-xs text-gray-500">{cat}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    ¥{data.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">{data.count} 笔</p>
                </Card>
              ))}
            </div>

            {/* 分类明细 */}
            {categoryBreakdown.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  分类汇总
                </h3>
                <div className="space-y-2">
                  {categoryBreakdown.map(([cat, data]) => {
                    const pct =
                      totalAmount > 0
                        ? ((data.amount / totalAmount) * 100).toFixed(1)
                        : '0';
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${
                            categoryColors[cat]?.split(' ').slice(0, 2).join(' ') ??
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {cat}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{
                              width: `${totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 w-20 text-right">
                          ¥{data.amount.toFixed(0)} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* 明细表格 */}
            {filtered.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="暂无数据"
                description="当前筛选条件下没有已批准的报销记录"
              />
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  报销明细
                </h3>
                {filtered.map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <Card key={item.id}>
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.id)
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {item.title}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                categoryColors[item.category]
                                  ?.split(' ')
                                  .slice(0, 2)
                                  .join(' ') ?? 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.category}
                            </span>
                            <StatusBadge
                              status={item.status}
                              type="reimbursement"
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            {item.user?.name ?? '未知'} |{' '}
                            {dayjs(item.created_at).format('YYYY-MM-DD')} |{' '}
                            <span className="font-medium">
                              {getRouter(item.category)}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-lg font-bold text-gray-900">
                            ¥{item.amount.toFixed(2)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                          {item.description && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1 font-medium">
                                明细描述
                              </p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {item.description}
                              </p>
                            </div>
                          )}

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
                                {item.purchase_approval.estimated_amount !=
                                  null &&
                                  ` | 预计 ¥${item.purchase_approval.estimated_amount.toFixed(2)}`}
                              </p>
                            </div>
                          )}

                          {item.file_paths && item.file_paths.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1.5">
                                上传凭证（{item.file_paths.length}）
                              </p>
                              <div className="space-y-1">
                                {(item.file_paths as ReimbursementFile[]).map(
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
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
