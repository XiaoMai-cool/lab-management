import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  BarChart3,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Purchase, PurchaseCategory, ReimbursementFile } from '../../lib/types';
import { PURCHASE_CATEGORIES } from '../../lib/purchaseCategories';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

const fileTypeLabels: Record<string, string> = {
  screenshot: '购买截图',
  invoice: '发票',
  test_report: '检测报告',
  cert: '资质证书',
  other: '其他',
};

const categoryColors: Record<string, string> = {
  '试剂药品': 'bg-purple-50 text-purple-700',
  '实验耗材': 'bg-cyan-50 text-cyan-700',
  '设备配件': 'bg-orange-50 text-orange-700',
  '服装劳保': 'bg-pink-50 text-pink-700',
  '测试加工': 'bg-teal-50 text-teal-700',
  '会议培训': 'bg-indigo-50 text-indigo-700',
  '出版知产': 'bg-blue-50 text-blue-700',
  '办公用品': 'bg-gray-100 text-gray-700',
  '差旅交通': 'bg-amber-50 text-amber-700',
  '邮寄物流': 'bg-emerald-50 text-emerald-700',
  '其他': 'bg-gray-100 text-gray-600',
};

type GroupTab = '全部' | '试剂药品' | '实验耗材' | '服务费用' | '行政开支' | '其他';

const groupTabs: { key: GroupTab; label: string }[] = [
  { key: '全部', label: '全部' },
  { key: '试剂药品', label: '试剂药品' },
  { key: '实验耗材', label: '实验耗材' },
  { key: '服务费用', label: '服务费用' },
  { key: '行政开支', label: '行政开支' },
  { key: '其他', label: '其他' },
];

const groupCategoryMap: Record<GroupTab, PurchaseCategory[] | null> = {
  '全部': null,
  '试剂药品': ['试剂药品'],
  '实验耗材': ['实验耗材', '设备配件', '服装劳保'],
  '服务费用': ['测试加工', '会议培训', '出版知产'],
  '行政开支': ['办公用品', '差旅交通', '邮寄物流'],
  '其他': ['其他'],
};

interface PurchaseWithApplicant extends Purchase {
  applicant?: { name: string };
}

export default function ReimbursementStats() {
  const [list, setList] = useState<PurchaseWithApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Group tab
  const [groupTab, setGroupTab] = useState<GroupTab>('全部');

  // Filters
  const [nameFilter, setNameFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(
    dayjs().startOf('month').format('YYYY-MM-DD')
  );
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<string>('all');

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterExpanded, setFilterExpanded] = useState(false);

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const query = supabase
        .from('purchases')
        .select(
          '*, applicant:profiles!purchases_applicant_id_fkey(name)'
        )
        .eq('reimbursement_status', 'approved')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setList((data as PurchaseWithApplicant[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = list;

    // Group tab filter
    const groupCategories = groupCategoryMap[groupTab];
    if (groupCategories) {
      result = result.filter((r) =>
        groupCategories.includes(r.category)
      );
    }

    // Name filter
    if (nameFilter.trim()) {
      const keyword = nameFilter.trim().toLowerCase();
      result = result.filter(
        (r) => r.applicant?.name?.toLowerCase().includes(keyword)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((r) => r.category === categoryFilter);
    }

    // Purchase type filter
    if (purchaseTypeFilter !== 'all') {
      result = result.filter((r) => r.purchase_type === purchaseTypeFilter);
    }

    // Amount range
    if (minAmount) {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        result = result.filter((r) => (r.actual_amount ?? 0) >= min);
      }
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) {
        result = result.filter((r) => (r.actual_amount ?? 0) <= max);
      }
    }

    return result;
  }, [list, groupTab, nameFilter, categoryFilter, purchaseTypeFilter, minAmount, maxAmount]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, r) => sum + (r.actual_amount ?? 0), 0),
    [filtered]
  );

  const avgAmount = useMemo(
    () => (filtered.length > 0 ? totalAmount / filtered.length : 0),
    [filtered, totalAmount]
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    filtered.forEach((r) => {
      const existing = map.get(r.category) ?? { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += r.actual_amount ?? 0;
      map.set(r.category, existing);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [filtered]);

  function exportExcel() {
    const rows = filtered.map((r) => ({
      '申请人': r.applicant?.name ?? '',
      '标题': r.title,
      '类别': r.category,
      '采购类型': r.purchase_type === 'personal' ? '个人' : '公共',
      '实际金额': r.actual_amount ?? 0,
      '预估金额': r.estimated_amount ?? '',
      '日期': dayjs(r.created_at).format('YYYY-MM-DD'),
      '报销状态': '已批准',
      '入库状态': r.skip_registration
        ? '无需登记'
        : r.registration_status === 'registered'
          ? '已登记'
          : '未登记',
    }));
    import('../../lib/exportExcel').then(({ downloadExcel }) => {
      downloadExcel(rows, `报销统计_${dateFrom}_${dateTo}`, '报销统计');
    });
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="报销统计"
        subtitle="已批准报销的统计汇总"
        action={
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出 Excel
          </button>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            加载失败：{error}
          </div>
        )}

        {/* Group Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {groupTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setGroupTab(t.key)}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                groupTab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter area */}
        <Card>
          <button
            className="flex items-center justify-between w-full md:cursor-default"
            onClick={() => setFilterExpanded(prev => !prev)}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">筛选</span>
            </div>
            <span className="md:hidden text-gray-400">
              {filterExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 ${filterExpanded ? '' : 'hidden md:grid'}`}>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                申请人
              </label>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="输入姓名搜索"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
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
                {PURCHASE_CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                最低金额
              </label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                最高金额
              </label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="不限"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                采购类型
              </label>
              <select
                value={purchaseTypeFilter}
                onChange={(e) => setPurchaseTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">全部</option>
                <option value="personal">个人</option>
                <option value="public">公共</option>
              </select>
            </div>
          </div>
        </Card>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
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
              <Card>
                <p className="text-xs text-gray-500">平均金额</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  ¥{avgAmount.toFixed(2)}
                </p>
              </Card>
            </div>

            {/* Category breakdown */}
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
                            categoryColors[cat] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {cat}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{
                              width: `${
                                totalAmount > 0
                                  ? (data.amount / totalAmount) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 w-24 text-right">
                          ¥{data.amount.toFixed(0)} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Detail list */}
            {filtered.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="暂无数据"
                description="当前筛选条件下没有已批准的报销记录"
              />
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  报销明细（{filtered.length} 笔）
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
                                categoryColors[item.category] ??
                                'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.category}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                              {item.purchase_type === 'personal'
                                ? '个人'
                                : '公共'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {item.applicant?.name ?? '未知'} |{' '}
                            {dayjs(item.created_at).format('YYYY-MM-DD')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-lg font-bold text-gray-900">
                            ¥{(item.actual_amount ?? 0).toFixed(2)}
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

                          <div className="bg-gray-50 p-3 rounded-lg space-y-1.5">
                            {item.estimated_amount != null && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">预估金额</span>
                                <span className="text-gray-700">
                                  ¥{item.estimated_amount.toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">入库状态</span>
                              <span className="text-gray-700">
                                {item.skip_registration
                                  ? '无需登记'
                                  : item.registration_status === 'registered'
                                    ? '已登记'
                                    : '未登记'}
                              </span>
                            </div>
                          </div>

                          {item.receipt_attachments &&
                            item.receipt_attachments.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1.5">
                                  报销凭证（{item.receipt_attachments.length}）
                                </p>
                                <div className="space-y-1">
                                  {(
                                    item.receipt_attachments as ReimbursementFile[]
                                  ).map((file, idx) => (
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
                                  ))}
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
