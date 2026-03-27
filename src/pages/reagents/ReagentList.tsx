import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import dayjs from 'dayjs';

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
  current_stock: number;
  min_stock_alert: number | null;
  storage_location: string | null;
  expiry_date: string | null;
  ghs_labels: string[] | null;
  supplier: { name: string } | null;
}

const CATEGORIES = [
  { value: '', label: '全部' },
  { value: '普通试剂', label: '普通试剂' },
  { value: '危险化学品', label: '危险化学品' },
  { value: '生物试剂', label: '生物试剂' },
  { value: '标准品', label: '标准品' },
];

export default function ReagentList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'chemicals_manager';

  useEffect(() => {
    fetchChemicals();
  }, []);

  async function fetchChemicals() {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('chemicals')
        .select('*, supplier:suppliers(name)')
        .order('name');

      if (fetchError) throw fetchError;
      setChemicals(data || []);
    } catch (err: any) {
      setError(err.message || '加载药品列表失败');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = chemicals;

    if (activeCategory) {
      result = result.filter((c) => c.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.cas_number?.toLowerCase().includes(q) ||
          c.manufacturer?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [chemicals, activeCategory, searchQuery]);

  function getStockColor(chemical: Chemical) {
    if (chemical.current_stock <= 0) return 'text-red-600 font-bold';
    if (chemical.min_stock_alert && chemical.current_stock <= chemical.min_stock_alert)
      return 'text-yellow-600 font-semibold';
    return 'text-gray-700';
  }

  function getExpiryStatus(date: string | null) {
    if (!date) return null;
    const d = dayjs(date);
    const now = dayjs();
    if (d.isBefore(now)) return { text: '已过期', className: 'text-red-600 font-bold' };
    if (d.diff(now, 'day') <= 30)
      return { text: `${d.diff(now, 'day')}天后过期`, className: 'text-red-500 font-semibold' };
    return { text: d.format('YYYY-MM-DD'), className: 'text-gray-500' };
  }

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">加载失败</p>
          <p className="mt-1 text-sm">{error}</p>
          <button
            onClick={fetchChemicals}
            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <PageHeader title="药品总览">
        {isAdmin && (
          <button
            onClick={() => navigate('/reagents/new')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            + 添加药品
          </button>
        )}
      </PageHeader>

      {/* 搜索栏 */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="搜索药品名称、CAS号、厂家..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 分类过滤 */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 药品列表 */}
      {filtered.length === 0 ? (
        <EmptyState message={searchQuery ? '没有找到匹配的药品' : '暂无药品信息'} />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((chemical) => {
            const expiry = getExpiryStatus(chemical.expiry_date);
            return (
              <Card
                key={chemical.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/reagents/${chemical.id}`)}
              >
                <div className="space-y-2">
                  {/* 名称 + CAS */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{chemical.name}</h3>
                    {chemical.cas_number && (
                      <p className="text-sm text-gray-500">CAS: {chemical.cas_number}</p>
                    )}
                  </div>

                  {/* 规格信息 */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    {chemical.specification && <span>规格: {chemical.specification}</span>}
                    {chemical.concentration && <span>浓度: {chemical.concentration}</span>}
                    {chemical.purity && <span>纯度: {chemical.purity}</span>}
                  </div>

                  {/* 厂家 */}
                  {chemical.manufacturer && (
                    <p className="text-sm text-gray-500">厂家: {chemical.manufacturer}</p>
                  )}

                  {/* GHS 标签 */}
                  {chemical.ghs_labels && chemical.ghs_labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {chemical.ghs_labels.map((label) => {
                        const ghs = GHS_LABELS[label];
                        if (!ghs) return null;
                        return (
                          <span
                            key={label}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ghs.bg} ${ghs.color}`}
                          >
                            <span>{ghs.icon}</span>
                            {ghs.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* 底部信息 */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className={`text-sm ${getStockColor(chemical)}`}>
                      库存: {chemical.current_stock} {chemical.unit || ''}
                    </span>
                    {chemical.storage_location && (
                      <span className="text-xs text-gray-400">{chemical.storage_location}</span>
                    )}
                  </div>

                  {/* 有效期 */}
                  {expiry && (
                    <p className={`text-xs ${expiry.className}`}>有效期: {expiry.text}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-sm text-gray-400">
        共 {filtered.length} 种药品
      </p>
    </div>
  );
}
