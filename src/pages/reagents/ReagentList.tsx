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
import Modal from '../../components/Modal';
import { X, ClipboardList, Trash2, Save, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react';

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
];

interface ActiveWarning {
  id: string;
  chemical_id: string;
  status: 'pending' | 'ordered';
  reported_by: string;
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

interface ChecklistItem {
  chemical_id: string;
  name: string;
  batch_number: string;
  location: string;
  specification: string;
}

interface SavedList {
  id: string;
  name: string;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
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
  const { user, profile, isAdmin, canManageModule } = useAuth();
  const canManage = isAdmin || canManageModule('chemicals');
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [activeWarnings, setActiveWarnings] = useState<ActiveWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeCodePrefix, setActiveCodePrefix] = useState('');

  // Warning confirmation modal
  const [warningConfirmChemical, setWarningConfirmChemical] = useState<Chemical | null>(null);
  const [warningSubmitting, setWarningSubmitting] = useState(false);

  // Warning recall modal
  const [recallWarning, setRecallWarning] = useState<{ warning: ActiveWarning; chemical: Chemical } | null>(null);
  const [recallSubmitting, setRecallSubmitting] = useState(false);

  // Checklist state - restore from sessionStorage on mount
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const saved = sessionStorage.getItem('reagent_checklist');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  // Sync checklist to sessionStorage
  useEffect(() => {
    if (checklist.length > 0) {
      sessionStorage.setItem('reagent_checklist', JSON.stringify(checklist));
    } else {
      sessionStorage.removeItem('reagent_checklist');
    }
  }, [checklist]);

  // Save list modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveListName, setSaveListName] = useState('');
  const [savingList, setSavingList] = useState(false);

  // Load list modal
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [changedItems, setChangedItems] = useState<Set<string>>(new Set());
  const [categoryExpanded, setCategoryExpanded] = useState(false);

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
          .select('id, chemical_id, status, reported_by')
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

  function handleWarningClick(e: React.MouseEvent, chemical: Chemical) {
    e.stopPropagation();
    if (!user) return;
    const existing = getWarningForChemical(chemical.id);
    if (existing) return;
    setWarningConfirmChemical(chemical);
  }

  async function confirmReportWarning() {
    if (!warningConfirmChemical || !user) return;
    try {
      setWarningSubmitting(true);
      const { data, error: insertError } = await supabase
        .from('chemical_warnings')
        .insert({
          chemical_id: warningConfirmChemical.id,
          reported_by: user.id,
          status: 'pending',
        })
        .select('id, chemical_id, status, reported_by')
        .single();
      if (insertError) throw insertError;
      setActiveWarnings((prev) => [...prev, data as ActiveWarning]);
      setWarningConfirmChemical(null);
    } catch (err: any) {
      alert('上报失败: ' + (err.message || '未知错误'));
    } finally {
      setWarningSubmitting(false);
    }
  }

  function handleRecallClick(e: React.MouseEvent, warning: ActiveWarning, chemical: Chemical) {
    e.stopPropagation();
    setRecallWarning({ warning, chemical });
  }

  async function confirmRecallWarning() {
    if (!recallWarning) return;
    try {
      setRecallSubmitting(true);
      const { error: delError } = await supabase
        .from('chemical_warnings')
        .delete()
        .eq('id', recallWarning.warning.id);
      if (delError) throw delError;
      setActiveWarnings((prev) => prev.filter((w) => w.id !== recallWarning.warning.id));
      setRecallWarning(null);
    } catch (err: any) {
      alert('撤回失败: ' + (err.message || '未知错误'));
    } finally {
      setRecallSubmitting(false);
    }
  }

  // Checklist functions
  function addToChecklist(e: React.MouseEvent, chemical: Chemical) {
    e.stopPropagation();
    if (checklist.some((item) => item.chemical_id === chemical.id)) return;
    setChecklist((prev) => [
      ...prev,
      {
        chemical_id: chemical.id,
        name: chemical.name,
        batch_number: chemical.batch_number || '',
        location: chemical.storage_location || '',
        specification: chemical.specification || '',
      },
    ]);
  }

  function removeFromChecklist(chemicalId: string) {
    setChecklist((prev) => prev.filter((item) => item.chemical_id !== chemicalId));
  }

  function clearChecklist() {
    setChecklist([]);
    setChecklistExpanded(false);
  }

  async function handleSaveList() {
    if (!saveListName.trim() || !profile) return;
    try {
      setSavingList(true);
      const { error: insertError } = await supabase.from('reagent_lists').insert({
        user_id: profile.id,
        name: saveListName.trim(),
        items: checklist,
      });
      if (insertError) throw insertError;
      setShowSaveModal(false);
      setSaveListName('');
      alert('清单已保存');
    } catch (err: any) {
      alert('保存失败: ' + (err.message || '未知错误'));
    } finally {
      setSavingList(false);
    }
  }

  async function fetchSavedLists() {
    if (!profile) return;
    try {
      setLoadingLists(true);
      const { data, error: fetchError } = await supabase
        .from('reagent_lists')
        .select('*')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false });
      if (fetchError) throw fetchError;
      setSavedLists((data || []) as SavedList[]);
    } catch (err: any) {
      alert('加载清单失败: ' + (err.message || '未知错误'));
    } finally {
      setLoadingLists(false);
    }
  }

  async function loadSavedList(list: SavedList) {
    // Re-fetch chemicals by their IDs to check for changes
    const chemicalIds = list.items.map((item) => item.chemical_id);
    const { data: freshChemicals } = await supabase
      .from('chemicals')
      .select('id, name, batch_number, storage_location, specification')
      .in('id', chemicalIds);

    const freshMap = new Map(
      (freshChemicals || []).map((c: any) => [c.id, c])
    );

    const changed = new Set<string>();
    const loadedItems: ChecklistItem[] = list.items.map((item) => {
      const fresh = freshMap.get(item.chemical_id);
      if (fresh) {
        const newItem: ChecklistItem = {
          chemical_id: item.chemical_id,
          name: fresh.name || item.name,
          batch_number: fresh.batch_number || '',
          location: fresh.storage_location || '',
          specification: fresh.specification || '',
        };
        if (
          newItem.batch_number !== item.batch_number ||
          newItem.location !== item.location
        ) {
          changed.add(item.chemical_id);
        }
        return newItem;
      }
      return item;
    });

    setChecklist(loadedItems);
    setChangedItems(changed);
    setShowLoadModal(false);
    setChecklistExpanded(true);
  }

  async function deleteSavedList(listId: string) {
    try {
      const { error: delError } = await supabase
        .from('reagent_lists')
        .delete()
        .eq('id', listId);
      if (delError) throw delError;
      setSavedLists((prev) => prev.filter((l) => l.id !== listId));
    } catch (err: any) {
      alert('删除失败: ' + (err.message || '未知错误'));
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

  const isInChecklist = (chemicalId: string) =>
    checklist.some((item) => item.chemical_id === chemicalId);

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
    <div className="mx-auto max-w-7xl p-4 pb-28">
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
      <div className="mt-2">
        {/* Mobile toggle */}
        <button
          onClick={() => setCategoryExpanded(!categoryExpanded)}
          className="md:hidden flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
        >
          药品分类 {activeCategory ? `(${activeCategory})` : ''}
          {categoryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <div className={`${categoryExpanded ? 'flex' : 'hidden'} md:flex gap-2 overflow-x-auto pb-1 mt-1 md:mt-0`}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setActiveCategory(cat.value); setActiveCodePrefix(''); setCategoryExpanded(false); }}
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
      </div>

      {/* 药品列表 */}
      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={searchQuery ? '没有找到匹配的药品' : '暂无药品信息'} />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((chemical) => {
            const warning = getWarningForChemical(chemical.id);
            const inChecklist = isInChecklist(chemical.id);
            const isMyWarning = warning && user && warning.reported_by === user.id;
            const canRecall = isMyWarning && warning.status === 'pending';

            return (
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

                  {/* 底部：分类 + 存放位置 + 预警 + 清单 */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px] text-gray-400">
                    <div className="flex items-center gap-2">
                      <span>{chemical.category || '未分类'}</span>
                      {(() => {
                        if (warning) {
                          return (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                warning.status === 'pending'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                                warning.status === 'pending' ? 'bg-red-500' : 'bg-yellow-500'
                              }`} />
                              {warning.status === 'pending' ? '即将用完' : '已下单'}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {chemical.storage_location && <span>{chemical.storage_location}</span>}
                      {/* 撤回按钮：仅上报者本人且状态为 pending 时显示 */}
                      {canRecall && (
                        <button
                          onClick={(e) => handleRecallClick(e, warning, chemical)}
                          className="rounded border border-orange-300 px-1.5 py-0.5 text-[10px] font-medium text-orange-500 hover:bg-orange-50"
                        >
                          撤回
                        </button>
                      )}
                      {/* 预警按钮：仅在没有活跃预警时显示 */}
                      {!warning && (
                        <button
                          onClick={(e) => handleWarningClick(e, chemical)}
                          className="rounded border border-red-300 px-1.5 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-50"
                        >
                          预警
                        </button>
                      )}
                      {/* 加入清单按钮 */}
                      <button
                        onClick={(e) => addToChecklist(e, chemical)}
                        disabled={inChecklist}
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                          inChecklist
                            ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'border-blue-300 text-blue-500 hover:bg-blue-50'
                        }`}
                      >
                        {inChecklist ? '已在清单中' : '加入清单'}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-gray-400">
        显示 {filtered.length} / {chemicals.length} 种药品
      </p>

      {/* 浮动取药清单栏 */}
      {checklist.length > 0 && !checklistExpanded && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 cursor-pointer"
          onClick={() => setChecklistExpanded(true)}
        >
          <div className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg hover:bg-blue-700 transition-colors">
            <ClipboardList className="h-4 w-4" />
            <span className="text-sm font-medium">取药清单 ({checklist.length})</span>
          </div>
        </div>
      )}

      {/* 全屏取药清单 */}
      {checklistExpanded && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900">取药清单 ({checklist.length})</h3>
            </div>
            <button
              onClick={() => setChecklistExpanded(false)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 清单内容 - 按编号排序 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {[...checklist]
              .sort((a, b) => (a.batch_number || '').localeCompare(b.batch_number || ''))
              .map((item) => (
                <div
                  key={item.chemical_id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    changedItems.has(item.chemical_id)
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.batch_number && (
                      <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 font-bold shrink-0">
                        {item.batch_number}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                    {changedItems.has(item.chemical_id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800 font-medium shrink-0">
                        信息已变更
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeFromChecklist(item.chemical_id)}
                    className="ml-2 shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-3 shrink-0 safe-area-pb">
            <button
              onClick={clearChecklist}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
            <button
              onClick={() => { setShowSaveModal(true); setSaveListName(''); }}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save className="h-3.5 w-3.5" />
              保存清单
            </button>
            <button
              onClick={() => { setShowLoadModal(true); fetchSavedLists(); }}
              className="flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              加载清单
            </button>
          </div>
        </div>
      )}

      {/* 预警确认弹窗 */}
      <Modal
        open={!!warningConfirmChemical}
        onClose={() => setWarningConfirmChemical(null)}
        title="确认上报预警"
      >
        <p className="text-sm text-gray-600">
          确认上报「{warningConfirmChemical?.name}」即将用完？上报后所有人将看到「即将用完」标签
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setWarningConfirmChemical(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={confirmReportWarning}
            disabled={warningSubmitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {warningSubmitting ? '提交中...' : '确认上报'}
          </button>
        </div>
      </Modal>

      {/* 撤回确认弹窗 */}
      <Modal
        open={!!recallWarning}
        onClose={() => setRecallWarning(null)}
        title="撤回预警"
      >
        <p className="text-sm text-gray-600">
          确认撤回「{recallWarning?.chemical.name}」的即将用完预警？
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setRecallWarning(null)}
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

      {/* 保存清单弹窗 */}
      <Modal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="保存取药清单"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">清单名称</label>
          <input
            type="text"
            value={saveListName}
            onChange={(e) => setSaveListName(e.target.value)}
            placeholder="例如：本周实验药品"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <p className="mt-2 text-xs text-gray-500">包含 {checklist.length} 种药品</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setShowSaveModal(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSaveList}
            disabled={savingList || !saveListName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savingList ? '保存中...' : '保存'}
          </button>
        </div>
      </Modal>

      {/* 加载清单弹窗 */}
      <Modal
        open={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        title="加载取药清单"
      >
        {loadingLists ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : savedLists.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">暂无已保存的清单</p>
        ) : (
          <div className="space-y-2">
            {savedLists.map((list) => (
              <div
                key={list.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
              >
                <button
                  onClick={() => loadSavedList(list)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-medium text-gray-900">{list.name}</p>
                  <p className="text-xs text-gray-500">
                    {list.items.length} 种药品 · {new Date(list.updated_at).toLocaleDateString('zh-CN')}
                  </p>
                </button>
                <button
                  onClick={() => deleteSavedList(list.id)}
                  className="ml-2 shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
