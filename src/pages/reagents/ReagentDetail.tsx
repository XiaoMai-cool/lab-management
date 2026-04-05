import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import dayjs from 'dayjs';

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

const MOVEMENT_TYPE_LABELS: Record<string, { text: string; color: string }> = {
  purchase_in: { text: '采购入库', color: 'text-green-700 bg-green-50' },
  return_in: { text: '退还入库', color: 'text-blue-700 bg-blue-50' },
  use_out: { text: '领用出库', color: 'text-orange-700 bg-orange-50' },
  dispose_out: { text: '废弃出库', color: 'text-red-700 bg-red-50' },
  adjust: { text: '库存调整', color: 'text-gray-700 bg-gray-100' },
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
  stock: number;
  min_stock: number | null;
  storage_location: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  price: number | null;
  msds_url: string | null;
  ghs_labels: string[] | null;
  supplier: { id: string; name: string } | null;
}

interface ActiveWarning {
  id: string;
  status: 'pending' | 'ordered';
  reported_by: string;
  reported_at: string;
  estimated_delivery_date: string | null;
  reporter: { name: string } | null;
}

interface StockMovement {
  id: string;
  movement_type: string;
  quantity: number;
  purpose: string | null;
  notes: string | null;
  created_at: string;
  user: { name: string } | null;
}

interface UsageLog {
  id: string;
  amount: string | null;
  purpose: string | null;
  experiment_name: string | null;
  created_at: string;
  user: { name: string } | null;
}

export default function ReagentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin: isAdminRole, isChemicalsManager } = useAuth();
  const [chemical, setChemical] = useState<Chemical | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [activeWarning, setActiveWarning] = useState<ActiveWarning | null>(null);
  const [warningLoading, setWarningLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'movements' | 'usage'>('movements');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showWarningConfirm, setShowWarningConfirm] = useState(false);
  const [showRecallConfirm, setShowRecallConfirm] = useState(false);
  const [recallSubmitting, setRecallSubmitting] = useState(false);

  const isAdmin = isAdminRole || isChemicalsManager;

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  async function fetchAll() {
    try {
      setLoading(true);
      const [chemRes, movRes, usageRes, warnRes] = await Promise.all([
        supabase
          .from('chemicals')
          .select('*, supplier:suppliers(id, name)')
          .eq('id', id)
          .single(),
        supabase
          .from('reagent_stock_movements')
          .select('*, user:profiles(name)')
          .eq('chemical_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('chemical_usage_logs')
          .select('*, user:profiles(name)')
          .eq('chemical_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('chemical_warnings')
          .select('id, status, reported_by, reported_at, estimated_delivery_date, reporter:profiles!chemical_warnings_reported_by_fkey(name)')
          .eq('chemical_id', id)
          .in('status', ['pending', 'ordered'])
          .order('reported_at', { ascending: false })
          .limit(1),
      ]);

      if (chemRes.error) throw chemRes.error;
      setChemical(chemRes.data);
      setMovements(movRes.data || []);
      setUsageLogs(usageRes.data || []);
      setActiveWarning((warnRes.data?.[0] as unknown as ActiveWarning) || null);
    } catch (err: any) {
      setError(err.message || '加载药品详情失败');
    } finally {
      setLoading(false);
    }
  }

  async function confirmReportWarning() {
    if (!id || !user) return;
    try {
      setWarningLoading(true);
      const { data, error: insertError } = await supabase
        .from('chemical_warnings')
        .insert({ chemical_id: id, reported_by: user.id, status: 'pending' })
        .select('id, status, reported_by, reported_at, estimated_delivery_date')
        .single();
      if (insertError) throw insertError;
      setActiveWarning({ ...data, reporter: null } as ActiveWarning);
      setShowWarningConfirm(false);
    } catch (err: any) {
      alert('上报失败: ' + (err.message || '未知错误'));
    } finally {
      setWarningLoading(false);
    }
  }

  async function confirmRecallWarning() {
    if (!activeWarning) return;
    try {
      setRecallSubmitting(true);
      const { error: delError } = await supabase
        .from('chemical_warnings')
        .delete()
        .eq('id', activeWarning.id);
      if (delError) throw delError;
      setActiveWarning(null);
      setShowRecallConfirm(false);
    } catch (err: any) {
      alert('撤回失败: ' + (err.message || '未知错误'));
    } finally {
      setRecallSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (chemical && chemical.stock > 0) {
      alert('库存不为 0 的药品不能删除，请先清空库存');
      return;
    }
    try {
      setDeleting(true);
      const { error: delError } = await supabase.from('chemicals').delete().eq('id', id);
      if (delError) throw delError;
      navigate('/reagents', { replace: true });
    } catch (err: any) {
      alert('删除失败: ' + (err.message || '未知错误'));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  if (error || !chemical) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">加载失败</p>
          <p className="mt-1 text-sm">{error || '药品不存在'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-3 rounded-md bg-gray-600 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const expiryDay = chemical.expiry_date ? dayjs(chemical.expiry_date) : null;
  const isExpired = expiryDay?.isBefore(dayjs());
  const isExpiringSoon = expiryDay && !isExpired && expiryDay.diff(dayjs(), 'day') <= 30;

  return (
    <div className="mx-auto max-w-4xl p-4">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <span>&larr;</span> 返回药品列表
      </button>

      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{chemical.name}</h1>
            {chemical.batch_number && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-sm font-semibold">
                {chemical.batch_number}
              </span>
            )}
          </div>
          {chemical.molecular_formula && (
            <p className="mt-1 text-sm text-gray-600 font-mono">{chemical.molecular_formula}</p>
          )}
          {chemical.cas_number && (
            <p className="mt-1 text-sm text-gray-500">CAS: {chemical.cas_number}</p>
          )}
          {chemical.category && (
            <StatusBadge className="mt-2">{chemical.category}</StatusBadge>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/reagents/${id}/edit`)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              编辑
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
            >
              删除
            </button>
          </div>
        )}
      </div>

      {/* GHS 安全标签 */}
      {chemical.ghs_labels && chemical.ghs_labels.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-500">安全标签</h3>
          <div className="flex flex-wrap gap-2">
            {chemical.ghs_labels.map((label) => {
              const ghs = GHS_LABELS[label];
              if (!ghs) return null;
              return (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${ghs.bg} ${ghs.color}`}
                >
                  <span className="text-base">{ghs.icon}</span>
                  {label} {ghs.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 详细信息网格 */}
      <Card className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoItem label="分子式" value={chemical.molecular_formula} />
          <InfoItem label="规格" value={chemical.specification} />
          <InfoItem label="浓度" value={chemical.concentration} />
          <InfoItem label="纯度" value={chemical.purity} />
          <InfoItem label="厂家" value={chemical.manufacturer} />
          <InfoItem label="供应商" value={chemical.supplier?.name} />
          <InfoItem label="存放位置" value={chemical.storage_location} />
          <InfoItem label="批次号" value={chemical.batch_number} />
          <InfoItem
            label="有效期"
            value={expiryDay?.format('YYYY-MM-DD')}
            valueClassName={
              isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-red-500 font-semibold' : ''
            }
            extra={isExpired ? '（已过期）' : isExpiringSoon ? `（${expiryDay!.diff(dayjs(), 'day')}天后过期）` : undefined}
          />
          <InfoItem
            label="价格"
            value={chemical.price != null ? `¥${chemical.price}` : null}
          />
          <InfoItem
            label="当前库存"
            value={`${chemical.stock} ${chemical.unit || ''}`}
            valueClassName={
              chemical.stock <= 0
                ? 'text-red-600 font-bold'
                : chemical.min_stock && chemical.stock <= chemical.min_stock
                  ? 'text-yellow-600 font-semibold'
                  : ''
            }
          />
          <InfoItem
            label="最低库存预警"
            value={chemical.min_stock != null ? `${chemical.min_stock} ${chemical.unit || ''}` : null}
          />
        </div>

        {/* MSDS 链接 */}
        {chemical.msds_url && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <a
              href={chemical.msds_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              查看 MSDS 安全数据表 &rarr;
            </a>
          </div>
        )}
      </Card>

      {/* 预警状态 */}
      <div className="mt-4">
        {activeWarning ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              activeWarning.status === 'pending'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-yellow-200 bg-yellow-50 text-yellow-700'
            }`}
          >
            <div className="flex items-center justify-between">
              {activeWarning.status === 'pending' ? (
                <span>
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1.5" />
                  已有人即将用完（{dayjs(activeWarning.reported_at).format('M月D日')}）
                </span>
              ) : (
                <span>
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 mr-1.5" />
                  已下单
                  {activeWarning.estimated_delivery_date && (
                    <>（预计{dayjs(activeWarning.estimated_delivery_date).format('M月D日')}送达）</>
                  )}
                </span>
              )}
              {/* 撤回按钮：仅上报者本人且状态为 pending 时显示 */}
              {user && activeWarning.reported_by === user.id && activeWarning.status === 'pending' && (
                <button
                  onClick={() => setShowRecallConfirm(true)}
                  className="rounded-lg border border-orange-300 px-3 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50"
                >
                  撤回
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowWarningConfirm(true)}
            disabled={warningLoading}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            即将用完
          </button>
        )}
      </div>

      {/* 标签页切换 */}
      <div className="mt-6 flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2.5 text-sm font-medium ${
            activeTab === 'movements'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          出入库记录
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2.5 text-sm font-medium ${
            activeTab === 'usage'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          领用记录
        </button>
      </div>

      {/* 出入库记录 */}
      {activeTab === 'movements' && (
        <div className="mt-4 space-y-3">
          {movements.length === 0 ? (
            <EmptyState title="暂无出入库记录" />
          ) : (
            movements.map((m) => {
              const typeInfo = MOVEMENT_TYPE_LABELS[m.movement_type] || {
                text: m.movement_type,
                color: 'text-gray-700 bg-gray-50',
              };
              return (
                <div key={m.id} className="flex gap-3 rounded-lg border border-gray-100 bg-white p-3">
                  <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.text}
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {m.quantity > 0 ? '+' : ''}{m.quantity} {chemical.unit || ''}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      <span>{dayjs(m.created_at).format('YYYY-MM-DD HH:mm')}</span>
                      {m.user?.name && <span>操作人: {m.user.name}</span>}
                    </div>
                    {m.purpose && <p className="mt-1 text-xs text-gray-500">用途: {m.purpose}</p>}
                    {m.notes && <p className="mt-0.5 text-xs text-gray-400">备注: {m.notes}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 领用记录 */}
      {activeTab === 'usage' && (
        <div className="mt-4 space-y-3">
          {usageLogs.length === 0 ? (
            <EmptyState title="暂无领用记录" />
          ) : (
            usageLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {log.user?.name && (
                    <span className="text-sm font-medium text-gray-800">{log.user.name}</span>
                  )}
                  {log.amount && (
                    <span className="text-sm text-gray-600">用量: {log.amount}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                  <span>{dayjs(log.created_at).format('YYYY-MM-DD HH:mm')}</span>
                  {log.experiment_name && <span>实验: {log.experiment_name}</span>}
                </div>
                {log.purpose && <p className="mt-1 text-xs text-gray-500">用途: {log.purpose}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* 删除确认弹窗 */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="确认删除">
        <p className="text-sm text-gray-600">
          确定要删除 <strong>{chemical.name}</strong> 吗？此操作不可撤销。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setShowDeleteModal(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? '删除中...' : '确认删除'}
          </button>
        </div>
      </Modal>

      {/* 预警确认弹窗 */}
      <Modal
        open={showWarningConfirm}
        onClose={() => setShowWarningConfirm(false)}
        title="确认上报预警"
      >
        <p className="text-sm text-gray-600">
          确认上报「{chemical.name}」即将用完？上报后所有人将看到「即将用完」标签
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setShowWarningConfirm(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={confirmReportWarning}
            disabled={warningLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {warningLoading ? '提交中...' : '确认上报'}
          </button>
        </div>
      </Modal>

      {/* 撤回确认弹窗 */}
      <Modal
        open={showRecallConfirm}
        onClose={() => setShowRecallConfirm(false)}
        title="撤回预警"
      >
        <p className="text-sm text-gray-600">
          确认撤回「{chemical.name}」的即将用完预警？
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setShowRecallConfirm(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={confirmRecallWarning}
            disabled={recallSubmitting}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {recallSubmitting ? '撤回中...' : '确认撤回'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({
  label,
  value,
  valueClassName = '',
  extra,
}: {
  label: string;
  value: string | null | undefined;
  valueClassName?: string;
  extra?: string;
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-gray-900 ${valueClassName}`}>
        {value || <span className="text-gray-300">-</span>}
        {extra && <span className="ml-1 text-xs">{extra}</span>}
      </dd>
    </div>
  );
}
