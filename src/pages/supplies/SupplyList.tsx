import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, RefreshCw, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Supply, SupplyCategory } from '../../lib/types';
import PageHeader from '../../components/PageHeader';

const CATEGORY_TABS = [
  { key: '非一次性耗材', label: '非一次性耗材' },
  { key: '玻璃器皿', label: '玻璃器皿' },
  { key: '一次性耗材', label: '一次性耗材' },
  { key: '其他', label: '其他' },
];

function StockIndicator({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock <= 0) {
    return (
      <span className="text-sm font-semibold text-red-600">{stock}</span>
    );
  }
  if (stock <= minStock) {
    return (
      <span className="text-sm font-semibold text-amber-600">{stock}</span>
    );
  }
  if (stock <= minStock * 1.5) {
    return (
      <span className="text-sm font-semibold text-yellow-600">{stock}</span>
    );
  }
  return <span className="text-sm font-semibold text-gray-900">{stock}</span>;
}

export default function SupplyList() {
  const { isAdmin, canManageModule } = useAuth();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [activeTab, setActiveTab] = useState(CATEGORY_TABS[0].key);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = isAdmin || canManageModule('supplies');

  async function fetchSupplies() {
    setLoading(true);
    setError(null);

    try {
      const [suppliesRes, categoriesRes] = await Promise.all([
        supabase
          .from('supplies')
          .select('*, category:supply_categories(id, name, sort_order)')
          .order('name'),
        supabase.from('supply_categories').select('*').order('sort_order'),
      ]);

      if (suppliesRes.error) throw suppliesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setSupplies(suppliesRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (err: any) {
      setError(err.message || '加载失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSupplies();
  }, []);

  const filteredSupplies = useMemo(() => {
    return supplies.filter((s) => {
      const categoryName = (s.category as any)?.name;
      const matchesTab = categoryName === activeTab;
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.specification.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [supplies, activeTab, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <button
            onClick={fetchSupplies}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="耗材库存"
        subtitle="查看和管理实验室耗材库存"
        action={
          canManage ? (
            <Link
              to="/supplies/add"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加耗材
            </Link>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索耗材名称..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex overflow-x-auto gap-1 bg-gray-100 rounded-xl p-1 no-scrollbar">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {filteredSupplies.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {search ? '没有找到匹配的耗材' : '该分类暂无耗材'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      名称
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      规格
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      库存
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      单位
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      最低库存
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSupplies.map((supply) => (
                    <tr
                      key={supply.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        supply.stock <= supply.min_stock ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {supply.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {supply.specification || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StockIndicator
                          stock={supply.stock}
                          minStock={supply.min_stock}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-500">
                          {supply.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-400">
                          {supply.min_stock}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-2">
              {filteredSupplies.map((supply) => (
                <div
                  key={supply.id}
                  className={`bg-white rounded-xl border border-gray-200 p-4 ${
                    supply.stock <= supply.min_stock
                      ? 'border-l-4 border-l-red-400'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {supply.name}
                      </p>
                      {supply.specification && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {supply.specification}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <StockIndicator
                        stock={supply.stock}
                        minStock={supply.min_stock}
                      />
                      <span className="text-xs text-gray-400 ml-0.5">
                        {supply.unit}
                      </span>
                      {supply.stock <= supply.min_stock && (
                        <p className="text-xs text-red-500 mt-0.5">库存不足</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
