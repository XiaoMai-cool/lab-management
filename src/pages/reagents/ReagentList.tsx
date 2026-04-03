import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import SubNav from '../../components/SubNav';
import type { SubNavItem } from '../../components/SubNav';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

// GHS 标签配置
const GHS_LABELS: Record<string, { name: string; color: string; bg: string; icon: string }> = {
  GHS01: { name: '爆炸性', color: 'text-orange-800', bg: 'bg-orange-100 border-orange-300', icon: '💥' },
  GHS02: { name: '易燃', color: 'text-red-800', bg: 'bg-red-100 border-red-300', icon: '🔥' },
  GHS03: { name: '氧化性', color: 'text-yellow-800', bg: 'bg-yellow-100 border-yellow-300', icon: '⭕' },
  GHS04: { name: '压缩气体', color: 'text-blue-800', bg: 'bg-blue-100 border-blue-300', icon: '🫧' },
  GHS05: { name: '腐蚀性', color: 'text-purple-800', bg: 'bg-purple-100 border-purple-300', icon: '⚗️' },
  GHS06: { name: '急性毒性', color: 'text-red-950', bg: 'bg-red-200 border-red-400', icon: '☠️' },
  GHS07: { name: '刺激性/有害', color: 'text-orange-800', bg: 'bg-orange-50 border-orange-200', icon: '⚠️' },
  GHS08: { name: '健康危害', color: 'text-red-800', bg: 'bg-red-50 border-red-200', icon: '🫁' },
  GHS09: { name: '环境危害', color: 'text-green-800', bg: 'bg-green-100 border-green-300', icon: '🌿' },
};

const REAGENT_SUB_NAV: SubNavItem[] = [
  { to: '/reagents', label: '药品总览', exact: true },
  { to: '/reagents/purchase', label: '申购药品' },
];

interface ActiveWarning {
  chemical_id: string;
  status: 'pending' | 'ordered';
}

interface Chemical {
  id: string;
  name: string;
  cas_number: string | null;
  molecular_formula: string | null;
  specification: string | null;
  concentration: string | null;
  purity: string | null;
  category: string | null;
  manufacturer: string | null;
  unit: string | null;
  stock: number;
  min_stock: number | null;
  storage_location: string | null;
  expiry_date: string | null;
  ghs_labels: string[] | null;
  batch_number: string | null;
  supplier: { name: string } | null;
}

// 按药品类型分类
const CATEGORIES = [
  { value: '', label: '全部' },
  { value: '普通试剂', label: '普通试剂' },
  { value: '危险化学品', label: '危险化学品' },
  { value: '生物试剂', label: '生物试剂' },
  { value: '标准品', label: '标准品' },
];

// 按编号前缀分类
const CODE_PREFIXES = [
  { value: '', label: '全部编号' },
  { value: 'A', label: 'A区' },
  { value: 'B', label: 'B区' },
  { value: 'C', label: 'C区（危化品）' },
  { value: 'D', label: 'D区（冷藏）' },
  { value: '上', label: '上架' },
];

export default function ReagentList() {
  const navigate = useNavigate();
  const { user, isAdmin, canManageModule } = useAuth();
  const canManage = isAdmin || canManageModule('chemicals');
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [activeWarnings, setActiveWarnings] = useState<ActiveWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeCodePrefix, setActiveCodePrefix] = useState('');

  useEffect(() => {
    fetchChemicals();
  }, []);

  async function fetchChemicals() {
    try {
      setLoading(true);
      const [chemRes, warnRes] = await Promise.all([
        supabase
          .from('chemicals')
          .select('*, supplier:suppliers(name)')
          .order('batch_number'),
        supabase
          .from('chemical_warnings')
          .select('chemical_id, status')
          .in('status', ['pending', 'ordered']),
      ]);

      if (chemRes.error) throw chemRes.error;
      setChemicals(chemRes.data || []);
      setActiveWarnings((warnRes.data || []) as ActiveWarning[]);
    } catch (err: any) {
      setError(err.message || '加载药品列表失败');
    } finally {
      setLoading(false);
    }
  }

  function getWarningForChemical(chemicalId: string): ActiveWarning | undefined {
    return activeWarnings.find((w) => w.chemical_id === chemicalId);
  }

  async function handleReportWarning(e: React.MouseEvent, chemicalId: string) {
    e.stopPropagation();
    if (!user) return;
    const existing = getWarningForChemical(chemicalId);
    if (existing) {
      alert(existing.status === 'pending' ? '该药品已有人上报即将用完' : '该药品已下单采购中');
      return;
    }
    try {
      const { error: insertError } = await supabase.from('chemical_warnings').insert({
        chemical_id: chemicalId,
        reported_by: user.id,
        status: 'pending',
      });
      if (insertError) throw insertError;
      setActiveWarnings((prev) => [...prev, { chemical_id: chemicalId, status: 'pending' }]);
      alert('已上报"即将用完"');
    } catch (err: any) {
      alert('上报失败: ' + (err.message || '未知错误'));
    }
  }

  const filtered = useMemo(() => {
    let result = chemicals;

    if (activeCategory) {
      result = result.filter((c) => c.category === activeCategory);
    }

    if (activeCodePrefix) {
      result = result.filter((c) => c.batch_number?.startsWith(activeCodePrefix));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.cas_number?.toLowerCase().includes(q) ||
          c.manufacturer?.toLowerCase().includes(q) ||
          c.batch_number?.toLowerCase().includes(q) ||
          c.molecular_formula?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [chemicals, activeCategory, activeCodePrefix, searchQuery]);

  function getStockColor(chemical: Chemical) {
    if (chemical.stock <= 0) return 'text-red-600 font-bold';
    if (chemical.min_stock && chemical.stock <= chemical.min_stock)
      return 'text-yellow-600 font-semibold';
    return 'text-gray-700';
  }

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">加载失败</p>
          <p className="mt-1 text-sm">{error}</p>
          <button onClick={fetchChemicals} className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <PageHeader
        title="药品总览"
        subtitle={`共 ${chemicals.length} 种药品`}
        action={
          canManage ? (
            <button
              onClick={() => navigate('/reagents/new')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              + 添加药品
            </button>
          ) : undefined
        }
      />

      {/* 功能导航 */}
      <SubNav items={REAGENT_SUB_NAV} />

      {/* 搜索栏 */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="搜索药品名称、编号、CAS号、分子式、厂家..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 按编号区域筛选 */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {CODE_PREFIXES.map((cp) => (
          <button
            key={cp.value}
            onClick={() => { setActiveCodePrefix(cp.value); setActiveCategory(''); }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCodePrefix === cp.value && !activeCategory
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cp.label}
          </button>
        ))}
      </div>

      {/* 按药品类型筛选 */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => { setActiveCategory(cat.value); setActiveCodePrefix(''); }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat.value && !activeCodePrefix
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 药品列表 */}
      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={searchQuery ? '没有找到匹配的药品' : '暂无药品信息'} />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((chemical) => (
            <Card
              key={chemical.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/reagents/${chemical.id}`)}
            >
              <div className="space-y-2">
                {/* 名称 + 编号标签 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-900">{chemical.name}</h3>
                      {chemical.batch_number && (
                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                          {chemical.batch_number}
                        </span>
                      )}
                    </div>
                    {/* 分子式 */}
                    {chemical.molecular_formula && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">{chemical.molecular_formula}</p>
                    )}
                    {chemical.cas_number && (
                      <p className="text-xs text-gray-500 mt-0.5">CAS: {chemical.cas_number}</p>
                    )}
                  </div>
                  {/* 库存 */}
                  <div className={`text-right shrink-0 ${getStockColor(chemical)}`}>
                    <p className="text-lg font-bold">{chemical.stock}</p>
                    <p className="text-[10px] text-gray-400">{chemical.unit || '瓶'}</p>
                  </div>
                </div>

                {/* 规格信息 */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  {chemical.concentration && <span>浓度: {chemical.concentration}</span>}
                  {chemical.purity && <span>纯度: {chemical.purity}</span>}
                  {chemical.specification && <span>规格: {chemical.specification}</span>}
                  {chemical.manufacturer && <span>厂家: {chemical.manufacturer}</span>}
                </div>

                {/* GHS 标签 */}
                {chemical.ghs_labels && chemical.ghs_labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {chemical.ghs_labels.map((label) => {
                      const ghs = GHS_LABELS[label];
                      if (!ghs) return null;
                      return (
                        <span
                          key={label}
                          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ghs.bg} ${ghs.color}`}
                          title={ghs.name}
                        >
                          <span>{ghs.icon}</span>
                          {ghs.name}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 底部：分类 + 存放位置 + 预警 */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px] text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>{chemical.category || '未分类'}</span>
                    {(() => {
                      const w = getWarningForChemical(chemical.id);
                      if (w) {
                        return (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              w.status === 'pending'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                              w.status === 'pending' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                            {w.status === 'pending' ? '即将用完' : '已下单'}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {chemical.storage_location && <span>{chemical.storage_location}</span>}
                    {!getWarningForChemical(chemical.id) && (
                      <button
                        onClick={(e) => handleReportWarning(e, chemical.id)}
                        className="rounded border border-red-300 px-1.5 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-50"
                      >
                        预警
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-gray-400">
        显示 {filtered.length} / {chemicals.length} 种药品
      </p>
    </div>
  );
}
