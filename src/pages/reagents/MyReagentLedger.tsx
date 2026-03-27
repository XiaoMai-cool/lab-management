import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import dayjs from 'dayjs';

interface UsageLog {
  id: string;
  amount: string | null;
  purpose: string | null;
  experiment_name: string | null;
  created_at: string;
  chemical: {
    id: string;
    name: string;
    cas_number: string | null;
    manufacturer: string | null;
    specification: string | null;
    concentration: string | null;
    purity: string | null;
  } | null;
}

export default function MyReagentLedger() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [user?.id]);

  async function fetchLogs() {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('chemical_usage_logs')
        .select('*, chemical:chemicals(id, name, cas_number, manufacturer, specification, concentration, purity)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setLogs(data || []);
    } catch (err: any) {
      setError(err.message || '加载台账失败');
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (log) =>
          log.chemical?.name.toLowerCase().includes(q) ||
          log.chemical?.cas_number?.toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      result = result.filter((log) => dayjs(log.created_at).format('YYYY-MM-DD') >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((log) => dayjs(log.created_at).format('YYYY-MM-DD') <= dateTo);
    }

    return result;
  }, [logs, searchQuery, dateFrom, dateTo]);

  // 统计
  const stats = useMemo(() => {
    const uniqueChemicals = new Set(logs.map((l) => l.chemical?.id).filter(Boolean));
    return {
      uniqueCount: uniqueChemicals.size,
      totalCount: logs.length,
    };
  }, [logs]);

  // 导出论文格式
  function exportPaperFormat() {
    const grouped: Record<string, Set<string>> = {};

    filteredLogs.forEach((log) => {
      const chem = log.chemical;
      if (!chem) return;
      const mfr = chem.manufacturer || '未知厂家';
      if (!grouped[mfr]) grouped[mfr] = new Set();
      const entry = chem.purity
        ? `${chem.name} (${chem.purity}, ${mfr})`
        : `${chem.name} (${mfr})`;
      grouped[mfr].add(entry);
    });

    const lines: string[] = [];
    Object.entries(grouped).forEach(([, entries]) => {
      entries.forEach((entry) => lines.push(entry));
    });

    const text = lines.join('\n');
    downloadText(text, `试剂台账-论文格式-${dayjs().format('YYYYMMDD')}.txt`);
  }

  // 导出 Excel (CSV)
  function exportExcel() {
    const header = ['日期', '药品名称', 'CAS号', '厂家', '规格', '浓度', '用量', '用途', '实验名称'];
    const rows = filteredLogs.map((log) => [
      dayjs(log.created_at).format('YYYY-MM-DD'),
      log.chemical?.name || '',
      log.chemical?.cas_number || '',
      log.chemical?.manufacturer || '',
      log.chemical?.specification || '',
      log.chemical?.concentration || '',
      log.amount || '',
      log.purpose || '',
      log.experiment_name || '',
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Add BOM for Excel to recognize UTF-8
    const bom = '\uFEFF';
    downloadText(bom + csvContent, `试剂台账-${dayjs().format('YYYYMMDD')}.csv`);
  }

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">加载失败</p>
          <p className="mt-1 text-sm">{error}</p>
          <button
            onClick={fetchLogs}
            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <PageHeader title="我的试剂台账">
        <div className="flex gap-2">
          <button
            onClick={exportPaperFormat}
            disabled={filteredLogs.length === 0}
            className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 sm:text-sm"
          >
            导出论文格式
          </button>
          <button
            onClick={exportExcel}
            disabled={filteredLogs.length === 0}
            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:text-sm"
          >
            导出Excel
          </button>
        </div>
      </PageHeader>

      {/* 统计概览 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.uniqueCount}</p>
          <p className="text-sm text-gray-500">使用药品种类</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">{stats.totalCount}</p>
          <p className="text-sm text-gray-500">总使用次数</p>
        </Card>
      </div>

      {/* 搜索与过滤 */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索药品名称..."
          className="input"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input"
          placeholder="开始日期"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input"
          placeholder="结束日期"
        />
      </div>

      {/* 台账列表 */}
      {filteredLogs.length === 0 ? (
        <div className="mt-6">
          <EmptyState message={searchQuery ? '没有找到匹配的记录' : '暂无使用记录'} />
        </div>
      ) : (
        <>
          {/* 桌面表格视图 */}
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 font-medium">药品名称</th>
                  <th className="px-3 py-2 font-medium">CAS号</th>
                  <th className="px-3 py-2 font-medium">厂家</th>
                  <th className="px-3 py-2 font-medium">规格</th>
                  <th className="px-3 py-2 font-medium">浓度</th>
                  <th className="px-3 py-2 font-medium">用量</th>
                  <th className="px-3 py-2 font-medium">用途</th>
                  <th className="px-3 py-2 font-medium">实验名称</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                      {dayjs(log.created_at).format('YYYY-MM-DD')}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {log.chemical?.name || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {log.chemical?.cas_number || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {log.chemical?.manufacturer || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {log.chemical?.specification || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {log.chemical?.concentration || '-'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{log.amount || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{log.purpose || '-'}</td>
                    <td className="px-3 py-2 text-gray-500">{log.experiment_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移动端卡片视图 */}
          <div className="mt-4 space-y-3 sm:hidden">
            {filteredLogs.map((log) => (
              <Card key={log.id}>
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium text-gray-900">{log.chemical?.name || '-'}</h4>
                    <span className="shrink-0 text-xs text-gray-400">
                      {dayjs(log.created_at).format('MM-DD')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                    {log.chemical?.cas_number && <span>CAS: {log.chemical.cas_number}</span>}
                    {log.chemical?.manufacturer && <span>{log.chemical.manufacturer}</span>}
                    {log.chemical?.specification && <span>{log.chemical.specification}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                    {log.amount && <span>用量: {log.amount}</span>}
                    {log.chemical?.concentration && <span>浓度: {log.chemical.concentration}</span>}
                  </div>
                  {log.purpose && <p className="text-xs text-gray-500">用途: {log.purpose}</p>}
                  {log.experiment_name && (
                    <p className="text-xs text-gray-400">实验: {log.experiment_name}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="mt-4 text-center text-sm text-gray-400">
        共 {filteredLogs.length} 条记录
      </p>
    </div>
  );
}
