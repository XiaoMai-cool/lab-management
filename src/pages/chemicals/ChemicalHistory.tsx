import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, Filter, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ChemicalUsageLog, Chemical, Profile } from '../../lib/types';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ChemicalHistory() {
  const [searchParams] = useSearchParams();
  const preselectedChemicalId = searchParams.get('chemical_id') || '';

  const [logs, setLogs] = useState<ChemicalUsageLog[]>([]);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterChemical, setFilterChemical] = useState(preselectedChemicalId);
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(!!preselectedChemicalId);

  useEffect(() => {
    Promise.all([fetchLogs(), fetchChemicals(), fetchUsers()]).then(() =>
      setLoading(false),
    );
  }, []);

  async function fetchLogs() {
    const { data } = await supabase
      .from('chemical_usage_logs')
      .select('*, chemical:chemicals(*), user:profiles(*)')
      .order('used_at', { ascending: false });

    if (data) setLogs(data as ChemicalUsageLog[]);
  }

  async function fetchChemicals() {
    const { data } = await supabase.from('chemicals').select('*').order('name');
    if (data) setChemicals(data as Chemical[]);
  }

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('name');
    if (data) setUsers(data as Profile[]);
  }

  const filtered = logs.filter((log) => {
    if (filterChemical && log.chemical_id !== filterChemical) return false;
    if (filterUser && log.user_id !== filterUser) return false;
    if (filterDateFrom && log.used_at < filterDateFrom) return false;
    if (filterDateTo && log.used_at > filterDateTo + 'T23:59:59') return false;
    return true;
  });

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="危化品使用记录" subtitle="查看历史使用记录" />

      <div className="px-4 md:px-6">
        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-1.5 mb-3 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          筛选
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  危化品
                </label>
                <select
                  value={filterChemical}
                  onChange={(e) => setFilterChemical(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部</option>
                  {chemicals.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  使用人
                </label>
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  开始日期
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  结束日期
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => {
                setFilterChemical('');
                setFilterUser('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              清除筛选
            </button>
          </div>
        )}

        {/* Results */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title="暂无使用记录"
            description="还没有危化品使用记录"
          />
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              共 {filtered.length} 条记录
            </p>

            {/* Mobile: Card layout */}
            <div className="space-y-2 md:hidden pb-6">
              {filtered.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {log.chemical?.name || '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {log.user?.name || '—'} | {formatDate(log.used_at)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-blue-600 shrink-0">
                      {log.amount} {log.unit}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 rounded px-2 py-1">
                    {log.purpose}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block overflow-x-auto pb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-500">时间</th>
                    <th className="pb-2 font-medium text-gray-500">使用人</th>
                    <th className="pb-2 font-medium text-gray-500">危化品</th>
                    <th className="pb-2 font-medium text-gray-500">用量</th>
                    <th className="pb-2 font-medium text-gray-500">用途</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 text-gray-600 whitespace-nowrap">
                        {formatDate(log.used_at)}
                      </td>
                      <td className="py-2.5 text-gray-900">
                        {log.user?.name || '—'}
                      </td>
                      <td className="py-2.5 text-gray-900 font-medium">
                        {log.chemical?.name || '—'}
                      </td>
                      <td className="py-2.5 text-blue-600 font-medium whitespace-nowrap">
                        {log.amount} {log.unit}
                      </td>
                      <td className="py-2.5 text-gray-600">{log.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
