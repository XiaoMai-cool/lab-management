import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Package, Users, ArrowLeft } from 'lucide-react';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import Card from '../../components/Card';

type TabKey = 'borrowed' | 'returned' | 'damaged';

interface BorrowingRecord {
  id: string;
  supply_id: string;
  user_id: string;
  quantity: number;
  purpose: string;
  status: string;
  borrowed_at: string;
  returned_at: string | null;
  notes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  supply: {
    id: string;
    name: string;
    specification: string;
    stock: number;
    unit: string;
  };
}

const TABS: { key: TabKey; label: string; status: string }[] = [
  { key: 'borrowed', label: '借用中', status: 'borrowed' },
  { key: 'returned', label: '已归还', status: 'returned' },
  { key: 'damaged', label: '报损', status: 'damaged' },
];

export default function BorrowingManage() {
  const { isAdmin, canManageModule } = useAuth();
  const [borrowings, setBorrowings] = useState<BorrowingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('borrowed');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterSupply, setFilterSupply] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // User history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyUser, setHistoryUser] = useState<{ id: string; name: string } | null>(null);
  const [historyRecords, setHistoryRecords] = useState<BorrowingRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canManage = isAdmin || canManageModule('supplies');

  const fetchBorrowings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('supply_borrowings')
        .select('id, supply_id, user_id, quantity, purpose, status, borrowed_at, returned_at, notes, user:profiles(id, name, email), supply:supplies(id, name, specification, stock, unit)')
        .order('borrowed_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBorrowings((data as any) || []);
    } catch (err: any) {
      const message = err.message || '加载失败';
      if (message.includes('relation') && message.includes('does not exist')) {
        setError('借用功能尚未启用，请联系管理员创建相关数据表');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBorrowings();
  }, [fetchBorrowings]);

  // Unique users and supplies for filters
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    borrowings.forEach((b) => {
      if (b.user?.id && b.user?.name) map.set(b.user.id, b.user.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [borrowings]);

  const uniqueSupplies = useMemo(() => {
    const map = new Map<string, string>();
    borrowings.forEach((b) => {
      if (b.supply?.id && b.supply?.name) map.set(b.supply.id, b.supply.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [borrowings]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    const tab = TABS.find((t) => t.key === activeTab)!;
    return borrowings.filter((b) => {
      if (b.status !== tab.status) return false;
      if (filterUser && b.user_id !== filterUser) return false;
      if (filterSupply && b.supply_id !== filterSupply) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesUser = b.user?.name?.toLowerCase().includes(q);
        const matchesSupply = b.supply?.name?.toLowerCase().includes(q);
        const matchesPurpose = b.purpose?.toLowerCase().includes(q);
        if (!matchesUser && !matchesSupply && !matchesPurpose) return false;
      }
      return true;
    });
  }, [borrowings, activeTab, filterUser, filterSupply, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const borrowed = borrowings.filter((b) => b.status === 'borrowed');
    const uniqueBorrowers = new Set(borrowed.map((b) => b.user_id));
    return {
      totalBorrowed: borrowed.length,
      totalBorrowers: uniqueBorrowers.size,
    };
  }, [borrowings]);

  // Admin return action
  async function handleAdminReturn(record: BorrowingRecord) {
    setActionLoading(record.id);
    try {
      const { error: updateError } = await supabase
        .from('supply_borrowings')
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (updateError) throw updateError;

      const { error: stockError } = await supabase
        .from('supplies')
        .update({ stock: record.supply.stock + record.quantity })
        .eq('id', record.supply_id);

      if (stockError) throw stockError;

      // Update local state
      setBorrowings((prev) =>
        prev.map((b) =>
          b.id === record.id
            ? { ...b, status: 'returned', returned_at: new Date().toISOString() }
            : b
        )
      );
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setActionLoading(null);
    }
  }

  // View user history
  async function viewUserHistory(userId: string, userName: string) {
    setHistoryUser({ id: userId, name: userName });
    setHistoryModalOpen(true);
    setHistoryLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from('supply_borrowings')
        .select('id, supply_id, user_id, quantity, purpose, status, borrowed_at, returned_at, notes, user:profiles(id, name, email), supply:supplies(id, name, specification, stock, unit)')
        .eq('user_id', userId)
        .order('borrowed_at', { ascending: false });

      if (fetchError) throw fetchError;
      setHistoryRecords((data as any) || []);
    } catch (err: any) {
      console.error('Failed to fetch user history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  const statusLabel: Record<string, string> = {
    borrowed: '借用中',
    returned: '已归还',
    damaged: '报损',
  };

  const statusClass: Record<string, string> = {
    borrowed: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    returned: 'bg-green-50 text-green-700 ring-green-600/20',
    damaged: 'bg-red-50 text-red-700 ring-red-600/20',
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <PageHeader title="借用管理" subtitle="管理所有耗材借用记录" />

      <div className="px-4 md:px-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
            <button
              onClick={() => { setError(null); fetchBorrowings(); }}
              className="ml-3 underline hover:no-underline cursor-pointer"
            >
              重试
            </button>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBorrowed}</p>
                <p className="text-xs text-gray-500">借用中物品</p>
              </div>
            </div>
          </Card>
          <Card className="!p-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBorrowers}</p>
                <p className="text-xs text-gray-500">借用中人数</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索借用人、耗材名称或用途..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">全部用户</option>
            {uniqueUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={filterSupply}
            onChange={(e) => setFilterSupply(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">全部耗材</option>
            {uniqueSupplies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 bg-gray-100 rounded-xl p-1 no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-60">
                ({borrowings.filter((b) => b.status === tab.status).length})
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState
              icon={Package}
              title="暂无记录"
              description={`当前筛选条件下没有${TABS.find((t) => t.key === activeTab)?.label}记录`}
            />
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      借用人
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      耗材
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      数量
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      借用时间
                    </th>
                    {activeTab !== 'borrowed' && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {activeTab === 'returned' ? '归还时间' : '记录时间'}
                      </th>
                    )}
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    {canManage && activeTab === 'borrowed' && (
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewUserHistory(record.user.id, record.user.name)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          {record.user?.name || '未知用户'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{record.supply?.name}</span>
                        {record.supply?.specification && (
                          <span className="text-xs text-gray-400 ml-1">({record.supply.specification})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-700">{record.quantity} {record.supply?.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">
                          {dayjs(record.borrowed_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </td>
                      {activeTab !== 'borrowed' && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500">
                            {record.returned_at ? dayjs(record.returned_at).format('YYYY-MM-DD HH:mm') : '-'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass[record.status] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
                          {statusLabel[record.status] || record.status}
                        </span>
                      </td>
                      {canManage && activeTab === 'borrowed' && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleAdminReturn(record)}
                            disabled={actionLoading === record.id}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            {actionLoading === record.id ? '处理中...' : '标记归还'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => viewUserHistory(record.user.id, record.user.name)}
                          className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          {record.user?.name || '未知用户'}
                        </button>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass[record.status] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
                          {statusLabel[record.status] || record.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mt-1">
                        {record.supply?.name}
                        {record.supply?.specification && (
                          <span className="text-xs text-gray-400 ml-1">({record.supply.specification})</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                        <span>数量: {record.quantity} {record.supply?.unit}</span>
                        <span>借用: {dayjs(record.borrowed_at).format('MM-DD HH:mm')}</span>
                        {record.returned_at && (
                          <span>{activeTab === 'returned' ? '归还' : '记录'}: {dayjs(record.returned_at).format('MM-DD HH:mm')}</span>
                        )}
                      </div>
                      {record.purpose && (
                        <p className="text-xs text-gray-400 mt-1">用途: {record.purpose}</p>
                      )}
                      {record.notes && (
                        <p className="text-xs text-gray-400 mt-0.5">备注: {record.notes}</p>
                      )}
                    </div>

                    {canManage && activeTab === 'borrowed' && (
                      <button
                        onClick={() => handleAdminReturn(record)}
                        disabled={actionLoading === record.id}
                        className="shrink-0 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        {actionLoading === record.id ? '...' : '标记归还'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User History Modal */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`${historyUser?.name || ''} 的借用记录`}
      >
        {historyLoading ? (
          <LoadingSpinner />
        ) : historyRecords.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">暂无借用记录</div>
        ) : (
          <div className="space-y-3">
            {historyRecords.map((record) => (
              <div key={record.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {record.supply?.name}
                      {record.supply?.specification && (
                        <span className="text-xs text-gray-400 ml-1">({record.supply.specification})</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                      <span>数量: {record.quantity} {record.supply?.unit}</span>
                      <span>借用: {dayjs(record.borrowed_at).format('YYYY-MM-DD')}</span>
                      {record.returned_at && (
                        <span>归还: {dayjs(record.returned_at).format('YYYY-MM-DD')}</span>
                      )}
                    </div>
                    {record.purpose && (
                      <p className="text-xs text-gray-400 mt-1">用途: {record.purpose}</p>
                    )}
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass[record.status] || 'bg-gray-50 text-gray-700 ring-gray-600/20'}`}>
                    {statusLabel[record.status] || record.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
