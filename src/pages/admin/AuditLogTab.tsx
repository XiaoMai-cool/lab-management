import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Download, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { downloadExcel } from '../../lib/exportExcel';
import LoadingSpinner from '../../components/LoadingSpinner';

interface AuditEntry {
  id: string;
  action: string;
  target_table: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user: { name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: '新建',
  approve: '批准',
  reject: '拒绝',
  recall: '撤回',
  stock_add: '增加库存',
  update: '更新',
  delete: '删除',
};

const TABLE_LABELS: Record<string, string> = {
  chemicals: '药品',
  purchases: '采购',
  supply_reservations: '物资申领',
  supply_borrowings: '物资借用',
  profiles: '用户',
};

const TIME_FILTERS = [
  { label: '最近 7 天', value: 7 },
  { label: '最近 30 天', value: 30 },
  { label: '全部', value: 0 },
];

export default function AuditLogTab() {
  const { profile, isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState(30);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, timeFilter]);

  async function fetchLogs() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('audit_log')
        .select('id, action, target_table, target_id, details, created_at, user:profiles!audit_log_user_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!isSuperAdmin) {
        query = query.eq('user_id', profile.id);
      }

      if (actionFilter) {
        query = query.eq('action', actionFilter);
      }

      if (timeFilter > 0) {
        const since = dayjs().subtract(timeFilter, 'day').toISOString();
        query = query.gte('created_at', since);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setLogs((data as AuditEntry[]) ?? []);
    } catch (err: any) {
      setError(err.message || '加载日志失败');
    } finally {
      setLoading(false);
    }
  }

  function formatDetails(details: Record<string, unknown> | null): string {
    if (!details) return '';
    const parts: string[] = [];
    if (details.name) parts.push(String(details.name));
    if (details.title) parts.push(String(details.title));
    if (details.batch_number) parts.push(`编号 ${details.batch_number}`);
    if (details.added != null) parts.push(`+${details.added} (${details.before}→${details.after})`);
    if (details.note) parts.push(`备注: ${details.note}`);
    return parts.join(' · ') || JSON.stringify(details);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const rows = logs.map((a) => ({
        '操作人': a.user?.name ?? '',
        '操作类型': ACTION_LABELS[a.action] ?? a.action,
        '目标': TABLE_LABELS[a.target_table] ?? a.target_table,
        '详情': formatDetails(a.details),
        '时间': dayjs(a.created_at).format('YYYY-MM-DD HH:mm:ss'),
      }));
      downloadExcel(rows, '操作日志');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部操作</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5">
          {TIME_FILTERS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeFilter(tf.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeFilter === tf.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || logs.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? '导出中...' : '导出当前结果'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">暂无操作日志</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-white border border-gray-100 rounded-lg p-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{log.user?.name ?? '未知'}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    log.action === 'approve' ? 'bg-green-50 text-green-700' :
                    log.action === 'reject' ? 'bg-red-50 text-red-700' :
                    log.action === 'create' ? 'bg-blue-50 text-blue-700' :
                    log.action === 'stock_add' ? 'bg-indigo-50 text-indigo-700' :
                    log.action === 'recall' ? 'bg-orange-50 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-gray-400">
                    {TABLE_LABELS[log.target_table] ?? log.target_table}
                  </span>
                </div>
                {log.details && (
                  <p className="text-xs text-gray-500 mt-1">{formatDetails(log.details)}</p>
                )}
              </div>
              <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                {dayjs(log.created_at).format('MM-DD HH:mm')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
