import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
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
  user_id?: string;
  user: { name: string } | null;
}

interface TagFilter {
  id: string;
  module: string;
  label: string;
  targetTable: string;
  action: string;
  detailsType?: string;
}

const TAG_FILTERS: TagFilter[] = [
  // 采购审批
  { id: 'purchase_approve', module: '采购审批', label: '批准', targetTable: 'purchases', action: 'approve' },
  { id: 'purchase_reject', module: '采购审批', label: '拒绝', targetTable: 'purchases', action: 'reject' },
  { id: 'purchase_recall', module: '采购审批', label: '撤回', targetTable: 'purchases', action: 'recall' },
  // 报销审批
  { id: 'reimburse_approve', module: '报销审批', label: '批准', targetTable: 'purchases', action: 'approve', detailsType: 'reimbursement' },
  { id: 'reimburse_reject', module: '报销审批', label: '拒绝', targetTable: 'purchases', action: 'reject', detailsType: 'reimbursement' },
  { id: 'reimburse_recall', module: '报销审批', label: '撤回', targetTable: 'purchases', action: 'recall', detailsType: 'reimbursement' },
  // 药品管理
  { id: 'chem_create', module: '药品管理', label: '新建', targetTable: 'chemicals', action: 'create' },
  { id: 'chem_stock', module: '药品管理', label: '增加库存', targetTable: 'chemicals', action: 'stock_add' },
  // 物资申领
  { id: 'supply_approve', module: '物资申领', label: '批准', targetTable: 'supply_reservations', action: 'approve' },
  { id: 'supply_reject', module: '物资申领', label: '拒绝', targetTable: 'supply_reservations', action: 'reject' },
  // 物资借用
  { id: 'borrow_create', module: '物资借用', label: '借出', targetTable: 'supply_borrowings', action: 'create' },
  { id: 'borrow_return', module: '物资借用', label: '归还', targetTable: 'supply_borrowings', action: 'return' },
  // 用户管理
  { id: 'user_create', module: '用户管理', label: '新建', targetTable: 'profiles', action: 'create' },
  { id: 'user_update', module: '用户管理', label: '更新', targetTable: 'profiles', action: 'update' },
  { id: 'user_delete', module: '用户管理', label: '删除', targetTable: 'profiles', action: 'delete' },
];

const MODULES = [...new Set(TAG_FILTERS.map((t) => t.module))];

const MODULE_COLORS: Record<string, { selected: string; selectAll: string }> = {
  '采购审批': { selected: 'bg-amber-100 text-amber-800 border-amber-300', selectAll: 'border-amber-400 text-amber-700' },
  '报销审批': { selected: 'bg-yellow-100 text-yellow-800 border-yellow-300', selectAll: 'border-yellow-400 text-yellow-700' },
  '药品管理': { selected: 'bg-purple-100 text-purple-800 border-purple-300', selectAll: 'border-purple-400 text-purple-700' },
  '物资申领': { selected: 'bg-blue-100 text-blue-800 border-blue-300', selectAll: 'border-blue-400 text-blue-700' },
  '物资借用': { selected: 'bg-teal-100 text-teal-800 border-teal-300', selectAll: 'border-teal-400 text-teal-700' },
  '用户管理': { selected: 'bg-gray-200 text-gray-800 border-gray-400', selectAll: 'border-gray-400 text-gray-700' },
};

const ACTION_LABELS: Record<string, string> = {
  create: '新建',
  approve: '批准',
  reject: '拒绝',
  recall: '撤回',
  stock_add: '增加库存',
  update: '更新',
  delete: '删除',
  return: '归还',
};

const TABLE_LABELS: Record<string, string> = {
  chemicals: '药品',
  purchases: '采购',
  supply_reservations: '物资申领',
  supply_borrowings: '物资借用',
  profiles: '用户',
};

const TIME_FILTERS = [
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
  { label: '全部', value: 0 },
];

interface UserOption {
  id: string;
  name: string;
}

function matchesTagFilter(log: AuditEntry, selectedTags: Set<string>): boolean {
  if (selectedTags.size === 0) return true;
  return TAG_FILTERS.some((tag) => {
    if (!selectedTags.has(tag.id)) return false;
    if (tag.targetTable !== log.target_table) return false;
    if (tag.action !== log.action) return false;
    if (tag.detailsType) {
      const logType = (log.details as any)?.type;
      return logType === tag.detailsType;
    }
    // For purchase tags without detailsType, exclude reimbursement types
    if (tag.targetTable === 'purchases' && !tag.detailsType) {
      const logType = (log.details as any)?.type;
      return logType !== 'reimbursement';
    }
    return true;
  });
}

export default function AuditLogTab() {
  const { profile, isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [userFilter, setUserFilter] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState(30);
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);

  // Users list for dropdown
  const [users, setUsers] = useState<UserOption[]>([]);

  // Load users on mount
  useEffect(() => {
    async function loadUsers() {
      if (!profile) return;
      if (isSuperAdmin) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name')
          .order('name');
        setUsers(data ?? []);
      } else {
        setUsers([{ id: profile.id, name: profile.name }]);
      }
    }
    loadUsers();
  }, [profile, isSuperAdmin]);

  // Fetch logs when server-side filters change
  useEffect(() => {
    fetchLogs();
  }, [userFilter, timeFilter, customDateStart, customDateEnd, useCustomDate]);

  async function fetchLogs() {
    if (!profile) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('audit_log')
        .select('id, action, target_table, target_id, details, created_at, user_id, user:profiles!audit_log_user_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(500);

      // User scope
      if (userFilter) {
        query = query.eq('user_id', userFilter);
      } else if (!isSuperAdmin) {
        query = query.eq('user_id', profile.id);
      }

      // Time filter
      if (useCustomDate) {
        if (customDateStart) {
          query = query.gte('created_at', dayjs(customDateStart).startOf('day').toISOString());
        }
        if (customDateEnd) {
          query = query.lte('created_at', dayjs(customDateEnd).endOf('day').toISOString());
        }
      } else if (timeFilter > 0) {
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

  // Client-side filtered logs
  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesTagFilter(log, selectedTags)),
    [logs, selectedTags],
  );

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
      const rows = filteredLogs.map((a) => ({
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

  // Tag toggle helpers
  function toggleTag(tagId: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }

  function toggleModule(module: string) {
    const moduleTags = TAG_FILTERS.filter((t) => t.module === module);
    const allSelected = moduleTags.every((t) => selectedTags.has(t.id));
    setSelectedTags((prev) => {
      const next = new Set(prev);
      for (const t of moduleTags) {
        if (allSelected) {
          next.delete(t.id);
        } else {
          next.add(t.id);
        }
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedTags.size === 0) {
      // "全部" when nothing selected means select all
      setSelectedTags(new Set(TAG_FILTERS.map((t) => t.id)));
    } else {
      // Clear all
      setSelectedTags(new Set());
    }
  }

  function handleQuickTime(value: number) {
    setTimeFilter(value);
    setUseCustomDate(false);
    setCustomDateStart('');
    setCustomDateEnd('');
  }

  function handleCustomDateStart(val: string) {
    setCustomDateStart(val);
    setUseCustomDate(true);
  }

  function handleCustomDateEnd(val: string) {
    setCustomDateEnd(val);
    setUseCustomDate(true);
  }

  const isModuleAllSelected = (module: string) =>
    TAG_FILTERS.filter((t) => t.module === module).every((t) => selectedTags.has(t.id));

  return (
    <div className="space-y-4">
      {/* Row 1: User filter, time filter, export */}
      <div className="flex flex-wrap items-center gap-3">
        {/* User dropdown */}
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          disabled={!isSuperAdmin}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="">
            {isSuperAdmin ? '全部操作人' : profile?.name ?? ''}
          </option>
          {isSuperAdmin && users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        {/* Quick time buttons */}
        <div className="flex gap-1.5">
          {TIME_FILTERS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => handleQuickTime(tf.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !useCustomDate && timeFilter === tf.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customDateStart}
            onChange={(e) => handleCustomDateStart(e.target.value)}
            className={`text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              useCustomDate ? 'border-blue-300' : 'border-gray-200'
            }`}
          />
          <span className="text-gray-400 text-xs">~</span>
          <input
            type="date"
            value={customDateEnd}
            onChange={(e) => handleCustomDateEnd(e.target.value)}
            className={`text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              useCustomDate ? 'border-blue-300' : 'border-gray-200'
            }`}
          />
        </div>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exporting || filteredLogs.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? '导出中...' : '导出当前结果'}
        </button>
      </div>

      {/* Row 2: Business module tags */}
      <div className="space-y-1.5">
        {/* 全部 button */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={toggleAll}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
              selectedTags.size === 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
        </div>

        {/* Module rows */}
        {MODULES.map((module) => {
          const moduleTags = TAG_FILTERS.filter((t) => t.module === module);
          const colors = MODULE_COLORS[module] ?? MODULE_COLORS['用户管理'];
          const allSelected = isModuleAllSelected(module);

          return (
            <div key={module} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-500 w-16 shrink-0">{module}</span>
              <button
                onClick={() => toggleModule(module)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded border-2 transition-colors ${
                  allSelected
                    ? `${colors.selectAll} bg-opacity-20 bg-current`
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                全选
              </button>
              {moduleTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border transition-colors ${
                    selectedTags.has(tag.id)
                      ? `${colors.selected} border-current`
                      : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Log list */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">暂无操作日志</div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
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
